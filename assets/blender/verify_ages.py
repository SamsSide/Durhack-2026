"""Verify the exported technology-age unit GLBs (and the launch models: rocket, booster, satellite) without Blender: triangles, bounds, materials, size,
and the effect anchors (contract X4: empty nodes named fx_*, local -Z along the effect's stream).

  python3 assets/blender/verify_ages.py

The anchors column lists each anchor with the way its local -Z points in the model: back (-x, the
units face +x), fwd, up, down, left, right, or the vector when it is none of those.
"""
import json
import os
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "web", "public", "models")
FX = ("fx_thruster", "fx_wake", "fx_exhaust", "fx_contrail", "fx_dust", "sep_point")
# the launch models (issue #291) must carry these empties
REQUIRED = {"rocket.glb": {"fx_thruster", "sep_point"}, "booster.glb": {"fx_thruster"},
            "ages/modern/rocket.glb": {"fx_thruster", "sep_point"}, "satellite.glb": {"fx_thruster"}}
WAYS = {(-1, 0, 0): "back", (1, 0, 0): "fwd", (0, 1, 0): "up", (0, -1, 0): "down", (0, 0, 1): "right", (0, 0, -1): "left"}


def read_glb(path):
    data = open(path, "rb").read()
    jlen, _ = struct.unpack_from("<II", data, 12)
    return json.loads(data[20:20 + jlen]), len(data)


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def qrot(q, v):
    x, y, z, w = q
    r = qmul(qmul(q, (v[0], v[1], v[2], 0.0)), (-x, -y, -z, w))
    return r[:3]


def anchors(j):
    """[(name, position, the way local -Z points)] for the empty nodes, in model space, and the
    number of nodes that hold a mesh. Nodes carry translation and rotation only (no scale)."""
    out, meshes = [], 0

    def walk(i, pos, rot):
        nonlocal meshes
        n = j["nodes"][i]
        t = qrot(rot, n.get("translation", (0, 0, 0)))
        pos = tuple(a + c for a, c in zip(pos, t))
        rot = qmul(rot, tuple(n.get("rotation", (0, 0, 0, 1))))
        if "mesh" in n:
            meshes += 1
        else:
            out.append((n.get("name", ""), pos, qrot(rot, (0, 0, -1))))
        for c in n.get("children", ()):
            walk(c, pos, rot)

    for i in j["scenes"][j.get("scene", 0)]["nodes"]:
        walk(i, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0, 1.0))
    return out, meshes


def way(d):
    key = tuple(int(round(c)) for c in d)
    if all(abs(c - k) < 0.02 for c, k in zip(d, key)) and key in WAYS:
        return WAYS[key]
    return "(" + " ".join(f"{c:.2f}" for c in d) + ")"


def main():
    manifest = json.load(open(os.path.join(MODELS, "manifest.json")))
    print(f"{'model':26} {'tris':>5} {'x':>5} {'y':>5} {'z':>5} {'ymin':>6} {'meshes':>6} {'mats':>4} team {'KB':>5}  result  anchors")
    bad = 0
    groups = dict(manifest["ages"])
    # the top-level units: the first two are built by build_models.py, the satellite with the ages kit
    groups["models"] = {k: manifest["models"][k] for k in ("army", "fleet", "satellite", "rocket", "booster") if k in manifest["models"]}
    for style, kinds in groups.items():
        for kind, ent in kinds.items():
            if kind == "formation":                      # checked by verify_formations.py
                continue
            j, size = read_glb(os.path.join(MODELS, ent["file"]))
            tris = 0
            mn = [1e9] * 3
            mx = [-1e9] * 3
            for mesh in j["meshes"]:
                for p in mesh["primitives"]:
                    tris += j["accessors"][p["indices"]]["count"] // 3
                    a = j["accessors"][p["attributes"]["POSITION"]]
                    mn = [min(u, v) for u, v in zip(mn, a["min"])]
                    mx = [max(u, v) for u, v in zip(mx, a["max"])]
            names = [m["name"] for m in j["materials"]]
            ext = [mx[i] - mn[i] for i in range(3)]
            fx, meshes = anchors(j)                      # empties are anchors, not meshes
            fx_ok = all(n.split(".")[0] in FX and (n.count(".") == 0 or n.split(".")[1].isdigit()) for n, _, _ in fx)
            fx_ok = fx_ok and REQUIRED.get(ent["file"], set()) <= {n for n, _, _ in fx}
            ok = (tris < 1500 and max(ext) <= 1.0005 and abs(mn[1]) < 1e-3 and names.count("team") == 1
                  and meshes == 1 and len(j["meshes"]) == 1 and size < 60000 and "images" not in j
                  and not j.get("cameras") and abs(mn[0] + mx[0]) < 2e-3 and abs(mn[2] + mx[2]) < 2e-3 and fx_ok)
            bad += not ok
            notes = ", ".join(f"{n} {way(d)}" for n, _, d in fx) or "none"
            print(f"{style + '/' + kind:26} {tris:5d} {ext[0]:5.2f} {ext[1]:5.2f} {ext[2]:5.2f} {mn[1]:6.3f} "
                  f"{meshes:6d} {len(names):4d} {names.count('team'):4d} {size / 1000:5.1f}  {'ok' if ok else 'FAIL':6}  {notes}")
            if "-v" in sys.argv:
                for n, p, d in fx:
                    print(f"{'':28}{n:18} at ({p[0]:6.3f} {p[1]:6.3f} {p[2]:6.3f})  streams {way(d)}")
    print("all ok" if not bad else f"{bad} FAILED")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
