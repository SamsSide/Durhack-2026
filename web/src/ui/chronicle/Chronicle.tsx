import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentStatus, World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { Herald } from './Herald';
import { Ticker } from './Ticker';
import { Timeline } from './Timeline';
import type { CutPeriod } from './Timeline';
import './chronicle.css';

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Cut periods seen from this browser, for the Silence band. The server does not yet write
 * silence and return chronicle entries on cut and restore, so the timeline also draws what it saw.
 * Updated during render, once per new agents array (the Timeline reads it fresh on every render).
 */
function useObservedCuts(world: World | null, agents: AgentStatus[]): CutPeriod[] {
  const state = useRef<{ worldId: string | null; seen: AgentStatus[] | null; open: Map<number, CutPeriod>; all: CutPeriod[] }>(
    { worldId: null, seen: null, open: new Map(), all: [] },
  );
  const s = state.current;
  if (!world) return s.all;
  if (s.worldId !== world.id) {
    s.worldId = world.id;
    s.seen = null;
    s.open = new Map();
    s.all = [];
  }
  if (s.seen !== agents) {
    const first = s.seen === null;
    s.seen = agents;
    for (const a of agents) {
      const cut = a.link === 'cut' && !a.deleted;
      const p = s.open.get(a.countryId);
      if (cut && !p) {
        // On the first look, the cut began when the others last heard from it (a tick is a year).
        const from = first ? world.year - Math.max(0, world.tick - a.lastHeardTick) : world.year;
        const np: CutPeriod = { c: a.countryId, from, to: null };
        s.open.set(a.countryId, np);
        s.all.push(np);
      } else if (!cut && p) {
        p.to = world.year;
        s.open.delete(a.countryId);
      }
    }
  }
  return s.all;
}

export function Chronicle() {
  const world = useWorld((s) => s.world);
  useWorld((s) => s.version);
  const agents = useWorld((s) => s.agents);
  const selectedId = useWorld((s) => s.selectedCountryId);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);

  const [open, setOpen] = useState(false);
  const observed = useObservedCuts(world, agents);

  // h toggles the timeline (not while typing), Escape closes it.
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

  return (
    <div className="tn-chronicle">
      <Herald observed={observed} />
      {open && (
        <Timeline
          world={world}
          agents={agents}
          observed={observed}
          selectedId={selectedId}
          onPick={goTo}
          onClose={() => setOpen(false)}
        />
      )}
      <Ticker world={world} open={open} onToggle={() => setOpen((o) => !o)} onPick={goTo} />
    </div>
  );
}
