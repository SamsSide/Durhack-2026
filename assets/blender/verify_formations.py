"""Verify the 21 army formation GLBs (issue #287, `ages.<age>.formation`) without Blender: all 21 are
in the manifest, under 800 triangles, fit the 1 x 1 x 1 box with the origin at the base centre, one
mesh, exactly one `team` material, under 40 KB, no textures, and only fx_* anchors.

  python3 assets/blender/verify_formations.py        # -v adds anchor positions
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from verify_ages import FX, MODELS, anchors, read_glb, way  # noqa: E402

AGES = ["ancient", "medieval", "gunpowder", "industrial", "modern", "future", "stellar"]
ROLES = ["front", "flank", "back"]
MAX_TRIS, MAX_BYTES = 800, 40000


def main():
    manifest = json.load(open(os.path.join(MODELS, "manifest.json")))
    print(f"{'model':28} {'tris':>5} {'x':>5} {'y':>5} {'z':>5} {'ymin':>6} {'mats':>4} team {'KB':>5} {'foot':>5}  result  anchors")
    bad = 0
    for age in AGES:
        ages = manifest["ages"][age]
        if "army" not in ages:
            print(f"ages.{age}.army is missing (the fallback)")
            bad += 1
        for role in ROLES:
            ent = ages.get("formation", {}).get(role)
            if not ent or ent.get("file") != f"ages/{age}/formation_{role}.glb" or not 0 < ent.get("footprint", 0) <= 1:
                print(f"{age + '/' + role:28} manifest entry missing or wrong: {ent}")
                bad += 1
                continue
            j, size = read_glb(os.path.join(MODELS, ent["file"]))
            tris = 0
            mn, mx = [1e9] * 3, [-1e9] * 3
            for mesh in j["meshes"]:
                for p in mesh["primitives"]:
                    tris += j["accessors"][p["indices"]]["count"] // 3
                    a = j["accessors"][p["attributes"]["POSITION"]]
                    mn = [min(u, v) for u, v in zip(mn, a["min"])]
                    mx = [max(u, v) for u, v in zip(mx, a["max"])]
            names = [m["name"] for m in j["materials"]]
            ext = [mx[i] - mn[i] for i in range(3)]
            fx, meshes = anchors(j)
            fx_ok = all(n.split(".")[0] in FX and (n.count(".") == 0 or n.split(".")[1].isdigit()) for n, _, _ in fx)
            ok = (tris <= MAX_TRIS and max(ext) <= 1.0005 and abs(mn[1]) < 1e-3 and names.count("team") == 1
                  and meshes == 1 and len(j["meshes"]) == 1 and size < MAX_BYTES and "images" not in j
                  and not j.get("cameras") and abs(mn[0] + mx[0]) < 2e-3 and abs(mn[2] + mx[2]) < 2e-3 and fx_ok)
            bad += not ok
            notes = ", ".join(f"{n} {way(d)}" for n, _, d in fx) or "none"
            print(f"{age + '/formation_' + role:28} {tris:5d} {ext[0]:5.2f} {ext[1]:5.2f} {ext[2]:5.2f} {mn[1]:6.3f} "
                  f"{len(names):4d} {names.count('team'):4d} {size / 1000:5.1f} {ent['footprint']:5.2f}  {'ok' if ok else 'FAIL':6}  {notes}")
            if "-v" in sys.argv:
                for n, p, d in fx:
                    print(f"{'':30}{n:18} at ({p[0]:6.3f} {p[1]:6.3f} {p[2]:6.3f})  streams {way(d)}")
    print("all ok" if not bad else f"{bad} FAILED")
    sys.exit(1 if bad else 0)


main()
