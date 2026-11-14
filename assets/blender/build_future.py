"""Build only the 12 models of row A26 and leave every other GLB alone: the future and stellar
units (ages_defs.py), the `arcology` building style (styles_arcology.py) and the `satellite`.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_future.py

Output: web/public/models/ages/{future,stellar}/<kind>.glb, web/public/models/arcology/<kind>.glb,
web/public/models/satellite.glb, their entries in manifest.json (ages.future, ages.stellar,
styles.arcology, models.satellite; everything else in it stays as it is) and assets/preview-future.png.

Preview knobs (environment): PREVIEW_OUT (another png path), PREVIEW_PX (pixels per unit, default 200;
40 is globe scale), PREVIEW_TILT (camera tilt in degrees). With PREVIEW_ONLY=1 nothing is exported.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ages_defs import KINDS as UNIT_KINDS, MODELS as UNIT_MODELS, satellite  # noqa: E402
from ages_kit import AgeBuilder, export_glb  # noqa: E402
from styles_arcology import ARCOLOGY_STYLES  # noqa: E402
from styles_kit import Builder  # noqa: E402

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.environ.get("PREVIEW_OUT") or os.path.join(ROOT, "assets", "preview-future.png")
AGES = ["future", "stellar"]
STYLE = "arcology"
BUILDING_KINDS = ["capital", "city", "town", "temple", "fort"]
UNIT_FOOTPRINT = {"army": 0.5, "fleet": 0.5, "trader": 0.45}
BUILDING_FOOTPRINT = {"capital": 1.0, "city": 1.0, "town": 0.9, "temple": 0.7, "fort": 0.7}
SATELLITE_FOOTPRINT = 0.3
TEAM_SAMPLE = (0.5, 0.13, 0.5, 1)  # preview only: a nation purple, unlike any palette colour


def build_all():
    """{manifest file path: object}, in sheet order."""
    objs = {}
    for age in AGES:
        for kind in UNIT_KINDS:
            b = AgeBuilder()
            UNIT_MODELS[(age, kind)](b)
            objs[f"ages/{age}/{kind}.glb"] = b.build(f"{age}_{kind}")
    for kind in BUILDING_KINDS:
        b = Builder(STYLE)
        getattr(ARCOLOGY_STYLES[STYLE], kind)(b)
        objs[f"{STYLE}/{kind}.glb"] = b.build(f"{STYLE}_{kind}")
    b = AgeBuilder()
    satellite(b)
    objs["satellite.glb"] = b.build("satellite")
    return objs


def export(obj, rel):
    path = os.path.join(OUT_DIR, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    export_glb(obj, path)


def update_manifest():
    mpath = os.path.join(OUT_DIR, "manifest.json")
    with open(mpath) as f:
        manifest = json.load(f)
    manifest["models"]["satellite"] = {"file": "satellite.glb", "footprint": SATELLITE_FOOTPRINT}
    manifest["styles"][STYLE] = {k: {"file": f"{STYLE}/{k}.glb", "footprint": BUILDING_FOOTPRINT[k]} for k in BUILDING_KINDS}
    for a in AGES:
        old = manifest["ages"].get(a, {})
        manifest["ages"][a] = {k: {"file": f"ages/{a}/{k}.glb", "footprint": UNIT_FOOTPRINT[k]} for k in UNIT_KINDS}
        for k, v in old.items():                                          # formation, rocket: other scripts own them
            if k not in UNIT_KINDS:
                manifest["ages"][a][k] = v
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def preview(objs):
    """Three labelled rows: future units and the satellite, stellar units, the arcology buildings."""
    scene = bpy.context.scene
    sp_x, sp_y = 1.6, 2.6
    ink = flat("ink", (0.15, 0.1, 0.07))
    grounds = {"land": flat("land", (0.86, 0.80, 0.62)), "sea": flat("sea", (0.56, 0.70, 0.74)),
               "tile": flat("tile", (0.80, 0.78, 0.70)), "sky": flat("sky", (0.20, 0.23, 0.33))}
    tilt = Euler((math.radians(float(os.environ.get("PREVIEW_TILT", "50"))), 0, 0.0), "XYZ")
    rz = math.radians(-32)
    unit_ground = {"army": "land", "fleet": "sea", "trader": "sea"}
    rows = [("future", [(k, f"ages/future/{k}.glb", unit_ground[k], rz) for k in UNIT_KINDS]
             + [("satellite", "satellite.glb", "sky", rz)]),
            ("stellar", [(k, f"ages/stellar/{k}.glb", unit_ground[k], rz) for k in UNIT_KINDS]),
            ("arcology", [(k, f"{STYLE}/{k}.glb", "tile", 0.0) for k in BUILDING_KINDS])]
    cols = max(len(cells) for _, cells in rows)

    def label(text, x, y, size, align="CENTER"):
        bpy.ops.object.text_add(location=(x, y, 0.0))
        t = bpy.context.object
        t.data.body = text
        t.data.align_x = align
        t.data.size = size
        t.data.materials.append(ink)
        t.rotation_euler = tilt

    for r, (name, cells) in enumerate(rows):
        gy = ((len(rows) - 1) / 2 - r) * sp_y
        for c, (text, rel, ground, turn) in enumerate(cells):
            gx = (c - (cols - 1) / 2) * sp_x + 0.5
            o = objs[rel]
            o.location = (gx, gy, 0.0)
            o.rotation_euler = (0, 0, turn)
            bpy.ops.mesh.primitive_plane_add(size=1.4, location=(gx, gy, -0.004))
            bpy.context.object.data.materials.append(grounds[ground])
            label(text, gx, gy - 0.9, 0.13)
        label(name, -(cols / 2) * sp_x + 0.2, gy, 0.17, align="RIGHT")
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    width = cols * sp_x + 2.2
    height = len(rows) * sp_y * math.cos(tilt.x) + 1.3      # the ground is foreshortened by the tilt
    cam_data.ortho_scale = max(width, height)
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.rotation_euler = tilt
    cam.location = Vector((-0.2, 0.3, 0.0)) + tilt.to_matrix() @ Vector((0, 0, 30))
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    px = float(os.environ.get("PREVIEW_PX", "200"))
    scene.render.resolution_x, scene.render.resolution_y = int(width * px), int(height * px)
    scene.view_settings.view_transform = "Standard"
    bpy.data.materials["team"].diffuse_color = TEAM_SAMPLE
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.use_world_space_lighting = False
    sh.studio_light = os.environ.get("PREVIEW_LIGHT", "paint.sl")
    sh.show_specular_highlight = False
    sh.color_type = "MATERIAL"
    sh.show_object_outline = True
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.show_cavity = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 100
    scene.render.filepath = PREVIEW
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.94, 0.89, 0.76)
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = build_all()
    for rel, obj in objs.items():
        if not os.environ.get("PREVIEW_ONLY"):
            export(obj, rel)
        print("built", rel, sum(len(p.vertices) - 2 for p in obj.data.polygons), "triangles")
    if not os.environ.get("PREVIEW_ONLY"):
        update_manifest()
    preview(objs)
    print("done")


main()
