// Believable speeds: how fast each kind of unit may cross the globe and the screen. A move the game
// speed would make faster than this is not animated: the unit fades out where it stands and fades in
// where it lands (UnitLayer, traders). Kept in one place so every moving thing agrees. Lane a in lane
// b's globe (owner decision, 14 Nov).
import type * as THREE from 'three';
import type { UnitKind } from '@terra/shared';

export type MoverKind = UnitKind | 'air';

/** Fastest glide in globe units (planet radii) a real second: traders slowest, then armies, ships, aircraft. */
export const SPEED_CAP: Record<MoverKind, number> = { trader: 0.34, settler: 0.34, army: 0.38, fleet: 0.45, air: 0.6 };
/** Fastest glide as a share of the view's height a real second (so a close-up never streaks). */
export const VIEW_CAP: Record<MoverKind, number> = { trader: 0.24, settler: 0.24, army: 0.28, fleet: 0.34, air: 0.5 };

/** A dissolve: half of it fading out at the old tile, half fading in at the new one. */
export const DISSOLVE_MS = 700;
/** A unit that just landed rests this long before it may dissolve again (no flicker at high speed). */
export const DWELL_MS = 1100;

/** Height of what the camera sees at the planet's surface, in globe units. */
export function viewHeight(camera: THREE.Camera, dist: number): number {
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
  return Math.max(0.1, 2 * Math.tan((fov * Math.PI) / 360) * (dist - 1));
}

/** Globe units a real second for a move of `angle` radians taking `ms`. */
export const moveSpeed = (angle: number, ms: number): number => angle / Math.max(0.001, ms / 1000);

/** The cap for a kind at this zoom: the lower of the absolute and the on-screen cap. */
export const speedCap = (kind: MoverKind, viewH: number): number => Math.min(SPEED_CAP[kind], VIEW_CAP[kind] * viewH);

export function tooFast(kind: MoverKind, angle: number, ms: number, viewH: number): boolean {
  return moveSpeed(angle, ms) > speedCap(kind, viewH);
}

/**
 * Opacity through a dissolve from t0 to t1: 1 while it waits to start, down to 0 at the middle, back
 * to 1 at the end. `inAt` is when the unit last began to fade in, so a wait straight after a landing
 * finishes that fade first.
 */
export function dissolveAlpha(now: number, t0: number, t1: number, inAt: number): number {
  const half = DISSOLVE_MS / 2;
  const arrived = Math.min(1, Math.max(0, (now - inAt) / half));
  if (now < t0) return arrived;
  if (now >= t1) return 1;
  const p = (now - t0) / (t1 - t0);
  return p < 0.5 ? Math.min(arrived, 1 - 2 * p) : 2 * p - 1;
}
