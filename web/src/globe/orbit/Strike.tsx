// Satellites shot down in future-age wars (owner, #317 item 15). On each `satellite_lost` event a strike
// streaks up from the attacker's capital to where the victim's satellite will be, a flash and a small
// burst of debris mark the hit, and the satellite leaves its ring (launchState.lose) while its wreck
// tumbles inward and fades. Two pooled point systems and a fixed set of wreck meshes; per frame only
// transforms, opacities and the particle buffers change. Mounted by Orbit.tsx, in the same frame as
// the satellites. Dev: window.__shootDown(victim?, attacker?, slow?). Lane a.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';
import { LIFT } from '../constants';
import { C, Pool, pointScale } from './launchFx';
import { deliver, lose, omega, ringFor, ringPos, satPhases } from './launchState';
import type { Ring } from './launchState';

const FLIGHT = 2.2;          // s from launch to impact
const ARC = 0.22;            // how far the path bows outwards (world units)
const WRECK_LIFE = 3.6;      // s the wreck tumbles before it is gone
const WRECKS = 3;            // wreck meshes in the pool (at most this many falling at once)
const MAX_STRIKES = 4;       // strikes in flight at once; more are skipped (the satellite just leaves its ring)
const BOX = 0.016;           // wreck size, about the satellite's body

interface Flight { victim: number; index: number; t0: number; p0: THREE.Vector3; ctrl: THREE.Vector3; ring: Ring; phase: number; hit: boolean; color: THREE.Color; last?: THREE.Vector3 }
interface Wreck { g: THREE.Group; mat: THREE.MeshStandardMaterial; t0: number; v: THREE.Vector3; spin: THREE.Vector3; busy: boolean }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _v = new THREE.Vector3(), _e2 = new THREE.Vector3(), _e = new THREE.Euler();
const rnd = (out: THREE.Vector3, k: number) => out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * k);
const RED = new THREE.Color('#ff4a2a');

/** Where the strike is at s in 0..1: a quadratic curve from the launch point to the moving target. */
function pathAt(f: Flight, target: THREE.Vector3, s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - s;
  return out.copy(f.p0).multiplyScalar(u * u).addScaledVector(f.ctrl, 2 * u * s).addScaledVector(target, s * s);
}

export function Strike() {
  const camera = useThree((s) => s.camera);
  const fx = useMemo(() => ({ add: new Pool(700, true, false, 29), norm: new Pool(260, false, true, 27) }), []);
  const kit = useMemo(() => {
    const body = new THREE.BoxGeometry(BOX, BOX * 0.7, BOX * 0.7);
    const panel = new THREE.BoxGeometry(BOX * 1.2, BOX * 0.05, BOX * 0.6);
    const wrecks: Wreck[] = [];
    for (let i = 0; i < WRECKS; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.4, roughness: 0.6, emissive: '#ff6a1a', emissiveIntensity: 0, transparent: true, flatShading: true });
      const g = new THREE.Group();
      const b = new THREE.Mesh(body, mat);
      const p = new THREE.Mesh(panel, mat);
      p.position.set(BOX * 0.9, 0, 0);
      p.rotation.set(0.6, 0, 0.4);
      g.add(b, p);
      g.visible = false;
      wrecks.push({ g, mat, t0: 0, v: new THREE.Vector3(), spin: new THREE.Vector3(), busy: false });
    }
    return { body, panel, wrecks };
  }, []);
  const group = useMemo(() => {
    const g = new THREE.Group();
    g.name = 'satellite-strikes';
    g.add(fx.norm.points, fx.add.points);
    for (const w of kit.wrecks) g.add(w.g);
    return g;
  }, [fx, kit]);
  const st = useRef({ flights: [] as Flight[], seen: new Set<string>(), worldId: null as string | null, pending: [] as { attacker: number; victim: number; index: number }[], now: 0, lt: 0, rate: 1 });

  useEffect(() => {
    const scan = () => {
      const s = useWorld.getState();
      const r = st.current;
      if ((s.world?.id ?? null) !== r.worldId) { r.worldId = s.world?.id ?? null; r.seen.clear(); r.flights.length = 0; fx.add.clear(); fx.norm.clear(); }
      for (const e of s.recentEvents) {
        if (e.type !== 'satellite_lost' || r.seen.has(e.id)) continue;
        r.seen.add(e.id);
        r.pending.push({ attacker: e.attacker, victim: e.victim, index: e.index });
      }
    };
    scan();
    const off = useWorld.subscribe(scan);
    type Dev = { __shootDown?: (victim?: number, attacker?: number, slow?: number) => number | null };
    let w: Dev | null = null;
    if (import.meta.env.DEV) {
      w = window as unknown as Dev;
      // Dev: shoot down a satellite of this nation (else of the capital nearest the middle of the view; one
      // is put up in view first if it has none), from this attacker (else its nearest neighbour); `slow` (0..1) plays it in slow motion.
      w.__shootDown = (victim?: number, attacker?: number, slow?: number) => {
        const world = useWorld.getState().world;
        if (!world) return null;
        const alive = world.countries.filter((c) => c.alive && world.tiles[c.capitalTile]);
        const capDir = (id: number) => _c.set(...world.tiles[world.countries[id]!.capitalTile]!.center).normalize();
        const nearest = (to: THREE.Vector3, skip: number) => {
          let best = -2, pick: number | null = null;
          for (const c of alive) { if (c.id === skip) continue; const d = capDir(c.id).dot(to); if (d > best) { best = d; pick = c.id; } }
          return pick;
        };
        const v = victim ?? nearest(camera.position.clone().normalize(), -1);
        if (v == null) return null;
        const a = attacker ?? nearest(capDir(v).clone(), v) ?? v;
        if (!satPhases(v).length) {
          // put one up where the strike reads well: just past the point of its ring nearest the attacker
          const ring = ringFor(world, v), to = capDir(a).clone();
          deliver(v, Math.atan2(ring.v.dot(to), ring.u.dot(to)) + 0.35 - (st.current.now + FLIGHT) * omega(ring));
        }
        st.current.pending.push({ attacker: a, victim: v, index: 0 });
        st.current.rate = slow && slow > 0 ? Math.min(1, slow) : 1;   // e.g. 0.1 for a slow-motion review
        return v;
      };
    }
    return () => { off(); if (w) delete w.__shootDown; };
  }, [camera, fx]);

  useEffect(() => () => {
    fx.add.dispose(); fx.norm.dispose(); kit.body.dispose(); kit.panel.dispose();
    for (const w of kit.wrecks) w.mat.dispose();
  }, [fx, kit]);

  useFrame(({ clock }, delta) => {
    const r = st.current;
    const t = clock.elapsedTime;                       // the satellites' clock (Orbit.tsx), for where they are
    r.now = t;
    const dt = Math.min(0.1, delta) * r.rate;          // the strikes' own clock (slowed only by the dev handle)
    r.lt += dt;
    const lt = r.lt;
    const now = lt * 1000;
    const world = useWorld.getState().world;

    // start the strikes that came in: from the attacker's capital towards the victim's satellite
    while (world && r.pending.length) {
      const p = r.pending.shift()!;
      const list = satPhases(p.victim);
      if (!list.length) continue;                       // nothing drawn for it this session
      const index = Math.min(p.index, list.length - 1);
      const tile = world.tiles[world.countries[p.attacker]?.capitalTile ?? -1];
      if (!tile || r.flights.length >= MAX_STRIKES) { lose(p.victim, index); continue; }
      const n = new THREE.Vector3(...tile.center).normalize();
      const p0 = n.clone().multiplyScalar(tileHeight(tile) + LIFT);
      const ring = ringFor(world, p.victim);
      const phase = list[index]!;
      const hitAt = ringPos(ring, (t + FLIGHT) * omega(ring) + phase, new THREE.Vector3());
      const mid = p0.clone().add(hitAt).multiplyScalar(0.5);
      // bow outwards over the middle; a target on the far side of the planet: climb straight up first
      const ctrl = (mid.length() < 0.35 ? n.clone() : mid.normalize()).multiplyScalar(Math.max(p0.length(), hitAt.length()) + ARC);
      r.flights.push({ victim: p.victim, index, t0: lt, p0, ctrl, ring, phase, hit: false, color: new THREE.Color(world.countries[p.attacker]?.color ?? '#ffffff') });
      for (let j = 0; j < 10; j++) fx.norm.emit(now, p0, rnd(_v, 0.02).addScaledVector(n, 0.02), 0.012, 0.05, 1800, 0.55, C.smoke, 1);
      fx.add.emit(now, p0, _c.set(0, 0, 0), 0.06, 0.05, 200, 0.9, C.flash);
    }

    for (let i = r.flights.length - 1; i >= 0; i--) {
      const f = r.flights[i]!;
      const s = Math.min(1, (lt - f.t0) / FLIGHT);
      // the target, where the satellite is now (the path ends where it will be at impact)
      ringPos(f.ring, t * omega(f.ring) + f.phase, _b);
      const head = pathAt(f, _b, s * s * (3 - 2 * s) * 0.15 + s * 0.85, _a);
      if (!f.hit) {
        // the streak: a hot head and a fading trail behind it, filled in along the stretch flown since the
        // last frame so it stays one line whatever the frame rate
        fx.add.emit(now, head, _c.set(0, 0, 0), 0.055, 0.02, 140, 1, C.core);
        fx.add.emit(now, head, _c.set(0, 0, 0), 0.09, 0.03, 90, 0.5, RED);
        const from = f.last ?? head;
        const steps = Math.min(24, Math.max(1, Math.ceil(from.distanceTo(head) / 0.006)));
        for (let j = 1; j <= steps; j++) {
          _e2.copy(from).lerp(head, j / steps);
          fx.add.emit(now, _e2, rnd(_v, 0.004), 0.026, 0.006, 600 + Math.random() * 300, 0.95, j & 1 ? RED : C.flame, 1);
          if (j % 3 === 0 || steps < 3) fx.norm.emit(now, _e2, rnd(_v, 0.002), 0.012, 0.034, 1800, 0.35, C.trail, 0.5);
        }
        (f.last ??= new THREE.Vector3()).copy(head);
      }
      if (s >= 1 && !f.hit) {
        f.hit = true;
        // the flash and the debris, then the satellite leaves its ring and its wreck tumbles away
        fx.add.emit(now, _b, _c.set(0, 0, 0), 0.3, 0.4, 480, 1, C.flash);
        fx.add.emit(now, _b, _c.set(0, 0, 0), 0.16, 0.3, 1100, 0.7, C.flame);
        fx.add.emit(now, _b, _c.set(0, 0, 0), 0.12, 0.2, 900, 0.8, f.color);
        for (let j = 0; j < 64; j++) {
          const hot = Math.random();
          fx.add.emit(now, _b, rnd(_v, 0.09), 0.02 * (0.6 + Math.random()), 0.004, 900 + Math.random() * 1200, 1, hot < 0.3 ? C.heatWhite : hot < 0.7 ? C.spark : C.heatOrange, 1.2);
        }
        for (let j = 0; j < 12; j++) fx.norm.emit(now, _b, rnd(_v, 0.02), 0.016, 0.07, 2600, 0.45, C.smokeDark, 0.8);
        lose(f.victim, f.index);
        const wr = kit.wrecks.find((w) => !w.busy);
        if (wr) {
          wr.busy = true; wr.t0 = lt;
          wr.g.position.copy(_b);
          // along the orbit a little (its old speed, slowed), and inwards: it drops off its ring
          const tan = _c.copy(f.ring.u).multiplyScalar(-Math.sin(t * omega(f.ring) + f.phase)).addScaledVector(f.ring.v, Math.cos(t * omega(f.ring) + f.phase));
          wr.v.copy(tan).multiplyScalar(omega(f.ring) * 1.24 * 0.5).addScaledVector(_b.clone().normalize(), -0.012);
          rnd(wr.spin, 4);
          wr.g.visible = true;
        }
        r.flights.splice(i, 1);
      }
    }

    for (const w of kit.wrecks) {
      if (!w.busy) continue;
      const e = lt - w.t0;
      if (e >= WRECK_LIFE) { w.busy = false; w.g.visible = false; continue; }
      w.g.position.addScaledVector(w.v, dt);
      w.v.addScaledVector(_a.copy(w.g.position).normalize(), -0.02 * dt);   // falls a little faster as it goes
      _e.set(w.spin.x * e, w.spin.y * e, w.spin.z * e);
      w.g.rotation.copy(_e);
      const k = 1 - e / WRECK_LIFE;
      w.mat.opacity = k;
      w.mat.emissiveIntensity = Math.max(0, 1.6 - e * 1.2);
      if (Math.random() < dt * 14 * k) fx.add.emit(now, w.g.position, rnd(_v, 0.004), 0.01, 0.002, 500, 0.8 * k, C.spark, 1);
    }

    if (r.rate !== 1 && !r.flights.length && !r.pending.length && !kit.wrecks.some((w) => w.busy)) r.rate = 1;
    const sc = pointScale(camera);
    fx.add.update(now, dt * 1000, sc);
    fx.norm.update(now, dt * 1000, sc);
  });

  return <primitive object={group} />;
}
