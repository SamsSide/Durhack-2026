// Small inline-SVG icons for the collapsed panel buttons (18px, currentColor).
const base = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const ScrollIcon = () => (
  <svg {...base}><path d="M7 4h11a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" /><path d="M7 4a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V9" /><path d="M9 10h7M9 14h7" /></svg>
);
export const HourglassIcon = () => (
  <svg {...base}><path d="M6 3h12M6 21h12" /><path d="M7 3v3a5 5 0 0 0 2 4l3 2-3 2a5 5 0 0 0-2 4v3" /><path d="M17 3v3a5 5 0 0 1-2 4l-3 2 3 2a5 5 0 0 1 2 4v3" /></svg>
);
export const QuillIcon = () => (
  <svg {...base}><path d="M20 4c-8 0-13 5-13 12l-3 4" /><path d="M20 4c0 7-4 11-11 12" /><path d="M9 16h5" /></svg>
);
