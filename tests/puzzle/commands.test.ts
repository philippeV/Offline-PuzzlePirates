import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Sim } from '../../packages/sim/src/index.ts';
import { BALANCE, bilgingSim, clearingSwapOf, puzzleOf } from './fixtures.ts';

test('starting a puzzle without balance is rejected and changes nothing', () => {
  const sim = Sim.create({ seed: 7 });
  const before = sim.hash();
  const result = sim.dispatch({ op: 'puzzle.start', puzzle: 'bilging' });

  assert.deepEqual(result, { status: 'rejected', reason: 'balance-missing' });
  assert.equal(sim.hash(), before);
});

test('starting an unknown puzzle is rejected and changes nothing', () => {
  const sim = Sim.create({ seed: 7, balance: BALANCE });
  const before = sim.hash();
  const result = sim.dispatch({ op: 'puzzle.start', puzzle: 'sailing' });

  assert.deepEqual(result, { status: 'rejected', reason: 'unknown-puzzle' });
  assert.equal(sim.hash(), before);
});

test('starting a second puzzle is rejected and changes nothing', () => {
  const sim = bilgingSim(7);
  const before = sim.hash();
  const result = sim.dispatch({ op: 'puzzle.start', puzzle: 'bilging' });

  assert.deepEqual(result, { status: 'rejected', reason: 'puzzle-already-running' });
  assert.equal(sim.hash(), before);
});

test('swapping with no puzzle running is rejected and changes nothing', () => {
  const sim = Sim.create({ seed: 7, balance: BALANCE });
  const before = sim.hash();
  const result = sim.dispatch({ op: 'bilge.swap', x: 0, y: 0 });

  assert.deepEqual(result, { status: 'rejected', reason: 'no-puzzle-running' });
  assert.equal(sim.hash(), before);
});

test('swapping across the board edge is rejected and changes nothing', () => {
  const sim = bilgingSim(7);
  const before = sim.hash();
  const rightEdge = puzzleOf(sim).board.width - 1;

  assert.deepEqual(sim.dispatch({ op: 'bilge.swap', x: rightEdge, y: 0 }), {
    status: 'rejected',
    reason: 'swap-outside-board',
  });
  assert.deepEqual(sim.dispatch({ op: 'bilge.swap', x: -1, y: 0 }), {
    status: 'rejected',
    reason: 'swap-outside-board',
  });
  assert.equal(sim.hash(), before);
});

test('a fractional swap coordinate is rejected and changes nothing', () => {
  const sim = bilgingSim(7);
  const before = sim.hash();
  const result = sim.dispatch({ op: 'bilge.swap', x: 0.5, y: 0 });

  assert.deepEqual(result, { status: 'rejected', reason: 'non-integer-coordinate' });
  assert.equal(sim.hash(), before);
});

test('an accepted swap scores a move without advancing the tick', () => {
  const sim = bilgingSim(7);
  const swap = clearingSwapOf(puzzleOf(sim).board);
  const result = sim.dispatch({ op: 'bilge.swap', ...swap });

  assert.equal(result.status, 'accepted');
  assert.equal(sim.state.tick, 0);
  assert.equal(puzzleOf(sim).moves, 1);
  assert.ok(puzzleOf(sim).totalScore > 0);
  if (result.status !== 'accepted') return;
  assert.equal(result.events[0]?.type, 'bilge.swapped');
  assert.equal(result.events[1]?.type, 'bilge.cleared');
  assert.equal(result.events[result.events.length - 1]?.type, 'puzzle.scored');
});
