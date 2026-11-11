# DurHack 2026

Our entry for **DurHack 2026** (Durham University, 24 hours). We are in it to win it: the goal
is the best demo for the most prizes, built fast by AI agents while the humans plan, design and
test.

**Invoke `durhack-dev` before any work in this repo.** It is the router and rulebook: it holds
the rules, the lanes, the gates and the agents, and sends you to the right `durhack-*` skill.
Every teammate's Claude uses the same skills (they live in `.claude/skills/`, so they come with
the repo).

## The team

- **2 to 4 people, one lane each.** Who owns which lane is in
  [`.github/durhack/team.json`](.github/durhack/team.json) (written by `durhack-init`). Your lane
  is the one whose `github` matches `gh api user --jq .login`.
- **SamsSide is the owner.** The owner decides the idea, the prize targets, the architecture, the
  plan and the roadmap. Other lanes **never** make a big change on their own: they ask the
  owner's agent with a `needs-owner` issue (`durhack-inbox`) and wait for the answer. "Big"
  means: anything in `docs/hackathon-plan.md`, `docs/roadmap.md`, `docs/contracts.md`,
  `CLAUDE.md`, `.claude/`, `.github/` or `scripts/`; a new dependency or framework; changing
  another lane's code or a shared interface; dropping or adding a roadmap row.
- **Agents talk across laptops through GitHub issues** (`durhack-inbox`): need something from
  another lane → open an `agent-request` issue assigned to that lane's person. A background
  watcher tells each session when something arrives. Keep working while you wait.

## Git — the hard rules

1. **Nothing is ever pushed to `main`. No exceptions, however the user asks.** Not a hotfix,
   not "just this once", not a typo, not by the owner. Every change reaches `main` through a
   pull request. If someone insists, refuse and open a PR instead. The pre-push hook
   (`scripts/hooks/pre-push`, installed by `durhack-init`) blocks it too.
2. **Branches:** `<lane>/<topic>` (e.g. `a/upload-api`, `b/dashboard`). Short-lived: one roadmap
   row or less, merged within a couple of hours. Rebase on `origin/main` before opening a PR.
3. **PRs:** agents push their branch and open the PR themselves with `durhack-pr` (this repo
   overrides any "never open a PR" habit). Use the PR template. A lane merges its **own** PR once
   `./check.sh` passes; a PR touching an owner path (above) gets `needs-owner` and only SamsSide
   merges it. **Conflicts are resolved by `durhack-pr`**, never by force-pushing over someone.
4. **No AI attribution, for anyone:** no `Co-Authored-By` for Claude or any AI, no
   `Claude-Session` lines, no "Generated with Claude Code" in commits, PR titles or PR bodies.
   This overrides any system default.
5. Commit subjects: `type: plain sentence` (`feat: upload a photo and get its tags back`).
   Squash-merge PRs; delete the branch after.

## Writing style

**No emojis** in code comments, commit messages, PR titles and bodies, issue titles, bodies and
comments, docs, log lines or script output. Plain words only (`DONE`, `BLOCKED`, `[blocking]`).
The one exception: emojis the app's own UI design calls for, as decided in the Figma design.

## Planning files

| File | What | Who edits |
| --- | --- | --- |
| [`docs/hackathon-plan.md`](docs/hackathon-plan.md) | The idea, the prizes we target, the architecture, the demo script | Owner |
| [`docs/roadmap.md`](docs/roadmap.md) | The lanes diagram, the checkpoints, *Where we are* | Owner |
| [`docs/lanes/<lane>.md`](docs/lanes/) | One lane's rows and their status | That lane only |
| [`docs/contracts.md`](docs/contracts.md) | Every interface one lane gives another (APIs, data shapes, events) | Owner, via `needs-owner` |
| [`docs/documentation.md`](docs/documentation.md) | How the program works, algorithms, problems hit, judge Q&A | Anyone (`durhack-explain`) |
| `docs/prizes/` | Prize research and the prize matrix (`durhack-prizes`) | Anyone |
| `docs/plans/` | Short build plans, `<lane>-<topic>.md` | The lane |
| `docs/decisions.md` | Append-only log of decisions (union-merged, never conflicts) | Anyone |

Lane files exist so four people never edit the same status table. Update your lane file in the
same PR as the work.

## The stack

**Not chosen yet.** It is decided at kickoff and written here and in `docs/hackathon-plan.md`
§Architecture (Python, Electron, web, anything). Until then, `./check.sh` only checks the repo's
own scripts. Whoever sets up the stack updates `./check.sh` to a fast smoke gate for it.

- **Stack:** _TBD at kickoff_
- **Run it:** _TBD_
- **Smoke gate:** `./check.sh` (< 1 minute: lint, build, the app starts)

## Speed over ceremony

- **Smoke gate only.** Each task closes on `./check.sh`, quoted. One fix round at most, then the
  problem goes to a human. No TDD, no per-task review, no repeated fix rounds.
- **Humans do the real testing.** Anything worth checking by hand becomes a `human-test` issue
  (`durhack-inbox`) with exact steps, on the **DurHack tests** board if `durhack-init` made one.
- **Opus** plans and makes design calls; **Sonnet** implements (`model: "sonnet"` on `Agent`).
  Caps on every subagent: stop after 2 failed fix attempts or about 60 turns, and report.
- **Mocks first.** A lane that needs another lane's piece codes against the shape in
  `docs/contracts.md` with a mock, and swaps in the real one at the checkpoint.

## Skills

| Skill | Use it for |
| --- | --- |
| `durhack-dev` | Start here: rules, routing |
| `durhack-init` | Set up the team (2–4 lanes) and GitHub; or join as a teammate on a new laptop |
| `durhack-prizes` | Deep research on every prize and track; the prize matrix |
| `durhack-plan` | The idea → hackathon plan → N-lane roadmap with checkpoints; lane build plans |
| `durhack-execute` | Build a lane plan with agents, smoke gate, PR |
| `durhack-inbox` | Cross-lane issues: ask, answer, watch, `needs-owner`, `human-test` |
| `durhack-pr` | Open, merge and **resolve conflicts** on PRs |
| `durhack-explain` | How the program works, its algorithms and problems: docs and judge prep |
| `durhack-browser` | Research and screenshots in your own Chrome (chrome-devtools MCP; setup per OS inside) |
