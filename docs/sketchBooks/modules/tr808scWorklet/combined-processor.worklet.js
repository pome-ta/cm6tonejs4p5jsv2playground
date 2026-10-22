import { BDProcessor } from './bd-processor.worklet.js';
import { SNProcessor } from './sn-processor.worklet.js';

registerProcessor('bd-processor', BDProcessor);
registerProcessor('sn-processor', SNProcessor);
