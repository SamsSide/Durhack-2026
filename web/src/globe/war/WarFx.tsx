// War you can read at a glance (B14): a burst at every battle (flash, fireball or dust and fire, debris
// sparks, a smoke plume that drifts and fades over ~3 s, and a shockwave ring from the modern age on),
// thin smoke columns over devastated or besieged provinces, and a dust collapse when a province falls to
// ruin. The small clash badge, loss numbers and muzzle sparks stay in units/UnitLayer; this is the big
// readable layer on top. Everything is pooled: two Points draw calls and a few rings. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ageIndex } from '@terra/shared';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { useEventStream } from '../status/useEventStream';
import { ParticlePool } from './particles';
import { markSacked, onRuinChange } from './ruins';

const MAX_BURSTS = 12;
const MAX_COLUMNS = 24;
const FRONT_AT = 40;            // devastation that keeps a smoke column over a province
const COLUMN_EVERY_MS = 420;
const RINGS = 6;
const RING_MS = 900;
const SAME_TILE_MS = 600;       // at top speed one tile can fight every frame: one burst is enough

const C = {
  flash: new THREE.Color('#fff4d6'),
  fire0: new THREE.Color('#ffd166'), fire1: new THREE.Color('#b8321a'),
  spark: new THREE.Color('#ffb04a'),
  smoke0: new THREE.Color('#2f2b28'), smoke1: new THREE.Color('#8d877f'),
  dust0: new THREE.Color('#a88a5e'), dust1: new THREE.Color('#d9cbb0'),
  front0: new THREE.Color('#2b2724'), front1: new THREE.Color('#7d776f'),
  ring: new THREE.Color('#ffe2a8'), ringFuture: new THREE.Color('#9fe6ff'),
};
const UP = new THREE.Vector3(0, 1, 0);
const _j = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _size = new THREE.Vector2();
const ringGeo = new THREE.RingGeometry(0.92, 1, 56);
const Z = new THREE.Vector3(0, 0, 1);

/** The two particle pools, shared with the firing effects (Firing.tsx) so their impacts cost no draw calls. */
export const warPools: { fire: ParticlePool | null; smoke: ParticlePool | null } = { fire: null, smoke: null };

interface Column { tile: number; pos: THREE.Vector3; n: THREE.Vector3; wind: THREE.Vector3; next: number; thick: number }
interface Ring { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; born: number; size: number }

/** A random tangent vector at n, length up to amount. */
function jitter(out: THREE.Vector3, n: THREE.Vector3, amount: number): THREE.Vector3 {
  out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  out.addScaledVector(n, -out.dot(n));
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0).addScaledVector(n, -n.x);
  return out.normalize().multiplyScalar(amount * Math.random());
}

/** A steady wind along the parallels, so plumes lean the same way across one region. */
function windAt(n: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  out.crossVectors(UP, n);
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
  return out.normalize();
}

/** Provinces that smoke: devastation over FRONT_AT, or an enemy army standing on them at war. */
function frontTiles(w: World): Array<[number, number]> {
  const out = new Map<number, number>();
  const d = w.devastation;
  if (d) for (let i = 0; i < d.length; i++) if (d[i]! >= FRONT_AT) out.set(i, d[i]!);
  for (const u of w.units) {
    if (u.kind !== 'army' || u.tile < 0) continue;
    const o = w.owner[u.tile] ?? -1;
    if (o < 0 || o === u.owner) continue;
    const lo = Math.min(o, u.owner), hi = Math.max(o, u.owner);
    if (w.relations.some((r) => r.a === lo && r.b === hi && r.stance === 'war')) out.set(u.tile, Math.max(out.get(u.tile) ?? 0, FRONT_AT));
  }
  return [...out].sort((a, b) => b[1] - a[1]).slice(0, MAX_COLUMNS);
}

export function WarFx() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const fx = useMemo(() => {
    const fire = new ParticlePool(512, true, 1.6, 27);
    const smoke = new ParticlePool(576, false, 0.9, 25);
    const group = new THREE.Group();
    group.add(smoke.points, fire.points);
    const rings: Ring[] = [];
    for (let i = 0; i < RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: C.ring, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.visible = false;
      m.renderOrder = 26;
      group.add(m);
      rings.push({ mesh: m, mat, born: -1, size: 0.1 });
    }
    return { fire, smoke, group, rings };
  }, []);
  useEffect(() => {
    warPools.fire = fx.fire; warPools.smoke = fx.smoke;
    return () => { if (warPools.fire === fx.fire) { warPools.fire = null; warPools.smoke = null; } };
  }, [fx]);
  useEffect(() => () => { fx.fire.dispose(); fx.smoke.dispose(); for (const r of fx.rings) r.mat.dispose(); }, [fx]);

  const st = useRef({
    slot: 0, ring: 0, lastAt: new Map<number, number>(), columns: [] as Column[],
    frontAt: 0, frontVersion: -1, ruinQueue: [] as number[],
  });

  useEffect(() => {
    const s = st.current;
    s.columns = []; s.lastAt.clear(); s.ruinQueue = []; s.frontVersion = -1;
  }, [world?.id]);

  const tilePos = (tile: number, lift: number, out: THREE.Vector3): boolean => {
    if (!mesh) return false;
    const c = mesh.centroidOf([tile]);
    out.set(c[0], c[1], c[2]);
    if (out.lengthSq() === 0) return false;
    out.setLength(out.length() + lift);
    return true;
  };

  const burst = (tile: number, age: number, now: number): void => {
    const s = st.current;
    const P = new THREE.Vector3();
    if (!tilePos(tile, 0.004, P)) return;
    const n = P.clone().normalize();
    const wind = windAt(n, new THREE.Vector3());
    const tag = s.slot;
    s.slot = (s.slot + 1) % MAX_BURSTS;
    fx.fire.kill(tag); fx.smoke.kill(tag); // the oldest burst gives up its slot
    const tier = age >= 4 ? 2 : age >= 2 ? 1 : 0;
    const S = [1, 1.25, 1.7][tier]!;
    const { fire, smoke } = fx;

    // the flash
    fire.emit(now, P, _d.set(0, 0, 0), 0.045 * S, 0.11 * S, 300, 1, C.flash, { tag });
    if (tier === 1) for (let i = 0; i < 6; i++) { // a ragged volley of muzzle flashes
      _p.copy(P).add(jitter(_j, n, 0.02));
      fire.emit(now, _p, _d.set(0, 0, 0), 0.01, 0.018, 140, 1, C.flash, { tag, delay: 120 + Math.random() * 700 });
    }
    if (tier === 0) {
      // dust thrown up by the melee, low and wide, and fires that flicker on
      for (let i = 0; i < 9; i++) {
        _p.copy(P).add(jitter(_j, n, 0.012));
        _d.copy(jitter(_j, n, 0.035)).addScaledVector(n, 0.008);
        smoke.emit(now, _p, _d, 0.016, 0.055, 1900, 0.6, C.dust0, { tag, c1: C.dust1, delay: i * 60 });
      }
      for (let i = 0; i < 6; i++) {
        _p.copy(P).add(jitter(_j, n, 0.014));
        fire.emit(now, _p, _d.copy(n).multiplyScalar(0.01), 0.016, 0.034, 750, 0.9, C.fire0, { tag, c1: C.fire1, delay: 150 + i * 160 });
      }
    } else {
      // the fireball: a cluster that swells, rises a little and cools from yellow to red
      for (let i = 0; i < 8; i++) {
        _p.copy(P).add(jitter(_j, n, 0.008 * S));
        _d.copy(jitter(_j, n, 0.018 * S)).addScaledVector(n, 0.025 * S);
        fire.emit(now, _p, _d, 0.028 * S, 0.085 * S, 700 + Math.random() * 450, 0.95, C.fire0, { tag, c1: C.fire1, delay: 40 + i * 25 });
      }
    }
    // debris sparks
    const nSparks = [12, 18, 28][tier]!;
    for (let i = 0; i < nSparks; i++) {
      _d.copy(jitter(_j, n, 0.05 * S)).addScaledVector(n, 0.025 * S * Math.random());
      fire.emit(now, P, _d, 0.006, 0.004, 600 + Math.random() * 500, 1, C.spark, { tag, c1: C.fire1, delay: 60 + Math.random() * 120 });
    }
    // the smoke plume: rises, leans with the wind and fades over ~3 s
    for (let i = 0; i < 9; i++) {
      _p.copy(P).add(jitter(_j, n, 0.006 * S));
      _d.copy(n).multiplyScalar((0.06 + Math.random() * 0.03) * S).addScaledVector(wind, 0.035 * S).add(jitter(_j, n, 0.01));
      smoke.emit(now, _p, _d, 0.012 * S, (0.05 + Math.random() * 0.015) * S, 2900, 0.62, C.smoke0, { tag, c1: C.smoke1, delay: 150 + i * 200 });
    }
    // modern and later: a shockwave ring along the ground
    if (tier === 2) {
      const r = fx.rings[s.ring]!;
      s.ring = (s.ring + 1) % RINGS;
      r.born = now; r.size = 0.075 * S;
      r.mesh.position.copy(P).setLength(P.length() + 0.001);
      r.mesh.quaternion.setFromUnitVectors(Z, n);
      r.mat.color.copy(age >= 5 ? C.ringFuture : C.ring);
      r.mesh.visible = true;
    }
  };

  const collapse = (tile: number, now: number): void => {
    const P = new THREE.Vector3();
    if (!tilePos(tile, 0.003, P)) return;
    const n = P.clone().normalize();
    for (let i = 0; i < 7; i++) {
      _p.copy(P).add(jitter(_j, n, 0.01));
      _d.copy(jitter(_j, n, 0.03)).addScaledVector(n, 0.012);
      fx.smoke.emit(now, _p, _d, 0.014, 0.045, 2200, 0.55, C.dust0, { c1: C.dust1, delay: i * 70 });
    }
    for (let i = 0; i < 8; i++) {
      _d.copy(jitter(_j, n, 0.025)).addScaledVector(n, 0.02 * Math.random());
      fx.fire.emit(now, P, _d, 0.005, 0.003, 900, 1, C.spark, { c1: C.fire1, delay: Math.random() * 300 });
    }
  };

  // Dev only: __warFx(tile, age) fires one burst, for a browser review.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const win = window as unknown as { __warFx?: (tile: number, age?: number) => void };
    win.__warFx = (tile, age = 0) => burst(tile, age, performance.now());
    return () => { delete win.__warFx; };
  });

  useEffect(() => onRuinChange((tile, ruin) => {
    if (!ruin) return;
    const q = st.current.ruinQueue;
    if (q.length < 30) q.push(tile);
  }), []);

  useEventStream((events) => {
    const w = useWorld.getState().world;
    if (!w) return;
    const now = performance.now();
    const s = st.current;
    const battles: Array<{ tile: number; age: number }> = [];
    for (const e of events) {
      if (e.type === 'battle') battles.push({ tile: e.tile, age: ageIndex(w.countries[e.attacker]?.techAge) });
      else if (e.type === 'tile_claimed' && e.cause === 'conquest' && e.from >= 0) markSacked(w, e.tile);
    }
    // at top speed a batch can hold dozens: the newest few, one per tile
    let shown = 0;
    for (let i = battles.length - 1; i >= 0 && shown < 4; i--) {
      const b = battles[i]!;
      const last = s.lastAt.get(b.tile) ?? -Infinity;
      if (now - last < SAME_TILE_MS) continue;
      s.lastAt.set(b.tile, now);
      burst(b.tile, b.age, now);
      shown++;
    }
    if (s.lastAt.size > 200) s.lastAt.clear();
  });

  useFrame(({ gl, camera }) => {
    const now = performance.now();
    const s = st.current;
    const state = useWorld.getState();
    const w = state.world;

    // front columns: re-read at most 4 times a second
    if (w && mesh && state.version !== s.frontVersion && now - s.frontAt > 250) {
      s.frontVersion = state.version; s.frontAt = now;
      const want = frontTiles(w);
      const keep = new Map(s.columns.map((c) => [c.tile, c]));
      const next: Column[] = [];
      for (const [tile, d] of want) {
        const have = keep.get(tile);
        const thick = Math.min(1, 0.5 + (d - FRONT_AT) / 60);
        if (have) { have.thick = thick; next.push(have); continue; }
        const pos = new THREE.Vector3();
        if (!tilePos(tile, 0.003, pos)) continue;
        const n = pos.clone().normalize();
        next.push({ tile, pos, n, wind: windAt(n, new THREE.Vector3()), next: now + Math.random() * COLUMN_EVERY_MS, thick });
      }
      s.columns = next;
    }
    for (const c of s.columns) {
      if (c.next > now) continue;
      c.next = now + COLUMN_EVERY_MS * (1.4 - 0.4 * c.thick);
      _p.copy(c.pos).add(jitter(_j, c.n, 0.004));
      _d.copy(c.n).multiplyScalar(0.07).addScaledVector(c.wind, 0.075).add(jitter(_j, c.n, 0.012));
      fx.smoke.emit(now, _p, _d, 0.01, 0.045 + 0.025 * c.thick, 3400, 0.4 + 0.25 * c.thick, C.front0, { c1: C.front1 });
    }

    for (let i = 0; i < 3 && s.ruinQueue.length; i++) collapse(s.ruinQueue.shift()!, now);

    for (const r of fx.rings) {
      if (r.born < 0) continue;
      const t = (now - r.born) / RING_MS;
      if (t >= 1) { r.born = -1; r.mesh.visible = false; continue; }
      const e = 1 - (1 - t) * (1 - t) * (1 - t);
      r.mesh.scale.setScalar(0.008 + r.size * e);
      r.mat.opacity = 0.6 * (1 - t) * (1 - t);
    }

    gl.getDrawingBufferSize(_size);
    const px = _size.y * 0.5 * camera.projectionMatrix.elements[5]!;
    fx.fire.update(now, px);
    fx.smoke.update(now, px);
  });

  return <primitive object={fx.group} />;
}
