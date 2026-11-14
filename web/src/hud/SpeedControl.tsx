import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../state/world';

const MIN = 0.1;
const MAX = 64;
const SNAPS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];
const MARKS = [0.25, 1, 4, 16, 64];
const SNAP_PULL = 0.02; // fraction of the track within which a drag sticks to a snap point
const SEND_GAP = 200; // ms: at most 5 sends a second while dragging

const toPos = (v: number) => Math.log(v / MIN) / Math.log(MAX / MIN);
const fromPos = (p: number) => MIN * Math.pow(MAX / MIN, Math.min(1, Math.max(0, p)));
const fmt = (v: number) => (v < 10 ? v.toFixed(1) : String(Math.round(v))) + 'x';

function snap(p: number): number {
  let v = fromPos(p);
  for (const s of SNAPS) if (Math.abs(toPos(s) - p) < SNAP_PULL) { v = s; break; }
  return Math.round(v * 100) / 100;
}

/** Continuous log-scale speed slider (0.1x to 64x) with an Auto pacing toggle. */
export function SpeedControl() {
  const send = useWorld((s) => s.send);
  const clock = useWorld((s) => s.clock);
  const serverSpeed = useWorld((s) => s.clock?.speed ?? s.world?.speed ?? 1);
  const [autoLocal, setAuto] = useState(false);
  const auto = clock ? clock.pacing === 'auto' : autoLocal;
  const [drag, setDrag] = useState<number | null>(null); // local value while dragging
  const track = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<number | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flush = () => {
    window.clearTimeout(timer.current);
    if (pending.current != null) { send({ type: 'control', action: 'speed', value: pending.current }); pending.current = null; last.current = Date.now(); }
  };
  const push = (v: number) => {
    if (auto) { setAuto(false); send({ type: 'control', action: 'pacing', value: 'manual' }); }
    pending.current = v;
    const wait = SEND_GAP - (Date.now() - last.current);
    if (wait <= 0) flush();
    else if (timer.current === undefined || pending.current === v) { window.clearTimeout(timer.current); timer.current = window.setTimeout(flush, wait); }
  };
  const posFromEvent = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  const shown = auto ? serverSpeed : drag ?? serverSpeed;
  const pos = Math.min(1, Math.max(0, toPos(Math.max(MIN, Math.min(MAX, shown)))));

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const v = snap(posFromEvent(e));
    setDrag(v); push(v);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag == null) return;
    const v = snap(posFromEvent(e));
    setDrag(v); push(v);
  };
  const onUp = () => { if (drag != null) { flush(); setDrag(null); } };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const up = e.key === 'ArrowRight' || e.key === 'ArrowUp';
    const cur = shown;
    const next = up ? SNAPS.find((s) => s > cur * 1.001) : [...SNAPS].reverse().find((s) => s < cur * 0.999);
    const v = next ?? (up ? MAX : MIN);
    push(v); flush();
  };
  const toggleAuto = () => {
    const next = !auto;
    setAuto(next);
    send({ type: 'control', action: 'pacing', value: next ? 'auto' : 'manual' });
  };

  return (
    <div className="speedctl">
      <div
        className={`speed-slider${auto ? ' auto' : ''}`} role="slider" tabIndex={0} aria-label="Simulation speed"
        aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={shown} aria-valuetext={fmt(shown)}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
      >
        <div className="speed-track" ref={track}>
          <i className="speed-fill" style={{ width: `${pos * 100}%` }} />
          {MARKS.map((m) => <i key={m} className="speed-mark" style={{ left: `${toPos(m) * 100}%` }} />)}
          <i className="speed-thumb" style={{ left: `${pos * 100}%` }} />
        </div>
      </div>
      <span className="speed-val" title={auto ? 'Speed set by the director' : 'Speed'}>{fmt(shown)}{clock && clock.target > clock.speed * 1.05 ? ` (director slowed from ${fmt(clock.target)})` : ''}</span>
      <div className="segs">
        <button className={`seg${auto ? ' on' : ''}`} aria-pressed={auto} title="Auto pacing: the director sets the speed" onClick={toggleAuto}>Auto</button>
      </div>
    </div>
  );
}
