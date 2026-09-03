import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BATTLE_BOARD_HEIGHT,
  BATTLE_BOARD_WIDTH,
  blocksFire,
  createBattleBoard,
  isImpassable,
  isOnBoard,
  setTile,
  tileAt,
} from '../../packages/sim/src/battle/board.ts';
import {
  FACINGS,
  aheadOf,
  beamOf,
  facingAtRank,
  facingRankOf,
  positionsEqual,
  rotateClockwise,
  stepOf,
  turnedFacing,
  type BeamSide,
  type BoardPosition,
  type Facing,
} from '../../packages/sim/src/battle/geometry.ts';

const BEAM_CASES: [Facing, BeamSide, BoardPosition][] = [
  ['north', 'starboard', { x: 1, y: 0 }],
  ['north', 'port', { x: -1, y: 0 }],
  ['east', 'starboard', { x: 0, y: 1 }],
  ['east', 'port', { x: 0, y: -1 }],
  ['south', 'starboard', { x: -1, y: 0 }],
  ['south', 'port', { x: 1, y: 0 }],
  ['west', 'starboard', { x: 0, y: -1 }],
  ['west', 'port', { x: 0, y: 1 }],
];

const ORIGIN: BoardPosition = { x: 10, y: 10 };

test('the facing cycle runs clockwise from north and rank round-trips', () => {
  assert.deepEqual(FACINGS, ['north', 'east', 'south', 'west']);
  for (const facing of FACINGS) {
    assert.equal(facingAtRank(facingRankOf(facing)), facing);
  }
});

test('north is one square up the screen and each facing steps one square', () => {
  assert.deepEqual(stepOf('north'), { x: 0, y: -1 });
  assert.deepEqual(stepOf('east'), { x: 1, y: 0 });
  assert.deepEqual(stepOf('south'), { x: 0, y: 1 });
  assert.deepEqual(stepOf('west'), { x: -1, y: 0 });
  assert.deepEqual(aheadOf(ORIGIN, 'north'), { x: 10, y: 9 });
});

test('four right turns return every facing to where it started', () => {
  for (const facing of FACINGS) {
    assert.equal(turnedFacing(turnedFacing(turnedFacing(turnedFacing(facing, 'right'), 'right'), 'right'), 'right'), facing);
    assert.equal(rotateClockwise(facing, 4), facing);
  }
});

test('a left turn undoes a right turn', () => {
  for (const facing of FACINGS) {
    assert.equal(turnedFacing(turnedFacing(facing, 'right'), 'left'), facing);
    assert.equal(turnedFacing(turnedFacing(facing, 'left'), 'right'), facing);
  }
});

test('rotation wraps for negative and more-than-a-circle quarter turns', () => {
  assert.equal(rotateClockwise('north', -1), 'west');
  assert.equal(rotateClockwise('north', -5), 'west');
  assert.equal(rotateClockwise('north', -9), 'west');
  assert.equal(rotateClockwise('east', 6), 'west');
  assert.equal(rotateClockwise('south', 13), 'west');
  assert.equal(rotateClockwise('west', 0), 'west');
});

test('the beam of each facing lies off the named side at the given distance', () => {
  for (const [facing, side, step] of BEAM_CASES) {
    for (const distance of [1, 3]) {
      assert.deepEqual(
        beamOf(ORIGIN, facing, side, distance),
        { x: ORIGIN.x + step.x * distance, y: ORIGIN.y + step.y * distance },
        `${facing} ${side} at ${distance}`,
      );
    }
  }
});

test('positions compare by coordinate, not identity', () => {
  assert.equal(positionsEqual({ x: 3, y: 4 }, { x: 3, y: 4 }), true);
  assert.equal(positionsEqual({ x: 3, y: 4 }, { x: 4, y: 3 }), false);
});

test('the battle board is 24 by 24 open tiles', () => {
  const board = createBattleBoard();
  assert.equal(board.width, 24);
  assert.equal(board.height, 24);
  assert.equal(BATTLE_BOARD_WIDTH, 24);
  assert.equal(BATTLE_BOARD_HEIGHT, 24);
  assert.equal(board.tiles.length, 576);
  assert.equal(board.tiles.every((tile) => tile.kind === 'open'), true);
  assert.deepEqual(tileAt(board, 23, 23), { kind: 'open' });
  assert.equal(tileAt(board, 24, 23), undefined);
});

test('both rock kinds are impassable and neither is on fire-free water', () => {
  const board = createBattleBoard();
  setTile(board, 4, 5, { kind: 'rock-tall' });
  setTile(board, 6, 7, { kind: 'rock-small' });

  assert.equal(isImpassable(board, { x: 4, y: 5 }), true);
  assert.equal(isImpassable(board, { x: 6, y: 7 }), true);
  assert.equal(isImpassable(board, { x: 0, y: 0 }), false);
});

test('every square off the board is impassable, corners included', () => {
  const board = createBattleBoard();
  const outside: BoardPosition[] = [
    { x: -1, y: -1 },
    { x: 24, y: -1 },
    { x: -1, y: 24 },
    { x: 24, y: 24 },
  ];
  for (const position of outside) {
    assert.equal(isOnBoard(board, position), false);
    assert.equal(isImpassable(board, position), true);
  }
  for (let along = 0; along < 24; along += 1) {
    assert.equal(isImpassable(board, { x: along, y: -1 }), true);
    assert.equal(isImpassable(board, { x: along, y: 24 }), true);
    assert.equal(isImpassable(board, { x: -1, y: along }), true);
    assert.equal(isImpassable(board, { x: 24, y: along }), true);
  }
});

test('tall rocks block the line of fire and small rocks can be fired over', () => {
  const board = createBattleBoard();
  setTile(board, 4, 5, { kind: 'rock-tall' });
  setTile(board, 6, 7, { kind: 'rock-small' });
  setTile(board, 8, 9, { kind: 'wind', facing: 'east' });
  setTile(board, 10, 11, { kind: 'whirlpool', id: 1 });

  assert.equal(blocksFire(board, { x: 4, y: 5 }), true);
  assert.equal(blocksFire(board, { x: 6, y: 7 }), false);
  assert.equal(blocksFire(board, { x: 8, y: 9 }), false);
  assert.equal(blocksFire(board, { x: 10, y: 11 }), false);
  assert.equal(blocksFire(board, { x: 0, y: 0 }), false);
});
