// Loads the X4 model manifest and GLBs once. Any missing key or failed file gets a box fallback for good.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STYLE_FALLBACK } from '@terra/shared';
import type { BuildingStyle, Country } from '@terra/shared';
import { ageStyle, nextAgeStyle } from '../towns/ageStyle';

export interface ModelPart { geometry: THREE.BufferGeometry; material: THREE.Material; team: boolean }
interface Entry { file: string; footprint: number }
export interface ModelSet {
  parts: Map<string, ModelPart[]>;       // shared model per kind (and 'tree')
  footprint: Map<string, number>;
  fallback: ModelPart[];
  styles: Map<string, Map<string, Entry>>; // manifest `styles`: style -> kind -> entry
  files: Map<string, ModelPart[]>;       // every loaded file, loaded once and shared
  failed: Set<string>;                   // files that failed to load
  loading: Map<string, Promise<void>>;   // style loads in flight or done
  misses: Set<string>;                   // 'style/kind' with no styled model (dev log)
  loader: GLTFLoader;
}
export interface Resolved { key: string; parts: ModelPart[]; footprint: number; real: boolean }

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

type Manifest = { models?: Record<string, Entry>; styles?: Record<string, Record<string, Entry>>; trees?: Record<string, Entry> };

export function loadModels(): Promise<ModelSet> {
  if (cache) return cache;
  cache = (async () => {
    const loader = new GLTFLoader();
    const set: ModelSet = {
      parts: new Map(), footprint: new Map(), fallback: [fallbackPart()],
      styles: new Map(), files: new Map(), failed: new Set(), loading: new Map(), misses: new Set(), loader,
    };
    let manifest: Manifest = {};
    try {
      const res = await fetch(`${BASE}models/manifest.json`);
      if (res.ok) manifest = (await res.json()) as Manifest;
    } catch (err) {
      console.warn('structures: manifest failed, using boxes', err);
    }
    const models = manifest.models ?? {};
    for (const [style, kinds] of Object.entries(manifest.styles ?? {})) {
      const m = new Map<string, Entry>();
      for (const [kind, e] of Object.entries(kinds ?? {})) if (e?.file) m.set(kind, { file: e.file, footprint: e.footprint || DEFAULT_FOOTPRINT });
      if (m.size) set.styles.set(style, m);
    }
    const trees = manifest.trees ?? {}; // tree variants, kept as 'tree:<name>'
    await Promise.all([...STRUCTURE_KINDS, 'tree', ...Object.keys(trees).map((k) => `tree:${k}`)].map(async (key) => {
      const entry = key.startsWith('tree:') ? trees[key.slice(5)] : models[key];
      if (entry?.footprint) set.footprint.set(key, entry.footprint);
      if (!entry?.file) return;
      const parts = await loadFile(set, entry.file);
      if (parts) set.parts.set(key, parts);
    }));
    return set;
  })();
  return cache;
}

export async function loadFile(set: ModelSet, file: string): Promise<ModelPart[] | null> {
  const have = set.files.get(file);
  if (have) return have;
  if (set.failed.has(file)) return null;
  try {
    const parts = await loadOne(set.loader, file);
    set.files.set(file, parts);
    return parts;
  } catch (err) {
    set.failed.add(file);
    console.warn(`structures: ${file} failed, using the next fallback`, err);
    return null;
  }
}

/** Style chain for one nation: its own style, then the nearest built one. */
function chain(style: string): string[] {
  const fb = STYLE_FALLBACK[style as BuildingStyle];
  return fb && fb !== style ? [style, fb] : [style];
}

/**
 * Load the models of the given styles (and their fallbacks, and 'nomadic' when asked). Only files the
 * manifest lists are fetched, each once, and a style already loaded costs nothing. Resolves when done.
 */
export function ensureStyles(set: ModelSet, styles: Iterable<string>, nomadic = false): Promise<void> {
  const wanted = new Set<string>();
  for (const s of styles) for (const c of chain(s)) wanted.add(c);
  if (nomadic) wanted.add('nomadic');
  const jobs: Promise<void>[] = [];
  for (const style of wanted) {
    const kinds = set.styles.get(style);
    if (!kinds) continue;
    let job = set.loading.get(style);
    if (!job) {
      job = Promise.all([...kinds.values()].map((e) => loadFile(set, e.file))).then(() => undefined);
      set.loading.set(style, job);
    }
    jobs.push(job);
  }
  return Promise.all(jobs).then(() => undefined);
}

/** Styles used by the living nations of a world (their age style and the next one), and whether any is nomadic. */
export function stylesInUse(countries: Country[]): { styles: Set<string>; nomadic: boolean } {
  const styles = new Set<string>(['medieval']);
  let nomadic = false;
  for (const c of countries) {
    if (c.alive === false) continue;
    styles.add(ageStyle(c));
    styles.add(nextAgeStyle(c)); // loaded ahead, so an age step never waits on a download
    if (c.nomadic) nomadic = true;
  }
  return { styles, nomadic };
}

export function partsFor(set: ModelSet, kind: string): ModelPart[] {
  return set.parts.get(kind) ?? set.fallback;
}
const STYLED = new Set(['capital', 'city', 'town', 'temple', 'fort']);
const NOMAD_KINDS = new Set(['camp', 'village', 'town']);

/**
 * The model for a kind in a nation: nomadic entry (camp, village, town), then its style, then the
 * style's fallback, then the shared model, then the box. `key` names the instanced mesh group.
 * `style` defaults to the nation's style for its tech age (towns/ageStyle).
 */
export function modelFor(set: ModelSet, kind: string, country?: Country, style: string = ageStyle(country)): Resolved {
  const usable = (style: string): Entry | null => {
    const e = set.styles.get(style)?.get(kind);
    return e && set.files.has(e.file) ? e : null;
  };
  let hit: Entry | null = null;
  if (country?.nomadic && NOMAD_KINDS.has(kind)) hit = usable('nomadic');
  if (!hit && set.styles.size) {
    for (const s of chain(style)) { hit = usable(s); if (hit) break; }
    if (!hit && import.meta.env.DEV && STYLED.has(kind)) set.misses.add(`${style}/${kind}`);
  }
  if (hit) return { key: hit.file, parts: set.files.get(hit.file)!, footprint: hit.footprint, real: true };
  const shared = set.parts.get(kind);
  if (shared) return { key: `${kind}:shared`, parts: shared, footprint: footprintFor(set, kind), real: true };
  return { key: `${kind}:box`, parts: set.fallback, footprint: footprintFor(set, kind), real: false };
}
export function hasModel(set: ModelSet, kind: string, country?: Country, style?: string): boolean { return modelFor(set, kind, country, style).real; }
export function footprintFor(set: ModelSet, kind: string): number {
  return set.footprint.get(kind) ?? DEFAULT_FOOTPRINT;
}

/** Dev only: once, say which style/kind pairs had no model and used a fallback. */
export function logMisses(set: ModelSet): void {
  if (!import.meta.env.DEV || !set.styles.size || !set.misses.size) return;
  console.debug(`structures: no styled model for ${[...set.misses].sort().join(', ')}; using fallbacks`);
  set.misses.clear();
}
