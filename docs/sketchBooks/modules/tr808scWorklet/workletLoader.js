const WORKLET_URL = new URL('./combined-processor.worklet.js', import.meta.url);
let loadPromise = null;

export function loadWorklet(context) {
  if (!loadPromise) {
    loadPromise = context.addAudioWorkletModule(WORKLET_URL);
  }
  return loadPromise;
}
