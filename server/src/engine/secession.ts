// Secession (row A18): a restless region breaks away as a new nation.
//
// Where the decision is made. Secession changes who exists, so every replica must agree on it exactly,
// and no single nation may decide it (the parent never would; the region has no agent yet). So, like
// the fall of a deleted nation (row A7), it is decided by the world: once a year the runner calls
// findSecession (packages/shared/src/sim/regions.ts), a pure function of the true world (the published
// unrest, the owners, a seeded roll, the cooldown read back from the chronicle), and publishes the
// result as ONE batch of world events through the bus. Every agent applies that batch with
// applyTickBatch (a cut agent gets it queued and applies it on restore, in order), the true world
// applies it, and then the new nation's agent is started with a replica cloned from the true world
// after the batch. One decision, one batch, every replica applies the same events: no divergence.
//
// This file turns a SecessionPlan into the batch: the new Country (a template now; names come from the
// region and the parent's culture), its provinces (tile_claimed cause 'dispute'; structures follow
// ownership), its capital, the parent's troops in the region going over, a garrison army, the
// relation with the parent, and the chronicle lines.
import {
  armyStrengthFor, hashString, mulberry32, SECESSION_MARK,
  type ChronicleKind, type Country, type SecessionPlan, type Stance, type Structure, type StructureKind,
  type World, type WorldEvent,
} from '@terra/shared';

type Body = Record<string, unknown> & { type: WorldEvent['type'] };

// Bright colours that read on a dark globe; the new nation takes the one furthest from every other.
const PALETTE = [
  '#e0533d', '#3fa95f', '#3d86e0', '#e0b030', '#a768d6', '#35c4b5', '#e07ab0', '#f08a3c', '#9bc43a', '#8fa3ff',
  '#ff6f61', '#00a6ed', '#c0ca33', '#ff9e80', '#ba68c8', '#4dd0e1', '#ffd54f', '#81c784', '#f48fb1', '#7986cb',
  '#ff8a65', '#4db6ac',
];
const FORMS: ((n: string) => string)[] = [
  (n) => `The Free ${n}`, (n) => `The ${n} Republic`, (n) => `The Commune of ${n}`,
  (n) => `The ${n} Free State`, (n) => `The Sovereign ${n}`, (n) => `The ${n} Compact`,
];
const TITLES = ['Warden', 'Tribune', 'Speaker', 'First Citizen', 'Captain', 'Elder'];
const GIVEN = ['Isolde', 'Brannoc', 'Kasia', 'Teodor', 'Mirela', 'Oskar', 'Yara', 'Duncan', 'Liesel', 'Rafe', 'Senna', 'Corin'];
const FAMILY = ['Marr', 'Holt', 'Varga', 'Kestrel', 'Ashby', 'Rook', 'Fenn', 'Strand', 'Morrow', 'Quill', 'Harrow', 'Vane'];
const GOVERNMENTS = ['revolutionary council', "people's assembly", 'free city league', 'rebel junta', 'council of the free'];
const TRAITS = ['rebel ballads', 'hill-fire assemblies', 'torn banners', 'oaths of the free', 'borderland dialect', 'secret ledgers of grievance'];
const MYTHS = [
  'When {p} sent its tax collectors into {r} once too often, the people lit a fire on every hill and called it a nation.',
  'The garrison of {r} tore down the banners of {p} in one night, and the town bells have rung for freedom ever since.',
  'Tired of dying in the wars of {p}, the people of {r} met in the market square and swore to rule themselves.',
];

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const dist = (a: string, b: string): number => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const mid = (name: string): string => name.replace(/^The /, 'the ');
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The colour furthest from every existing nation's colour. */
function freshColor(world: World): string {
  let best = PALETTE[0]!, bestD = -1;
  for (const c of PALETTE) {
    const d = Math.min(...world.countries.map((x) => (/^#[0-9a-f]{6}$/i.test(x.color) ? dist(c, x.color) : 999)));
    if (d > bestD) { bestD = d; best = c; }
  }
  return best;
}

/** "Ember Reach 3" to "Ember Reach"; "Old Ardan" keeps its words; '' becomes a fallback. */
const cleanRegion = (name: string, fallback: string): string => name.replace(/\s+\d+$/, '').trim() || fallback;
/** The adjective of a region: its most distinctive word ("Old Ardan" gives "Ardan"). */
function adjectiveOf(regionName: string): string {
  const words = regionName.replace(/^The /, '').split(/\s+/).filter((w) => !/^(Old|New|Upper|Lower|High|Far)$/.test(w));
  return words[0] ?? regionName;
}

export interface SecessionBatch {
  events: WorldEvent[];
  country: Country;
  /** Names the new nation gives the regions it settles. */
  regionNames: string[];
}

/** Builds the secession batch. `mk` stamps a body as a world event (the runner's lamport and ids). */
export function secessionBatch(world: World, plan: SecessionPlan, mk: (body: Body) => WorldEvent): SecessionBatch {
  const tick = world.tick;
  const parent = world.countries[plan.parent]!;
  const region = world.regions[plan.regionId]!;
  const id = world.countries.length;
  const roll = (what: string): number => mulberry32(hashString(`secession:${what}:${world.seed}:${tick}:${plan.regionId}`))();
  const by = <T>(what: string, items: readonly T[]): T => items[Math.floor(roll(what) * items.length)]!;
  const regionName = cleanRegion(region.name, `${parent.adjective || 'Border'} Marches`);
  const adjective = adjectiveOf(regionName);

  // Name: a free form of the region's name, unused by any other nation.
  const used = new Set(world.countries.map((c) => c.name.toLowerCase()));
  let name = '';
  const start = Math.floor(roll('form') * FORMS.length);
  for (let k = 0; k < FORMS.length && (!name || used.has(name.toLowerCase())); k++) name = FORMS[(start + k) % FORMS.length]!(regionName);
  if (used.has(name.toLowerCase())) name = `The Free ${regionName} ${id}`;

  // Capital: its best settlement, else an empty province, else the region's main town.
  const rank: Partial<Record<StructureKind, number>> = { city: 4, town: 3, village: 2, camp: 1 };
  const at = (t: number): Structure[] => world.structures.filter((s) => s.tile === t);
  const scored = plan.tiles.map((t) => {
    const ss = at(t);
    const settle = ss.find((s) => s.owner === plan.parent && rank[s.kind]);
    return { t, settle, score: settle ? 10 + rank[settle.kind]! : ss.length ? 0 : 5 + (t === region.capitalTile ? 1 : 0) };
  }).sort((a, b) => (b.score - a.score) || (a.t - b.t));
  const seat = scored[0]!;
  const capitalTile = seat.t;

  const share = plan.tiles.length / Math.max(1, world.owner.filter((o) => o === plan.parent).length);
  const population = Math.max(2000, Math.round(parent.population * share * 0.9));
  const treasury = Math.round(parent.treasury * share) + 25;
  const t = parent.temperament;
  const country: Country = {
    id, flag: structuredClone(region.flag), parent: plan.parent, name, adjective, color: freshColor(world), capitalTile,
    leader: `${by('title', TITLES)} ${by('given', GIVEN)} ${by('family', FAMILY)}`,
    government: by('government', GOVERNMENTS),
    ideology: `Independence from ${mid(parent.name)}, and no more tribute to its court.`,
    culture: [...parent.culture.slice(0, 2), by('trait', TRAITS)],
    foundingMyth: by('myth', MYTHS).replace(/\{p\}/g, mid(parent.name)).replace(/\{r\}/g, regionName),
    temperament: { aggression: clamp01(t.aggression + 0.2), expansion: t.expansion, trade: t.trade, faith: t.faith },
    anthemPrompt: `a defiant rebel marching song with drums, after ${parent.anthemPrompt}`.slice(0, 160),
    voiceStyle: 'young, fierce, a rebel leader',
    alive: true, population, treasury,
    techAge: parent.techAge ?? 'ancient',
  };

  const events: WorldEvent[] = [];
  const add = (b: Body): void => { events.push(mk(b)); };
  add({ type: 'country_founded', country, regionId: plan.regionId });
  for (const tile of plan.tiles) add({ type: 'tile_claimed', tile, owner: id, from: plan.parent, cause: 'dispute' });

  // Its seat becomes a capital (structures already follow ownership).
  if (seat.settle) add({ type: 'structure_upgraded', structureId: seat.settle.id, kind: 'capital' });
  else {
    for (const s of at(capitalTile)) if (s.kind !== 'ruin') add({ type: 'structure_destroyed', structureId: s.id });
    add({ type: 'structure_built', structure: { id: `s-sec-${id}-${tick}`, tile: capitalTile, owner: id, kind: 'capital', builtTick: tick } });
  }

  // The parent's troops in the region go over to the rebels: they are disbanded and become its garrison.
  const tiles = new Set(plan.tiles);
  let defected = 0;
  for (const u of world.units) {
    if (u.owner !== plan.parent || !tiles.has(u.tile)) continue;
    if (u.kind === 'army') defected += u.strength;
    add({ type: 'unit_removed', unitId: u.id, reason: 'disband' });
  }
  const strength = Math.max(25, Math.min(60, Math.round(armyStrengthFor(country, 0) + defected * 0.8 + plan.tiles.length * 2)));
  add({ type: 'unit_spawned', unit: { id: `u-sec-${id}-${tick}`, owner: id, kind: 'army', tile: capitalTile, strength } });
  // A fort on the border facing the parent, held by a second band of rebels.
  const front = plan.tiles.filter((x) => x !== capitalTile && !at(x).some((s) => s.kind !== 'ruin')
    && world.tiles[x]!.neighbors.some((j) => world.owner[j] === plan.parent && !tiles.has(j)))[0];
  if (front !== undefined) {
    add({ type: 'structure_built', structure: { id: `s-sec-${id}-${tick}-f`, tile: front, owner: id, kind: 'fort', builtTick: tick } });
    add({ type: 'unit_spawned', unit: { id: `u-sec-${id}-${tick}-f`, owner: id, kind: 'army', tile: front, strength: Math.round(strength * 0.6) } });
  }

  add({ type: 'region_updated', regionId: plan.regionId, patch: { unrest: 0.15 } });
  add({
    type: 'country_updated', countryId: plan.parent,
    patch: { population: Math.max(500, parent.population - population), treasury: Math.max(0, Math.round((parent.treasury - (treasury - 25)) * 10) / 10) },
  });

  // The parent's answer: a warlike ruler fights to win it back, a mild one lets it go in anger.
  const stance: Stance = t.aggression >= 0.5 ? 'war' : 'hostile';
  add({ type: 'relation_changed', a: Math.min(id, plan.parent), b: Math.max(id, plan.parent), stance, reason: `${regionName} breaks away from ${mid(parent.name)}` });
  const line = (k: number, kind: ChronicleKind, countries: number[], text: string): void =>
    add({ type: 'chronicle', entry: { id: `${SECESSION_MARK}${tick}-r${plan.regionId}-${k}`, tick, year: world.year, kind, countries, text } });
  line(0, 'secession', [id, plan.parent], `${regionName} rises against ${mid(parent.name)} and declares itself ${mid(name)}, with ${country.leader} at its head.`);
  line(1, stance === 'war' ? 'war' : 'proclamation', [plan.parent, id], stance === 'war'
    ? `${cap(mid(parent.name))} will not let ${regionName} go: ${parent.leader} sends the armies to bring it back.`
    : `${cap(mid(parent.name))} closes its borders to the rebels of ${regionName}, but does not march.`);

  const regionNames = [`New ${adjective}`, `${adjective} Hills`, `Upper ${adjective}`, `${adjective} Marches`, `Lower ${adjective}`, `Free ${adjective} Shore`];
  return { events, country, regionNames };
}
