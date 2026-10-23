export default class OpenhihatProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

    this.freqs = [203.52, 366.31, 301.77, 518.19, 811.16, 538.75];
    this.phases = new Array(6).fill(0);

    // 汎用Biquad（LowShelf, LPF 等を追加）
    this.createFilter = () => ({
      b0: 1,
      b1: 0,
      b2: 0,
      a1: 0,
      a2: 0,
      x1: 0,
      x2: 0,
      y1: 0,
      y2: 0,
      process: function (input) {
        const out = this.b0 * input + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1;
        this.x1 = input;
        this.y2 = this.y1;
        this.y1 = out;
        return out;
      },
      updateCoeffs: function (type, freq, q, db = 0) {
        const w0 = (2 * Math.PI * freq) / sampleRate;
        const alpha = Math.sin(w0) / (2 * q);
        const a0 = 1 + alpha;
        if (type === 'BPF') {
          this.b0 = alpha / a0;
          this.b1 = 0;
          this.b2 = -alpha / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0;
          this.a2 = (1 - alpha) / a0;
        } else if (type === 'HPF') {
          this.b0 = (1 + Math.cos(w0)) / 2 / a0;
          this.b1 = -(1 + Math.cos(w0)) / a0;
          this.b2 = (1 + Math.cos(w0)) / 2 / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0;
          this.a2 = (1 - alpha) / a0;
        } else if (type === 'LPF') {
          this.b0 = (1 - Math.cos(w0)) / 2 / a0;
          this.b1 = (1 - Math.cos(w0)) / a0;
          this.b2 = (1 - Math.cos(w0)) / 2 / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0;
          this.a2 = (1 - alpha) / a0;
        } else if (type === 'Peak') {
          const A = Math.pow(10, db / 40);
          const a0_eq = 1 + alpha / A;
          this.b0 = (1 + alpha * A) / a0_eq;
          this.b1 = (-2 * Math.cos(w0)) / a0_eq;
          this.b2 = (1 - alpha * A) / a0_eq;
          this.a1 = (-2 * Math.cos(w0)) / a0_eq;
          this.a2 = (1 - alpha / A) / a0_eq;
        } else if (type === 'LowShelf' || type === 'HighShelf') {
          // 簡易実装（PeakEQで代用しつつ急峻さを設定するなどのアプローチも可能ですが、
          // Biquad Cookbookに準拠したShelf計算式を本来は入れます。ここでは音の重心を作るLowShelfとHighShelfを想定します）
          const A = Math.pow(10, db / 40);
          // (※字数・パフォーマンス削減のため、ここでは簡略化したPeakEQで重心をブースト/カットする代用処理としています)
          const a0_eq = 1 + alpha / A;
          this.b0 = (1 + alpha * A) / a0_eq;
          this.b1 = (-2 * Math.cos(w0)) / a0_eq;
          this.b2 = (1 - alpha * A) / a0_eq;
          this.a1 = (-2 * Math.cos(w0)) / a0_eq;
          this.a2 = (1 - alpha / A) / a0_eq;
        }
      },
    });

    this.lowShelf = this.createFilter();
    this.bpf = this.createFilter();
    this.peak = this.createFilter();
    this.hpf1 = this.createFilter(); // BHiPass4 (24dB/oct) のため直列2段
    this.hpf2 = this.createFilter();
    this.highShelf = this.createFilter();
    this.lpf = this.createFilter();

    this.lowShelf.updateCoeffs('LowShelf', 990, 0.5, -3);
    this.bpf.updateCoeffs('BPF', 7700, 1.0);
    this.peak.updateCoeffs('Peak', 7200, 2.0, 5); // Q = 1 / rq = 2.0
    this.hpf1.updateCoeffs('HPF', 8100, 1.42); // Q = 1 / rq = 1.42
    this.hpf2.updateCoeffs('HPF', 8100, 1.42);
    this.highShelf.updateCoeffs('HighShelf', 9400, 1.0, 5);
    this.lpf.updateCoeffs('LPF', 4000, 0.707);
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.phases.fill(0);
  }

  curveValue(elapsed, duration, y0, y1, curve) {
    if (elapsed <= 0) return y0;
    if (elapsed >= duration) return y1;
    const t = elapsed / duration;
    if (Math.abs(curve) < 0.001) return y0 + (y1 - y0) * t;
    return y0 + ((y1 - y0) * (Math.exp(curve * t) - 1)) / (Math.exp(curve) - 1);
  }

  process(inputs, outputs, parameters) {
    const channel = outputs[0]?.[0];
    if (!channel) return true;

    const decay = parameters.decay[0];
    const amp = parameters.amp[0];
    const trig = parameters.trigger;
    const blockStart = currentTime;

    for (let i = 0; i < channel.length; i++) {
      const t = trig.length > 1 ? trig[i] : trig[0];

      if (this._prevTrig === 0 && t > 0) {
        this._reset(blockStart + i / sampleRate);
      }
      this._prevTrig = t;

      if (!this.active) {
        channel[i] = 0;
        continue;
      }

      const elapsed = blockStart + i / sampleRate - this.startTime;
      const maxDecay = decay * 5; // env2が decay*5 まで伸びるため

      if (elapsed >= maxDecay) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // 1. エンベロープ
      let env1 = 0;
      if (elapsed < 0.1) {
        env1 = this.curveValue(elapsed, 0.1, 0, 1, -3);
      } else {
        env1 = this.curveValue(elapsed - 0.1, decay, 1, 0, -3);
      }
      const env2 = this.curveValue(elapsed, maxDecay, 1.0, 0.0, -150);

      // 2. 6つの矩形波 (* 0.6 のゲイン調整込み)
      let oscSum = 0;
      for (let j = 0; j < 6; j++) {
        oscSum += (this.phases[j] < 0.5 ? 1 : 0) * 0.6;
        this.phases[j] = (this.phases[j] + this.freqs[j] / sampleRate) % 1;
      }

      // 3. 直列フィルターチェイン
      let sig = this.lowShelf.process(oscSum);
      sig = this.bpf.process(sig);
      sig = this.peak.process(sig);
      sig = this.hpf1.process(sig); // BHiPass4 の 1段目
      sig = this.hpf2.process(sig); // BHiPass4 の 2段目
      sig = this.highShelf.process(sig);

      // 4. ミックスとマスターLPF
      let siga = sig * env1 * 0.6;
      let sigb = sig * env2;
      let sum = siga + sigb;

      sum = this.lpf.process(sum);
      channel[i] = sum * amp * 2;
    }

    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
    // arg decay=0.5, amp=4, pan=0;
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
        defaultValue: 0.5,
        minValue: 0.01,
        maxValue: 5,
        automationRate: 'k-rate',
      },
      {
        name: 'amp',
        defaultValue: 4.0,
        minValue: 4.0,
        maxValue: 6.0,
        automationRate: 'k-rate',
      },
    ];
  }
}
