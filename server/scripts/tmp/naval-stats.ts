// Temporary: counts land battles, fleet-vs-fleet battles, coast raids and merchant sinkings in a headless mock run.
import { EngineRunner } from '../../src/engine/runner';
import { forceMockMode } from '../../src/llm';
import type { WorldEvent } from '@terra/shared';

forceMockMode(true);
const seeds = (process.argv[2] ?? '1337,4242,7').split(',').map(Number);
const ticks = Number(process.argv[3] ?? 300);
const prompt = process.argv[4] ?? 'a drowned world where the sea has swallowed the old kingdoms and the survivors rebuild on the high ground';
for (const seed of seeds) {
  const runner = new EngineRunner();
  const kind = new Map<string, string>();
  const c = { land: 0, seaFleet: 0, raid: 0, fleetVsArmyAtSea: 0, sunkTraders: 0, fleets: 0, warTicks: 0, fleetSpawn: 0 };
  const firstAt: Record<string, number> = {};
  let world: any = null;
  runner.subscribe({
    snapshot: (w: any) => { world = w; for (const u of w.units) kind.set(u.id, u.kind); },
    events: (es: WorldEvent[]) => {
      for (const e of es) {
        if (e.type === 'unit_spawned') { kind.set(e.unit.id, e.unit.kind); if (e.unit.kind === 'fleet') c.fleetSpawn++; }
        if (e.type === 'battle') {
          const w = runner.getWorld()!;
          const k = kind.get(e.attackerUnit);
          const sea = w.tiles[e.tile]!.terrain === 'ocean';
          const key = k === 'fleet' ? (sea ? 'seaFleet' : 'raid') : sea ? 'fleetVsArmyAtSea' : 'land';
          (c as any)[key]++;
          firstAt[key] ??= e.tick;
        }
        if (e.type === 'unit_removed' && e.reason === 'battle' && kind.get(e.unitId) === 'trader') c.sunkTraders++;
      }
    },
    agents: () => {},
  } as any);
  await runner.newWorld({ prompt, seed });
  runner.stop();
  for (let t = 0; t < ticks; t++) {
    runner.advance(1);
    const w = runner.getWorld()!;
    if (w.relations.some((r) => r.stance === 'war')) c.warTicks++;
  }
  const w = runner.getWorld()!;
  c.fleets = w.units.filter((u) => u.kind === 'fleet').length;
  console.log(`seed ${seed} ticks ${ticks}:`, JSON.stringify(c), 'first:', JSON.stringify(firstAt), 'armies now', w.units.filter((u) => u.kind === 'army').length);
}
process.exit(0);
