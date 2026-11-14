// Map-mode icons for the strip on the minimap (#245). Placeholder line icons in the gold-on-dark
// theme: they draw in currentColor, 20 x 20. Swap a path here when the owner's Figma icons land.
// Lane b.
import type { ReactElement } from 'react';
import type { WorldStore } from '../state/world';

export type MapMode = WorldStore['mapMode'];

export const MAP_MODE_LABELS: Record<MapMode, string> = {
  political: 'Political', terrain: 'Terrain', diplomacy: 'Diplomacy',
  strength: 'Strength', wealth: 'Wealth', politics: 'Politics',
};

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const GLYPHS: Record<MapMode, ReactElement> = {
  // A flag on a pole.
  political: (
    <g {...P}>
      <path d="M5 18V3" />
      <path d="M5 4h10l-2.5 3.5L15 11H5" fill="currentColor" fillOpacity="0.25" />
    </g>
  ),
  // Two peaks, the higher one snow-capped.
  terrain: (
    <g {...P}>
      <path d="M1.5 17 8 6.5l3.2 5.1L13.5 8.5 18.5 17Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M6.2 9.4 8 6.5l1.8 2.9-1.1-.6-.7.9-.7-.9Z" fill="currentColor" stroke="none" />
    </g>
  ),
  // Two hands meeting.
  diplomacy: (
    <g {...P}>
      <path d="M1.5 8.5 5 6l3 1.5" />
      <path d="M18.5 8.5 15 6l-4.5 2-2.8 2.4a1.1 1.1 0 0 0 1.5 1.6L11.5 10" />
      <path d="M4.2 7.4 3 13l2 1.6M15.6 6.7 17 13l-4.8 3.6a1.2 1.2 0 0 1-1.6-.2" />
      <path d="M5 14.6 8.6 17.2a1.2 1.2 0 0 0 1.6-.2l.4-.5M7 12.8l2.8 2.2M8.6 11.4l3 2.4" />
    </g>
  ),
  // Crossed swords.
  strength: (
    <g {...P}>
      <path d="M3 3l10 10M17 3 7 13" />
      <path d="M3 3h3M3 3v3M17 3h-3M17 3v3" />
      <path d="M11 12.5 14.5 16M9 12.5 5.5 16" strokeWidth="2.2" />
      <path d="M14.5 16l2 2M5.5 16l-2 2" />
    </g>
  ),
  // A stack of three coins.
  wealth: (
    <g {...P}>
      <ellipse cx="10" cy="5" rx="6" ry="2.2" fill="currentColor" fillOpacity="0.25" />
      <path d="M4 5v3.5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V5" />
      <path d="M4 8.5V12c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V8.5" />
      <path d="M4 12v3.5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V12" />
    </g>
  ),
  // A balance with two pans.
  politics: (
    <g {...P}>
      <path d="M10 2.5v15M6.5 17.5h7M3.5 5.5h13" />
      <circle cx="10" cy="3" r="0.9" fill="currentColor" />
      <path d="M3.5 5.5 1.3 11h4.4ZM16.5 5.5 14.3 11h4.4Z" />
      <path d="M1.3 11a2.2 1.3 0 0 0 4.4 0M14.3 11a2.2 1.3 0 0 0 4.4 0" fill="currentColor" fillOpacity="0.25" />
    </g>
  ),
};

export function MapModeIcon({ mode, size = 20 }: { mode: MapMode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {GLYPHS[mode]}
    </svg>
  );
}
