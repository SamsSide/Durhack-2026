// Distinct nation colours (owner QA, 15 Nov): two greens (#3fa95f and #38b000) were hard to tell apart on the
// map. Both bible paths (the model's repaired bible and the template) run their colours through
// distinctNationColors, which measures every pair in OKLab and moves the later nation of a too-close pair
// to the free hue that is farthest from every colour already taken. Pure and deterministic: no randomness.

/** Two nation colours closer than this in OKLab (euclidean, L in 0..1) count as the same colour to the eye.
 *  The two QA greens are 0.077 apart; the template palette's nearest pair (green and lime) is 0.097. */
export const MIN_NATION_DELTA = 0.09;
/** Nation colours must also stay this far from the sea and the unowned land tones (below). */
const MIN_FROM_TERRAIN = 0.08;

type Lab = [number, number, number];
const HEX = /^#[0-9a-fA-F]{6}$/;

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB hex to OKLab (Bjorn Ottosson's matrices). */
export function hexToOklab(hex: string): Lab {
  const r = toLinear(parseInt(hex.slice(1, 3), 16) / 255), g = toLinear(parseInt(hex.slice(3, 5), 16) / 255), b = toLinear(parseInt(hex.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** OKLab to a hex colour, or null when it falls outside the sRGB gamut. */
function oklabToHex([L, a, b]: Lab): string | null {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (lin.some((v) => v < -0.0005 || v > 1.0005)) return null;
  return '#' + lin.map((v) => Math.round(Math.max(0, Math.min(1, fromLinear(Math.max(0, Math.min(1, v))))) * 255).toString(16).padStart(2, '0')).join('');
}

/** Perceptual distance between two hex colours (OKLab, euclidean). */
export function colorDelta(a: string, b: string): number {
  const x = hexToOklab(a), y = hexToOklab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** The sea, the ice, the unowned parchment, white and black (web/src/globe/palette.ts): nations stay clear of them.
 *  The land greens and sands are not listed: the template palette itself uses greens and yellows, and an owned
 *  province is tinted, so only the colours that would read as "nobody's" or as water are kept away. */
const AVOID = [
  '#14284a', '#2b4a5e', '#dbe9f2', '#eef0ee', '#d8d2c0', '#ecdfc0', '#ffffff', '#000000',
].map(hexToOklab);

const lchOf = (hex: string): { L: number; C: number; h: number } => {
  const [L, a, b] = hexToOklab(hex);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
};
const labAt = (L: number, C: number, h: number): Lab => [L, C * Math.cos(h), C * Math.sin(h)];
/** The colour at this hue and lightness with as much of the wanted chroma as sRGB can show. */
function fit(L: number, C: number, h: number): string {
  for (let c = C; c >= 0; c -= 0.005) { const hex = oklabToHex(labAt(L, c, h)); if (hex) return hex; }
  return oklabToHex(labAt(L, 0, h)) ?? '#808080';
}

/** The first colour is kept; each later one that is within MIN_NATION_DELTA of an earlier one (or sits on the
 *  sea or the land tones) is moved to the hue, among 72 evenly spaced, whose colour is farthest from every
 *  colour already taken, with lightness and chroma pulled into a range that reads on the globe.
 *  Colours that are already fine are returned unchanged, so a good bible keeps its exact colours. */
export function distinctNationColors(colors: string[]): string[] {
  const out: string[] = [];
  for (const raw of colors) {
    const c = HEX.test(raw) ? raw.toLowerCase() : '#808080';
    const lab = hexToOklab(c);
    const nearest = (x: Lab, list: Lab[]) => list.reduce((m, y) => Math.min(m, Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])), Infinity);
    const taken = out.map(hexToOklab);
    if (nearest(lab, taken) >= MIN_NATION_DELTA && nearest(lab, AVOID) >= MIN_FROM_TERRAIN) { out.push(c); continue; }
    const { L, C } = lchOf(c);
    const l = Math.max(0.6, Math.min(0.78, L)), ch = Math.max(0.12, Math.min(0.2, C));
    let best = c, bestScore = -1;
    for (let k = 0; k < 72; k++) {
      const cand = fit(l, ch, (k / 72) * 2 * Math.PI);
      const cl = hexToOklab(cand);
      const score = Math.min(nearest(cl, taken), nearest(cl, AVOID) * 1.5); // the terrain counts a little less than a rival nation
      if (score > bestScore + 1e-9) { bestScore = score; best = cand; }
    }
    out.push(best);
  }
  return out;
}

/** Applies distinctNationColors to a bible's nations in place and keeps each flag's first colour equal to its nation colour. */
export function makeNationColorsDistinct(nations: { color: string; flag: { colors: string[] } }[]): void {
  const fixed = distinctNationColors(nations.map((n) => n.color));
  nations.forEach((n, i) => {
    if (fixed[i] === n.color) return;
    n.color = fixed[i]!;
    n.flag = { ...n.flag, colors: [fixed[i]!, ...n.flag.colors.slice(1)] };
  });
}
