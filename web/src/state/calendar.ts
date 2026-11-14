// The time inside a year. The simulation steps one year at a time (X2 `tick`); between two ticks the
// client works out how far through the year the world is, the same way the server clock banks time:
// 2 * speed years a second at the effective speed, nothing while paused. It never runs ahead of the
// next tick (it waits at the end of December) and starts again from zero on every tick.
// Kept out of the store on purpose: it changes every frame, so readers ask for it (useFrame, rAF).
import { useWorld } from './world';

export const BASE_YEARS_PER_SEC = 2;
export const MIN_SPEED = 1 / 104;
export const MAX_SPEED = 5;
const ALMOST = 0.9999;

let frac = 0;                 // 0..1 through the current year
let last = performance.now();
let speed = 1;
let paused = false;
let tick = -1;
let worldRef: unknown = null;

function read(): { speed: number; paused: boolean } {
  const s = useWorld.getState();
  return { speed: s.clock?.speed ?? s.world?.speed ?? 1, paused: s.clock?.paused ?? s.world?.paused ?? false };
}

function accrue(now: number): void {
  const dt = Math.min(Math.max(0, now - last), 5000);
  last = now;
  if (!paused) frac = Math.min(ALMOST, frac + (dt / 1000) * BASE_YEARS_PER_SEC * speed);
}

useWorld.subscribe((s) => {
  const now = performance.now();
  accrue(now);                               // bank the time so far at the old speed
  ({ speed, paused } = read());
  const t = s.world?.tick ?? -1;
  if (s.world !== worldRef || t !== tick) { worldRef = s.world; tick = t; frac = 0; }
});

/** How far through the current year the world is, 0 (the tick just rang) to just under 1. */
export function yearFraction(now = performance.now()): number {
  accrue(now);
  return frac;
}

/** The effective speed and pause, as the server last reported them. */
export function clockNow(): { speed: number; paused: boolean } { return { speed, paused }; }

/** Real milliseconds one year (one tick) takes at the effective speed. */
export function msPerYear(): number {
  return 1000 / (BASE_YEARS_PER_SEC * Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed)));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** The month (0 to 11) and the day of it for a fraction of a year. */
export function monthDay(f: number): { month: number; name: string; day: number } {
  const m = Math.min(11, Math.max(0, Math.floor(f * 12)));
  const within = Math.min(ALMOST, Math.max(0, f * 12 - m));
  return { month: m, name: MONTHS[m]!, day: 1 + Math.floor(within * DAYS[m]!) };
}
