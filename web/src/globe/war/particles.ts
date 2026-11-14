// A fixed pool of soft round particles in one THREE.Points draw call (B14). Each particle moves from its
// start along its drift with an ease-out, grows from s0 to s1 (world units) and shifts colour c0 -> c1.
// Additive pools draw flash, fire and sparks; a normal pool draws smoke and dust. Nothing allocates per frame.
import * as THREE from 'three';

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
  gl_PointSize = aAlpha > 0.0 ? min(aSize * uPx / -mv.z, 256.0) : 0.0;
  vAlpha = aAlpha;
  vColor = aColor;
}`;

const FRAG = /* glsl */ `
uniform float uSoft;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = vAlpha * pow(1.0 - d, uSoft);
  gl_FragColor = vec4(vColor, a);
}`;

export interface EmitOpts {
  delay?: number; tag?: number; c1?: THREE.Color;
}

export class ParticlePool {
  readonly points: THREE.Points;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly start: Float32Array;
  private readonly drift: Float32Array;
  private readonly c0: Float32Array;
  private readonly c1: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly s01: Float32Array;
  private readonly a0: Float32Array;
  private readonly born: Float64Array;
  private readonly life: Float32Array;
  private readonly tag: Int16Array;
  private readonly mat: THREE.ShaderMaterial;
  private next = 0;
  private live = false;

  constructor(n: number, additive: boolean, soft: number, renderOrder: number) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.start = new Float32Array(n * 3);
    this.drift = new Float32Array(n * 3);
    this.c0 = new Float32Array(n * 3);
    this.c1 = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.s01 = new Float32Array(n * 2);
    this.a0 = new Float32Array(n);
    this.born = new Float64Array(n).fill(-1);
    this.life = new Float32Array(n).fill(1);
    this.tag = new Int16Array(n).fill(-1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uPx: { value: 600 }, uSoft: { value: soft } },
      transparent: true, depthWrite: false, depthTest: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    this.points.visible = false;
  }

  /** One particle at p moving by drift over its life (ms). */
  emit(now: number, p: THREE.Vector3, drift: THREE.Vector3, s0: number, s1: number, life: number, alpha: number, c0: THREE.Color, o: EmitOpts = {}): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    const k = i * 3;
    this.start[k] = p.x; this.start[k + 1] = p.y; this.start[k + 2] = p.z;
    this.drift[k] = drift.x; this.drift[k + 1] = drift.y; this.drift[k + 2] = drift.z;
    const c1 = o.c1 ?? c0;
    this.c0[k] = c0.r; this.c0[k + 1] = c0.g; this.c0[k + 2] = c0.b;
    this.c1[k] = c1.r; this.c1[k + 1] = c1.g; this.c1[k + 2] = c1.b;
    this.s01[i * 2] = s0; this.s01[i * 2 + 1] = s1;
    this.a0[i] = alpha;
    this.born[i] = now + (o.delay ?? 0);
    this.life[i] = life;
    this.tag[i] = o.tag ?? -1;
    this.alpha[i] = 0;
    this.live = true;
  }

  /** Ends every particle with this tag at once (a burst slot taken by a newer burst). */
  kill(tag: number): void {
    for (let i = 0; i < this.n; i++) if (this.tag[i] === tag) { this.born[i] = -1; this.alpha[i] = 0; this.tag[i] = -1; }
  }

  update(now: number, px: number): void {
    if (!this.live) return;
    this.mat.uniforms.uPx!.value = px;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      const b = this.born[i]!;
      if (b < 0) continue;
      const t = (now - b) / this.life[i]!;
      if (t >= 1) { this.born[i] = -1; this.alpha[i] = 0; any = true; continue; }
      any = true;
      if (t < 0) { this.alpha[i] = 0; continue; }
      const e = 1 - (1 - t) * (1 - t);
      const k = i * 3;
      this.pos[k] = this.start[k]! + this.drift[k]! * e;
      this.pos[k + 1] = this.start[k + 1]! + this.drift[k + 1]! * e;
      this.pos[k + 2] = this.start[k + 2]! + this.drift[k + 2]! * e;
      this.col[k] = this.c0[k]! + (this.c1[k]! - this.c0[k]!) * t;
      this.col[k + 1] = this.c0[k + 1]! + (this.c1[k + 1]! - this.c0[k + 1]!) * t;
      this.col[k + 2] = this.c0[k + 2]! + (this.c1[k + 2]! - this.c0[k + 2]!) * t;
      const s0 = this.s01[i * 2]!, s1 = this.s01[i * 2 + 1]!;
      this.size[i] = s0 + (s1 - s0) * e;
      this.alpha[i] = this.a0[i]! * Math.min(1, t * 10) * Math.pow(1 - t, 1.3);
    }
    const g = this.points.geometry;
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) g.getAttribute(name).needsUpdate = true;
    this.points.visible = any;
    this.live = any;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}
