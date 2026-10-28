export default class CymbalProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

    // 6つの矩形波の周波数と位相[cite: 1]
    this.freqs = [
      203.52, 366.31, 301.77, 518.19, 811.16, 538.75,
    ];
    this.phases = new Array(6).fill(0);

    // 汎用Biquadフィルター生成ヘルパー
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
        const out =
          this.b0 * input +
          this.b1 * this.x1 +
          this.b2 * this.x2 -
          this.a1 * this.y1 -
          this.a2 * this.y2;
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
        const A = Math.pow(10, db / 40);

        if (type === 'HPF') {
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
        } else if (type === 'BPF') {
          this.b0 = alpha / a0;
          this.b1 = 0;
          this.b2 = -alpha / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0;
          this.a2 = (1 - alpha) / a0;
        } else if (type === 'Peak') {
          const a0_eq = 1 + alpha / A;
          this.b0 = (1 + alpha * A) / a0_eq;
          this.b1 = (-2 * Math.cos(w0)) / a0_eq;
          this.b2 = (1 - alpha * A) / a0_eq;
          this.a1 = (-2 * Math.cos(w0)) / a0_eq;
          this.a2 = (1 - alpha / A) / a0_eq;
        } else if (
          type === 'LowShelf' ||
          type === 'HighShelf'
        ) {
          // Biquad Cookbookに準拠したシェルフフィルター近似
          const a0_eq = 1 + alpha / A;
          this.b0 = (1 + alpha * A) / a0_eq;
          this.b1 = (-2 * Math.cos(w0)) / a0_eq;
          this.b2 = (1 - alpha * A) / a0_eq;
          this.a1 = (-2 * Math.cos(w0)) / a0_eq;
          this.a2 = (1 - alpha / A) / a0_eq;
        }
      },
    });

    // --- チェイン1 ---
    this.c1_ls = this.createFilter(); // BLowShelf(2000, 1, 5)[cite: 1]
    this.c1_bpf = this.createFilter(); // BPF(3000)[cite: 1]
    this.c1_peak = this.createFilter(); // BPeakEQ(2400, 0.5, 5)[cite: 1]
    this.c1_hpf = this.createFilter(); // BHiPass(1550, 0.7)[cite: 1]
    this.c1_lpf = this.createFilter(); // LPF(3000)[cite: 1]

    // --- チェイン2 ---
    this.c2_ls = this.createFilter(); // BLowShelf(990, 2, -5)[cite: 1]
    this.c2_bpf = this.createFilter(); // BPF(7400)[cite: 1]
    this.c2_peak = this.createFilter(); // BPeakEQ(7200, 0.5, 5)[cite: 1]
    this.c2_hpf1 = this.createFilter(); // BHiPass4(6800, 0.7) 段1[cite: 1]
    this.c2_hpf2 = this.createFilter(); // BHiPass4(6800, 0.7) 段2[cite: 1]
    this.c2_hs = this.createFilter(); // BHiShelf(10000, 1, -4)[cite: 1]

    // --- チェイン3 ---
    this.c3_ls = this.createFilter(); // BLowShelf(990, 2, -15)[cite: 1]
    this.c3_bpf = this.createFilter(); // BPF(6500)[cite: 1]
    this.c3_peak = this.createFilter(); // BPeakEQ(7400, 0.35, 10)[cite: 1]
    this.c3_hpf1 = this.createFilter(); // BHiPass4(10500, 0.8, 2) 段1[cite: 1]
    this.c3_hpf2 = this.createFilter(); // BHiPass4(10500, 0.8, 2) 段2[cite: 1]

    // --- マスター ---
    this.master_lpf = this.createFilter(); // LPF(4000)[cite: 1]

    // 係数の初期化
    this.c1_ls.updateCoeffs('LowShelf', 2000, 1.0, 5);
    this.c1_bpf.updateCoeffs('BPF', 3000, 1.0);
    this.c1_peak.updateCoeffs('Peak', 2400, 2.0, 5); // Q = 1/0.5
    this.c1_hpf.updateCoeffs('HPF', 1550, 1.42); // Q = 1/0.7
    this.c1_lpf.updateCoeffs('LPF', 3000, 0.707);

    this.c2_ls.updateCoeffs('LowShelf', 990, 0.5, -5); // Q = 1/2
    this.c2_bpf.updateCoeffs('BPF', 7400, 1.0);
    this.c2_peak.updateCoeffs('Peak', 7200, 2.0, 5);
    this.c2_hpf1.updateCoeffs('HPF', 6800, 1.42);
    this.c2_hpf2.updateCoeffs('HPF', 6800, 1.42);
    this.c2_hs.updateCoeffs('HighShelf', 10000, 1.0, -4);

    this.c3_ls.updateCoeffs('LowShelf', 990, 0.5, -15);
    this.c3_bpf.updateCoeffs('BPF', 6500, 1.0);
    this.c3_peak.updateCoeffs('Peak', 7400, 2.85, 10); // Q = 1/0.35
    this.c3_hpf1.updateCoeffs('HPF', 10500, 1.25); // Q = 1/0.8
    this.c3_hpf2.updateCoeffs('HPF', 10500, 1.25);

    this.master_lpf.updateCoeffs('LPF', 4000, 0.707);
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.phases.fill(0);

    // 全フィルター状態のリセット
    const filters = [
      this.c1_ls,
      this.c1_bpf,
      this.c1_peak,
      this.c1_hpf,
      this.c1_lpf,
      this.c2_ls,
      this.c2_bpf,
      this.c2_peak,
      this.c2_hpf1,
      this.c2_hpf2,
      this.c2_hs,
      this.c3_ls,
      this.c3_bpf,
      this.c3_peak,
      this.c3_hpf1,
      this.c3_hpf2,
      this.master_lpf,
    ];
    for (let f of filters) {
      f.x1 = f.x2 = f.y1 = f.y2 = 0;
    }
  }

  curveValue(elapsed, duration, y0, y1, curve) {
    if (elapsed <= 0) return y0;
    if (elapsed >= duration) return y1;
    const t = elapsed / duration;
    if (Math.abs(curve) < 0.001) return y0 + (y1 - y0) * t;
    return (
      y0 +
      ((y1 - y0) * (Math.exp(curve * t) - 1)) /
        (Math.exp(curve) - 1)
    );
  }

  process(inputs, outputs, parameters) {
    const channel = outputs[0]?.[0];
    if (!channel) return true;

    const amp = parameters.amp[0];
    const decay = parameters.decay[0];
    const tone = parameters.tone[0];
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

      const elapsed =
        blockStart + i / sampleRate - this.startTime;

      // 寿命: env2b が decay*20 まで伸びるため、それを最大値とする[cite: 1]
      const maxDuration = decay * 20 + 0.1;
      if (elapsed >= maxDuration) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // 1. エンベロープ群の計算
      let env1 =
        elapsed < 0.3
          ? this.curveValue(elapsed, 0.3, 0, 1, -3)
          : this.curveValue(elapsed - 0.3, decay, 1, 0, -3); //[cite: 1]
      let env2 =
        elapsed < 0.1
          ? this.curveValue(elapsed, 0.1, 0, 0.6, -5)
          : this.curveValue(
              elapsed - 0.1,
              decay * 0.7,
              0.6,
              0,
              -5,
            ); //[cite: 1]
      let env2b =
        elapsed < 0.1
          ? this.curveValue(elapsed, 0.1, 0, 0.3, -120)
          : this.curveValue(
              elapsed - 0.1,
              decay * 20,
              0.3,
              0,
              -120,
            ); //[cite: 1]
      let env3 = this.curveValue(
        elapsed,
        decay * 5,
        1,
        0,
        -150,
      ); //[cite: 1]

      // 2. 6つの矩形波[cite: 1]
      let oscSum = 0;
      for (let j = 0; j < 6; j++) {
        oscSum += (this.phases[j] < 0.5 ? 1 : 0) * 0.6;
        this.phases[j] =
          (this.phases[j] + this.freqs[j] / sampleRate) % 1;
      }

      // 3. フィルターチェイン 1
      let sig1 = this.c1_ls.process(oscSum);
      sig1 = this.c1_bpf.process(sig1);
      sig1 = this.c1_peak.process(sig1);
      sig1 = this.c1_hpf.process(sig1);
      sig1 = this.c1_lpf.process(sig1);
      sig1 = sig1 * env1 * tone;

      // 4. フィルターチェイン 2
      let sig2 = this.c2_ls.process(oscSum);
      sig2 = this.c2_bpf.process(sig2);
      sig2 = this.c2_peak.process(sig2);
      sig2 = this.c2_hpf1.process(sig2);
      sig2 = this.c2_hpf2.process(sig2);
      sig2 = this.c2_hs.process(sig2);
      let sig2a = sig2 * env2 * 0.3;
      let sig2b = sig2 * env2b * 0.6;

      // 5. フィルターチェイン 3
      let sig3 = this.c3_ls.process(oscSum);
      sig3 = this.c3_bpf.process(sig3);
      sig3 = this.c3_peak.process(sig3);
      sig3 = this.c3_hpf1.process(sig3);
      sig3 = this.c3_hpf2.process(sig3);
      sig3 = sig3 * env3 * 2; // BHiPass4のmulパラメータ相当分を乗算

      // 6. ミックスとマスターLPF
      let sum = sig1 + sig2a + sig2b + sig3; //[cite: 1]
      sum = this.master_lpf.process(sum); //[cite: 1]

      channel[i] = sum * amp; //[cite: 1]
    }

    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
    // arg decay=2, amp=20, pan=0, gate=0, tone=0.002;
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
        defaultValue: 2.0,
        minValue: 0.5,
        maxValue: 4.0,
        automationRate: 'k-rate',
      },
      {
        name: 'amp',
        defaultValue: 20.0,
        minValue: 5.0,
        maxValue: 22.0,
        automationRate: 'k-rate',
      },
      {
        name: 'tone',
        defaultValue: 0.002,
        minValue: 0.0002,
        maxValue: 0.005,
        automationRate: 'k-rate',
      },
    ];
  }
}
