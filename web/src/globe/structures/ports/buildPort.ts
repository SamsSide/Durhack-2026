// Lane b: one procedural harbour on a coast tile. Pure: the same structure id, era, colour and free space give
// the same harbour. Everything is instanced boxes, cylinders, cones and gable roofs (four part buffers), laid
// out along the axis toward the neighbouring ocean tile (s, the shore is at s = e) and across it (o).
// A coastal town gets one pier. A port structure gets the whole place and no landmark model: a quay along the
// shore, a yard with warehouses under the nation's colour, piers out into the water, a crane and boats.
import * as THREE from 'three';
import type { Structure, World } from '@terra/shared';
import { LAND_BASE, SEA_LEVEL } from '../../constants';
import { hash01 } from '../placement';
import type { TileGeo } from '../placement';
import { feetExcept, inFeet } from '../occupancy';
import type { Foot } from '../occupancy';
import { PartBuf } from '../../towns/buildTown';
import { PORT_BOATS, PORT_COLORS as C, PORT_SIZE as Z } from './portStyle';
import type { PortEra } from './portStyle';

export interface PortParts {
  boxes: PartBuf;  // unit box, base at y = 0
  cyls: PartBuf;   // unit cylinder (diameter 1, height 1), base at y = 0
  cones: PartBuf;  // unit cone (diameter 1, height 1), base at y = 0
  roofs: PartBuf;  // unit gable roof (1 x 1 footprint, height 1, ridge along x), base at y = 0
  feet: Foot[];    // the land the harbour stands on, kept clear of houses
}

const DECK = LAND_BASE + 0.0013;   // top of a pier deck
const WATER = SEA_LEVEL;
/** Tile width (flat to flat) over TileGeo.width (the mean centre-to-corner distance). */
const TILE_W = 1.73;

const _p = new THREE.Vector3(), _up = new THREE.Vector3(), _fx = new THREE.Vector3(), _fz = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _c = new THREE.Color(), _d = new THREE.Vector3();

export interface ShoreFrame {
  e: number;      // distance from the tile centre to the shore, along `dir`
  mid: number;    // where the middle of the shore edge lies, across `dir` (along dir x normal)
  edge: number;   // the length of the shore edge
}

/**
 * The frame a harbour is laid out in: `out` is set to the direction out to sea, square to the edge the tile
 * shares with the ocean neighbour, in the tile's tangent plane. Tiles are irregular, so the edge is read from
 * the two boundary corners both tiles share; without them the line between the two centres stands in.
 */
export function pierAxis(world: World, g: TileGeo, tile: number, ocean: number, out: THREE.Vector3): ShoreFrame {
  const nc = world.tiles[ocean]!.center;
  _d.set(nc[0], nc[1], nc[2]).normalize().sub(g.n);
  const e = _d.length() * 0.5 * g.h;
  out.copy(_d).addScaledVector(g.n, -_d.dot(g.n)).normalize();
  const mine = world.tiles[tile]?.boundary ?? [], theirs = world.tiles[ocean]!.boundary;
  const shared: THREE.Vector3[] = [];
  for (const p of mine) {
    if (!theirs.some((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-5)) continue;
    const v = new THREE.Vector3(p[0], p[1], p[2]).normalize();
    shared.push(v.multiplyScalar(g.h / Math.max(1e-6, v.dot(g.n))).addScaledVector(g.n, -g.h)); // onto the tangent plane
  }
  if (shared.length !== 2) return { e, mid: 0, edge: 1.1 * e };
  const [v1, v2] = shared as [THREE.Vector3, THREE.Vector3];
  const along = _d.copy(v2).sub(v1);
  const edge = along.length();
  if (edge < 1e-6) return { e, mid: 0, edge: 1.1 * e };
  along.multiplyScalar(1 / edge);
  const m = v1.add(v2).multiplyScalar(0.5);
  const seaward = out.clone();
  out.copy(m).addScaledVector(along, -m.dot(along));       // from the centre square onto the edge's line
  if (out.lengthSq() < 1e-12 || out.dot(seaward) < 0) { out.copy(seaward); return { e, mid: 0, edge }; }
  const dist = out.length();
  out.multiplyScalar(1 / dist);
  return { e: dist, mid: m.dot(_fx.crossVectors(out, g.n)), edge };
}

/** How much boundary two tiles share: the distance between their two common corners (0 when they have none). */
function sharedEdge(world: World, tile: number, other: number): number {
  const mine = world.tiles[tile]?.boundary ?? [], theirs = world.tiles[other]?.boundary ?? [];
  const hit = mine.filter((p) => theirs.some((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-5));
  return hit.length === 2 ? Math.hypot(hit[0]![0] - hit[1]![0], hit[0]![1] - hit[1]![1], hit[0]![2] - hit[1]![2]) : 0;
}

/** The ocean neighbour a harbour faces: the one across the tile's longest stretch of shore, or -1 inland. */
export function oceanNeighbour(world: World, tile: number): number {
  let best = -1, len = -1;
  for (const n of [...(world.tiles[tile]?.neighbors ?? [])].sort((a, b) => a - b)) {
    if (world.tiles[n]?.terrain !== 'ocean') continue;
    const l = sharedEdge(world, tile, n);
    if (l > len + 1e-9) { best = n; len = l; }
  }
  return best;
}

/** A short signature of the space other structures hold on the tile (part of the rebuild key). */
export function spaceSig(tile: number, id: string): string {
  let s = '';
  for (const f of feetExcept(tile, id)) s += `${f.a.toFixed(4)},${f.b.toFixed(4)},${f.half.toFixed(4)};`;
  return s;
}

export function buildPort(world: World, s: Structure, g: TileGeo, ocean: number, era: PortEra, small: boolean, footId: string, team: string): PortParts {
  const out: PortParts = { boxes: new PartBuf(), cyls: new PartBuf(), cones: new PartBuf(), roofs: new PartBuf(), feet: [] };
  const dir = new THREE.Vector3();
  const shore = pierAxis(world, g, s.tile, ocean, dir);
  const e = shore.e, mid = shore.mid;
  // U is the tile width every size is a fraction of. A port shrinks (to 0.7 at most) to fit a short shore edge.
  const U0 = TILE_W * g.width;
  const U = small ? U0 : U0 * Math.min(1, Math.max(0.7, (0.47 * shore.edge) / (Z.quayHalf[era] * U0)));
  const side = new THREE.Vector3().crossVectors(dir, g.n);
  const H = (k: number): number => hash01(`${s.id}:${k}`, 73);
  const feet = feetExcept(s.tile, footId);
  const a1 = dir.dot(g.t1), a2 = dir.dot(g.t2), b1 = side.dot(g.t1), b2 = side.dot(g.t2);
  const taken = (sv: number, o: number, m: number): boolean => feet.length > 0 && inFeet(feet, a1 * sv + b1 * (o + mid), a2 * sv + b2 * (o + mid), m);

  // Place a unit part at (s along the axis, o across it, r radius) turned by `yaw` about the surface normal.
  const put = (buf: PartBuf, sv: number, o: number, r: number, yaw: number, sx: number, sy: number, sz: number, col: string): void => {
    _p.copy(g.n).multiplyScalar(g.h).addScaledVector(dir, sv).addScaledVector(side, o + mid).normalize();
    _up.copy(_p);
    _p.multiplyScalar(r);
    _fx.copy(dir).multiplyScalar(Math.cos(yaw)).addScaledVector(side, Math.sin(yaw));
    _fx.addScaledVector(_up, -_fx.dot(_up)).normalize();
    _fz.crossVectors(_fx, _up);
    _m.makeBasis(_fx, _up, _fz);
    _q.setFromRotationMatrix(_m);
    buf.add(_p, _q, sx, sy, sz, _c.set(col));
  };
  const box = (sv: number, o: number, r0: number, l: number, h: number, w: number, col: string, yaw = 0): void => put(out.boxes, sv, o, r0, yaw, l, h, w, col);
  const cyl = (sv: number, o: number, r0: number, d: number, h: number, col: string): void => put(out.cyls, sv, o, r0, 0, d, h, d, col);
  const cone = (sv: number, o: number, r0: number, d: number, h: number, col: string): void => put(out.cones, sv, o, r0, 0, d, h, d, col);
  const pick = <T,>(arr: readonly T[], k: number): T => arr[Math.floor(H(k) * arr.length) % arr.length]!;
  const footAt = (sv: number, o: number, half: number): void => { out.feet.push({ a: a1 * sv + b1 * (o + mid), b: a2 * sv + b2 * (o + mid), half, ax: a1, ay: a2 }); };

  // ---- boats ----------------------------------------------------------------------------------------
  // `yaw` 0 points the bow out to sea, a quarter turn lays the boat along the quay.
  const boat = (sv: number, o: number, k: number, big: number, yaw = 0): void => {
    const r0 = WATER + 0.0004;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const bb = (dl: number, dw: number, up: number, l: number, h: number, w: number, col: string): void => box(sv + dl * cs - dw * sn, o + dl * sn + dw * cs, r0 + up, l, h, w, col, yaw);
    const bc = (dl: number, dw: number, up: number, d: number, h: number, col: string): void => cyl(sv + dl * cs - dw * sn, o + dl * sn + dw * cs, r0 + up, d, h, col);
    const hl = (era === 'modern' ? 0.34 : era === 'future' ? 0.26 : era === 'middle' ? 0.19 : 0.17) * U * big, hw = hl * (era === 'modern' ? 0.2 : 0.3);
    const v = U * big; // heights scale with the boat
    if (era === 'early') {
      const hull = pick(C.hullWood, k);
      bb(0, 0, 0, hl, 0.02 * v, hw, hull);
      bb(hl * 0.42, 0, 0.012 * v, hl * 0.18, 0.016 * v, hw * 0.6, hull);        // raised stem
      bb(-hl * 0.42, 0, 0.012 * v, hl * 0.14, 0.012 * v, hw * 0.8, hull);       // stern
      bc(0, 0, 0.02 * v, 0.01 * v, 0.1 * v, C.pile);                            // mast
      bb(-0.006 * v, 0, 0.045 * v, 0.004 * v, 0.065 * v, hw * 1.5, C.sail);     // sail across the boat
    } else if (era === 'middle') {
      const hull = H(k) < 0.5 ? C.hullDark : C.hullRed;
      bb(0, 0, 0, hl, 0.024 * v, hw, hull);
      bb(0, 0, 0.024 * v, hl * 0.94, 0.003 * v, hw * 0.86, C.plank[0]);         // deck
      bb(-hl * 0.26, 0, 0.027 * v, hl * 0.26, 0.02 * v, hw * 0.7, C.sail);      // cabin
      bc(hl * 0.08, 0, 0.027 * v, 0.022 * v, 0.05 * v, C.funnel);
      bc(hl * 0.08, 0, 0.064 * v, 0.024 * v, 0.008 * v, C.funnelBand);
      bc(hl * 0.36, 0, 0.027 * v, 0.006 * v, 0.05 * v, C.pile);                 // foremast
    } else if (era === 'modern') {
      bb(0, 0, 0, hl, 0.026 * v, hw, C.hullDark);
      bb(0, 0, 0.004 * v, hl * 1.002, 0.006 * v, hw * 1.02, C.hullRed);         // waterline band
      bb(-hl * 0.4, 0, 0.026 * v, hl * 0.12, 0.05 * v, hw * 0.9, C.craneGrey);  // bridge
      bb(-hl * 0.4, 0, 0.076 * v, hl * 0.05, 0.012 * v, hw * 0.4, C.funnel);
      for (let i = 0; i < 10; i++) {
        const row = i < 5 ? 1 : -1, col = i % 5;
        const n = 1 + Math.floor(H(k * 13 + i) * 3);
        for (let l = 0; l < n; l++) bb(-hl * 0.24 + col * hl * 0.15, row * hw * 0.23, 0.026 * v + l * 0.014 * v, hl * 0.135, 0.014 * v, hw * 0.42, pick(C.containers, k * 7 + i * 3 + l));
      }
    } else {
      bb(0, 0, 0, hl, 0.016 * v, hw, C.floatHull);
      bb(0, 0, 0.007 * v, hl * 1.01, 0.004 * v, hw * 1.06, C.floatRing);         // a glowing band round the hull
      bc(-hl * 0.15, 0, 0.016 * v, hw * 0.8, 0.02 * v, C.floatPad);
      bc(-hl * 0.15, 0, 0.036 * v, hw * 0.45, 0.006 * v, C.floatRing);
    }
  };

  if (small) townPier(); else harbour();
  return out;

  // ---- a coastal town's pier ----------------------------------------------------------------------------
  function townPier(): void {
    // A short, low pier from the shore: clearly a lesser thing than a port's harbour.
    const s0 = e - 0.04 * U, s1 = e + 0.22 * U * (era === 'future' ? 1.1 : 1);
    const len = s1 - s0;
    footAt(e - 0.03 * U, 0, 0.05 * U);
    const dk = Math.min(DECK, WATER + Math.max(0.0035, 0.02 * U));
    if (era === 'early') {
      const pw = 0.05 * U, seg = 0.1 * U;
      for (let a = s0, i = 0; a < s1; a += seg, i++) box(a + Math.min(seg, s1 - a) / 2, 0, dk - 0.0007, Math.min(seg, s1 - a) * 0.97, 0.0009, pw, pick(C.plank, i * 3 + 1));
      for (let a = s0 + 0.08 * U; a < s1; a += 0.14 * U) for (const sd of [-1, 1]) cyl(a, sd * pw * 0.48, WATER - 0.002, 0.009 * U, dk - WATER + 0.002 + 0.006 * U, C.pile);
      boat(s1 - 0.1 * U, pw / 2 + 0.045 * U, 0, 0.8);
    } else if (era === 'middle') {
      const qw = 0.06 * U;
      box((s0 + s1) / 2, 0, WATER - 0.001, len, dk - WATER + 0.0004, qw, C.stone);
      for (const sd of [-1, 1]) box((s0 + s1) / 2, sd * (qw / 2 - 0.006 * U), dk + 0.0003, len, 0.0006, 0.012 * U, C.coping);
      for (let a = s0 + 0.08 * U; a < s1 - 0.03 * U; a += 0.1 * U) for (const sd of [-1, 1]) cyl(a, sd * (qw / 2 - 0.016 * U), dk + 0.0004, 0.008 * U, 0.0014, C.iron);
      box(s1 - 0.01 * U, 0, dk + 0.0003, 0.02 * U, 0.0008, qw * 1.12, C.stoneDark);
      boat(s1 - 0.1 * U, qw / 2 + 0.05 * U, 0, 0.75);
    } else if (era === 'modern') {
      const qw = 0.075 * U;
      box((s0 + s1) / 2, 0, WATER - 0.001, len, dk - WATER + 0.0004, qw, C.concrete);
      for (const sd of [-1, 1]) box((s0 + s1) / 2, sd * (qw / 2 - 0.003 * U), dk + 0.0003, len, 0.0003, 0.006 * U, C.stripe);
      for (let a = s0 + 0.08 * U; a < s1 - 0.03 * U; a += 0.1 * U) for (const sd of [-1, 1]) cyl(a, sd * (qw / 2 - 0.014 * U), dk + 0.0004, 0.008 * U, 0.0012, C.iron);
      for (const sd of [-1, 1]) box(e + 0.06 * U, sd * qw * 0.2, dk + 0.0003, 0.05 * U, 0.016 * U, 0.02 * U, pick(C.containers, sd > 0 ? 1 : 2));
      boat(s1 - 0.1 * U, qw / 2 + 0.045 * U, 0, 0.45);
    } else {
      const ww = 0.05 * U;
      box((s0 + s1) / 2, 0, dk - 0.0007, len, 0.0009, ww, C.floatWalk);
      floatPads(s0 + 0.1 * U, s1 - 0.04 * U, 0, dk);
      cyl(s1 - 0.02 * U, 0, dk, 0.012 * U, 0.06 * U, C.floatDark);
      cone(s1 - 0.02 * U, 0, dk + 0.06 * U, 0.03 * U, 0.02 * U, C.floatRing);
      boat(s1 - 0.1 * U, 0.22 * U, 0, 0.7);
    }
  }

  /** Round pontoon pads alternating down a floating walkway centred at `oc`. */
  function floatPads(from: number, to: number, oc: number, dk: number): void {
    let i = 0;
    for (let a = from; a < to; a += 0.17 * U, i++) {
      const sd = i % 2 === 0 ? 1 : -1;
      box(a, oc + sd * 0.07 * U, dk - 0.0005, 0.03 * U, 0.0005, 0.05 * U, C.floatWalk);   // gangway
      cyl(a, oc + sd * 0.12 * U, dk - 0.0007, 0.1 * U, 0.0009, C.floatPad);
      cyl(a, oc + sd * 0.12 * U, dk + 0.0002, 0.08 * U, 0.0003, C.floatRing);
      cyl(a, oc + sd * 0.12 * U, WATER - 0.0006, 0.07 * U, dk - WATER - 0.0006, C.floatDark);     // hull below
    }
  }

  // ---- a port: the whole harbour ------------------------------------------------------------------------
  function harbour(): void {
    const dk = Math.max(DECK, g.h + 0.0013);   // the top of the quay, the yard and the piers
    const base = WATER - 0.002;
    const pk = Math.min(dk, WATER + Math.max(0.0035, 0.02 * U)); // piers sit lower than the quay, nearer the boats
    const QH = Z.quayHalf[era] * U;            // half the quay's length along the shore
    const back = e - Z.yardDepth[era] * U;     // where the yard ends inland
    const face = e + 0.035 * U;                // the quay's water face
    const yard = e - 0.11 * U;                 // the row the buildings stand on
    // A solid block from under the water to deck height, between two s and across `w` centred at `oc`.
    const slab = (sa: number, sb: number, oc: number, w: number, col: string, top = dk): void => box((sa + sb) / 2, oc, base, sb - sa, top - base, w, col);
    const roof = (sv: number, o: number, r0: number, l: number, h: number, w: number, col: string, yaw: number): void => put(out.roofs, sv, o, r0, yaw, l, h, w, col);
    const free = (sv: number, o: number, half: number): boolean => !taken(sv, o, half);
    // A shed with a gable roof, its ridge along the shore; `l` runs along the shore, `w` inland.
    const shed = (sv: number, o: number, l: number, w: number, h: number, wall: string, top: string, rh: number): boolean => {
      if (!free(sv, o, Math.max(l, w) * 0.45)) return false;
      box(sv, o, dk, w, h, l, wall);
      roof(sv, o, dk + h, l * 1.06, rh, w * 1.12, top, Math.PI / 2);
      box(sv + w * 0.5, o, dk, 0.004 * U, h * 0.62, l * 0.22, C.door);               // the door faces the water
      return true;
    };
    const flag = (sv: number, o: number, r0: number, h: number): void => {
      cyl(sv, o, r0, 0.008 * U, h, C.iron);
      box(sv, o + 0.03 * U, r0 + h - 0.034 * U, 0.004 * U, 0.032 * U, 0.055 * U, team);
    };
    const crates = (sv: number, o: number, n: number, k: number): void => {
      for (let i = 0; i < n; i++) {
        const ds = (H(k + i * 2) - 0.5) * 0.05 * U, dx = (i - (n - 1) / 2) * 0.026 * U, sz = (0.016 + 0.01 * H(k + i * 2 + 1)) * U;
        if (i % 3 === 2) cyl(sv + ds, o + dx, dk, sz * 0.8, sz * 1.1, C.barrel);
        else box(sv + ds, o + dx, dk, sz, sz * 0.9, sz, pick(C.crate, k + i), H(k + i) * 0.6);
      }
    };
    for (const oc of [-0.66, 0, 0.66]) footAt((back + e) / 2, oc * QH, Math.max(QH / 3, (e - back) / 2));

    if (era === 'early') {
      // A timber waterfront: a boardwalk on piles, two jetties, a hall under the nation's colour and a lighthouse.
      slab(back, e - 0.02 * U, 0, 2 * QH, C.yardEarth, dk - 0.0004);
      slab(e - 0.03 * U, face, 0, 2 * QH, C.pile, dk - 0.0006);
      const n = 8, pl = (2 * QH) / n;
      for (let i = 0; i < n; i++) box((e - 0.03 * U + face) / 2, -QH + (i + 0.5) * pl, dk - 0.0006, face - e + 0.03 * U, 0.0008, pl * 0.96, pick(C.plank, i * 3 + 2));
      for (let i = 0; i <= n; i += 2) cyl(face, -QH + i * pl, base, 0.012 * U, dk - base + 0.006 * U, C.pile);
      const jetty = (oc: number, s1: number, pw: number, k: number): void => {
        const seg = 0.08 * U;
        for (let a = face, i = 0; a < s1; a += seg, i++) box(a + Math.min(seg, s1 - a) / 2, oc, pk - 0.0012, Math.min(seg, s1 - a) * 0.96, 0.0012, pw, pick(C.plank, k + i * 3));
        for (let a = face + 0.06 * U; a < s1 + 0.01 * U; a += 0.1 * U) for (const sd of [-1, 1]) cyl(a, oc + sd * pw * 0.5, base, 0.012 * U, pk - base + 0.008 * U, C.pile);
      };
      const m1 = -0.07 * U, e1 = e + 0.42 * U, m2 = 0.12 * U, e2 = e + 0.24 * U;
      for (const oc of [m1, m2]) box(face + 0.012 * U, oc, pk - 0.0012, 0.03 * U, (dk - pk) * 0.55, 0.04 * U, C.plank[1]); // a step down
      jetty(m1, e1, 0.06 * U, 1);
      jetty(m2, e2, 0.045 * U, 5);
      // the lighthouse stands on a stone mole at the end of the long jetty
      cyl(e1 + 0.02 * U, m1, base, 0.13 * U, pk - base, C.stone);
      cyl(e1 + 0.02 * U, m1, pk, 0.075 * U, 0.07 * U, C.lightWhite);
      cyl(e1 + 0.02 * U, m1, pk + 0.07 * U, 0.064 * U, 0.05 * U, C.lightRed);
      cyl(e1 + 0.02 * U, m1, pk + 0.12 * U, 0.054 * U, 0.05 * U, C.lightWhite);
      cyl(e1 + 0.02 * U, m1, pk + 0.17 * U, 0.07 * U, 0.006 * U, C.iron);
      cyl(e1 + 0.02 * U, m1, pk + 0.176 * U, 0.04 * U, 0.024 * U, C.lamp);
      cone(e1 + 0.02 * U, m1, pk + 0.2 * U, 0.066 * U, 0.04 * U, C.lightRed);
      shed(yard, 0.09 * U, 0.17 * U, 0.085 * U, 0.042 * U, C.timberWall, team, 0.04 * U);
      shed(yard - 0.005 * U, -0.12 * U, 0.09 * U, 0.065 * U, 0.032 * U, C.timberWall, C.thatch, 0.032 * U);
      crates(e - 0.035 * U, 0.02 * U, 5, 20);
      crates(e - 0.04 * U, -0.16 * U, 3, 40);
      flag(e - 0.04 * U, -0.035 * U, dk, 0.13 * U);
      boat(e1 - 0.14 * U, m1 - 0.075 * U, 0, 1.15);
      boat(e1 - 0.2 * U, m1 + 0.075 * U, 1, 1);
      if (PORT_BOATS.early > 2) boat(e2 - 0.1 * U, m2 + 0.065 * U, 2, 0.9);
      if (PORT_BOATS.early > 3) boat(face + 0.035 * U, -0.16 * U, 3, 0.7, Math.PI / 2);
    } else if (era === 'middle') {
      // A stone quay with a coping and bollards, brick warehouses, a crane on the quay edge, steamers alongside.
      slab(back, e - 0.04 * U, 0, 2 * QH, C.cobble, dk - 0.0004);
      slab(e - 0.045 * U, face, 0, 2 * QH + 0.01 * U, C.stone);
      box(face - 0.008 * U, 0, dk, 0.016 * U, 0.0012, 2 * QH + 0.012 * U, C.coping);
      for (let o = -QH + 0.03 * U; o < QH; o += 0.075 * U) cyl(face - 0.02 * U, o, dk, 0.012 * U, 0.012 * U, C.iron);
      const pier = (oc: number, s1: number, pw: number): void => {
        slab(face - 0.005 * U, s1, oc, pw, C.stone, pk);
        for (const sd of [-1, 1]) box((face + s1) / 2, oc + sd * (pw / 2 - 0.007 * U), pk, s1 - face, 0.0012, 0.014 * U, C.coping);
        for (let a = face + 0.05 * U; a < s1 - 0.03 * U; a += 0.09 * U) for (const sd of [-1, 1]) cyl(a, oc + sd * (pw / 2 - 0.02 * U), pk + 0.0012, 0.01 * U, 0.01 * U, C.iron);
        slab(s1 - 0.012 * U, s1 + 0.012 * U, oc, pw * 1.14, C.stoneDark, pk + 0.0016);
        box(face + 0.012 * U, oc, pk, 0.03 * U, (dk - pk) * 0.55, pw * 0.6, C.stoneDark);   // steps down from the quay
      };
      const m1 = -0.08 * U, e1 = e + 0.44 * U, m2 = 0.13 * U, e2 = e + 0.23 * U;
      pier(m1, e1, 0.085 * U);
      pier(m2, e2, 0.06 * U);
      // a harbour light at the end of the long pier
      cyl(e1 - 0.03 * U, m1, pk, 0.03 * U, 0.012 * U, C.stoneDark);
      cyl(e1 - 0.03 * U, m1, pk + 0.012 * U, 0.014 * U, 0.075 * U, C.iron);
      cyl(e1 - 0.03 * U, m1, pk + 0.087 * U, 0.024 * U, 0.016 * U, C.lamp);
      cone(e1 - 0.03 * U, m1, pk + 0.103 * U, 0.032 * U, 0.014 * U, C.iron);
      if (shed(yard, 0.1 * U, 0.17 * U, 0.085 * U, 0.055 * U, C.brick, team, 0.038 * U)) {
        box(yard, 0.1 * U, dk + 0.03 * U, 0.087 * U, 0.004 * U, 0.172 * U, C.coping);       // a pale string course
      }
      if (shed(yard - 0.005 * U, -0.125 * U, 0.11 * U, 0.07 * U, 0.042 * U, C.shed, C.shedRoof, 0.03 * U)) {
        cyl(yard - 0.03 * U, -0.19 * U, dk, 0.026 * U, 0.13 * U, C.brick);                    // chimney
        cyl(yard - 0.03 * U, -0.19 * U, dk + 0.13 * U, 0.03 * U, 0.008 * U, C.funnel);
      }
      // the crane: a post on the quay edge, its jib out over the berth
      const cs = face - 0.035 * U, co = 0.005 * U;
      box(cs, co, dk, 0.034 * U, 0.012 * U, 0.034 * U, C.stoneDark);
      box(cs, co, dk + 0.012 * U, 0.016 * U, 0.1 * U, 0.016 * U, C.craneWood);
      box(cs + 0.035 * U, co, dk + 0.1 * U, 0.12 * U, 0.012 * U, 0.012 * U, C.craneWood);
      box(cs - 0.022 * U, co, dk + 0.085 * U, 0.03 * U, 0.03 * U, 0.024 * U, C.iron);        // counterweight
      box(cs + 0.088 * U, co, dk + 0.05 * U, 0.003 * U, 0.05 * U, 0.003 * U, C.iron);        // hook line
      box(cs + 0.088 * U, co, dk + 0.036 * U, 0.016 * U, 0.014 * U, 0.016 * U, pick(C.crate, 3));
      crates(e - 0.04 * U, 0.07 * U, 5, 20);
      crates(e - 0.04 * U, -0.15 * U, 4, 40);
      cone(yard + 0.03 * U, -0.03 * U, dk, 0.05 * U, 0.022 * U, C.funnel);                    // coal heap
      flag(e - 0.045 * U, -0.035 * U, dk, 0.14 * U);
      boat(e1 - 0.15 * U, m1 - 0.085 * U, 0, 1.15);
      boat(e1 - 0.22 * U, m1 + 0.085 * U, 1, 1);
      if (PORT_BOATS.middle > 2) boat(e2 - 0.09 * U, m2 + 0.07 * U, 2, 0.85);
    } else if (era === 'modern') {
      // A container terminal: a concrete wharf, stacks in rows, two gantry cranes, a ship along the quay.
      slab(back, face, 0, 2 * QH, C.concrete);
      box(face - 0.006 * U, 0, dk, 0.006 * U, 0.0005, 2 * QH, C.stripe);
      box(e - 0.05 * U, 0, dk, 0.004 * U, 0.0004, 2 * QH, C.stripe);
      for (let o = -QH + 0.03 * U; o < QH; o += 0.09 * U) cyl(face - 0.016 * U, o, dk, 0.012 * U, 0.01 * U, C.iron);
      // container stacks, long side along the shore
      const ch = 0.017 * U;
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
        const sv = back + 0.03 * U + row * 0.034 * U, o = -QH + 0.04 * U + i * 0.064 * U;
        if (!free(sv, o, 0.02 * U)) continue;
        const hgt = 1 + Math.floor(H(row * 17 + i * 5) * 3.4);
        for (let l = 0; l < Math.min(4, hgt); l++) box(sv, o, dk + l * ch, 0.024 * U, ch, 0.058 * U, pick(C.containers, row * 31 + i * 7 + l * 3));
      }
      // the shed: grey panels, a flat roof and a band in the nation's colour
      const ws = yard - 0.02 * U, wo = QH - 0.085 * U;
      if (free(ws, wo, 0.06 * U)) {
        box(ws, wo, dk, 0.1 * U, 0.05 * U, 0.13 * U, C.craneGrey);
        box(ws, wo, dk + 0.034 * U, 0.102 * U, 0.01 * U, 0.132 * U, team);
        box(ws, wo, dk + 0.05 * U, 0.106 * U, 0.006 * U, 0.136 * U, team);
        box(ws + 0.05 * U, wo, dk, 0.003 * U, 0.03 * U, 0.04 * U, C.iron);
        flag(ws - 0.03 * U, wo + 0.04 * U, dk + 0.056 * U, 0.07 * U);
      }
      const gantry = (o: number): void => {
        const h = 0.12 * U, t = 0.011 * U;
        for (const ds of [face - 0.07 * U, face - 0.012 * U]) for (const sd of [-1, 1]) box(ds, o + sd * 0.03 * U, dk, t, h, t, C.craneRed);
        for (const ds of [face - 0.07 * U, face - 0.012 * U]) box(ds, o, dk + h * 0.55, t * 0.8, t * 0.8, 0.06 * U, C.craneRed);
        box(face + 0.025 * U, o, dk + h, 0.24 * U, t * 1.3, 0.016 * U, C.craneRed);           // boom out over the ship
        box(face - 0.04 * U, o, dk + h + t * 1.3, 0.05 * U, 0.02 * U, 0.03 * U, C.craneGrey); // machine house
        box(face - 0.04 * U, o, dk + h + t * 1.3 + 0.02 * U, t, 0.035 * U, t, C.craneRed);    // mast
        box(face + 0.06 * U, o, dk + h - 0.012 * U, 0.02 * U, 0.012 * U, 0.022 * U, C.iron);  // trolley
        box(face + 0.06 * U, o, dk + h - 0.05 * U, 0.002 * U, 0.04 * U, 0.002 * U, C.iron);
        box(face + 0.06 * U, o, dk + h - 0.062 * U, 0.022 * U, ch * 0.8, 0.05 * U, pick(C.containers, Math.round(o * 1000)));
      };
      gantry(-0.13 * U);
      gantry(0.02 * U);
      // a finger pier at the far end, with a light mast
      const m2 = QH - 0.03 * U, e2 = e + 0.34 * U;
      slab(face - 0.005 * U, e2, m2, 0.06 * U, C.concrete, pk);
      for (const sd of [-1, 1]) box((face + e2) / 2, m2 + sd * 0.027 * U, pk, e2 - face, 0.0005, 0.005 * U, C.stripe);
      cyl(e2 - 0.02 * U, m2, pk, 0.012 * U, 0.1 * U, C.iron);
      box(e2 - 0.02 * U, m2, pk + 0.1 * U, 0.03 * U, 0.008 * U, 0.03 * U, C.lamp);
      boat(face + 0.06 * U, -0.06 * U, 0, 1, Math.PI / 2);
      if (PORT_BOATS.modern > 1) boat(e2 - 0.1 * U, m2 - 0.07 * U, 1, 0.5);
    } else {
      // A floating terminal: a pale deck with a glowing rim, a control tower, walkways on pontoon pads.
      slab(back, face, 0, 2 * QH, C.floatWalk);
      box(face - 0.004 * U, 0, dk, 0.008 * U, 0.0006, 2 * QH, C.floatRing);
      box(back + 0.004 * U, 0, dk, 0.008 * U, 0.0006, 2 * QH, C.floatRing);
      if (free(yard, 0.1 * U, 0.05 * U)) {
        cyl(yard, 0.1 * U, dk, 0.09 * U, 0.03 * U, C.floatHull);
        cyl(yard, 0.1 * U, dk + 0.03 * U, 0.094 * U, 0.008 * U, team);
        cyl(yard, 0.1 * U, dk + 0.038 * U, 0.05 * U, 0.07 * U, C.floatPad);
        cyl(yard, 0.1 * U, dk + 0.108 * U, 0.075 * U, 0.012 * U, team);
        cone(yard, 0.1 * U, dk + 0.12 * U, 0.07 * U, 0.03 * U, C.floatRing);
      }
      if (free(yard, -0.1 * U, 0.05 * U)) {
        box(yard, -0.1 * U, dk, 0.07 * U, 0.035 * U, 0.14 * U, C.floatHull);
        box(yard, -0.1 * U, dk + 0.035 * U, 0.074 * U, 0.008 * U, 0.144 * U, team);
        box(yard + 0.035 * U, -0.1 * U, dk + 0.012 * U, 0.003 * U, 0.008 * U, 0.12 * U, C.floatRing);
      }
      const m1 = -0.06 * U, e1 = e + 0.46 * U, m2 = 0.14 * U, e2 = e + 0.26 * U;
      for (const [oc, s1] of [[m1, e1], [m2, e2]] as const) {
        box((face + s1) / 2, oc, pk - 0.0012, s1 - face, 0.0012, 0.05 * U, C.floatWalk);
        floatPads(face + 0.08 * U, s1 - 0.04 * U, oc, pk);
      }
      cyl(e1 - 0.02 * U, m1, pk, 0.016 * U, 0.12 * U, C.floatDark);
      cone(e1 - 0.02 * U, m1, pk + 0.12 * U, 0.036 * U, 0.026 * U, C.floatRing);
      boat(e1 - 0.2 * U, m1 - 0.2 * U, 0, 1.1);
      boat(e2 - 0.06 * U, m2 + 0.2 * U, 1, 0.9);
      if (PORT_BOATS.future > 2) boat(e1 + 0.02 * U, m1 + 0.2 * U, 2, 0.8);
    }
  }
}
