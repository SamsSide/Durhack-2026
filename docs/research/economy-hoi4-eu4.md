# Economy ideas from Hearts of Iron IV and Europa Universalis IV (row B11 research)

Researched 14 Nov 2026 for lane b (row B11, the deeper economy whose coin is the TNC token on
Solana devnet). Sources are the official community wikis (hoi4.paradoxwikis.com and
eu4.paradoxwikis.com), read 14 Nov 2026 through WebFetch and the user's Chrome. Most of those pages
say "last verified for version 1.16" (HoI4) or "1.24 to 1.31" (EU4), so a few numbers may be one
patch old. That does not matter for us: we borrow shapes and rough sizes, not exact balance.
Anything the wikis did not state is marked **unconfirmed**.

Screenshots (in `docs/research/img/`):

- `eu4-devastation-effects.jpg`: what 100% devastation does to a province (EU4).
- `eu4-trade-goods-prices.jpg`: one good per province and its base price (EU4).
- `hoi4-economy-laws.jpg`: the mobilisation ladder and the consumer goods tax (HoI4).
- `hoi4-compliance-industry.jpg`: how much an occupied state yields at each compliance level (HoI4).

## 0. The answer in six lines

- **EU4 gives us the province economy:** one good per province, a base price per good, income =
  goods x price, and a per-province **devastation** 0 to 100 that cuts output (to zero at 50%).
- **HoI4 gives us the nation's mood:** **stability** and **war support** (both 0 to 100, neutral at
  50), a **mobilisation ladder** that trades civilian output for war output, **compliance** in
  conquered land, and **ideology popularity** that topples governments by election, coup or civil war.
- **The money flows between nations that make Solana matter:** buying goods a nation lacks (the big
  one, every year), reparations (10% of income for 10 years), tribute from puppets, loans with
  interest and default, loot from a sacked province, subsidies to ideological friends.
- **The simplest strong loop:** war -> devastation -> less grain and iron -> prices rise -> neutral
  producers get rich off the war -> on-chain payments spike on the dashboard.
- All rules below are per year (one tick = one year), deterministic, and sized to our current
  treasury scale (a plains province earns 0.9 coin a year today).
- About 8 to 12 agent hours for the core set (section 4.9). Biggest risk: too many stats for a
  judge to read in a 3-minute demo; show three (devastation, war support, ideology) on screen.

## 1. Hearts of Iron IV

### 1.1 Factories, consumer goods and the economy laws

Source: [Laws](https://hoi4.paradoxwikis.com/Laws), [Civilian factory](https://hoi4.paradoxwikis.com/Civilian_factory), [Production](https://hoi4.paradoxwikis.com/Production).

- **What:** two factory kinds. Civilian factories build things, buy imports and pay "consumer
  goods". Military factories make equipment. A military factory makes 3.5 a day (4.5 with coal);
  a civilian one builds about 4 to 5 a day (the page is inconsistent), up to 15 on one project.
- **Consumer goods** are a tax in factories: `floor(pct x (civilian + military factories))` civilian
  factories do nothing useful. Example from the wiki: Early Mobilization (30%), 50 + 50 factories
  -> 30 lost, 20 free. The percentage comes from the economy law, minus up to 20% at 100% stability.
- **Economy laws** (the mobilisation ladder; changing costs 150 political power):

| Law | Consumer goods | Military factory build | Civilian factory build | Needs war support |
| --- | --- | --- | --- | --- |
| Civilian Economy | 35% | -30% | -30% | none (default) |
| Early Mobilization | 30% | -10% | -10% | > 15% |
| Partial Mobilization | 25% | +10% | 0 | > 25% |
| War Economy | 20% | +20% | 0 | > 50% plus an extreme ruling party or a big war |
| Total Mobilization | 15% | +30% | 0 | > 80%, at war, enemy holds > 50% of your factories; -3% recruitable population |

- **Conscription laws** (manpower against factory output):

| Law | Recruitable population | Factory and construction output | War support needed (order inferred) |
| --- | --- | --- | --- |
| Volunteer Only | 1.5% | 0 | default |
| Limited Conscription | 2.5% | 0 | > 10% |
| Extensive Conscription | 5% | 0 | > 20% plus extreme party or a big war |
| Service by Requirement | 10% | -10% | > 60% |
| All Adults Serve | 20% | -30% | > 70% |
| Scraping the Barrel | 25% | -40% | > 85% |

- **Why it is fun:** mobilising is a visible, costly commitment. A nation on Total Mobilization is a
  threat everyone can see, and its own people pay for it. War support gates each step, so a nation
  cannot mobilise unless its people want the war.

### 1.2 Strategic resources and the international market

Source: [Resources](https://hoi4.paradoxwikis.com/Resources), [Trade](https://hoi4.paradoxwikis.com/Trade), [Laws](https://hoi4.paradoxwikis.com/Laws).

- **What:** seven resources (oil, aluminium, rubber, tungsten, steel, chromium, coal) come from
  states. They **cannot be stockpiled**; extraction flows straight into production and any surplus
  is wasted.
- **Extraction bonuses:** +15% per infrastructure level (max +75%), +10% per excavation tech level
  (max +50%), +20% with a supply hub or naval base linked to the capital.
- **Shortage:** each missing unit of a needed resource is -5% on the affected factories, up to -100%.
- **Trade law** decides what share of extraction goes to the market (unavailable at home even if
  nobody buys it), and gives a bonus for opening up:

| Trade law | Resources to market | Factory output | Construction | Research |
| --- | --- | --- | --- | --- |
| Free Trade | 80% | +15% | +15% | +10% |
| Export Focus | 50% | +10% | +10% | +5% |
| Limited Exports | 25% | +5% | +5% | +1% |
| Closed Economy | 0% | 0 | 0 | 0 |

- **Price:** 1 civilian factory buys up to 8 units of a resource; the whole factory is spent even
  when less is available. **The seller receives the buyer's factories** for as long as the deal runs.
- **Who gets scarce exports:** split by trade influence. Influence = 150 base + opinion (-100 to
  +100) + up to 50 for ideology support in the exporter + 2 a month of the deal (max 50) - 0.02 per
  7 km distance - 100 if the buyer already takes 50% or more of the seller's exports
  (anti-monopoly) + 400 for an overlord. Influence 0 (embargo) blocks trade. Example: influence
  120, 80, 200 -> shares 30%, 20%, 50%.
- **Delivery:** needs a land or sea route; overseas trade needs convoys that raiders can sink.
- **Why it is fun:** every shortage creates a buyer, and every buyer pays a seller. Small neutral
  states with chromium or rubber matter. Embargoes and convoy raiding become weapons.

### 1.3 Stability

Source: [Stability](https://hoi4.paradoxwikis.com/Stability) (also [Political power](https://hoi4.paradoxwikis.com/Political_power)).

- **What:** 0 to 100%, "the people's support for the current government". Default 50%.
- **Raised or lowered by:** at war -20%; war support during war 0% at 100 war support down to -30%
  at 0 war support (linear); ruling party popularity 0% at 0 up to +15% at 100% popularity; a
  popular figurehead or political advisor +15%; events, focuses, decisions.
- **Effects** (linear between 50% and the end):

| Effect | At 100% stability | At 0% stability |
| --- | --- | --- |
| Factory and dockyard output | +20% | -50% |
| Political power gain | +10% (Government page says +20%) | -20% (Government page says -50%) |
| Consumer goods factor | -20% | 0 |
| Resistance target in land you occupy | 0 | +20% |

- At war, low stability can trigger a crisis, up to civil war (threshold **unconfirmed**).
- **Why it is fun:** a long war slowly eats the home front; ruling a popular party is a buffer.

### 1.4 War support

Source: [War support](https://hoi4.paradoxwikis.com/War_support).

- **What:** 0 to 100%, default 50%; no effect at 50%.
- **Raised or lowered by:** offensive war -20%, defensive war +20%, attaché +10%, pride of the fleet
  +5%, events and focuses. Dynamic weekly losses from strategic bombing, sunk convoys and
  casualties exist in the game but **the wiki gives no numbers (unconfirmed)**; Paradox dev diaries
  say convoy losses tick war support down weekly (forum, not verified).
- **Effects:**

| Effect | At 100% | At 0% |
| --- | --- | --- |
| Mobilisation speed | +30% | -50% |
| Attack and defence on core land | +10% | 0 |
| Command power gain | +50% | -95% |
| Surrender limit | 0 | -30% (gives up sooner) |
| Crisis | none | possible while at war |

- It gates the economy and conscription laws (tables in 1.1).
- **Why it is fun:** a defensive war unites people, an aggressive one splits them. Bombing a
  nation's cities can break its will without taking its land.

### 1.5 Ideology, elections, coups and civil wars

Source: [Ideology](https://hoi4.paradoxwikis.com/Ideology).

- **What:** four ideologies (democracy, communism, fascism, non-aligned) each with a popularity %
  in every country; they sum to 100%.
- **Drift:** ministers, events, focuses and other countries' influence move popularity a little a
  day (the exact daily drift is **unconfirmed** on the wiki). Some events give +0.05% a day until the
  government changes.
- **How the ruler changes:**
  - **Election:** another ideology above 50% can win peacefully.
  - **Coup:** needs a minister and a 500-day sympathies event, communism >= 40% or fascism >= 30%;
    takes 100 days (half at >= 50%); then two years of "Reign of Terror".
  - **Civil war:** communist >= 40% or fascist >= 25%, 365 days; the rebels take 60 to 70% of the
    country.
  - **Demonstrations:** at >= 50% popularity, 30 days; suppress (-10% popularity) or allow (the
    government changes, -5% stability).
  - **Class Conflicts Divide:** at >= 20%: +5% popularity, -5% stability.
- **Effects of the ruling ideology:** who may puppet, send volunteers, guarantee; world tension
  from declaring war (-75% for non-aligned, -25% for communism); time to justify a war against a
  major (-80% for fascism). Trade influence +50 with a country that supports your ideology.
- **Why it is fun:** a nation's politics can flip under you, and extremes grow in hard times. A
  civil war is the most dramatic thing that can happen to a map.

### 1.6 Occupation: resistance and compliance

Source: [Resistance / Occupation](https://hoi4.paradoxwikis.com/Resistance) (redirects to Occupation).

- **Resistance:** 1% at capture, grows +0.2% a day toward a target (base 35%), decays -0.1% a day.
  Target: +10% if the victim capitulated, -10% if the occupier is at peace, -5% with a claim,
  +0.2% per point of the occupier's stability below 100 (max +20%), -0.5% per point of compliance
  (max -50%), occupation laws -75% to +40%. At 75% resistance: -50% speed, -50% supply, +30%
  attrition for the occupier; at 90%: factories sabotaged and occupied cores may declare
  independence.
- **Compliance:** starts at 0% (70% for non-core land at game start; a new owner gets half the old
  owner's). Base +0.075% a day, +10% faster at peace, minus a decay of up to -0.083% a day at 100%.
- **Yield to the occupier** (C = compliance, 0 to 1):
  - factories = 25% + 65% x C
  - resources = 35% + 65% x C
  - manpower = 2% + 18% x C
- **Thresholds:** 25% fewer garrisons, 40% +10% resources and factories, 60% +20% recruits, 80%
  offers a collaboration government (a puppet).
- **Occupation laws:** a dial from gentle to brutal, e.g. Local Autonomy +10% resistance target,
  +0.02% compliance a day; Forced Labour -40% target, -0.08% compliance a day, +40% resources;
  Brutal Oppression -75%, -0.11% a day.
- **Why it is fun:** conquest is not instant profit. You choose between squeezing now (brutal law,
  quick resources, endless resistance) and patience (compliance, a puppet later).

### 1.7 Strategic bombing

Source: [Strategic bombing](https://hoi4.paradoxwikis.com/Strategic_bombing), [Air missions](https://hoi4.paradoxwikis.com/Air_missions).

- **What:** bombers damage buildings in a region: factories, infrastructure, airbases, radar, forts,
  refineries. About 120 damage per attack cycle, roughly 0.3 buildings destroyed, spread over all
  targets in the region. Anti-air absorbs bombs and shoots bombers down; dispersed industry tech
  cuts factory damage. Damaged buildings stop working until repaired by civilian factories.
- **War support loss from being bombed:** exists in the game, **numbers unconfirmed** on the wiki.
- **Why it is fun:** a way to hurt a nation's economy (and morale) without a front line.

### 1.8 Manpower

Source: [Manpower](https://hoi4.paradoxwikis.com/Manpower).

- Recruitable population = population x conscription law % (table in 1.1), summed over controlled
  states; non-core land gives about 2% of normal. Losing a state loses its manpower. A destroyed
  division returns 20% of its men. Growth per month is "small" (**unconfirmed** figure).

## 2. Europa Universalis IV

### 2.1 Trade goods and production

Source: [Trade goods](https://eu4.paradoxwikis.com/Trade_goods), [Production](https://eu4.paradoxwikis.com/Production).

- **What:** every province produces exactly one good. Goods produced = (0.2 x production
  development + flat bonuses) x (100% + modifiers).
- **Income:** yearly trade value = price x goods produced; monthly production income = trade value
  / 12 x (100% + production efficiency) x (100% - autonomy). The same trade value also flows into
  the trade network (2.4), so a good earns twice: once for the owner, once for whoever controls the
  trade.
- **Goods modifiers:** prosperity +25%, production leader of that good +10%, occupied -50%,
  under siege -25%, **devastation -1% per point** (the Devastation page says -200% at 100, i.e.
  -2% per point; the two pages disagree), war exhaustion -2% per point.
- **Base prices** (a few, from the wiki table; "adjusted" is after historical price events):

| Good | Base | Adjusted | Where it spawns |
| --- | --- | --- | --- |
| Grain | 2.5 | 2.25 | farmland x1.5, less in mountains and forests |
| Fish | 2.5 | 2 | needs a port; coasts |
| Wool | 2.5 | 2.875 | mountains, deserts, highlands |
| Salt | 3 | 3.3 | desert, marsh, mountains |
| Iron | 3 | 4.5 | (hills, mountains) |
| Copper | 3 | 3.45 | |
| Fur | 2 | 3.5 | cold winters |
| Naval supplies | 2 | 3 | (forests) |
| Livestock | 2 | 3.4 | |
| Wine | 2.5 | 3.125 | hills, farmland, mild climate |
| Gems | 4 | 3 | |
| Coal | 10 | 7 | late game |

- **Gold is special:** no trade value; turns straight into coin at 40 a year per unit of goods
  produced, ignores most bonuses, and **causes inflation**.
- **Prices move** only by scripted "price change" events (no supply and demand in EU4; Victoria
  does that). Holding 20% of world trade in a good gives a national "trading in" bonus (kept above
  15%).
- **Why it is fun:** every province has a name and a thing it makes. The map reads as an economy:
  "that desert is gold, that valley is grain". Wanting a province for its good drives wars.

### 2.2 Devastation

Source: [Devastation](https://eu4.paradoxwikis.com/Devastation) (section of Province).
Screenshot: `img/eu4-devastation-effects.jpg`.

- **What:** per province, 0% (none) to 100% (extreme). Effects scale linearly.
- **Raises it:** scorched earth +10 at once and +0.25 a month; blockade +0.25 a month; occupied
  +0.2 a month; under siege +0.1 a month; each loot +0.07 to +2.1; coastal raids.
- **Lowers it:** inside a friendly fort's zone of control -0.83 a month; owner in control -0.08 a
  month; developing the province (about -10 at 12 development); a few special edicts -0.05 to
  -0.25 a month.
- **Effects at 100%:** goods produced -200%, manpower -200%, sailors -200%, supply limit -50%,
  institution spread -200%, development cost +20%, movement speed -25%. No prosperity while any
  province in the state is devastated.
- In yearly terms: an occupied province gains about +2.4 a year (+3.6 while besieged), and
  recovers -1 a year on its own, or -10 a year under a fort. **Recovery is slow on purpose.**
- **Why it is fun:** war leaves scars on the map that last decades. A border region fought over
  three times stays poor, which is history-like and visible.

### 2.3 War exhaustion

Source: [War exhaustion](https://eu4.paradoxwikis.com/War_exhaustion).

- **What:** per nation, 0 to 20.
- **Raises it:** battle losses (scaled down for big countries; formula **unconfirmed**), attrition
  at least +0.01 a month, blockade up to +0.1 a month, being occupied up to +0.5 a month at 100%
  occupation, declaring a war that costs stability (e.g. +2 with no casus belli).
- **Lowers it:** -0.1 a month at peace; 75 diplomatic power for -2; a few ideas.
- **Effects per point:** +1 national unrest, -2% goods produced, -1% manpower recovery, +2%
  recruitment time, -1% siege ability, +1 liberty desire in subjects; AI accepts peace more easily.
- **Why it is fun:** a clock on every war. Even a winner wants peace eventually.

### 2.4 Unrest and rebels

Source: [Unrest / Rebellion](https://eu4.paradoxwikis.com/Unrest).

- **What:** a per-province number = local + national unrest; above 0 a rebel faction gains
  progress and eventually rises (exact threshold and progress formula **unconfirmed**).
- **National sources:** negative stability +2 per point (positive -1 per point), war exhaustion
  +1 per point, overextension +0.05 per % (+5 at 100%), low legitimacy up to +2, low religious
  unity up to +3.
- **Local sources:** wrong culture +2, newly conquered non-core +15 (separatism, decays 0.5 a year
  over 30 years), active missionary +6, defensive war -5, own troops -0.25 per regiment (max -5),
  raising autonomy -10 for 30 years, recent uprising -100 for 10 years.
- **Effects per point:** -2% local tax, +10% local recruitment and shipbuilding time.
- **Rebel types** demand things: peasants want autonomy, separatists independence, pretenders the
  throne, zealots a religion. If rebels win they force their demand.
- **Why it is fun:** conquest makes you weaker for a while; overreach is punished by your own people.

### 2.5 Stability (EU4 version)

Source: [Stability](https://eu4.paradoxwikis.com/Stability).

- -3 to +3. Each + point: +5% national tax, -1 unrest, +1% trade power. Each - point: +2 unrest,
  +1% loan interest, -1% trade power. At -3 you cannot declare war and must accept bad peace
  deals. Raising it costs 100 admin power, +50% per positive point already held.

### 2.6 Tax

Source: [Tax](https://eu4.paradoxwikis.com/Tax).

- Monthly tax per province = (base tax + flat) / 12 x tax efficiency x (1 - autonomy).
  Efficiency: core +75%, occupied -50%, blockade -75%, stability +5% per point. Every nation also
  gets +12 a year flat (-6 for subjects).

### 2.7 Trade network (nodes and merchants)

Source: [Trade](https://eu4.paradoxwikis.com/Trade).

- **What:** province trade value flows into a trade node; nodes form a one-way graph that ends in
  a few rich "end nodes" (Venice, Genoa, the English Channel).
- **Trade power:** +0.2 per development, +5 / +10 / +25 for a centre of trade level 1 / 2 / 3, +2
  per merchant present, +5 in the home node.
- **Collecting:** you take `node value x your power / total collecting power`, times (1 + trade
  efficiency, +10% with a merchant). Collecting away from home is -50% power.
- **Steering:** what nobody collects flows downstream, split by steering power; each merchant on a
  link adds +5%, +2.5%, +1.6%, +1.2%, +1% value (max +11.3% at 5 merchants). Nations start with 2
  merchants.
- **Why it is fun:** money is a river. You can starve a rival by steering trade away from its home
  node, and wars are fought over the mouth of the river.

### 2.8 Loans and bankruptcy

Source: [Loans](https://eu4.paradoxwikis.com/Loans).

- **Loan size:** `floor(0.5 x total development) x (1 + trade efficiency from diplomatic tech)`.
- **Interest:** 4% a year base, minimum 1%, +1% per point of negative stability, +5% while
  bankrupt. A loan that comes due unpaid is extended 5 years. Each loan and each extension adds
  +0.1 inflation.
- **Forced loans:** if the treasury would go below zero, a loan is taken automatically.
- **Maximum:** reached when interest equals monthly income.
- **Bankruptcy:** happens when the treasury would go negative at the loan cap (or by choice). It
  clears all loans and 25% of inflation, costs 100 prestige and **3 stability**, empties the
  treasury, and for **5 years**: -50% army and navy morale, +5% interest, -100% manpower recovery,
  +50% tech cost, **cannot declare war**.
- **Money between countries:** war reparations = **10% of the loser's income for 10 years** (peace
  term); vassals pay tribute from their tax (rate not given); subsidies are paid monthly for a set
  number of years.
- **Why it is fun:** debt is a delayed trap. A broke nation is a toothless nation for five years,
  and its neighbours know it.

## 3. What to take, and why

| Mechanic | Take? | Why |
| --- | --- | --- |
| One good per province + base price (EU4) | Yes, core | Readable on the globe; money has a source |
| Devastation per province (EU4) | Yes, core | The user asked for it; visible scars; cuts goods and people |
| Stability 0..100, neutral at 50 (HoI4) | Yes | One national mood that scales output |
| War support 0..100, gates mobilisation (HoI4) | Yes | Makes WAR READINESS earned, not free |
| Mobilisation ladder 0..4 (HoI4 economy laws) | Yes, as WAR READINESS | Civilians lose output; easy to show |
| Ideology popularity + radicalism + coups (HoI4) | Yes, fictional movements | Drama, chronicle entries, an AI decision for Gemini |
| Compliance in conquered land (HoI4) | Yes, simple | Conquest is not instant money; makes tribute and puppets meaningful |
| Resource trade with influence split (HoI4) | Yes, simplified | The yearly money flow between nations |
| Reparations, loans, bankruptcy (EU4) | Yes | Already in the payment reasons; numbers given |
| War exhaustion (EU4) | Fold into war support | One stat, not two |
| Trade nodes and steering (EU4) | No (for now) | Too much UI; our sea trade (`trade.ts`) already covers routes |
| Supply-and-demand prices | Yes, light | Not in EU4, but a war that raises prices is the best Solana story |

## 4. Steal for Terra Nova

All rules run once a year inside the nation's own turn (`rules.ts`), read only shared state, and
use `hashString` for any randomness, never `Math.random`. Numbers are sized to our current scale
(plains income 0.9 a year, treasuries in the low hundreds). New stored fields are proposed in 4.10;
they change `docs/contracts.md`, so they need the owner (`needs-owner`).

### 4.1 Province goods and prices (from EU4 trade goods)

One good per terrain, a base price, a base output of 1 unit a year per province:

| Terrain | Good | Base price | Used for |
| --- | --- | --- | --- |
| plains | grain | 2.5 | feeds people |
| coast | fish | 2.5 | feeds people |
| forest | timber | 2.0 | buildings, ships |
| hills | stone (or wool) | 2.5 | forts, buildings |
| mountain | ore | 3.0 | armies, weapons |
| desert | gold or salt (see below) | 3.0 | gold: coin; salt: food keeping |
| ice | furs | 3.5 | luxury |
| ocean | none (fish is on coast) | - | - |

- Desert: a seeded `hashString(tileId) % 3 === 0` makes one desert province in three a **gold**
  province (EU4 gold: coin straight into the treasury, no trade), the rest salt.
- **Output:** `units = 1 x (1 - 1.5 x dev/100) x stabilityMul x readinessMul x complianceMul`,
  floored at 0 (so 67 devastation stops a province).
- **Province income:** `units x price x 0.36` coin a year. With price 2.5 and no penalties this is
  0.9, today's plains income, so the change is balance-neutral on day one. Gold pays
  `units x 3.0 x 0.36 x 1.5` and adds +0.002 to a world "inflation" that lowers every price by that
  factor (optional; skip if short on time).
- **World price** of each good, recomputed each year from shared state (deterministic):
  `price = base x clamp(demand / max(supply, 1), 0.5, 2.0)`, where supply is the sum of units of
  that good on the map and demand is from 4.2. A war in ore country doubles ore prices.
- **Chronicle hooks:** "Ore prices doubled after the burning of the Ironridge mines."

### 4.2 Needs and the yearly goods market (the main money flow; from HoI4 trade)

- **Every nation needs** each year:
  - food (grain or fish): `population / 1000` units,
  - ore: `0.5 x armies + 0.3 x fleets` units,
  - timber or stone: `0.5` per building queued this year.
- **Surplus** = own units minus own needs, per good. A nation with a deficit **buys** from nations
  with a surplus. Short of goods and not buying: armies upkeep x1.5 for an ore deficit, population
  growth -50% and stability -5 for a food deficit (HoI4 shortage penalty, simplified to one step).
- **Which sellers:** sort candidate sellers by influence, then split the deficit by influence share
  (HoI4). `influence = 150 + 50 x (trade pact or alliance) + 50 x (same ruling movement) - 100 x
  (at war: blocks trade) - 2 x hexDistance between capitals - 100 if this buyer already takes half
  the seller's surplus`. Influence <= 0 means no trade (embargo, war).
- **Payment:** one `payment` per buyer-seller pair per year, reason `trade`, amount
  `units x world price`, note "Grain for Ashmark". **This is the steady heartbeat of TNC
  transfers**: with 12 nations, about 10 to 25 transfers a year (every half second), so it must be
  batched or rate-limited for devnet (one transfer per pair per 5 years with 5 years' worth is a
  safe fallback).
- **Trade openness** (HoI4 trade law, set by the ruler, 0 to 3): share of surplus offered = 0%,
  25%, 50%, 80%; bonus to own output +0%, +5%, +10%, +15%. Far-left and far-right movements cap it
  (4.6).

### 4.3 Devastation (per province, 0 to 100; from EU4)

| Event | Change |
| --- | --- |
| A battle on the province | +10 |
| Enemy army on it (occupied) | +5 a year |
| Siege of a fort or city on it | +4 a year |
| Sacked (plunder, see 4.8) | +15 at once |
| Bombed (later) | +20 per raid |
| Port blockaded by an enemy fleet next to it | +3 a year |
| Owner controls it, at peace | -3 a year |
| Owner controls it and has a fort or wonder within 1 province | -8 a year |

- **Effects:** goods output x `(1 - 1.5 x dev/100)` (zero at 67); population cap x
  `(1 - 0.5 x dev/100)`; unrest feeds radicalism (4.6) at `+avgDev/50` a year.
- **On the globe:** tint the province brown to black by devastation (one shader uniform per tile).
  This is the strongest visual of the whole economy.

### 4.4 Stability and war support (per nation, 0 to 100; from HoI4)

- **War support** (start 50, drifts 5 a year back toward 50 at peace):
  - +20 on entering a defensive war, -20 on starting an offensive one (once, at the start),
  - -2 per battle lost, +1 per battle won, -3 per province lost, -5 per enemy bombing raid (later),
  - -1 a year per 10 points of average devastation in the nation's own land.
- **Stability** (target, moved 20% toward it each year so it is smooth):
  `target = 50 - 20 x atWar - 0.3 x max(0, 50 - warSupport) x atWar + 0.15 x rulingPopularity
  - 0.2 x avgDevastation - 10 x foodDeficit - 15 x bankrupt`.
- **Effects:** `stabilityMul` on goods output: `1 + 0.2 x (s - 50)/50` above 50, `1 - 0.5 x
  (50 - s)/50` below (HoI4 numbers exactly). Below 20 at war: a civil war check (4.6).
- **Surrender:** a nation at war whose war support is under 15 offers peace at once (HoI4's
  surrender limit, simplified). The ruler's digest should see this so Gemini can choose it.

### 4.5 War readiness (per nation, levels 0 to 4; from HoI4 economy and conscription laws)

| Level | Name (in-world) | Needs war support | Civilian output | Army upkeep | Army cap | Fear (radicalism a year) |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Peace footing | - | x1.00 | x1.00 | x1.0 | 0 |
| 1 | Watchful | > 15 | x0.95 | x0.95 | x1.2 | +0.5 |
| 2 | Levy | > 25 | x0.90 | x0.90 | x1.5 | +1 |
| 3 | War economy | > 50 | x0.80 | x0.80 | x2.0 | +2 |
| 4 | Total war | > 80 and at war | x0.70 | x0.70 | x2.5 | +3 |

- `readinessMul` is the civilian output column; it multiplies every province's goods. Army upkeep
  is cheaper as readiness rises (factories turned to war), so the trade-off is "fewer goods, more
  armies".
- If war support falls below the level's need, readiness drops one level per year.
- Gemini sets readiness as part of its policy (one new field); mock rulers raise it by 1 a year at
  war and lower it by 1 a year at peace.
- **Why it is fun on screen:** a nation going to "Total war" is a chronicle line, a red ring on its
  capital and a visible dip in its exports, so its trading partners' TNC income dips too.

### 4.6 Ideology and radicalism (per nation; from HoI4, fictional movements)

- **Five fictional movements** on a spectrum from -2 to +2 (names are placeholders; all invented):

| Pos | Movement | Flavour | Economy effect while ruling |
| --- | --- | --- | --- |
| -2 | The Red Hearth | far left: collective farms, the state owns the mines | trade openness max 1; grain output +15%; loans to rulers of +1 or +2 refused; seizes foreign-owned debts on taking power (cancels its loans) |
| -1 | The Commons League | left: guilds, welfare | stability +5; trade with -2..0 +50 influence |
| 0 | The Assembly | centre: merchants and law | trade openness up to 3; trade income +10%; loan interest -1% |
| +1 | The Crown Party | right: tradition, order | war support +5; readiness needs -10 |
| +2 | The Iron Dawn | far right: conquest, purity | trade openness max 1; readiness needs -20; plunder x1.5; compliance gain -50% (brutal occupation) |

- **State:** `popularity[5]` (sums to 100) and `radicalism` 0 to 100.
- **Radicalism per year:**
  `+2 x atWar + avgDev/50 + 3 x foodDeficit + 3 x bankrupt + 0.05 x max(0, 40 - stability)
  + readinessFear - 2 x (at peace and stability > 60)`, clamped 0 to 100.
- **Drift per year:** move `radicalism / 20` popularity points from movements at 0 and +-1 to the
  extremes at +-2, split toward the side the nation is already leaning (sum of position x
  popularity); poverty (treasury under 20) pushes left, a lost war pushes right, a seeded
  `hashString` tie-break otherwise. The ruler's own movement gains +1 a year (incumbency).
- **Changing the government** (checked every year, deterministic):
  - **Election** every 10 years for rulers at 0 or +-1: the most popular movement takes power.
  - **Coup:** an extreme with popularity >= 30 (+2) or >= 40 (-2) and stability < 35: takes power;
    stability -10, chronicle line, "Reign of Terror" for 2 years (+5 war support).
  - **Civil war:** an extreme >= 25 and stability < 20 while at war: the nation's provinces whose
    seeded roll falls below that popularity break away as a new nation of that movement, which
    then wants money too (a new wallet on devnet, a nice Solana moment).
- **Gemini's role:** the ruler's digest shows popularity and radicalism; the ruler may "suppress"
  (popularity of the extreme -10, stability -5) or "concede" (that movement +5, radicalism -10).
  Each ruling movement gets a short persona line so the AI speaks in its voice.
- **Controversy, safely:** the movements echo real ideas (collectivism, nationalism) but are
  fictional, with no real parties, symbols or slogans. This keeps the HoI4 drama without
  real-world propaganda.

### 4.7 Conquered land: compliance (per province, 0 to 100; from HoI4)

- A province taken in war starts at compliance 0 (or half the old owner's if it was already
  conquered). +4 a year, +8 at peace, x0.5 under an Iron Dawn ruler, +4 with a fort.
- `complianceMul` on its goods = `0.35 + 0.65 x c/100` (HoI4 resources formula), so conquest pays
  35% at first and 100% after about 15 peaceful years.
- Below 20 compliance and at least 30 devastation: radicalism of the occupier +0.5 a year per such
  province (partisans).
- At 80 average compliance across a conquered enemy's former land, the winner may set up a
  **puppet**: a new vassal that pays **tribute** (4.8).

### 4.8 Money flows between nations (each one is a TNC transfer)

These are the rules that make Solana matter. Reasons are the existing `PaymentReason` values.

| Flow | Reason | Rule | Size at our scale |
| --- | --- | --- | --- |
| Goods market | `trade` | 4.2: deficit buyer pays surplus seller, `units x world price` | 2 to 15 a year per pair |
| Reparations | `reparations` | EU4: loser pays **10% of its yearly income for 10 years** (one payment a year) | 1 to 5 a year |
| Plunder | `plunder` | sacking an enemy province pays `3 x that province's yearly income x (1 - dev/100)` once; devastation +15 | 2 to 10 once |
| Seizure | `seizure` | a captured capital hands over 50% of the treasury | big, rare |
| Tribute | `subsidy` reversed, or a new `tribute` reason | a puppet pays **15% of its income a year** to its overlord (EU4 vassal tax, rate ours) | 1 to 4 a year |
| Loans | `loan`, `repayment` | 4.8a | 20 to 80 principal |
| Ideological aid | `subsidy` | a ruler pays 5% of its treasury a year to a nation of the same extreme movement at war | 2 to 10 |
| War chest | `war_chest` | an ally at war pays 3% of its treasury a year to the leader of its side | 2 to 10 |
| War profiteering (emerges) | `trade` | no extra rule: war cuts output in the warring nations, prices rise (4.1), neutrals sell more | visible spike |

**4.8a Loans and default (EU4):**

- A nation whose treasury would fall below 0 asks for a loan; the lender is the richest nation with
  influence > 0 toward it (4.2 formula) that is not at war with it.
- Size: `floor(0.5 x provinces) x 10` coin. Interest: `4% + 1% per 10 points of stability under 50
  + 2% if the lender's movement is 2 steps away`, paid yearly as `repayment`; principal due over 10
  years (10% a year).
- Cap: total interest cannot exceed 50% of yearly income.
- **Default (bankruptcy):** when a payment is due and the treasury cannot cover it at the cap: all
  its loans are written off (the lenders lose the coin, which is the interesting on-chain story),
  stability -30, war support -20, radicalism +15, and for **5 years**: no new war, goods output
  x0.8, no loans. The lender gets a casus belli (chronicle: "Ashmark defaults; its creditors sharpen
  their swords").

### 4.9 Effort estimate

| Piece | Agent hours | Money flows? |
| --- | --- | --- |
| Goods per terrain, output formula, world price | 1.5 | indirectly |
| Needs + goods market + `trade` payments (batched) | 2 | **yes, the main one** |
| Devastation per province (+ globe tint) | 1.5 (+1 web) | via prices and plunder |
| War support + stability | 1 | no |
| War readiness (policy field, mock and Gemini prompt) | 1 | indirectly |
| Ideology + radicalism + election / coup | 2 | aid subsidies; civil war makes a new wallet |
| Compliance in conquered land | 0.5 | via tribute |
| Reparations, plunder size, tribute | 1 | **yes** |
| Loans and default | 1.5 | **yes** |
| Total | about 12 (8 without ideology and compliance) | |

Order if short on time: goods + market (Solana heartbeat), devastation (visual), loans and
reparations (drama), then war support and readiness, then ideology.

### 4.10 Proposed new fields (contract change, needs the owner)

- `Tile`: `devastation: number` (0..100), `compliance?: number` (0..100, only on conquered land),
  `good: 'grain' | 'fish' | 'timber' | 'stone' | 'ore' | 'gold' | 'salt' | 'furs'` (derived from
  terrain and a seeded roll, so it need not be stored).
- `Country`: `stability`, `warSupport`, `readiness` (0..4), `tradeOpenness` (0..3),
  `ideology: { ruling: -2..2, popularity: number[5], radicalism: number }`, `loans: { lender,
  principal, rate, sinceTick }[]`, `bankruptUntil?: number`.
- Events: reuse `country_updated` (patch) and a new `tile_updated { tile, devastation, compliance }`
  (or fold into an existing tile event). Payments reuse `payment`.
- A digest line for Gemini: "Stability 42, war support 31, readiness 3 (war economy), radicalism
  55 (Iron Dawn 28%), ore deficit 4 bought from Ashmark at 5.1".

## 5. Gaps

- HoI4 war support losses from bombing, convoys and casualties: exist in game, no numbers on the
  wiki (unconfirmed).
- HoI4 daily ideology drift, civil war stability threshold: not on the wiki (unconfirmed).
- EU4 rebel uprising threshold and progress formula, vassal tribute rate, initial loan term: not on
  the wiki pages read (unconfirmed).
- EU4 devastation's goods penalty: -2% per point on the Devastation page, -1% per point on the
  Trade goods page; we use our own 1.5% per point anyway.
- HoI4 civilian factory construction output: 4 or 5 a day; the page contradicts itself.
