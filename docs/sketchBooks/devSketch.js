// --- # example: name space
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 72;


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
      attack: 6e-4,
      // decay: 0.143,
      decay: 1.25,
      sustain: 0.0,
      release: 0.0,
      attackCurve: 'exponential',
    },
  });
  // synth.triggerAttackRelease('A3', '16t');
  synth.triggerAttack('A3');
  synth.frequency.rampTo('C#1', 0.083);
  // synth.frequency.rampTo('C2', `72i`);
  synth.chain(
    ...[
      //,
      new Tone.Channel().toDestination(),
    ].filter((n) => n),
  );
}, 2.0);

const orgnKickBuffer2 = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const synth = new Tone.Synth({
    oscillator: { type: 'sine', phase: 270 },
    envelope: {
      attack: 5e-4,
      decay: 2.75,
      sustain: 0.0,
      release: '64i',
      attackCurve: 'exponential',
    },
  });
  // synth.triggerAttackRelease('A3', '16t');
  synth.triggerAttack(`A3`);
  synth.frequency.rampTo('C1', `24i`);
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

  const orgnKickCh2 = new Tone.Channel();
  const orgnKickSampler2 = new Tone.Sampler({
    urls: {
      A4: orgnKickBuffer2, // C1:24
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
      orgnKickCh2,
    ].filter((n) => n),
  );

  const orgnKickSeq2 = new Tone.Sequence({
    callback: (time, velocity) => {
      orgnKickSampler2.triggerAttack('A4', time, velocity);
    },
    events: [null, 1, null, 1],
    //events: [1, null, 1, null],
    subdivision: '4n',
  });

  // ---  master mixer
  const fanInNodes = [
    //
    //momoKickCh,
    orgnKickCh,
    orgnKickCh2,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    transport.scheduleOnce((time) => {
      //clickSeq.start(time);
      //momoKickSeq.start(time);
      orgnKickSeq.start(time);
      orgnKickSeq2.start(time);
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
