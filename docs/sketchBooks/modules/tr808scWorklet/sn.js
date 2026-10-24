import * as Tone from 'tone';
import { loadWorklet } from './workletLoader.js';

export default class Sn extends Tone.ToneAudioNode {
  constructor(options = {}) {
    // arg amp=2, tone=340, tone2=189, snappy=0.3, gate=0, amp2=1;
    const opts = Object.assign(
      { amp: 2.0, tone: 340.0, tone2: 189.0, snappy: 0.3, amp2: 1.0 },
      options,
    );
    super({ context: opts.context ?? Tone.getContext() });

    this.name = 'Sn';

    this.input = undefined;
    this.envelope = new Tone.AmplitudeEnvelope({
      context: this.context,
      attack: 0.0,
      decay: 0.0,
      sustain: 1.0,
      release: 0.0,
    });
    this.output = this.envelope;

    this._dummyGain = this.context.createGain();

    // options の値を Param の初期 value に渡す
    this.trigger = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'normalRange',
      swappable: true,
      value: 0,
    });
    this.amp = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'number',
      swappable: true,
      value: opts.amp,
    });

    this.tone = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'frequency',
      swappable: true,
      value: opts.tone,
    });
    this.tone2 = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'frequency',
      swappable: true,
      value: opts.tone2,
    });
    this.snappy = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'number',
      swappable: true,
      value: opts.snappy,
    });
    this.amp2 = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'number',
      swappable: true,
      value: opts.amp2,
    });

    this._worklet = null;
    const processorName = `${[...this.name].map((c, i) => (i ? c : c.toLowerCase())).join('')}-processor`;
    loadWorklet(this.context)
      .then(() => {
        this._worklet = this.context.createAudioWorkletNode(processorName, {
          outputChannelCount: [2],
        });
        this._worklet.onprocessorerror = (e) => console.error(e);
        Tone.connect(this._worklet, this.envelope); // 永続接続
        ['trigger', 'amp', 'tone', 'tone2', 'snappy', 'amp2'].forEach(
          (name) => {
            const p = this._worklet.parameters.get(name);
            if (p) {
              this[name].setParam(p);
            }
          },
        );
      })
      .catch((e) => console.error(`${processorName} load failed`, e));
  }

  triggerAttack(time, velocity = 1) {
    const PULSE_WIDTH = 4 / this.context.sampleRate;
    const t = this.toSeconds(time);

    this.trigger.cancelScheduledValues(t);
    this.trigger.setValueAtTime(0, t);
    this.trigger.setValueAtTime(1, t);
    // this.trigger.setValueAtTime(0, t + 1 / this.context.sampleRate);
    this.trigger.setValueAtTime(0, t + PULSE_WIDTH);
    this.envelope.triggerAttack(t, velocity);
    return this;
  }

  triggerRelease(time) {
    this.envelope.triggerRelease(this.toSeconds(time));
    return this;
  }

  triggerAttackRelease(duration, time, velocity) {
    const t = this.toSeconds(time);
    this.triggerAttack(t, velocity);
    this.triggerRelease(t + this.toSeconds(duration));
    return this;
  }

  dispose() {
    super.dispose();
    this._dummyGain.disconnect();
    this.trigger.dispose();
    this.amp.dispose();
    this.tone.dispose();
    this.tone2.dispose();
    this.snappy.dispose();
    this.amp2.dispose();

    if (this._worklet) {
      this._worklet.port.postMessage('dispose');
      this._worklet.disconnect();
    }
    return this;
  }
}
