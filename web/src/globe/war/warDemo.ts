// Dev only: window.__warDemo() stages about eighteen seconds of war on a real border, for a demo
// recording. It frames the border between two neighbouring nations (at war if any are) at mid zoom,
// marches an army of each side up to it, fires a run of battles across the front (the real event path:
// WarFx bursts, UnitLayer clash badges and facing formations), mixes in bursts of every age, lets the
// front smoke with devastation, and ends with a settlement on the far side falling to ruin when it is
// taken. Everything happens in this browser only; the server never hears of it. Lane b.
import * as THREE from 'three';
import { applyEvent } from '@terra/shared';
import type { World, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';
import { groundView } from '../camera/groundView';

const CAM_D = 1.5;         // the orbit pose handed back at the end (above the ground-view tilt)
const SETTLE_MS = 1600;    // the opening drift before the first shot
const SHOT_H = 0.17;       // the demo camera: height over the front ...
const SHOT_BACK = 0.26;    // ... and how far back from it, so it looks across the front at a slant
const SHOT_TURN = 0.35;    // rad the camera circles the front over the whole demo
const SHOT_MS = 18500;

/** The scripted shot while a demo runs (world space), applied each frame by applyWarDemoCamera. */
let shot: null | { centre: THREE.Vector3; up: THREE.Vector3; back: THREE.Vector3; t0: number } = null;
const _e = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();

/** Called from WarFx after the controls have posed the camera: holds the oblique demo shot. */
export function applyWarDemoCamera(camera: THREE.Camera, now: number): void {
  if (!shot) return;
  const cc = (window as unknown as { __cam?: { enabled: boolean; setLookAt: (...a: (number | boolean)[]) => unknown } }).__cam;
  const k = (now - shot.t0) / SHOT_MS;
  if (k >= 1) {
    const back = shot.centre.clone().setLength(CAM_D);
    shot = null;
    if (cc) { cc.enabled = true; cc.setLookAt(back.x, back.y, back.z, 0, 0, 0, true); }
    return;
  }
  if (cc) cc.enabled = false;
  _b.copy(shot.back).applyAxisAngle(shot.up, (k - 0.5) * SHOT_TURN);
  // ease in from a higher, wider view during the first two seconds
  const lift = 1 + 0.9 * Math.max(0, 1 - (now - shot.t0) / 2200) ** 2;
  _e.copy(shot.centre).addScaledVector(shot.up, SHOT_H * lift).addScaledVector(_b, SHOT_BACK * lift);
  camera.position.copy(_e);
  camera.quaternion.setFromRotationMatrix(_m.lookAt(_e, shot.centre, shot.up));
  camera.updateMatrixWorld();
  groundView.height = _e.length() - 1.02;   // the clouds part round a low camera: tell them how low this one is
}
const SETTLEMENTS = new Set(['town', 'city', 'capital']);

export interface WarDemoResult { a: string; b: string; tiles: number }

interface Front { a: number; b: number; sideA: number[]; sideB: number[]; seam?: [number, number] }

/** Two neighbouring nations and the tiles each holds along their shared border. */
function findFront(w: World): Front | null {
  const atWar = new Set(w.relations.filter((r) => r.stance === 'war').map((r) => `${r.a}:${r.b}`));
  const pairs = new Map<string, { a: number; b: number; sideA: Set<number>; sideB: Set<number> }>();
  for (const t of w.tiles) {
    const o = w.owner[t.id] ?? -1;
    if (o < 0 || t.terrain === 'ocean') continue;
    for (const nb of t.neighbors) {
      const p = w.owner[nb] ?? -1;
      if (p < 0 || p === o || w.tiles[nb]?.terrain === 'ocean') continue;
      const a = Math.min(o, p), b = Math.max(o, p);
      const k = `${a}:${b}`;
      let e = pairs.get(k);
      if (!e) { e = { a, b, sideA: new Set(), sideB: new Set() }; pairs.set(k, e); }
      (o === a ? e.sideA : e.sideB).add(t.id);
    }
  }
  let best: Front | null = null, score = -1;
  for (const [k, e] of pairs) {
    if (!w.countries[e.a]?.alive || !w.countries[e.b]?.alive) continue;
    const s = Math.min(e.sideA.size, e.sideB.size, 8) + (atWar.has(k) ? 100 : 0);
    if (s > score) { score = s; best = { a: e.a, b: e.b, sideA: [...e.sideA], sideB: [...e.sideB] }; }
  }
  if (best) return best;
  // young worlds: no two nations touch yet, so take the two whose land comes closest
  const land = w.tiles.filter((t) => (w.owner[t.id] ?? -1) >= 0 && w.countries[w.owner[t.id]!]?.alive && t.terrain !== 'ocean');
  const v = new THREE.Vector3(), u = new THREE.Vector3();
  let gap = Infinity, pa = -1, pb = -1;
  for (let i = 0; i < land.length; i++) {
    v.set(...land[i]!.center).normalize();
    for (let j = i + 1; j < land.length; j++) {
      if (w.owner[land[i]!.id] === w.owner[land[j]!.id]) continue;
      const d = v.distanceToSquared(u.set(...land[j]!.center).normalize());
      if (d < gap) { gap = d; pa = land[i]!.id; pb = land[j]!.id; }
    }
  }
  if (pa < 0) return null;
  const oa = w.owner[pa]!, ob = w.owner[pb]!;
  const a = Math.min(oa, ob), b = Math.max(oa, ob);
  return { a, b, sideA: land.filter((t) => w.owner[t.id] === a).map((t) => t.id), sideB: land.filter((t) => w.owner[t.id] === b).map((t) => t.id), seam: oa === a ? [pa, pb] : [pb, pa] };
}

/** Keep the front compact: the tiles nearest the one in the middle of the border. */
function compact(w: World, tiles: number[], centre: THREE.Vector3, n: number): number[] {
  const v = new THREE.Vector3();
  return tiles
    .map((t) => ({ t, d: v.set(...w.tiles[t]!.center).normalize().distanceTo(centre) }))
    .sort((x, y) => x.d - y.d).slice(0, n).map((x) => x.t);
}

export function installWarDemo(globe: THREE.Object3D): () => void {
  const win = window as unknown as {
    __warDemo?: () => WarDemoResult | null;
    __warFx?: (tile: number, age?: number) => void;
    __cam?: { setLookAt: (...a: (number | boolean)[]) => unknown };
  };
  let timers: number[] = [];
  let seq = 0;
  win.__warDemo = () => {
    const s0 = useWorld.getState();
    const w = s0.world;
    if (!w) return null;
    const front = findFront(w);
    if (!front || !front.sideA.length || !front.sideB.length) return null;
    for (const t of timers) window.clearTimeout(t);
    timers = [];

    const mid = new THREE.Vector3();
    for (const t of front.seam ?? [...front.sideA, ...front.sideB]) mid.add(new THREE.Vector3(...w.tiles[t]!.center).normalize());
    mid.normalize();
    const A = compact(w, front.sideA, mid, 4);
    const B = compact(w, front.sideB, mid, 4);
    const all = [...A, ...B];

    // the camera straight above the middle of the front (the globe group may be rotated)
    globe.updateWorldMatrix(true, false);
    const up = globe.localToWorld(mid.clone()).sub(globe.localToWorld(new THREE.Vector3())).normalize();
    const centre = up.clone().multiplyScalar(1.02).add(globe.localToWorld(new THREE.Vector3()));
    // look across the front: stand back along the line from b's side to a's side
    const ca = new THREE.Vector3(), cb = new THREE.Vector3();
    for (const t of A) ca.add(globe.localToWorld(new THREE.Vector3(...w.tiles[t]!.center)));
    for (const t of B) cb.add(globe.localToWorld(new THREE.Vector3(...w.tiles[t]!.center)));
    const across = ca.sub(cb);
    const side = across.addScaledVector(up, -across.dot(up));
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0).addScaledVector(up, -up.x);
    side.normalize();
    // the camera stands beside the line, so both sides show left and right of the front
    const back = new THREE.Vector3().crossVectors(up, side).normalize();
    shot = { centre, up, back, t0: performance.now() };

    // local events through the same path the server's take (applyEvent, then the event stream)
    const emit = (evs: Array<Record<string, unknown>>) => {
      const s = useWorld.getState();
      const world = s.world;
      if (!world || world.id !== w.id) return;
      const full = evs.map((e) => ({ id: `war-demo-${++seq}-${Date.now()}`, tick: world.tick, actor: 'world', lamport: 0, ...e }) as WorldEvent);
      for (const e of full) applyEvent(world, e);
      useWorld.setState({ version: s.version + 1, recentEvents: [...s.recentEvents, ...full].slice(-200) });
    };
    const devastate = (tiles: number[], v: number) => {
      const world = useWorld.getState().world;
      if (!world || world.id !== w.id) return;
      if (!world.devastation) world.devastation = world.tiles.map(() => 0);
      for (const t of tiles) world.devastation[t] = Math.max(world.devastation[t] ?? 0, v);
      useWorld.setState({ version: useWorld.getState().version + 1 });
    };
    const at = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, SETTLE_MS + ms)); };

    // the armies: two of each side, on their own side of the border
    const tag = Date.now().toString(36);
    const armies = [
      { id: `demo-${tag}-a0`, owner: front.a, tile: A[0]! }, { id: `demo-${tag}-a1`, owner: front.a, tile: A[1] ?? A[0]! },
      { id: `demo-${tag}-b0`, owner: front.b, tile: B[0]! }, { id: `demo-${tag}-b1`, owner: front.b, tile: B[1] ?? B[0]! },
    ];
    at(0, () => {
      emit([{ type: 'relation_changed', a: front.a, b: front.b, stance: 'war', reason: 'border clash' }]);
      emit(armies.map((u) => ({ type: 'unit_spawned', unit: { id: u.id, owner: u.owner, kind: 'army', tile: u.tile, strength: 60 } })));
    });

    // a run of battles across the front, alternating who attacks, with the nations' own ages
    const battle = (attacker: (typeof armies)[number], tile: number, defender: number) => emit([{
      type: 'battle', tile, attacker: attacker.owner, defender, attackerUnit: attacker.id,
      winner: attacker.owner, losses: { attacker: 3, defender: 5 },
    }]);
    at(900, () => battle(armies[0]!, B[0]!, front.b));
    at(1900, () => battle(armies[2]!, A[0]!, front.a));
    at(2700, () => battle(armies[1]!, B[1] ?? B[0]!, front.b));
    at(3500, () => battle(armies[3]!, A[1] ?? A[0]!, front.a));

    // the front starts to smoke
    at(3000, () => devastate(all, 48));

    // bursts of every age along the front, for variety: melee dust, musket volleys, shells
    const ages = [0, 1, 2, 3, 4, 5, 2, 4, 5, 3];
    ages.forEach((age, i) => at(4400 + i * 650, () => win.__warFx?.(all[(i * 3) % all.length]!, age)));

    // the fall: a settlement on b's side (or the nearest b tile) is taken by a and falls to ruin
    const town = w.structures.find((s) => SETTLEMENTS.has(s.kind) && s.owner === front.b && B.includes(s.tile))
      ?? w.structures.find((s) => SETTLEMENTS.has(s.kind) && s.owner === front.b && front.sideB.includes(s.tile));
    const fallTile = town?.tile ?? B[2] ?? B[0]!;
    at(10000, () => {
      emit([{ type: 'unit_moved', unitId: armies[0]!.id, from: armies[0]!.tile, to: fallTile, arriveTick: w.tick + 1 }]);
    });
    at(11000, () => {
      battle(armies[0]!, fallTile, front.b);
      win.__warFx?.(fallTile, 5);
    });
    at(12200, () => {
      devastate([fallTile], 90);
      emit([{ type: 'tile_claimed', tile: fallTile, owner: front.a, from: front.b, cause: 'conquest' }]);
    });
    at(13000, () => win.__warFx?.(fallTile, 4));

    return { a: w.countries[front.a]?.name ?? `#${front.a}`, b: w.countries[front.b]?.name ?? `#${front.b}`, tiles: all.length };
  };
  return () => {
    for (const t of timers) window.clearTimeout(t);
    delete win.__warDemo;
  };
}
