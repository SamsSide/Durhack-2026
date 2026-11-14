// Fly the camera to a tile: beacon clicks, the spotlight tour and lane c's feed cards
// (window event 'terra:focus-tile' with { detail: { tileId } }). CameraRig listens. Lane b.
import type { CameraControls as CameraControlsImpl } from '@react-three/drei';

export const FOCUS_DISTANCE = 1.45;
export const FOCUS_SMOOTH = 0.4; // about 1.2 s to settle

/** 'user' for a click or a feed card (pauses the spotlight tour); 'tour' for the tour itself. */
export type FocusSource = 'user' | 'tour';
type Listener = (tileId: number, source: FocusSource) => void;

const listeners = new Set<Listener>();
let windowHooked = false;

function hookWindow(): void {
  if (windowHooked || typeof window === 'undefined') return;
  windowHooked = true;
  window.addEventListener('terra:focus-tile', (e) => {
    const id = (e as CustomEvent<{ tileId?: unknown }>).detail?.tileId;
    if (typeof id === 'number' && Number.isFinite(id)) focusTile(id, 'user');
  });
}

export function focusTile(tileId: number, source: FocusSource = 'user'): void {
  for (const l of listeners) l(tileId, source);
}

export function onFocusTile(l: Listener): () => void {
  hookWindow();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Turn the orbit camera to look straight down at a point on the globe from `distance`. */
export function flyControlsTo(c: CameraControlsImpl, centre: readonly [number, number, number], distance = FOCUS_DISTANCE): void {
  const len = Math.hypot(centre[0], centre[1], centre[2]) || 1;
  const polar = Math.acos(Math.min(1, Math.max(-1, centre[1] / len)));
  let azimuth = Math.atan2(centre[0], centre[2]);
  azimuth += Math.round((c.azimuthAngle - azimuth) / (2 * Math.PI)) * 2 * Math.PI; // shortest way round
  c.smoothTime = FOCUS_SMOOTH;
  void c.rotateTo(azimuth, polar, true);
  void c.dollyTo(distance, true);
}
