import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorld } from '../state/world';
import { usePresence } from '../ui/motion/usePresence';
import './hud.css';
import { yearRange } from '@terra/shared';

// Window event any code can dispatch to open the closing card.
export const CLOSING_EVENT = 'terra:closing';
const COUNT_MS = 1200;
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

function useCountUp(target: number, run: boolean): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) { setV(0); return; }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setV(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / COUNT_MS);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

export function ClosingCard() {
  const world = useWorld((s) => s.world);
  const budget = useWorld((s) => s.budget);
  const [open, setOpen] = useState(false);
  const wasPaused = useRef(false);

  const show = useCallback(() => {
    const w = useWorld.getState().world;
    if (!w) return;
    wasPaused.current = w.paused;
    useWorld.getState().send({ type: 'control', action: 'pause', value: true });
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    if (!wasPaused.current) useWorld.getState().send({ type: 'control', action: 'pause', value: false });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (e.key === 'End') show();
      else if (e.key === 'Escape' && open) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(CLOSING_EVENT, show);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(CLOSING_EVENT, show); };
  }, [show, close, open]);

  const total = budget ? budget.tokensIn + budget.tokensOut : 0;
  const { mounted, leaving } = usePresence(open);
  const count = useCountUp(total, mounted);   // the number holds while the card fades out
  if (!mounted || !world) return null;

  const a = world.year - world.tick;   // one tick is one year from the founding, even after a page reload
  const b = world.year;
  const local = budget?.localCalls ?? 0;   // answered by Gemma on this laptop: real decisions, no cloud tokens
  const wars = world.chronicle.filter((c) => c.kind === 'war' || c.kind === 'silence').length;
  const facts: [number, string][] = [
    [world.countries.length, 'nations, each ruled by its own AI'],
    [b - a, 'years of history'],
    [(budget?.calls ?? 0) + local, 'decisions made by the rulers'],
    [wars, 'wars and silences'],
  ];
  return (
    <div className={`closing-veil ${leaving ? 'tn-m-veil-out' : 'tn-m-veil-in'}`} onClick={close}>
      <div className={`closing tn-lacquer tn-frame tn-frame--corners tn-m-from-below ${leaving ? 'tn-m-out' : 'tn-m-in'}`} role="dialog" aria-label="What this world cost" onClick={(e) => e.stopPropagation()}>
        <div className="cap tn-cartouche">{world.name} · years {yearRange(a, b)}</div>
        <h1 className="tn-gilt-text">This whole world cost</h1>
        <div className="cl-hero"><span className="cl-num tn-gilt-text">{fmt(count)}</span><span className="cl-unit">tokens</span></div>
        <div className="cl-stats tn-m-stagger">
          {facts.map(([n, label]) => <div key={label}><b>{fmt(n)}</b><span>{label}</span></div>)}
        </div>
        <div className="cl-foot">
          <span className="muted">
            {local > 0 ? `${fmt(local)} of those decisions came from Gemma running on this laptop, at no token cost. ` : ''}
            Every decision is in the event log, so this world replays exactly, offline.
          </span>
          <button className="tn-button tn-button--lacquer" autoFocus onClick={close}>Back to the world</button>
        </div>
      </div>
    </div>
  );
}
