// War and diplomacy (row A6). Two halves, both pure:
//
// 1. Battles are settled inside applyTickBatch (sync.ts), not by the nation that attacks. An attack is
//    only an intent: an army's `unit_moved` into a province held by a nation it is at war with (or onto
//    enemy units). Every replica that applies the batch calls settleMove on its own copy of the world,
//    in the same canonical order, and resolveBattle is a pure function of both sides' strength, the
//    terrain, the fort and a hash of (tile, tick, unit ids). So every agent, the true world and the
//    browser reach the same winner, losses, captured province and fall, with no referee.
// 2. Diplomacy is decided by each nation on its own replica (diplomacyTurn, called from nationTurn).
//    Anything that needs both sides goes through an offer both can see: a chronicle line whose id is
//    `c-<from>-<tick>-offer-<peace|trade|alliance>-<to>`. The other side reads it on its own replica and
//    accepts (or not) on its own turn with a relation_changed. War needs one side; peace, trade and
//    alliance need two.
import type {
  ChronicleKind, Country, Stance, StructureKind, Terrain, Unit, World, WorldEvent,
} from '../types';
import { hashString, mulberry32, type Rng } from '../rng';
import { countryTiles, relationOf } from '../world';
import { TERRAIN_EFFECTS, LANDING_PENALTY } from './terrain';
import { wonderBonusOf } from './wonders';
import { AGE_EDGE, STRENGTH_CAP, ageIndex, ageStrength } from './ages';
import { coverMultiplier, deathEvents, generalFalls } from './council';

/** No nation declares a war of its own before this tick. */
export const WAR_EARLIEST = 70;
/** After any change of stance, no new war between the pair for this long. */
export const TRUCE_TICKS = 50;
/** An offer stays open this long. */
const OFFER_TTL = 30;

// ---- strength -------------------------------------------------------------------------------

const GARRISON: Partial<Record<StructureKind, number>> = { camp: 1, village: 3, town: 6, city: 10, capital: 14, fort: 12, port: 2 };
const RAZEABLE: StructureKind[] = ['farm', 'port', 'fort', 'temple', 'factory'];

/** Units that fight: armies and fleets (settlers and merchant ships do not). */
export const isCombatant = (u: Unit): boolean => u.kind === 'army' || u.kind === 'fleet';

/** Sum of a nation's army and fleet strength (the "strength" map mode adds the same numbers). */
export function militaryStrength(world: World, countryId: number): number {
  let s = 0;
  for (const u of world.units) if (u.owner === countryId && isCombatant(u)) s += u.strength;
  return s;
}

/** Strength of a newly raised army: grows with people, money and forts. Roughly 5 to 60. */
export function armyStrengthFor(c: Country, forts: number): number {
  return Math.round(Math.max(5, Math.min(60, 4 + c.population / 4000 + forts * 1.5 + Math.min(c.treasury, 300) / 30)));
}

/** Strength of a unit raised now in a nation's age (row A23), kept under STRENGTH_CAP. */
export function ageScaled(c: Country, base: number): number {
  return Math.min(STRENGTH_CAP, Math.round(base * ageStrength(c)));
}

/** The local defence of a province with no army in it: militia from its settlement or fort, armed for its age. */
export function garrisonAt(world: World, tile: number, owner: number): { strength: number; fort: boolean } {
  if (owner < 0) return { strength: 0, fort: false };
  let strength = 3 + Math.min(15, Math.floor((world.countries[owner]?.population ?? 0) / 20000));
  let fort = false;
  for (const s of world.structures) {
    if (s.tile !== tile || s.owner !== owner) continue;
    strength += GARRISON[s.kind] ?? 0;
    if (s.kind === 'fort' || s.kind === 'capital') fort = true;
  }
  return { strength: Math.round(strength * ageStrength(world.countries[owner])), fort };
}

/** What an attacker expects to face on a tile (its units plus garrison, with terrain and fort). */
export function defenceEstimate(world: World, tile: number, defender: number): number {
  let d = 0;
  for (const u of world.units) if (u.tile === tile && u.owner === defender && isCombatant(u)) d += u.strength;
  const g = world.owner[tile] === defender ? garrisonAt(world, tile, defender) : { strength: 0, fort: false };
  return (d + g.strength) * (1 + wonderBonusOf(world.structures, defender).defence) * (1 + TERRAIN_EFFECTS[world.tiles[tile]!.terrain].defence) * (g.fort ? 1.5 : 1);
}

// ---- the battle -----------------------------------------------------------------------------

export interface BattleInput {
  attack: number; defend: number; terrain: Terrain; fort: boolean; seed: number;
  /** The attacker's age minus the defender's (row A23): each step ahead is an AGE_EDGE multiplier. */
  ageGap?: number;
}
export interface BattleResult { attackerWins: boolean; lossA: number; lossD: number }

/**
 * The one pure battle function. Same inputs, same result, on every replica. The defender gets
 * terrain (hills, mountains, forest) and fort bonuses; the odds follow a square-ish law, so a much
 * bigger army nearly always wins but an even fight is a coin toss. Losses are in strength points.
 * The more advanced side (row A23) fights as if a little bigger and loses a little less.
 */
export function resolveBattle(b: BattleInput): BattleResult {
  const rnd = mulberry32(b.seed);
  const roll = rnd();
  const u = rnd();
  const gap = b.ageGap ?? 0;
  const edgeA = AGE_EDGE ** Math.max(0, gap);
  const edgeD = AGE_EDGE ** Math.max(0, -gap);
  const A = Math.max(0.5, b.attack * edgeA);
  const D = Math.max(0.5, b.defend * edgeD * (1 + TERRAIN_EFFECTS[b.terrain].defence) * (b.fort ? 1.5 : 1));
  const p = A ** 1.6 / (A ** 1.6 + D ** 1.6);
  if (roll < p) {
    const lossA = Math.max(0, Math.min(Math.round((b.defend * (0.25 + 0.35 * u)) / edgeA), Math.floor(b.attack) - 3));
    return { attackerWins: true, lossA, lossD: Math.round(b.defend) };
  }
  const lossA = Math.max(1, Math.min(Math.round(b.attack * (0.35 + 0.35 * u)), Math.ceil(b.attack)));
  const lossD = Math.max(0, Math.min(Math.round((b.attack * (0.12 + 0.2 * u)) / edgeD), Math.round(b.defend)));
  return { attackerWins: false, lossA, lossD };
}

const atWar = (world: World, a: number, b: number): boolean =>
  b >= 0 && a !== b && !!world.countries[b]?.alive && relationOf(world, a, b).stance === 'war';

const placeName = (world: World, tile: number, fallback: string): string => {
  const r = world.tiles[tile]?.region ?? -1;
  return (r >= 0 && world.regions[r]?.name) || fallback;
};

/** A nation falls when it loses its capital and is left small, or is down to its last two provinces. */
export function shouldFall(left: number, capitalTaken: boolean, conquerorTiles: number): boolean {
  return left <= 3 || (capitalTaken && left <= Math.max(12, Math.floor(conquerorTiles * 0.7)));
}

/**
 * Settles one `unit_moved` against a replica, before it is applied. Returns null for an ordinary move
 * (apply the event as it is), [] to drop it (an army may not walk into a neutral nation's land), or
 * the events that really happen: the battle, removed units, the move itself if the attacker won, the
 * captured province, razed buildings, a fallen nation. Derived events carry the attacker as actor and
 * ids built from the move's id, so every replica derives identical events.
 */
export function settleMove(world: World, e: Extract<WorldEvent, { type: 'unit_moved' }>): WorldEvent[] | null {
  const u = world.units.find((x) => x.id === e.unitId);
  if (!u || u.kind === 'settler') return null;
  const a = u.owner;
  const to = e.to;
  const tile = world.tiles[to];
  if (!tile) return [];
  const out: WorldEvent[] = [];
  let k = 0;
  const mk = (body: Record<string, unknown> & { type: WorldEvent['type'] }): void => {
    out.push({ id: `${e.id}-w${k++}`, tick: e.tick, actor: a, lamport: e.lamport, ...body } as WorldEvent);
  };
  // Merchant ships (row A23) never fight: one that sails onto an enemy fleet is sunk; a fleet that sails
  // onto enemy merchant ships at sea sinks them.
  if (u.kind === 'trader') {
    const sinker = world.units.find((v) => v.tile === to && v.kind === 'fleet' && atWar(world, a, v.owner));
    if (!sinker) return null;
    mk({ type: 'unit_removed', unitId: u.id, reason: 'battle' });
    if ((hashString(`sink:${u.id}`) % 100) < 40) {
      const S = world.countries[sinker.owner]!;
      mk({ type: 'chronicle', entry: { id: `c-${e.id}-s`, tick: e.tick, year: world.year, kind: 'battle', countries: [sinker.owner, a],
        text: `Warships of ${S.name} sink a merchant ship of ${world.countries[a]!.name} on the open sea.` } });
    }
    return out;
  }
  const sinkTraders = (): void => {
    if (u.kind !== 'fleet' || tile.terrain !== 'ocean') return;
    for (const v of world.units) {
      if (v.tile === to && v.kind === 'trader' && atWar(world, a, v.owner)) mk({ type: 'unit_removed', unitId: v.id, reason: 'battle' });
    }
  };
  const tileOwner = world.owner[to] ?? -1;
  const foes = world.units.filter((v) => v.tile === to && v.owner !== a && isCombatant(v) && atWar(world, a, v.owner));
  const defender = atWar(world, a, tileOwner) ? tileOwner : foes.length ? foes[0]!.owner : -1;
  if (defender < 0) {
    if (u.kind === 'fleet' && tile.terrain !== 'ocean') return [];
    if (u.kind === 'army' && tileOwner >= 0 && tileOwner !== a && relationOf(world, a, tileOwner).stance !== 'alliance') return [];
    sinkTraders();
    if (!out.length) return null;
    return [e, ...out];
  }

  const defUnits = world.units.filter((v) => v.tile === to && v.owner === defender && isCombatant(v));
  const holds = tileOwner === defender;
  const g = holds ? garrisonAt(world, to, defender) : { strength: 0, fort: false };
  const defendRaw = defUnits.reduce((s, v) => s + v.strength, 0) + g.strength;
  // An army that attacks from the sea fights at a penalty (row A28).
  const landing = u.kind === 'army' && tile.terrain !== 'ocean' && world.tiles[u.tile]?.terrain === 'ocean' ? 1 - LANDING_PENALTY : 1;
  const raid = u.kind === 'fleet' && tile.terrain !== 'ocean';
  const seed = hashString(`battle:${to}:${e.tick}:${u.id}:${defUnits.map((v) => v.id).join(',')}`);
  const ageGap = ageIndex(world.countries[a]?.techAge) - ageIndex(world.countries[defender]?.techAge);
  // While the ruler covers a fallen or cut-off general, the armies fight at COVER_STRENGTH (row A29).
  const cover = coverMultiplier(world, a);
  const r = resolveBattle({ attack: u.strength * (raid ? 0.7 : 1) * landing * cover, defend: defendRaw * (1 + wonderBonusOf(world.structures, defender).defence), terrain: tile.terrain, fort: g.fort, seed, ageGap });
  const winner = r.attackerWins ? a : defender;
  mk({ type: 'battle', tile: to, attacker: a, defender, attackerUnit: u.id, winner, losses: { attacker: r.lossA, defender: r.lossD } });
  // The loser's general may fall in a big battle (row A29); derived here, so every replica agrees.
  const loser = r.attackerWins ? defender : a;
  const generalFell = generalFalls(world, loser, u.strength + defendRaw, seed);

  const A = world.countries[a]!;
  const Dc = world.countries[defender]!;
  const place = placeName(world, to, `the borderlands of ${Dc.name}`);
  const noteRoll = (seed % 1000) / 1000;
  let chron: { kind: ChronicleKind; text: string } | null = null;

  if (!r.attackerWins) {
    if (u.strength - r.lossA <= 2) mk({ type: 'unit_removed', unitId: u.id, reason: 'battle' });
    let left = r.lossD;
    for (const v of defUnits) {
      const take = Math.min(left, v.strength);
      left -= take;
      if (v.strength - take <= 0) mk({ type: 'unit_removed', unitId: v.id, reason: 'battle' });
    }
    const big = u.strength + defendRaw >= 50;
    if ((big && noteRoll < 0.5) || noteRoll < 0.07) {
      chron = { kind: 'battle', text: `The armies of ${A.name} break against the defenders of ${Dc.name} at ${place}.` };
    }
  } else {
    const removed = new Set<string>();
    for (const v of world.units) {
      if (v.tile === to && v.owner === defender) { mk({ type: 'unit_removed', unitId: v.id, reason: 'battle' }); removed.add(v.id); }
    }
    if (!raid) {
      out.push(e);
      for (const v of world.units) {
        if (v.tile === to && v.kind === 'trader' && !removed.has(v.id) && u.kind === 'fleet' && atWar(world, a, v.owner)) {
          mk({ type: 'unit_removed', unitId: v.id, reason: 'battle' }); removed.add(v.id);
        }
      }
    }
    if (holds) {
      mk({ type: 'tile_claimed', tile: to, owner: a, from: defender, cause: 'conquest' });
      const capitalTaken = Dc.capitalTile === to;
      // Row A27: a sacked town or city pays its conqueror; a fallen capital hands over a share of the treasury.
      // The payer's balance is the one this replica holds now; applyTickBatch applies it after the batch's income.
      const prize = world.structures.find((s) => s.tile === to && s.owner === defender && (s.kind === 'capital' || s.kind === 'city' || s.kind === 'town'));
      if (prize && Dc.treasury >= 2) {
        const willFall = shouldFall(countryTiles(world, defender).length - 1, capitalTaken, countryTiles(world, a).length + 1);
        const share = capitalTaken ? (willFall ? 0.7 : 0.3) : prize.kind === 'city' ? 0.12 : 0.07;
        const amount = Math.round(Math.max(1, Dc.treasury * share) * 100) / 100;
        mk({ type: 'payment', from: defender, to: a, amount, reason: capitalTaken ? 'seizure' : 'plunder',
          note: capitalTaken ? `the fall of the capital at ${place}` : `the sack of ${place}` });
      }
      for (const s of world.structures) {
        if (s.tile !== to || s.owner !== defender || s.kind === 'ruin') continue;
        if (s.kind === 'capital') mk({ type: 'structure_upgraded', structureId: s.id, kind: 'city' });
        else if (s.kind === 'wonder' && (hashString(`raze:${s.id}:${e.tick}`) % 100) < 20) mk({ type: 'structure_upgraded', structureId: s.id, kind: 'ruin' });
        else if (RAZEABLE.includes(s.kind) && (hashString(`raze:${s.id}:${e.tick}`) % 100) < 25) mk({ type: 'structure_destroyed', structureId: s.id });
      }
      const left = countryTiles(world, defender).length - 1;
      const conquerorTiles = countryTiles(world, a).length + 1;
      if (shouldFall(left, capitalTaken, conquerorTiles)) {
        mk({ type: 'country_fell', countryId: defender, conqueror: a });
        for (let t = 0; t < world.owner.length; t++) {
          if (t !== to && world.owner[t] === defender) mk({ type: 'tile_claimed', tile: t, owner: -1, from: defender, cause: 'collapse' });
        }
        for (const v of world.units) if (v.owner === defender && !removed.has(v.id)) mk({ type: 'unit_removed', unitId: v.id, reason: 'collapse' });
        for (const rel of world.relations) {
          if ((rel.a === defender || rel.b === defender) && rel.stance !== 'neutral') {
            mk({ type: 'relation_changed', a: rel.a, b: rel.b, stance: 'neutral', reason: `${Dc.name} is no more` });
          }
        }
        chron = {
          kind: 'fall',
          text: capitalTaken
            ? `${Dc.name} falls. ${A.name} takes its capital at ${place}, and its last provinces scatter into free towns and empty land.`
            : `${Dc.name} falls to ${A.name}. Its last provinces scatter into free towns and empty land.`,
        };
      } else if (capitalTaken) {
        chron = { kind: 'battle', text: `${A.name} storms the capital of ${Dc.name} at ${place}. Its court flees to the provinces.` };
      } else if ((u.strength + defendRaw >= 50 && noteRoll < 0.5) || noteRoll < 0.1) {
        chron = { kind: 'battle', text: `The armies of ${A.name} take ${place} from ${Dc.name}.` };
      }
    } else if (noteRoll < (raid ? 0.3 : 0.15)) {
      chron = { kind: 'battle', text: `${A.name} routs an army of ${Dc.name} at ${place}.` };
    }
  }
  if (chron) {
    mk({ type: 'chronicle', entry: { id: `c-${e.id}-b`, tick: e.tick, year: world.year, kind: chron.kind, countries: [a, defender], text: chron.text } });
  }
  if (generalFell && !out.some((x) => x.type === 'country_fell' && x.countryId === loser)) {
    for (const body of deathEvents(world, loser, 'general', 'death', { entryId: `c-${e.id}-gd`, tick: e.tick, year: world.year }, place)) mk(body);
  }
  return out;
}

// ---- what each nation remembers of its wars (kept by its agent, from the events it applied) ----

export interface WarTally { gained: number; lost: number; won: number; lostBattles: number }
export type WarLedger = Map<number, WarTally>;

const tallyOf = (l: WarLedger, other: number): WarTally => {
  let t = l.get(other);
  if (!t) { t = { gained: 0, lost: 0, won: 0, lostBattles: 0 }; l.set(other, t); }
  return t;
};

/** Updates one nation's ledger from a batch it applied (provinces won and lost, battles, per enemy). */
export function noteWarEvents(ledger: WarLedger, me: number, applied: WorldEvent[]): void {
  for (const e of applied) {
    if (e.type === 'relation_changed' && (e.a === me || e.b === me)) {
      if (e.stance === 'war') ledger.set(e.a === me ? e.b : e.a, { gained: 0, lost: 0, won: 0, lostBattles: 0 });
    } else if (e.type === 'tile_claimed' && e.cause === 'conquest' && e.owner >= 0 && e.from >= 0) {
      if (e.owner === me) tallyOf(ledger, e.from).gained++;
      else if (e.from === me) tallyOf(ledger, e.owner).lost++;
    } else if (e.type === 'battle' && (e.attacker === me || e.defender === me)) {
      const other = e.attacker === me ? e.defender : e.attacker;
      if (e.winner === me) tallyOf(ledger, other).won++; else tallyOf(ledger, other).lostBattles++;
    } else if (e.type === 'country_fell') {
      ledger.delete(e.countryId);
    }
  }
}

// ---- diplomacy, from one nation's own replica ------------------------------------------------

export type OfferKind = 'peace' | 'trade' | 'alliance';
const OFFER_RE = /^c-(\d+)-(\d+)-offer-(peace|trade|alliance)-(\d+)$/;
export const offerId = (from: number, tick: number, kind: OfferKind, to: number): string => `c-${from}-${tick}-offer-${kind}-${to}`;

/** Open offers in a replica's chronicle: key `${kind}:${from}:${to}`, value the tick it was made. */
export function openOffers(world: World, tick: number): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = world.chronicle.length - 1; i >= 0; i--) {
    const c = world.chronicle[i]!;
    if (c.tick < tick - OFFER_TTL) break;
    const m = OFFER_RE.exec(c.id);
    if (m) { const key = `${m[3]}:${m[1]}:${m[4]}`; if (!out.has(key)) out.set(key, c.tick); }
  }
  return out;
}

/** Nations this one is at war with (alive). */
export function enemiesOf(world: World, me: number): number[] {
  const out: number[] = [];
  for (const r of world.relations) {
    if (r.stance !== 'war') continue;
    const o = r.a === me ? r.b : r.b === me ? r.a : -1;
    if (o >= 0 && world.countries[o]?.alive) out.push(o);
  }
  return out.sort((x, y) => x - y);
}

/** Alive nations sharing a border with this one. */
export function borderingNations(world: World, me: number): Set<number> {
  const out = new Set<number>();
  for (let t = 0; t < world.owner.length; t++) {
    if (world.owner[t] !== me) continue;
    for (const j of world.tiles[t]!.neighbors) {
      const o = world.owner[j]!;
      if (o >= 0 && o !== me && world.countries[o]?.alive) out.add(o);
    }
  }
  return out;
}

export function inTruce(world: World, a: number, b: number, tick: number): boolean {
  const r = relationOf(world, a, b);
  return r.stance !== 'war' && r.since > 0 && tick - r.since < TRUCE_TICKS;
}

type Emit = (body: Record<string, unknown> & { type: WorldEvent['type'] }) => void;

export interface DiplomacyInput {
  view: World; me: number; tick: number; rng: Rng;
  focus: 'expand' | 'develop' | 'fortify' | 'attack'; targets: number[];
  ledger?: WarLedger;
  /** The nation's working tile owners for this turn (cessions update it). */
  own: number[];
  emit: Emit;
}

const CASUS = [
  'over the border at {r}', 'to avenge old insults', 'claiming {r} as its birthright', 'after raiders cross the border at {r}',
  'over a stolen harvest', 'to free {r} from a foreign yoke',
];

/**
 * One nation's diplomacy for one turn. Honour alliances (or break them), make or accept peace, declare
 * war when its armies are ready, and make or accept trade and alliance offers. Everything it does is its
 * own events; offers and acceptances go through the chronicle (see the top of this file).
 */
export function diplomacyTurn(p: DiplomacyInput): void {
  const { view, me, tick, rng, ledger, own, emit } = p;
  const c = view.countries[me];
  if (!c || !c.alive) return;
  const say = (kind: ChronicleKind, countries: number[], text: string, id = `c-${me}-${tick}-d${countries.join('-')}`): void => {
    emit({ type: 'chronicle', entry: { id, tick, year: view.year, kind, countries, text } });
  };
  const name = (id: number): string => view.countries[id]?.name ?? 'a fallen people';
  const stance = (o: number): Stance => relationOf(view, me, o).stance;
  const enemies = enemiesOf(view, me);
  const offers = openOffers(view, tick);
  const offerFrom = (kind: OfferKind, from: number): boolean => offers.has(`${kind}:${from}:${me}`);
  const myOffer = (kind: OfferKind, to: number): boolean => offers.has(`${kind}:${me}:${to}`);
  const myS = militaryStrength(view, me);
  const borderTileWith = (o: number): number => {
    for (let t = 0; t < own.length; t++) if (own[t] === me && view.tiles[t]!.neighbors.some((j) => own[j] === o)) return t;
    return -1;
  };
  const placeWith = (o: number): string => { const t = borderTileWith(o); return t >= 0 ? placeName(view, t, 'the border') : 'the border'; };

  // 1. Alliances: an ally attacked in the last few years calls on us. Join, or break the oath.
  for (const r of view.relations) {
    if (r.stance !== 'alliance' || (r.a !== me && r.b !== me)) continue;
    const ally = r.a === me ? r.b : r.a;
    if (!view.countries[ally]?.alive) continue;
    for (const w of view.relations) {
      if (w.stance !== 'war' || (w.a !== ally && w.b !== ally)) continue;
      const foe = w.a === ally ? w.b : w.a;
      if (foe === me || !view.countries[foe]?.alive || tick - w.since > 8 || tick - w.since < 1) continue;
      if (stance(foe) === 'war' || stance(foe) === 'alliance') continue;
      let declarer = -1;
      for (let i = view.chronicle.length - 1; i >= 0 && view.chronicle[i]!.tick >= w.since - 1; i--) {
        const ce = view.chronicle[i]!;
        if (ce.kind === 'war' && ce.countries.includes(ally) && ce.countries.includes(foe)) { declarer = ce.countries[0]!; break; }
      }
      if (declarer !== foe) continue;                     // the ally started it: an offensive war, not our oath
      const h = (hashString(`oath:${me}:${ally}:${foe}:${w.since}`) % 1000) / 1000;
      const weak = myS < militaryStrength(view, foe);
      if (weak && h < 0.15 + 0.25 * (1 - c.temperament.aggression)) {
        emit({ type: 'relation_changed', a: me, b: ally, stance: 'neutral', reason: `refused to fight ${name(foe)}` });
        say('betrayal', [me, ally], `${c.name} breaks its oath and leaves ${name(ally)} to face ${name(foe)} alone.`);
      } else {
        emit({ type: 'relation_changed', a: me, b: foe, stance: 'war', reason: `honours its alliance with ${name(ally)}` });
        say('war', [me, foe], `${c.name} honours its alliance with ${name(ally)} and declares war on ${name(foe)}.`);
      }
      return;
    }
  }

  // 2. Peace: offer it when satisfied, beaten or weary; accept it when losing or exhausted.
  for (const foe of enemies) {
    const rel = relationOf(view, me, foe);
    const age = tick - rel.since;
    const t = ledger?.get(foe) ?? { gained: 0, lost: 0, won: 0, lostBattles: 0 };
    const bal = t.gained - t.lost;
    const theirS = militaryStrength(view, foe);
    const exhausted = (theirS > 0 && myS < 0.6 * theirS) || c.treasury < 8;
    const wantGain = 4 + Math.round(c.temperament.aggression * 14);
    // The kill: a small enemy far weaker than us is not let off, unless the war has gone on for ages.
    const killable = countryTiles(view, foe).length <= 15 && myS >= 1.3 * theirS && age < 150;
    if (offerFrom('peace', foe) && !(myOffer('peace', foe) && me > foe)) {
      if (!killable && (bal < 0 || exhausted || age >= 90 || (bal >= wantGain && age >= 30))) {
        let ceded = 0;
        if (bal < 0) {
          const k = Math.min(3, Math.ceil(-bal / 3));
          const cands: number[] = [];
          for (let i = 0; i < own.length; i++) {
            if (own[i] !== me || i === c.capitalTile) continue;
            if (!view.tiles[i]!.neighbors.some((j) => own[j] === foe)) continue;
            if (view.units.some((u) => u.tile === i && u.owner === me)) continue;
            cands.push(i);
          }
          cands.sort((x, y) => hashString(`cede:${tick}:${x}`) - hashString(`cede:${tick}:${y}`));
          for (const tl of cands.slice(0, k)) {
            emit({ type: 'tile_claimed', tile: tl, owner: foe, from: me, cause: 'conquest' });
            own[tl] = foe; ceded++;
          }
        }
        const place = placeWith(foe);
        emit({ type: 'relation_changed', a: me, b: foe, stance: 'neutral', reason: `the Treaty of ${place}` });
        const text = bal < 0
          ? `${c.name} makes peace with ${name(foe)} by the Treaty of ${place}: ${name(foe)} keeps the ${t.lost} provinces it took${ceded ? `, and ${ceded} more besides` : ''}.`
          : bal > 0
            ? `${name(foe)} sues for peace, and ${c.name} accepts by the Treaty of ${place}, keeping the ${t.gained} provinces it won.`
            : `${c.name} and ${name(foe)} make peace by the Treaty of ${place}; the border stands where the armies left it.`;
        say('peace', [me, foe], text);
        return;
      }
    } else if (!myOffer('peace', foe) && age >= 20 && !killable) {
      if ((bal >= wantGain && age >= 30) || (bal <= -3 && myS < theirS) || age >= 110 || (exhausted && age >= 40)) {
        say('peace', [me, foe], bal >= wantGain
          ? `${c.name} offers ${name(foe)} peace, on the condition that it keeps what it has taken.`
          : `${c.name} sends envoys to ${name(foe)} to talk of peace.`, offerId(me, tick, 'peace', foe));
        return;
      }
    }
  }

  // 3. War: an attack focus, a target over the border, no truce, and armies ready.
  if (p.focus === 'attack' && tick >= WAR_EARLIEST && enemies.length === 0) {
    const near = borderingNations(view, me);
    const target = p.targets.find((o) => near.has(o) && stance(o) !== 'war' && stance(o) !== 'alliance' && !inTruce(view, me, o, tick));
    if (target !== undefined) {
      const armies = view.units.filter((u) => u.owner === me && u.kind === 'army');
      const theirS = militaryStrength(view, target);
      if (armies.length >= 2 && myS >= 0.8 * theirS + 5 && rng() < 0.2) {
        const place = placeWith(target);
        const why = CASUS[hashString(`casus:${me}:${target}:${tick}`) % CASUS.length]!.replace('{r}', place);
        const betray = stance(target) === 'trade' ? ', tearing up its trade pact' : '';
        emit({ type: 'relation_changed', a: me, b: target, stance: 'war', reason: why });
        say('war', [me, target], `${c.name} declares war on ${name(target)} ${why}${betray}.`);
        return;
      }
    }
  }

  // 4. Trade and alliances, with neighbours only. Accept first, then at most one offer.
  const near = borderingNations(view, me);
  const t = c.temperament;
  const friendly = t.trade + (1 - t.aggression) * 0.5;      // over about 0.7: open to pacts
  const threatened = enemies.length > 0 || [...near].some((o) => enemiesOf(view, o).length > 0);
  const alliances = view.relations.filter((r) => r.stance === 'alliance' && (r.a === me || r.b === me)).length;
  for (const o of [...near].sort((x, y) => x - y)) {
    const rel = relationOf(view, me, o);
    if (offerFrom('trade', o) && (rel.stance === 'neutral' || rel.stance === 'hostile') && rel.grievance < 0.3 && friendly > 0.65 && !myOffer('trade', o)) {
      emit({ type: 'relation_changed', a: me, b: o, stance: 'trade', reason: 'a trade pact' });
      say('proclamation', [me, o], `${c.name} and ${name(o)} open their roads to each other's merchants.`);
      return;
    }
    if (offerFrom('alliance', o) && rel.stance === 'trade' && alliances < 2 && rel.grievance < 0.3 && (threatened || friendly > 1) && !myOffer('alliance', o)) {
      emit({ type: 'relation_changed', a: me, b: o, stance: 'alliance', reason: 'an alliance sworn' });
      say('alliance', [me, o], `${c.name} and ${name(o)} swear an alliance before their gods and their peoples.`);
      return;
    }
  }
  if (enemies.length) return;
  const roll = rng();
  for (const o of [...near].sort((x, y) => x - y)) {
    const rel = relationOf(view, me, o);
    if (rel.since > 0 && tick - rel.since < 20) continue;
    if (tick < 40) break;
    if (rel.stance === 'neutral' && rel.grievance < 0.25 && friendly > 0.65 && roll < 0.04 * t.trade && !myOffer('trade', o) && !offerFrom('trade', o)) {
      say('proclamation', [me, o], `${c.name} sends merchants to ${name(o)} with an offer of trade.`, offerId(me, tick, 'trade', o));
      return;
    }
    if (rel.stance === 'trade' && tick - rel.since >= 40 && rel.grievance < 0.25 && alliances < 2 && threatened && roll < 0.04
      && !myOffer('alliance', o) && !offerFrom('alliance', o)) {
      say('alliance', [me, o], `${c.name} offers an alliance to ${name(o)}.`, offerId(me, tick, 'alliance', o));
      return;
    }
  }
}

// ---- armies on the march ---------------------------------------------------------------------

export interface MarchInput {
  view: World; me: number; tick: number; rng: Rng;
  focus: 'expand' | 'develop' | 'fortify' | 'attack'; targets: number[];
  own: number[];
  /** The nation's units, as working copies (moves update their tile). */
  units: Unit[];
  emit: Emit;
  /** A fresh unit id. */
  uid: (prefix: string) => string;
}

/**
 * Moves one nation's armies and fleets for a turn. At war: every army walks (one tile a turn, along a
 * breadth-first path over its own and empty land) to the nearest enemy province and, now and then,
 * attacks one next to it (a `unit_moved` into it; the battle is settled when the batch is applied).
 * Fleets sail the same way over the sea and fight enemy fleets or raid enemy coasts. At peace with an
 * attack focus, armies gather at the border facing the target.
 */
export function marchTurn(p: MarchInput): void {
  const { view, me, tick, rng, own, units, emit } = p;
  const c = view.countries[me]!;
  const enemies = new Set(enemiesOf(view, me));
  let armies = units.filter((u) => u.kind === 'army');
  const fleets = units.filter((u) => u.kind === 'fleet');
  // Remnants rejoin: armies sharing a province, one of them worn down, combine into one host (at most
  // one merge a turn, strength capped at STRENGTH_CAP). The new host waits a turn before it moves.
  const byTile = new Map<number, Unit[]>();
  for (const u of armies) if (u.tile >= 0) { const l = byTile.get(u.tile); if (l) l.push(u); else byTile.set(u.tile, [u]); }
  for (const [tile, list] of [...byTile].sort((x, y) => x[0] - y[0])) {
    if (list.length < 2 || Math.min(...list.map((u) => u.strength)) >= 15) continue;
    const strength = Math.min(STRENGTH_CAP, list.reduce((sum, u) => sum + u.strength, 0));
    for (const u of list) { emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' }); u.tile = -1; }
    emit({ type: 'unit_spawned', unit: { id: p.uid('u'), owner: me, kind: 'army', tile, strength } });
    armies = armies.filter((u) => u.tile >= 0);
    break;
  }
  const terrain = (t: number): Terrain => view.tiles[t]!.terrain;
  const hostile = (t: number): number => {
    const o = own[t]!;
    if (enemies.has(o)) return o;
    // Enemy armies and fleets anywhere; enemy merchant ships only at sea (fleets hunt them).
    for (const v of view.units) if (v.tile === t && enemies.has(v.owner) && (isCombatant(v) || (v.kind === 'trader' && terrain(t) === 'ocean'))) return v.owner;
    return -1;
  };

  // Armies standing in a neutral nation's land (a treaty moved the border) go home.
  for (const u of units) {
    const o = own[u.tile]!;
    if (u.kind === 'army' && o >= 0 && o !== me && !enemies.has(o) && relationOf(view, me, o).stance !== 'alliance') {
      emit({ type: 'unit_removed', unitId: u.id, reason: 'disband' });
      u.tile = -1;
    }
  }

  const bfs = (goals: number[], passable: (t: number) => boolean, limit = 40): Map<number, number> => {
    const dist = new Map<number, number>(goals.map((g) => [g, 0]));
    const q = [...goals];
    for (let h = 0; h < q.length; h++) {
      const d = dist.get(q[h]!)!;
      if (d >= limit) continue;
      for (const j of view.tiles[q[h]!]!.neighbors) if (!dist.has(j) && passable(j)) { dist.set(j, d + 1); q.push(j); }
    }
    return dist;
  };
  const landPass = (t: number): boolean => terrain(t) !== 'ocean' && (own[t] === me || own[t] === -1 || (own[t]! >= 0 && relationOf(view, me, own[t]!).stance === 'alliance'));
  let moves = 0;

  if (enemies.size) {
    // Attack: at most one battle a turn, more often for aggressive nations.
    // The stronger side presses harder; the weaker mostly holds its ground.
    let theirS = 0;
    for (const o of enemies) theirS += militaryStrength(view, o);
    const edge = Math.max(0.5, Math.min(2, militaryStrength(view, me) / Math.max(1, theirS)));
    const pAttack = (0.1 + 0.12 * c.temperament.aggression) * edge;
    // Distance from every land tile to the nearest enemy capital: armies push towards it.
    const caps = [...enemies].map((o) => view.countries[o]!.capitalTile).filter((t) => own[t] !== me);
    const toCap = bfs(caps, (t) => terrain(t) !== 'ocean', 60);
    const front: { u: Unit; to: number; ratio: number; score: number }[] = [];
    for (const u of [...armies, ...fleets]) {
      if (u.tile < 0) continue;
      for (const j of view.tiles[u.tile]!.neighbors) {
        const foe = hostile(j);
        if (foe < 0) continue;
        if (u.kind === 'army' && terrain(j) === 'ocean') continue;
        if (u.kind === 'fleet' && terrain(j) !== 'ocean' && rng() > 0.25) continue;   // fleets mostly fight at sea
        const ratio = u.strength / Math.max(1, defenceEstimate(view, j, foe));
        front.push({ u, to: j, ratio, score: Math.min(ratio, 3) - 0.04 * (toCap.get(j) ?? 60) });
      }
    }
    if (front.length && rng() < pAttack) {
      front.sort((x, y) => (y.score - x.score) || (x.to - y.to));
      const best = front[0]!;
      if (best.ratio >= 0.7 || rng() < 0.15) {
        emit({ type: 'unit_moved', unitId: best.u.id, from: best.u.tile, to: best.to, arriveTick: tick + (best.u.kind === 'army' ? TERRAIN_EFFECTS[terrain(best.to)].move : 1) });
        best.u.tile = -1;                           // it has acted this turn
      }
    }
    // March: armies not yet at the front step towards it.
    const goals: number[] = [];
    for (let t = 0; t < own.length; t++) {
      if (!landPass(t)) continue;
      if (view.tiles[t]!.neighbors.some((j) => terrain(j) !== 'ocean' && hostile(j) >= 0)) goals.push(t);
    }
    if (goals.length) {
      const dist = bfs(goals, landPass);
      for (const u of armies) {
        if (u.tile < 0 || moves >= 3) continue;
        const d = dist.get(u.tile);
        if (d === undefined || d === 0 || rng() < 0.3) continue;
        const next = view.tiles[u.tile]!.neighbors.filter((j) => dist.get(j) === d - 1);
        if (!next.length) continue;
        const to = next[Math.floor(rng() * next.length)]!;
        emit({ type: 'unit_moved', unitId: u.id, from: u.tile, to, arriveTick: tick + TERRAIN_EFFECTS[terrain(to)].move });
        u.tile = to; moves++;
      }
    }
    // Fleets sail towards the sea lanes next to enemy coasts or fleets, across whole oceans if the
    // enemy is overseas (row A23), with their own allowance of moves.
    const seaGoals: number[] = [];
    for (let t = 0; t < own.length; t++) {
      if (terrain(t) !== 'ocean') continue;
      if (view.tiles[t]!.neighbors.some((j) => hostile(j) >= 0)) seaGoals.push(t);
    }
    if (seaGoals.length && fleets.length) {
      const dist = bfs(seaGoals, (t) => terrain(t) === 'ocean', 120);
      let sails = 0;
      for (const u of fleets) {
        if (u.tile < 0 || sails >= 3) continue;
        const d = dist.get(u.tile);
        if (d === undefined || d === 0 || rng() < 0.3) continue;
        const next = view.tiles[u.tile]!.neighbors.filter((j) => dist.get(j) === d - 1);
        if (!next.length) continue;
        const to = next[Math.floor(rng() * next.length)]!;
        emit({ type: 'unit_moved', unitId: u.id, from: u.tile, to, arriveTick: tick + 1 });
        u.tile = to; sails++;
      }
    }
    return;
  }

  if (p.focus !== 'attack' || !armies.length) return;
  // No war yet: gather at the border facing the targets.
  const want = new Set(p.targets);
  const goals: number[] = [];
  for (let i = 0; i < own.length; i++) {
    if (own[i] !== me) continue;
    if (view.tiles[i]!.neighbors.some((j) => own[j]! >= 0 && own[j] !== me && (want.size === 0 || want.has(own[j]!)))) goals.push(i);
  }
  if (!goals.length) return;
  const dist = bfs(goals, (t) => own[t] === me);
  for (const a of armies) {
    if (a.tile < 0 || moves >= 2) continue;
    const d = dist.get(a.tile);
    if (d === undefined || d === 0 || rng() < 0.4) continue;
    const next = view.tiles[a.tile]!.neighbors.filter((j) => dist.get(j) === d - 1);
    if (!next.length) continue;
    const to = next[Math.floor(rng() * next.length)]!;
    emit({ type: 'unit_moved', unitId: a.id, from: a.tile, to, arriveTick: tick + TERRAIN_EFFECTS[terrain(to)].move });
    a.tile = to; moves++;
  }
}
