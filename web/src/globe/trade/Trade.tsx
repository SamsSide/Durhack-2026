// A27: gold payment arcs between capitals. Mount inside the ProvinceMeshContext provider. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import type { LedgerRow } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';

const POOL = 6, SEGS = 40, RING = 5;
const TRAVEL_MS = 1200, TOTAL_MS = 2000;
const GOLD = new THREE.Color('#ffc940'), RED_GOLD = new THREE.Color('#ff6a2a');
const HOT = new THREE.Color('#fff4c4');

interface Slot { mesh: THREE.Mesh; head: THREE.Mesh; start: number; mid: THREE.Vector3; active: boolean }

function capitalPoint(world: World, id: number): THREE.Vector3 | null {
  const c = world.countries[id];
  const t = c ? world.tiles[c.capitalTile] : undefined;
  if (!t) return null;
  const v = new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize();
  return v.multiplyScalar(tileHeight(t));
}

/** Great-circle arc between two surface points, lifted by a sine of the span. */
function arcPoints(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const ra = a.length(), rb = b.length();
  const na = a.clone().normalize(), nb = b.clone().normalize();
  const ang = Math.acos(Math.min(1, Math.max(-1, na.dot(nb))));
  const lift = 0.012 + ang * 0.1;
  const out: THREE.Vector3[] = [];
  const s = Math.sin(ang) || 1;
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const dir = ang < 1e-4 ? na.clone() : na.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(nb.clone().multiplyScalar(Math.sin(t * ang) / s));
    const r = ra + (rb - ra) * t + Math.sin(Math.PI * t) * lift + 0.004;
    out.push(dir.normalize().multiplyScalar(r));
  }
  return out;
}

function writeTube(geo: THREE.BufferGeometry, pts: THREE.Vector3[], radius: number): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const side = new THREE.Vector3(), up = new THREE.Vector3(), tan = new THREE.Vector3(), off = new THREE.Vector3();
  for (let i = 0; i <= SEGS; i++) {
    const p = pts[i]!;
    tan.copy(pts[Math.min(SEGS, i + 1)]!).sub(pts[Math.max(0, i - 1)]!).normalize();
    up.copy(p).normalize();
    side.crossVectors(tan, up).normalize();
    const taper = 0.45 + 0.55 * Math.sin(Math.PI * (i / SEGS));
    for (let j = 0; j < RING; j++) {
      const a = (j / RING) * Math.PI * 2;
      off.copy(side).multiplyScalar(Math.cos(a) * radius * taper).addScaledVector(up, Math.sin(a) * radius * taper);
      pos.setXYZ(i * RING + j, p.x + off.x, p.y + off.y, p.z + off.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
}

function makeGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * RING * 3), 3));
  const idx: number[] = [];
  for (let i = 0; i < SEGS; i++) for (let j = 0; j < RING; j++) {
    const a = i * RING + j, b = i * RING + (j + 1) % RING, c = a + RING, d = b + RING;
    idx.push(a, b, c, b, d, c);
  }
  g.setIndex(idx);
  return g;
}

export function Trade() {
  const world = useWorld((s) => s.world);
  const pool = useMemo(() => {
    const group = new THREE.Group();
    group.renderOrder = 20;
    const slots: Slot[] = [];
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const mesh = new THREE.Mesh(makeGeometry(), mat);
      mesh.frustumCulled = false; mesh.visible = false;
      const head = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: HOT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      head.frustumCulled = false; head.visible = false;
      group.add(mesh, head);
      slots.push({ mesh, head, start: 0, mid: new THREE.Vector3(), active: false });
    }
    return { group, slots, pts: new Map<Slot, THREE.Vector3[]>() };
  }, []);
  const seen = useRef(new Set<string>());
  const ready = useRef(new Map<Slot, { radius: number }>());

  useEffect(() => () => {
    for (const s of pool.slots) { s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); s.head.geometry.dispose(); (s.head.material as THREE.Material).dispose(); }
  }, [pool]);

  useEffect(() => {
    seen.current = new Set();
    const spawn = (row: LedgerRow) => {
      const w = useWorld.getState().world;
      if (!w) return;
      const a = capitalPoint(w, row.from), b = capitalPoint(w, row.to);
      if (!a || !b) return;
      const now = performance.now();
      let slot = pool.slots.find((s) => !s.active);
      if (!slot) slot = pool.slots.reduce((o, s) => (s.start < o.start ? s : o));
      const pts = arcPoints(a, b);
      const radius = 0.0016 + 0.0016 * Math.min(3, Math.log10(1 + Math.max(0, row.amount)));
      writeTube(slot.mesh.geometry, pts, radius);
      pool.pts.set(slot, pts);
      ready.current.set(slot, { radius });
      const hot = row.reason === 'plunder' || row.reason === 'seizure';
      (slot.mesh.material as THREE.MeshBasicMaterial).color.copy(hot ? RED_GOLD : GOLD);
      slot.head.scale.setScalar(radius * 2.6);
      slot.mid.copy(pts[SEGS >> 1]!);
      slot.start = now; slot.active = true;
      slot.mesh.visible = true; slot.head.visible = true;
    };
    const take = (rows: LedgerRow[]) => {
      for (const r of rows) {
        if (seen.current.has(r.id)) continue;
        if (r.status !== 'confirmed' && r.status !== 'simulated') continue;
        seen.current.add(r.id);
        spawn(r);
      }
    };
    // Rows already in the store when we mount are history: remember them, do not draw them.
    for (const r of useWorld.getState().ledger) if (r.status === 'confirmed' || r.status === 'simulated') seen.current.add(r.id);
    let last = useWorld.getState().ledger;
    return useWorld.subscribe((s) => {
      if (s.ledger === last) return;
      last = s.ledger;
      take(s.ledger.slice(-12));
    });
  }, [pool, world?.id]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const now = performance.now();
    for (const s of pool.slots) {
      if (!s.active) continue;
      const age = now - s.start;
      if (age >= TOTAL_MS) { s.active = false; s.mesh.visible = false; s.head.visible = false; continue; }
      const travel = Math.min(1, age / TRAVEL_MS);
      const eased = 1 - Math.pow(1 - travel, 2);
      const fade = age < TRAVEL_MS ? 1 : 1 - (age - TRAVEL_MS) / (TOTAL_MS - TRAVEL_MS);
      // hide on the far side: fade by how far the arc's midpoint is behind the horizon
      tmp.copy(s.mid).normalize();
      const facing = tmp.dot(camera.position.clone().normalize());
      const horizon = Math.min(1, Math.max(0, (facing + 0.05) / 0.2));
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.85 * fade * horizon;
      s.mesh.geometry.setDrawRange(0, Math.max(6, Math.floor(eased * SEGS)) * RING * 6);
      const pts = pool.pts.get(s)!;
      const f = eased * SEGS, i0 = Math.min(SEGS - 1, Math.floor(f));
      s.head.position.copy(pts[i0]!).lerp(pts[i0 + 1]!, f - i0);
      (s.head.material as THREE.MeshBasicMaterial).opacity = fade * horizon;
    }
  });

  return <primitive object={pool.group} />;
}
