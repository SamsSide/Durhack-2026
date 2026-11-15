@echo off
rem Terra Nova fallback: if the desktop app misbehaves at the table, double-click this.
rem It starts the live demo in WSL (scripts/demo.sh live), then opens it in a Chrome app window
rem (no tabs, no address bar), fullscreen. Stop it with: npm run demo:stop (in WSL).
rem Settings (optional, set before running): TERRA_DISTRO, TERRA_REPO (a WSL path),
rem TERRA_ARGS (demo.sh options), TERRA_SERVER_PORT, TERRA_WEB_PORT.
setlocal
if "%TERRA_DISTRO%"=="" set TERRA_DISTRO=Ubuntu
if "%TERRA_REPO%"=="" set TERRA_REPO=$HOME/dev/durhack2026
if "%TERRA_ARGS%"=="" set TERRA_ARGS=--no-world
if "%TERRA_SERVER_PORT%"=="" set TERRA_SERVER_PORT=8787
if "%TERRA_WEB_PORT%"=="" set TERRA_WEB_PORT=5173

echo Starting the Terra Nova demo in WSL (this takes up to a minute)...
rem Node 22 from nvm first on PATH: a non-interactive WSL shell gets the system Node 18.
wsl.exe -d %TERRA_DISTRO% -e bash -c "for d in $HOME/.nvm/versions/node/v2[2-9]*/bin; do [ -x $d/node ] && NB=$d; done; [ -z ${NB:-} ] || export PATH=$NB:$PATH; export DEMO_SERVER_PORT=%TERRA_SERVER_PORT% DEMO_WEB_PORT=%TERRA_WEB_PORT%; cd %TERRA_REPO% && bash scripts/demo.sh live --no-open %TERRA_ARGS%"
if errorlevel 1 (
  echo FAILED: the demo did not start. Try npm run demo:terminal in a WSL terminal.
  pause
  exit /b 1
)

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" (
  echo Chrome was not found: open http://localhost:%TERRA_WEB_PORT%/ in any browser and press F11.
  start "" http://localhost:%TERRA_WEB_PORT%/
  exit /b 0
)
rem Its own profile, so the window opens fullscreen even when Chrome is already running.
start "" "%CHROME%" --app=http://localhost:%TERRA_WEB_PORT%/ --start-fullscreen --force_high_performance_gpu --user-data-dir="%LocalAppData%\TerraNovaChrome" --no-first-run --no-default-browser-check
echo DONE: Terra Nova is open in a Chrome window. F11 leaves fullscreen.
