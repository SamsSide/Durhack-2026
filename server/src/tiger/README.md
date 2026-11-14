# Tiger Data (row A11)

Optional. Set `TIGER_DATABASE_URL` (a Tiger Cloud / TimescaleDB connection string) and the server
records the world into hypertables. Unset, it logs one line and does nothing.

## What is stored

- `world_events` (hypertable on `time`): every `WorldEvent` the runner emits. Columns: `time`,
  `world_id`, `tick`, `year`, `type`, `actor` (nation id, `-1` world, `-2` decree), `payload` (the
  whole event as `jsonb`).
- `nation_stats` (hypertable on `time`): one row per living nation every 10 ticks: `tiles`,
  `population`, `treasury`, `armies`, `strength` (plus `year`).
- `nation_territory_10s`: a **continuous aggregate** over `nation_stats` (10 second buckets, per
  world and nation, last tile count of the bucket). It is real-time (`materialized_only = false`), so
  the chart never lags, and a policy refreshes it every 30 s.
- Policies: compression on both hypertables after 1 hour (segmented by world and nation or type),
  retention of 30 days. Optional steps that a plan does not allow are skipped with a warning.

Writes are batched (flush every 1 s or 500 rows) and never block the tick loop. On a database error it
logs once a minute and drops the batch.

## The two queries

- `GET /api/stats/territory?worldId=<id>` reads `nation_territory_10s`:
  `{ worldId, series: [ { countryId, name, color, points: [ { tick, year, tiles } ] } ] }`.
- `GET /api/stats/summary`: `{ events, worlds, eventsPerType }`, counted with `GROUP BY type` on `world_events`.

Both return `503 { "error": "stats unavailable" }` without a database.

## Why time-series fits an event-sourced world

The world is an append-only log: every change is an event with a time, and state is a fold of that
log. That is exactly a hypertable workload: append-only, time-ordered, never updated, queried in time
windows. Chunking by time keeps inserts fast at any size, old chunks compress (events repeat the same
types and actors), and questions such as "how did each nation's territory move" become a continuous
aggregate instead of replaying the log. The raw events stay in `jsonb`, so a run can still be rebuilt.
