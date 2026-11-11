#!/usr/bin/env bash
# Copy the most recent chrome-devtools screenshot to a path (macOS, Linux, WSL, Git Bash).
#   bash .claude/skills/durhack-browser/scripts/save-shot.sh <dest-file-or-dir>
# take_screenshot (no filePath) shows the image inline, and Claude Code also writes it to
# ~/.claude/projects/<project>/<session>/tool-results/mcp-chrome-devtools-blob-*.{png,jpg}.
# A screenshot too big to show inline goes to the OS temp dir instead
# (chrome-devtools-mcp-*/screenshot.png; on WSL that is Windows temp). This picks the newest.
# If dest is a file, its extension follows the real format ("wiki" from a JPEG becomes wiki.jpg).
set -euo pipefail
dest="${1:?usage: save-shot.sh <dest-file-or-dir>}"

candidates() {
  find "$HOME/.claude/projects" -path '*tool-results*' -name 'mcp-chrome-devtools-blob-*' -mmin -30 2>/dev/null || true
  for t in "${TMPDIR:-/tmp}" /tmp /mnt/c/Users/*/AppData/Local/Temp "${LOCALAPPDATA:-/nonexistent}/Temp"; do
    [ -d "$t" ] && find "$t" -maxdepth 2 -path '*chrome-devtools-mcp-*' -name 'screenshot.*' -mmin -30 2>/dev/null || true
  done
}
src="$(candidates | while read -r f; do [ -f "$f" ] || continue
  m="$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f")"; echo "$m $f"; done | sort -rn | head -1 | cut -d' ' -f2-)"
[ -n "$src" ] || { echo "no chrome-devtools screenshot from the last 30 min found" >&2; exit 1; }

ext="${src##*.}"
if [ -d "$dest" ] || [[ "$dest" == */ ]]; then
  mkdir -p "$dest"; out="${dest%/}/$(basename "$src")"
else
  mkdir -p "$(dirname "$dest")"; out="${dest%.*}.$ext"
fi
cp "$src" "$out"
echo "$out"
