# Contracts

*Every interface one lane gives another. Owner-edited (changes go through a `needs-owner`
issue naming every lane affected). Code against these exactly; mock them until CP1.*

## Shared files

| File | Owning lane | Others |
| --- | --- | --- |
| `<e.g. package.json / pyproject.toml>` | a | ask lane a via agent-request |
| `.env.example` | owner | add names via needs-owner |

## Environment variables

| Name | Used by | What |
| --- | --- | --- |
| `EXAMPLE_API_KEY` | lane b | <service> key (each person gets their own) |

## C1 · <name> (lane <giver> gives to lane <taker>)

- **Kind:** HTTP route | function | event | file | websocket message
- **Signature:** `POST /api/<route>` / `def analyse(image: bytes) -> Analysis`
- **Request / input:**
  ```json
  { "example": "value" }
  ```
- **Response / output:**
  ```json
  { "example": "value" }
  ```
- **Errors:** `400 {"error": "..."}` when …
- **Mock:** `<path to mock>` returns the example above (owned by the taker until CP1)
- **Real by:** CP1 · row <ID>
- **Status:** proposed | agreed | built | changed (date, issue #)
