# Nation identity: look, sound and feel

Research for making every nation feel specifically different. Written 2026-11-14.
Builds on [`building-styles.md`](building-styles.md) (6 built styles x 5 kinds, owner-approved)
and the shared code in `packages/shared/src/sim/style.ts` and `packages/shared/src/types.ts`.
Nothing here changes a contract by itself: new fields or model sets need a `needs-owner` issue.

## 1. The identity model

One pure function, `nationIdentity(world, country) -> Identity`, deterministic from data we
already have. Five inputs, each reduced to a small enum, then looked up in the tables below.

```
Identity = { era, region, gov, terrain, mood,         // the five keys
             modelSet, palette, placement, density,   // look (sections 2, 3)
             sound, flag, tone }                      // sound and feel (sections 4, 5)
```

### 1.1 Inputs to enums (first match wins in every table)

**Era band** from `World.era` (lowercased string match):

| `era` | Keywords in `World.era` or `World.prompt` |
| --- | --- |
| `post_apoc` | post-apocalyptic, wasteland, fallout, ruined, drowned |
| `future` | space, sci-fi, cyberpunk, future, star, galactic |
| `modern` | modern, cold war, 20th, 21st, atomic, contemporary |
| `industrial` | industrial, steam, victorian, 19th, railway, steampunk |
| `gunpowder` | renaissance, gunpowder, colonial, age of sail, early modern, 16th to 18th |
| `medieval` | medieval, feudal, dark age, crusade, viking, knights |
| `classical` | classical, antiquity, iron age, roman, hellenic, republic of |
| `bronze` | bronze, stone age, neolithic, pharaoh, chariot, dawn |
| `medieval` | default (also the default in `style.ts`) |

Order matters: `post_apoc` before `future` before `modern`, so "post-apocalyptic future" reads as ruins.
Store the index too (`bronze=0 ... future=6`, `post_apoc=7`) for "era >= industrial" rules.

**Government type** from `government + ideology` (lowercased):

| `gov` | Keywords |
| --- | --- |
| `communist` | communist, soviet, socialist, collective, people's, worker, proletar, commune, party |
| `junta` | junta, military, martial, warlord, general, garrison, praetor, stratocra |
| `theocracy` | theocra, church, temple, priest, holy, faith, divine, prophet, caliphate, oracle |
| `merchant` | merchant, trade, guild, mercantile, company, bank, plutocra, league |
| `democracy` | democra, republic, senate, parliament, council of citizens, liberal, federation |
| `monarchy` | king, queen, crown, empire, emperor, monarch, dynasty, throne, sultan, shah, pharaoh |
| `tribal` | tribe, clan, chief, horde, khan, herder, band, elders (or `nomadic: true`) |
| `technocracy` | technocra, ai, machine, algorithm, engineer, corporate, syndicate |
| fallback | `monarchy` if aggression > 0.6, else `tribal` if era <= bronze, else `monarchy` |

`communist` sits above `democracy` so "People's Republic" lands as communist. `theocracy` above
`monarchy` so "Holy Empire" is a theocracy.

**Dominant terrain** of the nation's own provinces (`Tile.terrain`, skip `ocean`):

| `terrain` | Rule (shares of owned land tiles) |
| --- | --- |
| `mountain` | mountain + hills >= 40% |
| `coast` | coast >= 35%, or capital tile is coast |
| `ice` | ice >= 30% |
| `desert` | desert >= 40% |
| `forest` | forest >= 40% |
| `plains` | otherwise |

Recompute only when the nation's tile count changes by 25% (avoids flicker during wars).

**Mood** from `temperament` (pick the largest; ties broken in this order):
`aggression -> martial`, `faith -> pious`, `trade -> wealthy`, `expansion -> pioneer`.

**Region** is `country.buildingStyle` (already picked by Gemini or `pickBuildingStyle`).

### 1.2 Model set (look)

| # | Condition | `modelSet` |
| --- | --- | --- |
| 1 | `era = post_apoc` | `scrap` (existing) |
| 2 | `gov in {communist, junta}` and `era >= industrial` | `soviet_bloc` (new) |
| 3 | `gov in {democracy, merchant, monarchy, technocracy}` and `era >= industrial` | `western_modern` (new) |
| 4 | `era = bronze` and `region in {desert, sahel}` or culture has pharaoh, nile, sun-god | `egyptian` (new) |
| 5 | `terrain = mountain` and `era <= gunpowder` and region not `mesoamerican` | `highland` (new) |
| 6 | otherwise | `STYLE_FALLBACK[region]` (existing 6 sets) |

Rows 2 to 5 fall back to row 6 until their GLBs exist (same chain `models.ts` already uses).
So the Sahara reads `egyptian` in the bronze age and `desert` (Islamic/Sahel) from the medieval
era on, exactly as asked. A `theocracy` in a modern world stays on its region set but gets the
theocracy palette and props (section 3), which keeps the cathedral and temple read.

### 1.3 Everything else

Palette, props and placement come from `gov` and `terrain` (section 3). Density and height come
from `era` (section 3). Sound comes from `era` (instruments) plus `gov` (form and voice)
(section 4). Flag, units and chronicle tone come from `gov` and `era` (section 5).
**Two nations with the same `region` still differ** on at least `gov`, `terrain` or `mood`;
the diversity rule in `style.ts` already spreads `region`.

## 2. New model sets (on top of the 30)

Recommend **4 sets x 5 kinds = 20 models**, built from the same Blender kit layouts
(town = 4 houses + landmark, and so on, `building-styles.md` section 4). Do them in this order;
stop after 2 if time is short. `soviet_bloc` and `western_modern` give the biggest Cold War
contrast in any modern prompt; `egyptian` covers every bronze-age prompt.

### 2.1 `soviet_bloc` (communist or junta, industrial era and later)

- **Silhouette:** long flat-roof 5-storey slab blocks with a grid of panel seams
  ([Khrushchyovka](https://en.wikipedia.org/wiki/Khrushchyovka): 4 to 5 storeys, precast panels,
  plain rectangular "boxes", 1956 to 1970s); a stepped "wedding cake" tower with a spire and star
  ([Stalinist architecture](https://en.wikipedia.org/wiki/Stalinist_architecture): stepped tiers,
  spires with Soviet emblems, monumental symmetry); raw angular concrete
  ([Brutalism](https://en.wikipedia.org/wiki/Brutalist_architecture): bare concrete, monochrome).
- **Palette:** `#A8A8A0` panel concrete, `#6E6E68` dark concrete, `#C9B79A` Stalinist sandstone,
  `#B22222` banner red (team), `#D4A93A` star gold.
- **Team:** spire star, rooftop banners, one stripe on the slab end wall.

| Kind | Model |
| --- | --- |
| capital | seven-tier wedding-cake tower with spire and star, two slab wings, parade square |
| city | 3 parallel 5-storey slabs + 1 brutalist tower + chimney |
| town | 2 slabs in an L, small cultural palace box with columns |
| temple | brutalist "palace of culture" or monument: wedge-shaped concrete hall + tall obelisk |
| fort | concrete bunker, radar dish, flagpole, low blast wall |

### 2.2 `western_modern` (democracy, merchant, monarchy, technocracy; industrial and later)

- **Silhouette:** glass curtain-wall towers ([International Style](https://en.wikipedia.org/wiki/International_Style_(architecture)),
  [skyscraper](https://en.wikipedia.org/wiki/Skyscraper)); a white domed neoclassical civic
  building ([Neoclassical architecture](https://en.wikipedia.org/wiki/Neoclassical_architecture));
  pitched-roof suburban houses ([Suburb](https://en.wikipedia.org/wiki/Suburb)).
- **Palette:** `#7FB6CC` glass, `#3E5566` dark glass, `#EDE6D6` white stone, `#9A6B4F` brick,
  `#5E8C4A` lawn.
- **Team:** flag on the dome, tower crown strip, awnings.

| Kind | Model |
| --- | --- |
| capital | white dome on a colonnade (capitol) + 3 glass towers of different heights |
| city | cluster of 4 glass towers, one with a spire, plus brick mid-rises |
| town | 6 pitched-roof houses in a curved street + a clock-tower town hall |
| temple | tall glass-and-steel spired church or a stock-exchange hall with columns (merchant) |
| fort | low star-fort turned airbase: hangar half-cylinder, control tower, radar |

### 2.3 `egyptian` (bronze-age desert or Sahel, pharaoh cultures)

- **Silhouette:** pylon gate (two tapered towers with sloping walls), obelisks, pyramids, flat-roof
  mudbrick houses, hypostyle columns
  ([Ancient Egyptian architecture](https://en.wikipedia.org/wiki/Ancient_Egyptian_architecture):
  pylons, obelisks, hypostyle halls, mastabas, thick sloping walls, mud brick and limestone;
  [Pylon](https://en.wikipedia.org/wiki/Pylon_(architecture)),
  [Egyptian pyramids](https://en.wikipedia.org/wiki/Egyptian_pyramids)).
- **Palette:** `#E6D3A3` limestone, `#C8A26A` sandstone, `#8A6A45` mudbrick, `#2F6E9E` lapis,
  `#D4A93A` gold cap.
- **Team:** pylon banner poles (Egyptian pylons really had flagstaff niches), obelisk cap.

| Kind | Model |
| --- | --- |
| capital | pylon gate + avenue of 2 obelisks + temple box behind; one pyramid to the side |
| city | mudbrick grid + small pylon temple + granary domes |
| town | flat-roof houses round a single obelisk |
| temple | step pyramid (Djoser style) or true pyramid with gold cap |
| fort | rectangular mudbrick fortress with sloping walls and square corner towers |

### 2.4 `highland` (mountain nations, pre-industrial)

One set, three palettes by region, so the same 5 models read Tibetan, Andean or Alpine.

- **Silhouette:** tall battered (inward-sloping) whitewashed walls with a red band, on a ridge
  ([Dzong architecture](https://en.wikipedia.org/wiki/Dzong_architecture): sloping windowless lower
  walls, white with a red ochre band, hilltop siting, inner tower);
  stair-step stone terraces ([Andén](https://en.wikipedia.org/wiki/And%C3%A9n): stepped retaining
  walls following the slope); wide-eaved timber chalets
  ([Chalet](https://en.wikipedia.org/wiki/Chalet): wood, heavy shallow roof, wide eaves).
- **Palettes:** Himalayan (`east_asian`, `south_asian`, `desert`): `#F2EEE4` white, `#8E2A1E` ochre red,
  `#D4A93A` gold. Andean (`mesoamerican`): `#8C8273` granite, `#6F8F4E` terrace green, `#B5543A` thatch.
  Alpine (`medieval`, `norse`, `classical`): `#6B4A2E` timber, `#E8E0D0` plaster, `#5B5F66` slate.
- **Team:** prayer-flag strings or banners, roof band.

| Kind | Model |
| --- | --- |
| capital | dzong: tall sloping-wall block with central tower and flared roof, on 3 terraces |
| city | houses stepped up 4 terrace levels, one watchtower |
| town | 4 chalets or stone houses on 2 terraces |
| temple | monastery block clinging to a cliff face (base is an angled rock) |
| fort | narrow-pass gate tower spanning a notch between two rocks |

### 2.5 Blender kit pieces to add (on top of the shared kit)

| Piece | Used by | Notes |
| --- | --- | --- |
| panel slab (box with seam grid via 2 loop-cut rows) | soviet_bloc | 3 lengths; seams as darker vertex colour, not geometry |
| setback tower (3 to 7 stacked shrinking boxes + spire) | soviet_bloc, western_modern | one parametric piece: tiers, shrink, spire on/off |
| glass tower (box, glass material, roof crown) | western_modern | 3 heights |
| dome on drum (half sphere + cylinder + colonnade ring) | western_modern | reuse desert dome |
| pitched-roof house | western_modern | reuse medieval steep gable at low pitch |
| pylon (two tapered boxes + lintel) | egyptian | taper by scaling top face 0.8 |
| obelisk (tall tapered box + pyramid cap) | egyptian, soviet_bloc monument | |
| pyramid (4-sided cone) / step pyramid (reuse mesoamerican stack) | egyptian | |
| battered block (box, top face scaled 0.85) + band | highland, egyptian fort | one piece covers dzong, mastaba, fortress |
| terrace ring (stacked shrinking boxes or rings) | highland | also usable under any capital on mountains |
| chalet roof (shallow gable, wide overhang) | highland alpine | |

Budget about 20 models at about 10 minutes each with the scripted kit; same tri budget (< 1,500).

## 3. Lane b without new models

All of these work on the existing `StructureField` instancing: non-team parts take `tintOf(owner)`,
team parts take `colorOf(owner)`. The change is to make `tintOf` and the size logic read
`Identity` instead of a hash.

### 3.1 Wall and roof tint by government (replace the hash tint)

`tint = lerp(white, govTint, strength) * (0.95 + 0.1 * hash01(owner))`, keep a small hash so
two nations of one type still differ.

| `gov` | `govTint` | strength | Team (banner) override | Read |
| --- | --- | --- | --- | --- |
| `communist` | `#9A9A94` concrete grey | 0.55 | keep nation colour, but if hue is within 30 deg of red push to `#C0262D` | grey blocks, red banners |
| `junta` | `#7A7A5C` olive drab | 0.5 | darken nation colour 25% | khaki, grim |
| `theocracy` | `#F2E6C8` warm white | 0.4 | add gold: lerp team to `#D4A93A` by 0.35 | white and gold |
| `democracy` | `#F0F0EC` marble white | 0.45 | none | clean, bright |
| `merchant` | `#C98A5A` warm brick | 0.4 | none | rich, warm |
| `monarchy` | `#E3D2A8` sandstone | 0.3 | lerp team to `#D4A93A` by 0.2 | regal |
| `tribal` | `#9C7A55` wood and hide | 0.45 | desaturate 20% | earthy |
| `technocracy` | `#BFD8E6` cold steel blue | 0.45 | raise lightness 15% | cool, clinical |

Era overlay on top: `post_apoc` multiply by `#B08A6A` (rust) 0.3; `bronze` multiply by `#E6CFA0` 0.2.

### 3.2 Height and density by era

`hy` (height stretch) and the number of satellite buildings (`sats`) around towns, cities and
capitals.

| `era` | `hy` mult | sats per city / capital | Extra prop | Smoke |
| --- | --- | --- | --- | --- |
| `bronze` | 0.75 | 1 / 2 | none | none |
| `classical` | 0.85 | 2 / 3 | statue on capital | none |
| `medieval` | 1.0 | 2 / 4 | none | thin hearth smoke on capital |
| `gunpowder` | 1.0 | 3 / 4 | windmill near farms | thin |
| `industrial` | 1.15 | 4 / 6 | smokestack per city | dark grey, 2 puffs |
| `modern` | 1.35 | 5 / 7 | radio mast on capital | light grey, 1 puff |
| `future` | 1.6 | 5 / 7 | glowing ring on capital (emissive team colour) | none |
| `post_apoc` | 0.9, random lean 5 to 12 deg | 3 / 4 | burning barrel | black, 3 puffs |

Keep `MAX_SIZE` as the hard cap so tall eras never tower over mountains.

### 3.3 Terrain-aware placement (per structure tile)

| Tile terrain | Placement rule | Parameters |
| --- | --- | --- |
| `mountain` | step satellites up-slope in rings; sink base into the tile | ring radius 0.35 tile, each ring +0.15 height, base sink 0.1 |
| `hills` | 2 levels of steps | +0.08 per ring |
| `coast` | pull satellites toward the shoreline edge; ports face the water | bias 0.3 toward nearest ocean neighbour centroid |
| `forest` | thin satellites (0.7x), scatter 2 extra trees between them | reuse `Trees.ts` |
| `desert` | tight cluster (spacing 0.6x), flat-top only | |
| `ice` | 0.8x scale, cluster tight, white tint lerp 0.25 | |
| marsh (coast + forest neighbour, or flag) | stilts: lift 0.06, add 4 thin posts | only for town and smaller |

### 3.4 Props (instanced, under 100 tris each)

| Prop | Who gets it | Where |
| --- | --- | --- |
| tall red banner pair (`team`) | `communist`, `junta` | either side of capital and forts |
| gold-capped spire or bell | `theocracy` | on every temple; temples scaled 1.25x |
| statue on plinth | `monarchy`, `democracy` | capital square |
| obelisk / victory column | `junta`, `communist`, bronze-era `monarchy` | capital |
| crane and stacked crates | `merchant` | ports and coastal cities |
| watchtower | `mood = martial` | 1 per border province with a structure |
| standing stones ring | `tribal`, era <= bronze | villages |

### 3.5 Lighting and colour grade when a nation is selected

Applied through `colorFx.ts` as a short (0.6 s) lerp, only while the nation is selected.

| `gov` | Exposure | Saturation | Tint (multiply) | Extra |
| --- | --- | --- | --- | --- |
| `communist` | 0.95 | 0.7 | `#E8E4DC` | slight red rim light |
| `junta` | 0.9 | 0.6 | `#DCD8C4` | vignette 0.25 |
| `theocracy` | 1.08 | 1.0 | `#FFF1D0` gold | bloom +0.2 on temples |
| `democracy` | 1.05 | 1.05 | `#F4F8FF` | none |
| `merchant` | 1.0 | 1.15 | `#FFEFD8` | none |
| `monarchy` | 1.0 | 1.1 | `#FFF0DC` | none |
| `tribal` | 0.98 | 0.9 | `#F2E2C8` | none |
| `technocracy` | 1.02 | 0.85 | `#DDEEFF` | none |

`post_apoc` era adds a sepia `#D9C2A0` multiply to every nation. Keep all values mild: the globe
still has to read for the other nations.

## 4. Sound identity for lane a

ElevenLabs music follows explicit BPM and key, names of instruments beat genre labels, and
prompts should cover genre, mood, instrumentation, tempo and production era; vocals are on by
default, "instrumental only" removes them
([ElevenLabs music best practices](https://elevenlabs.io/docs/overview/capabilities/music/best-practices)).
So build every prompt as:

```
anthem = `${govForm} national anthem of ${name}, ${eraInstruments}, ${govVocals}, ${tempo} BPM,
          in ${key}, ${eraProduction}, sung ${languageFeel}, about ${foundingMyth}`
chant  = `war chant, ${eraPercussion}, ${chantVocals}, ${tempo + 20} BPM, in ${key}, short loop`
```

Era picks the instruments; government picks the form, tempo, key and voice. Concatenate one row
from each table.

### 4.1 By era (instruments and production)

| `era` | Instruments | Percussion (chant) | Production |
| --- | --- | --- | --- |
| `bronze` | lyre, reed pipes, sistrum, harp | frame drums, clappers, sistrum | raw, ritual, reverb of stone halls |
| `classical` | kithara, aulos, tuba (Roman horn) | tympanum, marching feet | open air, sparse |
| `medieval` | vielle, shawm, lute, church bells | tabor, war horns | monastic reverb |
| `gunpowder` | fifes, natural trumpets, harpsichord, strings | snare and bass drum | baroque court |
| `industrial` | brass band, full orchestra, organ | military snare, timpani | 1900s recording, slight crackle |
| `modern` | symphony orchestra, synth pads | stadium drums, claps | modern cinematic, clean |
| `future` | analog synths, choir pads, arpeggiator | electronic toms, sub bass | wide, glossy, sci-fi |
| `post_apoc` | scavenged metal, detuned guitar, harmonica | pipes and barrels hit, distorted kick | lo-fi, distorted |

Tribal and nomad nations swap in: morin khuur (horsehead fiddle), throat singing, frame drums,
long-song phrasing ([Music of Mongolia](https://en.wikipedia.org/wiki/Mongolian_music):
overtone singing produces two pitches at once; morin khuur; long song with each syllable held long).

### 4.2 By government (form, tempo, voices, narration)

| `gov` | Anthem form | Tempo, key | Anthem vocals | War chant vocals | Narration `voiceStyle` | Herald (decrees) |
| --- | --- | --- | --- | --- | --- | --- |
| `communist` | heroic march, 4/4 | 100 BPM, C major | massed male choir, unison then harmony | army choir shouting "hurrah" calls | deep, measured, state radio announcer | loudspeaker, slight echo |
| `junta` | military march, 2/4 | 116 BPM, D minor | none or short shouted refrain | drill-sergeant call and response | clipped, cold, male officer | radio bulletin with static |
| `theocracy` | hymn or plainchant | 66 BPM, D Dorian | monophonic male chant, then full choir with organ or temple bells ([Gregorian chant](https://en.wikipedia.org/wiki/Gregorian_chant)) | chanted litany over bell strikes | slow, reverent, cathedral reverb | cantor, sung recitation |
| `democracy` | stately anthem, 4/4 | 84 BPM, B flat major | mixed choir, hopeful | crowd chant, stomps | warm, confident, documentary narrator | town crier, clear |
| `merchant` | festive processional | 96 BPM, F major | small choir, bright | sailors' work-song shout | wry, smooth, worldly | auctioneer cadence |
| `monarchy` | grand ceremonial anthem, 3/4 or 4/4 | 76 BPM, E flat major | solemn choir, fanfare intro | knights' battle cry, horns | aristocratic, formal, older | royal herald with trumpet fanfare |
| `tribal` | call-and-response song | 90 BPM, A minor pentatonic | lead singer and group answer, throat singing for nomads | ululation, drums, war whoops | storyteller by the fire, gravelly | drum signal then spoken |
| `technocracy` | minimal electronic anthem | 120 BPM, A minor | vocoder choir | synthesised count-off | calm, precise, AI-like | system notification voice |

**Language feel** (no real words required, the model invents them): pick from region.
`classical`: Latin or Greek-like vowels; `medieval`: Old English or Old French feel;
`desert`: Arabic or Persian melisma; `east_asian`: pentatonic, Mandarin or Japanese feel;
`mesoamerican`: Nahuatl or Quechua feel; `scrap`: broken English shouts; `soviet_bloc`: Russian
feel; `egyptian`: ancient, chant-like; `highland`: Tibetan or alpine yodel feel.

Mood adds one adjective to every prompt: `martial` "aggressive, driving", `pious` "devout,
soaring", `wealthy` "lavish, triumphant", `pioneer` "hopeful, rising".

## 5. Feel beyond look and sound

### 5.1 Flag conventions (fits `FlagSpec` today)

| `gov` | Layout | Emblem (`FlagEmblem`) | Colours |
| --- | --- | --- | --- |
| `communist` | `plain` or `canton` | `star`, `gear`, `wheat` | red field, gold emblem |
| `junta` | `horizontal3` | `sword`, `star` | olive, black, one bright stripe |
| `theocracy` | `cross` or `saltire` (or `plain` + emblem) | `sun`, `eye`, `flame` | white and gold |
| `democracy` | `canton` or `vertical3` | `star` | 3 colours, equal stripes |
| `merchant` | `horizontal2` or `border` | `anchor`, `wave` | sea blue plus a rich colour |
| `monarchy` | `border` or `plain` | `crown`, `tower` | purple or deep red, gold |
| `tribal` | `plain` or `diagonal` | `sun`, `moon`, `mountain`, `tree` | earth tones |
| `technocracy` | `diagonal` | `gear`, `eye` | cyan, black, white |
| `post_apoc` era overrides | any | `skull`, `flame` | faded, rust |

These are vexillology conventions (red star socialist flags, crosses on Christian-tradition flags,
crowns on royal standards); see [Socialist symbolism](https://en.wikipedia.org/wiki/Socialist_symbolism)
and [Christian cross variants in flags](https://en.wikipedia.org/wiki/List_of_flags_with_Christian_symbolism)
(that list page unconfirmed; a general reference is [Flag](https://en.wikipedia.org/wiki/Flag)).

### 5.2 Unit counter icons per era

| `era` | army | fleet | settler |
| --- | --- | --- | --- |
| `bronze` | chariot | reed boat | ox cart |
| `classical` | spear and round shield | trireme | wagon |
| `medieval` | sword and kite shield | cog | cart |
| `gunpowder` | musket | galleon | covered wagon |
| `industrial` | rifle and cannon | ironclad | steam train |
| `modern` | tank | destroyer | truck |
| `future` | mech | hover cruiser | drop pod |
| `post_apoc` | spiked buggy | raft barge | caravan of scrap |

### 5.3 Chronicle tone per government (one line in the Gemini system prompt)

| `gov` | Tone line |
| --- | --- |
| `communist` | "Write as a state newspaper: collective heroes, quotas exceeded, enemies are reactionaries." |
| `junta` | "Write as a military communique: terse, ranks and objectives, no doubts." |
| `theocracy` | "Write as scripture: divine will, omens, blessed and accursed." |
| `democracy` | "Write as a free press: debate, votes, the citizens' mood." |
| `merchant` | "Write as a ledger and gossip sheet: profits, contracts, rivals' prices." |
| `monarchy` | "Write as a court chronicler: the sovereign's glory, lineage, honour." |
| `tribal` | "Write as an elder's tale: ancestors, seasons, the hunt." |
| `technocracy` | "Write as a system log: metrics, efficiency, optimisation." |

### 5.4 What a judge notices in 2 minutes

1. Click two nations in a row: the colour grade, anthem and herald voice all change at once.
2. A modern world shows grey slab blocks with red banners next to glass towers and a white dome.
3. Mountain nations visibly climb their tiles in terraces.
4. War chants differ: a choir "hurrah" versus throat singing versus pipe-and-barrel percussion.

## Sources

Fetched and checked 2026-11-14:
[Khrushchyovka](https://en.wikipedia.org/wiki/Khrushchyovka),
[Stalinist architecture](https://en.wikipedia.org/wiki/Stalinist_architecture),
[Brutalist architecture](https://en.wikipedia.org/wiki/Brutalist_architecture),
[Ancient Egyptian architecture](https://en.wikipedia.org/wiki/Ancient_Egyptian_architecture),
[Dzong architecture](https://en.wikipedia.org/wiki/Dzong_architecture),
[Andén](https://en.wikipedia.org/wiki/And%C3%A9n),
[Chalet](https://en.wikipedia.org/wiki/Chalet),
[Music of Mongolia](https://en.wikipedia.org/wiki/Mongolian_music),
[ElevenLabs music best practices](https://elevenlabs.io/docs/overview/capabilities/music/best-practices).

Linked but not fetched (standard references, content unconfirmed here): International Style,
Skyscraper, Neoclassical architecture, Suburb, Pylon, Egyptian pyramids, Gregorian chant,
Socialist symbolism, Flag, the Christian-symbolism flag list.
Palettes, BPM, keys and grade values are design choices, not sourced facts.
