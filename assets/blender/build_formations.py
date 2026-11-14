"""Build only the 21 army formation models (issue #287) and leave every other GLB alone.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_formations.py

Output: web/public/models/ages/<age>/formation_{front,flank,back}.glb, `ages.<age>.formation` in
manifest.json (everything else in it stays as it is, `ages.<age>.army` included), and the previews
assets/preview-formations.png and assets/preview-formations-40px.png (one model unit = 40 px).

Footprints keep one scale for all 21: footprint = FOOT_PER_UNIT x the model's longest side as drawn,
so a soldier is the same size in the front, flank and back models of every age (the age `army`
model is 0.5).

Preview knobs (environment): PREVIEW_AGES and PREVIEW_ROLES (comma lists), PREVIEW_OUT (another png
path; then no 40 px sheet), PREVIEW_PX (pixels per unit, default 200), PREVIEW_TILT, PREVIEW_RZ.
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
from ages_defs import AGES  # noqa: E402
from ages_kit import AgeBuilder, export_glb  # noqa: E402
from formations_defs import FORMATIONS, ROLES  # noqa: E402

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.environ.get("PREVIEW_OUT") or os.path.join(ROOT, "assets", "preview-formations.png")
PREVIEW_40 = None if os.environ.get("PREVIEW_OUT") else os.path.join(ROOT, "assets", "preview-formations-40px.png")
FOOT_PER_UNIT = 0.32
TEAM_SAMPLE = (0.5, 0.13, 0.5, 1)  # preview only: a nation purple, unlike any palette colour


def build_one(age, role):
    b = AgeBuilder()
    FORMATIONS[(age, role)](b)
    ext = max(max(v.co[i] for v in b.bm.verts) - min(v.co[i] for v in b.bm.verts) for i in range(3))
    return b.build(f"{age}_formation_{role}"), round(ext * FOOT_PER_UNIT, 2)


def rel(age, role):
    return f"ages/{age}/formation_{role}.glb"


def update_manifest(feet):
    mpath = os.path.join(OUT_DIR, "manifest.json")
    with open(mpath) as f:
        manifest = json.load(f)
    for age in AGES:
        manifest["ages"][age]["formation"] = {r: {"file": rel(age, r), "footprint": feet[(age, r)]} for r in ROLES}
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def preview(objs):
    scene = bpy.context.scene
    sp_x, sp_y = 1.6, 2.5
    ink = flat("ink", (0.15, 0.1, 0.07))
    land = flat("land", (0.86, 0.80, 0.62))
    ages = os.environ.get("PREVIEW_AGES", ",".join(AGES)).split(",")
    roles = os.environ.get("PREVIEW_ROLES", ",".join(ROLES)).split(",")
    rows, cols = len(ages), len(roles)
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
        if key[0] not in ages or key[1] not in roles:
            o.hide_render = True
    for r, age in enumerate(ages):
        gy = ((rows - 1) / 2 - r) * sp_y
        for c, role in enumerate(roles):
            gx = (c - (cols - 1) / 2) * sp_x + 0.5
            o = objs[(age, role)]
            o.location = (gx, gy, 0.0)
            o.rotation_euler = (0, 0, rz)
            bpy.ops.mesh.primitive_plane_add(size=1.4, location=(gx, gy, -0.004))
            bpy.context.object.data.materials.append(land)
            label(role, gx, gy - 0.9, 0.13)
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
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.94, 0.89, 0.76)
    shots = [(PREVIEW, float(os.environ.get("PREVIEW_PX", "200")))]
    if PREVIEW_40:
        shots.append((PREVIEW_40, 40.0))
    for path, px in shots:
        scene.render.resolution_x, scene.render.resolution_y = int(width * px), int(height * px)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    only = os.environ.get("PREVIEW_ONLY")
    objs, feet = {}, {}
    for age in AGES:
        for role in ROLES:
            obj, foot = build_one(age, role)
            objs[(age, role)], feet[(age, role)] = obj, foot
            if not only:
                path = os.path.join(OUT_DIR, rel(age, role))
                os.makedirs(os.path.dirname(path), exist_ok=True)
                export_glb(obj, path)
            print("built", age, role, sum(len(p.vertices) - 2 for p in obj.data.polygons), "triangles, footprint", foot)
    if not only:
        update_manifest(feet)
    preview(objs)
    print("done")


main()
