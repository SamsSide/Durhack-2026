"""Build the 50 building-style models (10 styles x 5 kinds), update the manifest, render the preview.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_styles.py

Output: web/public/models/<style>/<kind>.glb, the `styles` section of manifest.json (the existing
`version` and `models` stay as they are), assets/preview-styles.png (all ten styles),
assets/preview-identity.png (the four nation-identity styles of row A24, larger) and
assets/preview-identity-40px.png (the same four at globe scale: one model unit = 40 px).
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
from styles_identity import IDENTITY_STYLES  # noqa: E402
from styles_kit import Builder  # noqa: E402

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.path.join(ROOT, "assets", "preview-styles.png")
PREVIEW_IDENTITY = os.path.join(ROOT, "assets", "preview-identity.png")
PREVIEW_IDENTITY_40 = os.path.join(ROOT, "assets", "preview-identity-40px.png")
# Sample nation colours for the identity previews only (the GLBs keep the neutral `team`).
TEAM_SAMPLE = {"soviet_bloc": (0.72, 0.1, 0.08), "western_modern": (0.13, 0.25, 0.62),
               "egyptian": (0.75, 0.2, 0.12), "highland": (0.16, 0.36, 0.72)}
STYLES.update(IDENTITY_STYLES)

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


def preview(objs, styles, path, margin=4.0, width=2000, sp_y=1.75, sp_x=1.55, ppu=None, text=1.0, team=None):
    """Render a labelled grid (one row per style) to `path`. `margin` is the space left for labels.
    ppu (pixels per model unit) sets the image width instead of `width`; `text` scales the labels;
    `team` maps a style to a sample nation colour (default: one blue for every style)."""
    scene = bpy.context.scene
    ink = bpy.data.materials.get("ink") or bpy.data.materials.new("ink")
    ink.diffuse_color = (0.15, 0.1, 0.07, 1)
    tile = bpy.data.materials.get("tile") or bpy.data.materials.new("tile")
    tile.diffuse_color = (0.96, 0.90, 0.74, 1)
    kinds = [x for x in os.environ.get("PREVIEW_KINDS", ",".join(KINDS)).split(",")]
    rows = len(styles)
    cols = len(kinds)
    tilt = Euler((math.radians(48), 0, 0.0), "XYZ")
    extra = []

    def label(text, x, y, size, align="CENTER"):
        bpy.ops.object.text_add(location=(x, y, 0.0))
        t = bpy.context.object
        t.data.body = text
        t.data.align_x = align
        t.data.size = size
        t.data.materials.append(ink)
        t.rotation_euler = tilt
        extra.append(t)

    for key, o in objs.items():
        o.hide_render = key[0] not in styles or key[1] not in kinds
    for r, style in enumerate(styles):
        for c, kind in enumerate(kinds):
            gx = (c - (cols - 1) / 2) * sp_x + 0.5
            gy = ((rows - 1) / 2 - r) * sp_y
            objs[(style, kind)].location = (gx, gy, 0.0)
            bpy.ops.mesh.primitive_plane_add(size=1.35, location=(gx, gy, -0.004))
            bpy.context.object.data.materials.append(tile)
            extra.append(bpy.context.object)
            if r == rows - 1:  # kind names once, under the last row, so they never cover a model
                label(kind, gx, gy - 0.98, 0.15 * text)
        label(style, -(cols / 2) * sp_x - 0.25, ((rows - 1) / 2 - r) * sp_y, 0.17 * text, align="RIGHT")
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    units_x = cols * sp_x + margin
    # a row is sp_y * cos(tilt) tall on screen; leave room for the tallest model and the kind names
    units_y = rows * sp_y * math.cos(math.radians(48)) + 1.8
    cam_data.ortho_scale = max(units_x, units_y)  # ortho_scale spans the longer side of the image
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    extra.append(cam)
    cam.rotation_euler = tilt
    cam.location = Vector((0.5 - margin / 4, 0.3, 0.0)) + tilt.to_matrix() @ Vector((0, 0, 30))
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    if ppu:
        width = int(round(units_x * ppu))
    scene.render.resolution_x, scene.render.resolution_y = width, int(width * units_y / units_x)
    scene.view_settings.view_transform = "Standard"
    team_mat = bpy.data.materials["team"]
    team_mat.diffuse_color = (0.2, 0.36, 0.78, 1)  # preview only: a nation blue
    swapped = []
    for style, col in (team or {}).items():  # preview only: a sample colour per style
        pm = bpy.data.materials.get("pv_" + style) or bpy.data.materials.new("pv_" + style)
        pm.diffuse_color = (col[0], col[1], col[2], 1)
        for (s, _k), o in objs.items():
            if s == style:
                for i, m in enumerate(o.data.materials):
                    if m == team_mat:
                        o.data.materials[i] = pm
                        swapped.append((o, i))
    sh = scene.display.shading
    sh.light = "STUDIO"
    sl = os.environ.get("PREVIEW_LIGHT")
    if sl:
        sh.studio_light = sl
    sh.use_world_space_lighting = os.environ.get("PREVIEW_WORLD", "0") == "1"  # camera-space light keeps roofs bright
    sh.show_specular_highlight = False
    sh.color_type = "MATERIAL"
    sh.show_object_outline = True
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.show_cavity = False
    scene.render.resolution_percentage = int(os.environ.get("PREVIEW_PCT", "100"))
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    if not scene.world:
        scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.94, 0.89, 0.76)
    bpy.ops.render.render(write_still=True)
    for o, i in swapped:
        o.data.materials[i] = team_mat
    for o in extra:
        bpy.data.objects.remove(o, do_unlink=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    out = OUT_DIR if os.environ.get("EXPORT", "1") == "1" else None
    objs = {}
    for style in STYLES:
        for kind in KINDS:
            obj = build_one(style, kind)
            objs[(style, kind)] = obj
            if out:
                export(obj, style, kind)
            print("exported" if out else "built", style, kind, len(obj.data.polygons), "faces")
    mpath = os.path.join(OUT_DIR, "manifest.json")
    with open(mpath) as f:
        manifest = json.load(f)
    manifest["styles"] = {s: {k: {"file": f"{s}/{k}.glb", "footprint": FOOTPRINT[k]} for k in KINDS} for s in STYLES}
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    only = os.environ.get("PREVIEW_STYLES")
    if only:  # a quick look at a few styles: PREVIEW_STYLES=egyptian PREVIEW_OUT=/tmp/x.png
        ppu = os.environ.get("PREVIEW_PPU")
        preview(objs, only.split(","), os.environ.get("PREVIEW_OUT", PREVIEW), margin=float(os.environ.get("PREVIEW_MARGIN", "4.0")),
                ppu=float(ppu) if ppu else None, team=TEAM_SAMPLE)
    else:
        preview(objs, list(STYLES), PREVIEW)
        preview(objs, list(IDENTITY_STYLES), PREVIEW_IDENTITY, margin=3.2, sp_y=2.3, team=TEAM_SAMPLE)
        preview(objs, list(IDENTITY_STYLES), PREVIEW_IDENTITY_40, margin=4.4, sp_y=2.0, sp_x=1.45, ppu=40, text=2.1, team=TEAM_SAMPLE)
    print("done")


main()
