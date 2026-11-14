import { flagSvg, goodOf } from '@terra/shared';
import { useRef } from 'react';
import { useWorld } from '../../state/world';
import { CloseIcon, Lines as Placeholder, useCardClass } from './shared';
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
      <div className="tn-card-body">
        <header className="tn-head">
          <div className="tn-flag"><div className="tn-flag-drawn" dangerouslySetInnerHTML={{ __html: flagSvg(region.flag, 66, 44) }} /></div>
          <div className="tn-head-text">
            <h2 className="tn-name">{region.name || 'Unnamed lands'}</h2>
            {owner && (
              <div className="tn-sub">
                <span className="tn-held-flag" dangerouslySetInnerHTML={{ __html: flagSvg(owner.flag, 24, 16) }} />
                Held by{' '}
                <button type="button" className="tn-link" onClick={() => select(owner.id)}>{owner.name}</button>
              </div>
            )}
          </div>
          <button type="button" className="tn-close" aria-label="Close" onClick={() => select(null)}><CloseIcon /></button>
        </header>
        <div className="tn-grid">
          <div className="tn-grid-row">
            <div><span className="tn-cap">Provinces</span><span className="tn-v">{region.tiles.length}</span></div>
            <div><span className="tn-cap">Main good</span><span className="tn-v">{mainGood ? mainGood.charAt(0).toUpperCase() + mainGood.slice(1) : 'None'}</span></div>
            <div title="Mean devastation of its provinces"><span className="tn-cap">Devastation</span><span className={`tn-v${devastation > 5 ? ' tn-bad' : ''}`}>{Math.round(devastation)}%</span></div>
            <div><span className="tn-cap">Unrest</span><span className={`tn-v${unrest > 0.5 ? ' tn-bad' : ''}`}>{Math.round(unrest * 100)}%</span></div>
          </div>
        </div>
        <section className="tn-sec">
          <h3>Unrest</h3>
          <div className="tn-bar" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={unrest}>
            <div className="tn-bar-fill" style={{ width: `${Math.round(unrest * 100)}%` }} />
          </div>
        </section>
        {error ? (
          <section className="tn-sec">
            <p className="tn-muted">No lore is available yet. <button type="button" className="tn-link" onClick={retry}>Try again</button></p>
          </section>
        ) : (
          <>
            <section className="tn-sec">
              <h3>The land</h3>
              {loading || !lore ? <Placeholder /> : <p className="tn-p tn-fade">{lore.summary}</p>}
            </section>
            <section className="tn-sec">
              <h3>History</h3>
              {loading || !lore ? <Placeholder /> : <p className="tn-p tn-fade">{lore.history}</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
