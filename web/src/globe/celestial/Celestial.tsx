// Lane b: the sun behind the planet (disc, corona, limb flare, ghosts), the day/night light rig, a warm
// terminator band, a sunward rim, night-side city lights and a passing moon. Mount once inside <Canvas>.
// Everything per frame is refs and uniforms: no React state changes after mount.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { onPipPass } from '../pip/pipLod';
import { useWorld } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';
import { SUN_DIST, advanceSun, holdSun, setSunAngle, radialTexture, reducedMotion, rimFade, smooth, sunDir } from './sun';

const KEY = '#ffcf9a'; // warm orange key (the gallery's dusk look, softened so the map colours stay true)
const FILL = '#aeb2e2'; // purple-blue shade on the night side
const noRaycast = () => {};

/** Moves the sun with the world clock and points the key light from it. */
function SunLight() {
  const key = useRef<THREE.DirectionalLight>(null);
  const frozen = useMemo(reducedMotion, []);
  useFrame((_, dt) => {
    const clock = useWorld.getState().clock;
    advanceSun(Math.min(dt, 0.1), frozen || clock?.paused ? 0 : 1);
    key.current?.position.copy(sunDir).multiplyScalar(10);
  }, -1);
  return (
    <>
      <ambientLight color={FILL} intensity={1.45} />
      <hemisphereLight args={['#d6d0ee', '#6a6f92', 0.4]} />
      <directionalLight ref={key} color={KEY} intensity={1.25} />
    </>
  );
}

/** The sun disc, its corona, a starburst when it sits on the planet's limb, and lens ghosts. */
function Sun() {
  const parts = useMemo(() => {
    const additive = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false } as const;
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture([[0, 'rgba(255,255,250,1)'], [0.42, 'rgba(255,246,220,1)'], [0.5, 'rgba(255,214,150,0.6)'], [1, 'rgba(255,180,90,0)']]),
      ...additive,
    }));
    disc.scale.setScalar(3.2);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture([[0, 'rgba(255,226,170,0.85)'], [0.12, 'rgba(255,196,120,0.45)'], [0.4, 'rgba(255,150,80,0.12)'], [1, 'rgba(255,120,60,0)']]),
      ...additive, depthTest: false,
    }));
    corona.scale.setScalar(26);
    corona.renderOrder = -1;
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: starburst(), ...additive, depthTest: false }));
    flare.renderOrder = 998;
    const ghostTex = radialTexture([[0, 'rgba(255,255,255,0.0)'], [0.55, 'rgba(255,255,255,0.18)'], [0.8, 'rgba(255,255,255,0.5)'], [0.9, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
    const spotTex = radialTexture([[0, 'rgba(255,255,255,0.7)'], [0.6, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]);
    const ghosts = ([[0.55, 0.05, spotTex, '#ffd29a'], [0.25, 0.022, ghostTex, '#9fd8ff'], [-0.3, 0.06, ghostTex, '#b4b8ff'], [-0.7, 0.03, spotTex, '#ffb37a'], [-1.05, 0.09, ghostTex, '#8fe0c8']] as const)
      .map(([f, size, map, color]) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, ...additive, depthTest: false }));
        s.renderOrder = 999;
        s.userData = { f, size };
        return s;
      });
    for (const o of [disc, corona, flare, ...ghosts]) { o.raycast = noRaycast; o.frustumCulled = false; }
    return { disc, corona, flare, ghosts };
  }, []);
  useEffect(() => () => {
    for (const s of [parts.disc, parts.corona, parts.flare, ...parts.ghosts]) { s.material.map?.dispose(); s.material.dispose(); }
  }, [parts]);

  const tmp = useMemo(() => ({ ndc: new THREE.Vector3(), toSun: new THREE.Vector3(), toCentre: new THREE.Vector3(), v: new THREE.Vector3() }), []);
  useFrame(({ camera }) => {
    const { disc, corona, flare, ghosts } = parts;
    const { ndc, toSun, toCentre, v } = tmp;
    disc.position.copy(sunDir).multiplyScalar(SUN_DIST);
    corona.position.copy(disc.position);
    // How far the sun sits from the planet's limb, as angles seen from the camera.
    const d = camera.position.length();
    const limb = Math.asin(Math.min(1, 1.02 / d));
    toSun.copy(disc.position).sub(camera.position).normalize();
    toCentre.copy(camera.position).negate().normalize();
    const theta = Math.acos(THREE.MathUtils.clamp(toSun.dot(toCentre), -1, 1));
    const visible = smooth(limb - 0.004, limb + 0.03, theta); // 0 behind the planet, 1 in clear sky
    const onLimb = Math.exp(-(((theta - limb) / 0.035) ** 2)); // peaks as the sun peeks past the limb
    (corona.material as THREE.SpriteMaterial).opacity = Math.max(visible * 0.9, onLimb * 0.8);
    // Screen-space flare and ghosts, kept just in front of the camera.
    ndc.copy(disc.position).project(camera);
    const inFront = ndc.z < 1 ? 1 : 0;
    const onScreen = inFront * smooth(1.6, 1.0, Math.max(Math.abs(ndc.x), Math.abs(ndc.y)));
    const fovK = Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov ?? 45) / 2) * 2;
    const D = 0.6;
    const place = (s: THREE.Sprite, x: number, y: number, size: number) => {
      v.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
      s.position.copy(camera.position).addScaledVector(v, D);
      s.scale.setScalar(size * fovK * D);
    };
    place(flare, ndc.x, ndc.y, 0.36 + onLimb * 0.16);
    flare.material.rotation = Math.atan2(ndc.y, ndc.x) * 0.5;
    flare.material.opacity = onScreen * onLimb * 0.95;
    // Ghosts are drawn over the planet (no depth test), so keep them faint, smaller, and weaker still while
    // the sun is hidden behind the planet and only its limb glow shows.
    const ghostK = onScreen * Math.max(onLimb * 0.35, visible * 0.3);
    for (const g of ghosts) {
      const { f, size } = g.userData as { f: number; size: number };
      place(g, ndc.x * f, ndc.y * f, size * 1.4);
      g.material.opacity = ghostK * 0.22;
    }
  });
  return (
    <>
      <primitive object={parts.corona} />
      <primitive object={parts.disc} />
      <primitive object={parts.flare} />
      {parts.ghosts.map((g, i) => <primitive key={i} object={g} />)}
    </>
  );
}

/** A four-ray starburst with a hot centre, for the limb flare. */
function starburst(): THREE.Texture {
  const size = 256, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.translate(size / 2, size / 2);
  g.globalCompositeOperation = 'lighter';
  const ray = (angle: number, len: number, width: number, alpha: number) => {
    g.save();
    g.rotate(angle);
    const grad = g.createLinearGradient(-len, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,220,170,0)');
    grad.addColorStop(0.5, `rgba(255,240,215,${alpha})`);
    grad.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, 0, len, width, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  ray(0, 126, 3.2, 0.9); ray(Math.PI / 2, 110, 2.6, 0.75);
  ray(Math.PI / 4, 70, 1.6, 0.45); ray(-Math.PI / 4, 70, 1.6, 0.45);
  for (let i = 0; i < 12; i++) ray((i / 12) * Math.PI + 0.13, 30 + (i % 3) * 14, 1, 0.25);
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 46);
  core.addColorStop(0, 'rgba(255,255,245,0.95)');
  core.addColorStop(0.3, 'rgba(255,225,170,0.45)');
  core.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, 46, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SHELL_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vNormalV;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** A thin additive shell that warms the dusk band where day turns to night. */
const TERMINATOR_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uWarm;
uniform float uFade;
varying vec3 vNormalW;
void main() {
  float d = dot(normalize(vNormalW), uSun);
  float band = exp(-pow((d + 0.04) / 0.16, 2.0));
  float a = band * 0.22 * uFade;
  gl_FragColor = vec4(uWarm * a, a);
}`;

/** The atmosphere rim, warm and bright on the sunward limb (and when the sun is behind the planet). */
const RIM_FRAG = /* glsl */ `
uniform vec3 uSunV;
uniform vec3 uWarm;
uniform float uFade;
varying vec3 vNormalV;
void main() {
  vec3 n = normalize(vNormalV);
  float k = clamp(0.72 - dot(n, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float rim = pow(k, 3.0);
  vec2 side = normalize(n.xy + 1e-5);
  vec2 sunSide = normalize(uSunV.xy + 1e-5);
  float toward = max(dot(side, sunSide), 0.0);
  float lit = max(dot(n, uSunV), 0.0);
  float back = max(-uSunV.z, 0.0);
  float i = rim * (0.5 * lit + pow(toward, 3.0) * (0.25 + 0.9 * back)) * uFade;
  gl_FragColor = vec4(uWarm * i, i);
}`;

function Shells() {
  const { terminator, rim } = useMemo(() => {
    const base = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: SHELL_VERT } as const;
    return {
      terminator: new THREE.ShaderMaterial({
        ...base, fragmentShader: TERMINATOR_FRAG,
        uniforms: { uSun: { value: sunDir }, uWarm: { value: new THREE.Color('#ff8a3c') }, uFade: { value: 1 } },
      }),
      rim: new THREE.ShaderMaterial({
        ...base, fragmentShader: RIM_FRAG, side: THREE.BackSide,
        uniforms: { uSunV: { value: new THREE.Vector3() }, uWarm: { value: new THREE.Color('#ffb070') }, uFade: { value: 1 } },
      }),
    };
  }, []);
  useEffect(() => () => { terminator.dispose(); rim.dispose(); }, [terminator, rim]);
  // The news PiP films from inside these shells: fade them for its camera during its pass only.
  useEffect(() => {
    let t = 1, r = 1;
    return onPipPass((on, cam) => {
      if (on) {
        t = terminator.uniforms.uFade.value as number; r = rim.uniforms.uFade.value as number;
        terminator.uniforms.uFade.value = 0;
        rim.uniforms.uFade.value = rimFade(cam.position.length());
      } else { terminator.uniforms.uFade.value = t; rim.uniforms.uFade.value = r; }
    });
  }, [terminator, rim]);
  useFrame(({ camera }) => {
    terminator.uniforms.uFade.value = smooth(1.3, 1.8, camera.position.length()); // the shell sits above the terrain: hide it close up
    (rim.uniforms.uSunV.value as THREE.Vector3).copy(sunDir).transformDirection(camera.matrixWorldInverse);
    rim.uniforms.uFade.value = rimFade(camera.position.length()); // the camera can zoom inside this shell
  });
  return (
    <>
      <mesh material={terminator} renderOrder={1} raycast={noRaycast}>
        <sphereGeometry args={[1.066, 64, 48]} />
      </mesh>
      <mesh material={rim} renderOrder={1} raycast={noRaycast}>
        <sphereGeometry args={[1.14, 48, 32]} />
      </mesh>
    </>
  );
}

const CITY_VERT = /* glsl */ `
uniform vec3 uSun;
uniform float uScale;
attribute float aSize;
varying float vNight;
void main() {
  vNight = smoothstep(0.08, -0.18, dot(normalize(position), uSun));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(aSize * uScale / -mv.z, 14.0 * uScale);
  gl_Position = projectionMatrix * mv;
}`;
const CITY_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vNight;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(p)) * vNight * 0.9;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** Faint warm dots at towns, cities and capitals, only on the night side. One draw call. */
function CityLights() {
  const world = useWorld((s) => s.world);
  // B8: the lights only change when a town, city or capital appears, goes or grows, not on every tick.
  const lit = useWorld((s) => {
    let n = 0, h = 0;
    for (const st of s.world?.structures ?? []) {
      if (st.kind !== 'town' && st.kind !== 'city' && st.kind !== 'capital') continue;
      n++;
      h = (h * 31 + st.tile * 131 + st.kind.charCodeAt(1)) | 0;
    }
    return `${n}:${h}`;
  });
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: CITY_VERT, fragmentShader: CITY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSun: { value: sunDir }, uColor: { value: new THREE.Color('#ffc46a') }, uScale: { value: 1 } },
  }), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    if (!world) return g;
    const pos: number[] = [], size: number[] = [];
    const SIZE: Record<string, number> = { town: 14, city: 22, capital: 30 };
    for (const s of world.structures) {
      const t = world.tiles[s.tile];
      if (!t || !SIZE[s.kind]) continue;
      const r = tileHeight(t) + 0.006;
      pos.push(t.center[0] * r, t.center[1] * r, t.center[2] * r);
      size.push(SIZE[s.kind]);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    return g;
  }, [world, lit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => mat.dispose(), [mat]);
  // size.height is the canvas height r3f already measured: reading clientHeight here forced a layout every frame
  useFrame(({ gl, size }) => { mat.uniforms.uScale.value = (gl.getPixelRatio() * size.height) / 2400; });
  return <points geometry={geo} material={mat} renderOrder={2} raycast={noRaycast} frustumCulled={false} />;
}

const MOON_R = 0.13, MOON_ORBIT = 3.5, MOON_PERIOD = 76, MOON_TILT = 0.42;

/** Grey cratered surface drawn once on a canvas (equirectangular), used as colour and bump. */
function moonTexture(): THREE.Texture {
  const W = 256, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = '#9a9894';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { // dark maria
    const x = rnd() * W, y = H * (0.25 + rnd() * 0.5), r = 10 + rnd() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(70,70,72,0.55)');
    grad.addColorStop(1, 'rgba(70,70,72,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2600; i++) { // grain
    const v = 120 + rnd() * 70;
    g.fillStyle = `rgba(${v},${v},${v - 4},0.18)`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 90; i++) { // craters: dark bowl, light rim on one side
    const x = rnd() * W, y = 6 + rnd() * (H - 12), r = 1.5 + rnd() ** 2.5 * 9;
    g.fillStyle = 'rgba(60,60,62,0.45)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(215,213,206,0.55)';
    g.lineWidth = Math.max(0.8, r * 0.25);
    g.beginPath(); g.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A small moon on a tilted orbit; only out when the camera is zoomed out past ~2.4. */
function Moon() {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(moonTexture, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2, roughness: 1, metalness: 0, transparent: true }), [tex]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  const tilt = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(MOON_TILT, 0, 0.22)), []);
  const frozen = useMemo(reducedMotion, []);
  const t = useRef(18);
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__celestial = { setSunAngle, holdSun, setMoonTime: (s: number) => { t.current = s; } };
  }, []);
  useFrame(({ camera }, dt) => {
    const m = ref.current;
    if (!m) return;
    if (!frozen) t.current += Math.min(dt, 0.1);
    const a = (t.current / MOON_PERIOD) * Math.PI * 2;
    m.position.set(Math.cos(a) * MOON_ORBIT, 0, Math.sin(a) * MOON_ORBIT).applyQuaternion(tilt);
    m.rotation.y = -a; // tidally locked
    const camD = camera.position.length();
    const near = m.position.distanceTo(camera.position);
    // Fade out while it would sit between the camera and the planet (only possible when zoomed far out).
    v.copy(m.position).sub(camera.position).normalize();
    const offAxis = Math.acos(THREE.MathUtils.clamp(-v.dot(camera.position) / camD, -1, 1));
    const inFront = near < camD ? 1 - smooth(Math.asin(Math.min(1, 1 / camD)), Math.asin(Math.min(1, 1 / camD)) + 0.15, offAxis) : 0;
    const k = smooth(2.4, 2.7, camD) * smooth(1.0, 1.7, near) * (1 - inFront);
    mat.opacity = k;
    m.visible = k > 0.01;
  });
  return (
    <mesh ref={ref} material={mat} raycast={noRaycast} renderOrder={0}>
      <sphereGeometry args={[MOON_R, 40, 28]} />
    </mesh>
  );
}

export function Celestial() {
  return (
    <>
      <SunLight />
      <Sun />
      <Shells />
      <CityLights />
      <Moon />
    </>
  );
}
