// How a replica takes in a batch of events (row A4). Every replica (each nation agent's own copy
// and the server's true world) applies the same batches through this one function, so replicas that
// heard the same batches in the same order hold the same world, with no referee:
//   1. order the batch canonically: lamport, then actor, then position (any replica gets the same order);
//   2. settle claims of one free tile by several nations in the same tick with resolveClaim;
//   3. apply each event that is still legal (isEventValid); drop the rest.
import type { World, WorldEvent } from '../types';
import { applyEvent } from '../world';
import { isEventValid, resolveClaim } from './rules';

const actorKey = (a: WorldEvent['actor']): number => (a === 'world' ? -2 : a === 'decree' ? -1 : a);

/** The canonical order of a batch. Pure; returns a new array. */
export function orderEvents(events: WorldEvent[]): WorldEvent[] {
  return events
    .map((e, i) => ({ e, i }))
    .sort((x, y) => (x.e.lamport - y.e.lamport) || (actorKey(x.e.actor) - actorKey(y.e.actor)) || (x.i - y.i))
    .map((x) => x.e);
}

/** Ids of claims that lose a same-tick clash for one tile (resolveClaim picks the winner). */
export function clashLosers(events: WorldEvent[]): Set<string> {
  const byTile = new Map<string, WorldEvent[]>();
  for (const e of events) {
    if (e.type !== 'tile_claimed' || e.cause !== 'expand' || typeof e.actor !== 'number') continue;
    const k = `${e.tile}:${e.tick}`;
    const list = byTile.get(k);
    if (list) list.push(e); else byTile.set(k, [e]);
  }
  const losers = new Set<string>();
  for (const list of byTile.values()) {
    const claimants = [...new Set(list.map((e) => e.actor as number))].sort((a, b) => a - b);
    if (claimants.length < 2) continue;
    const e0 = list[0]! as Extract<WorldEvent, { type: 'tile_claimed' }>;
    const winner = resolveClaim(e0.tile, e0.tick, claimants);
    for (const e of list) if (e.actor !== winner) losers.add(e.id);
  }
  return losers;
}

/** Applies one batch to a replica. Returns the events actually applied, in the order applied. */
export function applyTickBatch(world: World, events: WorldEvent[]): WorldEvent[] {
  if (!events.length) return [];
  const ordered = orderEvents(events);
  const losers = clashLosers(ordered);
  const applied: WorldEvent[] = [];
  for (const e of ordered) {
    if (losers.has(e.id) || !isEventValid(world, e)) continue;
    applyEvent(world, e);
    applied.push(e);
  }
  return applied;
}

/** A deep copy of a world for a new replica. Tiles never change after generation, so they are shared. */
export function cloneWorld(world: World): World {
  const { tiles, ...rest } = world;
  return { ...structuredClone(rest), tiles };
}

/** Tiles whose owner differs between two replicas of the same world. */
export function ownerDiff(a: World, b: World): number {
  let n = 0;
  for (let i = 0; i < a.owner.length; i++) if (a.owner[i] !== b.owner[i]) n++;
  return n;
}
