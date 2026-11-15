# Demo runbook (the table, every judge)

*Written 15 Nov 2026 by lane a from `README.md`, `desktop/main.cjs`, `scripts/desktop.sh`,
`scripts/preflight.mjs` and `docs/submission.md` section 3 (the spoken script). Anything not seen
running is marked `[check]`.*

Judging is a live 2-minute demo on the owner's Windows laptop, given again for every judge. No
video. Three people speak: [name A] (lane a), [name B] (lane b), [name C] (lane c).

## 1. Set up the desktop app

Do this once, at least 20 minutes before judging starts, then again after any reboot.

1. In a WSL terminal in the repo: `npm install` (first time only), then `npm run demo`. The first
   run builds the app on Windows (`C:\terra-desktop`, about a minute) and adds a Terra Nova
   shortcut to the desktop. Later runs rebuild only when `desktop/` changed.
2. The **setup window** opens. Suggested settings (they are saved for next time):

   | Setting | Choose | Why |
   | --- | --- | --- |
   | Demo mode | Live | Real Gemini, Solana devnet |
   | AI rulers (LLM) | **Both** (`hybrid`) | Local Gemma for ruler turns, Gemini for everything else; a judge still sees Gemini API calls |
   | ElevenLabs voice | **Off** unless the credit was topped up | Off means no ElevenLabs calls; the Starter plan has 30,000 characters per run |
   | Solana devnet | On | Real payments and Explorer links |
   | World | Type a new world, or Auto-prepared demo world | Prepared world for the 2 minutes; Saved replay demo-1 is the fallback |

   `[check]` With voice Off, confirm on a rehearsal that anthems, chants and the news anchor still
   play from the disk cache for the prepared world. If they do not, top up and turn voice On.
3. Press **Run checks**. Each line appears as it finishes: PASS, WARN, FAIL or SKIP. It includes
   which GPU the game renders on (it must be the NVIDIA one) and ends `READY` or
   `NOT READY: N failed`. With LLM Both, the Ollama check also warms local Gemma (section 2).
4. Press **Start** (enabled when nothing failed; **Start anyway** skips that). A splash shows the
   progress (Logs streams the server log). The game opens fullscreen on the external 1920x1080
   display if one is connected.
5. Press **F11** if it is not fullscreen. Press **P** for presentation mode.

The app holds no keys. Keys come from `~/.config/durhack/keys.env` in WSL.

## 2. Ollama on Windows, and warming local Gemma

LLM Both sends ruler turns to local Gemma through Ollama (default model `gemma4:e4b-it-qat`,
host `http://localhost:11434`). Ollama must be running before Run checks.

- Start it: open the Ollama app from the Start menu (it sits in the tray), or run `ollama serve` in
  a Windows terminal. Pull the model once: `ollama pull gemma4:e4b-it-qat`.
- Check it: `ollama list` shows the model; `http://localhost:11434` answers "Ollama is running".
- **The first load after a boot can take minutes** (the model is read from disk into GPU memory).
  Do not wait for it at the table.
- **Run checks warms it.** The Ollama check sends one tiny request with `keep_alive` 30 minutes and
  reports "warm in VRAM (30m), first token in N ms". Allow about 70 s for that line. Re-run checks
  if more than 30 minutes pass before the next judge.
- If it will not warm: switch the setting to Gemini API (or Gemma via Gemini API) and run checks
  again. Rulers on Gemini are the safe default.

## 3. The per-judge loop

1. The prepared world is on screen, presentation mode on, orbit, a few years a second.
2. Give the 2-minute script from `docs/submission.md` section 3.
3. Between judges, press **Ctrl+Shift+R** (reset): the same world choice as setup, fresh. Live takes
   about a minute and a splash shows progress; a replay is instant. Press play.
4. **Ctrl+Shift+S** returns to the setup window (change a setting, re-run checks). **F11** toggles
   fullscreen. **F12** opens developer tools (do not at the table).
5. Hand-over cleanup: Esc, **P**, restore any cut link, set the gears back. If the world is too
   late in its ages or has no war, reset instead.
6. Quitting the app stops the demo.

**Saved replay `demo-1` (the fallback).** Choose World: Saved replay demo-1 in setup (or
`npm run demo:reset -- --replay demo-1` in WSL). No API calls, exact, audio cached, known strong
state. Press **Home** on the timeline scrubber to jump back to tick 0, then run the gears. Use it
for a queue of judges to save the Gemini and ElevenLabs budget.

## 4. The 30-second version

For a judge with half a minute. [name A] alone.

1. (0:00) "Terra Nova: a world composed live by AIs, each nation ruled by its own Gemini agent with
   its own wallet." Orbit, gears up.
2. (0:10) Cut a nation, press Show beliefs: "Cut off, it keeps ruling on what it last knew."
3. (0:20) Restore: "Bring it back and its history merges in. No central server." Offer the full
   2 minutes.

## 5. Sponsor add-ons (20 seconds each, one per entered prize)

Say it after the 30-second version or the 2-minute script, for the judge who is there.

| Prize | Who | The 20 seconds |
| --- | --- | --- |
| Neptune North: Actors work better together | A | Show the Network panel. "Every nation and general is an agent with its own replica on a bus. Cut one: it keeps building on stale beliefs, queued events, neighbours notice the silence. Kill a general: a stand-in, then a successor. Restore: disputes settled by one rule. Honest limit: one process, the cut is a software switch." |
| Marshall Wace: New Worlds | A | Open the Create screen (or say it). "Every run is a new world from one line or a picture, from bows to satellites and orbital war. Every run is an event log you can replay and audit." |
| MLH Gemini API | A | Press End for the token meter. "Rulers, the world bible, lore and anthem lyrics are Gemini text; a picture sets the world; a spoken decree is heard as audio; the news reads an image of the globe. Gemma runs through the Gemini API as well." |
| MLH ElevenLabs | C | Play an anthem and a chant for 5 s each, then the news anchor. "Everything is generated from what happened: narration, an anthem sung from the nation's history, war chants, and news anchors in our own cloned voices." |
| MLH Solana | B | Click a payment arc, show the Explorer page. "Token-2022 currency, fixed supply of one million, mint authority revoked, one wallet per nation, every payment a memo plus a transfer signed by the payer." Do not quote "35 payments, drift 0" until re-run on the final build `[check]`. |
| Overall main track (Composition) | any | "A world, its history, money and music composed live by many authors. The interface was designed in Figma; the demo runs as a Windows app with a preflight; a saved replay is the backup." |
| Waterstons | A | One line: "We connected language models, a simulation, cloned voices, music and a public chain into one map, so anyone can watch how independent decision-makers cooperate and recover." |

Not entered, do not mention as entries: Entire, Tiger Data.

## 6. Failure plays

| Failure | Sign | Play |
| --- | --- | --- |
| No network | Gemini, ElevenLabs or Solana checks fail; the splash hangs | Switch to World: Saved replay demo-1 (Ctrl+Shift+S, pick it, Start anyway). No API calls. Say plainly: "The network is down, so this is an exact replay of a saved run." Or set LLM to Local Gemma (Ollama) if it is warm; rulers then run offline. Keep the Explorer screenshot `docs/shots/solana-devnet-payment.jpg` as the payment proof. |
| Gemini down or rate-limited | Gemini check FAILs; rulers fall to autopilot (the world keeps going) | That is the resilience story: say it. For a clean demo set LLM to Local Gemma or the replay. |
| Ollama down | Ollama check FAILs; a hybrid world falls back to Gemini or autopilot | Start Ollama (section 2) and re-run checks, or set LLM to Gemini API and re-run checks. |
| ElevenLabs out of credit | Characters check WARN or FAIL | Voice Off, rely on cached audio `[check]`, or use the replay (audio cached). |
| Devnet slow or faucet empty | Solana check WARN | Use the Explorer window opened before, or the safety screenshot. |
| The app will not start or crashes | No window, or a blank game window | In a WSL terminal: `npm run demo:terminal` (the old terminal flow, opens the browser; press F11). Or double-click `desktop/fallback/terra-chrome.bat` on Windows: it starts the same demo and opens a fullscreen Chrome app window. Stop either with `npm run demo:stop`. Logs are in `.demo/`; the app log is `%APPDATA%\Terra Nova\main.log`. |
| The world looks broken mid-judge | Stuck, empty or silent | Ctrl+Shift+R, or the replay. Do not debug at the table. |
| Everything else fails | | `npm run demo:mock` (no API calls, no keys) and say it is a mock rehearsal, or show screenshots in `docs/shots/`. |

Never tell a judge the failure was planned. Say what is happening and move to the play.

## 7. Rehearsal checklist

Do it three times in a row, with a timer, all three speakers, on the real laptop and display.

- [ ] Ollama running; `npm run demo:check` (or Run checks) ends `READY`; the GPU line says NVIDIA.
- [ ] Local Gemma warm (the "warm in VRAM" line); the first ruler turn is quick.
- [ ] Prepared world is ready: readiness panel green, a few hundred years in, a war under way, at
      least one gold payment in the ledger.
- [ ] Commons wallet funded from the devnet faucet; one payment's Explorer page open in a second window.
- [ ] The 2:00 script in `docs/submission.md` section 3 runs in 2:00 or less, handing over cleanly
      between [name A], [name B], [name C]. Drop the satellite beat if it runs long.
- [ ] Spoken decree tested with a real microphone (`[check]` in `docs/submission.md`).
- [ ] Anthem, chant and the animated news anchor heard once with sound, with the voice setting you
      will use at the table.
- [ ] Council kill, cut and restore, Show beliefs each tried once on the prepared world.
- [ ] Ctrl+Shift+R, Ctrl+Shift+S and F11 work; a reset gets a fresh world in about a minute.
- [ ] Replay `demo-1` plays; Home jumps to tick 0.
- [ ] Failure plays tried once: kill Ollama, then pull the network cable, then
      `terra-chrome.bat` and `npm run demo:terminal`.
- [ ] 30-second version and each sponsor add-on said once aloud.
- [ ] Optional naval and port beat rehearsed only if it is merged and seen running.
- [ ] Speaker connected and loud enough for a busy hall; laptop on power, sleep off, notifications off.
- [ ] Everyone knows who answers which question: `docs/documentation.md` section 8, "Per-person judge Q&A".

## 8. What the overnight test run found (15 Nov, in the desktop app)

Everything below was seen in the Electron app on the demo laptop, not in Chrome.

- **Frame rate.** Production build, RTX laptop GPU: about 150 fps from orbit and 130 at ground level
  with every feature on. Close every other tab or window that shows the game before judging: three
  forgotten Chrome tabs halved the frame rate.
- **Local Gemma shares the GPU with the picture.** Local calls now wait in line, one at a time, with
  a short rest between routine answers; decrees, lore and news go first. Measured on local Gemma at
  one season a second: 140 to 210 fps with almost no hitches (it was about 90 fps with a hitch every
  second before the queue). At the top speed gear the model answers nearly back to back and the game
  drops to about 50 fps with visible hitches, so keep the top gear to the few seconds the script asks
  for, or pick Gemini API for the smoothest picture. A saved replay holds about 145 fps at ten years a
  second, because it makes no calls.
- **Prepare for a demo** on local Gemma with voice off takes about a minute and ends 12 of 12.
- **The world bible.** With LLM Local it still goes to Gemini when a key is set (13 s to found a
  world); local Gemma needed over 73 s. `OLLAMA_BIBLE=1` keeps it local.
- **Voice Off is really off now.** It used to keep calling ElevenLabs; the account has about 20
  characters left, so anthems and the anchor are silent until it is topped up. With voice off the
  Anthem button shows the lyrics and the news shows "(no sound)".
- **A small screen.** A 1080p projector at 150% scaling gives a 1280 x 720 page: the Create button
  and the news window now fit. At 100% scaling nothing changes.
- **The Solana beat.** A click on a payment or a treasury link opens the Explorer in a window over
  the game; **Esc** (or Ctrl+W) closes it.
- **Between judges.** Ctrl+Shift+R gives the Create screen in about 15 s. The saved replay is the
  first row of Saved worlds on the Create screen ("The Drowned Age", Replay).
- **The opening shot.** A new world opens facing the side with the most nations, whole planet in
  view; clouds part when the camera flies to a nation.
