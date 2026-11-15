"""The remodelled base models (contract X4 `models`): farm, camp, factory, ruin.

Built on the styles Builder (styles_kit.py), which gives every face its material when the piece is
made, with one palette, `base`: the first-day warm palette plus a few tones for soil, hide, brick
and soot. `build_base.py` builds only these four; `build_models.py` calls the same functions, so a
full rebuild gives the same models.

Blender is Z-up: a model stands on z = 0 inside x, y in -0.5..0.5 and z in 0..1; -y is the front.
Each model has one `team` part that shows from above (a roof, tent bands, an awning, a banner).
"""
import math

from mathutils import Vector

from styles_kit import PALETTES, Builder

PI = math.pi
KEYS = ["farm", "camp", "factory", "ruin"]

PALETTES["base"] = dict(
    # the first-day palette (build_models.py)
    stone="#A89E8A", plaster="#E6D6B3", timber="#734D2E", thatch="#C7A352", terracotta="#B8613D",
    field="#809E4D", wheat="#D1B85C", leaf="#4D7845", dark="#3D332E", steel="#9499A3",
    # farm
    soil="#8C6B48", furrow="#6B4F35", wheat_light="#E3CF82", grass="#93A860", barn="#8E4A34",
    wood="#A8825A", fruit="#C8553A",
    # camp
    hide="#D2B48A", hide_dark="#A98660", ember="#F08A2E", earth="#9A8262",
    # factory
    brick="#A9583C", brick_dark="#8A4530", glass="#7FA6B8", coal="#2C2828", yard="#8F8676", slate="#5A5F66",
    # ruin
    stone_dark="#7F7667", paving="#C2B8A2", char="#2E2622", moss="#6F8A4A",
)

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


# ---------------------------------------------------------------- shared pieces
def limb(b, p0, p1, w, d, mat):
    """A box w x d thick from point p0 to point p1 (poles, rails, beams, pipes)."""
    v = Vector(p1) - Vector(p0)
    mid = (Vector(p0) + Vector(p1)) / 2
    rot = tuple(v.to_track_quat("Z", "Y").to_euler("XYZ"))
    b.box(mid.x, mid.y, mid.z - v.length / 2, w, d, v.length, mat, rot=rot)


def prism(b, pts, t, mat, x=0.0, y=0.0, z=0.0, rz=0.0):
    """An outline in the upright local x-z plane (pts = [(x, z), ...], any order round the shape),
    t thick along local y: jagged walls, torn banners, hides, gable ends."""
    m = b._m(x, y, z, (0, 0, rz))
    f = [(u, -t / 2, w) for u, w in pts]
    k = [(u, t / 2, w) for u, w in pts]
    faces = [f, list(reversed(k))]
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        faces.append([f[j], f[i], k[i], k[j]])
    b._poly(faces, m, mat)


def jagwall(b, p0, p1, tops, t, mat, z=0.0):
    """A broken wall from p0 to p1 (x, y); tops = [(share of the length, height), ...] is its
    jagged top edge from p0 to p1."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    pts = [(0, 0), (L, 0)] + [(s * L, h) for s, h in reversed(tops)]
    prism(b, pts, t, mat, x=p0[0], y=p0[1], z=z, rz=math.atan2(dy, dx))


def blockwall(b, p0, p1, heights, t, mats=("stone", "paving", "stone_dark"), seed=0):
    """A broken masonry wall from p0 to p1 (x, y): one block per height, stepping down where it
    broke, with a loose stone left on some of the steps."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    w = L / len(heights)
    with b.at(p0[0], p0[1], math.atan2(dy, dx)):
        for i, h in enumerate(heights):
            j = hsh(i, seed)
            b.box((i + 0.5) * w, 0, 0, w + 0.002, t * (0.94 + 0.12 * j), h, mats[i % 2] if j < 0.8 else mats[2])
            if j > 0.62 and h > 0.09:
                b.box((i + 0.3) * w, 0, h, w * 0.45, t * 0.7, 0.022, mats[2], rot=(0, 0.3 * (j - 0.7), 0.3))


def blob(b, x, y, z, r, mat, seed=0, sq=(1, 1, 1), jit=0.18):
    """A faceted clump (a jittered icosahedron, 20 triangles): tree crowns, bushes, boulders."""
    pts = []
    for i, d in enumerate(ICO_V):
        k = r * (1 + jit * (hsh(i, seed) * 2 - 1))
        pts.append((d.x * k * sq[0], d.y * k * sq[1], d.z * k * sq[2]))
    b._poly([[pts[i] for i in f] for f in ICO_F], b._m(x, y, z, (0, 0, hsh(seed, 3) * 6.28)), mat)


def roof(b, x, y, z0, w, d, h, mat, rz=0.0, over=0.02, knee=None):
    """A pitched roof with its ridge along local y. knee=(share of the half width, share of the
    height) makes it a gambrel (barn) roof."""
    a, e = w / 2 + over, d / 2 + over
    prof = [(-a, 0)] + ([(-a * knee[0], h * knee[1])] if knee else []) + [(0, h)]
    prof += ([(a * knee[0], h * knee[1])] if knee else []) + [(a, 0)]
    m = b._m(x, y, z0, (0, 0, rz))
    f = [(u, -e, w_) for u, w_ in prof]
    k = [(u, e, w_) for u, w_ in prof]
    faces = [list(reversed(f)), k, [f[0], f[-1], k[-1], k[0]]]
    for i in range(len(prof) - 1):
        faces.append([f[i], f[i + 1], k[i + 1], k[i]])
    b._poly(faces, m, mat)


def wheel(b, x, y, zc, r, t, mat="dark", seg=8, hub=None):
    """An upright wheel on an axle along y, centred on (x, y, zc)."""
    b.cyl(x, y, zc - t / 2, r, t, mat, seg=seg, rot=(PI / 2, 0, 0))
    if hub:
        b.cyl(x, y, zc - (t + 0.008) / 2, r * 0.42, t + 0.008, hub, seg=6, rot=(PI / 2, 0, 0))


def fence(b, pts, h=0.085, post=0.016, mat="wood", gap=0.16):
    """A post-and-rail fence along the points [(x, y), ...]."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, round(math.hypot(x1 - x0, y1 - y0) / gap))
        for i in range(n):
            t = i / n
            b.box(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0, post, post, h, mat)
        limb(b, (x0, y0, h * 0.62), (x1, y1, h * 0.62), 0.008, 0.03, mat)
    b.box(pts[-1][0], pts[-1][1], 0, post, post, h, mat)


def crate(b, x, y, z, s, rz=0.0, mat="wood", band="timber"):
    b.box(x, y, z, s, s, s * 0.8, mat, rot=(0, 0, rz))
    if band:
        b.box(x, y, z + s * 0.3, s * 1.04, s * 1.04, s * 0.14, band, rot=(0, 0, rz))


def tuft(b, x, y, z=0.0, s=1.0, mat="leaf", seed=0):
    """A weed: three thin blades leaning apart."""
    for i in range(3):
        a = hsh(seed, i) * 6.28
        d = 0.018 * s
        b.cone(x + math.cos(a) * d, y + math.sin(a) * d, z, 0.014 * s, (0.07 + 0.04 * hsh(seed, i + 5)) * s, mat,
               seg=3, rot=(math.sin(a) * 0.35, -math.cos(a) * 0.35, a))


# ---------------------------------------------------------------- farm
def fruit_tree(b, x, y, s=1.0, seed=0):
    b.cyl(x, y, 0, 0.014 * s, 0.09 * s, "timber", seg=5, r2=0.01 * s)
    blob(b, x, y, 0.14 * s, 0.075 * s, "leaf" if seed % 2 else "field", seed=seed, sq=(1, 1, 0.85))
    a = hsh(seed, 20) * 6.28
    b.box(x + math.cos(a) * 0.068 * s, y + math.sin(a) * 0.068 * s, 0.12 * s, 0.018, 0.018, 0.018, "fruit")


def haystack(b, x, y, r, h, seed=0):
    b.lathe(x, y, 0, [(r, 0), (r * 1.02, h * 0.4), (r * 0.62, h * 0.82), (0, h)], "thatch", seg=6, rz=hsh(seed) * 3)


def farm(b):
    """A barn with a `team` gambrel roof, a silo, a fenced yard with haystacks and a cart, and
    three fields (green rows, ploughed soil, two-tone wheat) under an orchard row."""
    # the fields: x -0.5..0.0
    b.box(-0.25, -0.375, 0, 0.5, 0.25, 0.016, "field")
    for i in range(5):                                                  # rows of greens
        b.box(-0.25, -0.475 + i * 0.05, 0.016, 0.46, 0.022, 0.018, "leaf")
    b.box(-0.25, -0.115, 0, 0.5, 0.25, 0.016, "soil")
    for i in range(6):                                                  # ploughed ridges
        b.gable(-0.25, -0.22 + i * 0.042, 0.016, 0.47, 0.02, 0.014, "furrow", over=0.0)
    b.box(-0.25, 0.19, 0, 0.5, 0.34, 0.03, "wheat")
    for i in range(7):                                                  # standing wheat, two tones
        b.box(-0.25, 0.04 + i * 0.05, 0.03, 0.48, 0.03, 0.03 + 0.012 * (i % 2), "wheat_light" if i % 2 else "wheat")
    b.box(-0.25, 0.44, 0, 0.5, 0.12, 0.012, "grass")
    for i, x in enumerate((-0.43, -0.31, -0.19, -0.07)):                # the orchard row
        fruit_tree(b, x, 0.44 + 0.012 * (i % 2), 0.95 + 0.15 * hsh(i, 4), seed=i * 3)

    # the barn: ridge along y, doors to the front
    bx, by, bw, bd, bh = 0.27, 0.2, 0.3, 0.42, 0.2
    b.box(bx, by, 0, bw + 0.02, bd + 0.02, 0.035, "stone")
    b.box(bx, by, 0.035, bw, bd, bh - 0.035, "barn")
    prism(b, [(-bw / 2, 0), (bw / 2, 0), (bw / 2 * 0.62, 0.105), (0, 0.17), (-bw / 2 * 0.62, 0.105)], bd, "barn",
          x=bx, y=by, z=bh)                                              # the gable ends, under the roof
    roof(b, bx, by, bh, bw, bd, 0.17, "team", over=0.03, knee=(0.62, 0.62))
    roof(b, bx, by, bh + 0.172, 0.05, bd + 0.07, 0.012, "plaster", over=0.0)   # ridge cap
    fy = by - bd / 2
    b.box(bx, fy - 0.004, 0.035, 0.13, 0.012, 0.13, "timber")           # double door
    b.box(bx, fy - 0.011, 0.035, 0.008, 0.006, 0.13, "plaster")
    for sx in (-1, 1):
        limb(b, (bx + sx * 0.008, fy - 0.011, 0.045), (bx + sx * 0.06, fy - 0.011, 0.155), 0.008, 0.005, "plaster")
    b.box(bx, fy - 0.008, 0.165, 0.15, 0.012, 0.012, "plaster")
    b.box(bx, fy - 0.004, 0.225, 0.06, 0.012, 0.06, "dark")             # hayloft door
    b.box(bx, fy - 0.03, 0.2, 0.05, 0.05, 0.022, "thatch")              # hay on the loft sill
    for k in range(3):                                                  # side windows
        b.box(bx - bw / 2 - 0.003, by - 0.12 + k * 0.12, 0.1, 0.008, 0.045, 0.045, "dark")
    b.box(bx, by + bd / 2 + 0.004, 0.035, 0.09, 0.012, 0.11, "timber")  # back door
    b.box(bx, by + bd / 2 + 0.004, 0.225, 0.05, 0.012, 0.05, "dark")
    # the silo
    sx_, sy_ = 0.43, -0.085
    b.lathe(sx_, sy_, 0, [(0.07, 0), (0.07, 0.36)], "plaster", seg=8)
    for z in (0.18,):
        b.lathe(sx_, sy_, z, [(0.074, 0), (0.074, 0.016)], "timber", seg=8)
    b.lathe(sx_, sy_, 0.36, [(0.08, 0), (0.05, 0.05), (0, 0.075)], "terracotta", seg=8)

    # the yard: fence, haystacks, cart, trough
    fence(b, [(0.19, -0.2), (0.05, -0.2), (0.05, -0.48), (0.48, -0.48), (0.48, -0.2), (0.33, -0.2)])
    haystack(b, 0.14, -0.29, 0.065, 0.11, seed=1)
    haystack(b, 0.12, -0.41, 0.05, 0.085, seed=2)
    with b.at(0.34, -0.36, 0.35):                                       # the cart, loaded with hay
        b.box(0, 0, 0.045, 0.16, 0.085, 0.012, "timber")
        for s in (-1, 1):
            wheel(b, -0.02, s * 0.055, 0.04, 0.04, 0.012)
        b.box(-0.01, 0, 0.057, 0.12, 0.07, 0.045, "thatch")
        limb(b, (0.08, 0.02, 0.05), (0.17, 0.02, 0.02), 0.008, 0.008, "timber")
        limb(b, (0.08, -0.02, 0.05), (0.17, -0.02, 0.02), 0.008, 0.008, "timber")
    b.box(0.42, -0.25, 0, 0.09, 0.035, 0.03, "timber")                  # trough
    b.box(0.42, -0.25, 0.03, 0.075, 0.022, 0.004, "glass")
    b.box(0.13, 0.02, 0, 0.05, 0.035, 0.035, "thatch", rot=(0, 0, 0.3))  # bales by the barn
    b.box(0.13, 0.065, 0, 0.05, 0.035, 0.035, "thatch", rot=(0, 0, -0.1))


# ---------------------------------------------------------------- camp
def tent(b, x, y, r, h, rz=0.0, seed=0, band=True):
    """A hide tent: a cone with its poles out of the top, a door and a `team` band."""
    with b.at(x, y, rz):
        b.lathe(0, 0, 0, [(r, 0), (r * 0.1, h)], "hide", seg=7, rz=0.22)
        if band:
            b.lathe(0, 0, h * 0.34, [(r * 0.72, 0), (r * 0.5, h * 0.24)], "team", seg=7, rz=0.22)
        b.lathe(0, 0, h * 0.86, [(r * 0.25, 0), (r * 0.11, h * 0.15)], "hide_dark", seg=7, rz=0.22)
        b.lathe(0, 0, 0, [(r * 1.03, 0), (r * 0.94, h * 0.07)], "hide_dark", seg=7, rz=0.22)
        for i in range(3):
            a = i * 2.1 + seed
            limb(b, (-math.cos(a) * r * 0.1, -math.sin(a) * r * 0.1, h * 0.86),
                 (math.cos(a) * r * 0.24, math.sin(a) * r * 0.24, h * 1.2), 0.009, 0.009, "timber")
        # the door: a dark wedge in the front (-y) with a flap folded back
        b.frustum(0, -r * 0.94, 0, r * 0.42, 0.016, 0, 0.016, h * 0.45, "dark", oy=r * 0.34)
        limb(b, (-r * 0.3, -r * 0.99, 0.0), (-r * 0.04, -r * 0.63, h * 0.47), 0.012, 0.035, "hide_dark")


def camp(b):
    """Three hide tents with `team` bands round a fire, a drying rack, a palisade arc behind and a
    `team` banner."""
    b.cyl(0, 0, 0, 0.5, 0.012, "earth", seg=10)                          # trodden ground
    tent(b, -0.2, 0.14, 0.2, 0.44, rz=-0.5, seed=0)
    tent(b, 0.22, 0.2, 0.155, 0.33, rz=0.6, seed=1)
    tent(b, -0.3, -0.22, 0.115, 0.24, rz=-1.2, seed=2)
    # the palisade arc behind the tents
    for i in range(11):
        a = math.radians(22 + i * 13.6)
        hgt = 0.2 + 0.05 * hsh(i, 7)
        b.lathe(math.cos(a) * 0.46, math.sin(a) * 0.46, 0, [(0.026, 0), (0.024, hgt), (0, hgt + 0.045)],
                "timber" if i % 3 else "wood", seg=5, rz=hsh(i, 8) * 2)
    for i in range(5):                                                  # the binding rail
        a0, a1 = math.radians(22 + i * 27.2), math.radians(22 + (i + 1) * 27.2)
        limb(b, (math.cos(a0) * 0.435, math.sin(a0) * 0.44, 0.13), (math.cos(a1) * 0.44, math.sin(a1) * 0.44, 0.13),
             0.012, 0.012, "hide_dark")
    # the fire: a ring of stones, crossed logs, embers
    fx, fy = 0.06, -0.17
    for i in range(6):
        a = i * 6.283 / 6
        b.box(fx + math.cos(a) * 0.075, fy + math.sin(a) * 0.075, 0.01, 0.036, 0.03, 0.026, "stone", rot=(0.2 * hsh(i), 0.1, a))
    for i in range(3):
        a = i * 2.09 + 0.4
        limb(b, (fx + math.cos(a) * 0.055, fy + math.sin(a) * 0.055, 0.02), (fx - math.cos(a) * 0.02, fy - math.sin(a) * 0.02, 0.075),
             0.018, 0.018, "timber")
    b.cone(fx, fy, 0.012, 0.036, 0.09, "ember", seg=5)
    b.cyl(fx - 0.15, fy - 0.07, 0.012 - 0.0, 0.022, 0.13, "timber", seg=6, rot=(PI / 2, 0, 0.5))   # a log seat
    # the drying rack with hides
    with b.at(0.31, -0.2, 1.1):
        for s in (-1, 1):
            limb(b, (s * 0.1, -0.04, 0), (s * 0.1, 0.005, 0.17), 0.01, 0.01, "timber")
            limb(b, (s * 0.1, 0.04, 0), (s * 0.1, -0.005, 0.17), 0.01, 0.01, "timber")
        limb(b, (-0.125, 0, 0.16), (0.125, 0, 0.16), 0.01, 0.01, "timber")
        prism(b, [(-0.08, 0.155), (-0.02, 0.155), (-0.015, 0.07), (-0.05, 0.05), (-0.085, 0.075)], 0.008, "hide")
        prism(b, [(0.01, 0.155), (0.075, 0.155), (0.08, 0.09), (0.045, 0.06), (0.012, 0.085)], 0.008, "hide_dark")
    # the banner
    px, py = 0.05, -0.4
    b.cyl(px, py, 0, 0.011, 0.5, "timber", seg=5)
    b.box(px + 0.05, py, 0.47, 0.13, 0.012, 0.012, "timber")
    prism(b, [(-0.01, 0.47), (0.11, 0.47), (0.11, 0.31), (0.05, 0.345), (-0.01, 0.31)], 0.01, "team", x=px, y=py)
    b.cone(px, py, 0.5, 0.02, 0.04, "hide_dark", seg=4)
    # bundles and a basket
    b.box(-0.07, -0.36, 0.012, 0.07, 0.05, 0.04, "hide_dark", rot=(0, 0, 0.4))
    b.box(-0.085, -0.355, 0.052, 0.05, 0.04, 0.03, "hide", rot=(0, 0, 0.1))
    b.lathe(0.36, -0.03, 0.012, [(0.022, 0), (0.032, 0.035), (0.024, 0.05)], "thatch", seg=6)


# ---------------------------------------------------------------- factory
def stack(b, x, y, h, r0, r1, plinth=0.06):
    """A tapered brick chimney on a stone plinth, with a pale band and a sooty rim."""
    b.box(x, y, 0, r0 * 2.5, r0 * 2.5, plinth, "stone")
    b.lathe(x, y, plinth, [(r0, 0), (r1, h - plinth)], "brick", seg=8)
    b.lathe(x, y, h - 0.1, [(r1 * 1.22, 0), (r1 * 1.22, 0.03)], "plaster", seg=8)
    b.lathe(x, y, h - 0.03, [(r1 * 1.2, 0), (r1 * 1.25, 0.03)], "coal", seg=8)


def factory(b):
    """A brick mill with a saw-tooth `team` roof and glass lights, a boiler house with two chimneys
    of different heights, a water tank on legs, pipes, a coal heap and a loading dock with crates."""
    b.box(0, 0, 0, 0.98, 0.98, 0.012, "yard")
    # the mill
    mx, my, mw, md, mh = -0.15, 0.1, 0.6, 0.4, 0.22
    b.box(mx, my, 0, mw + 0.015, md + 0.015, 0.04, "stone")
    b.box(mx, my, 0.04, mw, md, mh - 0.04, "brick")
    b.box(mx, my, mh, mw + 0.02, md + 0.02, 0.016, "plaster")          # cornice
    tw = mw / 4
    for k in range(4):                                                  # saw-tooth roof: glass faces +x
        tx = mx - mw / 2 + tw * (k + 0.5)
        b.shed(tx, my, mh + 0.016, md, tw, 0.11, "team", rz=-PI / 2)
        b.box(tx + tw / 2 + 0.001, my, mh + 0.03, 0.008, md * 0.88, 0.068, "glass")
    fy = my - md / 2
    for k in range(5):                                                  # front windows and piers
        wx = mx - 0.24 + k * 0.12
        if k != 2:
            b.box(wx, fy - 0.002, 0.095, 0.06, 0.008, 0.085, "glass")
            b.box(wx, fy - 0.004, 0.085, 0.07, 0.012, 0.012, "plaster")
    for k in range(6):
        b.box(mx - 0.3 + k * 0.12, fy - 0.004, 0.04, 0.022, 0.012, mh - 0.04, "brick_dark")
    for k in range(3):                                                  # windows on the left side
        b.box(mx - mw / 2 - 0.002, my - 0.12 + k * 0.12, 0.095, 0.008, 0.06, 0.085, "glass")
    for k in range(4):                                                  # and along the back
        b.box(mx - 0.21 + k * 0.14, my + md / 2 + 0.002, 0.095, 0.07, 0.008, 0.085, "glass")
    # the loading dock: platform, `team` awning on posts, big door, crates and a barrel
    b.box(mx, fy - 0.07, 0, 0.26, 0.13, 0.045, "stone")
    b.box(mx, fy - 0.003, 0.045, 0.1, 0.01, 0.13, "dark")
    b.shed(mx, fy - 0.065, 0.185, 0.3, 0.14, 0.035, "team", rz=PI, h0=0.0)
    for s in (-1, 1):
        b.box(mx + s * 0.135, fy - 0.125, 0.045, 0.012, 0.012, 0.142, "timber")
    crate(b, mx - 0.085, fy - 0.08, 0.045, 0.06, rz=0.2)
    crate(b, mx - 0.07, fy - 0.085, 0.093, 0.045, rz=-0.3, mat="thatch", band=None)
    crate(b, mx + 0.09, fy - 0.09, 0.045, 0.05, rz=-0.15)
    crate(b, mx - 0.2, fy - 0.11, 0.012, 0.065, rz=0.5)
    crate(b, mx + 0.21, fy - 0.06, 0.012, 0.055, rz=0.1, band=None)
    b.cyl(mx + 0.2, fy - 0.14, 0.012, 0.024, 0.06, "timber", seg=7)
    # the boiler house and the two chimneys
    hx, hy = 0.3, 0.16
    b.box(hx, hy, 0, 0.26, 0.3, 0.04, "stone")
    b.box(hx, hy, 0.04, 0.25, 0.29, 0.3, "brick_dark")
    b.box(hx, hy, 0.34, 0.27, 0.31, 0.018, "plaster")
    roof(b, hx, hy, 0.358, 0.25, 0.29, 0.07, "slate", over=0.012)
    b.box(hx, hy - 0.147, 0.04, 0.09, 0.008, 0.13, "dark")              # furnace door, glowing
    b.box(hx, hy - 0.151, 0.05, 0.06, 0.006, 0.05, "ember")
    b.box(hx, hy - 0.147, 0.22, 0.12, 0.008, 0.06, "glass")
    b.box(hx + 0.127, hy, 0.2, 0.008, 0.16, 0.07, "glass")
    stack(b, 0.39, 0.4, 0.97, 0.065, 0.04)
    stack(b, 0.21, 0.41, 0.7, 0.055, 0.036)
    limb(b, (0.39, 0.4, 0.2), (0.39, 0.3, 0.2), 0.03, 0.03, "steel")    # flues into the stacks
    limb(b, (0.21, 0.41, 0.17), (0.21, 0.3, 0.17), 0.03, 0.03, "steel")
    # the coal heap in its bunker, with a barrow
    b.hill(0.32, -0.16, 0.115, 0.1, mat="coal", seg=7, top=0.22, mid=0.72, seed=3)
    b.box(0.46, -0.16, 0, 0.02, 0.26, 0.07, "timber")
    b.box(0.34, -0.29, 0, 0.26, 0.02, 0.07, "timber")
    b.box(0.2, -0.3, 0.02, 0.07, 0.045, 0.03, "steel", rot=(0, 0, 0.5))
    b.box(0.2, -0.3, 0.05, 0.05, 0.03, 0.012, "coal", rot=(0, 0, 0.5))
    # the water tank on legs, and the pipes
    tx, ty = -0.36, -0.33
    for sx in (-1, 1):
        for sy in (-1, 1):
            limb(b, (tx + sx * 0.07, ty + sy * 0.07, 0), (tx + sx * 0.05, ty + sy * 0.05, 0.2), 0.014, 0.014, "timber")
    b.box(tx, ty, 0.2, 0.15, 0.15, 0.014, "timber")
    b.lathe(tx, ty, 0.214, [(0.075, 0), (0.082, 0.13)], "wood", seg=8)
    for z in (0.27,):
        b.lathe(tx, ty, z, [(0.084, 0), (0.086, 0.014)], "slate", seg=8)
    b.lathe(tx, ty, 0.344, [(0.092, 0), (0, 0.06)], "slate", seg=8)
    limb(b, (tx + 0.02, ty + 0.02, 0.214), (tx + 0.02, ty + 0.02, 0.1), 0.02, 0.02, "steel")
    limb(b, (tx + 0.02, ty + 0.02, 0.105), (tx + 0.02, fy + 0.0, 0.105), 0.02, 0.02, "steel")
    limb(b, (mx + mw / 2, my - 0.1, 0.17), (hx - 0.12, my - 0.1, 0.17), 0.024, 0.024, "steel")   # mill to boiler
    limb(b, (mx + mw / 2 + 0.04, my + 0.12, 0.012), (mx + mw / 2 + 0.04, my + 0.12, 0.17), 0.02, 0.02, "steel")


# ---------------------------------------------------------------- ruin
def ruin(b):
    """Broken walls with jagged tops round a cracked floor, a doorway that lost its arch, standing
    and fallen columns, charred beams, rubble and weeds. The only `team` part is a torn banner."""
    # the cracked floor: slabs that no longer meet
    b.box(-0.21, 0.13, 0, 0.46, 0.5, 0.022, "paving", rot=(0, 0, 0.035))
    b.box(0.24, 0.17, 0, 0.36, 0.42, 0.016, "stone", rot=(0.02, 0, -0.05))
    b.box(-0.12, -0.3, 0, 0.5, 0.26, 0.018, "stone", rot=(0, 0.02, 0.05))
    b.box(0.3, -0.24, 0, 0.3, 0.32, 0.024, "paving", rot=(0, 0, -0.09))
    limb(b, (-0.3, 0.3, 0.024), (-0.16, 0.12, 0.024), 0.012, 0.004, "char")       # cracks
    limb(b, (-0.16, 0.12, 0.024), (-0.2, -0.05, 0.024), 0.012, 0.004, "char")
    limb(b, (0.2, -0.36, 0.026), (0.34, -0.2, 0.026), 0.012, 0.004, "char")
    # the back wall and the left wall, with the corner still standing tall
    blockwall(b, (-0.44, 0.42), (0.38, 0.42), [0.47, 0.47, 0.37, 0.39, 0.27, 0.3, 0.19, 0.2, 0.1, 0.12, 0.05], 0.07)
    blockwall(b, (-0.44, 0.35), (-0.44, -0.22), [0.36, 0.24, 0.26, 0.14, 0.15, 0.07, 0.08, 0.035], 0.07, seed=5)
    b.box(-0.03, 0.42, 0, 0.84, 0.085, 0.045, "stone_dark")              # the footing courses
    b.box(-0.44, 0.1, 0, 0.085, 0.66, 0.045, "stone_dark")
    b.box(-0.44, 0.42, 0, 0.11, 0.11, 0.3, "stone_dark")                 # corner buttress
    b.box(-0.16, 0.38, 0.14, 0.09, 0.012, 0.14, "char")                  # a burnt-out window
    b.box(-0.16, 0.375, 0.125, 0.11, 0.02, 0.016, "paving")
    b.box(0.08, 0.38, 0.03, 0.2, 0.012, 0.1, "plaster")                  # plaster still on the wall
    b.box(-0.4, 0.18, 0.05, 0.012, 0.16, 0.12, "plaster")
    # the doorway on the right: two piers, the arch springing from one, the rest on the ground
    for y, h in ((-0.02, 0.3), (-0.3, 0.2)):
        b.box(0.42, y, 0, 0.09, 0.09, 0.03, "stone_dark")
        b.box(0.42, y, 0.03, 0.07, 0.07, h, "stone")
    b.frustum(0.42, -0.02, 0.33, 0.07, 0.07, 0.07, 0.03, 0.05, "stone", oy=-0.02)
    limb(b, (0.42, -0.05, 0.33), (0.42, -0.12, 0.37), 0.07, 0.045, "stone_dark")   # the arch stub
    b.box(0.42, -0.3, 0.23, 0.07, 0.07, 0.03, "paving", rot=(0.2, 0, 0.3))
    b.box(0.3, -0.16, 0.02, 0.1, 0.06, 0.05, "stone_dark", rot=(0.2, 0.1, 0.7))    # fallen arch stones
    b.box(0.34, -0.09, 0.02, 0.07, 0.05, 0.045, "stone", rot=(0.1, 0.3, 0.2))
    # columns: one standing with its capital, a stump, one fallen in drums
    b.box(-0.08, -0.08, 0.02, 0.11, 0.11, 0.03, "paving")
    b.cyl(-0.08, -0.08, 0.05, 0.042, 0.33, "plaster", seg=8, r2=0.037)
    b.box(-0.08, -0.08, 0.38, 0.1, 0.1, 0.03, "paving", rot=(0, 0.06, 0.1))
    b.box(0.14, 0.14, 0.016, 0.11, 0.11, 0.03, "paving")
    b.cyl(0.14, 0.14, 0.046, 0.042, 0.12, "plaster", seg=8)
    b.frustum(0.14, 0.14, 0.166, 0.06, 0.06, 0.02, 0.05, 0.05, "plaster", ox=0.015, rz=0.4)
    b.cyl(0.02, -0.33, 0.022 + 0.042 - 0.1, 0.042, 0.2, "plaster", seg=8, rot=(0, PI / 2, 0.25))
    b.cyl(0.2, -0.38, 0.022 + 0.042 - 0.04, 0.042, 0.08, "plaster", seg=8, rot=(0, PI / 2, -0.5))
    b.cyl(-0.2, -0.36, 0.02, 0.042, 0.06, "plaster", seg=8, rot=(0.1, 0, 0))
    # charred beams: two fallen against the back wall, one across the floor
    limb(b, (-0.3, 0.02, 0.03), (-0.26, 0.38, 0.3), 0.03, 0.03, "char")
    limb(b, (0.0, 0.1, 0.03), (-0.04, 0.38, 0.22), 0.028, 0.028, "char")
    limb(b, (-0.36, -0.1, 0.04), (-0.12, 0.06, 0.04), 0.03, 0.03, "char")
    b.box(-0.2, 0.22, 0.022, 0.12, 0.1, 0.006, "char", rot=(0, 0, 0.5))  # scorch
    # what is left of the roof: tiled slabs fallen in, one still leaning on the wall
    b.box(0.2, 0.3, 0.1, 0.2, 0.16, 0.014, "terracotta", rot=(0.75, 0, 0.1))
    b.box(-0.02, 0.2, 0.03, 0.14, 0.1, 0.014, "terracotta", rot=(0.12, 0.1, 0.6))
    b.box(0.26, 0.06, 0.02, 0.08, 0.07, 0.012, "terracotta", rot=(0.1, -0.15, 1.2))
    # the outside: a buttress, ivy and old plaster
    b.frustum(0.0, 0.475, 0, 0.09, 0.07, 0.09, 0.02, 0.2, "stone_dark", oy=-0.025)
    blob(b, -0.25, 0.465, 0.16, 0.07, "moss", seed=8, sq=(1.3, 0.45, 1.5))
    blob(b, -0.485, 0.2, 0.1, 0.06, "leaf", seed=9, sq=(0.45, 1.3, 1.3))
    b.box(0.16, 0.458, 0.05, 0.14, 0.01, 0.1, "plaster")
    # rubble
    for i, (x, y, s) in enumerate([(0.0, 0.3, 0.09), (0.1, 0.33, 0.06), (-0.33, 0.28, 0.07), (0.27, 0.32, 0.08),
                                   (-0.36, -0.28, 0.08), (0.12, -0.14, 0.07), (0.46, 0.2, 0.07)]):
        b.box(x, y, 0.012, s, s * 0.75, s * 0.6, ("stone", "stone_dark", "paving")[i % 3],
              rot=(0.25 * hsh(i, 1), 0.25 * hsh(i, 2), 3 * hsh(i, 3)))
    # weeds and moss taking it back
    for i, (x, y) in enumerate([(-0.02, 0.02), (0.2, 0.0), (-0.3, -0.03), (0.36, 0.3), (0.1, -0.24), (-0.22, -0.44)]):
        tuft(b, x, y, 0.016, 1.0 + 0.5 * hsh(i, 9), "leaf" if i % 2 else "moss", seed=i)
    blob(b, 0.24, 0.38, 0.05, 0.06, "moss", seed=4, sq=(1.3, 0.8, 0.7))
    blob(b, -0.47, 0.06, 0.04, 0.05, "leaf", seed=6, sq=(0.8, 1.3, 0.7))
    b.box(0.2, 0.42, 0.165, 0.1, 0.08, 0.012, "moss")
    # the torn banner on a leaning pole
    limb(b, (-0.3, -0.42, 0.0), (-0.36, -0.4, 0.46), 0.014, 0.014, "timber")
    prism(b, [(0.0, 0.44), (0.13, 0.42), (0.11, 0.36), (0.14, 0.31), (0.08, 0.27), (0.06, 0.2), (0.03, 0.25), (-0.01, 0.17)],
          0.008, "team", x=-0.355, y=-0.4, rz=-0.2)


MODELS = {"farm": farm, "camp": camp, "factory": factory, "ruin": ruin}


def build(key):
    """The finished Blender object for one of the four models."""
    b = Builder("base")
    MODELS[key](b)
    return b.build(key)
