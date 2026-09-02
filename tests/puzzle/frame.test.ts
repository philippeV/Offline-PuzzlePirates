import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  INTERVALS_PER_FRAME,
  PER_MILLE,
  POINTS_PER_MOVE_AT_FULL_EFFICIENCY,
  TICKS_PER_INTERVAL,
  createScoringFrame,
  currentIntervalOf,
  performanceOf,
  ratingOf,
  recordMove,
  rotateFrame,
} from '../../packages/sim/src/index.ts';
import { BALANCE, bilgingSim, puzzleOf } from './fixtures.ts';

const SPARKLY_PER_MILLE = 1333;

test('a fresh scoring frame holds eighteen empty intervals', () => {
  const frame = createScoringFrame();

  assert.equal(frame.intervals.length, INTERVALS_PER_FRAME);
  assert.deepEqual(currentIntervalOf(frame), { moves: 0, points: 0 });
  assert.equal(performanceOf(frame), 0);
});

test('an interval that expires with no move is charged one move and no points', () => {
  const frame = createScoringFrame();
  rotateFrame(frame);

  assert.equal(frame.intervals.length, INTERVALS_PER_FRAME);
  assert.deepEqual(frame.intervals[INTERVALS_PER_FRAME - 2], { moves: 1, points: 0 });
  assert.deepEqual(currentIntervalOf(frame), { moves: 0, points: 0 });
  assert.equal(performanceOf(frame), 0);
});

test('three points per move reads as one thousand per mille', () => {
  const frame = createScoringFrame();
  for (let move = 0; move < 4; move += 1) recordMove(frame, POINTS_PER_MOVE_AT_FULL_EFFICIENCY);

  assert.equal(performanceOf(frame), PER_MILLE);
  assert.equal(ratingOf(performanceOf(frame), BALANCE.bilging), 'fine');
  assert.equal(ratingOf(0, BALANCE.bilging), 'booched');
  assert.equal(ratingOf(SPARKLY_PER_MILLE, BALANCE.bilging), 'excellent');
});

test('a running puzzle rotates its scoring frame every six hundred ticks', () => {
  const sim = bilgingSim(7);
  sim.step(TICKS_PER_INTERVAL - 1);

  assert.equal(puzzleOf(sim).intervalTick, TICKS_PER_INTERVAL - 1);
  assert.ok(puzzleOf(sim).frame.intervals.every((interval) => interval.moves === 0));

  sim.step(1);

  assert.equal(puzzleOf(sim).intervalTick, 0);
  assert.deepEqual(puzzleOf(sim).frame.intervals[INTERVALS_PER_FRAME - 2], { moves: 1, points: 0 });
  assert.equal(puzzleOf(sim).dutyOutputPerMille, 0);
});
