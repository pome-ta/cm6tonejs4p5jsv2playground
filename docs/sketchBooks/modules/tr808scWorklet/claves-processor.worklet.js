export default class ClavesProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;
    this.phase = Math.PI / 2;
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    // SCの SinOsc.ar(2500, pi/2) に合わせてアタックの位相を初期化[cite: 1]
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

    // パラメータはSCの実装に準拠し amp のみ公開[cite: 1]
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

      // SC: Env.new([1, 1, 0], [0, 0.1], -20)[cite: 1]
      // 寿命は0.1秒固定
      if (elapsed >= 0.1) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      const env = this.curveValue(elapsed, 0.1, 1.0, 0.0, -20);

      channel[i] = Math.sin(this.phase) * env * amp;

      // 2500Hz固定のサイン波[cite: 1]
      this.phase =
        (this.phase + (2 * Math.PI * 2500) / sampleRate) % (Math.PI * 2);
    }

    if (outputs[0][1]) {
      outputs[0][1].set(channel);
    }
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
        defaultValue: 1,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
    ];
  }
}
