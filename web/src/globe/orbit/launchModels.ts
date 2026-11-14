// The launch vehicle (#291): manifest `models.rocket` (with `fx_thruster` and `sep_point` empty nodes)
// and `models.booster` when lane a has made them, else a code-built rocket of cylinders and cones.
// Everything is in a unit space: +Y up, base at y = 0, height 1. Lane b.
import * as THREE from 'three';
import { loadModels } from '../structures/models';
import type { ModelPart } from '../structures/models';

export interface Thruster { pos: THREE.Vector3; dir: THREE.Vector3; upper: boolean }
export interface RocketKit {
  upper: ModelPart[];        // the upper stage, which carries the satellite to orbit
  lower: ModelPart[];        // the booster while still attached
  falling: ModelPart[];      // what drops away at separation (models.booster, else `lower`)
  thrusters: Thruster[];     // flame anchors; -Z of the node in the GLB, -Y on the code-built one
  sep: THREE.Vector3;        // the joint between the stages
  real: boolean;
}

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

function std(color: string, metal = 0.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, metalness: metal });
}

/** Code-built placeholder: a white booster with a tinted band and fins, a tinted nose on the upper stage. */
function placeholder(): RocketKit {
  const R = 0.11;
  const hull = std('#eef0f2');
  const dark = std('#3a3f46', 0.5);
  const team = () => std('#ffffff');
  const lower: ModelPart[] = [
    { geometry: new THREE.CylinderGeometry(R, R, 0.5, 12).translate(0, 0.31, 0), material: hull, team: false },
    { geometry: new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.1, 12).translate(0, 0.42, 0), material: team(), team: true },
    { geometry: new THREE.CylinderGeometry(R * 0.65, R * 0.95, 0.06, 10).translate(0, 0.03, 0), material: dark, team: false },
  ];
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.BoxGeometry(0.02, 0.16, 0.09).translate(0, 0.14, R + 0.04);
    fin.rotateY((i * Math.PI) / 2 + Math.PI / 4);
    lower.push({ geometry: fin, material: team(), team: true });
  }
  const upper: ModelPart[] = [
    { geometry: new THREE.CylinderGeometry(R * 0.9, R, 0.06, 12).translate(0, 0.59, 0), material: dark, team: false },
    { geometry: new THREE.CylinderGeometry(R * 0.9, R * 0.9, 0.2, 12).translate(0, 0.72, 0), material: hull, team: false },
    { geometry: new THREE.ConeGeometry(R * 0.9, 0.18, 12).translate(0, 0.91, 0), material: team(), team: true },
  ];
  return {
    upper, lower, falling: lower, real: false, sep: new THREE.Vector3(0, 0.56, 0),
    thrusters: [
      { pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, -1, 0), upper: false },
      { pos: new THREE.Vector3(0, 0.56, 0), dir: new THREE.Vector3(0, -1, 0), upper: true },
    ],
  };
}

/** Sub-meshes and empty nodes of one GLB, mapped into the unit space. */
async function loadGlb(file: string): Promise<{ parts: ModelPart[]; nodes: Array<{ name: string; pos: THREE.Vector3; dir: THREE.Vector3 }> } | null> {
  try {
    const set = await loadModels();
    const gltf = await set.loader.loadAsync(`${BASE}models/${file}`);
    gltf.scene.updateMatrixWorld(true);
    const parts: ModelPart[] = [];
    const nodes: Array<{ name: string; pos: THREE.Vector3; dir: THREE.Vector3 }> = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) {
        if (/^(fx_|sep_)/.test(o.name)) {
          nodes.push({ name: o.name, pos: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), dir: new THREE.Vector3(0, 0, -1).transformDirection(o.matrixWorld) });
        }
        return;
      }
      const src = Array.isArray(m.material) ? m.material[0]! : m.material;
      const material = src.clone();
      const team = src.name === 'team';
      if (team && 'color' in material) (material as THREE.MeshStandardMaterial).color.set('#ffffff');
      parts.push({ geometry: m.geometry.clone().applyMatrix4(m.matrixWorld), material, team });
    });
    if (!parts.length) return null;
    const box = new THREE.Box3();
    for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(1e-6, size.y);
    const norm = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
    for (const p of parts) p.geometry.applyMatrix4(norm);
    for (const n of nodes) { n.pos.applyMatrix4(norm); n.dir.transformDirection(norm); }
    return { parts, nodes };
  } catch (err) {
    console.warn(`launch: ${file} failed, using the code-built rocket`, err);
    return null;
  }
}

let kit: RocketKit = placeholder();
let started = false;

/** The current kit: the placeholder until the manifest rocket loads, then that one for good. */
export function rocketKit(): RocketKit {
  if (!started) { started = true; void loadReal(); }
  return kit;
}

async function loadReal(): Promise<void> {
  let models: Record<string, { file?: string }> = {};
  try {
    const res = await fetch(`${BASE}models/manifest.json`);
    if (res.ok) models = ((await res.json()) as { models?: typeof models }).models ?? {};
  } catch { return; }
  const rf = models.rocket?.file;
  if (!rf) return;
  const rocket = await loadGlb(rf);
  if (!rocket) return;
  const sepNode = rocket.nodes.find((n) => n.name.startsWith('sep_point'));
  const sep = sepNode?.pos ?? new THREE.Vector3(0, 0.56, 0);
  // split the rocket's sub-meshes into stages by where their middle sits against the joint
  const upper: ModelPart[] = [];
  const lower: ModelPart[] = [];
  for (const p of rocket.parts) {
    const mid = p.geometry.boundingBox ?? (p.geometry.computeBoundingBox(), p.geometry.boundingBox!);
    (mid.getCenter(new THREE.Vector3()).y > sep.y ? upper : lower).push(p);
  }
  if (!upper.length || !lower.length) { console.warn('launch: rocket.glb has no meshes on one side of sep_point; using it whole'); }
  const thrusters: Thruster[] = rocket.nodes.filter((n) => n.name.startsWith('fx_thruster')).map((n) => ({ pos: n.pos, dir: n.dir, upper: n.pos.y > sep.y }));
  if (!thrusters.some((t) => !t.upper)) thrusters.push({ pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, -1, 0), upper: false });
  if (!thrusters.some((t) => t.upper)) thrusters.push({ pos: sep.clone(), dir: new THREE.Vector3(0, -1, 0), upper: true });
  let falling = lower;
  const bf = models.booster?.file;
  if (bf) {
    const b = await loadGlb(bf);
    if (b) {
      // the booster model stands where the rocket's lower stage was: base at 0, top at the joint
      const s = Math.max(0.05, sep.y);
      for (const p of b.parts) p.geometry.scale(s, s, s);
      falling = b.parts;
    }
  }
  kit = { upper: upper.length ? upper : rocket.parts, lower: upper.length ? lower : [], falling, thrusters, sep, real: true };
}

/** One flying vehicle: the rocket (both stages) and the booster that drops away, materials its own. */
export interface Vehicle { root: THREE.Group; upper: THREE.Group; lower: THREE.Group; booster: THREE.Group; boosterMats: THREE.MeshStandardMaterial[]; upperMats: THREE.Material[]; dispose(): void }

export function buildVehicle(k: RocketKit, color: THREE.Color): Vehicle {
  const mats: THREE.Material[] = [];
  const mk = (parts: ModelPart[], into: THREE.Group, out?: THREE.Material[]) => {
    for (const p of parts) {
      const m = p.material.clone();
      if (p.team && 'color' in m) (m as THREE.MeshStandardMaterial).color.copy(color);
      m.transparent = true;
      mats.push(m);
      out?.push(m);
      into.add(new THREE.Mesh(p.geometry, m));
    }
  };
  const root = new THREE.Group();
  const upper = new THREE.Group();
  const lower = new THREE.Group();
  const booster = new THREE.Group();
  const upperMats: THREE.Material[] = [];
  const boosterMats: THREE.Material[] = [];
  mk(k.upper, upper, upperMats);
  mk(k.lower, lower);
  // the booster turns about its own middle as it tumbles
  const inner = new THREE.Group();
  inner.position.y = -k.sep.y / 2;
  booster.add(inner);
  mk(k.falling, inner, boosterMats);
  root.add(upper, lower);
  booster.visible = false;
  return {
    root, upper, lower, booster, upperMats,
    boosterMats: boosterMats.filter((m): m is THREE.MeshStandardMaterial => 'emissive' in m),
    dispose: () => { for (const m of mats) m.dispose(); },
  };
}
