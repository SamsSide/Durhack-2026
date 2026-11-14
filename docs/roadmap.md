# DurHack 2026 — Roadmap

*What gets built, by which lane, in what order, and the checkpoints where lanes meet.*

> **The owner (SamsSide) edits this file.** Each lane's rows and their status live in
> [`lanes/<lane>.md`](lanes/), which only that lane edits, so four people never fight over one
> table. This file holds the diagram, the checkpoints, *Where we are* and *Up next*.
> Changes from other lanes: a `needs-owner` issue (see `durhack-inbox`).

## Where we are

**Kickoff done, 14 Nov 14:30.** The project is Terra Nova (`hackathon-plan.md`). Contracts X1 to
X5 are agreed. Lane a is building the scaffold and mock server (A1) and the 3D models (A8);
lanes b and c start on the mock as soon as A1 merges.

## Up next, per lane

| Lane | Person | Next row | Waiting on |
| --- | --- | --- | --- |
| a | @SamsSide | A1 scaffold and mock, A8 models | nothing |
| b | @CutGrass88 | B1 app shell, store and first globe | A1 on `main` |
| c | @Justin-CODING-PY | C1 Create screen, C3 lore route | A1 on `main` (C1 also needs B1's app shell) |

## Checkpoints

Assumes hacking ends Sunday 12:00 (not confirmed).

| CP | Time | Means | Status |
| --- | --- | --- | --- |
| CP0 | Sat 15:30 | Plan merged; scaffold and mock server on `main`; every lane building on the mock | wip |
| CP1 | Sat 21:00 | First end-to-end: a prompt makes a world, nations grow live on the globe, a click opens a panel | todo |
| CP1.5 | Sun 02:00 | Wars animate; cut, silence, delete and restore work; real lore, narration and anthem | todo |
| CP2 | Sun 08:00 | Feature freeze: fixes, polish, the saved demo world, docs | todo |
| CP3 | Sun 10:30 | Demo rehearsed three times, submitted | todo |

## The lanes

*One column per person. Dotted arrows are cross-lane needs (contracts X1 to X5).*

```mermaid
flowchart LR
  CP0(["CP0 · Plan and mock on main"]):::cp
  subgraph A["Lane A · World engine and agents (@SamsSide)"]
    direction TB
    A1["A1 · Scaffold, types, mock server"]:::next --> A2["A2 · World generation"]:::todo --> A3["A3 · Simulation tick"]:::todo --> A4["A4 · Nation agents and bus"]:::todo --> A5["A5 · Gemini rulers and budget"]:::todo
    A5 --> A6["A6 · War and diplomacy"]:::todo --> A7["A7 · Cut, silence, delete, restore"]:::todo --> A9["A9 · Replays and demo world"]:::todo
    A8["A8 · Blender models"]:::next
    A10["A10 · Remote agents (stretch)"]:::todo
    A11["A11 · Tiger Data (stretch)"]:::todo
  end
  subgraph B["Lane B · The globe (@CutGrass88)"]
    direction TB
    B1["B1 · App shell, store, first globe"]:::next --> B2["B2 · Camera and selection"]:::todo --> B3["B3 · Borders and labels"]:::todo --> B4["B4 · Buildings"]:::todo
    B4 --> B5["B5 · Units and war animation"]:::todo --> B6["B6 · Status visuals, beliefs view"]:::todo --> B7["B7 · Polish and speed"]:::todo
  end
  subgraph C["Lane C · Story, sound, interface (@Justin-CODING-PY)"]
    direction TB
    C1["C1 · Create screen"]:::next --> C2["C2 · Nation panel"]:::todo --> C3["C3 · Lore route"]:::todo --> C4["C4 · Narration"]:::todo
    C4 --> C5["C5 · Anthem"]:::todo --> C6["C6 · Chronicle"]:::todo --> C7["C7 · Network panel"]:::todo --> C9["C9 · Submission"]:::todo
    C8["C8 · Image input (stretch)"]:::todo
  end
  CP1(["CP1 · First end-to-end"]):::cp
  CP15(["CP1.5 · Wars, resilience, voice"]):::cp
  CP2(["CP2 · Feature freeze"]):::cp
  CP3(["CP3 · Demo and submission"]):::cp
  CP0 --> A1
  A1 -.->|X1, X2 mock| B1
  A1 -.->|X1, X2 mock| C1
  B1 -.->|X5| C2
  A8 -.->|X4| B4
  A6 -.->|war events| B5
  A7 -.->|controls| B6
  A7 -.->|controls| C7
  A5 --> CP1
  B4 --> CP1
  C3 --> CP1
  A7 --> CP15
  B6 --> CP15
  C7 --> CP15
  A9 --> CP2
  B7 --> CP2
  CP2 --> C9 --> CP3
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
