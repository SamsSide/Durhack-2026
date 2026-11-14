#!/usr/bin/env node
// Helper for scripts/demo.sh: makes the demo world on a running server and waits until it is ready.
//
//   node scripts/demo-world.mjs new    --port 8787 --prompt "..." --nations 6 [--wait 60]
//   node scripts/demo-world.mjs replay --port 8787 --id demo-1
//
// `new` posts a prepared world (POST /api/world with prepare: true), then follows the prepare
// progress on the /ws socket (the server sends it only there) and prints "Preparing 14/30" lines.
// `replay` plays a saved run (POST /api/replays/:id/play); it needs no preparing.
// The last line printed on success is "WORLD <id>". Plain words only, no emojis.
// Uses Node 22's built-in fetch and WebSocket: no dependency.

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const port = Number(opt('port', '8787'));
const base = `http://localhost:${port}`;

function fail(message) {
  console.error(`FAILED: ${message}`);
  process.exit(1);
}

async function postJson(path, body) {
  let res;
  try {
    res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  } catch (e) {
    fail(`could not reach the server on port ${port} (${e instanceof Error ? e.message : e})`);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) fail(`${path} answered ${res.status}: ${json?.error ?? text.slice(0, 200)}`);
  return json;
}

/** Resolves with the final prepare message, or null when `waitS` runs out first. */
function waitForPrepare(worldId, waitS) {
  return new Promise((resolve) => {
    let ws;
    let last = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* already closed */ }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), waitS * 1000);
    const open = () => {
      ws = new WebSocket(`ws://localhost:${port}/ws`);
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(String(ev.data)); } catch { return; }
        if (msg?.type !== 'prepare' || msg.worldId !== worldId) return;
        const line = `Preparing ${msg.ready}/${msg.total}`;
        if (line !== last) { console.log(line); last = line; }
        if (msg.done) finish(msg);
      };
      // A dropped socket is reopened; the server resends the latest progress on connect.
      ws.onclose = () => { if (!settled) setTimeout(open, 500); };
      ws.onerror = () => { /* onclose follows */ };
    };
    open();
  });
}

async function main() {
  if (cmd === 'new') {
    const prompt = opt('prompt', '');
    const nations = Number(opt('nations', '6'));
    const waitS = Number(opt('wait', '60'));
    if (!prompt.trim()) fail('a prompt is needed');
    console.log(`Creating a prepared world (${nations} nations): "${prompt}"`);
    const out = await postJson('/api/world', { prompt, nations, prepare: true });
    const worldId = out?.worldId;
    if (!worldId) fail('the server sent no world id');
    const done = await waitForPrepare(worldId, waitS);
    if (!done) {
      console.log(`WARN: prepare is not finished after ${waitS} s. The world is there and can be played now; the rest carries on in the background.`);
    } else {
      const failed = done.items.filter((i) => i.status === 'failed').length;
      console.log(`Prepared ${done.ready}/${done.total}${failed ? ` (${failed} failed, see .demo/server.log)` : ''}`);
    }
    console.log(`WORLD ${worldId}`);
    return;
  }
  if (cmd === 'replay') {
    const id = opt('id', '');
    if (!id) fail('a replay id is needed (--replay <id>)');
    let res;
    try { res = await fetch(`${base}/api/replays/${encodeURIComponent(id)}/play`, { method: 'POST' }); } catch (e) {
      fail(`could not reach the server on port ${port} (${e instanceof Error ? e.message : e})`);
    }
    if (res.status === 404) {
      let ids = [];
      try { ids = (await (await fetch(`${base}/api/replays`)).json()).map((r) => r.id); } catch { /* list unavailable */ }
      fail(`no replay called "${id}". Saved replays: ${ids.length ? ids.join(', ') : 'none'}`);
    }
    if (!res.ok) fail(`the replay answered ${res.status}`);
    const out = await res.json();
    console.log(`Playing replay ${id}`);
    console.log(`WORLD ${out.worldId}`);
    return;
  }
  fail(`unknown command "${cmd ?? ''}" (use new or replay)`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
