// Gemini-written lore (X3), cached per nation and region, with the template as the fallback.
import { relationOf, type World } from '@terra/shared';
import { llmJson, loreModel, LlmUnavailable, type Schema } from '../llm';
import type { WorldRunner } from '../runner';
import {
  chronicleOf, countryLore, regionHistory, regionLore,
  type CountryLore, type RegionLore, type RelationLore,
} from './lore';

const STALE_TICKS = 60;
const RETRY_AFTER_MS = 30_000;

const SYSTEM = [
  'You are the chronicler of a fictional world of rival nations. Write short, vivid, grounded lore.',
  'Use ONLY the facts given. For history, relations and anthem events, use only what the chronicle',
  'says happened; never invent wars, battles, alliances or deaths that are not listed.',
  'Plain words, no markdown, no emojis. Reply with JSON only.',
].join(' ');

const countrySchema: Schema = {
  type: 'object',
  required: ['summary', 'culture', 'politics', 'history', 'anthemLyrics', 'relations'],
  properties: {
    summary: { type: 'string', description: 'Two sentences on who they are now.' },
    culture: { type: 'string', description: 'A short paragraph: customs, faith, food, pride.' },
    politics: { type: 'string', description: 'A short paragraph: who rules, ideology, factions.' },
    history: { type: 'string', description: 'A short paragraph built only from the real chronicle.' },
    anthemLyrics: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'string' }, description: 'Short anthem lines.' },
    relations: {
      type: 'array',
      items: {
        type: 'object', required: ['with', 'stance', 'story'],
        properties: { with: { type: 'integer' }, stance: { type: 'string' }, story: { type: 'string' } },
      },
    },
  },
};
const regionSchema: Schema = {
  type: 'object', required: ['summary', 'history'],
  properties: { summary: { type: 'string' }, history: { type: 'string' } },
};

type CountryGen = Pick<CountryLore, 'summary' | 'culture' | 'politics' | 'history' | 'anthemLyrics'> & { relations: { with: number; stance: string; story: string }[] };

export function countryPrompt(world: World, id: number): string {
  const c = world.countries[id]!;
  const t = c.temperament;
  const provinces = world.owner.filter((o) => o === id).length;
  const regions = [...new Set(world.regions.filter((r) => r.name && world.owner[r.capitalTile] === id).map((r) => r.name))].slice(0, 6);
  const chron = chronicleOf(world, id, 25).map((e) => `- year ${e.year}: ${e.text}`).join('\n') || '- (nothing recorded yet)';
  const rels = world.countries
    .filter((o) => o.id !== id)
    .map((o) => ({ o, r: relationOf(world, id, o.id) }))
    .filter(({ r }) => r.stance !== 'neutral')
    .map(({ o, r }) => `- id ${o.id} ${o.name}: ${r.stance}`).join('\n') || '- none';
  return [
    `Nation: ${c.name} (${c.adjective}), a ${c.government}, led by ${c.leader}. ${c.alive ? 'Alive' : 'Fallen'}.`,
    `Ideology: ${c.ideology}`,
    `Culture traits: ${c.culture.join(', ')}.`,
    `Founding myth: ${c.foundingMyth}`,
    `Temperament (0-1): aggression ${t.aggression}, expansion ${t.expansion}, trade ${t.trade}, faith ${t.faith}.`,
    `Holds ${provinces} provinces and ${c.population} people. Regions: ${regions.join(', ') || 'none named'}.`,
    `Current year ${world.year}.`,
    `Relations with neighbours:\n${rels}`,
    `Real chronicle (oldest first):\n${chron}`,
    'Write: summary (2 sentences), culture, politics, history (from the chronicle only), anthemLyrics',
    '(4 to 8 short lines from the founding myth and the real chronicle: its wars, losses, allies),',
    'and relations (one entry per neighbour listed above: with = its id, stance = as listed, story = 1 or 2 sentences',
    'on what really happened between them). Keep the whole reply under 450 words.',
  ].join('\n');
}

function regionPrompt(world: World, id: number): string {
  const r = world.regions[id]!;
  const owner = world.countries[world.owner[r.capitalTile] ?? -1];
  return [
    `Region: ${r.name} (${r.tiles.length} provinces, unrest ${r.unrest.toFixed(2)} of 1).`,
    `Ruled by: ${owner ? `${owner.name}, a ${owner.government}` : 'nobody'}.`,
    `Chronicle mentions:\n${regionHistory(world, id) || '(none yet)'}`,
    'Write summary (2 sentences) and history (only what the chronicle mentions; if nothing, say it is quiet).',
  ].join('\n');
}

// --- cache -------------------------------------------------------------------
interface Entry<T> { world: string; value: T; failedAt?: number }
const countryCache = new Map<number, Entry<CountryLore>>();
const regionCache = new Map<number, Entry<RegionLore>>();
const inflight = new Map<string, Promise<unknown>>();
const failedAt = new Map<string, number>();

export function resetLoreCache(): void {
  countryCache.clear(); regionCache.clear(); inflight.clear(); failedAt.clear();
}

let runner: WorldRunner | null = null;
/** Index.ts hands over the runner; a new world clears the cache. */
export function bindLore(r: WorldRunner): void {
  runner = r;
  r.subscribe({ snapshot: () => resetLoreCache() });
}

async function cached<T extends { asOfTick?: number }>(
  key: string, store: Map<number, Entry<T>>, id: number, world: World,
  tickOf: (v: T) => number, make: () => Promise<T>,
): Promise<T> {
  const hit = store.get(id);
  const fresh = hit && hit.world === world.id && Math.abs(world.tick - tickOf(hit.value)) <= STALE_TICKS;
  if (fresh) return hit.value;
  const usable = hit && hit.world === world.id ? hit.value : null;
  if (usable && Date.now() - (failedAt.get(key) ?? 0) < RETRY_AFTER_MS) return usable;
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = make().then((v) => { store.set(id, { world: world.id, value: v }); failedAt.delete(key); return v; })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  try { return await p; } catch { failedAt.set(key, Date.now()); return usable as T; }
}

async function generateCountry(world: World, id: number): Promise<CountryLore> {
  const gen = await llmJson<CountryGen>({
    model: loreModel(), system: SYSTEM, prompt: countryPrompt(world, id), schema: countrySchema,
    maxOutputTokens: 900, purpose: 'lore',
  });
  const base = countryLore(world, id)!;
  // The real stance wins over whatever the model wrote; unknown ids are dropped.
  const relations: RelationLore[] = [];
  for (const r of gen.relations) {
    if (r.with === id || !world.countries[r.with]) continue;
    relations.push({ with: r.with, stance: relationOf(world, id, r.with).stance, story: r.story });
  }
  const lyrics = gen.anthemLyrics.map((l) => l.trim()).filter(Boolean).slice(0, 8);
  if (lyrics.length < 4) throw new Error('too few anthem lines');
  return {
    countryId: id, asOfTick: world.tick,
    summary: gen.summary, culture: gen.culture, politics: gen.politics, history: gen.history,
    anthemLyrics: lyrics,
    relations: relations.length ? relations : base.relations,
  };
}

/** The lore for one nation: Gemini when live, the template otherwise or on any failure. */
export async function getLore(countryId: number, worldArg?: World): Promise<CountryLore | null> {
  const world = worldArg ?? runner?.getWorld();
  if (!world || !world.countries[countryId]) return null;
  const template = () => countryLore(world, countryId);
  try {
    const out = await cached(`c${countryId}`, countryCache, countryId, world, (v) => v.asOfTick, () => generateCountry(world, countryId));
    return out ?? template();
  } catch (e) {
    if (!(e instanceof LlmUnavailable)) console.warn('lore failed:', e instanceof Error ? e.message : e);
    return template();
  }
}

export async function getRegionLore(regionId: number, worldArg?: World): Promise<RegionLore | null> {
  const world = worldArg ?? runner?.getWorld();
  if (!world) return null;
  const base = regionLore(world, regionId);
  if (!base || !world.regions[regionId]?.name) return base; // unnamed regions have nothing to write about
  const wrap: RegionLore & { asOfTick: number } = { ...base, asOfTick: world.tick };
  try {
    const out = await cached(`r${regionId}`, regionCache as Map<number, Entry<typeof wrap>>, regionId, world, (v) => v.asOfTick, async () => {
      const gen = await llmJson<{ summary: string; history: string }>({
        model: loreModel(), system: SYSTEM, prompt: regionPrompt(world, regionId), schema: regionSchema,
        maxOutputTokens: 300, purpose: 'region-lore',
      });
      return { ...base, summary: gen.summary, history: gen.history, asOfTick: world.tick };
    });
    if (!out) return base;
    const { asOfTick: _t, ...rest } = out;
    return { ...rest, owner: base.owner, name: base.name };
  } catch {
    return base;
  }
}
