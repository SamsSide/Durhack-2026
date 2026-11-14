// Lane b: the building style a nation's settlements are drawn in, by its tech age (issue #317 item 12).
// Ancient to gunpowder keep the nation's own style from the world prompt; industrial and modern move it to
// a modern style that fits its identity; future and stellar build arcologies. Pure and deterministic.
// Used by the close-up towns (houses, walls) and by the structure models (the landmark in each town).
import * as THREE from 'three';
import type { BuildingStyle, Country, TechAge, World } from '@terra/shared';
import { govOf } from '../identity/identity';
import { hash01 } from '../structures/placement';

const NEXT: Record<TechAge, TechAge | null> = {
  ancient: 'medieval', medieval: 'gunpowder', gunpowder: 'industrial', industrial: 'modern',
  modern: 'future', future: 'stellar', stellar: null,
};
const MODERN = new Set<TechAge>(['industrial', 'modern']);
const FUTURE = new Set<TechAge>(['future', 'stellar']);

// Eastern or authoritarian words in a nation's name, government, ideology or culture: these modernise into
// concrete blocks (soviet_bloc); everyone else into glass and steel (western_modern).
const EASTERN = /\b(tsar|czar|slav|rus|soviet|steppe|khan|horde|boyar|cossack|commissar|politburo|kremlin|shogun|mandate|autocra|authoritar|totalitar|dictator|despot|iron fist|vanguard|five-year)/;
const EASTERN_STYLES = new Set<BuildingStyle>(['east_asian', 'soviet_bloc']);

type AgeInput = Pick<Country, 'name' | 'buildingStyle' | 'techAge' | 'government' | 'ideology' | 'culture' | 'temperament' | 'nomadic'>;

/** The modern style a nation moves to at the industrial age: soviet_bloc or western_modern. */
export function modernStyleOf(c: AgeInput): BuildingStyle {
  const own = c.buildingStyle ?? 'medieval';
  if (own === 'soviet_bloc' || own === 'western_modern') return own;
  if (EASTERN_STYLES.has(own)) return 'soviet_bloc';
  const gov = govOf(c, 1);
  if (gov === 'communist' || gov === 'junta') return 'soviet_bloc';
  const text = `${c.name ?? ''} ${c.government ?? ''} ${c.ideology ?? ''} ${(c.culture ?? []).join(' ')}`.toLowerCase();
  return EASTERN.test(text) ? 'soviet_bloc' : 'western_modern';
}

/** The style a nation's towns, cities and capital are drawn in right now. */
export function ageStyle(c: AgeInput | undefined): BuildingStyle {
  const own = c?.buildingStyle ?? 'medieval';
  if (!c || own === 'arcology') return own;
  const age = c.techAge ?? 'ancient';
  if (FUTURE.has(age)) return 'arcology';
  if (MODERN.has(age)) return modernStyleOf(c);
  return own;
}

/** The style it will move to at its next age (preloaded so the switch never waits on a download). */
export function nextAgeStyle(c: AgeInput | undefined): BuildingStyle {
  const next = c ? NEXT[c.techAge ?? 'ancient'] : null;
  return next ? ageStyle({ ...c!, techAge: next }) : ageStyle(c);
}

/** Longest stagger of an age switch across a nation, in seconds. */
export const AGE_WAVE_S = 3;
const WAVE_RAD = 0.35; // a settlement this far from the capital (radians) switches last

/**
 * Seconds after an age step before the settlement on `tile` switches style: a wave outward from the capital
 * over about three seconds. The landmark model and the town around it use the same delay, so they switch together.
 */
export function ageSwapDelay(world: World, owner: number, tile: number): number {
  const cap = world.countries[owner]?.capitalTile ?? -1;
  const a = world.tiles[tile]?.center, b = cap >= 0 ? world.tiles[cap]?.center : undefined;
  let d = 0.5;
  if (a && b) {
    const va = new THREE.Vector3(...a).normalize(), vb = new THREE.Vector3(...b).normalize();
    d = Math.min(1, Math.acos(Math.max(-1, Math.min(1, va.dot(vb)))) / WAVE_RAD);
  }
  return 0.1 + (AGE_WAVE_S - 0.4) * d + 0.3 * hash01(tile, 61);
}
