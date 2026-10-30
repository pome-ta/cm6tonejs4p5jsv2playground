/*
const WORKLET_URL = new URL(
  './combined-processor.worklet.js',
  import.meta.url,
);
let loadPromise = null;

export function loadWorklet(context) {
  if (!loadPromise) {
    loadPromise = context.addAudioWorkletModule(WORKLET_URL);
  }
  return loadPromise;
}
*/

const WORKLET_URL = new URL(
  './combined-processor.worklet.js',
  import.meta.url,
);
const loadPromises = new WeakMap(); // BaseContext -> Promise<void>

export function loadWorklet(context) {
  let p = loadPromises.get(context);
  if (!p) {
    p = context.addAudioWorkletModule(WORKLET_URL.href);
    loadPromises.set(context, p);
  }
  return p;
}
