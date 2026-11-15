// The real Earth as the game's own tiles: the same hex sphere and the same bevelled province mesh a
// world gets, with each tile land or sea by the real coastlines and a biome by where it is.
// Display only (the Create and founding screens); nothing here reaches the simulation.
import * as THREE from 'three';
import { generateProvinces, mulberry32 } from '@terra/shared';
import type { Terrain, Tile, Vec3, World } from '@terra/shared';
import { BIOME_COLORS, getPalette } from '../palette';
import {
  VK_COAST_BOT, VK_COAST_TOP, VK_LIP, VK_SLOPE, VK_WALL_BOT, VK_WALL_TOP, buildProvinceMesh,
} from '../mesh/buildProvinceMesh';
import { isLand } from './land';

/** Tiles on the Earth: finer than a world's 1,200 so Britain, Japan and Italy still read. */
export const EARTH_TILES = 4200;
const SEED = 1969;
const DEG = 180 / Math.PI;

/** Unit vector for a longitude and latitude in degrees: y is north, longitude 0 faces +z, east is +x. */
export function lonLatToVec(lon: number, lat: number): Vec3 {
  const c = Math.cos(lat / DEG);
  return [c * Math.sin(lon / DEG), Math.sin(lat / DEG), c * Math.cos(lon / DEG)];
}
const lonOf = (v: Vec3): number => Math.atan2(v[0], v[2]) * DEG;
const latOf = (v: Vec3): number => Math.asin(Math.max(-1, Math.min(1, v[1]))) * DEG;

/** Dry lands as [west, east, south, north] boxes; their edges are softened with noise. */
const DESERTS: [number, number, number, number][] = [
  [-17, 34, 16, 32],    // Sahara
  [34, 59, 14, 33],     // Arabia
  [48, 70, 25, 44],     // Iran and the Karakum
  [76, 112, 37, 46],    // Taklamakan and the Gobi
  [114, 143, -30, -19], // Australia's interior
  [12, 25, -29, -18],   // Namib and the Kalahari
  [-117, -101, 23, 36], // Sonora and Chihuahua
  [-72, -66, -50, -38], // Patagonia
  [68, 74, 24, 29],     // Thar
];
/** Mountain chains as [lon, lat, lon, lat, half-width in degrees]. */
const RANGES: [number, number, number, number, number][] = [
  [-78, 8, -70, -18, 1.8], [-70, -18, -71, -52, 1.6],        // Andes
  [-150, 62, -122, 50, 2.6], [-122, 50, -106, 33, 2.6], [-106, 33, -98, 19, 1.5], // Alaska to the Sierra Madre
  [70, 36, 97, 28, 2.4], [78, 34, 100, 33, 3.2],              // Himalaya and Tibet
  [6, 45.5, 15, 47, 1.3], [40, 42.5, 48, 41, 1.2],             // Alps, Caucasus
  [59, 52, 60, 66, 1.5],                                     // Urals
  [-6, 32, 8, 35, 1.2], [37, 12, 40, 7, 1.4],               // Atlas, Ethiopia
  [44, 37, 56, 30, 1.4], [88, 49, 100, 51, 1.8],             // Zagros, Altai
  [146, -37, 152, -27, 1.4],                                 // Great Dividing Range
];

/** Distance in degrees from a point to a segment, with longitude shrunk by the latitude. */
function toSegment(lon: number, lat: number, s: readonly number[]): number {
  const k = Math.cos(lat / DEG);
  const ax = s[0]! * k, ay = s[1]!, bx = s[2]! * k, by = s[3]!, px = lon * k;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), lat - (ay + dy * t));
}

/** Smooth noise in about -1..1 from a point on the sphere (a few crossed waves: cheap, no seams). */
function drift(v: Vec3): number {
  return (Math.sin(v[0] * 7.1 + v[1] * 3.3) + Math.sin(v[1] * 8.7 - v[2] * 4.9) + Math.sin(v[2] * 6.3 + v[0] * 5.7 + 1.3)) / 3;
}

const isGreenland = (lon: number, lat: number): boolean =>
  lat > 59.5 && lon > -74 && lon < -11 && (lon > -57 || lat > 76) && !(lat < 67.5 && lon > -26);

interface Biome { terrain: Terrain; elevation: number; color: THREE.Color }

const C = {
  desert: new THREE.Color(BIOME_COLORS.desert).lerp(new THREE.Color('#e6cd96'), 0.4), dry: new THREE.Color(BIOME_COLORS.dryBand),
  plains: new THREE.Color(BIOME_COLORS.plains), forest: new THREE.Color(BIOME_COLORS.forest),
  hills: new THREE.Color(BIOME_COLORS.hills), mountain: new THREE.Color(BIOME_COLORS.mountain),
  ice: new THREE.Color(BIOME_COLORS.ice), jungle: new THREE.Color('#3a8748'), tundra: new THREE.Color('#9aa58a'),
  steppe: new THREE.Color('#a3a85a'), rock: new THREE.Color('#a39a88'),
};

function biomeAt(v: Vec3, rnd: number): Biome {
  const lon = lonOf(v), lat = latOf(v), n = drift(v);
  const color = new THREE.Color();
  const done = (terrain: Terrain, elevation: number): Biome => {
    color.multiplyScalar(0.93 + rnd * 0.14);
    return { terrain, elevation, color };
  };
  if (lat < -60 || isGreenland(lon, lat) || lat > 79) {
    color.copy(C.ice);
    return done('ice', 0.3 + rnd * 0.12);
  }
  // mountains first: they cut across every band
  let ridge = Infinity;
  for (const r of RANGES) ridge = Math.min(ridge, toSegment(lon, lat, r) / r[4]);
  if (ridge < 1) {
    color.copy(C.mountain).lerp(C.rock, 0.85).lerp(C.ice, ridge < 0.5 ? 0.3 + rnd * 0.35 : rnd * 0.12);
    return done('mountain', 0.35 + (1 - ridge) * 0.35 + rnd * 0.15);
  }
  let dry = -Infinity;
  for (const [w, e, s, nth] of DESERTS) dry = Math.max(dry, Math.min(lon - w, e - lon, lat - s, nth - lat) / 4);
  dry += n * 0.6;
  if (ridge < 1.8) {
    color.copy(C.hills).lerp(dry > 0 ? C.dry : C.plains, 0.3);
    return done('hills', 0.3 + rnd * 0.2);
  }
  if (dry > 0) {
    color.copy(C.dry).lerp(C.desert, Math.min(1, dry * 1.6 + rnd * 0.2));
    return done('desert', 0.08 + rnd * 0.1);
  }
  const a = Math.abs(lat);
  if (lat > 67 + n * 3) {
    color.copy(C.tundra).lerp(C.ice, Math.min(1, (lat - 67) / 12 + rnd * 0.2));
    return done('plains', 0.1 + rnd * 0.1);
  }
  if (a < 11 + n * 5) {
    color.copy(C.jungle).lerp(C.forest, rnd * 0.6);
    return done('forest', 0.12 + rnd * 0.12);
  }
  if (lat > 50 + n * 4) { // the boreal belt
    color.copy(C.forest).lerp(C.tundra, Math.max(0, (lat - 58) / 14) + rnd * 0.15);
    return done('forest', 0.12 + rnd * 0.12);
  }
  if (dry > -0.9) { // the fringe of a desert: steppe and savanna
    color.copy(C.steppe).lerp(C.plains, Math.min(1, -dry / 0.9));
    return done('plains', 0.08 + rnd * 0.1);
  }
  if (n + rnd * 0.8 > 0.75) {
    color.copy(C.forest).lerp(C.plains, 0.25);
    return done('forest', 0.12 + rnd * 0.12);
  }
  color.copy(C.plains);
  return done('plains', 0.08 + rnd * 0.12);
}

/** A tile is land when most of it is: its centre counts double, plus a point halfway to each corner. */
function mostlyLand(center: Vec3, boundary: Vec3[]): boolean {
  let land = isLand(lonOf(center), latOf(center)) ? 2 : 0;
  for (const b of boundary) {
    const p: Vec3 = [(center[0] + b[0]) / 2, (center[1] + b[1]) / 2, (center[2] + b[2]) / 2];
    if (isLand(lonOf(p), latOf(p))) land++;
  }
  return land >= (boundary.length + 2) * 0.45;
}

const ROCK = new THREE.Color('#5d554b');
const SAND_ROCK = new THREE.Color('#9c8a68');
const WHITE = new THREE.Color('#ffffff');

/** Builds the Earth's geometry (position and colour). The caller disposes it. */
export function buildEarth(): THREE.BufferGeometry {
  const rng = mulberry32(SEED);
  const provinces = generateProvinces(EARTH_TILES, SEED);
  const tops: THREE.Color[] = [];
  const tiles: Tile[] = provinces.map((p, id) => {
    const rnd = rng();
    if (!mostlyLand(p.center, p.boundary)) {
      tops.push(new THREE.Color());
      return { id, center: p.center, boundary: p.boundary, neighbors: p.neighbors, region: -1, terrain: 'ocean', elevation: 0 };
    }
    const b = biomeAt(p.center, rnd);
    tops.push(b.color);
    return { id, center: p.center, boundary: p.boundary, neighbors: p.neighbors, region: -1, terrain: b.terrain, elevation: b.elevation };
  });

  // Sea: the game's ocean, lighter on the shelf beside land and a touch deeper far from it.
  const deep = new THREE.Color(getPalette().ocean);
  const shelf = deep.clone().lerp(new THREE.Color('#6fb0b8'), 0.42);
  const rng2 = mulberry32(SEED + 1);
  for (const t of tiles) {
    if (t.terrain !== 'ocean') continue;
    let near = 0;
    for (const nb of t.neighbors) {
      if (tiles[nb]!.terrain !== 'ocean') { near = 2; break; }
      if (near === 0 && tiles[nb]!.neighbors.some((x) => tiles[x]!.terrain !== 'ocean')) near = 1;
    }
    const polar = Math.abs(latOf(t.center)) > 74 + drift(t.center) * 4;
    const c = tops[t.id]!.copy(deep);
    if (near === 2) c.lerp(shelf, 0.85);
    else if (near === 1) c.lerp(shelf, 0.3);
    if (polar) c.lerp(C.ice, 0.7); // pack ice
    c.multiplyScalar(0.95 + rng2() * 0.1);
  }

  // Only `tiles` is read by the mesh builder.
  const mesh = buildProvinceMesh({ tiles } as unknown as World);
  const arr = (mesh.geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
  const c = new THREE.Color(), grey = new THREE.Color();
  for (const t of tiles) {
    const top = tops[t.id]!;
    const start = mesh.tileVertexStart[t.id]!, end = start + mesh.tileVertexCount[t.id]!;
    for (let v = start; v < end; v++) {
      // the same rim shading a world's tiles get (mesh/colors.ts): a pale lip, rock walls dark at the foot
      const kind = mesh.vertexKind[v]!;
      if (kind === VK_LIP) c.copy(top).lerp(WHITE, 0.14);
      else if (kind === VK_SLOPE) c.copy(top).multiplyScalar(0.96);
      else if (kind >= VK_WALL_TOP) {
        const coast = kind === VK_COAST_TOP || kind === VK_COAST_BOT;
        c.copy(top).lerp(coast ? SAND_ROCK : ROCK, coast ? 0.4 : 0.45);
        const g = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
        c.lerp(grey.setRGB(g, g, g), 0.3).multiplyScalar(kind === VK_WALL_BOT || kind === VK_COAST_BOT ? 0.5 : 0.82);
      } else c.copy(top);
      arr[v * 3] = Math.min(1, c.r); arr[v * 3 + 1] = Math.min(1, c.g); arr[v * 3 + 2] = Math.min(1, c.b);
    }
  }
  mesh.geometry.getAttribute('color').needsUpdate = true;
  return mesh.geometry;
}
