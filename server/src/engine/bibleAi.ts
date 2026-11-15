// The world bible written by Gemini (row A5): one call to the lore model at world creation, strictly
// validated and repaired, with the template bible (mockBible) as the fallback on any failure.
import { BUILDING_STYLES, clampStartYear, diversifyStyles, isBuildingStyle, isNomadic, pickBuildingStyle } from '@terra/shared';
import { fitStyles, mergeShape, settingOf, shapeFromText, type Setting } from './promptShape';
import type { BibleNation, FlagEmblem, FlagLayout, FlagSpec, WorldBible } from '@terra/shared';
import { llmJson, bibleModel, currentMode, type Schema } from '../llm';
import { createHash } from 'node:crypto';
import type { NewWorldOptions } from '../runner';
import { mockBible } from './bible';
import { FLAG_PROMPT, governmentKeyOf, steerFlag, worldEraKey } from '../story/identity';

/** The sync template bible, re-exported for clarity: the fallback for makeBible. */
export const bibleFallback = mockBible;

const LAYOUTS: FlagLayout[] = ['plain', 'horizontal2', 'horizontal3', 'vertical2', 'vertical3', 'cross', 'saltire', 'canton', 'diagonal', 'border'];
const EMBLEMS: FlagEmblem[] = ['none', 'star', 'sun', 'moon', 'tree', 'tower', 'wave', 'mountain', 'sword', 'gear', 'eye', 'crown', 'anchor', 'flame', 'wheat', 'skull'];
const PALETTE = ['#e0533d', '#3fa95f', '#3d86e0', '#e0b030', '#a768d6', '#35c4b5', '#e07ab0', '#f08a3c', '#9bc43a', '#8fa3ff'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const str = (description: string): Schema => ({ type: 'string', description });
const nationSchema: Schema = {
  type: 'object',
  required: ['name', 'adjective', 'color', 'leader', 'government', 'ideology', 'culture', 'foundingMyth', 'aggression', 'expansion', 'trade', 'faith', 'anthemPrompt', 'voiceStyle', 'flagLayout', 'flagColors', 'flagEmblem', 'regionNames'],
  properties: {
    name: str('Full name, e.g. "The Ashen Concord"'),
    adjective: str('One word, e.g. "Ashen"'),
    color: str('Hex colour like #c8553d, bright enough for a dark globe, different from every other nation'),
    leader: str('Name and title'),
    government: str('2 to 4 words'),
    ideology: str('One short sentence'),
    culture: { type: 'array', items: str('2 to 3 word trait'), description: '3 to 5 traits' },
    foundingMyth: str('One or two short sentences'),
    aggression: { type: 'number', description: '0 to 1' },
    expansion: { type: 'number', description: '0 to 1' },
    trade: { type: 'number', description: '0 to 1' },
    faith: { type: 'number', description: '0 to 1' },
    anthemPrompt: str('Instruments, tempo and mood for a music model, under 20 words'),
    voiceStyle: str('The narrator voice, under 8 words'),
    flagLayout: { type: 'string', enum: LAYOUTS },
    flagColors: { type: 'array', items: str('hex colour'), description: '2 to 4 hex colours' },
    flagEmblem: { type: 'string', enum: EMBLEMS },
    regionNames: { type: 'array', items: str('place name'), description: '6 to 8 region names in this culture\'s style' },
    buildingStyle: { type: 'string', enum: [...BUILDING_STYLES], description: 'Architecture that fits the era and climate: scrap after an apocalypse; industrial, western_modern or soviet_bloc for steam, clockwork and modern worlds; arcology for the far future; else from the culture and land (samurai east_asian, pharaoh egyptian, caravan desert, Inca or jungle mesoamerican, senate classical, feudal medieval, jarl or ice norse, mountain highland, raja south_asian, griot sahel). At most 2 nations per style.' },
    nomadic: { type: 'boolean', description: 'Herders, horse lords, steppe or caravan people' },
  },
};
const shapeSchema: Schema = {
  type: 'object',
  required: ['seaLevel', 'landmasses', 'climate', 'dryness', 'forest', 'mountains'],
  description: 'The planet itself, as the prompt (or the picture) describes it',
  properties: {
    seaLevel: { type: 'number', description: 'Share of the surface that is ocean: 0.35 a dry or land-heavy world, 0.55 Earth-like, 0.75 drowned or all islands' },
    landmasses: { type: 'string', enum: ['one', 'few', 'many'], description: 'one supercontinent, a few continents, or many islands (an archipelago)' },
    climate: { type: 'string', enum: ['cold', 'temperate', 'hot'], description: 'cold for frozen, arctic or ice worlds; hot for desert, jungle or scorched worlds' },
    dryness: { type: 'number', description: '0 (rainforest, swamp) to 1 (desert); 0.5 is Earth-like' },
    forest: { type: 'number', description: '0 (bare) to 1 (jungle or deep woods); 0.5 is Earth-like' },
    mountains: { type: 'number', description: '0 (flat) to 1 (very rugged); 0.5 is Earth-like' },
  },
};
const bibleSchema: Schema = {
  type: 'object',
  required: ['name', 'era', 'startYear', 'shape', 'nations'],
  properties: {
    name: str('The world name'), era: str('The era, 2 to 4 words'),
    startYear: { type: 'integer', description: 'Calendar year the world starts at (negative for BCE)' },
    shape: shapeSchema,
    nations: { type: 'array', items: nationSchema },
  },
};
const imageReadingSchema: Schema = {
  type: 'object',
  required: ['subject', 'mood', 'palette', 'setting'],
  description: 'What the picture shows',
  properties: {
    subject: str('What is in the picture, one plain sentence naming the main things you can see'),
    mood: str('The mood of the picture, 2 to 6 words'),
    palette: { type: 'array', items: str('hex colour'), description: '3 to 6 dominant hex colours of the picture' },
    setting: str('The setting and era the picture suggests, under 12 words'),
    seaLevelHint: { type: 'number', description: '0.3 (mostly land) to 0.75 (mostly ocean), how watery the scene feels' },
  },
};
const imageBibleSchema: Schema = {
  ...(bibleSchema as Extract<Schema, { type: 'object' }>),
  required: ['name', 'era', 'startYear', 'shape', 'nations', 'imageReading'],
  properties: { ...(bibleSchema as Extract<Schema, { type: 'object' }>).properties, imageReading: imageReadingSchema },
};

export interface ImageReading { mood: string; palette: string[]; setting: string; seaLevelHint?: number; subject?: string }
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Validates an uploaded picture (JPEG, PNG or WebP, under about 4 MB decoded); null if unsupported. */
export function parseImage(input: unknown): { data: string; mimeType: string } | null {
  if (typeof input !== 'string' || !input) return null;
  const m = /^data:([\w/+.-]+);base64,/.exec(input);
  const data = (m ? input.slice(m[0].length) : input).replace(/\s+/g, '');
  if (!data || data.length > MAX_IMAGE_BYTES * 1.4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const buf = Buffer.from(data, 'base64');
  if (buf.length < 12 || buf.length > MAX_IMAGE_BYTES) return null;
  let mimeType: string | null = null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) mimeType = 'image/jpeg';
  else if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) mimeType = 'image/png';
  else if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') mimeType = 'image/webp';
  return mimeType ? { data, mimeType } : null;
}

/** Mock mode: a deterministic palette from the picture's bytes, so colours visibly change without API calls. */
function hashPalette(data: string, n: number): string[] {
  const h = createHash('sha256').update(data).digest();
  const base = (h[0]! / 255) * 360;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const hue = (base + (i * 360) / n + (h[1 + i]! % 20)) % 360;
    const s = 0.6 + (h[10 + i]! % 30) / 100, l = 0.55;
    const f = (k: number) => { const a = s * Math.min(l, 1 - l); const kk = (k + hue / 30) % 12; return l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)); };
    out.push('#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''));
  }
  return out;
}

interface RawNation {
  name: string; adjective: string; color: string; leader: string; government: string; ideology: string;
  culture: string[]; foundingMyth: string; aggression: number; expansion: number; trade: number; faith: number;
  anthemPrompt: string; voiceStyle: string; flagLayout: FlagLayout; flagColors: string[]; flagEmblem: FlagEmblem; regionNames: string[]; buildingStyle?: string; nomadic?: boolean;
}
interface RawBible { name: string; era: string; startYear: number; shape?: unknown; nations: RawNation[]; imageReading?: ImageReading }
/** What the words of the prompt say on their own (promptShape.ts), used to check the model's bible. */
export interface PromptFacts { opts: { prompt: string; era?: string }; seed: number; seaHint?: number }

const SYSTEM = [
  'You design the nations of a fictional world for a strategy simulation. Be vivid and specific, but compact:',
  'every text field is short. Nations must be clearly different from each other in culture, government and colour.',
  'Plain words, no markdown, no emojis. Reply with JSON only.',
].join(' ');

// Durham and North East seasoning, passed compactly so Gemini weaves it into the world's own flavour.
const LOCAL_NAMES = 'Hatfield, Collingwood, Grey, St Aidan, St Chad, St Cuthbert, Hild Bede, Stephenson, Trevelyan, Ustinov, Van Mildert, Josephine Butler, John Snow, '
  + 'Elvet, Framwellgate, Gilesgate, Claypath, Neville\'s Cross, Palace Green, Prebends, Kingsgate, Houghall, Shincliffe, Pity Me, Belmont, Sherburn, Bowburn, '
  + 'Wear, Tyne, Tees, Prince Bishops, Cuthbert, Bede, Miners\' Gala, Spennymoor, Newcastle, Gateshead, Sunderland, Chester-le-Street, Bishop Auckland, Barnard Castle, '
  + 'Darlington, Hartlepool, Middlesbrough, Consett, Stanley, Seaham, Peterlee, Crook, Ferryhill, Brancepeth, Lanchester, Sedgefield, Coxhoe, Beamish, Penshaw, '
  + 'Lindisfarne, Hexham, Tynemouth, Whitley Bay, Alnwick, Bamburgh, Hadrian\'s Wall, Angel of the North';
const LOCAL_INSTRUCTION = `Durham flavour (required): the world is a playful nod to Durham and the North East of England. Draw at least half of every nation's region names, and some nation names, leader surnames and places, from these real names: ${LOCAL_NAMES}. `
  + 'Adapt them to the world\'s era and culture and blend them with invented names so the world still reads as its own '
  + '(e.g. "The Hatfield Concord", "Elvet Marches", "the Spennymoor Reach", "Prince-Bishopric of the Wear", "Old Framwellgate", "Van Mildert Isles", "High Speaker Cuthbert Brancepeth"). '
  + 'Never use a real modern institution verbatim as a nation (not "St Mary\'s College"; but "the Marian Sisterhood of St Mary\'s Reach" is fine). Always adapt a name (add a title, a landform, an old or new form) rather than using it bare, and never use a real person\'s full name as a leader. Do not mention Durham or England by name.';

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5);
const clean = (s: string, max: number): string => s.replace(/\s+/g, ' ').trim().slice(0, max);

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
const luma = (hex: string): number => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const dist = (a: string, b: string): number => {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};
/** Readable on a dark globe: not too dark, not washed out to white. */
const readable = (hex: string): boolean => HEX.test(hex) && luma(hex) >= 70 && luma(hex) <= 235;

/** Turns what Gemini wrote into a WorldBible that is safe to build a world from. Throws if unusable. */
export function repairBible(raw: RawBible, fallback: WorldBible, n: number, extraPalette: string[] = [], facts?: PromptFacts): WorldBible {
  const usedNames = new Set<string>();
  const usedColors: string[] = [];
  const nations: BibleNation[] = [];

  for (let i = 0; i < n; i++) {
    const fb = fallback.nations[i % fallback.nations.length]!;
    const r = raw.nations[i];
    const name = r ? clean(r.name, 60) : '';
    if (!r || !name || usedNames.has(name.toLowerCase())) { nations.push(fb); usedNames.add(fb.name.toLowerCase()); usedColors.push(fb.color); continue; }
    usedNames.add(name.toLowerCase());

    let color = r.color.trim().toLowerCase();
    if (!readable(color) || usedColors.some((c) => dist(c, color) < 70)) {
      color = [...extraPalette, ...PALETTE].find((p) => !usedColors.some((c) => dist(c, p) < 70)) ?? fb.color;
    }
    usedColors.push(color);

    const culture = r.culture.map((c) => clean(c, 40)).filter(Boolean).slice(0, 5);
    for (const c of fb.culture) if (culture.length < 3 && !culture.includes(c)) culture.push(c);

    let flagColors = r.flagColors.map((c) => c.trim().toLowerCase()).filter((c) => HEX.test(c)).slice(0, 4);
    if (flagColors.length < 2) flagColors = [color, ...fb.flag.colors.slice(1)].slice(0, 4);
    flagColors[0] = color; // the first flag colour is always the nation colour, so the flag matches the map
    const neutrals = ['#f1ead2', '#1d1d24'];
    const emblemColor = flagColors[1] && luma(flagColors[1]) > 128 ? neutrals[1]! : neutrals[0]!;
    const flag: FlagSpec = { layout: r.flagLayout, colors: flagColors, emblem: r.flagEmblem, emblemColor };

    const regionNames: string[] = [];
    for (const rn of r.regionNames.map((x) => clean(x, 40))) if (rn && !regionNames.includes(rn)) regionNames.push(rn);
    for (const rn of fb.regionNames) if (regionNames.length < 6 && !regionNames.includes(rn)) regionNames.push(rn);

    nations.push({
      name, adjective: clean(r.adjective, 24) || name,
      color, leader: clean(r.leader, 60) || fb.leader, government: clean(r.government, 50) || fb.government,
      ideology: clean(r.ideology, 160) || fb.ideology, culture, foundingMyth: clean(r.foundingMyth, 300) || fb.foundingMyth,
      temperament: { aggression: clamp01(r.aggression), expansion: clamp01(r.expansion), trade: clamp01(r.trade), faith: clamp01(r.faith) },
      anthemPrompt: clean(r.anthemPrompt, 160) || fb.anthemPrompt, voiceStyle: clean(r.voiceStyle, 60) || fb.voiceStyle,
      flag, regionNames: regionNames.slice(0, 8),
      buildingStyle: isBuildingStyle(r.buildingStyle) ? r.buildingStyle : undefined,
      nomadic: typeof r.nomadic === 'boolean' ? r.nomadic : undefined,
    });
  }
  // Flags (A24): steer layout and emblem to each nation's government and the era, at most two alike.
  const eraKey = worldEraKey({ era: `${raw.era ?? ''} ${fallback.era}`, prompt: raw.name ?? '', name: '' });
  const used = new Map<string, number>();
  nations.forEach((nat, i) => { nat.flag = steerFlag(nat.flag, governmentKeyOf({ ...nat, nomadic: nat.nomadic }), eraKey, used, i); });
  // Building styles (#91): Gemini's pick, else the rules; then at most two nations per style.
  const worldText = `${raw.era ?? ''} ${raw.name ?? ''} ${fallback.era}`;
  // The year, the age and the planet: the model's answer, checked against the words of the prompt (a
  // year the prompt names wins, a year outside the setting's span is pulled into it; the prompt's own
  // words win a shape field). Without the prompt (older callers) the model's year is only clamped.
  const promptText = facts ? `${facts.opts.era ?? ''} ${facts.opts.prompt}` : '';
  const setting: Setting | undefined = facts ? settingOf(facts.opts, facts.seed, { era: clean(raw.era ?? '', 40), startYear: raw.startYear }, fallback.startYear) : undefined;
  const picked = nations.map((n) => n.buildingStyle ?? pickBuildingStyle(worldText, n));
  const styles = setting?.kind ? fitStyles(picked, setting.kind, `${promptText} ${raw.era ?? ''}`) : diversifyStyles(picked);
  nations.forEach((n, i) => { n.buildingStyle = styles[i]; if (n.nomadic === undefined) n.nomadic = isNomadic(n); });
  if (!raw.name.trim()) throw new Error('bible has no name');
  const shape = facts ? mergeShape(shapeFromText(promptText), raw.shape, facts.seaHint) : undefined;
  return {
    name: clean(raw.name, 60), era: clean(raw.era, 40) || fallback.era,
    startYear: setting?.startYear ?? (Number.isFinite(raw.startYear) ? clampStartYear(raw.startYear) : fallback.startYear),
    nations,
    ...(setting ? { startAge: setting.startAge } : {}), ...(shape ? { shape } : {}),
  };
}

const IMAGE_INSTRUCTION = 'A picture is attached. First look at it and say what it shows (imageReading.subject: one plain sentence naming the main things you can see). Then let the picture drive the world: its name, the era and the start year its buildings, clothes or machines suggest, the planet (shape: snow means cold, sand means hot and dry, water means a high sea level and many islands, trees mean forest, peaks mean mountains), each nation\'s building style, the nations\' cultures and moods, colours (draw nation colours from the picture\'s palette, still distinct and readable on a dark globe), flags and region names. Where the words of the prompt and the picture disagree, the words win. Also fill imageReading: mood, palette (3 to 6 hex colours from the picture), setting, and seaLevelHint (0.3 to 0.75, how watery the scene feels).';

const WORLD_INSTRUCTION = 'The prompt must visibly shape the whole world, not only its names. '
  + 'startYear: if the prompt names a year or a century, use it; otherwise pick a year that fits the era: stone age 10000 to 4000 BC (negative numbers), bronze age 3000 to 1200 BC, classical 500 BC to 400, medieval 800 to 1400, age of sail 1500 to 1750, industrial, steam or clockwork 1800 to 1900, modern or cold war in the 1900s, near future 2040 to 2099, far future after 2150, post-apocalyptic a century or more after its fall (2150 to 2500). '
  + 'shape: the planet the prompt describes. A frozen world is cold; desert empires are hot, dry (dryness near 0.9), bare of forest and low in sea; a drowned world or an archipelago has a high sea level (0.7 or more) and many landmasses; jungle is hot, wet and forested (forest near 0.9); one great continent is landmasses "one" with a low sea level. Use 0.5 and "few" and "temperate" only where the prompt says nothing. '
  + 'Nations: governments, temperaments, cultures and building styles must fit the era and the land (no mud-brick towns in a clockwork age, no factories in a stone age); if the prompt names a kind of state (republics, tribes, city-states), most nations are that kind, each in its own way.';

function cleanReading(r: ImageReading | undefined): ImageReading | undefined {
  if (!r) return undefined;
  const palette = (r.palette ?? []).map((c) => c.trim().toLowerCase()).filter((c) => HEX.test(c)).slice(0, 6);
  const hint = typeof r.seaLevelHint === 'number' && Number.isFinite(r.seaLevelHint) ? Math.max(0.3, Math.min(0.75, r.seaLevelHint)) : undefined;
  return { mood: clean(r.mood ?? '', 60), palette, setting: clean(r.setting ?? '', 100), seaLevelHint: hint, subject: clean(r.subject ?? '', 200) || undefined };
}

/** One line in the first founding myth so the chronicle shows the picture shaped the world. */
function stampVision(bible: WorldBible, reading: ImageReading | undefined): void {
  const first = bible.nations[0];
  if (!first || !reading || !(reading.mood || reading.setting || reading.subject)) return;
  const vision = [reading.mood, reading.subject || reading.setting].filter(Boolean).map((x) => x!.replace(/[.\s]+$/, '')).join(': ');
  first.foundingMyth = `The world was shaped from a vision, ${vision}. ${first.foundingMyth}`.slice(0, 460);
}

/** Gemini writes the bible; on mock mode or any failure the template bible is returned instead.
 *  With a picture, the same call sees it (one call); if that fails, the text-only bible is tried. */
export async function makeBible(opts: NewWorldOptions, seed: number): Promise<WorldBible> {
  const fallback = mockBible(opts, seed); // also tells us the clamped nation count
  const n = fallback.nations.length;
  const image = parseImage(opts.imageBase64);
  const live = currentMode() === 'live';
  const aggr = opts.aggression ?? 0.5;

  lastBibleSource = 'template';
  if (image && !live) { // mock: ignore the picture but let its bytes pick the colours
    const pal = hashPalette(image.data, n);
    fallback.nations.forEach((nat, i) => { nat.color = pal[i]!; nat.flag.colors[0] = pal[i]!; });
    return fallback;
  }

  const ask = async (withImage: boolean): Promise<WorldBible> => {
    const t0 = Date.now();
    const model = withImage ? (process.env.GEMINI_MODEL_BIBLE_IMAGE || bibleModel()) : bibleModel();
    const raw = await llmJson<RawBible>({
      model, system: SYSTEM, purpose: withImage ? 'bible-image' : 'bible',
      schema: withImage ? imageBibleSchema : bibleSchema,
      maxOutputTokens: Math.min(5200, 800 + 380 * n + (withImage ? 400 : 0)),
      images: withImage ? [image!] : undefined,
      prompt: [
        `World prompt from the user: "${opts.prompt.trim().slice(0, 500)}"`,
        withImage ? IMAGE_INSTRUCTION : '',
        opts.era ? `Era: ${opts.era}.` : 'Choose a fitting era.',
        WORLD_INSTRUCTION,
        `Write exactly ${n} nations. World aggression level ${aggr.toFixed(2)} of 1: higher means more warlike temperaments overall.`,
        'Give each nation a distinct hex colour (far apart in hue, bright enough to read on a dark globe),',
        'a different flag layout and emblem, 3 to 5 culture traits, temperaments 0 to 1, and 6 to 8 region names in its own culture\'s naming style.',
        'Flag colours: 2 to 4 hex colours, the first being the nation colour. Keep every text short.',
        FLAG_PROMPT,
        'The anthemPrompt names instruments, tempo and mood that fit the nation\'s era and government (a hymn for a theocracy, a march for a junta or a people\'s state); never use the word anthem.',
        LOCAL_INSTRUCTION,
      ].filter(Boolean).join('\n'),
    });
    const reading = withImage ? cleanReading(raw.imageReading) : undefined;
    // The picture's sea level is the weakest voice: the prompt's words and the model's shape come first,
    // and the Create screen's slider, when moved, beats them all (chosenSeaLevel in worldgen).
    const bible = repairBible(raw, fallback, n, reading?.palette.filter(readable), { opts, seed, seaHint: reading?.seaLevelHint });
    if (withImage) {
      stampVision(bible, reading);
      console.log(`bible written by ${model} from a picture in ${Date.now() - t0} ms (${n} nations); reading: ${JSON.stringify(reading)}`);
      lastImageReading = reading;
    } else {
      console.log(`bible written by ${model} in ${Date.now() - t0} ms (${n} nations)`);
    }
    return bible;
  };

  for (const withImage of image ? [true, false] : [false]) {
    try { const bible = await ask(withImage); lastBibleSource = withImage ? 'model-picture' : 'model'; return bible; } catch (e) {
      console.warn(`bible${withImage ? ' (with picture)' : ''}: ${withImage ? 'trying text only' : 'using the template'} (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return fallback;
}

/** Who wrote the last bible, for the check scripts: the model, the model with the picture, or the template. */
export let lastBibleSource: 'model' | 'model-picture' | 'template' = 'template';

/** The last picture reading, for the live check script and logs. */
export let lastImageReading: ImageReading | undefined;

/** For POST /api/world: pick the seed, write the bible. Row A4 awaits this before generateWorld(bible, { seed }). */
export async function prepareWorld(opts: NewWorldOptions): Promise<{ bible: WorldBible; seed: number }> {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  return { bible: await makeBible(opts, seed), seed };
}
