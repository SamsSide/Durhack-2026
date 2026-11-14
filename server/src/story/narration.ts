// X3 narration: a nation's lore summary and history spoken by its voice, cached on disk by voice and
// text. The route and prepare mode (row A31) share it, so a prepared narration is served from cache.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { World } from '@terra/shared';
import { getLore } from './loreAi';
import { speak } from './eleven';
import { voiceForCountry } from './teamVoices';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache', 'narration');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const fileExists = (p: string) => fs.access(p).then(() => true, () => false);
const inflight = new Map<string, Promise<void>>();

/** The words and the cache file for a nation's narration right now, or null for no such nation. */
export async function narrationTarget(w: World, id: number): Promise<{ file: string; text: string; voiceId: string } | null> {
  const lore = await getLore(id, w);
  if (!lore) return null;
  const text = `${lore.summary} ${lore.history}`.replace(/\s+/g, ' ').trim();
  const voice = voiceForCountry(w, id);
  return { file: path.join(CACHE, `${sha(`${voice.id}\n${text}`)}.mp3`), text, voiceId: voice.id };
}

/** Makes the narration once (concurrent callers share one call); resolves to its path. */
export async function ensureNarration(w: World, id: number): Promise<string> {
  const t = await narrationTarget(w, id);
  if (!t) throw new Error('no such country');
  let p = inflight.get(t.file);
  if (!p) {
    p = (async () => {
      if (await fileExists(t.file)) return;
      const buf = await speak(t.text, t.voiceId);
      await fs.mkdir(CACHE, { recursive: true });
      const tmp = `${t.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, buf);
      await fs.rename(tmp, t.file);
    })().finally(() => inflight.delete(t.file));
    inflight.set(t.file, p);
  }
  await p;
  return t.file;
}
