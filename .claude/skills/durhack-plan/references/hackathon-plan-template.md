# DurHack 2026 — <project name>

*Owner-edited. How the project works lives in `documentation.md`; what's next lives in `roadmap.md`.*

## 1. The idea

<Two or three sentences: the problem, who has it, what we built.>

## 2. The demo (2 minutes)

1. <What the judge sees first>
2. <…>
3. **The moment:** <the one thing that wins it>

Backup plan if live fails: <recorded video / seeded data / offline mode>.

## 3. Prizes we're going for

| Prize | Why we qualify | What it needs from us | Lane / row | Submission field |
| --- | --- | --- | --- | --- |
| Main track: <track> | | | | |
| <Sponsor prize> | | <use API X, mention Y> | c / C4 | |

Full research: `prizes/matrix.md`.

## 4. Architecture

```mermaid
flowchart LR
  UI["Frontend (lane c)"] -->|C1 POST /api/...| API["Backend (lane a)"]
  API -->|C2 analyse()| AI["AI / algorithms (lane b)"]
```

- **Stack:** <languages, frameworks, versions>
- **Run:** `<command>`
- **Hosting for the demo:** <laptop / URL>
- **External services:** <APIs, keys needed (names only)>

## 5. Lanes

| Lane | Person | Owns (paths) | Delivers |
| --- | --- | --- | --- |
| a | @ | | |

## 6. Schedule

| Time | Checkpoint | Means |
| --- | --- | --- |
| | CP0 | Contracts agreed, everyone building on mocks |
| | CP1 | First end-to-end on main |
| | CP2 | Feature freeze |
| | CP3 | Demo rehearsed, submitted |
| | Judging | |

## 7. Risks and cuts

| Risk | If it happens |
| --- | --- |
| | |

Cut order if behind: <list>.
