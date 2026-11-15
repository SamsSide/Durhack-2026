import { useWorld } from '../state/world';
import { BIOME_COLORS } from '../globe/palette';
import { TERRAIN_MOUNTAIN_CSS } from '../globe/mesh/colors';
import { TERRAIN_LABELS, effectsLine } from '../globe/terrain/effects';
import type { Terrain } from '@terra/shared';
import { usePresence } from '../ui/motion/usePresence';
import './hud.css';

const ROWS: [Terrain, string][] = [
  ['plains', BIOME_COLORS.plains],
  ['forest', BIOME_COLORS.forest],
  ['hills', BIOME_COLORS.hills],
  ['mountain', TERRAIN_MOUNTAIN_CSS], // the lifted ground colour, not the raw biome slate
  ['desert', BIOME_COLORS.desert],
  ['ice', BIOME_COLORS.ice],
];

export function TerrainLegend({ hidden = false }: { hidden?: boolean }) {
  const world = useWorld((s) => s.world);
  const mapMode = useWorld((s) => s.mapMode);
  const { mounted, leaving } = usePresence(!hidden && !!world && mapMode === 'terrain');
  if (!mounted || !world) return null;
  return (
    <div className={`hud legend-box legend-terrain tn-lacquer tn-frame${leaving ? ' tn-m-out' : ''}`}>
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
