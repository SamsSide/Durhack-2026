# Terra Nova demo pack

*Written 15 Nov 2026 from `docs/demo.md`, `docs/submission.md` section 3, `docs/documentation.md`
and `README.md`. Those files are the sources; fix them first, then the copies here.*

Everything the three presenters need for the table demo, and for learning how the project works,
in one folder. Read in this order.

| File | What it is | Time to read |
| --- | --- | --- |
| [`cheat-sheet.md`](cheat-sheet.md) | One page to glance at behind the table: pitch, the seven beats, keys, prize one-liners, honest limits, what to do if it breaks | 2 minutes |
| [`script.md`](script.md) | The timed 2-minute script for three speakers, the 20 and 30-second versions, the sponsor add-ons and the reset routine | 5 minutes |
| [`how-it-works.md`](how-it-works.md) | How the whole thing works, in plain English | 5 minutes |
| [`judge-qa.md`](judge-qa.md) | The pitch, the prize angles, 25 likely questions with answers, and the questions each person answers about their own lane | 15 minutes |

The longer sources:

- [`docs/demo.md`](../docs/demo.md): the full runbook (desktop app setup, Ollama, failure plays,
  rehearsal checklist, what the overnight test run found).
- [`docs/documentation.md`](../docs/documentation.md): how Terra Nova works in full, with every
  algorithm, the problems we hit and the limits.
- [`docs/submission.md`](../docs/submission.md): the Devpost text and the prize sections.
- [`docs/prizes/final-review.md`](../docs/prizes/final-review.md): which prizes we entered and why.
- [`docs/study/lane-b.md`](../docs/study/lane-b.md): lane b's own study sheet.
- The Devpost page: <https://devpost.com/software/terra-nova-jnokwx>
- The public README: [`README.md`](../README.md) (features, controls, quick start).

## Who says what

Three people speak, each about their own lane. The script and the Q&A still say [name A],
[name B] and [name C]; write your own names in before rehearsing.

| Speaker | Lane | GitHub | Talks about |
| --- | --- | --- | --- |
| [name A] | a | SamsSide | The world, the agents, Gemini, the cut and restore, story and sound |
| [name B] | b | CutGrass88 | The globe and the economy on Solana |
| [name C] | c | Justin-CODING-PY | The interface, the spoken decree, the news |

## Start the demo

Full steps are in [`docs/demo.md`](../docs/demo.md) section 1. In short:

1. Connect the projector or second screen **before** pressing Start: the game opens fullscreen on
   an external 1920x1080 display if one is connected, otherwise on the laptop screen.
2. In a WSL terminal in the repo: `npm run demo`. The setup window opens.
3. Pick the settings (they are saved): Demo mode Live, AI rulers Both, Solana devnet On, and the
   world you want. Voice is Off unless the ElevenLabs credit was topped up (see the risks below).
4. Press **Run checks** and wait for `READY`. Then press **Start**.
5. Press **F11** if the game is not fullscreen, then **P** for presentation mode.

| Command | What it does |
| --- | --- |
| `npm run demo` | The desktop app: settings, checks, then the game |
| `npm run demo:mock` | A mock rehearsal: no API calls, no keys |
| `npm run demo:check` | The preflight checks only |
| `npm run demo:reset` | A fresh world with the same choice as setup (add `-- --replay demo-1` for the saved replay) |
| `npm run demo:terminal` | The old terminal flow in a browser, if the app will not start |
| `npm run demo:stop` | Stop the terminal demo |

## Keys you need at the table

The full table is in the public [`README.md`](../README.md), "Controls and key bindings".

| Key | What it does |
| --- | --- |
| `P` | Presentation mode on or off (hides every panel) |
| `Esc` | Close the open panel or card; leave presentation mode; close the Explorer window |
| `1` to `6` | Map modes: political, terrain, diplomacy, strength, wealth, politics |
| `H` | Open or close the chronicle timeline |
| `End` | The closing card (what this world cost in tokens) |
| Hold `Space` on the mic | Speak a decree |
| `Left` / `Right` on the time gears | Slower or faster; `Home` / `End` for slowest or fastest |
| `S` | Spotlight tour of the world's big moments |
| `F11` | Fullscreen on or off (desktop app) |
| `Ctrl+Shift+R` | Reset the world between judges (desktop app) |
| `Ctrl+Shift+S` | Back to the setup window (desktop app) |

Mouse: drag spins the globe, scroll zooms, a click selects a nation, an army or a payment arc.

To move the game to another screen after it has started: press `F11` to leave fullscreen, move the
window with `Win+Shift+Left` or `Win+Shift+Right` (a Windows shortcut, not tested on this build),
then press `F11` again. Connecting the screen before Start is the reliable way.

## Between judges

1. `Esc`, then `P`. Restore any cut link, unpause, set the gears back to a few years a second.
2. If the world has run too far or looks broken: `Ctrl+Shift+R` (about a minute live, instant for
   a replay). Do not debug at the table.

The full routine is in [`script.md`](script.md), "Reset routine between judges".

## If it breaks

The full table is in [`docs/demo.md`](../docs/demo.md) section 6.

| Failure | Play |
| --- | --- |
| No network, or Gemini is down | `Ctrl+Shift+S`, World: Saved replay demo-1, Start anyway. Say plainly that it is an exact replay of a saved run. Or set AI rulers to Local Gemma if it is warm |
| Rulers fall to autopilot mid-demo | That is the resilience story: say so and carry on |
| Devnet is slow | Show the Explorer window opened beforehand, or `docs/shots/solana-devnet-payment.jpg` |
| The app will not start | `npm run demo:terminal`, or double-click `desktop/fallback/terra-chrome.bat` on Windows |
| Everything else fails | `npm run demo:mock` and say it is a mock rehearsal, or show `docs/shots/` |

Never tell a judge a failure was planned.

## Known risks to check in rehearsal

- **Sound.** The overnight run found the ElevenLabs account had about 20 characters left
  (`docs/demo.md` section 8). With voice Off the Anthem button shows the lyrics and the news shows
  "(no sound)". The anthem beat and the news beat in the script need either a top-up or audio
  already cached for the prepared world. Hear them once before the first judge.
- **The saved replay `demo-1` has no payments, council deaths or wonders** (it was recorded on
  14 Nov before those features; its log holds none of those events). On the replay, skip the
  Solana click and the ruler kill and show the Explorer screenshot instead.
- **Top gear with local Gemma** drops to about 50 frames a second, so hold ten years a second for
  the three seconds the script asks for and no longer.
- **Close every other window that shows the game** (Chrome tabs included) before judging: three
  forgotten tabs halved the frame rate.
- **Honest limits to say out loud if asked:** one Node process, the cut is a software switch;
  Solana is devnet; rulers are not reproducible, only the log replays exactly.
