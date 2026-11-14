# P9 / P10 / P20 - Overall prizes, Spirit of the Dino, RS Group with Arduino

> **Update, 14 Nov 13:50.** The RS/Arduino brief and prizes are now known (see `list.md`, P20): build with Arduino hardware, primarily the UNO Q, connecting the physical and digital worlds using sensors; 1st a 16 GB VENTUNO Q and Plug and Make kit each, runners-up a 4 GB UNO Q and kit each.

Researched 14 Nov 2026 (event day) with WebSearch/WebFetch only. Devpost returned 403 for every DurHack and project page, so winners are known from the earlier files (`durhack-2025-results.md`) and press. Builds on `durhack-2025-results.md`, `sponsor-challenge-predictions.md` and `research/pre-durhack-prize-analysis.md`; not repeated here.

Facts from the ceremony slides (supplied by the team, not re-verified): theme "COMPOSITION" (art, music, tech, idea mixing); criteria Creativity & Innovation, Technical Competence & Execution, Research & Learning, Polish & Completion; P9 1st = 15.6 inch FHD portable monitor + keyboard, 2nd = instant print camera + 100 pound Amazon card, 3rd unseen; P10 Spirit of the Dino = dino brick set + keyring; P20 RS Group with Arduino, boards to borrow, challenge text unseen.

## 1. Overall (P9)

### How main-track judging has worked

| Year | Overall prizes | What is confirmed | Source |
| --- | --- | --- | --- |
| 2023 | Winners got a levitating Bluetooth speaker each; "Lower Orbit" = 2nd | Judges were Durham staff, alumni and past organisers. They looked for "functional and useful" plus creativity and originality. Winner: Handwrite AR (VR headset spellcheck for dyslexic students' handwriting). Table vs stage judging and judge count: not stated. | [The Tab, 23 Nov 2023](https://thetab.com/2023/11/23/decoding-durhack-24-hours-at-one-of-the-uks-biggest-hackathons) |
| 2024 | "Grand Voyager" 1st, "Pathfinder's Prize" 2nd, 6,472 pound pool | Winner names not found. | [Devpost mirror](https://kelaenderkoe.pages.dev/float-https-durhack-2024.devpost.com) (mirror, not primary) |
| 2025 | "Legacy Luminary" 1st, "Solar Spark" 2nd | Clap Collider (dance at a webcam, makes music), Echo (book to ambient soundscape). Judging format not found. | `durhack-2025-results.md` |

- Table judging vs finals, and number of judges: **unconfirmed** for all years. Plan for table visits plus a Devpost entry. Ask an organiser today (one question: "table judging or stage finals, and when is the Devpost deadline?").
- Pattern across 2023-2025: every overall winner was a thing a judge could see or hear working in under 30 seconds, with a human angle (accessibility, dance, reading). 2025 is the closest precedent to a literal theme fit: the theme was "Legacy" and the top winners were music and sound projects, so music already wins here. In 2026 the theme itself names music and art, so a music or visual project is on-theme by default.

### What each criterion rewards in practice

The four criteria are the supplied slide text; the interpretations below are ours, not DurHack's.

| Criterion | What scores | Cheap way to show it |
| --- | --- | --- |
| Creativity & Innovation | A combination the judge has not seen (the theme says "idea mixing"). Unusual input, unusual output. | Open the pitch with the two things you mixed, in one sentence: "X (art/music) from Y (unusual input)". |
| Technical Competence & Execution | Something hard that visibly works, live, without restarts. | Show one non-trivial piece (real-time audio, a sensor loop, a model) and its latency or accuracy. Do not demo a mock. |
| Research & Learning | Evidence you found out something and used it. | A 20-second "what we learned" beat, see below. |
| Polish & Completion | Finished path, no dead buttons, a clean Devpost, a demo that survives a stranger. | Freeze features at hour 18, rehearse the 60-second demo twice, record a backup video. |

How to score on Research & Learning (our advice, unconfirmed as to how judges weigh it):

- Name one thing you tried that failed and what you changed (for example "raw pitch tracking was too jittery, so we quantised to a scale").
- Cite the source you built on (a paper, library docs, a dataset) in the Devpost "built with" text and on one slide.
- Say what you learned about the unfamiliar tool in one line (a first-time Arduino or audio API is a genuine learning story).
- Keep a short `docs/documentation.md` (the repo already has `durhack-explain`); judges who read the repo will see it.

### Composition projects that win (evidence is thin)

Search found few UK Devpost winners; DurHack's own two are the best evidence. Linked examples:

1. [Clap Collider](https://devpost.com/software/clap-collider), DurHack 2025 1st: webcam dance to music (Python, OpenCV, MediaPipe, Strudel). Page itself not fetched (403); details from the results file.
2. [Echo](https://devpost.com/software/echo-2upvtb), DurHack 2025 2nd: book text to page-by-page soundscape, solo.
3. [Maestro](https://www.edtechinnovationhub.com/news/stanford-team-wins-treehacks-with-ai-system-that-turns-a-broom-into-a-playable-instrument), TreeHacks (US) music track 2nd: webcam plus everyday objects played as instruments (MediaPipe, OpenCV, FluidSynth, Suno). Not UK, not 1st.
4. [Aeromix](https://devpost.com/software/aeromix) (Devpost, music theme): sensor glove on an Arduino UNO R4 WiFi. Event and result not shown in the search; unconfirmed.
5. [MoodMix](https://devpost.com/software/moodmix): Arduino UNO with light, sound and touch sensors picks a song. Event and result unconfirmed.

What the examples share: unusual input (body, book, objects, sensors), audio or visual output, a webcam or a physical object, and Python or JS. Generative music via a live-coding library (Strudel) is clearly feasible in a day. Do not claim any trend beyond that; sample size is five.

## 2. Spirit of the Dino (P10)

- Precedent: DurHack 2025 gave "Spirit of the Hack" (smart garden kit, "best embodies DurHack") to DataBridge, a deliberately odd low-level project, 3-person team. See `durhack-2025-results.md`.
- 2025 guild side challenges included "find the DurHuck Dino", acting out an algorithm and building a model windmill ([The Tab, 6 Nov 2025](https://thetab.com/2025/11/06/heres-everything-you-missed-at-durhack-x-this-year)). The Dino has been a guild-challenge item before, so the "Dino" award probably ties to the dino mascot and guild participation. Judging method: unconfirmed.
- 2023 had Megateams earning points through playful challenges ([The Tab 2023](https://thetab.com/2023/11/23/decoding-durhack-24-hours-at-one-of-the-uks-biggest-hackathons)); no spirit award mentioned there.
- Likely rewards (inference): enthusiasm, playing the guild challenges, helping other teams, humour, tying the project to the weekend's fun. Cheap actions: do the guild challenges, help a neighbouring team visibly, add one dinosaur joke or easter egg to the project and the pitch, be friendly at the stand.
- Risk: it may be decided by organiser sightings, so being seen matters more than the project.

## 3. RS Group with Arduino (P20)

### What RS and Arduino have run

| Item | Fact | Source |
| --- | --- | --- |
| RS DesignSpark "Prove It: Arduino UNO Q Community Challenge" (2026) | Written-article contest, three themes: AI at the Edge, Sustainability Through Intelligence, Human-Machine Harmony. Entry must be designed to run on a UNO Q; no board needed. Judged by RS and Arduino experts on Innovation, Feasibility, Demonstration, Impact. 5,000 dollar prize. Launched 27-28 Mar, deadline 8 May, winner announced 26 May (Smart Water Guardian AI, per [IPE](https://www.ipesearch.co.uk/RS-DesignSpark-Prove-it-winner)). | [RS DesignSpark](https://www.rs-online.com/designspark/the-arduino-uno-q-community-challenge) |
| HackNotts 24 and 25 | RS supports through the RS Student Fund (meals, prizes). HackNotts owns a hardware collection "purchased from RS" that hackers borrow. No RS-run challenge and no Arduino mention on either page. | [HackNotts 24](https://www.rs-online.com/designspark/hacknotts-24), [HackNotts 25](https://www.rs-online.com/designspark/planning-hacknotts-25) |
| Hackster / Arduino / Qualcomm UNO Q contest (2026) | 300 boards, 20,000 dollar pool; separate from RS. | [Hackster](https://www.hackster.io/contests/invent-the-future-with-arduino-uno-q-and-app-lab/hardware_applications) |

Likely DurHack brief (inference): "build something with the borrowed boards", judged on innovation, feasibility, demo, impact (the UNO Q criteria) and prize in RS components or credit. The DurHack challenge text is unseen, so the prize is **unconfirmed**; our earlier guess was 50-150 pounds each. A UNO Q-themed angle (edge AI, sustainability, assistive tech) is plausible because Arduino sent a person.

### Likely boards in the library (unconfirmed)

Slides say only "boards, sensors and peripherals". Expect UNO R4 WiFi and Nano ESP32 (cheap, common), possibly a UNO Q, and Modulino nodes. Ask at the table which they hold.

| Board / kit | Notes | Source |
| --- | --- | --- |
| UNO Q | STM32U585 MCU (Zephyr) plus Qualcomm QRB2210 quad A53 running Debian, Wi-Fi 5 and Bluetooth 5.1. Programmed with App Lab: an App is a sketch plus a Python program talking via `Bridge.call/notify/provide`. A Python process on the board can serve a web page. | [Arduino docs](https://docs.arduino.cc/hardware/uno-q/), [Mischianti](https://mischianti.org/arduino-uno-q-getting-started-with-linux-and-stm32/) |
| UNO R4 WiFi | Wi-Fi via ESP32-S3 co-processor, `WiFiS3` library, LED matrix; core `arduino:renesas_uno` (inferred from a forum listing; verify with `arduino-cli core search`). | [Arduino docs](https://docs.arduino.cc/tutorials/uno-r4-wifi/r4-wifi-getting-started) |
| Nano ESP32 | `arduino-cli core install arduino:esp32`, FQBN `arduino:esp32:nano_nora`; uploads by dfu-util, not esptool. | [Arduino forum](https://forum.arduino.cc/t/arduino-cli-and-nano-esp32-cant-upload/1261931) |
| Modulino nodes | Qwiic (I2C) plug-in nodes: Buttons, Buzzer, Distance, Knob, Movement (IMU), Pixels, Thermo, later Light, Joystick, Vibro. Official `Modulino` library. No soldering. | [Elektor review](https://www.elektormagazine.com/review/plug-and-make-kit-a-new-way-of-doing-arduino), [Arduino library](https://www.arduino.cc/reference/en/libraries/modulino/) |
| Nicla | Not researched; unconfirmed whether present. | none |

### Time to first working sketch

Estimates are ours, from a Linux or WSL laptop:

1. Install `arduino-cli`, then `arduino-cli core update-index` and install the core: about 5 min.
2. Plug in, find the port (`arduino-cli board list`), compile and upload Blink: about 5 min more. About 15 min total if nothing goes wrong; 45 min on first USB trouble.
3. WSL gotcha (this laptop is WSL2): USB is not visible by default. Per [Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/connect-usb): install usbipd-win (`winget install --interactive --exact dorssel.usbipd-win`), then in an admin PowerShell `usbipd list`, `usbipd bind --busid <id>`, `usbipd attach --wsl --busid <id>`; check `lsusb` in WSL. While attached, Windows cannot use the device. The Nano ESP32 re-enumerates when it enters its bootloader, so it may need re-attaching during upload (our experience; unconfirmed in docs). Fastest escape: flash from Windows (Arduino IDE or a Windows `arduino-cli`) and use WSL only for the app, passing serial by network or Web Serial.

### Three ways to bolt a physical element onto an AI web app

| Way | How | Pros | Cons |
| --- | --- | --- | --- |
| Web Serial | Board prints lines (JSON) at 115200 baud; the web page calls `navigator.serial.requestPort()` from a click, opens the port, reads lines. Works in Chrome and Edge only. See [Chrome docs](https://developer.chrome.com/docs/capabilities/serial). | No server, no WiFi; fastest to build; works from Windows Chrome even when code runs in WSL. | Chrome/Edge only; one page holds the port; buffer partial lines. |
| HTTP on a WiFi board | UNO R4 WiFi (`WiFiS3`) or Nano ESP32 serves `GET /state` and `POST /led`; the app `fetch`es it. | Any browser; any number of clients. | Needs a shared WiFi network; venue WiFi may isolate clients (use a phone hotspot or a travel router); CORS headers needed. |
| MQTT | Board publishes to a topic; web app subscribes over MQTT-over-WebSocket (for example the `mqtt` npm package) via a broker. | Decouples board and app; several boards, several screens. | Needs a broker (self-host Mosquitto or a public one, not for secrets); more moving parts. Broker details unverified here. |

Recommendation: Web Serial first (least risk), HTTP as fallback.

## 4. Hours to qualify and compete, and risks

| Prize | Hours to qualify | Hours to compete well | Notes |
| --- | --- | --- | --- |
| P9 overall | 0 extra (any submission) | The whole 24 h; polish is 4-6 h of it | Build the project the whole team wants; P9 is not a separate build. |
| P10 Spirit | 1-2 (guild challenges, helping, one joke) | 2-3 | Spread across the event. |
| P20 RS/Arduino | 3-5 for a basic sensor in the loop; 8+ for a polished UNO Q app | 8-10 | Only if the project has a physical part. |

Risks:

- P9: one-prize-per-team pattern in 2025 (16 winners, 16 prizes) means P9 competes with sponsor prizes for the team's one win. Unclear whether P9 is per person; unconfirmed.
- P9: the theme "Composition" makes music and art projects the default, so the field may be crowded with webcam-to-music demos. Differentiate with the unusual input.
- P20: hardware debugging eats hours; WSL USB; wifi isolation at the venue; the borrowed library may run out of boards. Mitigate by borrowing early.
- P20: challenge text unseen; prize may be small.
- P10: subjective and possibly decided by organisers' observations.

## 5. Stackability

| Theme | Stacks with a Composition project? | How |
| --- | --- | --- |
| Marshall Wace "New Worlds" | Yes | Frame the mix as creating a new world (generative world from music or sensor data). |
| Waterstons "connect things that aren't usually connected" | Yes | A sensor, a model and a speaker: connecting body/room to sound is the literal brief. Strong with RS hardware. |
| Accenture "redesign a frustrating process with AI" | Weak with art projects | Needs a real process; stack only if the composition tool fixes a real creative workflow. |
| QRT "physical language that encodes digital information" | Possible | Sound, light or tactile patterns as an encoding; read the closed brief first (QRT briefs are usually closed). |
| MLH ElevenLabs | Yes | Music (`music_v2_5`), sound effects and voice are native; see `P1-elevenlabs.md`. |
| MLH Gemini | Yes | Gemini reads images or text and drives the composition. |
| RS/Arduino (P20) | Yes, if physical | Sensor in, sound out. |
| P10 Spirit | Yes | Independent of the project. |

Best single idea shape: a physical or body input (Arduino sensor or webcam) feeds an AI that composes audio and visuals live. It targets P9, P20, Waterstons, Marshall Wace, ElevenLabs and Gemini at once, but beware watering down; one clear demo moment beats six prize logos.

## 6. Scores (1 to 5; 5 = best, effort 5 = cheap)

| Prize | Fit for any idea | Win chance | Value | Effort | Rough value | Basis |
| --- | --- | --- | --- | --- | --- | --- |
| P9 overall | 5 | 3 | 4 | 4 | 1st: monitor (~100-150 pounds) + keyboard (~50-100) = ~150-250 pounds each or per team (per-person unconfirmed); 2nd: ~100 pound card + ~60 camera = ~160 | Prices are our estimates, not sourced. Win chance: about 150 projects, 3 top places, theme is a literal music fit. |
| P10 Spirit of the Dino | 5 | 3 | 2 | 4 | ~30-40 pounds (brick set + keyring) | Low value, low cost, subjective. |
| P20 RS/Arduino | 2 | 3 | 2 | 2 | Unknown, guessed 50-150 pounds each | Needs a physical part; small field if few teams use the hardware; challenge text unseen. |

## 7. Summary lines

P9: Overall prizes judged on the four listed criteria; winners 2023-25 were demo-able in 30 seconds. Score: fit 5, win 3, value 4, effort 4. Value about 150-250 pounds. Biggest risk: crowded music-demo field and a one-prize pattern.
P10: Spirit award likely rewards guild participation and fun (2025 precedent: Spirit of the Hack to a quirky 3-person project). Score: 5/3/2/4. Value about 30-40 pounds. Risk: subjective, organiser-observed.
P20: RS ran only article-style UNO Q contests (5,000 dollars) and funds HackNotts' borrowable kit; no known RS-run hackathon challenge. Score: 2/3/2/2. Value unknown. Risk: hardware and WSL USB time sink.

## Gaps

- DurHack Devpost pages (all years) returned 403; 2024 winners and 2025/2026 judging format unconfirmed.
- DurHack 2026 P9 per-person rule, 3rd prize, P20 challenge text and board list: unseen.
- Few UK Devpost composition winners found; two of the five examples (Aeromix, MoodMix) have no event or result shown.
- Prices are estimates. Nicla availability and the `arduino:renesas_uno` core name not confirmed from official docs. MQTT broker details not researched.
