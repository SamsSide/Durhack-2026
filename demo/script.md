# The 2-minute table demo: script, short versions and reset

*Copied on 15 Nov 2026 from `docs/submission.md` section 3 (the script and the reset routine) and
`docs/demo.md` sections 4 and 5 (the 30-second version and the sponsor add-ons). Fix the source
first, then this copy. Back to the [demo pack index](README.md).*

Replace [name A], [name B] and [name C] with your own names before rehearsing: A is lane a
(SamsSide), B is lane b (CutGrass88), C is lane c (Justin-CODING-PY).

There is **no video**. Judging is a 2-minute live demo on the owner's laptop (1920x1080) running
the real app, given again for every judge who comes to the table. Two minutes is the hard
maximum. Matches `docs/hackathon-plan.md` section 2. Where a sponsor form asks for a demo video
link, write "live demo at the table; no video" `[check]` if the form insists on a link. The full
setup, failure plays and rehearsal checklist are in `docs/demo.md`; this section is the script.

Three people speak, each about their own lane: [name A] (lane a: world, agents, story and sound),
[name B] (lane b: the globe and the economy) and [name C] (lane c: the interface). The brief was
10 s, three times 40 s and 10 s, which is 2:20; to keep the 2:00 maximum each lane gets about 35 s
(lane c 30 s). Say about 85 words in 35 s; do not add words.

## On screen before a judge arrives

- The desktop app, started with `npm run demo` (see `docs/demo.md`), checks green, in the game
  window, fullscreen (F11). Setting: LLM **Both**, Solana on, voice per the runbook.
- A **prepared world**: created earlier with Prepare ticked, readiness panel green, audio cached, a
  few hundred years in so there are cities, a war under way and at least one gold payment in the
  ledger. Six named nations with flags.
- Presentation mode on (key **P**): the globe and the year plate only. Time running at a few years a
  second, camera in orbit. Nobody touches the mouse until [name A] starts.
- A second window with the Solana Explorer page of a recent payment, as a safety shot.
- Backup if live breaks: the saved replay `demo-1` (setup World setting, or `Ctrl+Shift+R` after
  choosing it): no API calls, exact, audio cached.

## The script (2:00)

| Time | Who | Say | Clicks and keys | On screen | Prize |
| --- | --- | --- | --- | --- | --- |
| 0:00 to 0:10 | [name A] | "Terra Nova: a new world composed live by AIs. Every nation has its own Gemini ruler, its own wallet, and nobody is in charge." | None. Slow orbit; gears at a few years a second | Planet with six flags, borders spreading, ages advancing | Main track; Marshall Wace (New Worlds); Gemini |
| 0:10 to 0:25 | [name A] | "Each nation has its own copy of the world and decides alone. Watch: I cut this one off. It keeps ruling on what it last knew." | Click a nation, open Network panel, cut its link, press Show beliefs | Its map drifts, out-of-date provinces pulse holo | Neptune North (independent decisions, resilience) |
| 0:25 to 0:45 | [name A] | "Kill its ruler: a stand-in covers, then a successor inherits the memory. Restore the link: the missing years merge in and the clash is settled by one rule, written in the chronicle." | Kill ruler (two clicks), wait for stand-in, restore the link, open chronicle (H) for "the Silence", Esc | Council marks, merge, chronicle line | Neptune North; Gemini (autopilot or local Gemma if a model fails) |
| 0:45 to 1:05 | [name B] | "I built the globe: 1,200 provinces, 100 models, ten years a second. Every payment between nations is a real Solana transfer signed by the paying nation, reason in the memo, supply fixed, mint authority revoked." | Gears to 10 years a second for 3 s, back down; click a gold payment arc; Explorer page opens; back | Fast-forward, armies, towns, then Explorer: Success, devnet, memo | Solana; main track (technical) |
| 1:05 to 1:20 | [name B] | "Ages run from bows to starships. In a late war a rival's satellite can be shot down, and the chronicle says so." | Press 1 to 6 for map modes (show 2); open the satellite shot-down on the chronicle or feed, if one has happened | Map mode change; orbit or launch scene | Main track (creativity); Marshall Wace |
| 1:20 to 1:35 | [name C] | "I built the interface from our Figma design. One calm left panel: this nation's ruler, mood, treasury, its narrated lore and an anthem sung from what really happened to it." | Click a nation; card docks left; press play on its anthem (or narration) for 3 s | Nation card, ruler, treasury, anthem playing | ElevenLabs; main track (polish) |
| 1:35 to 1:50 | [name C] | "Hold the mic: a plague in the north. Gemini hears it as audio and the engine applies it. Terra Nova News then reports it, read by our own cloned voices." | Hold Space on the decree mic, speak; open Terra Nova News | Decree box, event, animated anchor | Gemini (audio in, image in); ElevenLabs (cloned voices) |
| 1:50 to 2:00 | [name A] | "No video, no referee: rules and seeded functions move the world, and the LLM only sets focus. This whole world cost N tokens. Which part do you want to break?" | Key End for the closing card (token meter); offer the mouse | Token meter and closing card | Gemini; close on the judge's prize |

If a speaker's beat slips, drop the satellite beat (1:05 to 1:20) first, then the ruler kill.
Tailor the last sentence to the judge: Neptune North, "agents that keep working apart"; Solana,
"every coin is a signed transfer"; ElevenLabs, "anthems and the anchor are sung and spoken from
what happened"; Marshall Wace, "a new world from one line"; Gemini, "text, picture, speech and
the map all go through Gemini".

## Optional beat, if landed (naval battles and ports)

Only if the naval-battle and port work is merged on `main` and has been seen running on the
prepared world (see `docs/prizes/final-review.md`: do not claim it otherwise). It replaces the
satellite beat (1:05 to 1:20), spoken by [name B]:

| Time | Who | Say | Clicks and keys | On screen | Prize |
| --- | --- | --- | --- | --- | --- |
| 1:05 to 1:20 | [name B] | "Nations now build ports and fight at sea. A port opens a sea trade route, and the goods they trade are settled in signed payments." | Zoom to a port city; click a sea battle or trade route if one is on screen | Ships in battle, port, a payment arc | Solana; main track |

Landed overnight (#371, #372, #382) and seen in the desktop app: rehearse it once on the prepared world before using it.

## 20-second version (a judge in a hurry)

[name A] alone: orbit, gears up: "Every nation is run by its own AI." Cut a nation, Show beliefs:
"Cut off, it keeps going on what it last knew." Restore: "Bring it back and its history merges
in." Offer to show the rest. The 30-second and 20-second add-on versions are in `docs/demo.md`.

## Reset routine between judges (about 10 seconds)

1. Press **Escape** to close any open panel or card, then **P** to return to presentation mode.
2. If the link was cut, restore it; unpause time; set the gears back to a few years a second.
3. If the world has run too far (late ages, many nations dead, a quiet stretch with no war) or
   anything looks broken: press **Ctrl+Shift+R** in the desktop app. It makes a fresh world with
   the same world choice as setup (about a minute live). From a terminal, `npm run demo:reset`
   does the same and the open tab switches to it by itself, no reload. Press play.
4. Instant fallback, no API calls: choose Saved replay demo-1 in setup, or
   `npm run demo:reset -- --replay demo-1`. Press **Home** on the timeline scrubber to jump a
   replay back to tick 0, then run the gears.
5. Run the next reset while the current judge is still at the table only if it is a replay; a live
   reset replaces the world on screen. Refresh the Explorer window only if the devnet page has
   expired.

Safety shots: the Explorer page (`docs/shots/solana-devnet-payment.jpg`), the 10-years-a-second
gear (`gears-10y.jpg`) and `docs/shots/satellite-strike.jpg`.

## 30-second version

For a judge with half a minute. [name A] alone.

1. (0:00) "Terra Nova: a world composed live by AIs, each nation ruled by its own Gemini agent with
   its own wallet." Orbit, gears up.
2. (0:10) Cut a nation, press Show beliefs: "Cut off, it keeps ruling on what it last knew."
3. (0:20) Restore: "Bring it back and its history merges in. No central server." Offer the full
   2 minutes.

## Sponsor add-ons (20 seconds each, one per entered prize)

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
