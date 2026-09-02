import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createBattleBoard,
  setTile,
  whirlpoolOriginOf,
  type BattleBoard,
} from '../../packages/sim/src/battle/board.ts';
import {
  FACINGS,
  stepOf,
  type BoardPosition,
  type Facing,
} from '../../packages/sim/src/battle/geometry.ts';
import {
  tileEffect,
  whirlEffect,
  windEffect,
  type Pose,
} from '../../packages/sim/src/battle/tiles.ts';

const PHASES_PER_TURN = 4;
const WHIRLPOOL_ID = 1;
const WHIRLPOOL_ORIGIN: BoardPosition = { x: 5, y: 7 };
const WHIRLPOOL_CORNERS: BoardPosition[] = [
  { x: 5, y: 7 },
  { x: 6, y: 7 },
  { x: 5, y: 8 },
  { x: 6, y: 8 },
];

function boardWithWhirlpool(): BattleBoard {
  const board = createBattleBoard();
  for (const corner of WHIRLPOOL_CORNERS) {
    setTile(board, corner.x, corner.y, { kind: 'whirlpool', id: WHIRLPOOL_ID });
  }
  return board;
}

function poseAt(position: BoardPosition, facing: Facing): Pose {
  return { position: { x: position.x, y: position.y }, facing };
}

test('a whirlpool is found by the top-left cell of its two-by-two block', () => {
  const board = boardWithWhirlpool();
  assert.deepEqual(whirlpoolOriginOf(board, WHIRLPOOL_ID), WHIRLPOOL_ORIGIN);
  assert.equal(whirlpoolOriginOf(board, 2), undefined);
});

test('one whirl moves a ship to the diagonally opposite corner and turns it clockwise', () => {
  const board = boardWithWhirlpool();
  assert.deepEqual(whirlEffect(board, WHIRLPOOL_ID, poseAt({ x: 5, y: 7 }, 'north')), {
    position: { x: 6, y: 8 },
    facing: 'east',
  });
  assert.deepEqual(whirlEffect(board, WHIRLPOOL_ID, poseAt({ x: 6, y: 8 }, 'east')), {
    position: { x: 5, y: 7 },
    facing: 'south',
  });
  assert.deepEqual(whirlEffect(board, WHIRLPOOL_ID, poseAt({ x: 6, y: 7 }, 'west')), {
    position: { x: 5, y: 8 },
    facing: 'north',
  });
});

test('four phases in a whirlpool restore the exact position and orientation', () => {
  const board = boardWithWhirlpool();
  for (const corner of WHIRLPOOL_CORNERS) {
    for (const facing of FACINGS) {
      const start = poseAt(corner, facing);
      let pose = start;
      for (let phase = 0; phase < PHASES_PER_TURN; phase += 1) {
        pose = tileEffect(board, pose);
      }
      assert.deepEqual(pose, start, `${corner.x},${corner.y} facing ${facing}`);
    }
  }
});

test('a whirlpool turn closes after four phases and no sooner', () => {
  const board = boardWithWhirlpool();
  const start = poseAt(WHIRLPOOL_ORIGIN, 'north');
  let pose = start;
  for (let phase = 1; phase < PHASES_PER_TURN; phase += 1) {
    pose = tileEffect(board, pose);
    assert.notDeepEqual(pose, start, `phase ${phase}`);
  }
});

test('a whirl leaves the caller pose untouched', () => {
  const board = boardWithWhirlpool();
  const pose = poseAt(WHIRLPOOL_ORIGIN, 'north');
  whirlEffect(board, WHIRLPOOL_ID, pose);
  assert.deepEqual(pose, { position: { x: 5, y: 7 }, facing: 'north' });
});

test('wind moves a ship one square to leeward without changing orientation', () => {
  const board = createBattleBoard();
  const position: BoardPosition = { x: 10, y: 10 };
  for (const windFacing of FACINGS) {
    setTile(board, position.x, position.y, { kind: 'wind', facing: windFacing });
    const step = stepOf(windFacing);
    for (const shipFacing of FACINGS) {
      const expected = {
        position: { x: position.x + step.x, y: position.y + step.y },
        facing: shipFacing,
      };
      const pose = poseAt(position, shipFacing);
      assert.deepEqual(windEffect({ kind: 'wind', facing: windFacing }, pose), expected);
      assert.deepEqual(tileEffect(board, pose), expected);
      assert.deepEqual(pose, poseAt(position, shipFacing));
    }
  }
});

test('open water and rocks leave a resting ship exactly where it is', () => {
  const board = createBattleBoard();
  setTile(board, 3, 3, { kind: 'rock-tall' });
  setTile(board, 4, 4, { kind: 'rock-small' });
  for (const position of [{ x: 1, y: 1 }, { x: 3, y: 3 }, { x: 4, y: 4 }]) {
    const pose = poseAt(position, 'east');
    assert.deepEqual(tileEffect(board, pose), pose);
  }
});

test('a pose off the board is left alone', () => {
  const board = createBattleBoard();
  const pose = poseAt({ x: -1, y: 30 }, 'south');
  assert.deepEqual(tileEffect(board, pose), pose);
});
