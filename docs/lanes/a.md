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

**Model for UI work (owner, 14 Nov).** In lane a, every agent doing UI or design work (the
`durhack-frontend` agent, Figma, `web/src/theme/`, `web/src/audio/` UI states, `docs/design/`, demo
polish) runs on Fable 5.2 (`model: "fable"` on `Agent`). Everything else keeps the usual split
(Opus to plan and design the system, Sonnet to implement).

**Model for Blender work (owner, 14 Nov).** In lane a, every agent that builds or changes 3D models
in Blender (`assets/blender/`, `web/public/models/`, preview sheets) also runs on Fable 5.2
(`model: "fable"`), so it looks hard at the result and iterates on the design.

**Agent cap (owner, 14 Nov).** This lane's laptop may run up to 7 agents at once (the team-wide
default of 4 still applies to the other lanes).

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | **The seed (30 minutes, first, alone).** Everything the other lanes depend on, so that after it nobody waits: npm workspaces with every dependency all three lanes need; `packages/shared` with the X1 types, `applyEvent`, `flagSvg`, `mockWorld`, `mockEvents`; `npm run mock` serving X2 and mock versions of every X3 route (lore, region lore, sample audio, sample flag, world log); the X5 store, working against the mock; the app shell `App.tsx` with a slot for the globe and the four interface components placed (side dock for the card until the hologram exists); named placeholder exports for those components in `web/src/ui/index.ts`; the X6 audio stub; a default `tokens.css` (X7); a box-and-cone model fallback note in X4; stack steps in `check.sh` | | X1 to X7, all usable against the mock, to b and c | CP0 | done | After merging, `web/src/state/` and `App.tsx` pass to lane b and `web/src/ui/` to lane c |
| A2 | World generation: about 500 irregular provinces on a sphere (spherical Voronoi), terrain and elevation from the seed and sea level, provinces grouped into regions, capitals spread apart; `POST /api/world` builds a world from a mock world bible | | X3 `POST /api/world` | CP1 | done | |
| A3 | The simulation tick: income, claim land, build and upgrade structures by focus, population; real events on the socket; speed and pause | | X2 real events | CP1 | done | |
| A4 | Nation agents: one per country with its own replica, an autopilot policy from temperament, heartbeats, and a message bus with a switchable link per agent | | | CP1 | done | Hooks for A6 and A7: onRestore, onDelete, rejoin, silentPeers, adopt |
| A5 | Gemini: the world bible at creation and ruler decisions as schema-checked JSON; `LLM_MODE=mock`; call and token meter, caps, autopilot on any failure; check the real free-tier limits with one call | | `budget` messages | CP1 | done | Bible and rulers wired by A4. Models: lore 3.5-flash, ruler and bible 3.5-flash-lite |
| A6 | War and diplomacy: stances, armies with strength, marching along tile paths, battles settled by a pure seeded function, capture tile by tile, peace treaties that hand over land, alliances, a nation falling | | war events to b | CP1.5 | done | Battles resolved in applyTickBatch (settleMove); offers ride on chronicle ids. Replays (A9) must use applyEvent, not applyTickBatch |
| A7 | Resilience: cut and restore with queued events and reconciliation (disputes written to the chronicle), silence and wake, delete with neighbours carving up the ruins, blackout, `belief` messages | | X2 real controls | CP1.5 | done | Dispute rule in server/src/engine/resilience.ts |
| A8 | Low-poly models with headless Blender: all 15 keys in X4, exported as GLB with the manifest and a preview sheet | | X4 to b | CP1 | done | Owner's laptop has Blender |
| A9 | Replays: save every run's event log, list and play them back with no API calls, `GET /api/world/log`; record the demo world | A14 to A16 (audio cached) | X3 replays and log | CP2 | done | Lore is memory-only: persist it per world before recording the live demo |
| A10 | Nation agents on other laptops over the socket | | | | cut | Owner, 14 Nov: it runs and demos on one device |
| A11 | Stretch, prize: write events to a Tiger Data hypertable and serve one territory-over-time series | | | CP2 | testing | Needs a Tiger Cloud database URL in keys.env; wire two lines in index.ts after A4 |
| A12 | Design the interface in Figma: the style, the Create screen, the hologram nation card, the chronicle, the network panel, the top bar; export the variables to `web/src/theme/tokens.css` and a screenshot of each screen to `docs/design/` | | X7 to b and c | Sat 18:00 | done | Figma: https://www.figma.com/design/7cKEqNpTmvmNd9CUSlxrA6 (frames 01 to 10) |
| A13 | Lore route: Gemini writes culture, politics, history, relations and anthem lyrics from the nation's real chronicle; cached; a template version for mock mode | | X3 lore | CP1 | done | |
| A14 | Narration: ElevenLabs speaks the lore in a voice chosen from `voiceStyle`, cached on disk; the real `web/src/audio/` module (X6) | A13 | X3 narration, X6 | CP1.5 | done | MLH ElevenLabs |
| A15 | Anthem: the music model sings the lyrics from A13 in the nation's style, cached; regenerated only when the lyrics change | A13 | X3 anthem | CP1.5 | testing | Waiting on a person to listen; never say 'national anthem' in music prompts (the filter rejects it) |
| A16 | War chants: one short chant per nation, cached; played automatically by the audio module when war is declared or a battle is fought | A6, A14 | X3 chant | CP1.5 | testing | Waiting on a person to listen to the delivery |
| A17 | Multimodal, image in: a picture on the Create screen, read by Gemini (image input) for mood, palette and setting, folded into the world bible | A5 | X3 `imageBase64` | CP1.5 | done | flash-lite reads the image in about 7 s |
| A18 | Regions and secession: nations name the regions they settle, unrest per region, a region breaking away as a new nation with its own agent and ruler (one at a time, with a cooldown) | A4, A6 | `country_founded`, `region_updated` events | CP1.5 | done | Decided by the runner from the true world, one batch, like A7's falls |
| A19 | Flags: a `FlagSpec` for every nation and region from the world bible, `flagSvg` in the shared package, and the painted-flag route (Gemini image model, cached, capped) | A5 | X1 `flagSvg`, X3 flag | CP1 for drawn, CP1.5 for painted | testing | Drawn flags done; painted-flag route built but Gemini image needs billing (429), returns 503 meanwhile |
| A20 | Multimodal, audio in: spoken decrees. Gemini hears the recording directly and turns it into a decree with an effect (plague, famine, storm, meteor, prophet, gold rush, rebellion) that the engine applies to a nation or region | A6, A7 | X3 `POST /api/decree/voice` | CP2 | done | Browser webm/opus not yet tested with a real mic |
| A21 | Multimodal, image in and voice out: "Terra Nova News". Gemini watches a capture of the globe plus the recent chronicle and writes a 20 to 30 s news bulletin; ElevenLabs reads it in a newsreader voice | A14 | X3 `POST /api/broadcast`, X6 `playBroadcast` | CP1.5 | done | Gemini with the image takes about 19 s |
| A22 | Building styles: `Country.buildingStyle` picked in the world bible (rules fallback, at most two per style), and 30 Blender models (6 styles x capital, city, town, temple, fort) in the X4 manifest's `styles` | | X1 `buildingStyle`, X4 `styles` to b | CP2 | done | Preview: assets/preview-styles.png |
| A23 | Technology ages and sea trade: each nation advances ancient, medieval, gunpowder, industrial, modern (start from the era; armies stronger with age), trader ships crossing the oceans between trading nations, and 15 unit models (army, fleet, trader x 5 ages) in the manifest's `ages` | | X1 `techAge`, `trader`; X4 `ages` to b | CP2 | wip | Owner decision 14 Nov |
| A24 | Nation identity (#118): four more building styles (soviet_bloc, western_modern, egyptian, highland; 20 models), anthem, chant and narration prompts shaped by era and government, flag emblems by ideology, a chronicle tone per government | | X1 `BuildingStyle` +4, X4 `styles` | CP2 | wip | Owner decision 14 Nov |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
- 14:35 · #19 · A1: shared types and mock world, mock server for X2 and every X3 route, store, app shell, placeholders, audio, tokens
- 14:47 · A2: about 500 provinces, terrain, regions, spread capitals from a seed; POST /api/world builds a world from a template bible
- 14:48 · A13: Gemini lore and anthem lyrics from the real chronicle, cached, template in mock mode; shared Gemini client with meter and caps in server/src/llm
- 14:49 · A8: 15 low-poly GLB models (structures, units, tree) with the X4 manifest and a preview sheet, built by headless Blender
- 14:56 · A5 (part): Gemini world bible (flash-lite, about 5 s) and ruler decisions (about 1 s, 300 tokens in, 80 out) with a call scheduler; wired into the engine in A4
- 14:57 · A3: per-nation rules (income, claims, settlers, building and upgrades, population, region names, chronicle), real events at 14 to 23 a second
- 14:58 · A14 and A19 route: ElevenLabs narration in a voice chosen from voiceStyle, cached on disk, character cap; painted-flag route (off until Gemini billing)


- 14:59 · A12: Figma design (6 screens, 77 variables), designed tokens.css, screenshots and an HTML/CSS reference in docs/design
- 15:04 · A16: a shouted war chant per nation (Gemini line, ElevenLabs v3), cached, pre-warmed for likely belligerents, both sides played on war and battle

- 15:07 · A15: each nation's anthem sung by ElevenLabs Music from its lyrics (composition plan, 30 s), cached, capped
- 15:11 · A11 (code): every event and nation stats into Tiger Data hypertables with a continuous aggregate; territory and summary routes; wired after A4, live once the database URL exists
- 15:13 · A4: every nation its own agent and replica on a message bus with switchable links and heartbeats; Gemini bible and rulers wired in (A5 done); capitals placed so empires meet; Tiger Data wired

- 15:23 · A7: silence and return entries on cut and restore, neighbours notice the silence, disputes settled on restore (earlier claim wins) with tile flips, deleted nations fall to ruins and are carved up, blackout
- 15:29 · A21: Terra Nova News: Gemini watches a capture of the globe and the chronicle and writes a bulletin, read by an ElevenLabs newsreader; X6 playBroadcast
- 15:30 · A17: a picture on the Create screen read by Gemini (image in) for mood, palette, setting and sea level, folded into the world bible in one call
- 15:32 · A12 polish (Fable): projector type scale, AA contrast, folded network tab, docked card, the cut as 'the lights go out', founding scroll, dispatches, dispute flash, closing card; 10 Figma frames, no hologram
- 15:35 · A6: wars province by province, battles settled by a pure seeded function on every replica, peace treaties that hand over land, trade pacts, alliances that join defensive wars, betrayals, nations falling
- 15:42 · A20: spoken and typed decrees heard and interpreted by Gemini (audio in, 1.3 s) with real effects: plague, famine, storm, flood, meteor, prophet, gold rush, rebellion
- 15:43 · A9: every run recorded to server/replays/, replayed exactly with applyEvent and no API calls, a saved demo world (demo-1, The Drowned Age, 600 ticks), the timeline log
- 15:50 · A18: unrest per region published by its holder, restless regions break away as new nations with their own agent and ruler (one at a time, cooldown, once per region), the secession chronicle kind
- 15:53 · A22: 30 style models (medieval, classical, desert, east_asian, mesoamerican, scrap x capital, city, town, temple, fort) from a shared Blender kit, in the manifest's styles

Mocks: `npm run mock` (MockRunner behind the `WorldRunner` interface in `server/src/runner.ts`) stands in for the engine until A3; lore, audio and replays are mocked until A13 to A16 and A9.
