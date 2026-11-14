// A26: one satellite per stellar-age nation, on a tilted circular orbit above the clouds, with a faint
// orbit line. Code-built (box body, two solar panels, owner colour). Mount once inside <Canvas>. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { useSlowVersion } from '../../ui/useSlowVersion';

const ORBIT_R = 1.24;
const SAT = 0.03;
const PERIOD_S = 70;

interface Sat { id: number; color: THREE.Color; u: THREE.Vector3; v: THREE.Vector3; speed: number; ring: THREE.Matrix4 }

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function Orbit() {
  const world = useWorld((s) => s.world);
  const version = useSlowVersion();
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

  const sats = useMemo<Sat[]>(() => {
    const out: Sat[] = [];
    world?.countries.forEach((c, id) => {
      if (c.techAge !== 'stellar') return;
      const t = world.tiles[c.capitalTile];
      const cap = t ? new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize() : new THREE.Vector3(1, 0, 0);
      // the orbit plane contains the capital direction, tilted by a per-nation angle
      const ref = Math.abs(cap.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3().crossVectors(cap, ref).normalize();
      const up = new THREE.Vector3().crossVectors(side, cap).normalize();
      const tilt = (0.35 + hash(id) * 1.0) * (hash(id + 9) < 0.5 ? -1 : 1);
      const v = side.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(up, Math.sin(tilt)).normalize();
      const n = new THREE.Vector3().crossVectors(cap, v).normalize();
      const ring = new THREE.Matrix4().makeBasis(cap, v, n).scale(new THREE.Vector3(ORBIT_R, ORBIT_R, ORBIT_R));
      out.push({ id, color: new THREE.Color(c.color), u: cap, v, speed: 1 + hash(id + 3) * 0.3, ring });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, version]);

  const bodies = useRef<Array<THREE.Group | null>>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sats.forEach((s, i) => {
      const g = bodies.current[i];
      if (!g) return;
      const a = (t / PERIOD_S) * Math.PI * 2 * s.speed;
      g.position.copy(s.u).multiplyScalar(Math.cos(a) * ORBIT_R).addScaledVector(s.v, Math.sin(a) * ORBIT_R);
      g.lookAt(0, 0, 0);
    });
  });

  useEffect(() => () => { geo.body.dispose(); geo.panel.dispose(); geo.ring.dispose(); mats.hull.dispose(); mats.solar.dispose(); }, [geo, mats]);

  if (!sats.length) return null;
  return (
    <group>
      {sats.map((s, i) => (
        <group key={s.id}>
          <lineLoop geometry={geo.ring} matrixAutoUpdate={false} matrix={s.ring}>
            <lineBasicMaterial color={s.color} transparent opacity={0.22} depthWrite={false} />
          </lineLoop>
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
