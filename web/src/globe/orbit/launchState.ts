// Shared between Orbit.tsx (draws the satellites) and Launch.tsx (flies them up): each nation's orbit
// ring, how many satellites are up this session, and the phase of each one. A nation that already has
// satellites up (`Country.satellites`, from the modern age on, #317) when a world arrives starts with
// them; any later satellite only appears when its rocket delivers it (#291). Lane b.
import * as THREE from 'three';
import type { World } from '@terra/shared';

export const ORBIT_R = 1.24;
export const PERIOD_S = 70;
/** Most satellites drawn per nation (the sim keeps at most MAX_SATELLITES = 4 up). */
export const MAX_SLOTS = 4;

export interface Ring { u: THREE.Vector3; v: THREE.Vector3; speed: number; matrix: THREE.Matrix4 }

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** The tilted circular orbit of one nation: its plane holds the capital direction (angle 0 = over the capital). */
export function ringFor(world: World, id: number): Ring {
  const c = world.countries[id];
  const t = c ? world.tiles[c.capitalTile] : undefined;
  const cap = t ? new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize() : new THREE.Vector3(1, 0, 0);
  const ref = Math.abs(cap.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(cap, ref).normalize();
  const up = new THREE.Vector3().crossVectors(side, cap).normalize();
  const tilt = (0.35 + hash(id) * 1.0) * (hash(id + 9) < 0.5 ? -1 : 1);
  const v = side.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(up, Math.sin(tilt)).normalize();
  const n = new THREE.Vector3().crossVectors(cap, v).normalize();
  const matrix = new THREE.Matrix4().makeBasis(cap, v, n).scale(new THREE.Vector3(ORBIT_R, ORBIT_R, ORBIT_R));
  return { u: cap, v, speed: 1 + hash(id + 3) * 0.3, matrix };
}

/** Angular speed of a ring in radians per second of clock time. */
export const omega = (r: Ring): number => (Math.PI * 2 * r.speed) / PERIOD_S;

/** Where a satellite on `r` at `angle` sits. */
export function ringPos(r: Ring, angle: number, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(r.u).multiplyScalar(Math.cos(angle) * ORBIT_R).addScaledVector(r.v, Math.sin(angle) * ORBIT_R);
}

// ---- satellites up this session -----------------------------------------------------------------

let worldId: string | null = null;
const phases = new Map<number, number[]>();   // nation -> one phase per satellite up
let rev = 0;
const subs = new Set<() => void>();
const bump = () => { rev++; for (const f of subs) f(); };

/** A different world resets the count: every nation gets the satellites it already has up, spread round its ring. */
export function syncWorld(world: World | null): void {
  const id = world?.id ?? null;
  if (id === worldId) return;
  worldId = id;
  phases.clear();
  world?.countries.forEach((c, i) => { const n = Math.min(MAX_SLOTS, c.satellites ?? 0); if (n > 0) phases.set(i, Array.from({ length: n }, (_, k) => (k * Math.PI * 2) / n)); });
  bump();
}

/** The phase of each satellite a nation has up (empty when none). */
export const satPhases = (id: number): readonly number[] => phases.get(id) ?? [];
export const satNations = (): number[] => [...phases.keys()];

/** The rocket hands its satellite over: from now on Orbit draws it at `phase`. False when the nation is full. */
export function deliver(id: number, phase: number): boolean {
  const list = phases.get(id) ?? [];
  if (list.length >= MAX_SLOTS) return false;
  list.push(phase);
  phases.set(id, list);
  bump();
  return true;
}

export function subscribe(f: () => void): () => void { subs.add(f); return () => { subs.delete(f); }; }
export const revision = (): number => rev;
