# Lane a — World, story and sound

**Owner:** @SamsSide · **Focus:** everything behind the screen (world, agents, Gemini, war, resilience, lore, narration, anthems, war chants, replays), plus the Blender models and the Figma design · **Paths:** `packages/shared/`, `server/`, `assets/`, `web/public/models/`, `web/src/audio/`, `web/src/theme/`, `docs/design/`, root config

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

**Running in parallel.** A1 goes first and alone. The moment it merges, four tracks run at once
on this laptop, none sharing files: *engine* (A2, A3, A4, A5, A6, A7, A18, A9 in order, in
`packages/shared/src/sim/` and `server/src/engine/`, `agents/`, `net/`), *story and sound*
(A13, A19, A14, A15, A16 in order, in `server/src/story/` and `web/src/audio/`), *models* (A8,
in `assets/` and `web/public/models/`) and *design* (A12, in Figma, `web/src/theme/` and
`docs/design/`). At most four agents at once.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | **The seed (30 minutes, first, alone).** Everything the other lanes depend on, so that after it nobody waits: npm workspaces with every dependency all three lanes need; `packages/shared` with the X1 types, `applyEvent`, `flagSvg`, `mockWorld`, `mockEvents`; `npm run mock` serving X2 and mock versions of every X3 route (lore, region lore, sample audio, sample flag, world log); the X5 store, working against the mock; the app shell `App.tsx` with a slot for the globe and the four interface components placed (side dock for the card until the hologram exists); named placeholder exports for those components in `web/src/ui/index.ts`; the X6 audio stub; a default `tokens.css` (X7); a box-and-cone model fallback note in X4; stack steps in `check.sh` | | X1 to X7, all usable against the mock, to b and c | CP0 | next | After merging, `web/src/state/` and `App.tsx` pass to lane b and `web/src/ui/` to lane c |
| A2 | World generation: about 500 irregular provinces on a sphere (spherical Voronoi), terrain and elevation from the seed and sea level, provinces grouped into regions, capitals spread apart; `POST /api/world` builds a world from a mock world bible | | X3 `POST /api/world` | CP1 | todo | |
| A3 | The simulation tick: income, claim land, build and upgrade structures by focus, population; real events on the socket; speed and pause | | X2 real events | CP1 | todo | |
| A4 | Nation agents: one per country with its own replica, an autopilot policy from temperament, heartbeats, and a message bus with a switchable link per agent | | | CP1 | todo | No central decision-maker |
| A5 | Gemini: the world bible at creation and ruler decisions as schema-checked JSON; `LLM_MODE=mock`; call and token meter, caps, autopilot on any failure; check the real free-tier limits with one call | | `budget` messages | CP1 | todo | Owner: pick the two model ids |
| A6 | War and diplomacy: stances, armies with strength, marching along tile paths, battles settled by a pure seeded function, capture tile by tile, peace treaties that hand over land, alliances, a nation falling | | war events to b | CP1.5 | todo | |
| A7 | Resilience: cut and restore with queued events and reconciliation (disputes written to the chronicle), silence and wake, delete with neighbours carving up the ruins, blackout, `belief` messages | | X2 real controls | CP1.5 | todo | The demo's key moment |
| A8 | Low-poly models with headless Blender: all 15 keys in X4, exported as GLB with the manifest and a preview sheet | | X4 to b | CP1 | next | Owner's laptop has Blender |
| A9 | Replays: save every run's event log, list and play them back with no API calls, `GET /api/world/log`; record the demo world | A14 to A16 (audio cached) | X3 replays and log | CP2 | todo | The backup plan |
| A10 | Nation agents on other laptops over the socket | | | | cut | Owner, 14 Nov: it runs and demos on one device |
| A11 | Stretch, prize: write events to a Tiger Data hypertable and serve one territory-over-time series | | | CP2 | todo | MLH Tiger Data |
| A12 | Design the interface in Figma: the style, the Create screen, the hologram nation card, the chronicle, the network panel, the top bar; export the variables to `web/src/theme/tokens.css` and a screenshot of each screen to `docs/design/` | | X7 to b and c | Sat 18:00 | next | Owner's laptop has the Figma tools; lane c builds from this |
| A13 | Lore route: Gemini writes culture, politics, history, relations and anthem lyrics from the nation's real chronicle; cached; a template version for mock mode | | X3 lore | CP1 | todo | |
| A14 | Narration: ElevenLabs speaks the lore in a voice chosen from `voiceStyle`, cached on disk; the real `web/src/audio/` module (X6) | A13 | X3 narration, X6 | CP1.5 | todo | MLH ElevenLabs |
| A15 | Anthem: the music model sings the lyrics from A13 in the nation's style, cached; regenerated only when the lyrics change | A13 | X3 anthem | CP1.5 | todo | Check music access on our plan first |
| A16 | War chants: one short chant per nation, cached; played automatically by the audio module when war is declared or a battle is fought | A6, A14 | X3 chant | CP1.5 | todo | |
| A17 | Stretch: an image as input, read by Gemini for mood and palette | A5 | | CP2 | todo | Cut first if behind |
| A18 | Regions and secession: nations name the regions they settle, unrest per region, a region breaking away as a new nation with its own agent and ruler (one at a time, with a cooldown) | A4, A6 | `country_founded`, `region_updated` events | CP1.5 | todo | Cut to names and flags only if unstable |
| A19 | Flags: a `FlagSpec` for every nation and region from the world bible, `flagSvg` in the shared package, and the painted-flag route (Gemini image model, cached, capped) | A5 | X1 `flagSvg`, X3 flag | CP1 for drawn, CP1.5 for painted | todo | Painted flags need billing turned on |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
