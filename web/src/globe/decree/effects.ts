// What each decree looks like on the globe (#288, "show, don't tell"). One DecreeSlot plays one decree:
// a tint over the provinces hit (overlay.ts), particles from the shared WarFx-style pools, and a few
// pooled meshes (two shockwave rings, a beam of light, a halo, a lightning bolt). Every effect scales
// with the decree's severity (0.05..0.8) and lasts about 5 to 6 s. Lane b.
import * as THREE from 'three';
import type { DecreeEffect, World } from '@terra/shared';
import { tileHeight } from '../mesh/buildProvinceMesh';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';
import { ParticlePool } from '../war/particles';
import { GLYPH, GlyphPool } from './glyphs';
import type { Glyph } from './glyphs';
import { TileOverlay } from './overlay';
import type { OverlayLook } from './overlay';

export type Visible = Exclude<DecreeEffect, 'none'>;
export const VISIBLE: Visible[] = ['meteor', 'plague', 'famine', 'storm', 'flood', 'prophet', 'goldrush', 'rebellion'];

export interface Pools { fire: ParticlePool; smoke: ParticlePool; glyphs: GlyphPool }

const LOOK: Record<Visible, OverlayLook & { creep: number }> = {
  plague:    { a: '#7e9a1e', b: '#d4ec6a', alpha: 0.52, freq: 70, creep: 2.6 },
  famine:    { a: '#6b4a1e', b: '#b48d45', alpha: 0.6, freq: 110, creep: 2.2 },
  storm:     { a: '#34435e', b: '#8da2c6', alpha: 0.5, freq: 40, creep: 1.0 },
  meteor:    { a: '#22150c', b: '#ff7a24', alpha: 0.82, freq: 260, ember: 1, flick: 0.2, creep: 0.9 },
  flood:     { a: '#1b5aa6', b: '#8fcfff', alpha: 0.6, freq: 60, wave: 0.55, creep: 2.4 },
  prophet:   { a: '#ffdb7a', b: '#fff6d8', alpha: 0.28, freq: 50, additive: true, creep: 1.4 },
  goldrush:  { a: '#a8781e', b: '#ffe27a', alpha: 0.34, freq: 90, wave: 0.6, additive: true, creep: 1.2 },
  rebellion: { a: '#6e0d09', b: '#e2361f', alpha: 0.45, freq: 80, flick: 0.9, creep: 1.6 },
};

const C = {
  flash: new THREE.Color('#fff4d6'), white: new THREE.Color('#ffffff'),
  fire0: new THREE.Color('#ffd166'), fire1: new THREE.Color('#b8321a'), spark: new THREE.Color('#ffb04a'),
  smoke0: new THREE.Color('#231f1c'), smoke1: new THREE.Color('#857f77'),
  dust0: new THREE.Color('#9c7a48'), dust1: new THREE.Color('#d6c19a'),
  miasma0: new THREE.Color('#8fb02a'), miasma1: new THREE.Color('#d8f07a'), bone: new THREE.Color('#e4f4b0'),
  cloud0: new THREE.Color('#4a5468'), cloud1: new THREE.Color('#a3aec2'),
  spray: new THREE.Color('#bfe6ff'), spray1: new THREE.Color('#4f8fd6'),
  holy: new THREE.Color('#fff1bf'), holy1: new THREE.Color('#ffc94a'),
  gold: new THREE.Color('#ffd34d'), gold1: new THREE.Color('#ff9d1a'),
  ember: new THREE.Color('#ff7a2a'),
};

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const _j = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const ringGeo = new THREE.RingGeometry(0.9, 1, 64);
const haloGeo = new THREE.RingGeometry(0.72, 1, 64);
const beamGeo = new THREE.CylinderGeometry(1, 1.6, 1, 28, 1, true).translate(0, 0.5, 0);
const BOLT_SEG = 12;

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying float vEdge;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vEdge = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uT;
varying vec2 vUv;
varying float vEdge;
void main() {
  float fall = pow(1.0 - vUv.y, 1.4);
  float shimmer = 0.75 + 0.25 * sin(vUv.y * 26.0 - uT * 5.0);
  vec3 col = mix(vec3(1.0, 0.82, 0.45), vec3(1.0, 0.98, 0.9), vEdge);
  gl_FragColor = vec4(col, uAlpha * pow(vEdge, 1.6) * fall * shimmer);
}`;

/** A random tangent vector at n, length up to amount. */
function jitter(out: THREE.Vector3, n: THREE.Vector3, amount: number): THREE.Vector3 {
  out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  out.addScaledVector(n, -out.dot(n));
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0).addScaledVector(n, -n.x);
  return out.normalize().multiplyScalar(amount * Math.random());
}

function windAt(n: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  out.crossVectors(UP, n);
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
  return out.normalize();
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A province's top surface point. */
export function surfacePoint(world: World, tile: number, lift: number, out: THREE.Vector3): boolean {
  const t = world.tiles[tile];
  if (!t) return false;
  out.set(t.center[0], t.center[1], t.center[2]).normalize().multiplyScalar(tileHeight(t) + lift);
  return true;
}

interface Ring { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; born: number; life: number; size: number; peak: number }

export interface DecreePlay { effect: Visible; severity: number; tiles: number[] }

export class DecreeSlot {
  readonly group = new THREE.Group();
  active = false;
  private readonly overlay = new TileOverlay(3);
  private readonly rings: Ring[] = [];
  private readonly beam: THREE.Mesh;
  private readonly beamMat: THREE.ShaderMaterial;
  private readonly halo: THREE.Mesh;
  private readonly haloMat: THREE.MeshBasicMaterial;
  private readonly bolt: THREE.LineSegments;
  private readonly boltPos = new Float32Array(BOLT_SEG * 2 * 3);
  private readonly boltMat: THREE.LineBasicMaterial;
  private effect: Visible = 'meteor';
  private sev = 0.3;
  private S = 1;
  private U = 1;                  // world scale: the mock world's provinces are three times the size of a big world's
  private start = 0;
  private end = 0;
  private fxStart = 0;            // when the tint and the main show begin (a meteor: on impact)
  private impacted = false;
  private readonly P = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private pts: THREE.Vector3[] = [];
  private ns: THREE.Vector3[] = [];
  private hot: number[] = [];     // indices into pts that get banners and fires
  private nextA = 0;
  private nextB = 0;
  private nextBolt = 0;
  private boltAt = -1;

  constructor(readonly tag: number) {
    this.group.add(this.overlay.mesh);
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false; mesh.renderOrder = 26; mesh.raycast = () => {};
      this.group.add(mesh);
      this.rings.push({ mesh, mat, born: -1, life: 1, size: 0.1, peak: 0.6 });
    }
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      uniforms: { uAlpha: { value: 0 }, uT: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.visible = false; this.beam.renderOrder = 28; this.beam.raycast = () => {};
    this.haloMat = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.halo = new THREE.Mesh(haloGeo, this.haloMat);
    this.halo.visible = false; this.halo.renderOrder = 28; this.halo.raycast = () => {};
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.boltMat = new THREE.LineBasicMaterial({ color: '#e8efff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.bolt = new THREE.LineSegments(bg, this.boltMat);
    this.bolt.visible = false; this.bolt.frustumCulled = false; this.bolt.renderOrder = 29; this.bolt.raycast = () => {};
    this.group.add(this.beam, this.halo, this.bolt);
  }

  /** Start a decree's show `delay` ms from now (time for the camera to arrive). tiles[0] is the centre. */
  play(pools: Pools, pm: ProvinceMesh, world: World, d: DecreePlay, now: number, delay: number): boolean {
    const tiles = d.tiles.filter((t) => world.tiles[t]);
    if (!tiles.length || !surfacePoint(world, tiles[0]!, 0.003, this.P)) return false;
    this.stop(pools);
    this.effect = d.effect;
    this.sev = Math.min(0.8, Math.max(0.05, d.severity || 0.3));
    this.S = 0.8 + this.sev * 1.25;
    this.n.copy(this.P).normalize();
    const first = world.tiles[tiles[0]!]!, nb = world.tiles[first.neighbors[0] ?? -1];
    if (nb) {
      _p.set(...first.center).normalize();
      _d.set(...nb.center).normalize();
      this.U = Math.min(3.5, Math.max(1, _p.distanceTo(_d) / 0.08));
    } else this.U = 1;
    this.pts = []; this.ns = [];
    const ranks: number[] = [];
    let far = 1e-6;
    for (const t of tiles) {
      const p = new THREE.Vector3();
      surfacePoint(world, t, 0.003, p);
      this.pts.push(p); this.ns.push(p.clone().normalize());
      const dist = p.distanceTo(this.P);
      ranks.push(dist); far = Math.max(far, dist);
    }
    for (let i = 0; i < ranks.length; i++) ranks[i] = ranks[i]! / far;
    // the hot spots (banners, fires): the centre and up to five more, spread through the list
    const nHot = Math.min(this.pts.length, 2 + Math.round(this.sev * 5));
    this.hot = [];
    for (let i = 0; i < nHot; i++) this.hot.push(Math.floor((i / nHot) * this.pts.length));
    this.overlay.set(pm, tiles, ranks, LOOK[d.effect]);
    this.start = now + delay;
    this.end = this.start + 5000 + this.sev * 1250;
    this.fxStart = d.effect === 'meteor' ? this.start + 900 : this.start;
    this.impacted = false;
    this.nextA = this.nextB = this.start;
    this.nextBolt = this.start + 300;
    this.boltAt = -1;
    // a meteor comes in from the sky at a slant, from the side away from the wind
    windAt(this.n, _t);
    this.from.copy(this.P).addScaledVector(this.n, 0.42 * this.S * Math.sqrt(this.U)).addScaledVector(_t, -0.32 * this.S * Math.sqrt(this.U));
    if (d.effect === 'prophet') {
      this.beam.position.copy(this.P);
      this.beam.quaternion.setFromUnitVectors(UP, this.n);
      this.halo.position.copy(this.P).addScaledVector(this.n, (0.07 + 0.03 * this.sev) * this.U);
      this.halo.quaternion.setFromUnitVectors(Z, this.n);
    }
    this.active = true;
    return true;
  }

  stop(pools: Pools): void {
    pools.fire.kill(this.tag); pools.smoke.kill(this.tag); pools.glyphs.kill(this.tag);
    this.overlay.hide();
    for (const r of this.rings) { r.born = -1; r.mesh.visible = false; }
    this.beam.visible = false; this.halo.visible = false; this.bolt.visible = false;
    this.active = false;
  }

  /** The point the caption hangs from. */
  get centre(): THREE.Vector3 { return this.P; }

  /** emit on a soft pool, sizes and drift scaled to the size of the provinces */
  private ef(pool: ParticlePool, now: number, p: THREE.Vector3, d: THREE.Vector3, s0: number, s1: number, life: number, alpha: number, c: THREE.Color, o: { tag?: number; c1?: THREE.Color; delay?: number }): void {
    pool.emit(now, p, d.multiplyScalar(this.U), s0 * this.U, s1 * this.U, life, alpha, c, o);
  }

  private eg(pool: GlyphPool, now: number, p: THREE.Vector3, d: THREE.Vector3, g: Glyph, s0: number, s1: number, life: number, alpha: number, c: THREE.Color, tag: number, delay = 0): void {
    pool.emit(now, p, d.multiplyScalar(this.U), g, s0 * this.U, s1 * this.U, life, alpha, c, tag, delay);
  }

  private ring(i: number, now: number, size: number, life: number, color: THREE.Color, peak: number): void {
    const r = this.rings[i]!;
    r.born = now; r.life = life; r.size = size * Math.sqrt(this.U); r.peak = peak;
    r.mesh.position.copy(this.P).setLength(this.P.length() + 0.001);
    r.mesh.quaternion.setFromUnitVectors(Z, this.n);
    r.mat.color.copy(color);
    r.mesh.visible = true;
  }

  private pick(out: THREE.Vector3, spread = 0.012): THREE.Vector3 {
    const i = Math.floor(Math.random() * this.pts.length);
    _t.copy(this.ns[i]!);
    return out.copy(this.pts[i]!).add(jitter(_j, _t, spread * this.U));
  }

  private impact(pools: Pools, now: number): void {
    const { fire, smoke } = pools;
    const P = this.P, n = this.n, S = this.S, tag = this.tag;
    windAt(n, _t);
    this.ef(fire, now, P, _d.set(0, 0, 0), 0.09 * S, 0.26 * S, 520, 1, C.flash, { tag });
    this.ef(fire, now, P, _d.set(0, 0, 0), 0.05 * S, 0.12 * S, 900, 0.9, C.fire0, { tag, c1: C.fire1, delay: 60 });
    for (let i = 0; i < 14; i++) {
      _p.copy(P).add(jitter(_j, n, 0.012 * S));
      _d.copy(jitter(_j, n, 0.03 * S)).addScaledVector(n, 0.035 * S);
      this.ef(fire, now, _p, _d, 0.035 * S, 0.1 * S, 800 + Math.random() * 600, 0.95, C.fire0, { tag, c1: C.fire1, delay: 30 + i * 22 });
    }
    const sparks = Math.round(30 + 40 * this.sev);
    for (let i = 0; i < sparks; i++) {
      _d.copy(jitter(_j, n, 0.09 * S)).addScaledVector(n, 0.05 * S * Math.random());
      this.ef(fire, now, P, _d, 0.008, 0.004, 700 + Math.random() * 700, 1, C.spark, { tag, c1: C.fire1, delay: Math.random() * 120 });
    }
    for (let i = 0; i < 14; i++) {
      _p.copy(P).add(jitter(_j, n, 0.01 * S));
      _d.copy(n).multiplyScalar((0.08 + Math.random() * 0.05) * S).addScaledVector(_t, 0.04 * S).add(jitter(_j, n, 0.02));
      this.ef(smoke, now, _p, _d, 0.02 * S, (0.07 + Math.random() * 0.03) * S, 3600, 0.7, C.smoke0, { tag, c1: C.smoke1, delay: 120 + i * 140 });
    }
    // a dust skirt thrown out along the ground
    for (let i = 0; i < 16; i++) {
      _d.copy(jitter(_j, n, 0.12 * S)).addScaledVector(n, 0.006);
      this.ef(smoke, now, P, _d, 0.02, 0.06 * S, 2200, 0.55, C.dust0, { tag, c1: C.dust1, delay: 40 + Math.random() * 200 });
    }
    this.ring(0, now, 0.09 * S, 900, C.fire0, 0.85);
    this.ring(1, now + 120, 0.15 * S, 1900, C.dust1, 0.45);
  }

  private strike(pools: Pools, now: number): void {
    const i = Math.floor(Math.random() * this.pts.length);
    const ground = this.pts[i]!, n = this.ns[i]!;
    const top = _p.copy(ground).addScaledVector(n, (0.12 + 0.05 * Math.random()) * this.U).add(jitter(_j, n, 0.03 * this.U));
    let k = 0;
    const a = new THREE.Vector3().copy(top);
    for (let s = 1; s <= BOLT_SEG; s++) {
      const f = s / BOLT_SEG;
      const b = _d.copy(top).lerp(ground, f);
      if (s < BOLT_SEG) b.add(jitter(_j, n, 0.014 * this.U * (1 - f * 0.6)));
      this.boltPos[k++] = a.x; this.boltPos[k++] = a.y; this.boltPos[k++] = a.z;
      this.boltPos[k++] = b.x; this.boltPos[k++] = b.y; this.boltPos[k++] = b.z;
      a.copy(b);
      // a thin line alone is one pixel wide: a bead of glow along it makes the bolt read from orbit
      this.ef(pools.fire, now, b, _j.set(0, 0, 0), 0.012, 0.008, 260, 0.9, C.white, { tag: this.tag });
    }
    this.bolt.geometry.getAttribute('position').needsUpdate = true;
    this.boltAt = now;
    this.bolt.visible = true;
    this.ef(pools.fire, now, top, _d.set(0, 0, 0), 0.1, 0.2, 320, 0.8, C.white, { tag: this.tag });
    this.ef(pools.fire, now, ground, _d.set(0, 0, 0), 0.03, 0.08, 380, 1, C.flash, { tag: this.tag });
  }

  /** One frame; returns false once the show is over. */
  tick(pools: Pools, now: number): boolean {
    if (!this.active) return false;
    if (now >= this.end) { this.stop(pools); return false; }
    if (now < this.start) return true;
    const { fire, smoke, glyphs } = pools;
    const S = this.S, sev = this.sev, tag = this.tag;
    const look = LOOK[this.effect];
    const t = (now - this.fxStart) / 1000;
    const left = this.end - now;
    const env = smooth(0, 0.5, t) * smooth(0, 1200, left);
    this.overlay.frame(t / look.creep, t < 0 ? 0 : env, t);
    const busy = 1 / (0.6 + sev); // emission gap factor: a stronger decree emits more often

    switch (this.effect) {
      case 'meteor': {
        const ft = (now - this.start) / 900;
        if (ft < 1) {
          const head = _p.copy(this.from).lerp(this.P, ft * ft);
          this.ef(fire, now, head, _d.set(0, 0, 0), 0.035 * S, 0.006, 420, 1, C.flash, { tag });
          this.ef(fire, now, head, jitter(_j, this.n, 0.006), 0.022 * S, 0.04 * S, 650, 0.8, C.fire0, { tag, c1: C.fire1 });
          this.ef(smoke, now, head, jitter(_j, this.n, 0.01), 0.012 * S, 0.035 * S, 1500, 0.5, C.smoke0, { tag, c1: C.smoke1 });
        } else if (!this.impacted) {
          this.impacted = true;
          this.impact(pools, now);
        } else if (now >= this.nextA) {
          this.nextA = now + 240 * busy;
          const i = Math.floor(Math.random() * this.pts.length);
          _p.copy(this.pts[i]!).add(jitter(_j, this.ns[i]!, 0.006));
          windAt(this.ns[i]!, _t);
          _d.copy(this.ns[i]!).multiplyScalar(0.07).addScaledVector(_t, 0.05).add(jitter(_j, this.ns[i]!, 0.01));
          this.ef(smoke, now, _p, _d, 0.014, 0.06, 3000, 0.55, C.smoke0, { tag, c1: C.smoke1 });
          this.ef(fire, now, _p, _d.copy(this.ns[i]!).multiplyScalar(0.008), 0.012, 0.022, 600, 0.9, C.ember, { tag, c1: C.fire1 });
        }
        break;
      }
      case 'plague': {
        if (now >= this.nextA) {
          this.nextA = now + 70 * busy;
          this.pick(_p, 0.014);
          _d.copy(jitter(_j, _t, 0.035)).addScaledVector(_t, 0.012);
          this.ef(smoke, now, _p, _d, 0.03, 0.075, 2600, 0.38, C.miasma0, { tag, c1: C.miasma1 });
        }
        if (now >= this.nextB) {
          this.nextB = now + 320 * busy;
          this.pick(_p, 0.01);
          this.eg(glyphs, now, _p.addScaledVector(_t, 0.008), _d.copy(_t).multiplyScalar(0.05).add(jitter(_j, _t, 0.01)), GLYPH.skull, 0.015, 0.021, 2300, 0.95, C.bone, tag);
        }
        break;
      }
      case 'famine': {
        if (now >= this.nextA) {
          this.nextA = now + 85 * busy;
          this.pick(_p, 0.014);
          windAt(_t, _d);
          _d.multiplyScalar(0.06).addScaledVector(_t, 0.008).add(jitter(_j, _t, 0.015));
          this.ef(smoke, now, _p, _d, 0.018, 0.06, 2300, 0.5, C.dust0, { tag, c1: C.dust1 });
        }
        break;
      }
      case 'storm': {
        if (now >= this.nextA) {
          this.nextA = now + 55 * busy;
          // dark cloud motes wheeling round the centre, a little above the ground
          const r = (0.02 + Math.random() * 0.1) * S * this.U;
          jitter(_j, this.n, 1).normalize();
          _p.copy(this.P).addScaledVector(_j, r).addScaledVector(this.n, (0.035 + Math.random() * 0.02) * this.U);
          _d.crossVectors(this.n, _j).multiplyScalar(0.07 * S).addScaledVector(_j, -0.012);
          this.ef(smoke, now, _p, _d, 0.06, 0.12, 2200, 0.72, C.cloud0, { tag, c1: C.cloud1 });
        }
        if (now >= this.nextBolt) {
          this.nextBolt = now + (350 + Math.random() * 800) * busy;
          this.strike(pools, now);
        }
        break;
      }
      case 'flood': {
        const rise = smooth(0, 2.4, t) * env;
        this.overlay.mesh.scale.setScalar(1 + rise * (0.0015 + 0.0025 * sev));
        if (now >= this.nextA) {
          this.nextA = now + 110 * busy;
          this.pick(_p, 0.012);
          this.ef(fire, now, _p, jitter(_d, _t, 0.02).addScaledVector(_t, 0.006), 0.008, 0.016, 900, 0.45, C.spray, { tag, c1: C.spray1 });
        }
        break;
      }
      case 'prophet': {
        const a = smooth(0, 0.8, t) * smooth(0, 1200, left);
        this.beam.visible = a > 0.001; this.halo.visible = a > 0.001;
        const bw = (0.014 + 0.01 * sev) * this.U;
        this.beam.scale.set(bw, 0.55 + 0.25 * sev, bw);
        this.beamMat.uniforms.uAlpha!.value = 0.9 * a;
        this.beamMat.uniforms.uT!.value = t;
        const pulse = 1 + 0.08 * Math.sin(t * 3);
        this.halo.scale.setScalar((0.028 + 0.012 * sev) * pulse * this.U);
        this.haloMat.opacity = 0.85 * a;
        if (now >= this.nextA) {
          this.nextA = now + 70 * busy;
          _p.copy(this.P).add(jitter(_j, this.n, 0.03 * S));
          this.ef(fire, now, _p, _d.copy(this.n).multiplyScalar(0.09 + Math.random() * 0.05), 0.01, 0.004, 1500, 0.9, C.holy, { tag, c1: C.holy1 });
        }
        if (now >= this.nextB) {
          this.nextB = now + 500;
          this.eg(glyphs, now, _p.copy(this.halo.position), _d.set(0, 0, 0), GLYPH.star, 0.03, 0.05, 900, 0.9, C.white, tag);
        }
        break;
      }
      case 'goldrush': {
        if (!this.impacted) {
          this.impacted = true;
          this.ef(fire, now, this.P, _d.set(0, 0, 0), 0.05 * S, 0.14 * S, 600, 0.9, C.gold, { tag, c1: C.gold1 });
          const coins = Math.round(16 + 20 * sev);
          for (let i = 0; i < coins; i++) {
            _d.copy(jitter(_j, this.n, 0.09 * S)).addScaledVector(this.n, (0.05 + Math.random() * 0.06) * S);
            this.eg(glyphs, now, this.P, _d, GLYPH.coin, 0.016, 0.012, 1300 + Math.random() * 500, 1, C.white, tag, Math.random() * 250);
          }
        }
        if (now >= this.nextA) {
          this.nextA = now + 45 * busy;
          this.pick(_p, 0.014);
          this.ef(fire, now, _p, _d.copy(_t).multiplyScalar(0.05 + Math.random() * 0.04), 0.009, 0.003, 1300, 1, C.gold, { tag, c1: C.gold1 });
        }
        if (now >= this.nextB) {
          this.nextB = now + 380 * busy;
          this.pick(_p, 0.01);
          this.eg(glyphs, now, _p, _d.copy(_t).multiplyScalar(0.035), Math.random() < 0.5 ? GLYPH.coin : GLYPH.star, 0.012, 0.016, 1200, 1, C.white, tag);
        }
        break;
      }
      case 'rebellion': {
        if (!this.impacted) {
          this.impacted = true;
          for (const h of this.hot) {
            _p.copy(this.pts[h]!).addScaledVector(this.ns[h]!, 0.012);
            this.eg(glyphs, now, _p, _d.copy(this.ns[h]!).multiplyScalar(0.012), GLYPH.banner, 0.03, 0.04, this.end - now, 1, C.white, tag, Math.random() * 400);
          }
        }
        if (now >= this.nextA) {
          this.nextA = now + 60 * busy;
          const h = this.hot[Math.floor(Math.random() * this.hot.length)]!;
          _t.copy(this.ns[h]!);
          _p.copy(this.pts[h]!).add(jitter(_j, _t, 0.012));
          this.ef(fire, now, _p, _d.copy(_t).multiplyScalar(0.014 + Math.random() * 0.01), 0.012, 0.028, 520, 0.95, C.fire0, { tag, c1: C.fire1 });
        }
        if (now >= this.nextB) {
          this.nextB = now + 260 * busy;
          const h = this.hot[Math.floor(Math.random() * this.hot.length)]!;
          _t.copy(this.ns[h]!);
          windAt(_t, _d);
          _d.multiplyScalar(0.04).addScaledVector(_t, 0.06);
          this.ef(smoke, now, this.pts[h]!, _d, 0.012, 0.05, 2600, 0.5, C.smoke0, { tag, c1: C.smoke1 });
        }
        break;
      }
    }

    for (const r of this.rings) {
      if (r.born < 0 || now < r.born) continue;
      const rt = (now - r.born) / r.life;
      if (rt >= 1) { r.born = -1; r.mesh.visible = false; continue; }
      const e = 1 - (1 - rt) ** 3;
      r.mesh.scale.setScalar(0.01 + r.size * e);
      r.mat.opacity = r.peak * (1 - rt) * (1 - rt);
    }
    if (this.boltAt >= 0) {
      const bt = now - this.boltAt;
      if (bt > 220) { this.bolt.visible = false; this.boltAt = -1; }
      else this.boltMat.opacity = bt < 60 ? 1 : bt < 110 ? 0.35 : bt < 150 ? 0.9 : 1 - bt / 220;
    }
    return true;
  }

  dispose(): void {
    this.overlay.dispose();
    for (const r of this.rings) r.mat.dispose();
    this.beamMat.dispose(); this.haloMat.dispose();
    this.bolt.geometry.dispose(); this.boltMat.dispose();
  }
}
