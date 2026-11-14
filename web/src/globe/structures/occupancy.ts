// Per-tile occupancy shared by the building layers, so nothing is drawn inside anything else. The structure
// layer publishes the square footprint of every model it places (the settlement's landmark, the buildings round
// a city, its props); the close-up towns leave those squares free of houses, yards and walls. Written only when
// a structure is added, rebuilt or removed, never per frame. Lane b.

/** A square footprint on a tile, in the tile's tangent coordinates (t1, t2) in world units. */
export interface Foot {
  a: number; b: number;   // centre
  half: number;           // half the side
  ax: number; ay: number; // the square's x axis, as a unit vector in (t1, t2)
}

const byTile = new Map<number, Map<string, Foot[]>>();
const version = new Map<number, number>();
const listeners = new Set<(tile: number) => void>();
const EMPTY: Foot[] = [];

const same = (x: Foot[] | undefined, y: Foot[]): boolean => {
  if (!x || x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    const p = x[i]!, q = y[i]!;
    if (Math.abs(p.a - q.a) > 1e-6 || Math.abs(p.b - q.b) > 1e-6 || Math.abs(p.half - q.half) > 1e-6
      || Math.abs(p.ax - q.ax) > 1e-4 || Math.abs(p.ay - q.ay) > 1e-4) return false;
  }
  return true;
};

/** Set (or with null, clear) the footprints one structure holds on a tile. Unchanged values cost nothing. */
export function setFeet(tile: number, id: string, feet: Foot[] | null): void {
  let m = byTile.get(tile);
  if (!feet || !feet.length) {
    if (!m?.delete(id)) return;
    if (!m.size) byTile.delete(tile);
  } else {
    if (same(m?.get(id), feet)) return;
    if (!m) { m = new Map(); byTile.set(tile, m); }
    m.set(id, feet);
  }
  version.set(tile, (version.get(tile) ?? 0) + 1);
  for (const l of listeners) l(tile);
}

/** Every footprint on a tile. */
export function feetOn(tile: number): Foot[] {
  const m = byTile.get(tile);
  if (!m) return EMPTY;
  const out: Foot[] = [];
  for (const f of m.values()) out.push(...f);
  return out;
}

/** Bumped whenever a tile's footprints change (part of a town's rebuild key). */
export const occupancyVersion = (tile: number): number => version.get(tile) ?? 0;

/** True when the point (a, b) with a margin of `m` falls inside any of the squares. */
export function inFeet(feet: Foot[], a: number, b: number, m: number): boolean {
  for (const f of feet) {
    const du = a - f.a, dv = b - f.b;
    const u = du * f.ax + dv * f.ay, v = -du * f.ay + dv * f.ax;
    const r = f.half + m;
    if (u > -r && u < r && v > -r && v < r) return true;
  }
  return false;
}

/** Forget everything (a new world). */
export function clearOccupancy(): void {
  const tiles = [...byTile.keys()];
  byTile.clear();
  for (const t of tiles) { version.set(t, (version.get(t) ?? 0) + 1); for (const l of listeners) l(t); }
}

export function onOccupancy(l: (tile: number) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
