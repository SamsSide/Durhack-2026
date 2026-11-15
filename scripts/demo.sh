#!/usr/bin/env bash
# One command for the table demo: start the whole app, open it in the browser, reset it between
# judges, stop it.
#
#   scripts/demo.sh live   [options]   real Gemini, ElevenLabs and Solana devnet  (npm run demo:terminal, npm run demo:live)
#   scripts/demo.sh mock   [options]   no API calls, for rehearsals              (npm run demo:mock)
#   scripts/demo.sh reset  [options]   a fresh prepared world, servers kept       (npm run demo:reset)
#   scripts/demo.sh check  [--mock] [--no-voice] [--json]
#                                      the preflight checks with the demo's keys  (npm run demo:check)
#   scripts/demo.sh status                                                         (npm run demo:status)
#   scripts/demo.sh stop                                                           (npm run demo:stop)
#
# npm run demo opens the Windows desktop app (scripts/desktop.sh), which calls this script.
#
# Options (live, mock, reset):
#   --prompt "..."   the world prompt (default: a strong demo prompt; reset reuses the last one)
#   --nations N      how many nations (default 6)
#   --replay <id>    play a saved replay (e.g. demo-1) instead of a new world: instant, no API calls
#   --wait S         how long to wait for prepare, in seconds (default 60)
#   --no-world       start with no world: the app opens on its Create screen (live, mock)
#   --no-voice       no ElevenLabs: the key is dropped after the keys files load (live, check)
#   --no-open        do not open the browser (live, mock)
#   --lan            serve the web on every interface and print the LAN address (live, mock)
#
# Ports: DEMO_SERVER_PORT (default 8787) and DEMO_WEB_PORT (default 5173).
# Runs a stable server (tsx, no watch: a git pull cannot restart it and drop the world) and a
# production build of the web (vite preview, rebuilt only when the web sources changed).
# Logs and PIDs live in .demo/ (git-ignored). Plain words only in output, no emojis.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="$ROOT/.demo"
STATE="$DEMO_DIR/state"
DEFAULT_PROMPT="Six rival kingdoms on a stormy ocean world, fighting over spice islands, sea roads and the ruins of a drowned empire"

# load_env_file FILE: export KEY=VALUE lines from FILE, skipping comments, empty values and keys
# that are already set (so the owner's keys file is not blanked by an empty .env template line).
load_env_file() {
  local f="$1" line key val
  [ -f "$f" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    line="${line#export }"
    key="${line%%=*}"; val="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    case "$val" in \"*\") val="${val:1:${#val}-2}" ;; \'*\') val="${val:1:${#val}-2}" ;; esac
    [ -n "$val" ] || continue
    [ -n "${!key:-}" ] && continue
    export "$key=$val"
  done < "$f"
}

say() { printf '%s\n' "$*"; }
die() { printf 'FAILED: %s\n' "$*" >&2; exit 1; }

# --- state ---------------------------------------------------------------------------------------

S_MODE="" S_SERVER_PORT="" S_WEB_PORT="" S_LAN="" S_PROMPT="" S_NATIONS="" S_WORLD="" S_REPLAY=""
load_state() { [ -f "$STATE" ] && . "$STATE"; return 0; }
save_state() {
  mkdir -p "$DEMO_DIR"
  {
    printf 'S_MODE=%q\n' "$S_MODE"
    printf 'S_SERVER_PORT=%q\n' "$S_SERVER_PORT"
    printf 'S_WEB_PORT=%q\n' "$S_WEB_PORT"
    printf 'S_LAN=%q\n' "$S_LAN"
    printf 'S_PROMPT=%q\n' "$S_PROMPT"
    printf 'S_NATIONS=%q\n' "$S_NATIONS"
    printf 'S_WORLD=%q\n' "$S_WORLD"
    printf 'S_REPLAY=%q\n' "$S_REPLAY"
  } >"$STATE"
}

# Ports: the environment wins, then the running demo's state, then the defaults.
resolve_ports() {
  SERVER_PORT="${DEMO_SERVER_PORT:-${S_SERVER_PORT:-8787}}"
  WEB_PORT="${DEMO_WEB_PORT:-${S_WEB_PORT:-5173}}"
}

# --- options -------------------------------------------------------------------------------------

OPT_PROMPT="" OPT_NATIONS="" OPT_REPLAY="" OPT_WAIT=60 OPT_OPEN=1 OPT_LAN=0 OPT_NOWORLD=0 OPT_NOVOICE=0
parse_opts() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --prompt)  [ $# -ge 2 ] || die "--prompt needs a value"; OPT_PROMPT="$2"; shift 2 ;;
      --nations) [ $# -ge 2 ] || die "--nations needs a value"; OPT_NATIONS="$2"; shift 2 ;;
      --replay)  [ $# -ge 2 ] || die "--replay needs an id"; OPT_REPLAY="$2"; shift 2 ;;
      --wait)    [ $# -ge 2 ] || die "--wait needs a value"; OPT_WAIT="$2"; shift 2 ;;
      --no-open) OPT_OPEN=0; shift ;;
      --no-world) OPT_NOWORLD=1; shift ;;
      --no-voice) OPT_NOVOICE=1; shift ;;
      --lan)     OPT_LAN=1; shift ;;
      *) die "unknown option: $1 (see the top of scripts/demo.sh)" ;;
    esac
  done
  if [ -n "$OPT_NATIONS" ] && ! [[ "$OPT_NATIONS" =~ ^[0-9]+$ ]]; then die "--nations must be a number"; fi
  [[ "$OPT_WAIT" =~ ^[0-9]+$ ]] || die "--wait must be a number of seconds"
  if [ "$OPT_NOWORLD" = 1 ] && [ -n "$OPT_REPLAY" ]; then die "--no-world and --replay do not go together"; fi
}

# Loads the keys files the way the live demo does. Earlier files win; an empty value (KEY=) never
# blanks a key set by an earlier file. --no-voice drops the ElevenLabs key afterwards (an empty
# export is not enough: load_env_file would fill it from the keys file).
load_keys() {
  load_env_file "$HOME/.config/durhack/keys.env"
  load_env_file "$ROOT/.env"
  if [ "$OPT_NOVOICE" = 1 ]; then
    unset ELEVENLABS_API_KEY
    export DEMO_VOICE=0
  fi
}

# --- processes -----------------------------------------------------------------------------------

alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }
pid_of() { [ -f "$DEMO_DIR/$1.pid" ] && cat "$DEMO_DIR/$1.pid"; }

# Kills a process and everything in its process group (each part is started as its own group).
kill_group() {
  local pid="$1" i
  alive "$pid" || return 0
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  for i in $(seq 1 20); do alive "$pid" || return 0; sleep 0.25; done
  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
  return 0
}

# PIDs listening on a TCP port. ss is instant; lsof (macOS) can take seconds under WSL.
listeners() {
  if command -v ss >/dev/null; then
    ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
  elif command -v lsof >/dev/null; then
    lsof -t -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | sort -u
  fi
}
port_busy() {
  if command -v ss >/dev/null; then [ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]; else [ -n "$(listeners "$1")" ]; fi
}

# Frees a port, but only from node, vite or tsx processes; anything else is reported, not killed.
free_port() {
  local port="$1" pid name
  for pid in $(listeners "$port"); do
    name="$(ps -o comm= -p "$pid" 2>/dev/null)"
    case "$name" in
      node|node*|vite|tsx|npm*)
        say "Port $port is held by $name (pid $pid): stopping it."
        kill -TERM "$pid" 2>/dev/null ;;
      *) say "WARN: port $port is held by $name (pid $pid), which is not node; left alone." ;;
    esac
  done
  for _ in $(seq 1 20); do port_busy "$port" || return 0; sleep 0.25; done
  for pid in $(listeners "$port"); do
    name="$(ps -o comm= -p "$pid" 2>/dev/null)"
    case "$name" in node|node*|vite|tsx|npm*) kill -KILL "$pid" 2>/dev/null ;; esac
  done
  return 0
}

do_stop() {
  local quiet="${1:-}" part pid
  for part in web server; do
    pid="$(pid_of "$part")"
    if alive "$pid"; then [ -n "$quiet" ] || say "Stopping the $part (pid $pid)"; kill_group "$pid"; fi
    rm -f "$DEMO_DIR/$part.pid"
  done
  free_port "$SERVER_PORT"
  free_port "$WEB_PORT"
  local busy=""
  port_busy "$SERVER_PORT" && busy="$busy $SERVER_PORT"
  port_busy "$WEB_PORT" && busy="$busy $WEB_PORT"
  [ -z "$busy" ] || die "port(s)$busy are still in use; stop what holds them and try again"
  rm -f "$STATE"
  [ -n "$quiet" ] || say "DONE"
}

last_lines() { say "--- last lines of $1 ---"; tail -n 20 "$1" 2>/dev/null; say "---"; }

wait_for() {  # wait_for <what> <seconds> <log> <test command...>
  local what="$1" secs="$2" log="$3" i; shift 3
  for i in $(seq 1 $((secs * 4))); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.25
  done
  last_lines "$log"
  die "the $what did not come up within $secs s (log: ${log#"$ROOT"/})"
}

health_ok() { curl -fsS --max-time 2 "http://localhost:$SERVER_PORT/api/health" | grep -q '"ok":true'; }
web_ok() { curl -fsS --max-time 2 -o /dev/null "http://localhost:$WEB_PORT/"; }

# --- the web build -------------------------------------------------------------------------------

web_hash() {
  (cd "$ROOT" && find web/src web/public packages/shared/src web/index.html web/vite.config.ts \
      web/package.json web/tsconfig.json package-lock.json -type f -print0 2>/dev/null \
    | sort -z | xargs -0 sha1sum | sha1sum | cut -d' ' -f1)
}

build_web() {
  local want have=""
  want="$(web_hash)"
  [ -f "$DEMO_DIR/web.hash" ] && have="$(cat "$DEMO_DIR/web.hash")"
  if [ "$want" = "$have" ] && [ -f "$ROOT/web/dist/index.html" ]; then
    say "Web build is up to date."
    return 0
  fi
  say "Building the web (production)..."
  if ! (cd "$ROOT/web" && "$ROOT/node_modules/.bin/vite" build) >"$DEMO_DIR/build.log" 2>&1; then
    last_lines "$DEMO_DIR/build.log"
    die "the web build failed (log: .demo/build.log)"
  fi
  printf '%s\n' "$want" >"$DEMO_DIR/web.hash"
  say "Web built."
}

# --- the browser ---------------------------------------------------------------------------------

open_browser() {
  local url="$1"
  if grep -qi microsoft /proc/version 2>/dev/null; then
    # cmd.exe complains about a Linux working directory; run it from a Windows one.
    if command -v cmd.exe >/dev/null && (cd /mnt/c 2>/dev/null || cd /; cmd.exe /c start "" "$url") >/dev/null 2>&1; then return 0; fi
    if command -v wslview >/dev/null && wslview "$url" >/dev/null 2>&1; then return 0; fi
    if command -v explorer.exe >/dev/null; then explorer.exe "$url" >/dev/null 2>&1; return 0; fi
  elif [ "$(uname -s)" = "Darwin" ]; then
    open "$url" && return 0
  elif command -v xdg-open >/dev/null; then
    xdg-open "$url" >/dev/null 2>&1 & return 0
  fi
  say "WARN: could not open a browser; open $url yourself."
}

lan_urls() {
  local ip
  for ip in $(hostname -I 2>/dev/null); do
    case "$ip" in *:*|127.*|169.254.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*) continue ;; esac
    say "  http://$ip:$WEB_PORT/"
  done
}

# --- the world -----------------------------------------------------------------------------------

make_world() {  # sets S_WORLD; uses OPT_REPLAY, S_PROMPT, S_NATIONS, OPT_WAIT
  local line world="" args
  if [ -n "$OPT_REPLAY" ]; then
    args=(replay --port "$SERVER_PORT" --id "$OPT_REPLAY")
  else
    args=(new --port "$SERVER_PORT" --prompt "$S_PROMPT" --nations "$S_NATIONS" --wait "$OPT_WAIT")
  fi
  # Progress lines are shown as they come; the helper's last line is "WORLD <id>" (FAILED goes to stderr).
  while IFS= read -r line; do
    case "$line" in
      "WORLD "*) world="${line#WORLD }" ;;
      *) say "$line" ;;
    esac
  done < <(node "$ROOT/scripts/demo-world.mjs" "${args[@]}")
  [ -n "$world" ] || exit 1
  S_WORLD="$world"
  S_REPLAY="$OPT_REPLAY"
  save_state
}

summary() {
  local url="http://localhost:$WEB_PORT/"
  say ""
  say "Terra Nova demo is running."
  say "  mode:   $S_MODE"
  say "  url:    $url"
  if [ -n "$S_REPLAY" ]; then say "  world:  $S_WORLD (replay $S_REPLAY)"
  elif [ -z "$S_WORLD" ]; then say "  world:  none yet (type one on the Create screen)"
  else say "  world:  $S_WORLD"; fi
  say "  logs:   .demo/server.log, .demo/web.log"
  if [ "$S_LAN" = 1 ]; then
    say "  on the LAN (teammates):"
    lan_urls
    say "  (Windows may ask to allow node through the firewall the first time: allow it on private networks.)"
  fi
  say "Between judges: npm run demo:reset   (instant, no API calls: npm run demo:reset -- --replay demo-1)"
  say "To stop:        npm run demo:stop"
}

# --- commands ------------------------------------------------------------------------------------

do_start() {
  local mode="$1"; shift
  parse_opts "$@"
  local caller_llm="${LLM_MODE:-}" caller_sol="${SOLANA_MODE:-}" caller_img="${GEMINI_MODEL_IMAGE:-}"
  load_state
  resolve_ports
  mkdir -p "$DEMO_DIR"

  if [ "$mode" = live ]; then
    # Keys come from these files; never printed.
    load_keys
    # The mode is the command's, not a dev default from .env; only the caller's own env overrides it.
    export LLM_MODE="${caller_llm:-live}" SOLANA_MODE="${caller_sol:-devnet}"
    export GEMINI_MODEL_IMAGE="${caller_img:-${GEMINI_MODEL_IMAGE:-gemini-3.1-flash-image}}"
    [ -n "${GEMINI_API_KEY:-}" ] || say "WARN: GEMINI_API_KEY is not set (looked in ~/.config/durhack/keys.env and .env)."
    if [ "$OPT_NOVOICE" = 1 ]; then say "Voice is off (--no-voice): no ElevenLabs calls."
    else [ -n "${ELEVENLABS_API_KEY:-}" ] || say "WARN: ELEVENLABS_API_KEY is not set; voices fall back to silence."; fi
  else
    export LLM_MODE=mock SOLANA_MODE=mock
  fi
  export PORT="$SERVER_PORT"

  say "Stopping any previous demo..."
  do_stop quiet

  S_MODE="$mode"
  [ "$LLM_MODE" = "$mode" ] || S_MODE="$mode (LLM_MODE=$LLM_MODE, SOLANA_MODE=$SOLANA_MODE)"
  S_SERVER_PORT="$SERVER_PORT" S_WEB_PORT="$WEB_PORT" S_LAN="$OPT_LAN"
  S_PROMPT="${OPT_PROMPT:-$DEFAULT_PROMPT}" S_NATIONS="${OPT_NATIONS:-6}" S_WORLD="" S_REPLAY=""
  save_state

  [ -x "$ROOT/node_modules/.bin/tsx" ] && [ -x "$ROOT/node_modules/.bin/vite" ] || die "dependencies are missing: run npm install first"
  build_web

  say "Starting the server on :$SERVER_PORT ($LLM_MODE, Solana $SOLANA_MODE)..."
  (cd "$ROOT/server" && exec setsid "$ROOT/node_modules/.bin/tsx" src/index.ts) >"$DEMO_DIR/server.log" 2>&1 </dev/null &
  printf '%s\n' "$!" >"$DEMO_DIR/server.pid"

  local host_args=()
  [ "$OPT_LAN" = 1 ] && host_args=(--host 0.0.0.0)
  say "Starting the web on :$WEB_PORT..."
  (cd "$ROOT/web" && exec setsid "$ROOT/node_modules/.bin/vite" preview --port "$WEB_PORT" --strictPort "${host_args[@]}") >"$DEMO_DIR/web.log" 2>&1 </dev/null &
  printf '%s\n' "$!" >"$DEMO_DIR/web.pid"

  wait_for "server" 40 "$DEMO_DIR/server.log" health_ok
  wait_for "web" 20 "$DEMO_DIR/web.log" web_ok
  say "Server and web are up."

  if [ "$OPT_NOWORLD" = 1 ]; then
    say "No world yet: the app opens on its Create screen."
  else
    make_world
  fi
  [ "$OPT_OPEN" = 1 ] && open_browser "http://localhost:$WEB_PORT/"
  summary
}

do_reset() {
  parse_opts "$@"
  load_state
  resolve_ports
  [ "$OPT_NOWORLD" = 1 ] && die "reset makes a world; for an empty Create screen start again with --no-world"
  [ -n "$S_MODE" ] || die "no demo is running (start one with npm run demo, or npm run demo:mock for a rehearsal)"
  health_ok || die "the demo server on :$SERVER_PORT does not answer (see .demo/server.log); restart with npm run demo"
  [ -n "$OPT_PROMPT" ] && S_PROMPT="$OPT_PROMPT"
  [ -n "$OPT_NATIONS" ] && S_NATIONS="$OPT_NATIONS"
  [ -n "$S_PROMPT" ] || S_PROMPT="$DEFAULT_PROMPT"
  [ -n "$S_NATIONS" ] || S_NATIONS=6
  make_world
  # The open tab switches to the new world by itself: the server sends its snapshot on the socket
  # and the app swaps worlds without a reload (web/src/state/world.ts, App.tsx).
  say "The open browser tab switches to the new world by itself (no reload needed)."
  summary
}

# The preflight checks (scripts/preflight.mjs) with the keys loaded as the live demo loads them.
# --mock checks a mock rehearsal (LLM_MODE and SOLANA_MODE mock); other arguments go to the script.
do_check() {
  local args=() mock=0 json=0 a
  for a in "$@"; do
    case "$a" in
      --mock) mock=1 ;;
      --no-voice) OPT_NOVOICE=1 ;;
      --json) json=1; args+=("$a") ;;
      *) args+=("$a") ;;
    esac
  done
  local caller_llm="${LLM_MODE:-}" caller_sol="${SOLANA_MODE:-}"
  load_state
  resolve_ports
  export DEMO_SERVER_PORT="$SERVER_PORT" DEMO_WEB_PORT="$WEB_PORT"
  if [ "$mock" = 1 ]; then
    export LLM_MODE=mock SOLANA_MODE=mock
  else
    load_keys
    export LLM_MODE="${caller_llm:-live}" SOLANA_MODE="${caller_sol:-devnet}"
  fi
  local script="${PREFLIGHT_SCRIPT:-$ROOT/scripts/preflight.mjs}"
  if [ ! -f "$script" ]; then
    if [ "$json" = 1 ]; then
      printf '%s\n' '{"id":"preflight","label":"Preflight script","status":"fail","detail":"scripts/preflight.mjs is not in this checkout yet"}' '{"done":true,"ok":false}'
      exit 1
    fi
    die "scripts/preflight.mjs is not in this checkout yet"
  fi
  exec node "$script" "${args[@]}"
}

do_status() {
  load_state
  resolve_ports
  local spid wpid health world
  spid="$(pid_of server)"; wpid="$(pid_of web)"
  if alive "$spid" && alive "$wpid" && health_ok; then
    health="$(curl -fsS --max-time 2 "http://localhost:$SERVER_PORT/api/health")"
    world="$(printf '%s' "$health" | sed -n 's/.*"world":"\([^"]*\)".*/\1/p')"
    say "RUNNING"
    say "  mode:   ${S_MODE:-unknown}"
    say "  url:    http://localhost:$WEB_PORT/"
    say "  world:  ${world:-none}${S_REPLAY:+ (replay $S_REPLAY)}"
    say "  pids:   server $spid, web $wpid"
  elif alive "$spid" || alive "$wpid"; then
    say "PARTLY RUNNING: server pid ${spid:-none} ($(alive "$spid" && echo up || echo down)), web pid ${wpid:-none} ($(alive "$wpid" && echo up || echo down))"
    say "  run npm run demo:stop, then start again"
  else
    say "NOT RUNNING"
  fi
}

cmd="${1:-}"
[ $# -gt 0 ] && shift
case "$cmd" in
  live|mock) do_start "$cmd" "$@" ;;
  reset)     do_reset "$@" ;;
  check)     do_check "$@" ;;
  status)    do_status ;;
  stop)      load_state; resolve_ports; do_stop ;;
  help|-h|--help)
    sed -n '2,/^set -uo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//' ;;
  *)
    say "Usage: scripts/demo.sh live|mock|reset|check|status|stop|help [options]"
    say "  npm run demo           open the desktop app (settings, checks, start)"
    say "  npm run demo:terminal  start live from the terminal: real Gemini, ElevenLabs and Solana devnet"
    say "  npm run demo:check   run the preflight checks"
    say "  npm run demo:mock    start a mock rehearsal (no API calls)"
    say "  npm run demo:reset   a fresh prepared world between judges (-- --replay demo-1 for instant)"
    say "  npm run demo:status  is it running, which world"
    say "  npm run demo:stop    stop everything"
    exit 1 ;;
esac
