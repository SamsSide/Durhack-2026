// The strategic map (row A32, #203): terrain-aware paths, zone of control and chokepoints. All pure and
// deterministic: Dijkstra over TERRAIN_EFFECTS[t].move with ties broken by tile id, so every replica and
// every rerun finds the same paths. Nothing here emits events; marchTurn, settleMove and the fort step use it.
import type { Tile, World } from '../types';
import { relationOf } from '../world';
import { TERRAIN_EFFECTS } from './terrain';

/** Years to enter a tile (the same number arriveTick uses). */
export const moveCost = (tiles: Tile[], t: number): number => TERRAIN_EFFECTS[tiles[t]!.terrain].move;

/** A binary min-heap of (cost, tile), ordered by cost then tile id, so pops are canonical. */
class Heap {
  private c: number[] = [];
  private t: number[] = [];
  get size(): number { return this.c.length; }
  private less(i: number, j: number): boolean { return this.c[i]! < this.c[j]! || (this.c[i] === this.c[j] && this.t[i]! < this.t[j]!); }
  private swap(i: number, j: number): void {
    [this.c[i], this.c[j]] = [this.c[j]!, this.c[i]!];
    [this.t[i], this.t[j]] = [this.t[j]!, this.t[i]!];
  }
  push(cost: number, tile: number): void {
    this.c.push(cost); this.t.push(tile);
    let i = this.c.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(i, p)) break; this.swap(i, p); i = p; }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.c[0]!, this.t[0]!];
    const lc = this.c.pop()!, lt = this.t.pop()!;
    if (this.c.length) {
      this.c[0] = lc; this.t[0] = lt;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.c.length && this.less(l, m)) m = l;
        if (r < this.c.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
}

// A small memo: the same inputs give the same distances, so a nation whose frontier has not changed
// since its last turn reuses them (the cache is keyed by the inputs themselves, so it can never be stale).
// Keyed first by the world's tile array (shared by every replica of one world, never changed after generation).
const MEMO = new WeakMap<Tile[], Map<string, Map<number, number>>>();
const MEMO_MAX = 512;

/**
 * Cost from every reachable tile to the nearest goal, walking only over `passable` tiles (goals are
 * always allowed). Stepping into a tile costs its move. Tiles in `stop` (zone of control) can be reached
 * but never walked through, so a path ends at the first one. `limit` caps the cost searched.
 * `key`, when given, names the inputs exactly (passable and stop included) and turns on the memo.
 */
export function costTo(
  tiles: Tile[], goals: number[], passable: (t: number) => boolean, limit = 120,
  stop?: Set<number>, key?: string,
): Map<number, number> {
  let memo = key ? MEMO.get(tiles) : undefined;
  if (key && !memo) { memo = new Map(); MEMO.set(tiles, memo); }
  if (key) { const hit = memo!.get(key); if (hit) return hit; }
  const dist = new Map<number, number>();
  const heap = new Heap();
  for (const g of [...new Set(goals)].sort((a, b) => a - b)) { dist.set(g, 0); heap.push(0, g); }
  while (heap.size) {
    const [d, x] = heap.pop();
    if (d > (dist.get(x) ?? Infinity) || d >= limit) continue;
    // From a ZOC tile an army may not walk on, so nothing is reached through it (goals are where it ends).
    if (stop?.has(x) && d > 0) continue;
    const step = moveCost(tiles, x);                // a neighbour y steps into x: it pays x's move
    for (const y of tiles[x]!.neighbors) {
      if (!passable(y)) continue;
      const nd = d + step;
      if (nd < (dist.get(y) ?? Infinity)) { dist.set(y, nd); heap.push(nd, y); }
    }
  }
  if (memo && key) {
    if (memo.size >= MEMO_MAX) memo.clear();
    memo.set(key, dist);
  }
  return dist;
}

/**
 * The next tile on the cheapest path from `from` towards the goals of `dist`: the neighbour that
 * minimises move + remaining cost, ties broken by the lower tile id. -1 if there is none.
 */
export function nextStep(tiles: Tile[], dist: Map<number, number>, from: number): number {
  const here = dist.get(from);
  if (here === undefined || here === 0) return -1;
  let best = -1, bestCost = Infinity;
  for (const j of tiles[from]!.neighbors) {
    const r = dist.get(j);
    if (r === undefined) continue;
    const c = moveCost(tiles, j) + r;
    if (c < bestCost || (c === bestCost && j < best)) { bestCost = c; best = j; }
  }
  return best >= 0 && bestCost <= here ? best : -1;
}

/** The whole cheapest path from `from` to a goal (from excluded), by nextStep. */
export function pathFrom(tiles: Tile[], dist: Map<number, number>, from: number, max = 200): number[] {
  const out: number[] = [];
  let at = from;
  for (let k = 0; k < max; k++) {
    const n = nextStep(tiles, dist, at);
    if (n < 0) break;
    out.push(n); at = n;
  }
  return out;
}

/** A short signature of an array of numbers (two 32-bit hashes and the length), for memo keys. */
export function sig(a: ArrayLike<number>): string {
  let h = 0x811c9dc5, k = 0x9e3779b9;
  for (let i = 0; i < a.length; i++) {
    const v = (a[i]! + 2) & 0xffff;
    h ^= v; h = Math.imul(h, 0x01000193) >>> 0;
    k = (Math.imul(k ^ (v + i), 0x85ebca6b) + 0x7f4a7c15) >>> 0; k ^= k >>> 13;
  }
  return `${h.toString(36)}.${k.toString(36)}:${a.length}`;
}

// ---- zone of control -------------------------------------------------------------------------

const ZOC_KINDS = new Set(['fort', 'city', 'capital']);

/**
 * Land tiles in `me`'s zone of control by its enemies: next to an enemy army on land, or to an enemy
 * fort, city or capital standing in its owner's own province. An army of `me` that enters one stops: its
 * next move can only be an attack on an enemy-held neighbour, or a step back onto its own land.
 */
export function zocTiles(world: World, me: number, enemies: Set<number>, owner: ArrayLike<number> = world.owner): Set<number> {
  const out = new Set<number>();
  if (!enemies.size) return out;
  const mark = (t: number): void => {
    for (const j of world.tiles[t]!.neighbors) if (world.tiles[j]!.terrain !== 'ocean') out.add(j);
  };
  for (const u of world.units) {
    if (u.kind === 'army' && u.tile >= 0 && enemies.has(u.owner) && world.tiles[u.tile]!.terrain !== 'ocean') mark(u.tile);
  }
  for (const s of world.structures) {
    if (ZOC_KINDS.has(s.kind) && enemies.has(s.owner) && owner[s.tile] === s.owner) mark(s.tile);
  }
  return out;
}

/** Whether `tile` is in a zone of control for nation `me` (one tile, no set built). */
export function inZoc(world: World, me: number, tile: number): boolean {
  if (tile < 0 || !world.tiles[tile] || world.tiles[tile]!.terrain === 'ocean') return false;
  const war = (o: number): boolean => o >= 0 && o !== me && !!world.countries[o]?.alive && relationOf(world, me, o).stance === 'war';
  const near = new Set(world.tiles[tile]!.neighbors);
  for (const u of world.units) {
    if (u.kind === 'army' && near.has(u.tile) && world.tiles[u.tile]!.terrain !== 'ocean' && war(u.owner)) return true;
  }
  for (const s of world.structures) {
    if (ZOC_KINDS.has(s.kind) && near.has(s.tile) && world.owner[s.tile] === s.owner && war(s.owner)) return true;
  }
  return false;
}

// ---- chokepoints -----------------------------------------------------------------------------

/**
 * Where a nation should put its forts first: the provinces of its own land that the most cheapest
 * enemy paths to its capital and largest cities run through. Every own tile next to a foe's land is an
 * entry; from each, the one cheapest path (Dijkstra over move, ties by tile id) is traced to the nearest
 * heart, and every tile on it gets a count. Returns own tiles with a count of 2 or more (or the single
 * busiest one), busiest first, then nearest the border, then by tile id. Hearts themselves are left out.
 */
export function chokepoints(tiles: Tile[], owner: ArrayLike<number>, me: number, hearts: number[], foes: Set<number>): number[] {
  const goals = hearts.filter((h) => owner[h] === me);
  if (!goals.length || !foes.size) return [];
  const mine = (t: number): boolean => owner[t] === me && tiles[t]!.terrain !== 'ocean';
  const dist = costTo(tiles, goals, mine, 400);
  const count = new Map<number, number>();
  const depth = new Map<number, number>();
  for (let t = 0; t < owner.length; t++) {
    if (!mine(t) || !tiles[t]!.neighbors.some((j) => foes.has(owner[j]!) && tiles[j]!.terrain !== 'ocean')) continue;
    if (!dist.has(t)) continue;
    const path = [t, ...pathFrom(tiles, dist, t)];
    path.forEach((x, i) => {
      count.set(x, (count.get(x) ?? 0) + 1);
      depth.set(x, Math.min(depth.get(x) ?? Infinity, i));
    });
  }
  const heart = new Set(goals);
  const ranked = [...count].filter(([t]) => !heart.has(t))
    .sort((a, b) => (b[1] - a[1]) || (depth.get(a[0])! - depth.get(b[0])!) || (a[0] - b[0]));
  const busy = ranked.filter(([, n]) => n >= 2);
  return (busy.length ? busy : ranked.slice(0, 1)).map(([t]) => t);
}
