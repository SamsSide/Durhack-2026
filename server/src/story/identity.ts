// A24 (sound and feel): who a nation is, as data. One pure function reads the world's era, the nation's
// tech age, building style, government, ideology, terrain and temperament and returns the words the
// anthem, chant, narration, flag and chronicle prompts need. Tables from docs/research/nation-identity.md.
import type { BuildingStyle, Country, FlagEmblem, FlagLayout, TechAge, World } from '@terra/shared';

export type EraKey = 'bronze' | 'classical' | 'medieval' | 'gunpowder' | 'industrial' | 'modern' | 'future' | 'post_apoc';
export type GovKey = 'communist' | 'junta' | 'theocracy' | 'merchant' | 'democracy' | 'monarchy' | 'tribal' | 'technocracy';
export type MoodKey = 'martial' | 'pious' | 'wealthy' | 'pioneer';
export type TerrainKey = 'mountain' | 'coast' | 'ice' | 'desert' | 'forest' | 'plains';

// --- era -------------------------------------------------------------------------------------
const ERA_RULES: [EraKey, RegExp][] = [
  ['post_apoc', /post.?apocalyp|wasteland|fallout|ruined|drowned/],
  ['future', /\b(space|sci-?fi|cyberpunk|future|star|galactic)\b/],
  ['modern', /modern|cold war|20th|21st|atomic|contemporary/],
  ['industrial', /industrial|steam|victorian|19th|railway|steampunk/],
  ['gunpowder', /renaissance|gunpowder|colonial|age of sail|early modern|1[678]th/],
  ['medieval', /medieval|feudal|dark age|crusade|viking|knights/],
  ['classical', /classical|antiquity|iron age|roman|hellenic|republic of/],
  ['bronze', /bronze|stone age|neolithic|pharaoh|chariot|\bdawn\b|\bancient\b/],
];
const ERA_ORDER: EraKey[] = ['bronze', 'classical', 'medieval', 'gunpowder', 'industrial', 'modern', 'future', 'post_apoc'];

/** The era band of the world's setting (first match wins; medieval by default). */
export function worldEraKey(world: Pick<World, 'era' | 'prompt' | 'name'>): EraKey {
  const text = `${world.era ?? ''} ${world.prompt ?? ''}`.toLowerCase();
  return ERA_RULES.find(([, re]) => re.test(text))?.[0] ?? 'medieval';
}

const AGE_ERA: Record<TechAge, EraKey> = { ancient: 'classical', medieval: 'medieval', gunpowder: 'gunpowder', industrial: 'industrial', modern: 'modern', future: 'future', stellar: 'future' };

/** The nation's era now: a ruined or far-future setting wins; otherwise its tech age (it advances during a run).
 *  A nation with no tech age yet takes the world's own era; an explicit 'ancient' is bronze or classical. */
export function eraKeyOf(world: Pick<World, 'era' | 'prompt' | 'name'>, country: Pick<Country, 'techAge'>): EraKey {
  const band = worldEraKey(world);
  if (band === 'post_apoc' || band === 'future') return band;
  const age = country.techAge;
  if (!age) return band;
  if (age === 'ancient') return ERA_ORDER.indexOf(band) <= 1 ? band : 'classical'; // an ancient nation in a medieval world is still ancient
  return AGE_ERA[age];
}

// --- government ------------------------------------------------------------------------------
const GOV_RULES: [GovKey, RegExp][] = [
  ['communist', /communis|soviet|socialist|collective|people's|worker|proletar|commune|\bparty\b/],
  ['junta', /junta|military|martial|warlord|general|garrison|praetor|stratocra/],
  ['theocracy', /theocra|church|temple|priest|holy|faith|divine|prophet|caliphate|oracle|dominion/],
  ['merchant', /merchant|trade|guild|mercantile|company|bank|plutocra|league|oligarch/],
  ['democracy', /democra|republic|senate|parliament|council of citizens|liberal|federation/],
  ['monarchy', /king|queen|crown|empire|emperor|monarch|dynasty|throne|sultan|shah|pharaoh|court/],
  ['tribal', /tribe|tribal|clan|chief|horde|khan|herder|\bband\b|war-?band|elders|confederacy/],
  ['technocracy', /technocra|\bai\b|machine|algorithm|engineer|corporate|syndicate/],
];

/** Government type from the government text first, then the ideology; nomads are tribal; else a temperament fallback. */
export function governmentKeyOf(c: Pick<Country, 'government' | 'ideology' | 'temperament' | 'nomadic'>): GovKey {
  for (const text of [c.government, c.ideology]) {
    const s = (text ?? '').toLowerCase();
    const hit = GOV_RULES.find(([, re]) => re.test(s));
    if (hit) return hit[0];
  }
  if (c.nomadic) return 'tribal';
  return c.temperament.aggression > 0.6 ? 'monarchy' : 'tribal';
}

// --- terrain and mood ------------------------------------------------------------------------
export function terrainKeyOf(world: Pick<World, 'tiles' | 'owner'>, c: Pick<Country, 'id' | 'capitalTile'>): TerrainKey {
  const n: Record<string, number> = {};
  let land = 0;
  for (const t of world.tiles) {
    if (world.owner[t.id] !== c.id || t.terrain === 'ocean') continue;
    n[t.terrain] = (n[t.terrain] ?? 0) + 1; land++;
  }
  if (!land) return 'plains';
  const share = (...k: string[]) => k.reduce((a, x) => a + (n[x] ?? 0), 0) / land;
  if (share('mountain', 'hills') >= 0.4) return 'mountain';
  if (share('coast') >= 0.35 || world.tiles[c.capitalTile]?.terrain === 'coast') return 'coast';
  if (share('ice') >= 0.3) return 'ice';
  if (share('desert') >= 0.4) return 'desert';
  if (share('forest') >= 0.4) return 'forest';
  return 'plains';
}

export function moodKeyOf(t: Country['temperament']): MoodKey {
  const order: [MoodKey, number][] = [['martial', t.aggression], ['pious', t.faith], ['wealthy', t.trade], ['pioneer', t.expansion]];
  return order.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

// --- tables: sound ---------------------------------------------------------------------------
const ERA_SOUND: Record<EraKey, { instruments: string; percussion: string; production: string; negative: string; diction: string }> = {
  bronze: { instruments: 'lyre, reed pipes, sistrum, harp', percussion: 'frame drums, clappers, sistrum', production: 'raw, ritual, reverb of stone halls', negative: 'electric guitar, synthesizer, drum machine, modern pop', diction: 'oaths by spear, sun and river' },
  classical: { instruments: 'kithara, aulos, Roman horn', percussion: 'tympanum, marching feet', production: 'open air, sparse', negative: 'electric guitar, synthesizer, drum machine, modern pop', diction: 'legions, gods, laurels and the republic' },
  medieval: { instruments: 'vielle, shawm, lute, church bells', percussion: 'tabor, war horns', production: 'monastic reverb', negative: 'electric guitar, synthesizer, drum machine, modern pop', diction: 'banners, oaths, steel and the old faith' },
  gunpowder: { instruments: 'fifes, natural trumpets, harpsichord, strings', percussion: 'snare and bass drum', production: 'baroque court', negative: 'electric guitar, synthesizer, drum machine', diction: 'cannon, flags, sails and crowns' },
  industrial: { instruments: 'brass band, full orchestra, organ', percussion: 'military snare, timpani', production: '1900s recording, slight crackle', negative: 'synthesizer, drum machine, electric guitar', diction: 'furnaces, rails, engines and the working day' },
  modern: { instruments: 'symphony orchestra, synth pads', percussion: 'stadium drums, claps', production: 'modern cinematic, clean', negative: 'lute, medieval', diction: 'the nation, the people, the flag' },
  future: { instruments: 'analog synths, choir pads, arpeggiator', percussion: 'electronic toms, sub bass', production: 'wide, glossy, sci-fi', negative: 'lute, harpsichord', diction: 'stars, circuits and the long horizon' },
  post_apoc: { instruments: 'scavenged metal, detuned guitar, harmonica', percussion: 'pipes and barrels hit, distorted kick', production: 'lo-fi, distorted', negative: 'orchestra, polished studio', diction: 'ash, rust, scrap and survival' },
};

const GOV_SOUND: Record<GovKey, {
  form: string; tempo: string; voices: string; verse: string; chorus: string;
  chantVocals: string; chantBpm: number; narration: string;
}> = {
  communist: { form: 'heroic march in 4/4', tempo: '100 BPM, C major', voices: 'massed male choir, unison then harmony', verse: 'steady march, unison choir', chorus: 'full choir in harmony, triumphant', chantVocals: 'army choir shouting hurrah calls', chantBpm: 110, narration: 'deep, measured, a state radio announcer' },
  junta: { form: 'military march in 2/4', tempo: '116 BPM, D minor', voices: 'short shouted male refrain over the march', verse: 'cold brass and snare, clipped', chorus: 'shouted refrain, relentless', chantVocals: 'drill sergeant call and response', chantBpm: 126, narration: 'clipped, cold, a male officer' },
  theocracy: { form: 'solemn hymn, plainchant', tempo: '66 BPM, D Dorian', voices: 'monophonic male chant, then full choir with temple bells', verse: 'solo plainchant, bells', chorus: 'full choir with organ, soaring', chantVocals: 'a chanted litany over bell strikes', chantBpm: 76, narration: 'slow, reverent, with cathedral reverb' },
  democracy: { form: 'stately patriotic hymn in 4/4', tempo: '84 BPM, B flat major', voices: 'mixed choir, hopeful', verse: 'steady, building', chorus: 'full mixed choir, rousing, memorable melody', chantVocals: 'crowd chant with stomps', chantBpm: 104, narration: 'warm, confident, a documentary narrator' },
  merchant: { form: 'festive processional', tempo: '96 BPM, F major', voices: 'small bright choir', verse: 'lively, bright', chorus: 'full, rousing, festive', chantVocals: 'sailors work-song shout', chantBpm: 116, narration: 'wry, smooth, worldly' },
  monarchy: { form: 'grand ceremonial piece in 3/4 with a fanfare intro', tempo: '76 BPM, E flat major', voices: 'solemn choir', verse: 'fanfare, then slow and noble', chorus: 'full choir, majestic', chantVocals: 'knights battle cry with horns', chantBpm: 96, narration: 'aristocratic, formal, older' },
  tribal: { form: 'call-and-response song', tempo: '90 BPM, A minor pentatonic', voices: 'lead singer with a group answering', verse: 'lead voice over drums', chorus: 'group answers, driving', chantVocals: 'ululation, drums, war whoops', chantBpm: 110, narration: 'a storyteller by the fire, gravelly' },
  technocracy: { form: 'minimal electronic piece', tempo: '120 BPM, A minor', voices: 'vocoder choir', verse: 'pulsing, precise', chorus: 'layered vocoder choir, bright', chantVocals: 'synthesised count-off', chantBpm: 132, narration: 'calm, precise, AI-like' },
};

const NOMAD_SOUND = { instruments: 'morin khuur horsehead fiddle, throat singing, frame drums', voices: 'throat singing and long-song phrasing' };
const MOOD_WORDS: Record<MoodKey, string> = { martial: 'aggressive, driving', pious: 'devout, soaring', wealthy: 'lavish, triumphant', pioneer: 'hopeful, rising' };
const TERRAIN_TOUCH: Record<TerrainKey, string> = {
  mountain: 'deep horns echoing', coast: 'a rolling sea rhythm', ice: 'a low cold drone', desert: 'ney flute and oud', forest: 'wooden flutes', plains: '',
};
const LANGUAGE: Partial<Record<BuildingStyle, string>> = {
  classical: 'sung in Latin- or Greek-like vowels', medieval: 'sung in an Old English or Old French feel', desert: 'with Arabic or Persian melisma',
  east_asian: 'pentatonic, with a Mandarin or Japanese feel', mesoamerican: 'sung with a Nahuatl or Quechua feel', scrap: 'with broken shouted English',
  soviet_bloc: 'sung with a Russian feel', egyptian: 'ancient chant-like phrasing', highland: 'with a Tibetan or alpine yodel feel',
  norse: 'with a Norse skald feel', south_asian: 'with a raga feel', sahel: 'with a griot call-and-response feel',
};

// --- tables: chant, narration, chronicle -----------------------------------------------------
export interface ChantStyle {
  key: string;
  /** Used in the Gemini prompt: what kind of chant to write. */
  line: string;
  /** Delivery for eleven_v3: the audio tag and voice settings (v3 stability is 0 creative, 0.5 natural, 1 robust). */
  tag: string; stability: number; style: number;
  /** A premade voice to prefer for non-team nations (a commander or a deep choir voice). */
  voiceKey?: 'harry' | 'brian' | 'bill';
  voiced: string;
}
const CHANT: Record<GovKey, ChantStyle> = {
  communist: { key: 'hurrah choir', line: 'a massed army choir: a short marching slogan with a "Hurrah!" call, repeated', tag: '[shouting]', stability: 0, style: 0.6, voiceKey: 'brian', voiced: 'a massed army choir' },
  junta: { key: 'drill call', line: 'a drill sergeant call and response: three or four terse barked commands and the troops answering "Sir"', tag: '[barking orders, shouting]', stability: 0.5, style: 0.5, voiceKey: 'harry', voiced: 'a single commander' },
  theocracy: { key: 'litany', line: 'a solemn litany: a priest intones a line of praise or doom and the faithful answer with a short refrain such as "so it is written"', tag: '[solemnly, intoning, slowly]', stability: 0.5, style: 0.3, voiceKey: 'bill', voiced: 'a priest and the faithful' },
  democracy: { key: 'slogan', line: 'a crowd slogan: one rhythmic, defiant phrase about liberty or the people, repeated twice', tag: '[shouting, crowd]', stability: 0, style: 0.5, voiced: 'a crowd' },
  merchant: { key: 'work shout', line: 'a sailors work-song shout: a rolling hauling line with a repeated "heave" or "hoy" refrain about gold and the tide', tag: '[shouting, rhythmic]', stability: 0, style: 0.6, voiced: 'a crew hauling ropes' },
  monarchy: { key: 'battle cry', line: 'a knights battle cry for the crown: honour, the sovereign and the royal banner, repeated twice', tag: '[shouting, fierce]', stability: 0, style: 0.6, voiced: 'a company of knights' },
  tribal: { key: 'ululation', line: 'a tribal war chant: short repeated syllable phrases, ancestors and the hunt, with a closing war whoop', tag: '[shouting, ululating, war whoop]', stability: 0, style: 0.8, voiceKey: 'harry', voiced: 'a war band' },
  technocracy: { key: 'count-off', line: 'a cold synthesised count-off: numbers, efficiency, the system, a clipped repeated phrase', tag: '[monotone, flat, precise]', stability: 1, style: 0.1, voiced: 'a synthesised voice' },
};

const CHRONICLE: Record<GovKey, string> = {
  communist: 'Write as a state newspaper: collective heroes, quotas exceeded, enemies are reactionaries.',
  junta: 'Write as a military communique: terse, ranks and objectives, no doubts.',
  theocracy: 'Write as scripture: divine will, omens, blessed and accursed.',
  democracy: "Write as a free press: debate, votes, the citizens' mood.",
  merchant: "Write as a ledger and gossip sheet: profits, contracts, rivals' prices.",
  monarchy: "Write as a court chronicler: the sovereign's glory, lineage, honour.",
  tribal: "Write as an elder's tale: ancestors, seasons, the hunt.",
  technocracy: 'Write as a system log: metrics, efficiency, optimisation.',
};

/** The one-line chronicle voice of a government, for the ruler's proclamation prompt. */
export const chronicleToneOf = (g: GovKey): string => CHRONICLE[g];

// --- tables: flags (5.1) ---------------------------------------------------------------------
export interface FlagRule { layouts: FlagLayout[]; emblems: FlagEmblem[]; gold?: boolean }
export const FLAG_RULES: Record<GovKey, FlagRule> = {
  communist: { layouts: ['plain', 'horizontal2', 'canton'], emblems: ['star', 'gear', 'wheat'], gold: true },
  junta: { layouts: ['horizontal3', 'diagonal'], emblems: ['sword', 'star', 'tower'] },
  theocracy: { layouts: ['cross', 'saltire', 'plain'], emblems: ['sun', 'moon', 'eye', 'flame', 'crown'], gold: true },
  democracy: { layouts: ['canton', 'vertical3', 'horizontal3', 'cross'], emblems: ['star', 'tree', 'wheat'] },
  merchant: { layouts: ['horizontal2', 'border', 'horizontal3'], emblems: ['anchor', 'wheat', 'wave'] },
  monarchy: { layouts: ['border', 'plain', 'vertical2'], emblems: ['crown', 'tower', 'tree', 'eye'], gold: true },
  tribal: { layouts: ['plain', 'diagonal', 'vertical2'], emblems: ['sun', 'moon', 'mountain', 'tree', 'sword', 'skull'] },
  technocracy: { layouts: ['diagonal', 'horizontal3', 'border'], emblems: ['gear', 'eye', 'tower'] },
};
/** In a ruined world every banner leans on skulls and flames. */
export const POST_APOC_EMBLEMS: FlagEmblem[] = ['skull', 'flame'];

/** The flag guidance written into the Gemini bible prompt. */
export const FLAG_PROMPT = 'Flags follow the ideology: communist or socialist = star, gear or wheat on a plain, horizontal2 or canton field (red field, gold emblem); '
  + 'military or junta = sword, star or tower on horizontal3 or diagonal; theocracy = sun, moon, eye, flame or crown on cross, saltire or plain (white and gold); '
  + 'democracy or republic = star on canton, vertical3, horizontal3 or cross; merchant or naval = anchor, wheat or wave on horizontal2 or border (sea blue and a rich colour); '
  + 'monarchy = crown, tower or tree on border, plain or vertical2 (purple or deep red, gold); tribal or nomad = sun, moon, mountain or tree on plain, diagonal or vertical2 (earth tones); '
  + 'technocracy = gear or eye on diagonal (cyan, black, white). In a post-apocalyptic world favour skull and flame. Vary layouts and emblems: no more than two nations alike.';

/** Pick the least-used option of `allowed`, preferring `current` when it is allowed. */
function leastUsed<T extends string>(allowed: T[], current: T, used: Map<string, number>, salt: number): T {
  if (allowed.includes(current)) return current;
  const min = Math.min(...allowed.map((a) => used.get(a) ?? 0));
  const best = allowed.filter((a) => (used.get(a) ?? 0) === min);
  return best[salt % best.length]!;
}

/** Steer one flag's layout, emblem and emblem colour to its government (and a ruined era), keeping variety across nations.
 *  `used` counts layouts and emblems already taken; it is updated. Colours are left alone except the emblem colour. */
export function steerFlag<F extends { layout: FlagLayout; colors: string[]; emblem: FlagEmblem; emblemColor: string }>(
  flag: F, gov: GovKey, era: EraKey, used: Map<string, number>, salt: number,
): F {
  const rule = FLAG_RULES[gov];
  const emblems = era === 'post_apoc' ? [...POST_APOC_EMBLEMS, rule.emblems[0]!] : rule.emblems;
  const layout = leastUsed(rule.layouts, flag.layout, used, salt);
  let emblem = leastUsed(emblems, flag.emblem, used, salt >> 1);
  // "At most two alike": a third identical emblem moves to the next allowed one.
  if ((used.get(emblem) ?? 0) >= 2) emblem = emblems.find((e) => (used.get(e) ?? 0) < 2) ?? emblem;
  used.set(layout, (used.get(layout) ?? 0) + 1);
  used.set(emblem, (used.get(emblem) ?? 0) + 1);
  const field = flag.colors[0] ?? '#808080';
  const lum = (h: string) => 0.2126 * parseInt(h.slice(1, 3), 16) + 0.7152 * parseInt(h.slice(3, 5), 16) + 0.0722 * parseInt(h.slice(5, 7), 16);
  const emblemColor = rule.gold && /^#[0-9a-f]{6}$/i.test(field) && lum(field) < 170 ? '#e8b923' : flag.emblemColor;
  return { ...flag, layout, emblem, emblemColor };
}

// --- the identity ----------------------------------------------------------------------------
export interface Identity {
  eraKey: EraKey; governmentKey: GovKey; terrain: TerrainKey; mood: MoodKey;
  music: { instruments: string; production: string; form: string; tempo: string; voices: string; language: string; mood: string; verse: string; chorus: string; negative: string };
  narrationTone: string;
  chantStyle: ChantStyle & { percussion: string; vocals: string; bpm: number; tempo: string; diction: string };
  chronicleTone: string;
}

type IdentityCountry = Pick<Country, 'id' | 'capitalTile' | 'government' | 'ideology' | 'temperament' | 'techAge' | 'buildingStyle' | 'nomadic'>;

export function nationIdentity(world: Pick<World, 'era' | 'prompt' | 'name' | 'tiles' | 'owner'>, c: IdentityCountry): Identity {
  const eraKey = eraKeyOf(world, c);
  const governmentKey = governmentKeyOf(c);
  const terrain = terrainKeyOf(world, c);
  const mood = moodKeyOf(c.temperament);
  const era = ERA_SOUND[eraKey], gov = GOV_SOUND[governmentKey];
  const nomad = governmentKey === 'tribal' && (c.nomadic || terrain === 'plains' || terrain === 'desert') && eraKey !== 'future';
  const touch = TERRAIN_TOUCH[terrain];
  const instruments = [nomad ? NOMAD_SOUND.instruments : era.instruments, touch].filter(Boolean).join(', ');
  const style = c.buildingStyle ?? 'medieval';
  // A machine-age anthem needs machines: before the modern era a technocracy sings a precise rhythmic piece instead.
  const early = ERA_ORDER.indexOf(eraKey) < ERA_ORDER.indexOf('modern');
  const techEarly = governmentKey === 'technocracy' && early;
  const form = techEarly ? 'minimal rhythmic piece, precise' : gov.form;
  const voices = techEarly ? 'precise unison choir' : gov.voices;
  const chant = CHANT[governmentKey];
  return {
    eraKey, governmentKey, terrain, mood,
    music: {
      instruments, production: era.production, form, tempo: gov.tempo,
      voices: nomad ? `${NOMAD_SOUND.voices}, ${voices}` : voices,
      language: LANGUAGE[style] ?? '', mood: MOOD_WORDS[mood], verse: gov.verse, chorus: gov.chorus, negative: era.negative,
    },
    narrationTone: `Narrate in the voice of ${gov.narration}.`,
    chantStyle: {
      ...chant, percussion: era.percussion, vocals: gov.chantVocals, bpm: gov.chantBpm, tempo: `${gov.chantBpm} BPM`, diction: era.diction,
    },
    chronicleTone: CHRONICLE[governmentKey],
  };
}

/** The premade-voice tie-break: a voice for a government when the narrator's voiceStyle names nothing decisive. */
export const GOV_VOICE: Record<GovKey, 'brian' | 'harry' | 'bill' | 'george' | 'callum' | 'daniel' | 'charlie'> = {
  communist: 'brian', junta: 'harry', theocracy: 'bill', democracy: 'george', merchant: 'callum', monarchy: 'daniel', tribal: 'bill', technocracy: 'charlie',
};
