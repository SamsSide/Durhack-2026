// Stub until lane b's web/src/globe/capture.ts lands; then import from there instead.
export async function captureGlobe(): Promise<{ imageBase64: string; mimeType: 'image/jpeg' }> {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    ctx.fillStyle = bg || 'black';
    ctx.fillRect(0, 0, 8, 8);
  }
  const url = canvas.toDataURL('image/jpeg', 0.8);
  return { imageBase64: url.slice(url.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
