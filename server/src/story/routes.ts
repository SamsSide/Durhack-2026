// X3 story routes: lore, narration, anthem, chant, painted flag. Mock mode serves bundled samples.
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorldRunner } from '../runner';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { currentMode } from '../llm';
import { getLore, getRegionLore } from './loreAi';
import { chooseVoice, speak } from './eleven';
import { imageLive, paintFlag } from './paintedFlag';
import { ensureChant } from './chant';
import { anthemFile, anthemLive } from './anthem';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const exists = (p: string) => fs.access(p).then(() => true, () => false);
const inflight = new Map<string, Promise<void>>();
/** Make `file` once even when several requests ask at the same time. */
function ensure(file: string, make: () => Promise<Buffer>): Promise<void> {
  let p = inflight.get(file);
  if (!p) {
    p = (async () => {
      if (await exists(file)) return;
      const buf = await make();
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, buf);
      await fs.rename(tmp, file);
    })().finally(() => inflight.delete(file));
    inflight.set(file, p);
  }
  return p;
}

const SAMPLES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'samples');

export function storyRoutes(runner: WorldRunner): Router {
  const r = Router();
  const countryId = (s: string | undefined) => {
    const id = Number(s);
    const w = runner.getWorld();
    return w && Number.isInteger(id) && w.countries[id] ? id : null;
  };

  r.get('/country/:id/lore', async (req, res) => {
    const id = countryId(req.params.id);
    const w = runner.getWorld();
    if (id === null || !w) return void res.status(404).json({ error: 'no such country' });
    const lore = await getLore(id, w);
    if (!lore) return void res.status(404).json({ error: 'no such country' });
    res.json(lore);
  });

  r.get('/country/:id/narration', async (req, res) => {
    const id = countryId(req.params.id);
    const w = runner.getWorld();
    if (id === null || !w) return void res.status(404).json({ error: 'no such country' });
    if (currentMode() !== 'live') return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'narration.mp3'));
    try {
      const lore = await getLore(id, w);
      if (!lore) return void res.status(404).json({ error: 'no such country' });
      const text = `${lore.summary} ${lore.history}`.replace(/\s+/g, ' ').trim();
      const voice = chooseVoice(w.countries[id]!.voiceStyle);
      const file = path.join(CACHE, 'narration', `${sha(`${voice.id}\n${text}`)}.mp3`);
      await ensure(file, () => speak(text, voice.id));
      res.type('audio/mpeg').sendFile(file);
    } catch {
      res.status(503).json({ error: 'voice unavailable' });
    }
  });

  r.get('/country/:id/anthem', async (req, res) => {
    const id = countryId(req.params.id);
    const w = runner.getWorld();
    if (id === null || !w) return void res.status(404).json({ error: 'no such country' });
    if (!anthemLive()) return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'anthem.mp3'));
    try {
      const lore = await getLore(id, w);
      if (!lore) return void res.status(404).json({ error: 'no such country' });
      res.type('audio/mpeg').sendFile(await anthemFile(w.countries[id]!, lore.anthemLyrics));
    } catch {
      res.status(503).json({ error: 'voice unavailable' });
    }
  });

  r.get('/country/:id/chant', async (req, res) => {
    const id = countryId(req.params.id);
    const w = runner.getWorld();
    if (id === null || !w) return void res.status(404).json({ error: 'no such country' });
    if (currentMode() !== 'live') return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'chant.mp3'));
    try {
      res.type('audio/mpeg').sendFile(await ensureChant(w, id));
    } catch {
      res.status(503).json({ error: 'voice unavailable' });
    }
  });

  r.get('/country/:id/flag', async (req, res) => {
    const id = countryId(req.params.id);
    const w = runner.getWorld();
    if (id === null || !w) return void res.status(404).json({ error: 'no such country' });
    if (!imageLive()) return void res.status(503).json({ error: 'image generation off' });
    try {
      const spec = w.countries[id]!.flag;
      const file = path.join(CACHE, 'flags', `${sha(`${process.env.GEMINI_MODEL_IMAGE}\n${JSON.stringify(spec)}`)}.png`);
      await ensure(file, () => paintFlag(spec));
      res.type('image/png').sendFile(file);
    } catch (e) {
      console.warn('painted flag failed:', e instanceof Error ? e.message.slice(0, 200) : e);
      res.status(503).json({ error: 'image generation off' });
    }
  });

  r.get('/region/:id/lore', async (req, res) => {
    const w = runner.getWorld();
    const lore = w ? await getRegionLore(Number(req.params.id), w) : null;
    if (!lore) return void res.status(404).json({ error: 'no such region' });
    res.json(lore);
  });
  return r;
}
