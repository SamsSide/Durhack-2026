// B8: the world version for panels and readouts, at most four times a second.
//
// The store's `version` bumps on every batch of events: about 13 times a second at the top gear. A panel
// that subscribes to it re-renders that often, which no reader can follow and which costs frames on the
// globe. Panels read this instead: the first change is passed on at once (so at slow gears nothing is
// later than before), then at most one every GAP ms, and the last change is never dropped. All panels
// share one clock, so they update together in one render.
import { useSyncExternalStore } from 'react';
import { useWorld } from '../state/world';

const GAP = 250;

let slow = useWorld.getState().version;
let lastAt = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

function flush(): void {
  if (timer != null) { window.clearTimeout(timer); timer = null; }
  lastAt = performance.now();
  const v = useWorld.getState().version;
  if (v === slow) return;
  slow = v;
  for (const fn of [...listeners]) fn();
}

useWorld.subscribe((s, prev) => {
  if (s.world !== prev.world) { flush(); return; }   // another world: straight away
  if (s.version === prev.version || timer != null) return;
  const wait = GAP - (performance.now() - lastAt);
  if (wait <= 0) flush();
  else timer = window.setTimeout(flush, wait);
});

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
const read = (): number => slow;

/** `useWorld((s) => s.version)`, but it changes at most four times a second. For readouts, not for the globe. */
export function useSlowVersion(): number {
  return useSyncExternalStore(subscribe, read);
}
