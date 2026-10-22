import * as Tone from 'tone';

const WORKLET_URL = new URL('./sn-processor.worklet.js', import.meta.url);
const PROCESSOR_NAME = 'sn-processor';

export default class Sn extends Tone.ToneAudioNode {
  constructor(options = {}) {
    super();
    this.name = 'Sn';
    // デフォルト値とのマージ(Tone流の作法)
    // amp=2, tone=340, tone2=189, snappy=0.3, gate=0, amp2=1;
    const opts = Object.assign({ amp: 2, tone: 340, tone2: 189, snappy: 0.3, amp2: 1 }, options);
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

    this._snWorklet = null;
    this.context.addAudioWorkletModule(WORKLET_URL).then(() => {
      if (this.disposed) {
        return;
      }
      this._snWorklet = this.context.createAudioWorkletNode(PROCESSOR_NAME, {
        outputChannelCount: [2],
      });
      this._snWorklet.onprocessorerror = (e) => console.error(e);
      Tone.connect(this._snWorklet, this.envelope); // 永続接続
      ['trigger', 'amp', 'tone', 'tone2', 'snappy', 'amp2'].forEach((name) => {
        const p = this._snWorklet.parameters.get(name);
        if (p) {
          this[name].setParam(p);
        }
      });
    });
  }

  triggerAttack(time, velocity = 1) {
    const t = this.toSeconds(time);
    this.trigger.cancelScheduledValues(t);
    this.trigger.setValueAtTime(0, t);
    this.trigger.setValueAtTime(1, t);
    this.trigger.setValueAtTime(0, t + 1 / this.context.sampleRate);
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
    super.dispose(); // output(=envelope)はここで処理済み
    this._dummyGain.disconnect();
    this.trigger.dispose();
    this.amp.dispose();
    this.tone.dispose();
    this.tone2.dispose();
    this.snappy.dispose();
    this.amp2.dispose();

    if (this._snWorklet) {
      this._snWorklet.port.postMessage('dispose');
      this._snWorklet.disconnect();
    }
    return this;
  }
}
