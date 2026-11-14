# Lane b — The globe

**Owner:** @CutGrass88 · **Focus:** the 3D planet: tiles, camera, borders, map modes, buildings, war animation, status visuals, the hologram, performance · **Paths:** `web/` except `web/src/ui/`, `web/src/audio/`, `web/src/theme/` and `web/public/models/`

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `planned` · `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

**No row here waits on another lane.** Everything is built against `npm run mock`, which emits
wars, secessions, falls and every control, and against fallbacks that stay in for good (boxes
for missing models, a placeholder card in the hologram). When the real thing merges it simply
replaces the mock; nothing in this lane changes.

**Before A1 merges (about 30 minutes):** pull, read the plan and contracts, and write the lane
plan for B1 to B3 with `durhack-plan` (lane mode), so building starts the minute A1 lands.

**Running in parallel.** After B1, rows can run two or three at a time because each has its own
folder: B2 `web/src/globe/camera/`, B3 `web/src/globe/political/`, B4 `web/src/globe/structures/`,
B5 `web/src/globe/units/`, B6 `web/src/globe/hologram/`, B7 `web/src/globe/status/`. Suggested
pairs: B2 with B3, then B4 with B5, then B6 with B7, then B8.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | The first globe, in the slot the seed's `App.tsx` provides and reading the seed's X5 store: every province (an irregular convex polygon, drawn as a triangle fan) coloured by terrain with an owner tint; take over `App.tsx` and `web/src/state/` | A1 only | | CP0 | done | Passed hand test #33. Coast cliffs need polish (B8) |
| B2 | Camera and selection: orbit, smooth zoom from whole planet to a few tiles, click a tile to select its nation, a glowing border round the selected nation, `flyTo` | | selection to c | CP1 | done | Passed hand test #50 (browser QA) |
| B3 | The political map: borders for every nation, thinner region borders inside them when zoomed in, each nation's flag (`flagSvg`) by its name label, labels that fade with zoom, a colour pulse when a tile changes owner, and the map modes in X5 (political and diplomacy first; terrain and strength after) | | | CP1 | done | Passed hand test #50 (browser QA) |
| B4 | Structures: instanced models from the X4 manifest (box fallback), a pop-up build animation, upgrades, trees, detail only when zoomed in | nothing (boxes until A8's models land) | | CP1 | done | Passed hand test #55; culture styles (#91, #118), close-up walled towns, identity props |
| B5 | Units and war: armies marching between tiles with their strength shown, volleys and flashes on a battle, smoke on captured tiles, a front line between nations at war | nothing (the mock emits wars) | | CP1.5 | testing | Counters, arcs, battles, fronts, treaties, units by age (#122, #158), traders, vehicle fx (#164), terrain badges (#154). Live battle look in the final test suite |
| B6 | The hologram: on selection a beam rises from the capital and projects lane c's `NationCard` with scan lines, glow and flicker; it follows the camera and docks to the side on a narrow screen | nothing (the seed's placeholder card and default colours until C2 and A12 land) | | CP1.5 | cut | Removed by owner in #77 (card is docked, no hologram) |
| B7 | Agent status on the globe: a cut nation behind a static ring, an autopilot marker, a deleted nation crumbling to ruins, and the beliefs view (`beliefOf`) | nothing (the mock accepts every control) | | CP1.5 | testing | Cut ring, signal lost, autopilot, ruins, dispute and collapse flashes, return ripple, council visuals (#146). Ripple and crumble in the final test suite |
| B8 | Polish and speed: ocean, atmosphere glow, stars, lighting, a steady 60 frames a second with 500 provinces | | | CP2 | wip | Done: clouds, sky, sun and moon, terrain mode, province layers, beacons and spotlight, wonders. Lens ghosts toned down; rim shells fade before the camera enters them at close zoom. Readability pass: unit counters of one nation that overlap on screen merge into one counter with the summed strength, others lift clear; council pips, banner, seal and coup mark show a tooltip and select the nation on click; the belief view now draws borders from the beliefs and washes every out-of-date province in pulsing holo. Calm UI (#245): selecting a nation or province no longer slides the globe sideways, it is centred; the map modes are an icon strip on top of the minimap with "Map mode: <Name>" tooltips (icons in `web/src/hud/mapModeIcons.tsx`, to swap for the Figma ones); a war declaration pulses red rings at both capitals with a dashed red arc and crossed swords for about 3 s. Left: meteor showers (parked) |
| B9 | Stretch: a timeline scrubber that rebuilds the globe at any past year from `GET /api/world/log` | nothing (the mock serves the log) | | CP2 | testing | built by lane a (owner decision 14 Nov) |
| B10 | Devnet hardening: a token account for every nation founded after genesis (`country_founded`), readable memos naming payer and payee, our laptop's own devnet run | a human funds the Commons at the faucet | | CP2 | done | Owner's devnet run of #180 was clean (#183). Devnet test 14 Nov passed (`docs/tests/devnet-2026-11-14.md`): 3 nations founded after genesis each got a token account (`TN open <name>`) and paid through Commons advances; 67 payments, 43 transactions, memos read `<payer> pays <payee> <amount> TNC, <reason>: <note>`; every balance equals the ledger (drift 0, supply 1,000,000) |
| B11 | Economy depth in the sim (the core five): a main good per province, devastation, civilian fear from war readiness, an ideology axis that drifts to the extremes under war | owner decision on the design and its contract changes | | CP2 | testing | Sim core built by lane a at lane b's request (#204): `sim/economy.ts` (goods, prices, needs, the market, readiness, politics, movements), devastation folded in `applyEvent`, hooks in the nation turn, the goods market replacing trade dues in `payments.ts`, the ruler digest line; balanced on seeds 1337 and 2024 (B11-7). B11-5 globe built (b/economy-globe PR: scorch tint, readiness ring, Politics map mode with key 6 and legend, top bar compacted at 1400px); B11-6 nation card still to do. Design: `docs/research/economy-games.md`, tasks in `docs/plans/b-economy.md` |
| B12 | Economy on the globe: trade-route lines between pact partners, coin bursts on plunder and seizure, a wealth map mode | #187 for the wealth mode (X5) | | CP2 | done | Tasks 5, 6 on `b/economy-globe`: `trade/Routes.tsx` (ribbons, dashed for trade, solid for alliance), `trade/CoinBurst.tsx`, wealth mode on key 5 with `hud/WealthLegend.tsx` |
| B13 | The 15-second Solana beat: click a gold arc, land on Solana Explorer with the memo visible | B10 memo | | CP2 | done | Task 7 on `b/economy-globe`: arcs stay 6 s with a `<amount> TNC · <note>` label; arc or label click opens `row.url`. Devnet test 14 Nov: every ledger row's `url` is the Explorer page of its own confirmed transaction, memo on chain (`docs/tests/devnet-2026-11-14.md`). Left for a human: click a gold arc in the browser and time it |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->
- #187 (needs-owner): wealth map mode in X5 (B12 task 6)

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
- 14 Nov · #31 · B1 the first globe: one mesh, raised provinces with cliffs, live owner colours
- 14 Nov · #46 · B2, B3 camera, picking, selection glow, borders, painted names and flags, map modes and pulses
- 14 Nov · B4 + design · buildings from the real models, the designed top bar, decree box, legend, beliefs banner, capitals, atmosphere
- 14 Nov · #59 · placed lane c's DecreeBox and TokenMeter, data-hologram on the card mount
- 14 Nov · #59 · diplomacy legend hides under the open timeline
- 14 Nov · #72 · captureGlobe and the NewsBroadcast slot
- 14 Nov · #77 · card docked, no hologram, labels face the camera; B6 cut
- 14 Nov · building size and variety (#55 feedback)
- 14 Nov · B7 + #87 + #96 · map states (cut ring, signal lost, autopilot, ruins, dispute and collapse flashes, return ripple, belief refresh), design polish, closing card, camera centred between panels
- 14 Nov · B5 + map look + styles · war counters, march and attack arrows, battles, fronts, treaties, falls; AoH names along nations (lifted, curved, never clipped, #106), hover tooltip, terrain relief, minimap; per-nation building styles (#91); status tag and ring fixes; self-hosted Cinzel
- 14 Nov · identity + living map · per-nation identity (government tints, era density, mountain terraces, props, selection grade), units by tech age and trader ships (#122), speed slider and auto pacing (#124), clouds, generated rivers and lakes, model gallery (?gallery) with 4 prototype sets, research docs
- 14 Nov · province lines, shading, cliff steps, region borders
- 14 Nov · close-up walled towns with rivers inside (province-crossing rivers removed), AoH terrain map mode with effects legend and tooltip, names anchored on the visible land, lighter clouds, smaller interior cliffs
- 14 Nov · event beacons and spotlight tour (S), space (stars, nebula, shooting stars), council mourning/succession/pips (#146), wonders with scaffolding, reveal and Great Wall (#147), gold payment arcs and economy placement (#145), banner and minimap fixes (#143), terrain effects from TERRAIN_EFFECTS and attrition (#154), future/stellar ages and satellites (#158), lane c's EventFeed placed (#148)
- 14 Nov · #164 · vehicle effects from model anchors
- 14 Nov · sun behind the planet with corona, limb flare and lens ghosts; day/night cycle (120 s, SUN_CYCLE, reduced-motion freeze) lit from the sun with dusk fill, warm terminator band and sunward rim; night-side city lights; passing cratered moon (zoomed out only)
- 14 Nov · polish: nation names from orbit with darker ink and stronger halo, wonders 1.3x a capital and a town-height Great Wall, denser stars and three faint nebula clouds (the nebula shader never compiled: 'patch' is reserved in GLSL ES 3), towns fade in from 1.85, bigger plated council marks, beacon captions never overlap (max 2), terrain legend fits, globe tags stay below the HUD (#175)
- 14 Nov · #169 #173 · real council and wonder types, wonder GLBs, ruined wonders, no default vehicle effects
