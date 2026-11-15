// Lane b: one procedural harbour on a coast tile. Pure: the same structure id, era and free space give the
// same harbour. A pier runs from the shore toward the neighbouring ocean tile; everything is instanced
// boxes, cylinders and cones (three part buffers), laid out along the pier axis (s) and across it (o).
import * as THREE from 'three';
import type { Structure, World } from '@terra/shared';
import { LAND_BASE, SEA_LEVEL } from '../../constants';
import { hash01 } from '../placement';
import type { TileGeo } from '../placement';
import { feetExcept, inFeet } from '../occupancy';
import type { Foot } from '../occupancy';
import { PartBuf } from '../../towns/buildTown';
import { PORT_BOATS, PORT_COLORS as C } from './portStyle';
import type { PortEra } from './portStyle';

export interface PortParts {
  boxes: PartBuf;  // unit box, base at y = 0
  cyls: PartBuf;   // unit cylinder (diameter 1, height 1), base at y = 0
  cones: PartBuf;  // unit cone (diameter 1, height 1), base at y = 0
  foot: Foot | null; // the land end of the pier, kept clear of houses
}

const DECK = LAND_BASE + 0.0013;   // top of a pier deck
const WATER = SEA_LEVEL;

const _p = new THREE.Vector3(), _up = new THREE.Vector3(), _fx = new THREE.Vector3(), _fz = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _c = new THREE.Color(), _d = new THREE.Vector3();

/** The pier direction toward an ocean neighbour, in the tile's tangent plane, and the distance to the shore. */
export function pierAxis(world: World, g: TileGeo, ocean: number, out: THREE.Vector3): number {
  const nc = world.tiles[ocean]!.center;
  _d.set(nc[0], nc[1], nc[2]).normalize().sub(g.n);
  const e = _d.length() * 0.5 * g.h;
  out.copy(_d).addScaledVector(g.n, -_d.dot(g.n)).normalize();
  return e;
}

/** Pick the ocean neighbour a harbour faces (seeded by the structure id), or -1 on an inland tile. */
export function oceanNeighbour(world: World, tile: number, id: string): number {
  const oc = world.tiles[tile]?.neighbors.filter((n) => world.tiles[n]?.terrain === 'ocean').sort((a, b) => a - b) ?? [];
  return oc.length ? oc[Math.floor(hash01(id, 71) * oc.length) % oc.length]! : -1;
}

/** A short signature of the space other structures hold on the tile (part of the rebuild key). */
export function spaceSig(tile: number, id: string): string {
  let s = '';
  for (const f of feetExcept(tile, id)) s += `${f.a.toFixed(4)},${f.b.toFixed(4)},${f.half.toFixed(4)};`;
  return s;
}

export function buildPort(world: World, s: Structure, g: TileGeo, ocean: number, era: PortEra, small: boolean, footId: string): PortParts {
  const out: PortParts = { boxes: new PartBuf(), cyls: new PartBuf(), cones: new PartBuf(), foot: null };
  const dir = new THREE.Vector3();
  const e = pierAxis(world, g, ocean, dir);
  const side = new THREE.Vector3().crossVectors(dir, g.n);
  const U = 2 * e;
  const H = (k: number): number => hash01(`${s.id}:${k}`, 73);
  const feet = feetExcept(s.tile, footId);
  const a1 = dir.dot(g.t1), a2 = dir.dot(g.t2), b1 = side.dot(g.t1), b2 = side.dot(g.t2);
  const taken = (sv: number, o: number, m: number): boolean => feet.length > 0 && inFeet(feet, a1 * sv + b1 * o, a2 * sv + b2 * o, m);

  // The pier starts on land, as far back as the structures on the tile leave free, and ends in the water.
  let s0 = e - 0.32 * U;
  for (; s0 < e; s0 += 0.04 * U) if (!taken(s0, 0, 0.03 * U) && !taken(s0, 0.06 * U, 0.02 * U) && !taken(s0, -0.06 * U, 0.02 * U)) break;
  s0 = Math.min(s0, e);
  const reach = (small ? 0.3 : 0.5) * U * (era === 'future' ? 1.1 : 1);
  const s1 = e + reach;
  const len = s1 - s0;
  const half = 0.075 * U;
  out.foot = { a: a1 * (s0 + 0.04 * U), b: a2 * (s0 + 0.04 * U), half, ax: a1, ay: a2 };

  // Place a unit part at (s along the pier, o across it, r radius) turned by `yaw` about the surface normal.
  const put = (buf: PartBuf, sv: number, o: number, r: number, yaw: number, sx: number, sy: number, sz: number, col: string): void => {
    _p.copy(g.n).multiplyScalar(g.h).addScaledVector(dir, sv).addScaledVector(side, o).normalize();
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

  // ---- boats ----------------------------------------------------------------------------------------
  const boat = (sv: number, o: number, k: number, big: number): void => {
    const r0 = WATER + 0.0004;
    const hl = (era === 'modern' ? 0.34 : era === 'future' ? 0.26 : 0.17) * U * big, hw = hl * (era === 'modern' ? 0.2 : 0.3);
    if (era === 'early') {
      const hull = pick(C.hullWood, k);
      box(sv, o, r0, hl, 0.0014, hw, hull);
      box(sv + hl * 0.5, o, r0 + 0.0007, hl * 0.18, 0.0012, hw * 0.6, hull);        // raised stem
      cyl(sv, o, r0 + 0.0014, 0.012 * U, 0.026 * U * big, C.pile);                  // mast
      box(sv - 0.004 * U, o, r0 + 0.0022, 0.004 * U, 0.02 * U * big, hw * 1.15, C.sail); // sail across the boat
    } else if (era === 'middle') {
      const hull = H(k) < 0.5 ? C.hullDark : C.hullRed;
      box(sv, o, r0, hl, 0.0016, hw, hull);
      box(sv - hl * 0.3, o, r0 + 0.0016, hl * 0.28, 0.0016, hw * 0.8, C.hullWood[0]);
      cyl(sv + hl * 0.15, o, r0 + 0.0016, 0.012 * U * big, 0.02 * U * big, C.funnel);
      cyl(sv + hl * 0.15, o, r0 + 0.0016 + 0.017 * U * big, 0.0125 * U * big, 0.004 * U * big, C.funnelBand);
    } else if (era === 'modern') {
      box(sv, o, r0, hl, 0.0017, hw, C.hullDark);
      box(sv - hl * 0.38, o, r0 + 0.0017, hl * 0.13, 0.0042, hw * 0.85, C.craneGrey);   // bridge
      for (let i = 0; i < 6; i++) {
        const row = i < 3 ? 1 : -1, col = i % 3;
        box(sv - hl * 0.12 + col * hl * 0.16, o + row * hw * 0.22, r0 + 0.0017, hl * 0.14, 0.0017 + (i % 2) * 0.0017, hw * 0.4, pick(C.containers, k * 7 + i));
      }
    } else {
      box(sv, o, r0, hl, 0.0012, hw, C.floatHull);
      box(sv, o, r0 + 0.0012, hl * 0.9, 0.0003, hw * 1.02, C.floatRing);
      cyl(sv - hl * 0.15, o, r0 + 0.0012, hw * 0.8, 0.0018, C.floatPad);
      cyl(sv - hl * 0.15, o, r0 + 0.003, hw * 0.45, 0.0006, C.floatRing);
    }
  };
  // Boats moor alongside, bows toward the open sea, a little apart from the pier.
  const moor = (n: number, gap: number): void => {
    const per = (era === 'modern' ? 0.4 : era === 'early' ? 0.22 : 0.26) * U;
    for (let i = 0; i < n; i++) {
      const sideSign = i % 2 === 0 ? 1 : -1;
      const sv = s1 - 0.14 * U - Math.floor(i / 2) * per;
      if (sv - per * 0.5 < e - 0.05 * U) break;
      boat(sv, sideSign * gap, i, i === 0 && !small ? 1.15 : 1);
    }
  };

  if (era === 'early') {
    // A wooden jetty: planks on two rows of piles, a T-head at the end, a lighthouse on a port's.
    const pw = 0.05 * U;
    const seg = 0.1 * U;
    for (let a = s0, i = 0; a < s1; a += seg, i++) box(a + seg / 2, 0, DECK - 0.0007, Math.min(seg, s1 - a) * 0.97, 0.0009, pw, pick(C.plank, i * 3 + 1));
    for (let a = s0 + 0.08 * U; a < s1; a += 0.14 * U) for (const sd of [-1, 1]) cyl(a, sd * pw * 0.48, WATER - 0.002, 0.009 * U, DECK - WATER + 0.0024, C.pile);
    if (!small) {
      box(s1 - 0.025 * U, 0, DECK - 0.0007, 0.06 * U, 0.0009, 0.16 * U, C.plank[1]);
      for (const sd of [-1, 1]) cyl(s1 - 0.025 * U, sd * 0.07 * U, WATER - 0.002, 0.009 * U, DECK - WATER + 0.0024, C.pile);
      const lo = -0.0;
      cyl(s1 - 0.025 * U, lo, DECK, 0.06 * U, 0.05 * U, C.lightWhite);
      cyl(s1 - 0.025 * U, lo, DECK + 0.05 * U, 0.048 * U, 0.035 * U, C.lightRed);
      cyl(s1 - 0.025 * U, lo, DECK + 0.085 * U, 0.04 * U, 0.04 * U, C.lightWhite);
      cyl(s1 - 0.025 * U, lo, DECK + 0.125 * U, 0.034 * U, 0.016 * U, C.lamp);
      cone(s1 - 0.025 * U, lo, DECK + 0.141 * U, 0.048 * U, 0.03 * U, C.lightRed);
    }
    moor(small ? 1 : PORT_BOATS.early, pw / 2 + 0.05 * U);
  } else if (era === 'middle') {
    // A stone quay with a coping and bollards, a timber crane and a shed on a port's; ships alongside.
    const qw = (small ? 0.08 : 0.12) * U;
    box((s0 + s1) / 2, 0, WATER - 0.001, len, DECK - WATER + 0.0004, qw, C.stone);
    for (const sd of [-1, 1]) box((s0 + s1) / 2, sd * (qw / 2 - 0.006 * U), DECK + 0.0003, len, 0.0006, 0.012 * U, C.coping);
    for (let a = s0 + 0.1 * U; a < s1 - 0.03 * U; a += 0.16 * U) for (const sd of [-1, 1]) cyl(a, sd * (qw / 2 - 0.016 * U), DECK + 0.0004, 0.008 * U, 0.0014, C.iron);
    box(s1 - 0.01 * U, 0, DECK + 0.0003, 0.02 * U, 0.0008, qw * 1.12, C.stoneDark);
    if (!small) {
      const cs = e + 0.12 * U;
      box(cs, 0, DECK + 0.0003, 0.018 * U, 0.06 * U, 0.018 * U, C.craneWood);                    // post
      box(cs, qw * 0.28, DECK + 0.0003 + 0.05 * U, 0.016 * U, 0.012 * U, qw * 0.8, C.craneWood, 0); // jib over the berth
      box(cs, qw * 0.7, DECK + 0.0003 + 0.034 * U, 0.004 * U, 0.02 * U, 0.004 * U, C.iron);       // hook line
      if (!taken(s0 + 0.06 * U, qw / 2 + 0.07 * U, 0.05 * U)) {
        box(s0 + 0.06 * U, qw / 2 + 0.07 * U, DECK - 0.0003, 0.1 * U, 0.018 * U, 0.07 * U, C.shed);
        box(s0 + 0.06 * U, qw / 2 + 0.07 * U, DECK + 0.018 * U - 0.0003, 0.11 * U, 0.008 * U, 0.08 * U, C.shedRoof);
      }
    }
    moor(small ? 1 : PORT_BOATS.middle, qw / 2 + 0.05 * U);
  } else if (era === 'modern') {
    // A concrete wharf: stacked containers, a gantry crane over the berth, a container ship alongside.
    const qw = (small ? 0.1 : 0.17) * U;
    box((s0 + s1) / 2, 0, WATER - 0.001, len, DECK - WATER + 0.0004, qw, C.concrete);
    for (const sd of [-1, 1]) box((s0 + s1) / 2, sd * (qw / 2 - 0.003 * U), DECK + 0.0003, len, 0.0003, 0.006 * U, C.stripe);
    for (let a = s0 + 0.12 * U; a < s1 - 0.05 * U; a += 0.2 * U) for (const sd of [-1, 1]) cyl(a, sd * (qw / 2 - 0.014 * U), DECK + 0.0004, 0.008 * U, 0.0012, C.iron);
    const stacks = small ? 1 : 3;
    for (let i = 0; i < stacks; i++) {
      const sv = e + 0.02 * U + i * 0.09 * U;
      for (const sd of [-1, 1]) {
        const hgt = 1 + Math.floor(H(i * 5 + (sd > 0 ? 1 : 2)) * 3);
        for (let l = 0; l < hgt; l++) box(sv, sd * qw * 0.2, DECK + 0.0003 + l * 0.0017, 0.075 * U, 0.0017, 0.05 * U, pick(C.containers, i * 11 + l * 3 + (sd > 0 ? 1 : 2)));
      }
    }
    if (!small) {
      const cs = s1 - 0.2 * U;
      for (const sd of [-1, 1]) for (const dd of [-1, 1]) box(cs + dd * 0.05 * U, sd * qw * 0.46, DECK + 0.0003, 0.008 * U, 0.09 * U, 0.008 * U, C.craneRed); // legs
      box(cs, qw * 0.46 + 0.0, DECK + 0.0003 + 0.09 * U, 0.12 * U, 0.008 * U, 0.01 * U, C.craneRed);                  // backstay on the quay side
      box(cs, qw * 0.5 + 0.08 * U, DECK + 0.0003 + 0.09 * U, 0.014 * U, 0.008 * U, qw + 0.2 * U, C.craneRed);        // boom out over the ship
      box(cs, qw * 0.18, DECK + 0.0003 + 0.082 * U, 0.02 * U, 0.008 * U, 0.02 * U, C.iron);                            // trolley
    }
    moor(small ? 1 : PORT_BOATS.modern, qw / 2 + 0.07 * U);
  } else {
    // A floating dock: a pale walkway on pontoon pads with glowing rims, a mast, sleek ships alongside.
    const ww = 0.05 * U;
    box((s0 + s1) / 2, 0, DECK - 0.0007, len, 0.0009, ww, C.floatWalk);
    let i = 0;
    for (let a = s0 + 0.1 * U; a < s1 - 0.04 * U; a += 0.17 * U, i++) {
      const sd = i % 2 === 0 ? 1 : -1;
      box(a, sd * 0.07 * U, DECK - 0.0005, 0.03 * U, 0.0005, 0.05 * U, C.floatWalk);   // gangway
      cyl(a, sd * 0.12 * U, DECK - 0.0007, 0.1 * U, 0.0009, C.floatPad);
      cyl(a, sd * 0.12 * U, DECK + 0.0002, 0.08 * U, 0.0003, C.floatRing);
      cyl(a, sd * 0.12 * U, WATER - 0.0006, 0.07 * U, DECK - WATER - 0.0006, C.floatDark);     // hull below
    }
    cyl(s1 - 0.02 * U, 0, DECK, 0.014 * U, 0.09 * U, C.floatDark);
    cone(s1 - 0.02 * U, 0, DECK + 0.09 * U, 0.03 * U, 0.02 * U, C.floatRing);
    moor(small ? 1 : PORT_BOATS.future, 0.24 * U);
  }
  return out;
}
