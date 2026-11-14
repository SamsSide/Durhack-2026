// War chants (A16): one short shouted line per nation, written by Gemini (or a template), voiced by
// ElevenLabs and cached on disk. Made once per nation per world; never regenerated during a run.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { World } from '@terra/shared';
import { llmJson, loreModel, type Schema } from '../llm';
import { chooseVoice, speak, voiceLive } from './eleven';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache', 'chant');
/** eleven_v3 understands audio tags such as [shouting] and is the most expressive; set ELEVEN_CHANT_MODEL to change it. */
const chantModel = () => process.env.ELEVEN_CHANT_MODEL || 'eleven_v3';
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const exists = (p: string) => fs.access(p).then(() => true, () => false);

const WAR_WORDS = ['iron', 'fire', 'blood', 'steel', 'thunder', 'ash', 'stone', 'storm', 'glory', 'vengeance'];

/** A deterministic fallback line from the nation's adjective and name. */
export function templateChant(world: World, id: number): string {
  const c = world.countries[id]!;
  const adj = c.adjective.trim() || 'Free';
  const short = c.name.replace(/^the\s+/i, '').trim() || adj;
  const h = parseInt(sha(`${world.id}:${id}:${c.name}`).slice(0, 6), 16);
  const w1 = WAR_WORDS[h % WAR_WORDS.length]!;
  const w2 = WAR_WORDS[(h >> 4) % WAR_WORDS.length]!;
  const second = w2 === w1 ? 'glory' : w2;
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  return `${cap(w1)} and ${second}! ${cap(w1)} and ${second}! ${short} marches!`;
}

const chantSchema: Schema = {
  type: 'object', required: ['line'],
  properties: { line: { type: 'string', description: 'The chant: 8 to 14 words, shouted, with a repeated phrase.' } },
};

/** The chant words for one nation: Gemini when live, the template on any failure or when the line is off. */
export async function chantLine(world: World, id: number): Promise<string> {
  const c = world.countries[id]!;
  const t = c.temperament;
  try {
    const out = await llmJson<{ line: string }>({
      model: loreModel(),
      system: 'You write war chants for a fictional nation: short, rhythmic, shouted by a crowd. Plain words, no markdown, no emojis, no stage directions. Reply with JSON only.',
      prompt: [
        `Nation: ${c.name} (${c.adjective}), a ${c.government}. Culture: ${c.culture.join(', ')}.`,
        `Ideology: ${c.ideology}`,
        `Temperament (0-1): aggression ${t.aggression}, faith ${t.faith}, trade ${t.trade}.`,
        'Write one war chant of 8 to 14 words that repeats one short phrase twice and names the nation or its adjective.',
        'Example: "Ash and iron! Ash and iron! The Concord marches!"',
      ].join('\n'),
      schema: chantSchema, maxOutputTokens: 120, purpose: 'chant',
    });
    const line = out.line.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    const words = line.split(' ').length;
    if (words >= 5 && words <= 20 && line.length <= 140) return line;
  } catch { /* template below */ }
  return templateChant(world, id);
}

/** The cache file for a nation's chant: fixed per world, nation and voice, so it is made once. */
export function chantFile(world: World, id: number): string {
  const voice = chooseVoice(world.countries[id]!.voiceStyle);
  return path.join(CACHE, `${sha(`${world.id}\n${id}\n${voice.id}\n${chantModel()}`)}.mp3`);
}

const inflight = new Map<string, Promise<void>>();

/** Make the chant file once even when several requests ask at the same time; resolves to its path. */
export async function ensureChant(world: World, id: number): Promise<string> {
  const file = chantFile(world, id);
  let p = inflight.get(file);
  if (!p) {
    p = (async () => {
      if (await exists(file)) return;
      const line = await chantLine(world, id);
      const v3 = chantModel().startsWith('eleven_v3');
      const text = v3 ? `[shouting] ${line}` : line;
      const voice = chooseVoice(world.countries[id]!.voiceStyle);
      const buf = await speak(text, voice.id, {
        model: chantModel(),
        settings: v3 ? { stability: 0, similarity_boost: 0.75, style: 0.6 } : { stability: 0.3, similarity_boost: 0.75, style: 0.8 },
      });
      await fs.mkdir(CACHE, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, buf);
      await fs.rename(tmp, file);
    })().finally(() => inflight.delete(file));
    inflight.set(file, p);
  }
  await p;
  return file;
}

let warming: string | null = null;
/** Pre-warm the chants of the nations most likely to fight first, one at a time, live mode only. */
export async function warmChants(world: World, limit = 6): Promise<void> {
  if (!voiceLive() || warming === world.id) return;
  warming = world.id;
  const borders = new Map<number, Set<number>>();
  for (const t of world.tiles) {
    const o = world.owner[t.id];
    if (o === undefined || o < 0) continue;
    for (const n of t.neighbors) {
      const on = world.owner[n];
      if (on !== undefined && on >= 0 && on !== o) {
        (borders.get(o) ?? borders.set(o, new Set()).get(o)!).add(on);
      }
    }
  }
  const order = world.countries
    .filter((c) => c.alive)
    .map((c) => ({ id: c.id, score: (borders.get(c.id)?.size ?? 0) + 3 * c.temperament.aggression }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  for (const { id } of order) {
    if (warming !== world.id) return; // a newer world took over
    try { await ensureChant(world, id); } catch { return; } // cap or API trouble: stop quietly
  }
}
