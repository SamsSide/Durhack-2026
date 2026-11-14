# Terra Nova: submission draft

*First draft, 14 Nov 2026, written by lane a for row C5. Lane c keeps the final edit and submits.
Everything here is checked against the lane files (`docs/lanes/`), the code on `main` and the
facts the owner verified on 14 Nov. Rows that are still `testing` are marked so in section 2;
rows that are `todo` or `cut` are not claimed. British English, no emojis.*

---

## 1. Devpost fields

### Project name

Terra Nova

### Tagline

Type one line and watch a living planet build itself, every nation ruled by its own AI, and the
world keeps going when they cannot talk to each other.

### Inspiration

The theme was Composition, and we wanted to compose something bigger than a song: a whole world,
with its maps, its history, its money and its music, written live by many authors at once. We
love grand-strategy map games, where a political map slowly fills with borders, towns and wars,
but in those games one engine decides everything. We asked what happens if nobody is in charge.
Give each nation its own mind, let them trade, argue and fight, then pull the plug on one of
them and see whether the world holds together.

Neptune North's brief gave the second half of the idea: actors that work towards a common goal,
decide for themselves and keep making progress when their links fail. Marshall Wace asked for
New Worlds. We took both literally.

### What it does

You type a prompt ("a drowned post-apocalyptic world"), optionally drop in a picture, pick how
many nations and press Create. Within seconds a planet of about 500 irregular provinces forms on
a globe you can spin and zoom. Gemini writes a world bible: each nation gets a name, a leader, a
government, an ideology, a founding myth, a flag and a building style. Place names quietly echo
Durham colleges and North East towns.

Then time runs. Each nation is an independent agent with its own copy of the world. It claims
land, builds camps that become towns and cities, raises wonders, and moves through the ages, from
bows and galleys to tanks, maglev freighters and starships. Merchant ships cross the oceans
between trading partners. Armies march province by province, battles flash, fronts form, peace
treaties hand over land, and restless regions break away as new nations with their own rulers.
A chronicle tells the story as it happens.

Click a nation and its card slides in: its culture, politics, history with each neighbour, its
ruler and general, and its treasury. A voice narrates its lore. Its anthem, written by Gemini
from what has actually happened to it and sung by ElevenLabs Music, plays. When it goes to war
you hear its war chant. Every couple of minutes "Terra Nova News" comes on: Gemini looks at a
capture of the globe and writes a bulletin, read by a news anchor in one of our own cloned
voices. You can speak a decree ("a plague in the north") and Gemini hears it and turns it into
an event that strikes the world.

Money is real, on Solana devnet. The world has one currency, a Token-2022 token with on-chain
metadata, a fixed supply of 1,000,000 and its mint authority revoked, so nobody can print more.
Every nation has its own wallet. Every payment between nations (trade dues, reparations, plunder,
seized treasuries, war chests, subsidies, pooled war funds) is a memo plus a TransferChecked
signed by the paying nation's own key. In a two-minute test run, 35 payments were confirmed on
devnet with every nation's balance in step with the simulation (drift 0).

The best part is breaking it. The network panel lets you cut a nation's link, silence its ruler,
delete it, or kill its general. A cut nation keeps building on what it last knew while its map
drifts from the truth; its neighbours notice the silence. A deleted nation's land becomes ruins
that its neighbours carve up. A dead general is covered by a stand-in, then succeeded by a new
one who inherits the old one's memory. Restore the link and the missing years merge in: clashing
claims are settled on screen and the chronicle records the dispute.

### How we built it

- **TypeScript everywhere**, in npm workspaces: `packages/shared` (types, the sphere, the rules,
  `applyEvent`), `server` (Node 22, Express, `ws`) and `web` (Vite, React, three.js with
  react-three-fiber and drei, zustand).
- **The world is an event log.** Nothing changes in place. Every change is an event, and
  `applyEvent` is the only function that changes a world; the server and the browser share it.
  A saved log replays a run exactly with no API calls, which is also our offline backup.
- **Rules move the world, the LLM rules the nations.** A deterministic simulation ticks every
  half second: income, land, building, armies, battles, terrain effects, trade and payments are
  plain code. Battles are a pure function of both sides' strength and a seeded hash, so every
  agent computes the same result with no referee. Every 30 to 45 seconds each ruler sends Gemini
  a short digest and gets back schema-checked JSON: a focus, stance changes and one line for the
  chronicle. Any failure drops that nation to autopilot.
- **Agents and a message bus.** Each nation (and each nation's general) is its own agent with its
  own replica, publishing events on a bus whose link to each agent can be switched off. Cut,
  silence, delete, kill and restore are controls on that bus and on the agents.
- **The globe** is a spherical Voronoi of about 500 convex provinces (quickhull on the sphere),
  drawn as raised land with cliffs, borders, map modes, rivers, clouds, a day and night cycle and
  100 low-poly GLB models (buildings in ten styles, units for seven ages, wonders) made with
  headless Blender.
- **Gemini** (`gemini-3.5-flash-lite` for rulers, the world bible, images and voice;
  `gemini-3.5-flash` for lore) does the world bible, ruler decisions, lore and anthem lyrics,
  reads the Create-screen picture, hears spoken decrees and watches the map for the news.
- **ElevenLabs** does narration (`eleven_multilingual_v2`), war chants (`eleven_v3` with a
  shouting tag), anthems (Music, `music_v1`, from a composition plan with sung lyrics) and our
  three cloned voices as news anchors, narrators and the royal herald. Everything is cached on
  disk by content hash.
- **Solana** via `@solana/kit` 8.6, Token-2022 and the Memo program (never `web3.js`). The
  simulation stays the source of truth; the chain is a mirror that settles every 5 seconds, so
  replays stay exact and the simulation never waits on the network.
- **Tiger Data** (optional): every event and each nation's stats go into hypertables with a
  real-time continuous aggregate for territory over time.
- **The interface** was designed in Figma in an old-atlas style (parchment, serif type, ink
  borders) and built from that design.
- **Three people, many agents.** Each of us ran Claude Code agents on our own laptop, in our own
  lane, coordinating only through GitHub issues and pull requests. About 180 pull requests landed
  in 24 hours. Agent sessions were captured with Entire.

### Challenges we ran into

- **Keeping independent agents in agreement without a referee.** The fix was to make everything
  that two agents might disagree on (battles, disputed tiles after a cut) a deterministic function
  of shared inputs, so they compute the same answer apart.
- **Reconciliation after a cut.** A cut nation queues its events and acts on stale beliefs. On
  restore, both sides swap what the other missed, and clashing claims on a province are settled
  by one rule and written into the chronicle.
- **Money between nations.** At first the simulation had no flows between nations at all, only
  each nation's own treasury. We added a `payment` event and its sources, then had to fix the
  order in which treasuries were applied so the chain mirror never disagreed with the sim.
- **Devnet rate limits.** The public devnet endpoint throttles bursts. We net payments into
  5-second windows, send a few transactions at a time with fixed compute limits, confirm by
  polling, and back off; the overflow rolls into the next window.
- **Speed of Gemini at world creation.** The world bible took about 28 seconds on flash; moving it
  to flash-lite cut it to about 5, which fits the 15-second demo step.
- **Content filters.** The music model rejects prompts that say "national anthem", so the prompt
  never does.
- **Many agents, one repo.** Three laptops and up to seven agents at once meant constant merge
  pressure. Lanes own folders, contracts are written down first, every lane builds against a mock,
  and main only changes through pull requests.

### Accomplishments that we're proud of

- A world that keeps building when its parts cannot talk, with the failure shown on screen rather
  than hidden.
- Each anthem is written from the nation's own history, so no two sound alike and each one tells
  you what happened to that nation.
- A real token economy on Solana where every nation signs its own payments, with a fixed supply
  nobody can inflate.
- Gemini used three ways beyond text: it reads a picture, hears a voice and watches the map.
- The team's own voices presenting the world to the judges.
- A run that replays exactly, offline, from its event log.

### What we learned

- Determinism is what makes decentralised agents cheap. Once battles and disputes were pure
  functions, we needed no central server to keep the peace.
- An LLM is best used rarely and with a schema. One short JSON decision per ruler every half a
  minute, with rules doing the rest, kept us inside a small token budget and kept the world
  running when the model failed.
- A blockchain is a good mirror and a bad source of truth for a real-time sim. Settling every
  5 seconds, signed by each nation, gives an auditable ledger without making the game wait.
- Smaller models are often the right call: flash-lite read images in about 7 seconds and audio in
  about 1.3 seconds, fast enough for a live demo.
- Writing contracts and mocks before code is what let three people's agents work in parallel from
  the first hour.

### What's next

- Agents on separate machines, so a cut is a real network partition and not a software switch.
- A timeline scrubber that rebuilds the globe at any past year from the event log.
- Letting a viewer play as one nation alongside the AIs.
- AI-painted flags (built, waiting on image billing).
- A live territory chart in the interface fed from the Tiger Data continuous aggregate.

### Built with

TypeScript, Node.js 22, Express, ws (WebSockets), React 18, Vite, three.js, react-three-fiber,
drei, zustand, quickhull3d, Google Gemini API (`@google/genai`; gemini-3.5-flash and
gemini-3.5-flash-lite; image and audio input), ElevenLabs (text to speech, eleven_v3, Music API,
voice cloning), Solana devnet (`@solana/kit`, Token-2022, Memo program), Tiger Data
(TimescaleDB, `pg`), Blender (headless, Python), Figma, Claude Code, Entire, GitHub.

---

## 2. Prize sections

One section per prize we target (`docs/hackathon-plan.md` section 3, plus Solana from the
decision of 14 Nov 19:20). For each: the criteria, how we meet them, and where to look.

### 2.1 Main track (theme: Composition)

Criteria: Creativity and Innovation; Technical Competence and Execution; Research and Learning;
Polish and Completion.

| Criterion | How we meet it | Where |
| --- | --- | --- |
| Creativity and Innovation | A world, its history, its money and its music composed live by many independent authors; "idea mixing" of grand strategy, LLM agents, voice, music and a blockchain | Whole app; demo steps 1 to 4 |
| Technical Competence | Event-sourced world shared by server and browser; deterministic seeded battles; per-nation agents on a switchable bus; spherical Voronoi globe with 100 models at speed; on-chain mirror with rate-limit handling | `packages/shared/src/world.ts`, `packages/shared/src/sim/`, `server/src/engine/bus.ts`, `server/src/agents/`, `server/src/chain/` |
| Research and Learning | Research notes for every sponsor, Solana economy design, building styles, nation identity; "What we learned" above | `docs/prizes/`, `docs/research/` |
| Polish and Completion | Figma design built to a 720 px projector; exact offline replay as a backup | `docs/design/`, `server/replays/demo-1.json` |

Weak spots: `docs/documentation.md` (the judges' briefing) is still empty headings. Several
rows are built but still `testing` (see Gaps).

### 2.2 Neptune North: Actors work better together

Use their four criteria as headings in the Devpost text and at their stand.

- **Working towards a common goal.** Every nation and every general is an agent; together they
  build one shared world and one chronicle. Agents publish events on a bus and each keeps its own
  replica. Where: `server/src/agents/nation.ts`, `server/src/engine/bus.ts`, `packages/shared/src/sim/sync.ts`.
- **Independent decision-making.** No world controller. Each ruler decides only for its own
  nation (Gemini, or autopilot from its temperament); each general acts as its own agent. Battles
  are settled by a pure seeded function, so each side computes the outcome itself. Where:
  `server/src/agents/ruler.ts`, `packages/shared/src/sim/war.ts`, `packages/shared/src/sim/council.ts`.
- **Resilience when communications fail.** Cut a link: the nation keeps building on stale
  beliefs, queues its events, and its "what it believes" map drifts from the truth. Silence a
  ruler: autopilot. Delete a nation: neighbours stop hearing its heartbeat and carve up the ruins.
  Kill or cut a general: a stand-in covers at reduced skill, then a successor inherits the
  predecessor's memory. Restore: missing events merge, disputes are settled by one deterministic
  rule and written into the chronicle. Where: `server/src/engine/resilience.ts`,
  `server/src/engine/council.ts`, `web/src/ui/` network panel and council on the nation card
  (rows A7, A29, B7, C4, C11).
- **Something we're excited about.** A world nobody controls that tells its own story, and the
  failure is the best part of the show.

Honest limit to say out loud: all agents run in one Node process on one laptop and the cut is a
software switch on the bus (multi-laptop agents, row A10, was cut by the owner).

### 2.3 Marshall Wace: New Worlds

- **Criterion (brief):** explore New Worlds; open a door to the unexplored; any interpretation.
- **How:** every run is literally a new world nobody has seen, from one line or a picture, and
  it moves through ancient to stellar ages. Open the pitch with the words "New Worlds".
- **Data angle (MW is a data house):** the world is an event log; every run can be replayed, and
  its economy is an auditable on-chain ledger.
- **Where:** Create screen (C1, C6), world bible (`server/src/engine/bibleAi.ts`), ages
  (`packages/shared/src/sim/ages.ts`).

### 2.4 Waterstons: connecting things that aren't usually connected (weak fit)

One honest line: we connected language models, a deterministic simulation, cloned human voices,
generated music and a public blockchain into one living map, so anyone can watch how independent
decision-makers cooperate and recover when their links fail. Who benefits is the weak part: say
it is a teaching tool for distributed systems and resilience.

### 2.5 MLH Best Use of ElevenLabs

- **Criterion (seen at other MLH events):** voice or audio is a meaningful part of the
  experience, not a read-aloud button.
- **How:** four kinds of audio, all generated from the world's own events. Narration of each
  nation's lore in a voice picked from its style; an anthem sung by ElevenLabs Music from lyrics
  written from the nation's history; a war chant per nation played automatically when it fights
  (`eleven_v3` with a shouting tag); Terra Nova News read by news anchors in the team's own
  cloned voices, who also narrate up to three nations and herald decrees. Prompts are shaped by
  each nation's era and government. Cached on disk by content hash.
- **Where:** `server/src/story/eleven.ts`, `anthem.ts`, `chant.ts`, `broadcast.ts`,
  `teamVoices.ts`; `web/src/audio/` (rows A14 done, A15 and A16 `testing`, A21 done).
- In the write-up, name the features: TTS, eleven_v3 audio tags, Music API with composition plan,
  Instant Voice Cloning.

### 2.6 MLH Best Use of Gemini API

- **Criterion (seen elsewhere):** Gemini does real work; multimodal input and structured output
  count; say which models.
- **How:**
  - Text: the world bible at creation, every ruler's decisions as schema-checked JSON, lore,
    anthem lyrics from the real chronicle.
  - Image in: a picture on the Create screen sets the world's mood, palette and setting (A17).
  - Audio in: a spoken decree is heard directly by Gemini and turned into an event with an effect
    (A20).
  - Image in, voice out: Terra Nova News, Gemini watching a capture of the globe plus the recent
    chronicle (A21).
  - Models: `gemini-3.5-flash-lite` (rulers, bible, image and voice) and `gemini-3.5-flash`
    (lore). Token meter on the top bar, hard caps, autopilot on any failure.
- **Where:** `server/src/llm/index.ts`, `server/src/engine/bibleAi.ts`, `server/src/agents/ruler.ts`,
  `server/src/story/loreAi.ts`, `server/src/story/broadcast.ts`, `server/src/engine/decrees.ts`.

### 2.7 MLH Best Use of Entire

- **Criterion (brief):** use Sessions, Graph and Brain (and Trails); seamless human-AI
  collaboration, clean code history, measurable token efficiency.
- **How:** Entire is enabled for Claude Code on every laptop (`.entire/settings.json`, hooks in
  `.claude/settings.json`); sessions are captured and linked to commits with the
  `Entire-Checkpoint` trailer. Clean history: about 180 squash-merged pull requests with plain
  subjects, lanes, contracts and an append-only decision log.
- **Where:** `.entire/`, `docs/decisions.md`, `git log`, `docs/prizes/P3-entire.md`.
- **Weak:** session push is off, and Graph, Brain, Trails and the entire.com mirror are not set
  up yet (see Gaps). No token-efficiency numbers yet.

### 2.8 MLH Best Use of Solana

- **Criterion (inferred, no rubric):** real use of Solana, a use case that needs speed or low
  cost, a working demo with a visible devnet transaction, Solana-native pieces.
- **How:** a Token-2022 world currency with on-chain metadata, a fixed supply of 1,000,000 and
  the mint authority revoked at genesis; one wallet per nation plus a Commons wallet; every
  payment between nations is a memo plus TransferChecked signed by the paying nation's own key.
  Payments come from trade dues, reparations, plunder, seized treasuries, war chests, subsidies
  and pooled war funds. Verified live on 14 Nov: a 2-minute run confirmed 35 payments, all nations
  in sync, drift 0. Explorer links are built for every transaction. The "why chain" sentence:
  many small, frequent payments between independent agents that do not trust each other, each
  signed by the payer, with a supply nobody can inflate.
- **Where:** `server/src/chain/genesis.ts`, `settle.ts`, `wallets.ts`, `routes.ts`
  (`GET /api/economy`); `packages/shared/src/sim/payments.ts`, `trade.ts`; the Treasury tab and
  "Treasury on Solana" on the nation card (C9); `scripts/solana-keys.ts`; screenshot
  `docs/shots/solana-devnet-payment.jpg`.

### 2.9 MLH Best Use of Tiger Data (stretch)

- **Criterion:** the most innovative, impactful and performance-driven use of Tiger Data.
- **How:** every world event and each nation's stats go into two hypertables
  (`world_events`, `nation_stats`) with a real-time continuous aggregate
  (`nation_territory_10s`), served at `GET /api/stats/territory` and `GET /api/stats/summary`.
  Off unless `TIGER_DATABASE_URL` is set; never blocks the tick.
- **Where:** `server/src/tiger/store.ts`, `server/src/tiger/routes.ts` (row A11, `testing`).
- **Weak:** nothing in the web app shows the territory chart yet, and the plan asked for one live
  chart.

### Gaps

- **Main track:** `docs/documentation.md` is empty; B8 polish is `wip`, B9 timeline scrubber is
  `todo`; many rows are `testing` (A15, A16, A19, A26, A28, A29, A30, B5, B7, C1 to C4, C6 to
  C11) and need a human pass before the video.
- **Neptune North:** strong. Risk is only the question "is it really distributed?": all agents in
  one process, the cut is a software switch. Council kill (A29, C11) is `testing`.
- **Marshall Wace:** framing only; needs the pitch to open with "New Worlds" and a visit to
  their stand.
- **Waterstons:** weak fit; the "who benefits" line is thin.
- **ElevenLabs:** anthem and chant (A15, A16) not yet listened to by a person; character budget
  is 30,000 per run on the Starter plan, so record the demo world's audio once.
- **Gemini:** painted flags need image billing and return 503; spoken decrees not yet tested with
  a real browser microphone (A20 note); the MLH Gemini category date label needs checking on the
  DurHack Devpost.
- **Entire:** `push_sessions` is false; Graph, Brain, Trails and the mirror are not set up; no
  token numbers. This is the weakest MLH entry as things stand.
- **Solana:** ledger rework awaits the owner's live run (A27 note); the Commons wallet must be
  funded from the faucet before the demo; keep the saved signature file as the fallback.
- **Tiger Data:** no chart in the interface; needs a Tiger Cloud URL in the demo `.env`.

---

## 3. Two-minute demo video: shot list

Matches the demo script in `docs/hackathon-plan.md` section 2. Record in live mode
(`LLM_MODE=live`, `SOLANA_MODE=devnet`) with the demo world's audio already cached; keep the
replay (`server/replays/demo-1.json`) as the backup take.

| Time | Shot | Voice-over (short) |
| --- | --- | --- |
| 0:00 to 0:08 | Title card, then the Create screen. Type "a drowned post-apocalyptic world", drop a picture, six nations | "Terra Nova. New Worlds, composed live by AIs." |
| 0:08 to 0:20 | Press Create. The planet forms; six nations named and placed with flags and leaders | "Gemini reads the prompt and the picture and writes a world bible." |
| 0:20 to 0:35 | Time runs fast. Borders spread, camps become cities, models pop up, ages advance, trader ships cross the sea, chronicle ticker | "Each nation is its own agent. Rules move the world; Gemini rules each nation." |
| 0:35 to 0:48 | Click a nation. Border lights, card slides in. Narration in a team voice, then a few bars of its anthem | "Its anthem is written from what has actually happened to it." |
| 0:48 to 1:00 | A war breaks out. Armies march, volleys, tiles change colour, war chant. Switch to diplomacy mode | "Wars are fought province by province, settled by a seeded function, no referee." |
| 1:00 to 1:12 | Gold payment arcs on the globe; open the Treasury tab; cut to the Solana Explorer page of one payment (as in `docs/shots/solana-devnet-payment.jpg`): Success, devnet, the memo | "Every payment is a real devnet transfer, signed by the paying nation's own wallet. Fixed supply, nobody can print money." |
| 1:12 to 1:30 | The moment. Network panel: cut one nation mid-war. Static ring, beliefs view drifting from the truth, neighbours notice the silence. Delete a second nation: it crumbles, neighbours carve the ruins | "Cut off, it keeps building on what it last knew." |
| 1:30 to 1:40 | On a nation card, kill its general (two clicks). Stand-in covers, then a successor takes over with the old general's memory | "Even inside a nation, the actors recover." |
| 1:40 to 1:50 | Restore the link. Missing years merge, disputes settled on screen, chronicle records the Silence. Hold a spoken decree ("a plague in the north") and see it strike | "Bring it back and the history merges in." |
| 1:50 to 2:00 | Terra Nova News lower-third for a few seconds, then the closing card with the token meter; end on the repo URL and the Entire sessions page | "This whole world cost N tokens. Built by three people and their agents." |

---

## 4. What a human must still do to submit

- [ ] Find the submission platform and deadline (Devpost page was not live on 14 Nov 13:35);
      hacking ends Sunday 12:00.
- [ ] Hand-test the `testing` rows that appear in the video (anthem, chant, council kill, war
      look, ripple and crumble, spoken decree with a real microphone).
- [ ] Fund the Commons wallet from the devnet faucet; run `SOLANA_MODE=devnet` once and save a
      fresh Explorer link for the video and the write-up.
- [ ] Record the 2-minute video to the shot list, upload it (YouTube or Vimeo, public or
      unlisted) and paste the link.
- [ ] Make the repository public (or confirm judges can see it) and paste the link. Before that,
      decide on Entire session push: once on, transcripts become public with the repo.
- [ ] Owner: turn on Entire `push_sessions`, set up Graph, Brain, the mirror and if possible one
      Trail; take a screenshot of the sessions page and token numbers.
- [ ] Optional: set `TIGER_DATABASE_URL` and add a territory chart, or untick Tiger Data.
- [ ] Copy section 1 into the Devpost fields; add screenshots (globe, nation card, network panel
      during a cut, Treasury tab, Explorer page) to `docs/shots/` and the gallery.
- [ ] Add all three team members to the Devpost project (SamsSide, CutGrass88, Justin-CODING-PY).
- [ ] Tick the prizes: main track; Neptune North; Marshall Wace New Worlds; Waterstons; MLH
      ElevenLabs, Gemini, Entire, Solana; Tiger Data only if it is shown.
- [ ] Fill `docs/documentation.md` for judges who read the repo (`durhack-explain`).
- [ ] Visit the Neptune North and Marshall Wace stands; rehearse the demo three times (CP3).
- [ ] Bring a speaker for the audio and a saved replay as the offline backup.
- [ ] After the event: optional DEV post.
