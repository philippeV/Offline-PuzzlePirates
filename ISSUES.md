# Known issues

Non-blocking findings, newest first. Blocking findings never land here — they go back to the
analysis stage. Each entry says why it was judged not worth stopping for, and when it will start to
matter.

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
