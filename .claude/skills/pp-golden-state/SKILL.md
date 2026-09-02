---
name: pp-golden-state
description: Manage blessed whole-state snapshots in packages/fixtures/goldens/ and gate every change to one behind a classification. Use when a task needs to create a golden, read a golden diff, decide whether a golden may be re-blessed, tell an intended behaviour change from a regression, or diagnose a diff confined to rngStreams.
---

# pp-golden-state

A golden is a blessed whole-`WorldState` snapshot: a scenario, a seed, a tick count, the
`stateHash` the harness reported there, and the entire state it reported. It catches the changes
no targeted assertion was written for, which is exactly the class of change that slips through a
review. **It is not a scenario fixture** — that pins only an opening and belongs to
`pp-scenario-author` — and it is **not a thing you update to make a test pass**.

Everything below was executed against the repo. Every command, transcript and console line is
copied from an actual run.

## The rule

**Never re-bless a golden without first classifying the change as an intended behaviour change or
a regression.** There are two legitimate outcomes when a golden fails, and "the suite is red" is
not a classification:

| Classification   | What it means                                         | What you do                     |
| ---------------- | ----------------------------------------------------- | ------------------------------- |
| behaviour change | a change in this branch is supposed to move the state | re-bless, naming the cause      |
| regression       | nothing in this branch should have moved the state    | fix the code, the golden stands |
| unexplained      | you cannot say which of the two it is                 | neither — investigate first     |

The classic failure mode of golden testing under automation is an agent that blesses every diff
to make the suite green. That converts the one test in the repo that catches unplanned change
into a test that catches nothing, and it does so silently, because a re-blessed golden looks
exactly like a passing one. **An unexplained field in the patch is a regression until proven
otherwise, and a partly-explained patch is unexplained.**

## What a golden pins

`packages/fixtures/goldens/bilge-session-idle-minute.json` is 309 lines, so it is not reproduced
here whole; its shape is:

```
node --input-type=module --eval "
import { readFileSync } from 'node:fs';
const golden = JSON.parse(readFileSync(process.argv[1], 'utf8'));
console.log('envelope: ' + Object.keys(golden).join(' '));
console.log('state:    ' + Object.keys(golden.state).join(' '));
console.log('puzzle:   ' + Object.keys(golden.state.puzzle).join(' '));
" packages/fixtures/goldens/bilge-session-idle-minute.json
envelope: scenario seed ticks stateHash state
state:    schemaVersion seed tick nextEntityId rngStreams markers balance puzzle
puzzle:   puzzle board starLevel startedAtTick frame intervalTick totalScore moves bilgePerMille bilgeAccumulator waterLineRow dutyOutputPerMille
```

It is a `bilge-session` on seed `12648430` stepped 3600 ticks with no player input — one
simulated minute of an unattended pump. That horizon is chosen so the golden covers the parts of
the state a short test never reaches: the scoring frame has rotated six times and charged the
stall rule, the bilge has flooded to `504` per mille, the water line has moved from row 9 to
row 6, and the star level has ramped from 0 to 1.

The golden also pins `state.balance`, which is the whole tuning block loaded from `balance.json`.
That is deliberate: **a balance edit that changes behaviour fails this golden**, which is the
signal, not a nuisance. Its `rngStreams` subtree, quoted from the file with each cursor folded
onto one line (the committed file has one field per line):

```json
"rngStreams": {
  "bilge.fill": { "hi": 4084333703, "lo": 593105662, "draws": 162 },
  "marker.drift": { "hi": 2617837418, "lo": 2943882315, "draws": 3600 }
}
```

Two streams, not three. The run never cleared a run of pieces, so `bilge.refill` has never been
drawn from and is absent. Streams appear in state only once drawn, so the *set* of stream names
is itself pinned.

## Create one

Bless it through the protocol. This recipe steps a cold session and writes back exactly what
`sim.step` and `state.get` returned, so the file cannot contain anything the server did not say:

```
node --input-type=module --eval "
import { writeFileSync } from 'node:fs';
import { resultOf, startHarness } from './tests/harness/client.ts';
const [scenario, seed, ticks, out] = process.argv.slice(1);
const harness = startHarness();
const opened = resultOf(await harness.call('session.new', { seed: Number(seed), scenario }));
const session = opened['session'];
const stepped = resultOf(await harness.call('sim.step', { session, ticks: Number(ticks) }));
const state = resultOf(await harness.call('state.get', { session, pointer: '' }))['value'];
await harness.stop();
const golden = { scenario, seed: Number(seed), ticks: Number(ticks), stateHash: stepped['stateHash'], state };
writeFileSync(out, JSON.stringify(golden, null, 2) + '\n');
console.log(out + ' blesses ' + golden.stateHash + ' at tick ' + ticks + '.');
" bilge-session 12648430 3600 packages/fixtures/goldens/bilge-session-idle-minute.json
packages/fixtures/goldens/bilge-session-idle-minute.json blesses 3a34e82ce2c7cb80 at tick 3600.
```

Run against the committed golden it rewrites the file byte-for-byte identically. Confirm that
with a checksum before and after whenever you run it — an unchanged checksum means the recipe and
the fixture still agree, and a changed one means you have just re-blessed something.

Pick the tick count for coverage, not for speed. A golden at tick 10 pins almost nothing a unit
test does not already pin.

## The gate

One test loads the golden, replays it and asserts twice — hash first, then the whole state:

```
test('the blessed bilging golden still matches the state the harness produces', async () => {
  const golden = loadGolden();
  const opened = await openSession(golden.seed, golden.scenario);
  const session = opened['session'] as string;

  const stepped = resultOf(await harness.call('sim.step', { session, ticks: golden.ticks }));

  assert.equal(stepped['stateHash'], golden.stateHash);
  assert.deepEqual(await valueAt(session, ''), golden.state);
});
```

A second test asserts the golden's `balance` still deep-equals the loaded `BALANCE`, so a tuning
edit fails with a message about tuning rather than as an anonymous hash mismatch:

```
node --test tests/harness/bilging.test.ts
✔ a bilging session played through the harness ends in a duty output (207.2827ms)
✔ the committed bilging scenario fixture reproduces its pinned opening board (5.9323ms)
✔ the blessed bilging golden still matches the state the harness produces (32.5232ms)
✔ the blessed golden pins the tuning the balance file was loaded with (0.8538ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 498.9188
```

## Render the diff

`assert.deepEqual` on a 300-line state prints a wall of context. Render an RFC 6902 patch
instead — the same `jsonPatch` the `state.diff` method uses — one line per changed field:

```
node --input-type=module --eval "
import { readFileSync } from 'node:fs';
import { jsonPatch } from './packages/harness/src/patch.ts';
import { resultOf, startHarness } from './tests/harness/client.ts';
const [path, override] = process.argv.slice(1);
const golden = JSON.parse(readFileSync(path, 'utf8'));
const ticks = override === undefined ? golden.ticks : Number(override);
const harness = startHarness();
const opened = resultOf(await harness.call('session.new', { seed: golden.seed, scenario: golden.scenario }));
const session = opened['session'];
await harness.call('sim.step', { session, ticks });
const live = resultOf(await harness.call('state.get', { session, pointer: '' }))['value'];
await harness.stop();
const patch = jsonPatch(golden.state, live);
if (patch.length === 0) console.log(path + ' still matches at tick ' + ticks + '.');
for (const operation of patch) console.log(operation.op + ' ' + operation.path + ' ' + JSON.stringify(operation.value));
" packages/fixtures/goldens/bilge-session-idle-minute.json
packages/fixtures/goldens/bilge-session-idle-minute.json still matches at tick 3600.
```

The optional second argument overrides the tick count, which is how to see the renderer's output
without breaking anything. Pointed one tick past the blessed horizon it prints a real mismatch:

```
node --input-type=module --eval "<the same script>" packages/fixtures/goldens/bilge-session-idle-minute.json 3601
replace /markers/0/x 4
replace /puzzle/bilgeAccumulator 140
replace /puzzle/intervalTick 1
replace /rngStreams/marker.drift/draws 3601
replace /rngStreams/marker.drift/hi 331487432
replace /rngStreams/marker.drift/lo 474788524
replace /tick 3601
```

Seven paths, each nameable: the clock moved, the marker drifted and drew once, the interval
counter advanced, the inflow accumulated one tick's worth. **That is what a classified diff looks
like** — every line accounted for by one named cause. A patch you can read this way is a patch
you can decide on.

## Classify before you touch the file

Work the patch top to bottom and attach a cause to every path. The questions, in order:

1. **Does this branch contain a change that should move this field?** Name it — the commit, the
   function, the balance key. "Probably the puzzle work" is not a name.
2. **Does the blast radius match?** A change to the scoring frame that also moves
   `/puzzle/board/cells` has done more than it claimed. A change to `balance.json` that moves
   nothing under `/balance` did not take effect.
3. **Did the schema move?** `/schemaVersion` in the patch means a migration landed; the golden is
   then re-blessed *because of the migration*, and the migration needs its own committed
   older-schema save under `packages/fixtures/saves/` to prove the forward path.
4. **Is anything left over?** One unexplained path fails the whole classification. Do not
   re-bless the explained fields and shrug at the rest — the file is blessed as a unit.

Only after every path has a name do you re-run the create recipe against the golden's own path
and commit the new file *in the same commit as the change that caused it*. A golden re-blessed
in a commit of its own has lost the evidence that justified it.

## A diff confined to rngStreams

**A golden diff whose every path lies under `/rngStreams` is a stream-discipline violation, not a
gameplay change.** Every gameplay-visible field is identical, and the only thing that moved is a
stream's draw count or cursor. That means a new RNG consumer was added to an *existing* named
stream instead of getting its own. Nothing looks broken yet, because the extra draw has not
reached a decision that matters — but it has shifted every later draw on that stream, so it will
surface downstream as an unreproducible replay at some tick nobody is looking at.

The fix is never to re-bless. Give the new consumer its own stream name beside the code that
draws from it, the way `BILGE_FILL_STREAM` and `BILGE_REFILL_STREAM` are declared, and the golden
goes back to matching on its own.

The repo has no committed example, because the discipline holds. The shape is the one below — a
real `state.diff` over a single `marker-field` tick in which the marker's drift step happened to
be zero, so nothing but the stream and the clock moved. In a golden comparison the `/tick` entry
cannot appear, because both sides sit at the golden's tick, leaving `/rngStreams` alone:

```
-> {"jsonrpc":"2.0","id":6,"method":"state.diff","params":{"session":"s0","fromSnapshotId":"snap0"}}
<- {"jsonrpc":"2.0","id":6,"result":{"patch":[{"op":"replace","path":"/rngStreams/marker.drift/draws","value":4},{"op":"replace","path":"/rngStreams/marker.drift/hi","value":2297222449},{"op":"replace","path":"/rngStreams/marker.drift/lo","value":2041413415},{"op":"replace","path":"/tick","value":4}]}}
```

Two related shapes to recognise:

- **An `add` under `/rngStreams`.** A stream name appearing that was not there before means a
  system drew for the first time. In the idle golden, `bilge.refill` appearing is proof that an
  idle board cleared something, which it must not.
- **`draws` equal but `hi`/`lo` moved.** The stream was seeded differently: the root seed changed
  or the stream's name did.

Take either to `pp-sim-harness`, which carries the full desync triage order.

## Where things are

```
packages/fixtures/goldens/        blessed whole states
packages/fixtures/saves/          older-schema saves the migration tests load
packages/harness/src/patch.ts     the jsonPatch the diff renderer above reuses
tests/harness/bilging.test.ts     the gate, and the balance-pinning assertion
tests/harness/client.ts           the 60-line stdio client every recipe here reuses
```

Run `npm run check` from the repo root before calling a re-bless done. `pp-scenario-author` owns
opening fixtures and replays; `pp-sim-harness` owns the protocol and desync triage.
