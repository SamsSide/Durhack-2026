// Is a point on the real Earth land? Reads the half-degree land mask in land.json, made once by
// build-land.mjs from Natural Earth's 1:110m land polygons (public domain). Display only: the
// pre-world Earth on the Create and founding screens.
import data from './land.json';

let bits: Uint8Array | null = null;

function decode(): Uint8Array {
  const raw = atob(data.mask);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** `lon` -180..180 and `lat` -90..90, in degrees. */
export function isLand(lon: number, lat: number): boolean {
  bits ??= decode();
  const w = data.width, h = data.height;
  const col = Math.min(w - 1, Math.max(0, Math.floor(((lon + 180) / 360) * w)));
  const row = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
  const i = row * w + col;
  return (bits[i >> 3]! & (0x80 >> (i & 7))) !== 0;
}
