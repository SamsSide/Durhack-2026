// The rules of the world (row A3). Everything here is a pure function of a world view: a nation
// looks at the world as IT believes it and returns only its OWN events for this tick. Each nation
// agent (row A4, server/src/agents/nation.ts) runs this against its own replica. The LLM ruler
// (row A5) only chooses a NationPolicy; these rules do the moving.
import type {
  ChronicleKind, Country, Structure, StructureKind, Terrain, Unit, World, WorldEvent,
} from '../types';
import { hashString, type Rng } from '../rng';
import { countryTiles, regionOwner, relationOf } from '../world';
import {
  WAR_EARLIEST, ageScaled, armyStrengthFor, diplomacyTurn, enemiesOf, inTruce, isCombatant, marchTurn, type WarLedger,
} from './war';
import { unrestTurn, type UnrestMemory } from './regions';
import { ageStrength, ageTurn, satelliteTurn, type AgeMemory } from './ages';
import { tradeTurn } from './trade';
import { TERRAIN_EFFECTS } from './terrain';
import { WONDER_BUILD_TICKS, WONDER_COST, planWonder, wonderBonusOf } from './wonders';

export type Focus = 'expand' | 'develop' | 'fortify' | 'attack';
export interface NationPolicy { focus: Focus; targets?: number[] }
/** Optional extra knowledge a nation brings (not stored on Country). */
export interface TurnContext {
  regionNames?: string[];
  /** What it remembers of its wars (provinces and battles won and lost per enemy), kept by its agent. */
  wars?: WarLedger;
  /** What it remembers for the unrest of its regions (provinces taken, battles fought; row A18). */
  unrest?: UnrestMemory;
  /** Its progress towards the next age and the foreign merchant ships it has seen dock (row A23). */
  ages?: AgeMemory;
}

// ---- tables ---------------------------------------------------------------------------------

const STRUCT_INCOME: Record<StructureKind, number> = { capital: 5, camp: 0.3, village: 1.2, town: 3, city: 6, farm: 1.4, port: 2.6, fort: 0, temple: 0.4, factory: 7, ruin: 0, wonder: 0 };
const STRUCT_POP: Record<StructureKind, number> = { capital: 9000, camp: 600, village: 2200, town: 6000, city: 14000, farm: 2500, port: 1800, fort: 0, temple: 300, factory: 1000, ruin: 0, wonder: 1500 };
const TRADE_KINDS: StructureKind[] = ['port', 'town', 'city', 'factory'];

export const COST = { camp: 4, village: 28, town: 80, city: 220, farm: 12, port: 20, fort: 24, temple: 28, factory: 70, army: 22, fleet: 30 } as const;
/** Upkeep a turn: bigger armies cost more (measured in the strength of its age, so better weapons cost no more to keep).
 *  Merchant ships pay their own way. */
const upkeep = (u: Unit, ageMul: number, tiles: World['tiles']): number => (u.kind === 'trader' ? 0 : u.kind === 'settler' ? 0.1
  : ((u.kind === 'fleet' ? 0.15 : 0.1) + (u.strength / ageMul) * 0.015)
    / (u.kind === 'army' ? TERRAIN_EFFECTS[tiles[u.tile]?.terrain ?? 'plains'].supply : 1));
const claimCost = (owned: number): number => 14 + owned * 2.2;

const isSettlement = (k: StructureKind): boolean => k === 'camp' || k === 'village' || k === 'town' || k === 'city' || k === 'capital';

export function nationIncome(world: World, countryId: number): number {
  const c = world.countries[countryId];
  if (!c) return 0;
  const tradeMul = 0.8 + 0.6 * c.temperament.trade;
  let inc = 0;
  for (let i = 0; i < world.owner.length; i++) if (world.owner[i] === countryId) inc += TERRAIN_EFFECTS[world.tiles[i]!.terrain].income;
  for (const s of world.structures) {
    if (s.owner !== countryId) continue;
    inc += STRUCT_INCOME[s.kind] * (TRADE_KINDS.includes(s.kind) ? tradeMul : 1);
  }
  inc *= 1 + wonderBonusOf(world.structures, countryId).income;
  for (const u of world.units) if (u.owner === countryId) inc -= upkeep(u, ageStrength(c), world.tiles);
  return inc;
}

export function populationCapacity(world: World, countryId: number): number {
  let cap = 0;
  for (let i = 0; i < world.owner.length; i++) if (world.owner[i] === countryId) cap += TERRAIN_EFFECTS[world.tiles[i]!.terrain].pop;
  for (const s of world.structures) if (s.owner === countryId) cap += STRUCT_POP[s.kind];
  return cap;
}

// ---- claim conflicts -------------------------------------------------------------------------

/** Two or more nations claim the same free tile in one tick: the lowest hash wins. Deterministic,
 *  so every replica (row A7 reconciliation) reaches the same answer. */
export function resolveClaim(tile: number, tick: number, claimants: number[]): number {
  let best = claimants[0]!, bh = Infinity;
  for (const c of claimants) {
    const h = hashString(`${tile}:${tick}:${c}`);
    if (h < bh) { bh = h; best = c; }
  }
  return best;
}

// ---- policy from temperament ----------------------------------------------------------------

const isLand = (w: World, t: number): boolean => w.tiles[t]!.terrain !== 'ocean';

function neighbourNations(world: World, countryId: number): Map<number, number> {
  const out = new Map<number, number>(); // rival id -> shared border tiles
  for (const t of countryTiles(world, countryId)) {
    for (const j of world.tiles[t]!.neighbors) {
      const o = world.owner[j]!;
      if (o >= 0 && o !== countryId && world.countries[o]?.alive) out.set(o, (out.get(o) ?? 0) + 1);
    }
  }
  return out;
}

export function autopilotPolicy(world: World, countryId: number): NationPolicy {
  const c = world.countries[countryId];
  if (!c) return { focus: 'develop' };
  const t = c.temperament;
  const mine = countryTiles(world, countryId);
  let frontier = 0;
  const seen = new Set<number>();
  for (const i of mine) for (const j of world.tiles[i]!.neighbors) {
    if (world.owner[j] === -1 && isLand(world, j) && world.tiles[j]!.terrain !== 'ice' && !seen.has(j)) { seen.add(j); frontier++; }
  }
  const rivals = neighbourNations(world, countryId);
  const wars = enemiesOf(world, countryId);
  let grudge = 0;
  for (const o of rivals.keys()) grudge = Math.max(grudge, relationOf(world, countryId, o).grievance);
  const noise = (salt: number): number => (hashString(`${countryId}:${Math.floor(world.tick / 40)}:${salt}`) % 1000) / 1000 * 0.5;
  const score: Record<Focus, number> = {
    expand: (frontier > 0 ? 0.9 : -5) + t.expansion * 1.2 + noise(1),
    develop: 0.5 + t.trade * 0.8 + t.faith * 0.4 + (frontier === 0 ? 0.3 : 0) + (c.treasury > 150 ? 0.4 : 0) + noise(2),
    fortify: rivals.size > 0 ? 0.3 + (1 - t.aggression) * 0.7 + noise(3) : -5,
    attack: wars.length ? 4 : rivals.size > 0 && mine.length >= 8 && world.tick >= WAR_EARLIEST
      ? t.aggression * 2.2 - 0.3 + grudge * 1.5 + (frontier === 0 ? 0.8 : 0) + noise(4) : -5,
  };
  let focus: Focus = 'develop';
  let best = -Infinity;
  for (const f of ['expand', 'develop', 'fortify', 'attack'] as Focus[]) if (score[f] > best) { best = score[f]; focus = f; }
  // Targets: its enemies first, then neighbours it is not friends with and has no truce with, the most
  // resented first, then the weakest.
  // A hot-blooded or aggrieved nation will tear up a trade pact; nobody on autopilot turns on an ally.
  const others = [...rivals.keys()]
    .filter((o) => {
      const r = relationOf(world, countryId, o);
      if (r.stance === 'war' || r.stance === 'alliance' || inTruce(world, countryId, o, world.tick)) return false;
      return r.stance !== 'trade' || t.aggression > 0.55 || r.grievance >= 0.12;
    })
    .map((o) => ({ o, g: relationOf(world, countryId, o).grievance, n: countryTiles(world, o).length }))
    .sort((a, b) => (b.g - a.g) || (a.n - b.n) || (a.o - b.o))
    .map((x) => x.o);
  return { focus, targets: [...wars, ...others] };
}

// ---- words -----------------------------------------------------------------------------------

interface Tone { city: string; army: string; places: string[]; proclaim: string[] }
const TONES: { match: RegExp; tone: Tone }[] = [
  { match: /bronze|stone|ancient/i, tone: { city: 'walled city', army: 'spear-bands', places: ['Ford', 'Mound', 'Reach'],
    proclaim: ['{l} of {n} sacrifices a white ox and swears the fields will be sown by spring.', 'Scribes of {n} press new laws into wet clay.', '{n} sends traders in copper carts along the river roads.'] } },
  { match: /medieval|feudal|knight/i, tone: { city: 'walled town', army: 'levies', places: ['March', 'Wold', 'Dale'],
    proclaim: ['{l} of {n} grants a charter to the market towns.', 'Bells ring across {n} as the harvest is brought in.', '{n} musters its banners at the autumn fair.'] } },
  { match: /industrial|steam|victorian/i, tone: { city: 'smoking city', army: 'regiments', places: ['Works', 'Basin', 'Sidings'],
    proclaim: ['{l} of {n} cuts the ribbon on a new railway.', 'The mills of {n} run night and day.', '{n} issues bonds to pay for its new foundries.'] } },
  { match: /post|apocal|drown|ruin|waste/i, tone: { city: 'bastion-city', army: 'scrap-legions', places: ['Flats', 'Shore', 'Reach'],
    proclaim: ['{l} of {n} tunes the old radio and finds others still alive.', 'Salvage crews of {n} drag a rusted turbine back from the tide line.', '{n} rations clean water by decree.'] } },
  { match: /ice|frozen|glacial|snow/i, tone: { city: 'hearth-city', army: 'ski-bands', places: ['Fell', 'Rime', 'Floe'],
    proclaim: ['{l} of {n} lights the long fires against the dark.', 'Hunters of {n} return across the ice with a mammoth.', '{n} counts its winters and finds more survivors than last year.'] } },
  { match: /float|archipelago|island|sky/i, tone: { city: 'harbour city', army: 'war-canoes', places: ['Lagoon', 'Reef', 'Drift'],
    proclaim: ['{l} of {n} reads the swell and sends the fleet out.', 'New outrigger yards open along the shores of {n}.', '{n} binds its islands with rope bridges and signal fires.'] } },
  { match: /./, tone: { city: 'city', army: 'host', places: ['Marches', 'Reach', 'Vale'],
    proclaim: ['{l} of {n} addresses the people from the high steps.', '{n} opens new roads between its settlements.', 'Heralds of {n} cry a new season of work.'] } },
];
const toneOf = (era: string): Tone => TONES.find((t) => t.match.test(era))!.tone;
const fill = (s: string, c: Country, r: string): string => s.replace(/\{n\}/g, c.name).replace(/\{l\}/g, c.leader).replace(/\{a\}/g, c.adjective).replace(/\{r\}/g, r);

// ---- one nation's turn -----------------------------------------------------------------------

export function nationTurn(
  view: World, countryId: number, policy: NationPolicy, tick: number, rng: Rng, ctx: TurnContext = {},
): WorldEvent[] {
  const me = view.countries[countryId];
  if (!me || !me.alive) return [];
  const t = me.temperament;
  const tone = toneOf(view.era);
  const out: WorldEvent[] = [];
  let n = 0;
  const emit = (body: Record<string, unknown> & { type: WorldEvent['type'] }): void => {
    out.push({ id: `e-${countryId}-${tick}-${n++}`, tick, actor: countryId, lamport: 0, ...body } as WorldEvent);
  };
  const uid = (p: string): string => `${p}-${countryId}-${tick}-${n}`;

  // Local working copies, so several actions in one turn see each other.
  const own = view.owner.slice();
  let treasury = me.treasury;
  const myStructs: Structure[] = view.structures.filter((s) => s.owner === countryId && s.kind !== 'ruin').map((s) => ({ ...s }));
  const structAt = new Map<number, Structure>();
  for (const s of myStructs) structAt.set(s.tile, s);
  const myUnits: Unit[] = view.units.filter((u) => u.owner === countryId).map((u) => ({ ...u }));
  const settlerTiles = new Set(myUnits.filter((u) => u.kind === 'settler').map((u) => u.tile));
  const tilesBefore = own.reduce((k, o) => k + (o === countryId ? 1 : 0), 0);
  const capRegion = view.tiles[me.capitalTile]?.region ?? -1;
  const myRegions = new Set<number>();
  for (let i = 0; i < own.length; i++) if (own[i] === countryId) myRegions.add(view.tiles[i]!.region);
  let notable: { kind: ChronicleKind; text: string } | null = null;
  let capital = me.capitalTile;
  // --- 0. the capital fell to an enemy: the court moves to the largest settlement left (row A6)
  if (own[capital] !== countryId) {
    const rank: Partial<Record<StructureKind, number>> = { city: 4, town: 3, village: 2, camp: 1 };
    const seats = myStructs.filter((s) => own[s.tile] === countryId && rank[s.kind]).sort((a, b) => (rank[b.kind]! - rank[a.kind]!) || (a.tile - b.tile));
    const seat = seats[0];
    const tiles: number[] = [];
    for (let i = 0; i < own.length; i++) if (own[i] === countryId) tiles.push(i);
    const at = seat ? seat.tile : tiles.find((i) => !structAt.has(i));
    if (at !== undefined) {
      if (seat) { emit({ type: 'structure_upgraded', structureId: seat.id, kind: 'capital' }); seat.kind = 'capital'; }
      else {
        const s: Structure = { id: uid('s'), tile: at, owner: countryId, kind: 'capital', builtTick: tick };
        emit({ type: 'structure_built', structure: s }); structAt.set(at, s); myStructs.push(s);
      }
      emit({ type: 'country_updated', countryId, patch: { capitalTile: at } });
      capital = at;
      const reg = view.regions[view.tiles[at]!.region]?.name;
      notable = { kind: 'proclamation', text: `The court of ${me.name} flees to ${reg || 'the provinces'} and raises a new capital there.` };
    }
  }
  const regionLabel = (): string => view.regions[capRegion]?.name || me.name;

  const spend = (cost: number): boolean => { if (treasury < cost) return false; treasury -= cost; return true; };
  const countKind = (k: StructureKind): number => myStructs.filter((s) => s.kind === k).length;
  const ownedCount = (): number => own.reduce((k, o) => k + (o === countryId ? 1 : 0), 0);

  // --- 1. settlers: found a camp where they stand, or walk to an empty owned tile
  let settlersLeft = myUnits.filter((u) => u.kind === 'settler').length;
  for (const u of myUnits.filter((x) => x.kind === 'settler')) {
    if (own[u.tile] === countryId && !structAt.has(u.tile)) {
      const s: Structure = { id: uid('s'), tile: u.tile, owner: countryId, kind: 'camp', builtTick: tick };
      emit({ type: 'structure_built', structure: s });
      structAt.set(u.tile, s); myStructs.push(s);
      emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' });
      settlersLeft--;
    } else if (own[u.tile] !== countryId) {
      // Its tile went to someone else (a lost claim, or news that arrived late): it goes home.
      emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' });
      settlersLeft--;
    } else if (structAt.has(u.tile)) {
      const spots = view.tiles[u.tile]!.neighbors.concat(...view.tiles[u.tile]!.neighbors.map((j) => view.tiles[j]!.neighbors))
        .filter((j) => own[j] === countryId && !structAt.has(j) && !settlerTiles.has(j));
      if (spots.length) {
        const to = spots[Math.floor(rng() * spots.length)]!;
        settlerTiles.add(to);
        emit({ type: 'unit_moved', unitId: u.id, from: u.tile, to, arriveTick: tick + Math.max(2, TERRAIN_EFFECTS[view.tiles[to]!.terrain].move) });
      } else {
        emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' });
        settlersLeft--;
      }
    }
  }

  // --- 2. claim land
  const claimable = (j: number): boolean => own[j] === -1 && view.tiles[j]!.terrain !== 'ocean';
  const rate = policy.focus === 'expand' ? 2 + (treasury > 90 ? 1 : 0) : policy.focus === 'attack' ? (rng() < 0.2 ? 1 : 0) : rng() < 0.35 ? 1 : 0;
  const reserve = policy.focus === 'expand' ? 0 : 15;
  for (let k = 0; k < rate; k++) {
    const cost = claimCost(ownedCount());
    if (treasury < cost + reserve) break;
    const adj = new Map<number, { from: number; n: number }>();
    for (let i = 0; i < own.length; i++) {
      if (own[i] !== countryId) continue;
      for (const j of view.tiles[i]!.neighbors) {
        if (!claimable(j)) continue;
        const a = adj.get(j);
        if (a) a.n++; else adj.set(j, { from: i, n: 1 });
      }
    }
    let bestTile = -1, bestScore = -Infinity, bestFrom = -1;
    for (const [j, a] of adj) {
      const terr = view.tiles[j]!.terrain;
      if ((terr === 'mountain' || terr === 'ice') && rng() > 0.1) continue;
      const reg = view.tiles[j]!.region;
      const sc = TERRAIN_EFFECTS[terr].income + TERRAIN_EFFECTS[terr].pop / 1500 + (reg === capRegion ? 0.7 : myRegions.has(reg) ? 0.35 : 0)
        + a.n * 0.18 + rng() * 0.45;
      if (sc > bestScore) { bestScore = sc; bestTile = j; bestFrom = a.from; }
    }
    if (bestTile < 0) break;
    spend(cost);
    own[bestTile] = countryId;
    myRegions.add(view.tiles[bestTile]!.region);
    emit({ type: 'tile_claimed', tile: bestTile, owner: countryId, from: -1, cause: 'expand' });
    const regId = view.tiles[bestTile]!.region;
    const reg = regId >= 0 ? view.regions[regId] : undefined;
    if (reg && !reg.name && !out.some((e) => e.type === 'region_updated' && e.regionId === regId)) {
      const used = new Set(view.regions.map((r) => r.name));
      let name = (ctx.regionNames ?? []).find((nm) => !used.has(nm));
      if (!name) {
        const base = me.adjective || me.name.split(' ')[0]!;
        const feats = tone.places;
        for (let tries = 0; tries < 12 && (!name || used.has(name)); tries++) name = `${base} ${feats[Math.floor(rng() * feats.length)]}${tries > 2 ? ` ${tries}` : ''}`;
      }
      emit({ type: 'region_updated', regionId: regId, patch: { name } });
      if (regId !== capRegion) notable ??= { kind: 'growth', text: `${me.name} settles the land the people call ${name}.` };
    }
    if (settlersLeft < 3 && rng() < 0.6 && spend(COST.camp)) {
      const terr0 = view.tiles[bestTile]!.terrain;
      const u: Unit = { id: uid('u'), owner: countryId, kind: 'settler', tile: bestFrom, strength: 1, target: bestTile };
      emit({ type: 'unit_spawned', unit: u });
      emit({ type: 'unit_moved', unitId: u.id, from: bestFrom, to: bestTile, arriveTick: tick + Math.max(2, TERRAIN_EFFECTS[terr0].move) });
      settlerTiles.add(bestTile);
      settlersLeft++;
    }
  }
  const tilesAfter = ownedCount();
  for (const m of [10, 20, 30, 45, 60]) {
    if (tilesBefore < m && tilesAfter >= m) notable = { kind: 'growth', text: `${me.name} now rules ${m} provinces, and its borders touch the horizon.` };
  }

  // --- 3. build and upgrade
  const empty = (): number[] => {
    const r: number[] = [];
    for (let i = 0; i < own.length; i++) if (own[i] === countryId && !structAt.has(i) && !settlerTiles.has(i)) r.push(i);
    return r;
  };
  const borderTiles = (): number[] => empty().filter((i) => view.tiles[i]!.neighbors.some((j) => own[j] !== countryId && own[j] >= 0));
  const pickRand = (a: number[]): number => a[Math.floor(rng() * a.length)]!;
  const place = (tile: number, kind: StructureKind): void => {
    const s: Structure = { id: uid('s'), tile, owner: countryId, kind, builtTick: tick };
    emit({ type: 'structure_built', structure: s });
    structAt.set(tile, s); myStructs.push(s);
  };
  const pop = me.population;
  const upgradeNext: Partial<Record<StructureKind, [StructureKind, number, number, number]>> = {   // next, cost, min pop, min age
    camp: ['village', COST.village, 0, 6], village: ['town', COST.town, 3500, 16], town: ['city', COST.city, 9000, 30],
  };
  const tryUpgrade = (): boolean => {
    const owned = ownedCount();
    const room = (k: StructureKind): boolean => k !== 'city' || countKind('city') < 1 + Math.floor(owned / 7);
    const cand = myStructs.filter((s) => { const u = upgradeNext[s.kind]; return u && room(u[0]) && treasury >= u[1] && pop >= u[2] && tick - s.builtTick >= u[3]; });
    if (!cand.length) return false;
    cand.sort((a, b) => (STRUCT_POP[b.kind] - STRUCT_POP[a.kind]) || (rng() - 0.5));
    const s = cand[0]!;
    const [next, cost] = upgradeNext[s.kind]!;
    spend(cost);
    emit({ type: 'structure_upgraded', structureId: s.id, kind: next });
    s.kind = next; s.builtTick = tick;
    if (next === 'city' && countKind('city') === 1) notable = { kind: 'growth', text: `${me.name} raises its first great ${tone.city}, and the old camps look small beside it.` };
    return true;
  };
  const tryFarm = (): boolean => {
    const spots = empty().filter((i) => ['plains', 'coast', 'forest', 'hills'].includes(view.tiles[i]!.terrain));
    if (!spots.length || treasury < COST.farm) return false;
    const plain = spots.filter((i) => view.tiles[i]!.terrain === 'plains' || view.tiles[i]!.terrain === 'coast');
    spend(COST.farm); place(pickRand(plain.length ? plain : spots), 'farm'); return true;
  };
  const tryPort = (): boolean => {
    if (treasury < COST.port || countKind('port') >= Math.max(1, Math.floor(ownedCount() / 6))) return false;
    const spots = empty().filter((i) => view.tiles[i]!.neighbors.some((j) => view.tiles[j]!.terrain === 'ocean'));
    if (!spots.length) return false;
    spend(COST.port); place(pickRand(spots), 'port'); return true;
  };
  const tryFort = (): boolean => {
    if (treasury < COST.fort || countKind('fort') >= Math.max(1, Math.floor(ownedCount() / 5))) return false;
    const spots = borderTiles();
    if (!spots.length) return false;
    spend(COST.fort); place(pickRand(spots), 'fort'); return true;
  };
  const tryTemple = (): boolean => {
    if (treasury < COST.temple || countKind('temple') >= Math.max(1, Math.floor(ownedCount() / 10))) return false;
    const spots = empty();
    if (!spots.length) return false;
    spend(COST.temple); place(pickRand(spots), 'temple'); return true;
  };
  const tryFactory = (): boolean => {
    if (treasury < Math.max(COST.factory, 100) || countKind('city') < 1 || countKind('factory') >= countKind('city')) return false;
    const spots = empty();
    if (!spots.length) return false;
    spend(COST.factory); place(pickRand(spots), 'factory'); return true;
  };
  const enemies = enemiesOf(view, countryId);
  const foes = new Set([...enemies, ...(policy.focus === 'attack' ? policy.targets ?? [] : [])]);
  const wantArmies = policy.focus === 'attack' ? Math.min(6, 2 + Math.floor(ownedCount() / 10))
    : policy.focus === 'fortify' ? Math.min(4, 1 + Math.floor(ownedCount() / 12))
      : t.aggression > 0.5 ? Math.min(3, 1 + Math.floor(ownedCount() / 15)) : 0;
  const trySpawn = (kind: 'army' | 'fleet'): boolean => {
    const forts = countKind('fort');
    if (kind === 'army') {
      const base = armyStrengthFor({ ...me, treasury }, forts);
      const strength = ageScaled(me, base);
      const cost = 10 + base * 0.6 * (1 + 0.15 * (ageStrength(me) - 1));
      if (treasury < cost || myUnits.filter((u) => u.kind === 'army').length >= wantArmies) return false;
      // Raised at a fort facing the enemy if there is one, else at the capital.
      const seats = [capital, ...myStructs.filter((s) => s.kind === 'fort').map((s) => s.tile)].filter((i) => own[i] === countryId);
      const facing = seats.filter((i) => view.tiles[i]!.neighbors.some((j) => foes.has(own[j]!)));
      const at = facing.length ? facing[Math.floor(rng() * facing.length)]! : seats[0];
      if (at === undefined) return false;
      spend(cost);
      const u: Unit = { id: uid('u'), owner: countryId, kind: 'army', tile: at, strength };
      emit({ type: 'unit_spawned', unit: u }); myUnits.push(u); return true;
    }
    const ports = myStructs.filter((s) => s.kind === 'port');
    if (!ports.length || treasury < COST.fleet || myUnits.filter((u) => u.kind === 'fleet').length >= Math.ceil(ports.length / 2)) return false;
    const p = ports[Math.floor(rng() * ports.length)]!;
    const sea = view.tiles[p.tile]!.neighbors.find((j) => view.tiles[j]!.terrain === 'ocean');
    if (sea === undefined) return false;
    spend(COST.fleet);
    const strength = ageScaled(me, Math.max(5, Math.round(armyStrengthFor({ ...me, treasury }, forts) * 0.6)));
    const u: Unit = { id: uid('u'), owner: countryId, kind: 'fleet', tile: sea, strength };
    emit({ type: 'unit_spawned', unit: u }); myUnits.push(u); return true;
  };

  const dev = policy.focus === 'develop';
  const options: { w: number; run: () => boolean }[] = [
    { w: dev ? 4 : 2.2, run: tryUpgrade },
    { w: dev ? 3.2 : 1.6, run: tryFarm },
    { w: 1 + t.trade * 2.5, run: tryPort },
    { w: policy.focus === 'fortify' ? 4 : policy.focus === 'attack' ? 1.5 : 0.3 + t.aggression * 0.6, run: tryFort },
    { w: t.faith > 0.4 ? 0.6 + t.faith * 2.4 : 0.1, run: tryTemple },
    { w: dev ? 0.5 + t.trade * 2 : 0.3, run: tryFactory },
    { w: enemies.length ? 6 : policy.focus === 'attack' ? 4 : policy.focus === 'fortify' ? 2 : t.aggression > 0.5 ? 1 : 0, run: () => trySpawn('army') },
    { w: (0.3 + t.trade * 0.9) * (enemies.length ? 2 : 1), run: () => trySpawn('fleet') },
  ];
  const slots = dev ? 2 + (rng() < 0.4 ? 1 : 0) : rng() < 0.7 ? 1 : 0;
  for (let s = 0; s < slots; s++) {
    const pool = options.filter((o) => o.w > 0);
    while (pool.length) {
      const total = pool.reduce((a, o) => a + o.w, 0);
      let r = rng() * total, idx = 0;
      for (; idx < pool.length - 1; idx++) { r -= pool[idx]!.w; if (r <= 0) break; }
      if (pool[idx]!.run()) break;
      pool.splice(idx, 1);
    }
  }

  // --- 3b. wonders (row A30, sim/wonders.ts): finish the one being built; start one when rich, at peace and past tick 120
  for (const w of myStructs) {
    if (w.kind === 'wonder' && !w.complete && own[w.tile] === countryId && tick - w.builtTick >= WONDER_BUILD_TICKS) {
      emit({ type: 'wonder_built', countryId, structureId: w.id });
      w.complete = true;
      out.push({ id: `c-${countryId}-${tick}-wonderdone`, tick, actor: countryId, lamport: 0, type: 'chronicle',
        entry: { id: `c-${countryId}-${tick}-wonderdone`, tick, year: view.year, kind: 'wonder', countries: [countryId], text: `${w.name ?? 'A great wonder'} is finished, and ${me.name} stands taller for it.` } });
    }
  }
  if (!enemies.length && treasury >= WONDER_COST) {
    const plan = planWonder(view, countryId, tick, capital, treasury,
      (i) => own[i] === countryId && !structAt.has(i) && !settlerTiles.has(i),
      (i) => { const o = structAt.get(i); return own[i] === countryId && o && (o.kind === 'farm' || o.kind === 'camp' || o.kind === 'temple') && !settlerTiles.has(i) ? o.id : undefined; }, myStructs);
    if (plan) {
      spend(WONDER_COST);
      if (plan.clear) {
        emit({ type: 'structure_destroyed', structureId: plan.clear });
        const gone = myStructs.findIndex((x) => x.id === plan.clear);
        if (gone >= 0) myStructs.splice(gone, 1);
        structAt.delete(plan.tile);
      }
      const id = uid('w');
      emit({ type: 'wonder_started', countryId, structureId: id, tile: plan.tile, wonder: plan.kind, name: plan.name });
      const w: Structure = { id, tile: plan.tile, owner: countryId, kind: 'wonder', builtTick: tick, wonder: plan.kind, name: plan.name, complete: false };
      structAt.set(plan.tile, w); myStructs.push(w);
      out.push({ id: `c-${countryId}-${tick}-wonder`, tick, actor: countryId, lamport: 0, type: 'chronicle',
        entry: { id: `c-${countryId}-${tick}-wonder`, tick, year: view.year, kind: 'wonder', countries: [countryId], text: `${me.name} lays the first stones of ${plan.name}.` } });
    }
  }

  // --- 4. diplomacy and war (row A6, sim/war.ts): alliances, peace, declarations, trade; then the march
  diplomacyTurn({ view, me: countryId, tick, rng, focus: policy.focus, targets: policy.targets ?? [], ledger: ctx.wars, own, emit });
  marchTurn({ view, me: countryId, tick, rng, focus: policy.focus, targets: policy.targets ?? [], own, units: myUnits.filter(isCombatant), emit, uid });
  // Spent armies go home (one a turn), which frees a place for a fresh one.
  const spent = myUnits.find((u) => isCombatant(u) && u.tile >= 0 && u.strength <= (enemies.length ? 5 : 3));
  if (spent) { emit({ type: 'unit_removed', unitId: spent.id, reason: 'disband' }); spent.tile = -1; }

  // --- 4.1 attrition (row A28): an army outside its own land loses strength on hostile ground, in canonical unit order
  const gone = new Set(out.flatMap((e) => (e.type === 'unit_removed' ? [e.unitId] : [])));
  for (const u of view.units) {
    if (u.owner !== countryId || u.kind !== 'army' || u.tile < 0 || gone.has(u.id) || own[u.tile] === countryId) continue;
    const terr = view.tiles[u.tile]!.terrain;
    const rate = TERRAIN_EFFECTS[terr].attrition;
    if (terr === 'ocean' || rate <= 0) continue;
    const loss = Math.max(1, Math.round(u.strength * rate));
    if (u.strength > 3 && u.strength - loss > 2) emit({ type: 'unit_attrition', unitId: u.id, loss, terrain: terr });
    else emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' });
  }

  // --- 4a. sea trade (row A23, sim/trade.ts): merchant ships sail, dock and bring money to both sides
  treasury += tradeTurn({ view, me: countryId, tick, own, structs: myStructs, units: myUnits, emit, uid, mem: ctx.ages });

  // --- 4b. the unrest of its regions, as it sees it (row A18, sim/regions.ts)
  unrestTurn(view, countryId, tick, emit, ctx.unrest, ctx.wars);

  // --- 5. money and people
  let income = 0;
  for (let i = 0; i < own.length; i++) if (own[i] === countryId) income += TERRAIN_EFFECTS[view.tiles[i]!.terrain].income;
  const tradeMul = 0.8 + 0.6 * t.trade;
  for (const s of myStructs) income += STRUCT_INCOME[s.kind] * (TRADE_KINDS.includes(s.kind) ? tradeMul : 1);
  income *= 1 + wonderBonusOf(myStructs, countryId).income;
  for (const u of myUnits) if (u.tile >= 0) income -= upkeep(u, ageStrength(me), view.tiles);
  treasury = Math.max(0, treasury + income * 0.4 - treasury * 0.01);
  let cap = 0;
  for (let i = 0; i < own.length; i++) if (own[i] === countryId) cap += TERRAIN_EFFECTS[view.tiles[i]!.terrain].pop;
  for (const s of myStructs) cap += STRUCT_POP[s.kind];
  const newPop = Math.max(500, Math.round(pop + (cap - pop) * 0.05 + pop * 0.004 + (rng() - 0.5) * 20));
  for (const m of [10000, 25000, 50000, 100000, 200000]) {
    if (pop < m && newPop >= m) notable = { kind: 'growth', text: `The people of ${me.name} number ${m.toLocaleString('en-GB')} and more.` };
  }
  emit({ type: 'country_updated', countryId, patch: { population: newPop, treasury: Math.round(treasury * 10) / 10 } });

  // --- 5b. its age (row A23, sim/ages.ts): progress from its own state; one step at most a year
  const next = ageTurn(view, countryId, myStructs.filter((s) => own[s.tile] === countryId), treasury, ctx.ages);
  if (next) {
    emit({ type: 'country_updated', countryId, patch: { techAge: next.age } });
    emit({ type: 'chronicle', entry: { id: `c-${countryId}-${tick}-age`, tick, year: view.year, kind: next.kind, countries: [countryId], text: next.text } });
  }

  const sat = satelliteTurn(view, countryId, tick, ctx.ages);   // view still holds last year's age, so a launch comes the year after arrival
  if (sat) emit({ type: 'chronicle', entry: { id: `c-${countryId}-${tick}-sat`, tick, year: view.year, kind: 'growth', countries: [countryId], text: sat } });

  // --- 6. the chronicle: milestones first, now and then a proclamation
  if (!notable && rng() < 0.014) notable = { kind: 'proclamation', text: fill(tone.proclaim[Math.floor(rng() * tone.proclaim.length)]!, me, regionLabel()) };
  if (!notable && policy.focus === 'attack' && rng() < 0.01) notable = { kind: 'proclamation', text: `The ${tone.army} of ${me.name} gather at the frontier.` };
  if (notable) {
    emit({ type: 'chronicle', entry: { id: `c-${countryId}-${tick}`, tick, year: view.year, kind: notable.kind, countries: [countryId], text: notable.text } });
  }
  return out;
}

// ---- validation ------------------------------------------------------------------------------

/** Cheap legality check against the world an event is about to be applied to. */
export function isEventValid(world: World, e: WorldEvent): boolean {
  if (typeof e.actor !== 'number') return true;
  const a = e.actor;
  if (!world.countries[a]?.alive) return false;
  switch (e.type) {
    case 'tile_claimed':
      // A nation claims for itself, or cedes its own province by treaty (cause 'conquest', from itself).
      return (e.owner === a || (e.from === a && e.cause === 'conquest' && e.owner >= 0)) && world.tiles[e.tile] !== undefined
        && world.tiles[e.tile]!.terrain !== 'ocean' && world.owner[e.tile] === e.from && (e.cause !== 'expand' || e.from === -1);
    case 'structure_built':
      return e.structure.owner === a && world.owner[e.structure.tile] === a
        && !world.structures.some((s) => s.tile === e.structure.tile && s.kind !== 'ruin')
        && !world.structures.some((s) => s.id === e.structure.id);
    case 'wonder_started':
      return e.countryId === a && world.owner[e.tile] === a && !world.structures.some((s) => s.id === e.structureId || (s.tile === e.tile && s.kind !== 'ruin'));
    case 'wonder_built':
      return e.countryId === a && world.structures.some((s) => s.id === e.structureId && s.owner === a && s.kind === 'wonder');
    case 'structure_upgraded':
      return world.structures.some((s) => s.id === e.structureId && s.owner === a);
    case 'unit_spawned':
      return e.unit.owner === a && !world.units.some((u) => u.id === e.unit.id);
    case 'unit_moved':
    case 'unit_attrition':
    case 'unit_removed':
      return world.units.some((u) => u.id === e.unitId && u.owner === a);
    case 'country_updated':
      return e.countryId === a;
    case 'relation_changed':
      return (e.a === a || e.b === a) && e.a !== e.b && !!world.countries[e.a === a ? e.b : e.a];
    case 'region_updated':
      // A nation names a region once; only the nation holding a region's main town reports its unrest.
      return world.regions[e.regionId] !== undefined && (e.patch.name === undefined || world.regions[e.regionId]!.name === '')
        && (e.patch.unrest === undefined || regionOwner(world, e.regionId) === a);
    default:
      return true;
  }
}
