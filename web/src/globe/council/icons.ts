// Council icons drawn once on canvas and cached as data URLs. Colours come from the palette.
import { getPalette } from '../palette';
import type { CouncilRole, CouncilState } from './types';

const cache = new Map<string, string>();
const S = 48;

function make(key: string, draw: (g: CanvasRenderingContext2D) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  if (!g) return '';
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

function crownPath(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(10, 34); g.lineTo(7, 14); g.lineTo(17, 24); g.lineTo(24, 10); g.lineTo(31, 24); g.lineTo(41, 14); g.lineTo(38, 34); g.closePath();
}
function swordPath(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(24, 6); g.lineTo(28, 12); g.lineTo(28, 30); g.lineTo(20, 30); g.lineTo(20, 12); g.closePath();
  g.moveTo(13, 31); g.lineTo(35, 31); g.lineTo(35, 35); g.lineTo(13, 35); g.closePath();
  g.moveTo(22, 35); g.lineTo(26, 35); g.lineTo(26, 43); g.lineTo(22, 43); g.closePath();
}

/** Pip icon for a role in a state: lit, half-dim with arrow, crossed, or cut (cyan broken-link ring). */
export function pipIcon(role: CouncilRole, state: CouncilState): string {
  return make(`pip:${role}:${state}`, (g) => {
    const p = getPalette();
    g.fillStyle = p.night; g.globalAlpha = 0.82;
    g.beginPath(); g.arc(24, 24, 22, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.save();
    g.translate(0, role === 'ruler' ? 3 : 0);
    g.scale(0.82, 0.82); g.translate(5, 5);
    const dim = state === 'covering' || state === 'vacant' || state === 'cut';
    g.globalAlpha = state === 'vacant' ? 0.4 : dim ? 0.6 : 1;
    g.fillStyle = state === 'covering' ? p.accent : p.accent;
    g.strokeStyle = p.ink; g.lineWidth = 2;
    if (role === 'ruler') crownPath(g); else swordPath(g);
    g.fill(); g.stroke();
    g.restore();
    g.globalAlpha = 1;
    if (state === 'covering') { // half dim: shade the left half, add an arrow
      g.save(); g.fillStyle = p.night; g.globalAlpha = 0.55; g.fillRect(0, 0, 24, S); g.restore();
      g.strokeStyle = p.parchment; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(8, 40); g.lineTo(40, 40); g.moveTo(33, 34); g.lineTo(40, 40); g.lineTo(33, 46); g.stroke();
    }
    if (state === 'vacant') {
      g.strokeStyle = '#b3261e'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(9, 9); g.lineTo(39, 39); g.moveTo(39, 9); g.lineTo(9, 39); g.stroke();
    }
    if (state === 'cut') { // broken ring, gap at the top right
      g.strokeStyle = p.holo; g.lineWidth = 4;
      g.beginPath(); g.arc(24, 24, 21, -1.2, 4.4); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(35, 5); g.lineTo(31, 11); g.moveTo(41, 11); g.lineTo(36, 15); g.stroke();
    } else {
      g.strokeStyle = p.accent; g.lineWidth = 2; g.globalAlpha = 0.8;
      g.beginPath(); g.arc(24, 24, 22, 0, Math.PI * 2); g.stroke();
    }
  });
}

/** Black mourning pennant with a thin gilt edge. */
export function bannerIcon(): string {
  return make('banner', (g) => {
    const p = getPalette();
    g.fillStyle = p.accent; g.fillRect(6, 2, 36, 3);
    g.fillStyle = '#0c0c10'; g.strokeStyle = p.accent; g.lineWidth = 2;
    g.beginPath(); g.moveTo(9, 5); g.lineTo(39, 5); g.lineTo(39, 38); g.lineTo(24, 46); g.lineTo(9, 38); g.closePath();
    g.fill(); g.stroke();
    g.strokeStyle = '#4a4a55'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(24, 12); g.lineTo(24, 30); g.moveTo(17, 19); g.lineTo(31, 19); g.stroke();
  });
}

/** Gilt seal with a crown, stamped on succession. */
export function sealIcon(): string {
  return make('seal', (g) => {
    const p = getPalette();
    g.fillStyle = p.accent; g.strokeStyle = p.ink; g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, r = i % 2 ? 20 : 23;
      g.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
    }
    g.closePath(); g.fill(); g.stroke();
    g.save(); g.translate(5.5, 6); g.scale(0.77, 0.77);
    g.fillStyle = p.ink; crownPath(g); g.fill();
    g.restore();
  });
}

/** Cracked crown for a coup. */
export function crackedCrownIcon(): string {
  return make('cracked', (g) => {
    const p = getPalette();
    g.fillStyle = '#b3261e'; g.strokeStyle = p.ink; g.lineWidth = 2.5;
    crownPath(g); g.fill(); g.stroke();
    g.strokeStyle = p.parchment; g.lineWidth = 3;
    g.beginPath(); g.moveTo(26, 12); g.lineTo(21, 22); g.lineTo(28, 27); g.lineTo(22, 36); g.stroke();
  });
}
