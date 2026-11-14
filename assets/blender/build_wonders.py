"""Build only the eight wonders of row A30 (wonders_defs.py) and leave every other GLB alone.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_wonders.py

Output: web/public/models/wonders/<kind>.glb, the `wonders` section of manifest.json (everything
else in it stays as it is) and assets/preview-wonders.png.

Preview knobs (environment): PREVIEW_OUT (another png path), PREVIEW_PX (pixels per unit, default 260;
70 is how big lane b draws a wonder from orbit), PREVIEW_TILT (camera tilt in degrees),
PREVIEW_KINDS (a comma list). With PREVIEW_ONLY=1 nothing is exported.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from styles_kit import Builder  # noqa: E402
from wonders_defs import FOOTPRINT, KINDS, PREVIEW_TURN, WONDERS  # noqa: E402

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.environ.get("PREVIEW_OUT") or os.path.join(ROOT, "assets", "preview-wonders.png")
SHOW = [k for k in (os.environ.get("PREVIEW_KINDS") or ",".join(KINDS)).split(",") if k in KINDS]
TEAM_SAMPLE = (0.62, 0.1, 0.12, 1)  # preview only: a nation red
SEA = {"colossus"}


def build_all():
    """{manifest file path: object}, in sheet order."""
    objs = {}
    for kind in KINDS:
        b = Builder("wonders")
        WONDERS[kind](b)
        objs[f"wonders/{kind}.glb"] = b.build(f"wonder_{kind}")
    return objs


def export(obj, rel):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(OUT_DIR, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
        export_texcoords=False, export_normals=True, export_materials="EXPORT", export_extras=False,
        export_animations=False,
    )


def update_manifest():
    mpath = os.path.join(OUT_DIR, "manifest.json")
    with open(mpath) as f:
        manifest = json.load(f)
    manifest["wonders"] = {k: {"file": f"wonders/{k}.glb", "footprint": FOOTPRINT[k]} for k in KINDS}
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def preview(objs):
    """Two labelled rows of four."""
    scene = bpy.context.scene
    sp_x, sp_y = 1.7, 2.7
    ink = flat("ink", (0.15, 0.1, 0.07))
    grounds = {"land": flat("land", (0.80, 0.78, 0.66)), "sea": flat("sea", (0.56, 0.70, 0.74))}
    tilt = Euler((math.radians(float(os.environ.get("PREVIEW_TILT", "52"))), 0, 0.0), "XYZ")
    cols = min(4, len(SHOW))
    rows = [SHOW[i:i + cols] for i in range(0, len(SHOW), cols)]
    for o in objs.values():
        o.location = (0, 0, -50)

    def label(text, x, y, size, align="CENTER"):
        bpy.ops.object.text_add(location=(x, y, 0.0))
        t = bpy.context.object
        t.data.body = text
        t.data.align_x = align
        t.data.size = size
        t.data.materials.append(ink)
        t.rotation_euler = tilt

    for r, cells in enumerate(rows):
        gy = ((len(rows) - 1) / 2 - r) * sp_y
        for c, kind in enumerate(cells):
            gx = (c - (cols - 1) / 2) * sp_x
            o = objs[f"wonders/{kind}.glb"]
            o.location = (gx, gy, 0.0)
            o.rotation_euler = (0, 0, math.radians(PREVIEW_TURN.get(kind, 0)))
            bpy.ops.mesh.primitive_plane_add(size=1.45, location=(gx, gy, -0.004))
            bpy.context.object.data.materials.append(grounds["sea" if kind in SEA else "land"])
            label(kind, gx, gy - 0.95, 0.14)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    width = cols * sp_x + 0.6
    height = len(rows) * sp_y * math.cos(tilt.x) + 1.3      # the ground is foreshortened by the tilt
    cam_data.ortho_scale = max(width, height)
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.rotation_euler = tilt
    cam.location = Vector((0.0, 0.25, 0.0)) + tilt.to_matrix() @ Vector((0, 0, 30))
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    px = float(os.environ.get("PREVIEW_PX", "260"))
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
