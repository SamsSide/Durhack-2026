# Lane b — The globe

**Owner:** @CutGrass88 · **Focus:** the 3D planet: tiles, camera, borders, buildings, war animation, status visuals, performance · **Paths:** `web/` except `web/src/ui/` and `web/public/models/`

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Web app shell (Vite, React, three.js with react-three-fiber), the X5 store connected to `npm run mock`, and a globe drawing every tile coloured by terrain with an owner tint | A1 (X1, X2 mock) | X5 to c | CP0 | next | Start on the mock the moment A1 merges |
| B2 | Camera and selection: orbit, smooth zoom from whole planet to a few tiles, click a tile to select its nation, a glowing border round the selected nation, `flyTo` | | selection to c | CP1 | todo | |
| B3 | Borders for every nation, name labels that fade with zoom, and a colour pulse when a tile changes owner | | | CP1 | todo | |
| B4 | Structures: instanced models from the X4 manifest (box fallback), a pop-up build animation, upgrades, trees, detail only when zoomed in | A8 (X4), falls back without it | | CP1 | todo | City-builder feel |
| B5 | Units and war: armies marching between tiles, volleys and flashes on a battle, smoke on captured tiles, a war front line between nations at war | A6 events, mock until then | | CP1.5 | todo | |
| B6 | Agent status on the globe: a cut nation shown behind a static ring, an autopilot marker, a deleted nation crumbling to ruins, and the beliefs view (`beliefOf`) | A7, mock until then | | CP1.5 | todo | Makes resilience visible |
| B7 | Polish and speed: ocean, atmosphere glow, stars, lighting, a steady 60 frames a second with 1,400 tiles | | | CP2 | todo | |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
