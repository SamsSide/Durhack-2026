// Satellite launches (#291): each new satellite rides a rocket up from its nation's capital instead of
// popping into orbit. About ten seconds of real time whatever the game speed: lift-off with flame and
// pad smoke, a gravity-turn ascent with a contrail, stage separation, the upper stage handing the
// satellite to Orbit.tsx at its orbit position and fading, and the booster falling back, glowing and
// breaking up into sparks high in the atmosphere. At most two at once; a short queue, the overflow
// skips straight to orbit. Dev: window.__launch(countryId?). Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';
import { LIFT } from '../constants';
import { deliver, omega, ringFor, ringPos, syncWorld } from './launchState';
import type { Ring } from './launchState';
import { C, Pool, pointScale } from './launchFx';
import { buildVehicle, rocketKit } from './launchModels';
import type { Vehicle } from './launchModels';

const ROCKET_H = 0.075;      // world units, bold enough to read from the default view
const HOLD = 0.8;            // s on the pad, engines lit
const ASCENT = 5.6;          // s from lift-off to deployment
const SEP_TAU = 0.48;        // share of the ascent at which the booster lets go
const FADE = 1.4;            // s for the spent upper stage to fade
const BOOSTER_FALL = 5.0;    // s from separation to break-up
const BREAKUP_ALT = 1.085;   // radius where the booster burns apart (above the highest ground)
const DEPLOY_ANGLE = 0.38;   // rad downrange along the orbit where the satellite is released
const MAX_ACTIVE = 2;
const QUEUE_MAX = 4;
const GAP = 1.5;             // s between two lift-offs

interface Flight {
  id: number;
  t0: number;
  veh: Vehicle;
  ring: Ring;
  phase: number;
  pad: THREE.Vector3;
  n: THREE.Vector3;
  b: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  accel: number;
  q: THREE.Vector3;
  qTan: THREE.Vector3;
  sepAt: number;
  sep: null | { s: THREE.Vector3; dir: THREE.Vector3; h: THREE.Vector3; h0: number; vr: number; g: number; w: number; spin: THREE.Vector3; q0: THREE.Quaternion; last: THREE.Vector3 };
  deployed: boolean;
  broken: boolean;
}

const Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _v = new THREE.Vector3(), _t = new THREE.Vector3();
const _q = new THREE.Quaternion(), _col = new THREE.Color();

function bez(b: Flight['b'], s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - s;
  return out.copy(b[0]).multiplyScalar(u * u * u).addScaledVector(b[1], 3 * u * u * s).addScaledVector(b[2], 3 * u * s * s).addScaledVector(b[3], s * s * s);
}
function bezD(b: Flight['b'], s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - s;
  out.copy(b[1]).sub(b[0]).multiplyScalar(3 * u * u);
  out.addScaledVector(_c.copy(b[2]).sub(b[1]), 6 * u * s);
  return out.addScaledVector(_c.copy(b[3]).sub(b[2]), 3 * s * s);
}
const rnd = (out: THREE.Vector3, k: number) => out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * k);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function plan(world: World, id: number, t0: number): Omit<Flight, 'veh'> | null {
  const c = world.countries[id];
  const tile = c ? world.tiles[c.capitalTile] : undefined;
  if (!c || !tile) return null;
  const ring = ringFor(world, id);
  const n = new THREE.Vector3(...tile.center).normalize();
  const pad = n.clone().multiplyScalar(tileHeight(tile) + LIFT);
  // the satellite is released a little downrange, at the orbit position it will hold at that moment
  const tDep = t0 + HOLD + ASCENT;
  const w = omega(ring);
  const phase = DEPLOY_ANGLE - w * tDep;
  const q = ringPos(ring, DEPLOY_ANGLE, new THREE.Vector3());
  const qTan = ring.u.clone().multiplyScalar(-Math.sin(DEPLOY_ANGLE)).addScaledVector(ring.v, Math.cos(DEPLOY_ANGLE)).normalize();
  // straight up off the pad, then pitch over into the orbit's direction (a gravity turn)
  const b: Flight['b'] = [pad.clone(), pad.clone().addScaledVector(n, 0.2), q.clone().addScaledVector(qTan, -0.14), q.clone()];
  // s(tau) = a tau^2 + (1 - a) tau: slow off the pad, arriving at about orbital speed
  const end = 3 * 0.14;
  const want = (w * 1.24) * ASCENT / end;
  const accel = Math.min(0.85, Math.max(0.3, want - 1));
  return { id, t0, ring, phase, pad, n, b, accel, q, qTan, sepAt: t0 + HOLD + ASCENT * SEP_TAU, sep: null, deployed: false, broken: false };
}

export function Launch() {
  const camera = useThree((s) => s.camera);
  const fx = useMemo(() => ({ add: new Pool(900, true, false, 28), norm: new Pool(1100, false, true, 26) }), []);
  const group = useMemo(() => {
    const g = new THREE.Group();
    g.name = 'launches';
    g.add(fx.norm.points, fx.add.points);
    return g;
  }, [fx]);
  const st = useRef({ flights: [] as Flight[], queue: [] as number[], lastStart: -99, seen: new Set<string>(), worldId: null as string | null, now: 0 });

  // start a launch for each satellite the chronicle reports (one '-sat' line per satellite)
  useEffect(() => {
    const scan = () => {
      const s = useWorld.getState();
      const r = st.current;
      if ((s.world?.id ?? null) !== r.worldId) {
        r.worldId = s.world?.id ?? null;
        syncWorld(s.world);
        r.seen.clear();
        r.queue.length = 0;
        for (const f of r.flights) { group.remove(f.veh.root, f.veh.booster); f.veh.dispose(); }
        r.flights.length = 0;
        fx.add.clear(); fx.norm.clear();
      }
      for (const e of s.recentEvents) {
        if (e.type !== 'chronicle' || !e.entry.id.endsWith('-sat') || r.seen.has(e.entry.id)) continue;
        r.seen.add(e.entry.id);
        const id = e.entry.countries[0];
        if (id != null) enqueue(id);
      }
    };
    const enqueue = (id: number) => {
      const r = st.current;
      if (r.queue.length >= QUEUE_MAX) { deliver(id, Math.random() * Math.PI * 2); return; }   // too many at once: straight to orbit
      r.queue.push(id);
    };
    scan();
    const off = useWorld.subscribe(scan);
    let w: { __launch?: (id?: number) => number | null } | null = null;
    if (import.meta.env.DEV) {
      w = window as unknown as { __launch?: (id?: number) => number | null };
      // Dev: launch from this nation, or from the capital nearest the middle of the view.
      w.__launch = (id?: number) => {
        const world = useWorld.getState().world;
        if (!world) return null;
        let pick = id ?? null;
        if (pick == null) {
          const eye = camera.position.clone().normalize();
          let best = -2;
          world.countries.forEach((c, i) => {
            const t = world.tiles[c.capitalTile];
            if (!c.alive || !t) return;
            const d = _a.set(...t.center).normalize().dot(eye);
            if (d > best) { best = d; pick = i; }
          });
        }
        if (pick == null || !world.countries[pick]) return null;
        enqueue(pick);
        return pick;
      };
    }
    return () => { off(); if (w) delete w.__launch; };
  }, [camera, fx, group]);

  useEffect(() => () => {
    for (const f of st.current.flights) f.veh.dispose();
    fx.add.dispose(); fx.norm.dispose();
  }, [fx]);

  useFrame(({ clock }, delta) => {
    const r = st.current;
    const t = clock.elapsedTime;
    const now = t * 1000;
    const dt = Math.min(0.1, delta);
    const world = useWorld.getState().world;

    // lift-off for the next in the queue
    if (world && r.queue.length && r.flights.length < MAX_ACTIVE && t - r.lastStart >= GAP) {
      const id = r.queue.shift()!;
      const p = plan(world, id, t);
      if (p) {
        const veh = buildVehicle(rocketKit(), new THREE.Color(world.countries[id]!.color));
        veh.root.scale.setScalar(ROCKET_H);
        veh.booster.scale.setScalar(ROCKET_H);
        group.add(veh.root, veh.booster);
        r.flights.push({ ...p, veh });
        r.lastStart = t;
      }
    }

    const kit = rocketKit();
    for (let i = r.flights.length - 1; i >= 0; i--) {
      const f = r.flights[i]!;
      const e = t - f.t0;
      const { root, upper, lower, booster } = f.veh;
      const tau = Math.min(1, Math.max(0, (e - HOLD) / ASCENT));
      const s = f.accel * tau * tau + (1 - f.accel) * tau;

      // --- the rocket climbing (until deployment)
      if (!f.deployed) {
        bez(f.b, s, root.position);
        bezD(f.b, Math.max(0.001, s), _t).normalize();
        if (e < HOLD) _t.copy(f.n);
        root.quaternion.setFromUnitVectors(Y, _t);
        root.updateMatrixWorld();
        const alt = root.position.length();
        const lit = Math.min(1, e / 0.25);
        // engine flames: the booster's until separation, then the upper stage's (smaller, bluer)
        for (const th of kit.thrusters) {
          if (th.upper !== !!f.sep) continue;
          _a.copy(th.pos).applyMatrix4(root.matrixWorld);
          _b.copy(th.dir).transformDirection(root.matrixWorld);
          const big = th.upper ? 0.55 : 1;
          const k = dt * lit;
          for (let j = 0; j < Math.round(140 * k * big) + 1; j++) {
            _v.copy(_b).multiplyScalar((0.22 + Math.random() * 0.18) * big).add(rnd(_c, 0.025));
            fx.add.emit(now, _a, _v, 0.03 * big, 0.008, 220 + Math.random() * 140, 0.85, Math.random() < 0.5 ? C.flame : C.flameDeep, 1);
          }
          for (let j = 0; j < Math.round(70 * k * big) + 1; j++) {
            _v.copy(_b).multiplyScalar(0.3 * big);
            fx.add.emit(now, _a, _v, 0.02 * big, 0.006, 130, 1, th.upper ? C.blue : C.core);
          }
          fx.add.emit(now, _a, _c.set(0, 0, 0), 0.075 * big * lit, 0.06 * big, 60, 0.7, C.flash);
          // contrail in the air, thinner above it
          if (e > HOLD && Math.random() < dt * 60) {
            const air = alt < 1.15 ? 0.55 : 0.28;
            fx.norm.emit(now, _a, rnd(_v, 0.004), 0.014, 0.04, 3200 + Math.random() * 900, air, C.trail, 0.5);
          }
        }
        // the smoke column at the pad, growing while the rocket clears it
        if (e < 3.6) {
          const rate = e < HOLD ? 60 : 38;
          for (let j = 0; j < Math.round(rate * dt) + (Math.random() < (rate * dt) % 1 ? 1 : 0); j++) {
            rnd(_c, 1); _c.addScaledVector(f.n, -_c.dot(f.n)).normalize();
            _a.copy(f.pad).addScaledVector(_c, 0.006).addScaledVector(f.n, 0.004 + Math.random() * Math.min(0.05, e * 0.02));
            _v.copy(_c).multiplyScalar(0.03 + Math.random() * 0.04).addScaledVector(f.n, 0.012 + Math.random() * 0.012);
            fx.norm.emit(now, _a, _v, 0.02, 0.085 + Math.random() * 0.03, 3200 + Math.random() * 1800, 0.62, Math.random() < 0.6 ? C.smoke : C.smokeDark, 0.7);
          }
          if (e < HOLD + 0.6) fx.add.emit(now, f.pad, _c.set(0, 0, 0), 0.09, 0.07, 80, 0.45, C.flame);
        }

        // --- stage separation: a flash and a puff, the booster lets go
        if (!f.sep && t >= f.sepAt) {
          _a.set(0, kit.sep.y, 0).applyMatrix4(root.matrixWorld);
          fx.add.emit(now, _a, _c.set(0, 0, 0), 0.14, 0.2, 420, 1, C.flash);
          for (let j = 0; j < 16; j++) fx.norm.emit(now, _a, rnd(_v, 0.05), 0.014, 0.055, 1500 + Math.random() * 600, 0.6, C.trail, 1.5);
          for (let j = 0; j < 14; j++) fx.add.emit(now, _a, rnd(_v, 0.09), 0.012, 0.003, 500 + Math.random() * 300, 1, C.spark, 1.2);
          const sPos = new THREE.Vector3(0, kit.sep.y / 2, 0).applyMatrix4(root.matrixWorld);
          const ds = (2 * f.accel * tau + (1 - f.accel)) / ASCENT;
          const vel = bezD(f.b, s, new THREE.Vector3()).multiplyScalar(ds * 0.8);
          const dir = sPos.clone().normalize();
          const h0 = sPos.length();
          const vr = vel.dot(dir);
          const hv = vel.clone().addScaledVector(dir, -vr);
          const hs = Math.max(1e-5, hv.length());
          const g = Math.max(0.004, (2 * (h0 + vr * BOOSTER_FALL - BREAKUP_ALT)) / (BOOSTER_FALL * BOOSTER_FALL));
          f.sep = { s: sPos, dir, h: hv.divideScalar(hs), h0, vr, g, w: hs / h0, spin: new THREE.Vector3().crossVectors(dir, hv).normalize(), q0: root.quaternion.clone(), last: sPos.clone() };
          lower.visible = false;
          booster.visible = true;
        }

        // --- deployment: the satellite goes to Orbit.tsx at its orbit slot
        if (tau >= 1) {
          f.deployed = true;
          deliver(f.id, f.phase);
          _a.set(0, 1, 0).applyMatrix4(root.matrixWorld);
          fx.add.emit(now, _a, _c.set(0, 0, 0), 0.07, 0.1, 300, 0.9, C.flash);
          for (let j = 0; j < 8; j++) fx.norm.emit(now, _a, rnd(_v, 0.03), 0.01, 0.03, 1000, 0.5, C.trail, 1.5);
        }
      } else {
        // the spent upper stage falls behind the satellite and fades
        const d = e - HOLD - ASCENT;
        root.position.copy(f.q).addScaledVector(f.qTan, d * 0.05).addScaledVector(_a.copy(f.q).normalize(), -d * 0.008);
        const k = Math.max(0, 1 - d / FADE);
        for (const m of f.veh.upperMats) m.opacity = k;
        upper.visible = k > 0;
      }

      // --- the booster: a ballistic fall, heating up, then breaking up into sparks
      if (f.sep && !f.broken) {
        const sp = f.sep;
        const d = t - f.sepAt;
        const h = sp.h0 + sp.vr * d - 0.5 * sp.g * d * d;
        const ang = sp.w * d;
        booster.position.copy(sp.dir).multiplyScalar(Math.cos(ang)).addScaledVector(sp.h, Math.sin(ang)).multiplyScalar(h);
        booster.quaternion.copy(_q.setFromAxisAngle(sp.spin, d * 1.1)).multiply(sp.q0);
        _v.copy(booster.position).sub(sp.last).divideScalar(Math.max(1e-4, dt));
        sp.last.copy(booster.position);
        const heat = Math.min(1, Math.max(0, (1.17 - h) / (1.17 - 1.1)));
        const white = Math.max(0, heat - 0.55) / 0.45;
        _col.copy(C.heatOrange).lerp(C.heatWhite, white);
        for (const m of f.veh.boosterMats) { m.emissive.copy(_col); m.emissiveIntensity = heat * 2.2; }
        if (heat > 0) {
          const n = Math.round(110 * dt * heat) + 1;
          for (let j = 0; j < n; j++) {
            _a.copy(booster.position).addScaledVector(_v, -Math.random() * dt);
            fx.add.emit(now, _a, _b.copy(_v).multiplyScalar(-0.08).add(rnd(_c, 0.006)), 0.028 * (0.6 + heat), 0.006, 700 + Math.random() * 500, 0.9 * heat, _col, 0.5);
          }
          fx.add.emit(now, booster.position, _c.set(0, 0, 0), 0.06 + 0.06 * heat, 0.05, 70, 0.8 * heat, _col);
          if (Math.random() < dt * 30) fx.norm.emit(now, booster.position, rnd(_b, 0.003), 0.012, 0.04, 1800, 0.35 * heat, C.smokeDark, 0.5);
        }
        if (h <= BREAKUP_ALT || d > BOOSTER_FALL + 1.5) {
          f.broken = true;
          booster.visible = false;
          _a.copy(booster.position).normalize();
          _b.copy(_v).addScaledVector(_a, -_v.dot(_a)).multiplyScalar(0.5);   // no downward push: sparks die in the air
          fx.add.emit(now, booster.position, _c.set(0, 0, 0), 0.16, 0.22, 380, 1, C.heatWhite);
          for (let j = 0; j < 70; j++) {
            _v.copy(_b).addScaledVector(_a, 0.02).add(rnd(_c, 0.07));
            const hot = Math.random();
            fx.add.emit(now, booster.position, _v, 0.016 * (0.6 + Math.random()), 0.002, 600 + Math.random() * 800, 1, hot < 0.35 ? C.heatWhite : hot < 0.75 ? C.spark : C.heatOrange, 1.6);
          }
        }
      }

      // done: the upper stage has faded and the booster has burned up
      if (f.deployed && f.broken && e > HOLD + ASCENT + FADE) {
        group.remove(root, booster);
        f.veh.dispose();
        r.flights.splice(i, 1);
      }
    }

    const scale = pointScale(camera);
    fx.add.update(now, dt * 1000, scale);
    fx.norm.update(now, dt * 1000, scale);
  });

  return <primitive object={group} />;
}
