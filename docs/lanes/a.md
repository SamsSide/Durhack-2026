# Lane a — World, story and sound

**Owner:** @SamsSide · **Focus:** everything behind the screen (world, agents, Gemini, war, resilience, lore, narration, anthems, war chants, replays), plus the Blender models and the Figma design · **Paths:** `packages/shared/`, `server/`, `assets/`, `web/public/models/`, `web/src/audio/`, `web/src/theme/`, `docs/design/`, root config

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Scaffold the npm workspaces (`packages/shared`, `server`, `web` shell with every dependency lanes b and c need), the X1 types, `applyEvent`, `mockWorld`, `mockEvents`, `npm run mock` serving X2 and the mock X3 routes, a first `tokens.css` (X7) and the audio stub (X6); add the stack steps to `check.sh` | | X1, X2, X3 mock, X6 stub, X7 default to b and c | CP0 | next | Unblocks everyone; do first |
| A2 | World generation: hex sphere, terrain and elevation from the seed and sea level, capitals spread apart; `POST /api/world` builds a world from a mock world bible | | X3 `POST /api/world` | CP1 | todo | |
| A3 | The simulation tick: income, claim land, build and upgrade structures by focus, population; real events on the socket; speed and pause | | X2 real events | CP1 | todo | |
| A4 | Nation agents: one per country with its own replica, an autopilot policy from temperament, heartbeats, and a message bus with a switchable link per agent | | | CP1 | todo | No central decision-maker |
| A5 | Gemini: the world bible at creation and ruler decisions as schema-checked JSON; `LLM_MODE=mock`; call and token meter, caps, autopilot on any failure; check the real free-tier limits with one call | | `budget` messages | CP1 | todo | Owner: pick the two model ids |
| A6 | War and diplomacy: stances, armies with strength, marching along tile paths, battles settled by a pure seeded function, capture tile by tile, peace treaties that hand over land, alliances, a nation falling | | war events to b | CP1.5 | todo | |
| A7 | Resilience: cut and restore with queued events and reconciliation (disputes written to the chronicle), silence and wake, delete with neighbours carving up the ruins, blackout, `belief` messages | | X2 real controls | CP1.5 | todo | The demo's key moment |
| A8 | Low-poly models with headless Blender: all 15 keys in X4, exported as GLB with the manifest and a preview sheet | | X4 to b | CP1 | next | Owner's laptop has Blender |
| A9 | Replays: save every run's event log, list and play them back with no API calls, `GET /api/world/log`; record the demo world | A14 to A16 (audio cached) | X3 replays and log | CP2 | todo | The backup plan |
| A10 | Stretch: nation agents on other laptops over the socket | | | CP2 | todo | Cut first if behind |
| A11 | Stretch, prize: write events to a Tiger Data hypertable and serve one territory-over-time series | | | CP2 | todo | MLH Tiger Data |
| A12 | Design the interface in Figma: the style, the Create screen, the hologram nation card, the chronicle, the network panel, the top bar; export the variables to `web/src/theme/tokens.css` and a screenshot of each screen to `docs/design/` | | X7 to b and c | Sat 18:00 | next | Owner's laptop has the Figma tools; lane c builds from this |
| A13 | Lore route: Gemini writes culture, politics, history, relations and anthem lyrics from the nation's real chronicle; cached; a template version for mock mode | | X3 lore | CP1 | todo | |
| A14 | Narration: ElevenLabs speaks the lore in a voice chosen from `voiceStyle`, cached on disk; the real `web/src/audio/` module (X6) | A13 | X3 narration, X6 | CP1.5 | todo | MLH ElevenLabs |
| A15 | Anthem: the music model sings the lyrics from A13 in the nation's style, cached; regenerated only when the lyrics change | A13 | X3 anthem | CP1.5 | todo | Check music access on our plan first |
| A16 | War chants: one short chant per nation, cached; played automatically by the audio module when war is declared or a battle is fought | A6, A14 | X3 chant | CP1.5 | todo | |
| A17 | Stretch: an image as input, read by Gemini for mood and palette | A5 | | CP2 | todo | Cut first if behind |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
