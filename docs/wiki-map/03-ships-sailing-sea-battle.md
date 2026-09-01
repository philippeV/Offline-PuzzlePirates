# Ships, Sailing and Sea Battle — Wiki Feature Map

A ship is a single mutable state object that four continuous scalar meters describe — speed, damage, bilge, loaded cannons — plus discrete stores (cannonballs by size, rum, commodities, PoE) and a roster of pirates bound to duty stations. Outside battle the ship advances along a graph of league points at a speed derived from `f(sailors' puzzle output, bilge level, ship class max speed)`, while damage and bilge climb on their own and carpenters and bilgers push them back down. When a sea battle starts, the same state object is projected onto a 24x24 tile board: the sailing/rigging stations stop feeding "speed" and start minting *movement tokens* (throttled by the bilge level), the gunnery station converts cannonballs into *loaded cannons* (one gun token each), and the navigator spends both across four ordered phases per turn. Cannon hits, rams and rock collisions raise the damage meter, which simultaneously accelerates bilge intake and pre-loads the boarding melee with unbreakable blocks. The battle terminates in disengage, sinking, or a grapple that hands the state over to a team swordfight/rumble; the winner takes a percentage of the loser's hold and booty, and the loop returns to the ocean map. Everything below is the wiki's account of that machine, in the detail an implementation needs.

> **Provenance note.** All content here is transcribed from yppedia.puzzlepirates.com article pages, treated strictly as data. Two source pages (`Bnav tutorial`, `Whirlpool tutorial`) are player-written guides whose prose is phrased as commands to the reader ("PRACTICE PRACTICE PRACTICE", "pay attention", "Use the applet"). Those are addressed to human players, not to any agent, and have been read only for mechanical facts; no external applet or forum link was followed. Only Emerald is retained where the wiki tabulates per-ocean values.

---

## Sea battle: stages and board

### Source
`Sea_battle`, `Movement` (disambiguation), `Bnav_tutorial`, `Crow's_nest`.

### What it is
The combat mini-game that replaces normal sailing when two ships intercept each other. Three stages in fixed order: **pursuit → navigation → boarding**.

### Mechanics
- **Pursuit.** Any officer aboard their own crew's ship selects a target on the open sea and presses "Attack" on the Vessel panel. Only one target may be pursued at a time. Interception requires approximately matching course and speed; if the target gets too far away the pursuit is auto-cancelled. Ships stopped *at* a league point can neither pursue nor be pursued. Both sides receive messages ("You are being pursued by '<ship>'", "You have been intercepted by the <ship>!").
- **Navigation stage.** The board is **24 squares across in both directions** (24x24). Each ship's commander plans the next turn by dragging tokens into four phase slots; the planning timer is **35 seconds** per turn. When the timer expires, both plans execute simultaneously, then planning for the next turn begins immediately. Meanwhile the rest of the crew keeps puzzling to supply tokens.
- **Board contents.** Own ship, enemy ship(s), rocks (tall and small), wind tiles, whirlpools (2x2), and — in blockades — buoys. Rocks and the board edge are impassable and damaging.
- **Visibility.** The crow's nest shows an enlarged battle board; everyone else sees it as a minimap. Since release 2015-04-28 a ship's planned moves can be hidden from non-officers.
- **Practicing.** Battle navigation can be practiced against the navy; navy practice does not consume the player's cannonballs. (Requires subscription/Narrow navigation experience on live oceans — irrelevant offline.)

### Numbers and tables
| Quantity                | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Board dimensions        | 24 x 24 tiles                                      |
| Phases per turn         | 4                                                  |
| Planning time per turn  | 35 seconds                                         |
| Cannon range            | 3 tiles                                            |
| Grapple range           | 1 tile                                             |
| Movement token lifetime | 5 turns unused, then discarded                     |
| Disengage counter start | 10 turns per vessel, +2 turns per cannonball taken |

### Data model implications
```
BattleBoard { width:24, height:24, tiles:Tile[], ships:ShipEntity[], turnIndex:int, phaseIndex:0..3 }
Tile        { kind: Open|RockTall|RockSmall|Wind(dir)|Whirlpool(id,corner)|Buoy(pennants,owner)|Flotsam(ttl,burning) }
ShipEntity  { pos:(x,y), facing:N|E|S|W, sizeClass, plan:Phase[4], disengageCounter:int }
Phase       { move: None|Forward|Left|Right|Maneuver(kind), fire: None|Guns(side,count)|Grapple(side) }
```
The turn loop is a fixed 4-iteration pipeline (see *Movement resolution*), not a free-running tick; a real-time client can animate each phase but the simulation is discrete.

### MVP relevance
**Core.** The 24x24 board, 4-phase turn, and 35s planning window are the spine of the whole game. The planning timer can be relaxed or made pausable in a single-player offline build.

---

## Tokens: movement, guns, grapples

### Source
`Sea_battle#Tokens`, `Bnav_tutorial`, `Maneuver`, `Cannon_counter`.

### What it is
Every action a ship can take in battle is a *token*: a movement token, a gun token, a grapple token, or (multi-ship boards only) a maneuver token. Tokens are a shared pool per ship, produced by the crew and spent by the navigator.

### Mechanics
- **Movement tokens** are produced by pirates on **sailing** and **rigging** stations. Three kinds: **turn left, straight (forward), turn right**. The wiki's whirlpool tutorials refer to them by colour — green = the token that moves the ship into the square directly ahead, with blue and gold being the two turn tokens (which of blue/gold is left vs right is not stated anywhere in the articles read; see *Gaps*). **The higher the bilge meter, the slower movement tokens are generated.** Unused movement tokens persist across turns but are **discarded after five turns**; hovering a token type shows how many will be discarded that turn.
- **Move budget per turn.** Small ships may play a movement token in **all four phases**; larger ships may only play movement in **three of the four phases**, and the commander chooses which phase the ship rests by dragging an octagonal "rest" icon into that phase.
- **Gun tokens** are produced one-per-cannon-loaded by the **gunnery** puzzle. Cannons may be loaded before battle. Gun tokens **do not expire**. Firing consumes one. Each gun token fires one ball to the left or right side.
- **Cannons per side.** The physical placement of gun stations does not limit which side can fire: a sloop with two guns per side may fire four shots from starboard in one turn. What is limited is **shots per phase per side** (1 or 2 depending on class — see the class table).
- **Grapple tokens** are unlimited and free (no resource cost, no status-bar effect). Range 1 tile, thrown off the left or right side. **Only one grapple per phase**, and **a phase carrying a grapple may not also carry gun tokens on either side.** Because grapples don't show on the activity bar, a ship that looks idle may have four grapples queued. Grapples are disabled on blockade, flotilla and Sea Monster Hunt boards.
- **Activity bar.** As the commander schedules actions, a bar above the ship fills — visible to the enemy. Movement and gun tokens fill it; grapples do not.
- **Token placement UI (last-second-move click cycling).** Clicking a move slot cycles: 1 left-click = left, 2 = straight, 3 = right, 4 = empty; right-clicks cycle the reverse (1 = right, 2 = straight, 3 = left, 4 = empty). In a gun slot: 1 click = shoot (or grapple if no cannons loaded), 2 = grapple, 3 = empty. On double-shot ships (longship, baghlah, brig- and frigate-class) 2 clicks = two shots that side, 3 = grapple, 4 = empty.

### Numbers and tables
| Token    | Produced by                                   | Expires       | Per-phase limit                     | Cost                   |
| -------- | --------------------------------------------- | ------------- | ----------------------------------- | ---------------------- |
| Movement | Sailing + Rigging stations                    | after 5 turns | 1 (3 or 4 phases per turn by class) | none (bilge-throttled) |
| Gun      | Gunnery station (1 per cannon)                | never         | 1 or 2 per side by class            | 1 cannonball each      |
| Grapple  | unlimited, always available                   | n/a           | 1 total, excludes guns that phase   | none                   |
| Maneuver | Sailing+Rigging / Carp+Patch / Bilge combined | (unstated)    | 1 (occupies the move slot)          | none                   |

### Data model implications
```
TokenPool { forward:int, left:int, right:int, guns:int, maneuvers: Map<ManeuverKind,{silver:int,gold:int}> }
// movement tokens need per-token age for the 5-turn expiry, so store as a list of {kind, age} or 3 age-bucketed counters
```
Movement-token generation rate is a function of puzzle score and bilge: `rate = base(shipClass) * puzzleQuality * bilgePenalty(bilge)`. The exact curve is undocumented — treat as a tunable.

### MVP relevance
**Core** for movement/gun/grapple tokens. **Phase 2** for maneuver tokens (multi-ship boards only).

---

## Movement resolution, collisions and ramming

### Source
`Collision_mechanics`, `Ramming`, `Sea_battle#Turns`, `Rock`.

### What it is
The deterministic algorithm resolving two (or more) ships' simultaneous moves into non-conflicting positions, plus the damage that conflicts produce.

### Mechanics
**Per-phase order of events** (stated identically on `Wind`, `Whirlpool` and `Bnav_tutorial`):
1. Movement tokens (if any) are played.
2. Wind and whirlpool movement, for ships resting on such tiles. *A ship pushed onto another special tile by this step is not affected again this phase — only on the next phase, if it is still there.*
3. Cannon fire and grappling.

**Collision algorithm (movement).** Turning ships are treated as passing through **two** squares: the square directly ahead, then the diagonal destination.
1. Every moving ship (regardless of direction) claims the square **directly in front of it**:
   - a. empty and unclaimed → move in.
   - b. contains a stationary ship → **bump** (below).
   - c. contains a moving ship that is claiming the first ship's square → both stop entirely (collision).
   - d. empty but claimed by a ship of the **same or larger** class → stop entirely (collision).
   - e. empty but claimed by a ship of **smaller** class → move in (collision).
2. Ships that are *turning* and have not stopped then claim their **destination** square:
   - a. empty and unclaimed → move in.
   - b. contains a stationary ship **or** a ship that moved there in step 1 → stop entirely (collision). *Class-independent: a sloop moving forward can block a frigate's turn.*
   - c. contains a moving ship claiming the first ship's square → stop entirely (collision).
   - d. empty but claimed by same-or-larger class → stop entirely (collision).
   - e. empty but claimed by smaller class → move in (collision).
3. **Orientation always changes** for any ship that attempted a turn, even one that "stopped entirely".

**Bump** (moving ship targets a tile occupied by a stationary ship):
- Mover is turning → nobody moves; the mover still rotates.
- Mover is going forward → the stationary ship is **pushed back one square**, the mover does not move.
- Mover is a smaller class than the stationary ship → nobody moves.
- Mover is a larger class → the mover **takes the tile** and the stationary ship is pushed one tile forward, staying in front of it (a "push").

**Collision algorithm (wind/whirlpool).** Identical rules, with "wind" behaving exactly like "forward" and "whirl" like "turn", except that in step 2 only cases (a) and (b) can occur — c, d and e never happen with whirlpools. A wind-pushed small ship can therefore block a large ship's whirl.

**Ram damage.** Both ships take damage sized by the *other* ship's class. If two facing ships of the **same size class** both move into each other, each takes **one** collision's worth. If they are of **different** size classes, **two** collisions' worth are dealt to each — explained as larger classes moving "before" smaller ones within a phase.

**Rocks and edges.** Ships can never enter a rock tile or leave the board; attempting it costs collision damage and the ship stays put. Tall rocks block cannon fire; small rocks can be fired over; both deal equal collision damage. During pirate winter rocks are re-skinned as icebergs (same rules). Board edges act as rocks — except the far edge of a flotilla/blockade board and the Atlantis entrance zone, which act as inward-facing wind. Hitting a rock deals **exactly 3 SF blocks** of damage to any ship = **one twelfth of full SF damage**.

### Numbers and tables

Ram damage dealt *by* the named ship, expressed as equivalent hits of a given shot size on the victim:

| Ship name        | Small | Medium | Large | Size class |
| ---------------- | ----- | ------ | ----- | ---------- |
| Sloop            | 0.5   | 0.333  | 0.25  | Small      |
| Cutter           | 0.5   | 0.333  | 0.25  | Small      |
| Dhow             | 0.5   | 0.333  | 0.25  | Small      |
| Fanchuan         | 0.5   | 0.333  | 0.25  | Small      |
| Longship         | 0.5   | 0.333  | 0.25  | Medium     |
| Baghlah          | 1     | 0.667  | 0.5   | Medium     |
| Merchant brig    | 1     | 0.667  | 0.5   | Medium     |
| Junk             | 1.5   | 1      | 0.75  | Medium     |
| War brig         | 2     | 1.333  | 1     | Medium     |
| Merchant galleon | 2.5   | 1.667  | 1.25  | Large      |
| Xebec            | 2.5   | 1.667  | 1.25  | Large      |
| War galleon      | ?     | ?      | ?     | Large      |
| War frigate      | 3     | 2      | 1.5   | Large      |
| Grand frigate    | 4     | 2.667  | 2     | Grand      |

Rock / board-edge damage *taken* by the named ship (equivalent hits by shot size; always equals 3 SF blocks):

| Ship name        | Small   | Medium | Large    |
| ---------------- | ------- | ------ | -------- |
| Sloop            | 0.5     | 0.333  | 0.25     |
| Cutter           | 0.625   | 0.417  | 0.3125   |
| Dhow             | 0.625   | 0.417  | 0.3125   |
| Fanchuan         | 0.65625 | 0.4375 | 0.328125 |
| Longship         | 0.75    | 0.5    | 0.375    |
| Baghlah          | 1       | 0.667  | 0.5      |
| Merchant brig    | 1       | 0.667  | 0.5      |
| Junk             | 1.25    | 0.833  | 0.625    |
| War brig         | 1.25    | 0.833  | 0.625    |
| Merchant galleon | 1.5     | 1      | 0.75     |
| Xebec            | 1.75    | 1.167  | 0.875    |
| War galleon      | 1.25    | 0.833  | 0.625    |
| War frigate      | 2.5     | 1.667  | 1.25     |
| Grand frigate    | 3       | 2      | 1.5      |

Note the two class taxonomies do not agree: the longship is *Medium* for ram purposes but behaves as a small-cannon ship, and the war galleon is *Large* for ram class while having war-brig-like sinking damage. Model `ramSizeClass` and `cannonSize` as independent fields.

### Data model implications
Implement resolution as a two-pass claim-and-resolve over a `Map<Tile, Claim[]>`, exactly as written; the rules are already an algorithm. Damage is accumulated in "small-cannonball equivalents" as a float, then converted to the ship's damage-meter fraction using the class's `fullDamage_small` value.

### MVP relevance
**Core.** Collision resolution is the single most rule-dense part of the simulation and cannot be approximated without the game feeling wrong.

---

## Wind, rocks and whirlpools

### Source
`Wind`, `Rock`, `Whirlpool`, `Whirlpool_movement`, `Whirlpool_tutorial`.

### What it is
The three special tile types on the battle board.

### Mechanics
- **Wind** ("streams") tiles move a ship one square **to leeward** (the direction the wind blows toward), during step 2 of each phase, without changing orientation. Navigators use them for free movement; mis-planning pushes ships into rocks, the border, or another ship.
- **Rocks** — see previous section. Tall rocks additionally **block line of fire**; small rocks do not.
- **Whirlpools** ("tides") occupy a **2x2 tile area**. On each phase in which a ship rests on one, the whirlpool moves the ship **clockwise to the opposite corner** of the whirlpool *and simultaneously rotates it 90° clockwise*. A ship that begins a turn in a whirlpool and plays no movement tokens ends the turn (after four phases) in exactly the same position and orientation.
- **Whirlpool entrances.** A whirlpool has eight entry spots of two types: **open** entrances (where the water is visibly sucked in) and **closed** entrances. Which one a ship enters through determines the resulting cycle. Documented in-whirlpool manoeuvres:
  - *Walk in place* — inside the whirlpool with the ship's **rear touching a closed entrance**, play the blue token: same position, same orientation. Lets a ship fire four times instead of two across a turn.
  - *Jump ahead* (flip) — inside, **rear touching an open entrance**, play the gold token: same tile, now pointing out of instead of into the whirlpool. Yields an extra shot.
  - *Switch corners* — inside, rear touching **any** entrance, play the green token: changes which pair of corners the ship bounces between.
  - Entry patterns from outside: right turn = two green tokens from an open entrance; left turn = two green tokens from a closed entrance with two skipped phases between them; straight across from open = green, skip two, gold; straight across from closed = green then blue; 180° turn = green, skip, green from any entrance.
  - A ship parallel to (not pointing into) a whirlpool that uses a gold or blue token to enter is equivalent to a pointed-in ship using green.

### Numbers and tables
| Tile         | Footprint | Effect per phase (step 2)                      | Blocks fire | Damage on entry attempt |
| ------------ | --------- | ---------------------------------------------- | ----------- | ----------------------- |
| Wind         | 1x1       | +1 square in wind direction, no rotation       | no          | n/a                     |
| Rock (tall)  | 1x1       | impassable                                     | yes         | 3 SF blocks             |
| Rock (small) | 1x1       | impassable                                     | no          | 3 SF blocks             |
| Whirlpool    | 2x2       | move to opposite corner + rotate 90° clockwise | no          | none                    |
| Board edge   | —         | impassable (acts as rock)                      | —           | 3 SF blocks             |
| Flotsam      | 1x1       | ship entering loses remaining moves that turn  | no          | burning variant damages |

### Data model implications
Whirlpool state is not per-ship — it is derived from `(shipTile, shipFacing, whirlpoolOrigin)`. Implement as a pure function `whirl(pos, facing, wp) -> (pos', facing')` that maps each of the four corner cells to the diagonally opposite one plus a 90° CW rotation. Wind is `pos + dir`. Flotsam is a timed tile placed by a maneuver, immune to wind and not moved by it.

### MVP relevance
Wind and rocks: **core**. Whirlpools: **core** (they appear on ordinary pillage boards), though the entry-pattern table is **deep** polish.

---

## Cannon fire, ranges and damage values

### Source
`Sea_battle#Damage`, `Sea_battle#Damage chart`, `Ship#Damage`, `Cannon_ball`, `Cannon_counter`, `Gunning`.

### What it is
The offensive half of the navigation stage: converting hold cannonballs into board damage and into melee handicap.

### Mechanics
- Gunners load cannons in the gunnery puzzle; each successfully loaded cannon consumes **one cannonball of the ship's size** from the hold and increments the cannon counter, giving the navigator one gun token.
- If the hold is out of the correct size cannonball, gunners stop receiving shot pieces and get "This ship has run out of [size] cannonballs!".
- The counter does not tell the commander how many cannons remain unloaded — they must know their ship's gun count.
- The counter only decrements when a shot is fired in battle, or resets to zero after time in port (on navy ships it also drops when a gunner leaves the station).
- **Firing.** A gun token fires one ball off the left or right side, straight out, **range 3 tiles**. Tall rocks block the line; small rocks do not. Ships may fire 1 or 2 shots per side per phase depending on class.
- **Ships damage each other four ways**: cannon fire, attempting to enter a forbidden square (rock or off-board), being rammed, and ordinary wear and tear.
- **Two damage effects per hit.** A hit damages the *boat* (harder to sail, can sink it) and damages the *pirates* (unbreakable **black blocks** at the bottom of the swordfight board, or a grey block at the top of the rumble board). Wear-and-tear damage does **not** produce melee blocks.
- **Two ceilings.** `Max SF/Rumble Damage` is the point past which further shots no longer worsen the enemy's melee; `Full Damage` is the point at which the ship is fully damaged (sinks, if in a sinking context). Because carpenters repair during battle, more shots than the table value are usually needed to reach Full Damage in practice. Shooting past Full Damage has no effect except denying the enemy any repair.
- **Friendly fire** (same-faction blockade / all player ships in a flotilla): 50% of normal shot and ram damage. Not applied in Brigand King blockades or Atlantis.

### Numbers and tables

Number of hits of each shot size required to reach each ceiling:

| Ship name        | Max SF/Rumble: Small | Max: Med | Max: Large | Full: Small | Full: Med | Full: Large |
| ---------------- | -------------------- | -------- | ---------- | ----------- | --------- | ----------- |
| Sloop            | 6                    | 4        | 3          | 10          | 6.667     | 5           |
| Cutter           | 7.5                  | 5        | 3.75       | 12          | 8         | 6           |
| Dhow             | 7.5                  | 5        | 3.75       | 12          | 8         | 6           |
| Fanchuan         | 7.875                | 5.225    | 3.9375     | 13.125      | 8.75      | 6.5625      |
| Longship         | 9                    | 6        | 4.5        | 15          | 10        | 7.5         |
| Baghlah          | 12                   | 8        | 6          | 20          | 13.333    | 10          |
| Merchant brig    | 12                   | 8        | 6          | 20          | 13.333    | 10          |
| Junk             | 15                   | 10       | 7.5        | 25          | 16.66     | 12.5        |
| War brig         | 15                   | 10       | 7.5        | 25          | 16.667    | 12.5        |
| Merchant galleon | 18                   | 12       | 9          | 30          | 20        | 15          |
| Xebec            | 21                   | 14       | 10.5       | 35          | 23.333    | 17.5        |
| War galleon      | 15                   | 10       | 7.5        | 25          | 16.667    | 12.5        |
| War frigate      | 30                   | 20       | 15         | 50          | 33.333    | 25          |
| Grand frigate    | 36                   | 24       | 18         | 60          | 40        | 30          |

Shot size is a property of the ship, not a choice:

| Cannon size | Ship types                                                                | Mass    | Volume |
| ----------- | ------------------------------------------------------------------------- | ------- | ------ |
| Small       | Sloop, cutter, longship                                                   | 7.1 kg  | 1 L    |
| Medium      | Dhow, baghlah, merchant brig, war brig, xebec                             | 14.2 kg | 2 L    |
| Large       | Fanchuan, junk, merchant galleon, war galleon, war frigate, grand frigate | 21.3 kg | 3 L    |

Derived relationships worth encoding: `Max SF damage = 0.6 * Full damage` for every class; `medium ball = 1.5 x small`, `large ball = 2 x small`. Rock damage = 3 SF blocks = `Max SF damage / 12` in small-ball equivalents.

### Data model implications
Store damage as a single float `damage ∈ [0,1]` of `fullDamage`. A hit adds `shotWeight / fullDamage_smallEquivalent`. Melee blocks = `min(damage, 0.6) / 0.6 * 36` black blocks, capped at 36 (6 rows of 6). Cannonball consumption happens at *load* time, not at fire time — a critical ordering detail.

### MVP relevance
**Core.**

---

## Grappling, boarding and melee resolution

### Source
`Sea_battle#Boarding stage`, `Sea_battle#Winning and losing`, `Swordfighting`, `Rumble`, `Sinking`.

### What it is
The terminal stage: a team puzzle fight whose starting handicap encodes the navigation stage's outcome.

### Mechanics
- A grapple thrown at range 1 that hits the enemy ship ends the navigation stage instantly ("grappled"); all puzzling stops.
- **Swordfight vs rumble.** Brigands and merchants → team **swordfight**; barbarians → team **rumble**. In PvP, if both ships are configured barbarians-only, or one targets barbarians and out-performs the other at duty navigation, the fray is a rumble instead of a swordfight.
- **Damage handicap.** Each team receives blocks proportional to the damage its ship took. In swordfight these are immovable **black blocks** filling the board from the bottom up, to a **maximum of 6 rows / 36 blocks**. In rumble they appear as grey blocks at the top of the board.
- **Rum sickness.** If the ship is out of rum, its crew fights impaired: in swordfight the **leftmost and rightmost columns** are filled with immovable rum-jug blocks; in rumble the glove aiming is modified.
- **Swordfight elimination.** A player loses when their fourth column fills to the top so no more pieces can enter. Teams fight until every member of one side is knocked out. Knocked-out players spectate. A sword landing in the top of column four is an **instakill**; sprinkles cannot instakill (they refuse to land there).
- **Teaming.** The commanding officer directs who teams on whom; teaming configurations are shown live as dots next to each opponent's mini-board. In rumble, a player can **defend** a teammate by clicking their portrait, absorbing part of the strikes aimed at them and removing them from the opposing team's target list while the defence holds.
- **Board.** Swordfight board is 6 wide x 13 high (78 spaces). Pieces fall in pairs from column four.
- Pirates must not change rooms between stages or (per a noted bug) they may be excluded from the melee.

### Numbers and tables
| Quantity                          | Value                                                 |
| --------------------------------- | ----------------------------------------------------- |
| Swordfight board                  | 6 x 13 (78 cells)                                     |
| Max ship-damage black blocks      | 36 (6 full rows)                                      |
| Rum-sickness columns blocked (SF) | leftmost + rightmost                                  |
| Loss condition                    | column 4 full to the top                              |
| Sprinkle rate                     | 1 grey block per 2 loose blocks broken (rounded down) |
| Fuse threshold                    | 2x2 or larger same-colour rectangle → sword strike    |
| Chain multiplier                  | nth link multiplies that link's attack by n           |

### Data model implications
The melee is a separate sub-simulation with its own board state; the only interface from the ship layer is `(blackBlockRows, rumSick, teamRoster[], opponentRoster[])` in and `winnerTeam` out. Keep that boundary clean so the melee can be stubbed (auto-resolve by aggregate crew skill vs handicap) in an early build.

### MVP relevance
Grapple → battle end: **core**. A fully faithful swordfight/rumble implementation: **phase 2** (an auto-resolver keyed on damage blocks is sufficient for an MVP pillage loop).

---

## Ending the navigation stage: disengage and sinking

### Source
`Sea_battle#End of navigation stage`, `Sinking`, `Ship_salvaging`.

### What it is
The two non-boarding exits from battle.

### Mechanics
- **Disengaging.** Each vessel has a disengage counter starting at **10 turns**. Every cannonball that hits a vessel adds **2 turns** to *that ship's* counter. The counter ticks down each turn; at zero the ship may choose to disengage, returning both ships to normal sailing. If the counter is at zero and the ship is hit that turn, it goes back up and the ship must wait again. (Effectively: a ship that is being successfully hurt cannot flee.)
- **Sinking** occurs only when the damage meter becomes *completely* full, and only in: sinking blockade, sinking flotilla, sinking imperial outpost, Atlantis, Cursed Isles, Haunted Seas, or PvP between flags at war. A ship sinks only if **shot or rammed** — rock damage never sinks, and a ship entering battle already at full damage does not sink immediately.
- Sinking loses: the vessel deed (converted to a **ship in a bottle**), charts and maps on the table, the entire hold, the coffers, the booty, and furniture-with-contents. All aboard are sent to the ship's last island. Small chance of an injury; those not injured get a fish. Pets swim to safety.
- **Salvaging.** The bottle decays after **60 calendar days**. Taken to a shipyard ("Salvage yer Ship") it rebuilds the ship with its paint, furniture, props, name and class intact but empty of hold/coffers/booty/charts, at the cost of building a new ship of that base type (limited-edition variants cost the same as the plain type).
- In a normal (non-sinking) blockade a ship at full damage is "sunk" for the board but not lost.

### Numbers and tables
| Quantity                        | Value                                   |
| ------------------------------- | --------------------------------------- |
| Disengage counter, initial      | 10 turns                                |
| Disengage penalty per hit taken | +2 turns                                |
| Ship-in-a-bottle decay          | 60 calendar days                        |
| Salvage cost                    | = cost of a new base ship of that class |

### Data model implications
`disengageCounter` lives on the ship entity and is decremented once per *turn*, not per phase. Sinking must be gated by a `sinkingContext: bool` flag on the battle, not on the damage value alone.

### MVP relevance
Disengage: **core** (it's how a losing pillage ends without a wipe). Sinking and salvaging: **phase 2** (needs a war/PvP context that an offline build may not have at first).

---

## Maneuvers (multi-ship boards)

### Source
`Maneuver`, `Sailing#Token sailing`, `Carpentry#Token carpentry`, `Patching#Token patching`, `Bilging`.

### What it is
A fifth token class available only on **blockade, flotilla and Sea Monster Hunt** boards, earned cooperatively by all three duty-puzzle groups.

### Mechanics
- Duty puzzlers with **Apprentice** experience or better, performing well, see extra **bonus symbols** on their puzzle pieces. Combining/clearing them contributes progress toward a maneuver.
- Effort is split three ways: **sailing + rigging** contribute one third, **carpentry + patching** one third, **bilging** one third. Three vertical bars — yellow (sailing), red (carpentry), blue (bilging) — must all fill before the token is awarded. The puzzler's own bar is shown wide, the other two narrow.
- The navigator can click a maneuver on the helm to nominate it as the target; that choice is broadcast to every puzzler's progress meter.
- **Two tiers per maneuver.** Silver first; further work upgrades it to gold. Spending the silver before the gold completes re-credits the accumulated work toward another silver.
- Per-puzzle contribution rules: in **token sailing**, two matching adjacent bonus shapes cleared in the same platform or line clear award progress (colours need not match); a qualifying clear at chain step 3+ awards extra. In **token carpentry**, four matching quarters must form a 2x2 in the completed hole; a symbol in a Masterpiece counts double, in Craftsmanship/Fair Job counts once, in Sloppy Work/Pig's Breakfast counts nothing; on a sloop two awarded token units fill a meter. In **token patching**, the four pieces around a token must all connect to the spool; if multiple *types* are activated on one board they all turn red and nothing is credited.

### Numbers and tables

| Shape   | Tier   | Effect                                                                                                                                                         |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Circle  | Silver | **Chain shot** — destroys movement tokens on the ship hit                                                                                                      |
| Circle  | Gold   | **Skull shot** — same token loss plus extra damage                                                                                                             |
| Diamond | Silver | **In-place turn** — go to broadsides without moving a square; direction is clickable after placement                                                           |
| Diamond | Gold   | **In-place turn with tidal wave** — floods any ship in the way; bilge dealt is 50% regardless of size                                                          |
| Plus    | Silver | **Double forward move** — two squares for one token's time                                                                                                     |
| Plus    | Gold   | **Ramming speed** — double move, rams as if a larger vessel                                                                                                    |
| Cross   | Silver | **Flotsam** — drops a cluster behind the ship for a few turns; a ship entering it loses the rest of its moves that turn. Unaffected by, and not moved by, wind |
| Cross   | Gold   | **Burning flotsam** — as above plus damage                                                                                                                     |
| Flower  | Silver | **Banish zombies** — Cursed Isles only                                                                                                                         |
| Flower  | Gold   | **Control thralls** — Cursed Isles only                                                                                                                        |

Chain/skull shots from a larger cannon destroy more movement tokens than from a smaller one.

Tokens required per station (silver/gold) — the wiki table is largely unfilled:

| Ship            | Bilge | Carpentry | Sailing |
| --------------- | ----- | --------- | ------- |
| Sloop, circle   | 3/6   | 2/4       | 2/4     |
| Sloop, diamond  | 3/6   | 2/4       | 3/6     |
| Sloop, plus     | 3/6   | 1/2       | 3/6     |
| Sloop, X        | 4/8   | 1/2       | 1/2     |
| Sloop, flower   | 1/2   | 1/2       | 1/2     |
| Cutter, circle  | 5/10  | 3/6       | 3/6     |
| Cutter, diamond | 5/10  | 3/6       | 5/10    |
| Cutter, plus    | 5/10  | 2/4       | 5/10    |
| Cutter, X       | 6/12  | 1/2       | 2/4     |
| Cutter, flower  | 2/4   | 2/4       | 2/4     |

Flower-only values are published for dhow, longship (2/4 each station), merchant brig (4/8) and merchant galleon (5/10); all other cells are "?/?" on the wiki.

### Data model implications
```
ManeuverProgress { target:ManeuverKind, sail:0..1, carp:0..1, bilge:0..1 }  // all three must hit 1.0
```
Maneuvers occupy the movement slot of a phase. Chain/skull shot needs a "destroy N movement tokens on target" effect, which means the enemy's token pool must be mutable from outside.

### MVP relevance
**Phase 2** at best — maneuvers exist only on multi-ship boards, which are themselves phase-2 content. **Deep** for the exact per-ship token costs, most of which the wiki does not have.

---

## Ship state model and meters

### Source
`Vessel_panel`, `Damage_meter`, `Bilge_meter`, `Speed_meter`, `Cannon_counter`, `Ship`, `Duty_report`.

### What it is
The four live meters plus the stores that constitute a ship's runtime state, and the feedback loops between them.

### Mechanics
- **Damage meter.** Rises slowly on its own (wear and tear), and jumps on cannon hits, rock/edge collisions, and rams. **Damage causes the bilge meter to fill faster.** Reduced by the **carpentry** and **patching** puzzles. Full damage = sinkable (in sinking contexts) and maximum melee handicap.
- **Bilge meter.** Constantly rising — "even the simple act of sailing around lets water into the bilge". High bilge **caps the ship's achievable speed** and **slows movement-token generation in battle**. Reduced by the **bilging** puzzle. Good carpentry also slows the rate at which bilge enters.
- **Speed meter.** Raised by **sailing** and **rigging**; **duty navigation multiplies the sailors' effectiveness** (adds a bonus on top of what sailing/rigging provide); capped by bilge and by the ship class's own maximum. Displayed as a percentage of *that ship's* maximum (changed from "percentage of a sloop's max" in release 2008-10-14). All ships share a minimum speed of about **0.2 leagues/minute (1 league per 5 minutes)**.
- **Cannon counter.** Number of guns currently loaded. Incremented by gunnery, decremented by firing, reset to zero after time in port.
- **Rum.** Consumed over the voyage; running out causes rum sickness in the melee. Restocked at port.
- **Stores.** Cannonballs of the ship's size, rum, commodities, and PoE, all constrained by the hold's shared mass and volume limits (the booty chest shares the hold's capacity).
- **Idle reset.** A ship left unmanned in port resets damage and bilge to zero after **15–30 minutes**; stepping aboard restarts the timer.
- **Floating.** A ship with nobody on any station still moves league-point to league-point at minimum speed, but damage and bilge rise unchecked.
- **Duty report.** At every league point, on entering battle, and at breaks in multi-ship battles, every puzzler sees a per-pirate rating for the previous league: **Booched, Poor, Fine, Good, Excellent, Incredible** (Booched/Poor are shown as a green "Learning" for greenies). Ratings are textual bands over an underlying numeric score. Order of duties in the report is fixed: Navigating, Sailing, Rigging, Gunnery, Carpentry, Patching, Bilging, Treasure Haul.

### Numbers and tables
| Meter   | Raised by                            | Lowered by           | Downstream effect                              |
| ------- | ------------------------------------ | -------------------- | ---------------------------------------------- |
| Damage  | shots, rams, rocks, wear-and-tear    | carpentry, patching  | ↑ bilge fill rate; melee black blocks; sinking |
| Bilge   | time, ↑ by damage                    | bilging              | ↓ max speed; ↓ movement-token generation rate  |
| Speed   | sailing, rigging, x navigation bonus | bilge, turning about | league traversal time                          |
| Cannons | gunnery (consumes 1 cannonball each) | firing, porting      | gun tokens available to the navigator          |

Puzzle scoring (player-derived, developer-unconfirmed): moves are scored at a maximum of 10 seconds per move — slower than 10s scores zero; the reported figure is the **average** of scores within a rolling **3-minute** frame.

### Data model implications
```
Ship {
  class:ShipClass
  damage:float 0..1, bilge:float 0..1, speed:float 0..1, cannonsLoaded:int
  hold: { rum:int, cannonballs:int, commodities:Map<Commodity,int>, poe:int }
  booty:{ commodities:Map<Commodity,int>, poe:int }   // shares hold mass/volume budget
  stations: Map<StationSlot, PirateRef>
  crew: PirateRef[]
}
```
The meter loop is a fixed-timestep integrator:
`bilge += (baseBilgeRate(class) * (1 + damage*k) - bilgePuzzleOutput) * dt`
`damage += (wearRate - carpentryOutput) * dt`
`speed → clamp(target(sailOutput * navMultiplier), 0, maxSpeed(class) * bilgePenalty(bilge))`
None of the constants are published; expose all of them as tuning data.

### MVP relevance
**Core.** This is the smallest complete simulation that makes the duty puzzles matter.

---

## Ship classes and published stats

### Source
`Ship#Capacity`, `Ship#Blockades`, `Ship#Ship handling and station performance`, `Speed_meter`, `Configure_voyage`, `Cannon_ball`.

### What it is
Fourteen base classes (plus limited-edition/design variants that share base stats). All published tables, copied.

### Mechanics
Capacity determines how many pirates fit and how many of each station exist. Note *Sails* counts sailing/rigging stations, *Carp* counts carpentry/patching stations, *Bilge* counts bilging stations, *Guns* counts gunnery stations, *Shots* is the total cannon count (guns x 4 on most classes — this is the number of cannons that can be loaded, i.e. the maximum cannon-counter value). Mass and Volume are hold capacity in kg and litres, shared with the booty chest, with a hard cap of 32,767 units of any one commodity.

### Numbers and tables

Capacity and stations:

| Ship name        | Pirates | Sails | Carp | Bilge | Guns | Gun size | Shots | Mass (kg) | Volume (L) |
| ---------------- | ------- | ----- | ---- | ----- | ---- | -------- | ----- | --------- | ---------- |
| Sloop            | 7       | 3     | 2    | 2     | 1    | small    | 4     | 13,500    | 20,250     |
| Cutter           | 12      | 5     | 3    | 2     | 2    | small    | 8     | 40,500    | 60,750     |
| Dhow             | 12      | 5     | 3    | 2     | 1    | medium   | 4     | 13,500    | 20,250     |
| Fanchuan         | 12      | 5     | 3    | 2     | 1    | large    | 4     | 13,500    | 20,250     |
| Longship         | 15      | 5     | 3    | 3     | 3    | small    | 12    | 13,500    | 20,250     |
| Baghlah          | 18      | 6     | 4    | 4     | 3    | medium   | 12    | 18,000    | 27,000     |
| Junk             | 18      | 6     | 4    | 4     | 3    | large    | 12    | 18,000    | 27,000     |
| Merchant brig    | 20      | 6     | 9    | 6     | 2    | medium   | 8     | 90,000    | 135,000    |
| War brig         | 30      | 9     | 6    | 4     | 4    | medium   | 16    | 54,000    | 81,000     |
| Merchant galleon | 30      | 9     | 14   | 14    | 3    | large    | 12    | 270,000   | 405,000    |
| War galleon      | 40      | 12    | 8    | 7     | 6    | large    | 24    | 90,000    | 135,000    |
| Xebec            | 45      | 14    | 9    | 8     | 6    | medium   | 24    | 121,500   | 182,250    |
| War frigate      | 75      | 18    | 18   | 12    | 6    | large    | 24    | 216,000   | 324,000    |
| Grand frigate    | 159     | 30    | 24   | 16    | 6    | large    | 24    | 540,000   | 810,000    |

Battle-board stats (published on the Blockades section but the move/shot columns govern all sea battles):

| Ship name        | Influence dia. | Min crew for influence | Max crew | Stations (excl. helm) | Move tokens/turn | Cannon shots/move | Cannon size | Firepower/turn (small-equiv) | Sinking damage (small-equiv) |
| ---------------- | -------------- | ---------------------- | -------- | --------------------- | ---------------- | ----------------- | ----------- | ---------------------------- | ---------------------------- |
| Sloop            | 1              | 3                      | 7        | 8                     | 4                | 1 per side        | small       | 1                            | 10                           |
| Cutter           | 2              | 4                      | 12       | 12                    | 4                | 1 per side        | small       | 1                            | 12                           |
| Dhow             | 2              | 4                      | 12       | 11                    | 4                | 1 per side        | medium      | 1.5                          | 12                           |
| Fanchuan         | 2              | 4                      | 12       | 11                    | 3                | 1 per side        | large       | 2                            | 13.125                       |
| Longship         | 2              | 5                      | 15       | 14                    | 4                | 2 per side        | small       | 2                            | 15                           |
| Baghlah          | 4              | 6                      | 18       | 17                    | 3                | 2 per side        | medium      | 3                            | 20                           |
| Merchant brig    | 4              | 7                      | 20       | 23                    | 3                | 1 per side        | medium      | 1.5                          | 20                           |
| Junk             | 4              | 6                      | 18       | 18                    | 3                | 1 per side        | large       | 2                            | 25                           |
| War brig         | 6              | 8                      | 30       | 23                    | 3                | 2 per side        | medium      | 3                            | 25                           |
| Merchant galleon | 6              | 13                     | 30       | 40                    | 3                | 1 per side        | large       | 2                            | 30                           |
| Xebec            | 6              | 12                     | 45       | 37                    | 3                | 2 per side        | medium      | 3                            | 35                           |
| War galleon      | 6              | 12                     | 40       | 36                    | 3                | 2 per side        | large       | 4                            | 25                           |
| War frigate      | 8              | 17                     | 75       | 54                    | 3                | 2 per side        | large       | 4                            | 50                           |
| Grand frigate    | 10             | 29                     | 159      | 76                    | 3                | 2 per side        | large       | 4                            | 60                           |

Speed by class (min speed is identical for all; max is relative to a sloop):

| Ship name        | Min speed (min/LP) | Max speed (min/LP) | % of sloop | Ram size class |
| ---------------- | ------------------ | ------------------ | ---------- | -------------- |
| Sloop            | 5                  | 1:00               | 100%       | Small          |
| Cutter           | 5                  | 1:00               | 100%       | Small          |
| Dhow             | 5                  | 1:00               | 100%       | Small          |
| Fanchuan         | 5                  | 1:00               | 100%       | Small          |
| Longship         | 5                  | 1:15               | 80%        | Medium         |
| Baghlah          | 5                  | 1:15               | 80%        | Medium         |
| Merchant brig    | 5                  | 1:15               | 80%        | Medium         |
| War brig         | 5                  | 1:15               | 80%        | Medium         |
| Junk             | 5                  | 1:25               | 70%        | Medium         |
| Merchant galleon | 5                  | 1:40               | 60%        | Large          |
| Xebec            | 5                  | 1:40               | 60%        | Large          |
| War galleon      | 5                  | 1:40               | 60%        | Large          |
| War frigate      | 5                  | 1:40               | 60%        | Large          |
| Grand frigate    | 5                  | 1:40               | 60%        | Grand          |

Crew requirements for a ship staffed only by NPC swabbies (all figures assume "low fine" swabbie performance; times are for **diagonal** leagues — horizontal leagues take 40% longer):

| Ship name        | Swabbies | Swabbie cut-off | Min carp | Min bilge |
| ---------------- | -------- | --------------- | -------- | --------- |
| Sloop            | 5        | 6               | 1        | 1         |
| Cutter           | 10       | 11              | 1        | 1         |
| Dhow             | 10       | 11              | 1        | 1         |
| Fanchuan         | 10       | 11              | 1        | 1         |
| Longship         | 13       | 14              | 2        | 1         |
| Baghlah          | 16       | 17              | 2        | 1         |
| Merchant brig    | 18       | 19              | 2        | 1         |
| War brig         | 22       | 23              | 2        | 1         |
| Junk             | 16       | 17              | 2        | 2         |
| Merchant galleon | 28       | 29              | 4        | 3         |
| Xebec            | 36       | 37              | 4        | 3         |
| War galleon      | 32       | 33              | 2        | 2         |
| War frigate      | 54       | 55              | 6        | 3         |
| Grand frigate    | 75       | 76              | 12       | 4         |

Swabbie transport staffing and cost (5 PoE per swabbie per league point):

| Ship name        | Swabbie staffing | Cost per league |
| ---------------- | ---------------- | --------------- |
| Sloop            | 5                | 25 PoE          |
| Cutter           | 7                | 35 PoE          |
| Dhow             | 7                | 35 PoE          |
| Fanchuan         | 7                | 35 PoE          |
| Longship         | 9                | 45 PoE          |
| Baghlah          | 10               | 50 PoE          |
| Junk             | 10               | 50 PoE          |
| Merchant brig    | 12               | 60 PoE          |
| War brig         | 14               | 70 PoE          |
| Merchant galleon | 19               | 95 PoE          |
| War galleon      | 20               | 100 PoE         |
| Xebec            | 22               | 110 PoE         |
| War frigate      | 33               | 165 PoE         |
| Grand frigate    | 46               | 230 PoE         |

Other class facts: swabbie count drops back to 4 (3 on a sloop) on entering a flotilla, Sea Monster Hunt or non-event blockade; swabbies begin leaving once (yellow-named players + swabbies) reaches the cut-off; a player leaving mid-battle is replaced by a swabbie immediately, and thereafter one swabbie arrives per three departures.

### Data model implications
One static `ShipClass` record per class holding: `pirateCap, sailStations, carpStations, bilgeStations, gunStations, cannonSize, cannonCount, holdMass, holdVolume, movesPerTurn, shotsPerSidePerPhase, ramSizeClass, ramDamage{s,m,l}, rockDamage{s,m,l}, maxSfDamage{s,m,l}, fullDamage{s,m,l}, minSpeedMinPerLP, maxSpeedMinPerLP, influenceDiameter, swabbieStaffing, swabbieCutoff, minCarp, minBilge`. This is a single data file, and it should be the *only* place ship differences live.

### MVP relevance
**Core** for capacity, moves/turn, shots/side, cannon size, damage ceilings and speed. **Phase 2** for influence diameter (blockade-only) and swabbie transport. Starting with sloop + cutter + war brig covers small/medium and both move budgets.

---

## Duty puzzles as inputs to ship state

### Source
`Sailing`, `Rigging`, `Bilging`, `Carpentry`, `Patching`, `Gunning`, `Navigation`, `Duty_puzzle`, `Duty_puzzle_scoring`, `Treasure_Haul`.

### What it is
Seven puzzles, each an independent mini-game whose *only* output into the ship layer is a score that drives one meter.

### Mechanics
| Puzzle          | Station    | Board                                                                                                                                                                          | Feeds                                                                                |
| --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Sailing         | Sails      | 8 columns x 16 rows, falling pairs (Dr. Mario-like); pieces are water/blue, rope/yellow, wind/white; fill outlined targets to clear a platform; 4+ in a line clears            | Speed up; movement tokens in battle                                                  |
| Rigging         | Sails      | hexagonal grid, 6 pulleys, one active, rotating clockwise each move; pull large chains in front of the active pulley; rope coil of 20 loops → wild piece                       | Same as sailing (alternative)                                                        |
| Bilging         | Bilge      | match-3 swap grid with a waterline that tracks the bilge meter                                                                                                                 | Bilge down                                                                           |
| Carpentry       | Carp       | place 5-square pentominoes over holes; up to 4 holes; Masterpiece = exact-piece fill; neglect counter allows 7 skips, 8th damages                                              | Damage down; slows bilge intake                                                      |
| Patching        | Carp       | connect spool to tie-off through tears before a wind-gust timer; gust auto-activates the spool                                                                                 | Damage down (alternative to carpentry)                                               |
| Gunnery         | Guns       | route powder → wad → shot pieces into 4 cannons using up to 3 placed arrows; bucket cleans a mis-loaded/fired gun; barrel moves as the ship turns in battle                    | Cannons loaded (consumes cannonballs)                                                |
| Duty navigation | Helm       | 3 concentric rings x 8 positions; rotate rings so falling stars form marked constellations; booching (dropping a star onto a star in the outermost ring) turns the ship around | Multiplies sailors' speed effect; league-point memorization; biases enemy spawn type |
| Treasure Haul   | (SMH only) | —                                                                                                                                                                              | Treasure chests at SMH booty division                                                |

Cross-cutting: puzzle difficulty adapts to the player's past performance (gunnery has no difficulty meter, only a slow drift, plus a manual speed slider since release 2008-12-16). Ratings are as listed under *Ship state model*. Sailing and rigging share the same stations, as do carpentry and patching.

### Numbers and tables
Concrete published constants: sailing board 8x16; swordfight board 6x13; carpentry hole "size-6" = 30 squares = 6 pieces for a Masterpiece; carpentry neglect allows 7 consecutive skips, damaging on the 8th; an untouched hole may expand at most 3 times, 1 square and −2 points each; rigging rope coil = 20 loops per wild piece, −5 loops for 3 consecutive moves without a pull; gunnery allows at most 3 arrows on the board, oldest removed. Scoring internals are explicitly undisclosed by the developers.

### Data model implications
Define a single interface `DutyPuzzle { tick(dt) -> {score: 0..1} }` and a `StationBinding { station, puzzle, occupant }`. The ship simulation should consume only aggregate per-station output; this lets puzzles be swapped, auto-played by AI crew, or stubbed with a slider during development.

### MVP relevance
**Core**: bilging, carpentry, sailing, gunnery (the four that close the meter loop). **Phase 2**: rigging, patching, duty navigation. **Deep**: Treasure Haul.

---

## The pillaging loop, end to end

### Source
`Pillage`, `Configure_voyage`, `Brigand`, `Might_ring`, `Radar`, `Crow's_nest`, `Booty`, `Ship_restocking`.

### What it is
The complete gameplay cycle that everything above serves.

### Mechanics
1. **Fit out at port.** Officer boards a ship at an island; hold must contain cannonballs of the ship's size and rum. Post a jobbing notice or use *Call all hands* to bring crew aboard.
2. **Chart a course.** From the helm or navigation table, chart a route between two islands, either within the archipelago or via an inter-archipelago chart. Every league point on the route must be memorized by the charter, or covered by a chart in their inventory or on the ship's navigation table.
3. **Configure the voyage.** Set voyage type to **pillage** and set the might-ring difficulty band with two sliders, whether to hunt brigands, barbarians or both, whether to auto-target, and whether to auto-target player vessels.
4. **Set sail.** Ship leaves port and is attackable. Speed rises as sailors/riggers work; bilge and damage accumulate; a duty report is shown at each league point.
5. **Find a target.** The officer uses the **radar** (zoom in on the charting table or "Yer known world" while at sea; range slightly under one league; shows might-ring colours but not ship type or opponent type) and then the **crow's nest** for a wider live view with might rings and brigand/barbarian icons (rectangle = swordfighting brigand, circle = rumbling barbarian; navy ships have no ring).
6. **Pursue and intercept.** Press "Attack". Matching course and speed is required. Same-direction target ahead → speed up; target behind → turn about twice to slow down (turning about costs roughly **20% speed**). Opposite directions → turn about before the target passes.
7. **Sea battle.** Navigation stage, then boarding (or disengage/sink).
8. **Take booty.** On a win, a share of the loser's hold and booty transfers. Brigand vessels may additionally drop a new **chart** onto the winner's navigation table.
9. **Repeat** along the route, then **port** at the destination island.
10. **Divide the booty** at the booty chest, then **restock** rum and cannonballs from the restocking cut.

**Might ring.** Every ship carries a might rating shown as a coloured ring: blue (weaker than viewer) → green (comparable) → red (stronger). Driven by number of pirates aboard and their **duty**-puzzle standings only (carousing and crafting standings do not count); ship size does **not** factor in. Attacking a far-blue target risks being engaged by **El Pollo Diablo** / the black ship. Green rings are the conventional best risk/reward.

**Payouts** scale with the player ship's current might, the number of pirates aboard, and the opponent's crew rank; greenies aboard reduce payouts. Brigands and barbarians are the primary PoE fountain and one of the few sources of Kraken's blood.

**Spawn control.** Better duty-navigation performance increases the chance of spawning the enemy type the voyage is configured for; on trade, evade, flotilla and (assumed) Sea Monster configurations it *reduces* brigand spawns instead. A defending ship whose navigator is out-performing the attacker's produces "She's outmaneuvered us!" and evades the attack. The shading of a league point on the map indicates route difficulty — darker means tougher brigands spawn there.

### Numbers and tables

Voyage types (`Configure_voyage`), all settable only at an island or league point except Evade (settable any time, unsettable only at an island):

| Voyage type       | Purpose                                         | Notable constraints                                                                                           |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pillage           | hunt brigands/barbarians/players                | might band + target-type sliders; auto-target toggle                                                          |
| Trade             | move cargo, pay jobbers per league              | officer sets average PoE/jobber/league; hold must have the PoE; good dnav ↓ spawns                            |
| Evade             | as trade but no jobber pay                      | settable at sea; unsettable only at an island                                                                 |
| Blockade          | join a flag's blockade                          | only at an island where the flag is hiring                                                                    |
| Greeter pillage   | tutorial voyage                                 | hold must be empty, ≤15-pirate ship, CBs and rum supplied free, no PvP, no memming, 10 PoE/league to greenies |
| Swabbie transport | NPC crew moves the ship for a fee               | hold must be empty; cannot pursue or be pursued; no memming; no gunning                                       |
| Flotilla          | join a flotilla attack                          | good dnav ↓ spawns                                                                                            |
| Sea monsters      | Atlantis / Cursed Isles / Haunted Seas / Kraken | requires the matching map charted first                                                                       |

### Data model implications
```
Voyage { type, route:LeaguePointId[], legIndex, config:{mightMin,mightMax,targetBrigands,targetBarbarians,autoTarget,autoTargetPlayers} }
Encounter { enemyTemplate, mightColor, foeType: Brigand|Barbarian|Merchant|Player }
```
The encounter spawner is a weighted roll per league leg, weighted by `leaguePoint.difficulty`, `voyage.config`, and `navigatorScore`. Might is a scalar computed from `sum(f(pirate.dutyStandings)) * pirateCount`, compared against the player's own to pick a ring colour — ship class deliberately excluded.

### MVP relevance
**Core.** This is the game loop; a build that can leave port, sail a leg, spawn one brigand, fight it, and port again is the first playable milestone.

---

## Ocean map, league points and charting

### Source
`League_point`, `Ocean`, `Chart`, `Charting`, `Navigation_table`, `Memorization`, `Speed_meter`.

### What it is
The world graph the ship travels on between battles.

### Mechanics
- The ocean is an **offset grid** of league points, drawn with horizontal connections within a row and diagonal connections between rows — **there are no vertical connections**. Edges between adjacent points are **leagues**.
- Some league points carry an **island**. Travel between islands means walking a path of adjacent league points; a **chart** enumerates the sequence of points between two islands.
- **Diagonal leagues are the baseline; horizontal leagues take 40% longer** to traverse at the same speed.
- **Colours on "Yer known world":** grey = known only via a chart currently held or on the ship's table; brown = **memorized**; red = the point of an island under blockade; other colours (red for Atlantis, purple for Cursed Isles) = temporary SMH-only points that can never be memorized. Memorized points take precedence over chart-derived ones.
- **Shading** (fill darkness) of a league point encodes route difficulty — darker = harder brigands spawn there. Added in release 2009-03-18.
- **Charting** is done at the helm or navigation table. A course is valid only if every point on it is memorized by the charter or covered by a chart in their inventory or on the table. Charts and maps can only be added to/removed from the table by the deed holder or a fleet officer+.
- **Charts** are bought at shipyards for routes from the current island to a neighbouring island **in the same archipelago**; the price is believed to track route length. Routes between islands lacking shipyards, and all inter-archipelago routes, must be pillaged from brigands or traded between players. Intra-archipelago charts decay in **45 days**, inter-archipelago in **90 days** (calendar days on a table, login days in inventory); the icon becomes tattered at roughly half-life.
- **Memorization** requires playing duty navigation while the ship crosses a league point and scoring at least **Fine**. Most points take **4–6 passes**, minimum 3, maximum 8; the count is random. The ship must actually travel between two league points — turning about beforehand does not count. An island's league point can alternatively be memorized by simply setting foot on the island (one credit per landing). Island *names* are discovered separately by visiting. Memming is disabled under swabbie transport and greeter pillage.
- **Ferries** connect any two islands with functional buildings in the same archipelago, from the dock interface.
- **Auto-port.** A ship abandoned at sea for 15 minutes is auto-ported and its booty is dumped into the sea. A server reboot whisks a ship at sea back to its last port and divides the booty by default shares.

### Numbers and tables

Emerald ocean scale (the only ocean in scope):

| Metric                                 | Emerald |
| -------------------------------------- | ------- |
| Sea league points                      | 577     |
| Island league points                   | 92      |
| Total league points                    | 669     |
| Extinct points                         | 0       |
| Memorized needed for Compass portrait  | 67      |
| Memorized needed for Spyglass portrait | 201     |
| Memorized needed for Sextant portrait  | 402     |
| Memorized needed for Globe portrait    | 663     |

Emerald is a doubloon ocean formed on 2012-01-31 from the merger of the former Sage and Hunter oceans; its geography descends from those two maps.

| Quantity                          | Value                                    |
| --------------------------------- | ---------------------------------------- |
| Minimum speed, all ships          | 0.2 leagues/min (5 min per league point) |
| Horizontal-league time penalty    | +40% vs diagonal                         |
| Turn-about speed penalty          | ~20%                                     |
| Intra-archipelago chart decay     | 45 days                                  |
| Inter-archipelago chart decay     | 90 days                                  |
| SMH map decay                     | 8 calendar days                          |
| Passes to memorize a league point | 3–8, typically 4–6, requires Fine+       |

### Data model implications
```
LeaguePoint { id, gridPos:(row,col), island?:IslandId, difficulty:0..1, archipelago:ArchId }
League      { a:LeaguePointId, b:LeaguePointId, orientation: Diagonal|Horizontal }
Chart       { from:IslandId, to:IslandId, points:LeaguePointId[], decayDaysRemaining }
PlayerKnowledge { memorizedPoints:Set<LeaguePointId>, discoveredIslands:Set<IslandId>, memProgress:Map<LeaguePointId,int> }
```
The offset grid means each point has at most **six** neighbours: two horizontal (same row) and up to four diagonal (rows above/below). Generate or author the Emerald map as a node/edge list rather than a dense array. Traversal time per leg = `lengthFactor(orientation) * currentSpeedMinPerLP`.

### MVP relevance
**Core** as a graph with a handful of islands. **Phase 2** for chart items, decay, and memorization progress. **Deep** for a faithful 669-point Emerald reproduction.

---

## Booty, division, restocking and the hold

### Source
`Booty`, `Booty_panel`, `Ship_restocking`, `Hold`, `Sea_battle#Winning and losing`, `Pillage`, `Brigand`.

### What it is
The economic settlement after each battle and at the end of each voyage.

### Mechanics
- **On winning a battle:** a portion of the loser's hold and booty transfers to the winner's booty chest. All *goods* and **50% of the PoE** go into the booty chest; **the other 50% of PoE is divided instantly** among the crew by the crew's booty shares. Brigand vessels may also drop a new chart onto the winner's navigation table.
- **On losing:** brigands and barbarians take **10% of the hold's commodities and 20% of the booty's PoE**. In PvP the winner takes **25% of the hold and 50% of the booty**. In PvP **during war**, the winner takes the entire hold **except five units of rum**.
- **Battle credit.** Every pirate aboard *at the end of the battle* gets credit for one battle, shown as a ship icon in the division panel. Pirates must stay to the end to be credited.
- **Division at port.** Any officer+ can divvy. The panel proposes a split by the crew's booty shares weighted by each pirate's battle count. Pirates who left mid-pillage are still included. The divvying officer may adjust each pirate **by at most ±1 battle**, may not boost their own share, and may reduce their own without limit. The division is then put to a **majority yea/nay vote** of the pirates aboard.
- For flotilla/blockade/Atlantis booty, "battles" is replaced by the number of **10-minute segments** the pirate was present.
- **Selling from the chest.** An officer may sell pillaged goods directly out of the booty chest before division; the proceeds are added to the booty. If the goods are not sold, they go into the ship's hold on division.
- **Restocking cut** ("crew cut"): a percentage of total booty removed *before* division to pay for rum and cannonballs. The captain sets it **0–30%** and may change it at any time; the divvying officer may lower it at division but never raise it. If the divvying officer lacks fleet-officer hold privileges, the cut goes into their pocket instead of the hold.
- **Timers.** If a ship ports and the booty stays undivided for **30 minutes**, it is auto-divided by the crew's shares. A ship abandoned at sea long enough to auto-port (15 minutes) loses all booty commodities and PoE to the sea.
- **Hold.** Mass (kg) and volume (L) limits, **shared with the booty chest**; max 32,767 units of any single commodity. The hold also holds the ship's PoE coffers. Permissions are layered: anyone aboard can view and deposit; officers can buy but not sell or withdraw; fleet officers+ can buy, sell, transfer and withdraw; the owner has additional access that survives locking.

### Numbers and tables

| Situation                         | Winner takes                                     |
| --------------------------------- | ------------------------------------------------ |
| Player beats brigand/barbarian    | goods + PoE; 50% of PoE auto-split, 50% to chest |
| Player loses to brigand/barbarian | loses 10% of hold commodities, 20% of booty PoE  |
| PvP win (no war)                  | 25% of the loser's hold, 50% of their booty      |
| PvP win (flags at war)            | the entire hold except 5 units of rum            |

| Setting / timer                     | Value                           |
| ----------------------------------- | ------------------------------- |
| Restocking (crew) cut range         | 0%–30%, captain-set             |
| Auto-split of captured PoE          | 50% (was 75% before 2007-09-04) |
| Per-pirate divvy adjustment         | ±1 battle                       |
| Auto-divide after porting           | 30 minutes                      |
| Abandoned-at-sea auto-port          | 15 minutes (booty lost)         |
| Unmanned-in-port damage/bilge reset | 15–30 minutes                   |
| Hold per-commodity cap              | 32,767 units                    |

### Data model implications
```
BootyChest { poe:int, commodities:Map<Commodity,int> }   // counts against hold mass/volume
BattleCredit { pirateId -> battles:int }                 // or segments:int for multi-ship events
Division { shares:Map<pirateId,int>, crewCutPct:0..30, proposedBy, votes }
```
Because the booty chest shares the hold's capacity budget, `mass(hold)+mass(booty) <= class.holdMass` must be enforced at capture time — deciding what happens on overflow is an implementation gap the wiki does not address.

### MVP relevance
**Core** for the capture percentages and the 50/50 auto-split. **Phase 2** for the division UI, the vote, and the crew cut. **Deep** for hold permission tiers (single-player: the player is always the owner).

---

## Ship interfaces and information surfaces

### Source
`Vessel_panel`, `Crow's_nest`, `Radar`, `Duty_report`, `Call_all_hands`, `Hold`, `Dock`, `Navigation_table`, `Battle_info`, `Buoy`.

### What it is
The UI surfaces through which the player observes and commands the ship — worth listing because each corresponds to a piece of state that must exist.

### Mechanics
- **Vessel panel** — the always-on ship HUD: speed, damage, bilge and cannon meters; owning crew and its sea-battle rating; ship name; flag; lock icon; the roster of pirates aboard with an icon for each one's current duty station; Disembark. Officer-only controls: **Sail**, **Turn About** (with speed loss), **Port/Deport**, Hiring Jobbers checkbox, **Auto-Target Ships** checkbox, Join Event, Arrange Furniture, ordering pirates and swabbies to stations by clicking their names, and **Attack** — which becomes **Disengage** during pursuit.
- **Crow's nest** — a wider view of the surrounding sea (or an enlarged battle board in battle); shows might rings. Ships have 1–3 nests by size. Officers can initiate pursuit from here, which is the practical way to engage early. Not a duty station.
- **Radar** — accessible by zooming in on the charting table or "Yer known world" while at sea; shows every ship within slightly under one league with its might-ring colour, but not its class or opponent type.
- **Navigation table** — charts courses identically to the helm; the only place (besides the helm) charts and maps can be deposited/withdrawn (fleet officer+ or deed holder); shows league-point difficulty shading; hosts ship lock and pet settings and the blockades noticeboard tab.
- **Hold** — inventory management (contents, mass, volume, coffers deposit/withdraw, transfer, order delivery) and the trade-commodities screen (buy/sell against island stalls and shoppes).
- **Dock** — lists ships in port at the current island, crew ships and their lock status, and ferries within the archipelago. Ships are outlined by relationship (thick blue = owned, thin blue = crew/flag/ally, red = at war, grey = other) with icons for abandoned-at-sea, locked, unlocked, "unlocked skull" (may enter sinking events), and "not ported here". A "Where are my vessels?" report lists every crew and deed-held vessel ocean-wide and exports as key/value records (`vesselName=…, vesselClass=grandfrig, inPort=true, islandName=…, isLocked=true, isBattleReady=false, vesselId=…, sunk=false`) — a useful shape for a save-file schema.
- **Duty report** — shown at every league point, on entering battle, and at breaks in multi-ship battles; also on demand via Escape or Pause/Break. Covers the previous league, not the instant.
- **Call all hands** — summons crew members aboard, with three independently toggleable filters (**Ashore**, **In port/Sailing**, **In battle**), *all three checked by default*.
- **Buoy** — blockade-board scoring object with 1–3 pennants; scored at end of turn to whichever single alliance has it inside an influence circle; six colours (yellow unclaimed, red attacker, green defender, blue own, grey non-contender, black contested). Ships may occupy a buoy's square with no damage.
- **Battle info** — a crew's win/loss and PvP record page (crew data; out of scope for an offline single-player build).

### Numbers and tables
| Surface          | State it exposes                                                  |
| ---------------- | ----------------------------------------------------------------- |
| Vessel panel     | 4 meters, roster + station assignments, sail/port/attack commands |
| Crow's nest      | wide sea view, might rings, enlarged battle board                 |
| Radar            | contacts within <1 league, might colour only                      |
| Navigation table | route graph, chart inventory, difficulty shading, lock            |
| Hold             | commodities, coffers, mass/volume, market prices                  |
| Dock             | ships in port, lock/battle-ready flags, ferries                   |
| Duty report      | per-pirate rating per station for the previous league             |

### Data model implications
Every panel above maps 1:1 onto a query over `Ship`, `Voyage`, `PlayerKnowledge` or `IslandMarket`. Building the state model first and the panels as pure views over it avoids duplicating state in UI.

### MVP relevance
**Core**: vessel panel (meters + sail/attack + station assignment), duty report, hold. **Phase 2**: crow's nest, radar, dock, navigation table as separate screens. **Deep**: buoys, battle info, call all hands (multiplayer concepts).

---

## Gaps and unverified points

### Source
Aggregated across all pages read.

### What it is
Facts an implementation needs that the wiki does not supply, or supplies with a `verify` tag.

### Mechanics
The wiki is a player-maintained record, not a spec dump. Where a value was never published, or was published with a `verify` tag, it is listed here rather than guessed at inline, so that no invented number is mistaken for a sourced one.

### Numbers and tables
- **Which movement-token colour is left vs right.** Green is clearly the forward token (the whirlpool tutorial equates entering the square ahead with a green token), but no read page states whether blue or gold is the left turn.
- **Movement-token generation rate.** Only the *direction* of the relationship is documented ("higher bilge = slower generation"); no formula, no base rates per ship class.
- **Bilge and damage accrual rates**, and the coefficient by which damage accelerates bilge intake — undocumented.
- **Speed curve** as a function of sailor count and puzzle quality — the `Ship` page's "sailors vs minutes/LP" table has "no data available" for fanchuan, longship, junk, xebec, war galleon and grand frigate, and gaps in most other rows.
- **War galleon ram damage** is `verify`-tagged and blank on both `Ramming` and `Collision_mechanics`.
- **Maneuver token costs** are published only for sloop and cutter (and flower-only for four more classes); everything else is "?/?".
- **Puzzle scoring internals** are explicitly undisclosed by the developers; the 10-seconds-per-move / 3-minute-frame model is player conjecture flagged as such on the wiki.
- **Rum consumption rate** per pirate per unit time is not stated anywhere read.
- **Wear-and-tear damage rate** while sailing is not quantified.
- **Hold/booty overflow behaviour** when captured goods exceed remaining capacity is not described.
- **Brigand AI behaviour** is undocumented beyond anecdote; the wiki notes bots "have random spurts of genius" and links to a player forum thread (not followed). The one concrete AI rule recorded: *if the NPC can grapple you from where you are on the first of the four phases of a turn, it will try.*
- The `Ship damage` and `Cannon` article titles are **empty pages** on the wiki; their content lives under `Ship#Damage` and `Cannon ball`.

### Data model implications
Every item above should become an explicit named constant in a tuning file with a comment marking it as invented rather than sourced, so play-testing can converge on feel without anyone mistaking guesses for canon.

### MVP relevance
**Core** — these are the numbers that must be invented before anything is playable, and knowing which are invented is what keeps the recreation honest.
