// Chronicle kinds as the design shows them. `secession` is a real ChronicleKind since A18 (#109);
// a `founding` whose first nation has a parent is still shown as one, for logs from before it.
import type { ChronicleEntry, ChronicleKind, World } from '@terra/shared';

export type DisplayKind = ChronicleKind | 'secession';

export const KIND_LABEL: Record<DisplayKind, string> = {
  founding: 'Founding',
  proclamation: 'Proclamation',
  growth: 'Growth',
  war: 'War',
  battle: 'Battle',
  peace: 'Peace',
  alliance: 'Alliance',
  betrayal: 'Betrayal',
  fall: 'Fall',
  secession: 'Secession',
  silence: 'Silence',
  return: 'Return',
  dispute: 'Dispute',
  decree: 'Decree',
  wonder: 'Wonder',
  death: 'Death',
  succession: 'Succession',
};

/** Legend order: the design's eleven first, then the quieter kinds. */
export const LEGEND_ORDER: DisplayKind[] = [
  'war', 'battle', 'peace', 'alliance', 'betrayal', 'fall', 'secession', 'dispute',
  'silence', 'return', 'decree', 'death', 'succession', 'founding', 'proclamation', 'growth', 'wonder',
];

export function displayKind(e: ChronicleEntry, world: World): DisplayKind {
  if (e.kind === 'founding') {
    const first = e.countries[0];
    const c = first != null ? world.countries[first] : undefined;
    if (c && c.parent != null) return 'secession';
  }
  return e.kind;
}

/** Lowercase a leading "The" so "of The Salt Age" reads "of the Salt Age". */
export function ofName(name: string): string {
  return name.replace(/^The\s/, 'the ');
}
