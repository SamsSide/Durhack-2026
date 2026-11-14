// The weather systems behind the clouds and the rain: a few drifting fronts that are a pure function
// of the world seed and tick (every viewer sees the same sky), plus short-lived storms raised by
// `storm` and `flood` decrees. Visual only: nothing here changes the world.
import * as THREE from 'three';
import { countryTiles, mulberry32 } from '@terra/shared';
import type { World, WorldEvent } from '@terra/shared';

export const MAX_SYS = 8;
const FRONTS = 5; // slots 0..4; decree storms take 5..7
const STORM_LIFE = 28; // seconds of real time
const FLOOD_LIFE = 22;

export interface WeatherSystem {
  center: THREE.Vector3;
  radius: number;    // chord radius on the unit sphere (about radians)
  intensity: number; // 0 clear .. 1 heavy, dark cloud
  rain: number;      // 0..1
  storm: number;     // 0..1 spiral strength
  spin: number;      // radians the spiral has turned
  flashPos: THREE.Vector3;
  flash: number;     // lightning brightness right now
}

export const systems: WeatherSystem[] = Array.from({ length: MAX_SYS }, () => ({
  center: new THREE.Vector3(0, 1, 0), radius: 0, intensity: 0, rain: 0, storm: 0, spin: 0,
  flashPos: new THREE.Vector3(0, 1, 0), flash: 0,
}));

interface Front { axis: THREE.Vector3; start: THREE.Vector3; speed: number; radius: number; phase: number; rate: number }
interface Storm { center: THREE.Vector3; kind: 'storm' | 'flood'; born: number; slot: number }
interface Flasher { next: number; at: number }

let frontsFor: string | null = null;
let fronts: Front[] = [];
const storms: Storm[] = [];
const flashers: Flasher[] = Array.from({ length: MAX_SYS }, () => ({ next: 0, at: -10 }));

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function buildFronts(world: World): void {
  const rng = mulberry32((world.seed ^ 0x51ed270b) >>> 0);
  const unit = (): THREE.Vector3 => {
    const z = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    return new THREE.Vector3(r * Math.cos(a), z * 0.8, r * Math.sin(a)).normalize();
  };
  fronts = Array.from({ length: FRONTS }, () => ({
    axis: new THREE.Vector3(rng() * 0.8 - 0.4, 1, rng() * 0.8 - 0.4).normalize(),
    start: unit(),
    speed: (0.0012 + rng() * 0.0018) * (rng() < 0.25 ? -1 : 1), // radians per tick
    radius: 0.24 + rng() * 0.16,
    phase: rng() * Math.PI * 2,
    rate: 0.004 + rng() * 0.006,
  }));
  frontsFor = world.id;
}

/** Where a decree's weather sits: the nation's coast for a storm, its lowest land for a flood. */
function strikePoint(world: World, countryId: number, kind: 'storm' | 'flood'): THREE.Vector3 | null {
  const owned = countryTiles(world, countryId);
  if (!owned.length) return null;
  let pool: number[];
  if (kind === 'storm') {
    const coast = owned.filter((t) => world.tiles[t]!.terrain === 'coast');
    pool = coast.length ? coast : owned;
  } else {
    pool = [...owned].sort((a, b) => world.tiles[a]!.elevation - world.tiles[b]!.elevation).slice(0, Math.max(3, Math.ceil(owned.length * 0.3)));
  }
  const mean = new THREE.Vector3();
  for (const t of pool) { const c = world.tiles[t]!.center; mean.x += c[0]; mean.y += c[1]; mean.z += c[2]; }
  if (mean.lengthSq() < 1e-9) mean.set(...world.tiles[pool[0]!]!.center);
  mean.normalize();
  // Snap to the nearest tile of the pool so the eye sits on real coast, not in the middle of an island.
  let best = pool[0]!, bestDot = -2;
  for (const t of pool) {
    const c = world.tiles[t]!.center;
    const d = (c[0] * mean.x + c[1] * mean.y + c[2] * mean.z) / Math.hypot(c[0], c[1], c[2]);
    if (d > bestDot) { bestDot = d; best = t; }
  }
  return new THREE.Vector3(...world.tiles[best]!.center).normalize().lerp(mean, 0.35).normalize();
}

/** Raise a storm or flood system over a nation (also used by the dev hook). */
export function raiseStorm(world: World, countryId: number, kind: 'storm' | 'flood', now: number): boolean {
  const center = strikePoint(world, countryId, kind);
  if (!center) return false;
  const used = new Set(storms.map((s) => s.slot));
  let slot = -1;
  for (let i = FRONTS; i < MAX_SYS; i++) if (!used.has(i)) { slot = i; break; }
  if (slot < 0) { slot = storms.shift()!.slot; } // all busy: the oldest gives way
  storms.push({ center, kind, born: now, slot });
  flashers[slot]!.next = now + 2.5;
  return true;
}

// The consequence line of a decree is written by the engine, so it names the effect reliably
// (the decree's own words go through an LLM in live mode and may not contain "storm").
const STORM_RE = /^A great storm (batters|lashes)/;
const FLOOD_RE = /^The waters rise over/;
const seen = new Set<string>();
let lastEvents: WorldEvent[] | null = null;
let primedFor: string | null = null;

/** Look at the new events for storm and flood decrees. Call once a frame; cheap when nothing changed. */
export function watchDecrees(world: World, events: WorldEvent[], now: number): void {
  if (events === lastEvents) return;
  lastEvents = events;
  const prime = primedFor !== world.id; // do not replay what was already there when we mounted
  if (prime) { primedFor = world.id; seen.clear(); storms.length = 0; }
  for (const e of events) {
    if (e.type !== 'chronicle' || e.entry.kind !== 'decree' || !e.entry.id.endsWith('-b')) continue;
    const key = `${e.id}:${e.tick}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (prime) continue;
    const kind = STORM_RE.test(e.entry.text) ? 'storm' : FLOOD_RE.test(e.entry.text) ? 'flood' : null;
    const cid = e.entry.countries[0];
    if (kind && cid != null) raiseStorm(world, cid, kind, now);
  }
  if (seen.size > 2000) seen.clear();
}

function flicker(i: number, now: number, power: number, gapLo: number, gapHi: number): void {
  const s = systems[i]!, f = flashers[i]!;
  if (power <= 0.05) { s.flash = 0; return; }
  if (now >= f.next) {
    f.at = now;
    f.next = now + gapLo + Math.random() * (gapHi - gapLo);
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s.radius * 0.6;
    const t1 = new THREE.Vector3(0, 1, 0).cross(s.center);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    const t2 = new THREE.Vector3().crossVectors(s.center, t1);
    s.flashPos.copy(s.center).addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize();
  }
  const age = now - f.at;
  const second = age > 0.11 ? 0.7 * Math.exp(-(age - 0.11) * 16) : 0;
  s.flash = power * Math.min(1, Math.exp(-age * 11) + second);
}

/** Recompute every system for this frame. `tick` is the smoothed world tick, `now` is seconds. */
export function updateWeather(world: World | null, tick: number, now: number): void {
  if (!world) { for (const s of systems) { s.radius = 0; s.intensity = 0; s.rain = 0; s.storm = 0; s.flash = 0; } return; }
  if (frontsFor !== world.id) buildFronts(world);
  for (let i = 0; i < FRONTS; i++) {
    const f = fronts[i]!, s = systems[i]!;
    s.center.copy(f.start).applyAxisAngle(f.axis, f.speed * tick);
    s.radius = f.radius;
    s.intensity = Math.min(1, Math.max(0, 0.55 + 0.5 * Math.sin(f.phase + tick * f.rate)));
    s.rain = smooth(0.55, 0.85, s.intensity);
    s.storm = 0; s.spin = 0;
    // A front at its very peak turns thundery: the rare natural storm.
    flicker(i, now, s.intensity > 0.96 ? 0.5 : 0, 1.2, 4.5);
  }
  for (let i = FRONTS; i < MAX_SYS; i++) { const s = systems[i]!; s.radius = 0; s.intensity = 0; s.rain = 0; s.storm = 0; s.flash = 0; }
  for (let k = storms.length - 1; k >= 0; k--) {
    const st = storms[k]!;
    const life = st.kind === 'storm' ? STORM_LIFE : FLOOD_LIFE;
    const t = now - st.born;
    if (t > life) { storms.splice(k, 1); continue; }
    const env = smooth(0, 4.5, t) * smooth(life, life - 6.5, t);
    const s = systems[st.slot]!;
    s.center.copy(st.center);
    if (st.kind === 'storm') {
      s.radius = 0.2 + 0.08 * env; s.intensity = env; s.rain = env; s.storm = env; s.spin = t * 0.32;
      flicker(st.slot, now, env > 0.35 ? env : 0, 0.35, 1.9);
    } else {
      s.radius = 0.17 + 0.06 * env; s.intensity = env * 0.8; s.rain = env; s.storm = 0; s.spin = 0;
      flicker(st.slot, now, 0, 1, 2);
    }
  }
}

/** True while any decree storm is alive (the quality fallback and the dev hook read it). */
export const stormActive = (): boolean => storms.length > 0;
