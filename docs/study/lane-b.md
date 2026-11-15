# Lane b study sheet: the globe and the economy

For [name B] (CutGrass88) before judging. Read it top to bottom once, then drill sections 1, 2
and 7. Every claim here was checked against the code on 15 Nov (main at `85a4360`); file paths
are there so you can open the code if a judge asks to see it. `G/` means `web/src/globe/`.

**Who built what (say it this way).** Lane b built **the globe**: the planet, map modes, units,
towns, wonders, war effects, payment arcs, sky and camera. The **Solana bridge** (genesis,
settling, wallets in `server/src/chain/`) was first built by lane a and **handed to lane b on
14 Nov**; lane b then built the goods market, token accounts for nations founded later, memos
naming both sides, clickable arcs and the confirmation seal. Say "I built the globe and took
over the economy", not "I wrote the Solana code from scratch".

---

## 1. Your 35 seconds (from `docs/submission.md` section 3)

**0:45 to 1:05** "I built the globe: 1,200 provinces, 100 models, ten years a second. Every
payment between nations is a real Solana transfer signed by the paying nation, reason in the
memo, supply fixed, mint authority revoked."
Do: gears to 10 years a second for 3 s, back down; click a gold payment arc; the Explorer page
opens (Success, devnet, memo); come back.

**1:05 to 1:20** "Ages run from bows to starships. In a late war a rival's satellite can be shot
down, and the chronicle says so."
Do: press 1 to 6 for map modes (show 2); open the satellite shot-down in the chronicle if one
happened. Dropped first if the demo runs long.

**Optional instead of 1:05** (only if seen on the prepared world): "Nations now build ports and
fight at sea. A port opens a sea trade route, and the goods they trade are settled in signed
payments."

Every number in these lines is true: 1,200 is `DEFAULT_PROVINCES` (`packages/shared/src/sim/worldgen.ts:31`);
there are 132 `.glb` models in `web/public/models`; the top gear is "10 years/s"
(`web/src/hud/SpeedControl.tsx`). **Careful:** payments are real devnet transfers only when the
server runs with `SOLANA_MODE=devnet` (the demo does). In mock mode they are fake signatures and
arcs say "Simulated payment".

---

## 2. The globe in six sentences (memorise this)

1. The planet is a **spherical Voronoi diagram**: 1,200 points on a Fibonacci spiral, jittered,
   then a 3D convex hull gives the Delaunay triangulation and its dual gives the province cells.
2. Each province is a raised prism (height from elevation, mountains and hills higher), coloured
   by a per-vertex colour that is **rewritten only for tiles that changed**.
3. Everything repeated (trees, towns, buildings, units, rocks, shells) is drawn with **GPU
   instancing**, so a thousand trees cost one draw call per tree shape.
4. The browser holds its own copy of the world, applies the same events as the server, and the
   globe reads it **at most ten times a second**, not every frame.
5. Map modes (keys 1 to 6) only repaint the vertex colours, with a 0.4 s crossfade.
6. Payments between nations are gold great-circle arcs; clicking one opens the real Solana
   transaction in the Explorer.

---

## 3. The globe, part by part

### 3.1 Provinces (the planet mesh)
- **Algorithm:** Fibonacci (golden-angle) lattice on a sphere, jitter 0.4, convex hull with the
  `quickhull3d` library = spherical Delaunay triangulation; each cell's corners are the
  circumcentres of its triangles = spherical Voronoi. `packages/shared/src/sphere.ts`.
- **Deterministic:** same count and seed give the same planet (seeded mulberry32 RNG), so the
  server and every browser build the identical world without sending geometry.
- **Not hexagons:** mostly six-sided, some five and seven; irregular on purpose so it looks natural.
- **Scale:** 1,200 by default. It was 500; 1,500 broke the frame and tick budget (comment at
  `worldgen.ts:29-30`). Complexity: O(n log n) hull, O(n) cells, built once.
- **Heights:** sea 0.992, land 1.0 + elevation x 0.045, mountains +0.015, hills +0.0075
  (`G/mesh/buildProvinceMesh.ts:27-33`, `G/constants.ts`). Small steps become slopes, big ones
  cliffs with rock walls.
- **The crack fix:** where three tiles of different heights meet, walls drop to the lowest ground
  at that shared corner (`cornerFloor`), and small filler triangles close the wedges, so you never
  see through the planet (#381, #406).

### 3.2 Colour and map modes
- Keys **1 political, 2 terrain, 3 diplomacy, 4 strength, 5 wealth, 6 politics**
  (`web/src/hud/TopBar.tsx:12`, handler in `web/src/App.tsx:38-49`).
- Political blends terrain toward the nation colour; diplomacy needs a selected nation and colours
  everyone by stance to it; strength and wealth are colour ramps; politics shows each nation's
  political axis. Rules in `G/mesh/colors.ts`.
- `G/colorFx.ts` keeps the colour buffer and **repaints only changed tiles**. A full repaint
  happens only on a mode, selection or politics change; otherwise only tiles in `tile_claimed`
  events. 0.4 s crossfade, 0.8 s pulse when a tile changes owner. War damage (scorch) shows in
  every mode except terrain.

### 3.3 Performance (what makes 1,200 provinces smooth)
- **Instancing everywhere** (`InstancedMesh`): buildings one per model part
  (`G/structures/StructureField.ts`), trees by kind (`Trees.ts`), close-up towns about 12 draw
  calls in total, ports 4, terrain detail 12 shapes / 12 draw calls / about 2,900 instances,
  shells 3, units one per model part.
- **Reads the world at most 10 times a second** (`WORLD_SYNC_S = 0.1`, `G/constants.ts`); panels
  4 times a second; all screen-label layout shares one 100 ms clock.
- **Pixel ratio capped** at 1.5 (`Globe.tsx`), **LOD**: towns and close-up life hidden beyond
  camera distance 2.0 (`G/pip/pipLod.ts`). Screenshots are encoded in a Web Worker so the GPU
  never stalls.
- **Measured** (production build, RTX laptop, `docs/demo.md` and the lane a handoff): about 150 fps
  in orbit, 130 at ground level, 140 to 210 fps at one season a second, about 50 fps at the top
  gear. About 400 draw calls in the main view.

### 3.4 Units and war (`G/units/`, `G/war/`)
- Counters are small canvas-drawn chips: flag, an icon for the tech age, the strength number
  (`units/draw.ts`). Ages: spear, sword, musket, rifle, tank, drone, starship. Fleets get a ship.
- **Declutter:** same-nation counters within 24 px merge (strengths added); other overlaps lift up
  to 4 slots; checked every 150 ms; counters fade behind hills (`units/UnitLayer.ts`). Units rest
  beside buildings, never inside them (`restSpots.ts`).
- Up close, each counter stands on a 3D formation of 3 to 7 figures by age (`formation.ts`),
  with procedural walk, recoil and topple (`motion.ts`, no extra draw calls).
- **Firing** (`war/Firing.tsx`): up to 12 armies firing, a volley every 0.6 to 1 s from 56 pooled
  shells; arrows, trebuchets, cannon, artillery, drones, orbital beams by age. Status pill over a
  fighting army says what it is doing (#356).
- **Sea battles** (lane a, #372): broadsides, splashes, ships that roll over and sink in 2.8 s.

### 3.5 Towns, buildings, wonders, trees
- 132 `.glb` models under `web/public/models`, loaded once from `manifest.json`; a missing file
  becomes a box so the demo never breaks (`G/structures/models.ts`). Each nation has a building
  style (classical, desert, east asian, egyptian, medieval, mesoamerican ...) that changes by age.
- Close-up towns are **procedural**: a seeded street grid on the tile top (`G/towns/buildTown.ts`,
  pure function: same id, same town). They restyle by age in a wave out from the capital.
- Wonders: scaffolding and dust while built, a gilt beam when done; the Great Wall is a ribbon
  along the border (`G/wonders/`). Trees: eight kinds by climate (lane a remodelled, #374).

### 3.6 Sky and camera
- **Camera** (`G/camera/CameraRig.tsx`): orbit, smooth zoom, fly-to; zooming in tilts into a
  ground view. `propScan.ts` scans nearby trees and buildings 4 times a second (1.9 ms) so the
  camera floor never enters a prop (#360).
- **Sun glare hidden by land** (#360, `G/celestial/Celestial.tsx`): a **ray march** from the camera
  toward the sun, 48 samples against the real tile and prop heights; the smallest clearance angle
  fades the corona, starburst and lens ghosts. Also day/night lighting, night city lights, a moon.
- **Clouds** (`G/clouds/Clouds.tsx`): a volumetric ray march through a thin shell with a second
  sample toward the sun for self-shadow, drawn at low resolution and composited. Weather is a pure
  function of seed and time, so every viewer sees the same sky. Clouds part when the camera flies
  low.
- **Satellites** (`G/orbit/`): modern-age nations launch rockets that put satellites on tilted
  rings; in a war one can be shot down (`satellite_lost` event, `packages/shared/src/sim/rules.ts:610-615`):
  streak from the attacker's capital, flash, debris, plus a chronicle line.
- **Before a world exists** the real Earth turns behind the Create screen, built from the same
  tiles using Natural Earth coastlines (`G/earth/`, lane a #404).

---

## 4. The economy and the Solana bridge

### 4.1 Money in the simulation
- Each year a nation earns from its land (plains 0.9 a tile, mountains 0.35, ice 0.1), its
  buildings and wonders, minus army upkeep (`packages/shared/src/sim/rules.ts`).
- **Payments** (`sim/payments.ts`, `sim/war.ts`): each nation pays only from its own treasury,
  decided on its own copy of the world from shared data and seeded hashes.
  - **Goods market bills:** every 5 years a buyer pays each seller one bill for goods it bought
    ("6 grain, 2 ore"), at most 15% of its treasury, bills under 8 skipped. (Lane b, B11.)
  - **Reparations:** the year after a peace, the side that lost ground pays 15% plus 5% per lost
    province, at most 40%.
  - **Plunder:** a sacked town 7%, a city 12%, a fallen capital 30% (70% if the nation falls).
  - **Allies:** war chest 12%, pooled funds 20%, subsidies 10%.
  - **Trade ships** add a bonus to the treasury on docking. That is **not** a payment and not on
    chain.
- **Money is conserved:** a payment is clamped to what the payer has and moved, never created.
  `server/scripts/check-money.ts` runs 600 ticks and prints MONEY CONSERVED.

### 4.2 The Solana bridge (`server/src/chain/`)
- **Modes:** `SOLANA_MODE` = `off`, `mock` (default: fake signatures, no network) or `devnet`.
- **Genesis** (`genesis.ts`): a Token-2022 token "<World> Crown", symbol **TNC**, 2 decimals,
  metadata on chain. One token account per nation plus the **Commons**, each requiring a memo on
  incoming transfers. **1,000,000** minted (10,000 per nation, the rest to the Commons), then the
  **mint authority set to null**: nobody can ever print more.
- **Wallets** (`wallets.ts`): each nation has its own keypair file, kept outside the repo
  (`~/.config/durhack/solana`), up to 12 nations. The paying nation **signs its own transfer**.
- **The Commons** pays every fee, so only one wallet needs devnet SOL.
- **Settling** (`index.ts`, `settle.ts`): payments queue; every **5 s** they are **netted per
  (payer, payee)**; each pair becomes one transaction: memo + `TransferChecked` signed by the payer
  (plus a Commons advance if the payer's on-chain float is short). At most **4 transactions per
  window**, sent one at a time; confirmed by polling `getSignatureStatuses` every 2 s.
- **Memo:** `TN <row id> y<year> <payer> pays <payee> <amount> TNC, <reason>: <note>`.
- **Rate limits:** on 429 or a network error, back off 2 s, 4 s, 8 s ... up to 60 s, honouring
  `Retry-After`. 5 failed windows in a row pause sending for 30 s; rows stay queued and show as
  pending. **The simulation never waits for the chain.**
- **No double payment:** a signed transaction is resent unchanged (same signature); it is only
  rebuilt if its blockhash expired and the signature is nowhere in history.
- **Honesty check:** each nation's ledger (float + received - paid + advances) is compared with
  its on-chain balance. The 14 Nov devnet test: drift 0, 67 payments in 43 transactions.
- **Replays** send nothing; a sidecar `server/replays/<id>.ledger.json` keeps the real signatures.

### 4.3 What the screen shows
- **Gold arcs** between capitals (`G/trade/Trade.tsx`), lifted by the angle between them, labelled
  "<amount> TNC . <note>", for 6 s. Click = the Explorer page (`window.open`). A **red wax seal**
  lands on the arc when the transfer is confirmed (`ChainSeal.tsx`, #285). Gold coin bursts for
  plunder (`CoinBurst.tsx`).
- Trade routes: dashed pale gold = trade pact, solid gold = alliance (`Routes.tsx`).
- Network panel: "TNC N paid", mock or devnet chip, online dot, pending count
  (`web/src/ui/economy/EconomyCounter.tsx`); the ledger tab lists rows with Explorer links.
- Map mode 5 (wealth) colours nations by treasury.

---

## 5. Named techniques (if a judge asks "what algorithms?")

| Technique | Where |
| --- | --- |
| Fibonacci sphere sampling, convex hull = spherical Delaunay, dual = spherical Voronoi | `packages/shared/src/sphere.ts` |
| Seeded deterministic RNG (mulberry32): same seed, same world, exact replays | shared sim |
| GPU instancing with per-instance colour; pooled particles, nothing allocated per frame | `G/structures`, `G/units`, `G/war` |
| Dirty-tile vertex colour repaint with crossfade | `G/colorFx.ts` |
| Ray marching: sun occlusion (48 steps, min clearance angle, smoothstep) and volumetric clouds | `G/celestial/Celestial.tsx`, `G/clouds/Clouds.tsx` |
| Great-circle arcs | `G/trade/Trade.tsx`, `Routes.tsx` |
| Screen-space declutter (merge within 24 px, lift overlaps) | `G/units/UnitLayer.ts` |
| Netting, batching, exponential backoff with Retry-After, circuit breaker | `server/src/chain/index.ts`, `settle.ts` |
| Event sourcing: browser applies the same events as the server (`applyEvent`) | `packages/shared/src/world.ts` |

---

## 6. Problems we hit (pick one or two when asked "what was hardest?")

1. **Devnet honesty** (#171 to #180). The first design mirrored every treasury to the chain every
   10 s: it hit 429 rate limits, dropped WebSockets, failed compute estimates and drifted by over
   1,000 coins. Fix: only real transfers go on chain, each nation gets a float, the Commons
   advances shortfalls, payments are netted per pair per window with fixed compute units, HTTP
   polling and backoff. Drift went to 0.
2. **Money vanishing** (#165). A nation's update event carried an absolute treasury that
   overwrote payments applied earlier in the same tick. Fix: payments apply last and are clamped;
   a 600-tick script proves money is conserved.
3. **The tab froze** (#249, fixed in #255). Stacking payment-arc labels looped forever because a
   fractional pixel made a 24 px gap round to just under 24. Fix: whole pixels and a bounded loop;
   the same PR made the server survive socket and chain faults.
4. **Sun shining through mountains** (#360, this morning's lane b fix). The lens flare showed
   through land; now a ray march against real tile heights hides it.

---

## 7. Your judge Q&A (short, true answers)

1. *How does it run 1,200 provinces smoothly?* Instancing, repainting only changed tiles, reading
   the world ten times a second, a capped pixel ratio and hiding close-up detail from orbit.
2. *Does it hold 60 fps?* Yes in orbit at normal speeds (about 150 fps on the demo laptop). At the
   top gear, ten years a second, it drops to about 50; most of that is draw calls, and we say so.
3. *Is the Solana payment real?* Yes on devnet: a Token-2022 transfer plus a memo, signed by the
   paying nation's own key. Click an arc and the Explorer opens.
4. *Why isn't the treasury itself on chain?* The simulation is the source of truth; the chain
   mirrors payments every 5 seconds. Replays stay exact and the game never waits on the network.
5. *What stops someone printing money?* Supply fixed at 1,000,000 and the mint authority revoked
   at genesis; it is visible on the Explorer.
6. *Devnet rate limits?* Netted 5-second windows, at most 4 transactions per window, polling, and
   backoff that honours Retry-After; the overflow waits for the next window.
7. *What if devnet is down?* Payments stay queued and show pending; after 5 failed windows sending
   pauses 30 s. The world keeps running.
8. *Who pays the fees?* One Commons wallet, so only it needs devnet SOL.
9. *Are armies and satellites decoration?* No: they are drawn from simulation state, so a bigger
   army or a launch is a real event; a shoot-down writes a chronicle line.
10. *Why Voronoi, not a hex grid?* A hex grid cannot cover a sphere without distortion; a
    Voronoi on a Fibonacci sphere gives even, natural-looking provinces of similar size.
11. *How do all browsers see the same world?* Same seed builds the same planet; the browser applies
    the same events as the server; weather, towns and rest spots are pure functions of the world.
12. *Where did the models come from?* 132 GLB models for buildings, units and wonders, plus code-
    built terrain shapes; the team built and remodelled several in Blender.
13. *How did you use AI tools?* Claude Code agents built most code from our plans, in parallel, one
    lane each, talking across laptops through GitHub issues; every change went through a PR and a
    smoke gate. Sessions are recorded with Entire.

---

## 8. Honest limits (judges reward saying these first)

- The top gear does not hold 60 fps.
- Only payments between nations go on chain, not income; on-chain balances are a ledger mirror.
- Mock mode shows fake signatures, no Explorer link and no seal. Devnet can reset, which breaks
  old Explorer links. Up to 12 nations have wallets.
- The saved replay `demo-1` predates payments, so the offline fallback shows no ledger.
- Everything runs in one process on one laptop; the "network" is a switch on the message bus.

## 9. If the demo breaks

- Explorer page won't load: show `docs/shots/solana-devnet-payment.jpg`.
- Top gear stutters: drop back a gear and keep talking; screenshot `docs/shots/gears-10y.jpg`.
- No satellite shot down yet: skip that beat (it is the first one cut) or show
  `docs/shots/satellite-strike.jpg`.
- Everything broken: the owner loads replay `demo-1` (Ctrl+Shift+R after choosing it).
