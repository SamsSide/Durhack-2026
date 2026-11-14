# A living map: what AoH3 and the big strategy games do, and what we copy

Research for lane b, 14 Nov 2026. Question: how do Age of History 3 (AoH3) and, for comparison,
Victoria 3, HOI4, CK3, Civ VI and Total War make a strategy map feel alive, and what are the
cheapest convincing versions on our three.js globe of about 500 provinces?

Reference images (private, git-ignored) are in `scratch/refs/aoh/`: `store_0..7.jpg` are the
official Steam store screenshots (URLs in `scratch/refs/aoh/store_shots.txt`), `devlog_*.png`
are images from AoH3's own Steam dev diaries (`https://clan.akamai.steamstatic.com/images/44831059/<name>`).
The tester's own shots are `images/2.png` to `6.png` in the session folder.

## 0. The headline finding

**AoH3's map is a flat 2D painted map, not a 3D world.** Every official store screenshot and every
dev-diary image shows the same thing: a painted relief texture under semi-transparent nation
colours, thin ink rivers, letter-spaced serif names, flat icons and army counters. None of the 20
store screenshots shows smoke, clouds, 3D city models, walls or animated ships
([Steam store, release 23 Oct 2024](https://store.steampowered.com/app/2772750/Age_of_History_3/);
the 57 announcements in the [Steam news feed](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2772750&count=100)
never mention clouds, rivers, ships on the map or smoke).

So what the tester remembers as "smoke, clouds, ships, cities with walls" is either from mods,
from a zoomed-in view we could not find in any official image (unconfirmed), or from other games.
**Victoria 3's "Living Map" is the closest match to the wish list**, almost item by item: growing
city hubs, cargo ships on shipping lanes, smokestacks, trees cut down, burnt devastation
([Vic3 DD #50, 15 Jun 2022](https://forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-50-living-map.1531318/)).
We should take AoH3's *readability* (flat colour, inked names, counters) and Vic3's *life*.

## 1. What makes these maps feel alive, element by element

### 1a. AoH3 (from the store screenshots and dev diaries)

| Element | What it looks like | How it is likely rendered |
| --- | --- | --- |
| Terrain | A painted relief map (greens, ochre deserts, grey mountains) visible through the nation colour; in the zoomed-out tester shot (`3.png`) unowned land is plain terrain with shaded relief | One big pre-painted texture; nation colour multiplied on top with alpha about 0.5 to 0.7. Mods swap the texture ([Map backgrounds showcase, 10 Dec 2024](https://store.steampowered.com/news/app/2772750)) |
| Provinces and borders | Dark thin province lines, thicker nation borders, a glowing yellow outline on the selected nation (`2.png`, `store_3.jpg`) | Province-ID texture lookup plus edge detection, the same trick as the EU4 WebGL clone ([nickb.dev, 23 Aug 2021](https://nickb.dev/blog/simulating-the-eu4-map-in-the-browser-with-webgl)) (inferred) |
| Rivers | Thin dark lines across land at all zooms; large rivers become wide blue water (the river through Konya in `devlog_82cd...png`) | Baked into the background texture as ink lines; not animated |
| Lakes and sea | Dark navy flat sea, small black lakes inland (`3.png`), coast is a crisp edge; no foam, no waves | Flat colour, maybe a faint noise texture |
| Labels | Huge letter-spaced serif nation names curved along the country; small province names in every province when zoomed in (`store_0.jpg`); a 2026 patch raised province-name opacity ([Steam news, 1 May 2026](https://store.steampowered.com/news/app/2772750)) | Text along a fitted curve, size from the country's extent |
| Cities | Flag plus city name plates for capitals (`store_3.jpg`); no city model | 2D sprite labels |
| Forts / walls | A small grey castle icon on the province with a Defense Level (`devlog_82cd...png`); forts matter to sieges ([Unveiling Sieges, 2 Sep 2024](https://store.steampowered.com/news/app/2772750)) | 2D sprite |
| Resources | One icon per province (cheese, beer, cattle, wine) in the economy view (`store_2.jpg`) | 2D sprites |
| Armies | Flag plus strength number counters, curved gold movement lines with fading tails (`store_0.jpg`), crossed swords between counters in a battle (`store_5.jpg`) | 2D quads, Bezier paths |
| Ships | A tiny boat sprite at sea near Rostock in `store_5.jpg` (a navy or transport); no visible sea lanes | 2D sprite |
| Map modes, minimap | Many map modes, a world minimap with a view rectangle (all shots) | Recolour the province lookup |

Engine: AoH2 was built on libGDX; AoH3's engine is unconfirmed.

### 1b. The comparison games (developer sources)

| Game | Living-map technique | Source |
| --- | --- | --- |
| Victoria 3 | City hubs grow: "as you reach certain thresholds of buildings ... your cities will expand"; three wealth tiers of houses per culture; an anvil effect when living standards rise or fall | [DD #50 Living Map](https://forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-50-living-map.1531318/) |
| Victoria 3 | Vehicles: carriages then cars on roads between hubs, trains after railways, "cargo ships traveling" on shipping lanes (clippers to steamships), zeppelins anchored to skyscrapers | same |
| Victoria 3 | Devastation "muddles rivers and burns buildings"; forestry hubs cut nearby trees; pollution adds "more smokestacks" and tarnishes the terrain; revolution raises flags | same |
| Victoria 3 | Zoomed-out "paper map" with small illustrations; clouds give "depth and fog of war"; shoreline waves done in a shader so they cost little | [DD #49 Graphics, 8 Jun 2022](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-49-graphic-overview) |
| HOI4 | Terrain map with wide fading gradient borders; the political colour fades in as you zoom out; lighting changes by zoom, season, time of day and open sea | [HOI4 DD 11, 7 Nov 2014](https://forum.paradoxplaza.com/forum/threads/hoiiv-developer-diary-11-map-graphics-no-counters-discussion.814718/) |
| HOI4 | Weather shown on the map by zoom; a day-night band where "cities light up" at night; fog of war as foggy clouds that still show mountain tops, not darkening, "so that it isnt confused with night" | same |
| CK3 | Three zoom layers: detail (terrain, rivers, holding models), realms (flat political colour plus coats of arms), paper map (only independent realms, sea monsters) | [CK3 DD #25, 5 May 2020](https://forum.paradoxplaza.com/forum/developer-diary/ckiii-dev-diary-25-map-features-and-map-modes.1388210/) |
| Civ VI | Fog of war as parchment: unexplored is blank paper, explored-but-hidden is the terrain inked onto paper | [Firaxis interview, Wccftech](https://wccftech.com/civilization-vi-interview-with-sarah-darney-and-brian-busatti/) |
| Total War WH3 | Settlements and their custom skins only show near your vision; heavy fog and lighting on the campaign map | modder notes only, [Steam workshop](https://steamcommunity.com/sharedfiles/filedetails/comments/2859526891); no developer source found (unconfirmed) |

The pattern across all of them: **one zoom level per job**. Far out, flat colour plus big names
(AoH3, CK3 paper map). Close in, terrain, rivers, buildings and moving things (Vic3, CK3 detail).
Life comes from many small, slow, looping motions (ships, carts, smoke, clouds), plus state you
can read at a glance (city size, smokestacks, burnt land).

## 2. Our implementation list

What we have today (from `web/src/globe/` and `docs/lanes/b.md`): one province mesh with terraced
elevation and cliffs (`mesh/`), borders, painted curved names, flags and map modes with crossfade
(`political/`), instanced buildings per culture style with pop-up builds, ruins and trees
(`structures/`), army counters, arrows, battles, fronts and a `Smoke` particle class
(`units/effects.ts`), an atmosphere glow (`atmosphere/`), hover tooltip and a minimap.
**Missing:** clouds, rivers, lakes, any water motion, ships, walls, city growth stages, chimney
smoke, day-night.

Our `World` gives: `tiles[]` with `center`, `boundary`, `neighbors`, `terrain` (ocean, coast,
plains, forest, desert, hills, mountain, ice) and `elevation` 0 to 1; `owner[]`; `structures[]`
(camp, village, town, city, capital, farm, port, fort, temple, factory, ruin; `builtTick`);
`units[]` (army, fleet, settler); `relations`; `countries[].buildingStyle` and `era`.
It has **no rivers, no lakes, no roads, no trade routes, no city population per tile, no weather,
no clock time**. All of those must be derived or invented on the client.

| Element | Cheapest convincing three.js technique on our sphere | Draw calls / triangles | Data it needs | Impossible or must be generated |
| --- | --- | --- | --- | --- |
| **Clouds** | Two transparent sphere shells (radius 1.03 and 1.05), each a tiling cloud texture (procedural fbm in the fragment shader, no asset) rotating at different slow speeds; alpha fades to 0 as the camera zooms in so they never hide the map. Shadows: a third shell just above the land using the same noise, offset towards the sun, multiplied dark at 15 percent | 3 calls, about 2k triangles each (64x32 sphere) | None (camera distance only) | Weather is not simulated; clouds are decoration |
| **Ships** | One `InstancedMesh` of a low-poly hull plus sail (about 40 triangles), 30 to 80 ships. Each ship loops along a sea lane: a path of ocean-tile centres from a `port` structure to the nearest foreign `port` (BFS over ocean `neighbors`), smoothed with a Catmull-Rom curve and lifted to sea level. Heading from the curve tangent, a small bob. Fleets (`units` kind `fleet`) use the same mesh in the owner colour. Sail becomes a funnel plus `Smoke` puff when the era is industrial | 1 to 2 calls, under 4k triangles | `structures` (ports), ocean tiles, `neighbors`, `owner`, `relations` (trade or alliance pairs get busier lanes), `era` | No real trade data: lanes are invented from port pairs. Few ports early on: seed a few ghost lanes between coastal capitals |
| **Rivers** | Generate once per world: start at land tiles with elevation above 0.6 (a seeded subset, about 1 per 15 land tiles), step to the lowest neighbour until an ocean or a local minimum (that minimum becomes a lake). Merge flows where paths meet and widen downstream. Draw as one ribbon mesh along the province corners (or centre-to-centre with a jittered midpoint), 1.002 above the terrace top, tapered by flow count, with a scrolling stripe texture (`uv.y - time`) for flow | 1 call, about 3k to 6k triangles | `tiles` centre, `boundary`, `neighbors`, `elevation`, `terrain` | **No river data exists: fully generated.** Terraces mean a river crosses cliff steps: either drape it over the step or add a tiny white waterfall quad there (a nice bonus) |
| **Lakes** | Local minima from the river pass, plus a few inland tiles of low elevation fully surrounded by land: render them at their own height with the ocean material (same colour, slight shine), not as ocean tiles (the sim must not treat them as sea) | 0 extra calls if folded into the province mesh as a colour, 1 if a separate water mesh | `elevation`, `neighbors` | Sim has no lake terrain; purely visual. Keep `owner` colour on the shore tiles |
| **Coastline and foam** | In the ocean shader, a foam band where distance to the coast is small: bake a per-vertex "coast distance" on ocean triangles (0 at a land neighbour), animate `sin(dist*k - time)` for lapping waves, white at low alpha. Vic3 does shoreline waves in a shader for the same reason (DD #49) | 0 extra calls (ocean mesh shader) | `terrain`, `neighbors` | Nothing |
| **Chimney smoke** | Reuse `units/effects.ts` `Smoke` as a constant low-rate emitter: 1 to 2 grey puffs a second on every `factory`, on `city`/`capital` in industrial era, black and thicker on tiles burning after a capture. Points or billboards in one buffer, rising and fading over 3 s | 1 call, under 2k particles | `structures` kind and `builtTick`, `era`, war events | Nothing |
| **City growth stages and walls** | We already have city kinds. Make them look like stages: camp 1 hut, village 3, town 6, city 10 plus a central tall building, capital 14 plus a landmark. Walls: a ring of 8 to 12 instanced wall segments and 4 towers around `city`, `capital` and `fort` tiles when the era is not industrial or modern, in the nation's style colour; a burnt-black tint while besieged | +1 call per wall mesh type (2 total), about 60 triangles per segment | `structures`, `countries[].buildingStyle`, `era`, `units` (siege = enemy army on the tile) | No population per tile: use structure kind and age (`tick - builtTick`) as the growth driver |
| **Forests** | Already have `Trees.ts`. Make forest tiles dense (8 to 15 instanced cones), thin elsewhere, and remove trees near new towns and farms (Vic3's cut-forest idea) | already 1 call | `terrain`, `structures` | Nothing |
| **Carts on roads** (stretch) | Tiny instanced cart dots moving between a nation's own city tiles along land neighbours | 1 call | `structures`, `neighbors`, `owner` | No road data: generated as shortest paths |
| **Fog of war** | Skip as a mechanic (spectators see everything). For drama, a parchment wash over unclaimed land (Civ VI) using `owner = -1`; cheap in the province shader | 0 extra calls | `owner` | We have no per-viewer visibility |
| **Day-night** | A sun direction that orbits slowly; the land shader darkens the night side to blue and city and capital tiles light up as small additive glow sprites (HOI4 "cities light up"). Keep night at 50 percent brightness so the map stays readable | 1 call for city lights | `structures` | No in-world clock: drive it from `tick` |
| **Zoom levels** | Far: flat colour, big names, clouds on, buildings off. Middle: borders, flags, counters, ships, rivers. Close: buildings, walls, smoke, carts, province names, clouds fade out. One `zoomT` uniform (0 to 1 from camera distance) that every layer reads | 0 | camera distance | Nothing |
| **Map-mode transitions** | Already done (crossfade). Keep it | | | |

Budget: all new layers together are about 10 extra draw calls and under 30k triangles, well
inside a steady 60 fps for a laptop GPU.

## 3. Priority list for a 2-minute judge demo

Ranked by what a judge notices in two minutes against the build time for one agent.

| # | Item | Why it wins the demo | Build time (one agent) | Risk |
| --- | --- | --- | --- | --- |
| 1 | **Clouds with shadows, fading on zoom** | The first frame of the demo: the planet turns and looks like a world, not a chart. Zero data needed | 45 to 60 min | Low; keep alpha low so names stay readable |
| 2 | **Ships on sea lanes between ports** | Constant motion in the empty half of the globe (the sea); visibly reacts to war and trade | 1.5 to 2 h | Medium: path-finding on ocean tiles, curves crossing land near narrow straits |
| 3 | **Generated rivers and lakes with flow** | The tester asked for it by name; makes the terrain read as real geography; AoH3 draws rivers at every zoom | 2 to 2.5 h | Medium: rivers over terrace cliffs; tune so 10 to 20 good rivers, not a spaghetti net |
| 4 | **Chimney and burning smoke** | Reuses the existing `Smoke` class: cities breathe, captured towns burn | 30 to 45 min | Low |
| 5 | **City stages and walls** | Capitals look like capitals; walls make the medieval-to-industrial story visible when the era changes | 1.5 to 2 h | Medium: placement around the tile centre must not clash with existing buildings |
| 6 | **Coast foam and lapping waves** | Cheap shader polish that makes every coastline move; pairs with ships | 45 min | Low; needs care with the existing ocean mesh |

Next if time is left: day-night with city lights (1 h, very striking in a dark demo room),
forest clearing near towns (30 min), carts on roads (1 h). Skip fog of war.

Suggested build order: 1 and 4 together (one agent, an afternoon hour), then 2, then 3, then 5
and 6. Each lands as its own folder under `web/src/globe/` (for example `globe/sky/`,
`globe/sea/`, `globe/rivers/`) so agents work in parallel, the same way B4 and B5 did.

## Gaps and unconfirmed

- Whether AoH3 shows city sprites, smoke, clouds or ships at its closest zoom: no official image
  shows them; unconfirmed. The tester may be thinking of mods or of Victoria 3.
- AoH3's engine and rendering method: inferred from screenshots only.
- Total War campaign map techniques: no developer source found; only modder notes.
- Civ VI rivers and waterfalls: no official source found.
- No YouTube frames were captured; images are the official Steam store and dev-diary images.
