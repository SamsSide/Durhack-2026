// Sea trade (row A23). A nation with a port and a trade pact or alliance with another nation that has a
// port sends merchant ships (`trader` units): spawned on its port, they sail one sea province a year over
// the ocean to the partner's port (`target`), dock for a year, and are disbanded with a treasury bonus
// for both sides. Everything is the nation's own events, decided on its own replica: the owner moves,
// docks and disbands its ships; the partner counts a foreign ship docked at its port once (its agent
// remembers which). An enemy fleet on a merchant ship's sea province sinks it (settled in sim/war.ts).
import type { Country, Structure, TechAge, Unit, World, WorldEvent } from '../types';
import { hashString } from '../rng';
import { relationOf } from '../world';
import { ageIndex, type AgeMemory } from './ages';

/** At most this many merchant ships per nation at sea at once. */
export const MAX_TRADERS = 2;
const MAX_ROUTE = 120;

const SHIP: Record<TechAge, string> = {
  ancient: 'trade galley', medieval: 'merchant cog', gunpowder: 'merchant galleon', industrial: 'steamer', modern: 'container ship',
  future: 'maglev freighter', stellar: 'orbital freighter',
};
const CARGO: Record<TechAge, string[]> = {
  ancient: ['salt', 'amber', 'copper ingots', 'olive oil', 'cedar logs'],
  medieval: ['wool', 'wine', 'pepper and cloves', 'salt fish', 'dyed cloth'],
  gunpowder: ['silver', 'sugar', 'tobacco', 'saltpetre', 'silk'],
  industrial: ['coal', 'cotton bales', 'steel rails', 'tea', 'machine parts'],
  modern: ['containers of electronics', 'grain', 'crude oil', 'medicine', 'cars'],
  future: ['fusion cells', 'lab-grown grain', 'quantum chips', 'desalinated water', 'medical nanites'],
  stellar: ['helium-3', 'asteroid iron', 'starship hulls', 'terraforming seed', 'colonists'],
};

/** Bonus a docking brings to each side, from that side's own age. */
export const tradeBonus = (c: Country): number => 10 + 3 * ageIndex(c.techAge);

const isOcean = (w: World, t: number): boolean => w.tiles[t]!.terrain === 'ocean';

/** Sea distance from a port tile: 0 on the port, then over ocean provinces only. */
export function seaDistances(w: World, port: number, limit = MAX_ROUTE): Map<number, number> {
  const dist = new Map<number, number>([[port, 0]]);
  const q = [port];
  for (let h = 0; h < q.length; h++) {
    const d = dist.get(q[h]!)!;
    if (d >= limit) continue;
    for (const j of w.tiles[q[h]!]!.neighbors) if (!dist.has(j) && isOcean(w, j)) { dist.set(j, d + 1); q.push(j); }
  }
  return dist;
}

/** The next sea step from `from` towards whatever `dist` measures, or -1 if there is no way. */
function nextStep(w: World, from: number, dist: Map<number, number>): number {
  const here = dist.get(from) ?? Infinity;
  let best = -1, bd = here;
  for (const j of w.tiles[from]!.neighbors) {
    const d = dist.get(j);
    if (d !== undefined && (d < bd || (d === bd && best >= 0 && j < best))) { bd = d; best = j; }
  }
  return best;
}

/** Route length (sea provinces) from a port to the port `dist` was measured from, or -1 if no sea route. */
function routeLength(w: World, from: number, dist: Map<number, number>): number {
  let best = -1;
  for (const j of w.tiles[from]!.neighbors) {
    const d = dist.get(j);
    if (d !== undefined && (best < 0 || d + 1 < best)) best = d + 1;
  }
  return best;
}

type Emit = (body: Record<string, unknown> & { type: WorldEvent['type'] }) => void;

export interface TradeInput {
  view: World; me: number; tick: number;
  own: number[];
  /** Its own structures this turn (working copies). */
  structs: Structure[];
  /** Its own units this turn (working copies; moves update their tile, removal sets tile -1). */
  units: Unit[];
  emit: Emit;
  uid: (prefix: string) => string;
  mem?: AgeMemory;
}

/** One year of sea trade for one nation. Returns the treasury it gains this year. */
export function tradeTurn(p: TradeInput): number {
  const { view, me, tick, own, structs, units, emit, mem } = p;
  const c = view.countries[me]!;
  const age = c.techAge ?? 'ancient';
  let gain = 0;
  let said = 0;
  const h = (s: string): number => hashString(`trade:${s}`);
  const partnerOf = (o: number): boolean => {
    if (o < 0 || o === me || !view.countries[o]?.alive) return false;
    const s = relationOf(view, me, o).stance;
    return s === 'trade' || s === 'alliance';
  };

  // 1. Foreign merchant ships docked at its ports: counted once each.
  if (mem) {
    for (const u of view.units) {
      if (u.kind !== 'trader' || u.owner === me || u.tile !== u.target || own[u.tile] !== me || mem.docked.has(u.id)) continue;
      if (!structs.some((s) => s.tile === u.tile && s.kind === 'port')) continue;
      mem.docked.add(u.id);
      gain += tradeBonus(c);
    }
  }

  // 2. Its own ships: dock, sail on, or turn back.
  const mine = units.filter((u) => u.kind === 'trader' && u.tile >= 0);
  for (const u of mine) {
    const target = u.target ?? -1;
    const host = target >= 0 ? own[target]! : -1;
    if (u.tile === target) {
      emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' });
      u.tile = -1;
      gain += tradeBonus(c);
      if (host >= 0 && host !== me && h(`say:${u.id}`) % 100 < 30) {
        const reg = view.tiles[target]!.region;
        const place = (reg >= 0 && view.regions[reg]?.name) || view.countries[host]!.name;
        const cargo = CARGO[age][h(`cargo:${u.id}`) % CARGO[age].length]!;
        const who = c.adjective || c.name;
        emit({ type: 'chronicle', entry: { id: `c-${me}-${tick}-trade${said++}`, tick, year: view.year, kind: 'proclamation', countries: [me, host],
          text: `A ${who} ${SHIP[age]} docks at ${place} laden with ${cargo}.` } });
      }
      continue;
    }
    if (target < 0 || !partnerOf(host)) { emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' }); u.tile = -1; continue; }
    const to = nextStep(view, u.tile, seaDistances(view, target));
    if (to < 0) { emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' }); u.tile = -1; continue; }
    emit({ type: 'unit_moved', unitId: u.id, from: u.tile, to, arriveTick: tick + 1 });
    u.tile = to;
  }

  // 3. A new ship now and then, for each pact, if a sea route links a port of each side.
  let afloat = mine.filter((u) => u.tile >= 0).length;
  const myPorts = structs.filter((s) => s.kind === 'port' && own[s.tile] === me).map((s) => s.tile).sort((a, b) => a - b);
  if (!myPorts.length || afloat >= MAX_TRADERS) return gain;
  const partners = [...new Set(view.relations.filter((r) => r.a === me || r.b === me).map((r) => (r.a === me ? r.b : r.a)))]
    .filter(partnerOf).sort((a, b) => a - b);
  for (const o of partners) {
    if (afloat >= MAX_TRADERS) break;
    const since = relationOf(view, me, o).since;
    const period = 30 + (h(`period:${Math.min(me, o)}:${Math.max(me, o)}:${me}`) % 31);
    const k = tick - since - 6 - (h(`phase:${me}:${o}`) % 10);
    if (k < 0 || k % period !== 0) continue;
    if (mine.some((u) => u.tile >= 0 && u.target !== undefined && own[u.target] === o)) continue;
    const theirPorts = view.structures.filter((s) => s.kind === 'port' && s.owner === o && own[s.tile] === o).map((s) => s.tile).sort((a, b) => a - b);
    let best: { from: number; to: number; len: number } | null = null;
    for (const to of theirPorts) {
      const dist = seaDistances(view, to);
      for (const from of myPorts) {
        const len = routeLength(view, from, dist);
        if (len >= 3 && (!best || len < best.len)) best = { from, to, len };
      }
    }
    if (!best) continue;
    const u: Unit = { id: p.uid('u'), owner: me, kind: 'trader', tile: best.from, strength: 1, target: best.to };
    emit({ type: 'unit_spawned', unit: u });
    units.push(u);
    afloat++;
  }
  return gain;
}
