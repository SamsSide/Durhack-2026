// How a replica takes in a batch of events (row A4). Every replica (each nation agent's own copy
// and the server's true world) applies the same batches through this one function, so replicas that
// heard the same batches in the same order hold the same world, with no referee:
//   1. order the batch canonically: lamport, then actor, then position (any replica gets the same order);
//   2. settle claims of one free tile by several nations in the same tick with resolveClaim;
//   3. apply each event that is still legal (isEventValid); drop the rest;
//   4. an army's move into a province of a nation it is at war with is an attack: settleMove (sim/war.ts)
//      settles the battle right there, against this replica, and the events it derives (battle, losses,
//      capture, fall) are applied in place of the move. Same state, same order, same seeded hash: every
//      replica derives the same battles (row A6).
import type { World, WorldEvent } from '../types';
import { applyEvent } from '../world';
import { isEventValid, resolveClaim } from './rules';
import { settleMove } from './war';

const actorKey = (a: WorldEvent['actor']): number => (a === 'world' ? -2 : a === 'decree' ? -1 : a);

/**
 * The canonical order of a batch. Pure; returns a new array. Payments (row A27) go last: a nation's
 * `country_updated` carries an absolute treasury worked out before the batch, so a payment applied
 * before it would be overwritten and the money would vanish. After it, it lands on the new balance.
 */
export function orderEvents(events: WorldEvent[]): WorldEvent[] {
  const late = (e: WorldEvent): number => (e.type === 'payment' ? 1 : 0);
  return events
    .map((e, i) => ({ e, i }))
    .sort((x, y) => (late(x.e) - late(y.e)) || (x.e.lamport - y.e.lamport) || (actorKey(x.e.actor) - actorKey(y.e.actor)) || (x.i - y.i))
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
  const late: WorldEvent[] = [];                  // payments, derived ones included: applied after everything else
  for (const e of ordered) {
    if (losers.has(e.id) || (e.type !== 'payment' && !isEventValid(world, e))) continue;
    const settled = e.type === 'unit_moved' ? settleMove(world, e) : null;
    if (settled) {
      for (const d of settled) {
        if (d.type === 'payment') { late.push(d); continue; }
        applyEvent(world, d); applied.push(d);
      }
      continue;
    }
    if (e.type === 'payment') { late.push(e); continue; }
    applyEvent(world, e);
    applied.push(e);
  }
  for (const e of late) {
    if (e.type !== 'payment' || !isEventValid(world, e)) continue;
    // What the payer can really afford, so the log and the chain hold the amount that moved.
    const paid = Math.round(Math.min(Math.max(0, e.amount), Math.max(0, world.countries[e.from]?.treasury ?? 0)) * 100) / 100;
    if (paid <= 0) continue;
    const real = paid === e.amount ? e : { ...e, amount: paid };
    applyEvent(world, real);
    applied.push(real);
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
