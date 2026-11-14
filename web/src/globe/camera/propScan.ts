// Ground view: find how tall the props near the camera are (trees, town buildings, wonders, units), so
// the camera floor clears them and the sun's glare hides behind them. Props are small meshes or
// instanced meshes; the planet, shells, skies and effects are large or see-through and are skipped.
import * as THREE from 'three';
import { propTops } from './groundView';
import type { TerrainLookup } from './groundView';

/** A prop is smaller than this (world units); anything larger is terrain, a shell or a sky. */
const MAX_PROP = 0.08;

const m = new THREE.Matrix4();
const im = new THREE.Matrix4();
const c = new THREE.Vector3();
const sc = new THREE.Vector3();

function opaque(o: THREE.Mesh): boolean {
  const mat = o.material as THREE.Material | THREE.Material[];
  const one = Array.isArray(mat) ? mat[0] : mat;
  return !!one && one.visible !== false && !(one.transparent && one.opacity < 0.6) && !(one as THREE.Material & { isLineMaterial?: boolean }).isLineMaterial;
}

function visibleChain(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function note(lookup: TerrainLookup, top: number): void {
  const t = lookup.tileAt(c.x, c.y, c.z);
  if (top > (propTops.get(t) ?? 0)) propTops.set(t, top);
}

/** Rebuild propTops from every prop within `range` of `eye`. Cheap enough to run a few times a second. */
export function scanPropTops(scene: THREE.Object3D, eye: THREE.Vector3, lookup: TerrainLookup, range = 0.3): void {
  propTops.clear();
  const range2 = range * range;
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !opaque(mesh) || !visibleChain(mesh)) return;
    const g = mesh.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere;
    if (!bs) return;
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, im);
        m.multiplyMatrices(inst.matrixWorld, im);
        c.copy(bs.center).applyMatrix4(m);
        if (c.distanceToSquared(eye) > range2) continue;
        sc.setFromMatrixScale(m);
        const r = bs.radius * Math.max(sc.x, sc.y, sc.z);
        if (r <= 1e-6 || r > MAX_PROP) continue;
        note(lookup, c.length() + r);
      }
      return;
    }
    c.copy(bs.center).applyMatrix4(mesh.matrixWorld);
    if (c.distanceToSquared(eye) > range2) return;
    sc.setFromMatrixScale(mesh.matrixWorld);
    const r = bs.radius * Math.max(sc.x, sc.y, sc.z);
    if (r <= 1e-6 || r > MAX_PROP) return;
    note(lookup, c.length() + r);
  });
}
