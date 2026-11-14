"""The age style `arcology` (row A26): what a nation builds in the future and stellar ages, whatever
its culture style. Same contract as styles_identity.py (one class, material slots wall, stone, roof,
trim, dark, extra, team, plus `park`).

What the set must show at globe scale: glass domes, tall tapered white towers with teal glass bands
and a `team` crown, sky bridges between them, and on the capital a tether rising to the top of the
box with a counterweight station (the space elevator).
"""
import math

from styles_defs import Base

PI = math.pi


class Arcology(Base):
    name = "arcology"

    # ---- pieces
    def dome(self, b, x, y, z, r, mat="roof", ring="wall", seg=8, cap="wall"):
        """A glass dome on a low ring, with a small cap. Returns the top z."""
        b.cyl(x, y, z, r * 1.07, r * 0.16, ring, seg=seg)
        z += r * 0.16
        pr = [(1.0, 0), (0.88, 0.48), (0.5, 0.87), (0, 1.0)]
        b.lathe(x, y, z, [(a * r, c * r) for a, c in pr], mat, seg=seg)
        if cap:
            b.cyl(x, y, z + r * 0.94, r * 0.24, r * 0.1, cap, seg=6)
        return z + r * 1.04

    def tower(self, b, x, y, z, r, h, k=0.55, seg=6, spire=0.0, crown="team"):
        """A tapered arcology tower: white shell, bands of teal glass (three, or two on a short tower), a team crown, a lit cap
        and (spire > 0) a needle. Returns the top z."""
        def rad(f):
            return r * (1 - (1 - k) * f)

        b.cyl(x, y, z, r, h, "wall", seg=seg, r2=r * k)
        bands = ((0.07, 0.3), (0.37, 0.58), (0.65, 0.84)) if h > 0.45 else ((0.08, 0.4), (0.5, 0.82))
        for f0, f1 in bands:
            b.cyl(x, y, z + f0 * h, rad(f0) + 0.006, (f1 - f0) * h, "roof", seg=seg, r2=rad(f1) + 0.006)
        b.cyl(x, y, z + 0.9 * h, rad(0.9) + 0.014, 0.1 * h, crown, seg=seg, r2=rad(1.0) + 0.014)
        b.cone(x, y, z + h, r * k * 0.8, r * 0.5, "extra", seg=seg)
        top = z + h + r * 0.5
        if spire:
            b.cyl(x, y, z + h, 0.007, r * 0.5 + spire, "wall", seg=4)
            top += spire
        return top

    def bridge(self, b, p0, p1, z, w=0.034):
        """A sky bridge between two points at height z."""
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        rot = (0, 0, math.atan2(dy, dx))
        b.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z, math.hypot(dx, dy), w, 0.022, "wall", rot=rot)
        b.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z + 0.022, math.hypot(dx, dy), w * 0.6, 0.008, "trim", rot=rot)

    def tree(self, b, x, y, z, s=1.0):
        b.cone(x, y, z, 0.04 * s, 0.1 * s, "park", seg=4)

    def pylon(self, b, x, y, z, h=0.16):
        b.cyl(x, y, z, 0.016, h, "wall", seg=4)
        b.cone(x, y, z + h, 0.022, 0.05, "extra", seg=4)

    def turret(self, b, x, y, z, rz):
        """A gun turret on a pedestal, barrels pointing along rz."""
        b.cyl(x, y, z, 0.07, 0.1, "wall", seg=6, r2=0.055)
        with b.at(x, y, rz):
            b.box(0, 0, z + 0.1, 0.11, 0.1, 0.055, "trim")
            b.box(-0.005, 0, z + 0.155, 0.08, 0.08, 0.01, "team")
            for dy in (-0.025, 0.025):
                b.box(0.09, dy, z + 0.118, 0.12, 0.016, 0.016, "dark")

    # ---- kinds
    def capital(self, b):
        b.box(0, 0, 0, 0.98, 0.98, 0.02, "stone")
        z = 0.02
        b.cyl(0, 0.02, z, 0.31, 0.006, "wall", seg=8)      # the plaza
        # the space elevator: an anchor dome, the tether up to the top of the box, a climber car
        # and the counterweight station
        ex, ey = 0.0, 0.04
        top = self.dome(b, ex, ey, z, 0.19, ring="team", cap=None)
        b.cyl(ex, ey, top - 0.05, 0.05, 0.09, "wall", seg=6, r2=0.03)
        b.cyl(ex, ey, top, 0.009, 0.9 - top, "dark", seg=4)
        b.box(ex, ey, 0.52, 0.045, 0.045, 0.07, "team")     # the climber
        b.cyl(ex, ey, 0.895, 0.085, 0.02, "wall", seg=8)    # the station
        b.hoop(ex, ey, 0.905, 0.115, 0.085, 0.014, "team", seg=8)
        b.cyl(ex, ey, 0.915, 0.04, 0.045, "trim", seg=6)
        b.cone(ex, ey, 0.96, 0.03, 0.04, "extra", seg=6)
        t = [(-0.34, 0.31, 0.085, 0.6, 0.1), (0.34, 0.31, 0.08, 0.46, 0.0), (-0.37, -0.06, 0.07, 0.33, 0.0),
             (0.37, -0.08, 0.07, 0.4, 0.06)]
        for x, y, r, h, sp in t:
            self.tower(b, x, y, z, r, h, spire=sp)
        self.bridge(b, t[0], t[1], 0.3)
        self.bridge(b, t[0], t[2], 0.2)
        self.bridge(b, t[1], t[3], 0.25)
        for sx in (-1, 1):
            self.dome(b, sx * 0.24, -0.33, z, 0.1)
            self.tree(b, sx * 0.09, -0.26, z)
        b.cyl(0, -0.38, z, 0.075, 0.008, "team", seg=8)     # landing pad

    def city(self, b):
        b.box(0, 0, 0, 0.96, 0.96, 0.02, "stone")
        z = 0.02
        t = [(-0.26, 0.26, 0.095, 0.78, 0.12), (0.12, 0.32, 0.075, 0.54, 0.0), (0.37, 0.02, 0.07, 0.42, 0.0),
             (-0.37, -0.1, 0.065, 0.34, 0.0), (0.04, -0.06, 0.085, 0.62, 0.07)]
        for x, y, r, h, sp in t:
            self.tower(b, x, y, z, r, h, spire=sp)
        self.bridge(b, t[0], t[1], 0.34)
        self.bridge(b, t[1], t[2], 0.27)
        self.bridge(b, t[0], t[4], 0.42)
        self.bridge(b, t[4], t[2], 0.24)
        self.bridge(b, t[3], t[4], 0.2)
        self.dome(b, -0.14, -0.36, z, 0.1)
        self.dome(b, 0.3, -0.31, z, 0.13, ring="team")
        self.dome(b, 0.39, 0.39, z, 0.07)
        b.box(-0.39, -0.38, z, 0.14, 0.16, 0.006, "park")   # a park
        self.tree(b, -0.41, -0.41, z)
        self.tree(b, -0.36, -0.34, z, 0.9)
        self.tree(b, -0.42, 0.42, z)

    def town(self, b):
        b.box(0, 0, 0, 0.9, 0.9, 0.016, "stone")
        z = 0.016
        d = [(-0.2, 0.2, 0.18), (0.25, 0.2, 0.12), (-0.2, -0.24, 0.12)]
        for (x0, y0, _r0), (x1, y1, _r1) in ((d[0], d[1]), (d[0], d[2])):     # walkway tubes
            b.box((x0 + x1) / 2, (y0 + y1) / 2, z, abs(x1 - x0) + 0.04, abs(y1 - y0) + 0.04, 0.035, "wall")
        self.dome(b, *d[0][:2], z, d[0][2], ring="team")
        self.dome(b, *d[1][:2], z, d[1][2])
        self.dome(b, *d[2][:2], z, d[2][2])
        tw = (0.22, -0.2)
        self.tower(b, tw[0], tw[1], z, 0.075, 0.4, spire=0.07)
        self.bridge(b, (0.22, -0.2), (0.25, 0.2), 0.1)
        b.cyl(0.02, -0.02, z, 0.07, 0.008, "team", seg=8)   # landing pad
        self.tree(b, 0.38, -0.38, z)
        self.tree(b, 0.04, -0.38, z, 0.9)
        self.tree(b, -0.4, 0.0, z, 0.9)
        self.pylon(b, 0.4, 0.4, z, 0.12)

    def temple(self, b):
        # a luminous needle through a standing ring, on a round stepped plinth
        z = 0.0
        for i, r in enumerate((0.44, 0.36, 0.28)):
            b.cyl(0, 0, z, r, 0.03, "stone" if i % 2 else "wall", seg=10)
            z += 0.03
        b.hoop(0, 0, z + 0.004, 0.245, 0.19, 0.008, "team", seg=10)
        b.cyl(0, 0, z, 0.085, 0.1, "wall", seg=6, r2=0.055)
        b.cyl(0, 0, z + 0.1, 0.05, 0.7, "extra", seg=6, r2=0.008)          # the needle
        b.hoop(0, 0, z + 0.33, 0.24, 0.185, 0.035, "roof", seg=12, rot=(PI / 2, 0, 0))   # the standing ring
        b.hoop(0, 0, z + 0.33, 0.185, 0.165, 0.045, "extra", seg=12, rot=(PI / 2, 0, 0))
        for sx in (-1, 1):                                  # the ring's feet
            b.box(sx * 0.19, 0, z, 0.07, 0.07, 0.2, "wall")
        b.hoop(0, 0, z + 0.62, 0.1, 0.075, 0.02, "team", seg=8)             # a halo near the tip
        for sx in (-1, 1):
            for sy in (-1, 1):
                self.pylon(b, sx * 0.3, sy * 0.3, 0.03, 0.1)

    def fort(self, b):
        # a shield-dome bunker: an eight-sided blockhouse, the shield dome on its roof, four turrets
        b.box(0, 0, 0, 0.92, 0.92, 0.016, "stone")
        z = 0.016
        b.cyl(0, 0, z, 0.37, 0.12, "wall", seg=8, r2=0.31, rot=(0, 0, PI / 8))
        b.cyl(0, 0, z + 0.055, 0.35, 0.025, "dark", seg=8, r2=0.34, rot=(0, 0, PI / 8))   # the gun slit
        b.box(0, -0.33, z, 0.12, 0.08, 0.08, "wall")        # the door
        b.box(0, -0.372, z, 0.07, 0.006, 0.055, "dark")
        top = self.dome(b, 0, 0, z + 0.12, 0.24, ring="team")
        b.hoop(0, 0, z + 0.26, 0.275, 0.25, 0.016, "extra", seg=8)          # the shield emitter ring
        b.cyl(0, 0, top - 0.01, 0.007, 0.12, "dark", seg=4)
        b.cone(0, 0, top + 0.11, 0.02, 0.045, "extra", seg=4)
        for k in range(4):
            a = PI / 4 + k * PI / 2
            self.turret(b, 0.36 * math.sqrt(2) * math.cos(a), 0.36 * math.sqrt(2) * math.sin(a), z, a)


ARCOLOGY_STYLES = {c.name: c() for c in (Arcology,)}
