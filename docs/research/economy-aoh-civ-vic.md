# Economy ideas from Age of History II/III, Civilization VI and Victoria 3

Research for row B11, a deeper economy whose money is the TNC token on Solana devnet. Written 14 Nov
2026. Sources are the games' own wikis (Paradox wiki, Fandom wikis) and Steam guides, read in Chrome
on 14 Nov 2026. Version notes are given per source. Anything not read on a page is marked
**unconfirmed**.

Screenshots (in `docs/research/img/`):

| File | What it shows |
| --- | --- |
| `vic3-market-price-formula.jpg` | Victoria 3 price formula: base x [1 + 0.75 x clamp((BUY-SELL)/min(BUY,SELL), +-1)] |
| `vic3-movement-activism.jpg` | Victoria 3 movement activism: radical supporters +100, loyalist supporters -75 |
| `civ6-war-weariness-table.jpg` | Civ VI war weariness points per battle by era, home vs abroad |
| `aoh3-resources-largest-producer.jpg` | Age of History 3: one resource per province, bonus for the largest producer |

## 0. The answer in eight lines

1. **One good per province** (AoH3) sold at a **world price that moves with supply and demand** (Vic3)
   is the core. Make each province's output x price equal today's `TERRAIN_EFFECTS.income`, so the
   change is income-neutral until prices move.
2. **Largest-producer bonus** (AoH3) gives each AI a reason to fight over gold or ore provinces.
3. **Devastation** (Vic3): +per battle, +per year occupied, decays about 9 a year; cuts output and population.
4. **War weariness** (Civ VI) counts battles, doubled abroad, tripled on deaths, and drains at peace.
5. **Satisfaction from distinct luxuries** (Civ VI amenities): each luxury good covers some provinces,
   so nations must **import** luxuries. That gives steady payments between nations.
6. **Radicalism and an ideology axis** (Vic3 radicals and movements): poverty pushes left, defeat and
   lost land push right, and high radicalism pushes the nation away from the centre.
7. **Loans between nations** (AoH3 loan caps by government), paid back over 5 years, give regular,
   visible on-chain transfers.
8. Biggest risk: too many moving numbers for a 24h build. Section 6 lists a must-have core (R1-R4)
   and the rules that can be cut.

---

## 1. Age of History II (and its wiki, Age of Civilizations II)

Source: [Age of Civilizations Wiki](https://age-of-civilizations.fandom.com/) (the AoH2 wiki,
pages *Provinces*, *Economy (Industry)*, *Development*, *Happiness*, *Stability*, *Population*,
*Buildings*, *Economy Interface*, *Government Types/Ideologies*, *Civil Wars*). Pages are undated
community text; treat numbers as AoH2 / AoH2 Definitive Edition era.

| Mechanic | Stat and range | What moves it | Effects | Why it is fun |
| --- | --- | --- | --- | --- |
| Province economy | "Economy" score per province (e.g. Constantinople 21716, London 3012 in 1440) | Investing gold, spending movement points, the Investments budget slider; falls if the slider is under the minimum | Production income; stagnates if population is too high for the economy | Visible "pump money in, it grows" loop |
| Development | 0.01 to 2.0 per province | Same as economy; above 1.0 only by manual investing; capped by tech level | Slows disease; feeds production income | A cap you can see and push against |
| Happiness | Per province percentage | Festival decree (7 turns, costs gold and moves); tax above the government's "acceptable taxation" lowers it, below raises it; raids lower it; moving the capital | Higher tax income; at very low or 0, stability falls and rebellion risk rises | Tax rate is a lever with a visible cost |
| Stability | 1% to 100% per province | Share of own nationality, army, disease, corruption, revolutionary risk, happiness, occupation | Low stability brings rebels | Conquered land is a burden, not just a prize |
| Civil war | Event | National happiness low for about 20 turns (plunder, high tax) | A rebel copy of the nation with a **different ideology** appears with about 100 troops per province | Bad economy turns into a political split |
| Budget | Income: taxation, production, vassals. Expenses: administration (distance to capital), military, spending (military, goods, research, investments) | Player sliders | Goods spending is required at a minimum or people get angry; investments must stay above minimum for growth | Simple, readable national budget |
| Buildings | Farm (+5% growth per level, 5 levels), Workshop (+5% production income, 3 levels), Port (+2% production income), Supply camp (-20% army upkeep), Armory (-1 recruit cost), Library (+1 research per 750 people) | Built for gold over 1-4 turns | Local modifiers | Small, stackable percentages |

**Ideologies and their economic modifiers (AoH2).** Each government type sets three minimum budgets
(acceptable taxation, goods, investments) and small modifiers:

| Government | Acceptable tax | Goods min | Invest min | Economic buffs | Economic nerfs |
| --- | --- | --- | --- | --- | --- |
| Democracy | 24% | 10% | 14% | Tax income +4% | Production -2%, admin cost +4%, army upkeep +4% |
| Monarchy | 25% | 15% | 10% | Tax +1%, production +1% | Admin cost +2% |
| Communism | 28% | 15% | 10% | Army upkeep -3% | Tax -2%, admin cost +8%, research cost +4% |
| Fascism | 28% | 14% | 12% | Tax +1%, production +4%, army upkeep -2% | none listed |
| Republic | 25% | 15% | 10% | Admin cost -2%, research cost -2% | Tax -2% |
| City State | 26% | 10% | 12% | Tax +2%, production +2%, upkeep -6% | Admin cost +20% |

Lesson: ideology is a **small, flat bundle of percentages** plus a **tolerance threshold**
(how much tax the people accept). That is cheap to code and easy for an AI ruler to reason about.

**War weariness and loans in AoH2:** not on the wiki pages read. **Unconfirmed.** A forum
"ideas" thread asks for war weariness to be added, which suggests the base AoH2 game had none
([forum](http://www.ageofcivilizationsgame.com/topic/240225-war-weariness/), not opened).

## 2. Age of History 3

Sources: [AoH3 Wiki: Resources](https://age-of-history-3.fandom.com/wiki/Resources),
[Types of Government](https://age-of-history-3.fandom.com/wiki/Types_of_Government),
[Gold](https://age-of-history-3.fandom.com/wiki/Gold) (read 14 Nov 2026); Steam guide
[Economy Guide 101 (For Blockheads!)](https://steamcommunity.com/sharedfiles/filedetails/?id=3355250334)
(posted 27 Oct 2024); the mod change note
[Ether's Adjustments V1.03.1](https://steamcommunity.com/workshop/filedetails/discussion/3413795029/591762405949708040)
(4 Feb 2025). The mod's "from" values are the game's defines at that date; the "to" values are the mod's.
Steam thread [How to deal with revolt/unhappiness?](https://steamcommunity.com/app/2772750/discussions/0/600766248738892309/) (30 Dec 2024).

| Mechanic | Stat and range | What moves it | Numbers | Effects | Why it is fun |
| --- | --- | --- | --- | --- | --- |
| **One resource per province** | 49 resources (wiki) / 48 (store page); types Food, Commodities, Luxury, Luxury Commodities, Production Resources | Fixed per province; a resource building (Salt Mine, Brewery...) "massively boosts" output | Each resource has a world price | Province income = its good's output x the good's price, then taxed | Every province has an identity; a poor province with a dear good is worth taking |
| Efficiency / economy | Percentage per province (guide example 27.8%) | Buildings (Workshop +7.5% efficiency, +3.4% economy), investing | Invest in economy: 90 days, cost 45, +0.6 cost per economy point; max economy per growth rate 1.0 (base defines in the mod note) | More units of the good per year | Slow build-up you can protect or lose |
| **Largest producer bonus** | One owner per resource | Whoever produces most of a good | Gold: monthly income +2.5; Diamonds +2.25; Salt: growth +2.5%; Iron: second-line recruit cost -8%; Grain/Rice: army maintenance -5%; Clothes: loan interest -10%; Coal: invest in economy cost -10%; Tobacco: revolutionary risk -10%; Uranium: aggressive expansion -10% | National modifier while you stay top | A race and a reason to conquer specific land |
| Unrest and stability | Unrest per province; civilisation stability | Lower taxes reduce unrest; paying to core and convert religion; non-core land is unruly | Province unrest per stability point 0.2 (core) and 0.02 (non-core) at Feb 2025 | Revolts, revolutionary risk | Conquest has a running cost |
| Tax efficiency | Per province | Pay gold and legacy over time | 100 days, 12 gold, 1 legacy, +1.25 growth per action (base defines Feb 2025) | Share of output you collect | A second dial between output and income |
| Loans | Count of loans | Government type and perks | Democracy +3 max loans, Theocracy +2, Horde -1 (wiki); minimum loan 30 to 50 and loan value 40% to 50% of economy in a later change note (**unconfirmed** whether base or mod) | Gold now, interest later | Debt is a visible risk |
| Government ideology | 16 governments | Change for 300 gold and 250 legacy | Democracy: tax efficiency cost -5%; Communism: construction time -15%; Fascism: max manpower +3000; Merchant Republic: production efficiency +4%; Theocracy: monthly income +1.25 | Flat modifiers | Same lesson as AoH2 |
| War weariness | **Unconfirmed** | A Game Rant guide says legacy points can be spent to reduce it ([gamerant](https://gamerant.com/age-of-history-3-how-get-more-civilization-legacy-points/), not opened) | No numbers found | Unconfirmed | |

## 3. Civilization VI

Sources (Fandom, read 14 Nov 2026):
[Amenities](https://civilization.fandom.com/wiki/Amenities_(Civ6)),
[War weariness](https://civilization.fandom.com/wiki/War_weariness_(Civ6)) (based on a CivFanatics
analysis), [Loyalty](https://civilization.fandom.com/wiki/Loyalty_(Civ6)),
[Trade Route](https://civilization.fandom.com/wiki/Trade_Route_(Civ6)),
[Resource](https://civilization.fandom.com/wiki/Resource_(Civ6)).

| Mechanic | Stat and range | What moves it | Numbers | Effects | Why it is fun |
| --- | --- | --- | --- | --- | --- |
| Tile yields | Food, production, gold, and others per tile | Terrain, resource, improvement | Bonus resources can be harvested once for +20 food, +20 production or +40 gold | City growth and output | Map reading matters |
| **Luxury resources** | Each distinct luxury | Improve the tile, or trade for it | Each distinct luxury gives **+1 amenity to up to 4 cities** (6 for some). Copies add nothing, so spares are traded away | Feeds amenities | Creates **trade between empires** for variety, not quantity |
| Strategic resources | Stockpile (Gathering Storm) | Each source produces per turn (iron: 2 a turn per source) up to a stockpile cap (50, raised by military buildings) | Units need them to be built and maintained | Military dependency on land you hold or buy | |
| **Amenities** | Surplus or deficit vs need | Luxuries, entertainment, policies; minus war weariness; minus bankruptcy | Need = ceil(pop/2 - 1) (base) or ceil(pop/2) (Gathering Storm). Bankruptcy: -1 amenity per 10 gold negative flow when the treasury is 0 | See levels below | One number explains why a city sulks |
| Satisfaction levels (Gathering Storm) | Ecstatic (+5 or more): all yields +20%. Happy (+3 to +4): +10%. Content (0 to +2): none. Displeased (-1 to -2): non-food -10%, growth -15%. Unhappy (-3 to -4): non-food -20%, growth -30%. Unrest (-5 to -6): non-food -30%, rebels. Revolt (-7 or worse): non-food -40%, more rebels | | | | Clear bands, easy to show |
| **War weariness** | War weariness points (WWP) | Every battle, by era. Ancient: 16 home, 32 abroad, 64 death at home, 80 death abroad. Industrial and later, surprise war: 52 / 104 / 208 / 260. Formula: EraBase x location (1 home, 2 abroad) + death (3 x EraBase). Nuke: 12 x EraBase | -1 amenity per **400 WWP**. Decay: -50 a turn at war with no battle, -200 a turn at peace, **-2000 on making peace** | Amenity loss near the front and in conquered cities first | Long wars hurt at home; peace is a relief you can feel |
| **Loyalty** | 0 to 100 per city | Pressure from nearby population within 9 tiles: 10 x (domestic - foreign) / (min + 0.5), capped at +-20; happiness: Ecstatic +6, Happy +3, Displeased -3, Unhappy or worse -6; governor +8; occupied -5 | Loyal 76-100: none. Wavering 51-75: growth 75%, yields -25%. Disloyal 26-50: growth 25%, yields -50%. Unrest 1-25: no growth, yields -100%. At 0 the city becomes a Free City | Border cities can flip without war | Culture and wealth as a weapon |
| Trade routes | Count limited by trading capacity | A trader to a city not at war, in range | International route gives the origin gold by destination districts: City Centre 3 gold, Commercial Hub 3, Harbour 3, Government Plaza 2; domestic routes give food and production instead. Minimum 21 turns on Standard speed | Gold, roads, diplomatic visibility | Peace pays; plunder is a war target |

## 4. Victoria 3

Sources (Paradox wiki, read 14 Nov 2026; most sections say "last verified for version 1.13"):
[Market](https://vic3.paradoxwikis.com/Market), [Goods](https://vic3.paradoxwikis.com/Goods),
[Pops](https://vic3.paradoxwikis.com/Pops), [Standard of living](https://vic3.paradoxwikis.com/Standard_of_living),
[Turmoil](https://vic3.paradoxwikis.com/Turmoil), [Political movement](https://vic3.paradoxwikis.com/Political_movement),
[Interest groups](https://vic3.paradoxwikis.com/Interest_groups), [War](https://vic3.paradoxwikis.com/War),
devastation from the State page (reached through [Devastation](https://vic3.paradoxwikis.com/Devastation)).

| Mechanic | Stat and range | What moves it | Numbers | Effects | Why it is fun |
| --- | --- | --- | --- | --- | --- |
| **Market price** | 25% to 175% of base price | Buy orders vs sell orders in the market | price = base x [1 + 0.75 x clamp((BUY - SELL) / min(BUY, SELL), -1, +1)]. Example: wood base 20, 100 buy, 120 sell gives 17 | Every pop and building pays or earns this | One formula; shortages and gluts show on the map |
| Local price | | Market access (infrastructure) | local = MAPI x market price + (1 - MAPI) x state price; base MAPI 75% | Remote producers sell cheap | Logistics matters |
| Goods base prices | | | Grain 20, fish 20, wood 20, fabric 20, coal 30, fruit 30, sugar 30, iron 40, tools 40, silk 40, wine 50, tea 50, coffee 50, opium 50, ammunition 50, small arms 60. **Gold 100, fixed price and not traded**: gold mines are steady money and "minting" | | | A short, believable price list |
| Buildings | Produce goods from inputs | Construction | Throughput cut by devastation and turmoil | Wages and profits | Industry chains |
| **Standard of living** | 1 to 60+: Destitute 1-4, Struggling 5-9, Impoverished 10-14, Middling 15-19, Secure 20-24, Prosperous 25-29, Affluent 30-39, Wealthy 40-49, Lavish 50-59, Opulent 60+ | Wealth (income minus cost of needs) | Below 5 mortality rises (starvation); above 25 birth rate bottoms out at 0.60% | Radicals and loyalists | Prices hit people, people hit politics |
| **Radicals and loyalists** | Each pop member is loyalist, neutral or radical | SoL falls: base +3% radicals. SoL rises: +3% loyalists (shrinks above SoL 15 to a tenth at 30+). Below expected SoL: +0.2% radicalism per level of shortfall a month (cap 15% per level) | | Radicals cause turmoil | Poverty becomes anger, step by step |
| **Turmoil** | Share of radicals in a state | | Moderate 25%: tax waste +25%, migration -15%, construction -33%. High 50%: +50%, -25%, -50%. Extreme 75%: +75%, -50%, -75% | Lost money and slow building | Unrest has a price tag |
| **Interest group approval** | -20 to +20 | Law stances (+-2 each, capped +-5), law changes (+-5 / 10 / 20, decay over 5 years), loyalist vs radical political strength (+-1 per ~6%, up to +-15) | Angry at -10 or less: lends clout to radical movements, "possibly starting a revolution". Happy +5: stops backing movements | | Groups, not one happiness bar |
| **Political movements** | Support and activism | Activism moves 1% a week toward a target: per enacted law +-5, recently enacted +-25, **radical supporters +100**, loyalist supporters -75 (scaled by share). Socialist: +3% per SoL point under 15. Anarchist: +1.5% per SoL point under 15. Fascist: +1% per support point (to +50%), claims +12.5% plus 2.5% per claim (to +30%). Reactionary: +0.5% per point of % radical pops (to +50%) | Revolution organises above 50 radicalism; progress moves toward radicalism every 8 weeks, capped at -10% / +25% per step; under 100 it never fires without an event; states joining = 1.5 x support, cap 75% | Civil war, new country | **This is the "crises push extremes" model**: poverty feeds the far left, lost claims feed the far right, radicals feed reaction |
| **War support / exhaustion** | Starts at +100, can go to -100 | Weekly: base +0.2; radicals +0.015 per 1% of population; casualties +0.1 (no lost battles) to +0.4 (all lost) per 10% of manpower; occupation: +0.1 above 0%, +0.5 above 10%, +1 above 25%, +2 above 50%, +3 above 75%, +10 above 90% | At -100 an independent country capitulates | | Occupation is what ends wars |
| **Devastation** | Points per state (no cap stated) | Occupied: +0.1 a day; each battle +0.1 x formation modifiers; events. Decay -0.025 a day (-9.125 a year) when unoccupied | Per point: infrastructure -1%, throughput -0.25%, mortality +1%, migration attraction -2%, construction -0.5% | | Wars scar land for years |

---

## 5. What each game does well, in one line

| Game | Steal this |
| --- | --- |
| AoH2 | Ideology as a small bundle of % modifiers plus an "acceptable tax" threshold |
| AoH3 | One good per province, world price, **largest producer bonus**, loan caps by government |
| Civ VI | **Distinct luxuries** satisfy a fixed number of places, so you trade for variety; war weariness counted per battle, doubled abroad, cleared by peace; loyalty bands |
| Victoria 3 | The **price formula**; devastation that decays at about 9 a year; radicals from falling living standards; extremes fed by specific crises; occupation drives exhaustion |

## 6. Steal for Terra Nova

Constraints from the code: one tick is one year; every rule must be deterministic (seeded
hashes only, as in `sim/payments.ts`); each nation decides its own events on its own replica.
Today a province earns `TERRAIN_EFFECTS[terrain].income` (0.1 to 0.9) and the treasury grows by
`income x 0.4 - treasury x 0.01` (`rules.ts`, section 5). Rules below keep that scale.

**[BETWEEN NATIONS]** marks a rule that moves TNC from one nation to another (a `payment` event,
so a devnet transfer). These are what make Solana matter.

Priority: **R1-R4 are the core** (goods, prices, trade, devastation). R5-R9 add politics. R10-R12 are
extras to cut first.

### R1. One main good per province (AoH3)

| Terrain | Good | Units a year (q) | Base price (coins) | q x price = today's income |
| --- | --- | --- | --- | --- |
| plains | grain | 1.0 | 0.9 | 0.9 |
| coast | fish | 1.0 | 0.9 | 0.9 |
| forest | timber | 1.0 | 0.55 | 0.55 |
| hills | wool if hash(tile) is even, else stone | 1.0 | 0.6 | 0.6 |
| mountain | ore | 0.25 | 1.4 | 0.35 |
| desert | gold if hash(tile) % 4 == 0, else salt | 0.1 gold / 0.2 salt | 2.5 gold (fixed) / 1.25 salt | 0.25 |
| ice | furs | 0.05 | 2.0 | 0.1 |

Categories: **food** = grain, fish. **Materials** = timber, stone, wool, ore. **Luxuries** = salt,
furs, gold, plus wool (cloth). Gold has a fixed price and is never traded; it is minted straight
into the treasury (Vic3). Income-neutral at base prices, so nothing breaks on day one.

Province output (all multipliers from later rules, each 0..1):

```
out(p) = q(terrain) x (1 - D(p)/125) x (1 - 0.3 x WR/100) x sat(nation) x (1 + 0.1 x farms/ports/factories on p)
```

### R2. World price per good (Vic3, tiny)

One world market, recomputed once a year from every replica's shared state (deterministic):

```
SELL(g) = sum over all provinces producing g of out(p)
BUY(g)  = sum over nations of need(n, g)
need(n, food)      = pop(n) / 1000 x 0.9      (people eat)
need(n, materials) = 0.3 x structures(n) + 0.5 x armies(n)   (each material shares this need equally)
need(n, luxury g)  = 0.1 x provinces(n) for each luxury g
price(g) = base(g) x (1 + 0.75 x clamp((BUY - SELL) / max(min(BUY, SELL), 0.1), -1, +1))
```

Range 25% to 175% of base, exactly as Vic3. Show the price list with arrows in the UI and in each
ruler's digest ("ore 2.1, up 40%: the war in the north"). A war that devastates the ore provinces
makes ore dear for everyone, which the AIs can read and talk about.

### R3. Trade: surplus to deficit [BETWEEN NATIONS]

Each year, after production:

```
surplus(n, g) = produced(n, g) - need(n, g)
```

1. Exporters: nations with surplus > 0. Importers: nations with surplus < 0.
2. A pair can trade if not at war and (trade pact, alliance, shared border, or both have a port).
3. Fill each importer's deficit from its partners in a fixed order (partner id ascending, then hash
   tie-break). Quantity moved = min(exporter surplus left, importer deficit left).
4. Importer pays exporter `qty x price(g)` as **one `payment` per pair per year** (reason
   `trade`, note "38 grain at 1.1"). Merge all goods of a pair into one payment to keep the
   transaction count low (see `docs/research/solana-economy.md`, section 3).
5. A deficit not filled costs the importer: food short gives population growth -1% a year per 10%
   short; materials short gives building cost +20%; luxury short counts toward R7 (satisfaction).
6. Tariff, optional: an exporter with a far-right or far-left ideology (R8) adds 20% to its price.

This is the main TNC flow: every year, every trading pair, one on-chain transfer.

### R4. Devastation per province (Vic3, scaled to years)

| | Value |
| --- | --- |
| Range | 0 to 100 |
| Battle on the province | +20 per battle, whoever wins (the land takes the damage) |
| Occupied (enemy army on it, or owner changed in the last 3 years) | +10 a year |
| Plunder / seizure (already in `war.ts`) | +15 |
| Bombing (later) | +30 per strike |
| Decay | -9 a year if none of the above happened this year (Vic3: -9.125 a year) |
| Output | x (1 - D/125): 100 devastation leaves 20% |
| Population cap | x (1 - D/200) |
| Population | above 50 devastation the province loses 1% of its people a year (Vic3 mortality +1% per point, softened) |
| Price link | Through R2: a devastated grain belt raises grain prices for the world |

Show it as a burnt, grey tint on the hex. It is the clearest visual of what a war cost.

### R5. War weariness (Civ VI points, Vic3 occupation)

Nation stat `WW`, 0 to 100.

| Event | Change |
| --- | --- |
| A battle on own land | +2 |
| A battle abroad | +4 (Civ VI doubles abroad) |
| An army destroyed | +6 (Civ VI: death is 3 x base) |
| Each 10% of own provinces occupied | +2 a year (Vic3 occupation drives exhaustion) |
| At war, no battle this year | -5 |
| At peace | -20 a year |
| Peace signed | -30 once (Civ VI: -2000 WWP on peace) |

Effects: satisfaction -1 per 20 WW (R7); radicalism (R8). At WW 80 or more, the ruler's digest says
"the people demand peace", and the AI should seek it. Optional: a nation at 100 WW must offer peace and
pay **reparations** [BETWEEN NATIONS] equal to 10% of its treasury (reason `reparations`, already in
`PaymentReason`).

### R6. War readiness (the user's stat)

Nation stat `WR`, 0 to 100. It is how mobilised the country is, set by the ruler's posture.

| Cause | Change a year |
| --- | --- |
| Policy focus `attack` | +15 |
| At war | +10 |
| An enemy army in own land | +10 |
| Peace and focus not `attack` | -15 |

Effects:

- Civilians are afraid: civilian output x (1 - 0.3 x WR/100) (R1). Frontier provinces (bordering an
  enemy at war) take a further x 0.85.
- Army upkeep -20% x WR/100 and army strength +10% x WR/100 (mobilised troops fight better).
- Satisfaction -1 when WR is 60 or more (fear).
- Radicalism (R8): +WR/20 a year toward the right.

The trade-off is plain: ready armies, poorer economy. The AI must choose, and the digest shows why.

### R7. Satisfaction from distinct luxuries (Civ VI amenities)

Nation stat `S` (an integer).

```
need     = ceil(provinces / 6)
have     = number of DISTINCT luxury goods the nation produced or imported this year
           (each distinct luxury covers 6 provinces' worth; copies add nothing)
S = have x 1 - need - floor(WW / 20) - (WR >= 60 ? 1 : 0) - (treasury == 0 and income < 0 ? 1 : 0)
```

| S | Level | Output multiplier `sat` | Population growth |
| --- | --- | --- | --- |
| +3 or more | Thriving | 1.10 | +10% |
| +1 to +2 | Content | 1.05 | +5% |
| 0 | Steady | 1.00 | 0 |
| -1 to -2 | Discontent | 0.90 | -15% |
| -3 to -4 | Unrest | 0.75 | -30%, radicalism +5 a year |
| -5 or less | Revolt | 0.60 | no growth, one random far-from-capital province may break away (seeded) |

Why it matters: a big empire needs several distinct luxuries, and most terrain makes only one. So
big nations **must import** salt, furs and wool from small ones. That is a steady
**[BETWEEN NATIONS]** flow through R3, and a reason small desert nations are worth befriending.

### R8. Ideology axis and radicalism (Vic3 movements, AoH2 governments)

Two nation stats:

- `I`, ideology, -100 (far left) to +100 (far right).
- `Rad`, radicalism, 0 to 100.

**Radicalism each year** (Vic3: falling living standards make radicals, wars make exhaustion):

```
Rad += 0.15 x WW + 0.2 x avgDevastation + 4 x max(0, -S) + (income < 0 ? 5 : 0)
       + (lost a province this year ? 5 : 0) - 6        (6 = natural calm)
Rad = clamp(Rad, 0, 100)
```

**Pull on the axis** (Vic3: poverty feeds the socialists, claims feed the fascists, radicals feed
reaction):

```
leftPull  = 3 x max(0, -S) + (food short ? 5 : 0) + (treasury < 10 ? 3 : 0)
rightPull = WW / 10 + 5 x provincesLostLast5Years + WR / 20
I += (rightPull - leftPull) x Rad / 50
if Rad < 20: I moves 3 a year toward 0       (calm times pull to the centre)
if Rad > 50 and |I| > 20: I += sign(I) x Rad / 25   (crisis pushes to the extreme it already leans to)
```

**Fictional movements** (names are free to change):

| Band of I | Movement | Economic modifiers (AoH2 style, small and flat) |
| --- | --- | --- |
| -100 to -60 | The Red Furrow (far left) | Trade income -15% (state seizes trade), food need -10%, satisfaction +1, foreign exporters charged +20% tariff. Seizes foreign merchant goods on revolution [BETWEEN NATIONS: `seizure`] |
| -59 to -20 | The Common Hearth (left) | Upkeep of buildings +5%, population growth +5% |
| -19 to +19 | The Lamp Assembly (centre) | Trade income +10%, loans cheaper (interest 6%) |
| +20 to +59 | The Iron Oath (right) | Army upkeep -10%, output -5% |
| +60 to +100 | The Black Standard (far right) | Army strength +10%, WR floor 40, tariff +20%, demands **tribute** from weaker neighbours [BETWEEN NATIONS] |

**Crisis.** When `Rad >= 60` and `|I| >= 60`, a movement starts organising (Vic3 revolution):
`progress += (Rad - 50) / 2` a year, falls by 10 a year when Rad < 50. At 100: a seeded event; the
movement takes power (the ruler's persona prompt gets "you now speak for the Black Standard"), or,
if the ruler resists, the provinces with the most devastation break away as a new nation. Each
ruler's digest gets one line: "The Red Furrow gains strength: bread is short and the war goes badly."
The AI ruler should be told its ideology band and its movement's modifiers so its decisions stay in
character.

### R9. Loans between nations [BETWEEN NATIONS] (AoH3 loans)

- A nation with treasury < 10 and income < 0 may ask for a loan from the richest nation it is not
  at war with (or its ally first).
- Principal = min(lender treasury x 0.2, 5 x borrower's yearly income at base prices) (AoH3 scales
  loan size by economy).
- Interest 10% a year (6% for the centre band, 15% if the lender is far right or far left).
- Repay in 5 equal yearly `payment`s of principal x 1.1 / 5 (more for higher interest).
- Max open loans: 2 (centre +1, far right -1, like AoH3's per-government caps).
- A borrower that misses a payment: relation with the lender worsens; after 2 misses the lender gains
  a casus belli and the borrower's WR rises (+10).

Loans make one disbursement and five repayments, each a visible transfer, and give the AIs a
reason to argue.

### R10. Largest producer bonus (AoH3) (extra)

Each year the top producer of each good gets one national bonus while it stays on top:

| Good | Bonus |
| --- | --- |
| grain | Population growth +5% |
| fish | Ship upkeep -10% |
| timber | Building cost -10% |
| stone | Fort cost -20% |
| wool | Satisfaction +1 |
| ore | Army strength +5% |
| salt | Food need -10% |
| furs | Satisfaction +1 |
| gold | +1 coin a year per gold province (minted) |

Show a crown icon next to the good in the price list. It names a target for every war.

### R11. Gold minting and bounty (extra)

Gold (Vic3: fixed price, not traded) mints straight into the treasury. When a gold province changes
hands, the conqueror takes 2 years of its output from the loser as **plunder**
[BETWEEN NATIONS] (reuse `plunder`).

### R12. Rebuilding aid (extra) [BETWEEN NATIONS]

After a peace, an ally with Rad < 30 may send `subsidy` = 2 x the partner's sum of devastation / 100
(capped at 10% of its treasury). It cuts the partner's devastation by 5 per province that year. A
cheap way to show friendship moving money on chain.

### Which rules move TNC between nations

| Rule | Reason code | How often | Size |
| --- | --- | --- | --- |
| R3 trade | `trade` | One per trading pair per year | qty x price, the biggest flow |
| R5 reparations | `reparations` | Once per lost war | 10% of loser treasury |
| R8 far-right tribute, far-left seizure | `subsidy` / `seizure` (or a new `tribute`) | Rare | Small |
| R9 loans | `subsidy` + repayments (contracts add loan and repayment payments, see commit 7c7dd5d) | 1 + 5 per loan | 5 x income |
| R11 gold plunder | `plunder` | On conquest of a gold province | 2 years of output |
| R12 rebuilding aid | `subsidy` | After a peace | Small |

### Build order and effort (agent hours, rough)

| Step | Rules | Effort | Notes |
| --- | --- | --- | --- |
| 1 | R1 goods + R2 prices (shared, pure functions, unit-testable) | 2 h | Income-neutral at base; add `goods` to the digest |
| 2 | R3 trade payments | 2 h | Reuse `payments.ts` patterns: seeded, one event per pair |
| 3 | R4 devastation (tile field, decay, tint on the globe) | 2 h | Needs a tile field in contracts (`needs-owner`) |
| 4 | R5 WW + R6 WR + R7 satisfaction | 2 h | Three numbers on the country |
| 5 | R8 ideology + movements + digest lines | 3 h | Prompt changes for rulers |
| 6 | R9 loans | 1.5 h | |
| 7 | R10-R12 | 1 h each | Cut first if late |

## 7. The tiny goods-price model, worked example

Goods: grain (base 0.9). Three nations.

| Nation | Grain produced | Grain need (pop/1000 x 0.9) |
| --- | --- | --- |
| A (plains) | 30 | 18 |
| B (mountains) | 4 | 20 |
| C (coast, fish instead) | 0 | 10 |

SELL = 34, BUY = 48. price = 0.9 x (1 + 0.75 x clamp((48 - 34) / 34, -1, 1)) = 0.9 x (1 + 0.75 x 0.41)
= **1.18**. A has 12 spare. B is short 16, C is short 10 (if fish also counts as food, C is covered by
fish first). A sells 12 to B (B before C by id): B pays A 12 x 1.18 = **14.2 TNC** in one transfer.
B is still short 4: growth -1% x 4/20 x 10 = about -2% this year. If a war devastates A's plains to
D = 60, A's output falls to 30 x (1 - 60/125) = 15.6, SELL drops, and grain rises toward 1.58
(the 175% cap). The whole world feels the war in the price of bread.

## Gaps and unconfirmed

- **AoH2 war weariness and loans:** not found on the wiki. Probably absent in base AoH2.
- **AoH3 war weariness, ideology unrest and exact loan numbers:** no wiki page; Game Rant and Steam
  threads only. The AoH3 defines quoted come from a mod's change note (Feb 2025) and may have changed.
- **AoH3 resource count:** wiki says 49, Steam store says 48.
- **Victoria 3:** most pages say last verified for 1.13; current numbers may differ.
- **Civ VI:** war weariness numbers come from the Fandom page, which credits a CivFanatics analysis.
- All Terra Nova numbers in section 6 are proposals, not tuned. Expect one balancing pass in mock mode.
