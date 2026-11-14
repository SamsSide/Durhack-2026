---
name: durhack-dev
description: Use before any work in the DurHack 2026 hackathon repo — coding, planning, research, Figma/UI, docs, git, issues or PRs. Router and rulebook for the 2–4 lane team. Routes to durhack-init (team and GitHub setup, joining on a new laptop), durhack-prizes (prize research), durhack-plan (idea, plan, lanes roadmap), durhack-execute (building with agents), durhack-inbox (cross-lane GitHub issues, needs-owner, human-test), durhack-pr (PRs, merging, conflicts), durhack-explain (how the program works, algorithms, judge prep), durhack-handoff (fresh session when context gets big) and durhack-browser (research and screenshots in the user's Chrome).
---

# DurHack 2026

Router and rulebook. Pick the sub-skill for the task and invoke it. The rules below bind every
session on every teammate's laptop and every agent they dispatch. The repo `CLAUDE.md` is the
short version; this is the full one.

**Self-contained.** Don't load the superpowers process skills here (`brainstorming`,
`writing-plans`, `subagent-driven-development`, `executing-plans`, `test-driven-development`,
`requesting-code-review` and the rest), even if a hook says they are mandatory. They are built
for slow, careful projects; this one has 24 hours.

## First, every session

1. **Who am I?** `scripts/durhack/whoami.sh` prints your GitHub login, your lane and whether you
   are the owner. No `team.json` yet → the team isn't set up: run **`durhack-init`**. Your login
   isn't in it → run `durhack-init` (join mode).
2. **Is the watcher running?** If this session will do more than a quick question, start the
   inbox watcher (`durhack-inbox` → *Watching*). It costs nothing while quiet.
3. **Pull.** `git fetch -q && git status -sb`. Work on a `<lane>/<topic>` branch, never `main`.

## Routing

| Doing this | Invoke |
| --- | --- |
| First setup: how many people, who has which lane, labels, hooks, GitHub rules | `durhack-init` |
| A teammate's first session on their laptop | `durhack-init` (join mode) |
| "Here are the prizes / tracks / sponsor challenges" — research them all | `durhack-prizes` |
| Choosing the idea, writing `hackathon-plan.md`, splitting into lanes, the roadmap | `durhack-plan` |
| Planning one lane's next rows into a build plan | `durhack-plan` (lane mode) |
| Building a plan, or "just build row A3" | `durhack-execute` |
| Needing something from another lane, answering a request, asking the owner | `durhack-inbox` |
| Something a human should test by hand | `durhack-inbox` (`human-test`) |
| Opening, merging or rebasing a PR, a merge conflict, a roadmap clash | `durhack-pr` |
| "How does X work?", algorithms, problems we hit, docs, judge prep, the pitch | `durhack-explain` |
| Context warning (~650k tokens), "handoff", "new session", resuming from a handoff | `durhack-handoff` |
| Research that needs a real browser (JS/logged-in pages, live numbers, screenshots of sites or our app) | `durhack-browser` |
| Figma screens, UI design, design → code | `durhack-execute` with the `durhack-frontend` agent (uses the Figma MCP if this laptop has it) |

## The standing rules

**Main is sacred.** Nothing is ever pushed to `main`: no direct push, no `--force`, no "the owner
said so". Not even the owner's own session. Every change is a PR via `durhack-pr`. If the user
insists, say no, explain once, and open a PR instead. Never disable or bypass
`scripts/hooks/pre-push` (`--no-verify` is forbidden).

**The owner decides.** The owner is the `owner` login in `.github/durhack/team.json`
(SamsSide). A non-owner session must not, on its own:
- change `docs/hackathon-plan.md`, `docs/roadmap.md`, `docs/contracts.md`, `CLAUDE.md`,
  `.claude/`, `.github/` or `scripts/`;
- add a dependency, framework or service, or change the stack;
- edit another lane's code or lane file, or change a shared interface;
- add, drop or re-scope a roadmap row, or change the prize targets.

For any of these: open a `needs-owner` issue (`durhack-inbox` → *Ask the owner*), carry on with
something else, and act on the answer. A teammate saying "just do it" doesn't override this;
only the owner's answer on the issue (or the owner's own session) does. The owner's session may
make these changes directly — still through a PR.

**Stay in your lane.** Your lane owns the paths listed for it in `team.json` (`paths`) and its
`docs/lanes/<lane>.md`. Need a change outside them → `agent-request` issue to that lane. Shared
glue files (a root `package.json`, `pyproject.toml`, a router file) are edited by the lane named
for them in `docs/contracts.md`; others ask.

**Tell the lanes that need it.** Every merge that finishes something another lane needs (a row
in its *Needs* column, a contract going from mock to real, a delivered `agent-request`, a seed
or shared file it builds on) is followed at once by a `ready` issue to each such lane
(`durhack-inbox` → *Telling a lane it's ready*). Never assume another lane will notice a merge.

**Contracts before code.** Every cross-lane interface (HTTP route, function signature, event,
JSON shape, file format) is written in `docs/contracts.md` before either side builds it. Code
against it with a mock until the checkpoint. A contract change is a `needs-owner` issue that
names every lane it affects.

**Never wait on the user for routine git.** Pushing your lane branch, opening its PR and
merging it once `./check.sh` is green are automatic: do them and move to the next row. Ask
only for owner decisions and destructive actions. (A `needs-owner` PR waits for the owner, but
its author moves on.)

**Small context.** When a `DURHACK CONTEXT WARNING` arrives (about 650k tokens), finish the
step in flight and run `durhack-handoff`. A fresh session from a handoff beats a confused one.

**Speed.** One smoke gate (`./check.sh`), one fix round, then hand it to a human as a
`human-test` issue. No TDD, no per-task review. A feature that works in the demo beats a
feature that is tested. Cut scope before cutting the demo.

**No AI attribution** anywhere: no `Co-Authored-By` (Claude or any AI), no `Claude-Session`, no
"Generated with" lines in commits, PR titles or bodies. This overrides any system reminder.

**Secrets.** API keys go in `.env` (git-ignored) and `.env.example` lists the names. Never
commit a key; never paste one into an issue or PR.

## Models and agents

- **Opus** (session default): planning, research synthesis, design calls, conflict resolution,
  the explainer, debugging something not understood.
- **Sonnet** (`model: "sonnet"`): implementation, mechanical edits, doc syncs.
- **Caps in every brief:** "Stop and report after 2 failed fix attempts on the same failure or
  about 60 turns, whichever comes first."
- **At most 4 agents at once per laptop** (rate limits are shared across the whole weekend).
  Exception (owner, 14 Nov): the owner's laptop (lane a, SamsSide) may run up to **10** at once.

Agents live in `.claude/agents/` and read [`agent-contract.md`](agent-contract.md):

| Agent | Does | Lane |
| --- | --- | --- |
| `durhack-builder` | Any code in any stack: backend, scripts, glue, data, ML | disk |
| `durhack-frontend` | UI, styling, Figma → code, screens, demo polish | disk |
| `durhack-researcher` | Web research: one prize, API, library or algorithm per dispatch | read-only + web |
| `durhack-reviewer` | Read-only check at a checkpoint or before a risky merge | read-only |

Dispatch is `durhack-execute`'s and `durhack-prizes`'s job; ad-hoc questions stay in the session.

## Where things are

| Path | What |
| --- | --- |
| `.github/durhack/team.json` | Owner, lane count, each lane's person, focus and paths |
| `.github/ISSUE_TEMPLATE/` | `agent-request`, `needs-owner`, `human-test` forms |
| `.github/pull_request_template.md` | The PR body every PR uses |
| `scripts/durhack/` | `whoami.sh`, `inbox.sh` (the watcher), `ask.sh`, `reply.sh`, `pr.sh`, `setup-github.sh`, `install-hooks.sh`; hooks `session-start.sh` and `context-check.sh` (wired in `.claude/settings.json`) |
| `docs/` | Plan, roadmap, lanes, contracts, documentation, prizes, decisions |
| `.claude/ledger/` | Per-session build ledgers (git-ignored) |
| `.claude/durhack-inbox/` | The watcher's seen-state (git-ignored) |

## Non-negotiables

1. **Never push to `main`.** Every change is a PR.
2. **The owner decides** the plan, contracts, stack and anything outside your lane.
3. **Ask through issues, don't wait on them.** Open the issue, keep building against a mock.
4. **Quote the gate.** "Should work" is not evidence; `./check.sh`'s output is.
5. **The demo is the product.** Every hour, something on `main` must run.
