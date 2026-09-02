# Known issues

Non-blocking findings, newest first. Blocking findings never land here — they go back to the
analysis stage. Each entry says why it was judged not worth stopping for, and when it will start to
matter.

## 2026-09-02 — independent review of slice 2c (OPP-14), PR 6

The 4-lens review of PR 6. **One finding blocks and is not here** — the v3 to v4 migration never
adds `bilging.tokenSpawnPerMille` to the persisted balance, so the spawn gate compares against
`undefined` and every refilled colour cell takes a shape. It went back to analysis. Everything below
is non-blocking. The slice is otherwise strong: the new tests are real behaviour tests rather than
blessed snapshots, the committed v3 save is a genuine base-code artifact, and both verification
claims in the development entry reproduce exactly.

### The mutation suite found seven survivors, and the three most interesting are the slice's own new rules
39 semantic mutants were run against a clean export of the branch; 32 were caught. The survivors, in
descending order of how much they change the game:

- **The adjacency rule accepts diagonals with the suite green.** Adding a diagonal partner check to
  `partnerOf` (`tokens.ts:63-73`) passes 149/149 while moving the pair yield up 29 per cent over
  5 seeds x 300 clearing swaps. Decision 67 says *orthogonally* adjacent; `tokens.test.ts:111-125`
  tests wrong-symbol and wrong-half but never wrong-geometry. One test placing two halves diagonally
  and asserting no pair closes it.
- **Pairing before spawning survives** (`resolve.ts:72-73`), and costs 27 per cent of the yield: a
  pair spawned in a settle would wait for the next move. Decision 67's "resolved once per settle" is
  a real ordering constraint that nothing pins.
- **The published gold cap of 6 is asserted nowhere.** `MANEUVER_BAR_GOLD` 6 to 7 survives, because
  `tokens.test.ts:180,188` uses the constant on both sides of the assertion. Decisions 69 and 70
  deliberately keep 6 out of `balance.json` as a published value, so the golden's balance pin does
  not cover it either. A literal `assert.equal(MANEUVER_BAR_GOLD, 6)` restores the pin.
- The row-wrap guard on horizontal pairing (`tokens.ts:68`) can be deleted and the last column
  starts pairing with the next row's first, suite green.
- The spawn comparison `>=` to `>` survives, spawning at 121 per mille instead of 120.
- The ascending sort in `clearShapePairs` (`tokens.ts:51`) can be dropped, suite green, though the
  sort is live rather than dead.
- The migrated shape array's length can be hardcoded to 144, because the only v3 fixture is 12x12.

### Three decisions are pinned only by a fixture this slice re-blessed
`SYMBOL_COUNT` 4 to 5 (decision 62's eight-shape alphabet), the draw-to-shape mapping
(`shapeDrawnFrom`, which `tokens.test.ts:147` cannot catch because it draws 0, where both mappings
agree), and spawning on every colour cell rather than only refilled ones (decision 65) are each
caught by `tests/harness/replay.test.ts:136` and by nothing else. Change-detection fixtures are
legitimate, but a future re-bless erases all three defences silently.

### The `_sources` yield for `tokenSpawnPerMille` does not reproduce, and errs generous
`balance.json` states about 72 tokens and 2.9 completed pairs per 100 clearing swaps, filling a
sloop's 3-pair bar in about 100 swaps. Two independent re-measurements at HEAD disagree: 4.5 pairs
per 100 over the development entry's own trajectory, and 5.3 per 100 on a different set of seeds,
with the 3-pair bar filling at a mean of 57 to 71 swaps rather than 100. The recorded figure is also
inconsistent with this slice's own other measurement — gold at 66 to 166 swaps implies far more than
2.9 pairs per 100, and both re-measurements land where the gold figure predicts. **The constant is
honest**: the spawn itself measures 122 per mille against a stated 120, so this is not a repeat of
`crabSpawnPerMille`. Only the prose describing the yield is wrong. It matters because that number is
the argument for choosing 120 over 60 or 180.

### The performance gate is open on at least 91 per cent of moves under every play style, not just good play
The development entry records 1991 of 2000 and attributes the nine closures to the opening swaps of
a session, which reads as though optimal play is the reason. Re-measured under degraded play, 5
seeds x 400 moves: taking a clearing swap every third move leaves it open on 1910 of 2000, every
tenth move 1891, and purely random legal swaps 1821 — random flailing still reaches `incredible` on
710 of 2000 moves. The cause is not in the token layer: `frame.ts:53` measures efficiency against
`POINTS_PER_MOVE_AT_FULL_EFFICIENCY` of 3, one bare 3-run per move, while real 7-star play with
cascades sits at 2148 to 2428 per mille and the `good` band starts at 1100. The gate asks for 110
per cent efficiency on a scale where random play scores 130 to 160 per cent. This sharpens the entry
already here rather than replacing it; the follow-up should implement the wiki's second clause — a
rate graded by rating — rather than raise the threshold, since re-anchoring the slice-2 constant has
consumers far beyond this layer.

### A deliberately completed pair is not collected on the move that completes it
`clearShapePairs` runs only inside `settleStep` (`resolve.ts:73`), and `resolveBoard` returns early
when nothing cleared, so a swap that forms a pair without clearing a run resolves nothing. The pair
is not lost — the next settle anywhere on the board scans every cell and takes it — but the feedback
is deferred and invisible, and pairs are in practice incidental rather than played for. This matches
decision 67 as worded, which is why it does not block; what no decision records is that the wiki's
"when the halves are adjacent, both shapes are removed" describes a board state, not the aftermath
of an unrelated clear.

### Two rules invented in code rather than recorded
The choice among the eight halves is uniform (`tokens.ts:59-61`), which the wiki does not publish
and no decision or `_sources` entry states; and when a half has both a rightward and a downward
partner, rightward silently wins (`tokens.ts:63-72`) — decision 67 fixes the scan order but not the
tiebreak, and the two choices produce different boards.

### Smaller things
- `shapedPuzzleOf` (`save.ts:42-50`) casts `puzzle.board` and `board.cells` without guarding, so a
  malformed v3 save throws a raw `TypeError` rather than the controlled `Error` the neighbouring
  `schemaVersionOf` throws. Its name also understates it — it injects `maneuverBar` too.
- `spawnTokens` and `spawnCritters` are the same traversal written twice — identical signature,
  identical `for (const index of refilled)` loop, differing only in the guard and the destination
  array. The recurring duplication pattern earlier reviews flagged, with a fresh instance.
- `draw` names two different things three lines apart in `spawnTokens`, and is called twice in one
  loop body with unrelated meanings, the second call conditional — which is exactly why stream
  consumption is outcome-dependent. Naming the samples fixes it without a comment.
- `pairsOf` (`move.ts:52`) recovers a pair count by dividing a cell count; `clearShapePairs` already
  knows the number. `pairedCells` is only ever consumed as a length.
- `tests/sim/migration.test.ts:120-128` re-introduces `SCHEMA_VERSION - 1` inside a test named "a
  schema version three save", in the same commit that moved the v2 test off that idiom to a literal
  for exactly this reason; at the next bump it silently becomes a v4 test under a v3 name.
- `board.test.ts:31` adds a `bareBoard` helper and the five new shape tests hand-write board literals
  instead of using it; `tokens.test.ts:115-118` uses `?? 0` index fallbacks that would silently write
  to cell 0 if the arithmetic were wrong.
- The golden re-bless is classified by count ("4 ops on the golden") where the `pp-golden-state`
  skill asks for a cause per path. The four ops are individually obvious and rule 3 is satisfied by
  the committed v3 save, but the `/balance` op is precisely the one the golden exists to make loud.

### Decision numbers now collide across concurrent slices
Slice 3 recorded decisions 60 to 69 on `agent/develop` while slice 2c independently recorded 61 to
70 on this branch, and the slice 2b test entry added its own 61 and 62. The numbering is per-branch
in a repo where branches run concurrently, so the merged document will carry three different
decision 61s. Nothing is wrong inside any single entry; the human should decide whether numbers are
renumbered on merge or scoped per slice.

## 2026-09-02 — development of slice 2c (OPP-14), the token layer

What the three units of slice 2c left behind. None of it stops the slice: `npm run check` is green
at 149 tests, the containment boundary is unmoved at 99987 / 99988, the opening board's `cells` are
byte-identical to the pre-slice ones, and `bilge.refill` draws the same 12 numbers from the same
cursor over the committed replay as it did before the token stream existed.

### Left by the shape layer

- **`board.ts` has outgrown the repo's ~100-line convention and now carries two unrelated
  encodings.** `packages/sim/src/puzzle/board.ts:106` — the file is 106 lines and holds both the
  cell and critter sentinels and the `symbol * 2 + half` shape encoding (`board.ts:12-14` and
  `board.ts:46-60`), which nothing outside `tokens.ts` reads. Not worth splitting while the encoding
  is six lines and one constant pair; it starts to matter when a renderer needs to name symbols,
  because the split then has to happen with a consumer already depending on the old path.
- **`MANEUVER_BAR_SILVER` is exported and never read.** `packages/sim/src/puzzle/tokens.ts:18`,
  re-exported at `packages/sim/src/index.ts:128`. Only `MANEUVER_BAR_GOLD` has a consumer
  (`packages/sim/src/puzzle/move.ts:31`), because nothing spends the meter yet — what a maneuver
  does to the ship is scoped out of this slice. Harmless as a published constant, but it is a public
  export that no test can fail on, so it will drift silently if the wiki threshold it names moves.
- **The meter saturates and never drains.** `packages/sim/src/puzzle/move.ts:31` clamps at
  `MANEUVER_BAR_GOLD` and nothing subtracts. Under perfect play — always take the first clearing
  swap — the bar reaches gold after 66 / 74 / 77 / 127 / 166 swaps on seeds 1 to 5 and stays there
  for the rest of the session, so every pair after the first handful is discarded. Correct for a
  slice that only fills the bar; it matters the moment a consumer wants to know how many pairs a
  player actually made.

### Left by the token layer

- **The performance gate is open on 99.55% of moves, so it throttles almost nothing.**
  `packages/sim/src/puzzle/tokens.ts:34` and `tokens.ts:54-56` refuse to spawn below a `good` duty
  rating. Measured over 5 seeds x 400 clearing swaps: 1991 of 2000 moves passed the gate, and the
  nine that did not were the first one to three swaps of each session, while `dutyOutputPerMille`
  was still climbing out of `booched`. The wiki sentence the gate paraphrases reads as a standing
  constraint on sloppy play; at the shipped bands it is an opening delay. The density throttle that
  actually does the work is `bilging.tokenSpawnPerMille`, and `balance.json:17` already says so —
  but the gate is the half a reader will believe, so this wants either a note or bands that bite.
- **The slice-2b crab-overwrite bug is still present and untouched.**
  `packages/sim/src/puzzle/resolve.ts:65-71` still captures `refilled` before `climbCrabs` runs and
  hands the stale index list to `spawnCritters`, so a crab that climbs into a cell refilled in the
  same step is replaced by the critter spawned on that index. Slice 2c neither fixed nor worsened
  it. The new consumer of the same list, `spawnTokens` at `resolve.ts:72`, is accidentally immune:
  `tokens.ts:36` skips any index whose cell is not a colour, so it can never write over a climbed
  crab. That asymmetry between the two consumers is the clearest statement of the fix
  `spawnCritters` needs.

### Left by the schema bump

- **The manufactured-save migration tests cannot exercise the new migration.**
  `tests/sim/migration.test.ts:31-35` builds a "previous schema" save by relabelling a *current*
  sim's state, and that sim has never started a puzzle, so its `puzzle` is `null` and the 3 to 4
  migration takes its pass-through branch. The three tests that use it — `migration.test.ts:38`,
  `:47` and `:124` — are therefore true but vacuous with respect to the board and meter fields the
  migration exists to add; the committed `packages/fixtures/saves/bilge-session-v3.json` is what
  covers those. This is exactly the circularity the slice 2b review predicted, and it will mislead
  the first person who bumps the schema again without also committing a fixture.
- **Two skills quote hashes and a schema version that no longer reproduce.**
  `.claude/skills/pp-golden-state/SKILL.md:95` still shows the golden blessing `3a34e82ce2c7cb80`,
  which was already wrong before this slice — slice 2b re-blessed it to `8757ccc5d6f518e4`, and it
  is now `9a3fbfb43b9ba184` — and `.claude/skills/pp-scenario-author/SKILL.md:74` and `:199-200`
  still show `schemaVersion` 3 and the pre-slice-2b opening hash. Only the pointer table in
  `.claude/skills/pp-sim-harness/SKILL.md:90` was corrected here, because the rest are transcripts
  labelled "copied from an actual run": hand-editing them would destroy the one property that makes
  them worth trusting. They want re-running against the harness, not patching.
- **The re-blessed opening fixture is now half constant.**
  `packages/fixtures/scenarios/bilge-opening.json:155` — the file grew from 157 to 303 lines because
  the recipe pins `/puzzle/board` whole and the board's new `shapes` array is 144 copies of `-1` at
  tick 0, which it will stay for as long as tokens only appear after a clear. Not worth deviating
  from the recipe over, but it doubles the review surface of every future re-bless of that file.

## 2026-09-02 — independent review of slice 2b (OPP-13), PR 4

The 4-lens review of PR 4. Nothing here blocked the slice: `npm run check` is green at 130 tests, the
containment suite is 6/6, the opening board is byte-identical to the pre-slice one, and the
interpretive core of the slice — decision 47 and the 27 / 36 / 48 crab anchor — was re-derived from
`docs/wiki-map/01-duty-puzzles.md` independently of this repo's constants and holds. The two items
below are the ones worth taking first in the follow-up.

### The crab is the weak spot, in two independent ways

- **A climbing crab can be silently overwritten by a critter spawned in the same step.**
  `packages/sim/src/puzzle/resolve.ts:61-67` captures `refilled` before `climbCrabs` runs, then hands
  that stale index list to `spawnCritters`, which writes unconditionally. If a crab climbs into a
  cell refilled this step and lands still at or below the water line, it is replaced by the spawned
  critter: the crab is destroyed, pays no bonus, and never reaches the water line, contradicting
  decision 47. Two lenses reproduced it independently on a 12x12 board with the column segment above
  the crab cleared, water line row 3 and a puffer-band draw: `cells[36]` ends as `-3` with no crab
  left and `crabCells` empty. Reachability is low — it needs the whole segment above the crab cleared
  in one step plus a sub-50-per-mille draw on that exact index — which is why it is not blocking. The
  fix is one line: recompute or filter `refilled` after `climbCrabs`, or spawn before the climb.

- **`crabSpawnPerMille: 15` does not produce anything close to 15 per mille.** `critters.ts:41` gates
  the crab band on `belowWaterLine`, but `applyGravity` puts every vacancy at the top of its column
  segment, so refills land in the dry rows almost always. A crab-band draw over a dry cell yields no
  critter at all rather than falling through, so the rate is silently lost. Measured twice: one lens
  saw 1 crab in 3022 refill draws across 5 seeds; the review's own run saw **0 crabs across 5 seeds x
  400 swaps at star level 7 with the board fully flooded** — the most favourable condition there is,
  water line row 3 — while puffers and jellies spawned freely on every seed. The crab mechanic is
  effectively absent from normal play at the shipped constants. This is precisely the property
  decision 53 designed the band mapping to protect: "the file would no longer state the rates it
  produces". The water-line gate reintroduces it for the crab alone. Not blocking because the code
  does what the analysis document says and the crab rules are covered by unit tests, but this is the
  single most important thing to settle in the follow-up — either draw crab spawns only among
  below-water refills, or restate the rate as the conditional one it actually is.

### Two mutants survived the suite

Both were proved to be real behaviour changes, not equivalent mutants, by probing baseline against
mutated code rather than by trusting that no test failed.

- **Chain scoring is unpinned, so decision 59 is untested.** Collapsing `ResolveStep.kind` to always
  `combo` (`packages/sim/src/puzzle/resolve.ts:51`) leaves 130/130 green while changing a 4-wide
  cascade's chain step from 4 points to 5. The chain branch is reached and diverging cascades do
  occur, but no test asserts a cascade's number: the suite's precise cascade assertions are all
  single 3-runs, where the chain and combo scorers coincidentally agree. Wants one hand-derived test
  in `move.test.ts` asserting a second `bilge.cleared` event's points on a cascade of a 4-run.
  Related: renaming `chain` to `poke` is killed by exactly one test — the re-blessed replay fixture —
  so chain-step scoring is the one behaviour in this slice guarded by change detection and nothing
  hand-derived.

- **The water-line boundary of the fall rate is untested.** Weakening `fallRateOf`'s
  `row >= waterLineRow` to `>` (`packages/sim/src/puzzle/resolve.ts:78`) leaves 130/130 green while
  changing `settleTicks` from 6 to 3 for a fall landing exactly on the water-line row — the one cell
  the rule is about. `move.test.ts:146-150` samples four points, none of them the boundary. One line
  using the existing helper closes it.

### Smaller things

- **`settleTicks` reports 0 for the largest clears.** `gravity.ts:37-42` records a fall only for a
  surviving cell that moved, so pieces refilled from off-board are never counted. On a 12x12 board at
  water line 6, a bottom-row 3-run reports 6 ticks while a **full 12-cell column clear reports 0** —
  the metric inverts exactly where a renderer would most want it. Harmless today (it touches neither
  score nor state and has no consumer), but wrong as a settle-time estimate before slice 5 leans on
  it. Relatedly, `resolve.ts:64` clears freed crabs without a further `applyGravity`, so pieces above
  a freed crab do not fall; the slot is refilled in place.
- **The "a crab only spawns at or below the water line" rule has no row in the decision table.** It is
  pinned by `critters.test.ts:190` and its consequence is described above, but the table that carries
  the rationale for every other critter rule skips it. It is a consequence of decision 47 — a crab
  spawning dry would clear instantly for a free bonus — so it wants one row.
- **`tests/puzzle/scoring.test.ts:62` overstates itself and its loop is inert.** Named "scores
  strictly lower at a low star level" but asserting `<=`, which it must, since
  `MINIMUM_COMBO_MULTIPLIER` floors single lines at their published 3 / 5 / 7. Under a mutation that
  removes star scaling entirely the loop still passes on all 15 rows; only the three literals below it
  fail. Tighten to `<` for the multi-line rows, or drop the loop and keep the literals.
- **`sim.dispatch` has no event budget and is not atomic across the command array.** Already recorded
  by the development stage; the review confirms it is **pre-existing** — `methods/sim.ts:30-35` and
  `limits.ts` are byte-identical in `agent/develop` — and bounded: 100000 accepted swaps in one
  dispatch cost 2578 ms and a 23.8 MB response, with no hang and no crash. No input could be
  constructed that makes it throw mid-array, so the partial-application escape stays theoretical.
- **`balance.json` is type-validated but not range-validated.** `packages/harness/src/balance.ts:55-70`
  checks `Number.isSafeInteger` with no bounds, and the nine new constants come through the same path.
  A schema-valid file with `boardWidth` 100000 loads, then throws `RangeError` on `puzzle.start`.
  Non-blocking: the file is repo-controlled, never request input, loaded at module import so it fails
  closed at startup, and the throw is caught and returned as `internal-error`.
- **Duplication worth one helper each.** `scoring.ts:63-67` and `bilging.ts:20-25` are the same
  clamp-and-index idiom over two star-level tables; `critters.ts:61-68` and `critters.ts:80-86` are
  both "scan every cell, collect matching indices". Neither is worth a refactor on its own.
- **`gravity.ts:19-43` is the one genuinely hard-to-read spot in the diff.** `collapseColumn` loops to
  `y <= board.height` and uses the out-of-range iteration as a sentinel to flush the last segment, and
  `compactSegment` indexes `survivors[y - top - vacated]` with three interacting offsets and no named
  intermediate. Behaviour is correct and the crab anchoring it implements is tested; under the
  no-comments convention the fix is structural naming, not a comment.

## 2026-09-02 — development of slice 2b (OPP-13), critters and star levels

What slice 2b left behind. None of it stops the slice: the three critters behave as the wiki
describes, the published crab anchor is reproduced, and `npm run check` is green at 130 tests.

### Carried in from slice 2 and still open

- **`stepPointsOf` still runs twice per resolve step** (`packages/sim/src/puzzle/move.ts`) — once in
  the reduction that totals the move and once again when the step's event is built. Pure and cheap;
  it survived the restructuring into `move.ts` unchanged, so it is now an oversight twice over.
- **`resolveBoard` still stops silently at its 64-step cap.** Critters do not make a 64-step cascade
  reachable on a 12x12 board, but a crab climbing one row per step means a long chain now moves the
  board in a second way, so the cap guards slightly more than it did.
- **A cursor is still registered by opening a stream, not by drawing from it.** `bilge.critters`
  inherits this from `bilge.refill`: an accepted swap or poke that clears nothing opens both cursors,
  draws from neither, and still changes the state hash. Deterministic and harmless, but there are now
  two streams for which "the hash changed" does not imply "something was drawn".

### Left by the atomicity fix

- **`sim.dispatch` is not atomic across a command array.** `parseCommand` runs over the whole array
  first, so a parse failure is safe, but if `sim.dispatch` itself throws on command N then commands
  0 to N-1 have already been applied and the caller is told the call failed. This is the same defect
  class as the `sim.step` escape that this slice fixed, in a method the review did not measure. It is
  the obvious next one to close.
- **Every `sim.step` and `sim.runUntil` now takes a snapshot, including the calls that succeed.** For
  today's `WorldState` that is a negligible JSON round trip against the per-tick work, but it is a
  new fixed cost on the hot path and it scales with the state, not with the number of ticks.
- **The event-budget boundary is balance-dependent.** `tests/harness/containment.test.ts` pins it at
  99987 / 99988, down from the 99992 / 99993 the slice 2 test stage measured, because
  `maxStarLevel` 7 adds five more `puzzle.levelChanged` events to a long step. The constant is
  correct today and will move again with any tuning that changes the per-tick event rate.
- **`packages/harness/src/limits.ts` is still not exported from the harness index**, so tests
  hardcode `100000` and friends as literals rather than importing the limit they mean.

### Left by the critters

- **Nothing consumes `settleTicks` yet.** It is a per-step maximum — the slowest single fall — which
  is the right shape for "how long would this step have taken" and the wrong shape for animating each
  piece individually. If slice 5 wants per-cell timing it will need the falls themselves, which
  `applyGravity` already returns and `resolveBoard` currently discards.
- **Critter density above the water line is lower than the raw rates suggest.** Each spawn band maps
  to exactly one critter, so a draw in the crab band that lands in a dry cell yields no critter at
  all rather than falling through to a puffer. That is deliberate — it keeps `balance.json` honest
  about the rates it states — but it means the effective critter rate is not the sum of the three
  keys everywhere on the board.
- **The fixtures are still implementation-generated.** The scenario, the golden and the bilging
  replay are all change detection rather than validation. What is new is that the behaviour they
  cover is now also pinned by hand-derived assertions — the 16-point combo, the 36-point crab pair
  and the three published interactions are all derived from the wiki rather than from a recorded
  hash, so a wrong scorer no longer passes the suite. The fixtures themselves still would.
- **`pp-sim-harness/SKILL.md` documents no `crab-not-swappable` transcript.** Reaching a crab needs
  star level 5, roughly 18000 idle ticks plus a below-waterline spawn roll, which is not a transcript
  that fits the document. The reason is listed and the intro no longer claims the list is exhaustive.
  The document's "Reading state" pointer list also omits `/rngStreams/bilge.critters`.

## 2026-09-02 — physical test of slice 2 (OPP-9), PR 2, re-verified

The run that wrote the entry below died before merging and was reaped; the re-run reproduced every
measurement in it and found nothing new that blocks. Two additions only.

- **`limit-exceeded` is missing from the harness error table.** `pp-sim-harness/SKILL.md` documents
  -32700 through -32004 and stops, so the one code a driver is most likely to hit while stepping —
  `-32005` / `limit-exceeded`, the non-atomic one — is the code the skill never names. It matters the
  first time an agent writes a retry against that table.
- **`marker-field` survives a 100000-tick step by coincidence.** It emits exactly one event per tick,
  so it lands on the budget rather than over it. Any second event-emitting system in that scenario,
  or a startup event, tips it into the same silent commit-then-fail. Also, every request above the
  boundary commits exactly 99993 ticks, not the number asked for — the loop aborts the moment the
  budget breaks — so the damage is constant rather than proportional.

## 2026-09-02 — physical test of slice 2 (OPP-9), PR 2

The test stage stood the branch up in its own worktree and drove the harness over the real protocol.
No number here rests on re-running the suite. Nothing blocked: the published score table was
re-derived from real board geometry rather than from a formula, the flood model's untested half
behaves, and the ordinary path saves, reloads and replays identically. What follows is what the run
measured and deliberately left alone.

### The non-atomic step, bounded exactly

Refines the review entry below. The defect is unchanged and is still the follow-up slice's first
item.

- **The boundary is 99992.** A `sim.step` of 99992 ticks on a fresh `bilge-session` succeeds with
  exactly 100000 events; 99993 is the first count that fails, and it commits all 99993 ticks. The
  eight non-marker events are the six `bilge.waterLineMoved` and two `puzzle.levelChanged` the review
  named.
- **A retry double-advances, measured.** After the failed `sim.step {ticks:100000}` leaves the clock
  at 99993, the identical retry succeeds and lands it at **199993** — 200000 ticks of sim time for
  two requests the caller believes bought 100000.
- **Nothing else commits behind an error.** `sim.runUntil` shares the defect, and nothing else does:
  a `sim.dispatch` whose second command is structurally invalid fails the whole call with the state
  hash unchanged, a `ticks` over `MAX_TICKS_PER_STEP` refuses before stepping, and `pointer-unknown`,
  `snapshot-unknown` and an ordinary rejected swap all leave the hash where it was. The escape is the
  event budget and only the event budget.

### Tuning prose that overstates its own model

- **`_sources.bilging.pumpPerMillePerThousandTicks` says the board drains "at any efficiency above
  467 per mille". It drains at 470.** `floor(300 * d / 1000)` yields exactly 140 — the inflow — at
  467, 468 and 469, so the net rate at those three values is zero and the water holds rather than
  falls. The sibling claims in the same entry are exact: empty to full ignored is 7143 ticks
  (119.05 s), and full to empty at 100 per cent efficiency is 6250 ticks (104.2 s).
- **`dutyOutputPerMille` has no ceiling.** Ordinary combo play measured 1782 per mille, which drives
  the pump to 534 per mille per thousand ticks against a nominal 300. Nothing overflows and every
  invariant held at that rate, but the constant's "at 100 per cent efficiency" framing describes a
  drain rate a real session beats by 1.8x.
- **`comboMultiplierByLineCount[5]` is unreachable.** A census of every legal swap on 1200 opening
  boards found sixteen distinct clear shapes topping out at four lines, so the invented five-line
  multiplier of 6 — which would also outrank the Vegas multiplier of 5 — has never been applied by
  any board this engine can generate.

### Two traps for whoever blesses the next fixture

- **`snapshot.restore` re-orders the keys `state.get` reports.** After a restore the root comes back
  alphabetically (`balance, markers, nextEntityId, ...`) and the board as `cells, height, width`,
  rather than in declaration order. The state is `deepStrictEqual` either way and `stateHash` is
  unchanged because hashing is canonical, so no gate notices — but a fixture blessed after a restore
  is byte-different from the same fixture blessed cold.
- **Windows line endings defeat the skills' checksum-before-and-after proof.** With
  `core.autocrlf=true` the fixtures are CRLF in the working tree while both recipes write LF, so a
  raw byte comparison of a regenerated fixture always differs — by exactly the line count, 5236
  against 4927 bytes for the golden. Normalise CRLF to LF before comparing, or read a false
  re-bless.

### The water line is only ever exercised idle

Five moves per 1200 ticks holds `dutyOutputPerMille` between 1222 and 2322, far above break-even, so
`bilgePerMille` sits pinned at 0 for a whole played session and the water line never moves. Both
directions were driven deliberately for this test and both work; the point is that no *played* path
reaches them, so the idle golden remains the only committed coverage of the field.

## 2026-09-02 — independent review of slice 2 (OPP-9), PR 2

Four lenses plus a dedicated audit of the slice's headline claim. Nothing here blocks: the published
score table really is reproduced exactly — re-derived by execution from `01-duty-puzzles.md` itself
rather than from the repo's tests — `npm run check` is green from cold at 101 tests, and no path that
worked in slice 1 stopped working. What follows is what the slice ships alongside that.

### `sim.step` mutates and then reports failure

The first item for the follow-up slice, ahead of critters.

- **A `sim.step` at the documented maximum commits the ticks and discards every event.**
  `stepWithinEventBudget` (`packages/harness/src/methods/sim.ts:61-68`) steps the session's own sim
  and calls `refuseBeyondEventBudget` after the mutation, with nothing to roll it back. Measured over
  the real protocol: `session.new {scenario:"bilge-session"}` then `sim.step {ticks:100000}` returns
  `limit-exceeded`, and `state.get /tick` then reads **99993**. The caller is told the call failed
  while the world moved twenty-eight minutes of sim time. The same request on `marker-field` still
  returns `ok` with 100000 events, so slice 1's path is unchanged. The reachable window is ticks
  99993-100000, because the marker placeholder emits one event per tick and the puzzle adds eight
  more (six `bilge.waterLineMoved`, two `puzzle.levelChanged`). A driver that retries the failed step
  double-advances. `sim.runUntil` has the same non-atomicity, but that path was already exceedable in
  slice 1 and is pre-existing.
- **`MAX_TICKS_PER_STEP` and `MAX_EVENTS_PER_RESPONSE` are both 100000**
  (`packages/harness/src/limits.ts:1,3`), which is what makes the two limits impossible to honour
  together the moment anything emits more than one event per tick.

### The suite passes on a broken scorer

The published table is verified as a formula and not as a game.

- **Nothing connects board geometry to the score table.** `dispatch.ts:95` is the only place run
  geometry becomes points, and no test asserts a points value produced by an actual board clear — the
  gameplay-side assertions are `totalScore > 0` (`tests/puzzle/commands.test.ts:76`) and a
  `dutyOutputPerMille >= PER_MILLE` that `clearingSwapOf` guarantees by construction
  (`tests/harness/bilging.test.ts:92`). Replacing line 95 so that every clear scores as a single
  3-line, destroying the whole combo, vegas and length model, **passes all 101 tests**, the committed
  replay included, because its three swaps happen to clear only 3-runs. One test fixes it: build a
  known 4-run plus 3-run, swap, assert `puzzle.scored.points === 16`. `comboScoreOf` itself is
  genuinely well tested against the wiki in isolation (`tests/puzzle/scoring.test.ts:48`); it is the
  wiring that is unpinned.
- **The 64-step resolve cap is untested.** Setting `MAXIMUM_RESOLVE_STEPS = 1` fails exactly one test,
  and that one is an implementation-generated hash. The chain path (`chainScoreOf`,
  `chainPointsPerCell`) has no semantic assertion anywhere.
- **`findRuns` is only ever asserted to return `[]`** (`tests/puzzle/board.test.ts:26`). No test
  asserts a run's `axis`, `x`, `y` or `length`, and the Set-dedup in `cellsOfRuns` for an overlapping
  L or T clear is never exercised — the mechanism the item above depends on.
- Untouched by any test: the vertical swap axis that Treasure Haul is meant to hang on
  (`board.ts:1,36`), the degenerate-board floors and the 32-attempt colour fallback
  (`bilging.ts:32-33,61-65`), `colourCountOf`'s clamp, the pump-wins half of `floodBilge`
  (`session.ts:72-78`) and so the zero floor on `bilgePerMille`, `rampStarLevel`'s `maxStarLevel` cap,
  the `poor`, `good` and `incredible` rating bands, an accepted swap that clears nothing, and the
  events `bilge.waterLineMoved` and `puzzle.levelChanged`, which appear only inside a hashed golden.
- **All four committed fixtures are implementation-generated** — the golden, the opening-board
  scenario and both replays each reproduce byte-identically from the skills' own documented recipes.
  They are change detection, not validation: a wrong generator, run finder, flood rate or scorer
  shipped in this PR is baked in and will pass forever. `packages/fixtures/saves/marker-field-v2.json`
  is the exception and the best fixture in the slice, because `tests/sim/migration.test.ts:62`
  validates it against a freshly run sim through an independent path.
- **The purity gate's own test pins a top-level file only.** `tests/gates/purity.test.ts:14` fixes
  `SIM_SOURCE = 'packages/sim/src/index.ts'`. The nested coverage that decision 37 leans on is real —
  `eslint --print-config packages/sim/src/puzzle/bilging.ts` returns all three rules at severity 2,
  and `tools/check-sim-imports.ts:8-14` recurses — but no test asserts it.

### Recorded claims that do not survive measurement

Corrected in the analysis document as well.

- **"`MAX_EVENTS_PER_RESPONSE` stays unreachable through `sim.step`, deliberately"** — reached at
  100008 events on one legal step, by two independent measurements. The reasoning counted the puzzle's
  events and not the one-per-tick marker drift that decision 38 kept.
- **Decision 39's "stars 0-2 are complete by the published rules"** — the critter half is exact
  (`01-duty-puzzles.md:169-175` gates puffer at 3, crab at 5, jelly at 6, none with a published
  score), but `01-duty-puzzles.md:129` heads the multiplier table "at 7-star level" and `:139` says
  low star levels have lower multipliers without publishing them. `balance.json:24` applies the 7-star
  values at stars 0-2, so the implemented band scores as a 7-star board. Star level is an input to
  board generation and not to scoring (`scoring.ts:15`), which `01-duty-puzzles.md:74` asks for
  explicitly.
- **"No invented number lives anywhere else in the tree"** — four live in sim code:
  `MINIMUM_COLOUR_COUNT = 3`, `MAXIMUM_COLOUR_COUNT = 16` (`bilging.ts:10-11`),
  `MAXIMUM_FILL_ATTEMPTS = 32` (`bilging.ts:18`) and `MAXIMUM_RESOLVE_STEPS = 64` (`resolve.ts:11`).
  They are structural bounds rather than tuning knobs, so decision 6's intent survives; the absolute
  claim does not.
- **Decision 44's "`balance.json` is for invented numbers"** — `comboMultiplierByLineCount`,
  `vegasMultiplier` and `chainPointsPerCell` are all published or partly published values sitting in
  the tuning file (`balance.json:10-12`). The per-key `_sources` map discloses it honestly, but the
  stated rule is not what the file does.
- **`pp-sim-harness/SKILL.md:150` states a number that was never true.** "Reaching `waterLineRow` 8
  from a fresh board takes 4206 idle ticks" — it takes **1193**, and at 4206 the row is 6. The
  arithmetic agrees: 167 per mille at `inflowPerMillePerThousandTicks: 140`. Every other transcript in
  all three skills was re-executed against the repo and reproduced exactly, including two fixture
  recipes that came back byte-identical, so this is one stale figure in prose and not an invented
  transcript.

### Input trust, at the edges

None reachable from a committed file; all are seams the next slice builds on.

- **The two board dimensions are the only balance values clamped upward by nothing.**
  `packages/harness/src/balance.ts:27-42` stops at `Number.isSafeInteger`, and `bilging.ts:34` sizes
  an array from their product. A million square throws a catchable `RangeError`; the middle regime is
  worse, where twenty thousand square allocates multiple gigabytes and OOM-kills the harness, which no
  `try` catches. Every other balance value is clamped in `bilging.ts`.
- **A huge `vegasMultiplier` bricks a session with its state already mutated.** Verified: after two
  swaps `sim.hash()` throws on the safe-integer guard, and since `statusOf` hashes on every response,
  every later call on that session fails. Fail-safe on write — `serialise` refuses to persist it.
- **`deserialise` casts with no structural check** (`packages/sim/src/save.ts:16-37`).
  `Sim.load('{"schemaVersion":3}')` returns a plausible hash and throws only on the first `step`, so a
  truncated save is accepted silently and the hash cannot serve as an integrity check on the load
  side — the job decision 41 leans on it for when recording. `deserialise('null')` throws a raw
  `TypeError` instead of the intended message. Reachable from tests and tools only today.
- **`migrations` is the one lookup table left on the default prototype** (`save.ts:7`), where
  `methods` and `BUILDERS` are both `Object.create(null)` per decision 17. Not exploitable —
  `schemaVersionOf` enforces a number and no numeric key resolves on `Object.prototype`.
- **`puzzle.start` can half-apply.** `rngStream` registers its cursor on handle creation
  (`session.ts:34` before `:35`), so a `createBilgeBoard` that throws leaves `bilge.fill` in state
  with the hash already changed. Distinct from the accepted-swap refill-cursor note already recorded.
- **The replay limits cannot both be honoured.** The spread of command ticks and trail ticks
  (`packages/harness/src/replay.ts:63`, duplicated at `tools/record-replay.ts:45`) blows the stack at
  100000 plus 100000, which is exactly `MAX_REPLAY_ENTRIES` for each. Pre-existing, error response
  only.
- **The event budget is not enforced on `sim.dispatch`** (`methods/sim.ts:33`), and slice 2 raised the
  yield from one small event per command to up to 66, each `bilge.cleared` carrying an array. Measured
  4.34 MB from 20000 swaps, extrapolating to about 22 MB on one stdout line at the command cap.
- **A replay recorded before this slice reports `divergedAtTick: 0`**, indistinguishable from a real
  determinism bug. `Replay` carries no schema version (`replay.ts:15-20`) though `session.new` already
  returns one. The hash break is inherent to the schema bump; the misdiagnosis is what is fixable.
- **`tests/harness/balance.test.ts:26-29` leaks a temp directory per assertion** — `mkdtempSync` with
  no cleanup, four orphans per `npm test`.

### Tidy-ups

- **Fifteen symbols were added to the public API with no consumer anywhere.** `applyPuzzleCommand`,
  `startBilging`, `stepPuzzle`, `resolveBoard`, `createBilgeBoard`, `cellsOfRuns`, `basePointsOf`,
  `chainScoreOf`, `colourCountOf`, `flatIndexOf`, `isInsideBoard`, `swapPartnerOf`, `cellAt`,
  `MAXIMUM_RESOLVE_STEPS`, `MINIMUM_COLOUR_COUNT` and `MAXIMUM_COLOUR_COUNT` have zero references
  outside `packages/sim`. Slice 1 set the opposite precedent: `marker.ts`'s reducers stay private and
  `index.ts` re-exports none of them.
- **`movesForEfficiencyMilli` is dead in production** — called only from its test and re-exported at
  `index.ts:83`; the runtime path uses `comboScoreOf` and `chainScoreOf` only. The reading of the
  matrix headers 133 % and 166 % as the exact fractions 4/3 and 5/3 exists **only** in
  `tests/puzzle/scoring.test.ts:23-28` and is encoded nowhere in `packages/sim`. Taking the headers
  literally as 133/100 and 166/100 misses 30 of the 60 cells, so that mapping is load-bearing and
  lives in a test file.
- **`clamp` is written by hand four times** (`bilging.ts:22,24,44`, `session.ts:78`) where `marker.ts`
  already has a private `clamp`, and the safe-integer coordinate check is duplicated between
  `marker.ts` and `dispatch.ts:39`, both returning `non-integer-coordinate`.
- **`ReplayFixture` is declared twice** (`tools/record-replay.ts:15`,
  `tests/harness/replay.test.ts:29`), in both cases only to add `scenario` to `Replay`, which still
  lacks the field although `ReplayRun` gained it and every committed fixture carries it.
- **`waterLevel` is puzzle state, not ship state.** `01-duty-puzzles.md:181` puts it on the ship with
  inflow coupled to damage; `session.ts:25-26,75` holds it in the puzzle with a constant inflow.
  Slice 3 owns the ship, so deferring is reasonable, but moving it is another schema bump.
- **`tests/harness/bilging.test.ts:14` reaches around the RPC boundary**, importing `clearingSwapOf`
  from `../puzzle/fixtures.ts`, which uses `swapCells` and `findRuns` from `packages/sim/src`
  directly. The rest of the harness suite stays behind the protocol.

## 2026-09-02 — development of slice 2 (OPP-9), puzzle framework and Bilging

What slice 2 chose not to build, and what it left behind. None of it stops the slice: a bilging
session is playable end to end through the harness and the published score table is reproduced
exactly.

### Bilging is implemented for star levels 0 to 2 only

- **The three critters and the bonus-token layer are not built.** The wiki gates the puffer fish at
  3 stars, the crab at 5 and the jellyfish at 6, and none of the three has a published score — the
  crab's is confirmed only to scale with water height, the puffer's is qualitative, the jellyfish's
  is absent entirely. `maxStarLevel` is 2 in `balance.json`, so by the published rules no critter
  exists in the band that is implemented.

  **Not blocking.** The slice's acceptance criterion is the published score table, which covers
  lines and combos and no critter. What it costs later: the star ramp cannot express difficulty
  above 2, so the sea battle in slice 3 will read a duty output from an easier puzzle than a real
  pirate would play. A follow-up development task is queued.

- **The below-waterline fall slowdown is not modelled.** The wiki states that pieces moving below
  the water line move more slowly and that this is a real timing effect, but publishes no ratio.
  Resolution is instant inside the swap, matching the repo's dispatch-applies-immediately rule.

  **Not blocking.** It changes no score and no state, only feel, and feel has no renderer to be felt
  through yet. It starts to matter in slice 5, when a human first watches the board resolve.

### Left in the engine

- **`pointsOfStep` runs twice per resolve step** (`packages/sim/src/puzzle/dispatch.ts`) — once in
  the reduction that totals the swap and once again when the step's event is built. Pure, cheap and
  correct; it reads as an oversight rather than a choice.
- **An accepted `bilge.swap` that clears nothing still opens the `bilge.refill` cursor.**
  `rngStream` registers a cursor on the handle, not on the first draw, so a swap into empty air adds
  `{hi, lo, draws: 0}` to `rngStreams` and changes the state hash. Deterministic and harmless, but
  it means "the hash changed" no longer implies "something was drawn".
- **`resolveBoard` stops silently at its 64-step cap.** A cascade that long is not reachable on a
  12x12 board with three or more colours, but if it ever were, the board would be left holding
  matches with nothing said about it.

### Named for slice 2 by slice 1, and still open

Slice 2's task did not ask for these, and none of them blocked it. They are listed again so the
deferral stays visible rather than quietly becoming permanent.

- `tests/harness/client.ts` still correlates responses by arrival order rather than by id, and still
  has no timeout.
- `SessionRegistry` still evicts nothing, and `server.ts` still has no maximum input line length, so
  a newline-less flood still grows the heap until the process dies.
- `lastTickOf` is still duplicated between `packages/harness/src/replay.ts` and
  `tools/record-replay.ts`.
- `replay.verify` is still O(lastTick x commands); the bilging fixture is 15 ticks, so nothing in
  this slice made it worse.

## 2026-09-02 — physical test of the slice 1 rework (cycle 2), PR 1

The real binary driven over stdin and stdout: the dispatch cap at both sides of its boundary,
survival across repeated refusals, a full ordinary session, the committed replay fixture, `npm run
check` from cold and both CI jobs. All green, and PR 1 merged into `agent/develop`. One observation,
surfaced only because this stage spoke the protocol instead of calling the modules.

### `marker.place` neither places nor reports placing

- **It is a move-to-absolute on a marker that must already exist.** `packages/sim/src/marker.ts`
  looks the id up first and answers `{"status":"rejected","reason":"unknown-marker"}` when it is
  absent, so `marker.place` against any id the scenario did not spawn is refused — the
  `marker-field` scenario spawns exactly one, id 1. It then emits `marker.moved`, not a placement
  event. Both testers guessed creation from the name and had a command rejected before they read the
  source.

  **Not blocking, and not a defect.** The behaviour is correct, internally consistent and covered by
  the suite; only the name points the wrong way. What it costs is a wrong first guess from every
  future client author, paid again each time. What it will cost later: slice 2 adds a real command
  set and inherits this vocabulary, so the misnomer either gets fixed there or becomes the
  convention.

  **Why it was not fixed here.** The name is baked into
  `packages/fixtures/replays/marker-drift.json`, so renaming it to something honest —
  `marker.moveTo` — is a protocol change plus a re-recorded fixture, not a rename. That belongs with
  slice 2's command-set decisions, alongside the selector pinning recorded in the cycle 2 review
  entry below, as the other cheap improvement waiting for slice 1 to reopen.

## 2026-09-02 — independent review of the slice 1 rework (cycle 2), PR 1

Four lenses over commits `bfaeaec` and `24e78b8`. No blocking findings; the three repairs hold and
every guard was independently re-broken. What follows is everything judged not worth stopping for,
plus one correction that matters more than the rest of the list.

### The premise that was wrong

- **readline assembles an unbounded input line, and the process dies before either containment layer
  can see it.** Measured against the real binary: the harness answered `session.new`, then received
  ~512 MB of the byte `a` with no newline and no JSON validity, and exited — `RangeError: Invalid
  string length` on a default heap, and under `--max-old-space-size=256` a `FATAL ERROR: Reached heap
  limit`, exit 134, which is an abort no `catch` can reach. Reproduced independently during the
  review. The accumulation happens inside `createInterface` (`packages/harness/src/server.ts:15`),
  before the `line` event that `answer` wraps, so neither layer added this cycle applies.

  **This is not a finding against the rework.** `createInterface` has been there since `8c3d314`, the
  diff neither introduced nor worsened it, and the requirement the task set — that no *well-formed
  request* can end the process, and that a serialisation failure becomes an answer — is met and was
  verified. It is recorded here because it **falsifies a premise this cycle wrote down twice**: both
  decision 31 and the echo-paths entry below justified leaving other paths uncapped on the grounds
  that such a request line "could not have been assembled". It can be. Those two sentences are now
  corrected rather than left to mislead the next cycle.

  What it costs: the harness is killable by a client that writes bytes without a newline, taking every
  open session with it. What would fix it: a maximum input line length enforced as bytes arrive, which
  is the same shape of decision as the session and snapshot eviction policy already deferred to slice
  2, and belongs with it rather than bolted onto a serialisation repair.

- **`sim.dispatch` was not "the only amplifier".** `sim.step` returns 5,826,153 bytes for an 85-byte
  request — 68,543x, against dispatch's 2.02x at the new cap. It is survivable because
  `MAX_EVENTS_PER_RESPONSE` hard-bounds it, so decision 31's *conclusion* stands and no cap is needed;
  only its stated reasoning was too narrow.

### Bounds and stalls, measured rather than estimated

- **`replay.verify`'s quadratic rescan, timed.** `dispatchIssuedAt` (`packages/harness/src/replay.ts:63`)
  rescans the whole command list per tick. 100,000 commands at tick 0 plus one checkpoint at tick
  1,000,000 — every value inside its documented cap — blocked the harness for **8 min 4 s**, answering
  nothing for any session. This confirms the entry already recorded below and replaces its estimate
  with a measurement.
- **A refusal that has already advanced the session.** `sim.runUntil` calls
  `refuseBeyondEventBudget` after `sim.step(1)` has run (`packages/harness/src/methods/sim.ts:88-92`),
  so a `limit-exceeded` leaves the session 100,001 ticks further on with no `ticksStepped` in the
  response. Only the caller's own session, and it stays internally consistent. The `sim.step` sibling
  is already recorded below; `runUntil` is the reachable one.

### The purity gate, past what it now guards

- **The binding test pins one file, not the glob.** It proves the rules reach
  `packages/sim/src/index.ts`. Narrowing the glob to exactly that file leaves every other sim source
  unguarded with all 59 tests green. It upgrades "any glob change" to "any glob change that still
  matches index.ts" — a real improvement, short of the "closes the gap permanently" the analysis
  claimed.
- **`assert.equal(selectors.length, 4)` catches deletion but not garbling.** Mutating
  `NewExpression[callee.name='Date']` to `callee.name='Datte'` leaves all eight purity tests green —
  the same defect class as the dead `TSImportType` selector this cycle found by hand. Decision 35
  declined to pin selector spellings because doing so would have cemented the typo; **that reason
  expired the moment repair 3 landed.** Pinning the four selector strings, in the `includes` style the
  sibling assertions already use, strictly dominates the count: it catches deletion and garbling both,
  and fails loudly on the next typescript-eslint major instead of going silently dead. This is the
  cheapest real improvement on the list.
- **`severityAsNumber` will fail a valid future rule.** Its non-array branch returns the value
  untouched, so a rule declared as `eqeqeq: 'error'` prints `[2]` and compares against `'error'` —
  a spurious failure on a correct config, contradicting decision 32's "no test maintenance" claim.
  Normalising both sides to array form is one line.
- **The custom message strings are untested prose.** Rewriting them to nonsense leaves all eight
  purity tests green; the binding test compares the config to itself and the fixtures match only
  ESLint's generated prefixes.

### Tidy-ups

- `printedConfigFor` JSON-parses stdout and stderr concatenated, so any warning on stderr would
  surface as a syntax error that reads like a config fault. Parsing stdout alone is safer.
- `answers()` in `containment.test.ts` re-implements `readResponses` from `client.ts` — but buffers
  lines the older one drops, so it is the better implementation and the natural seed for the
  `client.ts` fix already recorded below.
- The `JSON.stringify` stub restores in a `finally`, which does not run if a body hangs rather than
  throws. Contained today only because the affected test is last in its file — an ordering dependency
  nobody wrote down. A `t.after()` restore removes it.
- The containment test never tears down `serve`, its two `createInterface`s or its `PassThrough`s.
- Two coverage gaps in decision 30's own guarantees: nothing asserts the fallback message is a
  *literal* rather than `String(cause)`, and `MAX_ECHOED_ID_LENGTH` is exercised at 257 but not at its
  256 boundary, so an off-by-one would pass.
- `echoableId` bounds `id.length` in UTF-16 code units, so 128 astral characters pass a 256 check and
  serialise to ~1 KB — above decision 30's "under about 400 bytes". No failure mode.
- `optionalArray` (`packages/harness/src/params.ts:74`) now has no callers.

## 2026-09-02 — analysis of the cycle 1 review findings (cycle 2)

Found while prototyping the two repairs. None of them blocks that work.

### Resources nothing bounds

- **`SessionRegistry` caps neither sessions per process nor snapshots per session.** `snapshot.take` in a loop grows the heap without limit, and so does opening sessions. This is resource exhaustion rather than response size, so the containment layers added this cycle do not help — an OOM kill is not a throw anything can catch. It is out of scope here because it is a different failure mode from the one under repair and needs its own decision about eviction policy, which slice 2's session lifetime work is the natural place for. Worth a ticket of its own rather than an entry here if it is still open by then.
- **The echo paths are unbounded but cannot currently overflow.** `replay.verify` echoes `expectedHash` verbatim, and the `method-unknown`, `scenario-unknown` and `pointer-unknown` messages echo the offending name. All are 1x or smaller, so a response cannot exceed the maximum string length unless the request line already did. **The clause that once followed here — that readline could not have assembled such a line — was false, and is corrected in the cycle 2 review entry above.** A `MAX_ECHOED_STRING_LENGTH` truncation inside `RpcError` message construction would cover all of them at once and is the obvious belt-and-braces, but there is no reachable failure to justify it today.

### The last unguarded throw

- **`output.write` throwing inside the line listener's catch still escapes.** The containment added this cycle wraps the handler, not the write that reports its failure. A failing write to stdout means the peer is already gone, so there is nothing left to answer and nowhere to report it — wrapping it a second time buys a quieter exit, not a working one. Recorded so the next person does not read the containment as absolute.

### Tidy-ups the repair deliberately did not take

- **The gate suite now has two fixture sets and two `files` blocks where one would do.** The `tests/gates/fixtures` block exists only so the negative tests can probe the purity rules from outside the sim, and that separation is precisely what allowed the rules to be detached from `packages/sim/src` with every test still green. With the binding assertion in place the redundancy is harmless, so consolidating — a single fixture living under the real glob, and the second `files` block deleted — was rejected as churn at cycle 2 of a ceiling of 3. It is the right end state once the slice has landed.
- **Neither the binding test nor a fixture proves a rule's selector still matches the parser's AST.** The dead `TSImportType` selector fixed this cycle was invisible to both: the binding test compares the config to itself, and no fixture exercised that rule. The general defence is a fixture per rule under the real glob, which is more machinery than the risk currently justifies. Revisit on the next typescript-eslint major, which is when selector fields move.

## 2026-09-02 — review of PR 1 rework (slice 1, cycle 1)

Found by the four review lenses on the rework. Two blocking findings went back to analysis; these did
not meet the blocking test. The gate and bounds entries below are all *narrower* holes than the two
that blocked — recorded so the next person does not have to rediscover them.

### The purity gates, past the naive spelling

The gates now catch every violation cycle 0 demonstrated. These are the routes they still miss. None
is the plain documented case, which is why none blocked.

- **Dynamic `import()` through a variable escapes the import gate.** `const p = '../../harness/src/json.ts'; await import(p)` passes both `imports` and `lint`. Statically undecidable; the literal and concatenated forms are both caught. Only worth revisiting if the sim ever legitimately needs dynamic import, which it should not.
- **A symlinked directory inside `packages/sim/src` defeats both gates.** `sourceFiles` in `tools/check-sim-imports.ts` treats a symlink as a non-directory, so `export { isRecord } from './linked/json.ts'` through a junction is invisible. Demonstrated. Nobody creates one by accident; it matters only if a build step ever starts linking directories into the sim.
- **A non-`.ts` extension inside `packages/sim/src` is invisible to every gate.** A `.mts` or `.cts` file importing `node:fs` passes `imports` and `lint`, and tsc's `src/**/*.ts` glob does not match it either. Starts to matter the moment anything in the repo emits a non-`.ts` file into that directory.
- **The import gate is a regex over file text, so specifier-shaped strings are false positives.** A comment containing `from 'node:fs'`, or a string constant holding an import statement, fails the gate with a misleading diagnostic. It fails safe rather than open, which is the right direction, but it will read as a mystery build break the first time it happens.
- **The dependency gate reads four manifest fields, not seven.** `bundledDependencies`, `bundleDependencies`, `overrides` and `resolutions` all pass, and npm honours all four. Adding them is a one-line change to `FORBIDDEN_FIELDS`; it was left because no workflow here writes those fields today.
- **Nondeterministic globals never enumerated.** `setImmediate`, `queueMicrotask`, `Intl`, `navigator`, `fetch`, `structuredClone`, `eval` / `new Function`, and `Reflect.get(Math, 'random')()` all lint clean in sim source. `structuredClone` is the notable one — the stack decision avoids it as a host global, but no rule stops it. The determinism test remains the backstop for all of these.

### Replay, at the edges

- **`replay.verify` is O(lastTick x commands), and both factors are capped independently.** `dispatchIssuedAt` rescans the whole command list once per tick. A request inside every documented cap — 100000 commands with one at tick 1000000 — occupies the harness for somewhere between nine and twenty-one minutes of saturated CPU, memory flat. Nothing is corrupted and the process recovers, so this is latency with no stated budget rather than the availability failure that blocked. But the harness is single-threaded, so one such request stalls every session. Indexing commands by tick into a `Map` before the loop removes it entirely, and that is the right fix when someone touches this next.
- **A request within both array caps can fail with `internal-error` instead of succeeding.** `lastTickOf` uses `Math.max(0, ...commandTicks, ...trailTicks)`; past roughly 125000 spread arguments V8 throws `RangeError: Maximum call stack size exceeded`, which surfaces as `-32603`. Measured: `commands` 100000 plus `hashTrail` 30000 trips it, both under `MAX_REPLAY_ENTRIES`. It is caught and the process survives, so it is a wrong error code rather than a crash — but it contradicts decision 16's intent that well-formed-but-too-large be actionable. A reduce instead of a spread fixes it.
- **Duplicate `hashTrail` checkpoints silently last-win.** `new Map(run.hashTrail.map(...))` means a trail carrying both a wrong and a correct hash for the same tick verifies `ok:true` when the correct one comes last. It cannot mask genuine divergence — the winning duplicate must carry the true hash — so it only lets a self-contradictory trail pass, and no well-formed recorder emits one.
- **`replay.verify` ignores `scenario`.** The fixture stores `"scenario": "marker-field"` and the recorder honours it, but `verifyReplay` calls `Sim.create({ seed })` directly rather than `createScenarioSim`. Harmless while `marker-field` is the only scenario and the default; silently wrong the day slice 2 adds a second one. Worth fixing with the first new scenario, not before.
- **`lastTickOf` is written twice**, in `packages/harness/src/replay.ts` and `tools/record-replay.ts`, with identical bodies and no test pinning either. The rule defining how long a replay runs lives in two places; if they drift, the recorder and the verifier disagree about the run length. It resolves itself when the ndjson client moves somewhere both can import, which `ISSUES.md` already anticipates for slice 2.

### Test coverage the rework left open

- **Nothing pins the *final* checkpoint of a replay.** The committed tests corrupt a middle checkpoint only, and the fixture's last command sits at tick 7 of 12. Consequently a verifier mutated to loop `tick < lastTick` instead of `tick <= lastTick` passes all 53 tests, while a corrupted final checkpoint and an extra command on the final tick both return `ok:true`. The shipped verifier is correct; it is the test suite that does not hold it there. One assertion on the final checkpoint closes it, and this is the single highest-value test to add.
- **`MAX_TICKS_PER_RUN` is unreachable in practice and its test does not exercise the cap.** With one marker the event budget aborts any run past 100001 ticks, so the run cap can never fire. The test that reads as pinning the boundary passes because `equals: 0` matches at tick 0 and no ticks are stepped. Slice 2 changes the arithmetic; the test should be made real then.

### Corrections to entries recorded this cycle

Both of these are entries added by the rework that are narrower or wider than what the code does. The
code is right; the note is wrong.

- **"The event budget is unreachable through the protocol today" is not correct.** `sim.runUntil` with `pointer: "/tick"`, `equals: -1` and `maxTicks: 100001` returns `limit-exceeded: a request may emit at most 100000 events` today. A genuine rejection test is writable now, not in slice 2.
- **"No purity rule survives local aliasing" is wider than the truth.** `no-restricted-globals` fires on the reference itself, so `const P = process; P.pid` *is* caught, as are `const { random } = Math` and `Math['random']()`. Only a restricted *property* reached through a local object binding — `const M = Math; M.random()` — survives. The recorded limit is real but applies to one rule family, not to every rule.

## 2026-09-02 — rework of PR 1 (slice 1, cycle 1)

Found while fixing the five blocking findings. None of these blocked the fix.

### The limits of a lint rule

- **No purity rule survives local aliasing.** `const M = Math; M.random()` passes
  `no-restricted-properties`, and the same trick defeats every restricted global now that
  `globalThis` itself is banned. ESLint reasons about spellings, not values, so this is not fixable
  by adding more entries to the list — only a type-aware or dataflow rule would catch it, which is a
  disproportionate amount of machinery for the risk. The determinism test in
  `tests/sim/determinism.test.ts` is the real backstop: an aliased nondeterministic call makes the
  same seed produce a different hash, and that test fails. Worth revisiting only if a real
  nondeterminism bug ever gets through.

### Bounds, at the edges

- **A step that trips the event budget leaves the session partially advanced.** `stepWithinEventBudget`
  (`packages/harness/src/methods/sim.ts`) mutates as it goes, so a request refused with
  `limit-exceeded` has already moved the clock. The caller can read the true `tick` back and carry on,
  but the failed call is not atomic. Inherent to enforcing the budget outside `Sim.step`, which
  decision 15 chose deliberately to keep `packages/sim` pure. It starts to matter if an agent ever
  relies on a failed request having changed nothing — snapshot and restore is the answer there.
- **The event budget is unreachable through the protocol today.** One marker means events equal ticks,
  so `MAX_TICKS_PER_STEP` always fires first and `MAX_EVENTS_PER_RESPONSE` cannot be tripped by any
  request. The test pins the boundary at the accepting side rather than proving a rejection. Slice 2
  multiplies markers and makes it reachable; the rejection path should get a real test then.

### Layering

- **`tools/record-replay.ts` imports `tests/harness/client.ts`**, so a tool depends on a test helper.
  It was done so the committed fixture and the round-trip test are produced by the same code path,
  which is the point of the acceptance criterion, and duplicating the recording loop to avoid it would
  be worse. The clean fix is to move the ndjson client to a place both can import — a `packages/client`
  or `tools/lib` — which is a slice 2 concern once more tooling needs it.

## 2026-09-02 — review of PR 1 (slice 1, simulation core and harness)

Five blocking findings were returned to analysis. The rest are recorded here.

### Robustness, latent today

- **`Sim.state` is only shallowly readonly** (`packages/sim/src/sim.ts:32`). `sim.state.markers[0].x = 99`
  and `sim.state.rngStreams['marker.drift'] = ...` both typecheck under strict mode and do mutate the
  live state — verified, the hash moves. Nothing in the codebase does this today, and nothing can
  reach it over RPC because responses are serialised. It becomes a real hazard once more systems hold
  a `Sim` reference. A deep readonly type, or handing out a clone, would close it.

- **`deserialise` validates nothing beyond `schemaVersion`** (`packages/sim/src/save.ts:15-38`). A save
  with `"tick": 0.5`, a missing `markers` array, or a string in an RNG cursor loads without complaint
  and then fails much later and far away — `hash()` throws on the non-integer, `step()` throws inside
  the RNG. Not reachable today: no harness method calls `Sim.load`. **This must be fixed before slice 4
  wires save and load into the game loop**, because at that point a corrupt save becomes a user-facing
  data-loss path rather than a library hazard.

- **`nextIntInRange` never terminates for a span of 2^32 or more** (`packages/sim/src/rng.ts:38-40`).
  `UINT32_SPAN % span` equals `UINT32_SPAN` at that size, so the debias limit is 0 and every draw is
  rejected forever. The only call site today asks for a range of 3. It is a trap for slice 2's puzzle
  code, and the existing guard only rejects an empty range.

- **Sessions are never evicted** (`packages/harness/src/sessions.ts:19`). A long-lived harness process
  accumulates sessions and snapshots. Fine at present scale.

- **Error messages echo the full caller-supplied value** (`scenarios.ts:14`, `rpc.ts:57`,
  `pointer.ts:30`). An 80 MB scenario name produced an 83 MB error line. A length cap on echoed values
  would cost nothing.

### Test coverage

Mutation testing found that 16 of 36 deliberate breakages went undetected. The code was separately
verified correct, so these are coverage gaps rather than defects — but they are the gaps the next two
slices lean on hardest.

- **`nextUint32` has no direct test.** Every RNG assertion observes it through `draw % 3`, and 3
  divides 2^32 − 1, so the modulus is provably blind to the rotation direction: inverting the rotate in
  `rng.ts:67` leaves all 37 tests passing. Slices 2 and 3 draw ranges of 6, 7 and 52, where it would
  not hide. A committed golden vector of raw `nextUint32` draws fixes this permanently.
- **No test that two named streams are independent** — only `marker.drift` ever exists. Slice 2 and
  slice 3 each want their own stream.
- **The debias loop and the empty-range guard in `nextIntInRange` are untested** (3 surviving mutants).
- **`restore` aliasing instead of cloning is not caught**, because no test restores the same snapshot
  twice. That is exactly the branch-and-compare workflow the skill recommends.
- **`jsonPatch` array add and remove are dead code today** (`packages/harness/src/patch.ts:39-48`)
  because `markers` never changes length. Slice 3 spawns and sinks ships, and `state.diff` is the
  agent's main observation channel.
- **The migration tests are circular** (`tests/sim/migration.test.ts:6-10`): the "v1 save" is
  manufactured by taking a current save and relabelling `schemaVersion`, so an identity migration is
  indistinguishable from a real one. When slice 2 adds a field to `WorldState` the test will still
  pass without exercising a migration. A committed v1 save fixture under `packages/fixtures/saves/`
  would make it a real test. Related: the changelog justified `SCHEMA_VERSION = 2` as giving "a real
  1→2 migration"; the registered migration is the identity function.
- **`takeEntityId` is exercised with exactly one entity**; multi-entity spawn is untested.
- **JSON Pointer escaping (`~0`, `~1`) and object depth truncation have no tests** (3 surviving
  mutants) even though the implementation is RFC-correct.

### Maintainability

- **`tests/harness/client.ts` correlates responses by arrival order, not by JSON-RPC id**
  (`:35`, `:39`). That is why a mutant returning `id: null` for every response survived, and it means a
  blank input line leaves a resolver pending forever and shifts every later response by one. There is
  also no timeout, so a harness crash hangs the run instead of failing it. Slice 2 should swap the FIFO
  for an id-keyed map and make `call` generic before building on it.
- **The command shape is written twice** — the `Command` union in `packages/sim/src/commands.ts` and a
  hand-written switch in `packages/harness/src/commands.ts:10-17`. The return type catches field drift
  but not a missing variant: add a command to the sim and the harness still typechecks while silently
  rejecting it as invalid params.
- **`packages/sim/src/clock.ts` hides more than it reveals.** `Clock` is never used as a type,
  `createClock()` exists only so `state.ts:26` can write `createClock().tick` instead of `0`,
  `advanceTick` compiles by structural coincidence, and `TICKS_PER_SECOND` is exported and unused.
- **`divergenceAt` (`packages/harness/src/replay.ts:70`)** threads a sticky result through a
  pure-looking helper; an explicit check at the call site would read better.
- **`truncateToDepth` lives in `pointer.ts`** and has nothing to do with pointers.
- **The placeholder domain is wider than one file.** The analysis changelog tells slice 2 to delete
  `packages/sim/src/marker.ts`, but `commands.ts`, `events.ts`, `state.ts` (`markers` is a required
  field of `WorldState`), `sim.ts` (`Sim.create` spawns a marker) and the harness's `commands.ts` and
  `scenarios.ts` are all marker-shaped. Slice 2 replaces a vocabulary, not a file.

### Undocumented protocol deviations

These depart from `docs/wiki-map/06-stack-decision.md` without a recorded rationale. None is wrong;
they are now recorded in the analysis document instead.

- `session.new` returns `session`, not `sessionId`, and every session-scoped method takes `session` —
  while snapshots still use `snapshotId` and `fromSnapshotId`.
- `replay.verify` takes `{seed, commands, hashTrail?, expectedHash}` rather than `{path}`, and does not
  return `divergedSystem`.
- `rng.cursors` requires a `session` and returns the full `{hi, lo, draws}` cursor rather than a draw
  count per stream.
- `sim.runUntil` makes `equals` required and implements no `exists` predicate.
