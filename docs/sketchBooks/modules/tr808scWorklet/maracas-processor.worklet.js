export default class MaracasProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

    this.hpf = {
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
    };

    // HPF.ar(sig, 5500)
    const w0 = (2 * Math.PI * 5500) / sampleRate;
    const alpha = Math.sin(w0) / Math.SQRT2;
    const a0 = 1 + alpha;
    this.hpf.b0 = (1 + Math.cos(w0)) / 2 / a0;
    this.hpf.b1 = -(1 + Math.cos(w0)) / a0;
    this.hpf.b2 = (1 + Math.cos(w0)) / 2 / a0;
    this.hpf.a1 = (-2 * Math.cos(w0)) / a0;
    this.hpf.a2 = (1 - alpha) / a0;
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.hpf.x1 = this.hpf.x2 = this.hpf.y1 = this.hpf.y2 = 0;
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

      // 寿命: 0.027 + 0.07 = 0.097s
      if (elapsed >= 0.097) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // Env.new([0.3, 1, 0], [0.027, 0.07], -250)
      let env = 0;
      if (elapsed <= 0.027) {
        env = this.curveValue(elapsed, 0.027, 0.3, 1.0, -250);
      } else {
        env = this.curveValue(elapsed - 0.027, 0.07, 1.0, 0.0, -250);
      }

      let sig = (Math.random() * 2 - 1) * env;
      sig = this.hpf.process(sig);

      channel[i] = sig * amp;
    }

    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
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
        defaultValue: 1,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
    ];
  }
}
