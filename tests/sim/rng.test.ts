import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRngStreams, rngStream } from '../../packages/sim/src/rng.ts';

const SEED = 20260902;

const BATTLE_BOARD_DRAWS = [
  1448904808, 127560259, 293048588, 2857618201, 3304202891, 3068676208, 250585352, 1855480734,
  547406391, 4192622975, 2835115423, 3204431381, 1154245918, 655853201, 1357092603, 206373217,
];

test('nextUint32 reproduces its golden vector exactly', () => {
  const streams = createRngStreams();
  const stream = rngStream(SEED, streams, 'battle.board');
  const drawn = BATTLE_BOARD_DRAWS.map(() => stream.nextUint32());
  assert.deepEqual(drawn, BATTLE_BOARD_DRAWS);
});

test('every draw is a uint32 the permutation could not have produced by truncation', () => {
  const streams = createRngStreams();
  const stream = rngStream(SEED, streams, 'battle.board');
  for (let index = 0; index < 256; index += 1) {
    const draw = stream.nextUint32();
    assert.ok(Number.isSafeInteger(draw));
    assert.ok(draw >= 0 && draw < 0x100000000);
  }
});

test('two named streams draw independently of each other', () => {
  const interleaved = createRngStreams();
  const plan = rngStream(SEED, interleaved, 'battle.brigandPlan');
  const poe = rngStream(SEED, interleaved, 'booty.poe');
  const mixed = [plan.nextUint32(), poe.nextUint32(), plan.nextUint32(), poe.nextUint32()];

  const alone = createRngStreams();
  const onlyPlan = rngStream(SEED, alone, 'battle.brigandPlan');
  const solo = [onlyPlan.nextUint32(), onlyPlan.nextUint32()];

  assert.deepEqual([mixed[0], mixed[2]], solo);
});

test('a stream name changes the sequence', () => {
  const streams = createRngStreams();
  const board = rngStream(SEED, streams, 'battle.board');
  const plan = rngStream(SEED, streams, 'battle.brigandPlan');
  assert.notEqual(board.nextUint32(), plan.nextUint32());
});

test('the root seed changes the sequence', () => {
  const first = rngStream(SEED, createRngStreams(), 'battle.board');
  const second = rngStream(SEED + 1, createRngStreams(), 'battle.board');
  assert.notEqual(first.nextUint32(), second.nextUint32());
});

test('opening a stream registers its cursor before any draw', () => {
  const streams = createRngStreams();
  rngStream(SEED, streams, 'battle.board');
  assert.deepEqual(Object.keys(streams), ['battle.board']);
  assert.equal(streams['battle.board']?.draws, 0);
});

test('the cursor counts every draw', () => {
  const streams = createRngStreams();
  const stream = rngStream(SEED, streams, 'battle.board');
  for (let index = 0; index < 7; index += 1) stream.nextUint32();
  assert.equal(streams['battle.board']?.draws, 7);
});

test('reopening a stream resumes its cursor rather than restarting it', () => {
  const streams = createRngStreams();
  rngStream(SEED, streams, 'battle.board').nextUint32();
  const resumed = rngStream(SEED, streams, 'battle.board');
  assert.equal(resumed.nextUint32(), BATTLE_BOARD_DRAWS[1]);
});

test('nextIntInRange stays inside every span slice three draws', () => {
  const streams = createRngStreams();
  const stream = rngStream(SEED, streams, 'battle.brigandPlan');
  for (const span of [3, 4, 6, 7, 52]) {
    for (let index = 0; index < 512; index += 1) {
      const value = stream.nextIntInRange(0, span);
      assert.ok(value >= 0 && value < span, `span ${span} produced ${value}`);
    }
  }
});

test('nextIntInRange honours a non-zero lower bound', () => {
  const streams = createRngStreams();
  const stream = rngStream(SEED, streams, 'battle.brigandPlan');
  for (let index = 0; index < 256; index += 1) {
    const value = stream.nextIntInRange(-1, 2);
    assert.ok(value === -1 || value === 0 || value === 1);
  }
});

test('nextIntInRange refuses an empty range', () => {
  const stream = rngStream(SEED, createRngStreams(), 'battle.brigandPlan');
  assert.throws(() => stream.nextIntInRange(4, 4), RangeError);
  assert.throws(() => stream.nextIntInRange(4, 3), RangeError);
});
