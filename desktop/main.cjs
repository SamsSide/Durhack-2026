// Terra Nova desktop app: a thin Windows shell around the demo.
//
// The server and the web stay in WSL and are started by scripts/demo.sh through wsl.exe; this app
// is the setup window (settings and preflight checks), a splash while the world starts, and the
// game window that loads http://localhost:<web port>/ (WSL mirrored networking). It holds no keys.
//
// Keys in the game window: F11 fullscreen, Ctrl+Shift+S back to setup, Ctrl+Shift+R reset the
// world between judges, F12 developer tools. Quitting runs `demo.sh stop`.
'use strict';

const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { runInWsl, runToEnd, q } = require('./wsl.cjs');

app.setName('Terra Nova');
// Prefer the discrete GPU; the Windows per-exe preference below backs it up.
app.commandLine.appendSwitch('force_high_performance_gpu');

const ICON = path.join(__dirname, 'build', 'icon.ico');
const BG = '#05070d';

// --- config ---------------------------------------------------------------------------------------

const ADVANCED_DEFAULTS = {
  gemmaApiModel: 'gemma-4-26b-a4b-it',
  ollamaHost: 'http://localhost:11434',
  ollamaModel: 'gemma4:e4b-it-qat',
  localPurposes: 'ruler',
  serverPort: 8787,
  webPort: 5173,
};
const DEFAULTS = {
  mode: 'live', // live | mock
  llm: 'gemini', // gemini | gemma-api | ollama | hybrid | mock
  voice: true,
  solana: true,
  world: 'new', // new | replay | auto
  advanced: { ...ADVANCED_DEFAULTS },
  repo: '',
  distro: '',
  nodeBin: '',
};

const configPath = () => path.join(app.getPath('userData'), 'config.json');

// A short app log next to the config (%APPDATA%\Terra Nova\main.log): what was started, keys, failures.
function log(...parts) {
  try {
    const file = path.join(app.getPath('userData'), 'main.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 1_000_000) fs.renameSync(file, `${file}.old`);
    fs.appendFileSync(file, `${new Date().toISOString()} ${parts.join(' ')}\n`);
  } catch { /* logging never breaks the app */ }
}

function loadConfig() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { /* first run */ }
  return { ...DEFAULTS, ...saved, advanced: { ...ADVANCED_DEFAULTS, ...(saved.advanced || {}) } };
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

// Command-line values (from scripts/desktop.sh or the desktop shortcut) win over the saved ones.
function argValue(name) {
  const argv = process.argv;
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : '';
}

let config = DEFAULTS;
function initConfig() {
  config = loadConfig();
  const repo = argValue('repo');
  const distro = argValue('distro');
  const nodeBin = argValue('node-bin');
  if (repo) config.repo = repo;
  if (distro) config.distro = distro;
  if (nodeBin) config.nodeBin = nodeBin;
  const sp = Number(argValue('server-port'));
  const wp = Number(argValue('web-port'));
  if (sp) config.advanced.serverPort = sp;
  if (wp) config.advanced.webPort = wp;
  saveConfig(config);
}

// --- how the settings reach demo.sh ---------------------------------------------------------------

function serverPort(c = config) { return Number(c.advanced.serverPort) || ADVANCED_DEFAULTS.serverPort; }
function webPort(c = config) { return Number(c.advanced.webPort) || ADVANCED_DEFAULTS.webPort; }

/** The environment for demo.sh and the preflight. Advanced values only when the user changed them. */
function envFor(c) {
  const a = c.advanced;
  const env = {
    DEMO_SERVER_PORT: serverPort(c),
    DEMO_WEB_PORT: webPort(c),
    SERVER_PORT: serverPort(c),
    WEB_PORT: webPort(c),
  };
  if (c.mode === 'mock') {
    env.LLM_MODE = 'mock';
    env.SOLANA_MODE = 'mock';
    return env;
  }
  if (c.llm === 'mock') {
    env.LLM_MODE = 'mock';
  } else {
    env.LLM_MODE = 'live';
    env.LLM_PROVIDER = c.llm;
    const changed = (k) => String(a[k] ?? '').trim() && String(a[k]).trim() !== ADVANCED_DEFAULTS[k];
    if (changed('gemmaApiModel')) env.GEMMA_API_MODEL = a.gemmaApiModel.trim();
    if (changed('ollamaHost')) env.OLLAMA_HOST = a.ollamaHost.trim();
    if (changed('ollamaModel')) env.OLLAMA_MODEL = a.ollamaModel.trim();
    if (changed('localPurposes')) env.LLM_LOCAL_PURPOSES = a.localPurposes.trim();
  }
  env.SOLANA_MODE = c.solana ? 'devnet' : 'mock';
  if (!c.voice) env.DEMO_VOICE = '0';
  return env;
}

function worldFlags(c) {
  if (c.world === 'replay') return ['--replay', 'demo-1'];
  if (c.world === 'new') return ['--no-world'];
  return [];
}

function voiceFlags(c) { return c.mode === 'live' && !c.voice ? ['--no-voice'] : []; }

function wslOpts(c, extra = {}) {
  return { distro: c.distro, repo: c.repo, nodeBin: c.nodeBin, env: envFor(c), ...extra };
}

const logPath = (c) => `${c.repo}/.demo/server.log`;
// Ends the log streams this app started (one per Start), so none linger in WSL.
const stopTails = (c) => `pkill -f ${q(`tail -n +1 -F ${logPath(c)}`)} 2>/dev/null || true`;

// --- GPU: the Windows per-exe preference (HKCU only, this exe only) --------------------------------

function setGpuPreference() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  execFile('reg.exe', [
    'add', 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences',
    '/v', process.execPath, '/t', 'REG_SZ', '/d', 'GpuPreference=2;', '/f',
  ], { windowsHide: true }, () => { /* best effort; the setup window's GPU line verifies */ });
}

// --- windows ---------------------------------------------------------------------------------------

let setupWin = null;
let splashWin = null;
let gameWin = null;
let streamProc = null; // the long-lived wsl.exe that started the demo and now tails the server log
let running = false; // servers started by this app
let busy = false; // a start, reset or stop is in progress
let quitting = false;
const logBuffer = [];

/** A display's size in real pixels (Electron reports DIPs, scaled by the Windows zoom). */
function px(d) {
  return { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
}

/** The display for the game: an external 1920x1080 one first, then any non-primary, else the primary. */
function targetDisplay() {
  const primary = screen.getPrimaryDisplay();
  const all = screen.getAllDisplays();
  const others = all.filter((d) => d.id !== primary.id);
  return others.find((d) => px(d).width === 1920 && px(d).height === 1080) || others[0] || primary;
}

function displayInfo() {
  const primary = screen.getPrimaryDisplay();
  const all = screen.getAllDisplays();
  const t = targetDisplay();
  return {
    count: all.length,
    external: t.id !== primary.id,
    width: px(t).width,
    height: px(t).height,
    scale: t.scaleFactor,
  };
}

function centeredOn(display, w, h) {
  const b = display.workArea;
  return { x: Math.round(b.x + (b.width - w) / 2), y: Math.round(b.y + (b.height - h) / 2), width: w, height: h };
}

const webPrefs = {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

function openSetup() {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.show();
    setupWin.focus();
    setupWin.webContents.send('setup:state', setupState());
    return;
  }
  const d = screen.getPrimaryDisplay();
  const w = Math.min(1040, d.workArea.width - 40);
  const h = Math.min(940, d.workArea.height - 40);
  setupWin = new BrowserWindow({
    ...centeredOn(d, w, h),
    minWidth: 760,
    minHeight: 600,
    title: 'Terra Nova',
    icon: ICON,
    backgroundColor: BG,
    show: false,
    autoHideMenuBar: true,
    webPreferences: webPrefs,
  });
  setupWin.setMenuBarVisibility(false);
  setupWin.loadFile(path.join(__dirname, 'setup.html'));
  setupWin.once('ready-to-show', () => setupWin.show());
  setupWin.on('close', (e) => {
    // With the game open, closing setup only hides it; otherwise it ends the app.
    if (!quitting && gameWin && !gameWin.isDestroyed()) { e.preventDefault(); setupWin.hide(); gameWin.focus(); }
  });
  setupWin.on('closed', () => { setupWin = null; if (!gameWin) app.quit(); });
}

function setupState() {
  return { running, busy, gameOpen: !!(gameWin && !gameWin.isDestroyed()), port: webPort() };
}

function openSplash(title) {
  const d = targetDisplay();
  if (!splashWin || splashWin.isDestroyed()) {
    splashWin = new BrowserWindow({
      ...centeredOn(d, 620, 380),
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: false,
      title: 'Terra Nova',
      icon: ICON,
      backgroundColor: BG,
      show: false,
      webPreferences: webPrefs,
    });
    splashWin.loadFile(path.join(__dirname, 'splash.html'));
    splashWin.once('ready-to-show', () => splashWin.show());
    splashWin.on('closed', () => { splashWin = null; });
    splashWin.webContents.once('did-finish-load', () => splash('title', title));
  } else {
    splashWin.show();
    splash('title', title);
  }
}

function splash(kind, value) {
  if (splashWin && !splashWin.isDestroyed()) splashWin.webContents.send('splash', { kind, value });
}

function closeSplash() {
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
}

function openGame() {
  const url = `http://localhost:${webPort()}/`;
  if (gameWin && !gameWin.isDestroyed()) {
    // ready-to-show fires once per window; a reload reports did-finish-load.
    gameWin.webContents.once('did-finish-load', () => { closeSplash(); gameWin.show(); gameWin.focus(); });
    gameWin.loadURL(url);
    return;
  }
  const d = targetDisplay();
  gameWin = new BrowserWindow({
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    frame: false,
    fullscreen: true,
    title: 'Terra Nova',
    icon: ICON,
    backgroundColor: BG,
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  gameWin.setMenuBarVisibility(false);
  // The page title would replace ours; keep "Terra Nova".
  gameWin.on('page-title-updated', (e) => e.preventDefault());
  gameWin.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const ctrlShift = input.control && input.shift && !input.alt;
    const key = (input.key || '').toLowerCase();
    if (ctrlShift || /^F1[12]$/.test(input.key)) log('key', input.control ? 'Ctrl+' : '', input.shift ? 'Shift+' : '', input.key);
    if (input.key === 'F11') { e.preventDefault(); gameWin.setFullScreen(!gameWin.isFullScreen()); }
    else if (input.key === 'F12') { e.preventDefault(); gameWin.webContents.toggleDevTools(); }
    else if (ctrlShift && key === 's') { e.preventDefault(); openSetup(); }
    else if (ctrlShift && key === 'r') { e.preventDefault(); resetWorld(); }
    else if (ctrlShift && key === 'i') { e.preventDefault(); }
  });
  gameWin.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
    if (code === -3) return; // aborted by a newer load
    // The web may still be warming up; try again shortly.
    setTimeout(() => { if (gameWin && !gameWin.isDestroyed()) gameWin.loadURL(failedUrl || url); }, 1000);
    splash('line', `The game page did not load (${desc}); trying again...`);
  });
  gameWin.once('ready-to-show', () => { closeSplash(); gameWin.show(); gameWin.focus(); });
  gameWin.on('closed', () => {
    gameWin = null;
    if (!quitting && !(setupWin && setupWin.isVisible())) app.quit();
  });
  gameWin.loadURL(url);
}

// --- start, reset, stop -----------------------------------------------------------------------------

function pushLog(line) {
  logBuffer.push(line);
  if (logBuffer.length > 2000) logBuffer.splice(0, logBuffer.length - 2000);
  splash('log', line);
}

function stopStream() {
  if (streamProc) { try { streamProc.kill(); } catch { /* gone */ } streamProc = null; }
}

/** Starts (or restarts) the demo with `c`, then opens the game. Resolves when the game is shown or start failed. */
function startDemo(c, { title = 'Starting the world...' } = {}) {
  if (busy) return;
  if (!c.repo) { openSetup(); return; }
  busy = true;
  log('start', JSON.stringify({ mode: c.mode, llm: c.llm, voice: c.voice, solana: c.solana, world: c.world, ports: [serverPort(c), webPort(c)] }));
  stopStream();
  logBuffer.length = 0;
  if (setupWin && !setupWin.isDestroyed()) setupWin.hide();
  openSplash(title);

  const mode = c.mode === 'mock' ? 'mock' : 'live';
  const args = [mode, '--no-open', ...worldFlags(c), ...voiceFlags(c)].map(q).join(' ');
  const body = [
    stopTails(c),
    `bash scripts/demo.sh ${args} || exit $?`,
    'echo "@@TERRA_READY@@"',
    `exec tail -n +1 -F ${q(logPath(c))}`,
  ].join('\n');

  let ready = false;
  let failed = false;
  const fail = (msg) => {
    if (failed) return;
    failed = true;
    log('start failed:', msg);
    busy = false;
    running = false;
    splash('error', msg);
    setupWin?.webContents.send('setup:state', setupState());
  };

  streamProc = runInWsl(body, {
    ...wslOpts(c),
    onLine: (line) => {
      if (!ready && line === '@@TERRA_READY@@') {
        ready = true;
        running = true;
        busy = false;
        splash('line', 'Opening the game...');
        openGame();
        return;
      }
      if (ready) pushLog(line);
      else { splash('line', line); pushLog(line); }
    },
    onExit: (code) => {
      if (!ready) fail(`The demo did not start (exit ${code}). Open the logs for details.`);
      else if (!quitting) pushLog(`(the server log stream ended, exit ${code})`);
    },
  });
}

async function resetWorld() {
  log('reset', `busy=${busy}`, `running=${running}`, `world=${config.world}`);
  if (busy || !running) return;
  const c = config;
  if (c.world === 'new') {
    // A fresh Create screen means a fresh server: start again with the same settings.
    startDemo(c, { title: 'Resetting: a fresh Create screen...' });
    return;
  }
  busy = true;
  openSplash(c.world === 'replay' ? 'Resetting: replay demo-1...' : 'Resetting: preparing a new world...');
  const flags = c.world === 'replay' ? ' --replay demo-1' : '';
  const { code } = await runToEnd(`bash scripts/demo.sh reset${flags}`, {
    ...wslOpts(c),
    onLine: (line) => { splash('line', line); pushLog(line); },
  }, 180000);
  busy = false;
  log('reset done, exit', code);
  if (code === 0) {
    splash('line', 'The new world is on screen.');
    setTimeout(closeSplash, 800);
    gameWin?.focus();
  } else {
    splash('error', `Reset failed (exit ${code}). The old world is still running.`);
  }
}

async function stopDemo() {
  log('stop');
  stopStream();
  if (!config.repo) return;
  await runToEnd(`bash scripts/demo.sh stop; ${stopTails(config)}`, wslOpts(config), 30000);
  running = false;
}

// --- checks -------------------------------------------------------------------------------------------

let checksProc = null;
function runChecks(sender, c) {
  if (checksProc) { try { checksProc.kill(); } catch { /* gone */ } }
  const flags = [c.mode === 'mock' ? '--mock' : '', ...voiceFlags(c), '--json'].filter(Boolean).map(q).join(' ');
  let doneSeen = false;
  const send = (row) => { if (!sender.isDestroyed()) sender.send('checks:line', row); };
  const proc = runInWsl(`bash scripts/demo.sh check ${flags}`, {
    ...wslOpts(c),
    onLine: (line) => {
      const t = line.trim();
      if (!t.startsWith('{')) { if (t) send({ raw: t }); return; }
      let row;
      try { row = JSON.parse(t); } catch { send({ raw: t }); return; }
      if (row.done) doneSeen = true;
      send(row);
    },
    onExit: (code) => {
      if (checksProc === proc) checksProc = null;
      if (!doneSeen) send({ done: true, ok: false, early: true, code });
    },
  });
  checksProc = proc;
  // The Ollama check can take about 60 s on a cold model; give the whole run 90 s.
  setTimeout(() => { if (checksProc === proc) { try { proc.kill(); } catch { /* gone */ } } }, 90000);
}

// --- IPC ----------------------------------------------------------------------------------------------

ipcMain.handle('config:get', () => ({ config, defaults: ADVANCED_DEFAULTS, display: displayInfo(), state: setupState() }));
ipcMain.handle('config:save', (_e, c) => { config = { ...config, ...c, advanced: { ...ADVANCED_DEFAULTS, ...(c.advanced || {}) } }; saveConfig(config); return config; });
ipcMain.on('checks:run', (e, c) => { config = { ...config, ...c }; saveConfig(config); runChecks(e.sender, config); });
ipcMain.on('demo:start', (_e, c) => { config = { ...config, ...c }; saveConfig(config); startDemo(config); });
ipcMain.on('demo:reset', () => resetWorld());
ipcMain.on('game:show', () => { if (gameWin && !gameWin.isDestroyed()) { setupWin?.hide(); gameWin.show(); gameWin.focus(); } });
ipcMain.on('splash:logs', (_e, open) => {
  if (!splashWin || splashWin.isDestroyed()) return;
  const d = targetDisplay();
  splashWin.setResizable(true);
  splashWin.setBounds(centeredOn(d, open ? 980 : 620, open ? 640 : 380));
  splashWin.setResizable(false);
});
ipcMain.handle('splash:history', () => logBuffer.slice(-500));
ipcMain.on('splash:back', () => { closeSplash(); openSetup(); });
ipcMain.on('app:quit', () => app.quit());

// --- app lifecycle ------------------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = (gameWin && !gameWin.isDestroyed() && gameWin.isVisible()) ? gameWin : setupWin;
    if (w && !w.isDestroyed()) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } else openSetup();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    setGpuPreference();
    initConfig();
    log('app ready', app.getVersion(), `repo=${config.repo}`, `distro=${config.distro}`, `packaged=${app.isPackaged}`);
    openSetup();
  });

  app.on('window-all-closed', () => app.quit());

  let stopped = false;
  app.on('before-quit', (e) => {
    quitting = true;
    if (stopped) return;
    e.preventDefault();
    stopped = true;
    if (checksProc) { try { checksProc.kill(); } catch { /* gone */ } }
    for (const w of BrowserWindow.getAllWindows()) w.hide();
    stopDemo().finally(() => app.exit(0));
  });
}
