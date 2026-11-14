// A15: a nation's anthem, sung by ElevenLabs Music to the lyrics written from its history.
// Docs: https://elevenlabs.io/docs/api-reference/music/compose  (POST /v1/music, music_v1 + composition_plan)
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Country, World } from '@terra/shared';
import { nationIdentity } from './identity';
import { currentMode } from '../llm';
import { VoiceUnavailable } from './eleven';

const API = 'https://api.elevenlabs.io/v1/music';
const model = () => process.env.ELEVEN_MUSIC_MODEL || 'music_v1';
export const anthemMaxPerRun = () => maxPerRun();
const maxPerRun = () => {
  const n = Number(process.env.ANTHEM_MAX_PER_RUN);
  return Number.isFinite(n) && n >= 0 ? n : 8;
};
const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache', 'anthem');
const SECTION_MS = 15_000;

export const anthemLive = () => currentMode() === 'live' && !!process.env.ELEVENLABS_API_KEY;
let generated = 0;
export const anthemsGenerated = () => generated;
export function resetAnthemMeter(): void { generated = 0; }

type Plan = {
  positive_global_styles: string[]; negative_global_styles: string[];
  sections: { section_name: string; positive_local_styles: string[]; negative_local_styles: string[]; duration_ms: number; lines: string[] }[];
};

/** The music filter rejects prompts that name a (national) anthem, so the bible's wording is softened. */
const safeStyle = (p: string) => p.replace(/national\s+anthems?/gi, 'patriotic hymn').replace(/anthems?/gi, 'hymn');

/** The composition plan (A24): the era's instruments and production, the government's form, tempo and voices,
 *  then the nation's own anthemPrompt; the lyrics are split across two sung sections. */
export function buildPlan(world: Parameters<typeof nationIdentity>[0], c: Pick<Country, 'id' | 'capitalTile' | 'name' | 'government' | 'ideology' | 'culture' | 'temperament' | 'anthemPrompt' | 'techAge' | 'buildingStyle' | 'nomadic'>, lyrics: string[]): Plan {
  const lines = lyrics.map((l) => l.replace(/\s+/g, ' ').trim().slice(0, 190)).filter(Boolean).slice(0, 8);
  const half = Math.ceil(lines.length / 2);
  const parts = [lines.slice(0, half), lines.slice(half)].filter((p) => p.length);
  const m = nationIdentity(world, c).music;
  const styles = [
    safeStyle(c.anthemPrompt),
    `${m.form}, ${m.tempo}`,
    m.instruments,
    `${m.production}, ${m.mood}`,
    [m.voices, m.language].filter(Boolean).join(', '),
    'sung vocals', 'sung lyrics',
    ...c.culture.slice(0, 2),
  ];
  return {
    positive_global_styles: styles.map((s) => safeStyle(s).slice(0, 200)),
    negative_global_styles: ['instrumental only', 'spoken word', 'rap', ...m.negative.split(', ')],
    sections: parts.map((p, i) => ({
      section_name: i === 0 ? 'Verse' : 'Chorus',
      positive_local_styles: [i === 0 ? m.verse : m.chorus],
      negative_local_styles: [],
      duration_ms: SECTION_MS,
      lines: p,
    })),
  };
}

async function compose(plan: Plan): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new VoiceUnavailable('ELEVENLABS_API_KEY is not set');
  if (generated >= maxPerRun()) throw new VoiceUnavailable('anthem cap reached');
  generated++; // counted before the call: a failed call may still bill
  const started = Date.now();
  try {
    const res = await fetch(`${API}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ model_id: model(), composition_plan: plan }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10_000) throw new Error('audio too short');
    console.log(`anthem generated in ${Date.now() - started} ms, ${buf.length} bytes`);
    return buf;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`elevenlabs music failed after ${Date.now() - started} ms: ${msg.slice(0, 200)}`);
    throw new VoiceUnavailable(msg.slice(0, 200));
  }
}

const exists = (p: string) => fs.access(p).then(() => true, () => false);
const inflight = new Map<string, Promise<void>>();

/** Path of the cached anthem for these lyrics, generating it once (concurrent callers share one call). */
export async function anthemFile(world: World, country: Country, lyrics: string[], cachedOnly = false): Promise<string> {
  if (!anthemLive()) throw new VoiceUnavailable('music off');
  const plan = buildPlan(world, country, lyrics);
  const hash = crypto.createHash('sha256').update(`${model()}\n${JSON.stringify(plan)}`).digest('hex');
  const file = path.join(CACHE_DIR, `${hash}.mp3`);
  if (cachedOnly && !(await exists(file))) throw new VoiceUnavailable('not recorded');
  let p = inflight.get(file);
  if (!p) {
    p = (async () => {
      if (await exists(file)) return;
      const buf = await compose(plan);
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, buf);
      await fs.rename(tmp, file);
    })().finally(() => inflight.delete(file));
    inflight.set(file, p);
  }
  await p;
  return file;
}
