// A21: Terra Nova News. Gemini looks at a picture of the globe plus the recent chronicle and writes a
// short news bulletin; ElevenLabs reads it in a newsreader voice. Template bulletin and bundled sample in mock.
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { World } from '@terra/shared';
import { currentMode, getBudget, loreModel, validate, type Schema } from '../llm';
import { speak, VoiceUnavailable } from './eleven';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache', 'broadcast');
/** Daniel: the formal British broadcaster premade voice. */
const NEWS_VOICE = { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' };
const STING = 'Terra Nova News.';
const KEEP = 10;

/** BROADCAST_MAX_PER_RUN: bulletins per world that may use Gemini and ElevenLabs (default 12). */
export const maxBroadcasts = () => {
  const n = Number(process.env.BROADCAST_MAX_PER_RUN);
  return Number.isFinite(n) && n > 0 ? n : 12;
};

export interface Bulletin {
  id: string; tick: number; year: number; headline: string; script: string; audio: string;
}
interface Stored extends Bulletin { mood: string; voiced: boolean }
export interface BroadcastResult { bulletin: Bulletin; source: 'gemini' | 'template'; tokensIn: number; tokensOut: number; ms: number }

let worldId = '';
let counter = 0;
let made = 0;
let lastHeadline = '';
let lastCounts: Map<number, number> | null = null;
const store = new Map<string, Stored>();

export const getBulletin = (id: string): Stored | undefined => store.get(id);

const schema: Schema = {
  type: 'object', required: ['headline', 'script', 'mood'],
  properties: {
    headline: { type: 'string', description: 'At most 8 words.' },
    script: { type: 'string', description: 'A newsreader bulletin of 55 to 80 words, plain text.' },
    mood: { type: 'string', enum: ['grave', 'triumphant', 'neutral'] },
  },
};
const geminiSchema = {
  type: 'OBJECT', required: ['headline', 'script', 'mood'],
  properties: {
    headline: { type: 'STRING', description: 'At most 8 words.' },
    script: { type: 'STRING', description: 'A newsreader bulletin of 55 to 80 words, plain text.' },
    mood: { type: 'STRING', enum: ['grave', 'triumphant', 'neutral'] },
  },
};

const SYSTEM = [
  'You are the anchor of Terra Nova News, the evening bulletin of a fictional world of rival nations.',
  'You are shown a picture of the world map right now, plus facts. Write a spoken news bulletin.',
  'Lead with the biggest story. Mention what can be SEEN on the map: colours spreading, a nation shrinking,',
  'a coastline contested. Add one human detail. Use only the facts given; never invent wars or deaths.',
  'Speak in the voice of the world\'s era. 55 to 80 words, plain sentences for reading aloud, no markdown,',
  'no emojis, no stage directions, no sign-off name. Do not repeat the previous headline.',
].join(' ');

function tileCounts(w: World): Map<number, number> {
  const m = new Map<number, number>();
  for (const o of w.owner) if (o >= 0) m.set(o, (m.get(o) ?? 0) + 1);
  return m;
}

function facts(w: World): { text: string; biggest: string; war: string | null } {
  const counts = tileCounts(w);
  const name = (id: number) => w.countries[id]?.name ?? `nation ${id}`;
  const ranked = w.countries.filter((c) => c.alive).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  const shrinking = lastCounts
    ? w.countries.filter((c) => c.alive).map((c) => ({ c, d: (counts.get(c.id) ?? 0) - (lastCounts!.get(c.id) ?? 0) }))
      .filter((x) => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3)
    : [];
  const growing = lastCounts
    ? w.countries.filter((c) => c.alive).map((c) => ({ c, d: (counts.get(c.id) ?? 0) - (lastCounts!.get(c.id) ?? 0) }))
      .filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 2)
    : [];
  const rel = (s: string) => w.relations.filter((r) => r.stance === s && w.countries[r.a]?.alive && w.countries[r.b]?.alive)
    .map((r) => `${name(r.a)} and ${name(r.b)}`);
  const wars = rel('war'), alliances = rel('alliance');
  const silent = w.agents.filter((a) => (a.link === 'cut' || a.deleted) && w.countries[a.countryId]?.alive)
    .map((a) => `${name(a.countryId)} (${a.deleted ? 'its ruler removed' : 'cut off, silent'})`);
  const fallen = w.countries.filter((c) => !c.alive).map((c) => c.name);
  const chron = w.chronicle.slice(-20).map((e) => `- year ${e.year}: ${e.text}`).join('\n') || '- (nothing recorded yet)';
  const text = [
    `World: ${w.name}. Era: ${w.era}. Year ${w.year}.`,
    `Biggest nations (provinces): ${ranked.slice(0, 4).map((c) => `${c.name} ${counts.get(c.id) ?? 0}`).join(', ') || 'none'}.`,
    growing.length ? `Growing since the last bulletin: ${growing.map((x) => `${x.c.name} (+${x.d})`).join(', ')}.` : '',
    shrinking.length ? `Shrinking since the last bulletin: ${shrinking.map((x) => `${x.c.name} (${x.d})`).join(', ')}.` : '',
    `Wars: ${wars.join('; ') || 'none'}. Alliances: ${alliances.join('; ') || 'none'}.`,
    silent.length ? `Silent or cut-off nations: ${silent.join(', ')}.` : '',
    fallen.length ? `Fallen nations: ${fallen.join(', ')}.` : '',
    `Latest chronicle (oldest first):\n${chron}`,
    lastHeadline ? `Previous headline (do not repeat): ${lastHeadline}` : '',
  ].filter(Boolean).join('\n');
  return { text, biggest: ranked[0]?.name ?? w.name, war: wars[0] ?? null };
}

const words = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(' ');

/** The no-API bulletin, built from the chronicle. */
function template(w: World, f: ReturnType<typeof facts>): { headline: string; script: string; mood: string } {
  const recent = w.chronicle.slice(-2).map((e) => e.text.replace(/\s+/g, ' ').replace(/[.!]+$/, ''));
  const headline = f.war ? words(`War between ${f.war}`, 8) : words(`${f.biggest} leads ${w.name}`, 8);
  const script = [
    `Good evening. This is the news from ${w.name}, in the year ${w.year}.`,
    f.war ? `The war between ${f.war} continues.` : `For now no war is raging across the map.`,
    ...recent.map((t) => `${t}.`),
    `${f.biggest} remains the largest nation on the map. More after the break.`,
  ].join(' ');
  return { headline, script, mood: f.war ? 'grave' : 'neutral' };
}

async function ask(w: World, f: ReturnType<typeof facts>, imageBase64: string, mimeType: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey: key });
  const model = loreModel();
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: `${f.text}\n\nWrite the bulletin as JSON: headline (max 8 words), script (55 to 80 words), mood.` },
    ] }],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: geminiSchema as never,
      maxOutputTokens: 600,
      temperature: 0.9,
      thinkingConfig: /gemini-2\.5/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.MINIMAL },
      abortSignal: AbortSignal.timeout(30_000),
    } as never,
  });
  if (!res.text) throw new Error('empty response');
  const out = validate<{ headline: string; script: string; mood: string }>(JSON.parse(res.text), schema);
  out.script = out.script.replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();
  out.headline = words(out.headline.replace(/[*_#`]/g, ''), 8);
  if (out.script.split(' ').length < 20) throw new Error('script too short');
  return { out, tokensIn: res.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0) };
}

// --- audio ---------------------------------------------------------------------------------
const exists = (p: string) => fs.access(p).then(() => true, () => false);
const inflight = new Map<string, Promise<void>>();
const spoken = (b: { script: string }) => `${STING} ${b.script}`;
export const audioFile = (b: { script: string }) =>
  path.join(CACHE, `${crypto.createHash('sha256').update(`${NEWS_VOICE.id}\n${spoken(b)}`).digest('hex')}.mp3`);

/** Make the bulletin's mp3 once, even when several requests ask at the same time. */
export function ensureAudio(b: Stored): Promise<string> {
  const file = audioFile(b);
  let p = inflight.get(file);
  if (!p) {
    p = (async () => {
      if (await exists(file)) return;
      if (!b.voiced) throw new VoiceUnavailable('broadcast cap reached');
      const buf = await speak(spoken(b), NEWS_VOICE.id, { settings: { stability: 0.6, similarity_boost: 0.75, style: 0.2 } });
      await fs.mkdir(CACHE, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, buf);
      await fs.rename(tmp, file);
    })().finally(() => inflight.delete(file));
    inflight.set(file, p);
  }
  return p.then(() => file);
}

// --- the bulletin --------------------------------------------------------------------------
export async function makeBroadcast(w: World, imageBase64: string, mimeType: string): Promise<BroadcastResult> {
  const started = Date.now();
  if (w.id !== worldId) { worldId = w.id; made = 0; lastHeadline = ''; lastCounts = null; store.clear(); }
  const f = facts(w);
  const live = currentMode() === 'live' && !!process.env.GEMINI_API_KEY;
  const underCap = made < maxBroadcasts();
  let body: { headline: string; script: string; mood: string } | null = null;
  let tokensIn = 0, tokensOut = 0;
  if (underCap) made++;
  if (live && underCap && !getBudget().capped) {
    try {
      const r = await ask(w, f, imageBase64, mimeType);
      body = r.out; tokensIn = r.tokensIn; tokensOut = r.tokensOut;
    } catch (e) {
      console.warn('broadcast gemini failed, using the template:', e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  const source = body ? 'gemini' : 'template';
  body ??= template(w, f);
  const id = `b-${++counter}`;
  const stored: Stored = { id, tick: w.tick, year: w.year, ...body, audio: `/api/broadcast/${id}/audio`, voiced: underCap };
  store.set(id, stored);
  while (store.size > KEEP) store.delete(store.keys().next().value as string);
  lastHeadline = stored.headline;
  lastCounts = tileCounts(w);
  // Warm the audio in the background so the GET is quick.
  if (currentMode() === 'live' && underCap) void ensureAudio(stored).catch(() => { /* the GET answers 503 */ });
  const { mood: _m, voiced: _v, ...bulletin } = stored;
  void _m; void _v;
  return { bulletin, source, tokensIn, tokensOut, ms: Date.now() - started };
}
