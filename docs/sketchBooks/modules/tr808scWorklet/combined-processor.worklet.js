import BbProcessor from './bd-processor.worklet.js';
import SnProcessor from './sn-processor.worklet.js';
import CpRawProcessor from './cpRaw-processor.worklet.js';
import CpReverbProcessor from './cpReverb-processor.worklet.js';
import HatProcessor from './hat-processor.worklet.js';
import OpenhihatProcessor from './openhihat-processor.worklet.js';

registerProcessor('bd-processor', BbProcessor);
registerProcessor('sn-processor', SnProcessor);
registerProcessor('cpRaw-processor', CpRawProcessor);
registerProcessor('cpReverb-processor', CpReverbProcessor);
registerProcessor('hat-processor', HatProcessor);
registerProcessor('openhihat-processor', OpenhihatProcessor);
