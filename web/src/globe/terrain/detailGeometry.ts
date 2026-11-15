// Terrain detail geometry: a handful of small low-poly shapes built in code (peaks, a knoll, rocks, a dune,
// a mesa, seracs, scrub, reeds) and the one material they all share. Every shape sits on y = 0 with a skirt
// below it, is about one unit wide and one unit tall, and is scaled per instance.
//
// Per vertex: `color` (the natural colour of the face), `aBlend` (0 = take the province's colour, 1 = natural)
// and `aH` (the face's height, 0 foot .. 1 top). Per instance: `instanceColor` (the province's colour right
// now, political tint included) and `aInst` = (snow line in aH units, share of the natural colour kept). So a
// peak's foot is the province's own colour, its flanks are rock and its top is snow, in every map mode.
import * as THREE from 'three';

/** Natural colours of the detail, in one place so another layer can match them. */
export const TERRAIN_DETAIL_COLORS = {
  rockLight: '#b3a999',
  rockDark: '#8a8073',
  scree: '#9c8c76',
  snow: '#f4f6f8',
  knoll: '#9a9a62',
  boulderLight: '#9b958a',
  boulderDark: '#77716a',
  sandLight: '#f0dba6',
  sandShade: '#cfb276',
  mesaTalus: '#c79a68',
  mesaBandA: '#b3714a',
  mesaBandB: '#c4855c',
  mesaTop: '#d4a273',
  iceLight: '#e4f3f9',
  iceMid: '#bfe0ee',
  iceDeep: '#93c6de',
  scrubLight: '#8c9a55',
  scrubDark: '#66783f',
  reed: '#8f9a52',
  reedTip: '#c9b877',
} as const;

export const DETAIL_KINDS = ['peak0', 'peak1', 'peak2', 'peak3', 'knoll', 'rockA', 'rockB', 'dune', 'mesa', 'serac', 'scrub', 'reed'] as const;
export type DetailKind = (typeof DETAIL_KINDS)[number];

type V = [number, number, number, number]; // x, y, z, blend

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cA = new THREE.Color(), cB = new THREE.Color();

class Soup {
  private pos: number[] = [];
  private col: number[] = [];
  private blend: number[] = [];
  private fh: number[] = [];
  constructor(readonly rnd: () => number) {}

  /** One flat face. `inside` is a point the face looks away from (null: the face looks up). */
  tri(a: V, b: V, c: V, light: string, dark: string, inside: [number, number, number] | null, hJitter = 0.05): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3, my = (a[1] + b[1] + c[1]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
    const out = inside ? nx * (mx - inside[0]) + ny * (my - inside[1]) + nz * (mz - inside[2]) : ny;
    const order = out >= 0 ? [a, b, c] : [a, c, b];
    cA.set(light).lerp(cB.set(dark), this.rnd());
    const h = my + (this.rnd() - 0.5) * 2 * hJitter;
    for (const p of order) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(cA.r, cA.g, cA.b);
      this.blend.push(p[3]);
      this.fh.push(h);
    }
  }

  /** Faces between two rings with the same number of points. */
  band(lo: V[], hi: V[], light: string, dark: string, inside: [number, number, number]): void {
    const n = lo.length;
    for (let i = 0; i < n; i++) {
      const a0 = lo[i]!, a1 = lo[(i + 1) % n]!, b0 = hi[i]!, b1 = hi[(i + 1) % n]!;
      if (i % 2) { this.tri(a0, a1, b1, light, dark, inside); this.tri(a0, b1, b0, light, dark, inside); }
      else { this.tri(a0, a1, b0, light, dark, inside); this.tri(a1, b1, b0, light, dark, inside); }
    }
  }

  fan(ring: V[], apex: V, light: string, dark: string, inside: [number, number, number]): void {
    const n = ring.length;
    for (let i = 0; i < n; i++) this.tri(ring[i]!, ring[(i + 1) % n]!, apex, light, dark, inside);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aBlend', new THREE.Float32BufferAttribute(this.blend, 1));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(this.fh, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** A ring of `n` points at height `y`, radius `r` (jittered), centred on (cx, cz), stretched by `sx` along x. */
function ring(rnd: () => number, n: number, y: number, r: number, jitter: number, phase: number, cx: number, cz: number, blend: number, sx = 1): V[] {
  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + ((i + (rnd() - 0.5) * 0.35) / n) * Math.PI * 2;
    const rr = r * (1 + (rnd() - 0.5) * 2 * jitter);
    out.push([cx + Math.cos(a) * rr * sx, y + (rnd() - 0.5) * jitter * 0.25, cz + Math.sin(a) * rr, blend]);
  }
  return out;
}

const C = TERRAIN_DETAIL_COLORS;

/** One faceted cone of rock: skirt, foot, three shoulders and an apex that leans off-centre. */
function cone(s: Soup, n: number, cx: number, cz: number, radius: number, height: number, sx: number, lean: number): void {
  const r = s.rnd;
  const ax = (r() - 0.5) * lean * radius, az = (r() - 0.5) * lean * radius;
  const inside: [number, number, number] = [cx + ax * 0.4, height * 0.25, cz + az * 0.4];
  const phase = r() * Math.PI * 2;
  const step = Math.PI / n;
  const levels: [number, number, number, number][] = [ // y share, radius share, jitter, blend
    [-0.22, 1.1, 0.03, 0], [0, 1, 0.07, 0], [0.2, 0.75, 0.14, 0.5], [0.45, 0.5, 0.16, 0.86], [0.7, 0.29, 0.18, 0.9],
  ];
  const rings = levels.map(([y, rr, j, b], i) => {
    const k = Math.max(0, y);
    return ring(r, n, y * height, rr * radius, j, phase + step * i, cx + ax * k, cz + az * k, b, sx);
  });
  s.band(rings[0]!, rings[1]!, C.scree, C.scree, inside);
  s.band(rings[1]!, rings[2]!, C.scree, C.rockDark, inside);
  s.band(rings[2]!, rings[3]!, C.rockLight, C.rockDark, inside);
  s.band(rings[3]!, rings[4]!, C.rockLight, C.rockDark, inside);
  s.fan(rings[4]!, [cx + ax, height, cz + az, 0.9], C.rockLight, C.rockDark, inside);
}

function peak(seed: number, sx: number, shoulders: [number, number, number, number][]): THREE.BufferGeometry {
  const s = new Soup(rng(seed));
  cone(s, 7, 0, 0, 1 / sx, 1, sx, 0.5);
  for (const [x, z, radius, height] of shoulders) cone(s, 6, x, z, radius, height, 1, 0.4);
  return s.build();
}

function knoll(seed: number): THREE.BufferGeometry {
  const s = new Soup(rng(seed));
  const r = s.rnd;
  const inside: [number, number, number] = [0, -0.2, 0];
  const rings = [
    ring(r, 8, -0.3, 1.14, 0.03, 0, 0, 0, 0),
    ring(r, 8, 0, 1, 0.06, 0.39, 0, 0, 0),
    ring(r, 8, 0.52, 0.68, 0.1, 0.78, 0.04, -0.03, 0.55),
    ring(r, 8, 0.86, 0.33, 0.12, 1.17, 0.07, -0.05, 0.9),
  ];
  for (let i = 0; i < 3; i++) s.band(rings[i]!, rings[i + 1]!, C.knoll, C.knoll, inside);
  s.fan(rings[3]!, [0.08, 1, -0.06, 1], C.knoll, C.knoll, inside);
  return s.build();
}

/** A deformed icosahedron with a sunk foot: lumps = [x, z, radius, height]. */
function lumps(seed: number, list: [number, number, number, number][], light: string, dark: string, rough: number, top: number): THREE.BufferGeometry {
  const s = new Soup(rng(seed));
  const ico = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const p = ico.getAttribute('position');
  for (const [x, z, radius, height] of list) {
    const moved = new Map<string, V>();
    const at = (i: number): V => {
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let v = moved.get(k);
      if (!v) {
        const f = 1 + (s.rnd() - 0.5) * 2 * rough;
        const y = (p.getY(i) * f * 0.5 + 0.34) * height;
        v = [x + p.getX(i) * f * radius, y, z + p.getZ(i) * f * radius, y < 0.12 * height ? 0.3 * top : top];
        moved.set(k, v);
      }
      return v;
    };
    const inside: [number, number, number] = [x, 0.3 * height, z];
    for (let i = 0; i < p.count; i += 3) s.tri(at(i), at(i + 1), at(i + 2), light, dark, inside, 0.02);
  }
  ico.dispose();
  return s.build();
}

/** A crescent dune: the wind blows along +z, so the long slope faces -z and the horns point +z. */
function dune(seed: number): THREE.BufferGeometry {
  const s = new Soup(rng(seed));
  const segs = 6;
  const rows: V[][] = [];
  for (let i = 0; i <= segs; i++) {
    const u = -1 + (2 * i) / segs;
    const w = Math.max(0, 1 - u * u);
    const zc = 0.42 * u * u - 0.1;
    const h = Math.pow(w, 0.75);
    rows.push([
      [u * 1.02, -0.12, zc - 0.25 - 0.75 * w, 0],
      [u, h, zc, 0.6 * h],
      [u * 0.98, -0.12, zc + 0.08 + 0.3 * w, 0],
    ]);
  }
  for (let i = 0; i < segs; i++) {
    const a = rows[i]!, b = rows[i + 1]!;
    s.tri(a[0]!, b[0]!, b[1]!, C.sandLight, C.sandLight, null, 0);
    s.tri(a[0]!, b[1]!, a[1]!, C.sandLight, C.sandLight, null, 0);
    s.tri(a[1]!, b[1]!, b[2]!, C.sandShade, C.sandShade, null, 0);
    s.tri(a[1]!, b[2]!, a[2]!, C.sandShade, C.sandShade, null, 0);
  }
  return s.build();
}

function mesa(seed: number): THREE.BufferGeometry {
  const s = new Soup(rng(seed));
  const r = s.rnd;
  const inside: [number, number, number] = [0, 0.4, 0];
  const n = 7;
  const rings = [
    ring(r, n, -0.2, 1.1, 0.03, 0, 0, 0, 0),
    ring(r, n, 0, 1, 0.06, 0.2, 0, 0, 0.1),
    ring(r, n, 0.34, 0.66, 0.08, 0.45, 0, 0, 0.8),
    ring(r, n, 0.62, 0.6, 0.06, 0.5, 0, 0, 0.92),
    ring(r, n, 0.94, 0.56, 0.07, 0.6, 0, 0, 0.92),
  ];
  s.band(rings[0]!, rings[1]!, C.mesaTalus, C.mesaTalus, inside);
  s.band(rings[1]!, rings[2]!, C.mesaTalus, C.mesaBandB, inside);
  s.band(rings[2]!, rings[3]!, C.mesaBandA, C.mesaBandA, inside);
  s.band(rings[3]!, rings[4]!, C.mesaBandB, C.mesaBandB, inside);
  s.fan(rings[4]!, [0.05, 1, -0.04, 0.92], C.mesaTop, C.mesaTop, inside);
  return s.build();
}

/** A cluster of leaning shards: [x, z, radius, height, lean x, lean z]. */
function shards(seed: number, list: [number, number, number, number, number, number][], sides: number, light: string, mid: string, deep: string, footBlend: number): THREE.BufferGeometry {
  const s = new Soup(rng(seed));
  const r = s.rnd;
  for (const [x, z, radius, height, lx, lz] of list) {
    const inside: [number, number, number] = [x + lx * 0.3, height * 0.3, z + lz * 0.3];
    const phase = r() * 6.28;
    const lo = ring(r, sides, -0.15, radius, 0.12, phase, x, z, footBlend);
    const hi = ring(r, sides, height * 0.72, radius * 0.62, 0.12, phase + 0.3, x + lx * 0.7, z + lz * 0.7, 0.92);
    s.band(lo, hi, mid, deep, inside);
    s.fan(hi, [x + lx, height, z + lz, 0.92], light, mid, inside);
  }
  return s.build();
}

function reeds(seed: number): THREE.BufferGeometry {
  const s = new Soup(rng(seed));
  const r = s.rnd;
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 0.75;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = 0.55 + 0.45 * r();
    const lx = (r() - 0.5) * 0.35, lz = (r() - 0.5) * 0.35;
    const base = ring(r, 3, -0.05, 0.085, 0.1, r() * 6.28, x, z, 0.8);
    s.fan(base, [x + lx, h, z + lz, 1], C.reed, C.reedTip, [x, 0.1, z]);
  }
  return s.build();
}

/** Every detail geometry, built once per world. Triangle counts are 18 to about 150 each. */
export function buildDetailGeometries(): Record<DetailKind, THREE.BufferGeometry> {
  return {
    peak0: peak(11, 1, []),
    peak1: peak(23, 1.18, [[0.62, 0.18, 0.5, 0.62]]),
    peak2: peak(37, 1.05, [[-0.5, 0.42, 0.52, 0.7], [0.55, -0.35, 0.4, 0.46]]),
    peak3: peak(53, 1.3, [[-0.7, -0.1, 0.44, 0.55]]),
    knoll: knoll(61),
    rockA: lumps(71, [[0, 0, 1, 1]], C.boulderLight, C.boulderDark, 0.2, 0.62),
    rockB: lumps(83, [[-0.3, 0, 0.75, 0.8], [0.55, 0.2, 0.45, 0.5], [0.2, -0.55, 0.32, 0.36]], C.boulderLight, C.boulderDark, 0.2, 0.62),
    dune: dune(97),
    mesa: mesa(101),
    serac: shards(113, [[0, 0, 0.42, 1, 0.16, 0.05], [0.5, 0.25, 0.3, 0.66, 0.2, 0.1], [-0.45, 0.3, 0.3, 0.52, -0.14, 0.1], [-0.1, -0.5, 0.26, 0.42, 0, -0.14]], 4, C.iceLight, C.iceMid, C.iceDeep, 0.15),
    scrub: lumps(127, [[-0.25, 0, 0.62, 0.8], [0.45, 0.15, 0.42, 0.55]], C.scrubLight, C.scrubDark, 0.16, 0.92),
    reed: reeds(131),
  };
}

/**
 * The one material every detail mesh shares: flat shaded like the provinces, lit by the same sun. The vertex
 * colour is a blend of the province's colour (instanceColor) and the natural one, then snow above the snow line.
 */
export function makeDetailMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const snow = new THREE.Color(C.snow);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = { value: snow };
    shader.vertexShader = `attribute float aBlend;\nattribute float aH;\nattribute vec2 aInst;\nuniform vec3 uSnow;\n${shader.vertexShader}`.replace(
      '#include <color_vertex>',
      'vColor = mix(instanceColor.xyz, color.xyz, aBlend * aInst.y);\n\tvColor = mix(vColor, uSnow, step(aInst.x, aH));',
    );
  };
  mat.customProgramCacheKey = () => 'terrain-detail';
  return mat;
}
