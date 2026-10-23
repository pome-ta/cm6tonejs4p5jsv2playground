import { BDProcessor } from './bd-processor.worklet.js';
import { SNProcessor } from './sn-processor.worklet.js';
import { CpRawProcessor } from './cpRaw-processor.worklet.js';
import { HATProcessor } from './hat-processor.worklet.js';
import { OHProcessor } from './openhihat-processor.worklet.js';

registerProcessor('bd-processor', BDProcessor);
registerProcessor('sn-processor', SNProcessor);
registerProcessor('cpRaw-processor', CpRawProcessor);
registerProcessor('hat-processor', HATProcessor);
registerProcessor('openhihat-processor', OHProcessor);
