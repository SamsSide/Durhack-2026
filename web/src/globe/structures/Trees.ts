// Decorative trees on forest tiles (a few on plains and hills): a variant per tree from the tile's climate,
// one InstancedMesh per variant sub-mesh.
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { footprintFor, partsFor } from './models';
import type { ModelSet } from './models';
import { hash01 } from './placement';
import type { TileGeos } from './placement';

interface Tree { tile: number; pos: THREE.Vector3; quat: THREE.Quaternion; size: number; inner: boolean; seed: number; kind: number; slot: number }

/** Tree variants in the manifest's `trees` section (assets/blender/trees_defs.py); any that is missing falls back to `tree`. */
const VARIANTS = ['oak', 'pine', 'snowpine', 'poplar', 'palm', 'acacia', 'birch', 'bush'] as const;
type Variant = (typeof VARIANTS)[number];
/** Colour of a variant's `team` part: fruit, coconuts, berries. */
const ACCENT: Partial<Record<Variant, string>> = { oak: '#c2452f', palm: '#6e4a2c', bush: '#b5304a' };
const TREE_FOOTPRINT = 0.22; // one model unit (a full-height tree) as a share of the tile width: about three houses tall
type Mix = [Variant, number][];

/** Which trees grow on a tile, with weights, from its latitude, height and neighbours (the tile carries no climate). */
function mixFor(world: World, t: World['tiles'][number]): Mix {
  const len = Math.hypot(t.center[0], t.center[1], t.center[2]) || 1;
  const lat = Math.abs(t.center[1]) / len;
  let ice = false, dry = t.terrain === 'desert', sea = t.terrain === 'coast', high = t.terrain === 'hills' && t.elevation > 0.62;
  for (const n of t.neighbors) {
    const k = world.tiles[n]?.terrain;
    if (k === 'ice') ice = true;
    else if (k === 'desert') dry = true;
    else if (k === 'coast' || k === 'ocean') sea = true;
    else if (k === 'mountain') high = true;
  }
  let mix: Mix;
  if (ice || lat > 0.74) mix = [['snowpine', 5], ['pine', 3], ['birch', 1]];
  else if (lat > 0.56 || (high && lat > 0.4)) mix = [['pine', 5], ['birch', 3], ['snowpine', high ? 2 : 0.5], ['bush', 1]];
  else if (lat < 0.32) mix = dry ? [['acacia', 6], ['bush', 2], ['palm', sea ? 4 : 1]] : [['oak', 4], ['palm', sea ? 5 : 2.5], ['poplar', 1], ['bush', 1.5]];
  else if (dry) mix = [['acacia', 3], ['poplar', 3], ['oak', 2], ['bush', 2]];
  else mix = [['oak', 5], ['birch', 2], ['poplar', 2], ['pine', high ? 5 : 1], ['bush', 2]];
  // One kind leads on each tile, so a forest reads as a wood of something with others mixed in.
  const lead = Math.floor(hash01(t.id, 31) * Math.min(2, mix.length));
  return mix.map(([v, w], i) => [v, i === lead ? w * 2.5 : w]);
}
function pick(mix: Mix, u: number): Variant {
  let total = 0;
  for (const [, w] of mix) total += w;
  let x = u * total;
  for (const [v, w] of mix) { x -= w; if (x <= 0) return v; }
  return mix[0]![0];
}

export class Trees {
  readonly group = new THREE.Group();
  private items: Tree[] = [];
  private meshes: THREE.InstancedMesh[][] = []; // per variant, one InstancedMesh per sub-mesh
  private tints: THREE.Material[] = [];
  private level = new Map<number, number>(); // tile -> 0 none, 1 any structure, 2 city or capital
  private dirty = true;
  private lastF = -1;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private yaw = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(world: World, geos: TileGeos, models: ModelSet) {
    const varied = VARIANTS.some((v) => models.parts.has(`tree:${v}`));
    const base = varied ? TREE_FOOTPRINT : footprintFor(models, 'tree') * 1.4;
    const counts = VARIANTS.map(() => 0);
    const p = new THREE.Vector3();
    for (const t of world.tiles) {
      let count = 0;
      if (t.terrain === 'forest') count = varied ? 16 + hash01(t.id, 11) * 10 : 3 + Math.floor(hash01(t.id, 11) * 4);
      else if ((t.terrain === 'plains' || t.terrain === 'hills') && hash01(t.id, 12) < 0.4) count = varied ? 2 + hash01(t.id, 13) * 4 : 1 + Math.floor(hash01(t.id, 13) * 2);
      if (!count) continue;
      const g = geos.get(t.id);
      // The variant counts are for a big province (a 300-province world); smaller ones get fewer, by area.
      if (varied) count = Math.max(t.terrain === 'forest' ? 4 : 1, Math.round(count * Math.min(1.25, (g.width / 0.12) ** 2)));
      const mix = mixFor(world, t);
      for (let i = 0; i < count; i++) {
        const seed = t.id * 64 + i;
        const ang = hash01(seed, 21) * Math.PI * 2;
        const r = (g.width * 1.4) * (0.06 + 0.4 * Math.sqrt(hash01(seed, 22)));
        geos.point(g, Math.cos(ang) * r, Math.sin(ang) * r, 0, p);
        const quat = g.align.clone().multiply(new THREE.Quaternion().setFromAxisAngle(this.up, hash01(seed, 23) * Math.PI * 2));
        const kind = varied ? VARIANTS.indexOf(pick(mix, hash01(seed, 26))) : 0;
        this.items.push({ tile: t.id, pos: p.clone(), quat, size: g.width * base * (0.8 + 0.45 * hash01(seed, 24)), inner: r < (g.width * 1.4) * 0.26, seed, kind, slot: counts[kind]!++ });
      }
    }
    VARIANTS.forEach((v, k) => {
      const list: THREE.InstancedMesh[] = [];
      this.meshes.push(list);
      if (!counts[k]) return;
      for (const part of models.parts.get(`tree:${v}`) ?? partsFor(models, 'tree')) {
        let material = part.material;
        if (part.team && varied && ACCENT[v]) {
          material = part.material.clone();
          (material as THREE.MeshStandardMaterial).color.set(ACCENT[v]!);
          this.tints.push(material);
        }
        const mesh = new THREE.InstancedMesh(part.geometry, material, counts[k]!);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        list.push(mesh);
        this.group.add(mesh);
      }
    });
  }

  /** 0 none, 1 any structure, 2 city or capital. */
  setLevel(tile: number, level: number): void {
    if ((this.level.get(tile) ?? 0) === level) return;
    this.level.set(tile, level);
    this.dirty = true;
  }

  /** `f` is 0 from orbit and 1 when zoomed in. */
  update(f: number): void {
    if (!this.dirty && Math.abs(f - this.lastF) < 0.002) return;
    this.dirty = false;
    this.lastF = f;
    const { m, s, q } = this;
    this.group.visible = f > 0.01;
    if (!this.group.visible) return;
    for (const it of this.items) {
      const lv = this.level.get(it.tile) ?? 0;
      const hide = lv === 2 || (lv === 1 && it.inner);
      const k = hide ? 0 : it.size * f;
      s.set(k, k * (0.9 + 0.3 * hash01(it.seed, 25)), k);
      q.copy(it.quat);
      m.compose(it.pos, q, s);
      for (const mesh of this.meshes[it.kind]!) mesh.setMatrixAt(it.slot, m);
    }
    for (const list of this.meshes) for (const mesh of list) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const list of this.meshes) for (const mesh of list) mesh.dispose();
    for (const mat of this.tints) mat.dispose();
    this.group.clear();
  }
}
