import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CRAB_CELL,
  EMPTY_CELL,
  JELLY_CELL,
  MINIMUM_DRY_ROWS,
  MINIMUM_RUN_LENGTH,
  MINIMUM_WATER_ROWS,
  PER_MILLE,
  PUFFER_CELL,
  applyGravity,
  clearCells,
  findRuns,
  refillBoard,
  waterLineRowOf,
  waterRowsOf,
  type Board,
} from '../../packages/sim/src/index.ts';
import { BALANCE, bilgingSim, puzzleOf } from './fixtures.ts';

const SEED_COUNT = 24;

test('a freshly generated bilge board contains no run of three', () => {
  for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
    const board = puzzleOf(bilgingSim(seed)).board;
    assert.equal(board.cells.length, board.width * board.height);
    assert.deepEqual(findRuns(board, MINIMUM_RUN_LENGTH), [], `seed ${seed}`);
  }
});

test('gravity drops each column to the bottom preserving its order', () => {
  const board: Board = { width: 2, height: 4, cells: [1, 2, 3, 4, 5, 6, 7, 8] };
  clearCells(board, [2, 4, 7]);
  applyGravity(board);

  assert.deepEqual(board.cells, [EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, 2, 1, 4, 7, 6]);
});

test('a crab anchors its column so each segment compacts on its own', () => {
  const above: Board = { width: 1, height: 5, cells: [1, 2, CRAB_CELL, 3, 4] };
  clearCells(above, [1]);
  applyGravity(above);

  assert.deepEqual(above.cells, [EMPTY_CELL, 1, CRAB_CELL, 3, 4]);

  const below: Board = { width: 1, height: 5, cells: [1, 2, CRAB_CELL, 3, 4] };
  clearCells(below, [3]);
  applyGravity(below);

  assert.deepEqual(below.cells, [1, 2, CRAB_CELL, EMPTY_CELL, 4]);
});

test('a critter never forms a run and never extends one', () => {
  const crabs: Board = { width: 4, height: 1, cells: [CRAB_CELL, CRAB_CELL, CRAB_CELL, CRAB_CELL] };
  const split: Board = { width: 5, height: 1, cells: [1, 1, PUFFER_CELL, 1, 1] };
  const trailing: Board = { width: 3, height: 1, cells: [1, 1, JELLY_CELL] };

  assert.deepEqual(findRuns(crabs, MINIMUM_RUN_LENGTH), []);
  assert.deepEqual(findRuns(split, MINIMUM_RUN_LENGTH), []);
  assert.deepEqual(findRuns(trailing, MINIMUM_RUN_LENGTH), []);
});

test('a refill leaves no empty cell and draws in ascending index order', () => {
  const board: Board = { width: 2, height: 2, cells: [EMPTY_CELL, 5, EMPTY_CELL, 6] };
  let drawn = 100;

  refillBoard(board, () => {
    drawn += 1;
    return drawn;
  });

  assert.deepEqual(board.cells, [101, 5, 102, 6]);
  assert.ok(!board.cells.includes(EMPTY_CELL));
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
