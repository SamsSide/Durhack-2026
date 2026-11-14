"""Build only the launch sequence models (issue #291) and leave every other GLB alone: the rocket, the
booster, the satellite and the 1960s rocket of the modern age.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_launch.py

Output: web/public/models/{rocket,booster,satellite}.glb, web/public/models/ages/modern/rocket.glb,
their manifest entries (models.rocket, models.booster, models.satellite, ages.modern.rocket; everything
else stays as it is) and assets/preview-launch.png. `build_future.py` builds the same satellite.

The booster's footprint is the rocket's times the booster's share of the rocket's height, so drawn at
the same scale from the same origin it covers the rocket's lower stage exactly.
Knobs (environment): PREVIEW_OUT (another png path), PREVIEW_PX; with PREVIEW_ONLY=1 nothing is exported.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ages_defs import satellite  # noqa: E402
from ages_kit import AgeBuilder, export_glb  # noqa: E402
from launch_defs import booster, rocket, rocket_modern  # noqa: E402

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.environ.get("PREVIEW_OUT") or os.path.join(ROOT, "assets", "preview-launch.png")
ROCKET_FOOTPRINT = 0.5
TEAM_SAMPLE = (0.5, 0.13, 0.5, 1)  # preview only
# manifest file path -> builder, in sheet order
MODELS = {"rocket.glb": rocket, "booster.glb": booster, "satellite.glb": satellite, "ages/modern/rocket.glb": rocket_modern}


def build_one(fn, name):
    b = AgeBuilder()
    fn(b)
    ext = max(max(v.co[i] for v in b.bm.verts) - min(v.co[i] for v in b.bm.verts) for i in range(3))
    return b.build(name), ext


def update_manifest(ext):
    mpath = os.path.join(OUT_DIR, "manifest.json")
    with open(mpath) as f:
        manifest = json.load(f)
    models = manifest["models"]
    models["rocket"] = {"file": "rocket.glb", "footprint": ROCKET_FOOTPRINT}
    models["booster"] = {"file": "booster.glb",
                         "footprint": round(ROCKET_FOOTPRINT * ext["booster.glb"] / ext["rocket.glb"], 3)}
    models["satellite"] = {"file": "satellite.glb", "footprint": models.get("satellite", {}).get("footprint", 0.3)}
    manifest["ages"]["modern"]["rocket"] = {"file": "ages/modern/rocket.glb", "footprint": ROCKET_FOOTPRINT}
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    return models["booster"]["footprint"]


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def preview(objs, ext):
    """One row: the rocket, the booster at the rocket's scale, the satellite, the modern rocket."""
    scene = bpy.context.scene
    sp_x = 1.5
    ink = flat("ink", (0.15, 0.1, 0.07))
    pad = flat("pad", (0.80, 0.78, 0.70))
    tilt = Euler((math.radians(70), 0, 0), "XYZ")
    labels = {"rocket.glb": "rocket", "booster.glb": "booster", "satellite.glb": "satellite",
              "ages/modern/rocket.glb": "ages.modern.rocket"}
    for c, (rel, o) in enumerate(objs.items()):
        gx = (c - (len(objs) - 1) / 2) * sp_x
        o.location = (gx, 0, 0)
        o.rotation_euler = (0, 0, math.radians(-30))
        if rel == "booster.glb":
            o.scale = (ext[rel] / ext["rocket.glb"],) * 3
        bpy.ops.mesh.primitive_plane_add(size=1.2, location=(gx, 0, -0.004))
        bpy.context.object.data.materials.append(pad)
        bpy.ops.object.text_add(location=(gx, -0.85, 0))
        t = bpy.context.object
        t.data.body = labels[rel]
        t.data.align_x = "CENTER"
        t.data.size = 0.13
        t.data.materials.append(ink)
        t.rotation_euler = tilt
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    width, height = len(objs) * sp_x + 0.4, 1.9
    cam_data.ortho_scale = width
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.rotation_euler = tilt
    cam.location = Vector((0, 0, 0.4)) + tilt.to_matrix() @ Vector((0, 0, 30))
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    px = float(os.environ.get("PREVIEW_PX", "180"))
    scene.render.resolution_x, scene.render.resolution_y = int(width * px), int(height * px)
    scene.view_settings.view_transform = "Standard"
    bpy.data.materials["team"].diffuse_color = TEAM_SAMPLE
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.use_world_space_lighting = False
    sh.studio_light = "paint.sl"
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
    only = os.environ.get("PREVIEW_ONLY")
    objs, ext = {}, {}
    for rel, fn in MODELS.items():
        objs[rel], ext[rel] = build_one(fn, rel.replace("/", "_").replace(".glb", ""))
        if not only:
            path = os.path.join(OUT_DIR, rel)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            export_glb(objs[rel], path)
        print("built", rel, sum(len(p.vertices) - 2 for p in objs[rel].data.polygons), "triangles")
    if not only:
        print("booster footprint", update_manifest(ext))
    preview(objs, ext)
    print("done")


main()
