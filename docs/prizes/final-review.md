# Final prize review

*Written 15 Nov 2026, before the 11:00 GMT submission deadline. Sources: `list.md`, `matrix.md`,
the `P*.md` briefs, `README.md`, `docs/submission.md`, `docs/decisions.md`, and the public MLH
prizes page <https://www.mlh.com/events/durhack-2026/prizes> (read 15 Nov: 8 categories).*

**Could not reach:** the DurHack Devpost page and our project page both returned 403 to an
automated fetch, so the exact tick list on Devpost is unconfirmed. The ticks below follow the
prizes in `list.md`. Check them against the real form.

## Gemini versus Gemma (the wording)

- The MLH DurHack prizes page lists "Best Use of Gemini API" with MLH swag kits and says "It's
  time to push the boundaries of what's possible with AI using Google Gemini." It does not mention
  Gemma.
- MLH's partner guide (<https://hackdays-guide.mlh.com/partner-programs/google-gemini>) tells
  judges to "Confirm that the winning project actually uses the Gemini API in the app" and to "Ask
  the team to show the integration in its code, README, or demonstration." It does not mention
  Gemma either.
- So we found no public statement that local Gemma counts. The claim that local Gemma is
  prize-eligible came from the owner being told so; it is unconfirmed in writing.
- Safe position: the entry is the Gemini API (rulers, bible, image in, audio in, news) and Gemma
  served through the Gemini API (`LLM_PROVIDER=gemma-api` or `hybrid`), which is a Gemini API
  call. Local Gemma via Ollama (`ollama`) is the offline option, described as a fallback. For the
  demo, run `gemini` or `hybrid` so a judge sees real Gemini API calls.
- Also unconfirmed: MLH pages label the Gemini category "Q1 2025 - Q1 2026". The category is on
  the 2026 DurHack page, so it is live.

## The table

Strength: Strong, Medium, Weak, None. Rulings are the owner's; do not re-open them.

| Prize | Decision | Strength | What in the app proves it |
| --- | --- | --- | --- |
| P9 Overall 1st/2nd/3rd (Composition) | Enter | Medium | A world, its history, money and music composed by many AIs; polish pass, desktop app, preflight, exact replay backup |
| P18 Neptune North: Actors work better together | Enter | Strong | Per-nation and per-general agents on a bus; cut, silence, delete, kill and restore controls; national mood drives independent decisions; model layer degrades to autopilot or local Gemma. Limit: one process |
| P11 Marshall Wace: New Worlds | Enter | Medium | Every run is a new world from a line or a picture; ages up to satellites and orbital war; replayable event log |
| P2 MLH Best Use of Gemini API | Enter | Strong | Text (rulers, bible, lore), image in, audio in, image in plus voice out; provider switch with Gemma through the Gemini API; token meter. Swag only |
| P1 MLH Best Use of ElevenLabs | Enter | Strong | Narration, sung anthems from history, war chants (`eleven_v3`), news anchors in cloned voices |
| P4 MLH Best Use of Solana | Enter | Medium to strong | Token-2022 currency, fixed supply, mint authority revoked, a wallet and signature per nation, 35 payments in a 2-minute run, drift 0 |
| P19 Waterstons | Enter if the form allows, no extra work | Weak | One line: language models, simulation, cloned voices, music and a chain connected into one map |
| P3 MLH Best Use of Entire | Skip (owner, 14 Nov) | n/a | Sessions still record; not entered |
| P5 MLH Best Use of Tiger Data | Skip (owner, off) | n/a | Code is optional and unused; untick |
| P12 Marshall Wace meme | Optional, ten minutes | Weak | A meme in #marshall-wace-memes; only if someone has time |
| P24 Hackiest Hack, P10 Spirit of the Dino | No action | Weak | Judged at the event; not Devpost ticks |
| P7 DEV Writing Challenge | Optional, after submission | Weak | A post using the submission text; $100 monthly pick |
| P6 Vultr, P8 MongoDB Atlas | Skip | None | We use neither; do not tick |
| P16 SGX FX 2 (playful trading) | Skip | None | No market mode built |
| P15 SGX FX 1, P17 Accenture, P21 P&G receipts | Skip | None | Not what the app does |
| P20 Arduino/RS, P22 P&G sensors | Skip | None | Software only, no hardware |
| P13 QRT Tagged, P14 QRT CTF, P23 MicroGPT | Skip | None | Separate tasks, not built |

No video: owner ruling, 14 Nov. Judging is the live table demo.

## What is new since the last review, and who it helps

| New | Helps |
| --- | --- |
| LLM provider switch (Gemini, Gemma via Gemini API, local Gemma via Ollama, hybrid) | Gemini (show the integration), Neptune North (resilience), Overall (technical) |
| Windows desktop app (`npm run demo`) with preflight checks | Overall (polish, completion) |
| Satellites, launches and shoot-downs | Overall (creativity), Marshall Wace (new worlds), ElevenLabs (news and chronicle lines) |
| National mood | Neptune North (independent decisions), Overall |
| Army, war and interface motion | Overall (polish) |
| Naval battles and ports, if landed | Overall, Solana (more payments) |

Do not claim the naval work in Devpost text unless it is merged and has been seen running.

## Devpost ticks for the owner

Only tick what the form offers. Do not submit from this review; the owner clicks.

- [ ] Overall main track (the project itself).
- [ ] Neptune North: Actors work better together.
- [ ] Marshall Wace: New Worlds.
- [ ] MLH Best Use of Gemini API.
- [ ] MLH Best Use of ElevenLabs.
- [ ] MLH Best Use of Solana.
- [ ] Waterstons challenge (optional; no extra work).
- [ ] DEV Writing Challenge (optional; publish the post after submitting).
- [ ] Leave UNTICKED: Entire, Tiger Data, Vultr, MongoDB Atlas, all hardware, QRT, SGX FX,
      Accenture, P&G, MicroGPT.
- [ ] If a form asks for a demo video link: write "live demo at the table; no video".
- [ ] Gemini box: say which models, and that Gemma runs through the Gemini API; local Gemma is
      the offline fallback.
- [ ] Before ticking Solana: re-run the devnet check on the final build and fund the Commons
      wallet.

## Biggest risks

1. Devpost tick list unseen (403). Verify on the real form.
2. Gemma wording: not in public text. Lead with the Gemini API.
3. Solana and ElevenLabs claims rest on a 14 Nov run; re-check on the final build.
4. Neptune North may ask "is it really distributed". Say it plainly: one process, a software cut.
