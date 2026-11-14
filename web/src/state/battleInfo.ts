// #311: battles as the battle card shows them. Each `battle` event (X1, from settleMove in
// packages/shared/src/sim/war.ts) is one clash on one tile; this module folds the clashes on a tile
// between the same two nations into one battle with a small rolling history, so the numbers stay
// coherent between ticks. Lane b; lane a's BattleCard draws it.
import { useMemo } from 'react';
import { create } from 'zustand';
import type { CouncilMember, FlagSpec, TechAge, World, WorldEvent } from '@terra/shared';
import { onWorldReset, useWorld } from './world';
import { yearFraction } from './calendar';
import { SOLDIERS_PER_STRENGTH, compositionOf, provinceOf } from './armyInfo';
import type { TroopGroup } from './armyInfo';

type BattleEvent = Extract<WorldEvent, { type: 'battle' }>;

export interface Clash { tick: number; month: number; attackerLoss: number; defenderLoss: number; winner: number }

/** One battle as the store keeps it. Side A is whoever attacked first on that tile. */
export interface BattleRecord {
  tile: number;
  attacker: number;
  defender: number;
  attackerUnits: string[];            // every attacking army that joined in
  startTick: number; startMonth: number;
  lastTick: number; lastMonth: number;
  start: { attacker: number; defender: number };    // strength when each side first fought here
  losses: { attacker: number; defender: number };   // strength lost so far
  clashes: Clash[];                                 // the newest HISTORY clashes, oldest first
}

/** How many clashes each tile remembers. */
const HISTORY = 12;
/** A battle with no clash for this many ticks is over; a new clash after that starts a new battle. */
export const BATTLE_GAP = 4;
/** Battles kept at most (the oldest go first). */
const KEEP = 40;

export const useBattles = create<{ byTile: Map<number, BattleRecord> }>(() => ({ byTile: new Map() }));

function sideStrength(world: World, countryId: number, tile: number, unitIds: string[] | null): number {
  let s = 0;
  for (const u of world.units) {
    if (u.owner !== countryId || (u.kind !== 'army' && u.kind !== 'fleet')) continue;
    if (unitIds ? unitIds.includes(u.id) : u.tile === tile) s += u.strength;
  }
  return s;
}

/** Folds one battle event, read after applyEvent ran on the replica. */
function fold(world: World, map: Map<number, BattleRecord>, e: BattleEvent, month: number): void {
  let b = map.get(e.tile);
  const samePair = b && ((b.attacker === e.attacker && b.defender === e.defender) || (b.attacker === e.defender && b.defender === e.attacker));
  if (!b || !samePair || e.tick - b.lastTick > BATTLE_GAP) {
    b = {
      tile: e.tile, attacker: e.attacker, defender: e.defender, attackerUnits: [],
      startTick: e.tick, startMonth: month, lastTick: e.tick, lastMonth: month,
      start: { attacker: 0, defender: 0 }, losses: { attacker: 0, defender: 0 }, clashes: [],
    };
    map.delete(e.tile);
  } else {
    // a fresh copy, so readers that hold the old record see a change
    b = { ...b, attackerUnits: [...b.attackerUnits], start: { ...b.start }, losses: { ...b.losses }, clashes: [...b.clashes] };
    map.delete(e.tile);
  }
  const flipped = b.attacker !== e.attacker;   // a counter-attack: the sides keep their places
  const lossA = flipped ? e.losses.defender : e.losses.attacker;
  const lossD = flipped ? e.losses.attacker : e.losses.defender;
  if (!flipped && !b.attackerUnits.includes(e.attackerUnit)) b.attackerUnits.push(e.attackerUnit);
  b.losses.attacker += lossA;
  b.losses.defender += lossD;
  b.lastTick = e.tick;
  b.lastMonth = month;
  // the start is what is here now plus all that was lost; it only grows (reinforcements join in)
  const nowA = sideStrength(world, b.attacker, b.tile, b.attackerUnits.length ? b.attackerUnits : null);
  const nowD = sideStrength(world, b.defender, b.tile, null);
  b.start.attacker = Math.max(b.start.attacker, nowA + b.losses.attacker);
  b.start.defender = Math.max(b.start.defender, nowD + b.losses.defender);
  b.clashes.push({ tick: e.tick, month, attackerLoss: lossA, defenderLoss: lossD, winner: e.winner });
  if (b.clashes.length > HISTORY) b.clashes.splice(0, b.clashes.length - HISTORY);
  map.set(e.tile, b);   // re-insert: the map keeps the newest last
  while (map.size > KEEP) map.delete(map.keys().next().value!);
}

// Watch the store's event window once, for the whole app (the same tail logic as useEventStream).
let lastSeen: string | null = null;
useWorld.subscribe((s) => {
  const ev = s.recentEvents;
  if (!s.world || ev.length === 0) return;
  const tail = ev[ev.length - 1]!.id;
  if (tail === lastSeen) return;
  let fresh: WorldEvent[];
  if (lastSeen == null) fresh = ev;
  else {
    const i = ev.findIndex((e) => e.id === lastSeen);
    fresh = i >= 0 ? ev.slice(i + 1) : ev.slice(-20);
  }
  lastSeen = tail;
  const battles = fresh.filter((e): e is BattleEvent => e.type === 'battle');
  if (!battles.length) return;
  const month = Math.min(11, Math.floor(yearFraction() * 12));
  const map = new Map(useBattles.getState().byTile);
  for (const e of battles) fold(s.world, map, e, month);
  useBattles.setState({ byTile: map });
});
onWorldReset(() => { lastSeen = null; useBattles.setState({ byTile: new Map() }); });

// ---- the card's view ------------------------------------------------------------------------

/** One block of the battle grid: a role's troops, as squares that empty as losses mount. */
export interface LineBlock {
  role: 'front' | 'flank' | 'back';
  name: string;            // the age's troop name, "Knights"
  soldiers: number;        // left now
  max: number;             // at the start
  fill: number;            // soldiers / max, 0..1
  cells: number;           // squares to draw now
  maxCells: number;        // squares at the start
}

/** One side of the battle grid. Losses come off the front first, then the flanks fold in, then the back. */
export interface LineSide { front: LineBlock; flankLeft: LineBlock; flankRight: LineBlock; back: LineBlock }

export interface BattleSide {
  countryId: number;
  nation: string;
  color: string;
  flag: FlagSpec;
  techAge: TechAge;
  general: CouncilMember | null;
  startStrength: number; strength: number; losses: number;   // raw unit strength
  startSoldiers: number; soldiers: number; lostSoldiers: number;
  troops: TroopGroup[];   // what is left, front, flank, back
}

export interface BattleInfo {
  tile: number;
  province: string;            // "Vellmoor": the card titles it "Battle of Vellmoor"
  active: boolean;             // a clash within BATTLE_GAP ticks
  startYear: number;
  durationMonths: number;      // at least 1
  durationText: string;        // "2 years 3 months", "4 months"
  attacker: BattleSide;
  defender: BattleSide;
  line: { attacker: LineSide; defender: LineSide };
  clashes: Clash[];
  leader: 'attacker' | 'defender' | 'even';   // who holds more of their start
}

const CELLS = { front: 6, flank: 3, back: 4 } as const;

function lineOf(startStrength: number, lostStrength: number, age: TechAge): LineSide {
  const comp = compositionOf(startStrength, age);
  const total = comp.reduce((s, g) => s + g.soldiers, 0);
  let lost = Math.min(total, Math.round(lostStrength * SOLDIERS_PER_STRENGTH));
  const take = (have: number): number => { const t = Math.min(have, lost); lost -= t; return have - t; };
  const front = comp[0]!, flank = comp[1]!, back = comp[2]!;
  const frontLeft = take(front.soldiers);
  const flankLeft = take(flank.soldiers);
  const backLeft = take(back.soldiers);
  const half = (n: number, first: boolean): number => (first ? Math.ceil(n / 2) : Math.floor(n / 2));
  const block = (role: LineBlock['role'], name: string, left: number, max: number, cells: number): LineBlock => {
    const fill = max > 0 ? left / max : 0;
    return { role, name, soldiers: left, max, fill, cells: left > 0 ? Math.max(1, Math.round(fill * cells)) : 0, maxCells: cells };
  };
  // the right flank folds first, so the left keeps the odd soldier
  return {
    front: block('front', front.name, frontLeft, front.soldiers, CELLS.front),
    flankLeft: block('flank', flank.name, half(flankLeft, true), half(flank.soldiers, true), CELLS.flank),
    flankRight: block('flank', flank.name, half(flankLeft, false), half(flank.soldiers, false), CELLS.flank),
    back: block('back', back.name, backLeft, back.soldiers, CELLS.back),
  };
}

function sideOf(world: World, b: BattleRecord, which: 'attacker' | 'defender'): { side: BattleSide; line: LineSide } {
  const id = which === 'attacker' ? b.attacker : b.defender;
  const c = world.countries[id];
  const age: TechAge = c?.techAge ?? 'ancient';
  const start = b.start[which];
  const losses = Math.min(start, b.losses[which]);
  // this battle's own losses only (an army that also fights elsewhere does not drain this card)
  const strength = Math.max(0, start - losses);
  const line = lineOf(start, start - strength, age);
  const troops: TroopGroup[] = [
    { role: 'front', name: line.front.name, figures: line.front.cells, soldiers: line.front.soldiers },
    { role: 'flank', name: line.flankLeft.name, figures: line.flankLeft.cells + line.flankRight.cells, soldiers: line.flankLeft.soldiers + line.flankRight.soldiers },
    { role: 'back', name: line.back.name, figures: line.back.cells, soldiers: line.back.soldiers },
  ];
  return {
    side: {
      countryId: id, nation: c?.name ?? 'Unknown', color: c?.color ?? '#888', flag: c?.flag ?? { layout: 'plain', colors: ['#888', '#666'], emblem: 'none', emblemColor: '#fff' },
      techAge: age, general: c?.council?.general ?? null,
      startStrength: start, strength, losses: start - strength,
      startSoldiers: start * SOLDIERS_PER_STRENGTH, soldiers: strength * SOLDIERS_PER_STRENGTH, lostSoldiers: (start - strength) * SOLDIERS_PER_STRENGTH,
      troops,
    },
    line,
  };
}

function durationText(months: number): string {
  const y = Math.floor(months / 12), m = months % 12;
  const part = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (y && m) return `${part(y, 'year')} ${part(m, 'month')}`;
  return y ? part(y, 'year') : part(m, 'month');
}

export function battleInfoOf(world: World, b: BattleRecord): BattleInfo {
  const a = sideOf(world, b, 'attacker');
  const d = sideOf(world, b, 'defender');
  const active = world.tick - b.lastTick <= BATTLE_GAP;
  // from the first clash to the latest; while a clash is this year, the year's months count too
  const thisYear = active && world.tick === b.lastTick;
  const endTick = b.lastTick;
  const endMonth = thisYear ? Math.max(b.lastMonth, Math.min(11, Math.floor(yearFraction() * 12))) : b.lastMonth;
  const months = Math.max(1, (endTick - b.startTick) * 12 + (endMonth - b.startMonth));
  const ka = a.side.startStrength ? a.side.strength / a.side.startStrength : 0;
  const kd = d.side.startStrength ? d.side.strength / d.side.startStrength : 0;
  return {
    tile: b.tile, province: provinceOf(world, b.tile), active,
    startYear: b.startTick + world.year - world.tick, durationMonths: months, durationText: durationText(months),
    attacker: a.side, defender: d.side, line: { attacker: a.line, defender: d.line },
    clashes: b.clashes.slice(),
    leader: Math.abs(ka - kd) < 0.05 ? 'even' : ka > kd ? 'attacker' : 'defender',
  };
}

/** The battle card's data for a tile; null when no battle was seen there. */
export function useBattleInfo(tile: number | null): BattleInfo | null {
  const world = useWorld((s) => s.world);
  const version = useWorld((s) => s.version);
  const record = useBattles((s) => (tile == null ? undefined : s.byTile.get(tile)));
  return useMemo(() => (world && record ? battleInfoOf(world, record) : null),
    // version: the replica is mutated in place, so re-read it on every applied batch
    [world, version, record]);
}

/** Tiles with a battle still going (a clash within BATTLE_GAP ticks), for the globe badges. */
export function useActiveBattles(): BattleRecord[] {
  const tick = useWorld((s) => s.world?.tick ?? 0);
  const byTile = useBattles((s) => s.byTile);
  return useMemo(() => [...byTile.values()].filter((b) => tick - b.lastTick <= BATTLE_GAP), [byTile, tick]);
}
