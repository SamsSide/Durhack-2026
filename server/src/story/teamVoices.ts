// The team's own cloned ElevenLabs voices: news anchors, nation narrators and chant shouters, decree herald.
// Voice ids belong to our account and are not secret. TEAM_VOICES="Name:voiceId,Name:voiceId" overrides them.
import crypto from 'node:crypto';
import type { World } from '@terra/shared';
import { chooseVoice, type VoiceChoice } from './eleven';

const DEFAULTS: VoiceChoice[] = [
  { name: 'Sam', id: 'EDnnAH9hpLWTbuZABb6m' },     // young male, british
  { name: 'Justin', id: 'anQlezD0CQ3Da2imqn0U' },  // young male, south african
  { name: 'Denis', id: 'cB9gMo2Q6antSOn6HTu7' },   // young male, british
];

/** The team voices, in anchor order. Read on every call so a changed env var takes effect. */
export function teamVoices(): VoiceChoice[] {
  const raw = process.env.TEAM_VOICES?.trim();
  if (!raw) return DEFAULTS;
  const list = raw.split(',').map((p) => {
    const i = p.indexOf(':');
    return i > 0 ? { name: p.slice(0, i).trim(), id: p.slice(i + 1).trim() } : null;
  }).filter((v): v is VoiceChoice => !!v && !!v.name && /^[A-Za-z0-9]{8,40}$/.test(v.id));
  return list.length ? list : DEFAULTS;
}

/** Bulletin n (1-based) is read by voice n-1 modulo the team: Sam, Justin, Denis, Sam, ... */
export function anchorFor(bulletinNumber: number): VoiceChoice {
  const t = teamVoices();
  return t[(Math.max(1, bulletinNumber) - 1) % t.length]!;
}

const has = (s: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(s));
/** How well a nation's voiceStyle fits a young male voice (higher is better). */
function youngMaleFit(voiceStyle: string | undefined): number {
  const s = (voiceStyle ?? '').toLowerCase();
  let n = 0;
  if (has(s, ['young', 'youthful', 'brisk', 'eager', 'bright', 'lively', 'energetic', 'boy', 'teen'])) n += 3;
  if (has(s, ['man', 'male', 'he', 'his', 'lord', 'king', 'herald'])) n += 1;
  if (has(s, ['woman', 'female', 'lady', 'queen', 'empress', 'priestess', 'witch', 'she', 'her', 'girl', 'mother', 'duchess'])) n -= 10;
  if (has(s, ['old', 'elder', 'aged', 'ancient', 'grave', 'weathered', 'wise', 'patriarch', 'venerable', 'grey', 'gray'])) n -= 3;
  return n;
}

/** Country id -> team voice for this world: the best young-male fits (ties by id), one voice each. Pure. */
export function narrators(world: World): Map<number, VoiceChoice> {
  const team = teamVoices();
  const ranked = world.countries
    .map((c) => ({ id: c.id, fit: youngMaleFit(c.voiceStyle) }))
    .sort((a, b) => b.fit - a.fit || a.id - b.id)
    .slice(0, team.length);
  return new Map(ranked.map((r, i) => [r.id, team[i]!]));
}

/** The voice that narrates and chants for a nation: its team voice, else the premade choice. */
export function voiceForCountry(world: World, id: number): VoiceChoice {
  return narrators(world).get(id) ?? chooseVoice(world.countries[id]?.voiceStyle);
}

/** The herald for a decree entry: a team voice picked by hash of the entry id. */
export function heraldVoice(entryId: string): VoiceChoice {
  const t = teamVoices();
  return t[crypto.createHash('sha256').update(entryId).digest().readUInt32BE(0) % t.length]!;
}

export const heraldText = (decree: string) => `Hear ye! By decree: ${decree.replace(/\s+/g, ' ').trim()}`;
