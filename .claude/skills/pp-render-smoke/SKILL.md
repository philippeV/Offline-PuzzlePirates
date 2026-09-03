---
name: pp-render-smoke
description: Run the Playwright render smoke over the four drawn surfaces and decide what a red run means. Use when a task needs to run npm run smoke, read a render-smoke failure, tell a real render regression from anti-aliasing noise, decide whether a screenshot baseline may be re-blessed, add a surface to the smoke, or work out why the app never signalled render:ready.
---

# pp-render-smoke

The render smoke is the only test in the repo that opens a browser. It loads the app on a fixed
seed, waits for the app's own readiness signal, and for each of four surfaces — the iso port
scene, the ship deck, the bilging puzzle board and the battle grid — asserts that a canvas is
there, that it is not a flat fill, and that it still matches its blessed screenshot.

**It asserts that things are drawn. It never asserts a game rule.** Bilge does not rise, booty
does not divide and a brigand does not lose in this file; those belong to `pp-sim-harness` and the
`node --test` suites. The smoke is kept deliberately small because it is the slow, browser-shaped,
flakiest part of the suite, and every assertion added to it is paid for on every run.

It is **not** part of `npm run check`. CI has no browsers. It is `npm run smoke`, run on purpose.

## Provenance of what follows

Every command below was executed and every transcript is pasted verbatim. *Where* they were
executed matters, because the machine this was written on does not have the Chromium build
Playwright 1.62.1 pins:

- The `npm run smoke` and `npx playwright test --list` transcripts come from this repo.
- The three-green-one-red run and the `?scene=battle` refusal were produced against the real
  `@opp/view`, in a throwaway copy of the repo whose config added `channel: 'chrome'` so the run
  could use the locally installed Google Chrome. Everything but the pixels is what this repo's
  own config produces.
- The mount-failure and blank-canvas transcripts, and the entropy figures under them, were
  produced the same way against a deliberately broken stub `mount`, because the real renderer
  does not fail on demand. The message text is the test's own.

There are **no blessed baselines committed yet**, and the ones written during this work were
deliberately thrown away: a baseline written by Google Chrome does not match one written by
Playwright's pinned Chromium, so committing them would guarantee a red first run everywhere else.
The first run on a machine with the pinned browser writes them, fails, and a human blesses them.

## The contract the app honours

The smoke never reaches into the renderer. It drives the app through the URL and reads the app's
answer off the `<html>` element. `packages/app/src/main.ts` is the only thing that implements
this; the view is asked through `GameApp.client`, and whatever it answers is what gets published.

| Parameter | Accepts                              | Default    | On a value it will not take                      |
| --------- | ------------------------------------ | ---------- | ------------------------------------------------ |
| `seed`    | a decimal integer                    | `12648430` | falls back to the default and warns on `console`  |
| `scene`   | `port`, `deck`, `puzzle` or `battle` | `port`     | falls back to `port` and warns on `console`       |

The default seed is a constant, not `Date.now()` and not `Math.random()`. That is the whole reason
a screenshot baseline and a bug report mean anything.

| Attribute on `<html>` | Set when                                                                     |
| --------------------- | ---------------------------------------------------------------------------- |
| `data-render-scene`   | after mount, naming the scene the view actually presented                     |
| `data-scene-refused`  | only when the view would not open the requested scene; names what was asked   |
| `data-render-ready`   | `"true"` once a frame has been presented *for that scene*, never before       |
| `data-render-error`   | `mount` threw; holds the message, which is also drawn into the page           |

`window.dispatchEvent(new CustomEvent('render:ready'))` fires in the same statement pair as
`data-render-ready`. The test waits on the attribute rather than the event because an attribute
cannot be missed by arriving before the listener; the event is there for anything else that wants
it. **Nothing in this test may use `waitForTimeout`.** A render smoke that waits a fixed number of
milliseconds is a render smoke that passes on a fast machine and fails on a loaded one.

`data-render-ready` and `data-render-error` are raced against each other, so a failed mount fails
the test in under a second instead of burning the twenty-second mount budget.

## Run it

```
npm run smoke
```

Playwright starts the Vite dev server itself — `webServer` runs `npm run dev` on port 5178, with
`reuseExistingServer` on outside CI — so there is nothing to start by hand. One worker, no
retries: a flaky render smoke is a bug, not something to paper over with a second attempt.

To see what it would run without running it:

```
npx playwright test --list
Listing tests:
  [chromium] › render-smoke.spec.ts:36:3 › the iso port scene draws on seed 12648430
  [chromium] › render-smoke.spec.ts:36:3 › the ship deck draws on seed 12648430
  [chromium] › render-smoke.spec.ts:36:3 › the bilging puzzle board draws on seed 12648430
  [chromium] › render-smoke.spec.ts:36:3 › the battle grid draws on seed 12648430
Total: 4 tests in 1 file
```

One surface at a time, by its name:

```
npx playwright test -g "iso port"
```

## What the run needs before it can be green

This is what `npm run smoke` prints in this repo today. Four tests, four failures, none of them
about rendering:

```
npm run smoke

> offline-puzzle-pirates@0.0.0 smoke
> playwright test

Running 4 tests using 1 worker
  x  1 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the iso port scene draws on seed 12648430 (4ms)
  x  2 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the ship deck draws on seed 12648430 (4ms)
  x  3 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the bilging puzzle board draws on seed 12648430 (4ms)
  x  4 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the battle grid draws on seed 12648430 (2ms)
  1) [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the iso port scene draws on seed 12648430 ──
    Error: browserType.launch: Executable doesn't exist at C:\Users\Verpo\AppData\Local\ms-playwright\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe
```

Four failures in twelve milliseconds is the shape of a browser problem, not a render problem: no
test reached the page. Playwright 1.62.1 pins a Chromium build this machine does not have
(`chromium-1217` and `chromium-1228` are installed and neither is a substitute). Fixing it means

```
npx playwright install chromium
```

which **downloads a browser — say so before you run it**, and never report the smoke as passing on
a machine where it could not launch.

Driven through the locally installed Chrome instead, on the real renderer, the same four tests
give the run this repo should expect once the browser is there:

```
Running 4 tests using 1 worker
  ok 1 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the iso port scene draws on seed 12648430 (2.2s)
  ok 2 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the ship deck draws on seed 12648430 (1.5s)
  ok 3 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the bilging puzzle board draws on seed 12648430 (1.8s)
  x  4 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the battle grid draws on seed 12648430 (6.2s)
```

The battle grid is red for a reason that is documented below and is not a rendering fault.

## Reading a failure

Every assertion carries its own sentence, so the first `Error:` line names the surface and the
thing that was wrong. Work from that line, not from the screenshot.

| First `Error:` line                                        | What actually broke                                     | What you do                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `the app failed to mount ?scene=…: <message>`               | `mount` threw; the message is the renderer's own         | fix the renderer; the shell already reported it correctly                  |
| `the app never signalled render:ready nor a render error…`  | the module never ran, or `mount` never settles           | read the `[WebServer]` lines above it — usually a resolve or syntax error  |
| `the view did not honour ?scene=…`                          | `client.enterScene` refused; the view stayed elsewhere   | a renderer or client question, never a baseline question                   |
| `… rendered a flat, featureless canvas`                     | a canvas exists and drew nothing distinguishable         | a real render regression; do not touch the baseline                        |
| `expect(page).toHaveScreenshot(expected) failed`            | pixels moved                                             | classify it before doing anything — see below                              |

### `mount` threw

```
  1) [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the iso port scene draws on seed 12648430 ──
    Error: the app failed to mount ?scene=port: the atlas failed to load
      46 |
      47 |   const failure = await root.getAttribute('data-render-error');
    > 48 |   if (failure !== null) throw new Error(`the app failed to mount ?scene=${scene}: ${failure}`);
```

The message came out of `data-render-error`, which the shell also renders into the page, so a
human who opens `http://localhost:5178` sees the same sentence instead of a black rectangle. **A
blank canvas with only a console error is not an acceptable failure mode** — if you ever see one,
the shell has stopped doing its job, and that is the bug to fix first.

### The view would not open the scene

This one is live: it is what the battle grid does today, against the real renderer.

```
  1) [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the battle grid draws on seed 12648430 ─────
    Error: the view did not honour ?scene=battle; data-render-scene names what it presented instead
    expect(locator).toHaveAttribute(expected) failed
    Locator:  locator('html')
    Expected: "battle"
    Received: "port"
    Timeout:  5000ms
    Call log:
        13 × locator resolved to <html lang="en" data-render-scene="port" data-render-ready="true" data-scene-refused="battle">…</html>
```

Read the resolved element: `data-scene-refused` says what was asked for and `data-render-scene`
says what came back. The app requested the scene and published the answer; it did not silently
screenshot the port and call it the battle grid, which is exactly the failure this assertion
exists to prevent.

The cause is a client rule, not a renderer bug: `GameClient.canEnter` refuses `battle` unless a
battle is already running, and the smoke's fixed seed opens in port. **The fix belongs on the
`?scene=battle` route, not in this test** — either the client lets the smoke's opening state reach
a battle, or `mount` grows a way to open one. Deleting the assertion, or repointing the battle
case at some other scene, would leave the battle grid untested while looking green.

The same reading applies to `deck` and `puzzle`, which the real view does honour on this seed.

### The canvas drew nothing

```
    Error: the iso port scene rendered a flat, featureless canvas
    expect(received).toBeGreaterThan(expected)
    Expected: > 16
    Received:   6
      70 |       distinctByteCount(inflatedScanlinesOf(painted)),
```

The blank check inflates the canvas screenshot's `IDAT` chunks and counts distinct byte values in
the filtered scanlines. It is an entropy floor, not a size threshold: a uniform fill compresses to
almost no variety whatever its colour, while anything drawn has plenty. Measured on the two images
from that run, both 2 765 520 bytes once inflated:

```
port-actual.png (a single fillRect):    6 distinct values
port.png        (a drawn grid):       238 distinct values
```

A floor of 16 sits in an enormous gap. **Do not raise it to make a red run green** — a surface
that cannot clear 16 distinct byte values is a surface that drew a rectangle.

## Re-blessing a baseline

Baselines live in `tests/e2e/__screenshots__/`, one PNG per scene, named by the `?scene=` value.
The first run of a new surface has no baseline; Playwright writes one and *fails* that run, which
is correct — a baseline nobody has looked at is not blessed.

```
  3) ... the bilging puzzle board draws on seed 12648430
    Error: A snapshot doesn't exist at ...\tests\e2e\__screenshots__\puzzle.png, writing actual.
```

Open the written PNG, satisfy yourself it shows the surface it claims to, and commit it.

A baseline that already exists is re-blessed with:

```
npx playwright test --update-snapshots -g "iso port"
Running 1 test using 1 worker
...\tests\e2e\__screenshots__\port.png is re-generated, writing actual.
  ok 1 [chromium] › tests\e2e\render-smoke.spec.ts:59:3 › the iso port scene draws on seed 12648430 (1.6s)
  1 passed (6.2s)
```

**Note what that transcript does: it prints `1 passed`.** `--update-snapshots` turns any pixel
change into a green run. That is the whole hazard, and it is the same hazard `pp-golden-state`
guards against for whole-state goldens. The rule is the same one:

**Never re-bless a screenshot without first classifying the change as an intended render change or
a regression.** "The smoke is red" is not a classification.

| Classification | What it means                                            | What you do                       |
| -------------- | -------------------------------------------------------- | --------------------------------- |
| render change  | a change in this branch is supposed to move these pixels  | re-bless, naming the cause        |
| regression     | nothing in this branch should have moved these pixels     | fix the code, the baseline stands |
| unexplained    | you cannot say which of the two it is                     | neither — investigate first       |

Legitimate reasons to re-bless, each of which you must be able to name:

- a sprite, atlas, palette or layout change that was the point of the commit
- a scene deliberately gaining or losing an element
- a change to the fixed viewport, the seed, or the default scene of the smoke itself

Never legitimate:

- the diff is small, so it is "probably fine"
- the numbers moved and nobody knows why
- the run is red and the branch needs to be green
- a surface went blank and re-blessing the blank makes the red go away

The diff report gives you the number to argue with:

```
    Error: expect(page).toHaveScreenshot(expected) failed
      413992 pixels (ratio 0.45 of all image pixels) are different.
      Snapshot: port.png
```

Forty-five per cent of the frame moved because one background colour changed. That is not
anti-aliasing. Anti-aliasing noise is what `maxDiffPixelRatio: 0.01` already absorbs — a
one-shade colour change measured during this work stayed under it and passed. **If a failure
reports a ratio anywhere near the threshold, find the cause rather than widening the threshold**;
every widening buys permanent silence about a class of regression.

Playwright writes `-actual`, `-expected` and `-diff` PNGs next to the failure, under
`tests/e2e/.artifacts/`. Look at the `-diff` before you decide anything.

## Adding a surface

A surface belongs in the smoke only if it is a distinct drawn thing reachable by a `?scene=` value
the view honours. Add an entry to `SURFACES` in the spec, run once to write the baseline, look at
the PNG, and commit it with the change that introduced the surface. Do not add rule assertions on
the way past.

## Where things are

```
packages/app/index.html              the shell: #stage, #panels, the module script
packages/app/src/main.ts             URL contract, mount, the readiness and error attributes
packages/app/vite.config.ts          root, base './' and the dev-server port the smoke reuses
playwright.config.ts                 chromium only, 1280x720, no retries, the webServer
tests/e2e/render-smoke.spec.ts       the four surfaces and every assertion in this document
tests/e2e/__screenshots__/           the blessed baselines, one PNG per scene
tests/e2e/.artifacts/                actual/expected/diff PNGs from the last red run
.claude/launch.json                  the opp-app configuration, for launching the game by hand
```

`pp-golden-state` owns blessed state and `pp-sim-harness` owns the rules. This skill owns pixels
and nothing else.
