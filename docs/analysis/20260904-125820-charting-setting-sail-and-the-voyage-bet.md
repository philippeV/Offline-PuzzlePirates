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

### 2026-09-04 — development, slice B merged onto agent/develop (OPP-20)

Integration only. **No sim code was touched** — the abandon guard is correct and proven, and this
slice's behaviour is unchanged. This entry exists because the integration itself carried a defect
that no gate in the repository could see.

**The task asked for a rebase; a rebase is not performable here.** Rebasing a branch that is already
pushed rewrites published history and therefore requires a force-push, which `autonomous-queue` and
`queue-development` both forbid outright. The permitted equivalent was used instead: `agent/develop`
was **merged into** the feature branch, which resolves the same conflicts, makes PR 15 mergeable and
pushes as a fast-forward. It is also this repository's established pattern (`a134c3b`, "merge
agent/develop into slice 5b"). Only the mechanism changed; the substance of the task did not.

**The predicted hazard was confirmed live, and it was worse than the hand-off assumed.** The merge
conflicted in exactly four files — `ISSUES.md`, this document, `minimap.ts` and `minimap.test.ts` —
while **`panels.css` auto-merged with no conflict at all**. Nobody resolving this merge would have
been forced to open the stylesheet. It silently acquired slice A's `.pp-chart-sail` rule, which
after the merge matched nothing, because slice B renders `pp-chart-confirm`. The confirm control
would have shipped unstyled with every gate green.

**Resolutions.** Both documentation conflicts kept both sides in full; the two branches had no
overlapping changelog headings, so nothing was lost and nothing duplicated (13 entries).
`minimap.ts` resolved to HEAD on the merits hunk by hunk: slice B branched **from** slice A's
branch, so both sides already carry slice A's build-once-repaint-in-place refactor identically and
`diff develop head` shows develop contributes nothing HEAD lacks — the resolution preserves slice A's
repaint discipline rather than discarding it (`abandonRow.hidden` is toggled, not rebuilt).
`minimap.test.ts` took HEAD except for slice A's stylesheet guard, which was re-added and rewritten.

**`.pp-chart-sail` renamed to `.pp-chart-confirm`** in `panels.css`. No reference to the old class
survives anywhere in the repository.

**Slice A's guard was replaced, because it stayed green through exactly the rename that breaks the
UI** — it only asserted that the substring `.pp-chart-sail {` still appeared in the file, driven by a
hand-maintained constant. The replacement derives from the rendered DOM instead: it mounts the chart,
walks it through three states, and asserts every `.pp-chart*` rule in the stylesheet is actually
rendered. **Deviation recorded honestly:** this is the *stylesheet → DOM* direction, not the
*DOM → stylesheet* direction the task asked for. The forward direction cannot be made green without
inventing rules for `pp-chart-status`, `pp-chart-course` and `pp-chart-abandon`, which are
structural or default-styled — or without reintroducing the very allowlist being removed. The
consequence, filed in `ISSUES.md`, is that "a new control ships with no rule at all" is still
uncaught. The guard was proved to bite: renaming the rule back makes it fail with
`panels.css styles .pp-chart-sail, which the chart no longer renders`, and restoring makes it pass.

**Verified in a real browser, because this defect is invisible to every other gate.** Dev server on
port 5191 (5178 was already held by another session's server — deliberately not disturbed). Selecting
Doyle Island reveals the confirm control, and its *computed* style carries the rule: border
`rgb(255, 212, 121)`, `linear-gradient(rgb(74, 58, 24), rgb(43, 35, 23))`, weight 600, full width
270.4px. Zero `.pp-chart-sail` nodes in the DOM. Slice A's `.pp-chart-voyage-chosen` also resolves
correctly post-merge (gold background on the selected voyage type). The whole slice B loop then ran:
charting logged "Course set for Doyle Island, 2 leagues", the status became "Yer course be charted.
Set sail at the helm", the abandon control appeared, and abandoning logged "Course struck. Ye bide at
Alkaid Island."

**Gates:** `npm run check` exit 0, **609 pass / 0 fail** — the expected 608 plus the one new guard
test. `npm run smoke` 4 passed with all four baseline PNGs md5-identical; nothing re-blessed. One
TypeScript fix was needed en route, in the new test only: `matchAll` destructuring produced
`Set<string | undefined>` under the repo's strict indexed access, rewritten as `match()` + `slice(1)`.

**A trap worth knowing about, filed in `ISSUES.md`:** the first smoke run reported 4 failures that
had nothing to do with this change. A dev server for the *main* working tree was listening on 5178
and Playwright's `reuseExistingServer` screenshotted that app — including unpushed slice-5b art. It
was proved unrelated by reverting the merge's view changes and re-running to byte-identical failure
counts, then avoided by running on another port under `CI=1`.

### 2026-09-04 — test, slice B repair (OPP-20), PR 15, cycle 1

**Testing passes. No blocking failure.** The guard does what the repair claims, it does not
over-refuse, and the stranding it exists to close is genuinely closed. **PR 15 was deliberately not
merged** — see the merge decision at the end.

Exercised in an isolated worktree at `04df362` with its own `npm install`, not in the main working
tree: that tree is dirty and another live session is editing it, and `node_modules/@opp/*` are
**absolute** symlinks into it, so a shared install would have silently tested `agent/develop` code
rather than this branch.

**Gates, run twice.** `npm run check` exit 0, **608 pass / 0 fail** (24.6s, then 21.1s).
`npm run smoke` 4 passed, and all four `tests/e2e/__screenshots__` PNGs are **md5-identical before
and after** — nothing was re-blessed. The second run of both was taken after the probe work had
restored `dispatch.ts` byte-for-byte, so no mutation window can be mistaken for a clean result.
CI on `04df362` is the single passing `push` run, as expected while the PR is `CONFLICTING`.

**The three physical checks, at the sim/harness boundary.**

- **The guard holds, and both objects survive intact.** `voyage.abandon` against a running battle is
  refused `battle-running`, and `state.battle` and `state.voyage` each **deep-equal** their
  `structuredClone` snapshot — outcome still `running`, berths `[1,2]`, hulls `[1,2]`, brigand
  damage `12345`, `bootyCargoUnits` 700. Proved by structural equality rather than the
  `notEqual(..., null)` the existing test settles for.

- **The battle is still settleable afterwards**, which is the actual point of the fix. Concluding it
  and settling emits `cargo.plundered` for 700 units of pokeweed-berries, takes `bootyCargoUnits`
  700 → 0, strikes the brigand (`hulls [1,2] → [1]`) and clears `state.battle`. **One correction to
  the record:** this path materialises **cargo only**. `bootyPoe` is untouched (0 → 0) — dividing
  poe is `booty.divide`'s job, not settlement's — so "the plunder materialises" should not be read
  as poe moving.

- **The guard does not over-refuse** — the gap the review flagged hardest, defended by no test in
  the repository. **All three** concluded outcomes (`player-won`, `player-lost`, `disengaged`) are
  **accepted**; the voyage clears, the battle clears, the brigand is struck, and the `player-won`
  case emits `cargo.plundered` **inside the accepted result, ahead of `voyage.abandoned`**, proving
  `settleConcludedEncounter` runs within `abandon()`. No regression.

**Mutation check — two mutants, both killed by the probe, both invisible to the suite.** A blanket
`state.battle !== null` guard produces the exact over-refusal; a mutant that refuses correctly while
corrupting `battle.ships` and `voyage.legIndex` fails only on deep equality. **Under both, all 608
existing tests stay green.** That confirms *by execution* the review's non-blocking findings that
neither behaviour is defended today. Both were already filed in `ISSUES.md`; nothing was fixed here.
Stated honestly: the probe's union exhaustiveness was typed, not machine-checked, since node's type
stripping does not typecheck — it was verified by reading the `BattleOutcome` declaration.

**The merge is blocked, and the conflict set is not what the hand-off assumed.** Computed with
`git merge-tree --write-tree --name-only a70a81b 04df362` (merge base `8e016f3e`), the conflicts are
exactly four files: `ISSUES.md`, this analysis document, `packages/view/src/panels/minimap.ts` and
`tests/view/minimap.test.ts`. **`panels.css` auto-merges cleanly and is not among them.** The
hand-off reasoned that "the conflict set does include `panels.css` … so a rebase forces someone to
*open* those files" — it does not. Nobody is forced to open it. It silently gains slice A's
`.pp-chart-sail` rule, which then matches nothing, while the conflicted `minimap.ts` resolves to
`pp-chart-confirm`.

The hazard is also defended less than it looks. Slice A's guard is **two** things: a
stylesheet-substring assertion (`tests/view/minimap.test.ts`, asserts `panels.css` contains
`.pp-chart-sail {`) and DOM assertions querying `.pp-chart-sail`. This branch's own
`minimap.test.ts` has **no stylesheet guard at all** and queries `.pp-chart-confirm`. So the natural
resolution keeps slice A's substring guard — still green, because the rule is present and merely
matches nothing — and takes this branch's renamed DOM queries, also green. Net: every gate green,
the confirm control silently unstyled.

**Decision: the test stage did not rebase, and forwarded a development task for it instead.** The
rebase changes production CSS and markup classes, must rename the rule and extend slice A's guard so
it asserts the invariant rather than a substring, and has a failure mode no automated gate in this
repository detects. Doing it here would put an unreviewed production change straight onto
`agent/develop`, which is what the review stage exists to prevent. Testing passes on the branch as it
stands; the merge waits on that separate, reviewed change.
### 2026-09-04 — analysis, slice A (OPP-19), cycle 1

**Scope.** Only the one blocking finding from the cycle 0 review is re-analysed here: `minimap.ts:155`
toggles `pp-chart-voyage-chosen` and `:167` applies `pp-chart-sail`, while `panels.css` on this branch
defines neither — its `pp-chart` block ends at `.pp-chart-voyage` (`:356`). The nine non-blocking
findings stay in `ISSUES.md` where the review put them, and the sibling-panel 60 Hz defect in
`market.ts`, `location.ts` and `booty.ts` stays there too rather than widening this slice.

**The repair is two CSS rules; the only real question was where to get them.** The naive answer — write
them fresh — and the careful answer turn out to be the same two rules, and the reason is worth
recording, because it also disposes of the duplicate-implementation worry that prompted this cycle.

**Decision L17: slice A takes both rules verbatim from slice 5b commit `53b5dd5`.** Three facts settled
it. First, they are self-contained: both are bare single-class selectors of specificity (0,1,0), with no
compounding, no parent qualification, and no dependency on 5b's flex layout of `.pp-chart`; the only
token either references is `--pp-gold`, defined identically at `panels.css:11` on this branch, on the
`.pp-overlay` scope the chart is mounted inside. Second, `.pp-chart-voyage-chosen` is a character-for-
character copy of `.pp-tab-active` (`:113`), which is this stylesheet's *only* existing expression of a
selected control — and it is driven by the identical pattern, `panels.ts:117-118` setting an ARIA
attribute plus toggling a class that carries the whole visual weight. So verbatim adoption is
simultaneously the answer to "match the surrounding style", not merely the answer to "minimise the
future merge". Third, textual identity means the two implementations converge on these rules instead of
diverging, so when slice 5b reaches a PR the `.pp-chart*` block conflicts nowhere.

The two rules, exactly as they stand at `53b5dd5:packages/view/src/panels/panels.css:367-380`:

```css
.pp-chart-voyage-chosen {
  background: var(--pp-gold);
  border-color: var(--pp-gold);
  color: #201a10;
  font-weight: 600;
}

.pp-chart-sail {
  width: 100%;
  border-color: var(--pp-gold);
  background: linear-gradient(180deg, #4a3a18, #2b2317);
  color: var(--pp-gold);
  font-weight: 600;
}
```

**Verified rather than assumed that they transplant.** This branch builds its buttons with the same
`dom.ts:25-30` helper as 5b, byte-identical, so the markup the selectors must match — `class="pp-button
pp-chart-voyage"` with `pp-chart-voyage-chosen` toggled on, and `class="pp-button pp-chart-sail"` — is
the same on both sides. `.pp-actions` (`:165-170`) is character-identical too, so `width: 100%` on the
confirm control behaves as it does in 5b, the sail row holding that button alone. Placed after
`.pp-chart-voyage` the rules sit later in the sheet than `.pp-button` (`:94`) at equal specificity, so
they override the base recipe as intended. Nothing else in 5b's `pp-chart` block comes with them: its
`display: flex` / `max-height: 48vh` on `.pp-chart` and the matching `min-height` / `overflow` moves are
layout coupled to 5b and are deliberately left behind.

**Decision L18: the duplicate chooser is not reconciled here; the obligation is recorded in `ISSUES.md`
on this branch.** Reconciling would mean touching the divergence between local and
`origin/agent/develop`, which the task guardrails forbid and which has been a standing human decision
for thirteen dispatcher runs. `ISSUES.md` is the right home because it travels with the branch into
`agent/develop`, so whoever brings 5b to a PR meets the note in the repository rather than in a queue
log they have no reason to read. What that entry has to say is narrow and factual: `53b5dd5` already
contains an equivalent chooser — `selectedVoyageType`, `voyageTypeButton`, `setSailButton` — so
`minimap.ts` will conflict in substance even though `panels.css` now will not, and the resolution is to
keep this branch's idempotent-repaint structure, which 5b's rebuild-per-refresh `courseSection` does not
have.

**Decision L19: a one-assertion regression guard goes in with the fix.** The review established that
neither suite could have caught this — the smoke suite screenshots the canvas and never asserts on panel
DOM, and the development stage's live browser check confirmed dispatch while knowing which button it had
clicked. `tests/view/minimap.test.ts` already names both classes (`:69,:113`), so the cheap guard is to
assert that `panels.css` carries a rule for each class the component toggles. It is scoped to these two
names on purpose: `.pp-chart-status` and `.pp-chart-course` are also ruleless, but they are unstyled
containers rather than state the player is meant to see, so a general "every class has a rule" test
would fail for the wrong reason.

**Baseline risk, and what it would mean.** `npm run smoke` should be unaffected, since its screenshots
are of the PIXI canvas and these rules touch only overlay DOM. That expectation is worth treating as a
check rather than an assumption: if a baseline does move, it means the smoke suite captures panel DOM
after all, which would contradict the review's finding and change what the suite is good for. The
development task is told to stop and report in that case rather than re-bless the images.

**Emitted.** One development task,
`20260904-153900-opp19-slice-a-repair-chooser-rendered-state`, against the existing branch
`agent/feature/20260904-132300-opp17-slice-a-chart-is-usable-again` and PR 14. It opens no second
branch: this is a repair to an open PR, not a new slice. Decision L15 stands unchanged and was judged
correct by the review; this cycle only pays the cost it left unrecorded. Note for future readers that
the decision table above stops at L14 and that L15 onward live in changelog prose — a convention this
entry continues rather than fixes.

### 2026-09-04 — independent review, slice A (OPP-19), cycle 0

Four-lens review of PR 14. The core refactor was verified rather than taken on trust: no node a player
can press is re-created on the repaint path, every property the old `cellOf` set at construction is
updated in the repaint, and the cached cells cannot go stale because `LEAGUE_POINTS` and `ISLANDS` are
module constants independent of seed, save and scene. The `hidden` toggling the refactor newly relies on
was checked specifically, since it is the classic way this pattern breaks: `.pp-overlay [hidden]`
(`panels.css:34`) outranks `.pp-actions { display: flex }` and the chart is mounted inside `.pp-overlay`,
so it holds. Rejecting the `marker.drifted` suppression as the fix was the right call. Security,
sim-purity and the `ISSUES.md` cherry-pick all came back clean.

**One blocking finding: the chooser ships with no rendered state.** `minimap.ts:155` toggles
`pp-chart-voyage-chosen` and `:167` builds the confirm control with `pp-chart-sail`; `panels.css` on this
branch defines neither, having only `.pp-chart-voyage` at `:356`. The selected voyage type is therefore
conveyed only by `aria-pressed`, invisible to a sighted mouse user, and `DEFAULT_VOYAGE_TYPE` is
`pillage` (`:23,46`) — so a player who never touches the type row sails a combat voyage that nothing on
screen announced, and a player who does click Trade gets no confirmation it took. This slice replaced
one-click-dispatch, where the type in force was never ambiguous, with select-then-confirm, and shipped
the select half without its visual state. Requirement 1 asks for the chooser *and* the confirm control;
a chooser that cannot show what is chosen half-delivers it.

**Why it happened, which the repair must take into account.** The unpushed local `agent/develop` already
contains this same chooser — `selectedVoyageType`, `voyageTypeButton`, `setSailButton` and the identical
`pp-chart-voyage-chosen` toggle — from slice 5b commit `53b5dd5`, *together with* both CSS rules. The
TypeScript half was carried onto the `origin/agent/develop` base chosen by decision L15; the stylesheet
half was not. Decision L15 itself remains correct — basing on the unpushed local branch would have pulled
another work item's unreviewed art atlas into this PR — but its cost was never recorded: PR 14 and the
unpushed slice 5b work now hold **two independent implementations of the same chooser**, which will
conflict in both `minimap.ts` and the `.pp-chart*` block of `panels.css` whenever 5b reaches a PR. That
reconciliation is a design decision, not a patch, which is why this returned to analysis rather than
being fixed inline.

**Also established, and material to slices B–D.** The 60 Hz clear-and-rebuild is not confined to the
chart: `market.ts`, `location.ts` and `booty.ts` re-create their buttons on the same subscription, so
`Buy`, `Sell`, `Board the ship`, `Disembark` and `Divide the booty` are unpressable by the identical
mechanism. Scoping slice A's fix to the chart was right, but the analysis had recorded the root cause as
a chart problem; it is a panel-deck problem. Filed in `ISSUES.md` with the other eight non-blocking
findings, among them that test 6 cannot fail (optional chaining over a control it never asserts) and
that the changelog's stated reason for test 6 passing against pre-fix code is wrong — the real reason is
that the base had no sail control and its type buttons dispatched directly.

Requirement 5 is confirmed undeliverable on this base, as the development stage honestly stated, with one
correction: of the two forward-compatible lines, `flex: 0 0 auto` is genuinely inert but `overflow-y:
auto` is not — it establishes a scroll container and a block formatting context. No visual change was
observed and no baseline moved, so nothing is broken; the record was simply overstated.

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

### 2026-09-04 — independent review, slice B repair (OPP-20), PR 15, cycle 1

Four lenses over `f0fb4cc` only. **Approved — no blocking findings.** The cycle 0 blocker is closed
and the fix is the right one. Eight non-blocking findings went to `ISSUES.md`.

**The load-bearing claims were re-derived from source, not accepted from the commit message.**

- **L28's placement is correct and sufficient, and the argument is stronger than the changelog
  states it.** `VoyagePhase` is a closed union of exactly two values (`world/state.ts:10`) and
  `.phase` is assigned in exactly one place in the whole of `packages/*/src` — `world/dispatch.ts:82`,
  inside `sail()`. So the pre-existing `under-way` refusal eliminates one of the two phases and
  `charted` is the only phase that ever reached `state.voyage = null`. Separately,
  `pirate.atIslandId = null` is also written in exactly one place, `world/dispatch.ts:83`, the line
  immediately after it — therefore `charted` implies `atIslandId !== null`, and the new guard at
  `:97` **cannot shadow the `not-at-island` refusal below it**. Every pre-existing refusal reason is
  unchanged, which is what the decision claimed. Placing the guard first, by contrast, genuinely
  would change two refusal reasons — so the chosen placement is the strictly safer one, not merely an
  equivalent one.

- **The `running` discriminator is exact, not incidental.** `BattleOutcome` is
  `'running' | 'player-won' | 'player-lost' | 'disengaged'` (`battle/state.ts:9`);
  `concludedEncounterOf` (`world/session.ts:26`) returns null exactly when the outcome is `running`,
  and `settleEncounter` clears `state.battle` unconditionally for all three concluded values. So
  `outcome === 'running'` is the precise complement of "settleable" and there is **no
  concluded-but-unsettled outcome the guard misses** — a blanket `state.battle !== null` guard would
  have been wrong in the other direction, blocking the settle path `abandon()` reaches at `:102`.

- **The fix is complete for its class.** `state.voyage` is assigned at exactly three sites
  (`dispatch.ts:58, 103, 130`); `charter()` refuses outright if a voyage already runs, and both
  clears are now guarded and both call `settleConcludedEncounter` first. `state.battle = null` exists
  at exactly one site in the repository, `world/session.ts:40`. Nothing in `packages/view` or
  `packages/harness` writes either field. No unrecorded stranding path was found.

- **The L29 revert is complete.** `f0fb4cc` is three files, **69 insertions and zero deletions** —
  the zero proves no rename, reformat or tidy-up rode along. `packages/sim/src/commands.ts` and
  `packages/view/src/client/log.ts` have **no diff hunks at all**, and `voyage-not-under-way` has
  **zero occurrences anywhere outside `docs/`**, where it survives only as the prose recording the
  withdrawal. `REFUSALS` is typed `Record<RejectionReason, string>`, so an orphan in either direction
  would fail the build; union and map are at exact parity. No trace leaked.

- **The test is a genuine guard, proved by execution, not by reading.** With the guard line deleted
  the new test fails and the pre-fix behaviour is visible in the assertion output — the abandon is
  *accepted* and the voyage cleared with the battle still running — while the other 24 tests in the
  file still pass. This lineage had reason to check: slice A's cycle 1 review found a guard that
  stayed green against five reintroductions of its own defect. This one is not that.

**What the review found that the development step had not recorded**, all filed as non-blocking:
the guard's outcome discriminator and L28's placement are each pinned by **no** test (both mutations
leave 608/608 green), the new test's `notEqual(..., null)` assertions survive a mutant that refuses
correctly while corrupting both the battle and the voyage, and the soak driver — which asserts that
battles resolve — never dispatches `voyage.abandon` at all, which is why nothing caught the cycle 0
blocker earlier.

**One correction to the record.** The changelog entry below overstates the defect it repairs, and it
should not be used to triage the still-open `port()` gap. It says the strand was permanent, plunder
lost, and `inBattle` stuck true; none of the three holds. `inBattle` is computed as
`outcome === 'running'` (`view/src/client/client.ts:82`), so it goes false the moment the battle
concludes and the view returns to `deck` (`:165`); `charter()` has no battle guard and `abandon()`
leaves the pirate in port, so a new chart is always reachable; and once a voyage exists again the
next tick settles the stale battle and materialises the plunder **late rather than never**. The cost
was a bounded window — phantom brigand hull, encounter spawning suppressed — which is the same shape
already recorded for the `port()` variant. The fix remains correct; only its stated severity was
wrong.

**Gates confirmed rather than assumed**, from cold in a clean worktree: `npm run check` exit 0,
**608 pass / 0 fail**, run twice with identical results and no `purity.test.ts` flake; `npm run smoke`
4 passed with all four baseline PNGs md5-identical before and after, so nothing was re-blessed. The
single CI check on `f0fb4cc` is the `push`-triggered run; the `pull_request` run cannot fire while
the PR is `CONFLICTING`, and that is expected rather than missing coverage.

**States noted, not treated as defects in this diff:** PR 15 remains `CONFLICTING` against
`agent/develop` and was deliberately not rebased; the `.pp-chart-sail` → `pp-chart-confirm` CSS
hazard remains live and is not fixable from this branch; the `port()` phase gap remains open and
filed. None is a finding against `f0fb4cc`.


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
### 2026-09-04 — development, slice A repair (OPP-19), cycle 1

The cycle 1 analysis had already settled every question, so this stage installed its three decisions
and verified them rather than re-deriving anything.

**L17 — the two rules are in.** `.pp-chart-voyage-chosen` and `.pp-chart-sail` were taken from
`53b5dd5:packages/view/src/panels/panels.css:367-380` and placed immediately after `.pp-chart-voyage`.
Byte-identity was checked by diffing the installed block against `git show` of the source rather than
by eye: the diff is empty.

**L19 — the guard is in, and it was proved to fail without the fix.** `tests/view/minimap.test.ts`
asserts `panels.css` carries a rule for each of the two classes the component toggles, scoped to
exactly those two names. Reverting only the stylesheet and re-running produced
`panels.css carries no rule for .pp-chart-voyage-chosen, so the chart toggles a class that draws
nothing` — so the guard genuinely closes the hole the review found, rather than passing vacuously.

**L18 — the obligation is recorded** in `ISSUES.md`, naming `53b5dd5`'s equivalent chooser and
stating that the resolution is to keep this branch's idempotent-repaint structure, because 5b's
`courseSection` rebuilds per refresh and adopting it would reintroduce the very defect slice A fixes.

**Confirmed by eye, which is what made this blocking.** Before any voyage type is clicked, `pillage`
— the silent default at `minimap.ts:23` — now renders filled `--pp-gold` with `#201a10` text at
weight 600, while `trade` and `evade` keep the plain `--pp-raised` recipe at weight 400. Clicking
`trade` moved the gold to it and returned `pillage` to plain. `Set sail` renders full width
(270.4px, the whole row) with a gold border and gold text at weight 600, so it reads as the primary
action rather than a fourth peer of the three type buttons. Computed styles were read back to confirm
the screenshot: chosen `rgb(255, 212, 121)` on `rgb(32, 26, 16)`, unchosen `rgb(43, 35, 23)` on
`rgb(232, 226, 208)`. The gradient shows as a transparent `background-color` because it lives in
`background-image`; that is expected and not a defect.

**The baseline risk resolved the way the analysis predicted.** `npm run smoke` passed with
`tests/e2e/__screenshots__` untouched, confirming the review's finding that the suite screenshots the
PIXI canvas and never captures panel DOM. Nothing was re-blessed and nothing needed to be.

**Verification.** `npm run check` green, 591 tests. `npm run smoke` 4 passed, baselines untouched.

**Discovered, and it affects slice B rather than this repair.** Slice B renames `pp-chart-sail` to
`pp-chart-confirm` (its confirm button charts a course; departure moved to the helm). This repair
correctly styles `.pp-chart-sail`, which is the class on *this* branch — but once slice B is brought
onto the repaired slice A, that rule will match nothing and the confirm control will lose its primary
styling, silently, exactly as it was lost the first time. Slice B's own `STATEFUL_CHART_CLASSES`
guard will not catch it either, because slice B did not add one. Whoever merges the two must rename
the CSS rule alongside the class and extend the guard. Recorded here rather than pre-emptively fixed:
this branch has no `pp-chart-confirm` to style, and slice B is a separate open PR.

### 2026-09-04 — physical test, slice A repair (OPP-19), cycle 1

**Passed. Merged to `agent/develop`.** The repair does on screen exactly what it claims.

This stage mattered more than usual here: no automated suite in the repo can see this fix. The unit
tests never load the stylesheet, and the Playwright suite screenshots `#stage canvas`, a sibling of
`#panels`, so no panel DOM ever enters a baseline — which is precisely how the original defect
shipped. Everything below was observed in a real browser at `http://localhost:5178/?seed=12648430`,
with computed styles read back to corroborate each screenshot rather than trusting the image.

**The pre-click default state — the load-bearing case — is correct.** On first opening the chooser
(click any island other than the pirate's own; the chart panel itself is already mounted at cold
load), `pillage` is visibly chosen with nothing yet clicked:

| Button    | `background-color`   | `color`            | `font-weight` | `aria-pressed` |
| --------- | -------------------- | ------------------ | ------------- | -------------- |
| `pillage` | `rgb(255, 212, 121)` | `rgb(32, 26, 16)`  | 600           | `true`         |
| `trade`   | `rgb(43, 35, 23)`    | `rgb(232, 226, 208)` | 400         | `false`        |
| `evade`   | `rgb(43, 35, 23)`    | `rgb(232, 226, 208)` | 400         | `false`        |

That is `--pp-gold` filled with `#201a10` text against the plain `--pp-raised` recipe, exactly as the
review predicted. The silent default is no longer silent.

**Transitions are correct on every step, driven with a real pointer** rather than a synthetic
`.click()`. Clicking `trade` moved the gold to `trade` and returned `pillage` to plain; clicking
`evade` did the same again. Exactly one button carried `aria-pressed="true"` at every observation —
the radio invariant holds.

**`Set sail` reads as the primary action, not a fourth peer.** Measured `270.4px` wide against
`270.4px` for its row — full width — while a voyage-type button is `58.9px`. Gold border
(`rgb(255, 212, 121)`), gold text, weight 600. Its `background-color` computes to `rgba(0, 0, 0, 0)`
because the gradient lives in `background-image`
(`linear-gradient(rgb(74, 58, 24), rgb(43, 35, 23))`); that is the expected shape and not a defect.

**Two checks beyond the brief, both clean:**

- **The chosen state survives the repaint.** After 2.5s of the client's 60 Hz refresh, and again
  after changing destination island, `evade` was still gold and still the only chosen button. The
  idempotent-repaint structure this branch was originally about holds under the new rules.
- **The highlight is truthful, not decorative.** With `evade` chosen, `Set sail` produced a voyage
  carrying `type: 'evade'` and the log line "Course set for Sayers Rock, 4 leagues." The gold marks
  the state the sim actually receives.

**The original subject of the branch has not regressed.** A real pointer press and release on a grid
island cell still lands on the same element and synthesises a click — the 60 Hz repaint that made the
grid unclickable is gone. Selecting Sayers Rock re-titled the course and recomputed it to 4 leagues.

**Gates, run from cold in a clean worktree at `ec6d600`:**

- `npm run check` — **exit 0, 591 pass / 0 fail**, all six gates, 20.9s.
- `npm run smoke` — **4 passed**. Baselines **untouched**: all four `__screenshots__` PNGs are
  md5-identical before and after, and the working tree is clean. Nothing was re-blessed.

The `tests/gates/purity.test.ts` child-spawn flake recorded in `ISSUES.md` did **not** fire, at 518 MB
free physical and 86 `node.exe` processes. Worth recording because it settles a reporting gap
`ISSUES.md` raised against this very commit: the changelog's "591 tests" is confirmed on this machine,
so the earlier `580/1` was the flake shape and not a different suite. The blanket claim that this box
cannot run its own gates remains withdrawn.

**Nothing blocking was found, so nothing goes back to analysis.** The seven non-blocking findings
already in `ISSUES.md` stand, including the substring-matching guard; none were re-raised here.

**Carried forward, still not fixable from either branch alone.** Slice A is now on `agent/develop`
with `.pp-chart-sail` styled. Slice B renames that class to `.pp-chart-confirm` and is based on
`ae8edbd`, which predates this repair, so there is still no textual conflict — the rule will simply
stop matching and the confirm control will silently lose its primary styling. Whoever brings slice B
onto the repaired slice A **must** rename the rule and extend the stylesheet guard. The guard asserts
a substring in `panels.css` and was proven not to catch exactly this rename, so it will not warn.

### 2026-09-04 — independent review, slice A repair (OPP-19), cycle 1

Four lenses over `5454fd2` alone; `ae8edbd` and earlier were passed at cycle 0 and were not
re-reviewed. **Approved — no blocking findings.** Forwarded to the test stage.

**The blocking cycle 0 finding is genuinely closed.** Verified rather than accepted:

- **L17's byte-identity claim holds.** Both rule blocks were extracted from
  `53b5dd5:packages/view/src/panels/panels.css` and from `5454fd2` and compared as UTF-8 bytes —
  identical through indentation, property order, colour literals, gradient argument spacing and
  trailing whitespace. The cited source range `:367-380` is also correct.
- **The rules actually select the elements the component classes.** `dom.ts:25-30` builds every
  button as `pp-button <className>`; the three voyage buttons carry `pp-chart-voyage` plus the
  toggled `pp-chart-voyage-chosen`, and Set sail carries `pp-chart-sail`. All selectors are
  specificity (0,1,0), so source order decides, and both new rules sit after `.pp-button` (`:94`) and
  `.pp-chart-voyage` (`:356`) — correct. `.pp-chart-voyage` sets only `text-transform`, so there is
  no property collision at all. The two higher-specificity button rules in the file are scoped to
  `.pp-td`, which `minimap.ts` never creates.
- **No element can carry both new classes**, so the `background` shorthand cannot collide:
  `paintVoyageTypes` iterates only `voyageTypeControls`, and the sail button is never in that map.
- `--pp-gold` and `--pp-raised` are declared on `.pp-overlay` and genuinely inherit into the chart.
  Contrast is 12.3:1 for the chosen button and 7.8–11.0:1 across the sail gradient — all AAA.
- **No regression anywhere.** Both class names occur only in `minimap.ts`, `panels.css`,
  `minimap.test.ts` and prose; no class name is dynamically constructed with a `pp-chart-` prefix;
  `panels.css` is 15 insertions and 0 deletions, a pure insertion. Baselines cannot move, because
  the smoke suite screenshots `#stage canvas` and `#stage` is a sibling of `#panels`.
- **Every class the component emits was inventoried against the stylesheet.** Only `pp-chart-status`
  and `pp-chart-course` lack rules, and the "deliberately unstyled container" claim was checked
  rather than accepted: both are plain divs created and appended once, never toggled, hidden or
  conditionally classed, so neither encodes state, and their children carry their own styling. There
  is no state of the chooser in which the defect survives.
- **The guard is not vacuous.** `9ea910b`'s stylesheet contains neither class name, so reverting
  only the CSS fails at the first entry with exactly the message the changelog quotes.
- Scope was exactly the one blocking finding: four files, additions only, and three known
  non-blocking defects in the very test file being edited were correctly left alone.
- No dependency movement, no `eval`/dynamic import/`innerHTML`, and no `url()`, `@import` or
  `@font-face` anywhere in the stylesheet. The test's `fileURLToPath(new URL(…, import.meta.url))`
  is cwd-independent and is the established idiom in eight other test files; the repo's purity gate
  is scoped to `packages/sim/src/**` and gate fixtures, not to test hermeticity — it performs
  filesystem I/O and spawns processes itself — so the new read violates nothing.

**The principal non-blocking finding, recorded because it will matter soon.** The guard asserts that
the string `.<class> {` appears in `panels.css`, where the invariant that broke is "the chosen
voyage renders differently from an unchosen one". Five reintroductions of the original defect were
confirmed **by execution** to leave it green: an empty rule, a commented-out rule, a rule stripped to
an irrelevant declaration, a later equal-specificity `.pp-chart-voyage` override that computes the
chosen button back to the unchosen appearance, and a rename of the class in the component with the
stylesheet untouched. The last is the one that matters: this commit's own changelog records that
slice B renames `pp-chart-sail` to `pp-chart-confirm` and that this guard will not catch it. So the
repair ships with a written admission that its guard does not survive the next merge, against the
defect it exists to prevent.

Judged not blocking under the contract's test — the fix itself is correct, CI is green, and
returning a cycle for test quality is precisely the loop the queue is built to avoid — but the guard
should be re-pointed before slice B lands. Two mechanisms are already within reach and about the
same size: injecting `panels.css` into the `<style>` of the happy-dom `Window` the test file's
`before()` hook already builds and comparing computed styles between a clicked and an unclicked
button (the cascade was verified to resolve correctly under happy-dom 20.14.0 in this repo), or a
`tools/check-view-state-classes.ts` alongside `check-view-boundary.ts` deriving the class list from
`classList.toggle('pp-…')` literals, which would cover all five conditionally-toggled classes rather
than two. Related and recorded with it: `STATEFUL_CHART_CLASSES` is misnamed, because
`pp-chart-sail` is applied once at construction and is not toggled at all.

**A correction to L17 and to the `ISSUES.md` entry L18 required.** Both claim the `.pp-chart*` block
will not conflict when slice 5b reaches a PR — L17 says it "conflicts nowhere". Diffing the whole
`.pp-chart {` to `.pp-chat {` region between `53b5dd5` and `5454fd2` leaves four divergences inside
that exact block: `.pp-chart` (`display: flex` / `max-height: 48vh` against `overflow-y: auto`),
`.pp-chart-grid` (`min-height: 0; overflow-y: auto` against `flex: 0 0 auto`), `.pp-chart-choice`
(`flex: 0 0 auto` on 5b only) and `.pp-cell-island:disabled` (here only). The true claim is the
narrower one: *the two new rules* will not conflict. Whoever merges 5b will hit a `.pp-chart*`
conflict regardless. Separately, that entry was appended at the bottom of `ISSUES.md` under a
heading belonging to PR 12, against the file's own newest-first rule.

**The merge hazard is confirmed from this side too**, and is now recorded on both branches, in both
PRs and in this document. Slice B renames `.pp-chart-sail` to `.pp-chart-confirm`; this repair
correctly styles `.pp-chart-sail`, the class on *this* branch. Neither branch is wrong alone and
there is no textual conflict, because slice B is based on slice A at `ae8edbd`, which predates this
repair. Whoever brings slice B onto the repaired slice A must rename the rule and extend the guard,
or the confirm control silently loses its primary styling.

### 2026-09-04 — independent review, integration merge (OPP-20), PR 15, `18b937a`

Four lenses over the merge commit only. **No blocking findings. Forwarded to the test stage.**
Reviewed by a different run from the one that authored `18b937a`, so independence holds.

**What was verified from source rather than accepted from the hand-off.** The merge's own record is
accurate on every checkable claim. `packages/sim/**` is untouched: the combined diff (`git show --cc`)
is *identical* to `diff 2c24ad2..18b937a`, 656 insertions and 0 deletions across exactly `ISSUES.md`,
this document, `panels.css` and `tests/view/minimap.test.ts`. The minimap crux resolves in the
merge's favour — `diff a70a81b..18b937a` on `minimap.ts` is purely additive slice B work plus the
`setSailButton` → `chartCourseButton` rename; build-once (`minimap.ts:49,53`) and repaint-in-place
(`paintGrid` mutating via `classList.toggle`, no `clear(grid)`, no `drawGrid`) both survive, so no
player-clickable node is destroyed by a tick. The check was widened past what the task asked: **all
nine files `agent/develop` changed since the base are byte-identical to develop in the merged tree**,
so nothing was dropped anywhere, not only in `minimap.ts`. The test set is the exact union of both
parents (7 + 8 → 9), `git diff --diff-filter=D` is empty against both, and there are no conflict
markers. The changelog carries 14 dated entries, the two shared ones appearing once each; `ISSUES.md`
lost zero lines from either parent.

**Corrections to the task's own framing, recorded because the next stage inherits it.** The task
names four conflicted files including `minimap.ts` and excluding `panels.css`. The true combined diff
is the inverse: `minimap.ts` is absent (resolved to a parent verbatim) and `panels.css` is present
(hand-edited). This confirms the correction the first, later-reaped review attempt had already made.

**The one finding worth the human's attention, non-blocking.** The replacement guard dropped the
`DOM → stylesheet` assertion its parent had, and the rationale recorded for that is overstated: the
defect being fixed was the *substring* check, not the hand-maintained allowlist. A converse assertion
narrowed to classes applied via `classList.toggle` — today exactly one — is principled, not an
allowlist. Deleting the `.pp-chart-voyage-chosen` rule today fails the old guard and passes the new
one. Judged non-blocking because the production stylesheet is correct as it stands, so what was lost
is guard strength rather than behaviour. Filed in `ISSUES.md` with the narrower assertion as the
suggested follow-up, alongside three further blind spots (the `pp-cell*`/`pp-here-mark` classes the
`pp-chart` prefix does not cover and which no test references at all; `app.css` never being scanned;
the raw-text regex treating a `.pp-chart` in a CSS comment as a phantom rule) and the test title that
now asserts the opposite of its body — itself a half-addressed prior finding.

**The stylesheet → DOM deviation is accepted as-is.** It is a genuine behavioural test rather than a
tautology: it reads the shipped stylesheet from disk and drives the real `createMinimap`, comparing
two independently produced sets. It demonstrably catches the defect that actually reached the
pipeline, where the substring check could not. Its limits are recorded honestly by the merge itself.

**Environment note for the next stage.** The *local* ref
`agent/feature/20260904-132301-opp17-slice-b-charting-and-setting-sail` is stale at `04df362`; the
merge lives on the remote at `18b937a`. This review committed from a detached worktree and pushed
`HEAD:` to the branch. Anyone checking that branch out locally must fetch first or they will silently
work on a tree that predates the merge. The stale ref was deliberately left alone rather than
force-updated, because another live session is working in this repository.

## 2026-09-05 — test stage, integration merge (OPP-20), PR 15, head `2fee216`

Physical test of the slice B integration merge. **No blocking failures. PR 15 merged into
`agent/develop`.** Tested `2fee216` (the review's docs commit on top of merge `18b937a`), in an
isolated detached worktree with its own `npm install`, after confirming every `node_modules/@opp/*`
symlink resolved into that worktree rather than the main one — otherwise the run would have been
testing the main checkout's code instead of the branch.

### The gates, from cold

- `npm run check` — exit 0, **609 tests, 609 pass, 0 fail**. The count matches the claim (608 plus
  the new stylesheet guard).
- `npm run smoke` — **4 passed**, and the four baseline PNGs are md5-identical before and after, so
  nothing was silently re-blessed.

Port 5178 was in fact squatted by another session's dev server during this run, and
`packages/app/vite.config.ts` sets `strictPort: true`, so the documented trap was live rather than
theoretical. It was avoided **without editing any committed file** — an untracked
`pw.isolated.config.ts` on port 5191 with `reuseExistingServer: false`, deleted afterwards. The
previous stage edited `vite.config.ts` and had to revert it; there is nothing to revert this way.

### What was exercised in a real browser

The two acts are genuinely separate, which is the whole point of the slice:

- **Charting leaves the ship moored.** After *Chart course*: `phase: 'charted'`, `route: [1,2,8]`,
  yet `pirate.atIslandId` is still `alkaid`, `atSea` is `false` and the scene is still `port`. Log
  line `Course set for Doyle Island, 2 leagues.`; status reads `Yer course be charted. Set sail at
  the helm.`
- **Departure only happens at the helm.** *Set sail* was clicked as the actual control — the Pixi
  radial spoke on the Navigation station in the `deck` scene, by canvas coordinate, not by
  dispatching the command — because the control has no DOM selector and a dispatched command would
  not have proved the control exists. Result: `Lines cast off, bound for Doyle Island.`,
  `phase: 'under-way'`, `atSea: true`, `atIslandId: null`.
- **A charted course can be abandoned.** *Abandon course* from the charted state gives
  `Course struck. Ye bide at Alkaid Island.`, clears the voyage to `null`, and leaves the pirate
  ashore at Alkaid in the port scene. The control is visible only while `phase === 'charted'`.
- **The lifecycle guards hold.** Abandoning or sailing again while under way are both refused with
  `She be under way already.`, and the voyage is left intact rather than corrupted.
- **Decision L12 holds visibly.** Alkaid's own chart cell renders with `pp-cell-here` and
  `disabled: true` — offered-but-refused was genuinely replaced by not-offered.

### The defect the merge exists to repair, confirmed in the browser

`.pp-chart-confirm` computes `border: 0.8px solid rgb(255, 212, 121)` and
`background-image: linear-gradient(rgb(74, 58, 24), rgb(43, 35, 23))` on the rendered control, at
270px wide, weight 600. This is the one thing every gate stayed green through while the UI was
broken, so it was checked on the live element rather than in the stylesheet.

`.pp-chart-voyage-chosen` was checked by eye and by computed style, because the replacement guard
cannot speak for it: the chosen option is gold-filled (`rgb(255, 212, 121)`, weight 600) against
`rgb(43, 35, 23)`/weight 400 for the unchosen ones, and the marker **moves** — clicking `trade` took
the class and the styling off `pillage` and put it on `trade`, with exactly one chosen at a time.

### Backward compatibility, which the task did not ask for

The task listed four checks; the analysis document's own "done when" for slice B also requires
departure from the helm and that existing saves still load, so both were tested. Loaded through the
real Ye-panel path (`.pp-save-text` + *Load game*), not by calling the sim directly:

- `voyage-under-way-v6.json`, a genuine pre-slice save with **no `phase` key**, restores as
  `schemaVersion: 7` with `phase: 'under-way'` and `route`, `legTicks`, `type` and `shipId` carried
  through verbatim — decision L4 behaving exactly as written.
- `voyage-charted-v7.json` stays `charted` and moored at Alkaid.

### Non-blocking findings, filed in `ISSUES.md`

Three, all proven by execution rather than inferred from source. A v6 voyage with an empty `route`
loads and migrates into an un-abandonable, un-advancing "under way" state — unreachable from
`chartVoyage` and no worse than before the slice, so not blocking. A v6 save with the `voyage` key
omitted is refused rather than migrated, and the client rolls back safely. And `COMMITTED_SAVES` in
`tests/sim/save.test.ts` was never extended with the two fixtures this slice added, so they skip the
guard sweep.

### One correction to the hand-off

The task predicted `legTicksRequired: 25200` for the first leg. The running game reports **5040** —
the seeded sloop has speed 9 of 10, not the 0 the estimate assumed. Nothing depends on it; recorded
so the next stage does not read 5040 as a regression.

### Environment

The stale local ref noted by the review is still stale and was again left alone; this stage worked
from a detached worktree and pushed `HEAD:` to the branch. Session note: this run was suspended for
roughly 23 hours mid-test and resumed on 2026-09-05. The claim was re-verified as unreaped and the
PR head re-checked as unchanged at `2fee216` before anything was merged, so no result reported here
was carried over from a tree that had moved.

## 2026-09-05 — development, slice C (OPP-21), the passage is a place

Slice C implemented on `agent/feature/20260904-132302-opp17-slice-c-the-passage-is-a-place`, branched
from `agent/develop` at `c25a2a5` — slice B had reached `agent/develop` earlier the same run, so the
task's first branching option applied.

**Repository note, recorded because `queue-development` step 2 assumes otherwise:** this repository
has **no `develop` branch**. The remote carries `main` and `agent/develop` only. There is therefore
nothing to sync `agent/develop` from; it is already the integration base, and `main` was not touched.

### What was built

A `sea` scene (decision L7) drawn from nothing but the existing `water` tile and `sloop` prop
(decision L8) — `packages/view/src/iso/atlas.ts` was not edited. The ship's place on the passage is
`legTicks / legTicksRequired` and nothing else (decision L9), so there is no second source of truth
for where the ship is; a new `sea` opening charts and sails so `?scene=sea` has a voyage to draw.

**The player is the ship at this scale.** `createIsoScene` always draws an avatar at the tile the
camera is anchored to, and a pirate figure standing on open water would be wrong. Rather than build a
parallel scene, `IsoSceneDefinition` gained two optional fields — `avatarArt` and `follow` — so a
scene may name the art its avatar is drawn with and re-derive its position each frame. The sea scene
sets `avatarArt: 'sloop'` and follows leg progress; every other scene is untouched, both fields being
optional. This also makes the camera track the voyage for free.

### Three defects found by running it, not by reading it

- **The opening silently did nothing.** The first implementation hardcoded the charted `shipId` to
  `1`, on the reasoning that the player sloop is the first hull commissioned. It is entity **2**, so
  `voyage.chart` was refused — and because `GameClient.create` clears the log after the opening, the
  refusal was invisible: `?scene=sea` would have rendered an empty sea with no error anywhere. The id
  is now derived from the player hull (`openingVoyageCommands`), mirrored in `reset`, and pinned by a
  test that fails loudly if the opening ever stops leaving port.
- **Sailing revealed the edge of the world.** `camera.keepVisible` pans once the ship nears the
  viewport margin, and at 95 % of a leg the first grid (24×18, later 40×32) left dark void beside the
  water. The grid is now sized from the iso projection so a 972×720 viewport stays on water for the
  whole course: an iso diamond only covers the viewport when `SEA_WIDTH + SEA_HEIGHT >= 78`, hence
  52×44 with the course centred on the diamond. Verified in a browser at both ends of a leg.
- **A stranding that was not one.** After `voyage.port` the scene appeared stuck on `sea`. It is not:
  `syncScene` runs on `advance`, and the sim clock was simply not running, because requestAnimationFrame
  is paused while the browser pane is hidden. One tick returns the player to the deck. Recorded
  because it looked exactly like a blocking defect and is not.

### Deviation, deliberately not taken

An earlier edit also sent a player whose battle ends while still at sea back to the passage rather
than the deck. Concluding a battle in a test needs the disengage counter to run down, and shipping an
untested behaviour change outside this slice's scope is worse than leaving it, so that line was
reverted to its original `'deck'`. A player at sea who finishes a battle lands on their deck exactly
as before. Worth revisiting when slice D gives battles at sea a natural home.

### Determinism of the `sea` baseline, declared rather than discovered later

Decision L13 asks for the baseline to be taken deliberately. Two things in the `sea` frame genuinely
move between runs, and neither is noise:

- The chart panel is mounted in **every** scene, and while under way it renders a live tick counter
  and progress bar (`94/25200` in the blessed frame). Those digits will differ on the next run. The
  existing four baselines are unaffected because all four are taken with `voyage === null`.
- The ship drifts roughly 2.7 px/s between mount and capture, as the rAF ticker keeps advancing
  through Playwright's own screenshot settling.

Both are far inside the project's existing `maxDiffPixelRatio: 0.01` — order a few hundred pixels
against roughly 9 200 of slack — so the baseline holds. The threshold was **not** widened. The smoke
voyage uses `voyageType: 'evade'`, whose encounter chance is structurally zero, so no brigand can
hijack the scene into `battle` mid-capture.

### Verification

`npm run check` 622 passing, 0 failing, from cold in an isolated worktree. `npm run smoke` 5 passed;
the four pre-existing baselines are md5-identical before and after, so only `sea.png` is new.

## 2026-09-06 — independent review of PR 16 (slice C, OPP-21): four blocking findings

Reviewed at head `5d35a9e` against `agent/develop` at `c25a2a5` (merge-base equals the base head, so
no drift). PR `MERGEABLE`/`CLEAN`, both CI check runs green. Four lenses were run as separate
subagents; every finding below was then re-verified against the code by hand, because two lenses
reached **opposite** conclusions from the same files and one of them was wrong.

### The contradiction, resolved, because it decides the fix

One lens reported "the sea scene is unreachable in normal play"; another reported the mirror image,
"the deck becomes unreachable for the whole voyage". Both cannot hold. Resolved by grep rather than
by argument:

- No `enter-scene` intent anywhere targets `'sea'`. The complete set on this branch is `deck`
  (`battle.ts:294`, `port.ts:47`), `puzzle` (`deck.ts:58`), `port` (`deck.ts:108`) and whatever
  `puzzle.ts:420` computes — never `sea`.
- `voyage.sail` is dispatched from exactly one place in the whole view layer:
  `packages/view/src/scenes/deck.ts:90`, the helm's `SAIL_ACTION` — a prop in the **deck** scene.

So the first lens was right and the second was inverted. The correction matters for the repair: the
deck is not the thing that becomes unreachable, the sea is.

### B1 — the sea scene cannot be reached by playing the game

`syncScene`'s new line is `if (this.atSea && this.current === 'port') this.current = 'sea';`
(`packages/view/src/client/client.ts:182`). It is the only transition into `'sea'` in the tree. To
set sail the player must already be standing at the helm, which is on the deck, so at the instant
`atSea` flips true `current` is `'deck'` — never `'port'` — and the guard never fires. The location
panel states the intended flow itself: *"Chart a course on the map, then set sail at the helm."*

The player therefore sails the entire passage looking at the deck, exactly as before this slice. The
only way into the new scene is the `?scene=sea` URL, which is how every test and the smoke baseline
reach it. This is the same failure shape as the `shipId: 1` defect the development stage caught and
recorded — the feature works on the test path and not on the player path — and it is why the tests
all pass: `tests/view/sea.test.ts` and `loop.test.ts:117` reach `'sea'` by dispatching `voyage.sail`
while `current === 'port'`, a state the UI cannot produce.

Note for whoever repairs it: once the scene *is* reachable, there is no control that leaves it. At
sea the location panel offers only `Port`; "Board the ship" is gated on `atIslandId !== null`. So the
repair has to add both the way in and a way back to the deck, or the bilging station, the helm and
`voyage.abandon` become unreachable for the duration of a voyage.

### B2 — on arrival the ship teleports back to the start of the course

`legProgressPerMilleOf` treats `legTicksRequired <= 0` as "no progress" and returns 0
(`scenes/sea.ts:30`), which `berth()` renders as `COURSE_START`. On the tick that completes the final
leg, `stepVoyage` sets `legTicks = 0`, increments `legIndex` to `route.length - 1`, and recomputes
`legTicksRequired = legTicksRequiredOf(ship, orientationCostOf(route, legIndex))`
(`packages/sim/src/world/voyage.ts:71-74`). `orientationCostOf` reads `route[legIndex + 1]`, finds
`undefined`, and returns `0` (`voyage.ts:92-94`); `legTicksRequiredOf(ship, 0)` is
`Math.floor(seconds * TICKS_PER_SECOND * 0 / PER_MILLE)` = **0** (`voyage.ts:23-29`).

So the moment the ship arrives it jumps from ~1000‰ back to tile `{21, 26}` and parks there — camera
following — while the heading still reads "Bound for Doyle Island" and the panel says *"Port her once
the last league be astern."* The player is told they have arrived and shown a ship that never left.
It persists until they press `Port`, because `stepVoyage` then bails permanently on
`legIndex >= route.length - 1`. The divide-by-zero guard is correct as a guard and wrong as a
rendering answer: "no leg" and "no progress" are not the same state.

`tests/view/sea.test.ts:94-107` drives the client into exactly this state and asserts the scene and
the island, never the position.

### B3 — the "edge of the world" fix is ineffective, and the committed baseline proves it

The development entry above states the grid *"is now sized from the iso projection so a 972×720
viewport stays on water for the whole course"*, verified in a browser at both ends of a leg. It is
not. Decoding `tests/e2e/__screenshots__/sea.png` straight out of the object store and counting
pixels exactly equal to `BACKDROP = 0x0a1622`:

```
backdrop-exact pixels within the 972-wide stage: 576
bounding box: x 0-51, y 694-719
corners: TL water(47,111,159)  TR water  BR water  BL BACKDROP(10,22,34)
```

The blessed baseline contains the void, in the bottom-left, at the *start* of the leg — the frame was
taken ~94 ticks into 25 200, essentially at `COURSE_START`. The smoke passes because the defect was
photographed and blessed, not because it is absent.

The recorded derivation is also the wrong shape. `SEA_WIDTH + SEA_HEIGHT >= 78` is a **sum**
condition, and the requirement is per-axis: a sum is equally satisfied by a degenerate 70×8 grid that
would be almost all void. The camera is also centred on the *ship*, not on the diamond, so the
binding case is the ship at a course endpoint, not the diamond's extent. `52` and `44` happen to
satisfy the per-axis form on one axis and not the other. The corrected constraint and the resulting
constants are left to the analysis stage rather than asserted here; what is established is that the
current rule cannot be the right one and the current constants leave visible backdrop.

### B4 — the analysis document overstates what was verified

B3's claim is recorded as verified in a browser at both ends of a leg, and the artefact committed in
the same breath falsifies it. Recorded not to score a point but because the next agent will otherwise
trust the same sentence. The rest of the development entry held up well under checking — the
`shipId` defect, the false stranding, the deliberate revert and the baseline nondeterminism were all
volunteered accurately, and the revert is genuinely on the branch (`client.ts:181` reads `'deck'`,
with no remnant of the alternative).

### What was checked and found sound

- **Blast radius of the shared-machinery change is genuinely nil.** `port.ts` and `deck.ts` are the
  only other `createIsoScene` callers (`puzzle` and `battle` do not use it) and neither passes
  `follow` or `avatarArt`; `followTarget` returns immediately when `follow` is undefined, and
  `avatarArt ?? 'avatar'` preserves the old art. Walking, warping, the radial and `announceArrival`
  are unchanged on those scenes.
- **`create` and `reset` do not diverge on scene state.** `reset` calls `syncScene()` after setting
  `current = 'port'`, so both converge. (They *do* diverge on refusal logging — recorded in
  `ISSUES.md`, not blocking.)
- **Decisions L8, L9 and L13 are met.** `atlas.ts` is genuinely absent from the diff and no new art
  is introduced; the ship's position has exactly one source of truth; one new baseline, the four
  pre-existing ones untouched, and `maxDiffPixelRatio` correctly not widened.
- **No security or data-safety findings.** `current` is not persisted, so a save taken at sea
  re-derives its scene through `syncScene` on load and no reachable pair leaves the client in a scene
  its own `canEnter` would refuse; `restore`'s rollback still holds. The URL is the only untrusted
  boundary and both `scene` and `seed` are allowlisted and range-checked. No manifest or lockfile
  changed; nothing new reads the filesystem, spawns a process or evaluates a string.
- **`syncScene` strands nobody** across the reachable `(inBattle, atSea, current)` combinations, and
  fractional tile coordinates cause no throw anywhere they flow — `announceArrival` is unreachable in
  the sea scene, and would early-return on an `undefined` tile if it were.

### Routing

Cycle 0 to 1. Blocking findings B1-B3 returned to analysis as
`20260906-140000-analysis-opp21-slice-c-review-blockers`; B4 is corrected by this entry. Non-blocking
findings — the dead avatar radial and the walk-refusal on every click, the duplicated opening block,
the misleading `COURSE_*` names, six test-coverage gaps and two import-order slips — are in
`ISSUES.md` under a dated heading. PR 16 stays open and unmerged.

## 2026-09-06 — analysis, slice C review blockers (OPP-21), PR 16, cycle 1

Answers the three blocking findings the independent review returned as
`20260906-140000-analysis-opp21-slice-c-review-blockers`, plus the one non-blocking finding the
review named for repair in the same pass. Work continues on the existing branch and PR 16; no second
PR. Everything else in `ISSUES.md` stays there and is not re-litigated here.

Two of the three findings turned out to be **larger than the review stated**, and one of the review's
own framings needed correcting. Those are called out below rather than buried, because the repair
scope depends on them.

### B1 — the sea scene is unreachable, and it is also a dead end

Confirmed exactly as reported. `client.ts:182` (`atSea && current === 'port'` to `'sea'`) is the only
transition into `sea`, and `voyage.sail` is dispatched from one place, the helm prop at
`deck.ts:88-91`, so `current` is always `'deck'` when `atSea` flips. Only `?scene=sea` reaches the
scene, which is how all 13 new tests and the smoke baseline reach it.

Two things the review did not establish, both of which change the repair:

- **`canEnter` already permits the round trip.** At sea, `canEnter('sea')` is true (`client.ts:127`)
  and `deck` falls through to the always-allowed case (`client.ts:129`). The client has always
  allowed deck to sea and back while under way; nothing in the UI ever asks for it. This is an
  affordance gap, not a permissions one, and no change to `client.ts` is required.
- **The tab strip cannot substitute for the missing exit.** It is a *panel* switcher
  (`panels.ts:30,58-66`) over the Ye/Location/Booty/Market widget, mounted once into the DOM overlay
  outside the Pixi stage; `open(tab)` never touches `client.scene`. So the review's reason for
  classifying the dead radial as non-blocking is sound for the *panels*, but it does not give the
  sea scene an exit. `sea.ts` has no portal tile, no prop and no `enter-scene` intent, so a player who
  reached it would be held there for the whole voyage — away from the bilge pump, the helm, and every
  station the pillage loop needs. **The scene is a dead end in both directions**, and the repair must
  close both.

`voyage.abandon` is offered only before departure (`minimap.ts:112-113`, and the sim refuses it under
way at `dispatch.ts:96`), so the only exit from a voyage is `voyage.port` from the location panel.
That is by design and is not changed here.

**The repair.** On an accepted `voyage.sail`, the helm emits `{ kind: 'enter-scene', scene: 'sea' }`
alongside the dispatch (`deck.ts:88-92`). This is the path every other scene change in the tree
already takes — boarding (`port.ts:47`), the bilge pump (`deck.ts:58`), the gangplank (`deck.ts:108`),
the end of a battle (`battle.ts:294`). For the exit, the sea radial gains an action to the deck, and
the helm gains one back to the passage, both routed through the existing intent tables
(`SEA_INTENTS` `sea.ts:17-20`, `DECK_INTENTS` `deck.ts:57-63`) so no new mechanism appears.

Widening `syncScene` instead was rejected: it runs on every `advance` (`client.ts:108`), so a rule
promoting `deck` to `sea` would drag the player back out of the deck on the next tick, permanently —
the opposite defect, and one that breaks `loop.test.ts:59` and contradicts decision L7.

`syncScene`'s `port` to `sea` rule is kept. It is a **boot and restore rule, not a play rule**: it is
what puts the `under-way` opening on the sea at `client.ts:51-57`, and what re-derives the scene when
a save taken at sea is restored. It reads as dead code and is not.

### B2 — the arrival teleport is the terminal case of a defect that fires every leg

Confirmed, and it is **wider than the review found**. The rendered position is
`legTicks / legTicksRequired` and nothing else — `legIndex` and `route` are never consulted
(`sea.ts:29-41`). Because `stepVoyage` zeroes `legTicks` at every league point (`voyage.ts:67`), the
ship re-traverses the entire drawn course **once per leg** and snaps back to `COURSE_START` at *every
interior* league point, not only at arrival. Traced on the real alkaid-to-doyle route `[1, 2, 8]`
(2 legs, 25 200 then 18 000 ticks at the opening's speed):

| tick   | legIndex | legTicks | legTicksRequired | progress ‰ | rendered tile  |
| ------ | -------- | -------- | ---------------- | ---------- | -------------- |
| 25 199 | 0        | 25 199   | 25 200           | 999        | (29.99, 17.01) |
| 25 200 | 1        | 0        | 18 000           | 0          | (21, 26)       |
| 43 199 | 1        | 17 999   | 18 000           | 999        | (29.99, 17.01) |
| 43 200 | 2        | 0        | 0                | 0          | (21, 26)       |

The last row is B2 as reported: `orientationCostOf` reads `route[legIndex + 1]`, finds `undefined`
and returns 0 (`voyage.ts:94`), so `legTicksRequired` becomes 0, the `<= 0` guard at `sea.ts:30`
returns 0, and `voyage.ts:62` then freezes the state forever, so the ship parks at the origin while
the heading still reads "Bound for Doyle Island". The row above it is the same teleport, mid-route,
lasting until the next leg crawls out again — and the leg's apparent speed also changes by 40 %
between a horizontal and a diagonal league.

**The task asked for the mid-route case to be decided either way. It is a defect, not design.** It
follows literally from decision L9, but L9 chose where the *number* comes from; it never said the
drawn course represents one league. The rest of the scene reads as the whole passage — the heading
names the final island (`sea.ts:45`) — so re-sailing the same line once per league contradicts what
the scene tells the player. Fixing only the `<= 0` guard would leave a full-length backwards teleport
at every interior point, which is why the repair is the formula, not the guard.

**The repair.** `legProgressPerMilleOf` becomes whole-voyage progress: the within-leg fraction is
computed only when `legTicksRequired > 0`, and the result is `(legIndex + fraction) / legs` in per
mille, clamped, where `legs = route.length - 1`. One expression resolves all four states — charted
gives 0 at `COURSE_START`; mid-leg is monotonic; a leg boundary lands on `legIndex / legs`, a real
intermediate point with no snap; arrival gives exactly 1000 at `COURSE_END`. The `<= 0` guard stays,
demoted to what it always should have been: a divide-by-zero defence, not a rendering answer.

`legIndex >= route.length - 1` is the sim's own arrival predicate (`voyage.ts:62`) and the convention
the world loop and dispatch tests already use, so nothing new is invented. Keying off
`legTicksRequired === 0` would be wrong twice: it is an accident of the out-of-range lookup, and
`dispatch.test.ts:64-68` builds the arrived state by setting `legIndex` alone.

**A second, unreported instance of the same guard** sits at `panels/minimap.ts:218-221`, so on
arrival the chart panel reads "Leg 2 of 2" with a 0 % bar labelled `0/0`. It gets the same correction;
fixing one and not the other would leave the two panels disagreeing.

A sim-side `phase: 'arrived'` was rejected. It would flip `client.atSea` (`client.ts:86`) and eject
the player from the sea scene at the moment of arrival, loosen the `voyage.sail` and `voyage.abandon`
guards (`dispatch.ts:77,96`), and need a schema 7 to 8 migration — and it would still not fix the
mid-route snap, which needs the view change regardless.

### B3 — the constraint, derived per-axis, and the baseline re-measured

The review's measurement was reproduced independently, decoding the PNG from scratch: **576 pixels
exactly equal to `BACKDROP`, bounding box x 0-51 / y 694-719, bottom-left corner backdrop and the
other three water.** Confirmed to the pixel.

Measuring the *shape* as well as the count pins the geometry. The void's edge is a single straight
line of slope one half — exactly `TILE_HEIGHT / TILE_WIDTH`, the slope of a `v = const` line — and
solving it against the projection recovers `ship.y = 26 = COURSE_START.y` and re-derives the 972x720
stage independently. The void is precisely the region `v > SEA_HEIGHT` at the start of the leg. The
full triangle would be 702 px; 126 are hidden behind the chat overlay, giving 576. The count
reproduces exactly.

**Where the recorded rule went wrong.** `SEA_WIDTH + SEA_HEIGHT >= 78` is a correct theorem about a
camera centred on the *diamond*. This camera centres on the *ship*: `camera.ts` never learns the grid
extent at all — it imports only the projection — and `keepVisible` only clamps the anchor into a 96 px
margin (`camera.ts:31-35,54-57`), while `resize` re-centres unconditionally (`camera.ts:48-52`). The
binding case is therefore the ship at a course *endpoint*, and the course midpoint being centred on
the diamond is true and irrelevant, since the endpoints sit 4.5 tiles away on both axes.

Writing `R` for the half-viewport measured along either iso axis, in tiles:

```
R = VH / (2 * TILE_HEIGHT) + VW / (2 * TILE_WIDTH) = 720/64 + 972/128 = 11.25 + 7.59375 = 18.84375
```

Both `u` and `v` pick up the same `R`, so the condition is symmetric per axis, and because
`coursePositionOf` is affine the extremes are the two endpoints. **The constraint, as four
inequalities rather than one sum:**

```
min(COURSE_START.x, COURSE_END.x) >= R      max(COURSE_START.x, COURSE_END.x) + R <  SEA_WIDTH
min(COURSE_START.y, COURSE_END.y) >= R      max(COURSE_START.y, COURSE_END.y) + R <  SEA_HEIGHT
```

The centred camera is the worst case: `clampToAnchor` always moves the view *toward* the centred
value for the current anchor, so every window shown lies in the convex hull of the centred windows.
This was checked numerically against the real camera code, not only argued.

Against the shipped constants, `SEA_HEIGHT` is wrong at **both** ends, in different corners:

| quantity           | value    | required    | verdict        |
| ------------------ | -------- | ----------- | -------------- |
| `min course x`     | 21       | >= 18.84375 | ok             |
| `max course x` + R | 48.84375 | < 52        | ok, 3.16 spare |
| `min course y`     | 17       | >= 18.84375 | fails by 1.84  |
| `max course y` + R | 44.84375 | < 44        | fails by 0.84  |

The 0.84-tile overshoot at `COURSE_START` is the 26-row triangle in the baseline. The 1.84-tile
shortfall at `COURSE_END` would be a *top-right* void; it is absent from the baseline only because by
then `keepVisible` has panned the camera, and a browser resize at that moment would expose it — which
is exactly why "verified in a browser at both ends of a leg" returned a false positive. Simulating the
real camera over the leg, **the void is on screen for roughly 77 % of the passage.**

**The repair.** Grid `49 x 49` with `COURSE_START = {x: 20, y: 29}` and `COURSE_END = {x: 29, y: 20}`:
square, so the two axes cannot silently diverge a third time; the course still centred; a full tile of
slack on all four inequalities at both endpoints; and essentially the same paint cost as today
(2401 sprites against 2288). Verified against the real camera code at every mount point and every
progress value.

**Encoded structurally, because prose did not hold.** The constants carry no derivation in the source
— `sea.ts` has no comment at all — which is why each agent re-guessed them. The repo's own habit is
that the projection's numbers are the source and everything else is expressed from them
(`atlas.ts:74-75`). So the radius becomes a function in `iso/projection.ts` where that reasoning
belongs, the design stage size is named once, and the grid is derived from the course rather than
typed in. The four inequalities are then asserted in `tests/view/sea.test.ts`, which already imports
these constants. A `tools/` gate is the wrong tier: the gates in this repo enforce architectural facts
across trees, not a numeric relation between two constants in one module.

State the upper bound **strictly**: water covers `0 <= u < SEA_WIDTH`, so a rule written with `<=`
would accept `48.84375 <= 49` and leave a hairline of backdrop.

### The non-blocking item repaired in the same pass

The sea radial can never open and every click emits a walk refusal. `follow` makes `standing`
fractional (`isoScene.ts:174-181`); the radial is gated on `sameTile(screenToIso(...), standing)`
(`isoScene.ts:243`) and `screenToIso` floors (`projection.ts:26`), so the comparison is never true
under way. The click then falls through to `walkTo` on an all-water grid, every tile of which is in
`HAZARD_TILES` (`grid.ts:34`), producing the refusal on every click anywhere.

Two changes, and they are independent. `walkTo` is suppressed when a scene declares `follow` — the
field already means "this scene owns the avatar's position", so a walk order is meaningless rather
than merely impossible, and the guard has the same shape as the one four lines away at
`isoScene.ts:175`. And the avatar is hit-tested in screen space by making the sprite interactive,
which is the mechanism `clickableProps` already uses for every other clickable thing
(`isoScene.ts:145-148`); the tile-space test is the outlier. Screen-space hit-testing is also the only
option that is **independent of the ship's position**, which matters because M4 changes how that
position is expressed.

Both are provably inert on `port` and `deck`: they are the only other `createIsoScene` callers and
neither passes `follow` (`port.ts:74-81`, `deck.ts:111-121`); `puzzle` and `battle` do not use the
machinery at all. Making the avatar sprite interactive does change one thing on those scenes —
clicking the pirate's own body would open the radial where it currently walks a tile — which is
recorded here rather than smuggled.

### Decisions taken on the review's behalf

| #   | Decision                                                                            | Rationale                                                                                                                |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| M1  | `sea` is entered by an intent emitted from the helm, not by widening `syncScene`     | Every player-initiated scene change already goes through an intent; `syncScene` runs each tick and would trap the player. |
| M2  | Deck and passage are both reachable under way, by a radial action and a helm action  | L7 already decided both views are wanted, and `canEnter` already permits both — only the affordance was missing.          |
| M3  | `syncScene`'s `port` to `sea` rule is kept                                           | It is the boot path for the `under-way` opening and the restore path for a save taken at sea; it reads dead and is not.   |
| M4  | Position becomes whole-voyage progress, `(legIndex + fraction) / legs`               | One expression resolves all four render states and removes the arrival teleport and the mid-route snap together.          |
| M5  | The mid-route snap is treated as a defect, not a consequence of L9 to preserve       | The drawn course is the whole passage — the heading names the final island — so re-sailing it each league contradicts it. |
| M6  | The fix stays in the view; `VoyagePhase` gains no `arrived` value                    | A sim phase would eject the player at arrival, loosen two dispatch guards, need a migration, and not fix the snap.        |
| M7  | `panels/minimap.ts:218-221` gets the same correction as `sea.ts`                     | It carries a byte-identical guard, so the chart panel reads 0 % on arrival for exactly the same reason.                   |
| M8  | The grid is derived from the projection and a named design stage, not hardcoded      | These constants have been wrong twice; the repo's habit is that the projection's numbers are the single source.           |
| M9  | Grid 49 x 49, course (20,29) to (29,20)                                              | Square so the axes cannot diverge again; a full tile of slack on all four inequalities at both endpoints.                 |
| M10 | The four inequalities are asserted in `tests/view/sea.test.ts`                        | Catches a third wrong value in milliseconds rather than in a Playwright baseline nobody re-inspects.                      |
| M11 | The camera does not learn the grid extent in this pass                               | It would make placement irrelevant and survive right-drag panning, but it touches every iso scene. Filed in `ISSUES.md`.  |
| M12 | `walkTo` is suppressed when a scene declares `follow`                                | `follow` means the scene owns the avatar's position, so a walk order is meaningless. Inert on the two unfollowed scenes.  |
| M13 | The avatar is hit-tested in screen space                                             | It is the mechanism every other clickable thing uses, and the only option independent of the position M4 changes.         |
| M14 | The `sea` baseline is re-blessed once, after all of the above land                   | It currently certifies the void; both the constants and the progress formula move the frame, so one deliberate re-take.   |

### Deliberately not in scope

- **The camera learning the grid extent** (M11). The stronger fix — clamping the view against the
  grid's four half-planes, two `between` calls in the style of `clampToAnchor` — would make the course
  placement question disappear, reduce the requirement to one inequality per axis satisfiable by a
  40x40 grid, and make right-drag panning void-proof, which no choice of constants can. It benefits
  every `createIsoScene` caller, which is exactly why it does not belong in a cycle-1 repair of one
  scene. `ISSUES.md`.
- **The stale heading.** `sea.ts:66` passes `heading` as a string evaluated once at construction, not
  as a callback like `follow`, so it cannot ever update and still reads "Bound for Doyle Island" after
  arrival. Making it re-derivable is a change to `isoScene.ts`'s definition shape. `ISSUES.md`.
- **A drag-proof grid** (77x77, from `R_pan = 33.1875`). Rejected as 2.5 times the paint cost to
  defend against a deliberate right-drag; M11 is the better answer to the same problem.
- Everything already in `ISSUES.md` under the 2026-09-06 heading, including the duplicated opening
  block in `create` and `reset`.

### The test gap this cycle has to close

The reason all three findings passed a green suite is that **no test anywhere drives the player's
path**. The existing sea tests reach the scene through `GameClient.create({ opening: 'under-way' })`,
which dispatches `voyage.sail` while `current` is still the constructor default `'port'` — a state
the UI cannot produce. `loop.test.ts:106-123` does the same explicitly. And `loop.test.ts:54-59`,
which drives the *real* order, asserts the scene stays `'deck'` — the suite recorded B1 as expected
behaviour.

The regressions that would have caught these, and that this cycle must add:

1. From the deck, with a charted course, an **accepted** sail puts the scene on `sea`; a refused one
   does not. (B1, and the assertion nobody wrote.)
2. Under way, entering the deck works and the next `advance` leaves the player there. (M2's
   anti-trap assertion — the one that fails if anyone later widens `syncScene`.)
3. On the tick completing the final leg, progress is exactly 1000 and the position is `COURSE_END`;
   it stays there. (B2. `sea.test.ts:94-106` already drives the client into this state and asserts
   scene and island but never position.)
4. Progress is monotonic across an interior leg boundary. (M5.)
5. The four inequalities hold for both course endpoints. (M10, B3.)
6. The chart panel's leg progress on arrival. (M7 — `minimap.test.ts` has no coverage of it.)
7. A first test of the click decision, through a pure exported predicate rather than a faked pointer
   event. (M12 and M13 — nothing currently covers `onTap`, the radial or `walkTo` end to end.)

Note that `sea.test.ts:30-44` passes bare `{ legTicks, legTicksRequired }` objects with no `route` or
`legIndex`; under M4 those must be rewritten. `sea.test.ts:21-28` (`coursePositionOf(0)` is
`COURSE_START`, `coursePositionOf(1000)` is `COURSE_END`) still holds, and `tests/world/*` are
untouched because nothing in `packages/sim` changes — so no golden, save or migration churn.

### Correcting the record

The claim in the slice C development entry above — that the grid "is now sized from the iso projection
so a 972x720 viewport stays on water for the whole course", with the rule `SEA_WIDTH + SEA_HEIGHT >=
78` — is superseded by the derivation in B3. The rule is a sum where the requirement is per-axis, and
it is a theorem about a diamond-centred camera this code does not have.

### Routing

Cycle 1. One development task, `20260906-141500-opp21-slice-c-repair-cycle-1`, continuing on
`agent/feature/20260904-132302-opp17-slice-c-the-passage-is-a-place` and PR 16. No second PR, no
merge. `atlas.ts` stays out of the diff. Slice D remains held.

## 2026-09-07 — development, slice C repair (OPP-21), PR 16, cycle 1

Implements `20260906-141500-opp21-slice-c-repair-cycle-1` against the decisions M1–M14 in the entry
above. Same branch, same PR, no second PR, no merge. `packages/sim` untouched, `atlas.ts` untouched,
`client.ts` untouched. `npm run check` exits 0 with 637 tests passing and `npm run smoke` passes 5/5,
both from cold.

M1–M14 were implemented as written except where noted under *Deviations* below. The three blocking
findings are closed and the named non-blocking one is repaired in the same pass.

### What the constants actually resolve to

`halfStageTileRadius(972, 720)` = `720/64 + 972/128` = **18.84375**, reproducing the analysis exactly.
`COURSE_CLEARANCE_TILES` = `ceil(18.84375) + 1` = **20**, giving grid **49 × 49**, `COURSE_START`
**(20, 29)**, `COURSE_END` **(29, 20)** — M9's values, now derived rather than typed. Both endpoints
clear all four inequalities with **1.15 tiles** of slack (`29 + 18.84375 = 47.84375 < 49`, strictly).

The 972 is confirmed structurally, not assumed: `mount` passes `resizeTo: options.canvasHost`
(`packages/view/src/app.ts:48`), so the renderer sizes to the `#stage` host — the viewport less the
308 px panel column — and not to the window.

### The void is gone, and that claim is measured

The previous pass reported this fixed after looking at a browser, and was wrong. This pass decoded
the PNGs.

A standalone decoder counted pixels exactly equal to `BACKDROP` (`0x0a1622`). Against the **committed**
baseline it reproduced the review's figure to the pixel — **576 px, bbox x 0–51 / y 694–719** — which
calibrates the instrument before it is used to certify anything.

| capture                                   | backdrop px | bounding box       |
| ----------------------------------------- | ----------- | ------------------ |
| committed baseline (old constants), start | 576         | x 0–51 / y 694–719 |
| **new baseline, start**                   | **0**       | —                  |
| **arrival, new constants**                | **0**       | —                  |
| arrival, old constants (control)          | 3422        | x 856–971 / y 0–57 |

`COURSE_END` was exercised by driving a real voyage rather than by reasoning: an `evade` voyage
charted through `window.__ppApp.client`, advanced to `legIndex 2` / `legTicksRequired 0` — the exact
state that produced the arrival teleport — then `enterScene('sea')` and a screenshot.

The last row is a **sensitivity control**, and it is the reason the other rows can be trusted. Only
the four constants were reverted and the identical capture re-run; it exposes the top-right void the
analysis predicted at `COURSE_END` and that a browser check had missed, because by then `keepVisible`
has panned the camera. A "0" from a method that cannot detect a void at that position would have been
worthless, which is precisely how the earlier false positive arose.

### The smoke suite cannot catch this class of defect

`maxDiffPixelRatio` is 0.01 — **9216 px** of a 1280×720 frame. The void measures 576 px at the start
and 3422 px at arrival. Both pass comfortably.

This was observed directly, not inferred: running the suite with the repaired code against the **old**
baseline passed 5/5, and the baseline only regenerated once `sea.png` was deleted. The threshold was
not widened (M14 forbids it, and widening would be the wrong direction anyway). **M10's unit
assertion of the four inequalities is the real guard**; the baseline certifies composition, not
geometry. Filed in `ISSUES.md`.

### Deviations from M1–M14, and why

- **M7, the chart panel, shares the arrival *predicate* rather than the progress *function*.** M7 says
  the panel "gets the same correction". Taken literally that puts whole-voyage progress into a bar
  labelled "Leg progress" whose value text is a leg tick pair, directly beneath the `Leg n of m` row
  that already carries the coarse position — the row would then duplicate the one above it. It is
  also not importable: `sea.ts` → `isoScene.ts` → `pixi.js` (line 1), so importing it into
  `panels/minimap.ts` drags Pixi into the DOM panel layer and into `minimap.test.ts`, which runs on
  happy-dom with no renderer. Today the panel layer imports only a *type* from `scenes/`. So the panel
  keeps its own within-leg quantity and gains an arrival branch keyed on `legIndex >= route.length - 1`
  — the sim's own predicate, per M4. M7's stated purpose is honoured: the two panels now agree on the
  arrival state (ship at `COURSE_END` / 1000; bar full, "All leagues astern").
- **M13 adds the screen-space hit-test but keeps the tile-space one.** M13 calls the tile-space test
  "the outlier", but the same paragraph records exactly one accepted behaviour change on `port` and
  `deck`. Removing the tile-space clause causes a *second*, unrecorded one: the avatar sprite is
  anchored bottom-centre, so it never covers the lower half of its own tile diamond, and clicking
  there would stop opening the radial and silently order a walk to the tile already occupied. The two
  sentences cannot both be honoured; the concrete claim about `port`/`deck` was kept. On `sea` the
  tile-space clause is never true under way, so it costs nothing there and M13 does all the work.
- **`departureIntentOf` is an exported pure function** (`deck.ts`). M1's emission would otherwise live
  inside `createDeckScene`'s closure, which the node tests cannot construct — it needs a Pixi `Atlas`
  — making required regression 1 unwritable. This is the same idiom the analysis itself prescribes for
  its regression 7.
- **`legProgressPerMilleOf` was renamed `voyageProgressPerMilleOf`.** Under M4 the old name states the
  opposite of what the function returns. Nothing else in the tree referenced it.
- **Two numbers remain typed in `sea.ts`**: the course span (9 tiles) and one tile of spare water. M8
  requires derivation and M9 gives the answers, but neither names the irreducible inputs. Everything
  else — clearance, both endpoints, and both grid dimensions — follows from those two and the
  projection. `SEA_HEIGHT = SEA_WIDTH` encodes M9's "square so the axes cannot diverge a third time".

### One defect found in this pass's own work

The new helm action **"To the passage" was a dead control while docked.** `canEnter('sea')` returns
`atSea` (`client.ts:127`), so in port the intent was refused and `enterScene` returned `false`
silently — a menu entry that does nothing, shipped inside the very PR whose purpose is to remove
silent no-ops. It now answers the way the deck already answers an unavailable exit, alongside
`GANGPLANK_STOWED`:

```
const PASSAGE_ASHORE = 'There be no passage while we lie alongside.';
```

The precondition is pinned in `loop.test.ts` at both states (`canEnter('sea')` false alongside, true
under way).

### The test gap, closed

637 tests pass, up from 622. All seven regressions the analysis required are present. The load-bearing
ones: an accepted sail from the deck now yields the departure intent and a refused one yields `null`
(regression 1 — the assertion nobody wrote); entering the deck under way survives the next `advance`
(regression 2 — the anti-trap assertion that fails if anyone widens `syncScene`); progress is exactly
1000 at `COURSE_END` on the arriving tick and stays there (3); progress is monotonic across an interior
leg boundary (4); the four inequalities hold for both endpoints (5); the chart panel on arrival (6);
and the click decision through the pure exported `tapDecisionOf` (7).

`loop.test.ts:54-59`, which asserted the scene stays `'deck'` after an accepted sail, recorded B1 as
expected behaviour and was rewritten rather than worked around. `loop.test.ts:106-123`, which reached
`sea` through the UI-impossible sail-from-`port` path, became a save/restore test — which is M3's
actual justification for keeping the `port` → `sea` rule, so that rule now has a test matching its
stated reason.

### For the test stage

`playwright.config.ts` sets `reuseExistingServer: !process.env.CI` against the fixed port 5178. A
developer's own `npm run dev` — or another worktree's — was listening there during this run, so a
plain `npm run smoke` would have silently exercised **that** tree and reported a pass for code it
never loaded. Every Playwright pass here ran on an isolated port through a temporary config, deleted
afterwards. Use an isolated port or set `CI`. Filed in `ISSUES.md`.

### Routing

Forwarded to review as cycle 1 on PR 16. Slice D remains held.
