// Lane b: every close-up town on the globe in six draw calls (ground, flats, houses, walls, towers, river).
// Towns are built once per structure id and rebuilt only when what they look like changes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { World } from '@terra/shared';
import type { TileGeos } from '../structures/placement';
import { clamp01, easeOutBack, smoothstep } from '../structures/placement';
import { makeRiverMaterial } from '../rivers/buildRivers';
import { getPalette } from '../palette';
import { TOWN_KINDS, buildTown, townKey } from './buildTown';
import type { PartBuf, TownParts } from './buildTown';
import { FADE_FAR, FADE_NEAR, PLASTER } from './style';

type PartName = 'grounds' | 'flats' | 'houses' | 'walls' | 'towers';
const PARTS: PartName[] = ['grounds', 'flats', 'houses', 'walls', 'towers'];
const PLASTER_GLSL = new THREE.Color(PLASTER).toArray().map((v) => v.toFixed(3)).join(', ');
const BUILD_S = 0.7, DESTROY_S = 0.6, WALL_S = 0.9;

interface Town {
  id: string;
  key: string;
  parts: TownParts;
  anim: { type: 'build' | 'destroy'; t0: number } | null;
  wallT0: number | null;
}

/** A box house with a pyramid roof; the `roof` attribute tells the shader which faces take the roof colour. */
function houseGeometry(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(1, 0.62, 1).translate(0, 0.31, 0);
  const roof = new THREE.ConeGeometry(0.72, 0.4, 4, 1).rotateY(Math.PI / 4).translate(0, 0.62 + 0.2, 0);
  const mark = (g: THREE.BufferGeometry, isRoof: number): THREE.BufferGeometry => {
    g.setAttribute('roof', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(isRoof), 1));
    return g;
  };
  const merged = mergeGeometries([mark(body, 0), mark(roof, 1)], false)!;
  body.dispose(); roof.dispose();
  return merged;
}

/** A shallow cone: unit radius, centre at y = 0 and rim at y = -1, normals straight up. */
function groundGeometry(): THREE.BufferGeometry {
  const SEG = 32;
  const pos: number[] = [0, 0, 0], nrm: number[] = [0, 1, 0], idx: number[] = [];
  for (let k = 0; k < SEG; k++) {
    const a = (k / SEG) * Math.PI * 2;
    pos.push(Math.cos(a), -1, Math.sin(a)); nrm.push(0, 1, 0);
    idx.push(0, 1 + ((k + 1) % SEG), 1 + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export class TownLayer {
  readonly group = new THREE.Group();
  private towns = new Map<string, Town>();
  private meshes = {} as Record<PartName, THREE.InstancedMesh>;
  private geos = {} as Record<PartName, THREE.BufferGeometry>;
  private mats = {} as Record<PartName, THREE.Material>;
  private grow = { value: 0 };
  private riverMat: THREE.ShaderMaterial;
  private river: THREE.Mesh;
  private dirty = true;
  private riverDirty = true;
  private f = 0;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(private tileGeos: TileGeos) {
    this.group.name = 'towns';
    const grow = this.grow;
    const house = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 });
    house.onBeforeCompile = (sh) => {
      sh.uniforms.uGrow = grow;
      sh.vertexShader = 'uniform float uGrow;\nattribute float roof;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y *= uGrow;')
        .replace('#include <color_vertex>', `#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvColor.xyz = mix(mix(instanceColor.xyz, vec3(${PLASTER_GLSL}), 0.62), instanceColor.xyz, roof);\n#endif`);
    };
    house.customProgramCacheKey = () => 'towns-house';
    const solid = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95, metalness: 0 });
    solid.onBeforeCompile = (sh) => {
      sh.uniforms.uGrow = grow;
      sh.vertexShader = 'uniform float uGrow;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y *= uGrow;');
    };
    solid.customProgramCacheKey = () => 'towns-solid';
    const flat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true });
    const ground = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, side: THREE.DoubleSide });
    this.mats = { grounds: ground, flats: flat, houses: house, walls: solid, towers: solid };
    this.geos = {
      grounds: groundGeometry(),
      flats: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      houses: houseGeometry(),
      walls: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      towers: new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0),
    };
    const order: Record<PartName, number> = { grounds: 1, flats: 2, houses: 0, walls: 0, towers: 0 };
    for (const k of PARTS) {
      const mesh = this.alloc(k, 256);
      mesh.renderOrder = order[k];
    }
    this.riverMat = makeRiverMaterial(getPalette().ocean);
    this.river = new THREE.Mesh(new THREE.BufferGeometry(), this.riverMat);
    this.river.renderOrder = 3;
    this.river.frustumCulled = false;
    this.group.add(this.river);
    this.group.visible = false;
  }

  private alloc(k: PartName, cap: number): THREE.InstancedMesh {
    const old = this.meshes[k];
    const mesh = new THREE.InstancedMesh(this.geos[k], this.mats[k], cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.setColorAt(0, this.c.set(1, 1, 1));
    if (old) { mesh.renderOrder = old.renderOrder; this.group.remove(old); old.dispose(); }
    this.meshes[k] = mesh;
    this.group.add(mesh);
    return mesh;
  }

  /** Add, rebuild or retire towns to match the world. `initial` builds without animation. */
  sync(world: World, now: number, initial: boolean): void {
    const seen = new Set<string>();
    for (const s of world.structures) {
      if (!TOWN_KINDS.has(s.kind) || !world.tiles[s.tile]) continue;
      seen.add(s.id);
      const key = townKey(world, s);
      const have = this.towns.get(s.id);
      if (have && have.key === key && have.anim?.type !== 'destroy') continue;
      const walls = key.split('|')[2] === '1';
      const parts = buildTown(world, s, this.tileGeos.get(s.tile), walls);
      if (!have) {
        this.towns.set(s.id, { id: s.id, key, parts, anim: initial ? null : { type: 'build', t0: now }, wallT0: null });
      } else {
        const wallsNew = parts.walled && !have.parts.walled;
        have.key = key;
        have.parts = parts;
        if (have.anim?.type === 'destroy') have.anim = { type: 'build', t0: now };
        if (wallsNew && !initial) have.wallT0 = now;
      }
      this.dirty = this.riverDirty = true;
    }
    for (const t of this.towns.values()) {
      if (!seen.has(t.id) && t.anim?.type !== 'destroy') {
        t.anim = { type: 'destroy', t0: now };
        this.dirty = this.riverDirty = true;
      }
    }
  }

  update(now: number, dt: number, camDist: number): void {
    const target = smoothstep(FADE_FAR, FADE_NEAR, camDist);
    this.f += (target - this.f) * Math.min(1, dt * 6);
    if (Math.abs(target - this.f) < 0.002) this.f = target;
    const f = this.f;
    this.group.visible = f > 0.002;
    this.grow.value = Math.max(0.001, f);
    (this.mats.flats as THREE.MeshStandardMaterial).opacity = f;
    (this.mats.grounds as THREE.MeshStandardMaterial).opacity = f;
    this.riverMat.uniforms.uTime!.value = now;
    this.riverMat.uniforms.uWide!.value = f;
    if (this.dirty) this.write(now);
    if (this.riverDirty) this.writeRiver(now);
  }

  /** Scale of a town's pop-up or sink animation, and of its walls. */
  private animOf(t: Town, now: number): { k: number; kw: number; busy: boolean; done: boolean } {
    let k = 1, kw = 1, busy = false, done = false;
    if (t.anim) {
      const dur = t.anim.type === 'build' ? BUILD_S : DESTROY_S;
      const raw = (now - t.anim.t0) / dur;
      if (raw >= 1) {
        if (t.anim.type === 'destroy') { done = true; k = 0; } else t.anim = null;
      } else {
        busy = true;
        k = t.anim.type === 'build' ? Math.max(0, easeOutBack(clamp01(raw))) : 1 - raw * raw;
      }
    }
    if (t.wallT0 != null) {
      const raw = (now - t.wallT0) / WALL_S;
      if (raw >= 1) t.wallT0 = null;
      else { busy = true; kw = Math.max(0, easeOutBack(clamp01(raw))); }
    }
    return { k, kw, busy, done };
  }

  private write(now: number): void {
    const counts: Record<PartName, number> = { grounds: 0, flats: 0, houses: 0, walls: 0, towers: 0 };
    const done: string[] = [];
    let busy = false;
    const anims = new Map<string, { k: number; kw: number }>();
    for (const t of this.towns.values()) {
      const a = this.animOf(t, now);
      if (a.done) { done.push(t.id); continue; }
      busy ||= a.busy;
      anims.set(t.id, a);
      for (const k of PARTS) counts[k] += t.parts[k].count;
    }
    for (const id of done) { this.towns.delete(id); this.riverDirty = true; }
    for (const k of PARTS) {
      let cap = this.meshes[k].instanceMatrix.count;
      if (counts[k] > cap) { while (cap < counts[k]) cap *= 2; this.alloc(k, cap); }
    }
    const at: Record<PartName, number> = { grounds: 0, flats: 0, houses: 0, walls: 0, towers: 0 };
    for (const t of this.towns.values()) {
      const a = anims.get(t.id);
      if (!a) continue;
      for (const k of PARTS) {
        const ky = k === 'walls' || k === 'towers' ? a.k * a.kw : a.k;
        at[k] = this.writePart(this.meshes[k], t.parts[k], at[k], a.k, ky);
      }
    }
    for (const k of PARTS) {
      const mesh = this.meshes[k];
      mesh.count = at[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (busy) this.riverDirty = true;
    this.dirty = busy;
  }

  private writePart(mesh: THREE.InstancedMesh, buf: PartBuf, start: number, kxz: number, ky: number): number {
    const { m, p, q, s, c } = this;
    const tr = buf.tr, col = buf.col;
    const n = buf.count;
    for (let i = 0; i < n; i++) {
      const o = i * 10;
      p.set(tr[o]!, tr[o + 1]!, tr[o + 2]!);
      q.set(tr[o + 3]!, tr[o + 4]!, tr[o + 5]!, tr[o + 6]!);
      s.set(tr[o + 7]! * kxz + 1e-7, tr[o + 8]! * ky + 1e-7, tr[o + 9]! * kxz + 1e-7);
      m.compose(p, q, s);
      mesh.setMatrixAt(start + i, m);
      mesh.setColorAt(start + i, c.setRGB(col[i * 3]!, col[i * 3 + 1]!, col[i * 3 + 2]!));
    }
    return start + n;
  }

  /** One merged ribbon for every river city, same attributes as the rivers layer's shader expects. */
  private writeRiver(now: number): void {
    this.riverDirty = false;
    const pos: number[] = [], side: number[] = [], half: number[] = [], uu: number[] = [], vv: number[] = [];
    const foam: number[] = [], alpha: number[] = [], kind: number[] = [], index: number[] = [];
    for (const t of this.towns.values()) {
      const r = t.parts.river;
      if (!r) continue;
      const { k } = this.animPeek(t, now);
      if (k <= 0) continue;
      let along = 0;
      for (let i = 0; i < r.length; i++) {
        const sm = r[i]!;
        if (i > 0) along += sm.p.distanceTo(r[i - 1]!.p);
        const base = pos.length / 3;
        for (const u of [-1, 1]) {
          pos.push(sm.p.x, sm.p.y, sm.p.z); side.push(sm.side.x, sm.side.y, sm.side.z);
          half.push(sm.half * k); uu.push(u); vv.push(along); foam.push(0); alpha.push(sm.alpha); kind.push(0);
        }
        if (i > 0) index.push(base - 2, base - 1, base, base - 1, base + 1, base);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 3));
    g.setAttribute('aHalf', new THREE.Float32BufferAttribute(half, 1));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(uu, 1));
    g.setAttribute('aV', new THREE.Float32BufferAttribute(vv, 1));
    g.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1));
    g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alpha, 1));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
    g.setIndex(index);
    this.river.geometry.dispose();
    this.river.geometry = g;
  }

  /** The animation scale without advancing or clearing anything. */
  private animPeek(t: Town, now: number): { k: number } {
    if (!t.anim) return { k: 1 };
    const dur = t.anim.type === 'build' ? BUILD_S : DESTROY_S;
    const raw = (now - t.anim.t0) / dur;
    if (raw >= 1) return { k: t.anim.type === 'destroy' ? 0 : 1 };
    return { k: t.anim.type === 'build' ? Math.max(0, easeOutBack(clamp01(raw))) : 1 - raw * raw };
  }

  dispose(): void {
    for (const k of PARTS) { this.meshes[k].dispose(); this.geos[k].dispose(); }
    for (const mat of new Set(Object.values(this.mats))) mat.dispose();
    this.river.geometry.dispose();
    this.riverMat.dispose();
    this.group.clear();
  }
}
