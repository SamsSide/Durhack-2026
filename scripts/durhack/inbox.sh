#!/usr/bin/env bash
# The DurHack inbox: what other lanes' agents (and the owner) have sent you through GitHub.
#
#   inbox.sh --list            everything open that concerns you (no state change)
#   inbox.sh --once            print NEW events since last check, then exit
#   inbox.sh --until-event [SECS]
#                              loop until at least one new event, print them, exit 0.
#                              The normal way to watch: run it as a background shell command
#                              (Bash run_in_background); it has no time limit. Handle the
#                              event, then start it again.
#   inbox.sh --watch [SECS]    loop forever, one stdout line per new event (for the Monitor
#                              tool, which expires after 30 minutes)
#
# The two long-running modes never stop on an error: each poll runs in its own child process,
# and a failed poll (no network, a gh hiccup, a rate limit) is skipped and tried again.
#
# Events (one line each, prefixed so they're easy to spot):
#   DURHACK [new] issue assigned to you (agent-request / needs-owner / human-test)
#   DURHACK [blocking] same, labelled blocking
#   DURHACK [reply] a new comment by someone else on an issue/PR you opened or are assigned to
#   DURHACK [closed] an issue you opened was closed (usually: answered)
#   DURHACK [owner-review] (owner only) a PR waiting for owner review (label needs-owner)
#   DURHACK [pr] a PR of yours was merged or closed
#
# State lives in .claude/durhack-inbox/<id>/ (git-ignored). Set DURHACK_INBOX_ID to give a second
# session on the same laptop its own state. Poll interval default 30s (about 1,000 GitHub calls
# an hour, well inside the 5,000 an hour limit).

case "${1:-}" in
  --watch|--until-event)
    secs="${2:-30}"
    case "$secs" in ''|*[!0-9]*) secs=30 ;; esac
    [ "$secs" -lt 15 ] && secs=15
    trap 'exit 0' TERM INT
    while true; do
      ev="$("$0" --once 2>/dev/null)" || ev=""
      if [ -n "$ev" ]; then
        printf '%s\n' "$ev"
        [ "$1" = "--until-event" ] && exit 0
      fi
      sleep "$secs" || true
    done ;;
esac

. "$(dirname "$0")/lib.sh"
need_gh

MODE="${1:---once}"
R="$(repo)"; ME="$(me)"; OWNER_LOGIN="$(owner)"
STATE="$ROOT/.claude/durhack-inbox/${DURHACK_INBOX_ID:-default}"
mkdir -p "$STATE"
touch "$STATE/seen-issues" "$STATE/seen-closed" "$STATE/seen-prs" "$STATE/seen-merged"

now_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
seen()    { grep -qxF "$2" "$STATE/$1" 2>/dev/null; }
mark()    { echo "$2" >> "$STATE/$1"; }

prime() {
  # First run ever: don't replay history. Closed issues and finished PRs count as seen;
  # open issues assigned to you are still reported (you need to act on them).
  if [ ! -f "$STATE/since" ]; then
    gh issue list -R "$R" --author "$ME" --state closed --limit 200 --json number --jq '.[].number' \
      >> "$STATE/seen-closed" 2>/dev/null || true
    gh pr list -R "$R" --author "$ME" --state merged --limit 200 --json number --jq '.[].number' \
      >> "$STATE/seen-merged" 2>/dev/null || true
    gh pr list -R "$R" --author "$ME" --state closed --limit 200 --json number --jq '.[].number' \
      >> "$STATE/seen-merged" 2>/dev/null || true
    now_utc > "$STATE/since"
  fi
}

check() {
  local out="" t0 since mine
  t0="$(now_utc)"; since="$(cat "$STATE/since")"

  # 1. New issues assigned to me.
  while IFS=$'\t' read -r n title author labels url; do
    [ -z "${n:-}" ] && continue
    seen seen-issues "$n" && continue
    mark seen-issues "$n"
    local icon="[new]"; case ",$labels," in *",blocking,"*) icon="[blocking]";; esac
    out+="DURHACK $icon #$n [$labels] from $author: $title — $url"$'\n'
  done < <(gh issue list -R "$R" --assignee "$ME" --state open --limit 100 \
            --json number,title,author,labels,url \
            --jq '.[] | [.number, .title, .author.login, ([.labels[].name]|join(",")), .url] | @tsv' 2>/dev/null || true)

  # Issue/PR numbers that concern me: assigned to me, opened by me.
  mine="$( { gh issue list -R "$R" --assignee "$ME" --state all --limit 200 --json number --jq '.[].number'
             gh issue list -R "$R" --author "$ME" --state all --limit 200 --json number --jq '.[].number'
             gh pr list -R "$R" --author "$ME" --state all --limit 100 --json number --jq '.[].number'
           } 2>/dev/null | sort -u || true)"

  # 2. New comments by others on those.
  if [ -n "$mine" ]; then
    while IFS=$'\t' read -r n who body url; do
      [ -z "${n:-}" ] && continue
      [ "$(echo "$who" | tr A-Z a-z)" = "$(echo "$ME" | tr A-Z a-z)" ] && continue
      grep -qxF "$n" <<<"$mine" || continue
      out+="DURHACK [reply] #$n $who: $body — $url"$'\n'
    done < <(gh api "repos/$R/issues/comments?since=$since&per_page=100" \
              --jq '.[] | [(.issue_url|split("/")|last), .user.login, (.body|gsub("[\r\n]+";" ")|.[0:160]), .html_url] | @tsv' 2>/dev/null || true)
  fi

  # 3. My issues that got closed.
  while IFS=$'\t' read -r n title url; do
    [ -z "${n:-}" ] && continue
    seen seen-closed "$n" && continue
    mark seen-closed "$n"
    out+="DURHACK [closed] #$n closed: $title — $url"$'\n'
  done < <(gh issue list -R "$R" --author "$ME" --state closed --limit 50 \
            --json number,title,url --jq '.[] | [.number, .title, .url] | @tsv' 2>/dev/null || true)

  # 4. Owner: PRs waiting for owner review.
  if [ "$(echo "$ME" | tr A-Z a-z)" = "$(echo "$OWNER_LOGIN" | tr A-Z a-z)" ]; then
    while IFS=$'\t' read -r n title author url; do
      [ -z "${n:-}" ] && continue
      seen seen-prs "$n" && continue
      mark seen-prs "$n"
      out+="DURHACK [owner-review] PR #$n needs owner review, by $author: $title — $url"$'\n'
    done < <(gh pr list -R "$R" --label needs-owner --state open --limit 50 \
              --json number,title,author,url --jq '.[] | [.number, .title, .author.login, .url] | @tsv' 2>/dev/null || true)
  fi

  # 5. My PRs merged or closed.
  while IFS=$'\t' read -r n state title url; do
    [ -z "${n:-}" ] && continue
    seen seen-merged "$n" && continue
    mark seen-merged "$n"
    out+="DURHACK [pr] PR #$n $state: $title — $url"$'\n'
  done < <(gh pr list -R "$R" --author "$ME" --state all --limit 30 \
            --json number,state,title,url --jq '.[] | select(.state!="OPEN") | [.number, .state, .title, .url] | @tsv' 2>/dev/null || true)

  echo "$t0" > "$STATE/since"
  printf '%s' "$out"
}

list_all() {
  echo "== Assigned to $ME (open) =="
  gh issue list -R "$R" --assignee "$ME" --state open --limit 100 \
    --json number,title,author,labels --jq '.[] | "#\(.number) [\([.labels[].name]|join(","))] from \(.author.login): \(.title)"'
  echo "== Opened by $ME (open, waiting on others) =="
  gh issue list -R "$R" --author "$ME" --state open --limit 100 \
    --json number,title,assignees,labels --jq '.[] | "#\(.number) [\([.labels[].name]|join(","))] → \([.assignees[].login]|join(",")): \(.title)"'
  echo "== Your open PRs =="
  gh pr list -R "$R" --author "$ME" --state open --json number,title,mergeable,labels \
    --jq '.[] | "PR #\(.number) [\(.mergeable)] [\([.labels[].name]|join(","))]: \(.title)"'
  if [ "$(echo "$ME" | tr A-Z a-z)" = "$(echo "$OWNER_LOGIN" | tr A-Z a-z)" ]; then
    echo "== PRs needing owner review =="
    gh pr list -R "$R" --label needs-owner --state open --json number,title,author \
      --jq '.[] | "PR #\(.number) by \(.author.login): \(.title)"'
  fi
  echo "== Human tests open =="
  gh issue list -R "$R" --label human-test --state open --limit 50 \
    --json number,title,assignees --jq '.[] | "#\(.number) → \([.assignees[].login]|join(",")): \(.title)"'
}

case "$MODE" in
  --list)  list_all ;;
  --once)  prime; check ;;
  *) die "usage: inbox.sh --list | --once | --watch [secs] | --until-event [secs]" ;;
esac
