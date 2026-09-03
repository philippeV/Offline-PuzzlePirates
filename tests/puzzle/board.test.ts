import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BILGE_RULES,
  CRAB_CELL,
  EMPTY_CELL,
  JELLY_CELL,
  MINIMUM_DRY_ROWS,
  MINIMUM_RUN_LENGTH,
  MINIMUM_WATER_ROWS,
  NO_SHAPE,
  PER_MILLE,
  PUFFER_CELL,
  applyGravity,
  clearCells,
  findRuns,
  refillBoard,
  shapeOf,
  swapCells,
  waterLineRowOf,
  waterRowsOf,
  type Board,
  type BoardCell,
  type BoardShape,
} from '../../packages/sim/src/index.ts';
import { BALANCE, bilgingSim, puzzleOf } from './fixtures.ts';

const SEED_COUNT = 24;

function bareBoard(width: number, height: number, cells: BoardCell[]): Board {
  return { width, height, cells, shapes: new Array<BoardShape>(width * height).fill(NO_SHAPE) };
}

test('a freshly generated bilge board contains no run of three', () => {
  for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
    const board = puzzleOf(bilgingSim(seed)).board;
    assert.equal(board.cells.length, board.width * board.height);
    assert.deepEqual(findRuns(board, MINIMUM_RUN_LENGTH), [], `seed ${seed}`);
  }
});

test('gravity drops each column to the bottom preserving its order', () => {
  const board = bareBoard(2, 4, [1, 2, 3, 4, 5, 6, 7, 8]);
  clearCells(board, [2, 4, 7]);
  applyGravity(board);

  assert.deepEqual(board.cells, [EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, 2, 1, 4, 7, 6]);
});

test('a crab anchors its column so each segment compacts on its own', () => {
  const above = bareBoard(1, 5, [1, 2, CRAB_CELL, 3, 4]);
  clearCells(above, [1]);
  applyGravity(above);

  assert.deepEqual(above.cells, [EMPTY_CELL, 1, CRAB_CELL, 3, 4]);

  const below = bareBoard(1, 5, [1, 2, CRAB_CELL, 3, 4]);
  clearCells(below, [3]);
  applyGravity(below);

  assert.deepEqual(below.cells, [1, 2, CRAB_CELL, EMPTY_CELL, 4]);
});

test('a critter never forms a run and never extends one', () => {
  const crabs = bareBoard(4, 1, [CRAB_CELL, CRAB_CELL, CRAB_CELL, CRAB_CELL]);
  const split = bareBoard(5, 1, [1, 1, PUFFER_CELL, 1, 1]);
  const trailing = bareBoard(3, 1, [1, 1, JELLY_CELL]);

  assert.deepEqual(findRuns(crabs, MINIMUM_RUN_LENGTH), []);
  assert.deepEqual(findRuns(split, MINIMUM_RUN_LENGTH), []);
  assert.deepEqual(findRuns(trailing, MINIMUM_RUN_LENGTH), []);
});

test('a refill leaves no empty cell and draws in ascending index order', () => {
  const board = bareBoard(2, 2, [EMPTY_CELL, 5, EMPTY_CELL, 6]);
  let drawn = 100;

  refillBoard(board, () => {
    drawn += 1;
    return drawn;
  });

  assert.deepEqual(board.cells, [101, 5, 102, 6]);
  assert.ok(!board.cells.includes(EMPTY_CELL));
});

test('a swap carries each shape along with the cell it sits on', () => {
  const board: Board = {
    width: 2,
    height: 1,
    cells: [1, 2],
    shapes: [shapeOf(0, 0), shapeOf(2, 1)],
  };

  assert.equal(swapCells(board, 0, 0, BILGE_RULES), true);

  assert.deepEqual(board.cells, [2, 1]);
  assert.deepEqual(board.shapes, [shapeOf(2, 1), shapeOf(0, 0)]);
});

test('clearing a cell clears the shape it carried', () => {
  const board: Board = {
    width: 2,
    height: 1,
    cells: [1, 2],
    shapes: [shapeOf(1, 0), shapeOf(3, 1)],
  };

  clearCells(board, [0]);

  assert.deepEqual(board.cells, [EMPTY_CELL, 2]);
  assert.deepEqual(board.shapes, [NO_SHAPE, shapeOf(3, 1)]);
});

test('a refilled cell comes back bare', () => {
  const board: Board = {
    width: 2,
    height: 1,
    cells: [EMPTY_CELL, 2],
    shapes: [shapeOf(1, 1), shapeOf(2, 0)],
  };

  refillBoard(board, () => 7);

  assert.deepEqual(board.cells, [7, 2]);
  assert.deepEqual(board.shapes, [NO_SHAPE, shapeOf(2, 0)]);
});

test('gravity drops each shape onto the same cell it started on', () => {
  const board: Board = {
    width: 1,
    height: 5,
    cells: [1, 2, 3, 4, 5],
    shapes: [shapeOf(1, 0), shapeOf(0, 0), NO_SHAPE, shapeOf(1, 1), NO_SHAPE],
  };

  clearCells(board, [0, 2]);
  applyGravity(board);

  assert.deepEqual(board.cells, [EMPTY_CELL, EMPTY_CELL, 2, 4, 5]);
  assert.deepEqual(board.shapes, [NO_SHAPE, NO_SHAPE, shapeOf(0, 0), shapeOf(1, 1), NO_SHAPE]);
});

test('a crab anchors the shapes of its column as it anchors the cells', () => {
  const board: Board = {
    width: 1,
    height: 6,
    cells: [1, 2, CRAB_CELL, 3, 4, 5],
    shapes: [shapeOf(0, 1), NO_SHAPE, shapeOf(2, 0), shapeOf(3, 1), NO_SHAPE, NO_SHAPE],
  };

  clearCells(board, [1, 4]);
  applyGravity(board);

  assert.deepEqual(board.cells, [EMPTY_CELL, 1, CRAB_CELL, EMPTY_CELL, 3, 5]);
  assert.deepEqual(board.shapes, [
    NO_SHAPE,
    shapeOf(0, 1),
    shapeOf(2, 0),
    NO_SHAPE,
    shapeOf(3, 1),
    NO_SHAPE,
  ]);
});

test('the water line keeps three water rows and three dry rows at every bilge level', () => {
  const height = BALANCE.bilging.boardHeight;
  for (let bilgePerMille = 0; bilgePerMille <= PER_MILLE; bilgePerMille += 1) {
    const waterRows = waterRowsOf(height, bilgePerMille);
    const waterLineRow = waterLineRowOf(height, bilgePerMille);
    assert.ok(waterRows >= MINIMUM_WATER_ROWS, `water rows at ${bilgePerMille}`);
    assert.ok(waterLineRow >= MINIMUM_DRY_ROWS, `dry rows at ${bilgePerMille}`);
    assert.equal(waterLineRow, height - waterRows);
  }

  assert.equal(waterRowsOf(height, 0), MINIMUM_WATER_ROWS);
  assert.equal(waterRowsOf(height, PER_MILLE), height - MINIMUM_DRY_ROWS);
});
