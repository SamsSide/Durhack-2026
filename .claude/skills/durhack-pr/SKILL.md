---
name: durhack-pr
description: Use for every pull request in the DurHack repo — opening one (rebase, smoke gate, push, PR body, needs-owner label), merging your lane's PR, the owner reviewing needs-owner PRs, and resolving merge and rebase conflicts between up to four people's agents, especially roadmap, lane-file, contracts, lockfile and shared-config clashes. Also whenever someone asks to push to main (the answer is no, open a PR).
---

# DurHack pull requests

**Nothing reaches `main` except through a PR.** If anyone — the user, a teammate, the owner —
asks to push to `main`, commit on `main`, force-push `main` or skip the hook: refuse in one
sentence and open a PR instead. Load `durhack-dev` first if it isn't loaded.

## Open a PR

1. On a `<lane>/<topic>` branch with your work committed (no AI attribution in messages).
2. Your lane file (`docs/lanes/<lane>.md`) updated: row status, the *Log* line.
3. Write the PR body from `.github/pull_request_template.md` to a scratch file: what, rows,
   contracts, the gate output, human-test steps or issue numbers, `Closes #N` for
   `agent-request`s it delivers. No "Generated with" line.
4. `scripts/durhack/pr.sh open --title "<type: plain sentence>" --body-file <file>`
   — it rebases on `origin/main` (conflict → *Resolving conflicts* below, then run it again),
   runs `./check.sh`, pushes, opens the PR, and labels `needs-owner` + requests the owner's
   review if it touches owner paths.
5. Red gate after your one fix round → `--draft`, say why in the body, open a `human-test` or
   `agent-request` as fits. A draft is never merged.

**Small and often.** A PR is one row or less, opened within a couple of hours of branching.
Long branches are what make four-way conflicts.

## Merge

- **Your lane's PR, no owner paths:** `scripts/durhack/pr.sh merge <N>` as soon as the gate is
  green and it's mergeable. **Don't ask the user** whether to push, open or merge: it's
  automatic, so a session never sits waiting while its person is away. Squash, branch deleted. Then `git switch main && git pull` locally and
  branch again for the next row.
- **`needs-owner` PR:** only the owner merges it. Don't merge, don't nag; the owner's watcher
  shows it as `[owner-review]`.
- **Another lane's PR:** never merge it for them, unless they asked you to on the PR.
- `CONFLICTING` → check out its branch, resolve (below), push, then merge.

## Owner review (owner's session, on `[owner-review]`)

`scripts/durhack/pr.sh status <N>` and `gh pr diff <N>` (owner-path files only; skim the rest).
Check: does it match `docs/hackathon-plan.md` and `docs/contracts.md`? Does it change another
lane without their say? Then ask the owner (clickable): **Merge** *(Recommended if clean)* ·
**Request changes** (write the comment) · **Close**. Act on the answer:
`gh pr review <N> --approve` + `pr.sh merge <N>`, or `gh pr review <N> --request-changes -b "…"`.

## Resolving conflicts

`pr.sh sync` (or `open`) stops with exit 3 and lists the conflicted files; you're mid-rebase.
Resolve each file by the rules below, `git add` it, `git rebase --continue`, repeat until done,
then run `./check.sh` again. **Never** `git push --force` to someone else's branch, never
`git checkout --theirs .` wholesale, never drop another lane's change to make yours apply.
`rerere` is on (`install-hooks.sh`), so a resolution you make once is reused.

Mid-rebase, **"ours" is `main`** (what others merged) and **"theirs" is your commit** being
replayed. Read both sides before choosing.

| File | Rule |
| --- | --- |
| `docs/lanes/<your lane>.md` | Yours, but someone else edited it? Keep both edits; ask that lane why. |
| `docs/lanes/<other lane>.md` | You shouldn't have touched it. Take `main`'s version, drop your edit, and send them an `agent-request` for the change. |
| `docs/roadmap.md` | The owner's file. Take `main`'s version, then re-apply **only** your intended change (usually none: your status lives in your lane file). Not the owner → your re-applied change makes it `needs-owner`. |
| `docs/contracts.md` | Never auto-resolve. Take `main`, stop, open `needs-owner` showing both versions. Code against `main`'s contract. |
| `docs/decisions.md`, `docs/research/log.md` | Union-merged by `.gitattributes`; if it still conflicts, keep every line from both sides, in time order. |
| `docs/documentation.md`, `docs/prizes/*` | Keep both sides' content; merge duplicate sections by hand. |
| Lockfiles (`package-lock.json`, `uv.lock`, `poetry.lock`, `pnpm-lock.yaml`) | Never hand-merge. Take `main`'s, then re-run the installer (`npm install`, `uv lock`…) so your dependency is re-added. A new dependency needed owner approval anyway. |
| Shared manifests (`package.json`, `pyproject.toml`, `requirements.txt`) | Keep both sides' entries (union of dependencies and scripts); if the same key differs, take `main` and tell the owning lane. |
| Code in your lane's paths | Understand both sides: keep `main`'s behaviour and add yours on top. If they really clash, keep both functions and rename yours, then reconcile in a follow-up. |
| Code in another lane's paths | Take `main`'s. Anything you needed there becomes an `agent-request`. |
| Generated files (builds, `dist/`) | Shouldn't be committed. Delete from the branch, add to `.gitignore`. |

Done → `./check.sh` green → continue `pr.sh open` (or push the rebased branch with
`git push --force-with-lease` — your own branch only). Summarise in the PR body:
"Rebased on main; resolved <files> by <rule>".

A conflict you can't settle by these rules (two lanes changed the same behaviour, a contract
diverged): `git rebase --abort`, open `needs-owner` with both versions, and work on something
else until it's answered.

## Keeping conflicts rare

- Pull `main` before every new branch; rebase (`pr.sh sync`) at least every hour.
- Status lives in **your lane file**, never the roadmap.
- New shared things (a route, an env var, a dependency) go through `docs/contracts.md` /
  `needs-owner` first, so two lanes don't invent them twice.
- One lane owns each shared glue file (named in `docs/contracts.md` → *Shared files*).
