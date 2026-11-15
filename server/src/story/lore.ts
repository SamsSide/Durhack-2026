// Template lore built from a country's fields and its real chronicle (mock mode and the fallback
// when Gemini is off, capped or fails). Everything here is derived from real world data.
import { regionOwner, relationOf, yearLabel, type Country, type Stance, type World } from '@terra/shared';

/** "a" or "an" before a government name. */
const article = (w: string): string => (/^[aeiou]/i.test(w) ? 'an' : 'a');

export interface RelationLore { with: number; stance: Stance; story: string }
export interface CountryLore {
  countryId: number; asOfTick: number;
  summary: string; culture: string; politics: string; history: string;
  anthemLyrics: string[]; relations: RelationLore[];
}
export interface RegionLore { regionId: number; name: string; owner: number; summary: string; history: string }

const pick = <T>(arr: readonly T[], seed: number): T => arr[Math.abs(seed) % arr.length]!;
const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);

/** The most recent chronicle entries that involve a country (oldest first). */
export function chronicleOf(world: World, id: number, max = 25) {
  return world.chronicle.filter((e) => e.countries.includes(id)).slice(-max);
}

type Trait = 'aggression' | 'expansion' | 'trade' | 'faith';
function dominantTrait(c: Country): Trait {
  const t = c.temperament;
  return (['aggression', 'expansion', 'trade', 'faith'] as const).reduce((a, b) => (t[b] > t[a] ? b : a));
}

const TRAIT_SUMMARY: Record<Trait, string[]> = {
  aggression: ['Its banners are never furled for long.', 'It is quick to take offence and quicker to march.', 'Its neighbours keep one eye on its borders.'],
  expansion: ['It is forever looking over the next hill.', 'Its settlers push the border outward season by season.', 'It measures itself by the ground it has claimed.'],
  trade: ['Its ledgers matter more to it than its banners.', 'Its markets are never quiet.', 'It would rather buy a border than fight for one.'],
  faith: ['Its priests are heard in every council.', 'It believes it is guided, and acts like it.', 'Its calendar is a litany of feast days and vigils.'],
};
const TRAIT_POLITICS: Record<Trait, string[]> = {
  aggression: ['The war-leaders carry the most weight at court, and every grievance is remembered.', 'Generals sit in every council, and peace is treated as an interval.'],
  expansion: ['Surveyors and settlers are favoured at court, and every new province is a victory.', 'Court factions are measured by how far they would push the frontier.'],
  trade: ['Guild houses and harbour masters hold the real power behind the throne.', 'Treaties are priced in coin before they are signed in ink.'],
  faith: ['The temples hold a quiet veto over any serious decision.', 'Priests bless every decree, and a decree without a blessing does not last.'],
};
const STANCE_WORDS: Record<Stance, string> = {
  war: 'at war with', hostile: 'on hostile terms with', neutral: 'at peace with', trade: 'trading with', alliance: 'allied with',
};

function history(world: World, id: number, c: Country): string {
  const mine = chronicleOf(world, id, 6);
  if (!mine.length) return `${c.name} has no recorded history yet.`;
  return mine.map((e) => `In ${yearLabel(e.year)}: ${e.text}`).join(' ');
}

function relationsLore(world: World, id: number, c: Country): RelationLore[] {
  return world.countries
    .filter((o) => o.id !== id)
    .map((o) => ({ o, r: relationOf(world, id, o.id) }))
    .filter(({ r }) => r.stance !== 'neutral')
    .map(({ o, r }) => {
      const shared = world.chronicle.filter((e) => e.countries.includes(id) && e.countries.includes(o.id)).slice(-1)[0];
      const since = world.year - (world.tick - r.since);
      const base = `${c.name} has been ${STANCE_WORDS[r.stance]} ${o.name} since ${yearLabel(since)}.`;
      return { with: o.id, stance: r.stance, story: shared ? `${shared.text} ${base}` : base };
    });
}

// Couplets that rhyme; {adj}, {name}, {leader}, {foe}, {ally} are filled from the real world.
const OPENING = [
  ['Rise, {adj} hearts, beneath the open sky', 'Our banner on the wind flies high'],
  ['{adj} sons and daughters, hear us stand', 'One people on one patch of land'],
  ['From ember and from ash we came', 'And {name} is our deathless name'],
  ['Our fires burn through the longest night', 'And every window holds a light'],
] as const;
const TRAIT_COUPLET: Record<Trait, readonly [string, string]> = {
  aggression: ['Our drums are loud, our blades are bright', 'We meet the dark and win the night'],
  expansion: ['Beyond the hill, beyond the shore', 'Our children plant the flag once more'],
  trade: ['Our harbours hum with coin and sail', 'Each ship that leaves brings home a tale'],
  faith: ['The bells ring out, the faithful call', 'One prayer, one people, one for all'],
};

function anthem(world: World, id: number, c: Country): string[] {
  const fill = (l: string, extra: Record<string, string> = {}) =>
    l.replace(/\{(\w+)\}/g, (_, k: string) => ({ adj: c.adjective, name: c.name, leader: c.leader, ...extra })[k] ?? '');
  const mine = chronicleOf(world, id, 25);
  const nameOf = (n: number) => world.countries[n]?.name ?? 'a stranger';
  const other = (e: { countries: number[] }) => e.countries.find((n) => n !== id);
  const enemy = [...mine].reverse().find((e) => (e.kind === 'war' || e.kind === 'battle') && other(e) !== undefined);
  const ally = [...mine].reverse().find((e) => e.kind === 'alliance' && other(e) !== undefined);
  const hardship = [...mine].reverse().find((e) => e.kind === 'dispute' || e.kind === 'betrayal' || e.kind === 'fall');
  const lines: string[] = [...pick(OPENING, hash(c.name))].map((l) => fill(l));
  lines.push(`We keep the old ways of ${lowerFirst(c.culture[0] ?? 'our fathers')} and ${lowerFirst(c.culture[1] ?? 'the hearth')}`);
  lines.push(...TRAIT_COUPLET[dominantTrait(c)]);
  if (enemy) lines.push(fill('Against {foe} our banners flew', { foe: nameOf(other(enemy)!) }), fill('And {leader} led the brave and true'));
  else if (ally) lines.push(fill('With {ally} we swore an oath of old', { ally: nameOf(other(ally)!) }), 'Two hands together, brave and bold');
  else if (hardship) lines.push('Though trouble came, we did not yield', fill('{leader} held the fractured field'));
  else lines.push('No foe has yet been named in our song', 'We stood in peace and we grew strong');
  lines.push(`${c.name}, we stand, we stand`);
  return lines;
}

export function countryLore(world: World, id: number): CountryLore | null {
  const c = world.countries[id];
  if (!c) return null;
  const seed = hash(c.name) + id;
  const trait = dominantTrait(c);
  const provinces = world.owner.filter((o) => o === id).length;
  const standing = c.alive
    ? `It holds ${provinces} province${provinces === 1 ? '' : 's'} and about ${c.population.toLocaleString('en-GB')} souls.`
    : 'It has fallen.';
  const wars = world.countries.filter((o) => o.id !== id && relationOf(world, id, o.id).stance === 'war');
  const warLine = wars.length ? ` It is at war with ${wars.map((w) => w.name).join(' and ')}.` : '';
  return {
    countryId: id,
    asOfTick: world.tick,
    summary: `${c.name} is ${article(c.government)} ${c.government} led by ${c.leader}. ${standing} ${pick(TRAIT_SUMMARY[trait], seed)}${warLine}`.trim(),
    culture: `The people of ${c.name} are known for ${c.culture.join(', ')}. ${c.foundingMyth}`,
    politics: `${c.leader} rules as head of ${article(c.government)} ${c.government}. ${c.ideology} ${pick(TRAIT_POLITICS[trait], seed + 1)}`,
    history: history(world, id, c),
    anthemLyrics: anthem(world, id, c),
    relations: relationsLore(world, id, c),
  };
}

export function regionLore(world: World, id: number): RegionLore | null {
  const r = world.regions[id];
  if (!r) return null;
  const owner = regionOwner(world, id);
  const oc = world.countries[owner];
  const label = r.name || 'This region';
  return {
    regionId: id,
    name: r.name || `Unsettled region ${id}`,
    owner,
    summary: oc
      ? `${label} lies under ${oc.name}, ${r.tiles.length} provinces of ${r.unrest > 0.5 ? 'restless' : 'quiet'} land.`
      : `${label} belongs to no one.`,
    history: regionHistory(world, id) || 'Nothing has been written about this place yet.',
  };
}

/** Chronicle entries that mention the region by name. */
export function regionHistory(world: World, id: number): string {
  const r = world.regions[id];
  if (!r?.name) return '';
  return world.chronicle.filter((e) => e.text.includes(r.name)).slice(-8).map((e) => e.text).join(' ');
}

