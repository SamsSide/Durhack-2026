// Focus beats: the places a bulletin talks about, and when. The broadcast window cuts to a live
// picture of each one (web/src/globe/pip). The server sends them as `focus` on POST /api/broadcast
// (lane a, issue #288, PR #301); a dev build makes its own from the recent events for a server without it.
import type { NewsFocus, World, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';

/** One beat as the server sends it. `atSecond` counts from the start of the bulletin's audio. */
export type FocusBeat = NewsFocus;

/** A beat ready to air. */
export interface Beat {
  tile: number;
  atSecond: number;
  /** Seconds on air. */
  duration: number;
  /** The strap's first line: whose land it is. */
  place: string;
  caption: string;
  /** This shot follows the one before with no anchor between: a straight cut in. */
  cutIn: boolean;
  /** The next shot follows this one with no anchor between: a straight cut out. */
  cutOut: boolean;
}

const MAX_BEATS = 3;
/** A shot lasts this long when nothing follows it. */
const SHOT_S = 6;
const SHOT_MIN_S = 3.5;
/** The anchor is back for at least this long between two shots. */
const ANCHOR_GAP_S = 1.6;
/** Beats closer than that but at least this far apart cut straight from one place to the next. */
const CUT_MIN_S = 2.5;
/** The made-up beats air at these seconds (dev fallback only). */
const FALLBACK_AT = [2.5, 10.5, 18.5];

function placeOf(world: World, tile: number, countryId: number | null): string {
  const owner = countryId ?? world.owner[tile] ?? -1;
  return world.countries[owner]?.name ?? 'Unclaimed land';
}

/** Dev fallback: up to three beats from the newest events that have a place, then from capitals. */
function synthesise(world: World, events: readonly WorldEvent[], script: string): FocusBeat[] {
  const out: FocusBeat[] = [];
  const add = (tile: number | undefined, countryId: number | null, caption: string): void => {
    if (out.length >= MAX_BEATS || tile == null || !world.tiles[tile]) return;
    // one beat per neighbourhood: skip a tile next to one already picked
    if (out.some((b) => b.tile === tile || world.tiles[b.tile]!.neighbors.includes(tile))) return;
    out.push({ countryId, tile, atSecond: 0, caption });
  };
  const name = (id: number): string => world.countries[id]?.name ?? 'a nation';
  const adj = (id: number): string => world.countries[id]?.adjective ?? 'the';
  const structure = (id: string) => world.structures.find((s) => s.id === id);
  const kinds = new Set<string>();
  for (let i = events.length - 1; i >= 0 && out.length < MAX_BEATS; i--) {
    const e = events[i]!;
    if (kinds.has(e.type)) continue; // one of each kind, so the three shots differ
    const before = out.length;
    if (e.type === 'battle') add(e.tile, e.defender, `${adj(e.attacker)} and ${adj(e.defender)} armies meet in battle`);
    else if (e.type === 'country_fell') add(world.countries[e.countryId]?.capitalTile, e.countryId, `The capital of ${name(e.countryId)} has fallen`);
    else if (e.type === 'wonder_started') add(e.tile, e.countryId, `Work begins on ${e.name}`);
    else if (e.type === 'wonder_built') { const s = structure(e.structureId); add(s?.tile, e.countryId, `${s?.name ?? 'A wonder'} stands complete`); }
    else if (e.type === 'tile_claimed' && e.cause === 'conquest') add(e.tile, e.owner, `${name(e.owner)} takes ground from ${name(e.from)}`);
    else if (e.type === 'structure_built' && (e.structure.kind === 'city' || e.structure.kind === 'fort')) {
      add(e.structure.tile, e.structure.owner, `A new ${e.structure.kind} rises`);
    }
    if (out.length > before) kinds.add(e.type);
  }
  // Then the capitals of the nations the script names, then any capital.
  const live = world.countries.filter((c) => world.tiles[c.capitalTile] && world.owner[c.capitalTile] === c.id);
  const named = live.filter((c) => script.includes(c.name));
  for (const c of [...named, ...live]) add(c.capitalTile, c.id, `The capital, seat of ${c.leader}`);
  return out.map((b, i) => ({ ...b, atSecond: FALLBACK_AT[i] ?? 0 }));
}

/**
 * The beats of a bulletin. The server's `focus` wins whenever it is there (an empty list means no
 * cuts); only a dev build fills in for a server that does not send it yet.
 */
export function beatsFor(bulletin: { focus?: FocusBeat[]; script: string }): Beat[] {
  const s = useWorld.getState();
  const world = s.world;
  if (!world) return [];
  let raw: FocusBeat[];
  const forced = import.meta.env.DEV ? (window as unknown as { __tnFocus?: FocusBeat[] }).__tnFocus : undefined; // dev only: try beats from the console
  if (Array.isArray(forced)) raw = forced;
  else if (Array.isArray(bulletin.focus)) raw = bulletin.focus;
  else if (import.meta.env.DEV) raw = synthesise(world, s.recentEvents, bulletin.script);
  else return [];
  const sane = raw
    .filter((b) => b && Number.isInteger(b.tile) && world.tiles[b.tile] && Number.isFinite(b.atSecond) && b.atSecond >= 0)
    .sort((a, b) => a.atSecond - b.atSecond);
  const beats: Beat[] = [];
  for (const b of sane) {
    if (beats.length >= MAX_BEATS) break;
    const prev = beats[beats.length - 1];
    if (prev) {
      // the earlier shot ends in time for the anchor to come back, or cuts straight to this one; too close a beat is dropped
      const gap = b.atSecond - prev.atSecond;
      if (gap < CUT_MIN_S) continue;
      if (gap - ANCHOR_GAP_S >= SHOT_MIN_S) prev.duration = Math.min(prev.duration, gap - ANCHOR_GAP_S);
      else { prev.duration = gap; prev.cutOut = true; }
    }
    beats.push({ tile: b.tile, atSecond: b.atSecond, duration: SHOT_S, place: placeOf(world, b.tile, b.countryId), caption: String(b.caption ?? '').trim(), cutIn: !!prev?.cutOut, cutOut: false });
  }
  return beats;
}

/**
 * Seconds from the start of the bulletin until its last live shot is over, 0 with no beats. Beats run
 * on a wall clock, not on the audio: a short clip (mock mode's sample is about 4 s) must not cut them off.
 */
export function beatsEnd(beats: readonly Beat[]): number {
  const last = beats[beats.length - 1];
  return last ? last.atSecond + last.duration : 0;
}
