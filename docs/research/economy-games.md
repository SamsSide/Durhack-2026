# Game economies, and the Terra Nova B11 design

Lane b, row B11. Written 14 Nov 2026, about 18:30, from two research docs read on the same day:

- [`economy-hoi4-eu4.md`](economy-hoi4-eu4.md): Hearts of Iron IV and Europa Universalis IV, full
  numbers and sources (Paradox wikis).
- [`economy-aoh-civ-vic.md`](economy-aoh-civ-vic.md): Age of History II and III, Civilization VI,
  Victoria 3, full numbers and sources (Paradox wiki, Fandom wikis, Steam guides).
- Screenshots: [`img/`](img/) (EU4 devastation and trade goods, HoI4 economy laws and compliance,
  Vic3 price formula and movement activism, Civ VI war weariness, AoH3 largest producer).
- The money layer: [`solana-economy.md`](solana-economy.md) (TNC on Solana devnet, 5 s settle
  windows, netting, about 0.3 transactions a second).

The design was decided by the user: the **core five** (one good per province, shortages that
create paid trade, devastation, war readiness, an ideology axis with radicalism). Religion stays
flavour text. Nukes and bombing come later and plug into devastation. Section 3 is the design.

## 1. The games, one short section each

### Europa Universalis IV
Every province makes **one trade good**; income is goods x price. Each good has a base price
(grain 2.5, iron 3, gold special: minted straight into coin and causes inflation). **Devastation**
0 to 100 per province rises with occupation (+0.2 a month), sieges, looting and scorched earth, and
falls slowly (-0.08 a month in the owner's hands, faster under a fort); at 100 it cuts goods
produced by 200% (the wiki pages disagree: -1% or -2% a point). **War exhaustion** 0 to 20 per
nation cuts goods 2% a point. Loans at 4%, bankruptcy for 5 years, reparations at 10% of income for
10 years. ([details](economy-hoi4-eu4.md#2-europa-universalis-iv), `img/eu4-devastation-effects.jpg`, `img/eu4-trade-goods-prices.jpg`)

### Hearts of Iron IV
The nation's mood: **stability** and **war support** (0 to 100, neutral at 50). The **economy
laws** are a mobilisation ladder: civilian economy to total mobilisation, each step needs more war
support and turns civilian output into war output. Strategic resources cannot be stockpiled; a
shortage is -5% per missing unit and the buyer pays the seller in factories. **Ideology
popularity** (democracy, communism, fascism, non-aligned) can topple a government by election, coup
or civil war. Occupied land yields `35% + 65% x compliance`. ([details](economy-hoi4-eu4.md#1-hearts-of-iron-iv), `img/hoi4-economy-laws.jpg`, `img/hoi4-compliance-industry.jpg`)

### Victoria 3
A **market price** that moves with supply and demand:
`price = base x [1 + 0.75 x clamp((BUY - SELL) / min(BUY, SELL), -1, +1)]`, so 25% to 175% of
base. Gold has a fixed price and is minted. **Devastation** per state: +0.1 a day occupied, +0.1 per
battle, decays about 9 a year. Falling living standards make **radicals**; poverty feeds the
socialists, lost claims feed the fascists, radicals feed reaction. ([details](economy-aoh-civ-vic.md#4-victoria-3), `img/vic3-market-price-formula.jpg`, `img/vic3-movement-activism.jpg`)

### Civilization VI
**Distinct luxuries**: each luxury covers up to 4 cities, copies add nothing, so empires trade for
variety. **War weariness** points per battle, doubled abroad, tripled for deaths, -2000 on making
peace. **Loyalty** bands: a city can flip without a war. ([details](economy-aoh-civ-vic.md#3-civilization-vi), `img/civ6-war-weariness-table.jpg`)

### Age of History II and III
**One resource per province** with a world price; the **largest producer** of each good gets a
national bonus (a reason to fight for specific land). Ideology is a **small flat bundle of
percentages** (democracy tax +4%, fascism production +4%) plus a tolerance threshold. Loan caps by
government. ([details](economy-aoh-civ-vic.md#2-age-of-history-3), `img/aoh3-resources-largest-producer.jpg`)

## 2. Mechanics across the games

| Mechanic | EU4 | HoI4 | Vic3 | Civ VI | AoH2/3 | Terra Nova B11 |
| --- | --- | --- | --- | --- | --- | --- |
| Good per province | yes, one | resources per state | buildings make goods | resources per tile | yes, one | **yes, from terrain** |
| Price | fixed base, scripted events | factories as price | supply and demand, 25 to 175% | none | world price | **Vic3 formula** |
| Trade between nations | trade nodes | market, buyer pays seller | markets | trade routes, luxuries | yes | **deficit buys from surplus, a TNC payment** |
| Devastation | 0..100, slow decay | (bombing damages buildings) | per state, -9 a year | none | none | **0..100 per province** |
| War mood | war exhaustion 0..20 | war support, stability | war exhaustion -100..100 | war weariness | none (unconfirmed) | **war readiness 0..100** |
| Mobilisation cost | none | consumer goods ladder | none | none | none | **civilian output x (1 - 0.3 WR)** |
| Ideology | religion, government | 4 ideologies, coups, civil war | movements, radicals | governments | flat % bundles | **axis -100..100 + radicalism** |
| Crisis drift to extremes | rebels | coup at 30-40% popularity | radicals from poverty | loyalty | civil war | **war, devastation, poverty push out** |
| Loans | 4%, bankruptcy | none | yes | none | caps by government | later (B11 extra, #187) |

## 3. Terra Nova B11 design

### 3.0 Ground rules

- **One tick is one year.** Every rule is a pure function of the shared world plus seeded hashes
  (`hashString`), never `Math.random`. Each nation decides only its own events, on its own replica,
  like `payments.ts` today.
- **Income-neutral on day one.** At tick 0 every province has devastation 0, every nation war
  readiness 0, and province income stays exactly `TERRAIN_EFFECTS[terrain].income`. Goods and
  prices change **who pays whom**, not how much coin the world makes. The goods market replaces
  today's trade dues (payments.ts rule 2), so the volume of trade payments stays of the same order.
- **[PAYMENT]** marks a rule that moves TNC between two nations: a `payment` event, so a ledger row
  and a devnet transfer. Payments are zero-sum, so `check-money` keeps passing.
- All new state is either **derived** (goods from terrain), **folded in `applyEvent`** from events
  that already exist (devastation), or **sent in the existing `country_updated` patch** (war
  readiness, politics). No new event types.

### 3.1 Rule 1: one main good per province

Pure function `goodOf(world, tile)`; nothing stored.

| Terrain | Good | Units a year | Base price (coins) | Units x price = today's income |
| --- | --- | --- | --- | --- |
| plains | grain | 1.0 | 0.90 | 0.90 |
| coast | fish | 1.0 | 0.90 | 0.90 |
| forest | timber | 1.0 | 0.55 | 0.55 |
| hills | stone | 1.0 | 0.60 | 0.60 |
| mountain | ore | 0.25 | 1.40 | 0.35 |
| desert | gold if `hashString('good:'+tile) % 4 === 0`, else salt | 0.1 / 0.2 | 2.50 (fixed) / 1.25 | 0.25 |
| ice | furs | 0.05 | 2.00 | 0.10 |
| ocean | none | 0 | - | 0 |

- **Later ages** (by the owner's `techAge`): from `industrial`, a desert tile with
  `hash % 5 === 1` makes **oil** (base 3.0); from `modern`, a mountain tile with `hash % 7 === 0`
  makes **uranium** (base 5.0). Same units x price as the tile's terrain income, so still neutral.
- **Gold** is minted, never traded (Vic3, EU4). It counts as income like any province; it never
  enters the market.
- **Output of a province** (feeds income and the market):
  `out(p) = units(p) x (1 - D(p)/125) x (1 - 0.3 x WR(owner)/100)`. At D 0 and WR 0 this is 1.
- **Province income** in `rules.ts` section 5 becomes `TERRAIN_EFFECTS[t].income x (1 - D/125) x
  (1 - 0.3 x WR/100)`. Structures, wonders and upkeep are unchanged.

### 3.2 Rule 2: shortages create trade, and every trade is a TNC payment [PAYMENT]

Needs per nation per year (three traded goods groups; gold never traded):

| Group | Goods | Need a year |
| --- | --- | --- |
| food | grain, fish | `population / 1000` |
| ore | ore (oil and uranium later count here too) | `0.5 x armies + 0.3 x fleets` |
| timber | timber, stone | `0.1 x structures` |

A plains province feeds about 1000 people and holds 900 at cap, so food nations have a small
surplus, and mountain, desert and ice nations are short. That is the trade we want.

**World price** per group, once a year from the shared view (Vic3, 25% to 175% of base):

```
SELL = sum of out(p) over every owned province making that group
BUY  = sum of need over every living nation
price = base x (1 + 0.75 x clamp((BUY - SELL) / max(min(BUY, SELL), 0.1), -1, 1))
```

base: food 0.9, ore 1.4, timber 0.58 (the mean of timber and stone).

**The market** (`marketPlan(view)`, one pure function, every replica gets the same plan):

1. For each nation and group: `surplus = produced - need`. Sellers have surplus > 0, buyers < 0.
2. A pair can trade unless at war, or an **embargo** applies (rule 5: the far right refuses
   nations it is `hostile` to). Far-left sellers and buyers move only half their surplus or deficit.
3. Each seller's surplus is split among the buyers it can trade with **in proportion to their
   deficits** (HoI4's share split, without influence).
4. **Every 5 years per buyer** (on ticks where `(tick + buyer) % 5 === 0`, staggered so the chain
   sees a steady trickle), the buyer pays each seller one merged payment for 5 years of goods:
   `amount = 5 x sum over groups of qty x price x sellerMarkup`, capped so a buyer never spends more
   than 15% of its treasury in one settlement. `reason: 'trade'`, note like `"6 grain, 2 ore"`.
   `sellerMarkup` is 1.1 for a centre (Lamp Assembly) seller, 1.2 for a far-right seller (tariff),
   else 1.0.
5. **Shortage left unfilled** after the market: food short means population growth halved and
   +3 radicalism a year with a pull to the left (rule 5). Ore short means a new army costs +25%.

**Why it is the Solana story.** War devastates the grain belt or the ore mountains; output falls;
SELL drops, so the price climbs toward 175%; neutral producers sell more at a higher price; the
gold arcs from buyers to the neutral sellers thicken on the globe while the warring nations get
poorer. **Neutral nations profit from wars**, on chain, without a scripted event. Volume: about 12
nations, 2 or 3 sellers each, every 5 years, so 5 to 8 payments a year; the 5 s settle windows net
them, well inside the 0.3 transactions a second budget.

### 3.3 Rule 3: devastation per province, 0 to 100

Stored as `World.devastation: number[]` (tile id to 0..100, parallel to `World.owner`), folded in
`applyEvent` from events that already exist, so every replica and every replay agrees for free.

| Cause | Change | Folded on |
| --- | --- | --- |
| A battle on the tile | +20 | `battle` (its `tile`) |
| The tile is conquered | +10 | `tile_claimed` with `cause: 'conquest'` |
| An enemy army stands on it at the turn of the year | +5 | `tick` (army on a tile whose owner is at war with the army's owner) |
| Bombing, a nuke (later) | +30 / +100 | a later event, same array |
| Recovery | -3 a year on every tile above 0 | `tick` |

- Clamp 0 to 100. Missing array (old replays) means all zeros.
- **Effects:** province output and income x `(1 - D/125)` (100 devastation leaves 20%);
  population cap x `(1 - D/200)`.
- A war with 3 battles on one tile leaves 60, which takes 20 years to heal: scars that outlast the
  war and are visible across a demo.

### 3.4 Rule 4: war readiness, 0 to 100 (HoI4 war support and mobilisation)

`Country.warReadiness`, updated in the nation's own turn and sent in its `country_updated` patch.

| Cause | Change a year |
| --- | --- |
| Policy focus `attack` | +15 |
| At war with anyone | +10 |
| An enemy army on its own land | +10 |
| At peace and focus not `attack` | -15 |
| Far-right ruler (rule 5) | floor 40 |

- **Civilians are afraid:** province output and income x `(1 - 0.3 x WR/100)` (rule 1), so total
  war costs 30% of civilian income.
- **Armies get cheaper:** army upkeep x `(1 - 0.2 x WR/100)`.
- **Fear feeds radicalism:** `+WR/25` a year (rule 5).
- Bands for the screen: 0-19 **Peace**, 20-49 **Watchful**, 50-79 **Mobilised**, 80-100 **Total war**.

### 3.5 Rule 5: ideology axis and radicalism (Vic3 movements, HoI4 coups, AoH flat bonuses)

`Country.politics = { axis, radicalism }`. Axis -100 (far left) to +100 (far right); radicalism 0 to
100. The existing `Country.ideology` sentence stays as flavour.

- **Start:** `axis = round(40 x (aggression - trade))` (within -40..40, so no extreme on day one),
  `radicalism = 10`.
- **Radicalism each year:**
  ```
  rad += 4 x atWar + avgD / 10 + WR / 25 + 5 x poor + 5 x lostLand + 3 x foodShort - 6 - 4 x prosperous
  rad = clamp(rad, 0, 100)
  ```
  `avgD` = mean devastation of its provinces; `poor` = treasury < 10; `lostLand` = it lost a
  province this year; `prosperous` = at peace and treasury > 100.
- **Pull on the axis:**
  ```
  left  = 5 x poor + 3 x foodShort
  right = 5 x lostLand + 2 x atWar + WR / 20
  axis += (right - left) x rad / 50
  if rad < 20: axis moves 3 toward 0                       (prosperity pulls back to the centre)
  if rad > 50 and |axis| > 20: axis += sign(axis) x rad / 25  (crisis pushes to the side it leans to)
  axis = clamp(axis, -100, 100)
  ```
- **Fictional movements** by band (names are invented; never a real party, person or symbol; the
  controversy is embraced as in HoI4):

| Axis | Movement | Economy while it rules |
| --- | --- | --- |
| -100 to -60 | **The Red Furrow** (far left, command economy) | trades only half its surplus and deficit (rule 2) |
| -59 to -20 | The Common Hearth (left) | flavour only |
| -19 to 19 | **The Lamp Assembly** (centre, liberal market republic) | sells at +10% (rule 2) |
| 20 to 59 | The Iron Oath (right) | flavour only |
| 60 to 100 | **The Black Standard** (far right, ultranationalist junta) | embargoes nations it is `hostile` to, sells at +20% tariff, war readiness floor 40 |

- **A turn to the extreme:** the year the axis crosses into a far band, a chronicle line
  ("The Black Standard seizes power in the Ashen Concord; its markets close to its enemies").
- **The Gemini rulers see it.** The ruler's digest gains one line per nation:
  `"Politics: Iron Oath (axis 48), radicalism 62, war readiness 70 (Mobilised), land devastation 23,
  food short 4 at 1.3 (price up 44%)"`, and the system prompt names the movement so the ruler speaks
  in its voice.

### 3.6 What moves money between nations

| Rule | Reason | When | Size |
| --- | --- | --- | --- |
| 2 Goods market | `trade` (exists) | every 5 years per buyer, one per pair | 5 x qty x price, max 15% of the buyer's treasury |
| 2 War profiteering | `trade` | emerges: prices up, neutrals sell more | visible spike in arcs |
| 5 Tariff, Lamp markup | `trade` | inside the market payment | +10% / +20% |
| Existing | `reparations`, `plunder`, `seizure`, `war_chest`, `pooled`, `subsidy` | unchanged | unchanged |
| Later (#187) | `loan`, `repayment` | not in the core five | |

No new `PaymentReason` is needed for the core five. Rules 3, 4 and 5 move no money directly; they
move it through rule 2 (devastation and fear cut output, extremes cut or tax trade).

### 3.7 The three stats in the demo

| Stat | On the globe (lane b) | On the nation card (lane c) |
| --- | --- | --- |
| **Devastation** | every province tinted toward burnt grey-brown by D (one value per tile in the existing colour pass; strongest in political mode), plus a faint smoke sprite above tiles over 60 | "Land devastation 23%" bar, and the worst province named |
| **War readiness** | a red ring that pulses around the capital at Mobilised and above, faster at Total war | a 4-step bar: Peace / Watchful / Mobilised / Total war |
| **Ideology** | a new **Politics** map mode: deep red (far left) through pale gold (centre) to black (far right), brightness by radicalism | a left-right slider with the movement's name, and a radicalism flame 0..100 |

Also on screen, no new stat: the gold trade arcs (already built) and, in terrain mode, the tile
tooltip naming its good. One demo line: "the war burns the grain belt, bread doubles, the neutral
coast gets rich, and the beaten nation turns to the Black Standard".

### 3.8 Build order to CP2 (Sun 08:00; it is about Sat 18:30, so about 13 hours)

| # | Piece | Files | Lane | Agent hours | Parallel |
| --- | --- | --- | --- | --- | --- |
| 0 | Owner approves fields (needs-owner issue) | `docs/contracts.md`, `types.ts` | owner | - | first |
| 1 | Pure core: `goodOf`, `PRICE_BASE`, `price`, `marketPlan`, `politicsStep`, `readinessStep`, `devastationMul` | `packages/shared/src/sim/economy.ts` (new) | b | 1.5 | starts now, against the proposed types |
| 2 | Types + devastation folding in `applyEvent` | `types.ts`, `world.ts` | a, or b if allowed | 1 | after 0 |
| 3 | Hooks in the nation's turn: income and pop multipliers, readiness and politics in the patch, upkeep | `sim/rules.ts` | a, or b if allowed | 1 | after 1 and 2 |
| 4 | The market replaces trade dues | `sim/payments.ts` | b | 1.5 | after 1 |
| 5 | Globe: devastation tint, readiness ring, Politics map mode | `web/src/globe/...`, `web/src/state/world.ts` (X5 `mapMode` plus `'politics'`) | b | 2.5 | after 2 (mock data before) |
| 6 | Nation card: three stats | `web/src/ui/` | c | 1 | after 0 (mock values) |
| 7 | Digest line and movement in the ruler prompt | `server/src/agents/` | a | 0.5 | after 3 |
| 8 | Balance pass in `npm run mock` (prices in range, a war visibly shifts arcs) | constants in `economy.ts` | b | 1 | last |

About 10 agent hours, about 6 hours of wall clock with 3 to 4 agents in parallel: done by about
01:00 if the owner answers by 20:00. Cut order if late: Politics map mode (keep the card), oil and
uranium, the tariff and markup, the ore shortage effect.

**After every sim change** (steps 2, 3, 4, 8): `./check.sh`, `npx tsx server/scripts/check-money.ts`
(prints `MONEY CONSERVED`) and `npx tsx server/scripts/check-replay.ts` (the replay matches).

### 3.9 Gaps the researchers flagged, and how the design handles them

| Gap | Design answer |
| --- | --- |
| HoI4 war support losses from bombing, convoys, casualties: no wiki numbers | ours: +10 a year at war, +10 with an enemy on own land; bombing adds devastation later |
| HoI4 ideology drift and civil war threshold: not on the wiki | ours: the axis formula in 3.5; no civil war in the core (secession already exists, row A18) |
| EU4 devastation goods penalty: -1% or -2% a point (pages disagree) | ours: -0.8% a point (`1 - D/125`), 20% left at 100 |
| EU4 rebel thresholds, vassal tribute rate, loan term: not found | not used; loans stay with #187 |
| AoH2/AoH3 war weariness and loans: probably absent, unconfirmed | folded into war readiness |
| AoH3 resource count (48 or 49), defines from a mod note | not used; our goods list is our own |
| Vic3 verified for 1.13, Civ VI numbers via CivFanatics | shapes only; all our numbers are proposals |
| All numbers untuned | step 8 is a balance pass in mock mode |

### 3.10 Contract changes (needs the owner)

- `World.devastation?: number[]` (tile id to 0..100; missing means all zero). Tiles stay static.
- `Country.warReadiness?: number` (0..100; missing means 0).
- `Country.politics?: { axis: number; radicalism: number }` (missing means `{ axis: 0, radicalism: 10 }`).
  Not `ideology`: that name is already the flavour sentence.
- Goods are derived (`goodOf` in `sim/economy.ts`), so `Tile` gains no field. Optional for the UI:
  export `type Good = 'grain' | 'fish' | 'timber' | 'stone' | 'ore' | 'salt' | 'gold' | 'furs' | 'oil' | 'uranium'`.
- `applyEvent`: folds devastation on `tick`, `battle` and `tile_claimed` (conquest).
- X5 `mapMode` plus `'politics'`.
- No new `PaymentReason`, no new event type.
- Hooks in lane a's files: `world.ts` (`applyEvent`), `sim/rules.ts` section 5 and the
  `country_updated` patch, the army upkeep in `rules.ts`, the ruler digest in `server/src/agents/`.
  `war.ts` needs no change (devastation is folded from its `battle` and `tile_claimed` events).
