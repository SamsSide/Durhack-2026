// How each kind of figure moves: the marching step of foot soldiers, the canter of horses, the rumble
// of vehicles, the float of hover tanks and drones, the stomp of a mech. The models are static meshes,
// so the motion is a small pose (lift, lean, sway, a breath) laid over each instance's matrix in the
// existing update loop: no extra draw calls, nothing allocated per frame. Kept in one place so the
// armies, the fleets, the traders and the news picture-in-picture all move the same way. Lane a in
// lane b's globe (owner request, 14 Nov: troops that look alive).
import type { FormationRole } from './unitModels';

export const enum Gait { Foot, Canter, Wheel, Vehicle, Hover, Stomp, Drone }

/** One figure's pose this frame, laid over where it stands. Lengths are in figure sizes, angles in radians. */
export interface Pose { lift: number; fwd: number; pitch: number; roll: number; sy: number }
export const POSE: Pose = { lift: 0, fwd: 0, pitch: 0, roll: 0, sy: 1 };

// Roles by age index (ancient, medieval, gunpowder, industrial, modern, future, stellar), from the
// contract: spearmen, chariot, archers; men-at-arms, knight, trebuchet; musketeers, dragoon, cannon;
// riflemen, armoured car, field gun; infantry, tank, self-propelled gun; troopers, hover tank, drone
// launcher; walker infantry, mech, orbital-strike beacon.
const FRONT: readonly Gait[] = [Gait.Foot, Gait.Foot, Gait.Foot, Gait.Foot, Gait.Foot, Gait.Foot, Gait.Stomp];
const FLANK: readonly Gait[] = [Gait.Canter, Gait.Canter, Gait.Canter, Gait.Vehicle, Gait.Vehicle, Gait.Hover, Gait.Stomp];
const BACK: readonly Gait[] = [Gait.Foot, Gait.Wheel, Gait.Wheel, Gait.Wheel, Gait.Vehicle, Gait.Vehicle, Gait.Hover];
/** The single army model of an age (drawn when the age has no formation figures). */
const WHOLE: readonly Gait[] = [Gait.Foot, Gait.Foot, Gait.Foot, Gait.Foot, Gait.Vehicle, Gait.Drone, Gait.Stomp];

export function gaitOf(age: number, role: FormationRole | 'whole'): Gait {
  const t = role === 'front' ? FRONT : role === 'flank' ? FLANK : role === 'back' ? BACK : WHOLE;
  return t[Math.min(6, Math.max(0, age))]!;
}

/** Steps a second at a standstill pace and at the kind's top speed; the stride runs between the two. */
export const STEPS_SLOW = 1.5;
export const STEPS_FAST = 3.2;
/** A march eases its step in and out over this long at each end. */
export const GAIT_RAMP_MS = 520;
/** A beaten army hurries for this long: a quicker step and looser ranks. */
export const ROUT_MS = 2600;
/** A figure lost in battle takes this long to fall; one that joins takes RISE_MS to stand up. */
export const FALL_MS = 850;
export const RISE_MS = 450;

// prefers-reduced-motion: the armies still march from tile to tile, without the bob, sway and lunge.
let calm = false;
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  calm = mq.matches;
  mq.addEventListener?.('change', (e) => { calm = e.matches; });
}
export const reducedMotion = (): boolean => calm;

/** A stable 0..2pi phase from an id, so figures never step in lockstep and never reshuffle. */
export function phaseOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (((h >>> 0) % 10000) / 10000) * Math.PI * 2;
}

/**
 * The pose of one figure. `stride` is the march phase in radians (pi a step), `amp` how much it is
 * marching (0 standing, 1 full stride), `surge` +1 while it sets off and -1 while it pulls up, `seed`
 * the figure's own phase, `now` in ms. Writes POSE and returns it.
 */
export function gaitPose(gait: Gait, stride: number, amp: number, surge: number, seed: number, now: number): Pose {
  const P = POSE;
  P.lift = 0; P.fwd = 0; P.pitch = 0; P.roll = 0; P.sy = 1;
  if (calm) { if (gait === Gait.Hover || gait === Gait.Drone) P.lift = 0.08; return P; }
  const idle = 1 - amp;
  const ph = stride + seed;
  switch (gait) {
    case Gait.Foot: {
      // a cadenced step: up on each footfall, the weight swinging from side to side, leaning into it
      const s = Math.sin(ph);
      P.lift = amp * 0.075 * Math.abs(s);
      P.roll = amp * 0.075 * s + idle * 0.014 * Math.sin(now * 0.0013 + seed * 2);
      P.pitch = amp * 0.1 + surge * 0.05;
      P.sy = 1 + idle * 0.022 * Math.sin(now * 0.0021 + seed);   // breathing while it stands
      break;
    }
    case Gait.Canter: {
      // three-beat rocking: a longer bound, nose down as the forelegs land
      const c = ph * 0.72;
      P.lift = amp * 0.13 * Math.abs(Math.sin(c));
      P.pitch = amp * (0.04 + 0.09 * Math.sin(2 * c + 0.9)) + surge * 0.07 + idle * 0.02 * Math.sin(now * 0.0017 + seed);
      P.roll = amp * 0.03 * Math.sin(c);
      P.sy = 1 + idle * 0.016 * Math.sin(now * 0.0024 + seed);
      break;
    }
    case Gait.Wheel: {
      // a gun or engine on wheels: it jolts over the ground, and stands dead still
      P.lift = amp * 0.014 * (1 + Math.sin(now * 0.047 + seed) * Math.sin(now * 0.029 + seed * 3));
      P.pitch = amp * 0.035 * Math.sin(ph * 0.5) - surge * 0.04;
      P.roll = amp * 0.03 * Math.sin(ph * 0.37 + 1.3);
      break;
    }
    case Gait.Vehicle: {
      // tracks and engines: a low rumble, squatting back as it sets off and nodding as it brakes
      P.lift = (0.004 + amp * 0.011) * (1 + Math.sin(now * 0.055 + seed) * Math.sin(now * 0.034 + seed * 3));
      P.pitch = amp * 0.03 * Math.sin(ph * 0.45) - surge * 0.07;
      P.roll = amp * 0.022 * Math.sin(ph * 0.31 + 0.7);
      break;
    }
    case Gait.Hover: {
      // floats on its cushion: a slow bob and drift, nose down when it moves off
      P.lift = 0.09 + 0.045 * Math.sin(now * 0.0026 + seed);
      P.roll = 0.05 * Math.sin(now * 0.0019 + seed * 1.3);
      P.pitch = amp * 0.09 + surge * 0.06 + 0.02 * Math.sin(now * 0.0023 + seed * 0.7);
      break;
    }
    case Gait.Stomp: {
      // a heavy walker: slow steps, the hull swinging over each leg and dropping onto it
      const c = ph * 0.55;
      const s = Math.sin(c);
      P.lift = amp * 0.1 * (1 - s * s * s * s);        // held high, then a quick drop at each footfall
      P.roll = amp * 0.1 * s + idle * 0.02 * Math.sin(now * 0.0011 + seed);
      P.pitch = amp * 0.05 + surge * 0.04;
      P.sy = 1 + idle * 0.012 * Math.sin(now * 0.0018 + seed);
      break;
    }
    case Gait.Drone: {
      // a swarm in the air: never quite still
      P.lift = 0.05 * Math.sin(now * 0.004 + seed);
      P.roll = 0.09 * Math.sin(now * 0.0031 + seed * 2.1);
      P.pitch = 0.05 * Math.sin(now * 0.0027 + seed) + amp * 0.1 + surge * 0.05;
      break;
    }
  }
  return P;
}

/**
 * A hull on the swell: rolls and pitches with the water, and lifts its bow while under way (`way`
 * 0..1). `sky` is a starship or orbital freighter: it floats and banks instead. Writes POSE.
 */
export function hullPose(way: number, seed: number, now: number, sky = false): Pose {
  const P = POSE;
  P.lift = 0; P.fwd = 0; P.pitch = 0; P.roll = 0; P.sy = 1;
  if (calm) { if (sky) P.lift = 0.1; return P; }
  if (sky) {
    P.lift = 0.12 + 0.04 * Math.sin(now * 0.0019 + seed);
    P.roll = 0.045 * Math.sin(now * 0.0015 + seed * 1.7);
    P.pitch = way * 0.05 + 0.02 * Math.sin(now * 0.0021 + seed);
    return P;
  }
  P.lift = 0.035 * Math.sin(now * 0.0016 + seed * 1.3);
  P.roll = 0.075 * Math.sin(now * 0.002 + seed);
  // the bow climbs each wave a quarter turn before the hull rises on it, and rides high under way
  P.pitch = 0.04 * Math.cos(now * 0.0016 + seed * 1.3) * (1 + 0.6 * way) - way * 0.06;
  return P;
}
