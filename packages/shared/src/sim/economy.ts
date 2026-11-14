// The economy core (B11, #204; design in docs/research/economy-games.md section 3). Pure functions of a
// world view plus seeded hashes, so every replica reaches the same numbers:
//   - one main good per province, derived from its terrain (never stored);
//   - needs per nation (food, ore, timber), a world price per group, and the goods market that matches
//     sellers' surpluses to buyers' deficits (paid in payments.ts with reason `trade`);
//   - devastation per province (folded in applyEvent, world.ts), war readiness and politics (sent in the
//     nation's own `country_updated` patch, rules.ts).
// This file imports only types and the hash, so world.ts can use it without an import cycle.
// All the tunable numbers are the constants at the top (balance pass B11-7).
import type { Country, Good, TechAge, Terrain, World } from '../types';
import { hashString } from '../rng';

// ---- constants (B11-7 tunes these, and only these) ------------------------------------------

/** Traded goods groups. Gold, salt and furs belong to none: they count as income only. */
export type GoodGroup = 'food' | 'ore' | 'timber';
export const GROUPS: readonly GoodGroup[] = ['food', 'ore', 'timber'];

/** Base price of each good, in coins. */
export const GOOD_BASE: Record<Good, number> = {
  grain: 0.9, fish: 0.9, timber: 0.55, stone: 0.6, ore: 1.4, salt: 1.25, gold: 2.5, furs: 2.0, oil: 3.0, uranium: 5.0,
};
/** Units a province makes a year; units x base price = the terrain's income, so goods are income-neutral. */
export const GOOD_UNITS: Record<Good, number> = {
  grain: 1, fish: 1, timber: 1, stone: 1, ore: 0.25, salt: 0.2, gold: 0.1, furs: 0.05, oil: 0.25 / 3, uranium: 0.35 / 5,
};
export const GOOD_GROUP: Record<Good, GoodGroup | null> = {
  grain: 'food', fish: 'food', timber: 'timber', stone: 'timber', ore: 'ore', oil: 'ore', uranium: 'ore', salt: null, gold: null, furs: null,
};
/** Base world price per group (timber is the mean of timber and stone). */
export const PRICE_BASE: Record<GoodGroup, number> = { food: 0.9, ore: 1.4, timber: 0.58 };

/** Needs a year. Food per province held plus per 1000 people (people here outgrow the land many times over
 *  through their towns, so the land carries most of the need); ore per army and per fleet; timber per structure. */
export const NEED = { foodPerProvince: 0.4, foodPer1000: 0.02, orePerArmy: 0.12, orePerFleet: 0.08, timberPerStructure: 0.15 } as const;
/** How far the price moves with the gap between buyers and sellers: up to base x (1 + UP), down to base x (1 - DOWN). */
export const PRICE_SWING = { up: 0.6, down: 0.4 } as const;
/** Years of goods one settlement pays for, and the share of the buyer's treasury it may spend at most. */
export const SETTLE_YEARS = 5;
export const SETTLE_CAP = 0.15;
/** A settlement bill to one seller under this many coins is not worth a caravan: skipped. */
export const MIN_BILL = 8;
/** Unfilled need (units a year) from which a nation counts as short of a group. */
export const SHORT_MIN = 0.5;
/** Seller markups: the Lamp Assembly's merchants, the Black Standard's tariff. */
export const MARKUP = { centre: 1.1, farRight: 1.2 } as const;
/** Far-left (Red Furrow) nations move only this share of their surplus and deficit through the market. */
export const FAR_LEFT_VOLUME = 0.5;

/** Devastation, 0 to 100 per province (folded in applyEvent). */
export const DEVASTATION = { battle: 20, conquest: 10, occupied: 5, recovery: 3, max: 100 } as const;

// ---- goods per province ---------------------------------------------------------------------

const AGES: readonly TechAge[] = ['ancient', 'medieval', 'gunpowder', 'industrial', 'modern', 'future', 'stellar'];
const ageAt = (age: TechAge | undefined): number => Math.max(0, AGES.indexOf(age ?? 'ancient'));

/** The main good a terrain makes, before the hash and the age. */
const TERRAIN_GOOD: Record<Terrain, Good | null> = {
  plains: 'grain', coast: 'fish', forest: 'timber', hills: 'stone', mountain: 'ore', desert: 'salt', ice: 'furs', ocean: null,
};

/** A province's good. Desert: gold one tile in four (by hash), else salt; from the industrial age (of its
 *  owner) one desert tile in five makes oil instead of salt; from the modern age one mountain in seven makes
 *  uranium. Ocean makes nothing. */
export function goodOf(world: World, tile: number): Good | null {
  const t = world.tiles[tile];
  if (!t) return null;
  const g = TERRAIN_GOOD[t.terrain];
  if (g !== 'salt' && g !== 'ore') return g;
  const h = hashString(`good:${tile}`);
  const o = world.owner[tile] ?? -1;
  const age = o >= 0 ? ageAt(world.countries[o]?.techAge) : 0;
  if (g === 'salt') {
    if (h % 4 === 0) return 'gold';
    return age >= 3 && h % 5 === 1 ? 'oil' : 'salt';
  }
  return age >= 4 && h % 7 === 0 ? 'uranium' : 'ore';
}

/** Devastation of a tile (0 when the world has none yet). */
export const devastationOf = (world: World, tile: number): number => world.devastation?.[tile] ?? 0;
/** War readiness of a nation (missing means 0). */
export const readinessOf = (c: Pick<Country, 'warReadiness'> | undefined): number => c?.warReadiness ?? 0;
/** Politics of a nation (missing means the centre, radicalism 10, as in the contract). */
export const politicsOf = (c: Pick<Country, 'politics'> | undefined): { axis: number; radicalism: number } =>
  c?.politics ?? { axis: 0, radicalism: 10 };

/** Province output (and income) multiplier: devastation and a frightened people both cut it. 1 at D 0, WR 0. */
export const outputMul = (d: number, wr: number): number => (1 - d / 125) * (1 - 0.3 * wr / 100);
/** Population cap multiplier of a devastated province. */
export const popCapMul = (d: number): number => 1 - d / 200;
/** Army upkeep multiplier: a mobilised nation keeps its armies cheaper. */
export const upkeepMul = (wr: number): number => 1 - 0.2 * wr / 100;

/** Units of its good a province makes this year, after devastation and its owner's war readiness. */
export function provinceOutput(world: World, tile: number): number {
  const g = goodOf(world, tile);
  if (!g) return 0;
  const o = world.owner[tile] ?? -1;
  return GOOD_UNITS[g] * outputMul(devastationOf(world, tile), o >= 0 ? readinessOf(world.countries[o]) : 0);
}

/** Mean devastation over a nation's provinces (0 with none). */
export function landDevastation(world: World, countryId: number): number {
  let n = 0, s = 0;
  for (let i = 0; i < world.owner.length; i++) if (world.owner[i] === countryId) { n++; s += devastationOf(world, i); }
  return n ? s / n : 0;
}

// ---- needs, prices and the market -----------------------------------------------------------

type PerGroup = Record<GoodGroup, number>;
const zero = (): PerGroup => ({ food: 0, ore: 0, timber: 0 });

/** What a nation needs a year, per group. */
export function needs(world: World, countryId: number): PerGroup {
  const c = world.countries[countryId];
  if (!c?.alive) return zero();
  let armies = 0, fleets = 0, structures = 0, land = 0;
  for (let i = 0; i < world.owner.length; i++) if (world.owner[i] === countryId) land++;
  for (const u of world.units) if (u.owner === countryId) { if (u.kind === 'army') armies++; else if (u.kind === 'fleet') fleets++; }
  for (const s of world.structures) if (s.owner === countryId && s.kind !== 'ruin') structures++;
  return {
    food: land * NEED.foodPerProvince + c.population / 1000 * NEED.foodPer1000,
    ore: NEED.orePerArmy * armies + NEED.orePerFleet * fleets,
    timber: NEED.timberPerStructure * structures,
  };
}

/** Every living nation's output a year per group, and per good (for the ledger notes). One pass over the tiles. */
function outputs(world: World): { group: Map<number, PerGroup>; good: Map<number, Map<Good, number>> } {
  const group = new Map<number, PerGroup>();
  const good = new Map<number, Map<Good, number>>();
  for (let i = 0; i < world.owner.length; i++) {
    const o = world.owner[i]!;
    if (o < 0 || !world.countries[o]?.alive) continue;
    const g = goodOf(world, i);
    const grp = g ? GOOD_GROUP[g] : null;
    if (!g || !grp) continue;
    const q = provinceOutput(world, i);
    let p = group.get(o);
    if (!p) { p = zero(); group.set(o, p); }
    p[grp] += q;
    let m = good.get(o);
    if (!m) { m = new Map(); good.set(o, m); }
    m.set(g, (m.get(g) ?? 0) + q);
  }
  return { group, good };
}

/** The world price of a group from its world supply and demand (Vic3 style, bounded by PRICE_SWING). */
export function priceFor(group: GoodGroup, buy: number, sell: number): number {
  const x = Math.max(-1, Math.min(1, (buy - sell) / Math.max(Math.min(buy, sell), 0.1)));
  return PRICE_BASE[group] * (1 + (x >= 0 ? PRICE_SWING.up : PRICE_SWING.down) * x);
}

/** World prices per group this year, from the shared view. */
export function prices(world: World): PerGroup {
  return marketPlan(world).prices;
}

/** One flow of the market: a seller's goods to a buyer, units a year. */
export interface MarketTrade { seller: number; buyer: number; group: GoodGroup; qty: number }
export interface MarketPlan {
  prices: PerGroup;
  /** Total output and need per group, over the world. */
  supply: PerGroup; demand: PerGroup;
  trades: MarketTrade[];
  /** Per nation: what it makes, needs, and the need left unfilled after the market (units a year). */
  nations: Map<number, { made: PerGroup; need: PerGroup; short: PerGroup }>;
  /** Per nation and good: units made a year (names the goods in the ledger notes). */
  goods: Map<number, Map<Good, number>>;
}

export type Movement = 'red_furrow' | 'common_hearth' | 'lamp_assembly' | 'iron_oath' | 'black_standard';

/** Two nations at war, or kept apart by the Black Standard's embargo on nations it is hostile to. */
function blocked(world: World, a: number, b: number): boolean {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const stance = world.relations.find((r) => r.a === lo && r.b === hi)?.stance ?? 'neutral';
  if (stance === 'war') return true;
  if (stance !== 'hostile') return false;
  return movementKey(politicsOf(world.countries[a]).axis) === 'black_standard' || movementKey(politicsOf(world.countries[b]).axis) === 'black_standard';
}

/**
 * The goods market of the year, from the shared view: each seller's surplus is split among the buyers
 * it may trade with in proportion to their deficits; a buyer never receives more than it lacks. The
 * Red Furrow moves only half its surplus or deficit. Canonical order (nation id, group order).
 */
export function marketPlan(world: World): MarketPlan {
  const out = outputs(world);
  const nations = new Map<number, { made: PerGroup; need: PerGroup; short: PerGroup }>();
  const supply = zero(), demand = zero();
  const living: number[] = [];
  for (const c of world.countries) {
    if (!c.alive) continue;
    living.push(c.id);
    const made = out.group.get(c.id) ?? zero();
    const need = needs(world, c.id);
    nations.set(c.id, { made, need, short: zero() });
    for (const g of GROUPS) { supply[g] += made[g]; demand[g] += need[g]; }
  }
  const p = zero();
  for (const g of GROUPS) p[g] = priceFor(g, demand[g], supply[g]);
  const trades: MarketTrade[] = [];
  const farLeft = (id: number): boolean => movementKey(politicsOf(world.countries[id]).axis) === 'red_furrow';
  for (const g of GROUPS) {
    const surplus = new Map<number, number>(), deficit = new Map<number, number>();
    for (const id of living) {
      const n = nations.get(id)!;
      const d = n.made[g] - n.need[g];
      const vol = farLeft(id) ? FAR_LEFT_VOLUME : 1;
      if (d > 1e-9) surplus.set(id, d * vol);
      else if (d < -1e-9) deficit.set(id, -d * vol);
    }
    const flows: MarketTrade[] = [];
    const got = new Map<number, number>();
    for (const [s, sur] of surplus) {
      let sum = 0;
      for (const [b, def] of deficit) if (!blocked(world, s, b)) sum += def;
      if (sum <= 0) continue;
      for (const [b, def] of deficit) {
        if (blocked(world, s, b)) continue;
        const qty = sur * def / sum;
        flows.push({ seller: s, buyer: b, group: g, qty });
        got.set(b, (got.get(b) ?? 0) + qty);
      }
    }
    for (const f of flows) {
      const def = deficit.get(f.buyer)!, recv = got.get(f.buyer)!;
      if (recv > def) f.qty *= def / recv;
      if (f.qty > 1e-6) trades.push(f);
    }
    for (const id of living) {
      const n = nations.get(id)!;
      const lack = n.need[g] - n.made[g];
      if (lack <= 0) continue;
      n.short[g] = Math.max(0, lack - Math.min(got.get(id) ?? 0, deficit.get(id) ?? 0));
    }
  }
  return { prices: p, supply, demand, trades, nations, goods: out.good };
}

/** True when the nation is short of a group after the market. */
export const isShort = (plan: MarketPlan, countryId: number, group: GoodGroup): boolean =>
  (plan.nations.get(countryId)?.short[group] ?? 0) >= SHORT_MIN;

/** The seller's markup: +10% for a Lamp Assembly merchant, +20% Black Standard tariff. */
export function sellerMarkup(world: World, seller: number): number {
  const m = movementKey(politicsOf(world.countries[seller]).axis);
  return m === 'lamp_assembly' ? MARKUP.centre : m === 'black_standard' ? MARKUP.farRight : 1;
}

/** One settlement payment: the buyer pays a seller for SETTLE_YEARS of goods. */
export interface MarketBill { to: number; amount: number; note: string }

/**
 * What a buyer owes its sellers in this settlement, one merged bill per seller, in seller order: the
 * total is capped at SETTLE_CAP of the buyer's treasury (scaled down evenly), and bills under MIN_BILL
 * are skipped. `note` lists the goods, e.g. "6 grain, 2 ore". Amounts are not rounded yet.
 */
export function marketBills(world: World, plan: MarketPlan, buyer: number): MarketBill[] {
  const c = world.countries[buyer];
  if (!c?.alive) return [];
  const per = new Map<number, { amount: number; parts: [Good, number][] }>();
  for (const t of plan.trades) {
    if (t.buyer !== buyer) continue;
    let b = per.get(t.seller);
    if (!b) { b = { amount: 0, parts: [] }; per.set(t.seller, b); }
    b.amount += SETTLE_YEARS * t.qty * plan.prices[t.group] * sellerMarkup(world, t.seller);
    b.parts.push([topGood(plan, t.seller, t.group), SETTLE_YEARS * t.qty]);
  }
  let total = 0;
  for (const b of per.values()) total += b.amount;
  const cap = Math.max(0, c.treasury) * SETTLE_CAP;
  const scale = total > cap ? cap / total : 1;
  const bills: MarketBill[] = [];
  for (const s of [...per.keys()].sort((a, b) => a - b)) {
    const b = per.get(s)!;
    const amount = b.amount * scale;
    if (amount < MIN_BILL) continue;
    const note = b.parts.map(([g, q]) => `${Math.max(1, Math.round(q * scale))} ${g}`).join(', ');
    bills.push({ to: s, amount, note });
  }
  return bills;
}

/** The good a seller makes most of in a group (names it in the ledger note). */
function topGood(plan: MarketPlan, seller: number, group: GoodGroup): Good {
  let best: Good | null = null, bq = -1;
  for (const [g, q] of [...(plan.goods.get(seller) ?? new Map<Good, number>())].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (GOOD_GROUP[g] === group && q > bq) { best = g; bq = q; }
  }
  return best ?? (group === 'food' ? 'grain' : group === 'ore' ? 'ore' : 'timber');
}

// ---- war readiness (rule 4) -----------------------------------------------------------------

export interface ReadinessInput { attack: boolean; atWar: boolean; enemyOnLand: boolean; farRight: boolean }

/** One year of war readiness, 0 to 100. */
export function readinessStep(prev: number, i: ReadinessInput): number {
  let wr = prev + (i.attack ? 15 : 0) + (i.atWar ? 10 : 0) + (i.enemyOnLand ? 10 : 0);
  if (!i.atWar && !i.attack) wr -= 15;
  if (i.farRight) wr = Math.max(wr, 40);
  return Math.max(0, Math.min(100, Math.round(wr)));
}

export type ReadinessBand = 'Peace' | 'Watchful' | 'Mobilised' | 'Total war';
export const readinessBand = (wr: number): ReadinessBand => (wr >= 80 ? 'Total war' : wr >= 50 ? 'Mobilised' : wr >= 20 ? 'Watchful' : 'Peace');

// ---- politics (rule 5) ----------------------------------------------------------------------

/** A new nation's politics from its temperament: within -40..40, so no extreme on day one. */
export const startPolitics = (t: Country['temperament']): { axis: number; radicalism: number } =>
  ({ axis: Math.round(40 * (t.aggression - t.trade)), radicalism: 10 });

export interface PoliticsInput {
  atWar: boolean; avgDevastation: number;
  /** 0..1: how poor the nation is (treasury per province against POLITICS.richPerProvince). */
  poverty: number; foodShort: boolean; prosperous: boolean;
  /** Provinces taken from it, and provinces it took, this year (named enemies). */
  lostNow: number; gainedNow: number;
  /** Net provinces (gained minus lost) over the wars it is fighting now. */
  warNet: number;
  /** The year after a peace: it paid reparations (humiliated) or received them (vindicated). */
  paidReparations: boolean; gotReparations: boolean;
}

/** Tuned so a 6-nation world over 300 years ends with a mix of centre, far left and far right (check-politics.ts). */
export const POLITICS = {
  richPerProvince: 4, lostLandRight: 20, losing: 4, humiliation: 20, devastation: 0.1, poverty: 3, hunger: 3,
  warStrain: 1, calm: 2, winCalm: 0.5, winPull: 3, axisGain: 50, centrePull: 2,
};

/** One year of politics: radicalism, then the pull on the axis. Values kept to one decimal. */
export function politicsStep(prev: { axis: number; radicalism: number }, i: PoliticsInput): { axis: number; radicalism: number } {
  const K = POLITICS, b = (x: boolean): number => (x ? 1 : 0);
  const won = i.gainedNow > i.lostNow || (i.atWar && i.warNet > 0) || i.gotReparations;
  const losing = i.atWar && i.warNet < 0;
  // Causes. Left: poverty and devastation. Right: lost land and humiliation.
  const leftCause = K.poverty * i.poverty + K.hunger * b(i.foodShort) + K.devastation * i.avgDevastation;
  const rightCause = K.lostLandRight * Math.min(3, i.lostNow) + (i.paidReparations ? K.humiliation : 0) + (losing ? K.losing : 0);
  let delta = leftCause + rightCause + K.warStrain * b(i.atWar)
    - K.calm - 4 * b(i.prosperous);
  if (won) delta = delta > 0 ? delta * K.winCalm : delta - 2;       // a won war halves the year's radicalism change
  const rad = Math.max(0, Math.min(100, prev.radicalism + delta));
  let axis = prev.axis;
  if (leftCause > 0 || rightCause > 0) {
    const stronger = rightCause > leftCause ? rightCause - leftCause : leftCause - rightCause;   // the stronger cause sets the direction
    axis += (rightCause > leftCause ? 1 : -1) * (stronger + 1) * (Math.max(rad, 10)) / K.axisGain;
  }
  if (won || (leftCause === 0 && rightCause === 0)) axis -= Math.sign(axis) * Math.min(Math.abs(axis), won ? K.winPull : K.centrePull);
  if (rad > 50 && Math.abs(axis) > 20 && !won) axis += Math.sign(axis) * rad / 12;   // a radical people digs in
  if (rad < 20) axis = Math.abs(axis) <= 3 ? 0 : axis - 3 * Math.sign(axis);
  axis = Math.max(-100, Math.min(100, axis));
  const r1 = (x: number): number => Math.round(x * 10) / 10;
  return { axis: r1(axis), radicalism: r1(rad) };
}

/** The movement that rules at this axis. Bands on the rounded axis: -100..-60, -59..-20, -19..19, 20..59, 60..100. */
export function movementKey(axis: number): Movement {
  const a = Math.round(axis);
  return a <= -60 ? 'red_furrow' : a <= -20 ? 'common_hearth' : a <= 19 ? 'lamp_assembly' : a <= 59 ? 'iron_oath' : 'black_standard';
}

/** Names and one line of character per movement (invented; never a real party, person or symbol). */
export const MOVEMENTS: Record<Movement, { name: string; short: string; far: 'left' | 'right' | null; creed: string }> = {
  red_furrow: { name: 'The Red Furrow', short: 'Red Furrow', far: 'left', creed: 'far left, a command economy: the fields and mines belong to the committees, and trade is rationed' },
  common_hearth: { name: 'The Common Hearth', short: 'Common Hearth', far: null, creed: 'the left: bread, fair shares and strong guilds' },
  lamp_assembly: { name: 'The Lamp Assembly', short: 'Lamp Assembly', far: null, creed: 'the centre, a liberal market republic: open markets and patient diplomacy' },
  iron_oath: { name: 'The Iron Oath', short: 'Iron Oath', far: null, creed: 'the right: order, borders and a strong army' },
  black_standard: { name: 'The Black Standard', short: 'Black Standard', far: 'right', creed: 'far right, an ultranationalist junta: closed markets to enemies, tariffs and a nation under arms' },
};

/** The movement that rules a nation, with its name. */
export function movementOf(axis: number): { key: Movement; name: string; short: string; far: 'left' | 'right' | null; creed: string } {
  const key = movementKey(axis);
  return { key, ...MOVEMENTS[key] };
}

/** The chronicle line the year a far movement takes power, or null. */
export function seizureLine(prevAxis: number, axis: number, nation: string): string | null {
  const was = movementKey(prevAxis), now = movementKey(axis);
  if (was === now) return null;
  if (now === 'black_standard') return `The Black Standard seizes power in ${nation}; its markets close to its enemies.`;
  if (now === 'red_furrow') return `The Red Furrow seizes power in ${nation}; its fields and mines pass to the people's committees.`;
  return null;
}

// ---- devastation (rule 3), folded by applyEvent ---------------------------------------------

/** Adds devastation to one tile (creating the array on first use), clamped 0..100. */
export function addDevastation(world: World, tile: number, by: number): void {
  if (tile < 0 || tile >= world.tiles.length || by === 0) return;
  const d = (world.devastation ??= new Array<number>(world.tiles.length).fill(0));
  d[tile] = Math.max(0, Math.min(DEVASTATION.max, (d[tile] ?? 0) + by));
}

/** The turn of the year: +5 on each tile where an army stands whose owner is at war with the tile's
 *  owner, then -3 on every tile above 0. */
export function devastationTick(world: World): void {
  const hit = new Set<number>();
  for (const u of world.units) {
    if (u.kind !== 'army' || u.tile < 0) continue;
    const o = world.owner[u.tile] ?? -1;
    if (o < 0 || o === u.owner) continue;
    const lo = Math.min(o, u.owner), hi = Math.max(o, u.owner);
    if (world.relations.some((r) => r.a === lo && r.b === hi && r.stance === 'war')) hit.add(u.tile);
  }
  for (const t of [...hit].sort((a, b) => a - b)) addDevastation(world, t, DEVASTATION.occupied);
  const d = world.devastation;
  if (!d) return;
  for (let i = 0; i < d.length; i++) if (d[i]! > 0) d[i] = Math.max(0, d[i]! - DEVASTATION.recovery);
}
