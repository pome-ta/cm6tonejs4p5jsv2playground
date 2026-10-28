// --- # example: 808 ?
import * as Tone from 'tone';
import { DrumKit } from 'modules/tr808scWorklet/drumKit.js';

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
    const _non = decodeSeq(0x0000_0000_0000_0000n);

    const _default = (inst) => {
      const seq = new Tone.Sequence({
        callback: (time, velocity) => {
          inst.gen.triggerAttack(time, ftRand(velocity));
        },
        events: [_non],
        subdivision: '1n',
        humanize: 0.0,
      });
      return seq;
    };

    const _closeHat = (instStore) => {
      const closeGen = instStore.ch.gen;
      const openGen = instStore.oh.gen;
      const seq = new Tone.Sequence({
        callback: (time, velocity) => {
          openGen?.triggerRelease(time);
          closeGen.triggerAttack(time, ftRand(velocity));
        },
        events: [_non],
        subdivision: '1n',
        humanize: 0.0,
      });
      return seq;
    };

    const _openHat = (instStore) => {
      const openGen = instStore.oh.gen;
      const closeGen = instStore.ch.gen;
      const seq = new Tone.Sequence({
        callback: (time, velocity) => {
          closeGen?.triggerRelease(time);
          openGen.triggerAttack(time, ftRand(velocity));
        },
        events: [_non],
        subdivision: '1n',
        humanize: 0.0,
      });
      return seq;
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

  const drumKit = new DrumKit({}, toneCtx);
  const seqStore = createSequenceStore(drumKit.instrumentStore);

  const seqEvents = {
    bd: [
      decodeSeq(0x9000_9000_9000_9000n),
      decodeSeq(0x9000_9000_9000_9000n),
      decodeSeq(0x9000_9000_9000_9000n),
      decodeSeq(0x9000_9000_9000_9070n),
    ],
    sn: [
      decodeSeq(0x0000_9000_0000_9000n),
      decodeSeq(0x0000_9000_0000_9000n),
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
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    cl: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    ma: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    cb: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    ch: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
    ],
    oh: [
      decodeSeq(0x0000_0000_0000_0000n), // prettier-ignore
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

  const drumKitBusName = 'drums';

  Object.entries(drumKit.instrumentStore).map(
    ([key, instrument]) => {
      instrument.chNode.send(drumKitBusName);
    },
  );

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

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    Object.entries(seqEvents).map(([key, _]) => {
      seqStore[key].start(0);
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
