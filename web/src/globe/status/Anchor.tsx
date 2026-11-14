// A small HTML tag pinned to a point on the globe; hidden when that point is on the far side. Lane b (B7).
import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { P3 } from './geo';
import { underHud } from './hudCover';

export function Anchor({ pos, dx = 0, dy = 0, limb, children }: { pos: P3; dx?: number; dy?: number; limb?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const dir = useMemo(() => new THREE.Vector3(...pos).normalize(), [pos]);
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const dist = camera.position.length();
    const facing = camera.position.dot(dir) / dist;
    // limb (0..1): hide this share of the way from the horizon (cos = 1 / dist) to straight below
    const h = Math.min(1, 1 / dist);
    const minFacing = limb == null ? 0.15 : h + (1 - h) * limb;
    const covered = document.querySelector('.closing-veil') !== null;
    const shown = facing > minFacing && !covered && !underHud(el);
    el.style.opacity = shown ? '1' : '0'; // never over a HUD panel (#175)
    el.classList.toggle('gs-hidden', !shown); // and never clickable while hidden
  });
  return (
    <Html position={pos} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="gs-anchor" style={{ transform: `translate(${dx}px, ${dy}px)` }}>{children}</div>
    </Html>
  );
}
