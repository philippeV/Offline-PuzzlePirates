---
name: pp-replay-triage
description: Triage a divergent replay down to a tick and a named system. Use when replay.verify reports ok false, a committed replay fixture stops reproducing, a hash trail disagrees with the harness, or a determinism failure has to be told apart from a schema bump, a balance edit or a dropped scenario before anything is re-recorded.
---

# pp-replay-triage

A replay is inputs, never states: a seed, a scenario, a command log with the tick each command was
issued at, and a hash trail. `replay.verify` replays those inputs against the sim as it stands
today and reports `divergedAtTick`. This skill is what happens next — from `ok:false` to a
sentence of the form *"the divergence is at tick T, in system S, caused by C"*, with C named
before anything is re-recorded.

It is the deep version of the **Triaging a desync** section of `pp-sim-harness`, which owns the
protocol reference. Read that first for the method table and the pointer syntax.

Everything below was executed against this repo. Every transcript, recipe, console line and hash
is copied from an actual run. The only elision is `[...]` standing for a fixture's own `commands`
and `hashTrail` arrays inside a request line, marked where it occurs.

## The triage order

1. **Reproduce it.** Re-run `replay.verify` with the fixture's own `scenario` *and* its
   `hashTrail`. Without the trail you learn only *that* it diverged.
2. **Read both numbers.** `divergedAtTick` says when. `finalHash` against `expectedHash` says
   whether the run ends somewhere else as well.
3. **Walk the trail.** One bad checkpoint and twelve good ones is a different disease from twelve
   bad ones. `replay.verify` reports only the first.
4. **Ask whether the tick is 0.** Tick 0 means *diverged before the first tick*. Three ordinary
   causes look exactly like that and none of them is a sim bug; see below.
5. **Bisect the field.** Open a session, drive the command log to the last good tick, `snapshot.take`,
   step one tick, `state.diff`. The patch names the field.
6. **Name the system** from the field, using the pointer table.
7. **Split RNG from not-RNG** with `rng.cursors` on both sides.
8. **Only then decide.** Fix the code, or re-record with the cause named in the commit. Never the
   other order.

Steps 1 to 3 are cheap and mechanical, and they eliminate most failures before any thinking is
required. Do them in order.

## The fixture this skill is driven against

`packages/fixtures/replays/marker-drift-diverged-at-tick-5.json` is a copy of
`marker-drift.json` with exactly one hash in its trail replaced. It exists so this skill can be
demonstrated on a replay that really does fail, and so the gate below can assert that it still
fails at the tick this file says it does. Its head and its one doctored checkpoint:

```json
{
  "note": "A copy of marker-drift.json with the tick 5 checkpoint replaced by deadbeefdeadbeef. Deliberately unverifiable: replay.verify must report divergedAtTick 5. Do not re-record it - see .claude/skills/pp-replay-triage/SKILL.md.",
  "seed": 12648430,
  "scenario": "marker-field",
  "lastTick": 12,
  ...
    {
      "tick": 5,
      "hash": "deadbeefdeadbeef"
    },
  ...
  "finalHash": "0df21f56de40342e"
}
```

`finalHash` is the true one. Only the tick 5 checkpoint lies, which is what makes it a clean
specimen: the failure comes from the trail alone.

## Step 1 — reproduce the divergence

Pass the fixture straight through. This recipe is the one to reach for on any committed replay,
because it takes the scenario from the file rather than from memory:

```
node --input-type=module --eval "
import { readFileSync } from 'node:fs';
import { resultOf, startHarness } from './tests/harness/client.ts';
const fixture = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const harness = startHarness();
const verified = resultOf(
  await harness.call('replay.verify', {
    seed: fixture.seed,
    scenario: fixture.scenario,
    commands: fixture.commands,
    hashTrail: fixture.hashTrail,
    expectedHash: fixture.finalHash,
  }),
);
await harness.stop();
console.log(JSON.stringify(verified));
" packages/fixtures/replays/marker-drift-diverged-at-tick-5.json
{"ok":false,"tick":12,"finalHash":"0df21f56de40342e","expectedHash":"0df21f56de40342e","divergedAtTick":5}
```

The same call on the wire, with `commands` and `hashTrail` elided:

```
-> {"jsonrpc":"2.0","id":1,"method":"replay.verify","params":{"seed":12648430,"scenario":"marker-field","commands":[...],"hashTrail":[...],"expectedHash":"0df21f56de40342e"}}
<- {"jsonrpc":"2.0","id":1,"result":{"ok":false,"tick":12,"finalHash":"0df21f56de40342e","expectedHash":"0df21f56de40342e","divergedAtTick":5}}
```

Read both numbers before moving. `finalHash` equals `expectedHash`, so the run ends exactly where
it was recorded to end; `ok` is false only because a checkpoint on the way disagreed. That pair —
**a trail failure with a matching final hash** — already rules out every cause that would change
the end state, and points at the recording rather than at the sim.

The opposite pair, `finalHash` different from `expectedHash` with `divergedAtTick` null, means the
trail said nothing about the ticks that moved: either the fixture carries no trail, or the
divergence happened at a tick with no checkpoint. Record a checkpoint per tick and re-run.

## Step 2 — walk the trail

`replay.verify` stops naming ticks after the first bad one, so it cannot tell you whether the run
recovered. Drive the command log yourself and compare every tick:

```
node --input-type=module --eval "
import { readFileSync } from 'node:fs';
import { resultOf, startHarness } from './tests/harness/client.ts';
const fixture = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const recorded = new Map(fixture.hashTrail.map((entry) => [entry.tick, entry.hash]));
const harness = startHarness();
const opened = resultOf(
  await harness.call('session.new', { seed: fixture.seed, scenario: fixture.scenario }),
);
const session = opened['session'];
let hash = opened['stateHash'];
for (let tick = 0; tick <= fixture.lastTick; tick += 1) {
  const issued = fixture.commands.filter((entry) => entry.tick === tick).map((entry) => entry.command);
  if (issued.length > 0) {
    hash = resultOf(await harness.call('sim.dispatch', { session, commands: issued }))['stateHash'];
  }
  const expected = recorded.get(tick);
  const verdict = expected === hash ? 'ok' : 'MISMATCH recorded ' + expected;
  console.log('tick ' + String(tick).padStart(2) + '  live ' + hash + '  ' + verdict);
  if (tick < fixture.lastTick) {
    hash = resultOf(await harness.call('sim.step', { session, ticks: 1 }))['stateHash'];
  }
}
await harness.stop();
" packages/fixtures/replays/marker-drift-diverged-at-tick-5.json
tick  0  live 165150e7121323fa  ok
tick  1  live 66ddaa8161375b70  ok
tick  2  live 59cc75334c752f17  ok
tick  3  live fb40c7b8fe92d948  ok
tick  4  live e28ff53e843bed8c  ok
tick  5  live 562dcb888d924587  MISMATCH recorded deadbeefdeadbeef
tick  6  live d8971c7092f6f298  ok
tick  7  live ff7bc5fedf094bdc  ok
tick  8  live 16721d520935697a  ok
tick  9  live 52e4e06d6700dd39  ok
tick 10  live f9e61d39cfec5c30  ok
tick 11  live b687aa5538295bc4  ok
tick 12  live 0df21f56de40342e  ok
```

The loop is the recorder's loop from `tools/record-replay.ts`: dispatch the tick's commands first,
take the hash *after* them, then step. Get that order wrong and every command-carrying tick reads
as a mismatch.

Three shapes, three diagnoses:

| Walk shows                                | What it means                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| one mismatch, the trail recovers after it | the *recording* is almost certainly wrong at that tick; the sim reproduces  |
| a mismatch at T and at every tick after T | the *state* really diverged at T; carry on to step 3                       |
| every tick mismatches, tick 0 included    | it diverged before tick 0; go to "Three causes that are not bugs"          |

A single isolated mismatch is a hand-edited hash, a truncated write, or a checkpoint copied from
another run. A genuine state divergence normally persists, because the hash covers `/rngStreams`
as well and two cursors realign only by accident. So **if the trail recovers, suspect the file
before the sim** — and confirm it the way step 3 does, by looking at what actually changed over
that tick.

## Step 3 — bisect the tick to a field

When the walk shows a genuine divergence, drive the same command log to the last good tick, take a
snapshot, step exactly one tick, and diff. For this fixture the last good tick is 4, and the
commands to get there are `marker.place` at tick 0 and `marker.move` at tick 3:

```
-> {"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":12648430,"scenario":"marker-field"}}
<- {"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":4,"tick":0,"stateHash":"fc3306ec9b3697cf"}}

-> {"jsonrpc":"2.0","id":2,"method":"sim.dispatch","params":{"session":"s0","commands":[{"op":"marker.place","id":1,"x":4,"y":9}]}}
<- {"jsonrpc":"2.0","id":2,"result":{"results":[{"status":"accepted","events":[{"type":"marker.moved","tick":0,"id":1,"x":4,"y":9}]}],"tick":0,"stateHash":"165150e7121323fa"}}

-> {"jsonrpc":"2.0","id":3,"method":"sim.step","params":{"session":"s0","ticks":3}}
<- {"jsonrpc":"2.0","id":3,"result":{"events":[{"type":"marker.drifted","tick":1,"id":1,"x":4,"y":9},{"type":"marker.drifted","tick":2,"id":1,"x":5,"y":9},{"type":"marker.drifted","tick":3,"id":1,"x":6,"y":9}],"tick":3,"stateHash":"07af4d25885eab36"}}

-> {"jsonrpc":"2.0","id":4,"method":"sim.dispatch","params":{"session":"s0","commands":[{"op":"marker.move","id":1,"dx":2,"dy":0}]}}
<- {"jsonrpc":"2.0","id":4,"result":{"results":[{"status":"accepted","events":[{"type":"marker.moved","tick":3,"id":1,"x":8,"y":9}]}],"tick":3,"stateHash":"fb40c7b8fe92d948"}}

-> {"jsonrpc":"2.0","id":5,"method":"sim.step","params":{"session":"s0","ticks":1}}
<- {"jsonrpc":"2.0","id":5,"result":{"events":[{"type":"marker.drifted","tick":4,"id":1,"x":8,"y":9}],"tick":4,"stateHash":"e28ff53e843bed8c"}}

-> {"jsonrpc":"2.0","id":6,"method":"snapshot.take","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":6,"result":{"snapshotId":"snap0","tick":4,"stateHash":"e28ff53e843bed8c"}}

-> {"jsonrpc":"2.0","id":7,"method":"sim.step","params":{"session":"s0","ticks":1}}
<- {"jsonrpc":"2.0","id":7,"result":{"events":[{"type":"marker.drifted","tick":5,"id":1,"x":8,"y":9}],"tick":5,"stateHash":"562dcb888d924587"}}

-> {"jsonrpc":"2.0","id":8,"method":"state.diff","params":{"session":"s0","fromSnapshotId":"snap0"}}
<- {"jsonrpc":"2.0","id":8,"result":{"patch":[{"op":"replace","path":"/rngStreams/marker.drift/draws","value":5},{"op":"replace","path":"/rngStreams/marker.drift/hi","value":1752688774},{"op":"replace","path":"/rngStreams/marker.drift/lo","value":2847907672},{"op":"replace","path":"/tick","value":5}]}}
```

The hash after tick 0's command, the hash after tick 3's, and the hash at tick 4 are the fixture's
own — `165150e7121323fa`, `fb40c7b8fe92d948`, `e28ff53e843bed8c` — so the drive is correct. The
hash the sim reports at tick 5 is `562dcb888d924587`, and the diff over that tick is four ordinary paths: the
clock, and one draw on `marker.drift` whose step happened to be zero, so the marker did not even
move. **Nothing is wrong at tick 5.** The verdict for this fixture is therefore "the trail is
wrong, the sim is fine", which is exactly what a doctored checkpoint should produce — and the
proof is that `562dcb888d924587` is the hash `marker-drift.json` records at tick 5.

`snapshot.restore` is the other half of this move. Restore to `snap0` and step a different way to
compare two futures from the same state; a restore returns a byte-identical state, so the hash
matches exactly.

When the diff is large, render it a line per path instead of reading raw JSON. The same recipe
also serves for "what does this scenario touch over N ticks", which is how the ownership table
below was checked:

```
node --input-type=module --eval "
import { resultOf, startHarness } from './tests/harness/client.ts';
const [scenario, seed, before, span] = process.argv.slice(1);
const harness = startHarness();
const opened = resultOf(await harness.call('session.new', { seed: Number(seed), scenario }));
const session = opened['session'];
if (Number(before) > 0) await harness.call('sim.step', { session, ticks: Number(before) });
const taken = resultOf(await harness.call('snapshot.take', { session }));
const stepped = resultOf(await harness.call('sim.step', { session, ticks: Number(span) }));
const diffed = resultOf(await harness.call('state.diff', { session, fromSnapshotId: taken['snapshotId'] }));
await harness.stop();
console.log('tick ' + taken['tick'] + ' ' + taken['stateHash'] + ' -> tick ' + stepped['tick'] + ' ' + stepped['stateHash']);
for (const operation of diffed['patch']) {
  console.log(operation.op + ' ' + operation.path + ' ' + JSON.stringify(operation.value));
}
" sea-battle 20260902 0 2100
tick 0 5b4bb08edef83b17 -> tick 2100 5e27765e9b1126d8
replace /battle/ships/0/disengageCounter 9
replace /battle/ships/0/tokens/accumulator 486
replace /battle/ships/0/tokens/forward/0 1
replace /battle/ships/0/tokens/left/0 1
replace /battle/ships/0/tokens/right/0 1
replace /battle/ships/1/disengageCounter 9
replace /battle/ships/1/plan/0/move/kind "move"
add /battle/ships/1/plan/0/move/token "forward"
replace /battle/ships/1/plan/1/move/kind "move"
add /battle/ships/1/plan/1/move/token "right"
replace /battle/ships/1/plan/3/move/kind "move"
add /battle/ships/1/plan/3/move/token "left"
replace /battle/ships/1/tokens/accumulator 591
replace /battle/ships/1/tokens/forward/0 1
replace /battle/ships/1/tokens/left/0 1
replace /battle/ships/1/tokens/right/0 1
replace /battle/turnIndex 1
replace /markers/0/x 0
replace /puzzle/bilgePerMille 294
replace /puzzle/frame/intervals/14/moves 1
replace /puzzle/frame/intervals/15/moves 1
replace /puzzle/frame/intervals/16/moves 1
replace /puzzle/intervalTick 300
replace /puzzle/waterLineRow 8
replace /rngStreams/battle.brigandPlan/draws 17
replace /rngStreams/battle.brigandPlan/hi 1576545563
replace /rngStreams/battle.brigandPlan/lo 3545795585
add /rngStreams/marker.drift {"hi":1149625792,"lo":1029878503,"draws":2100}
replace /ships/0/bilgePerMille 42
replace /ships/0/cannonLoadAccumulator 795500
replace /ships/0/cannonballs 39
replace /ships/0/cannonsLoaded 1
replace /ships/0/speedPerMille 967
replace /ships/1/cannonLoadAccumulator 795500
replace /ships/1/cannonballs 39
replace /ships/1/cannonsLoaded 1
replace /ships/1/speedPerMille 1000
replace /tick 2100
```

One battle turn is 2100 ticks (35 planning seconds at 60 ticks a second), which is why that span
was chosen: it is the shortest one that moves the token pools, the brigand's plan and the turn
counter as well as the per-tick meters. Every path above is nameable, and the table below is how
you name them.

## Step 4 — name the system from the field

`WorldState` has ten top-level members. Every JSON Pointer in a diff starts with one of them, and
each belongs to a module you can open:

| Pointer                                                | Module that owns it                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/schemaVersion`, `/seed`, `/nextEntityId`             | `packages/sim/src/state.ts`, ids from `packages/sim/src/ids.ts`                            |
| `/tick`                                                | `packages/sim/src/clock.ts`, advanced by `packages/sim/src/sim.ts`                         |
| `/rngStreams/<name>`                                   | `packages/sim/src/rng.ts` holds the cursor; the stream belongs to whoever declares the name |
| `/markers/*`                                           | `packages/sim/src/marker.ts`                                                               |
| `/balance`                                             | shape `packages/sim/src/balance.ts`, values `balance.json` via `packages/harness/src/balance.ts` |
| `/puzzle`, `/puzzle/startedAtTick`                     | `packages/sim/src/puzzle/session.ts`                                                       |
| `/puzzle/board`                                        | `packages/sim/src/puzzle/board.ts`, filled and cleared by `packages/sim/src/puzzle/bilging.ts` |
| `/puzzle/frame`, `/puzzle/intervalTick`                | `packages/sim/src/puzzle/frame.ts`                                                         |
| `/puzzle/totalScore`, `/puzzle/moves`                  | `packages/sim/src/puzzle/dispatch.ts`, points from `packages/sim/src/puzzle/scoring.ts`    |
| `/puzzle/bilgePerMille`, `/puzzle/bilgeAccumulator`    | `packages/sim/src/puzzle/session.ts`                                                       |
| `/puzzle/waterLineRow`, `/puzzle/starLevel`            | `packages/sim/src/puzzle/session.ts`, thresholds in `packages/sim/src/puzzle/bilging.ts`   |
| `/puzzle/dutyOutputPerMille`                           | computed by `packages/sim/src/puzzle/frame.ts`, stored by `puzzle/session.ts`, read by `ship/duty.ts` |
| `/ships/*` identity, `crewCount`, `playerStation`      | `packages/sim/src/ship/state.ts`, commissioned by `packages/sim/src/battle/dispatch.ts`    |
| `/ships/*` damage, bilge, speed, cannons, rum          | `packages/sim/src/ship/meters.ts`, class limits in `packages/sim/src/ship/classes.ts`      |
| `/ships/*/poe`, `/cargoUnits`, `/booty*`               | `packages/sim/src/battle/booty.ts`                                                         |
| `/battle`, `/battle/outcome`, `/turnIndex`, `/turnTick`| `packages/sim/src/battle/session.ts`, shape in `packages/sim/src/battle/state.ts`          |
| `/battle/board`                                        | `packages/sim/src/battle/board.ts`, scattered by `battle/setup.ts`, effects in `battle/tiles.ts` |
| `/battle/ships/*/x`, `/y`, `/facing`                   | written by `packages/sim/src/battle/turn.ts`, decided in `battle/collision.ts` and `battle/movement.ts` |
| `/battle/ships/*/tokens`                               | `packages/sim/src/battle/tokens.ts`                                                        |
| `/battle/ships/*/plan`                                 | `packages/sim/src/battle/plan.ts`; a brigand's is written by `battle/brigand.ts`           |
| `/battle/ships/*/disengageCounter`                     | `packages/sim/src/battle/session.ts` counts down, `battle/gunnery.ts` raises it on a hit   |
| `/battle/grappled`                                     | `packages/sim/src/battle/gunnery.ts`                                                       |
| `/battle/sinkingContext`                               | set once when the battle starts, `battle/dispatch.ts` into `battle/state.ts`               |

Three rules for reading the table:

- **The narrowest path wins.** `/battle/ships/0/tokens/accumulator` is `battle/tokens.ts`, not
  `battle/session.ts`, even though `session.ts` is what called into it.
- **A changed field is not always a changed system.** `/tick` and `/rngStreams/*` move on every
  stepped tick; they are noise in a same-tick comparison and signal only in a same-tick-different-run
  one.
- **An `add` or `remove` op is stronger evidence than a `replace`.** A field appearing or
  vanishing is a shape change — a migration, a scenario difference, or a stream drawn for the
  first time — not a value drifting.

## The RNG-stream branch

Six streams are declared, and the declaration is the list — do not trust a doc, including this
one:

```
grep -rn "_STREAM = '" packages/sim/src
packages/sim/src/battle/booty.ts:7:export const BOOTY_POE_STREAM = 'booty.poe';
packages/sim/src/battle/brigand.ts:19:export const BRIGAND_PLAN_STREAM = 'battle.brigandPlan';
packages/sim/src/battle/setup.ts:14:export const BATTLE_BOARD_STREAM = 'battle.board';
packages/sim/src/marker.ts:9:export const DRIFT_STREAM = 'marker.drift';
packages/sim/src/puzzle/bilging.ts:5:export const BILGE_FILL_STREAM = 'bilge.fill';
packages/sim/src/puzzle/bilging.ts:6:export const BILGE_REFILL_STREAM = 'bilge.refill';
```

A stream appears in `/rngStreams` only once it has been drawn from, so the *set* of names is
itself a diagnosis. Open the two sides on the same seed, step both to the divergent tick, and
compare `rng.cursors`. Three outcomes, three different bugs.

**Cursors identical, hashes differ — it is not RNG.** Two sessions on one seed, one of which was
given a `marker.place` before stepping. Both drew five times from `marker.drift` and stand at the
same 64-bit position; the states differ anyway, so the cause is a command, a rule or a field, and
step 3 is where it gets found:

```
-> {"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":12648430,"scenario":"marker-field"}}
<- {"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":4,"tick":0,"stateHash":"fc3306ec9b3697cf"}}

-> {"jsonrpc":"2.0","id":2,"method":"session.new","params":{"seed":12648430,"scenario":"marker-field"}}
<- {"jsonrpc":"2.0","id":2,"result":{"session":"s1","schemaVersion":4,"tick":0,"stateHash":"fc3306ec9b3697cf"}}

-> {"jsonrpc":"2.0","id":3,"method":"sim.dispatch","params":{"session":"s1","commands":[{"op":"marker.place","id":1,"x":4,"y":9}]}}
<- {"jsonrpc":"2.0","id":3,"result":{"results":[{"status":"accepted","events":[{"type":"marker.moved","tick":0,"id":1,"x":4,"y":9}]}],"tick":0,"stateHash":"165150e7121323fa"}}

-> {"jsonrpc":"2.0","id":4,"method":"sim.step","params":{"session":"s0","ticks":5}}
<- {"jsonrpc":"2.0","id":4,"result":{"events":[{"type":"marker.drifted","tick":1,"id":1,"x":8,"y":8},{"type":"marker.drifted","tick":2,"id":1,"x":9,"y":8},{"type":"marker.drifted","tick":3,"id":1,"x":10,"y":8},{"type":"marker.drifted","tick":4,"id":1,"x":10,"y":8},{"type":"marker.drifted","tick":5,"id":1,"x":10,"y":8}],"tick":5,"stateHash":"91467779974464cf"}}

-> {"jsonrpc":"2.0","id":5,"method":"sim.step","params":{"session":"s1","ticks":5}}
<- {"jsonrpc":"2.0","id":5,"result":{"events":[{"type":"marker.drifted","tick":1,"id":1,"x":4,"y":9},{"type":"marker.drifted","tick":2,"id":1,"x":5,"y":9},{"type":"marker.drifted","tick":3,"id":1,"x":6,"y":9},{"type":"marker.drifted","tick":4,"id":1,"x":6,"y":9},{"type":"marker.drifted","tick":5,"id":1,"x":6,"y":9}],"tick":5,"stateHash":"94e8577537928619"}}

-> {"jsonrpc":"2.0","id":6,"method":"rng.cursors","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":6,"result":{"cursors":{"marker.drift":{"hi":1752688774,"lo":2847907672,"draws":5}}}}

-> {"jsonrpc":"2.0","id":7,"method":"rng.cursors","params":{"session":"s1"}}
<- {"jsonrpc":"2.0","id":7,"result":{"cursors":{"marker.drift":{"hi":1752688774,"lo":2847907672,"draws":5}}}}
```

Five drifts each, one cursor, two different worlds.

**Draws equal, `hi`/`lo` differ — the stream was seeded differently.** A cursor is derived from
the root seed and the stream *name* (`deriveSeed` in `packages/sim/src/rng.ts` mixes both), so
this means one of the two moved. A third session in the same process, on seed `725454`:

```
-> {"jsonrpc":"2.0","id":8,"method":"session.new","params":{"seed":725454,"scenario":"marker-field"}}
<- {"jsonrpc":"2.0","id":8,"result":{"session":"s2","schemaVersion":4,"tick":0,"stateHash":"a6cfbe65901e1c5c"}}

-> {"jsonrpc":"2.0","id":9,"method":"sim.step","params":{"session":"s2","ticks":5}}
<- {"jsonrpc":"2.0","id":9,"result":{"events":[{"type":"marker.drifted","tick":1,"id":1,"x":8,"y":8},{"type":"marker.drifted","tick":2,"id":1,"x":7,"y":8},{"type":"marker.drifted","tick":3,"id":1,"x":7,"y":8},{"type":"marker.drifted","tick":4,"id":1,"x":6,"y":8},{"type":"marker.drifted","tick":5,"id":1,"x":5,"y":8}],"tick":5,"stateHash":"8d663278077212cc"}}

-> {"jsonrpc":"2.0","id":10,"method":"rng.cursors","params":{"session":"s2"}}
<- {"jsonrpc":"2.0","id":10,"result":{"cursors":{"marker.drift":{"hi":4001638585,"lo":3239936581,"draws":5}}}}
```

If the seed is the same on both sides, a renamed stream constant is the remaining explanation, and
renaming a stream invalidates every replay that ever drew from it.

**Draw counts differ, or a name appears on one side only — a system drew when it did not before.**
That is the stream-discipline failure `pp-golden-state` describes: a new consumer added to an
existing named stream shifts every later draw on it. Give the new consumer its own stream name.
The counter-example is what correct isolation looks like — `bilge-session` and `sea-battle` on the
same seed carry a byte-identical `bilge.fill` cursor, because the battle draws from streams of its
own:

```
-> {"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":20260902,"scenario":"bilge-session"}}
<- {"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":4,"tick":0,"stateHash":"7bb88eef076da065"}}

-> {"jsonrpc":"2.0","id":2,"method":"rng.cursors","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":2,"result":{"cursors":{"bilge.fill":{"hi":1970056683,"lo":3813399892,"draws":174}}}}

-> {"jsonrpc":"2.0","id":3,"method":"session.new","params":{"seed":20260902,"scenario":"sea-battle"}}
<- {"jsonrpc":"2.0","id":3,"result":{"session":"s1","schemaVersion":4,"tick":0,"stateHash":"5b4bb08edef83b17"}}

-> {"jsonrpc":"2.0","id":4,"method":"rng.cursors","params":{"session":"s1"}}
<- {"jsonrpc":"2.0","id":4,"result":{"cursors":{"bilge.fill":{"hi":1970056683,"lo":3813399892,"draws":174},"battle.board":{"hi":2403128552,"lo":3957959922,"draws":44},"battle.brigandPlan":{"hi":864879501,"lo":624446805,"draws":5}}}}
```

`bilge.refill` and `booty.poe` are absent from both: no run had cleared a set of pieces and no
battle had been won. An absent stream is not a missing stream.

## Three causes that are not bugs

All three of these report `divergedAtTick: 0`, and `divergedAtTick: 0` does not mean "the sim
broke on the first tick". It means **the state was already different before the first tick ran** —
the checkpoint at tick 0 is taken after that tick's commands, so a different opening fails it. The
three are told apart by which replays survive.

### A schema bump

`SCHEMA_VERSION` lives in `packages/sim/src/state.ts` and is part of the hashed state, so raising
it invalidates every trail in the repo at once. Verifying the schema-3 `marker-drift.json` from
commit `dfddd63` against today's schema-4 sim:

```
git show dfddd63:packages/fixtures/replays/marker-drift.json > /tmp/marker-drift-schema3.json
node --input-type=module --eval "<the step 1 recipe>" /tmp/marker-drift-schema3.json
{"ok":false,"tick":12,"finalHash":"0df21f56de40342e","expectedHash":"c05ce3b72f5e5b9f","divergedAtTick":0}
```

Walking that trail (step 2, same file) prints `MISMATCH` on all thirteen checkpoints. Signature:
**every replay fails, at tick 0, whatever its scenario, and the final hash moves too.**

A replay fixture records no `schemaVersion`, so the file cannot tell you which schema it belongs
to — `git log` on `packages/sim/src/state.ts` can. A schema bump also needs a committed
older-schema save under `packages/fixtures/saves/` and a migration test; see `pp-golden-state`.
The recorded hashes in `pp-sim-harness`'s own transcripts (`5a24289acd81a333` at tick 0,
`c05ce3b72f5e5b9f` at tick 12) are the schema-3 ones above, which is what a stale document looks
like from inside this triage.

### A `balance.json` edit

`/balance` is pinned into the hashed state on purpose, so **a tuning change must fail an old
replay** — that is the mechanism working, not a regression. It is visible before a single tick
runs. This recipe builds two sims in-process, because the protocol offers no way to inject a
different tuning; it is a demonstration of cause, never a way to record anything:

```
node --input-type=module --eval "
import { readFileSync, writeFileSync } from 'node:fs';
import { Sim } from '@opp/sim';
import { BALANCE, loadBalance } from './packages/harness/src/balance.ts';
const [seed, block, key, scratch] = process.argv.slice(1);
const file = JSON.parse(readFileSync('balance.json', 'utf8'));
console.log(block + '.' + key + ' is ' + file[block][key]);
file[block][key] += 1;
writeFileSync(scratch, JSON.stringify(file));
const tuned = loadBalance(new URL('file:///' + scratch));
const before = Sim.create({ seed: Number(seed), balance: BALANCE });
const after = Sim.create({ seed: Number(seed), balance: tuned });
console.log('balance.json      ' + before.hash());
console.log('one key raised    ' + after.hash());
console.log('no balance at all ' + Sim.create({ seed: Number(seed) }).hash());
" 20260902 bilging inflowPerMillePerThousandTicks /tmp/tuned-balance.json
bilging.inflowPerMillePerThousandTicks is 140
balance.json      3cc3f685a104d00d
one key raised    4fc6185178262a9c
no balance at all 7c36a92497e88acc
```

Signature: **only the scenarios that load tuning fail.** `marker-field` builds its sim as
`Sim.create({ seed })` with no balance at all (`packages/harness/src/scenarios.ts`), so its
`/balance` is `null` and a tuning edit cannot reach it, while every `bilge-session` and
`sea-battle` replay diverges at tick 0. `git diff balance.json` confirms it in one line, and
`pp-golden-state`'s tuning assertion fails alongside, naming the cause for you.

### A replay recorded or verified without its `scenario`

`replay.verify` builds its own sim through the same scenario table as `session.new`, and an
omitted name silently falls back to `marker-field`. A trail recorded under `bilge-session` and
verified without it therefore runs against a marker board. Recording a short bilging replay over
the protocol and verifying it both ways:

```
node --input-type=module --eval "
import { recordReplay } from './tools/record-replay.ts';
import { resultOf, startHarness } from './tests/harness/client.ts';
const [scenario, seed] = process.argv.slice(1);
const harness = startHarness();
const recorded = await recordReplay(harness, {
  seed: Number(seed),
  scenario,
  commands: [{ tick: 0, command: { op: 'bilge.swap', x: 1, y: 0 } }],
  lastTick: 3,
});
const verify = async (named) =>
  JSON.stringify(
    resultOf(
      await harness.call('replay.verify', {
        seed: recorded.seed,
        scenario: named,
        commands: recorded.commands,
        hashTrail: recorded.hashTrail,
        expectedHash: recorded.finalHash,
      }),
    ),
  );
console.log('with    ' + (await verify(scenario)));
console.log('without ' + (await verify(undefined)));
await harness.stop();
" bilge-session 20260902
with    {"ok":true,"tick":3,"finalHash":"7966d7aa1646d18f","expectedHash":"7966d7aa1646d18f","divergedAtTick":null}
without {"ok":false,"tick":3,"finalHash":"1d02060e8052a5ef","expectedHash":"7966d7aa1646d18f","divergedAtTick":0}
```

Signature: **it passes the moment you pass the scenario**, and the difference between the two
openings is confined to the scenario's own setup. Comparing the two openings directly names it —
the tuning that `bilge-session` loads, the puzzle it starts, and the fill stream that drawing the
board opened:

```
node --input-type=module --eval "
import { jsonPatch } from './packages/harness/src/patch.ts';
import { resultOf, startHarness } from './tests/harness/client.ts';
const [seed, left, right] = process.argv.slice(1);
const harness = startHarness();
const open = async (scenario) => {
  const opened = resultOf(await harness.call('session.new', { seed: Number(seed), scenario }));
  const session = opened['session'];
  const state = resultOf(await harness.call('state.get', { session, pointer: '' }))['value'];
  const cursors = resultOf(await harness.call('rng.cursors', { session }))['cursors'];
  return { hash: opened['stateHash'], state, cursors };
};
const a = await open(left);
const b = await open(right);
await harness.stop();
console.log(left + '  ' + a.hash + '  streams ' + JSON.stringify(Object.keys(a.cursors)));
console.log(right + '  ' + b.hash + '  streams ' + JSON.stringify(Object.keys(b.cursors)));
for (const operation of jsonPatch(a.state, b.state)) console.log(operation.op + ' ' + operation.path);
" 20260902 bilge-session marker-field
bilge-session  7bb88eef076da065  streams ["bilge.fill"]
marker-field  7c36a92497e88acc  streams []
replace /balance
replace /puzzle
remove /rngStreams/bilge.fill
```

Three paths, all of them the scenario's opening. Compare that with a schema bump, which moves
`/schemaVersion` as well, and with a tuning edit, which moves `/balance` and nothing else.

## Re-recording, and when you are allowed to

`tools/record-replay.ts` rewrites a fixture's trail in place from its seed, scenario, `lastTick`
and commands. On a fixture that already agrees with the sim it is a no-op you can prove:

```
sha256sum packages/fixtures/replays/marker-drift.json
993726297dc6ff158457a7cc44d8cc5baef3569972e553f264b91bc71582c91e *packages/fixtures/replays/marker-drift.json
node tools/record-replay.ts packages/fixtures/replays/marker-drift.json
packages/fixtures/replays/marker-drift.json records 13 checkpoints ending at 0df21f56de40342e.
sha256sum packages/fixtures/replays/marker-drift.json
993726297dc6ff158457a7cc44d8cc5baef3569972e553f264b91bc71582c91e *packages/fixtures/replays/marker-drift.json
```

That is the only safe use of it: proving the fixture and the recorder still agree. Pointed at a
failing fixture it does something entirely different — **it writes down whatever the sim does
now**, and the evidence of the failure is gone. Run on a scratch copy of the diverged fixture, it
replaces `deadbeefdeadbeef` with `562dcb888d924587` and drops the `note` field with it; the copy
then verifies green with nothing left to say why. A determinism bug re-recorded this way is
committed, green, and invisible.

The rule, borrowed from `pp-golden-state` because it is the same rule:

| Classification   | What it means                                            | What you do                       |
| ---------------- | -------------------------------------------------------- | --------------------------------- |
| behaviour change | a change in this branch is supposed to move these hashes | re-record, naming the cause       |
| regression       | nothing in this branch should have moved them            | fix the code, the trail stands    |
| unexplained      | you cannot say which of the two it is                    | neither — finish the triage first |

You are allowed to re-record when, and only when, you can finish this sentence: *"the hashes moved
because C, which is in this branch, and C should move them."* A schema bump, a deliberate balance
edit and a rule change are all valid Cs. "The test was red" is not. Re-record in the **same commit
as the change that caused it** — a trail re-recorded in a commit of its own has lost the evidence
that justified it — and re-record every affected fixture together, since a schema bump moves all
of them.

`marker-drift-diverged-at-tick-5.json` is exempt from re-recording by construction: it is supposed
to fail. If a real change ever moves the twelve honest hashes in it, re-record it from
`marker-drift.json` and re-corrupt tick 5 the same way, in the same commit.

## The gate

One test asserts that the committed diverged fixture still reports the tick this file claims, and
that it differs from `marker-drift.json` in exactly one checkpoint — so the skill cannot drift from
the fixture without the suite noticing:

```
node --test tests/harness/replay-triage.test.ts
✔ the diverged fixture reports the tick pp-replay-triage says it reports (251.4523ms)
✔ the diverged fixture differs from the recorded one in exactly one checkpoint (1.7881ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 425.3963
```

`tests/harness/replay.test.ts` holds the rest of the verifier's behaviour — a corrupted middle
checkpoint, a shifted command, an unknown scenario, a dropped one.

## Where things are

```
packages/harness/src/replay.ts                    verifyReplay: the loop, and divergenceAt
packages/harness/src/methods/replay.ts            replay.verify parameter parsing and caps
packages/harness/src/methods/rng.ts               rng.cursors, a straight read of /rngStreams
packages/harness/src/scenarios.ts                 the scenario table both session.new and replay.verify use
packages/harness/src/patch.ts                     the jsonPatch behind state.diff and the recipes here
packages/sim/src/rng.ts                           cursor derivation from root seed and stream name
packages/sim/src/state.ts                         WorldState and SCHEMA_VERSION
packages/fixtures/replays/marker-drift.json       the healthy replay every recipe above starts from
packages/fixtures/replays/marker-drift-diverged-at-tick-5.json  the deliberately failing one
tools/record-replay.ts                            the only supported recorder
tests/harness/client.ts                           the 60-line stdio client every recipe reuses
tests/harness/replay-triage.test.ts               the gate
```

`pp-sim-harness` owns the protocol reference and the short form of this triage.
`pp-scenario-author` owns authoring and recording fixtures. `pp-golden-state` owns whole-state
snapshots and the classification rule this skill borrows.
