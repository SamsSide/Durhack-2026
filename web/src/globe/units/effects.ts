// Pooled one-shot effects: sparks and muzzle flashes, smoke puffs, and screen-size pop badges
// (clash, scroll, loss numbers). Nothing allocates per frame. Lane b (B5).
import * as THREE from 'three';
import { drawDot, drawPuff, toTexture } from './draw';

const _v = new THREE.Vector3();
const _cam = new THREE.Vector3();

/** How much of a point faces the camera: 0 on or behind the limb, 1 well in front. */
export function facing(pos: THREE.Vector3, camDir: THREE.Vector3): number {
  const d = _v.copy(pos).normalize().dot(camDir);
  return Math.min(1, Math.max(0, (d - 0.06) / 0.12));
}

/** A random unit vector tangent to the sphere at n. */
export function tangentJitter(out: THREE.Vector3, n: THREE.Vector3, amount: number): THREE.Vector3 {
  out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  out.addScaledVector(n, -out.dot(n));
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0);
  return out.normalize().multiplyScalar(amount * Math.random());
}

// ---------- sparks ----------

const SPARKS = 192;

export class Sparks {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(SPARKS * 3);
  private readonly col = new Float32Array(SPARKS * 3);
  private readonly born = new Float64Array(SPARKS).fill(-1);
  private readonly life = new Float32Array(SPARKS);
  private readonly base = new Float32Array(SPARKS * 3);
  private readonly vel = new Float32Array(SPARKS * 3);
  private next = 0;
  private live = 0;
  private readonly tex: THREE.Texture;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.tex = toTexture(drawDot());
    const m = new THREE.PointsMaterial({
      size: 11, sizeAttenuation: false, vertexColors: true, map: this.tex, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 26;
  }

  /** count sparks around p (scattered by spread), coloured c, each living ~life ms, drifting by speed. */
  burst(now: number, p: THREE.Vector3, count: number, spread: number, color: THREE.Color, life: number, speed: number, delayMax = 0): void {
    const n = _cam.copy(p).normalize();
    const j = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % SPARKS;
      tangentJitter(j, n, spread);
      this.pos[i * 3] = p.x + j.x; this.pos[i * 3 + 1] = p.y + j.y; this.pos[i * 3 + 2] = p.z + j.z;
      tangentJitter(j, n, speed);
      j.addScaledVector(n, speed * 0.6 * Math.random());
      this.vel[i * 3] = j.x; this.vel[i * 3 + 1] = j.y; this.vel[i * 3 + 2] = j.z;
      this.base[i * 3] = color.r; this.base[i * 3 + 1] = color.g; this.base[i * 3 + 2] = color.b;
      this.born[i] = now + Math.random() * delayMax;
      this.life[i] = life * (0.6 + 0.4 * Math.random());
    }
    this.live = 1;
  }

  update(now: number, dt: number): void {
    if (!this.live) return;
    let any = 0;
    for (let i = 0; i < SPARKS; i++) {
      const b = this.born[i]!;
      if (b < 0) continue;
      const age = now - b;
      let k = 0;
      if (age >= this.life[i]!) { this.born[i] = -1; }
      else if (age >= 0) {
        any = 1;
        const flick = Math.random() < 0.55 ? 1 : 0.15;
        k = flick * (1 - age / this.life[i]!);
        const s = dt / 1000;
        this.pos[i * 3] += this.vel[i * 3]! * s;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1]! * s;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2]! * s;
      } else any = 1;
      this.col[i * 3] = this.base[i * 3]! * k;
      this.col[i * 3 + 1] = this.base[i * 3 + 1]! * k;
      this.col[i * 3 + 2] = this.base[i * 3 + 2]! * k;
    }
    this.live = any;
    this.points.geometry.getAttribute('position').needsUpdate = true;
    this.points.geometry.getAttribute('color').needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.tex.dispose();
  }
}

// ---------- smoke ----------

const PUFFS = 140;

interface Puff {
  sprite: THREE.Sprite; mat: THREE.SpriteMaterial; born: number; life: number;
  start: THREE.Vector3; drift: THREE.Vector3; s0: number; s1: number; a0: number; spin: number;
}

export class Smoke {
  readonly group = new THREE.Group();
  private readonly puffs: Puff[] = [];
  private readonly tex: THREE.Texture;
  private next = 0;

  constructor() {
    this.tex = toTexture(drawPuff());
    for (let i = 0; i < PUFFS; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 0 });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 24;
      this.group.add(sprite);
      this.puffs.push({ sprite, mat, born: -1, life: 1, start: new THREE.Vector3(), drift: new THREE.Vector3(), s0: 0, s1: 0, a0: 0, spin: 0 });
    }
  }

  emit(now: number, p: THREE.Vector3, drift: THREE.Vector3, s0: number, s1: number, life: number, alpha: number, color: THREE.Color, delay = 0): void {
    const puff = this.puffs[this.next]!;
    this.next = (this.next + 1) % PUFFS;
    puff.born = now + delay;
    puff.life = life;
    puff.start.copy(p);
    puff.drift.copy(drift);
    puff.s0 = s0; puff.s1 = s1; puff.a0 = alpha;
    puff.spin = (Math.random() - 0.5) * 0.8;
    puff.mat.color.copy(color);
    puff.mat.rotation = Math.random() * Math.PI * 2;
    puff.sprite.visible = false;
  }

  update(now: number, dt: number): void {
    for (const p of this.puffs) {
      if (p.born < 0) continue;
      const t = (now - p.born) / p.life;
      if (t >= 1) { p.born = -1; p.sprite.visible = false; continue; }
      if (t < 0) continue;
      p.sprite.visible = true;
      const e = 1 - (1 - t) * (1 - t);
      p.sprite.position.copy(p.start).addScaledVector(p.drift, e);
      p.sprite.scale.setScalar(p.s0 + (p.s1 - p.s0) * e);
      p.mat.opacity = p.a0 * Math.min(1, t * 8) * Math.pow(1 - t, 1.4);
      p.mat.rotation += p.spin * dt / 1000;
    }
  }

  dispose(): void {
    for (const p of this.puffs) p.mat.dispose();
    this.tex.dispose();
  }
}

// ---------- pop badges ----------

export type PopKind = 'clash' | 'scroll' | 'loss' | 'attrition';
const POPS = 32;

interface Pop {
  sprite: THREE.Sprite; mat: THREE.SpriteMaterial; born: number; life: number; kind: PopKind;
  pos: THREE.Vector3; dx: number; size: number; aspect: number;
}

/** Screen-size badges that pop in, hold and fade: drawn over everything, hidden on the far side. */
export class Pops {
  readonly group = new THREE.Group();
  private readonly pops: Pop[] = [];
  private next = 0;

  constructor() {
    for (let i = 0; i < POPS; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, toneMapped: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 34;
      this.group.add(sprite);
      this.pops.push({ sprite, mat, born: -1, life: 1, kind: 'clash', pos: new THREE.Vector3(), dx: 0, size: 0.03, aspect: 1 });
    }
  }

  show(now: number, kind: PopKind, tex: THREE.Texture, pos: THREE.Vector3, size: number, aspect: number, life: number, dx = 0, delay = 0): void {
    const p = this.pops[this.next]!;
    this.next = (this.next + 1) % POPS;
    p.kind = kind; p.born = now + delay; p.life = life; p.pos.copy(pos); p.dx = dx; p.size = size; p.aspect = aspect;
    p.mat.map = tex;
    p.mat.needsUpdate = true;
    p.sprite.position.copy(pos);
    p.sprite.visible = false;
  }

  update(now: number, camDir: THREE.Vector3, zoom: number): void {
    for (const p of this.pops) {
      if (p.born < 0) continue;
      const t = (now - p.born) / p.life;
      if (t >= 1) { p.born = -1; p.sprite.visible = false; continue; }
      if (t < 0) continue;
      const f = facing(p.pos, camDir);
      p.sprite.visible = f > 0;
      if (!f) continue;
      const ms = now - p.born;
      let s = 1, a = 1, cy = 0.5;
      if (p.kind === 'attrition') {
        cy = -0.3 - t * 1.1;
        a = (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4) * 0.8;
      } else if (p.kind === 'loss') {
        cy = -0.6 - t * 2.2;
        a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        s = ms < 140 ? 0.6 + 0.4 * (ms / 140) : 1;
      } else {
        // pop: overshoot then settle, fade in the last 30%
        s = ms < 160 ? 1.35 * (ms / 160) : ms < 300 ? 1.35 - 0.35 * ((ms - 160) / 140) : 1;
        a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        cy = 0.5; // centred on the tile, under the counters
      }
      const h = p.size * zoom * s;
      p.sprite.scale.set(h * p.aspect, h, 1);
      p.sprite.center.set(0.5 - p.dx, cy);
      p.mat.opacity = a * f;
    }
  }

  dispose(): void {
    for (const p of this.pops) p.mat.dispose();
  }
}
