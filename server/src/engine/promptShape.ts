// How the prompt shapes a new world, apart from what the lore model writes: plain keyword rules that
// read the prompt (and the era the user picked) for a starting year, a starting tech age, the planet's
// shape (sea, landmasses, climate, dryness, forest, mountains), the kind of states, the mood and the
// building styles that fit. The template bible is built from these alone (mock mode, a failed call), and
// the model-written bible is checked against them, so a prompt always shows in the world.
import {
  ageForYear, cleanShape, clampStartYear, eraKind, eraKindInfo, mulberry32,
  type BuildingStyle, type EraKind, type TechAge, type WorldShape,
} from '@terra/shared';

// ---- the year ---------------------------------------------------------------------------------

const NOT_A_YEAR = '(?!\\s*(?:years?|days|nations|kingdoms|empires|tribes|clans|people|men|ships|islands|miles|souls|gods|suns|cities|states|leagues)\\b)';

/** A year or century the text names ("in 1349", "900 BC", "17th century", "the 1920s"), or undefined.
 *  `r` (0 to 1, from the seed) picks the year inside a named century or decade. */
export function explicitYear(text: string | undefined, r = 0.3): number | undefined {
  const t = (text ?? '').toLowerCase().replace(/(\d),(\d{3})/g, '$1$2');
  let m: RegExpExecArray | null;
  if ((m = /\b(\d{1,2})(?:st|nd|rd|th)[ -]centur(?:y|ies)(\s*(?:bce?|b\.c\.))?/.exec(t))) {
    const n = Number(m[1]);
    if (n >= 1) return clampStartYear(m[2] ? -n * 100 + Math.floor(r * 60) : (n - 1) * 100 + Math.floor(r * 60));
  }
  if ((m = /\b(\d{1,5})\s*(?:bce?\b|b\.c\.)/.exec(t))) return clampStartYear(-Number(m[1]));
  if ((m = /\b(\d{1,4})\s*(?:ad|ce)\b/.exec(t)) || (m = /\b(?:ad|anno domini)\s*(\d{1,4})\b/.exec(t))) return clampStartYear(Number(m[1]));
  if ((m = /\b(\d{3,4})s\b/.exec(t))) return clampStartYear(Number(m[1]) + Math.floor(r * 10));
  if ((m = new RegExp(`\\b(?:in|year|circa|around|anno)\\s+(?:the\\s+)?(?:year\\s+)?(\\d{3,4})\\b${NOT_A_YEAR}`).exec(t))) return clampStartYear(Number(m[1]));
  if ((m = new RegExp(`\\b([12]\\d{3})\\b${NOT_A_YEAR}`).exec(t))) return clampStartYear(Number(m[1]));
  return undefined;
}

/** A narrower span inside a setting's years when the text says more ("cold war" inside modern). */
const NARROW: [RegExp, [number, number]][] = [
  [/cold war|superpower/, [1947, 1989]],
  [/world war|dieselpunk/, [1914, 1945]],
  [/atomic|nuclear/, [1945, 1965]],
  [/victorian|gilded age/, [1840, 1900]],
  [/viking/, [800, 1050]],
  [/crusade/, [1095, 1290]],
  [/renaissance/, [1400, 1600]],
  [/pirate|privateer/, [1650, 1730]],
  [/roman|legion/, [-200, 300]],
  [/end of the ice age|last ice age/, [-10000, -9000]],
];

/** The setting a calendar year falls in, for a prompt that names a year but no era. */
export function kindForYear(year: number): EraKind {
  if (year < -3000) return 'stone';
  if (year < -1200) return 'bronze';
  if (year < 500) return 'classical';
  if (year < 1400) return 'medieval';
  if (year < 1760) return 'sail';
  if (year < 1900) return 'industrial';
  if (year < 2040) return 'modern';
  return year < 2150 ? 'near_future' : 'far_future';
}

export interface Setting {
  /** The setting the user's era choice or prompt names, if any. */
  kind?: EraKind;
  /** A year the prompt names outright. */
  named?: number;
  startYear: number;
  startAge: TechAge;
}

/**
 * The starting year and tech age of a new world. The year: one the prompt names wins; else the model's
 * year when it lies inside the setting's span; else a seeded year inside that span; with no setting at
 * all, the model's year or `fallbackYear`. The age: the setting's, else what the year allows.
 */
export function settingOf(
  o: { prompt: string; era?: string }, seed: number, model: { era?: string; startYear?: number } = {}, fallbackYear = 1,
): Setting {
  const r = mulberry32((seed ^ 0x5e77) >>> 0)();
  const text = `${o.era ?? ''} ${o.prompt}`.toLowerCase();
  const named = explicitYear(o.prompt, r) ?? explicitYear(o.era, r);
  // No setting in the words but a year the prompt names: the setting of that year (900 BC is classical).
  const kind = eraKind(o.era) ?? eraKind(o.prompt) ?? eraKind(model.era) ?? (named !== undefined ? kindForYear(named) : undefined);
  const modelYear = typeof model.startYear === 'number' && Number.isFinite(model.startYear) ? clampStartYear(model.startYear) : undefined;
  let startYear: number;
  if (named !== undefined) startYear = named;
  else if (kind) {
    const [lo, hi] = NARROW.find(([re]) => re.test(text))?.[1] ?? eraKindInfo(kind).years;
    startYear = modelYear !== undefined && modelYear >= lo && modelYear <= hi ? modelYear : lo + Math.floor(r * (hi - lo));
  } else startYear = modelYear ?? fallbackYear;
  const startAge = kind ? eraKindInfo(kind).age : named !== undefined || modelYear !== undefined ? ageForYear(startYear) : 'ancient';
  return { kind, named, startYear, startAge };
}

/** The era line of a template world for each setting. */
export const KIND_NAME: Record<EraKind, string> = {
  post: 'Post-Apocalyptic Age', far_future: 'Far Future', near_future: 'Near Future', modern: 'Modern Age',
  industrial: 'Industrial Age', sail: 'Age of Sail', medieval: 'Medieval', classical: 'Classical Age',
  bronze: 'Bronze Age', stone: 'Stone Age',
};

// ---- the planet -------------------------------------------------------------------------------

const SHAPE_RULES: [RegExp, WorldShape][] = [
  // sea and landmasses
  [/drown|flooded|sunken|water ?world|ocean world|endless (sea|ocean)|archipelago|atoll/, { seaLevel: 0.74, landmasses: 'many' }],
  [/\bislands?\b|\bisles?\b|scattered/, { seaLevel: 0.68, landmasses: 'many' }],
  [/supercontinent|pangea|pangaea|(one|single|a) (great |vast |huge |giant |single |super)?(continent|landmass)|landlocked/, { seaLevel: 0.42, landmasses: 'one' }],
  // climate
  [/frozen|\bice\b|icy|snow|glaci|winter|arctic|tundra|frost|whal|polar/, { climate: 'cold', dryness: 0.35, forest: 0.35 }],
  [/desert|arid|\bdunes?\b|sunbaked|sun-baked|scorch|parched|drought|dust|wasteland|last (rivers?|wells?|water)|oasis|caravan/, { climate: 'hot', dryness: 0.92, forest: 0.12, seaLevel: 0.45 }],
  [/jungle|rainforest|tropic|monsoon|vine|canopy/, { climate: 'hot', dryness: 0.08, forest: 0.95 }],
  [/swamp|marsh|bog|fen\b|delta/, { dryness: 0.1, forest: 0.7 }],
  [/forest|woodland|\bwoods\b|elven|druid|taiga/, { forest: 0.9, dryness: 0.25 }],
  [/volcan|burning|lava|ash\b/, { climate: 'hot', mountains: 0.8 }],
  [/steppe|prairie|savanna|grassland|\bplains\b/, { forest: 0.15, mountains: 0.2, dryness: 0.55 }],
  // relief
  [/mountain|highland|\bpeaks?\b|alpine|crag|cliff/, { mountains: 0.88 }],
  [/lowland|flatland|\bflat\b/, { mountains: 0.15 }],
];

/** The planet's shape from the words of the prompt; earlier rules win a field. Empty for a plain prompt. */
export function shapeFromText(text: string): WorldShape {
  const t = text.toLowerCase();
  const out: WorldShape = {};
  for (const [re, s] of SHAPE_RULES) if (re.test(t)) for (const [k, v] of Object.entries(s)) if ((out as Record<string, unknown>)[k] === undefined) (out as Record<string, unknown>)[k] = v;
  return cleanShape(out);
}

/** The words of the prompt win a field (they are what the user asked for); the model fills the rest. */
export function mergeShape(words: WorldShape, model: unknown, seaHint?: number): WorldShape | undefined {
  const m = cleanShape(model);
  const out = cleanShape({ ...(seaHint !== undefined ? { seaLevel: seaHint } : {}), ...m, ...words });
  return Object.keys(out).length ? out : undefined;
}

// ---- the nations ------------------------------------------------------------------------------

const WORD_NUMBER: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a_dozen: 12 };
const STATES = 'nations|kingdoms|empires|tribes|clans|city-states|cities|republics|realms|states|houses|powers|duchies|factions|peoples|hordes|leagues|guilds|dynasties|crowns|thrones';

/** A nation count the prompt names ("seven warring kingdoms", "4 rival empires"), clamped 3 to 10. */
export function nationsFromPrompt(prompt: string): number | undefined {
  const m = new RegExp(`\\b(\\d{1,2}|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+(?:[a-z-]+\\s+){0,2}(?:${STATES})\\b`).exec(prompt.toLowerCase());
  if (!m) return undefined;
  const n = WORD_NUMBER[m[1]!] ?? Number(m[1]);
  return Number.isFinite(n) && n >= 2 ? Math.max(3, Math.min(10, n)) : undefined;
}

/** The kind of state the prompt asks for ("whaling republics", "tribes"): the noun in a name and the government word. */
const POLITIES: [RegExp, string, string][] = [
  [/city-states?|free cities/, 'Free City', 'city-state'],
  [/republics?/, 'Republic', 'republic'],
  [/kingdoms?|crowns/, 'Kingdom', 'kingdom'],
  [/empires?|imperial/, 'Empire', 'empire'],
  [/tribes?|tribal/, 'Tribe', 'tribe'],
  [/clans?/, 'Clan', 'clan'],
  [/hordes?|nomads?/, 'Horde', 'horde'],
  [/duch(y|ies)|dukes?/, 'Duchy', 'duchy'],
  [/guilds?/, 'Guild', 'guild state'],
  [/arcolog(y|ies)/, 'Arcology', 'arcology'],
  [/corporat|megacorp/, 'Combine', 'corporate state'],
  [/communes?|collectives?/, 'Commune', 'commune'],
  [/federations?/, 'Federation', 'federation'],
  [/theocrac|cults?|priest/, 'Temple', 'temple state'],
];
/** The usual states of each setting, when the prompt names none. */
const KIND_POLITIES: Record<EraKind, [string, string][]> = {
  stone: [['Tribe', 'tribe'], ['Clan', 'clan'], ['Band', 'band'], ['Hearth', 'hearth-moot']],
  bronze: [['City', 'city-state'], ['Kingdom', 'kingdom'], ['Temple', 'temple state'], ['Dynasty', 'dynasty']],
  classical: [['Republic', 'republic'], ['Empire', 'empire'], ['League', 'league'], ['Kingdom', 'kingdom']],
  medieval: [['Kingdom', 'kingdom'], ['Duchy', 'duchy'], ['Principality', 'principality'], ['Free City', 'free city']],
  sail: [['Kingdom', 'kingdom'], ['Company', 'trading company'], ['Republic', 'republic'], ['Empire', 'empire']],
  industrial: [['Republic', 'republic'], ['Empire', 'empire'], ['Union', 'union'], ['Federation', 'federation']],
  modern: [['Republic', 'republic'], ['Federation', 'federation'], ["People's State", "people's state"], ['Union', 'union']],
  near_future: [['Combine', 'corporate state'], ['Federation', 'federation'], ['Network', 'network state'], ['Republic', 'republic']],
  far_future: [['Arcology', 'arcology'], ['Collective', 'collective'], ['Directorate', 'directorate'], ['Federation', 'federation']],
  post: [['Enclave', 'enclave'], ['Commune', 'commune'], ['Warband', 'warband'], ['Salvage Guild', 'salvage guild']],
};

/** Words that replace an archetype's usual one where it would jar ("technocratic tribe"). */
export const KIND_MODS: Partial<Record<EraKind, Record<string, string>>> = {
  stone: { merchant: 'trading', elective: 'moot-led', naval: 'canoe', holy: 'spirit', shadow: 'whispering', technocratic: 'flint-working' },
  bronze: { technocratic: 'scribe', naval: 'river', shadow: 'oracle' },
  classical: { technocratic: 'scholar' },
  medieval: { technocratic: 'guild' },
  post: { technocratic: 'tinker', elective: 'elected', naval: 'raft', merchant: 'barter' },
};

/** The state (name noun, government word) for the i-th nation, or undefined to keep the template's own. */
export function polityFor(prompt: string, kind: EraKind | undefined, i: number): [string, string] | undefined {
  const named = POLITIES.find(([re]) => re.test(prompt.toLowerCase()));
  const usual = kind ? KIND_POLITIES[kind] : undefined;
  // What the prompt names rules two nations in three; the third is one of the setting's usual states.
  if (named && (i % 3 !== 2 || !usual)) return i % 3 === 2 ? undefined : [named[1], named[2]];
  return usual ? usual[i % usual.length] : undefined;
}

/** How the words of the prompt lean every nation's temperament (added to each trait, then clamped). */
export function moodFromText(text: string): { aggression: number; expansion: number; trade: number; faith: number } {
  const t = text.toLowerCase();
  const lean = (up: RegExp, down: RegExp, by: number) => (up.test(t) ? by : 0) - (down.test(t) ? by : 0);
  return {
    aggression: lean(/\bwar\b|warring|fight|rival|feud|blood|conquer|raider|battle|ruthless|brutal|warlord/, /peace|harmon|gentle|calm|pacifi|quiet/, 0.15),
    expansion: lean(/empire|conquer|coloni|frontier|settler|explor/, /isolat|hermit|hidden|secluded/, 0.12),
    trade: lean(/trad|merchant|whal|caravan|market|guild|port|salt road|compan/, /isolat|hermit|raider/, 0.12),
    faith: lean(/cult|\bgods?\b|temple|holy|prophet|priest|sacred|saint|faith|shrine|pyramid/, /godless|secular|atheis|machine|clockwork|arcolog/, 0.15),
  };
}

// ---- building styles --------------------------------------------------------------------------

/** The styles that fit each setting, most typical first (a clockwork age gets no mud-brick towns). */
const KIND_STYLES: Record<EraKind, BuildingStyle[]> = {
  stone: ['highland', 'sahel', 'norse', 'mesoamerican', 'desert'],
  bronze: ['egyptian', 'classical', 'desert', 'mesoamerican', 'south_asian', 'sahel'],
  classical: ['classical', 'egyptian', 'east_asian', 'south_asian', 'desert', 'mesoamerican'],
  medieval: ['medieval', 'norse', 'east_asian', 'highland', 'desert', 'south_asian', 'sahel', 'classical'],
  sail: ['medieval', 'classical', 'east_asian', 'south_asian', 'highland', 'norse', 'desert'],
  industrial: ['industrial', 'western_modern', 'classical', 'medieval', 'east_asian'],
  modern: ['western_modern', 'soviet_bloc', 'industrial', 'east_asian'],
  near_future: ['western_modern', 'arcology', 'industrial', 'soviet_bloc'],
  far_future: ['arcology', 'western_modern', 'industrial', 'soviet_bloc'],
  post: ['scrap', 'industrial', 'soviet_bloc', 'highland'],
};
/** Styles a climate favours; those that also fit the setting are tried first. */
const CLIMATE_STYLES: [RegExp, BuildingStyle[]][] = [
  [/frozen|\bice\b|icy|snow|glaci|winter|arctic|tundra|frost|whal|polar|fjord/, ['norse', 'highland']],
  [/desert|arid|dune|sunbaked|oasis|caravan|sand/, ['desert', 'egyptian', 'sahel']],
  [/jungle|rainforest|tropic|pyramid|vine/, ['mesoamerican', 'south_asian']],
  [/island|archipelago|atoll|mountain|monaster/, ['east_asian', 'highland']],
];

/**
 * Fits each nation's building style to the setting: a style the setting allows is kept (at most two
 * nations per style), any other is swapped for the least-used allowed style, the climate's first. With
 * no setting (a plain prompt) the styles are returned as they came.
 */
export function fitStyles(styles: BuildingStyle[], kind: EraKind | undefined, text: string): BuildingStyle[] {
  if (!kind) return styles;
  const t = text.toLowerCase();
  const favoured = CLIMATE_STYLES.filter(([re]) => re.test(t)).flatMap(([, s]) => s);
  const allowed = KIND_STYLES[kind];
  const pool = [...favoured.filter((s) => allowed.includes(s)), ...allowed.filter((s) => !favoured.includes(s))];
  const count = new Map<BuildingStyle, number>();
  const take = (s: BuildingStyle) => { count.set(s, (count.get(s) ?? 0) + 1); return s; };
  const cap = Math.max(2, Math.ceil(styles.length / pool.length));
  return styles.map((s) => {
    if (pool.includes(s) && (count.get(s) ?? 0) < cap) return take(s);
    // the least used allowed style; ties go to the earlier (more typical) one
    return take(pool.reduce((best, p) => ((count.get(p) ?? 0) < (count.get(best) ?? 0) ? p : best), pool[0]!));
  });
}

/** A word for the world's name from the prompt ("The Salt Tides"), or undefined to keep the era's. */
export function worldNoun(text: string, r: number): string | undefined {
  const t = text.toLowerCase();
  const sets: [RegExp, string[]][] = [
    [/drown|flooded|sunken|archipelago|atoll|\bislands?\b/, ['Tides', 'Isles', 'Deep']],
    [/frozen|\bice\b|snow|glaci|winter|arctic|frost/, ['Ice', 'Winter', 'Floes']],
    [/desert|\bdunes?\b|sunbaked|arid|caravan/, ['Sands', 'Dunes', 'Wells']],
    [/jungle|rainforest|vine|canopy/, ['Canopy', 'Green', 'Vines']],
    [/clockwork|brass|steam/, ['Gears', 'Engines', 'Brass']],
    [/arcolog|far.?future|starship/, ['Spires', 'Horizon', 'Arcologies']],
    [/stone age|mammoth|neolithic/, ['Dawn', 'Hearths', 'Thaw']],
    [/supercontinent|one (great |vast )?continent/, ['Continent', 'Heartland']],
  ];
  const set = sets.find(([re]) => re.test(t))?.[1];
  return set ? set[Math.floor(r * set.length) % set.length] : undefined;
}
