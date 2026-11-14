// Beacons at the place each big event happens: icon disc + flag, a light pillar for 2 s, then a
// small marker for ~25 s. Click one to fly there. Mount inside ProvinceMeshContext. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { flagSvg } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { useEventStream } from '../status/useEventStream';
import { buildStructureCache, classify } from './classify';
import type { StructureCache } from './classify';
import { focusTile } from './focus';
import { iconUrl } from './icons';
import { KIND_META } from './kinds';
import { PILLAR_MS, clearBeacons, pruneBeacons, pushStory, useBeacons } from './store';
import type { Beacon } from './store';
import './events.css';

const PILLAR_H = 0.16;
const pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0);
const UP = new THREE.Vector3(0, 1, 0);

function Pillar({ b }: { b: Beacon }) {
  const core = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...b.pos).normalize()), [b.pos]);
  useFrame(() => {
    const t = (performance.now() - b.born) / PILLAR_MS;
    const a = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 0.9);
    if (core.current) core.current.opacity = 0.75 * a;
    if (halo.current) halo.current.opacity = 0.22 * a;
    if (group.current) group.current.scale.set(1, Math.min(1, 0.3 + t * 3), 1);
  });
  const color = KIND_META[b.kind].color;
  return (
    <group ref={group} position={b.pos} quaternion={quat}>
      <mesh geometry={pillarGeo} scale={[0.0035, PILLAR_H, 0.0035]} renderOrder={5}>
        <meshBasicMaterial ref={core} color="#fff3d6" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh geometry={pillarGeo} scale={[0.012, PILLAR_H * 0.8, 0.012]} renderOrder={5}>
        <meshBasicMaterial ref={halo} color={color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function BeaconView({ b, reduced }: { b: Beacon; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const dir = useMemo(() => new THREE.Vector3(...b.pos).normalize(), [b.pos]);
  const flag = useWorld((s) => (b.countryId != null ? s.world?.countries[b.countryId]?.flag : undefined));
  const flagHtml = useMemo(() => (flag ? flagSvg(flag, 24, 16) : ''), [flag]);
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const facing = camera.position.dot(dir) / camera.position.length();
    const show = facing > 0.2 && document.querySelector('.closing-veil') === null;
    if (el.classList.contains('away') === show) el.classList.toggle('away', !show);
  });
  const fresh = performance.now() - b.born < PILLAR_MS + 300;
  return (
    <>
      {fresh && !reduced && <Pillar key={`p${b.gen}`} b={b} />}
      <Html position={b.pos} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={ref} className="ev-anchor away">
          <div key={b.gen} className={`ev-beacon${reduced ? ' still' : ''}`} style={{ ['--ev-color' as string]: KIND_META[b.kind].color }}>
            <span className="ev-label">{b.title}</span>
            <button
              type="button"
              className="ev-pin"
              title={`${b.title} (year ${b.year})`}
              aria-label={`${KIND_META[b.kind].label}: ${b.title}. Fly there.`}
              onClick={(e) => { e.stopPropagation(); focusTile(b.tile, 'user'); }}
            >
              <img className="ev-icon" src={iconUrl(b.kind)} alt="" draggable={false} />
              {flagHtml && <span className="ev-flag" dangerouslySetInnerHTML={{ __html: flagHtml }} />}
              {b.count > 1 && <span className="ev-count">{b.count}</span>}
            </button>
            <span className="ev-stem" />
          </div>
        </div>
      </Html>
    </>
  );
}

export function EventBeacons() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const beacons = useBeacons((s) => s.beacons);
  const cache = useRef<StructureCache>(new Map());
  const reduced = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    cache.current = world ? buildStructureCache(world) : new Map();
    clearBeacons();
  }, [world]);

  useEventStream((events) => {
    const w = useWorld.getState().world;
    if (!w || !mesh) return;
    for (const st of classify(events, w, cache.current)) pushStory(st, mesh.centroidOf([st.tile]));
  });

  useEffect(() => {
    const id = setInterval(pruneBeacons, 1000);
    return () => clearInterval(id);
  }, []);

  return <>{beacons.map((b) => <BeaconView key={b.key} b={b} reduced={reduced} />)}</>;
}
