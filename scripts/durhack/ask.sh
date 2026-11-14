#!/usr/bin/env bash
# Open a DurHack issue for another lane, the owner, or the human testers.
#
#   ask.sh request --to <lane|login> --title "..." --body-file FILE [--blocking]
#   ask.sh owner   --title "..." --body-file FILE [--blocking]
#   ask.sh test    --title "..." --body-file FILE [--to <lane|login>] [--pr N]
#   ask.sh ready   --to <lane|login> --title "..." --body-file FILE [--pr N]
#                  (tell a lane that something it needs has landed on main; one per lane)
#
# The body file follows the matching template in .github/ISSUE_TEMPLATE/ (the durhack-inbox
# skill has the exact sections). Prints the new issue's URL.
. "$(dirname "$0")/lib.sh"
need_gh

KIND="${1:-}"; shift || true
TO=""; TITLE=""; BODY=""; BLOCKING=0; PR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --to) TO="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --body-file) BODY="$2"; shift 2 ;;
    --blocking) BLOCKING=1; shift ;;
    --pr) PR="$2"; shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$TITLE" ] || die "--title is required"
[ -n "$BODY" ] && [ -f "$BODY" ] || die "--body-file FILE is required"

R="$(repo)"; ME="$(me)"; MYLANE="$(lane_of "$ME")"; MYLANE="${MYLANE:-?}"
LABELS=(); ASSIGNEE=""

case "$KIND" in
  request)
    [ -n "$TO" ] || die "request needs --to <lane|login>"
    ASSIGNEE="$(login_of "$TO")"; TOLANE="$(lane_of "$ASSIGNEE")"; TOLANE="${TOLANE:-?}"
    LABELS+=(agent-request); [ "$TOLANE" != "?" ] && LABELS+=("to:$TOLANE")
    TITLE="[$MYLANE→$TOLANE] $TITLE" ;;
  owner)
    ASSIGNEE="$(owner)"
    LABELS+=(needs-owner)
    TITLE="[$MYLANE→owner] $TITLE" ;;
  test)
    ASSIGNEE="$(login_of "${TO:-$ME}")"
    LABELS+=(human-test)
    TITLE="[test] $TITLE" ;;
  ready)
    [ -n "$TO" ] || die "ready needs --to <lane|login>"
    ASSIGNEE="$(login_of "$TO")"; TOLANE="$(lane_of "$ASSIGNEE")"; TOLANE="${TOLANE:-?}"
    LABELS+=(ready); [ "$TOLANE" != "?" ] && LABELS+=("to:$TOLANE")
    TITLE="[$MYLANE→$TOLANE] Ready: $TITLE" ;;
  *) die "usage: ask.sh request|owner|test|ready ..." ;;
esac
[ "$MYLANE" != "?" ] && LABELS+=("from:$MYLANE")
[ "$BLOCKING" = 1 ] && LABELS+=(blocking)

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
cat "$BODY" > "$TMP"
{
  echo
  echo "---"
  echo "<!-- durhack: kind=$KIND from=$ME lane=$MYLANE branch=$(git branch --show-current 2>/dev/null) commit=$(git rev-parse --short HEAD 2>/dev/null) -->"
  [ -n "$PR" ] && echo "Related PR: #$PR"
  echo "_Opened by lane $MYLANE's agent. Reply with \`scripts/durhack/reply.sh\` (durhack-inbox skill)._"
} >> "$TMP"

ARGS=(-R "$R" --title "$TITLE" --body-file "$TMP" --assignee "$ASSIGNEE")
for l in "${LABELS[@]}"; do ARGS+=(--label "$l"); done
URL="$(gh issue create "${ARGS[@]}")"
echo "$URL"

# Human tests also go on the project board, if durhack-init made one.
if [ "$KIND" = test ]; then
  BOARD="$(team_field board number 2>/dev/null || true)"
  BOWNER="$(team_field board owner 2>/dev/null || true)"
  if [ -n "$BOARD" ] && [ -n "$BOWNER" ]; then
    gh project item-add "$BOARD" --owner "$BOWNER" --url "$URL" >/dev/null 2>&1 \
      && echo "added to the DurHack tests board" \
      || echo "note: couldn't add to board (needs: gh auth refresh -s project)" >&2
  fi
fi
