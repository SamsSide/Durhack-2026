# P3 - Best Use of Entire (mini portable projector)

Researched 13 Nov 2026 from docs.entire.com (docs now live at docs.entire.com; docs.entire.io redirects), github.com/entireio/cli README and the entire.io blog. WebFetch summaries were produced by a small model, so exact flags should be re-checked with `entire <cmd> --help` on the day. Nothing was installed or signed up for.

## 1. What Entire is today

Entire is a Git forge for agent-human work, plus an open-source CLI (`entire`) that captures agent sessions into Git.

Sources: [CLI README](https://github.com/entireio/cli), [docs index](https://docs.entire.com/llms.txt), [quickstart](https://docs.entire.com/quickstart.md).

| Piece | What it is | Source |
| --- | --- | --- |
| CLI `entire` | Installs agent hooks and git hooks; records sessions and checkpoints | README |
| Sessions / checkpoints | After you commit agent work, a checkpoint (prompts, transcript, files touched) is linked to that commit | README |
| entire-graph | A CLI plugin that builds a code graph (symbols, call graph) so agents query it instead of grepping | [graph setup](https://docs.entire.com/guides/graph/set-up-graph.md), [graph CLI ref](https://docs.entire.com/cli-reference/graph.md) |
| Brain | A plugin that merges checkpoints + graph into persistent project memory, queried by CLI | [brain overview](https://docs.entire.com/guides/brain/overview.md) |
| Trails | Entire's replacement for the pull request (intent, branch, sessions, review scores); review agents run in cloud sandboxes on each push | [trails overview](https://docs.entire.com/guides/trails/overview.md) |
| entire.com | Hosted forge and dashboard: repos, mirrors, sessions viewer, Trails, review agents | quickstart |

Install (any one; stable recommended):
- `curl -fsSL https://entire.com/install.sh | bash` (macOS/Linux)
- `brew install --cask entireio/tap/entire`
- `irm https://entire.com/install.ps1 | iex` (Windows PowerShell)
- `go install github.com/entireio/cli/cmd/entire@latest`

Supported agents (IDs): `claude-code`, `codex`, `cursor`, `copilot-cli`, `opencode`, `antigravity`, `factoryai-droid`, `pi`. Gemini CLI is not in the current list. Source: quickstart.

Graph:
- Install `entire plugin install graph`, check `entire graph version`.
- Enable `entire graph setup --repo .` (needs CLI 0.10.0+, Git 2.36+).
- Query `entire graph query --repo . --profile full --query "token refresh returns 401"`.
- Other: `impact --symbol X`, `neighbors`, `def`, `explain`, `diff`, `snapshot`, `stats`.
- It does not produce a visual map as far as the docs show. The brief's "visual map" is unconfirmed; `snapshot` exports NDJSON. We could render our own picture from `snapshot`/`edges` for the judges.
- Supported languages: unconfirmed (docs only show Go examples). Check `entire graph capabilities --json` before choosing a stack.

Brain:
- Install `entire plugin install brain` (offers to install graph too). Enable with `entire brain setup`, check with `entire brain status`.
- Query `entire brain brief "<task>"`, `entire brain recall "<question>"`, `entire brain query "<terms>"`; save with `entire brain remember`.
- MCP: Brain v0.5.1 has NO MCP server (docs say `entire brain mcp` is unavailable). Agents use the CLI via instructions written to `.entire/agent-guide.md`, `AGENTS.md`, `CLAUDE.md`. The brief says "CLI or MCP"; CLI is the real path. Separately, `entire mcp` is a read-only stdio server exposing only `agent_help` and `entire_status` ([mcp ref](https://docs.entire.com/cli-reference/mcp.md)).
- Memory extraction from past sessions is off by default and sends session content to a model provider (token cost). Use `--no-backfill --no-daemon` to skip.
- Brain needs Claude Code 2.1.78+ for capture.

Trails: `entire trail create --title "..." --checkout`, `entire trail show`, `entire trail link <n> --branch <b>`. Review agents are configured on the entire.com Project Agents page (presets Security, Slop, Human Review Required, or custom; triggers: trail branch pushed, manual, schedule). "Assign an agent a task via Trail" is not described as a built-in action; trail assignees are for people. Unconfirmed how to hand a trail to an agent beyond checking out its branch and running Claude Code on it.

GitHub or Entire forge: code can stay on GitHub. A mirror is a synced copy on Entire; GitHub stays origin and rules still apply ([mirrors](https://docs.entire.com/guides/repositories/mirrors.md)). Trails on mirrored repos work, using a linked GitHub PR for CI and merging; Entire and GitHub approvals are separate ([trails overview](https://docs.entire.com/guides/trails/overview.md)). Mirror needs: `entire login`, the Entire GitHub App installed on the repo, `entire repo mirror add`, `entire repo remote add entire`. Local capture (`entire enable`) needs no account. `search`, `activity`, `experts` and dashboard views need the repo published (mirror or Entire repo). Git LFS is not supported via mirrors.

Pricing ([billing](https://docs.entire.com/billing.md)): only Entire-run Agents (review agents, custom agents) are billed, by prepaid credit (min $10). Everything else is free. The $100 trial credit is "temporarily paused" for new accounts. The page does not mention promo codes. Use the MLH promo code ("Entire Q4 2026 - Q3 2027") at signup or billing; what it grants is unconfirmed. Assume the CLI, graph, brain, sessions and mirror are free regardless; the code matters only for review agents.

## 2. Setup for a Claude Code team on an existing GitHub repo

Run per laptop, in the repo, on a feature branch (our rule: never push main). Everything below is from the docs; verify flags with `--help`.

```bash
# 1. install CLI (WSL/Linux)
curl -fsSL https://entire.com/install.sh | bash
entire version
git --version        # needs 2.36+ for graph

# 2. enable sessions for Claude Code (writes .entire/settings.json, hooks)
cd <repo>
entire enable -y --agent claude-code
entire status --detailed

# 3. graph
entire plugin install graph
entire graph version
entire graph setup --repo .        # writes .entire/agent-guide.md and a managed block in AGENTS.md and CLAUDE.md
# 4. brain (optional, skip extraction to avoid tokens/egress)
entire plugin install brain
entire brain setup --no-backfill --no-daemon   # or plain setup if we want extraction
entire brain status

# 5. publish to dashboard (mirror)
entire login
# install the Entire GitHub App on the repo (browser)
entire repo mirror add
entire repo remote add entire
git push entire <branch>            # keep origin on GitHub; do not use --override

# 6. trails
entire trail create --title "Add X" --checkout
# work, commit, git push origin <trail-branch>
entire trail show
```

Teammates: install CLI, `git pull`, run `entire enable -y --agent claude-code` (settings.json is in the repo if committed with `--project`; `--local` keeps it personal), `entire session resume <branch>` to pick up a session (prints `claude -r SESSION_ID`). Commit `.entire/settings.json` so all lanes share config. Our repo rule says `.claude/`, `.github/`, `scripts/`, `CLAUDE.md` are owner paths: the enable PR touches `.claude/settings.json` and `CLAUDE.md`, so it needs `needs-owner` and SamsSide merges it. Do it as ONE PR from the owner.

Interaction with existing hooks:
- Claude hooks: `entire enable` modifies `.claude/settings.json` (docs say it "preserves unrelated Claude Code settings"; how it merges with our existing hook entries is unconfirmed). It adds about six lifecycle hooks (session start/stop, prompt, turn end, task events). `entire graph setup` also registers a SubagentStart hook in `.claude/settings.local.json` (skip with `--no-claude-hook`). Diff `.claude/settings.json` before and after and keep our existing hooks.
- Git hooks ([git hooks](https://docs.entire.com/guides/configuration/git-hooks.md)): existing hooks are moved to `<hook>.pre-entire`; Entire's hook runs first, then ours. Docs name post-commit and a pre-push (ref pushes) behaviour and a commit-time trailer step; the exact hook list is unconfirmed. Our `scripts/hooks/pre-push` and `commit-msg` are installed by `durhack-init`. If `durhack-init` reinstalls them they replace the chain; `entire configure --force` restores Entire's. Order matters: run `entire enable` AFTER our hooks are installed, then test `git push` of a non-main branch, and test that pushing main is still blocked.
- Entire's pre-push also pushes checkpoint refs (`refs/entire/checkpoints/*`). Check our pre-push hook does not block non-branch refs.

## What it writes into commits

- A trailer `Entire-Checkpoint: <id>` on commits made after agent work ([README](https://github.com/entireio/cli), git-hooks page). The docs mention no other trailer. It adds no commits to our branch.
- Entire never writes `Co-Authored-By` or Claude attribution as far as the docs show (unconfirmed by reading the source). The Entire-Checkpoint trailer is not an AI-attribution trailer by name, but it does mark agent work. It conflicts with our rule only if the rule means "no trailers naming agents or sessions"; owner decision. If we want zero trailers, the hook adds it at commit time via a git hook, so removing it means disabling the git hooks, which breaks checkpoint linking. Recommend allowing `Entire-Checkpoint` explicitly in `CLAUDE.md` for this prize.
- Setting `sign_checkpoint_commits` defaults to true: the checkpoint commits (in the refs, not our branch) are signed. Needs a git signing key; unconfirmed whether it fails without one.
- Our commit-msg hook may reject or strip the trailer if it checks for trailers; test it.

## 3. Privacy

Source: [privacy and redaction](https://docs.entire.com/guides/configuration/privacy-and-redaction.md), README.
- Full transcripts (prompts and responses) are pushed to the git remote with your code, as `refs/entire/checkpoints/*` (or branch `entire/checkpoints/v1` for repos enabled before 0.10.0). If the repo is public, anyone can read them.
- Secrets (API keys, tokens, credentialed URLs, DB strings, private keys) are redacted before writing, with Betterleaks; README calls it best effort. Images are not scanned. PII redaction is off by default.
- Options: `entire configure --local --checkpoint-remote github:<owner>/<private-repo>` sends checkpoints to a separate private repo; `--skip-push-sessions` stops uploads; `entire checkpoint list --outgoing` previews.
- Hackathon plan: if our repo is public for Devpost, expect judges to read our prompts. That is fine for this prize but never paste secrets in prompts and keep `.env` out of agent reach. Consider a private checkpoint repo plus a screenshot instead.
- Brain extraction sends session content to a model provider (off by default).
- Telemetry on by default for `enable` (`--telemetry` toggle). Anonymous.

## 4. Measuring token efficiency

- Entire records token usage per session and checkpoint: `entire session tokens`, `entire checkpoint tokens <id>`, and `entire tokens profile [--all] [--json]` (experimental, under labs; aggregates latest 50 checkpoints; [tokens ref](https://docs.entire.com/cli-reference/tokens.md)). The entire.com session view shows tokens "when available".
- `entire graph stats` compares graph use with grep/file reads in local transcripts. The "up to 71%" in the brief is in Entire's docs, but Entire's own wiki calls the stats a local heuristic, not a measured benchmark. The only blog number found is about 262k vs 547k tokens per question (about 52% fewer), reported by [IT Brief](https://itbrief.co.uk/story/entire-launches-agentic-search-for-code-repositories) (unverified at the primary source). Do not claim 71% as our result.
- Our own before/after (do this, it is what judges asked for: "measurable"):
  1. Pick 5 fixed questions about our code ("where is X handled and what calls it?").
  2. Run each in a fresh Claude Code session with graph disabled (do not run `graph setup`, or comment the managed block out), then with it enabled. Same model, same prompt.
  3. Record tokens from `entire session tokens` (or Claude Code `/cost`) per run. Put them in a table and a bar chart; report mean and per-question.
  4. Caveat honestly: small codebase at hackathon start means small gains; do it at hour 12+ when the repo has real size. Alternatively run it once on a larger open-source repo to show scale.
- Add `entire tokens profile --json` output and the `graph stats` output to the docs folder as evidence.

## 5. What judges likely want, and past winners

No judging criteria from Entire beyond the brief: "seamless human-AI collaboration, clean code history, measurable token efficiency". Evidence to show (our proposal, not confirmed by MLH):
- entire.com repo/mirror page with sessions and checkpoint count.
- `entire checkpoint list` output (many checkpoints, one per commit) and `entire status`.
- Graph: terminal screenshot of `entire graph query` and `impact`, plus the token table from section 4. A rendered graph picture from `snapshot` if cheap.
- Brain: 2 or 3 `entire brain recall` examples where an agent avoided repeating a mistake.
- Trails: every task as a trail, with a review-agent score and findings; one cross-lane handoff via `entire session resume`.
- Short written note in the Devpost submission naming each capability used.

Past winners: a Devpost search for "Best Use of Entire" found nothing. This is a new 2026-27 MLH sponsor, so no past winners could be found. Unconfirmed whether other 2026 hackathons ran it.

## 6. Hours and risks

| Goal | Hours (rough guess, not sourced) |
| --- | --- |
| Qualify (sessions + graph, CLI only) | 1 hour for the owner, 10 min per teammate |
| Strong submission (mirror, Trails on each task, Brain, token table) | 3 to 4 hours spread across the 24 |
| Compete well (measured before/after, graph render, polish) | 5 to 6 hours |

Risks:
- Fast-moving product: CLI is at least 0.10 and Brain 0.5.1; docs and brief disagree (Brain MCP, "visual map"). Pin versions after setup.
- Hook interactions with our `.claude/settings.json`, `pre-push` and `commit-msg` hooks. Test on a throwaway branch first.
- Trailer vs our no-attribution rule (section 2). Owner must decide before enabling.
- WSL: the README does not mention WSL; Windows has a PowerShell installer and a `WINDOWS.md`. Linux install script in WSL should work (unconfirmed). Our laptops are WSL.
- Several Claude sessions per laptop: hooks fire for each; concurrent commits could confuse checkpoint-session linking (unconfirmed). Foreground read-only subagents leave no record.
- Brain's background watcher and extraction can use tokens and CPU; skip extraction.
- Trails and review agents cost credit; trial credit paused. The promo code's value is unknown.
- Public repo exposes transcripts (section 3).
- Mirror requires installing the GitHub App on the repo (needs repo admin).

## 7. Scores (1 to 5; effort 5 = cheap)

| Criterion | Score | Why |
| --- | --- | --- |
| Fit for any idea | 5 | About how we build, not what; only needs git and Claude Code |
| Win chance | 3 | Likely few entrants (new sponsor), but judges want measured evidence and visible Trails use; we must do it deliberately |
| Value | 2 | Mini projector; low-medium value |
| Effort (cheap) | 3 | CLI setup is fast; mirror, Trails and a real token benchmark take real hours, and hook conflicts are a risk |

## 8. Do this tonight (owner first)

1. Owner decision: allow the `Entire-Checkpoint` trailer in `CLAUDE.md` rule 4? Record in `docs/decisions.md`.
2. On a throwaway clone, install the CLI in WSL and run `entire enable -y --agent claude-code`. Diff `.claude/settings.json` and `.git/hooks/`. Confirm our hooks still run, `git push origin main` is still blocked, and a branch push works.
3. Run `entire plugin install graph`, `entire graph setup --repo .`, `entire graph capabilities --json`: check it supports the language we will pick at kickoff.
4. Do not install Brain yet unless graph works; then `entire brain setup --no-backfill --no-daemon`.
5. `entire login`, redeem the MLH promo code, install the Entire GitHub App on a test repo, try `entire repo mirror add`.
6. Decide whether the real repo is public; if so, set `--checkpoint-remote` to a private repo or accept public transcripts.
7. Write the owner's setup PR (`.entire/`, `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md` block) with `needs-owner`; teammates then run `entire enable -y --agent claude-code`.
8. Plan the benchmark: list 5 questions, decide to run at hour 12.
9. At kickoff: after the stack is chosen, re-run `entire graph setup`, open one trail per roadmap row.
10. Ask an MLH or Entire rep at the venue: what judges score, and how to hand a trail to an agent.
