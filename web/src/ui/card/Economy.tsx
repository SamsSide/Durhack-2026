import { useMemo } from 'react';
import { GROUPS, PRICE_BASE, goodOf, isShort, landDevastation, marketPlan, movementOf, politicsOf, readinessBand, readinessOf } from '@terra/shared';
import type { GoodGroup, MarketPlan, World } from '@terra/shared';
import { useWorld } from '../../state/world';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const price = (n: number) => n.toFixed(2);

/** The goods market of the current world, computed once per world version (it walks the whole world). */
export function useMarketPlan(world: World | null, enabled: boolean): MarketPlan | null {
  const version = useWorld((s) => s.version);
  return useMemo(() => (enabled && world ? marketPlan(world) : null), [enabled, world, version]);
}

const BAND_CLASS = { 'Peace': 'peace', 'Watchful': 'watch', 'Mobilised': 'mob', 'Total war': 'total' } as const;
/** The chip material of each readiness band (theme/materials.css). */
const BAND_CHIP = { 'Peace': 'tn-chip--alliance', 'Watchful': 'tn-chip--neutral', 'Mobilised': 'tn-chip--hostile', 'Total war': 'tn-chip--war' } as const;

export function shortGroups(plan: MarketPlan | null, id: number): GoodGroup[] {
  return plan ? GROUPS.filter((g) => isShort(plan, id, g)) : [];
}

/** One line of small status chips under the facts row. */
export function StatusChips({ world, countryId, plan }: { world: World; countryId: number; plan: MarketPlan | null }) {
  const c = world.countries[countryId];
  if (!c || !c.alive) return null;   // a fallen nation has no readiness, devastation or shortages to show
  const wr = readinessOf(c);
  const band = readinessBand(wr);
  const dev = landDevastation(world, countryId);
  const shorts = shortGroups(plan, countryId);
  return (
    <div className="tn-status">
      <span className={`tn-chip tn-chip--caps ${BAND_CHIP[band]} tn-st tn-st-${BAND_CLASS[band]}`} title={`War readiness ${Math.round(wr)} of 100`}>{band}</span>
      {dev > 5 && <span className="tn-chip tn-chip--caps tn-st tn-st-dev" title="Mean devastation of its provinces">Devastated {Math.round(dev)}%</span>}
      {shorts.length > 0 && <span className="tn-chip tn-chip--caps tn-st tn-st-short" title="Needs the market cannot fill">Short of: {shorts.join(', ')}</span>}
    </div>
  );
}

function Arrow({ now, base }: { now: number; base: number }) {
  const r = now / base;
  if (r > 1.1) return <span className="tn-arrow tn-up" title="Above its base price"><svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M4.5 1 L8 7 H1 Z" fill="currentColor" /></svg><span className="tn-sr">up</span></span>;
  if (r < 0.9) return <span className="tn-arrow tn-down" title="Below its base price"><svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M4.5 8 L8 2 H1 Z" fill="currentColor" /></svg><span className="tn-sr">down</span></span>;
  return null;
}

function marketLine(plan: MarketPlan, id: number): string {
  const buys = new Set<GoodGroup>(), sells = new Set<GoodGroup>();
  for (const t of plan.trades) {
    if (t.buyer === id) buys.add(t.group);
    if (t.seller === id) sells.add(t.group);
  }
  const list = (s: Set<GoodGroup>) => GROUPS.filter((g) => s.has(g)).join(', ');
  const parts: string[] = [];
  if (buys.size) parts.push(`Buys ${list(buys)} from its trade partners`);
  if (sells.size) parts.push(`sells ${list(sells)} abroad`);
  if (parts.length) return cap(parts.join(' and ')) + '.';
  const n = plan.nations.get(id);
  if (n && shortGroups(plan, id).length) return 'Finds no one to trade with, and goes short.';
  return 'Stands apart from the market, self-sufficient.';
}

export function EconomyTab({ world, countryId, plan }: { world: World; countryId: number; plan: MarketPlan | null }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < world.owner.length; i++) {
      if (world.owner[i] !== countryId) continue;
      const g = goodOf(world, i);
      if (g) m.set(g, (m.get(g) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [world, countryId, world.owner]);
  const dev = Math.min(100, Math.max(0, landDevastation(world, countryId)));
  const shorts = shortGroups(plan, countryId);
  if (!plan) return <p className="tn-muted">Reckoning the markets...</p>;
  const groupOf = (g: string): GoodGroup | null => (g === 'grain' || g === 'fish' ? 'food' : g === 'ore' || g === 'oil' || g === 'uranium' ? 'ore' : g === 'timber' || g === 'stone' ? 'timber' : null);
  return (
    <div className="tn-eco">
      <h3 className="tn-header-bar">Goods it produces</h3>
      {counts.length === 0 ? <p className="tn-muted">No provinces yield goods.</p> : (
        <ul className="tn-goods">
          {counts.map(([g, n]) => {
            const grp = groupOf(g);
            return (
              <li key={g}>
                <span className="tn-good-n">{cap(g)} x{n}</span>
                {grp && <span className="tn-good-p">{price(plan.prices[grp])} <Arrow now={plan.prices[grp]} base={PRICE_BASE[grp]} /></span>}
              </li>
            );
          })}
        </ul>
      )}
      {shorts.length > 0 && (
        <>
          <h3 className="tn-header-bar">Shortages</h3>
          <ul className="tn-goods">
            {shorts.map((g) => (
              <li key={g}><span className="tn-good-n tn-bad">{cap(g)}</span><span className="tn-good-p">{price(plan.prices[g])} <Arrow now={plan.prices[g]} base={PRICE_BASE[g]} /></span></li>
            ))}
          </ul>
        </>
      )}
      <p className="tn-market">{marketLine(plan, countryId)}</p>
      <div className="tn-gauge">
        <span className="tn-cap">Devastation</span>
        <div className="tn-gauge-bar tn-trough" role="img" aria-label={`Devastation ${Math.round(dev)}%`}><i className="tn-trough__fill" style={{ width: `${dev}%`, ['--fill' as string]: dev > 5 ? 'var(--color-rubric)' : 'var(--color-ink-muted)' }} /></div>
        <span className="tn-gauge-v">{Math.round(dev)}%</span>
      </div>
    </div>
  );
}

export function PoliticsBlock({ world, countryId }: { world: World; countryId: number }) {
  const p = politicsOf(world.countries[countryId]);
  const m = movementOf(p.axis);
  const rad = Math.min(100, Math.max(0, p.radicalism));
  return (
    <div className="tn-pol">
      <div className="tn-pol-name">{m.name}</div>
      <div className="tn-pol-creed">{m.creed}</div>
      <div className="tn-gauge">
        <span className="tn-cap">Radicalism</span>
        <div className="tn-gauge-bar tn-trough" role="img" aria-label={`Radicalism ${Math.round(rad)} of 100`}><i className="tn-trough__fill" style={{ width: `${rad}%`, ['--fill' as string]: rad > 60 ? 'var(--color-rubric)' : 'var(--stance-hostile)' }} /></div>
        <span className="tn-gauge-v">{Math.round(rad)}</span>
      </div>
    </div>
  );
}
