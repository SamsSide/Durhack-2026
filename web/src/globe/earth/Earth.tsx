// Before a world exists (the Create and founding screens): the real Earth in the game's own tiles,
// slowly turning under its own soft daylight, about to be remade. Lane a.
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPalette } from '../palette';
import { SEA_LEVEL } from '../constants';
import { prefersReducedMotion } from '../camera/motion';
import { buildEarth } from './buildEarth';

/** Seconds for one full turn. */
export const EARTH_TURN_SECONDS = 105;
/** Longitude facing the start camera at load, in degrees: Africa and Europe, with the Atlantic turning in. */
const START_LON = 0;
/** The daylight that follows the camera, from over its upper-left shoulder. */
const DAY = '#fff1dc';
const DAY_INTENSITY = 1.5;

/** A key light that keeps the side facing the camera in daylight, wherever the game's sun is. */
function Daylight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const side = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    const l = light.current;
    if (!l) return;
    side.current.set(0, 1, 0).cross(camera.position).normalize(); // the camera's right
    l.position.copy(camera.position).normalize().addScaledVector(side.current, -0.6);
    l.position.y += 0.45;
    l.position.multiplyScalar(10);
  });
  return <directionalLight ref={light} color={DAY} intensity={DAY_INTENSITY} />;
}

export function Earth() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const spin = useRef<THREE.Group>(null);
  const still = useRef(prefersReducedMotion());
  const angle = useRef((-START_LON * Math.PI) / 180);

  // Built once, a beat after the first frame so the page paints first; disposed when the world arrives.
  useEffect(() => {
    let made: THREE.BufferGeometry | null = null;
    const timer = setTimeout(() => { made = buildEarth(); setGeometry(made); }, 0);
    return () => { clearTimeout(timer); made?.dispose(); };
  }, []);

  useFrame((_, dt) => {
    if (!spin.current) return;
    // west to east, like the real one; held still for prefers-reduced-motion
    if (!still.current) angle.current = (angle.current + (Math.min(dt, 0.1) * Math.PI * 2) / EARTH_TURN_SECONDS) % (Math.PI * 2);
    spin.current.rotation.y = angle.current;
  });

  return (
    <>
      <Daylight />
      <group ref={spin} rotation-y={(-START_LON * Math.PI) / 180}>
        {geometry ? (
          <mesh name="earth" geometry={geometry}>
            <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
          </mesh>
        ) : (
          // the bare sea for the instant before the tiles are ready
          <mesh>
            <sphereGeometry args={[SEA_LEVEL, 96, 64]} />
            <meshStandardMaterial color={getPalette().ocean} roughness={0.85} metalness={0} />
          </mesh>
        )}
      </group>
    </>
  );
}
