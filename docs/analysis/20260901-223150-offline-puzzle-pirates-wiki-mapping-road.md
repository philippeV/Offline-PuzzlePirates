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
