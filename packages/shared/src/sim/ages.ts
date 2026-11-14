// Technology ages (row A23). Each nation moves through ancient, medieval, gunpowder, industrial and
// modern: it starts where the world's era puts it and builds up progress every year from its own state
// (its towns and cities, factories, temples, treasury, trade pacts and people). Crossing a threshold is
// its own event (`country_updated { techAge }` plus a chronicle line), so every replica sees the same
// age at the same moment. Armies and fleets raised in a later age are stronger, and battles give the
// more advanced side a modest edge (sim/war.ts).
import type { ChronicleKind, Country, Structure, TechAge, World } from '../types';

export const AGES: readonly TechAge[] = ['ancient', 'medieval', 'gunpowder', 'industrial', 'modern'];

/** A nation's age as a number, 0 (ancient) to 4 (modern). A missing age means ancient. */
export const ageIndex = (age: TechAge | undefined): number => Math.max(0, AGES.indexOf(age ?? 'ancient'));

/** How much stronger a unit is when raised in each age. */
const AGE_STRENGTH = [1, 1.3, 1.8, 2.6, 3.8] as const;
export const ageStrength = (c: Pick<Country, 'techAge'> | undefined): number => AGE_STRENGTH[ageIndex(c?.techAge)]!;

/** The most strength one unit can hold, whatever its age (keeps the numbers readable). */
export const STRENGTH_CAP = 150;

/** The extra edge in battle for each age one side is ahead of the other. */
export const AGE_EDGE = 1.15;

/** The age a world's era starts its nations in. Unknown, generic and ancient eras start at the beginning. */
export function startAge(eraText: string | undefined): TechAge {
  const t = (eraText ?? '').toLowerCase();
  if (/modern|cold war|cyber|sci-?fi|science fiction|space|post-?apoc|apocalyp|atomic|nuclear|future/.test(t)) return 'modern';
  if (/industrial|steam|victorian|wild west/.test(t)) return 'industrial';
  if (/renaissance|age of sail|pirate|colonial|gunpowder/.test(t)) return 'gunpowder';
  if (/medieval|feudal|dark age|viking/.test(t)) return 'medieval';
  return 'ancient';
}

/** Progress needed to reach each age (cumulative; ancient is the start). */
export const AGE_AT = [0, 260, 1150, 2900, 4800] as const;

/** What a nation's agent remembers between turns for its age and its trade (kept outside the World). */
export interface AgeMemory {
  /** Progress towards the next age; starts at the floor of its current age. */
  progress?: number;
  /** Foreign merchant ships already counted as docked at its ports. */
  docked: Set<string>;
}
export const newAgeMemory = (): AgeMemory => ({ docked: new Set() });

/** Progress a nation makes in one year, from its own state. */
export function ageRate(view: World, me: number, structs: Structure[], treasury: number): number {
  const c = view.countries[me]!;
  let r = 0.5;
  for (const s of structs) {
    if (s.kind === 'town') r += 0.22;
    else if (s.kind === 'city' || s.kind === 'capital') r += 0.5;
    else if (s.kind === 'factory') r += 0.7;
    else if (s.kind === 'temple') r += 0.1;
    else if (s.kind === 'port') r += 0.08;
  }
  let pacts = 0;
  for (const rel of view.relations) {
    if ((rel.a !== me && rel.b !== me) || (rel.stance !== 'trade' && rel.stance !== 'alliance')) continue;
    if (view.countries[rel.a === me ? rel.b : rel.a]?.alive) pacts++;
  }
  r += Math.min(3, pacts) * 0.3;
  r += Math.min(treasury, 400) / 400;
  r += Math.min(3, c.population / 40000);
  return r;
}

const AGE_LINES: Record<TechAge, string> = {
  ancient: '',
  medieval: '{n} raises its first stone keeps and arms its knights with crossbows: the medieval age begins.',
  gunpowder: '{n} forges its first iron cannon: the age of gunpowder begins.',
  industrial: '{n} lays down its first ironclads and lays its first railway: the industrial age begins.',
  modern: '{n} rolls out its first tanks: the modern age begins.',
};

/**
 * One year of progress. Returns the age it reaches this year (at most one step), with its chronicle
 * line, or null. `mem` is the agent's memory; without one the nation never advances.
 */
export function ageTurn(
  view: World, me: number, structs: Structure[], treasury: number, mem: AgeMemory | undefined,
): { age: TechAge; kind: ChronicleKind; text: string } | null {
  if (!mem) return null;
  const c = view.countries[me]!;
  const i = ageIndex(c.techAge);
  mem.progress ??= AGE_AT[i]!;
  if (mem.progress < AGE_AT[i]!) mem.progress = AGE_AT[i]!;   // its age was set from outside (a secession, a restore)
  if (i >= AGES.length - 1) return null;
  mem.progress += ageRate(view, me, structs, treasury);
  if (mem.progress < AGE_AT[i + 1]!) return null;
  const age = AGES[i + 1]!;
  return { age, kind: 'growth', text: AGE_LINES[age].replace('{n}', c.name) };
}
