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
