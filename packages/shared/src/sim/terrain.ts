// Terrain effects (row A28; the table is in docs/contracts.md X1). One table that the sim, the
// rulers' digests and the globe all read, so terrain means the same thing everywhere.
import type { Terrain } from '../types';

export type TerrainEffect = {
  /** Defender strength x (1 + defence); a fort multiplies on top. */
  defence: number;
  /** 0..1; an army's upkeep on this tile is divided by supply. */
  supply: number;
  /** Share of strength an army loses per year on this tile when it is outside its own land. */
  attrition: number;
  /** Years a land unit takes to enter this tile (arriveTick = tick + move). */
  move: number;
  /** Treasury per year per owned province. */
  income: number;
  /** Population cap per owned province. */
  pop: number;
  /** Display labels. */
  yields: string[];
};

export const TERRAIN_EFFECTS: Record<Terrain, TerrainEffect> = {
  ocean: { defence: 0, supply: 1, attrition: 0, move: 1, income: 0, pop: 0, yields: ['fish', 'trade'] },
  coast: { defence: 0, supply: 1, attrition: 0, move: 1, income: 0.9, pop: 900, yields: ['trade', 'ports'] },
  plains: { defence: 0, supply: 1, attrition: 0, move: 1, income: 0.9, pop: 900, yields: ['food', 'growth'] },
  forest: { defence: 0.25, supply: 0.8, attrition: 0, move: 2, income: 0.55, pop: 500, yields: ['wood'] },
  hills: { defence: 0.4, supply: 0.7, attrition: 0.01, move: 2, income: 0.6, pop: 500, yields: ['stone', 'forts'] },
  mountain: { defence: 0.75, supply: 0.5, attrition: 0.03, move: 3, income: 0.35, pop: 150, yields: ['ore', 'mines'] },
  desert: { defence: 0.1, supply: 0.5, attrition: 0.04, move: 2, income: 0.25, pop: 250, yields: ['gold', 'salt'] },
  ice: { defence: 0.2, supply: 0.4, attrition: 0.05, move: 3, income: 0.1, pop: 80, yields: ['almost nothing'] },
};

/** An army attacking from the sea fights at (1 - LANDING_PENALTY). */
export const LANDING_PENALTY = 0.2;
