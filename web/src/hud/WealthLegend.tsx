// B12: the key for the wealth map mode. Treasury on a log scale from the poorest living nation
// (dark bronze) to the richest (bright gold), with both end values. Lane b.
import { useWorld } from '../state/world';
import { useSlowVersion } from '../ui/useSlowVersion';
import { getPalette } from '../globe/palette';
import { usePresence } from '../ui/motion/usePresence';
import './hud.css';

const fmt = (n: number): string => Math.round(n).toLocaleString('en-GB');

export function WealthLegend({ hidden = false }: { hidden?: boolean }) {
  const world = useWorld((s) => s.world);
  useSlowVersion();
  const mapMode = useWorld((s) => s.mapMode);
  const { mounted, leaving } = usePresence(!hidden && !!world && mapMode === 'wealth');
  if (!mounted || !world) return null;
  const alive = world.countries.filter((c) => c?.alive);
  const pal = getPalette();
  let poor = alive[0], rich = alive[0];
  for (const c of alive) {
    if (c.treasury < poor!.treasury) poor = c;
    if (c.treasury > rich!.treasury) rich = c;
  }
  return (
    <div className={`hud legend-box legend-wealth tn-lacquer tn-frame${leaving ? ' tn-m-out' : ''}`}>
      <div className="cap tn-cartouche">Wealth</div>
      <div className="muted">Treasury of each nation, log scale</div>
      {poor && rich ? (
        <>
          <div className="lg-ramp" style={{ background: `linear-gradient(90deg, ${pal.wealthLow}, ${pal.wealthHigh})` }} />
          <div className="lg-ends">
            <span><b>{fmt(poor.treasury)}</b> TNC</span>
            <span><b>{fmt(rich.treasury)}</b> TNC</span>
          </div>
          <div className="lg-ends lg-names">
            <span title={poor.name}>{poor.name}</span>
            <span title={rich.name}>{rich.name}</span>
          </div>
        </>
      ) : (
        <div className="muted">No living nations</div>
      )}
      <div className="lg-row"><span className="lg-sw" style={{ background: pal.wealthNone }} />Unclaimed</div>
    </div>
  );
}
