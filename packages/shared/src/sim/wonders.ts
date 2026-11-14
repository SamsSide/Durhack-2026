// Culture wonders (row A30). A rich nation at peace raises one great building near its capital, in the
// style of its culture; it takes WONDER_BUILD_TICKS to finish, and a finished wonder gives a small
// bonus to the whole nation. Everything here is a pure function of the world view (rolls are hashes,
// not the turn's rng), so every replica agrees.
import { hashString } from '../rng';
import type { Country, Structure, TechAge, World, WonderKind } from '../types';

export const WONDER_KINDS: readonly WonderKind[] = ['great_wall', 'mausoleum', 'pyramid', 'colossus', 'cathedral',
  'palace_of_soviets', 'skyscraper', 'space_elevator'];

/** Bonus of a finished wonder: income share, defence share for the whole nation, unrest change per year. */
export const WONDER_BONUS: Record<WonderKind, { income: number; defence: number; unrest: number }> = {
  great_wall: { income: 0, defence: 0.15, unrest: 0 },
  mausoleum: { income: 0, defence: 0, unrest: -0.01 },
  pyramid: { income: 0, defence: 0, unrest: -0.01 },
  colossus: { income: 0.1, defence: 0, unrest: 0 },
  cathedral: { income: 0, defence: 0, unrest: -0.01 },
  palace_of_soviets: { income: 0, defence: 0.15, unrest: 0 },
  skyscraper: { income: 0.1, defence: 0, unrest: 0 },
  space_elevator: { income: 0.08, defence: 0, unrest: -0.005 },
};

export const WONDER_BUILD_TICKS = 40;
export const WONDER_COST = 160;
/** It will not start one before this tick, below this treasury, or with this many finished already. */
export const WONDER_EARLIEST = 120;
export const WONDER_MIN_TREASURY = 240;
export const WONDER_MAX_PER_NATION = 2;
/** The whole world raises about this many (ruined ones count), and no two are begun closer than WONDER_SPACING ticks. */
export const WONDER_MAX_WORLD = 4;
export const WONDER_SPACING = 70;
/** Per turn chance (in a thousand) once it qualifies. */
const WONDER_ROLL = 25;

const KIND_BY_STYLE: Record<string, WonderKind> = {
  east_asian: 'great_wall', highland: 'great_wall',
  south_asian: 'mausoleum', desert: 'mausoleum', sahel: 'mausoleum',
  egyptian: 'pyramid', mesoamerican: 'pyramid',
  classical: 'colossus',
  medieval: 'cathedral', norse: 'cathedral',
  soviet_bloc: 'palace_of_soviets',
  western_modern: 'skyscraper', industrial: 'skyscraper', scrap: 'skyscraper',
  arcology: 'space_elevator',
};

/** The wonder a nation builds: by its architecture, or a space elevator in the future or stellar age. */
export function wonderKindFor(c: Pick<Country, 'buildingStyle' | 'techAge'>): WonderKind {
  const age: TechAge | undefined = c.techAge;
  if (age === 'future' || age === 'stellar') return 'space_elevator';
  return KIND_BY_STYLE[c.buildingStyle ?? 'medieval'] ?? 'cathedral';
}

/** Summed bonus of the finished wonders a nation owns. */
export function wonderBonusOf(structures: Iterable<Structure>, owner: number): { income: number; defence: number; unrest: number } {
  const sum = { income: 0, defence: 0, unrest: 0 };
  for (const s of structures) {
    if (s.owner !== owner || s.kind !== 'wonder' || !s.complete || !s.wonder) continue;
    const b = WONDER_BONUS[s.wonder];
    sum.income += b.income; sum.defence += b.defence; sum.unrest += b.unrest;
  }
  return sum;
}

/** A deterministic name from the nation's culture and the kind. */
export function wonderName(c: Pick<Country, 'adjective' | 'name' | 'leader'>, kind: WonderKind, placeName: string): string {
  const adj = c.adjective || c.name.split(' ')[0] || 'Old';
  const place = (placeName || adj).replace(/^The\s+/, '');
  const first = c.leader.replace(/^(King|Queen|Emperor|Empress|Jarl|Chancellor|Premier|President|Sultan|Caliph|Raja|Dr\.?|Lady|Lord)\s+/i, '').split(' ')[0] || adj;
  switch (kind) {
    case 'great_wall': return `The Great Wall of ${adj}`;
    case 'mausoleum': return `The Mausoleum of ${first}`;
    case 'pyramid': return `The Pyramid of ${first}`;
    case 'colossus': return `The Colossus of ${place}`;
    case 'cathedral': return `The Cathedral of ${place}`;
    case 'palace_of_soviets': return `The ${adj} Palace of Soviets`;
    case 'skyscraper': return `The ${adj} Spire`;
    case 'space_elevator': return `The ${adj} Skyhook`;
  }
}

export interface WonderPlan { tile: number; kind: WonderKind; name: string; clear?: string }

/**
 * Whether a nation starts a wonder this turn, and where. `free(t)` says a tile is its own and empty;
 * `clearable(t)` gives the id of a minor building (farm, camp, temple) on its own tile that may make way.
 * The caller has checked war and money-in-hand; this checks the rest (tick, count, roll, a spot).
 */
export function planWonder(view: World, me: number, tick: number, capital: number, treasury: number, free: (t: number) => boolean, clearable: (t: number) => string | undefined, structs: Structure[]): WonderPlan | null {
  const c = view.countries[me];
  if (!c || tick < WONDER_EARLIEST || treasury < WONDER_MIN_TREASURY) return null;
  const mine = structs.filter((s) => s.kind === 'wonder');
  if (mine.some((s) => !s.complete) || mine.length >= WONDER_MAX_PER_NATION) return null;
  let total = 0, last = -Infinity;
  for (const s of view.structures) if (s.wonder) { total++; last = Math.max(last, s.builtTick); }
  if (total >= WONDER_MAX_WORLD || tick - last < WONDER_SPACING) return null;
  if (hashString(`wonder:${view.seed}:${me}:${tick}`) % 1000 >= WONDER_ROLL) return null;
  const kind = wonderKindFor(c);
  const ok = (t: number, clear: boolean): boolean => {
    const terr = view.tiles[t]?.terrain;
    return !!terr && terr !== 'ocean' && terr !== 'ice' && terr !== 'mountain' && (kind !== 'colossus' || terr === 'coast')
      && (clear ? clearable(t) !== undefined : free(t));
  };
  // The nearest free spot to the capital: walk outwards ring by ring, up to 6 steps.
  let spots: number[] = [];
  const seen = new Set<number>([capital]);
  let ring = [capital];
  for (let d = 0; d < 6 && !spots.length && ring.length; d++) {
    const nextRing: number[] = [];
    for (const t of ring) for (const j of view.tiles[t]?.neighbors ?? []) if (!seen.has(j)) { seen.add(j); nextRing.push(j); }
    spots = nextRing.filter((t) => ok(t, false));
    if (!spots.length) spots = nextRing.filter((t) => ok(t, true));
    ring = nextRing;
  }
  if (!spots.length) return null;
  const tile = spots[hashString(`wonder-tile:${view.seed}:${me}:${tick}`) % spots.length]!;
  const reg = view.regions[view.tiles[capital]?.region ?? -1]?.name ?? '';
  let name = wonderName(c, kind, reg);
  while (view.structures.some((x) => x.name === name)) name += ' II';     // a rebuilt wonder is not the lost one
  return { tile, kind, name, clear: clearable(tile) };
}
