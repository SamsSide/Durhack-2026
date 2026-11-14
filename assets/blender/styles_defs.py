"""The six style definitions: pieces (house, tower, wall, landmark) per architecture.

Layouts per kind are shared (Base); each style supplies the pieces. Material slots:
wall, stone, roof, trim, dark, extra, team.
"""
import math

PI = math.pi


def hsh(i):
    return (math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1.0


class Base:
    name = ""
    ring_h = 0.1       # outer wall height for city and capital
    wall_t = 0.05
    plain = False      # True while drawing an inner ring: walls skip their crenellations

    # ---- shared pieces
    def flag(self, b, x, y, z0, h, w=0.14, fh=0.09, mat="team"):
        b.box(x, y, z0, 0.02, 0.02, h, "dark")
        b.box(x + w / 2, y, z0 + h - fh, w, 0.015, fh, mat)

    def plinth(self, b, x, y, z0, w, d, steps, sh, mat="stone", mat2="wall"):
        for i in range(steps):
            k = i * 0.07
            b.box(x, y, z0 + i * sh, w - 2 * k, d - 2 * k, sh, mat if i % 2 == 0 else mat2)
        return z0 + steps * sh

    def ring(self, b, half, h, with_gate=True, t=None):
        t = t or self.wall_t
        L = 2 * half + t
        for s in (-1, 1):
            self.wall(b, 0, s * half, L, 0, h, t)
            self.wall(b, s * half, 0, L, PI / 2, h, t)
        if with_gate:
            self.gate(b, 0, -half, h, t)

    def gate(self, b, x, y, h, t):
        b.box(x, y, 0, 0.16, t + 0.03, h + 0.07, "stone")
        b.box(x, y - t / 2 - 0.0, 0, 0.08, t + 0.034, h * 0.8, "dark")

    # ---- kind layouts
    def town(self, b):
        for i, (x, y, rz) in enumerate([(-0.3, 0.3, 0.1), (0.3, 0.3, -0.1), (-0.3, -0.3, 0), (0.3, -0.3, 0.1)]):
            self.house(b, x, y, 0.24, 0.2, 0.14 + 0.03 * (i % 2), rz, i)
        self.landmark(b, "town")

    def city(self, b):
        self.ring(b, 0.46, self.ring_h)
        spots = [(-0.33, 0.33), (0.33, 0.33), (-0.33, -0.3), (0.33, -0.3), (-0.34, 0.0), (0.34, 0.0)]
        for i, (x, y) in enumerate(spots):
            self.house(b, x, y, 0.2, 0.18, 0.15 + 0.04 * (i % 3), 0, i)
        self.landmark(b, "city")

    def capital(self, b):
        self.ring(b, 0.47, self.ring_h + 0.03)
        for sx in (-1, 1):
            for sy in (-1, 1):
                self.tower(b, sx * 0.47, sy * 0.47, 0.34)
        self.plain = True
        self.ring(b, 0.27, 0.07, with_gate=False, t=0.04)
        self.plain = False
        spots = [(-0.37, 0.36), (0.37, 0.36), (-0.38, -0.2), (0.38, -0.2)]
        for i, (x, y) in enumerate(spots):
            self.house(b, x, y, 0.15, 0.17, 0.13 + 0.03 * (i % 3), 0, i)
        self.landmark(b, "capital")

    def fort(self, b):
        w = 0.8
        self.ring(b, w / 2, 0.22, t=0.07)
        for sx in (-1, 1):
            for sy in (-1, 1):
                self.tower(b, sx * w / 2, sy * w / 2, 0.42)
        self.landmark(b, "fort")

    def temple(self, b):
        self.landmark(b, "temple")


# ------------------------------------------------------------------ medieval
class Medieval(Base):
    name = "medieval"

    def house(self, b, x, y, w, d, h, rz, i):
        with b.at(x, y, rz):
            b.box(0, 0, 0, w, d, h, "wall")
            b.box(0, 0, h * 0.5, w + 0.01, d + 0.01, 0.02, "trim")
            b.gable(0, 0, h, w, d, min(w, d) * 0.95, "team" if i % 2 == 0 else "roof", rz=0 if i % 3 else PI / 2)

    def tower(self, b, x, y, h):
        b.cyl(x, y, 0, 0.065, h, "stone", seg=6)
        b.cone(x, y, h, 0.095, 0.16, "team", seg=6)

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.box(0, 0, 0, L, t, h, "stone")
            n = 0 if self.plain else max(3, int(L / 0.2))
            for k in range(n):
                b.box(-L / 2 + (k + 0.5) * L / n, 0, h, L / n * 0.55, t, 0.04, "stone")

    def crown(self, b, x, y, z, w):  # crenellated top ring of a box
        for s in (-1, 1):
            for k in range(3):
                t = (k - 1) * w * 0.34
                b.box(x + s * w / 2, y + t, z, 0.035, w * 0.18, 0.05, "stone")
                b.box(x + t, y + s * w / 2, z, w * 0.18, 0.035, 0.05, "stone")

    def spire(self, b, x, y, z, w, h, mat="team"):
        b.frustum(x, y, z, w, w, 0, 0, h, mat)

    def landmark(self, b, kind):
        if kind == "town":
            b.box(0.02, 0, 0, 0.3, 0.18, 0.16, "wall")
            b.gable(0.02, 0, 0.16, 0.3, 0.18, 0.13, "roof")
            b.box(-0.16, 0, 0, 0.11, 0.11, 0.34, "stone")
            self.spire(b, -0.16, 0, 0.34, 0.13, 0.26)
        elif kind == "city":
            b.box(0, 0.02, 0, 0.36, 0.2, 0.2, "wall")
            b.gable(0, 0.04, 0.2, 0.36, 0.2, 0.15, "roof")
            for sx in (-1, 1):
                b.box(sx * 0.12, -0.1, 0, 0.1, 0.1, 0.4, "stone")
                self.spire(b, sx * 0.12, -0.1, 0.4, 0.13, 0.3)
        elif kind == "capital":
            z = self.plinth(b, 0, 0, 0, 0.5, 0.5, 1, 0.05)
            b.box(0, 0, z, 0.32, 0.32, 0.4, "wall")
            b.box(0, 0, z + 0.4, 0.37, 0.37, 0.03, "stone")
            self.crown(b, 0, 0, z + 0.43, 0.37)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    b.cyl(sx * 0.18, sy * 0.18, z + 0.1, 0.05, 0.4, "stone", seg=5)
                    b.cone(sx * 0.18, sy * 0.18, z + 0.5, 0.065, 0.12, "team", seg=5)
            b.box(0, 0, z + 0.43, 0.2, 0.2, 0.12, "wall")
            self.spire(b, 0, 0, z + 0.55, 0.24, 0.3, "team")
            self.flag(b, 0, 0, z + 0.85, 0.15)
        elif kind == "temple":
            z = self.plinth(b, 0, 0, 0, 0.9, 0.9, 1, 0.04)
            b.box(0, 0, z, 0.22, 0.7, 0.22, "wall")
            b.gable(0, 0, z + 0.22, 0.7, 0.22, 0.16, "roof", rz=PI / 2)
            b.box(0, 0, z, 0.55, 0.22, 0.22, "wall")
            b.gable(0, 0, z + 0.22, 0.55, 0.22, 0.16, "roof")
            b.box(0, 0, z + 0.1, 0.18, 0.18, 0.5, "stone")
            self.spire(b, 0, 0, z + 0.6, 0.22, 0.4, "team")
            b.cyl(0, 0, z + 1.0, 0.01, 0.06, "dark", seg=4)
        elif kind == "fort":
            b.box(0, 0.05, 0, 0.3, 0.3, 0.4, "wall")
            b.box(0, 0.05, 0.4, 0.35, 0.35, 0.03, "stone")
            self.crown(b, 0, 0.05, 0.43, 0.35)
            self.flag(b, 0, 0.05, 0.43, 0.3)


# ------------------------------------------------------------------ classical
class Classical(Base):
    name = "classical"
    ring_h = 0.08

    def house(self, b, x, y, w, d, h, rz, i):
        with b.at(x, y, rz):
            b.box(0, 0, 0, w, d, h, "wall")
            b.box(0, 0, h - 0.02, w + 0.02, d + 0.02, 0.02, "stone")
            b.gable(0, 0, h, w, d, min(w, d) * 0.32, "team" if i % 2 == 0 else "roof")
            if i % 2:
                b.box(0, 0, h + min(w, d) * 0.32 - 0.005, w + 0.03, 0.03, 0.03, "team")

    def tower(self, b, x, y, h):
        b.cyl(x, y, 0, 0.065, h, "wall", seg=5)
        b.cyl(x, y, h, 0.08, 0.025, "stone", seg=5)
        self.flag(b, x, y, h + 0.04, 0.18, w=0.1, fh=0.07)

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.box(0, 0, 0, L, t, h, "wall")
            b.box(0, 0, h, L, t + 0.015, 0.02, "trim")

    def columns(self, b, x, y, z, w, n, h, r=0.03):
        for k in range(n):
            cx = x - w / 2 + k * w / (n - 1)
            b.cyl(cx, y, z, r, h, "wall", seg=5)

    def temple_body(self, b, x, y, z, w, d, n, ch):
        """Columned temple, front facing -y. Returns top z."""
        b.box(x, y, z, w, d, 0.03, "stone")
        z += 0.03
        b.box(x, y, z, w - 0.05, d - 0.05, 0.03, "wall")
        z += 0.03
        b.box(x, y, z, w - 0.12, d - 0.12, ch, "stone")
        for sy in (-1, 1):
            self.columns(b, x, y + sy * (d / 2 - 0.05), z, w - 0.1, n, ch)
        for sx in (-1, 1):
            for k in range(1, 3):
                b.cyl(x + sx * (w / 2 - 0.05), y - (d / 2 - 0.05) + k * (d - 0.1) / 3, z, 0.03, ch, "wall", seg=5)
        z += ch
        b.box(x, y, z, w, d, 0.03, "stone")
        z += 0.03
        rh = w * 0.22
        b.gable(x, y, z, d, w - 0.02, rh, "roof", rz=PI / 2, over=0.0)
        for sy in (-1, 1):
            b.gable(x, y + sy * (d / 2 + 0.01), z, 0.025, w - 0.04, rh * 0.9, "team", rz=PI / 2, over=0.0)
        b.box(x, y, z + rh, 0.025, d + 0.02, 0.025, "trim")
        return z + rh

    def landmark(self, b, kind):
        if kind == "town":
            self.temple_body(b, 0, 0, 0, 0.36, 0.3, 4, 0.14)
        elif kind == "city":
            self.temple_body(b, 0, 0.02, 0, 0.44, 0.34, 5, 0.22)
            b.lathe(0.19, -0.2, 0, [(0.07, 0), (0.07, 0.1), (0.075, 0.12), (0.05, 0.16), (0.0, 0.19)], "team", seg=8)
        elif kind == "capital":
            z = self.plinth(b, 0, 0, 0, 0.5, 0.5, 2, 0.04)
            top = self.temple_body(b, 0, -0.03, z, 0.46, 0.36, 5, 0.3)
            b.lathe(0, 0.17, z, [(0.11, 0), (0.11, 0.3), (0.12, 0.32), (0.06, 0.43), (0.0, 0.5)], "team", seg=8)
            b.cyl(0, 0.17, z + 0.5, 0.01, 0.1, "trim", seg=4)
            self.flag(b, 0.0, 0.0, top - 0.02, 0.16, w=0.1)
        elif kind == "temple":
            z = 0
            for i in range(3):
                b.box(0, 0, z, 0.92 - i * 0.08, 0.7 - i * 0.08, 0.04, "stone" if i % 2 == 0 else "wall")
                z += 0.04
            ch = 0.38
            top = self.temple_body(b, 0, 0, z, 0.76, 0.54, 6, ch)
        elif kind == "fort":
            # castrum: barracks block, standard pole
            b.box(0, 0.12, 0, 0.4, 0.14, 0.14, "wall")
            b.gable(0, 0.12, 0.14, 0.4, 0.14, 0.07, "roof")
            b.box(0, -0.1, 0, 0.14, 0.14, 0.1, "stone")
            self.flag(b, 0, -0.1, 0.1, 0.34)
        return None


# ------------------------------------------------------------------ desert
class Desert(Base):
    name = "desert"
    wall_t = 0.07
    ring_h = 0.14

    def dome(self, b, x, y, z, r, mat="team", seg=10):
        pr = [(0.85, 0), (1.0, 0.25), (0.9, 0.62), (0.45, 1.0), (0.0, 1.4)]
        b.lathe(x, y, z, [(a * r, c * r) for a, c in pr], mat, seg=seg)
        return z + 1.4 * r

    def minaret(self, b, x, y, h, r=0.035):
        b.cyl(x, y, 0, r * 1.2, h * 0.78, "wall", seg=6, r2=r)
        b.cyl(x, y, h * 0.74, r * 1.9, 0.025, "team", seg=6)
        b.cyl(x, y, h * 0.765, r * 1.0, h * 0.13, "wall", seg=6)
        b.cone(x, y, h * 0.89, r * 1.3, h * 0.11, "trim", seg=6)

    def house(self, b, x, y, w, d, h, rz, i):
        with b.at(x, y, rz):
            b.box(0, 0, 0, w, d, h, "wall")
            b.box(0, 0, h, w + 0.02, d + 0.02, 0.025, "stone")
            if i % 2 == 0:
                b.box(0, -d / 2 - 0.045, h * 0.52, w * 0.8, 0.12, 0.02, "team", rot=(0.45, 0, 0))
            else:
                b.box(w * 0.2, d * 0.15, h + 0.025, w * 0.4, d * 0.4, 0.05, "wall")

    def tower(self, b, x, y, h):
        b.cyl(x, y, 0, 0.07, h, "wall", seg=6, r2=0.062)
        self.dome(b, x, y, h, 0.075, "team", seg=6)

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.box(0, 0, 0, L, t, h, "wall")
            b.box(0, 0, h, L, t * 0.6, 0.03, "stone")

    def landmark(self, b, kind):
        if kind == "town":
            b.box(0, 0, 0, 0.32, 0.3, 0.14, "wall")
            b.cyl(0, 0, 0.14, 0.11, 0.05, "trim", seg=10)
            self.dome(b, 0, 0, 0.19, 0.12)
            with b.at(0.17, 0.17):
                self.minaret(b, 0, 0, 0.55)
        elif kind == "city":
            b.box(0, 0, 0, 0.4, 0.36, 0.17, "wall")
            b.cyl(0, 0, 0.17, 0.14, 0.07, "trim", seg=10)
            self.dome(b, 0, 0, 0.24, 0.16)
            for sx in (-1, 1):
                self.minaret(b, sx * 0.2, -0.17, 0.66)
        elif kind == "capital":
            z = self.plinth(b, 0, 0, 0, 0.5, 0.5, 1, 0.05)
            b.box(0, 0.02, z, 0.46, 0.4, 0.2, "wall")
            b.box(0, -0.2, z, 0.16, 0.05, 0.26, "stone")
            b.box(0, -0.2, z, 0.08, 0.052, 0.17, "dark")
            b.cyl(0, 0.02, z + 0.2, 0.17, 0.09, "trim", seg=10)
            self.dome(b, 0, 0.02, z + 0.29, 0.2, seg=8)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    with b.at(sx * 0.23, 0.02 + sy * 0.2):
                        self.minaret(b, 0, 0, 0.82)
        elif kind == "temple":
            z = self.plinth(b, 0, 0, 0, 0.9, 0.9, 1, 0.04)
            b.box(0, 0.05, z, 0.56, 0.5, 0.2, "wall")
            b.box(0, -0.29, z, 0.3, 0.12, 0.12, "stone")
            b.box(0, -0.29, z, 0.18, 0.125, 0.09, "trim")
            b.cyl(0, 0.05, z + 0.2, 0.19, 0.1, "trim", seg=12)
            self.dome(b, 0, 0.05, z + 0.3, 0.22, seg=12)
            self.minaret(b, 0.36, -0.3, 0.8)
        elif kind == "fort":
            b.box(0, 0.05, 0, 0.3, 0.3, 0.26, "wall")
            b.box(0, 0.05, 0.26, 0.34, 0.34, 0.03, "stone")
            b.box(0.08, -0.15, 0.02, 0.2, 0.12, 0.02, "team", rot=(0.4, 0, 0))
            b.box(0, 0.05, 0.29, 0.14, 0.14, 0.1, "wall")


# ------------------------------------------------------------------ east asian
class EastAsian(Base):
    name = "east_asian"
    ring_h = 0.1
    wall_t = 0.05

    def roof(self, b, x, y, z, s, h, mat="roof", tips=False):
        """Curved hip roof, half-width s: flared lower slope, steeper upper, upturned corners."""
        b.frustum(x, y, z, 2 * s, 2 * s, 1.5 * s, 1.5 * s, h * 0.28, mat)
        b.frustum(x, y, z + h * 0.28, 1.5 * s, 1.5 * s, 0.22 * s, 0.22 * s, h * 0.72, mat)
        if not tips:
            return
        for sx in (-1, 1):
            for sy in (-1, 1):
                b.cone(x + sx * s * 0.96, y + sy * s * 0.96, z + 0.005, 0.022 + s * 0.05, 0.05 + s * 0.1, "extra", seg=4)

    def tier(self, b, x, y, z, s, bh, rh, mat="roof", body="trim", tips=True):
        b.box(x, y, z, s * 1.25, s * 1.25, bh, body)
        b.box(x, y, z + bh - 0.01, s * 1.4, s * 1.4, 0.02, "dark")
        self.roof(b, x, y, z + bh + 0.01, s, rh, mat, tips)
        return z + bh + 0.01 + rh

    def pagoda(self, b, x, y, z, s0, tiers, bh, rh, shrink=0.15):
        for i in range(tiers):
            s = s0 * (1 - shrink * i)
            mat = "team" if i % 2 == 0 else "roof"
            z = self.tier(b, x, y, z, s, bh, rh, mat)
        b.cyl(x, y, z, 0.012, 0.14, "extra", seg=4)
        b.cyl(x, y, z + 0.04, 0.03, 0.02, "extra", seg=6)
        return z + 0.14

    def house(self, b, x, y, w, d, h, rz, i):
        with b.at(x, y, rz):
            b.box(0, 0, 0, w, d, h, "wall")
            b.box(0, 0, h - 0.02, w + 0.02, d + 0.02, 0.02, "trim")
            self.roof(b, 0, 0, h, max(w, d) * 0.62, 0.11, "team" if i % 2 == 0 else "roof")

    def tower(self, b, x, y, h):
        b.box(x, y, 0, 0.12, 0.12, h, "stone")
        b.box(x, y, h * 0.55, 0.14, 0.14, 0.02, "trim")
        self.roof(b, x, y, h, 0.1, 0.14, "team")

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.box(0, 0, 0, L, t, h, "stone")
            b.box(0, 0, h, L, t + 0.02, 0.025, "roof")

    def gate(self, b, x, y, h, t):
        b.box(x, y, 0, 0.2, t + 0.03, h + 0.04, "trim")
        b.box(x, y - t / 2, 0, 0.1, t + 0.034, h * 0.85, "dark")
        self.roof(b, x, y, h + 0.04, 0.14, 0.1, "team")

    def landmark(self, b, kind):
        if kind == "town":
            z = self.plinth(b, 0, 0, 0, 0.34, 0.34, 1, 0.03)
            z = self.tier(b, 0, 0, z, 0.15, 0.1, 0.08, "team")
            z = self.tier(b, 0, 0, z, 0.115, 0.07, 0.07, "roof")
            b.cyl(0, 0, z, 0.012, 0.1, "extra", seg=4)
        elif kind == "city":
            z = self.plinth(b, 0, 0, 0, 0.4, 0.4, 1, 0.03)
            self.pagoda(b, 0, 0, z, 0.19, 3, 0.1, 0.09, shrink=0.16)
        elif kind == "capital":
            z = self.plinth(b, 0, 0, 0, 0.56, 0.5, 2, 0.04, mat="stone", mat2="stone")
            z = self.tier(b, 0, 0, z, 0.29, 0.14, 0.1, "team")
            z = self.tier(b, 0, 0, z, 0.2, 0.1, 0.12, "team")
            b.cyl(0, 0, z, 0.012, 0.1, "extra", seg=4)
            b.cyl(0, 0, z + 0.02, 0.035, 0.03, "extra", seg=6)
            for sx in (-1, 1):
                self.tier(b, sx * 0.19, -0.2, 0.08, 0.06, 0.06, 0.05, "roof", tips=False)
        elif kind == "temple":
            z = self.plinth(b, 0, 0, 0, 0.62, 0.62, 2, 0.04, mat="stone", mat2="stone")
            self.pagoda(b, 0, 0, z, 0.27, 5, 0.1, 0.1, shrink=0.12)
        elif kind == "fort":
            b.box(0, 0.05, 0, 0.3, 0.3, 0.16, "stone")
            b.box(0, 0.05, 0.16, 0.2, 0.2, 0.1, "trim")
            self.roof(b, 0, 0.05, 0.26, 0.19, 0.18, "team")


# ------------------------------------------------------------------ mesoamerican
class Meso(Base):
    name = "mesoamerican"
    ring_h = 0.08
    wall_t = 0.07

    def house(self, b, x, y, w, d, h, rz, i):
        r = min(w, d) * 0.5
        b.box(x, y, 0, w + 0.04, d + 0.04, 0.03, "stone")
        b.cyl(x, y, 0.03, r, h - 0.03, "wall", seg=8)
        b.cone(x, y, h, r * 1.3, 0.14, "team" if i % 2 == 0 else "roof", seg=8)

    def tower(self, b, x, y, h):
        b.box(x, y, 0, 0.14, 0.14, h * 0.4, "stone")
        b.box(x, y, h * 0.4, 0.11, 0.11, h * 0.35, "wall")
        b.box(x, y, h * 0.75, 0.15, 0.15, 0.04, "trim")
        b.box(x, y, h * 0.75 + 0.04, 0.08, 0.08, 0.06, "extra")
        b.box(x, y, h * 0.75 + 0.1, 0.12, 0.12, 0.025, "team")

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            b.box(0, 0, 0, L, t, h * 0.6, "stone")
            b.box(0, 0, h * 0.6, L, t * 0.65, h * 0.4, "wall")

    def pyramid(self, b, x, y, z0, base, top, n, h, stripe=True):
        sh = h / n
        for i in range(n):
            s = base - (base - top) * i / n
            b.box(x, y, z0 + i * sh, s, s, sh, "stone" if i % 2 == 0 else "wall")
        if stripe:
            half0, half1 = base / 2, (base - (base - top) * (n - 1) / n) / 2
            dy, dz = half0 - top / 2, h
            L = math.hypot(dy, dz)
            th = math.atan2(dz, dy)
            ym = -(half0 + top / 2) / 2
            nx, nz = -math.sin(th), math.cos(th)
            b.box(x, y + ym + nx * 0.008, z0 + h / 2 + nz * 0.008, min(0.12, base * 0.2), L, 0.012, "team", rot=(th, 0, 0))
        return z0 + h

    def shrine(self, b, x, y, z, w, h, roofmat="team"):
        b.box(x, y, z, w, w * 0.8, h, "wall")
        b.box(x, y - w * 0.4, z, w * 0.3, 0.012, h * 0.7, "dark")
        b.box(x, y, z + h, w * 1.25, w * 1.05, 0.03, roofmat)
        b.box(x, y, z + h + 0.03, w * 0.8, 0.025, 0.07, "extra")
        return z + h + 0.1

    def landmark(self, b, kind):
        if kind == "town":
            z = self.pyramid(b, 0, 0, 0, 0.34, 0.14, 3, 0.26)
            self.shrine(b, 0, 0, z, 0.1, 0.07)
        elif kind == "city":
            z = self.pyramid(b, 0, 0, 0, 0.44, 0.17, 4, 0.42)
            self.shrine(b, 0, 0, z, 0.12, 0.09)
        elif kind == "capital":
            z = self.plinth(b, 0, 0, 0, 0.52, 0.52, 1, 0.05, mat="stone", mat2="wall")
            z = self.pyramid(b, 0, 0, z, 0.46, 0.24, 5, 0.6)
            for sx in (-1, 1):
                self.shrine(b, sx * 0.07, 0, z, 0.1, 0.08)
            self.flag(b, 0, 0.05, z, 0.14, w=0.08, fh=0.07)
        elif kind == "temple":
            z = self.pyramid(b, 0, 0, 0, 0.76, 0.22, 9, 0.78)
            self.shrine(b, 0, 0, z, 0.16, 0.1)
        elif kind == "fort":
            z = self.plinth(b, 0, 0, 0, 0.74, 0.74, 2, 0.05, mat="stone", mat2="wall")
            z = self.pyramid(b, 0, 0.04, z, 0.3, 0.16, 3, 0.2)
            self.shrine(b, 0, 0.04, z, 0.09, 0.07)


# ------------------------------------------------------------------ scrap
class Scrap(Base):
    name = "scrap"
    ring_h = 0.12
    wall_t = 0.05

    def house(self, b, x, y, w, d, h, rz, i):
        with b.at(x, y, rz):
            if i % 3 == 0:  # two stacked containers, team door
                b.box(0, 0, 0, w, d * 0.75, 0.1, "wall")
                b.box(0.01, 0, 0.1, w, d * 0.75, 0.1, "extra")
                b.box(0, -d * 0.375 - 0.004, 0.0, w * 0.5, 0.012, 0.09, "team")
            else:
                b.box(0, 0, 0, w, d, h, "wall" if i % 2 else "stone")
                b.shed(0, 0, h, w + 0.03, d + 0.03, 0.07, "team" if i % 3 == 1 else "roof", h0=-0.01)
                b.box(0, -d / 2 - 0.004, 0, 0.05, 0.012, h * 0.6, "dark")

    def tower(self, b, x, y, h):
        b.frustum(x, y, 0, 0.1, 0.1, 0.06, 0.06, h, "extra", ox=0.015)
        b.cyl(x + 0.015, y, h, 0.075, 0.1, "roof", seg=5)
        b.cone(x + 0.015, y, h + 0.1, 0.085, 0.05, "team", seg=5)

    def wall(self, b, x, y, L, rz, h, t):
        with b.at(x, y, rz):
            n = 2 if self.plain else max(3, int(L / 0.15))
            for k in range(n):
                hh = h * (0.75 + 0.5 * hsh(k * 3 + int(L * 10)))
                c = ("wall", "extra", "stone", "roof")[int(hsh(k + 7) * 4)]
                b.box(-L / 2 + (k + 0.5) * L / n, 0, 0, L / n * 1.02, t, hh, c, rot=(0, 0, 0))

    def gate(self, b, x, y, h, t):
        for sx in (-1, 1):
            b.box(x + sx * 0.075, y, 0, 0.04, t + 0.02, h + 0.1, "dark")
        b.box(x, y, h + 0.04, 0.2, t + 0.02, 0.025, "team")
        for k in range(5):
            b.cone(x - 0.08 + k * 0.04, y, h + 0.065, 0.014, 0.07, "dark", seg=4)

    def water_tank(self, b, x, y, z, r, h):
        b.cyl(x, y, z, r, h, "roof", seg=8)
        b.cone(x, y, z + h, r * 1.1, h * 0.5, "team", seg=8)

    def landmark(self, b, kind):
        if kind == "town":
            for sx in (-1, 1):
                for sy in (-1, 1):
                    b.cyl(sx * 0.055, sy * 0.055, 0, 0.012, 0.3, "dark", seg=4)
            b.box(0, 0, 0.14, 0.14, 0.14, 0.015, "dark")
            self.water_tank(b, 0, 0, 0.3, 0.1, 0.12)
            b.box(0.2, 0.0, 0, 0.12, 0.26, 0.1, "wall")
            b.box(0.2, 0.0, 0.1, 0.12, 0.26, 0.1, "extra")
            b.box(0.136, 0.0, 0.02, 0.012, 0.12, 0.14, "team")
        elif kind == "city":
            b.frustum(0, 0, 0, 0.32, 0.32, 0.26, 0.26, 0.36, "wall", ox=0.0)
            b.frustum(0, 0, 0.36, 0.26, 0.26, 0.2, 0.16, 0.22, "stone", ox=-0.03, oy=0.0)
            b.frustum(-0.07, 0, 0.58, 0.14, 0.26, 0.06, 0.1, 0.12, "stone", ox=-0.04)
            for sx, z in ((0.19, 0.12), (0.19, 0.24), (-0.19, 0.18)):
                b.box(sx, 0, z, 0.1, 0.18, 0.08, "extra")
                b.shed(sx, 0, z + 0.08, 0.12, 0.2, 0.04, "team", h0=0.0)
            b.cyl(-0.1, 0.02, 0.68, 0.01, 0.16, "dark", seg=4)
            b.box(-0.04, 0.02, 0.78, 0.12, 0.015, 0.06, "team")
            b.box(0.0, -0.18, 0, 0.12, 0.08, 0.06, "stone", rot=(0.1, 0, 0.3))
        elif kind == "capital":
            z = self.plinth(b, 0, 0, 0, 0.54, 0.54, 1, 0.05, mat="stone", mat2="wall")
            b.frustum(0, 0, z, 0.58, 0.2, 0.7, 0.3, 0.2, "wall")
            b.cone(0.38, 0, z, 0.1, 0.16, "wall", seg=4, rot=(0, PI / 2, 0))
            b.box(0, 0, z + 0.2, 0.7, 0.3, 0.02, "dark")
            b.box(-0.05, 0, z + 0.22, 0.2, 0.2, 0.16, "stone")
            b.shed(-0.05, 0, z + 0.38, 0.22, 0.22, 0.06, "team", h0=0.0)
            for sx in (-0.2, 0.2):
                b.cyl(sx, 0, z + 0.22, 0.04, 0.4, "roof", seg=6)
                b.cyl(sx, 0, z + 0.55, 0.043, 0.04, "team", seg=6)
            b.cyl(0.17, 0.0, z + 0.22, 0.012, 0.5, "dark", seg=4)
            b.box(0.2, 0.0, z + 0.62, 0.1, 0.015, 0.08, "team")
            b.frustum(-0.24, 0, z + 0.22, 0.1, 0.1, 0.06, 0.06, 0.36, "extra")

            self.water_tank(b, -0.2, 0, z + 0.58, 0.07, 0.06)
        elif kind == "temple":
            z = self.plinth(b, 0, 0, 0, 0.9, 0.9, 1, 0.04, mat="stone", mat2="wall")
            b.cyl(0.0, 0.0, z + 0.2, 0.075, 0.55, "wall", seg=8, rot=(0, 0.5, 0))
            b.cone(-0.2, 0, z + 0.2 - 0.1, 0.075, 0.18, "extra", seg=8, rot=(0, 0.5 + PI, 0))
            b.box(0.12, 0, z + 0.42, 0.14, 0.7, 0.025, "extra", rot=(0, 0.5, 0))
            b.box(0.25, 0, z + 0.55, 0.12, 0.02, 0.2, "team", rot=(0, 0.5, 0))
            for sx in (-1, 1):
                for sy in (-1, 1):
                    b.cyl(sx * 0.38, sy * 0.38, z, 0.015, 0.42, "dark", seg=4)
                    b.box(sx * 0.38 + 0.05, sy * 0.38, z + 0.3, 0.1, 0.015, 0.1, "team")
        elif kind == "fort":
            for sx in (-1, 1):
                b.cyl(sx * 0.07, 0.1, 0, 0.012, 0.5, "dark", seg=4)
            b.frustum(0, 0.1, 0.35, 0.22, 0.14, 0.2, 0.14, 0.04, "dark")
            b.box(0, 0.1, 0.39, 0.22, 0.14, 0.1, "extra")
            b.shed(0, 0.1, 0.49, 0.26, 0.18, 0.05, "team", h0=0.0)
            for sx in (-1, 1):
                b.cyl(sx * 0.14, 0.1, 0, 0.012, 0.36, "dark", seg=4)
            b.box(0.0, -0.08, 0, 0.14, 0.1, 0.1, "stone")


STYLES = {c.name: c() for c in (Medieval, Classical, Desert, EastAsian, Meso, Scrap)}
