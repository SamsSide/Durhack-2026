# Lane b walkthrough: the economy, Solana and world generation

For [name B] (CutGrass88). The companion to `docs/study/lane-b.md` (the facts and file paths). This
one is the **how**: what to click, what to say, and how to explain things simply. Checked against
the code on 15 Nov.

**The running order.** Sam goes first: the prompt and world creation, cutting a nation off,
speeding up and slowing down, restoring the link, and how a ruler's beliefs shape what it does.
Then **you**: the economy, the blockchain and how the world is built. Then Justin: the interface,
anthems and voices (ElevenLabs).

---

## Part 1. Your stage time, click by click

### Before judging (check once)
- In the setup window: **Solana on (devnet)**, LLM **Both**. Run checks; all green.
- In the game, open the **Network panel** (top left) and check that the **Treasury** tab exists. It
  appears only when the chain is up. The ledger should say **devnet** in gold and **Chain online**,
  with at least a few rows. If it says **mock**, the payments are fake: tell Sam before judging.
- Have the Explorer page of one payment open in a second window as a safety shot.

### The hand-over
Sam finishes on the chronicle and presses **Esc**. You take the mouse.

### Beat 1 (about 20 s): speed, then one real payment

| Do | Say |
| --- | --- |
| Drag the speed slider in the top bar to the right end (**10**, "10 years/s"). Hold 3 s. | "I built the globe: 1,200 provinces, over 130 models, ten years a second." |
| Drag it back to **2** or **1 yr**. | (Nothing. Let them see it settle.) |
| Wait for a **gold arc** between two capitals, then click it (or its label "N TNC . reason"). | "Every payment between nations is a real Solana transfer, signed by the paying nation, reason in the memo." |
| The Explorer opens. Point at three things: **Success**, **devnet**, and the **memo** line. | "Supply fixed, mint authority revoked: no one can print money." |
| Close the Explorer tab and go back. | |

**If no arc shows within 3 seconds**, don't wait. Open the Network panel, **Treasury** tab, and
click the short signature on the top row. It opens the same Explorer page. Arcs last 6 seconds,
so you may have to be quick.

### Beat 2 (about 15 s): ages and map modes (cut first if time is short)

| Do | Say |
| --- | --- |
| Press **2** (terrain), then **5** (wealth), then **1** (political). | "Ages run from bows to starships." |
| If the chronicle or feed shows a satellite shot down, open it. If not, skip it. | "In a late war a rival's satellite can be shot down, and the chronicle says so." |

Then hand over to Justin: "Justin built everything you're clicking on."

### What to focus on while you speak
- **Point at the screen** at each number. Judges remember what they saw, not what they heard.
- **Slow down on the Explorer page.** It is the proof that the chain is real. The memo with a
  nation's name and the reason is the moment that lands.
- **Don't explain the algorithms on stage.** Keep them for questions.

---

## Part 2. If a judge says "show me more about the economy" (1 to 2 minutes)

A longer tour, in this order. Every step is real and clickable.

1. **The ledger** (Network panel, **Treasury** tab).
   - "Every row is one payment: year, who pays whom, amount, reason, status."
   - Status: **queued** (waiting for the next 5-second window), **sent**, **confirmed** (on
     chain). Mock mode shows **simulated**.
   - "Payments counts all payments, Volume is the total coin, and Pending is what hasn't reached
     the chain yet."
2. **The currency itself.** Click the **currency name** at the top of the ledger (for example
   "... Crown"). The Explorer opens the **token mint**. Point at:
   - the supply, 1,000,000 TNC, with 2 decimals;
   - the **mint authority**, which is empty: "Revoked at the moment the world was born. Nobody,
     not even us, can make more."
   - the name and symbol, stored on chain with Token-2022 metadata.
3. **A nation's treasury.** Click a nation. On its card, click **Treasury on Solana** to open that
   nation's own token account. Beside it is the on-chain balance and **in sync** (a tick), or
   **syncing** while a payment is on its way.
4. **The wealth map.** Press **5**. "Gold is rich, pale is poor. Money flows from wars, trade
   bills and alliances."
5. **One transaction in detail.** Open a payment's Explorer page and point at:
   - **Signer**: the paying nation's own wallet. The Commons only pays the fee.
   - **Instructions**: a memo, then a `TransferChecked` on the Token-2022 program.
   - **Memo**: `TN <id> y<year> <payer> pays <payee> <amount> TNC, <reason>: <note>`.
   - If there are two transfers in one transaction, the first is an **advance from the Commons**
     because the payer was short on chain. Say so before they ask.

---

## Part 3. The economy, explained simply

### The one-sentence version
"The game is the source of truth for money. Every time one nation pays another, that payment is
also sent to Solana as a real signed transfer, within about five seconds, so anyone can audit it."

### Where money comes from
- **Income** every year: from land (fertile plains earn most, mountains and ice little), from
  buildings and wonders, minus the cost of armies.
- **Payments** between nations (these are what go on chain):
  - **Goods market bills:** every 5 years a nation that bought goods pays each seller one bill,
    for example "6 grain, 2 ore". It pays at most 15% of its treasury, and bills under 8 are
    skipped. (Lane b built this.)
  - **Reparations:** after a war, the side that lost ground pays 15% plus 5% per province lost, at
    most 40%.
  - **Plunder:** a sacked town pays 7% of its treasury, a city 12%, a fallen capital 30% (70% if
    the nation falls).
  - **Allies:** a war chest from an ally (12%), pooled funds (20%), subsidies (10%).
- **Trade ships** that dock add a bonus to the treasury. That is income, **not** a payment, and is
  not on chain.

### Why money never appears from nowhere
- A payment can never be more than the payer has. It is moved, never created.
- A test script runs 600 years and checks that the total stays the same: it prints **MONEY
  CONSERVED**.

### The life of one payment (tell it as a story)
1. Two nations make peace. On its next turn the loser **decides on its own** to pay reparations.
   There is no central bank.
2. That becomes a `payment` event in the world's history, and every copy of the world applies it.
3. The server adds a row to the ledger as **queued**.
4. Every **5 seconds** the queued rows are **netted**: all payments from A to B become one
   transfer. That saves fees and avoids rate limits.
5. One transaction per pair: a memo plus a token transfer **signed by A's own key**. The Commons
   pays the fee. At most 4 transactions per window, sent one at a time.
6. The server asks devnet every 2 seconds whether it has landed. Once it has, the row says
   **confirmed**, and a **red wax seal** drops onto the gold arc on the globe.
7. If devnet is slow or down, the server backs off (2 s, 4 s, 8 s ... up to 60 s). The world
   keeps running; the rows just wait as **pending**.

### The blockchain words you must be able to explain

| Word | Plain meaning |
| --- | --- |
| **Solana devnet** | Solana's public test network. Real transactions, real explorer, but free test coins. |
| **Token / mint** | Our world's own currency, TNC. The "mint" is the token's master record: supply, decimals, who may create more. |
| **Token-2022** | Solana's newer token program. We use two of its extras: **metadata** (name and symbol stored on chain) and **memo required** (every incoming transfer must carry a memo). |
| **Mint authority revoked** | The right to create more coins was set to nobody, at genesis. The supply can never grow. |
| **Wallet / keypair** | Each nation has its own private key file, kept outside the repo. Its payments are signed with it. |
| **The Commons** | One extra wallet that holds the unallocated coin and pays every fee, so only it needs test SOL. |
| **Memo** | A short text stored in the transaction. Ours says who paid whom, how much and why. |
| **Netting** | Adding many payments between the same two nations into one transfer. |
| **Rate limit (429)** | Devnet refusing too many requests. We back off and honour its "Retry-After". |
| **Signature** | The transaction's ID, and proof the payer signed it. Clicking it opens the Explorer. |

---

## Part 4. World generation, explained simply

This is the part you said you were least sure of. Learn the **three-step story** first, then the
details.

### The three-step story (say this, 20 seconds)
"You type one line, like 'rival whaling republics in a frozen sea in 1720'. **First**, plain rules
read the words: frozen means more ice, republics sets the kind of state, 1720 sets the year.
**Second**, Gemini writes a world bible: nation names, rulers, temperaments, flags, building
styles, and it can also set the shape of the planet. Our code checks Gemini's answer against the
rules, and the prompt's own words win. **Third**, code builds the planet from a random seed: same
bible and same seed, same planet, every time."

### How the planet itself is made (the geometry)
1. **1,200 points on a sphere.** They go on a **Fibonacci spiral**, each step turned by the golden
   angle, which spreads points evenly. Each point is then nudged a little at random so the map
   doesn't look machine-made.
2. **Join the points into triangles.** A **convex hull** of points on a sphere connects
   neighbouring points into triangles (the **Delaunay triangulation**).
3. **Turn triangles into provinces.** Take the centre of each triangle's circle. The ring of
   centres around a point is that point's province. That is a **Voronoi diagram** on a sphere.
   Each province is a convex shape, mostly six-sided, some five or seven.
4. **Land and sea.** It places 3 to 5 continent "blobs" far apart, roughens the coasts with noise,
   then floods the lowest share of provinces as sea. The sea level comes from the slider or the
   prompt.
5. **Biomes** from latitude, height and moisture: ice, coast, mountain, hills, desert, forest,
   plains.
6. **Regions and capitals.** Capitals go on the bigger landmasses, at least two nations per
   landmass so everyone has a neighbour, spread out and on good land.

**An analogy if they look lost:** "Imagine scattering 1,200 seeds evenly on a ball, then letting
each seed claim the patch of ground closest to it. Those patches are the provinces."

### Why 1,200?
- It was 500. More provinces means smaller provinces, more detailed coasts and borders, and more
  room for nations to grow and fight.
- 1,500 broke our time budget: each year every nation scans every province, and the frame rate
  dropped. 1,200 is the most that stays smooth.

### Why not hexagons?
"You can't tile a sphere with hexagons alone; you always need some odd shapes. Irregular provinces
also look like a real political map, and the even spiral keeps them about the same size."

### What makes it repeatable (determinism)
Every random choice uses a **seeded** random number generator. The same seed and bible give the
same planet, on the server and in every browser, so the planet's geometry never has to be sent:
each side builds it itself.

---

## Part 5. The architecture, explained simply

### Draw this in the air
```
 Browser (React + three.js)  <---- events over a websocket ----  Node server
   own copy of the world                                         |- the clock (one tick = one year step)
   draws the globe                                               |- one agent per nation, each with its own copy
                                                                 |- the bus: passes events between agents
 packages/shared: the rules, used by both sides                  |- Gemini: rulers, the world bible, news
                                                                 |- ElevenLabs: narration, anthems, voices
                                                                 |- chain module ---> Solana devnet
```

### Five sentences
1. **One language:** TypeScript everywhere. The rules live in one shared package, so the server
   and the browser run the exact same code.
2. **The world is a log of events.** Nothing is overwritten. Every change ("tile claimed",
   "payment", "war declared") is an event, and every copy of the world applies them in order.
3. **Each nation is an agent** with its own copy of the world. It decides only its own moves.
   Battles are settled by seeded functions, so every copy gets the same answer without a referee.
   That is why Sam can cut one off and later merge it back.
4. **Gemini sets direction, not outcomes.** A ruler is asked every 30 to 45 seconds for a focus or
   a target; the rules do the rest. If Gemini fails, the nation runs on autopilot.
5. **The chain is a mirror.** The game never waits for Solana; payments settle about every 5
   seconds.

### Your part of the code
- `web/src/globe/`: everything you see on the planet.
- `server/src/chain/`: the Solana bridge (built by lane a, owned by lane b since 14 Nov).
- `packages/shared/src/sim/payments.ts` and `economy.ts`: who pays whom, and the goods market.

---

## Part 6. Anthems and voices (Justin's part; know enough to hand over)

- Gemini writes **4 to 8 lines of lyrics from the nation's real history** (its wars, its losses).
  ElevenLabs Music sings them, in a style that fits its era and government. No two anthems are
  alike.
- Narration reads each nation's lore; **Terra Nova News** is read by our own **cloned voices**
  (Sam, Justin, Denis); war chants are shouted.
- Everything is made once and cached, with caps so the budget can't run away.
- If asked in detail: "Justin built that part; Justin?"

---

## Part 7. Questions you might get, with answers

### On the blockchain
- **Why put it on a blockchain at all?** "So the economy can be audited by anyone outside our
  game. Every transfer between AI-run nations is public, signed by that nation's key, with the
  reason written in it."
- **Is this real money? Can I buy TNC?** "No. It's on devnet, Solana's test network. The coins
  have no value. It's the same code that would run on mainnet."
- **Why Solana?** "Transactions confirm in seconds and cost a tiny fee, so many small payments
  are practical. Token-2022 gives us on-chain metadata and memo-required transfers out of the
  box."
- **Why isn't every coin of the treasury on chain?** "The game is the truth and the chain is a
  mirror of payments. Income each year would be thousands of transactions; payments between
  nations are the part worth proving."
- **How do you know the chain matches the game?** "For each nation we compare its ledger (its
  start float, plus what it received, minus what it paid, plus any advances) with its on-chain
  balance. Our devnet test showed a difference of zero across 67 payments in 43 transactions."
- **Who holds the keys?** "Each nation has its own key file, kept outside the repo on the laptop.
  An AI ruler never sees a key; the server signs on the nation's behalf when the rules say it
  pays."
- **What if a payment fails?** "It is resent with the same signature, so it can never be paid
  twice. It is rebuilt only if it expired and isn't anywhere on chain. After three tries it is
  marked failed."
- **What if devnet goes down mid-demo?** "The world keeps running; payments queue as pending.
  After 5 failed windows we pause for 30 seconds and try again."
- **How do you handle rate limits?** "Netting into 5-second windows, at most 4 transactions per
  window, polling over HTTP rather than websockets, and backing off when devnet says 429."
- **What's the hardest bug you hit?** "Our first design copied every treasury to the chain every
  10 seconds. It hit rate limits and drifted by over 1,000 coins. So we rebuilt it: only real
  transfers go on chain, netted per pair. Drift went to zero."

### On the world and the globe
- **How is the planet made?** The three-step story in Part 4, then the geometry if they want it.
- **Is the same prompt always the same world?** "The same bible and seed give the same planet.
  Gemini's bible can differ between runs, so a new prompt gives a new world."
- **How does it stay smooth?** "One draw call per kind of thing, called instancing. We repaint
  only the provinces that changed, read the world ten times a second, and hide close-up detail
  from orbit."
- **What's the frame rate?** "About 150 frames a second in orbit on the demo laptop. At ten years
  a second it drops to about 50. That's our known limit."
- **How many models?** "Over 130 3D models (132 .glb files): buildings by style and age, units by
  age, wonders. Terrain shapes like mountains and dunes are built in code."

### Curveballs
- **Did AI write the code?** "Yes, largely: Claude Code agents built most of it from our plans,
  each of us running our own lane, talking across laptops through GitHub issues. Every change went
  through a pull request and a smoke test."
- **What would you do with more time?** "Hold 60 fps at top speed, put more of the economy on
  chain, and run the nations on separate machines for real."
- **A question that belongs to someone else:** "That's Sam's part" or "Justin built that". Handing
  over is a good answer.

### When you don't know
"I don't know that number off-hand; I'd rather not guess." Then offer something you do know.
Judges trust a team that says what it doesn't know.
