import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CRAB_CELL,
  JELLY_CELL,
  MANEUVER_BAR_GOLD,
  NO_SHAPE,
  PUFFER_CELL,
  flatIndexOf,
  ratingOf,
  resolveBoard,
  shapeOf,
  type Board,
  type ResolveContext,
} from '../../packages/sim/src/index.ts';
import {
  BALANCE,
  bilgingSim,
  paintQuietBoard,
  puzzleOf,
  quietBoard,
  quietCellAt,
  resolveContext,
} from './fixtures.ts';

const WIDTH = 12;
const HEIGHT = 12;
const GOOD_BAND_INDEX = 2;
const GOOD_OUTPUT = BALANCE.bilging.ratingBandsPerMille[GOOD_BAND_INDEX] ?? 0;
const ALWAYS_SPAWN_DRAW = 0;
const CRAB_DRAW = 0;
const PUFFER_DRAW = BALANCE.bilging.crabSpawnPerMille;
const JELLY_DRAW = PUFFER_DRAW + BALANCE.bilging.pufferSpawnPerMille;

function topRowOf(width: number): number[] {
  const cells: number[] = [];
  for (let x = 0; x < width; x += 1) cells.push(x);
  return cells;
}

function settledPairs(board: Board): number[] {
  const context = resolveContext();
  const steps = resolveBoard(board, context, {
    kind: 'poke',
    cells: [flatIndexOf(board, 0, HEIGHT - 1)],
  });

  assert.equal(steps.length, 1);
  return steps[0]?.pairedCells ?? [];
}

function tokenisedTopRow(overrides: Partial<ResolveContext> = {}): Board {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext({
    dutyOutputPerMille: GOOD_OUTPUT,
    drawToken: () => ALWAYS_SPAWN_DRAW,
    ...overrides,
  });
  const steps = resolveBoard(board, context, { kind: 'poke', cells: topRowOf(WIDTH) });

  assert.equal(steps.length, 1);
  return board;
}

test('a shape rides its piece down a settle and dies when that piece clears', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext();
  const riding = flatIndexOf(board, 0, 5);
  const landed = flatIndexOf(board, 0, 6);
  board.shapes[riding] = shapeOf(3, 1);

  resolveBoard(board, context, { kind: 'poke', cells: [flatIndexOf(board, 0, HEIGHT - 1)] });

  assert.equal(board.shapes[riding], NO_SHAPE);
  assert.equal(board.shapes[landed], shapeOf(3, 1));
  assert.equal(board.cells[landed], quietCellAt(0, 5));

  resolveBoard(board, context, { kind: 'poke', cells: [landed] });

  assert.equal(
    board.shapes.every((shape) => shape === NO_SHAPE),
    true,
  );
});

test('two opposite halves of one symbol side by side clear both shapes and keep both colours', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const left = flatIndexOf(board, 3, 5);
  const right = flatIndexOf(board, 4, 5);
  board.shapes[left] = shapeOf(2, 0);
  board.shapes[right] = shapeOf(2, 1);

  assert.deepEqual(settledPairs(board), [left, right]);
  assert.deepEqual([board.shapes[left], board.shapes[right]], [NO_SHAPE, NO_SHAPE]);
  assert.deepEqual([board.cells[left], board.cells[right]], [quietCellAt(3, 5), quietCellAt(4, 5)]);
});

test('two opposite halves of one symbol stacked clear both shapes and keep both colours', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const upper = flatIndexOf(board, 5, 4);
  const lower = flatIndexOf(board, 5, 5);
  board.shapes[upper] = shapeOf(1, 0);
  board.shapes[lower] = shapeOf(1, 1);

  assert.deepEqual(settledPairs(board), [upper, lower]);
  assert.deepEqual([board.shapes[upper], board.shapes[lower]], [NO_SHAPE, NO_SHAPE]);
  assert.deepEqual([board.cells[upper], board.cells[lower]], [quietCellAt(5, 4), quietCellAt(5, 5)]);
});

test('halves of two symbols never pair, and neither do two of the same half', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const symbols = [flatIndexOf(board, 3, 5), flatIndexOf(board, 4, 5)];
  const halves = [flatIndexOf(board, 7, 5), flatIndexOf(board, 8, 5)];
  board.shapes[symbols[0] ?? 0] = shapeOf(2, 0);
  board.shapes[symbols[1] ?? 0] = shapeOf(3, 1);
  board.shapes[halves[0] ?? 0] = shapeOf(1, 0);
  board.shapes[halves[1] ?? 0] = shapeOf(1, 0);

  assert.deepEqual(settledPairs(board), []);
  assert.deepEqual(
    [...symbols, ...halves].map((index) => board.shapes[index]),
    [shapeOf(2, 0), shapeOf(3, 1), shapeOf(1, 0), shapeOf(1, 0)],
  );
});

test('three matching halves in a row give up exactly one pair, the lowest index first', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const first = flatIndexOf(board, 3, 5);
  const second = first + 1;
  const third = first + 2;
  board.shapes[first] = shapeOf(1, 0);
  board.shapes[second] = shapeOf(1, 1);
  board.shapes[third] = shapeOf(1, 0);

  assert.deepEqual(settledPairs(board), [first, second]);
  assert.equal(board.shapes[third], shapeOf(1, 0));
});

test('a token spawns only once the duty rating reaches good', () => {
  const belowGood = GOOD_OUTPUT - 1;

  assert.equal(ratingOf(belowGood, BALANCE.bilging), 'fine');
  assert.equal(ratingOf(GOOD_OUTPUT, BALANCE.bilging), 'good');

  const withheld = tokenisedTopRow({ dutyOutputPerMille: belowGood }).shapes.slice(0, WIDTH);
  const spawned = tokenisedTopRow().shapes.slice(0, WIDTH);

  assert.equal(
    withheld.every((shape) => shape === NO_SHAPE),
    true,
  );
  assert.equal(
    spawned.every((shape) => shape === shapeOf(0, 0)),
    true,
  );
});

test('a token never lands on a crab, a puffer or a jelly', () => {
  const boards = [
    tokenisedTopRow({ waterLineRow: 0, drawCritter: () => CRAB_DRAW }),
    tokenisedTopRow({ drawCritter: () => PUFFER_DRAW }),
    tokenisedTopRow({ drawCritter: () => JELLY_DRAW }),
  ];

  assert.deepEqual(
    boards.map((board) => board.cells.slice(0, WIDTH)),
    [CRAB_CELL, PUFFER_CELL, JELLY_CELL].map((critter) => new Array<number>(WIDTH).fill(critter)),
  );
  assert.deepEqual(
    boards.map((board) => board.shapes.slice(0, WIDTH)),
    boards.map(() => new Array<number>(WIDTH).fill(NO_SHAPE)),
  );
});

test('the maneuver bar takes one point per completed pair and stops at the gold cap', () => {
  const sim = bilgingSim(1);
  const puzzle = puzzleOf(sim);

  for (let move = 1; move <= MANEUVER_BAR_GOLD + 1; move += 1) {
    paintQuietBoard(puzzle.board);
    puzzle.board.shapes.fill(NO_SHAPE);
    puzzle.board.cells[flatIndexOf(puzzle.board, 5, 5)] = PUFFER_CELL;
    puzzle.board.shapes[flatIndexOf(puzzle.board, 0, HEIGHT - 1)] = shapeOf(1, 0);
    puzzle.board.shapes[flatIndexOf(puzzle.board, 1, HEIGHT - 1)] = shapeOf(1, 1);

    assert.equal(sim.dispatch({ op: 'bilge.poke', x: 5, y: 5 }).status, 'accepted');
    assert.equal(puzzle.maneuverBar, Math.min(move, MANEUVER_BAR_GOLD));
  }
});
