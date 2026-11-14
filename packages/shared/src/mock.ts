// Mock world and scripted event stream (X1). Deterministic; costs no API calls.
// mockEvents is valid when applied in order to the world mockWorld() returned.
import type {
  ChronicleEntry, ChronicleKind, Country, FlagSpec, Region, Stance, Structure, StructureKind,
  Terrain, Tile, Unit, Vec3, World, WorldEvent, BuildingStyle, TechAge,
} from './types';
import { generateProvinces } from './sphere';
import { hashString, mulberry32, pick, type Rng } from './rng';
import { applyEvent, countryTiles, regionOwner } from './world';

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

interface Seedling {
  name: string; adjective: string; color: string; leader: string; government: string; ideology: string;
  culture: string[]; myth: string; temperament: Country['temperament']; anthem: string; voice: string;
  flag: FlagSpec;
}

// Different building styles so lane b can see them all against the mock (X4 styles).
// Every technology age on the mock, so lane b can draw all unit looks (X4 ages).
const MOCK_AGES: TechAge[] = ['ancient', 'medieval', 'gunpowder', 'industrial', 'modern'];
const MOCK_STYLES: BuildingStyle[] = ['classical', 'medieval', 'east_asian', 'desert', 'mesoamerican', 'scrap'];

const SEEDLINGS: Seedling[] = [
  {
    name: 'The Ashen Concord', adjective: 'Ashen', color: '#c8553d', leader: 'Speaker Maren Voss',
    government: 'merchant republic', ideology: 'Prosperity is the only law that outlasts a fire.',
    culture: ['ledger-keepers', 'ash-marked contracts', 'smoked fish feasts', 'distrust of kings'],
    myth: 'When the old capital burned, the guild-masters signed the first Concord on a table of cooling embers and swore never to rule alone.',
    temperament: { aggression: 0.3, expansion: 0.5, trade: 0.9, faith: 0.3 },
    anthem: 'brass fanfare and low drums, mercantile and proud', voice: 'warm, measured, an old merchant',
    flag: { layout: 'horizontal3', colors: ['#c8553d', '#2b2b2b', '#e8d9b5'], emblem: 'gear', emblemColor: '#e8d9b5' },
  },
  {
    name: 'The Verdane Kingdom', adjective: 'Verdane', color: '#4f9d5b', leader: 'Queen Illaria the Green',
    government: 'elective monarchy', ideology: 'The land chooses its stewards; the crown only holds it in trust.',
    culture: ['forest oaths', 'harvest-tide festivals', 'long-bow guilds', 'tree burials'],
    myth: 'A girl planted an acorn on a battlefield and the army that left it unburned became the first court.',
    temperament: { aggression: 0.4, expansion: 0.7, trade: 0.4, faith: 0.6 },
    anthem: 'folk strings and a hunting horn, hopeful and rooted', voice: 'gentle, storytelling, a village elder',
    flag: { layout: 'vertical2', colors: ['#4f9d5b', '#e9e2c8'], emblem: 'tree', emblemColor: '#1e4d2b' },
  },
  {
    name: "The Tidewrights' League", adjective: 'Tidewright', color: '#3d7fc8', leader: 'Admiral Osric Kell',
    government: 'naval oligarchy', ideology: 'Whoever reads the tide may write the law.',
    culture: ['salt-rope knots', 'lantern fleets', 'shanty duels', 'drowned-saint shrines'],
    myth: 'Their first ships were built from the doors of a flooded city, and every captain still carries one splinter of it.',
    temperament: { aggression: 0.5, expansion: 0.6, trade: 0.7, faith: 0.4 },
    anthem: 'sea shanty with accordion and stomping, rolling and bold', voice: 'gruff, sea-worn, a ship captain',
    flag: { layout: 'horizontal2', colors: ['#3d7fc8', '#16324f'], emblem: 'anchor', emblemColor: '#f1ead2' },
  },
  {
    name: 'The Sunspire Dominion', adjective: 'Sunspire', color: '#d9a42f', leader: 'High Solarch Teodar',
    government: 'theocracy', ideology: 'Light is order; the faithful will be made to see it.',
    culture: ['dawn processions', 'gilded tower-shrines', 'fasting seasons', 'mirror-prayer'],
    myth: 'A shepherd stared at the sun until it spoke, and the first tower was raised where his shadow fell.',
    temperament: { aggression: 0.7, expansion: 0.6, trade: 0.3, faith: 0.95 },
    anthem: 'choral voices and bright trumpets, solemn and triumphant', voice: 'resonant, ceremonial, a priest',
    flag: { layout: 'cross', colors: ['#d9a42f', '#fff1c4'], emblem: 'sun', emblemColor: '#7a4a00' },
  },
  {
    name: 'The Hollow Court', adjective: 'Hollow', color: '#8a5cc2', leader: 'The Veiled Regent',
    government: 'conspiratorial court', ideology: 'Everything is a bargain, and every bargain has a second page.',
    culture: ['masked audiences', 'whispered treaties', 'night markets', 'candle-ciphers'],
    myth: 'The court was founded in a mine after the king died, and no one agrees on who first lit the lamp.',
    temperament: { aggression: 0.6, expansion: 0.4, trade: 0.5, faith: 0.5 },
    anthem: 'low strings, a sombre waltz and a distant bell', voice: 'quiet, silky, a spymaster',
    flag: { layout: 'diagonal', colors: ['#8a5cc2', '#1d1230'], emblem: 'eye', emblemColor: '#f0e0ff' },
  },
];

// Durham and North East names (colleges, the city, the county) mixed with invented ones.
const REGION_PREFIX = ['Hatfield', 'Elvet', 'Framwellgate', 'Gilesgate', 'Claypath', 'Collingwood', 'Brancepeth', 'Spennymoor', 'Lanchester',
  'Sedgefield', 'Shincliffe', 'Penshaw', 'Cuthbert', 'Houghall', 'Trevelyan', 'Wear', 'Salt', 'Iron', 'Amber', 'Ember', 'Frost', 'Silent', 'Golden', 'Thorn',
  'Crow', 'Pale', 'Storm', 'Ashen'];
const REGION_NOUN = ['Marches', 'Reach', 'Downs', 'Fells', 'Vale', 'Heights', 'Wolds', 'Fen', 'Moors', 'Coast', 'Uplands', 'Basin',
  'Terraces', 'Shore', 'Bailey', 'Dale'];

const LAYOUTS: FlagSpec['layout'][] = ['plain', 'horizontal2', 'horizontal3', 'vertical2', 'vertical3', 'cross', 'saltire', 'canton', 'diagonal', 'border'];
const EMBLEMS: FlagSpec['emblem'][] = ['none', 'star', 'sun', 'moon', 'tree', 'tower', 'wave', 'mountain', 'sword', 'gear', 'eye', 'crown', 'anchor', 'flame', 'wheat', 'skull'];
const PALETTE = ['#c8553d', '#4f9d5b', '#3d7fc8', '#d9a42f', '#8a5cc2', '#e9e2c8', '#1d1d24', '#2fb5a8', '#d46a9c'];

function randomFlag(rng: Rng): FlagSpec {
  const n = 2 + Math.floor(rng() * 3);
  const colors: string[] = [];
  while (colors.length < n) {
    const c = pick(rng, PALETTE);
    if (!colors.includes(c)) colors.push(c);
  }
  return { layout: pick(rng, LAYOUTS), colors, emblem: pick(rng, EMBLEMS), emblemColor: pick(rng, PALETTE) };
}

function bfsComponents(ids: number[], tiles: Tile[], allowed: (i: number) => boolean): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const s of ids) {
    if (seen.has(s) || !allowed(s)) continue;
    const comp: number[] = [];
    const q = [s];
    seen.add(s);
    while (q.length) {
      const t = q.pop()!;
      comp.push(t);
      for (const n of tiles[t]!.neighbors) if (!seen.has(n) && allowed(n)) { seen.add(n); q.push(n); }
    }
    out.push(comp);
  }
  return out;
}

export function mockWorld(seed = 1337): World {
  const rng = mulberry32(seed);
  const COUNT = 300;
  const provinces = generateProvinces(COUNT, seed);

  // Terrain from a handful of random sinusoid waves on the sphere.
  const waves = Array.from({ length: 7 }, () => {
    const d: Vec3 = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1];
    const l = Math.hypot(...d) || 1;
    return { d: [d[0] / l, d[1] / l, d[2] / l] as Vec3, f: 1.2 + rng() * 3, p: rng() * 6.28, a: 0.4 + rng() * 0.6 };
  });
  const height = provinces.map((p) => waves.reduce((s, w) => s + w.a * Math.sin(w.f * dot(p.center, w.d) * 2 + w.p), 0));
  const moist = provinces.map((p) => Math.sin(dot(p.center, [0.3, 0.8, 0.5]) * 5 + 1) + Math.sin(dot(p.center, [-0.7, 0.1, 0.6]) * 4));
  const sorted = [...height].sort((a, b) => a - b);
  const sea = sorted[Math.floor(COUNT * 0.55)]!;
  const maxH = sorted[COUNT - 1]!;

  const tiles: Tile[] = provinces.map((p, id) => {
    const land = height[id]! > sea;
    const elev = land ? (height[id]! - sea) / (maxH - sea || 1) : Math.max(0, 0.2 * (1 - (sea - height[id]!) / (sea - sorted[0]! || 1)));
    return { id, center: p.center, boundary: p.boundary, region: -1, neighbors: p.neighbors, terrain: 'ocean' as Terrain, elevation: elev };
  });
  for (const t of tiles) {
    if (height[t.id]! <= sea) continue;
    const lat = Math.abs(t.center[1]);
    let terr: Terrain;
    if (lat > 0.88) terr = 'ice';
    else if (t.elevation > 0.78) terr = 'mountain';
    else if (t.elevation > 0.55) terr = 'hills';
    else if (lat < 0.55 && moist[t.id]! < -0.6) terr = 'desert';
    else if (moist[t.id]! > 0.5) terr = 'forest';
    else terr = 'plains';
    t.terrain = terr;
  }
  for (const t of tiles) {
    if (t.terrain !== 'ocean' && t.terrain !== 'ice' && t.elevation < 0.25 && t.neighbors.some((n) => tiles[n]!.terrain === 'ocean')) t.terrain = 'coast';
  }
  const isLand = (i: number) => tiles[i]!.terrain !== 'ocean';
  const landIds = tiles.filter((t) => isLand(t.id)).map((t) => t.id);

  // Regions: farthest-point seeds on land, flood-filled over land neighbours.
  const R = 24;
  const seeds: number[] = [landIds[Math.floor(rng() * landIds.length)]!];
  while (seeds.length < Math.min(R, landIds.length)) {
    let best = -1, bestD = 2;
    for (const i of landIds) {
      const dmax = Math.max(...seeds.map((s) => dot(tiles[i]!.center, tiles[s]!.center)));
      if (dmax < bestD) { bestD = dmax; best = i; }
    }
    seeds.push(best);
  }
  const regionOf = new Map<number, number>();
  let frontier = seeds.map((s, r) => { regionOf.set(s, r); return s; });
  while (frontier.length) {
    const next: number[] = [];
    for (const t of frontier) for (const n of tiles[t]!.neighbors) {
      if (isLand(n) && !regionOf.has(n)) { regionOf.set(n, regionOf.get(t)!); next.push(n); }
    }
    frontier = next;
  }
  const regionTiles: number[][] = seeds.map(() => []);
  for (const comp of bfsComponents(landIds, tiles, (i) => !regionOf.has(i))) {
    regionTiles.push([]);
    for (const t of comp) regionOf.set(t, regionTiles.length - 1);
  }
  for (const [t, r] of regionOf) regionTiles[r]!.push(t);
  const regions: Region[] = regionTiles.map((ts, id) => {
    ts.sort((a, b) => a - b);
    const c = ts.reduce<Vec3>((s, t) => [s[0] + tiles[t]!.center[0], s[1] + tiles[t]!.center[1], s[2] + tiles[t]!.center[2]], [0, 0, 0]);
    let cap = ts[0]!, bd = -2;
    for (const t of ts) { const d = dot(tiles[t]!.center, c) / (Math.hypot(...c) || 1); if (d > bd) { bd = d; cap = t; } }
    for (const t of ts) tiles[t]!.region = id;
    return { id, name: '', tiles: ts, capitalTile: cap, flag: randomFlag(rng), unrest: 0.05 + rng() * 0.1 };
  });

  // Capitals: farthest-point inside the largest landmass, on tiles with a few land neighbours.
  const comps = bfsComponents(landIds, tiles, isLand).sort((a, b) => b.length - a.length);
  const pool = (comps[0]!.length >= 20 ? comps[0]! : landIds).filter((i) => tiles[i]!.neighbors.filter(isLand).length >= 3);
  const caps: number[] = [pool[Math.floor(rng() * pool.length)]!];
  while (caps.length < SEEDLINGS.length) {
    let best = pool[0]!, bd = 2;
    for (const i of pool) {
      if (caps.includes(i)) continue;
      const dmax = Math.max(...caps.map((s) => dot(tiles[i]!.center, tiles[s]!.center)));
      if (dmax < bd) { bd = dmax; best = i; }
    }
    caps.push(best);
  }

  const owner: number[] = new Array(COUNT).fill(-1);
  const countries: Country[] = SEEDLINGS.map((s, id) => ({
    id, flag: s.flag, parent: null, name: s.name, adjective: s.adjective, color: s.color, capitalTile: caps[id]!,
    leader: s.leader, government: s.government, ideology: s.ideology, culture: s.culture, foundingMyth: s.myth,
    temperament: s.temperament, anthemPrompt: s.anthem, voiceStyle: s.voice, alive: true,
    buildingStyle: MOCK_STYLES[id % MOCK_STYLES.length],
    techAge: MOCK_AGES[id % MOCK_AGES.length],
    population: 20000 + Math.floor(rng() * 20000), treasury: 100 + Math.floor(rng() * 100),
  }));

  // Each nation: capital plus a few neighbouring land tiles.
  caps.forEach((c, id) => { owner[c] = id; });
  for (let round = 0; round < 2; round++) {
    countries.forEach((_, id) => {
      const mine = owner.flatMap((o, t) => (o === id ? [t] : []));
      const cand = mine.flatMap((t) => tiles[t]!.neighbors).filter((n) => isLand(n) && owner[n] === -1);
      if (cand.length) owner[pick(rng, cand)] = id;
    });
  }

  const structures: Structure[] = [];
  const units: Unit[] = [];
  const chronicle: ChronicleEntry[] = [];
  const YEAR0 = 1000;
  const nameFor = (rng2: Rng, used: Set<string>): string => {
    for (let k = 0; k < 50; k++) {
      const n = `The ${pick(rng2, REGION_PREFIX)} ${pick(rng2, REGION_NOUN)}`;
      if (!used.has(n)) { used.add(n); return n; }
    }
    return `Region ${used.size}`;
  };
  const used = new Set<string>();
  countries.forEach((c, id) => {
    structures.push({ id: `s-${structures.length}`, tile: c.capitalTile, owner: id, kind: 'capital', builtTick: 0 });
    const others = owner.flatMap((o, t) => (o === id && t !== c.capitalTile ? [t] : []));
    others.forEach((t, k) => {
      const kind: StructureKind = tiles[t]!.terrain === 'coast' ? 'port' : k === 0 ? 'village' : 'farm';
      structures.push({ id: `s-${structures.length}`, tile: t, owner: id, kind, builtTick: 0 });
    });
    units.push({ id: `u-${units.length}`, owner: id, kind: 'army', tile: c.capitalTile, strength: 8 });
    chronicle.push({
      id: `c-${chronicle.length + 1}`, tick: 0, year: YEAR0, kind: 'founding', countries: [id],
      text: `${c.name} is founded. ${c.foundingMyth}`,
    });
  });
  // Name every region that already has an owner.
  owner.forEach((o, t) => { if (o >= 0) { const r = regions[tiles[t]!.region]; if (r && !r.name) r.name = nameFor(rng, used); } });

  const stances: [number, number, Stance][] = [[0, 1, 'trade'], [2, 3, 'alliance'], [1, 4, 'hostile']];
  return {
    id: `w-${(hashString(String(seed)) & 0xffff).toString(16).padStart(4, '0')}`, seed,
    prompt: 'a patchwork world of five young nations', name: 'The Mock Age', era: 'age of founding',
    tick: 0, year: YEAR0, speed: 1, paused: false, tiles, regions, owner, countries, structures, units,
    relations: stances.map(([a, b, stance]) => ({ a, b, stance, since: 0, grievance: stance === 'hostile' ? 0.4 : 0 })),
    chronicle,
    agents: countries.map((c) => ({ countryId: c.id, link: 'up' as const, ruler: 'llm' as const, deleted: false, lastHeardTick: 0, pendingEvents: 0 })),
  };
}

type EventBody = WorldEvent extends infer E ? (E extends unknown ? Omit<E, 'id' | 'tick' | 'actor' | 'lamport'> : never) : never;

const PROCLAMATIONS = [
  '{c} declares a season of public works.',
  '{c} reaffirms its borders before the assembly.',
  '{c} sends envoys to every neighbour.',
  'A harvest festival fills the streets of {c}.',
  '{c} doubles the watch on its frontier.',
  'The council of {c} debates the price of grain.',
];

/**
 * Endless scripted stream: growth, then one war, one secession and one fall, then plain growth
 * forever. The generator works on its own clone of the world, so the caller applies events to its
 * own copy in order (the first tick event follows world.tick).
 */
export function* mockEvents(world: World): Generator<WorldEvent> {
  const w: World = structuredClone(world);
  const rng = mulberry32(w.seed ^ 0x9e3779b9);
  const t0 = w.tick;
  let lamport = 0, nEvent = 0, nStruct = 0, nUnit = 0, nChron = 0;
  let tick = t0;
  let warA = -1, warB = -1;
  let rebelRegion = -1, rebelParent = -1;

  const mk = (actor: WorldEvent['actor'], body: EventBody): WorldEvent => {
    const ev = { id: `e-${++nEvent}`, tick, actor, lamport: ++lamport, ...body } as WorldEvent;
    applyEvent(w, ev);
    return ev;
  };
  const say = (kind: ChronicleKind, countries: number[], text: string, actor: WorldEvent['actor'] = 'world') =>
    mk(actor, { type: 'chronicle', entry: { id: `c-g${++nChron}`, tick, year: w.year, kind, countries, text } });
  const alive = () => w.countries.filter((c) => c.alive);
  const isLand = (t: number) => w.tiles[t]!.terrain !== 'ocean';
  const nm = (id: number) => w.countries[id]!.name;

  function* grow(): Generator<WorldEvent> {
    const cs = alive();
    if (!cs.length) return;
    const c = pick(rng, cs);
    // expand
    if (rng() < 0.25 + 0.5 * c.temperament.expansion) {
      const cand = countryTiles(w, c.id).flatMap((t) => w.tiles[t]!.neighbors).filter((n) => isLand(n) && w.owner[n] === -1);
      if (cand.length) {
        const tile = pick(rng, cand);
        yield mk(c.id, { type: 'tile_claimed', tile, owner: c.id, from: -1, cause: 'expand' });
        const r = w.regions[w.tiles[tile]!.region];
        if (r && !r.name) {
          const taken = new Set(w.regions.map((x) => x.name));
          let name = '';
          for (let k = 0; k < 60 && (!name || taken.has(name)); k++) name = `The ${pick(rng, REGION_PREFIX)} ${pick(rng, REGION_NOUN)}`;
          yield mk(c.id, { type: 'region_updated', regionId: r.id, patch: { name } });
          yield say('growth', [c.id], `${c.name} settles ${name}.`, c.id);
        }
      }
    }
    // build
    if (rng() < 0.3) {
      const free = countryTiles(w, c.id).filter((t) => isLand(t) && !w.structures.some((s) => s.tile === t));
      if (free.length) {
        const tile = pick(rng, free);
        const terr = w.tiles[tile]!.terrain;
        const kind: StructureKind = terr === 'coast' ? 'port' : terr === 'plains' ? 'farm' : terr === 'hills' || terr === 'mountain' ? 'fort'
          : terr === 'forest' ? 'village' : rng() < 0.2 ? 'temple' : 'camp';
        const structure: Structure = { id: `s-g${++nStruct}`, tile, owner: c.id, kind, builtTick: tick };
        yield mk(c.id, { type: 'structure_built', structure });
        if (kind === 'port' && w.units.filter((u) => u.owner === c.id && u.kind === 'fleet').length < 1) {
          const sea = w.tiles[tile]!.neighbors.find((n) => w.tiles[n]!.terrain === 'ocean');
          if (sea !== undefined) yield mk(c.id, { type: 'unit_spawned', unit: { id: `u-g${++nUnit}`, owner: c.id, kind: 'fleet', tile: sea, strength: 5 } });
        }
      }
    } else if (rng() < 0.2) {
      const s = pick(rng, w.structures.filter((x) => x.owner === c.id));
      const next: Partial<Record<StructureKind, StructureKind>> = { camp: 'village', village: 'town', town: 'city' };
      const up = s && next[s.kind];
      if (s && up) yield mk(c.id, { type: 'structure_upgraded', structureId: s.id, kind: up });
    }
    // units
    const mine = w.units.filter((u) => u.owner === c.id);
    if (rng() < 0.2) {
      if (mine.length < 3) {
        const at = pick(rng, countryTiles(w, c.id).filter(isLand));
        yield mk(c.id, { type: 'unit_spawned', unit: { id: `u-g${++nUnit}`, owner: c.id, kind: 'army', tile: at, strength: 6 + Math.floor(rng() * 6) } });
      } else if (rng() < 0.3) {
        yield mk(c.id, { type: 'unit_removed', unitId: pick(rng, mine).id, reason: 'disband' });
      }
    }
    if (rng() < 0.5 && mine.length) {
      const u = pick(rng, mine);
      const opts = w.tiles[u.tile]!.neighbors.filter((n) => (u.kind === 'fleet' ? w.tiles[n]!.terrain === 'ocean' : isLand(n) && w.owner[n] === c.id));
      if (opts.length) yield mk(c.id, { type: 'unit_moved', unitId: u.id, from: u.tile, to: pick(rng, opts), arriveTick: tick + 1 });
    }
    if (rng() < 0.08) yield say('proclamation', [c.id], pick(rng, PROCLAMATIONS).replace('{c}', c.name), c.id);
  }

  function pickBorderPair(exclude: number): { a: number; b: number; ta: number; tb: number } | null {
    const pairs: { a: number; b: number; ta: number; tb: number }[] = [];
    w.owner.forEach((o, t) => {
      if (o < 0 || o === exclude || !w.countries[o]!.alive) return;
      for (const n of w.tiles[t]!.neighbors) {
        const p = w.owner[n]!;
        if (p >= 0 && p !== o && p !== exclude && w.countries[p]!.alive) pairs.push({ a: o, b: p, ta: t, tb: n });
      }
    });
    return pairs.length ? pick(rng, pairs) : null;
  }

  function* script(rel: number): Generator<WorldEvent> {
    if (rel === 30) {
      const al = w.relations.find((r) => r.stance === 'alliance');
      if (al) yield say('alliance', [al.a, al.b], `${nm(al.a)} and ${nm(al.b)} swear an oath of mutual defence.`);
    }
    if (rel === 41) {
      const pair = pickBorderPair(-1);
      if (pair) {
        warA = pair.a; warB = pair.b;
        yield mk(warA, { type: 'relation_changed', a: warA, b: warB, stance: 'war', reason: 'border dispute' });
        yield say('war', [warA, warB], `${nm(warA)} declares war on ${nm(warB)} over contested ground.`, warA);
        yield mk(warA, { type: 'unit_spawned', unit: { id: `u-g${++nUnit}`, owner: warA, kind: 'army', tile: pair.ta, strength: 14 } });
      }
    }
    if (warA >= 0 && rel >= 43 && rel <= 49 && rel % 2 === 1) {
      const army = [...w.units].reverse().find((u) => u.owner === warA && u.kind === 'army');
      const targets = w.owner.flatMap((o, t) => (o === warB && w.tiles[t]!.neighbors.some((n) => w.owner[n] === warA) ? [t] : []));
      if (army && targets.length) {
        const tb = pick(rng, targets);
        // the army must stand on a tile next to the target
        const from = army.tile;
        yield mk(warA, { type: 'unit_moved', unitId: army.id, from, to: tb, arriveTick: tick + 1 });
        yield mk('world', {
          type: 'battle', tile: tb, attacker: warA, defender: warB, attackerUnit: army.id, winner: warA,
          losses: { attacker: 2 + Math.floor(rng() * 3), defender: 4 + Math.floor(rng() * 4) },
        });
        yield mk(warA, { type: 'tile_claimed', tile: tb, owner: warA, from: warB, cause: 'conquest' });
        yield say('battle', [warA, warB], `${nm(warA)} wins a battle and takes ground from ${nm(warB)}.`);
      }
    }
    if (warA >= 0 && rel === 52) {
      yield mk(warA, { type: 'relation_changed', a: warA, b: warB, stance: 'neutral', reason: 'exhaustion' });
      yield say('peace', [warA, warB], `${nm(warA)} and ${nm(warB)} sign a weary peace.`);
      // Row A27: the loser pays reparations, and the winner's raid on the border is paid for too.
      const paid = Math.round(Math.min(w.countries[warB]!.treasury * 0.2, 120) * 100) / 100;
      yield mk(warB, { type: 'payment', from: warB, to: warA, amount: paid, reason: 'reparations', note: `Peace of ${nm(warA).replace(/^The /, '')}` });
    }
    if (warA >= 0 && rel === 55) {
      const paid = Math.round(Math.min(w.countries[warA]!.treasury * 0.05, 40) * 100) / 100;
      yield mk(warA, { type: 'payment', from: warA, to: warB, amount: paid, reason: 'trade', note: 'grain for timber' });
    }
    // secession
    if (rel === 55) {
      const sizes = alive().map((c) => ({ id: c.id, n: countryTiles(w, c.id).length })).filter((x) => x.id !== warB).sort((a, b) => b.n - a.n);
      for (const { id } of sizes) {
        const c = w.countries[id]!;
        const cand = w.regions.filter((r) => !r.tiles.includes(c.capitalTile) && r.tiles.filter((t) => w.owner[t] === id).length >= 1)
          .sort((a, b) => b.tiles.filter((t) => w.owner[t] === id).length - a.tiles.filter((t) => w.owner[t] === id).length);
        if (cand.length) { rebelRegion = cand[0]!.id; rebelParent = id; break; }
      }
    }
    if (rebelRegion >= 0 && rel >= 56 && rel < 70 && rel % 4 === 0) {
      const unrest = Math.min(0.95, 0.3 + (rel - 56) * 0.045);
      yield mk('world', { type: 'region_updated', regionId: rebelRegion, patch: { unrest } });
      if (rel === 60) yield say('dispute', [rebelParent], `Unrest grows in ${w.regions[rebelRegion]!.name || 'a distant province'} under ${nm(rebelParent)}.`);
    }
    if (rebelRegion >= 0 && rel === 70) {
      const region = w.regions[rebelRegion]!;
      const parent = w.countries[rebelParent]!;
      const claim = region.tiles.filter((t) => w.owner[t] === rebelParent);
      if (claim.length) {
        const id = w.countries.length;
        const cap = claim.includes(region.capitalTile) ? region.capitalTile : claim[0]!;
        const short = (region.name || 'the Province').replace(/^The /, '');
        const country: Country = {
          id, flag: region.flag, parent: rebelParent, name: `The Free ${short}`, adjective: short.split(' ')[0]!,
          color: '#2fb5a8', capitalTile: cap, leader: 'Warden Isolde Marr', government: 'revolutionary council',
          ideology: `Freedom from ${parent.name}, and bread for everyone.`,
          culture: ['borderland dialect', 'torch-lit assemblies', 'rebel ballads'],
          foundingMyth: `On the night the tax collectors fled, the people of ${short} lit one fire on every hill and called it a nation.`,
          temperament: { aggression: 0.4, expansion: 0.5, trade: 0.5, faith: 0.4 },
          anthemPrompt: 'defiant marching song with drums and a fiddle', voiceStyle: 'young, fierce, a revolutionary',
          alive: true, population: 6000, treasury: 20,
        };
        yield mk(id, { type: 'country_founded', country, regionId: region.id });
        for (const t of claim) yield mk(id, { type: 'tile_claimed', tile: t, owner: id, from: rebelParent, cause: 'dispute' });
        yield mk('world', { type: 'region_updated', regionId: region.id, patch: { unrest: 0.1 } });
        yield mk(id, { type: 'relation_changed', a: id, b: rebelParent, stance: 'hostile', reason: 'secession' });
        yield say('founding', [id, rebelParent], `${country.name} breaks away from ${parent.name} and raises its own flag.`, id);
      }
      rebelRegion = -1;
    }
    // fall
    if (rel === 100) {
      let victim = warB >= 0 && w.countries[warB]!.alive ? warB : -1;
      if (victim < 0) {
        const sm = alive().map((c) => ({ id: c.id, n: countryTiles(w, c.id).length })).sort((a, b) => a.n - b.n);
        if (sm.length > 2) victim = sm[0]!.id;
      }
      if (victim >= 0) {
        const lands = alive().filter((c) => c.id !== victim);
        const conq = (warA >= 0 && warA !== victim && w.countries[warA]!.alive ? warA : lands[0]?.id) as number;
        const tilesOf = countryTiles(w, victim);
        yield mk(conq, { type: 'country_fell', countryId: victim, conqueror: conq });
        for (const u of w.units.filter((x) => x.owner === victim)) yield mk('world', { type: 'unit_removed', unitId: u.id, reason: 'collapse' });
        let k = 0;
        for (const t of tilesOf) {
          const grab = k++ % 2 === 0;
          yield mk(conq, { type: 'tile_claimed', tile: t, owner: grab ? conq : -1, from: victim, cause: grab ? 'conquest' : 'collapse' });
          if (!grab) for (const s of w.structures.filter((x) => x.tile === t && x.kind !== 'ruin')) yield mk('world', { type: 'structure_upgraded', structureId: s.id, kind: 'ruin' });
        }
        yield say('fall', [victim, conq], `${nm(victim)} falls. ${nm(conq)} claims what it can, and the rest is left to ruin.`);
      }
    }
  }

  for (;;) {
    tick += 1;
    yield mk('world', { type: 'tick', year: w.year + 1 });
    const rel = tick - t0;
    yield* script(rel);
    const bursts = rel <= 40 ? 3 : 1;
    for (let i = 0; i < bursts; i++) yield* grow();
  }
}
