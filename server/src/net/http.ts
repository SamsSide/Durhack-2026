// X3 HTTP routes.
import { parseImage } from '../engine/bibleAi';
import { checkAudio, hearDecree, NoSpeechError, type DecreeRunner } from '../engine/decrees';
import express from 'express';
import type { LlmMode, WorldRunner } from '../runner';
import { storyRoutes } from '../story/routes';
import { tigerRoutes } from '../tiger/routes';
import { chainRoutes } from '../chain/routes';
import { prepareWorld } from '../prepare';

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
    const prepare = body.prepare === true;
    try {
      const world = await runner.newWorld({
        prompt: body.prompt, nations: body.nations, era: body.era, seaLevel: body.seaLevel,
        aggression: body.aggression, seed: typeof body.seed === 'number' ? body.seed : undefined,
        provinces: typeof body.provinces === 'number' ? body.provinces : undefined, imageBase64: body.imageBase64 ?? null,
        paused: prepare,
      });
      // Row A31: the world waits paused while its lore, voices and first decisions are made.
      if (prepare && runner.getWorld()?.id === world.id) void prepareWorld(runner, world);
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

  // Row A20: a spoken decree. Gemini hears the audio and interprets it in one call; the decree is
  // applied at once (the real engine applies its effect; the mock runner only chronicles it).
  app.post('/api/decree/voice', async (req, res) => {
    const world = runner.getWorld();
    if (!world) return void res.status(404).json({ error: 'no world' });
    const body = req.body ?? {};
    const mime = checkAudio(body.audioBase64, body.mimeType);
    if (!mime) return void res.status(400).json({ error: 'unsupported audio' });
    try {
      const { transcript, decree } = await hearDecree(world, body.audioBase64, mime);
      const engine = runner as WorldRunner & Partial<DecreeRunner>;
      if (engine.applyDecree) engine.applyDecree(decree);
      else runner.control({ action: 'decree', text: decree.text });
      res.json({ transcript, decree });
    } catch (e) {
      if (e instanceof NoSpeechError) return void res.status(400).json({ error: 'no speech heard' });
      console.warn('voice decree failed:', e instanceof Error ? e.message : e);
      res.status(503).json({ error: 'voice unavailable' });
    }
  });

  app.use('/api', storyRoutes(runner));
  app.use('/api', tigerRoutes(runner));
  app.use('/api', chainRoutes(runner));
  return app;
}
