# After the demo: ideas and plans

*Owned by lane a. Anyone may add a line through a PR; the owner decides what gets built.*

Ideas that were parked during the hackathon (polish mode, time or frame-rate cost) so they are
not lost. Each line says where it came from. Nothing here is promised for the demo.

## World and map

- **Hill and mountain bases.** Terrain features sit on a proper base instead of floating on the hex. (#345 C)
- **Bridges where rivers cross roads.** (#345 C)
- **Rivers along hex edges.** Rivers follow the hex borders instead of straight ribbons across tiles, which look odd against the hex design. (#345 C)
- **Visible roads.** Draw the roads armies already march along (they take the cheapest terrain path; it is just not shown). (#345 C)
- **More provinces.** About 1,000 provinces, only if the frame rate allows. (#203)
- **Raise the 16-nation cap.** (#317 item 7)

## Armies and war

- **Detailed battles at close zoom** and **hill castles on high ground**, if not built for the demo. (#377)
- **Smaller groups that move separately.** An army splits into two or three groups that march to the front on their own (tanks peeling off), with a short firing animation when they attack. Medium change to the army code with a frame-rate cost; individual soldiers shooting each other is not proposed. (#345 B)

## Nations and people

- **A custom leader** with a family, heirs and coup odds. (#317 item 6)
- **Districts and farmers** inside provinces. (#203, decisions 14 Nov 19:05)

## Science, economy and espionage (Justin, 15 Nov, #377)

A deeper simulation, so a Cold War style story (a space race, spies, an arms race) can play out on its own.

- **Research that each nation runs by itself.** A research budget and fields (farming, metallurgy, engines, rocketry, computing) instead of ages unlocked only by the calendar. Progress has a seeded random element, and is pushed by wars (military research speeds up), trade (ideas travel along trade routes) and wealth.
- **Mining and resources that matter.** Ore, oil and uranium (already goods in the sim) gate what a nation can build: no rockets without fuel and metals, no nuclear age without uranium. Deposits run out; new ones are found by survey.
- **Imports and supply chains.** A nation without a resource buys it, or goes to war for it; blockades and wars cut supplies.
- **Espionage.** Spies steal research documents (a rival jumps ahead), sabotage factories, or are caught and spark incidents.
- **A space race.** Rival nations compete for firsts (first satellite, first crewed flight, a moon landing) with prestige for the winner; the satellites already launched from the modern age (#358) are the start.
- **Prisoners of war and defectors.** Captured soldiers and scientists who change sides carry research with them.
- **Farms and factories that are built, not only shown.** Nations choose where to build farms, mines and factories by terrain and need; output feeds food, industry and research, and shows on the globe as fields, mines and smoke stacks.
- **Where people come from.** Migration between nations (refugees from wars, workers to rich cities) changes population and unrest.

## Demo and tooling

- **One-click demo run.** A scripted run that plays the whole two-minute story on one button. (#317 item 4)
- **Sung anthems in the team's own voices.** Built and kept on local branch `a/sung-anthems`; the owner chose the generic singer for the demo.
