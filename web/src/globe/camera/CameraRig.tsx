// Camera: drei CameraControls (orbit + smooth zoom, no pan) and fly-to via the camera store. Lane b.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type { CameraControls as CameraControlsImpl } from '@react-three/drei';
import { useCamera } from '../../state/camera';
import { useWorld } from '../../state/world';
import { CAM_MAX, CAM_MIN } from '../constants';
import { flyControlsTo, onFocusTile } from '../events/focus';

const NONE = 0; // camera-controls ACTION.NONE
const FLY_DISTANCE = 1.6;
const FLY_SMOOTH = 0.4; // about 1.2 s to settle
const SMOOTH = 0.25;

// Pixels to shift the view sideways so the selected nation sits in the free space between the
// folded network tab (left) and the nation card (right). 0 with no selection or on narrow screens.
function readPx(name: string, fallback: number): number {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}
function focalOffsetPx(selected: boolean): number {
  if (!selected || typeof window === 'undefined' || window.innerWidth < 1100) return 0;
  const card = readPx('--card-width', 380);
  const tab = readPx('--net-tab-width', 40);
  const margin = 16;
  return (card + margin - (tab + margin)) / 2; // card side minus tab side, halved
}

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const flyingUntil = useRef(0);
  const selected = useWorld((s) => s.selectedCountryId != null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const lastOff = useRef({ d: -1, h: -1, w: -1, sel: false, t: 0 });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.mouseButtons.right = NONE;
    c.mouseButtons.middle = NONE;
    c.touches.three = NONE;
    const A = (c.constructor as unknown as { ACTION: Record<string, number> }).ACTION;
    c.touches.two = (A.TOUCH_DOLLY ?? 0) as typeof c.touches.two;
    // Dev only: lets a browser review set the zoom exactly (window.__cam.dollyTo(3.5, false)).
    if (import.meta.env.DEV) (window as unknown as { __cam?: unknown }).__cam = c;
  }, []);

  // Rotation speed scales with distance so close-up dragging is not twitchy.
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    const d = c.distance;
    const speed = 0.25 + 0.75 * Math.min(1, Math.max(0, (d - CAM_MIN) / (CAM_MAX - CAM_MIN)));
    c.azimuthRotateSpeed = speed;
    c.polarRotateSpeed = speed;
    // Keep the sideways view shift right as zoom, window size and selection change (throttled).
    const now = performance.now();
    const last = lastOff.current;
    const sel = selectedRef.current;
    const h = window.innerHeight;
    const w = window.innerWidth;
    const changed =
      sel !== last.sel || h !== last.h || w !== last.w || Math.abs(d - last.d) > 0.02 * Math.max(d, 0.1);
    if (changed && now - last.t > 100) {
      const cam = c.camera as { fov?: number };
      const fov = ((cam.fov ?? 45) * Math.PI) / 180;
      const px = focalOffsetPx(sel);
      const world = (px / Math.max(h, 1)) * 2 * d * Math.tan(fov / 2);
      void c.setFocalOffset(world, 0, 0, true);
      lastOff.current = { d, h, w, sel, t: now };
    }
    if (flyingUntil.current && performance.now() > flyingUntil.current) {
      flyingUntil.current = 0;
      c.smoothTime = SMOOTH;
    }
  });

  const nonce = useCamera((s) => s.nonce);
  useEffect(() => {
    const c = ref.current;
    const { target } = useCamera.getState();
    const w = useWorld.getState().world;
    const country = target != null ? w?.countries[target] : undefined;
    const centre = country && w ? w.tiles[country.capitalTile]?.center : undefined;
    if (!c || !centre) return;
    const len = Math.hypot(centre[0], centre[1], centre[2]) || 1;
    const polar = Math.acos(Math.min(1, Math.max(-1, centre[1] / len)));
    let azimuth = Math.atan2(centre[0], centre[2]);
    const cur = c.azimuthAngle;
    azimuth += Math.round((cur - azimuth) / (2 * Math.PI)) * 2 * Math.PI; // shortest way round
    c.smoothTime = FLY_SMOOTH;
    flyingUntil.current = performance.now() + 1400;
    void c.rotateTo(azimuth, polar, true);
    void c.dollyTo(FLY_DISTANCE, true);
  }, [nonce]);

  // Fly to a single tile: beacon clicks, the spotlight tour, 'terra:focus-tile' from the feed.
  useEffect(() => onFocusTile((tile) => {
    const c = ref.current;
    const centre = useWorld.getState().world?.tiles[tile]?.center;
    if (!c || !centre) return;
    flyingUntil.current = performance.now() + 1400;
    flyControlsTo(c, centre);
  }), []);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={CAM_MIN}
      maxDistance={CAM_MAX}
      smoothTime={SMOOTH}
      draggingSmoothTime={0.12}
      dollySpeed={0.6}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI - 0.05}
    />
  );
}
