import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChronicleEntry, World } from '@terra/shared';
import { Chevron, Diamond } from './Diamond';
import { displayKind } from './kinds';

const SHOWN = 12;
const SPEED = 40;          // px a second
const RESET_GAP_MS = 5000; // a new entry jumps the strip back to its start at most this often

function Items({ world, entries, onPick, hidden }: {
  world: World;
  entries: ChronicleEntry[];
  onPick: (ids: number[]) => void;
  hidden?: boolean;
}) {
  return (
    <div className="tn-t-copy" aria-hidden={hidden || undefined}>
      {entries.map((e, i) => (
        <span key={e.id} className="tn-t-cell">
          <button
            type="button"
            className={`tn-t-item ${i === 0 && !hidden ? 'tn-t-new' : ''}`}
            tabIndex={hidden ? -1 : undefined}
            disabled={e.countries.length === 0}
            onClick={() => onPick(e.countries)}
            title={e.text}
          >
            <Diamond kind={displayKind(e, world)} />
            <span className="tn-yr">Y{e.year}</span>
            <span className="tn-t-txt">{e.text}</span>
          </button>
          <span className="tn-t-sep" />
        </span>
      ))}
    </div>
  );
}

/** The collapsed chronicle: a parchment strip that scrolls the last twelve entries left. */
export function Ticker({ world, open, onToggle, onPick }: {
  world: World;
  open: boolean;
  onToggle: () => void;
  onPick: (ids: number[]) => void;
}) {
  const chron = world.chronicle;
  const len = chron.length;
  const recent: ChronicleEntry[] = [];
  for (let i = len - 1; i >= 0 && recent.length < SHOWN; i--) recent.push(chron[i]!);
  const newestId = recent[0]?.id ?? null;

  const trackRef = useRef<HTMLDivElement>(null);
  const beltRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [loop, setLoop] = useState(false);
  const offset = useRef(0);
  const copyW = useRef(0);
  const paused = useRef(false);
  const lastReset = useRef(0);

  // Measure: the strip loops only when one copy is wider than the track.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const copy = copyRef.current;
    if (!track || !copy) return;
    const measure = () => {
      copyW.current = copy.offsetWidth;
      setLoop(copy.offsetWidth > track.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(copy);
    return () => ro.disconnect();
  }, [newestId == null]);

  // A new entry joins at the front: bring the strip back to its start (throttled).
  useEffect(() => {
    if (newestId == null) return;
    const now = performance.now();
    if (now - lastReset.current >= RESET_GAP_MS) {
      lastReset.current = now;
      offset.current = 0;
    }
  }, [newestId]);

  // The scroll itself: a transform on the belt, so new entries never restart a CSS animation.
  useEffect(() => {
    const belt = beltRef.current;
    if (!belt) return;
    if (!loop || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      offset.current = 0;
      belt.style.transform = '';
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!paused.current && copyW.current > 0) {
        offset.current = (offset.current + SPEED * dt) % copyW.current;
      }
      belt.style.transform = `translateX(${-offset.current}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [loop]);

  return (
    <div className="tn-ticker">
      <span className="tn-t-label">Chronicle</span>
      <div
        className="tn-t-track"
        ref={trackRef}
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
        onFocus={() => { paused.current = true; }}
        onBlur={() => { paused.current = false; }}
      >
        {recent.length === 0 ? (
          <span className="tn-t-empty">Nothing has been written yet.</span>
        ) : (
          <div className="tn-t-belt" ref={beltRef}>
            <div ref={copyRef} className="tn-t-measure">
              <Items world={world} entries={recent} onPick={onPick} />
            </div>
            {loop && <Items world={world} entries={recent} onPick={onPick} hidden />}
          </div>
        )}
      </div>
      <button type="button" className="tn-btn" onClick={onToggle} aria-expanded={open}>
        Timeline <Chevron up={!open} />
      </button>
    </div>
  );
}
