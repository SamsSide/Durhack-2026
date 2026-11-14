// Money between nations (row A27). Nations pay each other for trade, peace, war and friendship with
// `payment` events. Each nation decides only its own payments, on its own replica, from state every
// replica shares (relations, treasuries, armies, the chronicle) and seeded hashes: no Math.random, no
// memory. "Once per war" is a fixed offset from the war's start tick (the relation's `since`).
// Payments in a tick are applied after income and spending (see applyTickBatch in sync.ts), so the
// absolute treasury in a `country_updated` can never overwrite one.
// Derived payments (plunder and seizure) are made in settleMove (war.ts) with the attacker as actor.
import type { Terrain, World, WorldEvent } from '../types';
import { hashString } from '../rng';
import { countryTiles, relationOf } from '../world';
import { militaryStrength } from './war';
import { SETTLE_YEARS, marketBills, marketPlan, type MarketPlan } from './economy';

type Emit = (body: Record<string, unknown> & { type: WorldEvent['type'] }) => void;

/** Coins to 2 decimals. */
export const coins = (x: number): number => Math.round(x * 100) / 100;
const fmt = (x: number): string => (Math.round(x * 10) / 10).toLocaleString('en-GB');

const roll = (key: string): number => (hashString(`pay:${key}`) % 1000) / 1000;

/** What a nation mostly has to sell, from the ground it holds. */
const GOODS: Record<Terrain, string> = {
  ocean: 'fish', coast: 'salt fish', plains: 'grain', forest: 'timber', desert: 'salt', hills: 'wool', mountain: 'iron', ice: 'furs',
};
export function mainGood(world: World, countryId: number): string {
  const n = new Map<Terrain, number>();
  for (const t of countryTiles(world, countryId)) {
    const k = world.tiles[t]!.terrain;
    if (k !== 'ocean') n.set(k, (n.get(k) ?? 0) + 1);
  }
  let best: Terrain = 'plains', bn = -1;
  for (const [k, v] of [...n].sort((a, b) => a[0].localeCompare(b[0]))) if (v > bn) { best = k; bn = v; }
  return GOODS[best];
}

/** The place a peace treaty was named for, read back from the chronicle line that made it. */
function treatyPlace(world: World, a: number, b: number, since: number): string {
  for (let i = world.chronicle.length - 1; i >= 0; i--) {
    const c = world.chronicle[i]!;
    if (c.tick < since - 1) break;
    if (c.kind === 'peace' && c.countries.includes(a) && c.countries.includes(b)) {
      const m = /Treaty of ([^:,.]+)/.exec(c.text);
      if (m) return m[1]!.trim();
    }
  }
  return 'the border';
}

export interface PaymentInput {
  view: World; me: number; tick: number;
  /** What it remembers of each war it fought: provinces won and lost per enemy (see noteWarEvents). */
  ledger?: Map<number, { gained: number; lost: number }>;
  /** This year's goods market (B11, sim/economy.ts); worked out from `view` when missing. */
  market?: MarketPlan;
  emit: Emit;
}

/** One year of this nation's payments. Only ever pays out of its own treasury. */
export function paymentTurn(p: PaymentInput): void {
  const { view, me, tick, ledger, market, emit } = p;
  const c = view.countries[me];
  if (!c || !c.alive || c.treasury < 4) return;
  const name = (id: number): string => view.countries[id]?.name ?? 'a fallen people';
  const strip = (s: string): string => s.replace(/^The /, '');
  let k = 0;
  let spent = 0;                                   // this turn's total, kept under the treasury
  const pay = (to: number, share: number, reason: 'trade' | 'reparations' | 'war_chest' | 'subsidy' | 'pooled', note: string, say?: string): void => {
    const amount = coins(Math.min(c.treasury - spent, Math.max(1, c.treasury * share)));
    if (amount < 1) return;
    spent += amount;
    emit({ type: 'payment', from: me, to, amount, reason, note });
    if (say) {
      emit({ type: 'chronicle', entry: { id: `c-${me}-${tick}-pay${k++}`, tick, year: view.year, kind: 'proclamation', countries: [me, to], text: say.replace('{amt}', fmt(amount)) } });
    }
  };

  // 1. Reparations: the year after a peace, the nation that came off worse pays the other.
  for (const r of view.relations) {
    if (r.stance !== 'neutral' || (r.a !== me && r.b !== me) || r.since !== tick - 1) continue;
    const foe = r.a === me ? r.b : r.a;
    const t = ledger?.get(foe);
    if (!t || !view.countries[foe]?.alive || t.gained - t.lost >= 0) continue;
    const place = treatyPlace(view, me, foe, r.since);
    if (place === 'the border' && !view.chronicle.some((e) => e.tick === r.since && e.kind === 'peace' && e.countries.includes(me) && e.countries.includes(foe))) continue;
    const share = Math.min(0.4, 0.15 + 0.05 * (t.lost - t.gained));
    pay(foe, share, 'reparations', `Treaty of ${place}`, `${c.name} pays ${name(foe)} {amt} crowns in reparations under the Treaty of ${place}.`);
  }

  // 2. The goods market (B11, #204): every SETTLE_YEARS years per buyer, staggered by its id, it pays each
  // seller one merged bill for the goods it bought (at most SETTLE_CAP of its treasury in all).
  if ((tick + me) % SETTLE_YEARS === 0) {
    for (const b of marketBills(view, market ?? marketPlan(view), me)) {
      const amount = coins(Math.min(c.treasury - spent, b.amount));
      if (amount < 1) break;
      spent += amount;
      emit({ type: 'payment', from: me, to: b.to, amount, reason: 'trade', note: b.note });
    }
  }

  // 3. Allies at war. The war's start is the relation's `since`; each payment happens once per war.
  const myS = militaryStrength(view, me);
  for (const al of view.relations) {
    if (al.stance !== 'alliance' || (al.a !== me && al.b !== me)) continue;
    const ally = al.a === me ? al.b : al.a;
    if (!view.countries[ally]?.alive) continue;
    for (const w of view.relations) {
      if (w.stance !== 'war' || (w.a !== ally && w.b !== ally)) continue;
      const foe = w.a === ally ? w.b : w.a;
      if (foe === me || !view.countries[foe]?.alive) continue;
      const mine = relationOf(view, me, foe);
      if (mine.stance === 'war') {
        // Fighting side by side: the weaker pays into the stronger's fund, once, a few years after both are in.
        const allyS = militaryStrength(view, ally);
        const weaker = myS < allyS || (myS === allyS && me > ally);
        if (weaker && tick - Math.max(w.since, mine.since) === 4 && roll(`pooled:${me}:${ally}:${foe}:${w.since}`) < 0.6) {
          pay(ally, 0.2, 'pooled', `joint war chest of ${strip(c.name)} and ${strip(name(ally))}`);
        }
      } else if (stance(view, me, foe) !== 'alliance' && tick - w.since === 3 && roll(`chest:${me}:${ally}:${foe}:${w.since}`) < 0.5) {
        // Not in the war itself: a contribution to the ally that is.
        pay(ally, 0.12, 'war_chest', `a war chest against ${strip(name(foe))}`);
      }
    }
  }

  // 4. Subsidy: a strong, rich nation props up a weak friend now and then.
  if (c.treasury >= 120) {
    for (const r of view.relations) {
      if ((r.stance !== 'trade' && r.stance !== 'alliance') || (r.a !== me && r.b !== me)) continue;
      const o = r.a === me ? r.b : r.a;
      const oc = view.countries[o];
      if (!oc?.alive || oc.treasury * 3 > c.treasury || myS <= militaryStrength(view, o)) continue;
      if (roll(`subsidy:${me}:${o}:${tick}`) >= 0.03) continue;
      pay(o, 0.1, 'subsidy', `aid to ${strip(oc.name)}`);
      break;
    }
  }
}

const stance = (world: World, a: number, b: number): string => relationOf(world, a, b).stance;
