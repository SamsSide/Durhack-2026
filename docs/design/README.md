# Terra Nova: interface design (X7)

**Figma:** [Terra Nova — interface](https://www.figma.com/design/7cKEqNpTmvmNd9CUSlxrA6)
(page "Screens": ten frames numbered `01` to `10`, with the six first-pass frames, which still show the removed hologram, kept below them
as `v1 (superseded)`; variable collection "tokens", mode "dark", named exactly like
`web/src/theme/tokens.css` without the `--`. Opaque fills, strokes and text in the ten frames are
bound to those colour variables; translucent paints and gradients are not, Figma cannot bind them
without losing their opacity).

**Tokens:** [`web/src/theme/tokens.css`](../../web/src/theme/tokens.css). Every colour, font, size
and effect below is a variable there, and so are the keyframes for the demo's moments. Components
never hard-code a colour.

**Reference build:** [`reference.html`](reference.html) is every screen in plain HTML and CSS
(open it in a browser). The Figma file was imported from it, so its CSS is the exact spec: copy
class rules from it. Regenerate with
`node docs/design/build-reference.mjs web/src/theme/tokens.css docs/design/reference.html preview`,
then the PNGs with `node docs/design/export-png.mjs` (needs any Chrome; how the committed PNGs
were shrunk is in a comment at the top of that script).

| Screen | File |
| --- | --- |
| The running world, a nation selected | [overview.png](overview.png) |
| Create screen | [create.png](create.png) |
| Founding: the five seconds after Create | [founding.png](founding.png) |
| Nation card (docked right): idle, speaking, the Silence | [card.png](card.png) |
| Chronicle ticker and timeline | [chronicle.png](chronicle.png) |
| Network panel, diplomacy mode, beliefs, blackout, folded | [network.png](network.png) |
| Top bar and its states, compact bar, decree, buttons, card loading | [topbar.png](topbar.png) |
| Dispatches (war, restore, fall) and the restore on the map | [moments.png](moments.png) |
| Closing card: what the world cost | [closing.png](closing.png) |
| The projector, 1280 x 720, at the moment of the demo | [projector-720.png](projector-720.png) |

## What changed in the polish pass, and why

No variable and no class name was renamed or removed. Values changed, and classes were added.

1. **The globe is the hero again.** In the first pass the open network panel and a 550 px card
   covered most of the world. Now the network panel is folded to a 40 px tab by default
   (`.net-tab`) and opens when asked, and the card is docked to the right edge, so the whole
   planet is in view between them.
2. **Readable from across a room.** The type scale went up one step (`--text-xs` 12, `--text-sm`
   14, `--text-md` 16, `--text-lg` 19, `--text-2xl` 36); labels have a floor of 11 px
   (`--text-cap`) and only chips are 10 px. The first pass had 9 px labels.
3. **Contrast (WCAG AA).** `--color-ink-muted` was 4.8:1 on parchment and 3.8:1 on its aged edge;
   it is now 6.2:1 and 5:1. `--link-up` green was 3.9:1 as text, now 4.8:1. White on the trade and
   alliance chips was 3.6:1 and 4.2:1; `--stance-trade` and `--stance-alliance` are darker (4.8:1,
   5:1) and the hostile chip takes ink text. `--color-text-muted` on the night is 7:1. Every
   chronicle diamond has a thin ink edge, so the pale kinds (silence, founding) show on parchment.
4. **The hologram is removed (owner decision, 14 Nov).** It did not look good enough. There is
   no beam, no scan lines, no flicker and no cyan or warm glow. The nation card is a plain
   parchment panel docked to the right edge, sliding in when a nation is selected. While the
   nation speaks, a 4 px gilt rule lights along its top edge and the progress line turns gilt.
   The `--holo-*` variables and the `.holo` class stay defined in `tokens.css`, marked
   deprecated, so nothing breaks; the design no longer uses them. `--holo-tint` lives on as the
   cyan for selection, beliefs and the Silence. The card itself is shorter and clearer than in
   the first pass: the government is a rubric kicker over the name, three numbers in one row,
   the summary without a heading.
5. **One idea for the cut: the lights go out.** A cut nation is a dark hole in the parchment
   everywhere it appears, in `--color-night-inset` with cyan text: its row in the network panel,
   a "Link cut" strip on its card in place of its motto, its lane on the timeline. Its border on
   the map becomes a dotted cyan ring.
6. **A quieter network panel.** Resting rows show one green word ("Link up") and one plain word
   for the ruler; boxes are kept for buttons and the red Cut chip. Rows are two lines instead of
   three, so six nations fit at 720 px. Delete is red text with no box.
7. **The moments the demo needs** were missing and now exist: the founding scroll, dispatches for
   war, restore and fall, the settled-dispute flash, the closing card. See "Demo moments".
8. **The top bar.** The year is the largest thing in it (20 px gilt). "New world" was the
   brightest control and the least useful mid-demo; it is now an outline. A `.compact` variant
   fits 1280 px.

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
   and years; gilt `#c9a24b` for "active", the year in the top bar and a card that is speaking; cyan
   `#7fe6d8` only for the selection outline and anything about the network, beliefs or the Silence.
3. **Type scale.** 12 / 14 / 16 / 19 / 24 / 36 px (`--text-xs` to `--text-2xl`), plus `--text-cap`
   11 for Cinzel caps labels and `--text-hero` 84 for the closing number. Body 16, card name 22
   Cinzel, panel title 20 Cinzel, Create title 36 Cinzel. Nothing is under 10 px, and only chips
   and xs buttons are 10.
4. **Borders.** Panels: 1.5px ink plus the inner double rule (`--rule-double`) and `--shadow-1`.
   Controls: 1px ink, radius 2px (printed plates, not pills). Only chips are pills.
5. **Buttons.** Cinzel caps. On parchment: outlined ink; primary is solid ink with parchment
   text; danger is rubric red outline. On the dark bar: segmented controls, the active segment is
   filled parchment.
6. **The nation card** is an ordinary `.panel` (1.5px ink, double rule, `--shadow-2`) docked to
   the right edge under the top bar: right 16, top 64, 380 wide. It slides in from the right when
   a nation is selected (keyframes `card-in`, 240 ms, `--ease-out`) and out when closed. Speaking:
   class `.speaking` on the panel (`.warm` in `reference.html`) adds a 4px gilt rule inside the
   top edge and a gilt progress line. That is the whole effect.
7. **No hologram.** The beam, glow, spill, scan lines and corner marks are gone. `--holo-*` and
   `.holo` are deprecated but still defined; `reference.html` keeps the old `.holo-look`, `.beam`,
   `.hb` and `.scan` rules for the same reason and uses none of them.
8. **Map conventions.** Political: nation colours at about 88% over the ocean, ink borders, the
   selected nation outlined in cyan. Diplomacy: stance colours (`--stance-*`) relative to the
   selected nation, which turns gilt. Army strength: small parchment tags with a mono number and
   a left bar in the nation's colour. Capitals: parchment dot ringed in ink. Nation and region names are **billboarded**:
   letter-spaced Cinzel capitals, ink at 80%, always turned to face the camera, upright and
   horizontal on screen at any globe angle (never wrapped onto the surface or rotated with it). A cut nation: dotted cyan ring, land dimmed. A
   deleted nation: ruin grey, dotted edge, name struck through.
9. **Do:** use the variables; keep text on parchment; let italic carry secondary text; use the
   nation's own colour only as a small swatch, a flag or a map fill.
10. **Don't:** no emojis or icon fonts (the few icons are inline SVG: play, stop, pause,
    close, chevron, diamond); no sans-serif; no rounded "app" cards; no blur or backdrop-filter;
    no cyan on parchment; cyan text sits on `--color-night-inset`, never on
    parchment (on parchment use `--silence-ink`).

## Demo moments

In the order of the demo script (`docs/hackathon-plan.md` section 2). Keyframes are in
`tokens.css`; every moment is one restrained change, not decoration.

| Step | Moment | What happens on screen | Classes and keyframes | Who |
| --- | --- | --- | --- | --- |
| 1 | Founding | The Create panel is replaced by a small scroll under the forming globe: "The scribes are writing your world", the prompt echoed, five steps that tick (two at once, then one about every 1.2 s, the last waits for the snapshot). The veil lifts and the borders are drawn dashed. | `.founding`, `.fo-step.done / .doing`, `.fo-pen` with `scribe` | c (CreateScreen), b (globe) |
| 2 | A new chronicle entry | The newest ticker entry arrives on a gilt wash that fades over 2 s. | `.t-item.new`, `ticker-new` | c |
| 3 | Select a nation | Its border lights cyan and its card slides in from the right edge (240 ms). While it narrates or sings, a 4 px gilt rule lights along the card's top edge and the progress line turns gilt. No beam, no glow. | `.panel`, `.panel.speaking` (`.docked.warm` in the reference), `card-in` | b (placement), c (card) |
| 4 | War declared | A dispatch drops in top centre under the top bar for about 6 s: red band, both flags, one headline, the aggressor's line. | `.herald.war`, `herald-in`, `herald-out` | c (or b) |
| 5a | Cut | The row goes dark with a cyan counter ("silent 12 yrs · 7 events queued") and a cyan Restore button; the dot pulses. On the map: a dotted cyan ring, the land dimmed. On its card: the "Link cut" strip in place of the motto. | `.nrow.is-cut`, `.btn.restore`, `cut-pulse`, `.card.silenced`, `.c-silence` | c (row, card), b (map) |
| 5b | Delete | Dispatch with an ink band; the row is struck through with a rubric "Deleted Y209" stamp; the land turns ruin grey with a dotted edge until the neighbours take it. | `.herald.fall`, `.nrow.deleted`, `.state.del` | c, b |
| 5c | Restore | Dispatch with a night band and three numbers: years silent, events merged, disputes settled. On the map each disputed province flashes gilt for about 1.5 s and takes its true colour, with a small tag naming who it went to. The row turns back to parchment. | `.herald.return`, `.h-stats`, `settle-flash`, `.map-tag` | c, b |
| 5d | Blackout | The Blackout switch row turns solid red ("Every link is cut") and every row goes dark. | `.switch-row.blackout.on` | c |
| 6 | Closing | Click the token meter (or press End): the world pauses and one card shows the token count at 84 px, counting up over 1.2 s, with four facts under it. | `.closing`, `.cl-num`, `--text-hero` | b |

## Per-screen notes for lane c (and lane b)

Component names and props are fixed by X5. Class names are those in `reference.html`.

### Layout (lane b) — `overview.png`, `projector-720.png`
- Margins 16 px; everything under the top bar starts at y 64.
- **Network:** top left. Folded by default to `.net-tab` (40 px: "The Network", "4 up", a red
  "1 cut" chip when any link is cut, a chevron). Open it is 320 px wide (`--net-width`).
- **Card:** docked right (right 16, top 64, 380 wide), slides in on selection. The globe keeps
  the space between the network tab or panel and the card; fly the camera so the selected
  nation is centred in that space, not under the card.
- **Dispatch:** top centre of the free space, 320 px (`--herald-width`), one at a time. It
  covers the top of the globe for its six seconds; that is accepted, every other spot is taken
  when the network panel and the card are both open.
- **Decree:** bottom right, 8 px above the ticker. **Ticker:** bottom, full width.
- **Belief banner:** top centre at y 64; a dispatch that arrives while it shows sits under it.
- **At 1280 x 720** (the projector): top bar gets `.compact`; the card gets `.short`; everything
  above still fits with the network panel open (see `projector-720.png`).

### CreateScreen (no props) — `create.png`, `founding.png`
Centered parchment panel 640 px wide over the dimmed, still-forming globe; the wordmark sits top
left on the night. Order: rubric kicker "A new world", title "Found a World" (36 Cinzel), italic
subtitle; prompt box (20 px, parchment-light, 1.5px ink, about 3 lines); "Or start from" preset
chips (Post-apocalyptic, Bronze age, Floating archipelago, Ice world, Desert empires, Clockwork age,
Jungle city-states; clicking one fills the prompt and the era; the chosen one is solid ink); a two
column grid: Nations stepper (minus, value, plus, then 8 diamond pips for 3 to 10) and the Era
select; Sea level and Aggression sliders (ink track and fill, parchment knob, percent in rubric
mono, end words in italic: "Dry continents / Drowned", "Peaceful / Warlike"); footer: a mono note
of the LLM mode on the left, the primary "Create world" button on the right.
States: Create disabled (0.45 opacity) until the prompt has text; an error is one italic rubric
line above the footer. Nations are **3 to 10**.
**Founding** (new, replaces "the button reads Founding the world..."): on Create the panel is
replaced by `.founding`, a 580 px scroll in the lower third so the forming globe is in view
above it. Kicker "Founding", title "The scribes are writing your world" (22 Cinzel), the prompt
echoed in italic quotes, then five steps: "Raising the continents", "Drawing six borders",
"Naming the nations and their rulers", "Writing their founding myths", "Raising six flags" (use
the chosen number). `.fo-step.done` has a tick, `.doing` a solid rubric diamond, bold text and
the shimmering `.fo-pen` line, the rest an outlined diamond in muted ink. The steps run on a
timer, not real progress. In mock mode it may be on screen for under a second; that is fine.

### NationCard (`{ countryId, regionId? }`) — `card.png`
380 px wide (`--card-width`), about 505 px tall. Header: flag 66 x 44 with a 1px ink frame; then
the government as a rubric kicker (`.c-gov`, 11 Cinzel caps), the name (22 Cinzel, wraps to two
lines), "Led by ..." italic 16; a close cross top right. Ideology as a quote with a 2px rubric
left rule on a darker parchment wash. Facts: **one row of three** numbers, Provinces, Population
(short form, "1.28M"), Treasury (10 px Cinzel label over a 16 px mono semibold value); Government
left this grid for the kicker. Summary with no heading, clamped to three lines (`.c-summary`).
Tabs **Culture | Politics | History | Relations** (active: ink text, 2px rubric underline).
Culture shows the tags as chips plus one sentence; Relations lists every other nation: swatch,
name, stance chip (`.stance-war` etc.; hostile takes ink text, neutral is outlined). Footer:
Narrate and Anthem as equal outlined buttons with a play triangle.
States:
- **speaking** (`.warm` here, `.panel.speaking` in tokens): the active button is solid ink with a
  stop square, "Stop" or "Stop anthem" and equaliser bars; a 3px gilt progress line and a mono
  "Narration · 0:22 / 0:58" line under it; a 4px gilt rule along the top edge.
- **silenced** (new; `.silenced`; the nation's `connected` is false): the ideology quote is
  replaced by `.c-silence`, a night strip with a cyan left rule: "Link cut" (cyan caps) and
  "silent 12 yrs" (cyan mono) on one line, then italic "It rules on from the world as it knew it
  in Y202. Its map no longer matches the truth." Narrate and Anthem still work.
- **short** (new; `.short`; viewport under 800 px tall): the summary and the strip's second
  sentence are hidden, about 455 px tall.
- **audio loading:** the button reads "Loading...". **lore loading:** three faint bars and italic
  "Consulting the archives..." where the summary and tabs would be. **lore error:** italic "No
  lore is available yet." **fallen nation:** a rubric "Fallen in Y..." line under the leader.
The card is always the docked panel (`.docked.panel-look` in the reference, `.panel` in the app):
no `.holo`, no beam. Tab state and the speaking state are local to the component.

### Chronicle (no props) — `chronicle.png`, `moments.png`
**Ticker** (default): a 40 px parchment strip along the bottom (16 px margins), a solid ink label
cell "Chronicle" on the left, then entries newest first, each a kind diamond (`--kind-<kind>`,
with a thin ink edge), the year in rubric mono ("Y214") and the text at 16 px, separated by small
ink diamonds; it scrolls left slowly; a "Timeline" button on the right expands it. The newest
entry has `.new`: a gilt wash that fades (keyframes `ticker-new`, about 2 s).
**Timeline** (expanded): a full-width panel rising from the bottom, about 400 px tall. Header:
title "The Chronicle", italic "of <world>, years A to B", a legend of kinds, "Collapse". Body: one
34 px swimlane per nation (swatch and name in a 200 px left column), a year axis with a tick every
10 years, kind diamonds (14 px) at each entry's year, wars as faint red bands on both nations'
lanes, and a gilt "Now" line. **The Silence is now a night-dark band on the silent nation's own
lane** with "Silence" in cyan caps (it used to be a pale cyan band across every lane, which did
not say who was silent). Hovering a diamond shows a small parchment tooltip with the year, kind
and text. Under it, the last three entries as a list. This is also the home of the timeline
scrubber (row B9).
**Dispatches** (new; `.herald`; suggested owner: this component, since it already watches
`recentEvents`): see "Demo moments" and `moments.png`. A band (28 px, Cinzel caps, the year in
mono on the right) over a centred body: flags, a Cinzel 18 headline, one italic line. `.war`: red
band, two flags with an italic "against" between. `.return`: night band with cyan text, one flag,
"<Nation> returns", then `.h-stats`, three mono numbers in `--silence-ink` with caps labels. `.fall`:
ink band, the flag greyed, "<Nation> are no more".
Kinds with colours: founding, proclamation, growth, war, battle, peace, alliance, betrayal, fall,
secession, silence, return, dispute, decree (`secession` is a design-side name: map it to
whichever `ChronicleKind` the shared types use for a breakaway).

### NetworkPanel (no props) — `network.png`
**Folded** (default): `.net-tab`, see Layout. **Open:** a 320 px parchment panel on the left
under the top bar; it scrolls if it must, but six nations fit at 720 px. Head: title "The
Network" and a fold button; one italic line, "Each nation thinks for itself. Cut one off and
watch." Two switch rows: **Blackout** (on: the whole row turns solid `--color-danger` with white
text, "Every link is cut") and **Show beliefs** (toggle turns ink when on; its subtitle names the
nation shown).
Then one row per nation, **two lines** (it was three): line one is swatch, name (16 semibold),
and on the right the link state, a green dot and "Link up" as plain text, or a solid red "Cut"
chip. Line two is the ruler as a plain word on the left ("LLM ruler" in dark gilt, "Autopilot" in
slate; no box) and the buttons on the right: Cut/Restore, Silence/Wake, Delete (xs; Delete is red
text with no border).
- **Selected** (`.sel`): gilt wash and a 3px gilt left bar.
- **Cut** (`.is-cut`): the row is filled with `--color-night-inset`, text in `--color-text`, a 3px
  cyan left bar, a cyan mono line "silent 12 yrs · 7 events queued" under the name, and Restore
  is a solid cyan button (`.btn.restore`). The dot in the Cut chip pulses (`cut-pulse`).
- **Deleted** (`.deleted`): name struck through, a rubric stamp "Deleted Y209" tilted 3 degrees
  (`.state.del`), italic "Its neighbours are carving up its lands.", no buttons.
While beliefs are shown, lane b puts a cyan banner at the top centre: "Beliefs · Showing what
<nation> believes · N years out of date" with "Show the truth" (see `.belief-banner`), and draws
stale believed borders dashed in cyan.

### Top bar (lane b, in `App.tsx`) — `topbar.png`
52 px, a dark gradient with a gilt hairline under it. Left: "Terra Nova" wordmark (gilt Cinzel
caps), a divider, world name (17 Cinzel) over its era (italic, ellipsis at 138 px), the year box
("Year" label, number in **20 px** gilt mono: the largest thing in the bar), connection (a dot and
a word: Live green, Reconnecting amber, Offline red). Centre: map modes as one segmented control
(Political, Terrain, Diplomacy, Strength; 11 px caps, 28 px tall). Right: pause key and
1x/2x/4x/8x as one segmented control (paused: the pause key is lit and no speed is), the token
meter "412 calls · 186.4k tokens LIVE" (mode badge: Mock outlined, Live gilt, Capped red with a
red border; clicking it opens the closing card), and "New world", now an outlined button.
`.btn.primary-dark` keeps its name but is no longer filled.
**Compact** (`.topbar.compact`, 1280 px and narrower): the era line, the call count and the word
"Live" are hidden. The worst case at 1440 (Reconnecting plus Capped) fits with nothing to spare,
so lay the bar out as three groups with a 12 px minimum gap and let the era truncate first.
**Decree input** (bottom right, 380 x 48, just above the ticker): rubric "Decree" label, an
underlined italic input "A plague, a meteor, a prophet...", a solid ink "Proclaim" button.
**Diplomacy legend** (diplomacy mode only, bottom right above the decree): a small parchment box
with the five stance swatches, "Towards <selected nation>".
**Closing card** (`closing.png`; `.closing`): 760 px parchment panel centred over the dimmed,
paused globe. Rubric kicker "<World> · years A to B", "This whole world cost" (26 Cinzel), the
token count in 84 px mono with "tokens" in rubric caps beside it, a ruled row of four facts
(nations, years, ruler decisions = calls, wars and silences), then an italic line about replay
and "Back to the world".

## What is a placeholder

The globe in the frames is a flat SVG painting standing in for lane b's 3D planet: it shows the
intended palette (ocean teal to navy, nation fills, ink borders, painted names, faint parchment
graticule, cyan atmosphere rim), not geometry. Its labels are drawn the way billboarded labels
look: upright and horizontal. Flags are simplified versions of the shared `flagSvg` layouts.
All names and numbers come from the mock world in `packages/shared/src/mock.ts`.
