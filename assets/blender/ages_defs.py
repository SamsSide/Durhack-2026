"""The 21 technology-age unit models: army, fleet (war ship) and trader (merchant ship) for the
ancient, medieval, gunpowder, industrial, modern, future and stellar ages (and the `satellite`).

Reading rule: war ships carry `team` sails or a `team` hull stripe; merchants carry plain canvas
with one `team` stripe, cargo on deck and a `team` flag.

Effect anchors (contract X4): `b.fx(name, point, direction)` leaves an empty in the GLB where lane b
starts an effect: fx_dust behind a marching army, fx_wake at a ship's stern on the waterline,
fx_exhaust on top of a funnel, fx_thruster at an engine, fx_contrail behind a jet or the satellite.
"""
import math

from ages_kit import BACK, DOWN, UP, Hull, flag, funnel, horse, lateen, man, mast, sail, smoke

PI = math.pi
AGES = ["ancient", "medieval", "gunpowder", "industrial", "modern", "future", "stellar"]
KINDS = ["army", "fleet", "trader"]


# ================================================================ armies
def _hoplite(b):
    top = man(b, "canvas", legs="skin")
    b.box(0, 0, top - 0.035, 0.08, 0.08, 0.05, "bronze")                 # helmet
    b.box(-0.005, 0, top + 0.015, 0.1, 0.018, 0.04, "team")              # crest
    b.disc(0.055, 0.035, 0.165, 0.085, 0.018, "team", axis="x")          # round shield
    b.disc(0.066, 0.035, 0.165, 0.03, 0.012, "bronze", axis="x", seg=6)  # boss
    b.rod((0.03, -0.085, 0.0), (0.03, -0.085, 0.5), 0.008, "wood_light", seg=3)
    b.rod((0.03, -0.085, 0.5), (0.03, -0.085, 0.58), 0.016, "bronze", seg=3, r2=0.0)


def _archer(b):
    top = man(b, "terracotta", legs="skin")
    b.box(0, 0, top - 0.01, 0.075, 0.075, 0.02, "wood_dark")             # hair
    b.path([(0.07, -0.07, 0.02), (0.13, -0.07, 0.1), (0.13, -0.07, 0.26), (0.07, -0.07, 0.34)], 0.011, "wood_dark", seg=3)
    b.box(-0.055, 0.03, 0.13, 0.03, 0.04, 0.13, "wood", rot=(0.35, 0, 0))  # quiver


def army_ancient(b):
    for x in (0.16, -0.06):
        for y in (-0.22, 0.0, 0.22):
            with b.at(x, y):
                _hoplite(b)
    for y in (-0.16, 0.16):
        with b.at(-0.3, y):
            _archer(b)
    # the standard: a cloth hung from a crossbar under a bronze disc
    b.rod((-0.3, 0, 0), (-0.3, 0, 0.7), 0.01, "wood_dark", seg=4)
    b.rod((-0.3, -0.085, 0.62), (-0.3, 0.085, 0.62), 0.008, "wood_dark", seg=3)
    b.box(-0.3, 0, 0.43, 0.012, 0.15, 0.19, "team")
    b.disc(-0.3, 0, 0.71, 0.04, 0.014, "bronze", axis="x")
    b.fx("fx_dust", (-0.36, 0, 0.02))


def _knight(b, coat, banner=False):
    horse(b, coat)
    z = 0.03
    b.box(-0.01, 0, 0.2 + z, 0.07, 0.11, 0.12, "steel")                  # rider
    for y in (-0.064, 0.064):
        b.box(0.0, y, 0.11 + z, 0.045, 0.022, 0.1, "steel")
    b.box(-0.01, 0, 0.32 + z, 0.066, 0.066, 0.07, "steel")               # great helm
    b.box(0.022, 0, 0.345 + z, 0.006, 0.05, 0.012, "dark")               # eye slit
    b.box(-0.035, 0, 0.39 + z, 0.05, 0.02, 0.055, "team")                # plume
    b.box(0.02, 0.076, 0.17 + z, 0.085, 0.012, 0.11, "team")             # shield
    if banner:
        b.rod((0.02, -0.078, 0.15), (0.02, -0.078, 0.86), 0.01, "wood_dark", seg=4)
        b.box(-0.075, -0.078, 0.64, 0.19, 0.01, 0.2, "team")
        b.box(-0.2, -0.078, 0.74, 0.06, 0.01, 0.1, "team")               # swallow tail
        b.box(-0.2, -0.078, 0.64, 0.06, 0.01, 0.05, "team")
    else:
        b.rod((-0.06, -0.078, 0.2), (0.3, -0.078, 0.66), 0.011, "wood_light", seg=3)
        b.rod((0.3, -0.078, 0.66), (0.345, -0.078, 0.717), 0.017, "steel", seg=3, r2=0.0)
        b.box(0.2, -0.078, 0.585, 0.11, 0.008, 0.06, "team")   # pennant


def _crossbowman(b):
    top = man(b, "wood_light", legs="wood_dark")
    b.cyl(0, 0, top - 0.012, 0.062, 0.014, "steel", seg=6)               # kettle hat
    b.box(0, 0, top, 0.05, 0.05, 0.025, "steel")
    b.rod((0.01, -0.03, 0.19), (0.17, -0.03, 0.19), 0.011, "wood_dark", seg=3)
    b.rod((0.15, -0.105, 0.19), (0.15, 0.045, 0.19), 0.008, "steel", seg=3)
    b.box(0.045, 0.045, 0.02, 0.014, 0.1, 0.17, "team")                  # pavise shield


def army_medieval(b):
    with b.at(0.22, 0.0):
        _knight(b, "horse2", banner=True)
    with b.at(-0.04, -0.3):
        _knight(b, "horse")
    with b.at(-0.04, 0.3):
        _knight(b, "horse")
    for y in (-0.1, 0.1):
        with b.at(-0.33, y):
            _crossbowman(b)
    b.fx("fx_dust", (-0.38, 0, 0.02))


def _musketeer(b):
    top = man(b, "team", legs="white")
    b.box(0, 0, 0.12, 0.08, 0.035, 0.11, "white", rot=(0.0, 0, 0))       # cross belts
    b.cyl(0, 0, top - 0.005, 0.078, 0.016, "black", seg=3, rot=(0, 0, PI))  # tricorn
    b.box(0, 0, top + 0.01, 0.05, 0.05, 0.022, "black")
    b.rod((0.035, -0.08, 0.1), (0.07, -0.08, 0.4), 0.009, "wood_dark", seg=3)
    b.rod((0.07, -0.08, 0.4), (0.082, -0.08, 0.5), 0.006, "steel", seg=3, r2=0.001)


def _cannon(b):
    for y in (-0.095, 0.095):
        b.disc(0, y, 0.105, 0.105, 0.022, "wood", axis="y", seg=10)
        b.disc(0, y * 1.14, 0.105, 0.03, 0.012, "dark", axis="y", seg=6)
    b.box(0.0, 0, 0.08, 0.16, 0.12, 0.05, "wood_dark")
    b.rod((-0.02, 0, 0.1), (-0.27, 0, 0.015), 0.026, "wood_dark", seg=4)   # trail
    b.rod((-0.1, 0, 0.155), (0.2, 0, 0.2), 0.04, "bronze", seg=8, r2=0.028)
    b.rod((0.2, 0, 0.2), (0.235, 0, 0.205), 0.036, "bronze", seg=8)       # muzzle swell
    b.ball(-0.12, 0, 0.152, 0.022, "bronze")
    for x, y, z in ((0.03, 0.2, 0.025), (0.085, 0.2, 0.025), (0.057, 0.24, 0.025), (0.057, 0.215, 0.062)):
        b.ball(x, y, z, 0.027, "iron")


def army_gunpowder(b):
    for y in (-0.03, 0.115, 0.26, 0.405):
        with b.at(0.1, y):
            _musketeer(b)
    with b.at(-0.14, 0.19):                                               # the colour sergeant
        top = man(b, "team", legs="white")
        b.box(0, 0, top, 0.06, 0.06, 0.06, "black")                       # shako
        b.rod((0.03, 0.08, 0.05), (0.03, 0.08, 0.76), 0.009, "wood_dark", seg=4)
        b.box(-0.085, 0.08, 0.56, 0.22, 0.01, 0.19, "team")
        b.ball(0.03, 0.08, 0.775, 0.018, "bronze")
    with b.at(0.0, -0.29):
        _cannon(b)
    b.fx("fx_dust", (-0.2, 0.05, 0.02))


def _rifleman(b, coat="khaki", hat="khaki_dark", kneel=False):
    if kneel:
        b.box(-0.02, 0, 0, 0.1, 0.1, 0.06, "khaki_dark")
        z = -0.06
    else:
        b.box(0, 0, 0, 0.06, 0.1, 0.12, "khaki_dark")
        z = 0.0
    b.box(0, 0, 0.12 + z, 0.075, 0.13, 0.11, coat)
    b.box(0, 0, 0.23 + z, 0.07, 0.07, 0.06, "skin")
    b.cyl(0, 0, 0.28 + z, 0.058, 0.009, hat, seg=8)                      # brodie helmet
    b.cyl(0, 0, 0.289 + z, 0.036, 0.018, hat, seg=6)
    b.rod((-0.02, -0.05, 0.2 + z), (0.2, -0.05, 0.215 + z), 0.009, "wood_dark", seg=3)
    b.rod((0.2, -0.05, 0.215 + z), (0.26, -0.05, 0.219 + z), 0.005, "steel", seg=3)
    b.box(0.06, -0.02, 0.19 + z, 0.09, 0.04, 0.03, coat)                  # arms


def _field_gun(b):
    for y in (-0.105, 0.105):
        b.disc(0, y, 0.09, 0.09, 0.018, "wood_dark", axis="y", seg=10)
        b.disc(0, y * 1.1, 0.09, 0.028, 0.012, "iron", axis="y", seg=6)
    b.box(0.035, 0, 0.05, 0.014, 0.25, 0.16, "khaki_dark", rot=(0, -0.2, 0))   # gun shield
    b.box(0.045, 0, 0.11, 0.012, 0.252, 0.035, "team", rot=(0, -0.2, 0))       # its stripe
    b.rod((-0.1, 0, 0.125), (0.14, 0, 0.165), 0.026, "iron", seg=6)           # recoil cradle
    b.rod((0.0, 0, 0.15), (0.34, 0, 0.205), 0.013, "steel", seg=6)             # long barrel
    for s in (-1, 1):
        b.rod((0.0, s * 0.03, 0.09), (-0.25, s * 0.1, 0.012), 0.016, "iron", seg=4)   # split trail


def _armoured_car(b):
    for x in (-0.13, 0.14):
        for y in (-0.085, 0.085):
            b.disc(x, y, 0.06, 0.06, 0.035, "black", axis="y", seg=8)
            b.disc(x, y * 1.2, 0.06, 0.025, 0.012, "khaki", axis="y", seg=6)
    b.prism([(-0.22, 0.05), (0.05, 0.05), (0.05, 0.19), (-0.17, 0.19), (-0.22, 0.13)], -0.075, 0.075, "khaki_dark")
    b.box(0.135, 0, 0.05, 0.17, 0.115, 0.09, "khaki_dark")                 # bonnet
    b.box(0.224, 0, 0.06, 0.008, 0.09, 0.07, "black")                      # radiator
    b.box(0.052, 0, 0.14, 0.006, 0.11, 0.025, "black")                     # vision slit
    b.cyl(-0.06, 0, 0.19, 0.068, 0.065, "khaki", seg=8)                    # turret
    b.cyl(-0.06, 0, 0.215, 0.07, 0.022, "team", seg=8)
    b.cyl(-0.06, 0, 0.255, 0.05, 0.006, "team", seg=8)                     # turret band
    b.rod((-0.01, 0, 0.225), (0.13, 0, 0.235), 0.01, "iron", seg=4)        # machine gun
    flag(b, -0.2, 0.0, 0.13, 0.34, w=0.15, fh=0.1)
    b.fx("fx_exhaust", (-0.225, 0.05, 0.07), UP)


def army_industrial(b):
    with b.at(-0.04, 0.24):
        _armoured_car(b)
    with b.at(-0.06, -0.27):
        _field_gun(b)
    with b.at(0.33, -0.02):
        _rifleman(b, kneel=True)
    with b.at(0.1, -0.02):
        _rifleman(b)
    with b.at(-0.14, -0.02):
        _rifleman(b)
    b.fx("fx_dust", (-0.3, 0, 0.02))


def _tank(b):
    track = [(-0.31, 0.06), (-0.27, 0.0), (0.25, 0.0), (0.31, 0.06), (0.31, 0.085), (0.27, 0.115), (-0.28, 0.115), (-0.31, 0.085)]
    for s in (-1, 1):
        b.prism(track, s * 0.095, s * 0.16, "black")
        for i in range(5):
            b.disc(-0.22 + i * 0.11, s * 0.162, 0.045, 0.036, 0.008, "olive_dark", axis="y", seg=6)
        b.box(0.0, s * 0.128, 0.115, 0.6, 0.075, 0.012, "olive")          # fender
    b.prism([(-0.3, 0.06), (0.27, 0.06), (0.31, 0.1), (0.17, 0.17), (-0.28, 0.17), (-0.3, 0.14)], -0.1, 0.1, "olive")
    b.box(-0.2, 0, 0.17, 0.12, 0.17, 0.012, "olive_dark")                 # engine deck
    turret = [(-0.17, 0.17), (0.1, 0.17), (0.14, 0.2), (0.14, 0.225), (0.08, 0.265), (-0.15, 0.265), (-0.19, 0.22)]
    b.prism(turret, -0.095, 0.095, "olive")
    b.box(-0.022, 0, 0.2, 0.33, 0.196, 0.026, "team")                     # turret band
    b.box(-0.045, 0, 0.265, 0.17, 0.13, 0.006, "team")                    # roof panel, seen from orbit
    b.box(0.15, 0, 0.195, 0.04, 0.07, 0.045, "olive_dark")                # mantlet
    b.rod((0.15, 0, 0.217), (0.54, 0, 0.235), 0.015, "olive_dark", seg=6)
    b.rod((0.5, 0, 0.233), (0.56, 0, 0.236), 0.023, "olive_dark", seg=6)  # muzzle brake
    b.cyl(-0.07, 0.04, 0.265, 0.034, 0.024, "olive_dark", seg=6)          # cupola
    b.rod((-0.15, -0.06, 0.265), (-0.16, -0.06, 0.52), 0.004, "black", seg=3)
    b.box(-0.2, -0.06, 0.45, 0.08, 0.006, 0.05, "team")
    b.fx("fx_exhaust", (-0.29, 0.06, 0.175), UP)
    b.fx("fx_dust", (-0.31, 0, 0.02))


def _jet(b):
    """A jet fighter about 0.46 long, nose to +x, drawn round its own centre: swept wings, twin tail
    fins, one engine nozzle. Anchors: the nozzle flame and a contrail from each wing tip. It is kept to
    about 120 triangles and one new colour, so the model stays under 60 KB."""
    b.loft([(-0.2, 0.04, 0.04, -0.032, 0.034), (-0.02, 0.048, 0.042, -0.036, 0.042), (0.12, 0.032, 0.024, -0.03, 0.034),
            (0.25, 0.0, 0.0, -0.006, 0.0)], "navy_light")
    b.loft([(0.02, 0.026, 0.018, 0.036, 0.07), (0.14, 0.014, 0.008, 0.024, 0.04)], "black")       # canopy
    b.loft([(-0.17, 0.04, 0.04, -0.012, 0.006), (-0.13, 0.21, 0.21, -0.012, 0.006), (-0.075, 0.21, 0.21, -0.012, 0.006),
            (0.075, 0.04, 0.04, -0.012, 0.006)], "navy_light")                                        # swept wings
    for s in (-1, 1):                                                                              # twin tail fins
        b.prism([(-0.21, 0.025), (-0.09, 0.025), (-0.165, 0.135), (-0.225, 0.135)], s * 0.052 - 0.008, s * 0.052 + 0.008, "team")
    b.box(-0.09, 0, 0.006, 0.1, 0.3, 0.006, "team")                                                # wing band, seen from orbit
    b.rod((-0.19, 0, 0.0), (-0.26, 0, 0.0), 0.038, "black", seg=6, r2=0.03)                        # the nozzle
    b.fx("fx_thruster", (-0.26, 0, 0.0))
    for s in (-1, 1):
        b.fx("fx_contrail", (-0.13, s * 0.21, -0.004))


def _jeep(b):
    for x in (-0.1, 0.1):
        for y in (-0.07, 0.07):
            b.disc(x, y, 0.048, 0.048, 0.03, "black", axis="y", seg=8)
    b.box(0.0, 0, 0.04, 0.31, 0.125, 0.065, "olive")
    b.box(0.095, 0, 0.105, 0.12, 0.115, 0.025, "olive")                   # bonnet
    b.box(0.03, 0, 0.125, 0.008, 0.125, 0.06, "glass", rot=(0, -0.25, 0))  # windscreen
    b.box(-0.04, 0, 0.105, 0.05, 0.11, 0.045, "olive_dark")               # seats
    b.box(-0.03, 0.03, 0.15, 0.05, 0.05, 0.05, "skin")                    # driver
    b.cyl(-0.03, 0.03, 0.2, 0.034, 0.02, "olive_dark", seg=6)
    b.disc(-0.165, 0, 0.1, 0.045, 0.02, "black", axis="x", seg=8)         # spare wheel
    b.rod((-0.11, 0, 0.1), (-0.11, 0, 0.2), 0.008, "olive_dark", seg=3)   # gun on a post
    b.rod((-0.15, 0, 0.2), (-0.01, 0, 0.215), 0.008, "black", seg=3)


def _soldier(b, s=0.74):
    top = man(b, "olive", legs="olive_dark", s=s)
    b.cyl(0, 0, top - 0.02 * s, 0.05 * s, 0.035 * s, "olive_dark", seg=6)
    b.box(-0.05 * s, 0, 0.13 * s, 0.03 * s, 0.09 * s, 0.09 * s, "olive_dark")           # pack
    b.rod((0.045 * s, -0.07 * s, 0.1 * s), (0.055 * s, 0.06 * s, 0.2 * s), 0.008, "black", seg=3)  # rifle


def army_modern(b):
    with b.at(-0.08, 0.14):
        _tank(b)
    with b.at(-0.16, -0.27):
        _jeep(b)
    for x, y in ((0.1, -0.2), (0.2, -0.32), (0.3, -0.2)):
        with b.at(x, y):
            _soldier(b)
    with b.lift(-0.13, 0.06, 0.71, 0.92, rot=(0.12, 0, 0)):                # the escort, above and behind
        _jet(b)


# ================================================================ war ships
def _posts(b, pts_stern, pts_bow, mat="wood", r=0.016):
    b.path(pts_stern, r, mat)
    b.path(pts_bow, r, mat)


def fleet_ancient(b):
    """A war galley: long and low, a bronze ram, one square sail, a bank of oars each side."""
    h = Hull(b, [(-0.46, 0.0, 0.025, 0.15), (-0.38, 0.03, 0.065, 0.105), (-0.2, 0.05, 0.09, 0.08),
                 (0.18, 0.05, 0.09, 0.08), (0.38, 0.025, 0.055, 0.09), (0.46, 0.0, 0.012, 0.12)])
    h.band(0.032, -0.004, "team", top=True)
    b.rod((0.42, 0, 0.022), (0.6, 0, 0.022), 0.03, "bronze", seg=4, r2=0.0)       # the ram
    b.path([(-0.45, 0, 0.12), (-0.52, 0, 0.26), (-0.47, 0, 0.37), (-0.37, 0, 0.39)], 0.016, "wood")  # curled stern
    b.path([(0.45, 0, 0.1), (0.5, 0, 0.2), (0.47, 0, 0.27)], 0.014, "wood")
    b.disc(0.44, 0, 0.085, 0.022, 0.03, "canvas", axis="y", seg=6)                # the painted eye
    mast(b, 0.03, 0.08, 0.6)
    sail(b, 0.045, 0.22, 0.36, 0.32, "team")
    for i in range(7):
        x = -0.3 + i * 0.095
        for s in (-1, 1):
            b.rod((x, s * 0.085, 0.07), (x - 0.05, s * 0.25, 0.004), 0.007, "wood_light", seg=3)
    b.box(-0.33, 0, 0.1, 0.12, 0.11, 0.065, "team")                               # stern awning
    for i in range(5):                                                            # shields on the rail
        x = -0.22 + i * 0.095
        for s in (-1, 1):
            b.disc(x, s * 0.096, 0.075, 0.026, 0.01, "bronze", axis="y", seg=6)
    b.fx("fx_wake", (-0.46, 0, 0))


def _cog_hull(b, side="wood"):
    return Hull(b, [(-0.4, 0.0, 0.03, 0.2), (-0.31, 0.07, 0.13, 0.15), (-0.1, 0.105, 0.165, 0.12),
                    (0.12, 0.105, 0.165, 0.12), (0.3, 0.06, 0.12, 0.15), (0.4, 0.0, 0.02, 0.22)], side)


def _castle(b, x, z, w, d, hgt, mat="wood_light", shields=True):
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box(x + sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), z - 0.1, 0.022, 0.022, 0.1, "wood_dark")
    b.box(x, 0, z, w, d, 0.02, "wood_dark")
    for sy in (-1, 1):
        b.box(x, sy * (d / 2 - 0.007), z + 0.02, w, 0.014, hgt, mat)
        for i in (-1, 0, 1):
            b.box(x + i * w * 0.36, sy * (d / 2 - 0.007), z + 0.02 + hgt, w * 0.2, 0.014, 0.025, mat)
        if shields:
            for i in (-0.5, 0.5):
                b.box(x + i * w * 0.42, sy * (d / 2 + 0.004), z + 0.022, 0.05, 0.01, hgt - 0.006, "team")
    for sx in (-1, 1):
        b.box(x + sx * (w / 2 - 0.007), 0, z + 0.02, 0.014, d, hgt, mat)
        for i in (-1, 1):
            b.box(x + sx * (w / 2 - 0.007), i * d * 0.3, z + 0.02 + hgt, 0.014, d * 0.24, 0.025, mat)


def fleet_medieval(b):
    """A war cog: a tubby clinker hull with fighting castles fore and aft and a top castle on the mast."""
    h = _cog_hull(b, "wood")
    h.band(0.045, 0.02, "wood_dark", top=True)
    b.box(-0.41, 0, 0.0, 0.03, 0.014, 0.2, "wood_dark")                   # stern rudder
    b.rod((0.39, 0, 0.0), (0.44, 0, 0.3), 0.016, "wood_dark", seg=4)      # stem post
    _castle(b, -0.27, 0.27, 0.24, 0.3, 0.05)
    b.box(-0.27, 0, 0.29, 0.2, 0.26, 0.006, "team")                      # deck cloth, seen from above
    _castle(b, 0.31, 0.3, 0.15, 0.2, 0.045, shields=False)
    mast(b, 0.02, 0.12, 0.84, r=0.014)
    sail(b, 0.04, 0.27, 0.44, 0.34, "team")
    b.cyl(0.02, 0, 0.66, 0.035, 0.05, "wood_light", seg=6, r2=0.05)       # top castle
    flag(b, 0.02, 0, 0.8, 0.14, w=0.16, fh=0.06)
    b.fx("fx_wake", (-0.42, 0, 0))


def _galleon_rig(b, mat, stripes_main=(), top_mat=None):
    top_mat = top_mat or mat
    mast(b, 0.24, 0.15, 0.74)
    mast(b, -0.02, 0.14, 0.95, r=0.013)
    mast(b, -0.3, 0.26, 0.7)
    sail(b, 0.255, 0.27, 0.3, 0.19, mat)
    sail(b, 0.255, 0.49, 0.22, 0.15, top_mat)
    sail(b, -0.005, 0.26, 0.36, 0.25, mat, stripes=stripes_main)
    sail(b, -0.005, 0.54, 0.27, 0.18, top_mat)
    lateen(b, -0.3, 0.37, 0.27, mat)
    b.rod((0.36, 0, 0.19), (0.62, 0, 0.36), 0.011, "wood_dark", seg=4)    # bowsprit


def fleet_gunpowder(b):
    """A galleon: three masts, a tall stepped stern, a beak, two rows of gunports on an ochre band."""
    h = Hull(b, [(-0.45, 0.05, 0.085, 0.2), (-0.25, 0.09, 0.115, 0.16), (0.1, 0.095, 0.12, 0.14),
                 (0.3, 0.06, 0.09, 0.15), (0.43, 0.0, 0.015, 0.18)], "wood_dark")
    h.band(0.06, 0.115, "ochre", x0=-0.44, x1=0.36)
    for i in range(6):
        x = -0.36 + i * 0.125
        for s in (-1, 1):
            b.box(x, s * (h.w(x, 0.09) + 0.004), 0.072, 0.036, 0.012, 0.03, "black")
    b.loft([(-0.47, 0.07, 0.085, 0.19, 0.29), (-0.14, 0.105, 0.105, 0.155, 0.25)], "wood")       # quarterdeck
    b.loft([(-0.49, 0.06, 0.07, 0.28, 0.37), (-0.31, 0.09, 0.09, 0.26, 0.34)], "wood_dark")      # poop
    b.box(-0.492, 0, 0.24, 0.008, 0.1, 0.1, "team")                       # painted stern
    b.box(-0.4, 0, 0.345, 0.15, 0.12, 0.012, "team")                      # poop deck awning
    b.loft([(0.2, 0.095, 0.095, 0.145, 0.21), (0.36, 0.045, 0.05, 0.15, 0.21)], "wood")          # forecastle
    b.loft([(0.36, 0.035, 0.035, 0.1, 0.16), (0.56, 0.006, 0.006, 0.19, 0.22)], "wood")          # beakhead
    _galleon_rig(b, "team")
    flag(b, -0.02, 0, 0.93, 0.1, w=0.14, fh=0.06)
    flag(b, -0.49, 0, 0.36, 0.2, w=0.1, fh=0.08)
    b.fx("fx_wake", (-0.45, 0, 0))


def fleet_industrial(b):
    """A steam battleship: a dark iron hull with a ram bow, two funnels, turrets fore and aft."""
    h = Hull(b, [(-0.48, 0.015, 0.035, 0.1), (-0.4, 0.06, 0.08, 0.1), (-0.15, 0.09, 0.1, 0.1),
                 (0.18, 0.09, 0.1, 0.1), (0.38, 0.05, 0.055, 0.1), (0.46, 0.004, 0.004, 0.105)], "iron")
    b.loft([(0.4, 0.035, 0.03, 0.0, 0.05), (0.54, 0.0, 0.0, 0.0, 0.012)], "iron")               # ram
    h.band(0.0, 0.022, "red")
    h.band(0.03, 0.006, "team", top=True)
    b.box(0.0, 0, 0.1, 0.36, 0.14, 0.055, "white")                        # superstructure
    b.box(0.13, 0, 0.155, 0.07, 0.1, 0.06, "white")                       # bridge
    b.box(0.168, 0, 0.185, 0.006, 0.09, 0.015, "black")
    for x in (-0.07, 0.04):
        funnel(b, x, 0.155, 0.04, 0.24)
        b.fx("fx_exhaust", (x, 0, 0.395), UP)
    smoke(b, -0.07, 0.4)
    for x, d in ((0.27, 1), (-0.28, -1)):
        b.cyl(x, 0, 0.1, 0.062, 0.05, "navy", seg=8)
        b.cyl(x, 0, 0.15, 0.05, 0.006, "team", seg=8)
        for y in (-0.022, 0.022):
            b.rod((x + d * 0.03, y, 0.13), (x + d * 0.2, y, 0.142), 0.01, "iron", seg=4)
    for x in (-0.1, 0.0, 0.1):                                            # casemate guns
        for s in (-1, 1):
            b.rod((x, s * 0.06, 0.125), (x + 0.02, s * 0.14, 0.13), 0.008, "iron", seg=3)
    for x in (0.17, -0.18):
        mast(b, x, 0.15, 0.56, r=0.009, mat="dark")
        b.cyl(x, 0, 0.4, 0.028, 0.03, "white", seg=6)                      # fighting top
        b.rod((x, -0.07, 0.47), (x, 0.07, 0.47), 0.005, "dark", seg=3)
    flag(b, -0.46, 0, 0.1, 0.2, w=0.12, fh=0.08)
    b.fx("fx_wake", (-0.48, 0, 0))


def fleet_modern(b):
    """A grey destroyer: a long flared hull, stepped superstructure, a radar mast, a gun forward."""
    h = Hull(b, [(-0.49, 0.055, 0.068, 0.085), (-0.2, 0.066, 0.078, 0.085), (0.15, 0.06, 0.078, 0.09),
                 (0.37, 0.022, 0.05, 0.115), (0.5, 0.0, 0.005, 0.14)], "navy", deck="navy_dark", inset=0.86)
    h.band(0.028, 0.004, "team", top=True, x0=-0.49, x1=0.42)
    b.prism([(-0.02, 0.09), (0.21, 0.09), (0.17, 0.2), (-0.02, 0.2)], -0.062, 0.062, "navy_light")   # bridge block
    b.box(0.07, 0, 0.2, 0.13, 0.15, 0.045, "navy_light")                  # wheelhouse with wings
    b.box(0.136, 0, 0.215, 0.006, 0.14, 0.018, "black")                   # windows
    b.frustum(0.05, 0, 0.245, 0.06, 0.06, 0.02, 0.02, 0.27, "navy")       # mast
    b.rod((0.05, -0.085, 0.42), (0.05, 0.085, 0.42), 0.006, "navy_dark", seg=3)
    b.box(0.062, 0, 0.455, 0.012, 0.11, 0.05, "navy_dark", rot=(0, -0.2, 0))   # radar panel
    b.rod((0.05, 0, 0.5), (0.05, 0, 0.6), 0.004, "black", seg=3)
    b.prism([(-0.15, 0.085), (-0.04, 0.085), (-0.07, 0.26), (-0.15, 0.26)], -0.04, 0.04, "navy_light")  # funnel
    b.box(-0.115, 0, 0.21, 0.092, 0.084, 0.03, "team")
    b.box(-0.11, 0, 0.26, 0.07, 0.07, 0.012, "black")
    b.box(-0.27, 0, 0.085, 0.16, 0.12, 0.085, "navy_light")               # hangar
    b.ball(-0.27, 0, 0.21, 0.04, "white", seg=6)                          # radome
    b.cyl(-0.42, 0, 0.088, 0.05, 0.005, "team", seg=8)                    # helipad mark
    b.cyl(0.3, 0, 0.1, 0.035, 0.04, "navy_light", seg=6)                  # gun
    b.rod((0.31, 0, 0.125), (0.44, 0, 0.165), 0.008, "navy_dark", seg=4)
    b.box(0.23, 0, 0.09, 0.05, 0.08, 0.02, "navy_dark")                   # missile cells
    flag(b, -0.485, 0, 0.085, 0.16, w=0.1, fh=0.065)
    b.fx("fx_exhaust", (-0.11, 0, 0.272), UP)
    b.fx("fx_wake", (-0.49, 0, 0))


# ================================================================ merchant ships
def _amphora(b, x, y, z):
    b.lathe(x, y, z, [(0.01, 0), (0.034, 0.045), (0.034, 0.075), (0.013, 0.105), (0.02, 0.122)], "terracotta", seg=5)


def trader_ancient(b):
    """A round-bellied trade galley: a swan-neck stern, a plain sail with one stripe, amphorae on deck."""
    h = Hull(b, [(-0.4, 0.0, 0.03, 0.2), (-0.31, 0.07, 0.125, 0.145), (-0.1, 0.115, 0.175, 0.11),
                 (0.13, 0.115, 0.175, 0.11), (0.31, 0.06, 0.115, 0.14), (0.4, 0.0, 0.02, 0.19)], "wood_light")
    h.band(0.04, 0.012, "wood_dark", top=True)
    b.path([(-0.39, 0, 0.17), (-0.48, 0, 0.3), (-0.45, 0, 0.42), (-0.36, 0, 0.44), (-0.33, 0, 0.38)], 0.018, "wood_light")
    b.path([(0.39, 0, 0.16), (0.44, 0, 0.27)], 0.016, "wood_light")
    mast(b, 0.03, 0.11, 0.66, r=0.013)
    sail(b, 0.05, 0.3, 0.46, 0.3, "canvas", stripes=[(-0.06, 0.06)])
    flag(b, 0.03, 0, 0.64, 0.1, w=0.12, fh=0.05)
    for x, y in ((-0.2, -0.07), (-0.2, 0.07), (-0.1, 0.0), (0.16, -0.08), (0.16, 0.08), (0.25, 0.0)):
        _amphora(b, x, y, h.z(x))
    b.box(-0.3, 0, 0.15, 0.1, 0.16, 0.012, "team", rot=(0, 0.25, 0))       # stern awning
    for s in (-1, 1):                                                     # steering oars
        b.rod((-0.27, s * 0.13, 0.2), (-0.36, s * 0.17, 0.004), 0.009, "wood_dark", seg=3)
        b.box(-0.35, s * 0.165, 0.0, 0.06, 0.01, 0.07, "wood_dark")
    b.fx("fx_wake", (-0.4, 0, 0))


def trader_medieval(b):
    """A merchant cog: the war cog's hull without the castles, crates and barrels amidships."""
    h = _cog_hull(b, "wood")
    h.band(0.045, 0.02, "wood_light", top=True)
    b.box(-0.41, 0, 0.0, 0.03, 0.014, 0.2, "wood_dark")
    b.rod((0.39, 0, 0.0), (0.44, 0, 0.3), 0.016, "wood_dark", seg=4)
    b.box(-0.25, 0, 0.13, 0.15, 0.2, 0.075, "wood_light")                # stern cabin
    b.gable(-0.25, 0, 0.205, 0.15, 0.2, 0.05, "team")
    mast(b, 0.03, 0.12, 0.76, r=0.014)
    sail(b, 0.05, 0.3, 0.44, 0.32, "canvas", stripes=[(-0.17, -0.09), (0.09, 0.17)])
    flag(b, 0.03, 0, 0.72, 0.12, w=0.15, fh=0.06)
    for x, y, s in ((-0.1, -0.06, 0.085), (-0.1, 0.06, 0.07), (0.16, 0.05, 0.08), (0.25, -0.03, 0.065)):
        b.box(x, y, h.z(x), s, s, s, "wood_light", rot=(0, 0, 0.2))
        b.box(x, y, h.z(x) + s * 0.4, s * 1.04, s * 1.04, s * 0.14, "wood_dark", rot=(0, 0, 0.2))
    for x, y in ((0.14, -0.07), (-0.02, 0.09)):
        b.cyl(x, y, h.z(x), 0.035, 0.08, "wood_dark", seg=6)
        b.cyl(x, y, h.z(x) + 0.03, 0.038, 0.02, "ochre", seg=6)
    b.fx("fx_wake", (-0.42, 0, 0))


def trader_gunpowder(b):
    """A merchant galleon (fluyt): a fat pale hull, a narrow stern, plain sails with one stripe."""
    h = Hull(b, [(-0.45, 0.045, 0.06, 0.2), (-0.25, 0.115, 0.115, 0.15), (0.1, 0.125, 0.12, 0.13),
                 (0.3, 0.085, 0.09, 0.14), (0.42, 0.0, 0.02, 0.17)], "wood_light")
    h.band(0.05, 0.02, "wood_dark", top=True)
    b.loft([(-0.48, 0.045, 0.05, 0.19, 0.31), (-0.2, 0.095, 0.085, 0.15, 0.22)], "wood")       # stern castle
    b.box(-0.482, 0, 0.23, 0.008, 0.07, 0.07, "team")
    b.box(-0.4, 0, 0.3, 0.13, 0.09, 0.01, "team")                         # stern awning
    b.loft([(0.2, 0.09, 0.09, 0.135, 0.185), (0.36, 0.045, 0.05, 0.15, 0.19)], "wood")         # forecastle
    _galleon_rig(b, "canvas", stripes_main=[(-0.05, 0.05)])
    flag(b, -0.02, 0, 0.93, 0.1, w=0.14, fh=0.06)
    flag(b, -0.48, 0, 0.3, 0.2, w=0.12, fh=0.09)
    for x, y in ((0.08, -0.05), (0.08, 0.04), (0.14, 0.0)):
        b.box(x, y, h.z(x), 0.06, 0.06, 0.055, "ochre", rot=(0, 0, 0.3))
    b.fx("fx_wake", (-0.45, 0, 0))


def trader_industrial(b):
    """A tramp steamer: a black hull, one tall funnel, two masts with cargo booms, crates on deck."""
    h = Hull(b, [(-0.48, 0.02, 0.05, 0.12), (-0.38, 0.075, 0.095, 0.11), (-0.12, 0.1, 0.105, 0.1),
                 (0.2, 0.1, 0.105, 0.1), (0.4, 0.045, 0.06, 0.12), (0.48, 0.0, 0.006, 0.135)], "black")
    h.band(0.0, 0.025, "red")
    h.band(0.028, 0.006, "team", top=True)
    b.box(-0.03, 0, 0.1, 0.22, 0.16, 0.07, "white")                       # deckhouse
    b.box(0.045, 0, 0.17, 0.08, 0.13, 0.055, "white")                     # bridge
    b.box(0.088, 0, 0.19, 0.006, 0.12, 0.018, "black")
    funnel(b, -0.07, 0.17, 0.045, 0.3, mat="black", top="black", rake=0.03)
    smoke(b, -0.1, 0.47)
    for x, d in ((0.27, 1), (-0.3, -1)):
        mast(b, x, 0.1, 0.5, r=0.011, mat="wood")
        b.rod((x, 0, 0.16), (x - d * 0.13, 0, 0.36), 0.007, "wood", seg=3)   # cargo boom
        b.box(x - d * 0.1, 0, 0.1, 0.11, 0.11, 0.02, "team" if d > 0 else "khaki")                # hatch cover
    for x, y, s in ((0.15, -0.045, 0.06), (0.15, 0.045, 0.05), (-0.19, 0.04, 0.06), (-0.4, 0.0, 0.05)):
        b.box(x, y, h.z(x) + (0.02 if abs(x) < 0.2 else 0.0), s, s, s, "wood_light")
    flag(b, -0.47, 0, 0.12, 0.17, w=0.12, fh=0.08)
    b.fx("fx_exhaust", (-0.1, 0, 0.47), UP)
    b.fx("fx_wake", (-0.48, 0, 0))


def trader_modern(b):
    """A container ship: a long hull, the white bridge block right aft, coloured boxes stacked forward."""
    h = Hull(b, [(-0.5, 0.07, 0.085, 0.11), (-0.3, 0.09, 0.095, 0.11), (0.25, 0.09, 0.095, 0.11),
                 (0.42, 0.035, 0.06, 0.125), (0.5, 0.0, 0.006, 0.14)], "blue", deck="navy_dark", inset=0.9)
    h.band(0.0, 0.03, "red")
    b.box(-0.39, 0, 0.11, 0.1, 0.17, 0.2, "white")                        # accommodation block
    b.box(-0.375, 0, 0.27, 0.07, 0.24, 0.035, "white")                    # bridge wings
    b.box(-0.338, 0, 0.28, 0.006, 0.23, 0.016, "black")
    b.rod((-0.39, 0, 0.31), (-0.39, 0, 0.42), 0.006, "dark", seg=3)
    b.box(-0.39, 0, 0.36, 0.01, 0.07, 0.01, "dark")
    b.box(-0.465, 0, 0.11, 0.045, 0.07, 0.15, "navy_light")               # funnel
    b.box(-0.465, 0, 0.26, 0.05, 0.075, 0.04, "team")
    cols = ["red", "orange", "green", "white", "ochre", "navy_light"]
    team = {(0, 2, 2), (1, 0, 2), (2, 1, 1), (3, 2, 2), (4, 0, 2), (5, 1, 1), (1, 1, 2), (3, 0, 1)}
    k = 0
    for i in range(6):
        x = -0.265 + i * 0.112
        rows = 3 if i < 5 else 2
        for r in range(rows):
            y = (r - (rows - 1) / 2) * 0.058
            for t in range((3, 3, 2, 3, 3, 2)[i]):
                k += 1
                c = "team" if (i, r, t) in team else cols[(k * 5 + i + 3 * t) % len(cols)]
                b.box(x, y, h.z(x) + 0.004 + t * 0.046, 0.1, 0.052, 0.042, c)
    flag(b, -0.47, 0, 0.3, 0.13, w=0.1, fh=0.06)
    b.fx("fx_exhaust", (-0.465, 0, 0.3), UP)
    b.fx("fx_wake", (-0.5, 0, 0))


# ================================================================ future and stellar (row A26)
# The future age is stealth grey with a glowing rail; the stellar age is a white shell with teal,
# like the arcology buildings. Things that fly keep something on y = 0 (a lift field, a wash on the
# water) so the model still stands on the ground or the waterline.
def _limb(b, p0, p1, w, d, mat):
    """A box from p0 to p1 (same y), w thick in the x-z plane and d across."""
    (x0, y, z0), (x1, _, z1) = p0, p1
    L = math.hypot(x1 - x0, z1 - z0)
    b.box((x0 + x1) / 2, y, (z0 + z1) / 2 - L / 2, w, d, L, mat, rot=(0, math.atan2(x1 - x0, z1 - z0), 0))


def _bell(b, x, y, z, r=0.05, L=0.09, mat="iron"):
    """An engine bell opening towards -x, with a lit throat."""
    b.rod((x, y, z), (x - L, y, z), r * 0.5, mat, seg=8, r2=r)
    b.rod((x - L + 0.004, y, z), (x - L - 0.006, y, z), r * 0.8, "glow", seg=8)


def _wash(b, half_len, half_w, mat="wash"):
    """The flat disturbed patch a hovering ship leaves on the water (keeps y = 0 at the waterline)."""
    b.loft([(-half_len, half_w * 0.3, half_w * 0.3, 0.0, 0.005), (-half_len * 0.55, half_w, half_w, 0.0, 0.005),
            (half_len * 0.55, half_w, half_w, 0.0, 0.005), (half_len, half_w * 0.3, half_w * 0.3, 0.0, 0.005)], mat)


def _rocket_bike(b):
    """Our own design, about 0.34 long, nose to +x, drawn round its own centre: a slim hover-bike body,
    a helmeted rider crouched forward, two short forward-swept delta wings low on the sides, one round
    thruster ring at the back, a teal light strip on the nose. Anchor: the thruster."""
    b.loft([(-0.13, 0.03, 0.036, -0.022, 0.03), (0.0, 0.04, 0.046, -0.032, 0.034), (0.1, 0.03, 0.032, -0.026, 0.03),
            (0.19, 0.008, 0.008, -0.008, 0.01)], "stealth_light")
    b.loft([(0.07, 0.016, 0.016, 0.03, 0.04), (0.185, 0.007, 0.007, 0.009, 0.019)], "teal")          # the light strip
    b.box(-0.05, 0, 0.034, 0.12, 0.05, 0.012, "stealth_dark")                                      # saddle
    b.loft([(-0.09, 0.042, 0.042, -0.034, -0.02), (0.075, 0.16, 0.16, -0.034, -0.02),
            (0.105, 0.042, 0.042, -0.034, -0.02)], "stealth")                                       # forward-swept wings
    for s in (-1, 1):
        b.box(0.07, s * 0.15, -0.02, 0.05, 0.022, 0.006, "glow")                                   # wing-tip lights
        b.box(-0.045, s * 0.052, -0.012, 0.1, 0.026, 0.034, "stealth_dark", rot=(0, 0.35, 0))      # the rider's legs
        b.box(0.065, s * 0.036, 0.062, 0.075, 0.02, 0.02, "team", rot=(0, 0.5, 0))                 # arms to the grips
    b.box(-0.01, 0, 0.05, 0.12, 0.078, 0.05, "team", rot=(0, 0.6, 0))                              # torso, leaning in
    b.ball(0.065, 0, 0.115, 0.036, "hull", seg=6)                                                  # helmet
    b.box(0.09, 0, 0.1, 0.02, 0.05, 0.022, "stealth_dark")                                         # visor
    b.rod((0.06, -0.06, 0.05), (0.06, 0.06, 0.05), 0.007, "stealth_dark", seg=3)                   # handlebar
    b.hoop(-0.16, 0, 0.004, 0.062, 0.04, 0.05, "stealth_dark", seg=10, rot=(0, PI / 2, 0))         # thruster ring
    b.rod((-0.15, 0, 0.004), (-0.17, 0, 0.004), 0.04, "glow", seg=10)
    b.fx("fx_thruster", (-0.185, 0, 0.004))


def army_future(b):
    """A hover tank on its lift field, a rail gun in a faceted turret, two rocket bikes flying above."""
    for x in (-0.2, 0.18):                                                # the lift field on the ground
        for y in (-0.16, 0.16):
            b.cyl(x, y, 0.0, 0.085, 0.006, "glow", seg=8)
    z = 0.075
    b.loft([(-0.38, 0.16, 0.12, z + 0.01, z + 0.1), (-0.26, 0.22, 0.16, z, z + 0.13), (0.2, 0.22, 0.16, z, z + 0.13),
            (0.42, 0.13, 0.05, z + 0.03, z + 0.075)], "stealth_light")
    for s in (-1, 1):                                                     # the lift pods
        with b.at(0, s * 0.235):
            b.loft([(-0.34, 0.03, 0.05, 0.045, 0.125), (0.24, 0.03, 0.05, 0.045, 0.125), (0.35, 0.015, 0.025, 0.07, 0.11)], "stealth")
        b.box(-0.05, s * 0.235, 0.033, 0.5, 0.04, 0.012, "glow")
        b.fx("fx_thruster", (-0.05, s * 0.235, 0.033), DOWN)               # the lift fans blow down
        b.box(-0.06, s * 0.287, 0.07, 0.24, 0.008, 0.035, "team")
    zt = z + 0.13
    b.loft([(-0.17, 0.125, 0.09, zt, zt + 0.085), (0.08, 0.125, 0.09, zt, zt + 0.085), (0.2, 0.06, 0.035, zt, zt + 0.06)], "stealth")
    b.box(-0.045, 0, zt + 0.085, 0.2, 0.15, 0.008, "team")                 # turret roof
    for s in (-1, 1):                                                     # the rails
        b.box(0.37, s * 0.02, zt + 0.02, 0.42, 0.016, 0.034, "stealth_dark")
    b.box(0.36, 0, zt + 0.03, 0.38, 0.026, 0.012, "glow")
    b.rod((-0.14, 0.07, zt + 0.085), (-0.14, 0.07, zt + 0.19), 0.006, "stealth_dark", seg=3)
    b.ball(-0.14, 0.07, zt + 0.2, 0.014, "glow", seg=4)
    for x, y, zz, roll in ((0.2, 0.14, 0.56, -0.18), (-0.17, -0.13, 0.7, 0.18)):   # the escort
        with b.lift(x, y, zz, 1.2, rot=(roll, 0, 0)):
            _rocket_bike(b)


def fleet_future(b):
    """A railgun stealth cruiser: flat facets, a hull that narrows upward, one long rail barrel forward."""
    h = Hull(b, [(-0.5, 0.085, 0.05, 0.085), (-0.3, 0.12, 0.075, 0.09), (0.15, 0.115, 0.07, 0.09),
                 (0.38, 0.06, 0.03, 0.09), (0.52, 0.0, 0.004, 0.085)], "stealth", deck="stealth_dark", inset=0.86)
    h.band(0.0, 0.02, "stealth_dark")
    h.band(0.04, 0.012, "team", top=True)
    b.loft([(-0.24, 0.07, 0.04, 0.09, 0.2), (-0.03, 0.07, 0.035, 0.09, 0.235), (0.09, 0.055, 0.02, 0.09, 0.15)], "stealth_light")
    b.loft([(-0.2, 0.046, 0.046, 0.203, 0.211), (-0.07, 0.042, 0.042, 0.225, 0.233)], "team")     # deckhouse roof
    b.loft([(-0.012, 0.045, 0.03, 0.17, 0.2), (0.012, 0.042, 0.027, 0.166, 0.196)], "glow")       # bridge windows
    b.loft([(-0.17, 0.02, 0.008, 0.2, 0.33), (-0.11, 0.02, 0.008, 0.21, 0.33)], "stealth")       # sensor mast
    b.cyl(-0.38, 0, 0.088, 0.05, 0.005, "team", seg=8)                    # flight deck mark
    b.box(0.1, 0, 0.09, 0.05, 0.07, 0.012, "stealth_dark")                # missile cells
    b.loft([(0.15, 0.045, 0.028, 0.09, 0.135), (0.25, 0.045, 0.028, 0.09, 0.135), (0.3, 0.02, 0.012, 0.09, 0.12)], "stealth_light")
    for s in (-1, 1):                                                     # the rail gun
        b.box(0.42, s * 0.014, 0.103, 0.3, 0.01, 0.026, "stealth_dark")
    b.box(0.42, 0, 0.11, 0.28, 0.02, 0.01, "glow")
    b.fx("fx_wake", (-0.5, 0, 0))


def trader_future(b):
    """An autonomous hydrofoil freighter: a white hull riding on foils, cargo pods, no bridge."""
    z = 0.08
    b.loft([(-0.47, 0.07, 0.085, z, z + 0.07), (-0.3, 0.085, 0.1, z, z + 0.07), (0.25, 0.085, 0.1, z, z + 0.07),
            (0.42, 0.03, 0.05, z + 0.015, z + 0.075), (0.52, 0.0, 0.004, z + 0.04, z + 0.08)], "hull")
    b.loft([(-0.472, 0.083, 0.087, z + 0.04, z + 0.06), (-0.3, 0.098, 0.102, z + 0.04, z + 0.06),
            (0.25, 0.098, 0.102, z + 0.04, z + 0.06)], "team")
    b.loft([(-0.45, 0.07, 0.07, z + 0.066, z + 0.075), (-0.3, 0.086, 0.086, z + 0.066, z + 0.075),
            (0.25, 0.086, 0.086, z + 0.066, z + 0.075), (0.4, 0.04, 0.04, z + 0.07, z + 0.08)], "teal_dark")
    for x in (0.29, -0.33):                                               # foils
        b.box(x, 0, 0.0, 0.07, 0.34, 0.012, "steel")
        for s in (-1, 1):
            b.box(x, s * 0.085, 0.01, 0.04, 0.014, z, "steel")
    cols = ["teal", "white", "orange", "navy_light"]
    zc = z + 0.075 + 0.036
    for i in range(4):                                                    # cargo pods
        x = -0.3 + i * 0.15
        for j, y in enumerate((-0.047, 0.047)):
            c = "team" if (i, j) in ((0, 1), (3, 0)) else cols[(i * 2 + j) % 4]
            b.rod((x - 0.065, y, zc), (x + 0.065, y, zc), 0.04, c, seg=6)
    for i in range(3):
        x = -0.225 + i * 0.15
        b.rod((x - 0.065, 0, zc + 0.066), (x + 0.065, 0, zc + 0.066), 0.04, "team" if i == 1 else cols[i], seg=6)
    b.ball(0.36, 0, z + 0.078, 0.028, "glow")                             # the sensor eye
    b.rod((-0.42, 0, z + 0.07), (-0.42, 0, z + 0.2), 0.008, "steel", seg=3)
    b.ball(-0.42, 0, z + 0.2, 0.016, "glow", seg=4)
    flag(b, -0.455, 0, z + 0.07, 0.19, w=0.1, fh=0.06)
    b.fx("fx_wake", (-0.37, 0, 0))                                        # behind the aft foil


def army_stellar(b):
    """A walker mech: two reverse-knee legs, a chunky body, a gun pod on each shoulder."""
    for s in (-1, 1):
        y = s * 0.17
        b.box(0.03, y, 0, 0.22, 0.13, 0.045, "iron")                      # foot
        _limb(b, (0.01, y, 0.03), (-0.09, y, 0.27), 0.075, 0.085, "hull")  # shin
        _limb(b, (-0.09, y, 0.27), (0.04, y, 0.47), 0.1, 0.105, "hull")    # thigh
        b.disc(-0.09, y, 0.27, 0.06, 0.115, "teal_dark", axis="y", seg=6)  # knee
        b.disc(0.04, s * 0.15, 0.47, 0.065, 0.12, "teal_dark", axis="y", seg=6)
        b.box(0.0, s * 0.215, 0.56, 0.22, 0.11, 0.12, "hull")             # shoulder pod
        b.box(0.0, s * 0.215, 0.68, 0.23, 0.12, 0.014, "team")
        for dy in (-0.025, 0.025):                                        # shoulder guns
            b.rod((0.1, s * 0.215 + dy, 0.62), (0.36, s * 0.215 + dy, 0.62), 0.016, "iron", seg=5)
        b.box(0.115, s * 0.215, 0.585, 0.012, 0.09, 0.07, "teal_dark")
    b.box(0.03, 0, 0.42, 0.14, 0.24, 0.07, "iron")                        # pelvis
    b.box(0.0, 0, 0.47, 0.3, 0.3, 0.21, "hull")                           # body
    b.loft([(0.15, 0.11, 0.1, 0.5, 0.66), (0.27, 0.08, 0.06, 0.53, 0.61)], "hull")   # nose
    b.loft([(0.155, 0.085, 0.07, 0.6, 0.675), (0.262, 0.062, 0.05, 0.575, 0.622)], "glow")   # canopy
    b.box(-0.03, 0, 0.68, 0.17, 0.13, 0.012, "team")                      # roof patch
    b.box(-0.15, 0, 0.5, 0.06, 0.2, 0.2, "teal")                          # reactor pack
    for y in (-0.06, 0.06):
        b.box(-0.185, y, 0.56, 0.01, 0.05, 0.1, "glow")
    b.rod((-0.12, 0.1, 0.68), (-0.14, 0.1, 0.86), 0.007, "iron", seg=3)
    b.ball(-0.14, 0.1, 0.865, 0.016, "glow", seg=4)
    b.fx("fx_dust", (-0.1, 0, 0.02))                                      # it walks, so it kicks up dust


def fleet_stellar(b):
    """A starship holding station above the water: a faceted hull, a delta wing, a tail fin, engine bells."""
    _wash(b, 0.4, 0.13)
    b.loft([(-0.42, 0.08, 0.055, 0.245, 0.37), (-0.2, 0.105, 0.07, 0.22, 0.39), (0.15, 0.085, 0.05, 0.235, 0.365),
            (0.38, 0.035, 0.02, 0.265, 0.325), (0.52, 0.0, 0.003, 0.287, 0.297)], "hull")
    b.loft([(-0.45, 0.3, 0.3, 0.285, 0.302), (-0.3, 0.3, 0.3, 0.285, 0.302), (0.0, 0.085, 0.085, 0.285, 0.302)], "teal")   # delta wing
    for s in (-1, 1):                                                     # wing-tip fins
        b.prism([(-0.46, 0.25), (-0.28, 0.27), (-0.36, 0.38), (-0.47, 0.38)], s * 0.3 - 0.008, s * 0.3 + 0.008, "team")
    b.prism([(-0.43, 0.365), (-0.22, 0.385), (-0.36, 0.56), (-0.47, 0.56)], -0.009, 0.009, "team")   # tail fin
    b.loft([(-0.33, 0.045, 0.045, 0.375, 0.386), (-0.1, 0.05, 0.05, 0.383, 0.394)], "team")       # dorsal stripe
    b.loft([(-0.06, 0.045, 0.028, 0.37, 0.44), (0.08, 0.045, 0.024, 0.365, 0.42), (0.16, 0.02, 0.01, 0.36, 0.385)], "hull")
    b.loft([(0.07, 0.036, 0.022, 0.39, 0.425), (0.13, 0.026, 0.014, 0.378, 0.402)], "glow")       # bridge windows
    for y in (-0.055, 0.055):
        _bell(b, -0.42, y, 0.305, r=0.055, L=0.1)
        b.fx("fx_thruster", (-0.526, y, 0.305))
    b.fx("fx_wake", (-0.4, 0, 0))
    for x in (-0.18, 0.14):                                               # lift emitters under the hull
        b.cyl(x, 0, 0.2, 0.05, 0.03, "glow", seg=6)
    b.cyl(0.27, 0, 0.335, 0.03, 0.022, "teal_dark", seg=6)                # the gun
    b.rod((0.28, 0, 0.35), (0.42, 0, 0.36), 0.008, "iron", seg=4)
    b.box(0.2, 0, 0.255, 0.3, 0.02, 0.02, "teal_dark")                    # keel


def trader_stellar(b):
    """An orbital freighter: a spine through a ring of cargo pods, radiator panels, two engine bells."""
    _wash(b, 0.34, 0.12)
    zc = 0.4
    b.box(-0.02, 0, zc - 0.035, 0.74, 0.07, 0.07, "steel")                # the spine
    b.loft([(0.3, 0.065, 0.055, zc - 0.065, zc + 0.065), (0.42, 0.055, 0.04, zc - 0.055, zc + 0.055),
            (0.52, 0.015, 0.01, zc - 0.02, zc + 0.025)], "hull")          # command module
    b.loft([(0.4, 0.05, 0.04, zc + 0.02, zc + 0.06), (0.47, 0.03, 0.022, zc + 0.008, zc + 0.045)], "glow")
    rx = 0.02
    b.hoop(rx, 0, zc, 0.25, 0.2, 0.06, "hull", seg=12, rot=(0, PI / 2, 0))    # the cargo ring
    b.box(rx, 0, zc - 0.21, 0.03, 0.03, 0.42, "steel")
    b.box(rx, 0, zc - 0.015, 0.03, 0.42, 0.03, "steel")
    cols = ["team", "teal", "orange", "white", "teal", "team", "orange", "white"]
    for k in range(8):                                                    # cargo pods round the ring
        a = PI / 2 + 2 * PI * k / 8
        b.box(rx, 0.27 * math.cos(a), zc + 0.27 * math.sin(a) - 0.045, 0.17, 0.09, 0.09, cols[k], rot=(a, 0, 0))
    b.box(-0.2, 0, zc - 0.005, 0.1, 0.56, 0.01, "solar")                  # radiator panels
    b.box(-0.2, 0, zc + 0.005, 0.012, 0.56, 0.006, "white")
    b.box(-0.37, 0, zc - 0.07, 0.11, 0.17, 0.14, "iron")                  # engine block
    b.box(-0.37, 0, zc + 0.07, 0.09, 0.13, 0.01, "team")
    for y in (-0.05, 0.05):
        _bell(b, -0.42, y, zc, r=0.05, L=0.09)
        b.fx("fx_thruster", (-0.516, y, zc))
    b.fx("fx_wake", (-0.34, 0, 0))
    for x in (-0.3, 0.3):                                                 # lift emitters
        b.cyl(x, 0, zc - 0.075, 0.035, 0.04, "glow", seg=6)


def satellite(b):
    """The `satellite` key of `models` (not an age unit): a foil-wrapped body, two solar panels, a dish."""
    b.cyl(0, 0, 0.0, 0.05, 0.05, "iron", seg=6, r2=0.03)                  # thruster
    b.fx("fx_thruster", (0, 0, 0), DOWN)                                  # the nozzle opens downwards
    b.fx("fx_contrail", (0, 0, 0), DOWN)
    b.box(0, 0, 0.05, 0.2, 0.2, 0.26, "buff")
    b.box(0, 0, 0.14, 0.212, 0.212, 0.06, "team")
    b.box(0, 0, 0.31, 0.14, 0.14, 0.012, "team")
    for s in (-1, 1):                                                     # the solar panels
        b.rod((0, s * 0.1, 0.18), (0, s * 0.19, 0.18), 0.012, "steel", seg=4)
        b.box(0, s * 0.35, 0.174, 0.2, 0.32, 0.012, "solar", rot=(0, 0.45, 0))
        for k in (-1, 0, 1):
            b.box(0, s * (0.35 + k * 0.105), 0.176, 0.204, 0.012, 0.014, "white", rot=(0, 0.45, 0))
    b.dish(0.03, 0.0, 0.335, 0.09, tilt=0.55, mat="white", rz=PI / 2)
    b.rod((-0.06, -0.06, 0.31), (-0.08, -0.08, 0.5), 0.006, "steel", seg=3)
    b.ball(-0.08, -0.08, 0.5, 0.014, "glow", seg=4)


MODELS = {
    ("ancient", "army"): army_ancient, ("ancient", "fleet"): fleet_ancient, ("ancient", "trader"): trader_ancient,
    ("medieval", "army"): army_medieval, ("medieval", "fleet"): fleet_medieval, ("medieval", "trader"): trader_medieval,
    ("gunpowder", "army"): army_gunpowder, ("gunpowder", "fleet"): fleet_gunpowder, ("gunpowder", "trader"): trader_gunpowder,
    ("industrial", "army"): army_industrial, ("industrial", "fleet"): fleet_industrial, ("industrial", "trader"): trader_industrial,
    ("modern", "army"): army_modern, ("modern", "fleet"): fleet_modern, ("modern", "trader"): trader_modern,
    ("future", "army"): army_future, ("future", "fleet"): fleet_future, ("future", "trader"): trader_future,
    ("stellar", "army"): army_stellar, ("stellar", "fleet"): fleet_stellar, ("stellar", "trader"): trader_stellar,
}
