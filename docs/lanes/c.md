# Lane c — Interface

**Owner:** @Justin-CODING-PY · **Focus:** four screens built from the owner's Figma design against the mock, and the submission · **Paths:** `web/src/ui/`

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Create screen: prompt, preset chips, number of nations, era, sea level, aggression; calls `POST /api/world` | A1; B1 (app shell) | | CP1 | next | Use the X7 variables; restyle when A12 lands |
| C2 | `NationCard`: the flag (drawn with `flagSvg`, swapped for the painted one from X3 when it loads), name, leader, government, ideology, culture, politics, history, the relations list with each neighbour's stance and story, and the play buttons for narration and anthem (X6) | A1 (X3 lore mock, X6 stub); B1 (X5) | the card to b (shown in the hologram) | CP1 | todo | Plain component, 380 px wide, transparent background. When a region is selected it shows the region's name, flag and story instead (X3 region lore) |
| C3 | Chronicle: a live ticker of the story and a scrollable timeline; clicking an entry selects and flies to that nation | B1 (X5) | | CP1.5 | todo | |
| C4 | Network panel: per nation cut, restore, silence, wake and delete; blackout; speed and pause; the token meter; the decree box; the "what it believes" toggle; the map mode buttons | B1 (X5) | | CP1.5 | todo | Sends X2 control messages; works fully against the mock |
| C5 | Submission: the project text against the overall criteria and each sponsor's, the video, the prize ticks, the README | all | | CP3 | todo | Mostly writing; platform and deadline not announced yet |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
