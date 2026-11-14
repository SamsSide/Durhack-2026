// applyEvent is the only code that changes a World (server and browser both use it).
import type { ChronicleEntry, CouncilMember, CouncilRole, Relation, Vec3, World, WorldEvent } from './types';
import { DEVASTATION, addDevastation, devastationTick } from './sim/economy';

// The chronicle a World holds is a recent window, not the whole history (owner, 14 Nov): at the top
// gear a run writes tens of thousands of lines, and every replica, snapshot and browser held them all.
// The full history lives in the event log (GET /api/world/log), which the timeline scrubber replays.
/** How many lines the chronicle keeps (plus the pinned ones below). */
export const CHRONICLE_KEEP = 500;
/** Trimming waits for this many extra lines, so it runs once per CHRONICLE_SLACK lines, not per line. */
export const CHRONICLE_SLACK = 100;
/** Lines this many years old or newer are never trimmed: the rules read offers, treaties and war
 *  declarations back from the chronicle (sim/war.ts OFFER_TTL is 30 years, the rest less). */
export const CHRONICLE_MIN_YEARS = 40;
// Secession lines (SECESSION_MARK in sim/regions.ts, not imported because regions imports this file)
// are how the rules know which regions already broke away, so they are kept for the whole run, as are
// the founding lines. Both are bounded by the nation cap.
const PINNED_PREFIX = 'c-secession-';
const pinned = (e: ChronicleEntry): boolean => e.kind === 'founding' || e.id.startsWith(PINNED_PREFIX);

/** Drops the oldest unpinned lines down to CHRONICLE_KEEP, in place and in order. A pure function of
 *  the chronicle and the tick, so every replica that applied the same events trims the same way. */
export function trimChronicle(world: World): void {
  const c = world.chronicle;
  let drop = c.length - CHRONICLE_KEEP;
  const minTick = world.tick - CHRONICLE_MIN_YEARS;
  let w = 0;
  for (let i = 0; i < c.length; i++) {
    const e = c[i]!;
    if (drop > 0 && !pinned(e) && e.tick < minTick) { drop--; continue; }
    c[w++] = e;
  }
  c.length = w;
}

export function applyEvent(world: World, event: WorldEvent): void {
  const memo = councilMemo(world, event);
  switch (event.type) {
    case 'tick':
      // B11 (#204): the turn of a NEW year scars occupied land and heals the rest (once per year, so a
      // replica that re-applies the clock of the year it is in does not fold twice).
      if (event.tick > world.tick) devastationTick(world);
      world.tick = event.tick;
      world.year = event.year;
      break;
    case 'tile_claimed':
      world.owner[event.tile] = event.owner;
      if (event.cause === 'conquest' && event.owner >= 0 && event.from >= 0) addDevastation(world, event.tile, DEVASTATION.conquest);
      for (const s of world.structures) if (s.tile === event.tile && s.kind !== 'ruin') s.owner = event.owner;
      // Grievance (row A6): a lost province rankles; so does land grabbed along a shared border.
      if (event.owner >= 0 && event.from >= 0 && event.cause !== 'collapse') addGrievance(world, event.owner, event.from, 0.04);
      else if (event.owner >= 0 && event.cause === 'expand') {
        const seen = new Set<number>();
        for (const j of world.tiles[event.tile]?.neighbors ?? []) {
          const o = world.owner[j] ?? -1;
          if (o >= 0 && o !== event.owner && !seen.has(o)) { seen.add(o); addGrievance(world, event.owner, o, 0.01); }
        }
      }
      break;
    case 'structure_built':
      world.structures.push({ ...event.structure });
      break;
    case 'structure_upgraded': {
      const s = world.structures.find((x) => x.id === event.structureId);
      if (s) s.kind = event.kind;
      break;
    }
    case 'structure_destroyed':
      world.structures = world.structures.filter((x) => x.id !== event.structureId);
      break;
    case 'wonder_started':
      world.structures.push({ id: event.structureId, tile: event.tile, owner: event.countryId, kind: 'wonder', builtTick: event.tick, wonder: event.wonder, name: event.name, complete: false });
      break;
    case 'wonder_built': {
      const s = world.structures.find((x) => x.id === event.structureId);
      if (s && s.kind === 'wonder') s.complete = true;
      break;
    }
    case 'unit_spawned':
      world.units.push({ ...event.unit });
      break;
    case 'unit_moved': {
      const u = world.units.find((x) => x.id === event.unitId);
      if (u) u.tile = event.to;
      break;
    }
    case 'unit_attrition': {
      const u = world.units.find((x) => x.id === event.unitId);
      if (u) u.strength = Math.max(1, u.strength - event.loss);
      break;
    }
    case 'unit_removed':
      world.units = world.units.filter((x) => x.id !== event.unitId);
      break;
    case 'battle': {
      // Losses come off the attacking army and the defending units on the tile, in list order
      // (row A6). Units that lose everything are removed by the unit_removed events that follow.
      const atk = world.units.find((x) => x.id === event.attackerUnit);
      if (atk) atk.strength = Math.max(1, atk.strength - event.losses.attacker);
      let left = event.losses.defender;
      for (const u of world.units) {
        if (left <= 0) break;
        if (u.tile !== event.tile || u.owner !== event.defender || u.kind === 'settler' || u.kind === 'trader') continue;
        const take = Math.min(left, u.strength);
        u.strength = Math.max(1, u.strength - take);
        left -= take;
      }
      addGrievance(world, event.attacker, event.defender, 0.01);
      addDevastation(world, event.tile, DEVASTATION.battle);
      break;
    }
    case 'relation_changed': {
      const a = Math.min(event.a, event.b);
      const b = Math.max(event.a, event.b);
      const r = world.relations.find((x) => x.a === a && x.b === b);
      if (r) {
        // A broken alliance is remembered (betrayal); a peace treaty halves old grudges.
        if (r.stance === 'alliance' && event.stance !== 'alliance') r.grievance = Math.min(1, r.grievance + 0.4);
        if (r.stance === 'war' && event.stance !== 'war') r.grievance = Math.round(r.grievance * 50) / 100;
        r.stance = event.stance;
        r.since = event.tick;
        if (event.stance === 'war') r.grievance = Math.min(1, r.grievance + 0.3);
      } else {
        world.relations.push({ a, b, stance: event.stance, since: event.tick, grievance: event.stance === 'war' ? 0.3 : 0 });
      }
      break;
    }
    case 'country_updated': {
      const c = world.countries[event.countryId];
      if (c) {
        Object.assign(c, event.patch);
        if (event.patch.politics) c.politics = { ...event.patch.politics };   // a copy: replicas never share objects
      }
      break;
    }
    case 'country_fell': {
      const c = world.countries[event.countryId];
      if (c) c.alive = false;
      break;
    }
    case 'country_founded':
      world.countries.push(structuredClone(event.country));
      world.agents.push({
        countryId: event.country.id, link: 'up', ruler: 'autopilot', deleted: false,
        lastHeardTick: event.tick, pendingEvents: 0,
      });
      break;
    case 'region_updated': {
      const r = world.regions[event.regionId];
      if (r) Object.assign(r, event.patch);
      break;
    }
    case 'chronicle':
      world.chronicle.push(event.entry);
      if (world.chronicle.length > CHRONICLE_KEEP + CHRONICLE_SLACK) trimChronicle(world);
      break;
    case 'payment': {
      // Row A27: money moves from the payer's treasury to the payee's, never more than the payer has.
      const payer = world.countries[event.from];
      const payee = world.countries[event.to];
      if (!payer || !payee || event.from === event.to) break;
      const amount = Math.min(Math.max(0, event.amount), Math.max(0, payer.treasury));
      payer.treasury = Math.round((payer.treasury - amount) * 100) / 100;
      payee.treasury = Math.round((payee.treasury + amount) * 100) / 100;
      break;
    }
    case 'council_changed': {
      // Row A29: sets the member (a copy: replicas never share objects); the ruler is also the leader.
      const c = world.countries[event.countryId];
      if (!c) break;
      c.council ??= { ruler: null, general: null, state: { ruler: 'vacant', general: 'vacant' } };
      c.council[event.role] = event.member ? { ...event.member } : null;
      if (event.role === 'ruler' && event.member) c.leader = event.member.name;
      break;
    }
    case 'council_status': {
      const council = world.countries[event.countryId]?.council;
      if (council) council.state[event.role] = event.state;
      break;
    }
  }
  for (const [id, role, line] of memo) rememberLine(world, id, role, line);
}

// ---- council memory (row A29) ----------------------------------------------------------------

/** How many lines a council member's memory keeps. */
export const MEMORY_LINES = 5;

/** Appends one line to a council member's rolling memory (the last MEMORY_LINES lines are kept). */
export function rememberLine(world: World, countryId: number, role: CouncilRole, line: string): void {
  const m: CouncilMember | null | undefined = world.countries[countryId]?.council?.[role];
  if (!m) return;
  m.memory = [...(m.memory ? m.memory.split('\n') : []), line].slice(-MEMORY_LINES).join('\n');
}

/** The lines an event adds to council memories, read from the world before the event is applied:
 *  generals remember their battles, rulers their wars, peaces and alliances. */
function councilMemo(world: World, e: WorldEvent): [number, CouncilRole, string][] {
  if (e.type !== 'battle' && e.type !== 'relation_changed') return [];
  const name = (id: number): string => (world.countries[id]?.name ?? 'a fallen people').replace(/^The /, 'the ');
  const y = e.tick + world.year - world.tick;          // the event's year, even on a replica whose clock lags
  if (e.type === 'battle') {
    const r = world.tiles[e.tile]?.region ?? -1;
    const place = (r >= 0 && world.regions[r]?.name) || 'the border';
    const line = (me: number, foe: number): string => `${y}: ${e.winner === me ? 'beat' : 'lost to'} ${name(foe)} at ${place}`;
    return [[e.attacker, 'general', line(e.attacker, e.defender)], [e.defender, 'general', line(e.defender, e.attacker)]];
  }
  const lo = Math.min(e.a, e.b), hi = Math.max(e.a, e.b);
  const prev = world.relations.find((x) => x.a === lo && x.b === hi)?.stance ?? 'neutral';
  if (prev === e.stance) return [];
  const words = e.stance === 'war' ? ['declared war on', 'was attacked by'] : prev === 'war' ? ['made peace with', 'made peace with']
    : e.stance === 'alliance' ? ['swore an alliance with', 'swore an alliance with'] : null;
  if (!words) return [];
  const first = typeof e.actor === 'number' && e.actor === e.b ? e.b : e.a;
  const second = first === e.a ? e.b : e.a;
  return [[first, 'ruler', `${y}: ${words[0]} ${name(second)}`], [second, 'ruler', `${y}: ${words[1]} ${name(first)}`]];
}

/** Raises the grievance between two nations (creating a neutral relation if there is none yet). */
function addGrievance(world: World, x: number, y: number, by: number): void {
  if (x === y || x < 0 || y < 0) return;
  const a = Math.min(x, y);
  const b = Math.max(x, y);
  const r = world.relations.find((q) => q.a === a && q.b === b);
  if (r) r.grievance = Math.min(1, Math.round((r.grievance + by) * 1000) / 1000);
  else world.relations.push({ a, b, stance: 'neutral', since: 0, grievance: by });
}

export function countryTiles(world: World, countryId: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < world.owner.length; i++) if (world.owner[i] === countryId) out.push(i);
  return out;
}

const EPS = 1e-7;
const same = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;

/** Boundary edges between this country's tiles and any tile of another owner (or none). */
export function borderEdges(world: World, countryId: number): [Vec3, Vec3][] {
  const edges: [Vec3, Vec3][] = [];
  for (const id of countryTiles(world, countryId)) {
    const tile = world.tiles[id]!;
    for (const nId of tile.neighbors) {
      if (world.owner[nId] === countryId) continue;
      const other = world.tiles[nId]!.boundary;
      const n = tile.boundary.length;
      for (let k = 0; k < n; k++) {
        const p = tile.boundary[k]!;
        const q = tile.boundary[(k + 1) % n]!;
        if (other.some((o) => same(o, p)) && other.some((o) => same(o, q))) edges.push([p, q]);
      }
    }
  }
  return edges;
}

export function relationOf(world: World, a: number, b: number): Relation {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return world.relations.find((r) => r.a === lo && r.b === hi)
    ?? { a: lo, b: hi, stance: 'neutral', since: 0, grievance: 0 };
}

export function regionOwner(world: World, regionId: number): number {
  const r = world.regions[regionId];
  return r ? (world.owner[r.capitalTile] ?? -1) : -1;
}
