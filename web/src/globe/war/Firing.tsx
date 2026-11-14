// Armies fire at each other (B16). An army in battle, or standing next to an enemy army at war, sends a
// volley about every 0.7 s from its formation (UnitLayer writes the figures into firingFeed):
//   back line: ancient arrows, medieval crossbow bolts or a trebuchet stone, gunpowder cannon,
//              industrial and modern artillery, future drones, stellar an orbital-strike beam;
//   front line: musket or rifle sparks and smoke from gunpowder on;
//   flanks: a tracer from the armoured car, tank, hover tank or mech (industrial on).
// Shots land as small bursts in WarFx's particle pools. Only armies within the model LOD and facing the
// camera are in the feed, so far-side and orbit views cost nothing. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TechAge, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useEventStream } from '../status/useEventStream';
import { MAX_ARMIES, ROLE_BACK, ROLE_FLANK, ROLE_FRONT, firingFeed as F } from './firingFeed';
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
};

const _up = new THREE.Vector3(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _c = new THREE.Vector3();
const _j = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Vector3();
const _size = new THREE.Vector2();
const SHOT: Fire = {
  kind: Shot.Arrow, p0: _p0, p1: _p1, up: _up, h: 0, dur: 1, delay: 0, tail: 0, head: 0,
  color: C.arrow, streak: C.arrow, solid: false, scale: 1,
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

export function Firing() {
  const world = useWorld((s) => s.world);
  const sys = useMemo(() => new Projectiles(POOL), []);
  useEffect(() => () => sys.dispose(), [sys]);
  const st = useRef({
    evalAt: 0,
    war: new Set<number>(),
    hot: [] as Hot[],
    /** army key -> enemy army key, from the last evaluation */
    target: new Map<string, string>(),
    nextAt: new Map<string, number>(),
    index: new Map<string, number>(),
    camera: null as THREE.Camera | null,
    demo: null as { a: number; b: number; until: number } | null,
    /** Ends the running demo early (a second call replaces it). */
    demoEnd: null as (() => void) | null,
  });

  useEffect(() => {
    const s = st.current;
    s.hot.length = 0; s.target.clear(); s.nextAt.clear(); s.demo = null;
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
    s.target.clear();
    if (!w || F.armies < 2) return;
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
        if (oj === oi) continue;
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
      if (best >= 0) s.target.set(F.keys[i]!, F.keys[best]!);
    }
  };

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

  /** Fires SHOT from _p0 to _p1. The arc height is a share of the distance. */
  const shot = (kind: Shot, arc: number, dur: number, delay: number, tail: number, head: number, color: THREE.Color, streak: THREE.Color, solid: boolean, scale: number): void => {
    if (kind !== Shot.Beam) SHOT.up = _up.copy(_p0).add(_p1).normalize();
    SHOT.kind = kind;
    SHOT.h = kind === Shot.Beam ? arc : _p0.distanceTo(_p1) * arc;
    SHOT.dur = dur; SHOT.delay = delay; SHOT.tail = tail; SHOT.head = head;
    SHOT.color = color; SHOT.streak = streak; SHOT.solid = solid; SHOT.scale = scale;
    sys.fire(performance.now(), SHOT);
  };

  /** Where a shot lands: a small burst drawn in WarFx's pools. */
  const impact = (kind: Shot, at: THREE.Vector3, up: THREE.Vector3, fs: number, now: number): void => {
    const fire = warPools.fire, smoke = warPools.smoke;
    if (!fire || !smoke) return;
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
      layer.onEvents([{ ...base, id: 'demo-fire-battle', type: 'battle', tile: t2, attacker: a.id, defender: b.id, attackerUnit: ids[0]!, winner: -1, losses: { attacker: 0, defender: 0 } } as WorldEvent]);
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

  useFrame(({ gl, camera }) => {
    const now = performance.now();
    const s = st.current;
    s.camera = camera;
    if (now - s.evalAt > EVAL_MS) { s.evalAt = now; evaluate(now); }
    if (s.target.size) {
      s.index.clear();
      for (let i = 0; i < F.armies; i++) s.index.set(F.keys[i]!, i);
      for (const [key, enemy] of s.target) {
        const i = s.index.get(key), j = s.index.get(enemy);
        if (i === undefined || j === undefined) continue;
        F.markFight(key, now); // the formation braces and its front rank fights (UnitLayer)
        const next = s.nextAt.get(key) ?? now + Math.random() * 300; // a fresh line opens fire within a moment
        if (now < next) { if (!s.nextAt.has(key)) s.nextAt.set(key, next); continue; }
        s.nextAt.set(key, now + VOLLEY_MS + Math.random() * VOLLEY_JITTER);
        volley(i, j, now);
        F.markShot(key, now);  // and recoils with the shot
      }
      if (s.nextAt.size > 200) s.nextAt.clear();
    }
    gl.getDrawingBufferSize(_size);
    sys.update(now, _size.y * 0.5 * camera.projectionMatrix.elements[5]!, impact);
  });

  return <primitive object={sys.group} />;
}
