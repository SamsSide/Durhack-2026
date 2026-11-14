// B9 timeline scrubber (lane a): replays GET /api/world/log (X3) so the globe can show any past year.
//
// How it works:
//   - the log ({ initial, events }) is fetched once when the bar opens; live events seen in the
//     store afterwards are appended, so the log stays whole without another fetch;
//   - a builder replays the events into a working World in slices of at most SLICE_MS and keeps a
//     snapshot every SNAP_EVERY ticks;
//   - scrubbing to tick T clones the nearest snapshot at or before T and replays the few ticks left;
//   - the historical World is put in the store's `world` slot (X5 has no second slot), sharing the
//     live `tiles` array so the province mesh is not rebuilt. The real world is kept here and fed
//     every live event meanwhile; "Live" puts it back.
import { create } from 'zustand';
import { applyEvent } from '@terra/shared';
import type { ChronicleEntry, Tile, World, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';

export const SNAP_EVERY = 25;
const SLICE_MS = 8;

export type MarkerKind = 'war' | 'fall' | 'secession' | 'wonder' | 'death';
export interface Marker { id: string; tick: number; year: number; kind: MarkerKind; text: string }
const MARKER_KINDS: ReadonlySet<string> = new Set(['war', 'fall', 'secession', 'wonder', 'death']);

export interface TimelineState {
  open: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  progress: number;            // 0 to 1 while the snapshots are being built
  error: string | null;
  maxTick: number;             // the live tick, as far as the log knows
  viewTick: number | null;     // null while the globe shows the live world
  markers: Marker[];
}

export const useTimeline = create<TimelineState>(() => ({
  open: false, status: 'idle', progress: 0, error: null, maxTick: 0, viewTick: null, markers: [],
}));

// ---- the log and its index ---------------------------------------------------------------------

let worldId: string | null = null;
let initial: World | null = null;
let events: WorldEvent[] = [];
let ends: number[] = [];                 // ends[t] = how many events have tick <= t (running max)
let years: number[] = [];                // years[t] = the year of tick t, from the tick events
let maxTick = 0;
let recentIds = new Set<string>();       // ids near the end of the log, to drop doubles
let seceded = new Set<number>();         // nations founded by breaking away
let markers: Marker[] = [];

// the builder
let work: World | null = null;           // the log replayed as far as workIdx
let workIdx = 0;
let nextSnap = 0;
let snaps = new Map<number, { world: World; idx: number }>();
let building = false;

// the view
let live: World | null = null;           // the real world, kept here while history is on screen
let slot: World | null = null;           // the historical World now in the store
let viewBase: World | null = null;       // private copy of the state at viewTick (the slot is a clone)
let viewIdx = 0;
let viewBaseTick = -1;
let ownSet = false;                      // true while this module writes to the store
let gap = false;                         // a live batch was missed: rebuild from the log on return
let pending: WorldEvent[] | null = null; // live events seen while the log is being fetched
let loadToken = 0;

/** A deep copy that shares the static `tiles` array and the (never mutated) chronicle entries. */
export function cloneWorld(w: World, tiles: Tile[] = w.tiles): World {
  const { tiles: _tiles, chronicle, ...rest } = w;
  const c = structuredClone(rest) as World;
  c.tiles = tiles;
  c.chronicle = chronicle.slice();
  return c;
}

/** applyEvent, but a country patch is copied first so no two replicas share its nested objects. */
function replay(w: World, e: WorldEvent): void {
  applyEvent(w, e.type === 'country_updated' ? { ...e, patch: structuredClone(e.patch) } : e);
}

export function yearOf(tick: number): number {
  const y = years[tick];
  if (y != null) return y;
  const base = initial ? initial.year - initial.tick : 0;
  return base + tick;
}

function markerOf(entry: ChronicleEntry): Marker | null {
  let kind: string = entry.kind;
  const first = entry.countries[0];
  if (kind === 'founding' && first != null && seceded.has(first)) kind = 'secession';
  if (!MARKER_KINDS.has(kind)) return null;
  return { id: entry.id, tick: entry.tick, year: entry.year, kind: kind as MarkerKind, text: entry.text };
}

function append(e: WorldEvent): void {
  if (recentIds.has(e.id)) return;
  recentIds.add(e.id);
  if (e.tick > maxTick) {
    for (let t = maxTick; t < e.tick; t++) ends[t] = events.length;
    maxTick = e.tick;
  }
  events.push(e);
  ends[maxTick] = events.length;
  if (e.type === 'tick') years[e.tick] = e.year;
  else if (e.type === 'country_founded' && e.country.parent != null) seceded.add(e.country.id);
  else if (e.type === 'chronicle') {
    const m = markerOf(e.entry);
    if (m) markers.push(m);
  }
}

function resetLog(): void {
  loadToken++;
  worldId = null; initial = null; events = []; ends = []; years = []; maxTick = 0;
  recentIds = new Set(); seceded = new Set(); markers = [];
  work = null; workIdx = 0; nextSnap = 0; snaps = new Map(); building = false;
  viewBase = null; viewIdx = 0; pending = null; gap = false;
}

function publish(extra: Partial<TimelineState> = {}): void {
  const s = useTimeline.getState();
  useTimeline.setState({
    maxTick,
    markers: s.markers.length === markers.length ? s.markers : markers.slice(),
    ...extra,
  });
}

// ---- the builder -------------------------------------------------------------------------------

function buildSlice(): void {
  if (!work) { building = false; return; }
  const t0 = performance.now();
  let n = 0;
  for (;;) {
    // A snapshot of tick T is final once a later tick exists.
    while (nextSnap < maxTick && (ends[nextSnap] ?? Infinity) <= workIdx) {
      const started = performance.now();
      snaps.set(nextSnap, { world: cloneWorld(work), idx: workIdx });
      nextSnap += SNAP_EVERY;
      if (performance.now() - started > 2) n = 63;   // a clone is the costly step: look at the clock next
    }
    if (workIdx >= events.length) break;
    replay(work, events[workIdx]!);
    workIdx++;
    if ((++n & 63) === 0 && performance.now() - t0 > SLICE_MS) break;
  }
  if (workIdx < events.length) {
    if (useTimeline.getState().status === 'loading') useTimeline.setState({ progress: workIdx / events.length });
    setTimeout(buildSlice, 0);
    return;
  }
  building = false;
  if (useTimeline.getState().status === 'loading') publish({ status: 'ready', progress: 1 });
}

function kickBuilder(): void {
  if (building || !work) return;
  building = true;
  setTimeout(buildSlice, 0);
}

async function load(): Promise<boolean> {
  const current = useWorld.getState().world ?? live;
  if (!current) return false;
  resetLog();
  const token = loadToken;
  pending = [];
  useTimeline.setState({ status: 'loading', progress: 0, error: null, markers: [], maxTick: 0 });
  try {
    const res = await fetch('/api/world/log');
    if (!res.ok) throw new Error(`the server answered ${res.status}`);
    const log = (await res.json()) as { initial: World; events: WorldEvent[] };
    if (token !== loadToken) return false;
    const tiles = (live ?? useWorld.getState().world)?.tiles;
    initial = log.initial;
    if (tiles && tiles.length === initial.tiles.length) initial.tiles = tiles;   // one tiles array for every replica
    worldId = initial.id;
    for (const c of initial.countries) if (c.parent != null) seceded.add(c.id);
    for (const e of log.events) append(e);
    recentIds = new Set(log.events.slice(-4000).map((e) => e.id));
    for (const e of pending) append(e);
    pending = null;
    work = cloneWorld(initial);
    workIdx = 0; nextSnap = 0;
    publish();
    kickBuilder();
    return true;
  } catch (err) {
    if (token !== loadToken) return false;
    pending = null;
    useTimeline.setState({ status: 'error', error: err instanceof Error ? err.message : 'the log could not be read' });
    return false;
  }
}

// ---- the view ----------------------------------------------------------------------------------

/** The state after every event of tick T, as a private World. Null until the builder has reached T. */
function stateAt(tick: number): World | null {
  const end = ends[tick];
  if (end == null || end > workIdx || !initial) return null;
  if (!(viewBase && tick >= viewBaseTick && tick - viewBaseTick <= SNAP_EVERY)) {
    let t = Math.floor(tick / SNAP_EVERY) * SNAP_EVERY;
    let snap = snaps.get(t);
    while (!snap && t > 0) { t -= SNAP_EVERY; snap = snaps.get(t); }
    viewBase = cloneWorld(snap ? snap.world : initial);
    viewIdx = snap ? snap.idx : 0;
  }
  for (; viewIdx < end; viewIdx++) replay(viewBase, events[viewIdx]!);
  viewBaseTick = tick;
  return viewBase;
}

function writeStore(world: World): void {
  const s = useWorld.getState();
  const gone = s.selectedCountryId != null && !world.countries[s.selectedCountryId];
  ownSet = true;
  try {
    useWorld.setState({
      world, version: s.version + 1,
      ...(gone ? { selectedCountryId: null, selectedTileId: null, selectedRegionId: null } : {}),
    });
  } finally { ownSet = false; }
}

/** Show the world as it stood at the end of that tick. The last tick is the live world. */
export function scrubTo(tick: number): void {
  if (useTimeline.getState().status !== 'ready') return;
  const t = Math.max(0, Math.min(maxTick, Math.round(tick)));
  if (t >= maxTick) { void goLive(); return; }
  if (t === useTimeline.getState().viewTick) return;
  const current = useWorld.getState().world;
  if (!current) return;
  const base = stateAt(t);
  if (!base) return;
  if (!live) live = current;
  slot = cloneWorld(base, live.tiles);
  useTimeline.setState({ viewTick: t });
  writeStore(slot);
}

/** Put the real world back. */
export async function goLive(): Promise<void> {
  if (!live) return;
  if (gap) {
    // A batch was missed while history was on screen: rebuild the real world from a fresh log.
    const ok = await load();
    if (ok) await new Promise<void>((done) => {
      const wait = () => (building ? setTimeout(wait, 30) : done());
      wait();
    });
    if (ok && work && live) {
      const fresh = cloneWorld(work, live.tiles);
      fresh.speed = live.speed; fresh.paused = live.paused;
      live = fresh;
    }
  }
  const real = live;
  if (!real) return;
  real.agents = useWorld.getState().agents;
  live = null; slot = null; viewBase = null;
  useTimeline.setState({ viewTick: null });
  writeStore(real);
}

export function openTimeline(): void {
  useTimeline.setState({ open: true });
  const w = useWorld.getState().world;
  if (w && (worldId !== w.id || useTimeline.getState().status === 'error' || useTimeline.getState().status === 'idle')) void load();
}

export function closeTimeline(): void {
  void goLive();
  useTimeline.setState({ open: false });
}

/** The events a store update added: the tail of `next` after the last event of `prev`. */
function freshEvents(prev: WorldEvent[], next: WorldEvent[]): WorldEvent[] | null {
  if (next.length === 0) return [];
  const last = prev[prev.length - 1];
  if (!last) return next;
  const at = next.lastIndexOf(last);
  return at < 0 ? null : next.slice(at + 1);
}

let unsubscribe: (() => void) | null = null;

/** Follow the store: keep the log and the real world whole while history is on screen. Call once. */
export function startTimeline(): () => void {
  if (unsubscribe) return unsubscribe;
  const off = useWorld.subscribe((s, prev) => {
    if (ownSet) return;
    if (s.world !== prev.world) {
      // The socket replaced the world (a new world, a replay or a reconnect): history is void.
      live = null; slot = null;
      resetLog();
      const open = useTimeline.getState().open;
      useTimeline.setState({ status: 'idle', viewTick: null, markers: [], maxTick: 0, progress: 0 });
      if (open && s.world) void load();
      return;
    }
    if (s.agents !== prev.agents && live) live.agents = s.agents;
    if (s.recentEvents === prev.recentEvents) return;
    const fresh = freshEvents(prev.recentEvents, s.recentEvents);
    if (fresh === null) {
      if (live) gap = true;
      else if (initial) { resetLog(); if (useTimeline.getState().open) void load(); else useTimeline.setState({ status: 'idle' }); }
    } else {
      for (const e of fresh) {
        if (live) applyEvent(live, structuredClone(e));
        if (pending) pending.push(e);
        else if (initial) append(e);
      }
      if (initial && !pending) { kickBuilder(); publish(); }
    }
    // The socket handler applied this batch to whatever is in the store: put the past back.
    if (slot && viewBase && live) Object.assign(slot, cloneWorld(viewBase, live.tiles));
  });
  unsubscribe = () => { off(); unsubscribe = null; };
  return unsubscribe;
}
