// A26: each nation's satellites (from the modern age, #317) on a tilted circular orbit above the clouds, with a faint
// orbit line. The modelled satellite (manifest models.satellite, team material tinted per nation), else a code-built one. Mount once inside <Canvas>. Lane b.
// #291: a satellite launched during the run appears only when its rocket (Launch.tsx) delivers it;
// the rings, phases and counts live in launchState.ts. #317 item 15: a satellite shot down in a war
// streaks, flashes and leaves its ring (Strike.tsx, mounted here).
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { useSlowVersion } from '../../ui/useSlowVersion';
import { omega, ringFor, ringPos, revision, satNations, satPhases, subscribe, syncWorld } from './launchState';
import type { Ring } from './launchState';
import { loadGlb } from './launchModels';
import { Strike } from './Strike';
import type { ModelPart } from '../structures/models';

const SAT_SCALE = 0.7; // #317 item 11: satellites at 70 percent of their first size
const SAT = 0.03 * SAT_SCALE;
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
// the modelled satellite (manifest `models.satellite`) is scaled so its widest side (the solar booms)
// matches the old code-built one's span on screen, and turned so its dish faces the planet
const SPAN = SAT * 3.2;
const ORIENT = new THREE.Euler(0, 0, 0);

let satParts: ModelPart[] | null = null;
let satStarted = false;
const satListeners = new Set<() => void>();

async function loadSatellite(): Promise<void> {
  try {
    const res = await fetch(`${BASE}models/manifest.json`);
    if (!res.ok) return;
    const file = ((await res.json()) as { models?: { satellite?: { file?: string } } }).models?.satellite?.file;
    if (!file) return;
    const glb = await loadGlb(file, false);
    if (!glb) return;
    const box = new THREE.Box3();
    for (const p of glb.parts) { p.geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(ORIENT)); p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = SPAN / Math.max(size.x, size.y, size.z, 1e-6);
    const m = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    for (const p of glb.parts) p.geometry.applyMatrix4(m);
    satParts = glb.parts;
    satListeners.forEach((f) => f());
  } catch (err) {
    console.warn('orbit: satellite.glb failed, using the code-built satellite', err);
  }
}

function useSatParts(): ModelPart[] | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    satListeners.add(f);
    if (!satStarted) { satStarted = true; void loadSatellite(); }
    return () => { satListeners.delete(f); };
  }, []);
  return satParts;
}

interface Sat { id: number; color: THREE.Color; r: Ring; phase: number; first: boolean }

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

  const parts = useSatParts();
  // one team material per nation, shared by all its satellites, tinted with the nation colour
  const teamMats = useMemo(() => {
    const m = new Map<number, THREE.Material[]>();
    if (!parts || !world) return m;
    for (const id of satNations()) {
      const c = world.countries[id];
      if (!c) continue;
      m.set(id, parts.map((p) => {
        if (!p.team) return p.material;
        const t = p.material.clone();
        if ('color' in t) (t as THREE.MeshStandardMaterial).color.set(c.color);
        return t;
      }));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, world, version]);
  useEffect(() => () => { for (const list of teamMats.values()) list.forEach((t, i) => { if (parts && t !== parts[i]!.material) t.dispose(); }); }, [teamMats, parts]);

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

  return (
    <group>
      <Strike />
      {sats.map((s, i) => (
        <group key={`${s.id}:${i}`}>
          {s.first && (
            <lineLoop geometry={geo.ring} matrixAutoUpdate={false} matrix={s.r.matrix}>
              <lineBasicMaterial color={s.color} transparent opacity={0.22} depthWrite={false} />
            </lineLoop>
          )}
          <group ref={(el) => { bodies.current[i] = el; }}>
            {parts ? parts.map((p, k) => <mesh key={k} geometry={p.geometry} material={teamMats.get(s.id)?.[k] ?? p.material} />) : (
              <>
                <mesh geometry={geo.body} material={mats.hull} />
                <mesh geometry={geo.panel} material={mats.solar} position={[-SAT * 0.95, 0, 0]} />
                <mesh geometry={geo.panel} material={mats.solar} position={[SAT * 0.95, 0, 0]} />
                <mesh position={[0, SAT * 0.45, 0]}>
                  <boxGeometry args={[SAT * 0.5, SAT * 0.2, SAT * 0.5]} />
                  <meshBasicMaterial color={s.color} toneMapped={false} />
                </mesh>
              </>
            )}
          </group>
        </group>
      ))}
    </group>
  );
}
