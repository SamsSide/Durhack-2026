// A27: gold payment arcs between capitals. Mount inside the ProvinceMeshContext provider. Lane b.
// B13: a landed arc stays up for 6 s at reduced opacity with a label at its top; clicking the arc
// (or its label) opens the payment on Solana Explorer. Rows with no `url` (mock) never open.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import type { LedgerRow } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';
import './trade.css';

const POOL = 6, SEGS = 40, RING = 5;
const TRAVEL_MS = 1200, SETTLE_MS = 2000, TOTAL_MS = 6000, FADE_MS = 800;
const HOLD_OPACITY = 0.5, HOVER_OPACITY = 0.95;
/** How close (in CSS pixels) the pointer must be to an arc to hover or click it. */
const HIT_PX = 10;
const DRAG_PX = 5;
/** Lowest a label's anchor may sit from the canvas top, so it clears the top bar (64 px) and its own height. */
const LABEL_MIN_Y = 100, LABEL_STEP = 24;
const GOLD = new THREE.Color('#ffc940'), RED_GOLD = new THREE.Color('#ff6a2a');
const HOT = new THREE.Color('#fff4c4');

interface Slot {
  mesh: THREE.Mesh; head: THREE.Mesh; start: number; mid: THREE.Vector3; active: boolean;
  url: string | null; label: HTMLDivElement; text: string; shown: boolean;
}

/** `<amount> TNC · <note>`, the note trimmed so the label stays small. */
function labelText(row: LedgerRow): string {
  const amt = row.amount >= 100 ? Math.round(row.amount).toLocaleString('en-GB') : row.amount.toFixed(2).replace(/\.00$/, '');
  const note = (row.note ?? row.reason).trim();
  const short = note.length > 42 ? `${note.slice(0, 41)}...` : note;
  return `${amt} TNC \u00b7 ${short}`;
}

/** Distance from point p to segment ab, all in screen pixels. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

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
      const label = document.createElement('div');
      label.className = 'pay-arc-label';
      slots.push({ mesh, head, start: 0, mid: new THREE.Vector3(), active: false, url: null, label, text: '', shown: false });
    }
    return { group, slots, pts: new Map<Slot, THREE.Vector3[]>() };
  }, []);
  const dom = useThree((s) => s.gl.domElement);
  const hovered = useRef<Slot | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const pointerDirty = useRef(false);
  const seen = useRef(new Set<string>());
  const ready = useRef(new Map<Slot, { radius: number }>());

  // Labels live in a plain DOM layer over the canvas, moved each frame to the arc's top.
  useEffect(() => {
    const host = dom.parentElement;
    if (!host) return;
    const layer = document.createElement('div');
    layer.className = 'pay-arc-layer';
    for (const s of pool.slots) {
      layer.appendChild(s.label);
      s.label.addEventListener('click', (e) => {
        e.stopPropagation();
        if (s.url) window.open(s.url, '_blank', 'noopener');
      });
    }
    host.appendChild(layer);
    return () => { layer.remove(); };
  }, [dom, pool]);

  // Pointer: hover by screen distance to the arc; a click on an arc opens Explorer and does not
  // reach tile picking (capture phase on the canvas runs before Picking's listener).
  useEffect(() => {
    let down: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; pointerDirty.current = true; };
    const onLeave = () => { pointer.current = null; pointerDirty.current = true; };
    const onDown = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      const s = hovered.current;
      if (moved >= DRAG_PX || !s || !s.active) return;
      e.stopImmediatePropagation();
      if (s.url) window.open(s.url, '_blank', 'noopener');
    };
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerleave', onLeave);
    dom.addEventListener('pointerdown', onDown, true);
    dom.addEventListener('pointerup', onUp, true);
    return () => {
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerleave', onLeave);
      dom.removeEventListener('pointerdown', onDown, true);
      dom.removeEventListener('pointerup', onUp, true);
    };
  }, [dom]);

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
      slot.url = row.url ?? null;
      slot.text = labelText(row);
      slot.label.textContent = slot.text;
      slot.label.classList.toggle('has-url', !!slot.url);
      slot.label.title = slot.url ? 'Open this payment on Solana Explorer' : 'Simulated payment (no transaction on chain)';
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
  const proj = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const now = performance.now();
    const camDir = camera.position.clone().normalize();
    const rect = dom.getBoundingClientRect();
    const toScreen = (v: THREE.Vector3): [number, number] => {
      proj.copy(v).project(camera);
      return [(proj.x * 0.5 + 0.5) * size.width, (-proj.y * 0.5 + 0.5) * size.height];
    };

    // Hover: the nearest visible arc within HIT_PX of the pointer (only checked when needed).
    const anyActive = pool.slots.some((s) => s.active);
    if (pointerDirty.current || anyActive) {
      pointerDirty.current = false;
      let best: Slot | null = null, bestD = HIT_PX;
      const p = pointer.current;
      if (p && anyActive) {
        const px = p.x - rect.left, py = p.y - rect.top;
        for (const s of pool.slots) {
          if (!s.active || now - s.start < TRAVEL_MS * 0.6) continue;
          tmp.copy(s.mid).normalize();
          if (tmp.dot(camDir) < 0.05) continue;
          const pts = pool.pts.get(s)!;
          let [ax, ay] = toScreen(pts[0]!);
          for (let i = 2; i <= SEGS; i += 2) {
            const [bx, by] = toScreen(pts[i]!);
            const d = segDist(px, py, ax, ay, bx, by);
            if (d < bestD) { bestD = d; best = s; }
            ax = bx; ay = by;
          }
        }
      }
      if (best !== hovered.current) {
        if (best || hovered.current) dom.style.cursor = best ? 'pointer' : '';
        hovered.current = best;
      }
    }

    const placed: [number, number][] = [];
    for (const s of pool.slots) {
      if (!s.active) { if (s.shown) { s.label.style.opacity = '0'; s.label.style.visibility = 'hidden'; s.shown = false; } continue; }
      const age = now - s.start;
      if (age >= TOTAL_MS) {
        s.active = false; s.mesh.visible = false; s.head.visible = false;
        s.label.style.opacity = '0'; s.label.style.visibility = 'hidden'; s.shown = false;
        if (hovered.current === s) { hovered.current = null; dom.style.cursor = ''; }
        continue;
      }
      const travel = Math.min(1, age / TRAVEL_MS);
      const eased = 1 - Math.pow(1 - travel, 2);
      // travel at full strength, settle down to the hold opacity, hold, then fade out
      let level: number;
      if (age < TRAVEL_MS) level = 1;
      else if (age < SETTLE_MS) level = 1 - (1 - HOLD_OPACITY / 0.85) * ((age - TRAVEL_MS) / (SETTLE_MS - TRAVEL_MS));
      else level = HOLD_OPACITY / 0.85;
      const out = Math.min(1, (TOTAL_MS - age) / FADE_MS);
      const isHover = hovered.current === s;
      // hide on the far side: fade by how far the arc's midpoint is behind the horizon
      tmp.copy(s.mid).normalize();
      const facing = tmp.dot(camDir);
      const horizon = Math.min(1, Math.max(0, (facing + 0.05) / 0.2));
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (isHover ? HOVER_OPACITY : 0.85 * level) * out * horizon;
      s.mesh.geometry.setDrawRange(0, Math.max(6, Math.floor(eased * SEGS)) * RING * 6);
      const pts = pool.pts.get(s)!;
      const f = eased * SEGS, i0 = Math.min(SEGS - 1, Math.floor(f));
      s.head.position.copy(pts[i0]!).lerp(pts[i0 + 1]!, f - i0);
      // the bright head dies away once the arc has landed
      const headFade = age < TRAVEL_MS ? 1 : Math.max(0, 1 - (age - TRAVEL_MS) / 500);
      (s.head.material as THREE.MeshBasicMaterial).opacity = headFade * horizon;

      // label at the arc's top, once it has landed and while it faces the camera
      const lab = age > TRAVEL_MS * 0.8 && horizon > 0.5 ? Math.min(1, (age - TRAVEL_MS * 0.8) / 300) * out : 0;
      if (lab > 0.01) {
        // a long arc can top out off screen: keep its label below the top bar and inside the view
        const [mx, my] = toScreen(s.mid);
        const x = Math.min(size.width - 150, Math.max(150, mx));
        let y = Math.min(size.height - 20, Math.max(LABEL_MIN_Y, my));
        // two arcs between the same capitals would share a spot: stack them downwards
        for (let k = 0; k < placed.length; k++) {
          const o = placed[k]!;
          if (Math.abs(o[0] - x) < 220 && Math.abs(o[1] - y) < LABEL_STEP) { y = o[1] + LABEL_STEP; k = -1; }
        }
        placed.push([x, y]);
        s.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, calc(-100% - 6px))`;
        s.label.style.opacity = (isHover ? 1 : 0.85 * lab).toFixed(3);
        s.label.classList.toggle('hover', isHover);
        if (!s.shown) { s.label.style.visibility = 'visible'; s.shown = true; }
      } else if (s.shown) {
        s.label.style.opacity = '0'; s.label.style.visibility = 'hidden'; s.shown = false;
      }
    }
  });

  return <primitive object={pool.group} />;
}
