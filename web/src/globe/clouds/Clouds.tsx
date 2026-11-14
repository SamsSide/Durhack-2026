// Procedural cloud shells plus soft cloud shadows on the land (lane b).
// Two thin transparent spheres, drawn before the names so the names always read on top, and one
// faint shadow shell just over the terrain.
// One shared fbm CanvasTexture, generated once. Fades out as the camera zooms in.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FADE_FAR = 3.0; // fully visible above this camera distance
const FADE_NEAR = 2.3; // gone below this
const CLOUD_MAX = 0.22; // opacity cap so borders and names stay readable
const SHADOW_MAX = 0.06;
const COVER = 0.62; // noise threshold: higher means fewer, smaller puffs
const SOFT = 0.14; // edge softness of a puff
const RENDER_ORDER = 900; // before the names (1000) so the cloud shells never veil them
const R_CLOUD_A = 1.085;
const R_CLOUD_B = 1.105;
const R_SHADOW = 1.063; // just above the tallest terrain (1.06), under the labels' lift
const SPEED_A = 0.012; // rad/s
const SPEED_B = -0.007;
const SHADOW_OFFSET = 0.035; // rad shift toward the light

const hash = (x: number, y: number, z: number): number => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const sm = (t: number): number => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  const c = (i: number, j: number, k: number): number => hash(xi + i, yi + j, zi + k);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

function makeCloudTexture(): THREE.CanvasTexture {
  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2;
      const px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon);
      let a = 0, amp = 0.5, f = 3.1, sum = 0;
      for (let o = 0; o < 5; o++) {
        a += amp * vnoise(px * f + 11, py * f * 1.4 + 7, pz * f + 3);
        sum += amp; amp *= 0.5; f *= 2.05;
      }
      a /= sum;
      const d = Math.min(1, Math.max(0, (a - COVER) / SOFT));
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(sm(d) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function Clouds() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const s = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => makeCloudTexture(), []);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 64, 32), []);
  const reduced = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const mats = useMemo(() => {
    const mk = (color: string): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
    return { a: mk('#ffffff'), b: mk('#ffffff'), s: mk('#1a2230') };
  }, [tex]);
  useEffect(() => () => { tex.dispose(); geo.dispose(); mats.a.dispose(); mats.b.dispose(); mats.s.dispose(); }, [tex, geo, mats]);

  useFrame((state, dt) => {
    const d = state.camera.position.length();
    const f = smooth(FADE_NEAR, FADE_FAR, d);
    const meshes = [a.current, b.current, s.current];
    for (const m of meshes) if (m) m.visible = f > 0.01;
    if (f <= 0.01) return;
    mats.a.opacity = CLOUD_MAX * f;
    mats.b.opacity = CLOUD_MAX * 0.7 * f;
    mats.s.opacity = SHADOW_MAX * f;
    if (!reduced) {
      const step = Math.min(dt, 0.1);
      if (a.current) a.current.rotation.y += SPEED_A * step;
      if (b.current) b.current.rotation.y += SPEED_B * step;
    }
    // The shadow follows the lower cloud layer, shifted toward the light.
    if (s.current && a.current) {
      s.current.rotation.y = a.current.rotation.y - SHADOW_OFFSET;
      s.current.rotation.x = SHADOW_OFFSET * 0.6;
    }
  });

  return (
    <group>
      <mesh ref={s} geometry={geo} material={mats.s} scale={R_SHADOW} renderOrder={2} raycast={() => null} />
      <mesh ref={a} geometry={geo} material={mats.a} scale={R_CLOUD_A} renderOrder={RENDER_ORDER} raycast={() => null} />
      <mesh ref={b} geometry={geo} material={mats.b} scale={R_CLOUD_B} renderOrder={RENDER_ORDER + 1} raycast={() => null} />
    </group>
  );
}
