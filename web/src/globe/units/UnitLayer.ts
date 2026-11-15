// The war layer, kept out of React: army counters that march, arrows, battles, smoke, front
// lines, war pulses, treaty flashes and falls. Units come from world.units (the truth); events
// only start effects. Up close each counter stands on a 3D model of its nation's technology age,
// and trader ships sail the oceans (traders.ts). Lane b (B5, #122).
import * as THREE from 'three';
import { ageIndex, flagSvg } from '@terra/shared';
import type { TechAge, Unit, UnitKind, World, WorldEvent } from '@terra/shared';
import type { MeshEdge, ProvinceMesh } from '../mesh/buildProvinceMesh';
import { getPalette } from '../palette';
import { COUNTER_H, COUNTER_W, drawAttrition, drawClash, drawCounter, drawLoss, drawScroll, drawSettler, drawShield, drawStatus, toTexture } from './draw';
import { warLineOf } from '../../state/armyInfo';
import type { WarTone } from '../../state/armyInfo';
import { BATTLE_GAP, useBattles } from '../../state/battleInfo';
import { STACK, clearStackLifts, setStackLift, stackSlot } from '../status/cityStack';
import { terrainEffects } from '../terrain/effects';
import { unitIcon } from './era';
import { ModelField, poseMatrix, standMatrix } from './ModelField';
import { FALL_MS, GAIT_RAMP_MS, RISE_MS, ROUT_MS, STEPS_FAST, STEPS_SLOW, gaitOf, gaitPose, hullPose, phaseOf, reducedMotion } from './motion';
import { VehicleFx } from './vehicleFx';
import { Traders } from './traders';
import { clockNow, msPerYear } from '../../state/calendar';
import { UnitModels } from './unitModels';
import { RestSpots } from './restSpots';
import { TerrainLookup, groundView } from '../camera/groundView';
import { groundSight, horizonSight } from '../status/sight';
import { formationSlots } from './formation';
import type { Slot } from './formation';
import { ROLE_BACK, ROLE_FLANK, ROLE_FRONT, firingFeed } from '../war/firingFeed';
import { Pops, Smoke, Sparks, facing, tangentJitter } from './effects';
import type { Pop } from './effects';
import { arcHump, arcPoint, arrowGeometry, arrowMaterial, lineGeometry, lineMaterial, tileFanGeometry, writeArrow } from './ribbons';

import { DISSOLVE_MS, DWELL_MS, dissolveAlpha, speedCap, tooFast, viewHeight } from './speed';

const MOVE_MAX_MS = 160_000;    // the longest march: a three-year move at one week a second is 156 s
const CHIP_LIFT = 0.004;
const CHIP_H = 0.03;            // counter height, as a share of the view (sizeAttenuation off)
const SETTLER_H = 0.017;
const ARROW_POOL = 32;
const ARROW_LINGER = 900;       // ms an arrow stays after its march ends
const ARROW_FADE = 600;
const FRONT_EVERY = 500;        // front lines refresh at most 2x a second
const FRONT_FADE = 1400;
const STATUS_H = 0.017;         // war status line height, as a share of the view
const STATUS_EVERY = 400;       // the lines are re-read 2.5 times a second
const PULSE_MS = 1700;
const CEDE_MS = 2200;
const COLUMN_MS = 3000;
const MAX_COLUMNS = 12;
const TREATY_WINDOW = 4000;
const FALL_SHIELD = 6000;
const MODEL_NEAR = 2.0;         // models fully shown below this camera distance
const MODEL_FAR = 2.4;          // and gone above this (orbit shows counters only)
const FIGURE_K = 1.5;          // figures a little larger than their footprint, so a formation reads at mid zoom
const FORMATION_GAP = 0.6;     // figure spacing, as a share of the unit size
const FORMATION_W = 3.0;       // a formation's width, for stepping two on one tile apart
const FORMATION_R = 2.0;       // the furthest figure from a formation's middle, in figure spacings
const FIT_ROOM = 0.86;         // one formation fills this share of its tile's inner radius
const FIT_SPAN = 1.05;         // several on one tile: their middles spread over this share of the inner radius
const FIT_MIN = 0.42;          // figure spacing never closes up below this share of its open-ground value
const FIT_MS = 320;            // closing up, stepping aside and falling in ease over about this long
const AGE_POP_MS = 750;         // bounce when a nation reaches a new age
const SINK_MS = 2800;           // a fleet beaten at sea rolls over and goes under this slowly
const CLASH_MS = 2500;          // battle badge, smoke and loss numbers linger so a judge sees them
const BATTLE_SMOKE_MS = 3000;
const LOSS_MS = 2000;
// Screen-space declutter: same-nation counters whose anchors fall within MERGE_PX show as one
// counter with the summed strength; other overlapping counters are lifted one slot at a time.
const MERGE_PX = 24;
const DECLUTTER_MS = 150;
const SIGHT_MS = 160;           // a counter going behind a hill or the horizon fades over about this long
const MAX_LIFT = 4;

function tok(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const pairKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

interface UState {
  id: string; owner: number; kind: UnitKind; strength: number;
  from: number; to: number; t0: number; t1: number; years: number;
  hopAt: number;
  flickAt?: number;
  arrow: Arrow | null;
  head: THREE.Vector3;          // march direction (world space), kept after the march ends
  face: THREE.Vector3;          // where the model points: turns towards `head` smoothly
  /** The move is too fast to watch at this game speed: fade out at `from`, fade in at `to`. */
  dissolve: boolean;
  ghost: THREE.Vector3 | null;  // a glide cut short by a speed change fades out from here
  landAt: number;               // when the last dissolve finished (the unit rests a moment before the next)
  inAt: number;                 // when it last began to fade in
  // lifelike motion (motion.ts): all of it is drawn over the march, none of it moves the unit
  seed: number;                 // this unit's own phase, so no two step together
  stride: number;               // march phase in radians (pi a step), run on by its speed
  amp: number;                  // how much it is marching: eases 0..1 as a march starts and back as it ends
  surge: number;                // +1 setting off, 0 at full stride, -1 pulling up
  routAt: number;               // when it last lost a battle: it flinches, or hurries away with loose ranks
  /** Where each of the seven formation places stands now: x, z, presence 0..1, wanted (see formOf). */
  form: Float32Array | null;
  formAt: number;
}

interface Chip {
  key: string; owner: number; kind: UnitKind; tile: number;
  units: UState[]; moving: UState | null;
  sprite: THREE.Sprite; mat: THREE.SpriteMaterial; texKey: string; aspect: number; height: number;
  stack: number;
  pos: THREE.Vector3;
  dying: { start: number; shatter: boolean } | null;
  /** Hidden this frame because a nearby counter of the same nation shows its strength. */
  absorbed: boolean;
  sight: number;          // 0..1: how clearly the camera sees its spot (0 behind the horizon, a hill or a town)
  sightGoal: number;      // what `sight` eases towards, re-read a few times a second
  stackN: number;         // how many army and fleet counters rest on its tile (itself included)
  fitAt: number;          // when its place in the tile was last eased (0 = never)
  fitK: number;           // figure spacing, as a share of the open-ground spacing (the formation fits the tile)
  fitOff: number;         // how far along the tile's axis its model stands from the resting spot (world units)
  fitS: number;           // model size on a shared tile, as a share of its size alone (three or more stand a little smaller)
  fitIn: number;          // 0..1: how firmly its figures are held inside the tile's outline (0 on the march)
  /** Screen slot from the declutter pass (replaces the per-tile stack while set). */
  lift: number | null;
  /** The merged texture this counter holds (summed strength), '' when it shows its own. */
  mergeKey: string;
  /** The war status line over the counter (only while at war). */
  stat: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; key: string; aspect: number } | null;
  statText: string; statTone: WarTone;
  /** The order line gives way this pass: its box would cross another counter, a battle plate or another line. */
  statHide: boolean;
}

/** A label's box on screen, in px (y grows downwards). */
interface Box { x0: number; y0: number; x1: number; y1: number }
const boxesHit = (a: Box, b: Box, pad = 2): boolean => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;
/** A battle plate climbs at most this far (px) to clear the counters under it. */
const PLATE_LIFT_MAX = 110;
/** A loss number slides at most this far (px) sideways to find room, else it is not shown. */
const POP_REACH = 150;

interface Arrow {
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial; geo: THREE.BufferGeometry;
  busy: boolean; born: number; holdUntil: number; toTile: number; attack: boolean;
}

interface Front { a: number; b: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; sig: string; fadeStart: number }
interface Flash { mesh: THREE.Mesh; mat: THREE.Material; born: number; life: number; kind: 'pulse' | 'cede' }
interface Column { pos: THREE.Vector3; n: THREE.Vector3; until: number; nextAt: number }

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _j = new THREE.Vector3(), _camDir = new THREE.Vector3(), _mainDir = new THREE.Vector3();
/** The news picture-in-picture draws models only this close to its camera (cosine of the angle at the centre, about 25 degrees). */
const PIP_REACH = 0.9;
const _aim = new THREE.Vector3(), _n = new THREE.Vector3(), _side = new THREE.Vector3(), _mm = new THREE.Matrix4();
const _p = new THREE.Vector3(), _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _fm = new THREE.Matrix4();
const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export class UnitLayer {
  readonly group = new THREE.Group();
  private readonly mesh: ProvinceMesh;
  private readonly world: World;
  private readonly dirs: THREE.Vector3[];
  private readonly pal = getPalette();
  private readonly col: Record<'war' | 'ink' | 'parchment' | 'ruin' | 'smoke' | 'flash' | 'accent', THREE.Color>;
  private readonly tokens: { rubric: string; parchmentDark: string; warm: string };

  private readonly states = new Map<string, UState>();
  private readonly pendingMoves = new Map<string, Extract<WorldEvent, { type: 'unit_moved' }>>();
  private readonly removedReason = new Map<string, string>();
  private readonly chips = new Map<string, Chip>();
  private statusAt = -1e9;
  /** Screen boxes of the counters, battle plates and order lines from the last layout pass (layoutFurniture). */
  private boxes: Box[] = [];
  private cam: THREE.Camera | null = null;
  private viewW = 1280;
  private viewPx = 800;
  private readonly unitById = new Map<string, Unit>();
  private readonly dying: Chip[] = [];
  private readonly texCache = new Map<string, { tex: THREE.CanvasTexture; users: number }>();
  private readonly flags = new Map<number, { img: HTMLImageElement; ready: boolean }>();
  private readonly fallen = new Map<number, number>();
  private readonly treaty = new Map<string, number>();
  private readonly gains = new Map<string, number>(); // net provinces taken by the lower id from the higher
  private readonly fronts = new Map<string, Front>();
  private readonly flashes: Flash[] = [];
  private readonly columns: Column[] = [];
  private readonly arrows: Arrow[] = [];
  private readonly sparks = new Sparks();
  private readonly smoke = new Smoke();
  private readonly pops = new Pops();
  private readonly arrowGroup = new THREE.Group();
  private readonly frontGroup = new THREE.Group();
  private readonly chipGroup = new THREE.Group();
  private readonly clashTex: THREE.CanvasTexture;
  private readonly scrollTex: THREE.CanvasTexture;
  private readonly lossTex = new Map<string, THREE.CanvasTexture>();
  private readonly attTex = new Map<string, THREE.CanvasTexture>();
  private readonly shieldTex = new Map<string, THREE.CanvasTexture>();

  private readonly models = new UnitModels();
  private readonly field = new ModelField();
  private readonly fx = new VehicleFx();
  private readonly traders: Traders;
  private readonly unitSize: number;
  private readonly spots: RestSpots;
  private readonly ageSeen = new Map<number, TechAge>(); // from country_updated, until world.countries catches up
  private readonly agePop = new Map<number, number>();
  private readonly knownAge = new Map<number, TechAge>(); // last age we drew, to spot a real change
  private readonly teamCol = new Map<number, THREE.Color>();
  private near = 0;
  /** True while the models are drawn for the news picture-in-picture: no exhaust or dust from those. */
  private pipFill = false;

  private dirty = true;
  private lastFront = -1e9;
  private lastNow = 0;
  private declutterAt = -1e9;
  private lastDt = 16;
  private readonly terrain: TerrainLookup;
  private clockMs = msPerYear();   // real ms a year took at the last frame
  private viewH = 1.2;             // height of the view at the planet's surface, in globe units
  private lastClockAt = 0;
  private disposed = false;

  constructor(mesh: ProvinceMesh, world: World) {
    this.mesh = mesh;
    this.world = world;
    this.dirs = world.tiles.map((t) => new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize());
    const p = this.pal;
    this.tokens = {
      rubric: tok('--color-rubric', '#9c2f22'),
      parchmentDark: tok('--color-parchment-dark', '#d6c399'),
      warm: tok('--holo-warm', '#ffcf7a'),
    };
    this.col = {
      war: new THREE.Color(p.stance.war),
      ink: new THREE.Color(p.ink),
      parchment: new THREE.Color(p.parchment),
      ruin: new THREE.Color(p.ruin).lerp(new THREE.Color(p.parchment), 0.25),
      smoke: new THREE.Color(p.ruin).lerp(new THREE.Color(p.ink), 0.45),
      flash: new THREE.Color(this.tokens.warm),
      accent: new THREE.Color(p.accent),
    };
    this.clashTex = toTexture(drawClash(p.stance.war, p.parchment, p.accent, p.ink));
    this.scrollTex = toTexture(drawScroll(p.parchment, this.tokens.parchmentDark, p.ink, this.tokens.rubric));
    for (let i = 0; i < ARROW_POOL; i++) {
      const geo = arrowGeometry();
      const mat = arrowMaterial();
      mat.uniforms.uInk!.value.copy(this.col.ink);
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 20;
      this.arrowGroup.add(m);
      this.arrows.push({ mesh: m, mat, geo, busy: false, born: 0, holdUntil: 0, toTile: -1, attack: false });
    }
    // about a town building: half a tile across, capped so nothing towers over a mountain
    this.unitSize = Math.min(0.04, Math.max(0.01, Math.sqrt((4 * Math.PI) / Math.max(1, world.tiles.length)) * 0.42));
    this.spots = new RestSpots(world, mesh.heights, this.dirs, this.unitSize * 0.6);
    this.terrain = new TerrainLookup(world);
    world.countries.forEach((c, i) => this.knownAge.set(i, c.techAge ?? 'ancient'));
    this.traders = new Traders({
      dirs: this.dirs,
      fx: this.fx,
      heights: mesh.heights,
      msPerTick: () => this.msPerTick(),
      tooFast: (from, to, ms) => this.fast('trader', from, to, ms),
      model: (owner) => this.models.resolve(this.ageFor(owner), 'trader'),
      team: (owner) => this.team(owner),
      pop: (owner, now) => this.popScale(owner, now),
      sky: (owner) => ageIndex(this.ageFor(owner)) >= 6,
    }, p.parchment, this.unitSize * 0.8);
    this.group.add(this.frontGroup, this.arrowGroup, this.field.group, this.fx.group, this.traders.group, this.smoke.group, this.sparks.points, this.chipGroup, this.pops.group);
    this.group.name = 'units';
  }

  // ---------- helpers ----------

  private surf(tile: number, extra: number, out: THREE.Vector3): THREE.Vector3 {
    const d = this.dirs[tile];
    if (!d) return out.set(0, 0, 0);
    return out.copy(d).multiplyScalar((this.mesh.heights[tile] ?? 1) + extra);
  }

  /** Where a unit stands on a tile: its free spot (restSpots.ts), clear of the buildings there. */
  private rest(tile: number, out: THREE.Vector3): THREE.Vector3 {
    const d = this.spots.dir(tile);
    if (!d) return out.set(0, 0, 0);
    return out.copy(d).multiplyScalar((this.mesh.heights[tile] ?? 1) + CHIP_LIFT);
  }

  /** Real time one year takes at the effective speed (12 s at one month a second, 52 s at one week a second). */
  private msPerTick(): number {
    return msPerYear();
  }

  /** Keeps the marches in step with the world clock: they wait while it is paused, and stretch or
   *  shrink what is left of them when the speed changes, so a unit never jumps or runs ahead. */
  private followClock(now: number, dt: number): void {
    const { paused } = clockNow();
    const ms = msPerYear();
    const k = paused ? 0 : ms / this.clockMs;
    this.clockMs = ms;
    if (!paused && Math.abs(k - 1) < 1e-6) return;
    for (const st of this.states.values()) {
      if (now >= st.t1 || st.from === st.to) continue;
      if (paused) { st.t0 += dt; st.t1 += dt; }
      else if (st.dissolve) continue; // a dissolve runs in real time
      else {
        const p = (now - st.t0) / (st.t1 - st.t0), total = Math.min(MOVE_MAX_MS, Math.max(300, st.years * ms));
        if (this.fast(st.kind, st.from, st.to, total)) {
          // the new speed would make this glide a streak: fade out where it is, fade in at the end
          st.ghost = this.statePos(st, now, new THREE.Vector3());
          st.dissolve = true;
          st.t0 = now; st.t1 = now + DISSOLVE_MS;
          if (st.arrow) { st.arrow.holdUntil = now; st.arrow = null; }
          continue;
        }
        st.t0 = now - p * total; st.t1 = st.t0 + total;
      }
      if (st.arrow) st.arrow.holdUntil = st.t1 + ARROW_LINGER;
    }
    this.traders.retime(now, paused ? dt : 0, paused ? 1 : k, ms);
  }

  private colorOf(owner: number): string {
    return this.world.countries[owner]?.color ?? this.pal.ruin;
  }

  /** Where a unit is drawn right now (mid-march units are on the arc). */
  private statePos(st: UState, now: number, out: THREE.Vector3): THREE.Vector3 {
    if (now >= st.t1 || st.from === st.to || !this.dirs[st.from] || !this.dirs[st.to]) return this.rest(st.to, out);
    if (st.dissolve) {
      if (now - st.t0 >= (st.t1 - st.t0) / 2) return this.rest(st.to, out);
      return st.ghost ? out.copy(st.ghost) : this.rest(st.from, out);
    }
    const s = easeInOut(Math.max(0, (now - st.t0) / (st.t1 - st.t0)));
    const a = this.spots.dir(st.from)!, b = this.spots.dir(st.to)!;
    return arcPoint(out, a, b, this.mesh.heights[st.from]! + CHIP_LIFT, this.mesh.heights[st.to]! + CHIP_LIFT, s, arcHump(a, b) * 0.6);
  }

  /** The nation's technology age, or undefined when the world gives none. */
  private ageOf(owner: number): TechAge | undefined {
    const c = this.world.countries[owner]?.techAge;
    const seen = this.ageSeen.get(owner);
    if (seen && c === seen) this.ageSeen.delete(owner);
    return seen ?? c;
  }

  private ageFor(owner: number): TechAge {
    return this.ageOf(owner) ?? 'ancient';
  }

  private team(owner: number): THREE.Color {
    let c = this.teamCol.get(owner);
    if (!c) { c = new THREE.Color(this.colorOf(owner)); this.teamCol.set(owner, c); }
    return c;
  }

  /** Scale bounce after an age change: 1 when none. */
  private popScale(owner: number, now: number): number {
    const t0 = this.agePop.get(owner);
    if (t0 == null) return 1;
    const t = (now - t0) / AGE_POP_MS;
    if (t >= 1 || t < 0) { if (t >= 1) this.agePop.delete(owner); return 1; }
    return 1 + 0.55 * Math.sin(Math.PI * t) * (1 - 0.5 * t);
  }

  private flag(owner: number): HTMLImageElement | null {
    let f = this.flags.get(owner);
    if (!f) {
      const c = this.world.countries[owner];
      if (!c?.flag) return null;
      const img = new Image();
      const entry = { img, ready: false };
      f = entry;
      img.onload = () => { entry.ready = true; if (!this.disposed) this.dirty = true; };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(flagSvg(c.flag, 90, 60))}`;
      this.flags.set(owner, f);
    }
    return f.ready ? f.img : null;
  }

  private acquire(key: string, draw: () => HTMLCanvasElement): THREE.CanvasTexture {
    let e = this.texCache.get(key);
    if (!e) { e = { tex: toTexture(draw()), users: 0 }; this.texCache.set(key, e); }
    e.users++;
    return e.tex;
  }

  private release(key: string): void {
    const e = this.texCache.get(key);
    if (!e) return;
    if (--e.users <= 0) { e.tex.dispose(); this.texCache.delete(key); }
  }

  // ---------- units ----------

  /** Would this move cross the screen faster than its kind may go? Then it is not animated. */
  private fast(kind: UnitKind, from: number, to: number, ms: number): boolean {
    const a = this.dirs[from], b = this.dirs[to];
    if (!a || !b || from === to) return false;
    return tooFast(kind, a.angleTo(b), ms, this.viewH);
  }

  /** 1 while a unit shows, dipping to 0 and back while it dissolves between two tiles. */
  private alphaOf(st: UState, now: number): number {
    if (!st.dissolve) return 1;
    const moving = now < st.t1 && st.from !== st.to;
    return dissolveAlpha(now, moving ? st.t0 : Infinity, moving ? st.t1 : Infinity, st.inAt);
  }

  private startMove(st: UState, from: number, to: number, ms: number, now: number): void {
    const dur = Math.min(MOVE_MAX_MS, Math.max(300, ms));
    const underWay = now < st.t1 && st.from !== st.to;
    // a unit already dissolving, or one drawn somewhere other than where this move starts, cannot
    // glide from there without a jump: it hops with a dissolve as well
    const mustHop = from !== to && ((st.dissolve && underWay) || (!underWay && st.t1 > 0 && st.to !== from));
    if (mustHop || this.fast(st.kind, from, to, dur)) {
      st.years = ms / this.msPerTick();
      if (st.arrow) { st.arrow.holdUntil = Math.min(st.arrow.holdUntil, now); st.arrow = null; }
      // still waiting or fading out: only change where it comes back
      if (st.dissolve && now < (st.t0 + st.t1) / 2) { if (st.to !== to) { st.to = to; this.dirty = true; } return; }
      if (st.dissolve && underWay) {
        // fading in at the last tile: finish that, rest a moment, then go again from there
        st.inAt = (st.t0 + st.t1) / 2; st.landAt = st.t1; st.from = st.to; st.ghost = null;
      } else {
        st.ghost = underWay ? this.statePos(st, now, new THREE.Vector3()) : null; // a glide cut short fades from where it is
        st.from = st.to; // where it stands now, whatever tile the event names: no jump before the fade
      }
      st.to = to;
      st.dissolve = true;
      st.t0 = Math.max(now, st.landAt + DWELL_MS);
      st.t1 = st.t0 + DISSOLVE_MS;
      this.dirty = true;
      return;
    }
    st.dissolve = false;
    st.ghost = null;
    st.from = from;
    st.to = to;
    st.years = ms / this.msPerTick();
    st.t0 = now;
    st.t1 = now + dur;
    const da = this.dirs[from], db = this.dirs[to];
    if (from !== to && da && db) st.head.subVectors(db, da);
    if (from !== to && st.kind !== 'settler') {
      const arrow = this.takeArrow(now);
      const a = this.dirs[from], b = this.dirs[to];
      if (arrow && a && b) {
        const om = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
        const width = Math.min(0.016, Math.max(0.0065, om * 0.2));
        writeArrow(arrow.geo, a, this.mesh.heights[from]! + 0.003, b, this.mesh.heights[to]! + 0.003, width);
        const c = this.colorOf(st.owner);
        arrow.mat.uniforms.uColor!.value.set(c);
        arrow.mat.uniforms.uLight!.value.set(c).lerp(this.col.parchment, 0.6);
        arrow.mat.uniforms.uSpeed!.value = 2.5;
        arrow.toTile = to;
        arrow.attack = false;
        arrow.holdUntil = st.t1 + ARROW_LINGER;
        st.arrow = arrow;
      }
    }
    this.dirty = true;
  }

  /** Read world.units and bring the counters in line. Called on every world version. */
  sync(): void {
    if (this.disposed) return;
    const now = performance.now();
    const seen = new Set<string>();
    this.spots.sync();
    this.traders.sync(this.world.units, now);
    for (const u of this.world.units) {
      if (u.kind === 'trader') continue;
      seen.add(u.id);
      let st = this.states.get(u.id);
      if (!st) {
        st = { id: u.id, owner: u.owner, kind: u.kind, strength: u.strength, from: u.tile, to: u.tile, t0: 0, t1: 0, years: 1, hopAt: -1e9, arrow: null, head: new THREE.Vector3(), face: new THREE.Vector3(), dissolve: false, ghost: null, landAt: -1e9, inAt: -1e9, seed: phaseOf(u.id), stride: 0, amp: 0, surge: 0, routAt: -1e9, form: null, formAt: 0 };
        this.states.set(u.id, st);
        const pm = this.pendingMoves.get(u.id);
        if (pm && pm.to === u.tile) this.startMove(st, pm.from, pm.to, (pm.arriveTick - pm.tick) * this.msPerTick(), now);
        this.dirty = true;
      } else if (st.to !== u.tile) {
        // moved without an event we saw: march from where it stood
        this.startMove(st, st.to, u.tile, 2 * this.msPerTick(), now);
      }
      if (st.owner !== u.owner || st.strength !== u.strength || st.kind !== u.kind) this.dirty = true;
      st.owner = u.owner;
      st.kind = u.kind;
      st.strength = u.strength;
    }
    for (const id of [...this.states.keys()]) if (!seen.has(id)) { this.states.delete(id); this.dirty = true; }
    this.pendingMoves.clear();
  }

  private rebuildChips(now: number): void {
    this.dirty = false;
    const era = this.world.era ?? '';
    const groups = new Map<string, { owner: number; kind: UnitKind; tile: number; units: UState[]; moving: UState | null }>();
    for (const st of this.states.values()) {
      const until = this.fallen.get(st.owner);
      if (until != null && until > now) continue;
      const moving = now < st.t1 && st.from !== st.to;
      const key = moving ? `m:${st.id}` : `g:${st.to}:${st.owner}:${st.kind}`;
      let g = groups.get(key);
      if (!g) { g = { owner: st.owner, kind: st.kind, tile: st.to, units: [], moving: moving ? st : null }; groups.set(key, g); }
      g.units.push(st);
    }
    // stack order among the resting counters on one tile
    const perTile = new Map<number, string[]>();
    for (const [key, g] of groups) {
      if (g.moving) continue;
      const list = perTile.get(g.tile) ?? [];
      list.push(key);
      perTile.set(g.tile, list);
    }
    const stackOf = new Map<string, number>();
    const stackN = new Map<string, number>();
    for (const list of perTile.values()) {
      list.sort();
      // settlers sit below armies; count only armies and fleets in the stack
      let k = 0;
      for (const key of list) stackOf.set(key, groups.get(key)!.kind === 'settler' ? -1 : k++);
      for (const key of list) stackN.set(key, k);
    }

    for (const [key, g] of groups) {
      let chip = this.chips.get(key);
      if (!chip) {
        const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, toneMapped: false });
        const sprite = new THREE.Sprite(mat);
        sprite.renderOrder = 30;
        this.chipGroup.add(sprite);
        chip = {
          key, owner: g.owner, kind: g.kind, tile: g.tile, units: g.units, moving: g.moving,
          sprite, mat, texKey: '', aspect: 1, height: CHIP_H, stack: 0, pos: new THREE.Vector3(), dying: null,
          absorbed: false, sight: 1, sightGoal: 1, stackN: 1, fitAt: 0, fitK: 1, fitOff: 0, fitS: 1, fitIn: 0, lift: null, mergeKey: '', stat: null, statText: '', statTone: 'attack', statHide: false,
        };
        this.chips.set(key, chip);
      }
      chip.units = g.units;
      chip.moving = g.moving;
      chip.stack = stackOf.get(key) ?? 0;
      chip.stackN = stackN.get(key) ?? 1;
      const color = this.colorOf(g.owner);
      const flag = g.kind === 'settler' ? null : this.flag(g.owner);
      const strength = g.units.reduce((s, u) => s + u.strength, 0);
      const texKey = g.kind === 'settler'
        ? `s|${color}`
        : `c|${g.owner}|${color}|${unitIcon(g.kind, era, this.ageOf(g.owner))}|${Math.round(strength)}|${g.units.length}|${flag ? 1 : 0}`;
      if (texKey !== chip.texKey) {
        this.unmerge(chip);
        const p = this.pal;
        const tex = g.kind === 'settler'
          ? this.acquire(texKey, () => drawSettler(color, p.ink, p.parchment))
          : this.acquire(texKey, () => drawCounter({
            color, flag, icon: unitIcon(g.kind, era, this.ageOf(g.owner)), strength, count: g.units.length,
            night: p.night, ink: p.ink, parchment: p.parchment, accent: p.accent,
          }));
        if (chip.texKey) this.release(chip.texKey);
        chip.texKey = texKey;
        chip.mat.map = tex;
        chip.mat.needsUpdate = true;
        chip.aspect = g.kind === 'settler' ? 1 : COUNTER_W / COUNTER_H;
        chip.height = g.kind === 'settler' ? SETTLER_H : CHIP_H;
      }
    }
    // drop after the new counters took their textures, so a shared texture is not redrawn
    for (const [key, chip] of this.chips) {
      if (groups.has(key)) continue;
      this.chips.delete(key);
      const lost = chip.units.some((u) => !this.states.has(u.id));
      if (!lost) { this.dropChip(chip); continue; }
      const shatter = chip.units.some((u) => {
        const r = this.removedReason.get(u.id);
        return r === 'collapse' || r === 'battle';
      });
      this.killChip(chip, now, shatter);
    }

    for (const id of [...this.removedReason.keys()]) if (!this.states.has(id)) this.removedReason.delete(id);
    this.declutterAt = -1e9;
  }

  private counterKey(owner: number, kind: UnitKind, strength: number, count: number): string {
    const era = this.world.era ?? '';
    return `c|${owner}|${this.colorOf(owner)}|${unitIcon(kind, era, this.ageOf(owner))}|${Math.round(strength)}|${count}|${this.flag(owner) ? 1 : 0}`;
  }

  private drawCounterTex(key: string, owner: number, kind: UnitKind, strength: number, count: number): THREE.CanvasTexture {
    const p = this.pal;
    const era = this.world.era ?? '';
    return this.acquire(key, () => drawCounter({
      color: this.colorOf(owner), flag: this.flag(owner), icon: unitIcon(kind, era, this.ageOf(owner)), strength, count,
      night: p.night, ink: p.ink, parchment: p.parchment, accent: p.accent,
    }));
  }

  /** Back to its own texture and no screen slot. */
  private unmerge(chip: Chip): void {
    chip.absorbed = false;
    if (!chip.mergeKey) return;
    const own = this.texCache.get(chip.texKey)?.tex ?? null;
    if (own && chip.mat.map !== own) { chip.mat.map = own; chip.mat.needsUpdate = true; }
    this.release(chip.mergeKey);
    chip.mergeKey = '';
  }

  /**
   * Cheap screen-space declutter of the resting army and fleet counters. Greedy, strongest first:
   * a counter of the same nation and kind whose anchor is within MERGE_PX is folded into the
   * leader, which then shows the summed strength and unit count; any other counter whose box
   * overlaps one already placed is lifted a slot. Runs a few times a second, not every frame.
   */
  private declutter(camera: THREE.Camera, viewW: number, viewH: number, now: number): void {
    const p11 = (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] ?? 1;
    const items: { chip: Chip; x: number; y: number; w: number; h: number; str: number }[] = [];
    for (const chip of this.chips.values()) {
      chip.lift = null;
      if (chip.kind === 'settler' || chip.moving || !chip.units.length || facing(chip.pos, _camDir) <= 0 || chip.sightGoal <= 0) { this.unmerge(chip); continue; }
      _v.copy(chip.pos).project(camera);
      if (_v.z > 1) { this.unmerge(chip); continue; }
      const hPx = chip.sprite.scale.y * p11 * viewH / 2;
      const x = (_v.x + 1) * viewW / 2;
      const y = (1 - _v.y) * viewH / 2;
      items.push({ chip, x, y, w: hPx * chip.aspect, h: hPx, str: chip.units.reduce((s, u) => s + u.strength, 0) });
    }
    items.sort((a, b) => b.str - a.str || (a.chip.key < b.chip.key ? -1 : 1));
    const leaders: { chip: Chip; x: number; y: number; w: number; h: number; str: number; count: number; members: number }[] = [];
    for (const it of items) {
      const lead = leaders.find((l) => l.chip.owner === it.chip.owner && l.chip.kind === it.chip.kind && Math.hypot(l.x - it.x, l.y - it.y) < MERGE_PX);
      if (lead) {
        lead.str += it.str;
        lead.count += it.chip.units.length;
        lead.members++;
        this.unmerge(it.chip);
        it.chip.absorbed = true;
        continue;
      }
      it.chip.absorbed = false;
      leaders.push({ ...it, count: it.chip.units.length, members: 1 });
    }
    // lift overlapping boxes, lowest on screen first so the stack grows upwards
    leaders.sort((a, b) => b.y - a.y || (a.chip.key < b.chip.key ? -1 : 1));
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const l of leaders) {
      let slot = 0;
      while (slot < MAX_LIFT && placed.some((q) => Math.abs(q.x - l.x) < (q.w + l.w) * 0.45 && Math.abs(q.y - (l.y - slot * l.h * 0.92)) < (q.h + l.h) * 0.45)) slot++;
      placed.push({ x: l.x, y: l.y - slot * l.h * 0.92, w: l.w, h: l.h });
      l.chip.lift = slot;
      if (l.members > 1) {
        const key = this.counterKey(l.chip.owner, l.chip.kind, l.str, l.count);
        if (key !== l.chip.mergeKey) {
          const tex = this.drawCounterTex(key, l.chip.owner, l.chip.kind, l.str, l.count);
          if (l.chip.mergeKey) this.release(l.chip.mergeKey);
          l.chip.mergeKey = key;
          l.chip.mat.map = tex;
          l.chip.mat.needsUpdate = true;
        }
      } else this.unmerge(l.chip);
    }
    this.declutterAt = now;
  }

  /**
   * One layout rule for the labels of a fight, so none sits on another. Counters come first and never move
   * here (declutter placed them). Each tile is one column in a fixed order: counter, its order line, then the
   * battle plate, which climbs clear of every counter and of its own tile's order line. An order line gives
   * way (hides) when it would cross another counter, a plate of another tile or another line. The loss
   * numbers ask fitPop for room. Runs with declutter, a few times a second.
   */
  private layoutFurniture(camera: THREE.Camera, viewW: number, viewH: number, zoom: number, dist: number): void {
    const px = ((camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] ?? 1) * viewH / 2;
    const chipBoxes: Box[] = [];
    const lines: { chip: Chip; box: Box }[] = [];
    const linesOn = 1 - smooth(2.3, 3.1, dist) > 0.02;
    const hs = STATUS_H * zoom * px;
    for (const chip of this.chips.values()) {
      chip.statHide = false;
      if (!chip.sprite.visible || chip.mat.opacity <= 0.02) continue;
      _v.copy(chip.pos).project(camera);
      if (_v.z > 1) continue;
      const x = (_v.x + 1) * viewW / 2, y = (1 - _v.y) * viewH / 2;
      const h = chip.sprite.scale.y * px, w = h * chip.aspect;
      const y1 = y + chip.sprite.center.y * h;
      chipBoxes.push({ x0: x - w / 2, x1: x + w / 2, y0: y1 - h, y1 });
      if (chip.stat && linesOn) lines.push({ chip, box: { x0: x - hs * chip.stat.aspect / 2, x1: x + hs * chip.stat.aspect / 2, y0: y1 - h - 1.2 * hs, y1: y1 - h - 0.2 * hs } });
    }
    // an order line never covers a counter (its own sits just under it)
    const kept = lines.filter((l) => {
      const hit = chipBoxes.some((o) => boxesHit(l.box, o, 0));
      if (hit) l.chip.statHide = true;
      return !hit;
    });
    // battle plates, lowest on screen first
    clearStackLifts();
    const tick = this.world.tick;
    const plates: { tile: number; x: number; y: number; w: number; h: number; base: number }[] = [];
    for (const b of useBattles.getState().byTile.values()) {
      if (tick - b.lastTick > BATTLE_GAP) continue;
      const slot = stackSlot(b.tile, STACK.battle);
      if (!slot || this.surf(b.tile, 0.012, _v).lengthSq() === 0 || facing(_v, _camDir) <= 0) continue;
      _v.project(camera);
      if (_v.z > 1) continue;
      plates.push({ tile: b.tile, x: (_v.x + 1) * viewW / 2, y: (1 - _v.y) * viewH / 2 - slot.offset, w: slot.width, h: slot.height, base: slot.offset });
    }
    plates.sort((a, b) => b.y - a.y || a.tile - b.tile);
    const plateBoxes: { tile: number; box: Box }[] = [];
    for (const p of plates) {
      let lift = 0;
      const at = (): Box => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - lift - p.h, y1: p.y - lift });
      for (let i = 0; i < 6; i++) {
        const b = at();
        let top = Infinity;
        for (const o of chipBoxes) if (boxesHit(b, o)) top = Math.min(top, o.y0);
        for (const l of kept) if (l.chip.tile === p.tile && boxesHit(b, l.box)) top = Math.min(top, l.box.y0);
        for (const o of plateBoxes) if (boxesHit(b, o.box)) top = Math.min(top, o.box.y0);
        if (top === Infinity) break;
        const next = p.y - top + 4;
        if (next > PLATE_LIFT_MAX || next <= lift) break;
        lift = next;
      }
      if (lift > 0) setStackLift(p.tile, lift);
      plateBoxes.push({ tile: p.tile, box: at() });
    }
    // the order lines left give way to the plates, then to each other
    const lineBoxes: Box[] = [];
    for (const l of kept) {
      if (plateBoxes.some((o) => boxesHit(l.box, o.box)) || lineBoxes.some((o) => boxesHit(l.box, o))) { l.chip.statHide = true; continue; }
      lineBoxes.push(l.box);
    }
    this.boxes = [...chipBoxes, ...plateBoxes.map((o) => o.box), ...lineBoxes];
  }

  /** Room for a loss number beside the labels already placed: it slides outwards past them, or stays hidden. */
  private readonly fitPop = (p: Pop, h: number): number | null => {
    if ((p.kind !== 'loss' && p.kind !== 'attrition') || !this.boxes.length || !this.cam) return p.dx;
    _p.copy(p.pos).project(this.cam);
    const x = (_p.x + 1) * this.viewW / 2, y = (1 - _p.y) * this.viewPx / 2;
    const hp = h * ((this.cam as THREE.PerspectiveCamera).projectionMatrix.elements[5] ?? 1) * this.viewPx / 2, wp = hp * p.aspect;
    // the whole rise of the number, bottom to top
    const y0 = y - (p.kind === 'loss' ? 3.8 : 2.4) * hp, y1 = y - (p.kind === 'loss' ? 0.6 : 0.3) * hp;
    const slide = (s: number): number | null => {
      let cx = x + p.dx * wp;
      for (let i = 0; i < 6; i++) {
        const b: Box = { x0: cx - wp / 2, x1: cx + wp / 2, y0, y1 };
        let edge: number | null = null;
        for (const o of this.boxes) if (boxesHit(b, o)) edge = s > 0 ? Math.max(edge ?? -Infinity, o.x1) : Math.min(edge ?? Infinity, o.x0);
        if (edge == null) return Math.abs(cx - x) > POP_REACH ? null : (cx - x) / wp;
        cx = edge + s * (wp / 2 + 4);
      }
      return null;
    };
    return p.dx > 0 ? slide(1) : p.dx < 0 ? slide(-1) : slide(1) ?? slide(-1);
  };

  private dropStatus(chip: Chip): void {
    const st = chip.stat;
    if (!st) return;
    this.chipGroup.remove(st.sprite);
    st.mat.dispose();
    if (st.key) this.release(st.key);
    chip.stat = null; chip.statText = '';
  }

  /** Rereads each army's war line, and keeps its sprite above the counter (fades out as the camera leaves). */
  private updateStatus(now: number, zoom: number, dist: number): void {
    const reread = now - this.statusAt > STATUS_EVERY;
    if (reread) {
      this.statusAt = now;
      this.unitById.clear();
      for (const u of this.world.units) this.unitById.set(u.id, u);
    }
    const fade = 1 - smooth(2.3, 3.1, dist);
    const battles = useBattles.getState().byTile;
    for (const chip of this.chips.values()) {
      if (reread) {
        const lead = chip.units[0];
        const u = chip.kind === 'army' && lead ? this.unitById.get(lead.id) : undefined;
        const line = u ? warLineOf(this.world, u, battles) : null;
        const text = line?.text ?? '';
        if (text !== chip.statText || (line && line.tone !== chip.statTone)) {
          chip.statText = text;
          if (line) chip.statTone = line.tone;
          if (!line) this.dropStatus(chip);
          else {
            const p = this.pal;
            const accent = line.tone === 'attack' ? '#' + this.col.war.getHexString() : line.tone === 'hold' ? p.accent : '#8a8f98';
            const key = `st|${text}|${accent}`;
            const tex = this.acquire(key, () => drawStatus(text, accent, p.night, p.parchment));
            if (!chip.stat) {
              const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, toneMapped: false });
              const sprite = new THREE.Sprite(mat);
              sprite.renderOrder = 31;
              this.chipGroup.add(sprite);
              chip.stat = { sprite, mat, key: '', aspect: 1 };
            }
            const img = tex.image as { width: number; height: number };
            chip.stat.aspect = img.width / img.height;
            chip.stat.mat.map = tex;
            chip.stat.mat.needsUpdate = true;
            if (chip.stat.key) this.release(chip.stat.key);
            chip.stat.key = key;
          }
        }
      }
      const st = chip.stat;
      if (!st) continue;
      const f = facing(chip.pos, _camDir);
      const show = f > 0 && !chip.absorbed && !chip.statHide && chip.sprite.visible && fade > 0.02;
      st.sprite.visible = show;
      if (!show) continue;
      st.sprite.position.copy(chip.pos);
      const hs = STATUS_H * zoom, h = chip.height * zoom;
      st.sprite.scale.set(hs * st.aspect, hs, 1);
      st.sprite.center.set(0.5, -((1 - chip.sprite.center.y) * h + 0.2 * hs) / hs);
      st.mat.opacity = fade * (chip.mat.opacity > 0 ? 1 : 0) * Math.min(1, f * 3) * chip.sight;
    }
  }

  private dropChip(chip: Chip): void {
    this.dropStatus(chip);
    this.unmerge(chip);
    this.chipGroup.remove(chip.sprite);
    chip.mat.dispose();
    if (chip.texKey) this.release(chip.texKey);
    chip.texKey = '';
  }

  /** How long a dying counter's model lingers: a beaten fleet goes down slowly, the rest are quick. */
  private dyingMs(chip: Chip): number {
    return chip.dying?.shatter ? (chip.kind === 'fleet' ? SINK_MS : 750) : 450;
  }

  private killChip(chip: Chip, now: number, shatter: boolean): void {
    this.dropStatus(chip);
    chip.dying = { start: now, shatter };
    this.dying.push(chip);
    // a fleet beaten at sea goes down: Firing draws the foam ring and the bubbles (naval battles)
    if (shatter && chip.kind === 'fleet' && chip.pos.lengthSq() > 0) {
      firingFeed.sink(chip.pos, this.unitSize, ageIndex(this.ageFor(chip.owner)), now);
    }
    if (shatter) {
      this.sparks.burst(now, chip.pos, 14, 0.008, new THREE.Color(this.colorOf(chip.owner)), 700, 0.05);
      this.sparks.burst(now, chip.pos, 6, 0.006, this.col.parchment, 500, 0.04);
    }
  }

  // ---------- arrows ----------

  private takeArrow(now: number): Arrow | null {
    let best: Arrow | null = null;
    for (const a of this.arrows) {
      if (!a.busy) { best = a; break; }
      if (!best || a.born < best.born) best = a;
    }
    if (!best) return null;
    for (const st of this.states.values()) if (st.arrow === best) st.arrow = null;
    best.busy = true;
    best.born = now;
    best.mesh.visible = true;
    best.mat.uniforms.uOpacity!.value = 0;
    return best;
  }

  // ---------- events ----------

  onEvents(events: WorldEvent[]): void {
    if (this.disposed) return;
    const now = performance.now();
    for (const e of events) {
      switch (e.type) {
        case 'unit_moved': {
          const st = this.states.get(e.unitId);
          const ms = (e.arriveTick - e.tick) * this.msPerTick();
          if (st) this.startMove(st, e.from, e.to, ms, now);
          else if (this.traders.has(e.unitId)) this.traders.move(e.unitId, e.from, e.to, ms);
          else {
            // not seen yet: either kind may claim it at the next sync
            this.pendingMoves.set(e.unitId, e);
            this.traders.move(e.unitId, e.from, e.to, ms);
          }
          break;
        }
        case 'unit_removed':
          this.removedReason.set(e.unitId, e.reason);
          break;
        case 'battle':
          this.onBattle(e, now);
          break;
        case 'unit_attrition':
          this.onAttrition(e, now);
          break;
        case 'tile_claimed':
          if (e.cause === 'conquest') this.onConquest(e.tile, e.owner, e.from, now);
          break;
        case 'relation_changed':
          if (e.stance === 'war') {
            this.gains.set(pairKey(e.a, e.b), 0);
            this.pulseBorders(e.a, e.b, now);
          } else if (/^the treaty/i.test(e.reason.trim())) {
            this.treaty.set(pairKey(e.a, e.b), now + TREATY_WINDOW);
          }
          this.lastFront = -1e9; // refresh the fronts now
          break;
        case 'country_fell':
          this.onFall(e.countryId, now);
          break;
        case 'country_updated':
          if (e.patch.flag || e.patch.color) { this.flags.delete(e.countryId); this.teamCol.delete(e.countryId); this.dirty = true; }
          if (e.patch.techAge && e.patch.techAge !== (this.knownAge.get(e.countryId) ?? 'ancient')) this.onAge(e.countryId, e.patch.techAge, now);
          break;
        default:
          break;
      }
    }
  }

  /** A nation reached a new age: every unit it owns swaps model and icon with a pop and gilt sparks. */
  private onAge(country: number, age: TechAge, now: number): void {
    this.ageSeen.set(country, age);
    this.knownAge.set(country, age);
    this.agePop.set(country, now);
    this.dirty = true;
    for (const st of this.states.values()) if (st.owner === country) st.hopAt = now;
    for (const chip of this.chips.values()) {
      if (chip.owner !== country || chip.pos.lengthSq() === 0) continue;
      this.sparks.burst(now, chip.pos, 12, 0.009, this.col.accent, 900, 0.035, 250);
      this.sparks.burst(now, chip.pos, 5, 0.006, this.col.flash, 500, 0.02);
    }
  }

  private onBattle(e: Extract<WorldEvent, { type: 'battle' }>, now: number): void {
    const P = this.surf(e.tile, CHIP_LIFT, new THREE.Vector3());
    if (P.lengthSq() === 0) return;
    const n = P.clone().normalize();

    // attack arrow: turn the attacker's march arrow red, or draw one from where it stands
    const st = this.states.get(e.attackerUnit);
    if (st) {
      let arrow = st.arrow && st.arrow.busy && st.arrow.toTile === e.tile && st.arrow.attack ? st.arrow : null;
      if (!arrow) {
        this.statePos(st, now, _v);
        if (_v.lengthSq() > 0 && _v.distanceTo(P) > 0.004) {
          if (st.arrow) st.arrow.holdUntil = Math.min(st.arrow.holdUntil, now);   // the thin march arrow gives way
          arrow = this.takeArrow(now);
          if (arrow) {
            const a = _w.copy(_v).normalize();
            const om = Math.acos(Math.min(1, Math.max(-1, a.dot(n))));
            const width = Math.min(0.026, Math.max(0.012, om * 0.32));   // bolder than a march arrow
            writeArrow(arrow.geo, a.clone(), _v.length() - CHIP_LIFT + 0.003, n, this.mesh.heights[e.tile]! + 0.003, width);
            arrow.toTile = e.tile;
            st.arrow = arrow;
          }
        }
      }
      if (arrow) {
        arrow.attack = true;
        arrow.mat.uniforms.uColor!.value.copy(this.col.war);
        arrow.mat.uniforms.uLight!.value.copy(this.col.parchment);
        arrow.mat.uniforms.uSpeed!.value = 5;
        arrow.holdUntil = Math.max(arrow.holdUntil, now + 4500);   // each clash renews it: it stays while the battle runs
      }
    }

    // in battle the formations face each other: the attacker turns to the tile, the defenders there to the attacker
    if (st) {
      this.statePos(st, now, _v);
      if (_v.lengthSq() > 0 && _v.distanceTo(P) > 0.004) {
        st.head.subVectors(P, _v);
        for (const u of this.states.values()) if (u.owner === e.defender && u.kind === 'army' && u.to === e.tile && u.from === u.to) u.head.subVectors(_v, P);
      }
    }

    this.pops.show(now, 'clash', this.clashTex, P, 0.036, 1, CLASH_MS);
    // terrain defence bonus: a small shield beside the clash badge
    const ter = this.world.tiles[e.tile]?.terrain;
    const def = ter ? terrainEffects(ter).defence : 0;
    if (ter && (ter === 'hills' || ter === 'mountain' || ter === 'forest') && def > 0) {
      const text = `+${Math.round(def * 100)}%`;
      let tex = this.shieldTex.get(text);
      if (!tex) { tex = toTexture(drawShield(text, this.pal.parchment, this.pal.accent, this.pal.ink)); this.shieldTex.set(text, tex); }
      this.pops.show(now, 'clash', tex, P, 0.03, 120 / 128, CLASH_MS, 1.0);
    }
    // muzzle flashes: short warm flickers over ~0.8s, then a few gilt sparks
    this.sparks.burst(now, P, 18, 0.013, this.col.flash, 200, 0.01, 750);
    this.sparks.burst(now, P, 8, 0.01, this.col.accent, 450, 0.05, 300);
    for (let i = 0; i < 6; i++) {
      tangentJitter(_j, n, 0.01);
      const start = P.clone().add(_j);
      const drift = tangentJitter(new THREE.Vector3(), n, 0.012).addScaledVector(n, 0.01);
      this.smoke.emit(now, start, drift, 0.008, 0.03, BATTLE_SMOKE_MS, 0.75, this.col.ruin, i * 110);
    }
    const loss = (v: number, dx: number, delay: number): void => {
      if (!(v > 0)) return;
      const text = `-${Math.round(v)}`;
      let tex = this.lossTex.get(text);
      if (!tex) { tex = toTexture(drawLoss(text, this.pal.stance.war, this.pal.ink)); this.lossTex.set(text, tex); }
      this.pops.show(now, 'loss', tex, P, 0.022, 160 / 72, LOSS_MS, dx, delay);
    };
    loss(e.losses.attacker, -1.0, 250);
    loss(e.losses.defender, 1.0, 350);

    // the loser breaks: its figures flinch back where they stand, or hurry off with loose ranks
    if (e.winner === e.defender && st) st.routAt = now;
    else if (e.winner === e.attacker) for (const u of this.states.values()) if (u.owner === e.defender && u.to === e.tile) u.routAt = now;

    // the winner's counter hops
    const hopAt = now + 320;
    if (e.winner === e.attacker && st) st.hopAt = hopAt;
    else for (const u of this.states.values()) if (u.owner === e.winner && u.to === e.tile) u.hopAt = hopAt;
  }

  /** Slow wear on a unit outside its land: a small grey "-N", a dim flicker, dust on harsh ground. */
  private onAttrition(e: Extract<WorldEvent, { type: 'unit_attrition' }>, now: number): void {
    const st = this.states.get(e.unitId);
    const tile = st ? st.to : -1;
    if (!st || tile < 0) return;
    const P = this.surf(tile, CHIP_LIFT, new THREE.Vector3());
    if (P.lengthSq() === 0) return;
    st.flickAt = now;
    const text = `-${Math.max(1, Math.round(e.loss))}`;
    let tex = this.attTex.get(text);
    if (!tex) { tex = toTexture(drawAttrition(text, this.pal.ink)); this.attTex.set(text, tex); }
    this.pops.show(now, 'attrition', tex, P, 0.014, 112 / 56, 1400);
    const dust = e.terrain === 'desert' ? 0xd9bf82 : e.terrain === 'ice' ? 0xeaf2f6 : e.terrain === 'mountain' ? 0x8b8680 : -1;
    if (dust < 0) return;
    const n = P.clone().normalize();
    for (let i = 0; i < 2; i++) {
      tangentJitter(_j, n, 0.006);
      const drift = tangentJitter(new THREE.Vector3(), n, 0.008).addScaledVector(n, 0.004);
      this.smoke.emit(now, P.clone().add(_j), drift, 0.005, 0.018, 1100, 0.5, new THREE.Color(dust), i * 120);
    }
  }

  private onConquest(tile: number, owner: number, from: number, now: number): void {
    if (from < 0 || owner < 0) return;
    const key = pairKey(owner, from);
    const lowGains = owner < from ? 1 : -1;
    this.gains.set(key, (this.gains.get(key) ?? 0) + lowGains);
    const P = this.surf(tile, 0.003, new THREE.Vector3());
    if (P.lengthSq() === 0) return;
    const until = this.treaty.get(key);
    if (until != null && until > now) {
      // ceded at the peace table: a parchment flash and a scroll, no smoke
      const geo = tileFanGeometry(this.world, this.mesh.heights, [tile]);
      const mat = new THREE.MeshBasicMaterial({ color: this.pal.parchment, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 19;
      this.frontGroup.add(m);
      this.flashes.push({ mesh: m, mat, born: now, life: CEDE_MS, kind: 'cede' });
      this.pops.show(now, 'scroll', this.scrollTex, P, 0.032, 1, CEDE_MS);
      return;
    }
    if (this.columns.length >= MAX_COLUMNS) this.columns.shift();
    this.columns.push({ pos: P, n: P.clone().normalize(), until: now + COLUMN_MS, nextAt: now });
    this.sparks.burst(now, P, 6, 0.008, this.col.accent, 600, 0.03, 400);
  }

  private pulseBorders(a: number, b: number, now: number): void {
    const owner = this.world.owner;
    const edges: MeshEdge[] = [];
    for (const e of this.mesh.edges) {
      const oa = owner[e.tileA] ?? -1, ob = owner[e.tileB] ?? -1;
      if (oa === ob) continue;
      if (oa === a || oa === b || ob === a || ob === b) edges.push(e);
    }
    if (!edges.length) return;
    const mat = lineMaterial();
    mat.uniforms.uColor!.value.copy(this.col.war);
    mat.uniforms.uInk!.value.copy(this.col.war);
    const m = new THREE.Mesh(lineGeometry(this.world, edges, null), mat);
    m.frustumCulled = false;
    m.renderOrder = 19;
    this.frontGroup.add(m);
    this.flashes.push({ mesh: m, mat, born: now, life: PULSE_MS, kind: 'pulse' });
  }

  private onFall(country: number, now: number): void {
    this.fallen.set(country, now + FALL_SHIELD);
    for (const [key, chip] of this.chips) {
      if (chip.owner !== country) continue;
      this.chips.delete(key);
      this.killChip(chip, now, true);
    }
  }

  // ---------- fronts ----------

  private refreshFronts(now: number): void {
    this.lastFront = now;
    const atWar = new Map<string, [number, number]>();
    for (const r of this.world.relations) if (r.stance === 'war') atWar.set(pairKey(r.a, r.b), [Math.min(r.a, r.b), Math.max(r.a, r.b)]);
    const lists = new Map<string, MeshEdge[]>();
    if (atWar.size) {
      const owner = this.world.owner;
      for (const e of this.mesh.edges) {
        const oa = owner[e.tileA] ?? -1, ob = owner[e.tileB] ?? -1;
        if (oa < 0 || ob < 0 || oa === ob) continue;
        const k = pairKey(oa, ob);
        if (!atWar.has(k)) continue;
        let l = lists.get(k);
        if (!l) { l = []; lists.set(k, l); }
        l.push(e);
      }
    }
    for (const [k, [a, b]] of atWar) {
      const edges = lists.get(k) ?? [];
      const g = this.gains.get(k) ?? 0;
      const loser = g > 0 ? b : g < 0 ? a : -1;
      let sum = 0;
      for (const e of edges) sum = (sum + e.tileA * 31 + e.tileB) % 1000003;
      const sig = `${edges.length}:${sum}:${loser}`;
      let f = this.fronts.get(k);
      if (f && f.sig === sig && f.fadeStart < 0) continue;
      const owner = this.world.owner;
      const geo = lineGeometry(this.world, edges, loser < 0 ? () => 0 : (e) => (owner[e.tileB] === loser ? 1 : -1));
      if (!f) {
        const mat = lineMaterial();
        mat.uniforms.uColor!.value.copy(this.col.war);
        mat.uniforms.uInk!.value.copy(this.col.ink);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 18;
        this.frontGroup.add(mesh);
        f = { a, b, mesh, mat, sig, fadeStart: -1 };
        this.fronts.set(k, f);
      } else {
        f.mesh.geometry.dispose();
        f.mesh.geometry = geo;
        f.sig = sig;
        f.fadeStart = -1;
      }
    }
    for (const [k, f] of this.fronts) if (!atWar.has(k) && f.fadeStart < 0) f.fadeStart = now;
  }

  // ---------- frame ----------

  /** #311: the army under a screen point (NDC): its counter chip first, else a formation within
   *  `radiusPx` of the point. Returns the unit id, or null. */
  pickArmy(camera: THREE.Camera, ndc: THREE.Vector2, viewW: number, viewH: number, radiusPx = 22): string | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const shown = this.chipGroup.children.filter((o) => o.visible);
    for (const hit of ray.intersectObjects(shown, false)) {
      const chip = [...this.chips.values()].find((c) => c.sprite === hit.object);
      const lead = chip && (chip.kind === 'army' || chip.kind === 'fleet') ? chip.moving ?? chip.units[0] : null;
      if (lead) return lead.id;
    }
    const now = performance.now();
    let best: string | null = null, bestD = radiusPx;
    for (const st of this.states.values()) {
      if (st.kind !== 'army' && st.kind !== 'fleet') continue;
      this.statePos(st, now, _p);
      if (_p.lengthSq() === 0) continue;
      const dist = camera.position.length();
      if (_w.copy(_p).normalize().dot(camera.position) / dist <= 1 / dist + 0.05) continue;   // past the horizon
      _p.project(camera);
      const d = Math.hypot((_p.x - ndc.x) * viewW / 2, (_p.y - ndc.y) * viewH / 2);
      if (d < bestD) { bestD = d; best = st.id; }
    }
    return best;
  }

  update(camera: THREE.Camera, now: number, viewW = 1280, viewH = 800): void {
    if (this.disposed) return;
    const dt = this.lastNow ? Math.min(100, now - this.lastNow) : 16;
    this.lastNow = now;
    this.lastDt = dt;
    this.spots.update(dt);
    this.followClock(now, now - (this.lastClockAt || now));
    this.lastClockAt = now;
    const dist = camera.position.length();
    this.viewH = viewHeight(camera, dist);
    _camDir.copy(camera.position).normalize();
    const zoom = Math.min(1.25, Math.max(0.68, 1.25 - ((dist - 1.3) / 2.2) * 0.6)); // compact from orbit
    this.near = smooth(MODEL_FAR, MODEL_NEAR, dist);

    for (const st of this.states.values()) {
      if (st.t1 > 0 && now >= st.t1 && st.from !== st.to) {
        if (st.dissolve) { st.landAt = st.t1; st.inAt = (st.t0 + st.t1) / 2; st.ghost = null; }
        st.from = st.to;
        this.dirty = true;
      }
      // the model turns to its heading instead of snapping (ships come about more slowly)
      if (st.head.lengthSq() > 1e-12) {
        _w.copy(st.head).normalize();
        if (st.face.lengthSq() < 1e-12) st.face.copy(_w);
        else st.face.lerp(_w, 1 - Math.exp(-dt / (st.kind === 'fleet' ? 420 : 230))).normalize(); // a short wheel, as a block
      }
      // the step: eases in as the march sets off and out as it settles, quicker the faster it goes
      if (now < st.t1 && st.from !== st.to && !st.dissolve) {
        const a = Math.min(1, Math.max(0, (now - st.t0) / GAIT_RAMP_MS)), b = Math.min(1, Math.max(0, (st.t1 - now) / GAIT_RAMP_MS));
        st.amp = smooth(0, 1, Math.min(a, b));
        st.surge = b - a;
        const da = this.dirs[st.from], db = this.dirs[st.to];
        const pace = da && db ? Math.min(1, (da.angleTo(db) / Math.max(0.001, (st.t1 - st.t0) / 1000)) / speedCap(st.kind, this.viewH)) : 0;
        const steps = (STEPS_SLOW + (STEPS_FAST - STEPS_SLOW) * pace) * (now - st.routAt < ROUT_MS ? 1.45 : 1);
        st.stride += dt * 0.001 * Math.PI * steps;
      } else if (st.amp > 0) {
        st.amp = st.amp < 0.01 ? 0 : st.amp * Math.exp(-dt / 120);
        st.surge = 0;
      }
    }
    if (this.dirty) this.rebuildChips(now);
    for (const [c, until] of this.fallen) if (until < now) this.fallen.delete(c);

    // counters
    const see = 1 - Math.exp(-dt / SIGHT_MS);
    for (const chip of this.chips.values()) {
      chip.sight += (chip.sightGoal - chip.sight) * see;
      if (Math.abs(chip.sightGoal - chip.sight) < 0.02) chip.sight = chip.sightGoal;
      this.placeChip(chip, now, zoom);
    }
    if (now - this.declutterAt > DECLUTTER_MS) {
      this.readSight(camera);
      this.declutter(camera, viewW, viewH, now);
      for (const chip of this.chips.values()) this.placeChip(chip, now, zoom);
      this.layoutFurniture(camera, viewW, viewH, zoom, dist);
    }
    this.updateStatus(now, zoom, dist);
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const chip = this.dying[i]!;
      const d = chip.dying!;
      const life = this.dyingMs(chip);
      if (now - d.start >= life) { this.dropChip(chip); this.dying.splice(i, 1); continue; }
      const t = Math.min(1, (now - d.start) / (d.shatter ? 750 : 450));   // the counter itself is gone in under a second
      const f = facing(chip.pos, _camDir);
      chip.sprite.visible = f > 0;
      const h = chip.height * zoom * (d.shatter ? 1 + 0.5 * t : 1 - 0.3 * t);
      chip.sprite.scale.set(h * chip.aspect, h, 1);
      chip.mat.rotation = d.shatter ? t * t * 0.9 : 0;
      chip.mat.opacity = f * (1 - t) * (d.shatter ? (Math.random() < 0.3 ? 0.4 : 1) : 1);
    }

    // 3D models: counters stand on them up close; traders sail at every distance
    this.field.begin();
    firingFeed.begin();
    if (this.near > 0) {
      for (const chip of this.chips.values()) this.drawModel(chip, now, 1);
      for (const chip of this.dying) {
        const d = chip.dying!;
        this.drawModel(chip, now, Math.max(0, 1 - (now - d.start) / this.dyingMs(chip)));
      }
    }
    this.traders.update(this.field, _camDir, dist, now, dt);
    this.field.end();

    // arrows
    const tSec = now / 1000;
    for (const a of this.arrows) {
      if (!a.busy) continue;
      const fadeIn = Math.min(1, (now - a.born) / 180);
      const out = now > a.holdUntil ? 1 - (now - a.holdUntil) / ARROW_FADE : 1;
      if (out <= 0) { a.busy = false; a.mesh.visible = false; continue; }
      a.mat.uniforms.uOpacity!.value = 0.95 * fadeIn * out;
      a.mat.uniforms.uTime!.value = tSec;
    }

    // fronts
    if (now - this.lastFront >= FRONT_EVERY) this.refreshFronts(now);
    const lineScale = Math.min(2.2, Math.max(0.16, (dist - 1) / 1.5));
    const toothScale = 1 + Math.max(0, dist - 1.8) * 0.7; // teeth readable from orbit
    for (const [k, f] of this.fronts) {
      let op = 1;
      if (f.fadeStart >= 0) {
        op = 1 - (now - f.fadeStart) / FRONT_FADE;
        if (op <= 0) {
          this.frontGroup.remove(f.mesh);
          f.mesh.geometry.dispose();
          f.mat.dispose();
          this.fronts.delete(k);
          continue;
        }
      }
      f.mat.uniforms.uOpacity!.value = 0.95 * op;
      f.mat.uniforms.uScale!.value = lineScale;
      f.mat.uniforms.uTooth!.value = toothScale;
      f.mat.uniforms.uTime!.value = tSec;
    }

    // war pulses and treaty flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const fl = this.flashes[i]!;
      const t = (now - fl.born) / fl.life;
      if (t >= 1) {
        this.frontGroup.remove(fl.mesh);
        fl.mesh.geometry.dispose();
        fl.mat.dispose();
        this.flashes.splice(i, 1);
        continue;
      }
      if (fl.kind === 'pulse') {
        const sm = fl.mat as THREE.ShaderMaterial;
        sm.uniforms.uOpacity!.value = Math.abs(Math.sin(t * Math.PI * 2)) * 0.9;
        sm.uniforms.uScale!.value = lineScale * 1.6;
        sm.uniforms.uTime!.value = tSec;
      } else {
        fl.mat.opacity = Math.abs(Math.sin(t * Math.PI * 2)) * 0.7 * (1 - t * 0.5);
      }
    }

    // smoke columns over captured tiles
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const c = this.columns[i]!;
      if (now > c.until) { this.columns.splice(i, 1); continue; }
      while (c.nextAt <= now) {
        c.nextAt += 120;
        tangentJitter(_j, c.n, 0.004);
        const start = _v.copy(c.pos).add(_j);
        const drift = tangentJitter(_w, c.n, 0.006).addScaledVector(c.n, 0.03);
        this.smoke.emit(now, start, drift, 0.005, 0.02, 1500, 0.6, this.col.smoke);
      }
    }

    this.fx.update(camera, now, dt);
    this.sparks.update(now, dt);
    this.smoke.update(now, dt);
    this.cam = camera; this.viewW = viewW; this.viewPx = viewH;
    this.pops.update(now, _camDir, zoom, this.fitPop);
  }

  /**
   * The news picture-in-picture pass (web/src/globe/pip): its camera films one tile from close by while
   * the main camera may be out in orbit, where armies show as counters only. For that pass, add the 3D
   * armies, fleets and formations round the shot's tile to the model pools, after the main view's own;
   * `pipEnd` drops them again before the main view is drawn. Counters are sprites, which the pass hides.
   */
  pipBegin(camera: THREE.Camera, now: number): void {
    if (this.disposed) return;
    const mainNear = this.near;
    _mainDir.copy(_camDir);
    _camDir.copy(camera.position).normalize();
    this.field.mark();
    this.near = 1;
    this.pipFill = true;
    const draw = (chip: Chip, k: number): void => {
      if (chip.pos.lengthSq() === 0) return;
      _v.copy(chip.pos).normalize();
      if (_v.dot(_camDir) < PIP_REACH) return; // only round the shot: it sees a few tiles
      if (mainNear > 0 && facing(chip.pos, _mainDir) > 0) return; // the main view drew it already
      this.drawModel(chip, now, k);
    };
    for (const chip of this.chips.values()) draw(chip, 1);
    for (const chip of this.dying) draw(chip, Math.max(0, 1 - (now - chip.dying!.start) / this.dyingMs(chip)));
    this.field.end();
    this.pipFill = false;
    this.near = mainNear;
    _camDir.copy(_mainDir);
  }

  pipEnd(): void {
    if (!this.disposed) this.field.rewind();
  }

  /**
   * Which counters the camera can really see (status/sight.ts): one behind the planet's curve is hidden at any
   * zoom, and once the camera tilts towards the ground, so is one behind nearer high ground or a town. Counters
   * draw over the scene, so without this a fleet beyond a hill appears to sit in the field in front of it.
   */
  private readSight(camera: THREE.Camera): void {
    const low = groundView.tilt > 0.05;
    for (const chip of this.chips.values()) {
      if (chip.pos.lengthSq() === 0) { chip.sightGoal = 1; continue; }
      // judged above the model's head, where the counter floats, so a unit seen over a crest keeps its counter
      _j.copy(chip.pos).setLength(chip.pos.length() + this.unitSize * 1.5);
      let s = horizonSight(camera.position, _j);
      if (s > 0 && low && !groundSight(this.terrain, camera.position, _j, chip.tile)) s = 0;
      chip.sightGoal = s;
    }
  }

  private placeChip(chip: Chip, now: number, zoom: number): void {
    const lead = chip.moving ?? chip.units[0];
    if (!lead) { chip.sprite.visible = false; return; }
    this.statePos(lead, now, chip.pos);
    chip.sprite.position.copy(chip.pos);
    const f = facing(chip.pos, _camDir) * chip.sight;
    chip.sprite.visible = f > 0;
    if (!f) return;
    let hop = 0;
    for (const u of chip.units) {
      const t = (now - u.hopAt) / 380;
      if (t >= 0 && t < 1) hop = Math.max(hop, Math.sin(Math.PI * t) * 0.45);
    }
    const h = chip.height * zoom;
    chip.sprite.scale.set(h * chip.aspect, h, 1);
    if (chip.absorbed && !chip.moving) { chip.sprite.visible = false; return; }
    const stack = chip.kind === 'settler' ? 0 : chip.lift ?? Math.max(0, chip.stack);
    // settlers sit on the tile, counters just above it, and above the model when it shows; a
    // little higher from orbit so they clear the nation names
    const base = chip.kind === 'settler' ? 0.5 : -0.18 - 0.85 * this.near - 0.25 * (1 - zoom / 1.25);
    chip.sprite.center.set(0.5, base - stack * 0.92 - hop);
    chip.mat.opacity = f * this.alphaOf(lead, now);
    // attrition flicker: a brief dim, greyish pulse
    let fl = 0;
    for (const u of chip.units) {
      const t = (now - (u.flickAt ?? -1e9)) / 600;
      if (t >= 0 && t < 1) fl = Math.max(fl, Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t));
    }
    const c = 1 - 0.5 * fl;
    chip.mat.color.setRGB(c, c, c);
  }

  /** The age model under a counter, standing where the counter is and facing its march. An army
   *  is a formation of 3 to 7 figures (#287) when its age has them, else the one army model. */
  private drawModel(chip: Chip, now: number, k: number): void {
    if (chip.kind !== 'army' && chip.kind !== 'fleet') return;
    const lead = chip.moving ?? chip.units[0];
    if (!lead || k <= 0 || chip.pos.lengthSq() === 0) return;
    const f = facing(chip.pos, _camDir);
    if (f <= 0) return;
    const age = this.ageFor(chip.owner);
    const model = this.models.resolve(age, chip.kind);
    const alpha = this.alphaOf(lead, now);
    if (alpha <= 0.02) return;
    // a beaten fleet keeps its size while it rolls over and goes under; only the last moments shrink it
    const sinkT = chip.kind === 'fleet' && chip.dying?.shatter ? Math.min(1, (now - chip.dying.start) / SINK_MS) : -1;
    if (sinkT >= 0) k = sinkT > 0.8 ? (1 - sinkT) / 0.2 : 1;
    const front = chip.kind === 'army' ? this.models.resolveFigure(age, 'front') : null;
    const calm = reducedMotion();
    // a formation beaten in battle goes down figure by figure, not as one shrinking block
    const felled = !!front && !!chip.dying?.shatter && !calm;
    const scale = this.near * (felled ? 1 : k) * this.popScale(chip.owner, now) * (0.35 + 0.65 * alpha) * (chip.fitAt ? chip.fitS : 1);
    const size = this.unitSize * (model.footprint / 0.5) * scale;
    _n.copy(chip.pos).normalize();
    _v.copy(chip.pos).addScaledVector(_n, 0.0003 - CHIP_LIFT);
    let hopAt = -1e9;
    for (const u of chip.units) if (u.hopAt > hopAt) hopAt = u.hopAt;
    const face = lead.face.lengthSq() > 1e-12 ? lead.face : lead.head;
    // the model keeps to its own tile: several counters on one tile stand apart along the tile's own axis, no
    // further than the outline allows, and a formation closes its ranks to the room it has (fitTile)
    const step = front ? this.unitSize * scale * FORMATION_W : size * (chip.kind === 'fleet' ? 1.5 : 0.9);   // hulls lie beam to beam, not on top of each other
    this.fitTile(chip, now, step, front ? this.unitSize * scale * FORMATION_GAP * FORMATION_R : 0, size);
    const held = chip.fitIn > 0;
    if (chip.fitOff) _v.addScaledVector(this.spots.axis(chip.tile, _side), chip.fitOff).setLength(chip.pos.length() + 0.0003 - CHIP_LIFT);
    if (held && !front) this.spots.keepIn(chip.tile, _v, size * (chip.kind === 'fleet' ? 0.3 : 0.45), chip.fitIn);
    const team = this.team(chip.owner);
    const fx = !this.pipFill && this.near > 0.5 && k >= 1 && alpha >= 1;
    const moving = !!chip.moving && !lead.dissolve;
    const ai = ageIndex(age);
    if (front) {
      // the formation's own frame: forward along the march, right across it
      standMatrix(_mm, _v, face, 1);
      _fwd.setFromMatrixColumn(_mm, 2);
      _right.setFromMatrixColumn(_mm, 0).negate(); // standMatrix's +x is up x forward, which is the left
      const r = _v.length();
      const gap = this.unitSize * scale * FORMATION_GAP * chip.fitK;
      let strength = 0;
      for (const u of chip.units) strength += u.strength;
      const slots = formationSlots(strength);
      const form = this.formOf(lead, slots, now);
      const fa = k >= 1 && alpha >= 1 ? firingFeed.army(chip.key, chip.owner, ai, chip.tile, _v) : -1;
      const fight = !calm && !moving && k >= 1 && firingFeed.fighting(chip.key, now);
      const shotMs = fight ? firingFeed.sinceShot(chip.key, now) : 1e9;
      const rout = calm ? 0 : Math.min(1, Math.max(0, 1 - (now - lead.routAt) / ROUT_MS));
      // followers set off a moment after the leaders, and close up on them as the march ends
      const lag = calm ? 0 : Math.sin(Math.PI * Math.abs(lead.surge)) * (lead.surge > 0 ? -0.22 : 0.12);
      let order = 0;
      for (let j = 0; j < 7; j++) {
        const p = form[j * 4 + 2]!;
        if (p <= 0.01) continue;
        const role = j < 3 ? 'front' : j < 5 ? 'flank' : 'back';
        const fig = role === 'front' ? front : this.models.resolveFigure(age, role) ?? model;
        const seed = lead.seed + j * 2.399;
        const P = gaitPose(gaitOf(ai, role), lead.stride, lead.amp, lead.surge, seed, now);
        let x = form[j * 4]!, z = form[j * 4 + 1]!;
        z += (0.55 - z) * lag;
        if (rout) {
          // beaten: the ranks loosen; standing, they reel back a pace, marching, they lean into the run
          x *= 1 + 0.3 * rout;
          z += 0.3 * rout * Math.sin(seed * 7.3);
          if (moving) P.pitch += 0.07 * rout;
          else { z -= 0.55 * rout * rout; P.pitch -= 0.1 * rout * rout; }
        }
        if (fight) {
          // the recoil of this figure's shot, a beat after the volley so the line fires raggedly
          const t = shotMs - order * 45;
          const kick = t >= 0 && t < 600 ? Math.exp(-t / 130) : 0;
          if (role === 'front') {
            if (ai < 2) {
              // spears and swords: each man lunges in his own time and falls back into line
              const u = (now / 950 + seed * 0.37) % 1;
              const l = u < 0.3 ? Math.sin((Math.PI * u) / 0.3) : 0;
              P.fwd += 0.55 * l; P.pitch += 0.05 + 0.2 * l;
            } else { P.pitch += 0.07 - 0.1 * kick; P.fwd -= 0.08 * kick; } // muskets and rifles: braced, then the kick
          } else if (role === 'flank') {
            if (ai < 3) {
              // horse and chariot: wheel and rear at the enemy line
              const u = (now / 2300 + seed * 0.21) % 1;
              const l = u < 0.22 ? Math.sin((Math.PI * u) / 0.22) : 0;
              P.pitch -= 0.3 * l; P.lift += 0.08 * l; P.fwd += 0.25 * l;
            } else { P.fwd -= 0.14 * kick; P.pitch -= 0.07 * kick; }
          } else if (ai === 0) P.pitch -= 0.14 * kick;                       // archers lean back to loose
          else if (ai === 1) P.pitch += 0.2 * kick;                          // the trebuchet rocks with its throw
          else if (ai <= 4) { P.fwd -= 0.3 * kick; P.pitch -= 0.1 * kick; }  // guns run back on their wheels
          else if (ai === 5) P.pitch -= 0.08 * kick;
          else P.sy += 0.14 * kick;                                          // the beacon pulses
        }
        const ht = (now - hopAt - order * 55) / 380;
        if (ht >= 0 && ht < 1) P.lift += Math.sin(Math.PI * ht) * 0.5;      // the winners cheer down the line
        // a casualty tips over and sinks away; a reinforcement stands up into its place
        let q = form[j * 4 + 3]! ? 0 : 1 - p;
        let grow = form[j * 4 + 3]! ? p * p * (3 - 2 * p) : 1;
        if (felled) q = Math.max(q, Math.min(1, Math.max(0, (1 - k) * 2 - order / 7)));
        if (q > 0) {
          if (calm) grow = 1 - q;
          else {
            const e = q * q * (3 - 2 * q);
            P.roll = ((j & 1) ? 1 : -1) * e * 1.5; P.pitch *= 1 - e; P.lift *= 1 - e; P.sy = 1;
            grow = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
          }
        }
        const fs = this.unitSize * (fig.footprint / 0.5) * scale * FIGURE_K * grow;
        _p.copy(_v).addScaledVector(_right, x * gap).addScaledVector(_fwd, z * gap + P.fwd * fs);
        if (held) this.spots.keepIn(chip.tile, _p, fs * 0.4, chip.fitIn);
        _p.setLength(r + P.lift * fs);
        this.field.push(fig, poseMatrix(_fm, _p, face, fs, P.pitch, P.roll, P.sy), team);
        order++;
        if (q > 0 || grow < 1) continue; // down, or not yet up: it neither fires nor smokes
        if (fa >= 0) firingFeed.figure(fa, role === 'front' ? ROLE_FRONT : role === 'flank' ? ROLE_FLANK : ROLE_BACK, _p, fs);
        if (fx && fig.anchors.length) this.fx.emit({ anchors: fig.anchors, stand: _fm, size: fs, moving, facing: f }, now, this.lastDt);
      }
      return;
    }
    const sea = chip.kind === 'fleet';
    const P = sea ? hullPose(lead.amp, lead.seed, now, ai >= 6) : gaitPose(gaitOf(ai, 'whole'), lead.stride, lead.amp, lead.surge, lead.seed, now);
    const ht = (now - hopAt) / 380;
    if (ht >= 0 && ht < 1) P.lift += Math.sin(Math.PI * ht) * 0.5;
    if (sea && sinkT >= 0 && !calm) {
      // down by the stern: heels over, noses up, and slips below the swell
      const e = sinkT * sinkT;
      P.roll += 1.25 * e; P.pitch += 0.5 * e; P.lift -= 1.3 * e;
    }
    // a fleet in a sea fight (Firing sets the aim): ancient rams come bow-on, the rest turn broadside
    let kick = 0;
    if (sea && sinkT < 0 && !moving && k >= 1 && alpha >= 1 && firingFeed.fighting(chip.key, now) && firingFeed.aimOf(chip.key, _aim)) {
      _aim.sub(_v);
      _aim.addScaledVector(_n, -_aim.dot(_n));
      if (_aim.lengthSq() > 1e-12) {
        _aim.normalize();
        if (ai > 0) {
          _side.crossVectors(_n, _aim);
          if (face.lengthSq() > 1e-12 && _side.dot(face) < 0) _side.negate();
          _aim.copy(_side);
        }
        lead.head.copy(_aim);
      }
      kick = Math.exp(-firingFeed.sinceShot(chip.key, now) / 160);
      if (!calm) { P.roll += 0.06 * kick; P.lift += 0.01 * kick; }
    }
    if (P.lift) _v.addScaledVector(_n, P.lift * size);
    this.field.push(model, poseMatrix(_mm, _v, face, size, P.pitch, P.roll, P.sy), team);
    if (k >= 1 && alpha >= 1) firingFeed.figure(firingFeed.army(chip.key, chip.owner, ai, chip.tile, _v, sea), ROLE_BACK, _v, size * 0.5);
    if (fx) this.fx.emit({ anchors: model.anchors, stand: _mm, size, moving, facing: f }, now, this.lastDt);
  }

  /**
   * A model's place inside its tile, eased so nothing jumps: how far along the tile's axis it stands from the
   * resting spot (several counters share the tile side by side), how close a formation's figures stand (it fits
   * the tile's inner radius, and a shared tile closes the ranks further), and how firmly the outline holds it
   * (not at all on the march, fully once it rests). `step` is the open-ground distance between two models,
   * `reach` a formation's open-ground radius (0 for a single model), `body` the model's own size.
   */
  private fitTile(chip: Chip, now: number, step: number, reach: number, body: number): void {
    if (chip.fitAt === now) return;   // the news picture draws the same counters in the same frame
    const rest = !chip.moving;
    const n = rest ? Math.max(1, chip.stackN) : 1, i = rest ? Math.max(0, chip.stack) : 0;
    const rin = this.spots.inradius(chip.tile);
    // a hull is long and the sea beside it is still sea: fleets may spread to the tile's edge
    const sep = n > 1 ? Math.min(step, (rin * (chip.kind === 'fleet' ? 1.7 : FIT_SPAN)) / (n - 1)) : 0;
    const off = (i - (n - 1) / 2) * sep;
    const room = (n > 1 ? Math.max(sep * 0.6, rin * 0.34) : rin * FIT_ROOM) - body * 0.2;
    const fit = reach > 0 ? Math.min(1, Math.max(FIT_MIN, room / reach)) : 1;
    if (!chip.fitAt) { chip.fitK = reach > 0 ? Math.min(1, Math.max(FIT_MIN, (rin * FIT_ROOM - body * 0.2) / reach)) : 1; chip.fitOff = 0; chip.fitS = 1; chip.fitIn = 0; }
    const e = chip.fitAt ? 1 - Math.exp(-Math.min(100, Math.max(0, now - chip.fitAt)) / FIT_MS) : 0;
    chip.fitAt = now;
    if (chip.dying) return;
    chip.fitK += (fit - chip.fitK) * e;
    chip.fitOff += (off - chip.fitOff) * e;
    chip.fitS += ((n >= 3 ? 0.8 : n === 2 ? 0.92 : 1) - chip.fitS) * e;
    chip.fitIn += ((rest ? 1 : 0) - chip.fitIn) * e;
    if (Math.abs(off - chip.fitOff) < 1e-5) chip.fitOff = off;
  }

  /**
   * The seven places of a formation (three in front, two flanks, two behind), eased towards the layout
   * for its strength: figures shuffle to their new spots instead of jumping, a place no longer wanted
   * empties one figure at a time (presence runs down while it falls), a new one fills as it stands up.
   * Kept on the unit, so the main view and the news picture-in-picture draw the same line.
   */
  private formOf(st: UState, slots: readonly Slot[], now: number): Float32Array {
    let f = st.form;
    const fresh = !f;
    if (!f) f = st.form = new Float32Array(28);
    const dt = fresh ? 0 : Math.min(100, Math.max(0, now - st.formAt));
    st.formAt = now;
    const ease = 1 - Math.exp(-dt / 260);
    f[3] = f[7] = f[11] = f[15] = f[19] = f[23] = f[27] = 0;
    let nf = 0, nk = 0, nb = 0;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      const j = (s.role === 'front' ? nf++ : s.role === 'flank' ? 3 + nk++ : 5 + nb++) * 4;
      if (j >= 28) continue;
      f[j + 3] = 1;
      if (fresh || f[j + 2]! <= 0) { f[j] = s.x; f[j + 1] = s.z; }
      else { f[j] = f[j]! + (s.x - f[j]!) * ease; f[j + 1] = f[j + 1]! + (s.z - f[j + 1]!) * ease; }
    }
    let falling = false;
    for (let j = 0; j < 28; j += 4) if (!f[j + 3] && f[j + 2]! > 0 && f[j + 2]! < 1) falling = true;
    for (let j = 0; j < 28; j += 4) {
      const p = f[j + 2]!;
      if (f[j + 3]) f[j + 2] = fresh ? 1 : Math.min(1, p + dt / RISE_MS);
      else if (fresh) f[j + 2] = 0;
      else if (p > 0 && (p < 1 || !falling)) { falling = true; f[j + 2] = Math.max(0, p - dt / FALL_MS); } // one at a time
    }
    return f;
  }

  dispose(): void {
    this.disposed = true;
    clearStackLifts();
    this.spots.dispose();
    this.field.dispose();
    this.fx.dispose();
    this.traders.dispose();
    this.models.dispose();
    for (const chip of this.chips.values()) this.dropChip(chip);
    for (const chip of this.dying) this.dropChip(chip);
    this.chips.clear();
    this.dying.length = 0;
    for (const e of this.texCache.values()) e.tex.dispose();
    this.texCache.clear();
    for (const a of this.arrows) { a.geo.dispose(); a.mat.dispose(); }
    for (const f of this.fronts.values()) { f.mesh.geometry.dispose(); f.mat.dispose(); }
    for (const fl of this.flashes) { fl.mesh.geometry.dispose(); fl.mat.dispose(); }
    this.fronts.clear();
    this.flashes.length = 0;
    this.sparks.dispose();
    this.smoke.dispose();
    this.pops.dispose();
    this.clashTex.dispose();
    this.scrollTex.dispose();
    for (const t of this.lossTex.values()) t.dispose();
    this.lossTex.clear();
    for (const t of this.attTex.values()) t.dispose();
    this.attTex.clear();
    for (const t of this.shieldTex.values()) t.dispose();
    this.shieldTex.clear();
    for (const f of this.flags.values()) f.img.onload = null;
    this.flags.clear();
  }
}
