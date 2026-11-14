// X5: the browser replica of the world. Lane b owns this file after the seed.
import { create } from 'zustand';
import { applyEvent } from '@terra/shared';
import type { AgentStatus, World, WorldEvent } from '@terra/shared';
import { useBelief } from './belief';
import { useCamera } from './camera';

/** X2 `ledger` row (A27). Re-sent on each status change; the store keeps the latest per id. */
export interface LedgerRow {
  id: string; eventIds?: string[]; tick: number; year: number; from: number; to: number; amount: number;
  reason: string; note?: string; status: 'queued' | 'sent' | 'confirmed' | 'failed' | 'simulated';
  signature?: string | null; url?: string | null;
}
/** X2 `economy` message (A27). */
export interface EconomyStatus { mode: string; online: boolean; pending: number; payments: number; volume: number; feesSol: number }

export interface WorldStore {
  ledger: LedgerRow[];            // newest last, at most 50
  economy: EconomyStatus | null;
  world: World | null;
  version: number;
  agents: AgentStatus[];
  budget: { calls: number; tokensIn: number; tokensOut: number; callsPerMin: number; capped: boolean; mode: 'mock' | 'live' } | null;
  connected: boolean;
  selectedCountryId: number | null;
  selectedTileId: number | null;
  selectedRegionId: number | null;
  beliefOf: number | null;
  mapMode: 'political' | 'terrain' | 'diplomacy' | 'strength';
  setMapMode(mode: WorldStore['mapMode']): void;
  select(countryId: number | null, tileId?: number | null): void;
  showBelief(countryId: number | null): void;
  flyTo(countryId: number): void;
  send(message: object): void;
  recentEvents: WorldEvent[];
  clock: { speed: number; target: number; pacing: 'auto' | 'manual'; paused: boolean } | null;   // X2 `clock` (#124); null until the server sends one
}

let socket: WebSocket | null = null;

export const useWorld = create<WorldStore>((set, get) => ({
  world: null,
  version: 0,
  agents: [],
  budget: null,
  connected: false,
  selectedCountryId: null,
  selectedTileId: null,
  selectedRegionId: null,
  beliefOf: null,
  mapMode: 'political',
  recentEvents: [],
  clock: null,
  ledger: [],
  economy: null,
  setMapMode: (mapMode) => set({ mapMode }),
  select: (countryId, tileId = null) => {
    const region = tileId != null ? get().world?.tiles[tileId]?.region ?? -1 : -1;
    set({ selectedCountryId: countryId, selectedTileId: tileId, selectedRegionId: region >= 0 ? region : null });
  },
  showBelief: (countryId) => {
    set({ beliefOf: countryId });
    if (countryId == null) useBelief.getState().set(null, null);
    else get().send({ type: 'belief', countryId });
  },
  flyTo: (countryId) => useCamera.getState().request(countryId),
  send: (message) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  },
}));

function handle(msg: { type: string; [k: string]: unknown }): void {
  const s = useWorld.getState();
  switch (msg.type) {
    case 'snapshot': {
      const world = msg.world as World;
      useWorld.setState({ world, version: s.version + 1, agents: world.agents ?? [], recentEvents: [], ledger: [] });
      break;
    }
    case 'events': {
      if (!s.world) break;
      const events = msg.events as WorldEvent[];
      for (const e of events) applyEvent(s.world, e);
      useWorld.setState({ version: s.version + 1, recentEvents: [...s.recentEvents, ...events].slice(-200) });
      break;
    }
    case 'agents': {
      const agents = msg.agents as AgentStatus[];
      if (s.world) s.world.agents = agents;
      useWorld.setState({ agents });
      break;
    }
    case 'budget':
      useWorld.setState({ budget: msg as unknown as WorldStore['budget'] });
      break;
    case 'clock':
      useWorld.setState({ clock: { speed: msg.speed as number, target: msg.target as number, pacing: msg.pacing as 'auto' | 'manual', paused: !!msg.paused } });
      break;
    case 'ledger': {
      const rows = (msg.entries as LedgerRow[]) ?? [];
      const next = [...s.ledger];
      for (const r of rows) {
        const i = next.findIndex((x) => x.id === r.id);
        if (i >= 0) next[i] = r; else next.push(r);
      }
      useWorld.setState({ ledger: next.slice(-50) });
      break;
    }
    case 'economy': {
      const { type: _t, ...rest } = msg;
      useWorld.setState({ economy: rest as unknown as EconomyStatus });
      break;
    }
    case 'belief':
      useBelief.getState().set(msg.countryId as number, msg.owner as number[]);
      break;
    case 'none':
      useWorld.setState({ world: null, agents: [], recentEvents: [], ledger: [], economy: null, selectedCountryId: null, selectedTileId: null, selectedRegionId: null });
      break;
    case 'error':
      console.warn('server error:', msg.message);
      break;
  }
}

/** Open the socket to /ws and keep it open, reconnecting with backoff. Call once. */
export function connect(): void {
  if (socket) return;
  let delay = 500;
  const open = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    socket = ws;
    ws.onopen = () => { delay = 500; useWorld.setState({ connected: true }); };
    ws.onmessage = (ev) => {
      try { handle(JSON.parse(String(ev.data))); } catch (err) { console.warn('bad message', err); }
    };
    ws.onclose = () => {
      useWorld.setState({ connected: false });
      setTimeout(open, delay);
      delay = Math.min(delay * 2, 8000);
    };
    ws.onerror = () => ws.close();
  };
  open();
}
