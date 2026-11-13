# P4 - MLH Best Use of Solana

Researched 13 Nov 2026 (web search and fetch only). Prize per the DurHack brief: Unruggable hardware wallets for each team member.
Brief (verbatim from MLH): "Harness Solana's core advantages like blazing fast execution and near-zero transaction costs... Create a game, social app, or consumer product that relies on instant, high-frequency transactions. Design a sophisticated trading, lending, or decentralized exchange (DEX). Build a prototype for supply chain, identity, or payments that can handle massive, real-world volume."

Note: `https://mlh.link/solana` returned an empty page to the fetcher. The MLH partner page `https://www.mlh.com/partners/solana` worked and is the source for the rules below.

## 1. What Solana and MLH want

Rules from [MLH Solana partner page](https://www.mlh.com/partners/solana):
- Integrate Solana into your hack to qualify. No cash amount is listed.
- Build on Solana **devnet** with a funded devnet wallet.
- Suggested steps: read the quick start, fund the wallet from the devnet faucet, hack.
- Resources MLH lists: Solana Agent Skills, Solana MCP Server, Solana docs and templates, Blueshift courses, the Solana quick-install (Rust, Solana CLI, Anchor), the devnet faucet.

How it is judged: MLH publishes no rubric. Judging is by Solana staff or a Solana-side judge at the event (unconfirmed who). The brief's wording points at three things: real use of Solana, a use case that needs speed or low cost, and a working demo. Inference from past winners (section 4): a visible on-chain transaction (Explorer link in the demo) and a clear "why chain, not a database" sentence beat depth of smart-contract code.

What lights up a judge (inference): a live devnet transaction on screen; a reason the data must be tamper-proof or the payment must be tiny and instant; use of Solana-native bits (PDAs, SPL tokens, Anchor, wallet adapter) rather than just storing a hash. A project that is clearly "a normal app plus a chain call bolted on" scores lower than one where Solana is the point.

## 2. The tech, cheapest credible integration

| Option | Effort | Credibility | Notes |
| --- | --- | --- | --- |
| Memo transaction from a wallet (leaderboard, proof-of-existence, log) | 1-2 h | Medium | The SBUHacks Solana winner did exactly this (section 4). |
| Wallet adapter connect, sign a memo plus transfer in browser | 2-4 h | Medium-high | Visible in demo, judge sees Phantom pop up. |
| SPL token mint for rewards/badges | 3-5 h | High | Uses `@solana-program/token` or `spl-token` CLI. |
| Anchor program (PDA state, check-in, escrow) | 8-15 h for a team new to Rust | Highest | Realistic only if one person owns it and the app has a thin Solana slice. Rust build times and toolchain install are the risk. The TalknDo author wrote an Anchor escrow over a DEV weekend (see section 4), with prior experience likely. Not realistic to learn from zero in "a few hours". |
| x402 pay-per-request API | 3-5 h | High (trendy) | See section 3. |

Libraries (confirmed):
- `@solana/kit` is the renamed 2.x line of web3.js. The README says "We have renamed the 2.x line of `@solana/web3.js` to `@solana/kit`" and calls it a complete breaking change from 1.x. Source: [anza-xyz/kit](https://github.com/anza-xyz/kit). Use `@solana/kit` for new code. Many tutorials, the Agent Kit MCP server and most DEV posts still use `@solana/web3.js` 1.x, which still works. AI agents often mix the two APIs: pin one and tell the agent which.
- Program client helpers come as `@solana-program/system`, `@solana-program/memo`, `@solana-program/token` (names from the Kit README for system; memo and token package names unconfirmed, check npm).
- Wallet adapters: `@solana/wallet-adapter-react` plus Phantom, used by the TalknDo project. Wallet Standard is the newer route (unconfirmed which is preferred in Nov 2026).

Solana AI tooling:
- Official Solana Developer MCP at `https://mcp.solana.com/mcp`, HTTP streaming, docs-only (searches Solana docs, Anchor docs, program examples, Stack Exchange). It does not touch a live cluster or wallet. Repo: `solana-foundation/solana-dev-mcp`. Sources: [Civic reference](https://docs.civic.com/civic/reference/servers/solana), [Solana Compass on docs rebuild](https://solanacompass.com/news/solana-foundation-rebuilds-its-developer-docs-with-ci-tested-code-ecosystem-bot-scanning-and-an-mcp-server). Third-party summaries only; confirm on the MLH page (it does list "Solana MCP Server").
- Solana Agent Skills: listed on the MLH page; contents not inspected. Check them and load into Claude Code.
- Solana Agent Kit (SendAI) with a community MCP server `sendaifun/solana-mcp`, last updated Feb 2026 per a directory listing. It lets an LLM mint, trade and transfer. It depends on web3.js 1.x. Risky for demos (LLM moving funds) but devnet only here. Source: [mcpservers.org listing](https://mcpservers.org/en/servers/sendaifun/solana-mcp).
- `create-solana-dapp` templates: the MLH page lists "Solana Developer Templates". I could not confirm the exact CLI command or current template list. Check `solana.com/developers/templates`.

Not covered by research (unconfirmed): Solana Pay QR flow, Actions/Blinks, compressed NFTs and token-extensions status in Nov 2026. The solana.com docs returned HTTP 429 to the fetcher. Skip these for a first integration: Solana Pay and Actions add a mobile wallet dependency.

Faucet and RPC:
- Public devnet RPC (`https://api.devnet.solana.com`) airdrop returns 429 under load. A DEV post ([Passion Jar](https://dev.to/zoe_lin_0653/passion-jar-solana-turning-small-actions-into-devnet-proof-6e6)) hit this and fell back to the web faucet at faucet.solana.com. Exact limits: unconfirmed (docs page 429). Plan: fund wallets TODAY and keep a spare funded keypair; airdrop 1-2 SOL once per wallet.
- Helius: Free plan is 1M credits, 10 RPC req/s, 1 sendTransaction/s, rate limits effective 7 Apr 2026. Sources conflict on whether Free includes devnet. Unconfirmed. Source: [Helius rate limits](https://helius.dev/docs/billing/rate-limits). Do not depend on it: the public devnet endpoint is enough for a demo. QuickNode and others offer free devnet; not checked.

Minimal hello-world (memo from Node), written from the Kit README and general knowledge, not run:

```bash
mkdir sol && cd sol && npm init -y
npm i @solana/kit @solana-program/memo
```

Steps: `generateKeyPairSigner()`, `createSolanaRpc('https://api.devnet.solana.com')`, `rpc.requestAirdrop(addr, lamports(1_000_000_000n)).send()`, build a message with `createTransactionMessage({version:0})` piped through `setTransactionMessageFeePayerSigner`, `setTransactionMessageLifetimeUsingBlockhash`, `appendTransactionMessageInstructions([getAddMemoInstruction({memo:'hello durhack'})])`, then `signTransactionMessageWithSigners` and `sendAndConfirmTransactionFactory({rpc, rpcSubscriptions})`. The Kit README example did not show the send-and-confirm setup, so the agent must read the current Kit docs. Print `https://explorer.solana.com/tx/<sig>?cluster=devnet`. Expect 30-60 min to first working call with an agent, most of it fixing API names.

Gotchas:
- Kit versus web3.js 1.x API mixing (above).
- Airdrop 429s (above).
- Wallets must be set to devnet in Phantom (Settings, Developer Settings, Testnet Mode). Forgetting this is the classic demo failure.
- Memo only proves who posted and when, not that the content is true. The SBUHacks winner said this openly.
- `getProgramAccounts` leaderboards need account fields to filter, since PDA seeds cannot be enumerated (Loyalty Ledger author).
- Anchor needs Rust, Solana CLI, Anchor installed (MLH one-command installer; WSL on Windows). Budget an hour.
- Devnet resets and instability happen (general knowledge, unconfirmed for Nov 2026).

## 3. Non-finance uses that fit a general app

- **Tamper-evident log or proof of existence:** hash a document/photo/AI output, post the hash in a memo. Pin Point (below) is this pattern.
- **On-chain leaderboard:** memo per score, read with `getSignaturesForAddress`. This is the SBUHacks winner's approach. Cheapest of all.
- **Streaks and check-ins as PDA state:** needs Anchor. See Loyalty Ledger.
- **Micro-rewards:** mint an SPL token or badge for actions. Cheap if you use a plain token mint, no custom program.
- **Attestations:** a signed memo or a PDA per claim ("this agent produced this output at this time").
- **Pay-per-use for AI agents (x402):** server answers 402 Payment Required, client pays and retries with an `X-PAYMENT` header. Solana's own guide uses Corbits middleware at $0.0001 on solana-devnet, with PayAI as a facilitator. QuickNode's `@quicknode/x402-solana` supports devnet USDC but is marked alpha. Sources: [Solana x402 guide](https://solana.com/developers/guides/getstarted/intro-to-x402), [QuickNode x402 docs](https://www.quicknode.com/docs/build-with-ai/x402-payments). Not run by us. Good story if the app is an AI API ("each Gemini call costs a fraction of a cent, paid by the agent").

Fit pattern for any idea: "every key event in the app also writes a memo, shown as an Explorer link" is a 2-hour slice. It is credible to qualify, thin to win.

## 4. Past winners (2025-2026)

Honest finding: I could not find Devpost project pages for MLH "Best Use of Solana" winners. Devpost winner galleries did not surface. What I found are self-reported write-ups. Treat "won" as per the author.

| Project | Event | What it did | Why it likely won | Source | Status |
| --- | --- | --- | --- | --- | --- |
| Logical Steam | SBUHacks 2026 (Solana track) | Browser game; each run signed in Phantom as a 0-lamport transfer to a PDA plus a Memo with run data; leaderboard read from `getSignaturesForAddress` | Solana replaces the leaderboard server; no Rust; clear "scores nobody can edit" pitch | [dev.to post](https://dev.to/beeshuu/sbuhacks-2026-experience-5bh) | Author states it won |
| Pin Point | QuackHacks, Feb 2026 | Anti-deepfake: on-device ML check, media bound to GPS and timestamp, hash anchored on Solana (Anchor, web3.js, React Native) | Real problem, full stack, tamper-evident record | [portfolio](https://ramysandy.github.io/shreeram_portfolio/project/pinpoint) | Listed under the category, win unconfirmed |
| Loyalty Ledger | DEV Weekend Challenge (not MLH event) | Fan check-in streaks in Anchor PDAs, badge as SPL token, leaderboard via `getProgramAccounts` | Entered, not confirmed won | [dev.to](https://dev.to/ishantgupta/every-sports-app-resets-your-streak-eventually-mine-cant-hln) | Entry only |
| TalknDo | DEV Weekend Challenge | Stake SOL on a goal; escrow PDA; non-transferable Metaplex Core badge | Entered, not confirmed won | [dev.to](https://dev.to/bee6ix/i-built-talkndo-over-the-weekend-55nn) | Entry only |

Also: SolHacks 2026 on Devpost lists "[MLH] Best Use of Solana", 1 winner, reward Ledger Nano S Plus, track about "supply chain, identity, or payments". No winner named. Source: [SolHacks 2026 page (mirror)](https://kelaenderkoe.pages.dev/Function-https-solhacks-2026.devpost.com/). The prize at MLH events is therefore a single winning team, matching DurHack's "wallet for each team member".

Takeaway: the one confirmed-ish winner used a memo, no custom program. Winners lead with a clear story and a visible transaction, not code volume.

## 5. Hours to qualify versus compete; risks

- Qualify: 2-3 h. Devnet wallet, funded, one memo or transfer written from the app, Explorer link shown. Sufficient per MLH wording ("integrating Solana qualifies").
- Compete: 6-12 h of one person's time. Wallet adapter in browser, SPL token or small Anchor program, a story tied to the app, a demo showing the live transaction. One person should own this lane.
- Competition: most teams at a general UK hackathon will not touch Solana. In a typical field I would guess a handful of Solana entries (unconfirmed, no entry count). Crypto-native teams will enter with trading/DEX ideas; a non-finance, working demo can still win.
- Risks: faucet 429 at demo time; Phantom on devnet; judges dislike "hash in a memo for no reason"; agents mixing Kit and web3.js; chain call in the live demo path failing (add a recorded fallback and cached Explorer link); Anchor toolchain time sink; MLH says rules may be stricter on-site (check the DurHack Devpost prize text, unconfirmed).

## 6. Stackability with other DurHack MLH prizes

Solana is a thin, independent layer so it stacks with almost anything.

| Prize | Stack with Solana | How |
| --- | --- | --- |
| ElevenLabs | Yes | Voice output unrelated to chain; optionally anchor a hash of the generated audio. |
| Gemini API | Yes | Log Gemini outputs as memos; x402 pay-per-call for the Gemini-backed endpoint. |
| Entire | Unknown | Not researched. |
| Tiger Data | Yes | Store events in Tiger Data (Postgres/time-series), anchor batch hashes on Solana. |
| Vultr | Yes | Host the x402 server or hash service on Vultr. |
| MongoDB Atlas | Yes | Atlas holds app data, Solana holds proofs. |
| DEV writing challenge | Yes | Write-up of "what we built" counts; Solana posts are common on DEV (see section 4). |

Rule of thumb: add the Solana slice last, only if the core project has an event worth proving.

## 7. Scores (1-5, 5 is best; effort 5 = cheap)

| Measure | Score | Why |
| --- | --- | --- |
| Fit for any idea | 4 | A memo/leaderboard/proof slice fits nearly any app. |
| Win chance | 3 | Likely few entrants, but the judge wants Solana to matter. Memo-only wins are possible, not guaranteed. |
| Value | 3 | Hardware wallets for the whole team (see below). |
| Effort | 4 for qualify (memo), 2 for an Anchor program | One person, a few hours for qualify. |

Unruggable: a Solana-only hardware wallet by Unruggable. Keys stay encrypted on the device, every transaction needs a physical button press, optional 2FA, native Squads multisig, companion app on iOS/Android/desktop. Models: S1 (injection-moulded ABS, affordable), A1 (machined aluminium), and an open-source ESP32 DIY signer. Source: [Solana Compass](https://solanacompass.com/projects/unruggable), [Cointelegraph release](https://cointelegraph.com/press-releases/unruggable-unveils-a-solana-native-hardware-wallet). Price: not found on any fetched page. One podcast listing shows "$69", unconfirmed. Estimate: roughly 70-200 USD each, so about 150-800 USD for a team of 2-4 (guess, not sourced). Check `unruggable.io/preorder`. Only useful to people holding Solana; resale or gift value is modest.

## 8. Do this tonight

1. Pick ONE person for the Solana lane (or skip the prize if no one is free).
2. Install Phantom, switch to devnet (Testnet Mode), make a new throwaway wallet. Never use a wallet with real funds.
3. Fund it at faucet.solana.com tonight (the public RPC airdrop 429s). Fund a second server-side keypair too.
4. `npm i @solana/kit @solana-program/memo` in a scratch folder. Get the memo hello-world to print an Explorer link. Target: under 1 hour.
5. Add the Solana MCP (`https://mcp.solana.com/mcp`) and load Solana Agent Skills into Claude Code. Tell the agent "use @solana/kit, not web3.js 1.x".
6. Read the MLH page and the DurHack Devpost prize text for any rule difference.
7. At kickoff, decide the one-sentence "why Solana" for the chosen idea: leaderboard, proof, reward, or pay-per-call.
8. Build the slice behind a feature flag with a recorded fallback. Quote the Explorer link in the demo script.
9. Decide by hour 6: if the slice is not working, drop to a plain memo and stop.
10. Ask on the day: which judge covers Solana, and do they want Anchor? (Unconfirmed.)

## Gaps

- No Devpost winner pages found; winners are self-reported.
- Faucet exact limits, Solana Pay, Actions/Blinks, cNFT/token extensions, create-solana-dapp commands, Agent Skills contents: unconfirmed (solana.com docs returned 429).
- Unruggable price: unconfirmed.
- Helius free tier devnet access: unconfirmed.
- Hello-world code not executed.
