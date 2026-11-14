# Terra Nova: interface design (X7)

**Figma:** [Terra Nova — interface](https://www.figma.com/design/7cKEqNpTmvmNd9CUSlxrA6)
(page "Screens", six 1440 x 900 frames; variable collection "tokens", mode "dark", 77 variables
named exactly like `web/src/theme/tokens.css` without the `--`).

**Tokens:** [`web/src/theme/tokens.css`](../../web/src/theme/tokens.css). Every colour, font, size
and effect below is a variable there. Components never hard-code a colour.

**Reference build:** [`reference.html`](reference.html) is every screen in plain HTML and CSS
(open it in a browser). The Figma file was imported from it, so its CSS is the exact spec: copy
class rules from it. Regenerate with
`node docs/design/build-reference.mjs web/src/theme/tokens.css docs/design/reference.html preview`.

| Screen | File |
| --- | --- |
| The running world (everything together) | [overview.png](overview.png) |
| Create screen | [create.png](create.png) |
| Hologram nation card (idle, playing, docked, loading) | [card.png](card.png) |
| Chronicle ticker and timeline | [chronicle.png](chronicle.png) |
| Network panel, diplomacy mode, beliefs, blackout | [network.png](network.png) |
| Top bar and its states, decree input, buttons | [topbar.png](topbar.png) |

## Fonts

Three Google fonts, loaded by the `@import` at the top of `tokens.css` (no `index.html` change
needed; fallbacks keep it readable offline):

- **Cinzel** 600/700 (`--font-display`): titles, nation names, and every small uppercase label
  (buttons, tabs, field labels, stance and state chips), letter-spaced 0.08 to 0.14em.
- **EB Garamond** 400/500/600 and italic (`--font-serif`): all body text. Italic is the "muted"
  voice: subtitles, hints, empty states.
- **IBM Plex Mono** 400/600 (`--font-mono`): years, numbers, the token meter, counts.

## Style guide

1. **Two worlds.** The surround is night (`--color-bg`, a star field, the top bar on
   `--color-surface`). Everything you read is parchment (`--parchment-fill`) with ink
   (`--color-ink`). Parchment never sits on parchment without an ink border between.
2. **Palette.** Ink `#2a1f14` on parchment `#ecdfc0`; rubric red `#9c2f22` for section headings
   and years; gilt `#c9a24b` for "active" and the year in the top bar; cyan `#7fe6d8` only for the
   hologram, the selection outline and anything about the network or beliefs.
3. **Type scale.** 11 / 13 / 15 / 18 / 24 / 34 px (`--text-xs` to `--text-2xl`). Body 15, card
   name 21 Cinzel, panel title 20 Cinzel, Create title 34 Cinzel. Labels are 9 to 11 px Cinzel caps.
4. **Borders.** Panels: 1.5px ink plus the inner double rule (`--rule-double`) and `--shadow-1`.
   Controls: 1px ink, radius 2px (printed plates, not pills). Only chips are pills.
5. **Buttons.** Cinzel caps. On parchment: outlined ink; primary is solid ink with parchment
   text; danger is rubric red outline. On the dark bar: segmented controls, the active segment is
   filled parchment.
6. **The hologram.** The card is the same parchment page, lit: `.holo` in `tokens.css` gives
   `--holo-opacity` (0.94, the globe faintly shows through), `--holo-glow` (cyan rim and halo) and
   the `--holo-scanlines` overlay. A 2px cyan line runs along its bottom edge where the beam
   meets it. While narration or the anthem plays, swap to `--holo-warm` / `--holo-glow-warm` /
   `--holo-beam-warm` (class `.holo.speaking`): the beam warms while the nation speaks.
7. **The beam** (lane b) is a trapezoid from the card's bottom edge (card width) to a point at
   the capital, filled with `--holo-beam` (brightest at both ends, faint in the middle), with a
   narrower brighter core and a white-hot ellipse at the capital. Plain CSS can do it
   (`clip-path: polygon(...)` plus a linear gradient), or draw it in three.js.
8. **Map conventions.** Political: nation colours at about 88% over the ocean, ink borders, the
   selected nation outlined in cyan. Diplomacy: stance colours (`--stance-*`) relative to the
   selected nation, which turns gilt. Army strength: small parchment tags with a mono number and
   a left bar in the nation's colour. Capitals: parchment dot ringed in ink.
9. **Do:** use the variables; keep text on parchment; let italic carry secondary text; use the
   nation's own colour only as a small swatch, a flag or a map fill.
10. **Don't:** no emojis or icon fonts (the few icons are inline SVG: play, stop, pause,
    close, chevron, diamond); no sans-serif; no rounded "app" cards; no blur or backdrop-filter;
    no cyan on parchment except the hologram rim and the cut-link tint.

## Per-screen notes for lane c (and lane b)

Component names and props are fixed by X5. Class names are those in `reference.html`.

### CreateScreen (no props) — `create.png`
Centered parchment panel 640 px wide over the dimmed, still-forming globe; the wordmark sits top
left on the night. Order: rubric kicker "A new world", title "Found a World" (34 Cinzel), italic
subtitle; prompt box (19 px, parchment-light, 1.5px ink, about 3 lines); "Or start from" preset
chips (Post-apocalyptic, Bronze age, Floating archipelago, Ice world, Desert empires, Clockwork age,
Jungle city-states; clicking one fills the prompt and the era; the chosen one is solid ink); a two
column grid: Nations stepper (minus, value, plus, then 8 diamond pips for 3 to 10) and the Era
select; Sea level and Aggression sliders (ink track and fill, parchment knob, percent in rubric
mono, end words in italic: "Dry continents / Drowned", "Peaceful / Warlike"); footer: a mono note
of the LLM mode on the left, the primary "Create world" button on the right.
States: Create disabled (0.45 opacity) until the prompt has text; while founding the button reads
"Founding the world..."; an error is one italic rubric line above the footer.
Range change from the placeholder: nations are **3 to 10** (the plan's value; the seed allows
2 to 12).

### NationCard (`{ countryId, regionId? }`) — `card.png`
380 px wide, height follows content (about 550 px). Header: flag 66 x 44 with a 1px ink frame,
name (21 Cinzel, wraps to two lines), "Led by ..." italic, a close cross top right. Ideology as a
quote with a 2px rubric left rule on a darker parchment wash. Facts: a two-column grid of
Government, Provinces, Population, Treasury (Cinzel 9 px label over the value; numbers in mono).
Summary (always shown), then tabs **Culture | Politics | History | Relations** (active tab: ink
text, 2px rubric underline). Culture shows the culture tags as chips plus a short paragraph;
Relations lists every other nation: swatch, name, stance chip (`.stance-war` etc., neutral is
outlined). Footer: Narrate and Anthem as equal outlined buttons with a play triangle.
States: **playing** (the active button turns solid ink: stop square, "Stop" or "Stop anthem",
small equaliser bars; a 2px rubric progress line and a mono "Narration · 0:22 / 0:58" line under
it; the card switches to the warm glow); **loading** (`audio` state `loading`: the button reads
"Loading..."); **lore loading** (three faint bars and italic "Consulting the archives...");
**lore error** (italic "No lore is available yet."); **fallen nation** (add a rubric "Fallen in
Y..." line under the leader).
In the beam the root gets `.holo`; **docked** (narrow screens, lane b decides the breakpoint,
the design assumes below 1100 px) it is a normal `.panel`: no glow, no scan lines, docked to the
right edge under the top bar. Tab state and the speaking state are local to the component; the
component never draws the beam.

### Chronicle (no props) — `chronicle.png`
**Ticker** (default): a 40 px parchment strip along the bottom (16 px margins), a solid ink label
cell "Chronicle" on the left, then entries newest first, each a kind diamond (`--kind-<kind>`),
the year in rubric mono ("Y214") and the text, separated by small ink diamonds; it scrolls left
slowly; a "Timeline" button on the right expands it.
**Timeline** (expanded): a 1408 px panel rising from the bottom, about 400 px tall. Header: title
"The Chronicle", italic "of <world>, years A to B", a legend of kinds, "Collapse". Body: one
34 px swimlane per nation (swatch and name in a 200 px left column), a year axis with a tick every
10 years, kind diamonds at each entry's year, wars as faint red bands on both nations' lanes, the
Silence (any period a nation was cut) as a cyan band across all lanes, and a gilt "Now" line.
Hovering a diamond shows a small parchment tooltip with the year, kind and text. Under it, the
last three entries as a list. This is also the natural home of the timeline scrubber (row B9).
Kinds with colours: founding, proclamation, growth, war, battle, peace, alliance, betrayal, fall,
secession, silence, return, dispute, decree (`secession` is a design-side name: map it to
whichever `ChronicleKind` the shared types use for a breakaway).

### NetworkPanel (no props) — `network.png`
300 px parchment panel on the left under the top bar, scrolls if needed. Title "The Network" and
an italic one-liner. Two switch rows: **Blackout** (toggle turns rubric red when on; on, every row
shows Cut) and **Show beliefs** (toggle turns ink when on; its subtitle names the nation shown).
Then one row per nation: swatch and name; state chips **Link up** (green outline with a dot) or
**Cut** (solid red), **LLM ruler** (gilt) or **Autopilot** (slate); when cut a mono line
"7 events queued · silent 12 yrs"; buttons Cut/Restore, Silence/Wake, Delete (danger), all xs.
The selected nation's row has a gilt wash and a 3px gilt left bar; a cut row has a faint cyan
wash. **Deleted** rows: name struck through, a "Deleted" chip, italic "Its lands lie in ruin;
neighbours are carving them up.", no buttons.
While beliefs are shown, lane b puts a cyan banner at the top centre: "Beliefs · Showing what
<nation> believes · N years out of date" with "Show the truth" (see `.belief-banner`), and draws
stale believed borders dashed in cyan.

### Top bar (lane b, in `App.tsx`) — `topbar.png`
52 px, a dark gradient with a gilt hairline under it. Left: "Terra Nova" wordmark (gilt Cinzel
caps), a divider, world name (17 Cinzel) over its era (italic, ellipsis at 170 px), the year box
("Year" label, number in gilt mono), connection (a dot and a word: Live green, Reconnecting
amber, Offline red). Centre: map modes as one segmented control (Political, Terrain, Diplomacy,
Strength). Right: pause key and 1x/2x/4x/8x as one segmented control (paused: the pause key is
lit and no speed is), the token meter "412 calls · 186.4k tokens · LIVE" (mode badge: Mock
outlined, Live gilt, Capped red with a red border), and "New world" as a parchment button.
**Decree input** (bottom right, 380 x 48, just above the ticker): rubric "Decree" label, an
underlined italic input "A plague, a meteor, a prophet...", a solid ink "Proclaim" button.
**Diplomacy legend** (diplomacy mode only, bottom right above the decree): a small parchment box
with the five stance swatches, "Towards <selected nation>".

## What is a placeholder

The globe in the frames is a flat SVG painting standing in for lane b's 3D planet: it shows the
intended palette (ocean teal to navy, nation fills, ink borders, faint parchment graticule,
cyan atmosphere rim), not geometry. Flags are simplified versions of the shared `flagSvg` layouts.
All names and numbers come from the mock world in `packages/shared/src/mock.ts`.
