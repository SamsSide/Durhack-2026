// Calendar gate on tech ages (#313): run a fast mock world and fail if any nation enters an age before
// its earliest year, or a satellite flies before 1957, before the modern age, or above its age's cap
// (1 modern, 2 future, 4 stellar; #317 item 14), or a satellite is shot down outside a war between
// modern-or-later nations (#317 item 15). Also reports the first age steps, launches and shoot-downs seen.
// Run from the repo root:  npx tsx server/scripts/check-age-gate.ts [ticks] [seed] [prompt]
import { ageIndex, ageTurn, newAgeMemory, satelliteTurn, AGES, AGE_EARLIEST_YEAR, SATELLITE_CAP, SATELLITE_EARLIEST_YEAR, type TechAge, type WorldEvent } from '@terra/shared';
import { EngineRunner } from '../src/engine/runner';
import { forceMockMode } from '../src/llm';
import { DEMO_PROMPT } from './record-demo';

forceMockMode(true);
const ticks = Number(process.argv[2] ?? 3000);
const seed = Number(process.argv[3] ?? 1337);
const prompt = process.argv[4] ?? DEMO_PROMPT;
const runner = new EngineRunner();
const batches: WorldEvent[][] = [];
runner.subscribe({ events: (e) => batches.push(e) });
await runner.newWorld({ prompt, seed });
runner.stop();
const w = runner.getWorld()!;
const startYear = w.year;
const bad: string[] = [];
const steps: Record<string, number> = {};
let sats = 0;
const firstSat: Record<string, number> = {};   // age -> first year a nation in that age launched
const strikes: string[] = [];
for (let t = 0; t < ticks; t++) {
  batches.length = 0;
  runner.advance(1);
  for (const e of batches.flat()) {
    if (e.type === 'country_updated' && e.patch.techAge) {
      const need = AGE_EARLIEST_YEAR[AGES.indexOf(e.patch.techAge)]!;
      steps[e.patch.techAge] = Math.min(steps[e.patch.techAge] ?? Infinity, w.year);
      if (w.year < need) bad.push(`country ${e.countryId} entered ${e.patch.techAge} in year ${w.year} (< ${need})`);
    }
    if (e.type === 'satellite_lost') {
      const a = w.countries[e.attacker]!, v = w.countries[e.victim]!;
      if (ageIndex(a.techAge) < 4 || ageIndex(v.techAge) < 4) bad.push(`satellite shot down by a ${a.techAge} nation from a ${v.techAge} one`);
      if ((v.satellites ?? 0) < 0) bad.push(`country ${e.victim} has negative satellites`);
    }
    if (e.type === 'chronicle' && /-satlost-/.test(e.entry.id)) strikes.push(`y${e.entry.year} ${e.entry.text}`);
    if (e.type === 'country_updated' && e.patch.satellites !== undefined) {
      const c = w.countries[e.countryId]!;
      const age = c.techAge ?? 'ancient';
      sats++;
      firstSat[age] = Math.min(firstSat[age] ?? Infinity, w.year);
      if (w.year < SATELLITE_EARLIEST_YEAR) bad.push(`satellite in year ${w.year}`);
      if (e.patch.satellites > SATELLITE_CAP[ageIndex(age)]!) bad.push(`country ${e.countryId} has ${e.patch.satellites} satellites in the ${age} age (cap ${SATELLITE_CAP[ageIndex(age)]})`);
    }
  }
}
// A bronze-age calendar (negative years): progress banks, the step waits for year 500, then it comes.
{
  const base = w.countries.find((c) => c.alive)!;
  const mk = (year: number, age: TechAge) => ({ ...w, year, countries: w.countries.map((c) => (c.id === base.id ? { ...c, techAge: age, satellites: 0 } : c)) });
  const mem = newAgeMemory();
  mem.progress = 100000;
  if (ageTurn(mk(-2000, 'ancient'), base.id, [], 0, mem)) bad.push('ancient stepped to medieval in year -2000');
  if (ageTurn(mk(499, 'ancient'), base.id, [], 0, mem)) bad.push('ancient stepped to medieval in year 499');
  if (ageTurn(mk(500, 'ancient'), base.id, [], 0, mem)?.age !== 'medieval') bad.push('ancient did not step to medieval in year 500');
  if (ageTurn(mk(-2000, 'modern'), base.id, [], 0, mem)?.age !== 'future' && ageTurn(mk(2050, 'modern'), base.id, [], 0, mem)?.age !== 'future') bad.push('modern start era blocked at 2050');
  if (ageTurn(mk(1000, 'modern'), base.id, [], 0, mem)) bad.push('modern stepped to future before 2050');
  // Satellites: none before 1957 or before the modern age; the first at modern from 1957.
  const sm = newAgeMemory();
  if (satelliteTurn(mk(1956, 'modern'), base.id, 100, sm)) bad.push('satellite in 1956');
  if (satelliteTurn(mk(1990, 'industrial'), base.id, 100, newAgeMemory())) bad.push('industrial nation launched a satellite');
  const m2 = newAgeMemory();
  satelliteTurn(mk(1960, 'modern'), base.id, 100, m2);
  if (satelliteTurn(mk(1966, 'modern'), base.id, 106, m2)?.satellites !== 1) bad.push('modern nation did not launch its first satellite in 1966');
}
console.log(`seed ${seed}, ${ticks} ticks, years ${startYear} to ${w.year}, satellites ${sats}`);
console.log('first year each age was entered:', JSON.stringify(steps));
console.log('first launch year by age of the launching nation:', JSON.stringify(firstSat));
console.log(`satellites shot down: ${strikes.length}`);
for (const l of strikes.slice(0, 5)) console.log('  ' + l);
for (const b of bad.slice(0, 10)) console.log('  ' + b);
console.log(bad.length ? 'AGE GATE FAILED' : 'AGE GATE OK');
process.exit(bad.length ? 1 : 0);
