// Camera: drei CameraControls (orbit + smooth zoom, no pan) and fly-to via the camera store. Lane b.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type { CameraControls as CameraControlsImpl } from '@react-three/drei';
import { useCamera } from '../../state/camera';
import { useWorld } from '../../state/world';
import { CAM_MAX, CAM_MIN } from '../constants';

const NONE = 0; // camera-controls ACTION.NONE
const FLY_DISTANCE = 1.6;
const FLY_SMOOTH = 0.4; // about 1.2 s to settle
const SMOOTH = 0.25;

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const flyingUntil = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.mouseButtons.right = NONE;
    c.mouseButtons.middle = NONE;
    c.touches.three = NONE;
    const A = (c.constructor as unknown as { ACTION: Record<string, number> }).ACTION;
    c.touches.two = (A.TOUCH_DOLLY ?? 0) as typeof c.touches.two;
  }, []);

  // Rotation speed scales with distance so close-up dragging is not twitchy.
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    const d = c.distance;
    const speed = 0.25 + 0.75 * Math.min(1, Math.max(0, (d - CAM_MIN) / (CAM_MAX - CAM_MIN)));
    c.azimuthRotateSpeed = speed;
    c.polarRotateSpeed = speed;
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
