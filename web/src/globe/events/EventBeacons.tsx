// Beacons at the place each big event happens: icon disc + flag, a light pillar for 2 s, then a
// small marker for ~25 s. Click one to fly there. Mount inside ProvinceMeshContext. Lane b.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
import { hudSlot, underHud } from '../status/hudCover';
import { iconUrl } from './icons';
import { KIND_META } from './kinds';
import { PILLAR_MS, clearBeacons, pruneBeacons, pushStory, useBeacons } from './store';
import type { Beacon } from './store';
import './events.css';
import { yearLabel } from '@terra/shared';

const PILLAR_H = 0.16;
const LABEL_MS = 4500;  // a caption shows this long (the ev-label animation)
const MAX_LABELS = 2;   // never more captions than this on screen at once
const GAP = 4;          // px kept between a caption and anything it would cover

type Box = { l: number; t: number; r: number; b: number };
const hit = (a: Box, b: Box) => a.l < b.r + GAP && a.r + GAP > b.l && a.t < b.b + GAP && a.b + GAP > b.t;

/**
 * Keep captions apart: the newest MAX_LABELS fresh captions in view are shown, each lifted clear of the
 * captions placed before it, of the status tags (disputes, signal lost) and of the battle plates; anything that can't fit is hidden.
 */
function layoutLabels(): void {
  const now = performance.now();
  const labels = [...document.querySelectorAll<HTMLElement>('.ev-label')];
  const live = labels.filter((el) => {
    const born = Number(el.dataset.born);
    return now - born < LABEL_MS && !el.closest('.ev-anchor.away');
  }).sort((a, b) => Number(b.dataset.born) - Number(a.dataset.born));
  const obstacles: Box[] = [];
  for (const t of document.querySelectorAll<HTMLElement>('.gs-tag, .bb-plate')) {
    const a = t.closest<HTMLElement>('.gs-anchor');
    if (a && a.style.opacity === '0') continue;
    const r = t.getBoundingClientRect();
    if (r.width > 0) obstacles.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  const shown = new Set<HTMLElement>();
  for (const el of live) {
    if (shown.size >= MAX_LABELS) break;
    const lift = Number(el.dataset.lift ?? 0);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || underHud(el, 0)) continue; // a caption never sits over a HUD panel (#175)
    const box: Box = { l: r.left, t: r.top + lift, r: r.right, b: r.bottom + lift }; // as if not lifted
    let up = 0;
    for (let i = 0; i < 6; i++) {
      const cur = { ...box, t: box.t - up, b: box.b - up };
      const o = obstacles.find((x) => hit(cur, x));
      if (!o) break;
      up += cur.b - o.t + GAP; // move just above what it hits
    }
    const fin = { ...box, t: box.t - up, b: box.b - up };
    if (obstacles.some((x) => hit(fin, x)) || fin.t < 70) continue; // no room: leave it hidden
    obstacles.push(fin);
    shown.add(el);
    if (Number(el.dataset.lift ?? -1) !== up) { el.dataset.lift = String(up); el.style.setProperty('--ev-lift', `${up}px`); }
  }
  for (const el of labels) el.classList.toggle('ev-hide', !shown.has(el));
}
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

// B8: memoised, so a new story re-renders the one beacon it changes, not all twelve (each one is a drei
// Html with its own React root). The light pillar takes itself down with a timer.
const BeaconView = memo(function BeaconView({ b, reduced }: { b: Beacon; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const dir = useMemo(() => new THREE.Vector3(...b.pos).normalize(), [b.pos]);
  const flag = useWorld((s) => (b.countryId != null ? s.world?.countries[b.countryId]?.flag : undefined));
  const flagHtml = useMemo(() => (flag ? flagSvg(flag, 24, 16) : ''), [flag]);
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const facing = camera.position.dot(dir) / camera.position.length();
    const pin = el.querySelector<HTMLElement>('.ev-pin');
    // Below the HUD (#175): hidden while a panel (nation card, network, feed) covers it.
    const show = facing > 0.2 && document.querySelector('.closing-veil, .tn-world-veil') === null && !(pin && underHud(pin));
    if (el.classList.contains('away') === show) el.classList.toggle('away', !show);
  });
  const [spent, setSpent] = useState(-1); // the generation whose pillar has finished
  useEffect(() => {
    const left = b.born + PILLAR_MS + 300 - performance.now();
    if (left <= 0) { setSpent(b.gen); return; }
    const timer = window.setTimeout(() => setSpent(b.gen), left);
    return () => window.clearTimeout(timer);
  }, [b.gen, b.born]);
  const fresh = spent !== b.gen && performance.now() - b.born < PILLAR_MS + 300;
  return (
    <>
      {fresh && !reduced && <Pillar key={`p${b.gen}`} b={b} />}
      <Html position={b.pos} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={ref} className="ev-anchor away">
          <div key={b.gen} className={`ev-beacon${reduced ? ' still' : ''}`} style={{ ['--ev-color' as string]: KIND_META[b.kind].color }}>
            <span className="ev-label ev-hide" data-born={b.born}>{b.title}</span>
            <button
              type="button"
              className="ev-pin"
              title={`${b.title} (${yearLabel(b.year)})`}
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
});

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

  // Lay the captions out a few times a second (they move with the globe).
  const lastLayout = useRef(0);
  useFrame(() => {
    const slot = hudSlot(); // B8: in step with the other readers of the page layout (status/hudCover.ts)
    if (slot === lastLayout.current) return;
    lastLayout.current = slot;
    layoutLabels();
  });

  return <>{beacons.map((b) => <BeaconView key={b.key} b={b} reduced={reduced} />)}</>;
}
