// Decrees (row A20): a typed or spoken line from the human becomes a decree with an effect on the
// world. Two halves. Interpreting (live: one small Gemini call, or for a spoken decree one call that
// hears the audio and does both; mock: a keyword matcher) gives { text, effect, target }. Applying
// (decreeEvents) turns that into ordinary X1 world events with actor 'decree', delivered through the bus
// like the resilience events, so every replica applies the same events and stays identical. The
// events are a pure function of (world, decree, tick): the dice are seeded from them.
import {
  countryTiles, hashString, mulberry32, regionOwner,
  type Country, type Rng, type Structure, type StructureKind, type World, type WorldEvent,
} from '@terra/shared';
import { currentMode, llmJson, rulerModel, type Schema } from '../llm';

export const EFFECTS = ['plague', 'famine', 'storm', 'meteor', 'prophet', 'goldrush', 'rebellion', 'flood', 'none'] as const;
export type DecreeEffect = (typeof EFFECTS)[number];
export interface DecreeTarget { countryId?: number; regionId?: number; tile?: number }
export interface Decree { text: string; effect: DecreeEffect; target: DecreeTarget }

/** What the runner offers the voice route: apply an already interpreted decree. */
export interface DecreeRunner { applyDecree(decree: Decree): void }

export const MOCK_VOICE_TRANSCRIPT = 'A plague sweeps the southern coast';

const DIRECTIONS: Record<string, [number, number, number]> = {
  south: [0, -1, 0], north: [0, 1, 0], east: [1, 0, 0], west: [-1, 0, 0],
};

// --- the world, as the decree sees it --------------------------------------------------------

const alive = (w: World, id: number | undefined): id is number => id !== undefined && !!w.countries[id]?.alive;
const aliveIds = (w: World): number[] => w.countries.filter((c) => c.alive).map((c) => c.id);
const coastTiles = (w: World, id: number): number => countryTiles(w, id).filter((t) => w.tiles[t]!.terrain === 'coast').length;

/** The region whose capital lies furthest in `dir`, among regions held by a living nation (and by
 *  `only` when given). */
function regionInDirection(w: World, dir: string, only?: number): number | undefined {
  const v = DIRECTIONS[dir];
  if (!v) return undefined;
  let best: number | undefined; let bestScore = -Infinity;
  for (const r of w.regions) {
    const owner = regionOwner(w, r.id);
    if (!alive(w, owner) || (only !== undefined && owner !== only)) continue;
    const c = w.tiles[r.capitalTile]!.center;
    const s = c[0] * v[0] + c[1] * v[1] + c[2] * v[2];
    if (s > bestScore) { bestScore = s; best = r.id; }
  }
  return best;
}

/** The nation that fits an effect best when the words name none. Deterministic. */
function fittingCountry(w: World, effect: DecreeEffect, rng: Rng): number | undefined {
  const ids = aliveIds(w);
  if (!ids.length) return undefined;
  const score = (id: number): number => {
    const c = w.countries[id]!;
    switch (effect) {
      case 'storm': case 'flood': return coastTiles(w, id);
      case 'plague': case 'famine': return c.population;
      case 'goldrush': return -c.treasury;
      case 'prophet': return -c.temperament.faith;
      case 'meteor': return countryTiles(w, id).length;
      default: return 0;
    }
  };
  const best = Math.max(...ids.map(score));
  const top = ids.filter((id) => score(id) === best);
  return top[Math.floor(rng() * top.length)];
}

const rngFor = (w: World, text: string, tick: number): Rng => mulberry32(hashString(`decree:${w.seed}:${tick}:${text}`));

// --- interpreting ----------------------------------------------------------------------------

const KEYWORDS: [DecreeEffect, RegExp][] = [
  ['plague', /plague|pestilence|disease|sickness|epidemic|pox|fever|contagion/i],
  ['famine', /famine|hunger|starv|drought|blight|harvest fail|locust/i],
  ['meteor', /meteor|comet|asteroid|fire from the sky|star falls|falling star|impact/i],
  ['flood', /flood|tsunami|deluge|rising sea|sea rises|inundat/i],
  ['storm', /storm|hurricane|tempest|typhoon|cyclone|tornado|gale|thunder/i],
  ['prophet', /prophet|messiah|saviou?r|miracle|divine|vision|holy|blessing|god\b|gods\b/i],
  ['goldrush', /gold|treasure|riches|boom|wealth|prosper|silver|fortune/i],
  ['rebellion', /rebel|revolt|uprising|revolution|unrest|riot|overthrow|insurrection/i],
];

const clean = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').trim().slice(0, 160);
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
};

/** Finish a half-known target: validate ids against the world, fill the region from a direction, and
 *  fall back to the most fitting nation. */
function finishTarget(w: World, effect: DecreeEffect, text: string, tick: number, raw: DecreeTarget & { direction?: string }): DecreeTarget {
  let countryId = alive(w, raw.countryId) ? raw.countryId : undefined;
  let regionId = raw.regionId !== undefined && w.regions[raw.regionId] ? raw.regionId : undefined;
  if (regionId !== undefined && countryId === undefined) {
    const o = regionOwner(w, regionId);
    if (alive(w, o)) countryId = o;
  }
  if (regionId !== undefined && countryId !== undefined && regionOwner(w, regionId) !== countryId) regionId = undefined;
  const dir = raw.direction && DIRECTIONS[raw.direction] ? raw.direction : undefined;
  if (regionId === undefined && dir) {
    regionId = regionInDirection(w, dir, countryId);
    if (regionId !== undefined && countryId === undefined) countryId = regionOwner(w, regionId);
  }
  if (countryId === undefined && effect !== 'none') countryId = fittingCountry(w, effect, rngFor(w, text, tick));
  const t: DecreeTarget = {};
  if (countryId !== undefined) t.countryId = countryId;
  if (regionId !== undefined) t.regionId = regionId;
  return t;
}

/** Mock mode: a keyword matcher. Names mentioned (nation, adjective, region), directions, else the best fit. */
export function interpretDecreeMock(text: string, world: World): Decree {
  const t = clean(text);
  const effect = KEYWORDS.find(([, re]) => re.test(t))?.[0] ?? 'none';
  const lower = t.toLowerCase();
  let countryId: number | undefined; let regionId: number | undefined;
  for (const c of world.countries) {
    if (!c.alive) continue;
    const bare = c.name.toLowerCase().replace(/^the /, '');
    if (lower.includes(bare) || (c.adjective.length >= 4 && new RegExp(`\\b${c.adjective.toLowerCase()}\\b`).test(lower))) { countryId = c.id; break; }
  }
  for (const r of world.regions) {
    if (r.name && lower.includes(r.name.toLowerCase())) { regionId = r.id; break; }
  }
  const direction = /south/.test(lower) ? 'south' : /north/.test(lower) ? 'north' : /east/.test(lower) ? 'east' : /west/.test(lower) ? 'west' : undefined;
  return { text: t, effect, target: finishTarget(world, effect, t, world.tick, { countryId, regionId, direction }) };
}

const DECREE_SYSTEM = 'You are the voice of fate in a living-world simulation. A human has issued a decree. '
  + 'Choose which single effect it means, and who or where it strikes, using only the ids given. '
  + 'effect is one of: plague, famine, storm, meteor, prophet, goldrush, rebellion, flood, none (none when the words fit nothing).';

const targetProps: Record<string, Schema> = {
  effect: { type: 'string', enum: [...EFFECTS] },
  countryId: { type: 'integer', description: 'id of the nation struck, or -1' },
  regionId: { type: 'integer', description: 'id of the region struck, or -1' },
  direction: { type: 'string', enum: ['north', 'south', 'east', 'west', 'none'], description: 'a compass word in the decree, if any' },
};

/** A compact list of the nations and named regions, with the ids Gemini must answer in. */
function worldDigest(w: World): string {
  const nations = w.countries.filter((c) => c.alive).map((c) => `${c.id}: ${c.name}`).join('; ');
  const regions = w.regions.filter((r) => r.name && alive(w, regionOwner(w, r.id)))
    .slice(0, 60).map((r) => `${r.id}: ${r.name} (nation ${regionOwner(w, r.id)})`).join('; ');
  return `Nations: ${nations}.\nRegions: ${regions || 'none named yet'}.`;
}

interface RawDecree { text?: string; effect: DecreeEffect; countryId?: number; regionId?: number; direction?: string }
const fromRaw = (w: World, raw: RawDecree, fallbackText: string): Decree => {
  const text = clean(raw.text ?? '') || clean(fallbackText);
  return {
    text, effect: raw.effect,
    target: finishTarget(w, raw.effect, text, w.tick, {
      countryId: raw.countryId !== undefined && raw.countryId >= 0 ? raw.countryId : undefined,
      regionId: raw.regionId !== undefined && raw.regionId >= 0 ? raw.regionId : undefined,
      direction: raw.direction,
    }),
  };
};

/** Typed decrees: live mode makes one small ruler-model call, mock mode the keyword matcher. */
export async function interpretDecree(text: string, world: World): Promise<Decree> {
  if (currentMode() === 'live' && process.env.GEMINI_API_KEY) {
    try {
      const raw = await llmJson<RawDecree>({
        model: rulerModel(), system: DECREE_SYSTEM, purpose: 'decree', maxOutputTokens: 200,
        prompt: `${worldDigest(world)}\n\nDecree: "${text.slice(0, 300)}"`,
        schema: { type: 'object', required: ['effect'], properties: targetProps },
      });
      return fromRaw(world, raw, text);
    } catch { /* fall through to the keyword matcher; the decree must still land */ }
  }
  return interpretDecreeMock(text, world);
}

// --- the spoken decree -----------------------------------------------------------------------

const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/aac', 'audio/flac']);
export const MAX_AUDIO_BASE64 = 2_800_000;   // about 2 MB of audio

/** The bare mime type (codecs parameter dropped) when it is a supported audio type and the payload is sane. */
export function checkAudio(audioBase64: unknown, mimeType: unknown): string | null {
  if (typeof audioBase64 !== 'string' || typeof mimeType !== 'string') return null;
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  if (!AUDIO_TYPES.has(base)) return null;
  if (audioBase64.length < 100 || audioBase64.length > MAX_AUDIO_BASE64 || !/^[A-Za-z0-9+/=\s]+$/.test(audioBase64)) return null;
  return base;
}

export const voiceModel = (): string => process.env.GEMINI_MODEL_VOICE || rulerModel();

export class VoiceUnavailableError extends Error {}
export class NoSpeechError extends Error {}

/** One Gemini call that hears the clip, transcribes it and interprets it. Mock mode returns the canned decree. */
export async function hearDecree(world: World, audioBase64: string, mimeType: string): Promise<{ transcript: string; decree: Decree }> {
  if (currentMode() !== 'live') {
    return { transcript: MOCK_VOICE_TRANSCRIPT, decree: interpretDecreeMock(MOCK_VOICE_TRANSCRIPT, world) };
  }
  try {
    const raw = await llmJson<RawDecree & { transcript: string }>({
      model: voiceModel(), system: DECREE_SYSTEM, purpose: 'decree-voice', maxOutputTokens: 300,
      audio: { data: audioBase64.replace(/\s+/g, ''), mimeType },
      prompt: `${worldDigest(world)}\n\nTranscribe this spoken decree and interpret it. transcript is exactly what was said; text is the decree as one clean sentence.`,
      schema: { type: 'object', required: ['transcript', 'effect'], properties: { transcript: { type: 'string' }, text: { type: 'string' }, ...targetProps } },
    });
    const transcript = raw.transcript.trim();
    if (!transcript) throw new NoSpeechError('no speech heard');
    return { transcript, decree: fromRaw(world, raw, transcript) };
  } catch (e) {
    if (e instanceof NoSpeechError) throw e;
    throw new VoiceUnavailableError(e instanceof Error ? e.message : String(e));
  }
}

// --- applying: decree to world events --------------------------------------------------------

const DOWNGRADE: Partial<Record<StructureKind, StructureKind | 'destroy'>> = {
  city: 'town', town: 'village', village: 'camp', camp: 'destroy', farm: 'destroy', port: 'destroy', factory: 'destroy',
};
const GROW: Partial<Record<StructureKind, StructureKind>> = { camp: 'village', village: 'town', town: 'city' };

function shuffled<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

export interface DecreeEventOptions { n?: number; lamport?: () => number }

/** The world events of one decree: chronicle line, the effect, chronicle consequence. Pure. */
export function decreeEvents(world: World, decree: Decree, tick: number, opts: DecreeEventOptions = {}): WorldEvent[] {
  const n = opts.n ?? 1;
  let lam = 0;
  const lamport = opts.lamport ?? (() => ++lam);
  let k = 0;
  const ev = (body: Record<string, unknown> & { type: WorldEvent['type'] }): WorldEvent =>
    ({ id: `e-decree-${n}-${++k}`, tick, actor: 'decree', lamport: lamport(), ...body }) as WorldEvent;
  const rng = rngFor(world, decree.text, tick);

  // The ground the decree touches: a region, else the nation's land.
  const t = decree.target;
  const region = t.regionId !== undefined ? world.regions[t.regionId] : t.tile !== undefined && world.tiles[t.tile] ? world.regions[world.tiles[t.tile]!.region] : undefined;
  let cid: number | undefined = alive(world, t.countryId) ? t.countryId : undefined;
  if (cid === undefined && region) { const o = regionOwner(world, region.id); if (alive(world, o)) cid = o; }
  const country: Country | undefined = cid !== undefined ? world.countries[cid] : undefined;
  const land = (): number[] => {
    if (!country) return [];
    const owned = countryTiles(world, country.id);
    const inRegion = region ? owned.filter((x) => world.tiles[x]!.region === region.id) : [];
    return inRegion.length ? inRegion : owned;
  };
  const tiles = land();
  const tileSet = new Set(tiles);
  const here = (): Structure[] => world.structures.filter((s) => tileSet.has(s.tile) && s.owner === country?.id && s.kind !== 'ruin');
  const where = region?.name ? `the ${region.name} region of ${country?.name ?? 'the world'}` : country ? country.name : 'the world';

  const out: WorldEvent[] = [];
  const countries = country ? [country.id] : [];
  out.push(ev({ type: 'chronicle', entry: { id: `c-decree-${n}`, tick, year: world.year, kind: 'decree', countries, text: decree.text } }));

  // Damage up to `max` of `candidates` (downgrade one step, or destroy); returns how many were hit.
  const damage = (candidates: Structure[], max: number): number => {
    let hit = 0;
    for (const s of shuffled(candidates, rng)) {
      if (hit >= max) break;
      const to = DOWNGRADE[s.kind];
      if (!to) continue;
      out.push(to === 'destroy' ? ev({ type: 'structure_destroyed', structureId: s.id }) : ev({ type: 'structure_upgraded', structureId: s.id, kind: to }));
      hit++;
    }
    return hit;
  };
  const pct = (lo: number, hi: number): number => lo + rng() * (hi - lo);
  let consequence = `Nothing in ${where} answers the decree; the chroniclers note it and move on.`;

  if (country) {
    switch (decree.effect) {
      case 'plague': {
        const f = pct(0.1, 0.25);
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { population: Math.round(country.population * (1 - f)) } }));
        consequence = `Plague takes ${Math.round(f * 100)} in every hundred souls in ${where}.`;
        break;
      }
      case 'famine': {
        const f = pct(0.1, 0.25); const g = pct(0.2, 0.4);
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { population: Math.round(country.population * (1 - f)), treasury: Math.round(country.treasury * (1 - g)) } }));
        consequence = `Famine empties the granaries of ${where}: ${Math.round(f * 100)} in every hundred starve and the treasury falls by ${Math.round(g * 100)}%.`;
        break;
      }
      case 'storm': {
        const coast = here().filter((s) => world.tiles[s.tile]!.terrain === 'coast');
        const hit = damage(coast.length ? coast : here(), 3);
        consequence = hit ? `A great storm batters ${where}; ${hit} settlement${hit > 1 ? 's are' : ' is'} wrecked or set back.` : `A great storm lashes ${where}, but the coast holds.`;
        break;
      }
      case 'flood': {
        const low = [...tiles].sort((a, b) => world.tiles[a]!.elevation - world.tiles[b]!.elevation).slice(0, Math.max(3, Math.ceil(tiles.length * 0.3)));
        const lowSet = new Set(low);
        const hit = damage(here().filter((s) => lowSet.has(s.tile)), 4);
        consequence = hit ? `The waters rise over ${where}; ${hit} low-lying settlement${hit > 1 ? 's are' : ' is'} swept away or set back.` : `The waters rise over ${where} and drain away again.`;
        break;
      }
      case 'meteor': {
        const withStructures = tiles.filter((x) => here().some((s) => s.tile === x && s.kind !== 'capital'));
        const pool = withStructures.length ? withStructures : tiles.filter((x) => x !== country.capitalTile);
        const centre = pool.length ? shuffled(pool, rng)[0]! : undefined;
        if (centre !== undefined) {
          const crater = [centre, ...shuffled(world.tiles[centre]!.neighbors.filter((x) => tileSet.has(x)), rng).slice(0, Math.floor(rng() * 3))];
          let lost = 0;
          for (const x of crater) {
            for (const s of world.structures.filter((q) => q.tile === x && q.kind !== 'capital' && q.kind !== 'ruin')) {
              out.push(x === centre ? ev({ type: 'structure_upgraded', structureId: s.id, kind: 'ruin' }) : ev({ type: 'structure_destroyed', structureId: s.id }));
              lost++;
            }
          }
          consequence = `A meteor strikes ${where}, leaving a crater across ${crater.length} province${crater.length > 1 ? 's' : ''}; ${lost} structure${lost === 1 ? '' : 's'} lost.`;
        } else consequence = `A meteor streaks over ${where} and falls in empty land.`;
        break;
      }
      case 'prophet': {
        const taken = new Set(world.structures.map((s) => s.tile));
        const free = tiles.filter((x) => !taken.has(x) && world.tiles[x]!.terrain !== 'ocean');
        const faith = Math.min(1, Math.round((country.temperament.faith + 0.2) * 100) / 100);
        if (free.length) {
          const tile = shuffled(free, rng)[0]!;
          out.push(ev({ type: 'structure_built', structure: { id: `s-decree-${n}`, tile, owner: country.id, kind: 'temple', builtTick: tick } }));
        }
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { temperament: { ...country.temperament, faith } } }));
        consequence = `A prophet rises in ${where}; ${free.length ? 'a temple is raised in their name and ' : ''}the people's faith deepens.`;
        break;
      }
      case 'goldrush': {
        const gain = Math.round(Math.max(20, country.treasury * pct(0.3, 0.6)));
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { treasury: country.treasury + gain } }));
        const grow = shuffled(here().filter((s) => GROW[s.kind]), rng)[0];
        if (grow) out.push(ev({ type: 'structure_upgraded', structureId: grow.id, kind: GROW[grow.kind]! }));
        consequence = `Gold is struck in ${where}; the treasury swells by ${gain}${grow ? ` and a ${grow.kind} grows into a ${GROW[grow.kind]}` : ''}.`;
        break;
      }
      case 'rebellion': {
        const pool = region ? [region] : world.regions.filter((r) => alive(world, regionOwner(world, r.id)) && regionOwner(world, r.id) === country.id);
        const r = region ?? (pool.length ? shuffled(pool, rng)[0] : undefined);
        if (r) {
          const unrest = Math.min(1, Math.round((r.unrest + 0.5) * 100) / 100);
          out.push(ev({ type: 'region_updated', regionId: r.id, patch: { unrest } }));
          consequence = `Rebellion stirs in ${r.name ? `the ${r.name} region of ${country.name}` : where}; unrest climbs to ${Math.round(unrest * 100)}%.`;
        }
        break;
      }
      case 'none': break;
    }
  }
  out.push(ev({ type: 'chronicle', entry: { id: `c-decree-${n}-b`, tick, year: world.year, kind: 'decree', countries, text: consequence } }));
  return out;
}
