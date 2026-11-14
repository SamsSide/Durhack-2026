import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flagSvg } from '@terra/shared';
import type { ChronicleEntry, Country, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';
import type { CutPeriod } from './Timeline';
import { fallenOf, ofName } from './kinds';

const SHOW_MS = 8000;   // each tab fades out about 8 s after it appears
const LEAVE_MS = 400;   // the tab-out fade
const WAR_WINDOW_MS = 60_000;
const MAX_TABS = 3;     // a busy world must not bury the globe

interface Stats { years: number; merged: number; settled: number }
type Dispatch =
  | { key: string; kind: 'war'; year: number; a: Country; b: Country; title: string; line: string; by: string }
  | { key: string; kind: 'return'; year: number; c: Country; stats: Stats | null; line: string }
  | { key: string; kind: 'fall'; year: number; c: Country; line: string }
  | { key: string; kind: 'decree'; year: number; c: Country | null; countryId: number | null; tileId: number | null; line: string };

/** Lane a adds `decree` to the decree chronicle entries; until it lands the `-b` consequence line stands in. */
type DecreeInfo = { effect?: string; severity?: number; target?: { countryId: number | null; tiles: number[] }; result?: string };
const decreeOf = (e: ChronicleEntry): DecreeInfo | undefined => (e as ChronicleEntry & { decree?: DecreeInfo }).decree;

/** A small seal, for a decree with no nation to show. */
function Seal() {
  return (
    <svg className="tn-h-seal" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="10" r="6" />
      <path d="M9.5 10l1.7 1.7L14.8 8" />
      <path d="M8.5 15.2L7 21l5-2.6 5 2.6-1.5-5.8" />
    </svg>
  );
}

function Flag({ c }: { c: Country }) {
  return <span className="tn-h-flag tn-flag-plate" dangerouslySetInnerHTML={{ __html: flagSvg(c.flag, 24, 16) }} />;
}

function mainOf(d: Dispatch): Country | null { return d.kind === 'war' ? d.a : d.c; }

/** One dispatch as a small tab; hover or focus opens the detail. */
function Tab({ d, leaving }: { d: Dispatch; leaving: boolean }) {
  const cls = `tn-herald tn-lacquer tn-frame tn-frame--slim tn-${d.kind}${leaving ? ' tn-leaving' : ''}`;
  const brief = (n: string) => n.replace(/^The /, '');
  // A war is two flags and "A vs B" (calm UI, #245); the full line is in the hover detail.
  const text = d.kind === 'war' ? `${brief(d.a.name)} vs ${brief(d.b.name)}`
    : d.kind === 'return' ? `${d.c.name} returns from the Silence`
    : d.kind === 'decree' ? d.line
    : `${d.c.name} falls`;
  const go = () => {
    const w = useWorld.getState();
    const id = d.kind === 'decree' ? d.countryId : mainOf(d)?.id ?? null;
    if (id != null) { w.select(id); w.flyTo(id); }
    if (d.kind === 'decree' && d.tileId != null) {
      window.dispatchEvent(new CustomEvent('terra:focus-tile', { detail: { tileId: d.tileId } }));
    }
  };
  const main = mainOf(d);
  return (
    <button type="button" className={cls} role="status" aria-live="polite" title={d.kind === 'war' ? d.title : text} onClick={go}>
      <span className="tn-h-row">
        <span className="tn-h-flags">
          {main ? <Flag c={main} /> : <Seal />}
          {d.kind === 'war' && <Flag c={d.b} />}
        </span>
        <span className="tn-h-text">{text}</span>
        <span className="tn-h-year">Y{d.year}</span>
      </span>
      <span className="tn-h-more">
        {d.kind === 'war' && <span className="tn-h-quote">{d.title}{d.line ? `: ${d.line}` : ''}{d.by && <span>{d.by}</span>}</span>}
        {d.kind === 'return' && (
          <>
            {d.stats && (
              <span className="tn-h-stats">
                <span><b>{d.stats.years}</b> years silent</span>
                <span><b>{d.stats.merged}</b> events merged</span>
                <span><b>{d.stats.settled}</b> disputes settled</span>
              </span>
            )}
            <span className="tn-h-quote">{d.line}</span>
          </>
        )}
        {d.kind === 'fall' && <span className="tn-h-quote">{d.line}</span>}
        {d.kind === 'decree' && <span className="tn-h-quote">{d.line}</span>}
      </span>
    </button>
  );
}

/**
 * Dispatches for the three moments the demo needs: war declared, a nation's return, a nation's fall.
 * Watches recentEvents, shows a stack of small tabs (top right, about 8 s each, newest on top), skips duplicates.
 */
export function Herald({ observed }: { observed: CutPeriod[] }) {
  const world = useWorld((s) => s.world);
  const [tabs, setTabs] = useState<{ d: Dispatch; id: number; leaving: boolean }[]>([]);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const shown = useRef<Map<string, number>>(new Map());
  const worldId = useRef<string | null>(null);
  const primed = useRef(false);
  const timers = useRef<number[]>([]);
  const nextId = useRef(1);
  const obs = useRef(observed);
  obs.current = observed;

  // Newest on top, at most MAX_TABS; each one fades out on its own clock.
  const enqueue = (d: Dispatch) => {
    const id = nextId.current++;
    setTabs((prev) => [{ d, id, leaving: false }, ...prev].slice(0, MAX_TABS));
    timers.current.push(window.setTimeout(() => {
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    }, SHOW_MS - LEAVE_MS));
    timers.current.push(window.setTimeout(() => {
      setTabs((prev) => prev.filter((t) => t.id !== id));
    }, SHOW_MS));
  };

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  // B8: the events are read from a store subscription, not a selector, so the stack does not re-render on
  // every batch of events (about 13 a second at the top gear), only when a dispatch is added or leaves.
  useEffect(() => {
    if (!world) return;
    const take = (events: WorldEvent[]) => {
    if (worldId.current !== world.id) {
      worldId.current = world.id;
      seen.current = new Set();
      shown.current = new Map();
      primed.current = false;
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      setTabs([]);
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
        enqueue({
          key, kind: 'war', year: world.year, a: aggr, b: prey,
          title: `${aggr.name} marches on ${ofName(prey.name)}`,
          line: e.reason, by: e.reason ? aggr.leader : '',
        });
      } else if (e.type === 'country_fell' || (e.type === 'chronicle' && e.entry.kind === 'fall')) {
        const id = e.type === 'country_fell' ? e.countryId : fallenOf(e.entry, world);
        const c = id != null ? country(id) : undefined;
        if (!c) continue;
        const key = `fall:${c.id}`;
        if (!accept(key, Infinity)) continue;
        const by = e.type === 'country_fell' && e.conqueror != null ? country(e.conqueror) : undefined;
        enqueue({
          key, kind: 'fall', year: world.year, c,
          line: by ? `Conquered by ${by.name}. Its lands are being divided.` : 'Deleted from the world. Its neighbours are carving up its lands.',
        });
      } else if (e.type === 'chronicle' && e.entry.kind === 'decree') {
        // One tab per decree: the entry that carries a result, or the "-b" consequence entry; never the bare decree text.
        const info = decreeOf(e.entry);
        const line = info?.result || (/-b$/.test(e.entry.id) ? e.entry.text : '');
        if (!line) continue;
        const key = `decree:${e.entry.id.replace(/-b$/, '')}`;
        if (!accept(key, Infinity)) continue;
        const cid = info?.target?.countryId ?? e.entry.countries[0] ?? null;
        const tileId = info?.target?.tiles?.[0] ?? null;
        enqueue({ key, kind: 'decree', year: e.entry.year, c: cid != null ? country(cid) ?? null : null, countryId: cid, tileId, line });
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
        enqueue({
          key, kind: 'return', year: e.entry.year, c, stats,
          line: 'Where both claimed the same land, whoever holds it on the ground keeps it.',
        });
      }
    }
    };
    take(useWorld.getState().recentEvents);
    return useWorld.subscribe((st, prev) => { if (st.recentEvents !== prev.recentEvents) take(st.recentEvents); });
  }, [world]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish the stack's bottom edge so other overlays (the belief banner) can sit below it.
  const any = tabs.length > 0;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = slotRef.current;
    if (!any || !el) {
      root.style.removeProperty('--tn-herald-bottom');
      return;
    }
    const publish = () => root.style.setProperty('--tn-herald-bottom', `${Math.round(el.getBoundingClientRect().bottom) + 8}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--tn-herald-bottom'); };
  }, [any]);

  if (!any) return null;
  return (
    <div className="tn-herald-slot" ref={slotRef}>
      {tabs.map((t) => <Tab key={t.id} d={t.d} leaving={t.leaving} />)}
    </div>
  );
}
