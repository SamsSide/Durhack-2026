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

/**
 * A JPEG (1280 x 720 unless a smaller size is asked for, quality 0.8) of the current globe view, without
 * any HUD on top. Encoding blocks the main thread for about 30 ms at full size: a caller that only shows
 * a thumbnail should pass its own size (16:9).
 */
export async function captureGlobe(size?: { width: number; height: number }): Promise<{ imageBase64: string; mimeType: 'image/jpeg' }> {
  if (!rig) throw new Error('globe is not mounted');
  const W = Math.max(16, Math.round(size?.width ?? FULL_W));
  const H = Math.max(9, Math.round(size?.height ?? FULL_H));
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
