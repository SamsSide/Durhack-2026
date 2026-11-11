# DurHack 2026 — Roadmap

*What gets built, by which lane, in what order, and the checkpoints where lanes meet.*

> **The owner (SamsSide) edits this file.** Each lane's rows and their status live in
> [`lanes/<lane>.md`](lanes/), which only that lane edits, so four people never fight over one
> table. This file holds the diagram, the checkpoints, *Where we are* and *Up next*.
> Changes from other lanes: a `needs-owner` issue (see `durhack-inbox`).

## Where we are

**Not started.** Next: `durhack-init` (team and lanes), then `durhack-prizes` (research every
prize), then `durhack-plan` kickoff (idea, plan, contracts, rows).

## Up next, per lane

| Lane | Person | Next row | Waiting on |
| --- | --- | --- | --- |
| _set by durhack-init_ | | | |

## Checkpoints

| CP | Time | Means | Status |
| --- | --- | --- | --- |
| CP0 | start + 1–2 h | Idea, prizes, architecture and contracts agreed; every lane builds on mocks | todo |
| CP1 | ~10 h | First end-to-end run on `main`; real pieces replace mocks | todo |
| CP2 | ~18 h | Feature freeze: fixes, polish, docs, judge prep only | todo |
| CP3 | ~22 h | Demo rehearsed, submission done | todo |

## The lanes

*Placeholder for 2 lanes; `durhack-init` redraws it with one column per person, and
`durhack-plan` fills in the rows. Dotted arrows are cross-lane needs (contracts).*

```mermaid
flowchart LR
  CP0(["CP0 · Contracts agreed"]):::cp
  subgraph A["Lane A · TBD"]
    direction TB
    A1["A1 · Scaffold + mock"]:::todo --> A2["A2 · TBD"]:::todo --> A3["A3 · TBD"]:::todo
  end
  subgraph B["Lane B · TBD"]
    direction TB
    B1["B1 · Scaffold + mock"]:::todo --> B2["B2 · TBD"]:::todo --> B3["B3 · TBD"]:::todo
  end
  CP1(["CP1 · First end-to-end"]):::cp
  CP2(["CP2 · Feature freeze"]):::cp
  CP3(["CP3 · Demo + submission"]):::cp
  CP0 --> A1 & B1
  A2 --> CP1
  B2 --> CP1
  CP1 --> A3 & B3
  A3 --> CP2
  B3 --> CP2
  CP2 --> CP3
  A1 -. "C1" .-> B2
  classDef done fill:#2da44e,color:#fff
  classDef wip fill:#d4a72c,color:#000
  classDef next fill:#0969da,color:#fff
  classDef todo fill:#8c959f,color:#fff
  classDef owner fill:#8250df,color:#fff
  classDef cut stroke-dasharray: 5 5
  classDef cp fill:#fff8c5,stroke:#9a6700,color:#000
```

Colours: green done, amber in progress, blue next, grey to do, purple owner decision, dashed cut.

## How to update

- **A lane finishes a row:** that lane updates its own `lanes/<lane>.md` in the same PR. It
  does not touch this file.
- **The owner,** every few hours or at a checkpoint: recolour the diagram from the lane files,
  refresh *Where we are*, *Up next* and the checkpoint statuses, in one PR.
- **Adding, cutting or moving a row:** owner only (`durhack-plan` re-plan). Cut rows stay, as
  `cut`, so ids don't move. Log it in `decisions.md`.
