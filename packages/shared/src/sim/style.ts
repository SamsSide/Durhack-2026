// Building styles (owner decision #91): each nation builds in one architectural style, picked by
// Gemini in the world bible or, as a fallback, by these rules (docs/research/building-styles.md).
import type { BuildingStyle, Country } from '../types';

export const BUILDING_STYLES: BuildingStyle[] = [
  'medieval', 'classical', 'desert', 'east_asian', 'mesoamerican', 'scrap',
  'norse', 'south_asian', 'sahel', 'industrial',
  'soviet_bloc', 'western_modern', 'egyptian', 'highland',
];

/** Styles that have their own models (tier 1); the rest fall back to the nearest built one. */
export const BUILT_STYLES: BuildingStyle[] = ['medieval', 'classical', 'desert', 'east_asian', 'mesoamerican', 'scrap'];
export const STYLE_FALLBACK: Record<BuildingStyle, BuildingStyle> = {
  medieval: 'medieval', classical: 'classical', desert: 'desert', east_asian: 'east_asian',
  mesoamerican: 'mesoamerican', scrap: 'scrap', norse: 'medieval', south_asian: 'desert',
  sahel: 'desert', industrial: 'scrap',
  soviet_bloc: 'scrap', western_modern: 'classical', egyptian: 'desert', highland: 'medieval',
};

export const isBuildingStyle = (s: unknown): s is BuildingStyle =>
  typeof s === 'string' && (BUILDING_STYLES as string[]).includes(s);

type StyleInput = Pick<Country, 'government' | 'ideology' | 'culture' | 'temperament'>;
const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

/** The rule-based pick for one nation (first match wins). */
export function pickBuildingStyle(worldText: string, n: StyleInput): BuildingStyle {
  const world = worldText.toLowerCase();
  const own = `${n.government} ${n.ideology} ${n.culture.join(' ')}`.toLowerCase();
  if (has(world, ['post-apocalyptic', 'apocalypse', 'wasteland', 'drowned', 'ruined', 'fallout', 'scrap'])) return 'scrap';
  if (has(world, ['industrial', 'modern', 'steampunk', 'cyberpunk', 'space', 'sci-fi'])) return 'industrial';
  if (has(own, ['samurai', 'shogun', 'emperor', 'mandate', 'bureaucra', 'harmony', 'pagoda'])) return 'east_asian';
  if (has(own, ['pharaoh', 'caliph', 'sultan', 'caravan', 'oasis', 'dune'])) return 'desert';
  if (has(own, ['inca', 'aztec', 'maya', 'sun king', 'sacrifice', 'priest-king', 'jaguar'])) return 'mesoamerican';
  if (has(own, ['republic', 'senate', 'philosopher', 'law', 'marble', 'citizen'])) return 'classical';
  if (has(own, ['jarl', 'raider', 'clan', 'saga', 'fjord'])) return 'norse';
  if (has(own, ['raja', 'dharma', 'monaster', 'caste'])) return 'south_asian';
  if (has(own, ['griot', 'gold trade', 'ancestor'])) return 'sahel';
  if (has(world, ['ice', 'tundra', 'snow', 'fjord'])) return 'norse';
  if (has(world, ['desert', 'dune', 'sand'])) return 'desert';
  if (has(world, ['jungle', 'rainforest'])) return 'mesoamerican';
  if (has(world, ['island', 'floating', 'archipelago', 'mountain'])) return 'east_asian';
  if (has(world, ['bronze age', 'antiquity', 'classical'])) return 'classical';
  const t = n.temperament;
  if (t.faith > 0.7) return 'mesoamerican';
  if (t.trade > 0.7) return 'desert';
  return 'medieval';
}

/** Nomadic peoples get yurts for camps (lane b may draw them; optional). */
export const isNomadic = (n: Pick<Country, 'culture' | 'government'>) =>
  has(`${n.government} ${n.culture.join(' ')}`.toLowerCase(), ['herder', 'horse lord', 'steppe', 'nomad', 'caravan']);

/**
 * The diversity rule: at most 2 nations per style unless the whole world is one culture.
 * Extra nations move to the least-used built style, in a stable order.
 */
export function diversifyStyles(styles: BuildingStyle[], singleCulture = false): BuildingStyle[] {
  if (singleCulture) return styles;
  const count = new Map<BuildingStyle, number>();
  return styles.map((s) => {
    if ((count.get(s) ?? 0) < 2) { count.set(s, (count.get(s) ?? 0) + 1); return s; }
    const alt = [...BUILT_STYLES].sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0))[0]!;
    count.set(alt, (count.get(alt) ?? 0) + 1);
    return alt;
  });
}
