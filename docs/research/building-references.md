# Building references for the four new model sets

Research for the owner's Blender kit (`assets/blender/styles_kit.py`, `styles_defs.py`). It deepens
`docs/research/nation-identity.md` sections 1.2 and 2 (`soviet_bloc`, `western_modern`, `egyptian`,
`highland`) and adds a note on a bronze-age set. Written 2026-11-14.

**Sources.** Facts come from the linked Wikipedia articles, read on 2026-11-14 (the same source
level as `building-styles.md` and `nation-identity.md`). Anything I could not confirm on a page is
marked *unconfirmed*; proportions marked *est.* are measured off photos by eye and are modelling
guidance, not facts.

**Images.** Lead images were saved for the team's private reference only, in
`scratch/refs/buildings/<set>/` (git-ignored, never commit). Each one is that Wikipedia article's
lead image (Wikimedia Commons, 330 px thumbnail); the article URL in the same table row is its
source. A dash means no image was saved.

## 0. Ground rules for every model in this doc

These follow `assets/blender/README.md` and the existing `Base` layouts.

| Rule | Value |
| --- | --- |
| Box | fits 1 x 1 x 1, origin centre of base, Blender Z up, front faces -y (gates at -y) |
| Footprint | `capital`/`city` use the full 1.0; `town` 0.9; `temple`/`fort` 0.7 (`FOOTPRINT` in `build_styles.py`) |
| Budget | < 1,500 triangles hard cap; aim < 1,000 (file size ~60 KB, flat shading doubles verts) |
| Materials | slots `wall, stone, roof, trim, dark, extra` plus exactly one `team` |
| No textures | so "window grids" are thin proud boxes in the `dark` slot, not textures or vertex colours (the kit has no vertex-colour path; the brief's "vertex colour stripes" becomes proud bands) |
| Scale on screen | a model 40 px tall means 1 unit = 40 px, so **0.025 = 1 px**. Anything under 0.05 (2 px) is tone, not shape. A window band does not read as a line at 40 px; it darkens the facade. It does read once a judge zooms in (100+ px). |
| Read order at 40 px | 1. silhouette (outline against the globe), 2. two or three big colour blocks, 3. repetition rhythm (many identical blocks, a row of columns). Spend triangles in that order. |

Triangle costs of the existing primitives (flat, as built by `Builder`):

| Primitive | Triangles |
| --- | --- |
| `box` | 12 |
| `frustum` (incl. apex/ridge forms) | 8 to 12 |
| `gable` | 8 |
| `shed` | 12 |
| `cyl` seg 8 | 28 (seg 6: 20, seg 4: 12) |
| `cone` seg 8 | 14 |
| `lathe` seg 8, k profile points | 16 (k - 1) + 6 per closed cap |

---

## 1. `soviet_bloc`

### 1.1 Reference board

| # | Example | Place, date | What defines it | Source | Local image |
| --- | --- | --- | --- | --- | --- |
| 1 | Khrushchyovka (series 1-464, 1-335, K-7, II-29...) | whole USSR, 1956 to mid-1970s | 4 to 5 storeys (rarely 2-3, some 8-9 in Moscow), large precast concrete panels, usually four sections with one central stair each, 2 to 4 flats a floor, ceilings from 2.5 m, most flats with a balcony or loggia; one brick series (1-447) has a pitched roof | [Khrushchevka](https://en.wikipedia.org/wiki/Khrushchevka) | `soviet_bloc/Khrushchyovka.jpg` |
| 2 | Brezhnevka | whole USSR, 1964 to 1980 (built into the 1990s) | 9 to 17 storeys, mostly 9; lifts (code: none up to 5 floors, one up to 9), rubbish chutes; ceilings up to 2.7 m; slabs and point towers | [Brezhnevka](https://en.wikipedia.org/wiki/Brezhnevka) | `soviet_bloc/Brezhnevka.jpg` |
| 3 | Plattenbau (P2, WBS 70) | GDR, 1960s to 1990 (Marzahn, Halle-Neustadt) | panel rows and towers; end walls often carry big murals or mosaics | [Plattenbau](https://en.wikipedia.org/wiki/Plattenbau) | `soviet_bloc/Plattenbau.jpg` |
| 4 | Panelák estates | Czechoslovakia, 1950s to 1990 | prefabricated pre-stressed panel blocks always grouped into estates | [Panelák](https://en.wikipedia.org/wiki/Panel%C3%A1k) | `soviet_bloc/Panel__k.jpg` |
| 5 | Microdistrict (mikrorayon) | USSR planning unit from the late 1950s | 10 to 60 ha (up to 80), 8,000 to 12,000 people, services within 500 m of every flat, entrances at most 300 m apart, bounded by main roads; "rows and rows" of standard blocks | [Microdistrict](https://en.wikipedia.org/wiki/Microdistrict) | `soviet_bloc/Microdistrict.jpg` |
| 6 | Main building of Moscow State University | Moscow, 1953 | tallest of the Seven Sisters: 239-240 m, 36 storeys; stepped central tower, spire, symmetric wings | [MSU main building](https://en.wikipedia.org/wiki/Main_building_of_Moscow_State_University), [Seven Sisters](https://en.wikipedia.org/wiki/Seven_Sisters_(Moscow)) | `soviet_bloc/Main_building_of_Moscow_State_University.jpg` |
| 7 | Hotel Ukraina | Moscow, 1957 | Seven Sister: 206 m (sources also give 198 m), 34 levels, wedding-cake tower and spire | [Hotel Ukraina](https://en.wikipedia.org/wiki/Hotel_Ukraina,_Moscow) | `soviet_bloc/Hotel_Ukraina__Moscow_.jpg` |
| 8 | Palace of Culture and Science | Warsaw, 1955 | 237 m Stalinist tower "gift" to Poland; the export version of the type | [Palace of Culture and Science](https://en.wikipedia.org/wiki/Palace_of_Culture_and_Science) | `soviet_bloc/Palace_of_Culture_and_Science.jpg` |
| 9 | Ministry of Highways (Bank of Georgia HQ) | Tbilisi, 1975 | Brutalist icon: five two-storey horizontal blocks stacked crosswise on three concrete cores, 18 storeys, exposed concrete | [Bank of Georgia headquarters](https://en.wikipedia.org/wiki/Bank_of_Georgia_headquarters) | - |
| 10 | Palace of the Parliament | Bucharest, 1984 to 1997 | late socialist monumentalism: 84 m high, 365,000 m2, largest civilian administrative building | [Palace of the Parliament](https://en.wikipedia.org/wiki/Palace_of_the_Parliament) | `soviet_bloc/Palace_of_the_Parliament.jpg` |
| 11 | Duga over-the-horizon radar | near Chernobyl and in Siberia, 1976 to 1989 | giant lattice wall antenna; the Cold War military read for `fort` | [Duga radar](https://en.wikipedia.org/wiki/Duga_radar) | `soviet_bloc/Duga_radar.jpg` |

### 1.2 Silhouette rules (tiny low-poly, seen from orbit)

| Element | Real proportion | Model rule |
| --- | --- | --- |
| Khrushchyovka slab | 5 floors at about 2.7-3 m = 14-15 m high; 4 sections long; about 11-12 m deep. Length 60-80 m *unconfirmed* (no length on the page; est. from 4 sections x ~15 m) | L : D : H = **5 : 1 : 1.7** (exaggerate height 1.3x so it is not a pancake). Standard piece: **0.55 x 0.11 x 0.20**, 5 floors of 0.04 |
| Brezhnevka slab | 9 floors, 27-30 m | **0.50 x 0.13 x 0.36** (9 x 0.04) |
| Brezhnevka point tower | 16-17 floors, square-ish plan *est.* 1 : 1 | **0.16 x 0.16 x 0.60**, bands every 2 floors |
| Roof | flat, thin parapet, lift-machine box on top of 9+ storeys | flat; parapet box +0.008 all round, 0.012 high, `roof` slot; lift box 0.06 x 0.05 x 0.03 on towers |
| Repeated elements | horizontal window rows, vertical stair strips one per section, balconies in vertical stacks | one `dark` band per floor (0.014 high, proud 0.003); 3 vertical stair strips (0.02 wide, `wall` lighter) per slab; drop individual balconies |
| Microdistrict layout | rows of identical blocks, parallel, with open green between, school box in the middle | always **2 or more identical slabs parallel**, gap = 1.2 to 1.5 x slab height. Repetition is the cue; vary only length |
| Stalinist high-rise | MSU 240 m; central tower about 1 : 4 width:height to the spire base *est.*; spire + star about the top 20-25 % *est.*; wings step down symmetric 3 to 4 tiers | central stack of 4 shrinking tiers (shrink 0.72 per tier), spire = 25 % of total height, star 0.07 wide; wings 0.35 to 0.45 of centre height; pinnacles (tiny cones) on tier corners |
| Brutalism | raw concrete, cantilevered blocks, no ornament | stacked crossing boxes, each overhanging 0.04 to 0.08; darker concrete (`stone`) |
| Exaggerate | height of slabs, number of identical repeats, the star, the red banners, the chimney | |
| Drop | balconies, panel seams, entrances, trees, mosaics (keep one red end-wall stripe for team) | |

**Palette (`PALETTES["soviet_bloc"]`).**

| Slot | Hex | What |
| --- | --- | --- |
| wall | `#B4B2A8` | panel concrete (slightly warm grey) |
| stone | `#85837B` | dark concrete, brutalist blocks, plinths |
| roof | `#55565A` | bitumen flat roofs |
| trim | `#C9B79A` | Stalinist sandstone (high-rises, palace of culture) |
| dark | `#2E3138` | window bands, doors |
| extra | `#D4A93A` | gold (spire, star wreath) |
| team | nation colour | star, banners, end-wall stripe, chimney bands |

### 1.3 Per-kind specs

Coordinates are model units in the 1 x 1 x 1 box; `(x, y)` centres, `z0` bottom. "Slab A" means
`panel_slab(...)` from 1.6.

**capital: Stalinist wedding-cake tower + two Khrushchyovka wings + parade square** (~640 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| plinth | box | 0.56 x 0.34 x 0.04 at (0, 0.05) | stone |
| wings | 2 x `setback_tower(tiers=2)` | base 0.18 x 0.22 x 0.22, at x = +/-0.24, y = 0.05; second tier 0.11 x 0.13 x 0.08 | trim |
| centre | `setback_tower(tiers=4, shrink=0.72, spire=True)` | base 0.22 x 0.22 x 0.30 on z 0.04; tiers 0.30/0.14/0.10/0.08 high; spire 0.06 base, 0.24 high (top near z 0.96) | trim tiers, extra spire |
| pinnacles | 12 x `cone` seg 4 | r 0.012, h 0.04, at the 4 corners of tiers 1 to 3 | extra |
| star | `star(points=5)` | outer r 0.035, depth 0.012, standing on the spire tip | team |
| window bands | `bands()` on centre tier 1 | 5 bands | dark |
| housing slabs | 2 x Slab A | 0.80 x 0.09 x 0.16 (4 floors) at y = +0.42 and along x; second one 0.30 x 0.09 x 0.20 at (-0.36, -0.30) rz 90 | wall, dark bands |
| parade square | box | 0.42 x 0.22 x 0.008 at (0.10, -0.34) | stone |
| banners | 3 x box | 0.10 x 0.006 x 0.14 on poles at y = -0.45, x = -0.05, 0.10, 0.25 | team (poles dark) |

**city: microdistrict, three parallel slabs + point tower + brutalist block + chimney** (~820 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| slabs | 3 x Slab A (5 floors) | 0.55 x 0.11 x 0.20 at (-0.18, 0.34), (-0.18, 0.08), (-0.18, -0.18), long axis x | wall, dark bands, wall stair strips |
| end stripe | box | 0.006 x 0.06 x 0.18 on the +x end of the middle slab | team |
| point tower | Slab A as tower, bands every 2 floors | 0.16 x 0.16 x 0.62 at (0.30, 0.26), lift box on top | wall |
| brutalist block | `stack_cross(n=3)` | 0.22 x 0.10 x 0.07 boxes crossing at 90 deg, from z 0.05, on a core 0.06 x 0.06 x 0.30 at (0.28, -0.20) | stone |
| chimney (TETs) | `chimney(bands=3)` | r 0.028 to 0.022, h 0.75, at (0.42, -0.42) | wall, team bands |
| school | box | 0.20 x 0.10 x 0.06 at (-0.18, -0.42) | trim |

**town: two slabs in an L + palace of culture with portico + Lenin plinth** (~560 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| slab 1 | Slab A, 5 floors | 0.60 x 0.11 x 0.20 at (0.05, 0.30) | wall |
| slab 2 | Slab A, 4 floors | 0.45 x 0.11 x 0.16 at (-0.32, -0.08), rz 90 | wall |
| house of culture | box + flat attic box | 0.30 x 0.18 x 0.12 at (0.12, -0.18); attic 0.32 x 0.20 x 0.025 | trim, stone attic |
| portico | 6 x `cyl` seg 4 | r 0.015, h 0.12, along y = -0.28, x from 0.0 to 0.24 | wall |
| statue plinth | box + box | 0.05 x 0.05 x 0.06 + figure 0.02 x 0.02 x 0.06 at (0.12, -0.40) | stone, dark |
| banner | box | 0.12 x 0.006 x 0.05 on the attic front | team |

**temple: brutalist monument (wedge hall + obelisk with star)** (~420 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| podium | box | 0.62 x 0.62 x 0.04 | stone |
| wedge hall | `shed` | 0.42 x 0.32, low edge h0 0.06, high edge 0.28, at (-0.08, 0.10) on z 0.04 | wall |
| hall fins | 5 x box | 0.02 x 0.34 x 0.20 across the hall roof every 0.08 (Brutalist ribs) | stone |
| obelisk | `obelisk(cap=False)` | base 0.08, top 0.05, h 0.62 at (0.20, -0.18) | trim |
| star | `star(5)` | r 0.04 at the obelisk top, facing -y | team |
| eternal flame | `cyl` seg 6 + `cone` | r 0.04, h 0.015 + flame cone r 0.02 h 0.04 at (0.0, -0.24) | dark, extra |

**fort: concrete bunker, radar dish, missile on erector, blast wall** (~700 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| blast wall | `ring(half=0.33, h=0.06, t=0.05)` with gate | concrete, no crenels | stone |
| bunker | `battered(0.30 x 0.22, h 0.12, k 0.8)` | at (-0.10, 0.08) | stone |
| radar | `dish()` on `lattice_mast()` | dish r 0.12, tilt 35 deg, mast 0.04 x 0.04 x 0.30 at (0.18, 0.15) | wall dish, dark mast |
| missile | `cyl` seg 6 + `cone` + truck box | r 0.022, h 0.30, cone 0.06; tilted 65 deg (rot x) on truck 0.20 x 0.07 x 0.04 at (0.10, -0.17) | wall body, team nose cone |
| watch tower | box legs + box cabin | 0.06 x 0.06 x 0.30 at (-0.30, -0.28) | dark |
| flag | `Base.flag` | h 0.34 on the bunker | team |

### 1.4 Kit additions (soviet_bloc, also reused by western_modern)

```python
# styles_kit.py, inside Builder

def bands(self, x, y, z0, w, d, floors, fh, mat="dark", bh=0.35, every=1, proud=0.003):
    """Horizontal window bands on all four sides of a w x d block: one dark slab per floor.
    Reads as a facade grid when combined with vertical strips. 12 tris per band."""
    for i in range(0, floors, every):
        zc = z0 + i * fh + fh * 0.40
        self.box(x, y, zc, w + 2 * proud, d + 2 * proud, fh * bh * every, mat)

def strips(self, x, y, z0, w, d, h, n, mat="wall", sw=0.02, proud=0.005, faces=("-y", "+y")):
    """n vertical strips (stairwells or mullions) proud of the given faces, evenly spaced along x."""
    for f in faces:
        sy = (-1 if f[0] == "-" else 1) * (d / 2 + proud / 2)
        for k in range(n):
            cx = x - w / 2 + (k + 0.5) * w / n
            self.box(cx, y + sy, z0, sw, proud, h, mat)

def panel_slab(self, x, y, L, D, floors, fh=0.04, rz=0.0, sections=4, every=1,
               mat="wall", band="dark", roof="roof"):
    """Khrushchyovka / Brezhnevka slab. Long axis local x. Returns roof z."""
    h = floors * fh
    with self.at(x, y, rz):
        self.box(0, 0, 0, L, D, h, mat)
        self.bands(0, 0, 0, L, D, floors, fh, band, every=every)
        self.strips(0, 0, 0, L, D, h, sections - 1 if sections > 1 else 1, mat, sw=0.022)
        self.box(0, 0, h, L + 0.008, D + 0.008, 0.012, roof)   # parapet + roof
    return h + 0.012

def setback_tower(self, x, y, z0, w, d, heights, shrink=0.72, mat="trim", spire=0.0,
                  spire_mat="extra", pinnacle_mat=None):
    """Wedding-cake / Art Deco tower: len(heights) stacked boxes, each shrink x the one below.
    spire > 0 adds a 4-sided frustum spire that tall. Returns top z."""
    z = z0
    for i, h in enumerate(heights):
        s = shrink ** i
        self.box(x, y, z, w * s, d * s, h, mat)
        if pinnacle_mat and i < len(heights) - 1:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    self.cone(x + sx * w * s / 2, y + sy * d * s / 2, z + h, 0.012, 0.04, pinnacle_mat, seg=4)
        z += h
    if spire:
        s = shrink ** len(heights)
        self.frustum(x, y, z, w * s * 0.6, d * s * 0.6, 0, 0, spire, spire_mat)
        z += spire
    return z

def star(self, x, y, z, r, mat="team", points=5, depth=0.012, ri=0.45):
    """Flat star standing upright (in the x-z plane), centred at height z. 36 tris for 5 points."""
    m = self._m(x, y, z, (math.pi / 2, 0, 0))
    ring = []
    for i in range(points * 2):
        a = math.pi / 2 + i * math.pi / points
        rr = r if i % 2 == 0 else r * ri
        ring.append((rr * math.cos(a), rr * math.sin(a)))
    f = [(px, py, depth / 2) for px, py in ring]
    b = [(px, py, -depth / 2) for px, py in ring]
    faces = [f, list(reversed(b))]
    for i in range(len(ring)):
        j = (i + 1) % len(ring)
        faces.append([b[i], b[j], f[j], f[i]])
    self._poly(faces, m, mat)

def stack_cross(self, x, y, z0, core, L, D, H, n, mat="stone", gap=0.0):
    """Brutalist stacked-cross (Tbilisi Ministry of Highways): a core plus n boxes,
    alternating 0 / 90 deg, each L x D x H, stacked with gap."""
    self.box(x, y, 0, core, core, z0 + n * (H + gap), mat)
    for i in range(n):
        self.box(x, y, z0 + i * (H + gap), L, D, H, mat, rot=(0, 0, (i % 2) * math.pi / 2))

def chimney(self, x, y, h, r0, r1, mat="wall", band_mat="team", bands=3):
    self.cyl(x, y, 0, r0, h, mat, seg=6, r2=r1)
    for k in range(bands):
        zb = h * (0.55 + 0.15 * k)
        rr = r0 + (r1 - r0) * (zb / h) + 0.003
        self.cyl(x, y, zb, rr, 0.04, band_mat, seg=6)

def dish(self, x, y, z, r, tilt=0.6, mat="wall", seg=8):
    """Shallow radar dish, open bowl, tilted about x. 4-ring lathe = ~56 tris."""
    prof = [(0.0, 0.0), (r * 0.5, r * 0.06), (r * 0.85, r * 0.2), (r, r * 0.32)]
    m_rot = (tilt, 0, 0)
    # lathe with rotation: build in local space then rotate (add rot= to lathe, like box/cyl)
    self.lathe(x, y, z, prof, mat, seg=seg, close_bottom=False, rot=m_rot)

def lattice_mast(self, x, y, h, w, mat="dark"):
    for sx in (-1, 1):
        for sy in (-1, 1):
            self.box(x + sx * w / 2, y + sy * w / 2, 0, 0.008, 0.008, h, mat)
    for k in range(1, 4):
        self.box(x, y, h * k / 4, w, w, 0.006, mat)
```

Note: `lathe` needs an optional `rot=(rx, ry, rz)` passed to `self._m` (today it only takes `rz`).
The star and dish both depend on that one-line change.

---

## 2. `western_modern`

### 2.1 Reference board

| # | Example | Place, date | What defines it | Source | Local image |
| --- | --- | --- | --- | --- | --- |
| 1 | Levittown | Long Island NY, 1947 to 1951 | 17,447 mass-built houses by 1951, about 30 a day at peak; 1949 ranch model 32 x 25 ft (9.8 x 7.6 m), five near-identical models varying only colour and window placement; concrete slab bases | [Levittown, New York](https://en.wikipedia.org/wiki/Levittown,_New_York) | `western_modern/Levittown__New_York.jpg` (map, not a photo) |
| 2 | Cape Cod house | New England, revived 1930s to 1950s | low broad 1 to 1.5 storeys, moderately steep gable, large central chimney, central door flanked by windows | [Cape Cod (house)](https://en.wikipedia.org/wiki/Cape_Cod_(house)) | `western_modern/Cape_Cod__house_.jpg` |
| 3 | Ranch-style house | USA, 1940s to 1970s | long, low, close to the ground, wide open plan | [Ranch-style house](https://en.wikipedia.org/wiki/Ranch-style_house) | `western_modern/Ranch-style_house.jpg` |
| 4 | Seagram Building | New York, 1958 | 157 m, 38 storeys; slab 29 x 44 m set back 27 m behind a raised pink granite plaza; 9.1 m bays of five windows; bronze I-beam mullions, pinkish-grey glass | [Seagram Building](https://en.wikipedia.org/wiki/Seagram_Building) | `western_modern/Seagram_Building.jpg` |
| 5 | Lever House | New York, 1952 | 94 m International Style slab over a low podium; second glass curtain wall in NYC | [Lever House](https://en.wikipedia.org/wiki/Lever_House) | `western_modern/Lever_House.jpg` |
| 6 | UN Headquarters (Secretariat) | New York, 1952 | the first NYC glass curtain wall; thin slab beside a low curved Assembly hall | [Headquarters of the UN](https://en.wikipedia.org/wiki/Headquarters_of_the_United_Nations) | `western_modern/United_Nations_Headquarters.jpg` |
| 7 | US Capitol dome | Washington DC, 1855 to 1866 | 88 m to the statue top, 29 m diameter; cast iron painted as stone; drum ringed by 36 columns; lantern and statue | [US Capitol dome](https://en.wikipedia.org/wiki/United_States_Capitol_dome) | `western_modern/United_States_Capitol.jpg` |
| 8 | Lincoln Memorial | Washington DC, 1922 | neoclassical temple form, flat attic instead of a pediment, outer colonnade | [Lincoln Memorial](https://en.wikipedia.org/wiki/Lincoln_Memorial) | `western_modern/Lincoln_Memorial.jpg` |
| 9 | Southdale Center | Edina MN, 1956 (Victor Gruen) | first fully enclosed, climate-controlled US mall; anchors at the ends, central "garden court", 5,200 parking spaces at opening | [Southdale Center](https://en.wikipedia.org/wiki/Southdale_Center) | `western_modern/Southdale_Center.jpg` |
| 10 | The Pentagon | Arlington VA, 1943 | five sides of 281 m, 23 m high, five rings, 21,000 m2 courtyard | [The Pentagon](https://en.wikipedia.org/wiki/The_Pentagon) | - |

### 2.2 Silhouette rules

| Element | Real proportion | Model rule |
| --- | --- | --- |
| Glass slab tower | Seagram H : W : D = 157 : 44 : 29 = **5.4 : 1.5 : 1** | 0.18 x 0.12 x 0.80 for the tall one; others 0.65, 0.50, 0.40. Always a flat top with a darker mechanical crown (0.03) |
| Curtain wall | vertical mullions every bay, spandrels hidden | **vertical** ribs only, 3 to 4 per face, `dark` on `trim` (glass). This is the opposite of the Soviet horizontal bands |
| Podium + plaza | Lever House podium; Seagram 27 m plaza | low box 1.6 x tower width, 0.04 high; plaza slab in front |
| Suburban house | ranch 9.8 x 7.6 m, 1 storey ~3 m wall + roof; ratio L : D : H(eave) about **1.3 : 1 : 0.4** | 0.16 x 0.12 x 0.05 walls, gable 0.045 (pitch about 37 deg, Cape Cod steeper 0.06); chimney 0.02 x 0.02 x 0.04 |
| Lawn | every house on its own plot | green plate `extra` 0.22 x 0.20 x 0.006 under each house; this green is a big part of the Western read |
| Street | curving suburban streets *(Levittown page does not say; general suburb knowledge, unconfirmed)* | 5 to 7 thin `dark` boxes 0.05 wide, rotated along an arc |
| Capitol dome | building ~229 m long *unconfirmed*; dome 29 m wide = **1 : 8** of length; total height 88 m | exaggerate dome to 1 : 5.5 of the building length (r 0.08 on a 0.9 building); drum 1.05 r; colonnade 12 posts (not 36) |
| Neoclassical civic | white stone, colonnade, pediment or flat attic | 6 to 8 front columns minimum; columns seg 4 cyl, r 0.015 |
| Mall | huge flat box, anchors at the ends, car park | box 0.45 x 0.18 x 0.06, anchors 0.12 x 0.20 x 0.08, car park plate with 4 white stripes |
| Exaggerate | tower height differences, glass blue, lawn green, white dome, flag | |
| Drop | windows on houses, cars, trees (or one cone tree per lawn if spare tris), signage | |

**Palette (`PALETTES["western_modern"]`).**

| Slot | Hex | What |
| --- | --- | --- |
| wall | `#EDE8DC` | white stone, painted siding |
| stone | `#9A6B4F` | red brick mid-rises, chimneys |
| roof | `#5A5F66` | asphalt shingle grey |
| trim | `#7FB6CC` | glass (light) |
| dark | `#2F4454` | dark glass crown, mullions, asphalt |
| extra | `#5E8C4A` | lawn green |
| team | nation colour | flags, tower crown strip, every other house roof, mall awning |

### 2.3 Per-kind specs

**capital: domed capitol + three glass towers** (~880 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| terrace | box x 2 | 0.92 x 0.40 x 0.03, then 0.86 x 0.34 x 0.03 at (0, -0.22) | wall |
| centre block | box + flat attic | 0.40 x 0.22 x 0.13 at (0, -0.22) on z 0.06 | wall |
| wings | 2 x box | 0.20 x 0.18 x 0.11 at x = +/-0.32 | wall |
| portico | `colonnade(n=6)` + `gable` pediment | 6 cyl seg 4 r 0.014 h 0.13 along y = -0.34; pediment 0.20 wide, 0.05 high | wall |
| dome | `drum_dome(r=0.085, cols=12)` | on z 0.19 at (0, -0.20); total top about z 0.52 | wall dome, roof drum base |
| lantern + flag | `cyl` + `Base.flag` | r 0.02 h 0.04; flag h 0.12 | wall, team flag |
| towers | 3 x `curtain_tower` | (0.18 x 0.12 x 0.85) at (-0.24, 0.30); (0.16 x 0.12 x 0.62) at (0.04, 0.32); (0.14 x 0.14 x 0.48) at (0.30, 0.28) | trim glass, dark ribs, team crown strip |
| lawn (Mall) | box | 0.50 x 0.14 x 0.006 at (0, -0.45) | extra |

**city: downtown cluster** (~900 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| glass towers | 3 x `curtain_tower` | 0.16 x 0.12 x 0.80 at (-0.20, 0.20); 0.15 x 0.15 x 0.60 at (0.12, 0.25); 0.14 x 0.11 x 0.45 at (-0.05, -0.12) | trim, dark, team crown |
| Art Deco spire tower | `setback_tower(tiers=4, shrink=0.8, spire=0.18)` | base 0.16 x 0.16 x 0.36 at (0.30, -0.20) | wall tiers, dark bands every tier, extra spire |
| brick mid-rises | 2 x box + `bands(every=1)` | 0.14 x 0.14 x 0.20 at (-0.34, -0.30) and (0.32, 0.40) | stone, dark |
| plazas | 2 x box | 0.20 x 0.10 x 0.006 in front of the two tallest towers | wall |
| street grid | 2 x box | 0.96 x 0.04 x 0.004 along x at y = 0.02; and along y at x = -0.02 | dark |

**town: suburb (4 ranch houses on lawns) + steepled church/town hall** (~620 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| houses | 4 x `suburb_house` (Base town spots (+/-0.3, +/-0.3)) | lawn 0.24 x 0.22 x 0.006, walls 0.16 x 0.12 x 0.05, gable 0.045, chimney, garage 0.07 x 0.10 x 0.04 on alternate houses | extra lawn, wall walls, team or roof roofs alternating, stone chimney |
| street | 6 x box | 0.06 x 0.12 x 0.004 rotated along an arc through the middle | dark |
| church / town hall | box + gable + square tower + `cone` seg 4 | body 0.16 x 0.24 x 0.10; tower 0.06 x 0.06 x 0.18; steeple 0.05 x 0.16 | wall, roof, wall, team steeple |
| shop strip | box + awning `shed` | 0.20 x 0.07 x 0.05 at (0, -0.12); awning 0.20 x 0.03 | wall, team |

**temple: Lincoln-style memorial (flat attic, colonnade all round)** (~700 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| steps | `plinth(steps=3, mat="wall", mat2="roof")` | 0.66 x 0.46, 0.03 each | wall and roof grey alternating (the palette's `stone` is brick) |
| cella | box | 0.46 x 0.26 x 0.18 | wall |
| colonnade | `colonnade` front 8, back 8, sides 4 each | cyl seg 4, r 0.016, h 0.18 | wall |
| entablature + attic | box + box | 0.60 x 0.40 x 0.03, then 0.50 x 0.30 x 0.05 | wall, roof |
| reflecting pool | box | 0.10 x 0.12 x 0.004 at (0, -0.30) (fits the 0.7 temple footprint) | trim |
| flags | 2 x `Base.flag` | h 0.30 at x = +/-0.30, y = -0.28 | team |

**fort: Pentagon + radome** (~520 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| outer ring | `poly_ring(sides=5, r_out=0.33, r_in=0.20, h=0.07)` | centre (0, 0) | wall |
| roof rings | `poly_ring` x 2 | (0.32 to 0.29, h 0.075), (0.24 to 0.21, h 0.075) | roof |
| courtyard | `poly_ring` filled (`r_in=0`) | r 0.20, h 0.004 | extra |
| radome | `lathe` hemisphere seg 8 on a box | r 0.06 on 0.08 x 0.08 x 0.05 at (0.28, 0.28) | wall |
| flag | `Base.flag` | h 0.30 at (0, -0.36) | team |
| (option) airbase | hangar `lathe` half-cylinder + control tower | per `nation-identity.md` 2.2 | |

### 2.4 Kit additions (western_modern)

```python
def curtain_tower(self, x, y, w, d, h, ribs=3, glass="trim", rib="dark", crown="dark",
                  crown_team=True, podium=True):
    """International Style slab: glass box, vertical mullion ribs on all four faces,
    dark mechanical crown, optional team strip and podium. About 12 + 12*4*ribs + 36 tris."""
    if podium:
        self.box(x, y, 0, w * 1.6, d * 1.6, 0.04, "wall")
    self.box(x, y, 0, w, d, h, glass)
    for f in ("-y", "+y"):
        self.strips(x, y, 0, w, d, h, ribs, rib, sw=0.008, faces=(f,))
    with self.at(x, y, math.pi / 2):     # the two x faces
        self.strips(0, 0, 0, d, w, h, max(2, ribs - 1), rib, sw=0.008)
    self.box(x, y, h, w * 0.9, d * 0.9, 0.03, crown)
    if crown_team:
        self.box(x, y, h - 0.02, w + 0.006, d + 0.006, 0.015, "team")

def colonnade(self, x0, x1, y, z, n, h, r=0.015, mat="wall", seg=4):
    for k in range(n):
        cx = x0 + (x1 - x0) * k / (n - 1)
        self.cyl(cx, y, z, r, h, mat, seg=seg)

def drum_dome(self, x, y, z, r, cols=12, mat="wall", base="roof"):
    """Capitol dome: drum, peristyle ring of posts, attic, dome, lantern. Returns top z."""
    self.cyl(x, y, z, r * 1.1, r * 0.5, base, seg=10)                      # lower drum
    for k in range(cols):
        a = 2 * math.pi * k / cols
        self.cyl(x + r * 1.18 * math.cos(a), y + r * 1.18 * math.sin(a), z + r * 0.5,
                 r * 0.08, r * 0.6, mat, seg=4)                            # peristyle
    self.cyl(x, y, z + r * 0.5, r, r * 0.75, mat, seg=10)                  # upper drum
    pr = [(1.0, 0), (0.95, 0.35), (0.75, 0.7), (0.4, 0.95), (0.12, 1.02)]
    self.lathe(x, y, z + r * 1.25, [(a * r, c * r) for a, c in pr], mat, seg=10)
    top = z + r * 2.27
    self.cyl(x, y, top, r * 0.14, r * 0.35, mat, seg=6)                    # lantern
    return top + r * 0.35

def suburb_house(self, x, y, w=0.16, d=0.12, h=0.05, pitch=0.045, rz=0.0, i=0,
                 lawn=True, garage=True):
    with self.at(x, y, rz):
        if lawn:
            self.box(0, 0, 0, w + 0.08, d + 0.10, 0.006, "extra")
        self.box(0, 0, 0.006, w, d, h, "wall")
        self.gable(0, 0, 0.006 + h, w, d, pitch, "team" if i % 2 == 0 else "roof", over=0.012)
        self.box(w * 0.25, 0, 0.006 + h, 0.02, 0.02, pitch + 0.02, "stone")   # chimney
        if garage and i % 2:
            self.box(w / 2 + 0.035, 0, 0.006, 0.07, d * 0.85, h * 0.8, "wall")
            self.box(w / 2 + 0.035, 0, 0.006 + h * 0.8, 0.075, d * 0.9, 0.008, "roof")

def poly_ring(self, x, y, z0, r_out, r_in, h, mat, sides=5, rz=0.0):
    """Regular polygon ring (Pentagon). r_in = 0 gives a filled prism. 8*sides tris."""
    m = self._m(x, y, z0, (0, 0, rz + math.pi / 2))
    P = lambda r, i, z: (r * math.cos(2 * math.pi * i / sides), r * math.sin(2 * math.pi * i / sides), z)
    faces = []
    for i in range(sides):
        j = (i + 1) % sides
        faces.append([P(r_out, i, 0), P(r_out, j, 0), P(r_out, j, h), P(r_out, i, h)])
        if r_in > 0:
            faces.append([P(r_in, j, 0), P(r_in, i, 0), P(r_in, i, h), P(r_in, j, h)])
            faces.append([P(r_out, i, h), P(r_out, j, h), P(r_in, j, h), P(r_in, i, h)])
    if r_in == 0:
        faces.append([P(r_out, i, h) for i in range(sides)])
    self._poly(faces, m, mat)
```

---

## 3. Soviet vs Western at 40 px: the three strongest cues each

At 40 px only outline, colour blocks and rhythm survive (section 0). Spend the triangles here.

| # | Soviet reads as... | Western reads as... | How to guarantee it |
| --- | --- | --- | --- |
| 1 | **Long, flat-roofed, identical grey slabs in parallel rows** (horizontal mass, repetition) | **Tall, thin, blue glass towers of different heights** (vertical mass, variety) | Soviet city: no element taller than 0.62 except chimney/spire; at least 3 identical slabs. Western city: towers 0.4 to 0.85, no two the same height |
| 2 | **One central spire with a star** on a stepped sandstone tower, plus red banners and a striped chimney | **One white dome** with a flag, and green lawns under pitched-roof houses | the star and dome are the single focal point of each capital; never put a dome on Soviet or a star on Western |
| 3 | **Grey + red** (concrete `#B4B2A8`, banner red team, gold accents) with **horizontal** dark bands | **Blue + white + green** (glass `#7FB6CC`, white stone, lawn `#5E8C4A`) with **vertical** ribs | keep green out of `soviet_bloc` entirely and grey concrete out of `western_modern` except roads |

Demo tip: when two rival nations sit next to each other, the globe should show their capitals
side by side. Height profile alone (flat skyline with one spire vs a jagged glass skyline with one
dome) carries the Cold War contrast before the colours load.

---

## 4. `egyptian`

### 4.1 Reference board

| # | Example | Place, date | What defines it | Source | Local image |
| --- | --- | --- | --- | --- | --- |
| 1 | Karnak, First Pylon | Luxor, 30th Dynasty (unfinished) | pylon 113 m long, 43 m high, 15 m thick | [Karnak](https://en.wikipedia.org/wiki/Karnak) | `egyptian/Karnak.jpg` |
| 2 | Great Hypostyle Hall, Karnak | Luxor, 19th Dynasty | 5,000 m2, 134 columns in 16 rows; 12 central columns 21 m tall and over 3 m wide, the other 122 are 10 m: a raised clerestory nave | [Karnak](https://en.wikipedia.org/wiki/Karnak), [Hypostyle](https://en.wikipedia.org/wiki/Hypostyle) | `egyptian/Hypostyle.jpg` |
| 3 | Luxor Temple | Luxor, c. 1400 BC on | pylon gate with obelisk in front, avenue of sphinxes to Karnak | [Luxor Temple](https://en.wikipedia.org/wiki/Luxor_Temple) | `egyptian/Luxor_Temple.jpg` |
| 4 | Pylon (type), Philae | Egypt, all periods | two tapering towers with sloping walls flanking a lower gate, cornice on top | [Pylon](https://en.wikipedia.org/wiki/Pylon_(architecture)) | `egyptian/Pylon__architecture_.jpg` |
| 5 | Obelisks (Lateran, Luxor/Paris) | Karnak and Luxor, New Kingdom | Lateran 32.18 m; Luxor obelisk in Paris 23 m incl. base, over 250 t; tall thin four-sided shaft with pyramidion | [Obelisk](https://en.wikipedia.org/wiki/Obelisk) | `egyptian/Obelisk.jpg` |
| 6 | Mastaba | Saqqara, Giza; c. 3100 to 2181 BC | flat roof, inward-sloping sides, often 4 x as long as wide, 10 m+ high, mudbrick or limestone, north-south | [Mastaba](https://en.wikipedia.org/wiki/Mastaba) | `egyptian/Mastaba.jpg` |
| 7 | Pyramid of Djoser | Saqqara, c. 2667 to 2648 BC | 6 steps, 62.5 m high, base 109 x 121 m; enclosure wall 10.5 m high, 1.6 km long, bastions every 4.1 m, 14 false doors | [Pyramid of Djoser](https://en.wikipedia.org/wiki/Pyramid_of_Djoser) | `egyptian/Pyramid_of_Djoser.jpg` |
| 8 | Great Pyramid of Giza | Giza, c. 2560 BC | originally 146.6 m high on a 230.3 m base (h : b = 0.64, about 51.8 deg faces) *(from the article lead; figures widely cited)* | [Great Pyramid of Giza](https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza) | `egyptian/Great_Pyramid_of_Giza.jpg` |
| 9 | Mortuary temple of Hatshepsut | Deir el-Bahari, c. 1470 BC | three colonnaded terraces with ramps against a cliff | [Hatshepsut temple](https://en.wikipedia.org/wiki/Mortuary_temple_of_Hatshepsut) | `egyptian/Mortuary_temple_of_Hatshepsut.jpg` |
| 10 | Deir el-Medina | Theban west bank, New Kingdom | walled workers' village, rows of flat-roofed mudbrick terrace houses on one street | [Deir el-Medina](https://en.wikipedia.org/wiki/Deir_el-Medina) | `egyptian/Deir_el-Medina.jpg` |
| 11 | Buhen fortress | Nubia, c. 1860 BC | over 150 m long, walls about 5 m thick and 10 m high, bastions, double row of arrow loops, 3 m deep ditch | [Buhen](https://en.wikipedia.org/wiki/Buhen) | - |

### 4.2 Silhouette rules

| Element | Real proportion | Model rule |
| --- | --- | --- |
| Pylon | 113 x 15 x 43 m: L : T : H = **7.5 : 1 : 2.9** (whole gate) | each tower: frustum base 0.30 x 0.10, top 0.25 x 0.07 (batter 0.83), h 0.30; gate between 0.08 wide, 0.22 high; cornice box 0.27 x 0.09 x 0.02 on top (flared lip) |
| Batter (all walls) | inward-sloping walls (pylons, mastabas, fortresses) | top face = 0.80 to 0.85 of bottom on the thin axis. This is the strongest "Egypt, not Greece" cue |
| Obelisk | slim shaft, ~10 : 1 height to base *unconfirmed* (common figure, not on the page) | frustum base 0.06, top 0.04, h 0.50; pyramidion 0.04 high in `extra` gold. Always in pairs in front of a pylon |
| True pyramid | h : base = 146.6 : 230.3 = **0.64** | base 0.70, h 0.45. Gold cap = top 0.08 of the height |
| Step pyramid | Djoser 62.5 : 115 avg = **0.54**, 6 steps | 6 boxes, base 0.80 x 0.72 to top 0.30, h 0.43 (reuse `Meso.pyramid(stripe=False)`) |
| Hypostyle | outer columns 10 m, nave 21 m: **1 : 2** | low hall box + raised central clerestory strip twice the hall height; 4 to 6 fat columns in front (r 0.025, flared lotus top) |
| Mastaba | length ≈ 4 x width, flat top, sloped sides | frustum 0.32 x 0.08 base, 0.28 x 0.06 top, h 0.06 |
| Houses | flat roofs, mudbrick, roof shelters, one street | box + small roof box (shade shelter) + dark door; rows, not scattered |
| Exaggerate | batter, obelisk height, gold caps, the pylon's width | |
| Drop | hieroglyphs, sphinx detail (sphinxes become 0.03 x 0.06 x 0.03 blocks), statues | |

**Palette (`PALETTES["egyptian"]`).**

| Slot | Hex | What |
| --- | --- | --- |
| wall | `#E6D3A3` | limestone, white Tura casing |
| stone | `#C8A26A` | sandstone (Karnak, Luxor) |
| roof | `#8A6A45` | mudbrick (houses, fort) |
| trim | `#2F6E9E` | lapis / painted band on cornices |
| dark | `#3A2C20` | doors, gate openings |
| extra | `#D4A93A` | gold pyramidion caps |
| team | nation colour | pylon flagstaff banners, cornice band, obelisk shaft stripe |

### 4.3 Per-kind specs

**capital: pylon + obelisk pair + sphinx avenue + hypostyle temple + pyramid** (~760 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| pylon | `pylon(w=0.62, t=0.10, h=0.32)` | front at y = -0.12 | stone, trim cornice band, dark gate |
| flagstaffs | 4 x `Base.flag` | poles h 0.42 against the pylon face at x = +/-0.08, +/-0.22 | team |
| obelisks | 2 x `obelisk` | base 0.05, h 0.40 at (+/-0.12, -0.30) | wall, extra cap |
| sphinx avenue | 6 x box | 0.03 x 0.06 x 0.03, two rows at x = +/-0.06, y = -0.36 to -0.48 | stone |
| hypostyle temple | `hypostyle(w=0.44, d=0.30, h=0.10, nave=0.20)` | at (0, 0.14) | stone, wall clerestory |
| enclosure | `ring(half=0.47, h=0.06, t=0.04)` battered, no crenels | mudbrick | roof |
| pyramid | `frustum(0.24, 0.24, 0, 0, 0.16)` + cap | at (0.33, 0.33) | wall, extra top 0.03 |

**city: walled mudbrick grid + small pylon temple + granaries** (~680 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| walls | `ring(half=0.46, h=0.10)` with battered wall pieces | t 0.06 | roof (mudbrick) |
| houses | 6 x `flat_house` | Base city spots; 0.20 x 0.18 x 0.10, roof shelter 0.08 x 0.08 x 0.03 on alternate ones | roof walls, wall shelter, dark doors |
| temple | `pylon(w=0.30, t=0.06, h=0.18)` + box 0.22 x 0.20 x 0.10 behind | at (0, 0.05) | stone, team flags x 2 |
| granaries | 3 x `lathe` beehive | r 0.04, h 0.08 at (0.18 to 0.30, -0.08) | roof |
| obelisk | `obelisk` | base 0.04, h 0.30 at (0, -0.18) | wall, extra |

**town: flat-roof houses round an obelisk** (~420 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| houses | 4 x `flat_house` at Base town spots | 0.24 x 0.20 x 0.10 | roof, wall shelter |
| obelisk | `obelisk` | base 0.05, h 0.45 at (0, 0) | wall, extra cap, team band 0.02 at mid-height |
| shrine | small `pylon(w=0.18, t=0.05, h=0.10)` | at (0, -0.22) | stone |
| palm (optional) | `cyl` + `cone` seg 5 | trunk r 0.008 h 0.12, crown r 0.05 h 0.03 at (0.12, 0.10) | dark trunk; the palette has no green, so skip it or add a green slot |

**temple: Giza-style pyramid with gold cap + valley chapel** (~300 tris). Choose the smooth pyramid,
not the step one: `mesoamerican` already owns the step pyramid read.

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| pyramid body | `frustum(w0=0.66, d0=0.66, w1=0.06, d1=0.06, h=0.38)` | centre (0, 0.03) | wall |
| gold cap | `frustum(0.06, 0.06, 0, 0, 0.04)` | on top | extra |
| base course | box | 0.70 x 0.70 x 0.02 | stone |
| mortuary chapel | `pylon(w=0.20, t=0.05, h=0.08)` + 2 flags | at (0, -0.33) | stone, team flags |
| causeway | box | 0.04 x 0.10 x 0.01 from chapel to pyramid face | stone |

**fort: Buhen-style battered mudbrick fortress** (~640 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| ditch | `poly_ring(sides=4, r_out=0.48, r_in=0.42, h=0.004)` | rotated 45 deg so it is square | dark |
| walls | 4 x `battered` wall pieces | half 0.34, t 0.07 -> 0.05 at top, h 0.18 | roof |
| bastions | 3 per side x `battered` box | 0.07 x 0.05 x 0.18, every 0.2 | roof |
| corner towers | 4 x `battered` | 0.11 x 0.11 x 0.24 | roof |
| gate | `pylon(w=0.22, t=0.08, h=0.24)` | at (0, -0.34) | stone, dark gate |
| keep | box + roof shelter | 0.18 x 0.16 x 0.12 | roof |
| flag | `Base.flag` | h 0.34 on the keep | team |

### 4.4 Kit additions (egyptian)

```python
def battered(self, x, y, z0, w, d, h, mat, k=0.83, rz=0.0):
    """Box with inward-sloping walls: top = k * bottom on both axes. Dzong, mastaba, fort, pylon."""
    self.frustum(x, y, z0, w, d, w * k, d * k, h, mat, rz=rz)

def pylon(self, x, y, w, t, h, mat="stone", gate_mat="dark", band="trim", rz=0.0):
    """Two battered towers flanking a lower gate, flared cornice on each. Front faces -y.
    About 70 tris."""
    tw = (w - w * 0.13) / 2                       # tower width; gate is 13 % of w
    with self.at(x, y, rz):
        for s in (-1, 1):
            cx = s * (w / 2 - tw / 2)
            self.battered(cx, 0, 0, tw, t, h, mat, k=0.84)
            self.box(cx, 0, h, tw * 0.88, t * 0.95, h * 0.07, band)        # cornice
        self.box(0, 0, 0, w * 0.15, t * 0.8, h * 0.72, mat)               # gate block
        self.box(0, -t * 0.42, 0, w * 0.07, 0.01, h * 0.55, gate_mat)     # doorway

def obelisk(self, x, y, base, h, mat="wall", cap="extra", band=None):
    self.frustum(x, y, 0, base, base, base * 0.66, base * 0.66, h, mat)
    self.frustum(x, y, h, base * 0.66, base * 0.66, 0, 0, base * 0.7, cap)
    if band:
        self.box(x, y, h * 0.45, base * 0.86, base * 0.86, 0.02, band)

def hypostyle(self, x, y, w, d, h, nave, cols=6, mat="stone", clere="wall"):
    """Hall with a raised central clerestory (2x height) and a front row of lotus columns."""
    self.box(x, y, 0, w, d, h, mat)
    self.box(x, y, h, nave, d * 0.9, h, clere)
    for k in range(cols):
        cx = x - w / 2 + (k + 0.5) * w / cols
        self.lathe(cx, y - d / 2 - 0.03, 0,
                   [(0.022, 0), (0.02, h * 0.85), (0.032, h * 0.97), (0.032, h)], mat, seg=6)

def flat_house(self, x, y, w, d, h, i, wall="roof", shelter="wall", door="dark", rz=0.0):
    with self.at(x, y, rz):
        self.box(0, 0, 0, w, d, h, wall)
        self.box(0, 0, h, w + 0.01, d + 0.01, 0.012, wall)                  # parapet line
        if i % 2 == 0:
            self.box(w * 0.22, d * 0.2, h + 0.012, w * 0.35, d * 0.35, 0.035, shelter)
        self.box(0, -d / 2 - 0.002, 0, w * 0.18, 0.004, h * 0.55, door)
```

---

## 5. `highland`

One geometry family, three palettes by region (`nation-identity.md` 2.4). Proposal: build
`highland` with the Himalayan palette and dzong pieces; add `highland_alpine` and
`highland_andean` as subclasses that only override `house()`, `tower()` and the palette (same
`Base` layouts, so 15 GLBs for the price of about 7 new functions).

### 5.1 Reference board

| # | Example | Place, date | What defines it | Source | Local image |
| --- | --- | --- | --- | --- | --- |
| 1 | Potala Palace | Lhasa, Tibet, 1645 to 1694 | about 400 x 350 m, rises 119 m above Marpo Ri hill (300 m above the valley), 13 storeys; inward-sloping stone walls 3 m thick, 5 m at the base; White Palace and central crimson Red Palace; gilded roof canopies | [Potala Palace](https://en.wikipedia.org/wiki/Potala_Palace) | `highland/Potala_Palace.jpg` |
| 2 | Punakha Dzong | Bhutan, 1637-38 | second-oldest and second-largest dzong; between two rivers | [Punakha Dzong](https://en.wikipedia.org/wiki/Punakha_Dzong) | `highland/Punakha_Dzong.jpg` |
| 3 | Dzong type | Bhutan and Tibet, peak 17th c. | inward-sloping white walls with few or no low windows, red ochre band near the top (sometimes gold circles), flared roofs on inner temples, central tower, courtyards; hilltop or spur siting with an uphill watchtower | [Dzong architecture](https://en.wikipedia.org/wiki/Dzong_architecture) | - |
| 4 | Paro Taktsang (Tiger's Nest) | Bhutan, 1692 | monastery clinging to a cliff face (temple read) | [Paro Taktsang](https://en.wikipedia.org/wiki/Paro_Taktsang) | `highland/Paro_Taktsang.jpg` |
| 5 | Svan towers, Ushguli and Mestia | Svaneti, Georgia, mainly 9th to 12th c. | about 3,500 towers; 3 to 5 storeys; walls thin and taper as they rise; about 20-25 m high on about 5 x 5 m *(height and base from travel guides, not the article: unconfirmed)*; 200+ in Chazhashi (Ushguli) | [Svan towers](https://en.wikipedia.org/wiki/Svan_towers), [Ushguli](https://en.wikipedia.org/wiki/Ushguli), [Advantour](https://www.advantour.com/georgia/mestia/svan.htm) | `highland/Ushguli.jpg` |
| 6 | Vainakh towers | Chechnya and Ingushetia, Caucasus | stone battle towers with a stepped pyramidal roof *(from general knowledge; page not read)* | [Vainakh tower architecture](https://en.wikipedia.org/wiki/Vainakh_tower_architecture) | - |
| 7 | Shibam | Hadhramaut, Yemen, present town from 1533 | about 500 mudbrick tower houses, 5 to 11 storeys, some over 30 m, inside a fortified wall | [Shibam](https://en.wikipedia.org/wiki/Shibam) | `highland/Shibam.jpg` |
| 8 | Old City of Sana'a | Yemen, mountain capital at about 2,300 m | rammed-earth and brick tower houses with white gypsum trim around windows *(colour detail unconfirmed on page)* | [Old City of Sana'a](https://en.wikipedia.org/wiki/Old_City_of_Sana%27a) | `highland/Old_City_of_Sana_a.jpg` |
| 9 | Andenes (Inca terraces), Machu Picchu and Moray | Andes, from 2000 BC, peak 1438 to 1533 | retaining walls about 2 m above the slope, planting surfaces about 3 m wide (Colca), cut stone at royal sites; Moray is concentric rings | [Andén](https://en.wikipedia.org/wiki/And%C3%A9n), [Machu Picchu](https://en.wikipedia.org/wiki/Machu_Picchu), [Moray](https://en.wikipedia.org/wiki/Moray_(Inca_ruin)) | `highland/Machu_Picchu.jpg`, `highland/Moray__Inca_ruin_.jpg` |
| 10 | Swiss chalet | Alpine Europe | timber, heavy gently sloping roof, wide well-supported eaves at right angles to the front; sometimes embedded in the slope | [Chalet](https://en.wikipedia.org/wiki/Chalet) | `highland/Chalet.jpg` |
| 11 | Civita di Bagnoregio | Lazio, Italy | Italian hill town: stone houses packed on top of an eroding tuff butte, one campanile, single bridge access | [Civita di Bagnoregio](https://en.wikipedia.org/wiki/Civita_di_Bagnoregio) | `highland/Civita_di_Bagnoregio.jpg` |

### 5.2 Silhouette rules

| Element | Real proportion | Model rule |
| --- | --- | --- |
| Rock base / hill | Potala sits 119 m on a 300 m hill; dzongs on spurs | every highland model stands on a **rock**: irregular 7-sided `hill()` 0.10 to 0.30 high. It is what makes "mountain" read even on flat globe tiles |
| Dzong wall | Potala W : H = 400 : 119 = **3.4 : 1**; wall 5 m at base, 3 m at top | battered blocks, k = 0.85; white walls; **red band** = top 18 % of the wall height, `trim`; few windows: 1 row of tiny dark boxes only in the top third |
| Dzong roof | gilded canopies, flared roofs | flat main roof; central tower gets a low flared roof: frustum that widens outward 1.25x then a gold pyramid cap (`extra`) |
| Terraces | riser about 2 m, tread about 3 m: **riser : tread = 2 : 3** | 3 to 4 steps: riser 0.05 `stone`, tread 0.075 shown as a thin `extra` (green) top on each step |
| Svan / Caucasus tower | about 20-25 m high on about 5 x 5 m: **H : W = 4.5 : 1**; tapering | `tower_house(base 0.08, top 0.065, h 0.36)`, shallow pyramid slate roof 0.03, 1 dark slot window per face near the top |
| Yemeni tower house | 5 to 11 storeys, up to 30 m | box 0.12 x 0.12 x 0.30 to 0.42, white top band 0.03 and dark window dots in 3 rows (Himalayan-desert palette variant) |
| Chalet | gently sloping roof, very wide eaves | box 0.18 x 0.14 x 0.10 (stone lower 0.04, timber upper); gable pitch 0.04 (about 24 deg) with **overhang 0.04 to 0.05** (2x the kit default); gable end faces -y |
| Andean house | stone walls, steep thatch | stone box 0.16 x 0.12 x 0.07; steep gable 0.08 (about 45 deg), thatch colour |
| Hill town | houses packed on a butte, one campanile | houses clustered within r 0.25 on a flat-topped `hill()`; tower 0.06 x 0.06 x 0.34 |
| Exaggerate | the rock, the batter, the red band, roof overhang | |
| Drop | windows below the band, balconies, prayer-wheel detail, individual terraces beyond 4 | |

**Palettes.**

| Slot | `highland` (Himalayan) | `highland_alpine` | `highland_andean` |
| --- | --- | --- | --- |
| wall | `#F2EEE4` whitewash | `#E8E0D0` plaster | `#8C8273` granite |
| stone | `#8D8578` rock | `#7E7A72` rock | `#6E665A` rock |
| roof | `#4A3A2E` dark timber roof | `#5B5F66` slate | `#B5843A` thatch |
| trim | `#8E2A1E` ochre-red band | `#6B4A2E` timber | `#A0522D` adobe red |
| dark | `#2A2220` windows | `#2A2220` | `#2A2220` |
| extra | `#D4A93A` gold roof | `#6F8F4E` pasture | `#6F8F4E` terrace green |
| team | prayer flags, roof banner | shutters stripe, flag | woven banner, roof ridge |

### 5.3 Per-kind specs (Himalayan geometry; alpine/andean swap `house` and `tower`)

**capital: dzong on three terraces** (~760 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| rock | `hill(r=0.50, h=0.10, seg=7)` | centre | stone |
| terraces | `terraces(n=3, w0=0.92, step=0.08, riser=0.05)` | on z 0.10, stepping back toward +y (front at -y is lowest) | stone risers, extra treads |
| dzong ring | 4 x `battered` wall | half 0.30, t 0.08, h 0.18 on top terrace, k 0.85 | wall |
| red band | `band()` round the top | 0.032 high at the top of each wall | trim |
| inner tower (utse) | `battered` 0.20 x 0.20 x 0.30 + `band` | centre | wall, trim |
| flared roof | `flared_roof(w=0.20, h=0.06)` + gold cap `frustum` | on the tower | roof, extra |
| windows | 4 rows x 3 dark boxes | 0.02 x 0.004 x 0.025 on the tower top third, front face only | dark |
| prayer flags | `prayer_flags(n=6)` | from the tower top to a pole at (0.38, -0.38) | team |

**city: houses stepped up four terraces + watchtower** (~720 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| rock | `hill(r=0.50, h=0.06)` | | stone |
| terraces | `terraces(n=4, step=0.10, riser=0.06)` | stepping to +y | stone, extra |
| houses | 6 x `house` (battered whitewashed box + band + flat roof) | 0.14 x 0.12 x 0.10, one or two per terrace | wall, trim, roof |
| watchtower | `tower_house` | base 0.09, h 0.34 on the top terrace at (0.30, 0.34) | wall, trim band |
| monastery hall | `battered` 0.24 x 0.14 x 0.14 + flared roof | top terrace centre | wall, roof, extra |
| flags | `prayer_flags(n=5)` | across the middle | team |

**town: four houses on two terraces + stupa or chorten** (~480 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| rock + terraces | `hill(0.45, 0.05)` + `terraces(n=2)` | | stone, extra |
| houses | 4 x `house` at Base town spots, raised by terrace height | Himalayan: battered box + band; alpine: `chalet`; andean: stone + thatch | per palette |
| chorten | box 0.10 + `lathe` dome r 0.05 + cone spire 0.08 | centre | wall, extra spire |
| flag | `Base.flag` on a pole | h 0.25 | team |

**temple: cliff monastery (Tiger's Nest)** (~560 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| cliff | `frustum` 0.60 x 0.40 -> 0.40 x 0.25, h 0.75, top offset oy = +0.06; plus `hill(0.35, 0.08)` at the foot | back half of the footprint | stone |
| ledges | 3 x box | 0.30 x 0.10 x 0.02 at z 0.25, 0.42, 0.58 on the cliff's -y face | stone |
| buildings | 3 x `battered` + band + `flared_roof` | 0.16 x 0.10 x 0.10 on each ledge | wall, trim, roof (gold cap on the top one) |
| path | 4 x box | 0.03 wide stairs zig-zagging up the face | stone |
| prayer flags | `prayer_flags(n=6)` | from the top roof to a pole at (0.30, -0.30) | team |

**fort: pass gate between two rocks + Svan towers** (~600 tris)

| Part | Primitive(s) | Size / position | Material |
| --- | --- | --- | --- |
| rocks | 2 x `hill(r=0.22, h=0.45, seg=6)` | at x = +/-0.28 | stone |
| gate block | `battered` 0.26 x 0.14 x 0.26 spanning the notch + dark doorway | at (0, 0) | wall, dark |
| band | `band` | top 0.04 of the gate block | trim |
| towers | 2 x `tower_house` | base 0.09, h 0.40, one on each rock top | wall, roof |
| flag | `Base.flag` | h 0.25 on the gate | team |

### 5.4 Kit additions (highland)

```python
def hill(self, x, y, r, h, mat="stone", seg=7, jag=0.18, seed=0):
    """Irregular rock mound: a lathe-like solid with per-vertex radius jitter (hsh from styles_defs).
    Built with _poly so it can be non-circular. About 3*seg*2 + seg tris for 3 rings."""
    rings = []
    for k, (rf, zf) in enumerate([(1.0, 0.0), (0.78, 0.6), (0.45, 1.0)]):
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            j = 1.0 + jag * (hsh(seed + i * 7 + k) - 0.5)
            ring.append((r * rf * j * math.cos(a), r * rf * j * math.sin(a), h * zf))
        rings.append(ring)
    faces = [list(reversed(rings[0])), rings[-1]]
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            faces.append([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
    self._poly(faces, self._m(x, y, 0, (0, 0, 0)), mat)

def terraces(self, x, y, z0, w0, d0, n, step, riser, mat="stone", top="extra", back=True):
    """Stacked shrinking platforms. back=True steps them toward +y (hillside), else concentric.
    Each level: riser box + a 0.006 green tread on top. Returns top z."""
    z = z0
    for i in range(n):
        w, d = w0 - (0 if back else 2 * i * step), d0 - 2 * i * step
        cy = y + (i * step if back else 0)
        self.box(x, cy, z, w, d, riser, mat)
        self.box(x, cy, z + riser, w - 0.01, d - 0.01, 0.006, top)
        z += riser
    return z

def band(self, x, y, z, w, d, h, mat="trim", proud=0.004):
    """Coloured band around a block (dzong kemar band, Yemeni white top)."""
    self.box(x, y, z, w + 2 * proud, d + 2 * proud, h, mat)

def flared_roof(self, x, y, z, w, h, mat="roof", cap="extra", flare=1.25):
    """Low roof that widens outward (Himalayan): inverted frustum lip, then a small gold pyramid."""
    self.frustum(x, y, z, w, w, w * flare, w * flare, h * 0.35, mat)
    self.frustum(x, y, z + h * 0.35, w * flare, w * flare, 0, 0, h * 0.65, mat)
    self.frustum(x, y, z + h * 0.8, w * 0.25, w * 0.25, 0, 0, h * 0.5, cap)

def tower_house(self, x, y, z0, base, h, top=0.8, wall="wall", roof="roof", win="dark"):
    """Svan / Vainakh / Yemeni tower: tapering square shaft, slot windows, shallow pyramid roof."""
    self.frustum(x, y, z0, base, base, base * top, base * top, h, wall)
    for s in (-1, 1):
        self.box(x, y + s * base * top / 2, z0 + h * 0.82, base * 0.25, 0.006, h * 0.08, win)
    self.frustum(x, y, z0 + h, base * top + 0.012, base * top + 0.012, 0, 0, base * 0.35, roof)

def chalet(self, x, y, w, d, h, i, rz=0.0):
    with self.at(x, y, rz):
        self.box(0, 0, 0, w, d, h * 0.4, "stone")                 # stone ground storey
        self.box(0, 0, h * 0.4, w, d, h * 0.6, "trim")            # timber upper
        self.box(0, -d / 2 - 0.02, h * 0.55, w * 0.85, 0.04, 0.008, "trim")   # balcony
        self.gable(0, 0, h, d, w, d * 0.28, "team" if i % 2 == 0 else "roof",
                   rz=math.pi / 2, over=0.045)                    # ridge front-to-back, wide eaves

def prayer_flags(self, x0, y0, z0, x1, y1, z1, n, mat="team"):
    """String of n small flags hanging on a straight line (no sag: too small to see)."""
    for k in range(n):
        t = (k + 0.5) / n
        self.box(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t - 0.02,
                 0.02, 0.004, 0.02, mat)
```

---

## 6. Bronze age: reuse `egyptian` + Mesopotamian pieces

There is no `mesopotamian` set today; `desert` covers the Near East and uses a ziggurat for the
bronze-age temple (`building-styles.md` 2.4). A bronze-age set (`bronze_age`, for non-Egyptian
bronze nations: Sumer, Hittites, Mycenaeans, Indus) needs only three new pieces on top of
`egyptian`.

| # | Example | Place, date | What defines it | Source | Local image |
| --- | --- | --- | --- | --- | --- |
| 1 | Ziggurat of Ur | Iraq, c. 2040 to 2000 BC | base 64 x 45 m, over 30 m high (speculative), mudbrick core, burnt-brick facing set in bitumen, monumental front staircase | [Ziggurat of Ur](https://en.wikipedia.org/wiki/Ziggurat_of_Ur) | `bronze_age/Ziggurat_of_Ur.jpg` |
| 2 | Etemenanki | Babylon, 6th c. BC | the seven-stage ziggurat ("Tower of Babel") | [Etemenanki](https://en.wikipedia.org/wiki/Etemenanki) | `bronze_age/Etemenanki.jpg` |
| 3 | Hattusa | Anatolia, c. 1650 to 1180 BC | 1.8 km2, walls over 6 km long, double wall 3 m + 2 m gap + 3 m = 8 m thick; Lion Gate; Büyükkale citadel on a ridge | [Hattusa](https://en.wikipedia.org/wiki/Hattusa) | `bronze_age/Hattusa.jpg` |
| 4 | Mycenae, Lion Gate | Greece, c. 1250 BC | gate 3.10 m wide, 2.95 m high; lintel 4.5 x 2.0 x 0.8 m; relieving triangle 3.6 m base with lion relief; cyclopean walls | [Lion Gate](https://en.wikipedia.org/wiki/Lion_Gate), [Mycenae](https://en.wikipedia.org/wiki/Mycenae) | `bronze_age/Lion_Gate.jpg`, `bronze_age/Mycenae.jpg` |
| 5 | Tiryns / cyclopean masonry | Greece, Late Bronze Age | walls of huge unworked boulders, gaps filled with small stones | [Cyclopean masonry](https://en.wikipedia.org/wiki/Cyclopean_masonry), [Tiryns](https://en.wikipedia.org/wiki/Tiryns) | `bronze_age/Cyclopean_masonry.jpg` |
| 6 | Mohenjo-daro | Indus, c. 2500 to 1700 BC | 250 ha, at least 40,000 people; citadel mound about 12 m high; Great Bath 12 x 7 x 2.4 m; mostly fired brick; courtyard houses opening onto side lanes; grid plan (street widths not on the page) | [Mohenjo-daro](https://en.wikipedia.org/wiki/Mohenjo-daro), [Great Bath](https://en.wikipedia.org/wiki/Great_Bath,_Mohenjo-daro) | `bronze_age/Mohenjo-daro.jpg` |

Reuse plan:

| Kind | Build from |
| --- | --- |
| capital | `terraces(back=False)` as a citadel mound (Mohenjo-daro / Büyükkale) + `ziggurat()` on top + `flat_house` grid below + a `cyclopean_wall` ring |
| city | `flat_house` grid on a strict 3 x 3 street grid (Indus) inside `ring` + a sunken bath box (`trim` blue water) |
| town | 4 `flat_house` + small `ziggurat(n=2)` shrine |
| temple | `ziggurat(n=3)`: base 0.80 x 0.56 (64 : 45 = 1.42 : 1), tiers shrink 0.18 each side, h 0.12 per tier, a front stair box at 0 deg pitch 35 deg, shrine box on top in `team`-roofed `wall` |
| fort | `cyclopean_wall` ring with a `lion_gate` (two jamb boxes + lintel + triangle) and `tower_house` towers |

```python
def ziggurat(self, x, y, w, d, n, th, shrink=0.18, mat="roof", face="stone", stair=True, top="team"):
    z = 0
    for i in range(n):
        self.box(x, y, z, w - 2 * i * shrink * w / 2, d - 2 * i * shrink * d / 2, th, face if i % 2 else mat)
        z += th
    if stair:   # one ramp up the -y face, the Ur read
        L = math.hypot(d / 2, z)
        self.box(x, y - d / 4 - 0.03, z / 2, w * 0.12, L, 0.02, face, rot=(math.atan2(z, d / 2), 0, 0))
    self.box(x, y, z, w * 0.2, d * 0.2, th * 0.8, "wall")
    self.gable(x, y, z + th * 0.8, w * 0.2, d * 0.2, th * 0.4, top)

def cyclopean_wall(self, x, y, L, rz, h, t, mat="stone", seed=0):
    """Wall from uneven boulders: 4 to 6 boxes of jittered size, slight random tilt. 12 tris each."""
    with self.at(x, y, rz):
        n = max(4, int(L / 0.12)); u = L / n
        for k in range(n):
            j = hsh(seed + k)
            self.box(-L / 2 + (k + 0.5) * u, 0, 0, u * (1.0 + 0.2 * j), t * (1.0 + 0.3 * j),
                     h * (0.85 + 0.3 * j), mat, rot=(0, 0, (j - 0.5) * 0.2))

def lion_gate(self, x, y, w, h, t, mat="stone", relief="team"):
    for s in (-1, 1):
        self.box(x + s * w * 0.35, y, 0, w * 0.3, t, h, mat)
    self.box(x, y, h, w, t, h * 0.25, mat)                               # lintel
    self.frustum(x, y, h * 1.25, w * 0.5, t * 0.6, 0, t * 0.6, h * 0.35, relief)   # relieving triangle
```

Note: `hsh` lives in `styles_defs.py`; move it to `styles_kit.py` (or import it) before `hill()`
and `cyclopean_wall()` can use it.

---

## 7. Build order and cost

| Order | Set | New kit functions | Est. tris per model | Why this order |
| --- | --- | --- | --- | --- |
| 1 | `soviet_bloc` | `bands`, `strips`, `panel_slab`, `setback_tower`, `star`, `stack_cross`, `chimney`, `dish`, `lattice_mast` (+ `rot` on `lathe`) | 420 to 820 | half of the Cold War contrast |
| 2 | `western_modern` | `curtain_tower`, `colonnade`, `drum_dome`, `suburb_house`, `poly_ring` (reuses `bands`, `strips`, `setback_tower`) | 520 to 900 | the other half |
| 3 | `egyptian` | `battered`, `pylon`, `obelisk`, `hypostyle`, `flat_house` | 300 to 760 | every bronze-age prompt |
| 4 | `highland` (+ alpine, andean palettes) | `hill`, `terraces`, `band`, `flared_roof`, `tower_house`, `chalet`, `prayer_flags` | 480 to 760 | mountain nations |
| 5 | `bronze_age` (optional) | `ziggurat`, `cyclopean_wall`, `lion_gate` | 400 to 700 | reuses 3 and 4 |

All estimates are under the 1,000 aim and well under the 1,500 cap. Run `verify_styles.py` after
each set; `curtain_tower` with `ribs=4` is the most expensive piece (about 160 tris), so cap a
model at five of them.

## Gaps and unconfirmed items

- Khrushchyovka **length** (60-80 m) and depth: not on the Wikipedia page; estimated from four
  sections. Brezhnevka series names, balcony layout and plan sizes: not on the page.
- Seven Sisters tier and spire proportions: estimated from photos; the article gives only heights.
- Svan tower height (20-25 m) and 5 x 5 m base: from travel guides, not the Wikipedia article.
- Obelisk 10 : 1 ratio, Capitol building length (229 m), curving Levittown streets, Vainakh
  stepped roofs and Sana'a gypsum trim: general knowledge, not confirmed on a read page.
- Mohenjo-daro street widths and grid orientation: not on the page.
- Some lead images are poor references (Levittown is a locator map; Hypostyle and Microdistrict
  are generic). Look up better photos by hand on Wikimedia Commons if needed.
