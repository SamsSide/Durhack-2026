// A19: a painted, weathered cloth version of a flag from the Gemini image model, cached on disk.
import { GoogleGenAI } from '@google/genai';
import type { FlagSpec } from '@terra/shared';
import { currentMode, imageCallCount, noteImageCall } from '../llm';

export const imageModel = () => process.env.GEMINI_MODEL_IMAGE || '';
const maxImages = () => {
  const n = Number(process.env.IMAGE_MAX_PER_RUN);
  return Number.isFinite(n) && n > 0 ? n : 12;
};
export const imageLive = () => currentMode() === 'live' && !!imageModel() && !!process.env.GEMINI_API_KEY;

const PALETTE: [string, number, number, number][] = [
  ['black', 20, 20, 20], ['charcoal grey', 70, 70, 75], ['grey', 128, 128, 128], ['white', 245, 245, 240],
  ['cream', 235, 225, 190], ['red', 200, 40, 40], ['crimson', 150, 25, 45], ['rust orange', 200, 85, 60],
  ['orange', 235, 140, 40], ['gold', 215, 165, 45], ['yellow', 240, 220, 70], ['olive green', 110, 120, 50],
  ['green', 60, 150, 70], ['forest green', 30, 80, 45], ['teal', 40, 140, 140], ['sky blue', 90, 160, 220],
  ['blue', 50, 100, 190], ['navy blue', 22, 50, 80], ['purple', 125, 80, 190], ['deep violet', 40, 25, 70],
  ['pink', 230, 130, 170], ['brown', 120, 75, 40],
];
export function colourName(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'grey';
  const n = parseInt(m[1]!, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  let best = PALETTE[0]!, bd = Infinity;
  for (const p of PALETTE) {
    const d = (p[1] - r) ** 2 + (p[2] - g) ** 2 + (p[3] - b) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best[0];
}

const LAYOUT: Record<FlagSpec['layout'], (c: string[]) => string> = {
  plain: (c) => `a single plain field of ${c[0]}`,
  horizontal2: (c) => `two equal horizontal bands, ${c[0]} on top and ${c[1]} below`,
  horizontal3: (c) => `three equal horizontal bands: ${c[0]}, ${c[1]}, ${c[2]} from top to bottom`,
  vertical2: (c) => `two equal vertical bands, ${c[0]} at the hoist and ${c[1]} at the fly`,
  vertical3: (c) => `three equal vertical bands: ${c[0]}, ${c[1]}, ${c[2]} from left to right`,
  cross: (c) => `a ${c[0]} field with an off-centre Nordic-style cross in ${c[1]}`,
  saltire: (c) => `a ${c[0]} field with a diagonal saltire (X) in ${c[1]}`,
  canton: (c) => `a ${c[0]} field with a rectangular canton in ${c[1]} in the top-left corner${c[2] ? ` and a thin ${c[2]} stripe beneath it` : ''}`,
  diagonal: (c) => `a field split diagonally from the top-left corner: ${c[0]} and ${c[1]}${c[2] ? `, with ${c[2]} in the lower corner` : ''}`,
  border: (c) => `a ${c[0]} border around a ${c[1]} field`,
};
const EMBLEM: Record<FlagSpec['emblem'], string> = {
  none: '', star: 'a five-pointed star', sun: 'a sun with eight rays', moon: 'a crescent moon', tree: 'a pine tree',
  tower: 'a crenellated tower', wave: 'two wavy lines of water', mountain: 'a jagged mountain', sword: 'an upright sword',
  gear: 'a cog wheel', eye: 'an open eye', crown: 'a three-point crown', anchor: 'a ship anchor', flame: 'a flame',
  wheat: 'a stalk of wheat', skull: 'a skull',
};

export function flagPrompt(spec: FlagSpec): string {
  const colours = spec.colors.map(colourName);
  const emblem = EMBLEM[spec.emblem];
  return [
    'A painted flag of a fictional nation, hand-painted on rough woven cloth, slightly weathered and sun-faded,',
    'with soft fabric folds and visible brush strokes. Shown flat and front-on, filling most of the frame,',
    'resting on a plain aged parchment background.',
    `Design: ${LAYOUT[spec.layout](colours)}.`,
    emblem ? `Centred emblem: ${emblem} painted in ${colourName(spec.emblemColor)}.` : 'No emblem.',
    'Keep the design simple and exactly as described. No text, no letters, no writing, no border frame, no people.',
  ].join(' ');
}

let client: GoogleGenAI | null = null;

/** One image from the Gemini image model as PNG bytes; throws on cap, off, or any failure. */
export async function paintFlag(spec: FlagSpec): Promise<Buffer> {
  if (!imageLive()) throw new Error('image generation off');
  if (imageCallCount() >= maxImages()) throw new Error('image cap reached');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  noteImageCall();
  const res = await client.models.generateContent({
    model: imageModel(),
    contents: flagPrompt(spec),
    config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:2' } },
  });
  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error('no image in response');
  return Buffer.from(part.inlineData.data, 'base64');
}
