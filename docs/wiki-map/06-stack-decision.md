# 06 — Stack Decision

**Status:** Decided
**Date:** 2026-09-02
**Scope:** Engine, language, and agent-test architecture for the offline Puzzle Pirates recreation.

---

## Recommendation

**TypeScript on Node.js 24, with a hand-written simulation core that has zero engine dependencies, and PixiJS v8 as a detachable rendering layer.**

Concretely:

| Layer                | Choice                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| Language             | TypeScript 5.x, ESM, strict mode                                       |
| Runtime              | Node.js 24 LTS (dev), same runtime for the sim inside the browser build |
| Simulation core      | Plain TypeScript. No engine, no DOM, no third-party runtime deps        |
| Renderer             | PixiJS v8 (v8.20.1 as of Aug 2026) + `@pixi/tilemap` for isometric      |
| App shell            | Vite dev server now; Tauri or Electron wrapper later for offline distribution |
| Sim tests            | `node --test` (built-in runner) against the pure core                  |
| Agent test harness   | JSON-RPC 2.0 over newline-delimited stdio, optional `POST /rpc`         |
| Render smoke tests   | Playwright, a thin layer only — not the primary test surface            |
| Package manager      | pnpm workspaces (monorepo)                                              |

The decisive move is **not the choice of renderer**. It is the decision that the simulation is an ordinary TypeScript library that never imports Pixi, never touches the DOM, never calls `Date.now()` and never calls `Math.random()`. Under that constraint, "headless mode" is not an engine feature that might be broken — it is the default state of the code. Rendering is the special case that requires a browser, not the other way around.

Every other candidate on the list inverts this: you get a game engine that *also offers* a headless mode, and you spend the project fighting the parts of the engine that leak into your logic.

---

## Why — criterion by criterion

### 1. Agent-drivability (the dominating requirement)

The agent needs to start a session, issue inputs, step deterministically, and assert on state without a GPU or a human.

With a pure TS core this is a function call:

```ts
const sim = Sim.create({ seed: 0xC0FFEE, scenario: 'bilge-tutorial' });
sim.dispatch({ op: 'puzzle.swap', cell: [3, 5], dir: 'right' });
const events = sim.step(30);          // 30 ticks, synchronous, no I/O
assert.equal(sim.state.puzzle.combo, 3);
```

There is no window, no event loop to pump, no render context to fake, no `--headless` flag whose behaviour differs from the real game. The thing the agent tests **is** the thing that ships, because the browser build imports the identical module.

The harness (`packages/harness`) wraps that same object in JSON-RPC so an agent that only has a shell can drive it: `echo '{"jsonrpc":"2.0","id":1,"method":"sim.step","params":{"ticks":30}}' | pp-harness`. That is the full extent of the plumbing required.

Compare: Godot's `Input.parse_input_event()` — the canonical way to inject scripted input — **does not work under `--headless`**; propagated input events are never emitted. The issue ([godotengine/godot#73557](https://github.com/godotengine/godot/issues/73557)) was filed against 4.0 RC2 in February 2023 and is still open. You can work around it by never routing test input through `Input` at all, but that means building a parallel command path — which is exactly the architecture recommended here, minus the engine.

### 2. Determinism and seeded RNG

A pure core lets determinism be *enforced*, not hoped for. Three rules, all mechanically checkable in CI:

- `packages/sim/package.json` declares `"dependencies": {}`. Nothing non-deterministic can be pulled in.
- A lint rule bans `Math.random`, `Date`, `performance`, `crypto`, `setTimeout` and any `import` outside `packages/sim` from the core.
- Gameplay math is integer or fixed-point (Q16.16). Floats live only in the view layer. This removes the entire class of float-accumulation desync that plagues engine-based determinism, and makes per-tick state hashes stable across machines.

In an engine, determinism is a negotiation with the engine's own scheduler, physics step, node ordering and multithreaded systems. Bevy is honest about this — its own testing guidance notes that `DefaultPlugins` cannot be used in tests because `WinitPlugin` and `LogPlugin` must run on the main thread and `RenderPlugin` panics with no GPU. Godot's determinism depends on `--fixed-fps` and on not tripping over physics interpolation. None of that applies to code that is just functions over plain data.

### 3. Fast iteration loop

`node --test packages/sim` runs the entire economy and puzzle suite in well under a second because there is no engine to boot, no shader to compile, no asset import step. Node 24 strips TypeScript types natively (stable since v24.12.0 / v25.2.0, experimental flag removed in v26.0.0), so there is no build step between edit and test.

Contrast: Godot needs a `--headless --import --quit` warm-up pass before tests so resources and classes register; Bevy pays Rust compile times on every logic change; libGDX and MonoGame pay JVM/.NET build plus asset pipeline.

For an autonomous agent pipeline this compounds — the agent's edit-test cycle is the pipeline's throughput.

### 4. Save/load of full game state

Because `WorldState` is plain serialisable data by construction, `JSON.stringify(state)` **is** the save file and `structuredClone(state)` **is** the snapshot. There is no object graph of engine nodes to serialise, no scene tree to reconstruct, no `[Serializable]` annotations to maintain, no "which of these fields is engine-owned" question. Save/load correctness reduces to a round-trip equality test, which is trivially generated.

This is the criterion where engines lose most quietly and most expensively. In Godot or Bevy, "save the full game state" means writing and maintaining a bespoke extraction layer that walks the node tree or the ECS world and hopes it caught everything. Bevy Agent exists precisely because that layer is hard enough to be worth a whole plugin.

### 5. Isometric tile rendering

PixiJS v8 is a WebGPU-first 2D renderer — the fastest way to draw 2D sprites on the web, roughly 3× smaller and ~2× faster at pure rendering than Phaser. Isometric support is a solved problem: `@pixi/tilemap` provides a batched tilemap, and `pixi-tiledmap` (v2.8.x, PixiJS v8-compatible) loads Tiled maps in all orientations including isometric, rendering static layers as batched mesh geometry grouped by texture source.

Isometric projection is ~20 lines of math (`screenX = (x - y) * tw/2`, `screenY = (x + y) * th/2`) plus a depth sort. The hard part of iso is authoring and depth-sorting, not the renderer. Puzzle Pirates' art direction — flat 2D sprites on an iso grid, no 3D — is squarely in Pixi's sweet spot. Puzzle boards are plain 2D grids, and the 24×24 battle board is a grid overlay.

PixiJS v8.18+ also ships official AI agent skills in the npm package, which is a small but real signal for this project's working model.

### 6. Windows install friction

Node + pnpm. `winget install OpenJS.NodeJS.LTS`, `npm i -g pnpm`, done. No SDK, no toolchain, no GPU driver requirement, no native compilation. The autonomous pipeline can bootstrap the whole environment unattended.

### 7. Structured state, not pixels

`state.get` returns a JSON subtree addressed by JSON Pointer. The agent reads `/battle/grid`, `/world/ports/admiral/market`, `/puzzle/session/0/board` as arrays and numbers. It never needs to look at a screenshot to know what happened. Screenshots are reserved for a handful of visual-regression smoke tests, where they belong.

### 8. Testing maturity

Node's built-in test runner is stable, needs no dependencies, supports concurrency, coverage and snapshot testing, and has deterministic test ordering with `--test-random-seed` for replayable shuffles. Playwright covers the browser layer. Both are mainstream, well-documented, and something an agent already knows how to drive.

---

## Alternatives rejected and why

| Option                        | Headless, no GPU         | Renderer detachable      | Scripted input             | Windows friction       | Verdict   |
| ----------------------------- | ------------------------ | ------------------------ | -------------------------- | ---------------------- | --------- |
| TypeScript sim core + Pixi v8 | Yes - core is plain TS   | Total - separate package | Trivial - JSON commands    | Very low               | CHOSEN    |
| Rust + Bevy 0.19              | Yes (MinimalPlugins)     | Good - plugin split      | Good - Bevy Agent JSON-RPC | Medium - compile times | Runner-up |
| Godot 4.6 + C#                | Yes (--headless)         | Partial                  | Broken headless (#73557)   | Low                    | Rejected  |
| Java + libGDX                 | Yes (HeadlessApplication)| Partial - GL leaks in    | Hand-rolled                | Medium - JVM toolchain | Rejected  |
| Python + pygame-ce            | Yes (dummy driver)       | Partial                  | No events in headless      | Low                    | Rejected  |
| MonoGame 3.8.4 + C#           | No headless runtime      | No                       | Hand-rolled                | Medium                 | Rejected  |
| Python + Arcade 3.3           | EGL, Linux only          | No                       | n/a                        | Blocker                | Rejected  |
| Rust + macroquad              | No                       | No                       | Hand-rolled                | Low                    | Rejected  |

### Rust + Bevy 0.19 — the runner-up

Genuinely strong, and the closest thing to a purpose-built answer to this brief. `MinimalPlugins` gives a real headless runtime with `ScheduleRunnerPlugin`; the plugin architecture means the render stack is an explicit opt-in rather than something you disable. Bevy's ECS is plain data, which makes snapshotting tractable.

Most tellingly, [Bevy Agent](https://briansunter.com/projects/bevy-agent) (updated May 2026) is a plugin that does *exactly* what this brief asks: deterministic tick-by-tick stepping via a `SimClock` and a dedicated `AgentTick` schedule, tier-1 snapshots of every registered resource and component with stable entity IDs, action logging with checkpoint indexing and branching, exposed over JSON-RPC across in-process, stdio, HTTP `POST /rpc` and WebSocket transports, with `reset()`, `step(action)`, `snapshot()`, `restore(id)` and branch commands, plus an `agentctl` CLI and a Python client.

**Why it still loses:**

- **Iteration speed.** Rust compile times sit directly in the agent's inner loop. Every logic tweak costs a rebuild. Over thousands of autonomous edit-test cycles this is the dominant cost, and it buys nothing this project needs.
- **The renderer is not detached, only optional.** You still take `bevy_render`'s API shape, asset system and scheduling into your game code. Bevy's own docs warn that `DefaultPlugins` panics without a GPU. The separation is a build configuration, not an architectural wall.
- **Snapshot fidelity requires registration discipline.** Bevy Agent snapshots "every *registered*" component. Forget a `#[reflect]` and your save silently loses state — a failure mode that does not exist when the state is one plain object.
- **2D isometric ergonomics.** Bevy's 2D story is fine but thinner than Pixi's, and iso tilemap tooling is community-maintained and version-churny across Bevy releases.
- **Churn.** Bevy is at 0.19 and still ships breaking changes every release. For a multi-year solo project run by an agent pipeline, that is recurring unpaid maintenance.

**What we take from it:** the JSON-RPC command vocabulary. The agent interface below is deliberately modelled on Bevy Agent's, because it is the right shape.

### Godot 4.6 + C#

Godot 4.6.3 (May 2026) is a capable engine with real headless support: `--headless`, `--fixed-fps` (disables real-time sync), `--quit-after N`, `--disable-render-loop`, and `--script` to run a `SceneTree`/`MainLoop` script standalone. GUT 9 and gdUnit4 are mature. Isometric TileMap support is first-class.

Rejected because:

- **Scripted input is broken headless.** `Input.parse_input_event()` produces no propagated events under `--headless` (issue #73557, open since 2023). Related bugs: it releases all other pressed actions (#95716), and it regressed between 4.1.1 and 4.2.1 (#87692). The one engine facility that would make agent-driven input natural is the one that does not work in the mode we need.
- **CI fragility.** Reliable headless runs need a `--headless --import --quit` warm-up pass and `GODOT_DISABLE_LEAK_CHECKS=1` so the exit code reflects test results rather than editor shutdown noise. That is workable but it is ceremony the agent has to get right every time.
- **State extraction is bespoke.** Reading game state as JSON means writing a serialiser over the node tree by hand and keeping it in sync forever.
- **The simulation cannot be fully detached.** Anything that lives on a `Node` inherits `_process`, the scene tree lifecycle and Godot's own timing. You can push logic into plain C# classes — at which point you are running this recommendation's architecture with a heavier renderer bolted on.

### MonoGame 3.8.4 + C#

Rejected outright. **There is no headless runtime.** The open request ([MonoGame#7121](https://github.com/MonoGame/MonoGame/issues/7121)) is still unaddressed: there are no runtimes that work without a graphics card. `ContentManager` in `MonoGame.Framework.DesktopGL` cannot function without a real graphics device, and MonoGame's own rendering tests use a `GraphicsDeviceTestFixtureBase` that supplies a real `GraphicsDevice`. MonoGame is also a framework, not an engine — you write the iso renderer, the scene management and the tooling yourself, so you pay engine-level effort and get no headless payoff.

### Python + pygame / pygame-ce

`SDL_VIDEODRIVER=dummy` (set before `pygame.init()`) does give a GPU-free run, and it is the standard CI recipe. But:

- **Input events are unavailable under the dummy driver.** The `pygame.key` module does not work headless. Scripted input — the core requirement — has no supported path.
- The dummy driver is a degraded video backend; pygame's own guidance is that it is not uncommon to skip tests under it. Testing against a knowingly different backend undermines the point.
- Python's performance is poor for economy soak tests over thousands of simulated days.
- No type system by default, which matters for agent-authored code.

### Python + Arcade 3.3

Rejected on a hard blocker. Arcade's headless mode (`ARCADE_HEADLESS=true`) is implemented via pyglet's EGL support, and **EGL headless works only on Linux**. This project targets Windows 11. Arcade also requires a real OpenGL context for everything; the renderer is not separable.

### Java + libGDX

`HeadlessApplication` with `HeadlessApplicationConfiguration.updatesPerSecond` is a real, supported headless backend and is the best headless story of the engine group after Bevy. It covers `ApplicationListener`/`Game` lifecycles, non-GL assets, math, files and networking.

Rejected because:

- **GL leaks into the code you want to test.** The moment logic touches `Texture`, `TextureRegion`, `TextureAtlas`, `SpriteBatch`, `ShapeRenderer`, `FrameBuffer`, `Mesh` or `Shader`, headless breaks — the standard workaround is mocking `Gdx.gl` with Mockito ([libgdx#5995](https://github.com/libgdx/libgdx/issues/5995)). Mocking the graphics layer to test game logic is a symptom of the two not being separated.
- JVM + Gradle toolchain on Windows is heavier to bootstrap and slower to iterate than Node.
- Smallest and least active community of the group in 2026; scene2d and iso tooling are dated.

### Rust + macroquad

Rejected. Deliberately a simple immediate-mode framework: `macroquad::main` owns the loop and requires a window and GL context. There is no headless mode and no renderer/simulation split. Excellent for jams, wrong for a testable long-lived simulation.

### Phaser 4 (considered within the TS option, not chosen)

Phaser 4 is stable in 2026 and is the most complete, best-documented 2D HTML5 framework, with batteries included (physics, audio, input, tweens, scenes). Its `Phaser.HEADLESS` renderer type sounds like a fit but is not: it creates neither a Canvas nor a WebGL renderer, **but still absolutely relies on the DOM being present**. Phaser's own guidance is that HEADLESS is meant for unit testing, not for running on the server. Running it in Node requires DOM and canvas polyfills (`@geckos.io/phaser-on-nodejs`), i.e. simulating a browser to test game logic.

Since we are extracting the simulation anyway, Phaser's batteries are mostly dead weight — its scene/physics/input systems would sit unused or actively conflict with the sim. Pixi is the smaller, faster, more honest choice for a pure view layer. **If** the project later wants Phaser's tooling, the sim core is unaffected: only `packages/view` changes.

---

## Project layout

pnpm workspace monorepo. The dependency arrow points one way only: `view → sim`. `sim` imports nothing.

```
offline-puzzle-pirates/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js              # hosts the sim-purity rules
├── dependency-cruiser.config.cjs # enforces the layering in CI
│
├── packages/
│   ├── sim/                      # ── THE CORE ── "dependencies": {}
│   │   ├── package.json
│   │   └── src/
│   │       ├── rng.ts            # PCG32 + splitmix64 stream derivation
│   │       ├── fixed.ts          # Q16.16 fixed-point helpers
│   │       ├── clock.ts          # integer tick, fixed dt. No wall clock.
│   │       ├── ids.ts            # monotonic entity ids from state counter
│   │       ├── state/
│   │       │   ├── world.ts      # WorldState: plain, serialisable, no classes
│   │       │   ├── player.ts
│   │       │   ├── ports.ts
│   │       │   └── ships.ts
│   │       ├── commands.ts       # the Command union - the ONLY mutation path
│   │       ├── events.ts         # what a tick emits (for the view + assertions)
│   │       ├── systems/
│   │       │   ├── puzzle/       # bilge, sails, carpentry, gunnery, distilling…
│   │       │   │   ├── board.ts  # generic tile-grid falling-block model
│   │       │   │   ├── match.ts  # cascade resolution
│   │       │   │   └── scoring.ts
│   │       │   ├── battle/       # 24x24 turn-based sea battle
│   │       │   │   ├── grid.ts
│   │       │   │   ├── orders.ts # move/shoot planning
│   │       │   │   └── resolve.ts# simultaneous turn resolution
│   │       │   ├── economy/
│   │       │   │   ├── market.ts
│   │       │   │   ├── production.ts
│   │       │   │   └── shipping.ts
│   │       │   └── world/
│   │       │       ├── pathing.ts# A* on the iso tile grid (grid coords, integers)
│   │       │       └── npc.ts
│   │       ├── save/
│   │       │   ├── serialize.ts
│   │       │   ├── hash.ts       # canonical-JSON hash, whole-state + per-system
│   │       │   └── migrations/   # v1_to_v2.ts, v2_to_v3.ts …
│   │       ├── sim.ts            # class Sim { dispatch(); step(); state; }
│   │       └── index.ts
│   │
│   ├── harness/                  # JSON-RPC wrapper around Sim. Depends on sim only.
│   │   ├── src/
│   │   │   ├── server.ts         # ndjson stdio loop + optional POST /rpc
│   │   │   ├── methods/          # one file per RPC namespace
│   │   │   └── pointer.ts        # JSON Pointer read of state
│   │   └── bin/pp-harness.ts     # the executable the agent runs
│   │
│   ├── view/                     # PixiJS v8. Reads sim state, emits Commands.
│   │   ├── src/
│   │   │   ├── iso/              # projection, depth sort, tile atlas
│   │   │   ├── scenes/           # port, deck, puzzle, battle
│   │   │   ├── sprites/
│   │   │   └── input/            # pointer/keyboard → Command. Thin. No logic.
│   │   └── package.json          # deps: pixi.js, @pixi/tilemap
│   │
│   ├── app/                      # Vite entry; later the Tauri/Electron shell
│   │
│   └── fixtures/                 # shared across sim tests, harness tests and e2e
│       ├── scenarios/            # named starting states (JSON)
│       ├── replays/              # recorded command logs
│       ├── goldens/              # blessed state snapshots
│       └── saves/                # one save per schema version, for migration tests
│
├── tests/
│   ├── sim/                      # node --test. Pure, fast, the bulk of the suite.
│   ├── harness/                  # protocol-level: does step/snapshot/restore behave
│   └── e2e/                      # Playwright. Render smoke only. Deliberately thin.
│
└── tools/
    ├── replay-diff.ts            # bisect a divergent replay to a tick + system
    ├── bless-goldens.ts
    └── scenario-gen.ts
```

**Enforcement.** Three CI gates keep the wall standing:

1. `packages/sim/package.json` must have an empty `dependencies` object (asserted by a test).
2. `dependency-cruiser` forbids any edge from `packages/sim` to anything outside itself.
3. An ESLint `no-restricted-globals` / `no-restricted-syntax` rule bans `Math.random`, `Date`, `performance.now`, `crypto`, `setTimeout`, `setInterval` and `process` inside `packages/sim`.

If those three pass, headless testability cannot regress.

---

## Determinism and save/load

### Determinism rules

**Integer time.** State carries `tick: number`. A tick is a fixed simulation step (60 per second nominal, but the sim never reads a clock — the *renderer* interpolates between ticks for display). `step(n)` advances exactly `n` ticks. No `deltaTime` enters gameplay math.

**Streamed RNG.** One root seed, many named streams:

```ts
const rng = Rng.fromSeed(seed);
rng.stream('battle.hit').nextInt(0, 100);
rng.stream('market.noise').nextFloat();
```

Each stream's state derives from `splitmix64(seed, hash(name))`, so streams are independent. This matters: adding a cosmetic particle draw or a new market must not shift the draw sequence of an existing system, or every golden test breaks for no reason. Stream cursors are part of the save file.

**Integer and fixed-point gameplay math.** Grid coordinates are integers. Currency (pieces of eight) is whole units. Anything needing fractions uses Q16.16 fixed-point from `fixed.ts`. Floats appear only in `packages/view` for interpolation and easing. This eliminates float-accumulation divergence entirely, which is the single most common source of replay desync.

**Ordered iteration.** No iteration over object key order or `Set`/`Map` insertion order in gameplay-relevant loops. Collections are arrays; lookups that need ordering sort by a stable integer id. Entity ids come from a monotonic counter stored *in* the state, not from UUIDs or timestamps.

**Single-threaded.** The sim is synchronous. No async, no workers, no promises inside a tick.

### Save format

Because the state is already plain data, the save is the state:

```json
{
  "schemaVersion": 7,
  "seed": "0xC0FFEE",
  "tick": 184203,
  "rngCursors": { "battle.hit": 4412, "market.noise": 99120 },
  "state": { "player": {…}, "ports": {…}, "ships": {…}, "economy": {…} }
}
```

- `save.write` → `JSON.stringify`. `save.read` → parse, run migrations, resume.
- **Snapshot** (in-memory, for agent branching) → `structuredClone(state)`. Cheap, exact, no serialiser to maintain.
- **Migrations** are a chain of `vN_to_vN+1(obj)` functions. `fixtures/saves/` holds one real save per historical schema version, and a test loads every one of them forward to current. A save that ever loaded must always load.

### Replay format

A replay stores **inputs, not states**:

```json
{
  "schemaVersion": 7,
  "seed": "0xC0FFEE",
  "scenario": "bilge-tutorial",
  "initialStateHash": "a17f…",
  "commands": [
    { "tick": 12,  "op": "puzzle.swap", "cell": [3,5], "dir": "right" },
    { "tick": 40,  "op": "puzzle.swap", "cell": [1,2], "dir": "up" }
  ],
  "checkpoints": [
    { "tick": 100, "hash": "9c02…" },
    { "tick": 200, "hash": "3fe1…" }
  ]
}
```

`replay.verify` re-runs from the seed and scenario, applies the commands at their ticks, and compares hashes at each checkpoint. On mismatch it reports the first diverging checkpoint, then `tools/replay-diff.ts` bisects within that range and compares **per-system** hashes so the report names the guilty subsystem: *"diverged at tick 143, system `economy.market`."*

This gives three things at once, from one mechanism:
- Regression testing (a replay that passed must keep passing),
- Bug reproduction (any session can be exported as a replay),
- Agent-authored test cases (the agent records a session and blesses it).

---

## Agent test interface

**Transport:** newline-delimited **JSON-RPC 2.0 over stdin/stdout**, from `pp-harness`. One JSON object per line in, one per line out. Chosen over HTTP because the agent already has a shell, there is no port to allocate, no server lifecycle to manage, and no cleanup to leak. `pp-harness --http :7777` exposes the identical method set at `POST /rpc` for long-lived interactive sessions.

**Design principle:** the agent issues **domain commands**, never synthetic mouse events. There are no coordinates in pixels anywhere in this protocol. `puzzle.swap {cell:[3,5]}` — not "click at (412, 288)".

### Session and stepping

| Method            | Params                                 | Returns                                      |
| ----------------- | -------------------------------------- | -------------------------------------------- |
| `session.new`     | `{seed, scenario?, config?}`           | `{sessionId, tick, schemaVersion, stateHash}` |
| `session.load`    | `{path}` or `{save}`                   | `{sessionId, tick, stateHash}`               |
| `session.close`   | `{sessionId}`                          | `{ok}`                                       |
| `sim.step`        | `{ticks}`                              | `{tick, events[], stateHash}`                |
| `sim.runUntil`    | `{pointer, equals?, exists?, maxTicks}`| `{tick, matched, events[]}`                  |
| `sim.dispatch`    | `{commands: Command[]}`                | `{accepted[], rejected[{cmd, reason}]}`      |

`sim.dispatch` queues commands for the next tick and **returns validation results synchronously** — an illegal move (swap outside the board, order a ship into a rock) is rejected with a reason before any time passes. That is a first-class assertion surface: the agent can test rule enforcement without stepping at all.

`sim.runUntil` is what keeps tests readable: *step until the cascade settles*, not *step 47 ticks and hope*.

### Reading state

| Method            | Params                          | Returns                                     |
| ----------------- | ------------------------------- | ------------------------------------------- |
| `state.get`       | `{pointer, depth?}`             | the JSON subtree at that JSON Pointer       |
| `state.hash`      | `{scope?}`                      | `{hash}` whole-state or per-system          |
| `state.diff`      | `{fromSnapshotId}`              | JSON Patch (RFC 6902) from snapshot to now  |
| `events.drain`    | `{since?}`                      | `{events[]}`                                |

`depth` prevents the agent from pulling the entire world when it wants one market. `state.diff` is the highest-value read: after a step, *"what actually changed"* is a short patch rather than two large blobs to compare by eye.

Example pointers:

```
/tick
/player/booty
/player/skills/bilging
/puzzle/session/board            # row-major int array, e.g. 6x12
/puzzle/session/incoming         # queued rows
/puzzle/session/combo
/battle/grid                     # 24x24, 0 = open, ids = occupants
/battle/ships/s1/{pos,heading,damage,orders}
/battle/phase                    # "planning" | "resolving" | "done"
/world/ports/admiral/market/hemp # {bid, ask, stock, lastTrade}
/world/pirates/p1/{tile,activity}
/economy/day
```

### Snapshot, branch, replay

| Method            | Params                          | Returns                                     |
| ----------------- | ------------------------------- | ------------------------------------------- |
| `snapshot.take`   | `{label?}`                      | `{snapshotId, tick, hash}`                  |
| `snapshot.restore`| `{snapshotId}`                  | `{tick, hash}`                              |
| `snapshot.list`   | `{}`                            | `{snapshots[]}`                             |
| `replay.record`   | `{on: true\|false}`             | `{recording}`                               |
| `replay.export`   | `{path}`                        | `{path, commandCount}`                      |
| `replay.play`     | `{path, untilTick?}`            | `{tick, hash}`                              |
| `replay.verify`   | `{path}`                        | `{ok, divergedAtTick?, divergedSystem?}`    |
| `save.write`      | `{path}`                        | `{path, schemaVersion}`                     |
| `rng.cursors`     | `{}`                            | `{stream: drawCount}`                       |

`snapshot.take` + `snapshot.restore` give the agent **branching**: take a snapshot before a decision, try line A, restore, try line B, compare outcomes. That turns exploratory testing ("is this puzzle state winnable?", "does any buy order break the market?") into a mechanical search the agent can run unattended. `rng.cursors` is the desync smoking gun — if two runs diverge, the stream whose draw count differs names the bug.

### A worked session

```jsonc
// agent → harness
{"jsonrpc":"2.0","id":1,"method":"session.new",
 "params":{"seed":"0xC0FFEE","scenario":"bilge-solo"}}
// ← {"result":{"sessionId":"s0","tick":0,"stateHash":"a17f…"}}

{"jsonrpc":"2.0","id":2,"method":"state.get","params":{"pointer":"/puzzle/session/board"}}
// ← {"result":[[2,2,5,1,…],[3,2,2,4,…], …]}          board is data, not pixels

{"jsonrpc":"2.0","id":3,"method":"snapshot.take","params":{"label":"pre-move"}}
// ← {"result":{"snapshotId":"snap0","tick":0,"hash":"a17f…"}}

{"jsonrpc":"2.0","id":4,"method":"sim.dispatch",
 "params":{"commands":[{"op":"puzzle.swap","cell":[3,5],"dir":"right"}]}}
// ← {"result":{"accepted":[0],"rejected":[]}}

{"jsonrpc":"2.0","id":5,"method":"sim.runUntil",
 "params":{"pointer":"/puzzle/session/settling","equals":false,"maxTicks":600}}
// ← {"result":{"tick":73,"matched":true,
//              "events":[{"t":"match","tiles":6},{"t":"cascade","depth":2},
//                        {"t":"score","delta":140}]}}

{"jsonrpc":"2.0","id":6,"method":"state.diff","params":{"fromSnapshotId":"snap0"}}
// ← compact JSON Patch: exactly what the move changed

{"jsonrpc":"2.0","id":7,"method":"snapshot.restore","params":{"snapshotId":"snap0"}}
// now try the alternative move from the identical state
```

Inside `tests/sim`, the same thing is written without the protocol at all — direct calls on `Sim`. The RPC layer exists for the agent's shell-driven exploration and for cross-process scenarios; it is a thin adapter over the same API, and `tests/harness` asserts the two agree.

### Sea battle and economy command vocabulary

```jsonc
{"op":"battle.orders","ship":"s1","moves":["F","F","L"],"guns":["left","none","right"]}
{"op":"battle.commit"}                          // resolve the simultaneous turn
{"op":"battle.grapple","from":"s1","to":"e2"}

{"op":"market.buy","port":"admiral","commodity":"hemp","qty":50,"maxUnitPrice":14}
{"op":"market.sell","port":"admiral","commodity":"cloth","qty":10,"minUnitPrice":30}
{"op":"economy.advanceDays","n":30}             // fast-forward the sim economy

{"op":"world.walk","to":[12,7]}                 // iso tile coords, integers
{"op":"world.interact","target":"npc.shipwright"}
{"op":"duty.start","station":"bilge","difficulty":"fine"}
```

---

## Proposed testing skills

Six reusable Claude Code skills. Each exists because it encodes knowledge the agent would otherwise re-derive (and re-derive slightly differently) on every task.

### 1. `pp-sim-harness`
**The foundation skill.** Boots `pp-harness`, manages the session lifecycle, and carries the full method and command reference plus the JSON Pointer map of the state tree. Every other skill depends on it.
*Does:* start/stop the harness, issue RPC, read state by pointer, tear down cleanly. Knows to prefer `sim.runUntil` over fixed step counts, and to read via `state.diff` rather than dumping the world.
*Why it pays:* without it, every test task begins with the agent rediscovering the protocol and inventing its own pointer paths.

### 2. `pp-scenario-author`
Writes a new deterministic scenario fixture: pick a seed, pin a starting board or port state, record the expected outcome, save to `packages/fixtures/scenarios/`.
*Does:* generates the fixture JSON, adds the matching `node --test` case, verifies it passes twice from a cold start to prove determinism, and checks the seed is not already in use.
*Covers:* puzzle boards, 24×24 battle setups, and port/economy starting conditions, each with its own template.

### 3. `pp-replay-triage`
Given a failing `replay.verify`, find the bug.
*Does:* runs `replay.verify` to get the first bad checkpoint, then `tools/replay-diff.ts` to bisect the tick range, compares per-system hashes to name the diverging subsystem, checks `rng.cursors` for a draw-count mismatch (which almost always means a new RNG call was added to an existing stream instead of a new one), and reports the specific tick, system and likely cause.
*Why it pays:* this is the highest-skill, most repetitive debugging loop in a deterministic sim, and the diagnostic order genuinely matters.

### 4. `pp-golden-state`
Manages blessed state snapshots in `packages/fixtures/goldens/`.
*Does:* creates goldens, renders a readable diff when one changes, and — critically — **refuses to re-bless without classifying the change** as intended-behaviour-change vs regression. Knows that a golden diff confined to `rngCursors` means a stream discipline violation, not a gameplay change.
*Why it pays:* the classic failure mode of golden testing under automation is an agent that blesses every diff to make the suite green.

### 5. `pp-invariant-soak`
Long-horizon property testing for the economy and world sim.
*Does:* runs `economy.advanceDays` for thousands of simulated days across many seeds, asserting invariants after each: no negative stock, no negative booty, currency conserved across trades, no unreachable ports, production chains never deadlock, market prices stay within sane bounds. Reports the seed and day of the first violation, and emits a minimal replay reproducing it.
*Why it pays:* economy bugs are emergent and never surface in short unit tests. This is the test class an autonomous pipeline can run for free overnight.

### 6. `pp-render-smoke`
The only skill that touches a browser. Drives Playwright against the Vite build.
*Does:* loads a fixed seed and scenario, waits for the view layer's explicit `render:ready` signal (never a timeout), forces a fixed tick count, and screenshot-compares against a baseline for the iso port scene, a ship deck, a puzzle board and the battle grid.
*Deliberately narrow:* it asserts that things are *drawn*, never that game rules hold — those belong in `pp-sim-harness` tests. Kept small on purpose so the slow, flaky part of the suite stays small.

---

## Sources

Engines and runtimes:

- [Godot 4.6 release notes](https://godotengine.org/releases/4.6/) and [4.6-stable download archive](https://godotengine.org/download/archive/4.6-stable/) — 4.6.3, May 2026
- [Godot command line tutorial (4.6)](https://docs.godotengine.org/en/4.6/tutorials/editor/command_line_tutorial.html) — `--headless`, `--fixed-fps`, `--quit-after`, `--disable-render-loop`, `--script`
- [godotengine/godot#73557 — `Input.parse_input_event()` does not work in headless mode](https://github.com/godotengine/godot/issues/73557) — open, filed Feb 2023 against 4.0 RC2
- [godotengine/godot#95716 — `parse_input_event` releases all other pressed actions](https://github.com/godotengine/godot/issues/95716)
- [godotengine/godot#87692 — `parse_input_event` does not work in 4.2.1](https://github.com/godotengine/godot/issues/87692)
- [Godot Input class reference](https://docs.godotengine.org/en/stable/classes/class_input.html)
- [CI-tested GUT for Godot 4](https://medium.com/@kpicaza/ci-tested-gut-for-godot-4-fast-green-and-reliable-c56f16cde73d) — headless import warm-up, `GODOT_DISABLE_LEAK_CHECKS=1`
- [bitwes/Gut](https://github.com/bitwes/Gut) and [gdUnit4](https://github.com/Structed/gdUnit4)
- [Bevy headless mode guide (0.19, June 2026)](https://taintedcoders.com/bevy/how-to/headless-mode)
- [Bevy `MinimalPlugins` API](https://librepvz.github.io/librePvZ/bevy/struct.MinimalPlugins.html) — headless runtime via `ScheduleRunnerPlugin`
- [bevyengine/bevy#5931 — plugin for testing Bevy code in CI](https://github.com/bevyengine/bevy/issues/5931) — `DefaultPlugins` unusable in tests; `RenderPlugin` panics with no GPU
- [bevyengine/bevy#2896 — provide a way to test a Bevy App](https://github.com/bevyengine/bevy/issues/2896)
- [Bevy Agent](https://briansunter.com/projects/bevy-agent) — deterministic stepping, snapshot/restore/branch, JSON-RPC over stdio/HTTP/WebSocket
- [MonoGame#7121 — add headless runtime for CI/CD and dedicated servers](https://github.com/MonoGame/MonoGame/issues/7121) — no GPU-free runtime exists
- [MonoGame#7474 — unit testing framework](https://github.com/MonoGame/MonoGame/issues/7474) and [MonoGame/Tests](https://github.com/MonoGame/MonoGame/tree/develop/Tests) — `GraphicsDeviceTestFixtureBase` needs a real device
- [Unit testing MonoGame's content pipeline](https://badecho.com/index.php/2022/09/28/unit-testing-monogame/)
- [libGDX headless backend reference](https://lobehub.com/skills/kyu-n-gdx-claude-skills-libgdx-headless-backend) — `HeadlessApplication`, `updatesPerSecond`
- [libgdx/libgdx#5995 — it would be possible to unit test a GDX game if not for one thing](https://github.com/libgdx/libgdx/issues/5995) — GL objects break headless
- [Creating Texture in headless libGDX unit tests](https://www.debugcn.com/en/article/58647230.html) — Mockito `Gdx.gl` workaround
- [pygame wiki — Headless, no windows needed](https://pygame.org/wiki/HeadlessNoWindowsNeeded) and [dummy video driver](https://www.pygame.org/wiki/DummyVideoDriver/source)
- [pygame/pygame#2377 — use `SDL_VIDEODRIVER=null`](https://github.com/pygame/pygame/issues/2377) — dummy driver limitations, no key events
- [Python Arcade — headless mode](https://api.arcade.academy/en/2.6.17/advanced/headless.html) and [pythonarcade/arcade#1107](https://github.com/pythonarcade/arcade/issues/1107) — EGL, Linux only
- [Arcade OpenGL context docs](https://api.arcade.academy/en/2.6.4/api/open_gl.html)

Web stack:

- [PixiJS releases](https://github.com/pixijs/pixijs/releases) — v8.20.1, 26 Aug 2026
- [PixiJS blog, June 2026](https://pixijs.com/blog/june-2026) — v8.18/8.19, agent skills shipped in the npm package
- [PixiJS v8 launch notes](https://pixijs.com/blog/pixi-v8-launches) — WebGPU-first, `GraphicsContext`
- [@pixi/tilemap](https://www.npmjs.com/package/@pixi/tilemap) — batched tilemap, PixiJS v8.x
- [pixi-tiledmap](https://github.com/riebel/pixi-tiledmap) — v2.8.x, all Tiled orientations incl. isometric, packed batched layers
- [Phaser vs PixiJS 2026](https://generalistprogrammer.com/comparisons/phaser-vs-pixijs) — size and rendering throughput comparison
- [Phaser 4 renderer announcement, April 2026](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games)
- [phaserjs/phaser#5468 — Phaser 3.50 and HEADLESS mode](https://github.com/phaserjs/phaser/issues/5468) — HEADLESS still requires the DOM; intended for unit tests, not servers
- [@geckos.io/phaser-on-nodejs](https://www.npmjs.com/package/@geckos.io/phaser-on-nodejs) — the DOM/canvas polyfill Phaser needs under Node
- [Node.js TypeScript support](https://nodejs.org/api/typescript.html) — type stripping stable v24.12.0/v25.2.0, flag removed v26.0.0; enum/namespace/decorator limits
- [Node.js test runner](https://nodejs.org/docs/latest-v24.x/api/test.html) — built-in runner, `--test-random-seed`
- [Node.js in mid-2026](https://techglock.com/blog/nodejs-mid-2026-trends-native-typescript-test-runner) — Node 24 active, Node 22 LTS floor
- [Playwright](https://www.npmjs.com/package/playwright)

Determinism architecture:

- [Deterministic Lockstep in Networked Games (Mieschke)](https://hdms.bsz-bw.de/frontdoor/deliver/index/docId/7107/file/DeterministicLockstepInNetworkedGamesPaper.pdf) — input-stream replay, shared-seed PRNG
- [How to debug desync in deterministic lockstep games](https://bugnet.io/blog/how-to-debug-desync-in-deterministic-lockstep-games) — separate gameplay and cosmetic RNG streams, single-threaded sim, per-tick state dumps for divergence bisection
- [Deterministic lockstep demo](https://github.com/pietrobassi/deterministic-lockstep-demo)
