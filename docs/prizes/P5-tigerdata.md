# P5 - Best Use of Tiger Data (MLH)

Researched 13 Nov 2026, web only (no Chrome, no sign-ups). Prize: Stream Deck Mini per member.
Landing: https://mlh.link/tigerdata (returned empty to the fetch tool; read the prize text from other MLH events instead).

## 1. What the sponsor wants

Official prize text (MLH event page, HackNC): "the most innovative, impactful, and performance-driven use of Tiger Data". Examples named: IoT monitoring, AI analytics dashboards, financial prediction engines. That is the only stated criterion. No weights.
Source: https://www.mlh.com/events/hacknc-0e/challenges/019fcfdb-abbc-d470-b762-e73f1ee414d2

Some hackathons add a hard rule. UB Hacking 2026 says Tiger Data must be the project's database (search snippet of https://ubhacking2026.devpost.com/ ; page returned 403 to us, so unconfirmed). Assume this rule applies at DurHack and make Tiger Cloud the primary store for at least one core feature.

What a judge will light up at (inferred from the brief and Tiger's own marketing, not from a rubric):
- A hypertable receiving a visible high-rate stream (live counter of rows/sec).
- A continuous aggregate powering a chart that never lags, shown next to the raw-query time.
- Compression stats on screen (the brief claims 90%+). Note: free tier may not include compression policy; verify (see section 2).
- Relational + time-series + vector in one Postgres (pgvector / pgvectorscale / pg_textsearch hybrid search with RRF). Source: https://www.tigerdata.com/blog/introducing-agentic-postgres-free-plan-experiment-ai-on-postgres
- Agentic Postgres: Tiger CLI, Tiger MCP server, instant copy-on-write forks (agent tests a migration or index on a fork, then deletes it). Source: https://www.tigerdata.com/blog/postgres-for-agents

How MLH judges partner prizes: the sponsor's own staff or mentors judge their prize from the Devpost submissions and short demos. Teams must opt in to the prize on Devpost. Judging is on the sponsor's criterion only. The Devpost write-up must say exactly how the tech was used, because the judge may only read it. (General MLH practice; not a published rubric. Unconfirmed for DurHack.)

## 2. Tech as of Nov 2026

Tiger Data = former Timescale (renamed June 2025). Tiger Cloud = managed Postgres + TimescaleDB.

Sign-up and plans (sources: https://www.tigerdata.com/pricing , https://www.tigerdata.com/docs/get-started/quickstart/create-account):
- Sign up with email, click the confirmation link, land in Tiger Console.
- Trial: 30 days, $1000 credit, Performance plan, no credit card. Add a card before day 30 or services may be removed. Terms say a trial may be paused after 7 days of inactivity (search summary of https://www.tigerdata.com/legal/terms-of-service ; unconfirmed in primary text).
- Free plan (beta): no card, no time limit per the launch blog. Shared CPU and memory, region us-east-1 only, storage cap then read-only, no connection pooling/replication/VPC/metrics. Exact storage number NOT published on the pages I read. Source: https://www.tigerdata.com/docs/deploy/tiger-cloud/tiger-cloud-aws/service-management
- Pricing page did not list a free plan at fetch time. Docs and CLI still do. Unconfirmed which is current: use the 30-day trial service for the hackathon (full features, compression, continuous aggregates, any region) and keep a free service as a backup.
- Hackathon-specific credit or code: none found. Ask the Tiger Data sponsor table at the event.
- MLH wants nothing extra to claim the prize beyond the Devpost opt-in (unconfirmed).

Fastest path (Tiger CLI, https://www.tigerdata.com/docs/get-started/quickstart/tiger-cli):
```
curl -fsSL https://cli.tigerdata.com | sh     # or: brew install --cask timescale/tap/tiger-cli
tiger auth login                               # add --headless over SSH/Codespaces
tiger service create --cpu shared --memory shared   # free service, us-east-1
tiger db psql                                  # psql in; password in system keyring
tiger db uri                                   # connection string (add --with-password)
tiger mcp install claude-code                  # lets the coding agent drive the DB
tiger service fork <name>                      # copy-on-write fork
```
For a trial (non-free) service, drop the shared flags and optionally pass `--addons time-series`.
Time to first query: about 10 minutes including email confirm and CLI install.

Extensions pgvector, pgvectorscale, pg_textsearch are available but not auto-created: `CREATE EXTENSION IF NOT EXISTS vector;` (same page).

Hello world. Connection string is plain Postgres with `sslmode=require`: `postgresql://tsdbadmin:<pw>@<service-id>.<project-id>.tsdb.cloud.timescale.com:<port>/tsdb?sslmode=require`.
Python (psycopg 3):
```python
import os, psycopg
with psycopg.connect(os.environ["TIGER_URL"]) as c:
    print(c.execute("select now(), extversion from pg_extension where extname='timescaledb'").fetchone())
```
Node (pg):
```js
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.TIGER_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log((await c.query("select now()")).rows[0]);
await c.end();
```

Gotchas:
- Free service: us-east-1 only (about 80 ms from the UK; fine for a demo, batch your inserts).
- Free storage cap makes the DB read-only when full. Do not load big datasets on the free tier.
- Trial expires day 30; irrelevant for a 24-hour event but not for post-event judging. Do not tear down the service until results are out.
- Compression and continuous aggregates: confirm on your service with `select * from timescaledb_information.hypertables` and by running the SQL below before building on it. Feature availability on the free tier is unconfirmed.
- Service may be stopped when idle; wake it in Console before the demo.
- No IP allowlist by default on Performance trial (allow-list is a paid-plan feature); if connections fail, check the service's allowed-IP setting in Console.

## 3. Showcase pattern (under 2 hours, on any app)

Idea: log every user action in the app as an event. Chart it live. Show compression. Add vector search over the same rows.

```sql
create extension if not exists timescaledb;
create extension if not exists vector;

create table events (
  ts      timestamptz not null default now(),
  user_id bigint,
  kind    text not null,
  value   double precision,
  note    text,
  emb     vector(1536)       -- optional, set dimension to your embedding model
);
select create_hypertable('events', 'ts');

-- continuous aggregate for the live chart
create materialized view events_1m
with (timescaledb.continuous) as
select time_bucket('1 minute', ts) as bucket, kind, count(*) n, avg(value) avg_v
from events group by bucket, kind with no data;

select add_continuous_aggregate_policy('events_1m',
  start_offset => interval '1 hour', end_offset => interval '0 minutes',
  schedule_interval => interval '30 seconds');

-- compression (check it is allowed on your plan)
alter table events set (timescaledb.compress, timescaledb.compress_segmentby = 'kind');
select add_compression_policy('events', interval '1 hour');

-- stats panel for the demo
select pg_size_pretty(before_compression_total_bytes) before,
       pg_size_pretty(after_compression_total_bytes) after
from hypertable_compression_stats('events');

-- vector search in the same DB
select note from events order by emb <=> $1 limit 5;
```
Newer TimescaleDB versions rename compression to columnstore (`timescaledb.enable_columnstore`); if `compress` errors, check the current docs at https://www.tigerdata.com/docs.

Demo steps (about 90 seconds): 1) a load button fires 50k synthetic events, counter shows rows/sec; 2) chart reads only `events_1m` and updates every 2 s; 3) show raw query vs aggregate query timing; 4) show before/after compression bytes; 5) ask a natural-language question answered by pgvector over `note`; 6) optional: "agent forks the DB, tests an index, deletes the fork" with `tiger service fork`.
Build with Tiger MCP installed so the coding agent writes and tunes the SQL itself.

## 4. Past winners (thin; Tiger is a new MLH partner)

I could not find a Devpost project page for an MLH "Best Use of Tiger Data" winner. Prize listings exist at HackNC, UB Hacking 2026, SwampHacks XII, Hack the North 2026, HackRU Fall 2026, Hack the Change 2026, HackPSU Fall 2026, HackWesTX VII, Hack RenderATL, CodeRED Orion (via search results; several pages blocked our fetch).

| Project | Event | What / why | Source | Confidence |
| --- | --- | --- | --- | --- |
| Haven | SwampHacks (year unclear) | Post-mastectomy rehab coach, smart armband + computer vision, Node.js backend on TigerData; won MLH Best Use of Tiger Data over 140 projects | LinkedIn snippet from search, no URL kept | Low |
| Mzon Marketing Agent | MCP AI Agents Hackathon, 19 Sep 2025 | Listed "Best Use of TigerData" (not an MLH event) | https://github.com/bvsbharat/bvsbharat.com/pull/19 | Medium |
| Multi-agent code review (Simran Shaikh) | DEV Agentic Postgres Challenge, announced 1 Dec 2025 | 4 agents each in a zero-copy DB fork; 40-60 s down to 10-15 s | https://dev.to/simranshaikh20_50/i-built-a-multi-agent-code-review-system-thats-4x-faster-thanks-to-zero-copy-database-forks-3bd5 | High (not MLH) |
| FraudSwarm (Mayuresh Smita Suresh) | same | Rust fraud detection, 5 agents, pgvector + pg_text hybrid search, under 100 ms | https://dev.to/mayu2008/fraudswarn-multi-agent-fraud-detection-13ge | High (not MLH) |
| GitResume (Divya) | same | GitHub repo to career insights, 4 agents, forks, pg_text | https://dev.to/divyasinghdev/your-github-speaks-louder-than-your-resume-a-tiger-cloud-story-3o3 | High (not MLH) |

Pattern: winners show a measured performance number and use a Tiger-specific feature (forks, hybrid search), not just "Postgres". DEV challenge criteria: use of underlying tech, UX, accessibility, creativity (https://dev.to/challenges/tigerdata-2025-10-15).

## 5. Both database prizes

See the recommendation in P8-mongodb-atlas.md section 5. Short version: enter Tiger as the primary prize. Entering both is allowed in principle (each prize is judged separately) but only credible if each DB has a real job. A hard rule at some events (Tiger must be "the database") could make a Tiger + Mongo split look forced.

## 6. Hours

- Qualify (hypertable + one chart on it, opt in on Devpost): 1 to 1.5 h.
- Compete (continuous aggregate + compression stats + vector/hybrid search + fork demo + write-up): 3 to 4 h.
- Risks: free tier features unclear; sponsor may require Tiger as the main DB; region latency; judge may not be at a table late; weak dataset makes "time-series" look fake. Use a real stream (app events, sensors, price feed).

## 7. Scores (1-5)

| Axis | Score | Note |
| --- | --- | --- |
| Fit for any idea | 4 | Any app has events; analytics view is a cheap add |
| Win chance | 4 | New partner, few entrants, one winner |
| Value | 3 | Stream Deck Mini, retail about 60 to 70 GBP each (estimate) |
| Effort (5 = cheap) | 4 | SQL snippets above; MCP helps |

## 8. Do this tonight

1. Install Tiger CLI, `tiger auth login`, create a trial service (and a free one as backup). Do it before the event: email confirm and card-free trial both start the 30-day clock.
2. `tiger mcp install claude-code`; confirm the agent can run SQL.
3. Run the section 3 SQL; note which statements error on your plan.
4. Save the connection string in the shared secret store, not in git.
5. Ask the owner which dataset or event stream the main app will emit.
6. Ask Tiger Data staff at kickoff: exact prize rules (is "Tiger as the DB" required?), free-tier storage, any credits.
