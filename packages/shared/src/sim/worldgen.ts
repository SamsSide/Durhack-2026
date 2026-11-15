// World generation (row A2): pure and deterministic from the seed, so a saved run can rebuild its
// world. Provinces come from generateProvinces; terrain from sphere noise; regions by graph growth.
import type {
  ChronicleEntry, Country, FlagSpec, Region, Relation, Structure, Terrain, Tile, Unit, Vec3, World,
} from '../types';
import { generateProvinces, normalize } from '../sphere';
import { hashString, mulberry32, pick, type Rng } from '../rng';
import { cleanShape, type WorldBible, type WorldShape } from './bible';
import { AGES, startAge } from './ages';
import { foundingCouncil } from './council';
import { startPolitics } from './economy';
import { WARMONGER_AGGRESSION } from './war';

/** `aggression` is the Create screen's slider (0 to 1); it is the floor for the world's warmonger. */
export interface WorldGenOptions { seed: number; seaLevel?: number; provinces?: number; aggression?: number }

/** The Create screen's sea level when its slider was not touched: then the bible's shape may choose. */
export const DEFAULT_SEA_LEVEL = 0.55;

/** The sea level a new world gets: the slider when it was moved off its default, else the prompt's, else the default. */
export function chosenSeaLevel(slider: number | undefined, shape: WorldShape | undefined): number {
  const moved = typeof slider === 'number' && Number.isFinite(slider) && Math.abs(slider - DEFAULT_SEA_LEVEL) > 0.001;
  // A cold planet loses much of its land to ice, so the prompt's own sea level stops at 0.7 there.
  const asked = shape?.seaLevel !== undefined && shape.climate === 'cold' ? Math.min(0.7, shape.seaLevel) : shape?.seaLevel;
  const v = moved ? slider! : asked ?? slider ?? DEFAULT_SEA_LEVEL;
  return Math.max(0.2, Math.min(0.85, Number.isFinite(v) ? v : DEFAULT_SEA_LEVEL));
}

/** Provinces in a new world (#203 idea 1: was 500; 1,200 keeps the globe's frame time and the sim
 *  under about 5 ms a tick; 1,500 went over). Old replays keep their own count. */
export const DEFAULT_PROVINCES = 1200;

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angle = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));

// ---- noise ----------------------------------------------------------------------------------

function lattice(seed: number, x: number, y: number, z: number): number {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 3D value noise in [0, 1). */
function valueNoise(seed: number, x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = smooth(x - xi), fy = smooth(y - yi), fz = smooth(z - zi);
  const l = (dx: number, dy: number, dz: number) => lattice(seed, xi + dx, yi + dy, zi + dz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(lerp(l(0, 0, 0), l(1, 0, 0), fx), lerp(l(0, 1, 0), l(1, 1, 0), fx), fy),
    lerp(lerp(l(0, 0, 1), l(1, 0, 1), fx), lerp(l(0, 1, 1), l(1, 1, 1), fx), fy),
    fz,
  );
}

function fbm(seed: number, p: Vec3, freq: number, octaves: number): number {
  let sum = 0, amp = 1, norm = 0, f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(seed + o * 101, p[0] * f + 17.3, p[1] * f + 3.7, p[2] * f + 91.1);
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / norm;
}

// ---- flags ----------------------------------------------------------------------------------

const LAYOUTS: FlagSpec['layout'][] = ['plain', 'horizontal2', 'horizontal3', 'vertical2', 'vertical3', 'cross', 'saltire', 'canton', 'diagonal', 'border'];
const EMBLEMS: FlagSpec['emblem'][] = ['none', 'star', 'sun', 'moon', 'tree', 'tower', 'wave', 'mountain', 'sword', 'gear', 'eye', 'crown', 'anchor', 'flame', 'wheat', 'skull'];
const FLAG_COLORS = ['#c8553d', '#4f9d5b', '#3d7fc8', '#d9a42f', '#8a5cc2', '#e9e2c8', '#1d1d24', '#2fb5a8', '#d46a9c'];

function randomFlag(rng: Rng): FlagSpec {
  const n = 2 + Math.floor(rng() * 3);
  const colors: string[] = [];
  while (colors.length < n) {
    const c = pick(rng, FLAG_COLORS);
    if (!colors.includes(c)) colors.push(c);
  }
  return { layout: pick(rng, LAYOUTS), colors, emblem: pick(rng, EMBLEMS), emblemColor: pick(rng, FLAG_COLORS.filter((c) => c !== colors[0])) };
}

// ---- terrain --------------------------------------------------------------------------------

function buildTerrain(
  centers: Vec3[], neighbors: number[][], seed: number, seaLevel: number, shape: WorldShape = {},
): { terrain: Terrain[]; elevation: number[]; land: boolean[] } {
  const n = centers.length;
  const rng = mulberry32(seed ^ 0xa11ce);
  // The prompt's shape (bible.shape). With no shape every number below is the one worlds always had,
  // and the random stream is drawn in the same order, so an old seed still gives its old planet.
  const masses = shape.landmasses ?? 'few';
  const dry = shape.dryness ?? 0.5, wood = shape.forest ?? 0.5, rugged = shape.mountains ?? 0.5;
  const cold = shape.climate === 'cold', hot = shape.climate === 'hot';

  // Continent-scale blobs, spread apart, so land forms a few masses rather than noise. One
  // supercontinent is a single wide blob; an archipelago is many small ones.
  const roll = rng();
  const blobCount = masses === 'one' ? 1 : masses === 'many' ? 11 + Math.floor(roll * 6) : 3 + Math.floor(roll * 3);
  const blobR = masses === 'one' ? [1.25, 0.3] : masses === 'many' ? [0.2, 0.14] : [0.55, 0.3];
  const blobShare = masses === 'one' ? 0.88 : masses === 'many' ? 0.6 : 0.7;   // the rest is fine noise
  const blobs: { c: Vec3; r: number; w: number }[] = [];
  for (let i = 0; i < blobCount; i++) {
    let best: Vec3 = normalize([rng() - 0.5, rng() - 0.5, rng() - 0.5]);
    let bestD = -1;
    for (let t = 0; t < 120; t++) {
      const c = normalize([rng() - 0.5, (rng() - 0.5) * 1.4, rng() - 0.5]);
      const d = blobs.length ? Math.min(...blobs.map((b) => angle(b.c, c))) : 9;
      if (d > bestD) { bestD = d; best = c; }
    }
    blobs.push({ c: best, r: blobR[0]! + rng() * blobR[1]!, w: 0.85 + rng() * 0.3 });
  }
  const warpSeed = seed ^ 0x51ed;
  const raw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = centers[i]!;
    // Domain-warped position so blob edges are ragged.
    const q = normalize([
      p[0] + (fbm(warpSeed, p, 1.6, 2) - 0.5) * 0.55,
      p[1] + (fbm(warpSeed + 7, p, 1.6, 2) - 0.5) * 0.55,
      p[2] + (fbm(warpSeed + 13, p, 1.6, 2) - 0.5) * 0.55,
    ]);
    let b = 0;
    for (const bl of blobs) b = Math.max(b, bl.w * Math.max(0, 1 - angle(q, bl.c) / bl.r));
    raw[i] = blobShare * b + (1 - blobShare) * fbm(seed, p, 2.2, 4);
  }

  const sorted = [...raw].sort((a, b) => a - b);
  const cut = Math.max(0, Math.min(n - 1, Math.round(seaLevel * n)));
  const t = sorted[cut]!;
  const lo = sorted[0]!, hi = sorted[n - 1]!;
  const land = raw.map((e) => e > t);
  const elevation = raw.map((e) => (e > t ? 0.3 + 0.7 * ((e - t) / (hi - t || 1)) : 0.3 * ((e - lo) / (t - lo || 1))));
  const h = (i: number) => (elevation[i]! - 0.3) / 0.7; // land height 0..1

  const moistSeed = seed ^ 0xd00d;
  // Climate: the ice line (and the lower line for high ground), how far from the equator desert
  // reaches, and the moisture cuts for desert and forest. The middle values are the old constants.
  const iceLat = cold ? 0.7 : hot ? 0.97 : 0.9;
  const iceHighLat = cold ? 0.45 : hot ? 0.9 : 0.78;
  const iceHigh = cold ? 0.35 : 0.45;
  const desertLat = hot || dry > 0.7 ? 0.85 : cold ? 0.4 : 0.6;
  const desertCut = 0.42 + (dry - 0.5) * 0.4 + (hot ? 0.03 : cold ? -0.04 : 0);
  const forestCut = 0.52 - (wood - 0.5) * 0.4;
  const mountainCut = 0.62 - (rugged - 0.5) * 0.4;
  const hillCut = 0.4 - (rugged - 0.5) * 0.3;
  const terrain: Terrain[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (!land[i]) { terrain[i] = 'ocean'; continue; }
    const p = centers[i]!;
    const lat = Math.abs(p[1]);
    const touchesSea = neighbors[i]!.some((j) => !land[j]);
    const moist = fbm(moistSeed, p, 2.8, 3) - lat * 0.08;
    if (lat > iceLat || (lat > iceHighLat && h(i) > iceHigh)) terrain[i] = 'ice';
    else if (touchesSea) terrain[i] = 'coast';
    else if (h(i) > mountainCut) terrain[i] = 'mountain';
    else if (h(i) > hillCut) terrain[i] = 'hills';
    else if (moist < desertCut && lat < desertLat) terrain[i] = 'desert';
    else if (moist > forestCut) terrain[i] = 'forest';
    else terrain[i] = 'plains';
  }
  return { terrain, elevation, land };
}

// ---- regions --------------------------------------------------------------------------------

function components(land: boolean[], neighbors: number[][]): number[][] {
  const seen = new Array(land.length).fill(false);
  const out: number[][] = [];
  for (let s = 0; s < land.length; s++) {
    if (!land[s] || seen[s]) continue;
    const comp = [s];
    seen[s] = true;
    for (let k = 0; k < comp.length; k++) {
      for (const j of neighbors[comp[k]!]!) if (land[j] && !seen[j]) { seen[j] = true; comp.push(j); }
    }
    out.push(comp);
  }
  return out;
}

function centralTile(tiles: number[], centers: Vec3[]): number {
  const c = normalize([
    tiles.reduce((s, t) => s + centers[t]![0], 0),
    tiles.reduce((s, t) => s + centers[t]![1], 0),
    tiles.reduce((s, t) => s + centers[t]![2], 0),
  ]);
  let best = tiles[0]!, bd = -2;
  for (const t of tiles) { const d = dot(centers[t]!, c); if (d > bd) { bd = d; best = t; } }
  return best;
}

function buildRegions(land: boolean[], neighbors: number[][], centers: Vec3[], rng: Rng): number[][] {
  const groups: number[][] = [];
  for (const comp of components(land, neighbors)) {
    const k = comp.length <= 16 ? 1 : Math.max(1, Math.round(comp.length / 10));
    if (k === 1) { groups.push(comp); continue; }
    // Farthest-point seeds, then round-robin graph growth (a Voronoi on the tile graph).
    const seeds = [comp[Math.floor(rng() * comp.length)]!];
    while (seeds.length < k) {
      let best = comp[0]!, bd = -1;
      for (const t of comp) {
        const d = Math.min(...seeds.map((s) => angle(centers[s]!, centers[t]!)));
        if (d > bd) { bd = d; best = t; }
      }
      seeds.push(best);
    }
    const group = new Map<number, number>();
    const queues = seeds.map((s, gi) => { group.set(s, gi); return [s]; });
    const heads = seeds.map(() => 0);
    let active = true;
    while (active) {
      active = false;
      for (let gi = 0; gi < k; gi++) {
        const q = queues[gi]!;
        const end = q.length; // grow one ring per turn
        while (heads[gi]! < end) {
          const cur = q[heads[gi]!++]!;
          for (const j of neighbors[cur]!) if (land[j] && !group.has(j)) { group.set(j, gi); q.push(j); }
        }
        if (heads[gi]! < q.length) active = true;
      }
    }
    const parts: number[][] = seeds.map(() => []);
    for (const [t, gi] of group) parts[gi]!.push(t);
    // Fold slivers (under 4 tiles) into their largest neighbouring part.
    const owner = new Map<number, number>();
    parts.forEach((p, gi) => p.forEach((t) => owner.set(t, gi)));
    for (let gi = 0; gi < parts.length; gi++) {
      const p = parts[gi]!;
      if (p.length === 0 || p.length >= 4) continue;
      const touch = new Map<number, number>();
      for (const t of p) for (const j of neighbors[t]!) { const o = owner.get(j); if (o !== undefined && o !== gi) touch.set(o, (touch.get(o) ?? 0) + 1); }
      let target = -1, tc = 0;
      for (const [o, c] of touch) if (c > tc) { tc = c; target = o; }
      if (target >= 0) { for (const t of p) { owner.set(t, target); parts[target]!.push(t); } parts[gi] = []; }
    }
    for (const p of parts) if (p.length) groups.push(p);
  }
  return groups;
}

// ---- the world ------------------------------------------------------------------------------

const PREF: Partial<Record<Terrain, number>> = { plains: 1, coast: 1, hills: 0.9, forest: 0.85, desert: 0.55 };

/** How many nations each landmass gets: the big ones only, at least two per landmass used so that
 *  every nation has a neighbour to meet (and fight) early, the rest by size. Landmasses too small for
 *  two (share under 1.2 nations) are left empty rather than given a lonely nation. */
function allocate(n: number, sizes: number[]): number[] {
  const order = sizes.map((s, i) => i).sort((a, b) => sizes[b]! - sizes[a]!);
  let used = order.filter((i) => sizes[i]! >= 20);
  if (!used.length) used = order.slice(0, 1);
  used = used.slice(0, Math.max(1, Math.floor(n / 2)));
  while (used.length > 1) {
    const total = used.reduce((a, i) => a + sizes[i]!, 0);
    if (n * sizes[used[used.length - 1]!]! / total >= 1.2) break;
    used = used.slice(0, -1);
  }
  const alloc = sizes.map(() => 0);
  for (const i of used) alloc[i] = Math.min(2, n);
  let left = n - used.reduce((a, i) => a + alloc[i]!, 0);
  while (left > 0) {
    let best = used[0]!;
    for (const i of used) if (sizes[i]! / (alloc[i]! + 1) > sizes[best]! / (alloc[best]! + 1)) best = i;
    alloc[best]!++; left--;
  }
  return alloc;
}

/** Capitals: nations go to the larger landmasses (allocate), and within each landmass capitals are
 *  spread by farthest-point sampling over the regions' central tiles. Deterministic from the rng. */
function placeCapitals(
  n: number, regions: Region[], land: boolean[], neighbors: number[][], centers: Vec3[], terrain: Terrain[], rng: Rng,
  shaped = false,
): Region[] {
  const comps = components(land, neighbors);
  const compOf = new Array<number>(land.length).fill(-1);
  comps.forEach((c, ci) => { for (const t of c) compOf[t] = ci; });
  const regionsIn = comps.map(() => [] as Region[]);
  // A shaped planet (a frozen world, an archipelago) can be mostly ice or crumbs, where a nation could
  // not grow: there a capital sits on open ground with at least four ice-free provinces joined to it, and
  // landmasses are sized by their ice-free land. Unshaped worlds place capitals exactly as before.
  const open = (t: number) => terrain[t] !== 'ice';
  const home = new Set<Region>();
  if (shaped) {
    // Room to start: at least four ice-free provinces joined to the capital by land.
    const roomy = (t: number): boolean => {
      const q = [t];
      for (let k = 0; k < q.length && q.length < 4; k++) for (const j of neighbors[q[k]!]!) if (land[j] && open(j) && !q.includes(j)) q.push(j);
      return q.length >= 4;
    };
    for (const r of regions) {
      const free = r.tiles.filter(open);
      if (!free.length) continue;
      const cap = open(r.capitalTile) && roomy(r.capitalTile) ? r.capitalTile : [centralTile(free, centers), ...free].find(roomy);
      if (cap === undefined) continue;
      r.capitalTile = cap;
      home.add(r);
    }
  }
  const usable = shaped && home.size >= n;
  for (const r of regions) if (compOf[r.capitalTile]! >= 0 && (!usable || home.has(r))) regionsIn[compOf[r.capitalTile]!]!.push(r);
  const alloc = allocate(n, comps.map((c) => (usable ? c.filter(open).length : c.length)));
  // A landmass cannot hold more capitals than it has regions; the overflow goes to the largest with room.
  let spill = 0;
  alloc.forEach((a, ci) => { const room = regionsIn[ci]!.length; if (a > room) { spill += a - room; alloc[ci] = room; } });
  while (spill > 0) {
    let best = -1;
    for (let ci = 0; ci < comps.length; ci++) if (alloc[ci]! < regionsIn[ci]!.length && (best < 0 || comps[ci]!.length > comps[best]!.length)) best = ci;
    if (best < 0) break;
    alloc[best]!++; spill--;
  }
  const score = (r: Region) => (PREF[terrain[r.capitalTile]!] ?? 0.3) * Math.min(1, r.tiles.length / 8);
  const chosen: Region[] = [];
  for (let ci = 0; ci < comps.length; ci++) {
    const pool = regionsIn[ci]!;
    const mine: Region[] = [];
    while (mine.length < alloc[ci]! && mine.length < pool.length) {
      let best: Region | null = null, bs = -1;
      for (const r of pool) {
        if (mine.includes(r)) continue;
        const d = mine.length ? Math.min(...mine.map((c) => angle(centers[c.capitalTile]!, centers[r.capitalTile]!))) : 1 + rng();
        const s = d * (0.4 + 0.6 * score(r));
        if (s > bs) { bs = s; best = r; }
      }
      mine.push(best!);
    }
    chosen.push(...mine);
  }
  // Shuffle which nation gets which capital, so temperaments are not grouped by landmass.
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j]!, chosen[i]!];
  }
  return chosen;
}

/** Owner #317: at least one warmonger per world, so a war is always on show. The nation whose capital
 *  is fewest provinces by land from another nation's capital (it meets a neighbour first; the map comes
 *  from the seed, so the pick does too; straight-line distance if no two capitals share land) gets an
 *  aggression of at least WARMONGER_AGGRESSION and the Create screen's slider. */
function crownWarmonger(countries: Country[], tiles: Tile[], slider: number | undefined): void {
  if (countries.length < 2) return;
  const capOf = new Map(countries.map((c) => [c.capitalTile, c.id]));
  let best = -1, bestD = Infinity;
  for (const c of countries) {
    const dist = new Map<number, number>([[c.capitalTile, 0]]);
    const q = [c.capitalTile];
    for (let h = 0; h < q.length; h++) {
      const t = q[h]!, d = dist.get(t)!;
      if (d + 1 >= bestD) break;
      let hit = false;
      for (const j of tiles[t]!.neighbors) {
        if (dist.has(j) || tiles[j]!.terrain === 'ocean') continue;
        dist.set(j, d + 1);
        if (capOf.has(j)) { bestD = d + 1; best = c.id; hit = true; break; }
        q.push(j);
      }
      if (hit) break;
    }
  }
  if (best < 0) {
    for (const a of countries) for (const b of countries) {
      if (a === b) continue;
      const d = 1000 + angle(tiles[a.capitalTile]!.center, tiles[b.capitalTile]!.center);
      if (d < bestD) { bestD = d; best = a.id; }
    }
  }
  const c = countries[best]!;
  const floor = Math.max(WARMONGER_AGGRESSION + 0.05, Math.min(1, slider ?? 0));
  if (c.temperament.aggression >= floor) return;
  c.temperament = { ...c.temperament, aggression: Math.round(floor * 100) / 100 };
  c.politics = startPolitics(c.temperament);
}

export function generateWorld(bible: WorldBible, opts: WorldGenOptions): World {
  const seed = opts.seed >>> 0;
  const shape = bible.shape ? cleanShape(bible.shape) : undefined;
  const seaLevel = chosenSeaLevel(opts.seaLevel, shape);
  const firstAge = bible.startAge && AGES.includes(bible.startAge) ? bible.startAge : startAge(bible.era);
  const count = opts.provinces ?? DEFAULT_PROVINCES;
  const rng = mulberry32(seed ^ 0x7e11a);

  const provs = generateProvinces(count, seed);
  const centers = provs.map((p) => p.center);
  const neighbors = provs.map((p) => p.neighbors);
  const { terrain, elevation, land } = buildTerrain(centers, neighbors, seed, seaLevel, shape);

  const regionTiles = buildRegions(land, neighbors, centers, rng);
  const tileRegion: number[] = new Array(count).fill(-1);
  const regions: Region[] = regionTiles.map((tiles, id) => {
    for (const t of tiles) tileRegion[t] = id;
    return { id, name: '', tiles, capitalTile: centralTile(tiles, centers), flag: randomFlag(rng), unrest: 0 };
  });

  const tiles: Tile[] = provs.map((p, id) => ({
    id, center: p.center, boundary: p.boundary, region: tileRegion[id]!, neighbors: p.neighbors,
    terrain: terrain[id]!, elevation: Math.round(elevation[id]! * 1000) / 1000,
  }));

  const nNations = bible.nations.length;
  const chosen = placeCapitals(nNations, regions, land, neighbors, centers, terrain, rng, !!shape && Object.keys(shape).length > 0);

  const owner: number[] = new Array(count).fill(-1);
  const countries: Country[] = [];
  const structures: Structure[] = [];
  const units: Unit[] = [];
  const chronicle: ChronicleEntry[] = [];
  bible.nations.forEach((bn, id) => {
    const reg = chosen[id % chosen.length]!;
    const cap = reg.capitalTile;
    // Capital plus its nearest free land (breadth-first), 3 to 7 tiles in all.
    const want = 3 + Math.floor(rng() * 5);
    const take = [cap];
    owner[cap] = id;
    for (let k = 0; k < take.length && take.length < want; k++) {
      for (const j of neighbors[take[k]!]!) {
        if (take.length >= want) break;
        if (land[j] && owner[j] === -1 && terrain[j] !== 'ice') { owner[j] = id; take.push(j); }
      }
    }
    const { regionNames, ...cultureFields } = bn;
    if (!reg.name) reg.name = regionNames[0] ?? '';
    countries.push({
      ...cultureFields, id, capitalTile: cap, alive: true, parent: null,
      population: 2000 * take.length + Math.floor(rng() * 4000), treasury: 100 + Math.floor(rng() * 60),
      techAge: firstAge,
      council: foundingCouncil({ ...cultureFields, id }, seed, 0, bible.startYear),     // row A29: its leader and a general
      warReadiness: 0, politics: startPolitics(cultureFields.temperament),   // B11 (#204): at peace, its politics from its temperament
    });
    structures.push({ id: `s-${structures.length}`, tile: cap, owner: id, kind: 'capital', builtTick: 0 });
    units.push({ id: `u-${units.length}`, owner: id, kind: 'settler', tile: cap, strength: 1 });
    chronicle.push({ id: `c-${chronicle.length + 1}`, tick: 0, year: bible.startYear, kind: 'founding', countries: [id], text: bn.foundingMyth });
  });

  crownWarmonger(countries, tiles, opts.aggression);

  const relations: Relation[] = [];
  for (let a = 0; a < nNations; a++) for (let b = a + 1; b < nNations; b++) relations.push({ a, b, stance: 'neutral', since: 0, grievance: 0 });

  return {
    id: `w-${(hashString(`world:${seed}`) & 0xffff).toString(16).padStart(4, '0')}`,
    seed, prompt: '', name: bible.name, era: bible.era,
    tick: 0, year: bible.startYear, speed: 1 / 8, paused: false,
    tiles, regions, owner, countries, structures, units, relations, chronicle,
    agents: countries.map((c) => ({ countryId: c.id, link: 'up', ruler: 'llm', deleted: false, lastHeardTick: 0, pendingEvents: 0 })),
  };
}
