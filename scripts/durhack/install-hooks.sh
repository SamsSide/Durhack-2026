#!/usr/bin/env bash
# Point git at the repo's hooks (run once per clone, on every laptop).
#   pre-commit  refuses commits on main
#   commit-msg  refuses AI attribution lines (Co-Authored-By: Claude…, Claude-Session, "Generated with")
#   pre-push    refuses any push to main
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
chmod +x "$ROOT"/scripts/hooks/* "$ROOT"/scripts/durhack/*.sh "$ROOT"/check.sh 2>/dev/null || true
git -C "$ROOT" config core.hooksPath scripts/hooks
git -C "$ROOT" config pull.rebase true
git -C "$ROOT" config rerere.enabled true
echo "hooks installed (core.hooksPath=scripts/hooks); pull.rebase and rerere on"
