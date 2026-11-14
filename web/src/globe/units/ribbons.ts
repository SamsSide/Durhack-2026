// Ribbon geometry and shaders: march and attack arrows, front lines with teeth, border pulses,
// and flat province fans for the treaty flash. Lane b (B5).
import * as THREE from 'three';
import type { World } from '@terra/shared';
import type { MeshEdge } from '../mesh/buildProvinceMesh';

const COLORSPACE = '#include <colorspace_fragment>';

// ---------- arrows ----------

const SHAFT_ROWS = 20;
export const ARROW_ROWS = SHAFT_ROWS + 2;
const S_START = 0.05, S_HEAD = 0.78, S_TIP = 0.97;

export function arrowGeometry(): THREE.BufferGeometry {
  const n = ARROW_ROWS * 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const side = new Float32Array(n), u = new Float32Array(n);
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aU', new THREE.BufferAttribute(u, 1));
  g.setAttribute('aLen', new THREE.BufferAttribute(new Float32Array(n), 1));
  for (let r = 0; r < ARROW_ROWS; r++) { side[r * 2] = -1; side[r * 2 + 1] = 1; }
  const idx: number[] = [];
  for (let r = 0; r < ARROW_ROWS - 1; r++) {
    const a = r * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setIndex(idx);
  return g;
}

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _x = new THREE.Vector3();

/** A point on the great-circle arc from unit vector a to b, at radius lerp(ra, rb) plus a hump. */
export function arcPoint(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, s: number, hump: number): THREE.Vector3 {
  const d = Math.min(1, Math.max(-1, a.dot(b)));
  const om = Math.acos(d);
  if (om < 1e-4) out.copy(a);
  else {
    const so = Math.sin(om);
    out.copy(a).multiplyScalar(Math.sin((1 - s) * om) / so).addScaledVector(b, Math.sin(s * om) / so);
  }
  out.normalize();
  return out.multiplyScalar(ra + (rb - ra) * s + hump * Math.sin(Math.PI * s));
}

export function arcHump(a: THREE.Vector3, b: THREE.Vector3): number {
  const om = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  return 0.004 + om * 0.12;
}

/** Lay a tapered arrow from unit direction a (radius ra) to b (radius rb). width is the shaft width. */
export function writeArrow(g: THREE.BufferGeometry, a: THREE.Vector3, ra: number, b: THREE.Vector3, rb: number, width: number): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uA = g.getAttribute('aU') as THREE.BufferAttribute;
  const lenA = g.getAttribute('aLen') as THREE.BufferAttribute;
  const hump = arcHump(a, b);
  let len = 0;
  const prev = new THREE.Vector3();
  for (let r = 0; r < ARROW_ROWS; r++) {
    let s: number, w: number;
    if (r < SHAFT_ROWS) {
      const k = r / (SHAFT_ROWS - 1);
      s = S_START + (S_HEAD - S_START) * k;
      w = width * (0.45 + 0.55 * k);
    } else if (r === SHAFT_ROWS) { s = S_HEAD; w = width * 2.3; }
    else { s = S_TIP; w = 0; }
    arcPoint(_p, a, b, ra, rb, s, hump);
    arcPoint(_q, a, b, ra, rb, Math.min(1, s + 0.01), hump);
    arcPoint(_t, a, b, ra, rb, Math.max(0, s - 0.01), hump);
    _t.subVectors(_q, _t);
    _n.copy(_p).normalize();
    _x.crossVectors(_t, _n).normalize().multiplyScalar(w / 2);
    if (r > 0) len += _p.distanceTo(prev);
    prev.copy(_p);
    for (let k = 0; k < 2; k++) {
      const i = r * 2 + k;
      const sgn = k === 0 ? -1 : 1;
      pos.setXYZ(i, _p.x + _x.x * sgn, _p.y + _x.y * sgn, _p.z + _x.z * sgn);
      uA.setX(i, (s - S_START) / (S_TIP - S_START));
      lenA.setX(i, len);
    }
  }
  pos.needsUpdate = true;
  uA.needsUpdate = true;
  lenA.needsUpdate = true;
}

export function arrowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color() },
      uLight: { value: new THREE.Color() },
      uInk: { value: new THREE.Color() },
      uTime: { value: 0 },
      uSpeed: { value: 1 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSide; attribute float aU; attribute float aLen;
      varying float vSide; varying float vU; varying float vLen;
      void main() {
        vSide = aSide; vU = aU; vLen = aLen;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uLight; uniform vec3 uInk;
      uniform float uTime; uniform float uSpeed; uniform float uOpacity;
      varying float vSide; varying float vU; varying float vLen;
      void main() {
        float edge = abs(vSide);
        vec3 c = uColor;
        float stripe = step(0.5, fract(vLen * 90.0 - uTime * uSpeed));
        c = mix(c, uLight, stripe * 0.55 * (1.0 - step(0.55, edge)) * (1.0 - step(0.8, vU)));
        if (edge > 0.68) c = uInk;
        gl_FragColor = vec4(c, uOpacity * smoothstep(0.0, 0.2, vU));
        ${COLORSPACE}
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---------- front lines and border pulses ----------

export function lineMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color() },
      uInk: { value: new THREE.Color() },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uScale;
      attribute vec3 aOff; attribute float aSide; attribute float aMode;
      varying float vSide; varying float vMode; varying vec3 vPos;
      void main() {
        vSide = aSide; vMode = aMode;
        vec3 p = position + aOff * uScale;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uInk; uniform float uTime; uniform float uOpacity;
      varying float vSide; varying float vMode; varying vec3 vPos;
      void main() {
        float pulse = 0.8 + 0.2 * sin(uTime * 3.0 - (vPos.x + vPos.y + vPos.z) * 70.0);
        vec3 c = uColor * pulse;
        if (vMode < 0.5 && abs(vSide) > 0.7) c = uInk;
        if (vMode > 0.5) c = mix(uColor, uInk, 0.25);
        gl_FragColor = vec4(c, uOpacity);
        ${COLORSPACE}
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const HALF_W = 0.0028;   // line half width at uScale 1
const TOOTH_LEN = 0.0075;
const TOOTH_HALF = 0.0028;
const EXTRA_LIFT = 0.0016;

class LineBuilder {
  pos: number[] = []; off: number[] = []; side: number[] = []; mode: number[] = []; idx: number[] = [];
  vert(p: THREE.Vector3, o: THREE.Vector3, side: number, mode: number): number {
    this.pos.push(p.x, p.y, p.z);
    this.off.push(o.x, o.y, o.z);
    this.side.push(side);
    this.mode.push(mode);
    return this.side.length - 1;
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aOff', new THREE.Float32BufferAttribute(this.off, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(this.side, 1));
    g.setAttribute('aMode', new THREE.Float32BufferAttribute(this.mode, 1));
    g.setIndex(this.idx);
    return g;
  }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3(), _al = new THREE.Vector3(),
  _ac = new THREE.Vector3(), _o = new THREE.Vector3(), _c = new THREE.Vector3();

function lift(v: THREE.Vector3): THREE.Vector3 {
  const l = v.length() || 1;
  return v.multiplyScalar((l + EXTRA_LIFT) / l);
}

/**
 * A thick line along the given edges. With teeth: teethInto(edge) returns +1 or -1 for which
 * tile side (tileB / tileA) the tooth points into, or 0 for small teeth on both sides.
 */
export function lineGeometry(world: World, edges: MeshEdge[], teethInto: ((e: MeshEdge) => number) | null): THREE.BufferGeometry {
  const L = new LineBuilder();
  for (const e of edges) {
    lift(_a.set(e.a[0], e.a[1], e.a[2]));
    lift(_b.set(e.b[0], e.b[1], e.b[2]));
    _m.addVectors(_a, _b).multiplyScalar(0.5);
    _al.subVectors(_b, _a).normalize();
    _ac.crossVectors(_al, _c.copy(_m).normalize()).normalize();
    // quad, extended a little past both ends so the joins close
    const i0 = L.vert(_a, _o.copy(_ac).multiplyScalar(HALF_W).addScaledVector(_al, -HALF_W * 0.8), 1, 0);
    const i1 = L.vert(_a, _o.copy(_ac).multiplyScalar(-HALF_W).addScaledVector(_al, -HALF_W * 0.8), -1, 0);
    const i2 = L.vert(_b, _o.copy(_ac).multiplyScalar(HALF_W).addScaledVector(_al, HALF_W * 0.8), 1, 0);
    const i3 = L.vert(_b, _o.copy(_ac).multiplyScalar(-HALF_W).addScaledVector(_al, HALF_W * 0.8), -1, 0);
    L.idx.push(i0, i1, i2, i1, i3, i2);
    if (!teethInto) continue;
    const into = teethInto(e);
    // which way along _ac is tileB?
    const cb = world.tiles[e.tileB]!.center;
    const towardB = _c.set(cb[0], cb[1], cb[2]).sub(_m).dot(_ac) >= 0 ? 1 : -1;
    const dirs = into === 0 ? [1, -1] : [into * towardB];
    const scale = into === 0 ? 0.65 : 1;
    for (const d of dirs) {
      const t0 = L.vert(_m, _o.copy(_al).multiplyScalar(TOOTH_HALF * scale).addScaledVector(_ac, d * HALF_W * 0.6), 0, 1);
      const t1 = L.vert(_m, _o.copy(_al).multiplyScalar(-TOOTH_HALF * scale).addScaledVector(_ac, d * HALF_W * 0.6), 0, 1);
      const t2 = L.vert(_m, _o.copy(_ac).multiplyScalar(d * (HALF_W + TOOTH_LEN * scale)), 0, 1);
      L.idx.push(t0, t1, t2);
    }
  }
  return L.build();
}

// ---------- province fans ----------

/** A flat fan over each tile's top face, a little above the ground. */
export function tileFanGeometry(world: World, heights: Float32Array, tiles: number[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const t of tiles) {
    const tile = world.tiles[t];
    if (!tile) continue;
    const r = heights[t]! + 0.0022;
    const base = pos.length / 3;
    _c.set(tile.center[0], tile.center[1], tile.center[2]).normalize().multiplyScalar(r);
    pos.push(_c.x, _c.y, _c.z);
    for (const b of tile.boundary) {
      _c.set(b[0], b[1], b[2]).normalize().multiplyScalar(r);
      pos.push(_c.x, _c.y, _c.z);
    }
    const k = tile.boundary.length;
    for (let i = 0; i < k; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % k));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
