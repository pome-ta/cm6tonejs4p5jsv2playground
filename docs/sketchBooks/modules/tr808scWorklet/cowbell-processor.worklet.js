export default class CowbellProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

    this.phase1 = 0; // LFPulse 811.16Hz
    this.phase2 = 0; // LFPulse 538.75Hz

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
        } else if (type === 'LPF') {
          this.b0 = (1 - Math.cos(w0)) / 2 / a0;
          this.b1 = (1 - Math.cos(w0)) / a0;
          this.b2 = (1 - Math.cos(w0)) / 2 / a0;
          this.a1 = (-2 * Math.cos(w0)) / a0;
          this.a2 = (1 - alpha) / a0;
        }
      },
    });

    this.hpf = this.createFilter();
    this.lpf = this.createFilter();

    // HPF.ar(sig, 250) / LPF.ar(sig, 4500)
    this.hpf.updateCoeffs('HPF', 250, 0.707);
    this.lpf.updateCoeffs('LPF', 4500, 0.707);
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.phase1 = 0;
    this.phase2 = 0;
    this.hpf.x1 = this.hpf.x2 = this.hpf.y1 = this.hpf.y2 = 0;
    this.lpf.x1 = this.lpf.x2 = this.lpf.y1 = this.lpf.y2 = 0;
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
      if (this._prevTrig === 0 && t > 0)
        this._reset(blockStart + i / sampleRate);
      this._prevTrig = t;

      if (!this.active) {
        channel[i] = 0;
        continue;
      }

      const elapsed = blockStart + i / sampleRate - this.startTime;

      // 寿命: 0.01 + 9.5 = 9.51s
      if (elapsed >= 9.51) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // atkenv = EnvGen.kr(Env.perc(0, 1, 1, -215))
      const atkenv = this.curveValue(elapsed, 1.0, 1.0, 0.0, -215);

      // env = EnvGen.kr(Env.perc(0.01, 9.5, 1, -90))
      let env = 0;
      if (elapsed <= 0.01) {
        env = elapsed / 0.01; // Linear attack approximation
      } else {
        env = this.curveValue(elapsed - 0.01, 9.5, 1.0, 0.0, -90);
      }

      const pul1 = this.phase1 < 0.5 ? 1 : 0;
      const pul2 = this.phase2 < 0.5 ? 1 : 0;
      const pulseSum = pul1 + pul2;

      const atk = pulseSum * atkenv * 6;
      const datk = pulseSum * env;

      let sig = (atk + datk) * amp;
      sig = this.hpf.process(sig);
      sig = this.lpf.process(sig);

      channel[i] = sig;

      this.phase1 = (this.phase1 + 811.16 / sampleRate) % 1;
      this.phase2 = (this.phase2 + 538.75 / sampleRate) % 1;
    }

    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
    // arg amp=1;
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
        defaultValue: 1.0,
        minValue: 0.05,
        maxValue: 1.0,  // 本来は`0.3`
        automationRate: 'k-rate',
      },
    ];
  }
}
