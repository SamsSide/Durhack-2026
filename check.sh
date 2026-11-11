#!/usr/bin/env bash
# DurHack smoke gate. Must stay FAST (under a minute). One gate for everything.
# When the stack is chosen, add its smoke steps in the STACK section (lint, build, "it starts").
set -uo pipefail
cd "$(dirname "$0")"
fail=0
step() { printf '%-34s' "$1"; shift; if out="$("$@" 2>&1)"; then echo "ok"; else echo "FAIL"; echo "$out" | tail -15; fail=1; fi; }

# --- repo tooling (always) ---------------------------------------------------
step "scripts parse (bash -n)" bash -c 'for f in scripts/durhack/*.sh scripts/hooks/* check.sh; do bash -n "$f" || exit 1; done'
if command -v shellcheck >/dev/null; then
  step "shellcheck (errors only)" shellcheck -S error scripts/durhack/*.sh scripts/hooks/*
fi
step "JSON files are valid" bash -c 'for f in .github/durhack/team.json .claude/settings.json scripts/durhack/claude-settings.json; do [ -f "$f" ] || continue; if command -v jq >/dev/null; then jq empty "$f" || exit 1; else python3 -m json.tool "$f" >/dev/null || exit 1; fi; done'
step "no API keys in tracked files" bash -c '! git grep -nIE "(sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{35})" -- . ":!check.sh" ":!scripts/hooks/*"'
step "no conflict markers" bash -c '! git grep -nE "^(<<<<<<< |>>>>>>> )" -- . ":!check.sh"'

# --- STACK (fill in at kickoff; keep each step seconds, not minutes) ---------
# Examples — uncomment/adapt the ones for the chosen stack:
# step "python: ruff"            uv run ruff check .
# step "python: imports/starts"  uv run python -c "import app"
# step "node: install"           npm ci --silent
# step "node: lint"              npm run -s lint
# step "node: build"             npm run -s build
# step "server boots"            bash -c 'timeout 20 npm start & sleep 8; curl -fsS localhost:3000/health'

echo
if [ "$fail" = 0 ]; then echo "check.sh: GREEN"; else echo "check.sh: RED"; fi
exit "$fail"
