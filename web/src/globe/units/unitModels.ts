// 3D unit models by technology age (X4 `ages`), loaded once through the structures' model cache.
// Lookup: ages[age][kind], then models[kind], then a code-built fallback (cone, hull + sail). Lane b.
import * as THREE from 'three';
import type { TechAge } from '@terra/shared';
import { loadModels } from '../structures/models';
import type { ModelPart, ModelSet } from '../structures/models';

export type ModelKind = 'army' | 'fleet' | 'trader';
export const MODEL_KINDS: readonly ModelKind[] = ['army', 'fleet', 'trader'];

interface Entry { file: string; footprint: number }
type Manifest = { models?: Record<string, Entry>; ages?: Record<string, Record<string, Entry>> };

export type AnchorKind = 'thruster' | 'wake' | 'exhaust' | 'contrail' | 'dust';
/** An X4 effect anchor: where an effect starts and the way it streams out (local -Z of the node). */
export interface ModelAnchor { kind: AnchorKind; pos: THREE.Vector3; dir: THREE.Vector3 }

/** One drawable model. `norm` maps it to a unit box: 1 across (x/z), base at y = 0. `anchors` are in that box. */
export interface UnitModel { key: string; parts: ModelPart[]; norm: THREE.Matrix4; footprint: number; real: boolean; anchors: ModelAnchor[] }

const ANCHOR_RE = /^fx_(thruster|wake|exhaust|contrail|dust)/;
/** Anchors read from each GLB at load, in the file's own space (the same space as its parts). */
const rawAnchors = new Map<string, ModelAnchor[]>();

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
const DEFAULT_FOOTPRINT = 0.5;

function std(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
}

/** A small boat: tapered hull, mast, a sail and a pennant. `wide` makes a fat merchant hull. */
function boat(wide: boolean): ModelPart[] {
  const hull = new THREE.CylinderGeometry(wide ? 0.3 : 0.24, wide ? 0.2 : 0.14, 1, 6, 1);
  hull.rotateX(Math.PI / 2);
  hull.scale(1, 0.32, 1);
  hull.translate(0, 0.1, 0);
  const deck = new THREE.BoxGeometry(wide ? 0.34 : 0.26, 0.04, 0.7).translate(0, 0.2, 0);
  const mast = new THREE.CylinderGeometry(0.02, 0.025, 0.75, 5).translate(0, 0.55, 0);
  const sail = new THREE.ConeGeometry(wide ? 0.32 : 0.26, 0.55, 4, 1, true).translate(0, 0.55, 0);
  sail.scale(1, 1, 0.35);
  const pennant = new THREE.BufferGeometry();
  pennant.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.93, 0, 0, 0.83, 0, 0, 0.88, -0.22], 3));
  pennant.computeVertexNormals();
  const wood = std('#6e4b2c');
  const team = std('#ffffff');
  team.side = THREE.DoubleSide;
  return [
    { geometry: hull, material: wood, team: false },
    { geometry: deck, material: std('#a07a4e'), team: false },
    { geometry: mast, material: wood, team: false },
    { geometry: sail, material: team, team: true },
    { geometry: pennant, material: team, team: true },
  ];
}

function cone(): ModelPart[] {
  const g = new THREE.ConeGeometry(0.32, 1, 8).translate(0, 0.5, 0);
  const base = new THREE.CylinderGeometry(0.4, 0.42, 0.08, 8).translate(0, 0.04, 0);
  return [
    { geometry: g, material: std('#ffffff'), team: true },
    { geometry: base, material: std('#5a4632'), team: false },
  ];
}

/** Unit box for a set of parts (the parts themselves are shared with other layers and never changed). */
function normFor(parts: ModelPart[]): THREE.Matrix4 {
  const box = new THREE.Box3();
  for (const p of parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox!);
  }
  if (box.isEmpty()) return new THREE.Matrix4();
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(1e-6, size.x, size.z);
  return new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
}

/** Same import as the structures' loader: world-space sub-meshes, 'team' material goes white. */
async function loadParts(set: ModelSet, file: string): Promise<void> {
  if (set.files.has(file) || set.failed.has(file)) return;
  try {
    const gltf = await set.loader.loadAsync(`${BASE}models/${file}`);
    gltf.scene.updateMatrixWorld(true);
    const parts: ModelPart[] = [];
    const anchors: ModelAnchor[] = [];
    gltf.scene.traverse((o) => {
      const hit = ANCHOR_RE.exec(o.name);
      if (hit && !(o as THREE.Mesh).isMesh) {
        const pos = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        const dir = new THREE.Vector3(0, 0, -1).transformDirection(o.matrixWorld);
        anchors.push({ kind: hit[1] as AnchorKind, pos, dir });
      }
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const geometry = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const src = Array.isArray(m.material) ? m.material[0]! : m.material;
      const material = src.clone();
      const team = src.name === 'team';
      const s = material as THREE.MeshStandardMaterial;
      if ('color' in s && team) s.color.set('#ffffff');
      if ('flatShading' in s) { s.flatShading = true; s.needsUpdate = true; }
      parts.push({ geometry, material, team });
    });
    if (!parts.length) throw new Error(`no meshes in ${file}`);
    if (!set.files.has(file)) set.files.set(file, parts);
    rawAnchors.set(file, anchors);
  } catch (err) {
    set.failed.add(file);
    console.warn(`units: ${file} failed, using the next fallback`, err);
  }
}

export class UnitModels {
  private set: ModelSet | null = null;
  private readonly ages = new Map<string, Map<string, Entry>>();
  private readonly shared = new Map<string, Entry>();
  private readonly made = new Map<string, UnitModel>();
  private readonly fallbacks: Record<ModelKind, UnitModel>;
  private disposed = false;

  constructor() {
    const mk = (key: string, parts: ModelPart[]): UnitModel => ({ key, parts, norm: normFor(parts), footprint: DEFAULT_FOOTPRINT, real: false, anchors: [] });
    this.fallbacks = { army: mk('fb:army', cone()), fleet: mk('fb:fleet', boat(false)), trader: mk('fb:trader', boat(true)) };
    this.fallbacks.trader.footprint = 0.4;
    void this.init();
  }

  private async init(): Promise<void> {
    let set: ModelSet;
    let manifest: Manifest = {};
    try {
      set = await loadModels();
      const res = await fetch(`${BASE}models/manifest.json`);
      if (res.ok) manifest = (await res.json()) as Manifest;
    } catch (err) {
      console.warn('units: manifest failed, using code-built units', err);
      return;
    }
    if (this.disposed) return;
    this.set = set;
    for (const kind of MODEL_KINDS) {
      const e = manifest.models?.[kind];
      if (e?.file) this.shared.set(kind, { file: e.file, footprint: e.footprint || DEFAULT_FOOTPRINT });
    }
    for (const [age, kinds] of Object.entries(manifest.ages ?? {})) {
      const m = new Map<string, Entry>();
      for (const kind of MODEL_KINDS) {
        const e = kinds?.[kind];
        if (e?.file) m.set(kind, { file: e.file, footprint: e.footprint || DEFAULT_FOOTPRINT });
      }
      if (m.size) this.ages.set(age, m);
    }
    // all ages up front (15 small files), so an age change never flashes a fallback
    const files = new Set<string>();
    for (const e of this.shared.values()) files.add(e.file);
    for (const m of this.ages.values()) for (const e of m.values()) files.add(e.file);
    await Promise.all([...files].map((f) => loadParts(set, f)));
  }

  private fromFile(e: Entry | undefined, kind: ModelKind): UnitModel | null {
    if (!e || !this.set) return null;
    const have = this.made.get(e.file);
    if (have) return have;
    const parts = this.set.files.get(e.file);
    if (!parts) return null;
    // Lane a's unit GLBs face +x (#131); the stand matrix expects +z forward, so turn them a quarter.
    const norm = new THREE.Matrix4().makeRotationY(-Math.PI / 2).multiply(normFor(parts));
    const anchors: ModelAnchor[] = (rawAnchors.get(e.file) ?? []).map((a) => ({
      kind: a.kind, pos: a.pos.clone().applyMatrix4(norm), dir: a.dir.clone().transformDirection(norm),
    }));
    // until a model carries its own anchors (X4), ships get a wake and armies dust at the stern
    if (!anchors.length) {
      const back = new THREE.Vector3(0, 0, -1);
      if (kind === 'fleet' || kind === 'trader') anchors.push({ kind: 'wake', pos: new THREE.Vector3(0, 0.03, -0.45), dir: back });
      else anchors.push({ kind: 'dust', pos: new THREE.Vector3(0, 0.05, -0.4), dir: back });
    }
    const m: UnitModel = { key: e.file, parts, norm, footprint: e.footprint, real: true, anchors };
    this.made.set(e.file, m);
    return m;
  }

  /** ages[age][kind], then models[kind], then the code-built one. */
  resolve(age: TechAge, kind: ModelKind): UnitModel {
    return this.fromFile(this.ages.get(age)?.get(kind), kind) ?? this.fromFile(this.shared.get(kind), kind) ?? this.fallbacks[kind];
  }

  dispose(): void {
    this.disposed = true;
    for (const fb of Object.values(this.fallbacks)) {
      const mats = new Set<THREE.Material>();
      for (const p of fb.parts) { p.geometry.dispose(); mats.add(p.material); }
      for (const m of mats) m.dispose();
    }
  }
}
