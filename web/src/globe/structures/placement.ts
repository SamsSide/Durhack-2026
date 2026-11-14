// Per-tile placement maths and small helpers shared by structures and trees.
import * as THREE from 'three';
import type { World } from '@terra/shared';

/** Stable pseudo-random number in [0, 1) from a string or number. */
export function hash01(seed: string | number, salt = 0): number {
  let h = 2166136261 ^ salt;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function easeOutBack(x: number): number {
  const c1 = 2.2, c3 = c1 + 1;
  const t = x - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Tile width as a fraction of the mean centre-to-corner distance (was 1.4; buildings were too big). */
const WIDTH_K = 1.0;

export interface TileGeo {
  n: THREE.Vector3;       // outward normal at the tile centre
  t1: THREE.Vector3;      // tangent axes
  t2: THREE.Vector3;
  h: number;              // surface radius
  width: number;          // approx tile width
  align: THREE.Quaternion; // +Y to normal
}

export class TileGeos {
  private cache = new Map<number, TileGeo>();
  constructor(private world: World, private heights: Float32Array) {}

  get(tile: number): TileGeo {
    let g = this.cache.get(tile);
    if (g) return g;
    const t = this.world.tiles[tile]!;
    const n = new THREE.Vector3(...t.center).normalize();
    const ref = Math.abs(n.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(ref, n).normalize();
    const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
    let sum = 0;
    const c = new THREE.Vector3(), b = new THREE.Vector3();
    c.copy(n);
    for (const p of t.boundary) sum += b.set(p[0], p[1], p[2]).normalize().distanceTo(c);
    const h = this.heights[tile] ?? 1;
    const width = (sum / Math.max(1, t.boundary.length)) * WIDTH_K * h;
    const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g = { n, t1, t2, h, width, align };
    this.cache.set(tile, g);
    return g;
  }

  /** Point on the tile surface offset (a, b) along the tangent axes, lifted by `up`. */
  point(g: TileGeo, a: number, b: number, up: number, out: THREE.Vector3): THREE.Vector3 {
    out.copy(g.n).multiplyScalar(g.h).addScaledVector(g.t1, a).addScaledVector(g.t2, b);
    return out.normalize().multiplyScalar(g.h + up);
  }
}
