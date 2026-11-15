#!/usr/bin/env bash
# The Terra Nova desktop app (Windows), driven from WSL.
#
#   scripts/desktop.sh launch [app args]   build the app if desktop/ changed, then open it   (npm run demo)
#   scripts/desktop.sh build               copy desktop/ to C:\terra-desktop and build it     (npm run desktop:build)
#   scripts/desktop.sh shortcut            (re)make the "Terra Nova" shortcut on the Windows desktop
#
# The app is a thin Electron shell on Windows; the server and web stay in WSL (scripts/demo.sh).
# It is built on Windows with Windows Node (electron-builder --win dir) from a copy of desktop/,
# never from the \\wsl.localhost share. App args, e.g. --server-port 8779 --web-port 5179, are
# passed through for this run. Outside WSL, launch falls back to scripts/demo.sh live.
# No keys are copied: the app holds none. Plain words only in output, no emojis.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/desktop"
WIN_DIR='C:\terra-desktop'
WIN_DIR_WSL="/mnt/c/terra-desktop"
EXE_WIN='C:\terra-desktop\dist\win-unpacked\Terra Nova.exe'
EXE_WSL="$WIN_DIR_WSL/dist/win-unpacked/Terra Nova.exe"
GPU_KEY='HKCU\Software\Microsoft\DirectX\UserGpuPreferences'

say() { printf '%s\n' "$*"; }
die() { printf 'FAILED: %s\n' "$*" >&2; exit 1; }

is_wsl() { grep -qi microsoft /proc/version 2>/dev/null && command -v cmd.exe >/dev/null; }

# Runs a Windows command line from a Windows working directory (cmd.exe refuses a Linux one).
win() { (cd /mnt/c && cmd.exe /c "$@"); }

src_hash() {
  (cd "$SRC" && find . -type f -not -path './node_modules/*' -not -path './dist/*' -print0 \
    | sort -z | xargs -0 sha1sum | sha1sum | cut -d' ' -f1)
}

app_running() { (cd /mnt/c && tasklist.exe /FI "IMAGENAME eq Terra Nova.exe" /NH 2>/dev/null) | grep -qi "Terra Nova.exe"; }

node_bin() { local n; n="$(command -v node 2>/dev/null)" && dirname "$n"; }

shortcut_args() {
  local nb
  nb="$(node_bin)"
  printf -- '--repo %s --distro %s%s' "$ROOT" "${WSL_DISTRO_NAME:-Ubuntu}" "${nb:+ --node-bin $nb}"
}

make_shortcut() {
  [ -f "$EXE_WSL" ] || die "the app is not built yet (npm run desktop:build)"
  cat >"$WIN_DIR_WSL/shortcut.ps1" <<'PS'
param([string]$Exe, [string]$Arguments, [string]$Dir)
$desk = [Environment]::GetFolderPath('Desktop')
$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desk 'Terra Nova.lnk'))
$s.TargetPath = $Exe
$s.Arguments = $Arguments
$s.WorkingDirectory = $Dir
$s.IconLocation = "$Exe,0"
$s.Description = 'Terra Nova: start the demo'
$s.Save()
Write-Output "Shortcut: $(Join-Path $desk 'Terra Nova.lnk')"
PS
  (cd /mnt/c && powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$WIN_DIR\\shortcut.ps1" \
    -Exe "$EXE_WIN" -Arguments "$(shortcut_args)" -Dir "$WIN_DIR\\dist\\win-unpacked") | tr -d '\r'
  printf '%s\n' "$ROOT" >"$WIN_DIR_WSL/.repo"
}

do_build() {
  is_wsl || die "the desktop app builds on Windows from WSL only"
  [ -d "$SRC" ] || die "desktop/ is missing"
  if app_running; then die "Terra Nova is open: quit it (Ctrl+Q or close it), then build again"; fi
  mkdir -p "$WIN_DIR_WSL"
  say "Copying desktop/ to $WIN_DIR..."
  rsync -a --delete --exclude node_modules --exclude dist --exclude .built-hash --exclude .repo \
    --exclude shortcut.ps1 "$SRC/" "$WIN_DIR_WSL/" || die "could not copy desktop/ to $WIN_DIR"
  say "Building on Windows (npm install, electron-builder --win dir); the first build downloads Electron..."
  if ! win "cd /d $WIN_DIR && npm install --no-audit --no-fund && npx electron-builder --win dir" \
      >"$WIN_DIR_WSL/build.log" 2>&1; then
    tail -n 25 "$WIN_DIR_WSL/build.log" | tr -d '\r'
    say "Build it by hand in a Windows terminal:"
    say "  cd /d $WIN_DIR && npm install && npx electron-builder --win dir"
    die "the desktop build failed (log: $WIN_DIR\\build.log)"
  fi
  [ -f "$EXE_WSL" ] || die "the build finished but $EXE_WIN is missing (log: $WIN_DIR\\build.log)"
  # Render on the NVIDIA GPU: the per-exe Windows preference, HKCU and this exe only.
  win reg add "$GPU_KEY" /v "$EXE_WIN" /t REG_SZ /d "GpuPreference=2;" /f >/dev/null 2>&1 \
    || say "WARN: could not set the GPU preference; set Terra Nova to High performance in Windows Graphics settings."
  src_hash >"$WIN_DIR_WSL/.built-hash"
  make_shortcut
  say "Built: $EXE_WIN"
}

do_launch() {
  if ! is_wsl; then
    say "Not on WSL: starting the terminal demo instead (scripts/demo.sh live)."
    exec bash "$ROOT/scripts/demo.sh" live "$@"
  fi
  local want have=""
  want="$(src_hash)"
  [ -f "$WIN_DIR_WSL/.built-hash" ] && have="$(cat "$WIN_DIR_WSL/.built-hash")"
  if [ ! -f "$EXE_WSL" ] || [ "$want" != "$have" ]; then
    if app_running; then
      say "WARN: desktop/ changed, but Terra Nova is open; using the open app. Quit it and run npm run demo again to rebuild."
    else
      say "The desktop app is missing or older than desktop/: building it."
      do_build
    fi
  fi
  [ "$(cat "$WIN_DIR_WSL/.repo" 2>/dev/null)" = "$ROOT" ] || make_shortcut
  say "Opening Terra Nova (settings, checks, then Start)..."
  # Start-Process detaches the app (cmd start would hand it this terminal's pipes and block npm).
  # Each argument is single-quoted for PowerShell, then double-quoted for the app's command line.
  local nb a list=""
  nb="$(node_bin)"
  local args=(--repo "$ROOT" --distro "${WSL_DISTRO_NAME:-Ubuntu}")
  [ -n "$nb" ] && args+=(--node-bin "$nb")
  args+=("$@")
  for a in "${args[@]}"; do list="$list${list:+,}'\"${a//\'/\'\'}\"'"; done
  (cd /mnt/c && powershell.exe -NoProfile -Command "Start-Process -FilePath '$EXE_WIN' -ArgumentList $list") >/dev/null 2>&1 \
    || die "could not start $EXE_WIN"
  say "DONE: the app is open on Windows. Quitting it stops the demo. Terminal fallback: npm run demo:terminal"
}

cmd="${1:-launch}"
[ $# -gt 0 ] && shift
case "$cmd" in
  launch)   do_launch "$@" ;;
  build)    do_build ;;
  shortcut) make_shortcut ;;
  help|-h|--help) sed -n '2,/^set -uo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//' ;;
  *) say "Usage: scripts/desktop.sh launch|build|shortcut"; exit 1 ;;
esac
