#!/usr/bin/env bash
# Shared helpers for the DurHack scripts. Source it: . "$(dirname "$0")/lib.sh"
# Needs: git, gh (logged in). Uses jq or python3 to read team.json, whichever exists.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TEAM="$ROOT/.github/durhack/team.json"

die() { echo "durhack: $*" >&2; exit 1; }

need_gh() {
  command -v gh >/dev/null || die "gh (GitHub CLI) is not installed: https://cli.github.com"
  gh auth status >/dev/null 2>&1 || die "gh is not logged in: run  gh auth login"
}

# Reading team.json: jq if present, else python3. Only these three readers are used.
_py() { command -v python3 || command -v python || true; }

# team_field <key> [subkey]  — a top-level (or one-level nested) scalar, e.g. owner, board number
team_field() {
  [ -f "$TEAM" ] || die "no $TEAM — run the durhack-init skill first"
  if command -v jq >/dev/null; then
    if [ $# -eq 2 ]; then jq -r --arg a "$1" --arg b "$2" '.[$a][$b] // empty' "$TEAM"
    else jq -r --arg a "$1" '.[$a] // empty' "$TEAM"; fi
  elif [ -n "$(_py)" ]; then
    "$(_py)" - "$TEAM" "$@" <<'PY'
import json, sys
v = json.load(open(sys.argv[1]))
for k in sys.argv[2:]:
    v = v.get(k) if isinstance(v, dict) else None
print("" if v is None else v)
PY
  else die "need jq or python3 to read team.json"; fi
}

# lanes_tsv — one line per lane: id <TAB> github <TAB> name <TAB> space-separated paths
lanes_tsv() {
  [ -f "$TEAM" ] || die "no $TEAM — run the durhack-init skill first"
  if command -v jq >/dev/null; then
    jq -r '.lanes[]? | [.id, .github, .name, ((.paths // []) | join(" "))] | @tsv' "$TEAM"
  elif [ -n "$(_py)" ]; then
    "$(_py)" - "$TEAM" <<'PY'
import json, sys
for l in json.load(open(sys.argv[1])).get("lanes", []):
    print("\t".join([l.get("id",""), l.get("github",""), l.get("name",""), " ".join(l.get("paths",[]))]))
PY
  else die "need jq or python3 to read team.json"; fi
}

lane_count() { lanes_tsv | grep -c . || true; }

repo()  { team_field repo; }
owner() { team_field owner; }
me()    { gh api user --jq .login; }

# lane_of <login> — prints the lane id for a GitHub login (empty if none)
lane_of() {
  local login="$1"
  lanes_tsv | awk -F'\t' -v u="$login" 'tolower($2)==tolower(u){print $1; exit}'
}

# login_of <lane-id|login> — resolves a lane id ("a") or a login to a login
login_of() {
  local x="$1" hit
  hit="$(lanes_tsv | awk -F'\t' -v x="$x" 'tolower($1)==tolower(x){print $2; exit}')"
  if [ -n "$hit" ]; then echo "$hit"; else echo "$x"; fi
}

is_owner() { [ "$(echo "$(me)" | tr A-Z a-z)" = "$(echo "$(owner)" | tr A-Z a-z)" ]; }

# Paths only the owner may change (PRs touching them get needs-owner).
OWNER_PATHS_RE='^(docs/hackathon-plan\.md|docs/roadmap\.md|docs/contracts\.md|CLAUDE\.md|\.claude/|\.github/|scripts/|check\.sh)'
