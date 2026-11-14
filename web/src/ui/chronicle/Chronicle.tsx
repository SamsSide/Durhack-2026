import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChronicleEntry, ChronicleKind, World } from '@terra/shared';
import { useWorld } from '../../state/world';
import './chronicle.css';

const HOLD_MS = 2500;
const MAX_SHOWN = 400;

type FilterId = 'all' | 'war' | 'diplomacy' | 'network' | 'deeds';
const FILTERS: { id: FilterId; label: string; kinds: ChronicleKind[] | null }[] = [
  { id: 'all', label: 'All', kinds: null },
  { id: 'war', label: 'War', kinds: ['war', 'battle', 'betrayal', 'fall'] },
  { id: 'diplomacy', label: 'Diplomacy', kinds: ['peace', 'alliance'] },
  { id: 'network', label: 'Network', kinds: ['silence', 'return', 'dispute'] },
  { id: 'deeds', label: 'Deeds', kinds: ['founding', 'proclamation', 'growth', 'decree'] },
];

function tagClass(kind: ChronicleKind): string {
  if (kind === 'war' || kind === 'fall') return 'tn-ch-tag tn-ch-danger';
  if (kind === 'silence' || kind === 'return' || kind === 'dispute') return 'tn-ch-tag tn-ch-accent';
  return 'tn-ch-tag';
}

function Dots({ world, ids }: { world: World; ids: number[] }) {
  return (
    <>
      {ids.map((id) => {
        const c = world.countries[id];
        return c ? <span key={id} className="tn-ch-dot" style={{ background: c.color }} title={c.name} /> : null;
      })}
    </>
  );
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

export function Chronicle() {
  const world = useWorld((s) => s.world);
  useWorld((s) => s.version);
  const selectedId = useWorld((s) => s.selectedCountryId);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterId>('all');

  // Ticker pacing: the entry on show, when it appeared, and how many were skipped to reach it.
  const [shown, setShown] = useState<{ entry: ChronicleEntry; skipped: number } | null>(null);
  const shownAt = useRef(0);
  const shownLen = useRef(0);
  const worldId = useRef<string | null>(null);
  const timer = useRef<number | null>(null);

  const chron = world?.chronicle;
  const len = chron?.length ?? 0;
  const newest = len > 0 ? chron![len - 1]! : null;

  useEffect(() => {
    if (!world) { setShown(null); worldId.current = null; shownLen.current = 0; return; }
    if (worldId.current !== world.id) {
      worldId.current = world.id;
      shownLen.current = 0;
      setShown(null);
    }
    const c = world.chronicle;
    if (c.length === 0) { setShown(null); shownLen.current = 0; return; }
    if (c.length < shownLen.current) shownLen.current = 0;
    const latest = c[c.length - 1]!;
    if (shownLen.current === c.length) return;
    const show = () => {
      const cur = useWorld.getState().world;
      if (!cur || cur.chronicle.length === 0) return;
      const list = cur.chronicle;
      const e = list[list.length - 1]!;
      const skipped = shownLen.current > 0 ? Math.max(0, list.length - shownLen.current - 1) : 0;
      shownLen.current = list.length;
      shownAt.current = Date.now();
      timer.current = null;
      setShown({ entry: e, skipped });
    };
    const wait = shownLen.current === 0 ? 0 : HOLD_MS - (Date.now() - shownAt.current);
    if (wait <= 0) {
      if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; }
      show();
    } else if (timer.current == null) {
      timer.current = window.setTimeout(show, wait);
    }
    void latest;
  }, [world, len, newest?.id]);

  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);

  // h toggles the drawer, Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTo = useCallback((ids: number[]) => {
    const id = ids[0];
    if (id == null) return;
    select(id);
    flyTo(id);
  }, [select, flyTo]);

  if (!world) return null;

  const entry = shown?.entry ?? null;

  return (
    <div className="tn-chronicle">
      {open && (
        <Drawer
          world={world}
          filter={filter}
          setFilter={setFilter}
          selectedId={selectedId}
          onPick={goTo}
          onClose={() => setOpen(false)}
        />
      )}
      <div className="tn-ch-strip">
        <span className="tn-ch-label">Chronicle</span>
        <div className="tn-ch-now">
          {entry ? (
            <div key={entry.id} className={`tn-ch-entry tn-ch-in ${tagClass(entry.kind).includes('danger') ? 'tn-ch-glow-danger' : tagClass(entry.kind).includes('accent') ? 'tn-ch-glow-accent' : ''}`}>
              <button
                type="button"
                className="tn-ch-text"
                disabled={entry.countries.length === 0}
                onClick={() => goTo(entry.countries)}
                title={entry.text}
              >
                <span className="tn-ch-year">Y{entry.year}</span>
                <span className={tagClass(entry.kind)}>{entry.kind}</span>
                <Dots world={world} ids={entry.countries} />
                <span className="tn-ch-line">{entry.text}</span>
              </button>
              {shown && shown.skipped > 0 && <span className="tn-ch-skipped" title="Entries skipped">+{shown.skipped}</span>}
            </div>
          ) : (
            <span className="tn-ch-empty">Nothing has been written yet.</span>
          )}
        </div>
        <button type="button" className="tn-ch-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          History
        </button>
      </div>
    </div>
  );
}

function Drawer({ world, filter, setFilter, selectedId, onPick, onClose }: {
  world: World;
  filter: FilterId;
  setFilter: (f: FilterId) => void;
  selectedId: number | null;
  onPick: (ids: number[]) => void;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [frozen, setFrozen] = useState<number | null>(null);
  const len = world.chronicle.length;

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const isAway = el.scrollTop > 40;
    setAway(isAway);
    setFrozen((f) => (isAway ? (f ?? len) : null));
  };

  const limit = away && frozen != null ? Math.min(frozen, len) : len;
  const pending = away && frozen != null ? len - frozen : 0;

  const kinds = FILTERS.find((f) => f.id === filter)?.kinds ?? null;
  const matching: ChronicleEntry[] = [];
  for (let i = limit - 1; i >= 0 && matching.length < MAX_SHOWN; i--) {
    const e = world.chronicle[i]!;
    if (!kinds || kinds.includes(e.kind)) matching.push(e);
  }

  const groups: { year: number; entries: ChronicleEntry[] }[] = [];
  for (const e of matching) {
    const g = groups[groups.length - 1];
    if (g && g.year === e.year) g.entries.push(e);
    else groups.push({ year: e.year, entries: [e] });
  }

  const toTop = () => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    setFrozen(null);
    setAway(false);
  };

  return (
    <div className="tn-ch-drawer" role="dialog" aria-label="Chronicle history">
      <div className="tn-ch-head">
        <div className="tn-ch-chips" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`tn-ch-chip ${filter === f.id ? 'tn-ch-on' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="tn-ch-btn" onClick={onClose}>Close</button>
      </div>
      <div className="tn-ch-bodywrap">
        {pending > 0 && (
          <button type="button" className="tn-ch-pill" onClick={toTop}>{pending} new</button>
        )}
        <div className="tn-ch-body" ref={bodyRef} onScroll={onScroll}>
          {groups.length === 0 && <p className="tn-ch-none">Nothing has been written yet.</p>}
          {groups.map((g) => (
            <section key={g.year} className="tn-ch-group">
              <h3 className="tn-ch-year-h">Year {g.year}</h3>
              {g.entries.map((e) => {
                const mine = selectedId != null && e.countries.includes(selectedId);
                const clickable = e.countries.length > 0;
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`tn-ch-row ${mine ? 'tn-ch-mine' : ''}`}
                    disabled={!clickable}
                    onClick={() => onPick(e.countries)}
                  >
                    <span className="tn-ch-row-top">
                      <span className={tagClass(e.kind)}>{e.kind}</span>
                      <Dots world={world} ids={e.countries} />
                      <span className="tn-ch-row-text">{e.text}</span>
                    </span>
                    {clickable && (
                      <span className="tn-ch-names">
                        {e.countries.map((id) => {
                          const c = world.countries[id];
                          return c ? <span key={id} style={{ color: c.color }}>{c.name}</span> : null;
                        })}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
