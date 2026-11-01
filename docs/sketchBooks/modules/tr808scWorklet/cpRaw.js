import * as Tone from 'tone';
import { loadWorklet } from './workletLoader.js';

export default class CpRaw extends Tone.ToneAudioNode {
  name = 'CpRaw';
  #paramNames = ['trigger', 'amp'];
  input = undefined;
  onprocessorerror = (e) => console.error(e);

  static getDefaults() {
    // arg amp=1, gate=0;
    return Object.assign(Tone.ToneAudioNode.getDefaults(), {
      amp: 1.0,

      workletOptions: { outputChannelCount: [2] },
    });
  }

  constructor(options) {
    const opts = Object.assign(CpRaw.getDefaults(), options);
    super(opts);

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

    const processorName = `${[...this.name]
      .map((c, i) => (i ? c : c.toLowerCase()))
      .join('')}-processor`;

    loadWorklet(this.context)
      .then(() => {
        if (this.disposed) {
          return; // ToneAudioWorklet と同じガード
        }

        this._worklet = new AudioWorkletNode(
          this.context.rawContext, // Tone 経由ではなく raw の context
          processorName,
          opts.workletOptions,
        );

        this._worklet.onprocessorerror = (e) =>
          this.onprocessorerror(e.message);

        this.onReady(this._worklet);
      })
      .catch((e) =>
        console.error(`${processorName} setup failed`, e),
      );
  }

  onReady(node) {
    Tone.connect(node, this.output); // ソース → output Gain
    this.#paramNames.forEach((n) => {
      const p = node.parameters.get(n);
      if (p) {
        this[n].setParam(p);
      }
    });
  }

  triggerAttack(time, velocity = 1) {
    const PULSE_WIDTH = 3 / this.context.sampleRate;
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
    this.#paramNames.forEach((n) => this[n].dispose());
    if (this._worklet) {
      this._worklet.port.postMessage('dispose');
      this._worklet.disconnect();
    }
    return this;
  }
}
