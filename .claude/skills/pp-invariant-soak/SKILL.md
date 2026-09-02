---
name: pp-invariant-soak
description: Run the pillage loop over many seeds and decide whether the invented balance constants keep it winnable but not trivial. Use when a task needs to run or widen the soak, read a win/loss tally across seeds, tell a badly tuned constant from a broken invariant, judge whether a red soak is an unlucky seed set, defend a change to balance.json with measured numbers, or check that a spawn or price constant reaches the outcome at all.
---

# pp-invariant-soak

A soak is the whole MVP loop — buy cargo in port, chart a voyage, meet brigands, fight, port,
divide the booty and sell — driven over a fixed set of seeds, with the *distribution* of outcomes
asserted rather than any one outcome. It exists because the wiki publishes no spawn rates, no
brigand payouts and no commodity prices: those numbers were invented, and a tally across seeds is
the only evidence they are sane.

**It is not a golden.** A golden pins one blessed state and fails on any change to it; that is
`pp-golden-state`. **It is not a replay.** A replay pins one command log and its hashes and fails
on any divergence; that is `pp-scenario-author` and `pp-replay-triage`. **It is not a scenario
fixture** — nothing here pins a tick-0 opening. A soak pins no state and no hash at all. It pins a
*shape*: at least one win, not every run a win, every voyage terminating, and no run ending with a
negative number or an overfull hold. A change that moves every hash in the repo can leave the soak
green, and a change that moves no hash at all can turn it red.

Everything in this skill was executed against the repo. Every transcript, command and console line
below is copied from an actual run.

## Run the soak

From the repo root, one file, no harness process and no fixtures:

```
node --test "tests/world/soak.test.ts"
✔ the pillage loop is winnable but not a guaranteed payout across the soak seeds (5994.4569ms)
✔ every soak voyage terminates with its battle resolved and its pirate in port (0.7692ms)
✔ carrying cargo from the home island to the destination pays on every soak seed (0.1795ms)
✔ no soak run ends with negative poe, negative stock, negative cargo or an overfull hold (0.1333ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6335.7582
```

The first test carries the cost — it drives all twelve seeds and memoises the runs, and the other
three read them, which is why they report under a millisecond each. Twelve seeds is a budget, not
a target: the whole repo suite runs in about sixteen seconds and this file must stay a small part
of that. **Prefer fewer seeds with real assertions over many seeds with weak ones.** Widen the set
to investigate, then put it back.

Each test defends a different half of "winnable but not trivial":

| Test                        | Fails when                                                               |
| --------------------------- | ------------------------------------------------------------------------ |
| winnable but not guaranteed | no seed fills the booty chest, or every seed does                        |
| every voyage terminates     | a battle is still running, or a voyage never reaches its destination     |
| carrying cargo pays         | a full buy-sail-sell run leaves the purse no better than it started      |
| no run breaks an invariant  | a negative purse, stock, lot or chest, or a hold laden past its capacity |

## Read the tally

The soak's own assertions print the tally into their failure message, but to *look* at a
distribution without a red suite, drive the same loop directly. This recipe takes a destination
island, a voyage type and a seed count, and prints one line per seed plus the tally:

```
node --input-type=module --eval "
import { PILLAGE_LOOP_SCENARIO, createScenarioSim } from './packages/harness/src/index.ts';
import { sailToDestination, shipOf } from './tests/world/loop.ts';
const [toIslandId, voyageType, count] = process.argv.slice(1);
const tally = new Map();
for (let index = 1; index <= Number(count); index += 1) {
  const seed = index * 7919;
  const sim = createScenarioSim(seed, PILLAGE_LOOP_SCENARIO);
  const ship = shipOf(sim.state, 'player');
  sim.dispatch({ op: 'voyage.chart', shipId: ship.id, toIslandId, voyageType });
  const battles = sailToDestination(sim, 4000000).battles;
  const outcome = battles === 0 ? 'no-encounter' : ship.bootyPoe > 0 ? 'won' : 'lost';
  tally.set(outcome, (tally.get(outcome) ?? 0) + 1);
  console.log(seed + ' ' + outcome + ' battles ' + battles + ' chest ' + ship.bootyPoe);
}
for (const [outcome, seeds] of [...tally].sort()) console.log(outcome + ': ' + seeds);
" doyle pillage 12
7919 won battles 1 chest 456
15838 won battles 2 chest 488
23757 won battles 2 chest 343
31676 lost battles 1 chest 0
39595 won battles 1 chest 480
47514 no-encounter battles 0 chest 0
55433 won battles 1 chest 377
63352 won battles 2 chest 346
71271 won battles 2 chest 798
79190 won battles 2 chest 316
87109 lost battles 1 chest 0
95028 won battles 1 chest 493
lost: 2
no-encounter: 1
won: 9
```

`seed = index * 7919` is the stride the committed soak uses, and the one
`tests/harness/battle.test.ts` uses for its own outcome tally; keep it, so the two tallies name
the same seeds even though they build different scenarios. Read three numbers off the tally, in
this order:

| Number         | Read from                            | Healthy on this route |
| -------------- | ------------------------------------ | --------------------- |
| encounter rate | `no-encounter` against the run count | 1 in 12 met nobody    |
| win rate       | `won` against `won + lost`           | 9 of 11 fights won    |
| chest size     | the `chest` column on a win          | 316 to 798 PoE        |

A tally with a single key is always a finding, whichever key it is. `[["won",12]]` means the fight
cannot be lost, `[["lost",12]]` means it cannot be won, and `[["no-encounter",12]]` means nobody
is ever met — three different broken constants that all look identical from the suite, which is
why the tally goes in the failure message.

## Classify a red soak

**Never change the soak's seeds to make it green, and never edit `balance.json` before the tally
has been classified.** The seeds are part of the assertion's meaning: `won: 9, lost: 2` is a claim
about *these twelve worlds*, and a seed set chosen after seeing the outcomes claims nothing at
all. Re-rolling seeds until the suite passes is the one move an agent must not make unsupervised —
it leaves a green test that has stopped measuring anything, and it does so invisibly, because a
re-seeded soak looks exactly like a passing one.

There are four readings of a red soak and "the suite is red" is not one of them:

| Classification   | What the tally looks like                                                       | What you do                                       |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| tuned constant   | one key only, or a rate far off the table above, but every run finishes cleanly | fix `balance.json`, re-bless what the tuning pins |
| broken invariant | a negative purse, stock, lot or chest, an overfull hold, or a stuck voyage      | fix the code; the soak stands                     |
| unlucky seeds    | the shape is right and exactly one bound is grazed                              | widen the seed set and re-read before anything    |
| unexplained      | you cannot say which of the three it is                                         | none of them — investigate first                  |

A **tuned constant** is red arithmetic, not a bug: the loop runs, terminates and balances, it is
just no longer a game. Below is the soak with its voyages pointed at `evade` instead of `pillage`,
which is what a spawn constant tuned to zero would look like from here:

```
node --test "tests/world/soak.test.ts"
✖ the pillage loop is winnable but not a guaranteed payout across the soak seeds (1868.7011ms)
✔ every soak voyage terminates with its battle resolved and its pirate in port (1.0716ms)
✔ carrying cargo from the home island to the destination pays on every soak seed (0.395ms)
✔ no soak run ends with negative poe, negative stock, negative cargo or an overfull hold (0.4954ms)
ℹ tests 4
ℹ suites 0
ℹ pass 3
ℹ fail 1
...
  AssertionError [ERR_ASSERTION]: no seed filled the booty chest: [["no-encounter",12]]
```

Three green tests and one red one, and the red one names the tally. Nothing terminated badly and
nothing went negative, so this is the top row: the number to change is a spawn constant in
`balance.json`, not a line of code and not a seed.

The price constants fail the same way and just as legibly. Here the soak carries `hemp` — which
Alkaid does not spawn and Doyle does, so it is bought at the scarcity premium and sold at the
spawn discount:

```
node --test "tests/world/soak.test.ts"
✔ the pillage loop is winnable but not a guaranteed payout across the soak seeds (6702.8843ms)
✔ every soak voyage terminates with its battle resolved and its pirate in port (0.8268ms)
✖ carrying cargo from the home island to the destination pays on every soak seed (1.5517ms)
✔ no soak run ends with negative poe, negative stock, negative cargo or an overfull hold (0.2309ms)
ℹ tests 4
ℹ suites 0
ℹ pass 3
ℹ fail 1
...
  AssertionError [ERR_ASSERTION]: 40 hemp carried alkaid to doyle paid nothing
  + actual - expected

  + [
  +   '7919 -440',
  +   '15838 -440',
  ...
```

Every seed loses the same 440 PoE, which is the signature of a price rule rather than a roll: an
identical number on every seed cannot have come from the RNG. `spreadPerMille`,
`spawnDiscountPerMille` and `scarcityPremiumPerMille` are the three constants that produce it.

A **broken invariant** is the row that is never a tuning question. A negative purse, a negative
stock, a negative lot, a chest below zero, a hold laden past `holdMassKg`, or a voyage that
`sailToDestination` gives up on are all bugs in the sim, and re-tuning a constant until they stop
appearing hides a defect instead of fixing one. The soak reports them per seed with the field
named, so take the seed straight to a focused test in `tests/world`.

When you do land in the top row, a balance edit is a change to pinned state as well as to a
number: `packages/fixtures/goldens/bilge-session-idle-minute.json` pins the whole tuning block,
and every replay hash is a function of it. Re-bless those under `pp-golden-state` and re-record
under `pp-scenario-author`, in the same commit as the tuning change.

## Widen the seeds before you touch a constant

Twelve seeds is enough to fail on, never enough to tune on. Before changing a number, re-read the
same route at four seeds and at twenty-four and see whether the shape moves. Four seeds:

```
node --input-type=module --eval "<the same recipe>" doyle pillage 4
7919 won battles 1 chest 456
15838 won battles 2 chest 488
23757 won battles 2 chest 343
31676 lost battles 1 chest 0
lost: 1
won: 3
```

Twenty-four, with the per-seed lines elided down to the last thirteen:

```
node --input-type=module --eval "<the same recipe>" doyle pillage 24
...
95028 won battles 1 chest 493
102947 lost battles 2 chest 0
110866 lost battles 2 chest 0
118785 lost battles 1 chest 0
126704 won battles 1 chest 427
134623 won battles 1 chest 331
142542 lost battles 1 chest 0
150461 lost battles 2 chest 0
158380 won battles 2 chest 323
166299 won battles 1 chest 335
174218 lost battles 1 chest 0
182137 lost battles 1 chest 0
190056 won battles 2 chest 450
lost: 9
no-encounter: 1
won: 14
```

Four seeds win 3 of 4 fights, twelve win 9 of 11, twenty-four win 14 of 23 — 75, 82 and 61
percent — while the encounter rate holds steady at 4 of 4, 11 of 12 and 23 of 24. The rate the
soak defends moves by twenty points between twelve seeds and twenty-four; the rate at which a
brigand is met at all does not move at all. **The first twelve seeds are the optimistic
half of the range** — a real property of this seed set, and the reason a soak that grazes a bound
is widened rather than answered. The number to defend a tuning change with is the twenty-four-seed
one; the number the suite runs is the twelve-seed one.

## Check a constant actually reaches the tally

A tuning change that moves nothing is as much a finding as one that moves everything, and the
cheapest way to see whether a constant reaches an outcome is to compute the chance it feeds. The
world block's spawn arithmetic is `encounterChancePerMille` plus the league point's difficulty
weighted by `encounterDifficultyWeightPerMille`, then plus `pillageSpawnBonusPerMille` or minus
`tradeSpawnPenaltyPerMille`, clamped into 0 to 1000:

```
node --input-type=module --eval "
import { islandPointOf, leaguePointOf, routeBetween } from './packages/sim/src/index.ts';
import { encounterChanceOf } from './packages/sim/src/world/encounter.ts';
import { BALANCE } from './packages/harness/src/balance.ts';
for (const to of ['doyle','marlowe','sayers-rock']) {
  const route = routeBetween(islandPointOf('alkaid'), islandPointOf(to));
  const line = route.map((id) => {
    const d = leaguePointOf(id).difficultyPerMille;
    return id + '(' + d + ':p' + encounterChanceOf(d,'pillage',BALANCE.world) + '/t' + encounterChanceOf(d,'trade',BALANCE.world) + ')';
  });
  console.log('alkaid -> ' + to + ': ' + line.join(' '));
}
"
alkaid -> doyle: 1(0:p550/t100) 2(125:p612/t162) 8(250:p675/t225)
alkaid -> marlowe: 1(0:p550/t100) 7(125:p612/t162) 14(250:p675/t225)
alkaid -> sayers-rock: 1(0:p550/t100) 2(125:p612/t162) 3(250:p675/t225) 9(375:p737/t287) 16(500:p800/t350)
```

Read it as the tally's cause, and note that this recipe has already earned its place once. The
first tuning of `tradeSpawnPenaltyPerMille` was 400, which exceeded the base plus the difficulty
term at every point below difficulty 375 — so a `trade` voyage clamped to zero on both short
routes, a trade tally came back `[["no-encounter",12]]`, and trade and evade were the same voyage
everywhere a soak was likely to look. The soak found it, the constant was lowered to 150, and the
`t` column above is what a constant that reaches every point looks like.

**Confirm a constant reaches the route you are soaking before you conclude anything from that
route's tally.** The graph carries difficulties 0, 125, 250, 375, 500, 625, 750, 875 and 1000, and
a claim about trade encounters made only on `alkaid -> doyle` is a claim about three of those
nine. A constant that moves nothing on the route you measured is not evidence of a well-tuned
game; it is evidence you measured the wrong route.

## Where things are

```
tests/world/soak.test.ts             the committed soak: seeds, tally and the four assertions
tests/world/loop.ts                  sailToDestination and shipOf, shared with the loop test
tests/world/pillage-loop.test.ts     the single-seed end-to-end loop the soak generalises
tests/harness/battle.test.ts         the multi-seed battle outcome tally, same 7919 stride
balance.json                         world, market and division: the constants this defends
packages/sim/src/world/encounter.ts  encounterChanceOf, and the spawn clamp
packages/sim/src/world/market.ts     the buy and sell price rules
packages/sim/src/world/division.ts   the crew cut and the pirate's share
packages/sim/src/battle/booty.ts     rollBooty, awardBooty and freeHoldOf
```

`pp-golden-state` owns the blessed states a balance edit invalidates and the rule for re-blessing
them; `pp-scenario-author` owns the fixtures and replays that must be re-recorded alongside;
`pp-sim-harness` owns the protocol and `pp-replay-triage` the desync order. This skill owns none
of those artefacts — it owns the numbers they are all recorded against.

Run `npm run check` from the repo root before calling a soak change done. A soak that only passes
its own file has not been checked against the fixtures its constants pin.
