# Lane c — Story, sound and interface

**Owner:** @Justin-CODING-PY · **Focus:** the Create screen, nation panel, lore, narration, anthem, chronicle, network controls, submission · **Paths:** `web/src/ui/`, `server/src/story/`

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Create screen: prompt, preset chips, number of nations, era, sea level, aggression; calls `POST /api/world` | A1; B1 (app shell) | | CP1 | next | Build as components in `web/src/ui/`; lane b places them |
| C2 | Nation panel: name, leader, government, ideology, culture, history and a relations list with each neighbour's stance and story; opens on selection | B1 (X5) | | CP1 | todo | Lore from the mock first |
| C3 | Lore route `GET /api/country/:id/lore`: Gemini writes culture, politics, history and relations from the nation's real chronicle; cached; template version for mock mode | A1 (`getWorld`) | X3 lore | CP1 | todo | |
| C4 | Narration: ElevenLabs speaks the lore, cached on disk; a player in the panel; a voice chosen from `voiceStyle` | C3 | X3 narration | CP1.5 | todo | MLH ElevenLabs |
| C5 | Anthem: ElevenLabs music from `anthemPrompt`, cached; plays from the panel | | X3 anthem | CP1.5 | todo | Check music access on our plan first |
| C6 | Chronicle: a live ticker of the story, a scrollable timeline, click an entry to fly to it; a small web of who is allied and at war | B1 (X5) | | CP1.5 | todo | |
| C7 | Network panel: per nation cut, restore, silence, wake, delete; blackout; speed and pause; the token meter; the decree box; a "what it believes" toggle | B1 (X5); A7, mock until then | | CP1.5 | todo | The demo's key moment |
| C8 | Stretch: an image as input, read by Gemini for mood and palette | A5 | | CP2 | todo | Cut first if behind |
| C9 | Submission: project text against the overall criteria and each sponsor's, the video, prize ticks, the README | all | | CP3 | todo | Platform and deadline not announced yet |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
