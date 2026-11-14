# Lane c — Interface

**Owner:** @Justin-CODING-PY · **Focus:** four screens built from the owner's Figma design against the mock, and the submission · **Paths:** `web/src/ui/`

*Only this lane edits this file. Update a row's status in the same PR as the work.*
*Status words: `todo` · `next` · `wip` · `done` (merged) · `testing` (waiting on a human test) · `blocked` (link the issue) · `cut`*

Read first: `docs/hackathon-plan.md` section 4 ("How the world works") and `docs/contracts.md`.

**No row here waits on another lane.** The seed (A1) ships the store, the app shell with your
four components already placed, mock routes for lore and audio, and default colours. Each row
replaces one placeholder in `web/src/ui/` with the real component. When lane a's design (A12)
lands, only the variable values change; when lane b's hologram lands, it picks up your card.

**Before A1 merges (about 30 minutes):** pull, read the plan and contracts, and write the lane
plan for C1 and C2 with `durhack-plan` (lane mode).

**Running in parallel.** Each row has its own folder (`web/src/ui/create/`, `card/`,
`chronicle/`, `network/`), so C1 to C4 can run in any order or two at a time. To save agent
budget, run them one at a time in the order below, on Sonnet.

## Rows

| ID | Row | Needs (from other lanes) | Gives (to other lanes) | Checkpoint | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Create screen: prompt, preset chips, number of nations, era, sea level, aggression; calls `POST /api/world` | A1 only | | CP1 | testing | Use the X7 variables; the designed values arrive with A12 |
| C2 | `NationCard`: the flag (drawn with `flagSvg`, swapped for the painted one from X3 when it loads), name, leader, government, ideology, culture, politics, history, the relations list with each neighbour's stance and story, and the play buttons for narration and anthem (X6) | A1 only | the card to b (shown in the hologram) | CP1 | testing | Plain component, 380 px wide, transparent background. When a region is selected it shows the region's name, flag and story instead (X3 region lore) |
| C3 | Chronicle: a live ticker of the story and a scrollable timeline; clicking an entry selects and flies to that nation | A1 only | | CP1.5 | testing | |
| C4 | Network panel: per nation cut, restore, silence, wake and delete; blackout; speed and pause; the token meter; the decree box; the "what it believes" toggle; the map mode buttons | A1 only | | CP1.5 | testing | Sends X2 control messages; works fully against the mock |
| C5 | Submission: the project text against the overall criteria and each sponsor's, the 2-minute table demo script, the prize ticks, the README | all | | CP3 | testing | Drafted by lane a (owner decision 14 Nov): `docs/submission.md` (text, prize sections, 2-minute table demo script, `[check]` items), README and judge Q&A refreshed. Lane c reviews, rehearses the table demo and submits; platform and deadline still to confirm |
| C6 | Image prompt: an optional picture drop zone on the Create screen, sent as `imageBase64` (downscaled under about 4 MB) | A17 for the real reading (mocked) | | CP1.5 | testing | Asked by lane a in #73 |
| C7 | Spoken decrees: a hold-to-speak mic on `DecreeBox` (MediaRecorder, up to 15 s) posting to `POST /api/decree/voice` and showing the transcript | A20 (mocked) | | CP2 | testing | #73 |
| C8 | `NewsBroadcast`: the "Terra Nova News" lower-third, every 2 minutes and on lane b's button: capture, `POST /api/broadcast`, play, scroll the script | A21 (mocked); lane b `captureGlobe` (real, #74) | `NewsBroadcast` to b | CP1.5 | testing | #73 |
| C9 | Solana: `LedgerPanel` and `EconomyCounter` (exported, and shown as a "Treasury" tab in the network panel), and "Treasury on Solana" on `NationCard`; polls `GET /api/economy` | A27 (mocked) | | CP2 | testing | Owner request #144, MLH Best Use of Solana |
| C10 | Visual event feed: picture cards with globe thumbnails for big moments | lane b `captureGlobe` | | CP2 | testing | Lane b's #148; owner asked in #151 |
| C11 | Council on `NationCard`: ruler and general with generated portraits, years in office, a status chip, memory on hover, and Kill (two-click), Cut and Restore buttons per member | A29 | | CP2 | testing | Owner request #170 (Neptune North: resilience inside a nation) |
| C14 | Terra Nova News anchor window (built by lane a, owner decision 14 Nov): a 360 x 220 broadcast window on the lower-third, an ident, a studio and six original presenters lip-synced to the bulletin, cutaways to the globe capture | X3 broadcast, X6 `audio.broadcastAnalyser()` | | CP2 | testing | `web/src/ui/news/` (`AnchorWindow.tsx`, `studio.ts`, `lipsync.ts`); shots in docs/shots/news-anchor-1..3.jpg |
| C13 | Economy on `NationCard` (B11-6): status chips (war readiness, devastation, shortages) under the facts, an Economy tab (goods, prices, shortages), politics movement in the Politics tab | B11 | | CP2 | testing | Lane a request #224 |
| C16 | Presentation mode (P) and a collapsed-by-default screen (ticker, history strip, decree, ledger as icons); decree wider at 1800 px+ | | | CP2 | testing | Owner decision on #276, assigned in #275 |
| C17 | Decree result in the UI: a war-tab style dispatch with `decree.result`, and the decree box shows the result line | A20 severity (#288) | | CP2 | testing | Owner decision on #288 |
| C18 | Event feed by priority (#279): big news only, full two-line sentences, a kind tag, at most one card every 2 s, small news grouped; small 288x162 captures | | | CP2 | testing | Lane b request #279 |
| C12 | Prepare mode panel and Create toggle (built by lane a, owner decision 14 Nov) | X2 `prepare` message and control, X3 `prepare: true` (#200) | | CP2 | testing | `web/src/ui/prepare/`; dev mock behind `?mockPrepare=1` until the server sends `prepare` |
| C15 | Calm UI: left panel, war tabs, node-graph network (built by lane a, owner decision on #245) | | | CP2 | testing | One left panel at a time (`web/src/ui/leftPanel.ts`, `calm.css`): the nation and province card docks left with a ruler line, a stats grid and diplomacy as flag groups; war tabs top right (restores #225, which #226 had overwritten); the Network panel is a node graph with a tray for the picked nation. Figma page "Calm UI (#245)". Map-mode icons for lane b in `web/src/ui/icons/mapmodes/`. Shots: docs/shots/calm-ui-1..3.jpg |

## Waiting on

<!-- Open agent-request / needs-owner issues this lane is waiting for: #.. -->

## Log

<!-- One line per merged PR: time · PR # · what. Newest last. -->
- 14 Nov · #22 · C1 Create screen and C2 nation card (testing: #23, #24)
- 14 Nov · #38 · C3 chronicle and C4 network panel (testing: #39, #40)
- 14 Nov · #58 · C1 to C4 rebuilt to the Figma design (A12); new DecreeBox and TokenMeter exports for lane b
- 14 Nov · #81 · C6 picture prompt, C7 spoken decrees, C8 Terra Nova News; card always docked (#78)
- 14 Nov · #89 · C8 on the real A21: preparing state, real playBroadcast, text-only when audio fails
- 14 Nov · #95 · C1 to C4 to the polished design (#88): founding scroll, card states, herald dispatches, folded network tab
- 14 Nov · #100 · TokenMeter call count in a .calls span for the compact top bar (#98)
- 14 Nov · #105 · C7 on the real A20: the voice route's own error lines, mimeType sent with codecs
- 14 Nov · #110 · Network rows never overflow; the deleted stamp freezes at the year of deletion (#108)
- 14 Nov · #119 · News lower-third names its anchor (#111); secession is a real kind (A18)
- 14 Nov · #150 · Browser QA at 1280 x 709: Create fits under the top bar, all timeline lanes fit, herald publishes --tn-herald-bottom, news clears the network panel, herald queue capped, war bands end at a fall
- 14 Nov · #155 · C9 Solana: Treasury tab with the ledger and counter, treasury link on the card
- 14 Nov · #159 · C10 visual event feed (EventFeed) for lane b to place
- 14 Nov · #174 · C11 council on the card: cameo portraits, status chips, memory, Kill / Cut / Restore
- 14 Nov · #225 · Herald dispatches as small top-right tabs; network controls explained (#217)
- 14 Nov · #227 · C13 economy on the card: status chips, Economy tab, politics movement
- 14 Nov · #281 · C16 presentation mode (P) and a collapsed screen on every reload; decree wider at 1800 px+
- 14 Nov · #289 · C17 decree result in the decree box and as a dispatch tab
- 14 Nov · #293 · C18 event feed by priority, full sentences, decade grouping (#279)
