// A cyan rim around the planet (the stars live in ../space/Space.tsx). Mount once inside <Canvas> in Globe.tsx. Lane b.
import { useMemo } from 'react';
import * as THREE from 'three';
import { getPalette } from '../palette';

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
varying vec3 vNormal;
void main() {
  float k = clamp(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float i = pow(k, 3.0) * uStrength;
  gl_FragColor = vec4(uColor * i, i);
}`;

function Rim() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(getPalette().holo) }, uStrength: { value: 0.55 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), []);
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
