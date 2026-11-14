# Lane c plan — Create screen and nation card

- **Rows:** C1, C2
- **Branch:** `c/create-and-card`
- **Paths allowed:** `web/src/ui/` only (anything else: NEEDS_OTHER_LANE for `web/src/state/`,
  `App.tsx`, `web/index.html`, `web/package.json`; NEEDS_OWNER for `web/src/theme/`, `server/`,
  `packages/shared/`, new dependencies)
- **Contracts:** X1 (types, `flagSvg`), X3 (`POST /api/world`, `GET /api/replays`,
  `POST /api/replays/:id/play`, country lore, region lore, painted flag), X5 (store, component
  names and props), X6 (audio stub), X7 (`tokens.css` variables). All are mocked by the seed (A1)
  and run against `npm run mock`; nothing here waits on another lane.
- **Done when:** on `main`, `npm run mock` + `npm run dev` shows the Create overlay; typing a
  prompt and pressing Create gives a world and hides the overlay; clicking a nation shows the
  full card with lore, relations and working narration/anthem buttons.

Decisions from lane c (14 Nov): atlas look now from the X7 variables; Create is a full-screen
overlay with a reopen button and the saved replays; no preset chips, one prompt box with the
other inputs folded away; card shows store facts at once and fades the lore in; clicking a
neighbour selects it and flies there; C1 and C2 run in parallel on Sonnet.

## Shared rules for both tasks

- Read first: `docs/hackathon-plan.md` section 4, `docs/contracts.md` X1, X3, X5, X6, X7, and
  what the seed actually shipped in `web/src/ui/`, `web/src/state/world.ts`,
  `web/src/audio/index.ts`, `web/src/theme/tokens.css`, `web/src/App.tsx`. If the code and
  `contracts.md` disagree, the code wins.
- **Colours, fonts, spacing, radii only from `var(--…)` names that exist in `tokens.css`.** No
  hex, rgb or named colours in component code or CSS. Never edit `tokens.css` (lane a). If a
  needed role has no variable, define a local one at the top of the component's CSS file from
  existing variables (for example `--c-ink-faint: color-mix(in srgb, var(--<text>) 55%, transparent)`),
  so the Figma values (A12, Sat 18:00) restyle everything by changing `tokens.css` alone.
- **Look: an old atlas.** Parchment-toned panels, a serif font stack (use the token font if
  there is one, otherwise `Georgia, 'Iowan Old Style', 'Palatino Linotype', serif` defined once
  as a local variable), thin ink-line borders, small-caps section headings, a hairline rule
  between sections. Restrained motion: 150 to 250 ms fades only. No emojis anywhere.
- One CSS file per component folder, imported by the component; class names prefixed `tn-` to
  avoid clashing with lane b. No new dependencies (React, zustand, `@terra/shared` are there).
- `web/src/ui/index.ts` is shared by the two tasks: each task changes **only the one export
  line for its own component**, keeping the export name and props exactly as in X5.
- Fetch with plain `fetch` to relative `/api/...` URLs (the Vite proxy). Every fetch handles
  non-200 and network errors without throwing to React.
- Smoke gate: `./check.sh` (lint, build, the app starts). No new test framework.

## Task 1: C1 Create screen

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Task 2 (no shared files except one line each in `index.ts`)
- **Files:** `web/src/ui/create/CreateScreen.tsx` (create), `web/src/ui/create/create.css`
  (create), `web/src/ui/index.ts` (change the `CreateScreen` export line only)
- **Build:**
  - `CreateScreen`, no props. **Visibility is already handled by lane b's `App.tsx` (seed):**
    it mounts `CreateScreen` centred over a dark scrim when there is no world or the top bar's
    *New world* was pressed, closes it when `world.id` changes, and closes it on a scrim click.
    So `CreateScreen` renders only the panel; it does not render its own overlay, scrim or
    reopen button, and it unmounts by itself when the new world arrives.
  - **Panel:** parchment panel (`.panel` from `tokens.css`, refined in `create.css`), width
    `min(560px, calc(100vw - 32px))`, `max-height: calc(100vh - 32px)` with internal scroll.
    - Title "Terra Nova", subtitle "Describe a world. Its nations will do the rest."
    - **One prompt box** (textarea, 2 to 4 rows, autofocus, placeholder
      "a drowned post-apocalyptic world"). Required: Create is disabled while it is blank.
      Enter submits, Shift+Enter makes a new line.
    - **Create** button (primary).
    - **More options** fold, closed by default (a `<details>`-style disclosure), holding:
      number of nations (3 to 10, stepper or slider, default 6); era (select:
      "Let the world decide" (default, sends no `era`), "Stone age", "Bronze age",
      "Classical", "Medieval", "Age of sail", "Industrial", "Post-apocalyptic", "Far future";
      send the label in lower case); sea level (slider 0.3 to 0.8, step 0.05, default 0.55,
      labels "Dry" and "Drowned"); aggression (slider 0 to 1, step 0.05, default 0.5, labels
      "Peaceful" and "Warlike"). Each shows its current value.
    - **Saved worlds:** below, `GET /api/replays` on mount; if it returns a non-empty array,
      list each as a row (name, "N events") with a *Replay* button that calls
      `POST /api/replays/:id/play`. If the route fails or returns `[]`, render nothing.
  - **Submit:** `POST /api/world` with JSON `{ prompt, nations, seaLevel, aggression }` plus
    `era` only when one was chosen. While waiting (request in flight, then until the new
    snapshot arrives) disable the form and show "Composing your world…" with a slow pulsing
    ink line. Timeout after 30 s without a snapshot: show "The world is taking a while. Try
    again." and re-enable. Non-200: show the server's `error` text, or "Could not reach the
    server", and re-enable. Same waiting behaviour for *Replay*.
  - Delete the seed placeholder `web/src/ui/CreateScreen.tsx` once the export points at
    `./create/CreateScreen`.
- **Contract:** X3 `POST /api/world`, `GET /api/replays`, `POST /api/replays/:id/play` exactly as
  in `docs/contracts.md`; X5 `useWorld` (`world`, `connected`). If `connected` is false, show a
  quiet "Connecting to the server…" line under the button (the form still works).
- **Smoke proof:** `./check.sh` passes (lint, build, app starts).
- **HUMAN_TEST:** `npm run mock` and `npm run dev`, open http://localhost:5173.
  1. With no world, the overlay shows, prompt focused, Create disabled until you type.
  2. Type a prompt, press Enter: "Composing your world…", then the overlay fades out and the
     globe shows the world.
  3. The top bar's *New world* reopens it; clicking the dark backdrop closes it.
  4. Open *More options*, set 8 nations, Medieval, sea 0.7, aggression 0.9, Create: the
     request body in the browser's Network tab has those values and `era: "medieval"`.
  5. Stop the server and press Create: an error line, form usable again.
  6. Phone width (DevTools, 375 px): no horizontal scroll, panel fits.

## Task 2: C2 NationCard

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Task 1
- **Files:** `web/src/ui/card/NationCard.tsx` (create), `web/src/ui/card/RegionView.tsx`
  (create), `web/src/ui/card/useLore.ts` (create), `web/src/ui/card/card.css` (create),
  `web/src/ui/index.ts` (change the `NationCard` export line only)
- **Build:**
  - `NationCard({ countryId, regionId }: { countryId: number; regionId?: number | null })`.
    Root element: 380 px wide (`max-width: 100%`), **transparent background** (lane b's
    hologram shows through; contents use parchment-tinted text and ink lines from the
    variables), `max-height: 72vh` with the body scrolling inside. Re-render on
    `useWorld(s => s.version)` and read the country from `world.countries[countryId]`. If the
    world or the country is missing, render nothing.
  - **Region mode:** when `regionId` is a number, render `RegionView` instead: the region flag
    (`flagSvg(region.flag, 90, 60)`), its name (or "Unnamed lands" if `''`), "held by
    <owner nation name>" (click: `select(owner)`), unrest as a thin bar, and `summary` and
    `history` from `GET /api/region/:id/lore` with the same loading and error treatment as
    below.
  - **Header (instant, from the store):**
    - Flag: `flagSvg(country.flag, 90, 60)` rendered inline. In the background request
      `GET /api/country/:id/flag` once per country per page load (remember results in a
      module-level `Map`); when the image loads, cross-fade to it; on 503 or any error keep the
      drawn flag silently.
    - Name (large serif), then "<government> · led by <leader>".
    - Status badges when they apply, from `agents` and the country: "Link cut" (link `cut`),
      "Ruler silent" (ruler `autopilot`), "Deleted" (deleted), "Fallen" (`alive` false).
    - Ideology as an italic line; culture traits as small ink-outlined chips; population and
      treasury as two small figures (formatted with thousands separators).
  - **Lore (fades in):** `useLore(countryId)` fetches `GET /api/country/:id/lore` when
    `countryId` changes (abort the previous request; keep a module-level cache by id so a
    re-click shows the last lore at once, then refetch quietly if `world.tick - asOfTick > 60`).
    Sections with small-caps headings: *Who they are* (`summary`), *Culture*, *Politics*,
    *History*. While loading: three shimmering placeholder lines per section. On error:
    "The archives are silent." with a *Try again* link.
  - **Relations:** from `world.relations` (every relation with another country that is still
    in `world.countries`), sorted war, hostile, alliance, trade, neutral. Each row: the
    neighbour's flag (24 x 16, `flagSvg`), its name, a stance badge (text plus a colour from a
    local variable per stance, built from the tokens), and the `story` from the lore's
    `relations` entry with the same `with` id when the lore has arrived. Click a row:
    `select(otherId)` then `flyTo(otherId)`. Rows are buttons (keyboard reachable).
  - **Sound:** two buttons, *Hear their story* (`audio.playNarration(id)`) and *Play anthem*
    (`audio.playAnthem(id)`), from `web/src/audio/index.ts` (X6). Read state with
    `useAudio()` from `web/src/audio/useAudio.ts` (the seed's hook). Delete the seed
    placeholder `web/src/ui/NationCard.tsx` once the export points at `./card/NationCard`. When state is `loading` for this
    country, the pressed button shows "Summoning…"; when it is playing for this country, the
    button reads *Stop* and calls `audio.stop()`. While the anthem plays, show the lore's
    `anthemLyrics` under the buttons, one line each, in italic. Promise rejections are caught
    and show "Voice unavailable" on the button for 3 s.
- **Contract:** X1 (`Country`, `Relation`, `Stance`, `Region`, `AgentStatus`, `flagSvg`), X3
  country lore, region lore, painted flag; X5 `useWorld` (`world`, `version`, `agents`,
  `select`, `flyTo`); X6 `audio`. **Mock:** the seed's mock routes and the X6 stub.
- **Smoke proof:** `./check.sh` passes (lint, build, app starts).
- **HUMAN_TEST:** `npm run mock` and `npm run dev`, create a world, click a nation.
  1. The card shows flag, name, leader, government, ideology, culture chips at once; lore
     paragraphs shimmer then fade in.
  2. Relations listed war first, each with a story once lore arrives; clicking one selects
     that nation and the camera flies there; the card switches to it.
  3. *Hear their story* shows "Summoning…" then *Stop*; *Play anthem* shows the lyrics.
  4. Zoom in close and click a province: the card shows the region view.
  5. With the server's painted flag route returning 503, the drawn flag stays, no error shown.
  6. Long lore scrolls inside the card; the card never grows past 72 % of the screen height.
