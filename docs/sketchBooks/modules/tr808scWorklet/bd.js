import * as Tone from 'tone';

const WORKLET_URL = new URL('./bd-processor.worklet.js', import.meta.url); // このファイル基準
const PROCESSOR_NAME = 'bd-processor';

export default class BD extends Tone.ToneAudioNode {
  constructor(options = {}) {
    super();
    this.name = 'BD';
    console.log('class DB');
    // デフォルト値とのマージ(Tone流の作法)
    const opts = Object.assign({ decay: 30, tone: 56, amp: 2 }, options);
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
    this.decay = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'time',
      swappable: true,
      value: opts.decay,
    });
    this.tone = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'frequency',
      swappable: true,
      value: opts.tone,
    });
    this.amp = new Tone.Param({
      context: this.context,
      param: this._dummyGain.gain,
      units: 'number',
      swappable: true,
      value: opts.amp,
    });

    this._worklet = null;
    this.context.addAudioWorkletModule(WORKLET_URL).then(() => {
      if (this.disposed) {
        return;
      }
      this._worklet = this.context.createAudioWorkletNode(PROCESSOR_NAME, {
        outputChannelCount: [2],
      });
      this._worklet.onprocessorerror = (e) => console.error(e);
      Tone.connect(this._worklet, this.envelope); // 永続接続
      ['trigger', 'decay', 'tone', 'amp'].forEach((name) => {
        const p = this._worklet.parameters.get(name);
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
    super.dispose(); // output(=envelope)はここで処理済み
    this._dummyGain.disconnect();
    this.trigger.dispose();
    this.decay.dispose(); // ← 追加
    this.tone.dispose(); // ← 追加
    this.amp.dispose(); // ← 追加
    if (this._worklet) {
      this._worklet.port.postMessage('dispose');
      this._worklet.disconnect();
    }
    return this;
  }
}
