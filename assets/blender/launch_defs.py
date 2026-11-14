"""The launch sequence models (issue #291, contract X4 `models.rocket`, `models.booster`,
`ages.modern.rocket`; the satellite is `satellite()` in ages_defs.py).

Rockets stand up along z here (+Y in the GLB), nose up, the bottom of the engine bell at z = 0, round
the z axis, so the rocket and the booster share their origin: drawn at the same scale (footprints in
the manifest are in proportion to their heights) the booster sits exactly on the rocket's lower stage.
Empties: `fx_thruster` at the bell, streaming down; `sep_point` at the stage join.
"""
import math

from ages_kit import DOWN, UP

PI = math.pi


def _booster(b):
    """The reusable first stage: engine bell, white tank with `team` and teal bands, folded landing legs,
    four grid fins, the interstage on top. Returns the height of the stage join."""
    b.rod((0, 0, 0.075), (0, 0, 0.0), 0.035, "iron", seg=10, r2=0.06)    # the engine bell
    b.cyl(0, 0, 0.0, 0.05, 0.004, "glow", seg=10)
    b.cyl(0, 0, 0.07, 0.08, 0.035, "iron", seg=10)                        # thrust section
    b.cyl(0, 0, 0.105, 0.075, 0.415, "hull", seg=10)                      # the tank
    b.cyl(0, 0, 0.17, 0.077, 0.06, "team", seg=10)
    b.cyl(0, 0, 0.42, 0.077, 0.025, "teal_dark", seg=10)
    for k in range(4):
        a = PI / 4 + k * PI / 2
        c, s = math.cos(a), math.sin(a)
        b.rod((0.088 * c, 0.088 * s, 0.03), (0.08 * c, 0.08 * s, 0.27), 0.011, "teal_dark", seg=4)   # landing leg
        g = k * PI / 2
        b.box(0.097 * math.cos(g), 0.097 * math.sin(g), 0.47, 0.04, 0.055, 0.012, "iron", rot=(0, 0, g))   # grid fin
    b.cyl(0, 0, 0.52, 0.076, 0.03, "iron", seg=10)                        # interstage
    return 0.55


def booster(b):
    """`models.booster`: the first stage alone, after separation."""
    _booster(b)
    b.fx("fx_thruster", (0, 0, 0), DOWN)


def rocket(b):
    """`models.rocket`: the booster under an upper stage and a payload fairing with a `team` band."""
    top = _booster(b)
    b.fx("fx_thruster", (0, 0, 0), DOWN)
    b.fx("sep_point", (0, 0, top), UP)
    b.cyl(0, 0, top, 0.068, 0.23, "hull", seg=10)                         # the upper stage
    b.cyl(0, 0, top + 0.15, 0.07, 0.035, "team", seg=10)
    z = top + 0.23
    b.cyl(0, 0, z, 0.074, 0.012, "teal_dark", seg=10)                     # fairing join
    b.lathe(0, 0, z + 0.012, [(0.074, 0.0), (0.074, 0.06), (0.062, 0.12), (0.038, 0.18), (0.0, 0.22)], "hull", seg=10)
    b.cyl(0, 0, z + 0.035, 0.079, 0.025, "team", seg=10)                  # fairing band


def rocket_modern(b):
    """`ages.modern.rocket`: a 1960s moon rocket. Five engines, a white first stage with black roll
    bands and four fins, a second stage, a narrower third stage, the capsule and its escape tower."""
    for x, y in [(0, 0)] + [(0.045 * math.cos(PI / 4 + k * PI / 2), 0.045 * math.sin(PI / 4 + k * PI / 2)) for k in range(4)]:
        b.rod((x, y, 0.06), (x, y, 0.0), 0.016, "iron", seg=6, r2=0.026)
    b.cyl(0, 0, 0.0, 0.02, 0.004, "glow", seg=6)
    b.cyl(0, 0, 0.06, 0.085, 0.03, "black", seg=10)                       # thrust section
    b.cyl(0, 0, 0.09, 0.08, 0.3, "white", seg=10)                         # first stage
    b.cyl(0, 0, 0.09, 0.081, 0.05, "black", seg=10)                       # roll bands
    b.cyl(0, 0, 0.34, 0.081, 0.03, "black", seg=10)
    b.cyl(0, 0, 0.22, 0.081, 0.05, "team", seg=10)                        # the nation's band
    for k in range(4):                                                    # fins
        a = PI / 4 + k * PI / 2
        b.box(0.1 * math.cos(a), 0.1 * math.sin(a), 0.02, 0.05, 0.012, 0.11, "white", rot=(0, 0, a))
    b.cyl(0, 0, 0.39, 0.08, 0.03, "black", seg=10)                        # interstage
    b.fx("sep_point", (0, 0, 0.39), UP)
    b.cyl(0, 0, 0.42, 0.08, 0.22, "white", seg=10)                        # second stage
    b.cyl(0, 0, 0.58, 0.081, 0.03, "team", seg=10)
    b.lathe(0, 0, 0.64, [(0.08, 0.0), (0.056, 0.06)], "white", seg=10)   # taper
    b.cyl(0, 0, 0.7, 0.056, 0.12, "white", seg=10)                        # third stage
    b.cyl(0, 0, 0.7, 0.057, 0.025, "black", seg=10)
    b.lathe(0, 0, 0.82, [(0.056, 0.0), (0.045, 0.05), (0.045, 0.07), (0.0, 0.12)], "white", seg=10)   # capsule
    b.rod((0, 0, 0.93), (0, 0, 1.0), 0.006, "steel", seg=4)               # escape tower
    b.cyl(0, 0, 0.955, 0.014, 0.02, "red", seg=6)
    b.cyl(0, 0, 1.0, 0.008, 0.02, "steel", seg=4, r2=0.0)
    b.fx("fx_thruster", (0, 0, 0), DOWN)
