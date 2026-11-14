// Lane b: rivers, waterfalls and lakes on the globe. Mount inside the ProvinceMeshContext provider.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { getPalette } from '../palette';
import { buildRiverGeometry, makeRiverMaterial } from './buildRivers';

export function Rivers() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const worldKey = world ? `${world.id}:${world.seed}:${world.tiles.length}` : null;

  // Tiles never change for a world, so build once per world (not per tick).
  const built = useMemo(() => {
    const w = useWorld.getState().world;
    if (!mesh || !w || !worldKey) return null;
    return buildRiverGeometry(w, mesh.heights);
  }, [mesh, worldKey]);
  const material = useMemo(() => makeRiverMaterial(getPalette().ocean), []);

  useEffect(() => () => built?.geometry.dispose(), [built]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
    // Wider when far out so rivers stay visible as thin lines from orbit.
    material.uniforms.uWide!.value = Math.min(2.4, Math.max(1, camera.position.length() / 1.6));
  });

  if (!built) return null;
  return <mesh geometry={built.geometry} material={material} renderOrder={2} />;
}

