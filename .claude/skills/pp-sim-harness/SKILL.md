---
name: pp-sim-harness
description: Drive the Offline Puzzle Pirates simulation headlessly through the pp-harness JSON-RPC server. Use when a task needs to open a seeded session in a named scenario, dispatch marker or puzzle commands, step ticks, assert on state by JSON Pointer, snapshot and restore, record or verify a replay, or triage a determinism desync.
---

# pp-sim-harness

`pp-harness` is a newline-delimited JSON-RPC 2.0 server over stdio that wraps `Sim` from
`@opp/sim`. One JSON object per line in, one per line out, in order. There is no GPU, no DOM,
no browser and no port to allocate.

## Start it

From the repo root:

```
node packages/harness/bin/pp-harness.ts
```

or `npm run harness`. It reads stdin until EOF, so for a scripted run just pipe requests in:

```
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":12648430}}' | node packages/harness/bin/pp-harness.ts
```

For an interactive session, spawn it as a child process and correlate responses by `id`
(`tests/harness/client.ts` is a working 60-line client — reuse it rather than writing another).
Sessions live in the process; killing it discards them.

## Methods

| Method             | Params                                                    | Returns                                               |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| `session.new`      | `{seed, scenario?}`                                       | `{session, schemaVersion, tick, stateHash}`           |
| `sim.dispatch`     | `{session, commands[]}`                                   | `{results[], tick, stateHash}`                        |
| `sim.step`         | `{session, ticks}`                                        | `{events[], tick, stateHash}`                         |
| `sim.runUntil`     | `{session, pointer, equals, maxTicks}`                    | `{matched, ticksStepped, events[], tick, stateHash}`  |
| `state.get`        | `{session, pointer, depth?}`                              | `{value}`                                             |
| `state.diff`       | `{session, fromSnapshotId}`                               | `{patch[]}`                                           |
| `snapshot.take`    | `{session}`                                               | `{snapshotId, tick, stateHash}`                       |
| `snapshot.restore` | `{session, snapshotId}`                                   | `{snapshotId, tick, stateHash}`                       |
| `replay.verify`    | `{seed, scenario?, commands[], hashTrail?, expectedHash}` | `{ok, tick, finalHash, expectedHash, divergedAtTick}` |
| `rng.cursors`      | `{session}`                                               | `{cursors}`                                           |

`seed` is a safe integer, not a hex string. `scenario` may be omitted. Two scenarios exist:
`marker-field`, which is the default, and `bilge-session`, which creates the sim with the tuning
loaded from `balance.json` and dispatches `puzzle.start`. `session.new` reports
`schemaVersion` 3.

`sim.dispatch` applies each command **immediately** — it does not queue for the next tick — and
returns one result per command in order, so rule enforcement is testable without stepping at all.
The tick does not advance.

## A real session

Every line below is copied from an actual run.

```
-> {"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":12648430}}
<- {"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":3,"tick":0,"stateHash":"ff0771da2520290e"}}

-> {"jsonrpc":"2.0","id":2,"method":"state.get","params":{"session":"s0","pointer":"","depth":2}}
<- {"jsonrpc":"2.0","id":2,"result":{"value":{"schemaVersion":3,"seed":12648430,"tick":0,"nextEntityId":2,"rngStreams":{},"markers":["{3 fields}"],"balance":null,"puzzle":null}}}

-> {"jsonrpc":"2.0","id":3,"method":"state.get","params":{"session":"s0","pointer":"/markers/0/x"}}
<- {"jsonrpc":"2.0","id":3,"result":{"value":8}}

-> {"jsonrpc":"2.0","id":4,"method":"sim.dispatch","params":{"session":"s0","commands":[{"op":"marker.place","id":1,"x":4,"y":9},{"op":"marker.move","id":1,"dx":99,"dy":0}]}}
<- {"jsonrpc":"2.0","id":4,"result":{"results":[{"status":"accepted","events":[{"type":"marker.moved","tick":0,"id":1,"x":4,"y":9}]},{"status":"rejected","reason":"destination-outside-field"}],"tick":0,"stateHash":"5a24289acd81a333"}}

-> {"jsonrpc":"2.0","id":5,"method":"sim.step","params":{"session":"s0","ticks":2}}
<- {"jsonrpc":"2.0","id":5,"result":{"events":[{"type":"marker.drifted","tick":1,"id":1,"x":4,"y":9},{"type":"marker.drifted","tick":2,"id":1,"x":5,"y":9}],"tick":2,"stateHash":"aabdb282fe430ece"}}

-> {"jsonrpc":"2.0","id":6,"method":"sim.runUntil","params":{"session":"s0","pointer":"/tick","equals":5,"maxTicks":100}}
<- {"jsonrpc":"2.0","id":6,"result":{"matched":true,"ticksStepped":3,"events":[{"type":"marker.drifted","tick":3,"id":1,"x":6,"y":9},{"type":"marker.drifted","tick":4,"id":1,"x":6,"y":9},{"type":"marker.drifted","tick":5,"id":1,"x":6,"y":9}],"tick":5,"stateHash":"3c3d6a73ebf0bd00"}}
```

`sim.runUntil` checks the pointer before each step and stops the moment it matches, so a state
already satisfying the condition costs zero ticks. It returns `matched:false` with
`ticksStepped == maxTicks` when the budget runs out. Prefer it over guessing a step count.

## Reading state

`pointer` is an RFC 6901 JSON Pointer against the whole `WorldState`. `""` is the root.
Pointers that exist today:

```
/tick                              integer, advanced only by sim.step
/seed                              the root seed
/schemaVersion                     3, alongside /nextEntityId
/markers/0/{id,x,y}                the placeholder domain
/balance                           the pinned tuning, null outside a puzzle scenario
/puzzle                            null until puzzle.start is accepted
/puzzle/board/{width,height,cells} cells is flat row-major, index y * width + x
/puzzle/{starLevel,moves,totalScore,bilgePerMille,waterLineRow,dutyOutputPerMille}
/puzzle/frame/intervals/17         the current ten-second sample
/rngStreams/marker.drift/draws     one draw per stepped tick
/rngStreams/bilge.fill/draws       the opening board only
/rngStreams/bilge.refill/draws     every refill after a clear
```

`depth` truncates: containers deeper than `depth` are replaced by `"{3 fields}"` or
`"[1 items]"`, so you can look at the shape of a large subtree without pulling it all.

After a change, read `state.diff` rather than dumping the world twice. It is an RFC 6902
patch from a snapshot to now:

```
-> {"jsonrpc":"2.0","id":7,"method":"snapshot.take","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":7,"result":{"snapshotId":"snap0","tick":5,"stateHash":"3c3d6a73ebf0bd00"}}

-> {"jsonrpc":"2.0","id":8,"method":"sim.step","params":{"session":"s0","ticks":2}}
<- {"jsonrpc":"2.0","id":8,"result":{"events":[{"type":"marker.drifted","tick":6,"id":1,"x":7,"y":9},{"type":"marker.drifted","tick":7,"id":1,"x":8,"y":9}],"tick":7,"stateHash":"6be5e8069885e3aa"}}

-> {"jsonrpc":"2.0","id":9,"method":"state.diff","params":{"session":"s0","fromSnapshotId":"snap0"}}
<- {"jsonrpc":"2.0","id":9,"result":{"patch":[{"op":"replace","path":"/markers/0/x","value":8},{"op":"replace","path":"/rngStreams/marker.drift/draws","value":7},{"op":"replace","path":"/rngStreams/marker.drift/hi","value":2599081816},{"op":"replace","path":"/rngStreams/marker.drift/lo","value":2416705678},{"op":"replace","path":"/tick","value":7}]}}

-> {"jsonrpc":"2.0","id":10,"method":"snapshot.restore","params":{"session":"s0","snapshotId":"snap0"}}
<- {"jsonrpc":"2.0","id":10,"result":{"snapshotId":"snap0","tick":5,"stateHash":"3c3d6a73ebf0bd00"}}
```

`snapshot.take` + `snapshot.restore` is how you branch: snapshot, try line A, restore, try line B,
compare `stateHash`. A restore returns the byte-identical state, so the hash matches exactly.

## A bilging session

The `bilge-session` scenario opens with a puzzle already running, so `bilge.swap` works from
tick 0. The transcript below is a fresh process, so its `s0` is a bilging session, not the marker
session above. A swap resolves to completion inside the dispatch — combo, gravity, refill and
every chain — and returns one `bilge.cleared` event per resolve step:

```
-> {"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":12648430,"scenario":"bilge-session"}}
<- {"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":3,"tick":0,"stateHash":"881804a6650d82ca"}}

-> {"jsonrpc":"2.0","id":2,"method":"state.get","params":{"session":"s0","pointer":"/puzzle","depth":1}}
<- {"jsonrpc":"2.0","id":2,"result":{"value":{"puzzle":"bilging","board":"{3 fields}","starLevel":0,"startedAtTick":0,"frame":"{1 fields}","intervalTick":0,"totalScore":0,"moves":0,"bilgePerMille":0,"bilgeAccumulator":0,"waterLineRow":9,"dutyOutputPerMille":0}}}

-> {"jsonrpc":"2.0","id":3,"method":"sim.dispatch","params":{"session":"s0","commands":[{"op":"bilge.swap","x":0,"y":0}]}}
<- {"jsonrpc":"2.0","id":3,"result":{"results":[{"status":"accepted","events":[{"type":"bilge.swapped","tick":0,"x":0,"y":0},{"type":"bilge.cleared","tick":0,"chain":0,"cells":[1,2,3],"points":3},{"type":"puzzle.scored","tick":0,"points":3,"totalScore":3,"moves":1}]}],"tick":0,"stateHash":"b0b281301cbf10cd"}}

-> {"jsonrpc":"2.0","id":4,"method":"rng.cursors","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":4,"result":{"cursors":{"bilge.fill":{"hi":4084333703,"lo":593105662,"draws":162},"bilge.refill":{"hi":3513919270,"lo":3998057049,"draws":3}}}}
```

`bilge.swap {x, y}` swaps `(x,y)` with `(x+1,y)`; the swap axis is horizontal, so `x` must be
below `width - 1`. The marker domain still runs here and drifts every tick, so **a long `sim.step`
or `sim.runUntil` in `bilge-session` returns one `marker.drifted` event per tick** — step in small
spans and read `/puzzle` with `state.get` rather than mining a huge event list. Reaching
`waterLineRow` 8 from a fresh board takes 4206 idle ticks.

Every rejection the puzzle can produce, `s0` two ticks on and `s1` a fresh `marker-field` session:

```
-> {"jsonrpc":"2.0","id":6,"method":"sim.dispatch","params":{"session":"s0","commands":[{"op":"bilge.swap","x":11,"y":0},{"op":"puzzle.start","puzzle":"bilging"},{"op":"puzzle.start","puzzle":"sailing"}]}}
<- {"jsonrpc":"2.0","id":6,"result":{"results":[{"status":"rejected","reason":"swap-outside-board"},{"status":"rejected","reason":"puzzle-already-running"},{"status":"rejected","reason":"unknown-puzzle"}],"tick":2,"stateHash":"5f96d42c3e359911"}}

-> {"jsonrpc":"2.0","id":8,"method":"sim.dispatch","params":{"session":"s1","commands":[{"op":"puzzle.start","puzzle":"bilging"},{"op":"bilge.swap","x":0,"y":0}]}}
<- {"jsonrpc":"2.0","id":8,"result":{"results":[{"status":"rejected","reason":"balance-missing"},{"status":"rejected","reason":"no-puzzle-running"}],"tick":0,"stateHash":"ff0771da2520290e"}}
```

Both `stateHash` values are the ones the sessions already carried: **a rejected command changes
nothing.** `balance-missing` is what a `marker-field` session gives back, which is why every
pre-puzzle call site keeps working untouched.

## Replays

A replay is inputs, not states: a seed, a scenario, a command log with the tick each command was
issued at, and a hash trail. A checkpoint at tick `T` is the state at clock `T` **after** every
command issued at `T`. The recorded fixture lives at
`packages/fixtures/replays/marker-drift.json` and is reproduced here whole — the committed file is
the same JSON with one field per line:

```json
{
  "seed": 12648430,
  "scenario": "marker-field",
  "lastTick": 12,
  "commands": [
    { "tick": 0, "command": { "op": "marker.place", "id": 1, "x": 4, "y": 9 } },
    { "tick": 3, "command": { "op": "marker.move", "id": 1, "dx": 2, "dy": 0 } },
    { "tick": 7, "command": { "op": "marker.move", "id": 1, "dx": -3, "dy": 1 } }
  ],
  "hashTrail": [
    { "tick": 0, "hash": "5a24289acd81a333" }, { "tick": 1, "hash": "74015bd72a149df1" },
    { "tick": 2, "hash": "aabdb282fe430ece" }, { "tick": 3, "hash": "4d63eb95e84600e9" },
    { "tick": 4, "hash": "366a2dba72be0725" }, { "tick": 5, "hash": "b3d98ef667bb640e" },
    { "tick": 6, "hash": "7b03f17540ea3761" }, { "tick": 7, "hash": "8b954bcdc8587175" },
    { "tick": 8, "hash": "3420d1ce0176ec8b" }, { "tick": 9, "hash": "079145eea7b0a598" },
    { "tick": 10, "hash": "6699bfeb41b4cff9" }, { "tick": 11, "hash": "17cec1780b298185" },
    { "tick": 12, "hash": "c05ce3b72f5e5b9f" }
  ],
  "finalHash": "c05ce3b72f5e5b9f"
}
```

**Record one** by driving the harness. `session.new` returns the hash at tick 0. Then for each
tick `T` from 0 to `lastTick`: if commands were issued at `T`, `sim.dispatch` them and take the
`stateHash` from that response, otherwise keep the `stateHash` returned by the `sim.step` that
arrived at `T`; append `{tick: T, hash}` to the trail; and `sim.step {ticks:1}` unless `T` is the
last tick. `finalHash` is the last hash appended. Taking the hash after the tick's commands rather
than before them is what makes the trail one `replay.verify` reproduces — the pre-dispatch state
at a tick carrying a command is not something the protocol ever shows you.

`tools/record-replay.ts` does exactly that over the protocol and rewrites a fixture's trail in
place from its seed, scenario, `lastTick` and commands:

```
node tools/record-replay.ts packages/fixtures/replays/marker-drift.json
packages/fixtures/replays/marker-drift.json records 13 checkpoints ending at c05ce3b72f5e5b9f.
```

**Verify one** by passing the fixture straight through (`expectedHash` is the fixture's
`finalHash`; `hashTrail` is optional but without it you only learn *that* it diverged, not where):

```
-> {"jsonrpc":"2.0","id":12,"method":"replay.verify","params":{"seed":12648430,"scenario":"marker-field","commands":[...],"hashTrail":[...],"expectedHash":"c05ce3b72f5e5b9f"}}
<- {"jsonrpc":"2.0","id":12,"result":{"ok":true,"tick":12,"finalHash":"c05ce3b72f5e5b9f","expectedHash":"c05ce3b72f5e5b9f","divergedAtTick":null}}
```

With the recorded hash at tick 5 corrupted, the same call names the tick:

```
<- {"jsonrpc":"2.0","id":13,"result":{"ok":false,"tick":12,"finalHash":"c05ce3b72f5e5b9f","expectedHash":"c05ce3b72f5e5b9f","divergedAtTick":5}}
```

**Always pass `scenario`.** `replay.verify` needs no session — it builds its own sim through the
same scenario table as `session.new`, and omitting the name silently falls back to `marker-field`.
Here is `packages/fixtures/replays/bilge-session.json` verified with its scenario and then without:

```
-> {"jsonrpc":"2.0","id":14,"method":"replay.verify","params":{"seed":20260902,"scenario":"bilge-session","commands":[...],"hashTrail":[...],"expectedHash":"f7ec793955e4d75f"}}
<- {"jsonrpc":"2.0","id":14,"result":{"ok":true,"tick":14,"finalHash":"f7ec793955e4d75f","expectedHash":"f7ec793955e4d75f","divergedAtTick":null}}

-> {"jsonrpc":"2.0","id":15,"method":"replay.verify","params":{"seed":20260902,"commands":[...],"hashTrail":[...],"expectedHash":"f7ec793955e4d75f"}}
<- {"jsonrpc":"2.0","id":15,"result":{"ok":false,"tick":14,"finalHash":"c9a8cf38f75ef112","expectedHash":"f7ec793955e4d75f","divergedAtTick":0}}
```

## Triaging a desync

`divergedAtTick` tells you *when*. `rng.cursors` tells you *why* — it reports each stream's
draw count and 64-bit position (this and the error transcript below resume the marker session
from "A real session", restored to tick 5):

```
-> {"jsonrpc":"2.0","id":11,"method":"rng.cursors","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":11,"result":{"cursors":{"marker.drift":{"draws":5,"hi":1752688774,"lo":2847907672}}}}
```

Order of diagnosis:

1. `replay.verify` with the hash trail gives the first bad tick.
2. Open two sessions on the same seed, step both to that tick, and compare `rng.cursors`.
3. **Draw counts differ** — a system drew from a stream it did not draw from before. That is
   almost always a new RNG call added to an *existing* stream instead of a new named stream, and
   it shifts every later draw. Give the new consumer its own stream name.
4. **Draw counts match but `hi`/`lo` differ** — the same stream was seeded differently, i.e. the
   root seed or the stream name changed.
5. **Cursors identical, hashes differ** — the divergence is not RNG. Take a snapshot at the last
   good tick, step one tick on each side, and `state.diff` to name the field.

Streams appear in state only once drawn: `"rngStreams":{}` on a fresh session is correct, and a
`bilge-session` that has never cleared a run carries `bilge.fill` but no `bilge.refill`.

## Errors

Every failure is a JSON-RPC error object, never a crash. The process keeps serving the next line
after a malformed one. `data.reason` is the stable machine-readable code — assert on that, not on
the message.

| Reason             | Code   | Raised when                                    |
| ------------------ | ------ | ---------------------------------------------- |
| `parse-error`      | -32700 | the line is not JSON                           |
| `invalid-request`  | -32600 | no `"jsonrpc":"2.0"` or no string `method`     |
| `method-unknown`   | -32601 | no such method                                 |
| `invalid-params`   | -32602 | a param is missing, mistyped, or a bad command |
| `internal-error`   | -32603 | anything unforeseen                            |
| `session-unknown`  | -32001 | no session with that id                        |
| `snapshot-unknown` | -32002 | no snapshot with that id                       |
| `scenario-unknown` | -32003 | `session.new` named a scenario that is unknown |
| `pointer-unknown`  | -32004 | the JSON Pointer does not resolve              |

```
-> {"jsonrpc":"2.0","id":14,"method":"sim.step","params":{"session":"nope","ticks":1}}
<- {"jsonrpc":"2.0","id":14,"error":{"code":-32001,"message":"no session named \"nope\"","data":{"reason":"session-unknown"}}}

-> {"jsonrpc":"2.0","id":15,"method":"state.get","params":{"session":"s0","pointer":"/markers/9"}}
<- {"jsonrpc":"2.0","id":15,"error":{"code":-32004,"message":"no element \"9\" in an array of 1","data":{"reason":"pointer-unknown"}}}

-> {"jsonrpc":"2.0","id":16,"method":"sim.step","params":{"session":"s0","ticks":"lots"}}
<- {"jsonrpc":"2.0","id":16,"error":{"code":-32602,"message":"params.ticks must be a safe integer","data":{"reason":"invalid-params"}}}

-> {"jsonrpc":"2.0","id":17,"method":"session.new","params":{"seed":1,"scenario":"bilge-tutorial"}}
<- {"jsonrpc":"2.0","id":17,"error":{"code":-32003,"message":"no scenario named \"bilge-tutorial\"","data":{"reason":"scenario-unknown"}}}

-> { this is not json
<- {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Expected property name or '}' in JSON at position 2 (line 1 column 3)","data":{"reason":"parse-error"}}}

-> {"jsonrpc":"2.0","id":18,"method":"sim.step","params":{"session":"s0","ticks":1}}
<- {"jsonrpc":"2.0","id":18,"result":{"events":[{"type":"marker.drifted","tick":6,"id":1,"x":7,"y":9}],"tick":6,"stateHash":"288ef2eaf6063ecf"}}
```

A structurally invalid command (unknown `op`, missing `dx`) fails the whole `sim.dispatch` call
with `invalid-params`. A well-formed command the rules refuse comes back per-command as
`{"status":"rejected","reason":...}` — the sim's reasons are `unknown-marker`,
`non-integer-coordinate`, `destination-outside-field`, `balance-missing`, `unknown-puzzle`,
`puzzle-already-running`, `no-puzzle-running` and `swap-outside-board`.

## Where things are

```
packages/harness/src/methods/     one file per RPC namespace
packages/harness/src/balance.ts   loads balance.json once, outside the sim
packages/harness/src/scenarios.ts the scenario table session.new and replay.verify share
packages/harness/src/pointer.ts   RFC 6901 read + depth truncation
packages/harness/src/patch.ts     RFC 6902 diff
packages/harness/src/replay.ts    replay format and verification
packages/fixtures/replays/        recorded replays
packages/fixtures/scenarios/      pinned opening states — see pp-scenario-author
packages/fixtures/goldens/        blessed whole states — see pp-golden-state
tests/harness/ and tests/puzzle/  protocol-level and puzzle-rule tests, node --test
```

Run everything with `npm run check` from the repo root (deps gate, typecheck, lint, tests).
Prefer writing a new sim assertion in `tests/sim` or `tests/puzzle` against `Sim` directly; use
`tests/harness` only when the protocol itself is what you are testing.
