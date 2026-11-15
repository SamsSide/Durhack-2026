# Cheat sheet (one page, behind the table)

*Condensed on 15 Nov 2026 from `docs/submission.md` section 3, `docs/demo.md` and
`docs/documentation.md` section 8. Fix the source first, then this copy. Back to the
[demo pack index](README.md).*

## The pitch (10 seconds)

"Terra Nova: a new world composed live by AIs. Every nation has its own Gemini ruler, its own
wallet on Solana, and nobody is in charge. Cut one off and it keeps going; bring it back and its
history merges in."

## The seven beats (2:00)

| # | Time | Who | Beat | Keys and clicks |
| --- | --- | --- | --- | --- |
| 1 | 0:00 | A | Orbit: a world composed live, a ruler and a wallet per nation | None |
| 2 | 0:10 | A | Cut a nation; it keeps ruling on what it last knew | Network panel, cut, Show beliefs |
| 3 | 0:25 | A | Kill its ruler, stand-in, successor; restore, the merge, "the Silence" | Kill (two clicks), restore, `H`, `Esc` |
| 4 | 0:45 | B | The globe at ten years a second; a real Solana payment | Gears up 3 s, click a gold arc, Explorer, `Esc` |
| 5 | 1:05 | B | Bows to starships; a satellite shot down, or ports and a sea battle | `1` to `6` (show two) |
| 6 | 1:20 | C | The nation card: ruler, mood, treasury, lore and anthem | Click a nation, play the anthem 3 s |
| 7 | 1:35 | C, then A | Speak a decree, the news reports it; close on the token meter | Hold `Space` on the mic; News; `End` |

Running long: drop beat 5 first, then the ruler kill. Last line, by A: "Which part do you want to
break?" The exact words are in [`script.md`](script.md).

## Keys

| Key | Does |
| --- | --- |
| `P` | Presentation mode |
| `Esc` | Close a panel, a card or the Explorer window |
| `1` to `6` | Map modes |
| `H` | Chronicle timeline |
| `End` | Closing card (token meter) |
| Hold `Space` on the mic | Speak a decree |
| `Left` / `Right` on the gears | Slower or faster |
| `F11` | Fullscreen |
| `Ctrl+Shift+R` | Reset the world |
| `Ctrl+Shift+S` | Setup window |

## The six prizes, one line each

| Prize | Say |
| --- | --- |
| Neptune North | "Every nation is an agent with its own copy of the world. Cut one and it keeps building; restore it and one rule settles the disputes." |
| Marshall Wace (New Worlds) | "Every run is a new world from one line or a picture, with its own history, music and money, and it replays exactly." |
| Waterstons | "We connected language models, a simulation, cloned voices, music and a public chain into one living map." |
| MLH Gemini | "Gemini rules every nation and is used four ways: text, a picture in, speech in, and the map in for the news." |
| MLH ElevenLabs | "Narration, anthems sung from each nation's real history, war chants, and news anchors in our own cloned voices." |
| MLH Solana | "A fixed-supply Token-2022 currency, a wallet per nation, and every payment a memo plus a transfer signed by the payer." |

Not entered, so do not mention as entries: Entire, Tiger Data.

## Five honest limits (say them plainly if asked)

1. One Node process on one laptop; the cut is a software switch, not a real network partition.
2. Solana is devnet; the simulation is the source of truth and the chain is a mirror.
3. Rulers are not reproducible; only the recorded log replays exactly.
4. Painted flags are off (image billing); flags are drawn from a spec.
5. Tuned for about 1,200 provinces and 16 nations; not benchmarked beyond that.

## If it breaks

| What | Do |
| --- | --- |
| The world looks stuck or wrong | `Ctrl+Shift+R`. Do not debug at the table |
| No network or Gemini down | `Ctrl+Shift+S`, Saved replay demo-1, Start anyway. Say it is an exact replay. The replay has no payments: show `docs/shots/solana-devnet-payment.jpg` |
| Rulers on autopilot | Say so: that is the resilience story |
| No sound | Voice is Off or out of credit: the Anthem button shows the lyrics; say what would play |
| The app will not start | `npm run demo:terminal`, or `desktop/fallback/terra-chrome.bat` |
| Nothing works | `npm run demo:mock`, or the screenshots in `docs/shots/` |

## Between judges

`Esc`, `P`, restore the cut link, unpause, gears back to a few years a second. Too far gone:
`Ctrl+Shift+R`.
