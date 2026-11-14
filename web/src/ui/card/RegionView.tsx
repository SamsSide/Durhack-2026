import { flagSvg, goodOf } from '@terra/shared';
import { useRef } from 'react';
import { useWorld } from '../../state/world';
import { CloseIcon, Lines as Placeholder, Meter, nameClass, useCardClass } from './shared';
import { useRegionLore } from './useLore';

export function RegionView({ regionId }: { regionId: number }) {
  useWorld((s) => s.version);
  const world = useWorld((s) => s.world);
  const select = useWorld((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);
  const cls = useCardClass(ref, false);
  const { lore, loading, error, retry } = useRegionLore(regionId);
  const region = world?.regions[regionId];
  if (!world || !region) return null;
  const capital = world.tiles[region.capitalTile];
  const ownerId = capital ? world.owner[capital.id] ?? -1 : -1;
  const owner = ownerId >= 0 ? world.countries[ownerId] : undefined;
  const unrest = Math.max(0, Math.min(1, region.unrest));
  const goods = new Map<string, number>();
  let devastation = 0;
  for (const t of region.tiles) {
    const g = goodOf(world, t);
    if (g) goods.set(g, (goods.get(g) ?? 0) + 1);
    devastation += world.devastation?.[t] ?? 0;
  }
  devastation = region.tiles.length ? devastation / region.tiles.length : 0;
  let mainGood: string | null = null, best = 0;
  for (const [g, n] of goods) if (n > best) { best = n; mainGood = g; }
  return (
    <div className={cls} ref={ref}>
      <span className="tn-cartouche tn-gov">Region</span>
      <div className="tn-card-body">
        <header className="tn-head">
          <div className="tn-flag tn-flag-plate"><div className="tn-flag-drawn" dangerouslySetInnerHTML={{ __html: flagSvg(region.flag, 66, 44) }} /></div>
          <div className="tn-head-text">
            <h2 className={nameClass(region.name || '')}>{region.name || 'Unnamed lands'}</h2>
            {owner && (
              <div className="tn-sub">
                <span className="tn-held-flag tn-flag-plate" dangerouslySetInnerHTML={{ __html: flagSvg(owner.flag, 24, 16) }} />
                Held by{' '}
                <button type="button" className="tn-link" onClick={() => select(owner.id)}>{owner.name}</button>
              </div>
            )}
          </div>
          <button type="button" className="tn-close tn-button tn-button--lacquer tn-button--round" aria-label="Close" onClick={() => select(null)}><CloseIcon /></button>
        </header>
        <div className="tn-grid">
          <div className="tn-stat"><span className="tn-stat__label">Provinces</span><span className="tn-stat__value">{region.tiles.length}</span></div>
          <div className="tn-stat"><span className="tn-stat__label">Main good</span><span className="tn-stat__value">{mainGood ? mainGood.charAt(0).toUpperCase() + mainGood.slice(1) : 'None'}</span></div>
        </div>
        <div className="tn-meters">
          <Meter label="Devastation" value={`${Math.round(devastation)}%`} pct={devastation} title="Mean devastation of its provinces"
            fill={devastation > 5 ? 'var(--color-rubric)' : 'var(--color-ink-muted)'} bad={devastation > 5} />
          <Meter label="Unrest" value={`${Math.round(unrest * 100)}%`} pct={unrest * 100} meter={unrest} seg
            fill={unrest > 0.5 ? 'var(--color-rubric)' : 'var(--stance-hostile)'} bad={unrest > 0.5} />
        </div>
        {error ? (
          <section className="tn-sec">
            <p className="tn-muted">No lore is available yet. <button type="button" className="tn-link" onClick={retry}>Try again</button></p>
          </section>
        ) : (
          <>
            <section className="tn-sec">
              <h3 className="tn-header-bar">The land</h3>
              {loading || !lore ? <Placeholder /> : <p className="tn-p tn-fade">{lore.summary}</p>}
            </section>
            <section className="tn-sec">
              <h3 className="tn-header-bar">History</h3>
              {loading || !lore ? <Placeholder /> : <p className="tn-p tn-fade">{lore.history}</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
