// --- # example:
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 96;

// --- offline buffers
const kickBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const synth = new Tone.Synth({
    oscillator: { type: 'sine', phase: 270 },
    envelope: {
      attack: 5e-4,
      decay: 2.75,
      sustain: 1.0,
      release: '64i',
      attackCurve: 'exponential',
    },
  });
  synth.triggerAttackRelease('A3', '16t');
  synth.frequency.rampTo('C1', `24i`);

  synth.chain(...[new Tone.Channel().toDestination()].filter((n) => n));
}, 2.0);

const hihatBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const metalSynth = new Tone.MetalSynth({
    envelope: {
      attack: 0.0,
      decay: 1.9,
      sustain: 0.0,
      release: 1e-3,
      attackCurve: 'exponential',
    },
    harmonicity: 2.7,
    modulationIndex: 5,
    octaves: 0.27,
    resonance: 270,
  });
  metalSynth.triggerAttackRelease(1200, '3i');
  metalSynth.chain(
    ...[
      //,
      new Tone.Channel().toDestination(),
    ].filter((n) => n),
  );
}, 0.5);

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

  const kickCh = new Tone.Channel();
  const kickComp = new Tone.Compressor({
    threshold: -45,
    ratio: 20,
    attack: 0.2,
    release: 5e-2,
    knee: 40,
  });
  const kickSampler = new Tone.Sampler({
    urls: {
      C1: kickBuffer, // C1:24
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
      // kickComp,
      kickCh,
    ].filter((n) => n),
  );

  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler.triggerAttack('F0', time, velocity);
    },
    events: [
      // [1, null, [1, 0.75], null],
      // [1, [, [, 0.55]], [1, 0.8], null],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, ftRand(0.125)]],
    ],
    subdivision: '1n',
  });
  const hihatCh = new Tone.Channel(-4);
  const hihatFilter = new Tone.Filter({
    type: 'lowpass',
    frequency: 5800,
    Q: 2.0,
    rolloff: -12, // -12, -24, -48, -96
    gain: 1,
  });
  const hihatSampler = new Tone.Sampler({
    urls: {
      A4: hihatBuffer,
    },
    attack: '1i',
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      hihatFilter,
      hihatCh,
    ].filter((n) => n),
  );

  const hihatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hihatSampler.triggerAttack('A5', time, velocity);
    },
    events: [
      [null, ftRand(0.95), null, ftRand(0.75)],
      [null, ftRand(0.95), ftRand(0.125), ftRand(0.85)],
    ],
    subdivision: '2n',
    humanize: 0.005,
  });

  const fmPolyCh = new Tone.Channel();
  const fmPolyComp = new Tone.Compressor({
    threshold: -45,
    ratio: 20,
    attack: 0.2,
    release: 5e-2,
    knee: 40,
  });
  const fmPolySynth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 5.0,
    modulationIndex: 2.0,

    oscillator: { type: 'sine' },
    envelope: {
      attack: 1e-2,
      decay: 1.37,
      sustain: 0.8,
      release: `32i`,
    },
    modulation: { type: 'sine' },
    modulationEnvelope: {
      attack: 5e-4,
      decay: 2.9,
      sustain: 0.15,
      release: '128i',
    },
  }).chain(
    ...[
      //
      // fmPolyComp,
      fmPolyCh,
    ].filter((n) => n),
  );

  const fmPolySeq = new Tone.Sequence({
    callback: (time, value) => {
      const computedTime = toTime({ '8t': 1.0 });
      value.notes.forEach((note, idx) => {
        const durationSeconds = idx * toTime({ '16t': 1.0 });
        fmPolySynth.triggerAttackRelease(note, computedTime, time + durationSeconds, ftRand(0.85));
      });
    },
    events: [
      { notes: ['A3', 'C4', 'E3', 'G4'] },
      { notes: ['D3', 'F3', 'A4', 'C4'] },
      { notes: ['G3', 'B3', 'D3', 'F4'] },
      { notes: ['C4', 'E3', 'G4', 'B3'] },

      { notes: ['A3', 'C4', 'E3', 'G4'] },
      { notes: ['D3', 'F3', 'A4', 'C4'] },
      { notes: ['G3', 'B3', 'D3', 'F4'] },
      { notes: ['C4', 'E3', 'G4', 'B3'] },

      { notes: ['A3', 'C4', 'E3', 'G4'] },
      { notes: ['D3', 'F3', 'A4', 'C4'] },
      { notes: ['G3', 'B3', 'D3', 'F4'] },
      { notes: ['C4', 'E3', 'G4', 'B3'] },

      { notes: ['A3', 'C4', 'E3', 'G4'] },
      { notes: ['D3', 'F3', 'A4', 'C4'] },
      { notes: ['G3', 'B3', 'D3', 'F3'] },
      { notes: ['C3', 'E4', 'G3', 'B4'] },
    ],
    subdivision: '2n',
    humanize: 0.05,
  });

  // ---  master mixer
  const fanInNodes = [
    //
    kickCh,
    hihatCh,
    fmPolyCh,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    transport.scheduleOnce((time) => {
      // clickSeq.start(time);
      kickSeq.start(time);
      hihatSeq.start(time);
      fmPolySeq.start(time);
    }, transport.context.now());
  });

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  //p.setup = async () => {
  p.setup = () => {
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
