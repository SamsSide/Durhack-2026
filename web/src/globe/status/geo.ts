// Positions for the status layers. Lane b (B7).
import type { World } from '@terra/shared';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';

export type P3 = [number, number, number];

/** Lift a surface point a little off the ground, along its own normal. */
export function liftPoint(p: P3, extra: number): P3 {
  const len = Math.hypot(p[0], p[1], p[2]) || 1;
  const k = (len + extra) / len;
  return [p[0] * k, p[1] * k, p[2] * k];
}

/** Where a nation's capital dot sits (falls back to the middle of its land). */
export function capitalPoint(mesh: ProvinceMesh, world: World, countryId: number, extra = 0.006): P3 | null {
  const c = world.countries[countryId];
  if (!c) return null;
  let tiles: number[] = [];
  if (c.capitalTile != null && world.tiles[c.capitalTile]) tiles = [c.capitalTile];
  else for (let t = 0; t < world.owner.length; t++) if (world.owner[t] === countryId) tiles.push(t);
  if (tiles.length === 0) return null;
  return liftPoint(mesh.centroidOf(tiles), extra);
}
