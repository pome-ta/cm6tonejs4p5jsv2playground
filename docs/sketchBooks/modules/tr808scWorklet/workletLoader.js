const WORKLET_URL = new URL(
  './combined-processor.worklet.js',
  import.meta.url,
);

const loadPromises = new WeakMap(); // rawContext -> Promise

export function loadWorklet(context) {
  const raw = context.rawContext;
  let p = loadPromises.get(raw);
  if (!p) {
    p = raw.audioWorklet.addModule(WORKLET_URL.href);
    loadPromises.set(raw, p);
  }
  return p;
}
