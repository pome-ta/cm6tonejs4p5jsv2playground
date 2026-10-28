class CongasProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;
    this.phase = Math.PI / 2;

    const p = options.processorOptions || {};
    this.type = p.type || 'LC';

    this.settings = {
      LC: { decay: 18, p1: 1.333333, p2: 1.121212, gain: 3 },
      MC: { decay: 9, p1: 1.24, p2: 1.12, gain: 2 },
      HC: { decay: 6, p1: 1.22972, p2: 1.08108, gain: 2 },
    };
    if (!this.settings[this.type]) this.type = 'LC';
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

      const elapsed =
        blockStart + i / sampleRate - this.startTime;
      if (elapsed >= conf.decay) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // SC: Env.new([0.15, 1, 0], [0, 18], -250)[cite: 1]
      const env = this.curveValue(
        elapsed,
        conf.decay,
        1.0,
        0.0,
        -250,
      );

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
        fenv = this.curveValue(
          elapsed - 0.1,
          0.5,
          freq * conf.p2,
          freq,
          -4,
        );
      }

      channel[i] = Math.sin(this.phase) * env * amp * conf.gain;
      this.phase =
        (this.phase + (2 * Math.PI * fenv) / sampleRate) %
        (Math.PI * 2);
    }
    if (outputs[0][1]) outputs[0][1].set(channel);
    return true;
  }

  static get parameterDescriptors() {
    // LC: arg amp=1, freq=165;
    // MC: arg amp=1, freq=250;
    // HC: arg amp=1, freq=370;
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
        maxValue: 444.0,
        automationRate: 'k-rate',
      },
    ];
  }
}

export class LcProcessor extends CongasProcessor {
  constructor(options) {
    super({
      ...options,
      processorOptions: {
        ...options?.processorOptions,
        type: 'LC',
      },
    });
  }

  static get parameterDescriptors() {
    // LC: arg amp=1, freq=165;
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
        maxValue: 189.75,
        automationRate: 'k-rate',
      },
    ];
  }
}

export class McProcessor extends CongasProcessor {
  constructor(options) {
    super({
      ...options,
      processorOptions: {
        ...options?.processorOptions,
        type: 'MC',
      },
    });
  }

  static get parameterDescriptors() {
    // MC: arg amp=1, freq=250;
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
        defaultValue: 250.0,
        minValue: 175.0,
        maxValue: 275.0,
        automationRate: 'k-rate',
      },
    ];
  }
}

export class HcProcessor extends CongasProcessor {
  constructor(options) {
    super({
      ...options,
      processorOptions: {
        ...options?.processorOptions,
        type: 'HC',
      },
    });
  }

  static get parameterDescriptors() {
    // HC: arg amp=1, freq=370;
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
        defaultValue: 370.0,
        minValue: 259.0,
        maxValue: 444.0,
        automationRate: 'k-rate',
      },
    ];
  }
}
