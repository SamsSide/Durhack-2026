---
name: durhack-explain
description: Use to understand and explain the DurHack project — "how does X work", walking through the backend and data flow, naming and researching the algorithms and models it uses (complexity, why this one, alternatives, references), collecting the problems we hit and how we solved them from git history, issues and PRs, keeping docs/documentation.md current, and preparing for the judges (pitch, likely questions with answers, technical deep-dive notes per teammate).
---

# Explaining the project (and winning the judging)

Load `durhack-dev` first if it isn't loaded. This skill reads the code; it never changes app
code. Its output is `docs/documentation.md` (and answers in chat). Explaining is Opus; heavy
reading or web research on an algorithm can go to `durhack-researcher` (and the
`durhack-browser` skill for pages that need a real browser).

## Modes

| Ask | Do |
| --- | --- |
| "How does X work?" | Answer in chat from the code (trace it: entry point → calls → data). Cite `file:line`. Offer to add it to the docs. |
| "Refresh the docs" | Rebuild `docs/documentation.md` (below) and open a PR. |
| "Judge prep" | The *Judge prep* section below, written into the docs, plus a one-page cheat sheet in chat. |
| "What algorithm is this / is it any good?" | The *Algorithms* procedure for that one. |
| "What went wrong / what problems did we hit?" | The *Problems* procedure. |

## Reading the code fast

1. `docs/hackathon-plan.md` §Architecture and `docs/contracts.md` for the intended shape.
2. The real shape: `git ls-files | head -200`, the entry points (main, server, routes, app
   root), then follow one request end to end. Read big files by line range.
3. Where the plan and the code disagree, **the code is the truth**; say so in the docs.

## docs/documentation.md — sections (stable headings)

1. **One-paragraph summary** — what it does, for a non-technical judge.
2. **Architecture** — Mermaid component diagram of what *exists* (not the plan), each lane's
   part, external services.
3. **How a request flows** — one numbered walk-through of the demo path, with file references.
4. **Algorithms and models** — one subsection each (below).
5. **Data** — what is stored, where, the shapes (link `contracts.md`).
6. **Problems we hit** — (below).
7. **Limitations and next steps** — honest; judges reward it.
8. **Judge prep** — (below).
9. **Who built what** — lanes, people, the main PRs (from `team.json` and `gh pr list --state merged`).

## Algorithms

For each algorithm, model, heuristic or notable technique in the code (search for: sorting,
graph search, ML calls, embeddings, scoring formulas, caching, concurrency, geometry, prompt
pipelines):

- **What it is**, by its proper name ("cosine similarity over sentence embeddings", "A*",
  "Levenshtein distance"), and where (`file:line`).
- **How it works** in 3–5 sentences, plus the key formula or pseudocode.
- **Complexity** (time/space) and how it behaves at demo scale vs real scale.
- **Why this one**: alternatives and why we didn't use them (ask the lane that built it via
  `agent-request` if the reason isn't in the code, PRs or `decisions.md`).
- **Known weaknesses** and edge cases.
- **References**: the paper, docs or a good article (research them; link real sources only).

## Problems

Mine the history:

```bash
git log --oneline --no-merges origin/main | head -150
gh pr list --state merged --limit 100 --json number,title,body --jq '.[] | "#\(.number) \(.title)"'
gh issue list --state all --limit 200 --json number,title,labels --jq '.[] | "#\(.number) [\([.labels[].name]|join(","))] \(.title)"'
cat docs/decisions.md
```

Look for `fix:` commits, `test-failed` issues, `blocked`/cut rows, reverted commits, contract
changes. For each real problem: **what broke**, **why**, **how we fixed or worked around it**,
**what we learned**, with links. Judges love a good "the hardest part was…" story: pick the best
two and mark them.

## Judge prep

- **The 30-second pitch** and the **2-minute demo script** (from `hackathon-plan.md` §2,
  updated to what actually works).
- **Prize angles:** for each targeted prize (`docs/prizes/matrix.md`), the one sentence that
  shows we meet its criteria, and which file/feature proves it.
- **Likely questions with answers** (15–25): technical ("why X not Y", "how does it scale",
  "what happens if the API is down", "how accurate is it"), product ("who would use it",
  "what's novel"), process ("how did you split the work", "how did you use AI tools").
  Answers short and true; never invent numbers — measure them or say we didn't.
- **Per-person deep dive:** for each lane, 5 bullet points that person should be able to talk
  about confidently about their part, and the one tricky question they should prepare for.
- **Demo failure plan:** what to do if the live demo breaks (video, seeded data, screenshots).

Finish with a PR (`durhack-pr`); `docs/documentation.md` is not an owner path, so the lane
merges it.
