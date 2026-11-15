# How Terra Nova works, in five minutes

*Condensed on 15 Nov 2026 from `docs/documentation.md` sections 1 to 7. Each part links to the full
section. Fix the source first, then this copy. Back to the [demo pack index](README.md).*

## In one paragraph

You type one line (and can add a picture). Gemini writes a "world bible": the nations, their
leaders, beliefs, founding myths and flags. Code builds a planet of about 1,200 provinces and
places the nations on it. From then on every nation is run by its own independent agent, with its
own copy of the world and its own Gemini ruler. Nations settle, build, trade, pay each other on
Solana, move through the ages from spears to starships, and go to war. You can cut a nation off,
silence its ruler or delete it, and the world carries on; restore it and its missing years merge
back in. Full text: [section 1](../docs/documentation.md#1-summary).

## The parts

Three folders, all TypeScript ([section 2](../docs/documentation.md#2-architecture)):

- `packages/shared`: the types and every rule of the world. The server and the browser run exactly
  the same code from here.
- `server`: the engine (a clock and a runner), one agent per nation, the message bus between them,
  the Gemini and ElevenLabs calls, the Solana ledger and the replay recorder.
- `web`: the browser app. The globe (three.js), the map modes, the panels and the audio.

Outside services: Gemini, ElevenLabs and Solana devnet. Each is optional. In mock mode the whole
world runs with no network calls.

## The world is a list of events

Nothing in the world is ever changed in place. Every change is an event ("this nation claimed this
province", "this army moved", "this payment was made"), and one function, `applyEvent`, is the only
code that changes a world. Because of that:

- The server, every nation's agent and the browser can each hold their own copy and stay in step
  just by applying the same events in the same order.
- A saved list of events replays a whole run exactly, with no API calls. That is our offline
  backup.

Full text: [section 3](../docs/documentation.md#3-how-a-request-flows-the-demo-path).

## Rules move the world; the AI only steers

A plain simulation ticks once per game year. Income, land, building, armies, battles, trade and
payments are ordinary code. Every 30 to 45 seconds each ruler sends Gemini a short summary of its
nation and gets back a small, schema-checked answer: what to focus on, who to befriend or oppose,
and one line for the chronicle. If the model fails or the budget runs out, the nation carries on by
autopilot from its temperament. So the world never waits for an AI, and it is cheap. Full text:
[section 4.13](../docs/documentation.md#413-gemini-what-it-does-models-and-budgets).

## How copies agree with no referee

This is the core technical idea ([section 4.2](../docs/documentation.md#42-determinism-replicas-that-agree-without-a-referee)).

- All randomness is seeded: the same inputs always give the same "random" result.
- A battle is a pure function of both sides' strength, the terrain and a seeded hash. Every copy
  of the world works out the same winner by itself. Nobody has to announce the result.
- When two nations claim the same province in the same year, a hash decides, the same way on every
  copy.

Battle maths: a contest function with exponent 1.6, between Lanchester's linear and square laws,
plus terrain, forts, landings, the age gap, wonders and command
([section 4.3](../docs/documentation.md#43-battles)).

## Agents and the bus

Each nation (and each nation's general) is an agent. Agents publish their events on a message bus,
and the bus has a link per nation that can be switched off. The runner is only a clock and an
observer; it does not decide for anyone. Things no single nation owns (a deleted nation's fall, a
secession, a succession, a decree, a dispute) are computed from shared data by pure functions.

## Cut, silence, delete, restore

Full text: [section 4.11](../docs/documentation.md#411-resilience-cut-silence-delete-restore).

- **Cut.** No messages in or out. The nation keeps ruling on its own copy, which drifts from the
  truth ("Show beliefs" paints the difference). Its own events queue up. After 12 years of silence
  its neighbours notice and write it in the chronicle.
- **Restore.** The nation takes every batch it missed, then a settlement, then its queued events.
  Where it claimed a province someone else took meanwhile, the earlier claim wins; a tie goes to a
  hash. The result is the same whichever link comes back first.
- **Silence a ruler.** No more Gemini calls for that nation: autopilot.
- **Delete.** The agent is removed. Fourteen years later the world declares it fallen; its land
  becomes ruins and the neighbours carve it up.
- **Kill a ruler or general.** The other council member covers at reduced skill, and a successor
  appears 8 years later with a summary of the predecessor's memory
  ([section 4.6](../docs/documentation.md#46-the-council-deaths-cover-succession-coups)).

## Gemini

Models: `gemini-3.5-flash-lite` for the world bible (about 5 seconds), ruler decisions, images and
voice; `gemini-3.5-flash` for lore. Four uses:

- Text: the world bible, ruler decisions, lore, anthem lyrics from the real chronicle.
- Picture in: a picture on the Create screen sets the world's mood and setting.
- Audio in: a spoken decree is heard directly, with no separate speech-to-text step.
- Picture in, voice out: the news reads a capture of the globe and writes a bulletin.

A provider switch can run rulers on Gemini, on Gemma through the Gemini API, on local Gemma through
Ollama, or a mix. Caps: 20 calls a minute and 400,000 tokens a run; the token meter shows both.

## ElevenLabs

Narration of each nation's lore; an anthem sung by the Music API from lyrics written out of the
nation's own history; a war chant per nation; and the news anchors and herald in the team's own
cloned voices. Everything is cached on disk by content hash, so a replay costs nothing. Full text:
[section 4.14](../docs/documentation.md#414-elevenlabs-what-it-does).

## Solana

Full text: [section 4.10](../docs/documentation.md#410-the-solana-bridge).

- One world currency: a Token-2022 token with a fixed supply of 1,000,000 and the mint authority
  revoked, so nobody can print more. One wallet per nation, plus a Commons wallet that pays fees.
- Every payment between nations is a memo (the reason) plus a transfer signed by the paying
  nation's own key.
- The simulation is the source of truth and the chain is a mirror. Payments are netted per pair
  into 5-second windows and settled a few at a time, because a battle cannot wait for a
  confirmation and the public devnet endpoint limits requests.

## The globe

A spherical Voronoi diagram: points on a Fibonacci spiral, jittered, and the convex hull of those
points gives the provinces ([section 4.1](../docs/documentation.md#41-spherical-voronoi-provinces)).
Land, cliffs, borders, six map modes, rivers, clouds, day and night, and low-poly models for
buildings, units and wonders, drawn with instancing so 1,200 provinces stay smooth.

## The hardest problems

Full text: [section 6](../docs/documentation.md#6-problems-we-hit).

1. **Devnet rate limits.** The fix was netting payments into windows, fixed compute limits, polling
   and a rule that a payment is never sent twice.
2. **Money that vanished.** A nation's yearly update overwrote a payment applied earlier in the same
   tick. Payments now go last in a fixed order and are clamped to what the payer has.

## Honest limits

Full text: [section 7](../docs/documentation.md#7-limitations-and-next-steps).

1. All agents run in one Node process on one laptop. The cut is a software switch on the bus, not
   a real network partition.
2. Rulers are not reproducible: Gemini answers vary, so only the recorded log replays exactly.
3. The chain is devnet, and it records payments between nations only; treasuries live in the
   simulation.
4. Painted flags need Gemini image billing and are off; flags are drawn from a spec.
5. Scale is tuned for about 1,200 provinces and up to 16 nations; we have not benchmarked beyond
   that.
