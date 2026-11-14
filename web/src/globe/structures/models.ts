// Loads the X4 model manifest and GLBs once. Any missing key or failed file gets a box fallback for good.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ModelPart { geometry: THREE.BufferGeometry; material: THREE.Material; team: boolean }
export interface ModelSet { parts: Map<string, ModelPart[]>; footprint: Map<string, number>; fallback: ModelPart[] }

export const STRUCTURE_KINDS = ['camp', 'village', 'town', 'city', 'capital', 'farm', 'port', 'fort', 'temple', 'factory', 'ruin'] as const;
const DEFAULT_FOOTPRINT = 0.8;
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

function fallbackPart(): ModelPart {
  const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6).translate(0, 0.3, 0);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 });
  return { geometry, material, team: true };
}

async function loadOne(loader: GLTFLoader, file: string): Promise<ModelPart[]> {
  const gltf = await loader.loadAsync(`${BASE}models/${file}`);
  gltf.scene.updateMatrixWorld(true);
  const parts: ModelPart[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geometry = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const src = Array.isArray(m.material) ? m.material[0]! : m.material;
    const material = src.clone();
    const team = src.name === 'team';
    const std = material as THREE.MeshStandardMaterial;
    if ('color' in std && team) std.color.set('#ffffff'); // instance colour carries the nation colour
    if ('flatShading' in std) { std.flatShading = true; std.needsUpdate = true; }
    parts.push({ geometry, material, team });
  });
  if (!parts.length) throw new Error(`no meshes in ${file}`);
  return parts;
}

let cache: Promise<ModelSet> | null = null;

export function loadModels(): Promise<ModelSet> {
  if (cache) return cache;
  cache = (async () => {
    const set: ModelSet = { parts: new Map(), footprint: new Map(), fallback: [fallbackPart()] };
    let models: Record<string, { file: string; footprint: number }> = {};
    try {
      const res = await fetch(`${BASE}models/manifest.json`);
      if (res.ok) models = ((await res.json()) as { models?: typeof models }).models ?? {};
    } catch (err) {
      console.warn('structures: manifest failed, using boxes', err);
    }
    const loader = new GLTFLoader();
    await Promise.all([...STRUCTURE_KINDS, 'tree'].map(async (key) => {
      const entry = models[key];
      if (entry?.footprint) set.footprint.set(key, entry.footprint);
      if (!entry?.file) return;
      try { set.parts.set(key, await loadOne(loader, entry.file)); }
      catch (err) { console.warn(`structures: ${key} failed, using a box`, err); }
    }));
    return set;
  })();
  return cache;
}

export function partsFor(set: ModelSet, kind: string): ModelPart[] {
  return set.parts.get(kind) ?? set.fallback;
}
/**
 * Hook for culture styles: today every nation shares one model per kind. Once the owner adds
 * per-style variants to the manifest this will pick one from the country's style.
 */
export function modelFor(set: ModelSet, kind: string, _country?: number): { parts: ModelPart[]; footprint: number } {
  return { parts: partsFor(set, kind), footprint: footprintFor(set, kind) };
}
export function hasModel(set: ModelSet, kind: string): boolean { return set.parts.has(kind); }
export function footprintFor(set: ModelSet, kind: string): number {
  return set.footprint.get(kind) ?? DEFAULT_FOOTPRINT;
}
