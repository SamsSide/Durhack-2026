# Lane b: CP2 hand-test suite (globe and economy)

For CutGrass88. About 40 minutes. Tests are ordered by demo importance: if time runs out, stop at the end of a part, not in the middle. Tick each box; write `FAIL: <what you saw>` next to anything wrong and open an issue.

## Setup

- **Mock run (parts A to E, G):** `npm install --silent`, then `npm run mock`. Open http://localhost:5173 in the debug Chrome. No API calls, no cost.
- **Devnet run (part F only):** stop the mock, then `SOLANA_MODE=devnet npm run dev`. The Commons wallet on this laptop is already funded. Watch the server log for `chain:` lines.
- **Live run (part H):** the owner's laptop, `LLM_MODE=live` with the Gemini key. Shared budget: one rehearsal only.
- **Window size:** the main layout is judged at 1440x900. In Chrome devtools use Device toolbar, Responsive, 1440 x 900.
- **Map mode keys:** 1 Political, 2 Terrain, 3 Diplomacy, 4 Strength, 5 Wealth (6 Politics once B11-5 lands). Keys do nothing while typing in a box.
- **Other keys:** S spotlight tour, End closing card, Home on the speed control = slowest gear, ArrowRight = next gear, Q and E turn at close zoom.
- **Dev helpers (browser console):**
  - `__councilDemo(0)` plays a fake ruler death and succession for nation 0 (select nation 0 first).
  - `__wonderDemo(0, 'pyramid')` puts a wonder in nation 0 (kinds: pyramid and the other wonder names in `web/src/globe/wonders/store.ts`).
  - `__shootingStar()` fires a shooting star now.
  - `__econDemo` may not exist yet. If `typeof __econDemo` is `undefined`, skip the steps marked (econDemo) and wait for a payment or sack in the running world instead.
  - Fly to a nation: `(await import('/src/state/world.ts')).useWorld.getState().flyTo(0)`.

---

## Part A: Globe basics (about 6 min)

### A1. Camera: orbit, zoom, select
1. Reload the page. Drag with the left mouse button on the planet.
2. Scroll the wheel out to the whole planet, then in to a few tiles.
3. Click a nation, then click empty ocean.
- Expect: orbit is smooth and has no jump; zoom is smooth from whole planet to a few tiles; the nation gets a glowing border and the card docks on the right; clicking ocean deselects and the card slides out.
- [ ] pass

### A2. Map modes 1 to 5 (and 6)
1. Press 1, 2, 3, 4, 5 in turn, pausing 3 s on each.
2. Click the matching buttons in the top bar, in the same order.
3. If a Politics button or key 6 exists: press 6 and run a war through (speed up); colours shift red, gold, black by radicalism.
- Expect: 1 nations in their colours; 2 terrain with the effects legend that fits its panel; 3 diplomacy with its legend; 4 strength colours; 5 bronze to gold with the Wealth legend. Button highlight follows the key. No flicker or blank globe on any switch.
- [ ] pass

### A3. Labels
1. Zoom fully out. Read every nation name.
2. Rotate the globe: far-side names disappear.
3. Zoom in slowly: names fade with zoom; flags sit by the names.
- Expect: names are dark and readable on red and gold land, lifted, curved along the nation, never clipped; none draws over the card, network panel or feed.
- [ ] pass

### A4. Minimap click-to-turn
1. Find the minimap. Click a spot far from the current view.
2. Click inside a nation.
- Expect: the globe turns smoothly to the clicked place; wonders and the current view show on the minimap.
- [ ] pass

### A5. 1440x900 and 1283x700 layout
1. Set the window to 1440x900. Open the Network panel, select a nation, open the chronicle timeline.
2. Repeat at 1283x700.
- Expect: wordmark, YEAR box, NEW WORLD button and the token meter are fully visible; nothing scrolls; the timeline hides the diplomacy legend and the decree box; no panel overlaps another.
- [ ] pass

### A6. Speed control and calendar
1. Press Home on the speed control: 1 month a second. Watch the calendar plate.
2. Press ArrowRight a few times up to the fastest gear. Use Pause.
- Expect: the calendar counts months and days; armies glide the whole move at slow gears; faster gears are faster; pause freezes everything.
- [ ] pass

## Part B: Buildings, towns, wonders, council (about 5 min)

### B1. Towns and buildings
1. Fly to nation 0's capital and scroll in to about 1.6 and then closer.
2. Watch a build or upgrade happen (speed up if needed).
- Expect: towns fade in from about 1.85 with street grid, houses and walls; a capital has a fort and temple; two nations' cities differ in colour and style; builds pop up, ruins look burnt.
- [ ] pass

### B2. Ground view (close tilt, #218)
1. Fly to a walled capital. Scroll all the way in.
2. Drag to pan, press Q and E to turn, then fly to another nation.
- Expect: top-down, then a smooth tilt to a side view of walls and keep with sky above; stars only above the horizon; the camera never goes under the land; fly-to returns to north-up orbit.
- [ ] pass

### B3. Wonders
1. Console: `__wonderDemo(0,'pyramid')`, then fly to nation 0.
- Expect: the pyramid sits inside one province, about 1.3x a capital, with scaffolding then a reveal. A Great Wall follows borders at wall height. Hover shows a tooltip (once #globe-readability lands, tooltips also on buildings and shields).
- [ ] pass

### B4. Council shields and tooltips
1. Select nation 0. Console: `__councilDemo(0)`.
2. Hover each council shield and the wonder.
- Expect: banner at once, seal at about 11 s, pips while the nation is selected, mourning then succession; shields are big plated marks; tooltips name the member and state (after #globe-readability).
- [ ] pass

## Part C: War, ripple, crumble, units (about 7 min)

### C1. War effects
1. In the mock, speed up until a war starts. Zoom to the front, then to orbit.
- Expect: army counters with strength; march arrows; battle volleys and flashes; smoke on captured tiles; a front line between the warring nations visible from orbit; counters do not badly overlap (known: some overlap remains).
- [ ] pass

### C2. Return ripple
1. Open the Network panel, Cut a nation, wait for its ring, then Restore it.
- Expect: a ripple runs out from the nation when it returns; the ring disappears.
- [ ] pass

### C3. Collapse crumble
1. Wait for or provoke a nation falling (mock emits falls; if none appears in 3 min, note it and move on).
- Expect: the fallen nation crumbles to ruins, with dispute and collapse flashes; its land shows ruins afterward.
- [ ] pass

### C4. Units and vehicle effects
1. Zoom close to an army and a fleet. Then zoom out.
- Expect: ships leave a white V-wake, armies kick up tan dust; later ages show different unit models (jets flame and contrail, tanks smoke, satellites in the stellar age); effects vanish when zoomed out; units face their march direction; trader ships dock.
- [ ] pass

### C5. Event beacons and spotlight
1. Press S. Let it tour. Press S again.
- Expect: beacons at big moments with captions that never overlap (max 2); the tour flies between events and stops on the second press.
- [ ] pass

## Part D: Sun, moon, day and night, sky (about 5 min)

### D1. Day and night
1. Zoom out. Watch for 2 minutes (the cycle is 120 s).
- Expect: a lit side and a readable dimmer night side; the terminator sweeps; city lights on the night side; selection outline, labels and clouds readable at night. A starburst flare and warm rim when the sun crosses behind the limb.
- [ ] pass

### D2. Moon
1. Zoomed out, wait up to 80 s.
- Expect: a grey cratered moon passes across the stars every about 76 s, sometimes behind the planet; zoom in and it is gone.
- [ ] pass

### D3. Sky
1. Zoomed out, look beside the planet; console `__shootingStar()`.
- Expect: dense stars, three faint violet, teal and rose clouds, a shooting star on demand and every 6 to 15 s. No black patch (the nebula shader once failed to compile; check the console for GLSL errors).
- [ ] pass

### D4. Close-zoom yellow fan (#193)
1. Zoom to the closest zoom over ocean, then over land. Orbit all the way round so the sun is at every angle.
2. Zoom from 1.4 down to closest and watch the limb rim.
- Expect: NO bright yellow or cyan fan or wedge at any angle; the rim fades smoothly with no pop; at default view the sun and orange glow look normal and the ghost rings are barely visible.
- [ ] pass

## Part E: Network panel as seen on the globe (about 3 min)

### E1. Cut, restore, show beliefs
1. Open the Network panel. Press Cut on a nation. Look at the globe.
2. Press Restore.
3. Select a nation, flip Show beliefs.
- Expect: cut shows a static ring and "signal lost" styling on the globe; autopilot shows its marker; Restore clears them with the ripple (C2); Show beliefs shows the belief banner and recolours the globe by what that nation believes; flipping it off restores the normal map.
- [ ] pass

### E2. Closing card count-up
1. Press End (or click the token meter).
2. Press Escape.
- Expect: the closing card opens, the calls and token totals count up smoothly (with live tokens in part H they should be non-zero and match the top bar), and the sim pauses behind it and resumes on close.
- [ ] pass

## Part F: Economy (about 10 min, devnet)

Stop the mock. Run `SOLANA_MODE=devnet npm run dev`. Open http://localhost:5173.

### F1. Devnet payments appear
1. Wait for payment arcs. Open the ledger panel.
- Expect: server log shows `chain:` lines and no error; ledger rows go queued then confirmed with a signature.
- [ ] pass

### F2. Click a gold arc to Explorer (the 15 second beat)
1. When an arc lands, it dims and stays about 6 s with a label such as `18.40 TNC · grain for timber`. Hover it.
2. Click the arc (or its label). Time it.
- Expect: pointer becomes a hand and the arc brightens; a new tab opens on Solana Explorer, devnet, and the memo reads like `TN <id> y<year> Valdoria pays Karsk 12.5 TNC, reason: note`, naming BOTH nations. Under 15 s from arc to memo. Clicking does not select a nation. (In mock the click opens nothing; that is correct.)
- [ ] pass

### F3. Trade ribbons
1. Zoom out. Press 2 (terrain), then 1.
- Expect: a dashed pale-gold ribbon joins each pair of trading capitals; a solid gold one joins allies; terrain mode hides them, Political shows them again.
- [ ] pass

### F4. Coin bursts
1. Wait for a city to be sacked or a capital to fall (speed up; (econDemo) if the helper exists).
- Expect: 12 to 20 gold coins spring from it, arc and fall within about 1.2 s, then vanish. With reduced motion on, a single flash instead.
- [ ] pass

### F5. Wealth map and legend
1. Press 5. Read the legend. Wait for a seizure or plunder, then look again.
- Expect: bronze to bright gold by treasury, richest nation brightest, unclaimed land grey; legend shows poor to rich with end values; after a seizure the winner brightens and the loser dims. The top bar still fits at 1440x900 and 1283x700.
- [ ] pass

### F6. Late-founded nation opens its token account
1. Play until a secession founds a new nation (nation ids 0 to 11 have key files). Wait 10 s.
- Expect: the server log says `chain: opened the token account of <name>`; its ledger row has a signature; Explorer shows `TN open <name>`, then its payments with memos naming both sides. No row stays confirmed without a signature.
- [ ] pass

### F7. Economy depth (B11)
1. In mock or devnet, speed up through a war. Select a nation and read its card.
- Expect: burnt (devastated) tiles at the front; a red readiness ring at the capital once mobilised; trade rows with notes like `6 grain, 2 ore`; no console errors. Mark "not built yet" for any piece that has not landed (B11-5 globe, B11-6 card) rather than FAIL.
- [ ] pass

## Part G: Final look (about 2 min)

### G1. One clean run
1. Reload with `npm run mock`. Leave it 3 minutes at the default view, then select one nation and zoom to its capital.
- Expect: frame rate feels steady, no console errors, no overlapping tags on the card, network panel or feed.
- [ ] pass

## Part H: LIVE GEMINI reminder (before CP2, owner's laptop)

The demo must run with `LLM_MODE=live`. The default is mock.

### H1. Live rehearsal
1. On the owner's laptop, put the Gemini key in `.env` and start with `LLM_MODE=live npm run dev`. Open the app.
2. Look at the top bar token meter.
3. Run one full rehearsal of the demo script (a few minutes only; the budget is shared).
- Expect: the meter says Live (not Mock, not Capped), calls and tokens rise over time; nations act and the chronicle shows real prose; closing card (E2) shows the live totals counting up. Models to name in the submission: gemini-3.5-flash-lite (ruler, bible) and gemini-3.5-flash (lore), with the token budget.
- [ ] pass

---

Total: 30 tests (A 6, B 4, C 5, D 4, E 2, F 7, G 1, H 1).
