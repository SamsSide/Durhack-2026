// Decrees (row A20): a typed or spoken line from the human becomes a decree with an effect on the
// world. Two halves. Interpreting (live: one small Gemini call, or for a spoken decree one call that
// hears the audio and does both; mock: a keyword matcher) gives { text, effect, target }. Applying
// (decreeEvents) turns that into ordinary X1 world events with actor 'decree', delivered through the bus
// like the resilience events, so every replica applies the same events and stays identical. The
// events are a pure function of (world, decree, tick): the dice are seeded from them.
//
// Owner #288: the severity (0 to 0.8) comes from the words, decided once when the decree is
// interpreted and carried in the Decree, so the effect scales with it instead of a random roll. The
// decree's own chronicle line records what it did (`entry.decree`: effect, severity, the nation and
// provinces hit, one result line with real numbers); replays apply the recorded events, never re-roll.
import {
  countryTiles, hashString, mulberry32, regionOwner,
  type Country, type DecreeEffect, type DecreeOutcome, type Rng, type Structure, type StructureKind, type World, type WorldEvent,
} from '@terra/shared';
import { currentMode, llmJson, rulerModel, type Schema } from '../llm';

export type { DecreeEffect, DecreeOutcome };
export const EFFECTS = ['plague', 'famine', 'storm', 'meteor', 'prophet', 'goldrush', 'rebellion', 'flood', 'none'] as const satisfies readonly DecreeEffect[];
/** `world`: the words say the whole world, so a population effect strikes every living nation. */
export interface DecreeTarget { countryId?: number; regionId?: number; tile?: number; world?: boolean }
export interface Decree { text: string; effect: DecreeEffect; severity: number; target: DecreeTarget }

/** What the runner offers the voice route: apply an already interpreted decree, get back what it did. */
export interface DecreeRunner { applyDecree(decree: Decree): DecreeOutcome | null }

// --- severity --------------------------------------------------------------------------------

/** The cap: "everyone dies" still leaves a world to watch (owner #288). */
export const MAX_SEVERITY = 0.8;
export const MIN_SEVERITY = 0.05;
/** A decree with no measure in its words. */
export const DEFAULT_SEVERITY = 0.3;
const round2 = (x: number): number => Math.round(x * 100) / 100;
export const clampSeverity = (v: unknown, fallback = DEFAULT_SEVERITY): number =>
  typeof v === 'number' && Number.isFinite(v) ? round2(Math.min(MAX_SEVERITY, Math.max(MIN_SEVERITY, v))) : fallback;

// First match wins, so the exact measures come before the loose adjectives.
const SEVERITY_WORDS: [RegExp, number][] = [
  [/\b(every ?(one|body|soul|man|last)|all (the )?(people|souls|of them|life|men|women)|wipes? out|wiped out|annihilat|extinct|exterminat|no ?one (survives|lives)|none (survive|live)|entire (world|nation|population|people|kingdom|country|realm)|whole (world|nation|population|people|kingdom|country|realm)|apocalyp|everyone dies)/i, 1],
  [/\bthree[- ]quarters\b/i, 0.75],
  [/\btwo[- ]thirds\b/i, 0.67],
  [/\b(most of|the majority)\b/i, 0.65],
  [/\bhalf\b/i, 0.5],
  [/\bthird\b/i, 0.33],
  [/\bquarter\b/i, 0.25],
  [/\b(tenth|a few|handful)\b/i, 0.1],
  [/\b(devastat\w*|catastroph\w*|terrible|massive|huge|enormous|giant|great|deadly|dreadful|black death|ruinous|colossal|mighty|terrifying|horrific)\b/i, 0.6],
  [/\b(mild|slight|minor|little|small|light|gentle|brief|tiny|faint|weak|passing|modest)\b/i, 0.1],
];

/** Severity from the words alone (mock mode, and the fallback when Gemini gives none). */
export function severityFromWords(text: string): number {
  const pct = /(\d{1,3}(?:\.\d+)?)\s*(%|percent|per cent)/i.exec(text);
  if (pct) return clampSeverity(Number(pct[1]) / 100);
  for (const [re, v] of SEVERITY_WORDS) if (re.test(text)) return clampSeverity(v);
  return DEFAULT_SEVERITY;
}

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
  // The nearest effect for plain death ("half the population dies").
  ['plague', /\b(die|dies|dying|dead|death|deaths|perish\w*|kill\w*|slaughter\w*|sick|ill|wither\w*)\b/i],
];

// Scope (owner #288): a decree that names no place strikes its whole nation, and one that says the whole
// world strikes every nation. Only a named place (a compass word, the coast, the capital, mountains, a
// province or region, a region's own name) keeps the regional footprint.
const PLACE_RE = /\b(north|south|east|west)\w*|\bcoast\w*|\bcapital\b|\bmountain\w*|\bprovince\b|\bregion\b/i;
const WORLD_RE = /\b(the (whole |entire )?(world|earth|planet)|everyone on (the )?(earth|planet)|every ?(one|body) (on|in) (the )?(earth|world|planet)|all (the )?(nations|countries|kingdoms|peoples)|every (nation|country|kingdom)|mankind|humankind|humanity)\b/i;
const namesPlace = (w: World, text: string): boolean =>
  PLACE_RE.test(text) || w.regions.some((r) => r.name && text.toLowerCase().includes(r.name.toLowerCase().replace(/^the /, '')));

const clean = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').trim().slice(0, 160);
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
};

/** Finish a half-known target: validate ids against the world, fill the region from a direction, and
 *  fall back to the most fitting nation. */
function finishTarget(w: World, effect: DecreeEffect, text: string, tick: number, raw: DecreeTarget & { direction?: string }): DecreeTarget {
  const placed = namesPlace(w, text);
  let countryId = alive(w, raw.countryId) ? raw.countryId : undefined;
  // Gemini likes to pick a region anyway; without a place in the words it is dropped.
  let regionId = placed && raw.regionId !== undefined && w.regions[raw.regionId] ? raw.regionId : undefined;
  if (regionId !== undefined && countryId === undefined) {
    const o = regionOwner(w, regionId);
    if (alive(w, o)) countryId = o;
  }
  if (regionId !== undefined && countryId !== undefined && regionOwner(w, regionId) !== countryId) regionId = undefined;
  const dir = placed && raw.direction && DIRECTIONS[raw.direction] ? raw.direction : undefined;
  if (regionId === undefined && dir) {
    regionId = regionInDirection(w, dir, countryId);
    if (regionId !== undefined && countryId === undefined) countryId = regionOwner(w, regionId);
  }
  if (countryId === undefined && effect !== 'none') countryId = fittingCountry(w, effect, rngFor(w, text, tick));
  const t: DecreeTarget = {};
  if (countryId !== undefined) t.countryId = countryId;
  // "... strikes the capital": the nation's capital province, and its region.
  if (countryId !== undefined && /\bcapital\b/i.test(text)) {
    const cap = w.countries[countryId]!.capitalTile;
    if (w.tiles[cap]) { t.tile = cap; const r = w.tiles[cap]!.region; regionId = r >= 0 && regionOwner(w, r) === countryId ? r : undefined; }
  }
  if (regionId !== undefined) t.regionId = regionId;
  if (WORLD_RE.test(text) && !placed) t.world = true;
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
  return { text: t, effect, severity: severityFromWords(t), target: finishTarget(world, effect, t, world.tick, { countryId, regionId, direction }) };
}

const DECREE_SYSTEM = 'You are the voice of fate in a living-world simulation. A human has issued a decree. '
  + 'Choose which single effect it means, and who or where it strikes, using only the ids given. '
  + 'effect is one of: plague, famine, storm, meteor, prophet, goldrush, rebellion, flood, none. '
  + 'A wish that fits none exactly maps to the nearest effect (a wish for riches is goldrush, for faith is prophet); none only when nothing fits at all. '
  + 'severity is how hard it strikes, 0 to 1, read from the words: "half the population dies" 0.5, "a third" 0.33, '
  + '"a mild fever" 0.1, "a great plague" 0.6, "everyone dies" 1, and 0.3 when the words give no measure.';

const targetProps: Record<string, Schema> = {
  effect: { type: 'string', enum: [...EFFECTS] },
  countryId: { type: 'integer', description: 'id of the nation struck, or -1' },
  regionId: { type: 'integer', description: 'id of the region struck, or -1' },
  direction: { type: 'string', enum: ['north', 'south', 'east', 'west', 'none'], description: 'a compass word in the decree, if any' },
  severity: { type: 'number', description: 'how hard it strikes, 0 to 1, from the words' },
};

/** A compact list of the nations and named regions, with the ids Gemini must answer in. */
function worldDigest(w: World): string {
  const nations = w.countries.filter((c) => c.alive).map((c) => `${c.id}: ${c.name}`).join('; ');
  const regions = w.regions.filter((r) => r.name && alive(w, regionOwner(w, r.id)))
    .slice(0, 60).map((r) => `${r.id}: ${r.name} (nation ${regionOwner(w, r.id)})`).join('; ');
  return `Nations: ${nations}.\nRegions: ${regions || 'none named yet'}.`;
}

interface RawDecree { text?: string; effect: DecreeEffect; countryId?: number; regionId?: number; direction?: string; severity?: number }
const fromRaw = (w: World, raw: RawDecree, fallbackText: string): Decree => {
  const text = clean(raw.text ?? '') || clean(fallbackText);
  return {
    text, effect: raw.effect, severity: clampSeverity(raw.severity, severityFromWords(text)),
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
        model: rulerModel(), system: DECREE_SYSTEM, purpose: 'decree', maxOutputTokens: 240,
        prompt: `${worldDigest(world)}\n\nDecree: "${text.slice(0, 300)}"`,
        schema: { type: 'object', required: ['effect', 'severity'], properties: targetProps },
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
      schema: { type: 'object', required: ['transcript', 'effect', 'severity'], properties: { transcript: { type: 'string' }, text: { type: 'string' }, ...targetProps } },
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


/** 41000 as "41,000" (no locale, so every machine writes the same line). */
export const fmtNum = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** What fraction of a people died, in words: "half its people", "a third of its people", "40% of its people". */
function sharePhrase(f: number, of: string): string {
  const near = (x: number): boolean => Math.abs(f - x) < 0.03;
  if (f >= 0.97) return `all but a few of ${of}`;
  if (near(0.5)) return `half ${of}`;
  if (near(0.25)) return `a quarter of ${of}`;
  if (near(1 / 3)) return `a third of ${of}`;
  if (near(2 / 3)) return `two thirds of ${of}`;
  if (near(0.75)) return `three quarters of ${of}`;
  return `${Math.max(1, Math.round(f * 100))}% of ${of}`;
}
/** Most provinces a decree's recorded target lists (the client draws each one). */
const MAX_TARGET_TILES = 200;
const count = (n: number, one: string, many = `${one}s`): string => `${fmtNum(n)} ${n === 1 ? one : many}`;

export interface DecreeEventOptions { n?: number; lamport?: () => number }

/** What a decree did, read back from its events (the `decree` field of its own chronicle line). */
export function decreeOutcomeOf(events: WorldEvent[]): DecreeOutcome | null {
  for (const e of events) if (e.type === 'chronicle' && e.entry.decree) return e.entry.decree;
  return null;
}

/** The world events of one decree: its own chronicle line (carrying the outcome), the effect, and a
 *  chronicle consequence. Pure: the effect scales with decree.severity, the dice are seeded. */
export function decreeEvents(world: World, decree: Decree, tick: number, opts: DecreeEventOptions = {}): WorldEvent[] {
  const n = opts.n ?? 1;
  let lam = 0;
  const lamport = opts.lamport ?? (() => ++lam);
  let k = 0;
  const ev = (body: Record<string, unknown> & { type: WorldEvent['type'] }): WorldEvent =>
    ({ id: `e-decree-${n}-${++k}`, tick, actor: 'decree', lamport: lamport(), ...body }) as WorldEvent;
  const rng = rngFor(world, decree.text, tick);
  const sev = clampSeverity(decree.severity);

  // The ground the decree touches: a region, else the nation's land.
  const t = decree.target;
  const region = t.regionId !== undefined ? world.regions[t.regionId] : t.tile !== undefined && world.tiles[t.tile] ? world.regions[world.tiles[t.tile]!.region] : undefined;
  let cid: number | undefined = alive(world, t.countryId) ? t.countryId : undefined;
  if (cid === undefined && region) { const o = regionOwner(world, region.id); if (alive(world, o)) cid = o; }
  const country: Country | undefined = cid !== undefined ? world.countries[cid] : undefined;
  const owned = country ? countryTiles(world, country.id) : [];
  const ownedSet = new Set(owned);
  const inRegion = region ? owned.filter((x) => world.tiles[x]!.region === region.id) : [];
  const tiles = inRegion.length ? inRegion : owned;
  const tileSet = new Set(tiles);
  const share = owned.length ? tiles.length / owned.length : 0;      // of the nation's people, by land
  const pop = country?.population ?? 0;
  const here = (set: Set<number> = tileSet): Structure[] => world.structures.filter((s) => set.has(s.tile) && s.owner === country?.id && s.kind !== 'ruin');
  const nationName = country ? country.name.replace(/^The /, 'the ') : 'the world';
  const regionLabel = region?.name ? region.name.replace(/^The /, 'the ') : '';
  const place = inRegion.length && regionLabel ? regionLabel : nationName;
  const where = inRegion.length && region?.name ? `the ${region.name.replace(/^the /i, '')} region of ${nationName}` : nationName;

  // The whole world: plague and famine strike every living nation (physical effects stay with one nation).
  const worldwide = !!t.world && (decree.effect === 'plague' || decree.effect === 'famine');
  const out: WorldEvent[] = [];
  const countries = worldwide ? aliveIds(world) : country ? [country.id] : [];
  const entry: Extract<WorldEvent, { type: 'chronicle' }>['entry'] = { id: `c-decree-${n}`, tick, year: world.year, kind: 'decree', countries, text: decree.text };
  out.push(ev({ type: 'chronicle', entry }));

  // Damage up to `max` of `candidates` (downgrade one step, or destroy); returns the tiles hit.
  const damage = (candidates: Structure[], max: number): number[] => {
    const hit: number[] = [];
    for (const s of shuffled(candidates, rng)) {
      if (hit.length >= max) break;
      const to = DOWNGRADE[s.kind];
      if (!to) continue;
      out.push(to === 'destroy' ? ev({ type: 'structure_destroyed', structureId: s.id }) : ev({ type: 'structure_upgraded', structureId: s.id, kind: to }));
      hit.push(s.tile);
    }
    return hit;
  };
  const kill = (dead: number): number => {
    const d = Math.max(0, Math.min(pop - 1, Math.round(dead)));
    return d;
  };
  const uniq = (xs: number[]): number[] => [...new Set(xs)];

  let hitTiles: number[] = [];
  let result = 'The world shrugs.';
  let consequence = `Nothing in ${where} answers the decree; the chroniclers note it and move on.`;

  if (worldwide) {
    let dead = 0; let people = 0; let lost = 0;
    const all: number[] = []; const caps: number[] = [];
    for (const c of world.countries.filter((q) => q.alive)) {
      const d = Math.max(0, Math.min(c.population - 1, Math.round(c.population * sev)));
      const l = decree.effect === 'famine' ? Math.round(c.treasury * Math.min(0.8, sev * 1.2)) : 0;
      out.push(ev({ type: 'country_updated', countryId: c.id, patch: decree.effect === 'famine' ? { population: c.population - d, treasury: c.treasury - l } : { population: c.population - d } }));
      dead += d; people += c.population; lost += l;
      all.push(...countryTiles(world, c.id)); caps.push(c.capitalTile);
    }
    // The client draws every province in `tiles`: past about 200 send the capitals plus an even sample.
    if (all.length > MAX_TARGET_TILES) {
      const rest = all.filter((x) => !caps.includes(x));
      const room = Math.max(0, MAX_TARGET_TILES - caps.length);
      const step = rest.length / Math.max(1, room);
      hitTiles = uniq([...caps, ...Array.from({ length: room }, (_, i) => rest[Math.floor(i * step)]!)]);
    } else hitTiles = all;
    const of = ` (${sharePhrase(dead / Math.max(1, people), 'the world\'s people')})`;
    if (decree.effect === 'plague') {
      result = `A plague sweeps the world: ${fmtNum(dead)} dead${of}`;
      consequence = `A plague sweeps the world: ${fmtNum(dead)} souls are lost across ${count(countries.length, 'nation')}.`;
    } else {
      result = `Famine grips the world: ${fmtNum(dead)} starve, the treasuries lose ${fmtNum(lost)}${of}`;
      consequence = `Famine grips every nation: ${fmtNum(dead)} starve and the treasuries fall by ${fmtNum(lost)}.`;
    }
  } else if (country) {
    switch (decree.effect) {
      case 'plague': {
        const dead = kill(pop * sev * share);
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { population: pop - dead } }));
        hitTiles = tiles;
        result = `Plague ${inRegion.length ? 'in' : 'across'} ${place}: ${fmtNum(dead)} dead${inRegion.length ? '' : ` (${sharePhrase(dead / Math.max(1, pop), 'its people')})`}`;
        consequence = `Plague sweeps ${where}: ${fmtNum(dead)} souls are lost, ${Math.round(sev * 100)} in every hundred of those it touches.`;
        break;
      }
      case 'famine': {
        const dead = kill(pop * sev * share);
        const lost = Math.round(country.treasury * Math.min(0.8, sev * 1.2));
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { population: pop - dead, treasury: country.treasury - lost } }));
        hitTiles = tiles;
        result = `Famine ${inRegion.length ? 'in' : 'across'} ${place}: ${fmtNum(dead)} starve${inRegion.length ? '' : ` (${sharePhrase(dead / Math.max(1, pop), 'its people')})`}, the treasury loses ${fmtNum(lost)}`;
        consequence = `Famine empties the granaries of ${where}: ${fmtNum(dead)} starve and the treasury falls by ${fmtNum(lost)}.`;
        break;
      }
      case 'storm': {
        const coastSet = new Set(tiles.filter((x) => world.tiles[x]!.terrain === 'coast'));
        const coast = here(coastSet);
        const wrecked = damage(coast.length ? coast : here(), 1 + Math.round(sev * 7));
        const dead = kill(pop * share * sev * 0.1);
        if (dead) out.push(ev({ type: 'country_updated', countryId: country.id, patch: { population: pop - dead } }));
        const lashed = (coastSet.size ? [...coastSet] : tiles).slice(0, 1 + Math.round(sev * 10));
        hitTiles = uniq([...wrecked, ...lashed]);
        result = `Storm over ${place}: ${wrecked.length ? `${count(wrecked.length, 'settlement')} wrecked, ` : ''}${fmtNum(dead)} dead`;
        consequence = wrecked.length ? `A great storm batters ${where}; ${count(wrecked.length, 'settlement')} wrecked or set back and ${fmtNum(dead)} lost at sea.` : `A great storm lashes ${where}, but the coast holds.`;
        break;
      }
      case 'flood': {
        const low = [...tiles].sort((a, b) => world.tiles[a]!.elevation - world.tiles[b]!.elevation || a - b)
          .slice(0, Math.max(2, Math.ceil(tiles.length * (0.1 + sev * 0.6))));
        const lowSet = new Set(low);
        const lost = damage(here(lowSet), 2 + Math.round(sev * 8));
        const dead = kill(pop * share * (low.length / Math.max(1, tiles.length)) * sev);
        if (dead) out.push(ev({ type: 'country_updated', countryId: country.id, patch: { population: pop - dead } }));
        hitTiles = low;
        result = `Flood in ${place}: ${count(low.length, 'province')} under water, ${lost.length ? `${count(lost.length, 'settlement')} lost, ` : ''}${fmtNum(dead)} drowned`;
        consequence = lost.length ? `The waters rise over ${where}; ${count(lost.length, 'low-lying settlement')} swept away or set back and ${fmtNum(dead)} drowned.` : `The waters rise over ${where}, drown ${fmtNum(dead)} and drain away again.`;
        break;
      }
      case 'meteor': {
        let centre: number | undefined = t.tile !== undefined && ownedSet.has(t.tile) ? t.tile : undefined;
        if (centre === undefined) {
          const built = new Set(here().filter((s) => s.kind !== 'capital').map((s) => s.tile));
          const withStructures = tiles.filter((x) => built.has(x));
          const pool = withStructures.length ? withStructures : tiles.filter((x) => x !== country.capitalTile);
          centre = pool.length ? shuffled(pool, rng)[0]! : tiles[0];
        }
        if (centre !== undefined) {
          // The crater grows with the severity: a breadth-first ring out from the centre, on the nation's land.
          const size = 1 + Math.round(sev * 8);
          const crater = [centre]; const seen = new Set(crater);
          for (let i = 0; i < crater.length && crater.length < size; i++) {
            for (const x of shuffled(world.tiles[crater[i]!]!.neighbors, rng)) {
              if (crater.length >= size) break;
              if (seen.has(x) || !ownedSet.has(x)) continue;
              seen.add(x); crater.push(x);
            }
          }
          let lost = 0;
          for (const x of crater) {
            for (const s of world.structures.filter((q) => q.tile === x && q.kind !== 'capital' && q.kind !== 'ruin')) {
              out.push(x === centre ? ev({ type: 'structure_upgraded', structureId: s.id, kind: 'ruin' }) : ev({ type: 'structure_destroyed', structureId: s.id }));
              lost++;
            }
          }
          const dead = kill(pop * sev * (centre === country.capitalTile ? 0.4 : 0.25));
          if (dead) out.push(ev({ type: 'country_updated', countryId: country.id, patch: { population: pop - dead } }));
          const r = world.regions[world.tiles[centre]!.region];
          const at = centre === country.capitalTile ? `the capital of ${nationName}` : r?.name ? r.name.replace(/^The /, 'the ') : place;
          hitTiles = crater;
          result = `Meteor strikes ${at}: ${count(crater.length, 'province')} scorched, ${lost ? `${count(lost, 'structure')} lost, ` : ''}${fmtNum(dead)} dead`;
          consequence = `A meteor strikes ${at}, leaving a crater across ${count(crater.length, 'province')}; ${count(lost, 'structure')} lost and ${fmtNum(dead)} dead.`;
        } else { result = `A meteor streaks over ${place} and falls in empty land`; consequence = `A meteor streaks over ${where} and falls in empty land.`; }
        break;
      }
      case 'prophet': {
        const taken = new Set(world.structures.map((s) => s.tile));
        const free = shuffled(tiles.filter((x) => !taken.has(x) && world.tiles[x]!.terrain !== 'ocean'), rng).slice(0, 1 + Math.floor(sev * 3));
        const faith = Math.min(1, round2(country.temperament.faith + 0.1 + sev * 0.4));
        free.forEach((tile, i) => out.push(ev({ type: 'structure_built', structure: { id: `s-decree-${n}${i ? `-${i}` : ''}`, tile, owner: country.id, kind: 'temple', builtTick: tick } })));
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { temperament: { ...country.temperament, faith } } }));
        hitTiles = free.length ? free : [country.capitalTile];
        result = `A prophet rises in ${place}: ${count(free.length, 'temple')} raised, faith at ${Math.round(faith * 100)}%`;
        consequence = `A prophet rises in ${where}; ${free.length ? `${count(free.length, 'temple')} raised in their name and ` : ''}the people's faith deepens to ${Math.round(faith * 100)}%.`;
        break;
      }
      case 'goldrush': {
        const gain = Math.round(Math.max(20, country.treasury * (0.2 + sev * 1.5)));
        out.push(ev({ type: 'country_updated', countryId: country.id, patch: { treasury: country.treasury + gain } }));
        const grow = shuffled(here().filter((s) => GROW[s.kind]), rng).slice(0, 1 + Math.floor(sev * 3));
        for (const g of grow) out.push(ev({ type: 'structure_upgraded', structureId: g.id, kind: GROW[g.kind]! }));
        hitTiles = grow.length ? uniq(grow.map((g) => g.tile)) : shuffled(tiles, rng).slice(0, 2);
        result = `Gold struck in ${place}: the treasury gains ${fmtNum(gain)}${grow.length ? `, ${count(grow.length, 'settlement')} grow` : ''}`;
        consequence = `Gold is struck in ${where}; the treasury swells by ${fmtNum(gain)}${grow.length ? ` and ${count(grow.length, 'settlement')} grow` : ''}.`;
        break;
      }
      case 'rebellion': {
        const mine = world.regions.filter((r) => regionOwner(world, r.id) === country.id);
        const struck = inRegion.length && region ? [region] : shuffled(mine, rng).slice(0, 1 + Math.floor(sev * 3));
        if (struck.length) {
          let top = 0;
          for (const r of struck) {
            const unrest = Math.min(1, round2(r.unrest + 0.2 + sev * 0.6));
            top = Math.max(top, unrest);
            out.push(ev({ type: 'region_updated', regionId: r.id, patch: { unrest } }));
          }
          const names = struck.map((r) => r.name.replace(/^the /i, '')).filter(Boolean);
          const at = struck.length === 1 && names.length ? struck[0]!.name.replace(/^The /, 'the ') : nationName;
          hitTiles = owned.filter((x) => struck.some((r) => r.id === world.tiles[x]!.region));
          result = `Rebellion in ${at}: ${count(struck.length, 'region')} ${struck.length === 1 ? 'rises' : 'rise'}, unrest at ${Math.round(top * 100)}%`;
          consequence = `Rebellion stirs in ${struck.length === 1 && names.length ? `the ${names[0]} region of ${nationName}` : `${count(struck.length, 'region')} of ${nationName}`}; unrest climbs to ${Math.round(top * 100)}%.`;
        }
        break;
      }
      case 'none': break;
    }
  }
  entry.decree = {
    effect: decree.effect, severity: sev,
    target: { countryId: worldwide ? null : country && decree.effect !== 'none' ? country.id : t.countryId ?? null, tiles: hitTiles },
    result,
  };
  out.push(ev({ type: 'chronicle', entry: { id: `c-decree-${n}-b`, tick, year: world.year, kind: 'decree', countries, text: consequence } }));
  return out;
}
