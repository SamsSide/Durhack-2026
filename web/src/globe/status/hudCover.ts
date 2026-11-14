// The screen rectangles the HUD panels cover (nation card, network panel, event feed cards), measured at most
// every 200 ms, so globe tags pinned with drei Html can hide instead of drawing over a panel (#175). Lane b.

type Rect = { l: number; t: number; r: number; b: number };

const SELECTORS = ['.card-dock:not(.out)', '.tn-net', '.event-feed-slot .tn-feed-card', '.ledger-slot', '.news-slot'];
const EVERY = 200;
let rects: Rect[] = [];
let at = -1e9;

function measure(): void {
  const now = performance.now();
  if (now - at < EVERY || typeof document === 'undefined') return;
  at = now;
  const out: Rect[] = [];
  for (const sel of SELECTORS) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
  }
  rects = out;
}

/** True when a HUD panel covers this element's centre (or, with `pad`, comes within `pad` px of it). */
export function underHud(el: HTMLElement, pad = 6): boolean {
  measure();
  if (rects.length === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    // a zero-size anchor: test its point
    return rects.some((h) => r.left >= h.l - pad && r.left <= h.r + pad && r.top >= h.t - pad && r.top <= h.b + pad);
  }
  return rects.some((h) => r.left < h.r + pad && r.right > h.l - pad && r.top < h.b + pad && r.bottom > h.t - pad);
}
