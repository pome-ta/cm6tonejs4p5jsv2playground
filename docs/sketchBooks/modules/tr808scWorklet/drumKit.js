import * as Tone from 'tone';

import Bd from './bd.js';
import Sn from './sn.js';
import CpRaw from './cpRaw.js';
import CpReverb from './cpReverb.js';

import { Lt, Mt, Ht } from './toms.js';
import { Lc, Mc, Hc } from './congas.js';

import Rimshot from './rimshot.js';
import Claves from './claves.js';
import Maracas from './maracas.js';
import Cowbell from './cowbell.js';
import Hat from './hat.js';
import Openhihat from './openhihat.js';
import Cymbal from './cymbal.js';


const classStore = {
  bd: Bd,
  sn: Sn,
  cp: CpRaw,
  cr: CpReverb,
  lt: Lt,
  mt: Mt,
  ht: Ht,
  lc: Lc,
  mc: Mc,
  hc: Hc,
  rs: Rimshot,
  cl: Claves,
  ma: Maracas,
  cb: Cowbell,
  ch: Hat,
  oh: Openhihat,
  cy: Cymbal,
};



const instrumentDefaultOptions = {
  bd: {
    channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
    params: {
      decay: 58.0, // 58.0: 6.0 | 30.0 | 110.0
      amp: 1.449, // 1.449: 1.0 | 2.0 | 2.1
      tone: 50.0, // 50.0: 50.0 | 56.0 | 70.0
    },
    effects: [],
  },
  sn: {
    channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
    params: {
      amp: 1.118, // 1.118: 0.5 | 2.0 | 2.5
      tone: 300.9, // 300.9: 210.8 | 340.0 | 391.0
      tone2: 167.265, // 167.265: 117.18 | 189.0 | 217.35
      snappy: 0.226, // 0.226: 0.002 | 0.3 | 0.45
      amp2: 0.775, // 0.775: 0.6 | 1.0 | 1.0
    },
    effects: [],
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
    channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
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
    channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
    params: {
      decay: 0.42, // 0.42: 0.42 | 0.42 | 0.42 固定値
      amp: 1.025, // 1.025: 0.3 | 1.0 | 3.5
    },
    effects: [],
  },
  oh: {
    channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
    params: {
      decay: 0.316, // 0.316: 0.01 | 0.5 | 5.0
      amp: 4.899, // 4.899: 4.0 | 4.0 | 6.0
    },
    effects: [],
  },
  cy: {
    channel: { volume: 0.0, pan: 0.0, channelCount: 1 },
    params: {
      decay: 1.414, // 1.414: 0.5 | 2.0 | 4.0
      amp: 10.488, // 10.488: 0.5 | 20.0 | 22.0
      tone: 0.001, // 0.001: 0.0002 | 0.002 | 0.005
    },
    effects: [],
  },
};


function getMergedOptions(instrumentType, customOptions = {}) {
  const defaultOpts = instrumentDefaultOptions[instrumentType];
  if (!defaultOpts) {
    return customOptions;
  }

  return {
    ...defaultOpts,
    ...customOptions,
    channel: {
      ...defaultOpts.channel,
      ...(customOptions.channel || {}),
    },
    params: {
      ...defaultOpts.params,
      ...(customOptions.params || {}),
    },
    effects: customOptions.effects || defaultOpts.effects,
  };
}

class Instrument {
  #name;
  #gen;
  #volNode;
  #chNode;
  constructor(targetClass, name, chParams, options, effects) {
    this.#name = String(name);
    this.#volNode = new Tone.Volume();
    this.#gen = new targetClass(options).chain(...[...effects].filter((n) => n), this.#volNode);
    this.#chNode = new Tone.Channel(chParams);
    this.#volNode.connect(this.#chNode);
  }

  get name() {
    return this.#name;
  }
  get gen() {
    return this.#gen;
  }
  get volNode() {
    return this.#volNode;
  }
  get chNode() {
    return this.#chNode;
  }
}

export class DrumKit {
  constructor(instrumentOptions, context = null) {
    this.instrumentStore = Object.fromEntries(
      Object.entries(classStore).map(([keyName, targetClass]) => {
        const opts = getMergedOptions(keyName, instrumentOptions[keyName] || {});
        const instrument = new Instrument(
          targetClass,
          keyName,
          opts.channel,
          { ...opts.params, context },
          opts.effects,
        );

        this[keyName] = instrument;
        return [keyName, instrument];
      }),
    );
  }
}

export { Bd, Sn, CpRaw, CpReverb, Lt, Mt, Ht, Lc, Mc, Hc, Rimshot, Claves, Maracas, Cowbell, Hat, Openhihat, Cymbal };
