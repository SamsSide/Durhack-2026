// Rain streaks under the heavy weather systems: one LineSegments, every drop placed and animated in
// the vertex shader from the shared weather systems. Fades in as the camera comes down from orbit.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sunDir } from '../celestial/sun';
import { MAX_SYS, systems } from './weather';
import { RAIN_FRAG, RAIN_VERT } from './shaders';

const DROPS_PER_SYSTEM = 1400;
const FADE_FAR = 2.7, FADE_NEAR = 1.75;

export function Rain({ quality }: { quality: { level: number } }) {
  const { geo, mat } = useMemo(() => {
    const n = DROPS_PER_SYSTEM * MAX_SYS;
    const seed = new Float32Array(n * 2 * 3), sys = new Float32Array(n * 2), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random(), b = Math.random(), c = Math.random();
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        seed.set([a, b, c], j * 3);
        sys[j] = i % MAX_SYS; // interleaved, so a shorter draw range thins every system evenly
        end[j] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    geo.setAttribute('aSys', new THREE.BufferAttribute(sys, 1));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG,
      uniforms: {
        uSys: { value: Array.from({ length: MAX_SYS }, () => new THREE.Vector4()) },
        uSysP: { value: Array.from({ length: MAX_SYS }, () => new THREE.Vector4()) },
        uSun: { value: sunDir }, uTime: { value: 0 }, uFade: { value: 0 },
      },
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const lines = useMemo(() => {
    const l = new THREE.LineSegments(geo, mat);
    l.frustumCulled = false;
    l.renderOrder = 899; // under the cloud composite, before the names
    l.raycast = () => {};
    return l;
  }, [geo, mat]);

  useFrame(({ camera, clock }) => {
    const d = camera.position.length();
    const t = Math.min(1, Math.max(0, (FADE_FAR - d) / (FADE_FAR - FADE_NEAR)));
    const fade = t * t * (3 - 2 * t);
    let any = false;
    const u = mat.uniforms;
    for (let i = 0; i < MAX_SYS; i++) {
      const s = systems[i]!;
      (u.uSys!.value as THREE.Vector4[])[i]!.set(s.center.x, s.center.y, s.center.z, s.rain > 0.02 ? s.radius : 0);
      (u.uSysP!.value as THREE.Vector4[])[i]!.set(s.intensity, s.storm, s.spin, s.rain);
      if (s.rain > 0.02) any = true;
    }
    lines.visible = any && fade > 0.01;
    u.uFade!.value = fade;
    u.uTime!.value = clock.elapsedTime;
    geo.setDrawRange(0, (quality.level >= 2 ? DROPS_PER_SYSTEM * MAX_SYS : DROPS_PER_SYSTEM * MAX_SYS * 2));
  });
  return <primitive object={lines} />;
}
