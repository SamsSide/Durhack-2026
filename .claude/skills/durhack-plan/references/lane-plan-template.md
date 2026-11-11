# Lane <id> plan — <topic>

- **Rows:** <A3, A4>
- **Branch:** `<id>/<topic>`
- **Paths allowed:** `<paths>` (anything else → NEEDS_OTHER_LANE / NEEDS_OWNER)
- **Contracts:** <C1 (implement), C2 (mock)>
- **Done when:** <what runs on main afterwards>

## Task 1: <name>

- **Agent:** durhack-builder | durhack-frontend · **Model:** sonnet | opus
- **Parallel with:** Task 2 (no shared files) | alone
- **Files:** `<path>` (create), `<path>` (modify)
- **Build:** <exact behaviour, values, names>
- **Contract:** <C1 exactly as in docs/contracts.md> | **Mock:** <what and where>
- **Smoke proof:** <what ./check.sh or a one-line command shows>
- **HUMAN_TEST:** <steps a person tries, expected result>

## Task 2: <name>
