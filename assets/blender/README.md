# Models (row A8, contract X4)

Rebuild everything (GLBs, `web/public/models/manifest.json`, `assets/preview.png`):

    blender --background --factory-startup --python assets/blender/build_models.py

Rules every model follows:

- Built from primitives in `build_models.py`; no downloads, no textures, no lights or cameras.
- +Y up in the GLB (the exporter converts from Blender Z-up), origin at the centre of the base,
  fits a 1 x 1 x 1 box, under 1,500 triangles, flat shaded, one mesh per file.
- Exactly one material named `team` per model (lane b recolours it to the nation colour); the
  rest use a small warm palette (stone, plaster, timber, thatch, terracotta, field, wheat, leaf,
  water, dark, skin, steel).
- Adding a model: write `m_<key>()`, add it to `MODELS` and `FOOTPRINT`, and add the key to X4.

## Building styles (row A22, contract X4 `styles`)

30 models: 6 styles (`medieval`, `classical`, `desert`, `east_asian`, `mesoamerican`, `scrap`) x 5 kinds
(`capital`, `city`, `town`, `temple`, `fort`) in `web/public/models/<style>/<kind>.glb`. Rebuild (also
adds the `styles` section to `manifest.json`, keeping `version` and `models`, and renders
`assets/preview-styles.png`):

    blender --background --factory-startup --python assets/blender/build_styles.py
    python3 assets/blender/verify_styles.py     # triangles, bounds, one `team` material, size

- `styles_kit.py`: the Builder (box, cylinder, frustum, lathe, gable, shed) and the six palettes.
- `styles_defs.py`: one class per style (house, tower, wall, gate, landmark); kind layouts are shared
  in `Base`, so a kind has the same footprint everywhere but a different silhouette per style.
- Keep each file under about 60 KB (flat shading doubles vertices): aim for under 1,000 triangles.
- Preview a subset: `PREVIEW_STYLES=scrap,desert PREVIEW_KINDS=capital,temple` before the blender command
  (add `PREVIEW_OUT=<file>` so the committed preview is not overwritten).

## Nation identity styles (row A24, contract X4 `styles`)

20 more models, built by the same command: `soviet_bloc`, `western_modern`, `egyptian`, `highland` x the
same 5 kinds, in `styles_identity.py` (one class per style, palettes in `styles_kit.py`). They follow
`docs/research/building-references.md` (reference boards, silhouette rules, per-kind specs, palettes) and
lane b's prototype layouts in `web/src/proto/sets.ts`. The command renders `assets/preview-styles.png`
(all ten styles), `assets/preview-identity.png` (these four, larger) and `assets/preview-identity-40px.png`
(these four at globe scale: one model unit = 40 px, so 0.025 units = 1 px). Judge a change in the 40 px
file first: only the outline, two or three colour blocks and repetition survive there.

What each set must show at 40 px, and how the models do it:

- `soviet_bloc`: long flat identical grey panel slabs in rows (window bands run **across**), one stepped
  sandstone tower with a gold spire and a `team` star (capital only), `team` banners, roof slogans and
  chimney bands. No green anywhere. `temple` is a memorial (ribbed wedge hall, obelisk with a star); `fort`
  is a base (blast walls, bunker, radar dish on a lattice mast, a missile on its launcher, a watch tower).
- `western_modern`: glass towers of different heights (ribs run **up**, `team` crown strip), one white
  dome on the capitol, pitched-roof houses on a lawn round a steepled church. No star, no grey concrete
  except roads. `temple` is a modern church (the Lincoln-memorial option in the research reads as
  `classical` at 40 px); `fort` is the Pentagon beside an airstrip with a jet, control tower and radome.
- `egyptian`: battered (inward-sloping) walls everywhere, a sandstone pylon with `team` banners and a pair
  of pale obelisks with gold caps, a smooth pyramid with a gold capstone, flat-roofed mudbrick houses,
  beehive granaries. `fort` is Buhen: thick battered mudbrick walls with bastions and a pylon gate.
- `highland`: an irregular rock (`hill`) under every model, whitewashed battered blocks with an ochre-red
  band that stands proud like a cornice and a white roof terrace inside it (so the white and red show from
  above), gilded flared roofs on the main buildings, stone terraces, `team` prayer flags and banners.
  `temple` is a cliff monastery; `fort` is a gate tower across the notch between two crags.
- These styles have no town wall where the architecture has none (slabs, towers, terraces): the class
  overrides the kind layout but keeps the footprint.
- Kit pieces added for them (all in `Builder`, usable by any style): `bands`, `strips`, `panel_slab`,
  `star`, `chimney`, `dish`, `lattice_mast`, `colonnade`, `drum_dome`, `poly_ring`, `battered`, `obelisk`,
  `hill`, `terraces`, `flared_roof`, `tower_house`, `prayer_flags`. `lathe` takes `rot=(rx, ry, rz)` to tilt
  the whole solid; `hsh` (repeatable noise) lives in `styles_kit.py`.
- The identity previews tint `team` with a sample colour per style (`TEAM_SAMPLE` in `build_styles.py`:
  red for `soviet_bloc` and `egyptian`, blue for the other two); the GLBs keep the neutral `team`.
- A quick look at some styles, nothing exported: `EXPORT=0 PREVIEW_STYLES=egyptian,highland
  PREVIEW_KINDS=capital,temple PREVIEW_MARGIN=0.4 PREVIEW_OUT=/tmp/look.png` before the blender command
  (add `PREVIEW_PPU=40` for globe scale).

## Technology ages (row A23, contract X4 `ages`)

15 unit models: 5 ages (`ancient`, `medieval`, `gunpowder`, `industrial`, `modern`) x 3 kinds (`army`,
`fleet`, `trader`) in `web/public/models/ages/<age>/<kind>.glb`. Rebuild (also adds the `ages` section
and the shared `trader` fallback to `manifest.json`, keeping everything else, and renders
`assets/preview-ages.png`):

    blender --background --factory-startup --python assets/blender/build_ages.py
    python3 assets/blender/verify_ages.py       # triangles, bounds, one `team` material, size

- `ages_kit.py`: `AgeBuilder` (the styles Builder plus rod, path, prism, loft, ball, disc), the one
  `ages` palette, and the shared pieces: `Hull` (a lofted hull with stripes), mast, sail, lateen, flag,
  funnel, smoke, man, horse. `build()` scales every model so its longest side is 1.
- `ages_defs.py`: one function per model. Everything faces +x (bows and soldiers); ships are drawn
  from the waterline up, so y = 0 in the GLB is the waterline.
- Reading rules: war ships carry `team` sails or a `team` hull stripe; merchants carry plain canvas
  with one `team` stripe and cargo on deck. Every model also has a flat `team` patch on top (awning,
  deck cloth, turret roof, helipad, containers) so its owner shows from straight above.
- Preview a subset, with nothing exported: `PREVIEW_ONLY=1 PREVIEW_AGES=modern PREVIEW_OUT=/tmp/p.png`
  before the blender command (more knobs in the docstring of `build_ages.py`).

## Future and stellar ages (row A26, contract X4 `ages`, `styles.arcology`, `models.satellite`)

12 models, built on their own so no other GLB is touched (also adds their manifest entries, keeping
everything else, and renders `assets/preview-future.png`):

    blender --background --factory-startup --python assets/blender/build_future.py
    python3 assets/blender/verify_ages.py       # the six units and the satellite
    python3 assets/blender/verify_styles.py     # the five arcology buildings

- Units, in `ages_defs.py` (so `build_ages.py` builds them too): `future` is stealth grey with a glowing
  rail (a hover tank under a drone swarm; a railgun stealth cruiser; an autonomous hydrofoil freighter
  with cargo pods), `stellar` is a white shell with teal (a walker mech; a starship; an orbital freighter
  with a ring of cargo pods). Things that fly keep a flat piece on y = 0 (the tank's lift field, the
  ships' wash on the water), so the origin is still the ground or the waterline.
- `arcology`, in `styles_arcology.py` (so `build_styles.py` builds it too): white towers that taper, with
  teal glass bands and a `team` crown, glass domes, sky bridges. The `capital` has the space elevator
  (a tether from the anchor dome to the top of the box, a `team` climber, the counterweight station);
  the `temple` is a luminous needle through a standing ring; the `fort` is an eight-sided bunker under a
  shield dome with four turrets. Keep capital and city near 1,000 triangles (the 60 KB limit).
- `satellite` (`web/public/models/satellite.glb`, `models.satellite`): `satellite()` in `ages_defs.py`,
  panels along z in the GLB. `build_models.py` writes a fresh manifest, so run `build_styles.py`,
  `build_ages.py` and `build_future.py` after it.
- A quick look, nothing exported: `PREVIEW_ONLY=1 PREVIEW_OUT=/tmp/p.png` before the command;
  `PREVIEW_PX=40` renders at globe scale.

## Wonders (row A30, contract X4 `wonders`)

8 landmarks, one per `WonderKind`, in `web/public/models/wonders/<kind>.glb`, built on their own so no
other GLB is touched (also adds the `wonders` section to `manifest.json`, keeping everything else, and
renders `assets/preview-wonders.png`):

    blender --background --factory-startup --python assets/blender/build_wonders.py
    python3 assets/blender/verify_wonders.py    # under 3,000 triangles, bounds, one `team` material, under 120 KB

- `wonders_defs.py`: one function per wonder, on the styles `Builder` with one shared palette (`wonders`,
  registered into `PALETTES` on import). Same rules as every model (primitives, +Y up, origin at the base
  centre, fits 1 x 1 x 1, flat shaded, one `team` material), but the budget is 3,000 triangles and the
  model is one landmark, not a settlement: one big silhouette and two or three colour blocks.
- `great_wall` is one segment: the wall runs along x across the whole box (x = -0.5 to 0.5 exactly, the
  verifier checks it) with the watchtower in the middle, so lane b can repeat it end to end along a border.
- `team` parts: wall banners and flags; the mausoleum's frieze and minaret rings; the sphinx's headcloth
  and the entrance banners; the colossus's sash, belt, shield and the ship's sail; the cathedral's rose
  windows; the palace's stars, banners and pylon roofs; the towers' crown strips; the elevator's ring
  tops, climbers and station ring.
- `footprint` is 2.0 (about two tiles wide), 1.6 for the two tall ones and 1.0 for the wall segment.
- A quick look, nothing exported: `PREVIEW_ONLY=1 PREVIEW_OUT=/tmp/p.png` before the command;
  `PREVIEW_PX=70` renders at the size a wonder has from orbit, `PREVIEW_KINDS=pyramid,colossus` a subset.
