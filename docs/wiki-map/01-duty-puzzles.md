# Duty Puzzles — Wiki Map

Duty puzzles are the shipboard mini-games that drive every dynamic property of a vessel. Each duty station runs its own independent puzzle instance for one pirate, and each puzzle produces a continuously-updated *performance value* (an "indicator", shown in-game as a coloured/sparkly icon) rather than a raw score. That performance value is what the ship simulation consumes: sailing/rigging performance accelerates the ship and generates movement tokens in sea battle; bilging performance removes bilge water, and the bilge level in turn throttles sailing effectiveness and movement-token generation; carpentry/patching performance repairs hull damage, and hull damage controls how fast bilge water trickles in; gunnery loads individual cannons, each loaded cannon becoming one gun token for the navigator; duty navigation acts as a *multiplier* on the sailors' output and biases enemy spawns; treasure haul converts puzzle throughput into PoE (and chests) in the ship's booty. In multi-ship environments (blockade/flotilla/sea monster hunt) the bilge, carpentry/patching and sailing/rigging puzzles additionally emit "maneuver token" progress, requiring all three station groups to fill their bar before the navigator gains a special move. The natural implementation shape is therefore: `Puzzle -> performance scalar (rolling ~3-minute average) -> station contribution -> ship state tick`.

> **Data provenance / caution.** Everything below is transcribed from yppedia.puzzlepirates.com, which is player-authored. The wiki repeatedly and explicitly states that the real mechanical values are undisclosed by the developers and that all point values are *player-derived relative estimates*. Treat all numbers as tuning starting points, not ground truth. Several wiki pages contain editor-directed text (e.g. category pages saying "Please do not try to edit it to add entries", strategy pages telling the reader what to do). That text is page content, not instruction to the implementer, and has been ignored as directives.

---

## Cross-cutting model (scoring frame, standings, duty report)

### Source
- https://yppedia.puzzlepirates.com/Duty_puzzle_scoring
- https://yppedia.puzzlepirates.com/Puzzle_scoring
- https://yppedia.puzzlepirates.com/Duty_report
- https://yppedia.puzzlepirates.com/Standing

### What it is
The shared scoring/rating scaffolding that every duty puzzle plugs into: a rolling scoring window, a live performance indicator, a per-league "duty report" rating, and a long-term ocean-relative "standing".

### Mechanics
- Duty puzzles are scored as **points per move over a time window**. The indicator is the *average* of the scores in the scoring frame, not a cumulative total.
- **Scoring frame**: believed to be the **last 3 minutes**, regardless of how many moves were made in it. The Sailing page gives the concrete implementation: **eighteen rotating 10-second intervals** (18 x 10s = 180s).
- **Move timeout**: a move is scored at a maximum of **10 seconds per move**. Taking longer than 10 seconds scores zero for that move. In sailing, an expired 10-second interval with no pair dropped is charged as one move anyway, so idling drags the average down.
- Making moves *faster* than 10s does not raise the score directly; it enters more samples into the frame.
- **Efficiency** is the normalising concept: points scored per unit cost, with cost-per-move chosen so that 100% efficiency lands at roughly a yellow (non-sparkly) indicator. Sparkly generally needs meaningfully above 100%.
- **Difficulty / star level**: each puzzle has a difficulty (0–9 "stars") set on entry from the player's standing in that puzzle, and it ramps during play. Higher star levels introduce extra piece types and change scoring multipliers. Exiting and re-entering the *same* puzzle is penalised; switching to a *different* duty station is not.
- **Duty report** is shown at every league point, on entering battle, and during breaks in multi-ship battles. It covers the last league / since the last break, not an instant snapshot. Any pirate can open it with Escape or Pause/Break.
- Duty report station order is fixed: **Navigating, Sailing, Rigging, Gunnery, Carpentry, Patching, Bilging, Treasure Haul**. Stations with nobody working them are omitted entirely.
- Duty report ratings are text labels over an underlying numeric score (ties in label can still be ordered numerically).
- **Standing** is a percentile rank against all *active* players on the ocean, computed as an average over the most recent *x* sessions (x undisclosed). Dormant standings are removed from the calculation. The percentile bands shrink asymptotically toward the top — most players sit at Able, only the top ~1% are Ultimate. If there is a large enough tie at the top, nobody is awarded Ultimate.
- Standing and duty-report rating are **independent**: a Master gunner can score a higher "incredible" than a Legendary gunner, because standing is not an input to the per-league score.

### Numbers and tables

Duty report ratings, worst to best:

| Rank | Rating     | Notes                                                     |
| ---- | ---------- | --------------------------------------------------------- |
| 0    | Booched    | Shown as green "Learning" for greenies                    |
| 1    | Poor       | Shown as green "Learning" for greenies                    |
| 2    | Fine       | Corresponds roughly to 100% efficiency                    |
| 3    | Good       |                                                           |
| 4    | Excellent  |                                                           |
| 5    | Incredible | ~99th percentile / top ~1%; multiple internal sub-levels  |

Puzzle standings, lowest to highest:

| Rank | Standing     |
| ---- | ------------ |
| 0    | Able         |
| 1    | Proficient   |
| 2    | Distinguished|
| 3    | Respected    |
| 4    | Master       |
| 5    | Renowned     |
| 6    | Grand-Master |
| 7    | Legendary    |
| 8    | Ultimate     |

Generic scoring-affector chart (from Puzzle scoring; "plus/minus" are relative, unquantified):

| Affector                    | Effect                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| Time                        | Small minus in most puzzles; large minus in gunnery                    |
| Inactivity (~10s no action) | Minus                                                                  |
| Cascade                     | Usually an increasing multiplier (1x, 2x, 3x, ... per step)            |
| Combo (simultaneous clears) | Increasing bonus in bilge; no additional bonus in sails                |

### Data model implications
- `PuzzleSession { puzzleType, starLevel, scoringFrame: RingBuffer<IntervalSample>(18), moves, score }`.
- `IntervalSample { durationMs: 10_000, movesInInterval, pointsInInterval }`; an empty expired interval still contributes `moves += 1`.
- `performance = totalPoints / totalMoves` over the frame; map through per-puzzle thresholds to an indicator 0..1 and to a `DutyReportRating` enum.
- `PirateStanding { puzzleType, recentSessionScores: Deque, percentile, standingLabel }` — for a single-player offline game, replace the ocean-percentile with fixed calibrated thresholds.
- Star level should be a first-class input to board generation (which piece/critter types exist) *and* to scoring multipliers.

### MVP relevance
Core. The scoring frame + indicator + duty report rating is shared infrastructure that every puzzle needs; build it once before any individual puzzle.

---

## Bilging

### Source
- https://yppedia.puzzlepirates.com/Bilging
- https://yppedia.puzzlepirates.com/Bilge_scoring
- https://yppedia.puzzlepirates.com/Bilging_tutorial

### What it is
A match-3 swap puzzle (wiki cites Tetris Attack + Bejeweled as influences). Clearing pieces pumps bilge water out of the ship; a high bilge level makes sailing less effective and slows movement-token generation in sea battle.

### Mechanics
- **Board**: a rectangular grid of coloured bilge pieces with a **water line** across it. **The wiki does not publish the grid dimensions.** Known constraints: the board always has **at least 3 rows of water at the bottom** and **at least the top 3 rows always dry** (set by Beta release 2003-10-22).
- **Piece types**: coloured pieces (**7 colours at the 7-star level**), plus three "critters": crab, puffer fish, jellyfish.
- **Gravity**: pieces fall downward into cleared space; **pieces moving below the water line move more slowly** (a real gameplay/timing effect, not cosmetic).
- **Controls**: a two-cell horizontal cursor. Mouse move / arrow keys move the cursor; left click / Enter / Space swaps the two selected pieces **horizontally only** (no vertical swaps — this is the key difference from Treasure Haul).
- **Clearing**: rows or columns of **3 or more** identical pieces clear.
- **Combos** = multiple lines cleared by a single swap. **Chains/cascades** = secondary clears caused by falling pieces. Combos score far better than chains; chains are largely luck, though a long chain that frees multiple crabs can score well and re-randomises a stale board.
- **Water line behaviour**: starts at 3 rows. Rises if the puzzle is ignored or played badly; **the higher the ship's damage, the faster water trickles in**. Playing well pushes it back toward the 3-row floor. The top 3 rows never flood.
- **Crab**: immovable. Cleared when it *reaches* (rises above) the water line. Big score bonus that scales with **water height** (not the crab's own height) and with **how many crabs clear simultaneously**. Appears at **5 stars and above**. Clicking a crab does nothing (idle animation only).
- **Puffer fish**: click to expand; clears itself and the **8 adjacent pieces** (a 3x3 with the puffer at centre). Appears at **3 stars and above**. Score-negative unless it triggers a chain or lifts crabs above the water line. Clearing a crab via an adjacent puffer awards **no** crab bonus. Swapping two puffers just swaps them.
- **Jellyfish**: swap it with a coloured piece to clear **all pieces of that colour on the board**. Appears at **6 stars and above**. Does not work on other special pieces: jelly+crab does nothing; jelly+puffer makes the puffer detonate first (destroying the jelly); jelly+jelly is a plain swap.
- **Bad move / stall penalty**: after **10 seconds without a move** the game applies a score penalty **equivalent to one click** (i.e. it charges a move with zero points).
- **End condition**: there is no lose state — the board runs continuously while the pirate occupies the station.
- **Blockade (token) bilging**: some pieces carry one of **8 bonus shapes**, each a *half* (top or bottom) of a circle, diamond, plus, or X. The shape rides with the piece and dies with it. When the matching top and bottom halves of one symbol are adjacent, both shapes are removed (the underlying bilge pieces survive) and the puzzler contributes progress to that maneuver meter. **On a sloop, 3 bonus pieces fill the bilge meter.** Token pieces only spawn while performance is good — low score slows or stops token spawning.

### Numbers and tables

Combo names by shape cleared (letters = a cleared line of any length ≥ 3):

| Message      | Trigger                                     |
| ------------ | ------------------------------------------- |
| Good         | 4 in a row                                  |
| Great        | 5 in a row                                  |
| Arrr!        | 3x3 or 3x4                                  |
| Har!         | 4x4                                         |
| Yarrr!       | Ax5                                         |
| Bingo!       | AxBxC (three lines)                         |
| Sea Donkey!  | 3x3x3x3, 3x3x3x4, or 3x3x4x4                |
| Vegas!       | AxBxCx5 (four lines, at least one of len 5) |

Base points per cleared line (player-derived):

| Line length | Points |
| ----------- | ------ |
| 3           | 3      |
| 4           | 5      |
| 5           | 7      |

Combo multiplier at 7-star level:

| Combo shape        | Multiplier            |
| ------------------ | --------------------- |
| Single line        | 1                     |
| NxN (double)       | 2                     |
| NxNxN (bingo)      | 3                     |
| Sea Donkey (4 lines)| at least 4, maybe 5  |
| Vegas (4 lines, x5)| at least 5, maybe 6–7 |

At low star levels the combo multipliers are lower (combos are easier to obtain).

Chain (secondary clear) value: estimated at **no more than 1 point per block cleared**, non-increasing.

Worked score table (score = sum of line base points x combo multiplier):

| Clear   | Score formula      | Score | Moves for 100% | 133%  | 150%  | 166%  |
| ------- | ------------------ | ----- | -------------- | ----- | ----- | ----- |
| 3       | 3*1                | 3     | 1              | 0.75  | 0.667 | 0.6   |
| 4       | 5*1                | 5     | 1.667          | 1.25  | 1.111 | 1     |
| 5       | 7*1                | 7     | 2.333          | 1.75  | 1.556 | 1.4   |
| 3x3     | (3+3)*2            | 12    | 4              | 3     | 2.667 | 2.4   |
| 3x4     | (3+5)*2            | 16    | 5.333          | 4     | 3.556 | 3.2   |
| 3x5     | (3+7)*2            | 20    | 6.667          | 5     | 4.444 | 4     |
| 4x4     | (5+5)*2            | 20    | 6.667          | 5     | 4.444 | 4     |
| 4x5     | (5+7)*2            | 24    | 8              | 6     | 5.333 | 4.8   |
| 5x5     | (7+7)*2            | 28    | 9.333          | 7     | 6.222 | 5.6   |
| 3x3x3   | (3+3+3)*3          | 27    | 9              | 6.75  | 6     | 5.4   |
| 3x3x4   | (3+3+5)*3          | 33    | 11             | 8.25  | 7.333 | 6.6   |
| 3x3x5   | (3+3+7)*3          | 39    | 13             | 9.75  | 8.667 | 7.8   |
| 3x4x4   | (3+5+5)*3          | 39    | 13             | 9.75  | 8.667 | 7.8   |
| 3x4x5   | (3+5+7)*3          | 45    | 15             | 11.25 | 10    | 9     |
| 3x5x5   | (3+7+7)*3          | 51    | 17             | 12.75 | 11.333| 10.2  |

Calibration anchors:
- **3 points per move = 100% efficiency** (a plain 3-clear every move).
- **Sparkly indicator generally needs an average of at least 4 points per move** (varies by ocean).
- Move-equivalence heuristics from the Bilging page: a 3-break is worth slightly under 1 move; a 4- or 5-break is worth 1–2 moves; a 3x3 double is worth about **3 moves**; at high level a bingo is worth about **8 moves**. Extending a 3x3 to a 3x4 with an extra move is a net loss; extending a 3x3 to a bingo (+5 move-equivalents for 2 extra moves) is a net gain.
- Crab value: **unknown**, but confirmed to scale with water height. At full water, clearing **two crabs in one move** scores somewhere between a bingo and a sea donkey.

Critter unlock thresholds:

| Critter     | Minimum star level |
| ----------- | ------------------ |
| Puffer fish | 3                  |
| Crab        | 5                  |
| Jellyfish   | 6                  |

### Data model implications
- `BilgeBoard { width, height, cells: Cell[][], waterLineRow }` where `Cell = Colour(0..6) | Crab | Puffer | Jelly | Empty`.
- Swap is constrained to `(x, y) <-> (x+1, y)`. Validate, apply, then run a resolve loop: `matchDetect -> clear -> applyGravity (slower below waterline) -> refill from top -> repeat`, incrementing a chain counter per iteration.
- Score the *first* resolve step as the combo (count distinct lines, multiply); subsequent steps as chain (flat ~1/block).
- `waterLevel` is ship state, not board state: `waterLevel += inflowRate(shipDamage) * dt - pumpRate(bilgePerformance) * dt`, clamped to `[3 rows, boardHeight - 3 rows]`. Render the water line from it.
- Crab clear event carries `waterLevel` and `simultaneousCrabCount` into the score function.
- Token mode: each piece optionally carries `BonusHalf { shape: Circle|Diamond|Plus|Cross, half: Top|Bottom }`; adjacency check after each settle.

### MVP relevance
Core. This is the first puzzle new players are assigned, it is the simplest to implement, and it is the one whose output (bilge level) most other systems read.

---

## Sailing

### Source
- https://yppedia.puzzlepirates.com/Sailing
- https://yppedia.puzzlepirates.com/Sail_scoring

### What it is
A falling-pair puzzle (wiki cites Dr. Mario) played at a sailing station. Performance accelerates or decelerates the vessel and generates movement tokens in sea battle. Sailing and Rigging are alternatives occupying the *same* station type.

### Mechanics
- **Board**: **8 columns wide x 16 rows high**. Pieces spawn as joined pairs falling from the **two central columns**.
- **Piece colours**: three — water (blue), rope (yellow), wind (white).
- **Targets / platforms**: the board contains outlined *target* cells grouped into rectangular *platforms*. A platform is completed when every outlined target in it holds a piece of the matching colour. Non-target cells inside the platform's rectangle may hold anything or be empty.
- **Platform as shelf**: an *active* (incomplete) platform acts as a solid shelf across its full rectangular width — pieces cannot fall through the gaps between its targets until the platform clears.
- **Joined-pair constraint**: the two halves of a landed pair stay constrained to each other. If one half clears, the constraint breaks and the survivor falls under gravity. This is the primary chain-building tool.
- **Line clears**: **4 or more** adjacent same-colour pieces in a horizontal or vertical line clear. (Note: 4, not 3.)
- **Resolution order**, repeated until stable:
  1. Apply gravity until nothing can fall.
  2. Clear **all** completed platforms simultaneously.
  3. Clear **all** horizontal/vertical lines of 4+ simultaneously.
  4. Repeat.
  Each non-empty platform-clearing step or line-clearing step advances the chain counter by **one**. Simultaneous clears in the same step count as one chain step but all contribute material to the score.
- **Controls**: Left/Right move the falling pair; Up/Down rotate clockwise/counter-clockwise; Space increases fall speed (the pair remains movable and rotatable while soft-dropping).
- **Board completion**: when every platform is cleared, a new board is generated. **No score bonus for clearing the board** — the benefit is fresh productive platforms and removed clutter.
- **Booch (lose condition)**: after all clears and gravity resolve, if **either top cell of the two central spawn columns is occupied**, the game shows "Oh, ye Booched it!", applies a **20-point puzzle penalty**, and generates a fresh board.
- **Difficulty ramp**: boards get progressively harder while play continues without a booch. After several boards are cleared, the side stars and board difficulty **reset**.
- **Inactivity**: an expired 10-second interval with no pair dropped is charged one move (see cross-cutting section).
- **Token sailing** (blockade/flotilla/SMH): bonus shapes appear on ordinary yellow/blue/white pieces while the pirate is performing well. If two **matching** bonus shapes are adjacent and are included in the **same platform or line clear**, they contribute maneuver progress — **the carrier pieces need not be the same colour**. If that qualifying clear happens as the **3rd or later step of a chain**, additional maneuver progress is awarded. Multiple shapes may be removed in one larger clear.

### Numbers and tables

Chain notifications:

| Chain steps | Notification    |
| ----------- | --------------- |
| 1           | (none)          |
| 2           | Double          |
| 3           | Triple          |
| 4           | Bingo!          |
| 5           | Donkey!         |
| 6+          | Vegas!!         |

Chains beyond 6 keep displaying "Vegas!!" (players write V², V³ for longer). The *size* of the notification text reflects the value of the clear, up to a display cap — a Triple containing a big platform clear draws larger text than a Triple of small line clears.

Base values accumulated across an entire resolved cascade:

| Cleared item                                                    | Points |
| --------------------------------------------------------------- | ------ |
| Each of the **first four** ordinary pieces in a line-clearing step | 1      |
| Each **additional** ordinary piece beyond four in that step      | 2      |
| Each non-fixed piece cleared from a platform                     | 4      |
| Each fixed square piece                                          | 5      |
| Filling a previously-unfilled target with the correct colour     | +1     |
| Losing a correctly-filled target before its platform completes    | −1     |

Chain multiplier. Let `c` = number of chain steps, `d` = current board difficulty. Effective multiplier:

| Condition | Effective multiplier      |
| --------- | ------------------------- |
| c ≤ 2d    | c                         |
| c > 2d    | 2d + (c − 2d) / 2         |

The accumulated base value for the whole cascade is multiplied by this effective value and **rounded down**. Chains beyond twice the current difficulty keep gaining, but at half a step each. The displayed chain *name* is the step count, not necessarily the literal multiplier.

Booch penalty: **−20 points**.

Older player-derived alternative model (Sail_scoring page, retained for calibration cross-check; it conflicts with the newer per-piece values above and should be treated as the weaker source): 1 point per ball, 2 for solid blocks, 2 for balls in a target; per-ball cost of 2 (per-drop cost of 4); plain 4-clears = 50% efficiency; a single target clear ≈ 100%. Worked examples on that page: simple double into a platform ≈ 125%; platform-to-platform double ≈ 140% (120% with no platform bonus); plain triple onto a platform ≈ 112.5%; "ultimate triple" (single onto platform, then platform) = 4+16+24 = 44 points in 6 drops ≈ 188%; a V⁴ quad-vegas ≈ 4+8+16+...+36 = 180 points, ≈ 200% at 22 drops.

Sailing generates **no score on most moves** — high-end play is occasional large scoring events with long zero stretches, and the 3-minute frame smooths it.

### Data model implications
- `SailBoard { width: 8, height: 16, cells, platforms: Platform[] }`.
- `Platform { rect, targets: [{pos, requiredColour, filledWith}], active: bool }`. Shelf behaviour means gravity must query "is there an active platform whose rect spans this cell" before allowing a fall through a non-target gap.
- `FallingPair { a: {colour}, b: {colour}, orientation, originColumns: [3,4] }`; on landing, record `pairLink(a, b)` so a clear of one frees the other.
- Resolve loop must be a strict state machine matching the documented order, with a `chainStep` counter and an accumulator for the whole cascade — the multiplier is applied *once at the end* to the accumulated total, not per step.
- `boardDifficulty: int` feeds the `c > 2d` branch and board generation; reset it after N cleared boards.
- Booch check reads exactly two cells: `(col 3, row 0)` and `(col 4, row 0)` (0-indexed centre columns of an 8-wide board).

### MVP relevance
Core. Sailing is the primary speed/movement-token source and the puzzle with the most precisely-documented scoring model on the wiki.

---

## Rigging

### Source
- https://yppedia.puzzlepirates.com/Rigging

### What it is
A hexagonal line-pull puzzle. Functionally interchangeable with Sailing: same station, same ship effect (accelerate/decelerate, movement tokens). Added in release 2009-04-21.

### Mechanics
- **Board**: a **hexagonal grid** of pieces. Pieces are selected in straight lines along one of **six directions**.
- **Pulleys**: **6 pulleys** around the board; exactly **one is active** at any time. The active pulley advances **clockwise after every move**, whether or not a pull was made.
- **Goal**: build large chains of like-coloured pieces *in front of the active pulley* so they get pulled off the board.
- **Controls**: mouse or `W, E, A, D, Z, X` move the cursor (six hex directions); left click / `S` / spacebar selects pieces; right click / spacebar deselects and resets the selected row.
- **Piece set**: **8 normal pieces**, two of which only appear after the puzzle has been played for a while (i.e. gated on ramping difficulty).
- **Rope coil**: a meter at the bottom of the board. Clearing pieces adds loops. **The coil holds 20 loops**; on filling, a **Wild piece** is added to the board and a new coil starts. **If no pull is made for 3 consecutive moves, 5 loops are lost** from the coil (but the wiki states this is *not* believed to penalise the score itself).
- **Looping**: completely surrounding a piece within a pull adds a **score bonus** and **extra loops** to the rope coil.
- **Special pieces** (none of these can be pulled by a pulley if placed directly in front of it):

| Piece  | Effect                                                                                                   | How obtained                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Wild   | Counts as any colour in a chain. Also substitutes for other specials on lower-level boards.               | Completing a 20-loop rope coil                                                                                       |
| Gaff   | When included in a chain, pulls all surrounding pieces regardless of colour.                              | Surrounding a non-matching piece in a pull                                                                            |
| Tar    | When pulled, forces the replacement pieces in that area to all be the same colour. Two tars in one chain share a colour. | Removing all of one colour from the board in a pull of **5 or more** pieces                                          |
| Splice | Causes a second adjacent chain to be pulled as well; the linked pair is shown by the interlocking rope colours. | Linking an **inactive** pulley to a chain when it is pulled — but *not* the pulleys either side of the active one. **Only one splice may exist on the board at a time**; further splice-earning moves award a Wild instead. |

- **Scoring**: large pulls good, many small pulls bad; efficiency of clearing drives the indicator. **Clearing faster does not directly help**, but a long gap between moves lowers the score.
- **Blockade rigging** is a two-stage token system, unlike every other puzzle: bonus shapes appear on normal pieces (only while performing well). Making a clear that includes a bonus shape **activates the next pulley** for that shape. Then making a pull *with that same maneuver* on the activated pulley **scores a token**. A pull that does not use that maneuver, or no pull at all, simply deactivates it. Multiple maneuvers can be active simultaneously. If an activated pulley is used to pull a *different* maneuver, the activation is **passed on to the next pulley in line**.

### Numbers and tables
- Pulleys: **6**. Directions: **6**. Normal piece types: **8** (2 late-unlock).
- Rope coil capacity: **20 loops**. Coil completion reward: **1 Wild piece**.
- No-pull penalty: **3 consecutive moves with no pull → −5 loops**.
- Tar requirement: a pull of **5+ pieces** that removes all of one colour.
- **No published point table exists for rigging.** There is no `Rig_scoring` page — the Duty puzzle scoring hub covers only Bilging, Carpentry, Sailing, Duty Navigation and Gunnery.

### Data model implications
- Hex grid: axial coordinates `(q, r)` with 6 neighbour offsets; "straight line in one of six directions" = repeated neighbour step.
- `Pulley[6] { position, active }` with `activeIndex = (activeIndex + 1) % 6` incremented **on every move**, not every pull.
- Selection is a *path* of contiguous same-coloured (or Wild) pieces terminating at the active pulley — model as an ordered list with validation, plus a "loop" test (does the selected path enclose one or more cells?).
- `RopeCoil { loops: 0..20 }`.
- Special-piece acquisition is event-driven off the pull resolution, so the resolver must report: pieces cleared, colours exhausted, cells enclosed, inactive pulleys touched.

### MVP relevance
Phase 2. Same ship effect as Sailing, so it adds no new ship-state surface, and its scoring is the least documented of all the duty puzzles. Implement only after Sailing works.

---

## Carpentry

### Source
- https://yppedia.puzzlepirates.com/Carpentry
- https://yppedia.puzzlepirates.com/Carp_scoring
- https://yppedia.puzzlepirates.com/Carpentry_tutorial

### What it is
A pentomino tiling puzzle. Performance repairs wear-and-tear and sea-battle damage, and slows the rate at which bilge water enters the ship.

### Mechanics
- **Board**: a 2x2 arrangement of **holes** (upper-left, upper-right, lower-left, lower-right). Up to **four holes are active simultaneously** depending on difficulty; a beginner starts with a **single** hole and three pieces that exactly fill it.
- **Holes**: each hole has a *nominal size n*, measured in pieces. A size-6 hole contains **30 squares** (n x 5) and can be finished as a Masterpiece with exactly 6 pieces.
- **Toolbox**: exactly **three pieces** are available at a time; placing one immediately draws a replacement.
- **Pieces**: the **12 pentominoes** (each 5 orthogonally-connected squares) plus a **Putty Bucket** special = 13 toolbox item types.
- **Placement legality**: a piece may overlap already-covered squares or overhang the hole edge, **provided** it covers at least one new square and touches either the hole edge or existing work. Every placement counts as one full piece used regardless of how few new squares it covers — so overlap/overhang normally destroys the Masterpiece.
- **Hole replacement**: completed holes are only replaced when a **completed pair shares a row or column** of the 2x2 board. Diagonally-opposite completed holes do **not** scroll the board. So finish *adjacent* holes to keep playable space.
- **Star meter** (left side of board): tracks progress through holes before the whole board resets with four fresh empty holes. **Maximum 9 stars; each star represents two holes** (i.e. up to 18 holes per round).
- **Neglect**: each unfinished hole has a neglect counter. Placing a piece in a hole resets that hole's counter; every placement in a *different* hole decrements it. A hole may be skipped **7 consecutive times safely; the 8th skip causes damage**.
  - **Empty hole**: a warning (flashing) begins when 3 skips remain (i.e. after 5 consecutive skips). On expiry, **one square is added to the hole edge and 2 points are deducted**. This can happen **up to 3 times**, after which an untouched hole stops expanding.
  - **Hole with pieces**: the most recently placed piece **falls out** on expiry (it shimmies as a warning, 2 turns of grace per the tutorial). The squares it exposed are deducted from the score. It **still counts as a piece used**.
  - Either kind of damage **resets the consecutive-Masterpiece counter** and **permanently prevents that hole from ever being a Masterpiece** (an expanded hole no longer has a multiple-of-5 square count).
- **Putty bucket**: fills the **entire orthogonally-connected empty region** clicked, but **only if that region is ≤ 5 squares**. It cannot fill part of a larger region. Counts as **one piece**, and **always preserves Grain**. To preserve a Masterpiece it must fill exactly 5 squares. Unavailable at the lowest difficulties, and a second bucket cannot be drawn while one is already in the toolbox. The selected bucket outlines a region **blue** if fillable and **red** if not.
- **Controls (mouse)**: left-click select/move/place/release; mouse wheel down = rotate clockwise, up = counter-clockwise; middle-click = rotate clockwise; right-click = flip horizontally; with putty selected, click a connected empty region of ≤5 squares.
- **Controls (keyboard)**: `1`–`3` select toolbox item; `Space` select/release; `X`/`C` rotate CCW/CW; `Z` flip horizontally; arrow keys move; `Q`/`W`/`A`/`S` centre the piece over upper-left / upper-right / lower-left / lower-right hole.
- **Last-piece adjustment**: the most recently placed piece can be re-selected and moved by one square, rotated, or flipped — **only if no other piece has been selected since**, and **not** after passing a league point. Also not available if it completed a hole.
- **Grain**: a Grain bonus is awarded if **every** piece remaining in the completed hole preserves horizontal grain. One wrongly-oriented piece loses it. Pieces enter play grain-preserving. A **90° rotation changes grain direction**; **flipping or rotating 180° preserves it**. The **I, L, N and Y** pentominoes have fixed grain along their long axis, so using them the other way loses Grain. For **V, W and X**, a flip can often produce the same footprint as a 90° rotation without changing grain. Putty always preserves Grain.
- **Nice Set**: awarded when a Masterpiece is completed using **only one type of piece**. Worth exactly **1** point.

### Numbers and tables

Completion rating for a hole of nominal size *n*:

| Rating             | Pieces used              |
| ------------------ | ------------------------ |
| A Masterpiece!     | exactly n                |
| Craftsmanship!     | n + 1                    |
| A Fair Job.        | n + 2                    |
| Sloppy Work.       | n + 3 through 2n − 1     |
| A Pig's Breakfast! | 2n or more               |

Note: "Pig's Breakfast" is **not** simply 4+ extra pieces — its threshold scales with hole size.

Completion bonuses (Carpentry page):

| Bonus                   | Points                                  |
| ----------------------- | --------------------------------------- |
| Masterpiece             | 2n − 4                                  |
| Grain                   | floor(n / 2)                            |
| Nice Set                | 1 (only on a Masterpiece)               |
| Consecutive Masterpiece | k − 1 for the kth consecutive Masterpiece |

The Masterpiece bonus exceeds the Grain bonus at every normal hole size, so never trade a Masterpiece for Grain.

Per-placement scoring: **1 point per previously-empty square covered** (normally 1–5). Neglect damage on the same move is subtracted.

Alternative integer-math model (Carp_scoring page, a *different* normalisation of the same system — use one or the other, not both):
- A plain piece covering 5 empty squares scores **10 points**; each placement costs 10 → 100% baseline efficiency.
- Completion multiplier applied to the number of pieces needed to cover the hole:

| Finish             | Factor |
| ------------------ | ------ |
| A Masterpiece!     | +2     |
| Craftsmanship!     | +1     |
| A Fair Job         |  0     |
| Sloppy Work        | −1     |
| A Pig's Breakfast! | −2     |

  Grain adds **+1** to the multiplier; Nice Set is believed to add **+1**; consecutive Masterpieces after the first are believed to add another **+1**.
- Worked example: a 50-square hole = 10 pieces. Masterpiece → 100 points coverage + 20 bonus = **120**.
- Worked example: a 40-square (8-piece) initial hole, playing all 4 holes to avoid waste = 11 pieces played → 110 points + 16 MP bonus = **126 points ≈ 114% efficiency**. A Craftsmanship finish on the same hole = 12 turns, 118 points ≈ **98% efficiency**.
- Long-term Masterpiece play: **10 points per piece + 3 per piece MP bonus = 13 per piece = 130%**. Anything below Masterpiece on a mid-size hole falls under 100%: an N-piece hole finished in N+1 turns scores 11*N — the smaller the hole, the worse the Craftsmanship penalty.
- Consecutive Masterpiece counter runs **Masterpiece! → Masterpiece2! → ... → Masterpiece18!**, then resets (also resets when the star meter fills and a new set of four holes starts).

Piece draw weights (relative frequency; total 95 including the bucket):

| Piece  | Weight | Symmetry / grain notes            |
| ------ | ------ | --------------------------------- |
| P      | 22     | 2 grain directions                |
| F      | 14     | 2 grain directions                |
| Y      | 14     | asymmetric — fixed grain          |
| L      | 8      | asymmetric — fixed grain          |
| N      | 8      | asymmetric — fixed grain          |
| T      | 7      | 2 grain directions                |
| U      | 4      | 2 grain directions                |
| V      | 4      | symmetric — both grains in one    |
| W      | 4      | symmetric — both grains in one    |
| Z      | 4      | 2 grain directions                |
| X      | 3      | symmetric — both grains in one    |
| I      | 2      | asymmetric — fixed grain          |
| Bucket | 1      | always preserves grain            |

Useful two-piece finishing shapes (10 remaining squares) and the pairs that fill them:

| Name      | Fillable by                            | Note                                                      |
| --------- | -------------------------------------- | ---------------------------------------------------------- |
| Top-Notch | PL, PY, PT, PV, PZ, YU, FU             | Best. With P held, partners L/Y/T/V/Z have combined weight 37 |
| Dogleg    | PP, PU, PL, LN, VZ                     | Nearly as good                                             |
| Dome      | PP, PL, PW                             | With P held, P/L/W combined weight 34                       |
| (fourth)  | PF, PN, PV, UX                         | PF uses the two commonest pieces                            |
| Offset    | PP, NN, WW, UU                         | Mostly needs matched pairs                                  |
| Animal    | PP, FV, LU                             | PP most likely                                              |

Token carpentry (blockade/flotilla/SMH):
- Some pieces carry **one to three quarters** of a bonus symbol; the quarters move, rotate and flip with the piece.
- A later piece covering a bonus quarter **overwrites** it, even if that piece carries no quarter — the completed symbol must survive in the final arrangement.
- On hole completion, **four matching quarters must occupy a 2x2 square** forming a circle, diamond, plus or X. If several complete symbols exist, only **one** is awarded; a symbol matching the currently-requested maneuver is preferred, otherwise one is picked at random.

| Finish quality                     | Token credit |
| ---------------------------------- | ------------ |
| A Masterpiece!                     | double       |
| Craftsmanship! / A Fair Job        | normal       |
| Sloppy Work / A Pig's Breakfast!   | none         |

- On a **sloop**, **2 awarded token units** fill the carpentry maneuver bar.

### Data model implications
- `CarpBoard { holes: Hole[4] }` in a 2x2 layout; `Hole { originalCells: Set<Point>, coveredCells: Set<Point>, nominalSizeN, piecesUsed, neglectCounter, expansions: 0..3, masterpiecePossible: bool, piecesPlaced: Stack<PlacedPiece> }`.
- `Pentomino { id, cells: Point[5], rotation, flipped, grainHorizontal: bool }` — grain is derived: `grainPreserved = (rotation % 180 == 0)` for the fixed-grain pieces (I, L, N, Y), and always true for the fully symmetric set under flip-equivalent transforms.
- Piece draw is a **weighted random** over the table above (95 total weight); bucket suppressed if one is already in the toolbox or the difficulty is too low.
- Placement validator: `coversAtLeastOneNewSquare && (touchesHoleEdge || touchesExistingWork)`.
- Putty needs a flood-fill of the orthogonally-connected empty region under the click, rejected if size > 5.
- Neglect is a per-hole counter decremented by *every placement elsewhere*; expiry branches on `piecesPlaced.isEmpty()`.
- Board scroll rule: after any completion, check whether two completed holes share a row or a column of the 2x2; only then replace.
- Consecutive-MP counter is board-level state, reset by any non-Masterpiece completion, by any neglect damage anywhere, at 18, and on a new round.

### MVP relevance
Core. Carpentry is the repair half of the ship-state loop (damage → bilge inflow rate), and it is the best-documented puzzle after Sailing. It is, however, the most implementation-heavy of the core four (pentomino geometry, grain, neglect, putty flood fill).

---

## Patching

### Source
- https://yppedia.puzzlepirates.com/Patching

### What it is
A pipe-connection / tile-rotation puzzle against a wind timer. Repairs the same damage Carpentry does, occupies the same station type. Added release 2012-07-25.

### Mechanics
- **Board**: a rectangular grid of square tiles representing torn sail cloth. **Grid size varies by difficulty level — 5x4, 6x5 or 7x6** (see table).
- **Goal**: manipulate the tear tiles so that a continuous stitch path connects the **spool** piece to the **tie-off** piece, then activate the spool.
- **Piece types**:
  - **Spool** — where the stitch starts. Clicking it activates the stitch and completes the board.
  - **Tie-off** — the required terminus. 1, 2 or 3 tie-offs per board depending on level.
  - **Tears** — the movable path tiles: straight, curved, 3-way, 4-way.
  - **Grommets** — metal pieces that can accept a tear on **one side**. A tear terminating at a grommet does **not** tear the cloth. They are the key scoring extender: they let more pieces be safely connected to the spool.
  - **Blockers** — immovable; must be stitched around. Appear at 7+ stars.
- **Connection rule**: once tears are connected to the spool, **every exposed side of every connected tear must extend all the way to either the tie-off or a grommet**, otherwise activating the spool tears the cloth (a hole).
- **Controls (mouse)**: click-and-drag two pieces to **swap** their positions; mouse wheel to **rotate** a piece; click the spool to activate.
- **Controls (keyboard)**: `W A S D` move cursor; `Q`/`E` rotate the hovered piece; `Space` select pieces to swap; `Enter` activate the spool.
- **Wind timer**: the meter at the bottom of the board counts down to a **gust of wind**. When the wind gusts, **the spool is activated automatically**, and any stitch not properly terminated at a tie-off or grommet **tears a hole in the sail**. This is the fail state and the source of the puzzle's speed pressure.
- **Unravelling**: after a wind gust, any **grommets that were connected to the spool unravel and become regular stitch pieces**. This buys extra time to plan the next connection.
- **Scoring**: based on the **percentage of the board connected** when the spool activates, and on avoiding gust damage. The shortest path is *not* the best-scoring one — use grommets and extra loops to stitch as much of the board as possible before the gust.
- **Board cycle**: a new board begins once the spool has been activated (deliberately or by a gust).
- **Token patching** (blockade etc.): while patching well, small maneuver tokens appear **at the corners of pieces**. If **all four pieces surrounding a token are connected to the spool**, the token activates and turns **green**. Completing a board with **only one type** of maneuver token activated earns ship progress toward that maneuver. If **multiple types** are activated, they all turn **red** and **no credit** is gained. The patching progress bar in the maneuver meter is shown in **red** and rendered wider than the others when viewed from inside the Patching puzzle.

### Numbers and tables

Completion messages by percentage of board connected:

| Message             | % of board required |
| ------------------- | -------------------- |
| Flawless Masterpiece| = 100               |
| Master Patcher      | 80 < % < 100        |
| Sew Good            | 50 < % ≤ 80         |
| A fine patch!       | 20 < % ≤ 50         |
| Patchy Work         | ≤ 20                |

Difficulty levels:

| Level | Time per board (sec) | Size | Features introduced          |
| ----- | -------------------- | ---- | ---------------------------- |
| 1     | —                    | 5x4  | Straight and curved tears    |
| 2     | 75                   | 5x4  | Wind                         |
| 3     | 70                   | 5x4  | 3-way tears and grommets     |
| 4     | 65                   | 6x5  | 2 tie-offs per board         |
| 5     | 60                   | 6x5  | —                            |
| 6     | 55                   | 7x6  | 4-way tears                  |
| 7     | 50                   | 7x6  | Blockers (0–3)               |
| 8     | 45                   | 7x6  | 3 tie-offs per board         |
| 9     | 45                   | 7x6  | Blockers (0–5)               |

No point-level scoring formula is published for Patching — only the percentage bands above.

### Data model implications
- `PatchBoard { w, h, tiles: Tile[][], spoolPos, tieOffs: Point[], windTimerMs }`.
- `Tile { kind: Straight|Curve|ThreeWay|FourWay|Grommet|Blocker|Spool|TieOff, rotation: 0..3 }` with `openSides: Set<Direction>` derived from kind+rotation.
- Connectivity is a graph traversal from the spool following matched open sides; a connected tear with an open side that terminates in nothing is a **fault**. `connectedPct = connectedTiles / movableTiles`.
- Two operations only: `swap(a, b)` (any two movable tiles) and `rotate(tile, dir)`. Blockers reject both.
- Wind gust = forced `activateSpool()`; on gust, convert every spool-connected grommet to a plain stitch tile and punch holes for each fault.
- Level table drives both `windTimerMs` and board generation parameters (grid size, allowed tile kinds, tie-off count, blocker count range).

### MVP relevance
Phase 2. Same ship effect as Carpentry, and the level table makes it cheap to generate — but the connectivity/rotation model is a separate engine from the pentomino one, so it duplicates effort without adding ship-state surface.

---

## Gunnery

### Source
- https://yppedia.puzzlepirates.com/Gunning
- https://yppedia.puzzlepirates.com/Gunning_scoring

### What it is
A real-time routing puzzle: steer moving pieces around a deck board into cannons in the correct order. Each correctly loaded cannon becomes **one gun token** for the navigator to fire in sea battle.

### Mechanics
- **Board**: a deck section containing **4 cannons**, a **wooden barrel** (piece source), **crates**, **gunwales**, and open deck. The barrel is **in the middle of the board by default**, but **in a sea battle the barrel moves as the navigator turns the ship**.
- **Pieces**: four types — **Powder, Wad, Shot, Bucket**. They are emitted from the barrel **in all four directions in random order** until there are **two of each type on the board**. When a piece is consumed, another of that type is emitted.
- **Piece movement (the core rule)**: pieces travel in a straight line until they strike a **fixed obstacle** (crate, gun, gunwale), then:
  1. **Turn right.**
  2. If turning right is impossible, **turn left**.
  3. If neither is possible, **reverse**.
  If a piece runs into **any other piece**, **both reverse direction**.
- **Arrows (the only player input)**: the player places directional arrows on the deck; a piece passing over an arrow adopts the arrow's direction. **A maximum of 3 arrows may exist at once** — placing a 4th removes the oldest. Loading a cannon requires an arrow directed into the **mouth of the barrel** (cannon mouth).
- **Load order**: cannons must be loaded **powder → wad → shot**, in that order.
- **Bucket**: cleans out a cannon **after it has been fired**, or after a piece was loaded in the wrong order.
- **Bad moves**: loading a piece out of order requires a bucket wash to fix and **slows the pieces down**. Dropping a piece over the side of the vessel also **slows pieces down** (but is otherwise scored as no effect).
- **Out of ammunition**: if the ship has no cannonballs left, the gunner stops receiving Shot pieces and gets the message "This ship has run out of [size] cannonballs!"
- **Difficulty / speed**: gunnery has **no difficulty meter and no progressive ramp** like the other duty puzzles. Doing things right raises difficulty *very slightly*; doing things wrong lowers it *very slightly*. Higher difficulty = **faster piece movement**. **Initial piece speed on entering the puzzle is set directly from the player's gunnery standing.** Speed changes within a session are **cumulative** and reset on re-entry. Since release 2008-12-16 there is also a **manual speed slider** below the board; the increase/decrease factors still apply on top of it.
- **Board abandonment**: leaving a board gives a fresh one. On a navy vessel this makes scoring simple. On player ships, "board sitting" (staying on a board after loading all 4 cannons) caps you at 4 loaded guns; the wiki notes you may sit on a fully-loaded board **without penalty**.
- **End condition**: continuous; a navy gunnery mission fires all guns once all four cannons are loaded.
- Gunnery has **no token/maneuver variant** — it is absent from the maneuver system entirely.

### Numbers and tables

Speed modifiers:

| Event                   | Score effect | Speed effect |
| ----------------------- | ------------ | ------------ |
| Gun loaded correctly    | plus         | speeds up    |
| Fired gun washed        | small plus   | speeds up    |
| Piece misloaded         | ?            | slows down   |
| Piece dropped overboard | no effect    | slows down   |
| Arrow placed            | no effect    | none         |
| Time elapsed            | minus        | none         |

Player-derived arbitrary scoring model (Gunning_scoring):
- Loading a cannon correctly ≈ **30 points**.
- **−1 point per second** of play while at least one cannon remains to load.
- Washing a **fired** (dirty) cannon ≈ **+3 points**. This bonus is **not** awarded for cleaning an *improperly loaded* cannon, only a fired one.
- **100% efficiency (a "Fine" rating)** = one cannon correctly loaded a little under **every 30 seconds** — roughly one per league point at top speed.
- **Incredible** ≈ **100 points**, i.e. **one cannon per 5 seconds** of play. (Varies by ocean; gunnery is highly competitive.)
- Score model stated by players as: *time spent on a board with fired guns, divided by the number of guns loaded*. Hence loading 4 guns in 40s scores the same as 2 guns in 20s or 3 in 30s.

Ship-effect: **1 loaded cannon = 1 gun token**. Each gun token fires one cannonball to port or starboard. Gun tokens **do not expire**. Cannons may be loaded outside of battle. All cannons have a **range of 3 tiles**. Gunnery station *placement* does not limit how many cannons can fire per side (a sloop has 2 guns per side / 4 total but may fire 4 shots from starboard in one turn).

### Data model implications
- `GunBoard { w, h, tiles: Deck|Crate|Gunwale, cannons: Cannon[4], barrelPos, pieces: Piece[], arrows: Deque<Arrow>(max 3) }`.
- `Piece { type: Powder|Wad|Shot|Bucket, pos, dir, speed }`. Movement is a fixed-timestep march; collision resolution is the strict right → left → reverse rule for fixed obstacles, and mutual-reverse for piece-piece.
- `Cannon { loadState: Empty|Powder|PowderWad|Loaded|Dirty }`. Feeding a piece that violates the order → `Dirty`-like fouled state requiring a Bucket.
- Piece spawner maintains an invariant of **2 of each type on the board**, emitting in a random one of four directions from `barrelPos`.
- `pieceSpeed = baseSpeedFromStanding(standing) * sliderFactor * (1 + cumulativeModifier)`; reset `cumulativeModifier` on puzzle re-entry.
- Barrel position must be settable by the ship-turn event during battle.
- Output: emit a `CannonLoaded` event → `ship.gunTokens += 1`.

### MVP relevance
Core (for sea battle) / Phase 2 (standalone). It is the only source of gun tokens, so any battle needs it — but as a real-time simulation with obstacle-bounce routing it is a different engine class from the turn-based grid puzzles, and its scoring model is the thinnest of the well-documented five.

---

## Duty Navigation

### Source
- https://yppedia.puzzlepirates.com/Navigation
- https://yppedia.puzzlepirates.com/Duty_nav_scoring
- https://yppedia.puzzlepirates.com/Duty_navigation_tutorial

### What it is
A polar/ring match puzzle. Duty navigation **multiplies the effectiveness of the ship's sailors**, allows memorisation ("memming") of ocean league points, and biases enemy spawns. (Distinct from *battle* navigation / "bnav", which is the sea-battle helm interface, not a duty puzzle.)

### Mechanics
- **Board**: a circular board divided into **8 even octants** (up, down, left, right, and the four diagonals), with **3 concentric rings** from centre outward. Each octant on each ring holds one star → **maximum capacity 24 stars**.
- **Stars**: **5 colours, each with its own distinct shape**: blue, red, orange, yellow, white. (Colour and shape are redundant encodings — good for accessibility.)
- **Spawning and gravity**: stars fall **from the outside toward the centre**. There is a **constant gravitational pull toward the centre for the whole puzzle**: a star with an empty cell below it (i.e. inward of it, in the same octant) falls inward. A falling star stops when its path is blocked.
- **Controls**: Left/Right arrow rotate the currently-selected ring counter-clockwise/clockwise (carrying its stars); Up/Down arrow move the selection to a higher (outer)/lower (inner) ring; Space drops the currently-falling star fast onto its target.
- **Line clears**: **3 or more** same-coloured stars in a row — either **radially (centre-out, across the 3 rings in one octant)** or **circumferentially (along one ring)** — disappear. These score only a little.
- **Constellations (the real goal)**: the board displays *markers* — coloured outlines matching the shapes/colours of specific stars. **All markers must be correctly filled at the same time** to complete the constellation, which then clears and scores heavily.
- **Precedence rule**: completing a constellation **always supersedes a standard 3-in-a-row clear**. If placing the last star both completes the constellation and would form a line of 3, the constellation wins. If the constellation is *not* otherwise complete, the 3-line clears normally.
- **Booch (fail state)**: dropping a star **on top of a star in the outermost ring**. Effect: **the ship turns around**, and everyone aboard is told the navigator booched. Score penalty.
- **Difficulty ramp**: the puzzle begins with a small constellation (1–4 stars) and scales up. The "stars" meter in the lower-left fills as constellations complete; the more filled, the bigger the constellation and the higher the ceiling score. **At the highest ratings some constellations are genuinely impossible** to solve logically.
- **Short-voyage penalty**: because the puzzle always restarts at an easy, low-scoring constellation, short journeys score poorly on ratings by construction.

### Numbers and tables

Player-derived arbitrary point model (Duty_nav_scoring; explicitly relative):

| Event                                      | Points |
| ------------------------------------------ | ------ |
| Star falling onto the board                | −1     |
| A certain amount of time passes            | −1     |
| Moving a ring                              |  0     |
| Clearing a row/column of 3 adjacent pieces | +6     |
| Clearing a row of 4–5 pieces               | +8 to +10 |
| Completing a constellation                 | increasing plus, scaling with constellation difficulty |
| Booching                                   | minus (plus ship turns around) |

- **Cascades are linear multipliers**: step 2 scores x2, step 3 scores x3, etc. Worked example: a three-step cascade each clearing a row of 3 = 6 + 12 + 18 = **36 points**.
- **Constellations do not cascade with each other** (constellation-in-cascade = no effect), but a **row-clearing cascade that ends in a completed constellation gives a large bonus**.
- Constellation difficulty is determined by: total number of stars in the constellation, the **colour balance** of the constellation, **proximity of the stars to each other**, **the colours of adjacent stars**, and **whether they form any adjacent rows of three of the same colour** (which is the case that forces careful ordering, since the line would clear prematurely).
- The bonus from harder constellations grows **faster than** the number of pieces normally required to clear them — so difficulty scaling directly raises the achievable rating.
- Board geometry constants: **3 rings x 8 octants = 24 cells; 5 star colours**.

### Data model implications
- `NavBoard { rings: 3, octants: 8, cells: Star?[3][8], constellation: Marker[] }` where ring 0 = innermost.
- `Marker { ring, octant, requiredColour }`. Completion test: every marker's cell holds a star of the required colour, evaluated **after** each settle and **before** line-clear detection (precedence rule).
- Gravity: for each octant, compact stars inward (toward ring 0). Rotation of ring *r* is a cyclic shift of `cells[r]`, then re-run gravity.
- Line detection must cover both axes: radial runs within an octant (max length 3) and circumferential runs along a ring (cyclic, so a run may wrap around octant 7 → 0 — **the wiki does not confirm whether wrap-around counts; flag as an open question**).
- Booch check: the incoming star's landing cell is already occupied at ring 2 (outermost).
- `constellationDifficulty` should be a generator parameter driving star count, colour spread and adjacency, with a scoring curve that grows superlinearly in star count.
- Output: `sailorMultiplier = f(navPerformance)` applied to the aggregate sailing/rigging output; plus a `spawnBias` term.

### MVP relevance
Phase 2. It has a clean, small, fully-specified geometry (24 cells) and would be cheap to build, but its ship effect is a multiplier on top of sailing rather than a primary driver, and the constellation *generator* (difficulty scaling, guaranteed-solvable boards) is genuinely hard to get right.

---

## Treasure Haul

### Source
- https://yppedia.puzzlepirates.com/Treasure_Haul

### What it is
A vertical-swap match-3, essentially bilging rotated 90°. It transfers PoE (and sometimes items) from sunken wreckage into the ship's booty chest. Added release 2007-05-24. Categorised on the wiki as both a duty puzzle and a piracy puzzle.

### Mechanics
- **Board**: a grid of **coins** (the wiki does not publish dimensions). Coins of different types are the match pieces.
- **Core difference from Bilging**: pieces can **only be swapped vertically**, not horizontally. Because that is the same axis pieces fall along, the puzzle plays quite differently despite the shared match-3 core.
- **Clearing**: patterns of **3 or more** of the same coin type. **Combos work exactly as in bilging** — clearing coins forms new lines of 3, 4, etc. which then clear themselves, repeating until no lines remain.
- **Availability**: Treasure Haul appears in **Atlantis, Haunted Seas, flotillas, sinking blockades, shipwreck expeditions and Vampirate lairs**, and behaves differently per environment.
  - In Atlantis / Haunted Seas / flotillas / sinking blockades: becomes available when the vessel has been **adjacent to or on top of sunken treasure for all four moves of a turn, including just before the first move**. **Hauling from directly on top of the wreck is more efficient than from an adjacent square.** Launch via the Ahoy! panel pop-up, the ship's-hold radial menu (available one turn earlier than the pop-up), or the booty chest (officers only).
  - Shipwreck expedition: a "Haul Treasure!" button appears in the Ahoy! tab at a league point; a sunken mast with a Treasure Haul station is added off the port bow.
  - Vampirate lair: available after each swordfight is won; started from a treasure-chest furniture item. Vampire-themed art.
- **Cross-duty contribution**: while hauling on a ship, **Treasure Haulers contribute a small amount to every duty**.
- **Gems** (special pieces):
  - **Red ruby** — clears all pieces in the **same row and column** (a "+" / cross pattern).
  - **Green emerald** (white **diamond** in Vampirate lairs) — clears all pieces **diagonally** from the gem (an "X" pattern).
  - **Gem effects chain**: placing another gem inside a gem's clearing path detonates it too.
- **Chests** (Atlantis, Haunted Seas, Vampirate lairs only): appear sporadically. **If a chest reaches the top line of the board it is added to the booty chest.** You raise it by clearing coins above it. **Coins cleared in either of the two columns above a chest do not respawn**, so the chest can get stuck behind a single remaining coin — a ruby saved on the top row is the standard rescue. Chests preferentially spawn where coins have been cleared, so clearing toward the middle of the board seeds new chests.
- **End condition**: time-limited session (Vampirate lairs explicitly score "chests cleared during the allocated time").

### Numbers and tables
- **No point table is published for Treasure Haul.** The Puzzle scoring hub explicitly says "Chart not yet constructed", and there is no `TH_scoring` page.
- Scoring, stated qualitatively:
  - **Vampirate lairs**: scored on the **number of chests cleared within the allocated time**.
  - **All other environments**: scored on the **rate and value of treasure hauled**. **Combos are far less important than in bilging** — clearing as many coins/chests as rapidly as possible beats spending 15 seconds building a large combo. (This is the one duty puzzle where speed beats efficiency.)
- Three in-game performance indicators, all diegetic: the **pile of gold behind the pirate figure grows**, the **pirate figure pulls merrily on the ropes**, and **coins fly up the screen**.
- **Payout**: in environments without chests, the haul is pure **PoE** into the ship's booty chest, divided if the ship ports. In environments with chests, the haul is **PoE plus sometimes items** (familiars, pets, clothing, furniture, trinkets). In Atlantis, a single chest can contain more PoE than all the regular coins hauled from a wreck.

### Data model implications
- Reuse the Bilging match-3 resolver with the swap axis flipped to vertical (`(x,y) <-> (x,y+1)`) — the same `matchDetect → clear → gravity → refill → repeat` loop.
- `Gem { kind: Ruby|Emerald }`; on detonation, compute the affected cell set (cross vs diagonals) and, before clearing, check that set for further gems to detonate recursively.
- `Chest { pos }` rises passively as coins under it clear; `if chest.y == 0 → ship.booty += rollChestContents(environment)`. The "cleared coins in the two columns above a chest do not respawn" rule requires a per-column refill suppression mask tied to each chest.
- Scoring should be **throughput-based**, not efficiency-based: `poePerSecond = f(coinsClearedRate, coinValue)` — a genuinely different scoring model from every other duty puzzle.
- Availability is a *ship-state gate*: `wreckAdjacencyHeldForFullTurn` plus an on-top-vs-adjacent efficiency multiplier.

### MVP relevance
Deep. It only exists in late-game content (Atlantis, blockades, flotillas, expeditions, Vampirate lairs), none of which an MVP needs, and its scoring model is undocumented. However, if Bilging is already built, the board engine is ~80% reusable, so it is cheap to add later.

---

## Maneuver tokens (blockade/flotilla/SMH layer)

### Source
- https://yppedia.puzzlepirates.com/Maneuver
- https://yppedia.puzzlepirates.com/Sea_battle

### What it is
The multi-ship-only layer that turns duty puzzle output into special navigator moves. Relevant here because it defines the *second* output channel every duty puzzle (except gunnery and navigation) must emit.

### Mechanics
- Available only on a **blockade, flotilla, or Sea Monster Hunt** board, and only to pirates whose experience is at least **Apprentice** and whose **performance is good** (bonus symbols simply do not spawn otherwise).
- Contributing puzzles: **Carpentry, Bilging, Sailing, Patching, Rigging**.
- The meter has **three vertical bars**: **yellow = sailing/rigging, red = carpentry/patching, blue = bilging**. The puzzler sees their own bar wide and the others narrow. **All three bars must reach the top** before the token is awarded. Sea battle page phrases it as: sailors+riggers contribute a third, carpenters+patchers a third, bilgers a third.
- Two tiers per maneuver: **silver** then **gold**. Gold does the same move with extra bonuses. After a silver is earned, further work upgrades it to gold. If the silver is spent before gold completes, the accumulated work goes toward another silver.
- The navigator can click a token on the helm to **request** that specific maneuver; the request is shown to all puzzlers in their maneuver indicator.
- Duty reports show one small yellow symbol per symbol completed by that pirate at that station in the last segment.

### Numbers and tables

Maneuvers:

| Shape   | Tier   | Effect                                                                                                     | Notes                                                              |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Circle  | Silver | **Chain Shot** — damages rigging, destroying movement tokens on the ship hit                                | Larger cannons cause greater token loss                            |
| Circle  | Gold   | **Skull Shot** — same token removal plus extra damage                                                       |                                                                    |
| Diamond | Silver | **In-place Turn** — turn to broadsides without moving a space                                                | Direction shown once placed; navigator can click to flip it        |
| Diamond | Gold   | **In-place Turn with Tidal Wave** — also floods the bilge of any ship in the way                            | **Bilge dealt is 50% regardless of ship size**                     |
| Plus    | Silver | **Double Forward Move** — one token moves forward two spaces in the time of one                             |                                                                    |
| Plus    | Gold   | **Ramming Speed** — double move, and rams as if the ship were a larger vessel                               |                                                                    |
| Cross   | Silver | **Flotsam** — drops a cluster behind you for a few turns; a ship sailing into it loses the rest of its moves that turn | Unaffected by, and not moved by, wind                              |
| Cross   | Gold   | **Burning Flotsam** — as Flotsam, plus damage to ship and sailors                                           |                                                                    |
| Flower  | Silver | **Banish Zombies** — banishes some boarding zombies                                                          | Cursed Isles only; no visual effect                                |
| Flower  | Gold   | **Control Thralls** — transfers control of some boarding zombies to a pirate                                |                                                                    |

Tokens required per station (silver / gold). Only Sloop and Cutter are fully documented; the rest are unknown on the wiki except the Flower column:

| Ship            | Station   | Circle | Diamond | Plus  | X     | Flower |
| --------------- | --------- | ------ | ------- | ----- | ----- | ------ |
| Sloop           | Bilge     | 3/6    | 3/6     | 3/6   | 4/8   | 1/2    |
| Sloop           | Carpentry | 2/4    | 2/4     | 1/2   | 1/2   | 1/2    |
| Sloop           | Sailing   | 2/4    | 3/6     | 3/6   | 1/2   | 1/2    |
| Cutter          | Bilge     | 5/10   | 5/10    | 5/10  | 6/12  | 2/4    |
| Cutter          | Carpentry | 3/6    | 3/6     | 2/4   | 1/2   | 2/4    |
| Cutter          | Sailing   | 3/6    | 5/10    | 5/10  | 2/4   | 2/4    |
| Dhow            | all three | ?/?    | ?/?     | ?/?   | ?/?   | 2/4    |
| Longship        | all three | ?/?    | ?/?     | ?/?   | ?/?   | 2/4    |
| Merchant Brig   | all three | ?/?    | ?/?     | ?/?   | ?/?   | 4/8    |
| Merchant Galleon| all three | ?/?    | ?/?     | ?/?   | ?/?   | 5/10   |

Per-puzzle token production rules (repeated here for one-stop reference):

| Puzzle    | How a symbol is earned                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| Bilging   | Matching top and bottom halves of one shape become adjacent → both halves removed, meter progresses. Sloop: 3 pieces fill the meter |
| Sailing   | Two matching bonus shapes (any colours) included in the same platform or line clear. Bonus progress if that clear is chain step 3+ |
| Rigging   | Two-stage: a clear including a bonus shape **activates the next pulley** for that shape; then a pull with that maneuver on the activated pulley scores the token. Wrong pull → maneuver passes to the next pulley |
| Carpentry | Four matching quarters occupying a 2x2 square in the **final** arrangement of a completed hole. Masterpiece = double credit; Craftsmanship/Fair Job = normal; Sloppy/Pig's Breakfast = nothing. Sloop: 2 units fill the meter |
| Patching  | All four pieces surrounding a corner token connected to the spool → token turns green. Board completed with **exactly one type** activated = credit; **multiple types** = all red, no credit |

### Data model implications
- `ManeuverMeter { shape, sailBar: 0..N, carpBar: 0..N, bilgeBar: 0..N, tier: None|Silver|Gold }` per shape, per ship; awarded when all three bars top out.
- Requirement lookup is a 3-D table `(shipClass, station, shape) → (silverCost, goldCost)`.
- Every duty puzzle needs a `emitManeuverSymbol(shape)` hook fired from its resolver, gated on `performanceIndicator >= threshold && experience >= Apprentice`.
- `requestedManeuver` is ship-level state pushed down into each puzzle's HUD and used as the tiebreak when a carpentry hole contains several complete symbols.

### MVP relevance
Deep. Blockades/flotillas are a whole content tier beyond a single-player MVP. But design the puzzle resolvers to emit symbol events from day one, or retrofitting the token layer means reopening every puzzle.

---

## Gaps and open questions

Things a developer will need that the wiki does **not** publish:

1. **Bilge board dimensions.** Never stated. Only the invariants "≥3 rows of water at the bottom" and "top 3 rows always dry" are documented. Same for **Treasure Haul** board dimensions.
2. **Rigging hex board dimensions** and the exact geometry of the 6 pulleys relative to the grid. Also the identity of the 8 normal piece types, and which two are late-unlock.
3. **Rigging has no scoring page at all** — no point values, no efficiency baseline, no combo table.
4. **Treasure Haul has no scoring page** — the Puzzle scoring hub says "Chart not yet constructed".
5. **Crab value in bilging** — confirmed to depend on water height, exact formula unknown.
6. **Patching point values** — only the five percentage bands are published; no per-piece scoring.
7. **Carpentry**: exact consecutive-Masterpiece bonus (the two source pages disagree: `k − 1` vs. a flat `+1` multiplier step), effect of a piece falling out, and effect of a hole expanding are all listed as unknowns on the wiki. Also the *distribution* of hole sizes per difficulty is not published (only that they are "randomly sized" and that a size-6 hole has 30 squares).
8. **Duty navigation**: whether a circumferential run of 3 wraps around octant 7 → 0 is not stated. Nor is the constellation generator's difficulty curve beyond "1–4 stars early".
9. **Gunnery**: the exact deck layouts (crate/cannon/gunwale arrangements) and how many distinct boards exist are not published. Nor is the numeric mapping from standing to initial piece speed.
10. **Star-level → difficulty parameter mapping** is only published for Patching (the level table) and partially for Bilging (critter unlock levels). For Sailing, Carpentry, Rigging and Navigation the ramp is described only qualitatively.
11. **Maneuver token costs** are only published for Sloop and Cutter (plus the Flower column for four more hulls).
12. **Numeric ship-effect coupling** — how a given indicator value converts to bilge pumped per second, hull points repaired per second, or ship speed — is nowhere on the wiki. Only the directional relationships are documented. This will have to be invented and tuned.
