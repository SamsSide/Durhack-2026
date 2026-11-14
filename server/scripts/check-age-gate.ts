// Calendar gate on tech ages (#313): run a fast mock world and fail if any nation enters an age before
// its earliest year, or a satellite flies before 1957. Also reports the first age steps seen.
// Run from the repo root:  npx tsx server/scripts/check-age-gate.ts [ticks] [seed]
import { ageTurn, newAgeMemory, AGES, AGE_EARLIEST_YEAR, SATELLITE_EARLIEST_YEAR, type WorldEvent } from '@terra/shared';
import { EngineRunner } from '../src/engine/runner';
import { forceMockMode } from '../src/llm';
import { DEMO_PROMPT } from './record-demo';

forceMockMode(true);
const ticks = Number(process.argv[2] ?? 3000);
const seed = Number(process.argv[3] ?? 1337);
const runner = new EngineRunner();
const batches: WorldEvent[][] = [];
runner.subscribe({ events: (e) => batches.push(e) });
await runner.newWorld({ prompt: DEMO_PROMPT, seed });
runner.stop();
const w = runner.getWorld()!;
const startYear = w.year;
const bad: string[] = [];
const steps: Record<string, number> = {};
let sats = 0;
for (let t = 0; t < ticks; t++) {
  batches.length = 0;
  runner.advance(1);
  for (const e of batches.flat()) {
    if (e.type === 'country_updated' && e.patch.techAge) {
      const need = AGE_EARLIEST_YEAR[AGES.indexOf(e.patch.techAge)]!;
      steps[e.patch.techAge] = Math.min(steps[e.patch.techAge] ?? Infinity, w.year);
      if (w.year < need) bad.push(`country ${e.countryId} entered ${e.patch.techAge} in year ${w.year} (< ${need})`);
    }
    if (e.type === 'chronicle' && /satellite/.test(e.entry.text)) {
      sats++;
      if (e.entry.year < SATELLITE_EARLIEST_YEAR) bad.push(`satellite in year ${e.entry.year}`);
    }
  }
}
// A bronze-age calendar (negative years): progress banks, the step waits for year 500, then it comes.
{
  const base = w.countries.find((c) => c.alive)!;
  const mk = (year: number, age: 'ancient' | 'modern') => ({ ...w, year, countries: w.countries.map((c) => (c.id === base.id ? { ...c, techAge: age } : c)) });
  const mem = newAgeMemory();
  mem.progress = 100000;
  if (ageTurn(mk(-2000, 'ancient'), base.id, [], 0, mem)) bad.push('ancient stepped to medieval in year -2000');
  if (ageTurn(mk(499, 'ancient'), base.id, [], 0, mem)) bad.push('ancient stepped to medieval in year 499');
  if (ageTurn(mk(500, 'ancient'), base.id, [], 0, mem)?.age !== 'medieval') bad.push('ancient did not step to medieval in year 500');
  if (ageTurn(mk(-2000, 'modern'), base.id, [], 0, mem)?.age !== 'future' && ageTurn(mk(2050, 'modern'), base.id, [], 0, mem)?.age !== 'future') bad.push('modern start era blocked at 2050');
  if (ageTurn(mk(1000, 'modern'), base.id, [], 0, mem)) bad.push('modern stepped to future before 2050');
}
console.log(`seed ${seed}, ${ticks} ticks, years ${startYear} to ${w.year}, satellites ${sats}`);
console.log('first year each age was entered:', JSON.stringify(steps));
for (const b of bad.slice(0, 10)) console.log('  ' + b);
console.log(bad.length ? 'AGE GATE FAILED' : 'AGE GATE OK');
process.exit(bad.length ? 1 : 0);
