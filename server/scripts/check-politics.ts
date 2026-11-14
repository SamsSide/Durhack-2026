// Politics drift (issue #232): headless mock worlds of 6 nations for 300 years. Prints per seed how many
// nations end left, centre and right (with movement names) and how many took power during the run.
// Target: some centre, at least one far-left and one far-right movement, in at least 2 of the 3 seeds.
// Run from the repo root:  npx tsx server/scripts/check-politics.ts
import { movementOf, politicsOf, type WorldEvent } from '@terra/shared';
import { EngineRunner } from '../src/engine/runner';
import { forceMockMode } from '../src/llm';
import { DEMO_PROMPT } from './record-demo';

forceMockMode(true);
const SEEDS = [1337, 4242, 7];
const TICKS = 300;
let hits = 0;
for (const seed of SEEDS) {
  const runner = new EngineRunner();
  const batches: WorldEvent[][] = [];
  runner.subscribe({ events: (e) => batches.push(e) });
  await runner.newWorld({ prompt: DEMO_PROMPT, seed, nations: 6 });
  runner.stop();
  let seizures = 0;
  for (let t = 0; t < TICKS; t++) {
    batches.length = 0;
    runner.advance(1);
    for (const e of batches.flat()) if (e.type === 'chronicle' && / seizes power in /.test(e.entry.text)) seizures++;
  }
  const w = runner.getWorld()!;
  const alive = w.countries.filter((c) => c.alive);
  const rows = alive.map((c) => ({ c, p: politicsOf(c), m: movementOf(politicsOf(c).axis) }));
  const left = rows.filter((r) => r.p.axis < -19), right = rows.filter((r) => r.p.axis > 19), centre = rows.length - left.length - right.length;
  const farL = rows.some((r) => r.m.far === 'left'), farR = rows.some((r) => r.m.far === 'right');
  const hit = farL && farR && centre >= 1;
  if (hit) hits++;
  console.log(`seed ${seed}: ${alive.length} alive; left ${left.length}, centre ${centre}, right ${right.length}; ${seizures} took power; ${hit ? 'TARGET' : 'miss'}`);
  console.log('  ' + rows.map((r) => `${r.c.name.replace(/^The /, '')}: ${r.m.short} (axis ${r.p.axis}, rad ${r.p.radicalism})`).join('; '));
}
console.log(`${hits}/${SEEDS.length} seeds hit the target (some centre, a far-left and a far-right movement)`);
process.exit(hits >= 2 ? 0 : 1);
