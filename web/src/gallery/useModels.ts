// Gallery model sources: the X4 manifest's GLBs (loaded once each) and the code-built prototypes.
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Entry { file: string; footprint: number }
export interface Manifest { models?: Record<string, Entry>; styles?: Record<string, Record<string, Entry>> }

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
const loader = new GLTFLoader();
const files = new Map<string, Promise<THREE.Object3D | null>>();

export function useManifest(): { manifest: Manifest | null; error: string | null } {
  const [state, setState] = useState<{ manifest: Manifest | null; error: string | null }>({ manifest: null, error: null });
  useEffect(() => {
    let alive = true;
    fetch(`${BASE}models/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((m: Manifest) => alive && setState({ manifest: m, error: null }))
      .catch((e: unknown) => alive && setState({ manifest: { models: {}, styles: {} }, error: String(e) }));
    return () => { alive = false; };
  }, []);
  return state;
}

export function loadGlb(file: string): Promise<THREE.Object3D | null> {
  let p = files.get(file);
  if (!p) {
    p = loader.loadAsync(`${BASE}models/${file}`).then((g) => g.scene as THREE.Object3D).catch((err: unknown) => {
      console.warn(`gallery: ${file} failed`, err);
      return null;
    });
    files.set(file, p);
  }
  return p;
}

/**
 * A private copy of a model for one cell: own materials (so the team tint is per cell), flat
 * shading like the globe, shadows on, and the triangle count in userData.tris.
 */
export function cellCopy(src: THREE.Object3D): THREE.Object3D {
  const obj = src.clone(true);
  let tris = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mat = (Array.isArray(m.material) ? m.material[0]! : m.material).clone();
    if ('flatShading' in mat) { (mat as THREE.MeshStandardMaterial).flatShading = true; mat.needsUpdate = true; }
    m.material = mat;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  obj.userData.tris = tris;
  return obj;
}

export function tint(obj: THREE.Object3D, colour: string): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.name === 'team' && mat.color) mat.color.set(colour);
  });
}
