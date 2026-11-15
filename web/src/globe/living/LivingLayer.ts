// The living world: fishing boats, carts on the way to the capital, farmers and herds, windmills,
// chimney smoke, market bustle, birds, surf on the coasts and lit windows at night. Cosmetic and
// client-only: nothing here is in the simulation. It runs at a real-time pace whatever the game
// speed, is placed from the world seed and the ids so it never jumps, is only drawn when the camera
// is close enough to see it, and sheds detail when it costs more than its frame budget.
// Built by lane a in lane b's globe (owner decision, 14 Nov).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { StructureKind, TechAge, World } from '@terra/shared';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';
import { SEA_LEVEL } from '../constants';
import { hash01, smoothstep } from '../structures/placement';
import { standMatrix } from '../units/ModelField';
import { sunDir } from '../celestial/sun';
import { LIVING as L } from './tokens';

type V3 = THREE.Vector3;

/** A spot on the globe with its own tangent frame; offsets are in radians along t1 and t2. */
interface Frame { n: V3; t1: V3; t2: V3; r: number }
interface Boat extends Frame { ax: number; ay: number; ph: number; sp: number; size: number; col: THREE.Color; lod: number }
interface Cart { dirs: V3[]; rad: number[]; off: number; sp: number; size: number; col: THREE.Color; lod: number; side: number }
interface Walker extends Frame { cx: number; cy: number; rad: number; ph: number; sp: number; sx: number; sy: number; sz: number; col: THREE.Color; lod: number }
interface Mill extends Frame { cx: number; cy: number; turn: number; size: number; ph: number; lod: number }
interface Chimney extends Frame { cx: number; cy: number; up: number; size: number; puffs: number; ph: number; col: THREE.Color; lod: number }
interface Flock extends Frame { R: number; alt: number; ph: number; sp: number; n8: number; size: number; col: THREE.Color; lod: number }
interface Surf { n: V3; pos: V3; shore: V3; len: number; reach: number; ph: number; lod: number }

const SETTLEMENT: Partial<Record<StructureKind, { smoke: number; bustle: number; windows: number; spread: number }>> = {
  camp: { smoke: 1, bustle: 0, windows: 2, spread: 0.1 },
  village: { smoke: 1, bustle: 2, windows: 5, spread: 0.16 },
  town: { smoke: 2, bustle: 5, windows: 12, spread: 0.3 },
  city: { smoke: 3, bustle: 11, windows: 24, spread: 0.38 },
  capital: { smoke: 4, bustle: 16, windows: 36, spread: 0.44 },
};
const AGE_RANK: Record<TechAge, number> = { ancient: 0, medieval: 1, gunpowder: 2, industrial: 3, modern: 4, future: 5, stellar: 6 };

const _p = new THREE.Vector3(), _h = new THREE.Vector3(), _q = new THREE.Vector3(), _s = new THREE.Vector3();
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Color();

/** One instanced mesh refilled every frame with whatever is in view. */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  n = 0;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, readonly cap: number, order = 0) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = order;
  }
  get full(): boolean { return this.n >= this.cap; }
  push(m: THREE.Matrix4, c: THREE.Color): void {
    if (this.n >= this.cap) return;
    this.mesh.setMatrixAt(this.n, m);
    this.mesh.setColorAt(this.n, c);
    this.n++;
  }
  end(): void {
    const was = this.mesh.count;
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    if (this.n || was) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true; }
    this.n = 0;
  }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}

function paint(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string): THREE.BufferGeometry =>
  paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  for (const p of parts) p.dispose();
  return g;
}

// All models are about one unit long, +y up, +z forwards.
function boatGeo(): THREE.BufferGeometry {
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.16, 0.3, 0, 0.16, -0.32, 0, 0.95, -0.02, 0, 0.16, -0.32, 0, 0.16, 0.3, 0, 0.95, -0.02]), 3));
  sail.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0]), 3));
  sail.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2));
  return merged([
    box(0.3, 0.16, 0.8, 0, 0.06, 0, L.color.hull),
    box(0.2, 0.14, 0.24, 0, 0.07, 0.48, L.color.hull),
    box(0.04, 0.9, 0.04, 0, 0.5, 0, L.color.hullDark),
    paint(sail, L.color.sail),
  ]);
}
function cartGeo(): THREE.BufferGeometry {
  return merged([
    box(0.42, 0.2, 0.56, 0, 0.2, -0.16, L.color.wood),
    box(0.4, 0.2, 0.5, 0, 0.4, -0.16, L.color.canvas),
    box(0.06, 0.24, 0.24, 0.24, 0.12, -0.16, L.color.hullDark),
    box(0.06, 0.24, 0.24, -0.24, 0.12, -0.16, L.color.hullDark),
    box(0.2, 0.26, 0.38, 0, 0.2, 0.36, L.color.ox),
  ]);
}
function millGeo(): THREE.BufferGeometry {
  return merged([
    paint(new THREE.CylinderGeometry(0.15, 0.26, 0.9, 6).translate(0, 0.45, 0), L.color.millWall),
    paint(new THREE.ConeGeometry(0.2, 0.26, 6).translate(0, 1.03, 0), L.color.millRoof),
  ]);
}
function bladeGeo(): THREE.BufferGeometry {
  return merged([
    box(0.09, 1.3, 0.02, 0, 0, 0, L.color.sail),
    box(1.3, 0.09, 0.02, 0, 0, 0, L.color.sail),
  ]);
}
function birdGeo(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0.3, -1, 0.12, -0.25, 0, 0, -0.08,
    0, 0, 0.3, 0, 0, -0.08, 1, 0.12, -0.25,
  ]), 3));
  g.computeVertexNormals();
  return g;
}

export interface LivingStats { ms: number; quality: number; drawn: number; sites: number; visible: number }

export class LivingLayer {
  readonly group = new THREE.Group();
  readonly stats: LivingStats = { ms: 0, quality: 1, drawn: 0, sites: 0, visible: 0 };
  /** Off: nothing is drawn (used to measure the cost of the layer). */
  enabled = true;

  private readonly dirs: V3[];
  private readonly width: Float32Array; // mean centre-to-corner angle of each tile
  private readonly frames = new Map<number, { t1: V3; t2: V3 }>();

  private boats: Boat[] = [];
  private carts: Cart[] = [];
  private walkers: Walker[] = [];
  private mills: Mill[] = [];
  private chimneys: Chimney[] = [];
  private flocks: Flock[] = [];
  private readonly surf: Surf[] = [];

  private readonly pBoat: Pool; private readonly pCart: Pool; private readonly pDot: Pool; private readonly pMill: Pool;
  private readonly pBlade: Pool; private readonly pSmoke: Pool; private readonly pBird: Pool; private readonly pSurf: Pool;
  private readonly pools: Pool[];
  private windows: THREE.Points | null = null;
  private readonly winMat: THREE.ShaderMaterial;

  private life = 0;      // seconds of life: stops while the world is paused
  private drift = 0;     // seconds of wind and water: slows but never stops
  private sig = '';
  private over = 0;
  private under = 0;
  private readonly foam = new THREE.Color(L.color.foam);
  private readonly reduced: boolean;

  constructor(private world: World, private readonly mesh: ProvinceMesh) {
    this.group.name = 'living';
    this.reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.dirs = world.tiles.map((t) => new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize());
    this.width = new Float32Array(world.tiles.length);
    const b = new THREE.Vector3();
    world.tiles.forEach((t, i) => {
      let sum = 0;
      for (const p of t.boundary) sum += b.set(p[0], p[1], p[2]).normalize().distanceTo(this.dirs[i]!);
      this.width[i] = sum / Math.max(1, t.boundary.length);
    });

    const lit = (): THREE.Material => new THREE.MeshLambertMaterial({ vertexColors: true });
    this.pBoat = new Pool(boatGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), L.cap.boats);
    this.pCart = new Pool(cartGeo(), lit(), L.cap.carts);
    this.pDot = new Pool(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial(), L.cap.dots);
    this.pMill = new Pool(millGeo(), lit(), L.cap.mills);
    this.pBlade = new Pool(bladeGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), L.cap.mills);
    this.pSmoke = new Pool(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.36, depthWrite: false, toneMapped: false }), L.cap.smoke, 7);
    this.pBird = new Pool(birdGeo(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), L.cap.birds, 8);
    this.pSurf = new Pool(new THREE.PlaneGeometry(1, 0.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    }), L.cap.surf, 5);
    this.pools = [this.pBoat, this.pCart, this.pDot, this.pMill, this.pBlade, this.pSmoke, this.pBird, this.pSurf];
    for (const p of this.pools) this.group.add(p.mesh);

    this.winMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uSun: { value: sunDir }, uTime: { value: 0 }, uVis: { value: 0 }, uSize: { value: 0.0032 }, uPx: { value: 800 }, uColor: { value: new THREE.Color(L.color.window) } },
      vertexShader: `
        attribute float seed;
        uniform vec3 uSun; uniform float uTime, uVis, uSize, uPx;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float night = smoothstep(0.08, -0.12, dot(normalize(position), uSun) + (seed - 0.5) * 0.08);
          float twinkle = 0.78 + 0.22 * sin(uTime * (0.6 + seed * 1.7) + seed * 40.0);
          vA = night * twinkle * uVis;
          gl_PointSize = max(2.5, uSize * projectionMatrix[1][1] * uPx * 0.5 / -mv.z);
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.12, length(d)) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor * a * 1.5, a);
        }`,
    });

    this.buildSurf();
    this.buildCaps();
    this.rebuild(world);
  }

  // ---------- placement ----------

  private frame(tile: number): Frame {
    let f = this.frames.get(tile);
    const n = this.dirs[tile]!;
    if (!f) {
      const ref = Math.abs(n.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const t1 = new THREE.Vector3().crossVectors(ref, n).normalize();
      f = { t1, t2: new THREE.Vector3().crossVectors(n, t1).normalize() };
      this.frames.set(tile, f);
    }
    return { n, t1: f.t1, t2: f.t2, r: this.mesh.heights[tile] ?? 1 };
  }

  private isSea(tile: number): boolean { return this.world.tiles[tile]?.terrain === 'ocean'; }

  /** Surf: one streak rolling in on every stretch of coast. Tiles never change, so built once. */
  private buildSurf(): void {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    this.mesh.edges.forEach((e, i) => {
      const seaA = this.isSea(e.tileA), seaB = this.isSea(e.tileB);
      if (seaA === seaB) return;
      const sea = seaA ? e.tileA : e.tileB;
      a.set(e.a[0], e.a[1], e.a[2]).normalize();
      b.set(e.b[0], e.b[1], e.b[2]).normalize();
      const mid = new THREE.Vector3().addVectors(a, b).normalize();
      const out = new THREE.Vector3().subVectors(this.dirs[sea]!, mid);
      out.addScaledVector(mid, -out.dot(mid)).normalize(); // offshore, along the surface
      this.surf.push({
        n: mid.clone(), pos: mid.multiplyScalar(SEA_LEVEL + 0.0005), shore: out.clone().negate(),
        // (the streak rolling in to the shore)
        len: a.distanceTo(b) * (0.35 + 0.3 * hash01(this.world.seed, i * 7 + 4)), reach: this.width[sea]! * 0.1, ph: hash01(this.world.seed, i * 7 + 3), lod: hash01(this.world.seed, i * 7 + 5),
      });
    });
  }

  /** Whitecaps: short flecks of foam coming and going on the water near land. */
  private buildCaps(): void {
    const seed = this.world.seed;
    this.world.tiles.forEach((t, i) => {
      if (t.terrain !== 'ocean' || !t.neighbors.some((nb) => !this.isSea(nb))) return;
      const f = this.frame(i), wd = this.width[i]!;
      for (let k = 0; k < 5; k++) {
        const a = hash01(seed, i * 31 + k * 5 + 1) * 6.28, d = Math.sqrt(hash01(seed, i * 31 + k * 5 + 2)) * wd * 0.55;
        const n = f.n.clone().addScaledVector(f.t1, Math.cos(a) * d).addScaledVector(f.t2, Math.sin(a) * d).normalize();
        const dir = f.t1.clone().multiplyScalar(Math.cos(a * 3)).addScaledVector(f.t2, Math.sin(a * 3));
        this.surf.push({
          n: n.clone(), pos: n.multiplyScalar(SEA_LEVEL + 0.0005), shore: dir, len: wd * (0.05 + 0.06 * hash01(seed, i * 31 + k * 5 + 3)),
          reach: wd * 0.05, ph: hash01(seed, i * 31 + k * 5 + 4), lod: 0.2 + 0.8 * hash01(seed, i * 31 + k * 5 + 5),
        });
      }
    });
  }

  /** A signature of what the layer is placed from: rebuild only when it changes. */
  private signature(w: World): string {
    let h = 0;
    for (const s of w.structures) h = (Math.imul(h, 31) + s.tile * 13 + s.kind.length * 7 + s.kind.charCodeAt(1) + s.owner) | 0;
    let ages = '';
    for (const c of w.countries) ages += (c.techAge ?? 'a')[0];
    let rel = 0;
    for (const r of w.relations) rel = (rel * 7 + r.stance.length + r.a + r.b * 3) | 0;
    return `${w.structures.length}:${h}:${ages}:${rel}`;
  }

  /** Bring the layer in line with the world's structures. Cheap when nothing changed. */
  rebuild(w: World): void {
    this.world = w;
    const sig = this.signature(w);
    if (sig === this.sig) return;
    this.sig = sig;
    const seed = w.seed;
    const H = (id: string | number, salt: number): number => hash01(`${seed}:${id}`, salt);
    this.boats = []; this.carts = []; this.walkers = []; this.mills = []; this.chimneys = []; this.flocks = [];
    const winPos: number[] = [], winSeed: number[] = [];

    // each nation's mood: more carts in peace and with trade partners
    const trade = new Map<number, number>(), war = new Set<number>();
    for (const r of w.relations) {
      if (r.stance === 'war') { war.add(r.a); war.add(r.b); }
      if (r.stance === 'trade' || r.stance === 'alliance') { trade.set(r.a, (trade.get(r.a) ?? 0) + 1); trade.set(r.b, (trade.get(r.b) ?? 0) + 1); }
    }
    const boatSites = new Set<number>();
    const gullTiles = new Set<number>();
    let routes = 0;

    for (const s of w.structures) {
      const tile = w.tiles[s.tile];
      if (!tile || tile.terrain === 'ocean') continue;
      const f = this.frame(s.tile);
      const wd = this.width[s.tile]!;
      const age = AGE_RANK[w.countries[s.owner]?.techAge ?? 'ancient'] ?? 0;
      const set = SETTLEMENT[s.kind];

      // fishing boats off ports and coastal settlements
      if (s.kind === 'port' || (set && s.kind !== 'camp')) {
        const seas = tile.neighbors.filter((nb) => this.isSea(nb));
        if (seas.length && !boatSites.has(s.tile)) {
          boatSites.add(s.tile);
          gullTiles.add(s.tile);
          const count = s.kind === 'port' ? 4 : s.kind === 'village' ? 2 : s.kind === 'town' ? 3 : 5;
          for (let k = 0; k < count; k++) {
            const sea = seas[Math.floor(H(s.id, 100 + k) * seas.length)]!;
            const sf = this.frame(sea);
            const ws = this.width[sea]!;
            // centred in the sea tile, pulled a little towards the shore
            _p.copy(f.n).sub(sf.n);
            const pull = 0.22 * ws / Math.max(1e-6, _p.length());
            const n = sf.n.clone().addScaledVector(_p, pull).normalize();
            this.boats.push({
              n, t1: sf.t1, t2: sf.t2, r: SEA_LEVEL,
              ax: ws * (0.12 + 0.2 * H(s.id, 110 + k)), ay: ws * (0.1 + 0.18 * H(s.id, 120 + k)),
              ph: H(s.id, 130 + k) * 6.28, sp: 0.05 + 0.05 * H(s.id, 140 + k),
              size: wd * L.size.boat * (0.8 + 0.4 * H(s.id, 150 + k)),
              col: new THREE.Color().setHSL(0.08, 0.1, 0.8 + 0.2 * H(s.id, 160 + k)), lod: H(s.id, 170 + k),
            });
          }
        }
      }

      if (set) {
        // chimney smoke: more of it, and darker, from the industrial age on
        const industrial = age >= 3 && age <= 4;
        const stacks = s.kind === 'camp' ? 1 : Math.round(set.smoke * (industrial ? 2 : 1));
        const smokeCol = new THREE.Color(industrial ? L.color.smokeDark : L.color.smoke);
        for (let k = 0; k < stacks; k++) {
          const a = H(s.id, 200 + k) * 6.28, d = Math.sqrt(H(s.id, 210 + k)) * set.spread * wd * 0.8;
          this.chimneys.push({
            ...f, cx: Math.cos(a) * d, cy: Math.sin(a) * d, up: wd * (s.kind === 'camp' ? 0.02 : 0.07),
            size: wd * L.size.smoke * (industrial ? 1.35 : 1), puffs: industrial ? 5 : 4, ph: H(s.id, 220 + k), col: smokeCol, lod: k === 0 ? 0 : H(s.id, 230 + k),
          });
        }
        // market bustle: tiny people about the middle of the bigger places
        for (let k = 0; k < set.bustle; k++) {
          const a = H(s.id, 300 + k) * 6.28, d = Math.sqrt(H(s.id, 310 + k)) * set.spread * wd * 0.9;
          const v = 0.55 + 0.4 * H(s.id, 330 + k);
          this.walkers.push({
            ...f, cx: Math.cos(a) * d, cy: Math.sin(a) * d, rad: wd * (0.03 + 0.05 * H(s.id, 320 + k)), ph: H(s.id, 340 + k) * 6.28,
            sp: 0.25 + 0.3 * H(s.id, 350 + k), sx: 1, sy: 2.1, sz: 1,
            col: new THREE.Color().setHSL(H(s.id, 360 + k), 0.4, 0.3 + v * 0.45), lod: H(s.id, 370 + k),
          });
        }
        // windows lit at night
        for (let k = 0; k < set.windows; k++) {
          const a = H(s.id, 400 + k) * 6.28, d = Math.sqrt(H(s.id, 410 + k)) * set.spread * wd;
          _p.copy(f.n).addScaledVector(f.t1, Math.cos(a) * d).addScaledVector(f.t2, Math.sin(a) * d).normalize()
            .multiplyScalar(f.r + wd * (0.02 + 0.03 * H(s.id, 420 + k)));
          winPos.push(_p.x, _p.y, _p.z);
          winSeed.push(H(s.id, 430 + k));
        }
        // carts between this place and the capital, along the nation's own land
        const cap = w.countries[s.owner]?.capitalTile;
        if (s.kind !== 'camp' && s.kind !== 'capital' && cap != null && cap !== s.tile && routes < L.cap.routes) {
          const path = this.pathTo(s.tile, cap, s.owner);
          if (path) {
            routes++;
            const mood = war.has(s.owner) ? 2 : 3 + Math.min(3, trade.get(s.owner) ?? 0);
            const n = Math.min(mood, 1 + path.length);
            for (let k = 0; k < n; k++) {
              this.carts.push({
                dirs: path.map((t) => this.dirs[t]!), rad: path.map((t) => this.mesh.heights[t] ?? 1),
                off: H(s.id, 500 + k) * 2 * (path.length - 1), sp: 0.085 + 0.04 * H(s.id, 510 + k),
                size: wd * L.size.cart, col: new THREE.Color().setHSL(0.09, 0.15, 0.75 + 0.25 * H(s.id, 520 + k)),
                lod: k === 0 ? H(s.id, 530) * 0.5 : H(s.id, 530 + k), side: wd * 0.035,
              });
            }
          }
        }
      }

      if (s.kind === 'farm') {
        const a0 = H(s.id, 600) * 6.28;
        // farmers pacing their rows
        for (let k = 0; k < 2; k++) {
          const a = a0 + 1.6 + k * 2.4, d = wd * 0.3;
          this.walkers.push({
            ...f, cx: Math.cos(a) * d, cy: Math.sin(a) * d, rad: wd * 0.09, ph: H(s.id, 610 + k) * 6.28, sp: 0.16 + 0.1 * H(s.id, 620 + k),
            sx: 1, sy: 2.1, sz: 1, col: new THREE.Color(k ? L.color.farmerB : L.color.farmerA), lod: H(s.id, 630 + k),
          });
        }
        // a small herd grazing beside it
        const herd = 5 + Math.floor(H(s.id, 640) * 5);
        const pale = H(s.id, 641) < 0.6;
        for (let k = 0; k < herd; k++) {
          const a = a0 + 3.6 + (H(s.id, 650 + k) - 0.5) * 1.3, d = wd * (0.3 + 0.16 * H(s.id, 660 + k));
          this.walkers.push({
            ...f, cx: Math.cos(a) * d, cy: Math.sin(a) * d, rad: wd * 0.022, ph: H(s.id, 670 + k) * 6.28, sp: 0.05 + 0.06 * H(s.id, 680 + k),
            sx: 1.3, sy: 1.1, sz: 2.1, col: new THREE.Color(pale ? L.color.sheep : L.color.cattle).multiplyScalar(0.85 + 0.3 * H(s.id, 690 + k)), lod: H(s.id, 700 + k),
          });
        }
        // a windmill, until machines take over
        if (age >= 1 && age <= 3 && H(s.id, 710) < 0.8) {
          this.mills.push({ ...f, cx: Math.cos(a0) * wd * 0.34, cy: Math.sin(a0) * wd * 0.34, turn: H(s.id, 720) * 6.28, size: wd * L.size.mill, ph: H(s.id, 730) * 6.28, lod: H(s.id, 740) * 0.6 });
        }
      }
    }

    // birds: gulls over the harbours, flocks wheeling over forests and wild coasts
    w.tiles.forEach((t, i) => {
      const gull = gullTiles.has(i);
      const wild = t.terrain === 'ocean' ? 0 : t.terrain === 'forest' ? 0.34 : t.terrain === 'coast' ? 0.3 : t.terrain === 'ice' || t.terrain === 'desert' ? 0.04 : 0.1;
      if (!gull && H(i, 800) >= wild) return;
      if (this.flocks.length >= L.cap.flocks && !gull) return;
      const f = this.frame(i);
      const wd = this.width[i]!;
      let n = f.n;
      if (gull) {
        const sea = t.neighbors.find((nb) => this.isSea(nb));
        if (sea != null) n = f.n.clone().lerp(this.dirs[sea]!, 0.45).normalize(); // over the water's edge
      }
      this.flocks.push({
        n, t1: f.t1, t2: f.t2, r: f.r, R: wd * (gull ? 0.22 : 0.3 + 0.2 * H(i, 810)), alt: wd * (gull ? 0.12 : 0.2 + 0.1 * H(i, 820)),
        ph: H(i, 830) * 6.28, sp: (H(i, 840) < 0.5 ? -1 : 1) * (0.22 + 0.14 * H(i, 850)), n8: gull ? 4 : 4 + Math.floor(H(i, 860) * 4),
        size: wd * L.size.bird, col: new THREE.Color(gull ? L.color.gull : L.color.bird), lod: gull ? H(i, 870) * 0.5 : H(i, 870),
      });
    });

    // wild herds on open country, a lone fishing boat here and there along the coast
    w.tiles.forEach((t, i) => {
      const wd = this.width[i]!;
      if ((t.terrain === 'plains' || t.terrain === 'hills') && H(i, 900) < 0.22) {
        const f = this.frame(i);
        const a0 = H(i, 901) * 6.28, d0 = wd * (0.25 + 0.3 * H(i, 902)), herd = 4 + Math.floor(H(i, 903) * 5);
        for (let k = 0; k < herd; k++) {
          const a = a0 + (H(i, 910 + k) - 0.5) * 0.9, d = d0 + wd * 0.1 * (H(i, 920 + k) - 0.5);
          this.walkers.push({
            ...f, cx: Math.cos(a) * d, cy: Math.sin(a) * d, rad: wd * 0.03, ph: H(i, 930 + k) * 6.28, sp: 0.05 + 0.05 * H(i, 940 + k),
            sx: 1.3, sy: 1.2, sz: 2.2, col: new THREE.Color(L.color.deer).multiplyScalar(0.8 + 0.4 * H(i, 950 + k)), lod: H(i, 960 + k),
          });
        }
      }
      if (t.terrain === 'ocean' && !boatSites.has(i) && H(i, 970) < 0.3 && t.neighbors.some((nb) => !this.isSea(nb) && w.owner[nb]! >= 0)) {
        const f = this.frame(i);
        this.boats.push({
          n: f.n, t1: f.t1, t2: f.t2, r: SEA_LEVEL, ax: wd * (0.15 + 0.2 * H(i, 971)), ay: wd * (0.12 + 0.2 * H(i, 972)),
          ph: H(i, 973) * 6.28, sp: 0.04 + 0.04 * H(i, 974), size: wd * L.size.boat * (0.7 + 0.3 * H(i, 975)),
          col: new THREE.Color().setHSL(0.08, 0.1, 0.8 + 0.2 * H(i, 976)), lod: 0.3 + 0.7 * H(i, 977),
        });
      }
    });

    // windows
    if (this.windows) { this.group.remove(this.windows); this.windows.geometry.dispose(); this.windows = null; }
    if (winPos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(winPos), 3));
      g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(winSeed), 1));
      this.windows = new THREE.Points(g, this.winMat);
      this.windows.frustumCulled = false;
      this.windows.renderOrder = 6;
      this.group.add(this.windows);
    }
    this.stats.sites = this.boats.length + this.carts.length + this.walkers.length + this.mills.length + this.chimneys.length + this.flocks.length + this.surf.length;
  }

  /** Shortest way over the nation's own land, tile by tile; null when there is none or it is too far. */
  private pathTo(from: number, to: number, owner: number): number[] | null {
    const w = this.world;
    const prev = new Map<number, number>([[from, -1]]);
    let ring = [from];
    for (let depth = 0; depth < L.maxRoute && ring.length; depth++) {
      const next: number[] = [];
      for (const t of ring) {
        for (const nb of w.tiles[t]!.neighbors) {
          if (prev.has(nb)) continue;
          const terr = w.tiles[nb]!.terrain;
          if (terr === 'ocean' || terr === 'mountain' || terr === 'ice' || w.owner[nb] !== owner) continue;
          prev.set(nb, t);
          if (nb === to) {
            const path = [to];
            for (let c = t; c >= 0; c = prev.get(c)!) path.push(c);
            return path.reverse();
          }
          next.push(nb);
        }
      }
      ring = next;
    }
    return null;
  }

  // ---------- frame ----------

  private at(f: Frame, a: number, b: number, up: number, out: V3): V3 {
    return out.copy(f.n).addScaledVector(f.t1, a).addScaledVector(f.t2, b).normalize().multiplyScalar(f.r + up);
  }

  /** `dt` in seconds of real time; `paused` is the world clock; `viewPx` the canvas height. */
  update(camera: THREE.Camera, dt: number, paused: boolean, viewPx: number): void {
    const t0 = performance.now();
    const dist = camera.position.length();
    const vis = this.enabled ? smoothstep(L.far, L.near, dist) : 0;
    const q = this.stats.quality;
    if (vis <= 0) {
      if (this.group.visible) { this.group.visible = false; }
      this.stats.drawn = 0; this.stats.visible = 0;
      return;
    }
    this.group.visible = true;
    if (!this.reduced) {
      if (!paused) this.life += dt;
      this.drift += dt * (paused ? 0.35 : 1);
    }
    const life = this.life, drift = this.drift;
    const cam = _q.copy(camera.position).normalize();
    const cosT = Math.min(0.995, 1 / dist - 0.02);          // beyond this the ground is over the horizon
    const fine = smoothstep(L.fineFar, L.fineNear, dist);   // people, herds and bustle only up close
    let seen = 0;
    // unlit things (smoke, birds, foam) dim with the daylight where they are
    const day = (n: V3): number => 0.22 + 0.78 * smoothstep(-0.12, 0.2, n.dot(sunDir));

    // fishing boats: a slow figure over the water, bow to the heading, bobbing and rolling
    for (const b of this.boats) {
      if (b.lod > q || b.n.dot(cam) < cosT || this.pBoat.full) continue;
      const u = b.sp * life + b.ph, v = b.sp * 0.63 * life + b.ph * 2.3;
      const bob = Math.sin(drift * 1.9 + b.ph * 5) * b.size * 0.035;
      this.at(b, b.ax * Math.sin(u), b.ay * Math.sin(v), 0.0004 + bob, _p);
      _h.copy(b.t1).multiplyScalar(b.ax * Math.cos(u)).addScaledVector(b.t2, b.ay * 0.63 * Math.cos(v));
      this.pBoat.push(standMatrix(_m, _p, _h, b.size * vis, Math.sin(drift * 1.5 + b.ph * 3) * 0.1), b.col);
      seen++;
    }

    // carts: out to the capital and back, keeping to one side of the way
    for (const c of this.carts) {
      const last = c.dirs.length - 1;
      if (c.lod > q || this.pCart.full) continue;
      const span = 2 * last;
      let u = (c.off + c.sp * life) % span;
      const back = u > last;
      if (back) u = span - u;
      const i = Math.min(last - 1, Math.floor(u)), f = u - i;
      const a = c.dirs[i]!, b = c.dirs[i + 1]!;
      _p.copy(a).lerp(b, f).normalize();
      if (_p.dot(cam) < cosT) continue;
      _h.subVectors(b, a);
      if (back) _h.negate();
      _s.crossVectors(_h, _p).normalize();
      const r = c.rad[i]! + (c.rad[i + 1]! - c.rad[i]!) * smoothstep(0.36, 0.64, f);
      _p.addScaledVector(_s, c.side).normalize().multiplyScalar(r + 0.0007);
      this.pCart.push(standMatrix(_m, _p, _h, c.size * vis), c.col);
      seen++;
    }

    // farmers, herds and townsfolk: small boxes wandering about a spot
    if (fine > 0) {
      for (const p of this.walkers) {
        if (p.lod > q || p.n.dot(cam) < cosT || this.pDot.full) continue;
        const u = p.sp * life + p.ph, v = p.sp * 0.77 * life + p.ph * 1.9;
        this.at(p, p.cx + p.rad * Math.sin(u), p.cy + p.rad * Math.sin(v), 0.0008, _p); // clear of the town's paving
        _h.copy(p.t1).multiplyScalar(Math.cos(u)).addScaledVector(p.t2, 0.77 * Math.cos(v));
        const k = this.width[0]! * L.size.person * fine * vis;
        standMatrix(_m, _p, _h, 1);
        _m.scale(_s.set(p.sx * k, p.sy * k, p.sz * k));
        this.pDot.push(_m, p.col);
        seen++;
      }
    }

    // windmills: the tower stands, the sails turn with the wind
    for (const w of this.mills) {
      if (w.lod > q || w.n.dot(cam) < cosT || this.pMill.full) continue;
      this.at(w, w.cx, w.cy, 0, _p);
      _h.copy(w.t1).multiplyScalar(Math.cos(w.turn)).addScaledVector(w.t2, Math.sin(w.turn));
      const size = w.size * vis;
      standMatrix(_m, _p, _h, size);
      this.pMill.push(_m, _c.setRGB(1, 1, 1));
      _m.multiply(_r.makeTranslation(0, 0.92, 0.3)).multiply(_r.makeRotationZ(drift * 0.9 + w.ph));
      this.pBlade.push(_m, _c);
      seen++;
    }

    // smoke: a few puffs per chimney, rising, swelling and thinning, leaning with the wind
    for (const s of this.chimneys) {
      if (s.lod > q || s.n.dot(cam) < cosT) continue;
      _c.copy(s.col).multiplyScalar(day(s.n));
      for (let j = 0; j < s.puffs && !this.pSmoke.full; j++) {
        const age = (drift * 0.16 + s.ph + j / s.puffs) % 1;
        const lean = age * age * s.size * 5;
        this.at(s, s.cx + lean, s.cy + lean * 0.4, s.up + age * s.size * 7, _p);
        const k = s.size * (0.5 + 1.5 * age) * (1 - smoothstep(0.62, 1, age)) * Math.min(1, age * 8) * vis;
        _m.makeScale(k, k, k).setPosition(_p);
        this.pSmoke.push(_m, _c);
      }
      seen++;
    }

    // birds: each flock wheels about its spot, wings beating
    for (const f of this.flocks) {
      if (f.lod > q || f.n.dot(cam) < cosT) continue;
      _c.copy(f.col).multiplyScalar(day(f.n));
      for (let k = 0; k < f.n8 && !this.pBird.full; k++) {
        const ang = f.sp * life + f.ph + k * (0.45 + 0.3 * Math.sin(k * 2.1 + f.ph));
        const R = f.R * (0.75 + 0.3 * Math.sin(k * 1.7 + f.ph * 3) + 0.1 * Math.sin(life * 0.3 + k));
        const ca = Math.cos(ang), sa = Math.sin(ang);
        this.at(f, R * ca, R * sa, f.alt * (1 + 0.25 * Math.sin(life * 0.4 + k * 1.3)), _p);
        _h.copy(f.t1).multiplyScalar(-sa).addScaledVector(f.t2, ca);
        if (f.sp < 0) _h.negate();
        const flap = Math.sin(life * 9 + k * 2.4 + f.ph * 9);
        // a bird that wheels right past a low camera would fill the view as a dark shard: it shrinks away
        const nearCam = THREE.MathUtils.smoothstep(_p.distanceTo(camera.position), 0.035, 0.13);
        if (nearCam <= 0) continue;
        standMatrix(_m, _p, _h, f.size * vis * nearCam, -0.35 * Math.sign(f.sp));
        _m.scale(_s.set(0.72 + 0.28 * flap, 1 + 1.5 * flap, 1));
        this.pBird.push(_m, _c);
      }
      seen++;
    }

    // surf: a pale streak rolls in to every shore, brightest as it breaks
    if (!this.reduced) {
      for (const s of this.surf) {
        if (s.lod > q || s.n.dot(cam) < cosT || this.pSurf.full) continue;
        const cyc = (drift * 0.17 + s.ph) % 1;
        const a = Math.sin(Math.PI * Math.min(1, cyc * 1.25)) * 0.34 * vis;
        if (a < 0.02) continue;
        _p.copy(s.pos).addScaledVector(s.shore, -s.reach * (1 - cyc));
        standMatrix(_m, _p, s.shore, 1);
        _m.scale(_s.set(s.len * (0.6 + 0.4 * cyc), 1, s.reach * (0.5 + 0.5 * cyc)));
        this.pSurf.push(_m, _c.copy(this.foam).multiplyScalar(a * day(s.n)));
        seen++;
      }
    }

    let drawn = 0;
    for (const p of this.pools) { drawn += p.n; p.end(); }
    this.winMat.uniforms.uTime!.value = drift;
    this.winMat.uniforms.uVis!.value = vis;
    this.winMat.uniforms.uPx!.value = viewPx;
    this.stats.drawn = drawn;
    this.stats.visible = seen;

    // frame budget: shed detail when the layer costs too much, win it back when there is room
    const ms = performance.now() - t0;
    this.stats.ms += (ms - this.stats.ms) * 0.05;
    if (this.stats.ms > L.budgetMs) { this.over++; this.under = 0; } else if (this.stats.ms < L.budgetMs * 0.45) { this.under++; this.over = 0; } else { this.over = 0; this.under = 0; }
    if (this.over > 45 && q > L.quality[L.quality.length - 1]!) { this.stats.quality = L.quality[L.quality.indexOf(q) + 1] ?? q; this.over = 0; }
    if (this.under > 600 && q < 1) { this.stats.quality = L.quality[Math.max(0, L.quality.indexOf(q) - 1)] ?? 1; this.under = 0; }
  }

  dispose(): void {
    for (const p of this.pools) { this.group.remove(p.mesh); p.dispose(); }
    if (this.windows) { this.group.remove(this.windows); this.windows.geometry.dispose(); }
    this.winMat.dispose();
  }
}
