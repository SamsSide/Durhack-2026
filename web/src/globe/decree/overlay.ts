// The tint a decree lays over the provinces it hits: a copy of their top faces, lifted a hair, with a
// shader that creeps outward from the first province (aRank 0 there, 1 at the farthest), mottles,
// ripples (a flood) or flickers (a rebellion). One mesh per decree slot; the geometry is rebuilt only
// when a decree starts. Lane b.
import * as THREE from 'three';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';

const VERT = /* glsl */ `
attribute float aRank;
varying float vRank;
varying vec3 vP;
void main() {
  vRank = aRank;
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uCreep;
uniform float uAlpha;
uniform float uT;
uniform float uFreq;
uniform float uWave;
uniform float uFlick;
uniform float uEmber;
varying float vRank;
varying vec3 vP;
void main() {
  float reveal = smoothstep(vRank - 0.14, vRank + 0.02, uCreep);
  vec3 p = vP * uFreq;
  float n = sin(p.x + uT * 0.9) * sin(p.y * 1.3 - uT * 0.7) * sin(p.z * 0.8 + uT * 0.5);
  float n2 = sin(p.x * 2.3 + p.z * 1.7 + uT * 0.3) * sin(p.y * 2.9 - p.x * 1.1 - uT * 0.4);
  n = 0.5 + 0.25 * n + 0.25 * n2;
  float w = 0.5 + 0.5 * sin(dot(vP, vec3(60.0, 38.0, 28.0)) - uT * 2.4 + 2.0 * n);
  float m = mix(n, w, uWave);
  m = pow(m, mix(1.0, 5.0, uEmber));
  float flick = 1.0 - uFlick * 0.5 * (0.5 + 0.5 * sin(uT * 14.0 + vRank * 37.0));
  m *= 1.0 - uEmber * 0.75 * vRank; // embers glow hottest at the centre of the strike
  vec3 col = mix(uA, uB, m);
  gl_FragColor = vec4(col, uAlpha * reveal * (0.7 + 0.3 * m) * flick);
}`;

export interface OverlayLook {
  a: string; b: string; alpha: number; freq: number;
  wave?: number; flick?: number; ember?: number; additive?: boolean;
}

export class TileOverlay {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  alpha = 0;

  constructor(renderOrder: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() },
        uCreep: { value: 0 }, uAlpha: { value: 0 }, uT: { value: 0 }, uFreq: { value: 60 },
        uWave: { value: 0 }, uFlick: { value: 0 }, uEmber: { value: 0 },
      },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.renderOrder = renderOrder;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.raycast = () => {};
  }

  /** New provinces and a new look; `ranks[i]` (0..1) is when tiles[i] is reached by the creep. */
  set(pm: ProvinceMesh, tiles: number[], ranks: number[], look: OverlayLook): void {
    const src = pm.geometry.getAttribute('position') as THREE.BufferAttribute;
    let count = 0;
    for (const t of tiles) count += pm.tileTopVertexCount[t] ?? 0;
    const pos = new Float32Array(count * 3);
    const rank = new Float32Array(count);
    let v = 0;
    tiles.forEach((t, i) => {
      const start = pm.tileVertexStart[t], n = pm.tileTopVertexCount[t];
      if (start == null || !n) return;
      for (let j = 0; j < n; j++, v++) {
        pos[v * 3] = src.getX(start + j) * 1.0015;
        pos[v * 3 + 1] = src.getY(start + j) * 1.0015;
        pos[v * 3 + 2] = src.getZ(start + j) * 1.0015;
        rank[v] = ranks[i] ?? 0;
      }
    });
    this.mesh.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRank', new THREE.BufferAttribute(rank, 1));
    this.mesh.geometry = g;
    const u = this.mat.uniforms;
    (u.uA!.value as THREE.Color).set(look.a);
    (u.uB!.value as THREE.Color).set(look.b);
    u.uFreq!.value = look.freq;
    u.uWave!.value = look.wave ?? 0;
    u.uFlick!.value = look.flick ?? 0;
    u.uEmber!.value = look.ember ?? 0;
    this.alpha = look.alpha;
    this.mat.blending = look.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.mat.needsUpdate = true;
    this.mesh.scale.setScalar(1);
  }

  /** creep 0..1+ (how far it has spread), env 0..1 (fade in and out), t seconds. */
  frame(creep: number, env: number, t: number): void {
    const u = this.mat.uniforms;
    u.uCreep!.value = creep;
    u.uAlpha!.value = this.alpha * env;
    u.uT!.value = t;
    this.mesh.visible = env > 0.001;
  }

  hide(): void { this.mesh.visible = false; }

  dispose(): void { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
