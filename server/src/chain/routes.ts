// Row A27 (X3): GET /api/economy. The `ledger` and `economy` WebSocket messages go out through
// the existing broadcaster in net/ws.ts (it subscribes with onChainMessage).
import { Router } from 'express';
import type { WorldRunner } from '../runner';
import { chainActive, chainModeNow } from './index';

export function chainRoutes(_runner: WorldRunner): Router {
  const r = Router();
  r.get('/economy', (_req, res) => {
    const chain = chainActive();
    if (chainModeNow() === 'off') return void res.status(503).json({ error: 'economy off' });
    if (!chain) return void res.status(503).json({ error: 'economy starting' });
    try {
      const state = chain.state();
      if (!state) return void res.status(503).json({ error: 'genesis pending' });
      res.json(state);
    } catch { res.status(503).json({ error: 'economy unavailable' }); }
  });
  return r;
}
