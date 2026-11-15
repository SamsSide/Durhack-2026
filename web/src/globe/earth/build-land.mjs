// One-off: turns Natural Earth's 1:110m land polygons into the small land mask the pre-world Earth reads.
//
// Source:  ne_110m_land.geojson from https://github.com/nvkelso/natural-earth-vector (geojson/)
// Licence: Natural Earth is in the public domain (https://www.naturalearthdata.com/about/terms-of-use/)
//
//   curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
//   node web/src/globe/earth/build-land.mjs ne_110m_land.geojson
//
// Output: land.json beside this file: a 720 x 360 grid (half a degree a cell), one bit a cell, 1 = land,
// packed most significant bit first and base64 encoded. Row 0 is the northernmost, column 0 is the
// westernmost (longitude -180). Each cell is tested at its centre; inland seas the data cuts out of the
// land (the Caspian is the only one at this scale) are water.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 720, H = 360;
const src = process.argv[2];
if (!src) { console.error('usage: node build-land.mjs <ne_110m_land.geojson>'); process.exit(1); }
const geo = JSON.parse(readFileSync(src, 'utf8'));

const toRing = (pts) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { pts, minX, maxX, minY, maxY };
};
// Even-odd ray cast in the flat lon/lat plane (the data never crosses the date line).
const inside = (r, x, y) => {
  if (x < r.minX || x > r.maxX || y < r.minY || y > r.maxY) return false;
  const p = r.pts;
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

const rings = [], holes = [];
for (const f of geo.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const poly of polys) poly.forEach((ring, i) => (i === 0 ? rings : holes).push(toRing(ring)));
}

const bits = new Uint8Array((W * H) / 8);
let land = 0;
for (let row = 0; row < H; row++) {
  const lat = 90 - (row + 0.5) * (180 / H);
  for (let col = 0; col < W; col++) {
    const lon = -180 + (col + 0.5) * (360 / W);
    if (holes.some((h) => inside(h, lon, lat)) || !rings.some((r) => inside(r, lon, lat))) continue;
    const i = row * W + col;
    bits[i >> 3] |= 0x80 >> (i & 7);
    land++;
  }
}

const out = {
  source: 'Natural Earth 1:110m land (ne_110m_land), naturalearthdata.com',
  licence: 'Public domain',
  width: W,
  height: H,
  mask: Buffer.from(bits).toString('base64'),
};
const file = join(dirname(fileURLToPath(import.meta.url)), 'land.json');
writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`${rings.length} rings, ${holes.length} holes, ${((100 * land) / (W * H)).toFixed(1)}% of cells are land -> ${file}`);
