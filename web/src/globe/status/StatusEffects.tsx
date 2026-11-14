// One-shot effects: the tag on a disputed province and the cyan ripple when a link returns. Lane b (B7).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';
import { Anchor } from './Anchor';
import { capitalPoint, liftPoint } from './geo';
import type { P3 } from './geo';
import { useEventStream } from './useEventStream';

const TAG_MS = 3000;
const RIPPLE_MS = 1900;
const RIPPLE_REACH = 0.5; // radians of arc
const SEG = 96;

interface DisputeTag { key: string; pos: P3; name: string }
interface Ripple { key: string; pos: P3 }

function RippleRing({ pos, onDone }: { pos: P3; onDone: () => void }) {
  const t0 = useRef<number | null>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: getPalette().holo, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }), []);
  const basis = useMemo(() => {
    const n = new THREE.Vector3(...pos).normalize();
    let u = new THREE.Vector3(0, 1, 0).cross(n);
    if (u.lengthSq() < 1e-4) u = new THREE.Vector3(1, 0, 0).cross(n);
    u.normalize();
    return { n, u, v: new THREE.Vector3().crossVectors(n, u), r: Math.hypot(...pos) + 0.008 };
  }, [pos]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame(({ clock }) => {
    if (t0.current == null) t0.current = clock.elapsedTime;
    const t = (clock.elapsedTime - t0.current) * 1000 / RIPPLE_MS;
    if (t >= 1) { onDone(); return; }
    const e = 1 - (1 - t) * (1 - t);
    const outer = 0.015 + RIPPLE_REACH * e;
    const inner = Math.max(0, outer - 0.012 - 0.02 * (1 - t));
    mat.opacity = 0.9 * (1 - t);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const { n, u, v, r } = basis;
    const tmp = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const phi = (i / SEG) * Math.PI * 2;
      const c = Math.cos(phi), s = Math.sin(phi);
      [inner, outer].forEach((th, k) => {
        tmp.copy(n).multiplyScalar(Math.cos(th))
          .addScaledVector(u, Math.sin(th) * c).addScaledVector(v, Math.sin(th) * s)
          .normalize().multiplyScalar(r);
        p.setXYZ(i * 2 + k, tmp.x, tmp.y, tmp.z);
      });
    }
    p.needsUpdate = true;
    geo.computeBoundingSphere();
  });
  return <mesh geometry={geo} material={mat} renderOrder={24} frustumCulled={false} />;
}

export function StatusEffects() {
  const mesh = useProvinceMesh();
  const [tags, setTags] = useState<DisputeTag[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const seq = useRef(0);

  useEffect(() => { setTags([]); setRipples([]); }, [mesh]);

  useEventStream((events) => {
    const s = useWorld.getState();
    const world = s.world;
    if (!mesh || !world) return;
    const byOwner = new Map<number, number[]>();
    for (const e of events) {
      if (e.type === 'tile_claimed' && e.cause === 'dispute' && e.owner >= 0 && e.tile >= 0) {
        const arr = byOwner.get(e.owner);
        if (arr) arr.push(e.tile); else byOwner.set(e.owner, [e.tile]);
      } else if (e.type === 'chronicle' && e.entry.kind === 'return') {
        const id = e.entry.countries[0];
        const pos = id != null ? capitalPoint(mesh, world, id, 0) : null;
        if (pos) {
          const key = `r${++seq.current}`;
          setRipples((r) => [...r, { key, pos }]);
        }
      }
    }
    if (byOwner.size) {
      const add: DisputeTag[] = [];
      for (const [owner, tiles] of byOwner) {
        const c = world.countries[owner];
        if (!c) continue;
        const key = `d${++seq.current}`;
        add.push({ key, pos: liftPoint(mesh.centroidOf(tiles), 0.008), name: c.name });
        setTimeout(() => setTags((t) => t.filter((x) => x.key !== key)), TAG_MS + 100);
      }
      setTags((t) => [...t, ...add].slice(-5));
    }
  });

  const drop = useCallback((key: string) => setRipples((r) => r.filter((x) => x.key !== key)), []);

  return (
    <>
      {tags.map((t) => (
        <Anchor key={t.key} pos={t.pos} dy={-26}>
          <div className="gs-tag dispute"><span className="cap">Settled</span>Awarded to {t.name}</div>
        </Anchor>
      ))}
      {ripples.map((r) => <RippleRing key={r.key} pos={r.pos} onDone={() => drop(r.key)} />)}
    </>
  );
}
