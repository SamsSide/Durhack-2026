// Armies fire at each other (B16). An army in battle, or standing next to an enemy army at war, sends a
// volley about every 0.7 s from its formation (UnitLayer writes the figures into firingFeed):
//   back line: ancient arrows, medieval crossbow bolts or a trebuchet stone, gunpowder cannon,
//              industrial and modern artillery, future drones, stellar an orbital-strike beam;
//   front line: musket or rifle sparks and smoke from gunpowder on;
//   flanks: a tracer from the armoured car, tank, hover tank or mech (industrial on).
// Shots land as small bursts in WarFx's particle pools. Only armies within the model LOD and facing the
// camera are in the feed, so far-side and orbit views cost nothing. Lane b.
// Fleets are in the feed too (naval battles, lane a): a fleet next to an enemy fleet at war turns
// broadside (ancient rams come bow-on) and fires a broadside by age: arrows, fire pots, cannon with
// smoke puffs, gun flashes with shell splashes, beams. Half the shots at a ship miss and splash in
// the sea. A fleet that raids a coast bombards the province; a beaten fleet leaves a foam ring.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TechAge, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useEventStream } from '../status/useEventStream';
import { useProvinceMesh } from '../mesh/context';
import { MAX_ARMIES, ROLE_BACK, ROLE_FLANK, ROLE_FRONT, SINKS, firingFeed as F } from './firingFeed';
import { Projectiles, Shot } from './projectiles';
import type { Fire } from './projectiles';
import { warPools } from './WarFx';

const POOL = 56;
const EVAL_MS = 250;            // who is engaged with whom: re-read 4 times a second
const BATTLE_HOT_MS = 3500;     // armies keep firing this long after a battle event
const MAX_FIRING = 12;          // armies firing at once
const VOLLEY_MS = 620;          // at most about 1.6 volleys per army per second
const VOLLEY_JITTER = 380;
const DEMO_MS = 8000;
const NAVAL_DEMO_MS = 11000;
const RING_MS = 2600;           // the foam ring of a sunk fleet

const C = {
  arrow: new THREE.Color('#f3e7c6'), arrowHead: new THREE.Color('#e9dcb8'),
  bolt: new THREE.Color('#d9c9a0'),
  stone: new THREE.Color('#4a4038'), ball: new THREE.Color('#1c1a19'),
  shell: new THREE.Color('#ffcf7a'), shellTrail: new THREE.Color('#ffb04a'),
  drone: new THREE.Color('#9fe6ff'), droneTrail: new THREE.Color('#55c8ff'),
  tracer: new THREE.Color('#fff2b0'), tracerTrail: new THREE.Color('#ffd166'),
  beam: new THREE.Color('#d8f6ff'), beamCore: new THREE.Color('#7fdcff'),
  flash: new THREE.Color('#fff4d6'), spark: new THREE.Color('#ffb04a'), cool: new THREE.Color('#b8321a'),
  smoke0: new THREE.Color('#5d5852'), smoke1: new THREE.Color('#c9c3ba'),
  dust0: new THREE.Color('#a88a5e'), dust1: new THREE.Color('#d9cbb0'),
  fire0: new THREE.Color('#ffd166'),
  pot: new THREE.Color('#ff8a3a'), potTrail: new THREE.Color('#ffc46b'),
  foam0: new THREE.Color('#eef7fa'), foam1: new THREE.Color('#9cc3d6'), spray: new THREE.Color('#bfe3f2'),
  ring: new THREE.Color('#dff3f8'),
};
const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
const Z = new THREE.Vector3(0, 0, 1);
const _t = new THREE.Vector3(), _sp = new THREE.Vector3();

const _up = new THREE.Vector3(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _c = new THREE.Vector3();
const _j = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Vector3();
const _size = new THREE.Vector2();
const SHOT: Fire = {
  kind: Shot.Arrow, p0: _p0, p1: _p1, up: _up, h: 0, dur: 1, delay: 0, tail: 0, head: 0,
  color: C.arrow, streak: C.arrow, solid: false, scale: 1, wet: false,
};

/** A random vector tangent to the sphere at n, length up to amount (no allocation). */
function jitter(out: THREE.Vector3, n: THREE.Vector3, amount: number): THREE.Vector3 {
  out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  out.addScaledVector(n, -out.dot(n));
  if (out.lengthSq() < 1e-10) return out.set(0, 0, 0);
  return out.normalize().multiplyScalar(amount * Math.random());
}

const posOf = (k: number, out: THREE.Vector3): THREE.Vector3 => out.set(F.pos[k * 3]!, F.pos[k * 3 + 1]!, F.pos[k * 3 + 2]!);
const centerOf = (i: number, out: THREE.Vector3): THREE.Vector3 => out.set(F.center[i * 3]!, F.center[i * 3 + 1]!, F.center[i * 3 + 2]!);
const pair = (a: number, b: number): number => (a < b ? a * 4096 + b : b * 4096 + a);

interface Hot { pair: number; tile: number; until: number }

interface Ring { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; born: number; size: number }

export function Firing() {
  const world = useWorld((s) => s.world);
  const mesh = useProvinceMesh();
  const sys = useMemo(() => new Projectiles(POOL), []);
  const ringGroup = useMemo(() => new THREE.Group(), []);
  const rings = useMemo(() => {
    const list: Ring[] = [];
    for (let i = 0; i < SINKS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: C.ring, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.visible = false; m.renderOrder = 26;
      ringGroup.add(m);
      list.push({ mesh: m, mat, born: -1, size: 0.05 });
    }
    return list;
  }, [ringGroup]);
  useEffect(() => () => { sys.dispose(); for (const r of rings) r.mat.dispose(); }, [sys, rings]);
  const st = useRef({
    evalAt: 0,
    war: new Set<number>(),
    hot: [] as Hot[],
    /** army key -> enemy army key, from the last evaluation */
    target: new Map<string, string>(),
    /** fleet key -> enemy coast province it bombards */
    coast: new Map<string, number>(),
    sinkSeen: 0,
    ringAt: 0,
    nextAt: new Map<string, number>(),
    index: new Map<string, number>(),
    camera: null as THREE.Camera | null,
    demo: null as { a: number; b: number; until: number } | null,
    /** Ends the running demo early (a second call replaces it). */
    demoEnd: null as (() => void) | null,
  });

  useEffect(() => {
    const s = st.current;
    s.hot.length = 0; s.target.clear(); s.coast.clear(); s.nextAt.clear(); s.demo = null;
  }, [world?.id]);

  useEventStream((events: WorldEvent[]) => {
    const now = performance.now();
    const hot = st.current.hot;
    for (const e of events) {
      if (e.type !== 'battle') continue;
      const h = hot.find((x) => x.pair === pair(e.attacker, e.defender) && x.tile === e.tile);
      if (h) h.until = now + BATTLE_HOT_MS;
      else if (hot.length < 32) hot.push({ pair: pair(e.attacker, e.defender), tile: e.tile, until: now + BATTLE_HOT_MS });
    }
  });

  /** Who fires at whom: enemies (at war, in a recent battle, or the demo pair) on the same or next tile. */
  const evaluate = (now: number): void => {
    const s = st.current;
    const w = useWorld.getState().world;
    s.target.clear(); s.coast.clear();
    if (!w || F.armies < 1) return;
    s.war.clear();
    for (const r of w.relations) if (r.stance === 'war') s.war.add(pair(r.a, r.b));
    for (let i = s.hot.length - 1; i >= 0; i--) if (s.hot[i]!.until < now) s.hot.splice(i, 1);
    if (s.demo && s.demo.until < now) s.demo = null;
    const n = Math.min(F.armies, MAX_ARMIES);
    for (let i = 0; i < n && s.target.size < MAX_FIRING; i++) {
      const oi = F.owner[i]!, ti = F.tile[i]!;
      const nb = w.tiles[ti]?.neighbors;
      let best = -1, bestD = Infinity;
      centerOf(i, _c);
      for (let j = 0; j < n; j++) {
        const oj = F.owner[j]!;
        if (oj === oi || F.ship[j] !== F.ship[i]) continue;   // armies fight armies, fleets fight fleets
        const tj = F.tile[j]!;
        if (tj !== ti && !(nb && nb.includes(tj))) continue;
        const p = pair(oi, oj);
        const engaged = s.war.has(p)
          || (s.demo !== null && p === pair(s.demo.a, s.demo.b))
          || s.hot.some((h) => h.pair === p && (h.tile === ti || h.tile === tj));
        if (!engaged) continue;
        const d = centerOf(j, _e).distanceToSquared(_c);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) { s.target.set(F.keys[i]!, F.keys[best]!); continue; }
      if (!F.ship[i] || !nb) continue;
      // no enemy fleet in reach: a raiding fleet bombards the enemy coast beside it
      for (const h of s.hot) {
        if (h.until < now || !nb.includes(h.tile) || w.tiles[h.tile]?.terrain === 'ocean') continue;
        if (h.pair !== pair(oi, w.owner[h.tile] ?? -1) && !(s.demo && h.pair === pair(s.demo.a, s.demo.b) && (oi === s.demo.a || oi === s.demo.b))) continue;
        s.coast.set(F.keys[i]!, h.tile);
        break;
      }
    }
  };

  const tileAt = (tile: number, out: THREE.Vector3): boolean => {
    if (!mesh) return false;
    const c = mesh.centroidOf([tile]);
    out.set(c[0], c[1], c[2]);
    return out.lengthSq() > 0;
  };

  /** Water thrown up where a shot lands in the sea: a pale column, foam and droplets. */
  const splash = (at: THREE.Vector3, up: THREE.Vector3, fs: number, big: number, now: number): void => {
    const fire = warPools.fire, smoke = warPools.smoke;
    if (!fire || !smoke) return;
    smoke.emit(now, at, _d.copy(up).multiplyScalar(fs * (1.1 + big)), fs * 0.3 * big, fs * 1.0 * big, 900, 0.7, C.foam0, { c1: C.foam1 });
    for (let m = 0; m < 2; m++) smoke.emit(now, at, _d.copy(jitter(_j, up, fs * 1.2 * big)).addScaledVector(up, fs * 0.4), fs * 0.3 * big, fs * 0.9 * big, 1100, 0.45, C.foam0, { c1: C.foam1, delay: 60 + m * 80 });
    for (let m = 0; m < 4; m++) fire.emit(now, at, _d.copy(jitter(_j, up, fs * 0.9 * big)).addScaledVector(up, fs * (0.8 + Math.random()) * big), fs * 0.09, fs * 0.05, 420 + Math.random() * 200, 0.8, C.spray, { delay: Math.random() * 60 });
  };

  /** A beaten fleet goes down: bubbling foam, oil smoke from the gunpowder ages on, and a foam ring. */
  const sinkFx = (x: number, y: number, z: number, size: number, age: number, now: number): void => {
    const fire = warPools.fire, smoke = warPools.smoke;
    _p0.set(x, y, z);
    _p0.setLength(_p0.length() - 0.0032);
    _up.copy(_p0).normalize();
    const r = rings[s0.ringAt++ % SINKS]!;
    r.born = now; r.size = size * 0.55;   // about one and a half hull lengths across at its widest
    r.mesh.position.copy(_p0);
    r.mesh.quaternion.setFromUnitVectors(Z, _up);
    r.mesh.visible = true;
    if (!fire || !smoke) return;
    for (let m = 0; m < 8; m++) smoke.emit(now, _p0, _d.copy(jitter(_j, _up, size * 1.5)).addScaledVector(_up, size * 0.5), size * 0.35, size * 1.1, 1700, 0.5, C.foam0, { c1: C.foam1, delay: m * 160 });
    if (age >= 2) for (let m = 0; m < 5; m++) smoke.emit(now, _p0, _d.copy(_up).multiplyScalar(size * (2 + Math.random())).add(jitter(_j, _up, size * 0.6)), size * 0.4, size * 1.6, 2400, 0.6, C.smoke0, { c1: C.smoke1, delay: m * 250 });
    for (let m = 0; m < 5; m++) fire.emit(now, _p0, _d.copy(jitter(_j, _up, size * 1.2)).addScaledVector(_up, size * 0.8), size * 0.08, size * 0.05, 600, 0.8, C.spray, { delay: m * 90 });
  };
  const s0 = st.current;

  /** One volley from army i at army j. */
  const volley = (i: number, j: number, now: number): void => {
    const age = F.age[i]!;
    const j0 = F.fig0[j]!, j1 = F.fig1[j]!;
    if (j1 <= j0) return;
    const fire = warPools.fire, smoke = warPools.smoke;
    centerOf(j, _e);
    for (let k = F.fig0[i]!; k < F.fig1[i]!; k++) {
      const role = F.role[k]!;
      const fs = F.size[k]!;
      posOf(k, _q);
      _up.copy(_q).normalize();
      const aim = j0 + Math.floor(Math.random() * (j1 - j0));
      if (role === ROLE_BACK) backLine(age, fs, aim, now);
      else if (role === ROLE_FRONT && age >= 2) {
        // muskets and rifles: a ragged line of sparks and a puff drifting towards the enemy
        if (!fire || !smoke) continue;
        _d.subVectors(_e, _q).normalize();
        for (let m = 0; m < 2; m++) {
          _p0.copy(_q).addScaledVector(_up, fs * 0.55).addScaledVector(_d, fs * 0.45).add(jitter(_j, _up, fs * 0.35));
          const delay = Math.random() * 260;
          fire.emit(now, _p0, _j.set(0, 0, 0), fs * 0.32, fs * 0.5, 120, 1, C.flash, { delay, c1: C.spark });
          smoke.emit(now, _p0, _j.copy(_d).multiplyScalar(fs * 0.9).addScaledVector(_up, fs * 0.5), fs * 0.25, fs * 0.9, 900, 0.5, C.smoke1, { delay: delay + 40, c1: C.smoke1 });
        }
      } else if (role === ROLE_FLANK && age >= 3) {
        // armoured car, tank, hover tank or mech: a short bright tracer, a flash at the target
        _p0.copy(_q).addScaledVector(_up, fs * 0.45);
        posOf(aim, _p1).addScaledVector(_up, F.size[aim]! * 0.3);
        if (fire) fire.emit(now, _p0, _j.set(0, 0, 0), fs * 0.5, fs * 0.8, 110, 1, C.flash);
        shot(Shot.Tracer, 0.02, 170, Math.random() * 200, 0.55, fs * 0.28, C.tracer, C.tracerTrail, false, fs);
      }
    }

    // the odd explosion on the enemy line: a shell lands among the figures (industrial on), bigger when modern
    if (age >= 3 && Math.random() < (age >= 4 ? 0.22 : 0.12)) {
      const k = j0 + Math.floor(Math.random() * (j1 - j0));
      posOf(k, _p0);
      _up.copy(_p0).normalize();
      impact(age >= 5 ? Shot.Beam : Shot.Shell, _p0, _up, F.size[k]! * 1.2, now);
    }

    function backLine(age: number, fs: number, aim: number, now: number): void {
      const tf = F.size[aim]!;
      posOf(aim, _c);
      const spread = Math.max(tf, fs) * 1.6;
      if (age === 0) {
        // archers: a fan of 5 to 8 arrows on a high arc, landing across the enemy line
        const n = 5 + Math.floor(Math.random() * 4);
        for (let m = 0; m < n; m++) {
          _p0.copy(_q).addScaledVector(_up, fs * 0.6).add(jitter(_j, _up, fs * 0.4));
          _p1.copy(_c).add(jitter(_j, _up, spread));
          shot(Shot.Arrow, 0.32, 720 + Math.random() * 160, m * 25 + Math.random() * 60, 0.09, 0, C.arrowHead, C.arrow, false, fs);
        }
      } else if (age === 1) {
        if (Math.random() < 0.45) {
          // the trebuchet: one stone, a slow lob
          _p0.copy(_q).addScaledVector(_up, fs * 0.9);
          _p1.copy(_c).add(jitter(_j, _up, spread * 0.5));
          shot(Shot.Stone, 0.75, 1350, 0, 0, fs * 0.55, C.stone, C.stone, true, fs);
        } else {
          // crossbows: three or four flat, quick bolts
          const n = 3 + Math.floor(Math.random() * 2);
          for (let m = 0; m < n; m++) {
            _p0.copy(_q).addScaledVector(_up, fs * 0.5).add(jitter(_j, _up, fs * 0.4));
            _p1.copy(_c).add(jitter(_j, _up, spread * 0.8));
            shot(Shot.Bolt, 0.12, 430 + Math.random() * 80, m * 70, 0.12, 0, C.bolt, C.bolt, false, fs);
          }
        }
      } else if (age === 2) {
        // the cannon: flash and smoke at the muzzle, a dark ball on a low arc
        muzzle(fs, 1);
        _p1.copy(_c).add(jitter(_j, _up, spread * 0.5));
        shot(Shot.Ball, 0.22, 650, 0, 0, fs * 0.45, C.ball, C.ball, true, fs);
      } else if (age <= 4) {
        // artillery: a bigger flash, a glowing shell on a high arc
        muzzle(fs, 1.3);
        _p1.copy(_c).add(jitter(_j, _up, spread * 0.6));
        shot(Shot.Shell, 0.42, 900, 0, 0.08, fs * 0.32, C.shell, C.shellTrail, false, fs);
      } else if (age === 5) {
        // drones: three quick streaks that dip onto the enemy
        for (let m = 0; m < 3; m++) {
          _p0.copy(_q).addScaledVector(_up, fs * 0.8).add(jitter(_j, _up, fs * 0.5));
          _p1.copy(_c).add(jitter(_j, _up, spread));
          shot(Shot.Drone, 0.18 + Math.random() * 0.1, 560 + Math.random() * 120, m * 110, 0.3, fs * 0.26, C.drone, C.droneTrail, false, fs);
        }
      } else {
        // stellar: a beam from orbit straight down onto the enemy
        _p1.copy(_c).add(jitter(_j, _up, spread * 0.4));
        _p0.copy(_p1);
        SHOT.up = _up.copy(_p1).normalize();
        shot(Shot.Beam, fs * 9, 420, 0, 0, fs * 0.6, C.beam, C.beamCore, false, fs);
      }
    }

    function muzzle(fs: number, k: number): void {
      if (!fire || !smoke) return;
      _p0.copy(_q).addScaledVector(_up, fs * 0.6);
      _d.subVectors(_c, _q).normalize();
      _p0.addScaledVector(_d, fs * 0.4);
      fire.emit(now, _p0, _j.set(0, 0, 0), fs * 0.7 * k, fs * 1.2 * k, 150, 1, C.flash, { c1: C.fire0 });
      for (let m = 0; m < 3; m++) {
        smoke.emit(now, _p0, _j.copy(_d).multiplyScalar(fs * 0.6).addScaledVector(_up, fs * (0.6 + Math.random() * 0.5)).add(jitter(_e, _up, fs * 0.4)),
          fs * 0.35 * k, fs * 1.3 * k, 1300, 0.55, C.smoke0, { delay: 30 + m * 50, c1: C.smoke1 });
      }
      centerOf(j, _e); // jitter borrowed _e
    }
  };

  /** One broadside from fleet i at fleet j, or at the coast of province `tile` when j is -1. */
  let wetNext = false;
  const broadside = (i: number, j: number, tile: number, now: number): void => {
    const age = F.age[i]!;
    const k0 = F.fig0[i]!;
    if (F.fig1[i]! <= k0) return;
    const fs = F.size[k0]!;
    posOf(k0, _q);
    _up.copy(_q).normalize();
    if (j >= 0) centerOf(j, _c);
    else if (!tileAt(tile, _c)) return;
    F.markAim(F.keys[i]!, _c);
    _d.subVectors(_c, _q);
    _d.addScaledVector(_up, -_d.dot(_up));
    const dist = _d.length();
    if (dist < 1e-6) return;
    _d.divideScalar(dist);
    _t.crossVectors(_up, _d);                         // along the hull: the guns stand in a row
    const guns = age === 0 ? 3 : age === 1 ? 2 : age === 2 ? 4 : age <= 4 ? 3 : 2;
    const ship = j >= 0;
    const tf = ship ? F.size[F.fig0[j]!]! : fs * 2;
    for (let m = 0; m < guns; m++) {
      const along = guns > 1 ? (m / (guns - 1) - 0.5) * fs * 2.2 : 0;
      const delay = m * (age >= 2 ? 110 : 60) + Math.random() * 60;
      const bow = age === 0 ? fs * 0.9 : fs * 0.5;     // rams and archers shoot from the bow
      _p0.copy(_q).addScaledVector(_up, fs * 0.7).addScaledVector(_t, age === 0 ? fs * 0.2 * (m - 1) : along).addScaledVector(_d, bow);
      // a miss lands in the sea beside the target ship, a hit on its hull (or on the coast)
      const miss = ship && Math.random() < 0.5;
      _p1.copy(_c);
      if (miss) {
        jitter(_sp, _up, 1);
        if (_sp.lengthSq() > 1e-8) _p1.add(_sp.normalize().multiplyScalar(tf * (1.6 + Math.random() * 2.2)));
      } else _p1.add(jitter(_sp, _up, tf * 0.7));
      wetNext = miss;
      if (age === 0) {
        // archers on the deck: a short fan of arrows on a high arc
        for (let a = 0; a < 3; a++) shot(Shot.Arrow, 0.3, 700 + Math.random() * 160, delay + a * 30, 0.09, 0, C.arrowHead, C.arrow, false, fs);
      } else if (age === 1) {
        // fire pots: a burning jar on a lazy lob
        if (warPools.fire) warPools.fire.emit(now, _p0, _j.set(0, 0, 0), fs * 0.4, fs * 0.7, 200, 1, C.flash, { delay, c1: C.pot });
        shot(Shot.Shell, 0.5, 950, delay, 0.1, fs * 0.34, C.pot, C.potTrail, false, fs * 0.7);
      } else if (age === 2) {
        // cannon through the gun ports: a puff of smoke on the water, a dark ball on a flat arc
        puff(fs, 1, delay, now);
        shot(Shot.Ball, 0.16, 600, delay, 0, fs * 0.4, C.ball, C.ball, true, fs);
      } else if (age <= 4) {
        // naval guns: a bright muzzle flash and a shell flying low; the smoke is thin
        puff(fs, age === 3 ? 1.2 : 1.5, delay, now);
        shot(Shot.Shell, 0.12, 520, delay, 0.1, fs * 0.3, C.shell, C.shellTrail, false, fs);
      } else {
        // future: a beam from the sky onto the target
        _p0.copy(_p1);
        SHOT.up = _up.copy(_p1).normalize();
        shot(Shot.Beam, fs * 9, 420, delay, 0, fs * 0.5, C.beam, C.beamCore, false, fs);
        break;
      }
    }
    wetNext = false;
  };

  /** A muzzle flash and a smoke puff drifting off a gun port (_p0). */
  const puff = (fs: number, k: number, delay: number, now: number): void => {
    const fire = warPools.fire, smoke = warPools.smoke;
    if (!fire || !smoke) return;
    fire.emit(now, _p0, _j.set(0, 0, 0), fs * 0.7 * k, fs * 1.2 * k, 150, 1, C.flash, { delay, c1: C.fire0 });
    _e.copy(_p0).normalize();
    for (let m = 0; m < 2; m++) smoke.emit(now, _p0, _j.copy(_d).multiplyScalar(fs * 0.8).addScaledVector(_e, fs * (0.5 + Math.random() * 0.4)), fs * 0.35 * k, fs * 1.4 * k, 1400, 0.55, C.smoke1, { delay: delay + 30 + m * 60, c1: C.smoke1 });
  };

  /** Fires SHOT from _p0 to _p1. The arc height is a share of the distance. */
  const shot = (kind: Shot, arc: number, dur: number, delay: number, tail: number, head: number, color: THREE.Color, streak: THREE.Color, solid: boolean, scale: number): void => {
    if (kind !== Shot.Beam) SHOT.up = _up.copy(_p0).add(_p1).normalize();
    SHOT.kind = kind;
    SHOT.h = kind === Shot.Beam ? arc : _p0.distanceTo(_p1) * arc;
    SHOT.dur = dur; SHOT.delay = delay; SHOT.tail = tail; SHOT.head = head;
    SHOT.color = color; SHOT.streak = streak; SHOT.solid = solid; SHOT.scale = scale; SHOT.wet = wetNext;
    sys.fire(performance.now(), SHOT);
  };

  /** Where a shot lands: a small burst drawn in WarFx's pools. */
  const impact = (kind: Shot, at: THREE.Vector3, up: THREE.Vector3, fs: number, now: number, wet = false): void => {
    const fire = warPools.fire, smoke = warPools.smoke;
    if (!fire || !smoke) return;
    if (wet) {
      splash(at, up, fs, kind === Shot.Arrow || kind === Shot.Bolt ? 0.4 : kind === Shot.Shell ? 1.3 : 1, now);
      return;
    }
    switch (kind) {
      case Shot.Arrow:
      case Shot.Bolt:
        smoke.emit(now, at, _d.copy(up).multiplyScalar(fs * 0.3).add(jitter(_j, up, fs * 0.4)), fs * 0.15, fs * 0.45, 600, 0.45, C.dust0, { c1: C.dust1 });
        if (Math.random() < 0.5) fire.emit(now, at, jitter(_d, up, fs * 0.6).addScaledVector(up, fs * 0.3), fs * 0.12, fs * 0.08, 260, 0.9, C.spark);
        break;
      case Shot.Stone:
        for (let m = 0; m < 5; m++) smoke.emit(now, at, _d.copy(jitter(_j, up, fs * 1.6)).addScaledVector(up, fs * 0.5), fs * 0.3, fs * 1.1, 1200, 0.6, C.dust0, { c1: C.dust1, delay: m * 40 });
        for (let m = 0; m < 4; m++) fire.emit(now, at, _d.copy(jitter(_j, up, fs * 1.4)).addScaledVector(up, fs * 0.8), fs * 0.14, fs * 0.08, 500, 1, C.spark, { c1: C.cool });
        break;
      case Shot.Ball:
      case Shot.Shell:
      case Shot.Drone:
      case Shot.Beam: {
        const big = kind === Shot.Ball ? 1 : kind === Shot.Drone ? 0.9 : kind === Shot.Shell ? 1.4 : 1.9;
        const flash = kind === Shot.Drone || kind === Shot.Beam ? C.beam : C.flash;
        fire.emit(now, at, _d.set(0, 0, 0), fs * 0.8 * big, fs * 1.6 * big, 260, 1, flash, { c1: C.fire0 });
        if (kind !== Shot.Ball) for (let m = 0; m < 3; m++) {
          _q.copy(at).add(jitter(_j, up, fs * 0.4 * big));
          fire.emit(now, _q, _d.copy(up).multiplyScalar(fs * 0.7 * big).add(jitter(_j, up, fs * 0.5)), fs * 0.5 * big, fs * 1.0 * big, 520, 0.9, C.fire0, { c1: C.cool, delay: 30 + m * 30 });
        }
        for (let m = 0; m < 6; m++) fire.emit(now, at, _d.copy(jitter(_j, up, fs * 2 * big)).addScaledVector(up, fs * big * Math.random()), fs * 0.12, fs * 0.07, 450 + Math.random() * 300, 1, C.spark, { c1: C.cool, delay: Math.random() * 60 });
        for (let m = 0; m < 3; m++) smoke.emit(now, at, _d.copy(up).multiplyScalar(fs * (1.2 + Math.random()) * big).add(jitter(_j, up, fs * 0.8)), fs * 0.4 * big, fs * 1.5 * big, 1800, 0.55, kind === Shot.Ball ? C.dust0 : C.smoke0, { c1: C.smoke1, delay: 80 + m * 90 });
        break;
      }
      case Shot.Tracer:
        fire.emit(now, at, _d.set(0, 0, 0), fs * 0.45, fs * 0.8, 160, 1, C.tracer, { c1: C.fire0 });
        for (let m = 0; m < 3; m++) fire.emit(now, at, jitter(_d, up, fs * 1.0).addScaledVector(up, fs * 0.4), fs * 0.1, fs * 0.06, 320, 1, C.spark);
        break;
    }
  };

  // Dev only: __firingDemo(age?) stages two enemy formations near the view centre that fire for ~8 s.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const win = window as unknown as {
      __firingDemo?: (age?: TechAge) => string;
      __units?: { sync(): void; onEvents(e: WorldEvent[]): void };
    };
    win.__firingDemo = (age) => {
      const w = useWorld.getState().world;
      const layer = win.__units;
      const cam = st.current.camera;
      if (!w || !layer || !cam) return 'firing demo: no world yet';
      st.current.demoEnd?.();
      const dir = _c.copy(cam.position).normalize();
      let t1 = -1, best = -2;
      w.tiles.forEach((t, i) => {
        if (t.terrain === 'ocean') return;
        const d = (t.center[0] * dir.x + t.center[1] * dir.y + t.center[2] * dir.z) / Math.hypot(t.center[0], t.center[1], t.center[2]);
        if (d > best) { best = d; t1 = i; }
      });
      const t2 = w.tiles[t1]?.neighbors.find((n) => w.tiles[n]?.terrain !== 'ocean') ?? -1;
      if (t1 < 0 || t2 < 0) return 'firing demo: no land at the view centre';
      const alive = w.countries.filter((c) => c.alive);
      const a = (age ? alive.find((c) => (c.techAge ?? 'ancient') === age) : undefined) ?? alive[0];
      const b = alive.find((c) => c.id !== a?.id && (!age || (c.techAge ?? 'ancient') === age)) ?? alive.find((c) => c.id !== a?.id);
      if (!a || !b) return 'firing demo: needs two nations';
      const base = { tick: w.tick, actor: 'world' as const, lamport: 0 };
      // both sides take the asked age for the demo, and get their own back after it
      const restore: WorldEvent[] = [];
      if (age) for (const c of [a, b]) {
        if ((c.techAge ?? 'ancient') === age) continue;
        layer.onEvents([{ ...base, id: `demo-age-${c.id}`, type: 'country_updated', countryId: c.id, patch: { techAge: age } } as WorldEvent]);
        restore.push({ ...base, id: `demo-age-back-${c.id}`, type: 'country_updated', countryId: c.id, patch: { techAge: c.techAge ?? 'ancient' } } as WorldEvent);
      }
      const ids = ['demo-fire-a', 'demo-fire-b'];
      w.units = w.units.filter((u) => !ids.includes(u.id));
      w.units.push({ id: ids[0]!, owner: a.id, kind: 'army', tile: t1, strength: 60 }, { id: ids[1]!, owner: b.id, kind: 'army', tile: t2, strength: 60 });
      layer.sync();
      // a battle event turns the two lines to face each other
      layer.onEvents([{ ...base, id: 'demo-fire-battle', type: 'battle', tile: t1, attacker: a.id, defender: b.id, attackerUnit: ids[0]!, winner: -1, losses: { attacker: 0, defender: 0 } } as WorldEvent]);
      st.current.demo = { a: a.id, b: b.id, until: performance.now() + DEMO_MS };
      st.current.evalAt = 0;
      const end = (): void => {
        window.clearTimeout(timer);
        if (st.current.demoEnd === end) st.current.demoEnd = null;
        const cur = useWorld.getState().world;
        if (cur) cur.units = cur.units.filter((u) => !ids.includes(u.id));
        if (restore.length) layer.onEvents(restore);
        layer.sync();
      };
      const timer = window.setTimeout(end, DEMO_MS);
      st.current.demoEnd = end;
      const dist = cam.position.length();
      return `firing demo: ${a.name} (${age ?? a.techAge ?? 'ancient'}) on tile ${t1} against ${b.name} on tile ${t2}` + (dist > 2.3 ? '; zoom in below 2.4 to see the formations' : '');
    };
    return () => { delete win.__firingDemo; };
  }, []);

  // Dev only: __navalDemo(age?) stages a sea battle near the view centre for about 11 s (or ms): two enemy fleets
  // trade broadsides, one goes under in a ring of foam, and the winner bombards the coast if one is near.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const win = window as unknown as {
      __navalDemo?: (age?: TechAge, ms?: number) => string;
      __units?: { sync(): void; onEvents(e: WorldEvent[]): void };
    };
    win.__navalDemo = (age, ms = NAVAL_DEMO_MS) => {
      const w = useWorld.getState().world;
      const layer = win.__units;
      const cam = st.current.camera;
      if (!w || !layer || !cam) return 'naval demo: no world yet';
      st.current.demoEnd?.();
      const dir = _c.copy(cam.position).normalize();
      const sea = (t: number): boolean => w.tiles[t]?.terrain === 'ocean';
      let t1 = -1, best = -2;
      w.tiles.forEach((t, i) => {
        if (t.terrain !== 'ocean') return;
        const d = (t.center[0] * dir.x + t.center[1] * dir.y + t.center[2] * dir.z) / Math.hypot(t.center[0], t.center[1], t.center[2]);
        const score = d + (t.neighbors.some((n) => !sea(n)) ? 0.03 : 0);
        if (score > best) { best = score; t1 = i; }
      });
      if (t1 < 0) return 'naval demo: no open sea at the view centre';
      const t3 = w.tiles[t1]!.neighbors.find((n) => !sea(n)) ?? -1;
      const alive = w.countries.filter((c) => c.alive);
      const a = (age ? alive.find((c) => (c.techAge ?? 'ancient') === age) : undefined) ?? alive[0];
      const b = alive.find((c) => c.id !== a?.id && (!age || (c.techAge ?? 'ancient') === age)) ?? alive.find((c) => c.id !== a?.id);
      if (!a || !b) return 'naval demo: needs two nations';
      const base = { tick: w.tick, actor: 'world' as const, lamport: 0 };
      const restore: WorldEvent[] = [];
      if (age) for (const c of [a, b]) {
        if ((c.techAge ?? 'ancient') === age) continue;
        layer.onEvents([{ ...base, id: `demo-nage-${c.id}`, type: 'country_updated', countryId: c.id, patch: { techAge: age } } as WorldEvent]);
        restore.push({ ...base, id: `demo-nage-back-${c.id}`, type: 'country_updated', countryId: c.id, patch: { techAge: c.techAge ?? 'ancient' } } as WorldEvent);
      }
      // frame the two fleets: a low slanted view over the water, so the hulls and the splashes read
      const cc = (window as unknown as { __cam?: { setLookAt: (...a: (number | boolean)[]) => unknown } }).__cam;
      if (cc) {
        _p0.set(...w.tiles[t1]!.center).normalize();
        _up.copy(_p0);
        _t.set(0, 1, 0).cross(_up).normalize();
        _e.copy(_up).multiplyScalar(1.15).addScaledVector(_t, 0.045);
        cc.setLookAt(_e.x, _e.y, _e.z, 0, 0, 0, true);
      }
      const ids = ['demo-navy-a', 'demo-navy-b'];
      w.units = w.units.filter((u) => !ids.includes(u.id));
      w.units.push({ id: ids[0]!, owner: a.id, kind: 'fleet', tile: t1, strength: 60 }, { id: ids[1]!, owner: b.id, kind: 'fleet', tile: t1, strength: 60 });   // one tile, side by side: a close duel
      layer.sync();
      layer.onEvents([{ ...base, id: 'demo-navy-battle', type: 'battle', tile: t1, attacker: a.id, defender: b.id, attackerUnit: ids[0]!, winner: -1, losses: { attacker: 0, defender: 0 } } as WorldEvent]);
      st.current.demo = { a: a.id, b: b.id, until: performance.now() + ms };
      st.current.evalAt = 0;
      // at 45 percent of the run the second fleet is beaten and goes down; the winner then turns on the coast
      const sink = window.setTimeout(() => {
        layer.onEvents([{ ...base, id: 'demo-navy-sunk', type: 'unit_removed', unitId: ids[1]!, reason: 'battle' } as WorldEvent]);
        const cur = useWorld.getState().world;
        if (cur) cur.units = cur.units.filter((u) => u.id !== ids[1]);
        layer.sync();
        if (t3 >= 0) st.current.hot.push({ pair: pair(a.id, b.id), tile: t3, until: performance.now() + ms });
        st.current.evalAt = 0;
      }, ms * 0.45);
      const end = (): void => {
        window.clearTimeout(timer); window.clearTimeout(sink);
        if (st.current.demoEnd === end) st.current.demoEnd = null;
        const cur = useWorld.getState().world;
        if (cur) cur.units = cur.units.filter((u) => !ids.includes(u.id));
        if (restore.length) layer.onEvents(restore);
        layer.sync();
      };
      const timer = window.setTimeout(end, ms);
      st.current.demoEnd = end;
      return `naval demo: ${a.name} (${age ?? a.techAge ?? 'ancient'}) fleet against ${b.name} on tile ${t1}` + (t3 >= 0 ? ', then the coast' : '') + (cam.position.length() > 2.0 ? '; zoom in below 1.8 to see the ships' : '');
    };
    return () => { delete win.__navalDemo; };
  }, []);

  useFrame(({ gl, camera }) => {
    const now = performance.now();
    const s = st.current;
    s.camera = camera;
    if (now - s.evalAt > EVAL_MS) { s.evalAt = now; evaluate(now); }
    if (s.target.size || s.coast.size) {
      s.index.clear();
      for (let i = 0; i < F.armies; i++) s.index.set(F.keys[i]!, i);
      for (const [key, tile] of s.coast) {
        const i = s.index.get(key);
        if (i === undefined) continue;
        F.markFight(key, now);
        const next = s.nextAt.get(key) ?? now + Math.random() * 300;
        if (now < next) { if (!s.nextAt.has(key)) s.nextAt.set(key, next); continue; }
        s.nextAt.set(key, now + VOLLEY_MS + 200 + Math.random() * VOLLEY_JITTER);
        broadside(i, -1, tile, now);
        F.markShot(key, now);
      }
      for (const [key, enemy] of s.target) {
        const i = s.index.get(key), j = s.index.get(enemy);
        if (i === undefined || j === undefined) continue;
        F.markFight(key, now); // the formation braces and its front rank fights (UnitLayer)
        const next = s.nextAt.get(key) ?? now + Math.random() * 300; // a fresh line opens fire within a moment
        if (now < next) { if (!s.nextAt.has(key)) s.nextAt.set(key, next); continue; }
        s.nextAt.set(key, now + VOLLEY_MS + Math.random() * VOLLEY_JITTER);
        if (F.ship[i]) broadside(i, j, -1, now); else volley(i, j, now);
        F.markShot(key, now);  // and recoils with the shot
      }
      if (s.nextAt.size > 200) s.nextAt.clear();
    }
    // fleets that went down since the last frame: foam, bubbles, a ring
    if (F.sinkCount - s.sinkSeen > SINKS) s.sinkSeen = F.sinkCount - SINKS;
    for (; s.sinkSeen < F.sinkCount; s.sinkSeen++) {
      const k = (s.sinkSeen % SINKS) * 6;
      sinkFx(F.sinks[k]!, F.sinks[k + 1]!, F.sinks[k + 2]!, F.sinks[k + 3]!, F.sinks[k + 4]!, now);
    }
    for (const r of rings) {
      if (r.born < 0) continue;
      const t = (now - r.born) / RING_MS;
      if (t >= 1) { r.born = -1; r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(r.size * 0.25 + r.size * (1 - (1 - t) * (1 - t)));
      r.mat.opacity = 0.3 * (1 - t) * Math.min(1, t * 8);
    }
    gl.getDrawingBufferSize(_size);
    sys.update(now, _size.y * 0.5 * camera.projectionMatrix.elements[5]!, impact);
  });

  return <><primitive object={sys.group} /><primitive object={ringGroup} /></>;
}
