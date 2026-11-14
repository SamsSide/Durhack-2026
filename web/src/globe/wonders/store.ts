// Wonders known to the globe: from world.structures (kind 'wonder'), from wonder_started / wonder_built
// events, and from the dev helper window.__wonderDemo. Read by the 3D layer, the tooltip and the minimap. Lane b.
import { create } from 'zustand';
import type { World, WorldEvent } from '@terra/shared';
import { WONDER_LABEL } from './types';
import type { WonderKind } from './types';

export interface WonderRec {
  id: string;
  tile: number;
  owner: number;
  kind: WonderKind;
  name: string;
  complete: boolean;
  ruined: boolean;            // razed: the structure is now a ruin that still carries its wonder
  startTick: number | null;   // world tick the build started (null: unknown)
  startMs: number;            // performance.now() when we first saw it being built
  builtMs: number | null;     // performance.now() of the reveal (null: none to play)
  demo: boolean;              // injected by __wonderDemo, never touched by world sync
  demoMs?: number;            // demo build time
}

interface WonderState { list: WonderRec[] }

export const useWonders = create<WonderState>(() => ({ list: [] }));

export const BUILD_TICKS = 40; // contract X1: wonder_built comes about 40 ticks after wonder_started

function fallbackName(world: World | null, owner: number, kind: WonderKind): string {
  const c = world?.countries[owner];
  return c ? `${c.name} ${WONDER_LABEL[kind]}` : WONDER_LABEL[kind];
}

/** Announce a finished wonder to whoever runs the spotlight tour. Harmless when nobody listens. */
function announce(r: WonderRec): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('terra:spotlight-event', {
    detail: { kind: 'wonder', tileId: r.tile, countryId: r.owner, title: r.name },
  }));
}

function put(next: WonderRec[]): void { useWonders.setState({ list: next }); }

/** Mark one wonder complete and play its reveal (once). */
function finish(list: WonderRec[], i: number, reveal: boolean): WonderRec[] {
  const r = list[i]!;
  if (r.complete) return list;
  const done: WonderRec = { ...r, complete: true, builtMs: reveal ? performance.now() : null };
  const out = list.slice();
  out[i] = done;
  if (reveal) announce(done);
  return out;
}

/** Reconcile with world.structures: add wonders we did not know, follow owner and completion, drop razed ones. */
export function syncWonders(world: World | null): void {
  if (!world) { if (useWonders.getState().list.some((r) => !r.demo)) put(useWonders.getState().list.filter((r) => r.demo)); return; }
  const prev = useWonders.getState().list;
  const byId = new Map(prev.map((r, i) => [r.id, i] as const));
  let list = prev;
  let changed = false;
  const seen = new Set<string>();
  const first = prev.every((r) => r.demo);
  for (const raw of world.structures) {
    if (!raw || (raw.kind !== 'wonder' && raw.kind !== 'ruin') || !raw.wonder) continue;
    const ruined = raw.kind === 'ruin';
    if (raw.tile < 0 || raw.tile >= world.tiles.length) continue;
    seen.add(raw.id);
    const complete = ruined || raw.complete !== false; // missing means finished (an old snapshot)
    const name = typeof raw.name === 'string' && raw.name ? raw.name : fallbackName(world, raw.owner, raw.wonder);
    const i = byId.get(raw.id);
    if (i == null) {
      list = [...list, {
        id: raw.id, tile: raw.tile, owner: raw.owner, kind: raw.wonder, name, complete, ruined,
        startTick: typeof raw.builtTick === 'number' ? raw.builtTick : null, startMs: performance.now(), builtMs: null, demo: false,
      }];
      changed = true;
      continue;
    }
    const r = list[i]!;
    if (r.demo) continue;
    if (r.owner !== raw.owner || r.name !== name || r.tile !== raw.tile || r.ruined !== ruined) {
      list = list.slice(); list[i] = { ...r, owner: raw.owner, name, tile: raw.tile, ruined }; changed = true;
    }
    if (complete && !r.complete) { list = finish(list, i, !first); changed = true; }
  }
  // A wonder that left world.structures was razed (now a ruin). Keep event-only ones until the world catches up
  // with them: those have no structure yet when A30 is not on the server.
  const hasAny = world.structures.some((s) => s?.kind === 'wonder' || (s?.kind === 'ruin' && s.wonder));
  if (hasAny) {
    const kept = list.filter((r) => r.demo || seen.has(r.id));
    if (kept.length !== list.length) { list = kept; changed = true; }
  }
  if (changed) put(list);
}

/** Apply wonder_started / wonder_built events. */
export function wonderEvents(world: World | null, events: WorldEvent[]): void {
  let list = useWonders.getState().list;
  let changed = false;
  for (const e of events) {
    if (e.type === 'wonder_started') {
      if (list.some((r) => r.id === e.structureId)) continue;
      const name = e.name || fallbackName(world, e.countryId, e.wonder);
      list = [...list, {
        id: e.structureId, tile: e.tile, owner: e.countryId, kind: e.wonder, name, complete: false, ruined: false,
        startTick: e.tick ?? world?.tick ?? null, startMs: performance.now(), builtMs: null, demo: false,
      }];
      changed = true;
    } else if (e.type === 'wonder_built') {
      const i = list.findIndex((r) => r.id === e.structureId);
      if (i < 0) continue;
      list = finish(list, i, true);
      changed = true;
    }
  }
  if (changed) put(list);
}

/** Wonder on a tile, if any (the first one). */
export function wonderAt(tile: number): WonderRec | undefined {
  return useWonders.getState().list.find((r) => r.tile === tile);
}

// ---- dev helper -------------------------------------------------------------------------

let demoSeq = 0;

/** Inject a fake start, then the build after `ms`. Local visual state only. */
export function demoWonder(world: World | null, countryId: number, kind: WonderKind, ms = 12000): string | null {
  const c = world?.countries[countryId];
  if (!world || !c) { console.warn('__wonderDemo: no such country', countryId); return null; }
  // Its capital, or the first tile it owns.
  let tile = c.capitalTile;
  if (tile == null || tile < 0 || world.owner[tile] !== countryId) tile = world.owner.findIndex((o) => o === countryId);
  if (tile < 0) { console.warn('__wonderDemo: that country owns no land'); return null; }
  // Next to the capital when we can, so the capital stays visible.
  const nb = world.tiles[tile]!.neighbors.find((n) => world.owner[n] === countryId && world.tiles[n]!.terrain !== 'ocean');
  if (nb != null && kind !== 'great_wall') tile = nb;
  const id = `demo-wonder-${++demoSeq}`;
  const rec: WonderRec = {
    id, tile, owner: countryId, kind, name: fallbackName(world, countryId, kind), complete: false, ruined: false,
    startTick: null, startMs: performance.now(), builtMs: null, demo: true, demoMs: ms,
  };
  put([...useWonders.getState().list.filter((r) => !(r.demo && r.tile === tile)), rec]);
  window.setTimeout(() => {
    const list = useWonders.getState().list;
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) put(finish(list, i, true));
  }, ms);
  return id;
}
