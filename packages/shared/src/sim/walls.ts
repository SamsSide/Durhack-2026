// City walls (#203, row A33): derived, never simulated. A settlement's population is its share of its
// nation's population, and its wall tier follows from that. Pure and deterministic: every replica and
// the renderer get the same answer from the same world.
import type { Structure, StructureKind, World } from '../types';

export type CityTier = 0 | 1 | 2 | 3 | 4;

/** The share of its nation's people that lives in one settlement of each kind; the rest is countryside. */
export const SETTLEMENT_SHARE: Partial<Record<StructureKind, number>> = { capital: 0.15, city: 0.05, town: 0.02, village: 0.008, camp: 0.002 };
/** A nation's settlements never hold more than this much of it together (the shares shrink to fit). */
export const URBAN_SHARE_MAX = 0.9;

/** Population a settlement needs for tier 1 (palisade), 2 (stone wall round the core), 3 (a second ring)
 *  and 4 (walled core with gate forts). History's 5k / 20k / 100k / 1M, scaled to this game's numbers:
 *  a nation runs from about 12k people at its founding to 200k to 300k six centuries on. */
export const CITY_TIER_POP: readonly [number, number, number, number] = [2500, 6000, 12000, 25000];
/** The highest tier a kind can reach: towns stop at a stone wall, villages and camps have none. */
export const CITY_TIER_MAX: Partial<Record<StructureKind, CityTier>> = { town: 2, city: 4, capital: 4 };

/** Sum of settlement shares per nation. */
function shareTotals(world: World): Map<number, number> {
  const totals = new Map<number, number>();
  for (const s of world.structures) {
    const w = SETTLEMENT_SHARE[s.kind];
    if (w) totals.set(s.owner, (totals.get(s.owner) ?? 0) + w);
  }
  return totals;
}

function popOf(world: World, s: Structure, total: number): number {
  const w = SETTLEMENT_SHARE[s.kind];
  const c = world.countries[s.owner];
  if (!w || !c || !c.alive) return 0;
  return Math.round(c.population * w * Math.min(1, URBAN_SHARE_MAX / Math.max(total, w)));
}

export function tierForPopulation(kind: StructureKind, population: number): CityTier {
  const max = CITY_TIER_MAX[kind] ?? 0;
  let tier = 0;
  while (tier < max && population >= CITY_TIER_POP[tier]!) tier++;
  return tier as CityTier;
}

/** People living in one settlement: its share of its nation's population (0 for other structures). */
export function settlementPopulation(world: World, structureId: string): number {
  const s = world.structures.find((x) => x.id === structureId);
  if (!s) return 0;
  return popOf(world, s, shareTotals(world).get(s.owner) ?? 0);
}

/** Wall tier of one town, city or capital: 0 none, 1 palisade, 2 stone wall round the core, 3 a second
 *  ring, 4 walled core with gate forts. */
export function cityTier(world: World, structureId: string): CityTier {
  const s = world.structures.find((x) => x.id === structureId);
  if (!s || !CITY_TIER_MAX[s.kind]) return 0;
  return tierForPopulation(s.kind, popOf(world, s, shareTotals(world).get(s.owner) ?? 0));
}

/** Every walled-kind settlement's tier in one pass (for a renderer that asks about all of them each update). */
export function cityTiers(world: World): Map<string, CityTier> {
  const totals = shareTotals(world);
  const out = new Map<string, CityTier>();
  for (const s of world.structures) {
    if (!CITY_TIER_MAX[s.kind]) continue;
    out.set(s.id, tierForPopulation(s.kind, popOf(world, s, totals.get(s.owner) ?? 0)));
  }
  return out;
}
