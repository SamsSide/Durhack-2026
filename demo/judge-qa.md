# Judge Q&A: the pitch, the prize angles and the answers

*Copied on 15 Nov 2026 from `docs/documentation.md` section 8 (Judge prep). Section numbers such as
"section 4.2" refer to that file. Fix the source first, then this copy. Back to the
[demo pack index](README.md).*

Replace [name A], [name B] and [name C] with your own names: A is lane a (SamsSide), B is lane b
(CutGrass88), C is lane c (Justin-CODING-PY). Lane b also has a longer study sheet:
[`docs/study/lane-b.md`](../docs/study/lane-b.md).

## The 30-second pitch

"Type a world. Terra Nova builds a planet and gives every nation its own AI: its own copy of the
world, its own Gemini ruler, its own wallet on Solana. Watch them settle, trade, pay each other,
march from spears to starships and go to war. Now cut one off mid-war: it keeps going on what it
last knew. Bring it back and the world merges its missing years and settles the border disputes,
with no central server deciding anything. Every nation has a narrated history, a war chant and an
anthem sung from what really happened to it."

## The 2-minute demo

Given live at the table on the owner's laptop, again for every judge (no video). It starts from a
prepared world a few hundred years in, in presentation mode; the timed script and the reset routine
are in `docs/submission.md` section 3 (copy in `demo/script.md`). The seven beats:

1. Orbit, gears at a few years a second: "a new world composed live by AIs", every nation with its
   own Gemini ruler and its own wallet.
2. **The moment:** cut a nation in the Network panel and press Show beliefs: its map drifts from
   the truth while it keeps ruling.
3. Kill its ruler: a stand-in covers, then a successor inherits the memory. Restore the link: the
   missing years merge in, the dispute is settled by one rule and "the Silence" is in the chronicle.
4. The globe and the money: ten years a second for a few seconds, then click a gold payment arc and
   open it in the Solana Explorer.
5. Ages from bows to starships: two map modes, and a satellite shot down (or the port and sea
   battle beat) if one has happened.
6. Click a nation: the card, its ruler, mood and treasury, its narrated lore and its anthem.
7. Hold the mic and speak a decree ("a plague in the north"); Terra Nova News reports it. Close on
   the closing card (End): the token meter.

A judge can give their own prompt on the Create screen afterwards (the world bible takes about 5 s,
about 7 s with a picture).

**If the live demo breaks:** play the saved replay `demo-1` (World: Saved replay demo-1 in setup, or
`npm run demo:reset -- --replay demo-1`): no API calls, exact replay, cached audio. The failure
plays are in `docs/demo.md` section 6. Mock mode (`npm run mock`) needs no keys. Screenshot of a confirmed devnet
payment: `docs/shots/solana-devnet-payment.jpg`.

## Prize angles

| Prize | The one sentence | Proof |
| --- | --- | --- |
| Neptune North (actors work better together) | Independent agents with a common world, deciding alone, progressing when cut off and merging on return | `agents/nation.ts`, `engine/bus.ts`, `engine/resilience.ts` |
| Marshall Wace (New Worlds) | A new world from one line, with its own history, music and money | the Create screen |
| MLH Gemini | Gemini rules every nation and is multimodal: a picture in, speech in, the map image in for the news | `llm/index.ts`, `bibleAi.ts`, `decrees.ts`, `broadcast.ts` |
| MLH ElevenLabs | Narration, history-driven anthems, war chants, a news anchor in the team's own voices | `server/src/story/` |
| MLH Solana | Every coin between nations is a Token-2022 transfer signed by the payer's own wallet, with a memo | `server/src/chain/` |
| Waterstons (weak fit, one line) | Language models, a simulation, cloned voices, generated music and a public chain connected into one living map | the whole app |
| Main track (Composition) | A world, its history, money and music composed live by many authors | the demo itself |

Not entered (owner rulings), so never present them as entries: MLH Entire (sessions are still
recorded) and MLH Tiger Data (the code is optional and off).

## Likely questions with answers

**Resilience and AI agents (Neptune North)**

1. *Is there really no central controller?* The runner is a clock and an observer. Each nation
   decides only its own events on its own replica. Things no single nation owns (a deleted nation's
   fall, secession, successions, decrees, dispute settlement) are computed from shared data by pure
   functions and published as one batch.
2. *How do replicas agree on a battle no one reports?* A battle is derived from a move by a pure,
   seeded function; every replica applies the same batch in the same order and gets the same result.
3. *What happens to a cut nation?* It keeps playing on stale beliefs, queues its events and is
   noticed as silent by neighbours after 12 years.
4. *How is the merge done?* From a checkpoint taken at the cut: missed batches, then the dispute
   settlement, then its queued events. Everyone applies the same settlement in the same order.
5. *Who wins a disputed province?* The earlier claim, by tick; a tie goes to a hash. Same answer
   whatever order links come back in.
6. *Is it a real network partition?* No. All agents run in one Node process and the cut is a switch
   on the bus. Running agents on other laptops was planned and cut for time.
7. *What if Gemini is down?* Every call has a fallback: autopilot rulers, template lore and bulletins,
   a keyword decree matcher. The world never waits for an LLM.
8. *How do you know replays are exact?* `check-replay.ts` records a run with a cut, a restore and a
   delete, replays it and compares the final worlds field by field.

**Gemini**

9. *Why so few LLM calls?* Rules move the world; the LLM only sets each nation's focus and stance
   every 30 to 45 s. That keeps it cheap, fast and playable with no LLM.
10. *What is multimodal here?* A picture shapes the world bible; a spoken decree is heard directly as
    audio; the news reads a captured image of the globe.
11. *How do you stop bad JSON?* JSON schema output, validated again on our side; any failure falls
    back.
12. *How much does a world cost?* The token meter shows calls and tokens live; caps are 20 calls a
    minute and 400,000 tokens a run. We have not measured an average cost per world yet.

**ElevenLabs**

13. *Is voice core or a button?* Every nation has narrated lore, a chant played automatically in war
    and an anthem written from its own history; the news is read aloud every bulletin.
14. *Whose voices?* Premade voices chosen by culture and government, plus our own cloned voices as
    news anchors and the decree herald.
15. *What if credits run out?* Everything is cached by content hash; caps return 503 and the browser
    falls back; mock mode uses bundled samples.

**Solana**

16. *Why is the chain not the source of truth?* A battle cannot wait 1 to 2 s for a confirmation
    inside a 500 ms tick, exact replays need a local log, and a devnet outage must not freeze the
    world on stage. The sim records the debt; the chain proves it was paid, by whom and when.
17. *Who signs?* The paying nation's own wallet signs the transfer; the Commons only pays fees.
18. *Can a payment be paid twice?* No: a signed transaction is only rebuilt once its blockhash has
    expired and its signature is unknown to the chain.
19. *What about rate limits?* Netting per pair per 5 s window, at most 4 transactions a window, no
    simulation calls, HTTP polling and backoff: about 30 to 40 RPC calls a minute.
20. *Is the supply real?* Fixed at 1,000,000 with the mint authority revoked at genesis; every
    incoming transfer must carry a memo.

**Process**

21. *How did you split the work?* Three lanes (world and story, globe, interface), a contract file
    for every interface, mocks first, PRs only to `main`, cross-lane requests as GitHub issues.
22. *How did you use AI?* Claude Code agents built most of the code from short plans, one lane per
    person, with a smoke gate on every pull request. Sessions are recorded with Entire and linked to
    commits; we did not enter the Entire prize.

**Technical depth**

23. *Why spherical Voronoi?* It reads as a political map; Fibonacci points give even cells with no
    relaxation; the convex hull gives the triangulation in O(n log n).
24. *How does the battle maths work?* A contest function with exponent 1.6 between Lanchester's
    linear and square laws, plus terrain, forts, landings, age gap, wonders and command.
25. *Does it scale?* Comfortably at 1,200 provinces and up to 16 nations at ten years a second (the top gear) on one
    laptop;
    the rules scan provinces per nation, so much larger maps would need spatial indexes. We have not
    benchmarked beyond the demo size.

## Table-demo questions (2 minutes, live, one judge at a time)

- *Is this live or a recording?* Live: the real app on this laptop, with a prepared world so we do
  not wait. A saved run can be replayed exactly, with no API calls, if the network fails.
- *Can I give it a prompt?* Yes, on the Create screen; Prepare takes a short while to cache the
  lore and audio, so we start from a prepared world for the two minutes and can build yours after.
- *What am I looking at when you cut a nation?* The nation's own copy of the world, frozen at the
  cut and drifting from the truth while it keeps ruling; the Show beliefs view paints what it no
  longer knows.
- *Is the Solana payment real?* A real devnet Token-2022 transfer signed by the paying nation's
  wallet, with the reason in the memo; click an arc to open it in the Solana Explorer.
- *How much of this is the LLM?* Little: rules and seeded functions move the world; Gemini sets
  each nation's focus every 30 to 45 s and hears spoken decrees; every call has a fallback.

## Added on 14 Nov (afternoon and evening)

Short answers for the features that landed late.

- **Time gears.** Speed runs from a week a second to ten years a second (new worlds start at
  three months a second); the client shows month and day between yearly ticks and units glide, and the
  pacing director still slows for big moments.
- **Prepare mode.** `prepare: true` pauses a new world while lore, narration, chants, anthems and
  each ruler's first decision are made in parallel within the budgets; a readiness panel shows
  progress and a play button appears when done, so the demo never stutters.
- **A living world.** Boats, caravans, birds and smoke, volumetric clouds with weather and storms
  that answer storm decrees; units move at believable speeds.
- **Strategic map.** Armies route by Dijkstra over terrain move cost (round mountains, through
  passes), stop at enemy zone of control, and chokepoint forts hold lines; cities grow walls by
  tier, drawn at close zoom from a derived city tier.
- **Council ageing.** Each member has a birth year; natural death rises from 50 and nobody lives
  past 100, so rulers do not reign for centuries; succession then follows the usual rules.
- **News anchor.** Terra Nova News shows an animated, lip-synced anchor (our own original
  characters and studio) in a broadcast window, with cutaways to the globe capture.
- **Economy depth.** Each province makes a good; shortages, a goods market, devastation, war
  readiness and a politics axis that drifts to extremes under war, shown as map modes and chips.
- **Exact Solana ledger.** Every sim payment is recorded and netted per pair in 5-second windows,
  with a token account opened for nations founded after genesis; balances match the sim (drift 0).
- **Calm UI.** One left panel at a time (nation or province card), small war tabs top right, a
  node-graph network panel and icon map modes by the minimap.
- **Material system.** Shared CSS tokens give panels depth, bevels, engraved names and plated
  badges across every screen (before and after shots in `docs/shots/`).
- **Memory cap.** The chronicle is a recent window (about 500 lines, founding and secession kept)
  trimmed by the shared `applyEvent`; the full log streams from `GET /api/world/log` on disk.
- **Stability fixes.** The payment-arc label loop that froze the tab was removed and the server
  now survives chain and socket errors.
- **Timeline scrubber.** The scrubber rebuilds the globe at any past year from the log.
- **Territory chart (optional, off for the demo).** A Stats tab in the Network panel charts each
  nation's territory from Tiger Data; the tab only exists when `TIGER_DATABASE_URL` is set and the
  database answers. We did not enter the Tiger Data prize.

## How the interface shows it

For each feature: what the judge sees, what is happening underneath, and the one-line answer.

- **The network cut.** *Sees:* the network panel (a node graph, `web/src/ui/network/`) with a cut
  button per nation; that nation greys under a drifting mist, its queued moves pile up as
  wax-sealed letters by its capital with a tag like "silent 42 yrs, 49 queued", and its flag keeps
  playing. *Underneath:* the cut flips the bus link for that one agent (`server/src/engine/bus.ts`,
  `resilience.ts`); the globe reads `agents[].link` and `pendingEvents` (`web/src/globe/show/CutVeil.tsx`,
  `LetterPile.tsx`, `web/src/globe/status/StatusMarkers.tsx`). *Answer:* "Cut means no messages in
  or out, not stopped: the nation keeps ruling on what it last knew, and the letters are its real
  queued events."
- **Show beliefs (the stale map).** *Sees:* select a cut nation, press Show beliefs, and provinces
  it has got wrong pulse with a holo wash and dashed outline; the fill and borders follow its map,
  not the truth. *Underneath:* `belief(id)` returns that nation's own replica (`web/src/state/belief.ts`,
  `useBeliefRefresh.ts`); `web/src/globe/political/BeliefBorders.tsx` marks every tile whose believed
  owner differs from the real one. In mock mode the map is frozen at the cut (PR #231). *Answer:*
  "That is a second, real copy of the world that stopped hearing the news, not a visual effect."
- **Silence and return.** *Sees:* "silence ruler" turns the AI tag into AUTOPILOT; restoring a cut
  nation flies its letters to the other capitals and a cyan ripple lifts the mist; a deleted nation
  goes under a dark veil. Rulers proclaim with a parchment scroll (4.6 s, three at most, none from a
  cut ruler) in `web/src/globe/show/RulerScrolls.tsx`. *Underneath:* silence stops Gemini calls and
  uses `autopilotPolicy`; restore replays missed batches then merges the queue, and the earlier claim
  wins a dispute (section 4.11). *Answer:* "Return is a deterministic merge, so it looks the same
  whichever link comes back first."
- **Council kill and succession.** *Sees:* the Council section of the nation card shows ruler and
  general with ages; Kill asks to confirm (3 s), the seat goes vacant, the other member covers, and
  a successor appears years later. *Underneath:* `web/src/ui/card/Council.tsx` sends
  `control {action: 'kill'}`; the server `CouncilKeeper` (`server/src/engine/council.ts`,
  `packages/shared/src/sim/council.ts`) delivers one batch; succession is 8 years later and the
  successor inherits a memory summary (4.6). *Answer:* "Deaths, cover and coups are rules, so every
  replica derives the same outcome."
- **The event feed (fewer, important cards).** *Sees:* a left feed with at most one card every 2 s,
  full sentences, high-priority first (falls, wars, secessions, cut and return, decree results,
  wonders); small news is rolled into "N successions this decade". *Underneath:*
  `web/src/ui/feed/useFeed.ts` scores each chronicle event, drops candidates after 20 s and merges
  duplicates; the full chronicle is untouched. *Answer:* "The feed is a filter over the same log, so
  nothing is invented or hidden for good."
- **The decree box.** *Sees:* type or speak a decree; the box says "Proclaimed.", then a result line
  such as "PLAGUE: Plague across the Dorrin Horde: 59,315 dead (half its people)", plus a decree tab
  at top right that flies the camera to the target. *Underneath:* Gemini returns an effect and a
  severity from the words (clamped 0.05 to 0.8; keyword fallback), the effect scales with it
  (`server/src/engine/decrees.ts`); the decree chronicle entry carries `decree.{effect, severity,
  target, result}`; the UI is `web/src/ui/decree/DecreeBox.tsx` and `web/src/ui/chronicle/Herald.tsx`.
  A decree naming no place hits the whole nation; "the world", "everyone" or "all nations" hits every
  nation (`target.countryId: null`). *Answer:* "The model reads the words, but the rules decide the
  damage, and the result line is computed, not written by the model."
- **The Solana ledger UI.** *Sees:* the Treasury tab in the Network panel
  (`web/src/ui/economy/LedgerPanel.tsx`) lists each payment and its status; gold arcs between capitals
  (`web/src/globe/trade/Trade.tsx`); when Solana confirms, a red wax seal "on chain, abcd" stamps on
  the arc for 6 s (`web/src/globe/trade/ChainSeal.tsx`); clicking the seal or arc opens Solana
  Explorer, where the memo reads like `TN <id> y<year> <payer> pays <payee> <amount> TNC, <reason>`.
  *Underneath:* the server nets payments per pair in 5 s windows and sends one memo plus one
  TransferChecked signed by the payer's wallet (`server/src/chain/settle.ts`, `memoFor`); the row
  gets `signature` and `url` on confirmation. *Answer:* "The seal only appears after the chain says
  confirmed, and the memo is the reason the nation gave."
- **Terra Nova News with anchor and live close-ups.** *Sees:* a broadcast window with an animated
  anchor reading the bulletin, then cuts to a live close-up of each place it names with a LIVE bug
  and a caption strap. *Underneath:* `POST /api/broadcast` returns 1 to 3 `focus` beats
  (`server/src/story/broadcast.ts`); lip-sync comes from the audio analyser (`web/src/ui/news/lipsync.ts`,
  `AnchorWindow.tsx`); a second camera draws into a corner of the same WebGL buffer and is copied to
  a small canvas (`web/src/globe/pip/NewsPip.tsx`), so there is one context and the main camera never
  moves. *Answer:* "The close-up is the real globe filmed from a second camera, not a recording."
- **Era music.** *Sees (hears):* quiet instrumental music that changes with the leading nation's
  age and ducks under voices. *Underneath:* seven tracks made once with ElevenLabs Music
  (`server/scripts/make-era-music.ts`, files in `web/public/audio/music/`), played by
  `web/src/audio/music.ts` at 0.2 against voices at 1.0, ducked to 30% during speech, crossfaded
  over 5 s when the era changes. *Answer:* "Generated once ahead of time, so it costs no API calls
  at the table."
- **Presentation mode (P) and the collapsed screen.** *Sees:* the screen starts as globe, top bar
  and minimap with the ticker, history strip and decree box as small round icons; P hides every
  panel except the globe, the newest war tab and a year plate; P or Esc restores. *Underneath:*
  `web/src/ui/collapse/` (`useCollapsed.ts`, `presentation.ts`); state is in memory, so every
  reload starts collapsed and the demo resets between judges. *Answer:* "Nothing is removed, the
  panels just fold away so the world is what you see."
- **Army formations and the rocket launch.** *Sees:* an army is 3 to 7 small figures (infantry in
  front, mounted on the flanks, ranged behind) drawn from the nation's age, facing the march; a new
  satellite rises on a rocket from the capital, drops a booster that burns up, then joins orbit.
  *Underneath:* `web/src/globe/units/formation.ts` picks the figure count from summed strength and
  draws them through instanced models; `web/src/globe/orbit/Launch.tsx` runs the launch (about 10 s
  of real time) on each `-sat` chronicle line. *Answer:* "These are instanced models driven by the
  sim's state, so a bigger army and a launch are real events, not decoration."

## Per-person deep dive

- **Lane a (SamsSide), world, story and sound:** event log and `applyTickBatch`; the battle function;
  cut and restore with the dispute rule; the Gemini pipeline and budgets; ElevenLabs anthems.
  Tricky question: "how can replicas agree without a referee?" (section 4.2).
- **Lane b (CutGrass88), the globe and the economy:** rendering 1,200 provinces with instancing; map
  modes; units by age; payment arcs; the Solana ledger and its rate-limit design. Tricky question:
  "why isn't the treasury on chain?" (Q16).
- **Lane c (Justin-CODING-PY), interface:** the Create screen, nation card with council controls,
  chronicle and dispatches, network panel, decree box, ledger panel, projector layout. Tricky
  question: "what does the network panel actually switch?" (the bus link per nation).

## Per-person judge Q&A

Each of the three answers about their own lane. Short answers; if it is another lane's, hand over by
name. Deeper answers are in "Likely questions with answers" above.

**[name A], lane a (SamsSide): world, agents, Gemini, story and sound**

1. *Is there really no central controller?* The runner is a clock and an observer. Each nation
   decides its own events on its own replica; shared things are pure functions of shared data.
2. *How do replicas agree without a referee?* Battles and disputes are deterministic seeded
   functions of shared inputs, so every replica computes the same answer (section 4.2).
3. *What exactly is the LLM doing?* Little: one short schema-checked JSON decision per ruler every
   30 to 45 s, plus the world bible, lore, anthem lyrics, decrees and the news. Rules move the world.
4. *What if Gemini fails?* The nation drops to autopilot from its mood; the provider switch can move
   rulers to Gemma through the Gemini API or to local Gemma on this laptop with no internet.
5. *Does local Gemma count as Gemini?* Our entry is the Gemini API, including Gemma through it.
   Local Gemma is the offline fallback. We found no public MLH wording that says either way.
6. *Is it really distributed?* No: all agents run in one Node process and the cut is a software
   switch on the bus. Multi-laptop agents were cut. The design (replicas, messages, merge) is what
   would carry over.
7. *How are the anthems made?* Gemini writes lyrics from the nation's real chronicle; ElevenLabs
   Music sings them; the cache is by content hash.

**[name B], lane b (CutGrass88): the globe and the economy**

1. *How does it run 1,200 provinces smoothly?* Instanced models, layers that rewrite only what
   changed, a capped pixel ratio, and world reads at most ten times a second.
2. *Does it hold 60 frames a second?* Yes in orbit at normal speeds: about 150 on the demo laptop
   (production build, RTX GPU), 130 at ground level. At the top gear with local Gemma answering it
   drops to about 50 with visible hitches; a saved replay holds about 145 at ten years a second.
3. *Is the Solana payment real?* A real devnet Token-2022 transfer plus a memo, signed by the paying
   nation's own key. Click an arc to open it in the Explorer.
4. *Why isn't the treasury on chain?* The simulation is the source of truth; the chain is a mirror
   that settles every 5 seconds, so replays stay exact and the sim never waits on the network.
5. *What stops someone printing money?* Fixed supply of 1,000,000 and the mint authority revoked at
   genesis.
6. *What about devnet rate limits?* Payments are netted into 5-second windows, sent a few at a
   time and confirmed by polling; the overflow rolls into the next window.
7. *What are the armies and satellites?* Instanced models driven by sim state, so a bigger army or
   a launch is a real event, not decoration.

**[name C], lane c (Justin-CODING-PY): the interface**

1. *What does the network panel actually switch?* The bus link per nation, a ruler's silence, a
   deletion, or a general's death: real controls on the agents, shown as a node graph.
2. *How did you design it?* In Figma, in an old-atlas style, then calmed to one left panel and given
   a shared material system; it is built to a 720 px projector.
3. *Why a collapsed screen?* A 2-minute demo: presentation mode shows the globe, top bar and
   minimap, and the chronicle, ledger and decree open on click.
4. *How does the spoken decree work?* Hold the mic: the browser records audio, Gemini hears it
   directly (no separate speech-to-text) and the engine turns it into an event.
5. *How does the news anchor work?* The page captures the globe, Gemini writes a bulletin from the
   image and the chronicle, and an animated anchor reads it in one of our cloned voices.
6. *How did you build against other lanes?* Against mocks of the contracts in `docs/contracts.md`,
   swapped for the real thing at the checkpoint.
7. *What is not finished?* Painted flags need image billing. The hand tests run on the final build
   passed, but not every row in the lane files has been signed off by a person (many still say
   `testing`).
