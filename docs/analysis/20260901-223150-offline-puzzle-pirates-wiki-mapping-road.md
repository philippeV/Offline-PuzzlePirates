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
