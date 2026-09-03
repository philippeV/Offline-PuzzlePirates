import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CRAB_CELL,
  EMPTY_CELL,
  JELLY_CELL,
  NO_SHAPE,
  PUFFER_CELL,
  flatIndexOf,
  type Board,
  type BoardShape,
} from '../../packages/view/src/client/rules.ts';
import { gestureAt } from '../../packages/view/src/scenes/bilgeGesture.ts';

const BOARD_WIDTH = 6;
const BOARD_HEIGHT = 6;

function bilge(): Board {
  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    cells: new Array<number>(BOARD_WIDTH * BOARD_HEIGHT).fill(0),
    shapes: new Array<BoardShape>(BOARD_WIDTH * BOARD_HEIGHT).fill(NO_SHAPE),
  };
}

function place(board: Board, x: number, y: number, cell: number): Board {
  board.cells[flatIndexOf(board, x, y)] = cell;
  return board;
}

test('a puffer under the pointer pops', () => {
  const board = place(bilge(), 2, 3, PUFFER_CELL);

  assert.equal(gestureAt(board, { x: 2, y: 3 }), 'poke');
});

test('any tile that is no puffer starts a swap', () => {
  const board = bilge();
  place(board, 1, 1, CRAB_CELL);
  place(board, 2, 1, JELLY_CELL);
  place(board, 3, 1, EMPTY_CELL);

  assert.equal(gestureAt(board, { x: 0, y: 1 }), 'swap');
  assert.equal(gestureAt(board, { x: 1, y: 1 }), 'swap');
  assert.equal(gestureAt(board, { x: 2, y: 1 }), 'swap');
  assert.equal(gestureAt(board, { x: 3, y: 1 }), 'swap');
});

test('a puffer in the last column pops, the cell the cursor clamp used to hide', () => {
  const lastColumn = BOARD_WIDTH - 1;
  const board = place(bilge(), lastColumn, 4, PUFFER_CELL);

  assert.equal(gestureAt(board, { x: lastColumn, y: 4 }), 'poke');
});

test('a plain tile in the last column still asks for the swap the sim refuses', () => {
  const board = bilge();

  assert.equal(gestureAt(board, { x: BOARD_WIDTH - 1, y: 0 }), 'swap');
});
