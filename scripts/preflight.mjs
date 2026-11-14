#!/usr/bin/env node
// Preflight: test every enabled service before the live demo and print PASS/FAIL per line.
//   node scripts/preflight.mjs          human lines, then READY or NOT READY
//   node scripts/preflight.mjs --json   one JSON object per line as each check finishes, then {"done":true,"ok":...}
// Exit code 0 when nothing failed, 1 otherwise. No dependencies; plain words, no emojis.
//
// Inputs (the process env wins over ~/.config/durhack/keys.env, which wins over .env):
//   LLM_MODE live|mock (default mock), LLM_PROVIDER gemini|gemma-api|ollama|hybrid, GEMMA_API_MODEL,
//   OLLAMA_HOST, OLLAMA_MODEL, GEMINI_MODEL_RULER, DEMO_VOICE 1|0, SOLANA_MODE devnet|mock|off,
//   SOLANA_RPC_URL, SOLANA_KEYS_DIR, SERVER_PORT, WEB_PORT.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
const TIMEOUT = 8000;

// Same rule as scripts/demo.sh: skip comments and empty values, never override a key already set.
function loadEnvFile(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (let line of text.split('\n')) {
    line = line.replace(/\r$/, '');
    if (!line || line.startsWith('#')) continue;
    line = line.replace(/^export /, '');
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i);
    let val = line.slice(i + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    if (!val) continue;
    if (process.env[key]) continue;
    process.env[key] = val;
  }
}
loadEnvFile(path.join(os.homedir(), '.config', 'durhack', 'keys.env'));
loadEnvFile(path.join(ROOT, '.env'));

const env = (k, d = '') => (process.env[k] || '').trim() || d;
const live = env('LLM_MODE', 'mock').toLowerCase() === 'live';
const provider = env('LLM_PROVIDER', 'gemini').toLowerCase();
const voiceOn = env('DEMO_VOICE', '1') !== '0';
const solanaMode = env('SOLANA_MODE', 'mock').toLowerCase();
const serverPort = Number(env('SERVER_PORT', env('DEMO_SERVER_PORT', '8787')));
const webPort = Number(env('WEB_PORT', env('DEMO_WEB_PORT', '5173')));
const rulerModel = env('GEMINI_MODEL_RULER', 'gemini-3.5-flash-lite');
const gemmaModel = env('GEMMA_API_MODEL', 'gemma-4-26b-a4b-it');
const ollamaHost = env('OLLAMA_HOST', 'http://localhost:11434').replace(/\/+$/, '');
const ollamaModel = env('OLLAMA_MODEL', 'gemma4:e4b-it-qat');

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const ELEVEN = 'https://api.elevenlabs.io/v1';

// Strip anything that looks like a key from text before it is printed.
const secrets = () => ['GEMINI_API_KEY', 'ELEVENLABS_API_KEY'].map((k) => env(k)).filter((s) => s.length > 6);
const scrub = (s) => { let out = String(s); for (const k of secrets()) out = out.split(k).join('[key]'); return out.replace(/\s+/g, ' ').trim(); };
const errText = (e) => (e && e.name === 'TimeoutError' ? `timed out after ${TIMEOUT / 1000} s` : e && e.cause && e.cause.code ? `${e.cause.code}` : e instanceof Error ? e.message : String(e));

class Fail extends Error {}
const fail = (m) => { throw new Fail(m); };
const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
async function httpErr(res, what) {
  let body = '';
  try { const j = await res.json(); body = j?.error?.message || j?.detail?.message || j?.detail || j?.error || ''; if (typeof body !== 'string') body = JSON.stringify(body); } catch { /* not json */ }
  return `${what}: HTTP ${res.status}${body ? ` ${scrub(body).slice(0, 120)}` : ''}`;
}
const ms = (t) => `${Date.now() - t} ms`;

// --- checks: each returns { status, detail } or throws ------------------------------------------
const checks = [];
const add = (id, label, fn) => checks.push({ id, label, fn });

add('node', 'Node version', async () => {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) fail(`Node ${process.versions.node} is too old, need 22 or later (put nvm's Node 22 first on PATH)`);
  return { status: 'pass', detail: `Node ${process.versions.node}` };
});

add('repo', 'Repo install', async () => {
  const missing = ['tsx', 'vite'].filter((b) => !fs.existsSync(path.join(ROOT, 'node_modules', '.bin', b)));
  if (missing.length) fail(`missing node_modules/.bin/${missing.join(', ')}; run: npm install`);
  return { status: 'pass', detail: 'tsx and vite installed' };
});

function portUser(port) {
  return new Promise((resolve) => {
    execFile('ss', ['-ltnpH', `sport = :${port}`], { timeout: 2000 }, (err, out) => {
      const m = !err && /users:\(\("([^"]+)",pid=(\d+)/.exec(out || '');
      resolve(m ? `${m[1]} pid ${m[2]}` : '');
    });
  });
}
const portInUse = (port) => new Promise((resolve) => {
  const s = net.connect({ port, host: '127.0.0.1' });
  const done = (v) => { s.destroy(); resolve(v); };
  s.setTimeout(1500, () => done(false));
  s.once('connect', () => done(true));
  s.once('error', () => done(false));
});
add('ports', 'Ports', async () => {
  const busy = [];
  for (const p of [serverPort, webPort]) if (await portInUse(p)) { const who = await portUser(p); busy.push(`${p}${who ? ` (${who})` : ''}`); }
  if (busy.length) return { status: 'warn', detail: `in use: ${busy.join(', ')} (a demo may already be running)` };
  return { status: 'pass', detail: `${serverPort} and ${webPort} free` };
});

async function geminiStyle(model, what) {
  const key = env('GEMINI_API_KEY');
  if (!key) fail('GEMINI_API_KEY is not set (add it to ~/.config/durhack/keys.env)');
  const headers = { 'x-goog-api-key': key, 'content-type': 'application/json' };
  const m = await get(`${GEMINI}/models/${encodeURIComponent(model)}`, { headers });
  if (!m.ok) fail(await httpErr(m, `${what} models.get ${model}`));
  const t = Date.now();
  const g = await get(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers,
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say ok.' }] }], generationConfig: { maxOutputTokens: 1 } }),
  });
  if (!g.ok) fail(await httpErr(g, `${what} generateContent ${model}`));
  return { status: 'pass', detail: `${model} answered in ${ms(t)}` };
}

add('gemini', 'Gemini API', async () => {
  if (!live) return { status: 'skip', detail: 'LLM_MODE is not live' };
  return geminiStyle(rulerModel, 'Gemini');
});

add('gemma-api', 'Gemma API', async () => {
  if (provider !== 'gemma-api') return { status: 'skip', detail: `provider is ${provider}` };
  if (!live) return { status: 'skip', detail: 'LLM_MODE is not live' };
  return geminiStyle(gemmaModel, 'Gemma');
});

add('ollama', 'Ollama', async () => {
  if (provider !== 'ollama' && provider !== 'hybrid') return { status: 'skip', detail: `provider is ${provider}` };
  let v;
  try { v = await get(`${ollamaHost}/api/version`); } catch (e) { fail(`${ollamaHost} not reachable (${errText(e)}); start Ollama, or set OLLAMA_HOST`); }
  if (!v.ok) fail(await httpErr(v, `${ollamaHost}/api/version`));
  const ver = (await v.json().catch(() => ({}))).version || '?';
  const tagsRes = await get(`${ollamaHost}/api/tags`);
  if (!tagsRes.ok) fail(await httpErr(tagsRes, '/api/tags'));
  const names = ((await tagsRes.json()).models || []).map((x) => x.name || x.model);
  const want = ollamaModel.includes(':') ? ollamaModel : `${ollamaModel}:latest`;
  if (!names.includes(want)) fail(`model ${ollamaModel} is not pulled; run: ollama pull ${ollamaModel}${names.length ? ` (have: ${names.slice(0, 4).join(', ')})` : ''}`);
  const t = Date.now();
  const g = await fetch(`${ollamaHost}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: ollamaModel, prompt: 'Say ok.', stream: false, keep_alive: '30m', options: { num_predict: 1 } }),
    signal: AbortSignal.timeout(60000),
  });
  if (!g.ok) fail(await httpErr(g, `/api/generate ${ollamaModel}`));
  await g.json().catch(() => ({}));
  return { status: 'pass', detail: `${ollamaModel} warm in VRAM (30m), first token in ${ms(t)} (Ollama ${ver})` };
});

add('elevenlabs', 'ElevenLabs', async () => {
  if (!live) return { status: 'skip', detail: 'LLM_MODE is not live' };
  if (!voiceOn) return { status: 'skip', detail: 'DEMO_VOICE=0' };
  const key = env('ELEVENLABS_API_KEY');
  if (!key) fail('ELEVENLABS_API_KEY is not set (add it to ~/.config/durhack/keys.env, or set DEMO_VOICE=0)');
  const r = await get(`${ELEVEN}/user/subscription`, { headers: { 'xi-api-key': key } });
  if (!r.ok) fail(await httpErr(r, 'subscription'));
  const j = await r.json();
  const left = Number(j.character_limit) - Number(j.character_count);
  if (!Number.isFinite(left)) fail('subscription reply had no character counts');
  const text = `${left.toLocaleString('en-GB')} characters left (${j.tier || 'unknown tier'})`;
  return left > 5000 ? { status: 'pass', detail: text } : { status: 'warn', detail: `${text}, under 5,000` };
});

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}
add('solana', 'Solana devnet', async () => {
  if (solanaMode !== 'devnet') return { status: 'skip', detail: `SOLANA_MODE is ${solanaMode}` };
  const rpc = env('SOLANA_RPC_URL', 'https://api.devnet.solana.com');
  const call = async (method, params) => {
    const r = await get(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (!r.ok) fail(await httpErr(r, method));
    const j = await r.json();
    if (j.error) fail(`${method}: ${scrub(j.error.message || JSON.stringify(j.error)).slice(0, 120)}`);
    return j.result;
  };
  const t = Date.now();
  const health = await call('getHealth', []);
  if (health !== 'ok') fail(`getHealth said ${JSON.stringify(health)}`);
  let dir = env('SOLANA_KEYS_DIR', path.join(os.homedir(), '.config', 'durhack', 'solana'));
  if (dir.startsWith('~')) dir = path.join(os.homedir(), dir.slice(1));
  const file = path.join(dir, 'commons.json');
  if (!fs.existsSync(file)) fail(`no commons.json in ${dir}; run: npx tsx scripts/solana-keys.ts`);
  const bytes = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(bytes) || bytes.length !== 64) fail('commons.json is not a 64-byte keypair');
  const addr = base58(Uint8Array.from(bytes.slice(32)));
  const bal = (await call('getBalance', [addr])).value / 1e9;
  const text = `RPC ok in ${ms(t)}, commons ${addr.slice(0, 4)}...${addr.slice(-4)} holds ${bal.toFixed(3)} SOL`;
  return bal < 0.5 ? { status: 'warn', detail: `${text}, under 0.5 SOL (fund it: solana airdrop)` } : { status: 'pass', detail: text };
});

add('gpu', 'GPU', () => new Promise((resolve) => {
  execFile('nvidia-smi', ['--query-gpu=name,memory.free,memory.total', '--format=csv,noheader,nounits'], { timeout: 4000 }, (err, out) => {
    if (err || !out.trim()) return resolve({ status: 'skip', detail: 'no nvidia-smi here; the launcher window checks the WebGL renderer' });
    const rows = out.trim().split('\n').map((l) => l.split(',').map((s) => s.trim()))
      .map(([n, free, total]) => `${n}, ${(Number(free) / 1024).toFixed(1)} of ${(Number(total) / 1024).toFixed(1)} GB VRAM free`);
    resolve({ status: 'info', detail: rows.join('; ') });
  });
}));

// --- run ------------------------------------------------------------------------------------------
const results = [];
const ORDER = checks.map((c) => c.id);
function report(c, r) {
  const row = { id: c.id, label: c.label, status: r.status, detail: scrub(r.detail) };
  results.push(row);
  if (JSON_OUT) console.log(JSON.stringify(row));
}
await Promise.all(checks.map(async (c) => {
  try { report(c, await c.fn()); }
  catch (e) { report(c, { status: 'fail', detail: e instanceof Fail ? e.message : errText(e) }); }
}));
const failed = results.filter((r) => r.status === 'fail').length;
if (JSON_OUT) {
  console.log(JSON.stringify({ done: true, ok: failed === 0 }));
} else {
  results.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  for (const r of results) console.log(`${r.status.toUpperCase().padEnd(5)} ${r.id.padEnd(11)} ${r.detail}`);
  console.log(failed ? `NOT READY: ${failed} failed` : 'READY');
}
process.exit(failed ? 1 : 0);
