import { BDProcessor } from './bd-processor.worklet.js';
import { SNProcessor } from './sn-processor.worklet.js';
import { HATProcessor } from './hat-processor.worklet.js';

registerProcessor('bd-processor', BDProcessor);
registerProcessor('sn-processor', SNProcessor);
registerProcessor('hat-processor', HATProcessor);
