// Trader ships: merchant hulls gliding tile by tile over the ocean, moves chained so they never stop
// and start, bobbing on the water with a faint wake. No counter, no arrow. Lane b.
import * as THREE from 'three';
import type { Unit } from '@terra/shared';
import { arcPoint } from './ribbons';
import { drawDot, toTexture } from './draw';
import { facing } from './effects';
import { standMatrix } from './ModelField';
import type { ModelField } from './ModelField';
import type { UnitModel } from './unitModels';
import type { VehicleFx } from './vehicleFx';
import { DISSOLVE_MS, DWELL_MS, dissolveAlpha } from './speed';

interface Seg { to: number; ms: number }
interface TState {
  id: string; owner: number; seed: number;
  from: number; to: number; t0: number; t1: number;
  queue: Seg[];
  head: THREE.Vector3; pos: THREE.Vector3;
  born: number; gone: number; // fade in / sink out (ms timestamps; gone < 0 while alive)
  nextWake: number;
  /** The leg is too fast to watch: fade out at `from`, fade in at `to` (see speed.ts). */
  dissolve: boolean;
  ghost: THREE.Vector3 | null; // a glide cut short by a speed change fades out from here
  landAt: number; inAt: number;
}

const WAKE = 640;
const WAKE_LIFE = 1800;
const WAKE_EVERY = 110;
const FADE_MS = 700;
const FX_RANGE = 2.4; // vehicle effects only when the camera is this close

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export interface TraderHost {
  fx?: VehicleFx;
  dirs: THREE.Vector3[];
  heights: Float32Array;
  msPerTick(): number;
  /** Would a leg between two tiles in `ms` be faster than a trader may go on screen? */
  tooFast(from: number, to: number, ms: number): boolean;
  model(owner: number): UnitModel;
  team(owner: number): THREE.Color;
  pop(owner: number, now: number): number; // age-change bounce, 1 when none
}

export class Traders {
  readonly group = new THREE.Group();
  private readonly states = new Map<string, TState>();
  private readonly pending = new Map<string, { from: number; to: number; ms: number }>();
  private readonly wakePos = new Float32Array(WAKE * 3);
  private readonly wakeCol = new Float32Array(WAKE * 3);
  private readonly wakeBorn = new Float64Array(WAKE).fill(-1);
  private readonly wakeBase: THREE.Color;
  private readonly wake: THREE.Points;
  private readonly tex: THREE.Texture;
  private nextW = 0;

  constructor(private readonly host: TraderHost, foam: string, private readonly size: number) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.wakePos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.wakeCol, 3));
    this.tex = toTexture(drawDot());
    const mat = new THREE.PointsMaterial({
      size: size * 0.55, sizeAttenuation: true, vertexColors: true, map: this.tex, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.wake = new THREE.Points(g, mat);
    this.wake.frustumCulled = false;
    this.wake.renderOrder = 6;
    this.wakeBase = new THREE.Color(foam).multiplyScalar(0.45);
    this.group.add(this.wake);
    this.group.name = 'traders';
  }

  has(id: string): boolean { return this.states.has(id); }

  /** Where the trader will be once its queued moves are done. */
  private tail(st: TState): number {
    return st.queue.length ? st.queue[st.queue.length - 1]!.to : st.to;
  }

  /** A unit_moved for a trader: queue it behind the moves already under way. */
  move(id: string, from: number, to: number, ms: number): void {
    const st = this.states.get(id);
    if (!st) { this.pending.set(id, { from, to, ms }); return; }
    if (this.tail(st) === to) return;
    st.queue.push({ to, ms });
  }

  sync(units: Unit[], now: number): void {
    const seen = new Set<string>();
    for (const u of units) {
      if (u.kind !== 'trader') continue;
      seen.add(u.id);
      let st = this.states.get(u.id);
      if (!st) {
        const pm = this.pending.get(u.id);
        const start = pm && pm.to === u.tile ? pm.from : u.tile;
        st = {
          id: u.id, owner: u.owner, seed: hash(u.id) * Math.PI * 2,
          from: start, to: start, t0: 0, t1: 0, queue: [],
          head: new THREE.Vector3(), pos: new THREE.Vector3(), born: now, gone: -1, nextWake: now,
          dissolve: false, ghost: null, landAt: -1e9, inAt: -1e9,
        };
        if (start !== u.tile) st.queue.push({ to: u.tile, ms: pm!.ms });
        this.states.set(u.id, st);
      } else if (this.tail(st) !== u.tile) {
        st.queue.push({ to: u.tile, ms: this.host.msPerTick() });
      }
      st.owner = u.owner;
      if (st.gone >= 0) st.gone = -1;
    }
    for (const st of this.states.values()) if (!seen.has(st.id) && st.gone < 0) st.gone = now;
    this.pending.clear();
  }

  /** Follow the world clock: shift the legs under way by `hold` ms (a pause), or scale what is left
   *  of them and the queued legs by `k` (a speed change). */
  retime(now: number, hold: number, k: number, yearMs: number): void {
    for (const st of this.states.values()) {
      if (k !== 1) for (const seg of st.queue) seg.ms *= k;
      if (now >= st.t1 || st.from === st.to) continue;
      if (hold) { st.t0 += hold; st.t1 += hold; }
      else if (k !== 1 && !st.dissolve) {
        const p = (now - st.t0) / (st.t1 - st.t0), total = Math.min(16_000, Math.max(250, Math.min((st.t1 - st.t0) * k, yearMs * 1.12)));
        if (this.host.tooFast(st.from, st.to, total)) {
          st.ghost = st.pos.clone();
          st.dissolve = true;
          st.t0 = now; st.t1 = now + DISSOLVE_MS;
          continue;
        }
        st.t0 = now - p * total; st.t1 = st.t0 + total;
      }
    }
  }

  private advance(st: TState, now: number): void {
    if (st.dissolve && st.t1 > 0 && now >= st.t1 && st.from !== st.to) {
      st.landAt = st.t1; st.inAt = (st.t0 + st.t1) / 2; st.ghost = null; st.from = st.to;
    }
    while (now >= st.t1 && st.queue.length) {
      const next = st.queue[0]!;
      // judged at its ordinary pace (a ship catching up may hurry a little); a long backlog means the
      // world is running far ahead of what can be sailed
      if (st.queue.length > 4 || this.host.tooFast(st.to, next.to, Math.min(16_000, Math.max(250, next.ms * 1.12)))) {
        // too fast to sail: rest a moment, then fade out here and in at the newest tile
        const last = st.queue[st.queue.length - 1]!.to;
        st.queue.length = 0;
        if (last === st.to) break;
        st.from = st.to;
        st.to = last;
        st.dissolve = true;
        st.t0 = Math.max(now, st.landAt + DWELL_MS);
        st.t1 = st.t0 + DISSOLVE_MS;
        break;
      }
      st.dissolve = false;
      const seg = st.queue.shift()!;
      // carry on from the end of the last leg if it only just ended, so there is no pause
      const t0 = now - st.t1 < 250 ? st.t1 : now;
      // a little slower than a tick so the next move lands before this leg ends; catch up if behind
      const k = st.queue.length >= 2 ? 0.55 : st.queue.length === 1 ? 0.85 : 1.12;
      st.from = st.to;
      st.to = seg.to;
      st.t0 = t0;
      st.t1 = t0 + Math.min(16_000, Math.max(250, seg.ms * k));
    }
  }

  update(field: ModelField, camDir: THREE.Vector3, camDist: number, now: number, dt: number): void {
    const h = this.host;
    const orbit = 1 + Math.max(0, camDist - 1.8) * 0.4; // a touch bigger from orbit so the sea reads busy
    for (const [id, st] of this.states) {
      let fade = Math.min(1, (now - st.born) / FADE_MS);
      if (st.gone >= 0) {
        fade = 1 - (now - st.gone) / FADE_MS;
        if (fade <= 0) { this.states.delete(id); continue; }
      }
      this.advance(st, now);
      const a = h.dirs[st.from], b = h.dirs[st.to];
      if (!a || !b) continue;
      const under = now < st.t1 && st.from !== st.to;
      const moving = under && !st.dissolve;
      let s = under ? Math.max(0, (now - st.t0) / (st.t1 - st.t0)) : 1;
      if (st.dissolve) {
        if (under && s < 0.5 && st.queue.length) { st.to = st.queue[st.queue.length - 1]!.to; st.queue.length = 0; } // come back at the newest tile
        fade *= dissolveAlpha(now, under ? st.t0 : Infinity, under ? st.t1 : Infinity, st.inAt);
        s = under && s < 0.5 ? 0 : 1;
      }
      const ra = Math.max(h.heights[st.from] ?? 1, 0.992), rb = Math.max(h.heights[st.to] ?? 1, 0.992);
      if (st.dissolve && under && s === 0 && st.ghost) st.pos.copy(st.ghost);
      else arcPoint(st.pos, a, b, ra, rb, s, 0);
      if (st.from !== st.to && !st.dissolve) {
        _t.subVectors(b, a).normalize();
        if (st.head.lengthSq() < 1e-12) st.head.copy(_t);
        else st.head.lerp(_t, Math.min(1, dt * 0.005)).normalize(); // turn smoothly at each tile
      }
      const f = facing(st.pos, camDir);
      if (f <= 0) continue;
      const bob = Math.sin(now * 0.0021 + st.seed) * this.size * 0.05;
      const roll = Math.sin(now * 0.0017 + st.seed * 1.7) * 0.09;
      _a.copy(st.pos).normalize();
      _b.copy(st.pos).addScaledVector(_a, 0.0004 + bob);
      const model = h.model(st.owner);
      const size = this.size * (model.footprint / 0.4) * orbit * Math.max(0, Math.min(1, fade)) * h.pop(st.owner, now);
      field.push(model, standMatrix(_m, _b, st.head, size, roll), h.team(st.owner));
      if (h.fx && camDist < FX_RANGE) h.fx.emit({ anchors: model.anchors, stand: _m, size, moving, facing: f }, now, dt);

      if (moving && now >= st.nextWake && f > 0.3) {
        st.nextWake = now + WAKE_EVERY;
        _t.copy(st.head).addScaledVector(_a, -st.head.dot(_a));
        if (_t.lengthSq() > 1e-12) _t.normalize();
        const i = this.nextW;
        this.nextW = (this.nextW + 1) % WAKE;
        const p = _b.addScaledVector(_t, -size * 0.55).addScaledVector(_a, -bob);
        this.wakePos[i * 3] = p.x; this.wakePos[i * 3 + 1] = p.y; this.wakePos[i * 3 + 2] = p.z;
        this.wakeBorn[i] = now;
      }
    }
    // wake: foam dots fading out behind the ships
    for (let i = 0; i < WAKE; i++) {
      const b0 = this.wakeBorn[i]!;
      if (b0 < 0) continue;
      const t = (now - b0) / WAKE_LIFE;
      if (t >= 1) { this.wakeBorn[i] = -1; this.wakeCol[i * 3] = this.wakeCol[i * 3 + 1] = this.wakeCol[i * 3 + 2] = 0; continue; }
      _c.copy(this.wakeBase).multiplyScalar((1 - t) * (1 - t));
      this.wakeCol[i * 3] = _c.r; this.wakeCol[i * 3 + 1] = _c.g; this.wakeCol[i * 3 + 2] = _c.b;
    }
    (this.wake.material as THREE.PointsMaterial).size = this.size * 0.55 * orbit;
    this.wake.visible = camDist < 3;
    this.wake.geometry.getAttribute('position').needsUpdate = true;
    this.wake.geometry.getAttribute('color').needsUpdate = true;
  }

  dispose(): void {
    this.wake.geometry.dispose();
    (this.wake.material as THREE.PointsMaterial).dispose();
    this.tex.dispose();
    this.states.clear();
  }
}
