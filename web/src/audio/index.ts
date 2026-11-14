// X6: sound. Narration, anthem and automatic war chants, all fetched from the X3 routes; era music under them (music.ts).
import { useWorld } from '../state/world';
import type { WorldEvent } from '@terra/shared';
import { music } from './music';

export type AudioState = 'idle' | 'loading' | 'narration' | 'anthem' | 'broadcast';

let state = 'idle' as AudioState;
let countryId = null as number | null;
let muted = false;
let el: HTMLAudioElement | null = null;
let token = 0;
let snapshot: { state: AudioState; countryId: number | null; muted: boolean; music: boolean } = { state, countryId, muted, music: music.enabled() };
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { state, countryId, muted, music: music.enabled() };
  listeners.forEach((l) => l());
  duckMusic();
}
music.onChange(() => { if (snapshot.music !== music.enabled()) emit(); });

/** The era music ducks while anyone speaks: narration, an anthem, a chant, the decree herald or the news bulletin. */
function duckMusic(): void {
  music.setDucked(herald !== null || chants.size > 0 || state === 'narration' || state === 'anthem' || state === 'broadcast');
}

function halt(): void {
  token++;
  detachAnalyser();
  if (el) { el.pause(); el.src = ''; el = null; }
}

// The news anchor's lip-sync reads the playing bulletin through one shared AnalyserNode.
// The clip is only routed through Web Audio once the context is really running, so a
// blocked or missing AudioContext can never silence a bulletin: it just plays directly.
let actx = null as AudioContext | null;
let analyser = null as AnalyserNode | null;
let tapped = null as { el: HTMLAudioElement; node: MediaElementAudioSourceNode } | null;

function detachAnalyser(): void {
  if (!tapped) return;
  try { tapped.node.disconnect(); } catch { /* already gone */ }
  tapped = null;
}

async function attachAnalyser(a: HTMLAudioElement, mine: number): Promise<void> {
  try {
    if (typeof AudioContext === 'undefined') return;
    actx ??= new AudioContext();
    if (actx.state !== 'running') {
      await Promise.race([actx.resume(), new Promise<void>((r) => setTimeout(r, 400))]);
    }
    if (actx.state !== 'running' || mine !== token || el !== a) return;
    if (!analyser) {
      analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      analyser.connect(actx.destination);
    }
    const node = actx.createMediaElementSource(a);
    node.connect(analyser);
    tapped = { el: a, node };
  } catch (err) {
    console.warn('bulletin analyser unavailable, the anchor mimes instead', err);
  }
}

const DUCK = 0.15;
let warned = false;
/** Duck the chant while narration speaks, restore it afterwards. */
function applyDuck(): void {
  const ducked = herald !== null || state === 'narration' || state === 'broadcast' || (state === 'loading' && (kindNow === 'narration' || kindNow === 'broadcast'));
  for (const c of chants) c.el.volume = ducked ? c.base * DUCK : c.base;
  duckMusic();
}
// The decree herald: its own element, so it never changes the X6 state; it only ducks chants.
let herald = null as HTMLAudioElement | null;
function stopHerald(): void {
  if (herald) { herald.pause(); herald.src = ''; herald = null; applyDuck(); }
}
let kindNow = null as 'narration' | 'anthem' | 'broadcast' | null;
let urlNow = null as string | null;

async function play(kind: 'narration' | 'anthem' | 'broadcast', id: number | null, url?: string): Promise<void> {
  // The same bulletin already loading or playing: nothing to do.
  if (kind === 'broadcast' && kindNow === 'broadcast' && urlNow === url && (state === 'loading' || state === 'broadcast')) return;
  // The same narration already loading or playing: nothing to do.
  if (kind === 'narration' && kindNow === 'narration' && countryId === id && (state === 'loading' || state === 'narration')) return;
  // An anthem is slow to generate the first time: a second press while it loads is a no-op.
  if (kind === 'anthem' && kindNow === 'anthem' && countryId === id && state === 'loading') return;
  stopHerald();
  halt();
  kindNow = kind; urlNow = kind === 'broadcast' ? url ?? null : null;
  const mine = token;
  state = 'loading'; countryId = id; applyDuck(); emit();
  const a = new Audio(url ?? `/api/country/${id}/${kind}`);
  a.muted = muted;
  el = a;
  a.onended = () => { if (mine === token) { detachAnalyser(); state = 'idle'; countryId = null; el = null; kindNow = null; applyDuck(); emit(); } };
  try {
    await a.play();
    if (mine === token) { state = kind; applyDuck(); emit(); }
    if (mine === token && kind === 'broadcast') void attachAnalyser(a, mine);
  } catch (err) {
    if (mine === token) {
      // A 503 (voice unavailable) is normal: the panel shows text only. Log it once.
      if (!warned) { warned = true; console.warn(`${kind} unavailable, showing text only`, err); }
      state = 'idle'; countryId = null; el = null; kindNow = null; applyDuck(); emit();
    }
  }
}

export const audio = {
  playNarration: (id: number) => play('narration', id),
  playAnthem: (id: number) => play('anthem', id),
  playBroadcast: (audioUrl: string) => play('broadcast', null, audioUrl),
  stop(): void { stopHerald(); halt(); state = 'idle'; countryId = null; kindNow = null; applyDuck(); emit(); },
  setMuted(m: boolean): void {
    muted = m; if (el) el.muted = m;
    music.setGlobalMuted(m);
    if (m) stopHerald();
    if (m) { for (const c of chants) c.el.pause(); chants.clear(); }
    emit();
  },
  /** Era music on or off (remembered in localStorage; on by default). It still waits for a gesture and a world. */
  setMusicEnabled(on: boolean): void { music.setEnabled(on); emit(); },
  /** The analyser on the bulletin that is playing now, or null (not playing, muted, or Web Audio unavailable). */
  broadcastAnalyser(): AnalyserNode | null {
    return state === 'broadcast' && !muted && tapped !== null && tapped.el === el ? analyser : null;
  },
  getState: () => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

// War chants: a short, rate-limited reaction to war declarations and battles.
let lastChant = 0;
const chants = new Set<{ el: HTMLAudioElement; base: number }>();
const CHANT_GAP_MS = 6000;
/** The second side's chant starts this long after the first begins (so they overlap slightly), or when it ends. */
const OVERLAP_S = 0.6;

function chantFor(event: WorldEvent): number[] {
  if (event.type === 'relation_changed' && event.stance === 'war') return [event.a, event.b];
  if (event.type === 'battle') return [event.attacker, event.defender];
  return [];
}

function startChant(id: number, base: number, onNearEnd?: () => void): void {
  const a = new Audio(`/api/country/${id}/chant`);
  const entry = { el: a, base };
  chants.add(entry);
  a.volume = base;
  const drop = () => { chants.delete(entry); duckMusic(); };
  let fired = false;
  const next = () => { if (!fired) { fired = true; onNearEnd?.(); } };
  a.ontimeupdate = () => { if (a.duration && a.currentTime >= a.duration - OVERLAP_S) next(); };
  a.onended = () => { drop(); next(); };
  a.onerror = () => { drop(); next(); };
  applyDuck();
  a.play().catch(() => { drop(); next(); /* autoplay blocked or route unavailable: silent */ });
}

function playChants(ids: number[]): void {
  const now = Date.now();
  if (muted || now - lastChant < CHANT_GAP_MS || ids.length === 0) return;
  lastChant = now;
  const selected = useWorld.getState().selectedCountryId;
  for (const c of chants) { c.el.pause(); }
  chants.clear();
  // Both sides, one after the other; the selected nation's chant comes first and louder.
  const order = [...new Set(ids)].sort((x, y) => Number(y === selected) - Number(x === selected));
  const volume = (id: number) => (selected != null && id === selected ? 0.9 : selected != null ? 0.4 : 0.6);
  const run = (i: number): void => {
    const id = order[i];
    if (id === undefined || muted) return;
    startChant(id, volume(id), () => run(i + 1));
  };
  run(0);
}

let seen: WorldEvent | undefined;
useWorld.subscribe((s) => {
  const list = s.recentEvents;
  const last = list[list.length - 1];
  if (!last || last === seen) return;
  const from = seen ? list.lastIndexOf(seen) : -1;
  seen = last;
  const fresh = from >= 0 ? list.slice(from + 1) : list.slice(-10);
  for (const e of fresh) {
    const ids = chantFor(e);
    if (ids.length) { playChants(ids); break; }
  }
});

/** Read a decree aloud (once per entry). Skipped when muted, when a herald speaks, or when narration, an anthem or a bulletin plays or loads. */
const heard = new Set<string>();
function playHerald(entryId: string): void {
  if (heard.has(entryId)) return;
  heard.add(entryId);
  if (muted || herald || state !== 'idle') return;
  const a = new Audio(`/api/decree/${encodeURIComponent(entryId)}/herald`);
  a.volume = 0.9;
  herald = a;
  const done = () => { if (herald === a) { herald = null; applyDuck(); } };
  a.onended = done;
  a.onerror = done;
  applyDuck();
  a.play().catch(done); // autoplay blocked or voice unavailable: silent
}

useWorld.subscribe((s) => {
  const list = s.recentEvents;
  if (list.length === 0) heard.clear(); // a new world: its entry ids start again
  for (const e of list.slice(-10)) {
    // A decree's own line has the plain id c-decree-N; its consequence line ends in -b.
    if (e.type === 'chronicle' && e.entry.kind === 'decree' && !e.entry.id.endsWith('-b')) playHerald(e.entry.id);
  }
});
