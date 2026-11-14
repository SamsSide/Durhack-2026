# Lane c plan — Build C1 to C4 to the Figma design

- **Rows:** C1, C2, C3, C4 (follow-up: their final look, from A12)
- **Branch:** `c/design-restyle`
- **Paths allowed:** `web/src/ui/` only (anything else: NEEDS_OTHER_LANE for `web/src/state/`,
  `App.tsx`; NEEDS_OWNER for `web/src/theme/`, `docs/design/`, `server/`, `packages/shared/`,
  new dependencies)
- **Contracts:** X1, X2, X3, X5, X6, X7 (the designed `tokens.css`, `docs/design/`).
- **Done when:** on `main`, the four components match `docs/design/*.png` and
  `docs/design/reference.html`, using only the variables in `web/src/theme/tokens.css`.

Decisions from lane c (14 Nov, after A12 landed, issue #49):
- Follow the design everywhere, which supersedes these earlier choices: preset chips are back
  and the inputs are shown openly; the expanded chronicle is the swimlane timeline.
- The decree input and the token meter leave the network panel. They become two new exported
  components, `DecreeBox` and `TokenMeter`, for lane b to place in `App.tsx` (agent-request).
  This adds two X5 exports, so the owner is told (needs-owner, non-blocking).
- Four agents in parallel: Sonnet for C1, C2 and C4; Opus for the swimlanes (C3).

## Shared rules for all tasks

- **The spec is the design:**
  - `docs/design/README.md` (the style guide and your screen's section);
  - your screen's PNG in `docs/design/` (open it with the Read tool, it is an image);
  - the class rules in `docs/design/reference.html` for your screen. Copy those CSS rules into
    your folder's CSS file, renaming classes with a `tn-` prefix where they could clash.
- **Global classes already in `tokens.css`** (use them, don't redefine them): `.panel`,
  `.btn`, `.btn.primary`, `.btn.danger`, `.btn.active`, `.chip`, `.chip.active`, `.holo`,
  `.holo.speaking`.
- **Variables only.** No hex or rgb in component CSS or TSX; nation colours are data, inline
  only as a swatch, flag or fill. Never edit `tokens.css`. Fonts come from the tokens' `@import`.
- **Type:**
  - Cinzel (`--font-display`) for titles, names and small uppercase labels;
  - EB Garamond (`--font-serif`) for body text, with italic as the muted voice;
  - IBM Plex Mono (`--font-mono`) for years and numbers.
- **Icons:** inline SVG only (play, stop, pause, close, chevron, diamond). No emojis, icon
  fonts, `backdrop-filter`, blur or sans-serif.
- Keep all existing behaviour that the design does not contradict (the fetches, error
  handling, pacing, the two-click delete, the select and flyTo calls).
- Keep export names and props exactly as in X5. Change only your own folder.
  `web/src/ui/index.ts` is changed only by Task 4 (two new export lines).
- `App.tsx` must not change (lane b): components size themselves inside the containers it gives.
- Smoke gate: `./check.sh`. Batched agents run `npm run -s typecheck` and
  `npm run -s build -w web` only.

## Task 1: C1 Create screen to the design

- **Agent:** durhack-frontend · **Model:** sonnet · **Parallel with:** 2, 3, 4
- **Files:** `web/src/ui/create/CreateScreen.tsx`, `web/src/ui/create/create.css`
- **Build** (per README *CreateScreen* and `create.png`):
  - **Panel:** 640 px wide, `max-width: calc(100vw - 32px)`, scrolling inside if the screen is
    short.
  - **Header:** rubric kicker "A new world", title "Found a World", italic subtitle.
  - **Prompt box:** 19 px, about three lines; Enter submits, Shift+Enter adds a new line.
  - **"Or start from" preset chips** (`.chip`, the chosen one `.chip.active`):
    - Post-apocalyptic, Bronze age, Floating archipelago, Ice world, Desert empires, Clockwork
      age, Jungle city-states.
    - Clicking one fills the prompt with a vivid one-line example for that preset and sets the
      era. The era list must contain each preset's era.
    - Editing the prompt by hand afterwards clears the chip's active state.
  - **Two-column grid** (shown openly, no fold):
    - Nations stepper: minus, value, plus, then 8 diamond pips for 3 to 10; default 6.
    - Era select: keep "Let the world decide" as the first option, sending no `era`.
    - Sea level and Aggression sliders: ink track, parchment knob, the percent in rubric mono,
      italic end words "Dry continents / Drowned" and "Peaceful / Warlike".
  - **Footer:** a mono note of the LLM mode on the left (from `useWorld(s => s.budget)?.mode`,
    for example "Mock mode: no API calls" or "Live: Gemini"; hidden if unknown). The primary
    "Create world" button is on the right.
  - **States:**
    - Create is disabled (0.45 opacity) until the prompt has text.
    - While waiting, the button reads "Founding the world...".
    - An error is one italic rubric line above the footer.
    - Keep the 30 s timeout and the "Saved worlds" replay list, styled to match: a quiet
      section under the grid, hidden when empty.
- **HUMAN_TEST:** compare with `docs/design/create.png`; a preset fills prompt and era; the
  stepper stays within 3 to 10; Create posts the values.

## Task 2: C2 NationCard to the design

- **Agent:** durhack-frontend · **Model:** sonnet · **Parallel with:** 1, 3, 4
- **Files:** `web/src/ui/card/*`
- **Build** (per README *NationCard* and `card.png`):
  - **Layout:** 380 px wide, height follows the content, capped at 72vh with an inner scroll.
  - **Header:**
    - flag 66 x 44 in a 1px ink frame (keep the painted-flag cross-fade);
    - name in 21 px Cinzel;
    - "Led by ..." in italic;
    - a close cross top right, which calls `select(null)`;
    - for a fallen nation (`alive` false), a rubric "Fallen in Y<year>" line, taking the year
      from the latest `fall` chronicle entry naming it, or omitting the year if there is none.
  - **Ideology:** a quote with a 2px rubric left rule on a darker parchment wash.
  - **Facts:** a two-column grid of Government, Provinces (the count of `world.owner` equal to
    the id), Population and Treasury, with numbers in mono.
  - **Lore:**
    - The Summary is always shown.
    - Below it, tabs **Culture | Politics | History | Relations**; the active tab has ink text
      and a 2px rubric underline.
    - Culture shows the culture chips plus the culture paragraph.
    - Relations lists every other living nation: swatch, name and a stance chip
      (`.stance-war` etc. from the reference; neutral is outlined), plus the lore story under
      it when present. Keep the war-first sort and click-to-select-and-fly.
    - Tab state is local.
  - **Footer:** Narrate and Anthem as equal outlined buttons with an inline SVG play triangle.
    - Loading (`useAudio` state `loading` for this nation): the button reads "Loading...".
    - Playing: that button turns solid ink, with a stop square, "Stop" or "Stop anthem", and
      small CSS equaliser bars. Show the anthem lyrics while the anthem plays.
    - The audio module exposes no position, so skip the "0:22 / 0:58" line. Show a thin
      rubric line that pulses instead of a progress bar.
  - **Lore states:**
    - Loading: three faint bars and the italic line "Consulting the archives...".
    - Error: the italic line "No lore is available yet." with a "Try again" link.
  - **Hologram vs docked.** The root always has class `panel tn-card`.
    - On mount, if the root has an ancestor with `data-hologram` (`el.closest('[data-hologram]')`),
      swap `panel` for `holo` (lane b will put `data-hologram` on the beam's mount; this is
      being agreed with lane b).
    - In either mode, add `speaking` while narration or the anthem plays for this nation.
    - The component never draws the beam.
  - **Region view:** the same header style, region flag, "Held by <nation>", the unrest bar and
    summary and history.
- **HUMAN_TEST:** compare with `docs/design/card.png` (idle, playing, docked, loading); tabs
  switch; the close cross deselects; the warm glow shows while speaking inside the hologram.

## Task 3: C3 Chronicle to the design, with the swimlane timeline

- **Agent:** durhack-frontend · **Model:** opus · **Parallel with:** 1, 2, 4
- **Files:** `web/src/ui/chronicle/*` (split into `Ticker.tsx`, `Timeline.tsx`,
  `kinds.ts` as needed)
- **Build** (per README *Chronicle* and `chronicle.png`):
  - **Ticker** (the default):
    - A 40 px parchment strip, with a solid ink "Chronicle" label cell on the left.
    - Then the recent entries (the last 12), newest first. Each is a kind diamond (inline SVG
      filled with `var(--kind-<kind>)`), the year in rubric mono ("Y214") and the text,
      separated by small ink diamonds.
    - The strip scrolls left slowly in a seamless CSS loop (about 40 px a second) and pauses on
      hover.
    - A new entry joins at the front.
    - Clicking an entry selects its first nation and flies there.
    - A "Timeline" button on the right expands the timeline.
    - Drop the 2.5 s pacing and the "+N" (the scrolling strip replaces them).
  - **Timeline** (expanded):
    - **Panel:** full width of its container, about 400 px tall (`min(400px, 50vh)`), rising
      from the bottom over 200 ms. It toggles with the `h` key (ignored while typing) and
      closes with Escape.
    - **Header:** title "The Chronicle", italic "of <world.name>, years A to B", a legend of
      the kinds (diamond and name), and a "Collapse" button.
    - **Body:** one 34 px swimlane per nation (a swatch and the name in a 200 px left column;
      fallen and deleted nations stay, dimmed), on an SVG year axis with a tick every 10 years
      spanning the first to the current year.
      - A kind diamond at each entry's year on the lanes of every nation it names. Entries
        naming no nation go on a top "World" lane.
      - **War bands:** a faint red band on both nations' lanes from each `war` entry naming two
        nations to the next `peace` entry naming the same pair (or to now).
      - **The Silence:** a cyan band across all lanes for any period a nation was cut, from
        each `silence` entry to the next `return` entry for that nation, or to now if its agent
        link is still `cut`.
      - A gilt "Now" line at the current year.
      - Hovering a diamond shows a small parchment tooltip with the year, kind and text.
        Clicking it selects and flies to the nation.
      - The selected nation's lane gets a gilt wash.
      - Horizontal scroll if the years do not fit.
    - **Under the lanes:** the last three entries as a list.
  - **Secession:** `ChronicleKind` has no `secession`. Treat a `founding` entry whose first
    country has `parent !== null` as a secession: diamond `var(--kind-secession)`, label
    "secession".
  - **Performance:** memoise the lane layout on the chronicle length, and render diamonds as
    one SVG.
- **HUMAN_TEST:** compare with `docs/design/chronicle.png`; the ticker scrolls and pauses on
  hover; the timeline shows lanes, war bands and a cyan band after a cut and restore; tooltips
  and clicks work.

## Task 4: C4 NetworkPanel to the design, plus DecreeBox and TokenMeter

- **Agent:** durhack-frontend · **Model:** sonnet · **Parallel with:** 1, 2, 3
- **Files:**
  - `web/src/ui/network/*`
  - `web/src/ui/decree/DecreeBox.tsx`, `decree.css` (create)
  - `web/src/ui/meter/TokenMeter.tsx`, `meter.css` (create)
  - `web/src/ui/index.ts`: add exactly two lines, `export { DecreeBox } from './decree/DecreeBox';`
    and `export { TokenMeter } from './meter/TokenMeter';`
- **Build** (per README *NetworkPanel*, *Top bar* and `network.png`, `topbar.png`):
  - **NetworkPanel:**
    - **Panel:** 300 px wide; title "The Network" and an italic one-liner. Keep the fold-to-tab
      behaviour. Remove the token meter and the decree box from the panel.
    - **Switch rows:**
      - *Blackout*: the toggle turns rubric red when on. Keep the existing send logic.
      - *Show beliefs*: the toggle turns ink when on. The subtitle names the nation shown, and
        keeps the "N provinces out of date" drift line.
    - **Nation rows:**
      - Swatch and name.
      - State chips: **Link up** (green outline with a dot) or **Cut** (solid red), and **LLM
        ruler** (gilt) or **Autopilot** (slate).
      - When cut, a mono line "N events queued · silent N yrs".
      - Buttons Cut/Restore, Silence/Wake and Delete (danger, keep the two-click confirm), all
        extra small.
      - The selected nation's row has a gilt wash and a 3px gilt left bar. A cut row has a faint
        cyan wash.
      - **Deleted** rows: the name struck through, a "Deleted" chip, the italic line "Its lands
        lie in ruin; neighbours are carving them up.", and no buttons.
      - Fallen nations: a "Fallen" chip and no buttons.
  - **DecreeBox** (no props):
    - The design's decree input: 380 x 48, a rubric "Decree" label, an underlined italic input
      "A plague, a meteor, a prophet...", and a solid ink "Proclaim" button.
    - It sends `{type:'control',action:'decree',text}`, clears the input, and flashes
      "Proclaimed." for 2 s.
    - It is disabled when not connected or when the text is blank.
    - It renders nothing without a world. No positioning: lane b places it.
  - **TokenMeter** (no props): the top bar's meter, "412 calls · 186.4k tokens · LIVE".
    - Tokens are `tokensIn + tokensOut`, shortened with k/M.
    - Mode badge: Mock is outlined, Live is gilt, Capped is red with a red border.
    - Mono numbers, sized for the dark 52 px top bar (styled for the dark surround, not
      parchment).
    - It renders nothing while `budget` is null.
- **HUMAN_TEST:** compare with `docs/design/network.png`; every switch still works; deleted
  rows show the ruin line; `DecreeBox` and `TokenMeter` render once lane b places them.
