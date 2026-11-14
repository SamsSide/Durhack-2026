// Decorative trees on forest tiles (a few on plains and hills), one InstancedMesh per sub-mesh.
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { footprintFor, partsFor } from './models';
import type { ModelSet } from './models';
import { hash01 } from './placement';
import type { TileGeos } from './placement';

interface Tree { tile: number; pos: THREE.Vector3; quat: THREE.Quaternion; size: number; inner: boolean; seed: number }

export class Trees {
  readonly group = new THREE.Group();
  private items: Tree[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private level = new Map<number, number>(); // tile -> 0 none, 1 any structure, 2 city or capital
  private dirty = true;
  private lastF = -1;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private yaw = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(world: World, geos: TileGeos, models: ModelSet) {
    const base = footprintFor(models, 'tree');
    const p = new THREE.Vector3();
    for (const t of world.tiles) {
      let count = 0;
      if (t.terrain === 'forest') count = 3 + Math.floor(hash01(t.id, 11) * 4);
      else if ((t.terrain === 'plains' || t.terrain === 'hills') && hash01(t.id, 12) < 0.4) count = 1 + Math.floor(hash01(t.id, 13) * 2);
      if (!count) continue;
      const g = geos.get(t.id);
      for (let i = 0; i < count; i++) {
        const seed = t.id * 16 + i;
        const ang = hash01(seed, 21) * Math.PI * 2;
        const r = (g.width * 1.4) * (0.06 + 0.4 * Math.sqrt(hash01(seed, 22)));
        geos.point(g, Math.cos(ang) * r, Math.sin(ang) * r, 0, p);
        const quat = g.align.clone().multiply(new THREE.Quaternion().setFromAxisAngle(this.up, hash01(seed, 23) * Math.PI * 2));
        this.items.push({ tile: t.id, pos: p.clone(), quat, size: (g.width * 1.4) * base * (0.8 + 0.5 * hash01(seed, 24)), inner: r < (g.width * 1.4) * 0.26, seed });
      }
    }
    const parts = partsFor(models, 'tree');
    for (const part of parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, Math.max(1, this.items.length));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = this.items.length;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
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
    this.items.forEach((it, i) => {
      const lv = this.level.get(it.tile) ?? 0;
      const hide = lv === 2 || (lv === 1 && it.inner);
      const k = hide ? 0 : it.size * f;
      s.set(k, k * (0.9 + 0.3 * hash01(it.seed, 25)), k);
      q.copy(it.quat);
      m.compose(it.pos, q, s);
      for (const mesh of this.meshes) mesh.setMatrixAt(i, m);
    });
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose();
    this.group.clear();
  }
}
