// Dev only: a small panel of demo buttons, so a tester can stage the showpieces without a console.
// Toggle with the backquote key or Shift+D; open at load with ?demo in the URL. Each button calls a
// window.__* helper installed by its layer; a helper that is not there yet greys its button out. Lane b.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
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

/** Clean view for recordings: hide everything over the globe (the panel too). Backquote brings it back. */
function demoMode(on: boolean): void {
  const app = document.querySelector('#root > div');
  if (!app) return;
  for (const el of Array.from(app.children).slice(1)) (el as HTMLElement).style.visibility = on ? 'hidden' : '';
  (window as unknown as { __demoModeOn?: boolean }).__demoModeOn = on;
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

const panel: CSSProperties = {
  position: 'absolute', zIndex: 9, top: 132, left: 'var(--space-4)', width: 252,
  padding: 'var(--space-2) var(--space-3) var(--space-3)', borderRadius: 4,
  display: 'flex', flexDirection: 'column', gap: 6,
};
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '132px 1fr', alignItems: 'center', gap: 8 };
const note: CSSProperties = { fontSize: 12, lineHeight: '14px', color: 'var(--color-text-muted)', fontStyle: 'italic', overflowWrap: 'anywhere' };

export function DemoPanel() {
  const [open, setOpen] = useState(() => typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo'));
  const [status, setStatus] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);
  const send = useWorld((s) => s.send);
  const speed = useWorld((s) => s.clock?.target ?? s.world?.speed ?? 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.key !== '`' && !(e.key === 'D' && e.shiftKey)) return;
      if ((window as unknown as { __demoModeOn?: boolean }).__demoModeOn) { demoMode(false); setOpen(true); return; }
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // helpers come and go with their layers: look again every second while open
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [open]);

  if (!open) return null;
  const run = (a: Action) => {
    let msg: string;
    try { msg = has(a.helper) ? a.run() : 'not available here'; } catch (err) { msg = `failed: ${(err as Error).message ?? err}`; }
    setStatus((s) => ({ ...s, [a.key]: msg }));
  };
  return (
    <div className="hud tn-lacquer" style={panel} role="region" aria-label="Demo panel">
      <div className="tn-caps" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-cap)' }}>
        <span>Demo</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="tn-button tn-button--sm" onClick={() => demoMode(true)} title="Hide the HUD for a recording; backquote brings it back">Hide HUD</button>
          <button type="button" className="tn-button tn-button--sm" onClick={() => setOpen(false)} aria-label="Close the demo panel">Close</button>
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
