"""Verify the exported style GLBs without Blender: triangles, bounds, materials, size.

  python3 assets/blender/verify_styles.py
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
    print(f"{'model':26} {'tris':>5} {'x':>5} {'y':>5} {'z':>5} {'ymin':>6} {'meshes':>6} {'mats':>4} team {'KB':>5}  result")
    bad = 0
    for style, kinds in manifest["styles"].items():
        for kind, ent in kinds.items():
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
            ok = (tris < 1500 and max(ext) <= 1.0005 and abs(mn[1]) < 1e-3 and names.count("team") == 1
                  and len(j["meshes"]) == 1 and size < 60000 and "images" not in j and not j.get("cameras")
                  and abs(mn[0] + mx[0]) < 2e-3 and abs(mn[2] + mx[2]) < 2e-3)
            bad += not ok
            print(f"{style + '/' + kind:26} {tris:5d} {ext[0]:5.2f} {ext[1]:5.2f} {ext[2]:5.2f} {mn[1]:6.3f} "
                  f"{len(j['meshes']):6d} {len(names):4d} {names.count('team'):4d} {size / 1000:5.1f}  {'ok' if ok else 'FAIL'}")
    print("all ok" if not bad else f"{bad} FAILED")
    sys.exit(1 if bad else 0)


main()
