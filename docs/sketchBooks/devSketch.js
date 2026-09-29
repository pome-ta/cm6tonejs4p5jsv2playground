// --- # example: Sampler
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 125;

// --- offline buffers
const kickBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const synth = new Tone.Synth({
    oscillator: { type: 'sine', phase: 270 },
    // oscillator: { type: 'sine', },
    envelope: {
      attack: 6e-4,
      decay: 2.75,
      sustain: 1.0,
      release: '64i',
      attackCurve: 'exponential',
    },
  });
  synth.triggerAttackRelease('A3', '16t');
  synth.frequency.rampTo('C1', `24i`);
  // synth.frequency.rampTo('C2', `72i`);
  synth.chain(
    ...[
      //,
      new Tone.Channel().toDestination(),
    ].filter((n) => n),
  );
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

  const masterCh = new Tone.Channel().toDestination();
  const emitter = new Tone.Emitter();

  const kickCh = new Tone.Channel(8);
  const kickComp = new Tone.Compressor(-23.0, 18);
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
      kickComp,
      kickCh,
    ].filter((n) => n),
  );

  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler.triggerAttack('A0', time, velocity);
    },
    events: [
      // [1, null, [1, 0.75], null],
      // [1, [, [, 0.55]], [1, 1], null],
      [1, 1, 1, 1],
      // [1, 1, 1, 1],
      // [1, 1, 1, 1],
      // [1, 1, 1, [1, 0.5]],
    ],
    subdivision: '1n',
  });

  const hihatCh = new Tone.Channel(-12);
  const hihatFilter = new Tone.Filter({
    type: 'lowpass',
    frequency: 8800,
    Q: 1.0,
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
      // hihatFilter,
      hihatCh,
    ].filter((n) => n),
  );

  const hihatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hihatSampler.triggerAttack('A5', time, velocity);
    },
    events: [
      // [1, null, [1, 0.75], null],
      // [1, [, [, 0.55]], [1, 1], null],
      [1.0, 0.45, 0.85, 0.35],
      [0.92, 0.64, 0.75, 0.55],
      [1.0, 0.45, 0.75, 0.55],
      [0.92, 0.64, 0.85, 0.45],
    ],
    subdivision: '4n',
    humanize: 0.005,
  });

  // メトロノーム
  const clickSynth = new Tone.MembraneSynth();
  const clickSeq = new Tone.Sequence({
    callback: (time, note) => {
      clickSynth.triggerAttackRelease(note, '1i', time);
    },
    events: ['A5', 'A4', 'A4', 'A4'],
    subdivision: '4n',
  });
  const clickCh = new Tone.Channel(-4);
  clickSynth.chain(clickCh);

  // ---  master mixer
  const fanInNodes = [
    //
    kickCh,
    hihatCh,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    //transport.start();
    transport.scheduleOnce((time) => {
      kickSeq.start(time);
      hihatSeq.start(time);

      // clickSeq.start(time);
    }, transport.context.now());
    // }, 0);
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
    console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
