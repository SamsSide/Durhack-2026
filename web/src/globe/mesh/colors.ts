import * as THREE from 'three';
import { relationOf } from '@terra/shared';
import type { World } from '@terra/shared';
import { getPalette } from '../palette';
import type { ProvinceMesh } from './buildProvinceMesh';

export type MapMode = 'political' | 'terrain' | 'diplomacy' | 'strength';

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

function colorWith(
  world: World, tileId: number, owner: number, mode: MapMode, sel: number | null,
  out: THREE.Color, str: { value: Float64Array; max: number } | null,
): THREE.Color {
  const pal = getPalette();
  const tile = world.tiles[tileId]!;
  if (tile.terrain === 'ocean') return out.set(pal.ocean);
  const terrain = pal.terrain[tile.terrain];
  const country = owner >= 0 ? world.countries[owner] : undefined;
  if (mode === 'terrain') return out.set(terrain);
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
  if (!country) return out.set(terrain);
  out.set(terrain);
  return out.lerp(tmp.set(country.color), pal.nationFill);
}

export function tileColor(
  world: World, tileId: number, owner: number, mode: MapMode, selectedCountryId: number | null, out: THREE.Color,
): THREE.Color {
  return colorWith(world, tileId, owner, mode, selectedCountryId, out, null);
}

function fill(mesh: ProvinceMesh, tileId: number, top: THREE.Color): void {
  const attr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  const start = mesh.tileVertexStart[tileId]!;
  const topN = mesh.tileTopVertexCount[tileId]!;
  const end = start + mesh.tileVertexCount[tileId]!;
  for (let v = start; v < end; v++) {
    const f = v - start < topN ? 1 : 0.65;
    arr[v * 3] = top.r * f; arr[v * 3 + 1] = top.g * f; arr[v * 3 + 2] = top.b * f;
  }
}

export function writeColors(
  mesh: ProvinceMesh, world: World, ownerOf: (tileId: number) => number, mode: MapMode,
  selectedCountryId: number | null, tileIds?: Iterable<number>,
): void {
  const str = mode === 'strength' ? strengthByCountry(world) : null;
  const c = new THREE.Color();
  const ids = tileIds ?? world.tiles.keys();
  for (const id of ids) {
    colorWith(world, id, ownerOf(id), mode, selectedCountryId, c, str);
    fill(mesh, id, c);
  }
  (mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
}

export function setTileColor(mesh: ProvinceMesh, tileId: number, top: THREE.Color): void {
  fill(mesh, tileId, top);
  (mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
}
