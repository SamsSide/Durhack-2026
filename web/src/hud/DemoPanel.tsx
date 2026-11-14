// Dev only: a small panel of demo buttons, so a tester can stage the showpieces without a console.
// A collapsible, draggable, resizable panel (layout kept in localStorage). Toggle with the backquote key or
// Shift+D; open at load with ?demo in the URL. Hide HUD never hides the launcher. Each button calls a
// window.__* helper installed by its layer; a helper that is not there yet greys its button out. Lane b.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useWorld } from '../state/world';

type Win = Record<string, ((...a: unknown[]) => unknown) | undefined>;
const win = () => window as unknown as Win;
const has = (k: string) => typeof win()[k] === 'function';

const SPEEDS = [
  { label: '1 mo/s', v: 1 / 24 },
  { label: '2 yrs/s', v: 1 },
  { label: '10 yrs/s', v: 5 },
];

/** A nation to act on: the selected one, else the first alive. */
function nation(): { id: number; name: string } | null {
  const s = useWorld.getState();
  const w = s.world;
  if (!w) return null;
  const sel = s.selectedCountryId;
  const id = sel != null && w.countries[sel]?.alive ? sel : w.countries.findIndex((c) => c.alive);
  return id >= 0 ? { id, name: w.countries[id]!.name } : null;
}
const nameOf = (id: unknown) => (typeof id === 'number' ? useWorld.getState().world?.countries[id]?.name ?? `#${id}` : null);

interface Action { key: string; label: string; helper: string; run: () => string }

const NO_WORLD = 'no world yet';

/** Clean view for recordings: hide everything over the globe except the demo launcher. */
function demoMode(on: boolean): void {
  const app = document.querySelector('#root > div');
  if (!app) return;
  for (const el of Array.from(app.children).slice(1)) {
    if ((el as HTMLElement).hasAttribute('data-demo-panel')) continue;
    (el as HTMLElement).style.visibility = on ? 'hidden' : '';
  }
  (window as unknown as { __demoModeOn?: boolean }).__demoModeOn = on;
  window.dispatchEvent(new Event('demomodechange'));
}
if (import.meta.env.DEV) (window as unknown as { __demoMode?: (on?: boolean) => void }).__demoMode = (on = true) => demoMode(on);

let econOn = false;
const ACTIONS: Action[] = [
  { key: 'launch', label: 'Launch rocket', helper: '__launchDemo', run: () => {
    if (!useWorld.getState().world) return NO_WORLD;
    const id = win().__launchDemo!();
    return id == null ? 'no capital with a free orbit slot' : `launched from ${nameOf(id)}`;
  } },
  { key: 'war', label: 'War demo', helper: '__warDemo', run: () => {
    if (!useWorld.getState().world) return NO_WORLD;
    const r = win().__warDemo!() as { a: string; b: string } | null;
    return r ? `${r.a} against ${r.b}` : 'no shared border found';
  } },
  { key: 'seal', label: 'Seal on chain', helper: '__sealDemo', run: () => {
    if (!useWorld.getState().world) return NO_WORLD;
    win().__sealDemo!();
    return 'seal placed between the two nearest capitals';
  } },
  { key: 'econ', label: 'Economy demo', helper: '__econDemo', run: () => {
    const w = useWorld.getState().world;
    if (!w) return NO_WORLD;
    const on = (econOn = !econOn);
    win().__econDemo!(on);
    return on ? 'economy values on' : 'economy values off';
  } },
  { key: 'council', label: 'Council', helper: '__councilDemo', run: () => {
    const n = nation();
    if (!n) return NO_WORLD;
    win().__councilDemo!(n.id);
    return `succession in ${n.name}`;
  } },
  { key: 'wonder', label: 'Wonder', helper: '__wonderDemo', run: () => {
    const n = nation();
    if (!n) return NO_WORLD;
    const r = win().__wonderDemo!(n.id, 'pyramid');
    return r == null ? `no place for a wonder in ${n.name}` : `pyramid rising in ${n.name}`;
  } },
  { key: 'star', label: 'Shooting star', helper: '__shootingStar', run: () => {
    win().__shootingStar!();
    return 'shooting star on its way';
  } },
];

const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 132px) 1fr', alignItems: 'center', gap: 8 };
const note: CSSProperties = { fontSize: 12, lineHeight: '14px', color: 'var(--color-text-muted)', fontStyle: 'italic', overflowWrap: 'anywhere' };

const STORE = 'tn-demo-panel';
const MIN_W = 220;
const MIN_H = 120;
const DEFAULT_POS = { x: 16, y: 132 };
const DEFAULT_SIZE = { w: 268, h: 372 };
interface Layout { x: number; y: number; w: number; h: number; collapsed: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const modeOn = () => !!(window as unknown as { __demoModeOn?: boolean }).__demoModeOn;

function loadLayout(): Layout {
  const def: Layout = { ...DEFAULT_POS, ...DEFAULT_SIZE, collapsed: true };
  try {
    const r = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Layout> | null;
    if (r && [r.x, r.y, r.w, r.h].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      const w = clamp(r.w!, MIN_W, window.innerWidth), h = clamp(r.h!, MIN_H, window.innerHeight);
      const onScreen = r.x! >= 0 && r.y! >= 0 && r.x! + 40 <= window.innerWidth && r.y! + 30 <= window.innerHeight;
      return { x: onScreen ? r.x! : def.x, y: onScreen ? r.y! : def.y, w, h, collapsed: r.collapsed !== false };
    }
  } catch { /* storage blocked: use the defaults */ }
  return def;
}
const saveLayout = (l: Layout) => { try { localStorage.setItem(STORE, JSON.stringify(l)); } catch { /* ignore */ } };

/** Stop a pointer or wheel event reaching the globe underneath. */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const stopProps = { onPointerDown: stop, onPointerUp: stop, onPointerMove: stop, onMouseDown: stop, onMouseUp: stop, onClick: stop, onDoubleClick: stop, onWheel: stop, onContextMenu: stop, onTouchStart: stop };

export function DemoPanel() {
  const [layout, setLayout] = useState<Layout>(() => {
    const l = loadLayout();
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo') ? { ...l, collapsed: false } : l;
  });
  const [hudHidden, setHudHidden] = useState(modeOn);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);
  const send = useWorld((s) => s.send);
  const speed = useWorld((s) => s.clock?.target ?? s.world?.speed ?? 1);
  const boxRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const open = !layout.collapsed;

  const update = (patch: Partial<Layout>) => setLayout((l) => { const n = { ...l, ...patch }; saveLayout(n); return n; });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.key !== '`' && !(e.key === 'D' && e.shiftKey)) return;
      if (modeOn()) { demoMode(false); update({ collapsed: false }); return; }
      update({ collapsed: !layoutRef.current.collapsed });
    };
    const onMode = () => setHudHidden(modeOn());
    const onResize = () => setLayout((l) => ({ ...l })); // re-clamp on render
    window.addEventListener('keydown', onKey);
    window.addEventListener('demomodechange', onMode);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('demomodechange', onMode); window.removeEventListener('resize', onResize); };
  }, []);
  // helpers come and go with their layers: look again every second while open
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [open]);
  // remember the size the user drags the corner to
  useEffect(() => {
    const el = boxRef.current;
    if (!open || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      const l = layoutRef.current;
      if (Math.abs(w - l.w) > 1 || Math.abs(h - l.h) > 1) update({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const onDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    const t = e.target as HTMLElement;
    if (t.closest('button') && !t.closest('[data-launcher]')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    justDragged.current = false;
    const l = layoutRef.current;
    drag.current = { dx: e.clientX - l.x, dy: e.clientY - l.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onMove = (e: ReactPointerEvent) => {
    e.stopPropagation();
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    d.moved = true;
    const nx = e.clientX - d.dx, ny = e.clientY - d.dy;
    setLayout((l) => ({ ...l, x: nx, y: ny }));
  };
  const onUp = (e: ReactPointerEvent) => {
    e.stopPropagation();
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      justDragged.current = true;
      const l = layoutRef.current;
      const bw = l.collapsed ? 84 : clamp(l.w, MIN_W, window.innerWidth);
      update({ x: clamp(l.x, 0, window.innerWidth - bw), y: clamp(l.y, 0, window.innerHeight - 36) });
    }
  };

  const run = (a: Action) => {
    let msg: string;
    try { msg = has(a.helper) ? a.run() : 'not available here'; } catch (err) { msg = `failed: ${(err as Error).message ?? err}`; }
    setStatus((s) => ({ ...s, [a.key]: msg }));
  };

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const w = clamp(layout.w, MIN_W, vw), h = clamp(layout.h, MIN_H, vh);
  const bw = open ? w : 84;
  const x = clamp(layout.x, 0, vw - bw), y = clamp(layout.y, 0, vh - 36);

  const base: CSSProperties = { position: 'absolute', zIndex: 9, left: x, top: y };
  if (!open) {
    return (
      <div data-demo-panel {...stopProps} style={base}>
        <button type="button" data-launcher="1" className="tn-button tn-lacquer" aria-label="Open the demo panel" title="Demo tools (drag to move, backquote toggles)"
          style={{ width: 84, height: 32, borderRadius: 16, cursor: 'grab', touchAction: 'none', letterSpacing: 1 }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          onClick={(e) => { e.stopPropagation(); if (justDragged.current) { justDragged.current = false; return; } update({ collapsed: false }); }}>Demo</button>
      </div>
    );
  }
  return (
    <div data-demo-panel ref={boxRef} className="hud tn-lacquer" role="region" aria-label="Demo panel" {...stopProps}
      style={{ ...base, width: w, height: h, minWidth: MIN_W, minHeight: MIN_H, maxWidth: '100vw', maxHeight: '100vh', resize: 'both', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '0 var(--space-3) var(--space-3)', borderRadius: 4, boxSizing: 'border-box' }}>
      <div className="tn-caps" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-cap)', cursor: 'grab', touchAction: 'none', position: 'sticky', top: 0, padding: 'var(--space-2) 0', gap: 6, flexWrap: 'wrap', userSelect: 'none' }}>
        <span title="Drag to move">:: Demo</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="tn-button tn-button--sm" onClick={() => demoMode(!hudHidden)} title={hudHidden ? 'Bring the HUD back' : 'Hide the HUD for a recording'}>{hudHidden ? 'Show HUD' : 'Hide HUD'}</button>
          <button type="button" className="tn-button tn-button--sm" onClick={() => update({ collapsed: true })} aria-label="Collapse the demo panel">Collapse</button>
        </span>
      </div>
      {ACTIONS.map((a) => (
        <div key={a.key} style={row}>
          <button type="button" className="tn-button tn-button--sm" disabled={!has(a.helper)} onClick={() => run(a)} title={has(a.helper) ? a.helper : `${a.helper} is not loaded`}>{a.label}</button>
          <span style={note}>{status[a.key] ?? (has(a.helper) ? '' : 'not loaded')}</span>
        </div>
      ))}
      <div style={{ ...row, gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 2 }}>
        {SPEEDS.map((s) => (
          <button key={s.label} type="button" className={`tn-button tn-button--sm${Math.abs(speed - s.v) < s.v * 0.02 ? ' tn-button--gilt' : ''}`}
            onClick={() => send({ type: 'control', action: 'speed', value: s.v })}>{s.label}</button>
        ))}
      </div>
    </div>
  );
}
