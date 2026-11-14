import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../state/world';

/** The gears (X2, owner decision 14 Nov): speed is a multiplier on two years a second. */
export const GEARS = [
  { v: 1 / 24, label: '1 mo', name: '1 month/s' },
  { v: 1 / 8, label: '', name: '1 season/s' },
  { v: 0.5, label: '1 yr', name: '1 year/s' },
  { v: 1, label: '2', name: '2 years/s' },
  { v: 1.5, label: '3', name: '3 years/s' },
  { v: 2, label: '4', name: '4 years/s' },
  { v: 4, label: '8', name: '8 years/s' },
  { v: 8, label: '16', name: '16 years/s' },
  { v: 16, label: '32', name: '32 years/s' },
  { v: 32, label: '64', name: '64 years/s' },
  { v: 64, label: '128', name: '128 years/s' },
] as const;
const N = GEARS.length - 1;
const MIN = GEARS[0].v;
const MAX = GEARS[N].v;
const SNAP_PULL = 0.3;  // fraction of the gap between two stops within which a drag sticks to the stop
const SEND_GAP = 200;   // ms: at most 5 sends a second while dragging
const NEAR = 0.012;     // a speed this close (relative) to a gear is that gear

const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));
const gearAt = (v: number) => GEARS.findIndex((g) => Math.abs(v - g.v) <= g.v * NEAR);

/** The stops are evenly spaced; between two stops the track is a log scale, so a drag stays continuous. */
function toPos(v: number): number {
  const c = clamp(v);
  let i = 0;
  while (i < N - 1 && c >= GEARS[i + 1]!.v) i++;
  const a = GEARS[i]!.v, b = GEARS[i + 1]!.v;
  return Math.min(1, (i + Math.log(c / a) / Math.log(b / a)) / N);
}
function fromPos(p: number): number {
  const x = Math.min(1, Math.max(0, p)) * N;
  const near = Math.round(x);
  if (Math.abs(x - near) < SNAP_PULL) return GEARS[near]!.v;
  const i = Math.min(N - 1, Math.floor(x));
  const a = GEARS[i]!.v, b = GEARS[i + 1]!.v;
  return Math.round(a * Math.pow(b / a, x - i) * 10000) / 10000;
}

/** "1 month/s", "1 season/s", "3 years/s", "128 years/s"; between gears "4.5 months/s", "5.7 years/s". */
export function speedText(v: number): string {
  const g = gearAt(v);
  if (g >= 0) return GEARS[g]!.name;
  const years = v * 2;
  if (years < 1) return `${(years * 12).toFixed(1)} months/s`;
  return `${years < 10 ? years.toFixed(1) : Math.round(years)} years/s`;
}

/** Pause, the gear slider (one month a second to 128 years a second) and the Auto pacing toggle. */
export function SpeedControl() {
  const send = useWorld((s) => s.send);
  const clock = useWorld((s) => s.clock);
  const worldSpeed = useWorld((s) => s.world?.speed ?? 1);
  const worldPaused = useWorld((s) => s.world?.paused ?? false);
  const [autoLocal, setAuto] = useState(false);
  const [pausedLocal, setPausedLocal] = useState<boolean | null>(null);
  const auto = clock ? clock.pacing === 'auto' : autoLocal;
  const paused = clock ? clock.paused : pausedLocal ?? worldPaused;
  const [drag, setDrag] = useState<number | null>(null); // local value while dragging
  const track = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<number | null>(null);
  const down = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (pending.current != null) { send({ type: 'control', action: 'speed', value: pending.current }); pending.current = null; last.current = Date.now(); }
  };
  const push = (v: number) => {
    pending.current = v;
    const wait = SEND_GAP - (Date.now() - last.current);
    if (wait <= 0) flush();
    else if (timer.current === undefined) timer.current = window.setTimeout(flush, wait);
  };
  const posFromEvent = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };

  const target = clamp(drag ?? clock?.target ?? worldSpeed);           // the chosen speed: where the thumb sits
  const effective = drag ?? (clock ? Math.min(clock.speed, target) : target);
  const slowed = !paused && drag == null && effective < target * 0.95;   // the director, or a machine that is behind
  const pos = toPos(target);
  const fill = toPos(Math.max(MIN, effective));
  const gear = gearAt(target);
  const readout = speedText(slowed ? effective : target);
  const cut = readout.indexOf(' ');

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    down.current = true;
    const v = fromPos(posFromEvent(e));
    setDrag(v); push(v);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!down.current) return;
    const v = fromPos(posFromEvent(e));
    if (v !== drag) { setDrag(v); push(v); }
  };
  const onUp = () => { if (down.current) { down.current = false; flush(); window.setTimeout(() => setDrag(null), 250); } };
  const onKey = (e: React.KeyboardEvent) => {
    let i: number;
    const up = e.key === 'ArrowRight' || e.key === 'ArrowUp';
    if (up) i = GEARS.findIndex((g) => g.v > target * (1 + NEAR));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { i = -1; GEARS.forEach((g, k) => { if (g.v < target * (1 - NEAR)) i = k; }); }
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = N;
    else return;
    e.preventDefault();
    const v = GEARS[i < 0 ? (up ? N : 0) : i]!.v;
    push(v); flush();
  };
  const toggleAuto = () => {
    const next = !auto;
    setAuto(next);
    send({ type: 'control', action: 'pacing', value: next ? 'auto' : 'manual' });
  };
  const togglePause = () => {
    setPausedLocal(!paused);
    send({ type: 'control', action: 'pause', value: !paused });
  };

  return (
    <div className={`speedctl${paused ? ' paused' : ''}`}>
      <button className={`speed-pause${paused ? ' on' : ''}`} aria-pressed={paused} aria-label={paused ? 'Resume' : 'Pause'} title={paused ? 'Resume' : 'Pause'} onClick={togglePause}>
        {paused
          ? <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><path d="M1 0.5 L10.5 6 L1 11.5 Z" fill="currentColor" /></svg>
          : <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect width="3.5" height="12" fill="currentColor" /><rect x="6.5" width="3.5" height="12" fill="currentColor" /></svg>}
      </button>
      <div
        className={`speed-slider${auto ? ' auto' : ''}${drag != null ? ' dragging' : ''}`} role="slider" tabIndex={0} aria-label="Simulation speed"
        aria-valuemin={0} aria-valuemax={N} aria-valuenow={Math.round(pos * N * 100) / 100} aria-valuetext={speedText(target)}
        title="Game time per second. Drag, or use the arrow keys to step a gear."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
      >
        <div className="speed-track" ref={track}>
          <i className="speed-fill" style={{ width: `${fill * 100}%` }} />
          {GEARS.map((g, i) => (
            <i key={g.name} className={`speed-stop${i === gear ? ' on' : ''}${i / N <= fill + 0.001 ? ' lit' : ''}`} style={{ left: `${(i / N) * 100}%` }} title={g.name}>
              {g.label && <b className={i === 0 ? 'first' : i === N ? 'last' : undefined}>{g.label}</b>}
            </i>
          ))}
          <i className="speed-thumb" style={{ left: `${pos * 100}%` }} />
        </div>
      </div>
<span className={`speed-val${slowed ? ' slowed' : ''}`} aria-label={paused ? `Paused at ${readout}` : readout} title={paused ? `Paused at ${readout}` : slowed ? `The director slowed the world from ${speedText(target)}` : 'Game time per second'}>
        <b>{readout.slice(0, cut)}</b>
        <small>{paused ? 'paused' : readout.slice(cut + 1)}</small>
      </span>
      <div className="segs">
        <button className={`seg${auto ? ' on' : ''}`} aria-pressed={auto} title="Auto pacing: the director slows the world for big moments" onClick={toggleAuto}>Auto</button>
      </div>
    </div>
  );
}
