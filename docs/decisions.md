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
