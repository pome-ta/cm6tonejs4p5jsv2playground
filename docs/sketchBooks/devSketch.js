// --- # example: 808 ?
import * as Tone from 'tone';
import {
  Bd,
  Sn,
  CpRaw,
  CpReverb,
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

const BPM = 100;

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
    decay: 58.0,
    amp: 1.449,
    tone: 50.0,

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
    amp: 1.118,
    tone: 300.9,
    tone2: 167.265,
    snappy: 0.226,
    amp2: 0.775,
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
    amp: 2.449,
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
    amp: 2.245,
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cpReverbVol,
  );

  // --- rimshot
  const rimshotVol = new Tone.Volume();
  const rimshotGen = new Rimshot({
    amp: 0.49,
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
    amp: 0.548,
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
    amp: 0.387,
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
    amp: 0.122,
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
    decay: 0.42,
    amp: 1.025,
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
    decay: 0.316,
    amp: 4.899,
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
    decay: 1.414,
    amp: 10.488,
    tone: 0.001,
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
    events: [[1, null, [1, 1], 1]],
    subdivision: '1n',
  });

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      if (time < 10) {
        console.log('sequence callback', time, velocity);
      }

      snareGen.triggerAttack(time, ftRand(velocity));
    },
    events: [[null, 1, null, 1]],
    subdivision: '1n',
  });
  const cpRawSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpRawGen.triggerAttack(time, ftRand(velocity));
    },
    events: [[1, null, [1, 1], 1]],
    subdivision: '1n',
  });

  const cpReverbSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpReverbGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });
  const rimshotSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      rimshotGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  const clavesSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      clavesGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  const maracasSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      maracasGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
    humanize: 0.006,
  });

  const cowbellSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cowbellGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
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
    events: [],
    subdivision: '1n',
    humanize: 0.006,
  });

  const cymbalSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cymbalGen.triggerAttack(time, ftRand(velocity));
    },
    events: [],
    subdivision: '1n',
  });

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    //kickSeq.start(0);
    snareSeq.start(0);
    cpRawSeq.start(0);
    // cpReverbSeq.start(0);
    // rimshotSeq.start(0);
    // clavesSeq.start(0);
    // maracasSeq.start(0);
    // cowbellSeq.start(0);
    // hihatSeq.start(0);
    // cymbalSeq.start(0);

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
    volume: 0.0,
    pan: -0.1,
    channelCount: 1,
  });
  const cpRawCh = toChannel(cpRawVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const cpReverbCh = toChannel(cpReverbVol, {
    volume: 0.0, // 30 とかでやっと
    pan: 0.0,
    channelCount: 1,
  });
  const rimshotCh = toChannel(rimshotVol, {
    volume: 0.0,
    pan: -0.1,
    channelCount: 1,
  });
  const clavesCh = toChannel(clavesVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const maracasCh = toChannel(maracasVol, {
    volume: 0.0,
    pan: 0.0,
    channelCount: 1,
  });
  const cowbellCh = toChannel(cowbellVol, {
    volume: 0.0,
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

  // p.setup = async () => {
  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

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
