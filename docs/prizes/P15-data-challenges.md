# P15 - Data-flavoured sponsor challenges: SGX FX, Neptune North, P&G

> **Correction, 14 Nov 13:50.** This file was written before the briefs were read; the task guesses for SGX FX and Neptune North below are wrong. SGX FX is two open challenges (a storm-protection tool for traders, data optional; a playful way to learn trading). Neptune North is "Actors work better together" (distributed actors that keep working when communications fail), not macro nowcasting. P&G's prizes are AirPods Pro / poker sets / 100 pound keyboard voucher per challenge. See `list.md` for the briefs and `matrix.md` for the plan. The P&G sections and the prize prices still stand.

Researched 14 Nov 2026 with WebSearch/WebFetch only (no Chrome). Builds on [sponsor-challenge-predictions.md](sponsor-challenge-predictions.md) and [durhack-2025-results.md](durhack-2025-results.md); company blurbs are not repeated.

## 0. Known vs guessed

| Item | Status |
| --- | --- |
| Challenge titles, prizes, workshop times at 13:15 | Known from the Discord and ceremony slides (given in the brief, not re-checked) |
| Contents of the SGX FX docx, Challenge1.zip, Neptune North PDF, P&G briefs | NOT READ. Every task description below is a guess |
| durhack.com sponsor page (fetched 14 Nov) | Lists BidFX (Platinum) and Neptune North (Gold). Does not list SGX FX or P&G, and gives no briefs or prizes. Source: [durhack.com](https://durhack.com) |
| Any SGX FX, Neptune North or P&G hackathon history in the UK | None found. Search indexes do not cover Devpost well, so "none found" is not "none exists" |

First action for the team: read the three attachments (about 15 minutes) and fix section 6 scores. The scores below are priors.

## P15/P16 SGX FX (formerly BidFX)

### 1. What they want

- Company: BidFX is now branded SGX FX. Its platform joins BidFX (buy side), MaxxTrader (sell side) and SGX CurrencyNode (anonymous ECN). October 2026: expanded BlackRock Aladdin integration. SGX named "World's Best FX Exchange" at Euromoney 2026. Sources: [Mondo Visione](https://mondovisione.com/news/sgx-group-named-worlds-best-fx-exchange-by-euromoney-for-second-consecutive-yea-2026101/), [Finance Magnates](https://www.financemagnates.com/institutional-forex/singapore-exchange-deepens-currency-trading-link-with-blackrocks-aladdin/), [Euromoney](https://www.euromoney.com/article/695xojrveykgco00k84wwook8/markets/the-worlds-best-fx-exchange-2026-sgx/).
- Existing data product: launched 2021, stores client liquidity streams, monitors composite rates, shows pricing, market impact and liquidity per transaction. TCA is a separate suite item. Source: [FinanceFeeds, 10 Mar 2021](https://financefeeds.com/sgxs-bidfx-launches-data-analytics-solution/). So a dataset in "Challenge1.zip" plausibly looks like quotes or trades from liquidity providers (guess).
- Engineers and quants would want: a correct answer on real-looking data, clear method, no look-ahead, sensible handling of timestamps and venues, and a trader-usable output (a screen, an alert, a ranking), not a notebook dump. Impress with: a stated metric (basis points saved, hit rate, latency), honest validation, and one insight a desk would act on. Inference from the product line, unconfirmed.
- Challenge 1 has a dataset, so it is likely an analysis task. Challenge 2 has a smaller prize and no known dataset, so it may be open design or a coding task (guess).

### 2. Fastest credible approach (assuming tick, quote or trade data)

Starter plan, about 2 hours to first insight with Polars (fast on millions of rows) and pandas for plotting:

1. `pl.scan_csv` or `scan_parquet` the zip contents lazily. Parse timestamps to UTC datetime[ns]. Check duplicates, crossed quotes (bid > ask), zero or negative spreads, stale quotes, gaps.
2. Core features: mid, spread in pips and bps, quote update rate, depth if present, per-venue or per-LP splits, time-of-day and day-of-week seasonality (`group_by_dynamic`).
3. Pick one headline (all are standard FX analytics; none confirmed as the brief):
   - Liquidity provider scoring: spread, hit/fill rate, last-look rejection, quote staleness, ranked per currency pair.
   - TCA: slippage of each trade vs arrival mid and vs mid +1s/+5s (market impact), plus markout curves.
   - Anomaly detection: rolling z-score or isolation forest on spread and mid jumps, flag bad ticks and flash events.
   - Short-horizon prediction: next-N-second mid direction from order imbalance. Weak edge on FX; show honestly with walk-forward splits.
4. Output: one live-looking dashboard (Streamlit, or Plotly Dash, or a web page) with a story. If time-series storage is wanted for the Tiger Data prize, load into Postgres with TimescaleDB hypertables (see [P5-tigerdata.md](P5-tigerdata.md)).
5. LLM layer (optional, for stacking): Gemini turns an anomaly or LP ranking into a plain-English desk note.

Fallback open FX data if the zip is thin (verify terms before use):

| Source | What | Link |
| --- | --- | --- |
| Dukascopy | Free tick and bar history, bulk via their data-export wiki | [Dukascopy data export](https://www.dukascopy.com/wiki/en/development/data-export) |
| duka / dukascopy-node | Downloaders for Dukascopy ticks | [kohnech/duka](https://github.com/kohnech/duka) |
| FXCM | Free historical tick files (compressed CSV) | [FXCM docs](https://fxcm-api.readthedocs.io/en/latest/marketdata.html) |
| HistData.com | Free 1-minute and tick files (third-party guidance only; check site) | histdata.com (unconfirmed terms) |
| ECB reference rates | Daily only, not ticks | ecb.europa.eu (not fetched) |

### 3. Past winners

- No SGX FX or BidFX hackathon challenge found. Nearest finance-hackathon notes: the iFX Hack 2026 (24 h, AWS, Limassol) has no BidFX link ([Finance Magnates](https://www.financemagnates.com/thought-leadership/ifx-expo-international-launches-ifx-hack-2026-a-24-hour-trading-fintech-hackathon-powered-by-aws/)). UK university trading contests (Bloomberg, Bournemouth, Edinburgh) are scored on strategy return, not execution analysis, so they say little here.
- Last year's closest DurHack sponsor tasks (QRT, Marshall Wace, Neptune North) were won by notebook-level work with clean explanation; see [durhack-2025-results.md](durhack-2025-results.md).

### 4. Effort and risk

- Qualify (a valid submission): 3 to 4 h for one person. Compete (a clear insight plus dashboard plus a 2-minute story): 8 to 10 h for one or two people.
- Risks: unfamiliar FX conventions (pips, value dates, last look); data larger than a laptop likes (use Polars lazy); NDA-like data rules (check the docx for "do not publish" and keep the repo private or scrub data); prize may be per team, not per person (unclear).

### 5. Stackability

- With one main AI project: good if the main project already has time-series data. Otherwise a separate small data lane, 1 person.
- MLH: Tiger Data (time-series Postgres) fits natively. Gemini for narration fits. ElevenLabs: a spoken morning-desk briefing is a cheap add-on. MongoDB: poor fit.
- Prize value: Sonos Era 100 SL is 169 pounds (Sonos UK list, John Lewis and Argos, per [GB News](https://www.gbnews.com/tech/sonos-play-sonos-era-100-sl-release-date-price-uk) and [John Lewis](https://www.johnlewis.com/sonos-era-100-sl-smart-speaker/p114934280)). Plus a 50 pound Deliveroo voucher: about 219 pounds for Challenge 1. JBL Go 5 is 39.99 pounds ([TechRadar](https://www.techradar.com/audio/wireless-bluetooth-speakers/jbl-just-upgraded-two-of-our-favorite-bluetooth-speakers-ones-big-and-powerful-and-ones-cheap-and-portable)). Plus 20 pounds voucher: about 60 pounds for Challenge 2. Per-person vs per-team: unconfirmed; if per team of 3, about 73 and 20 pounds each.

### 6. Scores (1-5, prior; 5 = cheap for effort)

| Challenge | Fit for any idea | Win chance | Value | Effort (5 = cheap) |
| --- | --- | --- | --- | --- |
| C1 (dataset, Sonos) | 2 | 3 | 3 | 3 |
| C2 (JBL) | 2 | 3 | 1 | 3 |

Reason for win chance 3: probably few teams have FX knowledge, a dataset gives a concrete bar, but the sponsor has quants who will spot sloppy method.

Summary (4 lines): SGX FX is a real FX stack; the brief is unread, so the task is a guess (tick analysis). Plan: Polars, one insight (LP scoring or TCA), dashboard. Worth about 219 and 60 pounds. Do only if the dataset is clean and one person is free.

## P18 Neptune North

### 1. What they want

- Company: technical consultancy (data engineering, AI engineering, software engineering, quants and economists), founded 2024, Oliver Wyman and Rokos JV, Newcastle. Stated values: client-driven, engineering quality. No case studies or hackathon material on site. Source: [neptunenorth.co.uk](https://neptunenorth.co.uk) (fetched 14 Nov 2026).
- Job ads mention Polars, pandas, numpy, Airflow-style orchestration, pipelines from internal and external sources. Source: [Neptune North Greenhouse board](https://job-boards.eu.greenhouse.io/neptunenorth) (via search summary; individual ads not opened).
- Brief is "Neptune North challenge 2.pdf", unread. 2025 brief was "anticipate a macroeconomic trend from non-traditional, high-frequency data"; the 2025 winner used autoregression plus news sentiment, Guardian API ([results](durhack-2025-results.md)). "Challenge 2" suggests there may be a Challenge 1 too (unconfirmed).
- What impresses (inference from their job ads): a reproducible pipeline, a baseline to beat, honest out-of-sample test, source provenance, and a one-line economic story. Rokos is a macro fund, so a tradeable or decision-relevant signal beats a pretty chart.

### 2. Fastest credible approach (if it repeats the nowcast theme)

1. Pick one target with a published lag: UK CPI, retail sales, claims, GDP monthly (ONS API, [ONS developer hub](https://developer.ons.gov.uk/), not fetched).
2. Pick one high-frequency source: Google Trends (pytrends), GDELT or news sentiment, Companies House or planning data, ONS faster indicators, card spend, web-scraped prices, shipping/AIS, Wikipedia page views, weather. Nowcasting with search and payments data is established practice ([Springer chapter](https://link.springer.com/chapter/10.1007/978-3-030-66891-4_7), [ESCoE nowcasting](https://www.escoe.ac.uk/projects/nowcasting-using-real-time-data/)).
3. Baseline: AR(p) or last value. Add features, ridge or elastic net (small samples; avoid deep nets), expanding-window backtest, report RMSE vs baseline and directional accuracy.
4. Deliver: a repo that runs end to end (`make run`), tests, a one-page README with the data-source table and a leakage statement. Add a Gemini-written summary only as garnish.
5. 6 to 8 hours in total for one person with agents. Match the format to the PDF once read.

### 3. Past winners

- 2025 at DurHack: Predicting Inflation, AR plus news sentiment, 12-month Udemy each (from the results file). Nothing else found for Neptune North or similar firms at UK hackathons in 2025-2026. A 2020 COVID nowcasting hackathon team (dData) won a similar challenge ([event page](https://events.development.asia/materials/20200821/ddata)).

### 4. Effort and risk

- Qualify: 3 h. Compete: 8 h, one person.
- Risks: brief may be a software or defence-adjacent problem, not nowcasting; the 2026 prize is vouchers for the winning team only (about 1,000 pounds, about 333 each), so one winner takes all; small sample sizes make credible forecasts hard; leakage mistakes look amateur to quants.

### 5. Stackability

- Good: it is open-ended, so one main project with a data element can double up. A forecasting or "signal from messy data" feature inside the main project is the cheapest route.
- MLH: Gemini (extract signals from news or filings), Tiger Data (store the time series), MongoDB (store raw documents). ElevenLabs weak.

### 6. Scores

| Fit for any idea | Win chance | Value | Effort (5 = cheap) |
| --- | --- | --- | --- |
| 3 | 3 | 4 | 3 |

Summary (4 lines): Neptune North is a quant-flavoured consultancy; 2026 brief unread, last year was nowcasting from high-frequency data. Plan: one target, one alternative source, baseline vs model, reproducible repo. Prize 1,000 pounds vouchers (winner only) plus keyboards for runners-up. Best value of the three if the brief is open and data-led.

## P21/P22 P&G (Procter & Gamble)

### 1. What they want

- P&G has a Newcastle Innovation Centre in Benton, anchoring a long Newcastle University partnership (AI-accelerated product development, water and energy efficiency, enzymes). Source: [Newcastle University, 31 Mar 2026](https://www.ncl.ac.uk/press/articles/latest/2026/03/procterandgamblepartnership/). The page does not mention baby or fem care.
- Their data scientists would want a prototype that turns messy real-world signals into a consumer or product insight, with clear caveats on privacy, small samples and measurement. Impress with: a working end-to-end demo on real inputs, error rates stated, and a business "so what" (for example which pack sizes or promotions, or when a nappy leaks). Inference, unconfirmed.
- Prizes not announced. Prior P&G hackathon style, from related events: AngelHack Cincinnati challenges were consumer complaint text analytics and linking complaints to manufacturing data ([AngelHack](https://medium.com/angelhack/angelhack-heads-to-cincinnati-with-p-g-b0de3eedf626)); P&G Fluidics Hackathon at Imperial ([page](https://imperialhackspace.com/programmes/fluidics-hackathon/)). Both older or different, so low weight.

### 2a. Challenge 1: receipt data (guessed task)

Likely a small set of real or synthetic receipts (images, PDFs, or line items) to turn into insight. Plan, 6 to 8 hours:

1. Extract: send each receipt image to Gemini (multimodal, JSON schema output: store, date, items, quantity, price, total). Validate the sum of lines equals total; flag mismatches. Benchmark on public receipts to quote accuracy: [SROIE](https://arxiv.org/pdf/2406.04493) (1,000 scanned receipts, ICDAR 2019) and CORD (CC BY 4.0, Hugging Face `naver-clova-ix/cord-v2`, per the [CORD repo](https://github.com/clovaai/cord)). Gemini zero-shot has been benchmarked on SROIE-style invoices ([arXiv 2509.04469](https://arxiv.org/pdf/2509.04469)).
2. Entity resolution: map abbreviated receipt lines ("PMP SZ4 BBY 44") to products and brands. Use embeddings plus a fuzzy match (rapidfuzz) against a catalogue, and Gemini as a judge for hard cases. Report precision on a hand-labelled sample.
3. Insight: basket analysis (association rules or co-purchase lift), brand switching, promo uplift, price per unit, category share. Public practice data: [Instacart 2017](https://www.instacart.com/datasets/grocery-shopping-2017) (about 3.4m orders, 206k users, about 50k products; terms to check; see [analysis example](https://nevesfernandes.github.io/instacart.html)).
4. Output: dashboard or chat over the parsed data ("which baby brands appear with nappies?"). Store in MongoDB (documents) or Postgres.
5. Privacy slide: strip names, card digits, loyalty IDs before storage (P&G will care).

### 2b. Challenge 2: sensors for baby and fem care (guessed task)

Likely a design-and-prototype challenge. P&G's own precedent is Pampers Lumi, a connected sensor that tracks how fast a nappy fills ([Harvard D3 case](https://d3.harvard.edu/platform-digit/submission/182-year-old-pg-enters-big-data-with-start-up-pampers-and-smart-diapers/index.html), [Marketing Dive](https://www.marketingdive.com/news/pampers-links-with-alphabet-unit-on-connected-baby-monitoring-system/559241/)); an MIT Startup Exchange listing asks for new observational research sensors for baby care ([listing](https://startupexchange.mit.edu/node/42231)). So P&G wants research-grade measurement (how the product performs in use), not another parent gadget.

Cheap sensor options:

| Option | What it senses | Hackathon cost | Notes |
| --- | --- | --- | --- |
| Capacitive electrodes (two copper-tape pads or comb) | Wetness level, dry to soaked in steps | Under 10 pounds | Most common in prototypes. A CMU team's Arduino system used signal-to-noise on a capacitor ([CMU poster, 2013](https://www.cmu.edu/bme/Academics/undergraduate-programs/Resources/design/2013WetnessWarrior.pdf)); Dyson Award entry Synchrome clips a capacitive tag to a diaper ([Synchrome](https://www.jamesdysonaward.org/en-SG/2025/project/synchrome-1)) |
| Resistive (soil moisture probe style) | Wet or dry | Under 5 pounds | Corrodes, cannot read through the outer layer |
| Humidity and temperature (DHT22, SHT31) | Microclimate, skin-adjacent humidity | Under 10 pounds | An Edge Impulse smart-diaper project found humidity changed only slightly when soiled and used gas readings ([Edge Impulse](https://docs.edgeimpulse.com/projects/expert-network/smart-diaper-arduino-nicla-sense-me)) |
| Thermistor | Temperature rise at wetting | Under 3 pounds | Fast signal, noisy |
| NFC or RFID moisture tag | Battery-free wetness, read by phone | About 1 pound per tag in volume (slide estimate, unconfirmed) | Matches P&G cost needs; needs the chip and a reader |
| Camera plus computer vision | Colour wetness-indicator stripe, leak stains on a test fixture | Phone only | Good for research use: photograph product after a lab test and quantify spread |

What a hackathon prototype can show: an Arduino or ESP32 with two or three capacitive pads under a nappy-shaped layer of cotton and a syringe-dosed saline test; live trace of wetness against dose, a leak-position estimate from several pads, a threshold alert, and a short data analysis with calibration curve and repeatability across 10 doses. For fem care, test with a similar absorbent layer, and be tactful in the demo. Keep the claim modest: "measurement rig for product testing," not a medical device.

Check what hardware the event lends out before planning the build.

### 3. Past winners

- None found for P&G at UK hackathons 2025-2026. Search surfaced only the Imperial Fluidics hackathon (winners 19 Nov 2025, not opened) and a Northumbria data-science challenge with a manufacturer ([Northumbria](https://corp.northumbria.ac.uk/about-us/news-events/news/students-take-on-data-science-challenge-with--international-manufacturer), not opened; sponsor unconfirmed).

### 4. Effort and risk

- C1: qualify 4 h, compete 8 to 10 h. C2: qualify 5 h (hardware), compete 10 to 14 h and a physical demo; sensors are hard to get right in 24 h.
- Risks: real receipt data may be restricted (no cloud uploads? check the brief; the docs may demand local models or consent); Gemini errors on thermal-paper photos; C2 needs hardware and a wet demo; prizes unannounced so value is unknown.

### 5. Stackability

- C1 stacks well with a main AI project: Gemini (MLH) is the core, MongoDB for receipt documents, Tiger Data for spend-over-time, ElevenLabs for a spoken insight. Lowest incremental effort of these four if the main project already uses Gemini.
- C2 is separate (hardware); only stacks with a hardware-heavy main idea.

### 6. Scores

| Challenge | Fit for any idea | Win chance | Value | Effort (5 = cheap) |
| --- | --- | --- | --- | --- |
| C1 receipts | 4 | 3 | 2 (prize unknown) | 4 |
| C2 sensors | 1 | 3 | 2 (prize unknown) | 2 |

Summaries (4 lines each):

P&G C1: Receipt parsing via Gemini is a few hours of work; entity resolution and basket insight make it stand out. Validate on SROIE or CORD. Stacks with Gemini, MongoDB and Tiger Data. Prize unannounced; best P&G option.

P&G C2: Sensor idea is capacitive pads on an Arduino or ESP32 with a saline-dose calibration demo. Hardware and the wet demo are the risk. Does not stack. Do only with a spare hardware person.

## 7. Recommendation

1. Read the three attachments first, then re-score.
2. Cheapest pickup: P&G C1 (if the main project already uses Gemini) and Neptune North (if the brief is open and data-led).
3. SGX FX C1 only if one person has FX knowledge and the dataset is clean; best value at about 219 pounds.
4. Skip P&G C2 unless a teammate wants hardware.
5. At most 2 of the 4 data challenges: they compete for the same data person.

## Gaps

- All three briefs, Challenge1.zip and the prize terms (per person or per team) unread.
- SGX FX product list and API pages (sgx.com/fx returned a browser notice).
- Neptune North 2026 public material (none found beyond the home page and job board).
- P&G prize values and the receipt data source.
- Sonos Era 100 SL price is a launch list price (31 Mar 2026); street price may be lower.
