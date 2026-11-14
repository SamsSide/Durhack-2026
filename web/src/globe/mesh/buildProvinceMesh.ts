import * as THREE from 'three';
import type { Tile, Vec3, World } from '@terra/shared';
import { LAND_BASE, LIFT, MOUNTAIN_BONUS, RELIEF, SEA_LEVEL } from '../constants';

export interface MeshEdge { a: Vec3; b: Vec3; tileA: number; tileB: number }

export interface ProvinceMesh {
  geometry: THREE.BufferGeometry;
  tileVertexStart: Int32Array;
  tileVertexCount: Int32Array;
  tileTopVertexCount: Int32Array;
  triangleToTile: Int32Array;
  edges: MeshEdge[];
  heights: Float32Array;
  centroidOf(tileIds: number[]): Vec3;
}

export function tileHeight(tile: Tile): number {
  if (tile.terrain === 'ocean') return SEA_LEVEL;
  let h = LAND_BASE + tile.elevation * RELIEF;
  if (tile.terrain === 'mountain') h += MOUNTAIN_BONUS;
  else if (tile.terrain === 'hills') h += MOUNTAIN_BONUS / 2;
  return h;
}

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

const key = (v: Vec3): string => `${v[0].toFixed(5)},${v[1].toFixed(5)},${v[2].toFixed(5)}`;

export function buildProvinceMesh(world: World): ProvinceMesh {
  const n = world.tiles.length;
  const heights = new Float32Array(n);
  let verts = 0;
  for (const t of world.tiles) {
    heights[t.id] = tileHeight(t);
    const k = t.boundary.length;
    verts += k * 3 + (t.terrain === 'ocean' ? 0 : k * 6);
  }
  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3);
  const tileVertexStart = new Int32Array(n);
  const tileVertexCount = new Int32Array(n);
  const tileTopVertexCount = new Int32Array(n);
  const triangleToTile = new Int32Array(verts / 3);
  let vi = 0;

  const push = (p: Vec3, r: number, normal: Vec3 | null): void => {
    const u = norm(p);
    pos[vi * 3] = u[0] * r; pos[vi * 3 + 1] = u[1] * r; pos[vi * 3 + 2] = u[2] * r;
    const nn = normal ?? u;
    nrm[vi * 3] = nn[0]; nrm[vi * 3 + 1] = nn[1]; nrm[vi * 3 + 2] = nn[2];
    vi++;
  };

  for (const tile of world.tiles) {
    const h = heights[tile.id]!;
    const k = tile.boundary.length;
    tileVertexStart[tile.id] = vi;
    for (let i = 0; i < k; i++) {
      push(tile.center, h, null);
      push(tile.boundary[i]!, h, null);
      push(tile.boundary[(i + 1) % k]!, h, null);
    }
    tileTopVertexCount[tile.id] = vi - tileVertexStart[tile.id]!;
    if (tile.terrain !== 'ocean') {
      for (let i = 0; i < k; i++) {
        const a = norm(tile.boundary[i]!), b = norm(tile.boundary[(i + 1) % k]!);
        const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const m = norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
        const out = norm([d[1] * m[2] - d[2] * m[1], d[2] * m[0] - d[0] * m[2], d[0] * m[1] - d[1] * m[0]]);
        push(a, SEA_LEVEL, out); push(b, SEA_LEVEL, out); push(b, h, out);
        push(a, SEA_LEVEL, out); push(b, h, out); push(a, h, out);
      }
    }
    tileVertexCount[tile.id] = vi - tileVertexStart[tile.id]!;
    for (let f = tileVertexStart[tile.id]! / 3; f < vi / 3; f++) triangleToTile[f] = tile.id;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  geometry.computeBoundingSphere();

  const seen = new Map<string, { a: Vec3; b: Vec3; tiles: number[] }>();
  for (const tile of world.tiles) {
    const k = tile.boundary.length;
    for (let i = 0; i < k; i++) {
      const a = tile.boundary[i]!, b = tile.boundary[(i + 1) % k]!;
      const ka = key(a), kb = key(b);
      const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = seen.get(ek);
      if (e) e.tiles.push(tile.id); else seen.set(ek, { a, b, tiles: [tile.id] });
    }
  }
  const edges: MeshEdge[] = [];
  for (const e of seen.values()) {
    if (e.tiles.length < 2) continue;
    const [ta, tb] = [e.tiles[0]!, e.tiles[1]!];
    const r = Math.max(heights[ta]!, heights[tb]!) + LIFT;
    const a = norm(e.a), b = norm(e.b);
    edges.push({ a: [a[0] * r, a[1] * r, a[2] * r], b: [b[0] * r, b[1] * r, b[2] * r], tileA: ta, tileB: tb });
  }

  const centroidOf = (ids: number[]): Vec3 => {
    if (ids.length === 0) return [0, LAND_BASE, 0];
    let x = 0, y = 0, z = 0, mh = 0;
    for (const id of ids) {
      const c = world.tiles[id]!.center;
      x += c[0]; y += c[1]; z += c[2];
      mh = Math.max(mh, heights[id]!);
    }
    const u = norm([x, y, z]);
    const r = mh + LIFT;
    return [u[0] * r, u[1] * r, u[2] * r];
  };

  return { geometry, tileVertexStart, tileVertexCount, tileTopVertexCount, triangleToTile, edges, heights, centroidOf };
}
