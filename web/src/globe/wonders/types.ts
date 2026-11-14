// Local mirror of the wonder contract (docs/contracts.md X1, row A30) until @terra/shared has it.
// Everything is read defensively: the fields may be missing on an older server. Lane b.
import * as shared from '@terra/shared';

export type WonderKind = 'great_wall' | 'mausoleum' | 'pyramid' | 'colossus' | 'cathedral'
  | 'palace_of_soviets' | 'skyscraper' | 'space_elevator';

export const WONDER_KINDS: readonly WonderKind[] = [
  'great_wall', 'mausoleum', 'pyramid', 'colossus', 'cathedral', 'palace_of_soviets', 'skyscraper', 'space_elevator',
];

export const WONDER_LABEL: Record<WonderKind, string> = {
  great_wall: 'Great Wall', mausoleum: 'Mausoleum', pyramid: 'Pyramid', colossus: 'Colossus',
  cathedral: 'Cathedral', palace_of_soviets: 'Palace of Soviets', skyscraper: 'Skyscraper', space_elevator: 'Space Elevator',
};

export interface WonderBonus { income: number; defence: number; unrest: number }

export function isWonderKind(k: unknown): k is WonderKind {
  return typeof k === 'string' && (WONDER_KINDS as readonly string[]).includes(k);
}

/** The structure fields A30 adds, read off any structure-shaped object. */
export interface WonderStructureLike { id: string; tile: number; owner: number; kind: string; builtTick?: number; wonder?: unknown; name?: unknown; complete?: unknown }

/** `WONDER_BONUS[kind]` from @terra/shared once A30 lands; null until then. */
export function wonderBonus(kind: WonderKind): WonderBonus | null {
  const table = (shared as unknown as Record<string, unknown>).WONDER_BONUS as Record<string, WonderBonus> | undefined;
  const b = table?.[kind];
  return b && typeof b === 'object' ? b : null;
}

/** "+5% income, +10% defence, -1 unrest a year" (only the non-zero parts). */
export function bonusText(b: WonderBonus | null): string {
  if (!b) return '';
  const pct = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`;
  const parts: string[] = [];
  if (b.income) parts.push(`${pct(b.income)} income`);
  if (b.defence) parts.push(`${pct(b.defence)} defence`);
  if (b.unrest) parts.push(`${b.unrest > 0 ? '+' : ''}${b.unrest} unrest a year`);
  return parts.join(', ');
}
