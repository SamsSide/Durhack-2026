// Technology ages (row A23). Each nation moves through ancient, medieval, gunpowder, industrial and
// modern: it starts where the world's era puts it and builds up progress every year from its own state
// (its towns and cities, factories, temples, treasury, trade pacts and people). Crossing a threshold is
// its own event (`country_updated { techAge }` plus a chronicle line), so every replica sees the same
// age at the same moment. Armies and fleets raised in a later age are stronger, and battles give the
// more advanced side a modest edge (sim/war.ts).
import type { ChronicleKind, Country, Structure, TechAge, World } from '../types';
import { hashString } from '../rng';

export const AGES: readonly TechAge[] = ['ancient', 'medieval', 'gunpowder', 'industrial', 'modern', 'future', 'stellar'];

/** A nation's age as a number, 0 (ancient) to 6 (stellar). A missing age means ancient. */
export const ageIndex = (age: TechAge | undefined): number => Math.max(0, AGES.indexOf(age ?? 'ancient'));

/** How much stronger a unit is when raised in each age. */
const AGE_STRENGTH = [1, 1.3, 1.8, 2.6, 3.8, 5.2, 7] as const;
export const ageStrength = (c: Pick<Country, 'techAge'> | undefined): number => AGE_STRENGTH[ageIndex(c?.techAge)]!;

/** The most strength one unit can hold, whatever its age (keeps the numbers readable). */
export const STRENGTH_CAP = 150;

/** The extra edge in battle for each age one side is ahead of the other. */
export const AGE_EDGE = 1.15;

/**
 * The settings a prompt or an era can name, most telling first (first match wins). Each has the tech age
 * its nations start in and the span of calendar years it may start at (negative years are BC). The start
 * age stays at or after its `AGE_EARLIEST_YEAR`, except after a fall, where survivors start again.
 */
export type EraKind = 'post' | 'far_future' | 'near_future' | 'modern' | 'industrial' | 'sail' | 'medieval' | 'classical' | 'bronze' | 'stone';
export const ERA_KINDS: readonly { kind: EraKind; match: RegExp; age: TechAge; years: readonly [number, number] }[] = [
  // Owner ruling: after the fall, survivors rebuild from salvage with spears and rafts, so ruined,
  // drowned and post-apocalyptic worlds start at the beginning and climb the whole arc again.
  { kind: 'post', match: /post-?apoc|apocalyp|\bruin\b|ruined|in ruins|ruins of|drown|wasteland|fallout|aftermath|after the (fall|bombs|flood|end|collapse)|collapsed (world|earth|civili[sz]ation)|\bage of collapse/, age: 'ancient', years: [2150, 2500] },
  { kind: 'far_future', match: /far.?future|distant future|arcolog|interstellar|starship|galactic|space age|post-?human|terraform/, age: 'future', years: [2150, 2600] },
  { kind: 'near_future', match: /cyber|sci-?fi|science fiction|\bspace\b|future|android|neon/, age: 'modern', years: [2040, 2099] },
  { kind: 'modern', match: /modern|cold war|atomic|nuclear|world war|20th century|21st century|contemporary|superpower|jet age|dieselpunk/, age: 'modern', years: [1900, 1999] },
  { kind: 'industrial', match: /industrial|steam|victorian|wild west|clockwork|brass|railway|factory|coal|19th century|gilded age/, age: 'industrial', years: [1800, 1900] },
  { kind: 'sail', match: /renaissance|age of sail|pirate|colonial|gunpowder|galleon|musket|privateer|whal|conquistador|early modern|age of discovery/, age: 'gunpowder', years: [1500, 1750] },
  { kind: 'medieval', match: /medieval|feudal|dark age|viking|knight|crusade|castle|middle ages/, age: 'medieval', years: [800, 1400] },
  { kind: 'classical', match: /classical|antiquity|iron age|roman|hellen|legion|senate|philosopher/, age: 'ancient', years: [-500, 400] },
  { kind: 'bronze', match: /bronze|pharaoh|chariot|ziggurat|\bancient\b/, age: 'ancient', years: [-3000, -1200] },
  { kind: 'stone', match: /stone age|neolithic|paleolithic|(last|end of the) ice age|mammoth|hunter-gatherer|prehistor|cave (people|painters|dwellers)|dawn of (man|time)/, age: 'ancient', years: [-10000, -4000] },
];

/** The setting a text names, or undefined for a text with no era in it. */
export function eraKind(text: string | undefined): EraKind | undefined {
  const t = (text ?? '').toLowerCase();
  return ERA_KINDS.find((k) => k.match.test(t))?.kind;
}
export const eraKindInfo = (kind: EraKind) => ERA_KINDS.find((k) => k.kind === kind)!;

/** The latest age a world may simply start in at a calendar year (at most `future`: the stellar age is earned). */
export function ageForYear(year: number): TechAge {
  let i = 0;
  while (i < 5 && year >= AGE_EARLIEST_YEAR[i + 1]!) i++;
  return AGES[i]!;
}

/**
 * The age a world's era starts its nations in. Unknown, generic and ancient eras start at the beginning.
 * With a `year` (a prompt that names one, such as "in 1349"), an era text that names no setting starts
 * in the age that year allows.
 */
export function startAge(eraText: string | undefined, year?: number): TechAge {
  const kind = eraKind(eraText);
  if (kind) return eraKindInfo(kind).age;
  return year !== undefined && Number.isFinite(year) ? ageForYear(year) : 'ancient';
}

/** The earliest and latest year a new world may start at. */
export const START_YEAR_MIN = -10000;
export const START_YEAR_MAX = 5000;
export const clampStartYear = (y: number): number => Math.round(Math.max(START_YEAR_MIN, Math.min(START_YEAR_MAX, y)));

/** Progress needed to reach each age (cumulative; ancient is the start). */
export const AGE_AT = [0, 260, 1150, 2900, 4800, 8600, 13000] as const;

/**
 * The earliest calendar year (`world.year`) a nation may step up into each age, parallel to `AGES`
 * (owner, #313). Progress keeps building, but the step waits for the year. A world whose starting era is
 * already later keeps its age: the gate only blocks stepping up early.
 */
export const AGE_EARLIEST_YEAR = [-Infinity, 500, 1400, 1760, 1900, 2050, 2150] as const;

/** Satellites need the modern age and at least this calendar year (the first Sputnik; owner, #317 item 14). */
export const SATELLITE_EARLIEST_YEAR = 1957;

/** What a nation's agent remembers between turns for its age and its trade (kept outside the World). */
export interface AgeMemory {
  /** Progress towards the next age; starts at the floor of its current age. */
  progress?: number;
  /** Foreign merchant ships already counted as docked at its ports. */
  docked: Set<string>;
  /** The tick of its next satellite launch (the count up is `Country.satellites`, in the world). */
  satNext?: number;
  /** The first tick it may shoot down another rival satellite (#317 item 15). */
  strikeNext?: number;
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
  future: '{n} sends its first drone swarms aloft, raises its first arcology and lifts its first ship beyond the sky: the future age begins.',
  stellar: '{n} launches its first starship from the top of its space elevator: the stellar age begins.',
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
  if (view.year < AGE_EARLIEST_YEAR[i + 1]!) return null;   // progress is banked; the step waits for the calendar
  const age = AGES[i + 1]!;
  return { age, kind: 'growth', text: AGE_LINES[age].replace('{n}', c.name) };
}

/** The most satellites a nation keeps up in each age, parallel to `AGES` (owner, #317 item 14): the
 *  first at `modern`, a second at `future`, four at `stellar`. */
export const SATELLITE_CAP = [0, 0, 0, 0, 1, 2, 4] as const;
/** The most satellites any nation keeps up (the stellar cap). */
export const MAX_SATELLITES = 4;
const SAT_GAP = 60;

/** How many satellites a nation has up (missing means none). */
export const satellitesOf = (c: Pick<Country, 'satellites'> | undefined): number => c?.satellites ?? 0;

/**
 * A modern-or-later nation launches satellites now and then, from 1957 on: the first a few years after
 * it may, then one every `SAT_GAP` years while it is below its age's cap (`SATELLITE_CAP`). A satellite
 * shot down (`satellite_lost`) frees a place, so it launches again on the same rhythm. Returns the new
 * count and the chronicle text of a launch this year, or null.
 */
export function satelliteTurn(view: World, me: number, tick: number, mem: AgeMemory | undefined): { satellites: number; text: string } | null {
  const c = view.countries[me]!;
  const cap = SATELLITE_CAP[ageIndex(c.techAge)]!;
  if (!mem || cap === 0 || view.year < SATELLITE_EARLIEST_YEAR) return null;
  mem.satNext ??= tick + 6;
  const n = satellitesOf(c);
  if (n >= cap || tick < mem.satNext) return null;
  mem.satNext = tick + SAT_GAP;
  return {
    satellites: n + 1,
    text: n === 0
      ? `${c.name} launches its first satellite into orbit: a new star crosses the sky above its capital.`
      : `${c.name} launches another satellite: ${n + 1} now circle its sky.`,
  };
}

/** War readiness at which a war is all-out (the "Total war" band). */
const ALL_OUT = 80;
/** Years between two satellites one nation shoots down. */
const STRIKE_GAP = 80;
/** Chance a year, in thousandths, that a modern nation at all-out war strikes (future and stellar: `STRIKE_PERMILLE_LATE`). */
const STRIKE_PERMILLE = 5;
const STRIKE_PERMILLE_LATE = 8;

/**
 * Anti-satellite strikes (owner, #317 item 15). A modern-or-later nation at all-out war (war readiness
 * 80 or more) with a modern-or-later enemy that has satellites up now and then shoots one down: rarely
 * (under one in a hundred a year, from a hash of the tick, so the turn's random stream is untouched), at
 * most once every `STRIKE_GAP` years. Returns the victim, the satellite (0..n-1) and the chronicle
 * text, or null. `enemies` are the nations it is at war with (sorted).
 */
export function satelliteStrike(view: World, me: number, enemies: number[], tick: number, mem: AgeMemory | undefined): { victim: number; index: number; text: string } | null {
  const c = view.countries[me]!;
  const age = ageIndex(c.techAge);
  if (!mem || age < 4 || (c.warReadiness ?? 0) < ALL_OUT || tick < (mem.strikeNext ?? 0)) return null;
  const targets = enemies.filter((id) => { const e = view.countries[id]; return !!e?.alive && ageIndex(e.techAge) >= 4 && satellitesOf(e) > 0; });
  if (!targets.length) return null;
  const h = hashString(`strike:${view.seed}:${me}:${tick}`);
  if (h % 1000 >= (age >= 5 ? STRIKE_PERMILLE_LATE : STRIKE_PERMILLE)) return null;
  const h2 = hashString(`strike-pick:${view.seed}:${me}:${tick}`);
  const victim = targets[h2 % targets.length]!;
  const v = view.countries[victim]!;
  const index = (h2 >>> 8) % satellitesOf(v);
  mem.strikeNext = tick + STRIKE_GAP;
  const vn = v.name.replace(/^The /, 'the ');
  const left = satellitesOf(v) - 1;
  const after = left === 0 ? `; ${vn} is blind in orbit` : left === 1 ? '; one of its satellites still circles' : `; ${left} of its satellites still circle`;
  const text = age >= 5
    ? `${c.name} burns a satellite of ${vn} out of orbit with a ground-based laser${after}.`
    : `A missile from ${c.name.replace(/^The /, 'the ')} knocks a satellite of ${vn} out of the sky, scattering debris along its orbit${after}.`;
  return { victim, index, text };
}
