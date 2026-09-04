# Charting, setting sail and the voyage between league points

Lineage: `20260904-125820-charting-setting-sail-and-the-voyage-bet`
Epic: [OPP-17](https://verphi.atlassian.net/browse/OPP-17)
Stage: analysis, cycle 0
Prior art: `docs/analysis/20260901-223150-offline-puzzle-pirates-wiki-mapping-road.md` (the road document)

Decisions in this document are numbered **within this lineage** (L1, L2, ...). The road document
keeps its own register; the two are deliberately not interleaved, because the road document's
numbering could not be established unambiguously from the repository.

## The problem

Two problems, one of which hides the other.

**The reported defect.** In the Chart panel, clicking an island does nothing a player can act on.
The panel keeps reading "Click an island to chart a course.", no voyage-type chooser and no confirm
control appear, and no course can be charted. Reproduced on a fresh New game and on smoke seed
12648430 at Alkaid Island by clicking Doyle Island.

**The design gap the defect hides.** Even with the chooser reachable, the game does not do what the
epic asks. Charting and departing are the same act; the passage between league points is a counter
rather than a place; no other ship exists anywhere on the map; and a sea battle can only begin at
the moment a league point is reached.

## Root cause of the defect

The chart grid is torn down and rebuilt on **every simulation tick (60 Hz)**, so the browser never
synthesises a `click` on an island button.

The chain, established by reading the code and confirmed by reproducing it against the running dev
server on seed 12648430:

| Step | Where                                    | What happens                                                                    |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| 1    | `packages/sim/src/marker.ts:47-56`       | `driftMarkers` returns a `marker.drifted` event **every tick, unconditionally**  |
| 2    | `packages/view/src/client/client.ts:96`  | `advance()` calls `announce()` whenever `events.length > 0` — so every tick      |
| 3    | `packages/view/src/app.ts:61-66`         | the rAF ticker calls `client.advance(ticks)` every frame                         |
| 4    | `packages/view/src/panels/panels.ts:125` | the `refresh` subscription calls `minimap.refresh()`                             |
| 5    | `packages/view/src/panels/minimap.ts:41` | `refresh()` then `drawGrid()` clears the grid and re-creates all 36 cell buttons |

Every island button therefore lives about 16 ms. A real pointer press and release always straddle
at least one rebuild, so `mousedown` and `mouseup` land on **different element objects**; per the UI
Events spec the `click` is then dispatched on the nearest common ancestor (`.pp-chart-grid`) and the
button's own listener never runs.

Verified directly: with a listener applying one tick on `mousedown`, a real click produced
`down:Doyle`, `downTargetConnected=false`, `up:Doyle`, and **no `click` event**, with the panel still
reading "Click an island to chart a course.". With the clock frozen, the identical click works and
the full chooser renders.

The selection state and the chooser were never broken. `selectedIslandId` and `selectedVoyageType`
are closure variables in `createMinimap` (`minimap.ts:32-33`), the minimap is created once
(`panels.ts:80`) and never re-created, and `drawChooser` (`minimap.ts:80-100`) reads exactly what the
click writes. The `voyage.chart` command exists, validates properly and surfaces every rejection as
a chat line. **The UI is unreachable, not absent.**

Two aggravating factors share the cause: automation and accessibility references to a cell go stale
within one frame, and keyboard focus on a cell is destroyed every frame — so the chart is
unreachable by keyboard too.

## What already exists

- **The map**: a fixed 6x6 lattice of 36 league points (`world/leaguePoints.ts:27-64`), seven islands
  on seven of those points (`world/islands.ts:23-31`), computed adjacency and a working BFS
  `routeBetween` (`leaguePoints.ts:148-171`).
- **The voyage**: `VoyageState` is `route`, `legIndex`, `legTicks`, `legTicksRequired`
  (`world/state.ts:32-40`). Progress along a leg is already a scalar. `ShipState` has **no position
  field at all** (`ship/state.ts:26-48`), and `pirate.atIslandId` is `null` while at sea.
- **The tick loop**: `Sim.step` (`sim.ts:69-80`) runs `stepWorld` then `stepVoyage`
  (`world/voyage.ts:53-80`) at `TICKS_PER_SECOND = 60`.
- **The chooser**: `courseSection` (`minimap.ts:102-118`) with the three voyage types
  (`pillage`, `trade`, `evade`) and a `Set sail` button (`minimap.ts:131-142`).
- **The art**: `iso/atlas.ts` is procedural PIXI `Graphics`, not image files. A `water` tile
  (`atlas.ts:247-252`) and a complete side-on `sloop` prop with hull, mast, sails, rigging and a
  waterline (`atlas.ts:331`, painted `872-914`) already exist and are already used in the port scene.

## What does not exist

- **No `voyage.sail` op.** `sim/commands.ts` has only `voyage.chart`, and the `Set sail` button
  dispatches it directly (`minimap.ts:131-142`). Charting *is* departure today.
- **No sea scene.** Scenes are `port | deck | hold | nest | puzzle | battle`
  (`client/client.ts:14`). The passage is a progress readout, not a place.
- **No other ships.** `Allegiance` is `'player' | 'brigand'` (`ship/state.ts:14`). A brigand hull is
  created at the *moment* of the encounter (`world/encounter.ts:48-56`) and deleted when the battle
  settles (`world/session.ts:37-39`). Traffic must be built from nothing.
- **No range test.** `rollEncounter` is called only in the branch that fires after
  `legTicks >= legTicksRequired` (`world/voyage.ts:69-79`) — strictly arrival-gated.
- **No prospective route preview.** `pp-cell-route` exists (`minimap.ts:57`) but is fed only from
  `client.state.voyage?.route`, the route of a voyage already under way.

## The design

### Fixing the defect

Make the chart grid **idempotent**: build the 36 cells once, then update their classes, labels and
disabled state in place on refresh, instead of clearing and re-creating them. Stable nodes survive a
press, so `click` fires, focus persists and the grid keeps its scroll position.

The alternative — stopping `driftMarkers` from emitting every tick — is rejected as the fix. It
would churn goldens, replays and state hashes across the fixtures, and it would not actually make
the chart safe, because any other event would still rebuild the grid mid-press. It is a real defect
in its own right (a "nothing happened" event at 60 Hz), and it belongs in `ISSUES.md`, not here.

Two adjacent faults must be fixed with it, because each independently breaks charting:

- **Layout shift re-targets the next click.** When the chooser expands, `.pp-chart` at
  `max-height: 48vh` and `.pp-chart-grid` at `min-height: 0; overflow-y: auto`
  (`panels.css:285-310`) shrink the grid and the cells move. Observed live: three clicks at one fixed
  pixel selected Doyle, then Marlowe, then Marlowe. The chooser must not resize the grid.
- **The current island refuses `no-route`.** `chartVoyage` rejects a route shorter than two points
  (`voyage.ts:42`), already filed at `ISSUES.md:2596`. The cell for the island the player is standing
  on must be disabled rather than offered.

### Charting and setting sail as two acts

`VoyageState` gains an explicit lifecycle rather than a second parallel field. A charted voyage sits
in the state with the route plotted and the ship moored; `stepVoyage` advances only a voyage that has
departed. A new `voyage.sail` command performs departure, and a new `voyage.abandon` lets a moored
player discard a charted course rather than be trapped in it.

This is a save-shape change: `SCHEMA_VERSION` goes 6 to 7 with a migration marking every existing
voyage as already under way (which is what every voyage in an existing save is), plus the
`FIELD_KINDS` and `refuseSpoiltState` guards extended to the new field.

### The passage as a place

A new `sea` scene, entered while under way. It is a `water` tile grid with `sloop` props — the same
`SceneObject` and `createIsoScene` machinery as the port scene — so it needs **no new art and no edit
to `atlas.ts`**, which the guardrail forbids. The player's sloop is placed along the leg from
`legTicks / legTicksRequired`, which the sim already tracks, so the ship is visibly travelling
rather than reporting a number.

### Traffic and the range encounter

Other ships become lightweight sim entities carrying a league point pair, a progress scalar and a
speed — not full `ShipState` hulls. They are seeded and advanced deterministically from the existing
`world.encounter` RNG stream, they move at their own speed so they overtake or fall behind, and they
are only promoted to a real brigand hull when an encounter actually begins.

The encounter trigger moves from arrival to **range**: while under way, a traffic ship whose progress
along the same leg is within a threshold of the player's rolls for an encounter. `evade` keeps its
chance of zero. The arrival-gated `rollEncounter` call is removed, which resolves the epic's last
point.

### Alternatives rejected

| Alternative                                            | Why rejected                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Fix the defect by suppressing the per-tick marker event | Churns goldens, replays and hashes, and leaves the grid rebuildable by any other event mid-press.     |
| Give `ShipState` real x and y positions                | A far larger sim and save change; `legTicks / legTicksRequired` already locates a ship on a leg.      |
| Model traffic as full `ShipState` hulls                | Every hull carries meters, cargo and duty state the save guard validates; far too heavy for scenery.  |
| Render the passage inside the existing `deck` scene     | The deck is aboard-scale; the epic asks for the passage itself, and a distinct scene keeps both.      |
| Keep `Set sail` on the chart panel                      | The epic separates the two acts; leaving departure on the chart preserves exactly the conflation.     |

## Decisions taken on the goal's behalf

No human is available during a queue run, so these were decided and are recorded here.

| #   | Decision                                                                     | Rationale                                                                                                                 |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| L1  | Fix the defect in the view by making the grid idempotent, not in the sim      | The view must not destroy interactive DOM it needs clickable. A sim-side event change churns goldens and does not fix it.  |
| L2  | The per-tick unconditional `marker.drifted` event goes to `ISSUES.md`         | Real noise and a real cost, but not blocking under the contract's test, and not what the epic asks for.                    |
| L3  | Voyage lifecycle is an explicit state on `VoyageState`, not a parallel field  | One field cannot contradict itself; the save guard and `stepVoyage` both read a single source of truth.                    |
| L4  | `SCHEMA_VERSION` 6 to 7; migration marks existing voyages as already under way | Every voyage in an existing save is one that already departed, so the migration is exact rather than a guess.             |
| L5  | A `voyage.abandon` command is added alongside `voyage.sail`                   | Without it a charted course cannot be undone and the player is trapped in a choice made in one click.                      |
| L6  | Departure control lives at the helm in the `deck` scene                       | The epic says "from the helm or an equivalent explicit control"; the helm is aboard the ship, where leaving port belongs.  |
| L7  | New `sea` scene rather than reusing `deck`                                    | The deck is aboard-scale. Both views are wanted: the ship under way, and the deck you work on.                             |
| L8  | The passage is drawn from the existing `water` tile and `sloop` prop only     | The guardrail forbids touching `atlas.ts`; the atlas already carries everything the scene needs.                           |
| L9  | Ship position on a leg is derived from `legTicks / legTicksRequired`          | Already in the state and already saved. Adding coordinates would be a larger change for no gain.                           |
| L10 | Traffic ships are light entities, promoted to a hull only at an encounter     | The save guard validates full hulls; scenery must not pay that cost, and settlement already deletes brigand hulls.         |
| L11 | Traffic is drawn from the existing `world.encounter` RNG stream               | Determinism is a hard property of this sim; a new stream would change every existing seed's outcomes.                      |
| L12 | The current island's chart cell is disabled rather than refused               | `chartVoyage` rejects a one-point route; offering a control that can only fail is the defect in miniature.                 |
| L13 | The `sea` scene gets a smoke case and a deliberately taken baseline           | The guardrail requires the Playwright smoke to pass and baselines to be re-taken deliberately and declared.                |
| L14 | All four slices are emitted now with explicit dependencies                    | Matches decision 11 of the road document: the dispatcher drains oldest-first, and each body states its precondition.       |

## Constraints and risks discovered

- **The view boundary is enforced.** `tools/check-view-boundary.ts` forbids any file under
  `packages/view/src` outside a `client/` directory from importing `@opp/sim`. Every new sim symbol a
  scene or panel reads must be re-exported through `packages/view/src/client/rules.ts`.
- **Sim purity is linted.** `eslint.config.js` bans `Math.random`, `Date.now`, `performance.now`,
  timers and bare imports under `packages/sim/src`. Traffic movement must come from the RNG stream.
- **`npm run check`** runs deps, imports, boundary, typecheck, lint and test in sequence.
- **The Playwright smoke is not in CI** (`.github/workflows/ci.yml` runs only `npm run check`), so
  the development and test stages must run `npm run smoke` locally and not assume CI covers it.
- **Baselines** live in `tests/e2e/__screenshots__/` at `maxDiffPixelRatio: 0.01`, driven by
  `?seed=12648430&scene=<name>`.
- **Save guard.** After migration, `refuseSpoiltState` validates `FIELD_KINDS`, known `voyage.route`
  league points and that `voyage.shipId` resolves into `save.ships`. Decisions 153 and 154 of the
  road document rest on `voyage.chart` having exactly one call site; this work adds `voyage.sail` and
  `voyage.abandon`, so that audit must be restated rather than assumed.
- **Decision 129 of the road document**: a concluded battle with no voyage stays uncleared because
  `stepWorld` returns early when there is no voyage. Moving the encounter trigger must not widen that
  hole.
- **`panels/minimap.ts` has zero automated coverage** today. A defect this visible reaching a play
  session is a direct consequence; slice A should leave coverage behind.
- **Repository hygiene, for the human**: `agent/develop` is 6 ahead and 1 behind
  `origin/agent/develop` (the behind commit is `8e016f3`, the squashed PR #13, whose content exists
  locally unsquashed as `32c7c49` and `194b842`), the working tree carries two uncommitted screenshot
  baselines belonging to another agent, and `git worktree list` shows 20 orphaned worktrees under
  scratchpad directories. This analysis did not disturb any of it.

## The slices

Strictly ordered. Each states its precondition.

### Slice A — the chart is usable again

Fixes the reported defect. View-only; no sim or save change.

Done when: clicking an island on the chart selects it and shows the voyage-type chooser and the
confirm control; the route the course would sail is previewed on the grid; the cell for the island
the player is standing on is disabled; the grid keeps focus and scroll position across ticks; the
chart has automated coverage that would have caught this; `npm run check` and `npm run smoke` pass.

### Slice B — charting and setting sail become two acts

Depends on slice A. Sim, save and view.

Done when: charting plots the route and leaves the ship moored; the ship leaves port only on a
deliberate `voyage.sail` from the helm; a charted course can be abandoned; `SCHEMA_VERSION` is 7 with
a migration and a committed v7 fixture save; existing saves still load; `npm run check` and
`npm run smoke` pass.

### Slice C — the passage is a place

Depends on slice B. Adds the `sea` scene.

Done when: while under way the player sees a sea scene with their ship visibly travelling the leg,
positioned from the voyage's own leg progress; the scene uses only existing atlas tiles and props;
a smoke case and a deliberately re-taken baseline cover it; `npm run check` and `npm run smoke` pass.

### Slice D — traffic, and battle by range

Depends on slice C. Completes the epic.

Done when: other ships are present on the passage and can overtake the player; a sea battle begins
when a ship comes into range while under way; the arrival-gated encounter roll is gone; `evade` still
never encounters; determinism holds for a fixed seed; `npm run check` and `npm run smoke` pass.

## Jira

| Key    | Type  | Summary                                                               |
| ------ | ----- | --------------------------------------------------------------------- |
| OPP-17 | Epic  | Charting, setting sail and the voyage between league points           |
| OPP-18 | Story | Analysis: Charting, setting sail and the voyage between league points |

Slice stories are created under OPP-17 by this analysis and recorded in the changelog below.

## Changelog

### 2026-09-04 — analysis, cycle 0

Analysis written from three parallel read-only reconnaissance passes over the repository plus a live
reproduction of the defect against the running dev server.

The defect's root cause is a 60 Hz teardown of the chart grid, not a missing chooser: the chooser,
the selection state and the `voyage.chart` command all already work and are simply unreachable by a
real pointer. That finding reframed the epic — one slice repairs what exists, three build what the
epic actually asks for.

Emitted slices A, B, C and D to `dev/development/inbox/` with explicit dependencies, per decision L14.

Repository state at the time of writing, unchanged by this analysis and flagged for the human:
`agent/develop` is 6 ahead and 1 behind `origin/agent/develop`; the working tree holds two
uncommitted screenshot baselines belonging to another agent's in-flight work; 20 orphaned worktrees
remain from earlier runs. This document was committed to local `agent/develop` with an explicit
pathspec. It was **not pushed**, because pushing requires first merging `origin/agent/develop`, and
that merge would overwrite the other agent's uncommitted `puzzle.png`. Reconciling that divergence is
left to the human or to whichever run owns those baselines.
