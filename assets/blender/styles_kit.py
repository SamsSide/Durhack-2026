"""Shared kit for the building styles: the Builder (primitives) and the style palettes.

Imported by build_styles.py. Blender is Z-up; the glTF exporter converts to +Y up.
"""
import math
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

TEAM = (0.93, 0.91, 0.85)


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


# name -> colour. Slots every style uses: wall, stone, roof, trim, dark, extra (+ team).
PALETTES = {
    "medieval": dict(wall="#CFC2A3", stone="#8E8B85", roof="#8A3B2A", trim="#4A3628", dark="#3A2E26", extra="#5B5F66"),
    "classical": dict(wall="#EDE6D6", stone="#D2C8B2", roof="#B5543A", trim="#C9A74A", dark="#4A4038", extra="#6E7F5A"),
    "desert": dict(wall="#E3C99A", stone="#B8864E", roof="#F2EEE4", trim="#2F7F8C", dark="#5A4430", extra="#F2EEE4"),
    "east_asian": dict(wall="#E8DCC0", stone="#EFEAE0", roof="#2E3B3F", trim="#B23A2E", dark="#3B2A22", extra="#D4A93A"),
    "mesoamerican": dict(wall="#B7AE98", stone="#7A6A52", roof="#D7B98A", trim="#2E8C6E", dark="#3A3026", extra="#C2452D"),
    # nation identity (row A24)
    "soviet_bloc": dict(wall="#A8A8A0", stone="#6E6E68", roof="#D6C29C", trim="#D4A93A", dark="#34363A", extra="#8E8C84"),
    "western_modern": dict(wall="#EDE6D6", stone="#9A6B4F", roof="#3E5566", trim="#7FB6CC", dark="#2A333B", extra="#5E8C4A"),
    "egyptian": dict(wall="#E6D3A3", stone="#C8A26A", roof="#8A6A45", trim="#2F6E9E", dark="#4A3826", extra="#D4A93A"),
    "highland": dict(wall="#F2EEE4", stone="#8C8273", roof="#5B5F66", trim="#8E2A1E", dark="#6A6358", extra="#6F8F4E"),
    "scrap": dict(wall="#6B6B5E", stone="#A79B7C", roof="#8A4B2A", trim="#3E4A3D", dark="#2E2A26", extra="#B0623A"),
}


def get_mat(style, slot):
    name = "team" if slot == "team" else f"{style}_{slot}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    c = TEAM if slot == "team" else hexc(PALETTES[style][slot])
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (c[0], c[1], c[2], 1.0)
    return m


class Builder:
    def __init__(self, style):
        self.style = style
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
        # bmesh reuses freed face slots, so "the faces after index n" is unreliable: use a set
        for f in self.bm.faces:
            if f not in n:
                f.material_index = idx

    def _m(self, x, y, z, rot):
        return self.stack[-1] @ Matrix.Translation((x, y, z)) @ Euler(rot, "XYZ").to_matrix().to_4x4()

    # ---- primitives
    def box(self, x, y, z0, sx, sy, sz, mat, rot=(0, 0, 0)):
        n = set(self.bm.faces)
        m = self._m(x, y, z0 + sz / 2, rot) @ Matrix.Diagonal((sx, sy, sz, 1))
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._finish(n, mat)

    def cyl(self, x, y, z0, r, h, mat, seg=8, r2=None, rot=(0, 0, 0)):
        n = set(self.bm.faces)
        m = self._m(x, y, z0 + h / 2, rot)
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r, radius2=r if r2 is None else r2, depth=h, matrix=m)
        self._finish(n, mat)

    def cone(self, x, y, z0, r, h, mat, seg=8, rot=(0, 0, 0)):
        self.cyl(x, y, z0, r, h, mat, seg=seg, r2=0.0, rot=rot)

    def _poly(self, pts_faces, m, mat):
        """Build faces from point lists, merging coincident points (so apexes and ridges work)."""
        n = set(self.bm.faces)
        cache = {}
        for face in pts_faces:
            vs = []
            for p in face:
                key = tuple(round(c, 5) for c in p)
                if key not in cache:
                    cache[key] = self.bm.verts.new(m @ Vector(p))
                v = cache[key]
                if not vs or vs[-1] is not v:
                    vs.append(v)
            if len(vs) > 1 and vs[0] is vs[-1]:
                vs.pop()
            if len(set(vs)) >= 3:
                try:
                    self.bm.faces.new(vs)
                except ValueError:
                    pass
        self._finish(n, mat)

    def frustum(self, x, y, z0, w0, d0, w1, d1, h, mat, rz=0.0, ox=0.0, oy=0.0):
        """Box-like solid, bottom w0 x d0, top w1 x d1 (0 gives a ridge or apex), top shifted by (ox, oy)."""
        m = self._m(x, y, z0, (0, 0, rz))
        b = [(-w0 / 2, -d0 / 2, 0), (w0 / 2, -d0 / 2, 0), (w0 / 2, d0 / 2, 0), (-w0 / 2, d0 / 2, 0)]
        t = [(-w1 / 2 + ox, -d1 / 2 + oy, h), (w1 / 2 + ox, -d1 / 2 + oy, h),
             (w1 / 2 + ox, d1 / 2 + oy, h), (-w1 / 2 + ox, d1 / 2 + oy, h)]
        faces = [[b[3], b[2], b[1], b[0]], [t[0], t[1], t[2], t[3]]]
        for i in range(4):
            j = (i + 1) % 4
            faces.append([b[i], b[j], t[j], t[i]])
        self._poly(faces, m, mat)

    def lathe(self, x, y, z0, profile, mat, seg=8, rz=0.0, close_bottom=True):
        """Solid of revolution. profile = [(radius, z), ...] from bottom to top."""
        m = self._m(x, y, z0, (0, 0, rz))
        rings = []
        for r, z in profile:
            rings.append([(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z) for i in range(seg)])
        faces = []
        for k in range(len(rings) - 1):
            for i in range(seg):
                j = (i + 1) % seg
                faces.append([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
        if close_bottom and profile[0][0] > 0:
            faces.append(list(reversed(rings[0])))
        if profile[-1][0] > 0:
            faces.append(rings[-1])
        self._poly(faces, m, mat)

    def gable(self, x, y, z0, w, d, h, mat, rz=0.0, over=0.02):
        """Gable roof, ridge along local x. w along x, d along y."""
        m = self._m(x, y, z0, (0, 0, rz))
        a, b = w / 2 + over, d / 2 + over
        co = [(-a, -b, 0), (a, -b, 0), (a, b, 0), (-a, b, 0), (-a, 0, h), (a, 0, h)]
        self._poly([[co[i] for i in idx] for idx in ([0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4], [3, 2, 1, 0])], m, mat)

    def shed(self, x, y, z0, w, d, h, mat, rz=0.0, h0=0.0):
        """Mono-pitch roof: low edge at -y (height h0), high edge at +y (height h)."""
        m = self._m(x, y, z0, (0, 0, rz))
        a, b = w / 2, d / 2
        co = [(-a, -b, 0), (a, -b, 0), (a, b, 0), (-a, b, 0), (-a, -b, h0), (a, -b, h0), (a, b, h), (-a, b, h)]
        self._poly([[co[i] for i in idx] for idx in ([3, 2, 1, 0], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7])], m, mat)

    def build(self, name):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
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
            mesh.materials.append(get_mat(self.style, mat))
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj
