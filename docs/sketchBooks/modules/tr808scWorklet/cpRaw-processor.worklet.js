export default class CpRawProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

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
        const out = this.b0 * input + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1;
        this.x1 = input;
        this.y2 = this.y1;
        this.y1 = out;
        return out;
      },
      updateCoeffs: function (type, freq, q) {
        const w0 = (2 * Math.PI * freq) / sampleRate;
        const alpha = Math.sin(w0) / (2 * q);
        const a0 = 1 + alpha;
        if (type === 'HPF') {
          this.b0 = (1 + Math.cos(w0)) / 2 / a0;
          this.b1 = -(1 + Math.cos(w0)) / a0;
          this.b2 = (1 + Math.cos(w0)) / 2 / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0;
          this.a2 = (1 - alpha) / a0;
        } else if (type === 'BPF') {
          this.b0 = alpha / a0;
          this.b1 = 0;
          this.b2 = -alpha / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0;
          this.a2 = (1 - alpha) / a0;
        }
      },
    });

    this.hpf = this.createFilter();
    this.bpf = this.createFilter();

    // HPF.ar(sum, 500) / BPF.ar(sum, 1062, 0.5)[cite: 1]
    this.hpf.updateCoeffs('HPF', 500, 0.707);
    this.bpf.updateCoeffs('BPF', 1062, 2.0); // rq=0.5 -> Q=2.0
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.hpf.x1 = this.hpf.x2 = this.hpf.y1 = this.hpf.y2 = 0;
    this.bpf.x1 = this.bpf.x2 = this.bpf.y1 = this.bpf.y2 = 0;
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
        channel[i] = 0;
        continue;
      }

      const elapsed = blockStart + i / sampleRate - this.startTime;

      // 寿命は decay=6s が最大[cite: 1]
      if (elapsed >= 6.0) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // atkenv: Env.new([0.5,1,0],[0, 0.3], -160)[cite: 1] -> 0秒で1になり、0.3秒で減衰
      const atkenv = this.curveValue(elapsed, 0.3, 1.0, 0.0, -160);

      // denv: Env.dadsr(0.026, 0, 6, ...)[cite: 1] -> 0.026秒の遅延後、6秒かけて減衰
      let denv = 0;
      if (elapsed > 0.026) {
        denv = this.curveValue(elapsed - 0.026, 6.0, 1.0, 0.0, -157);
      }

      const noise = Math.random() * 2 - 1;
      const atk = noise * atkenv * 1.4; //[cite: 1]
      const decay = noise * denv; //[cite: 1]

      // SCは左から右へ計算されるため sum = (atk + decay) * amp[cite: 1]
      let sum = (atk + decay) * amp;

      sum = this.hpf.process(sum); //[cite: 1]
      sum = this.bpf.process(sum); //[cite: 1]

      channel[i] = sum * 1.5; //[cite: 1]
    }

    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
    // arg amp=1, gate=0;
    return [
      { name: 'trigger', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'amp', defaultValue: 1, minValue: 0, maxValue: 10, automationRate: 'k-rate' },
    ];
  }
}
