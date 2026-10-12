// --- # example: side chain
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 125;

// --- offline buffers
const kickBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const synth = new Tone.Synth({
    oscillator: { type: 'sine', phase: 270 },
    envelope: {
      attack: 0,
      decay: 1.75,
      sustain: 0.0,
      release: '1i',
      attackCurve: 'exponential',
    },
  });
  synth.triggerAttackRelease('A3', 0.775);
  synth.frequency.rampTo('C0', 0.125);
  synth.chain(
    ...[
      //,
      new Tone.Channel(8).toDestination(),
    ].filter((n) => n),
  );
}, 1.5);

const snareBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const whiteNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.0,
      decay: 1.0,
      sustain: 0.0,
      release: '1i',
    },
  });

  const chebyshev = new Tone.Chebyshev({
    order: 32,
    oversample: 'none',
  });
  const bandpass = new Tone.Filter({
    type: 'bandpass',
    frequency: 585,
    Q: 5.2,
    rolloff: -12, // -12, -24, -48, -96
    gain: 64,
  });
  const peaking = new Tone.Filter({
    type: 'peaking',
    frequency: 1980,
    Q: 0.2,
    rolloff: -48, // -12, -24, -48, -96
    gain: 10,
  });
  whiteNoise.triggerAttackRelease('24i');
  whiteNoise.chain(
    ...[
      chebyshev,
      bandpass,
      peaking,
      //,
      new Tone.Channel(2).toDestination(),
    ].filter((n) => n),
  );
}, 1.5);

const hihatBuffer = await Tone.Offline((context) => {
  context.transport.bpm.value = BPM;
  const metalSynth = new Tone.MetalSynth({
    envelope: {
      attack: 0.0,
      decay: 1.9,
      sustain: 0.0,
      release: 0.01,
      attackCurve: 'exponential',
    },
    harmonicity: 5.1,
    modulationIndex: 32,
    octaves: 1.25,
    resonance: 3000,
  });
  metalSynth.triggerAttackRelease(980, '3i');
  metalSynth.chain(
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

  // --- drumKit
  const kick = 'kick',
    snare = 'snare',
    hihat = 'hihat';
  const drumKit = new Tone.Players({
    //
    kick: kickBuffer,
    snare: snareBuffer,
    hihat: hihatBuffer,
  });
  drumKit.fadeIn = '1i';
  drumKit.fadeOut = '2i';
  drumKit.player(kick).fadeIn = 0;

  // --- kick
  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      drumKit.player(kick).start(time);
    },
    events: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, 1]],
    ],
    subdivision: '1n',
  });

  // --- snare
  const snareSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      drumKit.player(snare).start(time);
    },
    events: [null, 1],
    subdivision: '4n',
    //humanize: 0.005,
    // probability: 0.88,
  });

  // --- hihat
  const hihatSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      drumKit.player(hihat).start(time);
    },
    events: [null, 1],
    subdivision: '8n',
    // humanize: 0.005,
    // probability: 0.88,
  });

  const drumCh = new Tone.Channel();
  drumKit.chain(
    ...[
      //
      drumCh,
    ].filter((n) => n),
  );

  // --- bass
  const bassSynth = new Tone.MonoSynth({
  // const bassSynth = new Tone.Synth({
    // oscillator: { type: 'pulse', width: 0 },
    oscillator: { type: 'pwm', modulationFrequency: '4t' },
    envelope: {
      attack: '1i',
      decay: 0.0,
      sustain: 1.0,
      release: '1i',
      attackCurve: 'exponential',
    },
    filter: {
      Q: 0,
      rolloff: -12, // -12, -24, -48, -96
      type: 'lowpass',
      // type: 'highpass',
    },
    filterEnvelope: {
      attack: 0.6,
      baseFrequency: 600,
      decay: 0.2,
      exponent: 2,
      octaves: 3,
      release: 2,
      sustain: 0.5,
    },
  });
  const bassGain = new Tone.Gain(1);
  const bassSeq = new Tone.Sequence({
    callback: (time, note) => {
      bassSynth.triggerAttack(note, time);
    },
    events: [
      'A1', null, null, null, null, null, null, ['G1', 'C1'],
      'A1', null, null, null, null, null, null, ['G1', null, 'C4'],
    ],
    // events: ['A2', null, null, 'G2'],
    subdivision: '2n',
  });

  const bassCh = new Tone.Channel(-4);
  bassSynth.chain(
    ...[
      //
      bassGain,
      bassCh,
    ].filter((n) => n),
  );

  const sideChain = (a, b) => {
    const follower = new Tone.Follower('4n');
    b.connect(follower);
    const duckScale = new Tone.Scale({
      min: 1.0, // kickが鳴っていない時: 素通し
      max: -0.75, // kickが最大音量の時: 最大ダッキング
    });

    follower.connect(duckScale);
    duckScale.connect(a.gain);
  };

  sideChain(bassGain, drumKit.player(kick));

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
    drumCh,
    bassCh,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    //transport.start();
    transport.scheduleOnce((time) => {
      [
        //
        kickSeq,
        // snareSeq,
        // hihatSeq,
      ].forEach((drumSeq) => {
        drumSeq.start(time);
      });
      // clickSeq.start(time);
      bassSeq.start(time);
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



