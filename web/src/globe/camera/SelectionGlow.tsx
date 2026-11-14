// Pulsing cyan (hologram tint) outline around the selected nation. Lane b.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';

type P3 = [number, number, number];

/** Cheap fingerprint of a nation's tiles: changes when it gains or loses one. */
function fingerprint(owner: ArrayLike<number>, id: number): string {
  let n = 0, h = 0;
  for (let t = 0; t < owner.length; t++) if (owner[t] === id) { n++; h = (h * 31 + t + 1) >>> 0; }
  return `${id}:${n}:${h}`;
}

export function SelectionGlow() {
  const mesh = useProvinceMesh();
  const [points, setPoints] = useState<P3[] | null>(null);
  const lineRef = useRef<{ material: THREE.Material & { opacity: number } } | null>(null);

  useEffect(() => {
    if (!mesh) { setPoints(null); return; }
    let lastKey = '';
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const rebuild = () => {
      timer = null;
      last = performance.now();
      const { world, selectedCountryId: sel } = useWorld.getState();
      if (!world || sel == null) { if (lastKey !== '') { lastKey = ''; setPoints(null); } return; }
      const key = fingerprint(world.owner, sel);
      if (key === lastKey) return;
      lastKey = key;
      const pts: P3[] = [];
      for (const e of mesh.edges) {
        const a = (world.owner[e.tileA] ?? -1) === sel;
        const b = (world.owner[e.tileB] ?? -1) === sel;
        if (a !== b) pts.push([e.a[0], e.a[1], e.a[2]], [e.b[0], e.b[1], e.b[2]]);
      }
      setPoints(pts.length ? pts : null);
    };
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(rebuild, Math.max(0, 500 - (performance.now() - last))); // 2 Hz
    };
    rebuild();
    const unsub = useWorld.subscribe(schedule);
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [mesh]);

  useFrame(({ clock }) => {
    const m = lineRef.current?.material;
    if (m) m.opacity = 0.8 + 0.2 * Math.sin(clock.elapsedTime * Math.PI * 2);
  });

  const blending = useMemo(() => THREE.AdditiveBlending, []);
  if (!mesh || !points) return null;
  return (
    <Line
      ref={lineRef as never}
      points={points}
      segments
      color={getPalette().holo}
      lineWidth={4}
      transparent
      opacity={0.8}
      blending={blending}
      depthWrite={false}
      renderOrder={3}
    />
  );
}
