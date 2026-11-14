// The strategic map (row A32, #203), headless: terrain-aware paths and zone of control.
// 1. Paths: on a generated world, for many start and goal pairs, the march path (Dijkstra over terrain
//    move) is the cheapest one, and it never crosses a mountain when a route round the mountains is
//    cheaper (ties go by tile id). Also counts how often the old unweighted BFS would have climbed a
//    mountain that Dijkstra goes round.
// 2. Zone of control: a mock run where every army move the true world applied is checked against the
//    world just before it: the step is to a neighbour, and from a ZOC tile it is an attack or a step back
//    onto the army's own land. Prints battles, wars and conquests per run.
// Run from the repo root:  npx tsx server/scripts/check-paths.ts [ticks] [seed]
import { applyEvent, chokepoints, cloneWorld, costTo, inZoc, moveCost, pathFrom, type World, type WorldEvent } from '@terra/shared';
import { EngineRunner } from '../src/engine/runner';
import { forceMockMode } from '../src/llm';
import { DEMO_PROMPT } from './record-demo';

forceMockMode(true);
const ticks = Number(process.argv[2] ?? 600);
const seed = Number(process.argv[3] ?? 1337);
const runner = new EngineRunner();
const batches: WorldEvent[][] = [];
runner.subscribe({ events: (e) => batches.push(e) });
await runner.newWorld({ prompt: DEMO_PROMPT, seed });
runner.stop();
const w0 = runner.getWorld()!;
const tiles = w0.tiles;
let failures = 0;
const fail = (msg: string): void => { failures++; if (failures <= 10) console.log(`FAIL ${msg}`); };

// ---- 1. paths --------------------------------------------------------------------------------
const land = (t: number): boolean => tiles[t]!.terrain !== 'ocean';
const lowland = (t: number): boolean => land(t) && tiles[t]!.terrain !== 'mountain';
const landTiles = tiles.map((_, i) => i).filter(land);
const mountains = landTiles.filter((t) => tiles[t]!.terrain === 'mountain').length;
const pick = (k: number): number => landTiles[(Math.imul(k + 1, 2654435761) >>> 0) % landTiles.length]!;
const bfsPath = (from: number, goal: number): number[] => {
  const prev = new Map<number, number>([[goal, -1]]);
  const q = [goal];
  for (let h = 0; h < q.length && !prev.has(from); h++) {
    for (const j of [...tiles[q[h]!]!.neighbors].sort((a, b) => a - b)) if (!prev.has(j) && land(j)) { prev.set(j, q[h]!); q.push(j); }
  }
  const out: number[] = [];
  for (let at = prev.get(from); at !== undefined && at >= 0; at = prev.get(at)) out.push(at);
  return out;
};
let pairs = 0, viaMountain = 0, bfsClimbs = 0, avoided = 0;
for (let k = 0; k < 400; k++) {
  const from = pick(2 * k), goal = pick(2 * k + 1);
  if (from === goal) continue;
  const dist = costTo(tiles, [goal], land, 10_000);
  if (!dist.has(from)) continue;
  pairs++;
  const path = pathFrom(tiles, dist, from);
  const cost = path.reduce((s, t) => s + moveCost(tiles, t), 0);
  if (path[path.length - 1] !== goal || cost !== dist.get(from)) fail(`path ${from}->${goal} is not the cheapest (${cost} vs ${dist.get(from)})`);
  const climbs = path.slice(0, -1).some((t) => tiles[t]!.terrain === 'mountain');
  if (climbs) {
    viaMountain++;
    const round = costTo(tiles, [goal], (t) => lowland(t) || t === from, 10_000).get(from);
    if (round !== undefined && round < cost) fail(`path ${from}->${goal} climbs a mountain though a route round is cheaper (${round} < ${cost})`);
  }
  const old = bfsPath(from, goal);
  if (old.slice(0, -1).some((t) => tiles[t]!.terrain === 'mountain')) {
    bfsClimbs++;
    if (!climbs) avoided++;
  }
}
console.log(`paths: ${pairs} pairs on ${landTiles.length} land tiles (${mountains} mountains); Dijkstra climbs a mountain on ${viaMountain} (each one the only cheapest way), the old BFS on ${bfsClimbs}; ${avoided} of those now go round`);

// ---- 2. zone of control, on a mock run -------------------------------------------------------
let shadow: World = cloneWorld(w0);
let armyMoves = 0, fromZoc = 0, zocAttacks = 0, zocRetreats = 0, battles = 0, wars = 0, conquests = 0, falls = 0;
const t0 = performance.now();
for (let t = 0; t < ticks; t++) {
  batches.length = 0;
  runner.advance(1);
  const attackers = new Set<string>();
  for (const e of batches.flat()) {
    if (e.type === 'battle') { battles++; attackers.add(`${e.attackerUnit}:${e.tick}`); }
    else if (e.type === 'relation_changed' && e.stance === 'war') wars++;
    else if (e.type === 'tile_claimed' && e.cause === 'conquest' && e.from >= 0 && e.owner >= 0) conquests++;
    else if (e.type === 'country_fell') falls++;
    else if (e.type === 'unit_moved') {
      const u = shadow.units.find((x) => x.id === e.unitId);
      if (u && u.kind === 'army') {
        armyMoves++;
        if (!tiles[u.tile]!.neighbors.includes(e.to)) fail(`army ${u.id} jumps from ${u.tile} to ${e.to}, not a neighbour (tick ${e.tick})`);
        if (inZoc(shadow, u.owner, u.tile)) {
          fromZoc++;
          if (attackers.has(`${u.id}:${e.tick}`)) zocAttacks++;
          else if (shadow.owner[e.to] === u.owner) zocRetreats++;
          else fail(`army ${u.id} of ${u.owner} slips out of a zone of control at ${u.tile} to ${e.to} (tick ${e.tick})`);
        }
      }
    }
    applyEvent(shadow, e);
  }
  // Keep the shadow honest: it must hold the same units as the true world.
  if (t % 50 === 49) {
    const truth = runner.getWorld()!;
    if (JSON.stringify(truth.units) !== JSON.stringify(shadow.units)) { fail(`shadow drifted at tick ${truth.tick}`); shadow = cloneWorld(truth); }
  }
}
console.log(`run: seed ${seed}, ${ticks} ticks in ${(performance.now() - t0).toFixed(0)} ms; battles ${battles}, wars ${wars}, conquests ${conquests}, falls ${falls}`);
console.log(`zone of control: ${armyMoves} army moves, ${fromZoc} from a ZOC tile (${zocAttacks} attacks, ${zocRetreats} back onto own land)`);
// Chokepoint forts: how many of the forts standing now sit on a chokepoint of their nation (against its neighbours).
const end = runner.getWorld()!;
let forts = 0, onChoke = 0;
for (const c of end.countries) {
  if (!c.alive) continue;
  const mine = end.structures.filter((x) => x.owner === c.id && x.kind === 'fort' && end.owner[x.tile] === c.id);
  if (!mine.length) continue;
  const near = new Set<number>();
  for (let i = 0; i < end.owner.length; i++) {
    if (end.owner[i] !== c.id) continue;
    for (const j of tiles[i]!.neighbors) if (end.owner[j]! >= 0 && end.owner[j] !== c.id) near.add(end.owner[j]!);
  }
  const hearts = [c.capitalTile, ...end.structures.filter((x) => x.owner === c.id && x.kind === 'city').map((x) => x.tile)];
  const choke = new Set(chokepoints(tiles, end.owner, c.id, hearts, near));
  forts += mine.length;
  onChoke += mine.filter((x) => choke.has(x.tile) || tiles[x.tile]!.neighbors.some((j) => choke.has(j))).length;
}
console.log(`forts: ${forts} standing, ${onChoke} on or next to a chokepoint of the road to their nation's heart (as the map stands now)`);
console.log(failures ? `PATHS CHECK FAILED (${failures} failures)` : 'PATHS OK: cheapest terrain paths, round mountains when it pays, and no army slips out of a zone of control');
process.exit(failures ? 1 : 0);
