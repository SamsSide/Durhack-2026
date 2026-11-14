// Wonder helpers on top of the @terra/shared contract (docs/contracts.md X1, row A30). Lane b.
import { WONDER_BONUS, WONDER_KINDS, wonderKindFor } from '@terra/shared';
import type { WonderKind } from '@terra/shared';
export { WONDER_BONUS, WONDER_KINDS, wonderKindFor };

export type { WonderKind };
export const WONDER_LABEL: Record<WonderKind, string> = {
  great_wall: 'Great Wall', mausoleum: 'Mausoleum', pyramid: 'Pyramid', colossus: 'Colossus',
  cathedral: 'Cathedral', palace_of_soviets: 'Palace of Soviets', skyscraper: 'Skyscraper', space_elevator: 'Space Elevator',
};

export interface WonderBonus { income: number; defence: number; unrest: number }

export function isWonderKind(k: unknown): k is WonderKind {
  return typeof k === 'string' && (WONDER_KINDS as readonly string[]).includes(k);
}

export function wonderBonus(kind: WonderKind): WonderBonus {
  return WONDER_BONUS[kind];
}

/** "+5% income, +10% defence, -1 unrest a year" (only the non-zero parts). */
export function bonusText(b: WonderBonus | null | undefined): string {
  if (!b) return '';
  const pct = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`;
  const parts: string[] = [];
  if (b.income) parts.push(`${pct(b.income)} income`);
  if (b.defence) parts.push(`${pct(b.defence)} defence`);
  if (b.unrest) parts.push(`${b.unrest > 0 ? '+' : ''}${b.unrest} unrest a year`);
  return parts.join(', ');
}
