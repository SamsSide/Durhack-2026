// Row A25 proof: the clock runs at any speed, and the pacing director slows for big moments.
// Run from the repo root:  npx tsx server/scripts/check-clock.ts
import { Clock, EASE_MS, HOLD_MS, MAX_TICKS_PER_FIRE } from '../src/engine/clock';
import { isBigMoment } from '../src/engine/bigMoments';
import { EngineRunner } from '../src/engine/runner';
import { forceMockMode } from '../src/llm';

forceMockMode(true);
let failed = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failed++; };

// 1. Fake clock: ticks per second at each speed over 10 virtual seconds, fires of the clock's own delay.
for (const speed of [0.1, 1, 8, 64]) {
  let t = 0;
  const c = new Clock(() => t);
  c.setTarget(speed);
  let ticks = 0, fires = 0, maxPerFire = 0;
  while (t < 10_000) { t += Math.ceil(c.delay(t)); const n = c.take(t); ticks += n; fires++; maxPerFire = Math.max(maxPerFire, n); }
  const rate = ticks / (t / 1000), want = 2 * speed;
  ok(Math.abs(rate - want) / want <= 0.1, `fake clock ${speed}x: ${rate.toFixed(2)} ticks/s (want ${want}), ${fires} fires, max ${maxPerFire} per fire`);
  ok(maxPerFire <= MAX_TICKS_PER_FIRE, `fake clock ${speed}x: never more than ${MAX_TICKS_PER_FIRE} ticks in a fire`);
}

// 2. Fake clock director: timeline of the effective speed after a war at t=0, target 8.
{
  let t = 0;
  const c = new Clock(() => t);
  c.setTarget(8); c.setPacing('auto');
  const states: string[] = [];
  c.onChange = (s) => states.push(`t=${(t / 1000).toFixed(2)}s speed=${s.speed}`);
  const war = { type: 'relation_changed', a: 0, b: 1, stance: 'war', reason: 'x', id: 'e', tick: 1, actor: 0, lamport: 1 } as const;
  ok(isBigMoment(war as never), 'isBigMoment: a war declaration is big');
  c.bigMoment(0);
  const at = (ms: number) => c.state(ms).speed;
  ok(at(0) === 1 && at(HOLD_MS - 1) === 1, `drops to 1x at once and holds ${HOLD_MS / 1000} s`);
  ok(at(HOLD_MS + 1000) > 1 && at(HOLD_MS + 1000) < 8, `eases in between at +${(HOLD_MS + 1000) / 1000} s: ${at(HOLD_MS + 1000)}`);
  ok(at(HOLD_MS + EASE_MS) === 8, `back at the target at +${(HOLD_MS + EASE_MS) / 1000} s`);
  console.log('  timeline:', [0, 4000, 7999, 8500, 9000, 9500, 10000, 10500, 11000].map((ms) => `${ms / 1000}s:${at(ms)}`).join(' '));
  c.setPaused(true);
  ok(c.take(50_000) === 0, 'pause always wins (no ticks)');
  void states;
}

// 3. The real engine, real timers: achieved ticks per second at each speed.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const runner = new EngineRunner();
await runner.newWorld({ prompt: 'a clock check world', seed: 77, nations: 6 });
const world = runner.getWorld()!;
const eventsPerFire: number[] = [];
const clocks: { at: number; speed: number; target: number; pacing: string }[] = [];
const t0 = Date.now();
runner.subscribe({
  events: (e) => eventsPerFire.push(e.length),
  clock: (s) => clocks.push({ at: Date.now() - t0, speed: s.speed, target: s.target, pacing: s.pacing }),
});
for (const [speed, secs] of [[1, 5], [8, 5], [64, 5]] as const) {
  runner.setSpeed(speed);
  await wait(300);
  const tick0 = world.tick, cpu0 = process.cpuUsage(), f0 = eventsPerFire.length, ev0 = eventsPerFire.reduce((a, b) => a + b, 0);
  await wait(secs * 1000);
  const dt = world.tick - tick0, cpu = process.cpuUsage(cpu0);
  const rate = dt / secs, want = 2 * speed;
  const evs = eventsPerFire.reduce((a, b) => a + b, 0) - ev0;
  const cpuPct = ((cpu.user + cpu.system) / 1000 / (secs * 1000)) * 100;
  const verdict = Math.abs(rate - want) / want <= 0.1 ? 'within 10%' : 'BEHIND (honest maximum)';
  console.log(`real engine ${speed}x: ${rate.toFixed(1)} ticks/s (want ${want}) ${verdict}; ${((eventsPerFire.length - f0) / secs).toFixed(1)} events messages/s, ${(evs / secs).toFixed(0)} events/s, cpu ${cpuPct.toFixed(0)}%`);
  if (speed < 64) ok(verdict === 'within 10%', `real engine ${speed}x within 10%`);
}
// 0.1x: the gap between two consecutive ticks should be about 5 s.
runner.setSpeed(0.1);
await wait(200);
const stamps: number[] = [];
let last = world.tick;
const end = Date.now() + 12_000;
while (Date.now() < end && stamps.length < 2) { await wait(50); if (world.tick !== last) { stamps.push(Date.now()); last = world.tick; } }
if (stamps.length === 2) { const gap = stamps[1]! - stamps[0]!; ok(Math.abs(gap - 5000) / 5000 <= 0.1, `real engine 0.1x: ${gap} ms between ticks (want about 5000)`); }
else ok(false, 'real engine 0.1x: could not see two ticks in 12 s');

// 4. The real engine director: a war in auto pacing at target 8.
runner.setSpeed(8);
runner.control({ action: 'pacing', value: 'auto' });
// The sim can have its own big moment just before ours (it does for seed 77), which would leave the
// director already at 1x. Wait out any such hold until the clock is really back at 8x, then settle.
{
  const settle = Date.now() + HOLD_MS + EASE_MS + 4000;
  while (Date.now() < settle && runner.clockState().speed !== 8) await wait(100);
  ok(runner.clockState().speed === 8, `clock settled at 8x before the war (${runner.clockState().speed})`);
  await wait(500);
}
clocks.length = 0;
const tw = Date.now();
const w = runner.getWorld()!;
runner.getBus().deliver([{ id: 'e-check-war', tick: w.tick, actor: 'world', lamport: 1_000_000, type: 'relation_changed', a: 0, b: 1, stance: 'war', reason: 'clock check' }]);
const tickAtWar = w.tick;
await wait(12_500);
const rel = (c: { at: number }) => ((c.at - (tw - t0)) / 1000).toFixed(2);
console.log('  director clock messages (seconds after the war):', clocks.map((c) => `${rel(c)}s=${c.speed}`).join(' '));
const first = clocks[0];
ok(!!first && first.speed <= 1 && Number(rel(first)) < 0.5, `speed dropped to <=1x within one fire of the war (${first ? rel(first) : '?'} s)`);
const lastC = clocks[clocks.length - 1];
ok(!!lastC && lastC.speed === 8, `speed back at 8x by 12.5 s (${lastC?.speed})`);
ok(clocks.length <= 4 * 13, `clock messages throttled (${clocks.length} in 12.5 s)`);
console.log(`  ticks during the 12.5 s after the war: ${w.tick - tickAtWar} (a 8x-only run would be about 200)`);

runner.stop();
console.log(failed ? `${failed} check(s) failed` : 'all clock checks passed');
process.exit(failed ? 1 : 0);
