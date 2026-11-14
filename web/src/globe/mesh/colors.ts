import * as THREE from 'three';
import { relationOf } from '@terra/shared';
import type { World } from '@terra/shared';
import { BIOME_COLORS, getPalette } from '../palette';
import { VK_COAST_BOT, VK_COAST_TOP, VK_LIP, VK_SLOPE, VK_WALL_BOT, VK_WALL_TOP } from './buildProvinceMesh';
import type { ProvinceMesh } from './buildProvinceMesh';
import { statusOf } from '../status/statusTint';

export type MapMode = 'political' | 'terrain' | 'diplomacy' | 'strength' | 'wealth';

const tmp = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');

function strengthByCountry(world: World): { value: Float64Array; max: number } {
  const units = new Float64Array(world.countries.length);
  const count = new Float64Array(world.countries.length);
  for (const u of world.units) if (u.owner >= 0 && u.owner < units.length) units[u.owner]! += u.strength;
  for (const o of world.owner) if (o >= 0 && o < count.length) count[o]!++;
  const value = new Float64Array(units.length);
  let max = 0;
  for (let i = 0; i < value.length; i++) {
    value[i] = count[i]! > 0 ? units[i]! / count[i]! : 0;
    if (value[i]! > max) max = value[i]!;
  }
  return { value, max };
}

/** Treasury of each living nation on a 0..1 log scale between the poorest and the richest (B12). */
export function wealthScale(world: World): { t: Float64Array; min: number; max: number } {
  const t = new Float64Array(world.countries.length);
  let lo = Infinity, hi = -Infinity, min = 0, max = 0;
  for (const c of world.countries) {
    if (!c?.alive) continue;
    const v = Math.log1p(Math.max(0, c.treasury));
    if (v < lo) { lo = v; min = c.treasury; }
    if (v > hi) { hi = v; max = c.treasury; }
  }
  const span = hi - lo;
  for (const c of world.countries) {
    if (!c?.alive) continue;
    t[c.id] = span > 1e-9 ? (Math.log1p(Math.max(0, c.treasury)) - lo) / span : 1;
  }
  return { t, min: Number.isFinite(lo) ? min : 0, max: Number.isFinite(hi) ? max : 0 };
}

/** Changes when any nation's wealth colour would visibly change (20 steps), so the globe repaints only then. */
export function wealthKey(world: World): string {
  const { t } = wealthScale(world);
  let k = '';
  for (const c of world.countries) if (c?.alive) k += `${c.id}:${Math.round((t[c.id] ?? 0) * 20)},`;
  return k;
}

/** Terrain mode biome colour: dry band where desert meets non-desert, coast takes its land neighbour's tone. */
function biomeColor(world: World, tileId: number, out: THREE.Color): THREE.Color {
  const tile = world.tiles[tileId]!;
  let t = tile.terrain;
  if (t === 'coast') {
    const seen: Record<string, number> = {};
    let best = 'plains', n = 0;
    for (const nb of tile.neighbors) {
      const nt = world.tiles[nb]?.terrain;
      if (!nt || nt === 'ocean' || nt === 'coast') continue;
      const c = (seen[nt] = (seen[nt] ?? 0) + 1);
      if (c > n) { n = c; best = nt; }
    }
    t = best as typeof t;
  }
  if (t === 'desert' || t === 'plains') {
    let dry = false;
    for (const nb of tile.neighbors) {
      const nt = world.tiles[nb]?.terrain;
      if (!nt || nt === 'ocean') continue;
      if (t === 'desert' ? nt !== 'desert' && nt !== 'coast' : nt === 'desert') { dry = true; break; }
    }
    if (dry) return out.set(BIOME_COLORS.dryBand);
  }
  return out.set(t in BIOME_COLORS ? BIOME_COLORS[t as keyof typeof BIOME_COLORS] : BIOME_COLORS.plains);
}

function colorBase(
  world: World, tileId: number, owner: number, mode: MapMode, sel: number | null,
  out: THREE.Color, str: { value: Float64Array; max: number } | null,
  wealth: { t: Float64Array } | null = null,
): THREE.Color {
  const pal = getPalette();
  const tile = world.tiles[tileId]!;
  if (tile.terrain === 'ocean') return out.set(mode === 'terrain' ? BIOME_COLORS.ocean : pal.ocean);
  const terrain = pal.terrain[tile.terrain];
  const country = owner >= 0 ? world.countries[owner] : undefined;
  if (mode === 'terrain') return biomeColor(world, tileId, out);
  if (mode === 'diplomacy' && sel != null) {
    if (!country) return out.set(terrain).lerp(WHITE, 0.2);
    if (owner === sel) return out.set(pal.selectedSelf);
    return out.set(pal.stance[relationOf(world, sel, owner).stance]);
  }
  if (mode === 'strength') {
    if (!country) return out.set(pal.strengthNone);
    const s = str ?? strengthByCountry(world);
    const t = s.max > 0 ? (s.value[owner] ?? 0) / s.max : 0;
    return out.set(pal.strengthLow).lerp(tmp.set(pal.strengthHigh), t);
  }
  if (mode === 'wealth') {
    if (!country) return out.set(pal.wealthNone);
    const t = (wealth ?? wealthScale(world)).t[owner] ?? 0;
    return out.set(pal.wealthLow).lerp(tmp.set(pal.wealthHigh), t);
  }
  if (!country) return out.set(terrain);
  out.set(terrain);
  return out.lerp(tmp.set(country.color), pal.nationFill);
}

/** A stable -1..1 value per tile, so the relief noise never shimmers between repaints. */
function tileNoise(id: number): number {
  const s = Math.sin(id * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Terrain relief under the fill (Age of History style): high ground slightly lighter, low ground
 * slightly darker, plus a small per-tile grain. The same factor in every map mode.
 */
export function reliefFactor(world: World, tileId: number): number {
  const tile = world.tiles[tileId];
  if (!tile) return 1;
  if (tile.terrain === 'ocean') return 1 + 0.02 * tileNoise(tileId);
  let f = 1 + (tile.elevation - 0.4) * 0.1 + 0.04 * tileNoise(tileId);
  if (tile.terrain === 'mountain') f += 0.07;
  else if (tile.terrain === 'hills') f += 0.035;
  return f;
}

/** Lightness of each tone class; neighbours never share a class, so each province reads as its own piece. */
const TONE_STEPS = [1, 0.935, 1.065, 0.965];
const toneCache = new WeakMap<World['tiles'], Uint8Array>();

/** Greedy colouring of the province adjacency into four tone classes. Stable for a given tile set. */
function toneClasses(world: World): Uint8Array {
  const hit = toneCache.get(world.tiles);
  if (hit) return hit;
  const cls = new Uint8Array(world.tiles.length);
  const used = new Uint8Array(TONE_STEPS.length);
  for (const t of world.tiles) {
    used.fill(0);
    for (const nb of t.neighbors) if (nb < t.id) used[cls[nb]!] = 1;
    let c = 0;
    while (c < TONE_STEPS.length - 1 && used[c]) c++;
    cls[t.id] = c;
  }
  toneCache.set(world.tiles, cls);
  return cls;
}

/** The tone step for a tile; half strength where the colour itself carries meaning (diplomacy, strength). */
export function toneFactor(world: World, tileId: number, mode: MapMode): number {
  const tile = world.tiles[tileId];
  if (!tile || tile.terrain === 'ocean') return 1;
  const step = TONE_STEPS[toneClasses(world)[tileId] ?? 0]! - 1;
  return 1 + (mode === 'diplomacy' || mode === 'strength' || mode === 'wealth' ? step * 0.5 : step);
}

function applyRelief(world: World, tileId: number, out: THREE.Color, mode: MapMode = 'political'): THREE.Color {
  const f = reliefFactor(world, tileId) * toneFactor(world, tileId, mode);
  out.r = Math.min(1, out.r * f); out.g = Math.min(1, out.g * f); out.b = Math.min(1, out.b * f);
  return out;
}

/** The base colour, then dimmed for a cut nation or greyed to ruin for a deleted one, then relief. */
function colorWith(
  world: World, tileId: number, owner: number, mode: MapMode, sel: number | null,
  out: THREE.Color, str: { value: Float64Array; max: number } | null,
  wealth: { t: Float64Array } | null = null,
): THREE.Color {
  colorStatus(world, tileId, owner, mode, sel, out, str, wealth);
  return applyRelief(world, tileId, out, mode);
}

function colorStatus(
  world: World, tileId: number, owner: number, mode: MapMode, sel: number | null,
  out: THREE.Color, str: { value: Float64Array; max: number } | null,
  wealth: { t: Float64Array } | null = null,
): THREE.Color {
  colorBase(world, tileId, owner, mode, sel, out, str, wealth);
  const tile = world.tiles[tileId];
  if (owner < 0 || !tile || tile.terrain === 'ocean') return out;
  const st = statusOf(owner);
  if (!st) return out;
  const pal = getPalette();
  if (st === 'cut') return out.lerp(tmp.set(pal.night), 0.42).lerp(tmp.set(pal.silence), 0.1);
  // deleted: drain the colour towards ruin grey
  const g = out.r * 0.3 + out.g * 0.59 + out.b * 0.11;
  out.lerp(tmp.setRGB(g, g, g), 0.6);
  return out.lerp(tmp.set(pal.ruin), 0.45);
}

export function tileColor(
  world: World, tileId: number, owner: number, mode: MapMode, selectedCountryId: number | null, out: THREE.Color,
): THREE.Color {
  return colorWith(world, tileId, owner, mode, selectedCountryId, out, null);
}

const ROCK = new THREE.Color('#5d554b');
const SAND_ROCK = new THREE.Color('#9c8a68');
const rockTmp = new THREE.Color();
const rockTmp2 = new THREE.Color();

/** Walls: the top colour pulled toward rock (sandy rock on coasts), desaturated, darker at the foot. */
function wallColor(top: THREE.Color, kind: number, out: THREE.Color): THREE.Color {
  const coast = kind === VK_COAST_TOP || kind === VK_COAST_BOT;
  const foot = kind === VK_WALL_BOT || kind === VK_COAST_BOT;
  out.copy(top).lerp(coast ? SAND_ROCK : ROCK, coast ? 0.4 : 0.45);
  const g = out.r * 0.3 + out.g * 0.59 + out.b * 0.11;
  out.lerp(rockTmp.setRGB(g, g, g), 0.3);
  return out.multiplyScalar(foot ? 0.5 : 0.82);
}

function fill(mesh: ProvinceMesh, tileId: number, top: THREE.Color): void {
  const attr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  const kinds = mesh.vertexKind;
  const start = mesh.tileVertexStart[tileId]!;
  const end = start + mesh.tileVertexCount[tileId]!;
  const c = rockTmp2;
  for (let v = start; v < end; v++) {
    const kind = kinds[v]!;
    if (kind === VK_LIP) c.copy(top).lerp(WHITE, 0.14);
    else if (kind === VK_SLOPE) c.copy(top).multiplyScalar(0.96);
    else if (kind >= VK_WALL_TOP) wallColor(top, kind, c);
    else c.copy(top);
    arr[v * 3] = Math.min(1, c.r); arr[v * 3 + 1] = Math.min(1, c.g); arr[v * 3 + 2] = Math.min(1, c.b);
  }
}

export function writeColors(
  mesh: ProvinceMesh, world: World, ownerOf: (tileId: number) => number, mode: MapMode,
  selectedCountryId: number | null, tileIds?: Iterable<number>,
): void {
  const str = mode === 'strength' ? strengthByCountry(world) : null;
  const wealth = mode === 'wealth' ? wealthScale(world) : null;
  const c = new THREE.Color();
  const ids = tileIds ?? world.tiles.keys();
  for (const id of ids) {
    colorWith(world, id, ownerOf(id), mode, selectedCountryId, c, str, wealth);
    fill(mesh, id, c);
  }
  (mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
}

export function setTileColor(mesh: ProvinceMesh, tileId: number, top: THREE.Color): void {
  fill(mesh, tileId, top);
  (mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
}
