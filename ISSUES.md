# Known issues

Non-blocking findings, newest first. Blocking findings never land here — they go back to the
analysis stage. Each entry says why it was judged not worth stopping for, and when it will start to
matter.

## 2026-09-02 — independent review of slice 3 (OPP-10), PR 3

Four lenses plus an empirical probe, all against `ea34344`. Three findings blocked and went back to
analysis at cycle 1: the prototype key that passes the ship-class guard, the v3 to v4 migration that
leaves `balance` structurally invalid, and rock damage being dropped from the melee handicap. What
follows is everything the review deliberately let through, with why.

### The sweep test is thinner than its claim

`tests/harness/battle.test.ts` is the slice's headline evidence, and 23 mutations run in a scratch
copy measured what it actually holds. All 252 tests stay green when:

- `battle.plan` accepts the plan and then discards it (`battle/dispatch.ts:66`)
- the win and loss labels are swapped (`battle/session.ts:143-144`)
- cannon fire applies no damage to the victim (`gunnery.ts:85`)
- melee is hard-wired to resolve for either side (`battle/session.ts:159`)
- obstacle and ram damage attribution are swapped, which is decision 60 itself (`turn.ts:102`)

Only `unresolved === 0` is load-bearing: it catches a brigand that stops re-planning and a noise
value that makes battles run forever. The behaviour is genuinely implemented — driving the player
with `idlePlan()` instead of `planBrigandTurn` collapses 12 wins in 24 seeds to 1, so plans do reach
the ship — which is why this is a thin test and not a false claim. Two assertions would close most of
it: that the loser is the ship that is fully damaged, and that a resolved hit reduces the victim's
hull. The `ISSUES.md` entry from development calling this "an honest test of drivability" overstates
it; drivability is the one thing it does prove.

### The 120-turn cap is tuned to one policy

The committed sweep caps a battle at 120 turns and asserts none is unresolved. Over 300 seeds the
mirror policy's longest battle is 93 turns, so the cap holds — but a different player policy walks
straight past it: on seed 1298716 a simple heuristic is unresolved at 120 and wins at turn 156. The
assertion is safe only while the player is driven by the brigand's own planner. It starts to matter
the moment slice 5 puts a human, or any other policy, on one side.

### Rules holes that only bite once there is a second party

- **`battle.plan` and `battle.disengage` have no allegiance check** (`battle/dispatch.ts:57,73`).
  `battleShipOf` matches either combatant, so a client can overwrite the brigand's committed plan
  every turn — measured, the plan goes to all-idle and the state hash moves — and can end the battle
  through the opponent's ship. Offline and single-player today; a cheat the moment there is a UI.
- **An unknown `allegiance` silently coerces to `player`** (`harness/src/commands.ts:46`).
  `"BRIGAND"` and `"navy"` both commission a player ship. Every sibling enum in the same function
  throws on an unknown value, and the mis-commission surfaces later as an unrelated `unknown-ship`
  from `battle.start`.
- **A finished battle can never be cleared** (`battle/dispatch.ts:39`). Nothing sets `state.battle`
  back to `null`, so one session runs one battle for its whole life, and afterwards `battle.start`
  says `battle-already-running` while `battle.plan` says `no-battle-running` — two contradictory
  answers about the same state, one of them plainly false.
- **`state.ships` has no ceiling.** `ship.commission` pushes unconditionally and
  `MAX_COMMANDS_PER_REQUEST` is 100000, so one legal request commissions 100000 ships; at 20000 ships
  a single `hash()` takes about two seconds, and `statusOf` hashes on every response. Self-inflicted
  and offline, but it is the first client-driven unbounded collection in the state.

### The melee formula is coarser than the battles it decides

`resolveMelee` has no RNG: the attacker wins if and only if it is strictly stronger, so every tie
goes to the defender. In this scenario crew is 5 on both sides and rum is never consumed, so
`strengthOf` collapses to `30 × (6 − blackBlockRows)` — seven possible values. Measured over 766
melee-decided battles the tie rate is 28.7%, and 45.1% when both sides play the same policy; 152 of
220 observed ties are 0 versus 0, both ships pinned at maximum handicap. Re-scoring the same 900
battles with ties going to the attacker moves the player's win rate from 51.0% to 33.7% under mirror
play and from 43.0% to 10.0% under a heuristic. Ties alone decide about a quarter of all battles, so
the tie-break is the single largest rule in the sea battle and it is invented. It is recorded rather
than blocked because no published formula exists to contradict, and because finding 3 above changes
the input to this formula anyway — worth revisiting together.

### Tuning prose that overstates its own model, again

The same failure mode slice 2's review and test both caught. `balance.json` has an exact 47-key to
47-`_sources` bijection and every value is honest as a number; the prose is where it drifts.

- **`brigand.planLookaheadPhases`** says a plan "cannot be scored on less" than a full turn.
  `bestCandidateOf` scores only the immediate resulting pose — the planner is greedy and 1-ply. The
  key gates which phases may contain a move; the name and the rationale describe an algorithm that
  does not exist.
- **`booty.brigandPoePerMightMilli`** says payouts scale with might, crew size and opponent rank and
  that 1000 makes that scaling linear. There is no might, crew-size or rank input anywhere in
  `packages/sim/src` — it is a dead multiply by one.
- **`booty.overflowPolicy`** describes truncate as taking what fits "in descending unit value", but
  cargo is one undifferentiated scalar with nothing to sort, and `spill-to-sea` falls through to the
  truncate branch. The development entry records the two identical policies honestly; the `_sources`
  prose was not updated to match.
- **`ship.rumPerPiratePerThousandTicks`** says 1 is the slowest rate that still lets a ship run dry.
  Nothing consumes it, so nothing can run dry.
- **`brigand.blunderNoisePerMille`** says 30 is "still below the weight of a broadside worth taking".
  The jitter draws from [−30, +30], so the peak-to-peak swing is 60 against a
  `weightBroadsideExposure` of exactly 30.

The cheap fix for the whole class is one test asserting the key to `_sources` bijection the file
itself declares ("a key with no entry is a bug"), which nothing currently enforces.

### The noise retune is defensible but unpinned

30 is not fitted to one sweep — the headline test passes across a plateau from 20 to 150 and fails at
0, 5, 10, 300 and 1000, and the arithmetic in its `_sources` entry checks out as three tiles of
`weightCloseDistance`. But instrumenting `bestCandidateOf` over the 24-seed sweep shows the jitter
still overriding the scorer in 575 of 1435 multi-candidate decisions, 40.1%, against 63.1% at the old
150. "Variety, not noise" overstates it. And nothing pins it: changing 30 back to 150 leaves every
behavioural test green and fails only the two goldens, the scenario fixture and the replay — all four
of which a re-bless silences. The analysis document's own lesson from the cannon rate, that a
constant whose `_sources` entry states an outcome should have a test asserting that outcome, was not
applied here.

### A retuned constant is already stale in a test fixture

`tests/ship/meters.test.ts:61,69` restates the whole tuning file inline and two values disagree with
`balance.json`: `brigand.blunderNoisePerMille` is 150 (the pre-retune value decision 53 exists to
remove) and `npc.brigandCrewDutyOutputPerMille` is 700 against 900. Both are inert because
`meters.ts` reads neither, which is exactly why nothing caught them. The same literal is duplicated a
third time in `tests/battle/brigand.test.ts:48-54`, which has the current values. Three copies, one
already drifted, four hours after the retune.

### The event-budget escape, re-rated for battles

Slice 2 recorded that a `sim.step` past `MAX_EVENTS_PER_RESPONSE` commits its ticks and discards
every event behind a `limit-exceeded` error, and the follow-up slice owns the fix. Slice 3 widens the
blast radius rather than changing the defect, so it stays there rather than blocking here — but the
new severity is worth stating plainly. On a `sea-battle` session, `sim.step {ticks:100000}` returns
`limit-exceeded` with the clock at 99886, `/battle/turnIndex` at 18 and `/battle/outcome` already
`player-lost`: eighteen full battle turns resolved and the battle ended, with `battle.ended` and its
booty payout thrown away inside a call the caller believes failed. In slice 2 the same defect lost
marker drift. It should be the first item of whichever slice takes it.

### Coverage notes worth keeping

- **Rejection sampling in `rng.ts:38-40` is unasserted.** Deleting the unbiased limit — plain
  `draw % span` — passes all 252 tests, because `rng.test.ts:77` asserts membership of the range and
  never uniformity. It matters: `nextIntInRange(0, 1000)` drives `geniusChancePerMille` and
  `chartDropChancePerMille`, and 2^32 mod 1000 is 296.
- **`settleOverlaps` cannot fire below three ships.** Both call sites can be deleted and its
  fixed-point loop reduced to one pass with the suite green. An exhaustive 2-ship sweep of 2973696
  configurations produced zero reversions; a 3-ship fuzz of 59155 cases produced 48. It is a safety
  net for a case this slice cannot reach, not dead code — but nothing tests it, and every battle
  shipped here has exactly two ships.
- **The accumulator-zeroing guard at `meters.ts:75` is untested and nearly inert.** Deleting it
  passes 252 tests; measured, it changes the first per-mille of drain after a full-bilge pin by at
  most three ticks. The damage-side twin at `:86` is tested. The analysis document's blanket claim
  that accumulators are zeroed when a meter clamps is only *tested* for damage.

### Small things

- `movedPhasesOf` (`battle/plan.ts:45-47`) is dead — the identifier appears nowhere else in the repo.
- `setup.ts:58,71,84` hand-rolls `` `${x},${y}` `` three times; `claims.ts:60` already exports
  `tileKeyOf` for exactly that, in the same package.
- `ship/state.ts:93` hard-codes `1000` twice where every sibling module imports `PER_MILLE`. Correct
  value, but it falsifies the entry's "all but two literals are published rules" for the second slice
  running — the true count is three.
- `DamageSource` still declares `'wear'` (`events.ts:59`), which decision 61 makes unconstructable.
  The same unreachable-value shape decision 59 removed `no-cannonball` for.
- Eight symbols are exported but used only inside their own file (`holdCapacityOf`,
  `ramDamageOverridesOf`, `TurnScope`, `ramDamageOf`, `createBattleShip`,
  `PLANNING_SECONDS_PER_TURN`, `RUM_SICK_COLUMNS`, `GunneryScope`). In a codebase with no comments an
  unnecessary export reads as an intentional seam.
- `ship.commission` is dispatched from `battle/dispatch.ts` although decision 48 separates
  commissioning from `battle.start` precisely so slice 4 can commission outside a battle. A
  `ship/dispatch.ts` would match the `puzzle/dispatch.ts` convention and save the move later.
- Both token pools start empty and are only minted in `endTurn`, so **both ships are immobile for the
  whole of turn 1**. Defensible as per-turn sampling of a continuous production rule, but written
  down nowhere.
- The brigand commits its opening grapple from the pre-move pose, but `executePhase` runs movement
  before fire, so on 54 of 1600 configurations its own phase-0 move carries it off the beam and the
  grapple lands in empty water. The wiki says the NPC "will try", and it does try, so this conforms —
  one assertion that a phase-0 grapple keeps the ship in reach would close it.
- `tools/record-replay.ts` still has no check mode, and a blind re-record does launder a real
  determinism regression: introducing one turned 8 tests red, re-recording the three fixtures brought
  it to 4. The development entry's non-blocking call stands, and is stronger than it argues — the
  corrupted fixture committed for `pp-replay-triage` is itself a tripwire, and two more survive — but
  the healthy fixtures have no equivalent pin.
- `pp-replay-triage/SKILL.md:632` calls `tests/harness/client.ts` "the 60-line stdio client"; it is
  77 lines. Inherited boilerplate — the same phrase is in three other skills. All 16 of that skill's
  transcripts re-execute character for character, which retires the standing invented-transcript
  finding.
- The `pp-sim-harness` "real session" transcript is now stale: it shows `schemaVersion` 3 and a
  `state.get` with no `ships` or `battle`. A run today reports `schemaVersion` 4.
- The development entry says six new balance keys were invented; the slice adds 34, the other 28
  coming from the reaped run whose work was kept. True of the run, not of the slice.

## 2026-09-02 — development of slice 3 (OPP-10), ship state and sea battle

Nothing here blocks. A sloop-versus-brigand battle plays to a win and to a loss headlessly, every
battle in the outcome sweep resolves, and `npm run check` is green from cold. What follows is what
the slice ships alongside that, and where each item starts to matter.

### Implemented but never placed on a board

`tiles.ts` implements whirlpools exactly as the wiki describes them — a 2x2 tile mapping each corner
to the diagonally opposite one with a quarter turn clockwise — and `collision.ts` handles the
`whirl` intent, including the published example where a wind-pushed small ship blocks a large ship's
whirl. But `setup.ts` scatters only rocks and wind, so no committed scenario ever produces one. The
placement rules for a 2x2 feature are not published, and the slice's task named rocks and wind only.
It starts to matter when a battle board is authored by hand rather than scattered, which is a slice 5
concern.

### The agent that proves the headline claim is the brigand's own planner

`tests/harness/battle.test.ts` drives the player's ship with `planBrigandTurn`, the same policy the
opponent uses. That is what makes the sweep a fair fight and both outcomes reachable, and it is an
honest test of *drivability* — the plans go through `battle.plan` like any agent's would. It is not
a test that a *good* player wins, because there is no separate notion of good play to compare
against. When slice 5 gives a human the same controls, a scripted opening worth beating is the thing
to write.

### The speed meter has nothing to read it

`stepShipMeters` computes speed every tick from sailing and rigging, multiplies it by duty
navigation and caps it by bilge exactly as documented, and no code anywhere consumes
`ship.speedPerMille`. Speed governs league traversal, and there are no leagues until slice 4. The
cost of leaving it in is one integer per ship per tick; the cost of taking it out would be
re-deriving the coupling later from a wiki page already read.

### Two overflow policies that are the same policy today

`booty.overflowPolicy` accepts `truncate`, `refuse` and `spill-to-sea`. With one undifferentiated
cargo unit there is nothing to sort by value, so `truncate` and `spill-to-sea` both take what fits
and discard the rest, and only `refuse` behaves differently. The distinction becomes real when
slice 4 introduces commodities with per-unit values.

### Melee is a strength comparison, not a swordfight

`resolveMelee` scores each side as crew times unblocked rows times unblocked columns and gives the
tie to the defender. It reproduces the *shape* of the handicap the wiki describes — black blocks
from cannon damage, narrowed board from rum sickness — with no published formula behind the numbers,
because there is none to find. It decides real battles today, so its bias is worth measuring before
the swordfight puzzle replaces it in phase 2.

### `whirlpoolOriginOf` scans the whole board

It walks all 576 tiles looking for a matching whirlpool id, and it is now called from inside the
per-phase tile step. With no whirlpools placed it is never reached; if one is ever scattered, this
runs up to eight times a turn. The fix is to carry the origin on the tile rather than search for it.

### Damage attribution collapses one ambiguous case

A collision outcome carries a single `damageTakenSmallMicro`, and the turn step attributes all of it
to `obstacle` when the ship struck one and to `ram` otherwise. A ship that is both grounded on a rock
and bumped by a mover in the same pass therefore reports its ram damage as obstacle damage. The
difference is visible only in the melee handicap, which obstacle damage does not raise and ram damage
does, and the case needs a mover to bump a ship that is simultaneously stopped by a rock.

### Four sharp edges around replays, found while writing `pp-replay-triage`

Writing the triage skill meant driving every replay path deliberately wrong, which surfaced these.
None blocks: each is a gap in the tooling around determinism rather than a defect in determinism
itself, and the skill documents its way around all four.

- **A replay fixture records no schema version.** `Replay` carries `seed`, `scenario`, `lastTick`,
  `commands`, `hashTrail` and `finalHash`, and nothing that says which schema it was recorded
  under, although `session.new` already returns one. So a trail made stale by a schema bump cannot
  be told from a corrupted one by reading the file — you have to go to `git log` on `state.ts`.
  Goldens pin the version; replays do not. The slice 2 review named this from the other direction,
  as `divergedAtTick: 0` being indistinguishable from a real determinism bug. It is one field.

- **`tools/record-replay.ts` heals silently.** Run against a deliberately corrupted fixture it
  replaces the bad hash with the true one and drops any extra field, printing only its usual
  success line — verified on a scratch copy of the committed diverged fixture, which lost both its
  `deadbeefdeadbeef` checkpoint and its `note`. There is no `--check` mode that verifies and fails
  instead of writing. This is the sharpest edge in the area, because re-recording a trail you have
  not explained is exactly how a real determinism bug gets committed, and the tool makes that the
  path of least resistance. The skill's re-recording section is built around the gap.

- **`replay.verify` names only the first bad checkpoint.** Nothing in the protocol says whether the
  divergence persisted afterwards, which is the difference between a bad recording and a real
  desync. Returning a count, or the last diverging tick alongside the first, would make the skill's
  whole trail-walking step unnecessary.

- **Nothing pins the final checkpoint of a replay.** The committed diverged fixture corrupts a
  middle checkpoint — tick 5 of 12 — because that is the better specimen to teach against, so the
  `tick <= lastTick` boundary of the trail remains unexercised. One assertion against a fixture
  whose last checkpoint is corrupted would close it.

### Carried forward from slice 2, untouched

The slice 2 review named two follow-ups: the non-atomic `sim.step` that commits a mutation behind a
`limit-exceeded` return in the 99993-100000 tick window, and the missing test connecting real board
geometry to the score table. Both belong to the queued slice 2b task and neither was touched here.
Nothing in this slice makes either worse — the battle's own events are bounded at a handful per
phase.
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
