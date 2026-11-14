// The team's own cloned ElevenLabs voices: news anchors, nation narrators and chant shouters, decree herald.
// Voice ids belong to our account and are not secret. TEAM_VOICES="Name:voiceId,Name:voiceId" overrides them.
import crypto from 'node:crypto';
import type { World } from '@terra/shared';
import { chooseVoice, type VoiceChoice } from './eleven';
import { governmentKeyOf } from './identity';

/** A team voice; `gender` is the label set on the voice in ElevenLabs, used to fit it to a nation. */
export type TeamVoice = VoiceChoice & { gender?: 'male' | 'female' };

const DEFAULTS: TeamVoice[] = [
  { name: 'Sam', id: 'EDnnAH9hpLWTbuZABb6m', gender: 'male' },          // young, british
  { name: 'Justin', id: 'anQlezD0CQ3Da2imqn0U', gender: 'male' },       // young, south african
  { name: 'Denis', id: 'cB9gMo2Q6antSOn6HTu7', gender: 'male' },        // young, british
  { name: 'Mei', id: 'BsJA6RefirvcBQvrP1Tq', gender: 'female' },        // young, british
  { name: 'Angelina', id: 'RC0lt6mhTpwcK6CS55bR', gender: 'female' },   // young, scouse
  { name: 'Boaz', id: '6TrFQSMKdlEZIthqzXKB', gender: 'male' },         // young, cockney
];

/** The team voices, in anchor order. Read on every call so a changed env var takes effect. */
export function teamVoices(): TeamVoice[] {
  const raw = process.env.TEAM_VOICES?.trim();
  if (!raw) return DEFAULTS;
  // "Name:voiceId" or "Name:voiceId:female"
  const list = raw.split(',').map((p): TeamVoice | null => {
    const [name, id, g] = p.split(':').map((x) => x?.trim());
    if (!name || !id) return null;
    return { name, id, gender: g === 'female' || g === 'male' ? g : undefined };
  }).filter((v): v is TeamVoice => !!v && /^[A-Za-z0-9]{8,40}$/.test(v.id));
  return list.length ? list : DEFAULTS;
}

/** Bulletin n (1-based) is read by voice n-1 modulo the team: Sam, Justin, Denis, Mei, Angelina, Boaz, Sam, ... */
export function anchorFor(bulletinNumber: number): VoiceChoice {
  const t = teamVoices();
  return t[(Math.max(1, bulletinNumber) - 1) % t.length]!;
}

const has = (s: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(s));
const FEMININE = ['woman', 'female', 'lady', 'queen', 'empress', 'priestess', 'witch', 'she', 'her', 'girl', 'mother', 'duchess', 'matriarch', 'maiden', 'sister'];
const MASCULINE = ['man', 'male', 'he', 'his', 'lord', 'king', 'herald', 'emperor', 'priest', 'father', 'duke', 'patriarch', 'boy'];

/** How well a nation's voiceStyle fits a young voice of this gender (higher is better). */
function voiceFit(voiceStyle: string | undefined, gender: TeamVoice['gender']): number {
  const s = (voiceStyle ?? '').toLowerCase();
  let n = 0;
  if (has(s, ['young', 'youthful', 'brisk', 'eager', 'bright', 'lively', 'energetic', 'teen'])) n += 3;
  const fem = has(s, FEMININE), masc = has(s, MASCULINE);
  if (gender === 'female') { if (fem) n += 4; if (masc && !fem) n -= 10; }
  else { if (masc) n += 1; if (fem && !masc) n -= 10; }
  if (has(s, ['old', 'elder', 'aged', 'ancient', 'grave', 'weathered', 'wise', 'venerable', 'grey', 'gray'])) n -= 3;
  return n;
}

/**
 * Country id -> team voice for this world, one voice each. Each team voice in order takes the
 * free nation it fits best (ties by id); a voice that fits nobody (score below -5) is left out,
 * so that nation keeps its premade voice. Pure: every replica and route agrees.
 */
export function narrators(world: World): Map<number, TeamVoice> {
  const out = new Map<number, TeamVoice>();
  const free = new Set(world.countries.map((c) => c.id));
  for (const v of teamVoices()) {
    let best = -1, score = -Infinity;
    for (const c of world.countries) {
      if (!free.has(c.id)) continue;
      const f = voiceFit(c.voiceStyle, v.gender);
      if (f > score) { score = f; best = c.id; }
    }
    if (best < 0 || score < -5) continue;
    free.delete(best); out.set(best, v);
  }
  return out;
}

/** The voice that narrates and chants for a nation: its team voice, else the premade choice. */
export function voiceForCountry(world: World, id: number): VoiceChoice {
  const c = world.countries[id];
  return narrators(world).get(id) ?? chooseVoice(c?.voiceStyle, c ? governmentKeyOf(c) : undefined);
}

/** The herald for a decree entry: a team voice picked by hash of the entry id. */
export function heraldVoice(entryId: string): VoiceChoice {
  const t = teamVoices();
  return t[crypto.createHash('sha256').update(entryId).digest().readUInt32BE(0) % t.length]!;
}

export const heraldText = (decree: string) => `Hear ye! By decree: ${decree.replace(/\s+/g, ' ').trim()}`;
