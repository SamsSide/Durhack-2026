# Saved runs (row A9)

Every run is an event log, so every run is saved here and can be replayed exactly, offline, with
no API calls. `GET /api/replays` lists them (demo worlds first, then newest first);
`POST /api/replays/:id/play` plays one in place of the live world; `POST /api/world` goes back to live.

## Files

- `demo-N.json` is a finished run in one file (`{ id, name, era, prompt, createdAt, initial, events, agents }`).
  These are committed. Everything else here is git-ignored.
- `<worldId>.head.json` plus `<worldId>.ndjson` is a run being recorded by the server (written every
  second, so a crash keeps it). The `agents` lines are the network panel updates (cuts, restores, deletes).

## Recording the demo world (mock, no API calls)

    npx tsx server/scripts/record-demo.ts            # writes server/replays/demo-1.json

600 ticks, fixed prompt and seed, a cut at tick 150, a restore at 250 and a delete at 350.

## Recording a live (Gemini) demo world, with its audio cached

1. `LLM_MODE=live npm run dev`, create the world from the Create screen and let it run (speed 8 is fine).
   The server records it as `server/replays/<worldId>.head.json` and `.ndjson`.
2. While it runs, click the nations so lore, narration, anthem and chant are made; the mp3 files land in
   `server/.cache/` keyed on the world id and the lyrics.
3. Compact it into one file: in a node REPL or script, `loadReplay('<worldId>')` then `saveCompact({ ...f, id: 'demo-2', name: '...' })`
   (both from `server/src/engine/replays.ts`).
4. Lore is kept on disk per world: every lore Gemini writes lands in `server/.cache/lore/<worldId>/` as
   `country-<id>-t<tick>.json` (one per version) and `country-<id>.json` (newest), likewise `region-`.
   During playback the lore route never calls Gemini: it serves the newest stored version at or before the
   replay's tick (else the template). Narration, anthem, chant and broadcast audio are keyed on that text, so they
   hit `server/.cache/` too; a missing mp3 during playback serves the bundled sample, never ElevenLabs.
   To play offline, copy the whole `server/.cache/` to the demo laptop (lore, narration, anthem, chant).
