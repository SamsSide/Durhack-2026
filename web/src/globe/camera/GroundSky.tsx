// The sky seen from ground view: a band of air that glows along the horizon and thins towards the
// zenith, blue by day and dark by night. Invisible in the normal orbit (the rim shells cover that).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sunDir } from '../celestial/sun';
import { groundView } from './groundView';

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uFade;
varying vec3 vWorld;
void main() {
  vec3 o = cameraPosition;
  vec3 d = normalize(vWorld - o);
  float r = length(o);
  vec3 up = o / r;
  float along = dot(o, d);                       // < 0: the ray heads towards the planet
  float pass = sqrt(max(r * r - along * along, 0.0)); // closest the ray comes to the centre
  float alt = max((along < 0.0 ? pass : r) - 1.0, 0.0);
  float elev = max(dot(d, up), 0.0);             // 0 at the level, 1 straight up
  float air = exp(-alt / 0.09) * (0.22 / (elev + 0.22));
  float day = smoothstep(-0.18, 0.3, dot(uSun, up));
  float toSun = max(dot(d, uSun), 0.0);
  vec3 dayCol = mix(vec3(0.30, 0.56, 0.95), vec3(0.74, 0.88, 1.0), pow(air, 2.0));
  vec3 nightCol = vec3(0.05, 0.09, 0.19);
  vec3 col = mix(nightCol, dayCol, day);
  // Low sun: a warm wash on the side of the sky the sun is on.
  float dusk = (1.0 - abs(day * 2.0 - 1.0)) * pow(toSun, 4.0);
  col = mix(col, vec3(1.0, 0.55, 0.28), dusk * 0.7);
  float a = clamp(air * mix(0.55, 0.95, day), 0.0, 1.0) * uFade;
  gl_FragColor = vec4(col, a);
}`;

export function GroundSky() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir }, uFade: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  }), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const f = groundView.tilt;
    m.visible = f > 0.01;
    mat.uniforms.uFade!.value = f;
  });
  return (
    <mesh ref={ref} material={mat} renderOrder={0} frustumCulled={false} raycast={() => null} visible={false}>
      <sphereGeometry args={[30, 32, 16]} />
    </mesh>
  );
}
