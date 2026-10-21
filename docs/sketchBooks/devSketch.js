// --- # example: 808 ?
import * as Tone from 'tone';
import { BD } from 'modules/tr808scWorklet/drumKit.js';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 125;

const ftRand = (bias, spread = 1.0) => {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
};

const expCurve = (start, end, curve, steps) => {
  const envelope = (_start, _end, _progress, _curve) => {
    if (_curve === 0) {
      return _start + (_end - _start) * _progress;
    }
    const _exp = Math.exp(_curve * _progress);
    const _curveRatio = (_exp - 1) / (Math.exp(_curve) - 1);
    return _start + (_end - _start) * _curveRatio;
  };
  const levels = Array.from({ length: steps + 1 }, (_, i) =>
    envelope(start, end, i / steps, curve),
  );

  return levels;
};

const frqCurve = (
  startfrequency,
  endfrequency,
  curveExponent = 0,
  divSteps = 128,
) => {
  const curve = expCurve(startfrequency, endfrequency, curveExponent, divSteps);
  return curve;
};

const volCurve = (
  startGain,
  curveExponent = 1,
  endGain = 0,
  divSteps = 256,
) => {
  const gainCurve = expCurve(startGain, endGain, curveExponent, divSteps);
  return gainCurve.map((gain) => Tone.gainToDb(gain));
};

const scParams = (levels, times, curve) => ({ levels, times, curve });

const processorSource = `
class BDProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const p = options.processorOptions || {};
    this.startTime = Number(p.startTime) || 0;
    this.decay = Number(p.decay) || 30;
    this.tone = Number(p.tone) || 56;
    this.amp = Number(p.amp) || 2;

    this.silentSamples = 0;

    this.stopTime = this.startTime + this.decay;

    // sig, sub用の位相と、punch用の位相
    // this.phase = Math.PI / 2;
    // this.punchPhase = Math.PI / 2;
    this.phase = (3 * Math.PI) / 2;
    this.punchPhase = (3 * Math.PI) / 2;

    // HPF (350Hz) の係数事前計算
    const w0 = (2 * Math.PI * 350) / sampleRate;
    const alpha = Math.sin(w0) / Math.SQRT2;
    const a0 = 1 + alpha;

    this.hpf_b0 = (1 + Math.cos(w0)) / 2 / a0;
    this.hpf_b1 = -(1 + Math.cos(w0)) / a0;
    this.hpf_b2 = (1 + Math.cos(w0)) / 2 / a0;
    this.hpf_a1 = (-2 * Math.cos(w0)) / a0;
    this.hpf_a2 = (1 - alpha) / a0;

    // HPF用の状態変数
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  curveValue(elapsed, duration, y0, y1, curve) {
    if (elapsed <= 0) return y0;
    if (elapsed >= duration) return y1;
    const t = elapsed / duration;
    if (Math.abs(curve) < 0.001) return y0 + (y1 - y0) * t;
    return y0 + ((y1 - y0) * (Math.exp(curve * t) - 1)) / (Math.exp(curve) - 1);
  }

  process(inputs, outputs) {
    const channel = outputs[0]?.[0];
    if (!channel) return true;

    const blockStart = currentTime;

    if (blockStart >= this.stopTime) {
      return false;
    }

    for (let i = 0; i < channel.length; i++) {
      const sampleTime = blockStart + i / sampleRate;

      if (sampleTime < this.startTime || sampleTime >= this.stopTime) {
        channel[i] = 0;
        continue;
      }

      const elapsed = sampleTime - this.startTime;

      // 1. ボリュームエンベロープ
      const env = this.curveValue(elapsed, this.decay, 1.0, 0.0, -225);
      const trienv = this.curveValue(elapsed, this.decay, 0.6, 0.0, -230);

      // 2. ピッチエンベロープ (sig, sub用)
      let fenv = this.tone;
      if (elapsed <= 0.05) {
        fenv = this.curveValue(
          elapsed,
          0.05,
          this.tone * 7,
          this.tone * 1.35,
          -14,
        );
      } else if (elapsed <= 0.05 + 0.6) {
        fenv = this.curveValue(
          elapsed - 0.05,
          0.6,
          this.tone * 1.35,
          this.tone,
          -14,
        );
      }

      // 3. ピッチエンベロープ (punch用)
      let pfenv = this.tone;
      if (elapsed <= 0.03) {
        pfenv = this.curveValue(
          elapsed,
          0.03,
          this.tone * 7,
          this.tone * 1.35,
          -10,
        );
      } else if (elapsed <= 0.03 + 0.6) {
        pfenv = this.curveValue(
          elapsed - 0.03,
          0.6,
          this.tone * 1.35,
          this.tone,
          -10,
        );
      }

      // 4. オシレーターの計算
      const sig = Math.sin(this.phase) * env;
      const sub =
        (2 / Math.PI) * Math.asin(Math.sin(this.phase)) * trienv * 0.05;

      // punch (サイン波を生成してHPFに通す)
      const punchOsc = Math.sin(this.punchPhase) * env * 2;
      const punch =
        this.hpf_b0 * punchOsc +
        this.hpf_b1 * this.x1 +
        this.hpf_b2 * this.x2 -
        this.hpf_a1 * this.y1 -
        this.hpf_a2 * this.y2;

      this.x2 = this.x1;
      this.x1 = punchOsc;
      this.y2 = this.y1;
      this.y1 = punch;

      // 5. ミックス (リミッターなし、単純加算のみ)
      // const mixed = (sig) * 2.5;
      // const mixed = (sub) * 2.5;
      // const mixed = (punch) * 2.5;
      // const mixed = (sub + punch) * 2.5;
      const mixed = (sig + sub + punch) * 2.5;

      // 【パターン1】リミッターなし(単純加算そのまま)
      // let limited = mixed;

      // 【パターン2】ハードクリップ(-0.5〜0.5を超えた分をバッサリ切り捨てる)
      // let limited = Math.max(-0.5, Math.min(0.5, mixed));

      // 【パターン3】ソフトクリッパー(Math.tanhを使って滑らかに0.5に抑え込む)
      let limited = Math.tanh(mixed * 2.0) * 0.5;

      channel[i] = limited * this.amp;

      // 6. 位相の更新
      this.phase =
        (this.phase + (2 * Math.PI * fenv) / sampleRate) % (Math.PI * 2);
      this.punchPhase =
        (this.punchPhase + (2 * Math.PI * pfenv) / sampleRate) % (Math.PI * 2);

      if (env < 1e-5) {
        // -80dB 相当
        this.silentSamples++;
      } else {
        this.silentSamples = 0;
      }
    }

    if (outputs[0][1]) {
      outputs[0][1].set(channel);
    }

    if (this.silentSamples >= channel.length) {
      this.port.postMessage('ended');
      return false;
    }
    return true;
  }
}

registerProcessor('bd-processor', BDProcessor);
`;

export class MyDrum extends Tone.ToneAudioNode {
  constructor(
    workletUrl,
    processorName,
    { decay = 30, tone = 56, amp = 2 } = {},
  ) {
    super();
    this.name = 'MyDrum';
    this.input = undefined;
    this.envelope = new Tone.AmplitudeEnvelope({
      context: this.context,
      attack: 0.001,
      decay: 0.2,
      sustain: 0,
      release: 0.1,
    });
    this.output = this.envelope;

    this._processorName = processorName;
    this._decay = decay;
    this._tone = tone;
    this._amp = amp;

    this._ready = false;
    this._activeNodes = new Set(); // 鳴っているノードの管理

    this.context.addAudioWorkletModule(workletUrl).then(() => {
      if (this.disposed) return;
      this._ready = true;
    });
  }

  triggerAttack(time, velocity = 1) {
    if (!this._ready) return this;
    const t = this.toSeconds(time);

    // トリガー毎にワンショットノードを生成(Sampler 方式)
    const node = this.context.createAudioWorkletNode(this._processorName, {
      outputChannelCount: [2],
      processorOptions: {
        startTime: t,
        decay: this._decay,
        tone: this._tone,
        amp: this._amp * velocity, // velocity は amp に畳み込む
      },
    });
    // node.connect(this.envelope.input ?? this.envelope);
    Tone.connect(node, this.envelope);
    this._activeNodes.add(node);

    // worklet が 'ended' を postMessage したら切断して回収
    node.port.onmessage = (e) => {
      if (e.data === 'ended') {
        node.disconnect();
        this._activeNodes.delete(node);
      }
    };

    this.envelope.triggerAttack(t, 1);
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
    this._activeNodes.forEach((n) => {
      n.port.postMessage('dispose');
      n.disconnect();
    });
    this._activeNodes.clear();
    return this;
  }
}

async function renderToBuffer() {
  const blobUrl = URL.createObjectURL(
    new Blob([processorSource], { type: 'application/javascript' }),
  );
  const amp = 2;
  const decay = 30;
  const tone = 56;

  const toneBuffer = await Tone.Offline(
    async (context) => {
      // callback は await されるので、ここで worklet をロードすれば
      // render() → workletsAreReady() が完了を保証する
      await context.addAudioWorkletModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      console.log(context.now());

      const node = context.createAudioWorkletNode('bd-processor', {
        // numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          startTime: context.currentTime,
          decay: decay,
          tone: tone,
          amp: amp,
        },
      });
      // node.toDestination()
      Tone.fanIn(node, Tone.getDestination());

      // // const input = new Tone.Gain();
      // const output = new Tone.Gain();
      // // input.connect(node);
      // node.connect(Tone.getDestination());

      // output.connect(Tone.getDestination());
    },
    decay + 5,
    2,
    Tone.getContext().sampleRate,
  );

  return toneBuffer;
  //smplr.add('A4', toneBuffer);
}

// const ki2buff = await renderToBuffer();

const sketch = (p) => {
  // --- Tone.js
  const ctx = p.getAudioContext();
  Tone.setContext(ctx, true);
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });
  const transport = Tone.getTransport();
  transport.bpm.value = BPM;

  const emitter = new Tone.Emitter();

  const kickVol2 = new Tone.Volume();
  // const kickSampler2 = new Tone.Sampler({
  //   attack: 0.0,
  //   release: '2i',
  //   curve: 'exponential',
  // }).chain(
  //   ...[
  //     //
  //   ].filter((n) => n),
  //   kickVol2,
  // );
  // const kickNote2 = 'A4';
  // kickSampler2.add(kickNote2, ki2buff);

  // const blobUrl = URL.createObjectURL(
  //   new Blob([processorSource], { type: 'application/javascript' }),
  // );

  // const kickSampler2 = new MyDrum(blobUrl, 'bd-processor').chain(
  const kickSampler2 = new BD({ decay: 1.4, tone: 75, amp: 2.4 }).chain(
    ...[
      //
    ].filter((n) => n),
    kickVol2,
  );
  const kickNote2 = 'A4';

  // --- bd
  const kickVol = new Tone.Volume();
  const kickSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    kickVol,
  );
  const KickNote = 'A4';
  const setKickBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 30; //58; //30;
      const amp = 2; //1.55; //2;
      const tone = 56; //58; //56;
      const envParams = scParams([0.11, 1, 0], [0, decay], -225);
      const trienvParams = scParams([0.11, 0.6, 0], [0, decay], -230);
      const fenvParams = scParams(
        [tone * 7, tone * 1.35, tone],
        [0.05, 0.6],
        -14,
      );
      const pfenvParams = scParams(
        [tone * 7, tone * 1.35, tone],
        [0.03, 0.6],
        -10,
      );

      const sigGain = new Tone.Gain();
      const sig = new Tone.Oscillator({
        frequency: fenvParams.levels[0],
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
          ].filter((n) => n),
          sigGain,
        )
        .start();

      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve, envParams.levels[1]),
        0,
        envParams.times[0],
      );
      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[1], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      sig.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[0], fenvParams.levels[1], fenvParams.curve),
        0,
        fenvParams.times[0],
      );
      sig.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[1], fenvParams.levels[2], fenvParams.curve),
        fenvParams.times[0],
        fenvParams.times[1],
      );

      const subGain = new Tone.Gain();
      const sub = new Tone.Oscillator({
        frequency: fenvParams.levels[0],
        oscillator: { type: 'triangle' },
      })
        .chain(
          ...[
            //
            new Tone.Gain(0.05),
          ].filter((n) => n),
          subGain,
        )
        .start();

      sub.volume.setValueCurveAtTime(
        volCurve(
          trienvParams.levels[0],
          trienvParams.curve,
          trienvParams.levels[1],
        ),
        0,
        trienvParams.times[0],
      );
      sub.volume.setValueCurveAtTime(
        volCurve(trienvParams.levels[1], trienvParams.curve),
        trienvParams.times[0],
        trienvParams.times[1],
      );

      sub.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[0], fenvParams.levels[1], fenvParams.curve),
        0,
        fenvParams.times[0],
      );
      sub.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[1], fenvParams.levels[2], fenvParams.curve),
        fenvParams.times[0],
        fenvParams.times[1],
      );

      const highpass = new Tone.Filter({
        type: 'highpass',
        frequency: 350,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const punchGain = new Tone.Gain();
      const punch = new Tone.Oscillator({
        frequency: pfenvParams.levels[0],
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(2),
            highpass,
          ].filter((n) => n),
          punchGain,
        )
        .start();

      punch.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve, envParams.levels[1]),
        0,
        envParams.times[0],
      );
      punch.volume.setValueCurveAtTime(
        volCurve(envParams.levels[1], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      punch.frequency.setValueCurveAtTime(
        frqCurve(
          pfenvParams.levels[0],
          pfenvParams.levels[1],
          pfenvParams.curve,
        ),
        0,
        pfenvParams.times[0],
      );
      punch.frequency.setValueCurveAtTime(
        frqCurve(
          pfenvParams.levels[1],
          pfenvParams.levels[2],
          pfenvParams.curve,
        ),
        pfenvParams.times[0],
        pfenvParams.times[1],
      );

      const comp = new Tone.Compressor({
        threshold: -8, // -100-0 : -24
        ratio: 8, // 1-20 : 12
        attack: 1e-1,
        release: 1e-1,
        knee: 8, // 0-40 : 30
      });

      const bdGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          sigGain,
          subGain,
          punchGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            new Tone.Gain(2.5),
            new Tone.Limiter(-8),
            // comp,
            new Tone.Gain(amp),
            new Tone.Channel(),
          ].filter((n) => n),
          bdGain,
        ),
      );
      Tone.fanIn(bdGain, Tone.getDestination());
    }, 10.5);

    smplr.add(KickNote, buffer);
  };

  // --- snare
  const snareVol = new Tone.Volume();
  const snareSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      snareVol,
    ].filter((n) => n),
  );
  const snareNote = 'A4';
  const setSnareBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 2;
      const tone = 340;
      const tone2 = 189;
      const snappy = 0.3;
      const amp2 = 1;

      const noiseEnvParams = {
        attack: 0.001,
        release: 4.2,
        level: 1,
        curve: -115,
      };
      const atkEnvParams = {
        attack: 0.001,
        release: 0.8,
        level: 1,
        curve: -95,
      };
      const noiseHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 1800,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const noiseLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 8850,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const noiseGain = new Tone.Gain();
      const whiteNoise = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            noiseHighpass,
            noiseLowpass,
            new Tone.Gain(snappy),
          ].filter((n) => n),
          noiseGain,
        )
        .start();

      whiteNoise.volume.setValueCurveAtTime(
        volCurve(noiseEnvParams.level, noiseEnvParams.curve),
        noiseEnvParams.attack,
        noiseEnvParams.release,
      );

      const osc1Gain = new Tone.Gain();
      const osc1 = new Tone.Oscillator({
        frequency: tone2,
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(0.6),
          ].filter((n) => n),
          osc1Gain,
        )
        .start();

      const osc2Gain = new Tone.Gain();
      const osc2 = new Tone.Oscillator({
        frequency: tone,
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(0.7),
          ].filter((n) => n),
          osc2Gain,
        )
        .start();

      osc1.volume.setValueCurveAtTime(
        volCurve(atkEnvParams.level, atkEnvParams.curve),
        0,
        atkEnvParams.release,
      );
      osc2.volume.setValueCurveAtTime(
        volCurve(atkEnvParams.level, atkEnvParams.curve),
        0,
        atkEnvParams.release,
      );

      const sumGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          osc1Gain,
          osc2Gain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            new Tone.Gain(amp2),
          ].filter((n) => n),
          sumGain,
        ),
      );
      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 340,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sigGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          noiseGain,
          sumGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            new Tone.Gain(amp),
            new Tone.Gain(2.5),
            new Tone.Channel(),
            sigHighpass,
          ].filter((n) => n),
          sigGain,
        ),
      );
      Tone.fanIn(sigGain, Tone.getDestination());
    }, 5.75);

    smplr.add(snareNote, buffer);
  };

  // --- cpRaw
  const cpRawVol = new Tone.Volume();
  const cpRawSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cpRawVol,
  );
  const cpRawNote = 'A4';
  const setCpRawBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;

      const atkenvParams = scParams([0.5, 1, 0], [0, 0.3], -160);
      const denvParams = {
        delay: 0.026,
        attack: 0.0,
        decay: 6.0,
        release: 1.0,
        level: 1,
        curve: -157,
      };

      const atkGain = new Tone.Gain();
      const atkNoise = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            new Tone.Gain(1.4),
          ].filter((n) => n),
          atkGain,
        )
        .start();

      atkNoise.volume.setValueCurveAtTime(
        volCurve(atkenvParams.levels[1], atkenvParams.curve),
        atkenvParams.times[0],
        atkenvParams.times[1],
      );

      const decayGain = new Tone.Gain();
      const decayNoise = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
          ].filter((n) => n),
          decayGain,
        )
        .start();
      decayNoise.volume.setValueCurveAtTime(
        volCurve(0, denvParams.curve),
        0,
        denvParams.delay,
      );
      decayNoise.volume.setValueCurveAtTime(
        volCurve(denvParams.level, denvParams.curve),
        denvParams.delay,
        denvParams.decay,
      );

      const sumHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 500,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sumBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 1062,
        Q: 0.5,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sumGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          atkGain,
          decayGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            new Tone.Gain(amp),
            sumHighpass,
            sumBandpass,
            new Tone.Gain(2.5),
            new Tone.Channel(),
          ].filter((n) => n),
          sumGain,
        ),
      );

      Tone.fanIn(sumGain, Tone.getDestination());
    }, 6.125);

    smplr.add(snareNote, buffer);
  };

  // --- cpReverb
  const cpReverbVol = new Tone.Volume();
  const cpReverbSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cpReverbVol,
  );
  const cpReverbNote = 'A4';
  const setCpReverbBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;
      const gate = 0;

      const revgenParams = {
        attack: 0.1,
        release: 4.0,
        level: 1,
        curve: -9,
      };

      const reverbHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 500,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const reverbLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 1000,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const reverbGain = new Tone.Gain();
      const reverbNoise = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            new Tone.Gain(0.02),
            // new Tone.Gain(0.2),
            reverbHighpass,
            reverbLowpass,
            new Tone.Gain(amp),
            new Tone.Channel(),
          ].filter((n) => n),
          reverbGain,
        )
        .start();

      reverbNoise.volume.setValueCurveAtTime(
        volCurve(revgenParams.level, revgenParams.curve),
        revgenParams.attack,
        revgenParams.release,
      );

      Tone.fanIn(reverbGain, Tone.getDestination());
    }, 4.125);

    smplr.add(snareNote, buffer);
  };

  // --- rimshot
  const rimshotVol = new Tone.Volume();
  const rimshotSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    rimshotVol,
  );
  const rimshotNote = 'A4';
  const setRimshotBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;

      const envParams = scParams([1, 1, 0], [0.00272, 0.07], -42);

      const tri1Gain = new Tone.Gain();
      const tri1 = new Tone.Oscillator({
        frequency: 1667 * 1.1,
        // oscillator: { type: 'triangle' },
        oscillator: { type: 'triangle', phase: 270 },
      })
        .chain(
          ...[
            //,
          ].filter((n) => n),
          tri1Gain,
        )
        .start();

      const tri2Gain = new Tone.Gain();
      const tri2 = new Tone.OmniOscillator({
        frequency: 455 * 1.1,
        type: 'pulse',
        width: 0.8,
      })
        .chain(
          ...[
            //,
            new Tone.AudioToGain(),
          ].filter((n) => n),
          tri2Gain,
        )
        .start();

      const punchGain = new Tone.Gain();
      const punch = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            new Tone.Gain(0.46),
          ].filter((n) => n),
          punchGain,
        )
        .start();

      tri1.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      tri2.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      punch.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      const sigPeaking = new Tone.Filter({
        type: 'peaking',
        frequency: 464,
        Q: 0.44,
        rolloff: -12, // -12, -24, -48, -96
        gain: 8,
      });

      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 315,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 7300,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          tri1Gain,
          tri2Gain,
          punchGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //
            sigPeaking,
            sigHighpass,
            sigLowpass,
            new Tone.Gain(amp),
            new Tone.Channel(),
          ].filter((n) => n),
          sigGain,
        ),
      );
      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.75);

    smplr.add(snareNote, buffer);
  };

  // --- claves
  const clavesVol = new Tone.Volume();
  const clavesSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    clavesVol,
  );

  const clavesNote = 'A4';
  const setClavesBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;

      const envParams = scParams([1, 1, 0], [0, 0.1], -20);
      const sigGain = new Tone.Gain();
      const sig = new Tone.Oscillator({
        frequency: 2500,
        oscillator: { type: 'sine' },
        // oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(amp),
            new Tone.Channel(),
          ].filter((n) => n),
          sigGain,
        )
        .start();
      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[1], envParams.curve),
        0,
        envParams.times[1],
      );

      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.125);

    smplr.add(snareNote, buffer);
  };

  // --- maracas
  const maracasVol = new Tone.Volume();
  const maracasSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    maracasVol,
  );

  const maracasNote = 'A4';
  const setMaracasBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;
      const gate = 0;

      const envParams = scParams([0.3, 1, 0], [0.027, 0.07], -250);

      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 5500,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sigGain = new Tone.Gain();
      const sig = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            new Tone.Gain(amp),
            sigHighpass,
            new Tone.Channel(),
          ].filter((n) => n),
          sigGain,
        )
        .start();
      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve, envParams.levels[1]),
        0,
        envParams.times[0],
      );
      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[1], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.125);

    smplr.add(snareNote, buffer);
  };
  // --- hat
  const closeHatVol = new Tone.Volume();
  const closeHatSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    closeHatVol,
  );

  const closeHatNote = 'A4';
  const setCloseHatBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 0.42;
      const amp = 1;
      const pan = 0;

      const frqs = [203.52, 366.31, 301.77, 518.19, 811.16, 538.75];
      const LFPulse = (frq) => {
        const osc = new Tone.AudioToGain();
        new Tone.PulseOscillator(frq, 0).connect(osc).start();
        return osc;
      };

      const sighi = new Tone.Gain();
      const sighiBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 8900,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sighiHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 9000,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            sighiBandpass,
            sighiHighpass,
          ].filter((n) => n),
          sighi,
        ),
      );

      const siglow = new Tone.Gain();
      const siglowBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 8900,
        Q: 0.8,
        rolloff: -12, // -12, -24, -48, -96
      });
      const siglowHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 9000,
        Q: 0.3,
        rolloff: -12, // -12, -24, -48, -96
      });
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            siglowBandpass,
            siglowHighpass,
          ].filter((n) => n),
          siglow,
        ),
      );

      const sig = new Tone.Volume();
      sig.volume.setValueCurveAtTime(volCurve(1, -30), 0, decay);
      Tone.fanIn(
        ...[
          //
          sighi,
          siglow,
        ].filter((n) => n),
        sig,
      );

      const sigPeaking = new Tone.Filter({
        type: 'peaking',
        frequency: 9700,
        Q: 1.7,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigGain = new Tone.Gain();
      sig.chain(
        ...[
          //,
          sigPeaking,
          new Tone.Gain(amp),
          new Tone.Channel(),
        ].filter((n) => n),
        sigGain,
      );
      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.25);

    smplr.add(snareNote, buffer);
  };

  // --- openhihat
  const openHatVol = new Tone.Volume();
  const openHatSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    openHatVol,
  );

  const openHatNote = 'A4';
  const setOpenHatBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 0.5;
      const amp = 4;
      const pan = 0;
      const env1Params = {
        attack: 0.1,
        release: decay,
        level: 1,
        curve: -13,
      };
      const env2Params = scParams([0, 1, 0], [0, decay * 5], -150);

      const frqs = [203.52, 366.31, 301.77, 518.19, 811.16, 538.75];
      const LFPulse = (frq) => {
        const osc = new Tone.AudioToGain();

        new Tone.PulseOscillator({
          frequency: frq,
          width: 0,
          volume: Tone.gainToDb(0.6),
        })
          .connect(osc)
          .start();
        return osc;
      };

      const sigLowshelf = new Tone.Filter({
        type: 'lowshelf',
        frequency: 990,
        rolloff: -12, // -12, -24, -48, -96
        gain: -3,
      });
      const sigBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 7700,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sigPeaking = new Tone.Filter({
        type: 'peaking',
        frequency: 7200,
        Q: 0.5,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 8100,
        Q: 0.7,
        rolloff: -48, // -12, -24, -48, -96
      });

      const sigHighshelf = new Tone.Filter({
        type: 'highshelf',
        frequency: 9400,
        Q: 1.7,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sig = new Tone.Gain();
      const siga = new Tone.Volume();
      const sigb = new Tone.Volume();
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            sigLowshelf,
            sigBandpass,
            sigPeaking,
            sigHighpass,
            sigHighshelf,
          ].filter((n) => n),
          sig.fan(siga, sigb),
        ),
      );

      new Tone.Gain(0.6).chain(siga);
      siga.volume.setValueCurveAtTime(
        volCurve(env1Params.level, env1Params.curve),
        env1Params.attack,
        env1Params.release,
      );

      sigb.volume.setValueCurveAtTime(
        volCurve(env2Params.levels[1], env2Params.curve),
        env2Params.times[0],
        env2Params.times[1],
      );

      const sumLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 4000,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sumGain = new Tone.Gain();
      Tone.fanIn(
        siga,
        sigb,
        new Tone.Gain().chain(
          ...[
            //,
            sumLowpass,
            new Tone.Channel(),
            new Tone.Gain(amp),
            new Tone.Gain(2),
          ].filter((n) => n),
          sumGain,
        ),
      );
      Tone.fanIn(sumGain, Tone.getDestination());
    }, 1.75);

    smplr.add(snareNote, buffer);
  };

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    transport.scheduleOnce((time) => {
      kickSeq.start(time);
      kickSeq2.start(time);
      snareSeq.start(time);
      // cpRawSeq.start(time);
      // cpReverbSeq.start(time);
      //rimshotSeq.start(time);
      //clavesSeq.start(time);
      // maracasSeq.start(time);
      hihatSeq.start(time);

      // }, transport.context.now());
    }, transport.seconds);
  });

  // --- seq
  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler.triggerAttack(KickNote, time, ftRand(velocity));
      // kickSampler.triggerAttackRelease(KickNote, `8n.`, time, ftRand(velocity));
    },
    events: [
      [1, 1, 1, [1, 0.6]],
      [1, 1, 1, 1],
      [null, null, null, null],
      [null, null, null, null],
      //[1, 1, 1, [1, 0.55]],
    ],
    subdivision: '1n',
  });

  const kickSeq2 = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler2.triggerAttack(time, ftRand(velocity));
      // kickSampler.triggerAttackRelease(KickNote, `8n.`, time, ftRand(velocity));
    },
    events: [
      [null, null, null, null],
      [null, null, null, null],
      [1, 1, 1, [1, 0.6]],
      [1, 1, 1, 1],
      //[null, null, null, null],

      //[1, 1, 1, [1, 0.55]],
    ],
    subdivision: '1n',
  });

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      snareSampler.triggerAttack(snareNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [
      [null, 1, null, 1],
      // [null, [1, [null, 0.45]], null, 1],
    ],
    subdivision: '1n',
  });
  const cpRawSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpRawSampler.triggerAttack(cpRawNote, time, ftRand(velocity));
    },
    events: [null, [null, [null, null, 1, null], [null, 1, null, null], null]],
    subdivision: '1n',
  });

  const cpReverbSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpReverbSampler.triggerAttack(cpReverbNote, time, ftRand(velocity));
    },
    events: [null, [null, [null, null, 1, null], null, null]],
    subdivision: '1n',
  });
  const rimshotSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      rimshotSampler.triggerAttack(rimshotNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [[null, [1, [null, 0.55]], null, 1]],
    subdivision: '1n',
  });

  const clavesSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      clavesSampler.triggerAttack(clavesNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [
      [
        [null, 1, 1, null],
        [1, [null, 1], null, 1],
      ],
    ],
    subdivision: '1n',
  });

  const maracasSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      maracasSampler.triggerAttack(maracasNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [[[[null, null, 1, 1], null, [null, null, 1, 1], null]]],
    subdivision: '1n',
    humanize: 0.006,
  });

  const hihatHandlers = new Map([
    [
      1, // close
      (time, velocity) => {
        openHatSampler?.triggerRelease();
        closeHatSampler.triggerAttack(closeHatNote, time, ftRand(velocity));
      },
    ],

    [
      -1, // open
      (time, velocity) => {
        closeHatSampler?.triggerRelease();
        openHatSampler.triggerAttack(openHatNote, time, ftRand(velocity));
      },
    ],
  ]);

  const hihatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hihatHandlers.get(Math.sign(velocity))?.(time, Math.abs(velocity));
    },
    events: [
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, [1, -1], [1, -1], 1, null, [-1, 1]],
    ],
    subdivision: '1n',
    humanize: 0.006,
  });

  // --- drumKit
  const drumKitBusName = 'drums';

  const toChannel = (fromNode, channelOptions, busName = drumKitBusName) => {
    const channel = new Tone.Channel(channelOptions);
    fromNode.connect(channel);
    channel.send(busName);
    return channel;
  };

  const kickCh = toChannel(kickVol, { volume: 0.0, pan: 0.0, channelCount: 1 });
  const kickCh2 = toChannel(kickVol2, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const snareCh = toChannel(snareVol, {
    volume: 2.0,
    pan: -0.1,
    channelCount: 1,
  });
  const cpRawCh = toChannel(cpRawVol, {
    volume: 2.0,
    pan: 0.0,
    channelCount: 1,
  });
  const cpReverbCh = toChannel(cpReverbVol, {
    volume: 5.0,
    pan: 0.0,
    channelCount: 1,
  });
  const rimshotCh = toChannel(rimshotVol, {
    volume: 3.0,
    pan: -0.1,
    channelCount: 1,
  });
  const clavesCh = toChannel(clavesVol, {
    volume: 12.0,
    pan: 0.0,
    channelCount: 1,
  });

  const maracasCh = toChannel(maracasVol, {
    volume: 1.0,
    pan: 0.0,
    channelCount: 1,
  });
  const closeHatCh = toChannel(closeHatVol, {
    volume: 0.0,
    pan: 0.3,
    channelCount: 1,
  });
  const openHatCh = toChannel(openHatVol, {
    volume: 0.0,
    pan: 0.4,
    channelCount: 1,
  });

  const drumKitVol = new Tone.Volume();
  const drumKitCh = new Tone.Channel({ volume: 2, channelCount: 2 });
  drumKitCh
    .chain(
      ...[
        //
        // new Tone.Gain(1.55),
        // new Tone.Limiter(-2),
        // new Tone.Gain(1.1),
      ].filter((n) => n),
      drumKitVol,
    )
    .receive(drumKitBusName);

  // ---  master mixer
  const masterVol = new Tone.Volume();
  const masterLimiter = new Tone.Limiter(-8);

  Tone.fanIn(
    ...[
      //
      drumKitVol,
    ].filter((n) => n),
    masterVol.chain(
      ...[
        //
        // new Tone.Gain(2.1),
        // masterLimiter,
        // new Tone.Gain(1.1),
      ].filter((n) => n),
      Tone.getDestination(),
    ),
  );

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  p.setup = async () => {
    //p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    //await renderToBuffer(kickSampler2);
    await setKickBuffer(kickSampler);
    await setSnareBuffer(snareSampler);
    await setCpRawBuffer(cpRawSampler);
    await setCpReverbBuffer(cpReverbSampler);
    await setRimshotBuffer(rimshotSampler);
    await setClavesBuffer(clavesSampler);
    await setMaracasBuffer(maracasSampler);
    await setCloseHatBuffer(closeHatSampler);
    await setOpenHatBuffer(openHatSampler);

    // xxx: インクルード要検討
    transport.start();
    emitter.emit('startOnceCallSeqs');

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterVol);

    // p.noLoop();
    // p.frameRate(1);
  };

  p.draw = () => {
    // put drawing code here
    p.background(80);
    spectrumAnalyzer.drawGraph();
  };

  p.windowResized = (e) => {
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
