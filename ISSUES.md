# Known issues

Non-blocking findings, newest first. Blocking findings never land here — they go back to the
analysis stage. Each entry says why it was judged not worth stopping for, and when it will start to
matter.

## 2026-09-03 — slice 5 integration, taking schema 6 from agent/develop (OPP-12), PR 8

The merge itself is recorded in the analysis document. Three things found while doing it, none of
them worth stopping for.

### The renderer does not draw tokens

`agent/develop`'s slice 2c added a token layer to the puzzle: `Board` now carries a `shapes` array
alongside `cells`, and `tokens.ts` spawns and clears shapes as play proceeds. Slice 5's puzzle scene
was written before any of that existed and draws `cells` only, so tokens are simulated and scored
but invisible.

This is a feature gap, not a regression — nothing that previously worked is broken, and the sim is
the authority on score either way. It starts to matter as soon as a player is expected to *aim* for
tokens, because right now the board gives them no way to see one. Whoever picks up the next puzzle
slice should treat drawing shapes as part of it.

### The provenance check the integration task prescribed does not discriminate

The task told the next agent to prove which server served the smoke by fetching the puzzle module
and finding *Click a puffer to pop it* and none of the old copy. That test passes against the stale
tree too: its hint reads *Click a tile to swap it with the tile on its right. The last column cannot
start a swap. Click a puffer to pop it.* and so **ends** with the exact sentence being searched for.
Both servers were fetched during this integration and both matched.

Anything downstream that repeats this check should use a discriminator that actually differs —
`SCHEMA_VERSION` (6 on the merged tree, 5 on the stale one), the hint's *leading* text, or whether
`puzzle.ts` imports `bilgeGesture.ts`. Left as a note rather than a fix because the fix belongs in
whichever task file next asks for a provenance proof, not in the repo.

### Port 5178 is still held by the pre-repair worktree

Recorded by the cycle 1 review and still true: PID 10172 is serving the `opp-slice5` worktree at
`a14e78c`, which is on `SCHEMA_VERSION` 5. Because `playwright.config.ts` sets
`reuseExistingServer: !process.env.CI` on the fixed port 5178, a default `npm run smoke` anywhere on
this repo silently tests that checkout instead of the working tree. This integration worked around it
with its own server on 5191 rather than killing a process it did not start.

The durable fix is to stop pinning the dev port, or to make the smoke assert provenance itself. Both
are out of scope here.

## 2026-09-03 — physical test of the slice 5 repairs (OPP-12), PR 8, cycle 1

Both repairs pass in a real browser, including the keyboard path the suite cannot reach. Two things
found that are not worth stopping for.

### Clicking a duty station you are already standing on refuses to walk

Loading a save taken while the bilging duty was held puts the avatar back on the station tile. A
click on that tile then answers *"Avast! I can't find a way to walk there."* instead of opening the
radial menu; a click one tile away and then back on the station opens it normally. The pathfinder is
being asked for a route from a tile to itself and has nothing to return, and the station's own
interaction never gets a chance. Pre-existing walking behaviour, nothing to do with these repairs,
and invisible until a save restores you onto a station. A zero-length path answering *"you are
already there"* — or the station check running before the walk — would close it.

### The panel copy is wider than the rule, confirmed by hand

Recorded under the review heading below as a reading of the code; now observed. Clicking a crab
answers *"The crab will not be shoved about."* and counts no move, so *"Click any other tile to swap
it with the tile on its right"* is false for crabs as well as for the last column. The refusal
reaches the player, which is what removing the pre-refusal bought, so the sentence is optimistic
rather than misleading.

### A puffer in a chosen cell is only reachable by editing a save

There is no way to put the bilging board into a known state from the client, so testing a puffer in
the last column meant saving, editing `puzzle.board.cells` by hand, and loading it back. That worked
and exercised the load path as a side effect, but it means every board-shape test at this stage
depends on hand-edited saves. A seeded-board or scenario entry point on the client — the harness
already has `createScenarioSim` — would make this kind of check repeatable rather than artisanal.

## 2026-09-03 — independent review of the slice 5 repairs (OPP-12), PR 8, cycle 1

Four-lens review of `358196e`. **No blocking findings** — all seven decisions (111-117) are
delivered, the three deviations the development entry records are each sound on their merits, and an
independent estimate confirms the screenshot-headroom argument. What follows is everything else.

### A spoiled save one level down still costs the running voyage

The guard is shallow by decision 112 and the client's containment is narrower than decision 113's
stated purpose, so between them there is a gap neither closes. Demonstrated rather than reasoned:
take a real save from a 3000-tick client and delete exactly one nested key. `puzzle.frame`,
`puzzle.board`, `balance.battle`, `balance.bilging`, `balance.npc` and `balance.ship` each produce a
save that passes all thirteen top-level checks, loads, and returns from `restore` **without
throwing** — because `syncScene` only reads `battle?.outcome` and `voyage !== null` and `announce`
only touches shallow fields. No rollback fires, the good `Sim` is discarded, and the Ye panel prints
*"Yer voyage be restored."* The failure lands one frame later inside `client.advance` → `sim.step`
(`TypeError: Cannot read properties of undefined (reading 'intervals')` for `puzzle.frame`,
`RangeError: no ship class named "undefined"` for a malformed `ships`), and repeats every frame
after that.

Not blocking: the behaviour is identical before and after this commit, and decision 112 scopes the
guard to the top level for stated reasons that still hold. But `restore`'s try block covers
`syncScene` and `announce`, which are the two shallowest reads in the client and therefore precisely
where a shape failure will *not* land. The cheap closure is to step a clone of the restored sim one
tick inside that same try before swapping — one tick of work, and it moves the failure back inside
the containment that already exists. It starts to matter the first time a player loads a save
written by a different build.

### The rollback does not re-announce, and the record understates how long that lasts

`restore` restores `sim`, `lines` and `current` and rethrows, but does not `announce()` afterwards,
so a listener that ran before a later one threw keeps showing the rejected state. The development
entry records this and says it self-heals *"on the next frame, because the ticker's step calls
`announce` again"*. The step does not call `announce` every frame: `advance` only announces when
`events.length > 0` or `quietTicks >= TICKS_BETWEEN_QUIET_ANNOUNCEMENTS`, which is 30 against
`TICKS_PER_SECOND = 60`. The scene listener does heal every frame, because `stage.follow` is called
unconditionally by the step as well as being a subscriber — but the **DOM panel deck** has no second
path and waits up to half a second on a quiet board. The heal is real and bounded, and it does
depend on decision 114 keeping the loop alive; the recorded cost is imprecise, not false. An
`announce()` on the rollback path would remove the question.

`quietTicks` is also absent from the snapshot. Harmless today, since `restore` never writes it.

### `tick` and `nextEntityId` are accepted as any number

The guard's kind for both is `'a number'`. Verified: `nextEntityId: 0` alongside `markers` holding
an entity with `id: 1` loads and steps 600 ticks clean, after which `takeEntityId` mints a colliding
id 1. `tick: -5` and `tick: 1e308` also load and step. The id collision is real; downstream
corruption from it is inferred, not demonstrated. `Number.isSafeInteger` and a non-negative check
would cost nothing and would match `coordinateRejection`'s existing shape in `puzzle/dispatch.ts`.

### The guard the whole of decision 111 argued for has no test in `tests/sim/`

Decision 111 put the guard in the shared sink precisely so it is not the client's. The only test
added anywhere is one harness case — `'{"schemaVersion":5}'` in `UNLOADABLE_SAVES` — and it asserts
only `reasonOf(...) === 'invalid-params'`, never a message. `tests/sim/save.test.ts` is untouched.
Contrast `balanceParse.ts`, which the guard is explicitly modelled on and which has five
message-asserting tests. "What done means" promises *"a message naming the first bad field"*; that
message, the thirteen-entry kind table, and the `'an array'` / `'an object'` / `'an object or null'`
rejection arms are asserted nowhere. A regression that dropped twelve of the thirteen checks would
stay green. The *ordering* — guard after migration — is covered incidentally by the ten
`tests/sim/migration.test.ts` cases, which all route through `deserialise`.

### One of the two new boot tests is green against the parent commit

`tests/view/boot.test.ts:77-87` loads `'{"schemaVersion":6}'`, which is caught by the pre-existing
`newer than` check inside `Sim.load` — i.e. inside the right-hand side of the old
`this.sim = Sim.load(text)`, so the old `restore` never mutated either. The test passes unchanged at
`a14e78c` and pins neither the new guard nor the new rollback, while its name reads as though it
covers the blocking repair. Changing the literal from `6` to `5` costs one character and makes it
pin the new code. The second new boot test, with the throwing subscriber, is genuine and does go red
without the rollback.

`tests/view/bilgeGesture.test.ts:51` has the same shape of problem in its name — *"the cell the
cursor clamp used to hide"* — when `gestureAt` knows nothing about the cursor and the test passes
with `board.width - 2` restored. The clamp gap is already recorded below; the name should not
suggest otherwise.

### The last column's new refusal line is unpinned

Removing the pre-refusal means a plain last-column click or keypress now dispatches `bilge.swap`,
the sim rejects it, and the player gets *"That swap falls off the board."* in the chat. That is new
player-visible behaviour and nothing asserts it. It is reachable without Pixi — `boot.test.ts`
already drives `GameClient` directly — so a test that takes the bilge duty, dispatches at
`x = board.width - 1` and asserts `client.log.at(-1)` would pin it in about six lines. Cheapest
missing test in the commit.

### `npm run check` failed once from cold on a gate this commit does not touch

Reproduced independently after `npm ci`: run 1 exited 1 with 462 of 463, failing
`tests/gates/purity.test.ts:63` — *"the import gate rejects a bare specifier"* — because the spawned
gate exited non-zero with **empty stdout and stderr**. The identical `spawnSync` in the test
directly above it passed in the same run; the file passes 5 of 5 in isolation; run 2 of the full
`check` was 463 of 463, exit 0. So it is a load-dependent flake in a test harness that shells out,
not a defect in this change and not in a file this change touches — but it did fail the exact
command the development entry claims green from cold, on the first try, and it will fail CI the same
way. Capturing the child's exit code and streams into the assertion message would at least make the
next failure diagnosable.

### The render smoke is flaky beyond the port trap

Four full runs against a dev server proven to be serving this tree: 3/4, 3/4, 4/4, 4/4. The two
failures were different — once `iso port scene` never signalled `render:ready` inside the 20s
`MOUNT_TIMEOUT_MS` on a cold Vite server (29.1s total; later tests took 1.9-4.4s once warm), and
once the `battle grid` screenshot differed by **630,386 pixels, a ratio of 0.69**. That is most of
the frame, not an anti-aliasing nudge, and it did not reproduce in six consecutive re-runs of that
test alone. Neither scene is touched by this commit, so this is pre-existing, but "4 of 4" is a
warm-server result rather than a reliable one. A first-run warm-up navigation, or a longer mount
budget on the first spec, would remove the cold-start half.

### Port 5178 is held right now by a worktree at the pre-repair commit

The trap recorded below is not merely live, it is occupied. Port 5178 is held by a vite process
serving the `opp-slice5` worktree at `a14e78c` — confirmed by fetching the puzzle module from it and
finding the **old** panel copy, *"The last column cannot start a swap"*, and none of the new. Any
`npm run smoke` run on this machine right now silently tests the pre-repair tree and reports four
green. The test stage must start its own server on a private port and prove provenance before
believing any smoke result.

### Smaller things, each cheap and none urgent

- **`holds()` falls through to an unnamed arm.** Three `if`s then a bare
  `return value === null || isRecord(value)`, so a fifth `FieldKind` compiles silently into the
  permissive branch. The failure would be loud rather than silent — a new permissive kind would
  refuse every legitimate save and go red in `migration.test.ts` — so the cost is a confusing
  failure, not a false pass. A final named `if` plus an exhaustiveness `return false` reads better.
- **`gestureAt` re-implements a bounds-safe read that already exists.** `puzzle/board.ts` exports
  `cellAt(board, x, y)` doing exactly the same thing *with* an `isInsideBoard` check, but it is not
  re-exported through `client/rules.ts`, so the view cannot reach it. As written an off-board
  position answers `'swap'` rather than being refused; both callers bounds-check first, so it is
  latent. Adding `cellAt` to the facade removes the duplication and the latency together.
- **`swapAtCursor` now pops or swaps.** Stale name against the repo's own naming rule.
- **The panel copy overstates a swap.** *"Click any other tile to swap it with the tile on its
  right"* — the sim also refuses a crab, either side, with `'crab-not-swappable'`, and the last
  column with `'swap-outside-board'`. The player now gets a chat refusal in both cases, so it is
  discoverable rather than silent, but the sentence asserts a capability the game refuses for two of
  the board's cell kinds. The other three claims in the two paragraphs are exact.
- **The hover pair is drawn over a puffer too.** `drawPair` and `drawCursor` draw a two-cell swap
  pair even when the cell under the pointer is a puffer, where the gesture is a poke. Same redesign
  as the last-column entry below, and the same reason it was left.
- **`declare global` in `ticker.test.ts` is load-bearing for a source file's typecheck.** The root
  `tsconfig.json` has no DOM lib, and because the test imports `ticker.ts` that source file is
  pulled into the root program — so the only thing making `tsc -p tsconfig.json` pass on `ticker.ts`
  is a block in a test file. Delete or rename that test and the root typecheck breaks somewhere
  confusing. A `tests/globals.d.ts`, or `"DOM"` in the root `lib`, says it once.
- **The boundary-gate sentence claims a check that does not exist.** The development entry says
  *"`npm run boundary` sees it now"*; `tools/check-view-boundary.ts` only matches import specifiers
  against `@opp/sim`, has no notion of a rule, and would have passed `puzzle.ts` before and after.
  The extraction is right for the reason given two sentences earlier — it is now testable.
- **Three entries below were deleted, not struck, and one was edited inside a dated heading.** The
  entry below says "struck"; there is no strikethrough in the file, and the duplication bullet under
  the cycle 0 review heading was rewritten in place — which is what decision 118 says not to do.
  Defensible, since `ISSUES.md` is a live worklist rather than a historical record, but the
  asymmetry with the document's own stated principle is unremarked.

## 2026-09-03 — development of the slice 5 review repairs (OPP-12), PR 8, cycle 1

Found while building decisions 111-117. Three entries under the review heading below were struck
because this task repaired them: the keyboard clamp, the dead `'swap-outside-board'` refusal on the
pointer path, and the ticker re-arm.

### The render smoke can silently test a different checkout

`playwright.config.ts` sets `reuseExistingServer: !process.env.CI` against a fixed
`DEV_SERVER_PORT = 5178`, and several worktrees of this repo exist at once. **This is not
hypothetical: the first `npm run smoke` of this task ran green against a vite server belonging to
another worktree**, on the slice 5 branch as it stood *before* these repairs. Nothing in the output
says which tree served the page, so a run looks identical either way. It was caught only because
starting a second dev server failed with the port already in use.

Everything the smoke asserts — the readiness signal, the canvas, the screenshot baseline — is
therefore conditional on no other checkout holding 5178. A port derived from the checkout path, or
`reuseExistingServer: false`, or a served-tree assertion in the readiness contract would close it.
It starts to matter the moment two agents run the smoke in the same hour, which is now.

### The screenshot baseline cannot see player-facing text

`MAX_DIFF_PIXEL_RATIO = 0.01` is 9216 pixels of a 1280×720 shot. This task rewrote both paragraphs
of the puzzle panel's help text and **all four smokes stayed green with no baseline diff at all** —
`--update-snapshots` rewrote nothing, because nothing failed. The tolerance is sized for the
bilging scene's own animation, which moves 1400 to 3300 pixels between two consecutive frames of a
settled board, and two lines of 12px copy are smaller than that headroom.

So the baseline guards gross render regressions and nothing about the words the player reads. The
analysis for this cycle expected the baseline to diff and be re-blessed; it did not, and forcing
`--update-snapshots=all` would only have committed a fresh animation frame. A separate assertion on
the panel's text, or a still scene for the text-bearing shot, is what would actually cover it.

### The cursor clamp itself is still untested

The clamp lives inside the Pixi-importing closure in `puzzle.ts`, and this repo has no jsdom, so
`tests/view/` cannot reach it. Decision 116's extraction gives the *mapping* a test, and inverting
the mapping fails it — but reintroducing `board.width - 2` in `moveCursor` leaves the whole suite
green. The keyboard path is covered by review and by the test stage, not by the suite.

### The hover pair highlight stops one column short of what is clickable

`cellUnder` keeps its `isSwapOrigin` filter, deliberately: the hover highlight draws *two* outlines
and a connector between them, so in the last column it would promise a partner that does not exist.
The consequence is that the last column is now fully clickable and shows no hover feedback. Making
the highlight gesture-aware — one outline for a poke, two for a swap — is a redesign of `drawPair`
and was out of scope for the repair.

## 2026-09-03 — independent review of the slice 2c repair (OPP-14), PR 6, cycle 1

Four lenses against the merged tree. Nothing blocks: the repair does what decisions 90 to 101 say,
the merge dropped nothing from either parent, and `npm run check` is 435 of 435 exit 0, reproduced
twice from cold in worktrees the review built itself. The blocking finding from cycle 0 is genuinely
unreachable rather than patched over — every route to `tokens.ts:37` was tried, not argued. What
follows is everything else, with when it starts to matter.

### The numbering claim is false

- **`ISSUES.md:33` says this repair's decisions "collide with nothing"; they collide with three live
  branches.** The analysis reached 90 by checking `agent/develop` alone
  (`docs/analysis/20260901-223150-offline-puzzle-pirates-wiki-mapping-road.md:2520-2522`, "develop is
  at 89 and this branch at 70"), but three feature branches had already claimed 90 and above and were
  pushed before that analysis commit: slice 4b holds 90-96, slice 5 holds 90-100, slice 4c holds
  101-103. This branch's 90-101 therefore collides with 4b on seven numbers, with slice 5 on eleven,
  and with 4c on one. Taking 90 was defensible on what was checked; the sentence claiming safety is
  simply wrong, and it is the sentence a human reading `ISSUES.md` will act on. Whoever integrates
  these four branches needs the renumber the slice 5 review already recommends — and note that the
  slice 5 repair has since numbered from 111 for exactly this reason, leaving 104-110 free.

### The skill documents

- **This commit introduces a new false schema version twelve lines below the one it corrected.**
  Decision 99's rationale is that taking either side of the conflicted paragraph "would have committed
  a known falsehood in the same commit that made it false". The conflicted paragraph was rewritten
  correctly (`.claude/skills/pp-sim-harness/SKILL.md:45-49`, four scenarios, `schemaVersion` 6), but
  the pointer table auto-merged from develop's side, so `:91` changed from `3` to `4` when the true
  value is now `6`. The wider staleness of the four harness skills is already recorded and this line
  is cited there, so the entry is not new — the fact that this commit *changed* the line, to a value
  that was already wrong, is. One line, worth taking with the next touch of that file.

### The witness fixtures, and how they die

- **`bilge-session-v5.json` will silently stop witnessing the repair at the next schema bump,
  by the mechanism that already killed the v3 fixture.** Demonstrated rather than argued: adding a
  plausible `6: (save) => ({ ...save, balance: null })` — the shape three of the four existing
  siblings use — bumping `SCHEMA_VERSION` to 7 and removing `balance: null` from `migrations[5]`
  leaves all nineteen tests in `tests/sim/migration.test.ts` green. The defect this cycle repaired
  would be reintroduced with a fully green suite. The cheapest guard is a test that asserts each
  committed fixture still reaches the migration step it was created for, rather than only asserting
  the end state after the whole chain.
- **Nothing in the suite guards that a version-named fixture still exercises its own path.** There is
  no test over the migration table's coverage and no per-step witness assertion; the only
  version-relative sites are `tests/sim/migration.test.ts:52,61,71,228`.
- **`tests/sim/migration.test.ts:58` is named "the no-op migration preserves the hash of a current
  save" and uses `SCHEMA_VERSION - 1`, which is now `migrations[5]` — not a no-op.** It nulls the
  balance and injects `shapes` and `maneuverBar`. The test passes only because `Sim.create` leaves
  `balance` and `puzzle` null, so both mutations are incidentally no-ops on that input. This is the
  same decay class as the entry above, one bump older, and it is the mistake the earlier
  `SCHEMA_VERSION - 1` entry warned about, at a sibling site rather than the one that was renamed.
- **The v5 fixture has no provenance test and can be gutted without failing the suite.** Setting every
  board cell to 0, `seed` to 99, `tick` to 999 and the `bilge.fill` cursor's `draws` to 1 leaves
  `npm run test` at 435 of 435. The same mutilation of the v3 fixture fails
  `tests/sim/migration.test.ts:153`, and v2 has the equivalent at `:89`. The fixture *is* genuine —
  `createScenarioSim(20260903, BILGE_SCENARIO).step(60)` on `agent/develop` reproduces it
  byte-for-byte — but nothing in the repo records or checks that. The v2/v3 pattern of a
  `COMMITTED_V5_SEED` / `COMMITTED_V5_TICK` pair plus an equality test would close it and would be
  green on commit.
- **Decision 95 lists four assertions for the schema-5 witness; the fourth lives only on the v3
  path.** `shapes.length === cells.length` and all-`NO_SHAPE` are asserted at
  `tests/sim/migration.test.ts:138-152` against the v3 fixture. The v5 fixture, which decision 95
  calls the only save that can witness the repair, never asserts the shape layer.

### `shapedPuzzleOf`

- **`shapes` is sized from `cells.length` with no type or bound check, so a 236-byte save allocates
  145 MB.** `packages/sim/src/save.ts:61,64` casts `board['cells']` to `unknown[]` and calls
  `new Array(cells.length)`, so any object carrying a `length` drives the allocation:
  `{"length":20000000}` measured at 124 ms and +144.9 MB from a 236-byte payload, with the ceiling at
  the JS array-length cap. `MAX_SAVE_LENGTH` is no defence, because the payload is tiny. The silent
  siblings are `cells: 5` giving a 1-entry `shapes` and `cells: "abc"` giving 3. This is the only
  allocation in `packages/sim/src` sized from save data, and it is new in this diff. Offline
  single-player, so there is no remote attacker — but it is a one-line guard.
- **A schema-5 save with no `puzzle` key now loads and then throws on every `hash()` and `save()`,
  where on `agent/develop` it worked.** `shapedPuzzleOf` returns its argument unchanged when it is not
  an object, including `undefined`, and migration 5 writes that back as an own key, so `canonicalJson`
  throws on the `undefined` value. Over the protocol this surfaces as `internal-error` rather than
  `invalid-params`, and the session is registered before the throw, leaving a broken session
  reachable. Not producible by a save the game writes — `createWorldState` always sets `puzzle: null`
  — so it needs a hand-edited or corrupt file. Worth knowing that the slice 5 repair's shallow
  top-level guard in `deserialise` closes this shape as a side effect.
- **The primitive cases pass straight through.** `puzzle: 7`, `"x"` or `true` survive migration and
  leave `state.puzzle` a non-null primitive, which would make `puzzle.start` answer
  `puzzle-already-running` forever. It is contained today only because migration 5 also nulls
  `balance` and `startPuzzle` checks `balance === null` first — accidental ordering, not a check.
- **The file is internally inconsistent about guarding.** `shipsWithCargo`
  (`packages/sim/src/save.ts:23-28`) guards both the array and each element; its immediate sibling
  guards neither `board` nor `cells`. The unguarded cast is already recorded twice, but its blast
  radius grew this cycle: it sat at `migrations[3]` on a schema only this branch had, and now sits at
  `migrations[5]`, on every save `agent/develop` already writes. No test covers it; one
  `assert.throws` would both cover it and force the guard.

### Rules with no mechanism

- **Decision 93 raises "a migration that cannot carry its tuning forward nulls it" to a standing rule,
  and nothing enforces it.** All four migrations honour it, but `tests/sim/migration.test.ts` has no
  structural test over the table, and `packages/sim/src/save.ts:55` trusts a save's `balance`
  wholesale. A future `migrations[6]` that preserves `balance` reproduces this cycle's exact defect
  class with a green suite. One table-driven assertion would hold the rule.
- **`SYMBOL_COUNT` is still pinned by a single re-blessable fixture, and this PR re-blessed it.**
  Changing `packages/sim/src/puzzle/board.ts:13` from 4 to 3 fails exactly one test, the committed
  bilging replay — the monopoly the earlier entry warned about. The re-record was proven by roll-back
  against `22ec18e`, so the defence survived by process discipline rather than by a test. A direct
  unit test over `shapeDrawnFrom` at a non-zero draw would cost three lines and break the monopoly;
  `tests/puzzle/tokens.test.ts` only ever draws 0, where the plausible mappings agree.

### Duplication and small things

- **No shared constructor for a bare shape layer.** `new Array<BoardShape>(N).fill(NO_SHAPE)` now
  appears at `packages/sim/src/puzzle/bilging.ts:43` and `packages/sim/src/save.ts:64` in production,
  plus `tests/puzzle/fixtures.ts:70` and `tests/puzzle/board.test.ts:32`.
  `packages/sim/src/puzzle/board.ts` already owns `NO_SHAPE`, `SHAPE_COUNT`, `shapeOf` and `shapeAt`
  and is the natural home for a `bareShapes(count)`.
- **`ISSUES.md` says the golden "claims 309 lines where the file is now 547"; it is 546.**

### Verified sound, recorded so the next stage need not redo it

The cycle-0 blocking finding is unreachable, by execution and not by reading: `bilge.swap` and
`bilge.poke` on both the v3 and v5 fixtures, `sim.step(200)` and `step(300)` on a save that already
had a puzzle running, the full harness protocol path, and hand-built saves at schema 4 and 5 carrying
a balance missing only `tokenSpawnPerMille` — all refused before `tokens.ts:37`, with `bilge.tokens`
never appearing in `rngStreams`. The only route that reaches the inverted gate is a save hand-forged
at schema 6, which bypasses `migrate` entirely and is out of the loader's contract for every field,
not just this one.

Both halves of the second home are real: deleting `tokenSpawnPerMille` from `bilgingBalanceOf` gives
the TS2741 the entry quotes, line and column, and `loadBalance` on a holed `balance.json` throws at
run time as well. Deleting it from the harness reader fails six tests. Repo-wide there are exactly two
sites that build a full `Balance` and both carry the annotation, which is how the second site was
caught in the first place.

The fixtures are honest. `marker-drift`'s entire state diff is `schemaVersion` 5 to 6, with the
`marker.drift` cursor byte-identical on both branches. `bilge-session` gained `bilge.tokens` as a new
stream while `bilge.fill`, `bilge.refill`, `bilge.critters` and `marker.drift` kept their cursors
exactly — the token layer stole no draws. `marker-drift-diverged-at-tick-5` still diverges at tick 5
with `finalHash == expectedHash`. All ten hashes in the development entry's table match the blobs on
both sides, and each fixture reproduces its committed value on its own branch. The v3 save is
byte-identical to develop's. The v5 save is a real recording, reproduced from `agent/develop` at seed
20260903 and 60 ticks.

The merge dropped nothing: zero `###` sections, zero decision rows, zero `ISSUES.md` headings and zero
non-blank lines missing from either parent, and no file present on either parent absent at HEAD.
`tests/harness/balance.test.ts` kept every behavioural assertion — the one dropped line asserted a
single-block `BALANCE` and is superseded by a nine-block equivalent. The migration chain 1 through 6
is complete and each step feeds the next. No dependency was added; `npm run deps` and `npm run imports`
both pass and both genuinely check what they claim. No skipped, pending, flaky or order-dependent
tests; the five slow tests are all pre-existing on develop.

## 2026-09-03 — development of the slice 2c repair (OPP-14), PR 6

The blocking finding — the migration preserving a balance with no `tokenSpawnPerMille` — is fixed and
is not recorded here. What follows is what the merge with `agent/develop` surfaced and did not stop
for. `npm run check` is 435 of 435, exit 0.

### Four harness skills quote schema versions and hashes that no longer reproduce
The schema moved twice under them — to 5 with slice 4 and to 6 here — and the fixture re-recording
moved five hashes. `pp-replay-triage/SKILL.md` is the worst affected: `schemaVersion 4` transcripts at
`:181`, `:352`, `:355`, `:381`, `:402`, `:408`, the whole trail walk at `:140-152`, the diverged-fixture
head at `:50-60` quoting `finalHash 0df21f56de40342e`, and the schema-bump worked example at
`:431-433`. `pp-sim-harness/SKILL.md` carries `schemaVersion 3` at `:61`, `:64`, `:139`, a 4 at `:189`,
`/schemaVersion 4` in the pointer table at `:91`, and stale hash transcripts throughout. 
`pp-scenario-author/SKILL.md` pins the old `bilge-opening` hash `6d973c13249b77d8` at `:74`, `:120`,
`:152`, `:199`, `:200`, quotes `schemaVersion 3` transcripts, and reproduces a `bilge-opening.json`
body that predates `board.shapes`. `pp-golden-state/SKILL.md` pins the old golden `3a34e82ce2c7cb80`
at `:95`, claims 309 lines where the file is now 547, and its `state:`/`puzzle:` key lists at `:49-50`
omit `ships battle pirate voyage markets` and `maneuverBar`. Only the one paragraph that this merge had
to resolve by hand was corrected, because leaving it would have committed a falsehood in the commit
that made it false. **Non-blocking: these are agent-facing notes, no test reads them, and the numbers
in them are reproducible from the repo at any time.** It starts to matter the moment an agent trusts a
quoted hash instead of recording one — which is exactly the mistake the roll-back proof exists to
catch. Worth one pass that regenerates every transcript rather than five separate edits.

### The decision series now has two live collisions, and this slice widened the gap
Decisions 61 to 70 exist twice — once on this branch and once on `agent/develop` — and 74 and 75 also
exist twice after PR 5 merged. This repair allocated 90 to 101, which collides with nothing, but it did
not renumber what was already doubled. So the merged document now contains two decision 66s, two 74s
and two 75s, and a prose citation of "decision 66" is ambiguous by position alone. **Non-blocking
because every colliding pair is distinguishable from its surrounding entry, and renumbering touches
prose across both histories.** It matters when someone cites a number in code or a commit message
rather than in prose next to its own entry. The root cause is unchanged and structural: numbers are
allocated per branch in a repo whose branches run concurrently.

### `ISSUES.md` carries one section out of newest-first order, inherited from an earlier merge
`## 2026-09-02 — physical test of slice 2b (OPP-13), PR 4` (recorded 17:56) sits below
`## development of slice 4 (OPP-11)` (15:06) on `agent/develop`, and this merge preserved that rather
than correcting it, because reordering the other side's content is not a conflict resolution.
Non-blocking; the file's header states the convention, and one section breaking it is visible rather
than misleading.

### Smaller things
- `tests/ship/meters.test.ts:29` hand-builds a `Balance` literal, so every future balance key has to be
  added there by hand. The typecheck caught it this time; it will catch it every time, but a shared
  test factory would stop the churn.
- `shapedPuzzleOf` (`packages/sim/src/save.ts`) still casts `puzzle.board.cells` unguarded, so a
  malformed save reaching migration 5 throws a raw `TypeError` rather than the controlled `Error` that
  `schemaVersionOf` throws. Carried over from the pre-merge branch unchanged and deliberately not
  widened in a blocking-only repair.
- The repo has fifteen worktrees registered, most abandoned by dead sessions and several holding
  branches this queue still uses. `git worktree prune` does not remove them because their directories
  still exist under the session scratchpads.

## 2026-09-03 — independent review of slice 5 (OPP-12), PR 8

Four-lens review of the isometric renderer and the playable client. Two blocking findings went back
to analysis as cycle 1: `client.restore` destroys the running game before validating the save, and
the view turns every puffer click into `bilge.poke`, removing a swap the simulation allows. What
follows is everything else — judged not worth stopping the pipeline for, with when it starts to
matter.

### The gate, and how far it reaches

- **The gate never looks at `packages/app`, which is a violation by its own definition.**
  `node tools/check-view-boundary.ts packages/app/src` exits 1 with
  `main.ts reaches past the client facade to "@opp/sim"`. It passes in `npm run check` only because
  `VIEW_ROOT` defaults to `packages/view/src`, and `packages/app/src` is scanned in neither
  direction — even though `tools/check-view-boundary.ts:7` lists `@opp/app` among `VIEW_PACKAGES`
  for the reverse rule. `balanceOf` in a composition root is a defensible exception, but nothing
  records it as one. It starts to matter the first time anything else in the app shell reaches for
  the sim: `import { Sim } from '@opp/sim'` in `main.ts` is exactly what the gate exists to prevent
  and would go green. Either extend `VIEW_ROOT` to both packages, or record the exemption.
- **Four shapes evade the facade rule.** None is used in this diff; all four were run against the
  gate and exited 0. A nested directory named `client` anywhere under the view
  (`insideFacade` at `tools/check-view-boundary.ts:26-28` tests every path segment, not the first,
  so `scenes/client/anything.ts` is exempt). A relative deep import — `../../../sim/src/index.ts`
  from a panel — which the `SPECIFIER` regex captures but the `=== '@opp/sim'` filter discards;
  this resolves and bundles, since Vite sets no alias and ESLint has no `no-restricted-imports` for
  the view, and it is the shape a developer reaches for once the package specifier is rejected. A
  non-`.ts` extension, because `sourceFiles` keeps only `endsWith('.ts')`. And a template-literal
  dynamic import, because the regex requires a straight quote. The cheapest hardening is to anchor
  `insideFacade` to the first segment, resolve relative specifiers and reject anything landing in
  `packages/sim/src`, widen the extension filter, and give each shape a negative fixture — decision
  22's lesson applied one level up, since the present fixtures only prove the shapes the gate
  already handles.
- **`packages/app` imports `@opp/sim` without declaring it.** `packages/app/package.json` declares
  only `@opp/view`; `packages/app/src/main.ts:1` imports `balanceOf`. It resolves through npm
  workspace hoisting today and breaks the moment the app is built or installed outside the
  workspace root. `packages/view` and `packages/harness` both declare their sim dependency.

### Rules and constants that now live on both sides of the boundary

The gate cannot see any of these, because none is an import.

- **Three of the deck's seven station counts are invented in the view.**
  `packages/view/src/scenes/deck.ts:39-47` maps `navigating` to a local
  `NAVIGATION_STATIONS_PER_SHIP = 1`, `rigging` to `sailStations` and `patching` to `carpStations`.
  `ShipClass` (`packages/sim/src/ship/classes.ts:20-46`) carries `sailStations`, `carpStations`,
  `bilgeStations` and `gunStations` and nothing for navigation or patching. No behaviour differs
  today, because `stationsOf` only tests `> 0` and every class has both values positive. It matters
  when a hull is added whose navigation complement is not one. The analysis document's claim that
  the deck reads "all seven stations from `ShipClass` rather than hardcoded" is false as written.
- **The sim's swap geometry is re-derived two ways in `puzzle.ts`.** `isSwapOrigin` correctly
  derives the partner from `swapPartnerOf(BILGE_RULES, …)`, but `drawCursor` hardcodes the
  horizontal axis in `if (partner.x >= board.width) return`, and the panel's hint paragraph
  restates the rule in prose. If `BILGE_RULES.swapAxis` ever becomes vertical, both are silently
  wrong while `isSwapOrigin` is right. The cursor clamp and the pointer path's silent pre-refusal
  were the third and fourth and are repaired in cycle 1. Same shape at `deck.ts:119-121`, where
  `moored()` re-derives "in port" instead of using the facade's `atSea`.
- **`FULL_METER = 1000` is declared three times** — `scenes/hud.ts:16`, `scenes/planner.ts:79`,
  `scenes/puzzle.ts:103` — plus bare `1000` at `scenes/battle.ts:323,437`, while the sim exports
  `PER_MILLE` and `client/rules.ts` does not re-export it. Alongside it, three subtly different
  per-mille renderings: `puzzle.ts:703` does not clamp, `panels/dom.ts:101` clamps to 0–100, and
  `hud.ts:158` clamps differently, so a per-mille value above 1000 renders differently depending on
  which surface shows it, and nothing tests any of them. A Pixi-free `perMille.ts` in the view
  would collapse all six and be testable.
- **`DEFAULT_BOARD_WIDTH` / `DEFAULT_BOARD_HEIGHT` duplicate `balance.json`'s
  `bilging.boardWidth` / `boardHeight`** — a tunable copied into a scene. This is the same class as
  the sixteen-colour palette already recorded under the slice's development entry.
- **`clamp` is byte-identical** at `scenes/puzzle.ts:707` and `scenes/planner.ts:340`, and
  `playerShipOf` is reimplemented as `playerShip` at `panels/panels.ts:90` when
  `scenes/isoScene.ts:72` already exports it. The cause of the second is visible — `isoScene.ts`
  imports Pixi, so a DOM panel importing it would drag the renderer in. Moving the one-liner to
  `client/client.ts` or `client/rules.ts` beats keeping two definitions of which ship is the
  player's.

### Input and scene defects

- **A deck scene constructed at sea has no gangplank, permanently.** `deck.ts:83,160` bakes the
  portal tile into the grid at construction from `moored(state)`. On the ordinary pillage loop a
  brigand spawn moves the scene to `battle` (`client.ts:137`), `app.ts:97-104` destroys the deck
  scene, and the post-battle return builds a new one while `voyage !== null` — so no portal tile is
  written. On arrival, `voyage.port` succeeds and the scene stays `deck`, leaving tile (0,4) plain
  `plank` for the rest of the session. `arrive` re-checks live moored state at `:98`, which is what
  makes the stowed case work, but only if the tile exists at all. Not blocking because the DOM
  "Disembark" button (`panels/location.ts:125`) still works; it matters as soon as a player expects
  the in-world gangplank.
- **The market panel destroys the units field you are typing into.** `panels/market.ts:16` clears
  and rebuilds the whole root on every notification, including the 30-tick quiet heartbeat
  (`client.ts:17,85`) — at least every 0.5 s. Type `4`, pause, type `0`, and the input element has
  been replaced in between: focus is gone, the keystroke is dropped, and the trade goes through as
  4 units. `panels/ye.ts:82` shows the intended shape, clearing only `facts` and leaving its inputs
  alive; the market panel is the outlier.
- **A click during a walk step produces one diagonal hop.** `isoScene.ts:206-210` queues a new
  trail without cancelling the in-flight step. `standing` is the tile being left, so the new trail's
  first entry is adjacent to the *old* tile; by the time `advanceWalk` shifts it, `standing` has
  advanced. Purely visual — the sim has no avatar — but it is a move the four-directional
  pathfinder never produced.
- **`say()` is the only mutator that does not `announce()`** (`client.ts:106-108`), so chat lines
  and the walk refusal (`isoScene.ts:217`) wait for the next event or the heartbeat and lag the
  click by up to ~0.5 s. `dispatch` (`:76`) and `enterScene` (`:95`) both announce.

### Robustness

- **"New game" and "Load game" discard the running voyage on one unconfirmed click.**
  `panels/ye.ts:76-79` and `:68` sit either side of "Save game" in the same `actionRow`, and
  nothing persists — the only copy of a session is whatever text the player copied out of the
  textarea first. A confirm step, or auto-populating the save textarea before resetting, closes it.
- **The author's Windows username is committed.**
  `.claude/skills/pp-render-smoke/SKILL.md:138` carries a literal
  `C:\Users\Verpo\AppData\Local\ms-playwright\…` path in an example error. Sole hit for personal
  paths across the diff; no keys, tokens or private material anywhere else, and the four new PNGs
  carry no metadata chunks.

### Test coverage

- **The completeness test's guarantee stops at the block level.** `tests/sim/balance.test.ts:15-25`
  iterates a hardcoded `BLOCK_NAMES`, and `:53` compares the parser's output blocks against that
  same literal — never against the file's non-underscore top-level keys. Verified: adding
  `"crew": { "sizeAtFullDuty": 4 }` to `balance.json` with no reader leaves all seven tests green.
  The integration entry's claim that "a tuning key added to `balance.json` without a reader fails
  the suite rather than being ignored" holds inside the nine known blocks and not for a tenth.
  Deriving the list — `Object.keys(FILE).filter((key) => !key.startsWith('_'))` — is a two-line fix
  that keeps both sides independent. The test is otherwise genuinely load-bearing: deleting
  `spreadPerMille` from the parser fails it with an exact diff.
- **The coverage claim is inaccurate.** The analysis document states `tests/view/` "covers every
  module that does not import Pixi". Twenty of the thirty new view modules are Pixi-free; the tests
  together import five. Untested and Pixi-free: all of `panels/` (908 lines), `client/log.ts`
  (108), `scenes/deck.ts` (196), `scenes/port.ts` (153) and `ticker.ts` (41). Most of `panels/` is
  thin DOM over sim helpers and is fair to leave, but `dom.ts:integerOf`, the deck hull geometry
  and the log's text table are pure functions where a test is nearly free. A reviewer budgeting
  follow-up work off that sentence will budget wrongly.
- **`GameClient.reset` is untested and diverges from `create` while duplicating it.**
  `client.ts:122-129` dispatches the opening straight at `this.sim`, bypassing `client.dispatch`,
  so a rejected opening command is silently swallowed here and logged-then-cleared in `create`
  (`:38`). It is wired to a live control (`panels/ye.ts:77`) and no test calls it, while the
  `create` path has three. Routing both through one private `openOn(sim)`, or giving `reset` the
  boot-parity assertion `boot.test.ts:14` already gives `create`, closes both halves.
- **The 30-tick announce heartbeat has no test**, though `client.ts` is Pixi-free and already has
  one. `client.ts:17,84-88` implements decision 97 and both `app.ts:64` and `panels.ts:87` depend
  on it. Four lines — subscribe a counter, `advance(29)`, `advance(1)` — would pin it; nothing
  currently notices if it regresses to every frame (a 60× DOM rebuild rate) or to never.
- **`warpTargetOf`'s object branch is the one untested branch in a well-tested function.**
  `scenes/walking.ts:65`. `walking.test.ts:110` covers the portal branch and `:116-117` the null
  branches. That branch is the fix for one of the two defects the slice found by hand — a prop's
  drawn body not being hit-tested — and is now the only part of that fix with no regression test.
- **The deck's hull geometry and station placement are pure, Pixi-free and untested.**
  `deck.ts:122,154,167,179` compute a superellipse hull with `HULL_BOW_SHARPNESS = 1.5` and then
  drop seven hardcoded `STATION_FITTINGS` tiles onto it. All seven land inside the hull today;
  nothing asserts it. Change `DECK_WIDTH`, `DECK_HEIGHT` or the sharpness and a station lands in
  water — unclickable and only findable by opening a browser. One test over `stationsOf(sloop)`
  pins the whole family.
- **`client/log.ts:67-99` exercises 3 of its 16 text branches, and `default: return null` silently
  drops 12 event types.** The sim declares 26 event types and `textOf` handles 14. Whether
  `battle.fired`, `ship.damaged` or `puzzle.scored` is deliberately silent or an oversight is
  written down nowhere, and no test would notice a new event type joining the silent set. The
  `REFUSALS` table is fine — typed `Record<RejectionReason, string>`, so the compiler enforces
  totality, which also makes the `?? 'That cannot be done.'` at `:53` unreachable.
- **`cascadeStepsOf` cannot be unit tested at all.** `scenes/puzzle.ts:453` replays
  `bilge.swapped` / `bilge.cleared` events into an animation timeline and maintains its own board
  state, which is exactly the kind of derivation that goes subtly wrong and exactly what a
  screenshot cannot catch. It is unexported and lives in a module that imports Pixi. Splitting the
  ~60 lines into a Pixi-free `scenes/cascade.ts` would make it testable and take a third off a
  709-line file. The weaker version of the same argument applies to `isoScene.ts` and `planner.ts`
  at 342 lines each, whose logic is more genuinely bound to display objects.

### Naming

- **The depth stride is an unnamed `16`.** `iso/projection.ts:30` returns
  `(tile.x + tile.y) * 16 + layer`. Decision 95 names the quantity and explains it; the code names
  neither, and `TILE_HEIGHT` in the same file is 32, so `16` reads as half a tile height to anyone
  who has not read the analysis document. `const DEPTH_STRIDE = 16` is what the repo's own naming
  rule asks for.

### Verified sound, recorded so the next review need not redo it

The balance parser merge is clean: all 71 `(block, reader-type, key)` triples are identical between
`22ec18e:packages/harness/src/balance.ts` and `packages/sim/src/balanceParse.ts`, with no
transposition between property names and the keys they read. Decision 93's pin compares two
genuinely independent producers and is sensitive to semantic drift (changing `HOME_ISLAND` fails
three tests); a commutative reorder of two opening commands passes, which is correct, because the
pin compares resulting world state. Decision 96's tick fix is right and has no siblings anywhere in
the view. The boundary gate's own tests assert non-zero exit plus the specific message for both
negative fixtures. `npm run check` (453 tests), `npm run build` and the four render smokes were all
re-run from cold on the merged tree and are green.

## 2026-09-02 — development of slice 5 (OPP-12)

The isometric renderer and the playable client. What follows is what the work turned up that was not
worth stopping for.

### The bilging palette is sized by hand and wraps by modulo

`packages/view/src/scenes/puzzle.ts` carries sixteen fill-and-shape pairs and renders colour `n` as
`CELL_COLOURS[n % CELL_COLOURS.length]`. The simulation's ceiling is `MAXIMUM_COLOUR_COUNT`, which is
also sixteen, so today the two agree and no colour repeats. Nothing asserts that they agree. Raising
the ceiling, or shipping a `colourCountByStarLevel` entry above sixteen, would silently render two
different pieces identically — a puzzle that cannot be played correctly, with no test going red. It
is not a defect now because the numbers match; it becomes one the moment either side moves. The fix
is a test pinning the palette length against `MAXIMUM_COLOUR_COUNT`, which needs the palette exported
from a module that does not import Pixi.

### The canvas inset is a CSS variable shared across two packages

`packages/view/src/panels/panels.css` declares `:root { --pp-panel-column: 308px }` and
`packages/app/src/app.css` insets `#stage` by `var(--pp-panel-column, 0px)`. One definition, which is
right, but the consumer lives in a different package and the fallback is silent: if the panel
stylesheet ever stops loading, the canvas quietly grows under the panels again rather than failing.
The same class of coupling already exists in the other direction — `panels.css` hard-codes
`#panels > .pp-overlay` to beat the app shell's `#panels > *` specificity. Both start to matter if
the app shell's host ids change, and neither is covered by a test.

### The battle submit button sits under the chat overlay at 720px

At 1280x720 the planner's `Set the turn` and `Break off` buttons are drawn at the bottom of the
canvas HUD, and the translucent chat history overlaps their top few pixels. They are still readable
and still clickable, and the overlay is translucent by design, but the collision is real and will get
worse on a shorter window. The scene lays its HUD out from the canvas height with no knowledge of the
chat's footprint. It starts to matter at window heights below about 640px, or if the chat gains the
wiki's larger history modes.

### The render smoke baselines are tied to one Chromium revision

`tests/e2e/__screenshots__/*.png` were captured with the Chromium that Playwright 1.62.1 pins. A
Playwright bump re-blesses all four, and a machine with a different revision fails on anti-aliasing
rather than on anything real. This is inherent to screenshot comparison and the `pp-render-smoke`
skill says so, but it means a dependency bump carries a re-bless the reviewer has to judge. The
blank-canvas assertion in the same test is revision-independent and is the part that actually proves
something was drawn.

### Depth sorting is per layer, so a pirate never hides behind a prop

The wiki's scene model has four layers and the implementation honours it: objects and dynamic
entities are separate sorted containers. The consequence is that a walking pirate always draws in
front of a prop, even one standing on a nearer tile. Merging the two into a single sorted list would
fix the occlusion and break the layer model the wiki describes. Nobody will notice until a prop is
tall enough and near enough for a pirate to walk behind it — the palms are the first candidate.

### `open('duty')` is deliberately a no-op

`PanelId` includes `'duty'` because the duty report is part of the wiki's core client surface, but
nothing in the pillage loop needs it, so opening it does nothing at all. A silent no-op is worse than
an absent option if anything ever wires a control to it; today nothing does. Either build the report
or drop the id when the next slice touches the panel deck.

### The Pixi scenes themselves are covered only by screenshots

`tests/view/` covers every module that does not import Pixi — the projection, the grid, the
pathfinder, the tick budget, the client. The scenes, the camera and the radial menu are covered only
by four screenshot comparisons, which prove pixels changed and nothing about behaviour. The
interaction defects this slice found — a prop that could not be clicked, a HUD drawn under the panels
— were both found by hand, not by a test, and a regression in either would be caught the same way.
Driving Pixi under a real browser in the test suite is the only fix, and that is exactly the slow,
flaky surface `06-stack-decision.md` says to keep small.

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
