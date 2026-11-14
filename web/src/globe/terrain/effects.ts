// Terrain effects: one table shared with the sim (TERRAIN_EFFECTS in @terra/shared, row A28).
// defence and attrition are fractions (0.75 = +75%, 0.03 = 3% a year); supply is 0..1.
import { TERRAIN_EFFECTS } from '@terra/shared';
import type { Terrain, TerrainEffect } from '@terra/shared';

export type { TerrainEffect };

export function terrainEffects(terrain: Terrain): TerrainEffect {
  return TERRAIN_EFFECTS[terrain] ?? TERRAIN_EFFECTS.plains;
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
