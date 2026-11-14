// A national mood that shifts (owner, #317 item 13). A nation's temperament (aggression, expansion,
// trade, faith) is set at founding; from then on it drifts a little every year from what happens to the
// nation: a long war or bitter losses harden it, defeat and exhaustion take the fight out of it,
// victories give it a hunger for land, long peace and trade pacts make merchants of it, and troubled
// years, plagues and prophets turn it to its temples; with nothing pushing, it slowly returns to its
// founding character. Steps are small and bounded, a pure function of
// the year's facts, and recorded in the nation's own `country_updated { temperament }`, so a replay
// applies the same numbers. Crossing a threshold gives one chronicle line ("Years of war have hardened
// the Dorrin Horde."). The rulers read the current temperament in their digest (server/src/agents/ruler.ts).
import type { Country } from '../types';

export type Temperament = Country['temperament'];
export type Trait = keyof Temperament;

/** Facts about one nation's year, gathered in nationTurn. */
export interface MoodInput {
  atWar: boolean;
  /** Years the longest of its current wars has lasted (0 at peace). */
  warYears: number;
  /** Provinces lost and taken this year, and the net over its current wars. */
  lostNow: number; gainedNow: number; warNet: number;
  /** The year after a peace: it paid reparations (defeat) or received them (victory). */
  paidReparations: boolean; gotReparations: boolean;
  /** Mean devastation of its land, 0..100. */
  avgDevastation: number;
  /** Its trade pacts and alliances with living nations. */
  pacts: number;
  /** War readiness last year, 0..100 (below 20 it is at rest). */
  readiness: number;
  /** The highest unrest among its regions, 0..1. */
  unrest: number;
  /** A plague or famine struck it this year or last. */
  plague: boolean;
  /** A prophet arose in it this year or last (decrees.ts also raises its faith at once). */
  prophet: boolean;
}

/** What a nation's agent remembers for its mood (kept outside the World, like its war ledger). */
export interface MoodMemory {
  /** Its temperament the first year it looked: the mood drifts round this and slowly returns to it. */
  founding?: Temperament;
  /** Years since it was last at war. */
  peaceYears: number;
}
export const newMoodMemory = (): MoodMemory => ({ peaceYears: 0 });

/**
 * Tuning (per year). Every trait slowly returns to its founding value (`relax` of the gap a year, a
 * half-life of about 70 years) and never strays more than `reach` from it, nor out of `lo..hi`. Against
 * that pull, a war that goes on hardens a nation by `harden` a year (about +0.2 after 40 years of war).
 */
export const MOOD = {
  lo: 0.05, hi: 0.95, reach: 0.3, relax: 0.01,
  highAt: 0.7, lowAt: 0.35,            // thresholds for a chronicle line
  longWar: 6,                          // years before a war starts to harden a nation
  harden: 0.006, lossAnger: 0.004, exhaust: 0.012, defeat: 0.04,
  victory: 0.004, triumph: 0.03, lossShrink: 0.003,
  longPeace: 10, pact: 0.001, warTrade: 0.003,
  unrestFaith: 0.004, plagueFaith: 0.03,
  repeatYears: 40,                     // no second line on the same trait and direction within this many years
} as const;

/** Exhausted: losing a war on devastated land, or a peace paid for in reparations. */
const exhausted = (i: MoodInput): boolean => i.paidReparations || (i.atWar && i.warNet <= -4 && i.avgDevastation >= 25);

/**
 * One year of mood. `mem` holds the founding temperament and the years of peace (updated here); without
 * one, the current temperament stands in for the founding. Returns the new temperament (3 decimals).
 */
export function moodStep(t: Temperament, i: MoodInput, mem?: MoodMemory): Temperament {
  const K = MOOD;
  const base = mem ? (mem.founding ??= { ...t }) : t;
  const peace = mem ? (mem.peaceYears = i.atWar ? 0 : mem.peaceYears + 1) : 0;
  const tired = exhausted(i);
  let ag = 0, ex = 0, tr = 0, fa = 0;
  // aggression: hardened by a long war and lost land, softened by exhaustion and defeat
  if (tired) ag -= K.exhaust + (i.paidReparations ? K.defeat : 0);
  else {
    if (i.atWar && i.warYears >= K.longWar) ag += K.harden;
    if (i.lostNow > 0) ag += K.lossAnger * Math.min(3, i.lostNow);
  }
  // expansion: victories feed it, lost land cools it
  if (i.gainedNow > 0) ex += K.victory * Math.min(3, i.gainedNow);
  if (i.gotReparations) ex += K.triumph;
  if (i.lostNow > 0) ex -= K.lossShrink * Math.min(3, i.lostNow);
  // trade: pacts in a long peace grow it, war empties the markets
  if (i.atWar) tr -= K.warTrade;
  else if (peace >= K.longPeace) tr += K.pact * Math.min(3, i.pacts);
  // faith: unrest, plague and prophets raise it (decrees.ts also raises it at once for a prophet)
  if (i.unrest >= 0.5) fa += K.unrestFaith;
  if (i.plague || i.prophet) fa += K.plagueFaith;
  const step = (k: Trait, d: number): number => {
    const b = base[k];
    let v = t[k] + d + (b - t[k]) * K.relax;
    v = Math.max(b - K.reach, Math.min(b + K.reach, v));
    return Math.round(Math.max(K.lo, Math.min(K.hi, v)) * 1000) / 1000;
  };
  return { aggression: step('aggression', ag), expansion: step('expansion', ex), trade: step('trade', tr), faith: step('faith', fa) };
}

const ORDER: Trait[] = ['aggression', 'expansion', 'trade', 'faith'];

/**
 * The chronicle line when a trait crosses a threshold this year (at most one a year), with the id
 * suffix that keeps the same line from repeating (`mood-<trait>-<up|down>`), or null. `nation` is the
 * name as it reads mid-sentence ("the Dorrin Horde").
 */
export function moodLine(prev: Temperament, next: Temperament, i: MoodInput, nation: string): { suffix: string; text: string } | null {
  for (const k of ORDER) {
    const up = prev[k] < MOOD.highAt && next[k] >= MOOD.highAt;
    const down = prev[k] > MOOD.lowAt && next[k] <= MOOD.lowAt;
    if (!up && !down) continue;
    const text = up ? upLine(k, i, nation) : downLine(k, i, nation);
    return { suffix: `mood-${k}-${up ? 'up' : 'down'}`, text };
  }
  return null;
}

function upLine(k: Trait, i: MoodInput, n: string): string {
  if (k === 'aggression') return i.lostNow > 0 ? `Bitter losses have hardened ${n}: its people cry out for revenge.` : `Years of war have hardened ${n}.`;
  if (k === 'expansion') return `Victory has given ${n} a hunger for land.`;
  if (k === 'trade') return `Long peace and busy harbours have made a nation of merchants of ${n}.`;
  if (i.plague) return `Plague drives the people of ${n} into its temples.`;
  if (i.prophet) return `A prophet's words turn the people of ${n} to their gods.`;
  return `In troubled years the people of ${n} turn to their gods.`;
}

function downLine(k: Trait, i: MoodInput, n: string): string {
  if (k === 'aggression') return exhausted(i) ? `Bled white by war, ${n} has lost its taste for battle.` : `Years of peace have softened ${n}; its war banners gather dust.`;
  if (k === 'expansion') return `Lost provinces have cured ${n} of its dreams of conquest.`;
  if (k === 'trade') return `War has emptied the markets of ${n}.`;
  return `Quiet years have cooled the faith of ${n}.`;
}

/** Words for a nation's mood on its card: its strongest traits above the high threshold, or "Even-tempered". */
export function moodWords(t: Temperament): string {
  const words: Record<Trait, [string, string]> = {
    aggression: ['Warlike', 'Peaceable'], expansion: ['Land-hungry', 'Settled'], trade: ['Mercantile', 'Closed'], faith: ['Devout', 'Worldly'],
  };
  const out: string[] = [];
  for (const k of [...ORDER].sort((a, b) => Math.abs(t[b] - 0.5) - Math.abs(t[a] - 0.5))) {
    if (t[k] >= MOOD.highAt) out.push(words[k][0]);
    else if (t[k] <= MOOD.lowAt) out.push(words[k][1]);
    if (out.length === 2) break;
  }
  return out.length ? out.map((w, i) => (i ? w.toLowerCase() : w)).join(', ') : 'Even-tempered';
}
