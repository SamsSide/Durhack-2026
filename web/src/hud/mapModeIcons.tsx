// Map-mode icons for the strip on the minimap (#245): the six SVGs in ui/icons/mapmodes/ (24 px
// grid, lines in currentColor). Loaded as raw text and drawn inline, so currentColor follows the
// button colour.
import type { WorldStore } from '../state/world';

export type MapMode = WorldStore['mapMode'];

export const MAP_MODE_LABELS: Record<MapMode, string> = {
  political: 'Political', terrain: 'Terrain', diplomacy: 'Diplomacy',
  strength: 'Strength', wealth: 'Wealth', politics: 'Politics',
};

import political from '../ui/icons/mapmodes/political.svg?raw';
import terrain from '../ui/icons/mapmodes/terrain.svg?raw';
import diplomacy from '../ui/icons/mapmodes/diplomacy.svg?raw';
import strength from '../ui/icons/mapmodes/strength.svg?raw';
import wealth from '../ui/icons/mapmodes/wealth.svg?raw';
import politics from '../ui/icons/mapmodes/politics.svg?raw';

/** The markup between the outer <svg> tags; the outer element carries the stroke attributes. */
const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const GLYPHS: Record<MapMode, string> = {
  political: inner(political), terrain: inner(terrain), diplomacy: inner(diplomacy),
  strength: inner(strength), wealth: inner(wealth), politics: inner(politics),
};

export function MapModeIcon({ mode, size = 20 }: { mode: MapMode; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: GLYPHS[mode] }}
    />
  );
}
