// Snapshot of the globe canvas for Terra Nova News (X5, row A21). Lane b.
import type * as THREE from 'three';

type Rig = { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera };
let rig: Rig | null = null;

/** Called by the Globe's CaptureBridge; null on unmount. */
export function registerCapture(r: Rig | null): void {
  rig = r;
}

const W = 1280;
const H = 720;

/** A JPEG (about 1280 x 720, quality 0.8) of the current globe view, without any HUD on top. */
export async function captureGlobe(): Promise<{ imageBase64: string; mimeType: 'image/jpeg' }> {
  if (!rig) throw new Error('globe is not mounted');
  const { gl, scene, camera } = rig;
  // Render a frame, then read the canvas in the same task, so preserveDrawingBuffer is not needed.
  gl.render(scene, camera);
  const src = gl.domElement;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  // Cover-fit the viewport into 16:9.
  const scale = Math.max(W / src.width, H / src.height);
  const dw = src.width * scale;
  const dh = src.height * scale;
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const url = out.toDataURL('image/jpeg', 0.8);
  return { imageBase64: url.slice(url.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
