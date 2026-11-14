// A fixed pool of small picture particles (skull, coin, banner, star) in one THREE.Points draw call, for
// the decree visuals. The same motion as war/particles.ts (ease-out drift, size s0 -> s1, fade in and
// out), but each point samples a cell of a 2x2 canvas atlas. Nothing allocates per frame. Lane b.
import * as THREE from 'three';

export const GLYPH = { skull: 0, coin: 1, banner: 2, star: 3 } as const;
export type Glyph = (typeof GLYPH)[keyof typeof GLYPH];

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aGlyph;
attribute vec3 aColor;
uniform float uPx;
varying float vAlpha;
varying float vGlyph;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aAlpha > 0.0 ? min(aSize * uPx / -mv.z, 128.0) : 0.0;
  vAlpha = aAlpha;
  vGlyph = aGlyph;
  vColor = aColor;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
varying float vGlyph;
varying vec3 vColor;
void main() {
  float cx = mod(vGlyph, 2.0);
  float cy = floor(vGlyph / 2.0);
  vec2 uv = vec2((gl_PointCoord.x + cx) * 0.5, ((1.0 - gl_PointCoord.y) + (1.0 - cy)) * 0.5);
  vec4 t = texture2D(uMap, uv);
  if (t.a < 0.02) discard;
  gl_FragColor = vec4(t.rgb * vColor, t.a * vAlpha);
}`;

/** The 2x2 atlas, drawn once: skull, coin (top row), banner, star (bottom row). */
function atlas(): THREE.CanvasTexture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  // skull
  g.save(); g.translate(32, 30);
  g.fillStyle = '#e8edd2'; g.strokeStyle = '#1d2410'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, -4, 18, Math.PI * 0.9, Math.PI * 2.1); g.lineTo(11, 12); g.lineTo(11, 20); g.lineTo(-11, 20); g.lineTo(-11, 12); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#1d2410';
  g.beginPath(); g.ellipse(-7, 0, 5, 6, 0, 0, Math.PI * 2); g.ellipse(7, 0, 5, 6, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(0, 6); g.lineTo(-3, 11); g.lineTo(3, 11); g.closePath(); g.fill();
  g.fillRect(-5, 15, 2, 5); g.fillRect(-1, 15, 2, 5); g.fillRect(3, 15, 2, 5);
  g.restore();
  // coin
  g.save(); g.translate(96, 32);
  const coin = g.createRadialGradient(-6, -6, 2, 0, 0, 22);
  coin.addColorStop(0, '#fff3b8'); coin.addColorStop(0.55, '#f2c443'); coin.addColorStop(1, '#a8741c');
  g.fillStyle = coin; g.strokeStyle = '#5a3d0c'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = '#8a5d14'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#8a5d14'; g.font = 'bold 18px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T', 0, 1);
  g.restore();
  // banner: a pole and a swallow-tailed flag
  g.save(); g.translate(0, 64);
  g.fillStyle = '#2a1f14'; g.fillRect(14, 6, 4, 54);
  g.fillStyle = '#d9b25a'; g.beginPath(); g.arc(16, 6, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c8241a'; g.strokeStyle = '#3a0805'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(18, 10); g.quadraticCurveTo(36, 6, 54, 12); g.lineTo(44, 22); g.lineTo(54, 34); g.quadraticCurveTo(36, 28, 18, 32); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#f0d27a'; g.beginPath(); g.arc(32, 21, 4.5, 0, Math.PI * 2); g.fill();
  g.restore();
  // star sparkle
  g.save(); g.translate(96, 96);
  const star = g.createRadialGradient(0, 0, 0, 0, 0, 28);
  star.addColorStop(0, 'rgba(255,255,255,1)'); star.addColorStop(0.25, 'rgba(255,240,190,0.9)'); star.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = star;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = i % 2 ? 6 : 28;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GlyphPool {
  readonly points: THREE.Points;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly start: Float32Array;
  private readonly drift: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly glyph: Float32Array;
  private readonly s01: Float32Array;
  private readonly a0: Float32Array;
  private readonly born: Float64Array;
  private readonly life: Float32Array;
  private readonly tag: Int16Array;
  private readonly mat: THREE.ShaderMaterial;
  private readonly tex: THREE.CanvasTexture;
  private next = 0;
  private live = false;

  constructor(n: number, renderOrder: number) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.start = new Float32Array(n * 3);
    this.drift = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.glyph = new Float32Array(n);
    this.s01 = new Float32Array(n * 2);
    this.a0 = new Float32Array(n);
    this.born = new Float64Array(n).fill(-1);
    this.life = new Float32Array(n).fill(1);
    this.tag = new Int16Array(n).fill(-1);
    this.tex = atlas();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aGlyph', new THREE.BufferAttribute(this.glyph, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uPx: { value: 600 }, uMap: { value: this.tex } },
      transparent: true, depthWrite: false, depthTest: true,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    this.points.visible = false;
  }

  emit(now: number, p: THREE.Vector3, drift: THREE.Vector3, glyph: Glyph, s0: number, s1: number, life: number, alpha: number, color: THREE.Color, tag = -1, delay = 0): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    const k = i * 3;
    this.start[k] = p.x; this.start[k + 1] = p.y; this.start[k + 2] = p.z;
    this.drift[k] = drift.x; this.drift[k + 1] = drift.y; this.drift[k + 2] = drift.z;
    this.col[k] = color.r; this.col[k + 1] = color.g; this.col[k + 2] = color.b;
    this.glyph[i] = glyph;
    this.s01[i * 2] = s0; this.s01[i * 2 + 1] = s1;
    this.a0[i] = alpha;
    this.born[i] = now + delay;
    this.life[i] = life;
    this.tag[i] = tag;
    this.alpha[i] = 0;
    this.live = true;
  }

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
      const s0 = this.s01[i * 2]!, s1 = this.s01[i * 2 + 1]!;
      this.size[i] = s0 + (s1 - s0) * e;
      this.alpha[i] = this.a0[i]! * Math.min(1, t * 8) * Math.min(1, (1 - t) * 4);
    }
    const g = this.points.geometry;
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha', 'aGlyph']) g.getAttribute(name).needsUpdate = true;
    this.points.visible = any;
    this.live = any;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
