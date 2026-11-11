---
name: durhack-plan
description: Use when planning anything in the DurHack repo — choosing the idea from the prize research, writing docs/hackathon-plan.md (idea, prize targets, architecture, stack, demo script), splitting the work into 2–4 parallel lanes with checkpoints in docs/roadmap.md, writing docs/contracts.md so lanes can build against mocks, re-planning when time runs short, and lane mode — turning a lane's next roadmap rows into a short build plan for durhack-execute.
---

# Planning DurHack

Load `durhack-dev` first if it isn't loaded. Three modes:

| Mode | Who | Output |
| --- | --- | --- |
| **Kickoff** | Owner | `docs/hackathon-plan.md`, `docs/contracts.md`, `docs/roadmap.md`, every `docs/lanes/*.md` |
| **Lane** | Any lane, for its own rows | `docs/plans/<lane>-<topic>.md` |
| **Re-plan** | Owner (others ask via `needs-owner`) | Cuts and moves in the roadmap and lane files |

Planning is fast but not sloppy: a question skipped becomes an agent's guess. Every question is
`AskUserQuestion`, clickable, recommended first, one line of trade-off each. Keep it to the
questions that change what gets built.

## Kickoff (owner, first 1–2 hours)

Inputs: `docs/prizes/matrix.md` from `durhack-prizes` (run it first if the prizes are known),
`team.json` (lane count and people), the hackathon's theme and rules.

1. **Ideas.** Propose 3 ideas, each scored from the prize matrix: which prizes it can stack,
   the "wow" in the demo, the risk (APIs, hardware, data), and whether N people can split it
   cleanly. Recommend one. The owner picks (or merges two).
2. **The demo first.** Write the 2-minute demo script before the architecture: what the judge
   sees, in order, and the one moment that wins. Everything not in the demo is optional.
3. **Prize targets.** From the matrix: the main track + every sponsor prize the idea can
   realistically qualify for, with what each needs (an API used, a submission field, a
   category). Each becomes a roadmap row owned by a lane.
4. **Architecture and stack.** 2–3 options (e.g. Python FastAPI + React; Electron; Streamlit),
   picked for: what the team already knows, setup time, demo-ability, the prizes' required
   tech. Draw the component diagram (Mermaid). Pick hosting for the demo (local laptop is fine).
5. **Split into lanes.** One lane per person from `team.json`. Split by **component with a
   clean interface** (API / AI / UI / integrations), never by "everyone does a bit of
   everything". Each lane gets: its paths (folders it owns), its rows, what it gives and needs.
   Update each lane's `paths` and `focus` in `team.json`.
6. **Contracts.** For every arrow between lanes, write the contract in `docs/contracts.md`
   (template: [`references/contracts-template.md`](references/contracts-template.md)):
   exact routes, signatures, JSON with an example, events, file formats, env var names, and
   the *Shared files* table (which lane owns each glue file). Each contract names a **mock**
   the consuming lane uses until CP1.
7. **Checkpoints and times.** Use the skeleton's CP0–CP3 and put real clock times on them from
   the hackathon schedule (start, end, judging). Every lane has rows feeding each checkpoint.
   Leave the last ~4 hours for freeze, polish, docs, judge prep and submission.
8. **Write it all** and ship as one owner PR:
   - `docs/hackathon-plan.md` from [`references/hackathon-plan-template.md`](references/hackathon-plan-template.md)
   - `docs/roadmap.md`: the Mermaid lanes diagram (see `durhack-init`'s
     `references/roadmap-skeleton.md`), checkpoints table, *Where we are*, *Up next per lane*
   - `docs/lanes/<id>.md`: each lane's rows (id, row, needs, gives, checkpoint, status)
   - `CLAUDE.md` *The stack* section (stack, run command), `check.sh` STACK steps,
     `.env.example`, `.gitignore` additions
   - a scaffold row per lane as its first row (folders, hello-world that starts, its mock)
9. **Tell every lane:** the merged kickoff PR is the signal (no issue needed).
   Post its link in the team chat; each lane then runs lane mode on its first rows.

### Row rules

- A row is 30–90 minutes of agent work, ends in something runnable or visible, and names its
  checkpoint. Bigger → split.
- Every row says **Needs** (other lanes' rows/contracts) and **Gives**.
- Prize rows are real rows ("C4 · Use <sponsor> API for X, fill in the prize form").
- Order rows so each lane is never idle waiting: mock what you need, build the real thing
  later.
- Mark rows the owner must settle with "owner" in Notes (a judgement, a sign-off).

## Lane mode (each lane, as often as needed)

1. Read your lane file, the contracts you touch, and *Where we are*. Pick your next 1–4 rows
   (`next` first, then `todo` whose needs are met or mockable).
2. Ask only what blocks building (clickable). Questions only the owner can answer →
   `needs-owner` issue; plan around it.
3. Write `docs/plans/<lane>-<topic>.md` from [`references/lane-plan-template.md`](references/lane-plan-template.md):
   a header (lane, rows, branch name, paths allowed), then tasks. Each task: the agent
   (`durhack-builder` / `durhack-frontend`), files, exact behaviour, values, the contract it
   implements or mocks, how the smoke gate proves it, and `HUMAN_TEST` steps.
   No placeholders, no "etc". Tasks that share no files can run in parallel: say so.
4. Mark the rows `wip` in your lane file. Hand to `durhack-execute` (same session is fine;
   offer `/clear` + "durhack-execute docs/plans/<file>" if the context is already big).

## Re-plan (when behind)

Every ~4 hours, or when a lane is `blocked` for more than 30 min, the owner checks the roadmap:

- **Cut, don't slip.** Drop rows (status `cut`, kept in the file) in this order: nice-to-have
  polish, prizes we're unlikely to win, features not in the demo script.
- **Never cut the demo path** or the submission rows.
- Move a row to another lane only with both people's yes (`agent-request`) and the owner's.
- Update *Where we are* and *Up next* in `docs/roadmap.md`, lane files, and log the cut in
  `docs/decisions.md` (one line: time, decision, why).
