// National mood drift (#317 item 13): headless mock worlds for a few hundred years. Prints per seed the
// mood lines the chronicle told, how far each nation's temperament moved from its founding, and the wars
// declared, and fails if a trait leaves its bounds or never moves.
// Run from the repo root:  npx tsx server/scripts/check-mood.ts [ticks] [seeds, comma separated]
import { MOOD, moodWords, type WorldEvent } from '@terra/shared';
import { EngineRunner } from '../src/engine/runner';
import { forceMockMode } from '../src/llm';
import { DEMO_PROMPT } from './record-demo';

forceMockMode(true);
const TICKS = Number(process.argv[2] ?? 400);
const SEEDS = (process.argv[3] ?? '1337,4242,7').split(',').map(Number);
const bad: string[] = [];
for (const seed of SEEDS) {
  const runner = new EngineRunner();
  const batches: WorldEvent[][] = [];
  runner.subscribe({ events: (e) => batches.push(e) });
  await runner.newWorld({ prompt: DEMO_PROMPT, seed });
  runner.stop();
  const w = runner.getWorld()!;
  const start = new Map(w.countries.map((c) => [c.id, { ...c.temperament }]));
  const lines: string[] = [];
  let wars = 0, moved = 0;
  for (let t = 0; t < TICKS; t++) {
    batches.length = 0;
    runner.advance(1);
    for (const e of batches.flat()) {
      if (e.type === 'chronicle' && /-mood-/.test(e.entry.id)) lines.push(`y${e.entry.year} ${e.entry.text}`);
      if (e.type === 'relation_changed' && e.stance === 'war') wars++;
      if (e.type === 'country_updated' && e.patch.temperament) {
        moved++;
        for (const [k, v] of Object.entries(e.patch.temperament)) if (v < MOOD.lo || v > MOOD.hi) bad.push(`seed ${seed}: country ${e.countryId} ${k} ${v} out of bounds`);
      }
    }
  }
  if (!moved) bad.push(`seed ${seed}: no temperament ever moved`);
  console.log(`seed ${seed}: years ${w.year - TICKS} to ${w.year}, ${wars} wars declared, ${lines.length} mood lines`);
  for (const l of lines.slice(0, 8)) console.log('  ' + l);
  for (const c of w.countries) {
    const s = start.get(c.id);
    if (!s) continue;
    const d = (k: keyof typeof s) => `${k[0]} ${s[k].toFixed(2)}->${c.temperament[k].toFixed(2)}`;
    console.log(`  ${c.alive ? '' : '(fallen) '}${c.name}: ${d('aggression')}, ${d('expansion')}, ${d('trade')}, ${d('faith')}; ${moodWords(c.temperament)}`);
  }
}
for (const b of bad.slice(0, 10)) console.log('  ' + b);
console.log(bad.length ? 'MOOD CHECK FAILED' : 'MOOD CHECK OK');
process.exit(bad.length ? 1 : 0);
