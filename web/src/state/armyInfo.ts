// #311: what the army card shows, read from the replica. Lane b; lane a's ArmyCard draws it.
import { useMemo } from 'react';
import { readinessBand, readinessOf } from '@terra/shared';
import type { CouncilMember, ReadinessBand, TechAge, Unit, World } from '@terra/shared';
import { formationSlots } from '../globe/units/formation';
import type { FormationRole } from '../globe/units/unitModels';
import { useWorld } from './world';
import { useBattles } from './battleInfo';
import type { BattleRecord } from './battleInfo';

/** Soldiers one point of unit strength stands for on the cards (strength 48 reads as 12.0k). */
export const SOLDIERS_PER_STRENGTH = 250;

/** The troop name for each formation role in each age. */
export const ROLE_NAMES: Record<TechAge, Record<FormationRole, string>> = {
  ancient: { front: 'Spearmen', flank: 'Horsemen', back: 'Archers' },
  medieval: { front: 'Men-at-arms', flank: 'Knights', back: 'Crossbows' },
  gunpowder: { front: 'Musketeers', flank: 'Dragoons', back: 'Cannon' },
  industrial: { front: 'Riflemen', flank: 'Cavalry', back: 'Artillery' },
  modern: { front: 'Infantry', flank: 'Tanks', back: 'Artillery' },
  future: { front: 'Power armour', flank: 'Hover tanks', back: 'Drones' },
  stellar: { front: 'Walkers', flank: 'Mechs', back: 'Orbital strike' },
};

export interface TroopGroup {
  role: FormationRole;
  name: string;          // "Knights"
  figures: number;       // figures of this role in the globe formation
  soldiers: number;      // this role's share of the army's soldiers
}

export type ArmyStatus =
  | { kind: 'marching'; tile: number; province: string; text: string }   // "Marching to Vellmoor"
  | { kind: 'fighting'; tile: number; province: string; text: string }   // "Fighting at Vellmoor"
  | { kind: 'garrisoned'; tile: number; province: string; text: string }; // "Garrisoned in Vellmoor"

export interface ArmyInfo {
  unitId: string;
  countryId: number;
  nation: string;            // "Ashen Dominion"
  color: string;
  flag: World['countries'][number]['flag'];
  techAge: TechAge;
  strength: number;          // raw unit strength (what the counter shows)
  soldiers: number;          // strength * SOLDIERS_PER_STRENGTH
  composition: TroopGroup[]; // always front, flank, back in that order
  general: CouncilMember | null;
  status: ArmyStatus;
  readiness: number;         // 0..100
  readinessBand: ReadinessBand;
}

/** Name of the province a tile is in (falls back to the tile number). */
export function provinceOf(world: World, tile: number): string {
  const r = world.tiles[tile]?.region;
  return (r != null && r >= 0 ? world.regions[r]?.name : undefined) || `province ${tile}`;
}

/** Splits soldiers over front, flank and back in proportion to the formation's figures. */
export function compositionOf(strength: number, age: TechAge): TroopGroup[] {
  const slots = formationSlots(strength);
  const soldiers = Math.round(strength * SOLDIERS_PER_STRENGTH);
  const roles: FormationRole[] = ['front', 'flank', 'back'];
  const figs = roles.map((r) => slots.filter((s) => s.role === r).length);
  const total = figs.reduce((a, b) => a + b, 0) || 1;
  let left = soldiers;
  return roles.map((role, i) => {
    const share = i === roles.length - 1 ? left : Math.round((soldiers * figs[i]!) / total);
    left -= share;
    return { role, name: ROLE_NAMES[age][role], figures: figs[i]!, soldiers: share };
  });
}

/** How recent (in ticks) a battle must be for its armies to count as fighting there. */
const FIGHTING_TICKS = 2;

export function armyInfoOf(world: World, unit: Unit, recentBattleTiles: Map<number, { lastTick: number; sides: [number, number]; units: string[] }>): ArmyInfo | null {
  const c = world.countries[unit.owner];
  if (!c) return null;
  const age: TechAge = c.techAge ?? 'ancient';
  const there = unit.tile;
  const goingTo = unit.target != null && unit.target !== unit.tile ? unit.target : null;
  let status: ArmyStatus;
  let fightAt = [there, goingTo].find((t) => {
    if (t == null) return false;
    const b = recentBattleTiles.get(t);
    return !!b && world.tick - b.lastTick <= FIGHTING_TICKS && b.sides.includes(unit.owner);
  });
  // an attacker that struck from the next province is fighting there too
  if (fightAt == null) {
    for (const [t, b] of recentBattleTiles) if (world.tick - b.lastTick <= FIGHTING_TICKS && b.units.includes(unit.id)) fightAt = t;
  }
  if (fightAt != null) {
    const p = provinceOf(world, fightAt);
    status = { kind: 'fighting', tile: fightAt, province: p, text: `Fighting at ${p}` };
  } else if (goingTo != null) {
    const p = provinceOf(world, goingTo);
    status = { kind: 'marching', tile: goingTo, province: p, text: `Marching to ${p}` };
  } else {
    const p = provinceOf(world, there);
    status = { kind: 'garrisoned', tile: there, province: p, text: `Garrisoned in ${p}` };
  }
  const wr = readinessOf(c);
  return {
    unitId: unit.id, countryId: unit.owner, nation: c.name, color: c.color, flag: c.flag, techAge: age,
    strength: unit.strength, soldiers: Math.round(unit.strength * SOLDIERS_PER_STRENGTH),
    composition: compositionOf(unit.strength, age),
    general: c.council?.general ?? null,
    status, readiness: wr, readinessBand: readinessBand(wr),
  };
}

/** The army card's data for one unit; null when there is no such army (gone, or not an army or fleet). */
export function useArmyInfo(unitId: string | null): ArmyInfo | null {
  const world = useWorld((s) => s.world);
  const version = useWorld((s) => s.version);
  const battles = useBattles((s) => s.byTile);
  return useMemo(() => {
    if (!world || unitId == null) return null;
    const unit = world.units.find((u) => u.id === unitId);
    if (!unit || (unit.kind !== 'army' && unit.kind !== 'fleet')) return null;
    const recent = new Map<number, { lastTick: number; sides: [number, number]; units: string[] }>();
    for (const [tile, b] of battles) recent.set(tile, { lastTick: b.lastTick, sides: [b.attacker, b.defender], units: b.attackerUnits });
    return armyInfoOf(world, unit, recent);
    // version: the replica is mutated in place, so re-read it on every applied batch
  }, [world, version, unitId, battles]);
}

/** "12.0k", "850": the soldier counts the cards and badges print. */
export function formatSoldiers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Tone of a war status line on the globe: drives its accent colour. */
export type WarTone = 'attack' | 'hold' | 'fall';
export interface WarLine { text: string; tone: WarTone }

const STRONGHOLDS = new Set(['town', 'city', 'capital', 'fort']);

function atWar(world: World, a: number, b: number): boolean {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return world.relations.some((r) => r.a === lo && r.b === hi && r.stance === 'war');
}

/**
 * The short game-style line over an army counter, only for armies at war: "Advancing on X",
 * "Assaulting X", "Besieging X", "Holding the line", "Retreating", "Routed". Null for any other army.
 */
export function warLineOf(world: World, unit: Unit, battles: ReadonlyMap<number, BattleRecord>): WarLine | null {
  if (unit.kind !== 'army') return null;
  let b: BattleRecord | null = null;
  for (const r of battles.values()) {
    if (world.tick - r.lastTick > FIGHTING_TICKS) continue;
    if (r.attackerUnits.includes(unit.id) || (r.tile === unit.tile && (r.attacker === unit.owner || r.defender === unit.owner))) { b = r; break; }
  }
  if (b) {
    const tile = b.tile;
    const attacking = b.attackerUnits.includes(unit.id) || (b.attacker === unit.owner && unit.tile !== tile);
    const last = b.clashes[b.clashes.length - 1];
    if (last && last.winner >= 0 && last.winner !== unit.owner) {
      const began = attacking ? b.start.attacker : b.start.defender;
      return unit.strength < began * 0.35 ? { text: 'Routed', tone: 'fall' } : { text: 'Retreating', tone: 'fall' };
    }
    if (!attacking) return { text: 'Holding the line', tone: 'hold' };
    const siege = world.structures.some((s) => s.tile === tile && s.owner !== unit.owner && STRONGHOLDS.has(s.kind));
    return { text: `${siege ? 'Besieging' : 'Assaulting'} ${provinceOf(world, tile)}`, tone: 'attack' };
  }
  const to = unit.target;
  if (to != null && to !== unit.tile) {
    const o = world.owner[to] ?? -1;
    if (o >= 0 && o !== unit.owner && atWar(world, unit.owner, o)) return { text: `Advancing on ${provinceOf(world, to)}`, tone: 'attack' };
  }
  return null;
}
