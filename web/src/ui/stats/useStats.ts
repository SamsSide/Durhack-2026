import { useEffect, useSyncExternalStore } from 'react';
import { useWorld } from '../../state/world';
import { mockStats } from './mockStats';

// Shapes of X3 `GET /api/stats/territory` and `GET /api/stats/summary` (row A11, Tiger Data).
export interface TerritoryPoint { tick: number; year: number; tiles: number }
export interface TerritorySeries { countryId: number; name: string; color: string; points: TerritoryPoint[] }
export interface StatsData { worldId: string | null; series: TerritorySeries[]; events: number; worlds: number; sample: boolean }
export interface StatsState { status: 'loading' | 'ok' | 'off'; data: StatsData | null }

const POLL_MS = 5000;
const RETRY_MS = 15000;

let state: StatsState = { status: 'loading', data: null };
let worldId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let generation = 0;
let failures = 0;
const listeners = new Set<() => void>();

function set(next: StatsState) { state = next; listeners.forEach((l) => l()); }

/** Dev only: `?mockStats=1` swaps the two routes for a local fake (see mockStats.ts). */
function mockOn(): boolean {
  if (!import.meta.env.DEV) return false;
  try { return new URLSearchParams(window.location.search).get('mockStats') === '1'; } catch { return false; }
}

async function getJson(path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const r = await fetch(path, { signal });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function load(signal: AbortSignal): Promise<StatsData> {
  if (import.meta.env.DEV && mockOn()) {
    const world = useWorld.getState().world;
    if (!world) throw new Error('503');
    return mockStats(world);
  }
  const [t, s] = await Promise.all([getJson('/api/stats/territory', signal), getJson('/api/stats/summary', signal)]);
  const series = (Array.isArray(t.series) ? t.series : []) as TerritorySeries[];
  return {
    worldId: typeof t.worldId === 'string' ? t.worldId : null,
    series: series
      .filter((x) => x && Array.isArray(x.points))
      .map((x) => ({
        countryId: Number(x.countryId), name: String(x.name ?? ''), color: String(x.color ?? '#888888'),
        points: x.points
          .map((p) => ({ tick: Number(p.tick), year: Number(p.year), tiles: Number(p.tiles) }))
          .filter((p) => Number.isFinite(p.tick) && Number.isFinite(p.tiles))
          .sort((a, b) => a.tick - b.tick),
      })),
    events: Number(s.events ?? 0) || 0,
    worlds: Number(s.worlds ?? 0) || 0,
    sample: false,
  };
}

async function poll(gen: number) {
  let delay = POLL_MS;
  controller = new AbortController();
  try {
    const data = await load(controller.signal);
    if (gen !== generation) return;
    failures = 0;
    set({ status: 'ok', data });
  } catch (err) {
    if (gen !== generation) return;
    // Either route failing hides the chart. A 503 (no database) is final until the retry; a network
    // blip while the chart was up keeps the last picture for two more polls so it does not flicker.
    const definite = err instanceof Error && /^(404|503)$/.test(err.message);
    failures++;
    if (definite || state.status !== 'ok' || failures > 2) {
      delay = RETRY_MS;
      if (state.status !== 'off') set({ status: 'off', data: null });
    }
  }
  if (gen === generation && listeners.size > 0) timer = setTimeout(() => poll(gen), delay);
}

function restart() {
  if (timer) clearTimeout(timer);
  timer = null;
  controller?.abort();
  generation++;
  failures = 0;
  if (listeners.size > 0) void poll(generation);
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) restart();
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) { if (timer) clearTimeout(timer); timer = null; controller?.abort(); generation++; }
  };
}

/** Territory over time and the event count, refreshed every 5 s. `off` means "show nothing". */
export function useStats(): StatsState {
  const id = useWorld((s) => s.world?.id ?? null);
  useEffect(() => {
    if (id === worldId) return;
    worldId = id;
    state = { status: 'loading', data: null };
    listeners.forEach((l) => l());
    restart();
  }, [id]);
  return useSyncExternalStore(subscribe, () => state);
}
