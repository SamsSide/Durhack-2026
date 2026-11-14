// Records the demo world: a fixed prompt and seed in mock mode, 600 ticks, a scripted cut at tick 150,
// restore at 250 and delete at 350, saved as server/replays/demo-1.json (committed; it is the backup plan).
// Run from the repo root:  npx tsx server/scripts/record-demo.ts [out-id] [name]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EngineRunner } from '../src/engine/runner';
import { Recorder, loadReplay, saveCompact, REPLAYS_DIR } from '../src/engine/replays';
import { forceMockMode } from '../src/llm';

export const DEMO_PROMPT = 'a drowned world where the sea has swallowed the old kingdoms and the survivors rebuild on the high ground';
export const DEMO_SEED = 1337;

/** Runs a headless engine world for `ticks` years, calling `script[tick]` between years. Returns the runner and the recording. */
export async function recordRun(opts: { prompt: string; seed: number; ticks: number; script?: Record<number, (r: EngineRunner) => void>; dir: string }) {
  const runner = new EngineRunner();
  const rec = new Recorder(runner, opts.dir);
  runner.subscribe(rec);
  const w = await runner.newWorld({ prompt: opts.prompt, seed: opts.seed });
  runner.stop();                       // we drive the clock by hand
  for (let t = 0; t < opts.ticks; t++) {
    opts.script?.[t]?.(runner);
    runner.advance(1);
  }
  rec.flushSync();
  return { runner, rec, worldId: w.id };
}

async function main() {
  forceMockMode(true);
  const outId = process.argv[2] ?? 'demo-1';
  const name = process.argv[3] ?? 'The Drowned Age';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terra-demo-'));
  const { worldId } = await recordRun({
    prompt: DEMO_PROMPT, seed: DEMO_SEED, ticks: 600, dir,
    script: {
      150: (r) => r.control({ action: 'cut', countryId: 2 }),
      250: (r) => r.control({ action: 'restore', countryId: 2 }),
      350: (r) => r.control({ action: 'delete', countryId: 4 }),
    },
  });
  const f = loadReplay(worldId, dir)!;
  f.id = outId;
  f.name = name;
  f.initial.name = name;
  const out = saveCompact(f, REPLAYS_DIR);
  fs.rmSync(dir, { recursive: true, force: true });
  const kinds = new Map<string, number>();
  for (const e of f.events) kinds.set(e.type, (kinds.get(e.type) ?? 0) + 1);
  console.log(`saved ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB): world ${worldId}, ${f.events.length} events, ${f.agents.length} agents updates`);
  console.log([...kinds].map(([k, n]) => `${k}=${n}`).join(' '));
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) void main();
