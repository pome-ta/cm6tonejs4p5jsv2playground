// --- # example: 808 ?
import * as Tone from 'tone';
import { DrumKit } from 'modules/tr808scWorklet/drumKit.js';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 125;

const CTX = new window.AudioContext();
const TCTX = Tone.getContext();
console.log(CTX);
console.log(TCTX);

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

/**
 * 16進数のシーケンスをデコードし、`4×4` の二次元配列に変換
 * 16ビットではなく 64ビット(16桁の 16進数)を対象とし、
 * 4ビットごとに値を抽出してデコード。
 * 抽出値が `0` の場合 :`null`
 * それ以外の場合: `9` で除算
 *
 * `0x9000_9000_8000_900An.` のように 、
 * `n` サフィックスを付けた `BigInt` リテラルを想定
 *
 * @param {bigint} `seq` デコード対象の 16進数シーケンス
 * @returns {number[][]} デコード結果の `4×4` 二次元配列
 */
const decodeSeq = (seq) => {
  return Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const i = row * 4 + col;
      const shift = BigInt((15 - i) * 4);
      const value = Number((seq >> shift) & 0xfn);
      const deco = value === 0 ? null : value / 9;
      return deco;
    }),
  );
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

  // --- drumKit
  const createSequenceStore = (instrumentStore) => {
    const _default = (inst) => {
      const _seq = new Tone.Sequence({
        callback: (time, velocity) => {
          inst.gen.triggerAttack(time, ftRand(velocity));
        },
        events: [],
        subdivision: '1n',
        humanize: 0.0,
        probability: 1.0,
      });
      return _seq;
    };

    const _closeHat = (instStore) => {
      const _seq = new Tone.Sequence({
        callback: (time, velocity) => {
          instStore.oh.gen?.triggerRelease(time);
          instStore.ch.gen.triggerAttack(
            time,
            ftRand(velocity),
          );
        },
        events: [],
        subdivision: '1n',
        humanize: 0.0,
        probability: 1.0,
      });
      return _seq;
    };

    const _openHat = (instStore) => {
      const _seq = new Tone.Sequence({
        callback: (time, velocity) => {
          instStore.ch.gen?.triggerRelease(time);
          instStore.oh.gen.triggerAttack(
            time,
            ftRand(velocity),
          );
        },
        events: [],
        subdivision: '1n',
        humanize: 0.0,
        probability: 1.0,
      });
      return _seq;
    };

    const _handlers = {
      ch: _closeHat,
      oh: _openHat,
    };

    const _store = Object.fromEntries(
      Object.entries(instrumentStore).map(
        ([keyName, instrument]) => {
          const seq = Object.hasOwn(_handlers, keyName)
            ? _handlers[keyName](instrumentStore)
            : _default(instrument);
          return [keyName, seq];
        },
      ),
    );

    return _store;
  };

  const bdComp = new Tone.Compressor({
    threshold: -8, // -100-0 : -24
    ratio: 8, // 1-20 : 12
    attack: 1e-1,
    release: 1e-1,
    knee: 8, // 0-40 : 30
  });

  const snComp = new Tone.Compressor({
    threshold: -12, // -100-0 : -24
    ratio: 16, // 1-20 : 12
    attack: 1e-2,
    release: 1e-4,
    knee: 20, // 0-40 : 30
  });

  const closeHatLowpass = new Tone.Filter({
    type: 'lowpass',
    // type: 'highpass',
    frequency: 8600,
    Q: 0.1,
    rolloff: -24, // -12, -24, -48, -96
  });
  const openHatLowpass = new Tone.Filter({
    type: 'lowpass',
    // type: 'highpass',
    frequency: 8000,
    Q: 0.1,
    rolloff: -24, // -12, -24, -48, -96
  });
  const instrumentOptions = {
    bd: {
      channel: { volume: -1.0, pan: 0.0, channelCount: 1 },
      params: {
        decay: 8.0, // 58.0: 6.0 | 30.0 | 110.0
        amp: 1.849, // 1.449: 1.0 | 2.0 | 2.1
        tone: 50.0, // 50.0: 50.0 | 56.0 | 70.0
      },
      effects: [
        //
        bdComp,
      ],
    },
    sn: {
      channel: { volume: 2.0, pan: -0.1, channelCount: 1 },
      params: {
        amp: 1.118, // 1.118: 0.5 | 2.0 | 2.5
        tone: 210.8, // 300.9: 210.8 | 340.0 | 391.0
        tone2: 167.265, // 167.265: 117.18 | 189.0 | 217.35
        snappy: 0.226, // 0.226: 0.002 | 0.3 | 0.45
        amp2: 0.775, // 0.775: 0.6 | 1.0 | 1.0
      },
      effects: [
        //
        snComp,
      ],
    },
    cp: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 2.449, // 2.449: 1.0 (1.2) | 1.0 | 5.0
      },
      effects: [],
    },
    cr: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 2.245, // 2.245: 1.0 (1.2) | 1.0 | 4.2
      },
      effects: [],
    },
    lt: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
        freq: 86.0, // 86.0: 72.0 | 80.0 | 100.0
      },
      effects: [],
    },
    mt: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
        freq: 105.0, // 105.0: 78.0 | 120.0 | 132.0
      },
      effects: [],
    },
    ht: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
        freq: 156.75, // 156.75: 115.5 | 165.0 | 198.0
      },
      effects: [],
    },
    lc: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
        freq: 152.625, // 152.625: 115.5 | 165.0 | 189.75
      },
      effects: [],
    },
    mc: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
        freq: 225.0, // 225.0: 175.0 | 250.0 | 275.0
      },
      effects: [],
    },
    hc: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
        freq: 351.5, // 351.5: 259.0 | 370.0 | 444.0
      },
      effects: [],
    },
    rs: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.49, // 0.49: 0.2 | 1.0 | 1.2
      },
      effects: [],
    },
    cl: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.548, // 0.548: 0.2 | 1.0 | 1.5
      },
      effects: [],
    },
    ma: {
      channel: { volume: 0.0, pan: -0.25, channelCount: 1 },
      params: {
        amp: 0.387, // 0.387: 0.1 | 1.0 | 1.5
      },
      effects: [],
    },
    cb: {
      channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
      params: {
        amp: 0.122, // 0.122: 0.05 | 1.0 | 1.0 (0.3?)
      },
      effects: [],
    },
    ch: {
      channel: { volume: 0.0, pan: 0.125, channelCount: 1 },
      params: {
        decay: 0.42, // 0.42: 0.42 | 0.42 | 0.42 固定値
        amp: 1.025, // 1.025: 0.3 | 1.0 | 3.5
      },
      effects: [
        //
        closeHatLowpass,
      ],
    },
    oh: {
      channel: { volume: -0.5, pan: 0.125, channelCount: 1 },
      params: {
        decay: 0.316, // 0.316: 0.01 | 0.5 | 5.0
        amp: 4.899, // 4.899: 4.0 | 4.0 | 6.0
      },
      effects: [
        //
        openHatLowpass,
      ],
    },
    cy: {
      channel: { volume: 0.0, pan: -0.5, channelCount: 1 },
      params: {
        decay: 1.414, // 1.414: 0.5 | 2.0 | 4.0
        amp: 10.488, // 10.488: 0.5 | 20.0 | 22.0
        tone: 0.001, // 0.001: 0.0002 | 0.002 | 0.005
      },
      effects: [
        //
        //new Tone.BitCrusher({ context: toneCtx }),
      ],
    },
  };

  const drumKit = new DrumKit(instrumentOptions, toneCtx);
  //const drumKit = new DrumKit(instrumentOptions, TCTX);
  const seqEvents = {
    bd: [
      decodeSeq(0x9000_9000_9000_9000n),
      decodeSeq(0x9000_9000_9000_9001n),
      decodeSeq(0x9000_9000_9000_9000n),
      decodeSeq(0x9000_9000_9000_9050n),
    ],
    sn: [
      decodeSeq(0x0000_9000_0000_9000n),
      decodeSeq(0x0000_9000_0001_9000n),
      decodeSeq(0x0000_9002_0000_9000n),
      decodeSeq(0x0100_9000_0100_9000n),
    ],
    cp: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    cr: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    lt: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    mt: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    ht: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    lc: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    mc: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    hc: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    rs: [
      decodeSeq(0x0000_9000_0000_9000n), // prettier-ignore
    ],
    cl: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    ma: [
      decodeSeq(0x0660_0000_0660_0000n),
      // decodeSeq(0x0005_0620_0000_0000n),
    ],
    cb: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    ch: [
      decodeSeq(0x0080_0080_0070_0090n),
      decodeSeq(0x0080_0070_0080_0001n),
      decodeSeq(0x0080_0080_0070_0080n),
      decodeSeq(0x0080_0070_0080_0080n),
    ],
    oh: [
      decodeSeq(0x0000_0000_0000_0000n),
      decodeSeq(0x0000_0000_0000_0050n),
      decodeSeq(0x0000_0000_0000_0000n),
      decodeSeq(0x0000_0000_0000_0000n),
    ],
    cy: [
      decodeSeq(0x9000_0000_0000_0000n),
      null,
      null,
      null,
      null,
      null,
      null,
      null, // prettier-ignore
    ],
  };

  const callSeqStore = {
    bd: true,
    sn: true,
    cp: true,
    cr: true,
    lt: true,
    mt: true,
    ht: true,
    lc: true,
    mc: true,
    hc: true,
    // rs: true,
    cl: true,
    ma: true,
    cb: true,
    ch: true,
    oh: true,
    cy: true,
  };

  const seqHumanizes = {
    // bd: 0.5,
    ma: 0.005,
    ch: 0.004,
    // oh: 0.5,
  };

  const seqStore = createSequenceStore(drumKit.instrumentStore);
  // events set
  Object.entries(seqEvents).map(([key, events]) => {
    seqStore[key] && (seqStore[key].events = events);
  });
  // events humanize
  Object.entries(seqHumanizes).map(([key, humanize]) => {
    seqStore[key] && (seqStore[key].humanize = humanize);
  });

  const drumKitBusName = 'drums';
  Object.entries(drumKit.instrumentStore).map(
    ([_, instrument]) => {
      instrument.chNode.send(drumKitBusName);
    },
  );

  const drumKitVol = new Tone.Volume();
  const drumKitCh = new Tone.Channel({
    volume: 0.0,
    channelCount: 2,
  });
  drumKitCh
    .chain(
      ...[
        //
        new Tone.Volume(-6),
        // new Tone.Limiter(-6),
        // // new Tone.Gain(1.55),
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

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    Object.entries(callSeqStore).map(([key, isCall]) => {
      isCall && seqStore[key]?.start(0);
    });
    // --- transport.start
    transport.start();
  });

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
