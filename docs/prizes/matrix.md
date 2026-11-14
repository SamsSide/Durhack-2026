# Prize matrix

*Written 14 Nov 2026, 14:00, by the owner's session. Sources: [`list.md`](list.md) (every brief
verbatim), the per-prize research files in this folder, the ceremony slides and the DurHack
Discord. Team: 3 people, agents doing the building.*

**Read this first.** Pound values are estimates of retail price unless a brief states them. Win
chances are judgement, not data: they assume about 150 teams, that we build properly for the
prize, and that fewer teams enter the narrow or hardware challenges. Hours are the extra hours
on top of a main project that already exists. Treat the last column as a ranking, not a
forecast.

## 1. What changed since last night

- The theme is **Composition** (art, music, tech, mixing ideas). Overall judging is Creativity
  & Innovation, Technical Competence & Execution, Research & Learning, Polish & Completion.
- The predictions in `sponsor-challenge-predictions.md` were right about Marshall Wace,
  Accenture and Waterstons (open themes) and wrong about Neptune North (it is distributed
  systems, not macro data), QRT (a physical-encoding task plus a CTF) and SGX FX (two open
  briefs, one of them deliberately silly).
- Two new sponsors with real prizes: **P&G** (AirPods Pro per challenge) and **Arduino with RS**
  (a VENTUNO Q board and kit for each member).
- Still unknown: prizes for Marshall Wace, QRT, Accenture and Waterstons; whether item prizes
  are per person; the submission platform and deadline; whether one team may enter several
  sponsor challenges or submit two projects. **Ask at the help desk before 15:00.**

## 2. The matrix

Sorted by rough expected value per hour. "Core" means the hours are the main project itself.

| id | Prize | Value (team of 3, est.) | Added hours | Win chance | Stack group | Required tech | Submission needs | EV per hour |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18 | Neptune North: Actors work better together | 1,000 pounds stated (1st); keyboard (2nd, 3rd) | Core, plus 2 for a comms-failure demo | 10% | A | Several independent actors; a way to cut their links live | Show the four criteria; demo the failure | High (about 50) |
| P11 | Marshall Wace: New Worlds | Unknown; if the Quest 3 rumour is true, about 1,300 | 1 (framing and pitch) | 4% | A | None | Open with the phrase "New Worlds"; talk to MW staff early | High if the rumour holds (about 50) |
| P20 | Arduino / RS | About 600 to 900 (1st, 3 x VENTUNO Q and kit); about 300 (runners-up) | 4 to 6 | 12% (several runner-up places) | A | UNO Q from the lending library, sensors | Physical demo with the borrowed board | Medium (about 15 to 20) |
| P5 | MLH Tiger Data | About 180 (3 x Stream Deck Mini) | 2 | 12% | A or B | Tiger Cloud Postgres, hypertable, continuous aggregate | MLH prize tick on the submission | Medium (about 11) |
| P9 | Overall 1st / 2nd | About 500 to 700 (1st), about 400 (2nd) | Core, plus 3 for polish | 3% each | A | None; the theme | Main submission; table demo | Medium (about 10) |
| P3 | MLH Entire | About 200 (3 x mini projector) | 1, plus a small running tax | 10% | Any | Entire Sessions, Graph, Brain | Show token numbers and session history | Medium (about 10, already set up) |
| P19 | Waterstons | Unknown; small last year (about 90) | 0.5 | 5% | A | None | One line on what is connected to what, and who benefits | Medium (about 9) |
| P1 | MLH ElevenLabs | About 150 (3 x earbuds) | 1.5 | 5% | A or B | ElevenLabs voice as a core part | MLH prize tick | Low to medium (about 5) |
| P16 | SGX FX 2: playful trading | About 60 if per team, 180 if each | 3 (a market mode) | 10% | A | None; their price data helps | Demo to SGX FX staff | Low to medium (2 to 6) |
| P21 | P&G 1: receipts | About 690 if each (3 x AirPods Pro); 2nd poker sets; 3rd 100 pound voucher | 8 (own project) | 7% | C | Receipt data from P&G (not seen), Gemini | Demo to P&G | Low to medium (about 6) |
| P22 | P&G 2: sensors | Same | 8 to 10 (own project, hardware) | 10% (few entrants) | C, with P20 | Arduino sensors | Demo to P&G | Low to medium (about 7) |
| P13 | QRT: Tagged | Unknown; 2025 paid 500 / 250 / 150 pounds per person | 8 (own lane, one person) | 10% | D | OpenCV, offline; two machines; a printer or pens | Live test on unseen words | Unknown; high if cash returns |
| P2 | MLH Gemini | About 60 (swag) | 0.5 | 4% | Any | Gemini API | MLH prize tick | Low (about 5) |
| P15 | SGX FX 1: storm protection | About 220 if per team, 660 if each | 8 (own project) | 6% | B | Their FX data or any | Demo to SGX FX | Low (2 to 5) |
| P17 | Accenture | Unknown; about 180 last year | 2 if the project is a process redesign, else no fit | 4% | B or C | An LLM; a responsible-AI note | Write-up hitting the six headings | Low (about 4) |
| P8 | MLH MongoDB Atlas | About 150 (3 x M5Stack) | 1.5 | 6% | Any | Atlas | MLH prize tick | Low (about 6) |
| P6 | MLH Vultr | Unknown ("assorted") | 1 | 6% | Any | Deploy on Vultr | MLH prize tick | Low |
| P12 | Marshall Wace meme | About 40 (duffel bag) | 0.2 | 2% | None | A meme | Post in #marshall-wace-memes | Free try |
| P10 | Spirit of the Dino | About 35 | 0 | 2% | None | Be visible, help others, do guild challenges | None known | Free try |
| P7 | DEV writing | 100 dollars | 1, after the event | 3% | Any | A DEV post | After the event | Low |
| P23 | Marshall Wace: sentiment model from scratch | Unknown | 6 to 10 | 5% | None | Train a model from scratch; MW's GitHub materials | Not known | Unknown; skip unless the prize is large |
| P14 | QRT CTF | Unknown | 8 or more | 3% | None | Hack The Box | Flags on the HTB platform | Low; skip |
| P4 | MLH Solana | About 150 (3 x hardware wallet) | 3 | 6% | None natural | Solana | MLH prize tick | Low; skip |

## 3. Stack groups

**Group A, the main project: Composition + Neptune North + Marshall Wace + Waterstons +
Arduino/RS + SGX FX 2 + ElevenLabs + Gemini + Tiger Data + Entire.** One project that is about
many independent things making something together. It is the only group that carries the
1,000 pound prize, the overall prize and the hardware prize at once.

**Group B, a trading tool: SGX FX 1 + Tiger Data + ElevenLabs + Gemini + Accenture (weak).** A
storm-warning tool on their FX data. Clean fit for Tiger Data (time series) but no fit with the
theme, so it gives up the overall prize.

**Group C, P&G: receipts (+ Accenture + Gemini) or sensors (+ Arduino/RS).** Good prizes and
probably few entrants, but nothing is known beyond one slide. Only worth it after talking to
P&G.

**Group D, a side lane: QRT Tagged.** Fully specified, judged by a live test, no overlap with
anything else. One person with agents can own it. Decide once QRT says what the prizes are.

**Skip:** the QRT CTF and the Marshall Wace sentiment model (many hours, no stacking, prizes
unknown), Solana.

## 4. Free wins

Each costs under two hours on top of any project. Take them all; each becomes a roadmap row.

1. **Entire** (already enabled): keep sessions recording; turn on session push when the owner
   says; one slide of token numbers.
2. **Gemini**: use it for any model call that does not need to be another model.
3. **Tiger Data**: write every event to a hypertable and show one live chart.
4. **ElevenLabs**: one spoken part that matters to the demo.
5. **Waterstons**: one sentence and one slide ("we connected X to Y, and Z benefits").
6. **Marshall Wace meme**: ten minutes, one person, once.
7. **MongoDB or Vultr**: only if the stack already needs a document store or a server.
8. **DEV post**: after the event.

## 5. Idea seeds

### Seed 1 (recommended): the orchestra with no conductor

A piece of music composed and played live by a group of independent players: laptops, phones in
the audience and one or two Arduino UNO Q boards with sensors. Each player listens to what it
can hear from its neighbours and decides its own next bar. There is no central server deciding
the music.

- **Targets:** P9 (the theme, literally), P18 (it is the brief: a common goal, independent
  decisions, progress when links fail), P11 (every performance is a piece nobody has heard), P19
  (connects strangers' phones, hardware and sensors into one instrument), P20 (UNO Q sensor
  players), P1 (a sung or spoken voice part), P2, P5 (every note as an event, a live chart), P3.
  Optional P16: a "market storm" mode where the FX price data drives the piece, so you hear
  volatility arrive.
- **The demo moment:** a judge pulls the network cable or we switch off the Wi-Fi. The players
  keep going on their own, drift apart audibly, and pull back into time and key when the link
  returns. Then the judge joins with their own phone.
- **Lanes:** A, the player (the decision rule, the timing and re-sync, the audio); B, the stage
  (the web page for phones, the visual of who hears whom, the cut-the-link control, the
  dashboard); C, the hardware player on the UNO Q plus the voice and the market mode.
- **Main risk:** timing between browsers is hard, and bad timing sounds bad. Start with a fixed
  tempo and bar-level decisions, not note-level sync. Second risk: the hardware queue; if no
  board by 16:00, lane C builds a phone-sensor player instead and P20 is dropped.

### Seed 2: Tagged (QRT side lane)

Three words from 30,000 are about 45 bits. Encode them, with error correction, as a generated
graffiti-style piece: the count, colour, angle and position of strokes carry the bits, with
three or four marks that look like part of the art and let the decoder find and straighten the
image. The decoder is OpenCV running offline on a second laptop.

- **Targets:** P13 only. It could also be shown as a second composition, but do not bend it.
- **The demo moment:** a judge names three words; we print or draw the tag in under five
  minutes; a phone photo at an angle gives the words back.
- **Lanes:** one person. Hours 1 to 3: encode, render, decode from the rendered file. Hours 3 to
  6: decode from real photos (perspective, lighting). Hours 6 to 8: make it look like art, and
  rehearse.
- **Main risk:** reliability from real photos. Fix the scheme early and test with a phone camera
  from hour 3. Also check there is a printer; if not, the scheme must be drawable by hand.

### Seed 3: Storm Warning (SGX FX 1)

A trader's early-warning screen on the USDJPY and USDSGD data: detects the spread and
volatility changes that come before a storm, shows exposure, and reads the alert aloud.

- **Targets:** P15, P5, P1, P2, weakly P17. Not the theme.
- **Main risk:** a crowded, conventional entry; it gives up Group A.

### Seed 4: receipts (P&G 1)

Photograph any receipt; Gemini turns it into clean line items matched to real products; the
tool answers questions across thousands of them.

- **Targets:** P21, P2, P17 if framed as fixing expenses or returns. Not the theme.
- **Main risk:** the brief and the data are unseen. Talk to P&G first.

### Seed 5: The Commentator (last night's default)

Still buildable and still a crowd-pleaser, but it now reaches only P9, P1 and P2. It does not
meet Neptune North, Arduino or the theme as well as Seed 1. Keep it as the fallback if Seed 1's
timing problem is not solved by 18:00: the voice work from lane C carries over.

### Recommendation

**Build Seed 1 as the main project with all three lanes, and take the free wins.** Decide on
the Seed 2 side lane after two questions are answered: what QRT's prizes are, and whether a team
may submit a second project. If both answers are good, lane C moves to Seed 2 after the first
checkpoint and lanes A and B finish Seed 1 without the hardware player.

## 6. Questions to ask in the next hour

| Ask | Who | Why |
| --- | --- | --- |
| Where and when do we submit, and may one team enter several sponsor challenges or two projects? | Help desk | Decides whether Seed 2 can run beside Seed 1 |
| Are item prizes per person? | Each sponsor | Changes the value column |
| What are your prizes? | QRT, Marshall Wace, Accenture, Waterstons | QRT's decides the side lane |
| Does "actors" have to mean software agents, or do phones and boards count? What would impress you? | Neptune North | Our biggest target |
| Can we borrow an UNO Q now, and is there a printer? | RS / Arduino table, help desk | P20, and Seed 2 |
| What is the receipt data and where is it? | P&G | Whether Group C is real |

## 7. Submission checklist

Deadlines and the platform are not announced; fill them in when known.

- [ ] Main submission (platform not known; Devpost page not live at 13:35): title, description
      written against the four overall criteria, a "what we learned" section for Research &
      Learning, video if asked, repository link.
- [ ] Tick every sponsor challenge and MLH prize the project enters.
- [ ] Neptune North: a section headed with their four criteria; the failure demo rehearsed.
- [ ] Marshall Wace: the pitch opens with "New Worlds"; visit their stand today.
- [ ] Waterstons: one line on what is connected and who benefits.
- [ ] Arduino / RS: the board is in the demo and returned afterwards.
- [ ] SGX FX 2 (if the market mode is built): show it to SGX FX staff.
- [ ] MLH: ElevenLabs, Gemini, Tiger Data and Entire named in the write-up, with what each does.
- [ ] Entire: session push turned on by the owner before the end; token numbers on a slide.
- [ ] QRT Tagged (if run): two laptops, both offline; printer or pens; rehearsed on unseen words.
- [ ] Marshall Wace meme posted.
- [ ] DEV post after the event.

Next: `durhack-plan` kickoff picks the idea and writes the plan and the lanes.
