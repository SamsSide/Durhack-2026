// All structures of a world: one InstancedMesh per (kind, sub-mesh), pop-up animations, dust puffs, LOD.
import * as THREE from 'three';
import type { Terrain, World } from '@terra/shared';
import { hasModel, logMisses, modelFor } from './models';
import type { ModelPart, ModelSet } from './models';
import { clamp01, easeOutBack, hash01, smoothstep } from './placement';
import type { TileGeo, TileGeos } from './placement';
import { Trees } from './Trees';
import { CLOSE } from '../constants';
import { nationIdentity, refreshIdentities } from '../identity/identity';
import type { Identity } from '../identity/identity';
import { bannerColor, eraLook, wallTint } from '../identity/look';
import type { EraLook } from '../identity/look';
import { disposePropSet, makePropSet, propsFor } from '../identity/props';
import type { PropKind, PropSet, Smoke } from '../identity/props';
import { shownKind, updateRuins } from '../war/ruins';
import { ageStyle, ageSwapDelay } from '../towns/ageStyle';
import { clearOccupancy, setFeet } from './occupancy';
import type { Foot } from './occupancy';

const BIG = new Set<string>(['capital', 'city', 'town']);
const SETTLEMENT = new Set<string>(['camp', 'village', 'town', 'city', 'capital']);
const BUILD_S = 0.6, UPGRADE_S = 0.55, DESTROY_S = 0.5, PUFF_S = 0.75;
const PUFF_POOL = 40, PUFF_PARTS = 6;
const ORBIT_BOOST = 1.15;
// Relative scale by kind on top of the manifest footprint: a clear camp-to-capital hierarchy.
const REL: Record<string, number> = { camp: 0.45, village: 0.6, town: 0.75, city: 0.9, capital: 1.0 };
const REL_OTHER = 0.7;
const MAX_SIZE = 0.07;   // absolute cap (times surface radius) so nothing towers over a mountain
const HY_CAP = 1.4;      // tallest stretch, in MAX_SIZE heights, whatever the era says
const MAX_SMOKE = 96;
// Terrain-aware placement (docs/research/nation-identity.md 3.3).
const TIGHT: Partial<Record<Terrain, number>> = { mountain: 0.85, desert: 0.8, ice: 0.85 };
const LIFT0: Partial<Record<Terrain, number>> = { mountain: 0.07, hills: 0.04 };   // base lift, in building sizes
const RING_LIFT: Partial<Record<Terrain, number>> = { mountain: 0.15, hills: 0.08 }; // per ring, in tile widths
const SAT_MIN_RAD = 0.45; // never closer than this to the centre building (tile widths)
const SAT_MAX_RAD = 0.95; // and never past the tile's edge

interface Anim { type: 'build' | 'upgrade' | 'destroy'; t0: number }
interface Rec {
  id: string; tile: number; owner: number; kind: string; slot: number; pool: Pool;
  g: TileGeo; pos: THREE.Vector3; quat: THREE.Quaternion; size: number; anim: Anim | null;
  hy: number;               // stable height stretch (includes the era)
  parent: Rec | null;       // set for the small buildings around a city or capital
  sats: Rec[];
  terr: Terrain;
  off: [number, number];    // offset from the tile centre along the tangent axes
  lift: number;             // raised on a stone platform (mountain, hills)
  props: PropRec[];
  style: string;            // the building style it is drawn in (towns/ageStyle); changes in a wave on an age step
}
interface PropRec {
  kind: PropKind; parent: Rec; pos: THREE.Vector3; quat: THREE.Quaternion; w: number; h: number; smoke?: Smoke; seed: number;
}
interface Look { id: Identity; css: string; style: string | undefined; nomadic: boolean; tint: THREE.Color; team: THREE.Color; era: EraLook }
interface PropPool { meshes: THREE.InstancedMesh[]; cap: number }
// `dirty`: the list or a look changed, so every instance is rewritten. `moving`: some instance is mid pop-up, so
// only those are rewritten (B8). A pool with nothing to show (empty, or scaled to nothing from orbit) is hidden.
interface Pool { key: string; kind: string; parts: ModelPart[]; meshes: THREE.InstancedMesh[]; cap: number; list: Rec[]; dirty: boolean; moving: boolean }
interface Puff { t0: number; pos: THREE.Vector3; g: TileGeo; size: number; seed: number }

export class StructureField {
  readonly group = new THREE.Group();
  private pools = new Map<string, Pool>();
  private recs = new Map<string, Rec>();
  private byTile = new Map<number, Rec[]>();
  private trees: Trees;
  private puffs: Puff[] = [];
  private puffMesh: THREE.InstancedMesh;
  private puffLive = false;
  private f = 0;               // smoothed zoom factor, 0 from orbit and 1 when close
  private writtenF = -1;
  private first = true;
  private looks = new Map<number, Look>();
  private propSet: PropSet = makePropSet();
  private propPools = new Map<PropKind, PropPool>();
  private propList = new Map<PropKind, PropRec[]>();
  private smokers: PropRec[] = [];
  private smokeMesh: THREE.InstancedMesh;
  private shore = new Map<number, [number, number] | null>();
  private propsDirty = true;
  private swaps: Array<{ r: Rec; at: number }> = []; // age steps waiting for their turn in the wave
  private swapAt = Infinity;
  private tmpC = new THREE.Color();
  private m = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private col = new THREE.Color();

  constructor(private world: World, private geos: TileGeos, private models: ModelSet) {
    clearOccupancy();
    this.trees = new Trees(world, geos, models);
    this.group.add(this.trees.group);
    const puffGeo = new THREE.IcosahedronGeometry(1, 0);
    const puffMat = new THREE.MeshStandardMaterial({ color: '#e6dcc3', flatShading: true, roughness: 1 });
    this.puffMesh = new THREE.InstancedMesh(puffGeo, puffMat, PUFF_POOL * PUFF_PARTS);
    this.puffMesh.frustumCulled = false;
    this.puffMesh.count = 0;
    this.puffMesh.visible = false;
    this.group.add(this.puffMesh);
    this.smokeMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: 0.78, depthWrite: false }),
      MAX_SMOKE,
    );
    this.smokeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SMOKE * 3), 3);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.count = 0;
    this.smokeMesh.visible = false;
    this.group.add(this.smokeMesh);
  }

  /** The style a nation builds in now, by its tech age. */
  private styleOf(owner: number): string { return ageStyle(this.world.countries[owner]); }

  /** The instanced group for (model file, kind): one per distinct model, made on first use. */
  private poolFor(kind: string, owner: number, style: string): Pool {
    const m = modelFor(this.models, kind, this.world.countries[owner], style);
    let pool = this.pools.get(m.key);
    if (!pool) {
      pool = { key: m.key, kind, parts: m.parts, meshes: [], cap: 0, list: [], dirty: false, moving: false };
      this.pools.set(m.key, pool);
      this.alloc(pool, 32);
    }
    return pool;
  }

  /** Move a record to the group its (kind, owner) now resolves to. */
  private repool(r: Rec): void {
    const to = this.poolFor(r.kind, r.owner, r.style);
    if (to === r.pool) return;
    const i = r.pool.list.indexOf(r);
    if (i >= 0) r.pool.list.splice(i, 1);
    r.pool.dirty = true;
    r.pool = to; to.list.push(r); to.dirty = true;
  }

  private alloc(pool: Pool, cap: number): void {
    for (const m of pool.meshes) { this.group.remove(m); m.dispose(); }
    pool.cap = cap;
    pool.meshes = pool.parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      this.group.add(mesh);
      return mesh;
    });
    pool.dirty = true;
  }

  /** What a nation's identity does to colour, height and density; cached until its identity changes. */
  private lookOf(owner: number): Look {
    let l = this.looks.get(owner);
    if (!l) {
      const c = this.world.countries[owner];
      const id = nationIdentity(this.world, owner);
      const css = c?.color ?? '#b8b0a0';
      l = { id, css, style: ageStyle(c), nomadic: !!c?.nomadic, tint: wallTint(id, owner), team: bannerColor(css, id), era: eraLook(id.era) };
      this.looks.set(owner, l);
    }
    return l;
  }

  /**
   * Re-derive identities (one pass over the map) and restyle the nations whose look changed. A nation whose
   * only change is its age style switches in a wave out from its capital, each settlement with its pop-up.
   */
  private refreshLooks(now: number): void {
    refreshIdentities(this.world);
    for (const [owner, l] of [...this.looks]) {
      const c = this.world.countries[owner];
      if (!c) continue;
      const same = nationIdentity(this.world, owner) === l.id && c.color === l.css && !!c.nomadic === l.nomadic;
      const style = ageStyle(c);
      if (same && style === l.style) continue;
      if (same) { l.style = style; this.queueAgeStep(owner, now); continue; }
      this.looks.delete(owner);
      this.restyle(owner);
    }
  }

  private queueAgeStep(owner: number, now: number): void {
    for (const r of this.recs.values()) {
      if (r.owner !== owner || r.anim?.type === 'destroy') continue;
      const at = now + ageSwapDelay(this.world, owner, r.tile);
      this.swaps.push({ r, at });
      this.swapAt = Math.min(this.swapAt, at);
    }
  }

  /** Switch every settlement whose turn in an age wave has come; runs only when one is due. */
  private runSwaps(now: number): void {
    let next = Infinity;
    const keep: Array<{ r: Rec; at: number }> = [];
    for (const w of this.swaps) {
      if (w.at > now) { keep.push(w); next = Math.min(next, w.at); continue; }
      const r = w.r;
      if (this.recs.get(r.id) !== r || r.anim?.type === 'destroy' || r.style === this.styleOf(r.owner)) continue;
      this.rebuild(r);
      if (r.anim?.type !== 'build') r.anim = { type: 'upgrade', t0: now };
      this.puff(r, now + 0.05);
    }
    this.swaps = keep;
    this.swapAt = next;
  }

  private restyle(owner: number): void {
    for (const r of this.recs.values()) if (r.owner === owner && r.anim?.type !== 'destroy') this.rebuild(r);
  }

  /** Everything derived from the nation (model, size, height, lean, satellites, props) for one structure. */
  private rebuild(r: Rec): void {
    this.dropSats(r);
    this.dropProps(r);
    r.style = this.styleOf(r.owner);
    r.size = this.sizeOf(r.tile, r.g, r.kind, r.slot, r.id, r.owner, r.style);
    r.hy = this.hyOf(r);
    r.quat = this.orient(r);
    this.repool(r);
    r.pool.dirty = true;
    this.addSats(r);
    this.addProps(r);
    this.publish(r);
  }

  /**
   * Tell the shared occupancy (structures/occupancy) which squares of the tile this settlement fills: its own
   * model, the buildings round it and its props. The close-up town keeps its houses and walls out of them.
   */
  private publish(r: Rec): void {
    const g = r.g, v = this.v;
    const feet: Foot[] = [];
    const foot = (pos: THREE.Vector3, quat: THREE.Quaternion, size: number): void => {
      v.set(1, 0, 0).applyQuaternion(quat);
      const ax = v.dot(g.t1), ay = v.dot(g.t2), l = Math.hypot(ax, ay) || 1;
      feet.push({ a: pos.dot(g.t1), b: pos.dot(g.t2), half: size * 0.5, ax: ax / l, ay: ay / l });
    };
    foot(r.pos, r.quat, r.size);
    for (const q of r.sats) foot(q.pos, q.quat, q.size);
    for (const p of r.props) if (p.kind !== 'platform') foot(p.pos, p.quat, p.w);
    setFeet(r.tile, r.id, feet);
  }

  /** The models in use changed (a new style finished loading): move every structure to the group it now resolves to. */
  refreshModels(): void {
    for (const r of this.recs.values()) {
      r.size = this.sizeOf(r.tile, r.g, r.kind, r.slot, r.id, r.owner, r.style);
      this.repool(r);
      r.pool.dirty = true;
      for (const q of r.sats) { q.size = this.sizeOf(q.tile, q.g, q.kind, 0, q.id, q.owner, q.style) * this.satScale(q); this.repool(q); q.pool.dirty = true; }
      this.dropProps(r);
      this.addProps(r);
      this.publish(r);
    }
    this.propsDirty = true;
  }

  private terrOf(tile: number): Terrain { return this.world.tiles[tile]?.terrain ?? 'plains'; }

  private orient(r: { g: TileGeo; id: string; owner: number }): THREE.Quaternion {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(r.id, 7) * Math.PI * 2);
    const q = r.g.align.clone().multiply(yaw);
    const lean = this.lookOf(r.owner).era.lean;
    if (lean > 0) {
      const deg = (5 + (lean - 5) * hash01(r.id, 17)) * (hash01(r.id, 18) < 0.5 ? -1 : 1);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg)));
    }
    return q;
  }

  private hyOf(r: { id: string; size: number; g: TileGeo; owner: number }): number {
    const hy = (0.9 + 0.2 * hash01(r.id, 12)) * this.lookOf(r.owner).era.hy;
    return Math.min(hy, (MAX_SIZE * r.g.h * HY_CAP) / Math.max(1e-6, r.size));
  }

  /** Unit vector (tangent axes) from a coastal tile towards the sea, or null inland. */
  private shoreDir(tile: number, g: TileGeo): [number, number] | null {
    let d = this.shore.get(tile);
    if (d !== undefined) return d;
    const v = new THREE.Vector3(), acc = new THREE.Vector3();
    let n = 0;
    for (const nb of this.world.tiles[tile]?.neighbors ?? []) {
      if (this.world.tiles[nb]?.terrain !== 'ocean') continue;
      v.set(...this.world.tiles[nb]!.center).normalize().sub(g.n);
      acc.add(v); n++;
    }
    d = null;
    if (n) {
      const a = acc.dot(g.t1), b = acc.dot(g.t2), l = Math.hypot(a, b);
      if (l > 1e-9) d = [a / l, b / l];
    }
    this.shore.set(tile, d);
    return d;
  }

  /** A spot on a tile: angle and radius in tile widths, pulled towards the sea on a coast. */
  private spot(tile: number, g: TileGeo, ang: number, rad: number, up: number, out: THREE.Vector3, shore = true): [number, number] {
    let a = Math.cos(ang) * rad * g.width, b = Math.sin(ang) * rad * g.width;
    if (shore && this.terrOf(tile) === 'coast') {
      const d = this.shoreDir(tile, g);
      if (d) { a += (d[0] * g.width * 0.6 - a) * 0.3; b += (d[1] * g.width * 0.6 - b) * 0.3; }
    }
    this.geos.point(g, a, b, up, out);
    return [a, b];
  }

  private satScale(q: Rec): number { return (this.terrOf(q.tile) === 'forest' ? 0.7 : 1) * 0.62; }

  // ---- props -----------------------------------------------------------------------------

  private addProp(kind: PropKind, parent: Rec, pos: THREE.Vector3, w: number, h: number, smoke?: Smoke): void {
    const p: PropRec = { kind, parent, pos, quat: parent.g.align.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(parent.id, 40 + parent.props.length) * 6.28)), w, h, smoke, seed: hash01(parent.id, 41 + parent.props.length) };
    parent.props.push(p);
    const list = this.propList.get(kind) ?? [];
    list.push(p);
    this.propList.set(kind, list);
    if (smoke) this.smokers.push(p);
    this.propsDirty = true;
  }

  private dropProps(r: Rec): void {
    for (const p of r.props) {
      const list = this.propList.get(p.kind);
      const i = list ? list.indexOf(p) : -1;
      if (list && i >= 0) list.splice(i, 1);
      const j = this.smokers.indexOf(p);
      if (j >= 0) this.smokers.splice(j, 1);
    }
    r.props = [];
    this.propsDirty = true;
  }

  /** A stone platform under a raised building, and the identity props of a settlement. */
  private addProps(r: Rec): void {
    if (r.parent) return;
    if (r.lift > 0) this.addPlatform(r);
    const tile = this.world.tiles[r.tile];
    if (!tile) return;
    let border = false, coastal = r.terr === 'coast';
    for (const nb of tile.neighbors) {
      const t = this.world.tiles[nb];
      if (!t) continue;
      if (t.terrain === 'ocean') coastal = true;
      else if (this.world.owner[nb] !== r.owner) border = true;
    }
    const id = this.lookOf(r.owner).id;
    const base = r.slot === 0 ? hash01(r.tile, 5) * Math.PI * 2 + 2.4 : hash01(r.id, 5) * Math.PI * 2;
    const out = new THREE.Vector3();
    for (const sp of propsFor({ kind: r.kind, id, border, coastal })) {
      const rad = sp.rad * (TIGHT[r.terr] ?? 1);
      const ra = Math.cos(base + sp.ang) * rad * r.g.width, rb = Math.sin(base + sp.ang) * rad * r.g.width;
      this.geos.point(r.g, r.off[0] + ra, r.off[1] + rb, 0.0004 + r.lift + (sp.lift ?? 0) * r.size, out);
      const w = r.size * sp.scale;
      this.addProp(sp.kind, r, out.clone(), w, w, sp.smoke);
    }
  }

  private addPlatform(r: Rec): void {
    const pos = r.pos.clone().addScaledVector(r.g.n, -0.06 * r.size);
    this.addProp('platform', r, pos, r.size * 0.95, r.lift + 0.06 * r.size);
  }

  // ---- store reconcile -------------------------------------------------------------------

  /** Compare world.structures with what is drawn; animate what is new, changed or gone. */
  sync(now: number): void {
    this.refreshLooks(now);
    updateRuins(this.world); // B14: devastated or sacked provinces draw their buildings as ruins
    const seen = new Set<string>();
    let fresh = 0;
    // A sim ruin makes way (it sinks, then stays hidden) for a wonder or a new building on its tile, so the
    // newcomer never rises inside it; it comes back if the tile empties again.
    const held = new Set<number>();
    for (const s of this.world.structures) if (s.wonder || s.kind !== 'ruin') held.add(s.tile);
    for (const s of this.world.structures) {
      if (s.kind !== 'ruin' || s.wonder || !held.has(s.tile)) continue;
      seen.add(s.id);
      const r = this.recs.get(s.id);
      if (r && r.anim?.type !== 'destroy') this.sink(r, now);
    }
    for (const s of this.world.structures) {
      if (s.tile < 0 || s.tile >= this.world.tiles.length) continue;
      if ((s.kind as string) === 'wonder' || s.wonder) continue; // wonders, razed or not, are drawn by globe/wonders
      if (s.kind === 'ruin' && held.has(s.tile)) continue;
      seen.add(s.id);
      const r = this.recs.get(s.id);
      if (!r) {
        const delay = this.first ? hash01(s.id, 3) * 1.0 : Math.min(fresh * 0.08, 0.8);
        fresh++;
        this.add(s.id, s.tile, s.owner, shownKind(s), now + delay);
      } else if (r.anim?.type === 'destroy') {
        continue;
      } else {
        const kind = shownKind(s);
        if (r.kind !== kind) this.upgrade(r, kind, now);
        if (r.owner !== s.owner) {
          r.owner = s.owner;
          this.rebuild(r);
        }
      }
    }
    for (const r of this.recs.values()) if (!seen.has(r.id) && r.anim?.type !== 'destroy') this.sink(r, now);
    this.first = false;
    logMisses(this.models);
  }

  /** Start a structure's sink-and-fade; it is removed when that ends. */
  private sink(r: Rec, now: number): void {
    r.anim = { type: 'destroy', t0: now };
    this.puff(r, now);
    r.pool.dirty = true;
    for (const q of r.sats) q.pool.dirty = true;
    this.updateTrees(r.tile);
  }

  private add(id: string, tile: number, owner: number, kind: string, t0: number): void {
    const g = this.geos.get(tile);
    const here = this.byTile.get(tile) ?? [];
    // Whatever is still sinking on the tile gives up its slot, and the newcomer rises once it is gone.
    let slot = 0;
    for (const x of here) if (x.anim?.type === 'destroy') t0 = Math.max(t0, x.anim.t0 + DESTROY_S);
    while (here.some((x) => x.slot === slot && x.anim?.type !== 'destroy')) slot++;
    const terr = this.terrOf(tile);
    const style = this.styleOf(owner);
    const size = this.sizeOf(tile, g, kind, slot, id, owner, style);
    const lift = (LIFT0[terr] ?? 0) * size;
    const pos = new THREE.Vector3();
    let off: [number, number] = [0, 0];
    if (slot === 0) this.geos.point(g, 0, 0, 0.0004 + lift, pos);
    else {
      const ang = hash01(tile, 5) * Math.PI * 2 + slot * 2.4;
      const rad = Math.max(SAT_MIN_RAD, (0.27 + 0.05 * hash01(id, 6)) * (TIGHT[terr] ?? 1));
      off = this.spot(tile, g, ang, rad, 0.0004 + lift, pos);
    }
    const pool = this.poolFor(kind, owner, style);
    const rec: Rec = {
      id, tile, owner, kind, slot, pool, g, pos, quat: new THREE.Quaternion(), size, anim: { type: 'build', t0 },
      hy: 1, parent: null, sats: [], terr, off, lift, props: [], style,
    };
    rec.hy = this.hyOf(rec);
    rec.quat = this.orient(rec);
    here.push(rec);
    this.byTile.set(tile, here);
    this.recs.set(id, rec);
    pool.list.push(rec);
    pool.dirty = true;
    this.addSats(rec);
    this.addProps(rec);
    this.publish(rec);
    this.puff(rec, t0 + BUILD_S * 0.35);
    this.updateTrees(tile);
  }

  private sizeOf(tile: number, g: TileGeo, kind: string, slot: number, id: string, owner: number, style: string): number {
    const jit = 0.88 + 0.24 * hash01(id, 11);
    const look = this.lookOf(owner);
    let k = (REL[kind] ?? REL_OTHER) * (slot > 0 ? 0.8 : 1);
    if (kind === 'temple' && look.id.gov === 'theocracy') k *= 1.25;
    if (this.terrOf(tile) === 'ice') k *= 0.8;
    const s = g.width * modelFor(this.models, kind, this.world.countries[owner], style).footprint * k * jit;
    return Math.min(s, MAX_SIZE * g.h);
  }

  /** Cities and capitals get smaller buildings around them (more in later eras), stepped up on mountains. */
  private addSats(r: Rec): void {
    if (r.slot !== 0 || (r.kind !== 'city' && r.kind !== 'capital')) return;
    const era = this.lookOf(r.owner).era;
    const n = r.kind === 'capital' ? era.capitalSats : era.citySats;
    const kinds: string[] = [];
    if (r.kind === 'capital') {
      if (n >= 2 && hasModel(this.models, 'temple', this.world.countries[r.owner], r.style)) kinds.push('temple');
      if (n >= 3 && hasModel(this.models, 'fort', this.world.countries[r.owner], r.style)) kinds.push('fort');
    }
    for (let i = kinds.length; i < n; i++) kinds.push(hash01(r.id, 14 + i) < 0.5 ? 'town' : 'village');
    const terr = r.terr;
    const tight = TIGHT[terr] ?? 1;
    const step = RING_LIFT[terr] ?? 0;
    const base = hash01(r.tile, 5) * Math.PI * 2 + 2.4 + Math.PI; // opposite the first extra building
    // The centre building's square (half side in tile widths, x axis in t1/t2): the small ones stand clear of it.
    const lh = r.size / 2 / r.g.width;
    const lx = this.v.set(1, 0, 0).applyQuaternion(r.quat).dot(r.g.t1), ly = this.v.dot(r.g.t2);
    const ll = Math.hypot(lx, ly) || 1;
    kinds.forEach((kind, i) => {
      const pool = this.poolFor(kind, r.owner, r.style);
      const id = `${r.id}#${i}`;
      const ang = base + (i - (kinds.length - 1) / 2) * (Math.PI * 1.5 / kinds.length) + (hash01(id, 15) - 0.5) * 0.4;
      const ring = step ? i % 2 : (n > 4 ? i % 2 : 0);   // two rings: terraces on slopes, a second row in dense eras
      const frac = step ? 0.42 + 0.17 * ring : (0.56 + 0.08 * hash01(id, 16) + (n > 4 ? 0.1 * ring : 0)) * tight;
      const pos = new THREE.Vector3();
      const sat: Rec = {
        id, tile: r.tile, owner: r.owner, kind, slot: -1, pool, g: r.g, pos, quat: new THREE.Quaternion(),
        size: 0, anim: null, hy: 1, parent: r, sats: [], terr, off: [0, 0], lift: 0, props: [], style: r.style,
      };
      sat.size = this.sizeOf(r.tile, r.g, kind, 0, id, r.owner, r.style) * this.satScale(sat);
      // Far enough out along its direction to clear the centre square (its own square at any turn, 1.25 x half);
      // if that would leave the tile, it is drawn smaller instead.
      const ux = (Math.cos(ang) * lx + Math.sin(ang) * ly) / ll, uy = (Math.sin(ang) * lx - Math.cos(ang) * ly) / ll;
      const reach = lh * (Math.abs(ux) + Math.abs(uy));
      const sh = sat.size / 2 / r.g.width;
      if (reach + sh * 1.25 > SAT_MAX_RAD) sat.size *= Math.max(0.45, (SAT_MAX_RAD - reach) / (sh * 1.25));
      const rad = Math.min(SAT_MAX_RAD, Math.max(SAT_MIN_RAD, frac, reach + (sat.size / 2 / r.g.width) * 1.25));
      sat.lift = (LIFT0[terr] ?? 0) * sat.size + step * ring * r.g.width;
      sat.off = this.spot(r.tile, r.g, ang, rad, 0.0004 + sat.lift, pos, false);
      sat.quat = this.orient(sat);
      sat.hy = this.hyOf(sat);
      r.sats.push(sat);
      pool.list.push(sat);
      pool.dirty = true;
      if (sat.lift > 0) this.addPlatform(sat);
    });
  }

  private dropSats(r: Rec): void {
    for (const s of r.sats) {
      this.dropProps(s);
      const pool = s.pool;
      const i = pool.list.indexOf(s);
      if (i >= 0) pool.list.splice(i, 1);
      pool.dirty = true;
    }
    r.sats = [];
  }

  private upgrade(r: Rec, kind: string, now: number): void {
    const from = r.pool;
    const to = this.poolFor(kind, r.owner, r.style);
    const i = from.list.indexOf(r);
    if (i >= 0) from.list.splice(i, 1);
    from.dirty = true;
    this.dropSats(r);
    this.dropProps(r);
    r.kind = kind;
    r.size = this.sizeOf(r.tile, r.g, kind, r.slot, r.id, r.owner, r.style);
    r.hy = this.hyOf(r);
    r.pool = to;
    r.anim = { type: 'upgrade', t0: now };
    to.list.push(r);
    to.dirty = true;
    this.addSats(r);
    this.addProps(r);
    this.publish(r);
    this.puff(r, now + 0.1);
    this.updateTrees(r.tile);
  }

  private remove(r: Rec): void {
    this.dropSats(r);
    this.dropProps(r);
    const pool = r.pool;
    const i = pool.list.indexOf(r);
    if (i >= 0) pool.list.splice(i, 1);
    pool.dirty = true;
    this.recs.delete(r.id);
    setFeet(r.tile, r.id, null);
    const here = this.byTile.get(r.tile);
    if (here) {
      const j = here.indexOf(r);
      if (j >= 0) here.splice(j, 1);
      if (!here.length) this.byTile.delete(r.tile);
    }
    this.updateTrees(r.tile);
  }

  private updateTrees(tile: number): void {
    let level = 0;
    for (const r of this.byTile.get(tile) ?? []) {
      if (r.anim?.type === 'destroy') continue;
      level = Math.max(level, r.kind === 'city' || r.kind === 'capital' ? 2 : 1);
    }
    this.trees.setLevel(tile, level);
  }

  private puff(r: Rec, t0: number): void {
    if (this.puffs.length >= PUFF_POOL) this.puffs.shift();
    this.puffs.push({ t0, pos: r.pos.clone(), g: r.g, size: r.size, seed: hash01(r.id, 9) * 6.28 });
  }

  // ---- per frame -------------------------------------------------------------------------

  update(now: number, dt: number, camDist: number): void {
    const target = smoothstep(CLOSE + 0.2, CLOSE - 0.2, camDist);
    this.f += (target - this.f) * Math.min(1, dt * 7);
    if (Math.abs(target - this.f) < 0.003) this.f = target;
    // the ends count exactly: at 0 the small kinds and the props stop being drawn at all
    if (now >= this.swapAt) this.runSwaps(now);
    const fChanged = Math.abs(this.f - this.writtenF) > 0.0015 || (this.f !== this.writtenF && (this.f === 0 || this.f === 1));
    let wrote = false;
    for (const pool of this.pools.values()) {
      if (pool.dirty || fChanged) { this.write(pool, now, true); wrote = true; }
      else if (pool.moving) { this.write(pool, now, false); wrote = true; }
    }
    if (fChanged) this.writtenF = this.f;
    if (wrote || this.propsDirty) this.writeProps(now);
    this.updateSmoke(now);
    this.trees.update(this.f);
    this.updatePuffs(now);
  }

  /**
   * Write a pool's instances. `full` rewrites every matrix and colour; otherwise only the instances mid pop-up
   * are rewritten and only that span of the matrix buffer is uploaded. A pool that draws nothing is hidden and
   * only its animation bookkeeping runs.
   */
  private write(pool: Pool, now: number, full: boolean): void {
    if (pool.list.length > pool.cap) {
      let cap = pool.cap;
      while (cap < pool.list.length) cap *= 2;
      this.alloc(pool, cap);
      full = true;
    }
    const f = this.f;
    const big = BIG.has(pool.kind);
    const base = big ? 1 + (ORBIT_BOOST - 1) * (1 - f) : f; // big ones show from orbit, scaled up
    const shown = base > 0 && pool.list.length > 0;
    let animating = false;
    let done: Rec[] | null = null;
    let lo = Infinity, hi = -1;
    const { m, sc, v } = this;
    const list = pool.list, meshes = pool.meshes, parts = pool.parts;
    pool.dirty = false; // cleared first: finishing an animation below may mark this pool again
    for (let i = 0; i < list.length; i++) {
      const r = list[i]!;
      let sx = 1, sy = 1, sink = 0;
      const a = (r.parent ?? r).anim;
      if (!a && !full) continue;
      if (a) {
        const dur = a.type === 'build' ? BUILD_S : a.type === 'upgrade' ? UPGRADE_S : DESTROY_S;
        const raw = (now - a.t0) / dur;
        if (raw < 0) { sx = sy = 0; animating = true; }
        else if (raw >= 1) {
          if (a.type === 'destroy') { if (!r.parent) (done ??= []).push(r); sx = sy = 0; }
          else if (!r.parent) {
            r.anim = null;
            for (const q of r.sats) q.pool.dirty = true; // its small buildings settle at full size on the next write
          }
        } else {
          animating = true;
          if (a.type === 'build') sx = sy = Math.max(0, easeOutBack(raw));
          else if (a.type === 'upgrade') { const k = easeOutBack(clamp01(raw)); sy = 0.45 + 0.55 * k; sx = 1.4 - 0.4 * k; }
          else { const k = raw * raw; sx = sy = 1 - k; sink = raw * 0.5 * r.size; }
        }
      }
      if (!shown) continue;
      const s = r.size * base;
      sc.set(s * sx, s * sy * r.hy, s * sx);
      v.copy(r.pos).addScaledVector(r.g.n, -sink);
      m.compose(v, r.quat, sc);
      for (let k = 0; k < meshes.length; k++) meshes[k]!.setMatrixAt(i, m);
      if (i < lo) lo = i;
      if (i > hi) hi = i;
      if (!full) continue;
      const look = this.lookOf(r.owner);
      let tint = look.tint;
      if (r.terr === 'ice') tint = this.tmpC.copy(tint).lerp(WHITE, 0.25);
      if (r.kind === 'ruin') tint = this.tmpC.copy(tint).multiplyScalar(0.42); // B14: burnt and grey
      for (let k = 0; k < meshes.length; k++) meshes[k]!.setColorAt(i, parts[k]!.team ? look.team : tint);
    }
    for (const mesh of meshes) {
      mesh.visible = shown;
      if (!shown) continue;
      mesh.count = list.length;
      if (full) {
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      } else if (hi >= lo) {
        mesh.instanceMatrix.addUpdateRange(lo * 16, (hi - lo + 1) * 16);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    pool.moving = animating;
    if (done) for (const r of done) this.remove(r);
  }

  /** Scale factors of a record's pop-up animation, without changing it. */
  private animOf(r: Rec, now: number): { sx: number; sy: number; sink: number } {
    const a = (r.parent ?? r).anim;
    if (!a) return { sx: 1, sy: 1, sink: 0 };
    const dur = a.type === 'build' ? BUILD_S : a.type === 'upgrade' ? UPGRADE_S : DESTROY_S;
    const raw = (now - a.t0) / dur;
    if (raw < 0) return { sx: 0, sy: 0, sink: 0 };
    if (raw >= 1) return a.type === 'destroy' ? { sx: 0, sy: 0, sink: 0 } : { sx: 1, sy: 1, sink: 0 };
    if (a.type === 'build') { const k = Math.max(0, easeOutBack(raw)); return { sx: k, sy: k, sink: 0 }; }
    if (a.type === 'upgrade') { const k = easeOutBack(clamp01(raw)); return { sx: 1.4 - 0.4 * k, sy: 0.45 + 0.55 * k, sink: 0 }; }
    return { sx: 1 - raw * raw, sy: 1 - raw * raw, sink: raw * 0.5 * r.size };
  }

  /** Identity props and platforms: one InstancedMesh per prop part, rewritten when anything moved. */
  private writeProps(now: number): void {
    const { m, sc, v } = this;
    const vis = smoothstep(0.05, 0.5, this.f);
    let animating = false;
    for (const [kind, list] of this.propList) {
      const parts = this.propSet[kind];
      let pp = this.propPools.get(kind);
      if (!pp || pp.cap < list.length) {
        if (pp) for (const mm of pp.meshes) { this.group.remove(mm); mm.dispose(); }
        let cap = Math.max(8, pp?.cap ?? 8);
        while (cap < list.length) cap *= 2;
        pp = {
          cap,
          meshes: parts.map((part) => {
            const mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
            mesh.frustumCulled = false;
            mesh.count = 0;
            mesh.visible = false;
            this.group.add(mesh);
            return mesh;
          }),
        };
        this.propPools.set(kind, pp);
      }
      // Props other than platforms are scaled by `vis`: from orbit they are nothing, so they are not drawn (B8).
      const shown = list.length > 0 && (kind === 'platform' || vis > 0);
      for (const mesh of pp.meshes) mesh.visible = shown;
      if (!shown) continue;
      list.forEach((p, i) => {
        const r = p.parent;
        const an = this.animOf(r, now);
        if ((r.parent ?? r).anim) animating = true;
        const base = BIG.has(r.pool.kind) ? 1 + (ORBIT_BOOST - 1) * (1 - this.f) : this.f;
        const k = (kind === 'platform' ? base : base * vis);
        sc.set(p.w * an.sx * k, p.h * an.sy * k, p.w * an.sx * k);
        v.copy(p.pos).addScaledVector(r.g.n, -an.sink);
        m.compose(v, p.quat, sc);
        const look = this.lookOf(r.owner);
        pp!.meshes.forEach((mesh, j) => {
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, parts[j]!.team ? look.team : parts[j]!.color);
        });
      });
      for (const mesh of pp.meshes) {
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    this.propsDirty = animating;
  }

  /** Chimney and barrel smoke: a few puffs per stack looping upwards, only when zoomed in. */
  private updateSmoke(now: number): void {
    const mesh = this.smokeMesh;
    if (!this.smokers.length || this.f < 0.3) { mesh.count = 0; mesh.visible = false; return; }
    const { m, sc, v } = this;
    let n = 0;
    for (const p of this.smokers) {
      const an = this.animOf(p.parent, now);
      const puffs = p.smoke!.puffs;
      this.col.set(p.smoke!.color);
      for (let j = 0; j < puffs && n < MAX_SMOKE; j++) {
        const u = (now * 0.28 + j / puffs + p.seed) % 1;
        v.copy(p.pos).addScaledVector(p.parent.g.n, p.h * (0.85 + 1.3 * u)).addScaledVector(p.parent.g.t1, p.h * 0.25 * u);
        sc.setScalar(p.h * (0.07 + 0.15 * u) * (1 - u * u) * an.sx * this.f);
        m.compose(v, IDENT, sc);
        mesh.setMatrixAt(n, m);
        mesh.setColorAt(n, this.col);
        n++;
      }
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private updatePuffs(now: number): void {
    const mesh = this.puffMesh;
    const live = this.puffs.some((p) => now - p.t0 < PUFF_S);
    if (!live && !this.puffLive) return;
    this.puffLive = live;
    this.puffs = this.puffs.filter((p) => now - p.t0 < PUFF_S + 2);
    const { m, sc, v } = this;
    let n = 0;
    for (const p of this.puffs) {
      const u = (now - p.t0) / PUFF_S;
      for (let j = 0; j < PUFF_PARTS; j++) {
        let s = 0;
        if (u >= 0 && u < 1) {
          const ang = p.seed + (j / PUFF_PARTS) * Math.PI * 2;
          const e = 1 - (1 - u) * (1 - u);
          const r = p.size * (0.25 + 0.7 * e);
          const lift = p.size * 0.22 * Math.sin(u * Math.PI);
          v.copy(p.pos).addScaledVector(p.g.t1, Math.cos(ang) * r).addScaledVector(p.g.t2, Math.sin(ang) * r).addScaledVector(p.g.n, lift);
          s = p.size * 0.14 * Math.pow(1 - u, 0.8) * (0.8 + 0.4 * hash01(j, Math.floor(p.seed * 100)));
          s *= 0.4 + 0.6 * Math.max(this.f, BIG_VISIBLE);
        } else v.copy(p.pos);
        sc.setScalar(s);
        m.compose(v, IDENT, sc);
        mesh.setMatrixAt(n++, m);
      }
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const pool of this.pools.values()) for (const m of pool.meshes) m.dispose();
    this.puffMesh.geometry.dispose();
    (this.puffMesh.material as THREE.Material).dispose();
    this.puffMesh.dispose();
    this.trees.dispose();
    for (const pp of this.propPools.values()) for (const mm of pp.meshes) mm.dispose();
    disposePropSet(this.propSet);
    this.smokeMesh.geometry.dispose();
    (this.smokeMesh.material as THREE.Material).dispose();
    this.smokeMesh.dispose();
    this.group.clear();
    clearOccupancy();
  }
}

const IDENT = new THREE.Quaternion();
const WHITE = new THREE.Color('#ffffff');
const BIG_VISIBLE = 0.6;
