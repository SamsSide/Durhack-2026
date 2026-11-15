// Room to grow at founding: builds mock worlds over a grid of planet shapes (sea 0.45 to 0.8, one, few
// and many landmasses, cold and hot) and many seeds, and counts the nations that start cramped: fewer
// than 6 provinces owned at tick 0, or fewer than 8 ice-free land provinces per nation on their own landmass.
// Fails only if the same seed and bible build two different worlds. No agents, no API calls.
// Run from the repo root:  npx tsx server/scripts/check-room.ts [seeds per shape, default 9] [provinces, default 1200]
import { generateWorld, type World } from '@terra/shared';
import type { WorldShape } from '@terra/shared';
import { mockBible } from '../src/engine/bible';

const PER_SHAPE = Number(process.argv[2] ?? 9);
const SEAS = [0.45, 0.55, 0.65, 0.8];
const MASSES: NonNullable<WorldShape['landmasses']>[] = ['one', 'few', 'many'];
const CLIMATES: NonNullable<WorldShape['climate']>[] = ['cold', 'hot'];
const ROOM = 8;
const PROVINCES = Number(process.argv[3] ?? 1200);

/** Landmass id of each land tile (land = not ocean) and each landmass's ice-free province count, by flood fill. */
function mapLandmasses(w: World): { of: Map<number, number>; free: number[] } {
  const comp = new Array<number>(w.tiles.length).fill(-1);
  const size: number[] = [];
  for (const t of w.tiles) {
    if (t.terrain === 'ocean' || comp[t.id] >= 0) continue;
    const id = size.length;
    let free = 0;
    const q = [t.id];
    comp[t.id] = id;
    for (let k = 0; k < q.length; k++) {
      const cur = w.tiles[q[k]!]!;
      if (cur.terrain !== 'ice') free++;
      for (const j of cur.neighbors) if (w.tiles[j]!.terrain !== 'ocean' && comp[j] < 0) { comp[j] = id; q.push(j); }
    }
    size.push(free);
  }
  return { of: new Map(w.tiles.filter((t) => comp[t.id]! >= 0).map((t) => [t.id, comp[t.id]!])), free: size };
}

let worlds = 0, nationsTotal = 0, small = 0, tiny = 0, cramped = 0, island = 0, fail = 0;
const worst: string[] = [];
for (const sea of SEAS) for (const landmasses of MASSES) for (const climate of CLIMATES) {
  for (let i = 0; i < PER_SHAPE; i++) {
    const seed = 1000 + i * 7919 + Math.round(sea * 100);
    const bible = mockBible({ prompt: 'a world', nations: 3 + (i % 8), seed }, seed);
    bible.shape = { seaLevel: sea, landmasses, climate };
    const w = generateWorld(bible, { seed, provinces: PROVINCES });
    const again = generateWorld(bible, { seed, provinces: PROVINCES });
    if (JSON.stringify(w) !== JSON.stringify(again)) { fail++; console.log(`NOT DETERMINISTIC sea ${sea} ${landmasses} ${climate} seed ${seed}`); }
    const { of: landOf, free } = mapLandmasses(w);
    const owned = new Map<number, number>();
    for (const o of w.owner) if (o >= 0) owned.set(o, (owned.get(o) ?? 0) + 1);
    worlds++;
    const per = new Map<number, number>(); // nations per landmass
    for (const c of w.countries) per.set(landOf.get(c.capitalTile)!, (per.get(landOf.get(c.capitalTile)!) ?? 0) + 1);
    for (const c of w.countries) {
      nationsTotal++;
      const n = owned.get(c.id) ?? 0;
      if (n < 6) small++;
      if (n <= 2) tiny++;
      if (free[landOf.get(c.capitalTile)!]! < ROOM) { island++; if (island < 6) console.log(`island: sea ${sea} ${landmasses} ${climate} seed ${seed} nations ${w.countries.length} cap ${c.capitalTile} terrain ${w.tiles[c.capitalTile]!.terrain} free ${free.slice().sort((a, b) => b - a).join(",")}`); }
      if (free[landOf.get(c.capitalTile)!]! / per.get(landOf.get(c.capitalTile)!)! < ROOM) { cramped++; if (worst.length < 8) worst.push(`sea ${sea} ${landmasses} ${climate} seed ${seed} nation ${c.id}: ${n} owned, landmass has ${free[landOf.get(c.capitalTile)!]} ice-free for ${per.get(landOf.get(c.capitalTile)!)} nations`); }
    }
  }
}
const pct = (x: number) => `${x} of ${nationsTotal} (${((100 * x) / nationsTotal).toFixed(1)}%)`;
console.log(`worlds ${worlds}, nations ${nationsTotal}`);
console.log(`founded with fewer than 6 provinces: ${pct(small)}`);
console.log(`founded with 2 or fewer provinces:   ${pct(tiny)}`);
console.log(`capital on a landmass with under ${ROOM} ice-free provinces at all: ${pct(island)}`);
console.log(`nation whose landmass has under ${ROOM} ice-free provinces per nation: ${pct(cramped)}`);
for (const l of worst) console.log('  ' + l);
console.log(fail ? `FAIL: ${fail} worlds differ between two builds` : 'deterministic: every world built twice identically');
process.exit(fail ? 1 : 0);
