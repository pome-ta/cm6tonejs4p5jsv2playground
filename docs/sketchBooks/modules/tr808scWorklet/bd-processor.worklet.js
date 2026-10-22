export class BDProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.active = false; // 発振中フラグ(startTime固定から変更)
    this.startTime = 0;

    // sig, sub用の位相と、punch用の位相
    this.phase = Math.PI / 2;
    this.punchPhase = Math.PI / 2;
    this._prevTrig = 0;

    // HPF 係数は従来通り(sampleRate は worklet グローバル)
    // HPF (350Hz) の係数事前計算
    const w0 = (2 * Math.PI * 350) / sampleRate;
    const alpha = Math.sin(w0) / Math.SQRT2;
    const a0 = 1 + alpha;

    this.hpf_b0 = (1 + Math.cos(w0)) / 2 / a0;
    this.hpf_b1 = -(1 + Math.cos(w0)) / a0;
    this.hpf_b2 = (1 + Math.cos(w0)) / 2 / a0;
    this.hpf_a1 = (-2 * Math.cos(w0)) / a0;
    this.hpf_a2 = (1 - alpha) / a0;

    // HPF用の状態変数
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime; // elapsed の基準は「今回のエッジ」
    this.phase = Math.PI / 2;
    this.punchPhase = Math.PI / 2;
    this.x1 = this.x2 = this.y1 = this.y2 = 0; // HPF 状態もクリア
  }

  curveValue(elapsed, duration, y0, y1, curve) {
    if (elapsed <= 0) {
      return y0;
    }
    if (elapsed >= duration) {
      return y1;
    }
    const t = elapsed / duration;
    if (Math.abs(curve) < 0.001) {
      return y0 + (y1 - y0) * t;
    }
    return y0 + ((y1 - y0) * (Math.exp(curve * t) - 1)) / (Math.exp(curve) - 1);
  }

  process(inputs, outputs, parameters) {
    const channel = outputs[0]?.[0];
    if (!channel) {
      return true;
    }

    const decay = parameters.decay[0]; // k-rate は先頭1要素
    const amp = parameters.amp[0];
    const tone = parameters.tone[0];
    const trig = parameters.trigger; // a-rate は配列のまま

    const blockStart = currentTime;

    for (let i = 0; i < channel.length; i++) {
      const t = trig.length > 1 ? trig[i] : trig[0]; // a-rate 配列を読む

      // 立ち上がりエッジ検出 → そのサンプル位置で再発振
      if (this._prevTrig === 0 && t > 0) {
        this._reset(blockStart + i / sampleRate);
      }
      this._prevTrig = t;

      if (!this.active) {
        channel[i] = 0;
        continue;
      }

      const sampleTime = blockStart + i / sampleRate;
      const elapsed = sampleTime - this.startTime;

      if (elapsed >= decay) {
        // 減衰しきったら無音へ戻る
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // 1. ボリュームエンベロープ
      const env = this.curveValue(elapsed, decay, 1.0, 0.0, -225);
      const trienv = this.curveValue(elapsed, decay, 0.6, 0.0, -230);

      // 2. ピッチエンベロープ (sig, sub用)
      let fenv = tone;
      if (elapsed <= 0.05) {
        fenv = this.curveValue(elapsed, 0.05, tone * 7, tone * 1.35, -14);
      } else if (elapsed <= 0.05 + 0.6) {
        fenv = this.curveValue(elapsed - 0.05, 0.6, tone * 1.35, tone, -14);
      }

      // 3. ピッチエンベロープ (punch用)
      let pfenv = tone;
      if (elapsed <= 0.03) {
        pfenv = this.curveValue(elapsed, 0.03, tone * 7, tone * 1.35, -10);
      } else if (elapsed <= 0.03 + 0.6) {
        pfenv = this.curveValue(elapsed - 0.03, 0.6, tone * 1.35, tone, -10);
      }

      // 4. オシレーターの計算
      const sig = Math.sin(this.phase) * env;
      const sub = (2 / Math.PI) * Math.asin(Math.sin(this.phase)) * trienv * 0.05;

      // punch (サイン波を生成してHPFに通す)
      const punchOsc = Math.sin(this.punchPhase) * env * 2;
      const punch =
        this.hpf_b0 * punchOsc +
        this.hpf_b1 * this.x1 +
        this.hpf_b2 * this.x2 -
        this.hpf_a1 * this.y1 -
        this.hpf_a2 * this.y2;

      this.x2 = this.x1;
      this.x1 = punchOsc;
      this.y2 = this.y1;
      this.y1 = punch;

      // 5. ミックス (リミッターなし、単純加算のみ)
      // const mixed = (sig) * 2.5;
      // const mixed = (sub) * 2.5;
      // const mixed = (punch) * 2.5;
      // const mixed = (sub + punch) * 2.5;
      const mixed = (sig + sub + punch) * 2.5;

      // 【パターン1】リミッターなし(単純加算そのまま)
      // let limited = mixed;

      // 【パターン2】ハードクリップ(-0.5〜0.5を超えた分をバッサリ切り捨てる)
      // let limited = Math.max(-0.5, Math.min(0.5, mixed));

      // 【パターン3】ソフトクリッパー(Math.tanhを使って滑らかに0.5に抑え込む)
      let limited = Math.tanh(mixed * 2.0) * 0.5;

      channel[i] = limited * amp;

      // 6. 位相の更新
      this.phase = (this.phase + (2 * Math.PI * fenv) / sampleRate) % (Math.PI * 2);
      this.punchPhase = (this.punchPhase + (2 * Math.PI * pfenv) / sampleRate) % (Math.PI * 2);

      if (env < 0.0001) {
        this.active = false; // 減衰完了で待機に戻る
      }
    }
    if (outputs[0][1]) {
      outputs[0][1].set(channel);
    }
    return true;
  }

  static get parameterDescriptors() {
    // decay=30, amp=2, gate=0, tone=56;
    return [
      {
        name: 'trigger',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'decay',
        defaultValue: 30,
        minValue: 0.01,
        maxValue: 110,
        automationRate: 'k-rate',
      },
      {
        name: 'amp',
        defaultValue: 2,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
      {
        name: 'tone',
        defaultValue: 56,
        minValue: 20,
        maxValue: 200,
        automationRate: 'k-rate',
      },
    ];
  }
}
