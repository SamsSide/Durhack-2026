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
  /** What each vertex is (VK_*), so colouring can shade lips, slopes and rock walls. */
  vertexKind: Uint8Array;
  centroidOf(tileIds: number[]): Vec3;
}

/** Vertex kinds. The top fan comes first in every tile and is always VK_TOP. */
export const VK_TOP = 0, VK_LIP = 1, VK_SLOPE = 2, VK_WALL_TOP = 3, VK_WALL_BOT = 4, VK_COAST_TOP = 5, VK_COAST_BOT = 6;
/** Share of the centre-to-edge distance given to the rim band (lip or slope). */
const INSET = 0.14;
/** Height differences below this become a gentle slope instead of a cliff. */
const SLOPE_MAX = 0.007;

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
    verts += k * 3 + (t.terrain === 'ocean' ? 0 : k * 12);
  }

  // Shared boundary edges first, so each rim knows the neighbour across it.
  const seen = new Map<string, { a: Vec3; b: Vec3; tiles: number[] }>();
  const edgeKey = (a: Vec3, b: Vec3): string => {
    const ka = key(a), kb = key(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  for (const tile of world.tiles) {
    const k = tile.boundary.length;
    for (let i = 0; i < k; i++) {
      const a = tile.boundary[i]!, b = tile.boundary[(i + 1) % k]!;
      const ek = edgeKey(a, b);
      const e = seen.get(ek);
      if (e) e.tiles.push(tile.id); else seen.set(ek, { a, b, tiles: [tile.id] });
    }
  }
  const neighbourAcross = (tileId: number, a: Vec3, b: Vec3): number => {
    const e = seen.get(edgeKey(a, b));
    if (!e) return -1;
    for (const t of e.tiles) if (t !== tileId) return t;
    return -1;
  };
  /** Height where two tiles meet: the midpoint for a gentle step, else the own top (a cliff). */
  const rimHeight = (h: number, other: number): number => {
    if (other < 0 || world.tiles[other]!.terrain === 'ocean') return h;
    const ho = heights[other]!;
    return Math.abs(ho - h) < SLOPE_MAX ? (h + ho) / 2 : h;
  };

  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3);
  const vertexKind = new Uint8Array(verts);
  const tileVertexStart = new Int32Array(n);
  const tileVertexCount = new Int32Array(n);
  const tileTopVertexCount = new Int32Array(n);
  const triangleToTile = new Int32Array(verts / 3);
  let vi = 0;

  const push = (p: Vec3, r: number, normal: Vec3 | null, kind: number): void => {
    const u = norm(p);
    pos[vi * 3] = u[0] * r; pos[vi * 3 + 1] = u[1] * r; pos[vi * 3 + 2] = u[2] * r;
    const nn = normal ?? u;
    nrm[vi * 3] = nn[0]; nrm[vi * 3 + 1] = nn[1]; nrm[vi * 3 + 2] = nn[2];
    vertexKind[vi] = kind;
    vi++;
  };
  const inset = (c: Vec3, p: Vec3): Vec3 => {
    const cu = norm(c), pu = norm(p);
    return [pu[0] + (cu[0] - pu[0]) * INSET, pu[1] + (cu[1] - pu[1]) * INSET, pu[2] + (cu[2] - pu[2]) * INSET];
  };

  for (const tile of world.tiles) {
    const h = heights[tile.id]!;
    const k = tile.boundary.length;
    const sea = tile.terrain === 'ocean';
    tileVertexStart[tile.id] = vi;
    // Top fan (inset on land, so the rim band can be a lip or a slope).
    for (let i = 0; i < k; i++) {
      const a = tile.boundary[i]!, b = tile.boundary[(i + 1) % k]!;
      push(tile.center, h, null, VK_TOP);
      push(sea ? a : inset(tile.center, a), h, null, VK_TOP);
      push(sea ? b : inset(tile.center, b), h, null, VK_TOP);
    }
    tileTopVertexCount[tile.id] = vi - tileVertexStart[tile.id]!;
    if (!sea) {
      for (let i = 0; i < k; i++) {
        const a = tile.boundary[i]!, b = tile.boundary[(i + 1) % k]!;
        const other = neighbourAcross(tile.id, a, b);
        const otherSea = other < 0 || world.tiles[other]!.terrain === 'ocean';
        const hr = rimHeight(h, other);
        const ho = other >= 0 ? heights[other]! : SEA_LEVEL;
        // Rim band: a light lip on a cliff top or coast, a slope for a gentle step, else plain top.
        const kind = hr !== h ? VK_SLOPE : (otherSea || ho < h - 1e-6 ? VK_LIP : VK_TOP);
        const ia = inset(tile.center, a), ib = inset(tile.center, b);
        push(ia, h, null, kind); push(a, hr, null, kind); push(b, hr, null, kind);
        push(ia, h, null, kind); push(b, hr, null, kind); push(ib, h, null, kind);
        // Wall: a coast drops to sea level (rock with a darker foot); between two land tiles it only
        // drops to the lower neighbour's top, so inland steps stay small and no tall dark wall shows
        // at the limb. A neighbour as high or higher gives a zero-height wall (kept for the layout).
        const an = norm(a), bn = norm(b);
        const d: Vec3 = [bn[0] - an[0], bn[1] - an[1], bn[2] - an[2]];
        const m = norm([an[0] + bn[0], an[1] + bn[1], an[2] + bn[2]]);
        const out = norm([d[1] * m[2] - d[2] * m[1], d[2] * m[0] - d[0] * m[2], d[0] * m[1] - d[1] * m[0]]);
        const top = otherSea ? VK_COAST_TOP : VK_WALL_TOP, bot = otherSea ? VK_COAST_BOT : VK_WALL_TOP;
        const hb = otherSea ? SEA_LEVEL : Math.min(hr, ho);
        push(a, hb, out, bot); push(b, hb, out, bot); push(b, hr, out, top);
        push(a, hb, out, bot); push(b, hr, out, top); push(a, hr, out, top);
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

  const edges: MeshEdge[] = [];
  for (const e of seen.values()) {
    if (e.tiles.length < 2) continue;
    const [ta, tb] = [e.tiles[0]!, e.tiles[1]!];
    const ha = heights[ta]!, hb = heights[tb]!;
    const landBoth = world.tiles[ta]!.terrain !== 'ocean' && world.tiles[tb]!.terrain !== 'ocean';
    const r = (landBoth && Math.abs(ha - hb) < SLOPE_MAX ? (ha + hb) / 2 : Math.max(ha, hb)) + LIFT;
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

  return { geometry, tileVertexStart, tileVertexCount, tileTopVertexCount, triangleToTile, edges, heights, vertexKind, centroidOf };
}
