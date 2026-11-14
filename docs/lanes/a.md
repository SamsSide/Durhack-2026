# Lane a — World engine and agents

**Owner:** @SamsSide · **Focus:** the event-sourced world, the simulation, nation agents, Gemini rulers, war, resilience, replay, 3D assets · **Paths:** `packages/shared/`, `server/` except `server/src/story/`, `assets/`, `web/public/models/`, root config

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Scaffold the npm workspaces (`packages/shared`, `server`, `web` shell), the X1 types, `applyEvent`, `mockWorld`, `mockEvents`, and `npm run mock` serving X2 and `GET /api/health`; add the stack steps to `check.sh` | | X1, X2 mock to b and c | CP0 | next | Unblocks everyone; do first |
| A2 | World generation: hex sphere, terrain and elevation from the seed and sea level, capital placement spread apart; `POST /api/world` builds a world from a mock world bible | | X3 `POST /api/world` | CP1 | todo | |
| A3 | The simulation tick: income, claim land, build and upgrade structures by focus, population; real events on the socket; speed and pause | | X2 real events | CP1 | todo | |
| A4 | Nation agents: one per country with its own replica, an autopilot policy from temperament, heartbeats, and a message bus with a switchable link per agent | | | CP1 | todo | No central decision-maker |
| A5 | Gemini: the world bible at creation and ruler decisions as schema-checked JSON; `LLM_MODE=mock`; call and token meter, caps, autopilot on any failure; check the real free-tier limits with one call | | `budget` messages | CP1 | todo | Owner: pick the two model ids |
| A6 | War and diplomacy: stances, armies, marching along tile paths, battles settled by a pure seeded function, capture, peace, a nation falling | | war events to b | CP1.5 | todo | |
| A7 | Resilience: cut and restore with queued events and reconciliation (disputes written to the chronicle), silence and wake, delete with neighbours carving up the ruins, blackout, `belief` messages | | X2 real controls | CP1.5 | todo | The demo's key moment |
| A8 | Low-poly models with headless Blender: all 15 keys in X4, exported as GLB with the manifest | | X4 to b | CP1 | next | Runs in parallel with A1 to A3 on the owner's laptop |
| A9 | Replays: save every run's event log, list and play them back with no API calls; record the demo world | C4, C5 (audio cached) | X3 replays | CP2 | todo | The backup plan |
| A10 | Stretch: nation agents on other laptops over the socket | | | CP2 | todo | Cut first if behind |
| A11 | Stretch, prize: write events to a Tiger Data hypertable and serve one territory-over-time series | | chart data to c | CP2 | todo | MLH Tiger Data |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
