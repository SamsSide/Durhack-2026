// B11: a pulsing amber-to-red ring around the capital of a nation that is mobilised for war
// (war readiness 50 and up); bigger and faster the closer it is to total war. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { useSlowVersion } from '../../ui/useSlowVersion';
import { useProvinceMesh } from '../mesh/context';

const MIN_READINESS = 50;
const LIFT = 0.012;
const AMBER = new THREE.Color('#ffb02e');
const RED = new THREE.Color('#e0281c');
const Z = new THREE.Vector3(0, 0, 1);

interface Ring { pos: THREE.Vector3; quat: THREE.Quaternion; r: number }

function Pool({ rings }: { rings: Ring[] }) {
  const geo = useMemo(() => new THREE.RingGeometry(0.7, 1, 56), []);
  const mats = useMemo(() => rings.flatMap(() => [0, 1].map(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }))), [rings]);
  const group = useRef<THREE.Group>(null);
  useEffect(() => () => { geo.dispose(); }, [geo]);
  useEffect(() => () => { mats.forEach((m) => m.dispose()); }, [mats]);
  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    // From orbit the ring marks the capital; close up it would be a red slab through the town, so it thins out.
    const near = THREE.MathUtils.smoothstep(camera.position.length(), 1.3, 1.9);
    const fade = 0.12 + 0.88 * near;
    g.children.forEach((child, i) => {
      const ring = rings[Math.floor(i / 2)];
      if (!ring) return;
      const k = ring.r / 100;
      const speed = 1.2 + 2.2 * k;
      const phase = (t * speed / (Math.PI * 2) + Math.floor(i / 2) * 0.37) % 1;
      const base = 0.02 + 0.035 * k;
      const halo = i % 2 === 1;
      const s = halo ? base * (1 + 1.4 * phase) : base * (1 + 0.08 * Math.sin(t * speed * 2));
      child.scale.set(s, s, s);
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.copy(AMBER).lerp(RED, Math.min(1, (ring.r - MIN_READINESS) / 40));
      mat.opacity = (halo ? (1 - phase) * (0.35 + 0.5 * k) : 0.55 + 0.35 * k) * fade;
    });
  });
  return (
    <group ref={group}>
      {rings.flatMap((r, i) => [0, 1].map((j) => (
        <mesh key={`${i}:${j}`} geometry={geo} material={mats[i * 2 + j]!} position={r.pos} quaternion={r.quat} renderOrder={8} />
      )))}
    </group>
  );
}

export function Readiness() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const version = useSlowVersion();
  const rings = useMemo<Ring[]>(() => {
    if (!mesh || !world) return [];
    const out: Ring[] = [];
    for (const c of world.countries) {
      const r = c?.warReadiness ?? 0;
      if (!c || c.alive === false || r < MIN_READINESS || !world.tiles[c.capitalTile]) continue;
      const p = mesh.centroidOf([c.capitalTile]);
      const n = new THREE.Vector3(p[0], p[1], p[2]).normalize();
      out.push({ pos: n.clone().multiplyScalar(Math.hypot(p[0], p[1], p[2]) + LIFT), quat: new THREE.Quaternion().setFromUnitVectors(Z, n), r });
    }
    return out;
  }, [mesh, world, version]);
  if (rings.length === 0) return null;
  return <Pool rings={rings} />;
}
