// Tiger Data (TimescaleDB on Postgres) store: schema, batched writes and the two stats queries.
// Self-contained: only needs `pg`. Every call is best effort, the world never waits on it.
import pg from 'pg';
import type { World, WorldEvent } from '@terra/shared';

export interface EventRow {
  time: Date; worldId: string; tick: number; year: number; type: string; actor: number; payload: unknown;
}
export interface StatRow {
  time: Date; worldId: string; tick: number; year: number; countryId: number;
  tiles: number; population: number; treasury: number; armies: number; strength: number;
}
export interface SeriesPoint { tick: number; year: number; tiles: number }

/** actor on the wire is a nation id, 'world' or 'decree'; the column is an int: -1 world, -2 decree. */
export function actorCode(actor: WorldEvent['actor']): number {
  return actor === 'world' ? -1 : actor === 'decree' ? -2 : actor;
}

export function eventRow(ev: WorldEvent, worldId: string, year: number, time: Date): EventRow {
  return { time, worldId, tick: ev.tick, year, type: ev.type, actor: actorCode(ev.actor), payload: ev };
}

/** One row per living nation, computed from a world. */
export function statRows(world: World, time: Date): StatRow[] {
  const tiles = new Map<number, number>();
  for (const o of world.owner) if (o >= 0) tiles.set(o, (tiles.get(o) ?? 0) + 1);
  const armies = new Map<number, { n: number; s: number }>();
  for (const u of world.units) {
    if (u.kind !== 'army') continue;
    const a = armies.get(u.owner) ?? { n: 0, s: 0 };
    a.n++; a.s += u.strength; armies.set(u.owner, a);
  }
  return world.countries.filter((c) => c.alive).map((c) => ({
    time, worldId: world.id, tick: world.tick, year: world.year, countryId: c.id,
    tiles: tiles.get(c.id) ?? 0, population: Math.round(c.population), treasury: c.treasury,
    armies: armies.get(c.id)?.n ?? 0, strength: armies.get(c.id)?.s ?? 0,
  }));
}

// The aggregate keeps one sample per 10-second bucket (the engine writes nation_stats every 10 ticks).
const SCHEMA: { label: string; sql: string; optional?: boolean }[] = [
  { label: 'extension', sql: 'CREATE EXTENSION IF NOT EXISTS timescaledb', optional: true },
  {
    label: 'world_events table',
    sql: `CREATE TABLE IF NOT EXISTS world_events (
      time timestamptz NOT NULL, world_id text NOT NULL, tick int NOT NULL, year int NOT NULL,
      type text NOT NULL, actor int NOT NULL, payload jsonb NOT NULL)`,
  },
  {
    label: 'nation_stats table',
    sql: `CREATE TABLE IF NOT EXISTS nation_stats (
      time timestamptz NOT NULL, world_id text NOT NULL, tick int NOT NULL, year int NOT NULL, country_id int NOT NULL,
      tiles int NOT NULL, population bigint NOT NULL, treasury double precision NOT NULL,
      armies int NOT NULL, strength double precision NOT NULL)`,
  },
  { label: 'world_events hypertable', sql: `SELECT create_hypertable('world_events', by_range('time'), if_not_exists => true)` },
  { label: 'nation_stats hypertable', sql: `SELECT create_hypertable('nation_stats', by_range('time'), if_not_exists => true)` },
  { label: 'world_events index', sql: 'CREATE INDEX IF NOT EXISTS world_events_world_type ON world_events (world_id, type, time DESC)' },
  { label: 'nation_stats index', sql: 'CREATE INDEX IF NOT EXISTS nation_stats_world_country ON nation_stats (world_id, country_id, time DESC)' },
  {
    // Real-time aggregate (materialized_only = false): reads the fresh rows too, so it never lags.
    label: 'continuous aggregate nation_territory_10s',
    sql: `CREATE MATERIALIZED VIEW IF NOT EXISTS nation_territory_10s
      WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
      SELECT time_bucket('10 seconds', time) AS bucket, world_id, country_id,
             last(tick, time) AS tick, last(year, time) AS year,
             last(tiles, time) AS tiles, max(tiles) AS max_tiles, avg(tiles)::float8 AS avg_tiles
      FROM nation_stats GROUP BY bucket, world_id, country_id WITH NO DATA`,
  },
  {
    label: 'aggregate refresh policy',
    sql: `SELECT add_continuous_aggregate_policy('nation_territory_10s',
      start_offset => interval '1 day', end_offset => interval '10 seconds',
      schedule_interval => interval '30 seconds', if_not_exists => true)`,
    optional: true,
  },
  {
    label: 'world_events compression',
    sql: `ALTER TABLE world_events SET (timescaledb.compress, timescaledb.compress_segmentby = 'world_id, type', timescaledb.compress_orderby = 'time DESC')`,
    optional: true,
  },
  { label: 'world_events compression policy', sql: `SELECT add_compression_policy('world_events', interval '1 hour', if_not_exists => true)`, optional: true },
  {
    label: 'nation_stats compression',
    sql: `ALTER TABLE nation_stats SET (timescaledb.compress, timescaledb.compress_segmentby = 'world_id, country_id', timescaledb.compress_orderby = 'time DESC')`,
    optional: true,
  },
  { label: 'nation_stats compression policy', sql: `SELECT add_compression_policy('nation_stats', interval '1 hour', if_not_exists => true)`, optional: true },
  { label: 'world_events retention', sql: `SELECT add_retention_policy('world_events', interval '30 days', if_not_exists => true)`, optional: true },
  { label: 'nation_stats retention', sql: `SELECT add_retention_policy('nation_stats', interval '30 days', if_not_exists => true)`, optional: true },
];

export class TigerStore {
  readonly pool: pg.Pool;
  constructor(connectionString: string) {
    // Tiger Cloud needs TLS. Local dev URLs can say sslmode=disable.
    const ssl = /sslmode=disable/.test(connectionString) ? undefined : { rejectUnauthorized: false };
    this.pool = new pg.Pool({ connectionString, ssl, max: 3, connectionTimeoutMillis: 8000 });
    this.pool.on('error', () => undefined); // idle client errors: the next query reconnects
  }

  /** Creates what is missing. Required steps throw; optional ones (policies, compression) are returned as warnings. */
  async ensureSchema(): Promise<string[]> {
    const warnings: string[] = [];
    for (const step of SCHEMA) {
      try { await this.pool.query(step.sql); } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Old servers lack by_range: fall back to the classic call.
        if (step.label.endsWith('hypertable') && /by_range/.test(msg)) {
          const table = step.label.split(' ')[0]!;
          await this.pool.query(`SELECT create_hypertable('${table}', 'time', if_not_exists => true)`);
        } else if (step.optional) warnings.push(`${step.label}: ${msg}`);
        else throw new Error(`${step.label}: ${msg}`);
      }
    }
    return warnings;
  }

  async insertEvents(rows: EventRow[]): Promise<void> {
    if (!rows.length) return;
    const cols = 7;
    const params: unknown[] = [];
    const tuples = rows.map((r, i) => {
      params.push(r.time, r.worldId, r.tick, r.year, r.type, r.actor, JSON.stringify(r.payload));
      const b = i * cols;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7}::jsonb)`;
    });
    await this.pool.query(`INSERT INTO world_events (time, world_id, tick, year, type, actor, payload) VALUES ${tuples.join(',')}`, params);
  }

  async insertStats(rows: StatRow[]): Promise<void> {
    if (!rows.length) return;
    const cols = 10;
    const params: unknown[] = [];
    const tuples = rows.map((r, i) => {
      params.push(r.time, r.worldId, r.tick, r.year, r.countryId, r.tiles, r.population, r.treasury, r.armies, r.strength);
      const b = i * cols;
      return `(${Array.from({ length: cols }, (_, k) => `$${b + k + 1}`).join(',')})`;
    });
    await this.pool.query(
      `INSERT INTO nation_stats (time, world_id, tick, year, country_id, tiles, population, treasury, armies, strength) VALUES ${tuples.join(',')}`,
      params,
    );
  }

  /** Territory over time per nation, from the continuous aggregate (real-time, so never behind). */
  async territory(worldId: string): Promise<Map<number, SeriesPoint[]>> {
    const { rows } = await this.pool.query<{ country_id: number; tick: number; year: number; tiles: number }>(
      `SELECT country_id, tick, year, tiles FROM nation_territory_10s WHERE world_id = $1 ORDER BY country_id, bucket`,
      [worldId],
    );
    const out = new Map<number, SeriesPoint[]>();
    for (const r of rows) {
      const list = out.get(r.country_id) ?? [];
      list.push({ tick: r.tick, year: r.year, tiles: r.tiles });
      out.set(r.country_id, list);
    }
    return out;
  }

  async summary(worldId: string): Promise<{ events: number; worlds: number; eventsPerType: Record<string, number> }> {
    const [per, worlds] = await Promise.all([
      this.pool.query<{ type: string; n: string }>(`SELECT type, count(*) AS n FROM world_events WHERE world_id = $1 GROUP BY type ORDER BY n DESC`, [worldId]),
      this.pool.query<{ n: string }>(`SELECT count(DISTINCT world_id) AS n FROM world_events`),
    ]);
    const eventsPerType: Record<string, number> = {};
    let events = 0;
    for (const r of per.rows) { eventsPerType[r.type] = Number(r.n); events += Number(r.n); }
    return { events, worlds: Number(worlds.rows[0]?.n ?? 0), eventsPerType };
  }

  async refreshAggregate(): Promise<void> {
    await this.pool.query(`CALL refresh_continuous_aggregate('nation_territory_10s', NULL, NULL)`);
  }

  close(): Promise<void> { return this.pool.end(); }
}
