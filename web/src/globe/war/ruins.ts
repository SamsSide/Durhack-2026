// Which provinces show their buildings as ruins (B14). A province falls to ruin when its devastation
// passes RUIN_AT, or when a town, city or capital on it is sacked (taken by conquest); it is rebuilt once
// devastation is back under RESTORE_BELOW (and a sack is at least SACK_TICKS old). The structure and town
// layers ask shownKind / isRuinedTile; the sim's own 'ruin' structures are untouched. Lane b.
import type { Structure, StructureKind, World } from '@terra/shared';

const RUIN_AT = 60;
const RESTORE_BELOW = 30;
const SACK_TICKS = 6;
const SACKABLE = new Set<string>(['town', 'city', 'capital']);
const KEEP = new Set<string>(['ruin', 'wonder']);

let worldId: string | null = null;
const ruined = new Set<number>();
const sackedAt = new Map<number, number>();
type Listener = (tile: number, ruin: boolean) => void;
const listeners = new Set<Listener>();

function reset(world: World): void {
  if (world.id === worldId) return;
  worldId = world.id;
  ruined.clear();
  sackedAt.clear();
}

function set(tile: number, ruin: boolean): void {
  if (ruin === ruined.has(tile)) return;
  if (ruin) ruined.add(tile); else ruined.delete(tile);
  for (const l of listeners) l(tile, ruin);
}

/** A conquest took this tile: if a settlement stands on it, it is sacked and falls to ruin. */
export function markSacked(world: World, tile: number): void {
  reset(world);
  if (!world.structures.some((s) => s.tile === tile && SACKABLE.has(s.kind))) return;
  sackedAt.set(tile, world.tick);
  set(tile, true);
}

/** Re-reads devastation with hysteresis. Idempotent, O(tiles); call on a world change. */
export function updateRuins(world: World): void {
  reset(world);
  const d = world.devastation;
  if (d) for (let i = 0; i < d.length; i++) if (d[i]! >= RUIN_AT) set(i, true);
  for (const t of [...ruined]) {
    const s = sackedAt.get(t);
    if (s != null && world.tick - s < SACK_TICKS) continue;
    if ((d?.[t] ?? 0) < RESTORE_BELOW) { sackedAt.delete(t); set(t, false); }
  }
}

export const isRuinedTile = (tile: number): boolean => ruined.has(tile);

/** The kind to draw for a structure: 'ruin' while its province lies in ruins. */
export function shownKind(s: Structure): StructureKind {
  return ruined.has(s.tile) && !KEEP.has(s.kind) ? 'ruin' : s.kind;
}

export function onRuinChange(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
