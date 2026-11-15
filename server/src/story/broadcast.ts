// A21: Terra Nova News. Gemini looks at a picture of the globe plus the recent chronicle and writes a
// short news bulletin; ElevenLabs reads it in a newsreader voice. Template bulletin and bundled sample in mock.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { militaryStrength, yearLabel } from '@terra/shared';
import type { ChronicleEntry, ChronicleKind, NewsBattle, NewsFocus, StructureKind, World, WorldEvent } from '@terra/shared';
import { currentMode, getBudget, llmJson, loreModel, routeFor, type Schema } from '../llm';
import { speak, VoiceUnavailable } from './eleven';
import { anchorFor } from './teamVoices';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache', 'broadcast');
const KEEP = 10;

/** BROADCAST_MAX_PER_RUN: bulletins per world that may use Gemini and ElevenLabs (default 12). */
export const maxBroadcasts = () => {
  const n = Number(process.env.BROADCAST_MAX_PER_RUN);
  return Number.isFinite(n) && n > 0 ? n : 12;
};

export interface Bulletin {
  id: string; tick: number; year: number; headline: string; script: string; audio: string;
  /** The team voice reading this bulletin (Sam, Justin or Denis, in rotation). */
  anchor: string;
  /** Owner #288: 0 to 3 places to show while the anchor speaks, `atSecond` from the start of the audio. */
  focus: NewsFocus[];
}
interface Stored extends Bulletin { mood: string; voiced: boolean; voiceId: string }
export interface BroadcastResult { bulletin: Bulletin; source: 'gemini' | 'template'; tokensIn: number; tokensOut: number; ms: number }

let worldId = '';
let counter = 0;
let made = 0;
let lastHeadline = '';
let lastCounts: Map<number, number> | null = null;
const store = new Map<string, Stored>();

export const getBulletin = (id: string): Stored | undefined => store.get(id);

const FOCUS_DESC = 'The 1 to 3 places the bulletin talks about, in the order it speaks of them: place is an id from the Places list, caption at most 6 words.';
const schema: Schema = {
  type: 'object', required: ['headline', 'script', 'mood', 'focus'],
  properties: {
    headline: { type: 'string', description: 'At most 8 words.' },
    script: { type: 'string', description: 'A newsreader bulletin of 45 to 65 words, plain text.' },
    mood: { type: 'string', enum: ['grave', 'triumphant', 'neutral'] },
    focus: { type: 'array', description: FOCUS_DESC, maxItems: 3, items: { type: 'object', required: ['place', 'caption'], properties: { place: { type: 'integer' }, caption: { type: 'string' } } } },
  },
};

const SYSTEM = [
  'You are the anchor of Terra Nova News, the evening bulletin of a fictional world of rival nations.',
  'You are shown a picture of the world map right now, plus facts. Write a spoken news bulletin.',
  'The newest chronicle entries are the news: lead with the most dramatic of them (a plague, a meteor, a war',
  'declared, a ruler killed, a city fallen). Then use what you can SEE on the map (whose border moved, who',
  'holds a coast, who is hemmed in), but say it as a reporter standing in that world: lands, borders, coasts,',
  'banners and armies. Never say the words map, picture, image, colour, colored, shade or territory.',
  'Add one human detail. Use only the facts given; never invent wars or deaths.',
  'Speak in the voice of the world\'s era. 45 to 65 words, plain sentences for reading aloud, no markdown,',
  'no emojis, no stage directions, no sign-off name. Do not repeat the previous headline.',
].join(' ');

function tileCounts(w: World): Map<number, number> {
  const m = new Map<number, number>();
  for (const o of w.owner) if (o >= 0) m.set(o, (m.get(o) ?? 0) + 1);
  return m;
}

function facts(w: World): { text: string; biggest: string; war: string | null } {
  const counts = tileCounts(w);
  const name = (id: number) => w.countries[id]?.name ?? `nation ${id}`;
  const ranked = w.countries.filter((c) => c.alive).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  const shrinking = lastCounts
    ? w.countries.filter((c) => c.alive).map((c) => ({ c, d: (counts.get(c.id) ?? 0) - (lastCounts!.get(c.id) ?? 0) }))
      .filter((x) => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3)
    : [];
  const growing = lastCounts
    ? w.countries.filter((c) => c.alive).map((c) => ({ c, d: (counts.get(c.id) ?? 0) - (lastCounts!.get(c.id) ?? 0) }))
      .filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 2)
    : [];
  const rel = (s: string) => w.relations.filter((r) => r.stance === s && w.countries[r.a]?.alive && w.countries[r.b]?.alive)
    .map((r) => `${name(r.a)} and ${name(r.b)}`);
  const wars = rel('war'), alliances = rel('alliance');
  const silent = w.agents.filter((a) => (a.link === 'cut' || a.deleted) && w.countries[a.countryId]?.alive)
    .map((a) => `${name(a.countryId)} (${a.deleted ? 'its ruler removed' : 'cut off, silent'})`);
  const fallen = w.countries.filter((c) => !c.alive).map((c) => c.name);
  const chron = w.chronicle.slice(-20).map((e) => `- ${yearLabel(e.year)}: ${e.text}`).join('\n') || '- (nothing recorded yet)';
  const text = [
    `World: ${w.name}. Era: ${w.era}. Year ${yearLabel(w.year)}.`,
    `Biggest nations (provinces): ${ranked.slice(0, 4).map((c) => `${c.name} ${counts.get(c.id) ?? 0}`).join(', ') || 'none'}.`,
    growing.length ? `Growing since the last bulletin: ${growing.map((x) => `${x.c.name} (+${x.d})`).join(', ')}.` : '',
    shrinking.length ? `Shrinking since the last bulletin: ${shrinking.map((x) => `${x.c.name} (${x.d})`).join(', ')}.` : '',
    `Wars: ${wars.join('; ') || 'none'}. Alliances: ${alliances.join('; ') || 'none'}.`,
    silent.length ? `Silent or cut-off nations: ${silent.join(', ')}.` : '',
    fallen.length ? `Fallen nations: ${fallen.join(', ')}.` : '',
    `Latest chronicle (oldest first):\n${chron}`,
    lastHeadline ? `Previous headline (do not repeat): ${lastHeadline}` : '',
  ].filter(Boolean).join('\n');
  return { text, biggest: ranked[0]?.name ?? w.name, war: wars[0] ?? null };
}

const words = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(' ');

/** The no-API bulletin, built from the chronicle. */
function template(w: World, f: ReturnType<typeof facts>): { headline: string; script: string; mood: string } {
  const recent = w.chronicle.slice(-2).map((e) => e.text.replace(/\s+/g, ' ').replace(/[.!]+$/, ''));
  const headline = f.war ? words(`War between ${f.war}`, 8) : words(`${f.biggest} leads ${w.name}`, 8);
  const script = [
    `Good evening. This is the news from ${w.name}, in the year ${yearLabel(w.year)}.`,
    f.war ? `The war between ${f.war} continues.` : `For now no war is raging across the map.`,
    ...recent.map((t) => `${t}.`),
    `${f.biggest} remains the largest nation on the map. More after the break.`,
  ].join(' ');
  return { headline, script, mood: f.war ? 'grave' : 'neutral' };
}

async function ask(w: World, f: ReturnType<typeof facts>, ps: Place[], imageBase64: string, mimeType: string) {
  // Same routing as every other call (LLM_PROVIDER); the globe picture goes along as an image.
  const before = getBudget();
  const out = await llmJson<{ headline: string; script: string; mood: string; focus?: { place: number; caption: string }[] }>({
    model: loreModel(),
    purpose: 'broadcast',
    system: SYSTEM,
    prompt: `${f.text}\n${placesText(ps)}\n\nWrite the bulletin as JSON: headline (max 8 words), script (45 to 65 words), mood, and focus: the 1 to 3 places from the list the script speaks of, in the order it speaks of them, each with a caption of at most 6 words ("Steel works rise in Hatfield").`,
    schema,
    maxOutputTokens: 600,
    images: [{ data: imageBase64, mimeType }],
  });
  out.script = out.script.replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();
  out.headline = words(out.headline.replace(/[*_#`]/g, ''), 8);
  if (out.script.split(' ').length < 20) throw new Error('script too short');
  const after = getBudget();
  return { out, tokensIn: Math.max(0, after.tokensIn - before.tokensIn), tokensOut: Math.max(0, after.tokensOut - before.tokensOut) };
}

// --- focus beats (owner #288) ----------------------------------------------------------------
// Places the bulletin can cut to while it is read: built from the recent chronicle (a decree's tiles,
// a war's front province, a fallen capital, a wonder) and the newest notable buildings. Gemini picks
// from the numbered list; the template and mock mode take the first two.

interface Place { countryId: number | null; tile: number; caption: string; names: string[]; battle?: NewsBattle }

// --- battles seen (owner #317: the war report) -----------------------------------------------
// The world keeps no battle events, so the story routes feed every batch here (noteEvents); a war
// beat then points at the newest clash between the pair, with the losses summed on that tile.
interface SeenBattle { tile: number; attacker: number; defender: number; lastTick: number; lossA: number; lossD: number }
const BATTLE_GAP = 4;          // ticks without a clash before a new one on the tile counts as a new battle
const seenBattles: SeenBattle[] = [];

/** Every applied batch (from the runner); a snapshot (new world, replay) clears the record. */
export function noteEvents(events: readonly WorldEvent[]): void {
  for (const e of events) {
    if (e.type !== 'battle') continue;
    const i = seenBattles.findIndex((b) => b.tile === e.tile && e.tick - b.lastTick <= BATTLE_GAP
      && ((b.attacker === e.attacker && b.defender === e.defender) || (b.attacker === e.defender && b.defender === e.attacker)));
    const b = i >= 0 ? seenBattles.splice(i, 1)[0]! : { tile: e.tile, attacker: e.attacker, defender: e.defender, lastTick: e.tick, lossA: 0, lossD: 0 };
    const flipped = b.attacker !== e.attacker;
    b.lossA += flipped ? e.losses.defender : e.losses.attacker;
    b.lossD += flipped ? e.losses.attacker : e.losses.defender;
    b.lastTick = e.tick;
    seenBattles.push(b);                    // newest last
    if (seenBattles.length > 40) seenBattles.shift();
  }
}
export function clearBattles(): void { seenBattles.length = 0; }

/** The war report for a war between `a` and `b`: their newest battle, else the front tile. */
function battleFor(w: World, a: number, b: number, front: number): NewsBattle {
  const seen = [...seenBattles].reverse().find((x) => (x.attacker === a && x.defender === b) || (x.attacker === b && x.defender === a));
  const attackerId = seen?.attacker ?? a, defenderId = seen?.defender ?? b;
  return {
    tile: seen && w.tiles[seen.tile] ? seen.tile : front, attackerId, defenderId,
    strength: { attacker: militaryStrength(w, attackerId), defender: militaryStrength(w, defenderId) },
    ...(seen ? { losses: { attacker: seen.lossA, defender: seen.lossD } } : {}),
  };
}

const WORDS_PER_SECOND = 2.6;
/** The caption, or its other wording when the place name already holds the noun (#317: never
 *  "Ormand City grows into a city" or "A new harbour in Harbour Bay"). */
const unless = (word: RegExp, r: string, plain: string, other: string): string => (word.test(r) ? other : plain);
const BUILT_CAPTION: Partial<Record<StructureKind, (where: string) => string>> = {
  factory: (r) => unless(/\b(steel|works?)\b/i, r, `Steel works rise in ${r}`, `Mills and furnaces rise in ${r}`),
  city: (r) => unless(/\b(city|town)\b/i, r, `${r} grows into a city`, `${r} comes of age`),
  temple: (r) => unless(/\btemple\b/i, r, `A temple rises in ${r}`, `A new shrine in ${r}`),
  fort: (r) => unless(/\b(walls?|fort)\b/i, r, `New walls rise in ${r}`, `${r} is fortified`),
  port: (r) => unless(/\b(harbou?r|port)\b/i, r, `A new harbour in ${r}`, `New quays in ${r}`),
  town: (r) => unless(/\b(city|town)\b/i, r, `${r} grows into a town`, `${r} starts to bustle`),
};
const KIND_CAPTION: Partial<Record<ChronicleKind, (nation: string) => string>> = {
  founding: (n) => `${n} is founded`, proclamation: (n) => `${n} proclaims`, growth: (n) => `${n} grows`,
  peace: (n) => `Peace for ${n}`, alliance: (n) => `${n} seals an alliance`, betrayal: (n) => `Betrayal in ${n}`,
  silence: (n) => `${n} falls silent`, return: (n) => `${n} is heard again`, dispute: (n) => `A dispute in ${n}`,
  death: (n) => `Mourning in ${n}`, succession: (n) => `A new ruler in ${n}`,
};
const bare = (name: string) => name.replace(/^the /i, '');

function places(w: World): Place[] {
  const out: Place[] = [];
  const seen = new Set<number>();
  const country = (id: number | undefined) => (id !== undefined ? w.countries[id] : undefined);
  const regionName = (tile: number) => bare(w.regions[w.tiles[tile]?.region ?? -1]?.name || '');
  const add = (p: Place) => {
    if (!w.tiles[p.tile] || seen.has(p.tile) || out.length >= 8) return;
    seen.add(p.tile);
    out.push({ ...p, names: p.names.filter((n) => n.length >= 3) });
  };
  const ownedBy = (id: number) => { const t: number[] = []; for (let i = 0; i < w.owner.length; i++) if (w.owner[i] === id) t.push(i); return t; };
  /** A province of `a` that touches `b`: the front. */
  const front = (a: number, b: number): number | undefined => ownedBy(a).find((t) => w.tiles[t]!.neighbors.some((x) => w.owner[x] === b));
  const recent: ChronicleEntry[] = w.chronicle.slice(-20).reverse();       // newest first
  for (const e of recent) {
    const c0 = country(e.countries[0]);
    if (e.decree && e.decree.target.tiles.length) {
      const c = country(e.decree.target.countryId ?? undefined);
      const t = e.decree.effect === 'meteor' ? e.decree.target.tiles[0]! : e.decree.target.tiles[Math.floor(e.decree.target.tiles.length / 2)]!;
      add({ countryId: c?.id ?? null, tile: t, caption: e.decree.result.split(':')[0]!, names: [c ? bare(c.name) : '', regionName(t), e.decree.effect] });
    } else if ((e.kind === 'war' || e.kind === 'battle') && e.countries.length >= 2) {
      const [a, b] = e.countries as [number, number];
      const f = front(a, b) ?? front(b, a);
      const battle = f !== undefined ? battleFor(w, a, b, f) : undefined;
      const t = battle?.tile;
      if (t !== undefined) add({ countryId: w.owner[t]! >= 0 ? w.owner[t]! : battle!.attackerId, tile: t, caption: `War on the ${regionName(t) || bare(country(a)?.name ?? 'border')} front`, names: [bare(country(a)?.name ?? ''), bare(country(b)?.name ?? ''), regionName(t)], battle });
    } else if (e.kind === 'fall' && c0) {
      add({ countryId: c0.id, tile: c0.capitalTile, caption: `${c0.name} falls`, names: [bare(c0.name), regionName(c0.capitalTile)] });
    } else if (e.kind === 'wonder' && c0) {
      const wonder = w.structures.filter((s) => s.kind === 'wonder' && s.owner === c0.id).sort((a, b) => b.builtTick - a.builtTick)[0];
      if (wonder) add({ countryId: c0.id, tile: wonder.tile, caption: `${wonder.name ?? 'A wonder'} rises in ${regionName(wonder.tile) || bare(c0.name)}`, names: [wonder.name ?? '', bare(c0.name), regionName(wonder.tile)] });
    } else if (e.kind === 'secession' && c0) {
      const c = country(e.countries[e.countries.length - 1]) ?? c0;
      add({ countryId: c.id, tile: c.capitalTile, caption: `${c.name} breaks away`, names: [bare(c.name), regionName(c.capitalTile)] });
    }
  }
  // Active wars not in the recent lines.
  for (const r of w.relations) {
    if (r.stance !== 'war' || !w.countries[r.a]?.alive || !w.countries[r.b]?.alive) continue;
    // Owner #317: a war over open land (the warmonger's) has no shared border yet; its newest battle or the aggressor's capital stands in.
    const f = front(r.a, r.b) ?? front(r.b, r.a);
    const battle = battleFor(w, r.a, r.b, f ?? w.countries[r.a]!.capitalTile);
    const t = battle.tile;
    add({ countryId: w.owner[t]! >= 0 ? w.owner[t]! : battle.attackerId, tile: t, caption: `War on the ${regionName(t) || bare(w.countries[r.a]!.name)} front`, names: [bare(w.countries[r.a]!.name), bare(w.countries[r.b]!.name), regionName(t)], battle });
  }
  // The newest notable buildings.
  const built = w.structures.filter((s) => BUILT_CAPTION[s.kind] && w.countries[s.owner]?.alive).sort((a, b) => b.builtTick - a.builtTick || (a.id < b.id ? -1 : 1)).slice(0, 4);
  for (const s of built) {
    const c = w.countries[s.owner]!;
    add({ countryId: c.id, tile: s.tile, caption: BUILT_CAPTION[s.kind]!(regionName(s.tile) || bare(c.name)), names: [bare(c.name), regionName(s.tile)] });
  }
  // Recent lines about a nation not shown yet: its capital.
  for (const e of recent) {
    const c0 = country(e.countries[0]);
    if (!c0?.alive || e.kind === 'decree' || out.some((p) => p.countryId === c0.id)) continue;
    add({ countryId: c0.id, tile: c0.capitalTile, caption: (KIND_CAPTION[e.kind] ?? ((n: string) => `News from ${n}`))(c0.name), names: [bare(c0.name), regionName(c0.capitalTile)] });
  }
  // Always something: the biggest nations' capitals.
  const counts = tileCounts(w);
  for (const c of w.countries.filter((x) => x.alive).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, 2)) {
    add({ countryId: c.id, tile: c.capitalTile, caption: `${c.name} holds ${counts.get(c.id) ?? 0} provinces`, names: [bare(c.name), regionName(c.capitalTile)] });
  }
  return out;
}

const placesText = (ps: Place[]) => ps.length
  ? `Places (id: what is there):\n${ps.map((p, i) => `${i}: ${p.caption}`).join('\n')}`
  : 'Places: none.';

/** Time the beats against the spoken audio (about 2.6 words a second): each at the first mention of
 *  one of its names after the previous beat, else spread evenly; always rising, at least 3 s apart. */
function timeBeats(chosen: { place: Place; caption: string }[], spokenText: string): NewsFocus[] {
  const ws = spokenText.split(/\s+/).filter(Boolean);
  const total = ws.length / WORDS_PER_SECOND;
  const lower = ws.map((x) => x.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ''));
  const intro = spokenText.indexOf('Terra Nova News.') >= 0 ? spokenText.slice(0, spokenText.indexOf('Terra Nova News.') + 16).split(/\s+/).length : 0;
  const find = (names: string[], from: number): number => {
    let best = -1;
    for (const n of names) {
      const parts = n.toLowerCase().split(/\s+/).map((x) => x.replace(/[^\p{L}\p{N}'-]/gu, '')).filter(Boolean);
      if (!parts.length) continue;
      for (let i = from; i <= lower.length - parts.length; i++) {
        if (parts.every((p, j) => lower[i + j]!.startsWith(p))) { if (best < 0 || i < best) best = i; break; }
      }
    }
    return best;
  };
  const out: NewsFocus[] = [];
  let from = intro; let prev = -Infinity;
  chosen.forEach((c, i) => {
    const at = find(c.place.names, from);
    const even = (intro + ((ws.length - intro) * i) / Math.max(1, chosen.length)) / WORDS_PER_SECOND;
    let sec = at >= 0 ? at / WORDS_PER_SECOND - 0.5 : even;
    if (at >= 0) from = at + 1;
    sec = Math.max(sec, prev + 3, 0);
    sec = Math.min(sec, Math.max(0, total - 2));
    prev = sec;
    out.push({ countryId: c.place.countryId, tile: c.place.tile, atSecond: Math.round(sec * 10) / 10, caption: c.caption, ...(c.place.battle ? { battle: c.place.battle } : {}) });
  });
  return out;
}

/** Gemini's picks, cleaned; else the first two places. */
function focusFor(ps: Place[], picks: { place: number; caption: string }[] | undefined, spokenText: string): NewsFocus[] {
  const chosen: { place: Place; caption: string }[] = [];
  const used = new Set<number>();
  for (const p of picks ?? []) {
    const place = ps[p.place];
    if (!place || used.has(p.place) || chosen.length >= 3) continue;
    used.add(p.place);
    const caption = words(p.caption.replace(/[*_#`"]/g, '').trim(), 8) || place.caption;
    chosen.push({ place, caption });
  }
  if (!chosen.length) {
    // The template (and a Gemini answer without picks): the places the script names, in the order it
    // names them, then the first places on the list, two in all.
    const lower = spokenText.toLowerCase();
    const at = (p: Place) => Math.min(...p.names.map((n) => { const i = n ? lower.indexOf(n.toLowerCase()) : -1; return i < 0 ? Infinity : i; }));
    const named = ps.filter((p) => at(p) < Infinity).sort((a, b) => at(a) - at(b));
    for (const place of [...named, ...ps.filter((p) => !named.includes(p))].slice(0, 2)) chosen.push({ place, caption: place.caption });
  }
  // Owner #317: a bulletin that speaks of war shows a battle (the war-report strap rides on that beat).
  const war = ps.find((p) => p.battle);
  if (war && /\b(war|wars|battle|battles|armies|army|front|siege)\b/i.test(spokenText.replace(/\bno (war|battle)s?\b/gi, '')) && !chosen.some((c) => c.place.battle)) {
    const c = { place: war, caption: war.caption };
    if (chosen.length >= (picks?.length ? 3 : 2)) chosen[chosen.length - 1] = c; else chosen.push(c);
    const at = (p: Place) => { const l = spokenText.toLowerCase(); return Math.min(...p.names.map((n) => { const i = n ? l.indexOf(n.toLowerCase()) : -1; return i < 0 ? Infinity : i; })); };
    chosen.sort((x, y) => at(x.place) - at(y.place));
  }
  return timeBeats(chosen, spokenText);
}

// --- audio ---------------------------------------------------------------------------------
const exists = (p: string) => fs.access(p).then(() => true, () => false);
const inflight = new Map<string, Promise<void>>();
const spoken = (b: { script: string; anchor: string }) => `This is ${b.anchor} for Terra Nova News. ${b.script}`;
export const audioFile = (b: { script: string; anchor: string; voiceId: string }) =>
  path.join(CACHE, `${crypto.createHash('sha256').update(`${b.voiceId}\n${spoken(b)}`).digest('hex')}.mp3`);

/** Make the bulletin's mp3 once, even when several requests ask at the same time. */
export function ensureAudio(b: Stored, cachedOnly = false): Promise<string> {
  const file = audioFile(b);
  let p = inflight.get(file);
  if (!p) {
    p = (async () => {
      if (await exists(file)) return;
      if (cachedOnly) throw new VoiceUnavailable('not recorded');
      if (!b.voiced) throw new VoiceUnavailable('broadcast cap reached');
      const buf = await speak(spoken(b), b.voiceId, { settings: { stability: 0.6, similarity_boost: 0.75, style: 0.2 } });
      await fs.mkdir(CACHE, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, buf);
      await fs.rename(tmp, file);
    })().finally(() => inflight.delete(file));
    inflight.set(file, p);
  }
  return p.then(() => file);
}

// --- the bulletin --------------------------------------------------------------------------
export async function makeBroadcast(w: World, imageBase64: string, mimeType: string, offline = false): Promise<BroadcastResult> {
  const started = Date.now();
  if (w.id !== worldId) { worldId = w.id; made = 0; lastHeadline = ''; lastCounts = null; store.clear(); }
  const f = facts(w);
  const live = !offline && currentMode() === 'live' && (!!process.env.GEMINI_API_KEY || routeFor('broadcast') === 'ollama');
  const underCap = made < maxBroadcasts();
  const ps = places(w);
  let body: { headline: string; script: string; mood: string; focus?: { place: number; caption: string }[] } | null = null;
  let tokensIn = 0, tokensOut = 0;
  if (underCap) made++;
  if (live && underCap && !getBudget().capped) {
    try {
      const r = await ask(w, f, ps, imageBase64, mimeType);
      body = r.out; tokensIn = r.tokensIn; tokensOut = r.tokensOut;
    } catch (e) {
      console.warn('broadcast gemini failed, using the template:', e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  const source = body ? 'gemini' : 'template';
  body ??= template(w, f);
  const id = `b-${++counter}`;
  const anchor = anchorFor(counter);
  const { focus: picks, ...text } = body;
  const focus = focusFor(ps, picks, spoken({ script: text.script, anchor: anchor.name }));
  const stored: Stored = { id, tick: w.tick, year: w.year, ...text, focus, audio: `/api/broadcast/${id}/audio`, voiced: underCap, anchor: anchor.name, voiceId: anchor.id };
  store.set(id, stored);
  while (store.size > KEEP) store.delete(store.keys().next().value as string);
  lastHeadline = stored.headline;
  lastCounts = tileCounts(w);
  // Warm the audio in the background so the GET is quick.
  if (currentMode() === 'live' && underCap) void ensureAudio(stored).catch(() => { /* the GET answers 503 */ });
  const { mood: _m, voiced: _v, voiceId: _i, ...bulletin } = stored;
  void _m; void _v; void _i;
  return { bulletin, source, tokensIn, tokensOut, ms: Date.now() - started };
}
