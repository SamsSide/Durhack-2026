// A cyan rim around the planet and a cheap star field. Mount once inside <Canvas> in Globe.tsx. Lane b.
import { useMemo } from 'react';
import * as THREE from 'three';
import { getPalette } from '../palette';

const RIM_RADIUS = 1.14;
const STAR_COUNT = 1500;
const STAR_RADIUS = 60;

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

function Stars() {
  const geo = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    let s = 1337; // fixed seed: the same sky every load
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < STAR_COUNT; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(a) * r * STAR_RADIUS;
      pos[i * 3 + 1] = u * STAR_RADIUS;
      pos[i * 3 + 2] = Math.sin(a) * r * STAR_RADIUS;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const color = useMemo(() => new THREE.Color(getPalette().parchment), []);
  return (
    <points geometry={geo} frustumCulled={false} renderOrder={-1}>
      <pointsMaterial color={color} size={1.4} sizeAttenuation={false} transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

export function Atmosphere() {
  return (
    <>
      <Stars />
      <Rim />
    </>
  );
}
