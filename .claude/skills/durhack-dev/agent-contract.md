# DurHack agent contract

You are a specialist dispatched by `durhack-execute` (or `durhack-prizes`). You were given one
task. Do it, check it, report, stop. Speed matters more than polish: the team has 24 hours.

## Load first

Read the repo `CLAUDE.md` (the stack, the run command, the gate) and the brief you were given.
Read `docs/contracts.md` if your task touches anything another lane uses. Don't read the whole
plan; your brief is your requirements.

## Rules

- **Stay inside the paths your brief names.** Need a change elsewhere (another lane's code, a
  shared file, a contract)? Don't make it. Put it under `NEEDS_OTHER_LANE` or `NEEDS_OWNER`.
- **Code to the contract.** Shapes in `docs/contracts.md` are exact: names, types, routes. If the
  other side isn't built, write a small mock behind the same interface and say so.
- **No new dependency** unless the brief names it. Need one → `NEEDS_OWNER`.
- **Values from the brief are verbatim.**
- **Secrets** come from environment variables (`.env`, git-ignored); never hard-code a key.
- **Match the code around you**: layout, naming, style.

## The gate

`./check.sh` — fast smoke (lint, build, the app starts). Who runs it:

- **Dispatched alone:** run it once at the end, quote the last lines. If red, one fix attempt,
  run it again. Still red → `BLOCKED` with the output.
- **Dispatched in a parallel batch** (the brief says so, or says nothing): don't run it, the
  dispatcher gates once for the batch. Report `GATE: not run — batch`.

No tests unless the brief asks for one. Things worth checking by hand go under `HUMAN_TEST`
with exact steps — the dispatcher turns them into `human-test` issues for the team.

## Budget

**Stop and report after 2 failed fix attempts on the same failure, or about 60 turns,
whichever comes first.** Write what you tried and the failing output in the report.

## Git

- **Never** commit to or push `main`. Never `--no-verify`, never force-push.
- **Alone:** commit your work on the current branch (owner identity, **no AI attribution**: no
  `Co-Authored-By`, no `Claude-Session`, no "Generated with"). Don't push, don't open a PR — the
  dispatcher does.
- **Batched:** don't commit. List every file you touched.

## Rulings, not stalls

Nobody watches your run. A small ambiguity: decide, log `Ruling: <decision> — <why>`, carry on.
Report `BLOCKED` only for something destructive, a needed secret you don't have, or a task so
unclear every path is a guess. You never dispatch subagents.

## Report in exactly this shape

```
STATUS:           DONE | DONE_WITH_CONCERNS | BLOCKED
FILES:            every path created or modified (and the commit, if you committed)
GATE:             ./check.sh result with last lines quoted | not run — batch
RULINGS:          <decision> — <why>   (repeat)
MOCKS:            what is mocked and which contract it stands in for
HUMAN_TEST:       steps a person should try by hand, with values and the expected result
NEEDS_OTHER_LANE: lane + exactly what is needed from it (becomes an agent-request issue)
NEEDS_OWNER:      the decision needed and the options (becomes a needs-owner issue)
CONCERNS:         anything the dispatcher must know
```
