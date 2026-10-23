export default class SnProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

    // 2つのオシレーター用の位相
    this.phase1 = Math.PI / 2;
    this.phase2 = Math.PI / 2;

    // フィルターの係数計算ヘルパー
    this.calcHPF = (freq) => {
      const w0 = (2 * Math.PI * freq) / sampleRate;
      const alpha = Math.sin(w0) / Math.SQRT2; // Q = 0.707
      const a0 = 1 + alpha;
      return {
        b0: (1 + Math.cos(w0)) / 2 / a0,
        b1: -(1 + Math.cos(w0)) / a0,
        b2: (1 + Math.cos(w0)) / 2 / a0,
        a1: (-2 * Math.cos(w0)) / a0,
        a2: (1 - alpha) / a0,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0, // 状態変数
      };
    };

    this.calcLPF = (freq) => {
      const w0 = (2 * Math.PI * freq) / sampleRate;
      const alpha = Math.sin(w0) / Math.SQRT2;
      const a0 = 1 + alpha;
      return {
        b0: (1 - Math.cos(w0)) / 2 / a0,
        b1: (1 - Math.cos(w0)) / a0,
        b2: (1 - Math.cos(w0)) / 2 / a0,
        a1: (-2 * Math.cos(w0)) / a0,
        a2: (1 - alpha) / a0,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
      };
    };

    // SCコードに基づく3つのフィルターを用意
    this.noiseHPF = this.calcHPF(1800);
    this.noiseLPF = this.calcLPF(8850);
    this.masterHPF = this.calcHPF(340);
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.phase1 = Math.PI / 2;
    this.phase2 = Math.PI / 2;

    // フィルターの状態変数をクリア
    const clearState = (f) => {
      f.x1 = f.x2 = f.y1 = f.y2 = 0;
    };
    clearState(this.noiseHPF);
    clearState(this.noiseLPF);
    clearState(this.masterHPF);
  }

  // Biquadフィルターの1サンプル処理ヘルパー
  processFilter(f, input) {
    const output =
      f.b0 * input + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
    f.x2 = f.x1;
    f.x1 = input;
    f.y2 = f.y1;
    f.y1 = output;
    return output;
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

    // パラメータの取得
    const amp = parameters.amp[0];
    const tone = parameters.tone[0];
    const tone2 = parameters.tone2[0];
    const snappy = parameters.snappy[0];
    const amp2 = parameters.amp2[0];
    const trig = parameters.trigger;

    const blockStart = currentTime;

    for (let i = 0; i < channel.length; i++) {
      const t = trig.length > 1 ? trig[i] : trig[0];

      // エッジ検出
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

      // 寿命判定 (noiseEnvの4.2秒が最長)
      if (elapsed >= 4.2) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // 1. エンベロープの計算
      // 厳密にはEnv.perc(0.001, ...)ですが、0.001秒はほぼ1サンプルのため1.0からの減衰で近似
      const atkEnv = this.curveValue(elapsed, 0.8, 1.0, 0.0, -95);
      const noiseEnv = this.curveValue(elapsed, 4.2, 1.0, 0.0, -115);

      // 2. 胴鳴り (2つのサイン波)
      const osc1 = Math.sin(this.phase2) * 0.6; // SCコードでは tone2 に osc1 が対応
      const osc2 = Math.sin(this.phase1) * 0.7; // SCコードでは tone に osc2 が対応
      const sum = (osc1 + osc2) * atkEnv * amp2;

      // 3. スナッピー (ノイズ + HPF + LPF)
      let noise = Math.random() * 2 - 1; // WhiteNoise
      noise = this.processFilter(this.noiseHPF, noise);
      noise = this.processFilter(this.noiseLPF, noise);
      noise = noise * noiseEnv * snappy;

      // 4. ミックス
      let sig = (noise + sum) * amp * 2.5;

      // 5. マスターフィルター (HPF)
      sig = this.processFilter(this.masterHPF, sig);

      // 最終出力
      channel[i] = sig;

      // 6. 位相の更新
      this.phase1 =
        (this.phase1 + (2 * Math.PI * tone) / sampleRate) % (Math.PI * 2);
      this.phase2 =
        (this.phase2 + (2 * Math.PI * tone2) / sampleRate) % (Math.PI * 2);
    }

    if (outputs[0][1]) {
      outputs[0][1].set(channel);
    }
    return true;
  }

  static get parameterDescriptors() {
    // arg amp=2, tone=340, tone2=189, snappy=0.3, gate=0, amp2=1;
    return [
      {
        name: 'trigger',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'amp',
        defaultValue: 2.0,
        minValue: 0.5,
        maxValue: 2.5,
        automationRate: 'k-rate',
      },
      {
        name: 'tone',
        defaultValue: 340.0,
        minValue: 210.8,
        maxValue: 391.0,
        automationRate: 'k-rate',
      },
      {
        name: 'tone2',
        defaultValue: 189.0,
        minValue: 117.18,
        maxValue: 217.35,
        automationRate: 'k-rate',
      },
      {
        name: 'snappy',
        defaultValue: 0.3,
        minValue: 0.002,
        maxValue: 0.45,
        automationRate: 'k-rate',
      },
      {
        name: 'amp2',
        defaultValue: 1.0,
        minValue: 0.6,
        maxValue: 1.0,
        automationRate: 'k-rate',
      },
    ];
  }
}
