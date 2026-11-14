// Regions, unrest and secession (row A18).
//
// Unrest. Each nation computes the unrest of the regions it holds (the ones whose main town it owns)
// from its own replica, every few years, and publishes it as its own `region_updated { unrest }`, but
// only when the value it believes differs from the published one by more than UNREST_DELTA. Unrest
// moves towards a target a step at a time, so a sudden push (a decree of rebellion, row A20, or a
// battle) is felt for a while before the rules pull it back. The target comes from: distance from the
// capital, provinces recently taken by conquest, provinces once taken from another nation (a foreign
// people), other nations holding part of the region, war and war exhaustion, battles fought in the
// region, and how far the ruler's temper is from the region's own.
//
// Secession. One decision for the whole world, made by the world from the true world (findSecession
// is a pure function of it), at most one at a time with a cooldown. The server publishes the result as
// one batch of world events every replica applies (server/src/engine/secession.ts).
import type { World, WorldEvent } from '../types';
import { hashString } from '../rng';
import { regionOwner } from '../world';
import { enemiesOf, type WarLedger } from './war';

/** A nation reviews its regions' unrest every this many years (staggered by nation). */
export const UNREST_EVERY = 5;
/** It publishes only a change bigger than this. */
export const UNREST_DELTA = 0.05;
/** A province taken by conquest counts as recently conquered for this long. */
const RECENT_CONQUEST = 80;
/** A battle in a region stirs it for this long. */
const RECENT_BATTLE = 30;
/** Unrest climbs at most this much per review, and falls at most UNREST_FALL. */
const UNREST_RISE = 0.12;
const UNREST_FALL = 0.06;

export const SECESSION_EARLIEST = 150;
export const SECESSION_COOLDOWN = 120;
export const SECESSION_UNREST = 0.8;
export const SECESSION_MIN_TILES = 6;
/** Chance per year that a region over the threshold actually rises (a seeded roll). */
const SECESSION_CHANCE = 0.08;
/** The parent keeps at least this many provinces. */
const PARENT_KEEPS = 6;
/** No secession once the world holds this many nations (agents and colours stay manageable). */
export const MAX_NATIONS = 16;
/** Chronicle ids of secession lines start with this (the cooldown is read back from the chronicle). */
export const SECESSION_MARK = 'c-secession-';

// ---- what a nation remembers for unrest ------------------------------------------------------

export interface UnrestMemory {
  /** Province to the tick it was taken from another nation (by conquest or treaty). */
  taken: Map<number, number>;
  /** Region to the ticks of battles it fought there. */
  battles: Map<number, number[]>;
}
export const newUnrestMemory = (): UnrestMemory => ({ taken: new Map(), battles: new Map() });

/** Updates a nation's unrest memory from a batch it applied (like noteWarEvents). */
export function noteUnrestEvents(memo: UnrestMemory, me: number, world: World, applied: WorldEvent[]): void {
  for (const e of applied) {
    if (e.type === 'tile_claimed') {
      if (e.owner === me && e.from >= 0 && e.from !== me && e.cause === 'conquest') memo.taken.set(e.tile, e.tick);
      else if (e.from === me) memo.taken.delete(e.tile);
    } else if (e.type === 'battle' && (e.attacker === me || e.defender === me)) {
      const r = world.tiles[e.tile]?.region ?? -1;
      if (r < 0) continue;
      const list = (memo.battles.get(r) ?? []).filter((t) => e.tick - t < RECENT_BATTLE);
      list.push(e.tick);
      memo.battles.set(r, list);
    }
  }
}

// ---- unrest ----------------------------------------------------------------------------------

/** Steps from a tile to every tile (over land and sea), -1 where unreachable. */
export function hopsFrom(world: World, start: number): Int16Array {
  const d = new Int16Array(world.tiles.length).fill(-1);
  if (!world.tiles[start]) return d;
  d[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const t = queue[q]!;
    for (const j of world.tiles[t]!.neighbors) if (d[j] === -1) { d[j] = d[t]! + 1; queue.push(j); }
  }
  return d;
}

/** A region's own temper, 0 to 1, fixed for the world: how it takes to a harsh or devout ruler. */
const regionTemper = (world: World, regionId: number): number => (hashString(`temper:${world.seed}:${regionId}`) % 1000) / 1000;

/** The unrest a nation's rule would settle at in one of its regions, as its replica sees it. */
export function unrestTarget(
  view: World, regionId: number, me: number, tick: number, hops: Int16Array, memo?: UnrestMemory, ledger?: WarLedger,
): number {
  const c = view.countries[me];
  const region = view.regions[regionId];
  if (!c || !region) return 0;
  let land = 0, mine = 0, others = 0, recent = 0, foreign = 0, near = Infinity;
  const inRegion = new Set<number>();
  for (const t of region.tiles) {
    if (view.tiles[t]!.terrain === 'ocean') continue;
    land++;
    inRegion.add(t);
    const o = view.owner[t]!;
    if (o === me) {
      mine++;
      const h = hops[t]!;
      if (h >= 0 && h < near) near = h;
      const at = memo?.taken.get(t);
      if (at !== undefined) { foreign++; if (tick - at < RECENT_CONQUEST) recent++; }
    } else if (o >= 0 && view.countries[o]?.alive) others++;
  }
  if (!mine) return 0;
  let temples = 0, armies = 0;
  for (const s of view.structures) if (s.owner === me && s.kind === 'temple' && inRegion.has(s.tile)) temples++;
  for (const u of view.units) if (u.owner === me && u.kind === 'army' && inRegion.has(u.tile)) armies++;

  let u = 0.04;
  const d = hops[region.capitalTile]! >= 0 ? hops[region.capitalTile]! : near === Infinity ? 12 : near;
  u += Math.max(0, Math.min(1, (d - 2) / 9)) * 0.3;                // far from the capital
  u += (recent / mine) * 0.4;                                       // recently conquered
  u += (foreign / mine) * 0.15;                                     // a foreign people
  u += (others / Math.max(1, land)) * 0.15;                         // a divided region
  const wars = enemiesOf(view, me);
  if (wars.length) {                                                // war and war exhaustion
    let lost = 0;
    for (const o of wars) { const tl = ledger?.get(o); if (tl) lost += tl.lost + tl.lostBattles * 0.5; }
    u += 0.06 + Math.min(0.15, lost / 40);
  }
  const fought = (memo?.battles.get(regionId) ?? []).filter((t) => tick - t < RECENT_BATTLE).length;
  u += Math.min(0.25, fought * 0.05);                               // battles in the region
  const harsh = 0.6 * c.temperament.aggression + 0.4 * c.temperament.faith;
  u += Math.abs(regionTemper(view, regionId) - harsh) * 0.22;       // at odds with the ruler
  let size = 0;
  for (const o of view.owner) if (o === me) size++;
  if (size > 35) u += Math.min(0.1, (size - 35) / 150);             // a sprawling empire
  u -= temples * 0.06 + Math.min(0.1, armies * 0.05);               // faith and garrisons calm it
  if (view.tiles[c.capitalTile]?.region === regionId) u *= 0.4;     // the home region is loyal
  return Math.round(Math.max(0, Math.min(1, u)) * 100) / 100;
}

type Emit = (body: Record<string, unknown> & { type: WorldEvent['type'] }) => void;

/** A nation's review of its regions' unrest (called from nationTurn every UNREST_EVERY years). */
export function unrestTurn(view: World, me: number, tick: number, emit: Emit, memo?: UnrestMemory, ledger?: WarLedger): void {
  if ((tick + me) % UNREST_EVERY !== 0) return;
  const c = view.countries[me];
  if (!c?.alive) return;
  let hops: Int16Array | null = null;
  for (const region of view.regions) {
    if (regionOwner(view, region.id) !== me) continue;
    hops ??= hopsFrom(view, c.capitalTile);
    const target = unrestTarget(view, region.id, me, tick, hops, memo, ledger);
    const diff = target - region.unrest;
    if (Math.abs(diff) <= UNREST_DELTA) continue;
    const step = diff > 0 ? Math.min(diff, UNREST_RISE) : Math.max(diff, -UNREST_FALL);
    const unrest = Math.round(Math.max(0, Math.min(1, region.unrest + step)) * 100) / 100;
    emit({ type: 'region_updated', regionId: region.id, patch: { unrest } });
  }
}

// ---- secession -------------------------------------------------------------------------------

export interface SecessionPlan {
  regionId: number;
  parent: number;
  /** The region's provinces the parent holds: they go to the new nation. */
  tiles: number[];
}

/** Secessions so far, read back from the chronicle (ids `c-secession-<tick>-r<region>-<k>`): the tick of
 *  the last one and the regions that have already broken away once (a region rises only once a run). */
export function secessionHistory(world: World): { last: number; regions: Set<number> } {
  let last = -Infinity;
  const regions = new Set<number>();
  for (const c of world.chronicle) {
    if (!c.id.startsWith(SECESSION_MARK)) continue;
    const m = /^c-secession-(\d+)-r(\d+)-/.exec(c.id);
    if (!m) continue;
    last = Math.max(last, Number(m[1]));
    regions.add(Number(m[2]));
  }
  return { last, regions };
}

/**
 * Does a region break away this year? A pure function of the world: the most restless eligible region,
 * if it passes a seeded roll. Eligible: unrest at least SECESSION_UNREST, its main town and at least
 * SECESSION_MIN_TILES of its provinces held by one living nation, not that nation's capital region,
 * and the parent keeps PARENT_KEEPS provinces. Never before SECESSION_EARLIEST, never within
 * SECESSION_COOLDOWN of the last one, and a region that broke away once never rises again. `canParent` lets the caller rule out a nation (a deleted or
 * cut-off agent).
 */
export function findSecession(world: World, tick: number, canParent: (id: number) => boolean = () => true): SecessionPlan | null {
  if (tick < SECESSION_EARLIEST || world.countries.length >= MAX_NATIONS) return null;
  const history = secessionHistory(world);
  if (tick - history.last < SECESSION_COOLDOWN) return null;
  let best: SecessionPlan | null = null;
  let bestUnrest = -1;
  const sizes = new Map<number, number>();
  for (const o of world.owner) if (o >= 0) sizes.set(o, (sizes.get(o) ?? 0) + 1);
  for (const region of world.regions) {
    if (region.unrest < SECESSION_UNREST || region.unrest <= bestUnrest || history.regions.has(region.id)) continue;
    const p = regionOwner(world, region.id);
    const parent = p >= 0 ? world.countries[p] : undefined;
    if (!parent?.alive || !canParent(p)) continue;
    if (world.tiles[parent.capitalTile]?.region === region.id) continue;
    const tiles = region.tiles.filter((t) => world.owner[t] === p);
    if (tiles.length < SECESSION_MIN_TILES || (sizes.get(p) ?? 0) - tiles.length < PARENT_KEEPS) continue;
    best = { regionId: region.id, parent: p, tiles };
    bestUnrest = region.unrest;
  }
  if (!best) return null;
  const roll = (hashString(`secede:${world.seed}:${tick}:${best.regionId}`) % 1000) / 1000;
  return roll < SECESSION_CHANCE ? best : null;
}
