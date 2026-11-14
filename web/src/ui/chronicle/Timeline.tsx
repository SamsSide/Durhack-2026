import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AgentStatus, ChronicleEntry, World } from '@terra/shared';
import { Chevron, Diamond } from './Diamond';
import { KIND_LABEL, LEGEND_ORDER, displayKind, fallenOf, ofName } from './kinds';
import type { DisplayKind } from './kinds';

const NAME_W = 200;  // the left column of nation names
const LANE_H_FULL = 34;
const LANE_H_SHORT = 28;   // 720 px projector: see the max-height block in chronicle.css
const PAD = 14;      // room inside the track so the first and last diamonds are not clipped
const MIN_PX = 6;    // px a year; below this the track scrolls sideways
const DIA = 6.5;     // half the 13 px diamond
const TIP_W = 250;

/** A period a nation was cut (to: null means it is cut still). */
export interface CutPeriod { c: number; from: number; to: number | null }

interface Mark { entry: number; lane: number; kind: DisplayKind; year: number }
interface War { a: number; b: number; from: number; to: number | null }

interface Layout {
  marks: Mark[];
  hasWorld: boolean;
  wars: War[];
  silences: CutPeriod[];
  kinds: Set<DisplayKind>;
}

/** One pass over the chronicle, oldest first. Memoised on its length and newest line (see below). */
function buildLayout(world: World): Layout {
  const marks: Mark[] = [];
  const wars: War[] = [];
  const silences: CutPeriod[] = [];
  const kinds = new Set<DisplayKind>();
  const openWar = new Map<string, War>();
  const openSilence = new Map<number, CutPeriod>();
  let hasWorld = false;
  const chron = world.chronicle;
  for (let i = 0; i < chron.length; i++) {
    const e = chron[i]!;
    const kind = displayKind(e, world);
    kinds.add(kind);
    if (e.countries.length === 0) {
      hasWorld = true;
      marks.push({ entry: i, lane: -1, kind, year: e.year });
    } else {
      const seen = new Set<number>();
      for (const c of e.countries) {
        if (seen.has(c) || !world.countries[c]) continue;
        seen.add(c);
        marks.push({ entry: i, lane: c, kind, year: e.year });
      }
    }
    if ((e.kind === 'war' || e.kind === 'peace') && e.countries.length >= 2) {
      const a = Math.min(e.countries[0]!, e.countries[1]!);
      const b = Math.max(e.countries[0]!, e.countries[1]!);
      const key = `${a}-${b}`;
      if (e.kind === 'war' && !openWar.has(key)) {
        const w: War = { a, b, from: e.year, to: null };
        openWar.set(key, w);
        wars.push(w);
      } else if (e.kind === 'peace') {
        const w = openWar.get(key);
        if (w) { w.to = e.year; openWar.delete(key); }
      }
    }
    if (e.kind === 'fall' && e.countries.length > 0) {
      // A fallen (or deleted, which ends in a fall) nation's wars and silence end with it.
      const gone = fallenOf(e, world)!;
      for (const [key, w] of openWar) if (w.a === gone || w.b === gone) { w.to = e.year; openWar.delete(key); }
      const s = openSilence.get(gone);
      if (s) { s.to = e.year; openSilence.delete(gone); }
    }
    if (e.kind === 'silence' || e.kind === 'return') {
      for (const c of e.countries) {
        if (e.kind === 'silence' && !openSilence.has(c)) {
          const s: CutPeriod = { c, from: e.year, to: null };
          openSilence.set(c, s);
          silences.push(s);
        } else if (e.kind === 'return') {
          const s = openSilence.get(c);
          if (s) { s.to = e.year; openSilence.delete(c); }
        }
      }
    }
  }
  return { marks, hasWorld, wars, silences, kinds };
}

export function Timeline({ world, agents, observed, selectedId, onPick, onClose, leaving = false }: {
  leaving?: boolean;
  world: World;
  agents: AgentStatus[];
  observed: CutPeriod[];
  selectedId: number | null;
  onPick: (ids: number[]) => void;
  onClose: () => void;
}) {
  const chron = world.chronicle;
  const len = chron.length;
  // world is mutated in place by applyEvent. The chronicle grows, then is trimmed to a recent window
  // (shared applyEvent, CHRONICLE_KEEP), so its length alone can repeat: the newest line's id is the key too.
  const newestId = len > 0 ? chron[len - 1]!.id : '';
  const layout = useMemo(() => buildLayout(world), [world.id, len, newestId, world.countries.length]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [avail, setAvail] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [short, setShort] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-height: 800px)').matches);
  const LANE_H = short ? LANE_H_SHORT : LANE_H_FULL;

  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-height: 800px)');
    const on = () => setShort(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setAvail(Math.max(0, el.clientWidth - NAME_W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the "Now" end in view while the reader has not scrolled back into the past.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinned.current) el.scrollLeft = el.scrollWidth;
  });

  const start = len > 0 ? Math.min(chron[0]!.year, world.year) : world.year;
  const end = Math.max(world.year, len > 0 ? chron[len - 1]!.year : world.year);
  const span = Math.max(1, end - start);
  const px = Math.max(MIN_PX, (avail - 2 * PAD) / span);
  const trackW = Math.ceil(span * px + 2 * PAD);
  const x = (year: number) => PAD + (year - start) * px;

  const lanes: { id: number; name: string; color: string | null; dim: boolean }[] = [];
  if (layout.hasWorld) lanes.push({ id: -1, name: 'World', color: null, dim: false });
  const agentOf = new Map(agents.map((a) => [a.countryId, a]));
  for (const c of world.countries) {
    lanes.push({ id: c.id, name: c.name, color: c.color, dim: !c.alive || !!agentOf.get(c.id)?.deleted });
  }
  const shift = layout.hasWorld ? 1 : 0;
  const laneIndex = (lane: number) => (lane < 0 ? 0 : lane + shift);
  const lanesH = lanes.length * LANE_H;

  // The Silence: chronicle periods first; a period still open runs to now only while that link is cut.
  const silencePeriods: { c: number; from: number; to: number }[] = [];
  const fromChronicle = new Set<number>();
  for (const s of layout.silences) {
    fromChronicle.add(s.c);
    const stillCut = agentOf.get(s.c)?.link === 'cut';
    silencePeriods.push({ c: s.c, from: s.from, to: s.to ?? (stillCut ? world.year : s.from + 1) });
  }
  for (const s of observed) {
    if (fromChronicle.has(s.c)) continue;
    silencePeriods.push({ c: s.c, from: Math.max(start, s.from), to: s.to ?? world.year });
  }
  const bands = silencePeriods.filter((b) => world.countries[b.c]);

  const legend = LEGEND_ORDER.filter((k) => layout.kinds.has(k));
  const recent: ChronicleEntry[] = [];
  for (let i = len - 1; i >= 0 && recent.length < 3; i--) recent.push(chron[i]!);

  const hovered = hover != null ? layout.marks[hover] : undefined;
  const hoveredEntry = hovered ? chron[hovered.entry] : undefined;

  const pickMark = (m: Mark) => {
    if (m.lane >= 0) onPick([m.lane]);
    else onPick(chron[m.entry]?.countries ?? []);
  };
  const markFrom = (t: EventTarget): number | null => {
    const v = (t as Element).getAttribute?.('data-m');
    return v == null ? null : Number(v);
  };

  let tip: ReactNode = null;
  if (hovered && hoveredEntry) {
    const li = laneIndex(hovered.lane);
    const hx = x(hovered.year);
    const right = NAME_W + hx + 12 + TIP_W > NAME_W + trackW;
    const above = li >= 3 && li >= lanes.length - 2;
    tip = (
      <div
        className="tn-tl-tip tn-tooltip"
        style={{
          left: right ? NAME_W + hx - 12 - TIP_W : NAME_W + hx + 12,
          top: above ? li * LANE_H + LANE_H - 2 : li * LANE_H + 4,
          transform: above ? 'translateY(-100%)' : undefined,
        }}
      >
        <div className="tn-tl-tip-k">
          <Diamond kind={hovered.kind} /> Y{hoveredEntry.year} · {KIND_LABEL[hovered.kind]}
        </div>
        {hoveredEntry.text}
      </div>
    );
  }

  const ticks: number[] = [];
  for (let y = Math.ceil(start / 10) * 10; y <= end; y += 10) ticks.push(y);

  return (
    <div className={`tn-sheet tn-frame tn-frame--corners tn-tl tn-chron-timeline${leaving ? ' tn-m-out' : ''}`} role="dialog" aria-label="The Chronicle">
      <h2 className="tn-cartouche tn-tl-plate">The Chronicle</h2>
      <div className="tn-tl-head">
        <div className="tn-tl-title">
          <div className="tn-tl-sub">of {ofName(world.name)}, years {start} to {end}</div>
        </div>
        <div className="tn-legend">
          {legend.map((k) => (
            <span key={k} className="tn-lg"><Diamond kind={k} />{KIND_LABEL[k]}</span>
          ))}
        </div>
        <button type="button" className="tn-button tn-button--sm" onClick={onClose}>
          Collapse <Chevron />
        </button>
      </div>

      <div
        className="tn-tl-scroll"
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollLeft + el.clientWidth >= el.scrollWidth - 30;
        }}
      >
        {len === 0 ? (
          <p className="tn-tl-none">Nothing has been written yet.</p>
        ) : (
          <div className="tn-tl-grid" style={{ width: NAME_W + trackW }}>
            <div className="tn-tl-axisrow">
              <div className="tn-tl-corner" />
              <div className="tn-tl-axis" style={{ width: trackW }}>
                {ticks.map((y) => (
                  <div key={y} className="tn-tl-tick" style={{ left: x(y) }}>{y}</div>
                ))}
                <div className="tn-tl-now" style={{ left: x(world.year) }}>
                  <span>Now · {world.year}</span>
                </div>
              </div>
            </div>

            <div className="tn-tl-lanes" style={{ height: lanesH }}>
              {lanes.map((l) => (
                <div
                  key={l.id}
                  className={`tn-tl-lane${l.id >= 0 && l.id === selectedId ? ' tn-tl-sel' : ''}${l.dim ? ' tn-tl-dim' : ''}`}
                >
                  {l.id >= 0 ? (
                    <button type="button" className="tn-tl-name" onClick={() => onPick([l.id])} title={l.name}>
                      <span className="tn-sw" style={{ background: l.color ?? undefined }} />
                      <span className="tn-tl-nm">{l.name}</span>
                    </button>
                  ) : (
                    <div className="tn-tl-name tn-tl-world"><span className="tn-tl-nm">World</span></div>
                  )}
                </div>
              ))}

              <svg
                className="tn-tl-svg"
                width={trackW}
                height={lanesH}
                style={{ left: NAME_W }}
              >
                {bands.map((b, i) => {
                  const bx = x(b.from);
                  const bw = Math.max(4, x(b.to) - bx);
                  const by = laneIndex(b.c) * LANE_H + 3;
                  return (
                    <g key={`s${i}-${b.c}-${b.from}`}>
                      <rect className="tn-tl-silence" x={bx} y={by} width={bw} height={LANE_H - 6} rx={1} />
                      {bw > 56 && (
                        <text className="tn-tl-silence-label" x={bx + bw / 2} y={by + (LANE_H - 6) / 2 + 3.5} textAnchor="middle">Silence</text>
                      )}
                    </g>
                  );
                })}
                {layout.wars.map((w, i) => {
                  const wx = x(w.from);
                  const ww = Math.max(6, x(w.to ?? world.year) - wx);
                  return [w.a, w.b].map((c) => (
                    <rect
                      key={`w${i}-${c}`}
                      className="tn-tl-war"
                      x={wx}
                      y={laneIndex(c) * LANE_H + 6}
                      width={ww}
                      height={22}
                      rx={2}
                    />
                  ));
                })}
                <line className="tn-tl-nowline" x1={x(world.year)} y1={0} x2={x(world.year)} y2={lanesH} />
                <g
                  onMouseOver={(e) => setHover(markFrom(e.target))}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    const m = markFrom(e.target);
                    const mark = m != null ? layout.marks[m] : undefined;
                    if (mark) pickMark(mark);
                  }}
                >
                  {layout.marks.map((m, i) => {
                    const cx = x(m.year);
                    const cy = laneIndex(m.lane) * LANE_H + LANE_H / 2;
                    return (
                      <polygon
                        key={i}
                        data-m={i}
                        className={`tn-tl-ev tn-k-${m.kind}`}
                        points={`${cx},${cy - DIA} ${cx + DIA},${cy} ${cx},${cy + DIA} ${cx - DIA},${cy}`}
                      />
                    );
                  })}
                </g>
              </svg>
              {tip}
            </div>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="tn-tl-list">
          {recent.map((e) => {
            const k = displayKind(e, world);
            return (
              <button
                key={e.id}
                type="button"
                className="tn-tl-entry"
                disabled={e.countries.length === 0}
                onClick={() => onPick(e.countries)}
              >
                <Diamond kind={k} />
                <span className="tn-yr">Y{e.year}</span>
                <span className="tn-tl-k">{KIND_LABEL[k]}</span>
                <span className="tn-tl-txt">{e.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
