// Level of detail for the news picture-in-picture (the second camera in NewsPip.tsx). Lane a in lane b's globe.
//
// Layers that only show up close (towns, the living world) pick their detail from the main camera.
// While the news has a live shot on air and the main camera is out in orbit, they pick it from the
// shot's camera instead (`lodCamera`), and the PiP pass hides them again before the main view is
// drawn (`pipDetail`), so the main view never changes. Other layers hook the pass itself (`onPipPass`).
import type * as THREE from 'three';
import { useEffect, type RefObject } from 'react';

/** The main camera counts as "in orbit" beyond this distance: no close-up layer shows there. */
export const PIP_MAIN_FAR = 2.0;

export const pipLod = {
  /** The shot's camera while a shot is armed or on air, else null. */
  camera: null as THREE.PerspectiveCamera | null,
  /** True for the frames in which a layer was handed the shot's camera. */
  borrowed: false,
  /** Close-up layers stay hidden from an orbit main view until this time (ms): they fade out unseen. */
  hideUntil: 0,
};

/** The camera a close-up layer should take its detail from this frame. */
export function lodCamera<T extends THREE.Camera>(main: T): T | THREE.PerspectiveCamera {
  if (pipLod.camera && main.position.length() > PIP_MAIN_FAR) {
    pipLod.borrowed = true;
    return pipLod.camera;
  }
  return main;
}

const detail = new Set<THREE.Object3D>();
/** Register a close-up layer's root: the PiP pass hides it from an orbit main view. Returns the undo. */
export function pipDetail(obj: THREE.Object3D): () => void {
  detail.add(obj);
  return () => { detail.delete(obj); };
}
export function hideDetailFromMain(): void {
  for (const o of detail) o.visible = false;
}

type PassHook = (on: boolean, camera: THREE.PerspectiveCamera) => void;
const hooks = new Set<PassHook>();
/** Called with true just before the PiP picture is drawn and with false just after: set and restore. */
export function onPipPass(fn: PassHook): () => void {
  hooks.add(fn);
  return () => { hooks.delete(fn); };
}
export function runPipPass(on: boolean, camera: THREE.PerspectiveCamera): void {
  for (const h of hooks) h(on, camera);
}

/** Keep an object out of the PiP picture (names and markers laid out for the main camera). */
export function usePipHidden(ref: RefObject<THREE.Object3D | null>): void {
  useEffect(() => {
    let was = false;
    return onPipPass((on) => {
      const o = ref.current;
      if (!o) return;
      if (on) { was = o.visible; o.visible = false; } else o.visible = was;
    });
  }, [ref]);
}
