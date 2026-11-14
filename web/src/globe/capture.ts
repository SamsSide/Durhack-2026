// Snapshot of the globe canvas for Terra Nova News (X5, row A21). Lane b.
import { addAfterEffect } from '@react-three/fiber';
import type * as THREE from 'three';

type Rig = { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera };
let rig: Rig | null = null;

/** Called by the Globe's CaptureBridge; null on unmount. */
export function registerCapture(r: Rig | null): void {
  rig = r;
}

const FULL_W = 1280;
const FULL_H = 720;

type Shot = { imageBase64: string; mimeType: 'image/jpeg' };

// B8: the encoder worker. undefined: not tried yet; null: not available here (the main thread encodes).
let worker: Worker | null | undefined;
let jobs = 0;
const waiting = new Map<number, { resolve: (b64: string) => void; reject: (e: Error) => void }>();

function encoder(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') throw new Error('unsupported');
    const w = new Worker(new URL('./captureWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; imageBase64?: string; error?: string }>) => {
      const job = waiting.get(e.data.id);
      if (!job) return;
      waiting.delete(e.data.id);
      if (e.data.imageBase64) job.resolve(e.data.imageBase64); else job.reject(new Error(e.data.error ?? 'encode failed'));
    };
    w.onerror = () => {
      worker = null;
      for (const job of waiting.values()) job.reject(new Error('capture worker failed'));
      waiting.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Runs `fn` right after the globe's next frame, in the same task, while the drawing buffer is still valid. */
function afterNextFrame<T>(fn: () => T, lateMs: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (run: boolean): void => {
      if (settled) return;
      settled = true;
      off();
      window.clearTimeout(timer);
      try { resolve(run ? fn() : null); } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
    };
    const off = addAfterEffect(() => finish(true));
    const timer = window.setTimeout(() => finish(false), lateMs);
  });
}

/** The worker path: a GPU-side copy of the frame here, the read-back and the JPEG in the worker. Null when it cannot be used. */
async function captureInWorker(W: number, H: number): Promise<Shot | null> {
  const w = encoder();
  if (!w) return null;
  try {
    const pending = await afterNextFrame(() => (rig ? createImageBitmap(rig.gl.domElement) : null), 300);
    const bitmap = pending ? await pending : null;
    if (!bitmap) return null;   // no frame came (a hidden tab), or the globe went away
    const id = ++jobs;
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      window.setTimeout(() => { if (waiting.delete(id)) reject(new Error('capture worker timed out')); }, 4000);
      w.postMessage({ id, bitmap, width: W, height: H }, [bitmap]);
    });
    return { imageBase64, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('globe capture: the worker path failed, encoding on the main thread', err);
    return null;
  }
}

/**
 * A JPEG (1280 x 720 unless a smaller size is asked for, quality 0.8) of the current globe view, without
 * any HUD on top. The frame is scaled and encoded in a worker, so the globe does not stall; where that is
 * not possible it is encoded here, which blocks the main thread for 30 ms or more whatever the size.
 */
export async function captureGlobe(size?: { width: number; height: number }): Promise<Shot> {
  if (!rig) throw new Error('globe is not mounted');
  const W = Math.max(16, Math.round(size?.width ?? FULL_W));
  const H = Math.max(9, Math.round(size?.height ?? FULL_H));
  const shot = await captureInWorker(W, H);
  if (shot) return shot;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const copy = (renderFirst: boolean): void => {
    if (!rig) throw new Error('globe is not mounted');
    const { gl, scene, camera } = rig;
    if (renderFirst) gl.render(scene, camera);
    const src = gl.domElement;
    // Cover-fit the viewport into 16:9.
    const scale = Math.max(W / src.width, H / src.height);
    const dw = src.width * scale;
    const dh = src.height * scale;
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  };
  // B8: copy the frame the globe has just drawn. An after-render callback runs in the same task as the
  // render, so the drawing buffer is still valid and preserveDrawingBuffer is not needed. Only when no
  // frame comes (a hidden tab) is the scene rendered here a second time, as it used to be on every call.
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (renderFirst: boolean): void => {
      if (settled) return;
      settled = true;
      off();
      window.clearTimeout(timer);
      try { copy(renderFirst); resolve(); } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
    };
    const off = addAfterEffect(() => finish(false));
    const timer = window.setTimeout(() => finish(true), 300);
  });
  const url = out.toDataURL('image/jpeg', 0.8);
  return { imageBase64: url.slice(url.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
