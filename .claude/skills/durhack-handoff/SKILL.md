---
name: durhack-handoff
description: Use in the DurHack repo to keep each orchestrator session's context small — when a DURHACK CONTEXT WARNING arrives (about 650k tokens), when the user says "handoff", "new session", "context is getting big", or before a long break. Writes a handoff document (goal, branch, ledger, done, in flight, open issues and PRs, next steps, rulings, gotchas), commits it, and gives the exact command to start the next session from it. Also resume mode — a new session picking up from a handoff file.
---

# Handing off to a fresh session

Long sessions drift: past ~650k tokens the orchestrator forgets rulings and starts guessing.
Hand off early, not late. The `context-check.sh` hook warns automatically; you can also hand
off any time. Load `durhack-dev` first if it isn't loaded.

## When the warning arrives

Tell the user in one line ("Context is at ~660k; I'll hand off after this batch"). Finish the
step in flight: let running agents return, gate, commit. Then ask (clickable):
**Hand off now** *(Recommended)* · **After the current row** · **Not yet**. Don't start a new
batch or row before handing off.

## Write the handoff

1. **Save the work.** Everything worth keeping is committed on the lane branch (no AI
   attribution). Open or update the PR if the row is shippable (`durhack-pr`); don't merge
   half-done work just to hand off.
2. **Gather facts, don't recall them:**
   ```bash
   scripts/durhack/whoami.sh
   git status -sb; git log --oneline origin/main..HEAD
   scripts/durhack/inbox.sh --list
   ls .claude/ledger/ 2>/dev/null
   ```
3. **Write** `docs/handoffs/<lane>-<YYYY-MM-DD-HHMM>.md`:

   ```markdown
   # Handoff — lane <id>, <date time>

   **Goal of this session:** <one line>
   **Branch:** `<branch>` at `<short sha>` · **PR:** #<n> | none
   **Plan:** `docs/plans/<file>` · **Ledger:** `.claude/ledger/<file>` (local only)

   ## Done
   - <row / task — commit or PR>

   ## In flight
   - <task — state — exactly what's left>

   ## Waiting on
   - #<issue> <what> — from <lane/owner> — what to do when it lands

   ## Next, in order
   1. <the very next action, concrete enough to start without asking>
   2. …

   ## Rulings and decisions (don't re-litigate)
   - <decision> — <why>

   ## Gotchas
   - <things that wasted time, commands that work, mocks still in place>

   ## Watcher
   Restart it: durhack-inbox → Watching.
   ```

   Facts only: commit shas, issue numbers, file paths. No essay, no emojis. If a ledger exists,
   copy its open items and rulings in (the ledger is git-ignored, the handoff isn't).
4. **Commit and push** the handoff on the same branch (`docs: hand off lane <id> session`),
   `git push -u origin <branch>`. It reaches `main` with the branch's PR; that's fine.
5. **Give the user the command**, exactly, in a code block:

   ```
   /clear
   ```
   then paste:
   ```
   Use durhack-handoff to resume from docs/handoffs/<file>.md
   ```
   Or in a new terminal: `claude "Use durhack-handoff to resume from docs/handoffs/<file>.md"`.

   Say: "The handoff is committed; this session can be closed."

## Resume (the new session)

1. Load `durhack-dev`. Read the handoff file only (not the old transcript).
2. `git fetch -q`; check out the handoff's branch; confirm the sha matches or is ahead.
   `git log --oneline` since the handoff to see what changed.
3. Start the inbox watcher; `inbox.sh --list`. Anything answered since the handoff → fold it
   into the next steps.
4. Re-open the ledger if it's on this laptop; otherwise start a new one from the handoff's
   *In flight* and *Next*.
5. Tell the user in 3 lines where things are and start *Next* step 1 without asking (unless it
   needs a decision).
