"""Build only the remodelled base models (base_defs.py: farm, camp, factory, ruin) and leave every
other GLB and the manifest alone (their keys, files and footprints do not change).

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_base.py

Output: web/public/models/<key>.glb for the four, assets/preview-base-remodel.png and
assets/preview-base-remodel-40px.png.

Knobs (environment): ONLY (a comma list of keys to build, export and show), PREVIEW_ONLY=1 (nothing
exported, one sheet rendered), PREVIEW_OUT (another png path), PREVIEW_PX (pixels per unit, default
300), PREVIEW_TILT (camera tilt in degrees, default 62: close to the ground view), PREVIEW_TURN
(degrees the models are turned, default -28), BEFORE_DIR (a folder holding older <key>.glb files:
they are drawn as a second row behind the new ones, for a before and after sheet).
"""
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from base_defs import KEYS, build  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
SHOW = [k for k in (os.environ.get("ONLY") or ",".join(KEYS)).split(",") if k in KEYS]
BEFORE = os.environ.get("BEFORE_DIR")
TEAM_SAMPLE = (0.70, 0.16, 0.14, 1)  # preview only: a nation red
SP_X, SP_Y = 1.3, 2.5


def export(obj, rel):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, rel), export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
        export_texcoords=False, export_normals=True, export_materials="EXPORT", export_extras=False,
        export_animations=False,
    )


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def load_before(key):
    path = os.path.join(BEFORE, key + ".glb")
    if not os.path.exists(path):
        return None
    had = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in had and o.type == "MESH"]
    return new[0] if new else None


def setup_scene(objs):
    """The new models in a labelled row on grass (the older ones in a row behind); returns the
    sheet's width and the number of rows."""
    ink = flat("ink", (0.15, 0.1, 0.07))
    grass = flat("grass", (0.60, 0.66, 0.42))
    turn = math.radians(float(os.environ.get("PREVIEW_TURN", "-28")))
    rows = [("", objs)]
    if BEFORE:
        rows.insert(0, (" (before)", {k: load_before(k) for k in SHOW}))
    for r, (suffix, row) in enumerate(rows):
        gy = ((len(rows) - 1) / 2 - r) * SP_Y
        for i, k in enumerate(SHOW):
            if row.get(k) is None:
                continue
            gx = (i - (len(SHOW) - 1) / 2) * SP_X
            row[k].location = (gx, gy, 0)
            row[k].rotation_mode = "XYZ"
            row[k].rotation_euler = (0, 0, turn)
            bpy.ops.mesh.primitive_plane_add(size=1.16, location=(gx, gy, -0.003))
            bpy.context.object.data.materials.append(grass)
            bpy.ops.object.text_add(location=(gx, gy - 0.76, 0.0))
            t = bpy.context.object
            t.data.body = k + suffix
            t.data.align_x = "CENTER"
            t.data.size = 0.11
            t.data.materials.append(ink)
            t.name = "label"
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.view_settings.view_transform = "Standard"
    for m in bpy.data.materials:
        if m.name.split(".")[0] == "team":
            m.diffuse_color = TEAM_SAMPLE
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.use_world_space_lighting = False
    sh.studio_light = os.environ.get("PREVIEW_LIGHT", "paint.sl")
    sh.show_specular_highlight = False
    sh.color_type = "MATERIAL"
    sh.show_object_outline = os.environ.get("PREVIEW_OUTLINE", "1") == "1"
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.show_cavity = False
    sh.show_backface_culling = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 100
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.94, 0.89, 0.76)
    return len(SHOW) * SP_X + 0.2, len(rows)


def render(path, width, rows, px, tilt_deg):
    scene = bpy.context.scene
    cam = scene.camera
    tilt = Euler((math.radians(tilt_deg), 0, 0.0), "XYZ")
    for o in scene.objects:
        if o.name.startswith("label"):
            o.rotation_euler = tilt
    c, s = math.cos(tilt.x), math.sin(tilt.x)
    back = (rows - 1) / 2 * SP_Y
    top = (back + 0.5) * c + 1.0 * s + 0.08          # the top of a full-height model in the back row
    bottom = (-back - 0.76) * c - 0.22              # under the front row's labels
    height = top - bottom
    cam.data.ortho_scale = max(width, height)
    cam.rotation_euler = tilt
    cam.location = tilt.to_matrix() @ Vector((0, (top + bottom) / 2, 30))
    scene.render.resolution_x, scene.render.resolution_y = int(width * px), int(height * px)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    only = os.environ.get("PREVIEW_ONLY")
    objs = {}
    for k in SHOW:
        objs[k] = build(k)
        d = objs[k].data
        lo = [min(v.co[i] for v in d.vertices) for i in range(3)]
        hi = [max(v.co[i] for v in d.vertices) for i in range(3)]
        print("built", k, sum(len(p.vertices) - 2 for p in d.polygons), "triangles",
              "x %.2f..%.2f y %.2f..%.2f z %.2f..%.2f" % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
        if not only:
            export(objs[k], k + ".glb")
    width, rows = setup_scene(objs)
    tilt = float(os.environ.get("PREVIEW_TILT", "62"))
    px = float(os.environ.get("PREVIEW_PX", "300"))
    out = os.environ.get("PREVIEW_OUT")
    if out or only:
        render(out or os.path.join(ROOT, "assets", "preview-base-remodel.png"), width, rows, px, tilt)
    else:
        render(os.path.join(ROOT, "assets", "preview-base-remodel.png"), width, rows, px, tilt)
        render(os.path.join(ROOT, "assets", "preview-base-remodel-40px.png"), width, rows, 40, 48)
    print("done")


main()
