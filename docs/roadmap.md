# DurHack 2026 — Roadmap

*What gets built, by which lane, in what order, and the checkpoints where lanes meet.*

> **The owner (SamsSide) edits this file.** Each lane's rows and their status live in
> [`lanes/<lane>.md`](lanes/), which only that lane edits, so four people never fight over one
> table. This file holds the diagram, the checkpoints, *Where we are* and *Up next*.
> Changes from other lanes: a `needs-owner` issue (see `durhack-inbox`).

## Where we are

**Planning, 14 Nov 15:00. Nothing is built yet; building starts when the owner says so.** The
project is Terra Nova (`hackathon-plan.md`). Contracts X1 to X7 are agreed. The work is split by
agent budget: lane a carries the most, lane b a middling amount, lane c the least.

## Up next, per lane

| Lane | Person | Next row | Waiting on |
| --- | --- | --- | --- |
| a | @SamsSide | A1 scaffold and mock; then A8 models and A12 Figma design alongside A2 | the owner's go |
| b | @CutGrass88 | B1 app shell, store and first globe | A1 on `main` |
| c | @Justin-CODING-PY | C1 Create screen, then C2 nation card | A1 and B1 on `main` |

## Checkpoints

Hacking ends Sunday 12:00.

| CP | Time | Means | Status |
| --- | --- | --- | --- |
| CP0 | 1 hour after the owner's go | Scaffold and mock server on `main`; every lane building on the mock | todo |
| CP1 | Sat 21:00 | First end-to-end: a prompt makes a world, nations grow live on the globe, a click opens a panel | todo |
| CP1.5 | Sun 02:00 | Wars animate; cut, silence, delete and restore work; real lore, narration and anthem | todo |
| CP2 | Sun 08:00 | Feature freeze: fixes, polish, the saved demo world, docs | todo |
| CP3 | Sun 10:30 | Demo rehearsed three times, submitted | todo |

## The lanes

*One column per person. Dotted arrows are cross-lane needs (contracts X1 to X7).*

```mermaid
flowchart LR
  CP0(["CP0 · Plan and mock on main"]):::cp
  subgraph A["Lane A · World, story and sound (@SamsSide)"]
    direction TB
    A1["A1 · Scaffold, types, mock server"]:::next --> A2["A2 · World generation"]:::todo --> A3["A3 · Simulation tick"]:::todo --> A4["A4 · Nation agents and bus"]:::todo --> A5["A5 · Gemini rulers and budget"]:::todo
    A5 --> A6["A6 · War and diplomacy"]:::todo --> A7["A7 · Cut, silence, delete, restore"]:::todo --> A9["A9 · Replays and demo world"]:::todo
    A8["A8 · Blender models"]:::next
    A12["A12 · Figma design"]:::next
    A13["A13 · Lore and anthem lyrics"]:::todo --> A14["A14 · Narration and sound module"]:::todo --> A15["A15 · Anthem from history"]:::todo --> A16["A16 · War chants"]:::todo
    A10["A10 · Remote agents"]:::cut
    A18["A18 · Regions and secession"]:::todo
    A19["A19 · Flags"]:::todo
    A11["A11 · Tiger Data (stretch)"]:::todo
    A17["A17 · Image input (stretch)"]:::todo
  end
  subgraph B["Lane B · The globe (@CutGrass88)"]
    direction TB
    B1["B1 · App shell, store, first globe"]:::next --> B2["B2 · Camera and selection"]:::todo --> B3["B3 · Political map and map modes"]:::todo --> B4["B4 · Buildings"]:::todo
    B4 --> B5["B5 · Units and war animation"]:::todo --> B6["B6 · Hologram"]:::todo --> B7["B7 · Status visuals, beliefs view"]:::todo --> B8["B8 · Polish and speed"]:::todo
    B9["B9 · Timeline scrubber (stretch)"]:::todo
  end
  subgraph C["Lane C · Interface (@Justin-CODING-PY)"]
    direction TB
    C1["C1 · Create screen"]:::next --> C2["C2 · Nation card"]:::todo --> C3["C3 · Chronicle"]:::todo --> C4["C4 · Network panel"]:::todo --> C5["C5 · Submission"]:::todo
  end
  CP1(["CP1 · First end-to-end"]):::cp
  CP15(["CP1.5 · Wars, resilience, voice"]):::cp
  CP2(["CP2 · Feature freeze"]):::cp
  CP3(["CP3 · Demo and submission"]):::cp
  CP0 --> A1
  A1 -.->|X1, X2 mock| B1
  A1 -.->|X3 mock, X6 stub, X7| C1
  B1 -.->|X5| C2
  A12 -.->|X7 design| C1
  A12 -.->|X7 design| B6
  C2 -.->|NationCard| B6
  A8 -.->|X4| B4
  A6 -.->|war events| B5
  A7 -.->|controls| B7
  A14 -.->|X6| C2
  A5 --> CP1
  A13 --> CP1
  B4 --> CP1
  C2 --> CP1
  A7 --> CP15
  A16 --> CP15
  B7 --> CP15
  C4 --> CP15
  A9 --> CP2
  B8 --> CP2
  CP2 --> C5 --> CP3
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
