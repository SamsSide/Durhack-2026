# Pre-DurHack prize analysis

*Written Friday 13 Nov 2026, the evening before DurHack 2026 (14-15 Nov, Teaching and Learning
Centre). Sources: the MLH pre-event email, <https://www.mlh.com/events/durhack-2026/prizes>,
<https://durhack.com>, last year's Devpost (<https://durhack-2025.devpost.com/>) and one research
file per prize in [`docs/prizes/`](../prizes/). Only the eight MLH prizes are public; DurHack's
own places and the sponsor challenges are announced at the opening ceremony.*

**Status of the facts.** The prize briefs, the sponsor list and last year's results were read
directly from the pages. The per-prize tech notes were gathered by research agents from docs and
search results; several sponsor doc sites and Devpost blocked fetching, so anything marked
*unconfirmed* below has not been checked against a primary page, and no code snippet in
`docs/prizes/` has been run.

## 1. The short version

1. **The money is in the sponsor challenges, which we cannot see yet.** Last year QRT paid 500
   pounds per person, G-Research gave Switch 2s and Marshall Wace gave iPads. The MLH prizes are
   small hardware (earbuds, a projector, a Stream Deck Mini). Treat the MLH prizes as a stack of
   cheap extra entries on top of a project aimed at the overall places and one or two open
   sponsor themes.
2. **Last year no project won two prizes** (16 winners, 16 different projects). Enter many, expect
   one or two.
3. **What won overall was physical, playful and understood in 20 seconds**: dancing at a webcam
   to make music (1st), a book that generates its own soundscape (2nd). No dashboards, no
   chatbots.
4. **Five MLH prizes stack on almost any project for about 6 to 8 hours in total**: Gemini (the
   brain), ElevenLabs (the voice), Tiger Data (the database), Vultr (the hosting), DEV (a blog
   post on Sunday). Entire is a sixth that is about how we build, not what. Solana needs a real
   reason to be there. MongoDB is the most crowded and competes with Tiger Data for the same job.
5. **Recommendation:** do not lock an idea tonight. Go in with the three seeds in section 6
   ready, pick at the opening once the theme and sponsor challenges are known, and have every
   account and key working before we leave the house.

## 2. The prize matrix (MLH prizes)

Hours are for a team new to the tool. "Win chance" is a judgment, not a measurement: nobody
publishes entry counts, and MLH publishes no judging rubric for partner prizes (assumed judged by
the MLH rep from the Devpost entry and a table demo; confirm at the MLH table).

| id | Prize | What we would win | Hours to qualify | Hours to compete | Win chance (1-5) | Fits any idea (1-5) | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | Gemini API | MLH swag kit | 0.1 | 2-3 | 3 | 5 | Free AI Studio key. Gemini must do real work (multimodal, Live API, function calling) |
| P1 | ElevenLabs | Wireless earbuds | 0.2 | 3-4 | 3 | 4 | Voice must be core to the experience. MLH promo: one month of Creator (credit amount unconfirmed) |
| P5 | Tiger Data | Stream Deck Mini | 1-1.5 | 3-4 | 4 | 4 | Tiger as the project's database. 30-day trial, 1000 dollars credit, no card |
| P6 | Vultr | "Assorted" (portable screens at one past event) | 1 | 3-5 | 2 | 5 | Deploy on Vultr. 100 dollar credit via the MLH code; said to need no card (unconfirmed) |
| P7 | DEV Writing Challenge | 100 dollars | 1 (Sunday) | 1-2 | 2 | 5 | Post on DEV with tag `mlhacks`, using the template. Global monthly pick across all MLH events |
| P3 | Entire | Mini portable projector | 1 | 5-6 | 3 | 5 | Sessions + Graph + Brain + Trails used while building, with token numbers |
| P4 | Solana | Hardware wallet each | 2-3 | 8-15 (own program) | 3 | 2 | A real "why on chain" story. Devnet is enough |
| P8 | MongoDB Atlas | M5Stack IoT kit each | 0.5-1 | 3-4 | 2 | 5 | Atlas free tier. Most-entered MLH prize |

Sorted roughly by value for the hour spent. Detail, sign-up steps, hello-worlds and gotchas:
[P1](../prizes/P1-elevenlabs.md), [P2](../prizes/P2-gemini.md), [P3](../prizes/P3-entire.md),
[P4](../prizes/P4-solana.md), [P5](../prizes/P5-tigerdata.md), [P6](../prizes/P6-vultr.md),
[P7](../prizes/P7-dev-writing.md), [P8](../prizes/P8-mongodb-atlas.md). Verbatim briefs:
[list.md](../prizes/list.md).

### Notes per prize

- **Gemini.** Free tier covers text, the Live API and TTS; image and video generation need
  billing. Model ids and the SDK call shape have changed recently, so copy the quickstart from
  the docs on the day, not from memory. Last year's DurHack winner (Fanfiction) used Gemini as
  the product itself, and also used ElevenLabs.
- **ElevenLabs.** The cheapest entry is text-to-speech on real app output. The competitive entry
  is a live voice agent (their Agents platform) or distinct character voices. Last year's
  DurHack winner was a radio station (Legacy FM): the voice was the product. Do not build
  another radio station.
- **Tiger Data.** New MLH partner, so likely the least contested of the hardware prizes. Judges
  will look for Tiger-specific features with a number attached: a hypertable of events, a
  continuous aggregate behind a live chart, compression ratio, vector search in the same
  database, a fork. `tiger mcp install claude-code` gives our agents direct access. Some events
  required Tiger to be *the* database (unconfirmed), which argues against splitting storage with
  MongoDB.
- **MongoDB Atlas.** Only enter if Mongo has a real job. Free cluster needs no card; the 50
  dollar student credit needs a card or PayPal and is not needed. Gotcha: automated Voyage
  embeddings on a free cluster without a payment method are limited to 3 queries a minute.
- **Vultr.** Host the backend there from hour one (Docker on a small instance, Caddy for HTTPS)
  and the entry is free. To compete, run an open-weights model on their Serverless Inference
  (OpenAI-compatible) or a GPU instance for some part of the pipeline.
- **Solana.** The cheapest credible use is a memo transaction on devnet (tamper-evident log,
  proof of existence, on-chain leaderboard) with `@solana/kit` and a Phantom wallet, plus a live
  Explorer link in the demo. Writing our own Anchor program is 8 to 15 hours for a team new to
  Rust: skip it. Devnet airdrops rate-limit, so fund wallets the night before. Last year's
  winner was health data on web3. The brief literally asks for high-frequency transactions,
  trading or payments, which only seed B below does naturally.
- **Entire.** A CLI that records agent sessions as checkpoints next to git commits, plus a code
  graph, a project memory ("Brain") and Trails (their PR replacement). It can sit beside GitHub
  (GitHub stays `origin`; Entire mirrors it). It fits us better than almost any team there,
  because we build entirely with agents. Three things to decide before turning it on, all in
  section 5.
- **DEV.** One post on Sunday, 700 to 1200 words, 3 to 5 images, one code snippet, a demo link,
  honest about what went wrong. Costs an hour and doubles as the Devpost write-up.

## 3. Last year's DurHack, and what it says about this year

Full table: [durhack-2025-results.md](../prizes/durhack-2025-results.md).

| 2025 challenge | Type | Prize | Sponsor back in 2026? |
| --- | --- | --- | --- |
| Marshall Wace "Bridging Worlds" | Open theme | iPads | Yes (platinum) |
| QRT "Meeting in the Middle" and "Building on Foundations" | Closed: their dataset, their sandbox | 500 pounds per person | Yes (platinum) |
| Accenture "AI tool for a real everyday problem" | Open, must use AI, ethical AI | Raspberry Pi 5 + vouchers | Yes (gold) |
| Neptune North "Anticipate macroeconomic data" | Semi-open: alternative data, nowcasting | Udemy subscriptions | Yes (gold) |
| Waterstons "Connect things that normally aren't" | Open theme | Mini keyboard | Yes (gold, founding) |
| G-Research "Crystal ball" | Open theme | Switch 2 each | No |
| TalkJS | Use their SDK | Flipper Zeros | No |
| Hackathons UK "Hackiest Hack", "AI Agents on Arm" | Open | Plushes, Pi Zero kit | Partner again |

New this year with no history at DurHack: **BidFX** (platinum, FX trading technology), **RS
Group** (gold, electronics distributor; a hardware or IoT angle is likely), **Newton** (silver,
consultancy).

What to expect:

- Three of the eight paying sponsors are in quantitative finance or trading (Marshall Wace, QRT,
  BidFX) and a fourth sets macro-data challenges (Neptune North). A project with live market or
  economic data in it has more doors to knock on than any other kind.
- QRT's challenges are a separate, closed competition. If the cash is the same again, the real
  question at the opening is whether to put one person on it or leave it alone. It will not
  stack with the main project.
- The open themes are loose and reward a literal, playful reading. Two different crystal balls
  won two different prizes last year.
- The site art is a sun, sky, blimp and city, and the guilds are Skyline, Plaza and Metro. Last
  year's theme (Legacy) ran through the prize names and the winning projects. Expect a city or
  sky theme and leave room to dress the project in it.

Sponsor-by-sponsor predictions: [sponsor-challenge-predictions.md](../prizes/sponsor-challenge-predictions.md).
The evidence behind them is thin (no 2025-26 challenges from BidFX, RS Group, Newton, Waterstons
or Neptune North could be found at other UK hackathons, and Devpost blocked fetching), so they
rest on DurHack 2024-25 and the companies' own sites:

| Sponsor | Predicted challenge | Stacks with a general AI app | Confidence |
| --- | --- | --- | --- |
| Marshall Wace | Open one-line theme again (2024 "Chain of events", 2025 "Bridging Worlds") | Yes | High |
| QRT | Closed again: their data or sandbox, cash prizes | No: needs its own small lane | Medium-high |
| BidFX (FX execution platform, owned by SGX) | Open fintech or real-time data challenge | Probably | Low |
| Accenture | Open "AI for a real problem", ethical AI | Yes | Medium-high |
| RS Group | Hardware or IoT, prizes in components | Only with a physical build | Low-medium |
| Neptune North (Oliver Wyman and Rokos venture, Newcastle) | Macro or alternative-data nowcasting again | Only seed C, partly B | Medium |
| Waterstons | Open theme again | Yes | Medium |
| Newton | May only judge, or a process-improvement challenge | Unknown | Low |
| Hackathons UK | "Hackiest Hack" again | Yes | Medium |

The main risk to the whole plan: if most briefs turn out closed and data-heavy, the open-theme
approach misses them. Read every brief at the opening before committing to a seed.

## 4. Stack groups

**The chassis (take on any idea): Gemini + ElevenLabs + Tiger Data + Vultr + DEV.** One
architecture serves all five: a web app whose backend runs on a Vultr instance, Gemini doing the
understanding, ElevenLabs speaking, every event written to a Tiger hypertable with a live chart
on a continuous aggregate, and a write-up on DEV. About 6 to 8 hours of the team's 24 beyond the
idea itself, and most of it is work the project needs anyway.

**Add-on, any idea: Entire.** About 1 hour to qualify and a steady tax through the weekend to
compete. Only worth it if it does not slow the agents down (test tonight).

**Add-on, only with a reason: Solana.** 2 to 3 hours for a memo-based feature.

**Either/or: MongoDB instead of or beside Tiger Data.** Prefer Tiger.

**Separate track: closed sponsor challenges (QRT-style).** Decide at the opening.

## 5. Decisions for the owner before the event

1. **Entire and our no-attribution rule.** Entire adds an `Entire-Checkpoint: <id>` trailer to
   commits. It is not an AI co-author line, but our commit hook and CLAUDE.md ban session-link
   trailers, and this is close to one. Either allow this one trailer or skip the prize.
2. **Entire and privacy.** Session transcripts (our prompts and the agents' replies) are pushed
   with the code. The repo goes public for judging. Secret redaction is best effort. Everything
   typed into a session would be readable.
3. **Entire and our hooks.** It edits `.claude/settings.json` and renames existing git hooks to
   `<hook>.pre-entire`, chaining them. Our pre-push and commit-msg hooks protect `main`. Test on
   a throwaway branch tonight, on WSL (not mentioned as supported), before trusting it.
4. **How many prizes to chase.** The chassis is nearly free. Solana and Entire each cost real
   hours; pick at most one of them unless the idea needs Solana anyway.

## 6. Idea seeds

All three sit on the chassis, can be shown to a passer-by in under 30 seconds, and have a hook
for the finance-heavy sponsor list. None is a commitment: the theme and the sponsor briefs
decide.

### A. The Commentator

Point a camera at anything (a table-football game, a judge walking past, someone making tea)
and a live sports commentary team calls the action, with stats, replays and rivalries that build
up over the day.

- **Demo moment:** the judge walks up and is being commentated on before they say a word.
- **Prizes:** Gemini (Live API, vision is the core), ElevenLabs (two commentator voices with
  different personalities is the product), Tiger Data (every "play" is an event; live stats
  board on continuous aggregates; "this is the 400th event today" numbers), Vultr, DEV. Open
  themes: connects things that normally are not (Waterstons-style), Hackiest/most fun.
- **Lanes:** vision and event detection; voices and the commentary script; stats store and
  board; the stand (camera, screen, speakers).
- **Risk:** latency between seeing and speaking; a noisy hall. Needs a decent speaker and a
  fallback of pre-recorded clips. Weak link to the finance sponsors.

### B. The Pit

An open-outcry trading floor brought back to life. You stand at a microphone and shout orders
("buy fifty at two!") into a pit of AI traders, each with its own voice, strategy and temper,
trading a made-up market that reacts to live news.

- **Demo moment:** a judge shouts an order, three AI traders shout back, the price moves on the
  big screen and the judge's profit and loss appears on the leaderboard.
- **Prizes:** ElevenLabs (a crowd of distinct voices), Gemini (trader agents, speech
  understanding), Tiger Data (tick data is exactly what it is built for: hypertable of trades,
  candles as continuous aggregates, compression figure), Solana (the one idea where the brief is
  met literally: every fill settled as a devnet transaction, a high-frequency exchange), Vultr,
  DEV. Sponsors: speaks directly to Marshall Wace, QRT, BidFX and Neptune North engineers.
- **Lanes:** market engine and order book; trader agents and voices; data, charts and
  leaderboard; Solana settlement and the stand.
- **Risk:** the largest build of the three. Cut order: Solana settlement first, then news
  reactivity, then the number of traders. The core (shout, get shouted at, price moves) must
  work by hour 8.

### C. The Economy Forecast

A television weather forecast for the economy. Alternative, high-frequency data (prices, job
postings, shipping, news sentiment) is turned into a nowcast, and a presenter in front of a
weather map delivers it: "a band of inflation moving in from the east".

- **Demo moment:** press the button and get tonight's forecast for a region or sector of your
  choice, spoken by the presenter, with the map behind.
- **Prizes:** a repeat of Neptune North's 2025 brief if they run it again (their own suggested
  sources included on-chain stablecoin flows, which gives Solana data a real job), Tiger Data
  (time series are the whole project), ElevenLabs (the presenter), Gemini (turning numbers into
  a script, reading news), Vultr, DEV.
- **Lanes:** data collection; the nowcast model; presenter script and voice; the map and studio
  screen.
- **Risk:** the model has to be defensible to quant judges; a forecast that is only an LLM
  guessing will be seen through. The least physical of the three.

### Recommendation

**B (The Pit) if the finance sponsors run open themes again, A (The Commentator) if the theme or
the mood favours pure fun.** B reaches the most prizes with the fewest forced fits and is aimed
at the sponsors who paid the most. A is the safest crowd-pleaser and the smallest build. C is
the fallback only if Neptune North repeats its brief and the prize is better than last year's.

A fourth option stays open: if RS Group or the hardware library offers interesting kit, a
physical object beats a screen at a table-judged event. Ask at the stands first thing.

### Second batch (added later on 13 Nov)

The owner liked A (The Commentator). What makes A good is a pattern worth naming: **a character
that watches through a camera and talks**. The engine is the same every time (camera frames to
Gemini, a script in a persona, an ElevenLabs voice, every event stored in Tiger Data); only the
character changes. That means the engine can be built first and the character chosen, or
changed, once the theme and the sponsor briefs are known. Seeds D to H below are other
characters and near neighbours.

#### D. The Auctioneer

Hold any object up to the camera. A fast-talking auctioneer appraises it ("a lightly chewed
biro, provenance unknown"), opens the bidding and runs a live auction; people in the crowd bid by
raising a hand or tapping their phone, and the hammer falls.

- **Demo moment:** the judge's own lanyard is sold to a stranger for 40 pretend pounds in fifteen
  seconds.
- **Prizes:** everything A reaches, plus the finance hook A lacks. Bids are a stream of small,
  fast transactions, which is the Solana brief met literally (each bid or each hammer price a
  devnet transaction) and exactly Tiger Data's kind of data (bid ticks, price curves). A live
  auction is price discovery, which gives the trading sponsors something to talk about.
- **Lanes:** vision and appraisal; the auctioneer's patter and voice; bidding (hands, phones) and
  the price board; settlement and the stand.
- **Risk:** auctioneer patter must be fast, so speech latency matters more than in A. Hand-raise
  detection in a crowd is fiddly; phone bidding is the fallback.

#### E. Departures

A station departures board and tannoy for the hackathon itself. It listens to real events (git
pushes from teams who opt in, food arriving, workshops starting, the countdown) and announces
them in a weary station voice: "The 14:32 pull request from Table 12 is delayed. We apologise
for the merge conflict."

- **Demo moment:** the judge pushes a commit, or just says their name, and hears themselves
  announced over the tannoy while the board flips.
- **Prizes:** fits a city or metro theme better than anything else here (the guilds are Skyline,
  Plaza and Metro). ElevenLabs (the announcer), Gemini (turning raw events into announcements),
  Tiger Data (events are the product), Vultr, DEV. "Connecting things that normally aren't" for a
  Waterstons-style theme. Strong for Spirit of the Hack if other teams join in.
- **Lanes:** event sources and webhooks; announcement writer and voice; the split-flap board;
  getting other teams signed up.
- **Risk:** depends on other teams taking part; needs seeded events so it is never silent. No
  camera, so less of an instant hook than A or D.

#### F. The Referee

Two people have an argument into two microphones. A referee listens, fact-checks claims as they
are made, blows the whistle on fouls (interrupting, moving the goalposts), goes to a video-style
review and gives a verdict.

- **Demo moment:** two judges argue about whether a hot dog is a sandwich and one of them gets a
  yellow card.
- **Prizes:** Gemini (live listening, search grounding for the fact checks), ElevenLabs (referee
  and a pundit), Tiger Data (match stats), Vultr, DEV. Accenture-style "everyday problem" with a
  straight face: settling arguments fairly.
- **Lanes:** live transcription and claim detection; fact checking; referee voice and whistle;
  scoreboard.
- **Risk:** needs two willing people per demo; telling two voices apart in a loud hall.

#### G. The Bookie

A play-money prediction market on the hackathon. A bookmaker with a voice sets odds on small
live questions ("pizza before eight?", "will Table 9's demo crash?"), takes bets from phones,
moves the odds as money comes in and settles when the event resolves.

- **Demo moment:** the judge bets on something that resolves while they are standing there.
- **Prizes:** the most direct pitch to Marshall Wace, QRT and BidFX (a working market with real
  order flow from 600 people), Solana (bets and payouts as transactions), Tiger Data (odds
  history), ElevenLabs (the bookie calling the odds), Gemini (writing markets, resolving them).
- **Lanes:** market maker; phone betting app; settlement; the bookie and the odds board.
- **Risk:** needs a crowd to come alive; organisers may dislike anything that looks like
  gambling, even with play money, so ask first. No camera.

#### H. Something physical

Kept open on purpose. If RS Group or the hardware library has sensors, motors or displays, any
of the characters above can live in an object instead of on a screen (a commentator in a box
with a camera for an eye; a gavel that actually bangs). Last year a physical crystal ball beat
screens for two separate prizes. Decide at the stands.

#### Updated recommendation

**Build the watching-and-talking engine first, with The Commentator as the default character.**
It is the smallest build, the one the owner already likes, and the easiest to demo. Keep **The
Auctioneer** as the planned swap or second mode if the finance sponsors run open themes: it adds
the trading and Solana hooks for perhaps four more hours on the same engine. **Departures** is
the pick if the theme turns out to be a city or transport one and the judging rewards crowd
involvement. B (The Pit) stays the most ambitious finance option but is no longer the first
choice, because D gets most of its prize reach for much less work.

## 7. Tonight's checklist

Accounts are personal, so a human creates them; none of this needs code in the repo. Keys go in
a git-ignored `.env` (names only in `.env.example`), never in a commit, issue or PR.

| Do | Why tonight | Card needed |
| --- | --- | --- |
| Log in at <https://www.mlh.com/events/durhack-2026/prizes> and claim the ElevenLabs and Entire promo codes | Codes are per person; ElevenLabs codes can arrive by email | No |
| Google AI Studio key (<https://aistudio.google.com>) | Two minutes; confirm one call works | No |
| ElevenLabs account, redeem the code, make an API key | Check what the code actually grants | No |
| Tiger Data trial (<https://www.tigerdata.com>), create a service, install the `tiger` CLI and MCP | Avoid sign-up queues on venue wifi | No |
| Vultr account via the MLH link, redeem the gift code | Account verification can take time (unconfirmed) | Said not to be (unconfirmed) |
| Phantom wallet on devnet, fund two wallets from the faucet | Devnet airdrops rate-limit under load | No |
| MongoDB Atlas free cluster | Only if we decide to enter it | No |
| DEV account | Needed on Sunday | No |
| GitHub Student Developer Pack | Copilot mini-event; Atlas credit | No |
| Entire: install the CLI and try `entire enable` on a throwaway repo under WSL | Find out now whether it fights our hooks | No |
| Preregister for the Google AI Studio workshop (link in the MLH email) | Workshops often count toward guild points | No |
| Run `durhack-init` | The team and lanes are not set up in this repo yet | |

One rule to check with the organisers: most hackathons do not allow project code written before
the start. Accounts, keys, tooling and reading docs are fine; building the app is not.

## 8. Open questions for the opening ceremony

- The theme, the overall prize categories and whether a team can win more than one prize.
- Each sponsor's brief: open theme or closed problem, prize, and who judges.
- Is every MLH prize in the email actually on this year's Devpost (the MLH page labels differ)?
- How judging runs: table demos only, or finalists on stage? Devpost deadline?
- What the hardware library holds, and what RS Group brought.
- What the guild challenges are and whether they are worth anyone's time.
