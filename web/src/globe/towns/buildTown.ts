// Lane b: one procedural close-up town on a settlement tile. Pure: the same structure id gives the same town.
// Everything is laid out in the tile's tangent plane (a seeded, rotated street grid), then dropped onto the
// tile's flat top fan so nothing floats above it.
import * as THREE from 'three';
import type { BuildingStyle, Structure, World } from '@terra/shared';
import { hash01 } from '../structures/placement';
import type { TileGeo } from '../structures/placement';
import { nationIdentity } from '../identity/identity';
import { wallTint } from '../identity/look';
import * as S from './style';

/** World-space instances of one kind: 10 floats each (pos 3, quat 4, scale 3) and an RGB colour. */
export class PartBuf {
  tr: number[] = [];
  col: number[] = [];
  get count(): number { return this.col.length / 3; }
  add(p: THREE.Vector3, q: THREE.Quaternion, sx: number, sy: number, sz: number, c: THREE.Color): void {
    this.tr.push(p.x, p.y, p.z, q.x, q.y, q.z, q.w, sx, sy, sz);
    this.col.push(c.r, c.g, c.b);
  }
}

export interface RiverSample { p: THREE.Vector3; side: THREE.Vector3; half: number; alpha: number }

export interface TownParts {
  houses: PartBuf;   // gabled houses (roof colour per instance)
  walls: PartBuf;    // wall segments
  towers: PartBuf;   // round towers
  flats: PartBuf;    // courtyards, parks, ring road, bridge planks
  grounds: PartBuf;  // the pale street ground under the town
  river: RiverSample[] | null;
  walled: boolean;
}

export const TOWN_KINDS = new Set(['town', 'city', 'capital']);
const REL: Record<string, number> = { town: 0.75, city: 0.9, capital: 1.0 };

/** Walls while the nation is pre-industrial: its tech age if the world tracks one, else the world era. */
export function wantsWalls(world: World, s: Structure): boolean {
  if (s.kind === 'town') return false;
  const age = world.countries[s.owner]?.techAge;
  if (age) return age === 'ancient' || age === 'medieval' || age === 'gunpowder';
  return nationIdentity(world, s.owner).eraIndex < 4;
}

export function styleOf(world: World, owner: number): BuildingStyle {
  return world.countries[owner]?.buildingStyle ?? 'medieval';
}

/** What a town's look depends on; a change rebuilds it. */
export function townKey(world: World, s: Structure): string {
  return `${s.kind}|${s.owner}|${wantsWalls(world, s) ? 1 : 0}|${styleOf(world, s.owner)}`;
}

const tmpM = new THREE.Matrix4();
const tmpZ = new THREE.Vector3();
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function buildTown(world: World, s: Structure, g: TileGeo, walled: boolean): TownParts {
  const id = s.id;
  const w = g.width, h = g.h;
  const kind = s.kind;
  const H = (salt: number, extra = 0): number => hash01(`${id}:${extra}`, salt);

  // Grid axes in the tangent plane.
  const theta = H(1) * Math.PI * 0.5;
  const gx = g.t1.clone().multiplyScalar(Math.cos(theta)).addScaledVector(g.t2, Math.sin(theta));
  const gy = g.t1.clone().multiplyScalar(-Math.sin(theta)).addScaledVector(g.t2, Math.cos(theta));
  const sag = (0.86 * w) / (2 * h); // the top fan sinks below the tangent plane by d * sag

  const toWorld = (x: number, y: number, lift: number, out: THREE.Vector3): THREE.Vector3 => {
    const d = Math.hypot(x, y);
    return out.copy(g.n).multiplyScalar(h - d * sag + lift).addScaledVector(gx, x).addScaledVector(gy, y);
  };
  // Orientation: local x along grid angle phi, local y along the sunken fan's surface normal at (x, y).
  const up = new THREE.Vector3();
  const quatAt = (phi: number, x: number, y: number, out: THREE.Quaternion): THREE.Quaternion => {
    const d = Math.hypot(x, y);
    up.copy(g.n);
    if (d > 1e-9) up.addScaledVector(gx, (sag * x) / d).addScaledVector(gy, (sag * y) / d).normalize();
    const dir = gx.clone().multiplyScalar(Math.cos(phi)).addScaledVector(gy, Math.sin(phi));
    dir.addScaledVector(up, -dir.dot(up)).normalize();
    tmpZ.crossVectors(dir, up);
    tmpM.makeBasis(dir, up, tmpZ);
    return out.setFromRotationMatrix(tmpM);
  };

  // Footprint: a wobbly oval in grid coordinates.
  const R = (S.KIND_R[kind] ?? 0.45) * w;
  const ecc = H(2) * 0.12;
  const Rx = R * (1 + ecc), Ry = R * (1 - ecc);
  const ps1 = H(3) * 6.28, ps2 = H(4) * 6.28;
  const wob = (phi: number): number => 1 + 0.05 * Math.sin(3 * phi + ps1) + 0.03 * Math.sin(5 * phi + ps2);
  const inside = (x: number, y: number, k = 1): boolean => {
    const nx = x / Rx, ny = y / Ry;
    const wv = wob(Math.atan2(ny, nx)) * k;
    return nx * nx + ny * ny < wv * wv;
  };

  // Clear plaza at the centre for the landmark model.
  const landmark = Math.min(w * (REL[kind] ?? 0.8) * 0.95, 0.07 * h);
  const plazaR = Math.max(0.18, Math.min(0.3, (0.4 * landmark) / w)) * w;

  const out: TownParts = {
    houses: new PartBuf(), walls: new PartBuf(), towers: new PartBuf(), flats: new PartBuf(), grounds: new PartBuf(),
    river: null, walled,
  };
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();

  // ---- river -----------------------------------------------------------------------------------
  const tile = world.tiles[s.tile]!;
  let oceanNb = -1;
  for (const nb of tile.neighbors) if (world.tiles[nb]?.terrain === 'ocean') { oceanNb = nb; break; }
  const coastal = tile.terrain === 'coast' || oceanNb >= 0;
  const hasRiver = kind !== 'town' && (coastal || H(5) < 0.45);
  const halfW = 0.045 * w;
  let alpha = H(6) * Math.PI * 2;
  if (oceanNb >= 0) {
    const nc = new THREE.Vector3(...world.tiles[oceanNb]!.center).normalize();
    alpha = Math.atan2(nc.dot(gy), nc.dot(gx));
  }
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const Lin = 0.7 * w, Lout = oceanNb >= 0 ? 0.92 * w : 0.7 * w;
  const swing = (H(7) < 0.5 ? -1 : 1) * (plazaR + 0.1 * w);
  const mPh = H(8) * 6.28;
  const riverV = (u: number): number => {
    const L = u < 0 ? Lin : Lout;
    const bell = Math.max(0, 1 - (u / L) * (u / L));
    return swing * bell + 0.05 * w * Math.sin((u / w) * 10 + mPh) * bell;
  };
  const nearRiver = (x: number, y: number, margin: number): boolean => {
    if (!hasRiver) return false;
    const u = x * ca + y * sa, v = -x * sa + y * ca;
    if (u < -Lin || u > Lout) return false;
    return Math.abs(v - riverV(u)) < halfW + margin;
  };
  const riverPts: Array<[number, number]> = [];
  if (hasRiver) {
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const u = -Lin + ((Lin + Lout) * i) / N;
      const v = riverV(u);
      riverPts.push([u * ca - v * sa, u * sa + v * ca]);
    }
    const samples: RiverSample[] = [];
    for (let i = 0; i <= N; i++) {
      const [x, y] = riverPts[i]!;
      const pos = toWorld(x, y, 0.00038, new THREE.Vector3());
      const a = riverPts[Math.max(0, i - 1)]!, b = riverPts[Math.min(N, i + 1)]!;
      const tan = gx.clone().multiplyScalar(b[0] - a[0]).addScaledVector(gy, b[1] - a[1]).normalize();
      const side = new THREE.Vector3().crossVectors(g.n, tan).normalize();
      const t = i / N;
      const mouth = oceanNb >= 0 ? 1 + 0.7 * smooth(0.8, 1, t) : 1;
      const fade = smooth(0, 0.1, t) * (oceanNb >= 0 ? 1 : smooth(1, 0.9, t));
      samples.push({ p: pos, side, half: halfW * mouth, alpha: fade });
    }
    out.river = samples;
  }

  // ---- street grid: houses, courtyards, parks ------------------------------------------------
  const roofs = S.ROOFS[styleOf(world, s.owner)] ?? S.ROOFS.medieval;
  const style = styleOf(world, s.owner);
  const tint = wallTint(nationIdentity(world, s.owner), s.owner);
  const roofCols = roofs.map((r) => new THREE.Color(r).multiply(tint));
  const heightK = S.HEIGHT_K[style] ?? 1;
  const target = S.KIND_N[kind] ?? 40;
  const area = Math.PI * Rx * Ry - Math.PI * plazaR * plazaR;
  const pitch = Math.sqrt((area * (8.5 / 16)) / target);
  const o1 = H(9), o2 = H(10);
  const K = Math.ceil((Math.max(Rx, Ry) * 1.1) / pitch) + 2;
  const mod4 = (i: number): number => ((i % 4) + 4) % 4;
  const green = new THREE.Color(S.COURTYARD), park = new THREE.Color(S.PARK);

  type Slot = { x: number; y: number; i: number; j: number; yard: 0 | 1 | 2 };
  const slots: Slot[] = [];
  let houseCount = 0;
  for (let i = -K; i <= K; i++) {
    if (mod4(i) === 0) continue; // street
    for (let j = -K; j <= K; j++) {
      if (mod4(j) === 0) continue;
      const x = (i + o1) * pitch, y = (j + o2) * pitch;
      if (!inside(x, y) || Math.hypot(x, y) < plazaR) continue;
      if (nearRiver(x, y, pitch * 0.55)) continue;
      const bi = Math.floor(i / 4), bj = Math.floor(j / 4);
      let yard: 0 | 1 | 2 = 0;
      if (hash01(`${id}:${bi}:${bj}`, 11) < 0.06) yard = 2;
      else if (mod4(i) === 2 && mod4(j) === 2 && hash01(`${id}:${bi}:${bj}`, 12) < 0.55) yard = 1;
      slots.push({ x, y, i, j, yard });
      if (!yard) houseCount++;
    }
  }
  const keep = Math.min(1, (target * 1.05) / Math.max(1, houseCount));
  for (const sl of slots) {
    const k = `${sl.i}:${sl.j}`;
    if (sl.yard) {
      toWorld(sl.x, sl.y, 0.00012, p);
      quatAt(0, sl.x, sl.y, q);
      const sz = pitch * (sl.yard === 2 ? 1.02 : 0.86);
      out.flats.add(p, q, sz, 0.0002, sz, sl.yard === 2 ? park : green);
      continue;
    }
    if (hash01(`${id}:${k}`, 13) > keep) continue;
    const jx = (hash01(`${id}:${k}`, 14) - 0.5) * 0.12 * pitch, jy = (hash01(`${id}:${k}`, 15) - 0.5) * 0.12 * pitch;
    toWorld(sl.x + jx, sl.y + jy, 0, p);
    quatAt((hash01(`${id}:${k}`, 16) - 0.5) * 0.12, sl.x, sl.y, q);
    const fp = pitch * 0.8 * (0.85 + 0.15 * hash01(`${id}:${k}`, 17));
    const hh = pitch * (0.55 + 0.35 * hash01(`${id}:${k}`, 18)) * heightK;
    c.copy(roofCols[Math.floor(hash01(`${id}:${k}`, 19) * roofCols.length)]!);
    out.houses.add(p, q, fp, hh, fp * (0.8 + 0.2 * hash01(`${id}:${k}`, 20)), c);
  }

  // ---- bridges where a street crosses the river -------------------------------------------------
  if (hasRiver) {
    const bridge = new THREE.Color(S.BRIDGE);
    for (const axis of [0, 1] as const) {
      for (let i = -K; i <= K; i++) {
        if (mod4(i) !== 0) continue;
        const line = (i + (axis === 0 ? o1 : o2)) * pitch;
        for (let k = 0; k + 1 < riverPts.length; k++) {
          const a = riverPts[k]!, b = riverPts[k + 1]!;
          const da = a[axis] - line, db = b[axis] - line;
          if (da === 0 || Math.sign(da) === Math.sign(db)) continue;
          const t = da / (da - db);
          const ox = 1 - axis; // the other coordinate
          const along = a[ox] + (b[ox] - a[ox]) * t;
          const x = axis === 0 ? line : along, y = axis === 0 ? along : line;
          if (!inside(x, y) || Math.hypot(x, y) < plazaR) continue;
          const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
          const sinA = Math.abs((axis === 0 ? dx : dy) / dl);
          const len = Math.min(5 * halfW, (2.8 * halfW) / Math.max(0.45, sinA));
          toWorld(x, y, 0.00042, p);
          quatAt(axis === 0 ? Math.PI / 2 : 0, x, y, q);
          out.flats.add(p, q, len, 0.00025, pitch * 0.7, bridge);
        }
      }
    }
  }

  // ---- walls with towers and gates, or a ring road --------------------------------------------
  const wallF = Math.min(1.07, (0.74 * w) / (Math.max(Rx, Ry) * 1.08));
  const ringPt = (phi: number, f: number): [number, number] => {
    const r = wob(phi) * f;
    return [Rx * r * Math.cos(phi), Ry * r * Math.sin(phi)];
  };
  if (kind === 'city' || kind === 'capital') {
    const perim = Math.PI * (Rx + Ry) * wallF;
    const M = Math.max(24, Math.round(perim / (0.06 * w)));
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < M; k++) pts.push(ringPt((k / M) * Math.PI * 2, walled ? wallF : wallF * 0.99));
    if (walled) {
      const wall = new THREE.Color(S.WALL), tower = new THREE.Color(S.TOWER);
      const gateN = kind === 'capital' ? 2 : 1 + (H(21) < 0.4 ? 1 : 0);
      const gates = new Set<number>();
      const g0 = Math.floor(H(22) * M);
      for (let k = 0; k < gateN; k++) gates.add((g0 + Math.round((k * M) / gateN)) % M);
      const skip: boolean[] = [];
      for (let k = 0; k < M; k++) {
        const a = pts[k]!, b = pts[(k + 1) % M]!;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        skip.push(gates.has(k) || nearRiver(mx, my, halfW * 0.4));
      }
      const wallH = 0.045 * w, wallT = 0.022 * w, towR = 0.03 * w, towH = 0.075 * w;
      const step = Math.max(3, Math.round(M / (kind === 'capital' ? 12 : 9)));
      for (let k = 0; k < M; k++) {
        const a = pts[k]!, b = pts[(k + 1) % M]!;
        if (!skip[k]) {
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          toWorld(mx, my, 0, p);
          quatAt(Math.atan2(b[1] - a[1], b[0] - a[0]), mx, my, q);
          out.walls.add(p, q, Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.06, wallH, wallT, wall);
        }
        // A tower at regular steps and on both sides of every gap.
        const prevSkip = skip[(k - 1 + M) % M]!;
        if (k % step === 0 || skip[k] !== prevSkip) {
          toWorld(a[0], a[1], 0, p);
          quatAt(0, a[0], a[1], q);
          out.towers.add(p, q, towR * 2, towH, towR * 2, tower);
        }
      }
    } else {
      // Industrial and later: no walls, a ring road around the town instead.
      const road = new THREE.Color(S.RING_ROAD);
      for (let k = 0; k < M; k++) {
        const a = pts[k]!, b = pts[(k + 1) % M]!;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (nearRiver(mx, my, 0)) continue;
        toWorld(mx, my, 0.00015, p);
        quatAt(Math.atan2(b[1] - a[1], b[0] - a[0]), mx, my, q);
        out.flats.add(p, q, Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.08, 0.0002, 0.03 * w, road);
      }
    }
  }

  // ---- ground: a shallow cone (unit radius, rim at y = -1) that follows the sunken fan --------------
  toWorld(0, 0, 0.00008, p);
  q.setFromRotationMatrix(tmpM.makeBasis(gx, g.n, tmpZ.crossVectors(gx, g.n)));
  const gk = kind === 'town' ? 1.1 : wallF + 0.05;
  out.grounds.add(p, q, Rx * gk, ((Rx + Ry) / 2) * gk * sag, Ry * gk, new THREE.Color(S.GROUND));
  return out;
}
