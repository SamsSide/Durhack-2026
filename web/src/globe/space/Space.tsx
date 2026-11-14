// The sky behind the planet: layered twinkling stars, a faint milky-way nebula and the odd shooting star.
// Mount once inside <Canvas> in Globe.tsx. Three draw calls. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getPalette } from '../palette';

const STAR_R = 60;
const NEBULA_R = 90;
const SKY_R = 50;
const SLOTS = 2;
const VIOLET = '#5b3f8c'; // muted violet for the nebula
const WARM = '#ffd7a6';
const COOL = '#a8c6ff';

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------- stars ---------- */
const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uAmp;
uniform float uPx;
varying vec3 vColor;
varying float vA;
void main() {
  float tw = 1.0 - uAmp * (0.5 + 0.5 * sin(uTime * (0.7 + aPhase * 0.35) + aPhase * 40.0));
  vColor = aColor;
  vA = aBright * tw;
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(1.0, 0.0, r);
  float a = (core * core + 0.25 * smoothstep(1.0, 0.3, r)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

function Stars({ reduced }: { reduced: boolean }) {
  const dpr = useThree((s) => s.gl.getPixelRatio());
  const { geo, mat } = useMemo(() => {
    // layers: [count, min px, max px, min bright, max bright]
    const layers = [[1300, 1.0, 1.6, 0.25, 0.55], [380, 1.6, 2.6, 0.45, 0.8], [42, 3.2, 5.2, 0.8, 1.0]];
    const total = layers.reduce((n, l) => n + l[0], 0);
    const pos = new Float32Array(total * 3), size = new Float32Array(total), bright = new Float32Array(total);
    const phase = new Float32Array(total), col = new Float32Array(total * 3);
    const base = new THREE.Color(getPalette().parchment), warm = new THREE.Color(WARM), cool = new THREE.Color(COOL);
    let s = 1337; // fixed seed: the same sky every load
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    let i = 0;
    for (const [n, s0, s1, b0, b1] of layers) {
      for (let k = 0; k < n; k++, i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        pos.set([Math.cos(a) * r * STAR_R, u * STAR_R, Math.sin(a) * r * STAR_R], i * 3);
        const q = rnd();
        size[i] = s0 + (s1 - s0) * q * q;
        bright[i] = b0 + (b1 - b0) * rnd();
        phase[i] = rnd();
        const t = rnd();
        const c = t < 0.12 ? warm : t < 0.24 ? cool : base;
        col.set([c.r, c.g, c.b], i * 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmp: { value: reduced ? 0 : 0.35 }, uPx: { value: dpr } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false,
    });
    return { geo: g, mat: m };
  }, [reduced, dpr]);
  useFrame(({ clock }) => { if (!reduced) mat.uniforms.uTime.value = clock.elapsedTime; });
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-2} />;
}

/* ---------- nebula ---------- */
const NEB_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const NEB_FRAG = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform float uOpacity;
varying vec3 vDir;
float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, v = 0.0; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  vec3 n = normalize(vec3(0.35, 0.85, 0.4));
  float band = exp(-pow(dot(d, n) * 3.2, 2.0));
  float cloud = fbm(d * 3.0 + 4.0);
  float patch = fbm(d * 1.4 - 9.0);
  float dust = smoothstep(0.35, 0.8, fbm(d * 6.0 + 1.0));
  float k = band * smoothstep(0.25, 0.85, cloud) * (0.5 + dust * 0.6) + 0.35 * smoothstep(0.55, 0.8, patch) * (1.0 - band);
  vec3 c = mix(uViolet, uCyan, smoothstep(0.35, 0.8, fbm(d * 2.0 + 20.0)) * 0.7);
  float a = k * uOpacity;
  gl_FragColor = vec4(c * a, a);
}`;

function Nebula({ matRef }: { matRef: React.MutableRefObject<THREE.ShaderMaterial | null> }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uCyan: { value: new THREE.Color(getPalette().holo).multiplyScalar(0.55) },
      uViolet: { value: new THREE.Color(VIOLET) },
      uOpacity: { value: 0.3 },
    },
    vertexShader: NEB_VERT, fragmentShader: NEB_FRAG,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  matRef.current = mat;
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh renderOrder={-3} material={mat} frustumCulled={false}>
      <sphereGeometry args={[NEBULA_R, 32, 20]} />
    </mesh>
  );
}

/* ---------- shooting stars: SLOTS quads in one mesh, animated in the shader ---------- */
const SHOOT_VERT = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aDir;
attribute vec2 aCorner; // x: 0 tail .. 1 head, y: -1 / 1 across
attribute float aSlot;
uniform float uProg[${SLOTS}];
uniform float uLen;
uniform float uTravel;
uniform float uWidth;
varying float vAlong;
varying float vAcross;
varying float vLife;
void main() {
  float p = uProg[int(aSlot + 0.5)];
  vLife = p < 0.0 ? 0.0 : sin(3.14159 * clamp(p, 0.0, 1.0));
  vec3 head = aStart + aDir * uTravel * max(p, 0.0);
  vec3 pt = head - aDir * uLen * (1.0 - aCorner.x);
  vec3 side = normalize(cross(aDir, cameraPosition - pt));
  pt += side * aCorner.y * uWidth * (0.15 + 0.85 * aCorner.x);
  vAlong = aCorner.x;
  vAcross = aCorner.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(pt, 1.0);
}`;
const SHOOT_FRAG = /* glsl */ `
uniform float uFade;
varying float vAlong;
varying float vAcross;
varying float vLife;
void main() {
  float a = pow(vAlong, 2.2) * (1.0 - abs(vAcross)) * vLife * uFade;
  vec3 c = mix(vec3(0.62, 0.78, 1.0), vec3(1.0, 0.97, 0.9), pow(vAlong, 3.0));
  gl_FragColor = vec4(c, a);
}`;

function ShootingStars() {
  const camera = useThree((s) => s.camera);
  const st = useRef({ next: 4, start: [-1, -1], dur: [1, 1] as number[] }).current;
  const { geo, mat } = useMemo(() => {
    const aStart = new Float32Array(SLOTS * 4 * 3), aDir = new Float32Array(SLOTS * 4 * 3);
    const corner = new Float32Array(SLOTS * 4 * 2), slot = new Float32Array(SLOTS * 4);
    const pos = new Float32Array(SLOTS * 4 * 3);
    const idx: number[] = [];
    for (let s = 0; s < SLOTS; s++) {
      const cs = [[0, -1], [0, 1], [1, -1], [1, 1]];
      cs.forEach((c, j) => { corner.set(c, (s * 4 + j) * 2); slot[s * 4 + j] = s; });
      const b = s * 4;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uProg: { value: new Array(SLOTS).fill(-1) },
        uLen: { value: 7 }, uTravel: { value: 12 }, uWidth: { value: 0.09 }, uFade: { value: 1 },
      },
      vertexShader: SHOOT_VERT, fragmentShader: SHOOT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    return { geo: g, mat: m };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  const fwd = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const p0 = useMemo(() => new THREE.Vector3(), []);
  const tan = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const dist = camera.position.length();
    const fade = smooth(1.7, 3.0, dist);
    mat.uniforms.uFade.value = fade;
    const prog = mat.uniforms.uProg.value as number[];
    for (let s = 0; s < SLOTS; s++) {
      if (st.start[s] >= 0) {
        const p = (t - st.start[s]) / st.dur[s];
        prog[s] = p >= 1 ? -1 : p;
        if (p >= 1) st.start[s] = -1;
      }
    }
    if (t < st.next || fade < 0.2) return;
    const s = st.start.findIndex((v) => v < 0);
    st.next = t + 6 + Math.random() * 9;
    if (s < 0) return;
    // a point on the sky 14-26 degrees off the view axis (screen edge, away from the centre), moving across
    camera.getWorldDirection(fwd);
    up.copy(camera.up).projectOnPlane(fwd).normalize();
    right.crossVectors(fwd, up);
    const az = Math.random() * Math.PI * 2, off = THREE.MathUtils.degToRad(14 + Math.random() * 12);
    p0.copy(fwd).multiplyScalar(Math.cos(off))
      .addScaledVector(right, Math.sin(off) * Math.cos(az))
      .addScaledVector(up, Math.sin(off) * Math.sin(az)).normalize();
    const bearing = Math.random() * Math.PI * 2;
    tan.copy(right).multiplyScalar(Math.cos(bearing)).addScaledVector(up, Math.sin(bearing))
      .projectOnPlane(p0).normalize();
    p0.multiplyScalar(SKY_R);
    const aStart = geo.getAttribute('aStart') as THREE.BufferAttribute;
    const aDir = geo.getAttribute('aDir') as THREE.BufferAttribute;
    for (let j = 0; j < 4; j++) {
      aStart.setXYZ(s * 4 + j, p0.x, p0.y, p0.z);
      aDir.setXYZ(s * 4 + j, tan.x, tan.y, tan.z);
    }
    aStart.needsUpdate = aDir.needsUpdate = true;
    st.start[s] = t;
    st.dur[s] = 0.8 + Math.random() * 0.5;
    prog[s] = 0;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-1} />;
}

export function Space() {
  const reduced = useMemo(reducedMotion, []);
  const nebula = useRef<THREE.ShaderMaterial | null>(null);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (nebula.current) nebula.current.uniforms.uOpacity.value = 0.18 + 0.17 * smooth(1.6, 3.4, camera.position.length());
  });
  return (
    <>
      <Nebula matRef={nebula} />
      <Stars reduced={reduced} />
      {!reduced && <ShootingStars />}
    </>
  );
}
