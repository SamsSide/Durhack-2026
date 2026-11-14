// The war layer, kept out of React: army counters that march, arrows, battles, smoke, front
// lines, war pulses, treaty flashes and falls. Units come from world.units (the truth); events
// only start effects. Lane b (B5).
import * as THREE from 'three';
import { flagSvg } from '@terra/shared';
import type { UnitKind, World, WorldEvent } from '@terra/shared';
import type { MeshEdge, ProvinceMesh } from '../mesh/buildProvinceMesh';
import { getPalette } from '../palette';
import { COUNTER_H, COUNTER_W, drawClash, drawCounter, drawLoss, drawScroll, drawSettler, toTexture } from './draw';
import { unitIcon } from './era';
import { Pops, Smoke, Sparks, facing, tangentJitter } from './effects';
import { arcHump, arcPoint, arrowGeometry, arrowMaterial, lineGeometry, lineMaterial, tileFanGeometry, writeArrow } from './ribbons';

const TICK_MS = 500;            // one tick at 1x
const CHIP_LIFT = 0.004;
const CHIP_H = 0.03;            // counter height, as a share of the view (sizeAttenuation off)
const SETTLER_H = 0.017;
const ARROW_POOL = 32;
const ARROW_LINGER = 900;       // ms an arrow stays after its march ends
const ARROW_FADE = 600;
const FRONT_EVERY = 500;        // front lines refresh at most 2x a second
const FRONT_FADE = 1400;
const PULSE_MS = 1700;
const CEDE_MS = 2200;
const COLUMN_MS = 3000;
const MAX_COLUMNS = 12;
const TREATY_WINDOW = 4000;
const FALL_SHIELD = 6000;

function tok(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const pairKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

interface UState {
  id: string; owner: number; kind: UnitKind; strength: number;
  from: number; to: number; t0: number; t1: number;
  hopAt: number;
  arrow: Arrow | null;
}

interface Chip {
  key: string; owner: number; kind: UnitKind; tile: number;
  units: UState[]; moving: UState | null;
  sprite: THREE.Sprite; mat: THREE.SpriteMaterial; texKey: string; aspect: number; height: number;
  stack: number;
  pos: THREE.Vector3;
  dying: { start: number; shatter: boolean } | null;
}

interface Arrow {
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial; geo: THREE.BufferGeometry;
  busy: boolean; born: number; holdUntil: number; toTile: number; attack: boolean;
}

interface Front { a: number; b: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; sig: string; fadeStart: number }
interface Flash { mesh: THREE.Mesh; mat: THREE.Material; born: number; life: number; kind: 'pulse' | 'cede' }
interface Column { pos: THREE.Vector3; n: THREE.Vector3; until: number; nextAt: number }

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _j = new THREE.Vector3(), _camDir = new THREE.Vector3();

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

  private dirty = true;
  private lastFront = -1e9;
  private lastNow = 0;
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
    this.group.add(this.frontGroup, this.arrowGroup, this.smoke.group, this.sparks.points, this.chipGroup, this.pops.group);
    this.group.name = 'units';
  }

  // ---------- helpers ----------

  private surf(tile: number, extra: number, out: THREE.Vector3): THREE.Vector3 {
    const d = this.dirs[tile];
    if (!d) return out.set(0, 0, 0);
    return out.copy(d).multiplyScalar((this.mesh.heights[tile] ?? 1) + extra);
  }

  private msPerTick(): number {
    return TICK_MS / Math.max(0.25, this.world.speed || 1);
  }

  private colorOf(owner: number): string {
    return this.world.countries[owner]?.color ?? this.pal.ruin;
  }

  /** Where a unit is drawn right now (mid-march units are on the arc). */
  private statePos(st: UState, now: number, out: THREE.Vector3): THREE.Vector3 {
    if (now >= st.t1 || st.from === st.to || !this.dirs[st.from] || !this.dirs[st.to]) return this.surf(st.to, CHIP_LIFT, out);
    const s = easeInOut(Math.max(0, (now - st.t0) / (st.t1 - st.t0)));
    const a = this.dirs[st.from]!, b = this.dirs[st.to]!;
    return arcPoint(out, a, b, this.mesh.heights[st.from]! + CHIP_LIFT, this.mesh.heights[st.to]! + CHIP_LIFT, s, arcHump(a, b) * 0.6);
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

  private startMove(st: UState, from: number, to: number, ms: number, now: number): void {
    st.from = from;
    st.to = to;
    st.t0 = now;
    st.t1 = now + Math.min(3000, Math.max(300, ms));
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
    for (const u of this.world.units) {
      seen.add(u.id);
      let st = this.states.get(u.id);
      if (!st) {
        st = { id: u.id, owner: u.owner, kind: u.kind, strength: u.strength, from: u.tile, to: u.tile, t0: 0, t1: 0, hopAt: -1e9, arrow: null };
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
    for (const list of perTile.values()) {
      list.sort();
      // settlers sit below armies; count only armies and fleets in the stack
      let k = 0;
      for (const key of list) stackOf.set(key, groups.get(key)!.kind === 'settler' ? -1 : k++);
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
        };
        this.chips.set(key, chip);
      }
      chip.units = g.units;
      chip.moving = g.moving;
      chip.stack = stackOf.get(key) ?? 0;
      const color = this.colorOf(g.owner);
      const flag = g.kind === 'settler' ? null : this.flag(g.owner);
      const strength = g.units.reduce((s, u) => s + u.strength, 0);
      const texKey = g.kind === 'settler'
        ? `s|${color}`
        : `c|${g.owner}|${color}|${unitIcon(g.kind, era)}|${Math.round(strength)}|${g.units.length}|${flag ? 1 : 0}`;
      if (texKey !== chip.texKey) {
        const p = this.pal;
        const tex = g.kind === 'settler'
          ? this.acquire(texKey, () => drawSettler(color, p.ink, p.parchment))
          : this.acquire(texKey, () => drawCounter({
            color, flag, icon: unitIcon(g.kind, era), strength, count: g.units.length,
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
  }

  private dropChip(chip: Chip): void {
    this.chipGroup.remove(chip.sprite);
    chip.mat.dispose();
    if (chip.texKey) this.release(chip.texKey);
    chip.texKey = '';
  }

  private killChip(chip: Chip, now: number, shatter: boolean): void {
    chip.dying = { start: now, shatter };
    this.dying.push(chip);
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
          else this.pendingMoves.set(e.unitId, e);
          break;
        }
        case 'unit_removed':
          this.removedReason.set(e.unitId, e.reason);
          break;
        case 'battle':
          this.onBattle(e, now);
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
          if (e.patch.flag || e.patch.color) { this.flags.delete(e.countryId); this.dirty = true; }
          break;
        default:
          break;
      }
    }
  }

  private onBattle(e: Extract<WorldEvent, { type: 'battle' }>, now: number): void {
    const P = this.surf(e.tile, CHIP_LIFT, new THREE.Vector3());
    if (P.lengthSq() === 0) return;
    const n = P.clone().normalize();

    // attack arrow: turn the attacker's march arrow red, or draw one from where it stands
    const st = this.states.get(e.attackerUnit);
    if (st) {
      let arrow = st.arrow && st.arrow.busy && st.arrow.toTile === e.tile ? st.arrow : null;
      if (!arrow) {
        this.statePos(st, now, _v);
        if (_v.lengthSq() > 0 && _v.distanceTo(P) > 0.004) {
          arrow = this.takeArrow(now);
          if (arrow) {
            const a = _w.copy(_v).normalize();
            const om = Math.acos(Math.min(1, Math.max(-1, a.dot(n))));
            const width = Math.min(0.016, Math.max(0.0065, om * 0.2));
            writeArrow(arrow.geo, a.clone(), _v.length() - CHIP_LIFT + 0.003, n, this.mesh.heights[e.tile]! + 0.003, width);
            arrow.toTile = e.tile;
          }
        }
      }
      if (arrow) {
        arrow.attack = true;
        arrow.mat.uniforms.uColor!.value.copy(this.col.war);
        arrow.mat.uniforms.uLight!.value.copy(this.col.parchment);
        arrow.mat.uniforms.uSpeed!.value = 5;
        arrow.holdUntil = Math.max(arrow.holdUntil, now + 1500);
      }
    }

    this.pops.show(now, 'clash', this.clashTex, P, 0.036, 1, 1800);
    // muzzle flashes: short warm flickers over ~0.8s, then a few gilt sparks
    this.sparks.burst(now, P, 18, 0.013, this.col.flash, 200, 0.01, 750);
    this.sparks.burst(now, P, 8, 0.01, this.col.accent, 450, 0.05, 300);
    for (let i = 0; i < 6; i++) {
      tangentJitter(_j, n, 0.01);
      const start = P.clone().add(_j);
      const drift = tangentJitter(new THREE.Vector3(), n, 0.012).addScaledVector(n, 0.01);
      this.smoke.emit(now, start, drift, 0.008, 0.03, 2000, 0.75, this.col.ruin, i * 110);
    }
    const loss = (v: number, dx: number, delay: number): void => {
      if (!(v > 0)) return;
      const text = `-${Math.round(v)}`;
      let tex = this.lossTex.get(text);
      if (!tex) { tex = toTexture(drawLoss(text, this.pal.stance.war, this.pal.ink)); this.lossTex.set(text, tex); }
      this.pops.show(now, 'loss', tex, P, 0.022, 160 / 72, 1500, dx, delay);
    };
    loss(e.losses.attacker, -1.0, 250);
    loss(e.losses.defender, 1.0, 350);

    // the winner's counter hops
    const hopAt = now + 320;
    if (e.winner === e.attacker && st) st.hopAt = hopAt;
    else for (const u of this.states.values()) if (u.owner === e.winner && u.to === e.tile) u.hopAt = hopAt;
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

  update(camera: THREE.Camera, now: number): void {
    if (this.disposed) return;
    const dt = this.lastNow ? Math.min(100, now - this.lastNow) : 16;
    this.lastNow = now;
    const dist = camera.position.length();
    _camDir.copy(camera.position).normalize();
    const zoom = Math.min(1.25, Math.max(0.8, 1.25 - ((dist - 1.3) / 2.2) * 0.45));

    for (const st of this.states.values()) {
      if (st.t1 > 0 && now >= st.t1 && st.from !== st.to) { st.from = st.to; this.dirty = true; }
    }
    if (this.dirty) this.rebuildChips(now);
    for (const [c, until] of this.fallen) if (until < now) this.fallen.delete(c);

    // counters
    for (const chip of this.chips.values()) this.placeChip(chip, now, zoom);
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const chip = this.dying[i]!;
      const d = chip.dying!;
      const life = d.shatter ? 750 : 450;
      const t = (now - d.start) / life;
      if (t >= 1) { this.dropChip(chip); this.dying.splice(i, 1); continue; }
      const f = facing(chip.pos, _camDir);
      chip.sprite.visible = f > 0;
      const h = chip.height * zoom * (d.shatter ? 1 + 0.5 * t : 1 - 0.3 * t);
      chip.sprite.scale.set(h * chip.aspect, h, 1);
      chip.mat.rotation = d.shatter ? t * t * 0.9 : 0;
      chip.mat.opacity = f * (1 - t) * (d.shatter ? (Math.random() < 0.3 ? 0.4 : 1) : 1);
    }

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

    this.sparks.update(now, dt);
    this.smoke.update(now, dt);
    this.pops.update(now, _camDir, zoom);
  }

  private placeChip(chip: Chip, now: number, zoom: number): void {
    const lead = chip.moving ?? chip.units[0];
    if (!lead) { chip.sprite.visible = false; return; }
    this.statePos(lead, now, chip.pos);
    chip.sprite.position.copy(chip.pos);
    const f = facing(chip.pos, _camDir);
    chip.sprite.visible = f > 0;
    if (!f) return;
    let hop = 0;
    for (const u of chip.units) {
      const t = (now - u.hopAt) / 380;
      if (t >= 0 && t < 1) hop = Math.max(hop, Math.sin(Math.PI * t) * 0.45);
    }
    const h = chip.height * zoom;
    chip.sprite.scale.set(h * chip.aspect, h, 1);
    const stack = chip.kind === 'settler' ? 0 : Math.max(0, chip.stack);
    const base = chip.kind === 'settler' ? 0.5 : -0.18; // settlers sit on the tile, counters just above it
    chip.sprite.center.set(0.5, base - stack * 0.92 - hop);
    chip.mat.opacity = f;
  }

  dispose(): void {
    this.disposed = true;
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
    for (const f of this.flags.values()) f.img.onload = null;
    this.flags.clear();
  }
}
