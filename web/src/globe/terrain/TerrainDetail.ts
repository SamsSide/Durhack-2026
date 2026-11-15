// Terrain detail: mountain ranges, knolls, dunes, mesas, seracs, boulders, scrub and reeds standing on the
// provinces. One InstancedMesh per shape (twelve draw calls at most), one shared material, built once per
// world; matrices are rewritten only when a province gains or loses a structure or the zoom fade moves.
// Peaks, knolls, dunes, mesas and seracs show from orbit; the small props fade in when zoomed in, like trees.
import * as THREE from 'three';
import type { World } from '@terra/shared';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';
import { feetOn, inFeet, onOccupancy } from '../structures/occupancy';
import { hash01 } from '../structures/placement';
import type { TileGeo, TileGeos } from '../structures/placement';
import { DETAIL_KINDS, buildDetailGeometries, makeDetailMaterial } from './detailGeometry';
import type { DetailKind } from './detailGeometry';

interface Item {
  tile: number; kind: number; slot: number;
  pos: THREE.Vector3; quat: THREE.Quaternion; sx: number; sy: number; sz: number;
  a: number; b: number; rad: number;   // tangent position on the tile and footprint radius, world units
  inner: boolean;                      // near the tile centre: hidden once anything is built there
  keep: boolean;                       // stays when a city fills the tile (peaks on a shared edge)
  fade: boolean;                       // a small prop: scales in with the zoom
  snow: number; mix: number;
}

interface Edge { ax: number; ay: number; nx: number; ny: number; len: number; mx: number; my: number; other: number; kind: 'mtn' | 'sea' | 'land' }
interface Poly { edges: Edge[]; inR: number }

const KIND: Record<DetailKind, number> = Object.fromEntries(DETAIL_KINDS.map((k, i) => [k, i])) as Record<DetailKind, number>;
const FADE = new Set<number>([KIND.rockA, KIND.rockB, KIND.scrub, KIND.reed]);
const NO_SNOW = 2;
/** The largest scale a peak may have: the camera only clears props it can see (MAX_PROP in camera/propScan.ts). */
const PEAK_MAX = 0.058;
/** A group of touching mountain tiles this big is a range: its peaks line up into ridges along its long axis. */
const RANGE_MIN = 4;
/** How often the province colours are re-read, in frames. */
const COLOR_EVERY = 6;

const UP = new THREE.Vector3(0, 1, 0);
const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3();
const basis = new THREE.Matrix4();
const yawQ = new THREE.Quaternion();

export class TerrainDetail {
  readonly group = new THREE.Group();
  private items: Item[] = [];
  private byTile = new Map<number, Item[]>();
  private meshes: (THREE.InstancedMesh | null)[] = [];
  private material = makeDetailMaterial();
  private geometries = buildDetailGeometries();
  private level = new Map<number, number>();
  private dirtyTiles = new Set<number>();
  private all = true;
  private lastF = -1;
  private frame = 0;
  private shown: Float32Array;
  private off: () => void;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private col = new THREE.Color();
  private p = new THREE.Vector3();
  private counts = DETAIL_KINDS.map(() => 0);
  /** Per mountain tile in a range: the range's long axis (a world direction). */
  private rangeAxis = new Map<number, THREE.Vector3>();

  constructor(private world: World, private geos: TileGeos, private mesh: ProvinceMesh) {
    this.shown = new Float32Array(world.tiles.length * 3).fill(-1);
    this.findRanges();
    for (const t of world.tiles) {
      if (t.terrain === 'ocean') continue;
      this.place(t);
    }
    DETAIL_KINDS.forEach((name, k) => {
      const n = this.counts[k]!;
      if (!n) { this.meshes.push(null); return; }
      // Each mesh needs its own copy of the per-instance attribute, so the shared shape is cloned shallowly.
      const geo = this.geometries[name];
      const inst = new Float32Array(n * 2);
      geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 2));
      const im = new THREE.InstancedMesh(geo, this.material, n);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
      im.frustumCulled = false;
      im.raycast = () => {};
      this.meshes.push(im);
      this.group.add(im);
    });
    for (const it of this.items) {
      const inst = this.meshes[it.kind]!.geometry.getAttribute('aInst') as THREE.InstancedBufferAttribute;
      inst.setXY(it.slot, it.snow, it.mix);
    }
    if (import.meta.env?.DEV) (window as unknown as { __terrainDetail?: unknown }).__terrainDetail = this; // dev only: __terrainDetail.stats() in the console
    this.off = onOccupancy((tile) => { if (this.byTile.has(tile)) this.dirtyTiles.add(tile); });
  }

  /** Instances and triangles drawn at most (everything visible). */
  stats(): { instances: number; triangles: number; drawCalls: number; byKind: Record<string, number> } {
    let triangles = 0, drawCalls = 0;
    const byKind: Record<string, number> = {};
    DETAIL_KINDS.forEach((name, k) => {
      const n = this.counts[k]!;
      if (!n) return;
      drawCalls++;
      byKind[name] = n;
      triangles += n * (this.geometries[name].getAttribute('position').count / 3);
    });
    return { instances: this.items.length, triangles, drawCalls, byKind };
  }

  // ---- placement ---------------------------------------------------------------------------

  /** Group touching mountain tiles and find each large group's long axis (the main direction its tiles spread in). */
  private findRanges(): void {
    const tiles = this.world.tiles;
    const seen = new Set<number>();
    for (const t of tiles) {
      if (t.terrain !== 'mountain' || seen.has(t.id)) continue;
      const group = [t.id];
      seen.add(t.id);
      for (let i = 0; i < group.length; i++) {
        for (const nb of tiles[group[i]!]!.neighbors) {
          if (tiles[nb]?.terrain !== 'mountain' || seen.has(nb)) continue;
          seen.add(nb);
          group.push(nb);
        }
      }
      if (group.length < RANGE_MIN) continue;
      let mx = 0, my = 0, mz = 0;
      for (const id of group) { const c = tiles[id]!.center; mx += c[0]; my += c[1]; mz += c[2]; }
      mx /= group.length; my /= group.length; mz /= group.length;
      let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
      for (const id of group) {
        const c = tiles[id]!.center, x = c[0] - mx, y = c[1] - my, z = c[2] - mz;
        xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z;
      }
      // Power iteration: the direction the group is longest in.
      let ax = 0.61, ay = 0.53, az = 0.59;
      for (let k = 0; k < 24; k++) {
        const nx = xx * ax + xy * ay + xz * az, ny = xy * ax + yy * ay + yz * az, nz = xz * ax + yz * ay + zz * az;
        const l = Math.hypot(nx, ny, nz) || 1;
        ax = nx / l; ay = ny / l; az = nz / l;
      }
      const axis = new THREE.Vector3(ax, ay, az);
      for (const id of group) this.rangeAxis.set(id, axis);
    }
  }

  /** The tile's outline in its tangent plane, each edge with the neighbour across it. */
  private poly(t: World['tiles'][number], g: TileGeo): Poly {
    const pts: [number, number][] = [];
    const v = this.p;
    for (const b of t.boundary) {
      v.set(b[0], b[1], b[2]).normalize().multiplyScalar(g.h);
      pts.push([v.dot(g.t1), v.dot(g.t2)]);
    }
    const nbs = t.neighbors.map((id) => {
      const o = this.world.tiles[id]!;
      v.set(o.center[0], o.center[1], o.center[2]).normalize();
      const x = v.dot(g.t1), y = v.dot(g.t2), l = Math.hypot(x, y) || 1;
      return { id, x: x / l, y: y / l, terrain: o.terrain };
    });
    const edges: Edge[] = [];
    let inR = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1;
      let nx = -ey / len, ny = ex / len;                       // inward normal: the centre (0, 0) is inside
      if (nx * -a[0] + ny * -a[1] < 0) { nx = -nx; ny = -ny; }
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ml = Math.hypot(mx, my) || 1;
      let best = -2, other = -1, kind: Edge['kind'] = 'sea';
      for (const nb of nbs) {
        const d = (mx / ml) * nb.x + (my / ml) * nb.y;
        if (d > best) { best = d; other = nb.id; kind = nb.terrain === 'ocean' ? 'sea' : nb.terrain === 'mountain' ? 'mtn' : 'land'; }
      }
      edges.push({ ax: a[0], ay: a[1], nx, ny, len, mx, my, other, kind });
      inR = Math.min(inR, nx * -a[0] + ny * -a[1]);
    }
    return { edges, inR };
  }

  /** True when a disc of radius `rad` at (a, b) stays on the tile (it may lean over an edge shared with a mountain). */
  private fits(poly: Poly, a: number, b: number, rad: number, range: boolean, seaGap: number): boolean {
    for (const e of poly.edges) {
      const d = (a - e.ax) * e.nx + (b - e.ay) * e.ny;
      const need = e.kind === 'sea' ? rad + seaGap : range && e.kind === 'mtn' ? -0.25 * rad : rad * 0.9;
      if (d < need) return false;
    }
    return true;
  }

  private add(
    t: World['tiles'][number], g: TileGeo, kind: number, a: number, b: number, sx: number, sy: number, sz: number,
    yaw: number | null, opts: { keep?: boolean; snow?: number; mix?: number; up?: number; rad?: number } = {},
  ): Item {
    const pos = this.geos.point(g, a, b, opts.up ?? 0, new THREE.Vector3());
    // Local frame: y up from the ground here, x east, so a yaw means the same heading on every tile.
    vy.copy(pos).normalize();
    vx.crossVectors(UP, vy);
    if (vx.lengthSq() < 1e-6) vx.set(1, 0, 0);
    vx.normalize();
    vz.crossVectors(vx, vy);
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis.makeBasis(vx, vy, vz));
    quat.multiply(yawQ.setFromAxisAngle(UP, yaw ?? hash01(t.id * 977 + this.items.length, 41) * Math.PI * 2));
    const rad = opts.rad ?? Math.max(sx, sz);
    const it: Item = {
      tile: t.id, kind, slot: this.counts[kind]!++, pos, quat, sx, sy, sz, a, b, rad,
      inner: Math.hypot(a, b) < g.width * 0.36 + rad * 0.5, keep: !!opts.keep, fade: FADE.has(kind),
      snow: opts.snow ?? NO_SNOW, mix: opts.mix ?? 1,
    };
    this.items.push(it);
    let list = this.byTile.get(t.id);
    if (!list) { list = []; this.byTile.set(t.id, list); }
    list.push(it);
    return it;
  }

  /**
   * Scatter up to `count` discs on a tile by rejection: inside the outline, clear of the centre (where armies
   * stand) and no closer to each other than `overlap` times the sum of their radii.
   */
  private scatter(
    t: World['tiles'][number], poly: Poly, taken: [number, number, number][], count: number, salt: number,
    radius: (i: number) => number, centre: (rad: number) => number, overlap: number, range: boolean, seaGap: number,
    put: (a: number, b: number, rad: number, i: number, u: number) => void, reach = 1,
  ): void {
    const phase = hash01(t.id * 31 + salt, 50) * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const rad = radius(i);
      for (let k = 0; k < 14; k++) {
        const seed = t.id * 4096 + salt * 257 + i * 16 + k;
        // One sector each, so the discs spread round the tile instead of bunching on one side.
        const ang = phase + ((i + (hash01(seed, 51) - 0.5) * 0.8 + k * 0.38) / count) * Math.PI * 2;
        const lo = centre(rad), hi = Math.max(lo, poly.inR * 1.12 * reach);
        const r = lo + (hi - lo) * Math.pow(hash01(seed, 52), 0.7);
        const a = Math.cos(ang) * r, b = Math.sin(ang) * r;
        if (!this.fits(poly, a, b, rad, range, seaGap)) continue;
        let ok = true;
        for (const q of taken) if (Math.hypot(a - q[0], b - q[1]) < (rad + q[2]) * overlap) { ok = false; break; }
        if (!ok) continue;
        taken.push([a, b, rad]);
        put(a, b, rad, i, hash01(seed, 53));
        break;
      }
    }
  }

  private place(t: World['tiles'][number]): void {
    const g = this.geos.get(t.id);
    const poly = this.poly(t, g);
    const S = Math.min(g.width, 0.09);    // scale of the small props
    const W = Math.min(g.width, 0.125);   // scale of the landforms: they fill the province, up to a size the camera still clears
    const lat = Math.abs(g.n.y);
    const h = (i: number, salt: number): number => hash01(t.id * 131 + i, salt);
    let icy = false, dry = false;
    for (const nb of t.neighbors) {
      const k = this.world.tiles[nb]?.terrain;
      if (k === 'ice') icy = true; else if (k === 'desert') dry = true;
    }
    const frost = icy || lat > 0.8 ? 0.55 : NO_SNOW;   // a dusting on knolls and rocks in the far north and south
    const knollFrost = frost === NO_SNOW ? NO_SNOW : 0.8;   // knolls are wide and low: only the crown, or the whole knoll reads as a white disc
    const taken: [number, number, number][] = [];
    const seaGap = S * 0.07;
    const rocks = (count: number, salt: number, lo = 0.03, hi = 0.065): void => {
      this.scatter(t, poly, taken, count, salt, (i) => S * (lo + (hi - lo) * h(i, salt)), (rad) => S * 0.16 + rad, 1.05, false, seaGap, (a, b, rad, i, u) => {
        this.add(t, g, u < 0.55 ? KIND.rockA : KIND.rockB, a, b, rad, rad * (0.7 + 0.5 * h(i, salt + 1)), rad * (0.8 + 0.4 * u), null, { snow: frost });
      });
    };

    if (t.terrain === 'mountain') {
      const snowFor = (rad: number, height: number): number => {
        const cap = (height / W - 0.3) * 1.3 + Math.max(0, lat - 0.35) * 1.1 + (icy ? 0.35 : 0) + (t.elevation - 0.9) * 0.8 - (dry ? 0.2 : 0);
        return cap < 0.08 ? NO_SNOW : 1 - Math.min(lat > 0.7 || icy ? 0.8 : 0.5, cap);
      };
      // How high this province stands in its range: every province differs, and one that outranks all its
      // mountain neighbours carries the group's tallest summit.
      const rank = (id: number): number => hash01(id * 131, 95);
      let deep = true, crown = true;
      for (const e of poly.edges) {
        if (e.kind !== 'mtn') deep = false;
        else if (rank(e.other) > rank(t.id)) crown = false;
      }
      const lift = (0.84 + 0.3 * rank(t.id)) * (deep ? 1.08 : 1) * (crown ? 1.2 : 1);
      const peak = (a: number, b: number, rad: number, i: number, u: number, keep: boolean, up = 0, tall = 1): void => {
        rad = Math.min(rad, PEAK_MAX);
        const height = Math.min(PEAK_MAX, rad * (0.95 + 0.5 * u) * (i === 0 ? 1.15 : 1) * lift * tall);
        const kind = KIND.peak0 + Math.floor(h(i, 61 + (keep ? 7 : 0)) * 4);
        this.add(t, g, kind, a, b, rad, height, rad, null, { keep, up, snow: snowFor(rad, height), mix: 1 });
      };
      // In a range the ridges run along its long axis; a lone massif keeps its ring of summits.
      const axis = this.rangeAxis.get(t.id);
      let ux = 0, uy = 0;
      if (axis) {
        const turn = (h(0, 96) - 0.5) * 0.5;
        const x = axis.dot(g.t1), y = axis.dot(g.t2), l = Math.hypot(x, y);
        if (l > 0.2) { ux = (x * Math.cos(turn) - y * Math.sin(turn)) / l; uy = (x * Math.sin(turn) + y * Math.cos(turn)) / l; }
      }
      const ridged = ux !== 0 || uy !== 0;
      // Link peaks on edges shared with another mountain tile (placed by the lower id), so a range reads as one.
      // In a range only the edges a ridge crosses get one, which leaves valleys between the ridges.
      let links = 0;
      poly.edges.forEach((e, i) => {
        if (e.kind !== 'mtn') return;
        links++;
        if (t.id > e.other) return;
        if (ridged && Math.abs(e.nx * ux + e.ny * uy) < 0.6) return;
        const rad = W * (0.3 + 0.12 * h(i, 62));
        const slide = (h(i, 63) - 0.5) * 0.3 * e.len;
        const a = e.mx * 0.97 - e.ny * slide, b = e.my * 0.97 + e.nx * slide;
        taken.push([a, b, rad]);
        peak(a, b, rad, i + 1, h(i, 64), true, Math.min(0, (this.geos.get(e.other).h - g.h)));
      });
      let summits = links ? 5 : 6;
      if (ridged) {
        // One ridge beside the centre (armies stand in the middle): the summit, then a shoulder each way along
        // the axis, each lower than the last. Deep inside the range the ridge is bigger and there are fewer peaks.
        summits = deep ? 4 : 5;
        const side = h(0, 97) < 0.5 ? -1 : 1;
        const main = W * (deep ? 0.46 : 0.4) * (crown ? 1.1 : 1);
        const off = main * 0.96 + W * 0.03;
        const cx = -uy * side * off, cy = ux * side * off;
        const along = (h(0, 98) - 0.5) * 0.2 * W;
        const spots: [number, number, number][] = [[along, main, 1.12], [along + main * 0.95, main * (0.66 + 0.14 * h(1, 99)), 0.94], [along - main * 0.95, main * (0.56 + 0.14 * h(2, 99)), 0.86]];
        let placed = 0;
        spots.forEach(([d, rad, tall], i) => {
          const a = cx + ux * d, b = cy + uy * d;
          if (!this.fits(poly, a, b, rad, true, seaGap)) return;
          for (const q of taken) if (Math.hypot(a - q[0], b - q[1]) < (rad + q[2]) * 0.5) return;
          taken.push([a, b, rad]);
          peak(a, b, rad, i, h(i, 100), false, 0, tall);
          placed++;
        });
        summits -= placed;
        // The rest are lesser peaks round the ring (a second, lower line across the valley).
        if (summits > 0) {
          this.scatter(t, poly, taken, summits, 1, (i) => W * (0.2 + 0.12 * h(i, 65)), (rad) => rad * 0.96 + W * 0.03, 0.62, true, seaGap,
            (a, b, rad, i, u) => peak(a, b, rad, i + 3, u, false, 0, 0.8), 0.86);
        }
      } else {
        // The summits: a ring round the centre, the first one the tallest.
        this.scatter(t, poly, taken, summits, 1, (i) => W * (i === 0 ? 0.4 : 0.24 + 0.13 * h(i, 65)), (rad) => rad * 0.96 + W * 0.03, 0.62, true, seaGap,
          (a, b, rad, i, u) => peak(a, b, rad, i, u, false), 0.86);
      }
      // Foothills toward the lowlands, in the province's own colour (none deep inside a range: there are no lowlands there).
      if (!(ridged && deep)) {
        this.scatter(t, poly, taken, 3, 2, (i) => W * (0.15 + 0.08 * h(i, 66)), (rad) => rad + W * 0.04, 0.7, false, seaGap, (a, b, rad, i, u) => {
          this.add(t, g, KIND.knoll, a, b, rad * 1.15, rad * (0.4 + 0.25 * u), rad, null, { snow: knollFrost, mix: 0.55 });
        });
      }
      rocks(ridged ? 2 : 4, 3, 0.035, 0.075);
      return;
    }
    if (t.terrain === 'hills') {
      this.scatter(t, poly, taken, 4 + Math.floor(h(0, 67) * 2), 1, (i) => W * (i === 0 ? 0.34 : 0.19 + 0.13 * h(i, 68)), (rad) => rad * 0.92 + W * 0.02, 0.66, false, seaGap, (a, b, rad, i, u) => {
        this.add(t, g, KIND.knoll, a, b, rad * (1.05 + 0.3 * h(i, 69)), rad * (0.34 + 0.2 * u), rad, null, { snow: knollFrost, mix: 0.38 });
      });
      rocks(3, 2);
      return;
    }
    if (t.terrain === 'desert') {
      // Dunes share one heading (the wind blows from the west, turned a little by latitude), so a desert reads as a dune field.
      const wind = Math.PI / 2 + (g.n.y > 0 ? 0.35 : -0.35) + (h(0, 70) - 0.5) * 0.3;
      if (h(0, 71) < 0.3) {
        this.scatter(t, poly, taken, 1 + Math.floor(h(0, 72) * 2), 1, (i) => W * (0.13 + 0.08 * h(i, 73)), (rad) => rad + W * 0.1, 1, false, seaGap, (a, b, rad, i, u) => {
          this.add(t, g, KIND.mesa, a, b, rad * (1 + 0.25 * h(i, 74)), rad * (0.75 + 0.5 * u), rad, null);
        });
      }
      this.scatter(t, poly, taken, 5 + Math.floor(h(0, 75) * 3), 2, (i) => W * (0.17 + 0.12 * h(i, 76)), (rad) => rad * 0.8 + W * 0.05, 0.72, false, seaGap, (a, b, rad, i, u) => {
        this.add(t, g, KIND.dune, a, b, rad, rad * (0.26 + 0.12 * u), rad * 0.8, wind + (u - 0.5) * 0.25, { mix: 0.75 });
      });
      rocks(2, 3);
      return;
    }
    if (t.terrain === 'ice') {
      // Pressure ridges (drifts in the ice's own colour) and clusters of seracs.
      this.scatter(t, poly, taken, 3, 1, (i) => W * (0.16 + 0.12 * h(i, 77)), (rad) => rad * 0.9 + W * 0.03, 0.7, false, seaGap, (a, b, rad, i, u) => {
        this.add(t, g, KIND.knoll, a, b, rad * 1.5, rad * (0.22 + 0.16 * u), rad * 0.6, null, { mix: 0 });
      });
      this.scatter(t, poly, taken, 3 + Math.floor(h(0, 78) * 3), 2, (i) => W * (0.07 + 0.07 * h(i, 79)), (rad) => rad + W * 0.1, 1, false, seaGap, (a, b, rad, i, u) => {
        this.add(t, g, KIND.serac, a, b, rad, rad * (1.1 + 0.7 * u), rad, null);
      });
      return;
    }
    if (t.terrain === 'plains') {
      if (h(0, 80) < 0.55) rocks(1 + Math.floor(h(0, 81) * 3), 1);
      this.scatter(t, poly, taken, 2 + Math.floor(h(0, 82) * 4), 2, (i) => S * (0.035 + 0.03 * h(i, 83)), (rad) => rad + S * 0.14, 1.1, false, seaGap, (a, b, rad, i, u) => {
        this.add(t, g, KIND.scrub, a, b, rad, rad * (0.7 + 0.4 * u), rad, null, { snow: frost, mix: 0.9 });
      });
      return;
    }
    if (t.terrain === 'forest') { if (h(0, 84) < 0.4) rocks(2, 1); return; }
    if (t.terrain === 'coast') {
      // Reeds and rocks along the shore: just inside every edge that meets the sea.
      poly.edges.forEach((e, i) => {
        if (e.kind !== 'sea') return;
        const n = 2 + Math.floor(h(i, 85) * 2);
        for (let j = 0; j < n; j++) {
          const seed = i * 8 + j;
          const rad = S * (0.03 + 0.025 * h(seed, 86));
          const along = (h(seed, 87) - 0.5) * 0.7 * e.len;
          const inset = rad + seaGap + S * 0.1 * h(seed, 88);
          const a = e.mx + e.nx * inset - e.ny * along, b = e.my + e.ny * inset + e.nx * along;
          if (!this.fits(poly, a, b, rad, false, seaGap * 0.5)) continue;
          taken.push([a, b, rad]);
          if (h(seed, 89) < 0.62) this.add(t, g, KIND.reed, a, b, rad * 1.2, S * (0.06 + 0.04 * h(seed, 90)), rad * 1.2, null, { mix: 0.9 });
          else this.add(t, g, h(seed, 91) < 0.5 ? KIND.rockA : KIND.rockB, a, b, rad, rad * 0.8, rad, null, { snow: frost });
        }
      });
    }
  }

  // ---- updates -----------------------------------------------------------------------------

  /** 0 none, 1 any structure, 2 city or capital (the same levels as the trees). */
  setLevel(tile: number, level: number): void {
    if ((this.level.get(tile) ?? 0) === level) return;
    this.level.set(tile, level);
    if (this.byTile.has(tile)) this.dirtyTiles.add(tile);
  }

  private write(it: Item, f: number, feet: ReturnType<typeof feetOn>, lv: number): void {
    const hide = (lv === 2 && !it.keep) || (lv === 1 && it.inner) || (feet.length > 0 && inFeet(feet, it.a, it.b, it.rad * 0.8));
    const k = hide ? 0 : it.fade ? f : 1;
    this.s.set(it.sx * k, it.sy * k, it.sz * k);
    this.m.compose(it.pos, it.quat, this.s);
    const mesh = this.meshes[it.kind]!;
    mesh.setMatrixAt(it.slot, this.m);
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Copy each province's colour as drawn now (map mode, owner, scorch, fades) onto its detail. */
  private syncColors(): void {
    const attr = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const starts = this.mesh.tileVertexStart;
    const shown = this.shown;
    for (const [tile, list] of this.byTile) {
      const v = starts[tile]! * 3, o = tile * 3;
      const r = arr[v]!, g = arr[v + 1]!, b = arr[v + 2]!;
      if (Math.abs(r - shown[o]!) < 0.004 && Math.abs(g - shown[o + 1]!) < 0.004 && Math.abs(b - shown[o + 2]!) < 0.004) continue;
      shown[o] = r; shown[o + 1] = g; shown[o + 2] = b;
      this.col.setRGB(r, g, b);
      for (const it of list) {
        const mesh = this.meshes[it.kind]!;
        mesh.setColorAt(it.slot, this.col);
        mesh.instanceColor!.needsUpdate = true;
      }
    }
  }

  /** `f` is 0 from orbit and 1 when zoomed in. */
  update(f: number): void {
    if (this.frame++ % COLOR_EVERY === 0) this.syncColors();
    const fMoved = Math.abs(f - this.lastF) >= 0.002 || (f !== this.lastF && (f === 0 || f === 1));
    if (this.all || fMoved) {
      const full = this.all;
      this.all = false;
      this.lastF = f;
      this.dirtyTiles.clear();
      for (const [tile, list] of this.byTile) {
        const lv = this.level.get(tile) ?? 0;
        const feet = feetOn(tile);
        for (const it of list) if (full || it.fade) this.write(it, f, feet, lv);
      }
      this.meshes.forEach((mesh, k) => { if (mesh && FADE.has(k)) mesh.visible = f > 0.01; });
      return;
    }
    if (!this.dirtyTiles.size) return;
    for (const tile of this.dirtyTiles) {
      const lv = this.level.get(tile) ?? 0;
      const feet = feetOn(tile);
      for (const it of this.byTile.get(tile) ?? []) this.write(it, f, feet, lv);
    }
    this.dirtyTiles.clear();
  }

  dispose(): void {
    this.off();
    for (const mesh of this.meshes) mesh?.dispose();
    for (const name of DETAIL_KINDS) this.geometries[name].dispose();
    this.material.dispose();
    this.group.clear();
  }
}
