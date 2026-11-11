#!/usr/bin/env bash
# Optional SessionStart hook: reminds Claude of the repo rules and shows who/where this session is.
# Must be fast and never fail the session.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
echo "DurHack repo: invoke the durhack-dev skill before any work. Never push to main; every change is a PR. No emojis, no AI attribution."
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  timeout 15 bash scripts/durhack/whoami.sh 2>/dev/null | sed 's/^/  /' || true
  if [ -s .github/durhack/team.json ] && grep -q '"github"' .github/durhack/team.json; then
    n="$(timeout 15 gh issue list --assignee @me --state open --json number --jq 'length' 2>/dev/null || echo '?')"
    echo "  inbox: $n open issue(s) assigned to you (scripts/durhack/inbox.sh --list). Start the watcher: durhack-inbox -> Watching."
  fi
else
  echo "  gh is not logged in: run  gh auth login  (needed for issues and PRs)."
fi
exit 0
