---
name: pp-sim-harness
description: Drive the Offline Puzzle Pirates simulation headlessly through the pp-harness JSON-RPC server. Use when a task needs to start a seeded session, dispatch commands, step ticks, assert on state by JSON Pointer, snapshot and restore, record or verify a replay, or triage a determinism desync.
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

| Method             | Params                                         | Returns                                               |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| `session.new`      | `{seed, scenario?}`                            | `{session, schemaVersion, tick, stateHash}`           |
| `sim.dispatch`     | `{session, commands[]}`                        | `{results[], tick, stateHash}`                        |
| `sim.step`         | `{session, ticks}`                             | `{events[], tick, stateHash}`                         |
| `sim.runUntil`     | `{session, pointer, equals, maxTicks}`         | `{matched, ticksStepped, events[], tick, stateHash}`  |
| `state.get`        | `{session, pointer, depth?}`                   | `{value}`                                             |
| `state.diff`       | `{session, fromSnapshotId}`                    | `{patch[]}`                                           |
| `snapshot.take`    | `{session}`                                    | `{snapshotId, tick, stateHash}`                       |
| `snapshot.restore` | `{session, snapshotId}`                        | `{snapshotId, tick, stateHash}`                       |
| `replay.verify`    | `{seed, commands[], hashTrail?, expectedHash}` | `{ok, tick, finalHash, expectedHash, divergedAtTick}` |
| `rng.cursors`      | `{session}`                                    | `{cursors}`                                           |

`seed` is a safe integer, not a hex string. `scenario` may be omitted; the only scenario that
exists today is `marker-field`, which is also the default.

`sim.dispatch` applies each command **immediately** — it does not queue for the next tick — and
returns one result per command in order, so rule enforcement is testable without stepping at all.
The tick does not advance.

## A real session

Every line below is copied from an actual run.

```
-> {"jsonrpc":"2.0","id":1,"method":"session.new","params":{"seed":12648430}}
<- {"jsonrpc":"2.0","id":1,"result":{"session":"s0","schemaVersion":2,"tick":0,"stateHash":"601d6bfac40d3a75"}}

-> {"jsonrpc":"2.0","id":2,"method":"state.get","params":{"session":"s0","pointer":"","depth":2}}
<- {"jsonrpc":"2.0","id":2,"result":{"value":{"schemaVersion":2,"seed":12648430,"tick":0,"nextEntityId":2,"rngStreams":{},"markers":["{3 fields}"]}}}

-> {"jsonrpc":"2.0","id":3,"method":"state.get","params":{"session":"s0","pointer":"/markers/0/x"}}
<- {"jsonrpc":"2.0","id":3,"result":{"value":8}}

-> {"jsonrpc":"2.0","id":4,"method":"sim.dispatch","params":{"session":"s0","commands":[{"op":"marker.place","id":1,"x":4,"y":9},{"op":"marker.move","id":1,"dx":99,"dy":0}]}}
<- {"jsonrpc":"2.0","id":4,"result":{"results":[{"status":"accepted","events":[{"type":"marker.moved","tick":0,"id":1,"x":4,"y":9}]},{"status":"rejected","reason":"destination-outside-field"}],"tick":0,"stateHash":"a147801784293628"}}

-> {"jsonrpc":"2.0","id":5,"method":"sim.step","params":{"session":"s0","ticks":2}}
<- {"jsonrpc":"2.0","id":5,"result":{"events":[{"type":"marker.drifted","tick":1,"id":1,"x":4,"y":9},{"type":"marker.drifted","tick":2,"id":1,"x":5,"y":9}],"tick":2,"stateHash":"9400fa38b2dd2035"}}

-> {"jsonrpc":"2.0","id":6,"method":"sim.runUntil","params":{"session":"s0","pointer":"/tick","equals":5,"maxTicks":100}}
<- {"jsonrpc":"2.0","id":6,"result":{"matched":true,"ticksStepped":3,"events":[{"type":"marker.drifted","tick":3,"id":1,"x":6,"y":9},{"type":"marker.drifted","tick":4,"id":1,"x":6,"y":9},{"type":"marker.drifted","tick":5,"id":1,"x":6,"y":9}],"tick":5,"stateHash":"d5fdac3566ef039b"}}
```

`sim.runUntil` checks the pointer before each step and stops the moment it matches, so a state
already satisfying the condition costs zero ticks. It returns `matched:false` with
`ticksStepped == maxTicks` when the budget runs out. Prefer it over guessing a step count.

## Reading state

`pointer` is an RFC 6901 JSON Pointer against the whole `WorldState`. `""` is the root.
Pointers that exist today:

```
/tick                             integer, advanced only by sim.step
/seed                             the root seed
/schemaVersion
/nextEntityId
/markers/0/{id,x,y}               the placeholder domain
/rngStreams/marker.drift/draws    one draw per stepped tick
```

`depth` truncates: containers deeper than `depth` are replaced by `"{3 fields}"` or
`"[1 items]"`, so you can look at the shape of a large subtree without pulling it all.

After a change, read `state.diff` rather than dumping the world twice. It is an RFC 6902
patch from a snapshot to now:

```
-> {"jsonrpc":"2.0","id":7,"method":"snapshot.take","params":{"session":"s0"}}
<- {"jsonrpc":"2.0","id":7,"result":{"snapshotId":"snap0","tick":5,"stateHash":"d5fdac3566ef039b"}}

-> {"jsonrpc":"2.0","id":8,"method":"sim.step","params":{"session":"s0","ticks":2}}
<- {"jsonrpc":"2.0","id":8,"result":{"events":[{"type":"marker.drifted","tick":6,"id":1,"x":7,"y":9},{"type":"marker.drifted","tick":7,"id":1,"x":8,"y":9}],"tick":7,"stateHash":"b4276137d692bcd1"}}

-> {"jsonrpc":"2.0","id":9,"method":"state.diff","params":{"session":"s0","fromSnapshotId":"snap0"}}
<- {"jsonrpc":"2.0","id":9,"result":{"patch":[{"op":"replace","path":"/markers/0/x","value":8},{"op":"replace","path":"/rngStreams/marker.drift/draws","value":7},{"op":"replace","path":"/rngStreams/marker.drift/hi","value":2599081816},{"op":"replace","path":"/rngStreams/marker.drift/lo","value":2416705678},{"op":"replace","path":"/tick","value":7}]}}

-> {"jsonrpc":"2.0","id":10,"method":"snapshot.restore","params":{"session":"s0","snapshotId":"snap0"}}
<- {"jsonrpc":"2.0","id":10,"result":{"snapshotId":"snap0","tick":5,"stateHash":"d5fdac3566ef039b"}}
```

`snapshot.take` + `snapshot.restore` is how you branch: snapshot, try line A, restore, try line B,
compare `stateHash`. A restore returns the byte-identical state, so the hash matches exactly.

## Replays

A replay is inputs, not states: a seed, a command log with the tick each command was issued at,
and a hash trail. A checkpoint at tick `T` is the state at clock `T` **after** every command
issued at `T`. The recorded fixture lives at `packages/fixtures/replays/marker-drift.json` and is
reproduced here whole — the committed file is the same JSON with one field per line:

```json
{
  "seed": 12648430,
  "scenario": "marker-field",
  "commands": [
    { "tick": 0, "command": { "op": "marker.place", "id": 1, "x": 4, "y": 9 } },
    { "tick": 3, "command": { "op": "marker.move", "id": 1, "dx": 2, "dy": 0 } },
    { "tick": 7, "command": { "op": "marker.move", "id": 1, "dx": -3, "dy": 1 } }
  ],
  "hashTrail": [
    { "tick": 0, "hash": "a147801784293628" },
    { "tick": 1, "hash": "cf51698cdc80fdda" },
    { "tick": 2, "hash": "9400fa38b2dd2035" },
    { "tick": 3, "hash": "2864b451dcca1802" },
    { "tick": 4, "hash": "027122a3ce9b088e" },
    { "tick": 5, "hash": "5f9b4c06037ce0f5" },
    { "tick": 6, "hash": "34fb3c5b4703457a" },
    { "tick": 7, "hash": "0dd99362255cf246" },
    { "tick": 8, "hash": "63f537cbe7b3a358" },
    { "tick": 9, "hash": "53faf936df1fbbdb" },
    { "tick": 10, "hash": "de8d660029621392" },
    { "tick": 11, "hash": "4be3fafae056d2fe" },
    { "tick": 12, "hash": "bf6370fad4b0fb94" }
  ],
  "finalHash": "bf6370fad4b0fb94"
}
```

**Record one** by driving the harness. `session.new` returns the hash at tick 0. Then for each
tick `T` from 0 to the last: if commands were issued at `T`, `sim.dispatch` them and take the
`stateHash` from that response, otherwise keep the `stateHash` returned by the `sim.step` that
arrived at `T`; append `{tick: T, hash}` to the trail; and `sim.step {ticks:1}` unless `T` is the
last tick. `finalHash` is the last hash appended. Taking the hash after the tick's commands rather
than before them is what makes the trail one `replay.verify` reproduces — the pre-dispatch state
at a tick carrying a command is not something the protocol ever shows you.

`tools/record-replay.ts` does exactly that over the protocol and rewrites a fixture's trail in
place from its seed, scenario and commands:

```
node tools/record-replay.ts packages/fixtures/replays/marker-drift.json
```

**Verify one** by passing the fixture straight through (`expectedHash` is the fixture's
`finalHash`; `hashTrail` is optional but without it you only learn *that* it diverged, not where):

```
-> {"jsonrpc":"2.0","id":12,"method":"replay.verify","params":{"seed":12648430,"commands":[...],"hashTrail":[...],"expectedHash":"bf6370fad4b0fb94"}}
<- {"jsonrpc":"2.0","id":12,"result":{"ok":true,"tick":12,"finalHash":"bf6370fad4b0fb94","expectedHash":"bf6370fad4b0fb94","divergedAtTick":null}}
```

With the recorded hash at tick 5 corrupted, the same call names the tick:

```
<- {"jsonrpc":"2.0","id":13,"result":{"ok":false,"tick":12,"finalHash":"bf6370fad4b0fb94","expectedHash":"bf6370fad4b0fb94","divergedAtTick":5}}
```

`replay.verify` needs no session; it builds its own sim from the seed.

## Triaging a desync

`divergedAtTick` tells you *when*. `rng.cursors` tells you *why* — it reports each stream's
draw count and 64-bit position:

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

Streams appear in state only once drawn: `"rngStreams":{}` on a fresh session is correct.

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
<- {"jsonrpc":"2.0","id":18,"result":{"events":[{"type":"marker.drifted","tick":6,"id":1,"x":7,"y":9}],"tick":6,"stateHash":"8dc391570d3915f4"}}
```

A structurally invalid command (unknown `op`, missing `dx`) fails the whole `sim.dispatch` call
with `invalid-params`. A well-formed command the rules refuse comes back per-command as
`{"status":"rejected","reason":...}` — the sim's reasons are `unknown-marker`,
`non-integer-coordinate` and `destination-outside-field`.

## Where things are

```
packages/harness/src/methods/   one file per RPC namespace
packages/harness/src/pointer.ts RFC 6901 read + depth truncation
packages/harness/src/patch.ts   RFC 6902 diff
packages/harness/src/replay.ts  replay format and verification
packages/fixtures/replays/      recorded replays
tests/harness/                  protocol-level tests, node --test
```

Run everything with `npm run check` from the repo root (deps gate, typecheck, lint, tests).
Prefer writing a new sim assertion in `tests/sim` against `Sim` directly; use `tests/harness`
only when the protocol itself is what you are testing.
