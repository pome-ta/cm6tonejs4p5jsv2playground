class TomsProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;
    this.phase = Math.PI / 2;

    const p = options.processorOptions || {};
    this.type = p.type || 'LT';

    this.settings = {
      LT: { decay: 20, p1: 1.25, p2: 1.125, gain: 3 },
      MT: { decay: 16, p1: 1.33333, p2: 1.125, gain: 2 },
      HT: { decay: 11, p1: 1.333333, p2: 1.121212, gain: 2 },
    };
    if (!this.settings[this.type]) this.type = 'LT';
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.phase = Math.PI / 2;
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
    const freq = parameters.freq[0];
    const trig = parameters.trigger;
    const blockStart = currentTime;
    const conf = this.settings[this.type];

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
      if (elapsed >= conf.decay) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // SC: Env.new([0.4, 1, 0], [0, 20], -250)[cite: 1]
      const env = this.curveValue(elapsed, conf.decay, 1.0, 0.0, -250);

      let fenv = freq;
      if (elapsed <= 0.1) {
        fenv = this.curveValue(
          elapsed,
          0.1,
          freq * conf.p1,
          freq * conf.p2,
          -4,
        );
      } else if (elapsed <= 0.6) {
        fenv = this.curveValue(elapsed - 0.1, 0.5, freq * conf.p2, freq, -4);
      }

      channel[i] = Math.sin(this.phase) * env * amp * conf.gain;
      this.phase =
        (this.phase + (2 * Math.PI * fenv) / sampleRate) % (Math.PI * 2);
    }
    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
    // LT: arg amp=1, freq=80;
    // MT: arg amp, freq=120;
    // HT: arg amp, freq=165;
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
        minValue: 0.1,
        maxValue: 1.5,
        automationRate: 'k-rate',
      },
      {
        name: 'freq',
        defaultValue: 80.0,
        minValue: 72.0,
        maxValue: 198.0,
        automationRate: 'k-rate',
      },
    ];
  }
}

export class LtProcessor extends TomsProcessor {
  constructor(options) {
    super({
      ...options,
      processorOptions: {
        ...options?.processorOptions,
        type: 'LT',
      },
    });
  }

  static get parameterDescriptors() {
    // LT: arg amp=1, freq=80;
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
        minValue: 0.1,
        maxValue: 1.5,
        automationRate: 'k-rate',
      },
      {
        name: 'freq',
        defaultValue: 80.0,
        minValue: 72.0,
        maxValue: 100.0,
        automationRate: 'k-rate',
      },
    ];
  }
}

export class MtProcessor extends TomsProcessor {
  constructor(options) {
    super({
      ...options,
      processorOptions: {
        ...options?.processorOptions,
        type: 'MT',
      },
    });
  }

  static get parameterDescriptors() {
    // MT: arg amp, freq=120;
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
        minValue: 0.1,
        maxValue: 1.5,
        automationRate: 'k-rate',
      },
      {
        name: 'freq',
        defaultValue: 120.0,
        minValue: 78.0,
        maxValue: 132.0,
        automationRate: 'k-rate',
      },
    ];
  }
}

export class HtProcessor extends TomsProcessor {
  constructor(options) {
    super({
      ...options,
      processorOptions: {
        ...options?.processorOptions,
        type: 'HT',
      },
    });
  }

  static get parameterDescriptors() {
    // HT: arg amp, freq=165;
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
        minValue: 0.1,
        maxValue: 1.5,
        automationRate: 'k-rate',
      },
      {
        name: 'freq',
        defaultValue: 165.0,
        minValue: 115.5,
        maxValue: 198.0,
        automationRate: 'k-rate',
      },
    ];
  }
}
