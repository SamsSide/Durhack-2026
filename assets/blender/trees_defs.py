"""The tree variants (build_trees.py). Every piece is made vertex by vertex and each face gets its
material when it is made, so a face can never pick up another piece's material (the old `m_tree`
set materials by face index after `create_icosphere`, which reuses freed slots: a few canopy
triangles came out `timber`, the red-brown triangles seen close up).

Z is up here; a model stands on z = 0 with its trunk at the origin, inside x, y in -0.5..0.5 and
z in 0..1. One unit is the height of the tallest tree, so the variants keep their relative sizes.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

PALETTE = {
    "team": (0.93, 0.91, 0.85),        # fruit, coconuts and berries; lane b tints it per variant
    "timber": (0.45, 0.30, 0.18),      # the base palette's trunk
    "leaf": (0.30, 0.47, 0.27),        # the base palette's leaf
    "leaf_light": (0.44, 0.58, 0.28),
    "leaf_dark": (0.21, 0.36, 0.23),
    "pine": (0.20, 0.38, 0.28),
    "pine_light": (0.30, 0.50, 0.31),
    "pine_dark": (0.13, 0.26, 0.21),
    "snow": (0.93, 0.95, 0.97),
    "cypress": (0.19, 0.35, 0.22),
    "palm": (0.38, 0.56, 0.24),
    "palm_bark": (0.58, 0.47, 0.33),
    "acacia": (0.47, 0.53, 0.25),
    "acacia_dark": (0.36, 0.43, 0.22),
    "birch_bark": (0.88, 0.86, 0.80),
    "birch_leaf": (0.60, 0.68, 0.28),
    "dark": (0.24, 0.20, 0.18),
}

PHI = (1 + 5 ** 0.5) / 2
ICO_V = [Vector(v).normalized() for v in (
    (-1, PHI, 0), (1, PHI, 0), (-1, -PHI, 0), (1, -PHI, 0), (0, -1, PHI), (0, 1, PHI),
    (0, -1, -PHI), (0, 1, -PHI), (PHI, 0, -1), (PHI, 0, 1), (-PHI, 0, -1), (-PHI, 0, 1))]
ICO_F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2),
         (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5),
         (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]


def hsh(i, s=0):
    """Repeatable noise in 0..1."""
    return (math.sin(i * 12.9898 + s * 78.233 + 1.3) * 43758.5453) % 1.0


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


class Kit:
    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def face(self, verts, mat, away=None, toward=None):
        """A face with its material; its normal is turned away from `away` (or toward `toward`)."""
        f = self.bm.faces.new(verts)
        f.material_index = self._slot(mat)
        f.normal_update()
        c = f.calc_center_median()
        if away is not None and f.normal.dot(c - Vector(away)) < 0:
            f.normal_flip()
        if toward is not None and f.normal.dot(Vector(toward) - c) < 0:
            f.normal_flip()
        return f

    def blob(self, c, r, mat, seed=0, sub=0, sq=(1, 1, 1), jit=0.16, flat=None, under=None):
        """A faceted leaf clump: a jittered icosahedron (sub=0, 20 triangles) or its subdivision
        (sub=1, 80). `flat` cuts the bottom off at that share of the radius below the centre;
        `under` is the material of the faces that then look down."""
        c = Vector(c)
        turn = Matrix.Rotation(hsh(seed, 1) * math.tau, 3, "Z") @ Matrix.Rotation(hsh(seed, 2) * 1.2, 3, "X")
        dirs = [turn @ v for v in ICO_V]
        faces = list(ICO_F)
        if sub:
            mid, out = {}, []
            for a, b, d in faces:
                tri = []
                for i, j in ((a, b), (b, d), (d, a)):
                    k = (min(i, j), max(i, j))
                    if k not in mid:
                        mid[k] = len(dirs)
                        dirs.append((dirs[i] + dirs[j]).normalized())
                    tri.append(mid[k])
                out += [(a, tri[0], tri[2]), (b, tri[1], tri[0]), (d, tri[2], tri[1]), tuple(tri)]
            faces = out
        vs = []
        for i, d in enumerate(dirs):
            k = r * (1 + jit * (hsh(i, seed) * 2 - 1))
            p = Vector((d.x * k * sq[0], d.y * k * sq[1], d.z * k * sq[2]))
            if flat is not None and p.z < -flat * r * sq[2]:
                p.z = -flat * r * sq[2]
                p.x *= 0.82
                p.y *= 0.82
            vs.append(self.bm.verts.new(c + p))
        cut = None if flat is None else c.z - flat * r * sq[2] + 1e-5
        for a, b, d in faces:
            tri = [vs[a], vs[b], vs[d]]
            low = cut is not None and all(v.co.z <= cut for v in tri)
            self.face(tri, under if (low and under) else mat, away=c)

    def tube(self, pts, radii, mat, seg=5, cap=True, turn=0.0):
        """A tapered trunk or branch along the points; open at the start, capped at the end."""
        pts = [Vector(p) for p in pts]
        rings = []
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            ref = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
            u = d.cross(ref).normalized()
            v = d.cross(u).normalized()
            rings.append([self.bm.verts.new(p + radii[i] * (math.cos(turn + a * math.tau / seg) * u
                                                             + math.sin(turn + a * math.tau / seg) * v))
                          for a in range(seg)])
        for i in range(len(pts) - 1):
            mid = (pts[i] + pts[i + 1]) / 2
            for a in range(seg):
                b = (a + 1) % seg
                self.face([rings[i][a], rings[i][b], rings[i + 1][b], rings[i + 1][a]], mat, away=mid)
        if cap:
            self.face(rings[-1], mat, away=pts[-2])

    def tier(self, x, y, z0, r, h, mat, seed=0, seg=8, top=None, under=None, droop=0.16, waist=0.5):
        """One tier of a conifer: a point, a waist ring and a ragged skirt whose every other corner
        hangs down; closed underneath. `top` colours the point-to-waist part (snow)."""
        apex = self.bm.verts.new((x, y, z0 + h))
        off = hsh(seed, 3) * math.tau
        mids, outs = [], []
        for a in range(seg):
            ang = off + a * math.tau / seg
            k = 1 + 0.12 * (hsh(a, seed) * 2 - 1)
            mids.append(self.bm.verts.new((x + math.cos(ang) * r * waist * k, y + math.sin(ang) * r * waist * k,
                                           z0 + h * 0.46)))
            hang = a % 2 == 1
            ro = r * k * (1.0 if hang else 0.8)
            zo = z0 - (droop * h if hang else -0.04 * h)
            outs.append(self.bm.verts.new((x + math.cos(ang + 0.2) * ro, y + math.sin(ang + 0.2) * ro, zo)))
        below = (x, y, z0 - h * 3)
        centre = self.bm.verts.new((x, y, z0 + h * 0.1))
        for a in range(seg):
            b = (a + 1) % seg
            self.face([apex, mids[a], mids[b]], top or mat, away=below)
            self.face([mids[a], outs[a], mids[b]], mat, away=below)
            self.face([mids[b], outs[a], outs[b]], mat, away=below)
            self.face([centre, outs[b], outs[a]], under or mat, toward=below)

    def frond(self, base, ang, length, mat, rise=0.12, droop=0.3, width=0.07, n=4):
        """A palm leaf: a bent spine with a blade on each side, folded like a shallow roof."""
        base = Vector(base)
        d = Vector((math.cos(ang), math.sin(ang), 0))
        side = Vector((-d.y, d.x, 0))
        rows = []
        for i in range(n + 1):
            t = i / n
            p = base + d * (length * (t - 0.12 * t * t)) + Vector((0, 0, rise * math.sin(t * math.pi * 0.75) * 1.3 - droop * t * t))
            w = width * (0.35 + 1.5 * t) * (1 - t) ** 0.6 * 1.6 if i < n else 0.0
            sag = Vector((0, 0, -0.45 * w))
            rows.append((self.bm.verts.new(p + side * w + sag), self.bm.verts.new(p), self.bm.verts.new(p - side * w + sag)))
        up = base + Vector((0, 0, -5))
        for i in range(n):
            a, b = rows[i], rows[i + 1]
            if i == n - 1:
                self.face([a[0], a[1], b[1]], mat, away=up)
                self.face([a[1], a[2], b[1]], mat, away=up)
            else:
                self.face([a[0], a[1], b[1], b[0]], mat, away=up)
                self.face([a[1], a[2], b[2], b[1]], mat, away=up)

    def gem(self, c, r, mat):
        """A fruit: an octahedron (8 triangles)."""
        c = Vector(c)
        v = [self.bm.verts.new(c + Vector(p) * r) for p in ((1, 0, 0), (0, 1, 0), (-1, 0, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
        for i in range(4):
            j = (i + 1) % 4
            self.face([v[i], v[j], v[4]], mat, away=c)
            self.face([v[j], v[i], v[5]], mat, away=c)

    def box(self, c, size, mat, rz=0.0):
        c = Vector(c)
        m = Matrix.Rotation(rz, 3, "Z")
        v = [self.bm.verts.new(c + m @ Vector((sx * size[0] / 2, sy * size[1] / 2, sz * size[2] / 2)))
             for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        for idx in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.face([v[i] for i in idx], mat, away=c)

    def build(self, name):
        for v in self.bm.verts:                      # a tilted trunk ring must not dip under the ground
            v.co.z = max(0.0, v.co.z)
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for p in mesh.polygons:
            p.use_smooth = False
        for mat in self.mats:
            mesh.materials.append(get_mat(mat))
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


# ---------------------------------------------------------------- the variants

def oak(k):
    """Broadleaf: a flared trunk that forks into three boughs under a layered crown, with fruit."""
    k.tube([(0, 0, 0), (0.004, 0, 0.05), (0.012, 0.008, 0.26), (0.0, 0.0, 0.44)], [0.085, 0.056, 0.044, 0.03], "timber", seg=6)
    boughs = [((0.012, 0.008, 0.25), (0.13, 0.03, 0.36), (0.22, 0.06, 0.47)),
              ((0.012, 0.008, 0.23), (-0.11, 0.06, 0.33), (-0.2, 0.11, 0.44)),
              ((0.012, 0.008, 0.27), (-0.02, -0.11, 0.36), (-0.04, -0.2, 0.45))]
    for i, b in enumerate(boughs):
        k.tube(b, [0.03, 0.024, 0.015], "timber", seg=4, turn=i)
    k.blob((0.0, 0.0, 0.56), 0.24, "leaf", seed=1, sub=1, sq=(1, 1, 0.78), flat=0.55, under="leaf_dark")
    k.blob((0.23, 0.07, 0.51), 0.16, "leaf", seed=2, sq=(1, 1, 0.8), flat=0.6, under="leaf_dark")
    k.blob((-0.21, 0.12, 0.49), 0.155, "leaf", seed=3, sq=(1, 1, 0.8), flat=0.6, under="leaf_dark")
    k.blob((-0.04, -0.22, 0.49), 0.15, "leaf", seed=4, sq=(1, 1, 0.8), flat=0.6, under="leaf_dark")
    k.blob((0.06, 0.04, 0.715), 0.155, "leaf_light", seed=5, sq=(1, 1, 0.8))
    k.blob((-0.11, -0.06, 0.67), 0.125, "leaf_light", seed=6, sq=(1, 1, 0.8))
    k.blob((0.14, -0.14, 0.61), 0.11, "leaf_light", seed=7, sq=(1, 1, 0.8))
    for x, y, z in ((0.3, -0.04, 0.44), (-0.27, 0.0, 0.42), (0.08, 0.26, 0.47), (-0.13, -0.29, 0.42), (0.16, -0.24, 0.5)):
        k.gem((x, y, z), 0.022, "team")


def pine(k):
    """Conifer: four tiers with hanging skirts, dark underneath."""
    k.tube([(0, 0, 0), (0, 0, 0.06), (0, 0, 0.5)], [0.05, 0.036, 0.02], "timber", seg=5)
    for i, (z, r, h) in enumerate(((0.17, 0.25, 0.30), (0.36, 0.2, 0.27), (0.54, 0.15, 0.25), (0.71, 0.1, 0.29))):
        k.tier(0, 0, z, r, h, "pine_light", seed=10 + i, top="pine", under="pine_dark", waist=0.44, droop=0.2)


def snowpine(k):
    """Cold-land conifer: narrower, three tiers, snow on the upper half of each."""
    k.tube([(0, 0, 0), (0, 0, 0.06), (0, 0, 0.5)], [0.045, 0.032, 0.018], "timber", seg=5)
    for i, (z, r, h) in enumerate(((0.18, 0.21, 0.32), (0.4, 0.16, 0.29), (0.62, 0.11, 0.32))):
        k.tier(0, 0, z, r, h, "pine", seed=20 + i, top="snow", under="pine_dark", waist=0.56)


def poplar(k):
    """Tall and narrow (a poplar or cypress): a twisted spindle on a short trunk."""
    k.tube([(0, 0, 0), (0, 0, 0.05), (0, 0, 0.22)], [0.042, 0.03, 0.024], "timber", seg=5)
    seg = 6
    prof = [(0.13, 0.05), (0.27, 0.115), (0.47, 0.135), (0.68, 0.11), (0.86, 0.06)]
    rings = []
    for j, (z, r) in enumerate(prof):
        ring = []
        for a in range(seg):
            ang = a * math.tau / seg + j * 0.5
            rr = r * (1 + 0.22 * (hsh(a, 30 + j) * 2 - 1))
            ring.append(k.bm.verts.new((math.cos(ang) * rr, math.sin(ang) * rr, z + 0.03 * (hsh(a, 40 + j) - 0.5))))
        rings.append(ring)
    tip = k.bm.verts.new((0.01, 0.0, 1.0))
    for j in range(len(rings) - 1):
        mid = (0, 0, (prof[j][0] + prof[j + 1][0]) / 2)
        for a in range(seg):
            b = (a + 1) % seg
            mat = "cypress" if j < 2 else "leaf_dark"
            k.face([rings[j][a], rings[j][b], rings[j + 1][b]], mat, away=mid)
            k.face([rings[j][a], rings[j + 1][b], rings[j + 1][a]], mat, away=mid)
    for a in range(seg):
        b = (a + 1) % seg
        k.face([rings[-1][a], rings[-1][b], tip], "leaf_dark", away=(0, 0, 0.8))
    k.face(rings[0], "cypress", toward=(0, 0, -1))


def palm(k):
    """Hot coasts: a bent ringed trunk, eight drooping fronds and coconuts."""
    spine = [(-0.1, 0, 0), (-0.085, 0, 0.08), (-0.04, 0, 0.3), (0.01, 0, 0.5), (0.04, 0, 0.7)]
    k.tube(spine, [0.055, 0.038, 0.032, 0.028, 0.03], "palm_bark", seg=5)
    for (x, _, z), r in zip(spine[2:4], (0.032, 0.028)):
        k.tube([(x - 0.004, 0, z - 0.012), (x + 0.004, 0, z + 0.012)], [r + 0.009, r + 0.009], "palm_bark", seg=5, cap=False)
    top = (0.04, 0, 0.71)
    for i in range(8):
        ang = i * math.tau / 8 + 0.3 * (hsh(i, 50) - 0.5)
        high = i % 2 == 0
        k.frond(top, ang, 0.36 if high else 0.31, "palm" if high else "leaf", rise=0.17 if high else 0.07,
                droop=0.2 if high else 0.3)
    k.blob((0.04, 0, 0.72), 0.04, "leaf", seed=51, jit=0.05)
    for i in range(3):
        a = i * math.tau / 3 + 0.5
        k.gem((0.04 + math.cos(a) * 0.04, math.sin(a) * 0.04, 0.665), 0.024, "team")


def acacia(k):
    """Dry land: a leaning forked trunk under flat umbrella crowns."""
    k.tube([(0, 0, 0), (0.005, 0, 0.05), (0.03, 0.0, 0.2)], [0.06, 0.04, 0.034], "timber", seg=5)
    arms = [((0.03, 0, 0.19), (0.12, 0.02, 0.33), (0.2, 0.03, 0.47)),
            ((0.03, 0, 0.19), (-0.08, 0.05, 0.31), (-0.22, 0.1, 0.42)),
            ((0.03, 0, 0.19), (0.02, -0.1, 0.3), (-0.02, -0.2, 0.4))]
    for i, a in enumerate(arms):
        k.tube(a, [0.03, 0.022, 0.013], "timber", seg=4, turn=i)
    k.blob((0.14, 0.03, 0.53), 0.3, "acacia", seed=60, sub=1, sq=(1, 0.92, 0.26), flat=0.35, under="acacia_dark", jit=0.12)
    k.blob((-0.23, 0.1, 0.46), 0.2, "acacia", seed=61, sq=(1, 1, 0.3), flat=0.35, under="acacia_dark", jit=0.1)
    k.blob((-0.02, -0.22, 0.44), 0.18, "acacia", seed=62, sq=(1, 1, 0.3), flat=0.35, under="acacia_dark", jit=0.1)


def birch(k):
    """Slender white trunk with dark marks and a loose, light crown."""
    trunk = [(0, 0, 0), (0.004, 0, 0.05), (0.02, 0.005, 0.35), (0.0, 0.0, 0.72)]
    k.tube(trunk, [0.04, 0.028, 0.022, 0.012], "birch_bark", seg=5)
    for z, a in ((0.1, 0.4), (0.19, 2.6), (0.27, 4.4), (0.36, 1.3), (0.46, 3.4)):
        x = 0.004 + 0.016 * min(1.0, z / 0.35)
        r = 0.027 - 0.006 * z / 0.35
        k.box((x + math.cos(a) * r, math.sin(a) * r, z), (0.012, 0.034, 0.014), "dark", rz=a)
    k.tube([(0.018, 0.004, 0.4), (0.12, 0.03, 0.5)], [0.012, 0.007], "birch_bark", seg=4)
    k.tube([(0.016, 0.004, 0.46), (-0.1, -0.04, 0.55)], [0.012, 0.007], "birch_bark", seg=4)
    for i, (x, y, z, r) in enumerate(((0.13, 0.04, 0.55, 0.115), (-0.12, -0.05, 0.6, 0.11), (0.03, 0.1, 0.68, 0.115),
                                      (0.02, -0.09, 0.74, 0.105), (-0.01, 0.01, 0.84, 0.1))):
        k.blob((x, y, z), r, "birch_leaf" if i % 2 == 0 else "leaf_light", seed=70 + i, sq=(1, 1, 1.15), jit=0.2)


def bush(k):
    """Undergrowth: three low clumps and a few berries."""
    k.blob((0.0, 0.0, 0.095), 0.15, "leaf", seed=80, sq=(1, 1, 0.9), flat=0.7, under="leaf_dark")
    k.blob((0.14, 0.05, 0.07), 0.11, "leaf_light", seed=81, sq=(1, 1, 0.9), flat=0.7, under="leaf_dark")
    k.blob((-0.12, -0.07, 0.063), 0.1, "leaf_dark", seed=82, sq=(1, 1, 0.9), flat=0.7)
    for x, y, z in ((0.07, -0.12, 0.13), (-0.06, 0.12, 0.15), (0.2, -0.02, 0.12), (-0.17, 0.0, 0.11)):
        k.gem((x, y, z), 0.02, "team")


# name -> (function, footprint): the share of a tile's width one model unit (a full-height tree) takes
TREES = {
    "oak": (oak, 0.22), "pine": (pine, 0.22), "snowpine": (snowpine, 0.22), "poplar": (poplar, 0.22),
    "palm": (palm, 0.22), "acacia": (acacia, 0.22), "birch": (birch, 0.22), "bush": (bush, 0.22),
}
NAMES = list(TREES)
