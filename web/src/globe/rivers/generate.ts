// Lane b: rivers and lakes, generated from the world seed (the World carries no water data).
// Pure and cached per world id: tiles never change after generation.
import type { Tile, World } from '@terra/shared';
import { tileHeight } from '../mesh/buildProvinceMesh';

export interface River {
  id: number;
  /** Land tiles from the source downstream, in order. */
  tiles: number[];
  /** Ocean tile the river empties into, or -1. */
  mouth: number;
  /** Lake tile the river ends in, or -1. */
  lake: number;
  /** Tile where this river joins another (last entry of `tiles`), or -1. */
  joins: number;
}

export interface RiverSystem {
  worldId: string;
  rivers: River[];
  lakes: number[];
  /** Per tile: how many sources drain through it (0 = no river). */
  flow: Int32Array;
  /** Per tile: the next tile downstream, -1 if none. */
  downstream: Int32Array;
}

/** Deterministic hash of a few integers to [0, 1). */
export function hash01(...xs: number[]): number {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

const isLand = (t: Tile): boolean => t.terrain !== 'ocean';

function generate(world: World): RiverSystem {
  const tiles = world.tiles;
  const n = tiles.length;
  const seed = world.seed | 0;
  const height = new Float32Array(n);
  for (const t of tiles) height[t.id] = tileHeight(t) + t.elevation * 1e-4;

  const flow = new Int32Array(n);
  const downstream = new Int32Array(n).fill(-1);
  const lakeSet = new Set<number>();
  const rivers: River[] = [];

  // Sources: high, inland tiles, in a seeded order, spaced apart.
  // Hops from each tile to the nearest sea tile (BFS), so rivers can start far inland.
  const seaDist = new Int32Array(n).fill(-1);
  let front: number[] = [];
  for (const t of tiles) if (!isLand(t)) { seaDist[t.id] = 0; front.push(t.id); }
  while (front.length) {
    const next: number[] = [];
    for (const f of front) for (const j of tiles[f]!.neighbors) if (seaDist[j] === -1) { seaDist[j] = seaDist[f]! + 1; next.push(j); }
    front = next;
  }
  const landCount = tiles.filter(isLand).length;

  // Lakes first, so rivers can drain into them: low inland basins, spaced apart.
  const lakeTarget = Math.max(1, Math.min(4, Math.round(landCount / 80)));
  const isMin = (t: Tile): boolean => t.neighbors.every((j) => height[j]! >= height[t.id]!);
  const basins = tiles.filter((t) => isLand(t) && t.terrain !== 'ice' && t.terrain !== 'mountain' && seaDist[t.id]! >= 2);
  const lakeRank = (t: Tile): number => t.elevation + hash01(seed, t.id, 91) * 0.25 - (isMin(t) ? 0.3 : 0);
  basins.sort((a, b) => lakeRank(a) - lakeRank(b));
  for (const b of basins) {
    if (lakeSet.size >= lakeTarget) break;
    if (b.neighbors.some((j) => lakeSet.has(j) || tiles[j]!.neighbors.some((k) => lakeSet.has(k)))) continue;
    lakeSet.add(b.id);
  }

  const high = (t: Tile): boolean => t.elevation > 0.6 || t.terrain === 'mountain' || t.terrain === 'hills';
  const candidates = tiles.filter((t) => isLand(t) && t.terrain !== 'ice' && seaDist[t.id]! >= 2 && !lakeSet.has(t.id)
    && t.elevation > 0.35);
  // Seeded order: highlands first, then far from the sea (longer rivers).
  const rank = (t: Tile): number => hash01(seed, t.id, 17) - 0.18 * Math.min(6, seaDist[t.id]!) - (high(t) ? 1 : 0);
  candidates.sort((a, b) => rank(a) - rank(b));
  const target = Math.max(4, Math.min(16, Math.round(landCount / 16)));
  const blocked = new Uint8Array(n);
  const block = (id: number, rings: number): void => {
    let front = [id];
    blocked[id] = 1;
    for (let r = 0; r < rings; r++) {
      const next: number[] = [];
      for (const f of front) for (const j of tiles[f]!.neighbors) if (!blocked[j]) { blocked[j] = 1; next.push(j); }
      front = next;
    }
  };

  for (const src of candidates) {
    if (rivers.length >= target) break;
    if (blocked[src.id] || flow[src.id]! > 0) continue;
    const path = [src.id];
    const onPath = new Set(path);
    let mouth = -1, lake = -1, joins = -1;
    for (let guard = 0; guard < 80; guard++) {
      const cur = path[path.length - 1]!;
      const t = tiles[cur]!;
      // Reached the sea: empty into the lowest ocean neighbour.
      const sea = t.neighbors.filter((j) => !isLand(tiles[j]!));
      if (sea.length > 0) { mouth = sea.reduce((a, b) => (hash01(seed, cur, a) < hash01(seed, cur, b) ? a : b)); break; }
      // Descend: of the lower neighbours, take the one that keeps furthest from the sea
      // (a long valley rather than a plunge), then the steepest.
      let best = -1, bestD = -1, bestH = height[cur]!;
      for (const j of t.neighbors) {
        if (onPath.has(j) || height[j]! >= height[cur]!) continue;
        const d = Math.min(seaDist[j]!, seaDist[cur]!);
        if (d > bestD || (d === bestD && height[j]! < bestH)) { bestD = d; bestH = height[j]!; best = j; }
      }
      if (best < 0) { lake = cur; break; }
      if (flow[best]! > 0 || lakeSet.has(best)) { path.push(best); joins = lakeSet.has(best) ? -1 : best; if (lakeSet.has(best)) lake = best; break; }
      path.push(best);
      onPath.add(best);
    }
    // Too short to read as a river: drop it.
    if (path.length < 3) continue;
    if (lake >= 0) lakeSet.add(lake);
    const id = rivers.length;
    rivers.push({ id, tiles: path, mouth, lake, joins });
    // Accumulate flow: own tiles, then everything downstream of the join.
    const own = joins >= 0 ? path.length - 1 : path.length;
    for (let i = 0; i < own; i++) {
      flow[path[i]!] = flow[path[i]!]! + 1;
      if (i + 1 < path.length) downstream[path[i]!] = path[i + 1]!;
    }
    if (joins >= 0) {
      let c = joins, guard = 0;
      while (c >= 0 && guard++ < 200) { flow[c] = flow[c]! + 1; c = downstream[c]!; }
    }
    for (const id2 of path) block(id2, 0);
    block(src.id, 1);
  }

  return { worldId: world.id, rivers, lakes: [...lakeSet], flow, downstream };
}

const cache = new Map<string, RiverSystem>();

/** Rivers and lakes of a world: deterministic from the seed, cached per world id. */
export function riversOf(world: World): RiverSystem {
  const key = `${world.id}:${world.seed}:${world.tiles.length}`;
  let s = cache.get(key);
  if (!s) {
    s = generate(world);
    if (cache.size > 8) cache.clear();
    cache.set(key, s);
  }
  return s;
}

/** True when a tile has a river through it or borders a lake (handy for placing cities). */
export function isRiverside(sys: RiverSystem, world: World, tile: number): boolean {
  if (sys.flow[tile]! > 0) return true;
  return world.tiles[tile]!.neighbors.some((j) => sys.flow[j]! > 0 || sys.lakes.includes(j));
}
