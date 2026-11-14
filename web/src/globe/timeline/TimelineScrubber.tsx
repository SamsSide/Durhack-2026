// B9 timeline scrubber (lane a): a slim bar above the chronicle ticker. Drag the handle to see the
// globe at any past year; "Live" or Escape returns to the present. The replay is in engine.ts.
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { closeTimeline, goLive, openTimeline, scrubTo, startTimeline, useTimeline, yearOf } from './engine';
import type { Marker, MarkerKind } from './engine';
import './timeline.css';

const KIND_LABEL: Record<MarkerKind, string> = {
  war: 'War', fall: 'Fall', secession: 'Secession', wonder: 'Wonder', death: 'Death',
};

const SWAP_REST_MS = 40;    // the pointer has paused: redraw the globe
const SWAP_MAX_MS = 250;    // while it keeps moving, redraw this often at least

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

export function TimelineScrubber() {
  const open = useTimeline((s) => s.open);
  const status = useTimeline((s) => s.status);
  const progress = useTimeline((s) => s.progress);
  const maxTick = useTimeline((s) => s.maxTick);
  const viewTick = useTimeline((s) => s.viewTick);
  const markers = useTimeline((s) => s.markers);
  const error = useTimeline((s) => s.error);

  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const wanted = useRef<number | null>(null);
  const timer = useRef(0);
  const lastSwap = useRef(0);
  const [dragTick, setDragTick] = useState<number | null>(null);
  const [tip, setTip] = useState<Marker | null>(null);

  useEffect(() => startTimeline(), []);
  useEffect(() => () => { window.clearTimeout(timer.current); closeTimeline(); }, []);

  // Escape returns to the live world first; with nothing to return from, it closes the bar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTyping(e.target)) return;
      if (useTimeline.getState().viewTick != null) void goLive();
      else closeTimeline();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) {
    return (
      <div className="tls">
        <button type="button" className="tn-button tn-button--lacquer tls-toggle" onClick={openTimeline} aria-expanded={false} title="Scrub back through the years">
          History
        </button>
      </div>
    );
  }

  const ready = status === 'ready' && maxTick > 0;
  const at = Math.min(maxTick, dragTick ?? viewTick ?? maxTick);
  const pct = maxTick > 0 ? (at / maxTick) * 100 : 100;
  const inPast = dragTick != null ? dragTick < maxTick : viewTick != null;

  // The handle and the year follow the pointer at once. The globe is heavier (every layer redraws
  // for a new World), so it follows when the pointer rests, and every SWAP_MAX_MS while it moves.
  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    if (wanted.current != null) { lastSwap.current = performance.now(); scrubTo(wanted.current); }
    wanted.current = null;
  };
  const request = (tick: number) => {
    wanted.current = tick;
    setDragTick(tick);
    window.clearTimeout(timer.current);
    const due = lastSwap.current + SWAP_MAX_MS - performance.now();
    timer.current = window.setTimeout(flush, Math.max(0, Math.min(SWAP_REST_MS, due)));
  };
  const tickAt = (clientX: number): number => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))) * maxTick);
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!ready || e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.focus();
    request(tickAt(e.clientX));
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragging.current) request(tickAt(e.clientX)); };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    flush();
    setDragTick(null);
  };

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!ready) return;
    const big = e.shiftKey ? 10 : 1;
    let to: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = at - big;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = at + big;
    else if (e.key === 'PageDown') to = at - 10;
    else if (e.key === 'PageUp') to = at + 10;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = maxTick;
    else if (e.key === '[') to = [...markers].reverse().find((m) => m.tick < at)?.tick ?? null;
    else if (e.key === ']') to = markers.find((m) => m.tick > at && m.tick < maxTick)?.tick ?? null;
    if (to == null) return;
    e.preventDefault();
    scrubTo(to);
  };

  const tipPct = tip && maxTick > 0 ? Math.min(100, (tip.tick / maxTick) * 100) : 0;
  const tipSide = tipPct < 22 ? ' tls-tip-left' : tipPct > 78 ? ' tls-tip-right' : '';

  return (
    <div className={`tls tls-open tn-lacquer tn-frame tn-frame--slim${inPast ? ' tls-past' : ''}`} role="group" aria-label="History of the world">
      <button type="button" className="tn-button tn-button--lacquer tls-toggle is-active" onClick={closeTimeline} aria-expanded title="Close the history bar">
        History
      </button>

      <div className="tls-year" aria-live="polite">
        <span className="tls-cap">{inPast ? 'Viewing' : status === 'loading' ? 'Reading' : 'Year'}</span>
        <span className="tls-num">{status === 'loading' ? `${Math.round(progress * 100)}%` : ready ? yearOf(at) : '...'}</span>
      </div>

      {status === 'error' ? (
        <div className="tls-note">
          The history could not be read{error ? ` (${error})` : ''}.
          <button type="button" className="tn-button tn-button--lacquer tn-button--sm" onClick={openTimeline}>Try again</button>
        </div>
      ) : status === 'ready' && maxTick === 0 ? (
        <div className="tls-note">This world is in its first year. There is no past to visit yet.</div>
      ) : (
        <div
          ref={trackRef}
          className={`tls-track${ready ? '' : ' tls-busy'}`}
          role="slider"
          tabIndex={0}
          aria-label="Year shown on the globe"
          aria-valuemin={ready ? yearOf(0) : 0}
          aria-valuemax={ready ? yearOf(maxTick) : 0}
          aria-valuenow={ready ? yearOf(at) : 0}
          aria-valuetext={ready ? (inPast ? `Year ${yearOf(at)}` : `Year ${yearOf(at)}, live`) : 'Reading the chronicle'}
          aria-disabled={!ready}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
        >
          <div className="tls-rail">
            <div className="tls-fill" style={{ width: `${ready ? pct : progress * 100}%` }} />
          </div>
          {ready && markers.map((m) => (
            <button
              key={m.id}
              type="button"
              tabIndex={-1}
              className={`tls-mark tls-k-${m.kind}`}
              style={{ left: `${Math.min(100, (m.tick / maxTick) * 100)}%` }}
              aria-label={`Year ${m.year}, ${KIND_LABEL[m.kind]}: ${m.text}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => scrubTo(m.tick)}
              onMouseEnter={() => setTip(m)}
              onMouseLeave={() => setTip((t) => (t === m ? null : t))}
              onFocus={() => setTip(m)}
              onBlur={() => setTip((t) => (t === m ? null : t))}
            />
          ))}
          {ready && <div className="tls-thumb" style={{ left: `${pct}%` }} />}
          {ready && tip && (
            <div className={`tls-tip tn-tooltip${tipSide}`} style={{ left: `${tipPct}%` }} role="tooltip">
              <div className="tls-tip-k"><i className={`tls-dia tls-k-${tip.kind}`} />Y{tip.year} · {KIND_LABEL[tip.kind]}</div>
              {tip.text}
            </div>
          )}
        </div>
      )}

      {ready && <span className="tls-range">{yearOf(0)} to {yearOf(maxTick)}</span>}
      <button type="button" className={`tn-button tn-button--lacquer tn-button--sm tls-live${inPast ? '' : ' on'}`} onClick={() => void goLive()} disabled={viewTick == null} title="Return to the present (Escape)">
        <i />Live
      </button>
    </div>
  );
}
