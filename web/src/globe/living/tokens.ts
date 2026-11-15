// Every number and colour of the living world in one place, so another lane can match them.
export const LIVING = {
  /** Camera distance: the layer starts to show below `far` and is full below `near`. */
  far: 1.9, near: 1.55,
  /** People, herds and market bustle only show closer than this. */
  fineFar: 1.5, fineNear: 1.3,
  /** Frame budget for the whole layer, in ms; over it the quality steps down. */
  budgetMs: 1.5,
  quality: [1, 0.6, 0.3] as readonly number[],
  /** Longest cart route, in tiles. */
  maxRoute: 9,
  /** Sizes as a share of a tile's centre-to-corner distance. */
  size: { boat: 0.15, cart: 0.1, person: 0.026, mill: 0.16, smoke: 0.035, bird: 0.042 },
  cap: { boats: 500, carts: 500, dots: 3000, mills: 160, smoke: 900, birds: 1400, surf: 2400, routes: 140, flocks: 260 },
  color: {
    hull: '#7a5636', hullDark: '#4a3524', sail: '#f1e8d2', wood: '#a07a4c', canvas: '#e6dcc2', ox: '#6b5340',
    millWall: '#e0d4bc', millRoof: '#8a4b34', smoke: '#cfcabf', smokeDark: '#6f6a66',
    farmerA: '#b8894e', farmerB: '#7c8f9c', sheep: '#ece6d6', cattle: '#7a5234', deer: '#8f6a45',
    lateHull: '#f0f4f6', lateBand: '#59dcff', lateCabin: '#dbe6ec', lateGlass: '#39454f',
    gull: '#f4f1e8', bird: '#2b2a28', foam: '#dff0f2', window: '#ffc56e',
  },
} as const;
