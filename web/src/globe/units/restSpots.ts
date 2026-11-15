// Where a unit rests on its tile, so it never stands inside a building: the middle of the tile's outline when that is free,
// else the nearest free spot beside whatever fills it (the structure layer's footprints in structures/occupancy,
// the close-up town's disc, a harbour's piers and lighthouse on the sea tile it faces). One spot per tile, the
// same every time for the same buildings; a spot only changes when a building takes it, and then the unit
// glides over instead of jumping. Solved when a tile's footprints change, never per frame. Lane b.
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { feetOn, onOccupancy } from '../structures/occupancy';
import { TileGeos, hash01 } from '../structures/placement';
import type { TileGeo } from '../structures/placement';
import { KIND_R } from '../towns/style';

interface Spot {
  a: number; b: number;     // where it should be, in the tile's tangent axes (world units)
  ca: number; cb: number;   // where it is now (glides to a, b)
  dir: THREE.Vector3;       // unit vector from the planet's centre through the spot
  stale: boolean;
}

/** Glide time constant when a spot has to change (ms). */
const GLIDE_MS = 450;
/** Keep this share of the tile width clear of the tile's edge (the lip and the slope to the neighbour). */
const RIM = 0.18;

export class RestSpots {
  private readonly geos: TileGeos;
  private readonly spots = new Map<number, Spot>();
  private readonly towns = new Map<number, number>();   // tile -> town radius, in tile widths
  private readonly rims = new Map<number, number[]>();  // tile -> its edges as (nx, ny, d) triples, normals pointing in
  private readonly hearts = new Map<number, { a: number; b: number; r: number }>();
  private readonly moving = new Set<Spot>();
  private readonly off: () => void;

  /** `need` is the room a unit wants round its middle, in world units. */
  constructor(private readonly world: World, heights: Float32Array, private readonly dirs: THREE.Vector3[], private readonly need: number) {
    this.geos = new TileGeos(world, heights);
    this.off = onOccupancy((tile) => { const s = this.spots.get(tile); if (s) s.stale = true; });
    this.sync();
  }

  /** Reread which tiles hold a close-up town (call when the world changes). */
  sync(): void {
    const seen = new Map<number, number>();
    for (const s of this.world.structures) {
      const r = KIND_R[s.kind];
      if (r != null) seen.set(s.tile, Math.max(seen.get(s.tile) ?? 0, r));
    }
    for (const tile of new Set([...seen.keys(), ...this.towns.keys()])) {
      if (seen.get(tile) === this.towns.get(tile)) continue;
      const r = seen.get(tile);
      if (r == null) this.towns.delete(tile); else this.towns.set(tile, r);
      const s = this.spots.get(tile);
      if (s) s.stale = true;
    }
  }

  /** The direction (unit vector) of the tile's resting spot. The vector is shared: copy it, never change it. */
  dir(tile: number): THREE.Vector3 | undefined {
    let s = this.spots.get(tile);
    if (!s) {
      const centre = this.dirs[tile];
      if (!centre) return undefined;
      const at = this.solve(tile, null);
      s = { a: at.a, b: at.b, ca: at.a, cb: at.b, dir: new THREE.Vector3(), stale: false };
      this.place(tile, s);
      this.spots.set(tile, s);
    } else if (s.stale) {
      s.stale = false;
      const at = this.solve(tile, s);
      if (at.a !== s.a || at.b !== s.b) { s.a = at.a; s.b = at.b; this.moving.add(s); }
    }
    return s.dir;
  }

  /** The middle of the tile's outline (the point furthest from every edge, near enough; a tile's own centre can
   *  sit well to one side of a lopsided outline) in the tile's tangent axes, and its distance to the nearest edge. */
  private heart(tile: number): { a: number; b: number; r: number } {
    let m = this.hearts.get(tile);
    if (m) return m;
    m = { a: 0, b: 0, r: this.need };
    const t = this.world.tiles[tile];
    if (t && t.boundary.length >= 3) {
      const g = this.geos.get(tile), rim = this.rim(tile, g);
      const clear = (a: number, b: number): number => {
        let c = Infinity;
        for (let i = 0; i < rim.length; i += 3) c = Math.min(c, a * rim[i]! + b * rim[i + 1]! - rim[i + 2]!);
        return c;
      };
      let a = 0, b = 0, c = clear(0, 0);
      for (let it = 0; it < 24; it++) {
        // step away from the nearest edge while that leaves more room
        let near = 0, least = Infinity;
        for (let i = 0; i < rim.length; i += 3) { const v = a * rim[i]! + b * rim[i + 1]! - rim[i + 2]!; if (v < least) { least = v; near = i; } }
        const step = g.width * 0.1 * (1 - it / 24);
        const na = a + rim[near]! * step, nb = b + rim[near + 1]! * step, nc = clear(na, nb);
        if (nc > c) { a = na; b = nb; c = nc; }
      }
      if (c > 0 && c < Infinity) m = { a, b, r: c };
    }
    this.hearts.set(tile, m);
    return m;
  }

  /** How far the tile's outline is from its middle at the nearest edge (world units): the room a formation has. */
  inradius(tile: number): number {
    return this.heart(tile).r;
  }

  /** A fixed direction across the tile (unit vector on its surface), the same every time: two counters on one
   *  tile stand apart along it. */
  axis(tile: number, out: THREE.Vector3): THREE.Vector3 {
    const g = this.geos.get(tile);
    const ang = hash01(tile, 29) * Math.PI;
    return out.copy(g.t1).multiplyScalar(Math.cos(ang)).addScaledVector(g.t2, Math.sin(ang));
  }

  /** Moves a point on the tile (world space, any height) back inside the tile's outline, `margin` in from every
   *  edge; `k` (0..1) is how much of the move to make. The point keeps its height. */
  keepIn(tile: number, p: THREE.Vector3, margin: number, k = 1): void {
    if (k <= 0 || !this.world.tiles[tile]) return;
    const g = this.geos.get(tile);
    const up = p.dot(g.n);
    if (up <= 1e-6) return;
    const len = p.length(), s = g.h / up;
    let a = p.dot(g.t1) * s, b = p.dot(g.t2) * s;
    const a0 = a, b0 = b;
    const rim = this.rim(tile, g), m = Math.min(margin, this.inradius(tile) * 0.6);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < rim.length; i += 3) {
        const v = a * rim[i]! + b * rim[i + 1]! - rim[i + 2]! - m;
        if (v < 0) { a -= v * rim[i]!; b -= v * rim[i + 1]!; }
      }
    }
    if (a === a0 && b === b0) return;
    p.addScaledVector(g.t1, ((a - a0) * k) / s).addScaledVector(g.t2, ((b - b0) * k) / s).setLength(len);
  }

  /** Glide the spots that changed. */
  update(dt: number): void {
    if (!this.moving.size) return;
    const k = 1 - Math.exp(-dt / GLIDE_MS);
    for (const [tile, s] of this.spots) {
      if (!this.moving.has(s)) continue;
      s.ca += (s.a - s.ca) * k; s.cb += (s.b - s.cb) * k;
      if (Math.hypot(s.a - s.ca, s.b - s.cb) < 1e-5) { s.ca = s.a; s.cb = s.b; this.moving.delete(s); }
      this.place(tile, s);
    }
  }

  dispose(): void {
    this.off();
    this.spots.clear();
    this.moving.clear();
  }

  private place(tile: number, s: Spot): void {
    const g = this.geos.get(tile);
    s.dir.copy(g.n).multiplyScalar(g.h).addScaledVector(g.t1, s.ca).addScaledVector(g.t2, s.cb).normalize();
  }

  private rim(tile: number, g: TileGeo): number[] {
    let r = this.rims.get(tile);
    if (r) return r;
    r = [];
    const pts = (this.world.tiles[tile]?.boundary ?? []).map((p) => {
      const l = Math.hypot(p[0], p[1], p[2]) || 1, k = g.h / l;
      return [(p[0] * g.t1.x + p[1] * g.t1.y + p[2] * g.t1.z) * k, (p[0] * g.t2.x + p[1] * g.t2.y + p[2] * g.t2.z) * k] as const;
    });
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      let nx = -(q[1] - p[1]), ny = q[0] - p[0];
      const l = Math.hypot(nx, ny);
      if (l < 1e-9) continue;
      nx /= l; ny /= l;
      let d = nx * p[0] + ny * p[1];
      if (d > 0) { nx = -nx; ny = -ny; d = -d; }   // the centre is inside: normals point at it
      r.push(nx, ny, d);
    }
    this.rims.set(tile, r);
    return r;
  }

  /** The free spot nearest the centre (the old one while it is still free), else the one with the most room. */
  private solve(tile: number, keep: { a: number; b: number } | null): { a: number; b: number } {
    const feet = feetOn(tile);
    const g = this.geos.get(tile);
    const town = (this.towns.get(tile) ?? 0) * g.width;
    const mid = this.heart(tile);
    if (!feet.length && !town) return { a: mid.a, b: mid.b };
    // a hull is longer than a formation is deep: fleets keep more water between them and the piers
    const rim = this.rim(tile, g), need = this.need * (this.world.tiles[tile]?.terrain === 'ocean' ? 1.6 : 1), edge = RIM * g.width;
    const room = (a: number, b: number): number => {
      let c = Infinity;
      for (const f of feet) {
        const du = a - f.a, dv = b - f.b;
        const u = du * f.ax + dv * f.ay, v = -du * f.ay + dv * f.ax;
        c = Math.min(c, Math.max(Math.abs(u), Math.abs(v)) - f.half - need);
      }
      if (town) c = Math.min(c, Math.hypot(a, b) - town - need * 0.5);
      for (let i = 0; i < rim.length; i += 3) c = Math.min(c, a * rim[i]! + b * rim[i + 1]! - rim[i + 2]! - edge);
      return c;
    };
    if (keep && room(keep.a, keep.b) >= 0) return { a: keep.a, b: keep.b };
    let best = { a: mid.a, b: mid.b }, most = room(mid.a, mid.b);
    if (most >= 0) return best;
    const turn = hash01(tile, 17) * Math.PI * 2;
    for (let ring = 1; ring <= 7; ring++) {
      const r = g.width * 0.12 * ring;
      for (let k = 0; k < 12; k++) {
        const ang = turn + (k + ring * 0.5) * (Math.PI / 6);
        const a = mid.a + Math.cos(ang) * r, b = mid.b + Math.sin(ang) * r;
        const c = room(a, b);
        if (c >= 0) return { a, b };
        if (c > most) { most = c; best = { a, b }; }
      }
    }
    // a sea tile with no open water left (a one-tile inland sea ringed by harbours): the fleet lies in the middle
    // of it, clear of every shore, rather than squeezed in among the piers
    if (this.world.tiles[tile]?.terrain === 'ocean') return { a: mid.a, b: mid.b };
    return best;
  }
}
