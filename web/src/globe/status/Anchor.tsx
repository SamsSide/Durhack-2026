// A small HTML tag pinned to a point on the globe; hidden when that point is on the far side. Lane b (B7).
import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { P3 } from './geo';

export function Anchor({ pos, dx = 0, dy = 0, children }: { pos: P3; dx?: number; dy?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const dir = useMemo(() => new THREE.Vector3(...pos).normalize(), [pos]);
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const facing = camera.position.dot(dir) / camera.position.length();
    el.style.opacity = facing > 0.15 ? '1' : '0';
  });
  return (
    <Html position={pos} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="gs-anchor" style={{ transform: `translate(${dx}px, ${dy}px)` }}>{children}</div>
    </Html>
  );
}
