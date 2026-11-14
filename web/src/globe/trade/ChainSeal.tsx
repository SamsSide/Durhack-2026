// B13: a red wax seal stamped on a payment's arc once Solana confirms it. Mount inside the Canvas,
// next to <Trade />. Pooled DOM nodes (MAX), only the visible seals are projected each frame.
// Rows with no `url` or `signature` (mock) never get a seal. Clicking a seal opens `row.url`.
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { onWorldReset, useWorld } from '../../state/world';
import type { LedgerRow } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';
import './chainseal.css';

const MAX = 4, LIFE_MS = 6000, FADE_MS = 500;

interface Seal {
  el: HTMLAnchorElement; tip: HTMLSpanElement; count: HTMLSpanElement;
  active: boolean; start: number; to: number; n: number; url: string; pos: THREE.Vector3; shown: boolean;
}

function capital(world: World, id: number, out: THREE.Vector3): boolean {
  const c = world.countries[id];
  const t = c ? world.tiles[c.capitalTile] : undefined;
  if (!t) return false;
  out.set(t.center[0], t.center[1], t.center[2]).normalize().multiplyScalar(tileHeight(t));
  return true;
}

/** Midpoint of the payment arc (same lift as Trade's arcPoints at t = 0.5); the payee's capital if the payer is gone. */
function arcMid(world: World, from: number, to: number, out: THREE.Vector3): boolean {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  if (!capital(world, to, b)) return false;
  if (!capital(world, from, a)) { out.copy(b); return true; }
  const ang = Math.acos(Math.min(1, Math.max(-1, a.clone().normalize().dot(b.clone().normalize()))));
  const r = (a.length() + b.length()) / 2 + 0.012 + ang * 0.1 + 0.004;
  out.copy(a).normalize().add(b.clone().normalize());
  if (out.lengthSq() < 1e-6) { out.copy(b); return true; }
  out.normalize().multiplyScalar(r);
  return true;
}

export function ChainSeal() {
  const world = useWorld((s) => s.world);
  const dom = useThree((s) => s.gl.domElement);
  const getThree = useThree((s) => s.get);
  const seals = useMemo<Seal[]>(() => {
    const out: Seal[] = [];
    for (let i = 0; i < MAX; i++) {
      const el = document.createElement('a');
      el.className = 'chain-seal';
      el.target = '_blank'; el.rel = 'noopener';
      el.innerHTML = '<span class="chain-seal__pos"><span class="chain-seal__ring"></span><span class="chain-seal__wax"></span><span class="chain-seal__tick">✓</span><span class="chain-seal__count"></span><span class="chain-seal__tip"></span></span>';
      out.push({
        el, tip: el.querySelector('.chain-seal__tip')!, count: el.querySelector('.chain-seal__count')!,
        active: false, start: 0, to: -1, n: 1, url: '', pos: new THREE.Vector3(), shown: false,
      });
    }
    return out;
  }, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const host = dom.parentElement;
    if (!host) return;
    const layer = document.createElement('div');
    layer.className = 'chain-seal-layer';
    for (const s of seals) {
      layer.appendChild(s.el);
      // never reaches tile picking; window.open replaces the anchor's own navigation
      s.el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (s.url) window.open(s.url, '_blank', 'noopener'); });
      s.el.addEventListener('pointerdown', (e) => e.stopPropagation());
      s.el.addEventListener('pointerup', (e) => e.stopPropagation());
    }
    host.appendChild(layer);
    return () => { layer.remove(); };
  }, [dom, seals]);

  useEffect(() => {
    const seen = new Set<string>();
    const hide = (s: Seal) => { s.active = false; s.shown = false; s.el.style.visibility = 'hidden'; s.el.style.opacity = '0'; };
    const offReset = onWorldReset(() => { seen.clear(); seals.forEach(hide); });
    const place = (row: LedgerRow) => {
      const w = useWorld.getState().world;
      if (!w || !row.url) return;
      const now = performance.now();
      // High speed: payments to the same capital share one seal ("xN").
      let s = seals.find((o) => o.active && o.to === row.to && now - o.start < LIFE_MS - FADE_MS);
      if (s) s.n++;
      else {
        s = seals.find((o) => !o.active) ?? seals.reduce((o, c) => (c.start < o.start ? c : o));
        if (!arcMid(w, row.from, row.to, s.pos)) return;
        s.n = 1; s.to = row.to;
      }
      s.active = true; s.start = now; s.url = row.url;
      s.el.href = row.url;
      s.tip.textContent = `on chain · ${(row.signature ?? '').slice(0, 4)}`;
      s.count.textContent = `x${s.n}`;
      s.el.classList.toggle('merged', s.n > 1);
      s.el.classList.remove('stamp'); void s.el.offsetWidth; s.el.classList.add('stamp');
    };
    const eligible = (r: LedgerRow) => r.status === 'confirmed' && !!r.signature && !!r.url;
    for (const r of useWorld.getState().ledger) if (eligible(r)) seen.add(r.id);
    let last = useWorld.getState().ledger;
    const off = useWorld.subscribe((st) => {
      if (st.ledger === last) return;
      last = st.ledger;
      for (const r of st.ledger.slice(-12)) {
        if (seen.has(r.id) || !eligible(r)) continue;
        seen.add(r.id);
        place(r);
      }
    });
    // Dev helper: push a fake confirmed row so the seal can be seen without devnet.
    const win = window as unknown as { __sealDemo?: () => void };
    win.__sealDemo = () => {
      const wd = useWorld.getState().world;
      if (!wd) return;
      // the two nations whose capitals face the camera most, so the seal is on screen
      const cam = getThree().camera.position.clone().normalize();
      const v = new THREE.Vector3();
      const ids = Object.keys(wd.countries).map(Number)
        .map((c) => ({ c, d: capital(wd, c, v) ? v.clone().normalize().dot(cam) : -2 }))
        .sort((a, b) => b.d - a.d).map((o) => o.c);
      const from = ids[0] ?? 0, to = ids[1] ?? ids[0] ?? 0;
      const sig = Math.random().toString(36).slice(2, 6) + '5kQ9demo';
      const row: LedgerRow = {
        id: `seal-demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tick: 0, year: 0, from, to, amount: 25,
        reason: 'trade', note: 'seal demo', status: 'confirmed', signature: sig,
        url: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
      };
      useWorld.setState({ ledger: [...useWorld.getState().ledger, row].slice(-50) });
    };
    return () => { off(); offReset(); delete win.__sealDemo; };
  }, [seals, world?.id, getThree]);

  useFrame(({ camera, size }) => {
    const now = performance.now();
    const camDir = tmp.copy(camera.position).normalize();
    for (const s of seals) {
      if (!s.active) { if (s.shown) { s.el.style.visibility = 'hidden'; s.el.style.opacity = '0'; s.shown = false; } continue; }
      const age = now - s.start;
      if (age >= LIFE_MS) { s.active = false; s.shown = false; s.el.style.visibility = 'hidden'; s.el.style.opacity = '0'; continue; }
      const dot = tmp2.copy(s.pos).normalize().dot(camDir);
      const horizon = Math.min(1, Math.max(0, (dot + 0.05) / 0.2));
      const out = Math.min(1, (LIFE_MS - age) / FADE_MS);
      const p = tmp2.copy(s.pos).project(camera);
      const x = (p.x * 0.5 + 0.5) * size.width, y = (-p.y * 0.5 + 0.5) * size.height;
      s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      s.el.style.opacity = (horizon * out).toFixed(3);
      s.el.style.pointerEvents = horizon > 0.5 ? 'auto' : 'none';
      if (!s.shown) { s.el.style.visibility = 'visible'; s.shown = true; }
    }
  });

  return null;
}
