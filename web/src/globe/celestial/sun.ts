// Shared sun state for the celestial layer (lane b). One mutable vector, updated once per frame by <SunClock>.
import * as THREE from 'three';

/** Set false to freeze the day/night cycle (prefers-reduced-motion freezes it too). */
export const SUN_CYCLE = true;
/** Seconds for one full day at 1x. */
export const DAY_SECONDS = 120;
/** How far the sun sits from the planet (inside the starfield at 60). */
export const SUN_DIST = 40;

/** Sun at load: behind the planet, just off its upper-left limb as seen from the start camera. */
const BASE = new THREE.Vector3(-0.42, 0.0, -0.9).normalize();
const AXIS = new THREE.Vector3(0.3, 1, 0).normalize(); // tilted so the sun climbs and dips over a day

/** Unit vector from the planet towards the sun, in world space. Read it, never replace it. */
export const sunDir = BASE.clone();

let angle = 0;

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Advance the sun by `dt` seconds of wall time; `rate` is 0 when the world clock is paused. */
export function advanceSun(dt: number, rate: number): void {
  if (SUN_CYCLE && rate > 0) angle = (angle + (dt * rate * Math.PI * 2) / DAY_SECONDS) % (Math.PI * 2);
  if (held) sunDir.copy(held);
  else sunDir.copy(BASE).applyAxisAngle(AXIS, angle);
}

/** Jump the cycle to an angle in radians (QA and capture). */
export function setSunAngle(a: number): void { angle = a; }
/** Point the sun along a direction and hold it there (QA and capture); `null` resumes the cycle. */
let held: THREE.Vector3 | null = null;
export function holdSun(v: [number, number, number] | null): void { held = v ? new THREE.Vector3(...v).normalize() : null; }

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A soft radial sprite texture drawn once on a canvas. `stops` are [offset, rgba] pairs. */
export function radialTexture(stops: [number, string][], size = 128): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
