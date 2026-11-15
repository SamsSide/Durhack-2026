"""Verify the exported tree GLBs (`trees` in the manifest, and `tree.glb`) without Blender: under 600
triangles, inside x, z in -0.5..0.5 and y in 0..1 with the base on y = 0, one mesh, at most one
`team` material, under 30 KB, no textures.

  python3 assets/blender/verify_trees.py
"""
import json
import os
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "web", "public", "models")


def read_glb(path):
    data = open(path, "rb").read()
    jlen, _ = struct.unpack_from("<II", data, 12)
    return json.loads(data[20:20 + jlen]), len(data)


def main():
    manifest = json.load(open(os.path.join(MODELS, "manifest.json")))
    entries = dict(manifest.get("trees", {}))
    entries["(models.tree)"] = manifest["models"]["tree"]
    print(f"{'model':16} {'tris':>5} {'x':>5} {'y':>5} {'z':>5} {'ymin':>6} {'mats':>4} team {'KB':>5} {'foot':>5}  result")
    bad = 0 if len(entries) >= 5 else 1
    for name, ent in entries.items():
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
        ok = (tris <= 600 and abs(mn[1]) < 1e-3 and mx[1] <= 1.0005 and min(mn[0], mn[2]) >= -0.5005
              and max(mx[0], mx[2]) <= 0.5005 and names.count("team") <= 1 and len(j["meshes"]) == 1
              and size < 30000 and "images" not in j and not j.get("cameras") and 0 < ent.get("footprint", 0) <= 1)
        bad += not ok
        print(f"{name:16} {tris:5d} {ext[0]:5.2f} {ext[1]:5.2f} {ext[2]:5.2f} {mn[1]:6.3f} {len(names):4d} "
              f"{names.count('team'):4d} {size / 1000:5.1f} {ent['footprint']:5.2f}  {'ok' if ok else 'FAIL'}")
    print("all ok" if not bad else f"{bad} FAILED")
    sys.exit(1 if bad else 0)


main()
