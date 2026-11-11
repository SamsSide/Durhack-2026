---
name: durhack-init
description: Use to set up the DurHack repo for the team — how many people (2, 3 or 4), who owns which lane, each lane's GitHub login, focus and paths, the labels, the "DurHack tests" board, protecting main, the git hooks and the inbox watcher. Also join mode — a teammate's first session on their own laptop (clone, gh login, hooks, find their lane, start the watcher). Use when whoami.sh says the team is not set up or the login is not in team.json.
---

# Setting up the DurHack team

**Announce:** "Using durhack-init to set up the team." Load `durhack-dev` first if it isn't.

Two modes. Run `scripts/durhack/whoami.sh` and pick:

- `team: NOT SET UP` **and** you are the owner (SamsSide) → **Setup mode**.
- `team: NOT SET UP` and you are not the owner → stop: "The owner (SamsSide) runs setup first.
  Pull once they've merged it." Offer to open a `needs-owner` issue saying you're waiting.
- Team set up, your login isn't in it → **Join mode** (unassigned lane) or ask the owner.
- Team set up, your login has a lane → **Join mode** (laptop setup only).

Every question is `AskUserQuestion`, clickable, recommended option first. One at a time unless
genuinely independent.

## Setup mode (owner, once)

### 1. Ask

1. **How many people?** 2 · 3 · 4. (Lanes = people. One person, one lane, one Claude.)
2. **Each lane: who and what.** For each lane `a`, `b`, `c`, `d` (as many as people): the
   person's **GitHub login** (verify each exists: `gh api users/<login> --jq .login`) and a
   **short name / focus**. The focus can be provisional until the idea is chosen in
   `durhack-plan`; offer defaults by team size:
   - 2: `a` Backend + data + AI · `b` Frontend + UX + demo
   - 3: `a` Backend/API · `b` AI/algorithms/data · `c` Frontend + demo
   - 4: `a` Backend/API · `b` AI/algorithms/data · `c` Frontend/UI · `d` Integrations + sponsor
     prizes + demo/pitch
   Lane `a` defaults to the owner. Ask which lane is the owner's.
3. **Lane paths** (which folders each lane owns). Default: TBD until the stack is chosen; then
   `durhack-plan` fills them (e.g. `backend/`, `frontend/`). Store what's known now.
4. **Invite collaborators now?** (outward action) Logins that aren't collaborators yet
   (`gh api repos/<repo>/collaborators --jq '.[].login'`): Invite all *(Recommended)* · Let me
   pick · Not now.
5. **Human-test board?** Create a GitHub Project "DurHack tests" *(Recommended — one place
   for people to pick up tests)* · Labels only. The board needs the `project` scope:
   if `gh auth status` doesn't list it, tell the owner to run `! gh auth refresh -s project`.

### 2. Write

- **`.github/durhack/team.json`**:
  ```json
  {
    "owner": "SamsSide",
    "repo": "SamsSide/Durhack-2026",
    "people": 3,
    "lanes": [
      { "id": "a", "name": "Backend/API", "github": "SamsSide", "focus": "…", "paths": ["backend/"] },
      { "id": "b", "name": "AI/algorithms", "github": "teammate1", "focus": "…", "paths": [] }
    ],
    "board": {}
  }
  ```
- **`docs/lanes/<id>.md`** for each lane, from [`references/lane-template.md`](references/lane-template.md).
  Delete lane files beyond the team size.
- **`docs/roadmap.md`**: regenerate the diagram with exactly N lane columns using
  [`references/roadmap-skeleton.md`](references/roadmap-skeleton.md) (Mermaid, one `subgraph` per
  lane, checkpoints `CP1…` as shared nodes every lane feeds). Rows are placeholders until
  `durhack-plan` fills them.
- **`docs/team.md`**: a short human table (lane, person, focus, paths, how to reach them).

### 3. GitHub

Run and quote each:

```bash
scripts/durhack/setup-github.sh labels
scripts/durhack/setup-github.sh repo-settings
scripts/durhack/setup-github.sh protect-main      # ruleset; may be refused on a free private repo
scripts/durhack/setup-github.sh board             # if chosen
scripts/durhack/setup-github.sh invite <login>    # per invite, only after the owner said yes
scripts/durhack/install-hooks.sh
```

`protect-main` refused → say so plainly: "GitHub can't enforce it on this plan; the pre-push
hook and the CLAUDE.md rule are the guard, so every teammate must run `install-hooks.sh`."

### 4. Ship it as a PR

Branch `a/team-setup` (owner's lane id), commit, `scripts/durhack/pr.sh open`, and merge it
(the owner may merge owner-path PRs). **Exception, once only:** if `origin` has no `main` yet
(empty repo), the very first bootstrap commit has to create `main`. Ask the owner (clickable)
before that push; it is the only push to `main` ever allowed, and only when `main` doesn't
exist. Everything after goes through PRs.

### 5. Tell the team

Print the join message for the owner to paste in the team chat:

```
Clone: gh repo clone SamsSide/Durhack-2026 && cd Durhack-2026
Open Claude Code there and say: "durhack-init — join me"
Your lane: <id> (<name>). Read README.md for how the issues/PR flow works.
```

Then start the owner's watcher (`durhack-inbox` → *Watching*).

## Join mode (each teammate, each laptop)

1. **Tools:** `git`, `gh` (`gh auth status`; not logged in → `! gh auth login`), `jq` or
   `python3`. Missing → say exactly what to install; don't work around it.
2. **Accepted the invite?** `gh api repos/SamsSide/Durhack-2026 --jq .permissions.push` must be
   `true`. Not → "Accept the invite at github.com/SamsSide/Durhack-2026/invitations".
3. **Hooks:** `scripts/durhack/install-hooks.sh`.
4. **Lane:** `whoami.sh`. No lane → show the free lanes and ask which is theirs, then open a
   `needs-owner` issue ("<login> wants lane <id>") — **don't edit `team.json` yourself.**
5. **Optional tools on this laptop** (say what's missing, don't block): Figma MCP (for
   `durhack-frontend`), the chrome-devtools MCP (`durhack-browser`), WebSearch.
6. **Start the watcher** (`durhack-inbox` → *Watching*), show `inbox.sh --list`, read
   `docs/roadmap.md` *Where we are* and `docs/lanes/<lane>.md`, and say what's next for them.

## Changing the team later

Adding a person, moving a lane, re-splitting: owner only, as a PR that updates `team.json`,
the lane files and the roadmap diagram together (`durhack-plan` re-splits rows).
