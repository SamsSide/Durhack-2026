# Terra Nova's economy on Solana devnet (MLH Best Use of Solana)

Researched 14 Nov 2026 for the owner. Builds on `docs/prizes/P4-solana.md` (rules, judging
inferences, past winners); this file does not repeat them. Sources are the Solana docs source on
GitHub (`solana-foundation/solana-com`, read 14 Nov 2026), the npm registry (versions read 14 Nov
2026), the package type definitions, and the official faucet page. Anything not confirmed there is
marked "unconfirmed".

## 0. The answer in five lines

- Put **one world currency** on devnet as a Token-2022 token with on-chain name and symbol, a
  **fixed supply** (mint authority revoked at genesis), one **wallet per nation** and one for the
  **Commons** (nature, unclaimed land).
- The **simulation stays the source of truth**; the chain is an asynchronous **mirror** that settles
  money every 5 seconds. Replays stay exact and the sim never waits for the network.
- Every flow between nations (trade, reparations, plunder, a fallen nation's treasury seized) is a
  real token transfer **signed by the paying nation's own key**, with a memo naming the event.
- About **0.3 to 1 transaction a second**, well inside public devnet limits. About 0.04 SOL per
  world.
- About **8 to 11 agent hours** across three lanes. The biggest risk is not Solana: the sim has no
  money flows between nations yet, and adding them means touching the treasury rules.

## 1. What the code does today (read before designing)

- `Country.treasury` is a plain number. Each nation's turn (`packages/shared/src/sim/rules.ts`,
  section "5. money and people") adds terrain and building income, subtracts unit upkeep and a 1%
  decay, and emits `country_updated` with the **absolute** new treasury.
- **No money moves between nations.** A trade pact (`war.ts`, section 4) is only a stance. Peace
  treaties (`war.ts`, section 2) cede provinces, not money. Battles (`settleMove`) capture tiles and
  raze buildings, but take no gold. `UnitKind` has `trader` in the contract, but nothing in `sim/`
  spawns traders yet (grep for `trader` finds nothing in `packages/shared/src/sim/`).
- Events are applied in `applyTickBatch` (`sim/sync.ts`) in order of `lamport`, then actor. The
  runner (`server/src/engine/runner.ts`) applies each tick's batch to the true world and sends it to
  listeners through `subscribe({ events })`.
- `server/src/tiger/index.ts` (`bindTiger(runner)`) is already the right pattern for a side module:
  off unless an env var is set, buffers, never blocks the tick loop, never throws, skips playback.

So "the economy on Solana" needs two things: new **payment** events in the sim (deterministic, in
the log), and a chain module that mirrors them.

## 2. Architecture options, cheap to deep

| Opt | What | Agent hours | Judge credibility | Risk |
| --- | --- | --- | --- | --- |
| A | Memo log: every treaty, war and payment writes a memo from one server wallet | 2 | Low to medium ("a database with extra steps") | Low |
| B | **World currency + nation wallets.** One SPL token, a wallet per nation and the Commons; trade, reparations, plunder, seizure are transfers with memos | 5 to 7 (plus sim rules) | High: real tokens, real signers, every flow on Explorer | Medium |
| C | B plus Token-2022 extras: on-chain name and symbol (metadata), memo required on every incoming payment (memo-transfer), fixed supply (mint authority revoked); optional tariff (transfer fee) | +1.5 to 3 | Higher: "the chain enforces it, not our code" | Low to medium |
| D1 | One currency per nation; exchange rates computed by the sim (a pure function of treasury, land, war) | +4 to 6 | High, very visual (a currency crashes after a defeat) | Medium: N x N token accounts, rate logic |
| D2 | D1 with real pools on devnet (Orca Whirlpools splash pools between nation currencies) | +8 to 12 | Highest for the "DEX" line of the brief | High (see below) |
| E | A small Anchor program: nation PDAs, war chest escrow, `settle_peace` releasing it | 8 to 12 | High ("Solana-native program") | High: Rust, deploy SOL, client generation |
| F | ZK compressed tokens or state | not worth it | Medium | We have about 15 token accounts; compression saves nothing that matters |

Notes per option:

- **A** is what P4 calls "credible to qualify, thin to win".
- **B and C** use only programs already on devnet (Token-2022, Associated Token, Memo, System), so
  no Rust. Kit has generated clients for all of them (section 5).
- **Token-2022 features, which ones earn their place:**
  - *Metadata* (`MetadataPointer` + `TokenMetadata`): the currency shows its name and symbol on
    Explorer. Cheap; do it. [docs](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/extensions/metadata.mdx)
  - *Memo transfer* (an account extension): "requires a memo instruction immediately before any
    incoming transfer to that token account". So the chain itself refuses a payment that does not
    say why. Good talking point, about 30 minutes. [docs](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/extensions/memo-transfer.mdx)
  - *Fixed supply*: set the mint authority to none after genesis. Anyone can check on Explorer that
    nobody, us included, can print money. Free.
  - *Transfer fee* = a world tariff on every cross-border payment, withheld for the Commons. Nice
    story, but the sim must then compute the same fee or balances drift. Optional, cut first.
    [docs](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/extensions/transfer-fees.mdx)
  - *Interest-bearing* for national debt: the docs say it "does not add more tokens to token
    accounts over time"; only the displayed amount grows. Cosmetic; skip.
    [docs](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/extensions/interest-bearing-tokens.mdx)
  - *Transfer hooks* need our own program (option E). Skip.
- **D2, why it is risky:** `@orca-so/whirlpools` 8.0.1 is built on Kit and supports
  `setWhirlpoolsConfig("solanaDevnet")` ([Orca docs](https://dev.orca.so/SDKs/Environment%20Setup)),
  but its peer dependency is `@solana/kit ^5.0.0` while the token clients need `^8.5.0` (npm, 14 Nov),
  so npm will refuse the install without overrides. Each pool needs SOL for setup and seeded
  liquidity, and prices only move when someone swaps, so the sim would have to drive swaps.
  Raydium's SDK v2 is still on web3.js 1.x. The old SPL token-swap program's JS client is web3.js
  1.x and the program's devnet status is unconfirmed. A server-side, deterministic exchange rate
  (D1) gives 80% of the story for a third of the work.
- **E, feasibility:** Solana Playground (`beta.solpg.io`) builds and deploys Anchor from the
  browser, no local Rust ([Anchor docs](https://anchor-lang.com/docs/quickstart/solpg)). The
  official skill targets Anchor 1.2.x with Codama to generate a Kit client. But the Anchor TS
  packages (`@coral-xyz/anchor` 0.32.1, `@anchor-lang/core` 1.2.2) still depend on web3.js 1.x, so
  a Kit server would need a Codama client. Deploying needs devnet SOL roughly proportional to
  program size (exact amount unconfirmed; budget 2 to 4 SOL), and the faucet gives 2 requests every
  8 hours. A war chest works well enough without a program: a second token account per nation.
  Not for this weekend.

## 3. Volume, rate limits and where the truth lives

### 3.1 Limits (confirmed)

- Public devnet `https://api.devnet.solana.com`, per IP: 100 requests per 10 s; 40 per 10 s for a
  single RPC method; 40 concurrent connections; 40 connections per 10 s; 100 MB per 30 s.
  [clusters.mdx](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/references/clusters.mdx).
  Devnet "may be subject to ledger resets".
- Transaction size: 1,232 bytes. Accounts per transaction: 64 (96 for v1).
  [transactions](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/core/transactions/index.mdx).
- Fees: 5,000 lamports per signature plus an optional priority fee (CU price x CU limit / 1M).
  [fee-structure](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/core/fees/fee-structure.mdx).
- Faucet ([faucet.solana.com](https://faucet.solana.com/), read 14 Nov): "Maximum of 2 requests every
  8 hours", higher if signed in with GitHub (amount not stated), and "AI agents should not use this
  faucet". A human funds the wallets. Alternatives it lists: `solana airdrop 2 <ADDR> --url devnet`,
  the `devnet-pow` miner. Other faucets: QuickNode, DevnetFaucet.org, SolFaucet
  ([cookbook](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/cookbook/development/airdrops-and-faucets.mdx)).
- Helius Free: 10 requests a second, 1 `sendTransaction` a second
  ([Helius](https://www.helius.dev/docs/billing/rate-limits)); devnet on Free is unconfirmed. Keep
  it as a spare endpoint behind `SOLANA_RPC_URL`.

### 3.2 What goes on chain

The sim makes 15 to 40 events a second; almost none are money. Only **money that changes hands**
goes on chain, netted per 5-second window (wall clock, not ticks: at 64x speed 10 ticks is 80 ms):

| Flow | Sim trigger (new) | On chain | Signer |
| --- | --- | --- | --- |
| Trade | Each trade pact settles every 10 years: the nation with fewer ports and factories pays the other for its goods (later: a trader ship docking) | transfer + memo | payer nation |
| Reparations | A peace treaty where one side lost ground: the loser pays a lump sum (a share of its treasury, scaled by provinces lost) | transfer + memo naming the treaty | loser |
| Plunder | A battle that captures a town, city or capital: the attacker takes a share of the defender's treasury | transfer + memo naming the place | defender (its agent signs the surrender) |
| Seizure | `country_fell`: all of the fallen nation's treasury to its conqueror | transfer + memo | fallen nation, its last act |
| Income and spending | Already in the sim (`country_updated`) | one net transfer with the Commons per nation, every 15 s, only if the gap is over 1 coin | Commons (income) or nation (spending) |
| War chest (phase 3) | On declaring war, a nation locks 20% into its chest; released on peace | transfer to its own second account | the nation |

Budget: about 2 to 6 netted transfers per window, packed 3 or 4 per transaction (each nation that
signs adds 64 bytes; memos about 60 bytes each), so 1 to 2 transactions every 5 s, about 0.3 tx/s.
Hard cap: 6 transactions per window; anything over is netted into the next window. With RPC calls
per transaction (blockhash, simulate, send, status) that is under 30 requests per 10 s, a third of
the public limit, and inside Helius Free's 1 send a second.

- **Batching:** the Kit planner packs a list of instructions into as few transactions as fit
  (`client.sendTransactions`; `sendTransaction` throws if the plan needs more than one).
  [client.mdx](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/frontend/client.mdx).
- **Fewer RPC calls:** the planner simulates each transaction to estimate compute by default; the
  type definitions of `@solana/kit-plugin-rpc` 0.23.0 show an `estimateResourceLimits: false`
  option to skip that and send with a fixed limit. Use it if we approach limits.
- **Priority fees:** not needed on devnet (the planner supports them; leave them at zero, add one
  only if transactions stop landing).
- **Address lookup tables** would shrink transactions further; not needed at this volume.
- **One fee payer:** the Commons key pays every fee and all rent; nation keys only sign as token
  owners. So only one wallet needs SOL.

### 3.3 When the RPC is down, the sim never stalls

- The chain module only listens to `runner.subscribe({ events })`. All network work is async,
  wrapped in try/catch, with no await on the tick path (same rules as Tiger).
- A queue holds pending payments, netted per (from, to, reason) so it cannot grow without bound.
  After 5 failures in a row a breaker pauses sending for 30 s; the panel shows "ledger offline,
  N payments waiting". On recovery the backlog settles in a burst.
- Retries: if a send fails with an expired blockhash, first check `getSignatureStatuses` for the
  old signature; resend only if it did not land, so a payment is never paid twice.
- Every 30 s the module reads all nation balances in one `getMultipleAccounts` call (the token
  client's `fetchAllToken`, or similar) and corrects drift with a Commons transfer.

### 3.4 The chain is a mirror, not the source of truth (argued)

- **For a mirror:** exact replay is a core promise of the project (demo backup, the timeline
  scrubber). A ruler, a battle or a treaty cannot wait 1 to 2 s for confirmation inside a 500 ms
  tick, let alone a 64x tick. Agents also need balances synchronously to decide. If the chain held
  the balances, a devnet outage would freeze the world on stage.
- **What makes the mirror honest:** payments are events in the log (`payment`, computed by the
  payer's own turn or by the pure battle rules), so the world records the debt before the chain
  settles it. The chain then proves it was paid, by whom, and when. Balances match because the
  Commons true-up keeps the on-chain balance equal to the sim's treasury (shown as "in sync" per
  nation).
- **Replays:** in playback the module sends nothing (like Tiger). For the saved demo world, keep
  a sidecar `server/replays/<id>.chain.json` (event id to signature) recorded on a live run, so the
  replay's ledger panel still opens real Explorer links (they stay valid until devnet resets).
- **Ties into the resilience demo:** a cut nation's events, payments included, wait in the bus
  queue; on chain nothing moves for it. On restore its debts settle in one burst, with a chronicle
  line. The Silence becomes visible on Explorer.

## 4. What the judges see

- **Ledger panel** (lane c): a scrolling list, newest first: "Year 1052 · Treaty of Hatfield ·
  The Vale pays the Ashen Concord 120 crowns · confirmed", each row linking to
  `https://explorer.solana.com/tx/<sig>?cluster=devnet`. Queued and sent rows show a spinner.
- **Token-flow arcs on the globe** (lane b): a gold arc from payer capital to payee capital when a
  payment confirms, thicker for larger sums. Clicking it opens the transaction.
- **Nation wallet:** a "Treasury on Solana" line on the nation card, linking to
  `https://explorer.solana.com/address/<wallet>?cluster=devnet`. Explorer's token page also lists
  the largest holders, a free world rich-list (layout on Explorer for Token-2022 metadata:
  unconfirmed, check on the day).
- **Counters** in the top bar: payments settled, total volume in coins, total fees in SOL ("this
  world's economy cost 0.006 SOL"). This pairs with the token meter close in the demo.
- **One sentence, checked against our architecture.** The draft "independent agents that do not
  trust each other settle debts without a referee" fits the no-controller design, but a judge
  will ask "you hold all the keys on one laptop?". The honest version:

  > "Every AI nation holds its own wallet and signs only its own payments; Solana is the ledger
  > none of them controls, so rivals settle reparations and plunder in under a second with no
  > central bank, and the supply is fixed, so nobody, not even us, can print money. Anyone can
  > audit this world's economy on Explorer."

  Back it with: one key per nation, used only for that nation's outgoing payments; mint authority
  "none" visible on Explorer; and "the agents already run as if on separate machines (cut, delete
  and restore), and the wallets work the same way".

## 5. Libraries and setup (exact, 14 Nov 2026)

| Package | Version | Use |
| --- | --- | --- |
| `@solana/kit` | 8.6.0 | core: `createClient`, signers, addresses, `airdropFactory`, `sendAndConfirmTransactionFactory` |
| `@solana/kit-plugin-rpc` | 0.23.0 | `solanaDevnetRpc()`, `solanaRpc({ rpcUrl, rpcSubscriptionsUrl })`, planner and executor |
| `@solana/kit-plugin-signer` | 0.23.0 | `signer()`, `payer()`, `signerFromFile(path)` (Node) |
| `@solana-program/token-2022` | 0.20.1 | `token2022Program()`, `extension(...)`, `getInitializeTokenMetadataInstruction`, `getEnableMemoTransfersInstruction`, `getTransferToATAInstructionPlan`, `getMintToATAInstructionPlan`, `getCreateMintInstructionPlan`, `getTransferCheckedWithFeeInstruction` |
| `@solana-program/memo` | 0.16.0 | `getAddMemoInstruction({ memo })` |
| `@solana-program/token` | 0.18.0 | only if we pick the classic token program instead of Token-2022 |

All the `@solana-program/*` packages declare a peer dependency on `@solana/kit ^8.5.0`.
`@solana-program/token-2022` also wants `@solana/sysvars ^8` and `@solana/zk-sdk ^0.5.4` as
peers (check that npm resolves them; unconfirmed whether it pulls zk-sdk in). Adding any of these
is a new dependency: a `needs-owner` decision.

**Client and send-and-confirm** (from the Solana docs, `client.mdx` and `transfer-tokens.mdx`):

```ts
import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { signerFromFile } from '@solana/kit-plugin-signer';
import { token2022Program } from '@solana-program/token-2022';

const client = await createClient()
  .use(signerFromFile(`${KEYS}/commons.json`))   // fee payer: set the signer BEFORE the RPC plugin
  .use(solanaRpc({ rpcUrl: RPC, rpcSubscriptionsUrl: WS }))
  .use(token2022Program());

// A batch of payments; the planner splits it into as many transactions as needed,
// signs, sends and waits for confirmation. Signatures are in each result's context.
const result = await client.sendTransactions([memoIx, transferIx, memoIx2, transferIx2]);
```

The lower-level path still exists in Kit (`sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })`,
from the [Kit README](https://github.com/anza-xyz/kit)), if the plugin client gets in the way.

**Token mint and transfer.** The docs' Kit examples:
`client.token.instructions.createMint({ newMint, decimals, mintAuthority, freezeAuthority }).sendTransaction()`
and `client.token.instructions.transferToATA({ mint, authority, recipient, amount, decimals })`
([create-mint.mdx](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/basics/create-mint.mdx),
[transfer-tokens.mdx](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/basics/transfer-tokens.mdx)).
Those use `tokenProgram()`; whether the Token-2022 plugin exposes the same helpers under
`client.token2022` is unconfirmed; the named `get...Instruction` functions above are confirmed.
Extensions are built with `extension("TransferFeeConfig", {...})`, sized with `getMintSize([...])`
and created with `getCreateAccountInstruction` then `getInitializeMintInstruction`
([transfer-fees.mdx](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/tokens/extensions/transfer-fees.mdx)).
Amounts are `bigint` in base units: with 2 decimals, `BigInt(Math.round(coins * 100))`.

**Memo** ([payment-with-memo.mdx](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/payments/send-payments/payment-with-memo.mdx)):
`getAddMemoInstruction({ memo: 'TN w-3f9a e-1042 reparations Treaty of Hatfield y1052' })`, placed
immediately before its transfer (required by the memo-transfer extension). Keep memos under about
80 bytes; Explorer shows them on the transaction page.

**Keypairs, never committed.** `generateKeyPairSigner()` makes a non-extractable key by default.
Use `generateKeyPairSigner(true)` then `writeKeyPairSigner(signer, path)` (both in `@solana/signers`,
re-exported by Kit); it writes the standard 64-byte JSON that `signerFromFile` and the Solana CLI
read. Keep them in `~/.config/durhack/solana/` (outside the repo, beside the keys file):
`commons.json` plus `nation-00.json` to `nation-11.json`, reused across worlds by country id. A
new world creates only a new mint and token accounts. Nations need no SOL (the Commons pays fees).

**Funding.** A human funds `commons.json` from faucet.solana.com (sign in with GitHub for more),
twice tonight, plus a spare funded key `commons-spare.json`. A new world costs roughly: mint with
metadata about 0.004 SOL, 13 token accounts at about 0.002 SOL each, fees 10,000 lamports per
transaction (2 signatures) x about 300 transactions = 0.003 SOL; total about 0.035 SOL (rent
figures are the usual 165-byte account rent; Token-2022 accounts with extensions are slightly
larger, exact numbers unconfirmed). 2 SOL covers 50 worlds. `solanaDevnetRpc()` and
`airdropFactory` can top up programmatically when the RPC airdrop is not rate-limited.

**Agent tooling.**
- Official skill, updated 4 Nov 2026, covers "Kit 8 plugin clients", web3.js v3, Anchor 1.2.x,
  Codama: `npx skills add solana-foundation/solana-dev-skill`
  ([repo](https://github.com/solana-foundation/solana-dev-skill)). It installs into
  `.claude/skills/` (an owner path) or the user directory; load it in the session that builds the
  chain module.
- Solana Developer MCP `https://mcp.solana.com/` searches docs only, no cluster access
  ([coding-with-agents.mdx](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/intro/coding-with-agents.mdx)).
- solana.com pages return a Vercel bot check to fetchers; read the docs source on GitHub
  (`solana-foundation/solana-com`, `apps/docs/content/docs/en/`) instead.

**Pitfalls.**
1. **`npm i @solana/web3.js` now installs v3** (3.0.0 shipped 1 Oct 2026; 3.2.1 is latest). Its
   README warns of breaking changes from v1 (async `Keypair`, `bigint`, `Uint8Array`). Every v1
   tutorial, and much of what an agent remembers, is now wrong for the default install. Rule for
   agents: **Kit only; never import `@solana/web3.js`, `@solana/spl-token` or `@coral-xyz/anchor`.**
2. `@solana/kit-plugins` (plural) is deprecated; use `@solana/kit-plugin-rpc` and `-signer`.
3. Plugin order: signer before RPC, or the RPC bundle has no payer (docs).
4. The planner builds **version 1 transactions by default** (type definitions of
   `@solana/kit-plugin-rpc` 0.23.0). Whether devnet Explorer renders v1 well is unconfirmed; the
   planner accepts `version: 0` if it does not. Check on the first live send.
5. `generateKeyPairSigner()` keys cannot be saved unless created extractable.
6. Memo-transfer accounts reject a transfer whose preceding instruction is not a memo, including
   Commons top-ups.
7. Orca's Kit SDK peers on Kit 5; Anchor's TS client on web3.js 1.x. Both clash with Kit 8.
8. Devnet resets erase everything: keep the setup script idempotent so a world can re-mint.

## 6. Effort, risk and cuts

| Task | Lane | Agent hours | Risk |
| --- | --- | --- | --- |
| Sim: `payment` event, trade dues, reparations, plunder, seizure; ordering fix | a | 2 to 3 | **Medium: touches treasury rules (see below)** |
| Chain module: wallets, genesis, window queue, sender, true-up, routes, WS | a | 3 to 4 | Medium: devnet, API names |
| Token-2022 polish: metadata, memo-transfer, revoke mint | a | 1 | Low |
| Ledger panel, wallet link on nation card, counters | c | 2 | Low (mock mode) |
| Gold arcs on the globe | b | 1 to 2 | Low |
| Optional: tariff (transfer fee), war chest, per-nation currencies | a | 1 to 6 | Medium |

**The real risk is in the sim.** Nations emit `country_updated` with an **absolute** treasury,
computed from their own replica. A payment credited to nation B can be overwritten in the same
batch by B's `country_updated` if it sorts after the payment, and money vanishes. Fix (pick one):
(1) sort `payment` events after everything else in a tick in `orderEvents`, and never pre-deduct a
payment in the payer's own `country_updated`; or (2) change `country_updated` to carry a treasury
delta. Option (1) is smaller. The Commons true-up hides any leftover drift on chain, but the sim's
own numbers should still add up. Cut nations: their queued `country_updated` can arrive late with
stale treasuries; (2) handles that better, (1) is good enough for the demo.

**Cut first:** tariff, war chest, globe arcs (keep the panel), per-nation currencies. Never cut:
reparations and plunder as transfers, the ledger panel with Explorer links, the counter.

**Demo beat (15 seconds), during the war in step 4:**
"The war ends. By the Treaty of Hatfield, the Vale pays the Ashen Concord 120 crowns." The ledger
panel flashes, a gold arc crosses the globe, a click opens Solana Explorer on devnet: a transfer
signed by the Vale's own wallet, memo "Treaty of Hatfield, reparations, year 1052". Point at the top
bar: "1,284 payments settled on Solana this world, for 0.006 SOL in fees. Supply is fixed: mint
authority, none." Backup: the saved demo world's sidecar of real signatures, and a screenshot.

## 7. Recommendation

**Build option B with the cheap parts of C:** one fixed-supply Token-2022 world currency with
metadata and memo-transfer, nation and Commons wallets, payments as transfers signed by the payer,
the sim as the truth and the chain as a 5-second mirror. Pitch it with the sentence in section 4.

### 7.1 Contract changes (all additive, through a `needs-owner` issue)

**X1** (`packages/shared/src/types.ts`):

```ts
export type PaymentReason = 'trade' | 'reparations' | 'plunder' | 'seizure' | 'war_chest' | 'subsidy';
// new WorldEvent member; from/to are country ids. actor = the payer, except plunder
// (derived in settleMove, actor = attacker, like the other derived battle events).
| { type: 'payment'; from: number; to: number; amount: number; reason: PaymentReason; note: string }
// note: "Treaty of Hatfield", "the sack of Elvet"; amount in coins, 2 decimals
```

`applyEvent` moves `amount` from `countries[from].treasury` to `countries[to].treasury` (clamped at
the payer's balance). `isEventValid`: `actor === from`, or a derived plunder. Optional later:
`Country.warChest?: number`.

**X2** (server to client):

```json
{ "type": "ledger", "entries": [ { "id": "p-1042", "eventIds": ["e-1042"], "tick": 352, "year": 1052,
  "from": 2, "to": 0, "amount": 120, "reason": "reparations", "note": "Treaty of Hatfield",
  "status": "confirmed", "signature": "5Kx...", "url": "https://explorer.solana.com/tx/5Kx...?cluster=devnet" } ] }
{ "type": "economy", "mode": "devnet", "online": true, "pending": 3, "payments": 1284,
  "volume": 18230.5, "feesSol": 0.0061 }
```

`status` is `queued`, `sent`, `confirmed`, `failed` or `simulated` (mock). A row is sent again when
its status changes. `economy` goes out when it changes, at most once a second.

**X3:** `GET /api/economy`:

```json
{ "mode": "devnet", "cluster": "devnet", "currency": { "name": "Drowned Age Crown", "symbol": "TNC",
  "mint": "Ab1...", "url": "https://explorer.solana.com/address/Ab1...?cluster=devnet", "supply": 1000000,
  "mintAuthority": null },
  "commons": { "address": "Co1...", "url": "...", "balance": 812000 },
  "nations": [ { "countryId": 2, "address": "Na2...", "url": "...", "onChain": 151.2, "sim": 151.2, "inSync": true } ],
  "totals": { "payments": 1284, "volume": 18230.5, "transactions": 402, "feesSol": 0.0061 },
  "recent": [ "the last 50 ledger entries, as in X2" ] }
```

`503 { "error": "economy off" }` when `SOLANA_MODE=off`. Mock mode answers with fake addresses and
`simulated` rows, so lanes b and c build against it at once.

### 7.2 Where it lives

`server/src/chain/` (lane a), wired in `server/src/index.ts` next to `bindTiger(runner)`:

- `index.ts`: `bindChain(runner)`: off or mock or devnet; subscribes to `events` and `snapshot`;
  skips while `runner.playback?.()`; never throws.
- `wallets.ts`: loads `commons.json` and `nation-NN.json` from `SOLANA_KEYS_DIR`; `walletOf(id)`.
- `genesis.ts`: per world: create the mint (metadata, 2 decimals), token accounts with
  memo-transfer, mint the supply to the Commons and starting treasuries to nations, revoke the mint
  authority. Async; payments queue until it finishes.
- `settle.ts`: the 5-second window: net the queue, build memo + transfer pairs, `sendTransactions`,
  record signatures, breaker and retries; the 15-second Commons true-up; the 30-second balance read.
- `routes.ts`: `GET /api/economy`; the WS messages go through the existing broadcaster.

### 7.3 Env vars (add to `.env.example` and the contracts table)

| Name | Default | What |
| --- | --- | --- |
| `SOLANA_MODE` | `mock` | `off`, `mock` (fake signatures, no network) or `devnet` |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | any devnet RPC (Helius, QuickNode as spares) |
| `SOLANA_WS_URL` | `wss://api.devnet.solana.com` | subscriptions |
| `SOLANA_KEYS_DIR` | `~/.config/durhack/solana` | keypair JSON files; never in the repo |
| `SOLANA_SETTLE_MS` | `5000` | settlement window |
| `SOLANA_MAX_TX_PER_WINDOW` | `6` | hard cap; overflow nets into the next window |

### 7.4 Build plan

1. **A-econ-1 (lane a, sim):** `payment` event in types, `applyEvent`, `isEventValid`; ordering
   fix in `orderEvents`; trade dues every 10 years per pact, reparations in the peace branch of
   `diplomacyTurn`, plunder and seizure in `settleMove`; chronicle lines; two payments in
   `mockEvents`. Check: a 3-minute headless run conserves money (sum of treasuries changes only by
   income and spending).
2. **A-econ-2 (lane a, chain):** a `scripts/solana-keys.ts` that writes the 13 key files and
   prints the Commons address for a human to fund; `server/src/chain/` with mock mode first, then
   devnet genesis and settlement; `GET /api/economy`, `ledger` and `economy` messages. Check: one
   world on devnet, a reparations transfer visible on Explorer with its memo, balances in sync.
3. **C-econ (lane c):** `LedgerPanel` and `EconomyCounter` exported from `web/src/ui/index.ts`,
   a "Treasury on Solana" link on `NationCard`; built against mock mode.
4. **B-econ (lane b):** place the panel and counter; gold arcs from `ledger` rows on confirm.
5. **Owner, before CP2:** record the demo world live once, save the signature sidecar, rehearse
   the 15-second beat, fund the spare wallet.

## Gaps and unconfirmed

- Whether devnet Explorer renders Kit's default v1 transactions and Token-2022 metadata well.
- Exact rent for Token-2022 accounts with extensions; exact SOL to deploy an Anchor program.
- The GitHub-signed-in faucet allowance; Helius Free on devnet.
- Whether `token2022Program()` exposes `transferToATA`-style helpers like `tokenProgram()` does.
- No code was run: all snippets come from the docs and type definitions, not from a live send.
- DurHack's own Devpost text for the Solana prize (P4 gap, still open).
