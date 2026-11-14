// Row A11: record every world event and each nation's growth in Tiger Data hypertables.
// Off unless TIGER_DATABASE_URL is set. Never blocks the tick loop, never throws.
import type { World, WorldEvent } from '@terra/shared';
import type { WorldRunner } from '../runner';
import { TigerStore, eventRow, statRows, type EventRow, type StatRow } from './store';

const FLUSH_MS = 1000;
const FLUSH_ROWS = 500;
const STATS_EVERY_TICKS = 10;
const MAX_BUFFER = 20_000; // drop the oldest beyond this while the database is down

let store: TigerStore | null = null;
export function tigerStore(): TigerStore | null { return store; }

export function bindTiger(runner: WorldRunner): void {
  const url = process.env.TIGER_DATABASE_URL?.trim();
  if (!url) { console.log('tiger: TIGER_DATABASE_URL not set, stats off'); return; }

  const db = new TigerStore(url);
  store = db;
  let ready = false;
  let evBuf: EventRow[] = [];
  let stBuf: StatRow[] = [];
  let flushing = false;
  let lastWarn = 0;
  let worldId = '';
  let year = 0;
  let lastStatsTick = -Infinity;

  const warn = (what: string, e: unknown) => {
    if (Date.now() - lastWarn < 60_000) return;
    lastWarn = Date.now();
    console.warn(`tiger: ${what}:`, (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/g, '<url>'));
  };

  const init = async () => {
    try {
      const warnings = await db.ensureSchema();
      for (const w of warnings) console.warn('tiger: optional step skipped,', w);
      ready = true;
      console.log('tiger: connected, hypertables ready');
    } catch (e) {
      warn('schema setup failed, will retry', e);
      setTimeout(() => void init(), 30_000).unref?.();
    }
  };
  void init();

  const flush = async () => {
    if (!ready || flushing || (!evBuf.length && !stBuf.length)) return;
    flushing = true;
    const ev = evBuf; const st = stBuf;
    evBuf = []; stBuf = [];
    try {
      await db.insertEvents(ev);
      await db.insertStats(st);
    } catch (e) { warn('write failed, batch dropped', e); }
    flushing = false;
  };
  setInterval(() => void flush(), FLUSH_MS).unref?.();

  const sampleStats = (w: World) => {
    if (w.tick - lastStatsTick < STATS_EVERY_TICKS) return;
    lastStatsTick = w.tick;
    stBuf.push(...statRows(w, new Date()));
  };

  runner.subscribe({
    snapshot: (w) => {
      if (runner.playback?.()) return; // a replay's events are already in the database
      worldId = w.id; year = w.year; lastStatsTick = -Infinity;
      sampleStats(w); // the starting point of every series
    },
    events: (events: WorldEvent[]) => {
      if (runner.playback?.()) return;
      try {
        const now = new Date();
        const w = runner.getWorld();
        if (w && w.id !== worldId) { worldId = w.id; lastStatsTick = -Infinity; }
        for (const ev of events) {
          if (ev.type === 'tick') year = ev.year;
          evBuf.push(eventRow(ev, worldId, year, now));
        }
        if (evBuf.length > MAX_BUFFER) evBuf = evBuf.slice(-MAX_BUFFER);
        if (w) sampleStats(w);
        if (evBuf.length >= FLUSH_ROWS) void flush();
      } catch (e) { warn('buffering failed', e); }
    },
  });
}
