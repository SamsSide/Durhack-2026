// X2: live stream and controls on /ws.
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ControlMessage, LlmMode, WorldRunner } from '../runner';

const ACTIONS_WITH_COUNTRY = ['cut', 'restore', 'silence', 'wake', 'delete'];

export function attachWs(server: Server, runner: WorldRunner, mode: LlmMode): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const send = (ws: WebSocket, msg: object) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
  const broadcast = (msg: object) => { const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(s); };
  const budget = () => ({ type: 'budget', calls: 0, tokensIn: 0, tokensOut: 0, callsPerMin: 0, capped: false, mode });

  runner.subscribe({
    snapshot: (world) => { broadcast({ type: 'snapshot', world }); broadcast({ type: 'agents', agents: world.agents }); },
    events: (events) => broadcast({ type: 'events', events }),
    agents: (agents) => broadcast({ type: 'agents', agents }),
  });
  setInterval(() => broadcast(budget()), 2000).unref();

  wss.on('connection', (ws) => {
    const world = runner.getWorld();
    if (world) { send(ws, { type: 'snapshot', world }); send(ws, { type: 'agents', agents: world.agents }); }
    else send(ws, { type: 'none' });
    send(ws, budget());

    ws.on('message', (raw) => {
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
        else if ((a === 'blackout' || a === 'pause') && typeof msg.value === 'boolean') runner.control(msg as ControlMessage);
        else if (a === 'speed' && [1, 2, 4, 8].includes(msg.value)) runner.control(msg as ControlMessage);
        else if (a === 'decree' && typeof msg.text === 'string' && msg.text.trim()) runner.control({ action: 'decree', text: msg.text.trim() });
        else return send(ws, { type: 'error', message: `bad control: ${String(a)}` });
        return;
      }
      send(ws, { type: 'error', message: `unknown message type: ${String(msg.type)}` });
    });
  });
  return wss;
}
