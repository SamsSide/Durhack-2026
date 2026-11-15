// One column of markers per city (#332): every HTML marker pinned over a capital (council pips and badges,
// battle plate, ruler scroll, decree caption, autopilot mark) registers here with its tile and a priority,
// and markers on the same tile stack upward in priority order with a small gap, so they never overlap.
// Heights are measured by the Anchor (layout size times the marker's own CSS scale). Lane b.

/** Bottom to top. Lower numbers sit nearer the city. */
export const STACK = {
  auto: 5,      // the small A of a nation on autopilot
  pips: 10,     // ruler and general
  council: 20,  // the newest of mourning banner, succession seal, coup mark
  battle: 30,   // the battle plate (#311)
  scroll: 50,   // a ruler's proclamation
  decree: 60,   // a decree's result caption
} as const;

export interface StackSpec {
  tile: number;      // the city key: its tile index (a nation with no capital tile uses -1 - countryId)
  priority: number;  // see STACK
  scale?: number;    // a CSS scale on the marker that its layout size does not include
}

export interface StackEntry { tile: number; priority: number; seq: number; height: number; width: number }

export const BASE = 12; // px between the city dot and the lowest marker
export const GAP = 4;   // px between two markers

const entries = new Set<StackEntry>();
let seq = 0;

export function joinStack(tile: number, priority: number): StackEntry {
  const e: StackEntry = { tile, priority, seq: ++seq, height: 0, width: 0 };
  entries.add(e);
  return e;
}

export function leaveStack(e: StackEntry): void {
  entries.delete(e);
}

/** Pixels from the city dot up to the bottom of this marker. Ties go to the marker that came first. */
export function stackOffset(e: StackEntry, lifted = true): number {
  let y = BASE + (lifted && e.priority >= STACK.battle ? lifts.get(e.tile) ?? 0 : 0);
  for (const o of entries) {
    if (o === e || o.tile !== e.tile || o.height <= 0) continue;
    if (o.priority < e.priority || (o.priority === e.priority && o.seq < e.seq)) y += o.height + GAP;
  }
  return y;
}

// Battle furniture (the unit counters and their order lines are sprites drawn by UnitLayer, outside this
// column): UnitLayer lifts a tile's battle plate, and whatever stacks above it, clear of the counters on screen.
const lifts = new Map<number, number>();

/** Forget every lift (the start of a layout pass). */
export function clearStackLifts(): void {
  lifts.clear();
}

/** Raise a tile's battle plate and the markers above it by `px` more than the column asks for. */
export function setStackLift(tile: number, px: number): void {
  lifts.set(tile, px);
}

/** The marker a tile shows at one priority: its size, and how far its bottom sits above the city dot before any lift. */
export function stackSlot(tile: number, priority: number): { offset: number; width: number; height: number } | null {
  for (const e of entries) {
    if (e.tile === tile && e.priority === priority && e.height > 0) return { offset: stackOffset(e, false), width: e.width, height: e.height };
  }
  return null;
}

/** The stack key of a nation's capital: its capital tile, or -1 - id when it has none. */
export function cityKey(world: { countries: ArrayLike<{ capitalTile?: number | null } | undefined>; tiles: ArrayLike<unknown> } | null | undefined, countryId: number): number {
  const t = world?.countries[countryId]?.capitalTile;
  return t != null && world?.tiles[t] ? t : -1 - countryId;
}
