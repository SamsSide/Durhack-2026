// X3 HTTP routes.
import { parseImage } from '../engine/bibleAi';
import express from 'express';
import type { LlmMode, WorldRunner } from '../runner';
import { storyRoutes } from '../story/routes';
import { tigerRoutes } from '../tiger/routes';

export function createApp(runner: WorldRunner, mode: LlmMode) {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode, world: runner.getWorld()?.id ?? null });
  });

  // Waits for the world bible (Gemini in live mode, about 5 s; the template in mock mode).
  app.post('/api/world', async (req, res) => {
    const body = req.body ?? {};
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) return void res.status(400).json({ error: 'prompt is required' });
    if (body.imageBase64 != null && body.imageBase64 !== '' && !parseImage(body.imageBase64)) {
      return void res.status(400).json({ error: 'unsupported image' });
    }
    try {
      const world = await runner.newWorld({
        prompt: body.prompt, nations: body.nations, era: body.era, seaLevel: body.seaLevel,
        aggression: body.aggression, seed: typeof body.seed === 'number' ? body.seed : undefined, imageBase64: body.imageBase64 ?? null,
      });
      res.json({ worldId: world.id });
    } catch (e) {
      console.error('world creation failed:', e);
      res.status(500).json({ error: 'world creation failed' });
    }
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
  app.use('/api', tigerRoutes(runner));
  return app;
}
