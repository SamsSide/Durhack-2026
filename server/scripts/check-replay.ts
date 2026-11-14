// Proof that a replay is exact: record a headless engine run (mock LLM, 200 ticks, with a cut, a restore
// and a delete), replay it through ReplayRunner and compare the final worlds. Also times a 600-tick replay.
// Run from the repo root:  npx tsx server/scripts/check-replay.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReplayRunner } from '../src/engine/replayRunner';
import { loadReplay, REPLAYS_DIR } from '../src/engine/replays';
import { forceMockMode } from '../src/llm';
import { recordRun } from './record-demo';

forceMockMode(true);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terra-check-'));
const { runner, worldId } = await recordRun({
  prompt: 'a check world', seed: 4242, ticks: 200, dir,
  script: {
    40: (r) => r.control({ action: 'cut', countryId: 1 }),
    90: (r) => r.control({ action: 'restore', countryId: 1 }),
    120: (r) => r.control({ action: 'delete', countryId: 3 }),
    150: (r) => r.control({ action: 'decree', text: 'let there be bread' }),
  },
});
const truth = runner.getWorld()!;
const file = loadReplay(worldId, dir)!;
const rr = new ReplayRunner(file);
const calls: string[] = [];
rr.subscribe({ snapshot: () => calls.push('s'), events: (e) => calls.push(`e${e.length}`), agents: () => calls.push('a') });
while (!rr.finished) rr.advance(7);   // odd batch size on purpose
const got = rr.getWorld();

const pick = (w: typeof truth) => ({
  tick: w.tick, year: w.year, owner: w.owner, units: w.units, structures: w.structures, relations: w.relations,
  countries: w.countries, regions: w.regions, chronicle: w.chronicle,
  agents: w.agents.map((a) => ({ ...a, lastHeardTick: 0 })),
});
const a = JSON.stringify(pick(truth));
const b = JSON.stringify(pick(got));
const fields = Object.keys(pick(truth)).filter((k) => JSON.stringify((pick(truth) as any)[k]) !== JSON.stringify((pick(got) as any)[k]));
console.log(`recorded ${file.events.length} events, ${file.agents.length} agents updates; truth tick ${truth.tick}, replay tick ${got.tick}`);
console.log(`units ${got.units.length}, relations ${got.relations.length}, owned tiles ${got.owner.filter((o) => o >= 0).length}`);
console.log(a === b ? 'REPLAY EQUALS ORIGINAL: owner, units, structures, relations, countries, regions, chronicle, agents' : `MISMATCH in: ${fields.join(', ')}`);

// Timing: the saved demo, as fast as the loop can go (no clock).
const demo = loadReplay('demo-1', REPLAYS_DIR);
if (demo) {
  const t0 = performance.now();
  const d = new ReplayRunner(demo);
  while (!d.finished) d.advance(16);
  console.log(`demo-1: ${demo.events.length} events replayed to tick ${d.getWorld().tick} in ${(performance.now() - t0).toFixed(0)} ms`);
}
fs.rmSync(dir, { recursive: true, force: true });
process.exit(a === b ? 0 : 1);
