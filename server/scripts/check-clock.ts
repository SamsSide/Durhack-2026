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
for (const speed of [0.1, 1, 2.5, 5]) {
  let t = 0;
  const c = new Clock(() => t);
  c.setTarget(speed);
  let ticks = 0, fires = 0, maxPerFire = 0;
  while (t < 10_000) { t += Math.ceil(c.delay(t)); const n = c.take(t); ticks += n; fires++; maxPerFire = Math.max(maxPerFire, n); }
  const rate = ticks / (t / 1000), want = 2 * speed;
  ok(Math.abs(rate - want) / want <= 0.1, `fake clock ${speed}x: ${rate.toFixed(2)} ticks/s (want ${want}), ${fires} fires, max ${maxPerFire} per fire`);
  ok(maxPerFire <= MAX_TICKS_PER_FIRE, `fake clock ${speed}x: never more than ${MAX_TICKS_PER_FIRE} ticks in a fire`);
}

// 1b. Fake clock at one month a second (1/24): a tick every 12 s, no drift, pause keeps the phase,
// and anything slower is clamped.
{
  let t = 0;
  const c = new Clock(() => t);
  c.setTarget(1 / 24);
  const at: number[] = [];
  while (t < 120_500) { t += Math.ceil(c.delay(t)); if (c.take(t)) at.push(t); }
  const worst = Math.max(...at.map((x, i) => Math.abs(x - (i + 1) * 12_000)));
  ok(at.length === 10 && worst <= 20, `fake clock 1/24: ${at.length} ticks in 120 s, worst offset from the 12 s grid ${worst} ms`);
  // 6 s into a year, pause for 30 s, resume: the tick lands 6 s after the resume.
  while (t < 126_000) { t += 100; c.take(t); }
  c.setPaused(true);
  let during = 0;
  while (t < 156_000) { t += Math.ceil(c.delay(t)); during += c.take(t); }
  c.setPaused(false);
  const resumed = t;
  let got = -1;
  while (got < 0 && t < resumed + 20_000) { t += Math.ceil(c.delay(t)); if (c.take(t)) got = t - resumed; }
  ok(during === 0 && Math.abs(got - 6000) <= 150, `fake clock 1/24: pause keeps the phase (no ticks while paused, next tick ${got} ms after resume, want 6000)`);
  c.setTarget(0.001);
  ok(Math.abs(c.target - 1 / 104) < 1e-12, `speed below 1/104 is clamped to 1/104 (${c.target.toFixed(6)})`);
  c.setTarget(64);
  ok(c.target === 5, `speed above 5 is clamped to 5 (${c.target})`);
  ok(c.state(t).speed === 5 && Math.abs(new Clock(() => 0).state().speed - 1 / 8) < 1e-6, 'new clock starts at 1/8 (three months a second, owner #288); state speed is 5 at the top gear');
  // The director never speeds a slow world up: with a ceiling below 1 a big moment leaves it alone.
  c.setTarget(1 / 24); c.setPacing('auto');
  c.bigMoment(t);
  ok(Math.abs(c.effective(t + 10) - 1 / 24) < 1e-9 && Math.abs(c.effective(t + HOLD_MS + 500) - 1 / 24) < 1e-9, `director with a 1/24 ceiling stays at 1/24 through a big moment (${c.state(t + 10).speed})`);
  c.setTarget(0.5);
  c.bigMoment(t);
  ok(c.effective(t + 10) === 0.5, 'director with a 0.5 ceiling stays at 0.5 through a big moment');
}

// 1c. Fake clock at one week a second (1/104): a tick every 52 s, and the reported speed is accurate
// enough for the client to interpolate days.
{
  let t = 0;
  const c = new Clock(() => t);
  c.setTarget(1 / 104);
  const at: number[] = [];
  while (t < 260_500) { t += Math.ceil(c.delay(t)); if (c.take(t)) at.push(t); }
  const worst = Math.max(...at.map((x, i) => Math.abs(x - (i + 1) * 52_000)));
  ok(at.length === 5 && worst <= 1100, `fake clock 1/104: ${at.length} ticks in 260 s, worst offset from the 52 s grid ${worst} ms`);
  ok(Math.abs(c.state(t).speed - 1 / 104) / (1 / 104) < 1e-4, `1/104 reported to the clients as ${c.state(t).speed} (exact ${1 / 104})`);
}

// 2. Fake clock director: timeline of the effective speed after a war at t=0, target 4.
{
  let t = 0;
  const c = new Clock(() => t);
  c.setTarget(4); c.setPacing('auto');
  const states: string[] = [];
  c.onChange = (s) => states.push(`t=${(t / 1000).toFixed(2)}s speed=${s.speed}`);
  const war = { type: 'relation_changed', a: 0, b: 1, stance: 'war', reason: 'x', id: 'e', tick: 1, actor: 0, lamport: 1 } as const;
  ok(isBigMoment(war as never), 'isBigMoment: a war declaration is big');
  c.bigMoment(0);
  const at = (ms: number) => c.state(ms).speed;
  ok(at(0) === 1 && at(HOLD_MS - 1) === 1, `drops to 1x at once and holds ${HOLD_MS / 1000} s`);
  ok(at(HOLD_MS + 1000) > 1 && at(HOLD_MS + 1000) < 4, `eases in between at +${(HOLD_MS + 1000) / 1000} s: ${at(HOLD_MS + 1000)}`);
  ok(at(HOLD_MS + EASE_MS) === 4, `back at the target at +${(HOLD_MS + EASE_MS) / 1000} s`);
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
for (const [speed, secs] of [[1, 5], [2.5, 5], [5, 5]] as const) {
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
  ok(verdict === 'within 10%', `real engine ${speed}x within 10%`);
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

// 1/24 (one month a second): one tick every 12 s, plus or minus 0.5 s.
runner.setSpeed(1 / 24);
await wait(200);
{
  const st: number[] = [];
  let lt = world.tick;
  const until = Date.now() + 26_000;
  while (Date.now() < until && st.length < 2) { await wait(20); if (world.tick !== lt) { st.push(Date.now()); lt = world.tick; } }
  if (st.length === 2) { const gap = st[1]! - st[0]!; ok(Math.abs(gap - 12_000) <= 500, `real engine 1/24: ${gap} ms between ticks (want 12000 plus or minus 500)`); }
  else ok(false, 'real engine 1/24: could not see two ticks in 26 s');
  ok(Math.abs(runner.clockState().speed - 1 / 24) < 1e-3 && Math.abs(world.speed - 1 / 24) < 1e-9, `real engine reports 1/24 (clock ${runner.clockState().speed})`);
}

// 4. The real engine director: a war in auto pacing at target 4.
runner.setSpeed(4);
runner.control({ action: 'pacing', value: 'auto' });
// The sim can have its own big moment just before ours (it does for seed 77), which would leave the
// director already at 1x. Wait out any such hold until the clock is really back at 4x, then settle.
{
  const settle = Date.now() + HOLD_MS + EASE_MS + 4000;
  while (Date.now() < settle && runner.clockState().speed !== 4) await wait(100);
  ok(runner.clockState().speed === 4, `clock settled at 4x before the war (${runner.clockState().speed})`);
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
ok(!!lastC && lastC.speed === 4, `speed back at 4x by 12.5 s (${lastC?.speed})`);
ok(clocks.length <= 4 * 13, `clock messages throttled (${clocks.length} in 12.5 s)`);
console.log(`  ticks during the 12.5 s after the war: ${w.tick - tickAtWar} (a 4x-only run would be about 100)`);

runner.stop();
console.log(failed ? `${failed} check(s) failed` : 'all clock checks passed');
process.exit(failed ? 1 : 0);
