import { useEffect, useRef, useState } from 'react';
import { flagSvg } from '@terra/shared';
import type { Country, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';
import type { CutPeriod } from './Timeline';
import { ofName } from './kinds';

const SHOW_MS = 6000;   // about six seconds on screen
const LEAVE_MS = 500;   // the herald-out keyframes
const WAR_WINDOW_MS = 60_000;

interface Stats { years: number; merged: number; settled: number }
type Dispatch =
  | { key: string; kind: 'war'; year: number; a: Country; b: Country; title: string; line: string; by: string }
  | { key: string; kind: 'return'; year: number; c: Country; stats: Stats | null; line: string }
  | { key: string; kind: 'fall'; year: number; c: Country; line: string };

function Flag({ c }: { c: Country }) {
  return <span className="tn-h-flag" dangerouslySetInnerHTML={{ __html: flagSvg(c.flag, 54, 36) }} />;
}

/** One dispatch: a band over a centred body (docs/design README, "Dispatches"). */
function Card({ d, leaving }: { d: Dispatch; leaving: boolean }) {
  const cls = `tn-herald tn-${d.kind}${leaving ? ' tn-leaving' : ''}`;
  const band = d.kind === 'war' ? 'War declared' : d.kind === 'return' ? 'The Silence ends' : 'A nation falls';
  return (
    <div className={cls} role="status" aria-live="polite">
      <div className="tn-h-band"><span>{band}</span><span className="tn-h-year">Y{d.year}</span></div>
      <div className="tn-h-body">
        {d.kind === 'war' && (
          <>
            <div className="tn-h-vs"><Flag c={d.a} /><span className="tn-h-x">against</span><Flag c={d.b} /></div>
            <div className="tn-h-title">{d.title}</div>
            {d.line && <div className="tn-h-quote">{d.line}{d.by && <span>{d.by}</span>}</div>}
          </>
        )}
        {d.kind === 'return' && (
          <>
            <div className="tn-h-vs"><Flag c={d.c} /></div>
            <div className="tn-h-title">{d.c.name} returns</div>
            {d.stats && (
              <div className="tn-h-stats">
                <div><b>{d.stats.years}</b><span>years silent</span></div>
                <div><b>{d.stats.merged}</b><span>events merged</span></div>
                <div><b>{d.stats.settled}</b><span>disputes settled</span></div>
              </div>
            )}
            <div className="tn-h-quote">{d.line}</div>
          </>
        )}
        {d.kind === 'fall' && (
          <>
            <div className="tn-h-vs tn-gone"><Flag c={d.c} /></div>
            <div className="tn-h-title">{d.c.name} are no more</div>
            <div className="tn-h-quote">{d.line}</div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Dispatches for the three moments the demo needs: war declared, a nation's return, a nation's fall.
 * Watches recentEvents, shows one at a time (top centre, about 6 s, queued), skips duplicates.
 */
export function Herald({ observed }: { observed: CutPeriod[] }) {
  const world = useWorld((s) => s.world);
  const events = useWorld((s) => s.recentEvents);
  const [current, setCurrent] = useState<Dispatch | null>(null);
  const [leaving, setLeaving] = useState(false);
  const queue = useRef<Dispatch[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const shown = useRef<Map<string, number>>(new Map());
  const worldId = useRef<string | null>(null);
  const primed = useRef(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const obs = useRef(observed);
  obs.current = observed;

  const pump = () => {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    setLeaving(false);
    setCurrent(next);
    timers.current.push(window.setTimeout(() => setLeaving(true), SHOW_MS - LEAVE_MS));
    timers.current.push(window.setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
      busy.current = false;
      pump();
    }, SHOW_MS));
  };

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  useEffect(() => {
    if (!world) return;
    if (worldId.current !== world.id) {
      worldId.current = world.id;
      seen.current = new Set();
      shown.current = new Map();
      queue.current = [];
      primed.current = false;
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      busy.current = false;
      setCurrent(null);
      setLeaving(false);
    }
    // The first look only learns what is already there, so a remount never replays old news.
    const fresh: WorldEvent[] = [];
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      if (primed.current) fresh.push(e);
    }
    primed.current = true;
    if (fresh.length === 0) return;

    const country = (id: number) => world.countries[id];
    const now = Date.now();
    const accept = (key: string, windowMs: number): boolean => {
      const t = shown.current.get(key);
      if (t != null && now - t < windowMs) return false;
      shown.current.set(key, now);
      return true;
    };
    const yearsSilent = (c: number, returnYear: number): number | null => {
      let from: number | null = null;
      for (let i = world.chronicle.length - 1; i >= 0; i--) {
        const e = world.chronicle[i]!;
        if (e.kind === 'silence' && e.countries.includes(c) && e.year <= returnYear) { from = e.year; break; }
      }
      if (from == null) {
        for (const p of obs.current) if (p.c === c && p.to != null && (from == null || p.from > from)) from = p.from;
      }
      return from == null ? null : Math.max(0, returnYear - from);
    };

    for (const e of fresh) {
      if (e.type === 'relation_changed' && e.stance === 'war') {
        const a = country(e.a), b = country(e.b);
        if (!a || !b) continue;
        const key = `war:${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`;
        if (!accept(key, WAR_WINDOW_MS)) continue;
        const aggr = e.actor === e.b ? b : a;
        const prey = aggr === a ? b : a;
        queue.current.push({
          key, kind: 'war', year: world.year, a: aggr, b: prey,
          title: `${aggr.name} marches on ${ofName(prey.name)}`,
          line: e.reason, by: e.reason ? aggr.leader : '',
        });
      } else if (e.type === 'country_fell' || (e.type === 'chronicle' && e.entry.kind === 'fall')) {
        const id = e.type === 'country_fell' ? e.countryId : e.entry.countries[0];
        const c = id != null ? country(id) : undefined;
        if (!c) continue;
        const key = `fall:${c.id}`;
        if (!accept(key, Infinity)) continue;
        const by = e.type === 'country_fell' && e.conqueror != null ? country(e.conqueror) : undefined;
        queue.current.push({
          key, kind: 'fall', year: world.year, c,
          line: by ? `Conquered by ${by.name}. Its lands are being divided.` : 'Deleted from the world. Its neighbours are carving up its lands.',
        });
      } else if (e.type === 'chronicle' && e.entry.kind === 'return') {
        const c = e.entry.countries[0] != null ? country(e.entry.countries[0]) : undefined;
        if (!c) continue;
        const key = `return:${c.id}`;
        if (!accept(key, WAR_WINDOW_MS)) continue;
        const years = yearsSilent(c.id, e.entry.year);
        let stats: Stats | null = null;
        if (years != null) {
          // The merged events and settled disputes come from this same stream of events.
          const lo = e.entry.tick - years;
          let merged = 0, settled = 0;
          for (const f of events) {
            if (f.tick < lo || f.tick > e.entry.tick) continue;
            if (f.actor === c.id && f.type !== 'tick' && f.type !== 'chronicle') merged++;
            if (f.type === 'tile_claimed' && f.cause === 'dispute' && (f.owner === c.id || f.from === c.id)) settled++;
          }
          stats = { years, merged, settled };
        }
        queue.current.push({
          key, kind: 'return', year: e.entry.year, c, stats,
          line: 'Where both claimed the same land, whoever holds it on the ground keeps it.',
        });
      }
    }
    pump();
  }, [events, world]);

  if (!current) return null;
  return (
    <div className="tn-herald-slot">
      <Card d={current} leaving={leaving} />
    </div>
  );
}
