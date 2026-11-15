"""Build only the tree variants (trees_defs.py) and leave every other GLB alone.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_trees.py

Output: web/public/models/trees/<name>.glb, web/public/models/tree.glb (the oak again, so the
contract's `models.tree` stays a good single tree), the `trees` section of manifest.json
(everything else in it stays as it is), assets/preview-trees.png and assets/preview-trees-40px.png.

Preview knobs (environment): PREVIEW_OUT (another png path), PREVIEW_PX (pixels per unit, default
300), PREVIEW_TILT (camera tilt in degrees, default 72: close to the ground view), PREVIEW_NAMES
(a comma list). With PREVIEW_ONLY=1 nothing is exported and only that one sheet is rendered.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from trees_defs import NAMES, TREES, Kit  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
SHOW = [n for n in (os.environ.get("PREVIEW_NAMES") or ",".join(NAMES)).split(",") if n in TREES]
TEAM_SAMPLE = (0.75, 0.2, 0.16, 1)  # preview only: fruit red


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
    manifest["trees"] = {n: {"file": f"trees/{n}.glb", "footprint": TREES[n][1]} for n in NAMES}
    with open(mpath, "w", newline="\n") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def setup_scene(objs):
    """One labelled row on a strip of grass; returns the row width."""
    sp = 1.0
    ink = flat("ink", (0.15, 0.1, 0.07))
    grass = flat("grass", (0.52, 0.60, 0.36))
    for o in objs.values():
        o.location = (0, 0, -50)
    for i, n in enumerate(SHOW):
        gx = (i - (len(SHOW) - 1) / 2) * sp
        objs[n].location = (gx, 0, 0)
        objs[n].rotation_euler = (0, 0, math.radians(25))
        bpy.ops.mesh.primitive_plane_add(size=0.9, location=(gx, 0, -0.003))
        bpy.context.object.data.materials.append(grass)
        bpy.ops.object.text_add(location=(gx, -0.66, 0.0))
        t = bpy.context.object
        t.data.body = n
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
    bpy.data.materials["team"].diffuse_color = TEAM_SAMPLE
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.use_world_space_lighting = False
    sh.studio_light = os.environ.get("PREVIEW_LIGHT", "paint.sl")
    sh.show_specular_highlight = False
    sh.color_type = "MATERIAL"
    sh.show_object_outline = os.environ.get("PREVIEW_OUTLINE", "1") == "1"
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.show_cavity = False
    sh.show_backface_culling = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 100
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.94, 0.89, 0.76)
    return len(SHOW) * sp + 0.3


def render(path, width, px, tilt_deg):
    scene = bpy.context.scene
    cam = scene.camera
    tilt = Euler((math.radians(tilt_deg), 0, 0.0), "XYZ")
    for o in scene.objects:
        if o.name.startswith("label"):
            o.rotation_euler = tilt
    height = 1.0 * math.sin(tilt.x) + 1.5 * math.cos(tilt.x) + 0.35
    cam.data.ortho_scale = max(width, height)
    cam.rotation_euler = tilt
    cam.location = Vector((0.0, 0.0, 0.0)) + tilt.to_matrix() @ Vector((0, 0.42 * math.sin(tilt.x) - 0.13, 30))
    scene.render.resolution_x, scene.render.resolution_y = int(width * px), int(height * px)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = {}
    only = os.environ.get("PREVIEW_ONLY")
    for n in NAMES:
        k = Kit()
        TREES[n][0](k)
        objs[n] = k.build(f"tree_{n}")
        d = objs[n].data
        lo = [min(v.co[i] for v in d.vertices) for i in range(3)]
        hi = [max(v.co[i] for v in d.vertices) for i in range(3)]
        print("built", n, sum(len(p.vertices) - 2 for p in d.polygons), "triangles",
              "x %.2f..%.2f y %.2f..%.2f z %.2f..%.2f" % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
        if not only:
            export(objs[n], f"trees/{n}.glb")
    if not only:
        export(objs["oak"], "tree.glb")
        update_manifest()
    width = setup_scene(objs)
    tilt = float(os.environ.get("PREVIEW_TILT", "72"))
    px = float(os.environ.get("PREVIEW_PX", "300"))
    out = os.environ.get("PREVIEW_OUT")
    if out or only:
        render(out or os.path.join(ROOT, "assets", "preview-trees.png"), width, px, tilt)
    else:
        render(os.path.join(ROOT, "assets", "preview-trees.png"), width, px, tilt)
        render(os.path.join(ROOT, "assets", "preview-trees-40px.png"), width, 40, 48)
    print("done")


main()
