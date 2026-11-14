// Gemini-written lore (X3), cached per nation and region, with the template as the fallback.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { relationOf, type World } from '@terra/shared';
import { llmJson, loreModel, LlmUnavailable, type Schema } from '../llm';
import type { WorldRunner } from '../runner';
import { warmChants } from './chant';
import { nationIdentity } from './identity';
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
  const idn = nationIdentity(world, c);
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
    `Voice: ${idn.chronicleTone} ${idn.narrationTone} Its anthem and words feel of the ${idn.eraKey.replace('_', ' ')} era. Use the voice for tone only, never to add facts.`,
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
    ...(owner ? [`Voice: ${nationIdentity(world, owner).chronicleTone} Tone only, never add facts.`] : []),
    `Chronicle mentions:\n${regionHistory(world, id) || '(none yet)'}`,
    'Write summary (2 sentences) and history (only what the chronicle mentions; if nothing, say it is quiet).',
  ].join('\n');
}

// --- disk store: every generated lore is kept per world so a replay can reuse it -------
const LORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache', 'lore');
const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');
const dirOf = (worldId: string) => path.join(LORE_DIR, safeId(worldId));

/** Writes `<kind>-<id>-t<tick>.json` (kept per version) and `<kind>-<id>.json` (the newest). */
function saveLore(worldId: string, kind: 'country' | 'region', id: number, value: { asOfTick: number }): void {
  try {
    const dir = dirOf(worldId);
    fs.mkdirSync(dir, { recursive: true });
    const body = JSON.stringify(value);
    for (const name of [`${kind}-${id}-t${value.asOfTick}.json`, `${kind}-${id}.json`]) {
      const file = path.join(dir, name);
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, body);
      fs.renameSync(tmp, file);
    }
  } catch (e) {
    console.warn('could not save lore:', e instanceof Error ? e.message : e);
  }
}

/** All stored versions of one nation's or region's lore for a world, oldest first. */
function loadVersions<T extends { asOfTick: number }>(worldId: string, kind: 'country' | 'region', id: number): T[] {
  const out: T[] = [];
  try {
    const re = new RegExp(`^${kind}-${id}-t\\d+\\.json$`);
    for (const f of fs.readdirSync(dirOf(worldId))) {
      if (!re.test(f)) continue;
      try {
        const v = JSON.parse(fs.readFileSync(path.join(dirOf(worldId), f), 'utf8')) as T;
        if (typeof v.asOfTick === 'number') out.push(v);
      } catch { /* a half-written or corrupt file is skipped */ }
    }
  } catch { /* no directory yet */ }
  return out.sort((a, b) => a.asOfTick - b.asOfTick);
}

/** Newest stored version at or before the tick (playback), or null. */
function storedAtOrBefore<T extends { asOfTick: number }>(worldId: string, kind: 'country' | 'region', id: number, tick: number): T | null {
  const vs = loadVersions<T>(worldId, kind, id).filter((v) => v.asOfTick <= tick);
  return vs.length ? vs[vs.length - 1]! : null;
}

/** Stored version within the refresh window of the tick (live play), or null. */
function storedFresh<T extends { asOfTick: number }>(worldId: string, kind: 'country' | 'region', id: number, tick: number): T | null {
  const vs = loadVersions<T>(worldId, kind, id).filter((v) => Math.abs(tick - v.asOfTick) <= STALE_TICKS);
  return vs.length ? vs[vs.length - 1]! : null;
}

const playing = () => runner?.playback?.() === true;

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
  let warmedWorld = '';
  r.subscribe({
    snapshot: (w) => {
      resetLoreCache();
      // Once per new world, a few seconds after it starts: make the chants of the likeliest first fighters.
      if (w.id === warmedWorld) return;
      warmedWorld = w.id;
      setTimeout(() => {
        const now = runner?.getWorld();
        if (now && now.id === w.id) void warmChants(now).catch(() => undefined);
      }, 5000).unref?.();
    },
  });
}

/** Row A31: true once Gemini's lore for this nation in this world is in the cache (not the template). */
export function hasAiLore(countryId: number, worldId: string): boolean {
  return countryCache.get(countryId)?.world === worldId;
}

async function cached<T extends { asOfTick?: number }>(
  key: string, store: Map<number, Entry<T>>, id: number, world: World,
  tickOf: (v: T) => number, make: () => Promise<T>, kind: 'country' | 'region',
): Promise<T> {
  const hit = store.get(id);
  const fresh = hit && hit.world === world.id && Math.abs(world.tick - tickOf(hit.value)) <= STALE_TICKS;
  if (fresh) return hit.value;
  const usable = hit && hit.world === world.id ? hit.value : null;
  if (usable && Date.now() - (failedAt.get(key) ?? 0) < RETRY_AFTER_MS) return usable;
  const onDisk = storedFresh<T & { asOfTick: number }>(world.id, kind, id, world.tick);
  if (onDisk) { store.set(id, { world: world.id, value: onDisk }); return onDisk; }
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = make().then((v) => {
      store.set(id, { world: world.id, value: v }); failedAt.delete(key);
      saveLore(world.id, kind, id, v as T & { asOfTick: number });
      return v;
    })
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
  if (playing()) return storedAtOrBefore<CountryLore & { asOfTick: number }>(world.id, 'country', countryId, world.tick) ?? template();
  try {
    const out = await cached(`c${countryId}`, countryCache, countryId, world, (v) => v.asOfTick, () => generateCountry(world, countryId), 'country');
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
  if (playing()) {
    const st = storedAtOrBefore<RegionLore & { asOfTick: number }>(world.id, 'region', regionId, world.tick);
    if (!st) return base;
    const { asOfTick: _s, ...rest } = st;
    return { ...rest, owner: base.owner, name: base.name };
  }
  const wrap: RegionLore & { asOfTick: number } = { ...base, asOfTick: world.tick };
  try {
    const out = await cached(`r${regionId}`, regionCache as Map<number, Entry<typeof wrap>>, regionId, world, (v) => v.asOfTick, async () => {
      const gen = await llmJson<{ summary: string; history: string }>({
        model: loreModel(), system: SYSTEM, prompt: regionPrompt(world, regionId), schema: regionSchema,
        maxOutputTokens: 300, purpose: 'region-lore',
      });
      return { ...base, summary: gen.summary, history: gen.history, asOfTick: world.tick };
    }, 'region');
    if (!out) return base;
    const { asOfTick: _t, ...rest } = out;
    return { ...rest, owner: base.owner, name: base.name };
  } catch {
    return base;
  }
}
