// Turn raw world events into beacon stories: what happened, where, and a one-line title. Lane b.
import type { StructureKind, World, WorldEvent } from '@terra/shared';
import type { BeaconKind, Story } from './kinds';

/** What we remember about each structure, so upgrades and razings (which carry only an id) can be placed. */
export type StructureInfo = { tile: number; owner: number; kind: StructureKind };
export type StructureCache = Map<string, StructureInfo>;

export function buildStructureCache(world: World): StructureCache {
  return new Map(world.structures.map((s) => [s.id, { tile: s.tile, owner: s.owner, kind: s.kind }]));
}

const name = (w: World, id: number | null | undefined): string =>
  (id != null && w.countries[id]?.name) || 'A nation';

function shorten(text: string, n: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '')}...`;
}

function capitalTile(w: World, id: number | null | undefined): number | null {
  if (id == null) return null;
  const c = w.countries[id];
  if (c && w.tiles[c.capitalTile]) return c.capitalTile;
  return null;
}

/** First tile of `a` that touches `b`; else the tile nearest the midpoint of their capitals. */
function meetingTile(w: World, a: number, b: number): number | null {
  for (let t = 0; t < w.owner.length; t++) {
    if (w.owner[t] !== a) continue;
    for (const n of w.tiles[t]!.neighbors) if (w.owner[n] === b) return t;
  }
  const ca = capitalTile(w, a), cb = capitalTile(w, b);
  if (ca == null || cb == null) return ca ?? cb;
  const pa = w.tiles[ca]!.center, pb = w.tiles[cb]!.center;
  const m = [pa[0] + pb[0], pa[1] + pb[1], pa[2] + pb[2]];
  let best = ca, bestDot = -Infinity;
  for (const tile of w.tiles) {
    const d = tile.center[0] * m[0] + tile.center[1] * m[1] + tile.center[2] * m[2];
    if (d > bestDot) { bestDot = d; best = tile.id; }
  }
  return best;
}

export function classify(events: WorldEvent[], w: World, cache: StructureCache): Story[] {
  const out: Story[] = [];
  const now = performance.now();
  const add = (kind: BeaconKind, tile: number | null, countryId: number | null, title: string, extra: Partial<Story> = {}) => {
    if (tile == null || !w.tiles[tile]) return;
    out.push({ kind, tile, countryId, title, year: w.year, at: now, ...extra });
  };

  for (const e of events) {
    const byDecree = e.actor === 'decree';
    switch (e.type) {
      case 'structure_built': {
        const s = e.structure;
        cache.set(s.id, { tile: s.tile, owner: s.owner, kind: s.kind });
        if (byDecree) add('decree', s.tile, s.owner, `A decree raises a ${s.kind} in ${name(w, s.owner)}`);
        else if (s.kind === 'city') add('city', s.tile, s.owner, `${name(w, s.owner)} founds a city`);
        else if (s.kind === 'capital') add('capital', s.tile, s.owner, `${name(w, s.owner)} founds a new capital`);
        break;
      }
      case 'structure_upgraded': {
        const live = w.structures.find((s) => s.id === e.structureId);
        const info = live ? { tile: live.tile, owner: live.owner, kind: live.kind } : cache.get(e.structureId);
        if (!info) break;
        // the world may already hold the upgraded structure: then the kind it grew from is the one remembered, else a town
        const before = cache.get(e.structureId)?.kind;
        const from = info.kind !== e.kind ? info.kind : before && before !== e.kind ? before : 'town';
        cache.set(e.structureId, { ...info, kind: e.kind });
        const adj = w.countries[info.owner]?.adjective;
        if (byDecree) add('decree', info.tile, info.owner, `A decree turns a ${from} of ${name(w, info.owner)} into a ${e.kind}`);
        else if (e.kind === 'city') {
          const what = adj ? `${adj} ${from}` : from;
          add('city', info.tile, info.owner, `${/^[aeiou]/i.test(what) ? 'An' : 'A'} ${what} grows into a city`);
        }
        else if (e.kind === 'capital') add('capital', info.tile, info.owner, `${name(w, info.owner)} raises a new capital`);
        break;
      }
      case 'structure_destroyed': {
        const info = cache.get(e.structureId);
        cache.delete(e.structureId);
        if (info && byDecree) add('decree', info.tile, info.owner, `A decree razes a ${info.kind} of ${name(w, info.owner)}`);
        break;
      }
      case 'relation_changed': {
        const aggr = typeof e.actor === 'number' && (e.actor === e.a || e.actor === e.b) ? e.actor : e.a;
        const other = aggr === e.a ? e.b : e.a;
        if (e.stance === 'war') {
          add('war', meetingTile(w, aggr, other), aggr, `${name(w, aggr)} declares war on ${name(w, other)}`, { sub: e.reason ? shorten(e.reason, 110) : undefined });
        } else if (e.stance === 'neutral' && /^the treaty/i.test(e.reason.trim())) {
          const treaty = e.reason.trim();
          const title = treaty.length <= 48
            ? `${name(w, e.a)} and ${name(w, e.b)} sign ${treaty.replace(/^the/i, 'the')}`
            : `${name(w, e.a)} and ${name(w, e.b)} make peace`;
          add('treaty', meetingTile(w, e.a, e.b), e.a, title, treaty.length > 48 ? { sub: shorten(treaty, 110) } : {});
        }
        break;
      }
      case 'country_fell':
        add('fall', capitalTile(w, e.countryId), e.countryId,
          e.conqueror != null ? `${name(w, e.countryId)} falls to ${name(w, e.conqueror)}` : `${name(w, e.countryId)} has fallen`);
        break;
      case 'country_founded': {
        const c = e.country;
        const tile = w.tiles[c.capitalTile] ? c.capitalTile : null;
        add('secession', tile, c.id, c.parent != null ? `${c.name} breaks away from ${name(w, c.parent)}` : `${c.name} rises`);
        break;
      }
      case 'chronicle': {
        const en = e.entry;
        const kind = en.kind as string;
        const who = en.countries[0] ?? null;
        if (kind === 'decree') add('decree', capitalTile(w, who), who, shorten(en.text, 90), { attach: true, year: en.year });
        else if (kind === 'wonder' || kind === 'death' || kind === 'succession') add(kind, capitalTile(w, who), who, shorten(en.text, 90), { year: en.year });
        break;
      }
      default:
        break;
    }
  }
  return out;
}
