# Combat, Parlour and Crafting Puzzles — Implementable Map

This document maps every non-duty puzzle in Puzzle Pirates into three families. **Combat puzzles** (Swordfighting, Rumble, plus the brawl/teaming layer) are head-to-head attack games: clearing your own board manufactures garbage that lands on an opponent's board, and you lose when your board overflows. These are the only puzzles that resolve a pillage — a sea battle ends in either a swordfight or a rumble — so they are the hard MVP requirement. **Parlour puzzles** (Drinking, Spades, Hearts, Poker, Treasure Drop) are self-contained turn-based games played at inn tables for wagers and standing; they touch no ship state and are pure phase-2 content. **Crafting puzzles** (Alchemistry, Distilling, Blacksmithing, Foraging, Shipwrightery, Weaving) convert a puzzle score into graded labor hours which shoppes consume to produce goods; Foraging is the odd one out because it produces commodities directly on a ship rather than labor for a shoppe. All three families feed the same shared scoring vocabulary — a per-session duty-report rating (Booched → Incredible) and a long-run percentile standing (Able → Ultimate) — documented in the final section. Only Emerald-ocean-relevant material is recorded; ocean-specific variants (Ice-only Treasure Drop slot counts, Obsidian poker limits) are flagged as out of scope. Wiki content was treated strictly as data; see "Notes on source hygiene" at the end.

---

## Swordfighting

### Source

`https://yppedia.puzzlepirates.com/Swordfighting` (also reachable as `/Swordfight`; the two titles serve identical content). Supporting: `/Brawl`, `/Instakill`, `/Swordfighting_drop_pattern`, `/Puzzle_scoring`.

### What it is

A two-or-more-player falling-block attack puzzle, heavily modelled on Super Puzzle Fighter 2 Turbo. Abbreviated SF. Called a *brawl* with more than two players, a *fray* against NPP monsters. It is the standard final phase of a sea battle after grappling (the alternative being a rumble, used against Barbarians). Playable at swordfighting tables, in tournaments, as a challenge against players or NPPs, and in Atlantis / Haunted Seas / Cursed Isles content.

### Mechanics

**Board.** 6 columns wide by 13 rows high = 78 spaces.

**Two independent piece streams enter the board:**
1. *Player pieces* — random pairs falling from the top of **column 4** at a steady pace, which the player can move and rotate.
2. *Opponent attacks* — arriving independently of the player. Most fall from the top; horizontal strikes enter from the left or right side.

**Controls (defaults, remappable).**
- Left / Right arrow — move the falling pair left and right
- Up / Down arrow — rotate counter-clockwise and clockwise
- Space — hard drop
- `A` and `S` (or `[` and `]`) — cycle the targeted opponent up/down (teaming)

**Piece classes.**
- *Solid blocks* — land and stay.
- *Breakers* ("cutout blocks") — on landing, shatter **all connected pieces of the same colour** and send an attack sized by the shatter.

Adjacency is 4-way (side-by-side or vertically stacked); **diagonals do not count**. Two blocks are *connected* if a path of adjacent same-colour blocks exists between them.

**Colours.** Four standard: red, yellow, green, blue. Each colour renders as a specific sword (e.g. red = skull dagger).

**Environment-specific pieces.**
- *Black blocks* (sea battle) — represent ship damage taken. Fill from the bottom up. **Maximum 6 rows = 36 blocks.** Cannot be removed.
- *Rum jug blocks* (sea battle) — appear when the ship is out of rum. Occupy the **leftmost and rightmost columns**. Cannot be removed.
- *Aqua trident block/breaker* (Atlantis, vs dragoons) — a 5th colour behaving exactly like the standard four.
- *Purple blocks* (Haunted Seas frays vs ghostly enemies) — do **not** fuse. Cleared by an adjacent breaker of *any* colour as long as that breaker also breaks something else; a breaker adjacent only to purple clears just the purple and does not act as a universal block. Each purple block carries a marking counting how many pieces may enter the board before it degrades into an unclearable black block. Explicitly never added to pillaging, tournaments, or player duels.

**Fusion → strikes.** Like-coloured blocks arranged in a **2×2 or larger rectangle** solidify into a single fused block. When a fused block shatters it sends a *sword strike*.

Strike shape rules:
- Fused blocks that are **square or taller than wide** → **vertical** sword of the same dimensions.
- Fused blocks **wider than tall** → **horizontal** sword of the same dimensions.
- Exception: a **2×2 fused block becomes a 1×4 sword**.
- Exception: a **3×3 fused block becomes a 2×4 sword**.
- Exception: if a block would become a *vertical* sword and is wider than 3, the excess width is subtracted from width and added to height (5×5 → 3×7).
- Exception: if a block would become a *horizontal* sword and is taller than 3, the excess height is subtracted and added to width (5×4 → 6×3).
- One turn before entering the opponent's board, a horizontal sword **converts to vertical** if at least half of it cannot fit on screen.

**Attack decay on the receiving board.** A strike lands as an immovable sword image for one turn → becomes an **opaque grey block** → decays to a **translucent grey block** the following turn → becomes a standard coloured block after that. Received attacks contain **blocks only, never breakers**.

**Sprinkles.** All *unfused* blocks shattered are sent as individual opaque grey blocks. Same decay chain as strikes.

**Chaining / cascades.** When blocks break, pieces above fall. If a breaker becomes newly adjacent to same-colour blocks after the fall, those break too, and the chain continues. The *n*th link acts as an *n*× multiplier. Named chain levels: single, double, triple, bingo, donkey (5×), vegas, and beyond.
- Applied to **strikes**: the chain multiplies the **largest dimension of the fused block** *before* conversion to a sword. If dimensions are equal, height is multiplied.
- Applied to **sprinkles**: the sprinkle count from each group is multiplied by that group's chain position, then summed.

**Win/lose.** A player loses when **column 4 is completely full** (no more pieces can enter). Two-player: the other side wins. Team: a team wins once all opponents are eliminated. Forfeits and disconnects also produce a loss.

**Instakill ("insta").** A sword landing in the **top block of column 4** eliminates instantly with no chance to break out. Sprinkles **cannot** instakill — they refuse to land in the top of column 4 and always leave 3 blocks of space there. Requires more than one strike released simultaneously. Known combinations:
- `(3×N) + (3×N)` — the only *guaranteed* insta. Two fused blocks of width 3 broken with no other fused blocks before them: the first makes a sword in columns 1–3, the second in columns 4–6. If they are 3×3 this must happen in a chain, not as the first step. The second sword must be long enough to reach the top.
- Also workable: `2-3`, `2-2-2`, `1-2-2`.
- In a sea battle, if the opposing crew is in rum sickness, `2-2` also works.

**NPP behaviour differs.** NPPs do not receive attacks the way players do. For NPPs, only the **total number of blocks** in an attack matters, not the number or sequence of strikes. As the block count approaches the number of spaces on the bot's board the insta chance rises; **78+ blocks in one attack is a virtually guaranteed bot instakill.**

**Opponent preview.** A miniature rectangle beside each opponent's name shows a rough block distribution, refreshed every few seconds. Teaming configuration dots update in real time.

### Numbers and tables

Sprinkle formula (verbatim): *"One sprinkle block is sent to the opponent for every two loose blocks (including breakers) that are shattered. If an uneven number are broken, the value is rounded down. If multiple sets of blocks are broken at once (e.g. a group of 5 pieces, and another group of 4 pieces) then each attack is calculated separately, and the resultant attacks are added up."*

```
sprinkles(group) = floor(size(group) / 2)          # size includes the breaker
sprinkles_total  = sum over groups of sprinkles(group) * chain_multiplier(group)
```

Worked examples from the wiki:
- Group of 5 + group of 4 broken at once → `2 + 2 = 4` sprinkles.
- 5 pieces in a single (1×) + 4 pieces in a double (2×) → `2(1) + 2(2) = 6` sprinkles.
- Example chain: green pair lands, shatters a large green fused block, which drops a blue breaker next to blue blocks for a double → **3 sprinkles and one 1×4 sword** sent in total.

Fused-block → sword dimension mapping:

| Fused block | Sword sent | Rule                                                   |
| ----------- | ---------- | ------------------------------------------------------ |
| 2x2         | 1x4 vert   | explicit exception                                     |
| 3x3         | 2x4 vert   | explicit exception                                     |
| 5x5         | 3x7 vert   | excess width (>3) moved to height                      |
| 5x4         | 6x3 horiz  | wider than tall; excess height (>3) moved to width     |
| NxM, N>=M   | NxM vert   | square or taller than wide                             |
| NxM, N<M    | NxM horiz  | wider than tall                                        |

Sea battle board contamination limits:

| Obstruction    | Placement                    | Max                          |
| -------------- | ---------------------------- | ---------------------------- |
| Black (damage) | fills bottom-up              | 6 rows = 36 blocks           |
| Rum jug        | leftmost + rightmost columns | (columns 1 and 6)            |

Historical note worth capturing for balance: black-block max was **10 rows** before Beta release 2003-11-22, lowered to 6; the amount added per cannonball was **not** changed. Rum jug blocks were added in release 2005-04-26 (before that, being out of rum carried no swordfight penalty).

Scoring chart (from `/Puzzle_scoring`, player-derived, *not* developer-confirmed — the page uses "pieces sent" as a proxy for score):

| Action                  | Effect               |
| ----------------------- | -------------------- |
| Clearing single blocks  | 1/2 pieces cleared   |
| Clearing large blocks   | 1x pieces cleared    |
| Cascades                | linear multiplier    |

### Data model implications

- `SwordBoard { width: 6, height: 13, cells: Cell[6][13] }`; `Cell = Empty | Block{colour, state} | Breaker{colour} | Fused{colour, rect} | Black | RumJug | Purple{counter}`.
- Attack decay needs a per-cell state machine with a turn counter: `SwordImage → Opaque → Translucent → Normal`. Model "turn" explicitly since decay is turn-driven, not time-driven.
- Fusion detection = maximal-rectangle detection over same-colour connected components, recomputed after every settle.
- Connected-component search must be strictly 4-way.
- The attack queue is directional and typed: `Attack { kind: Strike{w,h,orientation} | Sprinkle{count}, sourcePlayer, dropPattern }` — the pattern belongs to the *attacker's* sword, so store it on the attack, not on the receiver.
- Column 4 is special-cased three times (spawn column, loss condition, sprinkle exclusion zone). Make it a named constant.
- NPP damage model is a completely separate code path: total-blocks-vs-board-area probability, not board simulation.

### MVP relevance

**Core.** Swordfighting is the terminal phase of a player-vs-NPP pillage and cannot be omitted from a pillaging loop. Ship damage (black blocks) and rum state (jug blocks) are the coupling points to the sea-battle model. Purple blocks, Atlantis aqua, tournaments and brawl teaming are all phase 2 or deeper.

---

## Swordfighting drop patterns

### Source

`https://yppedia.puzzlepirates.com/Swordfighting_drop_pattern`. Page carries an "article needs updating" banner (Saber/Falchion patterns stale since Release 2024-07-25).

### What it is

Every sword has a fixed **drop pattern** that determines the *colours* of the blocks an opponent receives. This is the **only** property of a sword that affects the puzzle — swords have no stats otherwise. Patterns are viewable by hovering the sword in the booty panel, in a sword rack, during a fight, or at iron monger shoppes/stalls.

### Mechanics

**Pattern geometry.** All patterns are exactly **6 columns wide**; height varies from **3 to 6 rows**. Wiki convention: rows numbered 1..13 bottom-up on the board (1..6 for patterns), columns 1..6 left to right.

**Sprinkle colouring.** Sprinkles use **only rows 1 and 2** of the pattern.
- The 1st sprinkle to enter column X takes the colour of pattern `[row 1][col X]`.
- A 2nd sprinkle in column X takes `[row 2][col X]`.
- Further layers received **in the same turn** cycle back: 3rd layer → row 1, 4th → row 2, 5th → row 1, …
- Layers received one-per-turn are each treated as a single layer and **all use row 1**.

**Vertical strike colouring.** Uses the whole pattern. Blocks match the corresponding pattern columns from row 1 upward. If the sword is taller than the pattern, the pattern **folds and repeats from the 4th row from the top** — rows 1 and 2 of the pattern are only sent once. If the pattern is shorter than 4 rows (e.g. the stick, 3 rows), the whole pattern repeats from row 1 instead.

**Horizontal strike colouring.** Uses a rotated pattern.
- From the **left**: the top row of the strike matches pattern **column 1**, second row down matches column 2, etc.
- From the **right**: mirrored.
- If a horizontal sword exceeds the pattern height after rotation, it repeats: right-sided swords repeat **from column 4 back to column 1** after 90° counter-clockwise rotation; left-sided swords repeat **from column 3 to column 6** after 90° clockwise rotation.

**Colour assignment.** Swords carry two enamel colours (guard, hilt). These do **not** map directly onto blocks; they are believed to act as *indices into a table of block colours* which then paints the pattern. Two swords with the same pattern and one shared colour can have all 16 block colours in different places.

**Pattern reversal.** A sword's pattern is **mirrored about the line between columns 3 and 4** if its **first colour is blue, green or purple**. Symmetric patterns (rapier, long sword) are unaffected visibly; asymmetric ones (falchion, saber) are noticeably different.

### Numbers and tables

Concrete worked examples from the page:

| Case                                | Result                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| 15 sprinkles landing                | 12 fill board rows 5-6 (match pattern rows 1-2); remaining 3 in row 7, cols 4-6 match pattern row 1, cols 4-6 |
| 2x3 vertical sword in cols 5-6      | matches first 3 rows of pattern cols 5 and 6                                               |
| 2x8 vertical sword, saber (6 rows)  | sword rows 1-6 match pattern rows 1-6; sword rows 7-8 match pattern rows 3-4               |
| 6x2 horizontal strike from right, foil (4-row pattern) | strike cols 6,5,4,3 match top two rows of the CCW-rotated pattern; cols 2 and 1 take colours from the 4th and 3rd (rightmost) columns of the rotated pattern |

Swords with published patterns (pattern images themselves are graphics, not transcribable text): Backsword, Cleaver, Cutlass, Dadao, Dirk, Falchion, Foil, Katana, Long sword, Poniard, Rapier, Saber, Sanguine Blade, Scimitar, Short sword, Skull dagger, Spectral sword, Stick, Stiletto, Trident, Battle axe, Corsair blade.

### Data model implications

- `DropPattern { width: 6, height: 3..6, cells: Colour[6][h], reversed: bool }` stored per sword instance (pattern + two enamel colours resolve to a concrete colour grid at item creation time and are then immutable).
- Two distinct sampling functions are needed: `sampleSprinkle(col, layerIndexThisTurn)` and `sampleStrike(swordRect, orientation, side)`, with the fold-from-row-4 / fold-from-col-4 wraparound logic.
- The "colours as indices into a colour table" indirection means an offline recreation can simply hand-author the resolved colour grid per (sword, colour1, colour2) tuple, or approximate with any deterministic hash — gameplay only requires that the grid be fixed and knowable.

### MVP relevance

**Phase 2** for full fidelity (per-sword patterns, reversal, colour tables). **Core** in reduced form: the receiving board needs *some* deterministic colouring rule for incoming blocks, otherwise incoming garbage cannot be cleared strategically. A single hard-coded 6×4 default pattern is sufficient for MVP.

---

## Rumble

### Source

`https://yppedia.puzzlepirates.com/Rumble`. Supporting: `/Rumble_strike_calculations`, `/Rumble_sprinkle_calculations`, `/Rumble_sprinkle_data`, `/Rumbling_drop_pattern`, `/Brawl`.

### What it is

A multiplayer bubble-shooter attack puzzle in the Snood / Bust-A-Move / Puzzle Bobble / Dynomite lineage. Available at tournament boards and as a parlour game, by challenge against players or NPPs, and as the **final phase of a sea battle against Barbarians**. Uses **bludgeons** as the attack-pattern item (the rumble analogue of swords).

### Mechanics

**Colours.** Five ball colours: red, orange, yellow, aqua, blue. *Bruising is a state applied to a ball, not a sixth colour.* In **werewolf rumble**, furballs replace orange balls.

**Launchers.** Two launchers at the bottom of the field, one per fist. Moving the mouse aims **both**. `Z` / left mouse fires the left launcher; `X` / right mouse fires the right launcher.

**Firing.** A ball travels in a straight line and **rebounds off the side walls**. It stops on contact with the existing mass. If it forms a connected group of **3 or more same-coloured balls**, the whole group clears. Any balls no longer connected to the top of the board are also removed as **unsupported balls**.

**Shot timer and board drops.**
- ~**5 seconds** to fire after receiving a ball; a warning precedes the auto-fire.
- After every **8 completed shots**, a new row enters from the top and the shot counter resets.

**Charging.** Hold the fire button ~**1 second** before firing to charge the ball.
- A charged ball that fails to form a group of 3+ **loses its charge** and becomes a normal ball.
- A charged ball that *does* form a qualifying group causes the group to **remain on the board instead of clearing**, and the placement is recorded for a later combo.
- A charged group is *triggered* by clearing the connected group containing its recorded charged ball, normally with an uncharged shot.

**Combo ordering (critical rule).** Charged groups are recorded **in creation order**. When one recorded group is triggered, **that group and every subsequently recorded group** are included; groups recorded *before* it stay on the board still charged. So with 5 charged groups, triggering #2 consumes groups 2–5 and leaves #1. Triggering the oldest accessible group yields the largest combo.

A charged group that becomes **unsupported while the combo is resolving is temporarily retained** so it can still take its turn in the combo. Unsupported *ordinary* balls add no combo counters but do add attack mass.

**Furballs (werewolf rumble only).**
- An *uncharged* furball completing a group of 3+ pops that group immediately, regardless of combo preparation.
- **One** charged furball is not enough to register a fur cluster as a stored combo group; the cluster needs **at least two charged furballs**. A single charged furball placed in an otherwise-qualifying cluster stays charged but the cluster is not yet recorded.
- Adding the **second** charged furball is what records the cluster's position in the combo order. (A build of fur → red → fur → yellow orders as **red, fur, yellow**.)
- An ordinary group contributes **1** combo counter. A fur group contributes **one counter per charged furball, minimum 1, maximum 5**. Beyond 5 charged furballs, no further counters.
- Example: red group + fur group with 3 charged furballs + blue group = effective combo length **5** → the 5th notification ("Boom!"), not the 3rd.
- A fur group with 2+ charged furballs can produce a **strike by itself**, since it alone contributes 2+ counters.

**Attack type.**
- Resolution worth **1 combo counter → sprinkle**.
- Resolution worth **2 or more combo counters → strike**.
- Clearing a single ordinary charged group still produces only a **sprinkle** — having charged balls does not by itself make a strike.

**Attack delivery.**
- **Strikes** use the **upper portion** of the attacker's bludgeon pattern and enter from an **upper side** of the opponent's board.
- **Sprinkles** use the **lower two rows** of the bludgeon pattern and enter from the **bottom** of the opponent's board.

**Attack size inputs (kept separate).**
- Every ordinary resolved group → 1 combo counter.
- Fur group → 1–5 counters.
- Balls in the triggering group and all later qualifying groups → main attack mass.
- Unsupported balls → additional mass, **no** extra counters.
- The bludgeon pattern determines the arrangement on the opponent's board.

**Bruising.** A state layered over a ball while preserving its underlying colour. Bruised balls do not initially join ordinary matching groups. **Two obstructed stages:**
- `dark → bruised` when a group clears adjacent to it,
- `bruised → normal usable ball of its underlying colour` on the next adjacent clear.

A dark or bruised ball that becomes **unsupported is removed** with the other unsupported balls without needing to be lightened first. Strikes may introduce bruised balls per the bludgeon pattern and attack state, and may **displace existing charged pieces**; a charged piece that can no longer be retained in a valid charged group may be darkened or bruised.

**Hidden bruise counter.** The game maintains a hidden value affecting bruises in newly generated rows. **Removing balls increases it; balls actually sent to opponents as strikes/sprinkles reduce it.** If the value is **positive when the 8th-shot row appears, each new ball has a chance to enter in its darkest bruised state.** Sending large attacks therefore lowers this chance.

**Defence (group rumble only).** Click a teammate's portrait to defend them. A blue bar above their miniature board shows the amount of defence supplied; **stronger strikes increase the defender's available protection**. While defending, the defender **stops attacking**, absorbs some of the strikes and sprinkles aimed at the defended teammate, and the defended pirate is **removed from the opposing team's target list**.

**Boxing.** Introduced release 2008-02-05. A **one-fisted** rumble available when challenging a player or NPP. Same board, charging, clearing, attack and bludgeon mechanics; the player has only one launcher and cannot hold a trigger ball in reserve.

**Bludgeon drop pattern.** Analogous to sword drop patterns. Colours chosen for the bludgeon affect the arrangement of colours but generally not the pattern itself. **Exception — mirroring:** a first colour of **Grey, Pink, Purple, Navy, Aqua, Lime, Maroon, or Gold reverses the drop pattern.** Some bludgeons send bruises in the pattern; the **fish** has charged balls in its pattern (highlighted). The pattern is displayed in perfect rows but the puzzle plays in **diagonal rows**, so patterns skew when applied in game. Strike pattern = the **top 4–6 rows** of the displayed pattern; sprinkle pattern = the **bottom two rows** (top of those two = single-row pattern, bottom = multi-row pattern).

### Numbers and tables

Combo notification sequence (index = effective combo length):

`Pow! (1), Pop!, Bim!, Bam!, Boom! (5), Bop!, Wham!, Thud!, Crunch!, Oof! (10), Slam!, Sock!, Smack!, Splat!, Clonk!, Thwapp!, Snkt!, Thunk!, Kapow!, Crack!, Crunk!, Socko!, Whack!, Slap!, Tweak!, Pinch!, Poke!, Prod!, Nurple!, Gonzo!, Yeowch!, Unpleasant!, Baddabing!, Baddaboom!, Krakkathoom!`

Bludgeon list: Bare fists, Belaying pin, Blackjack, Brass knuckles, Broken bottle, Cane, Chain, Fish, Gaff, Gauntlets, Hammer, Hook, Leather gloves, Rope coils, Shovel, Skeleton bone, Skull rings.

Key constants:

| Constant                        | Value                          |
| ------------------------------- | ------------------------------ |
| Ball colours (standard)         | 5 (red, orange, yellow, aqua, blue) |
| Minimum matching group          | 3                              |
| Shot timer                      | ~5 seconds, then auto-fire     |
| Shots per board drop            | 8                              |
| Charge hold time                | ~1 second                      |
| Combo counters for strike       | >= 2                           |
| Fur group counters              | 1 per charged furball, min 1, max 5 |
| Bruise stages                   | 2 (dark, bruised)              |
| Sprinkle row width              | 9 balls                        |

### Data model implications

- `RumbleBoard` is a hex/staggered grid ("the puzzle plays in diagonal rows"), not a square grid — the pattern skew note confirms this. Neighbour lookup and connectivity must be hex-aware.
- `Ball { colour, charged: bool, bruiseStage: 0|1|2, isFur: bool }`.
- Two separate graph traversals per shot: same-colour connected component (for the match), and reachability-from-top (for unsupported removal).
- `chargedGroupRegistry: ordered list of GroupRef` — an ordered structure with "trigger at index i consumes i..end" semantics. Fur groups enter this registry on their **second** charged furball.
- Attack construction takes `(comboCounters, mainMass, unsupportedMass, bludgeonPattern)` and yields a `Strike{w,h,bruises}` or a `Sprinkle{count}` — see the two formula sections below.
- The hidden bruise pressure value is a single signed integer on the player: `+= ballsRemoved`, `-= ballsSentAsAttack`, sampled at each 8th-shot row generation.
- Defence is a directed link `defender → defended` that reroutes a fraction of inbound attacks and removes the defended player from the opposing target list.

### MVP relevance

**Core** for a pillaging loop *only if* Barbarian fights are in scope — the sea battle terminal phase is a swordfight in general and a rumble specifically against Barbarians. If MVP pillages target ordinary brigands/merchants, Rumble is **phase 2**. Werewolf rumble, defence/teaming, and boxing are all **deep**.

---

## Rumble strike calculations

### Source

`https://yppedia.puzzlepirates.com/Rumble_strike_calculations`. This is community-derived but presented as a working table-driven formula.

### What it is

The published, table-driven formula for the **width and height in balls** of an outgoing strike, plus the number of bruises it carries.

### Mechanics

```
strike_width = base_width(numGroups) + dropoff_modifier(numGroups, totalDropoff) + extra_ball_modifier(numGroups, totalExtraBalls)
strike_height = base_height(numGroups)
bruises = min(totalDropoff, floor(strike_width * strike_height / 2))
```

Definitions (verbatim intent):
- **Dropoff** — the number of loose balls that fall off the screen. Counted as the **total** across the entire combo.
- **Extra balls** — the minimum size for each group is 3 balls (2 uncharged + 1 charged). Any balls in a group beyond 3 are extra balls. Counted as the **total** across the entire combo.

Base-height shortcut rule: `floor(numGroups * 3/4)`, then **add a bonus of 1 height for each group after ten**. Worked example from the page: 13 groups → `13 * 3/4 = 9.75 → 9`, plus 3 for the groups past ten → **12**.

Worked examples from the page:
- `3-5-3 +3 dropoff` → 3 dropoff, 2 extra balls → width `5 + 1 + 1 = 7`.
- `7-5-3-3 +3 dropoff` → 3 dropoff, 6 extra balls → width `5 + 1 + 1 = 7`.

### Numbers and tables

**Base height and width by number of groups**

| # of Groups | Base height | Base width | Notes                                                                       |
| ----------- | ----------- | ---------- | --------------------------------------------------------------------------- |
| 1           | 0           | 0          |                                                                             |
| 2           | 1           | 7          |                                                                             |
| 3           | 2           | 5          |                                                                             |
| 4           | 3           | 4          |                                                                             |
| 5           | 3           | 5          | Same height as 4-group strikes                                              |
| 6           | 4           | 4          | The basic 6-group strike only contains 16 balls                             |
| 7           | 5           | 4          |                                                                             |
| 8           | 6           | 4          | Strikes of 8+ groups make a scary noise when received                       |
| 9           | 6           | 4          |                                                                             |
| 10          | 7           | 4          |                                                                             |
| 11          | 9           | 3          |                                                                             |
| 12          | 11          | 3          |                                                                             |
| 13          | 12          | 3          |                                                                             |
| 14          | 14          | 3          |                                                                             |
| 15          | 16          | 2          |                                                                             |
| 16          | 18          | 2          |                                                                             |
| 17          | 19          | 2          |                                                                             |

**Dropoff modifier** (added to width). Columns are total dropoff.

| # of Groups | d0 | d1 | d2  | d3  | d4 | d5 | d6 | d7 | d8+ |
| ----------- | -- | -- | --- | --- | -- | -- | -- | -- | --- |
| 3           | 0  | 0  | 0*  | 0*  | 3  | 3  | 4  | 4  | 4   |
| 4           | 0  | 0  | 1+  | 1+  | 3  | 3  | 4  | 4  | 5   |
| 5           | 0  | 0  | 2   | 2   | 3  | 3  | 4  | 4  | 4   |
| 6           | 0  | 0  | 2   | 2   | 3  | 4  | 5  | 5  | 5   |
| 7           | 0  | 0  | 1   | 1   | 3  | 3  | 4  | 4  | 5   |
| 8           | 0  | 0  | 1   | 2   | 2  | 2  | 4  | 4  | 5   |

`*` Add 1, instead of 0, if exactly 1 extra ball.
`+` Add 2, instead of 1, if at least 1 extra ball.

**Extra balls modifier** (added to width). Columns are total extra balls. Blank cells are unrecorded on the wiki.

| # of Groups | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| ----------- | - | - | - | - | - | - | - | - | - | - |
| 3           | 0 | 0 | 1 | 1 | 2 | 2 | 3 | 3 | 4 | 4 |
| 4           | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 3 | 3 |
| 5           | 0 | 0 | 1 | 1 | 1 | 2 | 2 |   |   |   |
| 6           | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 2 |   |   |
| 7           |   |   |   | 1 |   |   |   |   |   |   |
| 8           |   |   |   |   | 1 |   |   |   |   |   |

**Bruises.** One bruise per dropoff ball in a strike, capped at `floor(strike_volume / 2)`.

| # of Groups | Max bruises |
| ----------- | ----------- |
| 2           | 4           |
| 3           | 9           |
| 4           | 13          |
| 5           | 13          |
| 6           | 18          |

Worked examples:
- 5 groups + 13 dropoff → strike **3 high × 9 wide = 27** balls, `27/2 = 13.5 → 13` → **13 bruises** (max).
- 3 groups + 12 dropoff → wide strike **2 high × 9 wide = 18** balls, `18/2 = 9` → **9 bruises**; the last 3 dropoff were wasted.
- Caveat verbatim: if the bludgeon has bruises in its **strike pattern**, the bruise limit can differ from the table. Skull rings can yield up to **11** bruises on a 3-group full-width (2×9) strike, but **more than 9 dropoff still adds nothing** — whether you get 9 or 11 is luck.

### Data model implications

- Ship this as **three lookup tables plus one closed-form fallback** (`floor(n*3/4) + max(0, n-10)` for base height), not as a derived formula. The tables are sparse above 8 groups for the modifiers — clamp to the last known row.
- `StrikeSpec { width, height, bruiseCount }`; the bludgeon pattern then paints colours/bruise slots onto that rectangle.
- Bruise cap is a function of the *final* volume, so compute width and height first, then bruises.

### MVP relevance

**Phase 2** (only needed once Rumble itself is in). Within Rumble, this is the highest-value published data in the entire slice — it is the only exact attack-size formula anywhere in the combat family.

---

## Rumble sprinkle calculations

### Source

`https://yppedia.puzzlepirates.com/Rumble_sprinkle_calculations` and `https://yppedia.puzzlepirates.com/Rumble_sprinkle_data`.

### What it is

A community best-effort formula for sprinkle attack size. The page states plainly that **the exact calculation has never been published by the developers** and that the formula is a work in progress that is known to be wrong in some cases.

### Mechanics

**Base formula.**
```
sprinkles_from_pops  = floor(ballsPopped / 2)        # per group, includes the breaker ball
sprinkles_from_drops = floor(dropoffBalls / 3)       # per group
sprinkles_total      = sum over groups
```
Since a pop is at least 3 balls, `sprinkles_from_pops >= 1` per group.

**The sprinkle queue.** Small attacks are **not sent immediately**. If fewer than a full row of sprinkles (**9 balls**) has accumulated, they are held in the sprinkle queue until a full row or more exists, then all sent at once. A player can hold 8 queued sprinkles indefinitely and the opponent receives nothing.

**Multi-row sprinkles.** The bludgeon's sprinkle pattern is the bottom two rows of the drop pattern: the **top of the two is the single-row pattern**, the **bottom is the multi-row pattern**. A single row of sprinkles always uses the single-row pattern; anything beyond the first 9 uses the multi-row pattern. Some bludgeons (the fish) have identical rows; others (bare fists) have a significantly harder multi-row containing an extra colour. Multi-row placement locations appear random and no pattern has been demonstrated.

**Squishing.** If the sprinkle queue ever **exceeds two full rows (>18)**, it is squished down to a **single row (9)**. This is why one gigantic pop cannot bury an opponent.

**Sprinkle scaling (unverified, dated 2006).** Quoted from Boothook via the wiki: at the beginning of a game you need to pop **18** balls to send one row of sprinkles; once **both** players have sent a sprinkle attack the scaling goes away and only **9** balls are needed per row. Not known whether this is still in the game.

### Numbers and tables

Worked examples from the page:

| Input                                  | Calculation                              | Result       |
| -------------------------------------- | ---------------------------------------- | ------------ |
| 5 popped, 7 dropoff (`5d7`)            | `floor(5/2)=2` + `floor(7/3)=2`          | 4 sprinkles  |
| 8 groups of 3, then a group of 6       | `8 x 1 = 8`, then `+3`                   | 11 sprinkles |
| 3 popped, 30 dropoff (`3d30`)          | `1 + floor(30/3)=10`                     | 11 (9 single-row + 2 multi-row) |
| 3+3+3+3 then 22 dropoff                | `4 + floor(22/3)=7`                      | 11 (same as above) |
| 5 groups of 3, then `7d42`             | `5` queued, `+ 3 + 14 = 17` → 22 total   | squished to 9 |

Recorded experimental data (attacker notation: plain number = balls popped incl. breaker; `NdM` = N popped with M dropoff; `NcM` = N popped with M additional **charged** balls popped):

Simple cases that match the formula:
- `3 3 3 3 3 3 3 3 3` → 9 sprinkles
- `6 3 3 3 3 3 3` → 9
- `5 5 5 5 3` → 9
- `4 4 4 4 4` → 10
- `3 x8 then 4` → 10; `then 5` → 10; `then 6` → 11; `then 7` → 11; `then 8` → 12; `then 10` → 13; `then 11` → 13

Multi-row cases:
- `3 x8 then 9` → 13 multirow in two trials, 12 multirow in two others (indicates randomness or unmodelled factors)
- `3c1d30` → 12 multirow; `3 3 3 3 3 3 3d29c1` → 17 multirow; `4 4 4 3 3 10d1` → 13 multirow

Squishing cases (all → 9):
- `3 3 4 4 4 7c13d3`; `3 x8 then 3d28`; `3 3 4 4 3 3 4d25`; `3 3 3 3 3 7d42`; `3 x8 then 17`

Known formula failures:
- `16 8` sends only **9** where the formula predicts 12. Two competing explanations recorded: (a) a cap of at most **5 sprinkles per popped group**; (b) extra balls add a bonus ≈ **1/3 of the total extra balls in the group**, so a single group of ≥15 balls (incl. breaker) at game start already sends a full 9-ball row.
- `3 10 17d3 14d5 7 5d1 3d3 6d10 4d1 3 3d2 5d6` → only **9 9 9** (27) sent where the formula predicts 44.
- Charged-ball cases consistently come in **above** prediction: `3 3 14c7` → 14 (expected 12); `3 3 3 3 3 4 3 8c5` → 15 (expected 14); `3 x8 then 8c7` → 16 (expected 15); `5c9 3` → 9 (expected none).

### Data model implications

- `sprinkleQueue: int` on the attacking player, with a flush rule at `>= 9` and a squish rule at `> 18 → 9`.
- Sprinkle attacks are **rate-limited by construction** — an offline recreation can adopt the base formula plus queue/squish and get behaviour that is correct in the large majority of observed cases.
- Since the true formula is unpublished, implement it behind a single `computeSprinkleCount()` seam so it can be tuned without touching the board code. Note the charged-ball bias (+1 to +2 over prediction) as a possible tuning knob.
- The two competing correction theories (per-group cap of 5, vs. an extra-ball bonus of ~1/3) are both cheap to implement; the per-group cap of 5 is the simpler and fixes the `16 8` case exactly.

### MVP relevance

**Phase 2**, alongside Rumble. If Rumble ships, sprinkle sizing must exist in *some* form; base formula + queue + squish is enough.

---

## Brawls, teaming and frays

### Source

`https://yppedia.puzzlepirates.com/Brawl`.

### What it is

The multiplayer team wrapper around *both* Swordfighting and Rumble. Not a puzzle in itself.

### Mechanics

- A brawl is a swordfight or rumble where **at least one team has more than one member**. Ordinary matches and challenges have exactly one member per team.
- **Teaming**: with multiple opponents, pirates choose who to target with their attacks.
- **Defending**: available in rumble only (target a *teammate*). Not available in a swordfighting brawl.
- **Fray** is a distinct term the game uses for repelling boarders in Sea Monster Hunts and for defeating skellies, werewolves and zombies. All fray activities except one-on-one fights against boarders also involve brawling.
- Brawls at an inn gaming table support up to **12 pirates per side**.
- Brawls also occur after a successful grapple in a sea battle, where each player's board carries **additional black blocks proportional to the damage their ship has taken**.
- The table creator may start the match whenever **their own team size <= the other team's size**. A **5-second countdown** follows, during which any player may still leave; if nobody leaves, the puzzle begins.
- PoE may be wagered, set by the table creator.
- The table creator decides whether a **one-on-one** match is rated; **all other brawls are unrated**.

### Numbers and tables

| Constant                     | Value                                        |
| ---------------------------- | -------------------------------------------- |
| Max pirates per side (inn)   | 12                                           |
| Start countdown              | 5 seconds                                    |
| Team size rule               | initiator's team <= opposing team            |
| Rated?                       | only optional 1v1; all other brawls unrated  |

### Data model implications

- Targeting is a per-player mutable `currentTarget` cycled with `A`/`S`; attacks route to that target's inbound queue.
- Rated-vs-unrated is a session flag that gates standing updates — needed even in a single-player recreation to decide whether an NPP fight moves standing.
- Sea-battle brawls need the ship-damage → black-row mapping resolved *per player board*, not per team.

### MVP relevance

**Phase 2.** A single-player offline pillage resolves as 1v1 against NPPs; teaming and defence only matter once multi-pirate crews are simulated.

---

## Drinking

### Source

`https://yppedia.puzzlepirates.com/Drinking`. Supporting: `https://yppedia.puzzlepirates.com/Mug`.

### What it is

A 2-to-6 player mouse-driven tile-placement game on a **7×7** board, played at drinking tables, parlour-game tables, by challenge, in tournaments, and via notice-board missions against progressively harder NPPs. Free two days a week.

### Mechanics

**Board.** 7 × 7 grid.

**Hand.** Each player starts their turn with **three pieces** to choose from. Each piece has a point value.

**Placement rule.** A piece may be placed only if it **matches the piece(s) above, below, or to the side in either type or colour**. A red pitcher may go next to any pitcher of any colour, or any red piece.

**Piece pools.** Games use **four, five or six types** of pieces.

**Staining and scoring on placement.** The occupied square becomes **stained in the placing player's colour**. The player scores the piece's point value plus a placement bonus:

| Square state before placement | Placer gains | Opponent effect |
| ----------------------------- | ------------ | --------------- |
| Unstained                     | +20          | —               |
| Stained your own colour       | 0            | —               |
| Stained an opponent's colour  | +20          | opponent -20    |

**Piece values ramp.** Piece point values start at **zero** and **increase by 10 points per turn**.

**Drinking / drunkenness.**
- If **no** piece can be placed, the player must **drink** the piece.
- A player may **elect** to drink ("chug") at any time to take the piece's point value.
- Drinking **three pieces in too short a time** causes a **pass out**, losing **two turns**.
- Drunkenness **drops a bit each turn** the player does not drink.

**Row/column clearing.** When a row or column of **seven** is filled, all pieces in it are removed and the player with the **majority** of pieces in it receives a bonus of **100 points plus 50 per cask** in that line — regardless of who completed it. If the **last piece placed was on an unstained square, the bonus is doubled.** If two players tie on count, the bonus is **split**.

**Special pieces.**
- **Hook** — removes any piece from the board and stains the now-empty square with the user's colour. The user scores the hook's point value plus the staining bonus. Does **not** affect intoxication.
- **Cask** ("barrel"/"keg") — colourless; may be placed next to any single colour or group of same-colour pieces, then **changes colour to match**. Worth **+50 per cask** in a cleared line. To place a piece adjacent to a cask it must match the cask's adopted colour. **Two casks may not be placed adjacent to each other.** Makes you **more drunk**.
- **Fries** ("chips") — wildcard; any piece can be placed next to them. If **drunk**, the *player's* drunkenness drops **to zero**. If **played**, the *opponent's* drunkenness drops **to zero**. **At least one fries is always available at the start of every game**, and up to three can appear in the initial hand. If the board becomes completely empty of pieces, fries are **automatically added to the hand**.

**Piece feed.** The three pieces shown carry over to the next player minus the one used, plus one new piece — so hands are visible and partly predictable. The **highest-value piece is auto-highlighted** but not forced.

**Game end.** Ends when a specified point total is reached — **default 1500**. Optional alternative: play until the entire board is stained, in which case the player with the most stains scores **+200**.

**Mugs.** Purchased at a distillery. Only **one** may be equipped at a time, like a sword or bludgeon. Tournaments may fix a mug type. Mugs **decay and dust after 60 login days**; bar shelves slow decay provided the mug is not within 1 day of dusting. Without a mug equipped (or with "No mugs" selected) a player uses the **wooden cup**.

**Classic drinking** (legacy ruleset, still selectable). Pieces have **no value**; only **one** piece is available to place; if it cannot be placed it must be drunk. Becoming drunk loses **four turns**. Placing on an unstained square **doubles** the points from that move. Cask keeps its normal value. At the end, regardless of whether all squares are stained, the player with the majority of stained spaces scores additional points. A round ends when all spots are used or all players are passed out; highest score wins the round. The wooden cup is the **only** mug used in classic drinking. Fries are always the first piece given to the player who moves first. Classic has no casks in the *original* game (Classic Drinking does include them) and a slightly different scoring system.

### Numbers and tables

**Mug abilities**

| Mug             | Effect                                                                                  | Availability             | Dbl cost |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------ | -------- |
| Wooden cup      | +5 selection points. Only mug used in classic drinking.                                  | default / no mug equipped | n/a      |
| Goblet          | +10 selection points.                                                                    | anyone                   | 0        |
| Flagon          | Rows you win are worth 50% more points.                                                  | anyone                   | 3        |
| Pitcher         | +45 points when chugging.                                                                | anyone                   | 3        |
| Chalice         | Pieces need not be placed adjacent to other pieces. +5 points per neighbouring piece.    | subscribers              | 5        |
| Horn            | Take two extra plays when completing a row. Lose 10 points when playing fries/kegs/hooks. | subscribers              | 5        |
| Skull           | Extra play when playing fries, keg, or hook, but lose 40 points.                          | subscribers              | 5        |
| Stein           | +15 points for gained stains. -10 points for lost stains.                                | subscribers              | —        |
| Tankard         | +50 points for each of your pieces in a row you lost.                                     | subscribers              | —        |
| Cursed chalice  | Pieces need not be placed adjacent. +30 points when chugging. More quickly become drunk.  | subscribers, Cursed Isles only | n/a |

All purchasable mugs share a **60-day decay rate**.

**Placement and clearing constants**

| Constant                                    | Value       |
| ------------------------------------------- | ----------- |
| Board                                       | 7 x 7       |
| Hand size (modern)                          | 3           |
| Hand size (classic)                         | 1           |
| Line length to clear                        | 7           |
| Unstained-square placement bonus            | +20         |
| Opponent-stained placement                  | +20 / -20   |
| Own-stain placement                         | 0           |
| Line-majority bonus                         | +100        |
| Cask bonus per cask in cleared line          | +50         |
| Last piece on unstained square              | line bonus x2 |
| Per-turn piece value increase               | +10         |
| Starting piece value                        | 0           |
| Pass-out penalty (modern)                   | 2 turns     |
| Pass-out penalty (classic)                  | 4 turns     |
| Drinks to pass out                          | 3 in quick succession |
| Default game target                         | 1500 points |
| All-board-stained bonus (optional ruleset)  | +200        |
| Free days                                   | 2 per week  |

**Advanced mug-matchup strategy grid** (from the wiki; strategy names defined below the table)

| Using \ Against | Wooden Cup | Goblet      | Pitcher            | Stein              | Tankard            | Horn        | Flagon      | Chalice     | Skull  |
| --------------- | ---------- | ----------- | ------------------ | ------------------ | ------------------ | ----------- | ----------- | ----------- | ------ |
| Wooden Cup      | Standard   | Aggressive  | Special            | Stain              | Denial             | High Piece  | Denial      | Builder     | Denial |
| Goblet          | High Piece | Standard    | Special            | Stain              | Denial             | High Piece  | Denial      | Aggressive  | Denial |
| Pitcher         | Denial     | Denial      | Standard           | Denial             | Denial             | Denial      | Denial      | Denial      | Fry    |
| Stein           | Aggressive | Aggressive  | Stain              | Standard           | Builder            | Denial      | Denial      | Stain       | Denial |
| Tankard         | Aggressive | Infiltrator | Infiltrator        | Stain              | Infiltrator        | Special     | Infiltrator | Infiltrator | Fry    |
| Horn            | Aggressive | Aggressive  | Aggressive Builder | Aggressive Builder | Aggressive Builder | Aggressive  | Special     | Aggressive  | Fry    |
| Flagon          | Aggressive | Aggressive  | Aggressive         | Aggressive         | Aggressive Builder | Special     | Aggressive  | Special     | Fry    |
| Chalice         | Standard   | Standard    | Special            | Stain              | Denial             | Denial      | Denial      | Special     | Denial |
| Skull           | Aggressive | Aggressive  | Fry                | Aggressive         | Fry                | Fry         | Fry         | Fry         | Fry    |

Strategy definitions: **Standard** = score most rows; **Aggressive** = finish the game faster, always play the best-fit piece even if worth fewer points; **Denial** = clog the board (anti-horn); **Builder** = build your own rows with none of the opponent's pieces (anti-tankard); **High Piece** = always play the highest-value piece; **Stain** = maximise stains controlled; **Fry** = grab all hooks, barrels and fries (anti-skull); **Infiltrator** = create rows with only 2–3 of your pieces and let the opponent clear them (tankard strategy); **Aggressive Builder** = combination; **Special** = a matchup-specific strategy documented on its own page.

### Data model implications

- `DrinkBoard { 7x7 cells }`, `Cell = Empty | Piece{type, colour, stainOwner}`. Stain must persist independently of the piece, since clearing removes pieces but the *stain* is what scores the all-stained ending.
- `Player { drunkenness: int, recentDrinks: timestamps[], passedOutTurnsRemaining: int, mug: MugId, score: int }`.
- Piece value is a **global turn counter × 10**, not per-piece state.
- The shared hand feed (3 pieces, one consumed, one appended, visible to all) is a single queue owned by the table, not per-player hands.
- Cask needs a deferred-colour field: colourless when in hand, resolves on placement, then constrains later neighbours.
- Mug effects are score-hook modifiers at well-defined points (selection, chug, stain gain/loss, row win, row loss, special-piece play) plus two turn-economy modifiers (Horn/Skull extra plays) and one placement-rule override (Chalice/Cursed chalice: no adjacency requirement). A small effect-hook interface covers all of them.

### MVP relevance

**Phase 2.** Drinking has no bearing on pillaging. It is, however, the most rules-complete parlour puzzle on the wiki — every scoring number is published — so it is the cheapest parlour puzzle to implement faithfully if parlour content is wanted.

---

## Spades

### Source

`https://yppedia.puzzlepirates.com/Spades`.

### What it is

A four-player, two-team trick-taking card game with a fixed spades trump. Played at the parlour games table, a patron's card table, or a spades table. Free two days a week.

### Mechanics

- Standard 52-card deck; spades are **always** trump. 13 cards dealt per player, 13 tricks per round.
- Seats are named by cardinal direction (rightmost = East, then clockwise South, West, North). The table view is rotated per player so each appears to sit at South.
- **Bidding.** In round 1 the leftmost seat bids first; thereafter the first bid passes clockwise. Bids range **0 (nil) to 13**. The *second* bidder on a team may not bid such that the team total exceeds 13. Team total = the **contract**.
- **Blind nil.** Available only when the two teams differ by **100 or more points**, and only to the **lower-scoring** team, and only **one player** on that team. Bidding order matters: cards start hidden for both team members; the first to bid may reveal cards or bid blind nil. If they blind nil, both members' cards are revealed and the partner loses the blind-nil option. If they reveal, the partner may then choose blind nil or reveal. A blind-nil bidder must **exchange two cards with their partner** before the round; opponents cannot see the swap.
- **Play.** Clockwise, starting with the first bidder of that round. Must follow suit if able. Highest card of the led suit wins unless a spade is played, in which case the highest spade wins. **Spades cannot be led until broken** (previously played) or unless the leader holds only spades. Winner of a trick leads the next.
- **Timer.** Each player has limited time; on timeout a **random card is played automatically**. Absent players get a **reduced** time limit to speed play.
- **End conditions.** The game ends when a team reaches the *play-to* score **or the negative of it** (the "mercy" rule). Highest score wins. It also ends immediately if a player leaves — **that player's team forfeits**. There are **no NPP replacements in spades** (unlike hearts).
- **Rematch.** Requires a **100% vote** (all four players) and the ability to meet the wager. Standing requirements are waived for rematches.
- **Leaving.** Disconnect, log off, being pulled into another puzzle, or pressing "dismiss" all remove a player. They forfeit all PoE on the table and their standing may drop.

### Numbers and tables

**Play-to options:** 200, 250, 300, 500, 1000. (500 is competitive standard; 300 is the common in-game choice.)

**Scoring, applied in order: nils → contracts → overtricks → sandbagging**

| Event                    | Points                                        |
| ------------------------ | --------------------------------------------- |
| Contract made            | +10 x contract (bid of 7 → +70)               |
| Contract set (failed)    | -10 x contract                                |
| Nil made                 | +50                                            |
| Nil failed               | -50                                            |
| Blind nil made           | +100                                           |
| Blind nil failed         | -100                                           |
| Each overtrick (bag)     | +1                                             |
| Each multiple of 10 bags | -100 (sandbagging)                             |

Notes carried verbatim in effect: tricks won by a nil/blind-nil bidder **do not count toward the team contract** and **do not count as overtricks** in this variant. Overtricks **accumulate across rounds**. Nils and blind nils are **halved** relative to traditional spades (which uses 100 / 200).

**Worked scoring example from the wiki**

| Team   | Start | Nil            | Contract       | Bags | Sandbag | End |
| ------ | ----- | -------------- | -------------- | ---- | ------- | --- |
| Team 1 | 153   | -50 (failed)   | +30 (bid 3)    | +2   | —       | 135 |
| Team 2 | 28    | +100 (blind)   | +50 (bid 5)    | +3   | -100 (8+3 crosses 10) | 81 |

### Data model implications

- `SpadesGame { teams: [Team; 2], playTo: int, bags: [int; 2] (persistent across rounds) }`.
- Nil tracking is per-player, not per-team, and interacts with contract accounting — a nil bidder's tricks are excluded from both the contract total and the bag count. Model tricks-won per player, then aggregate.
- Blind-nil eligibility is a derived predicate: `abs(scoreA - scoreB) >= 100 && thisTeamIsLower && noTeammateAlreadyBlindNil`.
- End condition is `abs(score) >= playTo` for either team, not `score >= playTo`.
- Standard trick-taking engine (follow suit, trump, led-suit high) is shared with Hearts — build one and parameterise.

### MVP relevance

**Phase 2.** No interaction with ships, crews or economy beyond wagers and standing.

---

## Hearts

### Source

`https://yppedia.puzzlepirates.com/Hearts`.

### What it is

A four-player trick-avoidance card game. Lowest score wins. Free two days a week.

### Mechanics

- Standard 52-card deck, 13 cards per player, 13 tricks per round, no trump suit.
- **Passing.** After the deal each player passes **3 cards**. Cycle: round 1 **left**, round 2 **right**, round 3 **across**. If the table's *Pass option* is "left, right, across, **hold**", round 4 passes nothing; otherwise rounds 4 and 5 resume left and right.
- After passing, whoever holds the **2 of clubs must lead with it**.
- **Play.** Clockwise, must follow suit if able, highest card of the led suit takes the trick. No trumps: if you cannot beat the led suit you cannot win the trick.
- **Restrictions.** Hearts must be **broken** (previously played) before a heart can be **led**, unless the leader holds only hearts. **A heart or the queen of spades may not be played on the very first trick.**
- **Scoring.** Each heart = **1 point**; queen of spades = **13 points**. Points are penalties.
- **Shooting the moon.** Capturing **all hearts and the queen of spades** gives the shooter **0** and every other player **26**. Exception: if that would cause another player to *win* the game, the shooter instead **subtracts 26 from their own score**.
- **End.** As soon as any player reaches the score limit, the game ends; **lowest score wins**.
- **Leaving.** Disconnect, log off, being pulled into another puzzle, or "dismiss" removes the player. They forfeit all PoE on the table and standing may drop. **An NPP takes their place** (unlike spades). An NPP never wins PoE even if its score qualifies — the PoE is redistributed if the payout type allows, otherwise lost.
- **Rematch.** 100% vote required; impossible if any player is absent. Standing requirements waived.

### Numbers and tables

**Table options**

| Option       | Values                                          |
| ------------ | ----------------------------------------------- |
| Play to      | 50, 100, 200                                    |
| Pass option  | left/right/across  OR  left/right/across/hold   |
| Payout type  | Winner takes all  OR  Proportionate take        |

**Payout semantics**

| Payout type        | Behaviour                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Winner takes all   | Winner takes all prize money; ties split it; if an NPP wins the PoE is **sunk**.                 |
| Proportionate take | The player(s) with the **most** points get nothing; all others share, with the lowest score receiving the most and the rest proportionately less by the gap to the winning score. |

**Card point values**

| Card            | Points |
| --------------- | ------ |
| Each heart      | 1      |
| Queen of spades | 13     |
| Full moon shot  | 26 to all others (or -26 to shooter if the normal result would hand someone the win) |

### Data model implications

- Reuses the shared trick-taking engine from Spades with `trump = none` and a **penalty accumulator** instead of a contract system.
- The pass cycle is a modular index over the configured sequence: `passDirection = sequence[roundIndex % sequence.length]`.
- Shooting the moon needs a post-round check with a *conditional branch on whether the normal application would end the game* — this is the only rule in the parlour family that reads global game state to decide its own effect.
- First-trick restrictions and hearts-broken state are per-round flags.
- NPP substitution means seats must be `Seat { occupant: Player | NPP }` with a payout-eligibility flag.

### MVP relevance

**Phase 2.**

---

## Poker

### Source

`https://yppedia.puzzlepirates.com/Poker`.

### What it is

Standard Texas hold 'em for 2–10 players, played as a parlour game with real PoE stakes. Uniquely among the parlour games, **players may join or leave at any time**. Free two days a week (Friday and Sunday).

### Mechanics

- Standard 52-card deck (shared with Hearts and Spades). Two hole cards each; community cards dealt as **flop (3), turn (1), river (1)** with a betting round after each.
- **Blinds.** Player immediately clockwise of the dealer posts the **small blind = 1/2 minimum bet**; the next posts the **big blind = minimum bet**. Any player dealt their first hand since buying in also posts the big blind — the **"bring-in"**. Players who rebuy mid-hand do **not** post blinds next hand.
- **First action** is by the player three seats left of the dealer (immediately left of the big blind), proceeding left.
- **Rake: 5% is subtracted from the pot** at the end of each hand, before distribution. This is an explicit PoE sink.
- **Buy-in limits: 10x to 100x the minimum bet.**
- **Joining.** Clicking Join reserves the seat until the player decides whether to buy in. Buying into a seat **within two spaces of the dealer** means waiting for the button to pass before being dealt in. Higher-pot tables require experience of **Neophyte, Apprentice, or Narrow** respectively to join (an anti-alt measure).
- **Leaving.** *Dismiss* leaves the table entirely and auto-checks/folds the current hand; *Cash Out* returns the player to watcher status. Either way the stack is returned at the end of the hand.
- **Rebuy.** Repurchase chips up to the table maximum at any time; blocked if the player cannot afford the minimum buy-in from inventory. Players with zero chips are automatically removed, so rebuying is how a seat is retained.
- **Side pots.** With multiple levels of all-in, higher levels split into side pots awarded **from highest stake down**. Ties within any pot level split that pot.

### Numbers and tables

**Bet structures**

| Structure   | Minimum bet options    | Maximum                                                                                  |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| Fixed Limit | 2, 20, 200             | raise = minimum bet pre-flop and on the flop; exactly **2x** minimum on turn and river. Raise count is capped, **except** heads-up where raises are unlimited (amount still fixed). Upper limit = twice the minimum. |
| Pot Limit   | 2, 20, 200             | current pot **plus** the call amounts owed by each player                                 |
| No Limit    | 2, 20, 200, 2000       | none — up to the player's entire stack                                                    |

Pot-limit worked example from the wiki: pot 480, high bet 30, 3 players → maximum bet **570**.

A player may **always** bet their entire remaining PoE if it is less than the minimum bet ("going all in").

**Derived table constants**

| Quantity        | Formula                | Example (min bet 2, No Limit) |
| --------------- | ---------------------- | ----------------------------- |
| Small blind     | 0.5 x minimum bet      | 1                             |
| Big blind       | 1 x minimum bet        | 2                             |
| Buy-in range    | 10x to 100x min bet    | 20-200                        |
| Rake            | 5% of the pot          | —                             |

**Other table options:** seats **2 to 10**; local-players-only toggle; turn timer **10, 20 or 30 seconds** (default **20**).

**Hand rankings, lowest to highest:** No pair (high card) → Pair → Two pair → Three of a kind → Straight → Flush → Full house → Four of a kind → Straight flush → Royal flush.

Tie-break rules as published: high card compares highest down (`AKQ98 > KQJ98 > KJ987 > KJ876`); pair by rank then kicker (`AKK32 > KKQJ9`); two pair by high pair, then second pair, then kicker (`AA223 > KKQQJ`, `AAKK2 > AAQQJ`, `AAKKJ > AAKK2`); trips by rank then kickers (`AAA85 > KKK85`, `AAAKQ > AAAQ9`); full house compares trips first then the pair (`AAA22 > KKKAA`, `AAAKK > AAAQQ`); quads tie-broken by kicker (only possible when all four are community cards). Straights: aces play high **or** low but **not both** — `AKQJT` is a straight, `5432A` is a straight, `KQA23` is **not**.

**Side-pot worked example from the wiki** (stack sizes only; player names omitted per the no-pirate-data constraint): four players with stacks 1000, 800, 600, 1000 all go all-in. Everyone risked at least 600 → **main pot 2400** (600 × 4), the only pot the 600-stack can win. Three players risked at least 800 → the extra 200 each forms a **side pot of 600** (200 × 3). The two 1000-stacks wagered a further 200 each → a **third side pot of 400** (200 × 2). Pots are evaluated highest-first.

### Data model implications

- Poker's join/leave-any-time property means the table is a persistent object with a seat ring and a dealer button that advances independently of hand membership. This is structurally unlike the other three parlour games.
- Side pots need `PotLevel { amount, eligiblePlayers[] }` built from sorted distinct all-in amounts, evaluated in descending order.
- Bet-structure validation is a strategy object: `maxRaise(structure, pot, callAmounts, street, minBet)`.
- The 5% rake is an economy sink and should be recorded as such in whatever PoE-flow model exists.
- Experience gates (Neophyte / Apprentice / Narrow) reference the *experience* ladder, which is distinct from the *standing* ladder — do not conflate them.
- Obsidian Ocean caps the highest minimum bet at 200; **out of scope** (Emerald only).

### MVP relevance

**Phase 2**, and the most expensive parlour puzzle to build correctly (side pots, three bet structures, hand evaluator). Lowest priority in the parlour family.

---

## Treasure Drop

### Source

`https://yppedia.puzzlepirates.com/Treasure_Drop`.

### What it is

A two-player turn-based coin-dropping betting game on a lever/switch cascade — a Pachinko/Plinko variant with deterministic switch state. Free two days a week.

### Mechanics

**Controls.** Mouse only. Hover an entry slot at the top, click to drop. An hourglass beside each player's head shows the remaining turn time; on timeout **a random slot is selected**.

**Coin falling.** A single coin falls straight down until it either:
1. hits the **empty pad** of a switch → comes to rest there;
2. hits a **coin resting on a switch pad** → **bounces to the other side of that switch**;
3. reaches a **point slot** at the bottom → scores that slot's value.

**Multi-coins.** If a falling coin lands on one or more other *falling* coins (not coins resting on pads), they **combine** into a multi-coin — doubles, triples, and quadruples are possible. A multi-coin:
1. on an **empty pad** → one coin rests, the other(s) roll over to the other side of the switch;
2. on a **coin resting on a pad** → the whole multi-coin bounces to the other side;
3. at a **point slot** → scores the slot value **× the number of coins**.

**Switch mechanics.** Each switch has a **pad** side (holds one coin) and a **lever** side (flips the switch, swinging the pad to the other side).
- A coin landing in an **empty pad** → the switch **stays** in position.
- A coin or multi-coin passing through the **lever** side → the switch flips **once per coin** (a triple causes three quick flips).
- A coin resting on a pad that gets switched is **tossed into the air**, but **only falls if the switch flipped an odd number of times**.

Consequence: singles and triples flip an odd number of times; doubles and quadruples flip an even number.

**Rounds.** Four rounds. Each has a point target that one player must **reach or exceed** to advance. **Coins remaining on switches carry over to the next round in the same position.** When either player reaches the target, the **opponent may drop one more coin** before the round ends. A coin meter below each player shows progress. The winner's treasure chest opens at game end.

### Numbers and tables

**Round targets (default rules)**

| Round | Target |
| ----- | ------ |
| 1     | 10     |
| 2     | 40     |
| 3     | 20     |
| 4     | 80     |

**Bottom slot values, left to right (16 slots)**

| Round                  | Slot values                                                        | Pattern         |
| ---------------------- | ------------------------------------------------------------------ | --------------- |
| 1                      | 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2                     | flat            |
| 2                      | 34, 21, 13, 8, 5, 3, 2, 1, 1, 2, 3, 5, 8, 13, 21, 34               | Fibonacci       |
| 3                      | 9, 8, 7, 6, 5, 4, 3, 2, 2, 3, 4, 5, 6, 7, 8, 9                     | linear          |
| 4 (normal)             | 64, 49, 36, 25, 16, 9, 4, 1, 1, 4, 9, 16, 25, 36, 49, 64           | perfect squares |
| 4 (4th round halved)   | 32, 24, 18, 12, 8, 4, 2, 1, 1, 2, 4, 8, 12, 18, 24, 32             | half, rounded down, except the centre two |

**Rule variations**

| Variation             | Values / behaviour                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Time per move         | 30 s (standard), 1 min, 2 min                                                              |
| Turbo                 | 5 s per move, greatly increased animation speed                                            |
| 4th round halved      | halves round-4 slot values to reduce single-drop swing                                     |
| Number of drop slots  | 8 standard; 6 or 10 selectable — **Ice Ocean only, out of scope for Emerald**              |
| Holes                 | "warp holes" appear randomly across the board; a coin entering one is warped to another hole and continues falling. Negated if the coin about to enter the hole doubles up with a coin bouncing up from a switch below. Rare hole combinations can produce **endless loops**. |

### Data model implications

- `TDBoard { switches: Switch[], slots: int[16] }`; `Switch { padSide: Left|Right, restingCoin: Option<Coin> }`.
- The falling simulation is a discrete event loop, not physics — a coin's fate at each switch is fully determined by `(padOccupied, arrivesAtPadOrLever, coinMultiplicity)`.
- **Multi-coin formation only merges coins that are themselves falling**, so the simulation must advance all in-flight coins in lockstep and check for co-location, rather than resolving one coin to completion at a time.
- Switch state **persists across rounds** — it is game state, not round state. Only slot values and targets change per round.
- The "toss into the air, falls only on odd flips" rule means a resting coin's displacement is a function of flip parity, computed after the whole multi-coin has passed.
- Holes mode needs a loop guard (the wiki documents genuine infinite loops).

### MVP relevance

**Phase 2.** Mechanically the *cheapest* parlour puzzle to implement — fully deterministic, all numbers published, no card engine, no AI beyond slot selection. If exactly one parlour puzzle ships first, this is the one with the best effort-to-fidelity ratio.

---

## Alchemistry

### Source

`https://yppedia.puzzlepirates.com/Alchemistry`. Supporting: `/Puzzle_scoring`, `/Labor`.

### What it is

A crafting puzzle played at an **apothecary**, producing dyes, paints and other concoctions. Mechanically a pipe-rotation / flow-routing puzzle loosely borrowed from PopCap's Rocket Mania. **Completing a round finishes two hours of labor** on a product in the apothecary queue. Free one day a week.

### Mechanics

**Objective.** Connect coloured **bulbs at the top** of the screen through a rotatable pipe grid to matching-coloured **bottles at the bottom**.

**Controls (remappable).** Mouse or arrow keys select a piece. **Left click / `S` rotates counter-clockwise; right click / `D` rotates clockwise.** Mouse wheel rotates either way. **`FILL` button / spacebar** fills all connected paths. The FILL button does not appear until at least one path reaches a bottle.

**Completion.** The session ends when all bottle slots at the bottom (between `FILL` and the rat image) are filled.

**Colour mixing.** After a few games, secondary colours are required:

| Mix                    | Result                       |
| ---------------------- | ---------------------------- |
| yellow + blue          | green                        |
| blue + red             | purple                       |
| red + yellow           | orange                       |
| all three              | brown — **never needed**     |

**Broken bottles.** Routing a colour to a wrong bottle **breaks** it. Broken bottles **do not move off the conveyor belt** and clog that slot for the rest of the game.

**Multi-layer bottles.** A bottle with more than one colour is always filled **bottom-most colour first**.

**Gleams and stars.** After a good fill, bottles on the belt may **gleam** (checkable by clicking them). More gleams → more valuable when completely filled. Once filled, a bottle moves to a slot at the bottom showing **zero, one, two, or three stars**. Three stars is most valuable.

**Special pieces.** Three types, **more likely to appear after a high-scoring fill**:
- **Gold coin / bonus piece** — slight scoring bonus when a colour is routed through it.
- **Arrow / multifill piece** (rare) — fills **all consecutive instances of a colour in a bottle**, provided it is the **bottom** colour of that bottle.
- **Quicksilver ("Q")** — routing a **primary** colour through it turns one bulb of that colour **silver-grey** on the next turn. Quicksilver fluid can be used as **any of the six colours**, but **counts as only one colour in scoring**. Routing a **secondary** (orange/purple/green) through quicksilver turns **one bulb of each of the two component colours** into quicksilver. Routing two separate colours through quicksilver produces two quicksilver bulbs.
- Quicksilver and multifill can combine, provided the colour needing multifill was already the next colour to be filled.

**Scoring model** (from the puzzle page, cross-checked with `/Puzzle_scoring`):
- Scored on the **value of the bottles completely filled**. **Time has no effect. Inactivity has no effect. Rotating has no effect.**
- **Secondary colours are worth more than primaries**; the secondary formed from the **two outer bulbs** is worth somewhat more than the others.
- Filling more than one bottle of the **same** colour at once → an **increasing bonus**.
- Filling bottles of **different** colours → an **increasing multiplier**.
- **All bonuses apply to all bottles affected.**
- Multi-colour bottles score the **average** of their layers, with a **slight bonus per layer**. Wiki's illustrative (made-up) numbers: a red/red/green bottle scoring 6, 8, 14 → average of `6, 8+1, 14+1` = **10**.
- **High scoring on the last bottles is not wasted.**
- A fill that clears no bottles **does not hurt** the score.
- **Small penalty for breaking bottles.**

**Play-well guidance (verbatim intent).** Use as many colours as possible on every fill. To score an **incredible** you need to average roughly **two stars per filled bottle** (two-star bottles alone do not always suffice). Two-star bottles need good **three-colour** fills; three-star bottles need **four- or five-colour** fills, ideally using the outer-bulb secondary. Prune the board before filling: rotate unused crossing pieces so no paint runs through them (preserving them), and rotate unused single-curve pieces so paint *does* run through them (destroying them), to bias regeneration toward more crossers. Keep 3- and 4-connection junction pieces.

**Booching.** Breaking **all** bottles → "Booched Brew" and a booched duty report. Filling bottles with **brown always booches**. Filling colours one at a time yields a nearly-booched score.

**End-of-puzzle glitch (documented).** Filling **14 or more layers at the same time** can suppress the duty report. Pressing Escape a few times brings it up and the score still counts. Filling 14+ layers **without ending the session** bricks the puzzle and yields a booched score.

**Historical.** Introduced release 2004-10-21. A **75-move counter** (after which the more valuable bottles broke) was **removed** in release 2010-03-09.

### Numbers and tables

**Bottles receiving correct colour — message ladder** (counts each layer of a multifilled bottle individually, so >11 is possible; the message stays "Voodoo" with larger text)

| Count | Message           |
| ----- | ----------------- |
| 2     | Double Bottle!    |
| 3     | Triple Bottle!    |
| 4     | Quadruple Bottle! |
| 5     | Five Bottles!     |
| 6     | Bingo!            |
| 7     | Donkey!           |
| 8     | Vegas!            |
| 9     | Potent Potions!   |
| 10    | Witch Doctor!     |
| 11    | Voodoo!           |

**Different colours in one fill — message ladder** (only six colours exist, so **Transmutation requires quicksilver**)

| Count | Message          |
| ----- | ---------------- |
| 2     | Double Double!   |
| 3     | Toil & Trouble!  |
| 4     | Fire Burn!       |
| 5     | Cauldron Bubble! |
| 6     | Wicked!          |
| 7     | Transmutation!   |

**Scoring affector chart** (`/Puzzle_scoring`)

| Affector                                            | Effect                                  |
| --------------------------------------------------- | ---------------------------------------- |
| Time                                                | no effect                                |
| Inactivity                                          | no effect                                |
| Rotating piece                                      | no effect (though rotations were once limited) |
| Filling a bottle                                    | plus                                     |
| Combos (multiple bottles, same colour)              | increasing bonus                         |
| Filling bottles with different colours              | increasing multiplier                    |
| Using secondary colours                             | small bonus                              |
| Using secondaries created from the farthest sources | small bonus, in addition to the above    |
| Completing a multi-layer bottle                     | small bonus, scaling with layer count    |
| Filling through a coin                              | bonus                                    |
| Distance of source from filled bottle               | unknown                                  |
| Smashing bottles                                    | minus (uncertain magnitude)              |

**Production constants**

| Constant                       | Value                        |
| ------------------------------ | ---------------------------- |
| Shoppe                         | Apothecary                   |
| Labor per completed round      | 2 hours                      |
| Free play                      | 1 day per week               |
| Bottle star levels             | 0, 1, 2, 3                   |
| Colours                        | 3 primary + 3 secondary (+ brown, never needed) |

### Data model implications

- `AlchemyBoard { pipeGrid: Piece[][] }`, `Piece { connections: Set<Direction>, kind: Pipe | Crossing | Coin | Multifill | Quicksilver }`. Crossing pieces carry **two independent** paths — the "prune" strategy depends on paint occupying one path but not the other.
- Flow resolution is a graph traversal from each bulb through connected pipe openings to bottle inlets, with colour **mixing at junctions** (a set-union of primaries, resolving to a secondary or to brown).
- Bottles are a **conveyor queue** with per-slot state `{ layers: Colour[], gleams: int, broken: bool }`; broken bottles are immovable, which means the conveyor is not a simple FIFO shift.
- Quicksilver mutates the **bulb** row, not the board — model bulbs as a separate array with a `quicksilver` flag.
- Scoring needs `sameColourCount` (bonus) and `distinctColourCount` (multiplier) computed per fill, applied to every bottle in that fill.
- The brown = instant booch rule and the all-bottles-broken = booch rule are two explicit terminal failure states.

### MVP relevance

**Phase 2.** Alchemistry is not on the pillaging path. It is well-documented and self-contained, making it a reasonable first crafting puzzle if the shoppe economy is being built out.

---

## Distilling

### Source

`https://yppedia.puzzlepirates.com/Distilling`. Supporting: `/Puzzle_scoring`, `/Labor`.

### What it is

A crafting puzzle played at a **distillery**, turning **sugar cane, wood and iron** into **rum** (three grades: **swill, grog, fine rum**) plus **hemp oil** and **mugs**. A column-based sorting puzzle. Free one day a week.

### Mechanics

**Pieces.** Three main types — **white**, **brown**, **black** — plus **orange spices** and **burnt white** pieces.

**Column conveyor.** Pieces are arranged in **columns** that periodically **shift one place to the right**. When the shift occurs the **rightmost column is removed**, going either **up into the rum** or **down into the furnace**, and a new column enters from the left.

**Up-or-down rule.**
- **More black pieces than white (burnt white counts as white)** → the column goes **down into the furnace**.
- Otherwise → **up into the rum**.
- **Equal black and white** (including all-brown columns) → **up**.

**Burnt piece generation.** One burnt piece replaces a white piece **for every two white pieces wasted** (sent down). Specifically: the 1st white sent down generates none; the 2nd generates one burnt piece, which replaces a white in the **next column that contains any whites** (even a different column); the 3rd generates none; the 4th generates one; and so on.

**Swap rules.** Two pieces may be swapped if there is a **link** between them. The links follow a strict cycle:

| Piece      | Swaps upward with | Swaps downward with |
| ---------- | ----------------- | ------------------- |
| White      | Black             | Brown               |
| Brown      | White             | Black               |
| Black      | Brown             | White               |
| Spice      | (does not swap)   | (does not swap)     |

**Burnt white** pieces behave exactly like regular whites for swapping and for the up/down determination, but they **prevent a Crystal Clear** for their column and score significantly negative if sent up.

**Column quality tiers.**

| Column composition                                          | Result / message |
| ----------------------------------------------------------- | ---------------- |
| White pieces only                                           | **Crystal Clear** — scores highly |
| No black and no burnt white, and more white than brown      | **Smooooooth** — scores moderately well |
| Equal white and black                                       | **Blecch!** — scores badly |
| Brown only                                                  | fairly low, no message |

**Piece value ordering (best to worst when sent up):** spice > white > brown > black > burnt white. Spices **increase the value of a column**; **wasted spice carries a small penalty**.

**Progress and end.** The container above the board shows rum quality/progress: more brown and black sent up → darker liquid; pure white → clear. **After twelve columns have been sent upwards the liquid reaches the top and the puzzle ends.**

**CC chains.** Consecutive Crystal Clear columns score progressively higher (`CC^2`, `CC^3`, …). **If a player achieves `CC^12`, the puzzle does not end** — it continues until a column that is **not** Crystal Clear is sent either up **or** down, allowing `CC^13`, `CC^14`, etc. This **only** happens after a `CC^12`; a `CC^10` followed by a `CC^2` does **not** extend the game.

**Score averaging.** The score is **divided by the number of columns sent upwards**, so following a `CC^8` with a `CC^4` *lowers* the overall average. Once a chain ends and a longer one is not achievable, dismissing is advisable.

**Time.** Time taken has **no bearing** on the score. **Abandoning after several pieces have been moved hurts standing.**

**Known defect (immovable pieces).** The spice-placement algorithm has no sanity test and can create non-spice pieces **completely surrounded by spices and/or the top/bottom edge**, rendering them permanently immobile and sometimes making a perfect game impossible.

**Controls.** Click one piece then an adjacent piece to swap (slow), or **drag** a piece — the game continues moving the selected piece as long as the drag passes over legal swap targets. No swap is directly reversible.

**Historical.** Before release 2007-07-17, abandoning did not hurt standing. `CC^13+` scoring was introduced in release 2007-12-12; before that the puzzle always ended at the 12th column sent up.

### Numbers and tables

| Constant                              | Value                                                    |
| ------------------------------------- | -------------------------------------------------------- |
| Shoppe                                | Distillery                                               |
| Inputs                                | sugar cane, wood, iron                                   |
| Outputs                               | swill, grog, fine rum, hemp oil, mugs                    |
| Columns to end the puzzle             | 12 sent up                                               |
| Chain-extension threshold             | CC^12                                                    |
| Burnt piece rate                      | 1 per 2 white pieces wasted                              |
| Column direction rule                 | black > white(incl. burnt) → down; otherwise up          |
| Free play                             | 1 day per week                                           |
| Expert session time (reference)       | under 3.5 minutes; a slow game ~8 minutes                |

**Scoring affector chart** (`/Puzzle_scoring`)

| Affector                | Effect                                            |
| ----------------------- | -------------------------------------------------- |
| Time                    | no effect                                          |
| Inactivity              | no effect                                          |
| Clearing a row with spice | small plus                                       |
| Wasting spice           | minus                                              |
| Clearing pure rows      | plus, amount depending on row purity               |
| Burning pieces          | no effect (but causes burnt pieces to appear)      |
| Wasting a row           | no effect                                          |
| Moving pieces           | no effect                                          |

Open question flagged on the wiki: the exact nature of the Crystal Clear chain bonus is unverified.

### Data model implications

- `DistillBoard { columns: Column[] }` with a right-shift tick; the rightmost column is popped, evaluated, and a new one pushed left.
- The swap-link rule is a fixed cyclic relation `white → brown → black → white` (downward) and its inverse (upward). Encode it as a lookup, not as conditionals — it is the puzzle's entire move-legality model.
- `pendingBurntPieces: int` counter incremented on every **second** wasted white; consumed by the next generated column containing a white.
- `ccChain: int` and a boolean `extendedMode` latched at `ccChain >= 12`; the end condition changes once latched.
- Score is an **average per column sent up**, so accumulate `(totalScore, columnsUp)` and divide — this makes "dismiss early" a genuinely optimal strategy, which the AI/scoring model should reflect.
- Spice pieces are immovable obstacles; the immovable-piece defect is emergent from that and does **not** need to be reproduced.

### MVP relevance

**Phase 2** as a puzzle. **Core-adjacent as a supply chain**: rum is consumed by ships (rum state directly affects swordfighting via jug blocks), so an MVP pillaging loop needs rum to *exist* as a commodity even if the distilling puzzle itself is stubbed out.

---

## Blacksmithing

### Source

`https://yppedia.puzzlepirates.com/Blacksmithing`. Supporting: `/Puzzle_scoring`, `/Labor`.

### What it is

A crafting puzzle played at **iron mongers**, producing **swords and cannon balls**. A peg-solitaire-like board-clearing puzzle driven by chess-move and distance constraints. Added in release 2007-07-17.

### Mechanics

**Board.** **6 × 6 = 36 squares**, all starting as red-hot.

**Layers.** Each square may be hammered **3 times**:

| Strike | Resulting state              |
| ------ | ---------------------------- |
| 1st    | bright orange → dark grey (hot → warm) |
| 2nd    | dark grey → silver (cool)    |
| 3rd    | square disappears — "complete", unusable |

Total strikes available on a full board = **36 × 3 = 108**.

**Movement.** The first move may hammer **any** square. Thereafter the symbol on the square **just hammered** determines which squares may be hammered next. Legal destinations pulse with light. If a destination is already complete or off the board, that move is unavailable. **Each strike replaces the square with a new square stamped with a random symbol.**

**Symbols — numbers (1, 2, 3, 4).** The number is the **exact distance** between the struck square and the destination, horizontally, vertically or diagonally. The next strike **may not land on a square in between**. (Hammering a `2` means hitting a square exactly 2 away.)

**Symbols — chess pieces (Bishop, Rook, Knight, Queen).** Same movement as in chess, with one critical difference: **except for the Knight, the pieces always move to the border and cannot stop on any square in between.** So a Bishop may next strike only the 4 squares at the ends of its diagonals. The next stroke **may not fall on the same square as the previous stroke** (e.g. after hammering a rook on the right edge you cannot hit that same square again).

**Rum Jug.** A wild card: allows hammering **any** square not yet complete, and **counts as a wild card in any set or chain** — `Knight Rook Jug Queen` makes a *Fancy Hammerin'*, and `2 2 Jug 2` makes a *Bingo*.

**End of session.** When all squares are complete **or** when no move is available.

**Scoring = board completion + two combo types.**

**Chains** — hammer the **same type** of piece multiple consecutive times. Works with both numbers and chess pieces. Beyond 6 no exponents are used; consecutive pieces past 6 simply yield more "Vegas"es.

**Sets** — hammer **each** of one type consecutively:
- All four numbers (1, 2, 3, 4) in any order → **"In the Rhythm"**.
- All four chess pieces in any order → **"Fancy Hammerin'"**.
- Numbers in order 1→4 **or** 4→1 → **"By The Numbers!"**.

**Alternating sets** — consecutive alternating complete sets of numeric and chess type with no intervening pieces award extra points, escalating through a long named ladder (an *In the Rhythm* immediately followed by a *Fancy Hammerin'* gives "Ferrous!").

**Progress indicators.**
1. The **blade in the background** changes colour from red-hot orange to smooth silver as overall square completion rises.
2. A **combo indicator embossed on the anvil** (bottom-left) shows: a single piece as `piece × 1`; a repeated chain as `piece × N`; a partial or complete set as the distinct pieces hit, left to right in hit order. A completed set adds a **small hash mark** below-right; each consecutive opposite-type set adds another. Hash marks clear when the alternating series breaks.

### Numbers and tables

**Board completion messages**

| Message                          | # of strikes made | # of strikes remaining |
| -------------------------------- | ----------------- | ---------------------- |
| "Maybe use that one as a club"   | fewer than 78     | more than 30           |
| "A hefty blade"                  | 78                | 30                     |
| "Finely balanced"                | 92                | 16                     |
| "Keen edge"                      | 102               | 6                      |
| "A masterpiece!"                 | 108               | 0                      |

**Chain ladder**

| Consecutive same-type strikes | Message |
| ----------------------------- | ------- |
| 2                             | Double  |
| 3                             | Triple  |
| 4                             | Bingo   |
| 5                             | Donkey  |
| 6+                            | Vegas   |

**Difficulty levels**

| Level | Pieces present                                            | Scoring mechanisms available                                            |
| ----- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1     | numbers 1, 2, 3                                            | chains of a repeated number; sets of all three numbers; "By the Numbers!" on 1-2-3 |
| 2     | numbers 1, 2, 3 + rook, bishop, knight                     | all of the above, plus chess sets and the alternating-set bonuses        |
| 3     | adds the 4 and the Queen                                    | all of the game's scoring mechanisms work                               |
| 4     | Rum Jug replaces the last piece hammered of the hot (top) and warm (middle) layers | as level 3, with wildcards                             |

**Alternating-set message ladder** (in escalating order, first level has no message):
`[none]`, Ferrous!, Finely Honed!, Well Tempered!, Cleanly Struck!, Sharp Work!, Great cannonballs of fire!, Get Stoked!, Forge Ahead!, A kraken-slayer!, Go hammer and tongs!, Saber Dance!, Anvil Chorus!, Excellent Caliber!, Steel yourself!, Happy Hrunting!, Vorpal!, Master Stoke!, Snicker-snack!, Is Mjollnir your hammer?, Skill of Wayland!, Craftsmanship of Eitri!, Envy of Hephaestus!, Weld done!, Oh, the irony!, Hammer Time!, I'm smelting! Smelllltiiing!

**Scoring affector chart** (`/Puzzle_scoring`)

| Affector                                       | Effect                    |
| ---------------------------------------------- | ------------------------- |
| Time                                           | no effect                 |
| Inactivity                                     | no effect                 |
| Pieces cleared                                 | large plus                |
| Repeating targets (same target sequentially)   | small increasing bonus    |
| Combos (specific targets sequentially)         | bonus                     |
| Sequential combos (combos in sequence)         | increasing bonus          |

Open question flagged on the wiki: whether combos are worth more than repeatedly hitting a single target (e.g. `2-2-2-2`).

**Production constants**

| Constant           | Value                       |
| ------------------ | --------------------------- |
| Shoppe             | Iron monger                 |
| Outputs            | swords, cannon balls        |
| Board              | 6 x 6                       |
| Strikes per square | 3                           |
| Total strikes      | 108                         |
| Free play          | 1 day per week (see Puzzle page) |

### Data model implications

- `SmithBoard { cells: Cell[6][6] }`, `Cell { symbol: Sym, strikesRemaining: 3|2|1|0 }`. `Sym = One|Two|Three|Four|Bishop|Rook|Knight|Queen|RumJug`.
- Legal-move generation is a pure function of `(lastStruckSquare, lastStruckSymbol, boardState)`:
  - number `n` → all squares exactly `n` away on a rank, file or diagonal (Chebyshev distance along a straight line), regardless of intervening squares;
  - Bishop/Rook/Queen → only the **terminal border squares** along each ray, never intermediate ones;
  - Knight → normal L-moves;
  - RumJug → any incomplete square;
  - always excluding the previously struck square and any complete square.
- The **no-legal-move** condition is a real terminal state and must be checked every turn — it is how most sessions end.
- Combo tracking is a small state machine: `chainSymbol + chainLength`, `setInProgress: Set<Sym> + setType`, and `alternatingSetCount` (the hash marks).
- Board-completion messages key off **total strikes made**, which is `108 - sum(strikesRemaining)` — trivially derivable.

### MVP relevance

**Phase 2** as a puzzle. **Core-adjacent as a supply chain**: it produces **cannon balls**, which a pillaging loop consumes, and **swords**, which determine swordfighting drop patterns.

---

## Foraging

### Source

`https://yppedia.puzzlepirates.com/Foraging`. Supporting: `/Labor`.

### What it is

The only crafting puzzle **not** played in a shoppe. Played from a ship's **hold** while ported at an **uninhabited island** ("forage for commodities"), it gathers **fruit, gems and gold nuggets** directly into the ship's hold. Also used in the **Cursed Isles** and on **expeditions** to open chests (those sessions are **unrated** and consume no labor). Introduced release 2008-08-27. Free one day a week.

### Mechanics

**Board.** A match-3 grid worked **downwards** (contrast Bilging and Treasure Haul which work upwards).

**Core loop.** Clear tiles by forming **lines of three or more**, letting **containers** fall to the bottom of the screen and hence into the hold.

**Cursor and moves.** The cursor is a **2×2 rotation frame** (not a two-tile swap). Rotate the 2×2 block **clockwise or counter-clockwise**. If any part of a container, a special piece other than the ant, or empty space is inside the cursor region, **the pieces cannot be rotated**. When a special piece other than the ant is selected, the cursor **changes to 1×1**.

**Controls.**

| Input                        | Action                                                |
| ---------------------------- | ------------------------------------------------------ |
| Mouse move / arrow keys      | move cursor                                            |
| Right click / `C`            | rotate clockwise; use earthquake or machete rightwards |
| Left click / `X`             | rotate counter-clockwise; use earthquake or machete leftwards |

Either mouse button has the same effect on the monkey and shovel. The left-handed mouse option swaps the button functions.

**Tiles.** Five normal types, each representing something found on an uninhabited island: **rock, foliage, wood, sand, soil**.

**Progress indicator.** A **column of bananas** down the left side — each banana is one crate of goods that must be cleared to complete the puzzle, and **each crate is worth one hour of labor**. If a pirate has insufficient labor hours for a full set, the puzzle starts with some bananas **pre-filled**.

**Containers.** Enter from the top **after every few moves**, up to a **maximum of three on the board at once**. **Each container consumes one hour of labor from the moment it appears** — abandoning the puzzle with containers still on the board **wastes those hours**.

Clearing everything **underneath** a container clears it from the board and places it in the ship's hold.

**Special pieces.** More special pieces appear the more the player clears in combos.

| Piece      | Effect                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Machete    | Clears all pieces to the left or right of its row (`X` = left, `C` = right).                                |
| Shovel     | Clears all pieces below it down to the bottom of the board. Ignores forageable items, so it is useful for freeing stuck crates, baskets and chests. |
| Monkey     | Dances in place; pieces in a **5x5 square** around it move and are replaced with new ones. Other nearby special pieces are **lost**; containers are unaffected. |
| Earthquake | Shakes the whole board, shifting tiles one place left or right (`X` left, `C` right). Gaps beneath a container can be filled by tiles moving during the quake. |
| Ant        | Consumes one tile each time pieces on the board are moved, always the tile **directly in front of it**. Can be rotated to face a different direction. The number on its back is how many pieces it will eat before dying. It **starves** if blocked by a container or if it reaches a side or the end of the board. It consumes other special pieces in its path. |

**Scoring.** Unlike Bilging and Treasure Haul, foraging has **no combos for clearing normal pieces**. Scoring is based on **containers cleared**, and the developers have suggested that container clearing is the **only** input to the score.
- Clearing **more than one container in a single move scores much more** than clearing one at a time.
- **Bigger containers score much better.**
- Each successive container cleared appears to get an **increasing multiplier** — `1x1, 1x1, 2x2` scores much more than `2x2, 1x1, 1x1`.
- Clearing containers **quickly and efficiently** increases the score.
- **Getting a crate stuck can decrease the score dramatically**, because many moves are wasted obtaining a special piece to free it.
- A likely **idle penalty** applies after roughly **ten seconds** without moves. Many idle penalties change a player's rank dramatically while the duty report stays unchanged (believed to be a bug).

**Fixed scoring bug (Release 2023-10-20), quoted from the wiki:** *"Fixed a bug with forage puzzle rating. Previously not clearing any tiles after the last chest was cleared would booch the whole session. Now the last chest(s) is correctly counted even if there are no tiles breaking after."* Before the fix, foragers had to cause a cascade (even a single 3-piece clear) after the last container cleared or the combo was ignored entirely.

**Practice mode.** Available at any time via the Practice button (right side, under the speed/damage/bilge meters) while labor hours remain; automatic for pirates with no labor hours left. Any chests on the board must be cleared before practice starts. In practice mode containers hold **cobwebs and moths** instead of fruit — *"Ye found an empty basket!"* — with **identical puzzling and scoring**, and performance **still affects experience and standing**. Scoring is **exactly the same** whether using labor hours or practising; foraging is **classed as rated even while practising**.

**Free-day restriction (unique to foraging).** On free-play days, pirates without a labor badge or subscription **cannot collect foraged commodities** — they puzzle in practice mode only and cannot accept foraging offers from the notice board. They can still be `/job`ed onto a foraging ship manually and play. The in-game message is: *"Only labor badge holders may receive commodities from foraging but ye may play the puzzle."*

**Cursed Isles / expedition foraging.** Emphasis is **speed, not efficiency**, so these sessions are **not rated**. Chests have a different appearance, name and contents but follow the same size pattern: **1×1 = a little PoE, 2×2 = a moderate amount or a low-value item, 3×2 = a large amount of PoE or a high-value item**. The Cursed Isles duty report is special, based purely on **how many containers were cleared in the allotted time**, larger containers worth more.

### Numbers and tables

**Containers**

| Container | Board footprint | Rarity   | Contents                                                                 |
| --------- | --------------- | -------- | ------------------------------------------------------------------------ |
| Crate     | 1 tile          | common   | low-value fruit: bananas, coconuts, limes, mangos, pineapples. 1 unit each. |
| Basket    | 2x2 area        | uncommon | exotic fruit: carambolas, durians, passion fruit, pomegranates, rambutan. 1 unit each. |
| Chest     | 2x3 area        | rare     | **five units of the same gem**, or **one gold nugget**                    |

**Container limit.** Maximum three containers on the board at once, where the valid combinations are: **three crates**, **two baskets and one crate**, or **one chest and two crates**. If a chest is on the board and the next queued container is a basket, the basket does not appear until the chest is removed — then it appears immediately.

**Economy of foraged goods**

| Fact                                | Value                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Labor per container entering board  | 1 hour                                                                 |
| Fruit spawn                         | 2 fruits per archipelago: one cheap (~15 PoE), one valuable (~60 PoE)  |
| Gems                                | one gem type per archipelago; only **one island per archipelago buys gems** |
| Selling constraint                  | markets in the **local** archipelago never buy the fruit spawned there — fruit must be sailed to another archipelago ("fruit running") |
| Palace/fort purchase                | possible, but usually at significantly lower prices                     |
| Gold ore                            | introduced release 2005-03-28; all units broken down into **10 gold nuggets** each in release 2008-08-27 |

**Constants**

| Constant                    | Value                    |
| --------------------------- | ------------------------ |
| Normal tile types           | 5                        |
| Minimum match               | 3 in a line              |
| Cursor                      | 2x2 rotation frame       |
| Max containers on board     | 3                        |
| Monkey effect radius        | 5x5 square               |
| Assumed idle penalty        | ~10 seconds              |
| Free play                   | 1 day per week           |
| Max advance labor (foraging)| a single alt can use all 48 subscriber hours regardless of alt count |

### Data model implications

- `ForageBoard { tiles: Tile[][] , containers: Container[] }`. Containers are **multi-cell occupants** with an anchor and a footprint, not tiles — the rotation frame must reject any 2×2 overlapping them.
- Gravity works **downward toward the hold**, so clearing under a container is what moves it; container descent is a separate resolution step from tile cascade.
- Labor accounting is **on container spawn, not on container clear** — this is the one crafting puzzle where abandoning mid-session actively wastes a resource. Model `laborConsumed += 1` at spawn.
- Container queue respects an area budget (the three valid combinations are consistent with a footprint-based cap), and a blocked spawn is **deferred, then released immediately** on space becoming available.
- The ant is a mobile agent with `facing` and `mealsRemaining`, ticking on every board movement — the only non-tile entity with autonomous behaviour.
- Scoring should be modelled as `sum over containersClearedThisMove of (containerValue * successiveMultiplier)`, with normal-tile clears contributing **zero**.
- Practice mode differs only in **payout**, not in scoring or standing — a single `awardCommodities: bool` flag suffices.

### MVP relevance

**Phase 2**, but the **highest-value crafting puzzle for an offline single-player game**: it needs no shoppe, no other players, and no labor market — just a ship at an uninhabited island. It produces sellable commodities directly, so it is a self-contained economy loop. If exactly one crafting puzzle ships first, this is the strongest candidate.

---

## Shipwrightery

### Source

`https://yppedia.puzzlepirates.com/Shipwrightery`. Supporting: `/Puzzle_scoring`. Added in release 2005-02-11.

### What it is

A crafting puzzle played at **shipyards**, providing labor for **ships** and **bludgeons**. A tile-sliding pattern-matching puzzle against a rising water level. Free one day a week.

### Mechanics

**Pieces and their movement.** Five tile materials:

| Material | Movement    | Note                                   |
| -------- | ----------- | -------------------------------------- |
| Cloth    | None*       | * can be moved by using other pieces on it |
| Iron     | Horizontal* | * as above                              |
| Rope     | Diagonal*   | * as above                              |
| Wood     | Vertical*   | * as above                              |
| Gold     | None        | never moves under its own power         |

**Objective.** Arrange board tiles into one of the shown **patterns**. A completed pattern clears. Six candidate pieces are shown at a time; the player arranges the board so as many of them as possible — with emphasis on the largest — can be fitted in.

**Chains.** A chain is formed by placing **two or more patterns consecutively without moving any pieces on the board in between**. After placing each piece in a chain, the player has **until the water reaches the top of the puzzle** to extend the chain with another piece. Chain names follow the standard sequence: Double, Triple, Bingo, Donkey, Vegas, Vegas², Vegas³, …

**Gold.** Using gold as part of a pattern **adds to the score of the chain**.

**Session length.** **Twenty piece placements** per session, measured by the flag-pole, not counting any placements squeezed in at the end.

**Scoring.**
```
piece_score = (numberOfComponents - 2) * positionInChain
```
Worked example from the wiki: placing `[3, 3, 4, 4, 5]` scores `(3-2)*1 + (3-2)*2 + (4-2)*3 + (4-2)*4 + (5-2)*5 = 32`; placing `[5, 4, 4, 3, 3]` scores `(5-2)*1 + (4-2)*2 + (4-2)*3 + (3-2)*4 + (3-2)*5 = 22`. **Therefore the biggest pieces should always come last in a chain.**

Each clear is assigned a score determined by the **size of the cleared pattern** and its **sequence position in the chain**, displayed as a **comparative word**. **Overall session performance is the average of the scores of all clears.** Time taken does not affect scoring (but does raise the water).

Broad rule of thumb from the page: it is **not worth extending a chain with a 3-piece** unless it can be followed with a 4- or 5-piece, or the chain is already around Vegas².

**Getting stuck.** It is possible to become stuck by lacking a tile a pattern needs — e.g. if every available pattern requires at least one sail cloth tile and none remain on the board. Mitigated by using fewer of the tiles in short supply.

### Numbers and tables

**Comparative word by (chain position × pattern size)** — the second scoring word displayed alongside the chain name

|          | 3-piece   | 4-piece     | 5-piece     |
| -------- | --------- | ----------- | ----------- |
| Single   | Fair      | Good        | Great       |
| Double   | Good      | Great       | Excellent   |
| Triple   | Great     | Excellent   | Admirable   |
| Bingo    | Great     | Excellent   | Superior    |
| Donkey   | Great     | Admirable   | Magnificent |
| Vegas    | Excellent | Superior    | Artisan     |
| Vegas^2  | Excellent | Superior    | Artisan     |
| Vegas^3  | Excellent | Magnificent | Paragon     |
| Vegas^4  | Admirable | Artisan     | Paragon     |
| Vegas^5  | Admirable | Artisan     | Master      |
| Vegas^6  | Admirable | Artisan     | Master      |
| Vegas^7  | Superior  | Paragon     | Master      |
| Vegas^8  | Superior  | Paragon     | Master      |

Comparative ladder, lowest to highest: **Fair, Good, Great, Excellent, Admirable, Superior, Magnificent, Artisan, Paragon, Master.**

**Pattern catalogue.** Reconstructed from the wiki's pattern grids. Legend: `c` = cloth, `i` = iron, `r` = rope, `w` = wood, `.` = cell not part of the pattern. Rows are top-to-bottom.

Three-piece patterns (16):
```
cwc      r        r        iii      iri      c.       wcc      wc
         r        w                          ic                .w

r        .r       c.       iw       i        r        ric      ir
w        ww       rc       .i       w        r                 r.
c                                   w        r
```

Four-piece patterns (10):
```
ii       wi       ir       cr       cc       r        iiw      cc       rr       ww
ii       iw       r.       rc       ww       w        ..w      cc       rr       cc
                  r.                         r
                                             w
```

Five-piece patterns (10):
```
.r.      ...w     cr.      i..      r.r      .w.      wc.      rrr      iwi      .i
.r.      cccw     www      rrr      www      wiw      wcc      i..      .r.      ic
iii                        i..               .w.               i..      .w.      ci
```

**Scoring affector chart** (`/Puzzle_scoring`)

| Affector                           | Effect                                    |
| ---------------------------------- | ------------------------------------------ |
| Time                               | no effect on score (but raises water)      |
| Inactivity                         | no effect                                  |
| Clearing a piece                   | plus, scaling with piece size              |
| Combos                             | increasing multiplier                      |
| Allowing water to flood a pattern  | unknown                                    |

Open question flagged on the wiki: whether losing a piece to rising water carries a penalty, or merely the opportunity cost.

**Production constants**

| Constant              | Value                    |
| --------------------- | ------------------------ |
| Shoppe                | Shipyard                 |
| Outputs               | ships, bludgeons         |
| Placements per session| 20 (flag-pole)           |
| Materials             | cloth, iron, rope, wood, gold |
| Pattern sizes         | 3, 4 and 5 tiles         |
| Free play             | 1 day per week           |

### Data model implications

- `ShipwrightBoard { tiles: Tile[][], waterLevel: int }`; `Tile = Cloth | Iron | Rope | Wood | Gold`.
- Movement legality is per-material and directional (`Iron` horizontal, `Rope` diagonal, `Wood` vertical, `Cloth`/`Gold` immobile but **displaceable** by another piece being moved onto/through them). The displacement rule is the mechanically subtle part and is under-documented on the wiki — see gaps below.
- Pattern matching is a set of ~36 fixed masks (shape + material at each cell) scanned over the board after every move; gold acts as a scoring bonus when incorporated, so masks probably admit gold as a substitute.
- `chainPosition` increments per clear and **resets on any manual tile movement** — that reset condition is the whole scoring game.
- Session score is the **average of per-clear scores**, and the session length is **20 placements**, so both are simple accumulators.
- The water level is a timer expressed spatially; it gates chain extension and eventually floods patterns.

### MVP relevance

**Deep.** Shipwrightery is the least completely documented crafting puzzle on the wiki — the article opens directly at Scoring with no gameplay section, so the moment-to-moment interaction model must be inferred. Defer until other crafting puzzles are done.

---

## Weaving

### Source

`https://yppedia.puzzlepirates.com/Weaving`. Released to Ice Ocean 2010-02-25, to production oceans 2010-03-09. Free play day is **Monday**.

### What it is

A crafting puzzle played in **weaveries**, producing **cloth**. A column-fill / group-clear puzzle driven by a batten and comb.

### Mechanics

**Objective.** Clear groups of **four or more identically coloured pieces**.

**Threads.** A set of **two to four threads** sits at the top of the board. Use the **arrow buttons** to move the threads left or right, then **space bar to batten down**, pushing the threads onto the board. **The comb then pushes the threads as far as it can.**

**Blocked columns.** If a column is already filled to the top, the game **simply will not place the threads there**.

**Progress.** A **bolt of cloth** indicator at the top left fills as groups clear. When it completes, the session is finished.

**Booching.** If it becomes **impossible to place any more threads**, the player gets a booch message and the session ends.

**Rating threshold.** The session becomes **rated once the fourth thread is pushed down**.

**Scoring.**
- Clearing **bigger and multiple groups in a single move** scores much more than one group of four at a time.
- The best scoring appears to come from **chaining clears** — the comb pushing threads so as to create a clear which causes another clear, and so on (Double, Triple, Bingo, …).
- **Sparkling pieces** are worth bonus points but last only **four moves** before the bonus expires. **The number of sparkles indicates the number of moves remaining** to collect the bonus. It is unknown whether more sparkles means a bigger bonus.
- **"Looming Large!"** — awarded for clearing a group of **9 or more** of a single colour.
- **"Unbeweavable"** — believed to require **at least one group of each colour cleared in a single step**; believed to give a very large bonus.

### Numbers and tables

**Difficulty levels**

| Level | Colours                        | Threads per piece | Gaps | Bonus pieces | Groups to finish |
| ----- | ------------------------------ | ----------------- | ---- | ------------ | ---------------- |
| 1     | 2 (yellow, red)                | 2 only            | no   | no           | 5                |
| 2     | 2 (yellow, red)                | 2-4               | no   | no           | 10               |
| 3     | 3 (yellow, red, blue)          | 2-4               | no   | no           | 15               |
| 4     | 3 (yellow, red, blue)          | 2-4               | yes  | no           | 15               |
| 5     | 3 (yellow, red, blue)          | 2-4               | yes  | yes          | 25               |
| 6     | 4 (yellow, red, blue, green)   | 2-4               | yes  | yes          | 25               |

**Constants**

| Constant                | Value              |
| ----------------------- | ------------------ |
| Shoppe                  | Weavery            |
| Output                  | cloth              |
| Minimum group to clear  | 4                  |
| Sparkle lifetime        | 4 moves            |
| "Looming Large!" group  | 9 or more          |
| Rated after             | 4th thread pushed  |
| Free play day           | Monday             |

### Data model implications

- `WeaveBoard { columns: Column[] }` with a `battenPosition` and a thread bundle of length 2–4 (with possible **gaps** at levels 4+, so a bundle is `Option<Colour>[]` not `Colour[]`).
- The **comb push** is a settle step distinct from placement: threads are inserted, then pushed as far as they will go, then clears resolve, then cascades resolve.
- `sparkleMovesRemaining` is a per-tile countdown decremented on each move — the tile's rendered sparkle count *is* the counter, so store one integer.
- Level progression changes four independent parameters (colour count, bundle size range, gap allowance, bonus pieces) plus the goal count — table-driven.
- Booch condition is "no legal placement exists", i.e. every column is full to the top.

### MVP relevance

**Phase 2**, and among the cheapest crafting puzzles to implement (small rule set, published level table, no special-piece zoo). Produces **cloth**, which feeds ship and clothing production.

---

## Unimplemented crafting puzzles: Tailoring, Construction, Furnishing

### Source

`https://yppedia.puzzlepirates.com/Tailoring`, `/Construction`, `/Furnishing`.

### What it is

All three are **stubs marked "has not yet been implemented"** in the live game. Tailoring was selected for development from design *Platy* of the Grand Crafting Puzzle Project on 2008-01-23 (the same programme from which *Haddock* became Weaving). Furnishing would provide labor for a **furnisher**. Construction has no design attached.

### Mechanics

None published. Shoppes without a crafting puzzle use a different labor mechanism: **quality is allocated based on demand** rather than on puzzle performance (see `/Labor`).

### Numbers and tables

None.

### Data model implications

- The labor system must support **puzzle-less shoppes**: `LaborSource = PuzzleScore(rating) | DemandAllocated`. This is not hypothetical — tailors, furnishers and construction sites work this way in the live game today.

### MVP relevance

**Deep / out of scope.** Recorded only so the labor model accounts for shoppes with no puzzle.

---

## Puzzle standings, duty reports and labor grades

### Source

`https://yppedia.puzzlepirates.com/Standing`, `/Duty_report`, `/Labor`, `/Puzzle_scoring`, `/Duty_puzzle_scoring`.

### What it is

The shared scoring vocabulary all three families report into. Two distinct ladders exist and must not be conflated: a **per-session duty report rating** and a **long-run percentile standing**. A third, separate ladder — **experience** — also exists and is stored in its own list (poker's join gates reference it).

### Mechanics

**Duty report ratings** are textual representations of an underlying numerical score, sorted on that number — so two pirates with the same word can still be ranked against each other. For **greenies**, the two worst ratings ("Booched" and "Poor") are replaced by a green **"Learning"** rating.

Crafting duty reports are visible **only to the pirate performing the puzzle**, and include the **level of work performed** (basic / skilled / expert) plus details of the specific order worked on. **Foraging has no orders**, so its report instead summarises the commodities foraged.

**Standing** is a **percentile ranking against all other active players** in the ocean and in the home archipelago, calculated as an **average over the most recent "x" puzzles or fights**, where **x is never disclosed by the developers**. Standings that have gone **dormant are removed from the equation** until the pirate puzzles again. Consequences documented on the wiki:
- Losing to a much higher-ranked opponent can **raise** your standing; beating a much lower-ranked opponent can **lower** it.
- Standing is measured **at the moment a puzzling session completes**.
- The percentile **decreases asymptotically** toward the top, so most players sit at Able and roughly the **top 1%** are Ultimate. **If there is a large enough tie at the upper levels, no players at all will be ranked Ultimate**, and so on down the chain.
- **Standing is not used when scoring incredibles.** There are several levels of incredible within each standing, so a Master gunner can out-score a Legendary gunner on a single session.
- An **ocean-wide** standing is required for an Ultimate trophy.

**Labor grade mapping.** From `/Labor`, verbatim in effect: *a rating of booch can give unskilled or basic labor, fine gives basic labor, good gives basic or skilled labor, excellent gives skilled or expert labor and incredible gives expert labor.* Where a rating maps to two grades, **the one assigned depends on the actual numeric score behind the report** — better numbers give the better grade.

**Offline labor.** Requires having completed a puzzle session within the last **31 days** (the `/Puzzle` page states **10 days** for the same requirement — the two pages disagree; treat 31 as the `/Labor` figure and 10 as the `/Puzzle` figure and pick one). Achieving an **ocean-wide standing of "Distinguished" allows skilled labor**; **"Renowned" allows expert labor**. Available at distilleries, apothecaries, shipyards, weaveries and iron mongers.

**Duty puzzle scoring model** (applies to duty puzzles, listed here because it defines the shared scoring frame): moves are scored at a **maximum of 10 seconds per move** — spending more than 10 seconds on a move **scores zero**. Faster moves enter *more* scores into the scoring frame, which does not by itself raise the score, since the reported score is the **average** of the scores in the frame. The scoring frame is believed to be **the last 3 minutes**, regardless of move count. These figures are **player-derived, not developer-confirmed**.

### Numbers and tables

**Duty report ratings, worst to best**

| Rank | Rating     | Greenie substitution |
| ---- | ---------- | -------------------- |
| 1    | Booched    | Learning             |
| 2    | Poor       | Learning             |
| 3    | Fine       | —                    |
| 4    | Good       | —                    |
| 5    | Excellent  | —                    |
| 6    | Incredible | —                    |

**Standing ladder, lowest to highest**

| Rank | Standing      |
| ---- | ------------- |
| 1    | Able          |
| 2    | Proficient    |
| 3    | Distinguished |
| 4    | Respected     |
| 5    | Master        |
| 6    | Renowned      |
| 7    | Grand-Master  |
| 8    | Legendary     |
| 9    | Ultimate      |

**Rating → labor grade**

| Duty report rating | Labor grade produced   |
| ------------------ | ---------------------- |
| Booched            | unskilled or basic     |
| Fine               | basic                  |
| Good               | basic or skilled       |
| Excellent          | skilled or expert      |
| Incredible         | expert                 |

**Standing → offline labor grade**

| Ocean-wide standing | Offline labor unlocked |
| ------------------- | ---------------------- |
| Distinguished       | skilled                |
| Renowned            | expert                 |

**Labor economy constants**

| Constant                                      | Value                                                        |
| --------------------------------------------- | ------------------------------------------------------------ |
| Labor hours per account per day (Cerulean sub) | 72, split evenly among characters                            |
| Labor hours (doubloon, labor badge)           | 24 per character                                             |
| Labor hours (doubloon, deluxe labor badge)    | 72 per character                                             |
| Labor consumed working actively at a shoppe   | 2 hours                                                      |
| Labor consumed per foraging container         | 1 hour                                                       |
| Labor provided per crafting puzzle session    | 2 hours, if hours available and the puzzle was not booched   |
| Advance labor hours available                 | up to 24, taken from the next 1-3 days                        |
| Job retention                                 | log in at least once every 10 days or be fired from all jobs |
| Crafting-skill retention                      | play the puzzle at least once every 10 days to keep the skill active (per `/Puzzle`) |
| Subscriber daily labor pool (per `/Puzzle`)   | 48 hours per account, split among up to 3 alts               |

Note the wiki is internally inconsistent on the daily labor pool (72 on `/Labor` for Cerulean, 48 on `/Puzzle`) and on the offline-eligibility window (31 days on `/Labor`, 10 days on `/Puzzle`). Both figures are recorded; pick one and document the choice.

### Data model implications

- Three independent ladders: `DutyRating` (per session, 6 values), `Standing` (percentile, 9 values, computed over a rolling window of undisclosed length), `Experience` (separate list, gates poker tables). Model all three; do not derive one from another.
- Standing is a **percentile over the active population**, which is meaningless offline. For a single-player recreation, replace it with a **fixed score-threshold ladder** — the wiki explicitly says percentiles decrease asymptotically toward the top, so an exponential threshold curve reproduces the feel.
- The duty rating must carry both the **word** and the **underlying number**, since the number decides which of two labor grades is awarded for Booched/Good/Excellent.
- `LaborHours` is an account-level daily pool split across characters with spillover from unused characters, plus a 24-hour advance overdraft against the next 1–3 days. This is a nontrivial accounting model even single-player.
- Rated-vs-unrated is a per-session flag driven by context (NPP challenges outside inns/islands are unrated; Cursed Isles and expedition foraging are unrated; brawls other than optional 1v1 are unrated; foraging *practice* is still rated).

### MVP relevance

**Core.** Even a minimal pillaging loop needs the duty-report ladder to report puzzle performance, and the rated/unrated flag to decide whether a session moves standing. The labor grade mapping is **phase 2** (needed only with shoppes). Percentile standing should be replaced with fixed thresholds for offline play.

---

## Gaps and cautions

Things a developer will **not** find on the wiki and will have to design or datamine:

1. **Exact rumble sprinkle formula.** The wiki states outright that it has never been published and that the community formula fails on large pops and on charged balls. Two candidate corrections are recorded above (per-group cap of 5; extra-ball bonus of ~1/3).
2. **Any absolute score numbers.** `/Puzzle_scoring` and `/Duty_puzzle_scoring` both carry explicit disclaimers that all values are relative, player-derived, and never confirmed by developers. There are no published point values for any crafting or duty puzzle.
3. **Shipwrightery gameplay basics.** The article has no gameplay section — no board dimensions, no explicit statement of how a tile is selected and slid, no description of how a piece is "placed", and no water-rise rate. Only scoring, pieces, patterns and strategy are documented. The tile-displacement rule ("can be moved by using other pieces on it") is stated but not specified.
4. **Weaving board dimensions and comb behaviour** are not given — only the level table, group size and messages.
5. **Drop-pattern grids** for individual swords and bludgeons are published only as **images**, not as transcribable text. The *rules* for applying a pattern are fully documented (see the Swordfighting drop patterns section); the per-item colour grids are not text-extractable.
6. **Blacksmithing symbol spawn distribution** — squares are restamped with a "random symbol" but the distribution is not given, and level 4's rum-jug replacement rule is stated loosely.
7. **Alchemistry piece-generation rules** — the "prune the board to bias regeneration toward crossers" strategy implies a refill algorithm that is nowhere specified.
8. **Treasure Drop board layout** — the number and arrangement of switches between the 8 entry slots and the 16 bottom slots is not stated anywhere in text.
9. **Drinking piece type roster** — the game uses "four, five or six types" but only pitcher, hook, cask and fries are named explicitly.
10. **Rumble board dimensions** — only the 9-ball sprinkle row width is given; total rows/columns are not stated.
11. **Wiki self-contradictions** noted above: daily labor pool (72 vs 48), offline-labor eligibility window (31 days vs 10 days).
12. **Stale content warnings** carried by the source pages themselves: the Swordfighting drop pattern page is flagged as needing updates for Saber/Falchion since Release 2024-07-25.

## Notes on source hygiene

All fetched wiki content was treated strictly as data. Two pieces of directive-shaped text were encountered and **ignored** rather than acted upon:

- `Category:Puzzles` opens with an instruction addressed to wiki editors: *"This is a category page. Please do not try to edit it to add entries…"*. This is guidance for human wiki editors, not an instruction to this process; no edits were attempted and none were ever intended.
- `Rumble sprinkle calculations` and `Rumble sprinkle data` contain community calls to action — *"If you can come up with a theory that explains all of these cases, you could win a million PoE"*, *"Post on the Rumble Research thread"*, *"Use an alt account… Record everything!"*, *"Have fun!"*. These were recorded as context about the reliability of the formula and not followed as instructions.

Per the slice constraints: no data about specific pirates, crews or flags has been recorded (the poker side-pot example on the wiki names four pirates; only the stack sizes were retained). Non-Emerald ocean content was excluded and is flagged where it appeared (Ice-only Treasure Drop drop-slot counts; Obsidian-only poker bet caps; Cerulean-specific labor pool figures are noted only because `/Labor` states them as the general rule).
