// A short war animation (#245): when a nation declares war, a red ring pulses at both capitals and
// a red dashed arc runs between them with crossed swords at its middle, all gone in about 3 s.
// The lasting marker is the war beacon (EventBeacons); this is only the moment itself. Lane b.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { useEventStream } from '../status/useEventStream';
import { iconUrl } from './icons';
import { KIND_META } from './kinds';

const LIFE_MS = 3200;
const MAX_FLASHES = 4;
const RED = KIND_META.war.color;
const RED_BRIGHT = '#e0473f';
const SEGMENTS = 48;
const Z = new THREE.Vector3(0, 0, 1);
const ringGeo = new THREE.RingGeometry(0.82, 1, 40);

interface Flash { key: string; a: THREE.Vector3; b: THREE.Vector3; born: number }

let seq = 0;

/** Points of a great-circle arc from a to b, lifted off the surface in the middle. */
function arcPoints(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const ua = a.clone().normalize(), ub = b.clone().normalize();
  const ang = ua.angleTo(ub);
  const ra = a.length(), rb = b.length();
  const lift = 0.02 + Math.min(0.14, ang * 0.18);
  const out: THREE.Vector3[] = [];
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3().crossVectors(ua, ub);
  if (axis.lengthSq() < 1e-10) return [a.clone(), b.clone()];
  axis.normalize();
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    q.setFromAxisAngle(axis, ang * t);
    const r = ra + (rb - ra) * t + 0.006 + lift * Math.sin(Math.PI * t);
    out.push(ua.clone().applyQuaternion(q).multiplyScalar(r));
  }
  return out;
}

function Pulse({ pos, born }: { pos: THREE.Vector3; born: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, pos.clone().normalize()), [pos]);
  const at = useMemo(() => pos.clone().setLength(pos.length() + 0.004), [pos]);
  useFrame(() => {
    const t = (performance.now() - born) / LIFE_MS;
    const phase = (t * 2.4) % 1; // a little over two pulses
    const s = 0.008 + phase * 0.05;
    mesh.current?.scale.set(s, s, s);
    if (mat.current) mat.current.opacity = Math.max(0, 1 - phase) * Math.max(0, 1 - t) * 0.95;
  });
  return (
    <mesh ref={mesh} geometry={ringGeo} position={at} quaternion={quat} renderOrder={6}>
      <meshBasicMaterial ref={mat} color={RED_BRIGHT} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FlashView({ f }: { f: Flash }) {
  const pts = useMemo(() => arcPoints(f.a, f.b), [f]);
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineDashedMaterial({ color: RED_BRIGHT, dashSize: 0.018, gapSize: 0.012, transparent: true, opacity: 0, depthWrite: false });
    const l = new THREE.Line(g, m);
    l.computeLineDistances();
    l.renderOrder = 6;
    return l;
  }, [pts]);
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose(); }, [line]);
  const mid = pts[Math.floor(pts.length / 2)]!;
  const midDir = useMemo(() => mid.clone().normalize(), [mid]);
  const swords = useRef<HTMLDivElement>(null);
  useFrame(({ camera }) => {
    const t = (performance.now() - f.born) / LIFE_MS;
    const m = line.material as THREE.LineDashedMaterial;
    // The arc draws in over the first 0.4 s, holds, and fades over the last second.
    const draw = Math.min(1, t / 0.13);
    line.geometry.setDrawRange(0, Math.max(2, Math.ceil(draw * (pts.length))));
    m.opacity = t < 0.66 ? 0.95 : Math.max(0, (1 - t) / 0.34) * 0.95;
    const el = swords.current;
    if (el) {
      const facing = camera.position.dot(midDir) / camera.position.length();
      el.style.visibility = facing > 0.15 ? 'visible' : 'hidden';
    }
  });
  return (
    <>
      <primitive object={line} />
      <Pulse pos={f.a} born={f.born} />
      <Pulse pos={f.b} born={f.born} />
      <Html position={mid} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={swords} className="war-swords" style={{ ['--ev-color' as string]: RED }}>
          <img src={iconUrl('war')} alt="" draggable={false} />
        </div>
      </Html>
    </>
  );
}

export function WarFlash() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const [flashes, setFlashes] = useState<Flash[]>([]);

  useEffect(() => { setFlashes([]); }, [world?.id]);

  useEventStream((events) => {
    const w = useWorld.getState().world;
    if (!w || !mesh) return;
    const add: Flash[] = [];
    for (const e of events) {
      if (e.type !== 'relation_changed' || e.stance !== 'war') continue;
      const ca = w.countries[e.a]?.capitalTile, cb = w.countries[e.b]?.capitalTile;
      if (ca == null || cb == null || !w.tiles[ca] || !w.tiles[cb] || ca === cb) continue;
      const a = new THREE.Vector3(...mesh.centroidOf([ca]));
      const b = new THREE.Vector3(...mesh.centroidOf([cb]));
      add.push({ key: `wf${seq++}`, a, b, born: performance.now() });
    }
    if (add.length) setFlashes((list) => [...list, ...add].slice(-MAX_FLASHES));
  });

  useEffect(() => {
    if (!flashes.length) return;
    const id = setTimeout(() => {
      const now = performance.now();
      setFlashes((list) => list.filter((f) => now - f.born < LIFE_MS));
    }, 500);
    return () => clearTimeout(id);
  }, [flashes]);

  return <>{flashes.map((f) => <FlashView key={f.key} f={f} />)}</>;
}
