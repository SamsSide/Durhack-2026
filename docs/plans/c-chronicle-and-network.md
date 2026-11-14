# Lane c plan — Chronicle and network panel

- **Rows:** C3, C4
- **Branch:** `c/chronicle-and-network`
- **Paths allowed:** `web/src/ui/` only (anything else: NEEDS_OTHER_LANE for `web/src/state/`,
  `App.tsx`; NEEDS_OWNER for `web/src/theme/`, `server/`, `packages/shared/`, new dependencies)
- **Contracts:** X1 (`ChronicleEntry`, `ChronicleKind`, `AgentStatus`, `flagSvg`), X2 (control
  messages, `belief`, `budget`), X5 (store), X7 (`tokens.css` variables). All work against
  `npm run mock` (the mock accepts every control; cut and delete change the `agents` list).
- **Done when:** on `main`, the chronicle ticker narrates the world live and opens into a
  timeline whose entries fly to their nation; the network panel cuts, restores, silences, wakes
  and deletes nations, blacks out the whole network, shows what a nation believes, meters the
  tokens and sends decrees.

Decisions from lane c (14 Nov): speed, pause and map modes stay in lane b's top bar (not
duplicated here); the chronicle is a slim ticker that expands into a drawer; the network panel
folds to a tab and starts open; Delete needs a second click within 3 s; C3 and C4 run in
parallel on Sonnet.

## Shared rules for both tasks

Same as `docs/plans/c-create-and-card.md` *Shared rules*: read the plan section 4 and the
contracts; the code on `main` wins over `contracts.md`; colours, fonts, spacing and radii only
from `var(--…)` in `web/src/theme/tokens.css` (never edit it; derive local variables with
`color-mix` when a role is missing); atlas look (parchment, serif, ink lines, small-caps
headings, 150 to 250 ms fades only); one CSS file per folder; classes prefixed `tn-`; no new
dependencies; no emojis; no browser dialogs (`alert`, `confirm`, `prompt`).

- `web/src/App.tsx` (lane b) places the components and must not change:
  - `Chronicle` sits in a container fixed to the bottom with 12 px side gutters and auto height.
  - `NetworkPanel` sits in a container from `top: 56px` to `bottom: 170px` on the left.
  Each component sizes itself inside its container.
- Re-render on `useWorld(s => s.version)`; read `world`, `agents`, `budget`, `selectedCountryId`,
  `beliefOf`, and call `select`, `flyTo`, `send`, `showBelief` from the store
  (`web/src/state/world.ts`). Read belief ownership from `useBelief` in
  `web/src/state/belief.ts` (read only).
- `web/src/ui/index.ts` is shared: each task changes only its own export line; delete the seed
  placeholder (`web/src/ui/Chronicle.tsx` or `web/src/ui/NetworkPanel.tsx`) once the export
  points at the new folder.
- Smoke gate: `./check.sh`.

## Task 1: C3 Chronicle

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Task 2 (no shared files except one line each in `index.ts`)
- **Files:** `web/src/ui/chronicle/Chronicle.tsx`, `web/src/ui/chronicle/chronicle.css`
  (create); `web/src/ui/index.ts` (the `Chronicle` export line only)
- **Build:**
  - `Chronicle`, no props. Renders nothing without a world.
  - **Ticker (collapsed, the default):** one slim parchment strip about 40 px tall, full width
    of its container. Left: a small-caps *Chronicle* label. Middle: the newest entry: year
    (`Y{year}`, monospace, muted), a short kind label (`war`, `peace`, `silence`…) as an
    ink-outlined tag, then the text, one line with ellipsis. Each nation named in
    `entry.countries` adds a small colour dot in that nation's `color` before the text.
    - A new entry slides up and fades in (keyed on `id`, 200 ms).
    - Pacing: if entries arrive faster than one per 2.5 s, hold each shown entry at least
      2.5 s, then jump to the newest. Skip the backlog, show a muted "+N" with the skipped
      count.
    - Kinds `silence`, `return` and `dispute` (the resilience story) and `war` and `fall` get an
      accent or danger-tinted tag and a brief glow, so the demo's key moments stand out.
    - Right: a *History* button. Clicking the strip's text calls `select` and `flyTo` for the
      entry's first country.
  - **Drawer (expanded):** the *History* button (or pressing `h` when focus is not in an
    input) opens a drawer that grows upwards from the strip, height `min(45vh, 420px)`,
    200 ms. A *Close* button and Escape close it.
    - Header: filter chips. *All*; *War* (`war`, `battle`, `betrayal`, `fall`); *Diplomacy*
      (`peace`, `alliance`); *Network* (`silence`, `return`, `dispute`); *Deeds*
      (`founding`, `proclamation`, `growth`, `decree`). The chips are single-select.
    - Body: a scrollable timeline, newest first, grouped under year headings ("Year 412"),
      rendering at most the newest 400 matching entries. Each entry is a button: the colour
      dots, the kind tag, the text, and the nation names (from `countries`, in their colours).
      Clicking it calls `select(countries[0])` then `flyTo(countries[0])`; entries with no
      countries are not clickable.
    - When the user has scrolled down, new entries do not jump the view. A small
      "N new" pill at the top scrolls back up.
    - Entries involving the selected nation get a thin accent rule on the left.
  - Empty chronicle: the ticker reads "Nothing has been written yet."
- **Contract:** X1 `ChronicleEntry`, `ChronicleKind`; X5 store. **Mock:** `npm run mock`
  produces chronicle entries.
- **Smoke proof:** `./check.sh` passes.
- **HUMAN_TEST:** `npm run mock` + `npm run dev`, create a world.
  1. The ticker shows new entries as they happen, at most one every 2.5 s, with "+N" when it
     skips.
  2. War and silence entries stand out.
  3. *History* (or `h`) opens the drawer; the filter chips filter; clicking an entry selects
     its nation and the camera flies there; Escape closes.
  4. Scroll down in the drawer while the world runs: the view stays put and the "N new" pill
     appears.
  5. At 375 px wide the strip fits with no horizontal scroll.

## Task 2: C4 Network panel

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Task 1
- **Files:** `web/src/ui/network/NetworkPanel.tsx`, `web/src/ui/network/NationRow.tsx`,
  `web/src/ui/network/network.css` (create); `web/src/ui/index.ts` (the `NetworkPanel` export
  line only)
- **Build:**
  - `NetworkPanel`, no props. Renders nothing without a world. Parchment panel, 300 px wide,
    filling its container's height, with the nation list scrolling inside.
  - **Fold:** a header with the small-caps title *The Network* and a fold button. Folded, it
    is a narrow vertical tab (about 36 px wide) reading "Network" sideways, plus a danger dot
    if any link is cut or nation deleted. It starts open; the fold state is kept in
    `localStorage` (wrapped in try/catch).
  - **Token meter** (top), from `budget`:
    - Total tokens (`tokensIn + tokensOut`, with thousands separators) as the big figure.
    - Under it: calls, calls per minute, and a mode tag (`mock` or `live`).
    - When `capped`: a danger banner "Budget reached: every ruler is on autopilot".
    - Hidden while `budget` is null.
  - **Whole network:** a *Blackout* toggle.
    - It sends `{type:'control',action:'blackout',value:true}` when any live (not deleted)
      agent's link is up, otherwise `value:false`.
    - The label reads *Blackout* or *Restore all* to match, and a danger style shows while
      blacked out.
  - **What it believes:** a toggle for the selected nation: `showBelief(selectedCountryId)`
    on, `showBelief(null)` off.
    - It is disabled with the hint "Select a nation" when nothing is selected.
    - While on, it shows "Seen by <name>" and the drift: the number of provinces where
      `useBelief().owner[i] !== world.owner[i]` ("12 provinces out of date"), or "Waiting for
      its view…" until the belief arrives.
  - **Nations** (`NationRow` per country in `world.countries`, agents matched by `countryId`;
    nations with no agent are shown without switches):
    - **Line 1:** a 24 x 16 flag (`flagSvg`), the name in the nation's colour on hover, the
      selected nation highlighted. Clicking the name calls `select(id)` and `flyTo(id)`.
    - **Line 2, status in plain words:**
      - "Linked" or "Cut off" (with "silent N years" from `world.tick - lastHeardTick` when
        cut, and "N events queued" when `pendingEvents > 0`).
      - "AI ruler" or "Autopilot".
      - "Deleted" or "Fallen" (`alive` false) replacing the rest.
    - **Switches:**
      - *Cut* / *Restore*, sending `cut` / `restore`.
      - *Silence* / *Wake*, sending `silence` / `wake`.
      - *Delete*: the first click turns it into *Confirm delete* (danger) for 3 s; a second
        click within 3 s sends `delete`; otherwise it reverts.
      - Deleted or fallen nations show no switches and are dimmed.
    - **Visual state:**
      - A cut nation's row gets a dashed ink border.
      - An autopilot nation gets a muted "autopilot" tag.
      - The row eases between states over 200 ms.
  - **Decree box** (bottom):
    - A text input with a rotating placeholder ("A plague sweeps the southern coast", "A
      meteor falls on the northern ice", "A prophet rises in the desert"), up to 140
      characters, and a *Decree* button.
    - Enter or the button sends `{type:'control',action:'decree',text}`, clears the input
      and shows "Decreed." for 2 s.
    - It is disabled while `connected` is false.
  - Messages go through `send()` exactly as in X2; no optimistic state, the UI follows the
    `agents` list the server sends back.
- **Contract:** X2 control messages and `belief`; X5 store; `useBelief`. **Mock:** the mock
  server accepts every control; cut and delete change `agents`.
- **Smoke proof:** `./check.sh` passes.
- **HUMAN_TEST:** `npm run mock` + `npm run dev`, create a world.
  1. The token meter shows numbers and the `mock` tag.
  2. *Cut* on a nation: the row turns "Cut off" with a dashed border; *Restore* returns it.
     *Silence* / *Wake* flip "AI ruler" / "Autopilot".
  3. *Delete*: the first click shows *Confirm delete*, which reverts after 3 s; a second click
     deletes and the row dims with no switches.
  4. *Blackout* cuts every nation, the label becomes *Restore all*, and that restores them.
  5. Select a nation, turn on *What it believes*: "Seen by …" and a drift count; off restores
     the true map.
  6. Type a decree and press Enter: "Decreed.", and in the mock it shows in the chronicle if
     the mock echoes decrees.
  7. Fold the panel: a narrow tab remains; reloading the page keeps it folded.
