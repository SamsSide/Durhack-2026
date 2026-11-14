// Particles for the rocket launches (#291): exhaust flame, pad smoke, contrail, separation flash,
// re-entry streak and break-up sparks. Two pooled point systems (additive and normal blend), one draw
// call each, nothing allocated per frame. Same billboard shader as units/vehicleFx.ts. Lane b.
import * as THREE from 'three';
import { drawDot, drawPuff, toTexture } from '../units/draw';

const VERT = /* glsl */ `
attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
uniform float uScale;
varying vec3 vColor; varying float vAlpha;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aAlpha > 0.001 ? max(1.0, aSize * uScale / max(0.01, -mv.z)) : 0.0;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor, t.a * vAlpha);
  if (gl_FragColor.a < 0.004) discard;
}`;

/** One ring buffer of billboard particles that drift in world space, grow and fade. */
export class Pool {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly vel: Float32Array;
  private readonly born: Float64Array;
  private readonly life: Float32Array;
  private readonly s0: Float32Array;
  private readonly s1: Float32Array;
  private readonly a0: Float32Array;
  private readonly drag: Float32Array;
  private next = 0;
  private live = 0;
  private readonly tex: THREE.Texture;
  private readonly mat: THREE.ShaderMaterial;

  constructor(private readonly cap: number, additive: boolean, puff: boolean, order: number) {
    const n = cap;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.born = new Float64Array(n).fill(-1);
    this.life = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    this.a0 = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.tex = toTexture(puff ? drawPuff() : drawDot());
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: this.tex }, uScale: { value: 400 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = order;
    this.points.visible = false;
  }

  /** now and life in ms; positions in world units, velocities in units per second; drag per second. */
  emit(now: number, p: THREE.Vector3, v: THREE.Vector3, s0: number, s1: number, life: number, alpha: number, c: THREE.Color, drag = 0): void {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.born[i] = now; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = alpha; this.drag[i] = drag;
    this.live = 1;
  }

  update(now: number, dt: number, scale: number): void {
    if (!this.live) { this.points.visible = false; return; }
    const s = dt / 1000;
    let any = 0;
    for (let i = 0; i < this.cap; i++) {
      const b = this.born[i]!;
      if (b < 0) continue;
      const t = (now - b) / this.life[i]!;
      if (t >= 1) { this.born[i] = -1; this.alpha[i] = 0; continue; }
      any = 1;
      const k = Math.max(0, 1 - this.drag[i]! * s);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] *= k; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3]! * s;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1]! * s;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2]! * s;
      this.size[i] = this.s0[i]! + (this.s1[i]! - this.s0[i]!) * t;
      this.alpha[i] = this.a0[i]! * Math.min(1, t * 10) * (1 - t) * (1 - t);
    }
    this.live = any;
    this.points.visible = !!any;
    this.mat.uniforms.uScale!.value = scale;
    const g = this.points.geometry;
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor']) g.getAttribute(a).needsUpdate = true;
  }

  clear(): void { this.born.fill(-1); this.alpha.fill(0); this.live = 1; }

  dispose(): void {
    this.points.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

export const C = {
  core: new THREE.Color('#fff6dc'),
  flame: new THREE.Color('#ffb340'),
  flameDeep: new THREE.Color('#ff6a1a'),
  blue: new THREE.Color('#9cc8ff'),
  smoke: new THREE.Color('#d9d6d0'),
  smokeDark: new THREE.Color('#9a958e'),
  trail: new THREE.Color('#f2f4f6'),
  flash: new THREE.Color('#fff2c0'),
  heatOrange: new THREE.Color('#ff6f1e'),
  heatWhite: new THREE.Color('#fff4e0'),
  spark: new THREE.Color('#ffc65a'),
};

/** Screen scale for the shader: device pixels per world unit at distance 1. */
export function pointScale(camera: THREE.Camera): number {
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
  const h = typeof window === 'undefined' ? 800 : window.innerHeight * (window.devicePixelRatio || 1);
  return h / (2 * Math.tan((fov * Math.PI) / 360));
}
