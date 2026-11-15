// Proof that the prompt shapes the world (owner, 15 Nov): for one fixed seed it founds a world from each
// of eight very different prompts, prints one line per world (start year, start age, sea share, ice,
// desert, forest and mountain shares of the land, landmass count, governments, building styles, name)
// and fails if the worlds do not differ the way the prompts ask. No agents run: it writes the bible
// (prepareWorld) and builds the planet (generateWorld), exactly as EngineRunner.newWorld does.
// Run from the repo root:
//   npx tsx server/scripts/check-prompt.ts                 the template bible (mock mode, free)
//   LLM_MODE=live npx tsx server/scripts/check-prompt.ts --live      Gemini writes each bible (8 cheap calls)
//   LLM_MODE=live npx tsx server/scripts/check-prompt.ts --image docs/shots/some.jpg ["prompt"]   the picture path (1 call)
import fs from 'node:fs';
import { generateWorld, type TechAge, type World, type WorldBible } from '@terra/shared';
import { lastBibleSource, lastImageReading, prepareWorld } from '../src/engine/bibleAi';
import { forceMockMode } from '../src/llm';

const args = process.argv.slice(2);
const live = args.includes('--live') || args.includes('--image');
const imageArg = args.includes('--image') ? args[args.indexOf('--image') + 1] : undefined;
const SEED = 20261115;
if (!live) forceMockMode(true);
else if (process.env.LLM_MODE !== 'live' || !process.env.GEMINI_API_KEY) { console.error('live needs LLM_MODE=live and GEMINI_API_KEY in the environment'); process.exit(2); }

interface Row {
  key: string; prompt: string; source: string; bible: WorldBible; world: World;
  year: number; age: TechAge; sea: number; ice: number; desert: number; forest: number; mountain: number; masses: number;
}

function landmasses(w: World): number {
  const seen = new Set<number>();
  let n = 0;
  for (const t of w.tiles) {
    if (t.terrain === 'ocean' || seen.has(t.id)) continue;
    const q = [t.id];
    seen.add(t.id);
    for (let k = 0; k < q.length; k++) for (const j of w.tiles[q[k]!]!.neighbors) if (w.tiles[j]!.terrain !== 'ocean' && !seen.has(j)) { seen.add(j); q.push(j); }
    if (q.length >= 3) n++;   // a rock or two is not a landmass
  }
  return n;
}

async function found(key: string, prompt: string, extra: { imageBase64?: string } = {}): Promise<Row> {
  // The Create screen always sends its defaults (6 nations, sea 0.55, aggression 0.5), so the check does too.
  const opts = { prompt, seed: SEED, nations: 6, seaLevel: 0.55, aggression: 0.5, ...extra };
  const { bible, seed } = await prepareWorld(opts);
  const world = generateWorld(bible, { seed, seaLevel: opts.seaLevel, aggression: opts.aggression });
  const land = world.tiles.filter((t) => t.terrain !== 'ocean');
  const share = (k: string) => land.filter((t) => t.terrain === k).length / land.length;
  return {
    key, prompt, source: lastBibleSource, bible, world, year: world.year, age: world.countries[0]!.techAge ?? 'ancient',
    sea: 1 - land.length / world.tiles.length, ice: share('ice'), desert: share('desert'), forest: share('forest'),
    mountain: share('mountain') + share('hills'), masses: landmasses(world),
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
const yr = (y: number) => (y < 0 ? `${-y} BC` : `${y}`);
function print(r: Row): void {
  console.log(`${r.key.padEnd(9)} | ${yr(r.year).padStart(8)} | ${r.age.padEnd(10)} | sea ${pct(r.sea)} | ice ${pct(r.ice)} | desert ${pct(r.desert)} | forest ${pct(r.forest)} | high ${pct(r.mountain)} | lands ${String(r.masses).padStart(2)} | ${r.bible.name} (${r.bible.era}) [${r.source}]`);
  console.log(`          governments: ${r.world.countries.map((c) => c.government).join('; ')}`);
  console.log(`          styles: ${r.world.countries.map((c) => c.buildingStyle).join(', ')}   shape: ${JSON.stringify(r.bible.shape ?? {})}`);
}

if (imageArg) {
  const data = fs.readFileSync(imageArg).toString('base64');
  const prompt = args[args.indexOf('--image') + 2] ?? 'a world like this picture';
  const r = await found('picture', prompt, { imageBase64: data });
  print(r);
  console.log(`          picture reading: ${JSON.stringify(lastImageReading)}`);
  console.log(`          first founding myth: ${r.world.chronicle[0]?.text}`);
  if (r.source !== 'model-picture' || !lastImageReading?.subject) { console.error('PICTURE CHECK FAILED: the model did not read the picture'); process.exit(1); }
  console.log('PICTURE CHECK PASSED: the bible was written from the picture');
  process.exit(0);
}

const PROMPTS: [string, string][] = [
  ['frozen', 'a frozen world of rival whaling republics'],
  ['desert', 'desert empires fighting over the last rivers'],
  ['drowned', 'a drowned post-apocalyptic archipelago'],
  ['medieval', 'medieval kingdoms on one great continent'],
  ['clockwork', 'a clockwork age of brass city-states in 1780'],
  ['future', 'a far-future world of arcologies'],
  ['stone', 'stone age tribes at the end of the ice age'],
  ['jungle', 'jungle city-states in 900 BC'],
];

const rows: Record<string, Row> = {};
for (const [key, prompt] of PROMPTS) { rows[key] = await found(key, prompt); print(rows[key]!); }
const { frozen, desert, drowned, medieval, clockwork, future, stone, jungle } = rows as Record<string, Row>;

const bad: string[] = [];
const need = (ok: boolean, what: string) => { if (!ok) bad.push(what); };
const between = (r: Row, lo: number, hi: number) => need(r.year >= lo && r.year <= hi, `${r.key}: start year ${r.year} is outside ${lo} to ${hi}`);
if (live) for (const r of Object.values(rows)) need(r.source === 'model', `${r.key}: the bible came from the ${r.source}, not the model`);

// the planet
need(frozen!.ice > desert!.ice + 0.1, `the frozen world (${pct(frozen!.ice)} ice) is not clearly icier than the desert one (${pct(desert!.ice)})`);
need(frozen!.ice > medieval!.ice + 0.1, 'the frozen world is not clearly icier than the medieval one');
need(desert!.desert > frozen!.desert + 0.1, `the desert world (${pct(desert!.desert)} desert) is not clearly drier than the frozen one (${pct(frozen!.desert)})`);
need(desert!.desert > jungle!.desert + 0.1, 'the desert world is not clearly drier than the jungle one');
need(jungle!.forest > desert!.forest + 0.1, `the jungle world (${pct(jungle!.forest)} forest) is not clearly more wooded than the desert one (${pct(desert!.forest)})`);
need(drowned!.sea > medieval!.sea + 0.1, `the drowned world (${pct(drowned!.sea)} sea) does not have clearly more sea than the one-continent one (${pct(medieval!.sea)})`);
need(drowned!.sea > desert!.sea + 0.1, 'the drowned world does not have clearly more sea than the desert one');
need(drowned!.masses > medieval!.masses, `the archipelago (${drowned!.masses} landmasses) does not have more landmasses than the one-continent world (${medieval!.masses})`);
need(medieval!.masses <= 3, `the one-continent world has ${medieval!.masses} landmasses`);
{ // one great continent: most of the land is one piece
  const w = medieval!.world, seen = new Set<number>();
  let biggest = 0;
  for (const t of w.tiles) {
    if (t.terrain === 'ocean' || seen.has(t.id)) continue;
    const q = [t.id]; seen.add(t.id);
    for (let k = 0; k < q.length; k++) for (const j of w.tiles[q[k]!]!.neighbors) if (w.tiles[j]!.terrain !== 'ocean' && !seen.has(j)) { seen.add(j); q.push(j); }
    biggest = Math.max(biggest, q.length);
  }
  const land = w.tiles.filter((t) => t.terrain !== 'ocean').length;
  need(biggest / land > 0.85, `the great continent holds only ${pct(biggest / land)} of the land`);
}

// the year and the age
between(frozen!, 1500, 1750);          // whaling republics: the age of sail
between(drowned!, 2150, 2500);         // after its fall
between(medieval!, 800, 1400);
need(clockwork!.year === 1780, `the clockwork world starts in ${clockwork!.year}, not the 1780 its prompt names`);
need(future!.year > 2100, `the far-future world starts in ${future!.year}`);
between(stone!, -10000, -4000);
need(jungle!.year === -900, `the jungle world starts in ${jungle!.year}, not 900 BC`);
const ages: [Row, TechAge][] = [[frozen!, 'gunpowder'], [drowned!, 'ancient'], [medieval!, 'medieval'], [clockwork!, 'industrial'], [future!, 'future'], [stone!, 'ancient'], [jungle!, 'ancient'], [desert!, 'ancient']];
for (const [r, age] of ages) need(r.age === age, `${r.key}: starts in the ${r.age} age, not ${age}`);

// the nations
const styles = (r: Row) => r.world.countries.map((c) => c.buildingStyle!);
const none = (r: Row, banned: string[]) => need(!styles(r).some((s) => banned.includes(s)), `${r.key}: a building style that does not fit (${styles(r).join(', ')})`);
none(clockwork!, ['desert', 'sahel', 'egyptian', 'mesoamerican', 'scrap', 'arcology']);
none(stone!, ['industrial', 'western_modern', 'soviet_bloc', 'arcology', 'scrap']);
none(desert!, ['industrial', 'western_modern', 'soviet_bloc', 'arcology', 'scrap', 'norse']);
need(desert!.year < 1800, `the desert empires start in ${desert!.year}`);
none(future!, ['medieval', 'desert', 'sahel', 'egyptian', 'norse', 'mesoamerican']);
need(styles(future!).includes('arcology'), 'the far-future world has no arcology style');
need(styles(drowned!).includes('scrap'), 'the post-apocalyptic world has no scrap style');
for (const r of Object.values(rows)) {
  need(r.world.countries.length === 6, `${r.key}: ${r.world.countries.length} nations, not 6`);
  need(new Set(r.world.countries.map((c) => c.name)).size === r.world.countries.length, `${r.key}: two nations share a name`);
  need(r.world.countries.every((c) => !['ocean', 'ice'].includes(r.world.tiles[c.capitalTile]!.terrain)), `${r.key}: a capital in the sea or on the ice`);
  need(new Set(r.world.countries.map((c) => c.capitalTile)).size === r.world.countries.length, `${r.key}: two nations share a capital`);
  need(r.world.countries.every((c) => r.world.owner.filter((o) => o === c.id).length >= 3), `${r.key}: a nation starts with fewer than 3 provinces`);
}
need(new Set(Object.values(rows).map((r) => r.bible.name)).size >= 7, 'the worlds do not have different names');
if (!live) {   // the template's governments follow the prompt's own words
  const govs = (r: Row, re: RegExp) => r.world.countries.filter((c) => re.test(c.government)).length;
  need(govs(frozen!, /republic/) >= 3, 'the frozen world has fewer than 3 republics');
  need(govs(stone!, /tribe/) >= 3, 'the stone age world has fewer than 3 tribes');
  need(govs(jungle!, /city-state/) >= 3, 'the jungle world has fewer than 3 city-states');
}

// the Create screen's sea slider still wins once it is moved off its default
{
  const { bible, seed } = await prepareWorld({ prompt: PROMPTS[2]![1], seed: SEED, nations: 6, seaLevel: 0.35, aggression: 0.5 });
  const w = generateWorld(bible, { seed, seaLevel: 0.35 });
  const sea = w.tiles.filter((t) => t.terrain === 'ocean').length / w.tiles.length;
  console.log(`slider    | the drowned prompt with the sea slider moved to 35%: sea ${pct(sea)}`);
  need(Math.abs(sea - 0.35) < 0.03, `a moved sea slider (0.35) did not win: sea ${pct(sea)}`);
}
// an old bible (no startAge, no shape) still builds, and builds the planet it always did
{
  const old: WorldBible = { name: frozen!.bible.name, era: 'Medieval', startYear: 1100, nations: frozen!.bible.nations };
  const a = generateWorld(old, { seed: SEED }), b = generateWorld({ ...old, shape: {} }, { seed: SEED, seaLevel: 0.55 });
  need(a.countries[0]!.techAge === 'medieval', 'an old bible lost its start age');
  need(JSON.stringify(a.tiles.map((t) => t.terrain)) === JSON.stringify(b.tiles.map((t) => t.terrain)), 'an empty shape changed the planet');
}

if (bad.length) { console.error(`\nPROMPT CHECK FAILED (${live ? 'live' : 'template'}):\n  ${bad.join('\n  ')}`); process.exit(1); }
console.log(`\nPROMPT CHECK PASSED (${live ? 'live, Gemini wrote each bible' : 'template bible, mock mode'}): 8 worlds from seed ${SEED} differ as their prompts ask`);
process.exit(0);
