# Terra Nova as a desktop app (Electron): options, plan, risks

Researched 14 Nov 2026, late evening. Demo: 2-minute table demo on the owner's Windows 11 laptop
(WSL2 Ubuntu, RTX 5070 Ti + Radeon 890M), projector 1920x1080, tomorrow morning.

## Recommendation (short)

Do **not** package the server into a real Windows Electron app tonight. Build a **thin Electron
shell** instead. It runs natively on Windows and gives you the window, icon, splash, setup screen
and preflight. The server and web keep running in WSL through the existing `scripts/demo.sh`,
started by `wsl.exe`. The tested demo path stays exactly as it is, and the Electron part is only
a window plus a launcher.

Order of work:

1. **First (about 30 min, the fallback):** a Windows shortcut that opens Chrome in `--app` or
   `--kiosk` mode on the running demo.
2. **Then (about 1 h):** `scripts/preflight.mjs` (the checks). It is useful on its own as
   `npm run demo:check`.
3. **Then (about 3 h):** the Electron shell with the setup screen, which calls both.

**Go/no-go at about 02:00.** If the Electron .exe has not passed one full rehearsal on the
projector by then, demo with the Chrome shortcut.

Full packaging (server bundled into Electron, no WSL) is a post-hackathon job: about 8 to 12 h,
with real risk.

## Facts checked on this laptop (14 Nov 2026)

| Fact | Result |
| --- | --- |
| Windows Node | `node v22.19.0`, `npm 11.7.0` at `C:\Program Files\nodejs` |
| Browsers | Chrome is the default (`ChromeHTML`). Edge is installed. |
| WSL | Distro `Ubuntu`, WSL 2, `networkingMode=mirrored`, systemd on |
| Localhost both ways | From WSL, `localhost:11434` (Windows Ollama) answers. A Windows app can reach `localhost:5173` and `localhost:8787` in WSL (mirrored mode). |
| Ollama models | Only `qwen3.6:latest` is pulled. **No Gemma model yet**, so the preflight would fail that line. |
| **Node version trap** | `wsl.exe -d Ubuntu -e bash -lc 'node -v'` gives **v18.19.1** (`/usr/bin/node`). nvm's v22.23.3 loads only in `.bashrc` (interactive). A launcher must put `~/.nvm/versions/node/v22.23.3/bin` first on `PATH`, or `demo.sh` and `demo-world.mjs` run on Node 18. |
| Background processes | A `setsid` child started inside `wsl.exe -e bash -c ...` kept running after `wsl.exe` exited (tested twice). The first quick test lost it to a race, so keep a long-lived child (see the plan). |
| GPU per-app preference | Stored at `HKCU\Software\Microsoft\DirectX\UserGpuPreferences`, value name = full exe path, data `GpuPreference=2;` (seen for several games on this machine). **Chrome has no entry**, so today's Chrome demo runs on "Let Windows decide". It may be on the Radeon iGPU right now. Check `chrome://gpu` tonight whatever you decide. |
| Native modules | None in the server's tree. The only `.node` files are Rollup's (build tool). `pg` is pure JS unless `pg-native` is installed (it isn't). `ws` has no `bufferutil`. Bundling the server is not blocked by native code. |
| Web client URLs | All relative: `fetch('/api/...')`, `new WebSocket(\`${proto}://${location.host}/ws\`)` (`web/src/state/world.ts:188`). Assets use `import.meta.env.BASE_URL`. The client must be served over HTTP from the same origin as `/api` and `/ws`. **`file://` will not work** without code changes. |
| Who serves the web today | `vite preview` on 5173, proxying `/api` and `/ws` to 8787 (`web/vite.config.ts`). The Express server (`server/src/net/http.ts`) has **no static serving**. |
| Disk paths in the server | 9 uses of `import.meta.url` build paths like `../../replays` and `../../.cache/<kind>` (`engine/replays.ts:14`, `story/narration.ts:12`, `story/chant.ts:13`, `index.ts:18` and others). These break once bundled into one file, so full packaging needs a `DATA_DIR` env override. |
| Replays on disk | `server/replays/` is 19 MB (includes `demo-1.json`). `web/public` is 13 MB. |

## 1. Options compared

Current versions: Electron **45.3.x** stable (45.3.3 on 14 Nov 2026, Chromium 156, Node 24.22;
npm `latest` shows 45.3.2). electron-builder **26.18.0**. Electron Forge CLI **8.0.1**.

| Option | What it is | Effort tonight | Polish | Risk tonight |
| --- | --- | --- | --- | --- |
| **A. Thin Electron shell (recommended)** | Electron on Windows: setup window, preflight, splash, frameless fullscreen game window loading `http://localhost:5173`. Server and web stay in WSL, started by `wsl.exe ... scripts/demo.sh`. | about 4 to 4.5 h | High: own exe, icon, no browser chrome, setup and preflight screen | Medium-low: nothing in the app or server changes |
| B. Full Electron package | Server bundled with esbuild, run with `utilityProcess.fork`. Express also serves `web/dist`. Data in `%APPDATA%`. electron-builder `nsis` or `portable`. | about 8 to 12 h | Highest: one installer, no WSL | High: path rewrites, Windows-only bugs, untested Solana and Gemini on Windows Node, keys handling |
| C. Browser app mode | A `.lnk` or `.bat` with an icon: runs `wsl.exe ... demo.sh live --no-open`, then `chrome.exe --app=http://localhost:5173/ --start-fullscreen` (or `--kiosk`) | about 0.5 h | Medium: no tabs or address bar, but the window and taskbar show Chrome | Lowest |
| D. Tauri 2 | Rust shell with a WebView2 window. A Node server needs a sidecar compiled to a binary (the docs use `@yao-pkg/pkg`), plus `externalBin`, target-triple naming and shell plugin permissions. | 10 h or more | High | Very high: Rust toolchain, WebView2 (not Chromium-version-pinned), sidecar packaging |

Tauri is out for tonight. It needs a Rust toolchain, and the Node sidecar has to be compiled
to a binary named per target triple ([Tauri sidecar guide](https://v2.tauri.app/learn/sidecar-nodejs/)).

**Builder choice for A:** electron-builder with `--win dir`, run on Windows. That gives a
`win-unpacked\Terra Nova.exe` with the icon set by rcedit and no installer. Forge is fine too,
but adds more config than this needs.

## 2. Running our Node server with Electron

- **Tonight (A): do not run it in Electron.** The main process spawns `wsl.exe` and the server
  keeps running in WSL as today. The window loads `http://localhost:5173/` (vite preview proxies
  `/api` and `/ws`), so no client code changes.
- **Later (B):**
  - Bundle `server/src/index.ts` with esbuild (`--bundle --platform=node --format=esm`).
  - Add `DATA_DIR` and `WEB_DIST` env vars.
  - In `createApp`, add `express.static(WEB_DIST)` plus an SPA fallback, so one origin serves
    `/`, `/api` and `/ws`.
  - Start it with `utilityProcess.fork(modulePath, args, { env, stdio: 'pipe', serviceName })`
    after `ready`. It runs with Node.js enabled and emits `spawn` and `exit`
    ([utilityProcess docs](https://www.electronjs.org/docs/latest/api/utility-process)).
    ESM support in `utilityProcess` is **unconfirmed**. Bundle to CJS if it fails.
  - Load `http://127.0.0.1:<port>/` in the window. Never use `file://`: the client needs the
    same origin.

## 3. Building a Windows .exe from WSL

- electron-builder docs: building Windows targets on Linux needs **Wine 2.0+**, or the Docker
  image `electronuserland/builder:wine`. Mono is needed only for Squirrel.Windows
  ([multi-platform build](https://www.electron.build/docs/features/multi-platform-build)).
  The docs do not say whether `dir` or `portable` skip Wine. rcedit (icon, version info) is a
  Windows exe, so assume Wine is needed for any Windows target from Linux (**unconfirmed for
  `dir`**). Wine is not installed in this WSL.
- **Fastest path: build on Windows itself.** Windows already has Node 22.
  1. Copy the `desktop/` folder to a Windows path. Do not build from `\\wsl.localhost\...`:
     `cmd.exe` cannot use a UNC current directory, so npm scripts break there (well known,
     **not tested tonight**).
     ```
     robocopy \\wsl.localhost\Ubuntu\home\samuel\dev\durhack2026\desktop C:\terra-desktop /MIR /XD node_modules dist
     ```
  2. `cd C:\terra-desktop && npm install && npx electron-builder --win dir`
- This works because the shell has no dependency on the repo's `node_modules`. It only shells
  out to `wsl.exe`.
- Keep `desktop/` **out of the root npm workspaces**. Otherwise `npm install` in WSL downloads a
  Linux Electron (about 100 MB+) for everyone, and `./check.sh` could pick it up.

## 4. GPU (hybrid NVIDIA + Radeon)

- Electron documents `--force_high_performance_gpu`: "Force using discrete GPU when there are
  multiple GPUs available"
  ([command-line switches](https://www.electronjs.org/docs/latest/api/command-line-switches)).
  Set it with `app.commandLine.appendSwitch('force_high_performance_gpu')` before `ready`.
  Forum reports say it sometimes does nothing on Windows (anecdotal).
- **Belt and braces:** also set the Windows per-app preference for the built exe. Either use
  Settings > System > Display > Graphics > add the exe > High performance, or run:
  ```
  reg add "HKCU\Software\Microsoft\DirectX\UserGpuPreferences" /v "C:\terra-desktop\dist\win-unpacked\Terra Nova.exe" /t REG_SZ /d "GpuPreference=2;" /f
  ```
  The format matches existing entries on this laptop. The setting is keyed by exact path, so
  redo it if the exe moves.
- **Verify, don't trust.** The setup window's preflight reads `WEBGL_debug_renderer_info`
  `UNMASKED_RENDERER_WEBGL` from a WebGL context and fails the line unless it contains
  `NVIDIA`. The setup window shares the GPU process with the game window, so this checks the
  real thing. `chrome://gpu` also works inside Electron.
- **Unconfirmed:** whether the laptop's HDMI port is wired to the NVIDIA or the AMD GPU. If it is
  wired to AMD, frames are copied across, which is usually fine at 1080p.
- **WebGL2 performance:** Electron 45 is Chromium 156, about the same as current Chrome, so
  expect the same frame rate on the same GPU. **Not benchmarked.**
- **Throttling:** set `backgroundThrottling: false` in `webPreferences`; the default is `true`
  ([web-preferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)).
  The world keeps animating if focus moves to the setup window.
- **Window:** `fullscreen: true` on the projector display (pick it with `screen.getAllDisplays()`,
  the non-primary one if present). Also `backgroundColor: '#05070d'`, `show: false`, then show
  on `ready-to-show`, so there is no white flash. Use `kiosk: true` only if you want to block
  Alt+Tab-like exits; plain fullscreen is safer for recovery.
- **Reduced motion:** Electron follows the Windows "Animation effects" setting for
  `prefers-reduced-motion`. Make sure Windows animations are **on** on the demo laptop, or the
  app's motion (if it honours the query) is cut. Behaviour is **unconfirmed** for our code.

## 5. Polish

- **Icon:** a 256x256 `desktop/build/icon.ico` (electron-builder `win.icon`), also passed as
  `BrowserWindow({ icon })`.
- **Splash:** a frameless 520x320 `splash.html` window. It streams `demo.sh` progress lines
  ("Building the web", "Starting the server", "Preparing 14/30") over IPC and closes when the
  game window is `ready-to-show`.
- **Single instance:** `app.requestSingleInstanceLock()`. A second double-click focuses the open
  window instead of starting a second `demo.sh`, which would kill the first one's ports.
- **Menu:** `Menu.setApplicationMenu(null)`. Handle keys in `webContents.on('before-input-event')`:

  | Key | Action |
  | --- | --- |
  | F11 | Toggle fullscreen |
  | Ctrl+Shift+N | Next judge: `demo.sh reset` |
  | Ctrl+Shift+Q | Back to setup |
  | F12 | DevTools |
  | Ctrl+Q | Quit, runs `demo.sh stop` |

  Check that none of these clash with the app's own key bindings (see the README controls
  table).
- **Title:** "Terra Nova".
- **SmartScreen:** SmartScreen warns on files carrying the Mark of the Web (a `Zone.Identifier`
  stream added to downloads). An exe built locally on the laptop has no such mark, so no prompt
  is expected ([Mark of the Web background](https://textslashplain.com/2016/04/04/downloads-and-the-mark-of-the-web/)).
  If an exe is ever downloaded (from GitHub Releases), unsigned builds show "Windows protected
  your PC": More info > Run anyway
  ([electron-builder code signing](https://www.electron.build/docs/features/code-signing/code-signing-win)).
  For the live demo: build on the laptop and never download the exe.

## 6. Secrets and config

- **Never bundle keys.** In A, keys stay in WSL. `demo.sh` already loads
  `~/.config/durhack/keys.env`, then `.env`. The Solana keypairs are in
  `~/.config/durhack/solana` (or `SOLANA_KEYS_DIR`). The Electron app holds no secrets. The
  preflight runs inside WSL and prints only pass/fail plus non-secret facts (credits left, model
  names).
- **Setup choices** (not secrets) persist as `config.json` in `app.getPath('userData')`
  (`%APPDATA%\Terra Nova\`). They reach the server as **env vars at spawn**. `demo.sh` already
  passes the caller's env through for `LLM_MODE`, `SOLANA_MODE` and `GEMINI_MODEL_IMAGE`, and
  `load_env_file` never overrides a key that is already set.
- **In B (later):**
  - Read `%USERPROFILE%\.config\durhack\keys.env` at runtime in main.
  - Pass the keys to the `utilityProcess` via `env`.
  - Put replays and caches under `userData` via `DATA_DIR`.
  - Ship `demo-1.json` in `extraResources`.
  - Add `files` excludes in electron-builder (`!**/.env`, `!**/keys.env`) as a guard.

## 7. Size and time

- Electron's npm package unpacks to about 1.2 MB, because the binary is downloaded on install.
  The Windows Electron runtime itself is roughly 100 MB zipped and 250 to 300 MB unpacked
  (**estimate, not measured**).
- A `win-unpacked` folder for A: about 280 to 320 MB on disk (the shell is tiny).
- B: plus 13 MB web assets, the 19 MB replays and the server bundle (a few MB). An NSIS
  installer would be about 100 to 130 MB (**estimate**).
- Build time on Windows: first `npm install` 1 to 3 min (Electron download), then
  `electron-builder --win dir` under 1 min (**estimate**).

## The setup screen and preflight (owner requirement)

**Where it lives:** a small plain HTML window owned by the Electron main process
(`desktop/setup.html`). It is **not** a route on our server, because it must work before the
server exists and must choose how the server starts.

The checks run in a **WSL-side script**, `scripts/preflight.mjs`, so they see the same keys
file and the same `localhost` as the server. Electron runs it with `wsl.exe` and reads one JSON
line per check. The GPU check is the one exception: it runs in the setup window itself.

### Toggles

Saved to `config.json`, prefilled from the last run.

| Toggle | Values | Maps to (env at spawn / `demo.sh` flag) | Exists today? |
| --- | --- | --- | --- |
| Demo mode | Live / Mock rehearsal | `demo.sh live` or `demo.sh mock` | Yes |
| LLM provider | Gemini API / Gemma via Gemini API / local Gemma via Ollama / Mock | `LLM_MODE=live\|mock`. Gemma via the API: set `GEMINI_MODEL_RULER`, `GEMINI_MODEL_LORE`, `GEMINI_MODEL_BIBLE` to a Gemma id. Ollama: e.g. `LLM_PROVIDER=ollama`, `OLLAMA_HOST=http://localhost:11434`, `OLLAMA_MODEL=...` | Mock and Gemini: yes. Model envs: yes. **Ollama: no**, it depends on the other researcher's work. Use whatever names they land. |
| ElevenLabs | On / Off | Off: a new `demo.sh --no-voice` that unsets `ELEVENLABS_API_KEY` **after** the keys file loads. Exporting it empty is not enough: `load_env_file` fills empty keys. | **No** (missing key = silence, so behaviour exists, switch doesn't) |
| Solana devnet | On / Off | `SOLANA_MODE=devnet\|mock` | Yes |
| World | Fresh prepared world (prompt, nations) / Saved replay (`demo-1`) | `--prompt`, `--nations`, or `--replay demo-1` | Yes |

### Preflight lines

Each line shows PASS, FAIL or SKIP and a short reason. The script runs only the lines that
apply.

| Check | How | Pass when |
| --- | --- | --- |
| WSL and Node | `node -v` inside the spawned shell | v22+ (catches the Node 18 trap) |
| Repo ready | `node_modules/.bin/tsx` and `vite` exist; ports 8787 and 5173 free or ours | yes |
| Gemini key | `GET https://generativelanguage.googleapis.com/v1beta/models/<ruler model>` with header `x-goog-api-key`. Then one `generateContent` with `maxOutputTokens: 1` for a real call. | 200 and a reply |
| Gemma via API | Same, with the Gemma model id | 200 |
| Ollama | `GET http://localhost:11434/api/tags`; the model name is in `models[].name`. Optionally a 1-token `/api/generate` to warm it (and load it into VRAM before the judge arrives). | Reachable and model pulled. Today: **only qwen3.6 pulled**. |
| ElevenLabs | `GET https://api.elevenlabs.io/v1/user/subscription`, header `xi-api-key` | 200 and `character_limit - character_count` above a floor (say 5,000) |
| Solana devnet | JSON-RPC `getHealth` and `getBalance` of the commons wallet on `SOLANA_RPC_URL` (default devnet) | `ok` and balance above a floor (for example 0.5 SOL) |
| GPU | In the setup window: `UNMASKED_RENDERER_WEBGL` contains `NVIDIA` | yes |
| Display | `screen.getAllDisplays()` shows a 1920x1080 external display | warn only |

Doc references:
- Ollama `/api/tags` ([docs](https://docs.ollama.com/api/tags))
- ElevenLabs subscription fields `character_count` and `character_limit`
  ([docs](https://elevenlabs.io/docs/api-reference/user/subscription/get))
- Gemini `models.get` ([docs](https://aistudio.google.com/api-reference/models))

The header names `x-goog-api-key` and `xi-api-key` are standard, but the fetched pages did not
show them: **unconfirmed from source**. Use whatever header the server code already uses.

**Start.** The button is enabled when every enabled service passes. A "Start anyway" link covers
a known-bad line, such as ElevenLabs credits running low. Main then spawns:

```
wsl.exe -d Ubuntu --cd /home/samuel/dev/durhack2026 -e bash -c \
  'export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"; \
   LLM_MODE=... SOLANA_MODE=... bash scripts/demo.sh live --no-open [--replay demo-1] [--no-voice] \
   && exec tail -n0 -F .demo/server.log'
```

Values come from `config.json`; pass them as `env` entries plus `WSLENV`, or build the string
safely. The trailing `tail -F` keeps one long-lived child, so the processes stay attached and
the server log streams into the app. A "Logs" toggle in the splash shows it.

**Between judges:** Ctrl+Shift+N in the game window, or a button in the setup window, runs
`demo.sh reset`. With `--replay demo-1` it is instant. The open window swaps worlds without a
reload (the code already does this).

## Step-by-step plan (option A) with files

All new files except two script changes. No changes to `server/` or `web/`.

| Step | Files | Hours |
| --- | --- | --- |
| 0. Fallback first: Chrome app-mode shortcut. Desktop `.lnk` running `wsl.exe ... bash -c '<nvm PATH>; bash scripts/demo.sh live --no-open'`, then `chrome.exe --app=http://localhost:5173/ --start-fullscreen`. Also add Chrome to Graphics settings as High performance and check `chrome://gpu`. | `desktop/fallback/terra-chrome.bat`, `desktop/build/icon.ico` | 0.5 |
| 1. Preflight script: Gemini, Gemma, Ollama, ElevenLabs, Solana, Node, ports. JSON lines out, human lines without `--json`. Add `npm run demo:check`. | `scripts/preflight.mjs`, root `package.json` script | 1.0 |
| 2. `demo.sh` switches: `--no-voice`; pass through `LLM_PROVIDER` and `OLLAMA_*` once that work lands. | `scripts/demo.sh` | 0.25 |
| 3. Electron shell: single-instance lock, GPU switch, setup window, splash, game window on the projector, keys, stop on quit, spawn and stream `wsl.exe`. | `desktop/package.json`, `desktop/main.cjs`, `desktop/preload.cjs`, `desktop/wsl.cjs` (spawn helpers) | 1.25 |
| 4. Setup UI: plain form, `config.json` load/save, preflight list, WebGL GPU line, Start, Reset. | `desktop/setup.html`, `desktop/setup.js`, `desktop/splash.html` | 0.75 |
| 5. Build on Windows: robocopy to `C:\terra-desktop`, `npm install`, `electron-builder --win dir`, desktop shortcut, registry GPU line, first run. | `desktop/electron-builder.yml`, `desktop/build/icon.ico`, `desktop/README.md` (or a README section) | 0.5 |
| 6. Full rehearsal on the projector: live, reset, mock, Ollama on and off, kill-and-relaunch. Open `human-test` issues. | none | 0.5 |
| **Total** | | **about 4.75 h** (about 2 h for a minimal cut: steps 0, 3 and 5 with a splash only, no setup UI) |

Notes:
- `.cjs` plain JS avoids a TypeScript build step in a folder outside the workspaces. If the
  owner wants TypeScript, add `esbuild main.ts --platform=node --format=cjs` (plus 0.25 h).
- `desktop/electron-builder.yml`:
  ```yaml
  appId: dev.terranova.app
  productName: Terra Nova
  directories:
    output: dist
  files:
    - main.cjs
    - preload.cjs
    - wsl.cjs
    - setup.html
    - setup.js
    - splash.html
    - build/icon.ico
  win:
    target: dir
    icon: build/icon.ico
  ```
- Per the repo rules, `scripts/` and root `package.json` are owner paths. The README needs a
  "Desktop app" line in Quick start and the new keys in the controls table.

## Top risks for the live demo

1. **Wrong Node in `wsl.exe`.** Verified: non-interactive shells get Node 18. Fix: the explicit
   nvm PATH. The preflight Node line catches it.
2. **iGPU rendering.** The flag may be ignored. Set the registry or Graphics setting per exe
   path and verify with the WebGL renderer line. The same risk already exists for Chrome today
   (no entry set).
3. **Orphaned or double servers.** Closing the window without `demo.sh stop`, or launching
   twice, leaves or kills processes. Mitigate with the single-instance lock, `before-quit`
   running `demo.sh stop`, and `demo.sh` already freeing its ports on start.
4. **Late-night code on the demo path.** A bug in the shell blocks the whole demo. Keep the
   Chrome shortcut and the plain `npm run demo` terminal path working, and know the switch
   takes 20 seconds.
5. **Preflight spends real budget.** The `generateContent` and Ollama warm-up calls cost little,
   but do not loop them. Run once per Start.
6. **Ollama path not built yet.** The toggle is only as real as the other researcher's server
   change. Gemma is not pulled yet (`ollama pull <gemma model>` is about 5 to 20 GB).
7. **Keys outside WSL.** Do not copy `keys.env` into `desktop/` or `C:\terra-desktop`. The shell
   never needs it.

## Fallback

In order of preference:
1. The Chrome app-mode shortcut (step 0).
2. `npm run demo` in a WSL terminal, then F11 in Chrome.
3. `npm run demo:reset -- --replay demo-1` for an instant, API-free world if a service fails at
   the table.

## Sources

- Electron releases (45.3.3, 14 Nov 2026): https://releases.electronjs.org/
- Electron command-line switches (`force_high_performance_gpu`): https://www.electronjs.org/docs/latest/api/command-line-switches
- Electron `utilityProcess`: https://www.electronjs.org/docs/latest/api/utility-process
- Electron web preferences (`backgroundThrottling` default true): https://www.electronjs.org/docs/latest/api/structures/web-preferences
- electron-builder multi-platform build (Wine for Windows on Linux): https://www.electron.build/docs/features/multi-platform-build
- electron-builder Windows code signing and SmartScreen: https://www.electron.build/docs/features/code-signing/code-signing-win
- Mark of the Web and downloads: https://textslashplain.com/2016/04/04/downloads-and-the-mark-of-the-web/
- Hybrid GPU reports for Electron (anecdotal): https://kaweah.freedombox.rocks/kiwix/content/stackoverflow.com_en_all_2023-11/questions/54464276/how-to-force-discrete-gpu-in-electron-js
- Tauri 2 Node sidecar: https://v2.tauri.app/learn/sidecar-nodejs/
- Ollama `/api/tags`: https://docs.ollama.com/api/tags
- ElevenLabs user subscription: https://elevenlabs.io/docs/api-reference/user/subscription/get
- Gemini models API: https://aistudio.google.com/api-reference/models
- npm registry (electron 45.3.2, electron-builder 26.18.0, @electron-forge/cli 8.0.1), checked with `npm view` on 14 Nov 2026.
