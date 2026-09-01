# Wiki map 04 — World, ports, economy and large-scale events (Emerald ocean)

The Emerald ocean is a fixed grid of league points; some of those points carry an island, and a ship travels by charting a path of adjacent points at roughly one to five minutes per point. Islands are the only places where anything economic happens: each colonized island spawns two or three raw commodities on a demand-driven schedule, sells them through a bid-ticket market, and hosts up to seven kinds of shoppe that turn commodities plus player labour hours into refined and finished goods (rum, cannon balls, cloth, clothing, furniture, ships). Pieces of eight enter the world almost entirely as booty from computer-controlled brigand and barbarian ships met between league points, and leave it through market fees, sales tax, weekly building rent and doubloon-exchange fees; doubloons are a second currency bought with real money and burned on delivery fees and badges. On top of that steady loop sit the large-scale events: brigand-king flotillas parked on league points, blockades that transfer island ownership between player flags, expeditions bought or won as one-shot map items, and sea monster hunts that are separate multi-ship battle boards reached with decaying maps. All wiki content below is recorded as data; no page fetched contained anything that read as an instruction to the agent.

## World map model — grid, league points, routes, travel

### Source

https://yppedia.puzzlepirates.com/League_point, /Archipelago, /Chart, /Yer_known_world, /Ship, /Port, /Ferry, /Home, /Ship_spawn

### What it is

The ocean is a graph of "league points" laid out in an offset (hex-like) grid. Edges between adjacent points are "leagues". A subset of points carry islands. Travel is: chart a path of league points from the current island/point to a destination island, then sail it.

### Mechanics

- The grid is offset rows with no vertical connections; each point connects to its horizontal neighbours and to the diagonal neighbours in the rows above and below. Wiki ASCII: `o - o - o - o` / `\ / \ / \ /` / `  o - o - o`.
- A ship may only move between *adjacent* league points, following a charted simple path.
- Charting requires the league points to be covered by: a chart on the ship's navigation table, a chart in the charting pirate's inventory, or points the pirate has *memorized*. Memorized points render brown, chart-covered points grey; memorized takes precedence.
- Charts describe a route between two **adjacent islands**. Intra-archipelago charts are buyable at shipyards (price ~ route length); inter-archipelago charts and charts where either end has no shipyard must be pillaged or player-traded.
- Chart decay: intra-archipelago 45 days, inter-archipelago 90 days. On the nav table decay counts calendar days; in inventory it counts login days. Sea Monster Hunt maps decay in 8 calendar days. Expedition maps (Imperial outpost, Viking raid) decay in 3 days.
- Each league point has a *route difficulty* rendered as shading (darker = harder brigands spawn there). Difficulty drives both spawn rate and enemy might.
- Special/temporary league points exist for sea monster hunts (red for Atlantis, purple for Cursed Isles), flotillas (per-king icon), expeditions (X = buried treasure, sunken ship, crown = imperial outpost, viking helm, yeti footprint) and blockaded islands (red skull-and-sword node; golden cup for event blockades). Temporary points cannot be memorized.
- Archipelagos are clusters of islands; boundaries are visible as longer inter-archipelago routes, and each archipelago has a colour used to tint charts (intra = one colour, inter = colour at each end).
- Fast travel that bypasses sailing: **ferries** connect all islands *within one archipelago* that have at least one building or construction site — instant, currently free, accessed from the island's dock. **"Go home"** whisks a pirate to their set home (an inhabited island, or a house/inn/shoppe where they are owner/manager/roommate) for free. **Whisking potions** (apothecary) whisk elsewhere at a cost.
- Porting: an officer may port when the ship is resting at a league point that has an island. Porting clears the ship's might rating, allows booty division, lets pirates step on/off, and allows restocking. Ships abandoned at sea auto-port to the last visited port after 15 minutes with nobody aboard (booty lost, hold and coffers kept); a server reboot whisks ships to port and auto-divides booty.
- Porting at an island whose ruling flag you are at war with requires a bribe scaled to ship size, and is blocked entirely for attackers during that island's blockade.

### Numbers and tables

Emerald league-point counts (from the per-ocean table):

| Metric                          | Emerald |
| ------------------------------- | ------- |
| Sea league points               | 577     |
| Island league points            | 92      |
| Total league points             | 669     |
| Extinct points                  | 0       |
| Points to memorize for compass  | 67      |
| Points to memorize for spyglass | 201     |
| Points to memorize for sextant  | 402     |
| Points to memorize for globe    | 663     |

Travel speed (swabbie-crewed baseline, minutes per league point; diagonal leagues — horizontal leagues take 40% longer):

| Ship             | Min speed (min/LP) | Max speed (min/LP) | % of best |
| ---------------- | ------------------ | ------------------ | --------- |
| Sloop            | 5                  | 1:00               | 100%      |
| Cutter           | 5                  | 1:00               | 100%      |
| Dhow             | 5                  | 1:00               | 100%      |
| Fanchuan         | 5                  | 1:00               | 100%      |
| Longship         | 5                  | 1:15               | 80%       |
| Baghlah          | 5                  | 1:15               | 80%       |
| Merchant brig    | 5                  | 1:15               | 80%       |
| War brig         | 5                  | 1:15               | 80%       |
| Junk             | 5                  | 1:25               | 70%       |
| Merchant galleon | 5                  | 1:40               | 60%       |
| Xebec            | 5                  | 1:40               | 60%       |
| War galleon      | 5                  | 1:40               | 60%       |
| War frigate      | 5                  | 1:40               | 60%       |

Bribes to port at a hostile island (PoE): sloop 50; cutter/dhow/fanchuan 70; longship 90; baghlah/junk 100; merchant brig 120 (list truncates in the source at merchant brig).

### Data model implications

- `LeaguePoint { id, gridRow, gridCol, difficulty (0..1 shading), islandId?, specialType? }` with an adjacency list derived from the offset grid.
- `Route/Chart { islandA, islandB, leaguePointPath[], archipelagoColorA, archipelagoColorB, decayDays, purchasable }`.
- Per-pirate `memorizedPoints: Set<LeaguePointId>` and `visitedIslands: Set<IslandId>` drive the "Yer known world" render and the charting validity check.
- Travel is a timed traversal of the path: `duration = sum(leagueLength * shipSpeedFactor)`, where speed factor interpolates between min (5 min) and max (1:00–1:40) based on sailing/rigging performance, and horizontal edges cost 1.4x.
- Encounter rolls happen per league traversed, seeded by `point.difficulty`, voyage configuration and navigation performance.

### MVP relevance

**Core.** The grid, adjacency, charting rules and per-league travel timing are the spine of everything else. Chart decay and memorization are **phase 2**. Ferries and "go home" are **core** as quality-of-life shortcuts (they remove most tedium in single player).

## Emerald ocean islands and archipelagos

### Source

https://yppedia.puzzlepirates.com/Emerald_Ocean, https://yppedia.puzzlepirates.com/List_of_commodity_spawns (Emerald section)

### What it is

Emerald has **92 islands in 15 archipelagos**, of which **50 are colonized**. It is a doubloon ocean, formed by merging the former Sage and Hunter oceans. Sage-derived archipelagos are named after birds (Dodo, Eagle, Gull, Ibis, Osprey, Pelican, Puffin, Stork, Tern); Hunter-derived ones after astronomical features (Canis, Crab, Horse Head, Orion, Pleiades, Ursa).

### Mechanics

Each archipelago has a colour and a ferry network across its built-on islands. Capitals are marked with `*` on the wiki; colonized islands with `^`. Commodity spawns are fixed per island (the *set* is fixed; the *rate* is dynamic — see the commodity section).

### Numbers and tables

Archipelago summary:

| Archipelago | Islands | Large | Medium | Outpost | Capital            |
| ----------- | ------- | ----- | ------ | ------- | ------------------ |
| Canis       | 7       | 4     | 2      | 1       | Sirius Island      |
| Crab        | 5       | 0     | 2      | 3       | -                  |
| Dodo        | 3       | 0     | 0      | 3       | -                  |
| Eagle       | 5       | 0     | 2      | 3       | -                  |
| Gull        | 8       | 3     | 2      | 3       | Wensleydale        |
| Horse Head  | 5       | 0     | 2      | 3       | -                  |
| Ibis        | 8       | 5     | 1      | 2       | Kasidim Island     |
| Orion       | 7       | 4     | 1      | 2       | -                  |
| Osprey      | 7       | 0     | 0      | 7       | Scurvy Reef        |
| Pelican     | 9       | 3     | 2      | 4       | Greenwich Island   |
| Pleiades    | 7       | 0     | 1      | 6       | Maia Island        |
| Puffin      | 3       | 0     | 0      | 3       | -                  |
| Stork       | 8       | 5     | 1      | 2       | Wissahickon Island |
| Tern        | 3       | 0     | 0      | 3       | -                  |
| Ursa        | 7       | 4     | 1      | 2       | Alkaid Island      |

Full island list with size, capital/colonized flags and commodity spawns:

| Archipelago | Island               | Size    | Capital | Colonized | Commodity spawns                     |
| ----------- | -------------------- | ------- | ------- | --------- | ------------------------------------ |
| Canis       | Armstrong Island     | Large   | -       | yes       | cubanite, stone                      |
| Canis       | Atchafalaya Island   | Medium  | -       | -         | hemp, old man's beard                |
| Canis       | Immokalee Island     | Large   | -       | -         | hemp, iron, lily of the valley       |
| Canis       | Moultrie Island      | Large   | -       | -         | stone, sugar cane, cowslip           |
| Canis       | Sho-ke Island        | Medium  | -       | -         | sincosite, sugar cane                |
| Canis       | Sirius Island        | Large   | yes     | -         | iron, tellurium, wood                |
| Canis       | Tumult Island        | Outpost | -       | yes       | serandite, thorianite                |
| Crab        | The Beaufort Islands | Medium  | -       | -         | iron, stone                          |
| Crab        | Messier's Crown      | Outpost | -       | -         | leushite                             |
| Crab        | Nunataq Island       | Outpost | -       | -         | yarrow                               |
| Crab        | Paollu Island        | Outpost | -       | -         | papagoite, pokeweed berries, weld    |
| Crab        | Qaniit Island        | Medium  | -       | -         | hemp, sugar cane                     |
| Dodo        | Ancoraggio Island    | Outpost | -       | -         | hemp, sassafras                      |
| Dodo        | Fluke Island         | Outpost | -       | -         | cubanite                             |
| Dodo        | Kakraphoon Island    | Outpost | -       | yes       | masuyite                             |
| Eagle       | Cambium Island       | Outpost | -       | -         | elderberries, pokeweed berries       |
| Eagle       | Hubble's Eye         | Medium  | -       | yes       | iron, wood                           |
| Eagle       | Ilha da Aguia        | Medium  | -       | yes       | hemp, iron                           |
| Eagle       | Ix Chel              | Outpost | -       | yes       | iris root, chalcocite                |
| Eagle       | Manu Island          | Outpost | -       | yes       | sassafras                            |
| Gull        | Admiral Island       | Large   | -       | yes       | hemp, sugar cane                     |
| Gull        | Basset Island        | Outpost | -       | yes       | broom flower                         |
| Gull        | Bryher Island        | Outpost | -       | -         | lobelia                              |
| Gull        | Cromwell Island      | Outpost | -       | yes       | old man's beard, sugar cane          |
| Gull        | Hook Shelf           | Medium  | -       | -         | hemp, pokeweed berries, stone        |
| Gull        | Isle of Kent         | Medium  | -       | yes       | sugar cane, wood                     |
| Gull        | Lincoln Island       | Large   | -       | yes       | stone, sugar cane                    |
| Gull        | Wensleydale          | Large   | yes     | yes       | hemp, iris root, wood                |
| Horse Head  | Anegada Island       | Outpost | -       | yes       | lorandite                            |
| Horse Head  | Barnard Island       | Outpost | -       | -         | butterfly weed, papagoite            |
| Horse Head  | The Lowland Hundred  | Medium  | -       | yes       | stone, sugar cane                    |
| Horse Head  | Lyonesse Island      | Outpost | -       | -         | nettle, thorianite                   |
| Horse Head  | Myvatn Island        | Medium  | -       | -         | hemp, wood                           |
| Ibis        | Arakoua Island       | Large   | -       | yes       | hemp, iris root, stone               |
| Ibis        | Aten Island          | Large   | -       | -         | wood                                 |
| Ibis        | Barbary Island       | Large   | -       | yes       | broom flower, iron, sugar cane       |
| Ibis        | Caravanserai Island  | Large   | -       | yes       | hemp, sugar cane                     |
| Ibis        | Kasidim Island       | Medium  | yes     | yes       | old man's beard, wood                |
| Ibis        | Kiwara Island        | Outpost | -       | yes       | lobelia                              |
| Ibis        | Terjit Island        | Outpost | -       | -         | sincosite                            |
| Ibis        | Tichka Plateau       | Large   | -       | -         | hemp, iron, pokeweed berries         |
| Orion       | Aimuari Island       | Large   | -       | yes       | hemp, sugar cane                     |
| Orion       | Chachapoya Island    | Large   | -       | yes       | old man's beard, stone, sugar cane   |
| Orion       | Matariki Island      | Outpost | -       | -         | iron, tellurium                      |
| Orion       | Pukru Island         | Medium  | -       | yes       | hemp, iron                           |
| Orion       | Quetzal Island       | Large   | -       | yes       | cubanite, iron, wood                 |
| Orion       | Saiph Island         | Outpost | -       | yes       | hemp, weld                           |
| Orion       | Toba Island          | Large   | -       | -         | cowslip, stone, wood                 |
| Osprey      | Albatross Island     | Outpost | -       | yes       | serandite                            |
| Osprey      | Ambush Island        | Outpost | -       | yes       | chalcocite                           |
| Osprey      | Deadlight Dunes      | Outpost | -       | -         | papagoite                            |
| Osprey      | Gauntlet Island      | Outpost | -       | yes       | lorandite, wood                      |
| Osprey      | Jack's Last Gift     | Outpost | -       | -         | leushite                             |
| Osprey      | Mirage Island        | Outpost | -       | -         | sugar cane                           |
| Osprey      | Scurvy Reef          | Outpost | yes     | -         | butterfly weed, iron                 |
| Pelican     | Blackthorpe Island   | Medium  | -       | yes       | iron                                 |
| Pelican     | Cook Island          | Large   | -       | -         | hemp, madder, wood                   |
| Pelican     | Descartes Isle       | Large   | -       | yes       | stone, sugar cane                    |
| Pelican     | Fowler Island        | Outpost | -       | -         | elderberries                         |
| Pelican     | Greenwich Island     | Large   | yes     | yes       | cowslip, stone, wood                 |
| Pelican     | Halley Island        | Outpost | -       | yes       | tellurium                            |
| Pelican     | Spaniel Island       | Medium  | -       | yes       | nettle, sugar cane                   |
| Pelican     | Starfish Island      | Outpost | -       | -         | thorianite                           |
| Pelican     | Ventress Island      | Outpost | -       | yes       | hemp                                 |
| Pleiades    | Accompong Island     | Outpost | -       | yes       | madder, nettle                       |
| Pleiades    | Gallows Island       | Outpost | -       | yes       | serandite, thorianite                |
| Pleiades    | Iocane Island        | Outpost | -       | yes       | elderberries, pokeweed berries       |
| Pleiades    | Maia Island          | Medium  | yes     | -         | stone, wood                          |
| Pleiades    | Morgana Island       | Outpost | -       | -         | broom flower, sugar cane             |
| Pleiades    | Paihia Island        | Outpost | -       | yes       | indigo, stone                        |
| Pleiades    | Umbarten Island      | Outpost | -       | -         | masuyite                             |
| Puffin      | Auk Island           | Outpost | -       | -         | tellurium                            |
| Puffin      | Cryo Island          | Outpost | -       | yes       | yarrow                               |
| Puffin      | Hoarfrost Island     | Outpost | -       | -         | indigo                               |
| Stork       | Amity Island         | Outpost | -       | yes       | thorianite                           |
| Stork       | Bowditch Island      | Large   | -       | yes       | iron, nettle, wood                   |
| Stork       | Hinga Island         | Large   | -       | -         | sugar cane, wood                     |
| Stork       | Penobscot Island     | Outpost | -       | yes       | elderberries                         |
| Stork       | Rowes Island         | Large   | -       | -         | madder, stone, sugar cane            |
| Stork       | Scrimshaw Island     | Large   | -       | yes       | cowslip, iron, stone                 |
| Stork       | Squibnocket Island   | Large   | -       | -         | hemp, sincosite                      |
| Stork       | Wissahickon Island   | Medium  | yes     | yes       | sugar cane                           |
| Tern        | Ashkelon Arch        | Outpost | -       | yes       | iron                                 |
| Tern        | Kashgar Island       | Outpost | -       | yes       | lily of the valley, sugar cane, wood |
| Tern        | Morannon Island      | Outpost | -       | -         | iron, weld                           |
| Ursa        | Alkaid Island        | Large   | yes     | yes       | sincosite, sugar cane                |
| Ursa        | Doyle Island         | Medium  | -       | yes       | hemp, stone                          |
| Ursa        | Edgar's Choice       | Large   | -       | -         | sugar cane, wood                     |
| Ursa        | Isle of Keris        | Large   | -       | -         | iron, lily of the valley, wood       |
| Ursa        | Marlowe Island       | Outpost | -       | yes       | chalcocite                           |
| Ursa        | McGuffin's Isle      | Outpost | -       | -         | butterfly weed, pokeweed berries     |
| Ursa        | Sayers Rock          | Large   | -       | yes       | iris root, iron, stone               |

Composition check: 28 large, 17 medium, 47 outpost = 92 islands; 50 islands carry the wiki's "colonized" mark, matching the page's "fifty colonized islands". Eight islands are marked capital; three of those (Sirius, Scurvy Reef, Maia) carry the capital mark without the colonized mark on the wiki — treat capitals as colonized.

### Data model implications

- Seed data file: `islands.json` with `{ id, name, archipelago, size, isCapital, isColonized, spawnCommodities[] }` — the table above is directly usable as the seed.
- `Archipelago { name, colorHex, islandIds[] }`; ferry graph = complete graph over islands in an archipelago that have >= 1 building.
- The wiki does **not** publish the Emerald league-point coordinates or the island-to-island adjacency graph in machine-readable form (only external PDF/interactive maps). An offline recreation must author its own grid layout that places these 92 islands into 669 points with plausible archipelago clustering.

### MVP relevance

**Core** for the island list and spawn sets — this is the world's content. Exact fidelity of the *map geometry* is **phase 2**; a generated grid honouring archipelago clustering and route-difficulty gradients is enough to start.

## Island types, buildings and governance

### Source

https://yppedia.puzzlepirates.com/Island, /Island_panel, /Governor, /Colonization, /Population, /Bazaar, /Fort, /Palace, /Commodities_market, /Bank, /Estate_agent, /Explorers%27_hall, /Trading_post, /Black_market, /Tax

### What it is

Three island sizes (outpost, medium, large) define how much can be built. An island is ruled by a governor, who belongs to the island's governing flag, places all buildings and sets the tax rate.

### Mechanics

- **Outpost**: only a fort plus **one** regular shoppe. No bazaars needed, no attractions. Good restocking waypoints. On a change of ruling flag, both the shoppe and the fort change hands.
- **Medium**: all infrastructure buildings, plus up to **5** trade/housing buildings in any mix, or **6** if at least one is housing (a "trade building" is a shoppe or a bazaar). **1** attraction allowed, not counted against the limit. A bazaar of a type must exist before a shoppe of that type can be built. On flag change all buildings transfer except inns and shoppes (deeds stay with holders).
- **Large**: all infrastructure, unlimited shoppes/bazaars as space allows, **2** attraction types. Same transfer rules as medium.
- **Building order**: fort first (it claims the island and acts as a rudimentary market + palace). Bank needs a completed fort and 2 completed bazaars. Commodities market needs 2 completed bazaars. Palace = fort upgrade, and requires an estate agent and a commodities market.
- Buildings cannot be placed on commodity-spawn tiles, lava, fissure, bog, jetty/dock, cliffs, monuments, notice board, crane, fountain, mooring, rowboat, statues, well or fences; no building within 10 squares of the entry area or 1 square from water.
- **Governance**: the governor holds the deeds to fort/palace, bank, market, estate agent, bazaars, housing and construction sites (plus the single shoppe on an outpost). The palace deed carries the tax slider. Governor is set by majority vote of the ruling flag's royalty; on a blockade win the winning flag's monarch becomes governor automatically and all infrastructure deeds transfer.
- **Population** = pirates who have set the island (or a building on it) as home and have logged in within 10 days. Population scales rent. Islands need minimum infrastructure and population > 250 to spawn new players.
- **Attractions** (medium/large only, one of each type per island): **explorers' hall** (sells expedition maps/compasses), **trading post** (trinkets -> prizes), **black market** (sells black boxes at 10,000 PoE). They pay higher rent and dust one week after failing to pay.
- **Dusting**: unpaid weekly tax -> shoppe goes "dark", queued unstarted orders cancelled and escrow refunded; 4 consecutive unpaid weeks -> the building dusts and its commodities/PoE are confiscated. Stalls dust after 2 weeks.

### Numbers and tables

Weekly property tax baseline (rent at 0% governor tax and population >= 250), in PoE:

| Building type | Shoppe | Deluxe stall | Medium stall | Small stall |
| ------------- | ------ | ------------ | ------------ | ----------- |
| Tailor        | 6,750  | 5,500        | 4,250        | 3,000       |
| Iron monger   | 1,750  | 1,500        | 1,250        | 1,000       |
| Shipyard      | 6,750  | 5,500        | 4,196        | 2,891       |
| Distillery    | 1,750  | 1,500        | 1,300        | 1,000       |
| Weavery       | 3,625  | 3,000        | 2,375        | 1,750       |
| Apothecary    | 3,625  | 3,000        | 2,500        | 2,000       |
| Furnisher     | 6,750  | 5,500        | 4,167        | 3,000       |
| Fort / Palace | 5,500  | -            | -            | -           |

Attraction base tax: explorers' hall 5,000; trading post 3,000; black market 3,000 PoE per week.

Rent formula below population 250: `rent = (0.25 + 0.75 * population / 250) * baseline`.
Governor tax adds on top as a percentage of baseline, capped at **50%** on a fort island and **100%** on a palace island. Everything above baseline goes to island coffers; the baseline itself is a PoE sink.

Blockade fame requirement by island size: outpost = Noted, medium = Established, large = Renowned.
War chest minimum by size: outpost 25,000; medium 75,000; large 125,000 PoE (scaled up by the island's tax rate).

Infrastructure construction costs (labour hours and commodity units):

| Building           | Basic labour | Skilled | Expert | Iron | Stone  | Tan cloth | Wood | Doubloons |
| ------------------ | ------------ | ------- | ------ | ---- | ------ | --------- | ---- | --------- |
| Commodities market | 700          | 100     | 50     | 20   | 2,500  | 300       | 300  | 0         |
| Estate agent       | 600          | 100     | 100    | 20   | 7,500  | 60        | 160  | 0         |
| Fort               | 1,600        | 600     | 500    | 400  | 10,000 | (n/a)     | -    | 0         |
| Explorers' hall    | 400          | 250     | 200    | 80   | -      | -         | -    | 0         |

Storage: fort 500,000 kg / 2,500,000 L; palace 700,000 / 3,500,000; upgraded palace 1,000,000 / 5,000,000. Commodities market and bank have no hold.

### Data model implications

- `Island { id, size, governorPirateId?, rulingFlagId?, taxRatePercent, population, buildings[] }`.
- `Building { type, tier(bazaar/small/medium/deluxe stall | shoppe | upgraded shoppe), deedHolder, coffersPoE, hold{massKg, volumeL, items[]}, weeklyTaxDue, darkSince? }`.
- Building-slot validation is a pure function of island size + current buildings (`canPlace(type, island)`).
- Rent is a weekly tick: `charge = rentFormula(size, type, population, govTaxPct)`, drawn from coffers, else mark dark, else dust after N weeks.

### MVP relevance

**Core**: island sizes, the fort/market/shoppe trio, coffers, weekly rent. **Phase 2**: bazaars/stalls tiers, estate agent up/downgrades, attractions, building placement grid. **Deep**: governor politics, deed trading, dusting timers.

## Commodity model

### Source

https://yppedia.puzzlepirates.com/Commodity, /List_of_commodity_spawns, /Dynamic_spawn, /Herbs, /Minerals, /Cloth, /Dye, /Rum, /Cannon_ball, /Foraging

### What it is

Commodities are the only inputs to production. They cannot be held in a pirate's inventory — only in a building hold or a ship hold — and move between islands only inside a ship's hold.

### Mechanics

Three tiers:

1. **Raw** — spawned by the world at colonized islands (basic commodities, herbs, minerals) or foraged by players at *uncolonized* islands (fruit, gems, gold nuggets).
2. **Refined** — made by players from raw: ship supplies, cloth/fine cloth/sail cloth, dyes, enamels, paints, hemp oil, lacquer, varnish.
3. **Finished** — end products: clothing, furniture, ships, swords, bludgeons, cannon balls, potions.

- Raw commodities spawn only at **colonized** islands, and are sold via the market bidding system. Spawn *sets* are per-island and fixed; spawn *rates* are dynamic.
- **Dynamic spawn**: the price players actually pay changes the commodity's sales-tax value, and the tax value drives the spawn rate. Scarcity -> higher prices -> higher tax value -> (slowly) higher spawn rate -> falling prices. Inputs to the tax value are actual dockside transactions (player *and* merchant-brigand), actual bid-ticket fills (not placements), and use-cost when an order is placed; the game appears to use a trimmed mean of recent transactions. The feedback is deliberately slow.
- Island size only loosely correlates with spawn volume.
- **Merchant brigands** are the transport layer for uncolonized islands: NPC ships with exclusive access to raw commodity markets at uncolonized islands; they bulk-ship to colonized islands and sell to shoppes/stalls with the highest posted buy prices, choosing destinations by a secret formula of distance and price. They never sail back to uncolonized islands, and they stop loading from an island once it is colonized and has a fort.
- **Foraging** at uncolonized islands is the player-side raw source: fruit, gems, gold nuggets. One labour hour per container that enters the foraging board; labour is burned even if the board is abandoned with containers on it.
- **Gem thieves**: gems left unattended in a ship hold for 15 minutes are stolen outright; with 25 or more gems aboard, `stolen = floor(total / 25)` are taken at a predictable rate during transport.

### Numbers and tables

Commodity catalogue:

| Class      | Group          | Members                                                                                                                                                                                 |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw        | Basic (9)      | hemp, hemp oil, iron, kraken's ink, lacquer, stone, sugar cane, varnish, wood                                                                                                             |
| Raw        | Herbs (15)     | broom flower, butterfly weed, cowslip, elderberries, indigo, iris root, lily of the valley, lobelia, madder, nettle, old man's beard, pokeweed berries, sassafras, weld, yarrow           |
| Raw        | Minerals (11)  | chalcocite, cubanite, gold nugget, lorandite, leushite, masuyite, papagoite, serandite, sincosite, tellurium, thorianite                                                                  |
| Raw        | Fruits (10)    | bananas, carambolas, coconuts, durians, limes, mangos, passion fruit, pineapples, pomegranates, rambutan                                                                                  |
| Raw        | Gems (18)      | amber, amethyst, beryl, coral, diamonds, emeralds, jade, jasper, jet, lapis lazuli, moonstones, opals, pearls, quartz, rubies, sapphires, tigereye, topaz                                 |
| Refined    | Ship supplies  | swill, grog, fine rum, small/medium/large cannon balls, lifeboats                                                                                                                        |
| Refined    | Cloth          | 27 colours of cloth + the same 27 as fine cloth + sail cloth                                                                                                                             |
| Refined    | Dyes (5)       | blue dye, green dye, red dye, yellow dye, kraken's blood                                                                                                                                 |
| Refined    | Enamels (27)   | one per colour                                                                                                                                                                          |
| Refined    | Paints (27)    | one per colour                                                                                                                                                                          |

Only 20 of the 35 raw spawnables actually appear on Emerald islands. Emerald spawn frequency (islands producing each):

| Commodity          | Islands |
| ------------------ | ------- |
| hemp               | 21      |
| sugar cane         | 21      |
| iron               | 20      |
| stone              | 18      |
| wood               | 17      |
| old man's beard    | 4       |
| pokeweed berries   | 5       |
| thorianite         | 5       |
| sincosite          | 4       |
| tellurium          | 4       |
| elderberries       | 4       |
| serandite          | 4       |
| cubanite           | 3       |
| chalcocite         | 3       |
| butterfly weed     | 3       |
| nettle             | 3       |
| madder             | 3       |
| iris root          | 3       |
| cowslip            | 4       |
| lily of the valley | 3       |
| broom flower       | 3       |
| lobelia            | 2       |
| weld               | 3       |
| indigo             | 2       |
| papagoite          | 3       |
| lorandite          | 2       |
| leushite           | 2       |
| masuyite           | 2       |
| yarrow             | 2       |
| sassafras          | 2       |

(Counts derived from the Emerald spawn list above; treat as approximate — the wiki flags some entries as disputed.)

Sample recipes (each is one order):

| Product           | Output | Inputs                                | Basic h | Skilled h | Expert h | Shoppe      |
| ----------------- | ------ | ------------------------------------- | ------- | --------- | -------- | ----------- |
| Swill             | 10     | iron 1, sugar cane 7, wood 4          | 2       | 0         | 0        | Distillery  |
| Grog              | 10     | iron 1, sugar cane 10, wood 5         | 2       | 2         | 0        | Distillery  |
| Small cannon ball | 10     | iron 5, wood 1                        | 3       | 0         | 0        | Iron monger |
| Medium cannon ball| 10     | iron 8, wood 3                        | 3       | 2         | 0        | Iron monger |
| Large cannon ball | 10     | iron 12, wood 4                       | 3       | 2+        | -        | Iron monger |
| Blue dye          | 5      | elderberries 20                       | 4       | 2         | 0        | Apothecary  |
| Green dye         | 5      | nettle 20                             | 4       | 2         | 0        | Apothecary  |
| Red dye           | 5      | madder 20                             | 4       | 2         | 0        | Apothecary  |
| Yellow dye        | 5      | weld 20                               | 4       | 2         | 0        | Apothecary  |
| Kraken's blood    | 1      | kraken's ink 20                       | 4       | 2         | 0        | Apothecary  |
| Tan cloth         | 10     | hemp 10                               | 4       | 3         | 0        | Weavery     |
| Aqua cloth        | 10     | blue dye 1, hemp 10, sincosite 1      | 5       | 5         | 5        | Weavery     |

Rum equivalence: fine rum 100 proof, grog 60, swill 40; consumption time is proportional to proof, so 15 swill = 10 grog = 6 fine rum. Cannon ball size by ship: small (sloop, cutter, longship), medium (dhow, baghlah, merchant brig, war brig, xebec), large (fanchuan, junk, merchant galleon, war galleon, war frigate, grand frigate). Mass/volume: small CB 7.1 kg / 1 L, medium 14.2 / 2, large 21.3 / 3; cloth 0.7 kg / 1 L; dye 1 kg / 1 L; rum 1 kg / 1 L.

### Data model implications

- `Commodity { id, name, class(raw|refined|finished), group, massKg, volumeL, taxValue }` — tax value is the dynamic quantity, not price.
- `Recipe { shoppeType, outputCommodity, outputQty, inputs: [{commodity, qty}], labour: {basic, skilled, expert} }`.
- `IslandSpawn { islandId, commodityId, currentRate }` where `currentRate = f(taxValue)` on a slow EMA.
- Prices are *not* stored globally: each building posts its own buy/sell/use price. A market snapshot is the min sell / max buy across an island's buildings.

### MVP relevance

**Core**: the ~20 Emerald raw commodities, the ship-supply chain (sugar cane/wood/iron -> rum and cannon balls), and static-per-island spawn sets with a simple price-driven spawn rate. **Phase 2**: cloth/dye/enamel/paint colour matrix, fine cloth, foraging and gems. **Deep**: the full trimmed-mean tax-value simulation and merchant-brigand routing AI.

## Shoppes, stalls and the labour model

### Source

https://yppedia.puzzlepirates.com/Shoppe, /Stall, /Bazaar, /Labour, /Shoppe_management, /Shoppe_panel, /Iron_monger, /Distillery, /Weavery, /Apothecary, /Shipyard, /Tailor, /Furnisher, /Estate_agent

### What it is

A shoppe (or its smaller cousin, the bazaar stall) combines commodities with player labour hours to make products. Seven producing types plus the estate agent.

### Mechanics

- Types and outputs:
  - **Apothecary** (alchemistry puzzle): dyes, enamels, lacquer, paint, paint brushes, varnish, whisking potions, appearance-altering potions.
  - **Distillery** (distilling): swill / grog / fine rum, hemp oil, mugs.
  - **Iron monger** (blacksmithing): cannon balls, swords.
  - **Weavery** (weaving): sail cloth, coloured cloth, coloured fine cloth.
  - **Shipyard** (shipwrightery): ships, bludgeons, lifeboats. Stall size limits which hulls can be built (small stall: sloops only; medium stall up to baghlah; merchant galleon / war frigate / grand frigate need a full shoppe).
  - **Tailor**: clothing (no crafting puzzle implemented at the time of writing).
  - **Furnisher**: furniture, rowboat kits (no crafting puzzle implemented).
  - **Estate agent**: sells building upgrades/downgrades rather than goods.
- **Labour grades**: basic, skilled, expert. When a crafting puzzle is played, the puzzle *rating* sets the grade: booch -> unskilled/basic, fine -> basic, good -> basic or skilled, excellent -> skilled or expert, incredible -> expert. Shoppes without a puzzle allocate the grade by demand.
- **Labour budget**: on doubloon oceans (Emerald), each pirate with a labour badge gets 24 hours/day; with a deluxe labour badge, 72 hours/day. Subscription oceans allocate per *account* and split it across pirates. Playing a crafting puzzle session yields 2 labour hours; foraging burns 1 hour per container. Up to 24 hours of "advance" labour may be spent ahead.
- **Jobs**: a pirate can hold up to 3 shoppe jobs. Labour always flows to the highest-paying job that has work and room. Wages are paid into inventory every 12 hours (and just before reboot). A pirate is auto-fired from all jobs after 10 consecutive days logged out (later extended to 31 days).
- **Offline labour** is possible at distilleries, apothecaries, shipyards, weaveries and iron mongers if a puzzle session was played within the last 31 days. Oceanwide standing "distinguished" unlocks skilled offline labour; "renowned" unlocks expert.
- **Throughput**: each building tier has a *max labour hours consumed per hour*. Multiply by 24 for daily maximum. Labour is drawn round-robin from employees, **expert first, then skilled, then basic**, until throughput is hit or labour runs out. Regular shoppes are ~2x a deluxe stall; upgraded shoppes ~3x.
- **Order pricing** (the key economic formula):
  `Advertised price = sum(use/cost of each input commodity) + sum(charged labour rate * hours) + sales tax + owner adjustment`
  where `sales tax = sum(taxValue of each ingredient, including each labour hour)`. 90% of sales tax is sunk, 10% goes to the palace coffers; none goes to the shopkeeper.
  Worked example from the wiki: 10 tan cloth = 10 hemp @9 (90) + 4 basic labour @25 (100) + 3 skilled @30 (90) = 280, tax = 10\*0.5 + 4\*3 + 3\*4 = 29, total 309 PoE.
- **Dockside vs order**: dockside (ship-to-building) transactions are untaxed; ordering through the shoppe interface is taxed. Owners/managers can order for their own shoppe at just the tax cost (labour paid from coffers), then sell the result dockside.
- **Price controls per commodity per building**: buy price (enabled/disabled), sell price, use/cost (price charged when consumed in a recipe), min stock (stops dockside selling), max stock (stops dockside buying).
- Cancelling an order refunds escrow minus a **15% restocking fee** (waived when the building goes dark for unpaid tax).
- **Stalls vs shoppes**: shoppes have more storage, their own storefront, up to 5 managers, unique names and a tradeable deed. Small stalls have no managers, medium 1, deluxe 2. Opening a stall costs PoE (by type, island population and tax rate) plus 10 doubloons on a doubloon ocean; a pirate may hold one stall per bazaar.
- **Reserve labour**: calculated using a factor of 8 x max throughput (factor 2 for tailors).

### Numbers and tables

Max labour hours consumed per hour, and hold capacity, by type and tier:

| Shoppe type | Small stall | Medium stall | Deluxe stall | Shoppe | Upgraded shoppe | Shoppe hold (kg / L) |
| ----------- | ----------- | ------------ | ------------ | ------ | --------------- | -------------------- |
| Apothecary  | 3           | 4            | 5            | 10     | 15              | 15,000 / 75,000      |
| Distillery  | 5           | 8            | 10           | 20     | 30              | 160,000 / 800,000    |
| Furnisher   | 15          | 22           | 30           | 60     | 90              | 330,000 / 1,650,000  |
| Iron monger | 4           | 6            | 8            | 15     | 23              | 100,000 / 500,000    |
| Shipyard    | 11          | 17           | 23           | 45     | 68              | 500,000 / 2,500,000  |
| Tailor      | 4           | 6            | 8            | 15     | 23              | 30,000 / 150,000     |
| Weavery     | 4 (2/1)     | 6 (3/2)      | 8 (4/3)      | 15     | 23              | 100,000 / 500,000    |

(The weavery row shows total (skilled/expert) sub-caps; other types have equivalent sub-caps the wiki does not tabulate. The wiki's worked example: a deluxe tailoring stall polls 8 workers/hour, of whom at most 4 skilled and 3 expert; a corset needing 15 expert hours therefore takes >= 5 real hours at a deluxe stall but ~2 hours at an upgraded tailor shoppe.)

Construction costs, bazaar and shoppe (labour hours / commodity units):

| Shoppe      | Stage   | Basic | Skilled | Expert | Iron  | Stone  | Tan cloth | Wood  | Doubloons |
| ----------- | ------- | ----- | ------- | ------ | ----- | ------ | --------- | ----- | --------- |
| Apothecary  | Bazaar  | 600   | 225     | 100    | 250   | 6,000  | 140       | 180   | -         |
| Apothecary  | Basic   | 400   | 150     | 100    | 150   | 3,500  | 70        | 90    | 20        |
| Apothecary  | Upgrade | 200   | 75      | 50     | 75    | 1,750  | 35        | 45    | -         |
| Distillery  | Bazaar  | 900   | 300     | 150    | 800   | 10,000 | 180       | 300   | -         |
| Distillery  | Basic   | 600   | 200     | 150    | 500   | 6,000  | 100       | 150   | 20        |
| Distillery  | Upgrade | 300   | 100     | 75     | 250   | 3,000  | 50        | 75    | -         |
| Furnisher   | Bazaar  | 1,000 | 400     | ?      | ?     | ?      | ?         | ?     | -         |
| Furnisher   | Basic   | 800   | 300     | ?      | ?     | ?      | ?         | ?     | ?         |
| Iron monger | Bazaar  | 900   | 300     | 200    | 1,400 | 8,000  | 100       | 240   | -         |
| Iron monger | Basic   | 600   | 200     | 200    | 800   | 5,000  | 80        | 120   | 30        |
| Iron monger | Upgrade | 300   | 100     | 100    | 400   | 2,500  | 40        | 60    | -         |
| Shipyard    | Bazaar  | 2,100 | 600     | 300    | 600   | 11,000 | 300       | 1,000 | -         |
| Shipyard    | Basic   | 1,400 | 400     | 300    | 400   | 6,000  | 200       | 520   | 30        |
| Shipyard    | Upgrade | 700   | 200     | 150    | 200   | 3,000  | 100       | 260   | -         |
| Weavery     | Bazaar  | 750   | 600     | 100    | 450   | 5,000  | 180       | 200   | -         |
| Weavery     | Basic   | 500   | 400     | 100    | 300   | 3,000  | 100       | 100   | 30        |
| Weavery     | Upgrade | 250   | 200     | 50     | 150   | 1,500  | 50        | 50    | -         |

Footprints: bazaars are 6x6; iron monger and weavery shoppes 5x5, distillery 6x4, shipyard 8x6, fort/palace/market 6x7, bank 5x5.

Labour-badge break-even: 720 labour hours per 5 doubloons, so minimum viable wage `y = doubloonPriceInPoE / 144` per hour.

### Data model implications

- `ShoppeType` enum drives recipe availability, dockside-tradeable commodity whitelist, throughput table and puzzle mapping.
- `Order { buyerId, recipeId, qty, escrowPoE, progress: {basicDone, skilledDone, expertDone}, state }` — a work queue consumed by an hourly labour tick.
- Hourly tick per building: `available = min(throughput, sum(employee labour offered))`, allocated expert->skilled->basic across the head of the order queue.
- In single player the "employee pool" collapses to the player plus (optionally) simulated NPC labourers; the natural port is to keep the throughput cap and make the player's own puzzle sessions the labour source, with a wage cost still deducted for NPC labour.

### MVP relevance

**Core**: the seven shoppe types, the recipe/labour/throughput loop, order queue and escrow, and the order-price formula. **Phase 2**: stall tiers, managers, wages/employment, offline labour, reserve labour. **Deep**: labour-badge economics, employment standing gates.

## Markets: bid tickets, dockside trade and merchanting

### Source

https://yppedia.puzzlepirates.com/Market_bidding, /Commodities_market, /Dockside, /Trade, /Trading, /Merchanting, /Shoppe_management

### What it is

Two distinct trading surfaces: **market bidding** (buy newly spawned raw commodities from the island itself, via a bid queue) and **dockside** (buy/sell existing commodities against the posted prices of the island's shoppes, stalls, fort/palace).

### Mechanics

Market bidding:

- Available from a ship's hold, a stall/shoppe management menu, or from a market/fort/palace (the latter must have its taxes paid).
- The interface lists every commodity that spawns at this island with the current high bid and the volume outstanding at that bid.
- A bid is `(pricePerUnit, units)`. Spawned units are distributed to the **highest-priced bid tickets first**; once all tickets at that price are full, the next price level fills. Matching the current high price is enough to start filling at the same rate.
- Fill rate is roughly independent of ticket size (slight preference to larger tickets), so many small tickets fill faster in aggregate than one large one — but cost more in fees.
- **Fee** = 5% of total cost + max(5% of the per-unit bid price, 10 PoE), rounded up. So below a 200 PoE/unit bid the second term is a flat 10 PoE; above it, it scales, which makes large quantities cheaper per unit at high prices.
- A bid ticket sits in inventory (if bid from a market) or in the ship/building. Delivering requires being at the *original island* at a location with a hold you control. Partial delivery amends the ticket.
- Cancelling: unfilled portion refunds the cost (not the fee); a partially-filled ticket delivers what fits, splits off a new filled ticket for what doesn't, and refunds the unfilled remainder as PoE.
- Bid tickets never decay and take no storage space — filled tickets are effectively free warehousing.

Dockside:

- The "trade commodities" screen on a ship's hold (or shoppe management) shows every buy and sell offer at the island. Dockside is untaxed.
- A building only appears as a buyer/seller for a commodity if it has ticked the box and is within its min/max stock band.
- Fort/palace can post buy and sell prices for any commodity that has *ever* been in its hold.
- Trade runs = buy low at island A (bid or dockside), sail, sell high at island B. This is the intended merchant loop.
- Player-to-player `Trade` is a separate two-sided offer window with a ready-check, exchanging inventory items, PoE and (on doubloon oceans) doubloons.

### Numbers and tables

| Quantity                      | Rule                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| Bid fee, fixed part           | 5% of (bid price x units)                                          |
| Bid fee, variable part        | max(5% of bid price per unit, 10 PoE)                              |
| Fee crossover point           | bid price of 200 PoE per unit                                      |
| Order cancellation fee        | 15% restocking fee on shoppe orders                                |
| Sales tax split               | 90% sunk, 10% to palace coffers                                    |
| Doubloon exchange sale fee    | ceil(sellPrice / 50), i.e. 2% of sale price                        |
| Doubloon exchange offer life  | 10 days, then auto-cancelled                                       |

### Data model implications

- `BidTicket { islandId, commodityId, pricePerUnit, unitsRequested, unitsFilled, holderRef, feePaid }`.
- Island-level spawn distributor: each tick, produce `spawnRate` units and allocate to tickets sorted by `(pricePerUnit desc, createdAt asc)`, spreading roughly evenly across tickets at the top price.
- `DocksideOffer { buildingId, commodityId, side(buy|sell), price, minStock, maxStock, enabled }`; a per-island order book is the aggregate.
- Trade-run profit is emergent from these two structures; no separate "trade route" entity is needed.

### MVP relevance

**Core**: dockside buy/sell and a simplified bid queue (price-priority fill). **Phase 2**: exact fee formula, partial-fill ticket splitting, min/max stock bands. **Deep**: player-to-player trade window (meaningless offline unless there are NPC traders).

## Currencies: pieces of eight, doubloons, rogue marks

### Source

https://yppedia.puzzlepirates.com/Pieces_of_eight, /Doubloon, /Doubloon_exchange, /Palace_shoppe, /Rogue_mark_shoppe, /Bank, /Black_market, /Trading_post

### What it is

**Pieces of eight (PoE)** is the working currency. **Doubloons** are a real-money second currency on doubloon oceans (Emerald is one). **Rogue marks** are a third, purchase-reward currency spent only on renames and chart boxes. **Trinkets** act as a soft currency at trading posts.

### Mechanics

PoE sources (fountains):

- Defeating brigands, barbarians and merchant brigands at sea — explicitly "the primary PoE fountain in all production oceans".
- Wages from shoppe labour; jobber pay on trade voyages (per league) and blockades (per segment).
- Bounties for sinking brigand-king ships in flotillas and BK blockades (500 to 85,000+ PoE per ship).
- Expedition payouts (imperial outpost, viking raid, buried treasure, shipwreck, yeti).
- Treasure hauls and chests in sea monster hunts; lavish lockers from greedy brigands.
- Wagers on multiplayer puzzles and tournaments; selling goods to other players/shoppes.

PoE sinks:

- Market bidding fees; sales tax (90% sunk); weekly property tax baseline; stall opening fees.
- Doubloon-exchange fees (called out as "one of the larger PoE sinks on doubloon oceans").
- War chests (only 50–75% is returned to the winner); blockade jobber pay is a transfer, not a sink.
- Black boxes (10,000 PoE each), charts, whisking potions, bribes, party ads (250 PoE).

Doubloons:

- Enter the world **only** through real-money purchase or OM event prizes. Once spent they are sunk permanently.
- Held per **account**, not per pirate, and shared across all doubloon oceans on that account.
- Spent on: delivery fees when collecting shoppe orders (fixed per item, sunk, shopkeeper gets nothing), badges at the palace shoppe (labour, deluxe labour, bravery, parlor, etc.), crew creation, shoppe/stall creation (e.g. 20–30 doubloons per basic shoppe, 10 per stall), gold boxes, subscription-by-doubloons ("coinscribing", 42 doubloons/month).
- **Doubloon exchange** (in banks, via cashboxes, or from the pirate info page): a two-sided order book of player buy and sell offers. Lowest sell and highest buy fill first; excess PoE is refunded to the buyer. Seller pays a 2% fee. Unfilled offers expire after 10 days. Grey Havens never sells doubloons for PoE — only for real money.

Rogue marks: awarded as a bonus on doubloon purchases; spent at the rogue mark shoppe on renames (ship, crew, flag, pirate, pet, familiar, building), familiar recolours and chart boxes. Building rename costs 10 rogue marks; ship renames scale with hull (sloop 6 standard / 18 custom, up to merchant galleon 18 / 54).

Trinkets: earned from brigand kings, expeditions, sea monster hunts and greedies; traded in at a **trading post** to reduce the PoE price of a prize, with a minimum required count of a specific trinket type and a dynamically valued exchange rate.

### Numbers and tables

| Currency    | Enters via                                      | Leaves via                                      | Scope             |
| ----------- | ----------------------------------------------- | ----------------------------------------------- | ----------------- |
| PoE         | Brigand booty, wages, bounties, expeditions      | Fees, taxes, rent, doubloon exchange, purchases  | Per pirate        |
| Doubloons   | Real money, OM prizes                            | Delivery fees, badges, creation fees, gold boxes | Per account       |
| Rogue marks | Doubloon-purchase bonuses                        | Renames, recolours, chart boxes                  | Per pirate        |
| Trinkets    | Kings, expeditions, SMH, greedies                | Trading post prizes                              | Per pirate        |

### Data model implications

- Offline, doubloons cannot be bought with money. Two honest options: (a) drop doubloons entirely and convert every doubloon cost to PoE; (b) keep doubloons as a *rare* reward currency granted by events, preserving the badge/delivery-fee sinks as gating. Option (b) preserves the original pacing pressure without the paywall.
- `Wallet { poe, doubloons (account-scoped), rogueMarks, trinkets: Map<type,count> }`.
- Every sink should be logged so the economy can be balanced: a single `LedgerEntry { source, sink, amount, reason }` stream makes tuning possible.

### MVP relevance

**Core**: PoE with the brigand-booty fountain and the fee/tax/rent sinks. **Phase 2**: doubloons re-cast as an event currency plus badges. **Deep**: rogue marks, trinket trading post.

## NPC opposition: brigands, barbarians, merchants, greedies

### Source

https://yppedia.puzzlepirates.com/Brigand, /Barbarian, /Merchant_brigand, /Greedy_brigand, /Crew_rank, /Might, /Ship_spawn, /Sea_battle, /Configure_voyage, /Gem_thieves

### What it is

Computer-controlled ships that spawn between league points and fight the player's ship. They are the game's main PoE fountain.

### Mechanics

- **Brigands** board with the **swordfight** puzzle (rectangle icon on the might ring); **barbarians** board with the **rumble** puzzle (circle icon). **Merchant brigands** are non-aggressive cargo haulers that also swordfight if attacked, and carry commodities. **Navy** ships have no might ring.
- Spawn rate and strength depend on: the league point's route difficulty shading, the results of the player ship's previous battles, and how full the player's crew is (near-max crews can pull larger enemies).
- Voyage configuration modulates spawns: pillage/greeter pillage **increase** spawn odds as navigation performance rises; trade, evade, flotilla and sea-monster configurations **decrease** them. The officer sets a might-ring range for auto-targeting and can restrict to brigands only, barbarians only, or both.
- **Might ring** compares the enemy's strength to the player ship's: blue = weaker, green = comparable, red = stronger. Might is a function of the number of pirates aboard and their **duty-puzzle** standings only (carousing and crafting do not count). Ship size does not affect might. Might disappears on porting.
- **Crew rank** labels both NPC and player crews, ascending: Sailors, Mostly Harmless, Scurvy Dogs, Scoundrels, Blaggards, Dread Pirates, Sea Lords, Imperial(s). Player crew rank only changes through PvP.
- **Payout scaling**: booty is relative to the player ship's current might, the number of pirates aboard, and the enemy's crew rank. Greenies aboard reduce payouts. Brigands and barbarians are one of the few sources of **kraken's blood**, and can drop expedition news, sea monster hunt maps and chart items.
- **Losing** a battle: the enemy takes **10% of the commodities in the hold and 20% of the PoE in the booty**.
- **Greedy brigands/barbarians** ("greedies") replace a regular enemy in the melee. Each is susceptible to one colour (red/yellow/green/blue for swordfight; red/orange/yellow/aqua/blue for rumble). Large single-colour fused strikes against a targeted greedy have a chance to knock loose a **Lavish Locker**, added to the booty immediately (kept even if the melee is lost, but plunderable in later battles). Lockers open at booty division and are divided among pirates who attacked greedies in that battle; contents are PoE plus furniture, trinkets, silver chromas, pelicans, lobsters. Greedies appear more often with more new players aboard and as the pillage's booty ramp grows.
- **Sea battle structure**: pursuit -> navigation -> boarding. Navigation board is 24x24; a turn is 4 phases with 35 seconds of planning. Movement tokens come from sailing/rigging (decay after 5 unused turns; slowed by bilge), gun tokens from gunnery (never decay, range 3 tiles), grapple tokens are unlimited (range 1, cannot share a phase with guns). Damage from cannon fire, illegal moves, rams and wear becomes unbreakable blocks in the boarding puzzle. Disengage counter starts at 10 turns and +2 per cannon hit taken.
- **Maneuver tokens** exist only on multi-ship boards (blockade, flotilla, SMH) and require contributions from sailing/rigging, carpentry/patching and bilging (one third each).

### Numbers and tables

| Enemy type        | Boarding puzzle | Aggressive | Drops                                                        |
| ----------------- | --------------- | ---------- | ------------------------------------------------------------ |
| Brigand           | Swordfight      | Yes        | PoE, commodities, kraken's blood, expedition news, SMH maps   |
| Barbarian         | Rumble          | Yes        | Same as brigand                                               |
| Merchant brigand  | Swordfight      | No         | Cargo commodities + PoE equivalent to a similar brigand       |
| Greedy (either)   | Same as host    | Melee only | Lavish Lockers (PoE, furniture, trinkets, chromas, pets)      |
| Navy              | n/a             | No         | Not attackable until release 2008-10-14                       |

Crew rank tiers (difficulty proxy, ascending): Sailors, Mostly Harmless, Scurvy Dogs, Scoundrels, Blaggards, Dread Pirates, Sea Lords, Imperials.

Loss penalty: -10% hold commodities, -20% booty PoE.

Cargo pattern: small merchant ships carry valuable/rare commodities; large merchant ships carry bulky commons (hemp, fruit).

### Data model implications

- `EnemySpawn { shipClass, crewRank, type(brigand|barbarian|merchant), mightScore, cargo[], poeReward }` generated from `f(leaguePoint.difficulty, playerMight, crewCount, voyageConfig, navPerformance)`.
- `might = g(crewSize, sum(dutyPuzzleStandings))`; ring colour = `compare(enemyMight, playerMight)` bucketed to blue/green/red.
- Reward: `poe = base(crewRank) * mightFactor * crewFactor * greenieMalus`. The wiki does not publish the constants — they must be tuned.
- Loss: apply -10% hold / -20% booty as a deterministic transfer.

### MVP relevance

**Core**: brigand/barbarian spawn by route difficulty, might rings, crew ranks as difficulty tiers, the payout scaling inputs, and the loss penalty. **Phase 2**: merchant brigands (needed to make uncolonized-island commodities reach markets) and greedies. **Deep**: exact spawn-influence of navigation performance.

## Brigand Kings and flotillas

### Source

https://yppedia.puzzlepirates.com/Brigand_King, /Flotilla, /Brigand_King_compass, /Category:Brigand_Kings

### What it is

Eight named NPC warlords. Each parks a **flotilla** — a persistent multi-ship battle node on a league point — and, if left undefeated, declares a **blockade** on a nearby player island.

### Mechanics

- Kings: Azarbad the Great and Barnabas the Pale are brigand-only (swordfight); Vargas the Mad is barbarian-only (rumble); Admiral Finius, Brynhild Skullsplitter, Gretchen Goldfang, Madam Yu Jian and The Widow Queen appear as both.
- **Flotilla node**: appears at a random league point, marked with the king's icon (dark red = sinking, grey/uncoloured = non-sinking). Entered by "Attack Flotilla" from the vessel panel; a sinking flotilla requires the ship to be set battle-ready. Multiple player ships share one continuous board and are all treated as one team for friendly-fire purposes (half damage).
- The board has a safe zone at the player end and an invisible wind at the enemy end where the king's ships enter.
- The king's fleet has **green supply ships** (cutters, merchant brigs, merchant galleons) and **red war ships** (everything else). Only sinking **green** ships counts on the scoreboard and weakens the flotilla; red ships still pay a bounty and leave a haulable wreck. Sinking enough greens drives the flotilla away.
- **Bounties**: 500 to 85,000+ PoE per enemy ship sunk, scaled by the sunk ship's size and the king's difficulty. Bounties in a sinking flotilla are roughly **2x** those in a non-sinking one. The bounty is split immediately among all contributing ships and among the pirates aboard, with the remainder to the ship's coffers — it never enters the booty chest.
- Sunken ships leave **treasure haul** spots; sinking flotillas leave more treasure than non-sinking ones. Booty from hauling is divided normally at port.
- Flotillas relocate roughly weekly (originally Thursdays at noon; randomised in 2025) and reappear ~15 minutes after being defeated. A king holding an island has no flotilla; its fleet is hidden until it loses the island.
- **Brigand King blockades**: if a flotilla is not defeated in time, the king declares a blockade on a nearby island, resolving on the second weekend after the drop. BK blockades are **always sinking**. Bounties are paid for sinking BK ships and for controlling buoys. While a BK has declared, players cannot declare their own blockade on that island. Scuttling a defeated king's ship as a royal of an island-holding flag provokes a retaliatory blockade the next weekend.
- **When a king takes an island**: taxes set to 100%; palace/fort coffers reset to 10,000 PoE once a day; buy/sell offers enabled for every commodity type with `buy = tax*10*0.90` and `sell = tax*10*1.10`; construction sites wiped; managers fired; shoppes and attractions closed, starting a 30-day dust countdown; island news replaced.
- **Amassed power**: a rough strength number shown next to the king's flag on the notice board's blockade tab. Correlates with the island's economy rather than with flotilla sinks.
- **BK compasses** are buyable at explorers' halls; placing one on the nav table spawns a scaled-to-crew king ship. A compass is reusable until a battle is decisively won or lost (disengaging preserves it); a *sighting* won from brigands is single-use. Defeating a king awards a king-specific trinket to every experienced pirate aboard.

### Numbers and tables

| Brigand King          | Fights as     | Flotilla | Compass start price (PoE) |
| --------------------- | ------------- | -------- | ------------------------- |
| Admiral Finius        | Both          | Non-sink | 2,000                     |
| Azarbad the Great     | Brigand       | Non-sink | 3,000                     |
| Barnabas the Pale     | Brigand       | Sinking  | 4,000                     |
| Brynhild Skullsplitter| Both          | Sinking  | 3,500                     |
| Gretchen Goldfang     | Both          | Non-sink | 2,500                     |
| Madam Yu Jian         | Both          | Sinking  | 3,000                     |
| Vargas the Mad        | Barbarian     | Sinking  | 3,500                     |
| The Widow Queen       | Both          | Sinking  | 3,500                     |

Compass prices decay while unsold and the compass vanishes once it drops ~1,000 PoE below its start price.

### Data model implications

- `BrigandKing { id, name, fightsAs, flotillaSinking, compassBasePrice, powerScore }`.
- `Flotilla { kingId, leaguePointId, supplyShipsRemaining, supplyShipsToDefeat, relocatesAt }` — a persistent world object on the map, plus a battle-board instance.
- `Bounty { shipClass, kingDifficulty, sinkingMultiplier: 2.0 }` with immediate per-pirate payout, bypassing the booty chest.
- Flotilla -> blockade escalation is a timed world event: `if (!flotillaDefeated by T) scheduleBlockade(nearbyIsland, T + 2 weekends)`.

### MVP relevance

**Phase 2** as a whole — it is the natural "world threat" loop for a single-player recreation and the strongest source of long-term stakes. The compass-driven single-king duel is the cheapest slice and could sit in **core** as a mini-boss.

## Blockades

### Source

https://yppedia.puzzlepirates.com/Blockade, /Blockade_pay, /Blockade_event, /War_chest, /Ship

### What it is

A large multi-ship, buoy-control sea battle that decides island ownership. No grappling, no boarding.

### Mechanics

- **Declaring**: a flag royal aboard a docked ship at the target island presses Blockade and pays the war chest; the blockade starts exactly 24 hours later. To blockade a colonized island the flag must have declared war on the ruling flag first, and the declaration cannot be rescinded until 3 days after the blockade ends. Any other flag may join as a further contender by paying its own war chest at any time before the end.
- **Window**: the initial war chest may only be dropped Friday noon–midnight or Saturday 10:00–noon Pirate Time, so blockades run Saturday noon–midnight or Sunday 10:00–noon. OMs and governors can bypass this with event blockades.
- **Fame gate**: outpost = Noted, medium = Established, large = Renowned.
- **Format**: best-of-five (the page also references configurable round counts of 1–7 for event blockades; the victory condition is always a majority of rounds). Each round is ~45 minutes, followed by a 15-minute break. Within a round there are four 1-minute mid-round breaks, at 35:00, 26:15, 17:30 and 8:45 remaining — dividing the round into **five segments**, which is also the pay unit.
- **Winning**: only a contender scoring a majority of rounds takes the island; otherwise the defender keeps it by default (including "no defender" on an uncolonized or disbanded-flag island, which then stays ownerless). If a contender can no longer reach a majority, the blockade ends immediately. A nonzero tie goes to sudden death; a 0–0 round scores for the defender.
- **Board**: 20 wide x 30 long (36 with safe zones), island at one end and open ocean at the other. Ships enter randomly along the outer edge of a 3-row safe zone, facing inwards. Crossing out of the safe zone into the board is one-way. Ships in a safe zone cannot be sunk or shoot, take no cannon damage, but can be rammed out. The board resets each round, ejecting everyone.
- **Scoring**: buoys worth 1, 2 or 3 pennants sit on open water. A ship projects a circular **zone of influence** whose diameter scales with hull size; it only has influence if enough pirates are aboard (swabbies and non-subscribers never count). At end of turn, a buoy scores for a faction that holds it uncontested; contested buoys (black) score for nobody; a buoy is counted once regardless of how many friendly ships cover it.
- **Factions**: a ship's faction is its flag if that flag is a contender or the defender, or the faction its flag is directly allied to; otherwise a fresh faction is created for the round. A ship keeps its entry faction until it leaves the board. Friendly fire within a faction does half damage. Colours: blue = your faction, green = defender, red = contenders, grey = other, yellow = unowned buoy, black = contested.
- **Sinking**: uncolonized-island blockades are always sinking. Colonized-island blockades default to non-sinking; only the **defender** can make it sinking, by declaring war on at least one contender (taking effect at the start of the next round). In a sinking blockade sunk ships and cargo are lost permanently and pirates may be injured; sunken treasure appears for hauling. In a non-sinking blockade a sunk ship reappears at its last port with supplies intact but cannot re-enter.
- **Eligibility to enter**: no greenies, no unsaved guest accounts; every pirate aboard must have at least Narrow experience in two or more piracy puzzles.
- **Blockade pay**: a flag royal posts a per-pirate-per-segment average PoE amount plus a performance scheme and a loyalty scheme. Pay lands at each segment break; the jobber must be actively working a station for ~50% of the segment and the ship must be set to "Blockade" in configure voyage. The payroll reserves enough to cover one full round per active jobber; new jobbers cannot join if the reserve is short. Pay can be lowered or removed between rounds, never during one. Excess returns to the royal who created the offer.
- **End of blockade**: successful defence -> 75% of the combined war chests goes into the fort/palace coffers. Contender win -> the contending flag's monarch (or a random royal) becomes governor, all infrastructure deeds transfer automatically, and the winner receives 50% of the war chest; on outposts the single shoppe deed also transfers, but on medium/large islands shoppe and inn deeds stay with their holders.
- **Event blockades**: governors can schedule them on their own island 60 minutes to a month ahead, choosing sinking mode, cannons on/off, alliance handling, maneuvers on/off, 1–7 rounds, obstacle density (Normal/Sparse/Dense/Rocky/Turbulent/Windy) and which ship classes may enter. Ships may bypass an event blockade entirely and join via a "Join Event" button; on a tie the side that entered first wins.

### Numbers and tables

Round timing:

| Element              | Value                                  |
| -------------------- | -------------------------------------- |
| Round length         | ~45 minutes                            |
| Inter-round break    | 15 minutes                             |
| Mid-round breaks     | 4, of 1 minute each                    |
| Segments per round   | 5                                      |
| Break marks          | 35:00, 26:15, 17:30, 8:45 remaining    |
| Rounds to win        | Majority (3 of 5 standard)             |

Ship influence and blockade combat stats:

| Ship             | Influence diameter | Min crew for influence | Max crew | Stations | Move tokens/turn | Shots per move | Cannon | Firepower/turn | Sinking damage |
| ---------------- | ------------------ | ---------------------- | -------- | -------- | ---------------- | -------------- | ------ | -------------- | -------------- |
| Sloop            | 1                  | 3                      | 7        | 8        | 4                | 1 per side     | small  | 1              | 10             |
| Cutter           | 2                  | 4                      | 12       | 12       | 4                | 1 per side     | small  | 1              | 12             |
| Dhow             | 2                  | 4                      | 12       | 11       | 4                | 1 per side     | medium | 1.5            | 12             |
| Fanchuan         | 2                  | 4                      | 12       | 11       | 3                | 1 per side     | large  | 2              | 13.125         |
| Longship         | 2                  | 5                      | 15       | 14       | 4                | 2 per side     | small  | 2              | 15             |
| Baghlah          | 4                  | 6                      | 18       | 17       | 3                | 2 per side     | medium | 3              | 20             |
| Merchant brig    | 4                  | 7                      | 20       | 23       | 3                | 1 per side     | medium | 1.5            | 20             |
| Junk             | 4                  | 6                      | 18       | 18       | 3                | 1 per side     | large  | 2              | 25             |
| War brig         | 6                  | 8                      | 30       | 23       | 3                | 2 per side     | medium | 3              | 25             |
| Merchant galleon | 6                  | 13                     | 30       | 40       | 3                | 1 per side     | large  | 2              | 30             |
| Xebec            | 6                  | 12                     | 45       | 37       | 3                | 2 per side     | medium | 3              | 35             |
| War galleon      | 6                  | 12                     | 40       | 36       | -                | -              | large  | -              | -              |

War chest and payout:

| Island size | Minimum war chest | Defender win payout | Attacker win payout |
| ----------- | ----------------- | ------------------- | ------------------- |
| Outpost     | 25,000 PoE        | 75% of chests       | 50% of chests       |
| Medium      | 75,000 PoE        | 75% of chests       | 50% of chests       |
| Large       | 125,000 PoE       | 75% of chests       | 50% of chests       |

Blockade pay schemes:

| Scheme            | Axis        | Effect                                                              |
| ----------------- | ----------- | ------------------------------------------------------------------- |
| Even              | Performance | Everyone who works is paid the same                                  |
| Performance       | Performance | Pay by word-rank on the duty report; booches still paid a little     |
| Elite             | Performance | Pay entirely by performance; a booch pays 0                          |
| Gunner's Glory    | Performance | Gunners are paid more than other stations                            |
| Even              | Loyalty     | Everyone paid equally                                                |
| Jobber's Delight  | Loyalty     | Pirates from outside the flag are paid more                          |
| Jobbers Only      | Loyalty     | Only outsiders are paid                                              |

Worked pay examples from the wiki (base 100 PoE/segment, 10 jobbers): performance/even with 5 booched + 5 incredible pays 50 and 150; elite/even with 5 booched + 5 excellent pays 0 and 200; elite/even with 5 fine + 5 incredible pays 33 and 166. Total flag spend is ~jobbers x base per segment regardless of distribution.

### Data model implications

- `Blockade { islandId, defenderFlagId?, contenders[], roundsToWin, sinking, roundIndex, scores: Map<factionId,int>, board }`.
- `BlockadeBoard { width: 20, height: 30 (+6 safe), obstacles[], buoys: [{pos, pennants, controllingFaction?}] }`.
- Per-turn scoring: for each buoy, collect the set of factions whose ships' influence circles cover it; if exactly one, award `pennants` points.
- Pay tick per segment: `budget = activeJobbers * basePerSegment`, distributed by the chosen performance curve, clamped by the payroll balance.
- Note the internal inconsistency in the source: the intro says best-of-five while the event section allows 1–7 rounds. Model `roundsToWin = ceil(totalRounds / 2)` and make `totalRounds` configurable.

### MVP relevance

**Phase 2**. In a single-player game the interesting version is defending/attacking against a Brigand King fleet rather than a rival flag. The buoy-influence scoring and the segment-based pay are both cleanly implementable. **Deep**: multi-faction politics, alliances, war declarations, event-blockade configuration.

## Expeditions

### Source

https://yppedia.puzzlepirates.com/Expedition, /Imperial_outpost, /Viking_raid, /Merchant_brigand, /Brigand_King_compass, /Explorers%27_hall, /Black_market, /Category:Expeditions

### What it is

Optional side-objectives attached to a league point on the current voyage, unlocked by a map/compass item or won from a defeated brigand. Available on any voyage except swabbie transport.

### Mechanics

- Sources: won from defeated brigands/barbarians; bought at an **explorers' hall**; found in a **black box** (bought at a black market for 10,000 PoE).
- Only one expedition may be *active* at a time; an officer switches the active one on the expedition report screen. The report shows distance as "Here", "Less than 1 league", "X leagues", "Earlier in current course", or "Not on current course".
- Expedition league points sit on **normal chartable routes** (unlike sea monster hunts). Maps bought at a hall include the league points from the purchase island to the site, but not necessarily a full chartable route to a destination island — the player must still chart to an island through that point.
- Expeditions are lost at booty division unless their map/compass is still on the nav table.
- Explorers' halls restock every 3 minutes; when fully stocked each of the three tabs holds every combination (Imperial outposts: 4 sizes x sinking/non-sinking; Viking raids: 4 sizes x swordfight/rumble; BK compasses: one per king). Prices decay while unsold and the item disappears once it falls far enough.

The seven-plus expedition types:

| Expedition          | Obtained from                                  | Puzzles involved                                  | Reward                                        |
| ------------------- | ---------------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| Brigand King sighting / compass | Black boxes, brigands, explorers' hall | Sea battle, then swordfight or rumble             | King-specific trinket, booty                  |
| Buried treasure     | Black boxes, brigands                          | Foraging on an atoll                              | PoE in chests, divided at port                |
| Imperial outpost    | Black boxes, explorers' hall                   | Sea battle vs guard ship, then swordfight ashore  | PoE, cannon balls, grog                       |
| Merchant hunt       | Brigands                                       | Sea battle, then swordfight or rumble             | The merchant's cargo + PoE                    |
| Shipwreck           | Black boxes, brigands                          | Treasure haul                                     | PoE                                           |
| Viking raid         | Black boxes, explorers' hall                   | Gunnery, then swordfight or rumble                | PoE                                           |
| Yeti sighting       | Brigands                                       | None (exploration)                                | Free 2-person portrait + ice chests of PoE    |
| Vampirate           | Vampirate fray, black boxes, new moon spawns   | Sea battle, swordfight, carpentry, treasure haul  | Blood boxes                                   |
| Werewolf            | Werewolf fray, full-moon spawns                | Sea battle, rumble                                | Wolf boxes                                    |

- **Imperial outpost**: 4 sizes (small/medium/large/huge) x 3 fortification levels (fledgling/established/fortified) x sinking or non-sinking. Maps decay in 3 days and are consumed on success; losing either phase resets the whole expedition (the guard ship respawns undamaged). Guard ship by size: small = sloop, medium = war brig, large = war frigate, huge = grand frigate. Soldiers ashore: small 4–11, medium 22–29 (large/huge unknown).
- **Viking raid**: same 4 sizes x 3 fortification levels, x swordfight or rumble. Players first man shore guns (cannon balls are "magicked up", not consumed from the hold); each loaded cannon adds damage blocks to the vikings' puzzle. Gunnery performance does not change whether the brawl happens, only its difficulty. Attacking longships / vikings: small 1 ship, 5–11 vikings; medium 2 ships, 20–64; large 4–5 ships, 50–145.
- **Buried treasure**: sail to an atoll league point, "Dig for treasure", the crew forages chests on the island; PoE is added to the booty and chest PoE is distributed at division to everyone who was aboard when the expedition was won. Chest value depends on the number and skill of pirates aboard at the moment the expedition was won.

### Numbers and tables

Imperial outpost payouts (observed maxima, sinking variant):

| Outpost size | Max PoE | Cannon balls | Grog units |
| ------------ | ------- | ------------ | ---------- |
| Small        | 17,812  | 10           | 6          |
| Medium       | 29,596  | 9            | 12         |

(The wiki's larger sizes are not filled in.)

Map decay: Imperial outpost and Viking raid maps 3 days; Sea Monster Hunt maps 8 calendar days; island charts 45 (intra) / 90 (inter) days.

Black box (Series 7) contents by probability: unique black-market trinket 52%, expedition map 16%, monster summoning charm 11%, monster amulet 5%, BK compass 3.5%, SMH map 3%, black piggy bank 1.8%, smuggler furniture 1.8%, other furniture 1.4%, mustache wax 1%, black top hat 0.75%, black masked bandana 0.75%, black dread mask 0.5%, rogue-class ship designs 0.06–0.25%, black pets 0.05–0.1%, mask design 0.1%.

### Data model implications

- `ExpeditionMap { type, size?, fortification?, sinking?, meleeType?, leaguePointId, decayDays, consumedOnSuccess }` as an inventory item that must sit on the nav table.
- `ActiveExpedition { mapId, state, distanceLeagues }` attached to the voyage; only one active.
- Each type is a small scripted encounter chain: `[seaBattle?] -> [gunnery?] -> [melee?] -> [foraging|treasureHaul?] -> reward`.
- Rewards go partly to booty (divided) and partly to hold (officer in charge) — model both destinations.

### MVP relevance

**Core** for at least two types (buried treasure and shipwreck are pure single-puzzle rewards and are the cheapest content-per-effort in the whole game). **Phase 2**: imperial outpost and viking raid (they need a shore scene and a gunnery phase). **Deep**: vampirate/werewolf seasonal variants, black-box gacha.

## Sea monster hunts

### Source

https://yppedia.puzzlepirates.com/Sea_Monster_Hunt, /Atlantis, /Cursed_Isles, /Haunted_Seas, /Kraken, /Rowboat, /Booty_division, /Category:Sea_Monster_Hunts

### What it is

Four instanced, always-sinking multi-ship battle boards reached with a decaying map, entered as a distinct voyage configuration. On a doubloon ocean every pirate aboard needs a **bravery badge**.

### Mechanics

Common rules:

- Maps drop from pillaging battles, black boxes, and frays with skellies, zombies and werewolves; they are tradeable, decay in 8 calendar days, cannot be wrapped, and are locked to the nav table while a course is charted. If the ship sinks, the map is lost.
- The destination league point is **unique and unmemorizable**.
- The ship must be set battle-ready if the charting officer does not hold the deed.
- Treasure chests won during the hunt are divided at port by a **raffle**: performing puzzles earns "chances" (e.g. Amazing/Outstanding/Consistent Bilging, Carpentry, Foraging, Gunning, Patching, Rigging, Sailing, plus Battle Navigation and Brave defense of the ship); each chance may or may not win a chest; leftover chests are awarded randomly; the vessel owner takes a percentage. Chest *quality* is not influenced by performance.
- For SMH, blockade and flotilla booty, a pirate's share is based on the number of **10-minute segments present**, not the number of battles.

**Atlantis** (released 2007): ships enter at the top-right or bottom-left. Treasure Haul sites appear at sunken masts, with an extra 2x2 chest piece; clearing it to the top transfers a chest to booty (1, 2 or 3 padlocks; 3-lock "Antediluvian" chests are best). **Dragoons** board over time — boarding rate rises with ship size and with not spending movement tokens — and challenge individuals to a swordfight with an aqua trident piece; a lost duel leaves the dragoon aboard; when dragoons equal or exceed the crew, a ship-wide fray triggers and losing it is treated as a sinking. **Sea monsters** roam and try to sink or trap ships. **Citadels** rise for 25 turns; sailing into the U-shape protects the ship and triggers a ship-wide swordfight fray for chests.

**Cursed Isles** (2008): rumble-based. The board is dark, its edge is **permeable** (a ship can slip outside and an invisible wind pushes it back, letting it bypass rocks and adverse winds), whirlpools spin counter-clockwise, treasure hauling is impossible, and a moving **noxious green fog** progressively cripples the crew's station effectiveness and damages the ship (rum restores them on exit). Enemies are cursed versions of standard player hulls plus "Raft of the Dead" rafts that turn on the spot, can double-move, sink to one small cannon ball, and deposit Enlightened Ones and zombies aboard on contact. Boarders rumble with fists; rumble boards start with equal hindrance on both sides. A fifth, Cursed-Isles-only **maneuver token** exists: silver removes ~2 boarders, gold removes ~5 and converts 1–4 zombies into friendly **thralls** (never Enlightened Ones). The island itself ("the gauntlet") is entered by sailing into its bay: the crew lands, fights a zombie horde equal in number to the crew, then **forages for chests**, then fights a slightly larger group of spear-wielding cultists, and so on with escalating numbers and skill. Winning a fray banks the previous foraging session's chests to the hold; losing loses most of that session's haul.

**Haunted Seas** (2010): swordfight-based, led by Barnabas the Pale. Ghost ships have **half** the hull strength of their earthly counterparts but the same shot capacity and damage, sail **through rocks**, and only use Chain Shots. Ranks ascending: Ethereal, Phantasmal (unseen in production), Frightful, Spectral; they occupy separate zones — Ethereal in the shallows (bottom-right), Frightful in between, Spectral in the deep end (top-left) — with larger and more numerous ships in higher zones, and generally only engage inside their own zone. Boarders (phantasms, frights, specters) issue individual duels; ignored ones sabotage stations and become fray-able; reaching parity with the crew triggers a ship-wide takeover fray. A single **ship graveyard** appears at a time, lasts 25 turns, escorted by an ethereal brig and sloop; sailing to its centre triggers a ship-wide fray whose defenders number the ship's pirates plus swabbies, occasionally including Barnabas. Winning emits an "aura blast" and leaves four haulable wrecks; losing leaves nothing. Sail tokens are preserved across the graveyard fray. A purple swordfight piece is added that locks (turns dark grey) if not broken within five drops. Chest types: ghostly box, ethereal locker, spectral chest.

**Kraken** (2014): entirely different. Each pirate aboard enters in their **own rowboat**, consuming one **lifeboat** commodity (produced at shipyards) per pirate. No duty puzzles — every player pilots a boat, gets movement tokens automatically each turn, and shot tokens if their boat class has a weapon. No repair, no bilge, no maneuver tokens. Sessions are capped at **30 minutes**; leaving early forfeits the lifeboats but keeps the treasure; re-entering generates a new board. Treasure is chests and eggs (cuttle boxes near the entry, eggs furthest away, hidden behind rock/whirlpool/wind mazes) and **kraken's ink**, obtained by harpooning tentacles or the head, or picked up where it spawns near the head. Rowboat class comes from a **rowboat kit** (furnisher product) that lasts 15 login days.

### Numbers and tables

Ghost fleet damage to sink (Haunted Seas; parenthesised = actual minimum against continuous repair):

| Ghost ship | Small CBs   | Medium CBs   | Large CBs   |
| ---------- | ----------- | ------------ | ----------- |
| Sloop      | 5 (6)       | 3.33 (4)     | 2.5 (2.5)   |
| Brig       | 12.5 (13)   | 8.33 (10)    | 6.25 (6.5)  |
| Frigate    | 25          | 16.66 (20)   | 12.5 (14)   |

Rowboat classes (Kraken):

| Class       | Max moves | Max damage | Shot       | Holds treasure | Holds ink | Kit          |
| ----------- | --------- | ---------- | ---------- | -------------- | --------- | ------------ |
| Rowboat     | 3         | Normal     | None       | Yes            | Yes       | None (base)  |
| Bumper Boat | 3         | Increased  | None       | Yes            | Yes       | Bumper kit   |
| Chum Boat   | 3         | Normal     | Chum       | Yes            | Yes       | Chum kit     |
| Harpoon Boat| 3         | Normal     | Harpoon    | No             | Yes       | Harpoon kit  |
| Powder Boat | 3         | Normal     | Powder keg | No             | No        | Powder kit   |
| Speed Boat  | 4         | Decreased  | None       | Yes            | Yes       | Speed kit    |

Rowboat damage points: rock bump 2, small tentacle 5, medium tentacle 8, large tentacle 10, defendacle 10, harpoon shot 2.5, powder keg = instant kill. A "Decreased" hull has 5 max DP (2 rock bumps, dies to any tentacle).

| Hunt         | Boarding puzzle | Primary treasure mechanic          | Signature hazard                      |
| ------------ | --------------- | ---------------------------------- | ------------------------------------- |
| Atlantis     | Swordfight      | Treasure haul + citadel frays      | Dragoon boarders, sea monsters        |
| Cursed Isles | Rumble          | Foraging on the island gauntlet    | Noxious fog, rafts, no treasure haul  |
| Haunted Seas | Swordfight      | Hauling sunk ghost ships + graveyards | Phase-through-rock ships, chain shots |
| Kraken       | None            | Chests/eggs/ink collected by rowboat | Tentacles, 30-minute timer, mazes     |

### Data model implications

- `SeaMonsterHunt { type, boardTemplate, entryRequirement: lifeboats|braveryBadge, alwaysSinking: true, mapDecayDays: 8 }`.
- Each hunt is a distinct board subclass — they share only "multi-ship battle board + maps + chest raffle". Do not over-generalise.
- `ChestRaffle { chances: [{pirateId, reason, weight}], chestsAvailable, ownerCutPercent }` — used by all four plus flotillas.
- Kraken needs a per-player entity controller, not a per-ship one; treat it as a separate game mode.

### MVP relevance

**Deep** as a group; each is a large piece of bespoke content. If one is chosen for **phase 2**, Cursed Isles is the most self-contained (foraging + rumble, no treasure haul, no per-player boats) and Kraken is the most novel but the most distinct engine work.

## Booty and pay division

### Source

https://yppedia.puzzlepirates.com/Booty_division, /Booty_shares, /Blockade_pay, /Configure_voyage, /Port, /Flotilla

### What it is

How PoE and goods taken during a voyage are shared among the pirates aboard.

### Mechanics

- **In-flight**: 50% of PoE brought aboard from a win is divided immediately among the crew, unaffected by the crew's chosen booty-share scheme. The rest, plus all commodities and treasure chests, goes into the ship's booty chest.
- **At port**: any officer or above can divvy. The default split follows the crew's booty-share table. Each pirate's weight is their **number of battles participated in** (for flotilla, blockade and Atlantis booty, instead the number of **10-minute segments** present). The divvying officer may adjust any pirate by **exactly ±1 share**, may not raise their own share but may lower it arbitrarily, and may lower but never raise the crew cut. The division then goes to a majority vote of the pirates aboard.
- **Auto-division**: if booty stays undivided for 30 minutes after porting it divides automatically per crew shares. A server reboot at sea whisks the ship to port and auto-divides. A ship abandoned at sea for 15 minutes loses all booty (hold and coffers survive).
- **Crew/restocking cut** comes off the top and goes to the ship hold; if the divvying officer lacks fleet-officer hold privileges it goes to their pocket instead.
- Officers can sell pillaged goods directly from the booty chest before division; the proceeds go back into the booty chest.
- **Flotilla bounties** bypass all of this: they are split immediately among contributing ships and the pirates aboard, with the remainder into the ship's coffers.
- **Trade voyages** pay jobbers a configured average PoE **per league point**, modulated by each pirate's performance relative to the rest of the crew that league; the PoE must be present in the hold. **Evade** is the same mode with no pay. **Greeter pillages** pay green pirates an average of 10 PoE per league on top of a 50% booty split, and yield less loot.
- **Blockade pay** is per segment, not per battle (see the blockade section).

### Numbers and tables

Crew booty-share schemes (shares by rank: Jobber / Cabin person / Pirate / Officer / Fleet officer / Senior officer / Captain):

| Scheme           | Jobber | Cabin | Pirate | Officer | Fleet off. | Senior off. | Captain |
| ---------------- | ------ | ----- | ------ | ------- | ---------- | ----------- | ------- |
| Even             | 1      | 1     | 1      | 1       | 1          | 1           | 1       |
| Rank's Privilege | 3      | 2     | 3      | 4       | 4          | 4           | 4       |
| Jobber's Delight | 5      | 3     | 4      | 4       | 4          | 4           | 4       |
| Crew Loyalty     | 4      | 4     | 5      | 5       | 5          | 5           | 5       |
| Promotion Pays   | 5      | 6     | 7      | 8       | 8          | 9           | 10      |
| Officer Club     | 7      | 5     | 7      | 8       | 8          | 9           | 10      |
| Jobber's Bane    | 1      | 1     | 2      | 2       | 2          | 2           | 2       |
| Trader Shares    | 4      | 4     | 5      | 2       | 2          | 2           | 2       |
| The Cruel Shelf  | 5      | 10    | 12     | 15      | 20         | 20          | 20      |

Worked example from the wiki: 10,000 PoE booty, 25% restocking cut -> 7,500 divisible. Four pirates (2 jobbers, a senior officer, a captain). Under Even each gets 1,875. Under The Cruel Shelf the total is 50 shares, so the officers get 3,000 each and the jobbers 750 each.

### Data model implications

- `Division { booty: {poe, commodities[], chests[]}, crewCutPercent, entries: [{pirateId, rank, battles|segments, shareWeight, adjustment(-1..+1)}] }`.
- `payout(pirate) = (booty.poe - crewCut) * (shareWeight * participation) / sum(all)`.
- The ±1 adjustment and the vote are pure multiplayer social mechanics; offline they collapse to a settings toggle.

### MVP relevance

**Core** as a formula (it defines what a voyage is worth), **phase 2** as an interface. With an all-NPC crew, the share table becomes a difficulty/economy dial: the player's cut of a voyage.

## Jobbing, notice board and voyage configuration

### Source

https://yppedia.puzzlepirates.com/Notice_board, /Jobbing_notice, /Manage_jobbers, /Configure_voyage, /Mission, /Shoppe_panel, /Island_panel, /Home, /Ferry

### What it is

The systems that staff a ship and route a player to activity. In a single-player recreation these become the *content router*.

### Mechanics

- **Notice board** tabs: News, Puzzles (whisk straight to a puzzle), Missions, Voyages (ships hiring, with auto-apply), Events, Shoppe Jobs (whisk to a hiring shoppe), Blockades (current/upcoming, plus which islands are blockadeable and the war-chest cost), War (Obsidian only), Competition (event-only).
- **Jobbing**: an officer ticks "Hiring Jobbers" at the helm, exposing ship/crew/officer, booty split and restocking cut, plus an optional mission statement. The notice auto-hides when the ship is full and during battle. "Hire swabbies" fills stations with NPCs without posting a notice.
- **Voyage configuration** (8 types): **pillage** (with a might-range slider, brigand/barbarian filter, PvP auto-target toggle), **trade** (per-league jobber pay), **evade** (trade with no pay, settable mid-voyage), **blockade**, **greeter pillage**, **swabbie ship transport**, **flotilla**, **sea monsters**. Only evade can be set outside a port or league point.
- Navigation performance modulates spawns *toward the configured target*: pillaging well spawns more of what you asked for; trading/evading well spawns less of everything.
- **Missions** are the tutorial/router layer: inn puzzle missions, palace trainer challenges (10 difficulty levels of drinking/rumble/swordfight against bots — no rating, no pay), crafting missions ("Work at Alchemistry/Blacksmithing/Distilling/Shipwrightery/Weaving" — always whisks to a shoppe with work in the queue, searching current island -> current archipelago -> home island -> home archipelago), shopping missions (needs 5,000 PoE for a sword, 1,000 for clothes), navy missions (basic duty stations; advanced navigate/puzzle/battle-brigands, gated on Broad experience), Pollywog missions, and monster frays.
- **Island panel** shows archipelago, island size, ruling flag and governor, population, and a "move here" (set home) button. **Shoppe panel** shows building name/type/founded/owner/managers/news plus "Help Wanted" with the offered wages.

### Numbers and tables

| Voyage type       | Spawn effect          | Pay mechanic                              | Set where          |
| ----------------- | --------------------- | ----------------------------------------- | ------------------ |
| Pillage           | Increases with nav    | Booty division                            | Port / league pt   |
| Greeter pillage   | Increases with nav    | 10 PoE/league to greenies + 50% split     | Port / league pt   |
| Trade             | Decreases with nav    | Configured PoE per league, perf-weighted  | Port / league pt   |
| Evade             | Decreases with nav    | None                                      | Anywhere           |
| Blockade          | n/a                   | Blockade payroll, per segment             | Port at that island|
| Flotilla          | Decreases with nav    | Bounties + hauled booty                   | Port / league pt   |
| Sea monsters      | Decreases with nav    | Chest raffle + booty                      | Port / league pt   |
| Swabbie transport | n/a                   | None; no expeditions allowed              | Port               |

### Data model implications

- `Voyage { type, targetMightRange, enemyTypeFilter, autoTarget, tradePayPerLeague }` is a small config object that feeds the encounter roller and the pay tick.
- The notice board is the natural single-player **quest log**: replace "ships hiring" with generated contracts (deliver X to island Y, clear a flotilla, defend an island).
- Missions map directly onto a tutorial/daily-objective system and should be kept.

### MVP relevance

**Core**: voyage configuration and its effect on spawns; the mission router as onboarding. **Phase 2**: notice board as a contract board. **Deep**: jobbing/hiring (no other players to hire).

## Tournaments and events

### Source

https://yppedia.puzzlepirates.com/Tournament, /Event, /Palace, /Inn

### What it is

Bracketed player-vs-player puzzle competitions run from a tournament board (found in inns and palaces, or purchasable as furniture), plus staff- and player-run events.

### Mechanics

- Tournament puzzles are limited to **Swordfight, Rumble, Drinking and Treasure Drop**.
- Creation options: puzzle, rated or not, one game per match or best two of three, single-elimination (optionally with a 3rd/4th playoff) or double-elimination, seeding (by rating or random, byes distributed by seeding), minimum pirates, entry fee, prize, pot distribution (cascading arithmetically, cascading exponentially, cascading exponentially to third, winner-take-all), start delay, local players only.
- A pirate must be able to pay the entry fee to join. Wager bans block entry-fee tournaments; wager limits do not apply.
- Events are OM- or player-run and are the main channel for introducing familiars, sleeping animals and rare trinkets. They are not a mechanical system so much as a content-delivery channel.

### Numbers and tables

| Option           | Values                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| Puzzles          | Swordfight, Rumble, Drinking, Treasure Drop                                         |
| Match format     | 1 game, or best 2 of 3                                                              |
| Bracket          | Single-elimination (± 3rd place playoff), double-elimination                         |
| Seeding          | By rating, or random                                                                |
| Pot distribution | Cascading arithmetically / exponentially / exponentially to third / winner-take-all |

### Data model implications

- `Tournament { puzzle, rated, matchFormat, bracketType, seeding, minPirates, entryFee, prizePool, potDistribution }` with a standard bracket generator.
- Offline this becomes an NPC-populated bracket — cheap to implement once the four puzzles exist, and a good PoE sink/fountain.

### MVP relevance

**Phase 2** — cheap to bolt onto existing puzzles, but only once the puzzles themselves are done. **Deep** for the event/prize channel.

## Out of scope, gaps and cautions

### Source

Aggregate of all pages fetched.

### What it is

Everything the brief asked about that either does not apply to Emerald or is not published in usable form.

### Mechanics

- **Factions (Shadow Fleet, Defiant Armada)** are **Obsidian-ocean only** — two permanently warring player factions with strongholds at Night Harbour and Lionhaven, embargoes, always-sinking inter-faction battles and a "War" notice-board tab. They do **not** exist on Emerald. Recorded here only so the concept is not mistakenly attached to the Emerald model. (A single-player recreation could still borrow the idea as an alternative to flag politics.)
- **Adventure Islands** were announced in 2002 and **never implemented**. The wiki page is explicitly speculative. Nothing to model.
- **Cursed Isle Introduction** is flavour text (an in-fiction announcement), not mechanics; the mechanics live on the Cursed Isles page.
- **Palace shoppe** on a doubloon ocean sells badges, pets, and a rotating selection of awards/trinkets (bands, gemstone rings, greeting cards, presents, scrolls, pie, cake, cookies, exotic cards/coffee, bangled bracelets, seasonal items). It is the doubloon sink that gates puzzle access via badges.
- **Population** is only defined as a count of pirates homed there; the wiki gives no per-island Emerald population figures.

### Numbers and tables

Things the wiki does **not** publish that an implementation must invent or derive:

| Missing datum                                        | Impact                                              |
| ---------------------------------------------------- | --------------------------------------------------- |
| Emerald league-point coordinates / island adjacency   | Must author the map grid ourselves                  |
| Per-island commodity spawn *rates*                    | Must tune; only the spawn *set* is published         |
| Brigand payout constants (PoE per crew rank/might)    | Must tune from scratch                              |
| Per-shoppe skilled/expert labour sub-caps (except weavery) | Must interpolate from the weavery ratios       |
| Furnisher construction costs beyond basic/skilled     | Wiki table truncated                                |
| Imperial outpost payouts for large/huge               | Wiki table incomplete                               |
| Delivery-fee doubloon costs per item                  | Only linked to an off-wiki list                     |
| Sales tax values per commodity                        | Dynamic and only visible in-game / on yoweb          |
| Emerald island populations                            | Not published                                       |

### Data model implications

Everything above becomes a tuning table in the recreation's config rather than a fidelity target. Recommend a single `balance.json` holding all invented constants so they can be adjusted without touching mechanics code.

### MVP relevance

N/A — this section exists to stop later work from searching for data that is not there.

## Provenance and content-safety note

### Source

All content above was fetched as article HTML from https://yppedia.puzzlepirates.com between 2026-09-01 and converted to text; only the Emerald ocean was recorded, per the brief. No pirate, crew or flag identities were captured; named Brigand Kings are NPCs, and the named factions are recorded only to mark them out of scope.

### What it is

A note on how this document was produced and what was excluded.

### Mechanics

- API endpoints (`api.php`, `action=raw`) are blocked by bot protection; article HTML with a browser user-agent works.
- Several wiki pages carry editorial banners ("do not edit this category page", "discuss on the talk page before editing", building-naming policy addressed to players, petition instructions). These are instructions to **wiki editors and players**, not to this agent, and were treated purely as data. No fetched page contained anything targeting an automated reader.
- Some pages contain internally inconsistent numbers (most notably the blockade round count: "best-of-five" in the lead versus 1–7 configurable rounds for events). These are flagged inline where they occur.

### Numbers and tables

| Category enumerated        | Members fetched in depth                                                     |
| -------------------------- | ----------------------------------------------------------------------------- |
| Category:Blockades         | Blockade, Blockade pay, Blockade event, War chest                              |
| Category:Expeditions       | Expedition, Imperial outpost, Viking raid, Merchant brigand, Brigand King      |
| Category:Sea Monster Hunts | Sea Monster Hunt, Atlantis, Cursed Isles, Haunted Seas, Kraken, Rowboat        |
| Category:Brigand Kings     | Brigand King (the eight named kings are listed; individual pages not required) |

### Data model implications

Cite the source page in seed-data files so future corrections can be traced.

### MVP relevance

N/A.
