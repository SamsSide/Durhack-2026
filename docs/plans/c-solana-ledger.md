# Lane c plan — Solana ledger, economy counter and treasury link (C9)

- **Rows:** C9 (owner request #144, row A27, MLH Best Use of Solana)
- **Branch:** `c/solana-ledger`
- **Paths allowed:** `web/src/ui/` only
- **Contracts:** X2 `ledger` and `economy` (shapes), X3 `GET /api/economy`, as on main
  (`docs/contracts.md`, PR #142); design notes in `docs/research/solana-economy.md`.
- **Done when:** on `main`, against lane a's mock mode (`SOLANA_MODE=mock`):
  - the network panel has a "Treasury" tab with the counter and a live ledger, and Explorer links
    where `url` is set;
  - the card links to the nation's treasury;
  - everything is hidden when `/api/economy` answers 503 or 404.

Decisions from lane c (14 Nov):
- **Placement:** the ledger lives as a "Treasury" tab inside the network panel, not as a new
  floating panel. `LedgerPanel` and `EconomyCounter` are still exported for anyone else.
- **Data:** the X5 store does not handle the X2 `ledger` and `economy` messages, so poll
  `GET /api/economy` every 2 s, using its `recent`, `totals`, `nations`, `currency` and `mode`. Poll
  only while something that needs it is mounted; share one poller through a small module-level
  store.
- Solana first, then the event feed (C10).

## Shared rules

As in `docs/plans/c-design-restyle.md`: tokens and variables only, the design system's classes
and look (`docs/design/README.md`, `reference.html`), no emojis or new dependencies, the `tn-`
prefix, and keep all existing behaviour. External links open in a new tab with
`rel="noopener noreferrer"`.

## Task 1: the economy data hook and the two components

- **Agent:** durhack-frontend · **Model:** sonnet · **Alone** (it also touches the network panel and
  the card)
- **Files:**
  - create `web/src/ui/economy/useEconomy.ts`, `LedgerPanel.tsx`, `EconomyCounter.tsx`,
    `economy.css`;
  - modify `web/src/ui/network/NetworkPanel.tsx`, `network.css`, `web/src/ui/card/NationCard.tsx`,
    `card.css`;
  - add two export lines to `web/src/ui/index.ts`.
- **useEconomy:**
  - a module-level poller of `GET /api/economy` every 2 s, started by the first subscriber and
    stopped when none are left, exposed with `useSyncExternalStore`;
  - state: `{ status: 'loading' | 'ok' | 'off', data }`;
  - 503, 404 or a network error means `off` (keep retrying every 10 s);
  - keep the ledger rows de-duplicated by `id` (latest wins), newest first, at most 100 (merge
    `recent` across polls so rows that drop out of the last 50 stay for a while);
  - reset when the world id changes.
- **EconomyCounter** (no props):
  - one compact line: the currency symbol, the payment count, the volume (k or M), the mode badge
    (`devnet` gilt, `mock` outlined), the online dot (green or red) and "N pending" when pending is
    above 0;
  - mono numbers;
  - renders nothing when off.
- **LedgerPanel** (no props):
  - a scrolling list, newest first. Each row:
    - the year in rubric mono;
    - the payer's swatch and name, "pays", the payee's swatch and name;
    - the amount with the symbol in mono;
    - the reason in small caps;
    - the italic note;
    - a status chip: queued (outlined), sent (cyan), confirmed (green), failed (red), simulated
      (slate);
    - the short signature (`5Kx…a9Q`) linking to `url`, as plain text when `url` is null.
  - The header has the currency name linking to `currency.url` and the counter.
  - New rows slide in.
  - Empty: italic "No coin has changed hands yet."
  - Hidden when off.
- **NetworkPanel:**
  - two tabs under the title, "Network" (everything today) and "Treasury" (`LedgerPanel`), in
    the design's tab style;
  - the tab choice is remembered in localStorage (try/catch), default "Network";
  - the Treasury tab is hidden when the economy is off;
  - the folded tab also shows the compact `EconomyCounter` when on.
- **NationCard:**
  - under the facts row, a small line "Treasury on Solana" linking to that nation's
    `nations[].url`, showing `onChain` with the symbol and a small "in sync" tick (or "syncing"
    when `inSync` is false);
  - hidden when off or when the nation has no entry.

## HUMAN_TEST

With lane a's mock mode on main:
1. The network panel's Treasury tab shows payments arriving, with `simulated` chips.
2. With `SOLANA_MODE=devnet`, the chips go queued, then sent, then confirmed, and the signature
   opens Solana Explorer.
3. The card's "Treasury on Solana" opens the address and shows in sync.
4. With `SOLANA_MODE=off`, no tab, link or counter appears.
