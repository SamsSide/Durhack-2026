// Calls back with each batch of new world events, once. Lane b (B7).
import { useEffect, useRef } from 'react';
import type { WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';

export function useEventStream(onEvents: (events: WorldEvent[]) => void): void {
  const cb = useRef(onEvents);
  cb.current = onEvents;
  useEffect(() => {
    const first = useWorld.getState().recentEvents;
    let last: string | null = first.length ? first[first.length - 1]!.id : null;
    return useWorld.subscribe((s) => {
      const ev = s.recentEvents;
      if (ev.length === 0) return;
      const tail = ev[ev.length - 1]!.id;
      if (tail === last) return;
      let fresh: WorldEvent[];
      if (last == null) fresh = ev;
      else {
        const idx = ev.findIndex((e) => e.id === last);
        fresh = idx >= 0 ? ev.slice(idx + 1) : ev.slice(-10); // the window rolled past us: take only the newest
      }
      last = tail;
      if (fresh.length) cb.current(fresh);
    });
  }, []);
}
