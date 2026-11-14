# Lane b plan — the first globe, camera and political map

- **Rows:** B1, B2, B3
- **Branches:** `b/globe-b1` (Tasks 1 and 2), `b/globe-camera` (Task 3), `b/globe-political` (Tasks 4, 5 and 6). One PR per branch.
- **Paths allowed:** `web/` except `web/src/ui/`, `web/src/audio/`, `web/src/theme/` and `web/public/models/`. Anything else → NEEDS_OTHER_LANE / NEEDS_OWNER.
- **Contracts:** X1 (read: `World`, `Tile`, `applyEvent`, `relationOf`, `flagSvg`), X2 (via the store), X5 (lane b owns the store from B1 on; its exported shape does not change), X7 (read `tokens.css` variables).
- **Starts:** the minute A1 (the seed) is on `main`. Everything is built against `npm run mock`.
- **Done when:** on `main`, `npm run mock` + `npm run dev` shows a lit 3D planet with raised land, every province coloured by owner, live owner changes with a pulse, orbit and smooth zoom, click to select a nation with a glowing border and `flyTo`, bold nation borders with faint region borders when close, nation names and flags painted on the map, and a map mode bar switching political / terrain / diplomacy / strength.

## Look (decided with the lane owner)

Grand-strategy map conventions (Hearts of Iron, Age of History) on a real 3D sphere. **Show,
don't tell:** judges should understand the world without reading. Provinces are flat-coloured
by owner like a political map, but the land is visibly raised: each province is a terrace whose
height comes from its `elevation`, with cliff walls down to the sea, so mountains read as
mountains from orbit. Smooth noise relief and ocean shaders are B8 polish, not this plan.

Shared constants, used by every task (in `web/src/globe/constants.ts`, created in Task 1):

| Name | Value | Meaning |
| --- | --- | --- |
| `RADIUS` | `1` | Sphere radius |
| `SEA_LEVEL` | `0.992` | Ocean province height and the bottom of cliff walls |
| `LAND_BASE` | `1.0` | Height of land with elevation 0 |
| `RELIEF` | `0.045` | Extra height at elevation 1 (land height = `LAND_BASE + elevation * RELIEF`) |
| `MOUNTAIN_BONUS` | `0.015` | Extra height for `mountain` terrain; `hills` get half |
| `LIFT` | `0.0015` | Gap between a surface and the lines drawn on it |
| `CAM_MIN` / `CAM_MAX` | `1.12` / `4.0` | Camera distance from the centre |
| `CLOSE` | `1.8` | Camera distance below which region borders, region selection and detail appear |

Palette (in `web/src/globe/palette.ts`, Task 1): read the CSS variables `--globe-ocean`,
`--globe-ice`, `--globe-land-<terrain>` from `tokens.css` at start-up with
`getComputedStyle(document.documentElement)`, falling back to these old-atlas values when a
variable is missing: ocean `#2b4a5e`, coast `#d9c79a`, plains `#c9b87a`, forest `#7d8f55`,
desert `#e0c48a`, hills `#a8956a`, mountain `#8a7d6b`, ice `#eef0ee`; cliff walls are the land
colour darkened 35%. Diplomacy stances: war `#b3261e`, hostile `#d9822b`, neutral `#9a9486`,
trade `#3f7cac`, alliance `#4f8a3c`, the selected nation itself `#e8c547`. If the owner wants
these in `tokens.css`, the variable names above are the ones to add (`needs-owner`, no code change).

## Task 1: Province mesh builder (pure, no React)

- **Agent:** durhack-builder · **Model:** sonnet
- **Parallel with:** alone (Task 2 depends on it)
- **Files:** `web/src/globe/constants.ts`, `web/src/globe/palette.ts`, `web/src/globe/mesh/buildProvinceMesh.ts`, `web/src/globe/mesh/colors.ts` (all create), `web/scripts/globe-smoke.ts` (create)
- **Build:**
  - `tileHeight(tile): number`: `SEA_LEVEL` for `ocean`; otherwise `LAND_BASE + elevation * RELIEF`, plus `MOUNTAIN_BONUS` for `mountain` and half of it for `hills`.
  - `buildProvinceMesh(world: World): ProvinceMesh` returning one `THREE.BufferGeometry` (non-indexed, `position`, `normal`, `color` attributes) plus lookups:
    - **Top face** of each tile: a triangle fan from `center` to each consecutive pair of `boundary` corners, every point scaled to `tileHeight(tile)`. Normals point outward (the normalized position) so the top reads flat-lit like a map.
    - **Cliff walls** for every land tile: for each boundary edge, a quad (two triangles) from the tile's height down to `SEA_LEVEL`, facing outward from the tile's centre. Walls between two land tiles are kept (the lower one is hidden by the higher one); this costs about 6,000 triangles for 500 provinces and needs no neighbour sorting.
    - `tileVertexStart: Int32Array`, `tileVertexCount: Int32Array` (per tile, covering its top and its walls) so one tile can be recoloured without touching the rest.
    - `triangleToTile: Int32Array`: for raycast picking (face index → tile id).
    - `edges: { a: Vec3; b: Vec3; tileA: number; tileB: number }[]`: every shared boundary edge once, found by keying corners rounded to 5 decimals; `a` and `b` are lifted to `max(tileHeight(tileA), tileHeight(tileB)) + LIFT`. Tasks 3 and 4 draw all lines from this.
    - `centroidOf(tileIds: number[]): Vec3`: mean of the centres, normalized, scaled to the highest of those tiles + `LIFT`.
  - `tileColor(world, tileId, mode, selectedCountryId): THREE.Color` in `colors.ts`. **political:** owner colour mixed 75/25 with the terrain colour; unclaimed land is the terrain colour; ocean is ocean. **terrain:** the terrain colour only. **diplomacy:** with no selection, as political; otherwise by `relationOf(world, selected, owner).stance` (palette above), the selected nation gold, unclaimed land the terrain colour lightened 20%. **strength:** each country's total `units` strength divided by its tile count, normalized to the strongest country, on a ramp from `#f3e9c6` to `#7a1f12`; unclaimed land `#d8d2c0`.
  - `writeColors(mesh, world, mode, selectedCountryId, tileIds?)`: writes the top colour and the darker wall colour for the given tiles (or all), and sets `color.needsUpdate`.
  - `web/scripts/globe-smoke.ts`: builds the mesh from `mockWorld()` and prints one line: `tiles <n> vertices <n> triangles <n> edges <n> picks-ok <true|false>` (picks-ok: every entry of `triangleToTile` is a valid tile id).
- **Contract:** X1 `Tile` exactly (boundary counter-clockwise from outside, convex, `y` up). | **Mock:** `mockWorld()` from `@terra/shared`.
- **Smoke proof:** `./check.sh` passes; `npx tsx web/scripts/globe-smoke.ts` prints about 300 tiles and `picks-ok true` (npx fetches `tsx`; no new dependency in `package.json`).
- **HUMAN_TEST:** none (covered by Task 2).

## Task 2: The globe on screen (B1)

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** alone (needs Task 1)
- **Files:** `web/src/globe/Globe.tsx` (create), `web/src/globe/index.ts` (create), `web/src/App.tsx` (modify: mount `<Globe />` in the seed's globe slot), `web/src/state/world.ts` (take over: no change to the exported `WorldStore` shape)
- **Build:**
  - `<Globe />`: a `@react-three/fiber` `<Canvas>` filling the slot, `dpr={[1, 2]}`, camera at distance 2.6, background `--globe-space` or `#0b0f14`. Lights: a hemisphere light (sky `#fff6e0`, ground `#33414a`, 0.6) and a directional "sun" light (1.1) fixed at the upper left of the view. A plain drei `<OrbitControls>` (min 1.12, max 4.0) until Task 3 replaces it.
  - One `<mesh>` from `buildProvinceMesh`, `MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })`. Rebuild the geometry only when `world.id` changes (a new snapshot); dispose of the old one.
  - **Live colours:** subscribe to `version`. On each change, read the store's `recentEvents` since the last version seen; collect the tile ids of `tile_claimed` events (and every tile on `country_founded` / `country_fell`), and call `writeColors` for those tiles only. On `mapMode` or `selectedCountryId` change, recolour everything.
  - Empty state: when `world` is `null`, the canvas shows only the stars-less background (lane c's Create screen is over it).
- **Contract:** X5 store (read `world`, `version`, `recentEvents`, `mapMode`, `selectedCountryId`). | **Mock:** `npm run mock`.
- **Smoke proof:** `./check.sh` passes (build and app start). Then `npm run mock` and `npm run dev` start without errors in the terminal.
- **HUMAN_TEST:** run `npm run mock` and `npm run dev`, open http://localhost:5173. Expect: a lit planet with blue sea and raised land, about 5 nations in distinct colours, mountains visibly higher than plains; within a minute nations visibly spread province by province; dragging rotates the planet; no console errors.

## Task 3: Camera, picking and selection (B2)

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Tasks 4, 5 and 6 (different folders; only `Globe.tsx` is shared: Task 3 adds `<CameraRig />` and `<SelectionGlow />`, Tasks 4–6 add `<Political />`, so each adds one line there and `durhack-pr` merges the two)
- **Files:** `web/src/globe/camera/CameraRig.tsx`, `web/src/globe/camera/cameraBus.ts`, `web/src/globe/camera/usePicking.ts`, `web/src/globe/camera/SelectionGlow.tsx` (create); `web/src/globe/Globe.tsx` (modify); `web/src/state/world.ts` (modify: `flyTo` calls `cameraBus`)
- **Build:**
  - `CameraRig`: drei `<CameraControls>` replacing `<OrbitControls>`. Distance 1.12 to 4.0; `smoothTime 0.25`; rotation speed scales with distance (`0.25 + 0.75 * (d - 1.12) / 2.88`) so close-up dragging is not twitchy; no panning; the camera always looks at the centre. Mouse wheel and pinch zoom smoothly.
  - `cameraBus`: `registerCamera(api)` / `flyTo(point: Vec3, distance?)`. The store's `flyTo(countryId)` looks up the nation's `capitalTile` centre and calls `cameraBus.flyTo(center, 1.6)`: the camera rotates over 1.2 s to look straight down at the capital and settles at distance 1.6.
  - `usePicking`: on pointer up with less than 5 px of movement since pointer down (so a drag never selects), raycast the province mesh, map `faceIndex` to a tile with `triangleToTile`. Owned tile → `select(owner, tileId)`, and also set `selectedRegionId` to the tile's region when the camera distance is under `CLOSE` (null otherwise). Ocean or unclaimed → `select(null)`. Double click on a nation → `flyTo(owner)`. Hover lightens the province under the cursor by 15% (via `writeColors` on that one tile and the previous one) and sets the cursor to a pointer over owned land.
  - `SelectionGlow`: for the selected nation, every `edges` entry where exactly one side is that nation, drawn as one drei `<Line>` set (segments mode), width 4 px, colour `#ffe9a8`, additive blending, opacity pulsing between 0.6 and 1.0 once a second. Rebuilt when the selection changes or a `tile_claimed` touches that nation.
- **Contract:** X5 `select`, `flyTo`, `selectedCountryId`, `selectedTileId`, `selectedRegionId`. **Gives:** selection to lane c (their `NationCard` reads `selectedCountryId`).
- **Smoke proof:** `./check.sh` passes.
- **HUMAN_TEST:** drag to spin, wheel to zoom from the whole planet to a few provinces filling the screen; zooming feels smooth, not steppy. Click a nation: a pulsing gold border outlines exactly that nation; lane c's placeholder card shows its id. Drag across a nation and release: nothing gets selected. Double-click a nation: the camera glides to its capital. Click the sea: the selection clears.

## Task 4: Borders (B3, part 1)

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Task 3. Tasks 4, 5 and 6 run one after another on `b/globe-political` (they share `Political.tsx`).
- **Files:** `web/src/globe/political/Political.tsx`, `web/src/globe/political/Borders.tsx` (create); `web/src/globe/Globe.tsx` (modify: add `<Political />`)
- **Build:**
  - **Nation borders (thick, HOI style):** every `edges` entry whose two tiles have different owners where at least one is a nation, plus coastlines of owned land. Drawn with drei `<Line>` in segments mode, 3 px, colour: the owner's colour darkened 45% (a single dark ink `#2a2118` for coastlines). One line object for all nations, rebuilt (debounced to at most twice a second) when `tile_claimed` events arrive.
  - **Region borders:** edges inside one nation whose two tiles are in different regions; 1 px dashed, `#2a2118` at 35% opacity; visible only when the camera distance is under `CLOSE`, fading in over the last 0.2 of distance.
  - **Province lines:** every other land edge, 1 px, `#2a2118` at 10% opacity, visible only under distance 1.4.
- **Contract:** X1 `owner`, `Tile.region`. | **Mock:** `npm run mock`.
- **Smoke proof:** `./check.sh` passes.
- **HUMAN_TEST:** from orbit, every nation has a bold dark border and coastlines are inked; zoom in past about half way and thinner dashed region borders appear inside nations; zoom right in and faint province lines appear. Borders follow conquests within a second.

## Task 5: Names and flags painted on the map (B3, part 2)

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Task 3; after Task 4 on the same branch.
- **Files:** `web/src/globe/political/NationLabels.tsx` (create), `web/src/globe/political/Political.tsx` (modify)
- **Build:**
  - One label per living nation at `centroidOf(countryTiles(world, id))`: a drei `<Text>` (SDF text) lying flat on the surface (oriented tangent to the sphere, upright towards the north pole), all capitals, letter spacing 0.15, colour `#2a2118` with a 0.002 outline in `#f3e9c6`, font size `0.018 * sqrt(tileCount)` clamped to 0.03–0.12, so big empires get big names like a painted atlas. Use the serif font from `tokens.css` (`--font-display`) if it is a loadable font file, otherwise drei's default.
  - Beside the name, the nation's flag: `flagSvg(country.flag, 90, 60)` turned into a data URL and a texture (cached per nation and flag), on a small plane 0.75 times the font size tall, also lying on the surface.
  - **Fade with zoom:** nation labels fade out between distance 1.5 and 1.3 (so they do not cover close-up detail); when the camera is under `CLOSE`, region names (`Region.name`, skipped while empty) with their region flags fade in at the region's centroid at half the size.
  - Labels on the far side of the planet are hidden (dot product of the label's direction and the camera's direction below 0.1).
  - Positions recompute (debounced, at most once a second) when ownership changes, so a name slides as an empire grows.
- **Contract:** X1 `Country.name`, `Country.flag`, `Region.name`, `Region.flag`, `flagSvg`, `countryTiles`.
- **Smoke proof:** `./check.sh` passes.
- **HUMAN_TEST:** from orbit every nation's name is painted across its land with its flag next to it, readable without zooming; bigger nations have bigger names. Zoom in: nation names fade and region names with flags appear. Spin the planet: no labels show through from the back.

## Task 6: Map modes, the owner-change pulse and the mode bar (B3, part 3)

- **Agent:** durhack-frontend · **Model:** sonnet
- **Parallel with:** Task 3; after Task 5 on the same branch.
- **Files:** `web/src/globe/political/MapModeBar.tsx`, `web/src/globe/political/usePulse.ts` (create); `web/src/globe/political/Political.tsx`, `web/src/globe/Globe.tsx` (modify)
- **Build:**
  - **Map modes:** switching `mapMode` crossfades every province from its old colour to the new one over 0.4 s (lerp in `useFrame`, then `writeColors` once at the end). Modes and colours as in Task 1. In diplomacy mode with nothing selected, a small hint "Select a nation to see its friends and enemies" shows over the canvas.
  - **Pulse:** when a tile changes owner, it flashes: its colour goes to white mixed 60% with the new owner's colour and eases back over 0.8 s. Conquests (`cause: 'conquest'`) flash red `#ff5a3c` instead. At most 60 pulsing tiles at once (the oldest finish early).
  - **`MapModeBar`:** plain DOM over the canvas, bottom-left, four buttons (Political, Terrain, Diplomacy, Strength) with keyboard shortcuts 1 to 4. Styled only with `tokens.css` variables (X7). It is lane b's own control because the owner's design puts map modes in the top bar; if lane c later builds that top bar, it calls `setMapMode` and this bar is removed.
- **Contract:** X5 `mapMode`, `setMapMode`, `recentEvents`; X1 `relationOf`.
- **Smoke proof:** `./check.sh` passes.
- **HUMAN_TEST:** press 1 to 4: the map crossfades between political, terrain, diplomacy and strength. Select a nation and press 3: allies green, enemies red, the nation gold. Watch growth: each newly claimed province flashes briefly; during the mock war captured provinces flash red.

## Order and timing

1. Task 1 → Task 2 on `b/globe-b1` (about 1 hour). Merge: B1 `done`.
2. Then in parallel: Task 3 on `b/globe-camera`, and Tasks 4 → 5 → 6 on `b/globe-political` (about 1.5 hours). Merge both: B2 and B3 `done`.
3. Next plan: B4 (structures) with B5 (units and war: HOI-style army counters with strength numbers, movement arrows, a front line between nations at war).
