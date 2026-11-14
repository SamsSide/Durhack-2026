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
    case 'unit_spawned':
      world.units.push({ ...event.unit });
      break;
    case 'unit_moved': {
      const u = world.units.find((x) => x.id === event.unitId);
      if (u) u.tile = event.to;
      break;
    }
    case 'unit_removed':
      world.units = world.units.filter((x) => x.id !== event.unitId);
      break;
    case 'battle':
      break;
    case 'relation_changed': {
      const a = Math.min(event.a, event.b);
      const b = Math.max(event.a, event.b);
      const r = world.relations.find((x) => x.a === a && x.b === b);
      if (r) {
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
  }
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
