"""Build the 21 technology-age unit models (7 ages x army, fleet, trader), update the manifest,
render the preview.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_ages.py

Output: web/public/models/ages/<age>/<kind>.glb, the `ages` section and the shared `trader`
fallback in manifest.json (everything else in it stays as it is) and assets/preview-ages.png.

Preview knobs (environment): PREVIEW_AGES and PREVIEW_KINDS (comma lists), PREVIEW_OUT (another
png path), PREVIEW_TILT (camera tilt in degrees), PREVIEW_RZ (model turn), PREVIEW_PX (pixels per unit),
PREVIEW_LIGHT (a workbench studio light).
With PREVIEW_ONLY=1 nothing is exported.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ages_defs import AGES, KINDS, MODELS  # noqa: E402
from ages_kit import AgeBuilder  # noqa: E402

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.environ.get("PREVIEW_OUT") or os.path.join(ROOT, "assets", "preview-ages.png")
FOOTPRINT = {"army": 0.5, "fleet": 0.5, "trader": 0.45}
TEAM_SAMPLE = (0.5, 0.13, 0.5, 1)  # preview only: a nation purple, unlike any palette colour


def build_one(age, kind):
    b = AgeBuilder()
    MODELS[(age, kind)](b)
    return b.build(f"{age}_{kind}")


def export(obj, age, kind):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    os.makedirs(os.path.join(OUT_DIR, "ages", age), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, "ages", age, kind + ".glb"), export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
        export_texcoords=False, export_normals=True, export_materials="EXPORT", export_extras=False,
        export_animations=False,
    )


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def preview(objs):
    scene = bpy.context.scene
    sp_x, sp_y = 1.6, 2.5
    ink = flat("ink", (0.15, 0.1, 0.07))
    land = flat("land", (0.86, 0.80, 0.62))
    sea = flat("sea", (0.56, 0.70, 0.74))
    ages = os.environ.get("PREVIEW_AGES", ",".join(AGES)).split(",")
    kinds = os.environ.get("PREVIEW_KINDS", ",".join(KINDS)).split(",")
    rows, cols = len(ages), len(kinds)
    tilt = Euler((math.radians(float(os.environ.get("PREVIEW_TILT", "52"))), 0, 0.0), "XYZ")
    rz = math.radians(float(os.environ.get("PREVIEW_RZ", "-32")))

    def label(text, x, y, size, align="CENTER"):
        bpy.ops.object.text_add(location=(x, y, 0.0))
        t = bpy.context.object
        t.data.body = text
        t.data.align_x = align
        t.data.size = size
        t.data.materials.append(ink)
        t.rotation_euler = tilt

    for key, o in objs.items():
        if key[0] not in ages or key[1] not in kinds:
            o.hide_render = True
    for r, age in enumerate(ages):
        gy = ((rows - 1) / 2 - r) * sp_y
        for c, kind in enumerate(kinds):
            gx = (c - (cols - 1) / 2) * sp_x + 0.5
            o = objs[(age, kind)]
            o.location = (gx, gy, 0.0)
            o.rotation_euler = (0, 0, rz)
            bpy.ops.mesh.primitive_plane_add(size=1.4, location=(gx, gy, -0.004))
            bpy.context.object.data.materials.append(land if kind == "army" else sea)
            label(kind, gx, gy - 0.9, 0.13)
        label(age, -(cols / 2) * sp_x + 0.2, gy, 0.17, align="RIGHT")
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    width = cols * sp_x + 2.2
    height = rows * sp_y * math.cos(tilt.x) + 1.0      # the ground is foreshortened by the tilt
    cam_data.ortho_scale = max(width, height)
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.rotation_euler = tilt
    cam.location = Vector((-0.2, 0.12, 0.0)) + tilt.to_matrix() @ Vector((0, 0, 30))
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
    scene.render.resolution_percentage = int(os.environ.get("PREVIEW_PCT", "100"))
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
    objs = {}
    for age in AGES:
        for kind in KINDS:
            obj = build_one(age, kind)
            objs[(age, kind)] = obj
            if not only:
                export(obj, age, kind)
            print("built", age, kind, sum(len(p.vertices) - 2 for p in obj.data.polygons), "triangles")
    if not only:
        mpath = os.path.join(OUT_DIR, "manifest.json")
        with open(mpath) as f:
            manifest = json.load(f)
        manifest["models"]["trader"] = {"file": "ages/medieval/trader.glb", "footprint": FOOTPRINT["trader"]}
        manifest["ages"] = {a: {k: {"file": f"ages/{a}/{k}.glb", "footprint": FOOTPRINT[k]} for k in KINDS} for a in AGES}
        with open(mpath, "w") as f:
            json.dump(manifest, f, indent=2)
            f.write("\n")
    preview(objs)
    print("done")


main()
