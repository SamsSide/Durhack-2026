// Row A25: which events are "big moments" for the pacing director (engine/clock.ts). A pure
// function of one event (and the world, to know which tiles are capitals), so every runner (live,
// replay, mock) can use it on the batch it just applied.
import type { World, WorldEvent } from '@terra/shared';

const BIG_CHRONICLE = new Set(['decree', 'silence', 'return', 'dispute']);

/** A war declared, a battle for a capital, a secession, a fall, a decree, a link cut or restored,
 *  a border dispute settled. `world` is optional; without it a battle is never a capital battle. */
export function isBigMoment(e: WorldEvent, world?: World | null): boolean {
  switch (e.type) {
    case 'relation_changed': return e.stance === 'war';
    case 'battle': return !!world && world.countries.some((c) => c.capitalTile === e.tile);
    case 'country_fell': return true;
    case 'country_founded': return true;
    case 'chronicle': return BIG_CHRONICLE.has(e.entry.kind);
    default: return false;
  }
}

export function anyBigMoment(events: readonly WorldEvent[], world?: World | null): boolean {
  for (const e of events) if (isBigMoment(e, world)) return true;
  return false;
}
