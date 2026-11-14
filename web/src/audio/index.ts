// X6: sound. Narration, anthem and automatic war chants, all fetched from the X3 routes.
import { useWorld } from '../state/world';
import type { WorldEvent } from '@terra/shared';

export type AudioState = 'idle' | 'loading' | 'narration' | 'anthem';

let state = 'idle' as AudioState;
let countryId = null as number | null;
let muted = false;
let el: HTMLAudioElement | null = null;
let token = 0;
let snapshot: { state: AudioState; countryId: number | null; muted: boolean } = { state, countryId, muted };
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { state, countryId, muted };
  listeners.forEach((l) => l());
}

function halt(): void {
  token++;
  if (el) { el.pause(); el.src = ''; el = null; }
}

const DUCK = 0.15;
let warned = false;
/** Duck the chant while narration speaks, restore it afterwards. */
function applyDuck(): void {
  const ducked = state === 'narration' || (state === 'loading' && kindNow === 'narration');
  for (const c of chants) c.el.volume = ducked ? c.base * DUCK : c.base;
}
let kindNow = null as 'narration' | 'anthem' | null;

async function play(kind: 'narration' | 'anthem', id: number): Promise<void> {
  // The same narration already loading or playing: nothing to do.
  if (kind === 'narration' && kindNow === 'narration' && countryId === id && (state === 'loading' || state === 'narration')) return;
  // An anthem is slow to generate the first time: a second press while it loads is a no-op.
  if (kind === 'anthem' && kindNow === 'anthem' && countryId === id && state === 'loading') return;
  halt();
  kindNow = kind;
  const mine = token;
  state = 'loading'; countryId = id; applyDuck(); emit();
  const a = new Audio(`/api/country/${id}/${kind}`);
  a.muted = muted;
  el = a;
  a.onended = () => { if (mine === token) { state = 'idle'; countryId = null; el = null; kindNow = null; applyDuck(); emit(); } };
  try {
    await a.play();
    if (mine === token) { state = kind; applyDuck(); emit(); }
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
  stop(): void { halt(); state = 'idle'; countryId = null; kindNow = null; applyDuck(); emit(); },
  setMuted(m: boolean): void {
    muted = m; if (el) el.muted = m;
    if (m) { for (const c of chants) c.el.pause(); chants.clear(); }
    emit();
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
  const drop = () => { chants.delete(entry); };
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
