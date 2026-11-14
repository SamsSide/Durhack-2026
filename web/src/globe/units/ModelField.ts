// Instanced unit models: one InstancedMesh per (model, sub-mesh), refilled every frame (units move
// every frame anyway, and there are only a few hundred). Lane b.
import * as THREE from 'three';
import type { UnitModel } from './unitModels';

interface Pool { model: UnitModel; meshes: THREE.InstancedMesh[]; cap: number; n: number }

const WHITE = new THREE.Color('#ffffff');
const _m = new THREE.Matrix4();

export class ModelField {
  readonly group = new THREE.Group();
  private readonly pools = new Map<string, Pool>();
  private readonly marked = new Map<string, number>();

  constructor() { this.group.name = 'unit-models'; }

  private make(model: UnitModel, cap: number, old?: Pool): Pool {
    const meshes = model.parts.map((part, k) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      const prev = old?.meshes[k];
      if (prev) {
        (mesh.instanceMatrix.array as Float32Array).set(prev.instanceMatrix.array as Float32Array);
        if (prev.instanceColor) (mesh.instanceColor.array as Float32Array).set(prev.instanceColor.array as Float32Array);
        this.group.remove(prev);
        prev.dispose();
      }
      this.group.add(mesh);
      return mesh;
    });
    return { model, meshes, cap, n: old?.n ?? 0 };
  }

  begin(): void {
    for (const p of this.pools.values()) p.n = 0;
  }

  /** One instance: `m` places the unit box (the model's norm is applied here). */
  push(model: UnitModel, m: THREE.Matrix4, team: THREE.Color, tint: THREE.Color = WHITE): void {
    let p = this.pools.get(model.key);
    if (!p) { p = this.make(model, 16); this.pools.set(model.key, p); }
    if (p.n >= p.cap) { p = this.make(model, p.cap * 2, p); this.pools.set(model.key, p); }
    _m.multiplyMatrices(m, model.norm);
    for (let k = 0; k < p.meshes.length; k++) {
      const mesh = p.meshes[k]!;
      mesh.setMatrixAt(p.n, _m);
      mesh.setColorAt(p.n, model.parts[k]!.team ? team : tint);
    }
    p.n++;
  }

  end(): void {
    for (const p of this.pools.values()) {
      for (const mesh of p.meshes) {
        const was = mesh.count;
        mesh.count = p.n;
        if (p.n || was) {
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      }
    }
  }

  /**
   * Remember how many instances each pool holds, so a second camera's pass (the news picture-in-picture)
   * can add its own after them with `push` + `end` and `rewind` back before the main view is drawn.
   */
  mark(): void {
    this.marked.clear();
    for (const [k, p] of this.pools) this.marked.set(k, p.n);
  }

  /** Back to the counts at `mark()`. The instances below them were never touched: nothing to upload. */
  rewind(): void {
    for (const [k, p] of this.pools) {
      p.n = this.marked.get(k) ?? 0;
      for (const mesh of p.meshes) mesh.count = p.n;
    }
  }

  dispose(): void {
    for (const p of this.pools.values()) for (const m of p.meshes) { this.group.remove(m); m.dispose(); }
    this.pools.clear();
  }
}

const _x = new THREE.Vector3(), _z = new THREE.Vector3(), _up = new THREE.Vector3(), _s = new THREE.Vector3(), _r = new THREE.Matrix4();

/**
 * A model standing at `pos` on the sphere, its up along the surface normal and its front (+z) along
 * `head` (any vector; only its tangent part counts). `roll` tips it about its front axis.
 */
export function standMatrix(out: THREE.Matrix4, pos: THREE.Vector3, head: THREE.Vector3, size: number, roll = 0): THREE.Matrix4 {
  const up = _up.copy(pos).normalize();
  _z.copy(head).addScaledVector(up, -head.dot(up));
  if (_z.lengthSq() < 1e-10) { _z.set(0, 1, 0).addScaledVector(up, -up.y); if (_z.lengthSq() < 1e-10) _z.set(1, 0, 0); }
  _z.normalize();
  _x.crossVectors(up, _z);
  out.makeBasis(_x, up, _z);
  if (roll) out.multiply(_r.makeRotationZ(roll));
  out.scale(_s.set(size, size, size));
  out.setPosition(pos);
  return out;
}

/**
 * `standMatrix` with a pose laid over it: `pitch` leans the model forward (nose down), `roll` tips it
 * about its front axis, `sy` stretches it upward (a breath). Both turn about the model's base.
 */
export function poseMatrix(out: THREE.Matrix4, pos: THREE.Vector3, head: THREE.Vector3, size: number, pitch: number, roll: number, sy = 1): THREE.Matrix4 {
  const up = _up.copy(pos).normalize();
  _z.copy(head).addScaledVector(up, -head.dot(up));
  if (_z.lengthSq() < 1e-10) { _z.set(0, 1, 0).addScaledVector(up, -up.y); if (_z.lengthSq() < 1e-10) _z.set(1, 0, 0); }
  _z.normalize();
  _x.crossVectors(up, _z);
  out.makeBasis(_x, up, _z);
  if (roll) out.multiply(_r.makeRotationZ(roll));
  if (pitch) out.multiply(_r.makeRotationX(pitch));
  out.scale(_s.set(size, size * sy, size));
  out.setPosition(pos);
  return out;
}
