// --- # example: kick
// [GitHub - kasaitakara/mono82: Simple music sequencer for everyone · GitHub](https://github.com/kasaitakara/mono82)
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 90;

// [mono82/js/audio.js at main · kasaitakara/mono82 · GitHub](https://github.com/kasaitakara/mono82/blob/main/js/audio.js)
const processorSource = `
  class MoktonFmVoiceProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const p = options.processorOptions || {};
      this.startTime = Number(p.startTime) || 0;
      this.stopTime = Number(p.stopTime) || this.startTime;
      this.note = Number(p.note) || 60;
      this.fmDepth = Math.max(0, Number(p.fmDepth) || 0);
      this.fmRatio = Math.max(0.25, Number(p.fmRatio) || 1);
      this.pitchLfos = Array.isArray(p.pitchLfos) ? p.pitchLfos : [];
      this.fmLfos = Array.isArray(p.fmLfos) ? p.fmLfos : [];
      this.carrierPhase = 0;
      this.modulatorPhase = 0;
      this.pitchRandomStates = this.pitchLfos.map(config => this.makeRandomState(config));
      this.fmRandomStates = this.fmLfos.map(config => this.makeRandomState(config));
    }
    frequency(note) { return 440 * Math.pow(2, (note - 69) / 12); }
    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    makeRandomState(config) {
      if (config.wave !== "random") return null;
      return { interval: 1 / Math.max(0.001, Number(config.rateHz) || 1), nextTime: 0, value: Math.random() * 2 - 1 };
    }
    lfoWaveValue(config, elapsedSeconds, randomState) {
      const wave = config.wave;
      const rateHz = Math.max(0.001, Number(config.rateHz) || 1);
      if (wave === "random") {
        while (elapsedSeconds >= randomState.nextTime) {
          randomState.value = Math.random() * 2 - 1;
          randomState.nextTime += randomState.interval;
        }
        return randomState.value;
      }
      if (wave === "rise" || wave === "fall") {
        return (wave === "fall" ? 1 : -1) * (1 - this.clamp(elapsedSeconds * rateHz, 0, 1));
      }
      const phase = 2 * Math.PI * rateHz * elapsedSeconds;
      switch (wave) {
        case "triangle": return (2 / Math.PI) * Math.asin(Math.sin(phase));
        case "square": return Math.sin(phase) >= 0 ? 1 : -1;
        case "sawUp": return ((elapsedSeconds * rateHz) % 1) * 2 - 1;
        case "sawDown": return 1 - ((elapsedSeconds * rateHz) % 1) * 2;
        default: return Math.sin(phase);
      }
    }
    pitchDepthToCents(config) {
      const shaped = Math.pow(this.clamp(Number(config.depth) || 0, 0, 100) / 100, 2);
      return (config.wave === "rise" || config.wave === "fall") ? shaped * 3600 : shaped * 1200;
    }
    process(inputs, outputs) {
      const channel = outputs[0]?.[0];
      if (!channel) return true;
      const blockStart = currentTime;
      if (blockStart >= this.stopTime) return false;
      const baseFrequency = this.frequency(this.note);
      for (let i = 0; i < channel.length; i++) {
        const sampleTime = blockStart + i / sampleRate;
        if (sampleTime < this.startTime || sampleTime >= this.stopTime) {
          channel[i] = 0; continue;
        }
        const elapsed = sampleTime - this.startTime;
        let pitchCents = 0;
        for (let n = 0; n < this.pitchLfos.length; n++) {
          pitchCents += this.lfoWaveValue(this.pitchLfos[n], elapsed, this.pitchRandomStates[n]) * this.pitchDepthToCents(this.pitchLfos[n]);
        }
        const carrierFrequency = baseFrequency * Math.pow(2, pitchCents / 1200);
        let fmLfoAmount = 0;
        for (let n = 0; n < this.fmLfos.length; n++) {
          fmLfoAmount += this.lfoWaveValue(this.fmLfos[n], elapsed, this.fmRandomStates[n]) * (this.clamp(Number(this.fmLfos[n].depth) || 0, 0, 100) / 100) * 20;
        }
        const effectiveFmDepth = this.clamp(this.fmDepth + fmLfoAmount, 0, 40);
        const instantaneousFrequency = carrierFrequency + Math.sin(this.modulatorPhase) * (carrierFrequency * effectiveFmDepth * 0.1);
        channel[i] = Math.sin(this.carrierPhase);
        this.carrierPhase = (this.carrierPhase + 2 * Math.PI * instantaneousFrequency / sampleRate) % (Math.PI * 2);
        this.modulatorPhase = (this.modulatorPhase + 2 * Math.PI * (baseFrequency * this.fmRatio) / sampleRate) % (Math.PI * 2);
      }
      return true;
    }
  }
  registerProcessor("mokton-fm-voice", MoktonFmVoiceProcessor);
`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function frequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}
function lfoRateToHz(value) {
  return clamp(Number(value) || 1, 1, 1000) / 10;
}
function envelopeSeconds(sound) {
  const attackValue = clamp(Number(sound?.attack) || 1, 1, 100);
  const attack = 0.001 + 0.999 * Math.pow((attackValue - 1) / 99, 2.4);
  const holdDecayValue = clamp(Number(sound?.holdDecay) || 0, -50, 50);
  const duration = holdDecayValue === 0 ? 0.005 : 0.005 + 9.995 * Math.pow(Math.abs(holdDecayValue) / 50, 3);
  return { attack, holdDecayValue, duration };
}

// context を引数で受け取る形に変更
function ensureNoiseBuffer(context, cache) {
  if (cache.buffer && cache.sampleRate === context.sampleRate) return cache.buffer;
  const length = context.sampleRate * 2;
  const buf = context.createBuffer(1, length, context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  cache.buffer = buf;
  cache.sampleRate = context.sampleRate;
  return buf;
}

// playSound を context 引数付きに変更(中身はほぼ同じ)
function scheduleSound(context, layer, sound, performanceData) {
  const rawDest = context.rawContext.destination;
  const startTime = context.currentTime + 0.03; // OfflineContext の内部時計は 0 開始
  const { attack, holdDecayValue, duration } = envelopeSeconds(sound);
  const note = clamp(60 + (Number(sound.note) || 0) + (Number(performanceData.note) || 0), 0, 127);
  const gateEnd = startTime + duration;
  const releaseEnd = gateEnd + (holdDecayValue <= 0 ? 0.005 : 0.05);
  const voiceStopAt = releaseEnd + 0.01;
  const peakLevel = Math.max(
    0.0001,
    (clamp(sound.gain || 0, 0, 150) / 100) * (clamp(performanceData.gain || 0, 0, 150) / 100),
  );

  const voiceGain = context.createGain();
  const attackEnd = startTime + attack;
  voiceGain.gain.setValueAtTime(0.0001, startTime);
  voiceGain.gain.exponentialRampToValueAtTime(peakLevel, attackEnd);
  if (holdDecayValue > 0) {
    voiceGain.gain.linearRampToValueAtTime(0.0001, Math.max(attackEnd + 0.001, gateEnd));
  } else {
    voiceGain.gain.setValueAtTime(peakLevel, gateEnd);
  }
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

  const filterCutoff = clamp(Number(sound.filterCutoff) || 0, -50, 50);
  let finalOutputNode = voiceGain;
  if (filterCutoff !== 0) {
    const filter = context.createBiquadFilter();
    if (filterCutoff > 0) {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(20 * Math.pow(7000 / 20, filterCutoff / 50), startTime);
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(18000 * Math.pow(90 / 18000, Math.abs(filterCutoff) / 50), startTime);
    }
    filter.Q.setValueAtTime(clamp(Number(sound.filterResonance) || 0, 0, 50) / 2, startTime);
    voiceGain.connect(filter);
    finalOutputNode = filter;
  }
  finalOutputNode.connect(rawDest);

  const lfos = [sound?.lfo1, sound?.lfo2]
    .filter((lfo) => lfo && clamp(Number(lfo.depth) || 0, 0, 100) > 0)
    .map((lfo) => ({
      target: lfo.target,
      wave: String(lfo.wave ?? 'sine'),
      depth: clamp(Number(lfo.depth) || 0, 0, 100),
      rateHz: lfoRateToHz(lfo.rate),
    }));

  const pitchLfos = lfos.filter((lfo) => lfo.target === 'pitch');
  const fmLfos = layer === 'melodic' ? lfos.filter((lfo) => lfo.target === 'fm') : [];
  const fmDepth = layer === 'melodic' ? clamp(Number(sound.fmDepth) || 0, 0, 20) : 0;
  const noiseMix = layer === 'rhythm' ? clamp(Number(sound.noiseMix) || 0, 0, 100) / 100 : 0;
  const sineMix = layer === 'rhythm' ? 1 - noiseMix : 1;

  if (sineMix > 0) {
    const sineGain = context.createGain();
    sineGain.gain.setValueAtTime(Math.max(0.0001, sineMix), startTime);

    if ((layer === 'rhythm' || fmDepth <= 0) && pitchLfos.length === 0 && fmLfos.length === 0) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency(note), startTime);
      oscillator.connect(sineGain).connect(voiceGain);
      oscillator.start(startTime);
      oscillator.stop(voiceStopAt);
    } else {
      const fmVoice = context.createAudioWorkletNode('mokton-fm-voice', {
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          startTime,
          stopTime: voiceStopAt,
          note,
          fmDepth,
          fmRatio: sound.fmRatio || 1,
          pitchLfos,
          fmLfos,
        },
      });
      fmVoice.connect(sineGain).connect(voiceGain);
    }
  }

  if (noiseMix > 0) {
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(Math.max(0.0001, noiseMix), startTime);
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = noiseBufferCache; // 呼び出し側で用意した AudioBuffer
    noiseSource.loop = true;
    noiseSource.connect(noiseGain).connect(voiceGain);
    noiseSource.start(startTime);
    noiseSource.stop(voiceStopAt);
  }

  return voiceStopAt; // レンダリング必要秒数の計算用
}

// --- 実行 ---
let noiseBufferCache = null; // AudioBuffer は context 非依存なので共有可

async function renderToBuffer(layer, sound, performanceData) {
  const blobUrl = URL.createObjectURL(new Blob([processorSource], { type: 'application/javascript' }));

  // まず必要な総時間を計算(duration を先に決める必要がある)
  const { duration } = envelopeSeconds(sound);
  const totalDuration = 0.03 + duration + 0.1; // startTime + envelope + release + 余裕

  const toneBuffer = await Tone.Offline(
    async (context) => {
      // callback は await されるので、ここで worklet をロードすれば
      // render() → workletsAreReady() が完了を保証する
      await context.addAudioWorkletModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      noiseBufferCache = ensureNoiseBuffer(context, {
        buffer: noiseBufferCache,
      });
      scheduleSound(context, layer, sound, performanceData);
    },
    totalDuration,
    2,
    Tone.getContext().sampleRate,
  );

  return toneBuffer; // ToneAudioBuffer(.get() で生 AudioBuffer)
}

// [mono82/js/sound-presets.js at main · kasaitakara/mono82 · GitHub](https://github.com/kasaitakara/mono82/blob/main/js/sound-presets.js)
const kickPreset = {
  id: 'factory-rhythm-kick',
  category: 'rhythm',
  name: 'kick',
  sound: {
    gain: 70,
    noiseMix: 0,
    note: -35,
    attack: 1,
    holdDecay: 12,
    filterCutoff: 0,
    filterResonance: 0,
    lfo1: {
      target: 'pitch',
      wave: 'fall',
      depth: 94,
      rate: 120,
      syncMode: 'free',
    },
    lfo2: {
      target: 'pitch',
      wave: 'sine',
      depth: 0,
      rate: 25,
      syncMode: 'free',
    },
  },
};

// --- offline buffers
const monoKickBuffer = await renderToBuffer(kickPreset.category, kickPreset.sound, {
  gain: 100,
  note: 0,
});

const orgnKickBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const synth = new Tone.Synth({
    oscillator: { type: 'sine', phase: 270 },
    // oscillator: { type: 'sine', },

    /*
    envelope: {
      attack: 5e-4,
      decay: 2.75,
      sustain: 1.0,
      release: '64i',
      attackCurve: 'exponential',
    },
    */
    envelope: {
      attack: 1e-3,
      // decay: 0.143,
      decay: 1.0,
      sustain: 0.0,
      release: 0.0,
      attackCurve: 'exponential',
    },
  });
  //synth.triggerAttackRelease('A3', '16t');
  synth.triggerAttack('A3', 0);
  synth.frequency.rampTo('C#1', 0.083);
  // synth.frequency.rampTo('C2', `72i`);
  synth.chain(
    ...[
      //,
      new Tone.Channel().toDestination(),
    ].filter((n) => n),
  );
}, 2.0);

function ftRand(bias, spread = 1.0) {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
}

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

  const toTime = (t) => new Tone.TimeClass(transport.context, t).toSeconds();

  const masterCh = new Tone.Channel().toDestination();
  const emitter = new Tone.Emitter();

  // メトロノーム
  const clickSynth = new Tone.MembraneSynth({
    pitchDecay: `3i`, // 0 ~ 0.5 秒
    octaves: 1.25, // 0.5 ~ 8
    envelope: {
      attack: 0.0,
      decay: 1.0,
      sustain: 0.0,
      release: `8t`,
    },
    oscillator: { type: 'sine' },
  });
  const clickSeq = new Tone.Sequence({
    callback: (time, note) => {
      clickSynth.triggerAttackRelease(note, '1i', time);
    },
    events: ['A5', 'A4', 'A4', 'A4'],
    subdivision: '4n',
  });
  const clickCh = new Tone.Channel(-4);
  clickSynth.chain(clickCh);

  // --- mono
  const momoKickCh = new Tone.Channel();
  const momoKickSampler = new Tone.Sampler({
    urls: {
      A4: monoKickBuffer,
    },

    onload: () => {},
    onerror: (error) => {
      console.error('sample load error:', error);
    },
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      momoKickCh,
    ].filter((n) => n),
  );

  const momoKickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      momoKickSampler.triggerAttack('A4', time, velocity);
    },
    //events: [1, null, 1, null],
    events: [null, 1, null, 1],
    subdivision: '4n',
  });

  // --- orgn
  const orgnKickCh = new Tone.Channel();
  const orgnKickSampler = new Tone.Sampler({
    urls: {
      A4: orgnKickBuffer, // C1:24
    },
    onload: () => {},
    onerror: (error) => {
      console.error('sample load error:', error);
    },
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      orgnKickCh,
    ].filter((n) => n),
  );

  const orgnKickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      orgnKickSampler.triggerAttack('A4', time, velocity);
    },
    //events: [null, 1, null, 1],
    events: [1, null, 1, null],
    subdivision: '4n',
  });

  // ---  master mixer
  const fanInNodes = [
    //
    momoKickCh,
    orgnKickCh,

    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    transport.scheduleOnce((time) => {
      //clickSeq.start(time);
      momoKickSeq.start(time);
      orgnKickSeq.start(time);
    }, transport.context.now());
  });

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

    // xxx: インクルード要検討
    transport.start();
    emitter.emit('startOnceCallSeqs');

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);

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
