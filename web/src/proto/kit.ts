// A three.js mirror of the owner's Blender kit (assets/blender/styles_kit.py): the same primitives with
// the same arguments, in Blender coordinates (x, y on the ground, z up), so a prototype here reads
// line for line as a build_styles.py layout. build() converts to glTF axes (+Y up), puts the origin at
// the base centre and scales the model to fit 1 x 1 x 1, like Builder.build().
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Vec3 = [number, number, number];
export type Rgb = [number, number, number];
export type Palette = Record<string, string>;

/** The neutral team colour the Blender kit uses; the game tints it per nation. */
export const TEAM_HEX = '#EDE8D9';

const BLENDER_TO_GLTF = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
const WHITE: Rgb = [1, 1, 1];

function prepare(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  g.computeVertexNormals();
  return g;
}

function paint(geo: THREE.BufferGeometry, fn: (c: THREE.Vector3, n: THREE.Vector3) => Rgb): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), cen = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    cen.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const rgb = fn(cen, n);
    for (let k = 0; k < 3; k++) col.set(rgb, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export class Kit {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  constructor(readonly style: string, readonly palette: Palette) {}

  /** Like Builder.at(): place what fn builds at (x, y), turned rz about the vertical. */
  at(x: number, y: number, rz: number, fn: () => void): void {
    const top = this.stack[this.stack.length - 1]!;
    this.stack.push(top.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, 0)).multiply(new THREE.Matrix4().makeRotationZ(rz)));
    try { fn(); } finally { this.stack.pop(); }
  }

  private place(x: number, y: number, z: number, rot: Vec3 = [0, 0, 0]): THREE.Matrix4 {
    const top = this.stack[this.stack.length - 1]!;
    return top.clone()
      .multiply(new THREE.Matrix4().makeTranslation(x, y, z))
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'ZYX')));
  }

  private add(geo: THREE.BufferGeometry, mat: string, m: THREE.Matrix4, colour?: (c: THREE.Vector3, n: THREE.Vector3) => Rgb): void {
    const g = prepare(geo);
    paint(g, colour ?? (() => WHITE));
    g.applyMatrix4(m);
    g.computeVertexNormals();
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }

  // ---- primitives (same names and arguments as styles_kit.py)

  box(x: number, y: number, z0: number, sx: number, sy: number, sz: number, mat: string, rot: Vec3 = [0, 0, 0]): void {
    const m = this.place(x, y, z0 + sz / 2, rot).multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
    this.add(new THREE.BoxGeometry(1, 1, 1), mat, m);
  }

  cyl(x: number, y: number, z0: number, r: number, h: number, mat: string, seg = 8, r2?: number, rot: Vec3 = [0, 0, 0]): void {
    const geo = new THREE.CylinderGeometry(r2 ?? r, r, h, seg, 1).rotateX(Math.PI / 2);
    this.add(geo, mat, this.place(x, y, z0 + h / 2, rot));
  }

  cone(x: number, y: number, z0: number, r: number, h: number, mat: string, seg = 8, rot: Vec3 = [0, 0, 0]): void {
    this.cyl(x, y, z0, r, h, mat, seg, 0.0001, rot);
  }

  /** Half cylinder lying along local x (a hangar vault or barrel roof), flat side down. */
  vault(x: number, y: number, z0: number, r: number, len: number, mat: string, rz = 0, seg = 6): void {
    const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2);
    this.add(geo, mat, this.place(x, y, z0, [0, 0, rz]));
  }

  private poly(faces: Vec3[][], m: THREE.Matrix4, mat: string): void {
    const pts: number[] = [];
    const all = faces.flat();
    const cen = all.reduce((s, p) => s.add(new THREE.Vector3(...p)), new THREE.Vector3()).multiplyScalar(1 / all.length);
    const key = (p: Vec3) => p.map((v) => v.toFixed(5)).join(',');
    for (const face of faces) {
      const vs: Vec3[] = [];
      for (const p of face) if (!vs.length || key(vs[vs.length - 1]!) !== key(p)) vs.push(p);
      if (vs.length > 1 && key(vs[0]!) === key(vs[vs.length - 1]!)) vs.pop();
      if (new Set(vs.map(key)).size < 3) continue;
      for (let i = 1; i < vs.length - 1; i++) {
        let tri: Vec3[] = [vs[0]!, vs[i]!, vs[i + 1]!];
        const [a, b, c] = tri.map((p) => new THREE.Vector3(...p)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        if (n.lengthSq() < 1e-12) continue;
        const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(cen);
        if (n.dot(mid) < 0) tri = [tri[0]!, tri[2]!, tri[1]!];
        for (const p of tri) pts.push(...p);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.add(geo, mat, m);
  }

  /** Box-like solid, bottom w0 x d0, top w1 x d1 (0 gives a ridge or apex), top shifted by (ox, oy). */
  frustum(x: number, y: number, z0: number, w0: number, d0: number, w1: number, d1: number, h: number, mat: string, rz = 0, ox = 0, oy = 0): void {
    const b: Vec3[] = [[-w0 / 2, -d0 / 2, 0], [w0 / 2, -d0 / 2, 0], [w0 / 2, d0 / 2, 0], [-w0 / 2, d0 / 2, 0]];
    const t: Vec3[] = [[-w1 / 2 + ox, -d1 / 2 + oy, h], [w1 / 2 + ox, -d1 / 2 + oy, h], [w1 / 2 + ox, d1 / 2 + oy, h], [-w1 / 2 + ox, d1 / 2 + oy, h]];
    const faces: Vec3[][] = [[b[3]!, b[2]!, b[1]!, b[0]!], [t[0]!, t[1]!, t[2]!, t[3]!]];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; faces.push([b[i]!, b[j]!, t[j]!, t[i]!]); }
    this.poly(faces, this.place(x, y, z0, [0, 0, rz]), mat);
  }

  /** Solid of revolution. profile = [[radius, z], ...] from bottom to top. */
  lathe(x: number, y: number, z0: number, profile: [number, number][], mat: string, seg = 8, rz = 0): void {
    const rings = profile.map(([r, z]) => Array.from({ length: seg }, (_, i): Vec3 => [r * Math.cos((2 * Math.PI * i) / seg), r * Math.sin((2 * Math.PI * i) / seg), z]));
    const faces: Vec3[][] = [];
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      faces.push([rings[k]![i]!, rings[k]![j]!, rings[k + 1]![j]!, rings[k + 1]![i]!]);
    }
    if (profile[0]![0] > 0) faces.push([...rings[0]!].reverse());
    if (profile[profile.length - 1]![0] > 0) faces.push(rings[rings.length - 1]!);
    this.poly(faces, this.place(x, y, z0, [0, 0, rz]), mat);
  }

  /** Gable roof, ridge along local x. w along x, d along y. */
  gable(x: number, y: number, z0: number, w: number, d: number, h: number, mat: string, rz = 0, over = 0.02): void {
    const a = w / 2 + over, b = d / 2 + over;
    const co: Vec3[] = [[-a, -b, 0], [a, -b, 0], [a, b, 0], [-a, b, 0], [-a, 0, h], [a, 0, h]];
    const idx = [[0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4], [3, 2, 1, 0]];
    this.poly(idx.map((f) => f.map((i) => co[i]!)), this.place(x, y, z0, [0, 0, rz]), mat);
  }

  /** Mono-pitch roof or wedge: low edge at -y (height h0), high edge at +y (height h). */
  shed(x: number, y: number, z0: number, w: number, d: number, h: number, mat: string, rz = 0, h0 = 0): void {
    const a = w / 2, b = d / 2;
    const co: Vec3[] = [[-a, -b, 0], [a, -b, 0], [a, b, 0], [-a, b, 0], [-a, -b, h0], [a, -b, h0], [a, b, h], [-a, b, h]];
    const idx = [[3, 2, 1, 0], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]];
    this.poly(idx.map((f) => f.map((i) => co[i]!)), this.place(x, y, z0, [0, 0, rz]), mat);
  }

  // ---- new kit pieces (nation-identity.md section 2.5)

  /**
   * Panel slab: a box whose walls carry a window grid as vertex colour (seams are colour, not
   * geometry). Each storey is two rows: a plain panel row, then a row of windows between piers.
   */
  slab(x: number, y: number, z0: number, sx: number, sy: number, sz: number, mat: string, storeys: number, cols: number, rz = 0, window: Rgb = [0.42, 0.45, 0.52]): void {
    const rows = storeys * 2;
    const ends = Math.max(1, Math.round(cols * sy / sx));
    const geo = new THREE.BoxGeometry(sx, sz, sy, cols, rows, ends).rotateX(Math.PI / 2);
    const m = this.place(x, y, z0 + sz / 2, [0, 0, rz]);
    const g = prepare(geo);
    paint(g, (c, n) => {
      if (Math.abs(n.z) > 0.5) return WHITE; // roof and floor
      const t = (c.z + sz / 2) / sz;
      const row = Math.min(rows - 1, Math.floor(t * rows));
      const along = Math.abs(n.y) > 0.5 ? (c.x + sx / 2) / sx : (c.y + sy / 2) / sy;
      const n2 = Math.abs(n.y) > 0.5 ? cols : ends;
      const col = Math.min(n2 - 1, Math.floor(along * n2));
      return row % 2 === 1 && col % 2 === 0 ? window : WHITE;
    });
    g.applyMatrix4(m);
    g.computeVertexNormals();
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }

  /** Glass tower: a box with horizontal bands (vertex colour), dark spandrels between glass floors. */
  tower(x: number, y: number, z0: number, sx: number, sy: number, sz: number, mat: string, floors: number, rz = 0, band: Rgb = [0.5, 0.48, 0.52]): void {
    const rows = floors * 2;
    const geo = new THREE.BoxGeometry(sx, sz, sy, 1, rows, 1).rotateX(Math.PI / 2);
    const g = prepare(geo);
    paint(g, (c, n) => {
      if (Math.abs(n.z) > 0.5) return band;
      const row = Math.min(rows - 1, Math.floor(((c.z + sz / 2) / sz) * rows));
      return row % 2 === 0 ? band : WHITE;
    });
    g.applyMatrix4(this.place(x, y, z0 + sz / 2, [0, 0, rz]));
    g.computeVertexNormals();
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }

  /** Obelisk: tall tapered box plus a pyramid cap. */
  obelisk(x: number, y: number, z0: number, w: number, h: number, mat: string, cap: string): void {
    this.frustum(x, y, z0, w, w, w * 0.7, w * 0.7, h, mat);
    this.frustum(x, y, z0 + h, w * 0.7, w * 0.7, 0, 0, w * 0.9, cap);
  }

  /** Battered block: box with the top face scaled (0.85 by default), the dzong / mastaba / fortress wall. */
  battered(x: number, y: number, z0: number, w: number, d: number, h: number, mat: string, k = 0.85, rz = 0): void {
    this.frustum(x, y, z0, w, d, w * k, d * k, h, mat, rz);
  }

  /** Terrace ring: stacked shrinking boxes. Returns the top height. */
  terrace(x: number, y: number, z0: number, w: number, d: number, steps: number, sh: number, shrink: number, mat: string, oy = 0): number {
    for (let i = 0; i < steps; i++) this.box(x, y + i * oy, z0 + i * sh, w - 2 * i * shrink, d - 2 * i * shrink, sh, mat);
    return z0 + steps * sh;
  }

  /** Banner pole plus flag, like Base.flag(). */
  flag(x: number, y: number, z0: number, h: number, w = 0.14, fh = 0.09, mat = 'team', pole = 'dark'): void {
    this.box(x, y, z0, 0.02, 0.02, h, pole);
    this.box(x + w / 2, y, z0 + h - fh, w, 0.015, fh, mat);
  }

  // ---- finish

  /** Like Builder.build(): one mesh per material slot, centred, base at 0, scaled to fit 1 x 1 x 1. */
  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    const merged = new Map<string, THREE.BufferGeometry>();
    for (const [mat, list] of this.parts) {
      const g = mergeGeometries(list, false);
      if (!g) continue;
      g.applyMatrix4(BLENDER_TO_GLTF);
      merged.set(mat, g);
    }
    const box = new THREE.Box3();
    for (const g of merged.values()) { g.computeBoundingBox(); box.union(g.boundingBox!); }
    const size = box.getSize(new THREE.Vector3());
    const k = Math.min(1, 1 / Math.max(size.x, size.y, size.z, 1e-6));
    const fix = new THREE.Matrix4().makeScale(k, k, k)
      .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
    let tris = 0;
    for (const [mat, g] of merged) {
      g.applyMatrix4(fix);
      g.computeVertexNormals();
      tris += g.getAttribute('position').count / 3;
      const material = new THREE.MeshStandardMaterial({
        name: mat === 'team' ? 'team' : `${this.style}_${mat}`,
        color: mat === 'team' ? TEAM_HEX : (this.palette[mat] ?? '#ff00ff'),
        vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0,
      });
      const mesh = new THREE.Mesh(g, material);
      mesh.name = mat;
      group.add(mesh);
    }
    group.userData.tris = tris;
    return group;
  }
}
