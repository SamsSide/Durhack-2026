// The world bible: everything creative about a new world, as plain JSON. Row A2's mock fills it
// from templates; row A5 will fill the same shape from Gemini.
import type { Country } from '../types';

export type BibleNation = Omit<Country, 'id' | 'capitalTile' | 'alive' | 'population' | 'treasury' | 'parent'> & {
  regionNames: string[];                                 // 6 or more, in the nation's own culture
};

export interface WorldBible {
  name: string;
  era: string;
  startYear: number;
  nations: BibleNation[];
}
