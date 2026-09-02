---
name: pp-scenario-author
description: Author a named deterministic fixture that pins the opening state of a scenario so a cold harness reproduces it exactly. Use when a task needs to pick and check a seed, pin a puzzle board or world opening into packages/fixtures/scenarios/, record a replay fixture through the protocol, add the matching node --test case, or prove a fixture reproduces twice from a cold start.
---

# pp-scenario-author

A scenario fixture is the pinned *opening* of a named scenario: the seed, the scenario name, the
state hash the harness reports at tick 0, and the handful of fields a reader needs to see. It
exists so a change that silently reshuffles a board or a draw order fails a test instead of
passing quietly. **It is not a golden** — a golden pins the whole world after a run, and belongs
to `pp-golden-state`. A scenario fixture pins tick 0 and nothing after it.

Everything in this skill was executed against the repo. Every transcript, command and console
line below is copied from an actual run.

## The two fixture kinds

| Kind     | Directory                      | Pins                                  | Written by               |
| -------- | ------------------------------ | ------------------------------------- | ------------------------ |
| scenario | `packages/fixtures/scenarios/` | the opening state at tick 0           | the recipe below         |
| replay   | `packages/fixtures/replays/`   | a command log and its per-tick hashes | `tools/record-replay.ts` |

Both are inputs plus hashes, never a transcript of internals. A scenario fixture is read back
through `session.new` and `state.get`; a replay fixture through `replay.verify`. Neither may be
produced by calling into `packages/sim/src` directly — a fixture recorded off-protocol pins the
sim's internals rather than the contract the rest of the repo depends on.

## Pick a seed

A fixture is identified by the pair `(seed, scenario)`, not by the seed alone: `12648430` legally
appears under `marker-field` and under `bilge-session`, because the two scenarios build different
worlds from it. What must not repeat is the pair. List what is taken:

```
grep -rno '"scenario": *"[a-z-]*"\|"seed": *[0-9]*' packages/fixtures
packages/fixtures/goldens/bilge-session-idle-minute.json:2:"scenario": "bilge-session"
packages/fixtures/goldens/bilge-session-idle-minute.json:3:"seed": 12648430
packages/fixtures/goldens/bilge-session-idle-minute.json:8:"seed": 12648430
packages/fixtures/replays/bilge-session.json:2:"seed": 20260902
packages/fixtures/replays/bilge-session.json:3:"scenario": "bilge-session"
packages/fixtures/replays/marker-drift.json:2:"seed": 12648430
packages/fixtures/replays/marker-drift.json:3:"scenario": "marker-field"
packages/fixtures/saves/marker-field-v2.json:1:"seed":12648430
packages/fixtures/scenarios/bilge-opening.json:2:"scenario": "bilge-session"
packages/fixtures/scenarios/bilge-opening.json:3:"seed": 20260902
```

Tests hold seeds too, and they hold them in hex, which the grep above will not find:

```
grep -rn 'SEED = ' tests --include=*.ts
tests/harness/bilging.test.ts:25:const SESSION_SEED = 0xb11ce;
tests/harness/protocol.test.ts:6:const SEED = 0xc0ffee;
tests/sim/migration.test.ts:11:const COMMITTED_V2_SEED = 0xc0ffee;
```

So the seeds already spoken for are `12648430` (`0xc0ffee`), `20260902` and `725454` (`0xb11ce`).
`packages/fixtures/scenarios/bilge-opening.json` and
`packages/fixtures/replays/bilge-session.json` share `20260902` on purpose: the replay's tick 0
is the swap applied to the board the scenario fixture pins, so one fixture documents the other's
starting position. Reuse a pair only when you mean that.

Seeds go over the wire as safe integers, never hex strings. Prefer a date-shaped decimal
(`20260902`) for a fixture and a word-shaped hex constant (`0xb11ce`) for a test.

## Look before you pin

Open the scenario and read the fields you intend to pin, so you pin a board you have seen rather
than whatever came out:

```
-> {"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":20260902,"scenario":"bilge-session"}}
<- {"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":3,"tick":0,"stateHash":"6d973c13249b77d8"}}

-> {"jsonrpc":"2.0","id":2,"method":"state.get","params":{"session":"s0","pointer":"/puzzle/board","depth":1}}
<- {"jsonrpc":"2.0","id":2,"result":{"value":{"width":12,"height":12,"cells":"[144 items]"}}}

-> {"jsonrpc":"2.0","id":3,"method":"state.get","params":{"session":"s0","pointer":"/puzzle/starLevel"}}
<- {"jsonrpc":"2.0","id":3,"result":{"value":0}}

-> {"jsonrpc":"2.0","id":4,"method":"state.get","params":{"session":"s0","pointer":"/puzzle/waterLineRow"}}
<- {"jsonrpc":"2.0","id":4,"result":{"value":9}}

-> {"jsonrpc":"2.0","id":5,"method":"rng.cursors","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":5,"result":{"cursors":{"bilge.fill":{"hi":1970056683,"lo":3813399892,"draws":174}}}}
```

Check the opening is worth pinning before writing it down. For a bilging board that means: the
star level and water line are the documented starting values, `bilge.fill` has drawn and
`bilge.refill` has not, and the board is not already mid-cascade. A seed whose opening is
degenerate is a bad fixture, not an interesting one — pick another.

## Write the fixture

Write it through the protocol. This recipe reads the fields back with `state.get` and pins the
`stateHash` the server reported, so the file can only ever contain what the server said:

```
node --input-type=module --eval "
import { writeFileSync } from 'node:fs';
import { resultOf, startHarness } from './tests/harness/client.ts';
const [scenario, seed, out] = process.argv.slice(1);
const harness = startHarness();
const opened = resultOf(await harness.call('session.new', { seed: Number(seed), scenario }));
const session = opened['session'];
const at = async (pointer) => resultOf(await harness.call('state.get', { session, pointer }))['value'];
const fixture = {
  scenario,
  seed: Number(seed),
  starLevel: await at('/puzzle/starLevel'),
  waterLineRow: await at('/puzzle/waterLineRow'),
  board: await at('/puzzle/board'),
  stateHash: opened['stateHash'],
};
await harness.stop();
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
console.log(out + ' pins ' + fixture.stateHash + '.');
" bilge-session 20260902 packages/fixtures/scenarios/bilge-opening.json
packages/fixtures/scenarios/bilge-opening.json pins 6d973c13249b77d8.
```

Run it against the committed fixture and the file does not change; that is the cheapest proof
the recipe and the fixture still agree. Here is `bilge-opening.json` whole, with the 144 board
cells folded into rows of `width` — the committed file is the same JSON with one array element
per line:

```json
{
  "scenario": "bilge-session",
  "seed": 20260902,
  "starLevel": 0,
  "waterLineRow": 9,
  "board": {
    "width": 12,
    "height": 12,
    "cells": [
      3, 3, 1, 3, 3, 1, 2, 3, 2, 3, 1, 2,
      2, 3, 3, 1, 2, 1, 1, 0, 0, 3, 2, 3,
      3, 2, 2, 1, 3, 2, 3, 3, 0, 2, 2, 0,
      1, 1, 3, 3, 2, 2, 1, 2, 2, 1, 1, 0,
      2, 1, 2, 1, 2, 0, 2, 3, 1, 1, 3, 3,
      0, 2, 2, 0, 3, 1, 0, 3, 2, 3, 2, 1,
      0, 3, 1, 2, 1, 2, 2, 0, 3, 2, 2, 3,
      3, 3, 1, 1, 0, 3, 2, 2, 3, 2, 3, 3,
      3, 1, 3, 1, 3, 3, 0, 3, 0, 0, 2, 0,
      2, 3, 2, 3, 1, 0, 3, 0, 0, 2, 1, 3,
      0, 3, 1, 2, 1, 1, 0, 3, 3, 1, 2, 3,
      2, 2, 3, 3, 0, 0, 1, 2, 1, 3, 2, 0
    ]
  },
  "stateHash": "6d973c13249b77d8"
}
```

`cells` is flat row-major, index `y * width + x`, row 0 at the top. **Array order is part of the
hash**, so a fixture that reorders it for readability is a broken fixture.

## What does not belong in it

- **Derived values.** `waterLineRow` is pinned because it is a published invariant worth failing
  on, not because it is independent; it is a function of `bilgePerMille` and the board height.
  Do not pin a field whose only purpose is to restate another one.
- **Anything the sim does not own.** No timestamps, machine names, durations or paths.
- **Everything.** A fixture carrying the whole `WorldState` is a golden in the wrong directory.
  Pin the opening's identity — the hash plus the fields a human reads — and let
  `pp-golden-state` own whole-state snapshots.

## Add the test

One test per fixture, in the file that owns that scenario, asserting the hash first and the
readable fields second. From `tests/harness/bilging.test.ts`:

```
test('the committed bilging scenario fixture reproduces its pinned opening board', async () => {
  const fixture = loadScenario();

  const opened = await openSession(fixture.seed, fixture.scenario);
  const session = opened['session'] as string;

  assert.equal(opened['stateHash'], fixture.stateHash);
  assert.deepEqual(await valueAt(session, '/puzzle/board'), fixture.board);
  assert.equal(await valueAt(session, '/puzzle/starLevel'), fixture.starLevel);
  assert.equal(await valueAt(session, '/puzzle/waterLineRow'), fixture.waterLineRow);
});
```

The hash assertion is what catches a change; the field assertions are what tell you which change.
Keep both. Load the file with `readFileSync` over a `fileURLToPath(new URL(...))` path so the
test does not depend on the working directory.

## Verify it twice from cold

A fixture that reproduces inside one process proves nothing about process start-up. Open the
scenario in two separate harness processes and compare the reported hash:

```
for run in 1 2; do printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":20260902,"scenario":"bilge-session"}}' | node packages/harness/bin/pp-harness.ts; done
{"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":3,"tick":0,"stateHash":"6d973c13249b77d8"}}
{"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":3,"tick":0,"stateHash":"6d973c13249b77d8"}}
```

Then run the owning test file:

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

Finish with `npm run check` from the repo root. A new fixture that only passes its own file is
not finished.

## Replay fixtures

A replay fixture is the sibling mechanism: same seed and scenario discipline, but it pins a
command log and the hash after every tick rather than a single opening. Author it by writing the
inputs by hand and leaving the recording to the tool. Start from a stub — seed, scenario,
`lastTick`, commands, an empty trail:

```json
{
  "seed": 20260902,
  "scenario": "bilge-session",
  "lastTick": 14,
  "commands": [
    { "tick": 0, "command": { "op": "bilge.swap", "x": 1, "y": 0 } },
    { "tick": 4, "command": { "op": "bilge.swap", "x": 10, "y": 0 } },
    { "tick": 9, "command": { "op": "bilge.swap", "x": 0, "y": 1 } }
  ],
  "hashTrail": [],
  "finalHash": ""
}
```

Then record it. `tools/record-replay.ts` drives `pp-harness` over stdio exactly as a client
would, fills in the trail and rewrites the file in place:

```
node tools/record-replay.ts packages/fixtures/replays/bilge-session.json
packages/fixtures/replays/bilge-session.json records 15 checkpoints ending at f7ec793955e4d75f.
```

The stub above, recorded into a scratch path, comes out byte-identical to the committed
`bilge-session.json`. **Recording must go through the protocol.** Never build a trail by calling
`Sim` directly and never hand-edit a hash: a trail written by hand records what you believed,
and the whole point of the fixture is to record what the server did.

`scenario` is not decoration. `replay.verify` reads it and builds the sim through the same
scenario table `session.new` uses; a bilging replay verified without it silently runs against a
marker board and diverges at tick 0. The committed test asserts both halves:

```
node --test tests/harness/replay.test.ts | grep scenario
✔ the committed bilging replay verifies bit-identically under its own scenario (10.3822ms)
✔ the bilging replay diverges at once when the recorded scenario is dropped (1.7982ms)
✔ replay.verify refuses a scenario it does not know (1.1168ms)
```

## When the fixture legitimately changes

A scenario fixture pins a hash, so any change to `WorldState`'s shape, to the scenario builder,
to `balance.json`, or to a draw order will break it. That is the fixture working. Re-record only
after naming the change that caused it, and re-record replays in the same commit —
`SCHEMA_VERSION` moving 2 to 3 changed every hash in `marker-drift.json`. If you cannot name the
cause you have found a bug, not a stale fixture; take it to `pp-sim-harness` for desync triage.

## Where things are

```
packages/fixtures/scenarios/      pinned openings
packages/fixtures/replays/        recorded command logs and hash trails
packages/harness/src/scenarios.ts the scenario table; a new scenario is a builder here
tools/record-replay.ts            the only supported replay recorder
tests/harness/client.ts           the 60-line stdio client every recipe here reuses
tests/harness/bilging.test.ts     the worked example's test
```

`pp-sim-harness` carries the protocol reference — methods, pointers, rejection reasons and desync
triage. `pp-golden-state` owns whole-state snapshots and the rule about re-blessing them.
