// Label layout helpers: the main body of a nation and its principal axis on the globe. Lane b.
import type { World } from '@terra/shared';

type V3 = [number, number, number];

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The largest connected block of these tiles (a nation's mainland, not its far colonies). */
export function mainBody(world: World, tiles: number[]): number[] {
  if (tiles.length <= 2) return tiles;
  const set = new Set(tiles);
  const seen = new Set<number>();
  let best: number[] = [];
  for (const start of tiles) {
    if (seen.has(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const t = stack.pop()!;
      comp.push(t);
      for (const n of world.tiles[t]!.neighbors) {
        if (set.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    if (comp.length > best.length) best = comp;
    if (best.length * 2 > tiles.length) break;
  }
  return best;
}

export interface LabelAxis {
  /** Unit vector along the nation's long axis, in the tangent plane at its centre. */
  axis: V3;
  /** Unit vector across it. */
  minor: V3;
  /** World-unit length along the long axis (tile edge to tile edge). */
  major: number;
  /** World-unit length across. */
  across: number;
  /** False for single-tile or roughly round nations: those names stay horizontal. */
  elongated: boolean;
}

/** PCA of the tile centres projected onto the tangent plane at `centre`. */
export function labelAxis(world: World, tiles: number[], centre: V3): LabelAxis {
  const n = norm(centre);
  const ref: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const k = dot(ref, n);
  const north = norm([ref[0] - n[0] * k, ref[1] - n[1] * k, ref[2] - n[2] * k]);
  const east = cross(north, n);
  const tileSpan = 4 / Math.sqrt(Math.max(1, world.tiles.length)); // about one tile across
  if (tiles.length < 3) return { axis: east, minor: north, major: tileSpan * Math.max(1, tiles.length), across: tileSpan, elongated: false };
  const us: number[] = [];
  const vs: number[] = [];
  let mu = 0, mv = 0;
  for (const t of tiles) {
    const c = norm(world.tiles[t]!.center);
    const u = dot(c, east), v = dot(c, north);
    us.push(u); vs.push(v); mu += u; mv += v;
  }
  mu /= tiles.length; mv /= tiles.length;
  let a = 0, b = 0, d = 0;
  for (let i = 0; i < us.length; i++) {
    const du = us[i]! - mu, dv = vs[i]! - mv;
    a += du * du; b += du * dv; d += dv * dv;
  }
  const theta = 0.5 * Math.atan2(2 * b, a - d);
  const mid = (a + d) / 2, rad = Math.hypot((a - d) / 2, b);
  const l1 = mid + rad, l2 = Math.max(1e-12, mid - rad);
  const cu = Math.cos(theta), sv = Math.sin(theta);
  const axis = norm([east[0] * cu + north[0] * sv, east[1] * cu + north[1] * sv, east[2] * cu + north[2] * sv]);
  const minor = cross(n, axis);
  let lo = Infinity, hi = -Infinity, lo2 = Infinity, hi2 = -Infinity;
  for (let i = 0; i < us.length; i++) {
    const p = us[i]! * cu + vs[i]! * sv;
    const q = -us[i]! * sv + vs[i]! * cu;
    if (p < lo) lo = p; if (p > hi) hi = p;
    if (q < lo2) lo2 = q; if (q > hi2) hi2 = q;
  }
  return {
    axis, minor,
    major: hi - lo + tileSpan,
    across: hi2 - lo2 + tileSpan,
    elongated: Math.sqrt(l1 / l2) > 1.35,
  };
}

/** A name's box on screen: centre and half sizes in px (y up), turned by the unit vector (c, s). */
export interface ScreenBox { x: number; y: number; hw: number; hh: number; c: number; s: number }

/** The nation names on screen this frame, by label key. Region names give way to them. */
export const nationBoxes = new Map<string, ScreenBox>();

/** True when two turned boxes overlap (separating axes). */
export function boxesCross(a: ScreenBox, b: ScreenBox): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  const axes = [a.c, a.s, -a.s, a.c, b.c, b.s, -b.s, b.c];
  for (let i = 0; i < 8; i += 2) {
    const ax = axes[i]!, ay = axes[i + 1]!;
    const ra = a.hw * Math.abs(a.c * ax + a.s * ay) + a.hh * Math.abs(-a.s * ax + a.c * ay);
    const rb = b.hw * Math.abs(b.c * ax + b.s * ay) + b.hh * Math.abs(-b.s * ax + b.c * ay);
    if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
  }
  return true;
}

// Cinzel for the globe names. troika needs a .woff/.ttf URL (not woff2); fontsource on jsDelivr
// serves a pinned one. Checked once: if it can't be fetched (offline venue), labels keep the default font.
const CINZEL_URL = '/fonts/cinzel-latin-600-normal.woff'; // self-hosted copy of @fontsource/cinzel 5.0.13 (SIL OFL)
let fontState: 'pending' | 'ok' | 'fail' = 'pending';
const fontListeners = new Set<() => void>();
if (typeof fetch !== 'undefined') {
  fetch(CINZEL_URL)
    .then((r) => { fontState = r.ok ? 'ok' : 'fail'; })
    .catch(() => { fontState = 'fail'; })
    .finally(() => fontListeners.forEach((f) => f()));
}
export function subscribeFont(f: () => void): () => void {
  fontListeners.add(f);
  return () => { fontListeners.delete(f); };
}
export function labelFont(): string | undefined {
  return fontState === 'ok' ? CINZEL_URL : undefined;
}
