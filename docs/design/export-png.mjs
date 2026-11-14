// Screenshots every .screen of docs/design/reference.html into docs/design/<data-file>.png.
// Run from the repo root, after build-reference.mjs in "preview" mode (the fonts load from Google):
//   CHROME=/path/to/chrome node docs/design/export-png.mjs
// Needs Node 22 (built-in WebSocket) and any Chrome or Chromium; no npm package.
// The PNGs come out at 0.6 to 0.9 MB (gradients). The committed ones were shrunk to under 450 KB by dropping
// to 6 bits per channel (Pillow: ImageOps.posterize(im, 6), saved with optimize=True). Do not use a 256-colour
// palette: it loses the small accents (the green Live dot) or bands the beam.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ? resolve(process.argv[2]) : here;
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
      const p = join(cache, d, 'chrome-linux64', 'chrome');
      if (existsSync(p)) return p;
    }
  }
  return 'chromium';
}
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(findChrome(), ['--headless=new', '--no-sandbox', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tn-shot-'))}`, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}
try {
  const ws = new WebSocket(await target());
  await new Promise((r) => { ws.onopen = r; });
  let seq = 0; const waiting = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d.result ?? d); waiting.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file://' + join(here, 'reference.html') });
  await sleep(1500);
  await evaluate('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 800)))');
  const rects = await evaluate(`[...document.querySelectorAll('.screen')].map((e) => { const r = e.getBoundingClientRect(); return { file: e.dataset.file, x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })`);
  for (const { file, ...clip } of rects) {
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
    writeFileSync(join(outDir, `${file}.png`), Buffer.from(shot.data, 'base64'));
    console.log('wrote', `${file}.png`, `${clip.width}x${clip.height}`);
  }
  ws.close();
} finally {
  chrome.kill();
}
