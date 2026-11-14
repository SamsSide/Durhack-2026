// X3 HTTP routes (mocked in the seed).
import express from 'express';
import type { LlmMode, WorldRunner } from '../runner';
import { storyRoutes } from '../story/routes';

export function createApp(runner: WorldRunner, mode: LlmMode) {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode, world: runner.getWorld()?.id ?? null });
  });

  app.post('/api/world', (req, res) => {
    const body = req.body ?? {};
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) return void res.status(400).json({ error: 'prompt is required' });
    const world = runner.newWorld({
      prompt: body.prompt, nations: body.nations, era: body.era, seaLevel: body.seaLevel,
      aggression: body.aggression, seed: typeof body.seed === 'number' ? body.seed : undefined, imageBase64: body.imageBase64 ?? null,
    });
    res.json({ worldId: world.id });
  });

  app.get('/api/replays', (_req, res) => { res.json(runner.listReplays()); });

  app.post('/api/replays/:id/play', (req, res) => {
    const world = runner.replay(String(req.params.id));
    if (!world) return void res.status(404).json({ error: 'no such replay' });
    res.json({ worldId: world.id });
  });

  app.get('/api/world/log', (_req, res) => {
    const log = runner.getLog();
    if (!log) return void res.status(404).json({ error: 'no world' });
    res.json(log);
  });

  app.use('/api', storyRoutes(runner));
  return app;
}
