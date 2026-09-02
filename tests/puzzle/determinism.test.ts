import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BILGE_FILL_STREAM,
  BILGE_REFILL_STREAM,
  DRIFT_STREAM,
  Sim,
} from '../../packages/sim/src/index.ts';
import { BALANCE, bilgingSim, clearingSwapOf, puzzleOf } from './fixtures.ts';

const TICKS_PER_MOVE = 13;
const MOVES = 5;

function runScript(seed: number): Sim {
  const sim = bilgingSim(seed);
  for (let move = 0; move < MOVES; move += 1) {
    const swap = clearingSwapOf(puzzleOf(sim).board);
    assert.equal(sim.dispatch({ op: 'bilge.swap', ...swap }).status, 'accepted');
    sim.step(TICKS_PER_MOVE);
  }
  return sim;
}

test('the same seed and bilging script produce the same state hash', () => {
  assert.equal(runScript(0xc0ffee).hash(), runScript(0xc0ffee).hash());
});

test('a different seed produces a different bilging state hash', () => {
  assert.notEqual(runScript(0xc0ffee).hash(), runScript(0xdecafb).hash());
});

test('stepping a bilging session draws only from the drift stream', () => {
  const sim = bilgingSim(1);
  const fillDraws = sim.state.rngStreams[BILGE_FILL_STREAM]?.draws;
  sim.step(25);

  assert.equal(sim.state.rngStreams[DRIFT_STREAM]?.draws, 25);
  assert.equal(sim.state.rngStreams[BILGE_FILL_STREAM]?.draws, fillDraws);
  assert.equal(sim.state.rngStreams[BILGE_REFILL_STREAM], undefined);
});

test('a sim with no puzzle running leaves no bilge cursor in state', () => {
  const sim = Sim.create({ seed: 1, balance: BALANCE });

  assert.deepEqual(sim.state.rngStreams, {});
});

test('drawing from the refill stream does not shift the fill stream', () => {
  const sim = bilgingSim(0xc0ffee);
  const fillBefore = { ...sim.state.rngStreams[BILGE_FILL_STREAM] };
  const swap = clearingSwapOf(puzzleOf(sim).board);

  assert.equal(sim.dispatch({ op: 'bilge.swap', ...swap }).status, 'accepted');

  assert.ok((sim.state.rngStreams[BILGE_REFILL_STREAM]?.draws ?? 0) > 0);
  assert.deepEqual({ ...sim.state.rngStreams[BILGE_FILL_STREAM] }, fillBefore);
});
