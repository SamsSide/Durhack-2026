// Nation identity (docs/research/nation-identity.md section 1): five small enums derived from data
// the world already has. Pure and deterministic; cached per country and recomputed only when the
// nation's tile count moves by 25% or its text changes. Reusable by any lane.
import type { BuildingStyle, Country, Terrain, World } from '@terra/shared';

export type Era = 'bronze' | 'classical' | 'medieval' | 'gunpowder' | 'industrial' | 'modern' | 'future' | 'post_apoc';
export type Gov = 'communist' | 'junta' | 'theocracy' | 'merchant' | 'democracy' | 'monarchy' | 'tribal' | 'technocracy';
export type DomTerrain = 'mountain' | 'coast' | 'ice' | 'desert' | 'forest' | 'plains';
export type Mood = 'martial' | 'pious' | 'wealthy' | 'pioneer';

export interface Identity {
  era: Era;
  /** bronze=0 ... future=6, post_apoc=7 (use for "era >= industrial" rules). */
  eraIndex: number;
  gov: Gov;
  terrain: DomTerrain;
  mood: Mood;
  region: BuildingStyle;
}

export const ERA_ORDER: Era[] = ['bronze', 'classical', 'medieval', 'gunpowder', 'industrial', 'modern', 'future', 'post_apoc'];

// First match wins, top to bottom. Patterns match at a word start.
const ERA_RULES: Array<[Era, RegExp]> = [
  ['post_apoc', /\b(post-?apocalyp|wasteland|fallout|ruined|drowned)/],
  ['future', /\b(space|sci-?fi|cyberpunk|future|star|galactic)/],
  ['modern', /\b(modern|cold war|20th|21st|atomic|contemporary)/],
  ['industrial', /\b(industrial|steam|victorian|19th|railway)/],
  ['gunpowder', /\b(renaissance|gunpowder|colonial|age of sail|early modern|16th|17th|18th)/],
  ['medieval', /\b(medieval|feudal|dark age|crusade|viking|knights)/],
  ['classical', /\b(classical|antiquity|iron age|roman|hellenic|republic of)/],
  ['bronze', /\b(bronze|stone age|neolithic|pharaoh|chariot|dawn)/],
];

const GOV_RULES: Array<[Gov, RegExp]> = [
  ['communist', /\b(communis|soviet|socialis|collective|people'?s|worker|proletar|commune|party)/],
  ['junta', /\b(junta|military|martial|warlord|general|garrison|praetor|stratocra)/],
  ['theocracy', /\b(theocra|church|temple|priest|holy|faith|divine|prophet|caliphate|oracle)/],
  ['merchant', /\b(merchant|trade|guild|mercantile|company|bank|plutocra|league)/],
  ['democracy', /\b(democra|republic|senate|parliament|council of citizens|liberal|federation)/],
  ['monarchy', /\b(king|queen|crown|empire|emperor|monarch|dynast|throne|sultan|shah|pharaoh)/],
  ['tribal', /\b(tribe|tribal|clan|chief|horde|khan|herder|band|elders)/],
  ['technocracy', /\b(technocra|ai\b|machine|algorithm|engineer|corporate|syndicate)/],
];

export function eraOf(world: Pick<World, 'era' | 'prompt'>): Era {
  for (const text of [(world.era ?? '').toLowerCase(), (world.prompt ?? '').toLowerCase()]) {
    for (const [era, re] of ERA_RULES) if (re.test(text)) return era;
  }
  return 'medieval';
}

export function govOf(c: Pick<Country, 'government' | 'ideology' | 'temperament' | 'nomadic'>, eraIndex: number): Gov {
  for (const text of [(c.government ?? '').toLowerCase(), `${c.government ?? ''} ${c.ideology ?? ''}`.toLowerCase()]) {
    for (const [gov, re] of GOV_RULES) if (re.test(text)) return gov;
  }
  if (c.nomadic) return 'tribal';
  if ((c.temperament?.aggression ?? 0) > 0.6) return 'monarchy';
  return eraIndex <= 0 ? 'tribal' : 'monarchy';
}

export function moodOf(t: Country['temperament'] | undefined): Mood {
  if (!t) return 'pioneer';
  let best: Mood = 'martial', v = t.aggression;
  if (t.faith > v) { best = 'pious'; v = t.faith; }
  if (t.trade > v) { best = 'wealthy'; v = t.trade; }
  if (t.expansion > v) best = 'pioneer';
  return best;
}

interface Tally { n: number; t: Partial<Record<Terrain, number>> }

function tallyAll(world: World): Map<number, Tally> {
  const out = new Map<number, Tally>();
  const owner = world.owner;
  for (let i = 0; i < owner.length; i++) {
    const o = owner[i]!;
    if (o < 0) continue;
    const terr = world.tiles[i]?.terrain;
    if (!terr || terr === 'ocean') continue;
    let e = out.get(o);
    if (!e) { e = { n: 0, t: {} }; out.set(o, e); }
    e.n++;
    e.t[terr] = (e.t[terr] ?? 0) + 1;
  }
  return out;
}

function terrainOf(world: World, c: Country, tally: Tally | undefined): DomTerrain {
  const n = tally?.n ?? 0;
  if (n > 0) {
    const share = (...k: Terrain[]): number => k.reduce((a, x) => a + (tally!.t[x] ?? 0), 0) / n;
    if (share('mountain', 'hills') >= 0.4) return 'mountain';
    if (share('coast') >= 0.35 || world.tiles[c.capitalTile]?.terrain === 'coast') return 'coast';
    if (share('ice') >= 0.3) return 'ice';
    if (share('desert') >= 0.4) return 'desert';
    if (share('forest') >= 0.4) return 'forest';
    return 'plains';
  }
  return world.tiles[c.capitalTile]?.terrain === 'coast' ? 'coast' : 'plains';
}

interface Entry { key: string; baseCount: number; id: Identity }
const cache = new WeakMap<World, Map<number, Entry>>();

function keyOf(world: World, c: Country): string {
  return [world.era, world.prompt, c.government, c.ideology, c.buildingStyle, c.nomadic ? 1 : 0,
    c.temperament?.aggression, c.temperament?.faith, c.temperament?.trade, c.temperament?.expansion].join('|');
}

function compute(world: World, c: Country, tally: Tally | undefined): Identity {
  const era = eraOf(world);
  const eraIndex = ERA_ORDER.indexOf(era);
  return {
    era, eraIndex, gov: govOf(c, eraIndex), terrain: terrainOf(world, c, tally),
    mood: moodOf(c.temperament), region: c.buildingStyle ?? 'medieval',
  };
}

/**
 * The identity of one nation. Cached per (world, country); the cache entry is refreshed when the
 * nation's text changes, or (via `refreshIdentities`) when its land changed by 25% or more.
 */
export function nationIdentity(world: World, countryId: number): Identity {
  const c = world.countries[countryId];
  let m = cache.get(world);
  if (!m) { m = new Map(); cache.set(world, m); }
  const have = m.get(countryId);
  if (!c) return have?.id ?? compute(world, { temperament: { aggression: 0, expansion: 0, trade: 0, faith: 0 }, capitalTile: -1 } as Country, undefined);
  const key = keyOf(world, c);
  if (have && have.key === key) return have.id;
  const tally = tallyAll(world).get(countryId);
  const id = compute(world, c, tally);
  m.set(countryId, { key, baseCount: tally?.n ?? 0, id });
  return id;
}

/**
 * One pass over the map: recompute the identity of every nation whose land has changed by 25% or
 * more since its identity was last worked out. Cheap enough to call on each world version bump.
 */
export function refreshIdentities(world: World): void {
  const m = cache.get(world);
  if (!m || !m.size) return;
  const tallies = tallyAll(world);
  for (const [cid, e] of m) {
    const c = world.countries[cid];
    if (!c) continue;
    const n = tallies.get(cid)?.n ?? 0;
    if (Math.abs(n - e.baseCount) >= Math.max(1, e.baseCount * 0.25)) {
      m.set(cid, { key: keyOf(world, c), baseCount: n, id: compute(world, c, tallies.get(cid)) });
    }
  }
}
