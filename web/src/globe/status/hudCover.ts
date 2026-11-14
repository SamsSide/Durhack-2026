// The screen rectangles the HUD panels cover (nation card, network panel, event feed cards), measured every
// 200 ms, so globe tags pinned with drei Html can hide instead of drawing over a panel (#175). Lane b.

type Rect = { l: number; t: number; r: number; b: number };

const SELECTORS = ['.left-dock:not(.out)', '.tn-net', '.event-feed-slot .tn-feed-card', '.ledger-slot', '.news-slot'];
// B8: reading a box makes the browser lay the page out on the spot (1 to 2 ms each time it is not already
// clean), and every pinned tag asked every frame. All readers now share one clock of 100 ms slots: the panels
// are measured every second slot, each tag's answer is kept for its slot, and the caption layout runs once a
// slot, so the reads land together in one frame out of about six instead of in every frame.
const SLOT_MS = 100;
export const hudSlot = (): number => Math.floor(performance.now() / SLOT_MS);
let rects: Rect[] = [];
let at = -1e9;

function measure(): void {
  const slot = hudSlot();
  if (slot - at < 2 || typeof document === 'undefined') return;
  at = slot;
  const out: Rect[] = [];
  for (const sel of SELECTORS) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
  }
  rects = out;
}

const seen = new WeakMap<HTMLElement, { slot: number; pad: number; hit: boolean }>();

/** True when a HUD panel covers this element's centre (or, with `pad`, comes within `pad` px of it). */
export function underHud(el: HTMLElement, pad = 6): boolean {
  measure();
  if (rects.length === 0) return false;
  const slot = hudSlot();
  const last = seen.get(el);
  if (last && last.pad === pad && last.slot === slot) return last.hit;
  const r = el.getBoundingClientRect();
  // a zero-size anchor: test its point
  const hit = r.width === 0 && r.height === 0
    ? rects.some((h) => r.left >= h.l - pad && r.left <= h.r + pad && r.top >= h.t - pad && r.top <= h.b + pad)
    : rects.some((h) => r.left < h.r + pad && r.right > h.l - pad && r.top < h.b + pad && r.bottom > h.t - pad);
  seen.set(el, { slot, pad, hit });
  return hit;
}
