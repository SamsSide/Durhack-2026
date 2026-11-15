// The world bible: everything creative about a new world, as plain JSON. Row A2's mock fills it
// from templates; row A5 will fill the same shape from Gemini.
import type { Country, TechAge } from '../types';

export type BibleNation = Omit<Country, 'id' | 'capitalTile' | 'alive' | 'population' | 'treasury' | 'parent'> & {
  regionNames: string[];                                 // 6 or more, in the nation's own culture
};

/**
 * The shape of the planet, read from the prompt (or the picture). Every field is optional: a missing
 * field, or a bible with no `shape` (every world saved before it existed), builds the planet as before.
 */
export interface WorldShape {
  /** Share of the surface that is ocean, 0.3 to 0.8. The Create screen's slider wins when it was moved. */
  seaLevel?: number;
  /** `one` supercontinent, a `few` continents (the default) or `many` islands. */
  landmasses?: 'one' | 'few' | 'many';
  /** `cold` grows the ice caps, `hot` shrinks them and widens the desert belt. */
  climate?: 'cold' | 'temperate' | 'hot';
  /** 0 (wet) to 1 (dry): how much of the low land is desert. 0.5 is the usual mix. */
  dryness?: number;
  /** 0 (bare) to 1 (wooded): how much of the low land is forest. 0.5 is the usual mix. */
  forest?: number;
  /** 0 (flat) to 1 (rugged): how much of the land is hills and mountains. 0.5 is the usual mix. */
  mountains?: number;
}

export interface WorldBible {
  name: string;
  era: string;
  /** The calendar year the world starts at (negative for BC). */
  startYear: number;
  nations: BibleNation[];
  /** The tech age every nation starts in; when missing, `startAge(era)` decides (old bibles). */
  startAge?: TechAge;
  /** The planet's shape from the prompt; when missing, the planet is built as before. */
  shape?: WorldShape;
}

const LANDMASSES = ['one', 'few', 'many'] as const;
const CLIMATES = ['cold', 'temperate', 'hot'] as const;
const unit = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? Math.round(Math.max(0, Math.min(1, x)) * 100) / 100 : undefined;

/** Validates and clamps a world shape from any source; unknown or broken fields are dropped. */
export function cleanShape(raw: unknown): WorldShape {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: WorldShape = {};
  if (typeof r.seaLevel === 'number' && Number.isFinite(r.seaLevel)) out.seaLevel = Math.round(Math.max(0.3, Math.min(0.8, r.seaLevel)) * 100) / 100;
  if ((LANDMASSES as readonly unknown[]).includes(r.landmasses)) out.landmasses = r.landmasses as WorldShape['landmasses'];
  if ((CLIMATES as readonly unknown[]).includes(r.climate)) out.climate = r.climate as WorldShape['climate'];
  for (const k of ['dryness', 'forest', 'mountains'] as const) { const v = unit(r[k]); if (v !== undefined) out[k] = v; }
  return out;
}
