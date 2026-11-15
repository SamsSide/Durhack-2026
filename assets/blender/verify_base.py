"""Verify the remodelled base models (farm, camp, factory, ruin) without Blender: under 1,500
triangles, inside x, z in -0.5..0.5 and y in 0..1 with the base on y = 0, one mesh, exactly one
`team` material, under 80 KB, no textures, and their manifest entries as they were.

  python3 assets/blender/verify_base.py
"""
import json
import os
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "web", "public", "models")
FOOTPRINT = {"farm": 0.8, "camp": 0.6, "factory": 0.8, "ruin": 0.8}


def read_glb(path):
    data = open(path, "rb").read()
    jlen, _ = struct.unpack_from("<II", data, 12)
    return json.loads(data[20:20 + jlen]), len(data)


def main():
    manifest = json.load(open(os.path.join(MODELS, "manifest.json")))
    print(f"{'model':10} {'tris':>5} {'x':>5} {'y':>5} {'z':>5} {'ymin':>6} {'mats':>4} team {'nodes':>5} {'KB':>5} {'foot':>5}  result")
    bad = 0
    for name, foot in FOOTPRINT.items():
        ent = manifest["models"].get(name, {})
        j, size = read_glb(os.path.join(MODELS, name + ".glb"))
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
        ok = (tris < 1500 and abs(mn[1]) < 1e-3 and mx[1] <= 1.0005 and min(mn[0], mn[2]) >= -0.5005
              and max(mx[0], mx[2]) <= 0.5005 and abs(mn[0] + mx[0]) < 1e-3 and abs(mn[2] + mx[2]) < 1e-3
              and names.count("team") == 1 and len(j["meshes"]) == 1 and len(j["nodes"]) == 1
              and size < 80000 and "images" not in j and not j.get("cameras")
              and ent == {"file": name + ".glb", "footprint": foot})
        bad += not ok
        print(f"{name:10} {tris:5d} {ext[0]:5.2f} {ext[1]:5.2f} {ext[2]:5.2f} {mn[1]:6.3f} {len(names):4d} "
              f"{names.count('team'):4d} {len(j['nodes']):5d} {size / 1000:5.1f} {ent.get('footprint', 0):5.2f}  {'ok' if ok else 'FAIL'}")
    print("all ok" if not bad else f"{bad} FAILED")
    sys.exit(1 if bad else 0)


main()
