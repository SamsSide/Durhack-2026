// B11: the key for the politics map mode. Far left deep red, centre grey, far right dark navy;
// the more radical a nation, the stronger its colour. Lane b.
import { movementOf } from '@terra/shared';
import { useWorld } from '../state/world';
import { POLITICS_LEFT, POLITICS_MID, POLITICS_RIGHT } from '../globe/mesh/colors';
import { getPalette } from '../globe/palette';
import './hud.css';

export function PoliticsLegend({ hidden = false }: { hidden?: boolean }) {
  const world = useWorld((s) => s.world);
  const mapMode = useWorld((s) => s.mapMode);
  if (hidden || !world || mapMode !== 'politics') return null;
  return (
    <div className="hud legend-box legend-politics tn-lacquer tn-frame">
      <div className="cap tn-cartouche">Politics</div>
      <div className="muted">Where each nation stands; strong colour means radical</div>
      <div className="lg-ramp" style={{ background: `linear-gradient(90deg, ${POLITICS_LEFT}, ${POLITICS_MID} 50%, ${POLITICS_RIGHT})` }} />
      <div className="lg-ends"><span>{movementOf(-100).short}</span><span>{movementOf(0).short}</span><span>{movementOf(100).short}</span></div>
      <div className="lg-row"><span className="lg-sw" style={{ background: getPalette().wealthNone }} />Unclaimed</div>
    </div>
  );
}
