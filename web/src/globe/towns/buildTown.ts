// Lane b: one procedural close-up town on a settlement tile. Pure: the same structure id gives the same town.
// Everything is laid out in the tile's tangent plane (a seeded, rotated street grid), then dropped onto the
// tile's flat top fan so nothing floats above it.
import * as THREE from 'three';
import { cityTier } from '@terra/shared';
import type { BuildingStyle, CityTier, Structure, World } from '@terra/shared';
import { hash01 } from '../structures/placement';
import type { TileGeo } from '../structures/placement';
import { nationIdentity } from '../identity/identity';
import { wallTint } from '../identity/look';
import * as S from './style';
import { ageStyle } from './ageStyle';
import { feetOn, inFeet, occupancyVersion } from '../structures/occupancy';

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
  walls: PartBuf;    // plain boxes: square towers, gate blocks, pylons
  towers: PartBuf;   // round towers and palisade posts
  crens: PartBuf;    // stone wall segments with battlements
  stakes: PartBuf;   // palisade segments with pointed tops
  caps: PartBuf;     // the top fifth of a box: tower tops, gate lintels, gate pavilions
  roofs4: PartBuf;   // hip roofs for square towers (the top three tenths)
  roofsC: PartBuf;   // cone roofs for round towers (the top three tenths)
  shields: PartBuf;  // glowing energy-wall panels
  flats: PartBuf;    // courtyards, parks, ring road, bridge planks
  grounds: PartBuf;  // the pale street ground under the town
  river: RiverSample[] | null;
  tier: CityTier;
}

export const PART_NAMES = ['grounds', 'flats', 'houses', 'walls', 'towers', 'crens', 'stakes', 'caps', 'roofs4', 'roofsC', 'shields'] as const;
export type PartName = typeof PART_NAMES[number];
/** Parts that rise when a settlement's walls go up a tier. */
export const WALL_PARTS: ReadonlySet<PartName> = new Set(['walls', 'towers', 'crens', 'stakes', 'caps', 'roofs4', 'roofsC', 'shields']);

export const TOWN_KINDS = new Set(['town', 'city', 'capital']);
const REL: Record<string, number> = { town: 0.75, city: 0.9, capital: 1.0 };

/** The style the nation's towns are drawn in now: its own, then a modern one, then arcology as it moves through the ages. */
export function styleOf(world: World, owner: number): BuildingStyle {
  return ageStyle(world.countries[owner]);
}

/** Energy shields instead of masonry: arcology builders, and any nation in the future or stellar age. */
export function wantsShield(world: World, owner: number): boolean {
  const age = world.countries[owner]?.techAge;
  return styleOf(world, owner) === 'arcology' || age === 'future' || age === 'stellar';
}

/**
 * What a town's look depends on; a change rebuilds it. `tier` is its wall tier (cityTier in @terra/shared).
 * The part after '#' is the age look (style and shields): a change there alone is an age step, shown as a wave.
 */
export function townKey(world: World, s: Structure, tier: CityTier = cityTier(world, s.id)): string {
  return `${s.kind}|${s.owner}|${tier}|o${occupancyVersion(s.tile)}#${styleOf(world, s.owner)}|${wantsShield(world, s.owner) ? 1 : 0}`;
}
/** True when two town keys differ only in the age look. */
export function ageOnly(a: string, b: string): boolean {
  return a !== b && a.slice(0, a.indexOf('#')) === b.slice(0, b.indexOf('#'));
}

const tmpM = new THREE.Matrix4();
const tmpZ = new THREE.Vector3();
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function buildTown(world: World, s: Structure, g: TileGeo, tier: CityTier): TownParts {
  const id = s.id;
  const w = g.width, h = g.h;
  const kind = s.kind;
  const H = (salt: number, extra = 0): number => hash01(`${id}:${extra}`, salt);

  // Grid axes in the tangent plane.
  const theta = H(1) * Math.PI * 0.5;
  const gx = g.t1.clone().multiplyScalar(Math.cos(theta)).addScaledVector(g.t2, Math.sin(theta));
  const gy = g.t1.clone().multiplyScalar(-Math.sin(theta)).addScaledVector(g.t2, Math.cos(theta));
  const sag = (0.86 * w) / (2 * h); // the top fan sinks below the tangent plane by d * sag

  // The squares the structure layer fills on this tile (the landmark, the buildings round it, props): no house,
  // yard or wall goes inside one (structures/occupancy).
  const feet = feetOn(s.tile);
  const g11 = gx.dot(g.t1), g12 = gx.dot(g.t2), g21 = gy.dot(g.t1), g22 = gy.dot(g.t2);
  const taken = (x: number, y: number, m: number): boolean => feet.length > 0 && inFeet(feet, x * g11 + y * g21, x * g12 + y * g22, m);

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
    crens: new PartBuf(), stakes: new PartBuf(), caps: new PartBuf(), roofs4: new PartBuf(), roofsC: new PartBuf(), shields: new PartBuf(),
    river: null, tier,
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
  const style = styleOf(world, s.owner);
  const roofs = S.ROOFS[style] ?? S.ROOFS.medieval;
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

  // Wall plan (row A33): which rings this tier has. Tiers 1 and 2 are one ring round the footprint (a
  // palisade, then stone); from tier 3 the old centre gets its own ring inside, and the blocks in its way
  // are left out. (The centre ring only starts at tier 3 because the landmark model fills most of a small core.)
  const big = kind === 'city' || kind === 'capital';
  const wallF = Math.min(1.07, (0.74 * w) / (Math.max(Rx, Ry) * 1.08));
  const coreF = Math.min(wallF - 0.2, Math.max(0.62, (plazaR + 3 * pitch) / Math.min(Rx, Ry)));
  // Industrial and modern towns have outgrown their medieval walls (#345): no curtain walls or
  // gatehouses, a ring road round the town instead. Future and stellar towns get energy shields.
  const ageNow = world.countries[s.owner]?.techAge;
  const pastWalls = !wantsShield(world, s.owner) && (ageNow === 'industrial' || ageNow === 'modern');
  const wallTier: CityTier = pastWalls ? 0 : tier;
  const hasCore = big && wallTier >= 3;
  const dim = S.WALL_DIM;
  const coreDim = tier >= 4 ? dim.keep : dim.stone;
  const coreBand = (0.5 * pitch + 0.7 * coreDim.t * w) / Math.min(Rx, Ry);
  const onCoreWall = (x: number, y: number): boolean => {
    if (!hasCore) return false;
    const nx = x / Rx, ny = y / Ry;
    return Math.abs(Math.hypot(nx, ny) / wob(Math.atan2(ny, nx)) - coreF) < coreBand;
  };

  type Slot = { x: number; y: number; i: number; j: number; yard: 0 | 1 | 2 };
  const slots: Slot[] = [];
  let houseCount = 0;
  for (let i = -K; i <= K; i++) {
    if (mod4(i) === 0) continue; // street
    for (let j = -K; j <= K; j++) {
      if (mod4(j) === 0) continue;
      const x = (i + o1) * pitch, y = (j + o2) * pitch;
      if (!inside(x, y) || Math.hypot(x, y) < plazaR) continue;
      if (nearRiver(x, y, pitch * 0.55) || onCoreWall(x, y) || taken(x, y, pitch * 0.45)) continue;
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
          if (!inside(x, y) || Math.hypot(x, y) < plazaR || taken(x, y, pitch * 0.35)) continue;
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

  // ---- walls by tier (row A33), or a ring road ----------------------------------------------------
  const ringPt = (phi: number, f: number): [number, number] => {
    const r = wob(phi) * f;
    return [Rx * r * Math.cos(phi), Ry * r * Math.sin(phi)];
  };
  const TAU = Math.PI * 2;
  const shield = wantsShield(world, s.owner);
  const look = S.WALL_LOOK[style] ?? S.WALL_LOOK.medieval;
  const wash = tint.clone().lerp(new THREE.Color(1, 1, 1), 0.5);
  const col = (css: string): THREE.Color => new THREE.Color(css).multiply(wash);
  const stoneC = col(look.wall), towerC = col(look.tower), roofC = look.roof ? col(look.roof) : null;
  const woodC = col(S.PALISADE.wall), postC = col(S.PALISADE.post), doorC = new THREE.Color(S.GATE_DARK);
  const beamC = new THREE.Color(S.SHIELD.beam), pylonC = new THREE.Color(S.SHIELD.pylon), glowC = new THREE.Color(S.SHIELD.cap);
  type Mode = 'palisade' | 'stone' | 'shield';
  const p2 = new THREE.Vector3(), q2 = new THREE.Quaternion();

  /** One upright at (x, y): a palisade post, a stone tower in the nation's style, or a shield pylon. */
  const tower = (mode: Mode, x: number, y: number, ang: number, r: number, hgt: number): void => {
    if (taken(x, y, r)) return;
    toWorld(x, y, 0, p2);
    quatAt(ang, x, y, q2);
    if (mode === 'palisade') { out.towers.add(p2, q2, r * 2, hgt, r * 2, postC); return; }
    if (mode === 'shield') {
      out.walls.add(p2, q2, r * 1.1, hgt, r * 1.1, pylonC);
      out.caps.add(p2, q2, r * 1.7, hgt * 1.08, r * 1.7, glowC);
      return;
    }
    if (look.square) out.walls.add(p2, q2, r * 2, hgt, r * 2, towerC);
    else out.towers.add(p2, q2, r * 2, hgt, r * 2, towerC);
    if (roofC) {
      const eave = look.eave ?? 1.3;
      (look.square ? out.roofs4 : out.roofsC).add(p2, q2, r * 2 * eave, hgt / 0.7 * (look.square ? 1.0 : 1.08), r * 2 * eave, roofC);
    } else if (look.square) out.caps.add(p2, q2, r * 2.25, hgt * 1.05, r * 2.25, towerC);
    else out.towers.add(p2, q2, r * 2.3, hgt * 0.2, r * 2.3, towerC); // a wider foot instead of a cap for round, roofless towers
  };

  /** One straight run of wall from a to b. */
  const run = (mode: Mode, a: [number, number], b: [number, number], hgt: number, thick: number): void => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (taken(mx, my, thick)) return; // the wall meets a building and gives way to it
    toWorld(mx, my, 0, p2);
    quatAt(Math.atan2(b[1] - a[1], b[0] - a[0]), mx, my, q2);
    if (mode === 'palisade') out.stakes.add(p2, q2, len * 1.05, hgt, thick, woodC);
    else if (mode === 'stone') out.crens.add(p2, q2, len * 1.07, hgt, thick, stoneC);
    else out.shields.add(p2, q2, len * 1.02, hgt, thick * 0.35, beamC);
  };

  // Gates sit where the two main streets leave the ring; the first faces the road to the capital
  // (for a capital, the road to its nearest town).
  let roadPhi = H(22) * TAU;
  {
    const cap = world.countries[s.owner]?.capitalTile;
    let to = cap != null && cap !== s.tile ? cap : -1;
    if (to < 0) {
      let best = -2;
      const here = new THREE.Vector3(...tile.center).normalize();
      for (const o of world.structures) {
        if (o.owner !== s.owner || o.id === s.id || !world.tiles[o.tile] || (o.kind !== 'town' && o.kind !== 'city' && o.kind !== 'village')) continue;
        const d = here.dot(p2.set(...world.tiles[o.tile]!.center).normalize());
        if (d > best) { best = d; to = o.tile; }
      }
    }
    if (to >= 0 && world.tiles[to]) {
      p2.set(...world.tiles[to]!.center).normalize();
      const dx = p2.dot(gx), dy = p2.dot(gy);
      if (Math.hypot(dx, dy) > 1e-6) roadPhi = Math.atan2(dy / Ry, dx / Rx);
    }
  }
  const streetX = o1 * pitch, streetY = o2 * pitch;
  const gatePhis = (f: number, n: number): number[] => {
    const cl = (v: number): number => Math.max(-1, Math.min(1, v));
    const solve = (fn: (phi: number) => number, start: number): number => { let phi = start; for (let k = 0; k < 4; k++) phi = fn(phi); return phi; };
    const cands = [
      solve((phi) => Math.asin(cl(streetY / (Ry * f * wob(phi)))), 0),                       // +x
      solve((phi) => Math.acos(cl(streetX / (Rx * f * wob(phi)))), Math.PI / 2),             // +y
      solve((phi) => Math.PI - Math.asin(cl(streetY / (Ry * f * wob(phi)))), Math.PI),       // -x
      solve((phi) => -Math.acos(cl(streetX / (Rx * f * wob(phi)))), -Math.PI / 2),           // -y
    ];
    const diff = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    let first = 0;
    for (let k = 1; k < 4; k++) if (diff(cands[k]!, roadPhi) < diff(cands[first]!, roadPhi)) first = k;
    const order = [first, (first + 2) % 4, (first + 1) % 4, (first + 3) % 4];
    return order.slice(0, n).map((k) => ((cands[k]! % TAU) + TAU) % TAU);
  };

  interface Ring { f: number; mode: Mode; h: number; t: number; towR: number; towH: number; gates: number; gateW: number; fort: boolean }
  const ring = (rg: Ring): void => {
    const hgt = rg.h * w, thick = rg.t * w, towR = rg.towR * w, towH = rg.towH * w, gateW = rg.gateW * w;
    const rAvg = ((Rx + Ry) / 2) * rg.f;
    const half = gateW / 2 / rAvg;
    const gates = gatePhis(rg.f, rg.gates)
      .filter((phi) => { const [x, y] = ringPt(phi, rg.f); return !nearRiver(x, y, halfW + gateW); })
      .sort((a, b) => a - b);
    const starts = gates.length ? gates : [roadPhi];
    const segLen = (mode: Mode): number => (mode === 'shield' ? 0.09 : 0.06) * w;
    const every = Math.max(2, Math.round((rg.mode === 'palisade' ? 0.24 : rg.mode === 'shield' ? 0.27 : 0.3) * w / segLen(rg.mode)));
    for (let gi = 0; gi < starts.length; gi++) {
      const open = gates.length > 0;
      const a0 = starts[gi]! + (open ? half : 0);
      let a1 = starts[(gi + 1) % starts.length]! - (open ? half : 0);
      while (a1 <= a0 + 1e-6) a1 += TAU;
      const n = Math.max(2, Math.round(((a1 - a0) * rAvg) / segLen(rg.mode)));
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= n; k++) pts.push(ringPt(a0 + ((a1 - a0) * k) / n, rg.f));
      const skip: boolean[] = [];
      for (let k = 0; k < n; k++) skip.push(nearRiver((pts[k]![0] + pts[k + 1]![0]) / 2, (pts[k]![1] + pts[k + 1]![1]) / 2, halfW * 0.4));
      for (let k = 0; k < n; k++) if (!skip[k]) run(rg.mode, pts[k]!, pts[k + 1]!, hgt, thick);
      // Towers at regular steps and on both banks of a river gap; the ends of the arc belong to the gates.
      for (let k = open ? 1 : 0; k < n; k++) {
        const before = k > 0 ? skip[k - 1]! : skip[n - 1]!;
        if (k % every !== 0 && skip[k] === before) continue;
        if (open && (k < 2 || k > n - 2) && skip[k] === before) continue;
        const a = pts[Math.max(0, k - 1)]!, b = pts[Math.min(n, k + 1)]!;
        tower(rg.mode, pts[k]![0], pts[k]![1], Math.atan2(b[1] - a[1], b[0] - a[0]), towR, towH);
      }
    }
    // Gatehouses.
    for (const phi of gates) {
      const l = ringPt(phi - half, rg.f), r = ringPt(phi + half, rg.f), m = ringPt(phi, rg.f);
      if (taken(m[0], m[1], gateW * 0.5)) continue;
      const ang = Math.atan2(r[1] - l[1], r[0] - l[0]);
      const ox = Math.sin(ang), oy = -Math.cos(ang); // outward: the ring runs anticlockwise
      const k = rg.fort ? 1.45 : 1.15;
      const span = Math.hypot(r[0] - l[0], r[1] - l[1]);
      if (rg.mode === 'palisade') {
        tower('palisade', l[0], l[1], ang, towR * 1.25, towH * 1.25);
        tower('palisade', r[0], r[1], ang, towR * 1.25, towH * 1.25);
        toWorld(m[0], m[1], 0, p2); quatAt(ang, m[0], m[1], q2);
        out.caps.add(p2, q2, span * 1.1, towH * 1.12, thick * 1.2, postC);
        continue;
      }
      if (rg.mode === 'shield') {
        tower('shield', l[0], l[1], ang, towR * k * 1.2, towH * k);
        tower('shield', r[0], r[1], ang, towR * k * 1.2, towH * k);
        if (rg.fort) {
          const d = 0.05 * w;
          tower('shield', l[0] + ox * d, l[1] + oy * d, ang, towR, towH);
          tower('shield', r[0] + ox * d, r[1] + oy * d, ang, towR, towH);
        }
        continue;
      }
      toWorld(m[0], m[1], 0, p2); quatAt(ang, m[0], m[1], q2);
      if (look.pavilion) {
        // A solid gate block with a dark gateway and a roofed pavilion on top.
        const baseH = hgt * (rg.fort ? 1.5 : 1.25), deep = thick * (rg.fort ? 2.6 : 2);
        out.walls.add(p2, q2, span * 1.5, baseH, deep, stoneC);
        out.walls.add(p2, q2, span * 0.5, baseH * 0.62, deep * 1.06, doorC);
        out.walls.add(p2, q2, span * 1.15, baseH * 1.42, deep * 0.72, col(look.pavilion)); // the hall shows above the block
        if (roofC) out.roofs4.add(p2, q2, span * 1.7, baseH * 1.42 / 0.7, deep * 1.45, roofC);
      } else {
        tower('stone', l[0], l[1], ang, towR * k, towH * k);
        tower('stone', r[0], r[1], ang, towR * k, towH * k);
        out.caps.add(p2, q2, span * 1.02, hgt * (rg.fort ? 1.45 : 1.2), thick * 1.25, stoneC);
        out.walls.add(p2, q2, span * 0.66, hgt * 0.1, thick * 0.9, doorC); // a dark threshold under the arch
      }
      if (rg.fort) {
        // The gate fort: a walled forecourt in front of the gate with its own pair of towers.
        const d = 0.062 * w, wl = span / 2 + towR * 0.6;
        const tx = Math.cos(ang), ty = Math.sin(ang);
        const fl: [number, number] = [m[0] - tx * wl + ox * d, m[1] - ty * wl + oy * d];
        const fr: [number, number] = [m[0] + tx * wl + ox * d, m[1] + ty * wl + oy * d];
        const bl: [number, number] = [m[0] - tx * wl, m[1] - ty * wl], br: [number, number] = [m[0] + tx * wl, m[1] + ty * wl];
        run('stone', bl, fl, hgt * 0.9, thick * 0.9);
        run('stone', br, fr, hgt * 0.9, thick * 0.9);
        const gl: [number, number] = [m[0] - tx * span * 0.42 + ox * d, m[1] - ty * span * 0.42 + oy * d];
        const gr: [number, number] = [m[0] + tx * span * 0.42 + ox * d, m[1] + ty * span * 0.42 + oy * d];
        run('stone', fl, gl, hgt * 0.9, thick * 0.9);
        run('stone', gr, fr, hgt * 0.9, thick * 0.9);
        tower('stone', fl[0], fl[1], ang, towR * 1.1, towH * 1.05);
        tower('stone', fr[0], fr[1], ang, towR * 1.1, towH * 1.05);
      }
    }
  };

  if (wallTier > 0) {
    const outerMode: Mode = shield ? 'shield' : tier === 1 ? 'palisade' : 'stone';
    const coreMode: Mode = shield ? 'shield' : 'stone';
    const od = shield ? dim.shield : tier === 1 ? dim.palisade : dim.stone;
    const gates = tier >= 4 ? 4 : tier === 3 ? 3 : big ? 2 : tier;
    ring({ f: wallF, mode: outerMode, h: od.h, t: od.t, towR: od.towR, towH: od.towH, gates, gateW: od.gate, fort: tier >= 4 });
    if (hasCore) {
      const cd = shield ? dim.shield : coreDim;
      const kk = shield && tier >= 4 ? 1.35 : 1;
      ring({ f: coreF, mode: coreMode, h: cd.h * kk, t: cd.t, towR: cd.towR, towH: cd.towH * kk, gates: 4, gateW: cd.gate, fort: false });
    }
  } else if (big || pastWalls) {
    // No walls yet (or no longer): a ring road around the town instead.
    const perim = Math.PI * (Rx + Ry) * wallF;
    const M = Math.max(24, Math.round(perim / (0.06 * w)));
    const road = new THREE.Color(S.RING_ROAD);
    for (let k = 0; k < M; k++) {
      const a = ringPt((k / M) * TAU, wallF * 0.99), b = ringPt(((k + 1) / M) * TAU, wallF * 0.99);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (nearRiver(mx, my, 0) || taken(mx, my, 0)) continue;
      toWorld(mx, my, 0.00015, p);
      quatAt(Math.atan2(b[1] - a[1], b[0] - a[0]), mx, my, q);
      out.flats.add(p, q, Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.08, 0.0002, 0.03 * w, road);
    }
  }

  // ---- ground: a shallow cone (unit radius, rim at y = -1) that follows the sunken fan --------------
  toWorld(0, 0, 0.00008, p);
  q.setFromRotationMatrix(tmpM.makeBasis(gx, g.n, tmpZ.crossVectors(gx, g.n)));
  const gk = kind === 'town' ? 1.1 : wallF + 0.05;
  out.grounds.add(p, q, Rx * gk, ((Rx + Ry) / 2) * gk * sag, Ry * gk, new THREE.Color(S.GROUND));
  return out;
}
