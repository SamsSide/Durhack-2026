# Terra Nova: submission text

*Ready to paste, 14 Nov 2026, sections 1 and 2 rewritten 15 Nov 2026 in the final prize review. Lane c keeps the final edit and
submits. Checked against the lane files (`docs/lanes/`), `docs/decisions.md` and the code on
`main`. Anything still needing a human look is marked `[check]`. British English, no emojis.*

---

## 1. Devpost fields

### Project name

Terra Nova

### Tagline (one line)

A new world composed live by AIs that keep working together when they cannot talk to each other.

### Short description

Type one line, or drop in a picture, and a living 3D planet builds itself. Every nation is ruled
by its own independent Gemini agent with its own wallet on Solana: it settles, trades, pays and
fights from bows to starships, with narrated histories, anthems sung from what really happened
and a news broadcast in our own voices. Rulers run on Gemini, Gemma through the Gemini API or
local Gemma, and nations have moods that shift with their history. Cut a nation off, silence its ruler, delete it or kill its
general, and the world keeps building; restore it and its missing years merge in.

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

Then time runs, from a week a second to ten years a second (new worlds start at a month a
second, and a director slows down for big moments). Each nation is an independent agent with its own copy of the world. It claims
land, builds camps that become towns and cities, raises wonders, and moves through the ages, from
bows and galleys to tanks, maglev freighters and starships. Merchant ships cross the oceans
between trading partners. Armies march province by province, battles flash, fronts form, peace
treaties hand over land, and restless regions break away as new nations with their own rulers.
Roads of boats, caravans, birds and smoke fill the map, clouds and storms drift past, cities
grow walls as they grow, armies go round mountains and stop at enemy lines, and rulers and
generals grow old and die. Each nation has a mood (aggression, expansion, trade, faith) that
hardens in war and eases in peace, and the chronicle says when it turns. Modern nations launch
rockets and put satellites in orbit, and in an all-out war one side may shoot a rival's satellite
down. Armies, wars and the interface move with weight and flourish. A chronicle tells the story
as it happens. Naval battles and ports `[check: if landed]`.

Click a nation and its card docks on the left (one panel at a time, so the globe stays clear): its culture, politics, history with each neighbour, its
ruler and general, and its treasury. A voice narrates its lore. Its anthem, written by Gemini
from what has actually happened to it and sung by ElevenLabs Music, plays. When it goes to war
you hear its war chant. Every couple of minutes "Terra Nova News" comes on: Gemini looks at a
capture of the globe and writes a bulletin, read in one of our own cloned voices by an animated
anchor in a studio window. You can speak a decree ("a plague in the north") and Gemini hears it and turns it into
an event that strikes the world.

Money is real, on Solana devnet. The world has one currency, a Token-2022 token with on-chain
metadata, a fixed supply of 1,000,000 and its mint authority revoked, so nobody can print more.
Every nation has its own wallet. Every payment between nations (trade dues, reparations, plunder,
seized treasuries, war chests, subsidies, pooled war funds) is a memo plus a TransferChecked
signed by the paying nation's own key. In a two-minute test run, 35 payments were confirmed on
devnet with every nation's balance in step with the simulation (drift 0) `[check: re-run on the
final build]`. For a demo, prepare mode pauses a new world while its lore, narration, chants,
anthems and first decisions are made, so nothing stutters when play starts.

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
- **The globe** is a spherical Voronoi of about 1,200 convex provinces (quickhull on the sphere),
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
- **An LLM provider switch.** `LLM_PROVIDER` chooses Gemini, Gemma through the Gemini API,
  local Gemma through Ollama, or a hybrid (local Gemma for ruler turns, Gemini for the rest). All
  paths return the same schema-checked JSON, so the world does not care which model answered.
- **A Windows desktop app.** `npm run demo` opens Terra Nova with settings, a preflight that
  tests every enabled service (Gemini, ElevenLabs, Solana, Ollama) and then the game.
- **The interface** was designed in Figma in an old-atlas style (parchment, serif type, ink
  borders), then calmed in the spirit of grand-strategy map games (one left panel, small war tabs,
  a node-graph network panel, icon map modes) and given a shared material system (depth, bevels,
  engraved names, plated badges) in a final polish pass.
- **Built to stay small.** The server caps its memory: the chronicle is a recent window trimmed by
  the shared `applyEvent`, and the full event log streams from disk, so long worlds stay small.
- **Three people, many agents.** Each of us ran Claude Code agents on our own laptop, in our own
  lane, coordinating only through GitHub issues and pull requests. About 270 pull requests landed
  in 24 hours.

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
- **A frozen browser tab.** A label loop on the payment arcs starved the page; we fixed it and
  made the server ride out chain and socket errors instead of dying.
- **Memory on long worlds.** Keeping every event on the heap grew without end; the chronicle is
  now a window and the log lives on disk.
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
- Gemini used three ways beyond text: it reads a picture, hears a voice and watches the map, and
  the same rulers can run on Gemma, even offline.
- The team's own voices presenting the world to the judges.
- A UI with real depth and material, not flat panels, in a single day.
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
- Districts and farmers inside provinces, and more of the economy (loans, banks).
- Letting a viewer play as one nation alongside the AIs.
- AI-painted flags (built, waiting on image billing).

### Built with

TypeScript, Node.js 22, Express, ws (WebSockets), React 18, Vite, three.js, react-three-fiber,
drei, zustand, quickhull3d, Google Gemini API (`@google/genai`; gemini-3.5-flash and
gemini-3.5-flash-lite; image and audio input), ElevenLabs (text to speech, eleven_v3, Music API,
voice cloning), Solana devnet (`@solana/kit`, Token-2022, Memo program), Gemma
(through the Gemini API, or local with Ollama), Blender (headless, Python), Figma, Claude Code, GitHub.

---

## 2. Prize sections

One section per prize we enter. Final review on 15 Nov 2026 (see `docs/prizes/final-review.md`
for the full enter/skip table and the exact Devpost ticks). Not entered, by owner ruling: MLH
Best Use of Entire and MLH Best Use of Tiger Data. Terra Nova is software only, so the hardware
challenges are skipped. Items from the naval-battle and ports work are marked `[check: if landed]`.

### 2.1 Main track (theme: Composition)

Criteria: Creativity and Innovation; Technical Competence and Execution; Research and Learning;
Polish and Completion.

| Criterion | How we meet it | Where |
| --- | --- | --- |
| Creativity and Innovation | A world, its history, its money and its music composed live by many independent authors; "idea mixing" of grand strategy, LLM agents, voice, music and a blockchain. New this round: nations have a national mood that drifts with what happens to them, and wars reach orbit (satellites are launched, and shot down in all-out wars) | Whole app; demo steps 1 to 4; `docs/shots/satellite-strike.jpg` |
| Technical Competence | Event-sourced world shared by server and browser; deterministic seeded battles; per-nation agents on a switchable bus; spherical Voronoi globe with 100 models at speed; on-chain mirror with rate-limit handling; an LLM provider switch (Gemini, Gemma through the Gemini API, local Gemma, or a mix) with a fallback to autopilot on any failure | `packages/shared/src/world.ts`, `packages/shared/src/sim/`, `server/src/engine/bus.ts`, `server/src/agents/`, `server/src/chain/`, `server/src/llm/` |
| Research and Learning | Research notes for every sponsor, Solana economy design, building styles, nation identity, model-size trade-offs ("What we learned" above) | `docs/prizes/`, `docs/research/` |
| Polish and Completion | Figma design built to a 720 px projector; exact offline replay as a backup; a Windows desktop app (`npm run demo`) with settings and a preflight that tests every enabled service before the demo; army, war and interface motion; naval battles and ports `[check: if landed]` | `docs/design/`, `server/replays/demo-1.json`, `desktop/`, `npm run demo:check` |

Extra polish to point at: the material-system UI pass (`docs/shots/depth-*-after.jpg`,
`materials-sheet.jpg`), the calm UI (`calm-ui-*.jpg`), a living world (`living-world-*.jpg`), the
animated news anchor (`news-anchor-*.jpg`) and the army and battle cards (`army-card.jpg`,
`battle-card.jpg`). Weak spots: many rows are still `testing` (see Gaps).

### 2.2 Neptune North: Actors work better together

Use their four criteria as headings in the Devpost text and at their stand.

- **Working towards a common goal.** Every nation and every general is an agent; together they
  build one shared world and one chronicle. Agents publish events on a bus and each keeps its own
  replica. Where: `server/src/agents/nation.ts`, `server/src/engine/bus.ts`, `packages/shared/src/sim/sync.ts`.
- **Independent decision-making.** No world controller. Each ruler decides only for its own
  nation (an LLM, or autopilot from its national mood); each general acts as its own agent.
  Battles are settled by a pure seeded function, so each side computes the outcome itself. Each
  nation's mood (aggression, expansion, trade, faith) shifts with its own history and steers its
  own choices. Where: `server/src/agents/ruler.ts`, `packages/shared/src/sim/war.ts`,
  `packages/shared/src/sim/council.ts`.
- **Resilience when communications fail.** Cut a link: the nation keeps building on stale
  beliefs, queues its events, and its "what it believes" map drifts from the truth. Silence a
  ruler: autopilot. Delete a nation: neighbours stop hearing its heartbeat and carve up the ruins.
  Kill or cut a general: a stand-in covers at reduced skill, then a successor inherits the
  predecessor's memory. Restore: missing events merge, disputes are settled by one deterministic
  rule and written into the chronicle. The model layer fails the same way: if the Gemini API
  drops, rulers fall to autopilot, or the provider switch can move them to local Gemma on the
  same laptop with no internet at all. Where: `server/src/engine/resilience.ts`,
  `server/src/engine/council.ts`, `server/src/llm/`, `web/src/ui/` network panel and council on
  the nation card.
- **Something we're excited about.** A world nobody controls that tells its own story, and the
  failure is the best part of the show.

Honest limit to say out loud: all agents run in one Node process on one laptop and the cut is a
software switch on the bus (multi-laptop agents were cut by the owner).

### 2.3 Marshall Wace: New Worlds

- **Criterion (brief):** explore New Worlds; open a door to the unexplored; any interpretation.
- **How:** every run is literally a new world nobody has seen, from one line or a picture, and
  it moves through ancient to stellar ages, up to rockets, satellites and wars fought in orbit.
  Open the pitch with the words "New Worlds".
- **Data angle (MW is a data house):** the world is an event log; every run can be replayed, and
  its economy is an auditable on-chain ledger.
- **Where:** Create screen, world bible (`server/src/engine/bibleAi.ts`), ages
  (`packages/shared/src/sim/ages.ts`).

### 2.4 Waterstons: connecting things that aren't usually connected (weak fit)

One honest line: we connected language models (cloud or running locally), a deterministic
simulation, cloned human voices, generated music and a public blockchain into one living map, so
anyone can watch how independent decision-makers cooperate and recover when their links fail.
Who benefits is the weak part: say it is a teaching tool for distributed systems and resilience.
Tick only if the form is free; it costs nothing.

### 2.5 MLH Best Use of ElevenLabs

- **Criterion (MLH brief, 13 Nov):** "natural, human-sounding audio ... realistic, dynamic, and
  emotionally expressive voices ... Integrate fully autonomous audio experiences into your hack
  and give your project a voice." Audio must be a meaningful part, not a read-aloud button.
- **How:** four kinds of audio, all generated from the world's own events. Narration of each
  nation's lore in a voice picked from its style; an anthem sung by ElevenLabs Music from lyrics
  written from the nation's history; a war chant per nation played automatically when it fights
  (`eleven_v3` with a shouting tag); Terra Nova News read by news anchors in the team's own
  cloned voices, who also narrate up to three nations and herald decrees. Satellite shoot-downs
  and national mood changes are reported in the chronicle and the news, so the voices speak what
  just happened. Prompts are shaped by each nation's era and government. Cached on disk by
  content hash. The desktop app and preflight check the remaining ElevenLabs characters before
  the demo.
- **Where:** `server/src/story/eleven.ts`, `anthem.ts`, `chant.ts`, `broadcast.ts`,
  `teamVoices.ts`; `web/src/audio/`. `[check]` listen to an anthem and a chant once, and the
  animated anchor with sound.
- In the write-up, name the features: TTS, eleven_v3 audio tags, Music API with composition plan,
  Instant Voice Cloning.

### 2.6 MLH Best Use of Gemini API

- **Criterion (MLH, hackdays guide, partner programme page):** "Confirm that the winning project
  actually uses the Gemini API in the app" and "Ask the team to show the integration in its code,
  README, or demonstration." MLH brief: "build AI-powered apps that make your friends say WHOA."
- **How:**
  - Text: the world bible at creation, every ruler's decisions as schema-checked JSON, lore,
    anthem lyrics from the real chronicle.
  - Image in: a picture on the Create screen sets the world's mood, palette and setting.
  - Audio in: a spoken decree is heard directly by Gemini and turned into an event with an effect.
    `[check]` test with a real browser microphone.
  - Image in, voice out: Terra Nova News, Gemini watching a capture of the globe plus the recent
    chronicle.
  - Models: `gemini-3.5-flash-lite` (rulers, bible, image and voice) and `gemini-3.5-flash`
    (lore). Token meter on the top bar, hard caps, autopilot on any failure.
  - Provider switch (`LLM_PROVIDER`): `gemini` (default), `gemma-api` (Gemma through the Gemini
    API, default `gemma-4-26b-a4b-it`), `hybrid` and `ollama`. The first three all go through the
    Gemini API; this is the main entry. `ollama` is local Gemma (default `gemma4:e4b-it-qat`)
    and is the offline option: say plainly in the write-up that it is a fallback, not the entry.
    Lead with Gemini and Gemma through the Gemini API.
- **Show the integration:** the README table "AI rulers (LLM)" and the `LLM_PROVIDER` rows, the
  preflight line for Gemini, and the token meter in the demo.
- **Where:** `server/src/llm/index.ts`, `server/src/engine/bibleAi.ts`, `server/src/agents/ruler.ts`,
  `server/src/story/loreAi.ts`, `server/src/story/broadcast.ts`, `server/src/engine/decrees.ts`.

### 2.7 MLH Best Use of Solana

- **Criterion (inferred, no rubric):** real use of Solana, a use case that needs speed or low
  cost, a working demo with a visible devnet transaction, Solana-native pieces.
- **How:** a Token-2022 world currency with on-chain metadata, a fixed supply of 1,000,000 and
  the mint authority revoked at genesis; one wallet per nation plus a Commons wallet; every
  payment between nations is a memo plus TransferChecked signed by the paying nation's own key.
  Payments come from trade dues, reparations, plunder, seized treasuries, war chests, subsidies
  and pooled war funds. Verified live on 14 Nov: a 2-minute run confirmed 35 payments, all nations
  in sync, drift 0 `[check: re-run on the final build]`. Explorer links are built for every
  transaction. The "why chain" sentence: many small, frequent payments between independent agents
  that do not trust each other, each signed by the payer, with a supply nobody can inflate. The
  preflight checks the devnet endpoint and the Commons wallet before the demo. Ports and trade
  routes by sea feed more payments `[check: if landed]`.
- **Where:** `server/src/chain/genesis.ts`, `settle.ts`, `wallets.ts`, `routes.ts`
  (`GET /api/economy`); `packages/shared/src/sim/payments.ts`, `trade.ts`; the Treasury tab and
  "Treasury on Solana" on the nation card; `scripts/solana-keys.ts`; screenshot
  `docs/shots/solana-devnet-payment.jpg`.

### Not entered (owner rulings, do not tick)

- **MLH Best Use of Entire:** owner, 14 Nov. Entire keeps recording sessions as before.
- **MLH Best Use of Tiger Data:** owner, off. The code stays optional and unused.
- **No video:** owner, 14 Nov. Judging is the live table demo.
- Skipped for fit or time: Vultr, MongoDB Atlas, the hardware challenges (Arduino, P&G sensors,
  Waterstons hardware), QRT, SGX FX, Accenture, MicroGPT. See `docs/prizes/final-review.md`.

### Gaps

- **Main track:** many rows are still `testing` and need a human pass before the table demo.
  Naval battles and ports are being built on the last night; mention them only if they landed.
- **Neptune North:** strong. Risk is only the question "is it really distributed?": all agents in
  one process, the cut is a software switch. Council kill is `testing`.
- **Marshall Wace:** framing only; needs the pitch to open with "New Worlds" and a visit to
  their stand.
- **Waterstons:** weak fit; the "who benefits" line is thin.
- **ElevenLabs:** anthem and chant not yet listened to by a person; character budget is 30,000 per
  run on the Starter plan, so prepare the demo world's audio once.
- **Gemini:** painted flags need image billing and return 503; spoken decrees not yet tested with
  a real browser microphone; the MLH Gemini category date label ("Q1 2025 - Q1 2026" on MLH
  pages) must be confirmed on the DurHack Devpost. We found no public MLH wording that mentions
  Gemma either way, so the Gemma-through-the-Gemini-API entry rests on "uses the Gemini API".
- **Solana:** the owner's devnet run of the exact ledger was clean; the Commons wallet must be
  funded from the faucet before the demo; keep the saved signature file as the fallback.

---

## 3. The 2-minute table demo

There is **no video**. Judging is a 2-minute live demo on the owner's laptop (1920x1080) running
the real app, given again for every judge who comes to the table. Two minutes is the hard
maximum. Matches `docs/hackathon-plan.md` section 2. Where a sponsor form asks for a demo video
link, write "live demo at the table; no video" `[check]` if the form insists on a link.

### On screen before a judge arrives

- Start it with one command: `npm run demo` (live; stops any old copy, starts a stable server and a
  production build of the web, makes a prepared world, opens the browser). `npm run demo:mock` is the
  same with no API calls, for rehearsals. `npm run demo:status` says what is running;
  `npm run demo:stop` ends it. Logs are in `.demo/`.
- The app running in live mode (`LLM_MODE=live`, `SOLANA_MODE=devnet`) on a **prepared world**:
  created earlier with Prepare ticked, readiness panel green, audio cached, a few hundred years
  in so there are cities, a war under way and at least one gold payment in the ledger.
- Presentation mode on (key **P**) and the collapsed-by-default screen from lane c (#276): globe,
  top bar and minimap only; chronicle, history, decree and ledger open on click. Time paused or
  at 1 month a second, camera in orbit.
- A second browser tab with the Solana Explorer page of a recent payment, as a safety shot.
- Backup if live breaks: replay `demo-1` from the Create screen (Replay button, or
  `POST /api/replays/demo-1/play`); no API calls, exact, audio cached.

### The script (say the words in quotes; click what is in the middle column)

| Time | Click and do | Say |
| --- | --- | --- |
| 0:00 to 0:10 | Nothing to click. Slow orbit, six named nations with flags. Press the gears to a few years a second | "Terra Nova: a new world composed live by AIs. Every nation has its own Gemini ruler, deciding on its own." |
| 0:10 to 0:25 | Time runs: borders spread, ages advance. Click a gold payment arc: the Solana Explorer page opens (Success, devnet, memo). Back | "Every payment is a real Solana transfer signed by the paying nation, with the reason in the memo." |
| 0:25 to 0:50 | **The moment.** Open the Network panel, cut one nation. Press Show beliefs: its map drifts, pulsing holo over what it no longer knows | "I cut this nation off. It keeps ruling on what it last knew. No central server; this is what it believes." |
| 0:50 to 1:05 | Click that nation, kill its ruler (two clicks). A stand-in covers, then a successor with the old memory | "Kill its ruler and the council recovers; the successor inherits the memory." |
| 1:05 to 1:25 | Restore the link: missing years merge in, disputes settled, "the Silence" in the chronicle. Hold the mic: "a plague in the north" | "Bring it back and the history merges in. A spoken decree is heard by Gemini and the engine applies it." |
| 1:25 to 1:45 | Open Terra Nova News: the animated anchor reads the plague, in the ElevenLabs voice | "The news reads a picture of the globe and a voice reports it." |
| 1:45 to 2:00 | Gears to 10 years a second for a few seconds, then key End for the token meter, one sentence for the prize the judge is here for | "Ten years a second, no referee: rules and seeded functions move the world. This whole world cost N tokens." |

Tailor the last sentence to the judge: Neptune North, "agents that keep working apart"; Solana,
"every coin is a signed transfer"; ElevenLabs, "anthems and the anchor are sung and spoken from
what happened"; Marshall Wace, "a new world from one line".

### 20-second version (a judge in a hurry)

Orbit, gears up: "Every nation is run by its own AI." Cut a nation, Show beliefs: "Cut off, it
keeps going on what it last knew." Restore: "Bring it back and its history merges in." Offer to
show the rest.

### Reset routine between judges (about 10 seconds)

1. Press **Escape** to close any open panel or card, then **P** to return to presentation mode.
2. If the link was cut, restore it; unpause time; set the gears back to a few years a second.
3. If the world has run too far (late ages, many nations dead, a quiet stretch with no war) or
   anything looks broken: run `npm run demo:reset` in the terminal. It keeps the servers, makes a
   fresh prepared world with the same prompt and mode (about a minute live, prints
   `Preparing 14/30` as it goes), and the open tab switches to it by itself, no reload. Press play.
4. Instant fallback, no API calls: `npm run demo:reset -- --replay demo-1` plays the saved world in
   a known strong state at once, so a stack of judges does not burn the Gemini or ElevenLabs
   budget. Press **Home** on the timeline scrubber to jump a replay back to tick 0, then run the gears.
5. Run the next reset while the current judge is still at the table only if it is a replay; a live
   reset replaces the world on screen. Refresh the Explorer tab only if the devnet page has expired.

Safety shots: the Explorer page (`docs/shots/solana-devnet-payment.jpg`), the 10-years-a-second
gear (`gears-10y.jpg`) and the Tiger Data territory chart `[check]`.

---

## 4. What a human must still do to submit

- [ ] Find the submission platform and deadline (Devpost page was not live on 14 Nov 13:35);
      hacking ends Sunday 12:00 `[check]`.
- [ ] Hand-test the `testing` rows that appear in the table demo: anthem, chant, council kill, spoken
      decree with a real microphone, prepare mode, news anchor, Treasury tab `[check]`.
- [ ] Fund the Commons wallet from the devnet faucet; run `SOLANA_MODE=devnet` once and save a
      fresh Explorer link for the demo and the write-up `[check]`.
- [ ] Re-confirm the "35 payments, drift 0" figure on the final build or drop the number `[check]`.
- [ ] Rehearse the 2-minute table demo and the reset routine (section 3) three times in a row;
      there is no video to upload. If a form requires a demo link, write "live demo at the table;
      no video" `[check]`.
- [ ] Make the repository public (or confirm judges can see it).
- [ ] Optional: set `TIGER_DATABASE_URL` and look at the chart, or untick Tiger Data.
- [ ] Copy section 1 into the Devpost fields; use the gallery shots from `docs/shots/`.
- [ ] Add all three team members to the Devpost project (SamsSide, CutGrass88, Justin-CODING-PY).
- [ ] Tick the prizes: main track; Neptune North; Marshall Wace New Worlds; Waterstons; MLH
      ElevenLabs, Gemini, Solana; Tiger Data only if the chart works.
- [ ] Check the MLH Gemini category label on the DurHack Devpost `[check]`.
- [ ] Visit the Neptune North and Marshall Wace stands; rehearse the demo three times (CP3).
- [ ] Bring a speaker for the audio and the saved replay as the offline backup.
- [ ] After the event: optional DEV post.
