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
let chantBase = 0.9;
let warned = false;
/** Duck the chant while narration speaks, restore it afterwards. */
function applyDuck(): void {
  if (chant) chant.volume = state === 'narration' || (state === 'loading' && kindNow === 'narration') ? chantBase * DUCK : chantBase;
}
let kindNow = null as 'narration' | 'anthem' | null;

async function play(kind: 'narration' | 'anthem', id: number): Promise<void> {
  // The same narration already loading or playing: nothing to do.
  if (kind === 'narration' && kindNow === 'narration' && countryId === id && (state === 'loading' || state === 'narration')) return;
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
  setMuted(m: boolean): void { muted = m; if (el) el.muted = m; emit(); },
  getState: () => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

// War chants: a short, rate-limited reaction to war declarations and battles.
let lastChant = 0;
let chant: HTMLAudioElement | null = null;
const CHANT_GAP_MS = 6000;

function chantFor(event: WorldEvent): number[] {
  if (event.type === 'relation_changed' && event.stance === 'war') return [event.a, event.b];
  if (event.type === 'battle') return [event.attacker, event.defender];
  return [];
}

function playChants(ids: number[]): void {
  const now = Date.now();
  if (muted || now - lastChant < CHANT_GAP_MS || ids.length === 0) return;
  lastChant = now;
  const selected = useWorld.getState().selectedCountryId;
  const id = selected != null && ids.includes(selected) ? selected : ids[Math.floor(Math.random() * ids.length)]!;
  chant?.pause();
  const a = new Audio(`/api/country/${id}/chant`);
  chantBase = id === selected ? 0.9 : 0.4;
  chant = a;
  applyDuck();
  a.play().catch(() => { /* autoplay blocked or route unavailable: silent */ });
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
