import { useEffect, useSyncExternalStore } from 'react';
import { useWorld } from '../../state/world';

// Shapes of X2 `ledger` rows and X3 `GET /api/economy`.
export type PaymentStatus = 'queued' | 'sent' | 'confirmed' | 'failed' | 'simulated';
export interface LedgerRow {
  id: string; tick: number; year: number; from: number; to: number; amount: number;
  reason: string; note?: string; status: PaymentStatus; signature?: string | null; url?: string | null;
}
export interface EconomyData {
  mode: string;
  currency: { name: string; symbol: string; url?: string | null };
  online: boolean;
  pending: number;
  totals: { payments: number; volume: number; transactions?: number; feesSol?: number };
  nations: { countryId: number; address?: string; url?: string | null; onChain: number; sim?: number; inSync: boolean }[];
  rows: LedgerRow[];
}
export interface EconomyState { status: 'loading' | 'ok' | 'off'; data: EconomyData | null }

const POLL_MS = 2000;
const RETRY_MS = 10000;
const MAX_ROWS = 100;

let state: EconomyState = { status: 'loading', data: null };
let rowMap = new Map<string, LedgerRow>();
let worldId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function set(next: EconomyState) { state = next; listeners.forEach((l) => l()); }

function reset() {
  if (timer) clearTimeout(timer);
  rowMap = new Map();
  generation++;
  controller?.abort();
  state = { status: 'loading', data: null };
  listeners.forEach((l) => l());
}

function sortedRows(): LedgerRow[] {
  return [...rowMap.values()].sort((a, b) => b.tick - a.tick || (a.id < b.id ? 1 : -1)).slice(0, MAX_ROWS);
}

async function poll(gen: number) {
  let delay = POLL_MS;
  controller = new AbortController();
  try {
    const r = await fetch('/api/economy', { signal: controller.signal });
    if (gen !== generation) return;
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    if (gen !== generation) return;
    const recent: LedgerRow[] = Array.isArray(j.recent) ? j.recent : [];
    for (const row of recent) rowMap.set(row.id, row);
    if (rowMap.size > MAX_ROWS * 2) {
      const keep = sortedRows();
      rowMap = new Map(keep.map((x) => [x.id, x]));
    }
    set({
      status: 'ok',
      data: {
        mode: String(j.mode ?? 'mock'),
        currency: j.currency ?? { name: 'Coin', symbol: '' },
        online: j.online !== false,
        pending: Number(j.pending ?? 0) || recent.filter((x) => x.status === 'queued' || x.status === 'sent').length,
        totals: j.totals ?? { payments: 0, volume: 0 },
        nations: Array.isArray(j.nations) ? j.nations : [],
        rows: sortedRows(),
      },
    });
  } catch {
    if (gen !== generation) return;
    delay = RETRY_MS;
    if (state.status !== 'off') set({ status: 'off', data: null });
  }
  if (gen === generation && listeners.size > 0) timer = setTimeout(() => poll(gen), delay);
}

function start() {
  if (timer || listeners.size === 0) return;
  poll(generation);
  timer = setTimeout(() => {}, 0);   // placeholder, replaced by the poll loop
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  generation++;
  controller?.abort();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) { generation++; timer = null; start(); }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) stop();
  };
}

export function useEconomy(): EconomyState {
  const id = useWorld((s) => s.world?.id ?? null);
  useEffect(() => {
    if (worldId !== id) {
      const first = worldId === null;
      worldId = id;
      if (!first) { reset(); if (listeners.size > 0) { timer = null; start(); } }
    }
  }, [id]);
  return useSyncExternalStore(subscribe, () => state);
}
