"""Kit for the technology-age unit models (row A23): the styles Builder plus rods, prisms, lofted
hulls, sails and little people. Imported by ages_defs.py and build_ages.py.

Everything is drawn with +x as "forward" (ship bows and soldiers face +x), z up, and for ships
z = 0 is the waterline. AgeBuilder.build() scales each model so its longest side is 1.
"""
import math

import bmesh
from mathutils import Matrix, Vector

from styles_kit import PALETTES, Builder

PI = math.pi

# One palette for every age. `team` is added by the kit (lane b recolours it).
PALETTES["ages"] = dict(
    wood="#7B5433", wood_dark="#4A3323", wood_light="#B08A55", deck="#C9AE7C", canvas="#F4EBD3",
    dark="#2B2724", black="#1F1F22", bronze="#C08A3A", steel="#A3A9AF", iron="#474C54",
    navy="#8D979F", navy_light="#B9C1C6", navy_dark="#5C646B", white="#ECE8DD", buff="#D2A95A",
    red="#9C3B2B", terracotta="#B8643C", skin="#D9A47A", horse="#6B4A32", horse2="#A59C8E",
    khaki="#9A8C5B", khaki_dark="#6E6A47", olive="#66733F", olive_dark="#414C2C", smoke="#99948C",
    ochre="#C79A45", blue="#2F5F8A", green="#3F7F5A", orange="#D08A2E", glass="#9FB4BF",
)


class AgeBuilder(Builder):
    def __init__(self):
        super().__init__("ages")

    # ---- extra primitives
    def rod(self, p0, p1, r, mat, seg=4, r2=None):
        """A cylinder (or a cone with r2=0) from p0 to p1."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        m = self.stack[-1] @ Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        n = set(self.bm.faces)
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                              radius2=r if r2 is None else r2, depth=d.length, matrix=m)
        self._finish(n, mat)

    def path(self, pts, r, mat, seg=4):
        for a, c in zip(pts, pts[1:]):
            self.rod(a, c, r, mat, seg=seg)

    def prism(self, profile, y0, y1, mat):
        """Extrude a polygon drawn in the x-z plane ([(x, z), ...]) from y0 to y1."""
        a = [(x, y0, z) for x, z in profile]
        c = [(x, y1, z) for x, z in profile]
        faces = [a, list(reversed(c))]
        k = len(profile)
        for i in range(k):
            j = (i + 1) % k
            faces.append([a[i], a[j], c[j], c[i]])
        self._poly(faces, self.stack[-1], mat)

    def loft(self, sections, mat):
        """Closed solid through cross-sections [(x, half_width_low, half_width_high, z_low, z_high)]."""
        faces = []
        for (x0, a0, b0, l0, h0), (x1, a1, b1, l1, h1) in zip(sections, sections[1:]):
            for s in (1, -1):
                faces.append([(x0, s * a0, l0), (x1, s * a1, l1), (x1, s * b1, h1), (x0, s * b0, h0)])
            faces.append([(x0, -b0, h0), (x1, -b1, h1), (x1, b1, h1), (x0, b0, h0)])
            faces.append([(x0, -a0, l0), (x1, -a1, l1), (x1, a1, l1), (x0, a0, l0)])
        for x, a, c, lo, hi in (sections[0], sections[-1]):
            faces.append([(x, -a, lo), (x, a, lo), (x, c, hi), (x, -c, hi)])
        self._poly(faces, self.stack[-1], mat)

    def ball(self, x, y, z, r, mat, seg=6):
        self.lathe(x, y, z - r, [(0, 0), (0.72 * r, 0.3 * r), (r, r), (0.72 * r, 1.7 * r), (0, 2 * r)], mat, seg=seg)

    def disc(self, x, y, z, r, t, mat, axis="y", seg=8):
        """A wheel or shield: a short cylinder centred on (x, y, z) with its axis along x or y."""
        rot = (PI / 2, 0, 0) if axis == "y" else (0, PI / 2, 0)
        self.cyl(x, y, z - t / 2, r, t, mat, seg=seg, rot=rot)

    def build(self, name):
        bm = self.bm
        ext = []
        for i in range(3):
            cs = [v.co[i] for v in bm.verts]
            ext.append(max(cs) - min(cs))
        k = 0.9995 / max(ext)
        for v in bm.verts:
            v.co *= k
        return super().build(name)


# ---------------------------------------------------------------- ships
class Hull:
    """A lofted hull above the waterline. stations = [(x, half_beam_waterline, half_beam_deck, deck_z)]."""

    def __init__(self, b, stations, side="wood", deck="deck", inset=0.8):
        self.b, self.st = b, stations
        b.loft([(x, wb, wt, 0.0, z) for x, wb, wt, z in stations], side)
        if deck:
            b.loft([(x, wt * inset, wt * inset, z - 0.004, z + 0.005) for x, wb, wt, z in stations], deck)

    def _at(self, x):
        st = self.st
        if x <= st[0][0]:
            return st[0][1:]
        for p, q in zip(st, st[1:]):
            if x <= q[0]:
                t = (x - p[0]) / (q[0] - p[0])
                return tuple(p[i] + (q[i] - p[i]) * t for i in (1, 2, 3))
        return st[-1][1:]

    def z(self, x):
        return self._at(x)[2]

    def w(self, x, z=None):
        wb, wt, zd = self._at(x)
        return wt if z is None else wb + (wt - wb) * min(1.0, z / zd)

    def band(self, lo, hi, mat, x0=None, x1=None, out=0.004, top=False):
        """A stripe along both sides. Heights are absolute, or measured down from the deck with top=True."""
        x0 = self.st[0][0] if x0 is None else x0
        x1 = self.st[-1][0] if x1 is None else x1
        xs = sorted({x0, x1} | {s[0] for s in self.st if x0 < s[0] < x1})
        secs = []
        for x in xs:
            zd = self.z(x)
            a, c = (zd - lo, zd - hi) if top else (lo, hi)
            secs.append((x, self.w(x, a) + out, self.w(x, c) + out, a, c))
        self.b.loft(secs, mat)


def mast(b, x, z0, top, r=0.011, mat="wood_dark", y=0.0):
    b.rod((x, y, z0), (x, y, top), r, mat, seg=4, r2=r * 0.6)


def sail(b, x, z0, w, h, mat="canvas", belly=0.05, stripes=(), stripe_mat="team", yard=True, t=0.012, brace=-0.3):
    """A square sail filled by the wind, hung just ahead of a mast at x and braced round a little so it
    shows from above as well as from the side. stripes = [(y0, y1)]."""
    def prof(e):
        front = [(0.0, 0.0), (belly * 0.8, 0.25), (belly, 0.6), (0.0, 1.0)]
        return ([(u + e, z0 + v * h) for u, v in front]
                + [(u - t - e, z0 + v * h) for u, v in reversed(front)])
    with b.at(x, 0, brace):
        b.prism(prof(0.0), -w / 2, w / 2, mat)
        for y0, y1 in stripes:
            b.prism(prof(0.004), y0, y1, stripe_mat)
        if yard:
            b.rod((-t / 2, -w / 2 - 0.02, z0 + h), (-t / 2, w / 2 + 0.02, z0 + h), 0.008, "wood_dark", seg=3)


def lateen(b, x, z0, h, mat="canvas", fwd=0.1, aft=0.13):
    b.prism([(x + fwd, z0 + 0.03), (x - aft, z0 + h), (x - aft, z0)], -0.006, 0.006, mat)
    b.rod((x + fwd + 0.02, 0, z0 + 0.01), (x - aft - 0.02, 0, z0 + h + 0.03), 0.007, "wood_dark", seg=3)


def flag(b, x, y, z0, h, w=0.12, fh=0.07, mat="team", pole="dark", r=0.006):
    """A pole with a flag streaming aft (towards -x)."""
    b.rod((x, y, z0), (x, y, z0 + h), r, pole, seg=3)
    b.box(x - w / 2, y, z0 + h - fh, w, 0.008, fh, mat)


def smoke(b, x, z, n=3, r=0.045, mat="smoke"):
    for i in range(n):
        b.ball(x - 0.035 - i * 0.075, 0.012 * (-1) ** i, z + 0.035 + i * 0.05, r * (0.75 + 0.22 * i), mat)


def funnel(b, x, z0, r, h, mat="buff", band="team", top="black", seg=8, rake=0.0):
    p0, p1 = Vector((x, 0, z0)), Vector((x - rake, 0, z0 + h))
    d = p1 - p0
    b.rod(p0, p0 + d * 0.55, r, mat, seg=seg)
    b.rod(p0 + d * 0.55, p0 + d * 0.8, r * 1.04, band, seg=seg)
    b.rod(p0 + d * 0.8, p1, r * 1.04, top, seg=seg)


# ---------------------------------------------------------------- people and beasts
def man(b, coat, legs="dark", head="skin", s=1.0):
    """A standing figure about 0.29 tall facing +x, at the builder's current origin. Returns the head top."""
    b.box(0, 0, 0, 0.06 * s, 0.1 * s, 0.12 * s, legs)
    b.box(0, 0, 0.12 * s, 0.075 * s, 0.13 * s, 0.11 * s, coat)
    b.box(0, 0, 0.23 * s, 0.07 * s, 0.07 * s, 0.06 * s, head)
    return 0.29 * s


def horse(b, coat="horse", cloth="team"):
    """A horse about 0.4 long facing +x, in a caparison."""
    for x in (-0.115, 0.115):
        for y in (-0.033, 0.033):
            b.box(x, y, 0, 0.03, 0.028, 0.14, coat)
    b.box(0, 0, 0.13, 0.31, 0.09, 0.095, coat)
    b.box(-0.01, 0, 0.1, 0.2, 0.104, 0.135, cloth)
    b.rod((0.12, 0, 0.2), (0.2, 0, 0.345), 0.036, coat, seg=4)
    b.rod((0.165, 0, 0.35), (0.285, 0, 0.29), 0.027, coat, seg=4)
    b.rod((-0.155, 0, 0.215), (-0.21, 0, 0.08), 0.016, "dark", seg=3)
