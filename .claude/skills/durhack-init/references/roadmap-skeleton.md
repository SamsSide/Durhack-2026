# Roadmap skeleton (what durhack-init / durhack-plan write into docs/roadmap.md)

One `subgraph` per lane, side by side (`flowchart LR` with `direction TB` inside each lane).
Checkpoints are shared nodes outside every lane: each lane's row that a checkpoint needs points
into it, and the first row after it comes out of it. A cross-lane dependency is a dotted arrow
from the giving row to the needing row, labelled with the contract name.

Row ids are the lane letter + number (`A1`, `B3`). Node text: `ID · short name`.
Classes (colour only, no emojis): `done` green, `wip` amber, `next` blue, `todo` grey, `owner` purple (owner decision), `cut` dashed, `cp` checkpoints.

## 2 lanes

```mermaid
flowchart LR
  subgraph A["Lane A · <name> (@<login>)"]
    direction TB
    A1["A1 · …"] --> A2["A2 · …"] --> A3["A3 · …"]
  end
  subgraph B["Lane B · <name> (@<login>)"]
    direction TB
    B1["B1 · …"] --> B2["B2 · …"] --> B3["B3 · …"]
  end
  CP0(["CP0 · Contracts agreed"]):::cp
  CP1(["CP1 · First end-to-end (mocks swapped for real)"]):::cp
  CP2(["CP2 · Demo freeze"]):::cp
  CP0 --> A1 & B1
  A2 --> CP1
  B2 --> CP1
  CP1 --> A3 & B3
  A3 --> CP2
  B3 --> CP2
  A1 -. "contract: <name>" .-> B2
  classDef done fill:#2da44e,color:#fff
  classDef wip fill:#d4a72c,color:#000
  classDef next fill:#0969da,color:#fff
  classDef todo fill:#8c959f,color:#fff
  classDef owner fill:#8250df,color:#fff
  classDef cut stroke-dasharray: 5 5
  classDef cp fill:#fff8c5,stroke:#9a6700,color:#000
```

## 3 lanes — add

```mermaid
flowchart LR
  subgraph C["Lane C · <name> (@<login>)"]
    direction TB
    C1["C1 · …"] --> C2["C2 · …"] --> C3["C3 · …"]
  end
```
with `CP0 --> C1`, `C2 --> CP1`, `CP1 --> C3`, `C3 --> CP2`.

## 4 lanes — add lane D the same way.

## Checkpoints (defaults; durhack-plan sets the times)

| CP | When (hours in) | Means |
| --- | --- | --- |
| CP0 | 1–2 h | Idea, prizes, architecture and `docs/contracts.md` agreed; every lane can start on mocks |
| CP1 | ~10 h | First end-to-end run on `main`: real pieces replace mocks across lanes |
| CP2 | ~18 h | Feature freeze: only fixes, polish, demo script, docs and judge prep after this |
| CP3 | ~22 h | Demo rehearsed, submission (Devpost etc.) filled in, video recorded if needed |
