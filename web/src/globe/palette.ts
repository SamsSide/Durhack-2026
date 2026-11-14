import type { Stance, Terrain } from '@terra/shared';

/** Terrain map mode biome colours (Age of History style); the political atlas colours stay in `terrain`. */
export const BIOME_COLORS = {
  desert: '#d4b83a',
  dryBand: '#b7862a',
  plains: '#6f9a45',
  forest: '#2f6a35',
  hills: '#5d6b3c',
  mountain: '#4a4a55',
  ice: '#dbe9f2',
  ocean: '#14284a',
} as const;

export interface Palette {
  terrain: Record<Terrain, string>;
  ocean: string;
  stance: Record<Stance, string>;
  selectedSelf: string;
  strengthLow: string;
  strengthHigh: string;
  strengthNone: string;
  /** Wealth map mode (B12): dark bronze for the poorest nation to bright gold for the richest. */
  wealthLow: string;
  wealthHigh: string;
  wealthNone: string;
  unclaimedTint: string;
  ink: string;
  parchment: string;
  accent: string;
  background: string;
  holo: string;
  night: string;
  silence: string;
  ruin: string;
  /** Share of the nation colour in the political fill (rest is terrain). */
  nationFill: number;
}

const DEFAULTS: Palette = {
  terrain: {
    ocean: '#2b4a5e', coast: '#d9c79a', plains: '#c9b87a', forest: '#7d8f55',
    desert: '#e0c48a', hills: '#a8956a', mountain: '#8a7d6b', ice: '#eef0ee',
  },
  ocean: '#2b4a5e',
  stance: { war: '#b3261e', hostile: '#d9822b', neutral: '#9a9486', trade: '#3f7cac', alliance: '#4f8a3c' },
  selectedSelf: '#c9a24b',
  strengthLow: '#f3e9c6',
  strengthHigh: '#7a1f12',
  strengthNone: '#d8d2c0',
  wealthLow: '#4a2e14',
  wealthHigh: '#ffd34d',
  wealthNone: '#8a867c',
  unclaimedTint: '#d8d2c0',
  ink: '#2a1f14',
  parchment: '#ecdfc0',
  accent: '#c9a24b',
  background: '#090b12',
  holo: '#7fe6d8',
  night: '#0d1620',
  silence: '#1e6b63',
  ruin: '#7b776f',
  nationFill: 0.88,
};

let cached: Palette | null = null;

export function getPalette(): Palette {
  if (cached) return cached;
  const p: Palette = { ...DEFAULTS, terrain: { ...DEFAULTS.terrain }, stance: { ...DEFAULTS.stance } };
  if (typeof document !== 'undefined') {
    const cs = getComputedStyle(document.documentElement);
    const read = (name: string): string => cs.getPropertyValue(name).trim();
    const ocean = read('--globe-ocean');
    if (ocean) { p.ocean = ocean; p.terrain.ocean = ocean; }
    const tok = (name: string, fallback: string): string => read(name) || fallback;
    p.ink = tok('--color-ink', p.ink);
    p.parchment = tok('--color-parchment', p.parchment);
    p.accent = tok('--color-accent', p.accent);
    p.selectedSelf = p.accent;
    p.background = tok('--color-bg', p.background);
    p.holo = tok('--holo-tint', p.holo);
    p.night = tok('--color-night-inset', p.night);
    p.silence = tok('--silence-ink', p.silence);
    p.ruin = tok('--color-ruin', p.ruin);
    for (const s of Object.keys(p.stance) as Stance[]) p.stance[s] = tok(`--stance-${s}`, p.stance[s]);
    for (const t of Object.keys(p.terrain) as Terrain[]) {
      if (t === 'ocean') continue;
      const v = read(`--globe-land-${t}`);
      if (v) p.terrain[t] = v;
    }
  }
  cached = p;
  return p;
}
