// A small HTML tag pinned to a point on the globe; hidden when that point is on the far side. Lane b (B7).
// With `noClip`, the tag hides rather than show cut off by the top bar. With `stack`, the tag joins its city's marker column (cityStack.ts) instead of using a fixed dy.
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { P3 } from './geo';
import { underHud, underTopBar } from './hudCover';
import { joinStack, leaveStack, stackOffset } from './cityStack';
import type { StackEntry, StackSpec } from './cityStack';

export function Anchor({ pos, dx = 0, dy = 0, limb, stack, noClip, children }: { pos: P3; dx?: number; dy?: number; limb?: number; stack?: StackSpec; noClip?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const dir = useMemo(() => new THREE.Vector3(...pos).normalize(), [pos]);
  const slot = useRef<StackEntry | null>(null);
  const curY = useRef<number | null>(null);
  const tile = stack?.tile, priority = stack?.priority, scale = stack?.scale ?? 1;
  const ro = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    if (tile == null || priority == null) return;
    const e = joinStack(tile, priority);
    slot.current = e;
    curY.current = null;
    return () => { ro.current?.disconnect(); ro.current = null; leaveStack(e); if (slot.current === e) slot.current = null; };
  }, [tile, priority]);
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const dist = camera.position.length();
    const facing = camera.position.dot(dir) / dist;
    // limb (0..1): hide this share of the way from the horizon (cos = 1 / dist) to straight below
    const h = Math.min(1, 1 / dist);
    const minFacing = limb == null ? 0.15 : h + (1 - h) * limb;
    const covered = document.querySelector('.closing-veil') !== null;
    const shown = facing > minFacing && !covered && !underHud(el) && !(noClip && underTopBar(el));
    el.style.opacity = shown ? '1' : '0'; // never over a HUD panel (#175)
    el.classList.toggle('gs-hidden', !shown); // and never clickable while hidden
    const e = slot.current;
    if (e && !ro.current && typeof ResizeObserver !== 'undefined') {
      // drei's Html mounts its children a little later than our effects, so start measuring here
      ro.current = new ResizeObserver(() => { e.height = el.offsetHeight * scale; e.width = el.offsetWidth * scale; });
      ro.current.observe(el);
    }
    if (e) {
      // centre of this marker: the bottom of its slot plus half its own height; glide when the column changes
      const goal = -(stackOffset(e) + e.height / 2);
      const y = curY.current == null || e.height === 0 ? goal : curY.current + (goal - curY.current) * 0.25;
      if (curY.current !== y) {
        curY.current = Math.abs(goal - y) < 0.3 ? goal : y;
        el.style.transform = `translate(${dx}px, ${curY.current.toFixed(1)}px)`;
      }
    }
  });
  return (
    <Html position={pos} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="gs-anchor" style={stack ? undefined : { transform: `translate(${dx}px, ${dy}px)` }}>{children}</div>
    </Html>
  );
}
