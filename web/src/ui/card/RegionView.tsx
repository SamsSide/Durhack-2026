import { flagSvg } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useRegionLore } from './useLore';

function Placeholder() {
  return (
    <div className="tn-card-lines" aria-hidden="true">
      <span className="tn-shimmer" /><span className="tn-shimmer" /><span className="tn-shimmer tn-short" />
    </div>
  );
}

export function RegionView({ regionId }: { regionId: number }) {
  useWorld((s) => s.version);
  const world = useWorld((s) => s.world);
  const select = useWorld((s) => s.select);
  const { lore, loading, error, retry } = useRegionLore(regionId);
  const region = world?.regions[regionId];
  if (!world || !region) return null;
  const capital = world.tiles[region.capitalTile];
  const ownerId = capital ? world.owner[capital.id] ?? -1 : -1;
  const owner = ownerId >= 0 ? world.countries[ownerId] : undefined;
  const unrest = Math.max(0, Math.min(1, region.unrest));
  return (
    <div className="tn-card">
      <div className="tn-card-body">
        <header className="tn-head">
          <div className="tn-flag" dangerouslySetInnerHTML={{ __html: flagSvg(region.flag, 90, 60) }} />
          <div className="tn-head-text">
            <h2 className="tn-name">{region.name || 'Unnamed lands'}</h2>
            {owner && (
              <div className="tn-sub">
                held by{' '}
                <button type="button" className="tn-link" onClick={() => select(owner.id)}>{owner.name}</button>
              </div>
            )}
          </div>
        </header>
        <section className="tn-section">
          <h3 className="tn-h">Unrest</h3>
          <div className="tn-bar" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={unrest}>
            <div className="tn-bar-fill" style={{ width: `${Math.round(unrest * 100)}%` }} />
          </div>
        </section>
        {error ? (
          <section className="tn-section">
            <p className="tn-muted">The archives are silent. <button type="button" className="tn-link" onClick={retry}>Try again</button></p>
          </section>
        ) : (
          <>
            <section className="tn-section">
              <h3 className="tn-h">The land</h3>
              {loading || !lore ? <Placeholder /> : <p className="tn-p tn-fade">{lore.summary}</p>}
            </section>
            <section className="tn-section">
              <h3 className="tn-h">History</h3>
              {loading || !lore ? <Placeholder /> : <p className="tn-p tn-fade">{lore.history}</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
