# UI depth: how strategy games give panels material, and CSS recipes for Terra Nova

Researched 14 Nov 2026 for the owner's note that the UI looks too flat. Scope: the overlay UI
(React and CSS over the three.js globe). Style to keep: "an old atlas (parchment, ink, serif)
seen at night", the tokens in `web/src/theme/tokens.css`.

Original designs only. This file describes techniques. It copies no game's art, ornament or
layout.

## Method and sources

- **Screenshots:** the official Steam store screenshots for each game, pulled from the Steam
  store API (`store.steampowered.com/api/appdetails?appids=<id>&filters=screenshots`), 1920x1080,
  and cropped to the panels. App ids: Old World 597180, Crusader Kings III 1158310, Victoria 3
  529340, Europa Universalis IV 236850, Europa Universalis V 3450310, Hearts of Iron IV 394360,
  Civilization VI 289070, Civilization VII 1295660, Humankind 1124300, Anno 1800 916440,
  Total War: Three Kingdoms 779340, Age of History 3 2772750.
- **Developer statements:**
  - Victoria 3 Dev Diary #30, "User Interface Overview" (2D Art Lead Kenneth, 2022):
    <https://forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-30-user-interface-overview.1507166/>.
    The forum blocked direct fetching. The quotes below come from search-result excerpts of
    that page, so treat the exact wording as unconfirmed.
  - Victoria 3 Dev Diary #49, "Graphic Overview" (Art Director Max, 8 June 2022):
    <https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-49-graphic-overview>
  - Anno 1800 DevBlog "User Interface" (UI designer Khajag Jabaghchourian, 7 June 2018):
    <https://www.anno-union.com/?p=9862>
  - CK3 Dev Diary #28 "Art Focus" (Art Director Pontus):
    <https://forum.paradoxplaza.com/forum/threads/ckiii-dev-diary-28-art-focus.1393627/>
    (read through search excerpts only).
  - Civilization VII builds its UI in HTML, JS and CSS on Coherent Gameface:
    <https://coherent-labs.com/blog/casestudies/firaxis-case-study/>. So everything below is the
    same kind of technology a shipped AAA strategy UI uses.

## 1. References and what each does

### What the developers say

- **Victoria 3:** "we focus the rich details on frames and borders of the panels as well as
  headers". Detail is "used sparingly so it does not become cluttered" (DD #30). The UI should
  be "elegant and ornate but not too heavy". Its palette is chosen so that icons and buttons
  stand out against the map. The map is kept calmer so it "does not clash" with the UI
  (DD #49).
- **Anno 1800:** the always-visible HUD uses "darker tones" because "bright and flashy color
  schemes could quickly become tiring for the eyes". Pop-ups use a brighter accent to "draw the
  immediate attention of the player". The team warns that otherwise "the UI itself would start
  competing with the actual game for the player's attention" (DevBlog, 2018).
- **CK3:** puts large illustrations and portraits up front for immersion. The UI is made "in
  close collaboration with UX and Game Design".

The pattern they share: **ornament on the edges, calm in the middle; a dark always-on HUD; one
bright accent for what needs action.**

### What the screenshots show

| Game | Frame / border | Surface | Headers, tabs, buttons | Icons, portraits, chips | Separation from the world |
| --- | --- | --- | --- | --- | --- |
| **Victoria 3** | Dark slate-green panel. A gilt line runs along the header edge and ends in a scroll flourish at the close button. | Faint damask and fish-scale pattern in the header and footer strips. Content wells are darker and recessed. | Header is a **claret lacquer plate with an arched top edge**. Tabs are bevelled recessed slots; the active one is lighter and raised. Back and close are **round bronze medallion buttons with a metal ring**. A vertical rail of medallion buttons runs down the left. | Illustrations sit in thin gilt frames. Progress bars are segmented and sit in a sunken trough. The clock is a brass dial with gears. Flags are framed plates. | Panels are opaque, with a hard dark edge against the map. The map itself is kept desaturated. |
| **Old World** | Dark umber panel. A hairline gilt rim sits inside a darker outer edge. Corner brackets on portraits. | Plain dark, slightly warm. | **The title sits on a red lacquer plate with a gilt rim that overlaps the panel's top edge** (it breaks the frame). Choice buttons are full-width dark plates. | Tech cards have **arched tops, a red outer frame and a gilt inner frame**, art on cream paper with a vignette, and the name engraved in caps on a stone plate. Portraits have a thin light frame and a drop shadow. | Event windows are opaque and the world shows dimmed around them. |
| **Europa Universalis IV** | Slate blue-grey metal frame with **double gilt rim lines**. | Event windows set a **parchment inset with a darkened, aged inner edge** inside the metal frame. The illustration is sepia ink printed on that paper. | The title is light serif on a dark band. Option buttons are long dark plates with a light rim. | Shields for flags. Round bezels for the advisor portraits. | Hard frame, short dark drop shadow. |
| **Europa Universalis V** | Dark navy panels with a faint ornamental pattern. | Outliner rows sit on aged-paper-coloured strips. | **Category headers are colour-coded gradient plates** (ochre, lavender) with a bevel and a round chevron toggle. Top-bar actions are **hanging pennant shapes** with pointed bottoms. Icon cells are split by vertical dividers. | The ruler portrait sits in a gilt frame and the flag in a shield shape. | Full-width dark top bar with a light rule under it. |
| **Crusader Kings III** | Dark slate panels with thin gilt lines. | The character window leads with a large illustrated header (portraits in a painted room). | Low-contrast dark plates; tabs are underlined text. | Coats of arms are shield-shaped with a bevel and highlight. | Opaque panels docked to the screen edges. |
| **Hearts of Iron IV** | Dark grey metal plates with a bevel. | Flat metal, little texture. | Small-caps labels with wide tracking on dark bevelled plates ("SELECT COUNTRY"). | Square icon tiles. | Hard edges, minimal shadow. |
| **Civilization VI** | Navy panels with brass trim. | Flat navy with light rules. | Full-width navy plates as list buttons. | **Brass roundel bezels**: the research and civics dials are glass discs in a brass ring, and the minimap sits in a brass frame. City banners are navy plates with gold type. | Opaque panels with a soft shadow. |
| **Civilization VII** | Very dark navy. **Gilt hairline rules end in curled scroll terminators** on both sides of each title. A **crest medallion sits on the top edge** and breaks the frame. | Dark, with subtle vertical gradients tinted per category (purple, amber, red, blue). | Tabs are grouped inside a **gilt bracket** (a vertical stroke at each end). The active tab is underlined. Gilt Cinzel-like spaced caps. | Cards have corner flourishes, and **roundel icons sit on the card's top edge**. | Full-screen dark backdrop for big screens. |
| **Humankind** | Thin hairline frames, partly translucent navy. | **Heavy frosted blur** of the 3D scene behind the full-screen views. | Large **round buttons with ring bezels**. The end-turn button has a segmented progress ring. | A **hanging vertical banner** (ribbon with a notched bottom) carries the empire emblem and fame score. | The blur is done in the game's own renderer. Copying it with CSS `backdrop-filter` over WebGL costs a lot (see Do and don't). |
| **Anno 1800** | Little or no frame. Cards are **paper sheets with soft drop shadows**, and the newspaper has a deckled edge. | **Parchment that fades into dark at the edges** (strong vignette) on the expedition screen. | Primary actions are **solid coloured plates** (claret, purple). Section labels sit on dark parchment strips. | Goods tiles on paper; a crown roundel. | The whole sheet floats over a dimmed scene. |
| **Total War: Three Kingdoms** | **Ink-wash brush-stroke edges**: paper dissolves into black brush marks. | Parchment map, washed with red ink. | Black lacquer plates with white spaced caps. | Unit cards are portrait cards in a row. | The ink edges do the separating. |
| **Age of History 3** | Thin lighter border on dark navy. No ornament. | Flat. | Flat dark rows. | Flags as plain rectangles. | Flat, small shadow. **This is the closest match to our current "flat" look.** It is clean but reads as a tool rather than a premium game. |

### Devices that recur (and fit Terra Nova)

1. **Frame then sheet.** A metal or lacquer frame holds a sheet of paper that sits recessed
   inside it (EU4 events, Old World cards, Anno). We already have the paper; we lack the frame.
2. **Gilt as an edge material, not a fill.** Hairline gilt rules, bevel bands, corner brackets
   and scroll terminators (Vic3, Civ VII, Old World). Big gilt areas only on buttons that want
   a click.
3. **Plates.** Titles and labels sit on a plate: lacquer, stone or coloured metal, bevelled,
   often breaking the frame edge (Old World, Vic3, EU5, HOI4).
4. **Medallions and roundels.** Close and back buttons, portraits, dials and key icons get a
   round metal bezel (Vic3, Civ VI, Humankind).
5. **Wells and troughs.** Progress bars, numbers, tab strips and lists sit sunk into the
   surface; clickable things are raised (Vic3, EU5).
6. **Category colour on headers only.** Colour-coded header plates or tints, with neutral
   content beneath (EU5, Civ VII).
7. **A dark, calm HUD and opaque panels.** No game here puts translucent blurred panels over
   the live map during normal play. Humankind blurs only on full-screen views, and does it in
   its own renderer.

## 2. Recipes (CSS, with our tokens)

Everything below is static paint: gradients, box-shadows, one tiled SVG noise image, and SVG
data-URI ornaments. No `backdrop-filter`, no `filter: blur`, no animated shadows. All of it
can go into `tokens.css` as new variables and classes, so a component opts in with a class.

### 2.0 New tokens

```css
:root {
  /* Gilt: a metal edge, lit from the top left. Only ever on dark grounds or as a thin band. */
  --gilt-hi: #f4e2a6;
  --gilt: #c9a24b;                 /* = --color-accent */
  --gilt-lo: #7a5a1e;
  --gilt-deep: #3a2b10;
  --gilt-metal: linear-gradient(135deg, #7a5a1e 0%, #e9cf86 22%, #b38a3a 45%, #f4e2a6 58%, #a07a2e 78%, #6b4e18 100%);
  --gilt-ring: conic-gradient(from 200deg, #7a5a1e, #f4e2a6, #b38a3a, #fff0c0, #8a6524, #e9cf86, #7a5a1e);

  /* Lacquer: the night enamel for the top bar, strips, plates and tooltips. */
  --lacquer: #121623;
  --lacquer-hi: #20263a;
  --lacquer-claret: #5a1f18;       /* rubric-family plate for section headers */
  --lacquer-sheen: linear-gradient(180deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,.28) 100%);

  /* Depth: three static layers (contact, short, ambient). */
  --lift-1: 0 1px 0 rgba(0,0,0,.55), 0 3px 6px -1px rgba(0,0,0,.45);
  --lift-2: 0 1px 0 rgba(0,0,0,.6), 0 6px 12px -2px rgba(0,0,0,.45), 0 22px 44px -10px rgba(0,0,0,.65);
  --bevel-paper: inset 0 1px 0 rgba(255,250,235,.75), inset 0 -1px 0 rgba(120,90,50,.30);
  --bevel-dark: inset 0 1px 0 rgba(255,255,255,.08), inset 0 -1px 0 rgba(0,0,0,.5);
  --well-paper: inset 0 1px 2px rgba(42,31,20,.28), inset 0 -1px 0 rgba(255,250,235,.55);
  --well-dark: inset 0 2px 4px rgba(0,0,0,.65), inset 0 0 0 1px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.06);

  /* Text */
  --engrave-on-paper: 0 1px 0 rgba(255,250,235,.65);      /* light below = cut into the paper */
  --engrave-on-dark: 0 -1px 0 rgba(0,0,0,.85), 0 1px 0 rgba(255,255,255,.06);
}
```

### 2.1 Paper grain: one static SVG noise tile

`feTurbulence` inside a data-URI background is rasterised once per tile and then tiled like
any image. It is cheap. (Applying `filter: url(#noise)` live to an element is not; never do
that.) Remember that `#` must be written `%23` inside a data URI.

```css
:root {
  /* Fine fibre grain, warm brown, very low alpha. 220px tile. */
  --paper-grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .17  0 0 0 0 .12  0 0 0 0 .07  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23g)' opacity='.22'/></svg>");
  /* Large soft mottling (foxing and uneven ink take-up). 400px tile. */
  --paper-mottle: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.012' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .32  0 0 0 0 .16  0 0 0 1.2 -.35'/></filter><rect width='100%' height='100%' filter='url(%23m)' opacity='.25'/></svg>");
  /* Leather or lacquer grain for the dark surfaces: the same noise, lighter and sparser. */
  --lacquer-grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='l'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 .95  0 0 0 0 .85  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23l)' opacity='.06'/></svg>");
}
```

Note: on a projector the fine grain is mostly invisible. That is fine: it removes the
"CSS-flat" look on a laptop screen and costs nothing. The vignette (2.2) and the frame (2.3)
are what show on the projector.

### 2.2 The parchment sheet (surface, vignette, recess)

```css
.panel {
  position: relative;              /* for the ::before and ::after frame layers */
  isolation: isolate;
  color: var(--color-ink);
  background:
    /* vignette: warm darkening toward the edges, capped so muted ink still passes 4.5:1 */
    radial-gradient(ellipse 120% 90% at 50% 38%, rgba(0,0,0,0) 58%, rgba(110,78,36,.20) 100%),
    var(--paper-mottle),
    var(--paper-grain),
    linear-gradient(180deg, #f3e8cd 0%, var(--color-parchment) 45%, #e4d4ac 100%);
}
```

The paper sits *in* a frame, so add a soft inner shadow at its edge (see 2.3, which puts it
in the same `box-shadow` list).

### 2.3 The frame: dark line, gilt bevel band, inner ink rule, gilt corner brackets

There are three layers. Together they cost one `box-shadow` list and two pseudo-elements.

**Layer A: the gilt band, with the paper inside it.** Use the "two backgrounds" border trick:
paper on `padding-box`, gilt metal on `border-box`, and a transparent 3px border so the gilt
shows only in the border ring.

```css
.panel.framed {
  border: 3px solid transparent;
  border-radius: var(--radius-2);
  background:
    radial-gradient(ellipse 120% 90% at 50% 38%, rgba(0,0,0,0) 58%, rgba(110,78,36,.20) 100%) padding-box,
    var(--paper-mottle) padding-box,
    var(--paper-grain) padding-box,
    linear-gradient(180deg, #f3e8cd 0%, var(--color-parchment) 45%, #e4d4ac 100%) padding-box,
    var(--gilt-metal) border-box;
  box-shadow:
    0 0 0 1px #140e08,                     /* hard dark outer line: separates from the globe */
    inset 0 0 0 1px rgba(58,43,16,.85),    /* dark line where the paper meets the gilt */
    inset 0 0 16px rgba(80,52,18,.28),     /* the paper is recessed inside the frame */
    var(--lift-2);                         /* lifted off the world */
}
```

**Layer B: the inner ink rule** (our existing atlas double rule), drawn on `::before` so it
does not paint over the grain:

```css
.panel.framed::before {
  content: "";
  position: absolute;
  inset: 5px;
  border: 1px solid rgba(42,31,20,.5);
  border-radius: 1px;
  pointer-events: none;
  z-index: -1;                      /* above the background, under the content */
}
```

**Layer C: corner brackets with `border-image`**, a 9-slice of one 48x48 SVG. The heavy gilt
L-brackets and a small diamond sit in the 16px corner slices. A thin gilt rule runs along the
stretched edge slices. Pure stroke paths keep it an original design, and it scales cleanly.

```css
:root {
  --frame-corners: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='%23c9a24b' stroke-linecap='square'><path stroke-width='2' d='M2 14V2H14M34 2H46V14M46 34V46H34M14 46H2V34'/><path stroke-width='1' stroke-opacity='.7' d='M5.5 16V5.5H16M32 5.5H42.5V16M42.5 32V42.5H32M16 42.5H5.5V32M16 5.5H32M42.5 16V32M32 42.5H16M5.5 32V16'/></g><g fill='%23c9a24b'><path d='M10 7.5L12.5 10L10 12.5L7.5 10Z'/><path d='M38 7.5L40.5 10L38 12.5L35.5 10Z'/><path d='M38 35.5L40.5 38L38 40.5L35.5 38Z'/><path d='M10 35.5L12.5 38L10 40.5L7.5 38Z'/></g></svg>");
}
.panel.framed::after {
  content: "";
  position: absolute;
  inset: -3px;                      /* sits over the gilt band, so the brackets ride on it */
  border-style: solid;
  border-width: 16px;
  border-image-source: var(--frame-corners);
  border-image-slice: 16;
  border-image-repeat: stretch;
  pointer-events: none;
}
```

Use the full frame (A+B+C) on the **nation card** and the **Create World screen**. Use A+B
only on small floating plates (the Network strip, the Decree box, the minimap). Corner
brackets on a 40px-tall strip look busy.

### 2.4 A title plate that breaks the frame (cartouche)

An Old World-style device in our own form. A small lacquer plate sits on the top edge of the
nation card and carries the government type ("THEOCRACY"). The nation name stays large, in
ink, on the paper below it.

```css
.cartouche {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 14px;
  font: 600 var(--text-cap)/1.4 var(--font-display);
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--gilt-hi);
  text-shadow: var(--engrave-on-dark);
  background: var(--lacquer-sheen), var(--lacquer-claret);
  border: 1px solid var(--gilt);
  border-radius: 2px;
  box-shadow: 0 0 0 1px #140e08, inset 0 1px 0 rgba(255,220,170,.25), var(--lift-1);
  /* clipped ends make it a plate, not a pill */
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%);
}
```

Note: `clip-path` clips the box-shadow too, so the hard outline comes from the border. If the
plate needs its drop shadow, drop the `clip-path` and keep the 2px radius.

### 2.5 Section header bars (lacquer strip inside a parchment panel)

For DIPLOMACY, THE COUNCIL and similar, in place of the plain red caps with a hairline:

```css
.panel h3.plate {
  margin: var(--space-4) calc(-1 * var(--space-5) + 6px) var(--space-2);
  padding: 4px var(--space-5);
  font: 700 var(--text-sm)/1.3 var(--font-display);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: #f6e7c4;
  text-shadow: var(--engrave-on-dark);
  background:
    var(--lacquer-sheen),
    linear-gradient(90deg, rgba(90,31,24,0) 0%, var(--lacquer-claret) 12%, var(--lacquer-claret) 88%, rgba(90,31,24,0) 100%);
  box-shadow: inset 0 1px 0 rgba(201,162,75,.55), inset 0 -1px 0 rgba(201,162,75,.35);
}
```

A lighter alternative that stays "ink on paper": rubric caps with a **flourish rule** (2.10)
below them. Pick one per panel type. Plates suit dense data panels; flourish rules suit the
narrative text.

### 2.6 The top bar: a lacquer strip with a gilt moulding

Stacked 1px shadows below the bar read as a moulded metal edge: dark, gilt, dark.

```css
.topbar {
  background: var(--lacquer-sheen), var(--lacquer-grain), linear-gradient(180deg, #171b2a, #0d1019);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),
    0 1px 0 #6e5524,          /* shadow side of the moulding */
    0 2px 0 var(--gilt),      /* lit gilt */
    0 3px 0 var(--gilt-deep),
    0 10px 20px rgba(0,0,0,.55);
}
/* Group dividers inside the bar: an engraved double line, not a border box. */
.topbar .sep { width: 2px; align-self: stretch; margin: 8px 6px;
  background: linear-gradient(90deg, rgba(0,0,0,.7) 50%, rgba(255,255,255,.07) 50%); }
```

The Chronicle bar at the bottom mirrors this, with the moulding on top (`0 -1px`, `0 -2px`,
`0 -3px`).

### 2.7 Segmented control (the map modes): a recessed well with a raised active plate

```css
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 3px;
  background: #07090f; box-shadow: var(--well-dark); }
.seg > button { background: transparent; border: 0; color: var(--color-text-muted);
  font: 600 var(--text-xs)/26px var(--font-display); letter-spacing: var(--tracking-caps);
  padding: 0 10px; border-radius: 2px; text-shadow: var(--engrave-on-dark); }
.seg > button:hover { color: var(--color-text); background: rgba(255,255,255,.04); }
.seg > button.active {
  color: var(--color-ink); text-shadow: var(--engrave-on-paper);
  background: linear-gradient(180deg, var(--color-parchment-light), #e2d0a4);
  box-shadow: var(--bevel-paper), 0 0 0 1px rgba(201,162,75,.8), 0 1px 3px rgba(0,0,0,.7);
}
```

### 2.8 Buttons: raised plates with a pressed state

**On parchment** (CUT, KILL, TIMELINE): an embossed paper plate.

```css
.panel .btn {
  color: var(--color-ink);
  background: linear-gradient(180deg, #f8f0dc 0%, #e6d5ad 100%);
  border: 1px solid var(--color-ink-muted);
  box-shadow: var(--bevel-paper), 0 1px 2px rgba(42,31,20,.35);
  text-shadow: var(--engrave-on-paper);
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.panel .btn:hover { border-color: var(--gilt-lo); background: linear-gradient(180deg, #fbf5e6, #ead9b2); }
.panel .btn:active, .panel .btn.active {
  background: linear-gradient(180deg, #ddc999, #ead9b4);
  box-shadow: inset 0 2px 3px rgba(42,31,20,.35), 0 1px 0 rgba(255,250,235,.6);
  transform: translateY(1px);
}
.panel .btn.danger { color: #8f1f17; border-color: #8f1f17; }
```

**On the dark surface** (AUTO, top-bar buttons): a lacquer plate with a gilt hairline.

```css
.btn {
  color: var(--color-text);
  background: linear-gradient(180deg, var(--lacquer-hi), var(--lacquer));
  border: 1px solid #000;
  box-shadow: var(--bevel-dark), 0 0 0 1px rgba(201,162,75,.28), 0 2px 3px rgba(0,0,0,.5);
  text-shadow: var(--engrave-on-dark);
}
.btn:hover { box-shadow: var(--bevel-dark), 0 0 0 1px var(--gilt), 0 2px 3px rgba(0,0,0,.5); color: var(--gilt-hi); }
.btn:active { background: linear-gradient(180deg, #0c0f18, #151a28); box-shadow: var(--well-dark); transform: translateY(1px); }
```

**Primary: the gilt plate** (PROCLAIM, NEW WORLD, Create). This is the one bright accent, as
in Anno's rule: one per screen.

```css
.btn.gilt {
  color: var(--color-ink);
  background: linear-gradient(180deg, #f3dc95 0%, #d8b25a 46%, #b88e38 54%, #cda24a 100%);
  border: 1px solid #5a4214;
  box-shadow: inset 0 1px 0 #fff3c4, inset 0 -1px 0 var(--gilt-lo), 0 0 0 1px rgba(0,0,0,.6), 0 3px 6px rgba(0,0,0,.5);
  text-shadow: 0 1px 0 rgba(255,240,200,.6);
}
.btn.gilt:hover { filter: brightness(1.06); }   /* a filter on one small element is cheap */
.btn.gilt:active { background: linear-gradient(180deg, #b88e38, #d8b25a); transform: translateY(1px);
  box-shadow: inset 0 2px 4px rgba(58,43,16,.6), 0 0 0 1px rgba(0,0,0,.6); }
```

### 2.9 Tabs (CULTURE, ECONOMY, ...): bookmark tabs on a recessed strip

```css
.tabs { display: flex; gap: 2px; padding: 3px 3px 0; border-radius: 2px 2px 0 0;
  background: rgba(42,31,20,.08); box-shadow: inset 0 1px 2px rgba(42,31,20,.25);
  border-bottom: 1px solid rgba(42,31,20,.45); }
.tabs > button { border: 1px solid transparent; border-bottom: 0; background: transparent;
  padding: 5px 10px 4px; font: 600 var(--text-xs)/1 var(--font-display);
  letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--color-ink-muted); }
.tabs > button.active {
  color: var(--color-rubric);
  background: linear-gradient(180deg, var(--color-parchment-light), var(--color-parchment));
  border-color: rgba(42,31,20,.45);
  box-shadow: inset 0 2px 0 var(--gilt), 0 -1px 2px rgba(42,31,20,.15);
  margin-bottom: -1px;            /* joins the page below: the tab and the page are one sheet */
}
```

### 2.10 Dividers: a flourish rule

```css
:root { --diamond: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><path d='M6 1L11 6L6 11L1 6Z' fill='%239c2f22'/><path d='M6 3.5L8.5 6L6 8.5L3.5 6Z' fill='%23ecdfc0'/></svg>"); }
.rule-flourish { height: 12px; border: 0; margin: var(--space-3) 0;
  background:
    var(--diamond) center / 12px 12px no-repeat,
    linear-gradient(90deg, transparent 0, rgba(42,31,20,.55) 18%, rgba(42,31,20,.55) calc(50% - 12px), transparent calc(50% - 12px),
                    transparent calc(50% + 12px), rgba(42,31,20,.55) calc(50% + 12px), rgba(42,31,20,.55) 82%, transparent 100%) center / 100% 1px no-repeat; }
```

### 2.11 Roundels for portraits, flags and the Live dot

```css
.roundel { position: relative; width: 44px; height: 44px; border-radius: 50%; padding: 2px;
  background: var(--gilt-ring);
  box-shadow: 0 0 0 1px #140e08, 0 2px 4px rgba(0,0,0,.5); }
.roundel > img, .roundel > .face { width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
  background: var(--color-parchment-dark); }
.roundel::after { content: ""; position: absolute; inset: 2px; border-radius: 50%; pointer-events: none;
  box-shadow: inset 0 2px 5px rgba(0,0,0,.55), inset 0 0 0 1px rgba(0,0,0,.45); }   /* the bezel's lip */
```

**Flag plate** (rectangular, for the nation card header and the war row). The cloth shading is
a static gradient over the flag:

```css
.flag-plate { position: relative; border: 2px solid transparent; border-radius: 1px;
  background: var(--flag-colour) padding-box, var(--gilt-metal) border-box;
  box-shadow: 0 0 0 1px #140e08, 0 2px 4px rgba(42,31,20,.45); }
.flag-plate::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(100deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 28%, rgba(0,0,0,.16) 55%, rgba(255,255,255,.08) 75%, rgba(0,0,0,.12) 100%); }
```

**Pennant** (EU5 and Humankind hang banners; ours is original): put it on the top-bar nation
name or the year.

```css
.pennant { clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%); padding: 6px 10px 14px;
  background: var(--lacquer-sheen), var(--lacquer-claret); border-top: 2px solid var(--gilt); }
```

### 2.12 Stat wells and chips

The stats grid on the nation card (PROVINCES 110, POPULATION ...): each value sits in a
shallow well, so the numbers read as "set into" the page.

```css
.stat { padding: 4px 8px 5px; border-radius: 2px;
  background: rgba(42,31,20,.05); box-shadow: var(--well-paper); }
.stat .label { font: 600 var(--text-cap)/1.2 var(--font-display); letter-spacing: var(--tracking-caps);
  color: var(--color-ink-muted); text-transform: uppercase; }
.stat .value { font: 500 var(--text-lg)/1.25 var(--font-mono); color: var(--color-ink); }
```

Chips get the same "plate" logic: a gradient, a top highlight and a contact shadow.

```css
.chip.war { color: #fbeee0; border-color: #6e1a12;
  background: linear-gradient(180deg, #c03c2d, #8a2419);
  box-shadow: inset 0 1px 0 rgba(255,200,180,.35), 0 1px 0 rgba(255,250,235,.6), 0 1px 2px rgba(42,31,20,.4);
  text-shadow: 0 -1px 0 rgba(0,0,0,.4); }
.chip.outline { box-shadow: var(--bevel-paper); background: linear-gradient(180deg, #f6eedb, #e7d8b3); }
```

### 2.13 Progress bars (Readiness, Unrest, token meter): a trough with a lit fill

```css
.bar { height: 8px; border-radius: 4px; background: #2a1f14; box-shadow: var(--well-dark); overflow: hidden; }
.bar > i { display: block; height: 100%; border-radius: 4px;
  background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 55%), var(--fill, var(--gilt));
  box-shadow: inset 0 -1px 0 rgba(0,0,0,.3); }
/* segmented, as in Vic3, but ours: a repeating gap every 10% */
.bar.seg-10 > i { -webkit-mask: repeating-linear-gradient(90deg, #000 0 calc(10% - 2px), transparent calc(10% - 2px) 10%);
                          mask: repeating-linear-gradient(90deg, #000 0 calc(10% - 2px), transparent calc(10% - 2px) 10%); }
```

### 2.14 Tooltips

```css
.tooltip { max-width: 320px; padding: 8px 12px; color: var(--color-text);
  background: var(--lacquer-sheen), #0f1320; border: 1px solid #000; border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(201,162,75,.55), inset 0 1px 0 rgba(255,255,255,.06), 0 6px 14px rgba(0,0,0,.6);
  font: var(--text-sm)/1.4 var(--font-serif); }
.tooltip b { color: var(--gilt-hi); font-weight: 600; }
```

### 2.15 Engraved and gilt text

```css
.panel h2 { color: var(--color-ink); text-shadow: var(--engrave-on-paper); }   /* nation name */
.gilt-text {                                    /* ONLY on dark: TERRA NOVA, the year, the closing card */
  background: linear-gradient(180deg, #fff1c2 0%, #e2c069 45%, #a8802f 55%, #e6c977 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.85));   /* text-shadow muddies clipped text; a drop-shadow on one small element is fine */
}
```

### 2.16 Separating the HUD from the globe: one static scrim

One fixed, full-screen, `pointer-events: none` layer between the canvas and the HUD. It
darkens only the screen edges where the panels dock, so they lift off the bright terrain
without any blur.

```css
.hud-scrim { position: fixed; inset: 0; pointer-events: none; z-index: 1;
  background:
    linear-gradient(90deg, rgba(5,6,10,.55) 0, rgba(5,6,10,0) 420px),                     /* behind the docked card */
    linear-gradient(180deg, rgba(5,6,10,.5) 0, rgba(5,6,10,0) 120px),                      /* under the top bar */
    linear-gradient(0deg, rgba(5,6,10,.55) 0, rgba(5,6,10,0) 110px);                       /* over the chronicle */
}
```

Toggle it with opacity only, if at all. It is static paint, composited once.

## 3. Do and don't

### Projector readability (1920x1080, washed-out blacks, low contrast)

- **Do** keep body ink on parchment at 7:1 or more (ink `#2a1f14` on `#ecdfc0` is about 12:1)
  and labels at 4.5:1 or more. `--color-ink-muted` on the vignette's darkest edge `#dcc89c` is
  about 5:1, so **do not let the vignette go darker than about `#d6c399`** where text sits.
- **Don't** put gilt `#c9a24b` text on parchment: it is about 1.8:1 and disappears. Gilt on
  `--color-bg` is about 8:1. **Gilt text belongs on dark only.** On parchment, use ink and rubric
  (rubric on parchment is about 5.6:1).
- **Do** keep Cinzel caps at 12px or more for anything you need read across a room, at weight
  600 or more, with `--tracking-caps`. Keep `--text-cap` (11px) for small labels only.
- **Don't** rely on hairlines under 45% opacity to separate things. Projectors lose them. Use
  1px lines at 45% or more, or 1.5px, or a tone change (a well or a plate).
- **Do** use text-shadows with a 1px offset and 0 blur (engraving). **Don't** use blurred glows
  behind text: they soften the glyphs on a projector.
- **Do** make the frame do the separating. A dark 1px outer line plus a big soft shadow reads
  on any terrain colour. A 1.5px ink border alone does not.
- **Do** keep one bright accent per screen (the gilt primary button), following Anno's rule.
  Everything else stays calm.

### Performance (the UI sits over a WebGL canvas that redraws every frame)

- **Don't use `backdrop-filter`** over the canvas. The globe changes every frame, so the
  browser must read back and blur the region under each blurred element every frame. Stacked,
  this is the easiest way to drop frames. Humankind's frosted look is done in its own renderer.
  If we want it, render a blurred copy in three.js, or use the static scrim (2.16).
- **Don't** use `mix-blend-mode` on HUD elements over the canvas. It forces blending with the
  live canvas every frame.
- **Don't animate `box-shadow`, `filter` or gradients.** Animate `opacity` and `transform` only.
  For a glow on hover or on "speaking", fade in a pre-drawn `::after` with `opacity`.
- **Do** keep box-shadows static. About 3 outer and 3 inset layers per panel is fine. We have
  about 6 panels on screen, which is a few dozen shadows, painted once. Large blur radii
  (40px or more) on big elements are fine while static. They cost only when the element
  repaints, so avoid them on things that re-render every tick (the ticker text, counters):
  put the shadow on a parent that does not change.
- **Do** keep the noise as a background-image data URI (2.1), tiled at 180 to 400px. **Don't**
  apply SVG `filter: url(#…)` to live elements.
- **Do** keep ornaments as small SVG data URIs or `border-image` (one decode, cached).
  **Don't** use large PNG frames: they scale badly to 1080p and blow the bundle.
- **Do** put `contain: paint` on panels that scroll (the nation card body), so a scroll
  repaints only inside the panel.
- **Don't** add `will-change` everywhere. Use it only on the one or two elements that animate
  in (the card slide-in), and remove it after.
- **Do** check with the Chrome Performance panel's "Paint flashing" and "Layer borders" while
  the globe spins. Nothing in the HUD should flash every frame except the ticker and the
  counters.

## 4. A recommended design language for Terra Nova (10 rules)

1. **Two materials, one metal.** Content is printed on **parchment sheets**. Chrome (the top
   bar, the chronicle, tooltips, plates) is **night lacquer**. **Gilt** is the metal edge that
   joins them. Nothing else.
2. **Every sheet sits in a frame.** A dark 1px outer line, a 3px gilt bevel band, then the paper
   recessed inside it (soft inner shadow), with our inner ink rule 5px in. The nation card and
   the Create screen add gilt corner brackets; small strips do not.
3. **Paper is never flat.** Fine grain, soft mottling and a warm edge vignette, with the
   vignette capped so muted ink stays at 4.5:1 or more.
4. **Lift with three static shadows**: a 1px contact line, a short 6px shadow and a 40px
   ambient shadow. Never animated. Plus one static edge scrim behind the docked panels. No
   blur, ever.
5. **Titles sit on plates.** Section headers are claret-lacquer strips with gilt hairlines (or,
   in narrative text, rubric caps over a flourish rule). The card's government type sits on a
   small cartouche that breaks the top edge.
6. **Clickable things are raised; readable things are sunk.** Buttons and active tabs are
   bevelled plates (light top edge, dark bottom edge) that press in by 1px. Numbers, bars,
   inputs and the map-mode strip sit in recessed wells.
7. **One gilt button per screen.** The primary action (PROCLAIM, NEW WORLD, Create) is a solid
   gilt plate with ink text. Every other button is paper or lacquer, with gilt only as a rim on
   hover.
8. **Round things get bezels.** Portraits, the Live dot, the speed and clock control and key
   icons sit in a gilt ring with a dark lip. Flags are framed plates with static cloth shading.
9. **Gilt only on dark; ink and rubric on parchment.** All type is engraved (a 1px light
   shadow below on paper, a 1px dark shadow above on lacquer). No glows, and nothing under
   11px.
10. **Ornament lives at the edges.** Corners, header ends and dividers carry the detail
    (Vic3: rich detail on "frames and borders", "used sparingly"). Content areas and the globe
    stay calm.

## Where to apply first (fastest visible win)

| Element | Recipe | Effort |
| --- | --- | --- |
| Nation card | 2.2, 2.3 (A+B+C), 2.4, 2.5, 2.9, 2.11, 2.12 | Medium |
| Top bar | 2.6, 2.7, 2.8 (dark and gilt), 2.11 for the Live dot, 2.15 for TERRA NOVA and the year | Small |
| Chronicle bar | 2.6 mirrored, a lacquer plate for the CHRONICLE label | Small |
| Network strip, Decree box, minimap | 2.3 (A+B), 2.8 | Small |
| Global | 2.0 tokens, 2.1 grain, 2.16 scrim, then restyle `.btn`, `.chip` and `.panel` in `tokens.css` | Small |

## Gaps

- I read Victoria 3 DD #30 and CK3 DD #28 only through search-result excerpts, because the
  Paradox forum blocked direct fetches. The exact quotes from those two are unconfirmed.
- No developer write-up on the UI art was found for Old World, Civ VII, Humankind, Total War,
  HOI4 or Age of History 3. Their rows come from my own reading of the official Steam
  screenshots, not from the developers.
- Of the Humankind screenshots, only the full-screen views showed UI. Its in-map HUD
  framing was not checked.
- I did not render the CSS recipes in the app, and I worked out the contrast figures by hand
  (approximate WCAG ratios). Check them once in the browser on the projector.
