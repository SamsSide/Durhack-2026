// Live beacons on the globe plus a short history of stories for the spotlight tour. Lane b.
import { create } from 'zustand';
import type { P3 } from '../status/geo';
import type { Story } from './kinds';

export const MAX_BEACONS = 12;
export const PILLAR_MS = 2000;
export const LIFE_MS = 27000;      // 2 s big with a light pillar, then ~25 s small, fading at the end
const MERGE_COS = Math.cos(0.12);  // same kind within ~0.12 rad (a few tiles) joins one beacon
const ATTACH_MS = 5000;            // a chronicle decree this soon after a decree beacon names it

export interface Beacon extends Story { key: string; pos: P3; born: number; count: number; gen: number }

export const useBeacons = create<{ beacons: Beacon[] }>(() => ({ beacons: [] }));

const listeners = new Set<(s: Story) => void>();
const history: Story[] = [];
let seq = 0;
let lastDecree: { key: string; story: Story; at: number } | null = null;

export function onStory(l: (s: Story) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function recentStories(withinMs: number): Story[] {
  const now = performance.now();
  return history.filter((s) => now - s.at < withinMs);
}

const unit = (p: P3): P3 => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };

export function pushStory(story: Story, pos: P3): void {
  const now = performance.now();
  const list = useBeacons.getState().beacons.slice();

  if (story.attach && lastDecree && now - lastDecree.at < ATTACH_MS) {
    const ld = lastDecree;
    ld.story.sub = story.title; // the spotlight caption reads the same object
    const i = list.findIndex((b) => b.key === ld.key);
    if (i >= 0) { list[i] = { ...list[i]!, sub: story.title }; useBeacons.setState({ beacons: list }); }
    return;
  }

  const u = unit(pos);
  const i = list.findIndex((b) => {
    if (b.kind !== story.kind || now - b.born > LIFE_MS) return false;
    const v = unit(b.pos);
    return v[0] * u[0] + v[1] * u[1] + v[2] * u[2] > MERGE_COS;
  });
  let key: string;
  if (i >= 0) {
    const b = list[i]!;
    key = b.key;
    list[i] = { ...b, ...story, key, pos, born: now, count: b.count + 1, gen: b.gen + 1 };
  } else {
    key = `ev${seq++}`;
    list.push({ ...story, key, pos, born: now, count: 1, gen: 0 });
    while (list.length > MAX_BEACONS) list.shift();
  }
  useBeacons.setState({ beacons: list });

  if (story.kind === 'decree') lastDecree = { key, story, at: now };
  history.push(story);
  while (history.length > 40) history.shift();
  for (const l of listeners) l(story);
}

export function pruneBeacons(): void {
  const now = performance.now();
  const list = useBeacons.getState().beacons;
  const keep = list.filter((b) => now - b.born < LIFE_MS);
  if (keep.length !== list.length) useBeacons.setState({ beacons: keep });
}

export function clearBeacons(): void {
  history.length = 0;
  lastDecree = null;
  useBeacons.setState({ beacons: [] });
}
