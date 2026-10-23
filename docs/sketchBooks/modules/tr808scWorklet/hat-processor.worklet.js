export default class HatProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.active = false;
    this.startTime = 0;
    this._prevTrig = 0;

    // 6つの矩形波の周波数と位相アキュムレータ
    this.freqs = [203.52, 366.31, 301.77, 518.19, 811.16, 538.75];
    this.phases = new Array(6).fill(0);

    // 汎用Biquadフィルターの生成ファクトリ
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
        if (type === 'BPF') {
          // Constant 0dB peak
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
        } else if (type === 'Peak') {
          const A = Math.pow(10, db / 40);
          const a0_eq = 1 + alpha / A;
          this.b0 = (1 + alpha * A) / a0_eq;
          this.b1 = (-2 * Math.cos(w0)) / a0_eq;
          this.b2 = (1 - alpha * A) / a0_eq;
          this.a1 = (-2 * Math.cos(w0)) / a0_eq;
          this.a2 = (1 - alpha / A) / a0_eq;
        }
      },
    });

    this.hpf_sighi = this.createFilter();
    this.bpf_sighi = this.createFilter();
    this.hpf_siglow = this.createFilter();
    this.bpf_siglow = this.createFilter();
    this.peak_eq = this.createFilter();

    // 係数の初期化 (SCコードのパラメータ: RQはQの逆数)
    this.bpf_sighi.updateCoeffs('BPF', 8900, 1.0); // BPF.ar(8900, 1)
    this.hpf_sighi.updateCoeffs('HPF', 9000, 0.707); // HPF.ar(9000)
    this.bpf_siglow.updateCoeffs('BPF', 8900, 1.25); // BBandPass.ar(8900, bw=0.8) -> Q≒1.25
    this.hpf_siglow.updateCoeffs('HPF', 9000, 3.33); // BHiPass.ar(9000, rq=0.3) -> Q=3.33
    this.peak_eq.updateCoeffs('Peak', 9700, 1.25, 0.7); // BPeakEQ.ar(9700, rq=0.8, db=0.7)
  }

  _reset(sampleTime) {
    this.active = true;
    this.startTime = sampleTime;
    this.phases.fill(0);
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
      if (elapsed >= decay) {
        this.active = false;
        channel[i] = 0;
        continue;
      }

      // 1. エンベロープ Env.perc(0.005, decay, 1, -30)
      let env = 0;
      if (elapsed < 0.005) {
        env = this.curveValue(elapsed, 0.005, 0, 1, -30);
      } else {
        env = this.curveValue(elapsed - 0.005, decay, 1, 0, -30);
      }

      // 2. 6つの矩形波 (LFPulse は 0 or 1)
      let oscSum = 0;
      for (let j = 0; j < 6; j++) {
        oscSum += this.phases[j] < 0.5 ? 1 : 0;
        this.phases[j] = (this.phases[j] + this.freqs[j] / sampleRate) % 1;
      }

      // 3. フィルターチェイン
      let sighi = this.bpf_sighi.process(oscSum);
      sighi = this.hpf_sighi.process(sighi);

      let siglow = this.bpf_siglow.process(oscSum);
      siglow = this.hpf_siglow.process(siglow);

      let sig = this.peak_eq.process(siglow + sighi);

      // 4. ミックス
      channel[i] = sig * env * amp;
    }

    if (outputs[0][1]) {
      outputs[0][1].set(channel);
    }
    return true;
  }

  static get parameterDescriptors() {
    // arg decay=0.42, amp=1, pan=0;
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
        defaultValue: 0.42,
        minValue: 0.01,
        maxValue: 5,
        automationRate: 'k-rate',
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
