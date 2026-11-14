// Spherical Voronoi provinces: jittered Fibonacci points, their 3D convex hull (= spherical
// Delaunay triangulation), and each cell's boundary from the triangles' circumcentres.
import quickHull from 'quickhull3d';
import type { Vec3 } from './types';
import { mulberry32 } from './rng';

export interface Province { center: Vec3; boundary: Vec3[]; neighbors: number[] }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Jittered Fibonacci points on the unit sphere (y up). */
export function fibonacciPoints(count: number, seed: number, jitter = 0.4): Vec3[] {
  const rng = mulberry32(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spacing = Math.sqrt((4 * Math.PI) / count);
  const pts: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const p: Vec3 = [Math.cos(th) * r, y, Math.sin(th) * r];
    const j = spacing * jitter;
    pts.push(normalize([p[0] + (rng() - 0.5) * 2 * j, p[1] + (rng() - 0.5) * 2 * j, p[2] + (rng() - 0.5) * 2 * j]));
  }
  return pts;
}

/**
 * Generates `count` provinces. Each boundary is convex and counter-clockwise seen from outside;
 * neighbours are the cells sharing an edge. Deterministic for a given (count, seed).
 */
export function generateProvinces(count: number, seed: number): Province[] {
  const pts = fibonacciPoints(count, seed);
  const raw = quickHull(pts) as unknown as number[][];

  const tris: [number, number, number][] = [];
  const circ: Vec3[] = [];
  for (const f of raw) {
    // collectFaces can return polygons; fan-triangulate to be safe.
    for (let k = 1; k + 1 < f.length; k++) {
      const a = f[0]!, b = f[k]!, c = f[k + 1]!;
      const n = cross(sub(pts[b]!, pts[a]!), sub(pts[c]!, pts[a]!));
      const centroid: Vec3 = [
        pts[a]![0] + pts[b]![0] + pts[c]![0],
        pts[a]![1] + pts[b]![1] + pts[c]![1],
        pts[a]![2] + pts[b]![2] + pts[c]![2],
      ];
      const out = dot(n, centroid) >= 0 ? n : ([-n[0], -n[1], -n[2]] as Vec3);
      tris.push([a, b, c]);
      circ.push(normalize(out));
    }
  }

  const incident: number[][] = pts.map(() => []);
  const nbrs: Set<number>[] = pts.map(() => new Set<number>());
  tris.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) {
      const v = t[k]!;
      incident[v]!.push(ti);
      nbrs[v]!.add(t[(k + 1) % 3]!);
      nbrs[v]!.add(t[(k + 2) % 3]!);
    }
  });

  return pts.map((c, i) => {
    const ref: Vec3 = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = normalize(cross(c, ref));
    const e2 = cross(c, e1);
    const corners = incident[i]!
      .map((ti) => circ[ti]!)
      .map((p) => ({ p, ang: Math.atan2(dot(p, e2), dot(p, e1)) }))
      .sort((x, y) => x.ang - y.ang)
      .map((x) => x.p);
    return { center: c, boundary: corners, neighbors: [...nbrs[i]!].sort((a, b) => a - b) };
  });
}
