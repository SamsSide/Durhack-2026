// Terrain effects: defence, supply, attrition, move cost and yields per terrain (owner issue #135).
// Swapped for TERRAIN_EFFECTS from @terra/shared when lane a lands it (#135).
import type { Terrain } from '@terra/shared';

export interface TerrainEffect {
  /** Defender strength bonus, 0.75 = +75%. */
  defence: number;
  /** Share of army upkeep supplied, 1 = full. */
  supply: number;
  /** Strength lost per year by units standing here, 0.03 = 3%. */
  attrition: number;
  move: number;
  yields: string[];
}

const TABLE: Record<Terrain, TerrainEffect> = {
  ocean: { defence: 0, supply: 1, attrition: 0, move: 1, yields: [] },
  plains: { defence: 0, supply: 1, attrition: 0, move: 1, yields: ['food', 'growth'] },
  coast: { defence: 0, supply: 1, attrition: 0, move: 1, yields: ['trade', 'ports'] },
  forest: { defence: 0.25, supply: 0.8, attrition: 0, move: 2, yields: ['wood'] },
  hills: { defence: 0.4, supply: 0.7, attrition: 0.01, move: 2, yields: ['stone', 'forts'] },
  mountain: { defence: 0.75, supply: 0.5, attrition: 0.03, move: 3, yields: ['ore', 'mines'] },
  desert: { defence: 0.1, supply: 0.5, attrition: 0.04, move: 2, yields: ['gold', 'salt'] },
  ice: { defence: 0.2, supply: 0.4, attrition: 0.05, move: 3, yields: [] },
};

export function terrainEffects(terrain: Terrain): TerrainEffect {
  return TABLE[terrain] ?? TABLE.plains;
}

export const TERRAIN_LABELS: Record<Terrain, string> = {
  ocean: 'Ocean', coast: 'Coast', plains: 'Plains', forest: 'Forest', hills: 'Hills',
  mountain: 'Mountain', desert: 'Desert', ice: 'Ice',
};

const pct = (v: number): string => `${v >= 0 ? '+' : '-'}${Math.round(Math.abs(v) * 100)}%`;

/** "+75% def · 50% supply · -3%/yr" */
export function effectsLine(terrain: Terrain): string {
  const e = terrainEffects(terrain);
  const parts = [`${pct(e.defence)} def`, `${Math.round(e.supply * 100)}% supply`];
  parts.push(e.attrition > 0 ? `-${Math.round(e.attrition * 100)}%/yr` : 'no attrition');
  return parts.join(' · ');
}
