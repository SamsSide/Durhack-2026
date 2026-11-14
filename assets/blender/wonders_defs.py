"""The eight wonders (row A30, contract X4 `wonders`): one function per `WonderKind`.

Same kit as the building styles (styles_kit.Builder) with one shared palette, `wonders`. Each model
is a single landmark that fills the 1 x 1 x 1 box and must read from orbit at 60 to 80 px, so every
one is built round one big silhouette (a dome, a triangle, a figure, twin spires, a stepped tower, a
needle, a tether) and two or three colour blocks. Blender is Z-up: x is the long axis where there is
one (the wall, the cathedral's nave), -y is the front.
"""
import math

from mathutils import Vector

from styles_kit import PALETTES

PI = math.pi

PALETTES["wonders"] = dict(
    # ground
    earth="#8F7B55", grass="#7E9A5A", garden="#6E9A58", leaf="#3F6B45", sand="#E3C99A", water="#4F9DB8",
    plaza="#CFC8B8",
    # masonry
    brick="#A59F92", stone="#8E8B85", paving="#C9C2B0", plaster="#E8DCC0", tile="#39484A",
    marble="#F6F2E8", shade="#D9D2C2", limestone="#E6D9B8", sandstone="#C8A26A", slate="#4E5868",
    soviet="#CDBB9C", sovdark="#9A8768",
    # metal and light
    gold="#D4A93A", bronze="#B9803F", bronzed="#7E5528", steel="#4A4F58", flame="#F59A2E", timber="#6A4A30",
    dark="#33292A", window="#2F4454", glass="#7FB6CC", glassd="#3F6F8C",
    # the space elevator (the arcology colours)
    shell="#EEF2EF", teal="#58BDB8", teald="#2A8589", glow="#B4F5EA", panel="#3D5FA8",
)


def limb(b, p0, p1, w, d, mat):
    """A box w x d thick from point p0 to point p1 (arms, legs, flying buttresses, sashes)."""
    v = Vector(p1) - Vector(p0)
    mid = (Vector(p0) + Vector(p1)) / 2
    rot = tuple(v.to_track_quat("Z", "Y").to_euler("XYZ"))
    b.box(mid.x, mid.y, mid.z - v.length / 2, w, d, v.length, mat, rot=rot)


def disc_x(b, x, y, z, r, t, mat, seg=10):
    """An upright disc facing along x (a rose window), centred on (x, y, z)."""
    b.cyl(x, y, z - t / 2, r, t, mat, seg=seg, rot=(0, PI / 2, 0))


def disc_y(b, x, y, z, r, t, mat, seg=10):
    """An upright disc facing along y, centred on (x, y, z)."""
    b.cyl(x, y, z - t / 2, r, t, mat, seg=seg, rot=(PI / 2, 0, 0))


def flag(b, x, y, z, h, w=0.09, fh=0.05, mat="team"):
    b.cyl(x, y, z, 0.006, h, "dark", seg=4)
    b.box(x + w / 2, y, z + h - fh, w, 0.008, fh, mat)


# ---------------------------------------------------------------- great_wall
def great_wall(b):
    """One segment along x across the whole box (x = -0.5 .. 0.5, so segments tile end to end): an
    earth bank, a crenellated wall, a square watchtower in the middle with a guardhouse on top."""
    b.frustum(0, 0, 0, 1.0, 0.58, 1.0, 0.38, 0.09, "earth")
    b.box(0, 0, 0.09, 1.0, 0.38, 0.006, "grass")
    z = 0.096
    b.frustum(0, 0, z, 1.0, 0.22, 1.0, 0.18, 0.26, "brick")
    zt = z + 0.26
    b.box(0, 0, zt, 1.0, 0.14, 0.008, "paving")                 # the walkway
    for sy in (-1, 1):
        b.box(0, sy * 0.08, zt, 1.0, 0.024, 0.03, "brick")      # the parapets
        for k in range(10):
            b.box(-0.45 + k * 0.1, sy * 0.08, zt + 0.03, 0.06, 0.026, 0.04, "brick")
    for sx in (-1, 1):                                          # buttress piers
        b.frustum(sx * 0.32, 0, z, 0.06, 0.3, 0.05, 0.2, 0.24, "stone")
        flag(b, sx * 0.32, 0.0, zt, 0.17, w=0.07 * 1, fh=0.045)
    # the watchtower
    b.frustum(0, 0, z, 0.28, 0.3, 0.24, 0.26, 0.44, "brick")
    b.box(0, 0, zt + 0.004, 0.275, 0.08, 0.085, "dark")         # the walkway doors
    b.box(0, 0, 0.43, 0.05, 0.285, 0.06, "dark")                # windows, front and back
    for sx in (-1, 1):
        b.box(sx * 0.075, 0, 0.44, 0.03, 0.28, 0.045, "dark")
    for sy in (-1, 1):
        b.box(0, sy * 0.146, 0.16, 0.1, 0.014, 0.2, "team")     # the banners
    ztop = z + 0.44
    b.box(0, 0, ztop, 0.29, 0.31, 0.03, "stone")
    ztop += 0.03
    for i in (-1, 0, 1):
        for s in (-1, 1):
            b.box(i * 0.11, s * 0.14, ztop, 0.055, 0.03, 0.045, "brick")
            b.box(s * 0.13, i * 0.12, ztop, 0.03, 0.055, 0.045, "brick")
    b.box(0, 0, ztop, 0.15, 0.17, 0.09, "plaster")              # the guardhouse
    b.box(0, 0, ztop + 0.025, 0.045, 0.18, 0.045, "dark")
    b.frustum(0, 0, ztop + 0.09, 0.25, 0.27, 0.09, 0.0, 0.08, "tile")
    b.box(0, 0, ztop + 0.165, 0.11, 0.02, 0.012, "gold")
    flag(b, 0, 0, ztop + 0.165, 0.12)


# ---------------------------------------------------------------- mausoleum
def mausoleum(b):
    """A white onion dome on a raised plinth, four minarets, a long reflecting pool in front."""
    b.box(0, 0, 0, 0.92, 1.0, 0.016, "garden")
    z = 0.016
    my = 0.2                                                    # the tomb sits at the back
    b.box(0, -0.24, z, 0.19, 0.5, 0.008, "marble")              # the pool and its rim
    b.box(0, -0.24, z, 0.13, 0.46, 0.012, "water")
    for sx in (-1, 1):
        b.box(sx * 0.3, -0.24, z, 0.26, 0.46, 0.004, "grass")   # lawns
        for k in range(5):
            b.cone(sx * 0.135, -0.44 + k * 0.1, z, 0.022, 0.085, "leaf", seg=4)   # cypresses
    b.box(0, my, z, 0.6, 0.58, 0.07, "shade")                   # the plinth
    b.box(0, my, z + 0.07, 0.57, 0.55, 0.008, "marble")
    b.box(0, my - 0.31, z, 0.12, 0.06, 0.04, "shade")           # the steps
    z += 0.078
    b.cyl(0, my, z, 0.215, 0.2, "marble", seg=8, rot=(0, 0, PI / 8))      # the chamfered block
    for k in range(4):                                          # the four great arches (iwans)
        a = k * PI / 2
        with b.at(0, my, a):
            b.box(0, -0.197, z, 0.13, 0.012, 0.2, "marble")
            b.box(0, -0.2, z + 0.015, 0.085, 0.012, 0.14, "window")
            b.frustum(0, -0.2, z + 0.155, 0.085, 0.012, 0.0, 0.012, 0.03, "window")
    b.cyl(0, my, z + 0.165, 0.219, 0.035, "team", seg=8, rot=(0, 0, PI / 8))  # the frieze
    b.cyl(0, my, z + 0.2, 0.226, 0.02, "marble", seg=8, rot=(0, 0, PI / 8))  # the roof terrace
    zr = z + 0.22
    b.cyl(0, my, zr, 0.122, 0.06, "shade", seg=10)             # the drum
    pr = [(0.122, 0), (0.16, 0.05), (0.17, 0.11), (0.15, 0.17), (0.1, 0.225), (0.04, 0.27), (0, 0.31)]
    b.lathe(0, my, zr + 0.06, pr, "marble", seg=10)
    b.cyl(0, my, zr + 0.36, 0.007, 0.07, "gold", seg=4)
    b.cone(0, my, zr + 0.36, 0.02, 0.035, "gold", seg=6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 0.14, my + sy * 0.14                # the four small domes (chhatris)
            b.cyl(cx, cy, zr, 0.036, 0.035, "shade", seg=6)
            b.lathe(cx, cy, zr + 0.035, [(0.044, 0), (0.04, 0.025), (0.02, 0.05), (0, 0.06)], "marble", seg=6)
            mx, m_y = sx * 0.265, my + sy * 0.255               # the minarets
            b.cyl(mx, m_y, z, 0.028, 0.46, "marble", seg=6, r2=0.02)
            b.cyl(mx, m_y, z + 0.15, 0.034, 0.014, "shade", seg=6)
            b.cyl(mx, m_y, z + 0.32, 0.036, 0.02, "team", seg=6)
            b.cyl(mx, m_y, z + 0.46, 0.03, 0.012, "shade", seg=6)
            b.lathe(mx, m_y, z + 0.472, [(0.024, 0), (0.022, 0.02), (0.01, 0.04), (0, 0.055)], "marble", seg=6)


# ---------------------------------------------------------------- pyramid
def pyramid(b):
    """A great pyramid (three steps, then smooth casing, a gold cap), a smaller one, a sphinx."""
    b.box(0, 0, 0, 1.0, 1.0, 0.02, "sand")
    z = 0.02
    gx, gy = -0.13, 0.13
    w = 0.7
    for k in range(3):
        b.box(gx, gy, z, w, w, 0.055, "sandstone")
        z += 0.055
        w -= 0.07
    b.frustum(gx, gy, z, w, w, 0.085, 0.085, 0.5, "limestone")
    b.frustum(gx, gy, z + 0.5, 0.085, 0.085, 0, 0, 0.1, "gold")
    # the entrance, its causeway and banners
    b.box(gx, gy - 0.35, 0.02, 0.1, 0.03, 0.09, "sandstone")
    b.box(gx, gy - 0.368, 0.02, 0.045, 0.006, 0.065, "dark")
    b.box(gx, -0.36, 0.02, 0.07, 0.26, 0.006, "paving")
    for sx in (-1, 1):
        b.box(gx + sx * 0.085, gy - 0.372, 0.03, 0.035, 0.008, 0.11, "team")
        b.obelisk(gx + sx * 0.08, -0.4, 0.02, 0.03, 0.13, mat="limestone", cap="gold", plinth="sandstone")
    # the smaller pyramid
    b.frustum(0.34, 0.3, 0.02, 0.3, 0.3, 0, 0, 0.26, "limestone")
    b.frustum(0.34, 0.3, 0.02, 0.305, 0.305, 0.25, 0.25, 0.048, "sandstone")
    # the sphinx, facing the front
    sx0, sy0, k = 0.28, -0.2, 1.45
    b.box(sx0, sy0, 0.02, 0.2 * k, 0.34 * k, 0.02, "sandstone")
    z = 0.04
    b.box(sx0, sy0 + 0.03 * k, z, 0.09 * k, 0.22 * k, 0.065 * k, "limestone")       # the body
    b.box(sx0, sy0 + 0.12 * k, z, 0.105 * k, 0.07 * k, 0.075 * k, "limestone")      # the haunches
    for s in (-1, 1):
        b.box(sx0 + s * 0.032 * k, sy0 - 0.115 * k, z, 0.028 * k, 0.1 * k, 0.03 * k, "limestone")   # the paws
    b.box(sx0, sy0 - 0.07 * k, z + 0.065 * k, 0.05 * k, 0.05 * k, 0.07 * k, "limestone")            # the head
    b.frustum(sx0, sy0 - 0.06 * k, z + 0.055 * k, 0.115 * k, 0.05 * k, 0.075 * k, 0.06 * k, 0.095 * k, "team")   # the headcloth
    b.box(sx0, sy0 - 0.098 * k, z + 0.08 * k, 0.045 * k, 0.01 * k, 0.045 * k, "limestone")          # the face


# ---------------------------------------------------------------- colossus
def colossus(b):
    """A giant bronze figure astride a harbour mouth: a plinth under each foot, water and a ship
    between, the right arm raised with a torch. `team` on the sash, belt, shield and the ship's sail."""
    b.box(0, 0, 0, 0.98, 0.72, 0.014, "water")
    for sx in (-1, 1):
        b.box(sx * 0.345, 0.02, 0, 0.29, 0.16, 0.065, "stone")          # the moles
        b.box(sx * 0.345, 0.02, 0.065, 0.27, 0.1, 0.006, "paving")
        b.box(sx * 0.44, 0.02, 0, 0.1, 0.5, 0.05, "stone")              # the quays
        b.box(sx * 0.15, 0, 0, 0.16, 0.2, 0.16, "shade")                # the plinths
        b.box(sx * 0.15, 0, 0.16, 0.18, 0.22, 0.016, "marble")
        b.box(sx * 0.15, -0.103, 0.04, 0.07, 0.008, 0.09, "team")
        b.box(sx * 0.15, -0.015, 0.176, 0.075, 0.13, 0.028, "bronzed")  # the feet
        limb(b, (sx * 0.15, 0, 0.19), (sx * 0.05, 0, 0.5), 0.07, 0.075, "bronze")   # the legs
    b.frustum(0, 0, 0.455, 0.215, 0.115, 0.16, 0.095, 0.125, "bronzed")  # the kilt
    b.box(0, 0, 0.575, 0.17, 0.105, 0.024, "team")                      # the belt
    b.frustum(0, 0, 0.595, 0.15, 0.09, 0.215, 0.105, 0.17, "bronze")    # the torso
    limb(b, (-0.1, 0, 0.765), (0.085, 0, 0.6), 0.04, 0.125, "team")     # the sash
    b.box(0, 0, 0.765, 0.055, 0.055, 0.02, "bronze")
    b.box(0, 0, 0.78, 0.08, 0.085, 0.085, "bronze")                     # the head
    b.box(0, 0, 0.848, 0.09, 0.095, 0.016, "gold")                      # the crown and its rays
    for k in range(5):
        t = (k - 2) * 0.55
        h = 0.06
        b.cone(math.sin(t) * (0.04 + h / 2), 0, 0.86 + math.cos(t) * (0.01 + h / 2) - h / 2, 0.009, h,
               "gold", seg=4, rot=(0, t, 0))
    limb(b, (0.105, 0, 0.74), (0.2, 0, 0.9), 0.052, 0.058, "bronze")    # the raised arm
    b.cyl(0.2, 0, 0.88, 0.011, 0.045, "gold", seg=6)                    # the torch
    b.cyl(0.2, 0, 0.92, 0.014, 0.02, "gold", seg=6, r2=0.028)
    b.cone(0.2, 0, 0.94, 0.024, 0.055, "flame", seg=6)
    limb(b, (-0.11, 0, 0.745), (-0.155, -0.02, 0.56), 0.05, 0.055, "bronze")   # the other arm
    disc_y(b, -0.165, -0.06, 0.6, 0.07, 0.016, "team", seg=8)           # the shield
    disc_y(b, -0.165, -0.07, 0.6, 0.025, 0.012, "gold", seg=6)
    # a ship sailing out between the legs
    b.frustum(0, -0.14, 0.014, 0.03, 0.13, 0.05, 0.17, 0.028, "timber")
    b.cyl(0, -0.14, 0.04, 0.005, 0.11, "timber", seg=4)
    b.box(0, -0.146, 0.07, 0.09, 0.006, 0.07, "team")
    # a lighthouse on the far quay
    b.cyl(0.44, 0.2, 0.05, 0.035, 0.17, "marble", seg=6, r2=0.025)
    b.cyl(0.44, 0.2, 0.22, 0.03, 0.012, "stone", seg=6)
    b.cone(0.44, 0.2, 0.232, 0.022, 0.04, "flame", seg=6)
    b.box(-0.44, 0.17, 0.05, 0.08, 0.14, 0.05, "plaster")
    b.gable(-0.44, 0.17, 0.1, 0.14, 0.08, 0.035, "sandstone", rz=PI / 2, over=0.008)


# ---------------------------------------------------------------- cathedral
def cathedral(b):
    """A Gothic cathedral, nave along x, west front at -x: twin towers with spires, a rose window,
    flying buttresses, a transept with a slim spire over the crossing, a round apse."""
    b.box(0, 0, 0, 1.0, 0.62, 0.016, "plaza")
    z = 0.016
    nx, nl, nw, nh = 0.068, 0.66, 0.17, 0.3                              # the nave
    b.box(nx, 0, z, nl, nw, nh, "limestone")
    b.gable(nx, 0, z + nh, nl, nw, 0.15, "slate", over=0.01)
    for sy in (-1, 1):                                                  # the aisles
        b.box(nx, sy * 0.13, z, nl, 0.1, 0.14, "limestone")
        b.frustum(nx, sy * 0.13, z + 0.14, nl + 0.01, 0.11, nl + 0.01, 0.0, 0.06, "slate", oy=-sy * 0.05)
    n = 6
    for k in range(n):                                                  # windows and buttresses
        x = nx - nl / 2 + (k + 0.5) * nl / n
        if k == 4:
            continue                                                    # the transept is here
        b.box(x - nl / n / 2 + 0.008, 0, z + 0.2, 0.05, nw + 0.01, 0.085, "window")
        b.box(x - nl / n / 2 + 0.008, 0, z + 0.03, 0.045, 0.37, 0.075, "window")
        for sy in (-1, 1):
            if k == 0:
                continue
            xb = x - nl / n / 2 - 0.028
            b.box(xb, sy * 0.215, z, 0.03, 0.045, 0.22, "limestone")
            b.cone(xb, sy * 0.215, z + 0.22, 0.026, 0.07, "slate", seg=4, rot=(0, 0, PI / 4))
            limb(b, (xb, sy * 0.2, z + 0.19), (xb, sy * 0.08, z + 0.275), 0.022, 0.026, "limestone")
    tx = nx - nl / 2 + 4.5 * nl / n                                     # the transept
    b.box(tx, 0, z, 0.15, 0.52, nh, "limestone")
    b.gable(tx, 0, z + nh, 0.52, 0.15, 0.15, "slate", rz=PI / 2, over=0.01)
    for sy in (-1, 1):
        disc_y(b, tx, sy * 0.262, z + 0.22, 0.05, 0.012, "team", seg=10)
        b.box(tx, sy * 0.262, z, 0.05, 0.01, 0.1, "dark")
    b.cyl(tx, 0, z + nh + 0.1, 0.035, 0.07, "limestone", seg=6)         # the crossing spire
    b.cone(tx, 0, z + nh + 0.17, 0.04, 0.3, "slate", seg=6)
    ax = nx + nl / 2                                                    # the apse
    b.cyl(ax, 0, z, 0.1, 0.14, "limestone", seg=8)
    b.cone(ax, 0, z + 0.14, 0.105, 0.06, "slate", seg=8)
    b.cyl(ax, 0, z + 0.14, 0.085, 0.16, "limestone", seg=8)
    b.cyl(ax, 0, z + 0.19, 0.088, 0.08, "window", seg=8)
    b.cone(ax, 0, z + nh, 0.09, 0.15, "slate", seg=8)
    wx = nx - nl / 2 - 0.05                                             # the west front
    b.box(wx, 0, z, 0.14, 0.12, 0.4, "limestone")
    b.gable(wx, 0, z + 0.4, 0.14, 0.12, 0.08, "slate", over=0.0)
    disc_x(b, wx - 0.072, 0, z + 0.27, 0.058, 0.014, "team", seg=10)    # the rose window
    b.box(wx - 0.072, 0, z, 0.012, 0.07, 0.13, "dark")                  # the great door
    b.frustum(wx - 0.072, 0, z + 0.13, 0.012, 0.07, 0.012, 0.0, 0.04, "dark")
    for sy in (-1, 1):
        ty = sy * 0.125
        b.box(wx, ty, z, 0.15, 0.14, 0.52, "limestone")                 # the towers
        b.box(wx, ty, z + 0.36, 0.155, 0.05, 0.12, "window")            # the belfry openings
        b.box(wx, ty, z + 0.36, 0.05, 0.145, 0.12, "window")
        b.box(wx - 0.072, ty, z, 0.012, 0.045, 0.08, "dark")
        b.box(wx, ty, z + 0.52, 0.165, 0.155, 0.02, "shade")
        b.frustum(wx, ty, z + 0.54, 0.13, 0.12, 0, 0, 0.4, "slate")     # the spires
        for a in (-1, 1):
            for c in (-1, 1):
                b.cone(wx + a * 0.066, ty + c * 0.06, z + 0.54, 0.02, 0.1, "limestone", seg=4, rot=(0, 0, PI / 4))


# ---------------------------------------------------------------- palace_of_soviets
def palace_of_soviets(b):
    """A huge stepped tower of ribbed drums on a square base with corner pylons, crowned by a
    statue with a raised arm holding a star."""
    b.box(0, 0, 0, 0.96, 0.96, 0.02, "plaza")
    z = 0.02
    b.box(0, 0, z, 0.74, 0.74, 0.11, "soviet")                          # the square base
    b.box(0, 0, z + 0.035, 0.75, 0.75, 0.05, "window")
    b.strips(0, 0, z, 0.74, 0.74, 0.11, 12, "soviet", sw=0.03, proud=0.012)
    b.strips(0, 0, z, 0.74, 0.74, 0.11, 12, "soviet", sw=0.03, proud=0.012, axis="y")
    b.box(0, 0, z + 0.11, 0.78, 0.78, 0.018, "sovdark")
    for sx in (-1, 1):
        for sy in (-1, 1):                                              # the corner pylons
            b.box(sx * 0.37, sy * 0.37, z, 0.13, 0.13, 0.2, "soviet")
            b.box(sx * 0.37, sy * 0.37, z + 0.2, 0.15, 0.15, 0.014, "team")
            b.frustum(sx * 0.37, sy * 0.37, z + 0.214, 0.09, 0.09, 0.03, 0.03, 0.06, "sovdark")
        b.box(sx * 0.2, -0.385, z, 0.05, 0.012, 0.11, "team")           # banners by the entrance
    b.box(0, -0.4, z, 0.2, 0.08, 0.03, "sovdark")                       # the steps
    b.box(0, -0.376, z + 0.01, 0.09, 0.012, 0.085, "dark")
    z += 0.128
    tiers = [(0.31, 0.13, 14), (0.245, 0.12, 12), (0.185, 0.11, 10), (0.13, 0.1, 8), (0.085, 0.075, 8)]
    for r, h, ribs in tiers:
        b.cyl(0, 0, z, r, h, "window", seg=ribs)
        for k in range(ribs):                                           # the columns
            a = 2 * PI * (k + 0.5) / ribs
            b.box(r * 0.985 * math.cos(a), r * 0.985 * math.sin(a), z, r * 0.24, r * 0.16, h, "soviet", rot=(0, 0, a + PI / 2))
        b.cyl(0, 0, z + h - 0.022, r + 0.016, 0.022, "soviet", seg=ribs)
        b.cyl(0, 0, z, r + 0.012, 0.016, "sovdark", seg=ribs)
        z += h
    b.cyl(0, 0, z, 0.07, 0.03, "sovdark", seg=8, r2=0.055)              # the pedestal
    z += 0.03
    b.frustum(0, 0, z, 0.1, 0.07, 0.12, 0.07, 0.17, "steel")            # the statue: coat, head, arms
    b.box(0, 0, z + 0.17, 0.055, 0.055, 0.06, "steel")
    limb(b, (0.05, 0, z + 0.15), (0.13, -0.01, z + 0.235), 0.036, 0.036, "steel")
    limb(b, (-0.055, 0, z + 0.155), (-0.075, 0, z + 0.04), 0.034, 0.036, "steel")
    b.star(0.14, -0.015, z + 0.24, 0.042, "team", depth=0.016)
    b.star(0, -0.392, 0.21, 0.05, "team", depth=0.014)                  # the star over the entrance


# ---------------------------------------------------------------- skyscraper
def skyscraper(b):
    """One supertall glass tower with setbacks and a spire, beside two shorter towers."""
    b.box(0, 0, 0, 0.84, 0.84, 0.02, "plaza")
    z = 0.02
    b.box(0, 0.0, z, 0.74, 0.1, 0.004, "slate")                         # the avenue
    tx, ty = 0.02, 0.17
    b.box(tx, ty, z, 0.4, 0.34, 0.05, "shade")                          # the podium
    b.box(tx, ty, z + 0.014, 0.405, 0.345, 0.022, "window")
    z0 = z + 0.05
    for w, h, n in ((0.27, 0.3, 5), (0.21, 0.23, 4), (0.15, 0.17, 3)):
        b.frustum(tx, ty, z0, w, w, w * 0.9, w * 0.9, h, "glass")
        for s in (-1, 1):                                               # corner fins, ribs running up
            for c in (-1, 1):
                limb(b, (tx + s * w / 2, ty + c * w / 2, z0), (tx + s * w * 0.45, ty + c * w * 0.45, z0 + h),
                     0.022, 0.022, "shell")
        for k in range(1, n):                                           # mullions
            f = -0.5 + k / n
            for face in range(4):
                a = face * PI / 2
                ca, sa = math.cos(a), math.sin(a)
                p0 = (tx + (f * w) * ca + (w / 2) * sa, ty + (f * w) * sa - (w / 2) * ca, z0)
                p1 = (tx + (f * w * 0.9) * ca + (w * 0.45) * sa, ty + (f * w * 0.9) * sa - (w * 0.45) * ca, z0 + h)
                limb(b, p0, p1, 0.012, 0.012, "glassd")
        b.box(tx, ty, z0 + h, w * 0.9 + 0.02, w * 0.9 + 0.02, 0.018, "team")   # the crown strip
        z0 += h + 0.018
    b.frustum(tx, ty, z0, 0.1, 0.1, 0.03, 0.03, 0.09, "glass")
    b.cyl(tx, ty, z0 + 0.09, 0.012, 0.03, "shell", seg=6)
    b.cyl(tx, ty, z0 + 0.09, 0.006, 0.08, "shell", seg=4)                # the spire
    # the slab tower
    ax, ay = -0.27, -0.22
    b.box(ax, ay, z, 0.17, 0.2, 0.44, "glassd")
    b.strips(ax, ay, z, 0.17, 0.2, 0.44, 4, "shell", sw=0.014)
    b.strips(ax, ay, z, 0.2, 0.17, 0.44, 4, "shell", sw=0.014, axis="y")
    b.box(ax, ay, z + 0.44, 0.19, 0.22, 0.02, "team")
    b.box(ax, ay, z + 0.46, 0.1, 0.12, 0.03, "shade")
    b.cyl(ax + 0.02, ay, z + 0.49, 0.005, 0.08, "dark", seg=4)
    # the round tower
    rx, ry = 0.28, -0.22
    b.cyl(rx, ry, z, 0.095, 0.56, "glass", seg=8)
    for k in range(5):
        b.cyl(rx, ry, z + 0.06 + k * 0.105, 0.099, 0.03, "glassd", seg=8)
    b.cyl(rx, ry, z + 0.56, 0.103, 0.02, "team", seg=8)
    b.cone(rx, ry, z + 0.58, 0.085, 0.09, "shell", seg=8)
    for x, y in ((-0.02, -0.3), (0.08, -0.33), (-0.37, 0.25), (-0.33, 0.36), (0.37, 0.36)):
        b.cone(x, y, z, 0.035, 0.08, "leaf", seg=5)                     # street trees


# ---------------------------------------------------------------- space_elevator
def space_elevator(b):
    """A ring-shaped ground station round an anchor dome, a tether to the top of the box with two
    climbers, a counterweight station with solar wings near the top."""
    b.cyl(0, 0, 0, 0.49, 0.02, "plaza", seg=12)
    z = 0.02
    b.hoop(0, 0, z + 0.045, 0.46, 0.34, 0.09, "shell", seg=12)          # the ring station
    b.hoop(0, 0, z + 0.05, 0.467, 0.333, 0.03, "teal", seg=12)
    b.hoop(0, 0, z + 0.094, 0.44, 0.36, 0.01, "team", seg=12)
    for k in range(4):                                                  # spokes and gate towers
        a = PI / 4 + k * PI / 2
        ca, sa = math.cos(a), math.sin(a)
        limb(b, (0.36 * ca, 0.36 * sa, z + 0.06), (0.13 * ca, 0.13 * sa, z + 0.11), 0.045, 0.03, "shell")
        b.cyl(0.4 * ca, 0.4 * sa, z, 0.045, 0.2, "shell", seg=6, r2=0.03)
        b.cyl(0.4 * ca, 0.4 * sa, z + 0.12, 0.042, 0.04, "teal", seg=6, r2=0.037)
        b.cone(0.4 * ca, 0.4 * sa, z + 0.2, 0.026, 0.05, "glow", seg=6)
        b.cyl(0.24 * math.cos(a + PI / 4), 0.24 * math.sin(a + PI / 4), z, 0.05, 0.006, "glow", seg=6)
    b.cyl(0, 0, z, 0.2, 0.035, "shell", seg=10)                         # the anchor dome
    b.cyl(0, 0, z + 0.035, 0.19, 0.014, "team", seg=10)
    pr = [(0.18, 0), (0.158, 0.085), (0.09, 0.155), (0, 0.18)]
    b.lathe(0, 0, z + 0.049, pr, "teal", seg=10)
    b.cyl(0, 0, z + 0.19, 0.055, 0.08, "shell", seg=6, r2=0.028)
    b.cyl(0, 0, z + 0.26, 0.012, 0.6, "window", seg=4)                  # the tether
    b.box(0, 0, 0.4, 0.055, 0.055, 0.075, "team")                       # the climbers
    b.box(0, 0, 0.415, 0.06, 0.06, 0.02, "glow")
    b.box(0, 0, 0.62, 0.05, 0.05, 0.06, "team")
    b.hoop(0, 0, 0.54, 0.075, 0.05, 0.016, "shell", seg=8)              # a way station
    # the counterweight station
    zs = 0.86
    b.cyl(0, 0, zs - 0.035, 0.03, 0.035, "shell", seg=6, r2=0.07)
    b.cyl(0, 0, zs, 0.11, 0.03, "shell", seg=10)
    b.cyl(0, 0, zs + 0.008, 0.114, 0.012, "teald", seg=10)
    b.hoop(0, 0, zs + 0.015, 0.205, 0.155, 0.022, "team", seg=12)
    for k in range(4):
        a = k * PI / 2
        b.box(0.13 * math.cos(a), 0.13 * math.sin(a), zs + 0.008, 0.07, 0.02, 0.012, "shell", rot=(0, 0, a))
    for sx in (-1, 1):                                                  # the solar wings
        b.box(sx * 0.33, 0, zs + 0.01, 0.24, 0.085, 0.008, "panel")
        b.box(sx * 0.33, 0, zs + 0.012, 0.008, 0.09, 0.008, "shell")
        b.box(sx * 0.215, 0, zs + 0.01, 0.03, 0.012, 0.01, "shell")
    b.cyl(0, 0, zs + 0.03, 0.06, 0.045, "teal", seg=8, r2=0.045)
    b.cone(0, 0, zs + 0.075, 0.04, 0.06, "glow", seg=8)


KINDS = ["great_wall", "mausoleum", "pyramid", "colossus", "cathedral", "palace_of_soviets", "skyscraper",
         "space_elevator"]
WONDERS = {k: globals()[k] for k in KINDS}
# share of a tile's width (X4): lane b draws a wonder about 2 tiles wide; the wall is one border segment
FOOTPRINT = {"great_wall": 1.0, "mausoleum": 2.0, "pyramid": 2.0, "colossus": 2.0, "cathedral": 2.0,
             "palace_of_soviets": 2.0, "skyscraper": 1.6, "space_elevator": 1.6}
# preview only: the turn (degrees) that shows each model's best side
PREVIEW_TURN = {"great_wall": 24, "cathedral": 52, "colossus": 12, "skyscraper": 10}
