export default class RimshotProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

    // 三角波と矩形波の位相
    this.triPhase = Math.PI / 2; // SCの LFTri(..., 1) は頂点から開始[cite: 1]
    this.pulsePhase = 0;

    // 汎用Biquadフィルター生成ヘルパー
    this.createFilter = () => ({
      b0: 1, b1: 0, b2: 0, a1: 0, a2: 0,
      x1: 0, x2: 0, y1: 0, y2: 0,
      process: function(input) {
        const out = this.b0 * input + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1; this.x1 = input;
        this.y2 = this.y1; this.y1 = out;
        return out;
      },
      updateCoeffs: function(type, freq, q, db = 0) {
        const w0 = (2 * Math.PI * freq) / sampleRate;
        const alpha = Math.sin(w0) / (2 * q);
        const a0 = 1 + alpha;
        if (type === 'Peak') {
          const A = Math.pow(10, db / 40);
          const a0_eq = 1 + alpha / A;
          this.b0 = (1 + alpha * A) / a0_eq; this.b1 = (-2 * Math.cos(w0)) / a0_eq; this.b2 = (1 - alpha * A) / a0_eq;
          this.a1 = (-2 * Math.cos(w0)) / a0_eq; this.a2 = (1 - alpha / A) / a0_eq;
        } else if (type === 'HPF') {
          this.b0 = ((1 + Math.cos(w0)) / 2) / a0; this.b1 = -(1 + Math.cos(w0)) / a0; this.b2 = ((1 + Math.cos(w0)) / 2) / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0; this.a2 = (1 - alpha) / a0;
        } else if (type === 'LPF') {
          this.b0 = ((1 - Math.cos(w0)) / 2) / a0; this.b1 = (1 - Math.cos(w0)) / a0; this.b2 = ((1 - Math.cos(w0)) / 2) / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0; this.a2 = (1 - alpha) / a0;
        }
      }
    });

    this.peak = this.createFilter();
    this.hpf = this.createFilter();
    this.lpf = this.createFilter();

    // フィルターの初期化
    // BPeakEQ.ar(sig, 464, 0.44, 8) -> Q = 1/0.44[cite: 1]
    this.peak.updateCoeffs('Peak', 464, 2.27, 8);
    // HPF.ar(sig, 315) / LPF.ar(sig, 7300)[cite: 1]
    this.hpf.updateCoeffs('HPF', 315, 0.707);
    this.lpf.updateCoeffs('LPF', 7300, 0.707);
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.triPhase = Math.PI / 2;
    this.pulsePhase = 0;
   
    // フィルター状態のリセット
    const clearState = (f) => { f.x1 = f.x2 = f.y1 = f.y2 = 0; };
    clearState(this.peak);
    clearState(this.hpf);
    clearState(this.lpf);
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
        channel[i] = 0; continue;
      }

      const elapsed = (blockStart + i / sampleRate) - this.startTime;

      // 寿命: 0.00272(hold) + 0.07(decay) = 0.07272s[cite: 1]
      if (elapsed >= 0.07272) {
        this.active = false; channel[i] = 0; continue;
      }

      // Env.new([1, 1, 0], [0.00272, 0.07], -42)[cite: 1]
      let env = 1.0;
      if (elapsed > 0.00272) {
        env = this.curveValue(elapsed - 0.00272, 0.07, 1.0, 0.0, -42);
      }

      // オシレーター群の生成
      // tri1 = LFTri.ar(1667 * 1.1)[cite: 1] = 1833.7 Hz
      const tri1 = (2 / Math.PI) * Math.asin(Math.sin(this.triPhase)) * env;
     
      // tri2 = LFPulse.ar(455 * 1.1, width:0.8)[cite: 1] = 500.5 Hz
      const tri2 = (this.pulsePhase < 0.8 ? 1 : 0) * env;
     
      // punch = WhiteNoise * 0.46[cite: 1]
      const punch = (Math.random() * 2 - 1) * env * 0.46;

      // ミックスとフィルター処理
      let sig = tri1 + tri2 + punch; //[cite: 1]
      sig = this.peak.process(sig);  //[cite: 1]
      sig = this.hpf.process(sig);   //[cite: 1]
      sig = this.lpf.process(sig);   //[cite: 1]

      channel[i] = sig * amp;        //[cite: 1]

      // 位相の更新
      this.triPhase = (this.triPhase + (2 * Math.PI * 1833.7) / sampleRate) % (Math.PI * 2);
      this.pulsePhase = (this.pulsePhase + 500.5 / sampleRate) % 1;
    }

    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
    return [
      { name: 'trigger', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'amp', defaultValue: 1, minValue: 0, maxValue: 10, automationRate: 'k-rate' }
    ];
  }
}
