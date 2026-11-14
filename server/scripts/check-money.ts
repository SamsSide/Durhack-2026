// Money conservation (row A27): a headless mock run where payments must net to zero. Each tick, take the
// world before the batch, apply the batch's events WITHOUT payments, and compare the treasury total with
// the world after the real batch (payments included): they must match to the cent, so only income and
// spending change the total. Also checks the log replays to the same treasuries and none goes negative,
// and prints the payments per reason.
// Run from the repo root:  npx tsx server/scripts/check-money.ts [ticks] [seed]
import { applyEvent, cloneWorld, type World, type WorldEvent } from '@terra/shared';
import { EngineRunner } from '../src/engine/runner';
import { forceMockMode } from '../src/llm';
import { DEMO_PROMPT } from './record-demo';

forceMockMode(true);
const ticks = Number(process.argv[2] ?? 600);
const seed = Number(process.argv[3] ?? 1337);
const runner = new EngineRunner();
const batches: WorldEvent[][] = [];
runner.subscribe({ events: (e) => batches.push(e) });
await runner.newWorld({ prompt: DEMO_PROMPT, seed });
runner.stop();
const total = (w: World): number => w.countries.reduce((s, c) => s + c.treasury, 0);

let before = cloneWorld(runner.getWorld()!);
const initial = cloneWorld(before);
const byReason = new Map<string, { n: number; sum: number }>();
let worst = 0, negative = 0, payments = 0, volume = 0, spiked = 0;
for (let t = 0; t < ticks; t++) {
  batches.length = 0;
  runner.advance(1);
  const after = runner.getWorld()!;
  const batch = batches.flat();
  const sim = cloneWorld(before);
  for (const e of batch) {
    if (e.type === 'payment') {
      payments++; volume += e.amount;
      const r = byReason.get(e.reason) ?? { n: 0, sum: 0 };
      r.n++; r.sum += e.amount; byReason.set(e.reason, r);
      if (e.amount <= 0 || e.from === e.to) spiked++;
    } else applyEvent(sim, e);
  }
  const drift = Math.abs(total(after) - total(sim));
  worst = Math.max(worst, drift);
  for (const c of after.countries) if (c.treasury < -0.001) negative++;
  before = cloneWorld(after);
}
// Replay the whole log from the initial world: same treasuries.
const log = runner.getLog()!;
const re = cloneWorld(log.initial);
for (const e of log.events) applyEvent(re, e);
const same = re.countries.every((c, i) => Math.abs(c.treasury - runner.getWorld()!.countries[i]!.treasury) < 0.005);
console.log(`ticks ${ticks}, seed ${seed}: ${payments} payments, volume ${volume.toFixed(1)}, treasuries ${total(initial).toFixed(1)} -> ${total(runner.getWorld()!).toFixed(1)}`);
for (const [k, v] of [...byReason].sort()) console.log(`  ${k}: ${v.n} payments, ${v.sum.toFixed(1)} coins`);
const ok = worst <= 0.05 + 1e-9 && negative === 0 && same && spiked === 0;
console.log(`largest per-tick drift (payments must net to zero): ${worst.toFixed(3)}; negative treasuries: ${negative}; bad payments: ${spiked}; log replays to the same treasuries: ${same}`);
console.log(ok ? 'MONEY CONSERVED: the treasury total changes only by income and spending' : 'MONEY CHECK FAILED');
process.exit(ok ? 0 : 1);
