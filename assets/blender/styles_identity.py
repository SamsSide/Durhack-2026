"""The four nation-identity styles (row A24): soviet_bloc, western_modern, egyptian, highland.

Built to docs/research/building-references.md (reference boards, silhouette rules, per-kind specs)
and lane b's prototype layouts (web/src/proto/sets.ts). Same contract as styles_defs.py (one class
per style, material slots wall, stone, roof, trim, dark, extra, team). What each set must show at
globe scale (a model about 40 px wide, so 0.025 units = 1 px):

  soviet_bloc     long flat identical grey slabs, one stepped tower with a spire and star, team banners
  western_modern  blue glass towers of different heights, one white dome, pitched roofs on lawns
  egyptian        battered walls, a pylon with paired obelisks, a gold-capped pyramid
  highland        a rock under every model, white battered walls with a red band, terraces
"""
import math

from styles_defs import Base

PI = math.pi


def tree(b, x, y, z, s=1.0, mat="extra"):
    b.cyl(x, y, z, 0.012 * s, 0.04 * s, "dark", seg=4)
    b.cone(x, y, z + 0.035 * s, 0.05 * s, 0.13 * s, mat, seg=5)


# ------------------------------------------------------------------ soviet bloc
class SovietBloc(Base):
    name = "soviet_bloc"
    FH = 0.044          # storey height of a panel slab (5 floors = 0.22)

    def slab(self, b, x, y, L, rz=0.0, floors=5, D=0.11, banner=None, stripe=True, sections=4):
        """Panel block with a team stripe down both end walls and (banner=x offset) a roof slogan."""
        top = b.panel_slab(x, y, L, D, floors, fh=self.FH, rz=rz, sections=sections)
        with b.at(x, y, rz):
            if stripe:
                for s in (-1, 1):
                    b.box(s * (L / 2 + 0.004), 0, 0.02, 0.01, D * 0.5, top - 0.05, "team")
            if banner is not None:
                b.box(banner, 0, top, L * 0.32, 0.016, 0.055, "team")
        return top

    def cake(self, b, x, y, z, tiers, mat="trim", pinn=2):
        """Setback (wedding-cake) tower: shrinking boxes with window strips, cornices, corner pinnacles."""
        for i, (w, d, h) in enumerate(tiers):
            b.box(x, y, z, w, d, h, mat)
            if w >= 0.1:
                n = 4 if w > 0.26 else 3 if w > 0.15 else 2
                b.strips(x, y, z + h * 0.12, w * 0.88, d, h * 0.72, n, "dark", sw=w * 0.88 / n * 0.42, proud=0.004)
                m = max(2, n - 1)
                b.strips(x, y, z + h * 0.12, d * 0.88, w, h * 0.72, m, "dark", sw=d * 0.88 / m * 0.42, proud=0.004, axis="y")
            b.box(x, y, z + h, w + 0.022, d + 0.022, 0.012, "stone")
            if i < pinn:
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        b.cone(x + sx * (w / 2 - 0.012), y + sy * (d / 2 - 0.012), z + h + 0.012, 0.016, 0.05, "extra", seg=4)
            z += h + 0.012
        return z

    def spire(self, b, x, y, z, h, w=0.05, sr=0.055):
        """Gold spire with the star on its tip (two crossed plates, so it shows from every side)."""
        b.frustum(x, y, z, w, w, 0.008, 0.008, h, "extra")
        b.star(x, y, z + h + sr * 0.7, sr)
        b.star(x, y, z + h + sr * 0.7, sr, rz=PI / 2)
        return z + h + sr * 1.7

    def statue(self, b, x, y, z):
        b.box(x, y, z, 0.07, 0.07, 0.08, "stone")
        b.box(x, y, z + 0.08, 0.03, 0.025, 0.09, "dark")
        b.box(x + 0.025, y - 0.01, z + 0.14, 0.05, 0.015, 0.015, "dark", rot=(0, -0.5, 0))

    def capital(self, b):
        b.box(0, 0, 0, 0.98, 0.98, 0.02, "stone")           # the square
        b.box(0, -0.3, 0.02, 0.56, 0.3, 0.004, "wall")      # parade ground
        for sx in (-1, 1):                                  # two identical housing slabs, end walls to the square
            self.slab(b, sx * 0.425, 0.1, 0.62, rz=PI / 2)
        x, y = 0, 0.2
        for sx in (-1, 1):                                  # the wings of the high-rise
            b.box(x + sx * 0.235, y, 0.02, 0.19, 0.26, 0.22, "trim")
            b.strips(x + sx * 0.235, y, 0.05, 0.16, 0.26, 0.15, 3, "dark", sw=0.026, proud=0.004)
            b.box(x + sx * 0.235, y, 0.24, 0.21, 0.28, 0.012, "stone")
            b.box(x + sx * 0.25, y, 0.252, 0.1, 0.12, 0.09, "trim")
            b.cone(x + sx * 0.25, y, 0.342, 0.04, 0.1, "extra", seg=4, rot=(0, 0, PI / 4))
        z = self.cake(b, x, y, 0.02, [(0.3, 0.26, 0.27), (0.22, 0.2, 0.13), (0.16, 0.15, 0.11), (0.11, 0.11, 0.09)])
        self.spire(b, x, y, z, 0.19)
        b.box(0, -0.02, 0.02, 0.3, 0.09, 0.045, "trim")     # the tribune with its slogan
        b.box(0, -0.068, 0.028, 0.26, 0.008, 0.03, "team")
        self.statue(b, 0, -0.24, 0.02)
        for fx in (-0.24, -0.08, 0.08, 0.24):               # parade banners
            b.box(fx - 0.05, -0.42, 0.02, 0.014, 0.014, 0.24, "dark")
            b.box(fx, -0.42, 0.1, 0.085, 0.012, 0.16, "team")

    def city(self, b):
        # microdistrict: three identical slabs in parallel rows, each with a roof slogan
        for i, y in enumerate((0.36, 0.1, -0.16)):
            self.slab(b, -0.18, y, 0.56, banner=(i - 1) * 0.14)
        b.box(-0.18, -0.4, 0, 0.26, 0.11, 0.07, "trim")     # the school
        b.box(-0.18, -0.4, 0.07, 0.27, 0.12, 0.012, "roof")
        # point tower: 14 floors, bands every second floor, lift box
        x, y = 0.31, 0.3
        b.box(x, y, 0, 0.16, 0.16, 0.6, "wall")
        b.bands(x, y, 0.02, 0.16, 0.16, 7, 0.08, "dark", bh=0.42)
        b.box(x, y, 0.6, 0.172, 0.172, 0.014, "roof")
        b.box(x - 0.02, y, 0.614, 0.07, 0.06, 0.035, "stone")
        b.box(x, y - 0.084, 0.06, 0.05, 0.01, 0.48, "team")  # the long banner
        # brutalist ministry: crossed blocks on a core
        x, y = 0.3, 0.0
        b.box(x, y, 0, 0.07, 0.07, 0.3, "stone")
        for k in range(3):
            if k % 2 == 0:
                b.box(x, y, 0.07 + k * 0.075, 0.24, 0.1, 0.075, "stone")
            else:
                b.box(x, y, 0.07 + k * 0.075, 0.1, 0.22, 0.075, "stone")
            b.box(x, y, 0.09 + k * 0.075, 0.246 if k % 2 == 0 else 0.106, 0.106 if k % 2 == 0 else 0.226, 0.03, "dark")
        # works: sawtooth shed and a banded chimney
        b.box(0.24, -0.33, 0, 0.3, 0.24, 0.09, "stone")
        for k in range(3):
            b.shed(0.14 + k * 0.1, -0.33, 0.09, 0.24, 0.1, 0.06, "roof", rz=-PI / 2, h0=0.0)
        b.chimney(0.43, -0.43, 0.74, 0.05, 0.032, "trim", "team", bands=2, bh=0.06)

    def town(self, b):
        self.slab(b, 0.05, 0.32, 0.62, banner=0.0)
        self.slab(b, -0.34, -0.1, 0.46, rz=PI / 2, floors=5, sections=3)
        # house of culture: sandstone box, attic, a row of columns, a slogan
        x, y = 0.14, -0.1
        b.box(x, y - 0.03, 0, 0.42, 0.34, 0.02, "stone")
        b.box(x, y + 0.02, 0.02, 0.34, 0.2, 0.15, "trim")
        b.colonnade(x - 0.14, x + 0.14, y - 0.11, 0.02, 6, 0.15, r=0.02, mat="wall")
        b.box(x, y - 0.01, 0.17, 0.38, 0.28, 0.03, "stone")
        b.box(x, y + 0.02, 0.2, 0.24, 0.18, 0.035, "trim")
        b.box(x, y - 0.153, 0.166, 0.3, 0.008, 0.04, "team")
        b.box(x - 0.012, y + 0.02, 0.235, 0.014, 0.014, 0.2, "dark")
        b.box(x + 0.05, y + 0.02, 0.345, 0.11, 0.012, 0.09, "team")
        self.statue(b, x, -0.38, 0)

    def temple(self, b):
        # memorial: a wedge-shaped concrete hall with ribs and a tall obelisk with a star
        z = self.plinth(b, 0, 0, 0, 0.92, 0.92, 2, 0.03, mat="stone", mat2="roof")
        # the hall rises from 0.1 at its right edge to 0.4 at its left
        b.shed(-0.15, 0.1, z, 0.46, 0.5, 0.4, "wall", rz=PI / 2, h0=0.1)
        for k in range(5):
            t = k / 4
            hh = 0.4 - 0.3 * t
            b.box(-0.385 + t * 0.47, 0.1, z, 0.03, 0.5, hh + 0.025, "stone")
            if k < 4:
                hm = 0.4 - 0.3 * (t + 0.125)
                b.box(-0.385 + (t + 0.125) * 0.47, -0.132, z + 0.03, 0.085, 0.008, hm - 0.07, "dark")
                b.box(-0.385 + (t + 0.125) * 0.47, -0.137, z + hm - 0.11, 0.085, 0.01, 0.05, "team")
        ox, oy = 0.26, -0.1
        b.box(ox, oy, z, 0.2, 0.2, 0.05, "stone")
        top = b.obelisk(ox, oy, z + 0.05, 0.1, 0.62, mat="trim", cap="extra", plinth=None, caph=0.6)
        b.star(ox, oy, top + 0.05, 0.075)
        b.star(ox, oy, top + 0.05, 0.075, rz=PI / 2)
        b.cyl(0.26, -0.34, z, 0.055, 0.025, "dark", seg=6)   # the eternal flame
        b.cone(0.26, -0.34, z + 0.025, 0.032, 0.08, "extra", seg=4)

    def fort(self, b):
        # military base: blast walls, a bunker, a radar on a lattice mast, a missile on its launcher
        h, half, t = 0.08, 0.41, 0.05
        b.box(0, half, 0, 2 * half + t, t, h, "wall")
        for sx in (-1, 1):
            b.box(sx * half, 0, 0, t, 2 * half + t, h, "wall")
            b.box(sx * 0.28, -half, 0, 0.3, t, h, "wall")
        b.battered(-0.12, 0.14, 0, 0.44, 0.36, 0.16, "stone", k=0.8)
        b.box(-0.12, -0.03, 0.07, 0.26, 0.03, 0.035, "dark")
        b.box(-0.12, 0.14, 0.16, 0.2, 0.16, 0.045, "wall")
        b.box(-0.12, 0.14, 0.205, 0.23, 0.19, 0.016, "team")
        b.lattice_mast(0.25, 0.22, 0.34, 0.06)
        b.dish(0.25, 0.2, 0.33, 0.14, tilt=0.95, mat="wall", rz=0.35)
        b.box(0.2, -0.14, 0, 0.14, 0.24, 0.045, "roof")     # the launcher truck
        b.box(0.2, -0.24, 0.045, 0.12, 0.06, 0.04, "stone")
        b.box(0.17, -0.12, 0.045, 0.03, 0.05, 0.1, "stone")
        b.cyl(0.14, -0.12, 0.06, 0.032, 0.32, "wall", seg=6, rot=(0, 0.85, 0))
        b.cone(0.14 + 0.2 * math.sin(0.85), -0.12, 0.22 + 0.2 * math.cos(0.85) - 0.04, 0.032, 0.09, "team", seg=6, rot=(0, 0.85, 0))
        for k in range(4):                                  # the watch tower
            b.box(-0.3 + (k % 2) * 0.07 - 0.035, -0.26 + (k // 2) * 0.07 - 0.035, 0, 0.014, 0.014, 0.26, "dark")
        b.box(-0.3, -0.26, 0.26, 0.1, 0.1, 0.07, "stone")
        b.box(-0.3, -0.26, 0.33, 0.12, 0.12, 0.012, "roof")
        self.flag(b, -0.06, -0.22, 0, 0.44, w=0.15, fh=0.1)


# ------------------------------------------------------------------ western modern
class WesternModern(Base):
    name = "western_modern"

    def glass(self, b, x, y, w, d, h, mat="trim", rib="dark", ribs=3, podium=True, team=True):
        """International Style slab: glass box, vertical mullion ribs on all four faces, a team
        crown strip under a dark roof plant, a white podium. Returns the top z."""
        if podium:
            b.box(x, y, 0, w + 0.07, d + 0.07, 0.03, "wall")
        b.box(x, y, 0, w, d, h, mat)
        b.strips(x, y, 0.03, w, d, h - 0.03, ribs, rib, sw=0.012, proud=0.004)
        b.strips(x, y, 0.03, d, w, h - 0.03, max(2, ribs - 1), rib, sw=0.012, proud=0.004, axis="y")
        if team:
            b.box(x, y, h - 0.05, w + 0.012, d + 0.012, 0.04, "team")
        b.box(x, y, h, w * 0.78, d * 0.78, 0.03, "dark")
        return h + 0.03

    def midrise(self, b, x, y, w, d, h, awning=True):
        b.box(x, y, 0, w, d, h, "stone")
        b.bands(x, y, 0.02, w, d, max(2, int(h / 0.06)), 0.06, "dark", proud=0.004)
        b.box(x, y, h, w + 0.014, d + 0.014, 0.014, "wall")
        if awning:
            b.box(x, y - d / 2 - 0.02, 0.035, w * 0.8, 0.05, 0.012, "team", rot=(0.4, 0, 0))

    def house(self, b, x, y, w, d, h, rz, i):
        """Suburban house: white walls, a pitched roof (every other one team), a brick chimney."""
        with b.at(x, y, rz):
            b.box(0, 0, 0, w, d, h, "wall")
            b.gable(0, 0, h, w, d, d * 0.5, "team" if i % 2 == 0 else "roof", over=0.014)
            b.box(w * 0.28, d * 0.12, h, 0.03, 0.03, d * 0.5 + 0.02, "stone")
            b.box(-w * 0.15, -d / 2 - 0.003, 0, 0.03, 0.008, h * 0.6, "dark")
            if i % 2:
                b.box(-w / 2 - 0.035, 0.01, 0, 0.07, d * 0.8, h * 0.75, "wall")
                b.box(-w / 2 - 0.035, 0.01, h * 0.75, 0.08, d * 0.86, 0.01, "roof")

    def capitol(self, b, x, y, z):
        b.box(x, y, z, 0.84, 0.3, 0.025, "wall")            # terrace and steps
        b.box(x, y - 0.17, z, 0.24, 0.08, 0.012, "wall")
        z += 0.025
        b.box(x, y + 0.01, z, 0.36, 0.22, 0.13, "wall")     # centre block
        b.box(x, y + 0.01, z + 0.13, 0.38, 0.24, 0.014, "wall")
        for sx in (-1, 1):                                  # the wings, with windows and grey roofs
            b.box(x + sx * 0.3, y + 0.01, z, 0.24, 0.17, 0.105, "wall")
            b.box(x + sx * 0.3, y - 0.077, z + 0.03, 0.2, 0.006, 0.05, "dark")
            b.box(x + sx * 0.3, y + 0.01, z + 0.105, 0.25, 0.18, 0.014, "roof")
        b.colonnade(x - 0.09, x + 0.09, y - 0.125, z, 6, 0.115, r=0.016)   # the portico
        b.box(x, y - 0.11, z + 0.115, 0.24, 0.07, 0.016, "wall")
        b.gable(x, y - 0.11, z + 0.131, 0.07, 0.24, 0.05, "wall", rz=PI / 2, over=0.0)
        zt = b.drum_dome(x, y + 0.02, z + 0.144, 0.105)
        self.flag(b, x, y + 0.02, zt - 0.01, 0.13, w=0.1, fh=0.065)

    def capital(self, b):
        b.box(0, 0, 0, 0.98, 0.98, 0.02, "extra")           # lawn
        b.box(0, -0.4, 0.02, 0.1, 0.18, 0.004, "wall")      # the mall path
        self.capitol(b, 0, -0.14, 0.02)
        self.glass(b, -0.3, 0.32, 0.18, 0.14, 0.86)         # three towers, no two the same height
        self.glass(b, 0.02, 0.34, 0.17, 0.13, 0.62, mat="dark", rib="trim")
        self.glass(b, 0.32, 0.3, 0.16, 0.16, 0.48)
        for sx in (-1, 1):
            tree(b, sx * 0.14, -0.4, 0.02, 0.9)
            tree(b, sx * 0.3, -0.42, 0.02, 0.8)
            self.flag(b, sx * 0.43, -0.4, 0.02, 0.2, w=0.09, fh=0.06)

    def city(self, b):
        b.box(0, 0.02, 0, 0.96, 0.045, 0.005, "dark")       # the street grid
        b.box(-0.03, 0, 0, 0.045, 0.96, 0.005, "dark")
        self.glass(b, -0.2, 0.22, 0.17, 0.13, 0.8)
        self.glass(b, 0.13, 0.27, 0.16, 0.16, 0.6, mat="dark", rib="trim")
        self.glass(b, 0.1, -0.13, 0.15, 0.12, 0.44)
        self.glass(b, -0.38, 0.38, 0.14, 0.14, 0.34, podium=False)
        # the Art Deco tower: white setbacks and a spire
        x, y, z = 0.34, -0.2, 0.0
        for i, (w, h) in enumerate(((0.18, 0.34), (0.144, 0.12), (0.112, 0.09), (0.08, 0.07))):
            b.box(x, y, z, w, w, h, "wall")
            b.strips(x, y, z + h * 0.1, w * 0.8, w, h * 0.8, 3 if i == 0 else 2, "dark", sw=0.014, proud=0.004)
            b.strips(x, y, z + h * 0.1, w * 0.8, w, h * 0.8, 3 if i == 0 else 2, "dark", sw=0.014, proud=0.004, axis="y")
            z += h
        b.frustum(x, y, z, 0.05, 0.05, 0.006, 0.006, 0.17, "roof")
        self.midrise(b, -0.36, -0.36, 0.2, 0.18, 0.2)
        self.midrise(b, 0.38, 0.38, 0.16, 0.16, 0.24, awning=False)
        self.midrise(b, 0.1, -0.38, 0.2, 0.14, 0.14)
        b.box(-0.3, -0.12, 0, 0.36, 0.18, 0.012, "extra")   # a park
        tree(b, -0.4, -0.12, 0.012, 0.9)
        tree(b, -0.28, -0.1, 0.012, 1.0)
        tree(b, -0.18, -0.14, 0.012, 0.8)

    def town(self, b):
        b.box(0, 0, 0, 0.92, 0.92, 0.012, "extra")          # lawns
        for i in range(5):                                  # houses along a curved street
            a = PI * (1.1 + 0.2 * i)
            x, y = 0.36 * math.cos(a), 0.06 + 0.4 * math.sin(a)
            self.house(b, x, y, 0.17, 0.13, 0.075, a + PI / 2, i)
        for i in range(6):                                  # the street
            a = PI * (1.06 + 0.176 * i)
            b.box(0.22 * math.cos(a), 0.1 + 0.25 * math.sin(a), 0.012, 0.15, 0.05, 0.004, "dark", rot=(0, 0, a + PI / 2))
        # church with a steeple
        x, y = 0.02, 0.3
        b.box(x + 0.05, y, 0.012, 0.36, 0.17, 0.13, "wall")
        b.box(x + 0.05, y - 0.088, 0.05, 0.28, 0.006, 0.055, "dark")
        b.gable(x + 0.05, y, 0.142, 0.36, 0.17, 0.09, "roof", over=0.012)
        b.box(x - 0.16, y - 0.02, 0.012, 0.11, 0.11, 0.36, "wall")
        b.box(x - 0.16, y - 0.078, 0.26, 0.055, 0.006, 0.07, "dark")
        b.box(x - 0.16, y - 0.02, 0.372, 0.13, 0.13, 0.014, "wall")
        b.frustum(x - 0.16, y - 0.02, 0.386, 0.12, 0.12, 0, 0, 0.24, "team")
        tree(b, 0.4, 0.34, 0.012, 1.0)
        tree(b, -0.4, 0.36, 0.012, 0.9)
        tree(b, 0.02, 0.0, 0.012, 1.0)
        tree(b, 0.14, 0.06, 0.012, 0.8)

    def temple(self, b):
        # modern church: steep grey nave with glass walls and a slender glass bell tower with a spire
        z = self.plinth(b, 0, 0, 0, 0.8, 0.9, 2, 0.025, mat="wall", mat2="wall")
        b.box(0, 0, 0, 0.9, 0.96, 0.01, "extra")
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
        tx, ty = 0.22, -0.22
        b.box(tx, ty, z, 0.14, 0.14, 0.44, "wall")
        b.strips(tx, ty, z + 0.2, 0.1, 0.14, 0.2, 2, "trim", sw=0.03, proud=0.004)
        b.strips(tx, ty, z + 0.2, 0.1, 0.14, 0.2, 2, "trim", sw=0.03, proud=0.004, axis="y")
        b.box(tx, ty, z + 0.44, 0.16, 0.16, 0.03, "team")
        b.frustum(tx, ty, z + 0.47, 0.14, 0.14, 0, 0, 0.34, "roof")
        b.box(tx, ty, z + 0.79, 0.014, 0.014, 0.12, "team")                        # the cross
        b.box(tx, ty, z + 0.86, 0.07, 0.014, 0.014, "team")

    def fort(self, b):
        # the Pentagon beside an airstrip: five-sided ring, runway, a jet, control tower, radome
        b.box(0, 0, 0, 0.94, 0.94, 0.012, "extra")
        px, py = -0.12, 0.13
        b.poly_ring(px, py, 0.012, 0.33, 0.17, 0.085, "wall")
        b.poly_ring(px, py, 0.097, 0.315, 0.275, 0.008, "roof")
        b.poly_ring(px, py, 0.097, 0.235, 0.195, 0.008, "roof")
        self.flag(b, px, py, 0.012, 0.3, w=0.13, fh=0.085)
        b.box(0, -0.36, 0.012, 0.92, 0.17, 0.004, "dark")   # the runway
        for k in range(4):
            b.box(-0.33 + k * 0.22, -0.36, 0.016, 0.1, 0.018, 0.003, "wall")
        tx, ty = 0.36, 0.26                                  # control tower
        b.box(tx, ty, 0.012, 0.08, 0.08, 0.34, "wall")
        b.frustum(tx, ty, 0.352, 0.09, 0.09, 0.15, 0.15, 0.07, "trim")
        b.box(tx, ty, 0.422, 0.17, 0.17, 0.018, "team")
        b.cyl(tx, ty, 0.44, 0.008, 0.1, "dark", seg=4)
        b.box(0.36, -0.03, 0.012, 0.11, 0.11, 0.05, "wall")  # radome
        b.lathe(0.36, -0.03, 0.062, [(0.07, 0), (0.066, 0.04), (0.05, 0.075), (0.024, 0.095), (0, 0.1)], "wall", seg=8)
        jx, jy, jz = -0.1, -0.36, 0.03                       # the jet
        b.box(jx, jy, jz, 0.22, 0.036, 0.03, "wall")
        b.cone(jx + 0.14, jy, jz - 0.015, 0.018, 0.06, "wall", seg=4, rot=(0, PI / 2, 0))
        b.frustum(jx - 0.01, jy, jz + 0.01, 0.1, 0.22, 0.03, 0.22, 0.008, "wall", ox=-0.03)
        b.box(jx - 0.095, jy, jz + 0.03, 0.05, 0.01, 0.06, "team")


# ------------------------------------------------------------------ egyptian
class Egyptian(Base):
    name = "egyptian"
    ring_h = 0.08
    wall_t = 0.06

    def house(self, b, x, y, w, d, h, rz, i):
        """Flat-roofed mudbrick house: pale parapet, a roof shelter or a team awning over the door."""
        with b.at(x, y, rz):
            b.battered(0, 0, 0, w, d, h, "roof", k=0.93)
            b.box(0, 0, h, w * 0.97, d * 0.97, 0.016, "wall")
            b.box(-w * 0.15, -d / 2 - 0.001, 0, 0.035, 0.012, h * 0.55, "dark")
            if i % 2 == 0:
                b.box(w * 0.12, -d / 2 - 0.04, h * 0.62, w * 0.6, 0.1, 0.014, "team", rot=(0.4, 0, 0))
            else:
                b.box(w * 0.18, d * 0.15, h + 0.016, w * 0.45, d * 0.5, 0.05, "roof")

    def granary(self, b, x, y, r):
        b.lathe(x, y, 0, [(r, 0), (r * 0.95, r * 0.9), (r * 0.6, r * 1.6), (r * 0.2, r * 1.95)], "wall", seg=7)

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.frustum(0, 0, 0, L, t * 1.3, L, t * 0.6, h, "roof")
            b.box(0, 0, h, L, t * 0.62, 0.012, "stone")

    def pylon(self, b, x, y, z, w, d, h, flags=2, mat="wall", door=True):
        """Gate of two battered towers with lapis cornices, a lower doorway between them and banner
        poles (flags per tower) on the front."""
        tw = w * 0.43
        for s in (-1, 1):
            cx = x + s * (w / 2 - tw / 2)
            b.frustum(cx, y, z, tw, d, tw * 0.84, d * 0.6, h, mat)
            b.box(cx, y, z + h, tw * 0.9, d * 0.74, h * 0.07, "trim")
            b.box(cx, y, z + h * 1.07, tw * 0.8, d * 0.6, h * 0.03, mat)
            for k in range(flags):
                px = cx + (k - (flags - 1) / 2) * tw * 0.5
                b.box(px, y - d / 2 - 0.012, z, 0.014, 0.014, h * 1.3, "dark")
                b.box(px + 0.04, y - d / 2 - 0.012, z + h * 1.3 - h * 0.24, 0.07, 0.01, h * 0.24, "team")
        gw = w - 2 * tw + 0.03
        b.box(x, y, z, gw, d * 0.62, h * 0.62, mat)
        if door:
            b.box(x, y - d * 0.31 - 0.002, z, gw * 0.6, 0.012, h * 0.46, "dark")
        b.box(x, y, z + h * 0.62, gw + 0.01, d * 0.66, h * 0.06, "trim")

    def gate(self, b, x, y, h, t):
        self.pylon(b, x, y, 0, 0.3, t + 0.05, h + 0.12, flags=0, mat="stone")

    def pyramid(self, b, x, y, z, base, h, cap=0.26):
        """Smooth pyramid with a gold capstone (the top `cap` of the height)."""
        k = cap
        b.frustum(x, y, z, base, base, base * k, base * k, h * (1 - k), "wall")
        b.frustum(x, y, z + h * (1 - k), base * k, base * k, 0, 0, h * k, "extra")

    def hypostyle(self, b, x, y, z, w, d, h, nave):
        """Columned hall: low battered box, a raised clerestory nave, lapis cornices, fat front columns."""
        b.battered(x, y, z, w, d, h, "stone", k=0.94)
        b.box(x, y, z + h, w * 0.96, d * 0.96, 0.02, "trim")
        b.box(x, y, z + h + 0.02, nave, d * 0.86, h * 0.7, "wall")
        b.box(x, y, z + h * 1.7 + 0.02, nave + 0.02, d * 0.9, 0.02, "trim")
        n = 5
        for k in range(n):
            b.cyl(x - w * 0.4 + k * w * 0.8 / (n - 1), y - d / 2 - 0.035, z, 0.024, h, "wall", seg=5)
        b.box(x, y - d / 2 - 0.03, z + h, w * 0.94, 0.07, 0.02, "stone")

    def capital(self, b):
        b.box(0, 0, 0, 0.98, 0.98, 0.015, "stone")          # sand
        z = 0.015
        self.ring(b, 0.455, self.ring_h, with_gate=False, t=0.05)
        b.box(-0.1, -0.455, 0, 0.14, 0.09, 0.1, "roof")     # the outer gate
        b.box(-0.1, -0.5, 0, 0.07, 0.012, 0.07, "dark")
        x = -0.1
        self.pylon(b, x, -0.12, z, 0.56, 0.11, 0.34)
        for sx in (-1, 1):                                  # the paired obelisks
            b.obelisk(x + sx * 0.12, -0.31, z, 0.058, 0.4, caph=1.5)
        for sx in (-1, 1):                                  # the sphinx avenue
            for k in range(2):
                b.box(x + sx * 0.05, -0.36 - k * 0.055, z, 0.03, 0.045, 0.03, "wall")
        self.hypostyle(b, x, 0.2, z, 0.44, 0.3, 0.13, 0.18)
        self.pyramid(b, 0.3, 0.24, z, 0.32, 0.27)
        self.house(b, 0.31, -0.1, 0.16, 0.14, 0.09, 0, 1)
        self.house(b, 0.31, -0.29, 0.16, 0.14, 0.08, 0, 0)

    def city(self, b):
        b.box(0, 0, 0, 0.98, 0.98, 0.012, "stone")
        self.ring(b, 0.46, self.ring_h)
        spots = [(-0.32, 0.33), (-0.11, 0.33), (0.1, 0.33), (-0.32, -0.3), (0.32, -0.3), (-0.32, 0.03)]
        for i, (x, y) in enumerate(spots):
            self.house(b, x, y, 0.18, 0.17, 0.1 + 0.03 * (i % 3), 0, i)
        for x, y, r in ((0.31, 0.3, 0.07), (0.34, 0.14, 0.06), (0.22, 0.17, 0.05)):
            self.granary(b, x, y, r)
        self.pylon(b, 0.02, -0.1, 0.012, 0.36, 0.08, 0.26, flags=1)
        self.hypostyle(b, 0.02, 0.07, 0.012, 0.28, 0.2, 0.1, 0.12)
        b.obelisk(0.02, -0.27, 0.012, 0.045, 0.3, caph=1.5)

    def town(self, b):
        b.box(0, 0, 0, 0.9, 0.9, 0.012, "stone")
        for i, (x, y) in enumerate([(-0.29, 0.28), (0.29, 0.28), (-0.29, 0.02), (0.29, 0.02), (-0.3, -0.27), (0.3, -0.27)]):
            self.house(b, x, y, 0.22, 0.19, 0.1 + 0.03 * (i % 2), 0, i + (1 if i < 2 else 0))
        b.box(0, 0.08, 0.012, 0.16, 0.16, 0.03, "wall")
        b.obelisk(0, 0.08, 0.042, 0.075, 0.5, band="team", plinth=None, caph=1.4)
        self.pylon(b, 0, -0.26, 0.012, 0.22, 0.07, 0.15, flags=0)   # a wayside shrine

    def temple(self, b):
        # true pyramid with a gold capstone, a causeway and a pylon chapel with banners
        b.box(0, 0, 0, 0.94, 0.94, 0.02, "stone")
        b.box(0, 0.1, 0.02, 0.76, 0.76, 0.015, "wall")
        self.pyramid(b, 0, 0.1, 0.035, 0.72, 0.52, cap=0.24)
        b.box(0, -0.36, 0.02, 0.07, 0.2, 0.012, "wall")
        self.pylon(b, 0, -0.33, 0.02, 0.3, 0.07, 0.17, flags=1)
        self.pyramid(b, 0.35, -0.34, 0.02, 0.18, 0.14)
        b.obelisk(-0.33, -0.36, 0.02, 0.045, 0.24, caph=1.5)

    def fort(self, b):
        # Buhen: thick battered mudbrick walls, bastions, corner towers, a pylon gate, a keep
        half, h = 0.36, 0.19
        for s in (-1, 1):
            b.battered(0, s * half, 0, 2 * half, 0.1, h, "roof", k=0.72)
            b.battered(s * half, 0, 0, 0.1, 2 * half, h, "roof", k=0.72)
            for k in (-1, 1):                               # bastions
                b.battered(k * 0.16, s * (half + 0.05), 0, 0.09, 0.07, h, "roof", k=0.8)
                b.battered(s * (half + 0.05), k * 0.16, 0, 0.07, 0.09, h, "roof", k=0.8)
        for sx in (-1, 1):
            for sy in (-1, 1):
                b.battered(sx * half, sy * half, 0, 0.19, 0.19, 0.28, "roof", k=0.8)
                b.box(sx * half, sy * half, 0.28, 0.16, 0.16, 0.02, "wall")
        self.pylon(b, 0, -half - 0.02, 0, 0.26, 0.11, 0.27, flags=1, mat="stone")
        b.battered(0, 0.08, 0, 0.3, 0.26, 0.2, "stone", k=0.88)   # the keep
        b.box(0, 0.08, 0.2, 0.28, 0.24, 0.02, "trim")
        b.box(0.03, 0.1, 0.22, 0.15, 0.13, 0.05, "team")          # a cloth shelter on the roof
        self.flag(b, -0.08, 0.04, 0.22, 0.26, w=0.13, fh=0.085)


# ------------------------------------------------------------------ highland
class Highland(Base):
    name = "highland"

    def rock(self, b, h, r=0.49, seed=0, sq=0.5):
        """The rock every highland model stands on. Returns its top z."""
        return b.hill(0, 0, r, h, "stone", seg=9, jag=0.2, seed=seed, sq=sq, top=0.84, mid=0.96)

    def crag(self, b, x, y, z, w, d, h, ox=0.0, oy=0.0, top=0.5, rz=0.0):
        b.frustum(x, y, z, w, d, w * top, d * top, h, "stone", rz=rz, ox=ox, oy=oy)

    def block(self, b, x, y, z, w, d, h, k=0.86, roof="flat", wins=0, rh=0.07):
        """Dzong block: battered whitewashed walls, an ochre-red band under the roof, a row of small
        windows below it; a flat dark roof, a gilded flared roof ("gold") or none. Returns the top z."""
        b.battered(x, y, z, w, d, h, "wall", k=k)
        f = 1 - (1 - k) * 0.78
        b.box(x, y, z + h * 0.78, w * f + 0.008, d * f + 0.008, h * 0.22, "trim")
        g = 1 - (1 - k) * 0.55
        for i in range(wins):
            sx = (i - (wins - 1) / 2) * w * 0.7 / max(1, wins - 1) if wins > 1 else 0
            b.box(x + sx, y - d * g / 2 - 0.002, z + h * 0.5, 0.035, 0.014, h * 0.16, "dark")
        if roof == "flat":
            b.box(x, y, z + h, w * k + 0.045, d * k + 0.045, 0.016, "roof")
            return z + h + 0.016
        if roof == "gold":
            return b.flared_roof(x, y, z + h, w * k, d * k, rh)
        return z + h

    def house(self, b, x, y, w, d, h, rz, i, z=0.0):
        self.block(b, x, y, z, w, d, h, k=0.88, wins=0)
        b.box(x, y - d * 0.47, z, 0.035, 0.014, h * 0.45, "dark")

    def stair(self, b, x, y, z, n, w=0.1, run=0.035, rise=0.0275):
        for k in range(n):
            b.box(x, y + k * run, z, w, run, rise * (k + 1), "wall")

    def capital(self, b):
        # dzong: one great battered white block with a red band and a gold-roofed tower, on terraces
        z0 = self.rock(b, 0.09)
        z = b.terraces(0, 0.0, z0, 0.86, 0.84, 3, 0.1, 0.055, side=0.06)
        for k in range(3):
            self.stair(b, 0, -0.42 + k * 0.1 - 0.07, z0 + k * 0.055, 2)
        top = self.block(b, 0, 0.13, z, 0.56, 0.44, 0.27, wins=5)
        ut = self.block(b, 0, 0.15, top - 0.016, 0.22, 0.2, 0.21, k=0.88, roof="gold", rh=0.1)
        b.cyl(0, 0.15, ut - 0.01, 0.014, 0.06, "extra", seg=4)
        for sx in (-1, 1):                                  # corner turrets with gold roofs
            b.box(sx * 0.2, -0.02, top, 0.1, 0.1, 0.05, "trim")
            b.flared_roof(sx * 0.2, -0.02, top + 0.05, 0.09, 0.09, 0.06)
        b.box(0, -0.085, z + 0.05, 0.1, 0.014, 0.15, "team")   # the great banner on the front wall
        for sx in (-1, 1):
            b.prayer_flags((0, 0.15, ut + 0.03), (sx * 0.4, -0.36, z0 + 0.2), n=6, s=0.05)
            b.box(sx * 0.4, -0.36, z0, 0.014, 0.014, 0.2, "dark")
            self.house(b, sx * 0.3, -0.31, 0.15, 0.12, 0.09, 0, 0, z=z0 + 0.055)

    def city(self, b):
        # houses climbing four terraces to a watchtower and a gold-roofed monastery hall
        z0 = self.rock(b, 0.07)
        for i in range(4):
            yf, z = -0.43 + i * 0.215, z0 + (i + 1) * 0.065
            b.box(0, (yf + 0.43) / 2, z0, 0.86, 0.43 - yf, z - z0, "stone")
            if i < 3:
                for j, x in enumerate((-0.29, 0.0, 0.29)):
                    self.house(b, x + (0.03 if i % 2 else 0), yf + 0.1, 0.18, 0.12, 0.09 + 0.02 * ((i + j) % 2), 0, 0, z=z)
            else:
                self.block(b, -0.12, yf + 0.11, z, 0.3, 0.16, 0.14, roof="gold", wins=3, rh=0.08)
                b.tower_house(0.28, yf + 0.11, z, 0.13, 0.36, band="trim", roof="extra")
                b.box(-0.12, yf + 0.024, z + 0.02, 0.07, 0.012, 0.09, "team")
        b.prayer_flags((0.28, 0.3, z0 + 0.6), (-0.4, -0.38, z0 + 0.24), n=7, s=0.05, sag=0.05)
        b.box(-0.4, -0.38, z0, 0.014, 0.014, 0.24, "dark")

    def town(self, b):
        z0 = self.rock(b, 0.07, r=0.46)
        b.box(0, 0, z0, 0.8, 0.8, 0.05, "stone")
        b.box(0, 0.2, z0 + 0.05, 0.8, 0.4, 0.07, "stone")
        z1, z2 = z0 + 0.05, z0 + 0.12
        self.stair(b, 0, -0.07, z1, 2, run=0.035, rise=0.035)
        self.house(b, -0.25, -0.22, 0.22, 0.17, 0.12, 0, 0, z=z1)
        self.house(b, 0.25, -0.22, 0.22, 0.17, 0.13, 0, 1, z=z1)
        self.house(b, -0.26, 0.22, 0.2, 0.17, 0.12, 0, 1, z=z2)
        self.house(b, 0.26, 0.22, 0.2, 0.17, 0.12, 0, 2, z=z2)
        # chorten: white steps and dome, a gold spire
        x, y = 0, 0.2
        b.box(x, y, z2, 0.17, 0.17, 0.04, "wall")
        b.box(x, y, z2 + 0.04, 0.12, 0.12, 0.04, "trim")
        b.lathe(x, y, z2 + 0.08, [(0.05, 0), (0.07, 0.04), (0.06, 0.08), (0.03, 0.1)], "wall", seg=8)
        b.cone(x, y, z2 + 0.18, 0.03, 0.16, "extra", seg=6)
        for sx in (-1, 1):
            b.prayer_flags((x, y, z2 + 0.34), (sx * 0.4, -0.02, z1 + 0.14), n=5, s=0.05)
            b.box(sx * 0.4, -0.02, z1, 0.014, 0.014, 0.14, "dark")

    def temple(self, b):
        # cliff monastery (Tiger's Nest): white blocks with red bands on the ledges of a leaning rock
        self.rock(b, 0.07, r=0.47, seed=3)
        self.crag(b, 0.04, 0.14, 0, 0.8, 0.56, 0.78, oy=0.08, top=0.5)
        self.crag(b, -0.22, -0.12, 0, 0.4, 0.38, 0.3, oy=0.06, top=0.7, rz=0.12)
        self.crag(b, 0.24, -0.08, 0, 0.38, 0.38, 0.47, oy=0.08, top=0.66, rz=-0.1)
        b.box(0.02, 0.0, 0.52, 0.3, 0.2, 0.1, "stone", rot=(0, 0, 0.1))
        self.block(b, -0.22, -0.08, 0.3, 0.26, 0.2, 0.2, wins=2)
        self.block(b, 0.24, -0.02, 0.47, 0.23, 0.2, 0.2, wins=2)
        t = self.block(b, 0.03, 0.22, 0.78, 0.22, 0.18, 0.1, roof="gold", rh=0.08)
        b.cyl(0.03, 0.22, t - 0.01, 0.012, 0.04, "extra", seg=4)
        self.stair(b, 0.02, -0.16, 0.3, 3, w=0.07, run=0.035, rise=0.055)
        b.box(-0.22, -0.185, 0.33, 0.08, 0.012, 0.1, "team")
        b.prayer_flags((-0.22, -0.08, 0.58), (0.24, -0.02, 0.76), n=6, s=0.05, sag=0.04)

    def fort(self, b):
        # pass fort: a white gate tower and wall across the notch between two crags, a watchtower above
        self.rock(b, 0.07, r=0.48, seed=5)
        self.crag(b, -0.33, 0.04, 0, 0.3, 0.62, 0.58, ox=-0.02, oy=0.06, top=0.42)
        self.crag(b, -0.33, -0.26, 0, 0.3, 0.3, 0.3, ox=-0.03, oy=0.05, top=0.5, rz=0.2)
        self.crag(b, 0.33, -0.04, 0, 0.3, 0.62, 0.44, ox=0.02, oy=-0.04, top=0.55)
        self.crag(b, 0.33, 0.26, 0, 0.3, 0.3, 0.26, ox=0.03, oy=-0.05, top=0.5, rz=-0.2)
        b.battered(0, 0, 0, 0.46, 0.15, 0.24, "wall", k=0.9)   # the wall across the pass
        b.box(0, 0, 0.2, 0.44, 0.15, 0.045, "trim")
        t = self.block(b, 0, 0.0, 0, 0.24, 0.22, 0.5, k=0.82, roof="gold", rh=0.09)
        b.box(0, -0.112, 0, 0.09, 0.02, 0.13, "dark")
        b.box(0, -0.105, 0.2, 0.08, 0.012, 0.15, "team")
        b.tower_house(0.34, -0.08, 0.44, 0.12, 0.22, band="trim")
        b.prayer_flags((0, 0, t - 0.02), (-0.36, 0.08, 0.62), n=6, s=0.05, sag=0.04)
        b.box(-0.36, 0.08, 0.5, 0.014, 0.014, 0.12, "dark")


IDENTITY_STYLES = {c.name: c() for c in (SovietBloc, WesternModern, Egyptian, Highland)}
