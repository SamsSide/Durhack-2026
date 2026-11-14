"""Build every Terra Nova low-poly model procedurally and export GLBs, manifest and preview.

Run (from the repo root):
  blender --background --factory-startup --python assets/blender/build_models.py

Blender is Z-up; the glTF exporter converts to +Y up. Each model is built in a bmesh with
its base on z = 0, centred on x/y, and fitted into a 1 x 1 x 1 box.
"""
import json
import math
import os
import sys
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ROOT = os.getcwd()
if "--" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--") + 1]
OUT_DIR = os.path.join(ROOT, "web", "public", "models")
PREVIEW = os.path.join(ROOT, "assets", "preview.png")

FOOTPRINT = {
    "camp": 0.6, "village": 0.8, "town": 0.9, "city": 1.0, "capital": 1.0,
    "farm": 0.8, "port": 0.8, "fort": 0.7, "temple": 0.7, "factory": 0.8,
    "ruin": 0.8, "army": 0.5, "fleet": 0.5, "settler": 0.4, "tree": 0.3,
}

# Warm, muted painted-atlas palette (sRGB-ish values, set as Principled base colour).
PALETTE = {
    "team": (0.93, 0.91, 0.85),   # recoloured by lane b to the nation colour
    "stone": (0.66, 0.62, 0.54),
    "plaster": (0.90, 0.84, 0.70),
    "timber": (0.45, 0.30, 0.18),
    "thatch": (0.78, 0.64, 0.32),
    "terracotta": (0.72, 0.38, 0.24),
    "field": (0.50, 0.62, 0.30),
    "wheat": (0.82, 0.72, 0.36),
    "leaf": (0.30, 0.47, 0.27),
    "water": (0.36, 0.56, 0.68),
    "dark": (0.24, 0.20, 0.18),
    "skin": (0.86, 0.66, 0.50),
    "steel": (0.58, 0.60, 0.64),
}


def get_mat(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    c = PALETTE[name]
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (c[0], c[1], c[2], 1.0)
    return m


class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.stack = [Matrix.Identity(4)]
        self.mats = []

    @contextmanager
    def at(self, x=0, y=0, rz=0.0):
        self.stack.append(self.stack[-1] @ Matrix.Translation((x, y, 0)) @ Matrix.Rotation(rz, 4, "Z"))
        try:
            yield
        finally:
            self.stack.pop()

    def _slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _finish(self, n, mat):
        idx = self._slot(mat)
        self.bm.faces.ensure_lookup_table()
        for f in self.bm.faces[n:]:
            f.material_index = idx

    def _m(self, x, y, z, rot):
        return self.stack[-1] @ Matrix.Translation((x, y, z)) @ Euler(rot, "XYZ").to_matrix().to_4x4()

    def box(self, x, y, z0, sx, sy, sz, mat, rot=(0, 0, 0)):
        n = len(self.bm.faces)
        m = self._m(x, y, z0 + sz / 2, rot) @ Matrix.Diagonal((sx, sy, sz, 1))
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._finish(n, mat)

    def cyl(self, x, y, z0, r, h, mat, seg=8, r2=None, rot=(0, 0, 0), centered=False):
        n = len(self.bm.faces)
        zc = z0 if centered else z0 + h / 2
        m = self._m(x, y, zc, rot)
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r, radius2=r if r2 is None else r2, depth=h, matrix=m)
        self._finish(n, mat)

    def cone(self, x, y, z0, r, h, mat, seg=8, rot=(0, 0, 0)):
        self.cyl(x, y, z0, r, h, mat, seg=seg, r2=0.0, rot=rot)

    def pyramid(self, x, y, z0, r, h, mat):
        self.cone(x, y, z0, r, h, mat, seg=4, rot=(0, 0, math.pi / 4))

    def sphere(self, x, y, z, r, mat, sub=1, squash=1.0):
        n = len(self.bm.faces)
        m = self._m(x, y, z, (0, 0, 0)) @ Matrix.Diagonal((1, 1, squash, 1))
        bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r, matrix=m)
        self._finish(n, mat)

    def gable(self, x, y, z0, w, d, h, mat, rz=0.0, over=0.02):
        """Gable roof, ridge along local x. w along x, d along y."""
        n = len(self.bm.faces)
        m = self._m(x, y, z0, (0, 0, rz))
        a, b = w / 2 + over, d / 2 + over
        co = [(-a, -b, 0), (a, -b, 0), (a, b, 0), (-a, b, 0), (-a, 0, h), (a, 0, h)]
        v = [self.bm.verts.new(m @ Vector(c)) for c in co]
        for idx in ([0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4], [3, 2, 1, 0]):
            self.bm.faces.new([v[i] for i in idx])
        self._finish(n, mat)

    def house(self, x, y, w, d, h, roof, rz=0.0, wall="plaster", rh=None):
        with self.at(x, y, rz):
            self.box(0, 0, 0, w, d, h, wall)
            self.gable(0, 0, h, w, d, rh if rh is not None else min(w, d) * 0.55, roof)

    def build(self, name):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # centre on x/y, drop to z = 0, fit into 1 x 1 x 1
        xs = [v.co.x for v in bm.verts]
        ys = [v.co.y for v in bm.verts]
        zs = [v.co.z for v in bm.verts]
        cx, cy, zmin = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
        for v in bm.verts:
            v.co.x -= cx
            v.co.y -= cy
            v.co.z -= zmin
        sx, sy, sz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - zmin
        k = min(1.0, 1.0 / max(sx, sy, sz))
        if k < 1.0:
            print(f"  note: {name} scaled by {k:.3f} to fit")
            for v in bm.verts:
                v.co *= k
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        for p in mesh.polygons:
            p.use_smooth = False
        for mat in self.mats:
            mesh.materials.append(get_mat(mat))
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


# ---------------------------------------------------------------- models

def m_camp():
    b = Builder()
    b.pyramid(-0.25, 0.12, 0, 0.27, 0.36, "team")
    b.pyramid(0.22, 0.25, 0, 0.22, 0.30, "team")
    b.box(-0.25, -0.02, 0, 0.1, 0.04, 0.12, "dark")  # tent door
    b.cone(0.0, -0.28, 0, 0.1, 0.12, "terracotta", seg=6)  # fire
    for a in (0, 1, 2):
        ang = a * math.pi / 3
        b.box(0.0, -0.28, 0, 0.26, 0.05, 0.05, "timber", rot=(0, 0, ang))
    b.cyl(0.38, -0.25, 0, 0.02, 0.5, "timber", seg=5)
    b.box(0.38, -0.25, 0.28, 0.2, 0.02, 0.18, "team")
    b.box(-0.38, -0.3, 0, 0.12, 0.12, 0.1, "timber")  # crate
    return b.build("camp")


def m_village():
    b = Builder()
    b.house(-0.27, 0.22, 0.30, 0.22, 0.17, "team", rz=0.2)
    b.house(0.24, 0.26, 0.26, 0.22, 0.15, "thatch", rz=-0.3)
    b.house(-0.28, -0.22, 0.24, 0.28, 0.15, "thatch", rz=math.pi / 2 + 0.1)
    b.house(0.27, -0.2, 0.30, 0.22, 0.19, "team", rz=0.15)
    b.cyl(0.0, 0.0, 0, 0.08, 0.08, "stone", seg=8)
    b.cyl(0.0, 0.0, 0.08, 0.05, 0.02, "water", seg=8)
    b.cyl(0.0, 0.0, 0.08, 0.012, 0.14, "timber", seg=4)
    return b.build("village")


def m_town():
    b = Builder()
    pos = [(-0.32, 0.30, 0.26, 0.2, 0.2, "team"), (0.0, 0.34, 0.24, 0.2, 0.17, "thatch"),
           (0.3, 0.3, 0.26, 0.2, 0.22, "team"), (-0.34, -0.02, 0.22, 0.26, 0.18, "thatch"),
           (0.34, -0.04, 0.22, 0.24, 0.2, "terracotta"), (-0.3, -0.34, 0.26, 0.2, 0.2, "team"),
           (0.12, -0.36, 0.28, 0.2, 0.18, "thatch")]
    for x, y, w, d, h, r in pos:
        b.house(x, y, w, d, h, r)
    # church with a tower
    b.box(0.0, -0.02, 0, 0.3, 0.2, 0.2, "stone")
    b.gable(0.0, -0.02, 0.2, 0.3, 0.2, 0.14, "terracotta")
    b.box(-0.12, -0.02, 0, 0.12, 0.12, 0.42, "stone")
    b.pyramid(-0.12, -0.02, 0.42, 0.1, 0.2, "team")
    return b.build("town")


def city_blocks(b, tall_center=True):
    rows = [(-0.34, 0.34), (0.0, 0.34), (0.34, 0.34), (-0.34, 0.0), (0.34, 0.0), (-0.34, -0.34),
            (0.0, -0.34), (0.34, -0.34)]
    hs = [0.34, 0.26, 0.4, 0.3, 0.36, 0.28, 0.42, 0.3]
    roofs = ["team", "terracotta", "team", "thatch", "terracotta", "team", "thatch", "team"]
    for (x, y), h, r in zip(rows, hs, roofs):
        b.box(x, y, 0, 0.24, 0.24, h, "plaster")
        if r == "team" or r == "terracotta":
            b.gable(x, y, h, 0.24, 0.24, 0.12, r, rz=0.0 if x < 0.1 else math.pi / 2)
        else:
            b.pyramid(x, y, h, 0.18, 0.12, r)


def m_city():
    b = Builder()
    city_blocks(b)
    b.box(0, 0, 0, 0.26, 0.26, 0.5, "stone")
    b.box(0, 0, 0.5, 0.3, 0.3, 0.05, "plaster")
    b.pyramid(0, 0, 0.55, 0.2, 0.25, "team")
    b.cyl(0, 0, 0.8, 0.012, 0.16, "dark", seg=4)
    # ring of low wall
    for s in (-0.47, 0.47):
        b.box(s, 0, 0, 0.04, 0.96, 0.09, "stone")
        b.box(0, s, 0, 0.96, 0.04, 0.09, "stone")
    return b.build("city")


def m_capital():
    b = Builder()
    # outer wall with corner towers
    for s in (-0.46, 0.46):
        b.box(s, 0, 0, 0.05, 0.92, 0.14, "stone")
        b.box(0, s, 0, 0.92, 0.05, 0.14, "stone")
    for sx in (-0.46, 0.46):
        for sy in (-0.46, 0.46):
            b.cyl(sx, sy, 0, 0.07, 0.3, "stone", seg=8)
            b.cone(sx, sy, 0.3, 0.09, 0.14, "team", seg=8)
    b.box(0, -0.46, 0, 0.14, 0.07, 0.2, "dark")
    # streets of houses
    spots = [(-0.3, 0.3), (0.3, 0.3), (-0.3, -0.3), (0.3, -0.3), (-0.32, 0.0), (0.32, 0.0), (0.0, 0.32)]
    for i, (x, y) in enumerate(spots):
        b.box(x, y, 0, 0.2, 0.2, 0.18 + 0.05 * (i % 3), "plaster")
        b.gable(x, y, 0.18 + 0.05 * (i % 3), 0.2, 0.2, 0.1, "terracotta" if i % 2 else "team", rz=math.pi / 2 * (i % 2))
    # central keep with dome, spire and flag
    b.box(0, -0.02, 0, 0.3, 0.3, 0.4, "stone")
    b.box(0, -0.02, 0.4, 0.34, 0.34, 0.04, "plaster")
    b.cyl(0, -0.02, 0.44, 0.12, 0.1, "plaster", seg=10)
    b.sphere(0, -0.02, 0.54, 0.14, "team", sub=2, squash=0.9)
    b.cyl(0, -0.02, 0.66, 0.012, 0.3, "dark", seg=4)
    b.box(0.07, -0.02, 0.84, 0.14, 0.015, 0.1, "team")
    return b.build("capital")


def m_farm():
    b = Builder()
    for i in range(4):
        b.box(-0.2, -0.38 + i * 0.2, 0, 0.55, 0.15, 0.05, "field" if i % 2 == 0 else "wheat")
    # furrows on wheat strips
    for i in (1, 3):
        for j in range(4):
            b.box(-0.36 + j * 0.12, -0.38 + i * 0.2, 0.05, 0.05, 0.12, 0.025, "thatch")
    with b.at(0.3, 0.1, 0.0):
        b.box(0, 0, 0, 0.26, 0.4, 0.2, "timber")
        b.gable(0, 0, 0.2, 0.26, 0.4, 0.16, "team", rz=math.pi / 2)
        b.box(0.135, 0, 0, 0.02, 0.12, 0.13, "dark")
    b.cyl(0.36, -0.28, 0, 0.07, 0.3, "stone", seg=8)
    b.cone(0.36, -0.28, 0.3, 0.085, 0.1, "team", seg=8)
    b.cyl(-0.1, 0.42, 0, 0.07, 0.1, "thatch", seg=7, r2=0.045)
    b.cyl(0.1, 0.4, 0, 0.06, 0.08, "thatch", seg=7, r2=0.04)
    return b.build("farm")


def m_port():
    b = Builder()
    b.box(0.0, -0.22, 0, 1.0, 0.5, 0.025, "water")        # water patch
    b.box(0.0, 0.36, 0, 1.0, 0.24, 0.05, "stone")           # quay
    b.box(0.0, -0.05, 0.05, 0.14, 0.7, 0.04, "timber")     # pier
    for yy in (-0.35, -0.15, 0.05):
        for xx in (-0.08, 0.08):
            b.cyl(xx, yy, 0, 0.018, 0.12, "dark", seg=5)
    # boat (long axis along x so the sail shows from the front)
    with b.at(-0.27, -0.3, math.pi / 2):
        b.box(0, 0, 0.025, 0.16, 0.36, 0.08, "timber")
        b.cone(0, 0.22, 0.025, 0.08, 0.08, "timber", seg=4, rot=(0, 0, math.pi / 4))
        b.cyl(0, 0, 0.1, 0.015, 0.4, "dark", seg=5)
        b.box(0, 0, 0.2, 0.01, 0.24, 0.26, "team")
    # warehouse, crates
    b.box(-0.2, 0.38, 0.05, 0.4, 0.2, 0.16, "plaster")
    b.gable(-0.2, 0.38, 0.21, 0.4, 0.2, 0.12, "team")
    b.box(0.22, 0.34, 0.05, 0.12, 0.12, 0.1, "timber")
    b.box(0.34, 0.4, 0.05, 0.12, 0.12, 0.1, "timber")
    b.box(0.28, 0.36, 0.15, 0.1, 0.1, 0.09, "wheat")
    return b.build("port")


def m_fort():
    b = Builder()
    w = 0.78
    for s in (-1, 1):
        b.box(s * w / 2, 0, 0, 0.07, w, 0.3, "stone")
        b.box(0, s * w / 2, 0, w, 0.07, 0.3, "stone")
    for s in (-1, 1):  # merlons
        for i in range(5):
            t = -0.3 + i * 0.15
            b.box(s * w / 2, t, 0.3, 0.07, 0.06, 0.06, "stone")
            b.box(t, s * w / 2, 0.3, 0.06, 0.07, 0.06, "stone")
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.cyl(sx * w / 2, sy * w / 2, 0, 0.11, 0.5, "stone", seg=8)
            b.cone(sx * w / 2, sy * w / 2, 0.5, 0.13, 0.2, "team", seg=8)
    b.box(0, -w / 2, 0, 0.18, 0.09, 0.34, "stone")   # gatehouse
    b.box(0, -w / 2 - 0.046, 0, 0.1, 0.01, 0.2, "dark")
    b.box(0, 0.05, 0, 0.26, 0.26, 0.38, "plaster")    # keep
    b.pyramid(0, 0.05, 0.38, 0.2, 0.18, "team")
    b.cyl(0, 0.05, 0.56, 0.01, 0.2, "dark", seg=4)
    b.box(0.07, 0.05, 0.68, 0.14, 0.015, 0.08, "team")
    return b.build("fort")


def m_temple():
    b = Builder()
    b.box(0, 0, 0, 0.95, 0.7, 0.05, "stone")
    b.box(0, 0, 0.05, 0.85, 0.6, 0.05, "plaster")
    b.box(0, 0, 0.10, 0.75, 0.5, 0.05, "stone")
    for i in range(5):
        for y in (-0.19, 0.19):
            b.cyl(-0.3 + i * 0.15, y, 0.15, 0.045, 0.38, "plaster", seg=8)
    b.box(0, 0, 0.53, 0.76, 0.5, 0.06, "stone")
    # pediment as triangular roof, ridge along y (front facing +/-x)
    b.gable(0, 0, 0.59, 0.5, 0.76, 0.2, "team", rz=math.pi / 2, over=0.0)
    b.box(0, 0, 0.15, 0.3, 0.2, 0.2, "plaster")   # inner cella
    b.cone(0.0, 0.0, 0.15, 0.03, 0.05, "terracotta", seg=5)
    return b.build("temple")


def m_factory():
    b = Builder()
    for i, y in enumerate((-0.25, 0.05)):
        b.box(-0.1, y, 0, 0.62, 0.26, 0.22, "terracotta")
        for k in range(3):  # sawtooth roof
            b.gable(-0.3 + k * 0.2, y, 0.22, 0.2, 0.26, 0.1, "team", rz=0.0, over=0.0)
    b.box(0.0, 0.34, 0, 0.5, 0.2, 0.16, "plaster")
    b.gable(0.0, 0.34, 0.16, 0.5, 0.2, 0.1, "team")
    for x, h in ((0.28, 0.9), (0.38, 0.72), (0.2, 0.62)):
        b.cyl(x, -0.2, 0, 0.055, h * 0.9, "terracotta", seg=8, r2=0.04)
        b.cyl(x, -0.2, h * 0.9, 0.047, 0.04, "dark", seg=8)
    b.sphere(0.3, -0.2, 0.93, 0.05, "steel", sub=1)
    b.box(0.32, 0.1, 0, 0.14, 0.14, 0.1, "timber")
    return b.build("factory")


def m_ruin():
    b = Builder()
    b.box(0, 0, 0, 0.9, 0.8, 0.03, "stone")
    b.box(-0.2, 0.32, 0.03, 0.5, 0.07, 0.3, "stone")
    b.box(0.2, 0.32, 0.03, 0.2, 0.07, 0.14, "stone")
    b.box(-0.36, 0.1, 0.03, 0.07, 0.4, 0.2, "stone")
    b.box(0.38, 0.05, 0.03, 0.07, 0.34, 0.1, "stone")
    b.box(-0.05, -0.32, 0.03, 0.3, 0.07, 0.08, "stone")
    b.cyl(0.18, -0.1, 0.03, 0.06, 0.32, "plaster", seg=7)
    b.cyl(-0.12, 0.0, 0.03, 0.06, 0.16, "plaster", seg=7)
    b.cyl(0.3, -0.3, 0.03, 0.06, 0.09, "plaster", seg=7, rot=(0, math.pi / 2, 0.4), centered=False)
    # rubble and moss
    for x, y, s, a in [(0.05, 0.1, 0.12, 0.4), (-0.25, -0.2, 0.1, 1.0), (0.12, -0.3, 0.09, 0.2), (0.28, 0.2, 0.1, 0.7), (-0.05, 0.2, 0.08, 1.2)]:
        b.box(x, y, 0.03, s, s * 0.8, s * 0.7, "stone", rot=(0.15, 0.1, a))
    b.box(-0.2, 0.05, 0.03, 0.2, 0.18, 0.02, "leaf")
    b.box(0.32, -0.05, 0.03, 0.14, 0.1, 0.02, "leaf")
    # a tattered banner on a leaning pole
    b.cyl(-0.38, -0.3, 0.03, 0.012, 0.4, "timber", seg=4, rot=(0.1, 0, 0))
    b.box(-0.34, -0.3, 0.26, 0.14, 0.015, 0.1, "team")
    return b.build("ruin")


def soldier(b, x, y, spear_h=0.52):
    b.box(x, y, 0, 0.12, 0.08, 0.17, "team")
    b.sphere(x, y, 0.23, 0.05, "skin", sub=1)
    b.cone(x, y, 0.25, 0.058, 0.06, "steel", seg=6)
    b.box(x - 0.075, y - 0.03, 0.04, 0.02, 0.07, 0.11, "timber")  # shield
    b.cyl(x + 0.08, y, 0, 0.012, spear_h, "timber", seg=4)
    b.cone(x + 0.08, y, spear_h, 0.025, 0.07, "steel", seg=4)


def m_army():
    b = Builder()
    for x, y in ((-0.28, 0.2), (0.12, 0.2), (-0.28, -0.2), (0.12, -0.2)):
        soldier(b, x, y)
    # banner bearer at the back
    b.box(0.0, 0.0, 0, 0.12, 0.08, 0.17, "timber")
    b.sphere(0.0, 0.0, 0.23, 0.05, "skin", sub=1)
    b.cyl(0.0, 0.0, 0.0, 0.014, 0.9, "timber", seg=4)
    b.box(0.0, 0.0, 0.62, 0.3, 0.018, 0.2, "team")
    b.box(0.17, 0.0, 0.0, 0.1, 0.1, 0.05, "dark")
    return b.build("army")


def ship(b, x, y, s=1.0, rz=0.0):
    with b.at(x, y, rz):
        b.box(0, 0, 0, 0.16 * s, 0.5 * s, 0.09 * s, "timber")
        b.cone(0, 0.3 * s, 0, 0.08 * s, 0.09 * s, "timber", seg=4, rot=(0, 0, math.pi / 4))
        b.box(0, -0.27 * s, 0.09 * s, 0.16 * s, 0.08 * s, 0.06 * s, "timber")
        b.cyl(0, 0.04 * s, 0.09 * s, 0.014 * s, 0.6 * s, "dark", seg=5)
        b.box(0, 0.04 * s, 0.22 * s, 0.01, 0.26 * s, 0.34 * s, "team")
        b.box(0, 0.2 * s, 0.09 * s, 0.01, 0.16 * s, 0.2 * s, "team")


def m_fleet():
    b = Builder()
    r = math.pi / 2
    ship(b, -0.05, -0.36, 0.95, r)
    ship(b, 0.1, 0.0, 0.75, r)
    ship(b, -0.08, 0.36, 0.85, r)
    return b.build("fleet")


def m_settler():
    b = Builder()
    b.box(0.0, 0.0, 0.12, 0.34, 0.2, 0.05, "timber")
    b.gable(0.0, 0.0, 0.17, 0.34, 0.2, 0.17, "team", over=0.015)
    for x in (-0.11, 0.11):
        for y in (-0.12, 0.12):
            b.cyl(x, y, 0.08, 0.08, 0.025, "dark", seg=10, rot=(math.pi / 2, 0, 0), centered=True)
    b.cyl(0.0, 0.0, 0.08, 0.012, 0.28, "dark", seg=4, rot=(0, math.pi / 2, 0), centered=True)
    b.box(0.26, 0.0, 0.14, 0.2, 0.025, 0.02, "timber")  # shaft
    b.box(0.37, 0.0, 0.05, 0.14, 0.1, 0.1, "terracotta")  # ox
    b.sphere(0.45, 0.0, 0.12, 0.04, "terracotta", sub=1)
    b.box(0.46, 0.0, 0.14, 0.01, 0.1, 0.01, "steel")
    # walking figure
    b.box(-0.32, -0.1, 0, 0.07, 0.05, 0.12, "terracotta")
    b.sphere(-0.32, -0.1, 0.15, 0.035, "skin", sub=1)
    b.cyl(-0.28, -0.1, 0, 0.008, 0.2, "timber", seg=4)
    return b.build("settler")


def m_tree():
    b = Builder()
    b.cyl(0, 0, 0, 0.05, 0.3, "timber", seg=6, r2=0.035)
    b.sphere(0, 0, 0.5, 0.26, "leaf", sub=2, squash=1.0)
    b.sphere(0.12, 0.1, 0.72, 0.17, "leaf", sub=1)
    b.sphere(-0.12, -0.08, 0.66, 0.15, "leaf", sub=1)
    for x, y, z in ((0.22, -0.12, 0.45), (-0.2, 0.15, 0.55), (0.05, 0.24, 0.62)):
        b.sphere(x, y, z, 0.035, "team", sub=1)
    return b.build("tree")


MODELS = [
    ("camp", m_camp), ("village", m_village), ("town", m_town), ("city", m_city), ("capital", m_capital),
    ("farm", m_farm), ("port", m_port), ("fort", m_fort), ("temple", m_temple), ("factory", m_factory),
    ("ruin", m_ruin), ("army", m_army), ("fleet", m_fleet), ("settler", m_settler), ("tree", m_tree),
]


def export(obj, key):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(OUT_DIR, key + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True,
        export_apply=True, export_cameras=False, export_lights=False, export_texcoords=False,
        export_normals=True, export_materials="EXPORT", export_extras=False,
        export_animations=False,
    )
    return path


def preview(objs):
    scene = bpy.context.scene
    cols, rows, sp = 5, 3, 1.6
    ink = bpy.data.materials.new("ink")
    ink.diffuse_color = (0.15, 0.1, 0.07, 1)
    tile = bpy.data.materials.new("tile")
    tile.diffuse_color = (0.96, 0.90, 0.74, 1)
    for i, (key, _) in enumerate(MODELS):
        r, c = divmod(i, cols)
        gx = (c - (cols - 1) / 2) * sp
        gy = ((rows - 1) / 2 - r) * sp * 1.5
        objs[key].location = (gx, gy, 0.0)
        bpy.ops.mesh.primitive_plane_add(size=1.3, location=(gx, gy, -0.004))
        bpy.context.object.data.materials.append(tile)
        bpy.ops.object.text_add(location=(gx, gy - 0.78, 0.0))
        t = bpy.context.object
        t.data.body = key
        t.data.align_x = "CENTER"
        t.data.size = 0.17
        t.data.materials.append(ink)
        t.rotation_euler = Euler((math.radians(48), 0, 0.0), "XYZ")
        t.location.z = 0.0
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 9.6
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    rot = Euler((math.radians(48), 0, 0.0), "XYZ")
    cam.rotation_euler = rot
    cam.location = Vector((0, -0.1, 0.0)) + rot.to_matrix() @ Vector((0, 0, 30))
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 1500, 900
    scene.render.film_transparent = False
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_object_outline = True
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.show_cavity = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PREVIEW
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.94, 0.89, 0.76)
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = {}
    for key, fn in MODELS:
        obj = fn()
        objs[key] = obj
        export(obj, key)
        print("exported", key)
    manifest = {"version": 1, "models": {k: {"file": k + ".glb", "footprint": FOOTPRINT[k]} for k, _ in MODELS}}
    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    preview(objs)
    print("done")


main()
