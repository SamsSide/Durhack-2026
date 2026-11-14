// X6 music bus: instrumental backing music for the world's leading era, quiet under the voices.
// Files: /audio/music/<age>.mp3 (made once by server/scripts/make-era-music.ts). Played through Web Audio:
//   loop voices -> track gain (loudness trim, era crossfade) -> duck gain -> bus gain (LEVEL, on/off) -> speakers.
// Nothing plays before the first user gesture (autoplay rules) or while there is no world (the Create screen).
import type { TechAge, World } from '@terra/shared';
import { onWorldReset, useWorld } from '../state/world';

const AGES: TechAge[] = ['ancient', 'medieval', 'gunpowder', 'industrial', 'modern', 'future', 'stellar'];
/** Bus gain against the voices at 1.0, after each file is trimmed to the same loudness (TARGET_LUFS). */
export const MUSIC_LEVEL = 0.2;
/** While anyone speaks the music drops to this share of its level: 300 ms attack, 1 s release. */
export const MUSIC_DUCK = 0.3;
const ATTACK_S = 0.3;
const RELEASE_S = 1.0;
const ERA_XFADE_S = 5;            // crossfade when the leading era changes
const LOOP_XFADE_S = 3;           // overlap that hides the loop seam
const MIN_SWITCH_MS = 30_000;     // never change era track more than once per 30 s
const ON_FADE_S = 2.5;            // fade in when a world appears or music is switched on
const STORE_KEY = 'tn.music';
/** Measured integrated loudness of each file (LUFS, BS.1770 K-weighted, gated); each is trimmed to TARGET_LUFS. */
const TARGET_LUFS = -16;
const MEASURED_LUFS: Record<TechAge, number> = {
  ancient: -13.7, medieval: -13.9, gunpowder: -13.1, industrial: -13.8, modern: -16.7, future: -17.7, stellar: -16.3,
};

type Voice = { src: AudioBufferSourceNode; env: GainNode };
type Track = { age: TechAge; buffer: AudioBuffer; span: { start: number; end: number }; out: GainNode; voices: Set<Voice>; timer: number; stopped: boolean };

let enabled = readEnabled();
let globalMuted = false;
let unlocked = false;
let hasWorld = false;
let ctx = null as AudioContext | null;
let bus = null as GainNode | null;
let duckNode = null as GainNode | null;
let ducked = false;
let busOn = false;
let current = null as Track | null;
let loadingAge = null as TechAge | null;
let wantAge = null as TechAge | null;
let override = null as TechAge | null;
let lastSwitch = 0;
let gateTimer = 0;
let offTimer = 0;
const buffers = new Map<TechAge, Promise<AudioBuffer>>();
const failed = new Set<TechAge>();

function readEnabled(): boolean {
  try { return localStorage.getItem(STORE_KEY) !== 'off'; } catch { return true; }
}

const dbToGain = (db: number) => 10 ** (db / 20);
const trimFor = (age: TechAge) => Math.min(2, dbToGain(TARGET_LUFS - MEASURED_LUFS[age]));
/** Equal-power fade curves (the two sides of a crossfade are uncorrelated music). */
const curve = (from: number, to: number) => Float32Array.from({ length: 64 }, (_, i) => {
  const x = i / 63;
  return from * Math.cos((x * Math.PI) / 2) + to * Math.sin((x * Math.PI) / 2);
});

/** The most advanced age among living nations, or null when there is none. */
export function leadingAge(world: World | null): TechAge | null {
  if (!world) return null;
  let best = -1;
  for (const c of world.countries) if (c.alive) best = Math.max(best, AGES.indexOf(c.techAge ?? 'ancient'));
  return best >= 0 ? AGES[best] : null;
}

/** The part of a file that loops: skips a quiet lead-in and a fade-out tail (more than 12 dB under the median level),
 *  so the loop crossfade always joins two full-level passages. */
function loopSpan(buf: AudioBuffer): { start: number; end: number } {
  const sr = buf.sampleRate;
  const block = Math.round(sr * 0.1);
  const n = Math.floor(buf.length / block);
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const db = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let s = 0;
    for (const d of chans) for (let i = b * block; i < (b + 1) * block; i += 4) s += d[i] * d[i];
    db[b] = 10 * Math.log10(s / ((block / 4) * chans.length) + 1e-12);
  }
  const ref = Float32Array.from(db).sort()[Math.floor(n / 2)];
  let a = 0;
  while (a < n && db[a] < ref - 12) a++;
  let z = n - 1;
  while (z > a && db[z] < ref - 12) z--;
  const start = (a * block) / sr;
  const end = ((z + 1) * block) / sr;
  return end - start > 20 ? { start, end } : { start: 0, end: buf.duration };
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof AudioContext === 'undefined') return null;
  try {
    ctx = new AudioContext();
    bus = ctx.createGain();
    bus.gain.value = 0;
    duckNode = ctx.createGain();
    duckNode.gain.value = ducked ? MUSIC_DUCK : 1;
    duckNode.connect(bus).connect(ctx.destination);
  } catch (err) {
    console.warn('music unavailable (no Web Audio)', err);
    ctx = null;
  }
  return ctx;
}

const shouldPlay = () => enabled && !globalMuted && unlocked && hasWorld;

async function load(age: TechAge): Promise<AudioBuffer> {
  let p = buffers.get(age);
  if (!p) {
    const c = ctx!;
    p = fetch(`/audio/music/${age}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.arrayBuffer(); })
      .then((b) => c.decodeAudioData(b));
    buffers.set(age, p);
    p.catch(() => buffers.delete(age));
  }
  return p;
}

/** One pass through the file. Each voice schedules the next as soon as it starts, so a throttled background tab never leaves a gap. */
function scheduleVoice(track: Track, at: number, first: boolean): void {
  if (!ctx || track.stopped) return;
  const { start, end } = track.span;
  const dur = end - start;
  const x = Math.min(LOOP_XFADE_S, dur / 4);
  const src = ctx.createBufferSource();
  src.buffer = track.buffer;
  const env = ctx.createGain();
  src.connect(env).connect(track.out);
  if (first) env.gain.setValueAtTime(1, at);
  else env.gain.setValueCurveAtTime(curve(0, 1), at, x);
  env.gain.setValueCurveAtTime(curve(1, 0), at + dur - x, x);
  src.start(at, start, dur);
  const v = { src, env };
  track.voices.add(v);
  src.onended = () => { track.voices.delete(v); env.disconnect(); };
  const next = at + dur - x;
  track.timer = window.setTimeout(() => scheduleVoice(track, next, false), Math.max(0, (at - ctx.currentTime) * 1000) + 200);
}

function startTrack(age: TechAge, buffer: AudioBuffer): Track {
  const c = ctx!;
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(duckNode!);
  const t = c.currentTime + 0.05;
  out.gain.setValueCurveAtTime(curve(0, trimFor(age)), t, ERA_XFADE_S);
  const track: Track = { age, buffer, span: loopSpan(buffer), out, voices: new Set(), timer: 0, stopped: false };
  scheduleVoice(track, t, true);
  return track;
}

function stopTrack(track: Track, fadeS: number): void {
  if (!ctx) return;
  track.stopped = true;
  clearTimeout(track.timer);
  const t = ctx.currentTime;
  const g = track.out.gain;
  const from = g.value;
  g.cancelScheduledValues(t);
  g.setValueAtTime(from, t);
  if (fadeS > 0) g.setValueCurveAtTime(curve(from, 0), t, fadeS);
  for (const v of track.voices) { try { v.src.stop(t + fadeS + 0.05); } catch { /* already stopped */ } }
  window.setTimeout(() => track.out.disconnect(), (fadeS + 0.5) * 1000);
}

async function switchTo(age: TechAge): Promise<void> {
  if (!ctx || failed.has(age)) return;
  loadingAge = age;
  let buffer: AudioBuffer;
  try {
    buffer = await load(age);
  } catch (err) {
    failed.add(age);
    console.warn(`music for ${age} unavailable`, err);
    if (loadingAge === age) loadingAge = null;
    return;
  }
  if (loadingAge !== age) return;
  loadingAge = null;
  if (!shouldPlay() || wantAge !== age || current?.age === age) { sync(); return; }
  if (current) stopTrack(current, ERA_XFADE_S);
  current = startTrack(age, buffer);
  for (const k of buffers.keys()) if (k !== age) buffers.delete(k); // keep one decoded track in memory
  publish();
}

/** Bring the bus level and the playing track in line with the wanted state. */
function sync(): void {
  if (!ctx || !bus) return;
  const on = shouldPlay();
  if (on !== busOn) {
    busOn = on;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, t, on ? ON_FADE_S / 3 : 0.15);
    clearTimeout(offTimer);
    if (!on) offTimer = window.setTimeout(() => { if (!busOn && current) { stopTrack(current, 0); current = null; publish(); } }, 1500);
  }
  if (!on || !wantAge) return;
  if (current?.age !== wantAge && loadingAge !== wantAge) void switchTo(wantAge);
}

/** Follow the leading era, changing track at most once per MIN_SWITCH_MS. */
function consider(): void {
  const w = useWorld.getState().world;
  const nowWorld = w !== null;
  const lead = override ?? leadingAge(w);
  let changed = nowWorld !== hasWorld;
  hasWorld = nowWorld;
  if (lead && lead !== wantAge) {
    const wait = lastSwitch + MIN_SWITCH_MS - Date.now();
    if (wantAge === null || wait <= 0) {
      wantAge = lead; lastSwitch = Date.now(); changed = true;
    } else if (!gateTimer) {
      gateTimer = window.setTimeout(() => { gateTimer = 0; consider(); }, wait + 50);
    }
  }
  if (changed) { sync(); publish(); }
}

useWorld.subscribe(consider);
onWorldReset(() => { override = null; wantAge = null; clearTimeout(gateTimer); gateTimer = 0; consider(); });

// The first gesture unlocks audio; until then nothing is fetched or played.
function unlock(): void {
  const c = ensureContext();
  if (!c) return;
  const done = () => {
    if (c.state !== 'running') return;
    unlocked = true;
    for (const ev of GESTURES) window.removeEventListener(ev, unlock, true);
    consider();
    sync();
    publish();
  };
  if (c.state === 'running') done(); else c.resume().then(done, () => { /* still blocked: wait for the next gesture */ });
}
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;
if (typeof window !== 'undefined') for (const ev of GESTURES) window.addEventListener(ev, unlock, { capture: true, passive: true });

const changeListeners = new Set<() => void>();
function publish(): void { changeListeners.forEach((l) => l()); }

export const music = {
  enabled: () => enabled,
  setEnabled(on: boolean): void {
    enabled = on;
    try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch { /* private mode: not remembered */ }
    if (on) unlock();
    sync();
    publish();
  },
  /** The X6 mute silences the music too. */
  setGlobalMuted(m: boolean): void { globalMuted = m; sync(); },
  /** True while narration, an anthem, a chant, the decree herald or the news bulletin is playing. */
  setDucked(on: boolean): void {
    if (on === ducked) return;
    ducked = on;
    if (!ctx || !duckNode) return;
    const t = ctx.currentTime;
    duckNode.gain.cancelScheduledValues(t);
    duckNode.gain.setTargetAtTime(on ? MUSIC_DUCK : 1, t, (on ? ATTACK_S : RELEASE_S) / 3);
  },
  onChange(l: () => void): () => void { changeListeners.add(l); return () => { changeListeners.delete(l); }; },
};

// Dev only: lets a browser review read the bus and force an era (window.__music).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __music?: object }).__music = {
    info: () => ({
      enabled, unlocked, hasWorld, ducked, wantAge, playing: current?.age ?? null, loading: loadingAge, ctx: ctx?.state ?? null,
      bus: bus?.gain.value ?? null, duck: duckNode?.gain.value ?? null, track: current?.out.gain.value ?? null, voices: current?.voices.size ?? 0,
      position: current && ctx ? ctx.currentTime : null,
    }),
    /** Force an era (null returns to the world's leading era); bypasses the 30 s gate. */
    force(age: TechAge | null): void { override = age; wantAge = null; consider(); },
  };
}
