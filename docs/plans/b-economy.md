# Lane b plan: the economy (B10 to B13)

- **Rows:** B10 devnet hardening, B11 economy depth in the sim (the core five, designed in `docs/research/economy-games.md`; contract changes wait on the owner), B12 economy on the globe, B13 the 15-second Solana beat
- **Branch:** one per task, `b/<task>` (names below)
- **Paths allowed:** `server/src/chain/`, `packages/shared/src/sim/payments.ts`, `packages/shared/src/sim/trade.ts`, `scripts/solana-keys.ts`, `server/scripts/check-money.ts`, `web/` except `web/src/ui/`, `web/src/audio/`, `web/src/theme/`, `web/public/models/`. Anything else: NEEDS_OTHER_LANE or NEEDS_OWNER.
- **Contracts:** X1 `payment` and `PaymentReason` (implement, no change unless flagged), X2 `ledger` / `economy` (read), X3 `GET /api/economy` (read), X5 `mapMode` (change flagged)
- **Background:** `docs/research/solana-economy.md`, `docs/decisions.md` 17:50 and 19:20, issue #183, owner question #187
- **Done when:** on `main`, a nation founded mid-game pays and is paid on devnet; the globe shows trade routes, coin bursts and (if #187 says yes) a wealth mode; clicking a gold arc opens the transaction on Solana Explorer with a readable memo.

## Where we start

The owner ran PR #180 on devnet with a funded wallet (comment on #183): genesis ok, 35 payments in
39 transactions, 6 nations with drift 0, supply conserved at 1,000,000 TNC, no 429, WebSocket or
compute-unit errors. So the bridge works. What is left for devnet is the gap the run did not hit:
**a nation founded after genesis has no token account**, so `canMove` is false and its payments
are recorded as confirmed with no signature (`settle.ts` line ~295). Plus our own laptop's run.

## B11: the core five (designed, contract changes pending)

Design: [`docs/research/economy-games.md`](../research/economy-games.md) section 3 (rules, numbers,
build order). Tasks 2, 3 and 4 below are the earlier small ideas, kept for reference only: **do not
dispatch them** (the goods market replaces Task 2, loans stay with #187). The contract changes are
in needs-owner #204 (fields on `World` and `Country`, `applyEvent` folding, X5 `'politics'`, and
whether lane b may write the `rules.ts` and `world.ts` hooks itself).

**After every sim task (B11-1 to B11-4, B11-7), quoted in the PR besides `./check.sh`:**
`npx tsx server/scripts/check-money.ts` prints `MONEY CONSERVED` and
`npx tsx server/scripts/check-replay.ts` passes.

| Task | Agent | Branch | Files | Blocked on | Parallel with |
| --- | --- | --- | --- | --- | --- |
| B11-1 Pure core | builder, sonnet | `b/economy-core` | `packages/shared/src/sim/economy.ts` (create; new lane b path, named in the issue), `packages/shared/src/index.ts` (one export line) | nothing: code against the proposed optional fields locally | B11-5 |
| B11-2 Types and devastation | builder, sonnet | `b/economy-types` | `packages/shared/src/types.ts`, `packages/shared/src/world.ts` | owner answer | B11-1, B11-5 |
| B11-3 Hooks in the turn | builder, sonnet | `b/economy-hooks` | `packages/shared/src/sim/rules.ts` | owner answer, B11-1, B11-2 | B11-5 |
| B11-4 Market replaces trade dues | builder, sonnet | `b/goods-market` | `packages/shared/src/sim/payments.ts` | B11-1 | B11-2, B11-5 |
| B11-5 Globe | frontend, sonnet | `b/economy-globe` | `web/src/globe/mesh/colors.ts`, `web/src/globe/Globe.tsx`, `web/src/globe/economy/Readiness.tsx` (create), `web/src/state/world.ts`, `web/src/hud/TopBar.tsx` | X5 `'politics'` for the map mode; the tint and ring start on mock values | B11-1 to B11-4 |
| B11-6 Nation card | lane c | (theirs) | `web/src/ui/` | owner answer | all; agent-request to lane c after B11-2 merges |
| B11-7 Balance pass | builder, sonnet | `b/economy-balance` | constants in `sim/economy.ts` only | B11-3, B11-4 | B11-5 |

- **B11-1:** `goodOf(world, tile)`, `PRICE_BASE`, `outputMul(D, WR)`, `needs(world, id)`,
  `prices(world)`, `marketPlan(world)` (seller surplus split by buyer deficit, war and embargo
  blocks, far-left half volume), `readinessStep(...)`, `politicsStep(...)`, `movementOf(axis)`,
  `devastationTick(world)`. Pure, `hashString` only. Smoke proof: `./check.sh`.
- **B11-2:** add `World.devastation?`, `Country.warReadiness?`, `Country.politics?` exactly as
  approved; in `applyEvent`: `battle` +20 on its tile, `tile_claimed` conquest +10, `tick` +5 per
  enemy army on a tile then -3 on every tile, clamp 0..100. Smoke: the three gates.
- **B11-3:** in section 5 multiply each province's income by `outputMul`, the population cap by
  `1 - D/200`, army upkeep by `1 - 0.2 x WR/100`; add `warReadiness` and `politics` to the yearly
  `country_updated` patch; one chronicle line when a far movement takes power. Day one must give
  the same treasuries as before (compare `check-money` totals at tick 1). Smoke: the three gates.
- **B11-4:** delete rule 2 (trade dues); add the market settlement every 5 years per buyer
  (`(tick + me) % 5 === 0`), one merged `trade` payment per seller, capped at 15% of the treasury,
  note `"6 grain, 2 ore"`. Smoke: the three gates; `check-money` shows `trade` payments.
- **B11-5:** devastation tint on every tile, the readiness ring at the capital (Mobilised and
  above), the Politics map mode (red, gold, black; brightness by radicalism). Smoke: `./check.sh`.
  HUMAN_TEST: `npm run mock` through a war: burnt tiles at the front, a red ring, colours shifting
  in Politics mode.
- **B11-7:** run `check-money 600` on two seeds; tune so prices stay inside 60% to 160% of base in
  peace and a war moves a good past 140%; no nation spends more than 15% a settlement.

**Batches.** Now: B11-1 and B11-5 (mock values). After the owner answers: B11-2 (or lane a), then
B11-3 and B11-4 together (different files). Then B11-7 and the agent-request to lane c and lane a
(digest line). Target: on `main` by about 01:00, before CP2.

## Flags

| Task | (a) Human | (b) Contract change | (c) Lane a hook |
| --- | --- | --- | --- |
| 1 Late wallets | yes: fund the Commons, run devnet | no | no |
| 2 Docking pays | no | no (`trade` reason) | no (`tradeTurn` already gets `emit`) |
| 3 Tribute | no | no (`reparations` reason) | no (`paymentTurn` already gets `ledger`) |
| 4 Loans and defaults | no | **yes**: `loan`, `repayment` in X1 (now with #187, outside the core five) | **yes**: pass a loan memory from `rules.ts` |
| 5 Routes and coin bursts | no | no | no |
| 6 Wealth mode | no | **yes**: `wealth` in X5 `mapMode`, #187 | no |
| 7 Arc click to Explorer | yes: human test on devnet | no | no |

**Every sim task (2, 3, 4) must pass both, quoted in the PR, besides `./check.sh`:**
`npx tsx server/scripts/check-money.ts` (prints `MONEY CONSERVED`) and
`npx tsx server/scripts/check-replay.ts` (the replay matches).

## Parallel batches

- **Batch 1 (now):** Task 1, Task 5, Task 7. No two share a file.
- **Batch 2 (after #187 is answered):** Task 6 (wealth mode).
- **Not dispatched:** Tasks 2, 3, 4 (superseded by the B11 tasks above).

## Task 1 (B10): wallets for nations founded after genesis

- **Agent:** durhack-builder · **Model:** sonnet · **Branch:** `b/late-wallets`
- **Parallel with:** 2, 3, 5, 7 (only `server/src/chain/`)
- **Files:** `server/src/chain/index.ts`, `server/src/chain/settle.ts`, `server/src/chain/mock.ts`, `server/src/chain/genesis.ts` (modify)
- **Build:**
  - In the chain module's event listener, on `country_founded` (live runs only, never in playback), queue a "open account" job for `country.id`.
  - Devnet backend: if `nation-NN.json` exists for that id (`nationKeyFile`, up to `MAX_NATION_WALLETS` = 12), create its Token-2022 associated token account with the Commons as fee and rent payer, in its own transaction, with the memo `TN open <country name>`. Same backoff, breaker and polling as payments. Once confirmed, `canMove(id)` turns true.
  - No float for a late nation: its first outgoing payment uses the existing Commons advance path. Its ledger float is 0.
  - Rows for that nation queued before the account confirms stay `queued` (not marked confirmed with no signature) until the account exists, then settle normally. Rows for a nation with no key file (id 12 or over) keep today's behaviour and log once: `chain: nation <id> has no wallet file`.
  - Mock backend: `canMove` true for every founded nation, fake address.
  - Address appears in `GET /api/economy` like the genesis nations.
  - For B13: make the memo name the nations. `memoFor` in `settle.ts` becomes `TN <id> y<year> <payer> pays <payee> <amount> TNC, <reason>: <note>` (names without a leading "The"), still under `MEMO_MAX`, still ASCII only.
- **Contract:** X2, X3 unchanged. **Mock:** the mock backend.
- **Smoke proof:** `./check.sh`; `npx tsx server/scripts/check-money.ts` still `MONEY CONSERVED`.
- **HUMAN_TEST:** (needs Task 0 below) run `SOLANA_MODE=devnet npm run dev`, play until a secession founds a nation (or use a decree that splits a nation), wait 10 s, open its row in the ledger panel: it has a signature and the Explorer page shows `TN open <name>` then its payments.

### Task 0 (human, before Task 1's test): fund our laptop's devnet wallets

An agent cannot do this (the faucet refuses AI agents).
1. `npx tsx scripts/solana-keys.ts` (prints the Commons address; keys go in the git-ignored key folder).
2. Fund that address at https://faucet.solana.com (sign in with GitHub for more; 2 requests every 8 hours), or `solana airdrop 2 <ADDR> --url devnet`. About 0.1 SOL is plenty per world; ask for 2.
3. Put `SOLANA_MODE=devnet` in `.env`, run `npm run dev`, watch the server log for `chain:` lines and the ledger panel turning rows `confirmed`.
4. If any row fails with a compute-unit error, raise `CU_PER_TRANSFER` in `server/src/chain/settle.ts` (owner's run saw none).

## Task 2 (B11): a merchant ship's cargo is paid for (design pending, do not dispatch)

- **Agent:** durhack-builder · **Model:** sonnet · **Branch:** `b/docking-pays`
- **Parallel with:** 1, 3, 5, 7 (only `trade.ts`)
- **Files:** `packages/shared/src/sim/trade.ts` (modify)
- **Build:** in `tradeTurn` section 1 (foreign ships docked at my port, counted once each), the host also buys the cargo: `emit({ type: 'payment', from: me, to: u.owner, amount, reason: 'trade', note })` with `amount = coins(min(c.treasury * 0.03, 6 + 2 * ageIndex(shipper age)))`, skipped when under 1 coin or the host's treasury is under 20. `note` = `"<cargo> by <ship>"` using the same `CARGO` and `SHIP` tables and hash as the shipper's chronicle line (so the ledger and the chronicle agree, e.g. `pepper and cloves by merchant cog`). Keep the existing `tradeBonus` income for both sides. Deterministic: hashes only, no `Math.random`.
- **Contract:** X1 `payment` with reason `trade` (exists).
- **Smoke proof:** `./check.sh`; `check-money` prints a `trade` line with more payments than before and `MONEY CONSERVED`; `check-replay` passes.
- **HUMAN_TEST:** `npm run mock`, wait for a ship to dock: a gold arc from the port's nation to the shipper's capital, and a ledger row "pepper and cloves by merchant cog".

## Task 3 (B11): tribute from a beaten nation (design pending, do not dispatch)

- **Agent:** durhack-builder · **Model:** sonnet · **Branch:** `b/tribute`
- **Parallel with:** 1, 2, 5, 7 (only `payments.ts`)
- **Files:** `packages/shared/src/sim/payments.ts` (modify)
- **Build:** a new section after reparations. For each `neutral` relation of `me` whose peace came after a war where `me` lost 3 or more provinces net (from `ledger`: `lost - gained >= 3`), pay tribute every 5 years for 20 years after the treaty: on ticks `since + 5k`, k = 1..4, while the stance stays `neutral` and both are alive. Amount `share = min(0.15, 0.04 + 0.01 * (lost - gained))` of treasury. Reason `reparations`, note `tribute under the Treaty of <place> (k of 4)` (reuse `treatyPlace`). Chronicle line on k = 1 only: `<me> sends its first tribute to <foe>: {amt} crowns.`
- **Contract:** X1 `payment` with reason `reparations` (exists).
- **Smoke proof:** `./check.sh`; `check-money` shows more `reparations` payments and `MONEY CONSERVED`; `check-replay` passes.
- **HUMAN_TEST:** `npm run mock` at high speed through a war and peace: four tribute rows over the following years, each an arc loser to winner.

## Task 4 (B11, optional, cut first): loans and defaults (design pending, do not dispatch)

- **Blocked on:** the B11 design. Starts after Task 3 merges (same file).
- **Agent:** durhack-builder · **Model:** sonnet · **Branch:** `b/loans`
- **Files:** `packages/shared/src/sim/payments.ts` (modify), `packages/shared/src/types.ts` (add the two reasons, as the owner approves), `packages/shared/src/sim/rules.ts` (one line: pass `ctx.loans` to `paymentTurn`, add `loans: new Map()` beside `ctx.wars`; name this hook in the PR, lane a owns the file)
- **Build:** a rich nation (treasury >= 150) lends 15% of its treasury to a trade or alliance partner under 40 (hash roll 0.05 per year); the borrower repays 1/5 plus 10% interest every 5 years (`repayment`); if it cannot (treasury under the instalment) it defaults: chronicle `<borrower> defaults on its debt to <lender>`, grievance up through the existing relation path, loan dropped. Loan memory lives in `ctx.loans` on each replica, keyed by the lender's `loan` event, so replays rebuild it.
- **Smoke proof:** `./check.sh`, `check-money` (`loan` and `repayment` lines, `MONEY CONSERVED`), `check-replay`.
- **HUMAN_TEST:** in `npm run mock`, a loan row, later repayment rows or a default line in the chronicle.

## Task 5 (B12): trade routes and coin bursts

- **Agent:** durhack-frontend · **Model:** sonnet · **Branch:** `b/trade-routes`
- **Parallel with:** 1, 2, 3, 7 (new files plus `Globe.tsx`)
- **Files:** `web/src/globe/trade/Routes.tsx` (create), `web/src/globe/trade/CoinBurst.tsx` (create), `web/src/globe/Globe.tsx` (mount both next to `<Trade />`)
- **Build:**
  - Routes: for every relation with stance `trade` (pale gold, dashed) or `alliance` (gold, solid), a thin great-circle line between the two capitals, lifted like the payment arcs (copy `capitalPoint` and `arcPoints` from `Trade.tsx` into `Routes.tsx`; do not edit `Trade.tsx`, Task 7 owns it). Opacity 0.35, rebuilt only when `world.relations` changes. Hidden in terrain mode.
  - Coin bursts: when a ledger row with reason `plunder` or `seizure` first appears (any status), 12 to 20 small gold coin sprites spring from the payer's capital (seizure) or the payer's nearest owned tile to the payee's capital (plunder), arc up and fall over 1.2 s, then vanish. A pool of 3 bursts. Respect reduced motion (single flash instead).
- **Contract:** X1 `relations`, X2 `ledger` (read only).
- **Smoke proof:** `./check.sh` (typecheck and web build).
- **HUMAN_TEST:** `npm run mock`: faint lines join trading and allied capitals; when a city is sacked, coins spring from it.

## Task 6 (B12): wealth map mode

- **Blocked on:** #187.
- **Agent:** durhack-frontend · **Model:** sonnet · **Branch:** `b/wealth-mode`
- **Parallel with:** everything else (files no other task touches)
- **Files:** `web/src/state/world.ts` (add `'wealth'` to `mapMode`), `web/src/hud/TopBar.tsx` (a "Wealth" button), `web/src/globe/mesh/colors.ts` (colour per nation)
- **Build:** each nation's provinces coloured on a dark bronze to bright gold scale by `treasury`, log scale between the poorest and richest living nation; unclaimed land grey. A small legend (poor to rich, with the two end values). Recolours when a `country_updated` or `payment` changes a treasury (same path as the strength mode).
- **Contract:** X5 `mapMode` plus `'wealth'` (after #187).
- **Smoke proof:** `./check.sh`.
- **HUMAN_TEST:** click Wealth: the richest nation is the brightest; after a seizure the conqueror brightens and the fallen nation's land changes colour.

## Task 7 (B13): the 15-second Solana beat

- **Agent:** durhack-frontend · **Model:** sonnet · **Branch:** `b/arc-to-explorer`
- **Parallel with:** 1, 2, 3 (only `Trade.tsx`) and 5. Task 5 copies its helpers and never edits `Trade.tsx`.
- **Files:** `web/src/globe/trade/Trade.tsx` (modify). The readable memo is built in Task 1.
- **Build:** keep each finished arc visible for 6 s instead of 2 s at reduced opacity, and make it clickable (pointer cursor on hover, a small label at the arc's top: `<amount> TNC · <note>`). Clicking opens the row's `url` in a new tab (`window.open(url, '_blank', 'noopener')`). Rows without a `url` (mock) show the label but do not open. Pointer events must not block tile picking when no arc is under the cursor.
- **Contract:** X2 `ledger.url` (read).
- **Smoke proof:** `./check.sh`.
- **HUMAN_TEST (devnet, after Task 0):** a payment fires, click its gold arc, the Explorer page opens on devnet and the memo reads "The Vale pays the Ashen Concord 120 TNC, reparations: Treaty of Hatfield". Time it: under 15 seconds from arc to memo.

## Not in this plan

- The demo recording and its `server/replays/<worldId>.ledger.json` sidecar stay with lane a.
- `LedgerPanel` and the nation card's wallet line are lane c's; no change needed.
- Embargoes: low demo value (trade dues already stop when a pact ends). Cut.
