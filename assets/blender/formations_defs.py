"""The 21 army formation models (issue #287, contract X4 `ages.<age>.formation`): for each of the
seven ages a `front` (infantry), a `flank` (mounted or vehicles) and a `back` (ranged or support).
Lane b draws an army as 3 to 7 of these, instanced in formation; `ages.<age>.army` stays the fallback.

Each model is ONE small group for its role, drawn with the age unit helpers in ages_defs.py so the
style is the same: the one `ages` palette, one `team` material, facing +x, a few hundred triangles
(the verifier's cap is 800). Every model shows `team` from straight above (crests, shoulders, packs,
turret roofs, counterweights). Anchors: `fx_dust` behind anything that marches or rolls, `fx_exhaust`
on engines, `fx_thruster` under things that hover and on the mech's jump pack.
"""
import math

from ages_defs import (_armoured_car, _cannon, _field_gun, _hoplite, _hover_tank, _knight, _limb,
                       _musketeer, _rifleman, _tank)
from ages_kit import DOWN, UP, horse, man

PI = math.pi
ROLES = ["front", "flank", "back"]


def _row(b, fig, ys, xs=None):
    for i, y in enumerate(ys):
        with b.at(0.0 if xs is None else xs[i], y):
            fig(b)


# ================================================================ ancient
def front_ancient(b):
    """Three spearmen with round shields, shoulder to shoulder."""
    _row(b, _hoplite, (-0.2, 0.0, 0.2))
    b.fx("fx_dust", (-0.07, 0, 0.02))


def flank_ancient(b):
    """A war chariot: two horses, a two-wheeled car, a driver and an archer."""
    for y in (-0.062, 0.062):
        with b.at(0.13, y):
            horse(b)
    b.rod((-0.2, 0, 0.13), (0.1, 0, 0.21), 0.012, "wood_dark", seg=3)   # the pole
    for y in (-0.105, 0.105):
        b.disc(-0.26, y, 0.085, 0.085, 0.016, "wood_dark", axis="y", seg=8)
    b.rod((-0.26, -0.12, 0.085), (-0.26, 0.12, 0.085), 0.01, "dark", seg=3)
    b.box(-0.27, 0, 0.1, 0.15, 0.17, 0.02, "wood")                        # floor
    b.prism([(-0.2, 0.12), (-0.18, 0.12), (-0.2, 0.24), (-0.23, 0.24)], -0.085, 0.085, "team")   # breastwork
    for y in (-0.08, 0.08):
        b.box(-0.27, y, 0.12, 0.13, 0.012, 0.07, "team")                  # side screens
    with b.lift(-0.29, 0.042, 0.12):                                      # the driver
        top = man(b, "canvas", legs="skin", s=0.9)
        b.box(0, 0, top - 0.03, 0.07, 0.07, 0.045, "bronze")
    with b.lift(-0.29, -0.045, 0.12):                                     # the archer
        top = man(b, "terracotta", legs="skin", s=0.9)
        b.box(0, 0, top - 0.01, 0.068, 0.068, 0.02, "wood_dark")
        b.path([(0.07, -0.06, 0.05), (0.12, -0.06, 0.13), (0.12, -0.06, 0.24), (0.07, -0.06, 0.32)], 0.01, "wood_dark", seg=3)
    b.fx("fx_dust", (-0.34, 0, 0.02))


def _archer_f(b):
    top = man(b, "team", legs="skin")                                     # team tunic, seen from above
    b.box(0, 0, top - 0.01, 0.075, 0.075, 0.02, "wood_dark")             # hair
    b.path([(0.05, -0.08, 0.012), (0.15, -0.08, 0.1), (0.17, -0.08, 0.25), (0.15, -0.08, 0.4), (0.05, -0.08, 0.5)],
           0.015, "wood_dark", seg=3)                                     # a tall bow, held up
    b.rod((0.05, -0.08, 0.5), (0.05, -0.08, 0.012), 0.003, "canvas", seg=3)   # string
    b.box(-0.055, 0.03, 0.13, 0.035, 0.045, 0.15, "wood", rot=(0.35, 0, 0))  # quiver
    b.box(-0.07, 0.06, 0.27, 0.02, 0.03, 0.04, "white", rot=(0.35, 0, 0))     # fletching


def back_ancient(b):
    """Three archers, bows ready, in a loose staggered line."""
    _row(b, _archer_f, (-0.18, 0.0, 0.18), xs=(0.03, -0.04, 0.03))
    b.fx("fx_dust", (-0.1, 0, 0.02))


# ================================================================ medieval
def _man_at_arms(b):
    top = man(b, "team", legs="iron")                                     # the team surcoat
    b.box(0, 0, top - 0.05, 0.078, 0.078, 0.07, "steel")                  # bascinet
    b.box(0.0, 0, top + 0.02, 0.03, 0.03, 0.02, "steel")
    b.box(0.04, 0, top - 0.03, 0.004, 0.05, 0.01, "dark")                 # eye slit
    b.prism([(-0.02, 0.24), (0.07, 0.24), (0.07, 0.15), (0.025, 0.05)], 0.07, 0.084, "white")   # kite shield
    b.rod((0.035, -0.085, 0.0), (0.035, -0.085, 0.46), 0.008, "wood_dark", seg=3)   # poleaxe
    b.box(0.045, -0.085, 0.38, 0.04, 0.01, 0.07, "steel")
    b.rod((0.035, -0.085, 0.46), (0.035, -0.085, 0.51), 0.012, "steel", seg=3, r2=0.0)


def front_medieval(b):
    """Three men-at-arms in team surcoats with kite shields and poleaxes."""
    _row(b, _man_at_arms, (-0.2, 0.0, 0.2))
    b.fx("fx_dust", (-0.07, 0, 0.02))


def flank_medieval(b):
    """A knight on horseback with a couched lance."""
    _knight(b, "horse2")
    b.fx("fx_dust", (-0.2, 0, 0.02))


def back_medieval(b):
    """A counterweight trebuchet, cocked, with one crewman."""
    for y in (-0.12, 0.12):
        b.box(0.0, y, 0.0, 0.52, 0.04, 0.04, "wood_dark")                 # base beams
        b.rod((-0.17, y, 0.04), (0.0, y, 0.44), 0.014, "wood", seg=4)     # the A-frame
        b.rod((0.17, y, 0.04), (0.0, y, 0.44), 0.014, "wood", seg=4)
    for x in (-0.2, 0.2):
        b.box(x, 0, 0.0, 0.04, 0.28, 0.035, "wood_dark")
    b.rod((0, -0.15, 0.43), (0, 0.15, 0.43), 0.013, "iron", seg=4)       # axle
    b.rod((0.13, 0, 0.53), (-0.37, 0, 0.115), 0.016, "wood_light", seg=4)  # the arm, long end down at the back
    b.box(0.13, 0, 0.35, 0.14, 0.16, 0.14, "team")                       # counterweight
    b.rod((0.13, 0, 0.49), (0.13, 0, 0.53), 0.01, "dark", seg=3)
    b.path([(-0.37, 0, 0.115), (-0.29, 0, 0.04), (-0.2, 0, 0.03)], 0.006, "dark", seg=3)   # sling
    b.ball(-0.2, 0, 0.03, 0.03, "iron")
    with b.at(-0.1, 0.22):                                                # a crewman
        top = man(b, "wood_light", legs="wood_dark")
        b.cyl(0, 0, top - 0.012, 0.062, 0.014, "steel", seg=6)
        b.box(0, 0, top, 0.05, 0.05, 0.025, "steel")
    b.fx("fx_dust", (-0.3, 0, 0.02))


# ================================================================ gunpowder
def front_gunpowder(b):
    """Three musketeers in team coats and tricorns."""
    _row(b, _musketeer, (-0.19, 0.0, 0.19))
    b.fx("fx_dust", (-0.07, 0, 0.02))


def flank_gunpowder(b):
    """A dragoon: a team coat and tricorn on horseback, sabre raised."""
    horse(b, "horse")
    b.box(-0.01, 0, 0.23, 0.07, 0.11, 0.12, "team")                       # coat
    for y in (-0.064, 0.064):
        b.box(0.0, y, 0.14, 0.045, 0.022, 0.1, "white")                   # breeches and boots
        b.box(0.0, y, 0.12, 0.05, 0.024, 0.03, "black")
    b.box(-0.01, 0, 0.35, 0.062, 0.062, 0.06, "skin")
    b.cyl(-0.01, 0, 0.405, 0.074, 0.015, "black", seg=3, rot=(0, 0, PI))  # tricorn
    b.box(-0.01, 0, 0.415, 0.046, 0.046, 0.022, "black")
    b.rod((0.03, -0.075, 0.3), (0.14, -0.075, 0.6), 0.008, "steel", seg=3)   # sabre
    b.box(0.03, -0.075, 0.29, 0.03, 0.02, 0.012, "bronze")
    b.fx("fx_dust", (-0.2, 0, 0.02))


def back_gunpowder(b):
    """A bronze cannon with its gunner, rammer in hand, and a powder chest."""
    _cannon(b)
    with b.at(-0.16, -0.19):
        top = man(b, "team", legs="white")
        b.cyl(0, 0, top - 0.005, 0.078, 0.016, "black", seg=3, rot=(0, 0, PI))
        b.box(0, 0, top + 0.01, 0.05, 0.05, 0.022, "black")
        b.rod((-0.02, -0.08, 0.02), (0.1, -0.08, 0.45), 0.007, "wood_light", seg=3)   # rammer
        b.cyl(0.1, -0.08, 0.44, 0.02, 0.04, "canvas", seg=4)
    b.box(-0.16, 0.2, 0.0, 0.1, 0.08, 0.06, "wood_dark")                  # powder chest
    b.box(-0.16, 0.2, 0.06, 0.104, 0.084, 0.014, "team")
    b.fx("fx_dust", (-0.28, 0, 0.02))


# ================================================================ industrial
def _rifleman_f(b, kneel=False):
    _rifleman(b, kneel=kneel)
    z = -0.06 if kneel else 0.0
    b.box(-0.056, 0, 0.13 + z, 0.036, 0.1, 0.1, "team")                   # pack


def front_industrial(b):
    """Three riflemen with team packs, the middle one kneeling to fire."""
    with b.at(0.0, -0.19):
        _rifleman_f(b)
    with b.at(0.05, 0.0):
        _rifleman_f(b, kneel=True)
    with b.at(0.0, 0.19):
        _rifleman_f(b)
    b.fx("fx_dust", (-0.08, 0, 0.02))


def flank_industrial(b):
    """An armoured car with a team turret and flag."""
    _armoured_car(b)
    b.fx("fx_dust", (-0.21, 0, 0.02))


def back_industrial(b):
    """A field gun with its gun shield and a kneeling loader."""
    _field_gun(b)
    with b.at(-0.15, 0.2):
        _rifleman_f(b, kneel=True)
    b.fx("fx_dust", (-0.25, 0, 0.02))


# ================================================================ modern
def _squaddie(b):
    top = man(b, "olive", legs="olive_dark")
    b.cyl(0, 0, top - 0.022, 0.05, 0.04, "olive_dark", seg=6)            # helmet
    b.box(-0.055, 0, 0.13, 0.04, 0.1, 0.1, "team")                        # pack
    b.box(0.07, -0.03, 0.17, 0.2, 0.022, 0.03, "black")                   # rifle held forward
    b.box(0.04, -0.035, 0.18, 0.08, 0.04, 0.03, "olive")                  # arms


def front_modern(b):
    """An infantry squad of four in two staggered pairs."""
    for x, y in ((0.07, -0.21), (0.07, 0.07), (-0.07, -0.07), (-0.07, 0.21)):
        with b.at(x, y):
            _squaddie(b)
    b.fx("fx_dust", (-0.12, 0, 0.02))


def flank_modern(b):
    """A main battle tank."""
    _tank(b)


def back_modern(b):
    """A self-propelled gun: tracks, a big boxy turret set back, a long barrel raised high."""
    track = [(-0.31, 0.06), (-0.27, 0.0), (0.25, 0.0), (0.31, 0.06), (0.31, 0.085), (0.27, 0.115), (-0.28, 0.115), (-0.31, 0.085)]
    for s in (-1, 1):
        b.prism(track, s * 0.095, s * 0.16, "black")
        for i in range(5):
            b.disc(-0.22 + i * 0.11, s * 0.162, 0.045, 0.036, 0.008, "olive_dark", axis="y", seg=6)
        b.box(0.0, s * 0.128, 0.115, 0.6, 0.075, 0.012, "olive")
    b.prism([(-0.3, 0.06), (0.27, 0.06), (0.31, 0.1), (0.2, 0.15), (-0.3, 0.15)], -0.1, 0.1, "olive")
    b.box(-0.1, 0, 0.15, 0.34, 0.23, 0.17, "olive")                       # the tall turret, set back
    b.box(-0.1, 0, 0.23, 0.342, 0.232, 0.03, "team")                      # turret band
    b.box(-0.12, 0, 0.32, 0.22, 0.17, 0.006, "team")                      # roof panel, seen from orbit
    b.box(0.08, 0, 0.21, 0.04, 0.1, 0.09, "olive_dark")                   # mantlet
    b.rod((0.08, 0, 0.26), (0.4, 0, 0.66), 0.017, "olive_dark", seg=6)    # the barrel, raised high
    b.rod((0.385, 0, 0.641), (0.425, 0, 0.691), 0.025, "olive_dark", seg=6)  # muzzle brake
    b.box(-0.32, 0, 0.02, 0.025, 0.22, 0.09, "olive_dark")                # recoil spade
    b.fx("fx_exhaust", (-0.29, 0.06, 0.155), UP)
    b.fx("fx_dust", (-0.33, 0, 0.02))


# ================================================================ future
def _power_trooper(b):
    for y in (-0.036, 0.036):
        b.box(0, y, 0, 0.075, 0.048, 0.13, "stealth_dark")               # legs
    b.box(0, 0, 0.12, 0.1, 0.15, 0.12, "stealth_light")                   # armoured torso
    b.box(0.051, 0, 0.17, 0.004, 0.06, 0.02, "glow")                      # chest light
    for y in (-0.085, 0.085):
        b.box(0, y, 0.2, 0.095, 0.06, 0.05, "team")                       # pauldrons
    b.box(0.005, 0, 0.235, 0.075, 0.075, 0.07, "stealth")                 # helmet
    b.box(0.044, 0, 0.265, 0.006, 0.06, 0.018, "glow")                    # visor
    b.box(-0.075, 0, 0.13, 0.05, 0.1, 0.11, "stealth_dark")               # jump pack
    b.box(0.09, -0.1, 0.15, 0.2, 0.026, 0.036, "stealth_dark")            # rail rifle
    b.box(0.1, -0.1, 0.186, 0.16, 0.012, 0.006, "glow")


def front_future(b):
    """Three power-armour troopers with rail rifles."""
    _row(b, _power_trooper, (-0.2, 0.0, 0.2))
    b.fx("fx_dust", (-0.1, 0, 0.02))


def flank_future(b):
    """The hover tank on its lift field (the future army without its rocket-bike escort)."""
    _hover_tank(b)


def _drone(b):
    """A quad drone, about 0.2 across, drawn round its own centre."""
    for a in (PI / 4, -PI / 4):
        b.box(0, 0, -0.006, 0.22, 0.018, 0.012, "stealth_dark", rot=(0, 0, a))
    b.box(0, 0, -0.018, 0.06, 0.06, 0.034, "team")
    for k in range(4):
        a = PI / 4 + k * PI / 2
        b.cyl(0.078 * math.cos(a), 0.078 * math.sin(a), 0.002, 0.036, 0.006, "glow", seg=6)
    b.fx("fx_thruster", (0, 0, -0.018), DOWN)


def back_future(b):
    """A drone launcher: a hover sled carrying a launch rack, two drones lifting off above it."""
    for x in (-0.15, 0.13):                                               # the lift field
        for y in (-0.1, 0.1):
            b.cyl(x, y, 0.0, 0.06, 0.006, "glow", seg=6)
    z = 0.06
    b.loft([(-0.28, 0.12, 0.1, z, z + 0.07), (0.2, 0.12, 0.1, z, z + 0.07), (0.31, 0.07, 0.04, z + 0.015, z + 0.06)], "stealth_light")
    for s in (-1, 1):
        b.box(-0.03, s * 0.12, 0.03, 0.42, 0.03, 0.01, "glow")
        b.fx("fx_thruster", (-0.03, s * 0.12, 0.03), DOWN)
    b.box(-0.07, 0, z + 0.07, 0.24, 0.2, 0.1, "stealth")                  # the launch rack
    b.box(-0.07, 0, z + 0.17, 0.24, 0.2, 0.006, "team")
    for dx in (-0.055, 0.055):                                            # open launch cells
        for dy in (-0.05, 0.05):
            b.box(-0.07 + dx, dy, z + 0.172, 0.06, 0.06, 0.006, "glow")
    b.rod((0.15, 0.05, z + 0.07), (0.15, 0.05, z + 0.2), 0.006, "stealth_dark", seg=3)
    b.ball(0.15, 0.05, z + 0.21, 0.014, "glow", seg=4)
    with b.lift(0.1, -0.1, 0.36, rot=(0.15, 0.1, 0)):
        _drone(b)
    with b.lift(-0.12, 0.09, 0.5, rot=(-0.12, 0.15, 0)):
        _drone(b)


# ================================================================ stellar
def _walker_trooper(b):
    """A soldier on reverse-knee exo legs in the stellar white shell, about 0.33 tall."""
    for y in (-0.042, 0.042):
        b.box(0.025, y, 0, 0.085, 0.04, 0.02, "iron")                     # foot
        _limb(b, (0.0, y, 0.015), (-0.045, y, 0.12), 0.035, 0.04, "hull")  # shin
        _limb(b, (-0.045, y, 0.12), (0.02, y, 0.2), 0.045, 0.045, "hull")  # thigh
    b.box(0, 0, 0.18, 0.1, 0.13, 0.1, "hull")                             # body
    b.box(0.051, 0, 0.2, 0.004, 0.08, 0.05, "teal_dark")
    for y in (-0.075, 0.075):
        b.box(0, y, 0.25, 0.085, 0.045, 0.04, "team")                     # shoulders
    b.box(0.01, 0, 0.28, 0.07, 0.07, 0.055, "hull")                       # helmet
    b.box(0.047, 0, 0.297, 0.004, 0.055, 0.016, "glow")                   # visor
    b.box(-0.065, 0, 0.2, 0.04, 0.09, 0.08, "teal")                       # reactor pack
    b.rod((-0.01, -0.1, 0.23), (0.17, -0.1, 0.23), 0.014, "iron", seg=5)  # arm gun
    b.rod((0.17, -0.1, 0.23), (0.18, -0.1, 0.23), 0.011, "glow", seg=5)


def front_stellar(b):
    """Three walker infantry on reverse-knee exo legs."""
    _row(b, _walker_trooper, (-0.2, 0.0, 0.2))
    b.fx("fx_dust", (-0.1, 0, 0.02))


def flank_stellar(b):
    """A humanoid battle mech: an arm cannon, an energy blade, a jump pack on its back."""
    for s in (-1, 1):
        y = s * 0.1
        b.box(0.03, y, 0, 0.17, 0.09, 0.04, "iron")                       # foot
        b.box(0, y, 0.04, 0.09, 0.08, 0.19, "hull")                       # shin
        b.disc(0.0, y, 0.235, 0.05, 0.1, "teal_dark", axis="y", seg=6)    # knee
        b.box(-0.01, y, 0.24, 0.1, 0.09, 0.16, "hull")                    # thigh
    b.box(0, 0, 0.38, 0.12, 0.26, 0.07, "iron")                           # hips
    b.box(0, 0, 0.43, 0.22, 0.3, 0.2, "hull")                             # torso
    b.box(0.111, 0, 0.5, 0.006, 0.14, 0.05, "glow")                       # chest light
    b.box(0.03, 0, 0.63, 0.11, 0.11, 0.075, "hull")                       # head
    b.box(0.086, 0, 0.65, 0.006, 0.09, 0.022, "glow")                     # visor
    for s in (-1, 1):
        b.box(0, s * 0.205, 0.56, 0.16, 0.12, 0.1, "team")                # shoulder plates
        b.box(0, s * 0.205, 0.4, 0.07, 0.07, 0.16, "hull")                # upper arms
    b.rod((-0.04, -0.205, 0.4), (0.3, -0.205, 0.4), 0.04, "iron", seg=6)   # arm cannon
    b.rod((0.3, -0.205, 0.4), (0.315, -0.205, 0.4), 0.028, "glow", seg=6)
    b.box(0.04, 0.205, 0.35, 0.1, 0.075, 0.06, "teal_dark")               # fist
    b.box(0.22, 0.205, 0.365, 0.26, 0.014, 0.035, "glow")                 # energy blade
    b.box(-0.15, 0, 0.44, 0.08, 0.2, 0.18, "teal")                        # jump pack
    for y in (-0.06, 0.06):
        b.cyl(-0.17, y, 0.4, 0.03, 0.04, "iron", seg=6)
        b.fx("fx_thruster", (-0.17, y, 0.4), DOWN)
    b.fx("fx_dust", (-0.1, 0, 0.02))


def back_stellar(b):
    """An orbital-strike beacon: a pylon on a tripod painting a target ring, its beam going up, and a
    walker trooper standing by."""
    b.hoop(0, 0, 0.003, 0.3, 0.26, 0.006, "glow", seg=12)                 # the target ring
    for k in range(3):
        a = PI / 6 + 2 * PI * k / 3
        b.rod((0.17 * math.cos(a), 0.17 * math.sin(a), 0.0), (0, 0, 0.24), 0.012, "iron", seg=4)
    z0 = 0.15
    b.lathe(0, 0, z0, [(0.0, 0.0), (0.07, 0.0), (0.07, 0.06), (0.04, 0.12), (0.035, 0.42), (0.07, 0.46),
                       (0.05, 0.5), (0.0, 0.52)], "hull", seg=6)
    b.cyl(0, 0, z0 + 0.2, 0.05, 0.04, "team", seg=6)                      # band
    b.cyl(0, 0, z0 + 0.455, 0.074, 0.012, "team", seg=8)                  # crown, seen from above
    b.dish(0.07, 0, z0 + 0.3, 0.06, tilt=0.6, mat="white", rz=PI / 2)
    b.rod((0, 0, z0 + 0.52), (0, 0, 0.98), 0.014, "glow", seg=4)          # the targeting beam
    with b.at(-0.24, 0.2):
        _walker_trooper(b)
    b.fx("fx_dust", (-0.3, 0, 0.02))


FORMATIONS = {}
for _age in ("ancient", "medieval", "gunpowder", "industrial", "modern", "future", "stellar"):
    for _role in ROLES:
        FORMATIONS[(_age, _role)] = globals()[f"{_role}_{_age}"]
