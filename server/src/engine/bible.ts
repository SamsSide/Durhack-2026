// Mock world bible (row A2): template nations and region names, no API calls. Seeded, so the same
// (options, seed) gives the same bible. Row A5 replaces this with a Gemini-written bible.
import { mulberry32, pick, type BibleNation, type FlagSpec, type Rng, type WorldBible } from '@terra/shared';
import type { NewWorldOptions } from '../runner';

interface EraKit {
  key: string; match: RegExp; name: string; startYear: number; tone: string;
  places: string[]; features: string[];
}

const ERAS: EraKit[] = [
  { key: 'bronze', match: /bronze|ancient|stone/i, name: 'Bronze Age', startYear: -2400, tone: 'ancient',
    places: ['Ur', 'Kesh', 'Arrat', 'Dun', 'Mesh', 'Tarn', 'Hatt', 'Sumer', 'Akad', 'Nin'],
    features: ['Ford', 'Mound', 'Threshing Plain', 'Bronze Hills', 'Reed Marsh', 'Cedar Slope', 'Clay Banks', 'Salt Pan'] },
  { key: 'medieval', match: /medieval|feudal|knight/i, name: 'Medieval', startYear: 1100, tone: 'feudal',
    places: ['Aldermere', 'Wessing', 'Carrow', 'Haldane', 'Ormond', 'Brackwater', 'Thornby', 'Kestrel'],
    features: ['Shire', 'March', 'Wold', 'Fenland', 'Hundred', 'Dale', 'Heath', 'Barony'] },
  { key: 'industrial', match: /industrial|steam|victorian|machine/i, name: 'Industrial Age', startYear: 1865, tone: 'industrial',
    places: ['Ironbridge', 'Calder', 'Smeltham', 'Gaswick', 'Brassford', 'Coalport', 'Riveton', 'Cogsworth'],
    features: ['Works', 'Basin', 'Sidings', 'Furnace Reach', 'Canal District', 'Mill Valley', 'Foundry Coast', 'Rail Junction'] },
  { key: 'post', match: /post.?apoc|apocalyp|drown|ruin|wasteland|fallout/i, name: 'Post-Apocalyptic Age', startYear: 2210, tone: 'ruined',
    places: ['Rustholm', 'Last Light', 'Gantry', 'Ember Rest', 'Salvage', 'Dredge', 'Cinder', 'Tidemark'],
    features: ['Drowned Quarter', 'Rust Flats', 'Salvage Shore', 'Ash Terraces', 'Broken Causeway', 'Glass Fields', 'Wreck Bay', 'Sunken Mile'] },
  { key: 'ice', match: /ice|frozen|glacial|snow|winter/i, name: 'Age of Ice', startYear: 40, tone: 'frozen',
    places: ['Skarn', 'Hrimholt', 'Vinter', 'Kald', 'Nordfrost', 'Isfjall', 'Glimmer', 'Rime'],
    features: ['Glacier', 'Frostfell', 'Whiteout Reach', 'Ice Shelf', 'Aurora Hollow', 'Snowcap', 'Rime Valley', 'Floe Coast'] },
  { key: 'float', match: /float|archipelago|sky|island/i, name: 'Age of Archipelagos', startYear: 612, tone: 'island',
    places: ['Nalu', 'Moana', 'Kehi', 'Ilo', 'Tavai', 'Lani', 'Rua', 'Samar'],
    features: ['Lagoon', 'Reef', 'Atoll', 'Drift', 'Cloudbank', 'Trade Wind', 'Coral Shelf', 'Palm Shore'] },
];
const GENERIC: EraKit = { key: 'generic', match: /./, name: 'Age of Beginnings', startYear: 1, tone: 'young',
  places: ['Ardan', 'Belmar', 'Corvane', 'Dorrin', 'Elsmere', 'Fenwick', 'Galvan', 'Hollin'],
  features: ['Marches', 'Reach', 'Downs', 'Fells', 'Vale', 'Heights', 'Moors', 'Shore'] };

const PREFIX = ['Salt', 'Iron', 'Amber', 'Ember', 'Frost', 'Gale', 'Silent', 'Golden', 'Thorn', 'Crow', 'Misty', 'Red', 'Pale', 'Stone', 'Willow', 'Storm', 'Lantern', 'Wild', 'High', 'Bright'];

// Colours chosen to be far apart in hue and bright enough to read on a dark globe.
const COLORS = ['#e0533d', '#3fa95f', '#3d86e0', '#e0b030', '#a768d6', '#35c4b5', '#e07ab0', '#f08a3c', '#9bc43a', '#8fa3ff'];

interface Archetype {
  noun: string; adj: string; government: string; ideology: string; culture: string[]; myth: string;
  t: [number, number, number, number]; anthem: string; voice: string; leaders: string[];
  layouts: FlagSpec['layout'][]; emblems: FlagSpec['emblem'][];
}

const ARCHETYPES: Archetype[] = [
  { noun: 'Concord', adj: '', government: 'merchant republic', ideology: 'Prosperity is the only law that outlasts a fire.',
    culture: ['ledger-keepers', 'sealed contracts', 'harbour feasts', 'distrust of kings', 'weighing-scale oaths'],
    myth: 'When the old capital burned, the guild-masters signed the first charter on a table of cooling embers and swore never to rule alone.',
    t: [0.3, 0.5, 0.9, 0.3], anthem: 'brass fanfare and low drums, mercantile and proud', voice: 'warm, measured, an old merchant',
    leaders: ['Speaker Maren Voss', 'Factor Dalia Orn', 'Syndic Benedek Hale'], layouts: ['horizontal3', 'border', 'canton'], emblems: ['gear', 'anchor', 'crown'] },
  { noun: 'Kingdom', adj: '', government: 'elective monarchy', ideology: 'The land chooses its stewards; the crown only holds it in trust.',
    culture: ['forest oaths', 'harvest festivals', 'long-bow guilds', 'tree burials', 'ancestral banners'],
    myth: 'A girl planted an acorn on a battlefield, and the army that left it unburned became the first court.',
    t: [0.4, 0.7, 0.4, 0.6], anthem: 'folk strings and a hunting horn, hopeful and rooted', voice: 'gentle, storytelling, a village elder',
    leaders: ['Queen Illaria the Green', 'King Aldous Wren', 'Regent Maeve Thorn'], layouts: ['vertical2', 'plain', 'cross'], emblems: ['tree', 'wheat', 'crown'] },
  { noun: 'League', adj: '', government: 'naval oligarchy', ideology: 'Whoever reads the tide may write the law.',
    culture: ['salt-rope knots', 'lantern fleets', 'shanty duels', 'drowned-saint shrines'],
    myth: 'Their first ships were built from the doors of a flooded city, and every captain still carries one splinter of it.',
    t: [0.5, 0.6, 0.7, 0.4], anthem: 'sea shanty with accordion and stomping, rolling and bold', voice: 'gruff, sea-worn, a ship captain',
    leaders: ['Admiral Osric Kell', 'Tidemaster Yara Pell', 'Commodore Hesk Duran'], layouts: ['horizontal2', 'diagonal', 'horizontal3'], emblems: ['anchor', 'wave', 'star'] },
  { noun: 'Dominion', adj: '', government: 'theocracy', ideology: 'Light is order; the faithful will be made to see it.',
    culture: ['dawn processions', 'gilded shrines', 'fasting seasons', 'mirror-prayer'],
    myth: 'A shepherd stared at the sun until it spoke, and the first tower was raised where his shadow fell.',
    t: [0.7, 0.6, 0.3, 0.95], anthem: 'choral voices and bright trumpets, solemn and triumphant', voice: 'resonant, ceremonial, a priest',
    leaders: ['High Solarch Teodar', 'Matriarch Soleil Ravn', 'Prelate Imre Dusk'], layouts: ['cross', 'saltire', 'plain'], emblems: ['sun', 'flame', 'tower'] },
  { noun: 'Court', adj: '', government: 'conspiratorial court', ideology: 'Everything is a bargain, and every bargain has a second page.',
    culture: ['masked audiences', 'whispered treaties', 'night markets', 'candle-ciphers'],
    myth: 'The court was founded in a mine after the king died, and no one agrees on who first lit the lamp.',
    t: [0.6, 0.4, 0.5, 0.5], anthem: 'low strings, a sombre waltz and a distant bell', voice: 'quiet, silky, a spymaster',
    leaders: ['The Veiled Regent', 'Chancellor Isolde Marr', 'Lord Cassian Vey'], layouts: ['diagonal', 'canton', 'saltire'], emblems: ['eye', 'moon', 'skull'] },
  { noun: 'Horde', adj: '', government: 'war-band confederacy', ideology: 'Strength is the only honest treaty.',
    culture: ['drum-calls', 'horse-oaths', 'scar-tallies', 'feast-after-battle'],
    myth: 'Twelve exiled clans shared one fire through a winter, and the fire never went out.',
    t: [0.95, 0.85, 0.2, 0.35], anthem: 'war drums and throat-song, relentless and fierce', voice: 'booming, rough, a war chief',
    leaders: ['Warchief Brakka Dun', 'Khan Torvald Esk', 'Matron Ushi Karr'], layouts: ['vertical3', 'diagonal', 'horizontal2'], emblems: ['sword', 'skull', 'flame'] },
  { noun: 'Union', adj: '', government: 'technocratic council', ideology: 'Every problem is a machine waiting to be understood.',
    culture: ['guild-engineers', 'numbered streets', 'public workshops', 'patent-songs'],
    myth: 'The founders rebuilt a ruined clockwork tower and, when it struck noon, declared the hour belonged to everyone.',
    t: [0.35, 0.65, 0.75, 0.15], anthem: 'rhythmic percussion and synth pulses, precise and bright', voice: 'crisp, curious, a lecturer',
    leaders: ['Chair Odile Brandt', 'Architect Pavo Linn', 'Director Sela Quill'], layouts: ['border', 'horizontal3', 'canton'], emblems: ['gear', 'tower', 'star'] },
  { noun: 'Pact', adj: '', government: 'council of elders', ideology: 'What the mountain remembers, the people must not forget.',
    culture: ['stone-carved law', 'echo choirs', 'grain vaults', 'cairn pilgrimages'],
    myth: 'The elders sealed the first pact inside a cave and the echo of it has never faded.',
    t: [0.4, 0.35, 0.45, 0.7], anthem: 'deep horns and slow chanting, ancient and steady', voice: 'low, patient, a mountain guide',
    leaders: ['Eldest Gorm Halvar', 'Speaker Brenna Holt', 'Warden Ivo Stane'], layouts: ['plain', 'vertical2', 'cross'], emblems: ['mountain', 'moon', 'tower'] },
];

const FLAG_NEUTRALS = ['#f1ead2', '#1d1d24', '#16324f'];

function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

export function mockBible(opts: NewWorldOptions, seed: number): WorldBible {
  const rng = mulberry32(seed ^ 0xb1b1e);
  const n = Math.max(3, Math.min(10, Math.round(opts.nations ?? 6)));
  const text = `${opts.era ?? ''} ${opts.prompt}`;
  const kit = ERAS.find((e) => e.match.test(text)) ?? GENERIC;
  const aggression = clamp01(opts.aggression ?? 0.5);

  const worldName = `The ${pick(rng, PREFIX)} ${kit.name === 'Age of Beginnings' ? 'Age' : kit.name.replace(/^Age of /, '')}`;
  const colors = shuffled(rng, COLORS);
  const archs = shuffled(rng, ARCHETYPES);
  const places = shuffled(rng, kit.places);

  const nations: BibleNation[] = [];
  for (let i = 0; i < n; i++) {
    const a = archs[i % archs.length]!;
    const place = places[i % places.length]! + (i >= places.length ? ` ${pick(rng, ['Prime', 'Reach', 'Rise'])}` : '');
    const color = colors[i % colors.length]!;
    const [agg, exp, trade, faith] = a.t;
    const jit = () => (rng() - 0.5) * 0.2;
    const aggr = clamp01(agg * 0.5 + aggression * 0.5 + jit());
    const regionNames = shuffled(rng, PREFIX).slice(0, 4).map((p) => `${p} ${pick(rng, kit.features)}`);
    regionNames.unshift(`${place} ${pick(rng, kit.features)}`, `Old ${place}`);
    regionNames.push(`${pick(rng, PREFIX)} ${pick(rng, kit.features)}`);
    const flagColors = [color, pick(rng, FLAG_NEUTRALS), ...(rng() < 0.4 ? [pick(rng, COLORS)] : [])];
    nations.push({
      name: `The ${place} ${a.noun}`, adjective: place,
      color, leader: pick(rng, a.leaders), government: a.government, ideology: a.ideology,
      culture: a.culture.slice(0, 3 + Math.floor(rng() * 3)),
      foundingMyth: a.myth,
      temperament: { aggression: aggr, expansion: clamp01(exp + jit()), trade: clamp01(trade + jit()), faith: clamp01(faith + jit()) },
      anthemPrompt: `${a.anthem}, ${kit.tone} ${kit.key === 'generic' ? '' : 'flavour'}`.trim(),
      voiceStyle: a.voice,
      flag: {
        layout: pick(rng, a.layouts), colors: flagColors, emblem: pick(rng, a.emblems),
        emblemColor: flagColors[1] === FLAG_NEUTRALS[1] ? FLAG_NEUTRALS[0]! : FLAG_NEUTRALS[1]!,
      },
      regionNames,
    });
  }
  return { name: worldName, era: opts.era?.trim() || kit.name, startYear: kit.startYear + Math.floor(rng() * 40), nations };
}
