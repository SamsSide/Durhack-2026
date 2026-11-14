// Everything the Terra Nova News window draws: the ident, the studio set, the anchor and the
// field footage. One 2D canvas in a fixed 360 x 220 space; the caller scales the context.
// All of it is our own design: a globe-and-quill mark, a night studio in parchment, ink and
// gilt, and six invented presenters built from one rig.

export const W = 360;
export const H = 220;

const TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;

// --- colours ---------------------------------------------------------------------------------
// Interface colours come from tokens.css. The presenters' skin, hair and cloth are theirs alone
// and live here, in one place.

export interface Tokens {
  bg: string; surface: string; surface2: string; border: string; text: string; textMuted: string;
  parchment: string; parchmentLight: string; parchmentDark: string;
  ink: string; inkMuted: string; rubric: string; gilt: string; danger: string; teal: string; ok: string;
  display: string; serif: string;
}

export function readTokens(): Tokens {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--color-bg', '#090b12'),
    surface: v('--color-surface', '#141823'),
    surface2: v('--color-surface-2', '#1d2230'),
    border: v('--color-border', '#343a4a'),
    text: v('--color-text', '#efe6d0'),
    textMuted: v('--color-text-muted', '#aaa391'),
    parchment: v('--color-parchment', '#ecdfc0'),
    parchmentLight: v('--color-parchment-light', '#f6eedb'),
    parchmentDark: v('--color-parchment-dark', '#d6c399'),
    ink: v('--color-ink', '#2a1f14'),
    inkMuted: v('--color-ink-muted', '#5e4c36'),
    rubric: v('--color-rubric', '#9c2f22'),
    gilt: v('--color-accent', '#c9a24b'),
    danger: v('--color-danger', '#b3261e'),
    teal: v('--stance-trade', '#2f7a9a'),
    ok: v('--color-ok', '#4d7a3a'),
    display: v('--font-display', 'serif'),
    serif: v('--font-serif', 'serif'),
  };
}

const SKINS = [
  { base: '#e8c3a0', shade: '#cb9c78', lip: '#a4564a' },
  { base: '#c8946a', shade: '#a47249', lip: '#8a4439' },
  { base: '#8c5b3d', shade: '#6c432b', lip: '#5a2b26' },
  { base: '#dcb08a', shade: '#bb8c66', lip: '#9a4c42' },
];
const HAIRS = ['#4a3220', '#17120e', '#b9b2a4', '#8a4a24'];
const SUITS = [
  { base: '#27344d', dark: '#19233a' },   // navy
  { base: '#3f443b', dark: '#2b2f28' },   // loden
  { base: '#5c2c27', dark: '#421d1a' },   // oxblood
  { base: '#4b4e59', dark: '#353842' },   // slate
  { base: '#1f4d55', dark: '#15373d' },   // deep teal
  { base: '#4d2c4c', dark: '#371e37' },   // plum
];
const MOUTH_DARK = '#3a1210';
const TONGUE = '#b0544c';

export interface Look {
  skin: (typeof SKINS)[number];
  hair: string;
  /** 0 side parting, 1 quiff, 2 close crop, 3 bob, 4 long. */
  style: number;
  suit: (typeof SUITS)[number];
  /** 0 rubric, 1 gilt, 2 teal, 3 green; -1 an open collar with a gilt chain. */
  tie: number;
  glasses: boolean;
  beard: boolean;
  /** A woman presenter: narrower shoulders, lashes, fuller lips, earrings. */
  woman: boolean;
}

// The six team voices get six fixed, clearly different presenters (four men, two women, as the
// voices are labelled). Any other name gets the neutral house presenter. None is drawn from a
// real person: each is a pick of [skin, hair, style, suit, tie, glasses, beard, woman].
type Pick = [number, number, number, number, number, boolean, boolean, boolean];
const CAST: Record<string, Pick> = {
  sam: [0, 0, 0, 0, 0, false, false, false],        // brown side parting, navy, red tie
  justin: [1, 1, 1, 1, 1, true, false, false],      // black quiff, glasses, loden, gilt tie
  denis: [2, 2, 2, 2, 2, false, false, false],      // silver crop, oxblood, teal tie
  boaz: [0, 3, 0, 3, 3, false, true, false],        // auburn hair and beard, slate, green tie
  mei: [3, 1, 3, 4, -1, false, false, true],        // black bob, deep teal jacket
  angelina: [1, 0, 4, 5, -1, false, false, true],   // long brown hair, plum jacket
};
const HOUSE: Pick = [3, 0, 2, 3, 1, false, false, false];

export function lookFor(name: string | undefined): Look {
  const pick = CAST[(name ?? '').trim().toLowerCase()] ?? HOUSE;
  return {
    skin: SKINS[pick[0]], hair: HAIRS[pick[1]], style: pick[2], suit: SUITS[pick[3]],
    tie: pick[4], glasses: pick[5], beard: pick[6], woman: pick[7],
  };
}

// --- small helpers ---------------------------------------------------------------------------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
}

function spaced(ctx: Ctx, px: number): void {
  // Letter spacing on a canvas (Chrome 99+, Safari 17+); elsewhere the text is just tighter.
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

// --- the turning globe -----------------------------------------------------------------------

// Invented continents: blobs on a sphere, fixed by a seed.
const LAND: Array<Array<[number, number]>> = (() => {
  let s = 20261114;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const blobs: Array<[number, number, number, number]> = [
    [20, 34, 36, 20], [72, 6, 20, 28], [138, 40, 30, 17], [152, -26, 20, 15], [214, 18, 26, 32],
    [262, -12, 17, 22], [300, 46, 30, 15], [332, -34, 24, 13], [100, -52, 26, 9],
  ];
  return blobs.map(([lon, lat, rl, rt]) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const r = 0.72 + rnd() * 0.56;
      pts.push([((lon + Math.cos(a) * rl * r) * Math.PI) / 180, (Math.max(-78, Math.min(78, lat + Math.sin(a) * rt * r)) * Math.PI) / 180]);
    }
    return pts;
  });
})();

interface GlobeInk { sea: string | null; land: string | null; line: string; rim: string; lineAlpha: number; landAlpha: number }

function drawGlobe(ctx: Ctx, cx: number, cy: number, R: number, rot: number, ink: GlobeInk): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  if (ink.sea) { ctx.fillStyle = ink.sea; ctx.fill(); }
  ctx.clip();
  if (ink.land) {
    ctx.fillStyle = ink.land;
    ctx.globalAlpha = ink.landAlpha;
    for (const poly of LAND) {
      let front = false;
      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const l = poly[i][0] - rot;
        const cl = Math.cos(poly[i][1]);
        let x = cl * Math.sin(l);
        let y = -Math.sin(poly[i][1]);
        if (cl * Math.cos(l) > 0) front = true;
        else { const n = Math.hypot(x, y) || 1; x /= n; y /= n; }   // behind: pinned to the limb
        if (i === 0) ctx.moveTo(cx + x * R, cy + y * R); else ctx.lineTo(cx + x * R, cy + y * R);
      }
      if (front) { ctx.closePath(); ctx.fill(); }
    }
  }
  ctx.globalAlpha = ink.lineAlpha;
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 6; k++) {
    oval(ctx, cx, cy, R * Math.abs(Math.sin(rot + (k * Math.PI) / 6)), R);
    ctx.stroke();
  }
  ctx.beginPath();
  for (const f of [-0.55, 0, 0.55]) {
    const half = R * Math.sqrt(1 - f * f);
    ctx.moveTo(cx - half, cy + f * R);
    ctx.lineTo(cx + half, cy + f * R);
  }
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.strokeStyle = ink.rim;
  ctx.lineWidth = Math.max(1, R * 0.045);
  ctx.stroke();
}

/** Our mark: a gilt globe with a quill laid across it. `p` 0..1 draws it on. */
function drawMark(ctx: Ctx, T: Tokens, cx: number, cy: number, R: number, rot: number, p: number): void {
  const ring = easeOut(span(p, 0, 0.6));
  ctx.save();
  ctx.globalAlpha = ring;
  drawGlobe(ctx, cx, cy, R * (0.8 + 0.2 * ring), rot, { sea: T.surface, land: T.gilt, line: T.gilt, rim: T.gilt, lineAlpha: 0.45 * ring, landAlpha: 0.5 });
  ctx.restore();

  const q = easeOut(span(p, 0.35, 1));
  if (q <= 0) return;
  ctx.save();
  ctx.globalAlpha = q;
  ctx.translate(cx, cy);
  ctx.rotate(-0.92);
  ctx.translate(-(1 - q) * R * 0.9, 0);
  // shaft
  ctx.strokeStyle = T.parchmentDark;
  ctx.lineWidth = Math.max(1, R * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-R * 1.2, 0);
  ctx.lineTo(R * 1.5, 0);
  ctx.stroke();
  // vane
  ctx.beginPath();
  ctx.moveTo(-R * 0.3, 0);
  ctx.bezierCurveTo(R * 0.15, -R * 0.46, R * 0.95, -R * 0.42, R * 1.55, -R * 0.04);
  ctx.bezierCurveTo(R * 1.0, R * 0.3, R * 0.2, R * 0.3, -R * 0.3, 0);
  ctx.closePath();
  ctx.fillStyle = T.parchmentLight;
  ctx.fill();
  ctx.strokeStyle = T.ink;
  ctx.lineWidth = Math.max(0.6, R * 0.03);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-R * 0.3, 0);
  ctx.lineTo(R * 1.5, 0);
  for (const b of [0.2, 0.6, 1.0]) { ctx.moveTo(R * b, 0); ctx.lineTo(R * (b + 0.2), -R * 0.24); }
  ctx.stroke();
  // nib
  ctx.beginPath();
  ctx.moveTo(-R * 1.42, 0);
  ctx.lineTo(-R * 1.08, -R * 0.07);
  ctx.lineTo(-R * 1.08, R * 0.07);
  ctx.closePath();
  ctx.fillStyle = T.gilt;
  ctx.fill();
  ctx.restore();
}

// --- the ident -------------------------------------------------------------------------------

/** The opening card. `t` seconds since the window appeared; `standby` while the bulletin is written. */
export function drawIdent(ctx: Ctx, T: Tokens, t: number, standby: boolean, still: boolean): void {
  const g = ctx.createRadialGradient(W / 2, 84, 10, W / 2, 84, 230);
  g.addColorStop(0, T.surface2);
  g.addColorStop(1, T.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const time = still ? 9 : t;
  // a gilt double rule round the card
  ctx.strokeStyle = T.gilt;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
  ctx.globalAlpha = 0.3;
  ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
  ctx.globalAlpha = 1;

  drawMark(ctx, T, W / 2, 66, 30, time * 0.5, span(time, 0, 0.9));

  // title, revealed outward from the centre
  const reveal = easeOut(span(time, 0.45, 1.05));
  ctx.save();
  ctx.beginPath();
  ctx.rect(W / 2 - 170 * reveal, 108, 340 * reveal, 100);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = T.text;
  ctx.font = `700 25px ${T.display}`;
  spaced(ctx, 5);
  ctx.fillText('TERRA NOVA', W / 2 + 2.5, 136);
  ctx.restore();

  // rules either side of the plate
  const rule = easeOut(span(time, 0.7, 1.2));
  ctx.strokeStyle = T.gilt;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 42, 158.5); ctx.lineTo(W / 2 - 42 - 86 * rule, 158.5);
  ctx.moveTo(W / 2 + 42, 158.5); ctx.lineTo(W / 2 + 42 + 86 * rule, 158.5);
  ctx.stroke();

  // the NEWS plate
  const plate = easeOut(span(time, 0.85, 1.25));
  ctx.globalAlpha = plate;
  ctx.fillStyle = T.rubric;
  ctx.fillRect(W / 2 - 36, 148, 72, 21);
  ctx.fillStyle = T.parchmentLight;
  ctx.textAlign = 'center';
  ctx.font = `700 13px ${T.display}`;
  spaced(ctx, 5);
  ctx.fillText('NEWS', W / 2 + 2.5, 163.5);
  spaced(ctx, 0);

  // the line underneath
  ctx.globalAlpha = plate * (standby && !still ? 0.6 + 0.4 * Math.sin(t * 3) : 1);
  ctx.fillStyle = T.textMuted;
  ctx.font = `italic 13px ${T.serif}`;
  ctx.fillText(standby ? 'Preparing the bulletin' : 'The world, this evening', W / 2, 194);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// --- the studio set --------------------------------------------------------------------------

export interface StudioSet { back: HTMLCanvasElement; desk: HTMLCanvasElement }

const ANCHOR_X = 138;
const ANCHOR_Y = 121;      // the base of the neck
const ANCHOR_SCALE = 1.3;
const DESK_Y = 174;
const GLOBE = { x: 284, y: 82, r: 50 };

function layer(scale: number, paint: (ctx: Ctx) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext('2d');
  if (ctx) { ctx.scale(c.width / W, c.height / H); paint(ctx); }
  return c;
}

/** The parts of the studio that never move, painted once. */
export function paintSet(T: Tokens, scale: number): StudioSet {
  const back = layer(scale, (ctx) => {
    // the wall: night, warmed by a lamp behind the presenter
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, T.bg);
    wall.addColorStop(1, T.surface2);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    const lamp = ctx.createRadialGradient(ANCHOR_X, 84, 8, ANCHOR_X, 84, 170);
    lamp.addColorStop(0, T.gilt);
    lamp.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, W, H);
    // panelling
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 30.5; x < W; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, 140); }
    ctx.stroke();
    // a gilt rail, and the darker wall below it
    ctx.globalAlpha = 1;
    ctx.fillStyle = T.surface;
    ctx.fillRect(0, 140, W, H - 140);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = T.gilt;
    ctx.fillRect(0, 139, W, 1.5);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 144, W, 1);
    // the halo the globe hangs in
    ctx.globalAlpha = 0.3;
    const halo = ctx.createRadialGradient(GLOBE.x, GLOBE.y, GLOBE.r * 0.7, GLOBE.x, GLOBE.y, GLOBE.r * 1.7);
    halo.addColorStop(0, T.gilt);
    halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo;
    ctx.fillRect(GLOBE.x - 100, 0, 200, 190);
    ctx.globalAlpha = 1;
    // the corner bug
    drawMark(ctx, T, 21, 21, 8, 0.6, 1);
    ctx.fillStyle = T.gilt;
    ctx.font = `700 10px ${T.display}`;
    ctx.textBaseline = 'middle';
    spaced(ctx, 1.5);
    ctx.fillText('TN NEWS', 37, 21.5);
    spaced(ctx, 0);
  });

  const desk = layer(scale, (ctx) => {
    // desk top
    ctx.fillStyle = T.inkMuted;
    ctx.beginPath();
    ctx.moveTo(0, DESK_Y - 3); ctx.lineTo(W, DESK_Y - 3); ctx.lineTo(W, DESK_Y + 5); ctx.lineTo(0, DESK_Y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = T.parchmentDark;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, DESK_Y - 3, W, 1);
    ctx.globalAlpha = 1;
    // desk front
    ctx.fillStyle = T.ink;
    ctx.fillRect(0, DESK_Y + 5, W, H - DESK_Y - 5);
    ctx.fillStyle = T.gilt;
    ctx.fillRect(0, DESK_Y + 8, W, 1);
    // the name plate
    const px = W / 2 - 84;
    const py = DESK_Y + 15;
    const plate = ctx.createLinearGradient(0, py, 0, py + 22);
    plate.addColorStop(0, T.parchmentLight);
    plate.addColorStop(1, T.parchmentDark);
    ctx.fillStyle = plate;
    ctx.fillRect(px, py, 168, 22);
    ctx.strokeStyle = T.gilt;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, 167, 21);
    ctx.fillStyle = T.ink;
    ctx.font = `700 11px ${T.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    spaced(ctx, 2);
    ctx.fillText('TERRA NOVA NEWS', W / 2 + 1, py + 12);
    spaced(ctx, 0);
    ctx.fillStyle = T.rubric;
    for (const dx of [-76, 76]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + dx, py + 7.5); ctx.lineTo(W / 2 + dx + 3.5, py + 11); ctx.lineTo(W / 2 + dx, py + 14.5); ctx.lineTo(W / 2 + dx - 3.5, py + 11);
      ctx.closePath();
      ctx.fill();
    }
    // the script on the desk
    ctx.fillStyle = T.parchmentLight;
    ctx.beginPath();
    ctx.moveTo(ANCHOR_X - 27, DESK_Y - 5); ctx.lineTo(ANCHOR_X + 25, DESK_Y - 6); ctx.lineTo(ANCHOR_X + 31, DESK_Y + 3); ctx.lineTo(ANCHOR_X - 32, DESK_Y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T.inkMuted;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  return { back, desk };
}

// --- the anchor ------------------------------------------------------------------------------

export interface Pose {
  /** -1..1, the slow rise and fall of the chest. */
  breath: number;
  /** -1..1, the head turned left or right. */
  yaw: number;
  /** radians, the head tipped. */
  roll: number;
  /** 0..1, the head dipped (a nod, or a look down at the script). */
  pitch: number;
  /** 0 open .. 1 shut. */
  blink: number;
  /** 0..1, the eyes lowered to the papers. */
  glance: number;
  /** 0..1, brows lifted on a stressed word. */
  brow: number;
  open: number;
  wide: number;
}

export const REST: Pose = { breath: 0, yaw: 0, roll: 0, pitch: 0, blink: 0, glance: 0, brow: 0, open: 0, wide: 0 };

function headPath(ctx: Ctx, jaw: number): void {
  ctx.beginPath();
  ctx.moveTo(-24, -34);
  ctx.bezierCurveTo(-24, -68, 24, -68, 24, -34);
  ctx.bezierCurveTo(24, -12, 13, -1 + jaw, 0, -1 + jaw);
  ctx.bezierCurveTo(-13, -1 + jaw, -24, -12, -24, -34);
  ctx.closePath();
}

function hairPath(ctx: Ctx, style: number): void {
  ctx.beginPath();
  if (style === 0) {          // side parting
    ctx.moveTo(-25.5, -31);
    ctx.bezierCurveTo(-29, -71, 29, -73, 25.5, -31);
    ctx.bezierCurveTo(25, -43, 21, -50, 13, -53);
    ctx.bezierCurveTo(2, -50, -9, -49, -17, -54);
    ctx.bezierCurveTo(-21, -47, -24.5, -40, -25.5, -31);
  } else if (style === 1) {   // quiff
    ctx.moveTo(-25.5, -30);
    ctx.bezierCurveTo(-30, -64, -18, -76, 1, -73);
    ctx.bezierCurveTo(20, -79, 31, -60, 25.5, -30);
    ctx.bezierCurveTo(25, -42, 22, -48, 16, -51);
    ctx.bezierCurveTo(6, -57, -8, -57, -16, -50);
    ctx.bezierCurveTo(-21, -46, -24.5, -40, -25.5, -30);
  } else if (style === 2) {   // close crop
    ctx.moveTo(-25, -33);
    ctx.bezierCurveTo(-27, -68, 27, -68, 25, -33);
    ctx.bezierCurveTo(23.5, -45, 18, -53, 0, -53);
    ctx.bezierCurveTo(-18, -53, -23.5, -45, -25, -33);
  } else if (style === 3) {   // bob: a swept fringe, and a lock down each cheek
    ctx.moveTo(-26, -30);
    ctx.bezierCurveTo(-30, -73, 30, -75, 26, -30);
    ctx.bezierCurveTo(25.5, -40, 23, -47, 18, -52);
    ctx.bezierCurveTo(6, -47, -10, -45, -21, -37);
    ctx.bezierCurveTo(-20, -24, -20.5, -14, -22.5, -5);
    ctx.lineTo(-29, -8);
    ctx.bezierCurveTo(-28, -16, -27, -24, -26, -30);
    ctx.moveTo(26, -34);
    ctx.lineTo(21, -40);
    ctx.bezierCurveTo(20.5, -24, 21, -14, 22.5, -5);
    ctx.lineTo(29, -8);
    ctx.bezierCurveTo(28, -18, 27, -26, 26, -34);
  } else {                    // long: a centre parting, falling in front of the shoulders
    ctx.moveTo(-26, -30);
    ctx.bezierCurveTo(-30, -74, 30, -74, 26, -30);
    ctx.bezierCurveTo(24, -44, 14, -52, 0, -57);
    ctx.bezierCurveTo(-14, -52, -24, -44, -26, -30);
    for (const s of [-1, 1]) {
      ctx.moveTo(s * 26, -38);
      ctx.lineTo(s * 20, -42);
      ctx.bezierCurveTo(s * 18.5, -20, s * 19.5, -4, s * 17, 15);
      ctx.bezierCurveTo(s * 22, 20, s * 29, 18, s * 31, 13);
      ctx.bezierCurveTo(s * 32, -6, s * 30, -24, s * 26, -38);
    }
  }
  ctx.closePath();
}

/** The hair behind the head and neck (bob and long only). Drawn before the shoulders. */
function drawBackHair(ctx: Ctx, look: Look): void {
  if (look.style < 3) return;
  const end = look.style === 3 ? -6 : 22;
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.moveTo(-28.5, -36);
  ctx.bezierCurveTo(-32, -76, 32, -76, 28.5, -36);
  ctx.bezierCurveTo(30, -20, 31, end - 14, 29, end);
  ctx.lineTo(-29, end);
  ctx.bezierCurveTo(-31, end - 14, -30, -20, -28.5, -36);
  ctx.closePath();
  ctx.fill();
}

function drawMouth(ctx: Ctx, look: Look, T: Tokens, mx: number, my: number, open: number, wide: number): void {
  const hw = 6.8 + 2.2 * wide;
  ctx.lineCap = 'round';
  ctx.strokeStyle = look.skin.lip;
  if (open < 0.07) {
    ctx.lineWidth = look.woman ? 2.6 : 1.7;
    ctx.beginPath();
    ctx.moveTo(mx - hw, my - 0.3);
    ctx.quadraticCurveTo(mx, my + 2, mx + hw, my - 0.3);
    ctx.stroke();
    return;
  }
  const h = open * 5.4 * (1 - 0.2 * Math.max(0, wide));
  const low = my + h * 1.3 + 1.2;
  ctx.beginPath();
  ctx.moveTo(mx - hw, my);
  ctx.bezierCurveTo(mx - hw * 0.5, my - 1.7, mx + hw * 0.5, my - 1.7, mx + hw, my);
  ctx.bezierCurveTo(mx + hw * 0.7, low, mx - hw * 0.7, low, mx - hw, my);
  ctx.closePath();
  ctx.fillStyle = MOUTH_DARK;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (h > 1.4) {
    ctx.fillStyle = T.parchmentLight;
    ctx.fillRect(mx - hw, my - 2, hw * 2, 2.2 + Math.min(2.2, h * 0.3));
  }
  if (open > 0.55) {
    ctx.fillStyle = TONGUE;
    oval(ctx, mx, my + h + 1.9, hw * 0.6, h * 0.42);
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = look.woman ? 1.9 : 1.2;
  ctx.stroke();
}

function drawHead(ctx: Ctx, look: Look, T: Tokens, p: Pose): void {
  const fx = p.yaw * 4.5;
  const fy = p.pitch * 3;
  const jaw = p.open * 2;
  const hx = fx * 0.3;
  const dark = T.ink;

  // ears
  ctx.fillStyle = look.skin.shade;
  oval(ctx, -24.5 - fx * 0.3, -29 + fy * 0.4, 4, 7); ctx.fill();
  oval(ctx, 24.5 - fx * 0.3, -29 + fy * 0.4, 4, 7); ctx.fill();
  if (look.woman) {
    ctx.fillStyle = T.gilt;
    oval(ctx, -25 - fx * 0.3, -20.5 + fy * 0.4, 1.9, 1.9); ctx.fill();
    oval(ctx, 25 - fx * 0.3, -20.5 + fy * 0.4, 1.9, 1.9); ctx.fill();
  }

  // the face, flat, with one plane of shade on the far cheek
  headPath(ctx, jaw);
  ctx.fillStyle = look.skin.base;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = look.skin.shade;
  ctx.globalAlpha = 0.42;
  oval(ctx, 25 + fx * 0.6, -24, 10, 36); ctx.fill();
  ctx.globalAlpha = 1;
  if (look.beard) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(-26, -27);
    ctx.bezierCurveTo(-20, -9, -9, -5 + jaw, fx, -5 + jaw);
    ctx.bezierCurveTo(9, -5 + jaw, 20, -9, 26, -27);
    ctx.lineTo(26, 6); ctx.lineTo(-26, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // hair
  ctx.save();
  ctx.translate(hx, 0);
  hairPath(ctx, look.style);
  ctx.fillStyle = look.hair;
  ctx.fill();
  ctx.restore();

  // eyes
  const lid = (1 - p.blink) * (1 - 0.45 * p.glance);
  for (const s of [-1, 1]) {
    const ex = s * 9.6 + fx;
    const ey = -33 + fy;
    // brow
    const by = -41 + fy - p.brow * 2.4;
    ctx.strokeStyle = look.hair === HAIRS[2] ? '#8d877b' : look.hair;
    ctx.lineWidth = look.woman ? 1.7 : 2.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - s * 5, by + 0.2);
    ctx.quadraticCurveTo(ex, by - 1.8, ex + s * 5.6, by + 1.3);
    ctx.stroke();
    if (lid < 0.16) {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ex - 4.6, ey);
      ctx.quadraticCurveTo(ex, ey + 1.7, ex + 4.6, ey);
      ctx.stroke();
      continue;
    }
    oval(ctx, ex, ey, 4.7, 3.3 * lid);
    ctx.fillStyle = T.parchmentLight;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = dark;
    oval(ctx, ex - p.yaw * 0.9, ey + p.glance * 1.7, 2.5, 2.5); ctx.fill();
    ctx.fillStyle = T.parchmentLight;
    oval(ctx, ex - p.yaw * 0.9 + 0.9, ey + p.glance * 1.7 - 0.9, 0.7, 0.7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = dark;
    ctx.lineWidth = look.woman ? 1.8 : 1.2;
    ctx.beginPath();
    ctx.moveTo(ex - 4.9, ey - 0.2);
    ctx.quadraticCurveTo(ex, ey - 3.5 * lid - 1.6, ex + 4.9, ey - 0.2);
    if (look.woman) ctx.lineTo(ex + s * 6.6, ey - 1.8);   // a lash flick at the outer corner
    ctx.stroke();
  }

  if (look.glasses) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.3;
    const gy = -33 + fy;
    oval(ctx, -9.6 + fx, gy, 6.8, 6.2); ctx.stroke();
    oval(ctx, 9.6 + fx, gy, 6.8, 6.2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2.8 + fx, gy - 1); ctx.quadraticCurveTo(fx, gy - 2.6, 2.8 + fx, gy - 1);
    ctx.moveTo(-16.4 + fx, gy - 1); ctx.lineTo(-24 - fx * 0.3, gy - 2.5);
    ctx.moveTo(16.4 + fx, gy - 1); ctx.lineTo(24 - fx * 0.3, gy - 2.5);
    ctx.stroke();
  }

  // nose
  const nx = fx * 1.25;
  ctx.strokeStyle = look.skin.shade;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(nx + 0.5, -30 + fy);
  ctx.lineTo(nx + 3 + fx * 0.2, -21 + fy);
  ctx.quadraticCurveTo(nx + 0.5, -19.2 + fy, nx - 1.8, -20.4 + fy);
  ctx.stroke();

  // mouth (and the moustache over it)
  const mx = fx * 1.1;
  const my = -11.5 + fy + jaw * 0.3;
  drawMouth(ctx, look, T, mx, my, p.open, p.wide);
  if (look.beard) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(mx - 9, my - 2.2);
    ctx.quadraticCurveTo(mx, my - 7, mx + 9, my - 2.2);
    ctx.quadraticCurveTo(mx, my - 3.8, mx - 9, my - 2.2);
    ctx.closePath();
    ctx.fill();
  }
}

function tieColour(look: Look, T: Tokens): string {
  return look.tie === 0 ? T.rubric : look.tie === 1 ? T.gilt : look.tie === 2 ? T.teal : T.ok;
}

/** The presenter from the desk up. */
function drawAnchor(ctx: Ctx, look: Look, T: Tokens, p: Pose): void {
  ctx.save();
  ctx.translate(ANCHOR_X, ANCHOR_Y);
  ctx.scale(ANCHOR_SCALE, ANCHOR_SCALE);
  const lift = p.breath * 0.9;
  const headTo = () => { ctx.translate(p.yaw * 2, -15 - lift + p.pitch * 2.4); ctx.rotate(p.roll); };

  ctx.save();
  headTo();
  drawBackHair(ctx, look);
  ctx.restore();

  // shoulders and chest, breathing from the desk up
  ctx.save();
  ctx.translate(0, 62);
  ctx.scale(look.woman ? 0.88 : 1, 1 + p.breath * 0.014);
  ctx.translate(0, -62);
  ctx.fillStyle = look.suit.base;
  ctx.beginPath();
  ctx.moveTo(-64, 64);
  ctx.lineTo(-60, 22);
  ctx.quadraticCurveTo(-56, 8, -35, 4);
  ctx.lineTo(-13, -3); ctx.lineTo(13, -3); ctx.lineTo(35, 4);
  ctx.quadraticCurveTo(56, 8, 60, 22);
  ctx.lineTo(64, 64);
  ctx.closePath();
  ctx.fill();
  // the far side of the jacket, a shade darker
  ctx.save();
  ctx.clip();
  ctx.fillStyle = look.suit.dark;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(30, -6, 40, 72);
  ctx.restore();
  // shirt
  ctx.fillStyle = T.parchmentLight;
  ctx.beginPath();
  ctx.moveTo(-15, -3); ctx.lineTo(0, 42); ctx.lineTo(15, -3);
  ctx.closePath();
  ctx.fill();
  // neck
  ctx.fillStyle = look.skin.shade;
  ctx.beginPath();
  ctx.moveTo(-9.5, -20); ctx.lineTo(9.5, -20); ctx.lineTo(9.5, 0); ctx.lineTo(0, 8); ctx.lineTo(-9.5, 0);
  ctx.closePath();
  ctx.fill();
  // tie, kept inside the shirt
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-15, -3); ctx.lineTo(0, 42); ctx.lineTo(15, -3);
  ctx.closePath();
  ctx.clip();
  if (look.tie >= 0) {
    ctx.fillStyle = tieColour(look, T);
    ctx.beginPath();
    ctx.moveTo(-4, 6); ctx.lineTo(4, 6); ctx.lineTo(3, 13); ctx.lineTo(6, 36); ctx.lineTo(0, 44); ctx.lineTo(-6, 36); ctx.lineTo(-3, 13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T.ink;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-3, 13); ctx.lineTo(3, 13);
    ctx.stroke();
  } else {
    // open collar: the throat, and a fine gilt chain
    ctx.fillStyle = look.skin.base;
    ctx.beginPath();
    ctx.moveTo(-9.5, -3); ctx.lineTo(0, 17); ctx.lineTo(9.5, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T.gilt;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -1); ctx.quadraticCurveTo(0, 13, 8, -1);
    ctx.stroke();
    ctx.fillStyle = T.gilt;
    oval(ctx, 0, 6.6, 1.6, 1.6); ctx.fill();
  }
  ctx.restore();
  // collar
  ctx.fillStyle = T.parchmentLight;
  ctx.strokeStyle = T.parchmentDark;
  ctx.lineWidth = 0.8;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 11, -6); ctx.lineTo(s * 1.5, 7); ctx.lineTo(s * 13.5, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // lapels
  ctx.fillStyle = look.suit.dark;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 14, -3.5); ctx.lineTo(s * 25, 5); ctx.lineTo(s * 20, 13); ctx.lineTo(s * 24, 16); ctx.lineTo(0, 43); ctx.lineTo(s * 1.2, 39);
    ctx.closePath();
    ctx.fill();
  }
  // a pocket square, or a gilt lapel pin
  if (look.woman) {
    ctx.fillStyle = T.gilt;
    oval(ctx, -31, 24, 2.3, 2.3); ctx.fill();
  } else {
    ctx.fillStyle = T.parchmentLight;
    ctx.beginPath();
    ctx.moveTo(-44, 32); ctx.lineTo(-33, 30.5); ctx.lineTo(-33, 34); ctx.lineTo(-44, 35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // head: pivots on the neck
  headTo();
  drawHead(ctx, look, T, p);
  ctx.restore();
}

/** Hands folded on the script, in front of the desk edge. */
function drawHands(ctx: Ctx, look: Look, T: Tokens): void {
  const y = DESK_Y - 5;
  ctx.fillStyle = look.suit.dark;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(ANCHOR_X + s * 44, DESK_Y + 2); ctx.lineTo(ANCHOR_X + s * 40, DESK_Y - 9); ctx.lineTo(ANCHOR_X + s * 17, y - 5.5); ctx.lineTo(ANCHOR_X + s * 15, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = T.parchmentLight;
  for (const s of [-1, 1]) ctx.fillRect(ANCHOR_X + s * 15.5 - 2, y - 5, 4, 8.6);
  ctx.fillStyle = look.skin.base;
  ctx.strokeStyle = look.skin.shade;
  ctx.lineWidth = 0.9;
  oval(ctx, ANCHOR_X + 6, y, 9.5, 5.2); ctx.fill(); ctx.stroke();
  oval(ctx, ANCHOR_X - 6, y - 0.4, 9.5, 5.2); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  for (const dx of [-9, -5, -1]) { ctx.moveTo(ANCHOR_X + dx, y - 3.6); ctx.lineTo(ANCHOR_X + dx + 1.5, y + 1); }
  ctx.stroke();
}

/** The whole studio shot: wall, turning globe, presenter, desk, hands. */
export function drawStudio(ctx: Ctx, T: Tokens, set: StudioSet, look: Look, pose: Pose, t: number): void {
  ctx.drawImage(set.back, 0, 0, W, H);
  drawGlobe(ctx, GLOBE.x, GLOBE.y, GLOBE.r, t * 0.16, { sea: T.surface, land: T.gilt, line: T.gilt, rim: T.gilt, lineAlpha: 0.3, landAlpha: 0.62 });
  drawAnchor(ctx, look, T, pose);
  ctx.drawImage(set.desk, 0, 0, W, H);
  drawHands(ctx, look, T);
}

// --- field footage ---------------------------------------------------------------------------

/** The globe capture the bulletin was written from, as a "live" cutaway. `t` seconds into the cut. */
export function drawFootage(ctx: Ctx, T: Tokens, shot: CanvasImageSource, t: number, caption: string, still: boolean): void {
  const zoom = still ? 1.04 : 1.03 + t * 0.012;
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(shot, (W - W * zoom) / 2, (H - H * zoom) / 2, W * zoom, H * zoom);
  const shade = ctx.createLinearGradient(0, H - 70, 0, H);
  shade.addColorStop(0, 'transparent');
  shade.addColorStop(1, T.bg);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = shade;
  ctx.fillRect(0, H - 70, W, 70);
  ctx.globalAlpha = 1;

  // the LIVE bug
  ctx.fillStyle = T.danger;
  ctx.fillRect(12, 12, 52, 19);
  ctx.fillStyle = T.parchmentLight;
  ctx.globalAlpha = still ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(t * 2.6));
  oval(ctx, 22, 21.5, 3, 3); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `700 11px ${T.display}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  spaced(ctx, 2);
  ctx.fillText('LIVE', 30, 22);
  // where we are
  ctx.fillStyle = T.text;
  ctx.font = `600 11px ${T.display}`;
  spaced(ctx, 1.5);
  ctx.fillText(caption, 13, H - 17);
  spaced(ctx, 0);
  ctx.fillStyle = T.gilt;
  ctx.fillRect(13, H - 28, 34, 1.5);
}
