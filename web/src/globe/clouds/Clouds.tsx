// Volumetric-looking clouds, weather and storms (lane a, in lane b's area by owner decision).
// Technique: a low-step raymarch through a thin spherical shell (noise from one baked cube map, a
// second sample toward the sun for self-shadowing), rendered into a small render target and
// composited over the globe before the names. The march costs the same from orbit or from the
// ground, and the render target keeps it cheap on an integrated GPU at any device pixel ratio.
// Weather fronts, rain and decree storms live in ./weather.ts; rain streaks in ./Rain.tsx.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { countryTiles } from '@terra/shared';
import { useWorld } from '../../state/world';
import { reducedMotion, sunDir } from '../celestial/sun';
import { groundView } from '../camera/groundView';
import { makeNoiseCube } from './noise';
import { COMPOSITE_FRAG, FS_VERT, MARCH_FRAG, R_BASE, R_TOP } from './shaders';
import { MAX_SYS, raiseStorm, systems, updateWeather, watchDecrees } from './weather';
import { Rain } from './Rain';
import { usePipHidden } from '../pip/pipLod';

const RENDER_ORDER = 900; // before the names (1000) so the clouds never veil them
const COVER = 0.61;       // noise threshold: higher means fewer, smaller clouds

/** Quality levels: march steps, render-target scale of the drawing buffer, and a pixel cap. */
const LEVELS = [
  { steps: 10, scale: 0.5, maxPixels: 520_000 },
  { steps: 7, scale: 0.42, maxPixels: 340_000 },
  { steps: 5, scale: 0.34, maxPixels: 210_000 },
] as const;
const SLOW_MS = 19.5;   // average frame time that means we are missing 60 fps
const WINDOW_S = 2.5;   // how long it must stay slow before stepping down

// The parting: zoomed in close, the clouds clear from a zone round the camera and along its line of
// sight to the ground, so they never block the view (numbers in world units, planet radius 1).
const PART_START = 0.8;   // camera height above the ground where the parting starts to open (a fly-to stops at 0.6)
const PART_FULL = 0.55;   // and where it is fully open
const PART_R_HIGH = 0.02; // clear radius at the camera as the parting starts
const PART_R_LOW = 0.06;  // and at the lowest zoom: wider when lower
const PART_SLOPE = 0.16;  // the cone: clear radius gained per unit of distance toward the look target
const PART_UNDER = 0.4;   // share of the cone kept once the camera is under the cloud base
const PART_REACH = 0.7;   // the look target is never taken to be further than this
const fwd = new THREE.Vector3();
const smooth01 = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

const vec4s = (): THREE.Vector4[] => Array.from({ length: MAX_SYS }, () => new THREE.Vector4());

export function Clouds() {
  // Clouds and rain are marched for the main camera and pasted over its picture: never in the news PiP (owner, 14 Nov).
  const weatherRef = useRef<THREE.Group>(null);
  usePipHidden(weatherRef);
  const quality = useRef({ level: 0, off: false, repeat: 1, flash: 0, noPart: false }).current; // dev switches for measuring: `off` gives the baseline, `repeat` runs the march several times, `noPart` keeps the clouds closed round a close camera
  const frozen = useMemo(reducedMotion, []);

  const parts = useMemo(() => {
    const noise = makeNoiseCube();
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const cam = { uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() } };
    const march = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: MARCH_FRAG,
      uniforms: {
        ...cam, uNoise: { value: noise }, uSun: { value: sunDir }, uTime: { value: 0 }, uSteps: { value: LEVELS[0].steps },
        uCover: { value: COVER }, uSys: { value: vec4s() }, uSysP: { value: vec4s() }, uFlash: { value: vec4s() },
        uClear: { value: new THREE.Vector4(0, 1, 0, 0.2) }, uClearK: { value: 0 },
        uPartA: { value: new THREE.Vector4() }, uPartB: { value: new THREE.Vector4(0, 0, -1, 0) }, uPartR: { value: new THREE.Vector2() },
      },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    });
    const target = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    const composite = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: COMPOSITE_FRAG,
      uniforms: { ...cam, uMap: { value: target.texture }, uTexel: { value: new THREE.Vector2() }, uViewProj: { value: new THREE.Matrix4() } },
      transparent: true, depthTest: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const marchMesh = new THREE.Mesh(tri, march);
    marchMesh.frustumCulled = false;
    const marchScene = new THREE.Scene();
    marchScene.add(marchMesh);
    const quad = new THREE.Mesh(tri, composite);
    quad.frustumCulled = false;
    quad.renderOrder = RENDER_ORDER;
    quad.raycast = () => {};
    return { noise, tri, cam, march, target, composite, marchScene, quad, size: new THREE.Vector2() };
  }, []);
  useEffect(() => () => {
    parts.noise.dispose(); parts.tri.dispose(); parts.march.dispose(); parts.composite.dispose(); parts.target.dispose();
  }, [parts]);

  // Dev only: lets a browser review raise weather and read the quality level (window.__weather).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __weather?: unknown }).__weather = {
      quality, systems,
      raise: (countryId: number, kind: 'storm' | 'flood' = 'storm') => {
        const w = useWorld.getState().world;
        return w ? raiseStorm(w, countryId, kind, performance.now() / 1000) : false;
      },
    };
  }, [quality]);

  const st = useRef({ tick: 0, tickWorld: '', drift: 0, avg: 16, since: -3, trial: false, before: 16, hold: 0, clearFor: -2 as number, clearK: 0 }).current;

  useFrame(({ gl, camera }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    parts.quad.visible = !quality.off;
    if (quality.off) return;
    const now = performance.now() / 1000;
    const s = useWorld.getState();
    const world = s.world;

    // The smoothed world tick: fronts are a pure function of it, so every viewer sees the same weather.
    if (world) {
      if (st.tickWorld !== world.id || Math.abs(world.tick - st.tick) > 400) { st.tick = world.tick; st.tickWorld = world.id; }
      else st.tick += (world.tick - st.tick) * (1 - Math.exp(-dt * 2));
      watchDecrees(world, s.recentEvents, now);
    }
    updateWeather(world, st.tick, now);
    if (!frozen && !s.clock?.paused) st.drift += dt; // the fine cloud drift follows wall time, like the sun

    // Clouds thin out over the selected nation so its borders, towns and name stay readable.
    const sel = world ? s.selectedCountryId : null;
    if (sel !== st.clearFor && world) {
      st.clearFor = sel ?? -1;
      if (sel != null) {
        const tiles = countryTiles(world, sel);
        const mean = new THREE.Vector3();
        for (const t of tiles) { const c = world.tiles[t]!.center; mean.x += c[0]; mean.y += c[1]; mean.z += c[2]; }
        if (mean.lengthSq() > 1e-9) {
          mean.normalize();
          let far = 0;
          for (const t of tiles) { const c = world.tiles[t]!.center; far = Math.max(far, Math.hypot(c[0] - mean.x, c[1] - mean.y, c[2] - mean.z)); }
          (parts.march.uniforms.uClear!.value as THREE.Vector4).set(mean.x, mean.y, mean.z, Math.min(0.6, Math.max(0.12, far)));
        }
      }
    }
    st.clearK += ((sel != null ? 1 : 0) - st.clearK) * (1 - Math.exp(-dt * 3));

    // Quality fallback: step down when the frame time stays above the 60 fps budget. If a step down
    // does not make frames faster, the clouds are not what is slow: step back up and leave it alone
    // for a while, rather than degrading the sky for nothing.
    if (dtRaw < 0.25) {
      st.avg += (dtRaw * 1000 - st.avg) * 0.04;
      st.since += dtRaw;
      if (st.trial && st.since > WINDOW_S) {
        if (st.avg > st.before * 0.9) { quality.level--; st.hold = 30; }
        st.trial = false; st.since = 0;
      } else if (!st.trial && st.since > WINDOW_S && st.hold <= 0 && st.avg > SLOW_MS && quality.level < LEVELS.length - 1) {
        st.before = st.avg; quality.level++; st.trial = true; st.since = 0;
      }
      st.hold = Math.max(0, st.hold - dtRaw);
    }
    const q = LEVELS[quality.level]!;

    const u = parts.march.uniforms;
    for (let i = 0; i < MAX_SYS; i++) {
      const w = systems[i]!;
      (u.uSys!.value as THREE.Vector4[])[i]!.set(w.center.x, w.center.y, w.center.z, w.intensity > 0.01 ? w.radius : 0);
      (u.uSysP!.value as THREE.Vector4[])[i]!.set(w.intensity, w.storm, w.spin, w.rain);
      (u.uFlash!.value as THREE.Vector4[])[i]!.set(w.flashPos.x, w.flashPos.y, w.flashPos.z, Math.max(w.flash, w.storm > 0.3 ? quality.flash : 0)); // quality.flash: dev hold for screenshots
    }
    u.uTime!.value = st.drift;
    u.uSteps!.value = q.steps;
    u.uClearK!.value = st.clearK;
    camera.updateMatrixWorld();
    parts.cam.uInvProj.value.copy(camera.projectionMatrixInverse);
    parts.cam.uCamWorld.value.copy(camera.matrixWorld);
    parts.cam.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    (parts.composite.uniforms.uViewProj!.value as THREE.Matrix4).multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    // The parting round a close camera (see parting() in shaders.ts). Strength 0 from orbit.
    const eye = parts.cam.uCamPos.value;
    const partK = quality.noPart ? 0 : smooth01((PART_START - groundView.height) / (PART_START - PART_FULL));
    (u.uPartA!.value as THREE.Vector4).set(eye.x, eye.y, eye.z, partK);
    if (partK > 0) {
      camera.getWorldDirection(fwd);
      // Where the middle of the view meets the ground: the far end of the clear cone.
      const eyeR = eye.length(), rg = Math.max(1, eyeR - groundView.height);
      const b = eye.dot(fwd), disc = b * b - (eyeR * eyeR - rg * rg);
      const reach = disc > 0 && -b - Math.sqrt(disc) > 0 ? Math.min(PART_REACH, -b - Math.sqrt(disc)) : 0.25;
      (u.uPartB!.value as THREE.Vector4).set(fwd.x, fwd.y, fwd.z, reach);
      const low = smooth01((0.3 - groundView.height) / 0.25);
      const above = smooth01((eyeR - (R_BASE - 0.02)) / (R_TOP + 0.03 - (R_BASE - 0.02)));
      (u.uPartR!.value as THREE.Vector2).set(PART_R_HIGH + (PART_R_LOW - PART_R_HIGH) * low, PART_SLOPE * (PART_UNDER + (1 - PART_UNDER) * above));
    }

    // March into the small target, then the composite quad draws it in the main pass.
    gl.getDrawingBufferSize(parts.size);
    const k = Math.min(q.scale, Math.sqrt(q.maxPixels / Math.max(1, parts.size.x * parts.size.y)));
    const w = Math.max(8, Math.round(parts.size.x * k)), h = Math.max(8, Math.round(parts.size.y * k));
    if (parts.target.width !== w || parts.target.height !== h) parts.target.setSize(w, h);
    (parts.composite.uniforms.uTexel!.value as THREE.Vector2).set(1 / w, 1 / h);
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(parts.target);
    for (let i = 0; i < quality.repeat; i++) gl.render(parts.marchScene, camera); // repeat > 1 is a dev stress test
    gl.setRenderTarget(prev);
  });

  return (
    <group ref={weatherRef}>
      <primitive object={parts.quad} />
      <Rain quality={quality} />
    </group>
  );
}

