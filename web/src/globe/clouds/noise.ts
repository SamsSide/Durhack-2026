// A baked noise cube map for the cloud raymarch: R is the broad cloud cover, G the fine detail that
// erodes the edges. A cube map has no pole pinch and no seam, and costs one texture read per sample.
import * as THREE from 'three';

const hash = (x: number, y: number, z: number): number => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const sm = (t: number): number => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  const c = (i: number, j: number, k: number): number => hash(xi + i, yi + j, zi + k);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
function fbm(x: number, y: number, z: number, f: number, octaves: number): number {
  let a = 0, amp = 0.5, sum = 0;
  for (let o = 0; o < octaves; o++) {
    a += amp * vnoise(x * f + 11.3, y * f + 7.1, z * f + 3.7);
    sum += amp; amp *= 0.5; f *= 2.03;
  }
  return a / sum;
}
const byte = (v: number): number => Math.round(Math.min(1, Math.max(0, (v - 0.5) * 1.7 + 0.5)) * 255);

// GL cube map face directions for a texel at (sc, tc) in -1..1.
const FACES: ((sc: number, tc: number) => [number, number, number])[] = [
  (sc, tc) => [1, -tc, -sc], (sc, tc) => [-1, -tc, sc],
  (sc, tc) => [sc, 1, tc], (sc, tc) => [sc, -1, -tc],
  (sc, tc) => [sc, -tc, 1], (sc, tc) => [-sc, -tc, -1],
];

export function makeNoiseCube(size = 256): THREE.CubeTexture {
  const faces = FACES.map((dirOf) => {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const [dx, dy, dz] = dirOf(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
        const k = 1 / Math.hypot(dx, dy, dz);
        const px = dx * k, py = dy * k, pz = dz * k;
        const i = (y * size + x) * 4;
        data[i] = byte(fbm(px, py * 1.25, pz, 2.6, 5));
        data[i + 1] = byte(fbm(px + 5.2, py, pz - 2.9, 11, 4));
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  });
  const cube = new THREE.CubeTexture(faces as unknown as HTMLImageElement[]);
  cube.format = THREE.RGBAFormat;
  cube.colorSpace = THREE.NoColorSpace;
  cube.generateMipmaps = true;
  cube.minFilter = THREE.LinearMipmapLinearFilter;
  cube.magFilter = THREE.LinearFilter;
  cube.needsUpdate = true;
  return cube;
}
