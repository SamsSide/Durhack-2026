// applyEvent is the only code that changes a World (server and browser both use it).
import type { Relation, Vec3, World, WorldEvent } from './types';

export function applyEvent(world: World, event: WorldEvent): void {
  switch (event.type) {
    case 'tick':
      world.tick = event.tick;
      world.year = event.year;
      break;
    case 'tile_claimed':
      world.owner[event.tile] = event.owner;
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
      if (c) Object.assign(c, event.patch);
      break;
    }
    case 'country_fell': {
      const c = world.countries[event.countryId];
      if (c) c.alive = false;
      break;
    }
    case 'country_founded':
      world.countries.push({ ...event.country });
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
  }
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
