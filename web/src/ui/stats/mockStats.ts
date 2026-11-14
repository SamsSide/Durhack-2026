// Dev-only stand-in for the Tiger Data stats routes (X3), used when the page URL has ?mockStats=1.
// It invents a plausible past from the world's chronicle once, then records the true province
// counts on every poll, so the live end of the chart is real. Never used in a production build.
import type { World } from '@terra/shared';
import type { StatsData, TerritoryPoint, TerritorySeries } from './useStats';

interface Memo { worldId: string; back: Map<number, TerritoryPoint[]>; live: Map<number, TerritoryPoint[]>; firstTick: number }
let memo: Memo | null = null;

function rand(a: number, b: number): number {
  let h = (Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 1597334677)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function counts(world: World): Map<number, number> {
  const out = new Map<number, number>();
  for (const o of world.owner) if (o >= 0) out.set(o, (out.get(o) ?? 0) + 1);
  return out;
}

function backfill(world: World): Map<number, TerritoryPoint[]> {
  const now = world.tick;
  const first = world.chronicle[0];
  const yearsPerTick = first && now > first.tick ? (world.year - first.year) / (now - first.tick) : 1;
  const yearAt = (t: number) => Math.round(world.year - (now - t) * yearsPerTick);
  const step = Math.max(10, Math.ceil(now / 48 / 10) * 10);
  const held = counts(world);
  const out = new Map<number, TerritoryPoint[]>();
  if (now <= 0) return out;
  for (const c of world.countries) {
    const mine = world.chronicle.filter((e) => e.countries.includes(c.id) && e.tick <= now);
    const founded = Math.min(now, mine.find((e) => e.kind === 'founding')?.tick ?? (c.parent == null ? 0 : mine[0]?.tick ?? 0));
    const end = held.get(c.id) ?? 0;
    const lastSeen = c.alive ? now : Math.max(founded + step, mine[mine.length - 1]?.tick ?? Math.round(now * 0.7));
    const peak = end > 0 ? end : 5 + Math.round(rand(c.id, 3) * 9);
    const span = Math.max(1, lastSeen - founded);
    const shocks = mine.filter((e) => e.kind === 'war' || e.kind === 'battle' || e.kind === 'peace');
    const points: TerritoryPoint[] = [];
    const ticks: number[] = [];
    for (let t = Math.ceil(founded / step) * step; t < lastSeen; t += step) ticks.push(t);
    ticks.push(lastSeen);
    for (const t of ticks) {
      const p = (t - founded) / span;
      const start = Math.min(peak, c.parent == null ? 2 : 4);
      let v = start + (peak - start) * (1 - Math.pow(1 - p, 1.7));
      shocks.forEach((e, i) => {
        const d = (t - e.tick) / (step * 3);
        if (d < 0) return;
        const sign = rand(c.id, i * 13 + 1) < 0.5 ? -1 : 1;
        v += sign * peak * 0.3 * d * Math.exp(1 - d) * Math.min(1, 6 * p * (1 - p));
      });
      if (!c.alive && end === 0) v *= p < 0.7 ? 1 : Math.max(0, (1 - p) / 0.3);
      points.push({ tick: t, year: yearAt(t), tiles: Math.max(0, Math.round(v)) });
    }
    if (c.alive || end > 0) points[points.length - 1].tiles = end;
    out.set(c.id, points);
  }
  return out;
}

export function mockStats(world: World): StatsData {
  if (!memo || memo.worldId !== world.id || world.tick < memo.firstTick) {
    memo = { worldId: world.id, back: backfill(world), live: new Map(), firstTick: world.tick };
  }
  const held = counts(world);
  for (const c of world.countries) {
    const list = memo.live.get(c.id) ?? [];
    while (list.length && list[list.length - 1].tick >= world.tick) list.pop();
    const n = held.get(c.id) ?? 0;
    const seen = list.length > 0 || memo.back.has(c.id);
    if (world.tick > memo.firstTick && (n > 0 || seen)) {
      const last = list[list.length - 1];
      if (!(last && last.tiles === 0 && n === 0)) list.push({ tick: world.tick, year: world.year, tiles: n });
    }
    memo.live.set(c.id, list);
  }
  const series: TerritorySeries[] = [];
  for (const c of world.countries) {
    const points = [...(memo.back.get(c.id) ?? []), ...(memo.live.get(c.id) ?? [])];
    if (points.length) series.push({ countryId: c.id, name: c.name, color: c.color, points });
  }
  const tiles = [...held.values()].reduce((a, b) => a + b, 0);
  return { worldId: world.id, series, events: Math.round(world.tick * 11.7) + world.chronicle.length * 3 + tiles, worlds: 3, sample: true };
}
