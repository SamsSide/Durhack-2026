#!/usr/bin/env bash
# Prints who this laptop is in the team: login, lane, owner or not, and the current branch.
. "$(dirname "$0")/lib.sh"
need_gh

LOGIN="$(me)"
echo "login:  $LOGIN"
if [ ! -f "$TEAM" ] || [ "$(lane_count)" = "0" ]; then
  echo "team:   NOT SET UP — run the durhack-init skill"
  exit 0
fi
LANE="$(lane_of "$LOGIN")"
if [ -z "$LANE" ]; then
  echo "lane:   none — this login is not in team.json (run durhack-init, join mode)"
else
  NAME="$(lanes_tsv | awk -F'\t' -v l="$LANE" '$1==l{print $3}')"
  echo "lane:   $LANE ($NAME)"
fi
if is_owner; then echo "role:   OWNER (decides plan, contracts, stack; merges needs-owner PRs)"
else echo "role:   teammate (big changes go to the owner as needs-owner issues)"; fi
echo "repo:   $(repo)"
echo "branch: $(git branch --show-current 2>/dev/null || echo '?')"
HOOKS="$(git config core.hooksPath || true)"
[ "$HOOKS" = "scripts/hooks" ] && echo "hooks:  installed" || echo "hooks:  NOT installed — run scripts/durhack/install-hooks.sh"
