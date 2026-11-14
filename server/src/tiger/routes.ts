// Stats routes (row A11): territory over time and a summary, both from Tiger Data.
import { Router } from 'express';
import type { WorldRunner } from '../runner';
import { tigerStore } from './index';

export function tigerRoutes(runner: WorldRunner): Router {
  const r = Router();
  const unavailable = (res: import('express').Response) => res.status(503).json({ error: 'stats unavailable' });

  r.get('/stats/territory', async (req, res) => {
    const db = tigerStore();
    if (!db) return unavailable(res);
    const world = runner.getWorld();
    const worldId = typeof req.query.worldId === 'string' && req.query.worldId ? req.query.worldId : world?.id;
    if (!worldId) return res.json({ worldId: null, series: [] });
    try {
      const byCountry = await db.territory(worldId);
      const series = [...byCountry].map(([countryId, points]) => {
        const c = world?.id === worldId ? world.countries[countryId] : undefined;
        return { countryId, name: c?.name ?? `Nation ${countryId}`, color: c?.color ?? '#888888', points };
      });
      res.json({ worldId, series });
    } catch { unavailable(res); }
  });

  r.get('/stats/summary', async (_req, res) => {
    const db = tigerStore();
    const world = runner.getWorld();
    if (!db || !world) return unavailable(res);
    try { res.json(await db.summary(world.id)); } catch { unavailable(res); }
  });

  return r;
}
