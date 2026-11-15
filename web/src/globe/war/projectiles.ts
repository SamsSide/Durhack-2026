// A fixed pool of shots in flight (B16): each one flies from p0 to p1 on a parabola lifted along `up`,
// drawn as a thin streak (one line segment) and a head (a soft point: glowing for shells, tracers and
// drones, solid for cannon balls and stones). A beam is a segment from the sky down to its target.
// Three draw calls for every shot on the globe; nothing allocates per frame. Lane b.
import * as THREE from 'three';

export const Shot = { Arrow: 0, Bolt: 1, Stone: 2, Ball: 3, Shell: 4, Drone: 5, Tracer: 6, Beam: 7 } as const;
export type Shot = (typeof Shot)[keyof typeof Shot];

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uPx;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aAlpha > 0.0 ? clamp(aSize * uPx / -mv.z, 1.5, 48.0) : 0.0;
  vAlpha = aAlpha;
  vColor = aColor;
}`;

const FRAG = /* glsl */ `
uniform float uSoft;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, vAlpha * pow(1.0 - d, uSoft));
}`;

class Heads {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  readonly mat: THREE.ShaderMaterial;
  constructor(n: number, additive: boolean, soft: number) {
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uPx: { value: 600 }, uSoft: { value: soft } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 28;
  }
  flag(): void {
    const g = this.points.geometry;
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) g.getAttribute(name).needsUpdate = true;
  }
}

export interface Fire {
  kind: Shot; p0: THREE.Vector3; p1: THREE.Vector3; up: THREE.Vector3;
  /** Arc height at the middle of the flight, world units. */
  h: number; dur: number; delay: number;
  /** Streak length as a share of the flight; 0 for none. */
  tail: number;
  head: number; color: THREE.Color; streak: THREE.Color; solid: boolean;
  /** Passed back at impact, so the caller can size the burst. */
  scale: number;
  /** Lands in the sea (a miss at a ship): passed back so the impact is a splash. */
  wet?: boolean;
}

export type ImpactFn = (kind: Shot, at: THREE.Vector3, up: THREE.Vector3, scale: number, now: number, wet: boolean) => void;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _u = new THREE.Vector3();

export class Projectiles {
  readonly group = new THREE.Group();
  private readonly n: number;
  private readonly kind: Uint8Array;
  private readonly p0: Float32Array;
  private readonly p1: Float32Array;
  private readonly up: Float32Array;
  private readonly h: Float32Array;
  private readonly born: Float64Array;
  private readonly dur: Float32Array;
  private readonly tail: Float32Array;
  private readonly headSize: Float32Array;
  private readonly hc: Float32Array;
  private readonly sc: Float32Array;
  private readonly solid: Uint8Array;
  private readonly scale: Float32Array;
  private readonly wet: Uint8Array;
  private readonly linePos: Float32Array;
  private readonly lineCol: Float32Array;
  private readonly lines: THREE.LineSegments;
  private readonly lineMat: THREE.LineBasicMaterial;
  private readonly glow: Heads;
  private readonly dark: Heads;
  private next = 0;
  private live = 0;

  constructor(n: number) {
    this.n = n;
    this.kind = new Uint8Array(n);
    this.p0 = new Float32Array(n * 3);
    this.p1 = new Float32Array(n * 3);
    this.up = new Float32Array(n * 3);
    this.h = new Float32Array(n);
    this.born = new Float64Array(n).fill(-1);
    this.dur = new Float32Array(n).fill(1);
    this.tail = new Float32Array(n);
    this.headSize = new Float32Array(n);
    this.hc = new Float32Array(n * 3);
    this.sc = new Float32Array(n * 3);
    this.solid = new Uint8Array(n);
    this.scale = new Float32Array(n);
    this.wet = new Uint8Array(n);
    this.linePos = new Float32Array(n * 6);
    this.lineCol = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.lineCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.lines = new THREE.LineSegments(g, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 28;
    this.glow = new Heads(n, true, 1.4);
    this.dark = new Heads(n, false, 0.6);
    this.group.add(this.lines, this.dark.points, this.glow.points);
    this.group.visible = false;
  }

  /** Starts one shot; the oldest gives up its slot when the pool is full. */
  fire(now: number, f: Fire): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    const k = i * 3;
    this.kind[i] = f.kind;
    this.p0[k] = f.p0.x; this.p0[k + 1] = f.p0.y; this.p0[k + 2] = f.p0.z;
    this.p1[k] = f.p1.x; this.p1[k + 1] = f.p1.y; this.p1[k + 2] = f.p1.z;
    this.up[k] = f.up.x; this.up[k + 1] = f.up.y; this.up[k + 2] = f.up.z;
    this.h[i] = f.h; this.dur[i] = f.dur; this.born[i] = now + f.delay; this.tail[i] = f.tail;
    this.headSize[i] = f.head; this.solid[i] = f.solid ? 1 : 0; this.scale[i] = f.scale; this.wet[i] = f.wet ? 1 : 0;
    this.hc[k] = f.color.r; this.hc[k + 1] = f.color.g; this.hc[k + 2] = f.color.b;
    this.sc[k] = f.streak.r; this.sc[k + 1] = f.streak.g; this.sc[k + 2] = f.streak.b;
    this.live++;
  }

  private at(i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
    const k = i * 3;
    const lift = this.h[i]! * 4 * t * (1 - t);
    return out.set(
      this.p0[k]! + (this.p1[k]! - this.p0[k]!) * t + this.up[k]! * lift,
      this.p0[k + 1]! + (this.p1[k + 1]! - this.p0[k + 1]!) * t + this.up[k + 1]! * lift,
      this.p0[k + 2]! + (this.p1[k + 2]! - this.p0[k + 2]!) * t + this.up[k + 2]! * lift,
    );
  }

  private hide(i: number): void {
    const k = i * 6;
    for (let j = 0; j < 6; j++) this.lineCol[k + j] = 0;
    this.glow.alpha[i] = 0; this.dark.alpha[i] = 0;
  }

  update(now: number, px: number, onImpact: ImpactFn): void {
    if (this.live <= 0) { this.group.visible = false; return; }
    this.glow.mat.uniforms.uPx!.value = px;
    this.dark.mat.uniforms.uPx!.value = px;
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      const b = this.born[i]!;
      if (b < 0) continue;
      const t = (now - b) / this.dur[i]!;
      const k = i * 3;
      if (t >= 1) {
        this.born[i] = -1;
        this.hide(i);
        _a.set(this.p1[k]!, this.p1[k + 1]!, this.p1[k + 2]!);
        _u.set(this.up[k]!, this.up[k + 1]!, this.up[k + 2]!);
        onImpact(this.kind[i] as Shot, _a, _u, this.scale[i]!, now, this.wet[i] === 1);
        continue;
      }
      live++;
      if (t < 0) { this.hide(i); continue; }
      const beam = this.kind[i] === Shot.Beam;
      let fade = 1;
      if (beam) {
        // from high above straight down onto the target, flickering as it fades
        _b.set(this.p1[k]!, this.p1[k + 1]!, this.p1[k + 2]!);
        _a.copy(_b).addScaledVector(_u.set(this.up[k]!, this.up[k + 1]!, this.up[k + 2]!), this.h[i]!);
        fade = (1 - t * 0.6) * (0.75 + 0.25 * Math.sin(now * 0.08 + i));
      } else {
        this.at(i, t, _b);
        this.at(i, Math.max(0, t - this.tail[i]!), _a);
      }
      const L = i * 6;
      this.linePos[L] = _a.x; this.linePos[L + 1] = _a.y; this.linePos[L + 2] = _a.z;
      this.linePos[L + 3] = _b.x; this.linePos[L + 4] = _b.y; this.linePos[L + 5] = _b.z;
      const tailOn = this.tail[i]! > 0 || beam ? fade : 0;
      const tailK = beam ? 0.55 : 0.12; // the far end of a streak fades out
      for (let j = 0; j < 3; j++) {
        this.lineCol[L + j] = this.sc[k + j]! * tailOn * tailK;
        this.lineCol[L + 3 + j] = this.sc[k + j]! * tailOn;
      }
      const hd = this.solid[i] ? this.dark : this.glow;
      const other = this.solid[i] ? this.glow : this.dark;
      other.alpha[i] = 0;
      hd.pos[k] = _b.x; hd.pos[k + 1] = _b.y; hd.pos[k + 2] = _b.z;
      hd.col[k] = this.hc[k]!; hd.col[k + 1] = this.hc[k + 1]!; hd.col[k + 2] = this.hc[k + 2]!;
      hd.size[i] = this.headSize[i]!;
      hd.alpha[i] = this.headSize[i]! > 0 ? Math.min(1, t * 12 + 0.2) * fade : 0;
    }
    this.live = live;
    const g = this.lines.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('color').needsUpdate = true;
    this.glow.flag(); this.dark.flag();
    this.group.visible = true;
  }

  dispose(): void {
    this.lines.geometry.dispose(); this.lineMat.dispose();
    for (const h of [this.glow, this.dark]) { h.points.geometry.dispose(); h.mat.dispose(); }
  }
}
