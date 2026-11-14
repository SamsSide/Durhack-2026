// Vehicle effects drawn from the model anchors (X4 "Effect anchors"): afterburner flames, V-wakes,
// exhaust smoke, dust and contrails. Two pooled point systems (additive and normal blend), 200
// particles in all, one draw call each, nothing allocated per frame. Lane b (#164).
import * as THREE from 'three';
import { drawDot, drawPuff, toTexture } from './draw';
import type { ModelAnchor } from './unitModels';

const ADD_CAP = 120;
const NORM_CAP = 80;

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

/** One pool of billboard particles that move in world space and fade out. */
class Pool {
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

  dispose(): void {
    this.points.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _s = new THREE.Vector3();
const FLAME = new THREE.Color('#ff8a2a'), CORE = new THREE.Color('#7fb4ff'), HOT = new THREE.Color('#fff0c8');
const FOAM = new THREE.Color('#e6f2f7'), TRAIL = new THREE.Color('#f4f7fa');
const SMOKE = new THREE.Color('#7b7a78'), DUST = new THREE.Color('#c8ab78');

export interface FxUnit {
  anchors: ModelAnchor[];
  /** the matrix that stands the unit box on the globe (as given to ModelField.push) */
  stand: THREE.Matrix4;
  /** unit box size in world units */
  size: number;
  moving: boolean;
  /** 1 well in front of the limb, 0 behind it */
  facing: number;
  /** more dust on desert-like ground, 1 normal */
  dusty?: number;
}

export class VehicleFx {
  readonly group = new THREE.Group();
  private readonly add = new Pool(ADD_CAP, true, false, 27);
  private readonly norm = new Pool(NORM_CAP, false, true, 25);

  constructor() {
    this.group.name = 'vehicle-fx';
    this.group.add(this.norm.points, this.add.points);
  }

  /** Emit this frame's particles for one visible unit. Cheap when it has no anchors. */
  emit(u: FxUnit, now: number, dt: number): void {
    if (u.facing < 0.3 || !u.anchors.length) return;
    const sec = Math.min(0.1, dt / 1000);
    const q = (rate: number): boolean => Math.random() < rate * sec * u.facing;
    const flies = u.anchors.some((x) => x.kind === 'thruster');
    for (const a of u.anchors) {
      _p.copy(a.pos).applyMatrix4(u.stand);
      _d.copy(a.dir).transformDirection(u.stand);
      _n.copy(_p).normalize();
      const sz = u.size;
      switch (a.kind) {
        case 'thruster': {
          // always burning while flying, brighter and longer while the unit moves
          const hot = u.moving ? 1 : 0.55;
          if (q(70 * hot)) {
            _v.copy(_d).multiplyScalar(sz * (u.moving ? 5.5 : 3.2) * (0.8 + Math.random() * 0.4));
            _s.copy(_p).addScaledVector(_d, sz * 0.05 * Math.random());
            this.add.emit(now, _s, _v, sz * 0.26 * hot, sz * 0.08, 170 + 90 * hot, 0.9, Math.random() < 0.5 ? FLAME : HOT);
          }
          if (q(55 * hot)) {
            _v.copy(_d).multiplyScalar(sz * (u.moving ? 7 : 4));
            this.add.emit(now, _p, _v, sz * 0.14 * hot, sz * 0.04, 110 + 60 * hot, 0.95, CORE);
          }
          break;
        }
        case 'contrail':
          if ((u.moving || flies) && q(26)) {
            _v.copy(_d).multiplyScalar(sz * 0.15);
            this.norm.emit(now, _p, _v, sz * 0.16, sz * 0.5, 2200, 0.5, TRAIL);
          }
          break;
        case 'wake':
          if (u.moving && q(18)) {
            // two foam puffs peeling off the stern, spreading into a V
            _s.crossVectors(_n, _d).normalize();
            for (const side of [-1, 1]) {
              _v.copy(_d).multiplyScalar(sz * 0.35).addScaledVector(_s, side * sz * 0.45);
              this.add.emit(now, _p, _v, sz * 0.22, sz * 0.4, 1700, 0.5, FOAM, 0.6);
            }
          }
          break;
        case 'exhaust':
          if (q(u.moving ? 9 : 2.5)) {
            _v.copy(_n).multiplyScalar(sz * 0.7).addScaledVector(_d, sz * 0.2);
            this.norm.emit(now, _p, _v, sz * 0.2, sz * 0.7, 1500, u.moving ? 0.5 : 0.35, SMOKE, 0.4);
          }
          break;
        case 'dust':
          if (u.moving && q(16 * (u.dusty ?? 1))) {
            _s.crossVectors(_n, _d).normalize();
            _v.copy(_d).multiplyScalar(sz * 0.3).addScaledVector(_n, sz * 0.25).addScaledVector(_s, (Math.random() - 0.5) * sz * 0.4);
            this.norm.emit(now, _p, _v, sz * 0.2, sz * 0.75, 1300, 0.45 * Math.min(1.6, u.dusty ?? 1), DUST, 0.8);
          }
          break;
      }
    }
  }

  update(camera: THREE.Camera, now: number, dt: number): void {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    const win = typeof window === 'undefined' ? null : window;
    const h = (win ? win.innerHeight * (win.devicePixelRatio || 1) : 800);
    const scale = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.add.update(now, dt, scale);
    this.norm.update(now, dt, scale);
  }

  dispose(): void {
    this.add.dispose();
    this.norm.dispose();
  }
}
