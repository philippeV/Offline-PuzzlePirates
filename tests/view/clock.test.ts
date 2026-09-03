import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TICKS_PER_SECOND } from '../../packages/sim/src/index.ts';
import { MAXIMUM_CATCH_UP_TICKS, budgetOf } from '../../packages/view/src/clock.ts';

test('a second of wall clock buys exactly a second of ticks', () => {
  const budget = budgetOf(1000, 0);

  assert.equal(budget.ticks, TICKS_PER_SECOND);
  assert.equal(budget.carry, 0);
});

test('two frames that straddle a tick lose nothing between them', () => {
  const first = budgetOf(25, 0);
  const second = budgetOf(25, first.carry);

  assert.equal(first.ticks, 1);
  assert.equal(first.ticks + second.ticks, 3);
  assert.equal(second.carry, 0);
});

test('a thousand ragged frames drift by less than a tick', () => {
  let carry = 0;
  let ticks = 0;
  for (let frame = 0; frame < 1000; frame += 1) {
    const budget = budgetOf(7, carry);
    carry = budget.carry;
    ticks += budget.ticks;
  }

  assert.equal(ticks, Math.floor((7 * 1000 * TICKS_PER_SECOND) / 1000));
});

test('a long stall is clamped instead of spiralling', () => {
  const budget = budgetOf(60_000, 0);

  assert.equal(budget.ticks, MAXIMUM_CATCH_UP_TICKS);
  assert.equal(budget.carry, 0);
});

test('a clock that runs backwards buys nothing', () => {
  const budget = budgetOf(-5, 400);

  assert.equal(budget.ticks, 0);
  assert.equal(budget.carry, 400);
});
