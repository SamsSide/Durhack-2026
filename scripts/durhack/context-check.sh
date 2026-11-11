#!/usr/bin/env bash
# Claude Code hook (UserPromptSubmit and PostToolUse): warns the session when its context is big.
# Reads the hook JSON on stdin, finds the transcript, takes the latest assistant message's token
# usage (input + cache read + cache creation = the context size), and when it is over the limit
# tells Claude to warn the user and offer the durhack-handoff skill.
#
#   DURHACK_CONTEXT_WARN   tokens before the first warning (default 650000)
#   DURHACK_CONTEXT_STEP   warn again every this many more tokens (default 50000)
#
# Never fails the session: any problem → silent exit 0.
WARN="${DURHACK_CONTEXT_WARN:-650000}"
STEP="${DURHACK_CONTEXT_STEP:-50000}"
PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || exit 0
export DURHACK_HOOK_INPUT="$(cat)"

"$PY" - "$WARN" "$STEP" <<'PY' 2>/dev/null || exit 0
import json, os, sys, tempfile
warn, step = int(sys.argv[1]), int(sys.argv[2])
try:
    hook = json.loads(os.environ.get("DURHACK_HOOK_INPUT") or "{}")
except Exception:
    sys.exit(0)
path = hook.get("transcript_path") or ""
event = hook.get("hook_event_name") or ""
sid = hook.get("session_id") or "unknown"
if not path or not os.path.exists(path):
    sys.exit(0)

# Read the tail of the transcript only (it can be large).
size = os.path.getsize(path)
with open(path, "rb") as f:
    f.seek(max(0, size - 2_000_000))
    lines = f.read().decode("utf-8", "replace").splitlines()

tokens = None
for line in reversed(lines):
    try:
        d = json.loads(line)
    except Exception:
        continue
    if d.get("isSidechain"):
        continue  # subagent messages don't count against this session
    msg = d.get("message") if isinstance(d.get("message"), dict) else None
    u = (msg or {}).get("usage") or d.get("usage")
    if isinstance(u, dict) and "input_tokens" in u:
        tokens = (u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0)
                  + u.get("cache_creation_input_tokens", 0))
        break
if tokens is None or tokens < warn:
    sys.exit(0)

# Warn once per STEP band so it doesn't repeat on every tool call.
band = (tokens - warn) // step
state = os.path.join(tempfile.gettempdir(), f"durhack-context-{sid}")
try:
    last = int(open(state).read().strip())
except Exception:
    last = -1
if band <= last and event != "UserPromptSubmit":
    sys.exit(0)
try:
    open(state, "w").write(str(band))
except Exception:
    pass

k = tokens // 1000
text = (f"DURHACK CONTEXT WARNING: this session is at about {k}k tokens of context "
        f"(warning threshold {warn // 1000}k). Long contexts make mistakes and hallucinations "
        "more likely. Tell the user in one line, and at the next safe point (after the current "
        "task or batch is committed) ask them (clickable) whether to run the durhack-handoff "
        "skill now: it writes and commits a handoff document and gives them the command to "
        "start a fresh session from it. Recommended: hand off now.")
if event == "PostToolUse":
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": text}}))
else:
    print(text)
PY
exit 0
