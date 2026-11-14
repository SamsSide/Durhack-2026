// Makes the backing music for each era once, offline, with the ElevenLabs Music API (X6 music bus).
// Instrumental only (force_instrumental), cinematic, written to loop; the client crossfades the loop seam.
// Run from the repo root (keys never printed):
//   set -a; . ~/.config/durhack/keys.env; set +a; npx tsx server/scripts/make-era-music.ts [age ...] [--force]
// An existing file is skipped unless --force is given: each track costs music credits from the shared budget.
// Docs: https://elevenlabs.io/docs/api-reference/music/compose
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TechAge } from '@terra/shared';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'public', 'audio', 'music');
const LENGTH_MS = 105_000;
const FORMAT = 'mp3_44100_96';
const model = () => process.env.ELEVEN_MUSIC_MODEL || 'music_v1';

const COMMON = 'Cinematic instrumental underscore for a grand strategy game, original composition. '
  + 'Steady and unobtrusive so it can sit under spoken narration: no sudden hits, no long silences, no solo that steals focus. '
  + 'A seamless loop: it starts already in motion and ends mid-phrase in the same key, tempo and texture it began with, no intro swell and no final cadence or fade-out.';

const PROMPTS: Record<TechAge, string> = {
  ancient: 'Ancient era. Frame drums and hand percussion in a slow processional rhythm, a plucked lyre carrying a modal melody, '
    + 'low sustained horns and a deep drone, a reed flute answering from far away. Warm, earthy, ceremonial, about 80 BPM, D dorian.',
  medieval: 'Medieval era. A string ensemble with a wordless choir pad humming sustained chords, a lute picking a gentle ostinato, '
    + 'soft timpani rolls and a distant hand bell. Noble, pastoral and a little solemn, about 84 BPM, E minor.',
  gunpowder: 'Age of gunpowder and sail. Baroque string orchestra playing a driving continuo figure with harpsichord, a crisp military snare, '
    + 'natural trumpets and horns in measured fanfare phrases. Stately, confident, adventurous, about 96 BPM, G major with minor turns.',
  industrial: 'Industrial era. Full symphony orchestra with heavy low brass, striking metallic anvil-like percussion on the off-beats, '
    + 'churning cello and bass ostinato like machinery, a broad horn theme above. Determined, proud, smoky, about 92 BPM, C minor.',
  modern: 'Modern era. Hybrid orchestral score: tight string ostinatos and warm brass swells over a pulsing synth bass and soft electronic percussion, '
    + 'a hopeful piano motif. Tense but optimistic, global, about 100 BPM, A minor.',
  future: 'Near future. Wide analog synth pads, arpeggiated synth pulses in stereo, a deep sub bass, light glitch percussion and airy textures, '
    + 'a slow glassy lead melody. Sleek, expansive, curious, about 98 BPM, F sharp minor.',
  stellar: 'Interstellar age. Vast ethereal ambience: slow evolving pads, shimmering high strings, a soft wordless choir texture without words, '
    + 'distant chimes and long reverb tails, very slow pulse. Awe, weightlessness, deep space, about 60 BPM, E lydian.',
};

const AGES = Object.keys(PROMPTS) as TechAge[];
const exists = (p: string) => fs.access(p).then(() => true, () => false);

async function credits(key: string): Promise<number | null> {
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } });
    if (!res.ok) return null;
    const j = await res.json() as { character_count?: number };
    return typeof j.character_count === 'number' ? j.character_count : null;
  } catch { return null; }
}

async function make(age: TechAge, key: string): Promise<void> {
  const file = path.join(OUT_DIR, `${age}.mp3`);
  const started = Date.now();
  const res = await fetch(`https://api.elevenlabs.io/v1/music?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ model_id: model(), prompt: `${COMMON} ${PROMPTS[age]}`, music_length_ms: LENGTH_MS, force_instrumental: true }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`${age}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 50_000) throw new Error(`${age}: audio too short (${buf.length} bytes)`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, file);
  const extra = [...res.headers].filter(([k]) => /cost|credit|song-id/i.test(k)).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`${age}: ${(buf.length / 1e6).toFixed(2)} MB in ${((Date.now() - started) / 1000).toFixed(0)} s ${extra}`.trim());
}

async function main(): Promise<void> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set (source ~/.config/durhack/keys.env first)');
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const wanted = args.filter((a) => !a.startsWith('--')) as TechAge[];
  const bad = wanted.filter((a) => !AGES.includes(a));
  if (bad.length) throw new Error(`unknown age: ${bad.join(', ')} (one of ${AGES.join(', ')})`);
  await fs.mkdir(OUT_DIR, { recursive: true });
  const before = await credits(key);
  for (const age of wanted.length ? wanted : AGES) {
    const file = path.join(OUT_DIR, `${age}.mp3`);
    if (!force && await exists(file)) { console.log(`${age}: exists, skipped (use --force to remake)`); continue; }
    try { await make(age, key); } catch (e) { console.warn(`FAILED ${e instanceof Error ? e.message : String(e)}`); }
  }
  const after = await credits(key);
  if (before !== null && after !== null) console.log(`credits used: ${after - before}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
