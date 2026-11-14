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
same 5 kinds, in `styles_identity.py` (one class per style, palettes in `styles_kit.py`). The command now
renders `assets/preview-styles.png` (all ten styles) and `assets/preview-identity.png` (these four, larger).

- `soviet_bloc`: panel slab blocks, a setback tower with a spire and star over a parade square. Its
  `temple` is a memorial (wedge-shaped concrete hall and an obelisk with a star); its `fort` is a
  military base (blast walls, bunker, radar, missile launcher).
- `western_modern`: glass towers, a white domed capitol on a lawn, pitched-roof suburbs round a clock-tower
  town hall. Its `temple` is a cathedral hall (slate nave, glass, a spired bell tower); its `fort` is an
  airbase (runway, hangars, control tower, radar, a jet).
- `egyptian`: pylon gates with banner poles, obelisks, a gold-capped pyramid, mudbrick houses, granaries.
- `highland`: green stone terraces, battered white blocks with an ochre band (dzong), slate roofs, prayer
  flags; the `temple` is a cliff monastery and the `fort` a gate tower between two crags.
- These styles have no town wall where the architecture has none (slabs, towers, terraces): the class
  overrides the kind layout but keeps the footprint.
- A quick look at some styles: `PREVIEW_STYLES=egyptian,highland PREVIEW_KINDS=capital,temple
  PREVIEW_MARGIN=0.4 PREVIEW_OUT=/tmp/look.png` before the blender command (the GLBs are still all rebuilt).

- Preview a subset: `PREVIEW_STYLES=scrap,desert PREVIEW_KINDS=capital,temple` before the blender command.

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
