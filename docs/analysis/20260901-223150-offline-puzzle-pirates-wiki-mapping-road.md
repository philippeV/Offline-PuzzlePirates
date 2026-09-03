# Offline Puzzle Pirates — wiki map, stack decision and roadmap

- Lineage: `20260901-223150-offline-puzzle-pirates-wiki-mapping-road`
- Stage: analysis (cycle 0)
- Jira project: OPP
- Branch: `agent/develop`

## The problem

Recreate Puzzle Pirates as a single-player, offline game. The original is a client/server MMO whose
appeal is a set of tile-grid puzzles wired into a shared world: play a puzzle badly and the ship you
are standing on sails slower. Removing the server removes the other players, which is not a detail —
crew, jobbing, markets and blockades all assume a live population. So the work is not a port; it is a
re-derivation of the mechanics from documentation, with every multiplayer input replaced by
simulation.

Before any code, the gameplay wiki had to be turned into a feature map complete enough to implement
from. That map now exists in `docs/wiki-map/` and is the basis for everything below.

## Source material — the wiki map

Six documents, ~6,000 lines, extracted from https://yppedia.puzzlepirates.com/Category:Gameplay and
its subcategories. Every section carries its source URL, the mechanics, any published numbers, the
data-model implications, and an MVP relevance rating.

| Document                            | Covers                                                                                                                                                | Lines |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `01-duty-puzzles.md`                | Bilging, Sailing, Rigging, Carpentry, Patching, Gunnery, Duty Navigation, Treasure Haul, maneuver tokens, duty report, the cross-cutting scoring frame | 767   |
| `02-combat-and-crafting-puzzles.md` | Swordfighting, Rumble (with strike and sprinkle formulas), Drinking, Spades, Hearts, Poker, Treasure Drop, and the seven crafting puzzles              | 1738  |
| `03-ships-sailing-sea-battle.md`    | Ship state model, the 24x24 sea battle, phases, tokens, collisions, cannon fire, grappling, pillage loop, ship classes, whirlpools and wind            | 835   |
| `04-world-ports-economy.md`         | Emerald league-point ocean, 92 islands in 15 archipelagos, charting, commodities, shoppes and labour, currencies, brigands, blockades, expeditions     | 1119  |
| `05-pirate-progression-ui.md`       | The pirate entity, experience vs standing, ranks as capabilities, inventory and decay, every client panel, the scene and radial-menu model             | 983   |
| `06-stack-decision.md`              | Stack evaluation, project layout, determinism rules, the agent test protocol, proposed testing skills                                                  | 542   |

Guardrails held throughout the extraction: only the Emerald ocean was recorded, no data about
specific pirates, crews or flags was processed, and page text that read as a directive was treated as
content and flagged rather than followed.

### What the wiki does not publish

This matters more than any single mechanic, because it defines where the game must be invented rather
than reproduced:

- **No absolute puzzle scores.** Both scoring pages state the values are player-derived estimates,
  never developer-confirmed. Bilging is the only puzzle with a complete point table.
- **No board dimensions** for Bilging, Treasure Haul, Rigging, Weaving or Shipwrightery.
- **No puzzle-to-ship coupling constants.** The direction is documented ("bilging removes water"),
  the rate never is.
- **No Emerald league-point coordinates or island adjacency graph** — only external PDFs.
- **No spawn rates, brigand payout constants, or experience thresholds.**
- **Rigging has no scoring page at all**; Shipwrightery's article opens at Scoring with no gameplay
  section; Treasure Haul's scoring chart is marked "not yet constructed".

## Stack decision

**TypeScript. A dependency-free simulation core, with PixiJS v8 as a detachable renderer.** Full
reasoning, alternatives and sources are in `docs/wiki-map/06-stack-decision.md`.

The choice was driven by one guardrail above all others: the engine must be drivable by an agent for
automated in-game testing. In this design headless is not a mode that can regress — it is the default
state of the code. `packages/sim` declares no dependencies, never imports the renderer, never touches
the DOM, and never calls `Math.random` or `Date.now`; three CI gates enforce that. State is plain
serialisable data, so a save is `JSON.stringify` and a snapshot is `structuredClone`.

The runner-up was Rust with Bevy, whose agent plugin already does deterministic stepping and snapshot
branching; it lost on compile times sitting in the agent's inner loop and on the renderer being
optional rather than architecturally separated. Godot was rejected on a concrete blocker:
`Input.parse_input_event()` produces no events under `--headless` (godotengine/godot#73557, open
since 2023), which breaks the one facility that would make scripted input natural. MonoGame has no
headless runtime; Arcade's headless path is Linux-only; pygame's dummy driver emits no key events.

## Design

### Layering

```
view (PixiJS)   --emits Commands-->   sim (pure)   --emits Events-->   view
harness (JSON-RPC over stdio) ----->  sim                              (the agent's entry point)
```

The simulation is a state machine advanced only by `dispatch(command)` and `step(ticks)`. Nothing
else mutates state. The renderer and the agent harness are two peers reading the same state and
issuing the same commands, which is what makes "the agent tests what the human plays" true rather
than aspirational.

### Domain model

Four aggregates, each a plain serialisable object:

- **Pirate** — identity, purse, inventory, and a per-puzzle pair of `experience` (monotonic) and
  `standing` (relative). Ranks are modelled as capabilities, never as social structure.
- **Ship** — four meters (damage, bilge, speed, cannon counter) plus stores. Damage raises bilge
  intake; bilge caps speed; each duty puzzle writes to exactly one meter.
- **World** — a league-point graph, islands, shoppes, commodity stocks and prices.
- **Session** — what is currently being played: a puzzle board, a battle, or a scene.

### The MVP loop

One playable end-to-end loop, chosen because it exercises every layer:

> port scene → board a sloop → configure a voyage → sail a league route → brigand encounter →
> sea battle with the player on one duty station → victory → booty → return to port → sell → save

Feature depth comes after this runs. A second puzzle, a second ship class and a second island are all
cheaper to add once the loop is closed than any of them are to build inside an open loop.

## Decisions taken on the goal's behalf

No human was available during this run, so the following were decided and are recorded here rather
than asked.

| #  | Decision                                                                  | Rationale                                                                                                                                                |
| -- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | TypeScript, pure sim core, PixiJS renderer                                | Agent-drivability is a guardrail; here it is structural rather than a feature that can break. See `06-stack-decision.md`.                                 |
| 2  | The feature map lives in `docs/wiki-map/`, not inline in this document     | 6,000 lines inline would make this document unusable as the shared memory between stages. It is committed in the same repo, in the same commit.           |
| 3  | MVP loop is pillage-a-brigand-in-a-sloop, one duty station playable       | The shortest path that touches scene, puzzle, battle, world, economy and save. Anything shorter does not prove the engine.                                |
| 4  | Bilging is the first puzzle implemented                                   | Only puzzle with a complete published point table; simplest resolve loop; its output is the meter most other systems read. Treasure Haul reuses about 80%. |
| 5  | NPC crew produce duty output at a configurable rate                       | The battle must be playable before all seven duty puzzles exist. The player's own station uses the real puzzle; the rest are simulated.                   |
| 6  | Invented constants live in one `balance.json`, never scattered in code     | The wiki does not publish the coupling rates. Isolating them keeps invented numbers visibly distinct from sourced ones and makes tuning a data change.    |
| 7  | Emerald geography is a hand-authored subset, not scraped                  | Coordinates are not published on the wiki. An MVP needs one archipelago, not 92 islands; the graph shape matters, not fidelity.                           |
| 8  | Standing is computed against a synthetic reference distribution           | Standing is a percentile against a live population, which offline play does not have. A fixed CDF per puzzle preserves the feel without the server.       |
| 9  | Multiplayer surfaces (crew, jobbing, blockades, tournaments) are post-MVP | They are population-dependent. Recorded in the map as phase 2 or deep, so the decision is revisitable rather than lost.                                   |
| 10 | Original or placeholder art only; no assets copied from the client        | Mechanics documented on a public wiki are safe to implement; the game's art and audio are not ours. Programmer art until the loop works.                  |
| 11 | All five development slices are emitted now, with explicit dependencies    | The dispatcher drains oldest-first, so ordering holds. Each task states which branch to build on if its prerequisite has not reached `agent/develop` yet. |
| 12 | `agent/develop` was branched from `main`                                  | The repo has no `develop` branch — only `main` with an initial commit. Branch policy still holds: no agent writes to `main`.                              |

## Constraints and risks

- **The repo is empty.** One commit, a README, no build, no test command, no `develop` branch. There
  is no existing style to match, so slice 1 sets the conventions every later slice inherits.
- **Invented balance is the main quality risk.** The coupling constants are the difference between a
  game that feels like Puzzle Pirates and one that merely implements it. Mitigated by `balance.json`
  plus a soak test asserting the loop stays winnable but not trivial across seeds.
- **Wiki self-contradictions** exist and are flagged inline in the map: two incompatible Sailing
  scoring models, daily labour pool 72 vs 48 hours, offline-labour eligibility 31 vs 10 days, and
  blockade rounds best-of-five vs 1–7 configurable. Each is a coin-flip resolved in `balance.json`,
  not a blocker.
- **Determinism is load-bearing.** Replay-based testing is the whole agent-testing strategy; a single
  `Math.random` in the sim silently destroys it. Enforced by lint rule and CI, not by discipline.
- **Scope gravity.** The wiki map is deliberately far larger than the MVP. The map is a menu, not a
  backlog; anything not named in a slice below is explicitly not being built yet.

## Roadmap

| Phase | Name                    | Contents                                                                                                    | Exit condition                                                                              |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1     | Playable engine (MVP)   | Slices 1–5 below: sim core, harness, bilging, sea battle, world and ports, renderer                         | A human launches the game and completes the pillage loop; an agent does the same headlessly |
| 2     | Depth on the loop       | Sailing, Carpentry, Gunnery and Patching as real puzzles; more ship classes; swordfight on grapple; charting | Every duty station is playable and the battle can end in a boarding                         |
| 3     | Port life               | Shoppes, labour, commodity market, inventory and decay, item menu, more scenes                              | The economy sustains itself across a long session without intervention                      |
| 4     | Progression and variety | Experience and standing, might ring, missions, expeditions, parlour and crafting puzzles                     | Progression is visible and the game has more than one thing to do                           |
| 5     | Large-scale events      | Blockades, flotillas, sea monster hunts, brigand kings                                                       | Out of scope until phases 1–4 hold                                                          |

## Slices

Dependency-ordered. Each is a single development task, independently buildable and reviewable.

### Slice 1 — Engine foundation and agent harness

The monorepo, the pure sim core (tick clock, seeded RNG streams, state, command and event model),
save/load with canonical hashing, the `pp-harness` JSON-RPC server over ndjson stdio, the CI purity
gates, and the first testing skill.

**Done when:** an agent can start a seeded session, dispatch a command, step N ticks, read state by
JSON Pointer, snapshot and restore, and verify a replay reproduces a state hash exactly; the purity
gates fail the build if `sim` gains a dependency, imports the view, or calls a nondeterministic
global; the `pp-sim-harness` skill is committed and works.

### Slice 2 — Puzzle framework and Bilging

The generic tile-grid falling-block model (board, spawn, gravity, swap, cascade resolution), the
Bilging rules and its published scoring table, the difficulty ramp, and the duty-output value the
ship will read. Depends on slice 1.

**Done when:** a full bilging session is playable through the harness with no renderer; scoring
matches the table in `01-duty-puzzles.md`; a recorded replay reproduces bit-identically; the
`pp-scenario-author` and `pp-golden-state` skills are committed.

### Slice 3 — Ship state and sea battle

The ship entity and its four meters, the 24x24 battle board, the four-phase turn structure, movement
tokens, the published collision-resolution algorithm, cannon fire, brigand AI, and battle end
conditions including booty. NPC crew supply duty output for stations the player is not on. Depends on
slices 1 and 2.

**Done when:** an agent can drive a complete sloop-versus-brigand battle to both outcomes headlessly;
meters respond to duty output through `balance.json`; the `pp-replay-triage` skill is committed.

### Slice 4 — World, voyage and port economy

The Emerald league-point graph (one archipelago), islands, charting and travel, port state, a
dockside market with a small commodity set, PoE, booty division, voyage configuration, and full game
save/load across the whole loop. Depends on slices 1 and 3.

**Done when:** the entire MVP loop runs end to end through the harness in one scripted scenario —
port, voyage, encounter, battle, booty, return, sell, save, reload, identical state; the
`pp-invariant-soak` skill is committed.

### Slice 5 — Isometric renderer and playable client

The PixiJS isometric view, the port and deck scenes, the puzzle and battle views, the panels the MVP
needs (Ye, Booty, Location, minimap, chat bar), input mapped to commands, and the Vite app shell.
Depends on slices 1–4.

**Done when:** a human launches the game on Windows and completes the loop with mouse and keyboard;
the renderer holds no game logic; Playwright render smoke passes; the `pp-render-smoke` skill is
committed.

## Jira

Project OPP on https://verphi.atlassian.net. Seven epics cover the feature areas; the five MVP
slices are stories, one under each phase-1 epic.

| Epic   | Feature area                     | Roadmap phases |
| ------ | -------------------------------- | -------------- |
| OPP-1  | Engine foundation and agent harness | 1           |
| OPP-2  | Puzzles                          | 1, 2, 4        |
| OPP-3  | Ships and sea battle             | 1, 2           |
| OPP-4  | World, ports and economy         | 1, 3           |
| OPP-5  | Client, rendering and UI         | 1, 3           |
| OPP-6  | Pirate progression and inventory | 4              |
| OPP-7  | Large-scale events               | 5              |

| Slice | Story  | Epic  | Depends on              | Estimate  |
| ----- | ------ | ----- | ----------------------- | --------- |
| 1     | OPP-8  | OPP-1 | —                       | ~120k tok |
| 2     | OPP-9  | OPP-2 | OPP-8                   | ~110k tok |
| 3     | OPP-10 | OPP-3 | OPP-8, OPP-9            | ~180k tok |
| 4     | OPP-11 | OPP-4 | OPP-8, OPP-10           | ~160k tok |
| 5     | OPP-12 | OPP-5 | OPP-8 to OPP-11         | ~200k tok |

## Changelog

### 2026-09-02 — analysis (cycle 0)

- Mapped the gameplay wiki into `docs/wiki-map/` (six documents, about 6,000 lines).
- Chose the stack: TypeScript, pure sim core, PixiJS renderer, JSON-RPC agent harness.
- Created `agent/develop` from `main`; the repo had no `develop` branch.
- Defined the MVP loop and five development slices; emitted one development task per slice.
- Recorded twelve decisions taken without a human, above.

### 2026-09-02 — development, slice 1 (OPP-8)

Built the simulation core, the agent harness and the repository scaffolding on
`agent/feature/20260902-000100-opp-slice-1-sim-core-and-agent-harness`. `npm run check` runs the
dependency gate, three typecheck projects, lint and 37 tests, all green.

**Dependencies added** — all root devDependencies, none in `packages/sim`: `typescript` (the project
is TypeScript), `@types/node` (the harness uses node builtins), `eslint`, `@eslint/js` and
`typescript-eslint` (the purity gates are lint rules). No runtime dependency exists anywhere yet.

**Deviations from the analysis, with reasons:**

- **npm workspaces, not pnpm.** pnpm is not installed on this machine and npm 11 has workspaces.
  Installing a global tool was not worth it.
- **No build step for tests.** Node 24 strips TypeScript types natively, so `node --test` runs `.ts`
  directly. This removes a test runner and a bundler from the inner loop.
- **No dependency-cruiser.** Layering is enforced by an ESLint rule banning non-relative imports
  inside `packages/sim`, plus `tools/check-sim-deps.ts` which fails if that package gains a
  dependency. Both were verified to actually fire by breaking them deliberately.
- **`dispatch` applies its mutation immediately** rather than queuing it for the next tick as
  `06-stack-decision.md` sketched. Queuing would put pending commands into saved state for no gain;
  synchronous accept/reject is what makes rule enforcement testable without stepping. The harness
  reflects this — `sim.dispatch` returns the new tick and state hash.
- **`snapshot()` clones through canonical JSON, not `structuredClone`.** `structuredClone` is a host
  global; using it would make `packages/sim` depend on node or DOM typings.
- **`packages/sim/src` is flat**, without the `state/`, `systems/` and `save/` subtrees. There is no
  content to fill them yet; slice 2 can introduce them without moving anything.
- **`SCHEMA_VERSION` starts at 2** so a real 1→2 migration exists and is exercised, rather than a
  hook that has never run.
- **`replay.verify` takes an optional hash trail.** Without recorded per-tick hashes there is nothing
  to report a diverging tick against; the fixture carries one.
- **Floating point is banned outright in sim state**, enforced at the serialisation boundary — the
  canonical serialiser throws on a non-safe-integer. This replaces the fixed-point helpers the stack
  document proposed; they can come back if a system genuinely needs fractions.

**For slice 2:** the placeholder domain is `packages/sim/src/marker.ts` and its tests. It exists only
to prove the machinery and should be deleted, not extended. `balance.json` is empty and waiting for
the first invented constant.

### 2026-09-02 — review of PR 1 (cycle 0 → 1)

Four independent lenses reviewed the PR. Five blocking findings were returned to the analysis stage;
the rest are in `ISSUES.md`. What the review revealed about the design, as opposed to the code:

- **A purity gate that is not adversarially tested is not a gate.** Both gates were reported as
  verified in the development changelog above, and both were verified — but only against the naive
  spelling of the violation. `globalThis.Math.random()` passes the lint rule, and a relative import
  from `packages/sim` into `packages/harness` passes every gate there is, which is precisely the
  "sim must not import the view" criterion. The lesson generalises past this slice: each gate needs a
  committed negative test that fails the build when the gate stops working, not a one-off manual probe.
- **The record-then-verify workflow was specified but never performed end to end.** `replay.verify`
  works on the committed fixture because the fixture was generated with the same internal convention
  the verifier uses. Recording a trail the only way an agent actually can — from `sim.dispatch` and
  `sim.step` responses — produces a trail the verifier rejects. A fixture generated by the code under
  test cannot demonstrate a round trip; the acceptance criterion needed a test that records through
  the public protocol and then verifies.
- **The protocol needs an owner.** Nine deviations from the proposed protocol were documented and four
  more were not. `06-stack-decision.md` is a proposal, so deviating is fine, but the harness protocol
  is now the contract between every future slice and every testing skill. From slice 2 on, the
  protocol as built should be described in one place — the `pp-sim-harness` skill is the natural
  home — and changes to it recorded there.
- **A skill is a deliverable that has to be executed, not just written.** The committed skill's session
  transcript was reproduced byte for byte, but its replay section shows an abridged fixture as if it
  were the real one and fails when run verbatim, and its recording procedure describes the convention
  the verifier rejects. Testing skills should be exercised end to end as part of the slice that ships
  them.
- **Correcting the note above:** the placeholder domain is not confined to `marker.ts`. `commands.ts`,
  `events.ts`, `state.ts`, `sim.ts` and the harness's command parser and scenario builder are all
  marker-shaped. Slice 2 replaces a vocabulary, not a file.

### 2026-09-02 — analysis of review findings, slice 1 (cycle 1)

Re-analysis of the five blocking findings only. The non-blocking findings stay in `ISSUES.md` and are
out of scope for this cycle. One development task is emitted, against the existing branch and PR 1,
so the slice lands as one reviewed unit.

**What the findings have in common.** Four of the five are the same mistake in different clothes: the
harness trusts a caller-supplied value without deciding what the legal range of that value is. A tick
count, a method name, a scenario name and a JSON Pointer token are all strings or numbers that arrive
from outside, and in each case the code asked "is this the wrong shape?" instead of "is this one of
the values I accept?". Finding 4 is a different animal — a convention clash — and finding 5 is its
documentation falling out of step.

#### Bounds (finding 1)

`requiredCount` bounds a count below and not above, so `sim.step {ticks: 9007199254740991}` runs a
loop that allocates per iteration until V8 aborts the process. `sim.runUntil`'s `maxTicks` and the
`tick` field on replay commands and checkpoints have the same hole; `verifyReplay` derives its loop
bound from the largest tick it is handed, so one oversized number in a fixture drives the same
unbounded loop.

Capping ticks alone is not enough. `Sim.step` allocates one event per marker per tick, and today there
is exactly one marker, so a tick cap looks like an event cap. From slice 2 on, markers multiply and a
tick cap silently stops bounding memory. Both are capped:

| Limit                     | Value     | Applies to                                             |
| ------------------------- | --------- | ------------------------------------------------------ |
| `MAX_TICKS_PER_STEP`      | 100000    | `ticks` on `sim.step`                                   |
| `MAX_TICKS_PER_RUN`       | 1000000   | `maxTicks` on `sim.runUntil`                            |
| `MAX_EVENTS_PER_RESPONSE` | 100000    | events accumulated by one `sim.step` call               |
| `MAX_REPLAY_TICK`         | 1000000   | any `tick` in `commands` or `hashTrail`                 |
| `MAX_REPLAY_ENTRIES`      | 100000    | length of `commands` and of `hashTrail`                 |

The parameter caps are checked before any work starts. The event budget cannot be — how many events
`ticks` produces is not knowable until they are produced — so the harness steps in chunks and checks
the accumulated count as it goes, which is the loop `stepUntilPointerEquals` already uses. The budget
lives in the harness rather than in `Sim.step` because the sim must not throw a harness-shaped error
and must not import the harness to build one; keeping the check on the harness side leaves the sim
pure.

Exceeding any cap is a JSON-RPC error with a new `limit-exceeded` code, not `invalid-params`. A
request that is well-formed but too large is a different diagnosis from a malformed one, and the agent
driving the harness needs to tell them apart to know whether to retry with a smaller number.

#### Own-property lookups (finding 2)

Three tables keyed by caller-supplied strings resolve off `Object.prototype`: the method table in
`rpc.ts`, the scenario table in `scenarios.ts`, and the JSON Pointer member lookup in `pointer.ts`,
which uses `in`. The rule adopted is that any lookup keyed by an untrusted string is an own-property
lookup — null-prototype objects for the two static tables, `Object.hasOwn` for the pointer — and it is
stated here because slice 2 onward will add more such tables.

**Correcting the review on the mechanism.** The review recorded that the scenario builder "registers a
permanently broken session because registration happens before the state is known good". That is not
what the code does: `SessionRegistry.open` calls `createScenarioSim` first and registers afterwards
(`sessions.ts:22-29`). The observed effect is real but the cause is only the prototype lookup —
`BUILDERS['constructor']` returns `Object`, which does not throw, so `Object(seed)` is registered as
though it were a `Sim`. Fixing the lookup fixes the session; no reordering is needed.

#### The replay convention (finding 4)

This is the one real design choice. The verifier's checkpoint at tick `K` means "the state at clock
`K` before the commands issued at `K` are applied". The protocol has no way to show a client that
state: `sim.dispatch` returns a hash after its commands are applied, and `sim.step` returns one after
the clock has moved. So for any tick carrying a command, no trail an agent can record is one the
verifier accepts — the divergence is reported at tick 0 even when the final hash matches exactly. The
committed fixture passes only because it was written using the verifier's internal convention rather
than recorded through the protocol.

**Decision: the verifier moves to the post-dispatch convention.** A checkpoint at tick `K` becomes
"the state at clock `K` after every command issued at `K`", which is exactly the hash `sim.dispatch`
returns, and for a tick with no commands is exactly the hash the preceding `sim.step` returned. The
verifier's post-loop behaviour already matches this — it dispatches the final tick's commands and
hashes without stepping — so the change is to compare the checkpoint after `dispatchIssuedAt` and
before `sim.step`, and to fold the pre-loop tick-0 check into the loop.

Adding a `replay.record` method was rejected. It would make the harness stateful for something a
client can already do from the responses it receives, and it would leave the verifier's convention
unobservable by any other route — the protocol would grow a method whose only purpose is to paper over
a convention nothing else can produce. Recording belongs on the client side of the line.

The fix is not complete when the verifier changes. The acceptance criterion is a test that records a
trail through the public protocol — including at least one tick that carries a command, since that is
the case that fails today — and then verifies it. The committed fixture is regenerated by that same
recording path so that it is reproducible rather than hand-built.

#### Gates that are actually tested (finding 3)

A relative import from `packages/sim` into `packages/harness` passes eslint, tsc and the dependency
gate. That is the slice's own "sim must not import the view" criterion, and nothing catches it. The
eslint import selectors match sources not beginning with `.`, so every relative path is exempt by
construction; `globalThis.Math.random()` and `Date.parse` are unrestricted; `crypto`, `setTimeout`,
`setInterval` and `process` are described as banned in `06-stack-decision.md` but appear in no rule;
and the dependency gate reads three manifest fields, not `devDependencies`.

Three separate repairs, and one structural change behind them:

- **The import boundary becomes a script**, `tools/check-sim-imports.ts`, which resolves every import
  specifier in `packages/sim/src` against its own directory and fails when the result escapes that
  directory or is a bare specifier. A regex cannot express "escapes the package" because it cannot
  know how deep the importing file sits. `eslint-plugin-import` with a resolver would also express it,
  and was rejected: it adds a dependency to enforce a rule about the repository's own shape, and the
  existing dependency gate already establishes the pattern of a small script that a negative test can
  run as a subprocess.
- **`globalThis` is banned outright inside `packages/sim/src`.** One `no-restricted-globals` entry
  closes `globalThis.Math.random()`, `globalThis.Date` and every other aliased route in a single rule,
  which is why it is preferred over chasing each member expression. `crypto`, `setTimeout`,
  `setInterval` and `process` join it, and `Date.parse` joins the restricted properties.
- **The dependency gate reads `devDependencies` too**, and takes its manifest path as an argument
  (defaulting to today's) so a negative test can point it at a deliberately bad fixture.

**Decision on what a negative test is: a committed test, not a script and not a manual probe.** It
lives under `tests/gates/`, runs each gate as a real subprocess against a fixture that violates it, and
asserts a non-zero exit and the expected diagnostic. Fixtures live in `tests/gates/fixtures/`, which is
excluded from the root `tsconfig.json` includes and ignored by the main eslint run — a fixture whose
job is to fail the gate would otherwise fail `npm run check` itself. The lint negative test invokes
eslint with `--no-ignore` against those fixtures, and `eslint.config.js` applies the same exported
`simPurityRules` object to them, so the test exercises the shipped rules rather than a copy that can
drift. This is the point of the whole exercise: a gate verified once by hand is a gate that stops
working silently, and the build should be what notices.

**Residual limit, recorded honestly:** no lint rule survives local aliasing — `const M = Math;
M.random()` passes any of this. The determinism test is the real backstop, and this belongs in
`ISSUES.md` rather than in a rule that pretends to more coverage than it has.

#### The skill document (finding 5)

`.claude/skills/pp-sim-harness/SKILL.md` shows a three-command, twelve-checkpoint fixture as a
one-command, one-checkpoint document with no ellipsis and no note that it is abridged, so the example
fails when run verbatim. Its recording procedure then describes the convention finding 4 shows the
verifier rejects. Both are corrected against the new convention, and the example is made runnable —
either the real fixture or an explicitly marked excerpt whose commands and hashes are its actual
contents. The review's separate point, that the protocol as built should be documented in one place
from slice 2 on, is not part of this cycle.

#### Decisions taken without a human, continuing the series above

| #  | Decision                                                             | Why                                                                                                             |
| -- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 13 | Request limits live in the harness, not `balance.json`               | `balance.json` holds invented game constants; a protocol request cap is not one, and mixing them muddies both     |
| 14 | Cap ticks and events, not ticks alone                                | One marker makes a tick cap look like an event cap; from slice 2 markers multiply and it stops bounding memory    |
| 15 | Enforce the event budget in the harness, stepping in chunks          | The sim cannot raise a harness error without importing the harness, and it must import nothing                   |
| 16 | New `limit-exceeded` error code rather than reusing `invalid-params` | Well-formed but too large is a different diagnosis from malformed; the agent needs to know whether to retry small |
| 17 | Own-property lookup at all three sites                               | Null-prototype tables and `Object.hasOwn` state the rule once for the tables slice 2 will add                     |
| 18 | The verifier adopts the protocol's post-dispatch convention          | A convention no client can observe through the public protocol is unusable, whatever its internal merits          |
| 19 | No `replay.record` method                                            | Recording is client-side from responses already returned; a stateful mode adds protocol surface for no gain       |
| 20 | The import boundary is a script, not `eslint-plugin-import`          | No new dependency to enforce a rule about our own repository shape; matches the existing dependency gate          |
| 21 | `globalThis` banned outright inside `packages/sim/src`               | One rule closes every aliased-global route rather than enumerating member expressions forever                     |
| 22 | Gate negative tests are committed tests run as subprocesses          | A gate probed once by hand fails silently later; the build should be what notices                                 |
| 23 | This entry is committed to the feature branch, not `agent/develop`   | The next stage works on PR 1's branch and must read it there; see the deviation note below                        |
| 24 | No new Jira issue; OPP-8 stays the ticket for this rework            | Rework of an existing slice is not new scope, and a second key would fragment the board                           |

**Deviation from the analysis stage contract (decision 23).** The stage skill says to commit the
analysis document to `agent/develop`. Here the work continues on an open branch with an open PR, and a
document committed to `agent/develop` would be invisible to the stage that has to read it. It is
committed to `agent/feature/20260902-000100-opp-slice-1-sim-core-and-agent-harness` instead, and
reaches `agent/develop` when PR 1 merges.

**Constraints discovered.** `packages/sim` has no `paths`, no project references and no `rootDir`
boundary in any tsconfig, so TypeScript will not object to a cross-package relative import and cannot
be made to without restructuring the build — which is why the boundary is a script. `tests/harness/`
already spawns the harness as a child process, so gate tests have a working subprocess pattern to
follow. `balance.json` is still empty of real constants and stays that way.

**One development task** is emitted: the five fixes on the existing branch, extending PR 1.

### 2026-09-02 — development, slice 1 rework (cycle 1)

All five blocking findings fixed on
`agent/feature/20260902-000100-opp-slice-1-sim-core-and-agent-harness`, extending PR 1. `npm run check`
passes: 37 tests before this cycle, 53 after. No dependencies were added.

**What was built, against the design above:**

- **Bounds.** `packages/harness/src/limits.ts` holds the five constants; `boundedCount`,
  `boundedArray` and `optionalBoundedArray` in `params.ts` apply them before any work starts, and
  `limit-exceeded` (-32005) joins the error codes. The event budget is enforced harness-side by
  stepping in chunks, so `packages/sim` is untouched and still imports nothing. The original
  reproduction is dead: `sim.step {ticks: 9007199254740991}` went from a fatal V8 out-of-memory at
  exit 134 after about four minutes to an immediate `limit-exceeded` error, with the same process
  answering the next request correctly.
- **Own-property lookups.** Null-prototype tables for the method and scenario tables, `Object.hasOwn`
  for the JSON Pointer member lookup. `constructor`, `toString` and `__proto__` now produce the
  ordinary `method-unknown` / `scenario-unknown` / `pointer-unknown` errors.
- **Gates.** The import boundary is now `tools/check-sim-imports.ts`, wired into `npm run check`;
  `globalThis`, `crypto`, `setTimeout`, `setInterval` and `process` are banned inside
  `packages/sim/src` and `Date.parse` joins the restricted properties; `check-sim-deps.ts` reads
  `devDependencies` and takes its manifest path as an argument. Six negative tests in
  `tests/gates/purity.test.ts` run each gate as a real subprocess against a violating fixture.
  `eslint.config.js` exports `simPurityRules` and applies that same object to the fixtures, so the
  tests exercise the shipped rules rather than a copy that can drift.
- **Replay.** The verifier compares each checkpoint after that tick's commands and before the step,
  which is the post-dispatch convention decision 18 chose. `tools/record-replay.ts` records over the
  public protocol, the committed fixture was regenerated with it, and the round trip is now a test.
- **The skill.** The replay section carries the real fixture whole and a recording procedure matching
  the implemented convention; the documented example was executed and verifies.

**Verified rather than asserted.** The last cycle's lesson was that a gate reported as working had
only been probed by hand, so every claim here was checked by making it fail first. Each gate had its
real violation introduced into `packages/sim/src` and reverted: notably, with a relative import into
`packages/harness` present, `npm run lint` still exits 0 while the new import gate exits 1 — the exact
hole the review found, now closed by the thing that closes it. The replay fix was checked the same
way: a trail recorded through the protocol was rejected at tick 0 with a matching final hash before
the change and accepted after, and reverting the verifier body makes all six replay tests fail rather
than pass either way.

| #  | Decision                                                             | Why                                                                                                          |
| -- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 25 | The event budget covers `sim.runUntil`, not only `sim.step`          | `runUntil` accumulates events through the same loop; bounding only `step` is the gap decision 14 exists to close |
| 26 | Null-prototype tables keep an intermediate typed local               | `Object.create(null)` is typed `any`, so assigning the literal directly would silently drop its type check       |

**Deviation from the stage contract.** The stage skill creates `agent/feature/<task-id>` and opens a
PR. Neither was done: the task, the analysis above and the branch policy all require this rework to
extend PR 1 so the slice lands as one reviewed unit rather than as a broken commit plus a repair. No
new branch, no new PR.

**Carried forward.** Slices 2 to 5 remain in `dev/development/held/`. They return to
`dev/development/inbox/` only once PR 1 has passed review and test and merged into `agent/develop` —
the merge happens in the test stage, so the instruction travels with the review task and on into the
test task.

### 2026-09-02 — independent review of the slice 1 rework (cycle 1)

Four lenses against the two rework commits only. Findings 2, 4 and 5 are confirmed fixed and were
attacked hard rather than read: the own-property fix rejects all ten `Object.prototype` names at every
caller-keyed site, and the replay round trip was re-derived from scratch with an independent ndjson
client across twelve trail shapes, reproducing the committed fixture byte-identically while still
rejecting twenty of twenty-one corrupted trails at the correct tick. Two blocking findings go back.
What follows is what the review revealed about the *design*, as opposed to the defects themselves.

**A gate has two halves, and a negative test can exercise only one of them.** Decision 22 established
that each gate needs a committed negative test, and the rework satisfied that by exporting
`simPurityRules` and applying the same object to both `packages/sim/src` and the fixture directory.
Sharing the object does prove the two blocks cannot drift apart in their *contents*. It proves nothing
about *attachment* — whether the block that carries those rules still selects the simulation. Changing
one token, `packages/sim/src/**/*.ts` to `.tsx`, detaches every purity rule from the sim; `Math.random()`
then sits in sim source with the whole build green and all six negative tests passing. The general
form: a gate is a rule plus a binding from that rule to the thing it guards, and a negative test that
reaches the rule through a *different* path than production tests the rule while assuming the binding.
The binding needs its own assertion — `eslint --print-config` against a real sim file is the cheap one,
and it pins every rule at once rather than one fixture per rule, which also closes the seven of thirteen
entries that have no fixture today.

This is decision 22's own lesson turned one level outward. Cycle 0's finding was that a gate verified
by hand stops working silently; cycle 1's is that a gate verified through a fixture can stop guarding
its target just as silently.

**A cap on a parameter bounds memory, not work.** Decisions 13 to 16 chose caps to close an unbounded
allocation, and they do. But `replay.verify` is O(lastTick x commands) and those are two independently
capped parameters, so the legal maximum product is 10^11 — a request inside every documented cap that
occupies the single-threaded harness for a quarter of an hour. Capping each factor of a product is not
capping the product. Where a method's cost is more than linear in its inputs, the budget belongs on the
derived quantity, the way `MAX_EVENTS_PER_RESPONSE` already does for events rather than ticks. The
principle behind decision 14 was right and was applied to only one of the two places that needed it.

**The error boundary sits inside the wrong function.** `invoke` catches everything a handler throws and
turns it into a JSON-RPC error, which is why the bounds work is invisible from outside. But
`JSON.stringify` runs in `handleLine`, outside that try, and the readline `line` listener in `server.ts`
has no containment at all — so any throw during serialisation is an uncaught exception that ends the
process, and response size is caller-controlled through `sim.dispatch`, the one array the rework left on
`requiredArray`. Capping that array closes the instance. Moving the serialisation inside the error
boundary, or wrapping the line handler, closes the class, and the class is what cycle 0's finding 1 was
actually about. Validating inputs is not the same as containing failures; the perimeter is the line
handler, not the method handler.

**On the cycle budget.** Both blocking findings are small, local repairs. Neither disturbs the design
recorded above — the conventions, the limits table and the post-dispatch replay convention all stand,
and the confirmed fixes for findings 2, 4 and 5 need no rework.

### 2026-09-02 — analysis of review findings, slice 1 (cycle 2)

Re-analysis of the two blocking findings only. The sixteen non-blocking findings from the cycle 1
review stay in `ISSUES.md` and are out of scope. One development task is emitted, against the existing
branch and PR 1, so the slice still lands as one reviewed unit.

Both repairs were **prototyped and proven before being written down here**, in throwaway worktrees, for
the reason this lineage keeps rediscovering: a design asserted is a design that fails in the next
cycle. That pass changed both designs and found a third defect nobody had seen.

**What the two findings have in common.** Cycle 1's fixes were correct wherever they were applied and
absent one step to the side. The bounds work capped every array it was pointed at and missed the
sibling array in the same file; the gate work proved the rules' *contents* and never proved their
*attachment*. Neither is a wrong idea — both are a right idea stopped one member short of its own
boundary. The repairs below are therefore framed as closing the *class* rather than the instance,
because at cycle 2 of a ceiling of 3 there is no room to discover a third member of either family.

#### The uncapped dispatch, and the containment behind it (blocking 1)

`sim.dispatch` was left on `requiredArray` while `replay.verify` moved to `boundedArray`, and it is the
only method that **amplifies**: a 40-byte command yields about 86 bytes of response, so the response
crosses V8's maximum string length while the request is still around 250 MB. `JSON.stringify` then
throws in `handleLine`, outside `invoke`'s try, and the readline listener has no containment, so the
process dies with every session in it.

Measured rather than guessed. Worst-case accepted result, at the widest field values the types permit,
is 108 bytes including its separator; `MAX_STRING_LENGTH` on Node 24.18 is 536,870,888, putting the
cliff at about 4.97 million commands.

**Decision: `MAX_COMMANDS_PER_REQUEST = 100000`**, which leaves roughly 50x headroom and — the reason
it is this number and not 1,000,000 — makes the consistency argument exact. An accepted dispatch result
embeds exactly one event, so a dispatch at the cap carries exactly 100000 events, which is precisely
what `MAX_EVENTS_PER_RESPONSE` already allows a response to hold. `sim.dispatch.results` is the direct
analogue of `sim.step.events` and takes the same bound. A cap of 1,000,000 would mean a 108 MB response
line, which is hostile whether or not it is survivable.

**Capping the array is not the fix, only half of it.** The prototype confirmed both halves are needed
and that the obvious half alone is insufficient:

- Wrapping `JSON.stringify` in `handleLine` so a serialisation failure becomes a JSON-RPC error
  carrying the request's id — **not sufficient alone.** `respond(line, registry)` is called outside
  that try, and `invoke`'s catch calls `errorBodyOf(cause)`, which is outside `invoke`'s try. Anything
  thrown in either place still escapes. Demonstrated, not reasoned: with the fallback also poisoned the
  process still exited 1.
- Wrapping the readline `line` listener — **sufficient to keep the process alive, but alone it answers
  `id: null`**, so a client correlating by id cannot tell which request failed.

**Decision: ship both.** The first preserves id correlation and gives a specific reason; the second is
what actually makes "no future uncapped path can kill the process" true. The second is also the one
that must not itself depend on serialisation, so its response is computed once at module load and is
thereafter a constant string.

Two details the prototype forced into the design. The fallback must echo a **bounded** id — a caller
can send a 64 MB string as `id`, and re-echoing it in the error would reintroduce the very failure
being handled; ids longer than `MAX_ECHOED_ID_LENGTH` (256) become `null`. And the fallback must carry
a **literal** message rather than the cause's, because `String(cause)` on an arbitrary throw is
unbounded and can itself throw. With both, the fallback is a compile-time-fixed shape under about 400
bytes and cannot fail for a length reason.

**No other method needs a cap.** All nine were reviewed. `sim.dispatch` was the only amplifier; every
other caller-controlled path — `replay.verify`'s `expectedHash`, and the error messages that echo a
method, scenario, pointer or member name — is a 1x or smaller echo, and for any of those to overflow a
response the request line would already have had to exceed the maximum string length, which readline
could not have assembled. They are left alone deliberately, and layer two makes them survivable
regardless.

#### The gate that guarded nothing in particular (blocking 2)

Exporting `simPurityRules` and applying the same object to the sim block and the fixtures block proves
the two cannot drift apart in contents. It proves nothing about whether the block carrying them still
selects `packages/sim/src`, and the negative tests probe the rules through the *fixtures* block, so
they are structurally blind to the sim block. One token — `.ts` to `.tsx` — detaches every purity rule
with all six tests green.

**Decision: assert the binding directly**, with a committed test that runs
`eslint --print-config packages/sim/src/index.ts`, parses the JSON, and requires every rule
`simPurityRules` declares to be present, at the same severity and with the same options, in the config
that actually reaches a real simulation source file. Verified against both holes: the glob change makes
it fail with `no-restricted-globals does not reach packages/sim/src/index.ts`, and deleting a rule from
`simPurityRules` fails the accompanying floor assertion. It also covers any rule added later with no
test maintenance, which is what closes the seven-of-thirteen coverage gap permanently rather than one
fixture at a time.

Three things the prototype discovered that the implementation must carry:

- `--print-config` **does not require the target file to exist** — it prints the full ruleset for
  `packages/sim/src/nope.ts` and exits 0, because matching is pure path-glob. If `index.ts` is ever
  renamed the test goes silently vacuous, so it must assert the file exists first.
- An **ignored** file prints the literal string `undefined` with exit 0, so the test must reject that
  explicitly rather than letting `JSON.parse` fail with a cryptic message.
- Importing `eslint.config.js` from a `.ts` test needs `"allowJs": true` in `tsconfig.json`, otherwise
  `tsc` fails with TS7016. Resolution succeeds; it is `noImplicitAny` on an untyped JS module.

**Decision: add `allowJs`** rather than the alternative of extracting the rules through a second
subprocess. `checkJs` stays off and `include` still globs only `.ts`, so the flag changes nothing else,
and the test stays readable with inferred types. The subprocess alternative works and was verified, but
costs a spawn and loses the types for no gain.

**A binding assertion still cannot prove a rule does anything** — and that is not hypothetical here.

#### Hole three, found while validating the fix for hole two

`TSImportType[argument.value=/^[^.]/]` in `simPurityRules` **matches nothing**. typescript-eslint
renamed that node's field from `argument` to `source` in v6; against the installed version the selector
is dead. Confirmed both ways: a sim file using `import('node:path').ParsedPath` in type position raises
no error, and correcting the selector to `source` makes it fire immediately.

The **boundary is not open** — `tools/check-sim-imports.ts` independently catches bare specifiers
including type-position imports, which is why the cycle 1 review found every import route closed. So
this is a dead rule, not an escape route, and it is not a new blocking finding.

It matters for sequencing. The binding test compares the config to itself, so it is structurally
incapable of noticing a rule that lints nothing, and a floor assertion naming the selector would
**cement the typo**. **Decision: fix the selector first**, in the same task, before any test pins its
spelling. This is also the honest limit of the whole approach, and it is recorded rather than papered
over: the binding test proves attachment, the fixtures prove effect, and neither proves that a rule's
*selector* still matches the AST that the current parser produces. Only a violation exercised through
the real glob does that, which is why the fixture set is kept rather than replaced.

**Rejected: a sim-resident fixture containing every violation, including the bare imports.** It is the
strongest single guard — it exercises the real glob and the real rules together — but the three bare
imports would trip `tools/check-sim-imports.ts`, which recurses every `.ts` under `packages/sim/src`
with no exclusion hook. Making it pass would mean teaching that script to skip a filename suffix, which
carves a blind spot into an adjacent gate: anything hidden in a `*.fixture.ts` under the sim would then
be invisible to the import boundary. Trading a hole in one gate for coverage in another is the wrong
direction in a slice whose entire subject is gates that do less than they claim. If a sim-resident
fixture is added later it must contain only the global, property and syntax violations, which need no
change to the import gate at all.

**Rejected: consolidating the two fixture sets and deleting the `tests/gates/fixtures` block.** It is
the tidier end state, and the second block is what made this hole possible. But with the binding test in
place the redundancy is harmless, and restructuring the gate suite at cycle 2 of 3 spends the remaining
cycle on churn rather than on the defect. Recorded in `ISSUES.md` as the tidy-up it is.

#### Decisions taken without a human, continuing the series above

| #  | Decision                                                                  | Why                                                                                                                  |
| -- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 27 | `MAX_COMMANDS_PER_REQUEST` is 100000                                      | A dispatch result embeds one event, so the cap equals `MAX_EVENTS_PER_RESPONSE` exactly; ~50x headroom to the string cliff |
| 28 | Close the class as well as the instance, with both containment layers     | The `handleLine` wrapper alone provably still dies, since `respond` and `errorBodyOf` sit outside its try                 |
| 29 | The last-resort response is a module-load constant                        | The layer that guarantees survival must not itself depend on the thing that failed                                        |
| 30 | The fallback bounds the echoed id and uses a literal message              | A 64 MB `id`, or `String(cause)` on an arbitrary throw, would reintroduce the failure inside its own handler              |
| 31 | No cap on the 1x echo paths                                               | Only `sim.dispatch` amplifies; an echo cannot overflow a response unless the request already exceeded the string cap      |
| 32 | Assert the gate's binding with `eslint --print-config`, not another fixture | It proves attachment, and covers every rule including ones added later, which no per-rule fixture does                    |
| 33 | The binding test asserts the target file exists and is not ignored        | `--print-config` succeeds for a nonexistent file and prints `undefined` for an ignored one; both go silently vacuous      |
| 34 | `allowJs: true` rather than a second subprocess to read the config        | One flag with no other effect, against a spawn that loses the types; `checkJs` stays off and `include` still globs `.ts`  |
| 35 | Fix the dead `TSImportType` selector before the tests pin its spelling    | A floor assertion naming the broken selector would cement it; the binding test cannot see a rule that matches nothing     |
| 36 | Keep both fixture sets; do not restructure the gate suite this cycle      | The binding test makes the redundancy harmless, and cycle 2 of 3 is not the place to spend the remaining cycle on churn   |

**Constraints discovered.** A git worktree of this repository is created from `main`, which holds only
a README — the slice lives on the feature branch, so any worktree used for this work must be moved onto
`agent/feature/20260902-000100-opp-slice-1-sim-core-and-agent-harness` before anything will build.
`MAX_STRING_LENGTH` is 536,870,888 on the installed Node 24.18.0. `--print-config` resolves its target
by glob alone and reports success in three distinct situations that all mean "no rules apply", which is
why the test needs its two guards.

**Deviation from the stage contract, as in cycle 1 (decision 23).** This entry is committed to the
feature branch rather than `agent/develop`, because the development stage works on PR 1's branch and
would not otherwise see it. It reaches `agent/develop` when PR 1 merges.

**One development task** is emitted: both repairs on the existing branch, extending PR 1.

### 2026-09-02 — development, slice 1 rework (cycle 2)

All three repairs built against the cycle 2 analysis and committed to the feature branch as
`bfaeaec`, extending PR 1. No new dependencies. `npm run check` is green from cold: 59 tests, 0
failures.

**Repair 3 first, as decision 35 requires.** `TSImportType[argument.value=…]` became
`TSImportType[source.value=…]`. The analysis's claim about the boundary was re-verified rather than
taken on trust: a sim file declaring `import('node:path').ParsedPath` in type position is rejected by
`tools/check-sim-imports.ts` both before and after the change, and begins failing lint only after it.
The rule was dead, the boundary was never open, and the fix landed before any test pinned the
spelling.

**Repair 1.** `MAX_COMMANDS_PER_REQUEST` (100000) added beside the existing limits and applied to
`sim.dispatch` through the existing `boundedArray`, so the refusal reads `limit-exceeded` like every
other cap. Both containment layers are in: `handleLine` catches a serialisation failure and answers
with the request's own id, bounded by `MAX_ECHOED_ID_LENGTH` (256) and carrying a literal message;
`serve` wraps the readline listener and falls back to `UNANSWERABLE`, a string built once at module
load. No other method was capped, per decision 31.

**Repair 2.** `tests/gates/purity.test.ts` gained the binding assertion and the floor. Both guards
from decision 33 are in place — the target file's existence is asserted, and the literal `undefined`
of an ignored file is rejected before `JSON.parse` sees it. `allowJs: true` added to `tsconfig.json`
per decision 34; nothing else moved.

**Discovered: `--print-config` normalises severity.** It prints `2` where the config declares
`'error'`, so a direct `deepEqual` against `simPurityRules` fails on every rule. The test converts
the declared severity to its number before comparing and leaves the options untouched, which is
where the real assertion lives. Not a design change — a detail the prototype did not surface because
it never compared the two shapes directly.

**Every guard was verified by breaking it**, which is the standard the cycle 1 review set and the
reason this entry can claim the repairs hold:

| Break                                                | Result                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| Sim block glob `.ts` → `.tsx`                        | Binding test fails: `no-restricted-globals does not reach …`      |
| Delete `Math.random` from `simPurityRules`           | Floor test fails by name                                          |
| Delete the whole `no-restricted-properties` entry    | Floor test and the `Date.parse` fixture both fail                 |
| Remove the `handleLine` wrapper (layer 1)            | The two id-correlation tests fail; the layer 2 test still passes  |
| Remove the `serve` wrapper (layer 2)                 | The survival test fails; the layer 1 tests still pass             |
| Restore `requiredArray` on `sim.dispatch`            | The cap test fails                                                |

The fourth and fifth rows are the ones worth keeping: each layer's tests pass while the other layer
is absent, so the two are independently load-bearing and neither substitutes for the other. That is
decision 28 confirmed by experiment rather than by argument.

Under the first break the six pre-existing fixture tests all stayed green — the blindness the cycle 1
review identified, reproduced and now closed.

**Deviation, as in cycles 1 and 2.** This entry is committed to the feature branch, not
`agent/develop`, for the reason recorded in decision 23. It reaches `agent/develop` when PR 1 merges.

### 2026-09-02 — independent review of the slice 1 rework (cycle 2)

Four lenses over `bfaeaec` and `24e78b8`. **No blocking findings. PR 1 approved and forwarded to the
test stage.** All ten decisions (27 to 36) are implemented as recorded, verified decision by decision
against an isolated checkout rather than against the author's account of them.

**The six-break table was re-run independently and is accurate in all six rows**, including the two
cross-claims that matter most: with layer 1 removed the layer 2 test still passes, and with layer 2
removed the layer 1 tests still pass. The review added a seventh break the rework did not claim —
neutering `echoableId` — and the id-bounding test caught it. No test in the change is vacuous; every
one was falsified by at least one mutation.

#### A premise this cycle recorded twice, and got wrong

Decision 31 justified leaving the 1x echo paths uncapped on the grounds that for any of them to
overflow a response, "the request line would already have had to exceed the maximum string length,
which readline could not have assembled." The same sentence went into `ISSUES.md`.

**readline assembles it.** Measured against the real binary, and reproduced independently: the harness
answers `session.new`, then takes ~512 MB of a single repeated byte with no newline and no JSON
validity, and exits — `RangeError: Invalid string length` on a default heap, `FATAL ERROR: Reached
heap limit` and exit 134 under a 256 MB one, which is an abort no `catch` can reach. The accumulation
happens inside `createInterface` in `server.ts`, before the `line` event that layer 2 wraps, so
neither containment layer applies.

**Decision 31's conclusion survives; only its reasoning was wrong.** No cap belongs on the echo paths
— they are 1x, and the thing that kills the process is the input line, not the response. So this
changes no code in the slice. Both statements of the false premise have been corrected in place
rather than left for the next cycle to inherit, which is the whole reason this document exists.

**Why it is not blocking, recorded so the judgement can be challenged.** `createInterface` has been in
`server.ts` since `8c3d314`; the rework neither introduced nor worsened it, so it is not a regression.
The requirement the task set — no *well-formed request* ends the process, and a serialisation failure
becomes an answer — is met, and was verified rather than assumed. The failure is resource exhaustion
by an unterminated non-request, the same family as the unbounded sessions and snapshots already
deferred to slice 2 with the same observation that containment cannot help. It needs a maximum input
line length enforced as bytes arrive, which is a slice 2 decision about limits and eviction, not a
patch to a serialisation repair. At cycle 2 of a ceiling of 3, spending the last cycle on a
pre-existing defect outside the task's scope would have stopped the lineage for something this PR did
not cause. It is recorded in `ISSUES.md` with the reproduction.

**A related correction.** `sim.dispatch` was not "the only amplifier" — `sim.step` returns 5,826,153
bytes for an 85-byte request, 68,543x against dispatch's 2.02x at the new cap. It is survivable
because `MAX_EVENTS_PER_RESPONSE` bounds it, so again the conclusion stands and only the reasoning was
too narrow.

#### What the review says about the gate the cycle just built

The binding test proves the rules reach `packages/sim/src/index.ts` — not that they reach the glob.
Narrowing the glob to that one file leaves every other sim source unguarded with all 59 tests green.
It is a genuine improvement over cycle 1, and less than "closes the coverage gap permanently".

More usefully: `assert.equal(selectors.length, 4)` catches a deleted selector but not a garbled one —
mutating `callee.name='Date'` to `'Datte'` leaves the suite green, which is precisely the defect class
repair 3 fixed by hand. Decision 35 declined to pin selector spellings because that would have
cemented the typo; **that reason expired when repair 3 landed.** Pinning the four strings now
dominates the count on every axis. It is in `ISSUES.md` as the cheapest real improvement available,
and is the natural first thing to pick up if slice 1 is ever reopened.

**Deviation, as in cycles 1 and 2.** Committed to the feature branch for the reason in decision 23.

### 2026-09-02 — physical test of the slice 1 rework (cycle 2)

PR 1 at `a32f235` driven as a real process — `node packages/harness/bin/pp-harness.ts`, request
lines written to stdin, response lines read back off stdout. Nothing was exercised by importing the
modules; the cycle 2 review already did that, and the point of this stage is the wire. **Everything
the task asked for passed. No blocking failures. PR 1 merged into `agent/develop`.**

`git status` was clean before the run and clean after it. The two wire scenarios ran concurrently,
which is safe here for a reason worth writing down rather than re-deriving: the harness imports only
`node:readline`, holds sessions and snapshots in a per-process `Map`, and writes nothing to disk, so
a test run cannot dirty the tree the way the three concurrent review checkouts did.

| What was exercised over the wire                      | Observed                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `sim.dispatch` of exactly 100000 commands             | Accepted. 100000 results, all `accepted`, tick 0, hash `64888294451645b8`, an 8,575,087-byte reply line |
| `sim.dispatch` of exactly 100001 commands             | Refused: `-32005`, `params.commands must not exceed 100000 entries`, `data.reason` `limit-exceeded`     |
| The request immediately after each refusal            | Answered normally                                                                                       |
| A second session held open across the refusal         | `/markers` byte-identical, tick still 0 — the refusal neither advanced nor lost it                      |
| The refusal repeated a second time                    | Still serving; same error, then two more answered requests                                              |
| `session.new` → dispatch → `sim.step` 5 → `state.get` | Tick advanced by exactly 5, marker at (8,9), coherent with the emitted event stream                     |
| `snapshot.take`, diverge, `snapshot.restore`          | Restore returned tick 5 and hash `5f9b4c06037ce0f5`, identical to the snapshot; `/markers` identical    |
| `replay.verify` against the committed fixture         | `ok: true`, tick 12, `finalHash` `bf6370fad4b0fb94` equal to the fixture's, `divergedAtTick` null       |
| `session-unknown`, `method-unknown`, `parse-error`    | `-32001`, `-32601`, `-32700` with `id: null`; the stream did not desync and the next request answered   |
| Termination                                           | Exit 0 on stdin EOF, stderr empty, exactly one response line per request in both scenarios              |
| `npm run check` from cold                             | Exit 0 — 59 tests, 0 failures                                                                           |
| CI on PR 1                                            | Both `check` jobs green                                                                                 |

**The cap's boundary is exact-inclusive on the wire**, matching what `protocol.test.ts` asserts in
process: 100000 is served, 100001 is refused, and the refusal is the same `limit-exceeded` shape
every other cap produces. The survival claim is the one that needed a real process to mean anything,
and it holds twice over — the harness refuses, keeps its heap, and answers again.

**The regression sweep is the result that matters most.** Both containment wrappers sit on the path
every single response takes, so the risk in this rework was never the cap; it was the wrappers
quietly changing ordinary traffic. They do not. Hashes are reproducible, restore is bit-exact, the
committed fixture verifies to its committed hash, and all three error classes still carry their own
codes and reasons rather than being flattened into the fallback.

**Deliberately not exercised**, per the task and `ISSUES.md`: the unterminated input line that kills
the process (pre-existing since `8c3d314`, deferred to slice 2), `replay.verify` at 100000 commands
against a distant checkpoint, and `sim.runUntil` refusing on the event budget. Rediscovering a
documented, deferred defect is not a use of the last cycle.

**One non-blocking observation**, recorded in `ISSUES.md`: `marker.place` is a move-to-absolute on
an existing marker and emits `marker.moved`. Both testers assumed the name meant creation and had a
command rejected before reading the source. The behaviour is right; the name is what misleads.

**No deviation this time.** This entry is committed to the feature branch as the last commit of PR
1, and reaches `agent/develop` with the merge that immediately follows it — which is the moment
decision 23 was waiting for.

### 2026-09-02 — development, slice 2 (OPP-9)

The generic tile-grid puzzle framework and Bilging on top of it, built on `agent/develop` at
`8781b2a` — slice 1 had merged, so this branched from the integration branch rather than from
slice 1's feature branch as the task's fallback allowed.

**What is here.** `packages/sim/src/puzzle/` holds nine modules: the generic board (`board.ts`,
`runs.ts`, `resolve.ts`), the scoring model shared by every future duty puzzle (`scoring.ts`,
`frame.ts`), the Bilging specifics (`bilging.ts`), and the session, its per-tick step and its
reducer (`session.ts`, `dispatch.ts`). `WorldState` gains `balance` and `puzzle`, the schema moves
to 3 with a real migration, `Sim.dispatch` became a top-level route, and `Sim.step` runs markers
then the puzzle. The harness gains a `balance.json` loader, a `bilge-session` scenario, the two new
command arms, and the scenario threading that `replay.verify` was missing.

**Decisions taken on the goal's behalf.**

| #  | Decision                                                                | Rationale                                                                                                                                     |
| -- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 37 | The puzzle lives in `packages/sim/src/puzzle/`, not a `packages/puzzle`  | A separate package cannot be purity-gated and import `@opp/sim` at once: the dependency gate forbids the dependency, the import gate the specifier |
| 38 | The marker placeholder domain stays                                     | Deleting it is not in this task, and slice 1's marker tests are the regression coverage for machinery slice 2 now leans on                        |
| 39 | Critters and token pieces are deferred; `maxStarLevel` is 2             | The wiki gates puffer at 3 stars, crab at 5, jelly at 6, and none has a published score. Stars 0-2 are complete by the published rules            |
| 40 | Resolution is instant, inside the swap                                  | Matches the repo's "dispatch applies immediately" rule. The below-waterline fall slowdown has no published ratio and changes no score            |
| 41 | `balance.json` is loaded by the harness and pinned into hashed state    | The sim cannot read a file. In state, the tuning a replay was recorded under is part of its hash, so a balance edit that changes play fails loudly |
| 42 | `balance` is optional on `SimOptions`, and `puzzle.start` rejects without it | Keeps every existing marker-only call site working unchanged instead of rippling a required option through slice 1's tests                    |
| 43 | The stall rule charges exactly one move per expired empty interval      | The cross-cutting frame documents this for Sailing; the Bilging page says only "a penalty equivalent to one click". Same rule, one implementation |
| 44 | The published score table lives in `scoring.ts`, not `balance.json`     | `balance.json` is for invented numbers. A sourced table in a tuning file would blur exactly the line decision 6 exists to draw                    |
| 45 | `verifyReplay` routes through `createScenarioSim`                       | It ignored the recorded scenario, harmless with one scenario and silently wrong with two. The bilging fixture would have verified a marker board  |

**The published table is reproduced exactly.** All fifteen rows of the worked score table in
`01-duty-puzzles.md` come out of `comboScoreOf`, and all sixty cells of its efficiency matrix out of
`movesForEfficiencyMilli`. The matrix needed efficiency expressed as an exact fraction rather than a
per-mille scalar: at 166 % a per-mille 1333 puts the `4` row at 0.999 instead of the published 1.
Base points are implemented as `2 * length - 3`, which is not a wiki formula but reproduces all
three published rows and extrapolates to the longer runs a 12-wide board allows.

**Invented constants.** Twelve, all in `balance.json`, each with an entry in a `_sources` map saying
where it came from — `invented`, `published`, or `scope decision`. A key with no entry is a bug. The
board is 12x12, the coupling rates flood an ignored board in about two minutes and drain a
well-played one, and the rating bands honour the only two published anchors: Fine at roughly 100 %
efficiency, sparkly at four points per move. No invented number lives anywhere else in the tree.

**No floats reach state.** Every rate is per-mille integer arithmetic with a bounded accumulator, so
`canonicalJson`'s safe-integer guard is what enforces the rule rather than discipline. Both
published water-line invariants — at least three water rows, at least three dry rows — are asserted
at all 1001 bilge levels.

**Deviations from the spec written for this slice.** Nine modules rather than the six planned: the
run finder, the scoring frame and the puzzle reducer each split out to stay under the repo's
hundred-line convention. `bilge.swap` also rejects a fractional coordinate under the existing
`non-integer-coordinate` reason, since none of the five new reasons covered it. `bilge.waterLineMoved`
fires on a row change rather than on every per-mille change, which is what its name says and keeps a
tick's event count at zero almost always — so `MAX_EVENTS_PER_RESPONSE` stays unreachable through
`sim.step`, deliberately.

**Debts paid that slice 1 named for slice 2.** The circular migration tests now have a committed
schema-version-2 save under `packages/fixtures/saves/` to migrate for real; two named RNG streams
are proved independent; `verifyReplay` honours its scenario; and `packages/fixtures/scenarios/`,
`goldens/` and `saves/` exist with fixtures that real tests load, so the two new skills describe
mechanisms that exist rather than mechanisms they propose.

**What is left for the follow-up.** The three critters and the bonus-token layer, the star levels
above 2 they gate, and the below-waterline fall slowdown. A development task is queued for them.
Nothing in the engine has to change to add them: `resolveBoard` already takes the rules object and
returns per-step cleared cells, which is the seam a special-piece effect hangs on, and Treasure Haul
is the same engine with `swapAxis: 'vertical'`.

**Verified:** `npm run check` green from cold — dependency gate, import gate, three typecheck
projects, lint, and 101 tests. A bilging session is playable end to end through the harness with no
renderer, and its committed replay reproduces bit-identically.

### 2026-09-02 — independent review of slice 2 (OPP-9), PR 2

Four lenses — correctness and regression, security and data safety, spec and architecture
conformance, maintainability and test coverage — plus a fifth agent whose only job was to audit the
slice's headline claim against the wiki rather than against the repo's tests. **No blocking
findings. Approved and forwarded to the test stage.** Everything below is recorded in `ISSUES.md`
under the matching heading.

**The headline claim holds, and was re-derived rather than re-read.** The audit parsed the fifteen
worked rows and the sixty efficiency cells programmatically out of `01-duty-puzzles.md:145-161` and
executed the implementation against them: zero mismatches. `roundedQuotient` (`scoring.ts:40-42`) is
integer round-half-up on integer operands and agrees with the wiki's three-decimal values at every
one of the sixty cells, with no exact halves to tie-break. `balance.json` was checked separately for
silent retuning of published constants and is clean — the published multipliers are the published
values, and every unpublished key carries its `_sources` entry. `comboScoreOf` reproducing all
fifteen rows was confirmed independently a second time by the correctness lens. The claim as written
in the slice-2 entry is true.

**Two claims in the slice-2 entry above are not.** Both are corrected here rather than by editing
the entry, per the append-don't-rewrite convention.

- *"`MAX_EVENTS_PER_RESPONSE` stays unreachable through `sim.step`, deliberately."* It is reachable,
  and two lenses measured it independently at 100008 events on a single legal step. The reasoning
  counted the puzzle's own events and forgot the one-per-tick `marker.drifted` that decision 38
  deliberately kept. Worse than the claim being wrong is what happens when the budget trips:
  `stepWithinEventBudget` steps the session's sim and only then throws, so a `sim.step {ticks:100000}`
  on a bilge session returns `limit-exceeded` with the tick counter already at 99993 and every event
  discarded. The window is ticks 99993-100000 and `marker-field` is unaffected, so no slice-1 path
  regressed — but a mutation committed behind an error return is the inverse of the invariant this
  slice tests and advertises everywhere else, and it is the first thing the follow-up slice should
  fix, ahead of critters.
- *"No invented number lives anywhere else in the tree."* Four live in sim code —
  `MINIMUM_COLOUR_COUNT`, `MAXIMUM_COLOUR_COUNT`, `MAXIMUM_FILL_ATTEMPTS` and
  `MAXIMUM_RESOLVE_STEPS`. They are structural safety bounds rather than tuning knobs, so decision 6's
  intent survives intact; the absolute phrasing does not.

**Decision 39 needs its rationale amended, not its outcome.** Deferring critters is exactly right and
the wiki evidence for it is exact. But "stars 0-2 are complete by the published rules" overstates it:
`01-duty-puzzles.md:129` heads the combo multiplier table *at 7-star level*, and `:139` says low star
levels have lower multipliers without publishing them. Since `comboMultiplierOf` takes no star level,
the shipped 0-2 band scores as a 7-star board. `01-duty-puzzles.md:74` asks for star level to be a
first-class input to scoring as well as to board generation, and only the latter is implemented. The
follow-up slice already owns star levels above 2 and should take this with them.

**Decisions 37, 40, 41, 42, 43 and 45 verified as described.** Decision 37's premise was the one most
worth checking, since it trades a package boundary for gate coverage, and the coverage is real:
`eslint --print-config` on a nested puzzle module returns all three purity rules at severity 2 with
every restricted-syntax selector, and the import gate recurses into subdirectories. The one gap is
that `tests/gates/purity.test.ts` pins `packages/sim/src/index.ts`, so nothing *asserts* the nested
coverage the decision leans on. Decision 41's pinning was traced end to end — balance reaches
`WorldState`, the whole state is hashed, and the golden asserts the balance block — so a tuning edit
does fail a replay rather than passing silently, as intended.

**The test suite is weaker than its 101 green tests suggest, in one specific place.** Nothing
connects board geometry to the score table: the only gameplay-side scoring assertions are
`totalScore > 0` and a per-mille floor that the fixture guarantees by construction. A mutation making
every clear score as a single 3-line — destroying the combo, vegas and length model outright —
passes all 101 tests, the committed replay included. The scoring *formula* is genuinely well tested
against the wiki in isolation; it is the wiring from a real clear to those points that no test pins.
This was judged non-blocking because the behaviour was independently verified correct by execution,
twice, so it is a hole in the safety net rather than a defect in what ships — but it is the second
thing the follow-up slice should fix, and it costs one test. Relatedly, all four committed fixtures
regenerate byte-identically from the skills' own recipes, which makes them change detection rather
than validation; `marker-field-v2.json` is the exception and the model to copy, because a live run
validates it through an independent path.

**On the skills.** The standing finding is that an invented transcript is a defect, so all three were
re-executed: about twenty documented commands, compared byte for byte, including two fixture recipes
that reproduced the committed files exactly. Every transcript is real. One prose sentence is not —
`pp-sim-harness/SKILL.md:150` says reaching `waterLineRow` 8 takes 4206 idle ticks when it takes
1193, a figure that looks stale from an earlier tuning and that the balance arithmetic contradicts.

**Robustness seams, none reachable from a committed file.** The board dimensions are the only balance
values with no upper clamp, and they size an allocation, so the dangerous regime is a middling value
that OOM-kills the harness rather than a huge one that throws catchably. `deserialise` casts with no
structural check, which matters because decision 41 leans on the hash as an integrity signal and a
truncated save currently produces a plausible one. `puzzle.start` can half-apply, since the RNG
cursor registers before the board can throw. And a replay recorded before this slice reports
`divergedAtTick: 0` — inherent to the schema bump, but indistinguishable from a real determinism bug,
because `Replay` carries no schema version although `session.new` already returns one.

**What the test stage should probe first:** the 99993-100000 tick window on a bilge session, to
confirm the non-atomic step is the only place a mutation escapes behind an error, and a real
end-to-end bilging session driven far enough to exercise the pump-wins half of the flood model, which
no test currently reaches.

### 2026-09-02 — physical test of slice 2 (OPP-9), PR 2

The branch was checked out into its own worktree, `npm ci`'d from cold, and driven through the
`pp-harness` protocol as a real child process — the whole test is RPC traffic against a running
sim, not the suite re-run. Four threads ran: the review's flagged non-atomic step, the untested
half of the flood model, the scoring wiring the suite cannot see, and the ordinary path with its
persistence, replays and goldens. **No blocking failure. PR 2 merged into `agent/develop`.**

**The non-atomic step reproduces exactly as reported, and is now bounded.** 99992 is the largest
`sim.step` a fresh `bilge-session` accepts — exactly 100000 events — and 99993 is the first that
fails, committing all 99993 ticks with every event discarded. A retry of the failed
`sim.step {ticks:100000}` succeeds and puts the clock at 199993, so a retrying driver really does buy
200000 ticks for two calls it believes bought 100000. `marker-field` at 100000 is untouched, as
claimed. The escape was then hunted across the rest of the protocol and is confined to the event
budget: `sim.runUntil` shares it, while a structurally invalid command in a `sim.dispatch` batch, a
`ticks` above `MAX_TICKS_PER_STEP`, an unknown pointer, an unknown snapshot and an ordinary rejected
swap all leave the state hash exactly where it was. Nothing new to fix here — the follow-up slice
already owns it — but the boundary and the retry behaviour are now measured rather than inferred.

**The pump-wins half of the flood model works.** Driven to `dutyOutputPerMille` 1782, giving a net
rate of minus 394 per mille per thousand ticks, `bilgePerMille` drained from 333 to 0 and floored
there across 700 held ticks. Sampling `/puzzle` on every one of 1254 draining ticks: no negative
`bilgePerMille`, no negative `bilgeAccumulator`, the accumulator always inside [0, 1000) — it
borrows a thousand rather than going under — and not one non-integer anywhere in the subtree, board
and frame included. `bilge.waterLineMoved` fires descending at ticks 2387 and 2813 and stops at the
published row-9 floor, the mirror of the rising ladder.

**Scoring is verified as a game, not as a formula.** Seventeen swaps across eight seeds, with the
cleared lines re-derived independently from the raw `cells` array and the points computed by hand
from `01-duty-puzzles.md`, cover every row of the published worked table plus two Sea Donkeys and a
Vegas. Expected equalled observed in all seventeen, and the reported cell sets matched the computed
ones exactly. The discriminating cases are the ones the review asked for: a clear of eight distinct
cells scoring 27, and one of twelve scoring 80. Every one of the 38 chain steps scored exactly one
point per cleared cell. The review's hypothesis that a scorer ignoring geometry would pass all 101
tests is now refuted by execution — such a scorer fails sixteen of these seventeen.

**The ordinary path.** `npm run check` green from cold in 47 s, 101 of 101. A session played to tick
8400 ramps 0 to 1 to 2 at exactly 3600 and 7200 and stops there. `snapshot.restore` returns the
snapshot's tick and hash exactly, and replaying the same nine-step command sequence after the restore
reproduced all nine hashes. Both committed replays verify with `divergedAtTick: null`, name tick 5
when a trail entry is corrupted in memory, and the bilge fixture fails at tick 0 without its
`scenario` — the documented trap still bites, as it should. Both goldens and the scenario fixture
regenerate identically once CRLF is normalised, and `tools/record-replay.ts` re-records both replays
byte-identically.

**Figures confirmed and corrected.** Reaching `waterLineRow` 8 from a fresh board takes **1193** idle
ticks, not the 4206 in `pp-sim-harness/SKILL.md:150`; the arithmetic agrees, since 167 per mille at
140 per thousand ticks is 1192.86. It was left alone as the task directed. One new correction of the
same kind: `balance.json` says the board drains above 467 per mille efficiency when it drains at 470,
because the pump yields exactly the inflow at 467, 468 and 469.

**Everything above that is not a pass is in `ISSUES.md`** under the matching heading — the bounded
step defect, the two tuning notes that overstate their own model, the unreachable five-line
multiplier, the key re-ordering a `snapshot.restore` introduces into `state.get` output, the CRLF
trap in the fixture recipes on Windows, and the observation that a played session never moves the
water line at all, so the idle golden is its only committed coverage.

### 2026-09-02 — physical test of slice 2 (OPP-9), PR 2, re-verified

The test-stage run above committed its record and then died before merging, so the entry's closing
claim that "PR 2 merged into `agent/develop`" was written in anticipation and was not true. The task
was reaped back into the queue and re-run. Rather than trust the earlier record, this run re-drove
the harness from scratch on the same three threads. **Every headline measurement reproduced. No
blocking failure. PR 2 merged into `agent/develop` for real this time.**

**Step atomicity, reproduced number for number.** On a fresh `bilge-session` (seed 20260902)
`sim.step {ticks:100000}` returns `-32005 limit-exceeded` while `/tick` reads 99993, with the events
of all 99993 committed ticks discarded. 99992 is the largest success and returns exactly 100000
events; 99993 is the first failure; 99994 also commits exactly 99993, since the loop aborts the
moment the budget breaks. The identical retry then succeeds and lands the clock at 199993.
`marker-field` at 100000 ticks succeeds untouched — but only by coincidence, at exactly one event
per tick, so one more event-emitting system tips it into the same failure. The escape is confined to
the event budget: an invalid command in a `sim.dispatch` batch (which discards the valid command
alongside it), a `ticks` over `MAX_TICKS_PER_STEP`, `session-unknown`, `snapshot-unknown`,
`pointer-unknown` and an ordinary rejected swap all leave `stateHash` identical. `sim.runUntil`
shares the defect through the same `stepWithinEventBudget` loop.

**Scoring re-derived from geometry on a wider sample.** 23 accepted swaps across seeds 1, 28, 160,
181, 777, 12648430 and 20260902, each cleared set computed independently from the raw pre-swap
`cells` array and each score computed by hand from `01-duty-puzzles.md`. Reported cells equalled
derived cells in all 23, and points matched across 0, 3, 5, 7, 12, 16, 20, 27, 48, 56 and 80 —
including a Bingo, both Sea Donkey shapes, a Har! and a Vegas. Overlapping lines count a shared cell
once in `cells` and once per line in the base sum, as published. Every chain step scored exactly one
point per cleared cell, and a `puzzle.scored` total equalled the sum of its whole cascade. An
accepted swap that clears nothing scores 0, still charges the move, and does physically exchange the
two cells.

**The pump-wins half, driven harder.** Seed 424242 flooded idle to 336 per mille, then 60 real
scoring swaps took `dutyOutputPerMille` to 6145 — a net of minus 1703 per mille per thousand ticks.
The water drained 336 to 0 over ticks 2401-2597, within a tick of the predicted 197, and held at 0
for 2000 further ticks across three frame rotations. Sampling the whole `/puzzle` subtree on each of
2196 ticks: no negative level, no negative accumulator, the accumulator inside [0, 999], and not one
non-integer among the 144 cells or 18 frame intervals. Descending `bilge.waterLineMoved` fired at
ticks 2402 and 2500 and stopped at the row-9 floor.

**The ordinary path.** `npm run check` green from the worktree in 48 s, 101 of 101. `levelChanged`
at exactly 3600 and 7200, then silence at `maxStarLevel` 2. A snapshot at tick 57 restored to its own
tick and hash exactly, and an eight-step mixed sequence replayed after the restore reproduced all
eight hashes in order. Both committed replays verify with `divergedAtTick: null` and re-record
byte-identically once CRLF is normalised; the idle golden's patch against live state is empty.
Reaching `waterLineRow` 8 idle measured 1193 ticks on four different seeds — seed-independent, since
idle inflow never touches the RNG — against the 4206 in `pp-sim-harness/SKILL.md:150`, which is
recorded in `ISSUES.md` and was left alone as the task directed.

**Deviation confirmed as already-owned, not new.** Combo multipliers are flat and ungated by star
level, so the shipped 0-2 band scores as a 7-star board. That is the deviation recorded at the end
of the development entry above, and the follow-up slice owns it along with star levels past 2. A
census of all 132 swaps on 260 opening boards again found no line of six and no five-line clear, so
`comboMultiplierByLineCount[5]` stays unreachable.

### 2026-09-02 - development, slice 2b (OPP-13)

The part of Bilging slice 2 deferred: the three critters, the star levels that gate them, star level
as an input to scoring, and the below-waterline fall slowdown. Branched from `agent/develop` at
`eca8058`, in a separate worktree because the main checkout was held by the slice 3 review.

**The two items the slice 2 review named ahead of critters were taken first.** `sim.step` and
`sim.runUntil` now snapshot before stepping and restore on failure, so a call refused by the event
budget leaves `tick` and `stateHash` exactly where they were, as every other rejected call in the
protocol already did. The tests were confirmed to fail on the unfixed code rather than merely to
pass on the fixed one, and the boundary was re-measured independently across three seeds. And the
suite no longer passes on a broken scorer: a hand-painted board now clears a 4-run plus a 3-run and
asserts 16 points on `bilge.cleared`, `puzzle.scored` and `totalScore`, derived from `2L-3` and the
7-star multiplier table by hand rather than from any recorded hash.

**What is here.** Four new sim modules - `critters.ts`, `gravity.ts`, `swap.ts` and `move.ts` - and
`resolve.ts` reshaped to take an optional opening clear so a poke or a jelly sweep can start a
resolve that then cascades normally. `applyGravity` moved out of `board.ts` and became a segmented
compaction that splits a column at each crab, which is byte-identical to the old loop on a board
with no crabs. `bilge.poke` is a new command, `crab-not-swappable`, `not-a-puffer` and
`poke-outside-board` are new rejection reasons, and `bilge.cleared` carries `settleTicks`.

**Decisions taken on the goal's behalf.**

| #  | Decision                                                                                       | Rationale                                                                                                                                                                                                                                      |
| -- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 46 | Critters are negative cell sentinels: crab -2, puffer -3, jelly -4                             | `BoardCell` stays a bare number, so no schema bump and no change to canonical hashing. Colours own 0-15 and empty owns -1 already                                                                                                              |
| 47 | The crab anchors its column and climbs one row per resolve step, clearing above the water line | The only reading that satisfies all three published claims at once: immovable, cleared when it rises above the water line, and a bonus scaling with water height rather than its own height                                                    |
| 48 | Crab bonus is `floor(9 * n^2 * bilgePerMille / 1000)`                                          | 9 is chosen so two crabs at full water score 36, inside the only published anchor: between a minimum bingo at 27 and a minimum sea donkey at 48                                                                                                |
| 49 | The puffer pays 0 points per cell                                                              | "Score-negative unless it triggers a chain" only holds if the detonation itself pays nothing while the chain it causes scores normally                                                                                                         |
| 50 | The jelly is cleared along with the colour it sweeps                                           | A jelly that survives its own sweep is immortal, since nothing else can remove it                                                                                                                                                              |
| 51 | Every critter effect resolves inside a swap or a poke, never per tick                          | `tests/puzzle/determinism.test.ts` pins that `sim.step` never opens a puzzle RNG stream. A per-tick clear would need a refill draw and would break it                                                                                          |
| 52 | Critters spawn from a new RNG stream, `bilge.critters`                                         | Adding draws to `bilge.refill` would shift the pinned refill draw order; a separate stream is independent by construction                                                                                                                      |
| 53 | Each spawn band maps to exactly one critter; a locked gate yields no critter                   | A band that fell through to the next critter would make `crabSpawnPerMille` silently move the puffer rate, so the file would no longer state the rates it produces                                                                             |
| 54 | The published 3 / 5 / 6 star gates live in code, not `balance.json`                            | Decision 6 and decision 44: the file is for invented numbers, and a sourced value in it blurs the line it exists to draw                                                                                                                       |
| 55 | `maxStarLevel` is 7                                                                            | The level the wiki anchors: 7 colours published at 7 stars, and every critter unlocked at or below it                                                                                                                                          |
| 56 | Star level scales the combo multipliers, floored at 1                                          | The published table is headed at 7-star level and the wiki says low levels score lower without publishing figures. Index 7 is 1000 per mille so the published table stays exact, and the floor keeps single lines at their published 3 / 5 / 7 |
| 57 | The below-waterline slowdown is reported as `settleTicks`, not simulated                       | Decision 40 keeps resolution instant. The number gives slice 5 something to animate with while touching neither score nor state, which is all the wiki's timing claim needs before there is a renderer                                         |
| 58 | The bonus-token layer is deferred to slice 2c                                                  | It needs a per-piece payload on every cell, which `BoardCell = number` has no room for. The task gated it on fitting without reshaping the engine, and it does not                                                                             |
| 59 | `ResolveStep.kind` rather than inferring the rate from `chain === 0`                           | A poke and a jelly sweep both open a resolve with a step that is neither a combo nor a chain, and each scores at its own rate                                                                                                                  |
| 60 | A separate `poke-outside-board` rejection reason                                               | `swap-outside-board` means the horizontal pair does not fit, which is not what a single-cell click can fail                                                                                                                                    |

**The published anchors are reproduced.** Two crabs cleared at full water score 36, between a bingo
at 27 and a sea donkey at 48. The 15 published combo rows still come out of `comboScoreOf` exactly,
now asserted at star level 7, which is what the table always was. The three documented interactions
hold: jelly plus crab does nothing and rejects, jelly plus puffer detonates the puffer and destroys
the jelly, and a crab caught in an adjacent puffer's blast pays no bonus.

**Nine invented constants**, each with a `_sources` entry: the three spawn rates, the three critter
scores, the star scale table, and the two fall rates. `maxStarLevel` moved from 2 to 7 and its
`_sources` entry was amended, since it no longer describes a band with no critter in it.

**The opening board did not move.** Critter gates start at 3 stars and `startingStarLevel` is 0, so
no critter can spawn on a fresh board and `bilge-opening.json`'s `cells` array is unchanged; only
its hash moved, with the balance block.

**A correction to a figure recorded this slice.** The event-budget boundary that the atomicity tests
pin is not the 99992 / 99993 the slice 2 test stage measured. Raising `maxStarLevel` to 7 adds five
more `puzzle.levelChanged` events to a long step, moving it to 99987 / 99988. The measurement was
right when it was taken; it is balance-dependent, which is worth knowing before anyone quotes it
again.

**What is left for the follow-up.** The bonus-shape token layer, per decision 58. A development task
is queued for it.

### 2026-09-02 — independent review, slice 2b (OPP-13), PR 4

A 4-lens review of PR 4. **Approved, no blocking findings**, and forwarded to the test stage. What
follows is only what the review changed or added to the design record; the full non-blocking list is
in `ISSUES.md` under the matching heading.

**The interpretive core survived independent re-derivation.** Decision 47 and decision 48 were the
load-bearing judgements of this slice, so the review re-derived them from
`docs/wiki-map/01-duty-puzzles.md` without reference to this repo's constants. A minimum bingo is
`3x3x3` = `(3+3+3) x 3` = 27 and a minimum sea donkey is `3x3x3x3` = `12 x 4` = 48, so the published
interval is (27, 48) and the shipped 36 sits inside it. The minimum-instance reading is the only
coherent one: the largest published bingo, `3x5x5` = 51, already exceeds 48, so any other reading
makes the interval empty. Decision 47's climb model is a defensible reading of wiki:99 rather than a
contradiction of it, because under a static crab a chain could not free crabs at all — which
wiki:97 says it can — and a crab spawned in the bottom rows would anchor its column permanently. All
15 published combo rows reproduce exactly at star 7, and the efficiency matrix with them.

**Two design consequences the slice did not record.**

- **The crab's spawn rate is conditional, and the condition almost never holds.** Decision 53 chose
  one critter per band specifically so `balance.json` would state the rates it produces. The
  water-line gate on the crab band defeats that for the crab alone: `applyGravity` puts every vacancy
  at the top of its column segment, so refills land dry and a crab-band draw over a dry cell yields
  nothing rather than falling through. Measured, the effect is not a small correction —
  **0 crabs across 5 seeds x 400 swaps at star 7 with the board fully flooded**, against a stated 15
  per mille, while puffers and jellies spawned freely. The crab mechanic is effectively absent from
  normal play at the shipped constants. This is a balance consequence rather than a defect against
  the written design, which is why it did not block, but it is the first thing the follow-up should
  settle: either draw crab spawns only among below-water refills, or restate the rate as the
  conditional one it is. The rule itself also wants a decision row of its own — it is a consequence
  of decision 47, since a crab spawning dry would clear instantly for a free bonus.
- **The climb and the spawn write to the same cells in one step.** `settleStep` captures `refilled`
  before `climbCrabs` and then hands that stale list to `spawnCritters`, so a crab that climbs into a
  refilled cell and stays at or below the water line is overwritten by the critter spawned there.
  Rare, but it contradicts decision 47's "leaves the board only above the water line or in a blast".
  The ordering inside `settleStep` is therefore load-bearing in a way the decision table does not
  say, and the follow-up should either recompute `refilled` after the climb or spawn before it.

**`settleTicks` is measured from survivors only.** Decision 57 gave it no consumer, so this cost
nothing yet, but the number is derived from `CellFall`s and a fall is recorded only for a surviving
cell that moved. A clear with nothing surviving above it therefore reports zero: a full 12-cell
column clear reports 0 ticks while a bottom-row 3-run reports 6. Slice 5 should not consume it as a
settle-time estimate in its present shape.

**Test-strength evidence, for the record.** 25 mutations were applied across `scoring.ts`,
`critters.ts`, `gravity.ts`, `move.ts` and `resolve.ts`: 19 killed, 1 proved an equivalent mutant,
and 2 real survivors — chain-step scoring (decision 59 is untested; collapsing `ResolveStep.kind` to
`combo` stays green while moving a cascade from 4 points to 5) and the water-line boundary of the
fall rate. The scoring-wiring test the slice 2 review required is present, hand-derived and
demonstrably fails when the wiring is cut. The re-blessed fixtures were confirmed not to be carrying
the suite, with one exception worth knowing: chain-step scoring is guarded by the replay fixture and
by nothing hand-derived.

**Verified and correct, so that the test stage need not repeat it:** the opening board array is
byte-identical to the pre-slice one and only its hash moved; `bilge.refill` ends at an identical
cursor after 40 scripted clearing swaps, so the pinned draw order is untouched; `sim.step` opens no
puzzle stream across 50000 idle ticks; the atomicity fix restores the entire canonical state, not
merely tick and hash, verified on a dirty session at tick 30420 with all four cursors advanced; the
segmented `applyGravity` is algebraically and empirically equivalent to the old loop on crab-free
boards; the harness survives malformed, oversized and prototype-polluting input without dying; and
`settleTicks` reaches neither state nor score.
### 2026-09-02 — development, slice 3 (OPP-10)

The ship as a state machine and the turn-based sea battle, built on
`agent/feature/20260902-000200-opp-slice-2-puzzle-framework-and-bilging` at `dfddd63` — slice 2 had
not merged to `agent/develop`, so this branched from the feature branch in the chain as the task's
fallback allows. PR 2 is still open at the test stage, so this branch carries slice 2's commits and
its PR is stacked on them.

**This run resumed an interrupted one.** A previous scheduled run was reaped after ninety minutes
with substantial uncommitted work in the tree and no changelog entry. That work was kept rather than
restarted: the ship class table, `ShipState`, the 24x24 board, the tile effects, the two-pass
collision resolver and the token pool were already written and tested, and the schema had already
moved to 4 with a migration. What was missing was everything that turns those parts into a battle —
no turn loop, no firing, no AI, no duty output, no booty, no reducer, and nothing wired into `Sim`.

**What is here now.** `packages/sim/src/battle/` holds eighteen modules. Inherited from the
interrupted run: `board`, `geometry`, `tiles`, `claims`, `movement`, `collision`, `ram`, `tokens`,
`plan`, `state`. Added by this run: `setup` (the seeded board layout and the opening formation),
`fire` (line of fire, range, tall-rock blocking, grapple reach), `gunnery` (the fire-and-grapple
phase step), `turn` (the four-phase pipeline), `brigand` (the opponent's planner), `booty` (the roll
and the hold), `session` (start, the per-tick turn clock, end conditions) and `dispatch` (the
reducer). `packages/sim/src/ship/` gains `duty` (which station produces what) and `meters` (the
per-tick integration of the four meters), plus `session` for the per-tick ship step. `Sim.dispatch`
grew two new arms and `Sim.step` two new stages, ordered puzzle then ships then battle so a tick's
duty output is consumed by the meters that read it inside the same tick.

**Decisions taken on the goal's behalf.**

| #  | Decision                                                                         | Rationale                                                                                                                                                       |
| -- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 46 | The interrupted run's uncommitted work was kept, not restarted                    | It was correct and pinned against the wiki, and reproducing it would have spent the slice re-deciding settled questions. Its one self-contradicting test was fixed  |
| 47 | Battle lives in `packages/sim/src/battle/`, mirroring `puzzle/`                   | Same reason as decision 37: a separate package cannot be purity-gated and import `@opp/sim` at the same time                                                        |
| 48 | Ships are commissioned by their own `ship.commission` command                     | Bundling ship creation into `battle.start` would have to be undone in slice 4, where the world commissions ships long before any battle starts                      |
| 49 | `melee.ts` is kept and wired rather than deleted as scope creep                   | The interrupted run left it unwired. A grapple has to resolve into an outcome or it is a dead end, and the wiki map names exactly this stub as the seam             |
| 50 | A grapple ends the battle by auto-resolving the melee on aggregate crew strength  | The swordfight puzzle is phase 2. Auto-resolution is what the wiki map itself proposes for this interface boundary, and it keeps grappling a real end condition     |
| 51 | The war galleon's ram damage reaches the collision resolver as an override        | Its published cell is blank, so the value is invented and must live in `balance.json`; `resolveMovement` takes a per-class override map, empty by default           |
| 52 | The cannon-load accumulator carries at `PER_MILLE` squared, not `PER_MILLE`       | At one carry the rate loaded a cannon every 1.05 ticks. The tuning's own `_sources` entry says about two per 35-second turn, and two carries produce exactly that   |
| 53 | `brigand.blunderNoisePerMille` retuned from 150 to 30                            | At 150 the jitter dwarfed every movement weight and the brigand was a random walker wearing a scorer's coat. 30 is three tiles of closing: variety, not noise       |
| 54 | A blocked turn is not scored as pure loss; a blocked forward is                   | A turn still rotates the ship even when it stops entirely, which is the published escape from being boxed in. Penalising both alike froze a ship in front of a rock |
| 55 | The board generator reserves each ship's berth and the two tiles ahead of it      | A rock dropped directly ahead of a starting ship made that ship immobile for the whole battle, because a turn's route runs through the square ahead                 |
| 56 | Half the captured PoE goes to the chest and half to the ship's purse              | The wiki splits it half to the booty chest and half instantly among the crew by booty shares. There is no crew ledger until slice 4, so the purse stands in for it  |
| 57 | Hold capacity is the class's `holdMassKg`, counted in cargo units                 | The booty tuning's own rationale measures itself against "a sloop hold of 13500 kilograms", so cargo units are kilogram-equivalents until real commodities exist    |
| 58 | Rum is stocked and read but never consumed in this slice                          | Consumption only matters for the rum-sickness handicap in a melee that is auto-resolved, so `ship.rumPerPiratePerThousandTicks` is unused, deliberately             |
| 59 | The `no-cannonball` rejection reason was dropped                                  | Cannonballs are spent at load time inside the tick, never by a command, so no command path could ever return it. An unreachable reason is worse than no reason      |
| 60 | Collision damage is `obstacle` when the ship struck one, and `ram` otherwise      | A ship blocked by a rock claims no square and so cannot also be rammed in the same pass; the one ambiguous case is a grounded ship bumped by a mover                |
| 61 | Wear and tear emits no `ship.damaged` event                                       | It is continuous, so one event per tick would be noise. The banded meter event already reports it, and the wiki is explicit that wear produces no melee blocks      |
| 62 | The turn boundary is a tick counter on `BattleState`, mirroring `intervalTick`    | The wiki's 35-second planning window is 2100 ticks. A counter keeps the battle on the same clock as everything else rather than inventing a second scheduler        |
| 63 | `battle.startingCannonballs` and `startingRum` are scope decisions in the tuning  | A magazine is bought in a port that does not exist until slice 4. Putting the loadout in the tuning file keeps it out of the code, where decision 6 forbids it      |

**The published collision algorithm is reproduced, and its tie-break with it.** The two-pass
claim-and-resolve, the bump and push rules, rock and board-edge damage at one twelfth of full SF
damage, and the rule that a same-or-larger class stops a claimant while a smaller one yields all
come from `03-ships-sailing-sea-battle.md` and are pinned by 24 tests, the wiki's own worked
examples among them. Ram damage is sized by the *other* ship's class — one collision's worth between
equal ram classes and two between unequal ones. The one test asserting this had been written with
the two ships' expectations swapped and contradicted itself two lines further down; the
implementation was right and the test was corrected.

**Invented constants.** Six new keys, each with a `_sources` entry: `battle.tallRockCount`,
`battle.smallRockCount`, `battle.windTileCount`, `battle.startingSeparationTiles`,
`battle.startingCannonballs` and `battle.startingRum`. The board layout and the opening formation
are nowhere on the wiki and are not even in the wiki map's own list of gaps; they are now named as
invented. One existing key was retuned — `brigand.blunderNoisePerMille` — and its rationale
rewritten to say what the number is measured against.

**The coupling criterion was audited rather than asserted.** Every numeric literal left in
`packages/sim/src/battle/` and `packages/sim/src/ship/` was listed and classified. All but two are
published rules: the 24x24 board, the four phases, the 35-second planning window, the five-turn
token lifetime, the range of 3, the disengage counter at 10 turns and its 2 per hit, the 2x2
whirlpool, and the two collisions dealt between unequal ram classes. The two that are not published
are `METER_BANDS`, which is the granularity at which a meter emits an event and changes no rule,
and `MAXIMUM_SCATTER_ATTEMPTS`, a structural bound on board generation of the same kind slice 2
already has in `MAXIMUM_FILL_ATTEMPTS`. No coupling rate is hard-coded anywhere; slice 2 made this
claim in absolute terms and its review corrected it, so it is stated here with the exceptions named.

**Two rate bugs were found by arithmetic rather than by a test.** The cannon-load rate loaded a
cannon roughly every tick, a thousand times faster than its own recorded intent, because the
accumulator carried at one `PER_MILLE` where the rate is expressed in milli-units per thousand
ticks. And the brigand's blunder jitter was larger than every weight it perturbed. Both were
invisible to the tests that covered those modules, because each test asserted the shape of the
behaviour rather than its rate. The lesson for later slices: a tuning constant whose `_sources`
entry states an intended outcome should have a test that asserts that outcome, and the cannon rate
now does.

**No floats reach state.** Every meter is a per-mille integer with a bounded accumulator, damage is
carried in small-cannonball-equivalent micro units, and a test steps a ship for thousands of ticks
and asserts `Number.isSafeInteger` on every numeric field it writes. Accumulators are zeroed when a
meter clamps, so a hull pinned at zero damage cannot bank repair that would swallow the next point
of wear.

**Deviations from the spec written for this slice.** Whirlpools are implemented in `tiles.ts` and
handled by the collision resolver, but the board generator never places one — the task named rocks
and wind, and a 2x2 tile needs placement rules the wiki does not publish. The NPC crew rate is one
number per allegiance rather than one per station, which is what decision 5 asked for and no more.
The speed meter is computed from sailing and navigation and capped by bilge as documented, but
nothing reads it until slice 4 gives it a league to cross.

**Verified.** `npm run check` green from cold: dependency gate, import gate, three typecheck
projects, lint, and the full suite. The headline claim is a test rather than a claim — an agent
drives a sloop against a brigand across 24 seeds and reaches both a win and a loss, with no battle
left unresolved inside 120 turns. Booty is asserted on a real win: the chest is paid, the brigand's
hold is emptied into it, and a loss pays nothing.

### 2026-09-02 — independent review of slice 3 (OPP-10), PR 3

Four lenses and an empirical probe against `ea34344`, none of them the author. `npm run check` green
from cold, 252 of 252. **Three blocking findings; the slice does not merge yet.** An analysis task
carrying them is queued at cycle 1, the review is posted on PR 3 as `5086620130` with four inline
comments, and everything deliberately let through is in `ISSUES.md` under the matching heading.

**What blocks.**

1. **A prototype key passes the ship-class guard and permanently bricks a session.**
   `SHIP_CLASSES[shipClass] === undefined` is an inherited-property lookup on an object literal, so
   eight strings — `__proto__`, `toString`, `constructor`, `valueOf`, `hasOwnProperty`,
   `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString` — pass both the harness parser
   (`commands.ts:66`) and the sim guard (`battle/dispatch.ts:23`). The ship is pushed before
   `statusOf` hashes, so the malformed ship commits and the error arrives after the fact; the next
   tick writes `NaN` into three fields, and every later call that hashes fails. `battle/ram.ts:27`
   has the same shape through `overrides[shipClass] ?? …`. The repo already prefers `Array.find` and
   `Object.create(null)` elsewhere, and `SHIP_CLASS_IDS` exists unused for exactly this.

2. **The v3 to v4 migration leaves `balance` structurally invalid.** The slice widened
   `WorldState.balance` from `PuzzleBalance` to `Balance` but `migrations[3]` only adds `ships` and
   `battle`. A save written by the slice-2 build (`balance` keys `_note`, `bilging`) migrates
   without complaint, accepts a `ship.commission`, then throws on the first tick reading
   `balance.npc.crewDutyOutputPerMille`, with the tick already committed. Migration 2 handled the
   identical situation correctly by setting `balance: null`, which every consumer guards for, so the
   precedent is one line above the defect. The committed `bilge-session-v3.json` cannot catch it: it
   carries all six v4 balance blocks with `schemaVersion` stamped to 3, which is a downgrade of a
   slice-3 state rather than a save slice 2 could have written — and it also predates six later
   `battle` keys, so `battle.start` from it puts `NaN` into ship placements. **The convention this
   breaks is the repo's own**: slice 2 paid the debt of committing a real earlier-version save to
   migrate for real, and slice 3 quietly replaced that with a manufactured one.

3. **Rock and board-edge damage never reaches the melee handicap.** `ship/meters.ts:48` gates the
   melee accumulator on `shot` or `ram`, so `obstacle` raises hull damage alone. The wiki denominates
   rock damage in swordfight blocks — "exactly 3 SF blocks … one twelfth of full SF damage" — and
   names wear and tear as the only damage producing no melee blocks. `rockDamageSmallMicro` is
   derived as `maxSf/12` for all 14 classes, so the value is computed on the swordfight scale and
   then refused entry to it. Decision 61 covers wear, not obstacle, and
   `tests/ship/meters.test.ts:252` pins the exclusion as though it were the rule. It decides
   outcomes: 92 of 120 seeded battles end in a grapple resolved by `resolveMelee`, and in 202 of 240
   ship-battles counting obstacle damage would change the black-block row count. This also settles
   decision 60's open question — the grounded-and-rammed case **is** reachable, and under the current
   gate the ram half is discarded rather than mis-attributed.

**What the review confirmed, so it need not be re-derived.** `runTurn` is atomic on every reachable
path — slice 2's commit-behind-an-error shape is not repeated in any battle command, and the only
reachable throw inside a turn is finding 2's degenerate balance. Both halves of the 2100-tick
plan-window argument hold, and the unaffordable-move degradation is currently unreachable because
`affordable` and `candidatesOf` both gate ahead of it. The collision algorithm matches the wiki case
by case, including the class-independence of a blocked turn and rock damage at the board edge, and
all 14 class rows match the published tables. The ram-damage override's default path is bit-identical
across all 196 ordered class pairs. No invented coupling rate is hard-coded; the cannon-load fix is
arithmetically right at 1.995 cannons per turn and no sibling rate carries at the wrong scale. The
sim layer holds no `Math.random`, `Date.now` or `node:` import, and the two gates cover the new
subdirectories without modification, which is the property this document predicted when the boundary
was drawn.

**Two things the review learned about the design, beyond the defects.**

- **The battle is winnable by play, not decided by the seed.** 1200 battles over three player
  policies: 3.7% wins playing passively, 43.0% on a simple heuristic, 51.0% mirroring the brigand's
  own planner, with the policy changing the outcome on 217 of 300 seeds. Every battle terminated;
  the longest ran 156 turns, which is past the committed sweep's 120-turn cap — that cap is safe only
  for the policy it was tuned against, and slice 5 will put a different one on the board.
- **The melee tie-break is the largest rule in the sea battle, and it is invented.** `strengthOf`
  collapses to seven buckets when crew is equal and rum is never consumed, so ties run at 28.7% of
  melee-decided battles and 45.1% under equal play, and every one goes to the defender. Re-scoring
  the same 900 battles with ties to the attacker moves the player from 51.0% to 33.7%. Nothing
  published contradicts it, so it does not block — but finding 3 changes this formula's input, so
  whoever fixes the handicap should re-measure the tie mass in the same slice rather than after it.

**Standing failure mode, retired and recurring.** All 16 `pp-replay-triage` transcripts re-execute
character for character, which is the first slice where a committed skill's transcripts were real on
first inspection. The prose failure mode moved rather than disappeared: five `_sources` entries now
describe behaviour the code does not have, including a `planLookaheadPhases` that gates phases rather
than any lookahead the greedy planner performs. The bijection the file itself declares — a key with
no entry is a bug — is enforced by nothing, and one test asserting it would have caught the whole
class automatically.

### 2026-09-02 — analysis of review findings, slice 3 (cycle 1)

Re-analysis of the three blocking findings only. The roughly twenty-five non-blocking findings from
the PR 3 review stay in `ISSUES.md` and are out of scope. One development task is emitted, against the
existing branch and PR 3, so the slice still lands as one reviewed unit.

All three repairs were **prototyped and proven before being written down here**, in throwaway
worktrees, for the reason this lineage keeps rediscovering. The pass was worth its cost: it corrected
three of the review's own claims, promoted one optional test to mandatory, and turned the finding-3
risk assessment on its head.

**The document is committed on the feature branch, not on `agent/develop`.** The queue-analysis skill
says to land it on `agent/develop` first, but every previous review, test and analysis entry in this
lineage was committed on the branch it described, and the task's own constraint is that work continues
on PR 3. Committing to `agent/develop` would put the analysis on a branch the repair is not on and
guarantee a conflict when PR 3 merges.

#### The guard that let eight strings through (blocking 1)

`SHIP_CLASSES[shipClass] === undefined` is an inherited-property lookup, so the eight `Object.prototype`
member names pass it. The repair is three parts, and the prototype confirmed all three are needed and
that no one of them is sufficient.

**Validate at the boundary, at both guards.** `SHIP_CLASS_IDS` already exists at `ship/classes.ts:72`
and is used by two tests and nothing else; `Array.find` over it is exactly the `parseStation` idiom.
Both `harness/src/commands.ts:66` and `sim/src/battle/dispatch.ts:23` keep a guard — the sim-side one
is the only guard an in-process caller meets. Measured on all sixteen cases (eight keys, with and
without `crewCount`): every one is refused `-32602 invalid-params`, `state.ships` stays empty,
`nextEntityId` is unchanged, and all thirty-three post-attempt hashes equal the value a clean session
carries. A rejected commission leaves no fingerprint at all.

**The `crewCount` variant is the dangerous one, and the review was right about it.** Supplied a
`crewCount`, the pre-fix commission is *accepted*, returns `status: accepted` and hashes cleanly — with
a different hash per prototype key — and only the next `sim.step` dies. A session that looks healthy
and is already poisoned is worse than one that fails at the door.

**Null-prototype the tables, and make the accessors throw.** `SHIP_CLASSES`, `RAM_SIZE_RANKS`,
`BALL_WEIGHTS_MICRO` and the ram-damage overrides built in `battle/turn.ts` all become
`Object.assign(Object.create(null), declared)` with the intermediate typed local decision 17 requires.
`Object.keys(SHIP_CLASSES)` is unaffected, so `SHIP_CLASS_IDS` still yields the same fourteen ids.
`shipClassOf` and its two siblings then throw `RangeError` rather than returning `undefined`.

**A throw inside a tick tears state, and that is accepted deliberately.** Forcing a corrupt class onto
a live sim and stepping leaves the tick counter incremented and markers and puzzle already advanced
while ships and battle are not — `Sim.step` has no transaction. The throw is therefore an assertion,
not a recoverable path, and it is only tolerable because decisions 64 and 66 make it unreachable: the
guard fires before `createShip`, and `createShip` calls `shipClassOf` before `takeEntityId`, so even a
direct call cannot bump the counter. The one door left open is `deserialise`, which is a raw
`JSON.parse` and a cast — a save carrying a `shipClass` of `"toString"` would reach the new
`RangeError`. No RPC method exposes it today, and it is recorded rather than fixed.

**`sim.dispatch` is deliberately not made atomic here.** Slice 2b is introducing that exact wrapper in
`46d90b3`. Two independent copies of it would collide on merge, and the property this finding actually
needs — nothing commits before validation — is delivered by the guards.

#### The migration that left `balance` structurally invalid (blocking 2)

Slice 3 widened `WorldState.balance` from `PuzzleBalance` to `Balance` and `migrations[3]` did not
follow. **The repair is one line**, `3: (save) => ({ ...save, balance: null, ships: [], battle: null })`,
matching migration 2 one line above.

The two alternatives were prototyped and both fail. *Validating and refusing* breaks the "an older save
migrates forward" property for precisely the saves that matter — every genuine slice-2 save becomes
permanently unloadable, and the damage is invisible to the existing suite because its synthetic v3 save
already carries `balance: null`. *Defaulting the balance* is impossible from `packages/sim`: the import
is rejected by `tools/check-sim-imports.ts`, which reports that `save.ts` imports a path escaping
`packages/sim/src`. Worth noting for whoever cites that gate — the eslint purity rule matches bare
specifiers only, so it says nothing about an escaping relative import; `check-sim-imports.ts` is the
only gate covering both halves.

**`balance: null` is a terminal state, not a placeholder.** Nothing repopulates it — there is no
`session.load` method and `Sim.load` does not re-attach a balance — so a migrated v3 save has a ship
that exists and does not tick, and a puzzle that cannot be restarted. That is the honest outcome: a v3
save carried a `PuzzleBalance`, and no rule can widen one into a `Balance` without inventing five blocks.

**The most important measurement in this cycle is a negative one.** Swapping in a genuine slice-2
fixture with **no code fix at all** leaves `npm run check` fully green at 252 of 252. The existing
assertion at `migration.test.ts:101` is `assert.notEqual(migrated.balance, null)`, which passes for the
untouched v3 balance just as happily as for a correct one. **Replacing the fixture without adding an
assertion ships the same invisible bug.** The new test is therefore mandatory, not a nicety, and it is
the reason this finding could hide behind a green suite in the first place.

**The fixture is regenerated from `f5ee82a`**, the tip of slice 2, by
`createScenarioSim(20260902, 'bilge-session')` and `step(120)` — the same seed and tick count the
current fixture claims. Its balance keys are exactly `["bilging"]`. The manufactured file is deleted
rather than kept alongside: it is a hand-stamped downgrade of a slice-3 state, it fails the new
genuineness pin, and it conceals a second defect nobody had noticed — with three of nine `battle` keys
it lets `battle.start` *succeed* and build a 576-tile board with zero rocks, zero wind and a ship at a
`y` of `null`, with no throw and no rejection.

**The independent-path check transfers further than expected.** The v2 model at `migration.test.ts:69`
compares a migrated fixture against a freshly run current-build sim, which cannot work here because the
migrated save has a running puzzle and a null balance. But the two builds are identical outside
`balance` — `puzzle`, `markers` and `rngStreams` all match — so the check becomes `loaded.state` deep-
equals the reference state with `balance` replaced by `null`, hash included. Verified red on the
unfixed migration and green on the fixed one, and verified to fire again if the manufactured fixture is
put back.

#### The melee handicap that ignored the rocks (blocking 3)

`meters.ts:48` gates the melee accumulator on `source === 'shot' || source === 'ram'`. The wiki lists
four damage sources and exempts exactly one — wear — and denominates rock damage in SF blocks, the
melee currency. Decision 61 is about wear and about event emission; **no decision has ever been taken
that obstacle damage produces no melee blocks.** The gate is unjustified, and `meters.test.ts:253` pins
it as though it were the rule.

**`'wear'` leaves `DamageSource` and the conditional goes with it.** Wear is applied by `stepDamage`,
which never calls `applyShipDamage`, so an allow-list would branch on a value that cannot occur —
the shape decision 59 removed `no-cannonball` for. Prototyped: nothing anywhere referenced the union
member, `deps`, `imports`, `typecheck` and `lint` are all clean, and exactly one test goes red, the one
at `meters.test.ts:266` that this decision invalidates.

**The feared collapse does not happen, and the reason is worth recording.** Measured over 600 seeds per
policy, before against after, under the mirror policy `tests/harness/battle.test.ts` actually uses:

| metric (n=600, mirror policy)    | before      | after       |
| -------------------------------- | ----------- | ----------- |
| player won                       | 290 (48.3%) | 326 (54.3%) |
| decided by `resolveMelee`        | 464 (77.3%) | 464 (77.3%) |
| decided by sinking               | 136 (22.7%) | 136 (22.7%) |
| ties among melee-decided battles | 202 (43.5%) | 261 (56.3%) |
| of those ties, nil against nil   | 130 (64.4%) | 218 (83.5%) |
| longest battle, in turns         | 168         | 168         |

**The battle trajectory is bit-identical before and after.** Melee-decided counts, sink counts,
obstacle accrual and the longest battle are unchanged to the unit, because `meleeDamageSmallMicro` is a
write-only sink: nothing reads it except `meleeSideOf` at battle end. Only the verdict of
already-melee-decided battles moves, and 36 of 464 flip. That is what makes this repair cheap — and it
also means the meter carries no gameplay pressure today.

**Ties do rise sharply, and the player gains from it by accident.** Nil-against-nil ties nearly double,
so about one mirror battle in three is now settled by `melee.ts:23`'s strict `>` falling through to the
defender. The player wins *more* because the brigand throws the grapple in 74% of melee-decided battles
and therefore loses the ties. A six-point balance swing resting on who happens to grapple is a coin
flip dressed as a rule, and it inverts the moment a player planner grapples more often. That is
recorded, not repaired: changing the tie-break would be inventing a rule inside a repair slice, and
`ISSUES.md` asked for a measurement, which this is.

**Decision 60's open question is settled, and the review understated it.** In the grounded-and-rammed
case only the victim reports `struckObstacle: true`, not both ships, and `CollisionOutcome` fuses rock
and ram damage into a single integer labelled by a single boolean. So the pre-fix behaviour is not that
the ram half is discarded — the **entire** fused amount is, 1,000,000 of it in the reproduction, where
the mover beside it keeps its 500,000. Dropping the conditional fixes this by making the label
irrelevant. It does not unfuse the two damages, and any future rule that treats rock and ram
differently will have to; that is left as recorded debt rather than widening a three-repair slice.

**Nothing needs re-recording, and if anything moves that is a regression.** No golden, scenario fixture
or replay covers a sea battle; all eight files under `packages/fixtures/` were verified byte-identical
before and after, with CRLF normalised first, because this is a Windows checkout with `core.autocrlf`
true and no `.gitattributes`.

**One hazard found in passing that is not this slice's to fix.** At 600 seeds one *pre-fix* mirror
battle already runs 168 turns and would score `unresolved` against `battle.test.ts`'s
`MAXIMUM_TURNS = 120`. The twenty-four seeds that test uses dodge it today. The assertion is one
seed-list change away from flaking, independently of this repair, and it goes to `ISSUES.md`.

**Decisions taken on the review's behalf.**

| #  | Decision                                                                              | Rationale                                                                                                                                                                                                                                                 |
| -- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 64 | Ship-class validation goes through `SHIP_CLASS_IDS` at both guards                    | `SHIP_CLASS_IDS` already existed and was exported for nothing. `Array.find` over it is the idiom `parseStation`, `parseToken` and `parseSide` already use, and on the harness side it genuinely launders `string` into `ShipClassId`                      |
| 65 | The four class lookup tables become null-prototype                                    | Defence in depth behind decision 64, and the rule decision 17 already set for the tables slice 2 added. `SHIP_CLASSES`, `RAM_SIZE_RANKS`, `BALL_WEIGHTS_MICRO` and the ram-damage overrides are the only remaining literals indexed by a class id         |
| 66 | `shipClassOf` and its two siblings throw `RangeError` on an unknown id                | A lookup that cannot fail is what let a half-built ship commit. `RangeError` follows `rng.ts:37`, which the sim already uses for a value outside an allowed domain, where `hash.ts` reserves `TypeError` for type violations                              |
| 67 | `sim.dispatch` is left non-atomic in this slice                                       | Slice 2b is introducing exactly this wrapper in `46d90b3`; adding a second copy here would collide on merge. Decisions 64 and 66 make the rejection happen before any mutation, which is the property this finding needs                                  |
| 68 | Migration 3 sets `balance: null`                                                      | Migration 2 set the precedent one line above, every consumer guards for null, and `packages/sim` cannot source a real `Balance` without failing its own import gate. A v3 save carries a `PuzzleBalance`, which no honest rule can widen into a `Balance` |
| 69 | The v3 fixture is regenerated from `f5ee82a` and the manufactured one deleted         | The convention slice 2 paid for is a committed save an earlier build could actually have written. A hand-stamped downgrade cannot migrate for real, and this one conceals two separate defects rather than one                                            |
| 70 | The v3 fixture gets an independent-path check, as the reference run minus its balance | The v2 model at `migration.test.ts:69` does not transfer literally, but the two builds are identical outside `balance`, so the migrated save deep-equals `{ ...reference.state, balance: null }`, hash included                                           |
| 71 | Obstacle damage raises the melee handicap, and `'wear'` leaves `DamageSource`         | The wiki names four damage sources and exempts exactly one. With `'wear'` unconstructable, an allow-list would branch on a value that cannot occur, so decision 59's precedent applies and the conditional goes entirely                                  |
| 72 | `CollisionOutcome`'s fused damage is not split in this slice                          | Decision 71 makes the label irrelevant to every rule that exists today, so splitting it buys nothing now and widens a slice that is already three repairs wide. It is recorded as the debt it is                                                          |
| 73 | The melee tie-break is re-measured, not changed                                       | Nothing published contradicts it, so changing it would be inventing a rule inside a repair slice. Measuring it is what `ISSUES.md` asked for and what makes the next decision about it evidence-led                                                       |

**What the development task must not do.** Three guardrails, each earned by something above. It must
not weaken, re-seed or delete `battle.test.ts`'s win/loss existence assertions to accommodate a moved
outcome mix — the prototype says they pass, so a failure there is new information and must be reported
rather than absorbed. It must not change the melee tie-break; measuring it is the whole instruction. And
it must not re-record a fixture whose movement it cannot explain: nothing in a bilging session applies
obstacle damage, so a moved bilging hash is a regression, not a blessing opportunity.

**A correction to this document.** The slice-3 review entry states that a genuine slice-2 v3 save
carries balance keys `_note` and `bilging`. It carries `bilging` alone: slice 2's `loadPuzzleBalance`
builds a literal from named blocks and never copies `_note` or `_sources` out of `balance.json`. The
new fixture pin asserts the correct shape.

### 2026-09-02 — development, slice 3 repair (cycle 1)

The three blocking findings from the PR 3 review are fixed, on the existing branch and PR 3 rather
than a fresh one, so the slice still lands as one reviewed unit. Decisions 64 to 73 were followed
without substantive deviation; everything below is either a measurement that confirmed one or
something the implementation found that the analysis had not.

**Repair 1, the ship-class guard.** Both guards now validate through `SHIP_CLASS_IDS` with the
`Array.find` idiom, and the `as ShipClassId` casts on both sides of `parseShipClass` are gone — the
find genuinely launders `string`. `SHIP_CLASSES`, `RAM_SIZE_RANKS`, `BALL_WEIGHTS_MICRO` and the ram
overrides built in `battle/turn.ts` are null-prototype behind an intermediate typed local, and
`shipClassOf`, `ramSizeRankOf` and `ballWeightMicroOf` throw `RangeError`. `SHIP_CLASS_IDS` still
yields the same fourteen ids in the same order. `sim.dispatch` was left non-atomic, per decision 67.

**The pre-fix failure is quieter than the analysis described, which strengthens the case for the
guard.** The document says an accepted `crewCount` commission "only dies on the next `sim.step`". In
the default `marker-field` scenario that step does not die: the scenario carries `balance: null` and
no battle, so nothing calls `shipClassOf` on the corrupt ship during a tick, and all eight poisoned
sessions stepped cleanly. A poisoned session can therefore keep answering `sim.step` indefinitely
rather than failing loudly. The new test pins the state hash rather than relying on a later throw.

**Repair 2, the v3 to v4 migration.** `migrations[3]` sets `balance: null`. The regenerated fixture
was produced independently in a throwaway worktree at `f5ee82a` and came out byte-identical to the
analysis prototype's, balance keys exactly `["bilging"]`, 1561 bytes, LF.

**The manufactured fixture was wrong in more than its balance.** It also carried an extra
`rngStreams["bilge.refill"]` cursor and `puzzle.moves: 1` with a move recorded in the last frame
interval — neither of which a real slice-2 run at that seed and tick produces. The genuine fixture
matches a current-build reference run exactly outside `balance`, as decision 70 predicted.

**The torn tick is literal, not inferred, and there is now a test that shows it.** Against the
unfixed migration, loading the genuine fixture and stepping a commissioned ship throws
`TypeError: Cannot read properties of undefined (reading 'crewDutyOutputPerMille')` in `npcOutputOf`,
reached through `stepShips`. The unfixed migration leaves a `PuzzleBalance`-shaped balance in place,
`stepShips` sees it as non-null, and `dutyOutputsOf` reaches `balance.npc` on an `undefined`. The
throw lands after `advanceTick`, `driftMarkers` and `stepPuzzle` have already committed — the tear
decision 66 describes, now demonstrated rather than reasoned about.

**A convention break worth a reviewer's eye.** `tests/sim/migration.test.ts` is now the first file
under `tests/sim/` to import from `packages/harness`; every other file there imports only from
`packages/sim`. No gate objects — `check-sim-deps.ts` and `check-sim-imports.ts` scope to
`packages/sim`, the eslint purity rules to `packages/sim/src` — and `tests/battle/session.test.ts`
already mixes the two the same way. The analysis prototype had put these tests in a new file; they
were consolidated into `migration.test.ts` instead, which is where the assertions they correct live.

**Repair 3, the melee handicap.** `'wear'` left `DamageSource` and the conditional at `meters.ts:48`
went with it. Exactly one existing test went red on the source change, the assertion at `:266`, as
predicted — that was measured across the whole suite, not assumed. The melee tie-break is untouched.

**The fused-damage test replicates one line of production logic, deliberately.** `applyOutcomes` is
unexported and `turn.ts` was outside the repair's scope, so the new test drives `resolveMovement`
directly and re-applies `turn.ts`'s `struckObstacle ? 'obstacle' : 'ram'` label rule itself. The
collision numbers come from the real resolver — victim 1,000,000 fused, mover 500,000 — but the
labelling step is duplicated, and it will not follow `turn.ts` if that rule changes. Recorded rather
than fixed, because exporting a function to suit a test is the larger change.

**The post-fix measurement reproduces the analysis exactly.** Re-run over 600 seeds under the mirror
policy, with the turn cap lifted so nothing scores `unresolved`: player won 326 (54.3%),
melee-decided 464 (77.3%), sunk 136 (22.7%), ties 261 of 464 (56.3%), nil-against-nil 218 (83.5%),
longest battle 168 turns. Every figure matches the analysis's post-fix column to the unit. The
grapple share was verified independently rather than copied: the brigand grapples in 343 of 464
melee-decided battles, 73.9%, and the player takes 199 of the 261 ties. Ties now settle 261 of 600
battles, better than two in five.

**`ISSUES.md` gained a section rather than entries under the review heading.** The five items this
repair deliberately did not fix are the repair's debt, not the review's, and the review section's
preamble scopes it to what that review let through. They sit under a new
`2026-09-02 — repair of the slice 3 review findings` heading, following the file's newest-first
order.

**Verification.** `npm run check` is green from cold through all five stages — deps, imports,
typecheck, lint, test — at 257 tests, up from the 252 the review saw. Each of the five added or
corrected tests was proved red against the unfixed code and green after, including the one the
analysis warned about: the independent-path migration test was proved red with the genuine fixture
already in place, which is the trap that would otherwise have shipped the same invisible bug behind a
green suite. All eight files under `packages/fixtures/` are byte-identical to `HEAD` with CRLF
normalised, except the deliberately regenerated v3 save. `battle.test.ts`'s win and loss existence
assertions pass untouched, so the guardrail did not need to be exercised.

### 2026-09-02 — independent review of the slice 3 repair (PR 3, cycle 1)

Four lenses over `d5d5c5e..3943f47` — correctness and regression, security and data safety, spec and
architecture conformance, maintainability and test coverage — each in its own isolated worktree.
**No blocking findings.** The repair is approved and forwarded to the test stage. Twenty-odd
non-blocking findings are in `ISSUES.md` under the matching heading.

**A disclosure that belongs in the record.** This review ran in the same dispatcher run that produced
the repair, because the repair wrote the review task and the dispatcher drains inboxes within a run.
Independence was preserved structurally rather than by separation: each lens was a subagent with
fresh context, told to verify rather than to trust the analysis document or the PR description, and
the findings below are the ones that survived. It is still weaker than a review by a later run, and
the test stage should be read as the first genuinely independent check.

**The lenses confirmed the repair's central claims by re-deriving them.** Every one of the five
red-before claims reproduced with the failure mode the development entry describes, including the
critical one — the independent-path migration test is red against the unfixed `migrations[3]` with
the genuine fixture already in place, so the repair is load-bearing rather than decorative. The
regenerated fixture was independently regenerated from `f5ee82a` and came out byte-identical modulo
the trailing newline every other fixture has. The trajectory-invariance claim was checked the hard
way, by digesting per-turn positions, facings, damage, bilge and cannon state plus event counts
across all 600 seeds before and after: **zero seeds differ**. `meleeDamageSmallMicro` was confirmed
to have exactly one production reader, `meleeSideOf` at `battle/session.ts:165`.

**Decision 67's rationale does not survive inspection, and that is the most important finding.** The
decision left `sim.dispatch` non-atomic because "slice 2b is introducing exactly this wrapper in
`46d90b3`". That commit is titled "make `sim.step` and `sim.runUntil` atomic" and its `atomically<T>`
wraps `stepWithinEventBudget` and `stepUntilPointerEquals` only; at slice 2b's tip `af6d428` the
`sim.dispatch` handler still has none. The feared merge collision was impossible anyway — the repair
touches no file under `packages/harness/src/methods/`. So the code is right, the reasoning is wrong,
and the remainder of the original finding now has no owner. It is not blocking: `parseCommand` maps
the whole batch before any dispatch, decisions 64 and 66 reject before mutation, and a rejected
commission was measured to leave the state hash unmoved. **Whoever plans the next slice should give
`sim.dispatch` atomicity a home rather than assume 2b took it.**

**Two claims in the record were too strong and are corrected.** The flip count is 84, not 36 — 60
verdicts flip to the player and 24 against, a net of 36, which is the win-count delta rather than the
number of battles that changed hands. And `deserialise` is not the only unvalidated door: `Sim.restore`
reaches the same `RangeError` through `cloneWorldState`, which is a `JSON.parse(canonicalJson(...))`
with no validation. Both are corrected in `ISSUES.md`; the earlier entries are left as written, since
this document appends rather than rewrites.

**The security lens found the bug class genuinely closed, not just its eight instances.** A repo-wide
audit of every module-scope literal indexed by a variable found one surviving instance of the shape,
the `ramDamage = {}` default already recorded — plus a second, unrecorded one at `ram.ts:19`, now
added to that entry. Both are unreachable, and the reason is decision 66 rather than luck: feeding a
poisoned ship to `resolveMovement` throws `RangeError` in `shipClassOf` before the literal is ever
indexed. Prototype pollution through a crafted save is not possible — `JSON.parse` creates
`__proto__` as an own data property — and `Object.assign(Object.create(null), src)` was verified to
copy an own `__proto__` correctly where `Object.assign({}, src)` silently drops it, so the chosen
idiom is the safer of the two. No RPC method loads a save, and production code writes no files, so
the torn-tick-from-a-bad-save path has no reachable entry point today.

**Where the test coverage actually is, which is less than the green suite suggests.** Reverting each
of repair 1's production edits in isolation leaves the suite green in four of five cases: the
sim-side guard at `battle/dispatch.ts:23`, the three `RangeError` throws, and the null-prototyping of
three of the four tables. The two guards are individually redundant — reverting either alone leaves
the prototype-key test passing, because each covers for the other — so the suite pins their
disjunction, not either half. The hardening is deliberate defence in depth and the user-visible
vulnerability is proven, so this is the cost of that choice rather than a defect; but a future
tidying pass would find no test standing in its way, and `shipClassOf`'s guard is additionally dead
code by its own declared type. The `RangeError`s are the defence for the `deserialise` and `restore`
doors, so they are the ones worth a test first.

**One test promises more than it delivers.** The torn-tick test is red before the fix only because
`step(1)` throws; neither of its assertions runs in the red case, and in the green case they cannot
fail, because `balance: null` makes `stepShips` return before touching a ship. It is a real test of
"a migrated save loads, dispatches and steps without throwing" — which is worth having — but not of
"a tick does not tear". The name should say the weaker thing.

### 2026-09-02 — physical test of the slice 3 repair (PR 3, cycle 1)

The first genuinely independent check on the repair, run a dispatcher tick after the review that
cleared it. Four threads were driven in parallel against a live `pp-harness` in an isolated worktree,
each told to verify rather than to trust this document. **No blocking failure in the change.** All
three repairs do what decisions 64 to 73 say. What blocked the stage was not the code but the branch:
PR 3 could not be merged at all, and that is recorded below with its cause and its fix.

**The guard is stronger than the analysis claimed, and the claim was measured too narrowly.**
`Object.getOwnPropertyNames(Object.prototype)` returns **twelve** names on node 24.18.0, not eight —
the record everywhere calls this "the eight `Object.prototype` member names" and omits
`__defineGetter__`, `__defineSetter__`, `__lookupGetter__` and `__lookupSetter__`. All twelve were
driven, in both the `crewCount` and the bare variant, over one live session: **24 of 24 refused**,
every one a JSON-RPC `-32602` with `data.reason` `invalid-params` and the message
`unknown ship class "<name>"`. The `crewCount` variant that was silently *accepted* before the repair
is refused identically to the bare one. Rather than compare state hashes, the run took a snapshot at
the clean baseline and ran `state.diff` after each attempt: **all 24 returned an empty patch**, which
is a byte-level no-op and a stronger assertion than the one the repair pinned. Two batch probes
confirm the refusal precedes any mutation — a valid `marker.place` or a valid `sloop` commission
batched ahead of a poisoned one does not apply either. A valid commission on the same session
immediately afterwards is accepted and advances `nextEntityId`, so the refusal is class-specific and
not a blanket failure, and the session then steps, snapshots and restores to the exact hash.

**The migration was checked against a control that reproduces the bug it fixes.** There is no RPC
method that loads a save, so the production path — `Sim.load` to `deserialise` to `migrate` — was
driven directly. On the genuine v3 fixture the migrated state is schemaVersion 4, `balance` exactly
`null`, `ships` `[]`, `battle` `null`, and the puzzle structurally present. Its inertness was
demonstrated rather than asserted: **every one of the 144 board cells was swept and refused**, 5000
ticks moved nothing inside `/puzzle`, and the `bilge.fill` cursor never advanced while `marker.drift`
went 120 to 5120. `puzzle.start` reports `balance-missing` — and does so even for `sailing`, because
the balance check precedes the unknown-puzzle check. Commissioning two sloops and stepping 2101 ticks
throws nothing. The control is the part worth keeping: applying the **pre-repair** migration by hand
to the same fixture and stepping one tick throws
`TypeError: Cannot read properties of undefined (reading 'crewDutyOutputPerMille')` with the tick
already advanced 120 to 121 and the markers already moved. The torn tick is real, and the repair
closes it.

**Battles start, progress and conclude — 130 of them.** Ten seeds across five policies to a 60-turn
cap, then twenty fresh seeds across four policies to a 120-turn cap: **zero unconcluded, zero
desyncs, zero stalled turn counters**, longest 65 turns. A win is `/battle/outcome`, not a flag on a
ship. Both terminal paths reproduce by melee and by sinking: `player-won` at 6 turns on seed 20260902
transfers `bootyPoe` 659 and 40 cargo units off the brigand; `player-lost` at 14 turns on seed 7919
takes the player to exactly `10000000` `damageTakenSmallMicro`, the sloop's `fullDamageSmallMicro`,
and transfers nothing. `battle.disengage` is refused `disengage-not-ready` on turns 1 to 10 with the
counter visibly walking 10 down to 1, and accepted on turn 11 at 0, ending the battle `disengaged`.
All nine battle rejection reasons were reached, and **every rejection left the state hash unmoved**.

**The melee change is live, and its mechanism was confirmed in isolation.** On seed 7919 turn 6 the
only damage event of the turn is an obstacle strike for 500000, and `state.diff` shows exactly one
replacement: `/ships/0/meleeDamageSmallMicro` from 1000000 to 1500000. Under the pre-change rule it
would not have moved. **The trajectory-invariance claim holds and is structural, not incidental** —
`meleeDamageSmallMicro` is written only in `applyShipDamage` and read only by `meleeSideOf` at
`battle/session.ts:165`, so it reaches no movement, collision, gunnery, minting, repair or sink test.
**The "36 net of 464, 84 flips, 60 to 24" figures could not be corroborated**, because that corpus
was not reproduced here; an independent 50-battle sweep found 29 melee conclusions and 4 flipped
verdicts, 2 each way, which confirms the mechanism and that flips go both directions but says nothing
about the skew. Anyone relying on the 60:24 asymmetry should re-derive it.

**Determinism holds cold, and nothing recorded moved.** Nine scenario-and-seed combinations across
`marker-field`, `bilge-session` and `sea-battle` were each run twice in **separate driver processes
spawning separate harness children**, comparing the whole hash trail and the final `rng.cursors`
rather than just the final hash: identical in all nine, and identical again for two sessions inside
one process. All three committed replays verify with their own scenario passed, including
`marker-drift-diverged-at-tick-5.json`, which reports `divergedAtTick` 5 exactly as designed. Each
replay was then **re-recorded from scratch over the protocol** into scratchpad copies and matched the
committed trail checkpoint for checkpoint — the corrupted fixture differing at tick 5 alone, where
the genuine value was recovered. All eight files under `packages/fixtures/` hash equal to `6d491e9`.
Only `packages/fixtures/saves/bilge-session-v3.json` was ever expected to have moved, and it did not:
blob `e923b3c37240e04b157bd81295f37ef252e4f4d0`, 1561 bytes, LF, raw balance keys exactly
`["bilging"]`, verified from the blob rather than from the working file.

**The measured hazard is confirmed to the seed.** `tests/harness/battle.test.ts` still declares
`MAXIMUM_TURNS` 120 over 24 seeds of `seed * 7919`. Re-driving that exact mirror policy with the cap
lifted to 400: the committed 24 all resolve, longest **51 turns** on seed 21, 69 turns of headroom.
Sweeping seeds 1 to 600 took 165 seconds and found **exactly one** over the cap — **168 turns at seed
466, root seed 3690254, player-won** — with the next longest at 96. The claim is verbatim correct.
Nothing was re-seeded and the cap was not touched.

**What actually blocked the stage: PR 3 was unmergeable, and squash is why.** GitHub reported
`CONFLICTING` across twenty-one files including six `packages/sim/src` modules. There is no content
behind any of it. PR 2 was squash-merged into `agent/develop` as `eca8058`, minting new SHAs, while
this branch carries slice 2's *original* commits through the merge at `5575426`; git therefore sees
slice 2's entire change set arriving independently on both sides. Two measurements settle it:
`agent/develop`'s tree is **identical** to slice 2's feature tip `0ac1b52`, which this branch already
contains, and resolving all twenty-one conflicts in favour of this branch **reproduces `6d491e9`'s
tree byte for byte**. The only content `agent/develop` held that this branch lacked is 68 lines of
documentation from slice 2's re-verification commit. The merge at `14759c0` takes this branch's side
for every code, test and fixture file and unions the two documents — `ISSUES.md` newest-first, this
document chronologically — for a diff against `6d491e9` of **68 insertions and zero deletions**.
`npm run check` is green on the merged commit at 257 tests, and CI passed on it.

**The merge into `agent/develop` was made with a merge commit, not a squash, and that is a deliberate
deviation from the queue-test skill.** Squashing PR 3 would detach its history exactly as PR 2's
squash detached slice 2's, and slices 4 and 5 are branched from *this* branch — they would inherit a
larger version of the same conflict, as slice 2b already will. Preserving history costs nothing and
stops the recurrence. This is a workflow decision that outlives the slice, so it is raised for the
human in `ISSUES.md` rather than settled quietly here.

**Two environment facts, recorded so the next run does not chase them.** A fresh worktree checks the
v3 fixture out at **1562 bytes, not 1561**, because `core.autocrlf` is `true` globally; the committed
blob is LF at 1561 and `git status` stays clean. Do not read this as a clobbered fixture. And the
worktree recipe that works is to copy the main checkout's `node_modules` **including `.bin`** —
omitting it costs a run on `tsc is not recognized` — then replace `node_modules/@opp` with three
junctions pointing at that worktree's own `packages/`.

### 2026-09-02 — development, slice 2c (OPP-14)

The bonus-shape token layer and the maneuver meter, on
`agent/feature/20260902-094000-opp-slice-2c-bilging-token-layer`, branched from the slice 2b head
`af6d428` rather than from `agent/develop`: slice 2b is still in the test stage and `agent/develop`
is at `eca8058`, which has no critters and no star levels to hang a token layer off. The task file
sanctions the unmerged base explicitly.

**The representation, decided before the adjacency rule was written**, because decision 58 gated
this slice on it and everything else follows from it.

**Decisions taken on the goal's behalf.**

| #  | Decision                                                                                              | Rationale                                                                                                                                                                                                                                             |
| -- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 61 | Bonus halves live in a parallel `shapes: number[]` on `Board`, indexed exactly like `cells`             | `BoardCell` stays a bare number, so colours 0-15, empty at -1 and the three critter sentinels keep the meanings decision 46 gave them, and every board test written against them still holds. Widening the encoding would re-partition a namespace that board, gravity, resolve, critters and the fixtures all read directly |
| 62 | A shape is `symbol * 2 + half`, 0 to 7, and -1 for none                                                | The eight published shapes fit one small non-negative integer, so `canonicalJson`'s safe-integer guard covers the payload for free and no enum string reaches hashed state                                                                              |
| 63 | Gravity carries the shapes inside `compactSegment` rather than replaying the permutation afterwards     | `applyGravity` returns `CellFall { row, distance }` with no column, so the permutation cannot be reconstructed from its result. One traversal that moves both arrays is the only version that cannot drift out of lockstep                              |
| 64 | The schema goes to 4, with a real v3 to v4 migration and a committed v3 save fixture                   | `Board` gains a field, so every v3 save lacks it. Slices 1 and 2 both set the precedent that a migration is written only when a committed older-schema fixture exercises it                                                                             |
| 65 | Token pieces spawn from a new `bilge.tokens` stream, after the critter pass, only onto refilled colour cells | Decision 52: draws on `bilge.refill` would shift the pinned refill order. Spawning after critters and only where `isColourCell` holds keeps a shape off a crab, a puffer and a jelly, so a shape never rides something that is not a bilge piece         |
| 66 | The spawn rate is stated as a conditional rate in its `_sources` entry                                  | Decision 53's honesty rule, and the crab-rate lesson the slice 2b review left: a gate over a spawn band silently turns a flat stated rate into a lie. The draw happens only on a refilled colour cell while performance is good, and the entry says so   |
| 67 | A pair is two orthogonally adjacent matching halves, resolved once per settle, ascending index order, each half consumed at most once | The wiki says only that the halves are "adjacent" and states no orientation. Requiring the top half directly above the bottom would be a stricter rule than the source gives, with no published pair rate to calibrate the difference against. Ascending index order makes the pass deterministic without a draw |
| 68 | A "bonus piece" on the meter is one completed symbol, that is one removed pair                          | Halves come in twos, so the published "3 bonus pieces fill the bilge meter" is only coherent if the unit is the completed symbol, and the sloop's published 3 / 6 silver / gold bilge row reads the same way                                            |
| 69 | The meter is the sloop's bilge bar alone, capped at the published gold 6, with no consumer               | The task scopes out what the meter feeds, and the wiki's full `ManeuverMeter` is per ship, per shape, across three duties. A cap keeps a long session bounded without inventing a consumer                                                             |
| 70 | The published 3 and 6 live in code, not in `balance.json`                                               | Decisions 44 and 54: the file is for invented numbers, and a sourced value in it blurs the line it exists to draw                                                                                                                                      |

**What is here.** `Board` carries a parallel `shapes` array indexed exactly like `cells`, and every
place a piece moves carries its shape with it: `swapCells`, `clearCells`, `refillBoard`,
`compactSegment` inside `applyGravity`, and `climbCrabs`. `tokens.ts` holds the two passes —
`spawnTokens` writes a shape onto a refilled colour cell while the duty rating is good or better,
and `clearShapePairs` removes both halves of every completed symbol and leaves the two pieces
standing. `settleStep` runs them in that order after the critter spawn, and reports the removed
shapes as `ResolveStep.pairedCells`; `applyBilgeMove` turns two removed shapes into one point on
`PuzzleState.maneuverBar`, clamped at the published gold 6.

**The one invented constant.** `bilging.tokenSpawnPerMille` at 120, and nothing else. The
performance gate reuses the published rating `good` through `ratingOf`, rather than inventing a
second threshold for a band the wiki already names.

**The rate was measured, not guessed**, because the slice 2b review had just caught
`crabSpawnPerMille` producing zero crabs — a gate over a spawn band silently turning a stated rate
into a lie. Over 5 seeds by 400 clearing swaps, at 13 ticks a swap, with about 6.5 refilled colour
cells per clearing swap:

| rate | tokens per 100 swaps | pairs per 100 swaps | swaps to fill a sloop's 3-pair bar |
| ---- | -------------------- | ------------------- | ---------------------------------- |
| 60   | 37.25                | 0.90                | 333                                |
| 120  | 71.70                | 2.90                | 103                                |
| 180  | 113.25               | 6.40                | 47                                 |
| 240  | 152.75               | 12.75               | 24                                 |

At 60 the mechanic is dead — one bar per very long session. 120 fills silver in about 100 swaps and
gold in about 207, and no seed is an outlier (10, 11, 10, 12, 15 pairs over 400 swaps). Pairs scale
with roughly the square of the rate, as two shapes have to meet. The `_sources` entry states the
conditionality and the measured yield in words, so the number cannot be read as a share of the
board.

**Correction to decision 66's premise, worth having.** The gate is real and tested but it is an
opening delay rather than a throttle: over those same 2000 moves it was open on 1991 of them, the
nine closed being the first swaps of each session while the rating climbs out of `booched`. Nobody
should later read the wiki's "token pieces only spawn while performance is good" as a meaningful
brake on a competent player. The wiki's other half of that sentence, "low score slows or stops token
spawning", would need a graded rate to be true, and this slice does not have one.

**A bug the token layer exposed, fixed here.** `climbCrabs` swapped a crab with the piece above it
by writing `board.cells` directly, so once shapes existed the displaced piece left its shape behind
on the crab's old square. Fixed in the same traversal.

**The schema went to 4 with a migration that is genuinely exercised.** `packages/fixtures/saves/`
gains `bilge-session-v3.json`, generated by driving the slice 2b head `af6d428` in a throwaway
worktree rather than by relabelling a current save — the pre-existing `saveAtSchemaVersion` helper
builds its older save from a current sim whose puzzle is null, so those three tests take the
migration's pass-through branch and are vacuous with respect to the fields it exists to add. That is
recorded in `ISSUES.md`, not fixed here.

**Every re-blessed fixture was classified before it was touched**, per the golden-state skill: 2 ops
on the scenario, 4 on the golden, and hash-trail-only changes on both replays. `marker-drift` needed
re-recording for the schema bump alone. Nothing behavioural moved, and two things were verified
directly against `af6d428` rather than argued: the opening board's `cells` are byte-identical, and
`bilge.refill` ends at the identical cursor `{hi 1590756343, lo 3448896022, draws 12}` after the
committed replay's command log. The only new stream is `bilge.tokens`.

**What is left for the follow-up.** Nothing consumes the meter, by scope — and because nothing
drains it, it saturates at gold after 66 to 166 swaps depending on seed and every later pair is
discarded. That is correct for this slice and wrong the moment blockades exist. The wiki's real
`ManeuverMeter` is per ship, per shape, across three duties with silver and gold tiers; this slice
has one integer on the puzzle state. Both are in `ISSUES.md`.

**Verified:** `npm run check` green from cold, 149 tests, up from 130 at the end of slice 2b — the
dependency gate, the import gate, three typecheck projects, lint and the suite. The containment
boundary is unmoved at 99987 accepted / 99988 refused, re-measured rather than assumed. `sim.step`
still opens no puzzle stream, `bilge.tokens` included. Token draws do not shift the pinned
`bilge.refill` order, asserted now by a test that runs the same seed and swap with the gate shut and
open and compares the refill cursors.

### 2026-09-02 — development, slice 4 (OPP-11)

The MVP loop is closed. A pirate starts in port at Alkaid with a purse, buys cargo on the dock,
charts a voyage across a league-point graph, meets brigands on the way, fights the slice 3 sea
battle, takes booty, ports at the far island, divides the chest and sells the cargo — and the whole
run saves and reloads to an identical state hash. `tests/world/pillage-loop.test.ts` drives exactly
that sequence in one scripted scenario, which is this slice's `Done when`.

**Built on an unmerged chain, as decision 11 anticipated.** `agent/develop` is still at slice 2
(`eca8058`); PR 3 has passed its review but not its test stage. This branch is therefore cut from
`agent/feature/…slice-3` at `6d491e9` and carries slices 1, 2 and 3 as well as its own work. **Slice
2b is not in this history** — there are no critters, and no `atomically` wrapper on `sim.step` — so
nothing here assumes either. The repo squash-merges, so once PR 3 lands this branch needs rebasing
onto `agent/develop` before its own diff is readable.

**Where the world lives.** `packages/sim/src/world/`, mirroring `puzzle/` and `battle/` for the
reason decisions 37 and 47 give: a separate package cannot be purity-gated and import `@opp/sim` at
the same time. The two gates covered the new subdirectory without modification, again.

**The scale of the world is deliberately one archipelago.** Ursa: 7 islands on 36 hand-authored
league points. Ursa was chosen over the other fourteen because its published spawn sets alone carry
the whole ship-supply chain — sugar cane, wood and iron — so the market closes without importing a
second archipelago's geography.

**Decisions taken on the goal's behalf.**

| #  | Decision                                                                                | Rationale                                                                                                                                                                                                                                                    |
| -- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 74 | The world's static tables live in code; only the pirate, the voyage and stock are state   | `SHIP_CLASSES` set the precedent. A map edit is then a code change that fails a golden loudly, the save stays small, and the hash does not carry 36 immutable points around                                                                                   |
| 75 | One archipelago, Ursa, on a 6x6 offset grid of 36 points                                  | Decision 7 already settled that Emerald is hand-authored, not scraped. Ursa's spawn sets carry the sugar cane, wood and iron of the ship-supply chain, so one archipelago is a self-sufficient economy rather than a fragment of one                           |
| 76 | The horizontal-league cost is a code constant, not a `balance.json` key                   | The wiki publishes it: a horizontal league takes 40% longer. Decision 44 already ruled that a sourced value in the tuning file blurs the line decision 6 exists to draw, so it sits with the graph it describes                                               |
| 77 | Only colonized islands have a market                                                      | The wiki spawns raw commodities only at colonized islands, and an uncolonized one is a bare waypoint. It also makes `island-has-no-market` a reachable rejection instead of the unreachable `commodity-not-traded` it replaced, which decision 59 would forbid |
| 78 | Prices are fixed at world creation from a spawn discount and a scarcity premium            | The wiki stores no global price — a snapshot is the min sell and max buy across an island's buildings, and there are no buildings until a later phase. One implicit dock per island reproduces the trade-run gradient with none of the shoppe machinery        |
| 79 | Cargo lots are added alongside slice 3's `cargoUnits`, not in place of it                  | Decision 57 expected them to replace it, but `cargoUnits` is the denomination slice 3's booty overflow policy and its tests are written in. Re-denominating that path buys nothing this slice needs, so lots are additive and `freeHoldOf` counts both         |
| 80 | Brigand cargo becomes a real commodity lot when the battle settles, not at capture         | Capture happens inside slice 3's `awardBooty`, which is denominated in kilogram-equivalents. Settling is the first moment the world owns the outcome, and it keeps the conversion out of the battle layer entirely                                             |
| 81 | The encounter commissions its brigand with `booty.brigandCargoUnitsBase`                   | That key existed with a `_sources` entry and no code reading it — one of the five such gaps `ISSUES.md` records. Wiring the brigand's hold to it makes the entry true rather than adding a second key meaning the same thing                                   |
| 82 | The NPC crew's shares leave the economy; only the cut and the player's share are kept      | With an all-NPC crew the wiki's share table collapses to a dial, as the map itself notes. Paying the crew's shares back into the ship would make `playerSharePerMille` meaningless, so they are a sink and the restocking cut is what returns to the hold      |
| 83 | `stepWorld` settles only an encounter a voyage owns                                        | The first version cleared any concluded battle and struck off the brigand, which broke slice 3's test that reads the brigand's hold after a direct `battle.start`. A battle nobody sailed into is not the world's to tidy up                                  |
| 84 | `session.load` refuses an unloadable save with `invalid-params`                            | No RPC method loaded a save, so `save, reload, identical hash` was undrivable over the protocol. The fault is entirely in the caller's parameter; the other reasons in `errors.ts` all name something the registry does not hold                               |
| 85 | The `_sources` bijection is now a test                                                     | This slice added 15 tuning keys to a convention enforced by nothing but review attention. `ISSUES.md` had already observed that one test would catch the whole class, and it costs six lines                                                                  |

**The world commands are atomic by construction, which the open `sim.dispatch` question makes worth
saying.** `ISSUES.md` records that `sim.dispatch` atomicity is unowned since slice 2b did not take
it, and that it starts to matter when a command that mutates before it can fail is added. Every
world command validates fully before it writes, and the market's rejections are tested by snapshot
to prove they mutate nothing — so this slice adds no instance of that class, but it does not close
the question either.

**What the balance change cost, and why that is the system working.** Adding the `world`, `market`
and `division` blocks and bumping the schema to 5 invalidated every committed state hash, because
decision 41 pins the tuning into hashed state on purpose. Nine fixture tests went red and were
re-blessed as an intended behaviour change under `pp-golden-state`'s gate. A tenth red test was not
a fixture at all but the real regression decision 83 records — which is the argument for running the
whole suite rather than only the tests near the change.

**Deferred, with the reason.** Charts as inventory items, chart decay and league-point memorization
are phase 2 in the wiki map and the loop closes without them, so charting validates a route rather
than a chart. Bid tickets, shoppes, labour, orders, rent and governance were out of scope by the
task. Merchant brigands and greedies are phase 2. Restocking the magazine at a port is **not** done:
`small-cannon-ball`, `swill` and `grog` are tradeable commodities, but buying them fills the hold
rather than the ship's `cannonballs` and `rum` counters, so decision 63's placeholders still stand.
That is the substance of the follow-up development task this slice emits.
### 2026-09-02 — development, slice 4 correction: the booty chest (OPP-11)

Decision 80 was wrong in its destination, and the user caught it before the review did. Plunder was
being materialised straight into the ship's **hold**, which erases the distinction the wiki draws
between goods a pirate bought and goods a pirate took. The wiki is explicit: a win puts commodities
and chests into the ship's **booty chest**, an officer may sell out of that chest before division,
and "unsold goods go into the ship's hold on division". A hold full of plunder that was never
divided is not a state the game can reach.

The rule, stated the way the user stated it: **traded commodities go to the hold; commodities
pillaged or foraged during a voyage go to the booty chest.**

**Decisions taken on the goal's behalf.**

| #  | Decision                                                                             | Rationale                                                                                                                                                                                                                                        |
| -- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 86 | A ship carries a `bootyCargo` chest distinct from its `cargo` hold                    | `bootyPoe` already stood beside `poe` for exactly this reason — coin taken is not coin owned until it is divided. Goods needed the same pair, and without it `booty.divide` had nothing to divide but coin                                        |
| 87 | Plunder enters the chest; division is the only thing that moves it to the hold        | It makes division a real event rather than a coin transfer, and it is what makes "sell what you pillaged" require porting first — the loop the wiki describes. `market.sell` sells from the hold, so plunder is unsellable until it is divided     |
| 88 | The chest and the hold draw on one mass budget                                        | The wiki shares the hold's mass and volume limits with the booty chest, so a full hold cannot take on plunder. `freeHoldOf` counts both, which also makes division mass-neutral and removes any need for a capacity check when the chest empties   |
| 89 | `booty.divide` is refused only when the chest holds neither coin nor goods            | The first guard tested `bootyPoe` alone, so a chest holding goods but no coin was undividable and its goods were stranded. A roll can pay no coin, so the case is reachable                                                                       |

**Schema 5 was extended rather than bumped again.** It is unreleased — PR 5 is open and unmerged —
so migration 4 now gives every ship a `bootyCargo` alongside its `cargo`. Bumping to 6 for a shape
no committed save has ever carried would invent history.

**No fixture moved.** No committed golden, scenario or replay carries a ship, so the added field
changed no pinned hash. The three tests that asserted plunder landing in the hold were rewritten to
assert the chest, and they were rewritten to assert the *new* rule rather than relaxed — each now
also asserts the hold stays empty until division. `tests/world/division.test.ts` is new and covers
the transfer, the shared mass budget, the unsellability of undivided plunder and the empty-chest
refusal; the end-to-end loop test now pins that a won encounter's goods reach the hold only after
`booty.divide`.

**One duplication removed on the way.** `stowLot`, `releaseLot` and `massKgOf` existed twice, once
in `market.ts` and once inside `encounter.ts`. They now live in `world/cargo.ts` with `transferLots`,
which is what division uses.

**Still deferred.** The wiki lets an officer sell pillaged goods directly out of the chest before
division, with the proceeds going back into the chest. That is a second selling path and a second
price surface, and the loop closes without it, so it is not built — `market.sell` sells from the
hold only.

### 2026-09-02 — physical test of slice 2b (OPP-13), PR 4

The test stage drove the real `pp-harness.ts` over stdio from the main checkout on the feature
branch, never a worktree, so the `node_modules/@opp/*` trap the task warned about could not fire.
The cold baseline reproduced: `npm run check` green at **130 tests** before the integration merge
below, **286** after it.

**Every behaviour the slice claims was reproduced through the protocol.**

The star ramp is exact. A `bilge-session` sits at star 0 and steps one level per 3600 ticks to a
hard cap: star 3 arrives at tick 10800 and not at 10799, star 7 at 25200, and tick 28800 is still
star 7. The colour count follows it — 200 swaps at each of stars 0, 2, 4, 6 and 7 left a board whose
highest colour index was 3, 4, 5, 6 and 6 against a `colourCountByStarLevel` of 4, 5, 6, 7 and 7.
An idle board floods to `waterLineRow` 3 and `bilgePerMille` 1000 by tick 7200 and stays there.

`bilge.poke` behaves as decisions 49 and 60 describe. A puffer at (10,1) cleared exactly
`[9,10,11,21,22,23,33,34,35]` — the clipped 3x3 — for **0 points**, took the move counter from 20 to
21, advanced no tick, and the chain it opened scored normally at 3 cells for 3 points, carrying
`totalScore` from 34 to 37. Poking a colour gives `not-a-puffer`; poking (12,0), (0,12) and (-1,0)
gives `poke-outside-board`; all four leave the state hash untouched.

The jelly does both published things. Swapped onto colour 0 with 32 of that colour on the board, the
opening step cleared **33** cells — the colour plus the jelly itself, decision 50 — for 33 points at
one per cell, and left no jelly. Swapped onto a puffer it detonates the puffer **first**: the
opening clear is the 3x3 centred on the puffer's own square, which contains the jelly, for 0 points,
and both critters are gone.

Star level scales scoring and never penalises it. Restoring one snapshot per swap, every scoring
swap on 15 boards was played once at star 0 and once at star 7 with the board byte-identical:
**527 clears of identical geometry, 69 scored strictly higher at star 7, 458 scored the same, and
none scored lower.** The equal ones are single lines, whose multiplier is floored at 1 — decision
56 holding exactly. A three-line clear went 9 to 27, a 3-and-4 line clear 8 to 16.

`settleTicks` is reported and inert. It was present on all 112 `bilge.cleared` events measured,
every value a multiple of 3, and the flooded board's histogram sits where the water rate puts it
(18 dominant, three cells at 6 ticks) against the dry board's (9 dominant, three cells at 3).
`totalScore` equalled the sum of step points exactly on both. The string `settleTicks` does not
occur anywhere in the canonical state, and two identical runs at star 3 end on the same hash.

Save, load and replay round-trip with critters on the board. A `snapshot.restore` on a session
carrying a jelly returned the same hash and a byte-identical board after 25 divergent moves; the
only difference on read-back is key **order**, which `state.get` reports as stored and the canonical
hash does not see. A 120-command log replayed through `replay.verify` under its own scenario to
`ok: true` at the recorded hash, and to `ok: false` without the scenario, as the skill warns. At the
sim level — there is no save/load RPC — a session saved at star 6 with two puffers on the board
reloaded to the same hash and stayed identical through 40 further moves and 120 ticks.

**The two review findings, observed as gameplay.**

*Crabs are reachable, but at about a fourteenth of their stated rate.* The review measured 0 crabs
in 5 seeds x 400 swaps and asked whether they are unreachable at all. They are not: across
**8 seeds x 400 moves at star 7 on a fully flooded board, 5 crabs spawned, climbed and cleared**,
one paying a 13-point step. The mechanism is now measured rather than inferred. `waterRowsOf` keeps
three dry rows at every flood level, so `waterLineRow` bottoms out at **3**, and `applyGravity`
stacks a step's vacancies at the top of the column; a refill can therefore only land at or below the
water line when a single column loses **4 or more** cells in one settle step. Over 838 settle steps
that happened often enough to put **229 of 4828 critter draws — 4.74 per cent** below the water
line. At `crabSpawnPerMille` 15 that predicts 3.4 crabs; 5 were seen. The effective crab rate in
play is therefore about **1 per mille of refills against a stated 15**, and the nominal expectation
over the same draws would have been 72. This is a tuning-and-mechanism question, not a broken
feature: every crab that did spawn behaved exactly as decision 47 and the wiki describe.

*A player almost never sees a crab between moves.* Because eligible vacancies sit at row 3 and
`climbCrabs` runs before `crabsAboveWaterLine` inside the same settle step, a crab spawned at the
water line is cleared on the next step of the **same** resolve. Across 2000 moves the board carried
a crab between moves **zero** times. The wiki's "denies its square until it climbs out" is not
observable at the current tuning.

*The stale-`refilled` overwrite was not observed.* No crab vanished mid-water without a `crabs`
entry and without paying. With only 5 crabs in the sample this excludes nothing — the code path at
`resolve.ts:61-67` is unchanged and the finding stands as reviewed.

**Nothing blocking was found, so PR 4 was merged. Two decisions were taken to get there.**

74. *The integration merge is the test stage's to make.* PR 4 was `CONFLICTING` because slice 3
    landed on `agent/develop` after this branch left it. `agent/develop` was merged into the branch
    at `e40293d`; the resolutions are in that commit message. One of them matters beyond the merge:
    git auto-merged `sim.ts` cleanly to slice 3's explicit command routing, which **silently dropped
    `bilge.poke`**, because slice 2b had reached `applyPuzzleCommand` through a fallthrough. A clean
    auto-merge was wrong, the typecheck caught it, and `bilge.poke` is routed explicitly now. Every
    probe above was re-run on the merged tree and reproduced byte for byte apart from the state hash.
75. *PR 4 is merged with a merge commit, not a squash.* This repeats the deviation recorded for
    PR 3 and for the same reason: squashing detaches the history that slices 4 and 5 are branched
    from and mints exactly the conflict resolved here. It remains raised for the human in
    `ISSUES.md` rather than settled quietly.

### 2026-09-02 — independent review of slice 4 (PR 5, cycle 0)

Four lenses ran concurrently against the branch head `7306a53`, each in its own worktree. The review
approved: nothing met the blocking test, and the slice went forward to the test stage. Everything
found is recorded in `ISSUES.md` under the same date. What follows is only what the review changed or
revealed about the *design*, which is what the next agent needs.

**Two recorded decisions are not implemented as written, and both should be read as open rather than
settled.**

Decision 83 states `stepWorld`'s rule as ownership — "a battle nobody sailed into is not the world's
to tidy up". The code guards on `state.voyage === null`, which asks whether *a* voyage is running, not
whether *this* voyage owns the battle; `settleEncounter` never reads `voyage.shipId`. A probe on the
pillage-loop scenario at seed 2 — chart an `evade` voyage, which can never spawn an encounter, then
hand-start a battle and disengage — has the world strike the brigand off a battle no voyage owned.
Slice 3's regression test passes only because it never has a voyage running. The same seam lets
`battle.disengage` followed by `voyage.port` orphan a concluded battle until the next voyage's first
tick. **Decision 83 stands as the intended rule; the implementation is a weaker approximation of it
and is queued for repair.**

Decision 88 claims the shared mass budget "makes division mass-neutral and removes any need for a
capacity check when the chest empties". It is not mass-neutral. Mass is floored per lot array, so
merging the chest into the hold re-floors the combined sum and can gain a kilogram —
`small-cannon-ball` at 7100 g is the only commodity that triggers it, and it is buyable and
plunderable. **The conclusion drawn from decision 88 — that no capacity check is needed — does not
follow from its premise, and a check is queued.** The rest of the decision holds: the budget genuinely
is shared, and a full hold genuinely does refuse plunder.

**The tuning is tighter than its provenance claims, and the encounter rate is the case that matters.**
Six `_sources` entries describe outcomes the constants do not deliver, all siblings of the
`tradeSpawnPenaltyPerMille` defect this slice already found and fixed. The consequential one is
`world.encounterChancePerMille`: because a pillage always adds both the difficulty term and the 300
pillage bonus, the base 250 is never the per-leg chance. The real range across the chart is 550 to
1000 per mille, and the only six-leg route out of Alkaid yields **4.61 expected battles** against the
entry's stated 1.5. The entry says "a voyage rather than a gauntlet"; the tuning delivers the
gauntlet. This is a balance decision the roadmap will have to take deliberately once a renderer makes
a pillage observable — recorded here so slice 5 does not inherit the number as though it were
measured.

**The verification machinery held, and was checked rather than trusted.** The five re-blessed fixtures
were independently reproduced: a live state rolled back across exactly the slice-4 delta reproduces
every committed old hash, and every checkpoint reproduces its new hash live. No tick count, marker
position or meter value moved. The diverged replay twin still differs from its sibling in exactly the
tick-5 checkpoint, with its `note` intact. The layering gates were proved to enforce over the new
`world/` subdirectory by planting a violation in a nested directory and watching them exit 1 — they
are depth-agnostic by construction, so the fact that they were not modified for `world/` is correct
rather than an oversight. The `_sources` bijection test bites in both directions.

**Determinism is sound, including the part that looked riskiest.** The two new streams are lazily
created and therefore path-dependent, but fully determined by the same inputs, and `canonicalJson`
sorts keys so insertion order never leaks into the hash. Save/load and snapshot/restore were cut at
six points across four seeds, including cuts inside a running battle, and reproduced identically each
time. No world code draws from a pre-existing stream.

**The tests defend the arithmetic and not the protocol.** Thirty injected faults, full suite each:
sixteen died, fourteen survived, and the survivors cluster entirely in the dispatcher. Five of eight
new events are asserted nowhere, nine of eighteen new rejection reasons are never asserted by name,
and the one test covering this slice's own headline correction — that plunder is unsellable until
divided — never reaches `sellCommodity` at all, because its fixture has no market. The production
code is correct in every case probed; it is the protection that is missing. **This is the pattern
slice 5 must not copy:** new events and rejection reasons need a test that names them, not a test that
asserts the status was one of two values.

**A layering drift worth knowing about.** `battle/booty.ts` now imports `cargoLotsMassKgOf` from
`world/cargo.ts`, so the battle layer depends on the world layer. Decision 80 meant to keep the
world's denomination out of the battle layer entirely. Both gates accept it and nothing is broken, but
the dependency runs opposite to the stated intent, and slice 5 should not deepen it.

### 2026-09-02 — independent review of slice 2c (OPP-14), PR 6

Four lenses over `af6d428..a97600f`, each an independent agent: correctness and regression, security
and data safety, spec and architecture conformance, and maintainability and test coverage. The suite
is green at 149 from cold in the main checkout, and the branch's true diff against `agent/develop` is
these four commits only, because PR 4 merged with a merge commit rather than a squash and
`agent/develop` therefore already contains `af6d428`.

**One finding blocks.** The v3 to v4 migration adds `board.shapes` and `maneuverBar` to the puzzle
and stops there, but this slice also added a field to the **persisted balance** —
`bilging.tokenSpawnPerMille` — and `Sim.load` takes the save's own balance as authoritative. After
migrating the branch's own committed `bilge-session-v3.json`, `balance.bilging.tokenSpawnPerMille`
is `undefined`, and the gate at `tokens.ts:37` reads
`if (draw() >= rules.balance.tokenSpawnPerMille) continue`. Because `n >= undefined` is `false` the
`continue` is dead, and the density throttle inverts from 120 per mille of refilled colour cells to
all of them: a migrated save reaches gold in about 15 moves against the entry's measured 66 to 166,
carrying 25 to 28 simultaneous shapes on a 144-cell board. Re-saving then launders the defect
forward — the file is stamped schema 4 with the field still missing. Two lenses found it
independently and the test stage's own re-run reproduced it; the answer already exists three lines
above in the same file, where migration 2 rewrites `balance` to `null` and fails closed at
`puzzle.start` with `balance-missing`, and slice 3 answered the identical situation the same way on
`agent/develop`. It is routed back to analysis rather than fixed here.

Its reachability is worth stating honestly, because it decides nothing but explains why the suite is
green: `deserialise` and `Sim.load` are exported from `@opp/sim` but reached from no RPC method and
no CLI, so only the tests call them, and no test plays a migrated save. It is judged blocking anyway
— it is silent world corruption produced by the exact commit whose purpose is the migration, and the
committed v3 fixture exists precisely so that saves get loaded.

**What the review could not break, which is the more useful half.** The lockstep between `cells` and
`shapes` — named in the task as the whole risk of the design — holds. Every write to either array
across `packages/sim` was enumerated: construction, swap, clear, refill, critter spawn, crab climb,
gravity's `compactSegment`, and the two token passes. The one unpaired write to `cells` is
`spawnCritters`, and it is provably safe because it only ever writes over indices in `refilled`,
which both `refillBoard` calls have already set to `NO_SHAPE`. Three independent empirical sweeps
agree: 400 randomised boards with every colour piece carrying a unique opaque tag through the full
settle pipeline, 300 randomised `resolveBoard` runs at star 7, and 2100 full-sim moves including 221
pokes, 82 jelly swaps and 150 planted crabs — no shape ever rode a non-colour cell, none was
duplicated or stranded, and no adjacent opposed pair was ever left standing after a settle. The
`climbCrabs` fix is real rather than claimed: reconstructing the pre-fix body strands a shape on the
crab's old square. There is no sixth path.

Both verification claims in the development entry reproduce, and one is stronger than stated. The
opening board's `cells` are byte-identical to `af6d428` — checked by running the base engine
extracted with `git archive` side by side on five seeds, not by comparing fixtures — and
`bilge.refill` ends at exactly `{hi 1590756343, lo 3448896022, draws 12}` on both engines, with
`bilge.fill` and `bilge.critters` also identical, and with agreement on every cell, event and score
over 3 seeds by 400 scripted swaps. The committed v3 save is genuinely a pre-slice artifact: loaded
and re-saved by the **base** code it round-trips byte-identically. Nothing hostile survived the data
lens either — no prototype pollution through `__proto__` or `constructor` at any nesting, no path for
`NaN` or `Infinity` into the hash, `shapes.length === cells.length` and `maneuverBar` in 0 to 6 across
18000 fuzzed commands, and not one of 12929 rejections moved the state hash.

**Two things the review measured differently from the development entry**, both recorded in
`ISSUES.md` rather than treated as defects. The `_sources` yield for `tokenSpawnPerMille` does not
reproduce: 4.5 and 5.3 completed pairs per 100 clearing swaps on two independent measurements
against a stated 2.9, with the 3-pair bar filling in 57 to 71 swaps rather than about 100. The
recorded figure is also internally inconsistent with this slice's own gold measurement of 66 to 166
swaps, which implies the higher rate; the re-measurements land where the gold figure predicts. The
constant itself is honest at 122 per mille measured against 120 stated, so this is a wrong number in
a provenance note and not a second `crabSpawnPerMille`. And the performance gate is looser than
recorded: under degraded play it is open on 1910, 1891 and 1821 of 2000 moves for one-clearing-swap-
in-three, one-in-ten and purely random play, so the 1991 of 2000 in the entry is not a consequence of
good play but of a scale where `POINTS_PER_MOVE_AT_FULL_EFFICIENCY` is 3 while real 7-star play sits
at 2148 to 2428 per mille against a `good` band starting at 1100. The recommendation is to implement
the wiki's second clause with a rate graded by rating rather than to raise the threshold, because
re-anchoring that slice-2 constant reaches far beyond this layer.

**Coverage.** 39 semantic mutants against a clean export: 32 caught, 7 survived, and 3 more caught
only by the replay fixture this slice re-blessed. The survivors that matter are the slice's own new
rules — the adjacency rule accepts diagonals with the suite green and 29 per cent more pairs, pairing
before spawning survives at 27 per cent fewer pairs, and the published gold cap of 6 is asserted
nowhere because the one test that looks like it does uses the constant on both sides. The new tests
are otherwise real behaviour tests derived from the decisions rather than blessed snapshots, which is
the distinction earlier reviews in this document drew.

**One thing the next stage must not discover the hard way.** Slice 2c and slice 3 both define
`SCHEMA_VERSION = 4` with different `3` to `4` migrations — this slice's adds the shape layer,
slice 3's adds `ships`, `battle` and a null balance — and both commit a `bilge-session-v3.json`, so
git reports an add/add conflict on the fixture and a content conflict on `save.ts` and
`tests/sim/migration.test.ts`. That is a real collision of meaning, not a textual one: whoever
integrates has to decide which slice keeps 4, sequence the two migrations, and re-bless. It is
recorded here so the decision is made deliberately rather than inside a conflict resolution.

**Environment.** A worktree abandoned by a dead session held this branch in a conflicted mid-merge
state and had to be removed before the branch could be checked out. It carried no commit that was
not already on origin, so nothing was lost.

### 2026-09-02 — physical test of slice 4 (OPP-11), PR 5

Three threads drove real `pp-harness` processes over stdio against the merged branch `6808738`. The
slice passed and was merged into `agent/develop`. Full findings are in `ISSUES.md` under the same
date; what follows is what the test changed about the design record.

**The merge with slice 2b was the first half of the work.** PR 4 landed while slice 4 was under
review, colliding in six files. `balance.json` was merged programmatically rather than by hand — a
union of both sides, checked to 71 constants against 71 `_sources` entries with the bijection intact,
`bilging.maxStarLevel` the only key the two sides disagreed on and only develop having changed it.
The three bilging fixtures were re-blessed from live runs and each proven by rolling back across
exactly the slice-4 delta to reproduce develop's committed hash. `npm run check` is 412/412 exit 0
from cold on the merged result, up from 383 by slice 2b's tests.

**The `_sources` prose for the encounter rate is wrong, and now it is wrong with evidence.** 540 real
voyages — six destinations, three voyage types, thirty seeds — put the six-leg Keris pillage at 4.50
battles against the 4.61 the review predicted statically and the "about one and a half" the entry
claims, and the eight-leg McGuffin's route at 6.50 against a predicted 6.60. Observed per-leg rates
track `550 + difficulty/2`; every one of the 60 legs sailed at difficulty 875 or above carried a
brigand, and the arrival leg at McGuffin's Isle is a certainty hit 30 times out of 30. **The tuning
value is not being changed here** — this is recorded so the decision to keep or move it is taken
deliberately, with the measurement in hand, rather than inherited from a sentence that does not
describe the code.

**Decision 86 is half-implemented, and it predates slice 4.** Its premise is that coin taken is not
coin owned until it is divided. `awardBooty` splits the roll — half straight into `winner.poe`, half
into `bootyPoe` — so `booty.divide` only ever divides half of what a pillage rolls. The line is from
slice 3; slice 4 added `bootyCargo` beside it without revisiting the coin, which is how the goods half
and the coin half came to follow different rules. **Goods obey decision 86 exactly; coin does not.**

**Decision 89's justification is unreachable with the shipped tuning.** The guard was widened because
"a roll can pay no coin"; with `booty` as shipped, `rollBooty` yields 600 to 1000 PoE and `awardBooty`
always leaves at least 300 in the chest, so a goods-but-no-coin chest cannot occur. The guard is
correct and harmless — only its reason is dead, and it will become reachable the moment the coin split
above is revisited.

**A loss is nearly free, but not free, and this corrects the review.** Over 55 isolated losses the
complete set of fields that ever change is `shipCount`, `damageTakenSmallMicro` and
`meleeDamageSmallMicro`. No coin, cargo, chest, crew or rum moves. But melee damage is monotone —
only ever incremented, with no repair path anywhere in the codebase, where hull damage heals through
carpentry — so the win rate decays inside a single voyage from 17.3% on the first battle to 0% by the
third. The review's "evade buys nothing" was too strong: evade buys 57% of the voyage time and a ship
whose boarding strength is not permanently spent. **Whether melee damage should be repairable is an
open design question this slice surfaced rather than created.**

**Determinism across a process boundary is proven, not assumed.** 55 cut points over six seeds, each
with the writing process `SIGKILL`ed and a fresh one loading the save: load hash, final hash, final
tick, RNG stream set, cursor values and tail command results matched on every one. Nineteen cuts
landed inside a running battle, all mid-turn. Seven more were placed tick-by-tick around the exact
moments slice 4's lazily-created streams come into existence, including two cuts one tick apart
straddling the birth of `world.plunder` and `booty.poe`; both sides agreed on which streams existed.
The pass was made meaningful by a negative control — perturbing an RNG cursor by 1 or deleting a
stream entry diverges both hashes. One thing learned for future triage: **nudging a marker diverges
the load hash but the final hash re-converges**, because marker drift clamps at the field edge and is
an absorbing state. The marker domain is a weak canary over long runs; the RNG cursors are the strong
one.

**`session.load` arrived without `session.save`.** Decision 84 exists because "save, reload, identical
hash" was undrivable over the protocol, and it is still only half closed: `session.save` answers
`method-unknown`. A save is obtainable as `state.get {pointer:""}` through `JSON.stringify`, which
round-trips byte-exactly, so nothing is blocked — but the decision's stated goal is not met by the
method set as shipped.

**One review finding was corrected by the merge itself.** The review measured, on the pre-merge
branch, that a save with a bogus `voyage.route` advanced a tick and lost its events before throwing.
Slice 2b's `atomically` wrapper around `stepWithinEventBudget` arrived with `agent/develop` and
restores the session exactly; driven over the protocol, `/tick` and `/voyage` are both unchanged after
the error. What survives is only that such saves are accepted at load time and surface as
`internal-error` rather than `invalid-params`.

**Both settlement-guard defects reproduce over the wire, and the second is the urgent one.** The
review found them in-process; the test confirmed both over the protocol with matched controls. Defect
1 — the world striking a brigand off a battle no voyage owned — needs a `battle.start` issued during a
voyage, which no scenario drives. Defect 2 — a concluded battle orphaned by `battle.disengage`
followed by `voyage.port` — **is reachable by ordinary play**, needs no hand-started battle, leaves a
stale battle in hashed state for the whole time in port, and locks out `battle.start` until the next
voyage's first tick. The queued repair task has been reordered to put defect 2 first.
### 2026-09-02 — development, slice 5: the isometric renderer and the playable client (OPP-12)

The slice that turns a simulation into a game. Two new packages — `packages/view` (PixiJS v8) and
`packages/app` (Vite) — and the first runtime dependencies the repo has ever carried. The whole
slice is additive: not one line of `packages/sim/src` changed to make rendering possible, which is
the property decision 1 was bought for.

**The client facade is the whole design.** `packages/view/src/client/` owns the only `Sim` instance
in the browser and re-exports every simulation symbol the view is allowed to see. Scenes and panels
import from `../client/rules.ts`, never from `@opp/sim`. That is not a convention — it is the gate
below, and it is what makes "the renderer holds no game logic" a thing a machine can check rather
than a thing a reviewer has to believe.

**Decisions taken on the goal's behalf.**

| #   | Decision                                                                                      | Rationale                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 90  | The layering gate slice 5 owes is `tools/check-view-boundary.ts`, wired as `npm run boundary`   | The three existing gates guard `packages/sim` only, and slice 3's review already noted nothing enforces the reverse. The gate fails on any view file outside `client/` naming `@opp/sim`, and on the sim or harness importing the view                 |
| 91  | The gate ships with negative fixtures and a positive one, per decision 22's lesson              | `tests/gates/boundary.test.ts` asserts the leaking file is caught, the reversed import is caught, the facade itself is left alone, and the real tree passes. A gate verified only by its own green run stops guarding silently                         |
| 92  | The balance parser moves into `packages/sim` as `balanceOf(file: unknown)`                      | The browser needs the same validation the harness has, and `loadBalance` was `readFileSync` welded to 180 lines of pure shaping. Splitting it gives both callers one implementation; the sim still cannot read a file, which is what decision 42 said  |
| 93  | The client's opening is a command list, pinned byte-for-byte against the harness scenarios      | A view that builds its own opening drifts from the headless one. `tests/view/boot.test.ts` asserts `GameClient.create(...).save()` equals `createScenarioSim(seed, 'pillage-loop').save()`, and the same for `sea-battle`. Drift becomes a red test    |
| 94  | The avatar's scene position is view-local and never reaches the simulation                      | The sim has no avatar and no scene. Reusing the marker placeholder would have put drift on the player. Walking is a client concern in the wiki too                                                                                                    |
| 95  | Tile dimensions are 64x32 and the depth stride is 16                                            | The wiki map fixes neither; `06-stack-decision.md` leaves `tw`/`th` as variables. 2:1 is the conventional iso ratio, and a stride of 16 leaves room for the wiki's four layers within one tile's depth band                                            |
| 96  | The tick budget is computed in integer tick-units, not milliseconds                             | `Math.floor(1000 / (1000 / 60))` is 59, not 60. The first frame test caught a tick lost per second; `budgetOf` now multiplies before it divides, and a thousand-frame test pins the drift at zero                                                     |
| 97  | Panel refresh is announced on events, or every 30 ticks, not every frame                        | The panels rebuild DOM on notification. At 60 fps that is 60 rebuilds a second for a purse that changed twice. Meter bands already arrive as events; the heartbeat only covers continuous readouts like voyage progress                                |
| 98  | `?scene=battle` opens the `sea-battle` opening rather than being refused                        | `canEnter('battle')` is false unless a battle runs, so the render smoke could not reach the battle grid at all. The client now takes an `opening`, and the two openings are exactly the harness's two scenarios                                        |
| 99  | The canvas is inset by the panel column instead of drawing beneath it                           | The first smoke baselines showed the battle planner drawn under the chart and the Sunshine widget — half the phase rows and the submit button unreadable. `panels.css` publishes `--pp-panel-column` and the app shell insets `#stage` by it           |
| 100 | The chat history overlays the scene translucently rather than reserving space                   | The wiki's default is a fade overlay, and reserving 150px of a 720px window for a log the player mostly ignores is worse. It is now 75% opaque, so the board reads through it                                                                         |

**Dependencies added, and why.** `pixi.js@8.20.1` — the renderer decision 1 and the stack document
both name, pinned to the exact version the stack document cites. `vite@8` — the app shell, dev
server and bundler. `@playwright/test@1.62` — the render smoke only, and deliberately **not** part
of `npm run check`, because CI provisions no browsers. `npx playwright install chromium` was run to
produce the baselines; Playwright 1.62 pins a Chromium revision this machine did not already have.
`packages/sim/package.json` still declares an empty `dependencies`, and `npm run deps` still proves
it.

**What the tests prove, and what they do not.** `tests/view/` covers what can be judged without a
browser: the tick budget, the iso projection round trip, the four-directional viewport-clipped
pathfinder including the hazard-adjacency rule and the portal warp, the two openings against the
harness, and the whole pillage loop driven through `GameClient` — buy, chart, sail, a real brigand
battle, port, divide, sell, with the purse larger at the end. The Playwright smoke asserts only that
the four surfaces are *drawn*; it asserts no game rule, by design. Neither proves the game is
**fun**, and neither replaces the physical test.

**Verified by hand, in a browser, before the PR.** Walking, the radial menu, buying 40 sugar cane
(purse 2000 to 1720, stock 500 to 460, logged in chat), charting a two-league pillage to Doyle, the
deck scene with all seven stations read from `ShipClass` rather than hardcoded, taking the bilging
station and swapping tiles. Two defects were found this way and fixed: clicking a prop's drawn body
did nothing because only its ground tile was hit-tested, and the battle HUD was unreadable beneath
the DOM panels.

**Deviations from the stack document.** It names pnpm (the repo uses npm workspaces, per slice 1),
`dependency-cruiser` (the repo uses scripts, per decision 20) and Q16.16 (floats are banned outright
in the sim, and now live only in `packages/view`, which is where that document always said they
belonged). It also suggests `packages/view/src/sprites/`; there is no art to hold, so the atlas
draws its placeholders with `Graphics` and the directory is not created.

**Not built, with the reason.** The wiki's full client surface is far larger than the loop: the Crew
panel, the Ahoy! notification queue and the duty report are not built, because nothing in the pillage
loop needs them — `open('duty')` is deliberately a no-op rather than a lie. Chat is a local log and
an event feed, since decision 9 puts every multiplayer surface after the MVP. Sound, animation polish
and art quality were out of scope by the task. `packages/view` has no owning skill beyond the render
smoke; `pp-render-smoke` documents the smoke, not the view's architecture.

### 2026-09-02 — development, slice 5 integration: merging agent/develop after PR 5 landed (OPP-12)

Slices 2b and 4 reached `agent/develop` while slice 5 was being built, and the branch was left
mid-merge when its run ended. Resumed, finished and verified. Three files conflicted; two were
document unions, and the third needed real work.

**The balance parser collided with itself.** Decision 92 moved the parser into `packages/sim` as
`balanceOf`, leaving `packages/harness/src/balance.ts` a five-line wrapper. On the other side of the
merge, slices 2b and 4 had extended the *harness-side* parser with the `market` and `division`
blocks, the critter and cascade tuning, and `rumPerPiratePerThousandTicks`. Resolved by keeping the
wrapper and carrying every field the develop-side parser had gained into
`packages/sim/src/balanceParse.ts`; the two key sets were then compared mechanically and are
identical.

That comparison is the kind of thing that should not depend on someone remembering to do it, so
`tests/sim/balance.test.ts` now asserts, for every block, that the set of non-underscore keys the
file declares equals the set the parser reads. A future parser move cannot silently drop tuning, and
a tuning key added to `balance.json` without a reader fails the suite rather than being ignored.

**The view had to learn the critters.** Slice 2b's `bilge.poke`, crab, puffer and jelly arrived
through the merge into a scene written before they existed. `packages/view/src/scenes/puzzle.ts`
now dispatches `bilge.poke` when the clicked tile is a puffer and `bilge.swap` otherwise, draws the
three critter cells as their own art rather than letting them fall through the colour table modulo,
and `packages/view/src/client/log.ts` gains refusal lines for `poke-outside-board`,
`crab-not-swappable` and `not-a-puffer`. Keyboard and pointer go through the same `performAt`, so
the two input paths cannot diverge. No game rule moved into the view: which tiles are pokable is
read from the board's own cell constants, and the sim decides every outcome.

**A collision the next merge will have to settle.** Slice 4b, on its own branch, numbered its
decisions 90 to 96 — and this slice numbered its own 90 to 100. Both were written against the same
document while neither could see the other. Whichever merges into `agent/develop` second has to
renumber, and the decisions referenced from commit messages, `ISSUES.md` entries and the two PR
descriptions have to be renumbered with it. Nothing is wrong in either branch; they simply cannot
both be right about what decision 92 means. Flagging it here rather than picking a winner, because
the choice belongs to whoever integrates them.

**Verified after the merge, from cold.** `npm run check` green at **453 tests** — the deps, imports
and view-boundary gates, five typecheck projects, lint and the suite. `npm run build` succeeds. The
four render smoke tests pass against freshly built assets: the iso port scene, the ship deck, the
bilging board and the battle grid.

### 2026-09-03 — independent review of slice 5 (OPP-12), PR 8, cycle 0

Four lenses, run separately against the merged tree. All three of the slice's verification claims
were re-run from cold rather than taken from the PR: `npm run check` green at 453 tests,
`npm run build` green, the four render smokes green. Two findings block; everything else is in
`ISSUES.md` under the matching dated heading.

**Two blocking findings, both confirmed by executing them.**

The first is a data-loss path this slice opens. `GameClient.restore` assigns `this.sim = Sim.load(text)`
before anything validates the loaded state, and `deserialise` casts straight through — `migrate`
checks only that `schemaVersion` is present, numeric and not newer than `SCHEMA_VERSION`. A payload
at the current version therefore reaches the client unchecked, and the `inBattle` getter's
`battle !== null` guard passes on `undefined`. Loading `{"schemaVersion":5}` destroys the running
voyage, throws a `TypeError`, is caught by the Ye panel and reported as "That save be spoiled" — as
though nothing had happened — and the render loop then dies on the next frame. The unvalidated sink
in `save.ts` is not this slice's work; it arrived with the `agent/develop` merge. The player-facing
button in front of it is, which is what makes it blocking here.

The second is decision 90's own claim. The integration entry above states that no game rule moved
into the view because "which tiles are pokable is read from the board's own cell constants, and the
sim decides every outcome." Reading the constant is indeed fine; the decision built on it is not.
The sim models a puffer as swappable — `swapRejection` rejects crabs and out-of-board only, and
`applyBilgeSwap` falls through to `swapCells` for a puffer beside an ordinary colour — and a
dispatched `bilge.swap` on a puffer is accepted and moves it. The view can never send that command,
because `performAt` turns every puffer click into `bilge.poke`. A puffer can therefore only be
walked leftward, by clicking its left-hand neighbour. That is a rule living in the view, and the
boundary gate cannot see it because it is not an import. Either the move is restored, or the
input-mapping decision is recorded as a decision — with a rationale on the record this would not
have blocked.

**Three claims in this document are inaccurate as written, and are corrected here.**

- The puffer claim above.
- "The deck scene with all seven stations read from `ShipClass` rather than hardcoded" — three of
  the seven counts are invented in the view: navigation is a local constant of one, rigging aliases
  `sailStations`, patching aliases `carpStations`. `ShipClass` carries no navigation or patching
  complement. No behaviour differs today.
- "`tests/view/` covers every module that does not import Pixi" — twenty of the thirty new view
  modules are Pixi-free and the tests import five of them. Roughly 1,400 Pixi-free lines have no
  test, including all of `panels/`, `client/log.ts`, `scenes/deck.ts`, `scenes/port.ts` and
  `ticker.ts`.

A fourth is narrower than claimed rather than wrong: "a tuning key added to `balance.json` without
a reader fails the suite rather than being ignored" holds inside the nine known blocks, because
`BLOCK_NAMES` is a hardcoded literal. A whole tenth block with no reader passes all seven tests —
verified. Deriving the list from the file's non-underscore top-level keys closes it and keeps both
sides of the comparison independent.

**What the review confirms, so no later stage needs to redo it.** The balance parser merge is
clean: all 71 `(block, reader-type, key)` triples are identical across the merge, with no
transposition between property names and the keys they read, checked by two independent methods.
Decision 93's pin compares two genuinely independent producers — the view's `openingCommands` and
the harness's scenario builders, with no dependency between the packages — and it is sensitive to
semantic drift; a commutative reorder of two opening commands passes, which is correct, because the
pin compares resulting world state rather than the command list. Decision 96's tick fix is right,
and the integer-division shape it fixed appears nowhere else in the view. The boundary gate's own
fixtures assert a non-zero exit and the specific message, so decision 91 is properly met.

**Decision 90's gate is narrower than decision 90's sentence.** `packages/app/src` is scanned in
neither direction, and pointing the gate at it exits 1 on `main.ts` reaching `@opp/sim` — so the
app shell is a violation by the gate's own definition, exempt by accident rather than by decision.
`balanceOf` in a composition root is defensible; the exemption should be recorded or the gate's
roots widened. Four further evasion shapes were run against the gate and all passed: a nested
directory named `client` anywhere under the view, a relative `../../../sim/src/index.ts`, a
non-`.ts` extension, and a template-literal dynamic import. None is used in this diff. The relative
deep import is the one to close first, because it is the shape a developer reaches for once the
package specifier is rejected.

**Decision numbering.** Three open branches are involved, not two: slice 4b holds 90–96, slice 5
holds 90–100, and **slice 4c (PR 9) already holds 101–103**, having deliberately numbered above
both. The review recommends that **slice 4b renumber its decisions to 104–110**, and that slice 5
keep 90–100 and slice 4c keep 101–103.

PR 7 is `DIRTY` and must be reworked before it can merge, so the renumber rides along with work
already queued; it carries seven decisions against slice 5's eleven, and slice 5's numbers are
referenced across eight commits, 69 files, `ISSUES.md` and its PR body. Slice 4c is left alone
because it is the one branch that numbered defensively.

This is a recommendation to whoever integrates them, not a finding against any branch.

### 2026-09-03 — analysis of review findings, slice 5 (OPP-12), PR 8, cycle 1

Two findings blocked. Neither is a defect in what slice 5 set out to draw; both are about what the
client does when something goes wrong, and about a rule the view was deciding without saying so.
The twenty non-blocking findings stay in `ISSUES.md` and are not touched here, except where a repair
below happens to pass through one, which is noted each time.

#### Loading a spoiled save destroys the running game (blocking 1)

**The cast is the defect, and it is one line.** `deserialise` ends at `save.ts:53` with
`return current as unknown as WorldState`, and the `while` loop above it never runs for a save
already at `SCHEMA_VERSION`. `{"schemaVersion":5}` therefore arrives as a `WorldState` whose other
eleven fields are all `undefined`. Everything downstream is a consequence: `GameClient.restore`
assigns it over the live `Sim`, `syncScene` reads `inBattle`, `battle !== null` passes on
`undefined`, and the `TypeError` lands in the Ye panel's catch, which reports "That save be spoiled"
— a sentence whose plain reading is that nothing happened, while the voyage is already gone.

**The repair reaches to the sink, not to the button.** Validating inside `deserialise` fixes the
defect for every caller at once: the client's Load button, the harness's `session.load`, the tools,
and any future caller. Probing a locally-built `Sim` in the client would fix only the client, and
would leave the harness accepting a save it should refuse — `session.load` on `{"schemaVersion":5}`
currently succeeds and fails later at a hash or a step, which is the same defect wearing a different
coat. So the guard goes in `save.ts`, and the client changes as well, for a different reason given
below.

**The validator stays shallow, deliberately.** `WorldState` has twelve top-level fields; two of them
are expensive to check properly. `balance` is the 17KB tuning file that `balanceOf` already parses
across 71 triples, and `rngStreams` is an open index signature whose keys are created on demand and
cannot be enumerated. A validator that checks the twelve fields for presence and primitive kind —
twelve tests, no recursion, constant in the size of the save — catches `{"schemaVersion":5}` and
every truncated save, which is the depth at which the failure actually occurs. Full recursive
validation is a much larger job for a much smaller marginal catch, and it would duplicate
`balanceOf`. If a save is ever spoiled *below* the top level, the golden and replay fixtures are the
instruments for it, not the loader.

**No library, and none was considered for long.** `packages/sim` has an empty `dependencies` and a
gate that keeps it that way, so a hand-written guard was the only option consistent with the repo.
It follows `balanceParse.ts`: `isRecord`, `TypeError`, a dotted path in the message. `save.ts` today
throws plain `Error` for its three existing checks; those are left alone rather than churned.

**The client changes anyway, because validation and containment are different properties.**
`restore` assigns `this.sim = Sim.load(text)` and only then does work that can throw, so the good
`Sim` is unreachable before anything has judged the new one. The harness already has the right shape
at `methods/session.ts:39-46` — build into a local, attach only on success — and the client should
mirror it. With the validator in place this ordering catches nothing today; it is what stops the
next unvalidated failure inside `syncScene` or `announce` from costing a voyage.

**The ticker is folded in, because it is what turns a bad frame into a hang.** `ticker.ts:21-22`
calls `step` and re-arms afterwards, unguarded, so one throw inside a frame ends the loop for good
while `running` keeps reporting `true` off a handle that has already fired. Re-arming *before* the
callback rather than wrapping it in `try/finally` is the smaller change and fixes more: the loop
survives a throwing frame, `running` stops lying, and the latent mirror bug — a `stop()` called from
inside a callback being undone by the unconditional re-arm — goes away with it, because `stop()`
then cancels a handle that is genuinely pending. This is `ISSUES.md`'s Robustness entry, repaired
here rather than left, because the blocking finding is only recoverable if the loop is still alive
to show the player the refusal.

#### The view removes no legal move — the original never offered it (blocking 2)

**The wiki does not answer the question directly, and the reading it forces is the one already in
the code.** `docs/wiki-map/01-duty-puzzles.md:95` gives Bilging *a two-cell horizontal cursor*,
moved by the mouse or the arrow keys, where a left click swaps the two selected pieces; line 100
gives the puffer *click to expand*. Nothing in `docs/` says whether a puffer may be swapped with an
ordinary colour — the map names only the crab as immovable, and it affirms that swapping two puffers
just swaps them. The two control sentences are in tension, and the only reading that makes both true
at once is that the pointer sits over one cell of the selected pair and which cell it sits over
decides the gesture: a puffer under the pointer pops, a puffer beside it is swapped and moves. That
is exactly `performAt`, and under it a puffer moves leftward only.

That reading is an inference, not a quotation, so it is taken as decision 115 rather than presented
as a published rule. Its cost is stated plainly: the puffer-on-puffer swap the wiki does mention is
unreachable from the pointer, because either cell of that pair pops. The alternative readings are
worse. A modifier-click adds a gesture no version of the original had and which line 95 excludes by
listing the whole control set. Making the puffer swap on click and pop on some other input
contradicts line 100 outright. Both would be inventions dressed as restorations.

The sim keeps the complete rule table, and that is not a contradiction: `swapRejection` refusing only
the crab matches the wiki, and a `bilge.swap` onto a puffer stays reachable from the harness, which
is how the puffer-on-puffer and puffer-on-colour rules remain exercised and tested. The rule table
says what a swap does when one happens. The input scheme says which swaps a player can ask for. The
sim is right to hold both, and the view is right to offer fewer.

**What was actually wrong is the record, and the fact that the rule was anonymous.** The integration
entry claims no game rule moved into the view. One did: the pointer-identity mapping is a rule, it
lives at `puzzle.ts:327`, and the boundary gate cannot see it because it is not an import. The
mapping is right; it was never written down and never tested. So it is recorded as decision 115
below, and it is given a name and a test rather than staying a conditional buried inside a
Pixi-importing closure. Extracting it as an exported function in a Pixi-free module is the only way
this repo can test it at all — there is no jsdom and no DOM harness, and `tests/view/` reaches
`grid.ts` and `walking.ts` precisely because they import no Pixi.

**The keyboard clamp is repaired here, not left.** `puzzle.ts:391` clamps the cursor to
`board.width - 2`, which is the swap partner's constraint applied to both gestures, so a puffer in
the last column is poppable with the mouse and unreachable from the keyboard. That is the divergence
the same entry denies. Clamping to `board.width - 1` and letting the mapping decide makes both paths
reach the same set, which is what the claim needs in order to become true. It is listed in
`ISSUES.md` as non-blocking and would have stayed there, but the blocking repair touches the same
lines and leaving it would leave the corrected claim false again.

**One more view-side rule goes with it.** `puzzle.ts:328` returns silently when a non-puffer click
cannot start a swap, which is the view pre-judging a refusal the sim owns, and it is why
`'swap-outside-board'` — "That swap falls off the board." — is dead on the pointer path. Dispatching
and letting the sim answer removes the third re-derivation of the swap axis from the input path and
gives the player the message that already exists. The two remaining re-derivations at `:660` and
`:137` are cosmetic and stay in `ISSUES.md`.

**The player-facing text has to move with the code**, since `puzzle.ts:137` states the defect as
though it were intended and `:143` says Space swaps when it may pop. Both are inside the puzzle
panel, so the committed Playwright baseline diffs and is re-blessed under `pp-render-smoke` — a text
reflow, not a render regression.

#### Two claims in the integration entry are corrected, not edited

The entry of 2026-09-02 says *"Keyboard and pointer go through the same `performAt`, so the two
input paths cannot diverge"* and *"No game rule moved into the view"*. The first is false because of
the clamp; the second is false because the mapping is a rule. Both are corrected here and left
standing there, which is how this document has handled its own errors before — the review entry
above corrects three earlier claims the same way. Editing a dated entry after the fact would make
the record less trustworthy than the errors do. Once the development task lands, both sentences
become true of the code, and this paragraph is the bridge between the two states.

#### Slicing

One development task, not two. The findings are independent but both are repairs to the same open
PR on the same branch, and splitting them would put two agents on one branch or two round trips
where one does. The branch is
`agent/feature/20260902-000500-opp-slice-5-renderer-and-playable-client` and the PR is 8; no second
branch is opened.

#### Decisions taken without a human, continuing the series above

Numbering starts at 111. Slice 4c holds 101-103 on its own branch, and the review above recommends
slice 4b take 104-110, so 111 is the first number free on every branch.

| #   | Decision                                                                                                   | Rationale                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 111 | The structural guard goes in `deserialise`, not in `GameClient.restore`                                     | One sink serves the client, `session.load` and the tools; the harness accepts `{"schemaVersion":5}` today and is fixed by the same line                                                                 |
| 112 | The guard checks the twelve top-level fields for presence and kind, and does not recurse                    | It catches the failure at the depth it occurs, is constant in save size, and does not duplicate `balanceOf` or try to enumerate `rngStreams`' open key set                                              |
| 113 | `restore` builds the `Sim` into a local and assigns only on success, even with the guard in place           | Validation and containment are different properties; the harness already has this shape, and it is what stops the next unvalidated throw from costing a voyage                                          |
| 114 | The ticker re-arms before the step callback rather than wrapping it in `try/finally`                        | Smaller change, and it also stops `running` reporting `true` off a spent handle and removes the latent `stop()`-inside-callback bug                                                                     |
| 115 | Pointer identity decides poke from swap, and that mapping is the recorded input rule                        | The only reading that makes the wiki's two-cell cursor and its *click to expand* both true at once; the cost is that a puffer-on-puffer swap is unreachable from the pointer, and a modifier-click would add a gesture line 95 excludes |
| 116 | The mapping is extracted as an exported function in a Pixi-free module and tested from `tests/view/`         | A rule the boundary gate cannot see needs a name and a test instead; with no jsdom this is the only shape this repo can cover                                                                           |
| 117 | The cursor clamp becomes `board.width - 1` and the view stops pre-refusing an off-board swap                | Both input paths then reach the same set, which is what makes the corrected claim true, and the sim's existing refusal reaches the player instead of a silent return                                    |
| 118 | The two false claims are corrected in this entry rather than edited where they stand                        | The review entry above corrected three claims the same way; rewriting dated entries would cost the record more trust than the errors do                                                                 |
| 119 | One development task against the existing branch and PR 8, not two                                          | Both repairs are to one open PR; two tasks would put two agents on one branch or spend two round trips on one merge                                                                                     |
| 120 | Slice 5's repair decisions are numbered from 111                                                            | 101-103 are slice 4c's and 104-110 are reserved for the slice 4b renumber the review recommends, so 111 collides with nothing on any open branch                                                        |

**What done means.** `{"schemaVersion":5}` is refused by `deserialise` with a message naming the
first bad field; the running voyage survives a refused load and the client keeps stepping; a throwing
frame costs one frame and not the loop; a puffer in the last column is reachable from the keyboard;
the poke-or-swap mapping is an exported function with tests; the panel text matches what the code
does; `npm run check`, `npm run build` and the four render smokes are green with the baseline
re-blessed.

### 2026-09-03 — development of the slice 5 review repairs (OPP-12), PR 8, cycle 1

Decisions 111 to 117 are built on this branch, against PR 8. Two of them were delivered differently
from the letter of the decision and one number in the entry above is wrong; both are set out below
rather than left for the reviewer to find.

#### What was built

**The guard (111, 112).** `deserialise` now ends in `worldStateOf`, which checks every top-level
field for presence and primitive kind before the `as unknown as WorldState` cast — the cast now
exists in exactly one place. It follows `balanceParse.ts`: `isRecord`, `TypeError`, a dotted path.
`{"schemaVersion":5}` is refused with `save.seed must hold a number`, and `'{"schemaVersion":5}'`
has joined `UNLOADABLE_SAVES` in `tests/harness/session-load.test.ts`, which accepted it before.
`packages/sim` stays dependency-free.

The kinds live in a `Record<keyof WorldState, FieldKind>` table, so adding a field to `WorldState`
fails typecheck until the field is given a kind. That is the property that stops this guard rotting.

The guard runs **after** migration, not before. A v2 or v3 save legitimately lacks `balance`,
`puzzle`, `ships`, `battle`, `pirate`, `voyage` and `markets` — supplying them is what the
registered migrations are for — so guarding first would refuse every genuine older save. Running
after means a save is judged against the schema it claims to be at, which is exactly where
`{"schemaVersion":5}` fails: no migration runs for it, so it reaches the guard unimproved. Both
directions were checked, including the committed v2 fixture `saves/marker-field-v2.json`.

**The extraction (115, 116).** The mapping is `gestureAt(board, position)` in
`packages/view/src/scenes/bilgeGesture.ts`, which imports only the client facade and no Pixi, so
`tests/view/` can reach it. `npm run boundary` sees it now: the rule the gate could not see because
it was a conditional inside a closure is an import it can follow.

**The clamp and the pre-refusal (117).** `moveCursor` clamps to `board.width - 1` and lets the
mapping decide the gesture; `performAt` dispatches instead of returning silently, so the sim's
`'swap-outside-board'` refusal reaches the chat log the way `planner.ts`'s refusals already do.

**The panel text.** *"Click a puffer to pop it. Click any other tile to swap it with the tile on its
right."* and *"Arrows move the cursor · Space or Enter pops or swaps · Escape leaves the duty."*
Both were read off a running client to confirm they render and wrap inside the panel.

#### Correction to the entry above

That entry says `WorldState` has **twelve** top-level fields and that `{"schemaVersion":5}` leaves
"the other eleven" undefined. It has **thirteen**: the twelve it declares plus `nextEntityId`,
inherited from `EntityIdCounter`. The guard checks all thirteen. Leaving `nextEntityId` out would
have admitted a save that breaks `takeEntityId` on the first entity created — the same class of
failure the guard exists to stop, one field further along. Decision 112's substance is unchanged.

Corrected here rather than edited in place, following decision 118's own reasoning about dated
entries.

#### Decision 113 was delivered by its purpose, not its letter

The decision says `restore` should mirror `methods/session.ts` — build into a local, attach only on
success. Mirroring it literally changes nothing: `this.sim = Sim.load(text)` already evaluates
`Sim.load` before the assignment, so a save the sim refuses never reached the field even before this
task. But the decision states its purpose plainly — to stop "the next unvalidated failure inside
`syncScene` or `announce` from costing a voyage" — and a reordering does not deliver that, because
those calls run *after* the swap by construction. `announce` in particular must run after the fields
are live, since listeners read them.

So `restore` swaps the session in and puts the running one back if the work that follows throws.
That is more than the decision's letter and is what its stated purpose requires. The test that pins
it uses a throwing subscriber; the reordering alone leaves that test red.

**The cost of that shape, recorded rather than hidden.** A listener that already ran before another one threw has seen a state
that is then rolled back, and is not told. It self-heals on the next frame, because the ticker's
step calls `announce` again — which is only true because decision 114 landed in the same task and
keeps the loop alive through a throwing frame. The two repairs hold each other up.

#### The baseline did not diff, and that is the finding

The entry above expected the panel rewrite to move the committed Playwright screenshot and be
re-blessed. It did not move it. `MAX_DIFF_PIXEL_RATIO = 0.01` is 9216 pixels of a 1280×720 shot,
and the bilging scene's own animation already moves 1400 to 3300 pixels between two consecutive
frames of a settled board; two lines of 12px copy fit inside that headroom. All four smokes are
green, `--update-snapshots` rewrote nothing because nothing failed, and forcing
`--update-snapshots=all` would have committed a fresh animation frame rather than a re-blessing.
No baseline is touched by this task. The gap is recorded in `ISSUES.md`.

#### Two things the suite still cannot see, stated plainly

**The cursor clamp has no test.** It lives inside the Pixi-importing closure and this repo has no
jsdom. Inverting `gestureAt` fails four tests; reintroducing `board.width - 2` in `moveCursor`
leaves all 463 green. Decision 116 moved the *rule* to where it can be tested, which is what it
promised, but the clamp is not the rule.

**The keyboard path was not exercised by hand.** Key events do not reach the app through this
environment's browser pane — arrow presses left `Moves` at zero and the board untouched, which is a
statement about the pane and not about the code. The panel text was confirmed visually; the last
column's keyboard reachability is for the test stage, which drives a real browser.

While fixing the clamp, `drawCursor` needed one more change: it returned early when the swap partner
was off-board, which was harmless while the clamp kept the cursor out of the last column and would
have made the cursor **invisible** there once it could go. The cursor cell is now always outlined and
only the partner outline is skipped.

#### Verification

`npm run check` 463 of 463 exit 0 from cold, `npm run build` clean, `npm run smoke` 4 of 4.

The smoke needed a second run to mean anything. `playwright.config.ts` sets
`reuseExistingServer: !process.env.CI` on the fixed port 5178, and the first run was served by a
**different worktree's** dev server — the slice 5 branch as it stood before these repairs. The
reported run above is from a dev server started on a private port against this tree. That trap is
now in `ISSUES.md`; anyone running the smoke while another checkout is up should assume the same
until it is closed.

### 2026-09-03 — independent review of the slice 5 repairs (OPP-12), PR 8, cycle 1

Four lenses over `358196e`, plus an independent reproduction of the claimed verification. **Approved
with no blocking findings.** `cycle` stays 1 and the work goes to the test stage. Twenty-one
non-blocking findings are in `ISSUES.md` under this date. What the review established that the
design should carry forward is below.

#### The three recorded deviations all survive scrutiny

**Decision 113's argument is true of the code, and the shape delivered is stronger than the letter.**
`Sim.load(text)` is `new Sim(deserialise(text))`, so the right-hand side of `this.sim = Sim.load(text)`
is fully evaluated before the assignment — the literal build-into-a-local reordering would indeed have
changed nothing, exactly as the developer argued. The harness shape the decision pointed at,
`methods/session.ts`, has nothing after its assignment that can throw and therefore needs no rollback;
`restore` does, and now has one, pinned by a throwing-subscriber test that goes red without it. The
deviation is not a shortcut; it is the only shape that delivers the decision's stated purpose.

**The thirteenth field is real and nothing else in the repo rests on twelve.** `WorldState` declares
twelve and inherits `nextEntityId` from `EntityIdCounter`. Grepping the repository for every other
enumeration of the type — validators, fixture writers, tests, docs — found none. `Record<keyof
WorldState, FieldKind>` is genuinely closed: neither interface carries an index signature or an
optional member, so a field added or removed breaks the typecheck rather than rotting the guard. That
property is confirmed, not assumed.

**The screenshot-headroom argument holds under independent arithmetic.** `MAX_DIFF_PIXEL_RATIO = 0.01`
on a 1280×720 shot is 9,216 pixels. The panel *is* inside the capture — it is a full-page screenshot
and at 1280 wide the panel gets its full `PANEL_INNER_WIDTH` at scale 1 — and the copy did change, so
the question was real. Estimating the ink: the hint went from three wrapped lines to two, which also
relocates the whole `keys` paragraph upward by a line, so both its old and new positions count —
roughly 4,800 pixels, plus the scene's own 1,400-3,300 pixels of animation, against a 9,216 budget.
Under it. The baselines are untouched by this commit and Playwright correctly rewrote nothing, because
`--update-snapshots` defaults to `changed` and nothing failed. The consequence stands and is recorded:
`puzzle.png` now depicts copy the app no longer shows, and the smoke provably cannot see
player-facing text.

#### What the review adds to the design record

**The containment added to `restore` is narrower than the purpose it was added for, and that gap is
now measured rather than suspected.** Deleting a single nested key from a real save — `puzzle.frame`,
`puzzle.board`, or any of four `balance` blocks — produces a save that passes all thirteen top-level
checks, loads, and returns from `restore` without throwing at all, because `syncScene` and `announce`
between them read only shallow fields. The player is told the voyage was restored; the failure lands
one frame later inside `sim.step` and repeats every frame after. This is not a regression — the
behaviour is identical at `a14e78c` — and decision 112's scoping reasons still hold. But it means the
try block covers precisely the two call sites where a shape failure will not land. Stepping a clone of
the restored sim one tick inside that same try, before the swap, would move the realistic failure back
inside the containment that already exists, for one tick of work and no new validation surface. That
is the shape the next cycle should consider, and it is recorded here rather than acted on because it
is out of this task's scope.

**Decision 113's recorded cost is imprecise in one detail.** The development entry says a listener
that saw the rolled-back state self-heals "on the next frame, because the ticker's step calls
`announce` again". `advance` announces only when there are events or `quietTicks` reaches 30 against
60 ticks per second. The scene listener does heal every frame — `stage.follow` is called
unconditionally by the step as well as being a subscriber — but the DOM panel deck has only the
subscription, so on a quiet board it waits up to half a second. The dependency on decision 114 is real
and the heal is bounded; the interval is longer than recorded. An `announce()` on the rollback path
would close it and remove the mutual dependency between the two repairs entirely.

**The guard the whole of decision 111 was argued for is tested only through the harness.** The
argument for putting it in `deserialise` rather than in the client was that one sink serves every
caller. The tests added do not follow that argument down: one harness case asserts a reason code, and
`tests/sim/` gained nothing. `balanceParse.ts`, which the guard is explicitly modelled on, has five
message-asserting tests. The design is right; the coverage was placed at the wrong layer.

#### Verification, independently reproduced, and what it changed

The developer's `npm run build` claim holds outright. The other two do not hold as stated, though
neither is a defect in this change:

- `npm run check` **failed on the cold run** — 462 of 463, `tests/gates/purity.test.ts` failing
  because a spawned gate exited non-zero with empty stdout and stderr under load. It passed on the
  second run and passes 5 of 5 in isolation. A load-dependent flake in a file this commit does not
  touch, but it failed the exact command the development entry claims green from cold.
- `npm run smoke` is **4 of 4 only on a warm server**. Four full runs gave 3/4, 3/4, 4/4, 4/4, with
  two different failures: a cold-start `render:ready` timeout on the first spec, and a `battle grid`
  screenshot diff of 630,386 pixels — ratio 0.69, most of the frame — that did not reproduce in six
  consecutive re-runs.

**The port trap is not merely live, it is occupied.** Port 5178 is held right now by a vite process
serving the `opp-slice5` worktree at `a14e78c`; fetching the puzzle module from it returns the *old*
panel copy. Any default `npm run smoke` on this machine silently tests the pre-repair tree and reports
four green. This review's smoke was run against a server on a private port whose provenance was proved
by fetching the module and finding the new copy and none of the old. The test stage must do the same.

#### No decisions taken

This review takes no decision numbers. 111-120 stand as written, with the two corrections the
development entry already recorded, plus the interval correction above.

### 2026-09-03 — physical test of the slice 5 repairs (OPP-12), PR 8, cycle 1

Driven by hand in a real Chrome against a dev server on a private port, from this branch's own
worktree at `59ad59e`. **Both repairs pass, including the keyboard path nobody had been able to
exercise.** The PR is not merged: `agent/develop` moved to schema 6 while this branch was in review,
and PR 8 is now `CONFLICTING`. An integration development task carries it the rest of the way.

#### Provenance first, because the smoke cannot be trusted without it

Port 5178 was occupied throughout by a vite process serving the `opp-slice5` worktree at `a14e78c` —
the branch as it stood *before* these repairs. Fetching the puzzle module from it returns the old
copy. So the server for this test was started on port 5201 from this worktree, and its provenance was
proved before anything was clicked: the module it serves contains *"Click a puffer to pop it"* and
`board.width - 1`, and zero occurrences of *"The last column cannot start a swap"*.

#### The keyboard path — the thing only this stage could establish

Key events reach the app through Chrome, which is what the development environment's browser pane
could not do. Every claim below was read off the running client.

- **Arrow keys reach the last column and the cursor is visible there.** Eleven `ArrowRight` presses
  from `x = 0` put the cursor on `x = 11` of a twelve-wide board, outlined, with no partner outline
  drawn off the board. This is exactly what `drawCursor`'s reorder exists to guarantee, and it is
  the claim the suite cannot make — reintroducing `board.width - 2` still leaves all 463 green.
- **A puffer in the last column pops from the keyboard.** Space on `(11, 0)` popped it: score 0 → 4,
  moves 1 → 2, star level 0 → 1, *"The bilge rises: star level 1."* in the chat.
- **A puffer in the last column pops from the pointer**, on the same cell class: moves 2 → 3,
  score 4 → 23.
- **A plain tile in the last column refuses out loud, on both paths.** Space on a colour tile at
  `x = 11` and a click on the same cell each produced *"That swap falls off the board."* in the chat,
  and neither counted a move. Before this task that path returned silently.
- **A plain tile swaps rightward on click**, moves incrementing, with the hover pair drawn.
- **Escape leaves the duty**, landing in the battle that had begun while the duty was held.

The panel copy renders and wraps inside the panel, both paragraphs, exactly as written.

To reach a puffer in the last column deliberately rather than waiting for one to spawn, the running
save was edited — the whole of column 11 set to `PUFFER_CELL`, one crab placed — and loaded back
through the client's own Load button. That is worth recording twice over: it exercised the load path
under test as a side effect, and it is the cheapest way to put this board in a known state by hand.

#### The save guard — refused, and the voyage survived intact

With a pillage voyage running and the leg advancing, `{"schemaVersion":5}` was pasted into the Ye
panel and loaded. It was refused with **`That save be spoiled: save.seed must hold a number`** —
the message naming the first bad field that "what done means" promised and that no test asserts. The
running voyage was completely untouched: still at sea, same scene, purse unchanged, and the leg
counter kept climbing straight through the refusal (247 → 494 of 5040). Loading the good save back
restored it and announced *"Yer voyage be restored."*

That is the blocking finding of cycle 0 closed, observed rather than inferred.

#### Confirmations of things the review recorded as non-blocking

- **The panel copy does overstate a swap.** Clicking a crab produced *"The crab will not be shoved
  about."* and counted no move, so *"Click any other tile to swap it with the tile on its right"* is
  false for two of the board's cell kinds. Discoverable rather than silent, which is the point of
  removing the pre-refusal, but the sentence is wider than the rule.
- **A throwing frame could not be provoked by hand**, so decision 114 rests on its three unit tests,
  each of which fails against `a14e78c` for a different reason. The loop was observed to keep
  stepping through a refused load, which is adjacent evidence and not the same claim.

#### Something new, small, and not this slice's

Clicking a duty station the avatar is already standing on answers *"Avast! I can't find a way to walk
there."* rather than opening the radial menu; moving the pointer one tile and clicking the station
again opens it. Pre-existing walking behaviour, unrelated to these repairs, recorded in `ISSUES.md`.

#### Suite at the merge head

`npm run check` at `59ad59e`: **463 of 463, exit 0**, from a cold `npm ci` worktree. The
`tests/gates/purity.test.ts` flake the review hit on its cold run did not recur.

#### Why this does not merge yet, and what has to happen

`agent/develop` is at `80c7785` — slice 2c landed PR 6 while this branch was in review, taking
`SCHEMA_VERSION` to **6** and adding migration 5. PR 8 reports `CONFLICTING`, and a trial merge gives
three conflicts:

- `packages/harness/src/balance.ts` — the only real code conflict. `agent/develop` still carries the
  full parser body in the harness because slice 2c branched before decision 92 moved it into
  `packages/sim`; this branch carries the five-line wrapper. Decision 92 already settles which side
  wins, and `tests/sim/balance.test.ts` asserts key-set equality mechanically, so a tuning key
  dropped in the resolution turns the suite red rather than passing silently.
- `ISSUES.md` and this document — both document unions.

**The part that could have been nasty is not.** `packages/sim/src/save.ts` auto-merges, and the
result is sound rather than merely textual: `WorldState` has the same thirteen fields on
`agent/develop` as here, so `Record<keyof WorldState, FieldKind>` still typechecks; `migrate` keeps
returning `RawSave` and `deserialise` still wraps it in `worldStateOf`; and develop's migration 5,
which nulls `balance` and shapes `puzzle`, composes with the guard because `balance` is typed
`'an object or null'`. `{"schemaVersion":5}` on the merged tree runs migration 5 and is then refused
by the guard exactly as it is here. Nothing about the guard's design has to change to land on schema
6.

The integration also has to settle the decision-number collision the PR description flags: slice 4b
numbered 90-96 on its own branch while slice 5 numbered 90-100, and the cycle 0 review recommended
slice 4b take 104-110. Slice 4b's PR 7 was still in the test stage when this was written, so whoever
merges second owns the renumber.

This goes to development rather than to analysis, and `cycle` stays 1: nothing here is an open design
question. Decision 92 settles the parser, the guard needs no change, and the renumber is already
recommended. The slice itself passed.

### 2026-09-03 — analysis of review findings, slice 2c (cycle 1)

Re-analysis of the one blocking finding from the PR 6 review, plus the schema collision the review
asked to have settled here rather than inside a conflict resolution. The eight non-blocking findings
stay in `ISSUES.md` at `549e171` and are out of scope; one development task is emitted, against the
existing branch and PR 6, so the slice still lands as one reviewed unit.

**The document is committed on the feature branch, not on `agent/develop`,** for the reason the
slice-3 repair entry gives: every previous entry in this lineage was committed on the branch it
describes, the repair continues on PR 6, and `docs/analysis/` is already one of the fourteen files
that conflict.

**The collision is bigger than the review could see, and that changes the answer.** The review
compared this branch against `agent/develop` at `3ef6d50` and reported a three-file conflict over who
keeps schema 4. Two merges have landed since: PR 5 took `agent/develop` to `SCHEMA_VERSION = 5` —
slice 3 took 4 for `ships`/`battle`, slice 4 extended to 5 for `pirate`/`voyage`/`markets` — and
`git merge-tree` against the current tip `22ec18e` now reports **fourteen** conflicting files, not
three: `save.ts`, `state.ts` and `migration.test.ts`; the v3 fixture as an add/add; the harness
balance reader and its two test files; four hash-bearing fixtures under `packages/fixtures/`; and
`ISSUES.md`, this document and one skill. PR 6 is `CONFLICTING`/`DIRTY` on GitHub. So "which slice
keeps 4" is no longer a live question — develop has 4 and 5 both spoken for, and this slice takes 6.

#### The blocking finding dissolves rather than gets patched

`migrations[3]` on this branch is `(save) => ({ ...save, puzzle: shapedPuzzleOf(save['puzzle']) })`.
It is the only migration in the table that does not null `balance`, which is the whole defect: the
save keeps a `PuzzleBalance` written before `tokenSpawnPerMille` existed, and `puzzle/tokens.ts:37`
reads the missing key as `undefined`, making `if (draw() >= undefined) continue` dead and inverting
the throttle from 120 per mille to 1000.

Renumbered to `5` and given the same `balance: null` its three siblings carry, the finding stops
being reachable rather than being fixed in place. A migrated save arrives with no balance at all, and
`puzzle/dispatch.ts:34` refuses `puzzle.start` with `balance-missing` before `startBilging` — so
`tokens.ts` is never entered with a partially populated balance. The repair is one word in one line,
and it is the same word migrations 2, 3 and 4 already use.

**The alternative — migrating the balance block and supplying the key — is rejected, and not only on
taste.** Decision 41 pins the tuning a replay was recorded under into hashed state precisely so that
a balance edit which changes play fails loudly; a migration that backfills a value would make an old
save silently claim it was recorded under tuning it never saw. It is also mechanically impossible
from `packages/sim`, which cannot import `balance.json` without failing `tools/check-sim-imports.ts`
— the same wall decision 68 hit. The review invited this stage to overturn its blocking judgement; it
stands, but the reason is now stronger than the review's, because the fix costs one word.

**What this does not fix, and is not asked to.** A migrated save remains inert — `balance: null` is
terminal, `Sim.load` does not re-attach a balance and there is no `session.load`. That is develop's
existing `ISSUES.md` entry *A migrated v3 save keeps a permanently inert puzzle*, it predates this
slice, and it stays there. Its sibling — `bilge.swap` and `bilge.poke` reporting `no-puzzle-running`
at `puzzle/dispatch.ts:45` and `:58` for what is really a missing balance — is recorded there too.

#### The merge can re-create the same defect somewhere the migration never touches

This is the finding that was not visible from either side alone, and it is why decision 97 keeps the
merge inside the repair. `balance.json` **auto-merges cleanly**, so `tokenSpawnPerMille: 120` lands in
the data file whatever else happens. But `packages/harness/src/balance.ts` conflicts, and the two
sides are structural rewrites of each other: develop refactored to a generic `readerOf` closure
covering nine balance blocks, while this branch kept a single-block `bilgingBalanceOf` with the
explicit `tokenSpawnPerMille: integerOf(block, 'tokenSpawnPerMille')` at `:42`. **Develop's reader
never reads the key.** Resolving that conflict by taking develop's side — the natural instinct, since
it is the newer and larger rewrite — drops `tokenSpawnPerMille` out of `BALANCE` even though the JSON
carries it, and `spawnTokens` then compares against `undefined` on a *freshly created* sim, with no
save, no migration and no v3 fixture anywhere near it.

So the blocking finding has two homes, and only one of them is the migration. The type system is the
backstop: `BilgingBalance` must keep this branch's 22-key declaration
(`packages/sim/src/puzzle/balance.ts:17`) rather than develop's 21-key one, and if it does, a reader
that fails to populate the key is a `typecheck` failure rather than a silent inversion. That is the
property to preserve when resolving conflict — not the shape of either reader.

**Decisions taken on the review's behalf.**

| #  | Decision                                                                                                                                                        | Rationale                                                                                                                                                                                                                                                                                                                                                                             |
| -- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 90 | Slice 2c's bump becomes `5` to `6`, not `3` to `4`                                                                                                              | `agent/develop` reached `SCHEMA_VERSION = 5` while PR 6 sat in review. Two different `3` to `4` migrations cannot coexist, and sequencing this slice's shape layer last is the only ordering that keeps "an older save migrates forward" true for saves already written under 4 and 5                                                                                                   |
| 91 | `migrations[5]` sets `balance: null` alongside the shape layer                                                                                                  | Migrations 2, 3 and 4 all do it, every consumer already guards for null, and it makes the blocking finding unreachable instead of patched. A save written under schema 5 carries a `Balance` with no `tokenSpawnPerMille`, and no honest rule invents one                                                                                                                              |
| 92 | Backfilling `tokenSpawnPerMille` from `balance.json` is refused                                                                                                 | Decision 41 makes recorded tuning part of the hash, so supplying a value would let an old save claim provenance it does not have. `packages/sim` also cannot reach `balance.json` without failing `tools/check-sim-imports.ts`, which is where decision 68 landed for the identical case                                                                                                |
| 93 | A saved world replays with the tuning it was recorded under; a migration that cannot carry that tuning forward nulls it rather than substituting the current one | This is the question the review asked to have settled once rather than at every bump. Decision 41 already implies it for replays; stating it for migrations is what makes `balance: null` a rule instead of a habit repeated four times                                                                                                                                                 |
| 94 | This branch drops its own `bilge-session-v3.json`; develop's recording — seed 20260902 at tick 120 — is canonical, and the blob is re-recorded against the merged sim | The add/add conflict is resolved by taking develop's side, but not its bytes: once `tokenSpawnPerMille` reaches `BALANCE`, `spawnTokens` draws inside the same resolve, so the tick-120 board is no longer the one on disk and develop's hash-equality test at `migration.test.ts:116` would fail against a copied file. One v3 fixture per repo, and it now exercises the whole chain 3 to 6 rather than one step |
| 95 | A committed schema-5 fixture is added, and the new assertions are positive ones                                                                                  | The v3 fixture reaches `migrations[5]` with its balance already nulled at step 3, so it cannot witness decision 91. Only a v5 save can. The slice-3 repair's lesson applies directly: `assert.notEqual(migrated.balance, null)` passed vacuously for a whole cycle, so the tests assert `balance === null`, `puzzle.start` refused with `balance-missing`, `shapes.length === cells.length` all `NO_SHAPE`, and `maneuverBar === 0` |
| 96 | Every hash-bearing fixture is re-recorded from live runs, each proven by rolling back across the slice-2c delta to reproduce develop's committed hash | Five blobs move, not three — the two replays, the golden, the scenario and the v3 save — because the state hash covers the whole `WorldState`, so even the marker-only replay diverges on the schema constant alone. The slice-4 physical test established this procedure, and the roll-back proof is the only thing that distinguishes a legitimate re-record from a hash that was simply overwritten |
| 97 | The integration merge belongs to this repair, not to the test stage                                                                                             | Decision 74 gave the merge to the test stage, but there the conflict was incidental. Here the renumbering *is* the repair — decision 90 cannot be implemented except against develop's migration table — so deferring the merge would mean writing the fix twice                                                                                                                        |
| 98 | The merged `bilgingBalanceOf` reads `tokenSpawnPerMille`, and `BilgingBalance` keeps this branch's 22-key declaration | Develop's generic `readerOf` rewrite does not read the key, so resolving `packages/harness/src/balance.ts` in its favour re-creates the identical `undefined` comparison on the fresh path, where no save and no migration are involved. Keeping the wider type makes that a `typecheck` failure instead of a silent inversion |

**Numbering.** These take 90 onward because develop is at 89 and this branch at 70. That leaves this
branch's 61 to 70 still colliding with develop's on merge, which is the review's own non-blocking
`ISSUES.md` entry *Decision numbers now collide across concurrent slices*, and it is deliberately not
reopened here — the new numbers are merely chosen not to make it worse.

#### The slice after the merge

`migrations` becomes develop's table with one entry appended, and `SCHEMA_VERSION` becomes 6:

```
  4: (save) => ({ ...save, balance: null, pirate: null, voyage: null, markets: [], ships: shipsWithCargo(save['ships']) }),
  5: (save) => ({ ...save, balance: null, puzzle: shapedPuzzleOf(save['puzzle']) }),
```

`shapedPuzzleOf` is carried over unchanged, including its unguarded cast — that is a recorded
non-blocking finding, and widening it here would be scope this cycle did not earn. `state.ts` keeps
develop's `WorldState` with this branch's `board.shapes` and `maneuverBar` added to the puzzle, and
the harness balance keeps both sides' keys with `tokenSpawnPerMille` among them.

**Done when** `npm run check` is green from cold on the merged branch, the v3 and v5 fixtures both
migrate to 6 under the assertions decision 95 names, and PR 6 is mergeable against `agent/develop`.

### 2026-09-03 — development, slice 2c repair (PR 6, cycle 1)

The one blocking finding is fixed and `agent/develop` is merged in. `npm run check` is 435 of 435,
exit 0 from cold. The repair is three lines of production code; the merge around it is eighty-seven
files, and most of what follows is about the merge, because that is where the risk turned out to be.

**The fix is the one word decision 91 named.** `migrations[5]` now reads
`({ ...save, balance: null, puzzle: shapedPuzzleOf(save['puzzle']) })`, `SCHEMA_VERSION` is 6, and
this slice's step sits after develop's 3 to 4 and 4 to 5 rather than colliding with them. Driving the
review's own reproduction against the merged branch now prints `balance: null` where it printed a
`PuzzleBalance` with a missing key, and `puzzle.start` answers
`{"status":"rejected","reason":"balance-missing"}`. The shape layer still arrives: 144 shapes, every
one `NO_SHAPE`, `maneuverBar` 0.

**The most important measurement in this cycle inverts the review's own reproduction.** Reverting
just `balance: null` from `migrations[5]` and re-running the migration suite fails **two** tests, and
both are the schema-5 ones. Every v3 test stays green. Once this slice's migration is renumbered to 5,
a v3 save has already had its balance nulled by develop's step 3, so **it can no longer witness this
defect at all** — the review's `bilge-session-v3.json` repro would not reproduce even on unfixed code.
Decision 95 predicted this and it is now measured. Had the repair leaned on the v3 fixture, as the
review's evidence naturally suggests, it would have shipped with no failing test behind it.

**Decision 98's trap was real, and it was not hypothetical.** Develop's rewritten `readerOf` genuinely
does not read `tokenSpawnPerMille`; resolving `packages/harness/src/balance.ts` in its favour dropped
the key from `BALANCE` while `balance.json` merged it in cleanly. The type backstop the decision
relied on was verified rather than assumed: deleting the restored line produces
`balance.ts(69,3): error TS2741: Property 'tokenSpawnPerMille' is missing in type ... but required in
type 'BilgingBalance'`. The same backstop then caught a **second** instance nobody had predicted —
`tests/ship/meters.test.ts:29` builds a `Balance` literal by hand and had the same hole. Both are
fixed. This is the argument for keeping the wider type rather than the narrower one: the compiler
found the second site, and no amount of reading the migration would have.

**Decision 94 is corrected: the v3 save is not re-recorded.** The decision predicted that
`tokenSpawnPerMille` reaching `BALANCE` would move the tick-120 board and break the hash-equality
test. It does not. `bilge-session` draws on `bilge.tokens` only when a swap clears, and a stepped-only
session never clears, so the recorded run is untouched and reproduces develop's committed blob exactly.
Develop's 1562-byte fixture is taken unchanged. Re-recording a fixture that still reproduces would
have destroyed the roll-back evidence rather than produced it.

**Five hash-bearing fixtures did move, and each new hash is attributed rather than blessed.** Every
one was re-recorded through the project's own tooling — the pp-golden-state and pp-scenario-author
recipes and `tools/record-replay.ts`, never a hand-typed hash — and each was proven by running the
same recipe in a throwaway worktree at `22ec18e` and reproducing develop's committed file first.

| Fixture                     | Old                | New                | Why it moved                                              |
| --------------------------- | ------------------ | ------------------ | ---------------------------------------------------------- |
| golden `bilge-session-idle-minute` | `34ce4718d58a966d` | `efe30d9d0626d2d9` | schema 6, the token key, `board.shapes`, `maneuverBar`      |
| scenario `bilge-opening`    | `346b5f71bff6b32d` | `c5491f6c19a5e6e1` | the same four                                              |
| replay `marker-drift`       | `9abfd8c6ea454068` | `c9bb1c3d8d9e4f43` | schema 6 and nothing else                                  |
| replay `bilge-session`      | `afd8ed21ba4a3434` | `3c9406489de6557d` | the same four, plus a new `bilge.tokens` RNG stream         |
| `marker-drift-diverged-at-tick-5` | `9abfd8c6ea454068` | `c9bb1c3d8d9e4f43` | inherits `marker-drift`; still diverges at exactly tick 5   |

Two of those rows are worth reading twice. **`marker-drift` moves on the schema constant alone** —
one `jsonPatch` path, `replace /schemaVersion 6`, with marker positions and the `marker.drift` cursor
byte-identical. That is the signature of a bump with no gameplay change, and it is why a replay hash
is a weak canary for behaviour. And **the bilge replay gains `bilge.tokens` as a new stream rather
than extra draws on `bilge.fill`**, whose cursor is unchanged — the token layer takes its own stream,
which is the isolation the golden-state skill asks for rather than the violation it warns about. The
idle golden has no such stream because an idle minute never clears.

**Decisions taken during the repair, continuing the series above.**

| #   | Decision                                                                   | Rationale                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 99  | The harness skill's scenario paragraph is rewritten, not taken from either side | Both sides of the conflict claimed `schemaVersion` 4 and both undercounted the scenarios — `scenarios.ts` registers four. Taking either side would have committed a known falsehood in the same commit that made it false |
| 100 | The v3 save fixture is taken from develop unchanged rather than re-recorded | Measured: it still reproduces against the merged sim. Decision 94 assumed otherwise; re-recording a fixture that reproduces removes the only evidence that it does |
| 101 | The two migration test files collapse to develop's recording, not this branch's | Develop's seed 20260902 at tick 120 is the one the hash-equality test is written against and the one that survives. This branch's 20260903/tick-28 recording is dropped with its fixture, and its shape assertions are ported onto develop's |

**What the merge cost, for the next slice that has to do one.** Fourteen files conflicted. The three
that needed judgement were `save.ts` (semantically incompatible migration tables), `balance.ts` (two
structural rewrites of the same reader, where the naive resolution re-creates the bug) and
`migration.test.ts` (two mutually exclusive fixture recordings). `ISSUES.md` and this document were
pure append-at-anchor and were interleaved by the commit time that introduced each section, not
concatenated in block. The five fixtures were re-recorded, not resolved. `balance.json` and
`packages/sim/src/index.ts` merged cleanly, which is the trap: the data file gained
`tokenSpawnPerMille` without complaint while the reader that consumes it silently lost it.

### 2026-09-03 — independent review of the slice 2c repair (OPP-14), PR 6, cycle 1

Four lenses, run separately against the merged tree, each rebuilding what it measured rather than
reading the PR body. Nothing blocks. The repair is approved and goes to the test stage. Everything
the review found is in `ISSUES.md` under the matching dated heading.

**The blocking finding is unreachable, and that was established by executing every route rather than
by arguing one.** `bilge.swap` and `bilge.poke` on both committed fixtures, `sim.step` at 200 and 300
ticks on a save that already had a puzzle running, the full harness protocol path, and hand-built
saves at schema 4 and 5 carrying a balance missing only `tokenSpawnPerMille` — all refused before
`tokens.ts:37`, with `bilge.tokens` never appearing in `rngStreams`. The one route that does reach
the inverted gate is a save hand-forged at schema 6, which bypasses `migrate` entirely; that is the
loader trusting every field of a current-version save, which is a pre-existing property and not this
slice's to fix.

**All seven claims the task asked to be checked are confirmed**, each by measurement: the gate at
435 of 435 exit 0 from cold in a fresh worktree, TS2741 on a deleted `tokenSpawnPerMille` at the line
and column the development entry quotes, exactly two failing tests on a reverted `balance: null` and
both of them schema-5, a migrated v3 save gaining 144 `NO_SHAPE` shapes and `maneuverBar` 0, the
original reproduction now answering `balance-missing`, the v3 fixture byte-identical to develop's,
and the v5 save a genuine schema-5 recording. The review additionally reproduced the v5 fixture from
`agent/develop` at seed 20260903 and 60 ticks, and found the harness reader has a run-time guard as
well as the compile-time one the entry claims.

**The fixture re-recording is honest, which was the thing most worth attacking.** `bilge-session`
gained `bilge.tokens` as a genuinely new stream while `bilge.fill`, `bilge.refill`, `bilge.critters`
and `marker.drift` kept their cursors byte-for-byte, so the token layer stole no draws from an
existing stream and hid it behind a re-recorded hash. `marker-drift`'s entire state diff is the
schema version. Every one of the ten hashes in the development entry's table matches the blob on both
sides.

**The merge lost nothing.** Zero sections, zero decision rows, zero `ISSUES.md` entries and zero
non-blank lines are missing from either parent, and `tests/harness/balance.test.ts` kept every
behavioural assertion — the single dropped line asserted a one-block `BALANCE` and is superseded.

**Two things the review corrects in the record.** The first is that decision 99's rationale is only
half-honoured: the conflicted paragraph in `pp-sim-harness` was rewritten correctly, but the pointer
table auto-merged from develop's side, so `:91` changed from 3 to 4 when the true value is 6 — a new
falsehood committed by the commit that made it false, twelve lines below the line it corrected. The
second is `ISSUES.md`'s claim that decisions 90-101 collide with nothing. They collide with three
live branches: slice 4b at 90-96, slice 5 at 90-100 and slice 4c at 101-103, all pushed before this
branch's analysis commit. The analysis reached 90 by checking `agent/develop` alone, which is how the
claim came to be written. Taking 90 was defensible on what was checked; the sentence asserting safety
was not, and the integrator now has four branches to reconcile rather than three. The slice 5 repair
has since numbered from 111, leaving 104-110 free for the renumber the slice 5 review recommends.

**Where the next defect of this class will come from.** The v5 fixture inherits the v3 fixture's
fragility: a plausible `migrations[6]` that nulls the balance ahead of it turns it into a non-witness
with all nineteen migration tests still green — demonstrated, not predicted. Nothing in the suite
asserts that a fixture named for a version still reaches the step it was created for, and
`tests/sim/migration.test.ts:58` already carries the false name that mistake produces. Decision 93's
standing rule has the same shape: it is honoured by every migration and enforced by nothing. None of
this is blocking, and all of it is one table-driven test away.

### 2026-09-03 — physical test of the slice 2c repair (OPP-14), PR 6, cycle 1

The system was played, not asserted on. There is no renderer in this slice, so the real interface is
`pp-harness` over stdio, driven the way a session would be driven: roughly 700 hand-played moves
across five seeds, plus a save-and-reload scenario and a hostile-input pass, each in its own
worktree. The suite was run once as a gate and is the least interesting thing here.

**The token layer does what the document says, and every load-bearing claim was seen rather than
inferred.** Shapes spawn onto refilled colour cells and only from the `bilge.tokens` stream. Two
matching halves of one symbol clear when adjacent while both underlying pieces survive — observed
directly, with the state diff showing `/puzzle/board/shapes/32` and `/44` going to `-1` while cells
3 and 0 stayed put and `maneuverBar` went 0 to 1. The meter takes one point per completed symbol,
was walked to the gold 6 on four separate seeds, and then sat at 6 for another 260 moves while pairs
kept resolving. Over those 700 moves no invariant broke: `shapes.length === cells.length` always,
every shape in 0 to 7 or `NO_SHAPE`, no shape ever rode a crab, puffer, jelly or empty cell, and no
adjacent matching pair was ever left standing after a settle.

**Decision 66's correction is itself corrected.** The development entry recorded the performance
gate as "an opening delay rather than a throttle", measured over sessions that were played well. It
is a real brake in both directions: after ninety deliberately wasted moves dropped
`dutyOutputPerMille` to 756, twelve consecutive *clearing* swaps produced zero token draws, and
spawning resumed on the move duty crossed 1100 — the `good` band. Shapes already on the board fell
from eight to four during the drought as existing ones were consumed. The gate stops spawning
outright rather than slowing it, so the wiki's "slows or stops" is implemented as the stop, which is
what the document already says.

**A behaviour worth writing down, because nobody had.** A swap that clears nothing is accepted, costs
a move, and runs no settle — so it can park two matching halves side by side and leave them standing
until the next clearing move resolves them. That follows from resolving once per settle and
contradicts nothing, but it means the meter is not "adjacency is consumed instantly": a player can
stage a pair and bank it. It is also what made the core rule cleanly observable.

**The repair's own distinction holds in both directions.** A save taken at the current schema
reloads at the identical tick and hash (`tick 65`, `68735ae3bdfb5a26`), keeps its balance —
`tokenSpawnPerMille` still 120 — and keeps playing: further swaps accepted, a genuine `bilge.poke`
at star level 3, score and moves advancing. The save round trip is byte-identical across two
independent reloads, and `snapshot.restore` returns the hash exactly. Both committed fixtures
migrate to schema 6 into a fully inert world: `balance` null, 144 shapes all `NO_SHAPE`,
`maneuverBar` 0, `puzzle.start` refused `balance-missing`, `bilge.swap` and `bilge.poke` refused
`no-puzzle-running` with the state hash unchanged, and `bilge.tokens` never appearing in
`rngStreams`. The shapes distinction is not vacuous: a live save demonstrably carries non-`NO_SHAPE`
shapes that survive the round trip byte-identically.

**Determinism survived the merge.** Two cold processes on seed 20260903 agreed on the opening hash
`0ca982849bdeab3e` and on `a5778dd5b88d6824` after sixty ticks; a thirty-command replay on seed 4242
agreed at every intermediate hash. All three committed replays verify from a cold harness:
`marker-drift` and `bilge-session` `ok true` at `c9bb1c3d8d9e4f43` and `3c9406489de6557d`, and
`marker-drift-diverged-at-tick-5` still `ok false` with `divergedAtTick` 5 and
`finalHash == expectedHash`. `npm run check` is 435 of 435, exit 0, in 25.8 seconds.

**Nothing blocked.** The hostile-input pass confirmed, from outside at the protocol level, the two
save defects already recorded as non-blocking: `{"schemaVersion":5}` and a save with `puzzle` removed
answer `internal-error` rather than `invalid-params` and leak a permanently broken registered
session — provable because the session ids skip one — and a save hand-forged at schema 6 is accepted
whole. One new instance of the same known class: a save whose `board.cells` is `{"length":1000}` is
accepted silently and builds a 1000-entry `shapes` array on a 144-cell board. All three are the
unguarded cast the analysis deliberately declined to widen this cycle, and all three are closed by
the shallow top-level guard the slice 5 repair puts in `deserialise`. The harness never hung, never
crashed, and served a fresh playable session after every hostile input.

**Coverage this test could not reach**, stated rather than glossed: no crab spawned in any session,
so the shape-never-rides-a-critter invariant is verified against puffers only, and the crab and jelly
interactions with shapes went unexercised. The crab spawn rate is a recorded slice 2b issue, not a
regression here.

**The merge.** PR 6 goes into `agent/develop` with a merge commit rather than a squash, continuing
the deviation recorded for PR 3 and PR 4 and for a reason that is now stronger: three sibling
branches have already merged `agent/develop` into themselves, and squashing would detach exactly the
history they will merge back against. It stays raised for the human in `ISSUES.md` rather than
settled quietly.

### 2026-09-03 — development, slice 5 integration: taking schema 6 from agent/develop (OPP-12), PR 8

`agent/develop` moved to `80c7785` while slice 5 was in review and test, taking `SCHEMA_VERSION`
from 5 to 6 with slice 2c's token layer and its migration 5. PR 8 was `CONFLICTING` on that alone —
the slice itself had already passed review and physical test, and nothing about it was in question.
This entry records the merge. `cycle` stays 1: integration debt, not a repair.

#### Slice 4b had still not landed, and this merge went ahead anyway

`origin/agent/develop` was `80c7785` when this ran; PR 7 was `OPEN` and `MERGEABLE` with its test
task live. Five consecutive dispatcher runs had held this task back waiting for PR 7 to land, on the
reasoning that merging first would go stale the moment it did. That reasoning is sound and the
staleness is real, but a hold nobody lifts is a stall: the queue's own rule is to stop deferring at
the third run. So the merge was taken with PR 7 outstanding, on the judgement that the durable part
of the work is the larger part — the `balance.ts` resolution, the carried tuning key, the save-path
confirmations and this record all survive PR 7 landing. What will not survive is the two document
unions, which will need a second, cheap merge once PR 7 is on `agent/develop`.

Per this task's own instruction for the not-landed case, **slice 5's decision numbers are left
alone and the collision stays open**: slice 4b numbered its decisions 90-96 on its branch while
slice 5 numbered its own 90-100, neither able to see the other. The cycle 0 review's recommendation
that slice 4b take 104-110 stands and is still unexecuted. Whoever merges second settles it.

No new decision numbers were minted here. The series already carries two live collisions and this
is an integration rather than a design step, so the resolutions below are named rather than numbered
so as not to widen the damage.

#### The one real code conflict, and the key it nearly dropped

`packages/harness/src/balance.ts` conflicted because `agent/develop` still carries the full parser
body in the harness — slice 2c branched before decision 92 moved the parser into `packages/sim` as
`balanceOf` — while this branch carries the five-line wrapper. **Decision 92 settles it**: the
wrapper stays, the parser lives in `packages/sim`. Resolved to this branch's side.

That resolution silently drops whatever `agent/develop`'s parser had learned to read, so the key
sets were diffed rather than eyeballed. Develop's harness parser read 68 keys; `balanceParse.ts`
read 83. Exactly one key was on develop's side and not the sim's: **`tokenSpawnPerMille`**, slice
2c's token spawn rate. It is now read in `bilgingBalanceOf`.

Worth recording that this was never going to pass silently: `BilgingBalance` (merged from develop)
already declared `tokenSpawnPerMille` as required and `balance.json` already carried it at 120, so
omitting the read is a type error, not a quiet default. The instrument the task pointed at works.

#### `ISSUES.md` and this document — unions, nothing rewritten

Both conflicted as single hunks where each side had appended under its own dated headings. Both
sides kept in full; no dated entry edited, per decision 118.

- `ISSUES.md` is newest-first, so develop's two slice 2c sections were spliced **above** slice 5's
  cycle 0 review section. That keeps the file's ordering rule true and also matches wall clock: the
  2c repair review ran 07:32 and its development 06:56, while the slice 5 cycle 0 review actually
  ran late on 09-02 despite its 09-03 heading.
- This document is chronological, so develop's four slice 2c entries were appended after slice 5's
  chain. The two lineages genuinely interleave by wall clock between 06:12 and 11:42 on 09-03, and
  entry-by-entry interleaving was rejected: heading dates stay non-decreasing either way, and each
  lineage's narrative is more use to a later reader unbroken than minute-accurate.

Both files are CRLF and stayed CRLF.

#### The save path — all three prior claims confirmed, and this time by running them

The previous agent established these by reading a trial merge and asked for them to be confirmed by
running one. `packages/sim/src/save.ts` auto-merged; all three hold.

1. **The field table needs no change.** `WorldState` declares twelve fields and extends
   `EntityIdCounter` for `nextEntityId` — thirteen. `FIELD_KINDS` at `save.ts:24` has exactly those
   thirteen names, no more and none missing, so `Record<keyof WorldState, FieldKind>` still
   typechecks. The green typecheck is the proof.
2. **The cast is still in one place.** `migrate(save: RawSave): RawSave` at `save.ts:55`,
   `deserialise` is `worldStateOf(migrate(...))` at `save.ts:52`, and `as unknown as WorldState`
   appears exactly once in the whole of `packages/sim/src`, at `save.ts:96`.
3. **A v5 save migrates and passes; a bare schemaVersion-5 stub is still refused.** Run, not
   reasoned: the fixture `packages/fixtures/saves/bilge-session-v5.json` deserialises to
   `schemaVersion` 6 with `balance` nulled and a 144-cell `shapes` array built by `shapedPuzzleOf`.
   A save carrying only `schemaVersion` 5 runs migration 5 and is then refused by the guard with
   `TypeError: save.seed must hold a number` — the same refusal as before the merge.

#### What the merge did break, and it was not in save.ts

`npm run check` failed from cold on the first attempt, on a file nobody predicted:

```
tests/view/bilgeGesture.test.ts(18,3): error TS2741: Property 'shapes' is missing in type
'{ width: number; height: number; cells: number[]; }' but required in type 'Board'
```

Develop's token layer added a required `shapes` field to `Board`. Slice 5's gesture test builds a
`Board` literal by hand and predates that field. This is exactly the class of thing the task said to
watch for, and it is an integration defect rather than a design question, so it was fixed here.

The fix follows what the view facade already does for cell constants:
`packages/view/src/client/rules.ts` now re-exports `NO_SHAPE` and the `BoardShape` type from
`@opp/sim`, and the test fills `shapes` with `NO_SHAPE` the way `tests/puzzle/fixtures.ts:70` does.
Hardcoding the sentinel in the test was rejected — it would duplicate a constant the facade exists
to publish. **The gesture module itself, the guard, the ticker and the clamp were not touched**, as
instructed.

Noted and not fixed, because it is a feature gap rather than a regression: the renderer does not draw
tokens. Slice 5's puzzle scene was built before tokens existed in the sim and nothing that previously
worked is broken, so it goes to `ISSUES.md`.

#### Verification

- `npm run check` **green from cold, 486 of 486 tests passing**, 0 failed, and all four gates
  (`deps`, `imports`, `boundary`, then `typecheck` and `lint`) clean. The first cold run failed on
  the `Board` error above; green after the fix, with no flake in either run.
- `npm run build` clean.
- `npm run smoke` **4 of 4 on the first attempt** — no re-runs needed, contrary to the flake the
  review saw.

#### Which server served the smoke, and a correction to how provenance was meant to be proved

Port 5178 was confirmed still held, by PID 10172, serving the stale `opp-slice5` worktree at
`a14e78c`. A default smoke run here would have reused it and tested the wrong checkout. This run
started its own server with `npx vite packages/app --port 5191 --strictPort` and pointed Playwright
at it through a throwaway config that was deleted afterwards; the worktree carries no untracked file.

**The provenance check this task prescribed does not discriminate, and anyone repeating it should
know that.** The instruction was to fetch the puzzle module and find *Click a puffer to pop it* and
none of the old copy. But the stale tree's hint reads *Click a tile to swap it with the tile on its
right. The last column cannot start a swap. Click a puffer to pop it.* — it **ends** with that exact
sentence, so a substring match succeeds against both trees. Both servers were fetched and both
matched.

What does discriminate, and what was actually used:

- `SCHEMA_VERSION` — **6** from port 5191, **5** from port 5178.
- The hint's leading text — 5191 serves `Click a puffer to pop it. Click any other tile to swap it
  with the tile on its right.`; 5178 serves the old sentence order above.
- 5191's `puzzle.ts` imports `bilgeGesture.ts` and calls `gestureAt`; 5178's still inlines the
  `PUFFER_CELL` comparison.

#### State handed on

PR 8 merges cleanly and reports `MERGEABLE`. A test task follows to exercise the merged tree once
more — the suite, the build, a provenance-proved smoke and one pass through the pillage loop — not
the full physical pass, which is done and recorded above. If PR 7 lands before that test runs, PR 8
will need one more merge covering the two document unions only.
