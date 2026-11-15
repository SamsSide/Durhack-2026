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

/** Thatch and hide for the round huts of a stone age tribe (buildTown's primitive branch). */
export const THATCH = ['#cdb06a', '#b89a55', '#d6bc7c', '#c4ac8c'];
/** How many huts a tribe's town has, as a share of the houses of a later town: fewer and bigger, with open ground between. */
export const HUT_SHARE = 0.5;

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

// ---- city walls (row A33) --------------------------------------------------------------------------
/** Stone walls in a nation's style. `square` towers are boxes; `roof` puts a roof on every tower;
 *  `pavilion` turns gates into a solid gate block with a roofed hall on top (the colour of that hall). */
export interface WallLook { wall: string; tower: string; roof?: string; square?: boolean; eave?: number; pavilion?: string }
const GREY: WallLook = { wall: '#a39a88', tower: '#8f8676', roof: '#7a4634' };
const MUD: WallLook = { wall: '#c9a271', tower: '#b88f5e', square: true };
const METAL: WallLook = { wall: '#7d6a5a', tower: '#665a50', square: true };
export const WALL_LOOK: Record<BuildingStyle, WallLook> = {
  medieval: GREY,
  classical: { wall: '#d8cfb8', tower: '#c6bca2', square: true },
  desert: MUD,
  east_asian: { wall: '#a9aca8', tower: '#979a97', roof: '#5f7078', square: true, eave: 1.4, pavilion: '#a8473a' },
  mesoamerican: { wall: '#b9a47c', tower: '#a48f68', square: true },
  scrap: METAL,
  norse: { wall: '#8c8676', tower: '#6e5a40', roof: '#4e3c28' },
  south_asian: { wall: '#c98a5e', tower: '#b3744c', square: true, roof: '#e2c9a0', eave: 1.15 },
  sahel: { wall: '#c08a58', tower: '#a87646', square: true },
  industrial: { wall: '#8a6658', tower: '#75564a', square: true },
  soviet_bloc: { wall: '#9c9a94', tower: '#85837d', square: true },
  western_modern: { wall: '#b4b6b8', tower: '#9a9da0', square: true },
  egyptian: { wall: '#d8c08c', tower: '#c6ac76', square: true },
  highland: { wall: '#85858a', tower: '#6e6e74', roof: '#46464c' },
  arcology: { wall: '#c4cfd6', tower: '#9aa8b0', square: true },
};
export const PALISADE = { wall: '#8a6842', post: '#674a2c' };
export const SHIELD = { beam: '#59dcff', pylon: '#39454f', cap: '#c8f8ff' };
export const GATE_DARK = '#3a2f28';
/** Wall sizes in tile widths: height, thickness, tower radius and height, gate width. */
export const WALL_DIM = {
  palisade: { h: 0.03, t: 0.012, towR: 0.011, towH: 0.042, gate: 0.05 },
  stone: { h: 0.046, t: 0.02, towR: 0.023, towH: 0.07, gate: 0.058 },
  keep: { h: 0.062, t: 0.03, towR: 0.031, towH: 0.096, gate: 0.062 },
  shield: { h: 0.06, t: 0.02, towR: 0.016, towH: 0.08, gate: 0.07 },
};

/** Town radius (in tile widths) and target house count by settlement kind. */
export const KIND_R: Record<string, number> = { town: 0.45, city: 0.55, capital: 0.62 };
export const KIND_N: Record<string, number> = { town: 40, city: 120, capital: 200 };

/** Camera distance: towns start to fade in below FADE_FAR and are full below FADE_NEAR. */
export const FADE_FAR = 1.85, FADE_NEAR = 1.55; // full well before the close-up (camera min is 1.12)
