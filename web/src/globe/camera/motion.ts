// Camera motion: the same feel as the interface tokens (theme/tokens.css, --motion-*), in seconds.
// Every move is a critically damped spring: it leaves from rest (no linear start), lands without
// overshoot, and a new target mid-flight bends the path instead of restarting it.

/** Settle time of a damped move is about 3.4 smooth times (inside 1% of the way). */
export const SETTLE = 3.4;
/** Wheel zoom and the release of a drag. */
export const SMOOTH = 0.25;
/** The left-panel shift: settles in about 0.55 s, a beat behind the panel's own 240 ms slide. */
export const SHIFT_SMOOTH = 0.16;
/** A fly-to: the shortest hop settles in about 0.9 s, a trip to the far side in about 1.8 s. */
const FLY_NEAR = 0.26, FLY_FAR = 0.52;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Smooth time for a fly-to, scaled by how far it goes: `angle` in radians (0..pi) and the zoom ratio. */
export function flySmoothTime(angle: number, fromDistance: number, toDistance: number): number {
  const zoom = Math.abs(Math.log(Math.max(1e-3, fromDistance) / Math.max(1e-3, toDistance)));
  const travel = Math.min(1, angle / Math.PI + 0.35 * zoom);
  // Ease the scale itself, so a medium hop is not much slower than a short one.
  return FLY_NEAR + (FLY_FAR - FLY_NEAR) * Math.sqrt(travel);
}

/** Angle between two directions given as (azimuth, polar) pairs on the orbit sphere. */
export function orbitAngle(az0: number, pol0: number, az1: number, pol1: number): number {
  const d = Math.sin(pol0) * Math.sin(pol1) * Math.cos(az0 - az1) + Math.cos(pol0) * Math.cos(pol1);
  return Math.acos(Math.min(1, Math.max(-1, d)));
}

/** One step of a critically damped spring towards `target`. `state.v` carries the velocity between frames. */
export function smoothDamp(current: number, target: number, state: { v: number }, smoothTime: number, dt: number): number {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  if ((target - current > 0) === (out > target)) { out = target; state.v = 0; }   // never past the target
  return out;
}
