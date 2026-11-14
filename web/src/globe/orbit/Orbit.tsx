// A26: one satellite per stellar-age nation, on a tilted circular orbit above the clouds, with a faint
// orbit line. Code-built (box body, two solar panels, owner colour). Mount once inside <Canvas>. Lane b.
// #291: a satellite launched during the run appears only when its rocket (Launch.tsx) delivers it;
// the rings, phases and counts live in launchState.ts.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { omega, ringFor, ringPos, revision, satNations, satPhases, subscribe, syncWorld } from './launchState';
import type { Ring } from './launchState';

const SAT = 0.03;

interface Sat { id: number; color: THREE.Color; r: Ring; phase: number; first: boolean }

export function Orbit() {
  const world = useWorld((s) => s.world);
  const version = useWorld((s) => s.version);
  const geo = useMemo(() => {
    const body = new THREE.BoxGeometry(SAT, SAT * 0.7, SAT * 0.7);
    const panel = new THREE.BoxGeometry(SAT * 1.3, SAT * 0.04, SAT * 0.7);
    const ring = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 97 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2), Math.sin((i / 96) * Math.PI * 2), 0)),
    );
    return { body, panel, ring };
  }, []);
  const mats = useMemo(() => ({
    hull: new THREE.MeshStandardMaterial({ color: '#cfd4da', metalness: 0.4, roughness: 0.5, flatShading: true }),
    solar: new THREE.MeshStandardMaterial({ color: '#24406e', metalness: 0.3, roughness: 0.4, emissive: '#10224a', flatShading: true }),
  }), []);

  const launched = useSyncExternalStore(subscribe, revision);
  useEffect(() => { syncWorld(world); }, [world]);
  const sats = useMemo<Sat[]>(() => {
    const out: Sat[] = [];
    if (!world) return out;
    for (const id of satNations()) {
      const c = world.countries[id];
      if (!c) continue;
      const r = ringFor(world, id);
      satPhases(id).forEach((phase, k) => out.push({ id, color: new THREE.Color(c.color), r, phase, first: k === 0 }));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, version, launched]);

  const bodies = useRef<Array<THREE.Group | null>>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sats.forEach((s, i) => {
      const g = bodies.current[i];
      if (!g) return;
      ringPos(s.r, t * omega(s.r) + s.phase, g.position);
      g.lookAt(0, 0, 0);
    });
  });

  useEffect(() => () => { geo.body.dispose(); geo.panel.dispose(); geo.ring.dispose(); mats.hull.dispose(); mats.solar.dispose(); }, [geo, mats]);

  if (!sats.length) return null;
  return (
    <group>
      {sats.map((s, i) => (
        <group key={`${s.id}:${i}`}>
          {s.first && (
            <lineLoop geometry={geo.ring} matrixAutoUpdate={false} matrix={s.r.matrix}>
              <lineBasicMaterial color={s.color} transparent opacity={0.22} depthWrite={false} />
            </lineLoop>
          )}
          <group ref={(el) => { bodies.current[i] = el; }}>
            <mesh geometry={geo.body} material={mats.hull} />
            <mesh geometry={geo.panel} material={mats.solar} position={[-SAT * 0.95, 0, 0]} />
            <mesh geometry={geo.panel} material={mats.solar} position={[SAT * 0.95, 0, 0]} />
            <mesh position={[0, SAT * 0.45, 0]}>
              <boxGeometry args={[SAT * 0.5, SAT * 0.2, SAT * 0.5]} />
              <meshBasicMaterial color={s.color} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
