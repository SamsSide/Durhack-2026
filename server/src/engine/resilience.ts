// Resilience (row A7): the words and the one rule behind cut, restore, delete and blackout.
//
// The dispute rule. While a nation's link is cut it claims land nobody else can see, and the rest
// of the world claims land it cannot see. On restore, every claim of the returning nation on a tile
// that the connected world gave to someone else is a dispute between the two. The EARLIER claim
// wins (each side's claim tick is in the event log both sides now share); a tie goes to
// resolveClaim's hash, the same tiebreak as two claims in one tick. Why this rule: it is the one a
// person reads as fair ("they were there first"), it does not depend on which link came back first
// (so a blackout restored in any order settles the same way), and it is a pure function of data
// every replica holds after the merge, so every replica reaches the same answer with no referee.
import { resolveClaim, type Country, type World, type WorldEvent } from '@terra/shared';

/** Ticks without a heartbeat before a neighbour remarks on the silence. */
export const SILENCE_NOTICE_TICKS = 12;
/** Ticks after a nation is deleted before it is declared fallen and its land becomes ruins. */
export const FALL_AFTER_TICKS = SILENCE_NOTICE_TICKS + 2;

// ---- words ---------------------------------------------------------------------------------

interface Voice { silence: string; ret: string; watch: string }
const VOICES: { match: RegExp; v: Voice }[] = [
  { match: /bronze|stone|ancient/i, v: {
    silence: 'No runner comes from {n}. Its signal fires have gone dark.',
    ret: 'After {y} years of silence, runners from {n} come down the river roads again.',
    watch: 'watchmen' } },
  { match: /medieval|feudal|knight/i, v: {
    silence: 'No word comes from {n}. Its envoys have fallen silent.',
    ret: 'After {y} years of silence, the envoys of {n} return to the courts of their neighbours.',
    watch: 'border wardens' } },
  { match: /industrial|steam|victorian/i, v: {
    silence: 'The telegraph lines to {n} go dead.',
    ret: 'After {y} years of silence, the wires to {n} hum again.',
    watch: 'frontier posts' } },
  { match: /post|apocal|drown|ruin|waste/i, v: {
    silence: 'The radio towers of {n} fall silent; nothing comes back but static.',
    ret: 'After {y} years of static, the radio towers of {n} crackle back to life.',
    watch: 'scouts' } },
  { match: /ice|frozen|glacial|snow/i, v: {
    silence: 'The signal fires of {n} go out across the ice.',
    ret: 'After {y} winters of silence, sledges from {n} cross the ice again.',
    watch: 'trackers' } },
  { match: /float|archipelago|island|sky/i, v: {
    silence: 'No sail comes from {n}. Its harbours keep their own counsel.',
    ret: 'After {y} years of silence, the sails of {n} are seen on the horizon again.',
    watch: 'lookouts' } },
  { match: /./, v: {
    silence: 'No word comes from {n}. Its envoys have fallen silent.',
    ret: "After {y} years of silence, {n}'s envoys return.",
    watch: 'border wardens' } },
];
const voiceOf = (era: string): Voice => VOICES.find((x) => x.match.test(era))!.v;

/** A name in the middle of a sentence: "The Ashen Concord" becomes "the Ashen Concord". */
const mid = (name: string): string => name.replace(/^The /, 'the ');
/** The first letter of a sentence in upper case. */
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const fillN = (s: string, c: Country, years = 0): string =>
  cap(s.replace(/\{n\}/g, mid(c.name)).replace(/\{y\}/g, String(years)));

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n: number): string => NUMBERS[n] ?? String(n);

export function silenceText(world: World, c: Country): string { return fillN(voiceOf(world.era).silence, c); }
export function returnText(world: World, c: Country, years: number): string {
  return fillN(voiceOf(world.era).ret, c, Math.max(1, years));
}
export function fallText(c: Country): string { return `${cap(mid(c.name))} is gone; its neighbours divide the ruins.`; }

/** Which way `to` lies from `from` on the globe (y is up), as a compass word. */
function direction(world: World, from: Country, to: Country): string {
  const a = world.tiles[from.capitalTile]?.center;
  const b = world.tiles[to.capitalTile]?.center;
  if (!a || !b) return 'the frontier';
  const lon = (p: number[]): number => Math.atan2(p[2]!, p[0]!);
  const lat = (p: number[]): number => Math.asin(Math.max(-1, Math.min(1, p[1]!)));
  let dLon = lon(b) - lon(a);
  if (dLon > Math.PI) dLon -= 2 * Math.PI;
  if (dLon < -Math.PI) dLon += 2 * Math.PI;
  const dLat = lat(b) - lat(a);
  if (Math.abs(dLat) > Math.abs(dLon) * Math.cos(lat(a))) return dLat > 0 ? 'the north' : 'the south';
  return dLon > 0 ? 'the east' : 'the west';
}

/** One neighbour remarks that another has gone quiet (written from its own replica). */
export function noticeText(world: World, me: Country, silent: Country): string {
  const v = voiceOf(world.era);
  return `${cap(mid(me.name))}'s ${v.watch} report nothing from ${direction(world, me, silent)}; ${mid(silent.name)} has gone quiet.`;
}

/** "Three border provinces between X and Y were disputed; two went to X and one to Y." */
export function disputeText(a: Country, b: Country, toA: number, toB: number): string {
  const n = toA + toB;
  const head = n === 1
    ? `A border province between ${mid(a.name)} and ${mid(b.name)} was disputed`
    : `${cap(num(n))} border provinces between ${mid(a.name)} and ${mid(b.name)} were disputed`;
  if (n === 1) return `${head}; it went to ${mid(toA ? a.name : b.name)}.`;
  if (toB === 0) return `${head}; all went to ${mid(a.name)}.`;
  if (toA === 0) return `${head}; all stayed with ${mid(b.name)}.`;
  return `${head}; ${num(toA)} went to ${mid(a.name)} and ${num(toB)} stayed with ${mid(b.name)}.`;
}

// ---- the dispute rule ------------------------------------------------------------------------

export interface Dispute {
  tile: number;
  /** The nation coming back from silence. */
  returning: number;
  /** The nation the connected world gave the tile to meanwhile. */
  holder: number;
  returningTick: number;
  /** The holder's earliest claim on the tile in the batches the returning nation missed; null if it
   *  held the tile before the silence began (then it keeps it). */
  holderTick: number | null;
  winner: number;
}

/**
 * Every clash between the returning nation's queued claims and the world it missed. `world` is the
 * merged view BEFORE the returning nation's own events are applied (its checkpoint plus every batch
 * it missed); `missed` those batches; `mine` its queued events. Pure and deterministic.
 */
export function findDisputes(world: World, returning: number, missed: WorldEvent[][], mine: WorldEvent[]): Dispute[] {
  const firstClaim = new Map<string, number>();               // `${tile}:${owner}` -> earliest tick
  for (const batch of missed) {
    for (const e of batch) {
      if (e.type !== 'tile_claimed' || e.cause === 'dispute' || e.cause === 'collapse') continue;
      const k = `${e.tile}:${e.owner}`;
      const t = firstClaim.get(k);
      if (t === undefined || e.tick < t) firstClaim.set(k, e.tick);
    }
  }
  const seen = new Set<number>();
  const out: Dispute[] = [];
  for (const e of mine) {
    if (e.type !== 'tile_claimed' || e.actor !== returning || e.owner !== returning || seen.has(e.tile)) continue;
    seen.add(e.tile);
    const holder = world.owner[e.tile] ?? -1;
    if (holder < 0 || holder === returning || holder === e.from) continue;   // free, already its own, or its claim still stands
    if (!world.countries[holder]?.alive) continue;
    const holderTick = firstClaim.get(`${e.tile}:${holder}`) ?? null;
    let winner = holder;
    if (holderTick !== null) {
      if (e.tick < holderTick) winner = returning;
      else if (e.tick === holderTick) winner = resolveClaim(e.tile, e.tick, [returning, holder].sort((a, b) => a - b));
    }
    out.push({ tile: e.tile, returning, holder, returningTick: e.tick, holderTick, winner });
  }
  return out.sort((a, b) => a.tile - b.tile);
}
