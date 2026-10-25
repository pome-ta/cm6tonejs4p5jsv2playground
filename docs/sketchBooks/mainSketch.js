// --- # example: 808 ?
import * as Tone from 'tone';
import {
  Bd,
  Sn,
  CpRaw,
  CpReverb,
  Lt,
  Mt,
  Ht,
  Lc,
  Mc,
  Hc,
  Rimshot,
  Claves,
  Maracas,
  Cowbell,
  Hat,
  Openhihat,
  Cymbal,
} from 'modules/tr808scWorklet/drumKit.js';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 110;

const ftRand = (bias, spread = 1.0) => {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
};

const sketch = (p) => {
  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  // --- Tone.js
  const p5Ctx = p.getAudioContext();
  Tone.setContext(p5Ctx, true);
  const toneCtx = Tone.getContext();
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });
  const transport = Tone.getTransport();
  transport.bpm.value = BPM;

  const emitter = new Tone.Emitter();

  // --- bd
  const kickVol = new Tone.Volume();
  const kickGen = new Bd({
    decay: 58.0, // 58.0: 6.0 | 30.0 | 110.0
    amp: 1.449, // 1.449: 1.0 | 2.0 | 2.1
    tone: 50.0, // 50.0: 50.0 | 56.0 | 70.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    kickVol,
  );

  // --- snare
  const snareVol = new Tone.Volume();
  const snareGen = new Sn({
    amp: 1.118, // 1.118: 0.5 | 2.0 | 2.5
    tone: 300.9, // 300.9: 210.8 | 340.0 | 391.0
    tone2: 167.265, // 167.265: 117.18 | 189.0 | 217.35
    snappy: 0.226, // 0.226: 0.002 | 0.3 | 0.45
    amp2: 0.775, // 0.775: 0.6 | 1.0 | 1.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    snareVol,
  );

  // --- cpRaw
  const cpRawVol = new Tone.Volume();
  const cpRawGen = new CpRaw({
    amp: 2.449, // 2.449: 1.0 (1.2) | 1.0 | 5.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cpRawVol,
  );

  // --- cpReverb
  const cpReverbVol = new Tone.Volume();
  const cpReverbGen = new CpReverb({
    amp: 2.245, // 2.245: 1.0 (1.2) | 1.0 | 4.2
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cpReverbVol,
  );

  // --- toms
  // --- LT
  const lTomVol = new Tone.Volume();
  const lTomGen = new Lt({
    amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
    freq: 86.0, // 86.0: 72.0 | 80.0 | 100.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    lTomVol,
  );
  // --- MT
  const mTomVol = new Tone.Volume();
  const mTomGen = new Mt({
    amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
    freq: 105.0, // 105.0: 78.0 | 120.0 | 132.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    mTomVol,
  );
  // --- HT
  const hTomVol = new Tone.Volume();
  const hTomGen = new Ht({
    amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
    freq: 156.75, // 156.75: 115.5 | 165.0 | 198.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    hTomVol,
  );
  // --- congas
  // --- LC
  const lCngVol = new Tone.Volume();
  const lCngGen = new Lc({
    amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
    freq: 152.625, // 152.625: 115.5 | 165.0 | 189.75
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    lCngVol,
  );

  // --- MC
  const mCngVol = new Tone.Volume();
  const mCngGen = new Mc({
    amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
    freq: 225.0, // 225.0: 175.0 | 250.0 | 275.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    mCngVol,
  );
  // --- HC
  const hCngVol = new Tone.Volume();
  const hCngGen = new Hc({
    amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
    freq: 351.5, // 351.5: 259.0 | 370.0 | 444.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    hCngVol,
  );

  // --- rimshot
  const rimshotVol = new Tone.Volume();
  const rimshotGen = new Rimshot({
    amp: 0.49, // 0.49: 0.2 | 1.0 | 1.2
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    rimshotVol,
  );

  // --- claves
  const clavesVol = new Tone.Volume();
  const clavesGen = new Claves({
    amp: 0.548, // 0.548: 0.2 | 1.0 | 1.5
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    clavesVol,
  );

  // --- maracas
  const maracasVol = new Tone.Volume();
  const maracasGen = new Maracas({
    amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    maracasVol,
  );

  // --- cowbell
  const cowbellVol = new Tone.Volume();
  const cowbellGen = new Cowbell({
    amp: 0.122, // 0.122: 0.05 | 1.0 | 1.0 (0.3?)
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cowbellVol,
  );

  // --- hat
  const closeHatVol = new Tone.Volume();
  const closeHatGen = new Hat({
    decay: 0.42, // 0.42: 0.42 | 0.42 | 0.42 固定値
    amp: 1.025, // 1.025: 0.3 | 1.0 | 3.5
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    closeHatVol,
  );

  // --- openhihat
  const openHatVol = new Tone.Volume();
  const openHatGen = new Openhihat({
    decay: 0.316, // 0.316: 0.01 | 0.5 | 5.0
    amp: 4.899, // 4.899: 4.0 | 4.0 | 6.0
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    openHatVol,
  );
  // --- cymbal
  const cymbalVol = new Tone.Volume();
  const cymbalGen = new Cymbal({
    decay: 1.414, // 1.414: 0.5 | 2.0 | 4.0
    amp: 10.488, // 10.488: 0.5 | 20.0 | 22.0
    tone: 0.001, // 0.001: 0.0002 | 0.002 | 0.005
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cymbalVol,
  );

  // --- seq
  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickGen.triggerAttack(time, ftRand(velocity));
    },
    events: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, 0.8]],
    ],
    subdivision: '1n',
  });

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      snareGen.triggerAttack(time, ftRand(velocity));
    },
    events: [
      [null, 1, null, [1, null, null, 0.45]],
      [null, 1, null, 1],
      [null, [1, null, null, 0.6], null, 1],
      [null, 1, null, 1],
    ],
    subdivision: '1n',
    // humanize: 0.006,
  });
  const cpRawSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpRawGen.triggerAttack(time, ftRand(velocity));
    },
    events: [
      [null, 1],
      [null, 1],
      [null, 1],
      [null, [[1, null, 0.7], null]],
    ],
    subdivision: '1n',
  });
  const cpReverbSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpReverbGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  const lTomSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      lTomGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });
  const mTomSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      mTomGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  const hTomSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hTomGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  const lCngSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      lCngGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  const mCngSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      mCngGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });
  const hCngSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hCngGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  const rimshotSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      rimshotGen.triggerAttack(time, ftRand(velocity));
    },
    events: [
      [null, [1, 1], null, 1],
      [null, [1, 1], [null, 1], 1],
    ],
    subdivision: '1n',
    humanize: 0.006,
  });

  const clavesSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      clavesGen.triggerAttack(time, ftRand(velocity));
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
      maracasGen.triggerAttack(time, ftRand(velocity));
    },
    events: [[null, null, [null, null, 1, 1], null]],
    subdivision: '1n',
    humanize: 0.008,
  });

  const cowbellSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cowbellGen.triggerAttack(time, ftRand(velocity));
    },
    events: [[[[1, [1, 1]]], null, null, null], null],
    subdivision: '1n',
    humanize: 0.006,
  });

  const hihatHandlers = new Map([
    [
      1, // close
      (time, velocity) => {
        openHatGen?.triggerRelease(time);
        closeHatGen.triggerAttack(time, ftRand(velocity));
      },
    ],

    [
      -1, // open
      (time, velocity) => {
        closeHatGen?.triggerRelease(time);
        openHatGen.triggerAttack(time, ftRand(velocity));
      },
    ],
  ]);

  const hihatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hihatHandlers.get(Math.sign(velocity))?.(time, Math.abs(velocity));
    },
    events: [
      [
        [null, 1],
        [null, 1],
        [null, 1],
        [null, 1],
      ],
      [
        [null, 1],
        [null, 1],
        [null, 1],
        [null, 1],
      ],
      [
        [null, 1],
        [null, 1],
        [null, 1],
        [null, 1],
      ],
      [
        [null, 1],
        [null, 1],
        [null, 1],
        [-1, 1],
      ],
    ],
    subdivision: '1n',
    humanize: 0.006,
  });

  const cymbalSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cymbalGen.triggerAttack(time, ftRand(velocity));
    },
    events: [1],
    subdivision: '4m',
  });

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    kickSeq.start(0);
    snareSeq.start(0);
    cpRawSeq.start(0);
    cpReverbSeq.start(0);
    lTomSeq.start(0);
    mTomSeq.start(0);
    hTomSeq.start(0);
    lCngSeq.start(0);
    mCngSeq.start(0);
    hCngSeq.start(0);
    rimshotSeq.start(0);
    clavesSeq.start(0);
    maracasSeq.start(0);
    cowbellSeq.start(0);
    hihatSeq.start(0);
    cymbalSeq.start(0);

    // --- transport.start
    transport.start();
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

  const snareCh = toChannel(snareVol, {
    volume: 2.0,
    pan: -0.1,
    channelCount: 1,
  });
  const cpRawCh = toChannel(cpRawVol, {
    volume: -2.0,
    pan: 0.0,
    channelCount: 1,
  });
  const cpReverbCh = toChannel(cpReverbVol, {
    volume: 0.0, // 30 とかでやっと
    pan: 0.0,
    channelCount: 1,
  });
  // tom
  const lTomCh = toChannel(lTomVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const mTomCh = toChannel(mTomVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const hTomCh = toChannel(hTomVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });

  // cng
  const lCngCh = toChannel(lCngVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const mCngCh = toChannel(mCngVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const hCngCh = toChannel(hCngVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });

  const rimshotCh = toChannel(rimshotVol, {
    volume: 0.0,
    pan: -0.1,
    channelCount: 1,
  });
  const clavesCh = toChannel(clavesVol, {
    volume: 4.0,
    pan: 0.0,
    channelCount: 1,
  });
  const maracasCh = toChannel(maracasVol, {
    volume: 4.0,
    pan: -0.2,
    channelCount: 1,
  });
  const cowbellCh = toChannel(cowbellVol, {
    volume: -6.0,
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
  const cymbalCh = toChannel(cymbalVol, {
    volume: 4.0,
    pan: -0.4,
    channelCount: 1,
  });

  const drumKitLowpass = new Tone.Filter({
    type: 'lowpass',
    // type: 'highpass',
    frequency: 8200,
    Q: 0.1,
    rolloff: -24, // -12, -24, -48, -96
  });
  const drumKitVol = new Tone.Volume();
  const drumKitCh = new Tone.Channel({ volume: 2, channelCount: 2 });
  drumKitCh
    .chain(
      ...[
        //
        new Tone.Volume(-6),
        drumKitLowpass,
        // new Tone.Gain(1.55),
        new Tone.Limiter(-6),
        new Tone.Volume(3),
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
      ].filter((n) => n),
      Tone.getDestination(),
    ),
  );

  // p.setup = async () => {
  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    emitter.emit('startOnceCallSeqs');
    // transport.start();

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

