// X3 story routes: lore, narration, anthem, chant, painted flag. Mock mode serves bundled samples.
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorldRunner } from '../runner';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { currentMode } from '../llm';
import { getLore, getRegionLore } from './loreAi';
import { speak } from './eleven';
import { heraldText, heraldVoice, voiceForCountry } from './teamVoices';
import { imageLive, paintFlag } from './paintedFlag';
import { ensureChant } from './chant';
import { anthemFile, anthemLive } from './anthem';
import { ensureAudio, getBulletin, makeBroadcast } from './broadcast';

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
  const playing = () => runner.playback?.() === true;
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
      const voice = voiceForCountry(w, id);
      const file = path.join(CACHE, 'narration', `${sha(`${voice.id}\n${text}`)}.mp3`);
      if (playing()) {
        if (!(await exists(file))) return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'narration.mp3'));
      } else await ensure(file, () => speak(text, voice.id));
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
      res.type('audio/mpeg').sendFile(await anthemFile(w, w.countries[id]!, lore.anthemLyrics, playing()));
    } catch {
      if (playing()) return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'anthem.mp3'));
      res.status(503).json({ error: 'voice unavailable' });
    }
  });

  r.get('/country/:id/chant', async (req, res) => {
    const id = countryId(req.params.id);
    const w = runner.getWorld();
    if (id === null || !w) return void res.status(404).json({ error: 'no such country' });
    if (currentMode() !== 'live') return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'chant.mp3'));
    try {
      res.type('audio/mpeg').sendFile(await ensureChant(w, id, playing()));
    } catch {
      if (playing()) return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'chant.mp3'));
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

  // A21: Terra Nova News. The globe picture comes from the browser (about 1280 x 720 JPEG, under 3 MB).
  r.post('/broadcast', async (req, res) => {
    const w = runner.getWorld();
    const { imageBase64, mimeType } = (req.body ?? {}) as { imageBase64?: unknown; mimeType?: unknown };
    if (!w) return void res.status(404).json({ error: 'no world' });
    if (typeof imageBase64 !== 'string' || !imageBase64 || imageBase64.length > 4_200_000) {
      return void res.status(400).json({ error: 'imageBase64 missing or over 3 MB' });
    }
    const mime = typeof mimeType === 'string' && /^image\/(jpeg|png|webp)$/.test(mimeType) ? mimeType : 'image/jpeg';
    try {
      const r = await makeBroadcast(w, imageBase64.replace(/^data:[^,]*,/, ''), mime, playing());
      console.log(`broadcast ${r.bulletin.id} via ${r.source} in ${r.ms} ms (${r.tokensIn} in, ${r.tokensOut} out)`);
      res.json(r.bulletin);
    } catch (e) {
      console.warn('broadcast failed:', e instanceof Error ? e.message.slice(0, 200) : e);
      res.status(500).json({ error: 'broadcast failed' });
    }
  });

  r.get('/broadcast/:id/audio', async (req, res) => {
    const b = getBulletin(req.params.id ?? '');
    if (!b) return void res.status(404).json({ error: 'no such bulletin' });
    if (currentMode() !== 'live') return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'narration.mp3'));
    try {
      res.type('audio/mpeg').sendFile(await ensureAudio(b, playing()));
    } catch {
      if (playing()) return void res.type('audio/mpeg').sendFile(path.join(SAMPLES, 'narration.mp3'));
      res.status(503).json({ error: 'voice unavailable' });
    }
  });

  // The royal herald reads a decree aloud, in one of the team's voices. Only a decree's own line is read.
  r.get('/decree/:entryId/herald', async (req, res) => {
    const w = runner.getWorld();
    const entryId = req.params.entryId ?? '';
    const entry = w?.chronicle.find((e) => e.id === entryId && e.kind === 'decree');
    if (!w || !entry) return void res.status(404).json({ error: 'no such decree' });
    const sample = path.join(SAMPLES, 'narration.mp3');
    if (currentMode() !== 'live') return void res.type('audio/mpeg').sendFile(sample);
    try {
      const text = heraldText(entry.text);
      const voice = heraldVoice(entryId);
      const file = path.join(CACHE, 'herald', `${sha(`${voice.id}\n${text}`)}.mp3`);
      if (playing()) {
        if (!(await exists(file))) return void res.type('audio/mpeg').sendFile(sample);
      } else await ensure(file, () => speak(text, voice.id, { settings: { stability: 0.4, similarity_boost: 0.75, style: 0.5 } }));
      res.type('audio/mpeg').sendFile(file);
    } catch {
      res.status(503).json({ error: 'voice unavailable' });
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
