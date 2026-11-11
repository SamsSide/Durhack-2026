#!/usr/bin/env bash
# PR helper. Every change reaches main through here; nothing is pushed to main.
#
#   pr.sh sync                   fetch and rebase the current branch on origin/main
#                                (exit 3 on conflict: resolve with the durhack-pr skill)
#   pr.sh open --title "..." --body-file FILE [--draft]
#                                sync, ./check.sh, push the branch, open the PR,
#                                label needs-owner if it touches owner paths
#   pr.sh status [N]             mergeable state, checks, labels, owner-path files
#   pr.sh merge N                squash-merge N if allowed (refuses needs-owner unless you are owner)
. "$(dirname "$0")/lib.sh"
need_gh
cd "$ROOT"

CMD="${1:-}"; shift || true
R="$(repo)"

branch_guard() {
  local b; b="$(git branch --show-current)"
  [ -n "$b" ] || die "detached HEAD — check out a <lane>/<topic> branch first"
  case "$b" in main|master) die "you are on $b. Never commit or push main: git switch -c <lane>/<topic>";; esac
  echo "$b"
}

owner_files() {  # files on this branch (vs origin/main) that only the owner may change
  git diff --name-only "origin/main...HEAD" 2>/dev/null | grep -E "$OWNER_PATHS_RE" || true
}

sync() {
  branch_guard >/dev/null
  git fetch -q origin
  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "uncommitted changes — commit them on your branch first"
  fi
  if git rebase origin/main >/dev/null 2>&1; then
    echo "rebased on origin/main ($(git rev-parse --short origin/main))"
  else
    echo "CONFLICT while rebasing on origin/main. Conflicted files:"
    git diff --name-only --diff-filter=U | sed 's/^/  /'
    echo "Resolve with the durhack-pr skill (then: git add <files>; git rebase --continue)."
    exit 3
  fi
}

case "$CMD" in
  sync) sync ;;

  open)
    TITLE=""; BODY=""; DRAFT=()
    while [ $# -gt 0 ]; do
      case "$1" in
        --title) TITLE="$2"; shift 2 ;;
        --body-file) BODY="$2"; shift 2 ;;
        --draft) DRAFT=(--draft); shift ;;
        *) die "unknown argument: $1" ;;
      esac
    done
    [ -n "$TITLE" ] || die "--title is required"
    [ -n "$BODY" ] && [ -f "$BODY" ] || die "--body-file FILE is required (fill in .github/pull_request_template.md)"
    if grep -qiE 'co-authored-by:.*(claude|anthropic|copilot|gpt|openai)|claude-session|generated with \[?claude' "$BODY"; then
      die "PR body contains AI attribution — remove it (repo rule)"
    fi
    B="$(branch_guard)"
    sync
    echo "running ./check.sh ..."
    LOG="$(mktemp)"
    if ! ./check.sh > "$LOG" 2>&1; then
      tail -30 "$LOG"; rm -f "$LOG"
      [ ${#DRAFT[@]} -gt 0 ] || die "./check.sh is red — fix it (one round) or open with --draft and say why"
      echo "check.sh red — opening as draft"
    else
      tail -5 "$LOG"; rm -f "$LOG"
    fi
    git push -u origin "$B" --force-with-lease >/dev/null 2>&1 || git push -u origin "$B"
    OF="$(owner_files)"
    LABELS=()
    ME="$(me)"; LANE="$(lane_of "$ME")"
    [ -n "$LANE" ] && LABELS+=(--label "lane:$LANE")
    if [ -n "$OF" ] && ! is_owner; then LABELS+=(--label needs-owner --reviewer "$(owner)"); fi
    URL="$(gh pr create -R "$R" --base main --head "$B" --title "$TITLE" --body-file "$BODY" "${DRAFT[@]}" "${LABELS[@]}")"
    echo "$URL"
    if [ -n "$OF" ] && ! is_owner; then
      echo "needs-owner: this PR changes owner paths, only $(owner) can merge it:"
      echo "$OF" | sed 's/^/  /'
    fi ;;

  status)
    N="${1:-}"
    if [ -z "$N" ]; then N="$(gh pr view -R "$R" --json number --jq .number 2>/dev/null || true)"; fi
    [ -n "$N" ] || die "no PR for this branch; give a number"
    gh pr view "$N" -R "$R" --json number,title,state,mergeable,mergeStateStatus,labels,author,headRefName \
      --jq '"PR #\(.number) \(.state) by \(.author.login) [\(.headRefName)]\n  \(.title)\n  mergeable: \(.mergeable) (\(.mergeStateStatus))\n  labels: \([.labels[].name]|join(", "))"'
    echo "  owner-path files:"
    gh pr diff "$N" -R "$R" --name-only | grep -E "$OWNER_PATHS_RE" | sed 's/^/    /' || echo "    none" ;;

  merge)
    N="${1:-}"; [[ "$N" =~ ^[0-9]+$ ]] || die "usage: pr.sh merge <number>"
    LABELS="$(gh pr view "$N" -R "$R" --json labels --jq '[.labels[].name]|join(",")')"
    OF="$(gh pr diff "$N" -R "$R" --name-only | grep -E "$OWNER_PATHS_RE" || true)"
    if { [[ ",$LABELS," == *",needs-owner,"* ]] || [ -n "$OF" ]; } && ! is_owner; then
      die "PR #$N touches owner paths / is needs-owner — only $(owner) merges it"
    fi
    M="$(gh pr view "$N" -R "$R" --json mergeable --jq .mergeable)"
    [ "$M" = "CONFLICTING" ] && die "PR #$N conflicts with main — check out its branch, pr.sh sync, resolve (durhack-pr)"
    gh pr merge "$N" -R "$R" --squash --delete-branch
    echo "merged PR #$N" ;;

  *) die "usage: pr.sh sync | open --title T --body-file F [--draft] | status [N] | merge N" ;;
esac
