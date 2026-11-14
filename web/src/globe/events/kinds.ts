// The kinds of world event that get a beacon on the globe, with their colour and tour priority.
// Colours live here only, so the HUD feed (lane c) can match them. Lane b.

export type BeaconKind = 'city' | 'capital' | 'war' | 'treaty' | 'fall' | 'secession' | 'decree'
  | 'wonder' | 'death' | 'succession';

export interface KindMeta { label: string; color: string; priority: number }

export const KIND_META: Record<BeaconKind, KindMeta> = {
  wonder:     { label: 'Wonder',      color: '#d08a2e', priority: 7 },
  fall:       { label: 'Fall',        color: '#3b3a42', priority: 6 },
  war:        { label: 'War',         color: '#a8322d', priority: 5 },
  death:      { label: 'Death',       color: '#4a4038', priority: 4 },
  succession: { label: 'Succession',  color: '#6b4ea0', priority: 4 },
  treaty:     { label: 'Treaty',      color: '#3d6f9e', priority: 3 },
  secession:  { label: 'Secession',   color: '#8a5a9e', priority: 2 },
  decree:     { label: 'Decree',      color: '#7a5230', priority: 2 },
  capital:    { label: 'New capital', color: '#b08a2e', priority: 1 },
  city:       { label: 'New city',    color: '#3f7d5a', priority: 1 },
};

/** One thing worth showing: where, who, and the line to caption it with. */
export interface Story {
  kind: BeaconKind;
  tile: number;
  countryId: number | null;
  title: string;
  sub?: string;
  year: number;
  /** a chronicle decree: attach its text to a decree beacon made a moment ago, if any */
  attach?: boolean;
  at: number; // performance.now() when it arrived
}
