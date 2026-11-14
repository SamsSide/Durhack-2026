// Canvas drawings for the war layer: era unit icons, army counters, clash and scroll badges,
// loss numbers, smoke puffs and spark dots. Lane b (B5).
import * as THREE from 'three';

export type IconKind = 'spear' | 'sword' | 'musket' | 'tank' | 'drone' | 'buggy' | 'ship' | 'wagon';

export function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function poly(ctx: CanvasRenderingContext2D, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.closePath();
  ctx.fill();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stroke = false): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (stroke) ctx.stroke(); else ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Draw one unit icon in a size x size box centred on (cx, cy). Drawn on a -16..16 grid. */
export function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, cx: number, cy: number, size: number, fg: string, bg: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 32, size / 32);
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'spear':
      ctx.lineWidth = 2.6;
      line(ctx, -12, 14, 8, -9);
      poly(ctx, [13, -15, 4, -11, 9, -6]);
      circle(ctx, -4, 4, 8.5);
      ctx.strokeStyle = bg; ctx.lineWidth = 1.6;
      circle(ctx, -4, 4, 5, true);
      ctx.fillStyle = bg; circle(ctx, -4, 4, 1.6);
      break;
    case 'sword':
      poly(ctx, [2, -15, 6, -11, 6, 6, 2, 6]);
      ctx.fillRect(-2, 6, 12, 3);
      ctx.fillRect(2.6, 9, 2.8, 5);
      circle(ctx, 4, 15, 2.2);
      ctx.lineWidth = 2;
      line(ctx, -11, -15, -11, 15);
      poly(ctx, [-11, -15, -1, -11, -11, -6]);
      break;
    case 'musket':
      ctx.rotate(-0.5);
      ctx.fillRect(-12, -1.6, 26, 3.2);
      poly(ctx, [-16, -1.6, -7, -1.6, -7, 3, -16, 7]);
      ctx.fillRect(-4, 1.6, 4, 3);
      ctx.lineWidth = 1.6;
      line(ctx, 14, 0, 19, 0);
      break;
    case 'tank':
      ctx.beginPath();
      ctx.roundRect(-15, 4, 30, 9, 4.5);
      ctx.fill();
      ctx.fillRect(-13, -1, 26, 5);
      ctx.fillRect(-7, -7, 12, 6);
      ctx.fillRect(4, -5.5, 12, 2.6);
      ctx.fillStyle = bg;
      for (const x of [-10, -4, 2, 8]) circle(ctx, x, 8.5, 2);
      break;
    case 'drone':
      ctx.lineWidth = 3;
      line(ctx, -10, -10, 10, 10);
      line(ctx, -10, 10, 10, -10);
      ctx.lineWidth = 2;
      for (const [x, y] of [[-10, -10], [10, -10], [-10, 10], [10, 10]] as const) circle(ctx, x, y, 5, true);
      circle(ctx, 0, 0, 4.5);
      ctx.fillStyle = bg; circle(ctx, 0, 0, 1.6);
      break;
    case 'buggy':
      poly(ctx, [-15, 3, -11, -4, 7, -4, 13, 3]);
      ctx.lineWidth = 2.4;
      line(ctx, -2, -4, -2, -10);
      line(ctx, -2, -10, 13, -13);
      circle(ctx, -8, 7, 5.5);
      circle(ctx, 8, 7, 5.5);
      ctx.fillStyle = bg;
      circle(ctx, -8, 7, 2);
      circle(ctx, 8, 7, 2);
      break;
    case 'ship':
      poly(ctx, [-16, 4, 16, 4, 10, 12, -10, 12]);
      ctx.lineWidth = 2;
      line(ctx, 0, 4, 0, -15);
      poly(ctx, [1.5, -14, 12, 1, 1.5, 1]);
      poly(ctx, [-1.5, -10, -10, 1, -1.5, 1]);
      break;
    case 'wagon':
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 10, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-13, 0, 26, 5);
      ctx.lineWidth = 2.4;
      circle(ctx, -7, 9, 4, true);
      circle(ctx, 7, 9, 4, true);
      break;
  }
  ctx.restore();
}

export interface CounterLook {
  color: string;               // the owner's colour: the border
  flag: HTMLImageElement | null;
  icon: IconKind;
  strength: number;
  count: number;               // units merged into this counter
  night: string;
  ink: string;
  parchment: string;
  accent: string;
}

/** Canvas size of an army counter. The body sits below a strip kept free for the "x2" tab. */
export const COUNTER_W = 216;
export const COUNTER_H = 88;
const BODY_TOP = 16;

/** An HOI-style counter chip: flag, era icon, strength in bold mono, owner-colour border. */
export function drawCounter(look: CounterLook): HTMLCanvasElement {
  const [c, ctx] = canvas2d(COUNTER_W, COUNTER_H);
  const x0 = 4, y0 = BODY_TOP, w = COUNTER_W - 8, h = COUNTER_H - BODY_TOP - 4;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = look.night;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 8);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = look.color;
  ctx.beginPath();
  ctx.roundRect(x0 + 2.5, y0 + 2.5, w - 5, h - 5, 6);
  ctx.stroke();

  // flag
  const fx = x0 + 10, fy = y0 + 13, fw = 63, fh = 42;
  if (look.flag) ctx.drawImage(look.flag, fx, fy, fw, fh);
  else { ctx.fillStyle = look.color; ctx.fillRect(fx, fy, fw, fh); }
  ctx.lineWidth = 2;
  ctx.strokeStyle = look.ink;
  ctx.strokeRect(fx, fy, fw, fh);

  // era icon
  drawIcon(ctx, look.icon, fx + fw + 22, y0 + h / 2, 36, look.parchment, look.night);

  // strength
  ctx.fillStyle = look.parchment;
  ctx.font = 'bold 40px "IBM Plex Mono", ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.round(look.strength)), x0 + w - 12, y0 + h / 2 + 2);

  if (look.count > 1) {
    const label = `x${look.count}`;
    ctx.font = 'bold 22px "IBM Plex Mono", ui-monospace, Menlo, monospace';
    const tw = ctx.measureText(label).width + 14;
    const bx = x0 + w - tw - 6;
    ctx.fillStyle = look.accent;
    ctx.beginPath();
    ctx.roundRect(bx, 2, tw, 24, 5);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = look.ink;
    ctx.stroke();
    ctx.fillStyle = look.ink;
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + tw / 2, 15);
  }
  return c;
}

/** A settler: a small owner-colour dot ringed in ink with a wagon in it. */
export function drawSettler(color: string, ink: string, parchment: string): HTMLCanvasElement {
  const [c, ctx] = canvas2d(72, 72);
  ctx.fillStyle = ink;
  circle(ctx, 36, 36, 32);
  ctx.fillStyle = color;
  circle(ctx, 36, 36, 27);
  drawIcon(ctx, 'wagon', 36, 36, 36, parchment, ink);
  return c;
}

function bladeAt(ctx: CanvasRenderingContext2D, angle: number, blade: string, hilt: string, ink: string): void {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = ink;
  const shapes: Array<[number[], string]> = [
    [[-6, -50, 0, -58, 6, -50, 6, 22, -6, 22], blade],
    [[-20, 22, 20, 22, 20, 30, -20, 30], hilt],
    [[-4, 30, 4, 30, 4, 46, -4, 46], hilt],
  ];
  for (const [pts, fill] of shapes) {
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.restore();
}

/** Crossed swords on a war-red disc: the clash marker on a battle tile. */
export function drawClash(war: string, parchment: string, accent: string, ink: string): HTMLCanvasElement {
  const [c, ctx] = canvas2d(128, 128);
  ctx.fillStyle = ink;
  circle(ctx, 64, 64, 60);
  ctx.fillStyle = war;
  circle(ctx, 64, 64, 54);
  bladeAt(ctx, Math.PI / 4, parchment, accent, ink);
  bladeAt(ctx, -Math.PI / 4, parchment, accent, ink);
  return c;
}

/** A rolled treaty scroll, shown over provinces ceded at a peace. */
export function drawScroll(parchment: string, dark: string, ink: string, rubric: string): HTMLCanvasElement {
  const [c, ctx] = canvas2d(128, 128);
  ctx.lineWidth = 5;
  ctx.strokeStyle = ink;
  ctx.fillStyle = parchment;
  ctx.beginPath();
  ctx.rect(26, 28, 76, 72);
  ctx.fill();
  ctx.stroke();
  for (const y of [28, 100]) {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(16, y - 10, 96, 20, 10);
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = ink;
  for (const y of [50, 62, 74]) line(ctx, 38, y, 90, y);
  ctx.fillStyle = rubric;
  circle(ctx, 84, 86, 9);
  return c;
}

/** "-12" in war red with an ink outline: a battle loss that floats up and fades. */
export function drawLoss(text: string, war: string, ink: string): HTMLCanvasElement {
  const [c, ctx] = canvas2d(160, 72);
  ctx.font = 'bold 50px "IBM Plex Mono", ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = ink;
  ctx.strokeText(text, 80, 38);
  ctx.fillStyle = war;
  ctx.fillText(text, 80, 38);
  return c;
}

/** A soft white smoke puff (tinted by the material colour). */
export function drawPuff(): HTMLCanvasElement {
  const [c, ctx] = canvas2d(128, 128);
  const blobs: Array<[number, number, number]> = [[64, 70, 44], [42, 58, 30], [86, 56, 32], [60, 42, 30], [80, 82, 28], [46, 84, 26]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    circle(ctx, x, y, r);
  }
  return c;
}

/** A round glowing dot for sparks and muzzle flashes. */
export function drawDot(): HTMLCanvasElement {
  const [c, ctx] = canvas2d(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  circle(ctx, 32, 32, 32);
  return c;
}
