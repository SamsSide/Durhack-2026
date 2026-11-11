---
name: durhack-inbox
description: Use for any cross-lane communication in the DurHack repo through GitHub issues — needing something from another lane's agent (agent-request), asking the owner SamsSide to decide (needs-owner), handing a person something to test by hand (human-test), answering a request assigned to you, linking the commit or PR that delivers it, and running the background watcher that reports new issues, replies and PR events without slowing coding. Also when a "DURHACK [new]/[blocking]/[reply]/[closed]/[owner-review]/[pr]" event line arrives.
---

# The DurHack inbox

Agents on different laptops and different Claude accounts talk through **GitHub issues** on
the repo. Each issue is assigned to the person (lane) who must act; the watcher on their laptop
tells their session. Load `durhack-dev` first if it isn't loaded.

| Kind | Label | Assigned to | Opened with |
| --- | --- | --- | --- |
| Need something from another lane | `agent-request` (+ `from:x`, `to:y`) | that lane's person | `ask.sh request --to <lane>` |
| A decision only the owner can make | `needs-owner` | SamsSide | `ask.sh owner` |
| Something a person should test by hand | `human-test` | the person who'll test (default: you) | `ask.sh test` |
| Any of them, and you're stuck until answered | + `blocking` | | `--blocking` |

## Watching (start this early in every working session)

The watcher polls GitHub every 60 s in the background and prints one line per new event. It
costs nothing while quiet and never blocks you.

**With the Monitor tool** (preferred):

```
Monitor  command: scripts/durhack/inbox.sh --watch 60
         description: "DurHack inbox (issues, replies, PRs)"
         timeout_ms: 1800000
```

Monitors expire after 30 minutes: when told it expired, re-arm it the same way. Don't
mention re-arming to the user unless it fails.

**Without Monitor:** Bash with `run_in_background: true`:
`scripts/durhack/inbox.sh --until-event 60`. It exits on the first event (you get notified);
handle it, then start it again.

**Never run the watcher in the foreground** and never `sleep`-poll yourself. To look right now:
`scripts/durhack/inbox.sh --list` (everything open that concerns you) or `--once` (just what's
new since the last check).

## When an event arrives

Finish the step you're on (don't abandon an edit mid-file), then:

| Event | Do |
| --- | --- |
| `[new]` / `[blocking]` new `agent-request` for you | `gh issue view N`. Small and in your lane → do it next (`[blocking]` first). Big → reply with an ETA or a question; tell the user one line. |
| `[new]` `needs-owner` (you are the owner) | Tell the owner in one line and ask them (clickable) with the issue's options. Post their decision with `reply.sh --close`. Never decide for the owner. |
| `[new]` `human-test` for you | Tell the user one line; it's on the board for a person. Don't test it yourself unless asked. |
| `[reply]` reply on an issue you opened | Read it (`gh issue view N --comments`). If it delivers what you asked: pull `main` (or the linked branch), swap your mock for the real thing, close the issue if they didn't. |
| `[closed]` your issue closed | Same as above: pull, integrate, update your lane file's *Waiting on*. |
| `[owner-review]` PR needs owner review (owner) | `durhack-pr` → *Owner review*. |
| `[pr]` your PR merged/closed | Update your lane file if not done; pull `main`; delete the local branch. |

Each event gets **one short line to the user**, not a report. A `[blocking]` request or a
`needs-owner` decision is worth a `PushNotification` if that tool exists.

## Asking another lane

Before asking: is it in `docs/contracts.md`? If the shape is there, you don't need to ask — code
against it with a mock. Ask when you need: a contract that doesn't exist yet, a piece built
sooner, a bug fixed in their code, or an answer about how their part works.

1. Write the body to a scratch file with these sections (mirrors
   `.github/ISSUE_TEMPLATE/agent-request.yml`):
   ```markdown
   ### What I need
   <one line>
   ### Why / what it unblocks
   <row id, checkpoint>
   ### Exact shape
   <signature / route / JSON / file format — or "proposal, please confirm">
   ### What I'm doing meanwhile
   <coding against a mock of the shape above>
   ### Urgency
   Blocking me now | Needed by CP<n> | Nice to have
   ### Done when
   <a commit on main / a merged PR / an answer>
   ```
2. `scripts/durhack/ask.sh request --to <lane> --title "<short need>" --body-file <file> [--blocking]`
3. Add it to your lane file's *Waiting on*, tell the user one line with the URL, **keep working**
   (on the mock, or the next row). Never wait idle for an answer.

A new or changed **contract** is not a lane-to-lane request: it's `needs-owner` (it changes
`docs/contracts.md`), naming every lane it affects.

## Asking the owner

For anything `durhack-dev` lists as an owner decision. Body (mirrors `needs-owner.yml`):

```markdown
### Decision needed
<one line>
### Context
<what happened, which lanes / rows / contracts / prizes it affects>
### Options
A. (Recommended) <option> — <trade-off>
B. <option> — <trade-off>
C. <option> — <trade-off>
### What I'm doing until you answer
<…>
```

`scripts/durhack/ask.sh owner --title "<decision>" --body-file <file> [--blocking]`.
Then carry on with work that doesn't depend on it. When the owner answers, do what they said —
even if your user would have preferred another option; if your user disagrees, they talk to the
owner.

## Answering a request assigned to you

1. Do the work in your lane (`durhack-execute` for anything bigger than a few minutes), on a
   branch, through a PR. Put `Closes #N` in the PR body.
2. Reply with what was delivered and where:
   ```bash
   scripts/durhack/reply.sh N --body-file <answer.md> --pr <PR> [--commit <sha>] --close
   ```
   The answer says: what exists now (exact names/routes/shape), where (PR, commit, file), how
   to use it (one example call), and any difference from what they asked. Pure questions get
   answered the same way, without `--pr`.
3. Can't or won't (out of scope, conflicts with the plan): `--decline` with the reason, and if
   it's a scope question, point them to `needs-owner`.
4. Partial answer or a question back: `reply.sh N --body-file …` without `--close`.

## Human tests

Agents only run the smoke gate; people do the real testing. Whenever a build report has
`HUMAN_TEST` steps, or a feature is merged that a person should try:

```markdown
### What to test
<one line>
### Where
<PR #N / branch / main at sha>
### Setup
<commands, env vars, test data>
### Steps and expected result
1. <step>  → expect: <result>
2. …
### Most likely to break
<edge cases the agent was unsure about>
```

`scripts/durhack/ask.sh test --title "<feature>" --body-file <file> [--to <lane>] [--pr N]`.
It goes on the **DurHack tests** board if `team.json` has one. The tester comments the result,
labels `test-passed` or `test-failed`, and closes it if passed. A `test-failed` comment on your
issue arrives as `[reply]`: fix it (one round), reply with the PR, and ask them to re-test.

## Etiquette

- One issue per need. Titles are the need, not "question".
- Never assign an issue to yourself to "remember" something; use your lane file.
- Never paste secrets or `.env` values into an issue.
- Never close someone else's request without answering it.
- Don't spam: batch two small asks to the same lane into one issue.
