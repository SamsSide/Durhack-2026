"""Build the 30 building-style models (6 styles x 5 kinds), update the manifest, render the preview.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_styles.py

Output: web/public/models/<style>/<kind>.glb, the `styles` section of manifest.json (the existing
`version` and `models` stay as they are) and assets/preview-styles.png.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from styles_defs import STYLES  # noqa: E402
from styles_kit import Builder  # noqa: E402

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.path.join(ROOT, "assets", "preview-styles.png")

KINDS = ["capital", "city", "town", "temple", "fort"]
FOOTPRINT = {"capital": 1.0, "city": 1.0, "town": 0.9, "temple": 0.7, "fort": 0.7}


def build_one(style, kind):
    b = Builder(style)
    getattr(STYLES[style], kind)(b)
    return b.build(f"{style}_{kind}")


def export(obj, style, kind):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    os.makedirs(os.path.join(OUT_DIR, style), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, style, kind + ".glb"), export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
        export_texcoords=False, export_normals=True, export_materials="EXPORT", export_extras=False,
        export_animations=False,
    )


def preview(objs):
    scene = bpy.context.scene
    sp_x, sp_y = 1.55, 1.75
    ink = bpy.data.materials.new("ink")
    ink.diffuse_color = (0.15, 0.1, 0.07, 1)
    tile = bpy.data.materials.new("tile")
    tile.diffuse_color = (0.96, 0.90, 0.74, 1)
    styles = [x for x in os.environ.get("PREVIEW_STYLES", ",".join(STYLES)).split(",")]
    kinds = [x for x in os.environ.get("PREVIEW_KINDS", ",".join(KINDS)).split(",")]
    rows = len(styles)
    cols = len(kinds)
    tilt = Euler((math.radians(48), 0, 0.0), "XYZ")

    def label(text, x, y, size, align="CENTER"):
        bpy.ops.object.text_add(location=(x, y, 0.0))
        t = bpy.context.object
        t.data.body = text
        t.data.align_x = align
        t.data.size = size
        t.data.materials.append(ink)
        t.rotation_euler = tilt

    for key, o in objs.items():
        if key[0] not in styles or key[1] not in kinds:
            o.hide_render = True
    for r, style in enumerate(styles):
        for c, kind in enumerate(kinds):
            gx = (c - (cols - 1) / 2) * sp_x + 0.5
            gy = ((rows - 1) / 2 - r) * sp_y
            objs[(style, kind)].location = (gx, gy, 0.0)
            bpy.ops.mesh.primitive_plane_add(size=1.35, location=(gx, gy, -0.004))
            bpy.context.object.data.materials.append(tile)
            label(kind, gx, gy - 0.98, 0.15)
        label(style, -(cols / 2) * sp_x - 0.25, ((rows - 1) / 2 - r) * sp_y, 0.17, align="RIGHT")
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = cols * 1.55 + 4.0
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.rotation_euler = tilt
    cam.location = Vector((-0.5, 0.3, 0.0)) + tilt.to_matrix() @ Vector((0, 0, 30))
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 2000, int(2000 * (rows * 1.55 + 3.4) / (cols * 1.55 + 4.0))
    scene.view_settings.view_transform = "Standard"
    bpy.data.materials["team"].diffuse_color = (0.2, 0.36, 0.78, 1)  # preview only: a nation blue
    sh = scene.display.shading
    sh.light = "STUDIO"
    sl = os.environ.get("PREVIEW_LIGHT")
    if sl:
        sh.studio_light = sl
    sh.use_world_space_lighting = True
    sh.show_specular_highlight = False
    sh.color_type = "MATERIAL"
    sh.show_object_outline = True
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.show_cavity = False
    scene.render.resolution_percentage = int(os.environ.get("PREVIEW_PCT", "100"))
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PREVIEW
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.94, 0.89, 0.76)
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = {}
    for style in STYLES:
        for kind in KINDS:
            obj = build_one(style, kind)
            objs[(style, kind)] = obj
            export(obj, style, kind)
            print("exported", style, kind, len(obj.data.polygons), "faces")
    mpath = os.path.join(OUT_DIR, "manifest.json")
    with open(mpath) as f:
        manifest = json.load(f)
    manifest["styles"] = {s: {k: {"file": f"{s}/{k}.glb", "footprint": FOOTPRINT[k]} for k in KINDS} for s in STYLES}
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    preview(objs)
    print("done")


main()
