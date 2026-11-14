"""The four nation-identity styles (row A24): soviet_bloc, western_modern, egyptian, highland.

Same contract as styles_defs.py (one class per style, material slots wall, stone, roof, trim,
dark, extra, team). Where an architecture has no town wall (slab blocks, glass towers, terraces)
the class overrides the kind layout but keeps the shared footprint.
"""
import math

from styles_defs import Base

PI = math.pi


# ---------------------------------------------------------------- extra pieces
def star(b, x, y, z, r, t=0.018, mat="team"):
    """Upright five-pointed star facing -y, centred on (x, y, z)."""
    m = b._m(x, y, z, (0, 0, 0))
    pts = []
    for k in range(10):
        a = PI / 2 + k * PI / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    faces = []
    for k in range(10):
        (ax, az), (bx, bz) = pts[k], pts[(k + 1) % 10]
        faces.append([(0, -t / 2, 0), (ax, -t / 2, az), (bx, -t / 2, bz)])
        faces.append([(0, t / 2, 0), (bx, t / 2, bz), (ax, t / 2, az)])
        faces.append([(ax, -t / 2, az), (ax, t / 2, az), (bx, t / 2, bz), (bx, -t / 2, bz)])
    b._poly(faces, m, mat)


def vault(b, x, y, z, w, L, h, mat, seg=6, rz=0.0):
    """Half-cylinder shed (hangar), axis along local y."""
    m = b._m(x, y, z, (0, 0, rz))
    pr = [(w / 2 * math.cos(PI * i / seg), h * math.sin(PI * i / seg)) for i in range(seg + 1)]
    f = [(px, -L / 2, pz) for px, pz in pr]
    k = [(px, L / 2, pz) for px, pz in pr]
    faces = [[f[i], f[i + 1], k[i + 1], k[i]] for i in range(seg)]
    faces += [list(f), list(reversed(k)), [f[0], f[seg], k[seg], k[0]]]
    b._poly(faces, m, mat)


def dish(b, x, y, z, mast, r, mat="wall"):
    """Radar: mast with a tilted dish on top."""
    b.cyl(x, y, z, 0.014, mast, "dark", seg=4)
    b.cone(x, y, z + mast - 0.01, r, r * 0.6, mat, seg=8, rot=(PI + 0.75, 0, 0.5))


def tree(b, x, y, z, s=1.0, mat="extra"):
    b.cyl(x, y, z, 0.012 * s, 0.04 * s, "dark", seg=4)
    b.cone(x, y, z + 0.035 * s, 0.05 * s, 0.13 * s, mat, seg=5)


# ------------------------------------------------------------------ soviet bloc
class SovietBloc(Base):
    name = "soviet_bloc"

    def slab(self, b, x, y, L, d, h, rz=0.0, floors=4, mat="wall"):
        """Panel block: window bands, stair cores, flat roof, a team stripe down one end wall."""
        with b.at(x, y, rz):
            b.box(0, 0, 0, L, d, h, mat)
            fh = h / (floors + 0.4)
            for k in range(floors):
                b.box(0, 0, fh * (k + 0.55), L * 0.92, d + 0.008, fh * 0.42, "dark")
            for s in (-1, 1):
                b.box(s * L * 0.2, 0, 0, 0.035, d + 0.014, h, mat)
            b.box(0, 0, h, L + 0.014, d + 0.014, 0.015, "extra")
            b.box(L / 2 + 0.002, 0, h * 0.08, 0.008, d * 0.4, h * 0.84, "team")
            b.box(-L / 2 - 0.002, 0, h * 0.08, 0.008, d * 0.4, h * 0.84, "team")

    def cake(self, b, x, y, z, tiers, mat="roof"):
        """Setback (wedding-cake) tower: stacked shrinking boxes with window strips and cornices."""
        for w, d, h in tiers:
            b.box(x, y, z, w, d, h, mat)
            if w >= 0.1:
                n = 4 if w > 0.36 else 3 if w > 0.16 else 2
                for k in range(n):
                    b.box(x + (k - (n - 1) / 2) * w / (n + 0.2), y, z + h * 0.14, w / (n * 2.6), d + 0.008, h * 0.68, "dark")
            b.box(x, y, z + h, w + 0.022, d + 0.022, 0.012, "stone")
            z += h + 0.012
        return z

    def spire(self, b, x, y, z, h, r=0.028, sr=0.05):
        b.cone(x, y, z, r, h, "trim", seg=4, rot=(0, 0, PI / 4))
        star(b, x, y, z + h + sr * 0.75, sr)
        return z + h + sr * 1.75

    def statue(self, b, x, y, z):
        b.box(x, y, z, 0.07, 0.07, 0.08, "stone")
        b.box(x, y, z + 0.08, 0.03, 0.025, 0.09, "dark")
        b.box(x + 0.025, y - 0.01, z + 0.14, 0.05, 0.015, 0.015, "dark", rot=(0, -0.5, 0))

    def capital(self, b):
        b.box(0, 0, 0, 0.98, 0.98, 0.02, "extra")           # the parade square
        b.box(0, -0.25, 0.02, 0.5, 0.3, 0.004, "wall")
        for sx in (-1, 1):
            self.slab(b, sx * 0.4, 0.1, 0.62, 0.13, 0.2, rz=PI / 2)
        z = self.cake(b, 0, 0.22, 0.02, [(0.48, 0.26, 0.15), (0.3, 0.22, 0.14), (0.2, 0.18, 0.13),
                                         (0.13, 0.13, 0.12), (0.08, 0.08, 0.09)])
        self.spire(b, 0, 0.22, z, 0.15)
        for sx in (-1, 1):                                  # side pinnacles on the first tier
            b.box(sx * 0.19, 0.22, 0.18, 0.07, 0.07, 0.11, "roof")
            b.cone(sx * 0.19, 0.22, 0.29, 0.03, 0.1, "trim", seg=4, rot=(0, 0, PI / 4))
        b.box(0, -0.02, 0.02, 0.26, 0.09, 0.04, "stone")    # the tribune
        b.box(0, -0.01, 0.06, 0.18, 0.06, 0.035, "roof")
        b.box(0, -0.066, 0.03, 0.2, 0.006, 0.022, "team")
        self.statue(b, 0, -0.27, 0.02)
        for sx in (-0.3, -0.12, 0.12, 0.3):
            self.flag(b, sx, -0.42, 0.02, 0.2, w=0.085, fh=0.1)

    def city(self, b):
        for y in (0.36, 0.1, -0.16):
            self.slab(b, -0.19, y, 0.54, 0.13, 0.2)
        # brutalist tower: shaft, overhanging head, antenna, a long banner
        b.box(0.31, 0.27, 0, 0.19, 0.19, 0.5, "stone")
        for k in range(4):
            b.box(0.31, 0.27, 0.06 + k * 0.11, 0.198, 0.14, 0.05, "dark")
        b.box(0.31, 0.27, 0.5, 0.27, 0.27, 0.11, "wall")
        b.box(0.31, 0.27, 0.535, 0.278, 0.278, 0.035, "dark")
        b.box(0.31, 0.27, 0.61, 0.12, 0.12, 0.04, "stone")
        b.cyl(0.31, 0.27, 0.65, 0.01, 0.2, "dark", seg=4)
        b.box(0.31, 0.172, 0.08, 0.05, 0.008, 0.4, "team")
        # works: sawtooth shed and a banded chimney
        b.box(0.27, -0.2, 0, 0.3, 0.26, 0.1, "extra")
        for k in range(3):
            b.shed(0.17 + k * 0.1, -0.2, 0.1, 0.26, 0.1, 0.06, "stone", rz=-PI / 2, h0=0.0)
        b.cyl(0.4, -0.4, 0, 0.05, 0.72, "roof", seg=6, r2=0.032)
        b.cyl(0.4, -0.4, 0.5, 0.044, 0.05, "team", seg=6)
        b.cyl(0.4, -0.4, 0.64, 0.039, 0.05, "team", seg=6)
        # the square
        self.statue(b, -0.02, -0.38, 0)
        self.flag(b, -0.3, -0.38, 0, 0.26, w=0.1, fh=0.1)
        b.box(-0.2, -0.36, 0, 0.1, 0.07, 0.05, "extra")

    def town(self, b):
        self.slab(b, 0.07, 0.36, 0.66, 0.13, 0.19)
        self.slab(b, -0.38, -0.08, 0.56, 0.13, 0.19, rz=PI / 2)
        # house of culture: columned box with a banner
        x, y = 0.14, -0.02
        b.box(x, y - 0.02, 0, 0.4, 0.3, 0.025, "stone")
        b.box(x, y + 0.02, 0.025, 0.32, 0.2, 0.15, "roof")
        for k in range(5):
            b.cyl(x - 0.14 + k * 0.07, y - 0.12, 0.025, 0.016, 0.15, "wall", seg=5)
        b.box(x, y - 0.015, 0.175, 0.36, 0.29, 0.03, "stone")
        b.box(x, y, 0.205, 0.22, 0.2, 0.035, "roof")
        b.box(x, y - 0.162, 0.178, 0.26, 0.006, 0.024, "team")
        self.flag(b, x, y, 0.24, 0.2, w=0.1, fh=0.08)
        self.statue(b, x, -0.34, 0)
        b.box(-0.14, -0.36, 0, 0.12, 0.08, 0.06, "extra")
        b.box(-0.14, -0.36, 0.06, 0.14, 0.1, 0.012, "team")

    def temple(self, b):
        # memorial: a wedge-shaped concrete hall and a tall obelisk with a star
        z = self.plinth(b, 0, 0, 0, 0.92, 0.92, 2, 0.03, mat="stone", mat2="extra")
        # the hall rises from 0.12 at its right edge to 0.4 at its left
        b.shed(-0.15, 0.1, z, 0.46, 0.5, 0.4, "wall", rz=PI / 2, h0=0.12)
        for k in range(5):
            t = k / 4
            hh = 0.4 - 0.28 * t
            b.box(-0.385 + t * 0.47, -0.14, z, 0.03, 0.04, hh + 0.02, "stone")
            if k < 4:
                hm = 0.4 - 0.28 * (t + 0.125)
                b.box(-0.385 + (t + 0.125) * 0.47, -0.132, z + 0.03, 0.085, 0.008, hm - 0.07, "dark")
                b.box(-0.385 + (t + 0.125) * 0.47, -0.137, z + hm - 0.1, 0.085, 0.008, 0.04, "team")
        ox, oy = 0.26, -0.1
        b.box(ox, oy, z, 0.2, 0.2, 0.05, "stone")
        b.box(ox, oy, z + 0.05, 0.13, 0.13, 0.05, "roof")
        b.frustum(ox, oy, z + 0.1, 0.09, 0.09, 0.045, 0.045, 0.6, "wall")
        b.frustum(ox, oy, z + 0.7, 0.045, 0.045, 0, 0, 0.05, "trim")
        star(b, ox, oy, z + 0.8, 0.06)
        b.box(0.26, -0.34, z, 0.1, 0.1, 0.03, "dark")       # the eternal flame
        b.cone(0.26, -0.34, z + 0.03, 0.03, 0.07, "team", seg=4)

    def fort(self, b):
        # military base: blast walls, a bunker, radar, a missile on its launcher
        h, half, t = 0.09, 0.4, 0.06
        b.box(0, half, 0, 2 * half + t, t, h, "wall")
        for sx in (-1, 1):
            b.box(sx * half, 0, 0, t, 2 * half + t, h, "wall")
            b.box(sx * 0.27, -half, 0, 0.3, t, h, "wall")
            for sy in (-1, 1):
                b.cyl(sx * half, sy * half, 0, 0.065, 0.14, "stone", seg=6)
                b.cyl(sx * half, sy * half, 0.14, 0.075, 0.02, "dark", seg=6)
        b.frustum(-0.1, 0.14, 0, 0.46, 0.36, 0.36, 0.26, 0.16, "stone")
        b.box(-0.1, -0.02, 0.07, 0.26, 0.04, 0.035, "dark")
        b.box(-0.1, 0.14, 0.16, 0.2, 0.16, 0.05, "wall")
        b.box(-0.1, 0.14, 0.21, 0.23, 0.19, 0.015, "team")
        dish(b, 0.25, 0.22, 0, 0.3, 0.11)
        b.box(0.2, -0.14, 0, 0.14, 0.2, 0.04, "dark")
        b.box(0.17, -0.14, 0.04, 0.03, 0.05, 0.1, "stone")
        b.cyl(0.14, -0.14, 0.06, 0.03, 0.3, "wall", seg=6, rot=(0, 0.85, 0))
        b.cone(0.14 + 0.19 * math.sin(0.85), -0.14, 0.21 + 0.19 * math.cos(0.85) - 0.04, 0.03, 0.08, "team", seg=6, rot=(0, 0.85, 0))
        self.flag(b, -0.22, -0.2, 0, 0.46, w=0.14, fh=0.1)


# ------------------------------------------------------------------ western modern
class WesternModern(Base):
    name = "western_modern"

    def glass(self, b, x, y, w, d, h, mat="trim", band="roof", crown=True):
        """Curtain-wall tower: glass box, floor bands, a team crown strip, a roof plant box."""
        b.box(x, y, 0, w, d, h, mat)
        n = max(2, int(h / 0.13))
        for k in range(1, n + 1):
            b.box(x, y, h * k / (n + 1) - 0.006, w + 0.008, d + 0.008, 0.012, band)
        b.box(x, y, h, w + 0.014, d + 0.014, 0.022, "team" if crown else "wall")
        b.box(x, y, h + 0.022, w * 0.5, d * 0.5, 0.03, "wall")
        return h + 0.022

    def midrise(self, b, x, y, w, d, h, awning=True):
        b.box(x, y, 0, w, d, h, "stone")
        for k in range(2):
            b.box(x, y, h * (0.34 + 0.34 * k), w + 0.008, d + 0.008, h * 0.16, "dark")
        b.box(x, y, h, w + 0.014, d + 0.014, 0.014, "wall")
        if awning:
            b.box(x, y - d / 2 - 0.02, h * 0.2, w * 0.8, 0.05, 0.012, "team", rot=(0.4, 0, 0))

    def house(self, b, x, y, w, d, h, rz, i):
        with b.at(x, y, rz):
            b.box(0, 0, 0, w, d, h, "wall" if i % 2 == 0 else "stone")
            b.gable(0, 0, h, w, d, d * 0.42, "team" if i % 2 == 0 else "roof", over=0.012)
            b.box(w * 0.28, d * 0.12, h, 0.03, 0.03, d * 0.42 + 0.02, "stone" if i % 2 == 0 else "wall")
            b.box(-w * 0.15, -d / 2 - 0.003, 0, 0.03, 0.008, h * 0.6, "dark")

    def dome(self, b, x, y, z, r):
        """Drum with a column ring, white dome, lantern. Returns the top z."""
        b.cyl(x, y, z, r * 1.2, 0.03, "wall", seg=8)
        b.cyl(x, y, z + 0.03, r * 0.84, 0.075, "dark", seg=8)
        for k in range(8):
            a = 2 * PI * (k + 0.5) / 8
            b.box(x + r * 0.98 * math.cos(a), y + r * 0.98 * math.sin(a), z + 0.03, 0.02, 0.02, 0.075, "wall", rot=(0, 0, a))
        b.cyl(x, y, z + 0.105, r * 1.16, 0.016, "wall", seg=8)
        pr = [(1.0, 0), (0.94, 0.36), (0.74, 0.68), (0.42, 0.9), (0.16, 0.98)]
        b.lathe(x, y, z + 0.121, [(a * r, c * r) for a, c in pr], "wall", seg=8, rz=PI / 8)
        zt = z + 0.121 + 0.98 * r
        b.cyl(x, y, zt - 0.01, r * 0.2, 0.05, "wall", seg=6)
        b.cone(x, y, zt + 0.04, r * 0.24, 0.04, "trim", seg=6)
        return zt + 0.08

    def capitol(self, b, x, y, z):
        b.box(x, y, z, 0.6, 0.24, 0.025, "wall")
        b.box(x, y - 0.14, z, 0.22, 0.08, 0.012, "wall")
        b.box(x, y + 0.01, z + 0.025, 0.56, 0.18, 0.115, "wall")
        for sx in (-1, 1):                                  # windows on the wings
            b.box(x + sx * 0.19, y - 0.082, z + 0.05, 0.14, 0.006, 0.06, "dark")
        for k in range(6):                                  # the portico
            b.cyl(x - 0.085 + k * 0.034, y - 0.1, z + 0.025, 0.011, 0.115, "wall", seg=4)
        b.box(x, y + 0.01, z + 0.14, 0.58, 0.2, 0.014, "roof")
        b.box(x, y - 0.06, z + 0.14, 0.22, 0.11, 0.014, "wall")
        b.gable(x, y - 0.055, z + 0.154, 0.11, 0.2, 0.05, "wall", rz=PI / 2, over=0.0)
        b.box(x, y + 0.01, z + 0.154, 0.26, 0.17, 0.03, "wall")
        zt = self.dome(b, x, y + 0.01, z + 0.184, 0.1)
        self.flag(b, x, y + 0.01, zt - 0.01, 0.13, w=0.09, fh=0.06)

    def capital(self, b):
        b.box(0, 0, 0, 0.98, 0.98, 0.02, "extra")           # lawn
        b.box(0, -0.36, 0.02, 0.1, 0.26, 0.004, "wall")     # the mall path
        b.box(0, -0.22, 0.02, 0.7, 0.05, 0.004, "wall")
        self.capitol(b, 0, -0.06, 0.02)
        self.glass(b, -0.33, 0.3, 0.2, 0.2, 0.52)
        self.glass(b, -0.03, 0.34, 0.22, 0.2, 0.84, mat="roof", band="trim")
        self.glass(b, 0.3, 0.3, 0.2, 0.22, 0.66)
        b.box(-0.03, 0.34, 0.892, 0.012, 0.012, 0.1, "dark")
        for sx in (-1, 1):
            tree(b, sx * 0.14, -0.38, 0.02, 0.9)
            self.flag(b, sx * 0.36, -0.36, 0.02, 0.2, w=0.09, fh=0.06)
            tree(b, sx * 0.43, 0.02, 0.02, 0.9)

    def city(self, b):
        # the spired tower: three setbacks
        x, y = -0.08, 0.14
        z = self.glass(b, x, y, 0.24, 0.22, 0.52)
        b.box(x, y, z, 0.17, 0.16, 0.16, "trim")
        b.box(x, y, z + 0.16, 0.185, 0.175, 0.016, "wall")
        b.box(x, y, z + 0.176, 0.1, 0.1, 0.08, "roof")
        b.cone(x, y, z + 0.256, 0.04, 0.19, "wall", seg=4, rot=(0, 0, PI / 4))
        self.glass(b, 0.22, 0.28, 0.2, 0.2, 0.62, mat="roof", band="trim")
        self.glass(b, -0.36, 0.33, 0.17, 0.17, 0.4, mat="roof", band="trim")
        self.glass(b, 0.17, -0.02, 0.18, 0.16, 0.36)
        self.midrise(b, -0.34, 0.02, 0.2, 0.22, 0.17)
        self.midrise(b, -0.3, -0.34, 0.28, 0.16, 0.13)
        self.midrise(b, 0.38, -0.02, 0.16, 0.2, 0.2)
        self.midrise(b, 0.06, -0.34, 0.22, 0.15, 0.15)
        b.box(0.36, -0.34, 0, 0.2, 0.2, 0.012, "extra")     # a pocket park
        tree(b, 0.32, -0.36, 0.012, 0.9)
        tree(b, 0.41, -0.3, 0.012, 0.7)

    def town(self, b):
        for i in range(6):                                  # houses on a curved street
            a = PI * (1.07 + 0.172 * i)
            x, y = 0.4 * math.cos(a), 0.1 + 0.44 * math.sin(a)
            self.house(b, x, y, 0.16, 0.12, 0.09, a + PI / 2, i)
        # town hall with a clock tower
        x, y = 0.0, 0.3
        b.box(x, y, 0, 0.42, 0.18, 0.15, "stone")
        b.box(x, y - 0.093, 0.05, 0.36, 0.006, 0.06, "dark")
        b.gable(x, y, 0.15, 0.42, 0.18, 0.08, "roof", over=0.012)
        b.box(x, y - 0.1, 0, 0.11, 0.11, 0.4, "stone")
        b.box(x, y - 0.158, 0, 0.05, 0.006, 0.08, "dark")
        b.box(x, y - 0.1, 0.4, 0.13, 0.13, 0.09, "wall")
        b.box(x, y - 0.168, 0.42, 0.055, 0.006, 0.055, "dark")
        b.frustum(x, y - 0.1, 0.49, 0.15, 0.15, 0, 0, 0.16, "team")
        b.box(x, y - 0.24, 0, 0.5, 0.04, 0.008, "extra")
        tree(b, -0.1, 0.02, 0, 0.9)
        tree(b, 0.12, -0.03, 0, 1.0)
        tree(b, 0.42, 0.34, 0, 1.0)
        tree(b, -0.42, 0.34, 0, 0.8)

    def temple(self, b):
        # cathedral hall: steep slate nave with glass walls and a slender spired bell tower
        z = self.plinth(b, 0, 0, 0, 0.8, 0.9, 2, 0.025, mat="wall", mat2="wall")
        x, y = -0.1, 0.05
        b.box(x, y, z, 0.3, 0.6, 0.2, "wall")
        b.gable(x, y, z + 0.2, 0.6, 0.3, 0.26, "roof", rz=PI / 2, over=0.015)
        for sx in (-1, 1):
            for k in range(4):
                b.box(x + sx * 0.151, y - 0.21 + k * 0.14, z + 0.04, 0.008, 0.07, 0.13, "trim")
            for k in range(5):
                b.box(x + sx * 0.16, y - 0.28 + k * 0.14, z, 0.03, 0.03, 0.2, "wall")
        b.frustum(x, y - 0.305, z + 0.06, 0.16, 0.012, 0.0, 0.012, 0.34, "trim")   # the great window
        b.box(x, y - 0.305, z, 0.07, 0.012, 0.07, "dark")
        b.box(x, y + 0.12, z + 0.2, 0.06, 0.06, 0.3, "wall")                       # the crossing fleche
        b.frustum(x, y + 0.12, z + 0.5, 0.07, 0.07, 0, 0, 0.16, "team")
        tx, ty = 0.22, -0.22
        b.box(tx, ty, z, 0.13, 0.13, 0.46, "wall")
        b.box(tx, ty, z + 0.34, 0.138, 0.138, 0.08, "trim")
        b.box(tx, ty, z + 0.46, 0.15, 0.15, 0.02, "team")
        b.frustum(tx, ty, z + 0.48, 0.13, 0.13, 0, 0, 0.4, "roof")
        b.cyl(tx, ty, z + 0.86, 0.007, 0.07, "dark", seg=4)

    def fort(self, b):
        # airbase: runway, two hangars, a control tower, radar, a jet
        b.box(0, 0.08, 0, 0.86, 0.64, 0.012, "extra")
        b.box(0, -0.32, 0, 0.86, 0.2, 0.014, "dark")
        for k in range(4):
            b.box(-0.3 + k * 0.2, -0.32, 0.014, 0.09, 0.016, 0.003, "wall")
        vault(b, -0.22, 0.2, 0.012, 0.34, 0.34, 0.17, "roof", seg=6)
        b.box(-0.22, 0.027, 0.012, 0.2, 0.008, 0.1, "dark")
        b.box(-0.22, 0.024, 0.115, 0.26, 0.012, 0.022, "team")
        vault(b, 0.1, 0.24, 0.012, 0.22, 0.26, 0.11, "roof", seg=6)
        b.box(0.1, 0.107, 0.012, 0.13, 0.008, 0.065, "dark")
        b.box(0.32, 0.02, 0, 0.09, 0.09, 0.36, "wall")
        b.frustum(0.32, 0.02, 0.36, 0.1, 0.1, 0.16, 0.16, 0.07, "trim")
        b.box(0.32, 0.02, 0.43, 0.18, 0.18, 0.018, "team")
        b.cyl(0.32, 0.02, 0.448, 0.008, 0.12, "dark", seg=4)
        dish(b, 0.32, 0.3, 0.012, 0.2, 0.09)
        # the jet
        jx, jy, jz = -0.08, -0.32, 0.03
        b.box(jx, jy, jz, 0.2, 0.034, 0.03, "wall")
        b.cone(jx + 0.13, jy, jz - 0.015, 0.017, 0.06, "wall", seg=4, rot=(0, PI / 2, 0))
        b.frustum(jx - 0.01, jy, jz + 0.01, 0.09, 0.2, 0.03, 0.2, 0.008, "wall", ox=-0.03)
        b.box(jx - 0.085, jy, jz + 0.03, 0.045, 0.008, 0.05, "team")
        self.flag(b, -0.38, -0.16, 0, 0.3, w=0.1, fh=0.07)


# ------------------------------------------------------------------ egyptian
class Egyptian(Base):
    name = "egyptian"
    ring_h = 0.09
    wall_t = 0.07

    def house(self, b, x, y, w, d, h, rz, i):
        with b.at(x, y, rz):
            b.frustum(0, 0, 0, w, d, w * 0.92, d * 0.92, h, "roof")
            b.box(0, 0, h, w * 0.96, d * 0.96, 0.016, "stone")
            b.box(-w * 0.15, -d / 2 - 0.001, 0, 0.035, 0.012, h * 0.55, "dark")
            if i % 2 == 0:
                b.box(w * 0.12, -d / 2 - 0.04, h * 0.62, w * 0.6, 0.1, 0.014, "team", rot=(0.4, 0, 0))
            else:
                b.box(w * 0.18, d * 0.15, h + 0.016, w * 0.45, d * 0.5, 0.06, "roof")

    def granary(self, b, x, y, r):
        b.lathe(x, y, 0, [(r, 0), (r * 0.95, r * 0.9), (r * 0.6, r * 1.6), (r * 0.2, r * 1.95)], "wall", seg=7)

    def tower(self, b, x, y, h):
        b.frustum(x, y, 0, 0.15, 0.15, 0.115, 0.115, h, "stone")
        b.box(x, y, h, 0.14, 0.14, 0.022, "trim")
        b.box(x, y, h + 0.022, 0.1, 0.1, 0.02, "stone")
        b.box(x, y, h + 0.04, 0.012, 0.012, 0.12, "dark")
        b.box(x + 0.035, y, h + 0.12, 0.07, 0.01, 0.04, "team")

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.frustum(0, 0, 0, L, t * 1.25, L, t * 0.6, h, "stone")
            b.box(0, 0, h, L, t * 0.62, 0.014, "wall")

    def pylon(self, b, x, y, z, w, d, h, flags=True, mat="wall"):
        """Gate of two tapered towers, lapis cornices, a lower doorway, banner poles."""
        tw = w * 0.42
        for s in (-1, 1):
            cx = x + s * (w / 2 - tw / 2)
            b.frustum(cx, y, z, tw, d, tw * 0.84, d * 0.62, h, mat)
            b.box(cx, y, z + h, tw * 0.9, d * 0.72, 0.02, "trim")
            b.box(cx, y - d * 0.42, z + h * 0.18, tw * 0.5, 0.01, h * 0.34, "stone")
            if flags:
                px = x + s * (w / 2 - tw * 0.5)
                b.box(px, y - d / 2 - 0.012, z, 0.012, 0.012, h * 1.32, "dark")
                b.box(px + 0.036, y - d / 2 - 0.012, z + h * 1.32 - 0.045, 0.07, 0.008, 0.045, "team")
        gw = w - 2 * tw + 0.03
        b.box(x, y, z, gw, d * 0.62, h * 0.62, mat)
        b.box(x, y - d * 0.31 - 0.002, z, gw * 0.55, 0.01, h * 0.46, "dark")
        b.box(x, y, z + h * 0.62, gw + 0.01, d * 0.66, 0.018, "trim")

    def gate(self, b, x, y, h, t):
        self.pylon(b, x, y, 0, 0.3, t + 0.05, h + 0.11, flags=False)

    def obelisk(self, b, x, y, z, w, h, cap="extra"):
        b.box(x, y, z, w * 1.7, w * 1.7, 0.03, "stone")
        b.frustum(x, y, z + 0.03, w, w, w * 0.62, w * 0.62, h * 0.88, "wall")
        b.frustum(x, y, z + 0.03 + h * 0.88, w * 0.62, w * 0.62, 0, 0, h * 0.12, cap)

    def pyramid(self, b, x, y, z, base, h):
        b.frustum(x, y, z, base, base, base * 0.2, base * 0.2, h * 0.8, "wall")
        b.frustum(x, y, z + h * 0.8, base * 0.2, base * 0.2, 0, 0, h * 0.2, "extra")

    def hall(self, b, x, y, z, w, d, h):
        b.frustum(x, y, z, w, d, w * 0.95, d * 0.95, h, "wall")
        b.box(x, y, z + h, w * 0.98, d * 0.98, 0.018, "trim")
        b.box(x, y, z + h + 0.018, w * 0.9, d * 0.9, 0.012, "stone")

    def capital(self, b):
        self.ring(b, 0.46, self.ring_h, with_gate=False)
        for sx in (-1, 1):
            for sy in (-1, 1):
                self.tower(b, sx * 0.46, sy * 0.46, 0.2)
        b.box(0, -0.46, 0, 0.12, 0.1, 0.07, "dark")
        x = -0.1
        self.pylon(b, x, -0.1, 0, 0.5, 0.1, 0.36)
        self.hall(b, x, 0.16, 0, 0.4, 0.4, 0.17)
        self.hall(b, x, 0.26, 0.17, 0.24, 0.16, 0.08)
        for k in range(4):                                  # hypostyle columns seen above the court
            b.cyl(x - 0.12 + k * 0.08, 0.04, 0.188, 0.022, 0.05, "stone", seg=5)
        for sx in (-1, 1):
            self.obelisk(b, x + sx * 0.14, -0.3, 0, 0.055, 0.46)
        self.pyramid(b, 0.26, 0.2, 0, 0.34, 0.3)
        self.house(b, 0.3, -0.12, 0.15, 0.14, 0.1, 0, 0)
        self.house(b, 0.3, -0.31, 0.15, 0.13, 0.08, 0, 1)

    def city(self, b):
        self.ring(b, 0.46, self.ring_h)
        spots = [(-0.33, 0.33), (0.33, 0.33), (-0.33, -0.3), (0.33, -0.3), (-0.34, 0.02), (0.1, 0.36)]
        for i, (x, y) in enumerate(spots):
            self.house(b, x, y, 0.18, 0.17, 0.1 + 0.03 * (i % 3), 0, i)
        for x, y, r in ((0.3, 0.07, 0.065), (0.39, -0.05, 0.055), (0.27, -0.07, 0.05)):
            self.granary(b, x, y, r)
        self.pylon(b, -0.03, -0.12, 0, 0.36, 0.08, 0.3)
        self.hall(b, -0.03, 0.08, 0, 0.28, 0.3, 0.14)
        self.obelisk(b, -0.03, -0.3, 0, 0.04, 0.3)

    def landmark(self, b, kind):
        if kind == "town":
            z = self.plinth(b, 0, 0, 0, 0.28, 0.28, 2, 0.03, mat="stone", mat2="wall")
            self.obelisk(b, 0, 0, z, 0.075, 0.6, cap="team")
        elif kind == "fort":
            b.frustum(0, 0.08, 0, 0.32, 0.3, 0.27, 0.25, 0.26, "wall")
            b.box(0, 0.08, 0.26, 0.29, 0.27, 0.022, "trim")
            b.box(0, 0.08, 0.282, 0.14, 0.12, 0.05, "wall")
            self.flag(b, 0, 0.08, 0.33, 0.24, w=0.12, fh=0.08)

    def temple(self, b):
        # true pyramid with a gold capstone, a causeway and a small pylon chapel
        b.box(0, 0, 0, 0.92, 0.92, 0.02, "stone")
        self.pyramid(b, 0, 0.1, 0.02, 0.7, 0.56)
        b.box(0, -0.36, 0.02, 0.07, 0.22, 0.012, "wall")
        self.pylon(b, 0, -0.29, 0.02, 0.28, 0.07, 0.17)
        self.pyramid(b, 0.34, -0.34, 0.02, 0.17, 0.13)
        self.obelisk(b, -0.3, -0.36, 0.02, 0.04, 0.26, cap="team")


# ------------------------------------------------------------------ highland
class Highland(Base):
    name = "highland"
    ring_h = 0.09

    def terrace(self, b, x, y, z, w, d, h):
        """Stone retaining wall with a green top. Returns the top z."""
        b.frustum(x, y, z, w, d, w - 0.03, d - 0.03, h, "stone")
        b.box(x, y, z + h, w - 0.045, d - 0.045, 0.008, "extra")
        return z + h + 0.008

    def stair(self, b, x, y, z, n, w=0.09, run=0.035, rise=0.027):
        for k in range(n):
            b.box(x, y + k * run, z, w, run, rise * (k + 1), "wall")

    def block(self, b, x, y, z, w, d, h, roof="roof", k=0.86, rh=0.06, slits=2):
        """Battered whitewashed block with an ochre band and a low wide-eaved roof. Returns the top z."""
        b.frustum(x, y, z, w, d, w * k, d * k, h, "wall")
        f = 1 - (1 - k) * 0.76
        b.box(x, y, z + h * 0.76, w * f + 0.004, d * f + 0.004, h * 0.24, "trim")
        g = 1 - (1 - k) * 0.4
        for i in range(slits):
            sx = (i - (slits - 1) / 2) * w * 0.4
            b.box(x + sx, y - d * g / 2 - 0.004, z + h * 0.36, w * 0.1, 0.012, h * 0.2, "roof")
        if roof:
            b.box(x, y, z + h, w * k + 0.05, d * k + 0.05, 0.012, "dark")
            b.frustum(x, y, z + h + 0.012, w * k + 0.07, d * k + 0.07, w * k * 0.4, d * k * 0.4, rh, roof)
            return z + h + 0.012 + rh
        return z + h

    def hut(self, b, x, y, z, w, d, h, rz, i):
        """Stone house with a shallow, wide-eaved slate roof."""
        b.frustum(x, y, z, w, d, w * 0.9, d * 0.9, h, "wall" if i % 2 else "stone", rz=rz)
        b.gable(x, y, z + h, w * 0.9, d * 0.9, d * 0.34, "team" if i % 2 == 0 else "roof", rz=rz, over=0.035)

    def house(self, b, x, y, w, d, h, rz, i):
        self.hut(b, x, y, 0, w, d, h, rz, i)

    def tower(self, b, x, y, h, z=0.0, w=0.13, roof="team"):
        b.frustum(x, y, z, w, w, w * 0.72, w * 0.72, h, "stone")
        b.box(x, y, z + h * 0.8, w * 0.8, w * 0.8, h * 0.1, "trim")
        b.box(x, y, z + h, w * 0.95, w * 0.95, 0.02, "wall")
        b.frustum(x, y, z + h + 0.02, w * 1.15, w * 1.15, 0, 0, w * 0.75, roof)

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.frustum(0, 0, 0, L, t * 1.2, L, t * 0.8, h, "stone")
            b.box(0, 0, h, L, t + 0.02, 0.02, "roof")

    def flags(self, b, p0, p1, n=7, sag=0.05):
        """A string of prayer flags from p0 to p1 (x, y, z)."""
        rz = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        for k in range(n):
            t = (k + 0.5) / n
            x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
            z = p0[2] + (p1[2] - p0[2]) * t - sag * 4 * t * (1 - t)
            b.box(x, y, z - 0.04, 0.036, 0.008, 0.04, "team", rot=(0, 0, rz))

    def rock(self, b, x, y, z, w, d, h, ox=0.0, oy=0.0, top=0.5, rz=0.0):
        b.frustum(x, y, z, w, d, w * top, d * top, h, "dark", rz=rz, ox=ox, oy=oy)

    def capital(self, b):
        # dzong: battered white block, central tower, on three terraces
        z = self.terrace(b, 0, 0, 0, 0.98, 0.98, 0.06)
        z = self.terrace(b, 0, 0.06, z, 0.78, 0.76, 0.06)
        z = self.terrace(b, 0, 0.1, z, 0.6, 0.56, 0.06)
        self.stair(b, 0, -0.47, 0, 2)
        self.stair(b, 0, -0.31, 0.068, 2)
        self.stair(b, 0, -0.17, 0.136, 2)
        top = self.block(b, 0, 0.14, z, 0.5, 0.4, 0.24, rh=0.05, slits=3)
        ut = self.block(b, 0, 0.16, z, 0.2, 0.2, 0.5, roof="team", k=0.82, rh=0.07, slits=0)
        b.box(0, 0.16, ut, 0.05, 0.05, 0.03, "trim")
        b.cyl(0, 0.16, ut + 0.03, 0.008, 0.07, "dark", seg=4)
        for sx in (-1, 1):
            self.tower(b, sx * 0.23, -0.05, 0.26, z=z, w=0.1, roof="roof")
            self.flags(b, (0, 0.16, ut + 0.09), (sx * 0.44, -0.44, 0.2), n=7, sag=0.06)
            b.cyl(sx * 0.44, -0.44, 0.06, 0.008, 0.14, "dark", seg=4)
            self.hut(b, sx * 0.33, -0.39, 0.068, 0.16, 0.12, 0.08, 0, 0 if sx < 0 else 1)
            self.hut(b, sx * 0.41, 0.05, 0.068, 0.12, 0.15, 0.08, PI / 2, 1 if sx < 0 else 0)

    def city(self, b):
        # houses stepped up four terraces, a watchtower on top
        z0 = self.terrace(b, 0, 0, 0, 0.98, 0.98, 0.06)
        z1 = self.terrace(b, 0, 0.1, z0, 0.8, 0.72, 0.08)
        z2 = self.terrace(b, 0, 0.16, z1, 0.58, 0.5, 0.08)
        z3 = self.terrace(b, 0, 0.2, z2, 0.32, 0.28, 0.08)
        for i, x in enumerate((-0.37, -0.13, 0.13, 0.37)):
            self.hut(b, x, -0.38, z0, 0.17, 0.13, 0.09, 0, i)
        for i, x in enumerate((-0.27, 0.0, 0.27)):
            self.hut(b, x, -0.165, z1, 0.17, 0.12, 0.09, 0, i + 1)
        for i, x in enumerate((-0.17, 0.17)):
            self.hut(b, x, 0.0, z2, 0.16, 0.12, 0.09, 0, i)
        for sx in (-1, 1):
            self.hut(b, sx * 0.345, 0.2, z1, 0.1, 0.16, 0.08, PI / 2, 1 if sx < 0 else 2)
        self.block(b, -0.05, 0.22, z3, 0.17, 0.2, 0.14, rh=0.04, slits=1)
        self.tower(b, 0.09, 0.2, 0.36, z=z3, w=0.11)
        self.flags(b, (0.09, 0.2, z3 + 0.44), (0.42, -0.2, z1 + 0.12), n=7, sag=0.05)
        b.cyl(0.42, -0.2, z0, 0.008, 0.2, "dark", seg=4)

    def town(self, b):
        z0 = self.terrace(b, 0, 0, 0, 0.92, 0.92, 0.05)
        z1 = self.terrace(b, 0, 0.2, z0, 0.74, 0.46, 0.08)
        self.stair(b, 0, -0.1, z0, 3, run=0.03)
        self.hut(b, -0.29, -0.27, z0, 0.24, 0.18, 0.11, 0.1, 0)
        self.hut(b, 0.29, -0.27, z0, 0.24, 0.18, 0.12, -0.1, 1)
        self.hut(b, -0.23, 0.22, z1, 0.2, 0.18, 0.11, 0, 1)
        self.hut(b, 0.23, 0.22, z1, 0.2, 0.18, 0.11, 0, 2)
        self.tower(b, 0, 0.22, 0.36, z=z1, w=0.13)
        for sx in (-1, 1):
            self.flags(b, (0, 0.22, z1 + 0.42), (sx * 0.42, -0.05, z0 + 0.14), n=7, sag=0.05)
            b.cyl(sx * 0.42, -0.05, z0, 0.008, 0.14, "dark", seg=4)

    def temple(self, b):
        # cliff monastery: white blocks on ledges of an angled rock
        self.rock(b, 0.02, 0.16, 0, 0.92, 0.6, 0.76, oy=0.1, top=0.5)
        self.rock(b, -0.24, -0.1, 0, 0.42, 0.4, 0.3, oy=0.06, top=0.66, rz=0.12)
        self.rock(b, 0.24, -0.06, 0, 0.4, 0.4, 0.46, oy=0.08, top=0.62, rz=-0.1)
        b.box(0, 0.02, 0.5, 0.3, 0.2, 0.1, "dark", rot=(0, 0, 0.1))
        self.block(b, -0.24, -0.06, 0.3, 0.25, 0.2, 0.2, rh=0.05)
        self.block(b, 0.24, 0.0, 0.46, 0.22, 0.2, 0.2, roof="team", rh=0.05)
        t = self.block(b, 0.02, 0.24, 0.76, 0.2, 0.17, 0.12, roof="team", rh=0.05, slits=1)
        b.cyl(0.02, 0.24, t, 0.008, 0.05, "dark", seg=4)
        self.stair(b, 0.02, -0.14, 0.3, 3, w=0.07, run=0.035, rise=0.05)
        self.flags(b, (-0.24, -0.06, 0.56), (0.24, 0.0, 0.72), n=7, sag=0.05)
        tree(b, -0.4, 0.2, 0.2, 0.9)
        tree(b, 0.42, -0.24, 0.0, 0.9)

    def fort(self, b):
        # pass fort: a gate tower and wall across the notch between two crags
        self.rock(b, -0.36, 0.06, 0, 0.3, 0.6, 0.58, ox=-0.02, oy=0.06, top=0.42)
        self.rock(b, -0.34, -0.26, 0, 0.3, 0.3, 0.3, ox=-0.03, oy=0.05, top=0.5, rz=0.2)
        self.rock(b, 0.36, -0.06, 0, 0.3, 0.6, 0.44, ox=0.02, oy=-0.04, top=0.55)
        self.rock(b, 0.34, 0.28, 0, 0.3, 0.3, 0.26, ox=0.03, oy=-0.05, top=0.5, rz=-0.2)
        b.frustum(0, 0, 0, 0.5, 0.13, 0.5, 0.09, 0.22, "stone")
        b.box(0, 0, 0.22, 0.5, 0.11, 0.02, "roof")
        for k in range(4):
            b.box(-0.2 + k * 0.133, 0, 0.24, 0.06, 0.11, 0.03, "stone")
        t = self.block(b, 0, 0.0, 0, 0.24, 0.2, 0.5, k=0.8, rh=0.07, slits=0)
        b.box(0, -0.105, 0, 0.09, 0.02, 0.13, "roof")
        b.box(0, -0.095, 0.2, 0.07, 0.01, 0.13, "team")
        b.cyl(0, 0, t - 0.01, 0.008, 0.1, "dark", seg=4)
        b.box(0.04, 0, t + 0.04, 0.08, 0.008, 0.05, "team")
        self.tower(b, 0.37, -0.1, 0.2, z=0.44, w=0.11)
        self.flags(b, (0, 0, t), (-0.38, 0.08, 0.6), n=7, sag=0.04)
        b.cyl(-0.38, 0.08, 0.5, 0.008, 0.12, "dark", seg=4)


IDENTITY_STYLES = {c.name: c() for c in (SovietBloc, WesternModern, Egyptian, Highland)}
