// C6: read a picked picture, downscale it when large, and return base64 for POST /api/world.
export interface PickedImage { base64: string; mimeType: string; previewUrl: string }

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 1600;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => (typeof r.result === 'string' ? resolve(r.result) : reject(new Error('read')));
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

function split(dataUrl: string): { base64: string; mimeType: string } {
  const m = /^data:([^;,]+)[^,]*,(.*)$/.exec(dataUrl);
  if (!m) throw new Error('data url');
  return { mimeType: m[1], base64: m[2] };
}

/** Resolves a picked image, or rejects when the file is not a readable picture. */
export async function pickImage(file: File): Promise<PickedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error('not an image');
  const original = await readDataUrl(file);
  const img = await loadImage(original);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('empty');
  let dataUrl = original;
  if (file.size > MAX_BYTES || w > MAX_SIDE || h > MAX_SIDE) {
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  }
  const { base64, mimeType } = split(dataUrl);
  return { base64, mimeType, previewUrl: dataUrl };
}
