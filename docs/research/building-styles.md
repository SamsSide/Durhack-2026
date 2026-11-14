# Building styles per nation

Research for giving each nation its own architecture on the globe. Written 2026-11-14.
Today there is one GLB per `StructureKind` (contracts X4), so every nation's city looks the same.
This proposes 10 styles, a rule list for Gemini to pick one per nation, and a first cut the
owner can build in Blender in a few hours.

## 1. The style list

Ten styles. Eight cover world history, two cover the modern and post-apocalyptic prompts.
Fantasy and sci-fi prompts map onto these (section 3) rather than getting their own sets.

| # | `buildingStyle` | Covers | Signature read from orbit |
| --- | --- | --- | --- |
| 1 | `classical` | Greece, Rome, Hellenistic, Byzantine; "marble", "sky", "elven" fantasy | white columns, low gable pediment roof |
| 2 | `medieval` | Western and Central Europe, Crusader states; generic fantasy. **Default fallback** | crenellated keep, steep red roofs, spire |
| 3 | `norse` | Vikings, Slavs, Rus, Celts, ice and tundra worlds | long boat-shaped roof, stacked stave-church roof |
| 4 | `desert` | Islamic world, Persia, Ottomans, Egypt, Mesopotamia, bronze-age Near East | domes, minarets, flat roofs, ziggurat |
| 5 | `east_asian` | China, Japan, Korea, Vietnam; floating or jade fantasy | curved tiered roofs, pagoda |
| 6 | `south_asian` | India, Khmer, Southeast Asia | stupa, beehive shikhara tower |
| 7 | `mesoamerican` | Aztec, Maya, Inca, Andean, jungle worlds | step pyramid with top shrine, terraces |
| 8 | `sahel` | West Africa (Mali, Songhai), Great Zimbabwe, Ethiopia, savannah | mudbrick with protruding beams, round thatched huts |
| 9 | `industrial` | 1800s to modern, steampunk, sci-fi | smokestacks, towers, glass dome |
| 10 | `scrap` | Post-apocalyptic, drowned, wasteland | rusted sheds, tyre walls, leaning towers, hulls |

**Steppe and nomads are a modifier, not a style.** Yurts only matter at the small tiers.
Historic steppe empires built their cities in the styles of the lands they took (Karakorum,
Samarkand), so a nation with `nomadic: true` swaps camp, village and town for shared yurt models
and keeps its style for the rest. Three yurt models cover every nomad nation.

Why these merges: AoE2 started with exactly four sets for 13 civilizations (Western European,
Central European, Middle Eastern, East Asian) plus a Mesoamerican one in The Conquerors
([Wikipedia: Age of Empires II](https://en.wikipedia.org/wiki/Age_of_Empires_II)). A small set
that reads clearly beats a large set that blurs.

## 2. Styles in detail

Conventions for every model: `team` material on the pieces named in "Team". Everything else is
vertex colour from the palette. Palettes are walls / roof / accent (/ extra). Farm stays shared (tint it). Under 1,500 tris,
fits 1x1x1, +Y up (contracts X4). Camp, farm, factory and ruin stay shared
in the first cut (section 4); their lines below are for later tiers.

### 2.1 `classical`
- **Silhouette:** columned temple front with low triangular pediment; terracotta low-pitch roofs;
  round domed rotunda; aqueduct arches; square walls with round towers.
- **Palette:** `#EDE6D6` marble, `#B5543A` terracotta, `#C9A74A` gilt, `#6E7F5A` cypress.
- **Team:** pediment triangle face, roof ridge strip, banners on towers.
- **Refs:** [Greek temple](https://en.wikipedia.org/wiki/Ancient_Greek_temple), [Roman architecture](https://en.wikipedia.org/wiki/Ancient_Roman_architecture)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | three square leather tents around a standard pole | village | 4 to 5 whitewashed boxes, low terracotta roofs |
| town | houses around a small columned shrine | city | walled grid, colonnade forum, one round arena |
| capital | hill acropolis: big columned temple on a plinth above walls | fort | square castrum, four corner towers, gate arch |
| temple | 6-column temple on a stepped base | port | harbour mole with a lighthouse tower |

### 2.2 `medieval`
- **Silhouette:** square crenellated keep; steep pitched red or slate roofs; pointed church spire;
  round towers with cone caps; timber-frame houses.
- **Palette:** `#CFC2A3` plaster, `#8A3B2A` red tile, `#5B5F66` slate, `#4A3628` timber.
- **Team:** flags on towers, a banner on the keep, cone-cap trim.
- **Refs:** [Castle](https://en.wikipedia.org/wiki/Castle), [Gothic architecture](https://en.wikipedia.org/wiki/Gothic_architecture)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | palisade ring with two peaked tents | village | steep-roof cottages round a tiny chapel |
| town | timber houses, a church with one spire, a wooden wall | city | stone curtain wall, cathedral with twin spires |
| capital | concentric walls, tall keep, cone-capped towers, cathedral | fort | motte-and-bailey keep or square castle, crenellations |
| temple | cross-plan cathedral with a single tall spire | port | stone quay, round harbour tower, cog mast |

### 2.3 `norse`
- **Silhouette:** long low longhouse with a curved roof ridge; stacked multi-tier stave-church roof
  with dragon-head gable ends; round palisade; turf roofs.
- **Palette:** `#5A4632` dark timber, `#6F8F4E` turf, `#9AA3A8` stone, `#D9D4C7` snow.
- **Team:** shields on the walls, roof dragon-head tips, sail stripes on the port.
- **Refs:** [Longhouse](https://en.wikipedia.org/wiki/Longhouse), [Stave church](https://en.wikipedia.org/wiki/Stave_church)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | two upturned boats as shelters, a fire ring | village | 2 to 3 turf-roof longhouses |
| town | longhouses inside a round palisade | city | ring fort (Trelleborg plan): four longhouse blocks in a circle |
| capital | great mead hall on a mound, stave church, double palisade | fort | round earth rampart with a timber gate tower |
| temple | three-tier stave church | port | wooden jetty with a longship |

### 2.4 `desert`
- **Silhouette:** onion or round dome; thin minaret; flat-roof cube houses around courtyards;
  pointed-arch gate (iwan); ziggurat for bronze-age nations.
- **Palette:** `#E3C99A` sand plaster, `#B8864E` mudbrick, `#2F7F8C` turquoise tile, `#F2EEE4` white.
- **Team:** dome cap, awnings, minaret balcony band.
- **Refs:** [Islamic architecture](https://en.wikipedia.org/wiki/Islamic_architecture), [Ziggurat](https://en.wikipedia.org/wiki/Ziggurat)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | caravan of square striped tents | village | flat-roof mud cubes and a well |
| town | courtyard houses, small dome, one minaret | city | walled souk, large dome, two minarets |
| capital | palace: great dome flanked by four minarets, iwan gate, walls | fort | square mudbrick citadel, round corner towers, no roofs |
| temple | domed mosque with one minaret (bronze age: ziggurat) | port | stone quay with a lighthouse minaret and dhow |

### 2.5 `east_asian`
- **Silhouette:** curved upturned roof eaves; tiered pagoda (3 to 7 roofs); hall on a raised
  platform; square walled city with gate towers; torii-style gate.
- **Palette:** `#B23A2E` vermilion, `#2E3B3F` dark tile, `#E8DCC0` plaster, `#D4A93A` gold.
- **Team:** roof tiles of the main hall, lanterns, gate beam.
- **Refs:** [Pagoda](https://en.wikipedia.org/wiki/Pagoda), [Chinese architecture](https://en.wikipedia.org/wiki/Chinese_architecture)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | square tents with flared roofs around a banner | village | low curved-roof houses and a paddy terrace |
| town | houses, a small two-tier pavilion | city | square wall with gate towers, three-tier pagoda inside |
| capital | palace compound: big double-eave hall on a white platform, walls | fort | gate tower with curved roof on a thick wall section |
| temple | five-tier pagoda | port | wooden pier with a junk (batten sail) |

### 2.6 `south_asian`
- **Silhouette:** beehive or corn-cob shikhara tower; hemispherical stupa with a spire; chhatri
  (small domed pavilions) on rooftops; stepped temple gate tower (gopuram).
- **Palette:** `#C9714A` red sandstone, `#E9D8B4` cream, `#2F8A6A` green, `#D6A436` gold.
- **Team:** shikhara flag and finial, chhatri caps, awnings.
- **Refs:** [Shikhara](https://en.wikipedia.org/wiki/Shikhara), [Stupa](https://en.wikipedia.org/wiki/Stupa), [Haveli](https://en.wikipedia.org/wiki/Haveli)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | domed fabric tents and an elephant stall | village | thatched huts round a pipal tree shrine |
| town | haveli blocks with chhatris, small stupa | city | walls, tall shikhara temple, havelis |
| capital | hill palace with many chhatris and a central dome | fort | hill fort with long walls and bastions (Rajput) |
| temple | single tall shikhara on a stepped plinth (or stupa for faith nations) | port | ghat steps down to the water |

### 2.7 `mesoamerican`
- **Silhouette:** stepped pyramid with a temple box on top; flat-topped platforms; ball court;
  Andean dry-stone terraces on slopes.
- **Palette:** `#B7AE98` limestone, `#7A6A52` dark stone, `#2E8C6E` jade, `#C2452D` red plaster.
- **Team:** top shrine roof, banner on the pyramid, stairs stripe.
- **Refs:** [Mesoamerican pyramids](https://en.wikipedia.org/wiki/Mesoamerican_pyramids), [Machu Picchu](https://en.wikipedia.org/wiki/Machu_Picchu)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | lean-to palm shelters | village | round thatched huts on a low platform |
| town | huts, a small three-step pyramid | city | plaza with a pyramid and a ball court |
| capital | great twin-shrine pyramid on a raised plaza with platforms | fort | stone wall ring on a hilltop terrace |
| temple | tall nine-step pyramid with top shrine | port | causeway into a lake with canoes |

### 2.8 `sahel`
- **Silhouette:** mudbrick walls with protruding wooden beams (toron) and conical pinnacles
  (Djenne mosque); round huts with conical thatch; curved dry-stone enclosure wall
  (Great Zimbabwe) with a conical tower.
- **Palette:** `#B5703F` red mud, `#D7B98A` straw, `#6B4A2E` beams, `#E8E0D0` lime.
- **Team:** pinnacle caps, ostrich-egg finials, doorway frame.
- **Refs:** [Great Mosque of Djenne](https://en.wikipedia.org/wiki/Great_Mosque_of_Djenn%C3%A9), [Great Zimbabwe](https://en.wikipedia.org/wiki/Great_Zimbabwe)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | hide shelters and a thorn fence | village | ring of round thatched huts and granaries |
| town | huts plus a small mudbrick mosque or shrine | city | mudbrick walls, Djenne-style mosque with three towers |
| capital | great curved stone enclosure with conical tower, palace inside | fort | thick mud tower fort with beam spikes |
| temple | Djenne-style mosque, three pinnacle towers | port | river landing with pirogues |

### 2.9 `industrial`
- **Silhouette:** smokestacks; tall rectangular blocks; clock tower or radio mast; glass dome
  (sci-fi); star-fort or concrete bunker.
- **Palette:** `#8C4A3A` brick, `#5E6670` steel, `#C9CFD4` concrete, `#7FC7D9` glass.
- **Team:** rooftop flags, stripes on stacks, dome rim.
- **Refs:** [Industrial architecture](https://en.wikipedia.org/wiki/Industrial_architecture)

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | prefab cabins and a radio mast | village | terraced brick rows |
| town | brick rows, a clock tower, one chimney | city | block towers of two heights, rail bridge |
| capital | domed parliament plus two tall towers | fort | star fort or concrete bunker with gun turret |
| temple | big domed hall or observatory | port | cranes and a steam ship |

### 2.10 `scrap`
- **Silhouette:** stacked containers; corrugated lean-to sheds; leaning broken towers; tyre and
  car-hulk walls; a beached ship hull as a building; tall scrap watchtower.
- **Palette:** `#8A4B2A` rust, `#6B6B5E` dull metal, `#A79B7C` dust, `#3E4A3D` moss.
- **Team:** rag banners, painted container doors, tarps.
- **Refs:** genre convention, no primary source (unconfirmed as a "standard" set).

| Kind | Model | Kind | Model |
| --- | --- | --- | --- |
| camp | car hulks in a ring with a fire barrel | village | corrugated shacks on stilts |
| town | containers stacked two high, water tower | city | half-ruined tower block with shacks bolted on |
| capital | beached ship hull fortress with towers on deck | fort | tyre-and-scrap wall, spiked gate, watchtower |
| temple | shrine around a crashed plane or relic machine | port | rafts lashed to a rusted barge |

## 3. How a nation gets its style

**Recommendation:** the world-bible prompt returns `buildingStyle` per nation, one value from the
fixed list, plus `nomadic: boolean`. The server validates it and falls back to `medieval`. This
adds a field to `Country` in `docs/contracts.md`, so it needs a `needs-owner` issue.

Rules for the Gemini prompt (first match wins, then apply the diversity rule):

1. World era or prompt says post-apocalyptic, wasteland, drowned, ruined, fallout -> `scrap`.
2. Era is industrial, modern, steampunk, cyberpunk, space, sci-fi -> `industrial`
   (a pre-industrial tribe in that world may still take a historic style).
3. The nation's culture names a real-world culture: use that culture's row in the table of
   section 1 (e.g. "samurai" -> `east_asian`, "pharaoh" -> `desert`, "Inca" -> `mesoamerican`).
4. Terrain or climate in the prompt or culture:
   ice, tundra, fjord, snow -> `norse`; desert, dune, oasis -> `desert`;
   jungle, rainforest -> `mesoamerican`; savannah, river delta, grassland -> `sahel`;
   monsoon, river plains -> `south_asian`; islands, floating, mountains -> `east_asian`.
5. Government and ideology:
   republic, senate, philosopher, law, marble -> `classical`;
   feudal, king, knights, crusade -> `medieval`;
   jarl, raiders, clans, sagas -> `norse`;
   caliph, sultan, merchant caravans -> `desert`;
   emperor, mandate, bureaucracy, harmony -> `east_asian`;
   raja, dharma, monastery, caste -> `south_asian`;
   sun king, sacrifice, priest-king -> `mesoamerican`;
   griot, gold trade, ancestors -> `sahel`.
6. Temperament tie-break: faith > 0.7 -> pick the style with the tallest temple
   (`mesoamerican`, `south_asian`, `east_asian`); trade > 0.7 -> `desert` or `classical`;
   aggression > 0.7 -> `medieval` or `norse`.
7. `nomadic: true` when culture mentions herders, horse lords, steppe, nomads, caravans.
8. **Diversity rule:** in one world, at most 2 nations share a style unless the prompt names a
   single culture (e.g. "warring Greek city-states" may be all `classical`). Prefer styles
   that are different on the globe (contrasting palettes) for neighbours.

Fantasy prompt examples: "floating archipelago" -> `east_asian` (or `classical` if elven/marble);
"ice world" -> `norse`; "bronze age" -> `desert` (ziggurat), `classical` and `mesoamerican` mix;
"dwarven mountains" -> `norse`; "desert planet" -> `desert` or `industrial`.

## 4. Budget for the owner

Full set: 10 styles x 11 kinds = 110 models. Too many. Tiered plan:

| Tier | Styles | Kinds varied | Models | Notes |
| --- | --- | --- | --- | --- |
| 1 (first cut) | `medieval`, `classical`, `desert`, `east_asian`, `mesoamerican`, `scrap` | capital, city, town, temple, fort | 6 x 5 = **30** | the kinds you see from orbit; covers the demo prompts |
| 2 | add `norse`, `south_asian`, `sahel`, `industrial` | same 5 | +20 = 50 | |
| 3 | all 10 | add village, port | +20 = 70 | ports are on coasts and visible |
| shared | n/a | camp, farm, factory, ruin, tree, units, 3 yurts | 1 each | palette tint per style optional |

Missing models fall back: `style/kind` -> fallback style -> today's shared `kind.glb`.
Fallbacks until tier 2: `norse` -> `medieval`, `south_asian` -> `desert`, `sahel` -> `desert`,
`industrial` -> `scrap`. Manifest idea (contract change, needs owner):
`"styles": { "east_asian": { "capital": { "file": "east_asian/capital.glb", "footprint": 1.0 } } }`
next to the existing `models`, which stay as the shared fallback.

### The kit: shared pieces plus one style piece

A Blender script builds each model as a layout of kit pieces, so a style is a dict of pieces and a
kind is a layout (positions and scales). Same layout across styles, different pieces.

**Shared pieces (all styles):** box house (3 sizes), wall segment, wall corner, gate box,
round tower cylinder (8 sides), stepped plinth (1 to 3 steps), banner pole plus flag (`team`).

**Kind layouts (shared):** town = 4 houses + 1 landmark; city = wall ring + 6 houses +
1 landmark; capital = 2 wall rings + plinth + big landmark + 4 towers; fort = wall square +
4 towers + gate; temple = plinth + landmark.

| Style | Roof piece | Landmark piece | Tower cap | Wall variant |
| --- | --- | --- | --- | --- |
| `classical` | low gable | column temple (box + 6 cylinders + pediment) | none, flat | square, low |
| `medieval` | steep gable | spire (tall 4-sided cone) | cone cap | crenellated |
| `norse` | curved long roof | stacked 3-tier roof | short cone | log palisade (cylinders) |
| `desert` | flat with parapet | dome (UV sphere half) + minaret (thin cylinder) | small dome | thick, plain |
| `east_asian` | curved hip roof (flared eave) | pagoda (stack of roof pieces) | flared roof | wall with gate tower |
| `south_asian` | flat + chhatri | shikhara (ribbed tapering cone) | chhatri | bastioned |
| `mesoamerican` | thatch cone | step pyramid (stacked boxes) + top shrine | none | stone terrace |
| `sahel` | round thatch cone | Djenne block (tapered box + pinnacles + beam stubs) | pinnacle | curved mud wall |
| `industrial` | flat | smokestack + glass dome | mast | concrete |
| `scrap` | slanted sheet | container stack + leaning tower | water tank | tyre wall |

Triangle budget per model: landmark about 500, walls and towers about 500, houses about 300.

## 5. Strategy-game conventions

| Game | How it handles architecture | Sources |
| --- | --- | --- |
| Age of Empires II | Civilizations share **architecture sets**. The original game had 4 sets for 13 civs: Western European (Britons, Celts, Franks), Central European (Goths, Teutons, Vikings), Middle Eastern (Byzantines, Persians, Saracens, Turks), East Asian (Chinese, Japanese, Mongols), plus Mesoamerican for Aztecs and Mayans. Later expansions added Mediterranean, African, Indian, Southeast Asian and Central Asian sets (from fan wikis and forum posts; the exact current list is unconfirmed). New sets were often made by repainting an old one: "The Italian set was masterfully photoshopped from the Middle Eastern set" (2015). | [Wikipedia: AoE II](https://en.wikipedia.org/wiki/Age_of_Empires_II); [AoE dev blog 4: African architecture (2015-08-28)](https://www.ageofempires.com/news/dev-blog-4-african-architecture); [AoE forum: DE building set feedback (2019)](https://forums.ageofempires.com/t/aoe-ii-de-building-set-feedback/38501) |
| Civilization VI | Buildings sit in **districts** on map tiles, not inside the city tile. Civs have "regional graphic customizations for some units and buildings", and cities update their look with each **era** (data-driven: an `Eras.artdef` file sets when e.g. skyscrapers appear). The exact regional groups are unconfirmed from primary sources; mods like Leugi's City Styles add more (Mesoamerican, Andean, African clay, nomadic tents). | [well-of-souls Civ VI overview](https://well-of-souls.com/civ/civ6_overview.html); [CivFanatics: skyscraper visuals by era](https://forums.civfanatics.com/threads/skyscraper-visuals-show-up-too-early.663375); [Leugi's City Styles Pack](https://catalogue.smods.ru/archives/62162) |
| Age of History II | A 2D map game. Nations are shown by **colour and flag**; the store page lists a flag maker, civilization creator and colour palettes, and no building art per culture. So identity there comes from colour, which our `team` material already gives us. | [Steam: Age of History II](https://store.steampowered.com/app/603850/Age_of_History_II/) |

Takeaways for us: share sets across groups of nations (AoE2), make the landmark the thing that
differs (AoE2 forum complaints focus on forts and monasteries looking the same), and let era
change the set (Civ VI), which our era-to-style rules 1 and 2 already do.
