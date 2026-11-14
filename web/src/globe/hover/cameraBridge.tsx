// Hands the globe's camera and controls to DOM widgets outside the Canvas (the minimap). Lane b.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';

interface RotatingControls {
  azimuthAngle: number;
  rotateTo(azimuth: number, polar: number, smooth?: boolean): Promise<void>;
}

let current: { camera: THREE.Camera; controls: RotatingControls | null } | null = null;

/** The live camera and drei CameraControls (makeDefault), or null before the globe mounts. */
export function globeCamera(): typeof current {
  return current;
}

/** Turn the globe so the camera looks straight down at this longitude and latitude (radians). */
export function lookAtLonLat(lon: number, lat: number): void {
  const c = current?.controls;
  if (!c) return;
  const polar = Math.min(Math.PI - 0.05, Math.max(0.05, Math.PI / 2 - lat));
  let azimuth = lon; // azimuth = atan2(x, z), the same convention as CameraRig's fly-to
  azimuth += Math.round((c.azimuthAngle - azimuth) / (2 * Math.PI)) * 2 * Math.PI;
  void c.rotateTo(azimuth, polar, true);
}

/** Mount inside the Canvas. */
export function CameraBridge(): null {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as RotatingControls | null;
  useEffect(() => {
    current = { camera, controls: controls && typeof controls.rotateTo === 'function' ? controls : null };
    return () => { current = null; };
  }, [camera, controls]);
  return null;
}
