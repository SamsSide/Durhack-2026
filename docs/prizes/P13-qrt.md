# P13 and P14 - QRT challenges (Hidden in Plain Sight, Spray n' Tag CTF)

> **Correction, 14 Nov 13:50.** This file was written before the QRT brief was read. The real task is visual, not audio: the decoder works from a photograph or short video of a physical artefact, offline, with no QR codes or barcodes, and the message is exactly three words from a 30,000-word list (about 45 bits). The audio options below (ggwave and the rest) do not qualify. The index-coding and Reed-Solomon advice still holds. See `list.md` (P13) for the brief and `matrix.md` for the plan. The ceremony prize slide was P&G's, so QRT's prizes are not announced.

Researched 14 Nov 2026 with WebSearch/WebFetch only. The briefs are from the DurHack Discord #qrt channel (14 Nov, 12:28-12:29). We have NOT read the PDF (durhack_hidden_information_challenge_2026.pdf) or the word list CSV, so every scoring and rule detail for P13 below is a guess unless marked otherwise. No public page for either challenge was found. The prize slide (1st AirPods Pro, 2nd poker set, 3rd 100 pound keyboard voucher, each challenge) is unconfirmed as QRT's.

## 1. What they want

- P13: build an encoder (phrase to physical signal) and a decoder (signal back to phrase), with a word list supplied. Brief wording is verbatim in the task; nothing more is public. Likely judged on whether the decoder recovers the phrase (guess).
- P14: Hack The Box CTF hosted for QRT, browser-based, solo or teams up to 4. Rules from the brief: no sharing the event password, no sharing flags, no write-ups during or after. Scoring and categories for this event: unconfirmed (the HTB event page needs a login).
- Why QRT sponsors: the QRT Academy designs "mathematical problem-solving challenges and competitions at universities" (a May 2026 job posting for a Challenge Design Specialist, via [Kadoa listing](https://www.kadoa.com/quant/job/qrt-quantitative-researcher-challenge-design-specialist-qrt-academy-b10cde87)). It is recruiting by puzzle. Their 2025 public data challenge (blood-cancer risk, no cash prize) is in [eFinancialCareers](https://www.efinancialcareers.com/news/the-unusual-hedge-fund-quant-challenge-with-no-trading-involved). A hidden-information puzzle and a CTF fit that pattern: self-contained, objectively scored.
- What impresses quants and engineers (inference, not sourced): correctness under a measurable score, a clear information-theory argument (bits per symbol, error correction, capacity), robustness to noise, and a clean write-up of method. Cleverness without a number loses to a working decoder with a number.
- Similar QRT challenges elsewhere: searches for IC Hack, HackTheBurgh, Hack Cambridge and other 2025-2026 events found nothing. DurHack 2025 QRT had two closed challenges (a security mini-CTF plus AWS tasks, and "Meeting in the Middle"); see durhack-2025-results.md for the winners. Not repeated here. Takeaway: QRT at DurHack writes closed, scored puzzles and rewards a working tool.

## 2. P13 tech

Word-list trick: with N words each word is log2(N) bits (a 4,096-word list is 12 bits per word; check N once we have the CSV). Send word indices, not letters, and add Reed-Solomon over the index bytes. A 5-word phrase is about 60 bits plus parity, so even a slow channel (10 bits/s) finishes in seconds. Python RS: `pip install reedsolo`, `from reedsolo import RSCodec; rs=RSCodec(8); enc=rs.encode(bytes_data); dec=rs.decode(enc)[0]` (library usage from memory, unverified this session). Add a short preamble/sync pattern and a checksum so the decoder can tell success from failure.

Only ggwave facts below are confirmed, from its [README](https://github.com/ggerganov/ggwave): multi-frequency FSK, built-in Reed-Solomon, 8 to 16 bytes per second (about 64-128 bits/s), audible base 1875 Hz and ultrasound base 15000 Hz, `pip install ggwave`, `npm install ggwave`. Other figures are estimates.

| Option | Library | Rough speed | Loud-hall robustness | Demo wow | Build time |
| --- | --- | --- | --- | --- | --- |
| Audio FSK/chirps | ggwave (py/js) or own numpy FSK + reedsolo | 64-128 bit/s (ggwave) | Medium; chatter hurts, short range with a close mic helps | Medium (it is the GibberLink trick, so judges may have seen it) | 1-2 h |
| Screen to camera colour grid | OpenCV + numpy, or QR-like custom grid | hundreds of bits per frame | High if lit; needs perspective fix | High, visual | 3-5 h |
| Blink / light Morse (phone torch, LED) | webcam brightness threshold, numpy | 2-10 bit/s | High at close range, bad in glare | Medium-high, theatrical | 2-3 h |
| Printed glyph alphabet | OpenCV, ArUco markers | one word per glyph (index coding) | High | Medium; static, easy to make stealthy | 3-4 h |
| Gesture / body pose | MediaPipe | a few bits per second | Medium; lighting dependent | High, but fragile | 4-6 h |
| Knock / rhythm | microphone onset detect (librosa) | 1-4 bit/s | Low in a loud hall | Fun, risky | 2 h |
| Steganography in image/audio | Pillow LSB, or audio phase/echo hiding | KB per image | Perfect if digital; dies if re-photographed or re-recorded over air | Low unless stealth is judged | 1-2 h |
| Hidden in music | own FSK tones layered under a generated melody, or note pitch = word index | 10-50 bit/s | Low-medium over air | High for the Composition theme | 4-6 h |

Likely scoring axes (all guesses until we read the PDF): decode accuracy, speed (time or bit rate), stealth ("hidden in plain sight" suggests the signal should look innocent), creativity, robustness. Read the PDF for the real list before choosing.

Music assessment: a melody where each note (or chord) is a word-list index maps to the Composition theme and to "plain sight", and it scores on stealth and creativity. Risks: over-the-air capture in a loud hall, and musical constraints cut the bit rate. Best design: pitch-class and rhythm code the index, Reed-Solomon on top, and a direct audio-file decode path as a fallback so a judge can still verify. ElevenLabs music/SFX could generate the carrier, but the signal itself must be ours.

Recommended minimum: ggwave in the browser (an hour), then upgrade the "physical language" with a visual layer (colour grid or music) for wow.

## 3. P14 (HTB CTF)

- Format: HTB hosted CTFs are Jeopardy style with categories such as Web, Reversing, Pwn, Forensics, Crypto, Blockchain, Hardware, Misc, plus FullPwn boxes in some. Source: [HTB Holmes 2026](https://www.hackthebox.com/events/holmes-2026) (a different, defensive event, 1-5 players, Easy to Insane) and the [University CTF 2024 recap](https://www.hackthebox.com/blog/htb-university-ctf-2024-recap) (1,128 teams; only the top two solved everything; reversing most solved, blockchain hardest). Scoring formula not published in either. The QRT event is a smaller sponsor CTF; its size and difficulty mix are unconfirmed.
- Team size: up to 4 for this event (from the brief).
- AI rules: unconfirmed for this event. HTB's Holmes 2026 allows AI as an aid but bans AI as the primary solver (single-prompt solves), and solves can be revoked after a walkthrough request. Expect something similar, and read the event rules before using an agent. Sharing flags and write-ups are banned per the brief, so agents must not post anything either.
- Time cost: easy and medium challenges (web, crypto, forensics, misc) are solvable by beginners in 1-3 hours each. Realistic for a beginner-heavy team: 1-3 flags in 4-6 hours; placing in the top 3 probably needs 6+ flags (guess, depends on participant count, which we do not know).

## 4. Effort and risk (hours, team of 3)

| | Minimum to qualify | Realistic to compete | Risk |
| --- | --- | --- | --- |
| P13 | 2 h (ggwave encode/decode of word indices, README) | 6-8 h (custom code, error correction, visual or music layer, live test in the hall) | Brief unread; hall noise; the decoder must work on QRT's unseen test phrases |
| P14 | 1 h (register, try easy challenges) | 6-10 h of one or two people | Beginner team vs experienced CTF teams; time pulled from the main project |

## 5. Stackability

- With a main project: P13 stacks only if the main project is itself an encoder/decoder (sound, music, light). A music-composition app could embed the codec as its "secret message" feature, which also suits the Composition theme. Otherwise it needs a separate person for a few hours.
- P14 does not stack with anything. Assign one person, with a hard time cap, and keep it off the critical path.
- ElevenLabs: could generate the music or sound carrier or speak the decoded phrase, but the sound-as-data idea overlaps with GibberLink (an ElevenLabs hackathon winner) so it is a conversation piece. Gemini: little use in P13 beyond choosing an innocent-looking cover phrase; none in P14 (and AI-only solving is probably not allowed).

## 6. Scores (1-5, 5 is best / cheapest)

| | Fit for any idea | Win chance | Value | Effort |
| --- | --- | --- | --- | --- |
| P13 | 3 (stacks if the project is audio/visual) | 3 (few teams will do well; we have not read the rules) | 4 (AirPods Pro if first) | 3 |
| P14 | 1 (separate, solo-ish work) | 2 (beginners vs CTF regulars) | 3 (same prize ladder, guess) | 2 |

## 7. Do this now

- Open the PDF and the CSV and read the scoring section; count N words; update section 2 with real axes.
- Prototype ggwave encode/decode of a word-index message. If it works in the room, decide on a visual or music upgrade.
- Have one person register for the HTB CTF and read the event rules on AI use.

## Unconfirmed

Everything about the actual P13 rules and scoring, the HTB event's scoring and AI policy, that the prize slide is QRT's, and any QRT challenge at other hackathons.
