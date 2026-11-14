// The world bible written by Gemini (row A5): one call to the lore model at world creation, strictly
// validated and repaired, with the template bible (mockBible) as the fallback on any failure.
import type { BibleNation, FlagEmblem, FlagLayout, FlagSpec, WorldBible } from '@terra/shared';
import { llmJson, bibleModel, type Schema } from '../llm';
import type { NewWorldOptions } from '../runner';
import { mockBible } from './bible';

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
  },
};
const bibleSchema: Schema = {
  type: 'object',
  required: ['name', 'era', 'startYear', 'nations'],
  properties: {
    name: str('The world name'), era: str('The era, 2 to 4 words'),
    startYear: { type: 'integer', description: 'Calendar year the world starts at (negative for BCE)' },
    nations: { type: 'array', items: nationSchema },
  },
};

interface RawNation {
  name: string; adjective: string; color: string; leader: string; government: string; ideology: string;
  culture: string[]; foundingMyth: string; aggression: number; expansion: number; trade: number; faith: number;
  anthemPrompt: string; voiceStyle: string; flagLayout: FlagLayout; flagColors: string[]; flagEmblem: FlagEmblem; regionNames: string[];
}
interface RawBible { name: string; era: string; startYear: number; nations: RawNation[] }

const SYSTEM = [
  'You design the nations of a fictional world for a strategy simulation. Be vivid and specific, but compact:',
  'every text field is short. Nations must be clearly different from each other in culture, government and colour.',
  'Plain words, no markdown, no emojis. Reply with JSON only.',
].join(' ');

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
export function repairBible(raw: RawBible, fallback: WorldBible, n: number): WorldBible {
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
      color = PALETTE.find((p) => !usedColors.some((c) => dist(c, p) < 70)) ?? fb.color;
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
    });
  }
  if (!raw.name.trim()) throw new Error('bible has no name');
  return {
    name: clean(raw.name, 60), era: clean(raw.era, 40) || fallback.era,
    startYear: Number.isFinite(raw.startYear) ? Math.round(Math.max(-10000, Math.min(5000, raw.startYear))) : fallback.startYear,
    nations,
  };
}

/** Gemini writes the bible; on mock mode or any failure the template bible is returned instead. */
export async function makeBible(opts: NewWorldOptions, seed: number): Promise<WorldBible> {
  const fallback = mockBible(opts, seed); // also tells us the clamped nation count
  const n = fallback.nations.length;
  const t0 = Date.now();
  try {
    const aggr = opts.aggression ?? 0.5;
    const raw = await llmJson<RawBible>({
      model: bibleModel(), system: SYSTEM, purpose: 'bible', schema: bibleSchema,
      maxOutputTokens: Math.min(5000, 700 + 380 * n),
      prompt: [
        `World prompt from the user: "${opts.prompt.trim().slice(0, 500)}"`,
        opts.era ? `Era: ${opts.era}.` : 'Choose a fitting era.',
        `Write exactly ${n} nations. World aggression level ${aggr.toFixed(2)} of 1: higher means more warlike temperaments overall.`,
        'Give each nation a distinct hex colour (far apart in hue, bright enough to read on a dark globe),',
        'a different flag layout and emblem, 3 to 5 culture traits, temperaments 0 to 1, and 6 to 8 region names in its own culture\'s naming style.',
        'Flag colours: 2 to 4 hex colours, the first being the nation colour. Keep every text short.',
      ].join('\n'),
    });
    const bible = repairBible(raw, fallback, n);
    console.log(`bible written by ${bibleModel()} in ${Date.now() - t0} ms (${n} nations)`);
    return bible;
  } catch (e) {
    console.warn(`bible: using the template (${e instanceof Error ? e.message : String(e)})`);
    return fallback;
  }
}

/** For POST /api/world: pick the seed, write the bible. Row A4 awaits this before generateWorld(bible, { seed }). */
export async function prepareWorld(opts: NewWorldOptions): Promise<{ bible: WorldBible; seed: number }> {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  return { bible: await makeBible(opts, seed), seed };
}
