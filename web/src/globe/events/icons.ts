// Icon discs for each beacon kind, drawn once on a canvas and cached as data URLs. Lane b.
import { KIND_META } from './kinds';
import type { BeaconKind } from './kinds';

const SIZE = 96; // drawn at 2x for sharp edges; shown at 22 to 44 px
const INK = '#f6eedb';
const cache = new Map<BeaconKind, string>();

type Ctx = CanvasRenderingContext2D;

function crown(g: Ctx, y = 0): void {
  g.beginPath();
  g.moveTo(-20, 12 + y); g.lineTo(-22, -10 + y); g.lineTo(-10, 0 + y); g.lineTo(0, -16 + y);
  g.lineTo(10, 0 + y); g.lineTo(22, -10 + y); g.lineTo(20, 12 + y); g.closePath();
  g.fill();
}

const GLYPHS: Record<BeaconKind, (g: Ctx, bg: string) => void> = {
  city: (g) => {
    const tower = (x: number, w: number, h: number) => {
      g.fillRect(x, 18 - h, w, h);
      for (let i = 0; i < 3; i++) g.fillRect(x + (i * w) / 2.5 - 0.5, 18 - h - 4, w / 5 + 1, 4);
    };
    tower(-22, 12, 22); tower(-7, 14, 32); tower(10, 12, 18);
  },
  capital: (g) => { crown(g, 2); },
  war: (g) => {
    g.lineCap = 'round';
    for (const s of [1, -1]) {
      g.save(); g.scale(s, 1); g.rotate(Math.PI / 4);
      g.fillRect(-3, -26, 6, 36);           // blade
      g.fillRect(-10, 10, 20, 5);           // guard
      g.fillRect(-2.5, 15, 5, 9);           // grip
      g.restore();
    }
  },
  treaty: (g, bg) => {
    g.fillRect(-18, -20, 36, 38);           // the parchment
    g.fillStyle = bg;
    for (let i = 0; i < 4; i++) g.fillRect(-12, -13 + i * 7, i === 3 ? 14 : 24, 2.5);
    g.fillStyle = '#b8352f';
    g.beginPath(); g.arc(10, 14, 8, 0, Math.PI * 2); g.fill(); // the seal
  },
  fall: (g, bg) => {
    crown(g, 2);
    g.strokeStyle = bg; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-6, -18); g.lineTo(3, -2); g.lineTo(-4, 4); g.lineTo(6, 18); g.stroke();
  },
  secession: (g, bg) => {
    g.fillRect(-20, -24, 4, 48);            // the pole
    g.beginPath(); g.moveTo(-16, -22); g.lineTo(22, -22); g.lineTo(14, -10); g.lineTo(22, 2); g.lineTo(-16, 2); g.closePath(); g.fill();
    g.strokeStyle = bg; g.lineWidth = 4;
    g.beginPath(); g.moveTo(4, -24); g.lineTo(0, -14); g.lineTo(6, -6); g.lineTo(2, 4); g.stroke();
  },
  decree: (g, bg) => {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? 20 : 24;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.fillStyle = bg;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 5 : 12;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  },
  wonder: (g, bg) => {
    g.beginPath(); g.moveTo(0, -22); g.lineTo(26, 20); g.lineTo(-26, 20); g.closePath(); g.fill();
    g.fillStyle = bg;
    for (let i = 1; i < 4; i++) g.fillRect(-26, -22 + i * 10.5, 52, 2);
  },
  death: (g, bg) => {
    g.beginPath(); g.arc(0, -4, 18, 0, Math.PI * 2); g.fill();
    g.fillRect(-10, 8, 20, 12);
    g.fillStyle = bg;
    g.beginPath(); g.arc(-7, -4, 5, 0, Math.PI * 2); g.arc(7, -4, 5, 0, Math.PI * 2); g.fill();
    for (let i = -1; i <= 1; i++) g.fillRect(i * 6 - 1, 12, 2, 8);
  },
  succession: (g) => {
    crown(g, -6);
    g.beginPath(); g.moveTo(0, 26); g.lineTo(-9, 15); g.lineTo(9, 15); g.closePath(); g.fill();
    g.fillRect(-14, 9, 28, 3);
  },
};

export function iconUrl(kind: BeaconKind): string {
  const hit = cache.get(kind);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas');
  cv.width = SIZE; cv.height = SIZE;
  const g = cv.getContext('2d');
  if (!g) return '';
  const bg = KIND_META[kind].color;
  const c = SIZE / 2;
  // rim, disc, inner ring
  g.fillStyle = '#1a1410';
  g.beginPath(); g.arc(c, c, c - 1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9a24b';
  g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fill();
  const grad = g.createRadialGradient(c - 10, c - 12, 4, c, c, c - 8);
  grad.addColorStop(0, shade(bg, 0.25));
  grad.addColorStop(1, shade(bg, -0.2));
  g.fillStyle = grad;
  g.beginPath(); g.arc(c, c, c - 8, 0, Math.PI * 2); g.fill();
  g.save();
  g.translate(c, c);
  g.scale(1.15, 1.15);
  g.fillStyle = INK;
  GLYPHS[kind](g, shade(bg, -0.05));
  g.restore();
  const url = cv.toDataURL('image/png');
  cache.set(kind, url);
  return url;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const r = ch((n >> 16) & 255), gr = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r}, ${gr}, ${b})`;
}
