// The setup window: settings (saved by the main process), live checks, Start.
'use strict';

const $ = (id) => document.getElementById(id);
const HINTS = {
  mode: {
    live: 'Real AI, voices and payments. Spends the shared API budgets.',
    mock: 'No API calls at all: a safe rehearsal. The LLM, voice and Solana settings do not apply.',
  },
  llm: {
    gemini: 'Gemini for every AI call.',
    'gemma-api': 'Gemma through the Gemini API key.',
    ollama: 'Gemma on this laptop through Ollama. The model must be pulled.',
    hybrid: 'Local Gemma (Ollama) for ruler turns, Gemini for the rest.',
    mock: 'Canned answers, no AI calls.',
  },
  voice: {
    on: 'Narration, anthems and the news voices.',
    off: 'Silent: no ElevenLabs characters spent.',
  },
  solana: {
    on: 'Real payments between nations on Solana devnet.',
    off: 'A mock ledger: fake signatures, no network.',
  },
  world: {
    new: 'The game opens on its Create screen: type the world prompt there.',
    replay: 'Plays the saved world demo-1: instant, no API calls.',
    auto: 'Prepares the default demo world before the game opens (about a minute).',
  },
};
const ADV = ['gemmaApiModel', 'ollamaHost', 'ollamaModel', 'localPurposes', 'serverPort', 'webPort'];

let config = null;
let defaults = {};
let display = null;
let checking = false;
let lastOk = false;
const rows = new Map();

// --- settings ----------------------------------------------------------------------------------------

function radio(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value; }
function setRadio(name, value) {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function readForm() {
  const advanced = {};
  for (const k of ADV) {
    const v = $(`a-${k}`).value.trim();
    advanced[k] = k.endsWith('Port') ? (Number(v) || defaults[k]) : (v || defaults[k]);
  }
  return {
    mode: radio('mode'),
    llm: radio('llm'),
    voice: radio('voice') === 'on',
    solana: radio('solana') === 'on',
    world: radio('world'),
    advanced,
  };
}

function fillForm(c) {
  setRadio('mode', c.mode);
  setRadio('llm', c.llm);
  setRadio('voice', c.voice ? 'on' : 'off');
  setRadio('solana', c.solana ? 'on' : 'off');
  setRadio('world', c.world);
  for (const k of ADV) $(`a-${k}`).value = c.advanced?.[k] ?? defaults[k] ?? '';
  $('wsl-target').textContent = c.repo ? `${c.distro || 'default distro'}: ${c.repo}` : 'not set: start the app with npm run demo from WSL once';
}

function refreshHints() {
  const c = readForm();
  $('h-mode').textContent = HINTS.mode[c.mode] || '';
  $('h-llm').textContent = HINTS.llm[c.llm] || '';
  $('h-voice').textContent = HINTS.voice[c.voice ? 'on' : 'off'];
  $('h-solana').textContent = HINTS.solana[c.solana ? 'on' : 'off'];
  $('h-world').textContent = HINTS.world[c.world] || '';
  const mock = c.mode === 'mock';
  setOff('f-llm', mock);
  setOff('f-solana', mock);
  setOff('f-voice', mock || c.llm === 'mock');
  if (!mock && c.llm === 'mock') $('h-voice').textContent = 'Voices need a live LLM; with Mock they are silent.';
}

function setOff(id, off) {
  const f = $(id);
  f.classList.toggle('off', off);
  for (const i of f.querySelectorAll('input')) i.disabled = off;
}

async function onChange() {
  refreshHints();
  config = await window.terra.saveConfig(readForm());
  markStale();
}

// --- checks ------------------------------------------------------------------------------------------

function markStale() {
  if (!rows.size) return;
  lastOk = false;
  setSummary('Settings changed: run the checks again.', 'bad');
  updateButtons();
}

function setSummary(text, cls) {
  const s = $('summary');
  s.textContent = text;
  s.className = cls || '';
}

function setRow(id, label, status, detail) {
  let li = rows.get(id);
  if (!li) {
    li = document.createElement('li');
    li.innerHTML = '<span class="badge"></span><div><div class="row-label"></div><div class="row-detail"></div></div>';
    $('checks').appendChild(li);
    rows.set(id, li);
  }
  const b = li.querySelector('.badge');
  b.className = `badge ${status}`;
  b.textContent = status === 'wait' ? '...' : status.toUpperCase();
  li.querySelector('.row-label').textContent = label;
  li.querySelector('.row-detail').textContent = detail || '';
  li.dataset.status = status;
}

/** The GPU the game will render on: this window shares the GPU process with the game window. */
function gpuCheck() {
  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { status: 'fail', detail: 'WebGL is not available. Restart the app; if it persists, update the NVIDIA driver.' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) {
    return { status: 'fail', detail: `WebGL failed: ${e.message}` };
  }
  if (/nvidia/i.test(renderer)) return { status: 'pass', detail: renderer };
  return {
    status: 'fail',
    detail: `${renderer || 'unknown GPU'}. Fix: Windows Settings > System > Display > Graphics > Terra Nova > High performance (NVIDIA), then quit and reopen the app. Plug the laptop in to power.`,
  };
}

function displayCheck() {
  if (!display) return { status: 'warn', detail: 'unknown' };
  const size = `${display.width}x${display.height}`;
  if (display.external && size === '1920x1080') return { status: 'pass', detail: `the game opens fullscreen on the external ${size} display` };
  if (display.external) return { status: 'warn', detail: `external display is ${size}, not 1920x1080; the game opens fullscreen on it` };
  return { status: 'warn', detail: `no external display: the game opens fullscreen on this screen (${size}). Connect the projector before Start.` };
}

function runChecks() {
  if (checking) return;
  checking = true;
  lastOk = false;
  rows.clear();
  $('checks').innerHTML = '';
  setSummary('Checking...', '');
  const c = readForm();
  const gpu = gpuCheck();
  setRow('webgl', 'Game GPU (WebGL renderer)', gpu.status, gpu.detail);
  const disp = displayCheck();
  setRow('display', 'Display', disp.status, disp.detail);
  setRow('wsl', 'WSL checks', 'wait', `running scripts/demo.sh check${c.mode === 'mock' ? ' --mock' : ''} in WSL...`);
  if (c.mode === 'live' && (c.llm === 'ollama' || c.llm === 'hybrid')) {
    // The preflight's Ollama check loads the model into VRAM: a cold load takes up to about a minute.
    setRow('ollama', 'Ollama', 'wait', 'warming the local model (up to about 70 s on a cold load)...');
  }
  updateButtons();
  window.terra.runChecks(c);
}

function onCheckLine(row) {
  if (row.raw !== undefined) { setRow('wsl', 'WSL checks', 'wait', row.raw); return; }
  if (!row.done) {
    if (rows.has('wsl') && rows.get('wsl').dataset.status === 'wait') { rows.get('wsl').remove(); rows.delete('wsl'); }
    setRow(row.id || 'line', row.label || row.id || 'Check', String(row.status || 'info').toLowerCase(), row.detail);
    return;
  }
  checking = false;
  for (const [id, li] of rows) {
    if (li.dataset.status !== 'wait') continue;
    const label = li.querySelector('.row-label').textContent;
    setRow(id, label, 'fail', row.early ? `the checks stopped early (exit ${row.code}); is WSL running and the repo path right?` : 'no result');
  }
  const failed = [...rows.values()].filter((li) => li.dataset.status === 'fail').map((li) => li.querySelector('.row-label').textContent);
  lastOk = !!row.ok && failed.length === 0;
  if (lastOk) setSummary('Ready. Press Start.', 'ok');
  else setSummary(`Not ready: ${failed.length ? failed.join(', ') : 'see the lines above'}. Fix it, or Start anyway.`, 'bad');
  updateButtons();
}

// --- buttons -----------------------------------------------------------------------------------------

let appState = { running: false, busy: false, gameOpen: false };
function updateButtons() {
  $('run').disabled = checking;
  $('start').disabled = checking || !lastOk || appState.busy;
  $('anyway').disabled = checking || appState.busy;
  $('game').hidden = !appState.gameOpen;
  $('reset').hidden = !appState.running;
  $('reset').disabled = appState.busy;
  $('state').textContent = appState.busy ? 'Working...' : appState.running ? `Running on port ${appState.port}` : 'Not running';
}

function start() { window.terra.start(readForm()); }

async function init() {
  const got = await window.terra.getConfig();
  config = got.config;
  defaults = got.defaults;
  display = got.display;
  appState = got.state;
  fillForm(config);
  refreshHints();
  updateButtons();
  for (const i of document.querySelectorAll('input[type=radio]')) i.addEventListener('change', onChange);
  for (const k of ADV) $(`a-${k}`).addEventListener('change', onChange);
  $('run').addEventListener('click', runChecks);
  $('start').addEventListener('click', start);
  $('anyway').addEventListener('click', start);
  $('game').addEventListener('click', () => window.terra.showGame());
  $('reset').addEventListener('click', () => window.terra.reset());
  window.terra.onCheckLine(onCheckLine);
  window.terra.onState((s) => { appState = s; updateButtons(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('start').disabled && document.activeElement?.tagName !== 'INPUT') start();
  });
}

init();
