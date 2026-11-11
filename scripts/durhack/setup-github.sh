#!/usr/bin/env bash
# One-time GitHub setup for the DurHack repo. Run by the durhack-init skill (owner only).
#
#   setup-github.sh labels            create/refresh every DurHack label (idempotent)
#   setup-github.sh repo-settings     squash merge on, delete branch on merge, auto-merge on
#   setup-github.sh protect-main      try a ruleset: no direct push / force push / deletion of main,
#                                     PR required. Free private repos may refuse (needs Pro): then
#                                     the pre-push hook + CLAUDE.md rule are the guard.
#   setup-github.sh board             create the "DurHack tests" project board, link it, save its
#                                     number in team.json (needs: gh auth refresh -s project)
#   setup-github.sh invite <login>    add a collaborator with write access (sends them an invite)
#   setup-github.sh all               labels + repo-settings + protect-main
. "$(dirname "$0")/lib.sh"
need_gh
R="$(repo)"

label() { gh label create "$1" -R "$R" --color "$2" --description "$3" --force >/dev/null && echo "  label $1"; }

labels() {
  echo "labels:"
  label agent-request 1D76DB "One lane's agent needs something from another lane"
  label needs-owner   8250DF "Needs a decision or review from the owner (SamsSide)"
  label human-test    FBCA04 "A person should test this by hand"
  label blocking      B60205 "The asker is blocked until this is answered"
  label answered      0E8A16 "An answer has been posted"
  label declined      6A737D "Answered: no / not now"
  label test-passed   0E8A16 "Human test passed"
  label test-failed   D93F0B "Human test failed: see the comment"
  for l in a b c d; do
    label "lane:$l" C5DEF5 "PR from lane $l"
    label "from:$l" EDEDED "Opened by lane $l"
    label "to:$l"   BFDADC "For lane $l"
  done
}

repo_settings() {
  gh repo edit "$R" --enable-squash-merge --delete-branch-on-merge --enable-auto-merge >/dev/null \
    && echo "repo settings: squash merge, delete branch on merge, auto-merge" \
    || echo "repo settings: could not change (are you an admin?)"
}

protect_main() {
  local body; body="$(cat <<'JSON'
{
  "name": "main is PR-only",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } }
  ]
}
JSON
)"
  if gh api "repos/$R/rulesets" --jq '.[].name' 2>/dev/null | grep -qx "main is PR-only"; then
    echo "protect-main: ruleset already exists"; return
  fi
  if out="$(gh api -X POST "repos/$R/rulesets" --input - <<<"$body" 2>&1)"; then
    echo "protect-main: ruleset active — GitHub itself now refuses direct pushes to main"
  else
    echo "protect-main: GitHub refused the ruleset ($(echo "$out" | grep -o '"message":"[^"]*"' | head -1))."
    echo "  Private repos on a free plan can't enforce rulesets. The guard is the pre-push hook"
    echo "  (scripts/durhack/install-hooks.sh on every laptop) plus the CLAUDE.md rule."
  fi
}

board() {
  local own num url
  own="$(owner)"
  if ! out="$(gh project create --owner "$own" --title "DurHack tests" --format json 2>&1)"; then
    echo "board: couldn't create ($out)"; echo "  run: gh auth refresh -s project   then try again"; return 1
  fi
  num="$(echo "$out" | sed -n 's/.*"number":\([0-9]*\).*/\1/p')"
  url="$(echo "$out" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')"
  gh project link "$num" --owner "$own" --repo "$R" >/dev/null 2>&1 || true
  if command -v jq >/dev/null; then
    tmp="$(mktemp)"; jq --argjson n "$num" --arg o "$own" --arg u "$url" '.board={number:$n,owner:$o,url:$u}' "$TEAM" > "$tmp" && mv "$tmp" "$TEAM"
  else
    "$(_py)" - "$TEAM" "$num" "$own" "$url" <<'PY'
import json, sys
p, n, o, u = sys.argv[1:]
d = json.load(open(p)); d["board"] = {"number": int(n), "owner": o, "url": u}
json.dump(d, open(p, "w"), indent=2); open(p, "a").write("\n")
PY
  fi
  echo "board: #$num $url (saved in team.json)"
  # Existing human-test issues join the board.
  gh issue list -R "$R" --label human-test --state open --json url --jq '.[].url' 2>/dev/null \
    | while read -r u; do gh project item-add "$num" --owner "$own" --url "$u" >/dev/null 2>&1 || true; done
}

invite() {
  local who="${1:?usage: setup-github.sh invite <github-login>}"
  gh api -X PUT "repos/$R/collaborators/$who" -f permission=push >/dev/null \
    && echo "invited $who (write access) — they must accept the email/GitHub invite" \
    || echo "could not invite $who"
}

case "${1:-}" in
  labels) labels ;;
  repo-settings) repo_settings ;;
  protect-main) protect_main ;;
  board) board ;;
  invite) shift; invite "$@" ;;
  all) labels; repo_settings; protect_main ;;
  *) die "usage: setup-github.sh labels|repo-settings|protect-main|board|invite <login>|all" ;;
esac
