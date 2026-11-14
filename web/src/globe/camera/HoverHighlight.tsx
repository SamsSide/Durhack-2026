// A faint white overlay on the top face of the hovered province. Lane b.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useProvinceMesh } from '../mesh/context';
import { useHover } from './usePicking';

export function HoverHighlight() {
  const mesh = useProvinceMesh();
  const tile = useHover((s) => s.tile);

  const geometry = useMemo(() => {
    if (!mesh || tile < 0) return null;
    const start = mesh.tileVertexStart[tile];
    const count = mesh.tileTopVertexCount[tile];
    if (start == null || !count) return null;
    const src = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = src.getX(start + i) * 1.001;
      arr[i * 3 + 1] = src.getY(start + i) * 1.001;
      arr[i * 3 + 2] = src.getZ(start + i) * 1.001;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [mesh, tile]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} renderOrder={2} raycast={() => null}>
      <meshBasicMaterial color="#ffffff" opacity={0.18} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
