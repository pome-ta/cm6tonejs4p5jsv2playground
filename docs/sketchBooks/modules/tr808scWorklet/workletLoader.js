
const WORKLET_URL = new URL(
  './combined-processor.worklet.js',
  import.meta.url,
);

/*
let loadPromise = null;

export function loadWorklet(context) {
  if (!loadPromise) {
    loadPromise = context.addAudioWorkletModule(WORKLET_URL);
  }
  return loadPromise;
}
*/

/*
const WORKLET_URL = new URL(
  './combined-processor.worklet.js',
  import.meta.url,
);
*/
console.log(WORKLET_URL);
const loadPromises = new WeakMap(); // BaseContext -> Promise<void>

//export function loadWorklet(context) {
export async function loadWorklet(context) {
  console.log('loadWorklet call');
  console.log(loadPromises);
  let p = loadPromises.get(context);
  console.log(p);
  if (!p) {
    console.log('loadWorklet bool');
    p = context.addAudioWorkletModule(WORKLET_URL.href);
    //p = context.addAudioWorkletModule(WORKLET_URL);
    //p = await context.addAudioWorkletModule(WORKLET_URL.href);
    //p = await context.addAudioWorkletModule(WORKLET_URL);
    console.log(p);
    loadPromises.set(context, p);
  }
  console.log(loadPromises);
  console.log(p);
  return p;
}
