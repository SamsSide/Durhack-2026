// X2: live stream and controls on /ws.
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getBudget } from '../llm';
import { chainHello, onChainMessage } from '../chain';
import { latestPrepare, onPrepare, prepareWorld } from '../prepare';
import type { ControlMessage, LlmMode, WorldRunner } from '../runner';

const ACTIONS_WITH_COUNTRY = ['cut', 'restore', 'silence', 'wake', 'delete'];
const COUNCIL_ACTIONS = ['kill', 'cut_member', 'restore_member'];   // row A29, with a role

export function attachWs(server: Server, runner: WorldRunner, mode: LlmMode): WebSocketServer {
  // Control messages are tiny; a huge frame is refused instead of buffered.
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 });
  // An 'error' event with no listener is thrown, and that would end the whole process.
  wss.on('error', (e) => console.warn('ws server error:', e.message));
  const send = (ws: WebSocket, msg: object) => { try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch { /* a closing socket */ } };
  const broadcast = (msg: object) => {
    const s = JSON.stringify(msg);
    for (const c of wss.clients) { try { if (c.readyState === WebSocket.OPEN) c.send(s); } catch { /* a closing socket */ } }
  };
  const budget = () => getBudget();

  runner.subscribe({
    snapshot: (world) => {
      broadcast({ type: 'snapshot', world }); broadcast({ type: 'agents', agents: world.agents });
      const c = runner.clockState?.(); if (c) broadcast({ type: 'clock', ...c });
    },
    events: (events) => broadcast({ type: 'events', events }),
    agents: (agents) => broadcast({ type: 'agents', agents }),
    clock: (state) => broadcast({ type: 'clock', ...state }),
  });
  setInterval(() => broadcast(budget()), 2000).unref();
  onChainMessage((m) => broadcast(m)); // row A27: ledger rows and the economy counters
  onPrepare((m) => broadcast(m));       // row A31: prepare progress

  wss.on('connection', (ws) => {
    // A bad frame from one client (too big, malformed) closes that socket only.
    ws.on('error', (e) => console.warn('ws client error:', e.message));
    const world = runner.getWorld();
    if (world) { send(ws, { type: 'snapshot', world }); send(ws, { type: 'agents', agents: world.agents }); }
    else send(ws, { type: 'none' });
    const clock = runner.clockState?.();
    if (world && clock) send(ws, { type: 'clock', ...clock });
    send(ws, budget());
    for (const m of chainHello()) send(ws, m);
    const prep = world ? latestPrepare(world.id) : null;
    if (prep) send(ws, prep);

    const onMessage = (raw: { toString(): string }) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'invalid JSON' }); }
      if (!msg || typeof msg !== 'object') return send(ws, { type: 'error', message: 'message must be an object' });

      if (msg.type === 'belief') {
        const owner = typeof msg.countryId === 'number' ? runner.belief(msg.countryId) : null;
        if (!owner) return send(ws, { type: 'error', message: 'no such country' });
        return send(ws, { type: 'belief', countryId: msg.countryId, owner });
      }
      if (msg.type === 'control') {
        const a = msg.action;
        if (ACTIONS_WITH_COUNTRY.includes(a) && typeof msg.countryId === 'number') runner.control(msg as ControlMessage);
        else if (COUNCIL_ACTIONS.includes(a) && typeof msg.countryId === 'number' && (msg.role === 'ruler' || msg.role === 'general')) {
          runner.control({ action: a, countryId: msg.countryId, role: msg.role });
        }
        else if ((a === 'blackout' || a === 'pause') && typeof msg.value === 'boolean') runner.control(msg as ControlMessage);
        else if (a === 'speed' && typeof msg.value === 'number' && Number.isFinite(msg.value)) runner.control({ action: 'speed', value: msg.value });
        else if (a === 'pacing' && (msg.value === 'auto' || msg.value === 'manual')) runner.control({ action: 'pacing', value: msg.value });
        else if (a === 'prepare') {
          const w = runner.getWorld();
          if (!w) return send(ws, { type: 'error', message: 'no world to prepare' });
          if (runner.playback?.()) return send(ws, { type: 'error', message: 'a replay needs no preparing' });
          void prepareWorld(runner, w);
        }
        else if (a === 'decree' && typeof msg.text === 'string' && msg.text.trim()) runner.control({ action: 'decree', text: msg.text.trim() });
        else return send(ws, { type: 'error', message: `bad control: ${String(a)}` });
        return;
      }
      send(ws, { type: 'error', message: `unknown message type: ${String(msg.type)}` });
    };
    // A control that throws answers with an error; it never takes the server down.
    ws.on('message', (raw) => {
      try { onMessage(raw); }
      catch (e) { console.error('ws message failed:', e); send(ws, { type: 'error', message: 'that control failed' }); }
    });
  });
  return wss;
}
