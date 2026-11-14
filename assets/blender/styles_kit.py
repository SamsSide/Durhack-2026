"""Shared kit for the building styles: the Builder (primitives) and the style palettes.

Imported by build_styles.py. Blender is Z-up; the glTF exporter converts to +Y up.
"""
import math
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

TEAM = (0.93, 0.91, 0.85)
PI = math.pi


def hsh(i):
    """Cheap repeatable noise in 0..1 (irregular rocks, scrap walls)."""
    return (math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1.0


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
    # nation identity (row A24), palettes from docs/research/building-references.md
    # soviet_bloc: panel concrete, dark concrete, bitumen roof, Stalinist sandstone, windows, gold
    "soviet_bloc": dict(wall="#B4B2A8", stone="#85837B", roof="#55565A", trim="#C9B79A", dark="#2E3138", extra="#D4A93A"),
    # western_modern: white stone, brick, asphalt shingle, glass, dark glass, lawn
    "western_modern": dict(wall="#EDE8DC", stone="#9A6B4F", roof="#5A5F66", trim="#7FB6CC", dark="#2F4454", extra="#5E8C4A"),
    # egyptian: limestone, sandstone, mudbrick, lapis, doorways, gold
    "egyptian": dict(wall="#E6D3A3", stone="#C8A26A", roof="#8A6A45", trim="#2F6E9E", dark="#3A2C20", extra="#D4A93A"),
    # highland (Himalayan): whitewash, rock, dark timber roof, ochre-red band, windows, gold roof
    "highland": dict(wall="#F2EEE4", stone="#8D8578", roof="#4A3A2E", trim="#8E2A1E", dark="#2A2220", extra="#D4A93A"),
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

    def lathe(self, x, y, z0, profile, mat, seg=8, rz=0.0, close_bottom=True, rot=None):
        """Solid of revolution. profile = [(radius, z), ...] from bottom to top.
        rot=(rx, ry, rz) tilts the whole solid (a radar dish); without it only rz applies."""
        m = self._m(x, y, z0, rot if rot is not None else (0, 0, rz))
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

    # ---- pieces for the nation-identity styles (docs/research/building-references.md)
    def bands(self, x, y, z0, w, d, floors, fh, mat="dark", bh=0.38, every=1, proud=0.003):
        """Horizontal window bands round a w x d block: one proud slab per floor."""
        for i in range(0, floors, every):
            self.box(x, y, z0 + i * fh + fh * 0.36, w + 2 * proud, d + 2 * proud, fh * bh * every, mat)

    def strips(self, x, y, z0, w, d, h, n, mat, sw=0.02, proud=0.005, axis="x"):
        """n vertical strips (stair cores, mullions) spread over w, proud of both faces d apart.
        axis="x": spread along x, showing on the -y and +y faces; axis="y": the other pair."""
        for k in range(n):
            c = -w / 2 + (k + 0.5) * w / n
            if axis == "x":
                self.box(x + c, y, z0, sw, d + 2 * proud, h, mat)
            else:
                self.box(x, y + c, z0, d + 2 * proud, sw, h, mat)

    def panel_slab(self, x, y, L, D, floors, fh=0.04, rz=0.0, sections=4, every=1, z0=0.0,
                   mat="wall", band="dark", roof="roof"):
        """Khrushchyovka / Brezhnevka slab, long axis local x: window bands, stair strips, flat roof.
        Returns the roof z."""
        h = floors * fh
        with self.at(x, y, rz):
            self.box(0, 0, z0, L, D, h, mat)
            self.bands(0, 0, z0, L, D, floors, fh, band, every=every)
            if sections > 1:
                self.strips(0, 0, z0, L, D, h, sections - 1, mat, sw=0.024, proud=0.006)
            self.box(0, 0, z0 + h, L + 0.012, D + 0.012, 0.014, roof)
        return z0 + h + 0.014

    def star(self, x, y, z, r, mat="team", points=5, depth=0.016, ri=0.45, rz=0.0):
        """Upright star in the local x-z plane (faces -y when rz = 0), centred on (x, y, z)."""
        m = self._m(x, y, z, (0, 0, rz))
        t = depth / 2
        pts = []
        for k in range(points * 2):
            a = PI / 2 + k * PI / points
            rr = r if k % 2 == 0 else r * ri
            pts.append((rr * math.cos(a), rr * math.sin(a)))
        faces = []
        for k in range(len(pts)):
            (ax, az), (bx, bz) = pts[k], pts[(k + 1) % len(pts)]
            faces.append([(0, -t, 0), (ax, -t, az), (bx, -t, bz)])
            faces.append([(0, t, 0), (bx, t, bz), (ax, t, az)])
            faces.append([(ax, -t, az), (ax, t, az), (bx, t, bz), (bx, -t, bz)])
        self._poly(faces, m, mat)

    def chimney(self, x, y, h, r0, r1, mat="wall", band_mat="team", bands=2, bh=0.05, z0=0.0, seg=6):
        self.cyl(x, y, z0, r0, h, mat, seg=seg, r2=r1)
        for k in range(bands):
            zb = h * (0.62 + 0.2 * k)
            rr = r0 + (r1 - r0) * ((zb + bh / 2) / h) + 0.006
            self.cyl(x, y, z0 + zb, rr, bh, band_mat, seg=seg)

    def dish(self, x, y, z, r, tilt=0.9, mat="wall", seg=8, rz=0.0):
        """Radar dish: a shallow closed bowl whose flat face looks up and toward -y (turned by rz)."""
        prof = [(0.0, 0.0), (r * 0.55, r * 0.08), (r * 0.88, r * 0.22), (r, r * 0.36)]
        self.lathe(x, y, z, prof, mat, seg=seg, rot=(tilt, 0, rz))

    def lattice_mast(self, x, y, h, w, mat="dark", z0=0.0, t=0.012):
        for sx in (-1, 1):
            for sy in (-1, 1):
                self.box(x + sx * w / 2, y + sy * w / 2, z0, t, t, h, mat)
        for k in range(1, 4):
            self.box(x, y, z0 + h * k / 3 - t, w + t, w + t, t, mat)

    def colonnade(self, x0, x1, y, z, n, h, r=0.015, mat="wall", seg=4):
        for k in range(n):
            self.cyl(x0 + (x1 - x0) * k / (n - 1), y, z, r, h, mat, seg=seg, rot=(0, 0, PI / 4))

    def drum_dome(self, x, y, z, r, cols=10, mat="wall", base="roof", seg=10):
        """Capitol dome: base drum, a ring of posts round a dark drum, cornice, dome, lantern.
        Returns the top z."""
        self.cyl(x, y, z, r * 1.32, r * 0.3, base, seg=seg)
        self.cyl(x, y, z + r * 0.3, r * 0.9, r * 0.7, "dark", seg=seg)
        for k in range(cols):
            a = 2 * PI * (k + 0.5) / cols
            self.box(x + r * 1.08 * math.cos(a), y + r * 1.08 * math.sin(a), z + r * 0.3,
                     r * 0.2, r * 0.2, r * 0.7, mat, rot=(0, 0, a))
        self.cyl(x, y, z + r, r * 1.26, r * 0.14, mat, seg=seg)
        pr = [(1.0, 0), (0.95, 0.38), (0.76, 0.74), (0.42, 0.98), (0.14, 1.06)]
        self.lathe(x, y, z + r * 1.14, [(a * r, c * r) for a, c in pr], mat, seg=seg)
        top = z + r * 2.2
        self.cyl(x, y, top - 0.005, r * 0.17, r * 0.4, mat, seg=6)
        return top + r * 0.4 - 0.005

    def poly_ring(self, x, y, z0, r_out, r_in, h, mat, sides=5, rz=0.0):
        """Regular polygon ring (the Pentagon), one corner toward +y. r_in = 0 gives a filled prism."""
        m = self._m(x, y, z0, (0, 0, rz + PI / 2))

        def P(r, i, z):
            return (r * math.cos(2 * PI * i / sides), r * math.sin(2 * PI * i / sides), z)

        faces = []
        for i in range(sides):
            j = (i + 1) % sides
            faces.append([P(r_out, i, 0), P(r_out, j, 0), P(r_out, j, h), P(r_out, i, h)])
            if r_in > 0:
                faces.append([P(r_in, j, 0), P(r_in, i, 0), P(r_in, i, h), P(r_in, j, h)])
                faces.append([P(r_out, i, h), P(r_out, j, h), P(r_in, j, h), P(r_in, i, h)])
                faces.append([P(r_out, j, 0), P(r_out, i, 0), P(r_in, i, 0), P(r_in, j, 0)])
        if r_in == 0:
            faces.append([P(r_out, i, h) for i in range(sides)])
            faces.append([P(r_out, i, 0) for i in reversed(range(sides))])
        self._poly(faces, m, mat)

    def battered(self, x, y, z0, w, d, h, mat, k=0.83, rz=0.0):
        """Box with inward-sloping walls: top = k x bottom. Pylon, mastaba, fortress, dzong."""
        self.frustum(x, y, z0, w, d, w * k, d * k, h, mat, rz=rz)

    def obelisk(self, x, y, z0, base, h, mat="wall", cap="extra", band=None, plinth="stone", caph=1.3):
        """Tapered shaft on a low plinth with a pyramidion; h is the shaft height."""
        if plinth:
            self.box(x, y, z0, base * 1.7, base * 1.7, 0.025, plinth)
            z0 += 0.025
        self.frustum(x, y, z0, base, base, base * 0.66, base * 0.66, h, mat)
        self.frustum(x, y, z0 + h, base * 0.66, base * 0.66, 0, 0, base * caph, cap)
        if band:
            self.box(x, y, z0 + h * 0.42, base * 0.9, base * 0.9, h * 0.1, band)
        return z0 + h + base * caph

    def hill(self, x, y, r, h, mat="stone", seg=8, jag=0.16, seed=0, top=0.86, mid=0.95, sq=0.0, z0=0.0, rz=0.3):
        """Irregular rock: three jittered rings (foot, shoulder, top). r is the half-extent in x and
        y (the rings are scaled to fit it); sq > 0 pushes the outline toward a square."""
        rings = []
        for k, (rf, zf) in enumerate([(1.0, 0.0), (mid, 0.6), (top, 1.0)]):
            ring = []
            for i in range(seg):
                a = 2 * PI * i / seg + rz
                j = 1.0 + jag * (hsh(seed + i * 7 + k) - 0.5)
                j *= (1.0 / max(abs(math.cos(a)), abs(math.sin(a)))) ** sq
                ring.append((rf * j * math.cos(a), rf * j * math.sin(a), h * zf))
            rings.append(ring)
        ext = max(max(abs(p[0]), abs(p[1])) for p in rings[0] + rings[1])
        rings = [[(px * r / ext, py * r / ext, pz) for px, py, pz in ring] for ring in rings]
        faces = [list(reversed(rings[0])), rings[-1]]
        for k in range(len(rings) - 1):
            for i in range(seg):
                j = (i + 1) % seg
                faces.append([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
        self._poly(faces, self._m(x, y, z0, (0, 0, 0)), mat)
        return z0 + h

    def terraces(self, x, y, z0, w0, d0, n, step, riser, mat="stone", top=None, back=True, side=None):
        """Stacked shrinking platforms. back=True steps them toward +y (a hillside: the back edge
        stays put), else concentric. side is the shrink per level on each x side (default: step
        when concentric, 0 on a hillside). top adds a thin tread in that material. Returns the top z."""
        side = (0.0 if back else step) if side is None else side
        z = z0
        for i in range(n):
            w = w0 - 2 * i * side
            d = d0 - (i * step if back else 2 * i * step)
            cy = y + (i * step / 2 if back else 0)
            self.box(x, cy, z, w, d, riser, mat)
            z += riser
            if top:
                self.box(x, cy, z, w - 0.012, d - 0.012, 0.006, top)
        return z + (0.006 if top else 0.0)

    def flared_roof(self, x, y, z, w, d, h, mat="roof", cap="extra", flare=1.3):
        """Himalayan roof: a dark lip that widens outward under a gilded hipped canopy. Returns the top z."""
        self.frustum(x, y, z, w, d, w * flare, d * flare, h * 0.3, mat)
        self.frustum(x, y, z + h * 0.3, w * flare, d * flare, w * 0.3, d * 0.3, h * 0.7, cap)
        return z + h

    def tower_house(self, x, y, z0, base, h, top=0.78, wall="wall", roof="roof", win="dark", band=None):
        """Svan / dzong watchtower: tapering square shaft, slot windows, shallow pyramid roof."""
        self.frustum(x, y, z0, base, base, base * top, base * top, h, wall)
        if band:
            self.box(x, y, z0 + h * 0.8, base * top + 0.012, base * top + 0.012, h * 0.14, band)
        self.box(x, y, z0 + h * 0.56, base * 0.26, base * 0.9, h * 0.12, win)
        self.frustum(x, y, z0 + h, base * top + 0.05, base * top + 0.05, 0, 0, base * 0.55, roof)
        return z0 + h + base * 0.55

    def prayer_flags(self, p0, p1, n=5, mat="team", s=0.045, sag=0.03):
        """A string of n square flags from p0 to p1 (x, y, z), with a pole under the low end."""
        rz = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        for k in range(n):
            t = (k + 0.5) / n
            self.box(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t,
                     p0[2] + (p1[2] - p0[2]) * t - sag * 4 * t * (1 - t) - s, s, 0.01, s, mat, rot=(0, 0, rz))

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
