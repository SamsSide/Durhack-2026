#!/usr/bin/env bash
# Answer a DurHack issue: post the answer, link the commit/PR that delivers it, label it.
#
#   reply.sh <issue> --body-file FILE [--commit SHA] [--pr N] [--close] [--decline]
#
# --close    the request is fully delivered (or the owner decided): closes the issue
# --decline  the answer is "no / not now" (labels declined, closes)
# Without either, the issue stays open (a partial answer or a question back).
. "$(dirname "$0")/lib.sh"
need_gh

N="${1:-}"; shift || true
[[ "$N" =~ ^[0-9]+$ ]] || die "usage: reply.sh <issue-number> --body-file FILE [...]"
BODY=""; COMMIT=""; PR=""; CLOSE=0; DECLINE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --body-file) BODY="$2"; shift 2 ;;
    --commit) COMMIT="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    --close) CLOSE=1; shift ;;
    --decline) DECLINE=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$BODY" ] && [ -f "$BODY" ] || die "--body-file FILE is required"

R="$(repo)"; ME="$(me)"; MYLANE="$(lane_of "$ME")"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
{
  echo "### Answer from lane ${MYLANE:-?} ($ME)"
  echo
  cat "$BODY"
  if [ -n "$COMMIT" ] || [ -n "$PR" ]; then
    echo
    echo "**Delivered in:**"
    [ -n "$COMMIT" ] && echo "- commit https://github.com/$R/commit/$(git rev-parse "$COMMIT" 2>/dev/null || echo "$COMMIT")"
    [ -n "$PR" ] && echo "- PR #$PR"
  fi
  echo
  echo "<!-- durhack: reply from=$ME lane=${MYLANE:-?} -->"
} > "$TMP"

gh issue comment "$N" -R "$R" --body-file "$TMP" >/dev/null
if [ "$DECLINE" = 1 ]; then
  gh issue edit "$N" -R "$R" --add-label declined >/dev/null
  gh issue close "$N" -R "$R" --reason "not planned" >/dev/null
  echo "#$N answered (declined) and closed"
elif [ "$CLOSE" = 1 ]; then
  gh issue edit "$N" -R "$R" --add-label answered >/dev/null
  gh issue close "$N" -R "$R" >/dev/null
  echo "#$N answered and closed"
else
  gh issue edit "$N" -R "$R" --add-label answered >/dev/null
  echo "#$N answered (left open)"
fi
