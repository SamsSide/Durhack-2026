// Lane b: the look of harbours. Every colour and size ratio the port layer uses lives here.
// Sizes are fractions of U, the tile width (twice the centre-to-edge distance). Heights above the sea are
// absolute radii (the globe's sea is at SEA_LEVEL, the land starts at LAND_BASE).
import type { TechAge } from '@terra/shared';

export type PortEra = 'early' | 'middle' | 'modern' | 'future';

/** Ancient and medieval: wood and a lighthouse. Gunpowder and industrial: stone and cranes. Modern: containers. Future and stellar: floating docks. */
export function portEra(age: TechAge | undefined): PortEra {
  switch (age ?? 'ancient') {
    case 'ancient': case 'medieval': return 'early';
    case 'gunpowder': case 'industrial': return 'middle';
    case 'modern': return 'modern';
    default: return 'future';
  }
}

export const PORT_COLORS = {
  plank: ['#8a6a45', '#7c5e3c', '#957550'],
  pile: '#4f3b28',
  sail: '#e8dfc8',
  hullWood: ['#6b4a30', '#8a5e3a', '#5a4a3a'],
  stone: '#a8a39a',
  stoneDark: '#7d7a73',
  coping: '#c4beb0',
  iron: '#3d4248',
  craneWood: '#6e5336',
  shed: '#9a7a58',
  shedRoof: '#6a4634',
  lightWhite: '#ece6da',
  lightRed: '#b8473a',
  lamp: '#ffd86a',
  concrete: '#9b9ea0',
  stripe: '#e2b92f',
  craneRed: '#c0483a',
  craneGrey: '#d4d6d8',
  hullDark: '#2f4256',
  hullRed: '#8a2f2f',
  funnel: '#34383c',
  funnelBand: '#c0483a',
  containers: ['#c0483a', '#2f6fa8', '#e08a2f', '#3f8a55', '#e6e6e0', '#7a4a8a', '#c9b030'],
  floatPad: '#dbe6ec',
  floatRing: '#59dcff',
  floatWalk: '#c4d2da',
  floatHull: '#f0f4f6',
  floatDark: '#39454f',
} as const;

/** Distance (camera radius) inside which harbours are drawn; matches the close-up towns. */
export const PORT_FADE_FAR = 1.85;
/** Boats moored at a port by era (a coastal town's pier holds one). */
export const PORT_BOATS: Record<PortEra, number> = { early: 2, middle: 3, modern: 2, future: 3 };
