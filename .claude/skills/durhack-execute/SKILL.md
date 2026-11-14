---
name: durhack-execute
description: Use when building in the DurHack repo — executing a lane plan from docs/plans/, or "just build row B2" — dispatching durhack-builder and durhack-frontend agents in parallel batches, one fast smoke gate (./check.sh) and at most one fix round, turning HUMAN_TEST steps into human-test issues, NEEDS_OTHER_LANE into agent-requests, NEEDS_OWNER into needs-owner issues, then opening and merging the PR. Speed first, no per-task review.
---

# Building DurHack

**Announce:** "Using durhack-execute to build <plan or row>." Load `durhack-dev` first if it
isn't loaded. You are the **dispatcher**: brief agents, gate their work, turn their reports into
issues and PRs. Write code yourself only for tiny glue (a few lines) or when the user asks.

Speed rules: **one smoke gate, one fix round, no reviewer per task, no TDD.** People do the real
testing through `human-test` issues.

## Setup (2 minutes, not 20)

1. `scripts/durhack/whoami.sh` — your lane. The plan's rows must be your lane's.
2. **Branch:** `git fetch -q && git switch -c <lane>/<topic> origin/main` (or the plan's branch).
   Never build on `main`.
3. **Watcher running?** If not, start it (`durhack-inbox` → *Watching*).
4. **Ledger:** `.claude/ledger/<plan-stem>.md` (git-ignored). First line `# Ledger — <plan>`.
   Existing ledger → skip every `Task N: done`. After compaction, trust the ledger + `git log`.
5. **No plan, just a row?** Write a 3–10 line plan inline in the ledger (tasks, agent, files),
   show it to the user in one message, and go unless they object. Real plans come from
   `durhack-plan` lane mode.

## Dispatch

Don't ask how to dispatch; default to **agents for anything bigger than a few lines**. Show the
mapping in one message and start:

```
Task 1  FastAPI app + /health         -> durhack-builder (sonnet)   batch A
Task 2  Upload screen (mock C1)       -> durhack-frontend (sonnet)  batch A
Task 3  Wire upload to real C1        -> durhack-builder (sonnet)   alone, after A
```

- **Models:** `model: "sonnet"` for implementers. Opus (omit `model`) for a task the plan marks
  "decide" or "design", tricky algorithms, and the fix round after Sonnet failed.
- **Batch** tasks that share no files and don't depend on each other: one message, several
  `Agent` calls (`subagent_type` = the task's agent). At most 4 at once. No worktree isolation.
- **Brief** (the agent sees nothing else): where the task fits (one line); the task section
  from the plan pasted verbatim; contracts it touches pasted from `docs/contracts.md`; paths it
  may touch; "batched — don't run ./check.sh, don't commit" or "alone — run ./check.sh once,
  commit"; and the cap: "Stop and report after 2 failed fix attempts on the same failure or
  about 60 turns, whichever comes first."
- **Figma:** for UI tasks with a Figma link, say so in the brief; `durhack-frontend` uses the
  Figma MCP if that laptop has it, else builds from the description/screenshot.

## After each batch

1. **Gate once:** `./check.sh`, quote the last lines.
2. **Red →** one fix round: a fresh agent (Opus if a Sonnet agent wrote it) with the failing
   output and the files involved. Gate again. **Still red → stop the task:** revert or leave it
   out of the commit, ledger it, open a `human-test` or ask the user (clickable): Skip it ·
   I'll look myself · One more round.
3. **Commit** (one per task where files separate, else one naming the tasks). Subject
   `type: plain sentence`. No AI attribution (the commit-msg hook rejects it).
4. **Route the report fields** (don't let them sit in the ledger):

| Report field | Becomes |
| --- | --- |
| `HUMAN_TEST` | `scripts/durhack/ask.sh test` (batch a task's steps into one issue) |
| `NEEDS_OTHER_LANE` | `scripts/durhack/ask.sh request --to <lane>` (keep the mock in place) |
| `NEEDS_OWNER` | `scripts/durhack/ask.sh owner` with the options |
| `MOCKS` | one line in your lane file's Notes: what's mocked, which contract, swap at CP1 |
| `BLOCKED` | change something (smaller task, more context, Opus) before re-dispatching; never retry unchanged |

5. **Ledger:** `Task N: done (commit abc1234)` or `Task N: dropped — <why>`.

**Read reports, not files.** Opening an agent's files pulls the context back you dispatched it
to avoid. Spot-check only what the gate can't (does the screen show up?) by running the app.

## Ship (after every 1–2 rows, not at the end)

1. Update `docs/lanes/<lane>.md`: rows `done` (or `testing` if waiting on a human test), the
   *Log* line, *Waiting on*.
2. `durhack-pr` → *Open a PR* (`pr.sh open`), then `pr.sh merge <N>` if it has no owner paths.
   **No confirmation from the user**: push, open, merge, start the next row.
   `needs-owner` → leave it for the owner and carry on on a new branch from your branch's tip
   only if the next task depends on it; else from `origin/main`.
3. Reply to any `agent-request` this delivered: `reply.sh N --pr <PR> --close`.
   **Then tell every other lane that needs what just merged** (check the *Needs* columns of
   the other lane files and `docs/contracts.md`): one `ready` issue per lane, `ask.sh ready`
   (`durhack-inbox` → *Telling a lane it's ready*). Do this for every such merge, not only
   checkpoints. For a `needs-owner` PR, send it once the owner merges it.
4. Tell the user in 3–5 lines: what's on `main` now, what's waiting on whom (issue numbers), the
   next row.

## Context

A `DURHACK CONTEXT WARNING` (about 650k tokens) means: finish the batch in flight, ship it,
then `durhack-handoff`. Never start a new row past the warning.

## Don't stop for small things

An ambiguity: decide, ledger `Ruling: <decision> — <why>`, keep going. Stop only for: something
destructive, a push to `main` (never), a missing secret, an owner decision that blocks every
remaining task, or a plan so wrong every path is a guess. Waiting on another lane is never a
reason to stop: mock it and build the next thing.

## Checkpoints

At CP1 and CP2 the owner may dispatch one `durhack-reviewer` (Opus) over the diff since the
last checkpoint tag (saved to a file), with `docs/contracts.md` and the demo script.
`FIX_FIRST` blockers become `agent-request` issues to the lanes that own the files. Tag each
checkpoint on `main` after the merge: `git tag cp1 origin/main && git push origin cp1` (a tag,
not a branch push; allowed).

## Near the end

After CP2 (freeze): only fixes, polish, the demo path, and docs. Every fix still goes through a
PR. Hand `durhack-explain` the list of what was built so `docs/documentation.md` is current for
the judges.
