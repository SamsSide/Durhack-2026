# Decisions

*Append-only, one line each, newest last: `time · who · decision · why`. Union-merged
(`.gitattributes`), so adding lines never conflicts. Never edit old lines; add a new one.*

2026-11-14 14:30 · owner · Idea: Terra Nova (matrix idea 2, Worldbuilders), software only, no hardware prizes · Neptune North and Marshall Wace are the main sponsor targets; Neptune North asked for resilience and a very visual demo
2026-11-14 14:30 · owner · Stack: TypeScript everywhere (Node 22, npm workspaces, Express and ws, Vite, React, three.js) · one language lets the server and browser share the world rules
2026-11-14 14:30 · owner · The world is an event log moved by coded rules; the LLM only rules each nation, rarely · cheap, fast, replayable, and runs with no LLM at all
2026-11-14 15:00 · owner · Lanes rebalanced by agent budget: lane a most (17 rows, all server work, Blender, Figma), lane b middling (9 rows), lane c least (5 small interface rows) · the three accounts have very different limits, and only the owner's laptop has Blender and the Figma tools
2026-11-14 15:00 · owner · Added: hologram nation card, war chants, anthem lyrics written from each nation's history, map modes and other grand-strategy map conventions (inspired by the genre of Age of History, not its art) · owner's ideas after kickoff
2026-11-14 15:00 · owner · Building is paused until the owner says go; plan only · owner's instruction
2026-11-14 15:20 · owner · Hacking ends Sunday 12:00 · confirmed by the owner
2026-11-14 15:20 · owner · The map is irregular provinces (spherical Voronoi), not hexagons · reads as a political map, like the grand-strategy games the owner likes; hexagons are the fallback
2026-11-14 15:20 · owner · Nations are divided into named regions that can break away as new nations · lore, and a new actor joining mid-run
2026-11-14 15:20 · owner · Flags are drawn from a specification at once and painted by an image model on click · free and instant first, prettier when asked
2026-11-14 15:20 · owner · The viewer watches and decrees; no playing as a nation · scope
2026-11-14 15:20 · owner · Runs and demos on one device; row A10 (agents on other laptops) is cut · owner's choice
2026-11-14 15:20 · owner · A world's full arc takes about three minutes at normal speed · a judge sees it in one visit
2026-11-14 15:20 · owner · Spend up to 25 pounds on Gemini and ElevenLabs, with caps in the code · owner's budget
2026-11-14 15:40 · owner · Row A1 is a 30-minute seed holding every shared piece (types, mock server and routes, store, app shell, placeholders, default colours); after it no row waits on another lane · the owner wants every teammate's agents running all the time
2026-11-14 15:40 · owner · Visual style is an old atlas; the hologram stays as a beam with the card as a lit parchment page · owner's choice
2026-11-14 15:40 · owner · Everyone stays up overnight; checkpoints unchanged · owner's answer
2026-11-14 16:00 · owner · Every merge that finishes something another lane needs is followed by a `ready` issue to each such lane (`ask.sh ready`) · the owner wants lanes notified, never left to notice merges
2026-11-14 16:30 · owner · Entire is required on every teammate's laptop; the session-start hook flags a missing install · every session should count towards Best Use of Entire
2026-11-14 14:52 · owner · Gemini models: lore and world bible gemini-3.5-flash, rulers gemini-3.5-flash-lite; never the 2.5 family (closed to new users) · tested live by A13, cheapest for many ruler calls
2026-11-14 15:05 · owner · The world bible is written by gemini-3.5-flash-lite (GEMINI_MODEL_BIBLE), about 5 s instead of 28 s on flash · world creation must fit the 15 s demo step
2026-11-14 15:04 · owner · ElevenLabs Starter plan bought (music API for anthems, about 40k characters a month); Gemini image billing not enabled, drawn flags only · anthems are a demo highlight, painted flags are not
2026-11-14 15:50 · owner · X5 gains DecreeBox and TokenMeter (no props), placed in the top-bar area per the design (#61) · additive, matches the merged code
2026-11-14 16:05 · owner · Make the LLM side multimodal (MLH judge's tip): image prompt (A17, no longer a stretch), spoken decrees heard by Gemini (A20), and Terra Nova News, Gemini watching the map as a live news broadcast read by ElevenLabs (A21) · judge's advice for the Gemini prize
2026-11-14 16:15 · owner · Drop the hologram: the nation card docks to the right side as a parchment panel; nation and region names on the globe always face the camera · the hologram did not look good enough; labels must read from any angle
2026-11-14 16:40 · owner · Dispatches (war declared, return, fall) are drawn by lane c's Chronicle from recentEvents, top centre; the closing token card is lane b's (App.tsx), opened by clicking the token meter or the End key · each goes to the lane that already holds the data
2026-11-14 16:55 · owner · Building styles (#91, option 1): six styles x five kinds (capital, city, town, temple, fort) = 30 models; Country.buildingStyle picked by Gemini in the bible, at most two nations per style; X4 manifest gains styles · judges should see cultures apart at a glance
2026-11-14 17:35 · owner · ChronicleKind gains 'secession' for a region breaking away · the design already shows it; additive
2026-11-14 17:20 · owner · The team's cloned ElevenLabs voices (Sam, Justin, Denis) are the Terra Nova News anchors (rotating), narrators for up to three nations per world, some war chants, and the royal herald who reads decrees aloud · the team presents its own world to the judges
2026-11-14 17:45 · owner · Place, region, nation and leader names draw on Durham colleges and North East towns (Hatfield, Van Mildert, Elvet, Spennymoor, Newcastle, the Wear...), adapted to each world, never named outright · Durham judges should recognise their home
2026-11-14 18:00 · owner · Technology ages: each nation moves through ancient, medieval, gunpowder, industrial and modern (start age from the world's era), and its armies, fleets and new trader ships look the part (bows and swords to tanks); merchant ships cross the oceans between trading nations · the world should visibly move through history
2026-11-14 18:10 · owner · Per-nation identity (#118): four more building styles (soviet_bloc, western_modern, egyptian, highland; 20 models), sound shaped by era and government (anthem, chant, narration prompts), flag emblems by ideology and a chronicle tone per government · every nation should feel like who it is
2026-11-14 18:25 · owner · Time control: speed is continuous from 0.1x to 64x, plus an auto pacing director that slows the world for big moments and speeds through quiet years; the server reports the clock · the fixed 1/2/4/8 steps were too fast at times and too slow at others
2026-11-14 18:40 · owner · Ruined, drowned and post-apocalyptic worlds start in the ancient age (survivors rebuild from salvage), so every world type shows the climb from spears to tanks · the demo must show the march of history
2026-11-14 18:40 · owner · Lane a's laptop may run up to 7 agents at once; other lanes keep 4 · the owner's laptop has the headroom
2026-11-14 19:00 · owner · History keeps going past the present: two more ages, future (drones, hover tanks, railgun cruisers, maglev freighters, arcology cities) and stellar (mechs, starships, orbital freighters, space elevators, satellites over the globe) · the world should not stop at 2050
2026-11-14 19:20 · owner · Solana economy (docs/research/solana-economy.md): one fixed-supply Token-2022 world currency, a wallet per nation signing its own payments, the sim is the truth and the chain a 5-second mirror; payments for trade dues, reparations, plunder and seizure, war chests and subsidies, and pooled funds when nations join forces and move together; live devnet in the demo with a saved signature file as backup; dependencies approved: @solana/kit 8.6, kit-plugin-rpc and kit-plugin-signer 0.23, @solana-program/token-2022 0.20, @solana-program/memo 0.16 (never @solana/web3.js) · MLH Best Use of Solana

- 2026-11-14 16:30 · Owner: terrain matters in the rules (#135). One `TERRAIN_EFFECTS` table in `@terra/shared` (defence, supply, attrition, move, income, pop, yields) with lane b's numbers; a `unit_attrition` event; landings fight at -20%. Row A28.

- 2026-11-14 16:50 · Owner: a council per nation, ruler and general only (#146), with cover, succession and a kill control for the demo. Row A29.
- 2026-11-14 16:50 · Owner: wonders with a small bonus (#147), 2 to 4 per world, 8 models. Row A30.

- 2026-11-14 17:10 · Owner: air escorts drawn into army models (a jet fighter above the modern tank, two rocket bikes of our own design for the future army; no new unit kind) and effect anchors in unit models for afterburners, thrusters, wakes, smoke, dust and contrails, drawn by lane b.

- 2026-11-14 17:40 · Owner: keep lane c's visual event feed with globe thumbnails as row C10 (#151; built in #159, placed in #162).

- 2026-11-14 17:50 · Owner: the economy moves to lane b (its owner asked for it): the Solana bridge `server/src/chain/`, `sim/payments.ts`, `sim/trade.ts`, `scripts/solana-keys.ts` and `server/scripts/check-money.ts` join lane b's paths. Contract changes (X1 `payment`, X2 `ledger`/`economy`, X3 economy) still go through the owner. Lane a keeps the demo recording and its signature sidecar.

- 2026-11-14 18:10 · Owner: yes to lane b's #187: a `wealth` map mode (X5) and `loan` / `repayment` payment reasons (X1); lane b adds the small loan-memory hook in `rules.ts` and names it in its PR. Loans are cut first if behind.
- 2026-11-14 18:00 · Owner: lane a may take work that is blocked or untouched in another lane to finish sooner, after telling that lane in an issue. First: a C5 submission draft and README (lane c keeps the final edit and submits), and B9 the timeline scrubber.

- 2026-11-14 18:30 · Owner: time gears from 1 month a second (speed 1/24, the slowest, for live demo interaction) through 1 season, 1, 2, 3, 4, 8, 16, 32, 64 and 128 years a second; the client shows month and day between yearly ticks and units glide. A prepare mode for demos (`prepare: true` or the `prepare` control): the world waits paused while lore, narration, chants, anthems and first ruler decisions are made, with a readiness panel. A close-zoom tilted camera that looks along the ground at walls and buildings. Lane a builds these, plus a smooth rewrite of the chronicle ticker (lane c's file), and tells the lanes.

- 2026-11-14 18:50 · Owner: yes to lane b's #204 economy core (goods per province, shortages and a goods market paid as `trade`, devastation, war readiness, politics axis and radicalism, a `politics` map mode). Lane b writes `sim/economy.ts`, payments and the hooks in `types.ts`, `applyEvent` and `rules.ts` section 5 itself, in small PRs that pass check.sh, check-money and check-replay; lane a adds the ruler-digest line.

- 2026-11-14 19:00 · Owner: lane a's laptop (SamsSide) may run up to 10 agents at once, up from 7, for throughput during the hackathon; other lanes keep 4.

- 2026-11-14 19:05 · Owner: on lane c's #203, build the strategic core now (terrain-aware army paths, zone of control, chokepoint forts; lane a) and cities that visibly grow walls by tier at close zoom (derived `cityTier`); about 1,000 provinces only if frame rate allows; resources and trade are already covered by B11; districts and farmers go to 'What's next'.
- 2026-11-14 · Clarification to the A29 entries: the 0.85 cover factor (`COVER_STRENGTH`) scales only the attacker (`coverMultiplier` in `settleMove`), not a covered nation's defence.

- 2026-11-14 19:45 · Owner: council members age (a `born` year; natural death rising from 50, nobody past 100; cause `old_age`), so rulers no longer reign for centuries; new worlds start at 1 month a second; Terra Nova News gets an animated anchor in a studio window (our own original character and set, not any broadcaster's branding).

- 2026-11-14 20:15 · Owner: on lane b's #245, a calmer UI in the spirit of Age of History 3 with our own original icons and styling: lane a designs it in the team Figma file and builds items 2 to 4 (one left panel at a time with a rich nation and province card, small war tabs top right, a node-graph Network panel); lane b builds item 1 (icon map modes on the minimap) and the camera fix.
- 14 Nov 19:45 (owner): the nation card and the Network panel share one left slot, 340 px (`--left-panel-width`, class `left-dock`); contract X5 updated; the bottom-left Ledger button is removed (the Treasury tab holds the ledger). The demo projector is 1920x1080, so layout is checked at 1080p, not 1280x720.
- 14 Nov, owner: the server's memory is capped. A World's `chronicle` is a recent window (about the last 500 lines, never the last 40 years, founding and secession lines kept for the whole run), trimmed by the shared `applyEvent` so every replica, snapshot and browser agrees. The engine and the mock keep no event log in memory; `GET /api/world/log` streams the run from the recorder's `server/replays/<worldId>.ndjson` (same shape). Contract X1/X3 notes updated.
- 2026-11-14 · Owner: time gears run from 1 week a second to 10 years a second (1/104 to 5); new worlds still start at 1 month a second. The material-system UI style is kept as the team's chosen look.
- 14 Nov 21:10 (owner, #276): presentation mode on key P and a collapsed-by-default screen (globe, top bar, minimap; chronicle, history, decree and ledger open on click); 'fewer words at orbit' declined for now. The decree field widens at 1800 px and up. Built by lane c.
- 14 Nov 21:20 (owner): no video. Judging is a 2-minute live demo on the owner's laptop, repeated for each judge who comes to the table; docs/submission.md section 3 is the script.
- 14 Nov (owner, #288): demo polish first: decree severity from the words with visible feedback, news focus beats shown as a live picture-in-picture, new worlds start at 3 months a second.
- 14 Nov (owner): instrumental cinematic backing music per era from ElevenLabs, quiet under the voices and ducked while anyone speaks.
- 14 Nov (owner): one command starts the table demo (`npm run demo:live`, or `npm run demo` for a mock rehearsal), `npm run demo:reset` between judges, `npm run demo:stop` to exit.
- 14 Nov (owner, #313): tech ages are gated by calendar year (medieval 500, gunpowder 1400, industrial 1760, modern 1900, future 2050, stellar 2150); a world's starting era wins; satellites need stellar and 1957.
- 14 Nov (owner): polish mode ON: polish, fixes, performance and approved features only; a new major feature needs the owner's yes first. Toggle: the `## Polish mode: ON` heading in CLAUDE.md.
- 14 Nov (owner): we do not enter the MLH Best Use of Entire prize (not used properly enough); removed from the Devpost draft and the submission text. Entire keeps recording sessions as before.
- 14 Nov (owner): `npm run demo` starts the live demo (Gemini, ElevenLabs, Solana devnet) on this laptop; `npm run demo:mock` is the no-spend rehearsal; `npm run demo:live` stays as an alias.
- 14 Nov (owner, #317): one warmonger per world and earlier first wars; a war-report scene on the news.
- 14 Nov 23:15 (owner, #345): industrial and modern towns lose their medieval walls (lane a); battle readability (status line over armies, fire on the battle line, attack arrow) goes to lane b once `a/anim-war` has merged; smaller army groups parked; after-demo ideas live in `docs/future.md` (lane a owns it).
- 14 Nov (owner, #317): satellites from the modern age; a national mood that shifts with what happens; satellites can be shot down in future-age wars; towns modernise through the ages.
- 14 Nov 23:50 (owner): an LLM provider switch: Gemini, Gemma through the Gemini API, local Gemma (Ollama) or hybrid; audio and painted flags stay on Gemini.
