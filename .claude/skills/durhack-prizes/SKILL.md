---
name: durhack-prizes
description: Use when given the DurHack 2026 prizes, tracks, sponsor challenges or judging criteria (pasted text, a URL, Devpost/MLH pages, photos of the briefing slides) — deep research on every one of them in parallel (what the sponsor really wants, the APIs and tools involved, past winners, judging criteria, effort and risk), then a prize matrix showing which prizes can be stacked on one project, and idea seeds that maximise expected winnings. Also for researching one sponsor API or tool in depth during the hack.
---

# Prize research — in it to win it

Load `durhack-dev` first if it isn't loaded. Output lives in `docs/prizes/` (anyone may write
there; commit through a PR). Research synthesis is Opus; per-prize digging is the
`durhack-researcher` agent.

## 1. Collect the prize list

From whatever the team gives: pasted text, the DurHack site / Devpost / MLH pages (fetch them),
photos of slides (read them). Write `docs/prizes/list.md`: one row per prize with
**id** (`P1`…), **name**, **sponsor**, **prize value** (cash/items), **category** (main track,
sponsor, MLH, side), **the brief verbatim**, **judging criteria** if stated, **submission
requirements** (form field, demo at a booth, use of their API, a write-up), **source URL**.

Ask the user (clickable) only if something blocks: e.g. "Is the main track judged separately
from sponsor prizes, or can one project enter all?" Usually the rules page answers it; read it.

## 2. Research every prize in parallel

One `durhack-researcher` agent per prize (or per sponsor when one sponsor has several prizes),
**at most 4 at once**, `model: "sonnet"`, batches until all are done. Brief each with the
prize's row verbatim and this checklist; each writes `docs/prizes/<id>-<slug>.md` and returns a
5-line summary:

1. **What they actually want.** Read the sponsor's brief, their site, their dev docs and any
   blog posts about hackathon prizes they've run. Why does this sponsor sponsor hackathons
   (hiring, API adoption, brand)? What would make their judge's eyes light up?
2. **The tech.** Exact APIs/SDKs/tools to use, sign-up and free-tier/credit limits, auth, a
   "hello world" in a few lines, time to first working call, gotchas (rate limits, approval
   waits, region locks). Links to the quickstart.
3. **Past winners.** Search Devpost and the web for previous winners of this sponsor's prize
   (at DurHack and other UK hackathons): what they built, why it won. 2–5 examples with links.
4. **Judging.** Stated criteria; who judges (sponsor engineers, a panel); demo format.
5. **Effort and risk** for a team of our size in 24 h: hours to qualify (minimum) and to
   compete (realistic), risks.
6. **Stackability.** Which other kinds of prize this naturally combines with.
7. **Score** 1–5 each: fit-for-any-idea, win chance, value, effort (5 = cheap).

Researchers use WebSearch/WebFetch; for pages that need a real browser (JS-heavy sites,
logged-in Devpost, live numbers) one of them may use `durhack-browser` — only one agent drives
Chrome at a time.

## 3. The matrix and the strategy (you, Opus)

Read the agents' summaries (open a full file only to settle a question). Write
`docs/prizes/matrix.md`:

- **The matrix:** prizes × (value, effort, win chance, stack group, required tech, submission
  needs), sorted by expected value per hour (value × win chance ÷ effort hours).
- **Stack groups:** sets of prizes one project can enter together without bending the idea
  (e.g. main track + "best use of <AI API>" + "best UI" + MLH "best domain").
- **Free wins:** prizes that cost under an hour on top of any project (a domain name, deploying
  to a sponsor's cloud, using a specific database). Always take them; each becomes a row.
- **3–5 idea seeds**, each naming the stack group it targets, the demo "moment", the lanes it
  splits into for our team size, and the main risk. Recommend one.
- **Submission checklist:** every form field, tag, video or booth visit each targeted prize
  needs, with deadlines.

Then hand over: "Prize research done — `docs/prizes/matrix.md`. Next: `durhack-plan` kickoff
picks the idea." Commit via a PR (`durhack-pr`).

## During the hack

- A sponsor API question ("how do I auth with X", "what's their rate limit") → one researcher,
  answer into `docs/research/<topic>.md`, one line in `docs/research/log.md`.
- New prize announced mid-event → add a row to `list.md`, research it, update the matrix, and
  if it's a free win, open a `needs-owner` issue proposing the row.
- Before submission: re-read `matrix.md`'s submission checklist against what was built; open
  `human-test`/`agent-request` issues for anything missing.
