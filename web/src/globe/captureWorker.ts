// B8: scales and encodes a globe capture off the main thread. Reading a WebGL frame back from the GPU
// (which any encode has to do) waits for the GPU to finish what it is drawing: 30 to 80 ms on a busy
// frame, whatever the picture size. Here that wait stalls this worker, not the globe. Lane b.

interface Job { id: number; bitmap: ImageBitmap; width: number; height: number }

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, bitmap, width, height } = e.data;
  try {
    const out = new OffscreenCanvas(width, height);
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    // Cover-fit the viewport into the asked size.
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, (width - dw) / 2, (height - dh) / 2, dw, dh);
    bitmap.close();
    const blob = await out.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    self.postMessage({ id, imageBase64: base64(new Uint8Array(await blob.arrayBuffer())) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
