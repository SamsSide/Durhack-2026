// Ageing council members: a headless mock run that counts who served, how long, and how they died.
// Fails if anyone passes 100. Run from the repo root:  npx tsx server/scripts/check-ageing.ts [ticks] [seed]
import { memberAge, type WorldEvent } from '@terra/shared';
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
const w = runner.getWorld()!;

const served = new Map<string, Set<string>>();            // "country:role" -> member names
const start = new Map<string, number>();                 // "country:role" -> tick the current member took office
const reigns: Record<string, number[]> = { ruler: [], general: [] };
const deaths: Record<string, number> = {};
let maxAge = 0, ageless = 0;
const note = (id: number, role: string, name: string | undefined, tick: number): void => {
  if (!name) return;
  const k = `${id}:${role}`;
  if (!served.has(k)) served.set(k, new Set());
  if (!served.get(k)!.has(name)) { served.get(k)!.add(name); start.set(k, tick); }
};
for (const c of w.countries) for (const r of ['ruler', 'general'] as const) note(c.id, r, c.council?.[r]?.name, 0);
const sample: string[] = [];
for (let t = 0; t < ticks; t++) {
  batches.length = 0;
  runner.advance(1);
  for (const e of batches.flat()) {
    if (e.type === 'council_changed') {
      const k = `${e.countryId}:${e.role}`;
      if (e.member === null) {
        reigns[e.role]!.push(w.tick - (start.get(k) ?? 0));
        deaths[`${e.role}/${e.cause}`] = (deaths[`${e.role}/${e.cause}`] ?? 0) + 1;
      } else if (e.cause === 'succession' || e.cause === 'coup') note(e.countryId, e.role, e.member.name, w.tick);
      else if (e.cause === 'founded') note(e.countryId, e.role, e.member.name, w.tick);
    }
    if (e.type === 'chronicle' && e.entry.kind === 'death' && /aged \d+/.test(e.entry.text) && sample.length < 6) sample.push(e.entry.text);
  }
  for (const c of w.countries.filter((x) => x.alive)) for (const r of ['ruler', 'general'] as const) {
    const a = memberAge(c.council?.[r], w.year);
    if (a === undefined) { if (c.council?.[r]) ageless++; } else maxAge = Math.max(maxAge, a);
  }
}
const avg = (a: number[]): string => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 'n/a');
console.log(`ticks ${ticks}, seed ${seed}, ${w.countries.length} nations (${w.countries.filter((c) => c.alive).length} alive)`);
for (const role of ['ruler', 'general'] as const) {
  const per = [...served].filter(([k]) => k.endsWith(`:${role}`)).map(([, s]) => s.size);
  console.log(`${role}s served per nation: ${per.join(', ')} (total ${per.reduce((a, b) => a + b, 0)}); average reign ${avg(reigns[role]!)} years over ${reigns[role]!.length} ended`);
}
console.log('deaths by role/cause:', JSON.stringify(deaths));
console.log(`oldest member alive at any tick: ${maxAge}; members without a birth year: ${ageless}`);
for (const s of sample) console.log(`  ${s}`);
const ok = maxAge <= 100 && ageless === 0;
console.log(ok ? 'AGEING OK' : 'AGEING FAILED');
process.exit(ok ? 0 : 1);
