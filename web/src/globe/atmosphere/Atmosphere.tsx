// A cyan rim around the planet (the stars live in ../space/Space.tsx). Mount once inside <Canvas> in Globe.tsx. Lane b.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPalette } from '../palette';
import { rimFade } from '../celestial/sun';
import { onPipPass } from '../pip/pipLod';

const RIM_RADIUS = 1.14;

const VERT = /* glsl */ `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uFade;
varying vec3 vNormal;
void main() {
  float k = clamp(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float i = pow(k, 3.0) * uStrength * uFade;
  gl_FragColor = vec4(uColor * i, i);
}`;

function Rim() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(getPalette().holo) }, uStrength: { value: 0.55 }, uFade: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), []);
  // The camera can zoom inside this shell (CAM_MIN < RIM_RADIUS): fade it out first (see rimFade).
  useFrame(({ camera }) => { mat.uniforms.uFade.value = rimFade(camera.position.length()); });
  // The news PiP films from inside the shell: faded for its camera during its pass only.
  useEffect(() => {
    let was = 1;
    return onPipPass((on, cam) => {
      if (on) { was = mat.uniforms.uFade.value as number; mat.uniforms.uFade.value = rimFade(cam.position.length()); }
      else mat.uniforms.uFade.value = was;
    });
  }, [mat]);
  return (
    <mesh renderOrder={1} material={mat}>
      <sphereGeometry args={[RIM_RADIUS, 48, 32]} />
    </mesh>
  );
}

export function Atmosphere() {
  return (
    <>
      <Rim />
    </>
  );
}
