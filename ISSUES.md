# Known issues

Non-blocking findings, newest first. Blocking findings never land here — they go back to the
analysis stage. Each entry says why it was judged not worth stopping for, and when it will start to
matter.

## 2026-09-03 — analysis of the slice 4c review finding (OPP-16), PR 9, cycle 1

Raised while deciding the blocking repair. Decisions 126 to 131 are in the analysis document.

### A concluded battle with no voyage at all is still cleared by nothing

`stepWorld` (`packages/sim/src/world/session.ts:10`) returns on its first line when
`state.voyage === null`, so the repair in decision 126 — which settles any concluded battle *while a
voyage runs* — does not reach the sea-battle case. `battle.start` with no voyage, fought to a
conclusion, leaves the battle standing, and `battle/dispatch.ts:40` then refuses every later
`battle.start` with `battle-already-running` for the rest of the session. The brigand hull is never
struck off and the stale battle rides in the canonical hash and every save.

**This is not a regression.** Base `22ec18e` behaved identically — its predicate also began with the
`voyage === null` return — so nothing slice 4c did caused it, and decision 126 restores base
behaviour exactly rather than extending it. It is recorded here because the blocking finding made
the whole class visible, and because the class is now one guard narrower than it looks.

`tests/harness/battle.test.ts:126` **positively depends on the current behaviour**: the sea-battle
scenario has no voyage, and the test reads `brigand.cargoUnits` and `player.bootyCargoUnits` after
the win, both of which a tick-time settle would strike off and zero. So this is not a free fix.

Two designs, neither a two-line change:

- **Relax the no-voyage guard**, letting `stepWorld` settle a concluded battle with no voyage. This
  changes the sea-battle scenario's contract and needs that harness test rewritten to read the hulls
  before the settle rather than after.
- **Make `battle/dispatch.ts:40` refuse only a *running* battle.** Cheaper and more local, but a new
  `battle.start` would then overwrite an unsettled concluded battle, silently dropping its brigand
  hull and its un-materialised `bootyCargoUnits`. It needs a settle-before-start step to be safe,
  which is the first design wearing a different coat.

It starts to matter when a scenario or a player session starts a battle outside a voyage and expects
to start another one afterwards. Nothing in the current scenarios does.

### `battle.start` and `rollEncounter` treat a concluded battle as an occupant

`world/encounter.ts:38` and `battle/dispatch.ts:40` both test `state.battle !== null` and ignore
`outcome`, so residue blocks as hard as a running battle. Under decision 126 a concluded battle
survives at most one tick while a voyage runs, so the encounter site's blindness stops being
reachable in the voyage case — but both sites remain outcome-blind, and it is that blindness, not
the failure to clear, that converts "uncleared" into "the loop is dead". Worth an outcome test at
both sites once the entry above is decided; not worth changing one without the other.

Distinct from decision 128, which withdrew the review's *ownership* note about these sites: with a
single `state.battle` slot, a running battle genuinely occupies the world and those guards are right
to say so. Only the concluded case is wrong.

## 2026-09-03 — independent review of slice 4c (OPP-16), PR 9

Four-lens review of the settlement guard, the division budget and the dispatcher's tests. One
blocking finding went back to analysis as cycle 1: decision 102 removes the only path that ever
cleared a concluded battle, so an unowned one stands forever and silently kills encounter spawning
and `battle.start` for the rest of the session. What follows is everything else — judged not worth
stopping the pipeline for, with when it starts to matter.

Two of these were confirmed by injecting the fault and watching the suite stay green, so they are
gaps in what the tests defend rather than opinions about them.

### Guarantees the suite does not defend

- **Decision 101's write-order guarantee is undefended.** Hoisting
  `const settled = settleOwnedEncounter(state);` from `packages/sim/src/world/dispatch.ts:84` to
  immediately after the `no-voyage-running` guard passes **435 of 435**. No test constructs a
  *refused* port with a concluded owned battle in state: the `not-at-island` test
  (`tests/world/dispatch.test.ts:398`) has `state.battle === null`, the `battle-running` test
  (`:335`) uses a running battle for which `settleOwnedEncounter` returns `[]` anyway, and
  `no-voyage-running` has no voyage. The mutant would settle the battle, strike the brigand off
  `state.ships`, materialise plunder into the chest and then return `{status:'rejected'}` — a
  rejected command that mutated hashed state, which is the exact class this slice exists to close.
  One test closes it: an owned concluded battle plus `legIndex` at the open-water index, asserting
  `not-at-island` **and** `state.battle` unchanged.
- **`unknown-ship` is unasserted at all three world-dispatcher sites.** Changing every
  `refused('unknown-ship')` in `packages/sim/src/world/dispatch.ts` (lines 51, 106, 136) to a
  different reason passes **435 of 435**. Every world command in the suite is dispatched with a
  real `ship.id`, and the repo's only `unknown-ship` assertion
  (`tests/harness/battle.test.ts:248`) exercises the *battle* dispatcher. The slice's sweep of the
  rejection union describes finding `not-at-island` as the ninth survivor; it missed this one, and
  it is the same "asserted somewhere, assumed asserted everywhere" shape the sweep was written to
  catch. Also still unexercised: `charter`'s pass-through `refused(charted)` at `dispatch.ts:54`,
  and `port`'s first `not-at-island` at `:79`, whose `pointId === undefined` arm no fixture reaches.

### Tests that pass for a weaker reason than they appear to

- **The crew-cut test the analysis says was repaired was not touched.** The entry states the test
  "now divides 1003 PoE against literal expected values of 250 and 301 rather than production's
  formula" — that describes the **new** test at `tests/world/dispatch.test.ts:172`. The one it
  names still exists untouched at `tests/world/division.test.ts:83-96`, with both original defects:
  it recomputes its expectation with production's own formula, and `CHEST_POE = 1000` against 250‰
  and 400‰ divides exactly, so `floor`, `ceil` and `round` all agree. The repo now carries two
  crew-cut tests, one strong and one worthless, in different files — and a developer opening
  `division.test.ts` finds the bad pattern. The recompute should go; the
  `crewCut + pirateShare + crewShare === CHEST_POE` invariant on line 95 is genuine and worth
  keeping.
- **The test named for decision 103 asserts that zero equals zero.**
  `tests/world/division.test.ts:126-134` fills a 13 500 kg sloop to exactly 13 500 000 g, so
  `freeHoldOf` is `0` before the division and `0` after. It does kill the target mutant — the old
  floor-twice code gives `13499`, hence `1` before and `0` after — but it survives anything that
  pushes both sides past the `Math.max(…, 0)` clamp. Dropping the filler by ~100 units would put
  both sides at a non-zero value and make it a measurement rather than a coincidence.
- **`tests/world/division.test.ts:136-146` compares production with itself.**
  `assert.deepEqual(boughtOneHempOf(undivided, …), boughtOneHempOf(divided, …))` asserts the two
  sides agree, never what the answer is; both are `{status:'rejected', reason:'hold-full'}` today.
  Deleting the `hold-full` guard in `buyCommodity` outright leaves both sides an identical
  `accepted` and the test still passes. The guard is covered elsewhere
  (`tests/world/market.test.ts:284`), so nothing is unprotected — but the test that names the hold
  is not the one defending it. One added line asserting the literal outcome removes the
  self-reference.
- **Both new settlement tests port from leg 0**, i.e. the island the voyage departed
  (`tests/world/encounter.test.ts:282-311` and `:313-338`). `sailingState` leaves `legIndex` at 0,
  so `assert.equal(state.pirate?.atIslandId, 'alkaid')` coincides with the origin, and a mutant
  hard-coding the ported island to the voyage's origin passes both. It dies at
  `tests/world/dispatch.test.ts:104`, so the property is covered — but the two tests written for
  decision 101 never exercise an actual arrival, which is the state a settlement is meant to
  accompany.
- **One rounding mutant survives the sharpened crew-cut fixture.**
  `tests/world/dispatch.test.ts:29-31` uses `CHEST_POE = 1003`, giving `floor(250.75) = 250` — which
  kills `floor`→`round` — but `floor(301.2) = 301`, which `round` also produces. A chest whose two
  remainders both exceed one half would kill `round` on both fields. `ceil` and the field swap are
  correctly killed.
- **Decision 102's leak is pinned for `stepWorld` but not for `port`.**
  `tests/world/encounter.test.ts:253` is a good test of the narrowing — the `legTicks` assertion
  distinguishes "settled silently" from "stepped the voyage" — but `settleOwnedEncounter` has a
  second caller and nothing drives an unowned concluded battle through `voyage.port`. Dropping the
  ownership predicate at that call site alone would pass the suite.

### Ownership is a concept in one place and not the other three

- `packages/sim/src/world/dispatch.ts:76`, `packages/sim/src/world/voyage.ts:57` and
  `packages/sim/src/world/encounter.ts:38` all still read raw `state.battle`:

  ```ts
  if (state.battle !== null && state.battle.outcome === 'running') return refused('battle-running');
  ```

  So while one ship's hand-started battle is *running*, an unrelated ship's voyage neither advances
  nor may port, and spawns nothing — for a fight `stepWorld` now declares none of its business. Not
  a regression, since both predicates are unchanged, but decision 102 introduces the ownership rule
  and these three sites contradict it. A single `ownedEncounterOf`-shaped predicate would serve all
  four, and this wants deciding deliberately rather than by omission — it is adjacent to the
  blocking finding and will likely be touched by the same repair.

### The harness boundary test

- **`tests/harness/world-commands.test.ts` should have switched to `pillage-loop`.** The judgement
  call was flagged deliberately, and the reasoning against it is sound as far as it goes, but the
  file is the **only** place in the repo that sends a world command over the wire — everything else
  drives the loop in-process through `createScenarioSim`. Its unique job is the boundary contract,
  and the pinned refusals cannot test it, because every one of the six fires *before* its payload is
  read: `world.start` bails at `balance-missing` before `isIslandId`, and the other five bail at
  `world-not-started`, the first line of their handler. `islandId`, `shipId`, `commodityId` and
  `units` are all inert, so a parser that accepted the schema and then dropped `units` passes all
  six. Five of the six expect the same reason, so the router is unpinned too — routing
  `voyage.port` into `divide()` still yields `world-not-started`. The stated cost is smaller than
  feared: `PILLAGE_LOOP_SCENARIO` is already exported from `packages/harness/src/index.ts`, and the
  malformed half of the file shares only `harness`, `session` and `dispatch`. Two riders if it is
  switched: the six tests share one mutable session created in `before()` and are order-independent
  only because nothing currently mutates, so per-test sessions become necessary; and
  `{ op: 'market.sell', …, units: 0 }` on line 18 is an accepted no-op under a started world.

### The analysis record

- **Decision 88's rationale was edited in place**, against the convention this document states
  twice — "per the append-don't-rewrite convention" (line 996) and "this document appends rather
  than rewrites" (line 1783) — and follows everywhere else. Decision 31's rationale was found false
  and decision 39's needed amending; both original rows still stand, with the correction appended.
  This is the first row overwritten. Two live citations now quote text that no longer exists in
  row 88: line 2128 ("makes division mass-neutral and removes any need for a capacity check when
  the chest empties") and decision 103's own rationale at line 2268 ("which is what decision 88
  asserted without it being so"). The slice entry announces the edit but does not name the
  convention it overrides or why. Restoring 88's original text and letting the correction plus
  decision 103 carry the fix would match how 31 and 39 were handled.
- **`ISSUES.md`'s own headline count is stale.** Line 11 says `npm run check` is 417/417; that was
  true at `cd8834d`, before the last two commits added 18 tests. The analysis document says 435,
  and 435 is what the suite reports.

### An invariant that drifted out from under this change

- **`tests/world/soak.test.ts:164-166` no longer matches the definition it guards.**

  ```ts
  function ladenKgOf(ship: ShipState): number {
    return ship.cargoUnits + ship.bootyCargoUnits + cargoLotsMassKgOf(ship.cargo);
  }
  ```

  `freeHoldOf` now charges `stowedMassKgOf(ship.cargo, ship.bootyCargo)` — both arrays, floored
  once — while `ladenKgOf` omits `bootyCargo` entirely and floors the hold alone, so `breachesOf`'s
  `laden > capacity` check cannot see chest mass at all. The drift began when the chest joined the
  budget in slice 4, but decision 103 is what makes it visibly wrong, and this is the one invariant
  that would otherwise catch the over-capacity state `ISSUES.md` already documents.

### Verified sound, recorded so the next review need not redo it

The three defects slice 4 queued are genuinely closed, none by a test that pins the old behaviour.
Decision 101's write order is correct — all five refusals return before `settleOwnedEncounter`.
Double settlement is impossible: `settleEncounter` nulls `state.battle` and `port` nulls
`state.voyage`, and commands never run inside a tick. Decision 103's arithmetic errs safely —
`floor((h+c)/1000) >= floor(h/1000) + floor(c/1000)` always, so the new count is stricter and no
caller can be pushed over a hold's limit; both callers are comparisons and the numbers stay three
orders of magnitude inside `MAX_SAFE_INTEGER`. Event order is safe for replay, because `hash()` and
`save()` serialise state, which holds no event log, and `SCHEMA_VERSION` is unchanged. Decision 102
is a legitimate reading of decision 83, and settling from inside a command matches existing
precedent. `npm run check` was re-run from cold at 435/435.

## 2026-09-02 — development of slice 4c (OPP-11), the settlement guard and the division budget

The three world defects the review and the physical test of PR 5 queued are closed: porting settles a
concluded battle the voyage owns, `stepWorld` settles only a battle the voyaging ship stands in, and
the shared mass budget is counted in grams and floored once. `npm run check` is 435/435 exit 0 from
cold. What follows is what closing them turned up.

### The hold under-accounts a purchase, and that is where the kilogram is really invented

`buyCommodity` measures a purchase with `massKgOf`, which floors that one purchase's grams on its own,
so three `small-cannon-ball` cost the hold 21 kg of budget against 21.3 kg of iron. With the shared
budget now counted in grams, the review's own reproduction — 3 cannon balls and 13429 kg of filler in
the hold, 7 cannon balls in the chest — measures 13501 kg in a 13500 kg hold *before* it divides and
13501 kg after. The division is mass-neutral now; the dock is what let the ship past its capacity.

Not blocking: `freeHoldOf` clamps at zero, so an over-full ship refuses further cargo rather than
misbehaving, and the accounting no longer moves under the ship — a `market.buy` of one unit gets the
same answer either side of a division, which is the symptom the physical test measured. It starts to
matter when a second non-whole-kilogram commodity exists, or when the hold's mass is displayed to a
player who can add it up.

### The review's settlement probe is not what the review's predicate closes

The review demonstrated the ownership defect on the pillage-loop scenario — chart an `evade` voyage,
hand-start a battle, disengage — and offered
`battle.ships.some((s) => s.shipId === voyage.shipId)` as the one-predicate fix. Driven, that scenario
carries a single player ship, and `battle.start` picks the first player ship and the first brigand, so
the hand-started battle's berths are ships 2 and 3 while the voyage sails ship 2: the predicate is
true and the world settles the battle exactly as before. The predicate is still the right rule — see
decision 102 — but the case it closes is a concluded battle the voyaging ship is *not* standing in,
not the one the review sailed.

## 2026-09-02 — physical test of slice 4 (OPP-11), PR 5

Three threads drove real `pp-harness` processes over stdio. Nothing blocked: the MVP loop runs end to
end over the wire, the booty chest rules hold, and determinism survives a process boundary at 55 cut
points with a verified-sensitive negative control. `npm run check` is 412/412 exit 0 from cold on the
merged result. What follows is what only a played session could produce.

### The pillage is a gauntlet, and now there are numbers

540 real voyages — six destinations × three voyage types × thirty seeds — confirm the review's static
arithmetic by sailing it. The six-leg Keris route averages **4.50 battles** against the 4.61 the
review predicted and the "about one and a half" its `_sources` claims; the eight-leg McGuffin's route
averages **6.50** against a predicted 6.60. Observed per-leg rates track `550 + difficulty/2` across
every band, and **every one of the 60 legs sailed at difficulty 875 or above carried a brigand** — the
arrival leg at McGuffin's Isle is a mathematical certainty and was hit 30 times out of 30. The
quietest of thirty Keris pillages still fought once.

The contrast between voyage types is real and larger than the tuning prose suggests. Evade is
absolute: 180 evade voyages, zero encounters, and because `encounterChanceOf` returns 0 before
touching the RNG the `world.encounter` stream is never even created, so tick counts are identical
across all thirty seeds. Trade is a quieter pillage rather than a different activity — 1.90 battles on
the Keris route against 4.50 — but no trade voyage in 180 fought on every leg, where 30 of 180
pillages did. The same route costs 26.7 minutes evading, 40.9 trading and 61.6 pillaging, because a
battle freezes the voyage.

Recorded as a balance note, not a defect. Nothing was retuned. The number may still be the one
wanted; the sentence justifying it is not.

### A pillage is a poor trade, and losing is nearly free but not quite

Across 180 pillages the player took a mean of **71 PoE** into the booty chest, and **145 of 180 ended
with an empty chest**. Sixty first encounters were isolated and diffed across the whole battle
including settlement: over 55 losses the complete set of fields that ever change is `shipCount`,
`damageTakenSmallMicro` and `meleeDamageSmallMicro`. No coin, cargo, chest, crew or rum ever moves on
a loss, and the brigand is struck off identically on a win and a loss.

One correction to the review, which recorded that a loss costs nothing and evade therefore buys
nothing. A loss leaves **permanent melee damage**: `meleeDamageSmallMicro` is only ever incremented
and nothing in the codebase decreases it, while hull damage does heal through carpentry. The win rate
decays inside a single voyage — 17.3% on the first battle, 3.7% on the second, 0% by the third — so
evade buys 57% of the voyage time back and a ship whose boarding strength is not permanently spent.
What a loss still does not risk is coin, cargo or the voyage.

(The player ship submits no `battle.plan` in this scenario, so those win rates are a passive pirate's.
The encounter frequency, the tick costs and the loss-costs-nothing result come from `rollEncounter`
and `settleEncounter` and are independent of combat skill.)

### `session.save` does not exist over the protocol

`packages/harness/src/methods/session.ts` exports `session.new` and `session.load` and nothing else;
`session.save` answers `-32601 method-unknown`. Decision 84 exists because "save, reload, identical
hash" was undrivable over the protocol, and it is still only half closed — an agent can load a save
but cannot produce one under that name. `tests/harness/session-load.test.ts` does not notice because
it builds a `Sim` in-process and calls `sim.save()`.

Not blocking, because a byte-faithful save is obtainable anyway: `serialise()` is `canonicalJson`
of the state, so `state.get {pointer:""}` put through `JSON.stringify` round-trips exactly, verified
by re-dumping a loaded session with key order preserved. Both test threads used that route.
`docs/wiki-map/06-stack-decision.md` also names `session.close` and a `session.load {path}` form,
neither of which exists.

### Half the plundered coin never reaches the booty chest

`battle.ended` reported `bootyPoe: 770`, but the hull came out of the battle with `bootyPoe: 385`
**and `poe: 385`**, before any porting or division. `awardBooty` in `packages/sim/src/battle/booty.ts`
does `const shared = Math.floor(roll.poe / 2); winner.poe += shared; winner.bootyPoe += roll.poe -
shared;`. Decision 86's premise is that coin taken is not coin owned until it is divided; half of it
is owned immediately, so `booty.divide` only ever divides half of what a pillage rolls.

**Not a slice-4 regression** — `git log -S` puts that line in `a305574`, slice 3. Slice 4 added
`bootyCargo` beside it without revisiting the coin, which is how the two halves came to disagree.

### Decision 89's justification is unreachable with the shipped tuning

The `booty.divide` guard was widened to accept a chest holding goods but no coin, because "a roll can
pay no coin". With `booty` as shipped — `brigandPoeBase` 800, `brigandPoePerMightMilli` 1000,
`brigandPoeVariancePerMille` 250 — `rollBooty` yields 600 to 1000 PoE and `awardBooty` always leaves
at least 300 in the chest, so that case cannot occur. Every won encounter observed produced `bootyPoe`
between 302 and 843. The widened guard is correct and harmless; only its stated reason is dead.

### The booty-chest mass gain recurs per division

The review reported `booty.divide` gaining a kilogram once. Driven over the protocol it gains one
**per division**: on seed 621 a first division took a 70 kg pair of lots to 71 and a second took 141
to 142. Conditions stay narrow — `small-cannon-ball` in both hold and chest with each side's gram
remainder at or above 500 — and no goods are created or destroyed, only the accounted mass. The
sim's own capacity accounting was shown to move, not just the arithmetic: at 13429 kg of filler a
`market.buy` of 1 unit is accepted before the division and refused `hold-full` after it, with nothing
having entered or left the ship.

### A zero-unit trade is accepted and emits an event

`{"op":"market.buy","units":0}` returns accepted with a `market.traded` event carrying `units: 0`
and `poe: 0`. The state hash does not move, so it mutates nothing. Cosmetic.

### A slice-4 voyage cannot be driven in one protocol call

A full pillage runs 50,000 to 400,000 ticks and the marker domain emits one `marker.drifted` per
tick, so a whole voyage in a single `sim.runUntil` trips `MAX_EVENTS_PER_RESPONSE` (100,000) in
`packages/harness/src/limits.ts`. That is the guard working, not a defect, but anyone scripting a
voyage over the protocol has to chunk, and the `pp-sim-harness` skill does not say so next to its
existing advice about stepping `bilge-session` in small spans.

### `pp-sim-harness`'s documentation has drifted

It states that `session.new` reports `schemaVersion` 4 — it reports 5. It says three scenarios exist;
there are four, and `pillage-loop` is the missing one. Its method table has no `session.load`, and its
transcripts still show hashes from schema 3 and 4.

## 2026-09-02 — independent review of slice 4 (PR 5, cycle 0)

A four-lens review of PR 5. Nothing blocked: `npm run check` is 383/383 from cold on two independent
worktrees, both CI jobs are green, the re-blessed fixtures were independently reproduced and hide
nothing, and the layering gates were proved to enforce over the new `world/` subdirectory. What
follows is everything the four lenses substantiated and judged not worth stopping for. Two clusters —
the settlement guard and the untested dispatcher seam — are queued as a follow-up development task
rather than left here, because they are small and slice 5 will copy whatever it finds.

### `stepWorld`'s guard asks whether a voyage is running, not whether it owns the battle

`world/session.ts` guards on `state.voyage === null`; `settleEncounter` never reads `voyage.shipId`.
Decision 83 states the rule as ownership — "a battle nobody sailed into is not the world's to tidy
up" — and the code does not implement that. Demonstrated: on the pillage-loop scenario at seed 2,
charting an `evade` voyage (which can never spawn an encounter, `encounterChanceOf` returns 0), then
hand-starting a battle and disengaging, the world strikes the brigand off a battle no voyage owned.
Slice 3's test passes only because it never has a voyage running. Bounded — it needs a `battle.start`
issued mid-voyage, which no scenario drives — and closed by one predicate,
`battle.ships.some((s) => s.shipId === voyage.shipId)`.

### A concluded battle can be orphaned by `battle.disengage` followed by `voyage.port`

Same seam. `port()` refuses only a *running* battle, and `stepWorld` returns early once
`voyage === null`, so a battle that concluded by disengagement and was not settled in that tick
survives the voyage that met it. While orphaned, `battle.start` is refused `battle-already-running`,
`rollEncounter` returns nothing because `state.battle !== null`, and the brigand hull sits in
`state.ships`. It self-heals on the first tick of the next voyage, at the cost of one tick of that
voyage's `stepVoyage`. A second lens reached the same guard from the other side: deleting `port()`'s
`battle-running` check passes the whole suite and strands the world permanently, because nothing
asserts that reason.

### `booty.divide` is not mass-neutral, so decision 88's reason for having no capacity check is wrong

Mass is accounted as `floor(sum of grams / 1000)` per lot array, and `freeHoldOf` floors the hold and
the chest separately. Merging the chest into the hold re-floors the combined sum, which can land 1 kg
higher. `small-cannon-ball` at 7100 g is the only commodity whose mass is not a whole kilogram, and it
is buyable and plunderable. Demonstrated: a sloop with 3 cannonballs and 13430 hemp in the hold and 7
cannonballs in the chest divides to 13501 kg against a 13500 kg hold. One kilogram in 13500, and the
soak invariant cannot see it because `freeHoldOf` clamps at zero — but decision 88 claims the shared
budget "makes division mass-neutral and removes any need for a capacity check when the chest empties",
and that justification does not hold.

### The rule this slice was corrected to enforce is the one rule its tests do not check

`tests/world/division.test.ts`'s "plunder cannot be sold before it is divided" asserts only that the
result was `rejected`. The fixture sets `state.markets = []`, so `trade()` bails at
`island-has-no-market` and never reaches `sellCommodity`: the test would pass if the hold/chest split
did not exist. Confirmed by mutation — making `sellCommodity` fall back to `ship.bootyCargo`, which is
precisely what decisions 86-89 forbid, passes all 383 tests. The production code is correct; the test
protecting it is not. Assert the reason is `insufficient-cargo` and give the fixture a real market.

### The dispatcher is untested as a dispatcher

Thirty injected faults, full suite per fault: sixteen died, fourteen survived, and the survivors
cluster in one place. Five of the eight new events appear in no test at all — `world.started`,
`voyage.charted`, `voyage.ported`, `market.traded`, `booty.divided` — so the traded side can be
inverted, the leg count zeroed, the ported island hard-coded, and `crewCutPoe` and `pirateSharePoe`
swapped, all with a green suite. Nine of the eighteen new rejection reasons are never asserted by
name. `tests/harness/world-commands.test.ts`'s six well-shaped cases assert only that the status is
one of `accepted` or `rejected`, so mutating `applyWorldCommand` to refuse every world command
unconditionally still passes it 17/17. The arithmetic is well defended; the protocol surface is not.

### Rounding is exercised nowhere in the new money or mass arithmetic

Four surviving mutants share one shape. The crew-cut test recomputes its expected value with
production's own formula *and* picks numbers that divide exactly, so `floor` to `ceil` is invisible.
`massKgOf` `floor` to `ceil` survives because `small-cannon-ball` — again, the only non-whole-kilogram
commodity — is never bought or sold in any test. Dropping the floor on plundered units survives even
though the truncation is genuinely reached (soak seed 95028 draws 5 cannonballs from a 40 kg chest),
because the test asserts mass bounds and never asserts the unit count is an integer, so fractional
cargo lots would flow into the hash unnoticed. Dropping the floor in `legTicksRequiredOf` survives
only because the declared speeds are all round.

### `orientationCostOf` decides 37% of real legs and no test measures it

Decision 76's whole point is which of the two league costs a leg pays. The 40% ratio is tested only by
handing the constant to `legTicksRequiredOf` directly; no test ever measures a voyage's duration.
Making `orientationCostOf` always return the diagonal cost passes 383/383. It is not a dead path —
across island pairs the routes use 52 horizontal legs against 88 diagonal ones, so a third of real
legs would silently run 40% faster.

### Six `_sources` entries promise an outcome the tuning does not deliver

The same defect class as `tradeSpawnPenaltyPerMille`, which this slice already found and fixed. The
bijection test is real — it derives both sides independently and bites in both directions — but it
asserts existence, not accuracy.

- `world.encounterChancePerMille` says a quarter of legs carrying a brigand "makes a six-leg pillage
  average about one and a half battles, which is a voyage rather than a gauntlet". A pillage always
  adds the difficulty term *and* the 300 pillage bonus, so 250 is never the per-leg chance: the
  minimum anywhere on the chart is 550/1000 and the maximum 1000/1000. The only six-leg route out of
  Alkaid carries 612, 675, 737, 800, 862, 925 — **4.61 expected battles**. The eight-leg route to
  `mcguffins-isle` reaches 6.60 with the last leg a certainty. It is the gauntlet the entry denies.
- `world.encounterDifficultyWeightPerMille` says "up to half of its base"; the term adds up to +500
  against a base of 250, which is twice the base, not half.
- `world.brigandCrewCount` says 5 sits "just below" the player's crew so an even fight tilts to the
  player. A commissioned sloop defaults to `swabbieStaffing`, which is also 5.
- `market.rawBasePricePoe` says a sloop's hold of raw goods is "the same order as a single brigand's
  purse". The hold is 162,000 PoE; the purse is 800.
- `market.startingStockUnits` says a dock opens with enough stock to fill a sloop's hold without
  emptying the island. Buying every unit of every commodity at Alkaid yields 10,050 kg against a
  13,500 kg hold.
- `world.startingPoe` says 2000 covers a magazine and a little cargo. `small-cannon-ball` is refined
  and spawns nowhere, so it prices at the scarcity premium of 56 PoE; the 40-shot magazine is 2240.

### `session.load` casts rather than validates, so a save that parses is a save that loads

`migrate()` ends in `return current as unknown as WorldState`. Anything past the `schemaVersion` gate
becomes session state: `{"schemaVersion":5}` is accepted and answered with a hash, and the next
`sim.step` dies `internal-error: Cannot read properties of undefined`. The existing test refuses `{}`
only for want of a `schemaVersion`. Two related edges: malformed saves surface as `internal-error`
(-32603) rather than `invalid-params`, because `statusOf()` hashes outside `loadSim`'s try/catch; and
a save whose `voyage.route` names a league point that does not exist loads cleanly and then throws
from `stepVoyage`. **Corrected by the physical test after the merge:** the review measured that
second edge on the pre-merge branch and reported that the session advanced a tick and lost its
events. It does not, on the merged tree. Slice 2b's `atomically` wrapper around
`stepWithinEventBudget` arrived with `agent/develop` and restores the session exactly — driven over
the protocol, `sim.step` answers `internal-error` and `/tick` and `/voyage` are both unchanged. The
same holds for an unknown `shipClass` and for a bare `{"schemaVersion":5}`. What survives is only
that these surface as `internal-error` rather than `invalid-params`, and that a structurally invalid
save is accepted at load time at all. Local, single-player and self-inflicted, but the RPC contract
says bad params yield
`invalid-params` and this slice's own tests show that intent. The `schemaVersion` gate itself is
sound: 999, 1e308, 0, -1, 4.5, absent, non-numeric and non-string were each refused cleanly, and no
prototype-pollution path exists — every domain lookup table is deliberately null-prototype.

### The sim's own command layer accepts negative quantities

`buyCommodity` and `sellCommodity` never check that units are non-negative, and neither does
`applyWorldCommand`. Every guard reads the wrong way round for a negative: the stock check, the purse
check and the mass check all pass trivially. Called directly, `market.buy` of -1000 cannonballs is
accepted, mints 56,000 PoE and writes a negative lot that makes `freeHoldOf` exceed capacity.
Unreachable over the protocol — `parseCommand`'s `requiredCount` refuses it, and `replay.verify` goes
through the same parser — which is why it is recorded rather than returned. It is worth noting because
every other domain rule is enforced in the sim, and `Sim.dispatch`, `applyWorldCommand`,
`buyCommodity` and `sellCommodity` are all public API of `@opp/sim`.

### Migration 4 silently drops `balance` from a real v4 save

The migration spreads the save and sets `balance: null`. A genuine v4 save keeps its ships and puzzle
but comes back with no balance, and the migrated session then refuses `world.start` with
`balance-missing`. This matches migrations 2 and 3 and is probably deliberate, since the `Balance`
shape changed again this slice — but it is silent, and nothing tests it: `packages/fixtures/saves/`
holds only v2 and v3 saves, and `tests/sim/migration.test.ts` fabricates its v4 by relabelling a v5
state of a sim with no ships and no balance.

### The battle layer now depends on the world layer

`battle/booty.ts` imports `cargoLotsMassKgOf` from `../world/cargo.ts` so `freeHoldOf` can count lots.
Decision 80 meant to keep the world's denomination out of the battle layer entirely; the mass
accounting now flows the other way. Both gates accept it, so nothing is broken — recorded because the
decision says otherwise.

### Small duplications in `world/`

`GRAMS_PER_KG` is declared in both `world/cargo.ts` and `world/encounter.ts`, and `encounter.ts`
open-codes the inverse of `massKgOf` rather than sharing it. The island predicate exists twice, as
`isIsland` in `voyage.ts` and `isIslandId` in `dispatch.ts`, and `charter()` calls one before
`chartVoyage` re-checks with the other. In `tests/world/soak.test.ts`, `ladenKgOf` re-implements
`freeHoldOf`'s arithmetic but omits the booty chest, and `breachesOf` scans the hold for negative lots
but not the chest; no reachable miss was found across the 12 soak seeds, so it is latent rather than
live.

### A lost encounter costs the player nothing

The brigand is deleted on a loss exactly as on a win, so a `pillage` voyage carries no downside beyond
forgone booty and `evade` buys nothing. Unspecified in decisions 74-89 rather than contradicted by
them, and a balance question rather than a defect.

## 2026-09-02 — development of slice 4 (OPP-11)

The world, the voyage and the port economy. What follows is what the work turned up that was not
worth stopping for.

### `session.load` opens a throwaway sim and overwrites it

`SessionRegistry.open` can only build a session around a sim it creates itself from a seed and a
scenario name, so `session.load` opens a default-scenario session at seed 0 and then assigns over
`session.sim` with the loaded one. The throwaway sim is built and discarded on every load, and the
field assignment reaches around the registry's own constructor. A `SessionRegistry.adopt(sim)` — with
`open` refactored to delegate to it — removes both. It is invisible from the protocol and costs one
wasted `Sim.create` per load, so it is tidiness rather than a defect. It starts to matter if opening a
session ever acquires a cost or an invariant beyond building the sim.

### `parseCommand` validates ship-class membership but not island, commodity or voyage type

`parseShipClass` checks the value against the declared class ids and refuses `invalid-params`; the six
world commands check only that the field is a string and let the simulation answer `unknown-island`,
`unknown-commodity` or `unknown-voyage-type`. Both are defensible — the second is arguably better,
since it keeps domain knowledge in the domain — but the protocol now answers the same kind of mistake
in two different ways depending on which command you sent. Worth settling in one direction the next
time either file is opened.

### `Replay` still carries no schema version, and the schema moved again

Recorded at slice 2's review: a replay recorded before a schema bump reports `divergedAtTick: 0`,
which is indistinguishable from a real determinism bug, because `Replay` carries no schema version
although `session.new` already returns one. Schema 5 has now reproduced exactly that, and the fixtures
were re-recorded. The finding is unchanged and its cost is paid once per schema bump, in confusion
rather than in wrong behaviour.

### One `_sources` entry does not open with a provenance register

`bilging.vegasMultiplier` reads "the low end of the published range at least 5, maybe 6-7", where every
other entry opens `published`, `invented` or `scope decision`. A test asserting the bijection between
tuning keys and `_sources` entries now exists and passes over all 62 keys; a test asserting the
register could not be added without either rewriting that entry's provenance — which would be
inventing history — or weakening the assertion to accept anything. Rewriting it is a one-line job for
whoever knows what that number's provenance really is.

### `SEA_BATTLE_SCENARIO` is not exported from the harness index

`BILGE_SCENARIO` and `DEFAULT_SCENARIO` are, and `PILLAGE_LOOP_SCENARIO` now is; `SEA_BATTLE_SCENARIO`
has to be imported from `scenarios.ts` directly, which `tests/harness/battle.test.ts` does. Pre-existing,
noticed while adding the fourth scenario.

### Charting to the island you are standing on is refused as `no-route`

The league graph is fully connected, so `routeBetween` between two real islands is never empty; the
only degenerate case reachable in practice is a destination equal to the origin, which yields a
one-point, zero-leg route. That is refused as `no-route` so the dispatcher never stores a voyage with
no legs. The reason names the wrong thing — the route exists and is trivial — but inventing a
`already-at-that-island` reason for a case no scenario reaches would add a member decision 59 says to
leave out.

### The encounter roll fires on the destination league point too

A voyage rolls for a brigand on every leg it reaches, including the last one, so it is possible to be
intercepted on the doorstep of the island you were sailing to. Nothing in the wiki excludes it — a
ship is at sea until it ports, and porting is a command — and excluding it would need a special case
for the final leg. Recorded because it looks like an off-by-one until you know it is deliberate.
## 2026-09-02 — physical test of slice 2b (OPP-13), PR 4

The test stage drove the real harness over stdio and reproduced every behaviour the slice claims;
nothing blocked. Two entries below refine findings the review had already logged, with numbers that
only a played session could produce, and one records a merge the stage had to make.

### Crabs are reachable, but at about a fourteenth of `crabSpawnPerMille`
The review measured 0 crabs in 5 seeds x 400 swaps and left open whether they are reachable at all.
They are. Across 8 seeds x 400 moves at star 7 on a fully flooded board, **5 crabs spawned, climbed
and cleared**, one paying a 13-point step, and every one behaved as decision 47 describes. The gap
is now measured rather than inferred: `waterRowsOf` keeps three dry rows at any flood level, so
`waterLineRow` bottoms out at 3, and `applyGravity` stacks a step's vacancies at the top of the
column, so a refill lands at or below the water line only when one column loses 4 or more cells in a
single settle step. Over 838 settle steps that put **229 of 4828 critter draws — 4.74 per cent —**
below the water line, predicting 3.4 crabs against the 5 seen. The effective rate is about **1 per
mille of refills against a stated 15**, where the nominal expectation over those draws was 72. It
does not block: the crab works, it is merely far rarer than its constant says. It starts to matter
when the crab bonus is meant to be a scoring lever a player can plan around, and the fix is a
product choice between raising `crabSpawnPerMille`, letting a dry crab-band draw fall through to
another critter, and spawning crabs by a rule other than the refill vacancy.

### A crab is never visible between moves at the current tuning
Because eligible vacancies sit on row 3 and `climbCrabs` runs before `crabsAboveWaterLine` inside
the same settle step, a crab spawned at the water line is cleared on the next step of the same
resolve. Across 2000 played moves the board carried a crab between moves **zero** times. The wiki's
"immovable, denies its square until it climbs out" is therefore not observable today. Non-blocking
for the same reason as the entry above, and the same decision fixes both.

### The stale-`refilled` overwrite was not reproduced in play
No crab vanished mid-water without a `crabs` entry and without paying a bonus. With 5 crabs in the
whole sample this excludes nothing; `resolve.ts:61-67` is unchanged and the review's finding stands.

### PR 4 was merged with a merge commit, not a squash — again
Squashing PR 3 was already declined for this reason, and this is the recurrence it predicted: PR 4
arrived `CONFLICTING` because slice 3's squash-minted SHAs left this branch's base behind, and
slices 4 and 5 are branched from the same chain. The queue-test skill says `--squash`; this stage
merged instead. **This is a pipeline policy the human owns**, and it is the second slice to deviate.

### A clean auto-merge silently dropped `bilge.poke`
Merging `agent/develop` in, git resolved `sim.ts` without conflict onto slice 3's explicit command
routing, which lists `puzzle.start` and `bilge.swap` — slice 2b had reached `applyPuzzleCommand`
through a fallthrough, so `bilge.poke` fell into `applyBattleCommand`. The typecheck caught it and
`e40293d` routes it explicitly. Recorded because the class of bug is invisible to a conflict count:
the merge reported eleven conflicts and this was in none of them.

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

## 2026-09-02 — physical test of the slice 3 repair (PR 3, cycle 1)

The test stage drove a live harness in an isolated worktree across four parallel threads: the
ship-class guard, the v3 migration, full sea battles, and determinism. Nothing in the three repairs
blocked. The one thing that did block — an unmergeable PR — was resolved in the stage and is the
first entry below, because its cause is a pipeline policy rather than a defect in this slice.

### Squash-merging a slice detaches its history and breaks every slice branched from it

This is the finding with the longest reach, and it needs a human decision.

PR 2 was squash-merged into `agent/develop` as `eca8058`. Slice 3 branched from slice 2's feature
branch and carries its original commits through the merge at `5575426`. Because the squash minted new
SHAs, git saw slice 2's entire change set arriving independently on both sides and reported PR 3 as
`CONFLICTING` across twenty-one files, six of them in `packages/sim/src`. None of it was real:
`agent/develop`'s tree is identical to slice 2's feature tip, and resolving every conflict in favour
of the feature branch reproduces `6d491e9`'s tree byte for byte.

The queue-test skill instructs `gh pr merge --squash`. Following it here would have detached slice 3's
history the same way, and **slices 4 and 5 are branched from slice 3** — they would inherit a strictly
larger version of this conflict. Slice 2b, branched from slice 2, will hit it independently. This
stage therefore merged PR 3 with a merge commit instead, which costs nothing and stops the
recurrence, and is recorded in the analysis document as a deliberate deviation.

What needs deciding: whether the queue-test skill should stop saying `--squash`. Changing a skill is
the human's call, not an agent's, so it is raised here rather than edited. It starts to matter the
moment the next slice reaches this stage, which is now.

### The sim-side ship-class guard is unreachable over the protocol

The repair added two guards. `parseShipClass` in `packages/harness/src/commands.ts` throws first, so
every poisoned commission arriving over JSON-RPC comes back as `-32602` / `invalid-params` and the
sim-side guard at `packages/sim/src/battle/dispatch.ts:23` never returns its
`{"status":"rejected","reason":"unknown-ship"}`. This confirms from the outside what the review
established by reverting edits in isolation: the two guards pin each other's disjunction, not either
half. It is defence in depth on purpose and the `RangeError` throws still cover the `deserialise` and
`Sim.restore` doors, so nothing is wrong — but no test distinguishes the halves, and a tidying pass
would meet no resistance.

### The eight prototype member names are twelve

Every record of this repair — the analysis, the review, the task files — says "the eight
`Object.prototype` member names". `Object.getOwnPropertyNames(Object.prototype)` returns twelve on
node 24.18.0; the four missed are `__defineGetter__`, `__defineSetter__`, `__lookupGetter__` and
`__lookupSetter__`. The guard refuses all twelve, so the code is fine and only the description was
narrow. It matters if anyone ever writes a test from the prose rather than from the prototype.

### `bilge.swap` on a migrated save hides two other rejection reasons

`swapBilge` in `packages/sim/src/puzzle/dispatch.ts` folds two conditions into one reason:
`puzzle === null || state.balance === null` both return `no-puzzle-running`. On a migrated v3 save the
puzzle *is* present and the balance is not, so the message is misleading — the review already noted
that. Driving it found the larger half: because that check runs first, `swap-outside-board` and
`non-integer-coordinate` become **unreachable** on such a save. `{"x":99,"y":99}` and `{"x":11,"y":0}`
both report `no-puzzle-running`. Diagnostic quality only; no state is at risk. It starts to matter
when a client uses the reason to decide whether the input or the session was wrong.

### `MAXIMUM_TURNS = 120` is confirmed unsafe, at one seed in six hundred

Re-measured independently with the cap lifted to 400. The committed 24 seeds all resolve, longest 51
turns on seed 21 — 69 turns of headroom. Over seeds 1 to 600 exactly one battle exceeds the cap:
**168 turns at seed 466, root seed 3690254**, next longest 96. So the "168 turns" figure in the record
is verbatim correct and the committed window dodges it comfortably. Nothing was re-seeded and the cap
was not touched, per the guardrail. It starts to matter the first time anyone widens the seed set.

### `/battle` is not cleared when a battle ends

After `battle.ended`, `battle.plan` and `battle.disengage` report `no-battle-running` while
`battle.start` reports `battle-already-running` — the two cannot both be true of the same state. The
outcome is readable at `/battle/outcome`, which is what a caller should use, so nothing is broken. It
starts to matter when a session is meant to fight a second battle.

### `meleeDamageSmallMicro` is part of `stateHash`

The melee handicap lives in `WorldState` and therefore in the hash. No committed fixture moved,
because `packages/fixtures/replays/` holds only `marker-drift*` and `bilge-session` and nothing there
takes obstacle damage. The first sea-battle replay or golden that anyone records will encode the
post-change value, and re-deriving it later will require this entry to explain why.

### `pp-sim-harness/SKILL.md` transcripts are stale

The skill still shows `schemaVersion` 3 and gives `marker-drift.json` a tick-0 hash of
`5a24289acd81a333` ending at `c05ce3b72f5e5b9f`. The live harness reports `schemaVersion` 4 and that
replay's real trail runs `165150e7121323fa` to `0df21f56de40342e`. The committed fixture and the
running sim agree with each other; only the copied transcript is out of date. It costs an agent a
false lead the first time it asserts on a documented hash.

### A fresh worktree checks the v3 fixture out at 1562 bytes, not 1561

`core.autocrlf` is `true` globally, so the single trailing newline is stored as `\n` and checked out
as `\r\n`. The blob is `e923b3c37240e04b157bd81295f37ef252e4f4d0` at 1561 bytes and `git status`
stays clean. Two separate task files now instruct the next run to verify "1561 bytes", which on a
fresh worktree will look like a clobbered fixture and is not. Verify from the blob, not the working
file.

## 2026-09-02 — independent review of the slice 3 repair (PR 3, cycle 1)

Four lenses over `d5d5c5e..3943f47`. **No blocking findings** — all three repairs do what decisions
64 to 73 say, every red-before claim reproduced, and the trajectory-invariance claim was confirmed
independently over 600 seeds. What follows is what the review found that is not worth stopping for.

### `sim.dispatch` atomicity was deferred to a destination that does not exist

Decision 67 left `sim.dispatch` non-atomic on the grounds that "slice 2b is introducing exactly this
wrapper in `46d90b3`". It is not. That commit is titled "make `sim.step` and `sim.runUntil` atomic"
and its `atomically<T>` helper wraps `stepWithinEventBudget` and `stepUntilPointerEquals` only; at
slice 2b's tip `af6d428` the `sim.dispatch` handler still has no wrapper. The collision the decision
feared could not have happened either — the repair touches no file under
`packages/harness/src/methods/`. The code is right and the reasoning behind it is not, so the
original finding's remainder is now unowned. Practical impact today is nil: `parseCommand` maps the
whole batch before any dispatch, decisions 64 and 66 reject a bad commission before it mutates
anything, and a rejected commission was measured to leave the state hash unmoved. It starts to
matter when a command that mutates before it can fail is added.

### The torn-tick test does not detect a torn tick

`tests/sim/migration.test.ts:127` is red before the fix only because `step(1)` throws — neither of
its assertions runs in the red case. In the green case they cannot fail: `migrations[3]` sets
`balance: null`, so `stepShips` returns at its guard before touching a ship, and the commissioned
hull is inert after 1, 10, 1,000 or 40,000 ticks. The test genuinely pins that a migrated save is
loadable, dispatchable and steppable without throwing, which is worth having. Its name promises
something stronger than it delivers.

### Repair 1's two guards each make the other untestable

Reverting `commands.ts` alone leaves the prototype-key test green, because the null-prototype
`SHIP_CLASSES` makes the *old* guard work. Reverting `classes.ts` alone leaves the whole suite green,
because `SHIP_CLASS_IDS.find` covers it. The suite goes red only when both are reverted, so it pins
the disjunction rather than either half, and anyone deleting one half gets a green suite. Both were
kept deliberately as defence in depth, so this is the cost of that choice rather than a mistake.

### Four of repair 1's five production edits have no coverage

Verified by reverting each in isolation against the full suite, which stayed green at 257 every
time: the sim-side guard at `battle/dispatch.ts:23` (unreachable from tests, because `parseShipClass`
rejects first at the RPC boundary), the three `RangeError` throws in `ship/classes.ts`, and the
null-prototyping of `RAM_SIZE_RANKS`, `BALL_WEIGHTS_MICRO` and `ramDamageOverridesOf`. The
user-visible vulnerability is proven; the hardening behind it is not. The `RangeError`s are exactly
the defence for the `deserialise` and `restore` doors below, so they are the ones worth a test first.

### `shipClassOf`'s guard is dead code by its own declared type

`SHIP_CLASSES` is annotated `Record<ShipClassId, ShipClass>`, so TypeScript believes the lookup at
`ship/classes.ts:103` can never be `undefined`. The guard survives only because the annotation is
narrower than reality — the table is reachable with keys outside `ShipClassId`. A tidying pass that
trusts the type would delete the check and silently reopen the finding this slice just closed.

### `Sim.restore` is a second unvalidated door, not just `deserialise`

The entry below names `deserialise` as the only way an invalid `shipClass` reaches the new
`RangeError`. `Sim.restore` is a second: `cloneWorldState` is a `JSON.parse(canonicalJson(...))` with
no validation, so a snapshot whose `shipClass` was mutated to `toString` restores and then throws
mid-tick with the tick already advanced. Same reachability class as `deserialise` — a library caller
fabricating state; the harness only ever stores sim-produced snapshots — so the conclusion is
unchanged, but the claim of a single door is not accurate.

### A migrated v3 save keeps a permanently inert puzzle

`migrations[2]` nulls `balance` and `puzzle` together; `migrations[3]` nulls `balance` alone, leaving
a structurally valid puzzle that `stepPuzzle` always skips. Nothing crashes and nothing is lost, and
this follows the decided trade-off. The state is legible only by accident, though: `puzzle.start`
honestly reports `balance-missing`, but `bilge.swap` reports `no-puzzle-running` even though
`state.puzzle` is not null, because `puzzle/dispatch.ts:36` conflates the two. A distinct
`balance-missing` reason there would make the terminal state say what it is.

### The melee entry lost the counterfactual that sized the tie-break

The rewrite above supplied the post-fix measurement this register asked for, but it dropped the
sharpest number the old entry carried: re-scoring 900 battles with ties going to the attacker moved
the player's win rate from 51.0% to 33.7% under mirror play and from 43.0% to 10.0% under a
heuristic. That measured the tie-break's *stake*; what replaced it measures the *repair's* effect, a
six-point swing, which is a much smaller number sitting in the same place. The entry exists to hold
that counterfactual until someone decides the tie-break, so it should be re-run and restored.

### Smaller things

- **The fused rock-and-ram outcome is pinned nowhere.** `tests/ship/meters.test.ts:290` drives
  `resolveMovement` but never `turn.ts`, re-implementing its `struckObstacle ? 'obstacle' : 'ram'`
  label rule instead, and `collision.test.ts` covers rock alone and ram alone but never both on one
  ship. Post-fix the duplication is harmless — `source` no longer affects the melee number — so the
  gap is the missing integration check, not the copy.
- **`tests/sim/migration.test.ts:101` is named "keeps everything it already carried"** while its
  corrected assertion now says `balance` is `null`. Rename it.
- **The genuineness pin does not assert `schemaVersion`**, despite being named for it. Harmless — the
  independent-path check catches the old fixture on its own.
- **`turn.ts:26` names its intermediate local `declared`**, where the three other tables and both
  precedents use `declared<TableName>`.
- **The regenerated v3 fixture covers a smaller state shape** than the manufactured one it replaced,
  which carried a `rngStreams["bilge.refill"]` cursor and `puzzle.moves: 1`. Migration never touches
  `rngStreams`, so nothing is at risk; the fixture is simply thinner.
- **`SHIP_CLASSES` now throws on implicit string conversion**, being null-prototype and exported.
  `Object.keys`, spread, `JSON.stringify`, `canonicalJson` and `structuredClone` are all unaffected
  and no consumer does it.
- **`battle.plan`'s `token` and `ship.commission`'s `allegiance` have no sim-side guard**, the
  asymmetry decision 64 closed for `shipClass`. Both are benign — an unknown token is silently a
  no-op, an unknown allegiance is only ever compared — but they are the same shape.
- **`harness/src/json.ts:20` uses `key in right`** rather than `Object.hasOwn`. Probed against five
  prototype-key cases and it produces no wrong answer; style, not a defect.
- **`docs/wiki-map/04-world-ports-economy.md:618` lists wear** among the sources that become
  unbreakable blocks in the boarding puzzle, contradicting `03-ships-sailing-sea-battle.md` and
  decision 61, which exempt it. The code follows 03.

## 2026-09-02 — repair of the slice 3 review findings (cycle 1)

The three blocking findings from the review below are fixed: the prototype key that passed the
ship-class guard, the v3 to v4 migration that left `balance` structurally invalid, and rock damage
being dropped from the melee handicap. The melee entry below now carries the post-fix measurement it
asked for. What follows is what the repair deliberately did not touch, and when each starts to
matter.

### Rock and ram damage are one fused integer

`CollisionOutcome` carries a single `damageTakenSmallMicro` labelled by a single `struckObstacle`
boolean, so a ship that is grounded on a rock and rammed in the same pass reports the whole fused
amount under one source. Decision 71 makes the label irrelevant to every rule that exists today —
obstacle and ram damage both raise the melee handicap now, and nothing else reads the source — so
splitting the field buys nothing here and would widen a slice already three repairs wide. The first
rule that treats a rock differently from a ram has to unfuse them before it can be written.

### `packages/fixtures/saves/` has no owner skill

`pp-golden-state` owns the goldens, `pp-scenario-author` the scenarios and replays,
`pp-replay-triage` the trails. The saves directory is named in passing by the skills around it and
owned by none, and no skill says how one is regenerated — which is how a manufactured v3 fixture was
committed and survived a review unchallenged. The recipe now exists, in the analysis document rather
than in a skill: build the state from the tip of the slice that wrote the schema version, through
`createScenarioSim(seed, scenario)` and `step(ticks)`, and normalise to LF before comparing bytes on
a checkout with `core.autocrlf` true. Moving it into a skill is the fix, and it was out of scope for
a repair slice.

### `MAXIMUM_TURNS = 120` is already unsafe

Sharpens the 120-turn entry below, which measured the cap against a different player policy. At 600
seeds the mirror policy walks past it on its own: one battle runs 168 turns and would score
`unresolved` against `battle.test.ts`'s cap. That is true *before* this repair as well as after —
the melee change moves no battle's length by a turn — so the hazard is not something the repair
introduced. The twenty-four seeds the committed test uses dodge it. The assertion is one seed-list
change away from flaking, independently of anything this slice touched.

### `deserialise` validates nothing

`deserialise` is a `JSON.parse` and a cast handed straight to `migrate`. Decisions 64 and 66 make an
unknown `shipClass` unreachable through every command path — the guard fires before `createShip` —
but a save carrying one walks in behind those guards and reaches the new `RangeError` in
`shipClassOf`, and a throw inside a tick tears state because `Sim.step` has no transaction. No RPC
method exposes `deserialise` today, so nothing reachable can trigger it. It starts to matter the
moment there is a `session.load`.

### The two prototype-carrying defaults

`resolveMovement`'s `ramDamage: RamDamageOverrides = {}` (`battle/collision.ts:38`) is an ordinary
object literal, and `ramDamageOf` indexes it by a class id (`ram.ts:27`), so an id of `toString`
would find a function there rather than fall through to the published ram damage. `applyCollisions`
carries an identical `overrides: RamDamageOverrides = {}` default at `ram.ts:19`, and its default is
never taken by any caller at all. Both are unreachable in production — every caller passes the
null-prototype table decision 65 created, and decision 64 refuses the id before there is a ship to
carry it — but they are the same bug shape that blocked this review, one refactor away. One
`Object.create(null)` each closes both.

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
`strengthOf` collapses to `30 × (6 − blackBlockRows)` — seven possible values. This entry asked for
a re-measurement and the repair cycle above supplied one, over 600 seeds under the mirror policy
`tests/harness/battle.test.ts` actually uses, with the turn cap lifted so that nothing scores
`unresolved`. The numbers below are all post-fix.

The player wins 326 of 600, 54.3%. 464 battles, 77.3%, are decided by `resolveMelee` and 136, 22.7%,
by sinking. 261 of those 464 melee verdicts are ties, 56.3%, and 218 of the ties are nil against
nil, 83.5% — both ships pinned at six black rows, strength 0 against strength 0. The longest battle
runs 168 turns. So the tie-break alone settles 261 of 600 battles, better than two in five, and it
is invented: nothing published contradicts it, which is why decision 73 re-measured it rather than
changed it. It remains the single largest rule in the sea battle.

**The tie mass rose because obstacle damage now feeds the handicap.** The analysis measured the same
600 seeds pre-fix at 202 ties of 464, 43.5%, with 130 nil against nil, 64.4%. Rock damage now raises
`meleeDamageSmallMicro` as well, so more ships reach the grapple already pinned and more melees are
0 against 0.

**The battle trajectory is bit-identical before and after.** Melee-decided count, sink count and the
longest battle are unchanged to the unit — 464, 136 and 168 on both sides of the repair — because
`meleeDamageSmallMicro` is a write-only sink that nothing reads except `meleeSideOf` at battle end.
Only the verdict of an already-melee-decided battle can move, and 84 of 464 flip — 60 to the player
and 24 against, a net of 36. That is what made
the repair cheap, and it also means the meter carries no gameplay pressure today.

**The player gains from the tie rise only by accident.** The brigand throws the grapple in 343 of
the 464 melee-decided battles, 73.9%, so it is the attacker in three ties out of four and the tie
goes to the defender, which is the player. A six-point win-rate swing — 48.3% to 54.3% — resting on
who happens to grapple is a coin flip dressed as a rule, and it inverts the moment a player planner
grapples more often than the brigand's does.

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
