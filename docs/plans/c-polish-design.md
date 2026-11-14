# Lane c plan — The polished design (A12 second pass, PR #85)

- **Rows:** C1 to C4 at their final look (issue #88)
- **Branch:** `c/polish-design`
- **Paths allowed:** `web/src/ui/` only (never `tokens.css`, `docs/design/`, `App.tsx`)
- **Spec:** `docs/design/README.md` (its per-screen notes for lane c), the PNGs in `docs/design/` (`create.png`, `founding.png`, `card.png`, `chronicle.png`, `moments.png`, `network.png`, `overview.png`, `projector-720.png`), and the exact CSS in `docs/design/reference.html`. `tokens.css` now ships many component classes (`.founding`, `.c-gov`, `.c-silence`, `.herald`, `.t-item.new`, `.net-tab`, `.nrow`, `.state.del`, `.btn.restore` and more): use the global classes it defines rather than copying them, and read it first.
- **Decision (lane c, 14 Nov):** follow the design wherever it differs from earlier lane c choices. For example, the network panel now starts folded.

## Shared rules

As in `docs/plans/c-design-restyle.md`:
- keep all working behaviour (fetches, error handling, select and flyTo, the two-click delete, the mic, the picture, the news hook);
- variables and token classes only, no hard-coded colours;
- no emojis or new dependencies;
- `tn-` prefix for local classes;
- change only your own folder.

## Task 1: CreateScreen (`web/src/ui/create/`)
- Title 36 px, prompt 20 px, as in the README.
- On Create, swap the panel for `.founding`, with its five timed steps, while the world is being written (about 7 s live; mock is instant, so let each step show at least briefly). When the snapshot arrives `App.tsx` unmounts the screen.
- An error returns to the form with the error line.
- Keep the picture zone, the presets and the replays.

## Task 2: NationCard (`web/src/ui/card/`)
- **Root:** `.panel`, plus `.speaking` while audio plays. Drop lane c's local `tn-speaking` gilt rule in favour of the design's `.speaking`.
- **Layout:**
  - the government as a `.c-gov` kicker;
  - the facts as one row of three;
  - the summary clamped to three lines.
- **States:**
  - `.silenced` with the `.c-silence` strip when the nation's agent link is cut, or its ruler is on autopilot if the README says so;
  - `.short` when `window.innerHeight < 800`, updated on resize.
- Follow `card.png` and the README for every state (idle, speaking, silenced, short, loading, fallen, region).

## Task 3: Chronicle (`web/src/ui/chronicle/`)
- **Ticker:**
  - text at 16 px;
  - the newest entry gets `.t-item.new`.
- **Timeline:** the Silence band sits on the silent nation's own lane and is night-dark, not a band across all lanes.
- **Dispatches (owner ruling, ours):**
  - render `.herald` dispatches from `recentEvents` for war declared (a `relation_changed` to `war`), return (a `chronicle` entry of kind `return`) and fall (`country_fell`, or a `chronicle` of kind `fall`);
  - top centre (fixed position), one at a time, about 6 s each, queued, and skip duplicates;
  - follow `moments.png` and the README;
  - render it from `Chronicle`; no new export.

## Task 4: NetworkPanel (`web/src/ui/network/`)
- Folded `.net-tab` by default. The width is `--net-width`.
- Two-line rows (`.nr-top`, `.nr-line`).
- A cut row is `.nrow.is-cut`, night-dark, with a `.btn.restore`.
- Deleted shows a `.state.del` stamp.
- A solid red Blackout row.
- Follow `network.png` and the README.
