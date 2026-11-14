// A parchment dot ringed in ink at each living nation's capital. Lane b.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';

const EXTRA_LIFT = 0.003;
const RING = 0.0075; // ring radius per unit of camera distance
const DOT_RATIO = 0.6;
const MIN_R = 0.004;
const NORTH = new THREE.Vector3(0, 1, 0);

interface Cap { key: string; pos: [number, number, number] }

function surfaceQuat(pos: THREE.Vector3): THREE.Quaternion {
  const n = pos.clone().normalize();
  let up = NORTH.clone().addScaledVector(n, -NORTH.dot(n));
  if (up.lengthSq() < 1e-4) up = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x);
  up.normalize();
  const right = new THREE.Vector3().crossVectors(up, n).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, n));
}

function Marker({ pos }: { pos: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const v = useMemo(() => new THREE.Vector3(...pos), [pos]);
  const quat = useMemo(() => surfaceQuat(v), [v]);
  const dir = useMemo(() => v.clone().normalize(), [v]);
  const pal = getPalette();
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const d = camera.position.length();
    g.visible = camera.position.dot(dir) / d > 0.05;
    const r = Math.max(MIN_R, RING * (d - 0.9));
    g.scale.setScalar(r);
  });
  return (
    <group ref={ref} position={pos} quaternion={quat} renderOrder={22}>
      <mesh renderOrder={22}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color={pal.ink} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.0001]} renderOrder={23}>
        <circleGeometry args={[DOT_RATIO, 24]} />
        <meshBasicMaterial color={pal.parchment} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Capitals() {
  const mesh = useProvinceMesh();
  const [caps, setCaps] = useState<Cap[]>([]);

  useEffect(() => {
    if (!mesh) { setCaps([]); return; }
    let lastKey = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    const compute = () => {
      timer = null;
      last = performance.now();
      const { world } = useWorld.getState();
      const list: Cap[] = [];
      if (world) {
        for (const c of world.countries) {
          if (!c || c.alive === false || c.capitalTile == null || !world.tiles[c.capitalTile]) continue;
          const p = mesh.centroidOf([c.capitalTile]);
          const len = Math.hypot(p[0], p[1], p[2]) || 1;
          const k = (len + EXTRA_LIFT) / len;
          list.push({ key: `${c.id}:${c.capitalTile}`, pos: [p[0] * k, p[1] * k, p[2] * k] });
        }
      }
      const key = list.map((c) => c.key).join('|');
      if (key !== lastKey) { lastKey = key; setCaps(list); }
    };
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(compute, Math.max(0, 1000 - (performance.now() - last)));
    };
    compute();
    const unsub = useWorld.subscribe(schedule);
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [mesh]);

  return <>{caps.map((c) => <Marker key={c.key} pos={c.pos} />)}</>;
}
