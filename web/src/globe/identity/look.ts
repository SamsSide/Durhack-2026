// What a nation's identity does to colour, height and density (docs/research/nation-identity.md 3.1, 3.2, 3.5).
// Palettes are the doc's design values; the gold and the grade neutrals reuse the accent token when it exists.
import * as THREE from 'three';
import { getPalette } from '../palette';
import type { Era, Gov, Identity, Mood } from './identity';

/** Stable pseudo-random number in [0, 1) from a number, for the small per-nation variation. */
export function hash01(seed: number, salt = 0): number {
  let h = 2166136261 ^ salt;
  h ^= seed; h = Math.imul(h, 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---- 3.1 wall and roof tint, banner colour ---------------------------------------------------

const GOV_TINT: Record<Gov, { color: string; strength: number }> = {
  communist: { color: '#9a9a94', strength: 0.55 },
  junta: { color: '#7a7a5c', strength: 0.5 },
  theocracy: { color: '#f2e6c8', strength: 0.4 },
  democracy: { color: '#f0f0ec', strength: 0.45 },
  merchant: { color: '#c98a5a', strength: 0.4 },
  monarchy: { color: '#e3d2a8', strength: 0.3 },
  tribal: { color: '#9c7a55', strength: 0.45 },
  technocracy: { color: '#bfd8e6', strength: 0.45 },
};
const RUST = '#b08a6a';
const BRONZE_WASH = '#e6cfa0';
const RED = '#c0262d';
const GOLD_FALLBACK = '#d4a93a';
const WHITE = new THREE.Color('#ffffff');

function gold(): THREE.Color { return new THREE.Color(GOLD_FALLBACK); }

/** Multiplier for the wall and roof parts of one nation: government colour plus a small per-nation shade. */
export function wallTint(id: Identity, owner: number): THREE.Color {
  const g = GOV_TINT[id.gov];
  const c = WHITE.clone().lerp(new THREE.Color(g.color), g.strength);
  if (id.era === 'post_apoc') c.multiply(WHITE.clone().lerp(new THREE.Color(RUST), 0.3));
  else if (id.era === 'bronze') c.multiply(WHITE.clone().lerp(new THREE.Color(BRONZE_WASH), 0.2));
  c.multiplyScalar(0.95 + 0.1 * hash01(owner, 32));
  return c;
}

/** The nation colour as shown on banners and team parts, shifted by government. */
export function bannerColor(css: string, id: Identity): THREE.Color {
  const c = new THREE.Color(css);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  switch (id.gov) {
    case 'communist': {
      const d = Math.min(Math.abs(hsl.h * 360 - 0), Math.abs(hsl.h * 360 - 360));
      if (d < 30 && hsl.s > 0.2) c.set(RED);
      break;
    }
    case 'junta': c.setHSL(hsl.h, hsl.s, hsl.l * 0.75); break;
    case 'theocracy': c.lerp(gold(), 0.35); break;
    case 'monarchy': c.lerp(gold(), 0.2); break;
    case 'tribal': c.setHSL(hsl.h, hsl.s * 0.8, hsl.l); break;
    case 'technocracy': c.setHSL(hsl.h, hsl.s, Math.min(0.9, hsl.l + 0.15)); break;
    default: break;
  }
  return c;
}

// ---- 3.2 height and density by era -----------------------------------------------------------

export interface EraLook {
  hy: number;            // height stretch multiplier
  citySats: number;      // buildings around a city
  capitalSats: number;   // buildings around a capital
  lean: number;          // degrees of random lean (post-apocalypse)
}
const ERA_LOOK: Record<Era, EraLook> = {
  bronze: { hy: 0.75, citySats: 1, capitalSats: 2, lean: 0 },
  classical: { hy: 0.85, citySats: 2, capitalSats: 3, lean: 0 },
  medieval: { hy: 1.0, citySats: 2, capitalSats: 4, lean: 0 },
  gunpowder: { hy: 1.0, citySats: 3, capitalSats: 4, lean: 0 },
  industrial: { hy: 1.15, citySats: 4, capitalSats: 6, lean: 0 },
  modern: { hy: 1.35, citySats: 5, capitalSats: 7, lean: 0 },
  future: { hy: 1.6, citySats: 5, capitalSats: 7, lean: 0 },
  post_apoc: { hy: 0.9, citySats: 3, capitalSats: 4, lean: 12 },
};
export function eraLook(era: Era): EraLook { return ERA_LOOK[era]; }

// ---- 3.5 colour grade of the selected nation -------------------------------------------------

export interface Grade { exposure: number; saturation: number; tint: THREE.Color }
const GRADE: Record<Gov, [number, number, string]> = {
  communist: [0.95, 0.7, '#e8e4dc'],
  junta: [0.9, 0.6, '#dcd8c4'],
  theocracy: [1.08, 1.0, '#fff1d0'],
  democracy: [1.05, 1.05, '#f4f8ff'],
  merchant: [1.0, 1.15, '#ffefd8'],
  monarchy: [1.0, 1.1, '#fff0dc'],
  tribal: [0.98, 0.9, '#f2e2c8'],
  technocracy: [1.02, 0.85, '#ddeeff'],
};
const MOOD_WARM: Record<Mood, string> = { martial: '#ffe6dc', pious: '#fff4d8', wealthy: '#fff0d2', pioneer: '#f0ffe4' };
const SEPIA = '#d9c2a0';

/** Grade for the land of a selected nation: its government's grade plus a mild mood warmth. */
export function gradeOf(id: Identity): Grade {
  const [exposure, saturation, tint] = GRADE[id.gov];
  const c = new THREE.Color(tint).multiply(WHITE.clone().lerp(new THREE.Color(MOOD_WARM[id.mood]), 0.5));
  if (id.era === 'post_apoc') c.multiply(new THREE.Color(SEPIA));
  return { exposure, saturation, tint: c };
}

/** How far the land of every other nation is desaturated while one is selected. */
export const OTHERS_SATURATION = 0.8;

export function applyGrade(c: THREE.Color, exposure: number, saturation: number, tint?: THREE.Color): THREE.Color {
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  c.r = l + (c.r - l) * saturation; c.g = l + (c.g - l) * saturation; c.b = l + (c.b - l) * saturation;
  if (tint) c.multiply(tint);
  c.multiplyScalar(exposure);
  c.r = Math.min(1, Math.max(0, c.r)); c.g = Math.min(1, Math.max(0, c.g)); c.b = Math.min(1, Math.max(0, c.b));
  return c;
}

/** Gold used on banners, spires and the selection rim (the accent token when the stylesheet defines one). */
export function accentGold(): THREE.Color {
  try { return new THREE.Color(getPalette().accent); } catch { return gold(); }
}
