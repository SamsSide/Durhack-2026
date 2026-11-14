// Lane b: the look of the close-up towns. Every colour and size ratio the towns use lives here.
import type { BuildingStyle } from '@terra/shared';

/** Two or three roof colours per architecture style, picked per house by a seeded hash. */
export const ROOFS: Record<BuildingStyle, string[]> = {
  medieval: ['#8a4632', '#9c5a3c', '#74392a'],
  classical: ['#b8573a', '#c96a45', '#a24a32'],
  desert: ['#e6d8b8', '#d4b689', '#c79e68'],
  east_asian: ['#3f4b55', '#5a3a2e', '#4d5a5e'],
  mesoamerican: ['#d6c49a', '#b07a50', '#9c8a6a'],
  scrap: ['#7a5e4a', '#6a6a66', '#8a5a3a'],
  norse: ['#5a4630', '#5e6a3c', '#6a4a32'],
  south_asian: ['#c8743a', '#dcbc8c', '#b05a3a'],
  sahel: ['#b0784a', '#c8925a', '#a0683e'],
  industrial: ['#6a4a40', '#5a5a62', '#86483a'],
  soviet_bloc: ['#9a9a94', '#86867f', '#b0aea6'],
  western_modern: ['#c8ccd0', '#8a9098', '#ded9d0'],
  egyptian: ['#e0cc98', '#d0b47a', '#c8a868'],
  highland: ['#5c5c5e', '#6a5a48', '#4a4a50'],
  arcology: ['#e8eef0', '#9fd8d0', '#c4cfd6'],
};

/** House walls: the roof colour washed toward this plaster, so pale styles get pale walls. */
export const PLASTER = '#e0d4bc';

/** Taller blocks for the industrial and modern styles. */
export const HEIGHT_K: Partial<Record<BuildingStyle, number>> = {
  soviet_bloc: 1.9, western_modern: 1.7, industrial: 1.35, arcology: 2.2,
};

export const GROUND = '#c8b088';      // pale earth: the streets between the blocks
export const COURTYARD = '#5f7f3e';
export const PARK = '#6b8a46';
export const RING_ROAD = '#b9a582';
export const BRIDGE = '#8a6a48';
export const WALL = '#a39a88';
export const TOWER = '#8f8676';

/** Town radius (in tile widths) and target house count by settlement kind. */
export const KIND_R: Record<string, number> = { town: 0.45, city: 0.55, capital: 0.62 };
export const KIND_N: Record<string, number> = { town: 40, city: 120, capital: 200 };

/** Camera distance: towns start to fade in below FADE_FAR and are full below FADE_NEAR. */
export const FADE_FAR = 1.5, FADE_NEAR = 1.3;
