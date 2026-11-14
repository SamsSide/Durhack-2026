// Lane b: one merged ribbon geometry for every river, waterfall and lake (one draw call).
import * as THREE from 'three';
import type { Vec3, World } from '@terra/shared';
import { SEA_LEVEL } from '../constants';
import { hash01, riversOf } from './generate';
import type { River } from './generate';

const EPS = 0.0007;          // ribbon lift above the terrace top
const LAKE_EPS = 0.0009;
const HALF_W = 0.0016;       // half width of a one-source river at full taper
const FALL_OFF = 0.0012;     // waterfall sits this far in front of the cliff wall
const FOAM_DROP = 0.0025;    // drops taller than this get foam
const SUB = 5;               // samples per control segment

type V = [number, number, number];
const norm = (v: V | Vec3): V => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const lerp = (a: V | Vec3, b: V | Vec3, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const key = (v: Vec3): string => `${v[0].toFixed(5)},${v[1].toFixed(5)},${v[2].toFixed(5)}`;

function catmull(p0: V, p1: V, p2: V, p3: V, t: number): V {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])];
}

interface Sample { dir: V; r: number; half: number; foam: number; alpha: number }

export interface RiverGeometryStats { rivers: number; lakes: number; triangles: number }

export function buildRiverGeometry(world: World, heights: Float32Array): { geometry: THREE.BufferGeometry; stats: RiverGeometryStats } {
  const sys = riversOf(world);
  const tiles = world.tiles;
  const seed = world.seed | 0;

  const pos: number[] = [], side: number[] = [], half: number[] = [], uu: number[] = [], vv: number[] = [];
  const foam: number[] = [], alpha: number[] = [], kind: number[] = [];
  const index: number[] = [];
  const vert = (p: V, s: V, h: number, u: number, v: number, f: number, a: number, k: number): number => {
    pos.push(p[0], p[1], p[2]); side.push(s[0], s[1], s[2]); half.push(h); uu.push(u); vv.push(v);
    foam.push(f); alpha.push(a); kind.push(k);
    return pos.length / 3 - 1;
  };

  // Where a river crosses from tile a to tile b: a seeded point on their shared edge.
  const edgePoint = (a: number, b: number): V => {
    const tb = new Set(tiles[b]!.boundary.map(key));
    const shared = tiles[a]!.boundary.filter((c) => tb.has(key(c)));
    if (shared.length < 2) return norm(lerp(tiles[a]!.center, tiles[b]!.center, 0.5));
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return norm(lerp(shared[0]!, shared[1]!, 0.5 + (hash01(seed, lo, hi, 5) - 0.5) * 0.45));
  };
  // The point a river passes through inside a tile: the centre with a seeded meander.
  const nodePoint = (t: number): V => {
    const tile = tiles[t]!;
    const c = norm(tile.center);
    const b0 = norm(tile.boundary[0]!), b1 = norm(tile.boundary[Math.floor(tile.boundary.length / 2)]!);
    const j0 = (hash01(seed, t, 11) - 0.5) * 0.5, j1 = (hash01(seed, t, 13) - 0.5) * 0.5;
    return norm([c[0] + (b0[0] - c[0]) * j0 + (b1[0] - c[0]) * j1, c[1] + (b0[1] - c[1]) * j0 + (b1[1] - c[1]) * j1, c[2] + (b0[2] - c[2]) * j0 + (b1[2] - c[2]) * j1]);
  };

  let triangles = 0;

  const buildRiver = (river: River): void => {
    // Control points; seg[k] is the tile that the segment k -> k+1 lies on.
    const ctrl: V[] = [];
    const seg: number[] = [];
    const path = river.tiles;
    for (let i = 0; i < path.length; i++) {
      const t = path[i]!;
      const last = i === path.length - 1;
      if (last && river.lake === t && i > 0) {
        ctrl.push(norm(lerp(norm(tiles[t]!.center), ctrl[ctrl.length - 1]!, 0.35)));
      } else ctrl.push(nodePoint(t));
      if (!last) { seg.push(t); ctrl.push(edgePoint(t, path[i + 1]!)); seg.push(path[i + 1]!); }
    }
    const lastLand = path[path.length - 1]!;
    if (river.mouth >= 0) {
      seg.push(lastLand);
      const e = edgePoint(lastLand, river.mouth);
      ctrl.push(e);
      seg.push(river.mouth);
      ctrl.push(norm(lerp(e, norm(tiles[river.mouth]!.center), 0.3)));
    }
    if (ctrl.length < 2) return;

    const radiusOf = (t: number): number => (tiles[t]!.terrain === 'ocean' ? SEA_LEVEL : heights[t]!) + EPS;
    const flowOf = (t: number): number => Math.max(1, sys.flow[t]! || sys.flow[lastLand]! || 1);

    const samples: Sample[] = [];
    let horiz = 0;
    let prevDir: V | null = null;
    const push = (dir: V, t: number, r: number, f: number, flare: number, fade: number): void => {
      if (prevDir) horiz += Math.hypot(...sub(dir, prevDir));
      prevDir = dir;
      const taper = 0.3 + 0.7 * Math.min(1, horiz / 0.07);
      const fl = Math.min(3, 1 + 0.5 * (flowOf(t) - 1));
      samples.push({ dir, r, half: HALF_W * taper * fl * flare, foam: f, alpha: Math.min(1, horiz / 0.012) * fade });
    };

    for (let k = 0; k < ctrl.length - 1; k++) {
      const t = seg[k]!;
      const isSea = tiles[t]!.terrain === 'ocean';
      const p0 = ctrl[Math.max(0, k - 1)]!, p1 = ctrl[k]!, p2 = ctrl[k + 1]!, p3 = ctrl[Math.min(ctrl.length - 1, k + 2)]!;
      const r = radiusOf(t);
      const startS = k > 0 && seg[k - 1] !== t ? 1 : 0; // skip the edge point already placed by the waterfall
      for (let s = startS; s < SUB; s++) {
        const u = s / SUB;
        push(norm(catmull(p0, p1, p2, p3, u)), t, r, 0, isSea ? 1 + u * 0.8 : 1, isSea ? 1 - u : 1);
      }
      const next = seg[k + 1];
      const endDir = p2;
      if (next === undefined) {
        push(endDir, t, r, 0, isSea ? 1.8 : 1, isSea ? 0 : 1);
      } else if (next !== t) {
        // Crossing onto a new tile at an edge: drop down the cliff as a waterfall.
        const r2 = radiusOf(next);
        const drop = r - r2;
        const prev = samples[samples.length - 1]!.dir;
        const after = norm(catmull(p1, p2, ctrl[Math.min(ctrl.length - 1, k + 2)]!, ctrl[Math.min(ctrl.length - 1, k + 3)]!, 1 / SUB));
        const tan = norm(sub(after, prev));
        const lip = norm([endDir[0] + tan[0] * FALL_OFF, endDir[1] + tan[1] * FALL_OFF, endDir[2] + tan[2] * FALL_OFF]);
        const f = drop > FOAM_DROP ? 1 : 0;
        push(endDir, t, r, f * 0.5, 1, 1);
        push(lip, t, r, f, 1, 1);
        push(lip, next, r2, f, 1, 1);
      }
    }
    if (samples.length < 2) return;

    // Ribbon: two vertices per sample, offset sideways in the vertex shader.
    let along = 0;
    let lastSide: V = [1, 0, 0];
    let prevIdx = -1;
    for (let i = 0; i < samples.length; i++) {
      const sm = samples[i]!;
      const p = scale(sm.dir, sm.r);
      if (i > 0) { const q = samples[i - 1]!; along += Math.hypot(...sub(p, scale(q.dir, q.r))); }
      const a = samples[Math.max(0, i - 1)]!.dir, b = samples[Math.min(samples.length - 1, i + 1)]!.dir;
      let tan = sub(b, a);
      tan = sub(tan, scale(sm.dir, dot(tan, sm.dir)));
      const tl = Math.hypot(...tan);
      let sd: V = lastSide;
      if (tl > 1e-7) { sd = norm(cross(sm.dir, scale(tan, 1 / tl))); lastSide = sd; }
      const l = vert(p, sd, sm.half, -1, along, sm.foam, sm.alpha, 0);
      vert(p, sd, sm.half, 1, along, sm.foam, sm.alpha, 0);
      if (prevIdx >= 0) { index.push(prevIdx, prevIdx + 1, l, prevIdx + 1, l + 1, l); triangles += 2; }
      prevIdx = l;
    }
  };

  for (const r of sys.rivers) buildRiver(r);

  // Lakes: a flat fan at the tile's own height with a soft light rim.
  const zero: V = [0, 0, 0];
  for (const t of sys.lakes) {
    const tile = tiles[t]!;
    const r = heights[t]! + LAKE_EPS;
    const c = norm(tile.center);
    const ci = vert(scale(c, r), zero, 0, 0, 0, 0, 1, 1);
    const k = tile.boundary.length;
    const ring: number[] = [];
    for (let i = 0; i < k; i++) {
      const b = norm(tile.boundary[i]!);
      const wob = 0.86 + (hash01(seed, t, i, 3) - 0.5) * 0.08;
      ring.push(vert(scale(norm(lerp(c, b, wob - 0.1)), r), zero, 0, 0.82, 0, 0, 1, 1));
      ring.push(vert(scale(norm(lerp(c, b, wob)), r), zero, 0, 1, 0, 0, 1, 1));
    }
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k;
      const in0 = ring[i * 2]!, out0 = ring[i * 2 + 1]!, in1 = ring[j * 2]!, out1 = ring[j * 2 + 1]!;
      index.push(ci, in0, in1, in0, out0, in1, out0, out1, in1);
      triangles += 3;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 3));
  g.setAttribute('aHalf', new THREE.Float32BufferAttribute(half, 1));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(uu, 1));
  g.setAttribute('aV', new THREE.Float32BufferAttribute(vv, 1));
  g.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1));
  g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alpha, 1));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return { geometry: g, stats: { rivers: sys.rivers.length, lakes: sys.lakes.length, triangles } };
}

const VERT = /* glsl */ `
  attribute vec3 aSide; attribute float aHalf; attribute float aU; attribute float aV;
  attribute float aFoam; attribute float aAlpha; attribute float aKind;
  uniform float uWide;
  varying float vU; varying float vV; varying float vFoam; varying float vAlpha; varying float vKind;
  void main() {
    vU = aU; vV = aV; vFoam = aFoam; vAlpha = aAlpha; vKind = aKind;
    vec3 p = position + aSide * aHalf * aU * uWide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uRiver; uniform vec3 uLake; uniform vec3 uLight; uniform vec3 uFoam; uniform float uTime;
  varying float vU; varying float vV; varying float vFoam; varying float vAlpha; varying float vKind;
  void main() {
    vec3 c; float a;
    if (vKind > 0.5) {
      float rim = smoothstep(0.8, 0.93, vU);
      float shimmer = 0.03 * sin(uTime * 0.7 + vU * 9.0);
      c = mix(uLake, uLight, rim * 0.75) + shimmer;
      a = 0.97 * (1.0 - smoothstep(0.93, 1.0, vU));
    } else {
      float edge = 1.0 - smoothstep(0.45, 1.0, abs(vU));
      float s = sin(vV * 300.0 - uTime * 3.2 + sin(vU * 2.5 + vV * 70.0) * 1.6);
      float streak = smoothstep(0.6, 1.0, s);
      c = mix(uRiver, uLight, 0.15 + 0.4 * streak);
      float rush = step(0.45, fract(vV * 500.0 - uTime * 7.0 + vU * 0.4));
      c = mix(c, uFoam, clamp(vFoam * (0.7 + 0.3 * rush), 0.0, 1.0));
      a = edge * vAlpha * 0.95;
    }
    gl_FragColor = vec4(c, a);
    #include <colorspace_fragment>
  }
`;

export function makeRiverMaterial(ocean: string): THREE.ShaderMaterial {
  const base = new THREE.Color(ocean);
  const river = base.clone().lerp(new THREE.Color('#ffffff'), 0.18);
  const light = base.clone().lerp(new THREE.Color('#e8f4ff'), 0.5);
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uRiver: { value: river },
      uLake: { value: base.clone() },
      uLight: { value: light },
      uFoam: { value: new THREE.Color('#f7fbff') },
      uTime: { value: 0 },
      uWide: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
