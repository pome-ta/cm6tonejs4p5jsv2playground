// --- # example: Sampler
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 90;

// --- offline buffers
const kickBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const synth = new Tone.Synth({
    oscillator: { type: 'sine', phase: 270 },
    envelope: {
      attack: 0,
      decay: 2.75,
      sustain: 0.5,
      release: '32i',
      attackCurve: 'exponential',
    },
  });
  synth.triggerAttackRelease('A2', '8n');
  synth.frequency.rampTo('C1', `64i`);
  synth.chain(
    ...[
      //,
      new Tone.Channel(8).toDestination(),
    ].filter((n) => n),
  );
}, 1.5);

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

  const kickSampler = new Tone.Sampler({
    urls: {
      C1: kickBuffer, // C1:24
    },
    onload: () => {},
    onerror: (error) => {
      console.error('sample load error:', error);
    },
    attack: 0,
    release: '2i',
    curve: 'exponential',
  });

  // --- kick
  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      kickSampler.triggerAttack('C1', time);
    },
    events: [
      [1, null, [1, 1], null],
      [1, [, [, 1]], [1, 1], null],
    ],
    subdivision: '1n',
  });

  const kickCh = new Tone.Channel();
  kickSampler.chain(
    ...[
      //
      kickCh,
    ].filter((n) => n),
  );

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
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    //transport.start();
    transport.scheduleOnce((time) => {
      kickSeq.start(time);
      //clickSeq.start(time);
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
