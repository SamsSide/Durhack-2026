// ElevenLabs text to speech (A14): plain fetch, voice choice from voiceStyle, a character meter and cap.
import { currentMode } from '../llm';

const API = 'https://api.elevenlabs.io/v1';
/** Stable, natural long-form model; set ELEVEN_MODEL to try eleven_v3 or eleven_flash_v2_5. */
const model = () => process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const maxChars = () => {
  const n = Number(process.env.ELEVEN_MAX_CHARS_PER_RUN);
  return Number.isFinite(n) && n > 0 ? n : 20_000;
};

export class VoiceUnavailable extends Error {
  constructor(message: string) { super(message); this.name = 'VoiceUnavailable'; }
}

// --- voice table: the one place that maps a voiceStyle to a premade voice ----------------------
export interface VoiceChoice { id: string; name: string }
const V = {
  george: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },   // warm storyteller, british, the default narrator
  daniel: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },   // formal broadcaster, british
  bill: { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill' },       // old, wise
  brian: { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },     // deep, resonant
  harry: { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry' },     // fierce warrior
  charlie: { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' }, // young, energetic
  callum: { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },   // husky trickster
  lily: { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },       // velvety, british
  alice: { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },     // clear, british
  sarah: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },     // young, confident
  jessica: { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' }, // young, bright
  matilda: { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' }, // knowledgeable
} satisfies Record<string, VoiceChoice>;

const has = (s: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(s));
const FEMALE = ['woman', 'female', 'lady', 'queen', 'empress', 'matron', 'priestess', 'witch', 'she', 'her', 'girl', 'mother', 'duchess'];
const MALE = ['man', 'male', 'king', 'emperor', 'father', 'priest', 'boy', 'he', 'his', 'lord', 'duke', 'general'];
const OLD = ['old', 'elder', 'aged', 'ancient', 'grave', 'weathered', 'wise', 'patriarch', 'venerable', 'grey', 'gray'];
const YOUNG = ['young', 'youthful', 'brisk', 'herald', 'teen', 'boy', 'girl', 'eager', 'bright', 'lively', 'energetic'];
const FIERCE = ['fierce', 'war', 'warrior', 'soldier', 'rebel', 'revolutionary', 'rough', 'gruff', 'harsh', 'commander', 'blunt'];
const SMOOTH = ['smooth', 'merchant', 'trader', 'silken', 'charming', 'cunning', 'sly', 'trickster', 'sly'];
const FORMAL = ['formal', 'stern', 'official', 'bureaucrat', 'broadcaster', 'cold', 'precise', 'clerk', 'scholar'];

/** Deterministic: the same voiceStyle always gives the same voice. */
export function chooseVoice(voiceStyle: string | undefined): VoiceChoice {
  const s = (voiceStyle ?? '').toLowerCase();
  if (!s.trim()) return V.george;
  const female = has(s, FEMALE) && !has(s, ['man', 'male', 'king', 'father', 'priest', 'he', 'his']);
  const old = has(s, OLD), young = has(s, YOUNG);
  if (female) {
    if (has(s, FORMAL)) return V.alice;
    if (young) return V.jessica;
    if (old || has(s, ['velvet', 'grave', 'regal', 'queen', 'empress'])) return V.lily;
    return V.matilda;
  }
  if (has(s, FIERCE)) return V.harry;
  if (old) return has(s, ['deep', 'grave', 'resonant']) ? V.brian : V.bill;
  if (has(s, SMOOTH)) return V.callum;
  if (young) return V.charlie;
  if (has(s, FORMAL)) return V.daniel;
  if (has(s, ['deep', 'resonant', 'booming'])) return V.brian;
  void MALE;
  return V.george;
}

// --- meter ---------------------------------------------------------------------------------
let charsUsed = 0;
export const voiceCharsUsed = () => charsUsed;
export function resetVoiceMeter(): void { charsUsed = 0; }
export const voiceLive = () => currentMode() === 'live' && !!process.env.ELEVENLABS_API_KEY;

/** Speak `text` in voice `voiceId`; throws VoiceUnavailable on mock mode, no key, cap or any API failure. */
export interface SpeakOptions { model?: string; settings?: { stability: number; similarity_boost: number; style: number } }
export async function speak(text: string, voiceId: string, opts: SpeakOptions = {}): Promise<Buffer> {
  if (currentMode() !== 'live') throw new VoiceUnavailable('LLM_MODE is mock');
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new VoiceUnavailable('ELEVENLABS_API_KEY is not set');
  if (charsUsed + text.length > maxChars()) throw new VoiceUnavailable('character cap reached');
  charsUsed += text.length; // counted before the call: a failed call may still bill
  const started = Date.now();
  try {
    const res = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: opts.model ?? model(), voice_settings: opts.settings ?? { stability: 0.5, similarity_boost: 0.75, style: 0.25 } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error('audio too short');
    return buf;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`elevenlabs failed after ${Date.now() - started} ms: ${msg.slice(0, 200)}`);
    throw new VoiceUnavailable(msg.slice(0, 200));
  }
}
