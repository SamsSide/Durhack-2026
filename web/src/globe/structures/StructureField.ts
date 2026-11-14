// All structures of a world: one InstancedMesh per (kind, sub-mesh), pop-up animations, dust puffs, LOD.
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { hasModel, modelFor, STRUCTURE_KINDS } from './models';
import type { ModelPart, ModelSet } from './models';
import { clamp01, easeOutBack, hash01, smoothstep } from './placement';
import type { TileGeo, TileGeos } from './placement';
import { Trees } from './Trees';
import { CLOSE } from '../constants';

const BIG = new Set<string>(['capital', 'city', 'town']);
const SETTLEMENT = new Set<string>(['camp', 'village', 'town', 'city', 'capital']);
const BUILD_S = 0.6, UPGRADE_S = 0.55, DESTROY_S = 0.5, PUFF_S = 0.75;
const PUFF_POOL = 40, PUFF_PARTS = 6;
const ORBIT_BOOST = 1.15;
// Relative scale by kind on top of the manifest footprint: a clear camp-to-capital hierarchy.
const REL: Record<string, number> = { camp: 0.45, village: 0.6, town: 0.75, city: 0.9, capital: 1.0 };
const REL_OTHER = 0.7;
const MAX_SIZE = 0.07;   // absolute cap (times surface radius) so nothing towers over a mountain

interface Anim { type: 'build' | 'upgrade' | 'destroy'; t0: number }
interface Rec {
  id: string; tile: number; owner: number; kind: string; slot: number;
  g: TileGeo; pos: THREE.Vector3; quat: THREE.Quaternion; size: number; anim: Anim | null;
  hy: number;               // stable height stretch
  parent: Rec | null;       // set for the small buildings around a city or capital
  sats: Rec[];
}
interface Pool { kind: string; parts: ModelPart[]; meshes: THREE.InstancedMesh[]; cap: number; list: Rec[]; dirty: boolean }
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
  private tints = new Map<number, THREE.Color>();
  private colors = new Map<string, THREE.Color>();
  private m = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private col = new THREE.Color();

  constructor(private world: World, private geos: TileGeos, private models: ModelSet) {
    for (const kind of STRUCTURE_KINDS) {
      const pool: Pool = { kind, parts: modelFor(models, kind).parts, meshes: [], cap: 0, list: [], dirty: false };
      this.pools.set(kind, pool);
      this.alloc(pool, 32);
    }
    this.trees = new Trees(world, geos, models);
    this.group.add(this.trees.group);
    const puffGeo = new THREE.IcosahedronGeometry(1, 0);
    const puffMat = new THREE.MeshStandardMaterial({ color: '#e6dcc3', flatShading: true, roughness: 1 });
    this.puffMesh = new THREE.InstancedMesh(puffGeo, puffMat, PUFF_POOL * PUFF_PARTS);
    this.puffMesh.frustumCulled = false;
    this.puffMesh.count = 0;
    this.group.add(this.puffMesh);
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
      this.group.add(mesh);
      return mesh;
    });
    pool.dirty = true;
  }

  /** Per-nation multiplier for wall and roof colours: small hue and lightness shift from the country id. */
  private tintOf(owner: number): THREE.Color {
    let c = this.tints.get(owner);
    if (!c) {
      c = new THREE.Color(1, 1, 1).lerp(new THREE.Color().setHSL(hash01(owner, 31), 0.55, 0.55), 0.14);
      c.multiplyScalar(0.92 + 0.16 * hash01(owner, 32));
      this.tints.set(owner, c);
    }
    return c;
  }

  private colorOf(owner: number): THREE.Color {
    const css = this.world.countries[owner]?.color ?? '#b8b0a0';
    let c = this.colors.get(css);
    if (!c) { c = new THREE.Color(css); this.colors.set(css, c); }
    return c;
  }

  // ---- store reconcile -------------------------------------------------------------------

  /** Compare world.structures with what is drawn; animate what is new, changed or gone. */
  sync(now: number): void {
    const seen = new Set<string>();
    let fresh = 0;
    for (const s of this.world.structures) {
      if (s.tile < 0 || s.tile >= this.world.tiles.length) continue;
      seen.add(s.id);
      const r = this.recs.get(s.id);
      if (!r) {
        const delay = this.first ? hash01(s.id, 3) * 1.0 : Math.min(fresh * 0.08, 0.8);
        fresh++;
        this.add(s.id, s.tile, s.owner, s.kind, now + delay);
      } else if (r.anim?.type === 'destroy') {
        continue;
      } else {
        if (r.kind !== s.kind) this.upgrade(r, s.kind, now);
        if (r.owner !== s.owner) {
          r.owner = s.owner; this.pools.get(r.kind)!.dirty = true;
          for (const q of r.sats) { q.owner = s.owner; this.pools.get(q.kind)!.dirty = true; }
        }
      }
    }
    for (const r of this.recs.values()) {
      if (!seen.has(r.id) && r.anim?.type !== 'destroy') {
        r.anim = { type: 'destroy', t0: now };
        this.puff(r, now);
        this.pools.get(r.kind)!.dirty = true;
        for (const q of r.sats) this.pools.get(q.kind)!.dirty = true;
        this.updateTrees(r.tile);
      }
    }
    this.first = false;
  }

  private add(id: string, tile: number, owner: number, kind: string, t0: number): void {
    const g = this.geos.get(tile);
    const here = this.byTile.get(tile) ?? [];
    let slot = 0;
    while (here.some((x) => x.slot === slot)) slot++;
    const pos = new THREE.Vector3();
    if (slot === 0) this.geos.point(g, 0, 0, 0.0004, pos);
    else {
      const ang = hash01(tile, 5) * Math.PI * 2 + slot * 2.4;
      const rad = g.width * (0.27 + 0.05 * hash01(id, 6));
      this.geos.point(g, Math.cos(ang) * rad, Math.sin(ang) * rad, 0.0004, pos);
    }
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(id, 7) * Math.PI * 2);
    const rec: Rec = {
      id, tile, owner, kind, slot, g, pos, quat: g.align.clone().multiply(yaw),
      size: this.sizeOf(g, kind, slot, id), anim: { type: 'build', t0 },
      hy: 0.9 + 0.2 * hash01(id, 12), parent: null, sats: [],
    };
    here.push(rec);
    this.byTile.set(tile, here);
    this.recs.set(id, rec);
    const pool = this.pools.get(kind);
    if (!pool) { this.recs.delete(id); here.pop(); return; }
    pool.list.push(rec);
    pool.dirty = true;
    this.addSats(rec);
    this.puff(rec, t0 + BUILD_S * 0.35);
    this.updateTrees(tile);
  }

  private sizeOf(g: TileGeo, kind: string, slot: number, id: string): number {
    const jit = 0.88 + 0.24 * hash01(id, 11);
    const s = g.width * modelFor(this.models, kind).footprint * (REL[kind] ?? REL_OTHER) * (slot > 0 ? 0.8 : 1) * jit;
    return Math.min(s, MAX_SIZE * g.h);
  }

  /** Cities and capitals get smaller buildings around them so a settlement reads as a place. */
  private addSats(r: Rec): void {
    if (r.slot !== 0 || (r.kind !== 'city' && r.kind !== 'capital')) return;
    const kinds: string[] = [];
    const n = 2 + Math.floor(hash01(r.id, 13) * 2);
    for (let i = 0; i < n; i++) kinds.push(hash01(r.id, 14 + i) < 0.5 ? 'town' : 'village');
    if (r.kind === 'capital') for (const k of ['fort', 'temple']) if (hasModel(this.models, k)) kinds.push(k);
    const base = hash01(r.tile, 5) * Math.PI * 2 + 2.4 + Math.PI; // opposite the first extra building
    kinds.forEach((kind, i) => {
      const pool = this.pools.get(kind);
      if (!pool) return;
      const id = `${r.id}#${i}`;
      const ang = base + (i - (kinds.length - 1) / 2) * (Math.PI * 1.5 / kinds.length) + (hash01(id, 15) - 0.5) * 0.4;
      const rad = r.g.width * (0.56 + 0.08 * hash01(id, 16));
      const pos = new THREE.Vector3();
      this.geos.point(r.g, Math.cos(ang) * rad, Math.sin(ang) * rad, 0.0004, pos);
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(id, 7) * Math.PI * 2);
      const sat: Rec = {
        id, tile: r.tile, owner: r.owner, kind, slot: -1, g: r.g, pos, quat: r.g.align.clone().multiply(yaw),
        size: this.sizeOf(r.g, kind, 0, id) * 0.62, anim: null, hy: 0.9 + 0.2 * hash01(id, 12), parent: r, sats: [],
      };
      r.sats.push(sat);
      pool.list.push(sat);
      pool.dirty = true;
    });
  }

  private dropSats(r: Rec): void {
    for (const s of r.sats) {
      const pool = this.pools.get(s.kind)!;
      const i = pool.list.indexOf(s);
      if (i >= 0) pool.list.splice(i, 1);
      pool.dirty = true;
    }
    r.sats = [];
  }

  private upgrade(r: Rec, kind: string, now: number): void {
    const from = this.pools.get(r.kind)!;
    const to = this.pools.get(kind);
    if (!to) return;
    const i = from.list.indexOf(r);
    if (i >= 0) from.list.splice(i, 1);
    from.dirty = true;
    this.dropSats(r);
    r.kind = kind;
    r.size = this.sizeOf(r.g, kind, r.slot, r.id);
    r.anim = { type: 'upgrade', t0: now };
    to.list.push(r);
    to.dirty = true;
    this.addSats(r);
    this.puff(r, now + 0.1);
    this.updateTrees(r.tile);
  }

  private remove(r: Rec): void {
    this.dropSats(r);
    const pool = this.pools.get(r.kind)!;
    const i = pool.list.indexOf(r);
    if (i >= 0) pool.list.splice(i, 1);
    pool.dirty = true;
    this.recs.delete(r.id);
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
    const fChanged = Math.abs(this.f - this.writtenF) > 0.0015;
    for (const pool of this.pools.values()) {
      if (pool.dirty || fChanged) this.write(pool, now);
    }
    if (fChanged) this.writtenF = this.f;
    this.trees.update(this.f);
    this.updatePuffs(now);
  }

  private write(pool: Pool, now: number): void {
    if (pool.list.length > pool.cap) {
      let cap = pool.cap;
      while (cap < pool.list.length) cap *= 2;
      this.alloc(pool, cap);
    }
    const f = this.f;
    const big = BIG.has(pool.kind);
    const base = big ? 1 + (ORBIT_BOOST - 1) * (1 - f) : f; // big ones show from orbit, scaled up
    let animating = false;
    const done: Rec[] = [];
    const { m, sc, v } = this;
    pool.list.forEach((r, i) => {
      let sx = 1, sy = 1, sink = 0;
      const a = (r.parent ?? r).anim;
      if (a) {
        const dur = a.type === 'build' ? BUILD_S : a.type === 'upgrade' ? UPGRADE_S : DESTROY_S;
        const raw = (now - a.t0) / dur;
        if (raw < 0) { sx = sy = 0; animating = true; }
        else if (raw >= 1) {
          if (a.type === 'destroy') { if (!r.parent) done.push(r); sx = sy = 0; } else if (!r.parent) { r.anim = null; }
        } else {
          animating = true;
          if (a.type === 'build') sx = sy = Math.max(0, easeOutBack(raw));
          else if (a.type === 'upgrade') { const k = easeOutBack(clamp01(raw)); sy = 0.45 + 0.55 * k; sx = 1.4 - 0.4 * k; }
          else { const k = raw * raw; sx = sy = 1 - k; sink = raw * 0.5 * r.size; }
        }
      }
      const s = r.size * base;
      sc.set(s * sx, s * sy * r.hy, s * sx);
      v.copy(r.pos).addScaledVector(r.g.n, -sink);
      m.compose(v, r.quat, sc);
      for (const mesh of pool.meshes) mesh.setMatrixAt(i, m);
      const team = this.colorOf(r.owner), tint = this.tintOf(r.owner);
      pool.meshes.forEach((mesh, k) => mesh.setColorAt(i, pool.parts[k]!.team ? team : tint));
    });
    pool.meshes.forEach((mesh) => {
      mesh.count = pool.list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    pool.dirty = animating;
    for (const r of done) this.remove(r);
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
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const pool of this.pools.values()) for (const m of pool.meshes) m.dispose();
    this.puffMesh.geometry.dispose();
    (this.puffMesh.material as THREE.Material).dispose();
    this.puffMesh.dispose();
    this.trees.dispose();
    this.group.clear();
  }
}

const IDENT = new THREE.Quaternion();
const BIG_VISIBLE = 0.6;
