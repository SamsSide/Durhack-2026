import { useWorld } from '../state/world';
import { BIOME_COLORS } from '../globe/palette';
import { TERRAIN_LABELS, effectsLine } from '../globe/terrain/effects';
import type { Terrain } from '@terra/shared';
import './hud.css';

const ROWS: [Terrain, string][] = [
  ['plains', BIOME_COLORS.plains],
  ['forest', BIOME_COLORS.forest],
  ['hills', BIOME_COLORS.hills],
  ['mountain', BIOME_COLORS.mountain],
  ['desert', BIOME_COLORS.desert],
  ['ice', BIOME_COLORS.ice],
];

export function TerrainLegend({ hidden = false }: { hidden?: boolean }) {
  const world = useWorld((s) => s.world);
  const mapMode = useWorld((s) => s.mapMode);
  if (hidden || !world || mapMode !== 'terrain') return null;
  return (
    <div className="hud legend-box legend-terrain tn-lacquer tn-frame">
      <div className="cap tn-cartouche">Terrain</div>
      <div className="muted">Defence, army supply and yearly attrition</div>
      {ROWS.map(([t, colour]) => (
        <div className="lg-row" key={t}>
          <span className="lg-sw" style={{ background: colour }} />
          <span className="lg-name">{TERRAIN_LABELS[t]}</span>
          <span className="lg-fx">{effectsLine(t)}</span>
        </div>
      ))}
    </div>
  );
}
