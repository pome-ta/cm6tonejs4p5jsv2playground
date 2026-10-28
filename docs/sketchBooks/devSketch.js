// --- # example: 808 ?
import * as Tone from 'tone';
import {
  DrumKit,
  decodeSeq,
} from 'modules/tr808scWorklet/drumKit.js';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 110;

/**
 * 指定した基準値を中心にランダムな値を生成する。
 * @param {number} bias - 基準値(通常は 0.0〜1.0)
 * @param {number} [spread=0.5] - ランダムな変動幅の係数
 * @returns {number} 生成されたランダム値
 */
const ftRand = (bias, spread = 0.5) => {
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
  document.addEventListener(
    'pointerup',
    async () => await Tone.start(),
    {
      once: true,
    },
  );
  const transport = Tone.getTransport();
  transport.bpm.value = BPM;

  const emitter = new Tone.Emitter();

  const drumKit = new DrumKit({}, {}, toneCtx);

  const nonEvent = decodeSeq(0x0000_0000_0000_0000n);
  const seqDefault = (instrument) => {
    const seq = new Tone.Sequence({
      callback: (time, velocity) => {
        instrument.gen.triggerAttack(time, ftRand(velocity));
      },
      events: [nonEvent],
      subdivision: '1n',
      humanize: 0.0,
    });
    return seq;
  };

  const seqCloseHihat = (instStore) => {
    const closeGen = instStore.ch.gen;
    const openGen = instStore.oh.gen;
    const seq = new Tone.Sequence({
      callback: (time, velocity) => {
        openGen?.triggerRelease(time);
        closeGen.triggerAttack(time, ftRand(velocity));
      },
      events: [nonEvent],
      subdivision: '1n',
      humanize: 0.0,
    });
    return seq;
  };

  const seqOpenHihat = (instStore) => {
    const openGen = instStore.oh.gen;
    const closeGen = instStore.ch.gen;
    const seq = new Tone.Sequence({
      callback: (time, velocity) => {
        closeGen?.triggerRelease(time);
        openGen.triggerAttack(time, ftRand(velocity));
      },
      events: [nonEvent],
      subdivision: '1n',
      humanize: 0.0,
    });
    return seq;
  };

  const hatHandlers = {
    ch: seqCloseHihat,
    oh: seqOpenHihat,
  };
  const seqStore = Object.fromEntries(
    Object.entries(drumKit.instStore).map(
      ([keyName, instrument]) => {
        const seq = Object.hasOwn(hatHandlers, keyName)
          ? hatHandlers[keyName](drumKit.instStore)
          : seqDefault(instrument);
        return [keyName, seq];
      },
    ),
  );

  const seqEvents = {
    bd: [
      decodeSeq(0x9000_9000_9000_9070n),
      decodeSeq(0x9000_0000_0000_0000n),
    ],
    sn: [decodeSeq(0x0000_9000_0000_9000n)],
    cp: [
      ...[
        decodeSeq(0x0900_0000_0000_0000n),
        decodeSeq(0x9000_9000_9000_9070n),
        decodeSeq(0x0900_0000_0000_0000n),
        null,
      ].filter((e) => e),
    ],
    cr: [decodeSeq(0x0000_0000_0000_0000n)],
    lt: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],

    mt: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    ht: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    lc: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    mc: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    hc: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    rs: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    cl: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    ma: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    cb: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    ch: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    oh: [
      //
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    cy: [
      decodeSeq(0x9000_0000_0000_0000n),
      decodeSeq(0x0000_0000_0000_0000n),
      decodeSeq(0x0000_0000_0000_0000n),
      decodeSeq(0x0000_0000_0000_0000n),
    ],
  };

  // events set
  Object.entries(seqEvents).map(([key, events]) => {
    seqStore[key].events = events;
  });

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    Object.entries(seqEvents).map(([key, _]) => {
      seqStore[key].start(0);
    });
    // --- transport.start
    transport.start();
  });

  // --- drumKit
  const drumKitBusName = 'drums';

  Object.entries(drumKit.instStore).map(([key, instrument]) => {
    instrument.chNode.send(drumKitBusName);
  });

  const drumKitLowpass = new Tone.Filter({
    type: 'lowpass',
    // type: 'highpass',
    frequency: 8200,
    Q: 0.1,
    rolloff: -24, // -12, -24, -48, -96
  });
  const drumKitVol = new Tone.Volume();
  const drumKitCh = new Tone.Channel({
    volume: 2,
    channelCount: 2,
  });
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
