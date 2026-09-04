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

| Key    | Type  | Summary                                                               | Slice |
| ------ | ----- | --------------------------------------------------------------------- | ----- |
| OPP-17 | Epic  | Charting, setting sail and the voyage between league points           | —     |
| OPP-18 | Story | Analysis: Charting, setting sail and the voyage between league points | —     |
| OPP-19 | Story | Slice A — the chart is usable again                                   | A     |
| OPP-20 | Story | Slice B — charting and setting sail become two acts                   | B     |
| OPP-21 | Story | Slice C — the passage is a place                                      | C     |
| OPP-22 | Story | Slice D — traffic, and battle by range                                | D     |

All four slice stories were created under OPP-17 by this analysis.

## Changelog

### 2026-09-04 — development, slice A (OPP-19)

Slice A implemented on `agent/feature/20260904-132300-opp17-slice-a-chart-is-usable-again`. The
chart grid and every interactive control in the chooser are now built once and repainted in place,
so no node a player can press is destroyed by a tick.

**The chooser had the defect too, and the slice would not have worked without fixing it.** The
analysis judged the chooser sound because its state and its command are sound, but `drawChooser`
cleared and re-created the three voyage-type buttons and the `Set sail` button on every tick exactly
as `drawGrid` did. Reaching the chooser would have made a chart that offers controls that cannot be
pressed. The chooser is now a stable `status` block plus a stable course section whose title, facts,
type row and sail row are updated rather than replaced, and `Set sail` reads `selectedIslandId` at
click time instead of being rebuilt around it.

**Decision L15: this branch is based on `origin/agent/develop`, not on local `agent/develop`.** The
local branch is 8 ahead of the remote and its extra commits are the slice 5b sloop-scene and
art-atlas work, which has no PR and was merged locally only. Basing on it would have carried another
work item's unreviewed art into this PR. The analysis document and its `ISSUES.md` entry were
cherry-picked onto the remote base instead; the `ISSUES.md` cherry-pick conflicted with the slice D
test record and was resolved keeping both entries, newest first.

**Consequence for requirement 5, honestly stated: the layout shift does not reproduce on this base.**
`max-height: 48vh` on `.pp-chart` and `min-height: 0; overflow-y: auto` on `.pp-chart-grid` — the
rules the analysis cited as `panels.css:285-310` — are part of the unpushed slice 5b work and are not
on `origin/agent/develop`. Here the grid is a 6-column `aspect-ratio: 1` lattice whose height follows
its width, so expanding the chooser cannot resize it. Two forward-compatible lines were added so the
fault cannot return when the art work merges: `flex: 0 0 auto` on `.pp-chart-grid`, so the grid never
yields space to the chooser, and `overflow-y: auto` on `.pp-chart`, so the chart itself scrolls when
a `max-height` is imposed on it. Both are inert on this base and could not be verified here; whoever
merges slice 5b must re-check the behaviour rather than trust them.

**Decision L16: `happy-dom` 20.14.0 added as a devDependency.** The repository had no DOM
implementation in tests at all and no test touched `document`, which is why a panel could ship with
zero coverage. `tests/view/minimap.test.ts` adds six cases, and the root `tsconfig.json` gained
`"lib": ["ES2023", "DOM", "DOM.Iterable"]` to match `packages/view` — pulling a panel into the tests
project needs the DOM types. That made the hand-rolled `requestAnimationFrame` and
`cancelAnimationFrame` declarations in `tests/view/ticker.test.ts` duplicate declarations, so they
were removed; the stubbing itself is untouched.

**The new tests were verified to bite.** Against the pre-fix `minimap.ts`, five of the six fail. The
sixth, the `Set sail` dispatch, passes there because `.click()` invokes the listener directly and no
DOM shim reproduces a browser's mousedown/mouseup-on-different-nodes behaviour. That is also why the
fix was verified physically in a real browser with the clock running, on the seed from the defect
report: clicking Doyle Island at 60 Hz now selects it, previews the two-league route on the grid,
and offers Pillage/Trade/Evade and Set sail; choosing Trade and pressing Set sail logs "Course set
for Doyle Island, 2 leagues." and puts the pirate at sea. Alkaid's cell is dimmed and disabled while
the pirate stands on it, per decision L12.

`npm run check` is green (590 tests) and `npm run smoke` is 4 passed with the committed baselines
untouched — the disabled cell's dimmed label stays under the 0.01 diff ratio, so no baseline was
re-taken.

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

### 2026-09-04 — development, slice B (OPP-20)

Charting and departure are now two acts. `VoyageState` carries `phase: 'charted' | 'under-way'`
(decision L3); `chartVoyage` returns `'charted'` and no longer nulls `pirate.atIslandId`;
`stepVoyage` refuses to advance anything not under way; `voyage.sail` and `voyage.abandon` join
`voyage.chart` and `voyage.port`. `SCHEMA_VERSION` is 7, migrated from 6 by marking every existing
voyage `'under-way'` (decision L4), with `refuseSpoiltVoyage` extended to the new field.

Decisions taken during development, in this lineage's register. They are numbered from L20
because slice A's cycle 1 analysis claimed L17 to L19 on its own branch while this slice was in
flight; this entry was written against a base that predated it and had to be renumbered.

| #   | Decision                                                                        | Rationale                                                                                                                        |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| L20 | Branched from slice A's feature branch, not `agent/develop`                      | PR 14 was open and unmerged; the task's own precondition prescribes this, and slice A's chart fix is what makes charting testable. |
| L21 | Two fixtures committed, not one: `voyage-under-way-v6` and `voyage-charted-v7`   | The v6 one is what actually exercises the migration; the v7 one pins the new shape, which is what the task and OPP-20 asked for.   |
| L22 | Both fixtures generated from running code, the v6 one before any edit was made   | A hand-written "old" save proves only that the migration handles what its author imagined. The v6 artefact predates the change.    |
| L23 | `client.atSea` redefined as `phase === 'under-way'` rather than `voyage !== null` | Otherwise charting alone flips `atSea`, `syncScene` evicts the player from port and `canEnter('port')` locks them aboard.          |
| L24 | `deck.moored()` reduced to `pirate.atIslandId !== null`                          | The old third clause `voyage === null` would hide the gangplank the moment a course was charted. Only `voyage.sail` nulls the id.  |
| L25 | The helm control is an `ObjectAction`, statically present, refused by the sim     | The deck is PIXI and is not rebuilt after a dispatch, so a conditionally-present action would go stale. The rule stays in the sim. |
| L26 | `voyage.abandon` calls `settleConcludedEncounter` before clearing the voyage      | Exactly what `voyage.port` does. Without it, abandoning with a concluded battle standing would widen decision 129's hole.          |
| L27 | The wrong-facing `no-voyage-running` copy at an empty helm went to `ISSUES.md`    | The string is shared with `voyage.port`; the real fix is a new rejection reason, which is scope this slice was not given.          |

**The road document audit the task required, restated rather than assumed.** Decisions 153 and 154
rest on `voyage.chart` having exactly one call site (confirmed by decision 155). That premise was
never the bare count but the property it established: the voyage ship is always the player hull.
`voyage.chart` still has exactly one production dispatch site, still passing `context.playerShip()`.
**The two new commands cannot weaken it, because neither carries a `shipId`** — `sail(state)` and
`abandon(state)` take only state, and the harness parses both as a bare `{ op }`. `sail` reads
`voyage.shipId` off the voyage `charter` already created, so no new path can put a brigand hull
there. **Decision 153 holds.** Decision 154 is unaffected in substance but its gating sentence is now
too narrow, and is filed in `ISSUES.md` (see L27's neighbour entry).

**A state combination that could not exist before.** A pirate may now hold a voyage *and* be at an
island simultaneously. `trade` and `divide` guard only on `atIslandId`, so a charted-but-moored
pirate can still trade — judged correct and intended, since the ship has not left. `charter` refuses
a second course with `voyage-already-running`, so `voyage.abandon` is the only exit from that
window, which is precisely why decision L5 required it.

**Verification.** `npm run check` green from cold, 607 tests. `npm run smoke` 4 passed with
`tests/e2e/__screenshots__` untouched — no baseline was re-taken, and none needed to be, because the
chooser is collapsed at rest on the `port` baseline and the helm menu is closed. The golden, the
scenario fixture and the three replays were re-blessed through the repo's own tooling; the change is
schema-version-only, proven by the golden's two-line diff (`schemaVersion` and its dependent
`stateHash`) and by every changed line in both replays being a hash field.

**Driven physically in a browser** on `?seed=12648430&scene=port`, because the helm control has no
automated coverage — the deck is PIXI and the radial menu is not reachable from a DOM test. A real
pointer click selected Doyle and opened the chooser (slice A's fix still holds); `Chart course` left
the pirate at Alkaid in phase `charted` with `canEnter('port')` still true; 600 ticks moved the
voyage not at all; the Navigation station's radial menu offered `Set sail`; clicking it set
`under-way`, nulled `atIslandId` and logged "Lines cast off, bound for Doyle Island."; 600 further
ticks advanced `legTicks` to 600. `Abandon course` cleared the voyage, left the pirate at Alkaid and
allowed an immediate re-chart.

The soak suite dropped from ~217s to ~7s. Not a weakened test: every seed previously charted a
voyage that never moved and burned the full 4,000,000-tick budget before being recorded as `stuck`.

### 2026-09-04 — development, slice B repair (OPP-20), cycle 1

Repaired on the existing branch so PR 15 updates in place — no second branch, no second PR, no
rebase, as the task specified.

**The blocking finding is closed by one line**, at `packages/sim/src/world/dispatch.ts:97`, placed
per decision L28 immediately after `abandon()`'s existing `under-way` refusal:

```ts
if (state.battle !== null && state.battle.outcome === 'running') return refused('battle-running');
```

No new refusal reason and no new message: `battle-running` and "Not while the guns are out." already
existed. One test added to `tests/world/dispatch.test.ts`, mirroring the shape of the existing
"porting out of a running battle is refused, so the world is never stranded".

**The test was proved red before it was allowed to pass.** With the guard reverted and the test in
place, it failed — and so did the L29 test — while the pre-existing `port()` battle-running test
still passed, which is what makes this a guard and not a decoration.

**Decision L29 is withdrawn. It was wrong, and the error was mine at the analysis step.** The
analysis claimed the `port()` phase check was "verified safe" because every existing test expecting
an accepted `voyage.port` operates on an under-way voyage. That verification was not sound: it
counted `voyage.sail` occurrences per *file* and inspected `tests/world/encounter.test.ts`'s helper,
which said nothing about individual tests inside `tests/world/dispatch.test.ts`. Two tests there —
"porting announces the island the voyage ended at, not the one it left" and "a refused porting
settles nothing, so the battle outlives the command that failed" — dispatch `voyage.chart` and then
set `legIndex` **directly**, never calling `voyage.sail`, so they sit in `phase: 'charted'` and the
new guard refused them.

Withdrawn rather than accommodated. Rewriting two existing tests to suit an explicitly non-blocking,
optional change is scope the task did not ask for, and the task named this outcome in advance
("if L29 cascades further than the analysis predicts, drop it"). The `port()` phase gap therefore
**remains open and remains filed in `ISSUES.md`**, unchanged. Reverted in full: the guard, the
`voyage-not-under-way` reason, its log message and its test — the diff carries no trace of it.

Worth recording for whoever closes it later: the gap is real, but closing it means deciding what
those two tests should assert, because they currently encode porting from a state that slice B's own
phase model says cannot arise. That is a larger question than a one-line guard.

**Gates, from cold in a clean worktree:**

- `npm run check` — **exit 0, 608 pass / 0 fail** (607 before, plus the one new test), 21.6s.
- `npm run smoke` — **4 passed**, all four baselines md5-identical, nothing re-blessed.

The `purity.test.ts` child-spawn flake did not fire.

**PR 15 is now `CONFLICTING` against `agent/develop`, and this was left alone deliberately.** Slice A
merged as `a70a81b` while this branch remained based on `ae8edbd`. Files changed on both sides since
the merge base: `ISSUES.md`, this analysis document, `packages/view/src/panels/minimap.ts`,
`packages/view/src/panels/panels.css`, `tests/view/minimap.test.ts`, `package.json`,
`package-lock.json`, `tsconfig.json` and `tests/view/ticker.test.ts`. The task forbids rebasing here
and the rebase carries the CSS hazard with it, so it belongs to one deliberate pass rather than being
smuggled into a guard fix. **The conflict set includes exactly the hazard files**, which means the
rebase will at least force a human or agent to look at `panels.css` and `minimap.ts` together —
though it will not force them to notice that `.pp-chart-sail` has stopped matching anything, because
that failure is silent and slice A's guard stays green through the rename.

### 2026-09-04 — analysis, slice B (OPP-20), cycle 1

The PR 15 review returned one blocking finding. Re-analysed only that, per the contract; the ten
non-blocking findings stay in `ISSUES.md` and are not revisited here.

**The finding is real, and I verified its mechanism from the source rather than accepting the
review's account.** `state.battle` is assigned in five places, and exactly one of them *clears* it:
`settleEncounter` (`packages/sim/src/world/session.ts:40`). The other four are
`battle/dispatch.ts:46` and `world/encounter.ts:59`, which both *start* a battle, `state.ts:45`,
which is initial state, and `save.ts:16`, which is the schema-3 migration. `settleEncounter` is
private and reachable only through `concludedEncounterOf`, which returns `null` whenever
`voyage === null` (`session.ts:23-27`); `stepWorld` also returns `[]` at `session.ts:10` on a null
voyage. So once `abandon()` clears the voyage with a battle still `running`, there is no code path
left in the repository that can ever settle it, and none that can clear `state.battle` short of
loading another save or starting a new game. The review's conclusion holds exactly as written.

**Why the window exists at all.** `abandon()` already refuses a voyage that is `under-way`
(`world/dispatch.ts:96`), and encounters can only spawn from the phase-gated `stepVoyage`. So the
vulnerable state is *only* `phase: 'charted'` with a battle running — which the shipped view cannot
produce, but the harness surface this slice widened can, as can a loaded save.

**Decision L28 — the guard goes *after* the phase check, not where `port()` puts it.** The task
suggested copying `port()`, which tests `battle-running` immediately after its null-voyage check. Not
doing that, for a reason worth recording: in `abandon()` the `under-way` refusal at `:96` already
prevents that path from ever reaching the clear, so the only unprotected window is the charted one.
Placing the new guard *after* `:96` therefore guards exactly the broken case and leaves every
existing refusal reason unchanged; placing it before would silently change the refusal for
"under way **and** in a battle" from `voyage-already-under-way` to `battle-running`, which is a
behaviour change nothing asked for. Smallest change that closes the defect.

The line itself is the one already in `port()` at `:119`:

```ts
if (state.battle !== null && state.battle.outcome === 'running') return refused('battle-running');
```

No new refusal reason, no new message: `battle-running` and its log line "Not while the guns are out."
(`view/src/client/log.ts:44`) both already exist.

**Decision L29 — close the `port()` phase gap in the same pass, and it is safe to do so.** The task
offered this as optional. Taking it, because it is the same one-line shape in the same file and
because the alternative is to leave a command that silently discards a charted course and then
*reports an arrival that never happened* ("Ye make port at …"), which is a false statement to the
player rather than a matter of taste. It also falsifies the slice B changelog's own claim that
`voyage.abandon` is the only exit from the charted window.

**Verified safe rather than assumed:** every existing test that expects `voyage.port` to be
`accepted` operates on an under-way voyage. `tests/world/encounter.test.ts` was the only candidate
risk — it dispatches `voyage.port` four times and never calls `voyage.sail` — but its `sailingState`
helper sets `phase: 'under-way'` explicitly at `:49`. The other five files all sail first. So the new
guard changes no existing expectation.

This one *does* cost a new refusal reason, `voyage-not-under-way`, the natural counterpart to the
existing `voyage-already-under-way`. That means `packages/sim/src/commands.ts` (union member) and
`packages/view/src/client/log.ts` (message). The message map is typed
`Record<RejectionReason, string>`, so the compiler will refuse to build until the message is written
— the vocabulary cannot drift.

**Rejected alternative — settle the battle inside `abandon()` instead of refusing.** It would avoid
a refusal the player might find obstructive, but it invents a policy the rest of the world does not
have: `port()` refuses in the identical situation, and the sim has exactly one settlement path,
driven by the battle concluding on its own. Making `abandon` a second, implicit settler would widen
the very surface the review flagged. Refusing keeps the two sibling commands consistent.

**Scope for the development stage.** One slice, on the existing branch so PR 15 updates in place —
no second branch, no second PR, no rebase, exactly as the slice A cycle 1 repair did. Both guards
plus a test each, mirroring `tests/world/dispatch.test.ts:415` ("porting out of a running battle is
refused, so the world is never stranded"), which sets `state.battle = createBattle([], false)` and
asserts both the refusal reason and that `state.voyage` survives.

**Unchanged and still not fixable from this branch alone — the CSS merge hazard.** Slice A merged to
`agent/develop` this cycle as `a70a81b`, so the "PR 15 must not merge before PR 14" constraint is
satisfied. But `agent/develop` now carries a `.pp-chart-sail` rule while this branch renames that
control to `pp-chart-confirm` (`view/src/panels/minimap.ts:174`) and defines neither class. The rule
will merge without conflict and then match nothing, and slice A's guard — which only asserts the
substring `.pp-chart-sail {` is present in the file — stays green on the broken state. Whoever
rebases must rename the rule and extend the guard, and confirm by eye, because no automated gate in
this repo can see panel styling. **Deliberately not folded into this fix:** it belongs to the rebase,
not to a `dispatch.ts` guard, and mixing them would make both harder to review.

### 2026-09-04 — independent review, slice B (OPP-20), PR 15

Four lenses over `ae8edbd..35665ca`, cycle 0. **Changes requested on one blocking finding.** The
slice does what this document says it does, and the two things most likely to have gone wrong did
not: the `client.atSea` narrowing (L23) was traced to every one of its readers and is correct at all
four, and the schema-7 migration was checked against a fixture independently reconstructed from the
build rather than against its author's description.

**Blocking — `voyage.abandon` clears the voyage with no `battle-running` guard, and the battle can
then never be settled.** `abandon` (`world/dispatch.ts:90-105`) sets `state.voyage = null` without
the guard its sibling `port` carries twelve lines below (`:119`). `state.battle = null` is written in
exactly one place in the repository, `settleEncounter` (`world/session.ts:40`), and both routes into
it — `stepWorld` (`:10`) and `settleConcludedEncounter` via `concludedEncounterOf` (`:26`) — return
early when `state.voyage === null`. So once the voyage is cleared with a *running* battle standing,
nothing can ever clear that battle: `materialisePlunder` never runs and the winnings are lost, the
brigand hull is never filtered out of `state.ships`, and `client.inBattle` stays true forever, which
leaves `canEnter` permitting only `battle` and `puzzle` — an unrecoverable soft-lock short of loading
another save. `abandon`'s own `settleConcludedEncounter` call (decision L26) is the *concluded* case
and is a no-op for a running one, so L26 is correct and this is a separate, missing guard rather than
a fault in it. Reproduced independently by two lenses through `world.start` → `ship.commission` →
`battle.start` → `voyage.chart` → `voyage.abandon`, which returns `accepted` and leaves the battle
running with no voyage.

Not reachable from the shipped view today, by three separate accidents: encounters spawn only from
`stepVoyage`, which this slice gated on `under-way`; the view's only `battle.start` is the
`sea-battle` opening, which never dispatches `world.start`; and the abandon control is hidden unless
charted. It is reachable through the harness command surface — which *this diff widened*, adding
`voyage.abandon` to `packages/harness/src/commands.ts` — and through a loaded save. Judged blocking
rather than filed: the consequence is terminal state corruption with data loss, the repository treats
the harness as a first-class tested surface rather than a debug backdoor, and the three accidents
protecting it are exactly the kind that evaporate when slice C gives the passage encounters of its
own. The fix is one line copied verbatim from `port`.

**Corrections to the slice B entry above.** Three of its claims are not supported by the code they
describe. They are recorded here rather than edited out, because the register is append-only.

1. "`voyage.abandon` is the only exit from that window" is **false**. `port()` is the one voyage
   command with no `phase` check, and dispatched while charted it is accepted — `route[legIndex]` is
   `route[0]`, the origin island's own point, so it re-sets `atIslandId` to where the pirate already
   stands, nulls the course and reports an arrival for a voyage that never sailed. Benign in outcome
   and unreachable from the UI, so it is filed in `ISSUES.md` rather than returned as blocking, but
   the invariant decision L5 was justified by does not hold at the sim level.
2. The soak suite's "~217s to ~7s … every seed previously charted a voyage that never moved" cannot
   describe this PR's baseline. At `ae8edbd` charting departed immediately; and had voyages truly
   stalled there, `soak.test.ts:210-222` asserts no run is `stuck`, so the suite would have been red
   rather than slow. The figure describes the mid-development build after the phase gate landed but
   before `voyage.sail` was added to the soak harness. The conclusion stands — the test is not
   weakened — but not for the reason given.
3. L27's rationale, that a new rejection reason "is scope this slice was not given", is refuted by
   the slice's own diff, which adds `voyage-already-under-way` and its copy. Filing the empty-helm
   wording may still be the right call on cost; the scope argument is not why.

Additionally, the design's stated requirement to extend `FIELD_KINDS` was correctly dropped —
`FIELD_KINDS` is `Record<keyof WorldState, FieldKind>` and describes top-level fields only, so
`phase`, nested inside `voyage`, is already covered by `voyage: 'an object or null'`. The
implementation is right and the design sentence was wrong; the changelog recorded the action but not
the finding, which leaves a later reader diffing design against code and finding a guard missing with
no explanation.

**What the review verified rather than accepted.** The fixture re-blessing claim was checked by
recomputing the golden's hash from first principles: forcing `schemaVersion` back to 6 in the *new*
state reproduces the *old* declared `stateHash` byte-for-byte, which proves the only semantic change
is the version bump. All three replays changed in hash fields only, and the deliberately-diverged
tick-5 hash in `marker-drift-diverged-at-tick-5.json` was correctly left un-reblessed. Both save
fixtures were reconstructed from the current build and match canonically, so `voyage-under-way-v6`
genuinely predates the change and decision L22 holds in substance — though the test named for that
provenance asserts only shape. The decisions 153/155 audit was re-run rather than trusted: `voyage.chart`
still has exactly one production dispatch site passing `context.playerShip()`, and neither new command
carries a `shipId`, so decision 153 holds for the reason given. Decision 129 is not widened, because
`stepWorld` settles a concluded encounter on the branch *before* it delegates to the phase-gated
`stepVoyage`. No dependency was added, and no assertion was weakened — thirteen tests added, none
removed, and the load-bearing ones were confirmed to fail against `ae8edbd` rather than merely to
pass now.

**A merge hazard between this lineage's two open PRs, carried forward.** Slice B renames
`.pp-chart-sail` to `.pp-chart-confirm`; slice A's cycle 1 repair (`5454fd2`, PR 14) installs a CSS
rule for `.pp-chart-sail`. There is no textual conflict, because slice B is based on slice A at
`ae8edbd`, which predates the repair — but the moment slice B is brought onto the repaired slice A,
that rule matches nothing and the confirm control silently loses its primary styling, which is the
same defect class the repair exists to fix. Slice B has no stylesheet guard to catch it. Whoever
performs that merge must rename the rule and extend slice A's guard to the new class name.
