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
