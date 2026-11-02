import * as Tone from 'tone';

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
        instStore.ch.gen.triggerAttack(time, ftRand(velocity));
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
        instStore.oh.gen.triggerAttack(time, ftRand(velocity));
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

export { ftRand, decodeSeq, createSequenceStore };
