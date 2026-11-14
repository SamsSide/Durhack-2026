// #311 dev views: `?mockArmy=1` opens the army card and `?mockBattle=1` the battle card on made-up data,
// so the cards can be seen and screenshotted without waiting for a war. The data goes through lane b's
// real builders (armyInfoOf, battleInfoOf) on a tiny stand-in world, so it has exactly the X5 shapes.
// The mock battle grinds on: a clash every 1.4 s, so the battle grid's losses can be watched.
import { useEffect, useState } from 'react';
import type { Council, Unit, World } from '@terra/shared';
import { armyInfoOf } from '../../state/armyInfo';
import type { ArmyInfo } from '../../state/armyInfo';
import { battleInfoOf } from '../../state/battleInfo';
import type { BattleInfo, BattleRecord } from '../../state/battleInfo';
import { useWorld } from '../../state/world';

/** The ids the dev views select. No real unit or tile has them. */
export const MOCK_UNIT_ID = 'mock-army-311';
export const MOCK_BATTLE_TILE = -311;

const general = (name: string, seed: number): Council => ({
  ruler: null,
  general: { name, portraitSeed: seed, since: 40, memory: '', born: 1158 },
  state: { ruler: 'active', general: 'active' },
});

const COUNTRIES = [
  {
    id: 0, name: 'Ashen Dominion', color: '#b0442c', techAge: 'medieval', warReadiness: 82, alive: true,
    flag: { layout: 'horizontal3', colors: ['#7a1f16', '#d9b25a', '#7a1f16'], emblem: 'tower', emblemColor: '#2a1f14' },
    council: general('Marshal Oderic Vane', 90211),
  },
  {
    id: 1, name: 'Free Cities of Lunmar', color: '#2f6f9a', techAge: 'medieval', warReadiness: 64, alive: true,
    flag: { layout: 'canton', colors: ['#24577a', '#ecdfc0', '#c9a24b'], emblem: 'star', emblemColor: '#ecdfc0' },
    council: general('Captain Ilse Marrow', 40517),
  },
];

/** A world just big enough for the builders: two nations, one province named Vellmoor. */
function standIn(tick: number): World {
  // tick 40 is the battle's first year; `tick` is now, the year on screen
  const year = useWorld.getState().world?.year ?? 1200;
  return {
    tick, year,
    countries: COUNTRIES,
    regions: [{ id: 0, name: 'Vellmoor' }],
    tiles: { [MOCK_BATTLE_TILE]: { region: 0 } },
    units: [],
  } as unknown as World;
}

export function mockArmyInfo(): ArmyInfo {
  const unit = { id: MOCK_UNIT_ID, owner: 0, kind: 'army', tile: MOCK_BATTLE_TILE, strength: 48 } as unknown as Unit;
  const world = standIn(42);
  const recent = new Map([[MOCK_BATTLE_TILE, { lastTick: 42, sides: [0, 1] as [number, number], units: [MOCK_UNIT_ID] }]]);
  return armyInfoOf(world, unit, recent)!;
}

const START = { attacker: 56, defender: 84 };   // 14.0k against 21.0k

/** The mock battle, a fresh clash every 1.4 s; it starts over once one side is nearly gone. */
export function useMockBattle(on: boolean): BattleInfo | null {
  const [step, setStep] = useState(3);
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setStep((s) => (s >= 22 ? 0 : s + 1)), 1400);
    return () => window.clearInterval(t);
  }, [on]);
  if (!on) return null;
  const clashes: BattleRecord['clashes'] = [];
  const losses = { attacker: 0, defender: 0 };
  for (let i = 1; i <= step; i++) {
    // the defenders hold at first, then the attackers' knights turn the flank
    const a = i < 8 ? 3 : 1;
    const d = i < 8 ? 2 : 4;
    const la = Math.min(a, START.attacker - 6 - losses.attacker);
    const ld = Math.min(d, START.defender - 8 - losses.defender);
    losses.attacker += Math.max(0, la);
    losses.defender += Math.max(0, ld);
    clashes.push({ tick: 40 + Math.floor((2 + i * 2) / 12), month: (2 + i * 2) % 12, attackerLoss: Math.max(0, la), defenderLoss: Math.max(0, ld), winner: ld >= la ? 0 : 1 });
  }
  const elapsed = 2 + step * 2;   // two months a clash, from March of the first year
  const tick = 40 + Math.floor(elapsed / 12);
  const record: BattleRecord = {
    tile: MOCK_BATTLE_TILE, attacker: 0, defender: 1, attackerUnits: [MOCK_UNIT_ID],
    startTick: 40, startMonth: 2, lastTick: tick, lastMonth: elapsed % 12,
    start: { ...START }, losses, clashes: clashes.slice(-12),
  };
  return battleInfoOf(standIn(tick), record);
}

/** Reads `?mockArmy=1` / `?mockBattle=1` and selects the stand-in once a world is on screen (and again after a reset). */
function openFromUrl(): void {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams(window.location.search);
  const army = q.has('mockArmy') && q.get('mockArmy') !== '0';
  const battle = q.has('mockBattle') && q.get('mockBattle') !== '0';
  if (!army && !battle) return;
  const open = () => {
    const s = useWorld.getState();
    if (army) s.selectUnit(MOCK_UNIT_ID); else s.selectBattle(MOCK_BATTLE_TILE);
  };
  if (useWorld.getState().world) open();
  useWorld.subscribe((s, prev) => {
    if (s.world && (!prev.world || s.epoch !== prev.epoch)) window.setTimeout(open, 0);
  });
}
openFromUrl();
