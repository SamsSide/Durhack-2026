# Lane b — The globe

**Owner:** @CutGrass88 · **Focus:** the 3D planet: tiles, camera, borders, map modes, buildings, war animation, status visuals, the hologram, performance · **Paths:** `web/` except `web/src/ui/`, `web/src/audio/`, `web/src/theme/` and `web/public/models/`

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

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
| B2 | Camera and selection: orbit, smooth zoom from whole planet to a few tiles, click a tile to select its nation, a glowing border round the selected nation, `flyTo` | | selection to c | CP1 | testing | Smooth orbit and zoom, click and double-click, hover highlight, pulsing gold selection border |
| B3 | The political map: borders for every nation, thinner region borders inside them when zoomed in, each nation's flag (`flagSvg`) by its name label, labels that fade with zoom, a colour pulse when a tile changes owner, and the map modes in X5 (political and diplomacy first; terrain and strength after) | | | CP1 | testing | Inked borders, names and flags painted on the land, map mode buttons and keys 1-4 with crossfade, owner-change pulse |
| B4 | Structures: instanced models from the X4 manifest (box fallback), a pop-up build animation, upgrades, trees, detail only when zoomed in | nothing (boxes until A8's models land) | | CP1 | testing | Real models in nation colour, pop-up builds with dust, upgrades, sinking ruins, trees, detail when close; smaller, clustered, per-nation tint (feedback #55) |
| B5 | Units and war: armies marching between tiles with their strength shown, volleys and flashes on a battle, smoke on captured tiles, a front line between nations at war | nothing (the mock emits wars) | | CP1.5 | testing | HOI-style army counters with strength numbers, movement arrows, front lines |
| B6 | The hologram: on selection a beam rises from the capital and projects lane c's `NationCard` with scan lines, glow and flicker; it follows the camera and docks to the side on a narrow screen | nothing (the seed's placeholder card and default colours until C2 and A12 land) | | CP1.5 | cut | Removed by owner in #77 (card is docked, no hologram) |
| B7 | Agent status on the globe: a cut nation behind a static ring, an autopilot marker, a deleted nation crumbling to ruins, and the beliefs view (`beliefOf`) | nothing (the mock accepts every control) | | CP1.5 | testing | Makes resilience visible |
| B8 | Polish and speed: ocean, atmosphere glow, stars, lighting, a steady 60 frames a second with 500 provinces | | | CP2 | todo | Includes polishing the coast cliffs (feedback on #33) |
| B9 | Stretch: a timeline scrubber that rebuilds the globe at any past year from `GET /api/world/log` | nothing (the mock serves the log) | | CP2 | todo | Cut first if behind |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

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
