// C12: what the viewer has done with the Prepare panel (hidden to the pill, pressed Play), and the
// dev-only local mock of the X2 `prepare` message (`?mockPrepare=1`).
import { create } from 'zustand';
import { useWorld } from '../../state/world';
import type { PrepareItem, PrepareStatus } from '../../state/world';

interface PrepareUi { hidden: boolean; played: boolean; hide(): void; show(): void; play(): void }

export const usePrepareUi = create<PrepareUi>((set) => ({
  hidden: false,
  played: false,
  hide: () => set({ hidden: true }),
  show: () => set({ hidden: false }),
  /** Start the world now; anything unfinished carries on in the background (X2 Prepare). */
  play: () => {
    set({ played: true, hidden: false });
    useWorld.getState().send({ type: 'control', action: 'pause', value: false });
  },
}));

export const isPaused = (s: { clock: { paused: boolean } | null; world: { paused: boolean } | null }): boolean => s.clock?.paused ?? s.world?.paused ?? false;

useWorld.subscribe((s, prev) => {
  const p = s.prepare;
  const q = prev.prepare;
  // A new run (first message, another world, or a run after a finished one) opens the panel again.
  if (p && p !== q && !p.done && (!q || q.done || q.worldId !== p.worldId)) usePrepareUi.setState({ hidden: false, played: false });
  // The world was started some other way (the top bar's pause button): same as pressing Play.
  else if (p && isPaused(prev) && !isPaused(s)) usePrepareUi.setState({ played: true });
});

/** Ask the server to prepare the running world (X2 `prepare` control). */
export function requestPrepare(): void {
  useWorld.getState().send({ type: 'control', action: 'prepare' });
  if (mockPrepareOn()) startMockPrepare();
}

// ---- dev-only mock: stands in for the server's `prepare` messages until it sends them ----

const KINDS: PrepareItem['kind'][] = ['lore', 'narration', 'chant', 'anthem', 'ruler'];
const MOCK_ANTHEMS = 3;      // stands in for ANTHEM_MAX_PER_RUN
let mockTimer: number | undefined;
let mockOnNextWorld = false;

export function mockPrepareOn(): boolean {
  return import.meta.env.DEV && new URLSearchParams(location.search).has('mockPrepare');
}

/** The Create screen asked for `prepare: true`: with the mock on, run it when that world arrives. */
export function expectPreparedWorld(): void {
  if (mockPrepareOn()) mockOnNextWorld = true;
}
useWorld.subscribe((s, prev) => {
  if (mockOnNextWorld && s.world && s.world.id !== prev.world?.id) { mockOnNextWorld = false; window.setTimeout(startMockPrepare, 0); }
});

function stopMock(): void {
  window.clearInterval(mockTimer);
  mockTimer = undefined;
}

/** Simulated progress over about five seconds; `?mockPrepare=slow` takes about forty. */
export function startMockPrepare(): void {
  const w = useWorld.getState().world;
  if (!w || !mockPrepareOn()) return;
  window.clearInterval(mockTimer);
  const slow = new URLSearchParams(location.search).get('mockPrepare') === 'slow';
  const nations = w.countries.filter((c) => c.alive);
  const items: PrepareItem[] = [];
  nations.forEach((c, n) => {
    for (const kind of KINDS) {
      if (kind === 'anthem' && n >= MOCK_ANTHEMS) continue;
      items.push({ kind, countryId: c.id, status: 'pending' });
    }
  });
  const failAt = items.findIndex((it) => it.kind === 'chant' && it.countryId === nations[nations.length - 1]?.id);
  const publish = (done: boolean) => {
    const status: PrepareStatus = { worldId: w.id, done, ready: items.filter((it) => it.status === 'ready').length, total: items.length, items: items.map((it) => ({ ...it })) };
    useWorld.setState({ prepare: status });
  };
  useWorld.getState().send({ type: 'control', action: 'pause', value: true });
  publish(false);
  let step = 0;
  mockTimer = window.setInterval(() => {
    if (useWorld.getState().world?.id !== w.id) { stopMock(); return; }
    step += 1;
    // Each beat: finish what was working, start the next few.
    items.forEach((it, i) => { if (it.status === 'working') it.status = i === failAt ? 'failed' : 'ready'; });
    const batch = Math.max(1, Math.ceil(items.length / 9));
    let started = 0;
    for (const kind of KINDS) {
      for (const it of items) {
        if (started >= batch) break;
        if (it.kind === kind && it.status === 'pending' && (step + it.countryId) % 2 === 0) { it.status = 'working'; started += 1; }
      }
    }
    for (const it of items) { if (started >= batch) break; if (it.status === 'pending') { it.status = 'working'; started += 1; } }
    const done = items.every((it) => it.status === 'ready' || it.status === 'failed');
    publish(done);
    if (done) stopMock();
  }, slow ? 4000 : 500);
}
