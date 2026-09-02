import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CRAB_CELL,
  JELLY_CELL,
  NO_SHAPE,
  PER_MILLE,
  PUFFER_CELL,
  applyBilgeSwap,
  climbCrabs,
  detonationCellsOf,
  flatIndexOf,
  resolveBoard,
  shapeOf,
  stepPointsOf,
  type Board,
  type BoardCell,
} from '../../packages/sim/src/index.ts';
import { BALANCE, quietBoard, quietCellAt, resolveContext } from './fixtures.ts';

const WIDTH = 12;
const HEIGHT = 12;
const DRY_WATER_LINE = 9;
const FLOOD_WATER_LINE = 3;
const CRAB_DRAW = 0;
const PUFFER_DRAW = BALANCE.bilging.crabSpawnPerMille;
const JELLY_DRAW = PUFFER_DRAW + BALANCE.bilging.pufferSpawnPerMille;
const QUIET_WATER_LINE = 5;

function topRowOf(width: number): number[] {
  const cells: number[] = [];
  for (let x = 0; x < width; x += 1) cells.push(x);
  return cells;
}

function refilledTopRow(starLevel: number, waterLineRow: number, drawn: number): BoardCell[] {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext({ starLevel, waterLineRow, drawCritter: () => drawn });
  const steps = resolveBoard(board, context, { kind: 'poke', cells: topRowOf(WIDTH) });
  assert.equal(steps.length, 1);
  return board.cells.slice(0, WIDTH);
}

test('a crab climbs one row per resolve step and clears once it passes the water line', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext({ waterLineRow: DRY_WATER_LINE, bilgePerMille: PER_MILLE });
  board.cells[flatIndexOf(board, 5, 10)] = CRAB_CELL;

  const climbed = resolveBoard(board, context, { kind: 'poke', cells: [0] });

  assert.equal(climbed.length, 1);
  assert.equal(climbed[0]?.crabCells.length, 0);
  assert.equal(board.cells[flatIndexOf(board, 5, 9)], CRAB_CELL);

  const freed = resolveBoard(board, context, { kind: 'poke', cells: [0] });

  assert.equal(freed.length, 1);
  assert.equal(freed[0]?.crabCells.length, 1);
  assert.equal(board.cells.includes(CRAB_CELL), false);
  assert.equal(board.cells.includes(-1), false);
});

test('two crabs freed by one resolve step at full water score the published thirty six', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext({
    waterLineRow: FLOOD_WATER_LINE,
    bilgePerMille: PER_MILLE,
  });
  board.cells[flatIndexOf(board, 2, 3)] = CRAB_CELL;
  board.cells[flatIndexOf(board, 8, 3)] = CRAB_CELL;

  const steps = resolveBoard(board, context, { kind: 'poke', cells: [0] });

  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.crabCells.length, 2);
  assert.equal(stepPointsOf(steps[0]!, context), 36);
});

test('a crab caught in a puffer detonation is removed but pays no crab bonus', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext({
    waterLineRow: FLOOD_WATER_LINE,
    bilgePerMille: PER_MILLE,
  });
  board.cells[flatIndexOf(board, 5, 5)] = PUFFER_CELL;
  board.cells[flatIndexOf(board, 5, 4)] = CRAB_CELL;

  const cells = detonationCellsOf(board, 5, 5);
  const steps = resolveBoard(board, context, { kind: 'poke', cells });

  assert.equal(steps[0]?.crabCells.length, 0);
  assert.equal(stepPointsOf(steps[0]!, context), 0);
  assert.equal(board.cells.includes(CRAB_CELL), false);
});

test('a puffer detonation covers the nine cells around it and clips at the board edge', () => {
  const board = quietBoard(WIDTH, HEIGHT);

  assert.deepEqual(
    detonationCellsOf(board, 5, 5),
    [4, 5, 6].flatMap((y) => [4, 5, 6].map((x) => flatIndexOf(board, x, y))),
  );
  assert.deepEqual(detonationCellsOf(board, 0, 0), [0, 1, WIDTH, WIDTH + 1]);
  assert.deepEqual(detonationCellsOf(board, WIDTH - 1, HEIGHT - 1), [
    flatIndexOf(board, WIDTH - 2, HEIGHT - 2),
    flatIndexOf(board, WIDTH - 1, HEIGHT - 2),
    flatIndexOf(board, WIDTH - 2, HEIGHT - 1),
    flatIndexOf(board, WIDTH - 1, HEIGHT - 1),
  ]);
});

test('a jelly swapped onto a colour sweeps every cell of that colour and itself', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext({ waterLineRow: QUIET_WATER_LINE });
  const jelly = flatIndexOf(board, 5, 5);
  board.cells[jelly] = JELLY_CELL;
  const colour = quietCellAt(6, 5);
  const painted = board.cells.filter((cell) => cell === colour).length;

  const opening = applyBilgeSwap(board, 5, 5);

  assert.equal(opening?.kind, 'jelly');
  assert.equal(opening?.cells.length, painted + 1);
  assert.equal(opening?.cells.includes(jelly), true);

  const steps = resolveBoard(board, context, opening);

  assert.equal(steps[0]?.clearedCells.length, painted + 1);
  assert.equal(stepPointsOf(steps[0]!, context), painted + 1);
  assert.equal(board.cells.includes(JELLY_CELL), false);
});

test('a jelly swapped onto a puffer detonates the puffer and dies inside the blast', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const context = resolveContext({ waterLineRow: QUIET_WATER_LINE });
  const jelly = flatIndexOf(board, 5, 5);
  board.cells[jelly] = JELLY_CELL;
  board.cells[flatIndexOf(board, 6, 5)] = PUFFER_CELL;

  const opening = applyBilgeSwap(board, 5, 5);

  assert.equal(opening?.kind, 'poke');
  assert.deepEqual(opening?.cells, detonationCellsOf(board, 6, 5));
  assert.equal(opening?.cells.includes(jelly), true);

  const steps = resolveBoard(board, context, opening);

  assert.equal(stepPointsOf(steps[0]!, context), 0);
  assert.equal(board.cells.includes(JELLY_CELL), false);
  assert.equal(board.cells.includes(PUFFER_CELL), false);
});

test('two jellies, two puffers and a puffer beside a colour all swap and nothing else', () => {
  const board = quietBoard(WIDTH, HEIGHT);
  const left = flatIndexOf(board, 5, 5);
  const right = flatIndexOf(board, 6, 5);

  board.cells[left] = JELLY_CELL;
  board.cells[right] = JELLY_CELL;
  assert.equal(applyBilgeSwap(board, 5, 5), null);
  assert.deepEqual([board.cells[left], board.cells[right]], [JELLY_CELL, JELLY_CELL]);

  board.cells[left] = PUFFER_CELL;
  board.cells[right] = PUFFER_CELL;
  assert.equal(applyBilgeSwap(board, 5, 5), null);
  assert.deepEqual([board.cells[left], board.cells[right]], [PUFFER_CELL, PUFFER_CELL]);

  board.cells[right] = quietCellAt(6, 5);
  assert.equal(applyBilgeSwap(board, 5, 5), null);
  assert.deepEqual([board.cells[left], board.cells[right]], [quietCellAt(6, 5), PUFFER_CELL]);
});

test('no critter spawns below the star level that unlocks it', () => {
  for (const starLevel of [0, 1, 2]) {
    const row = refilledTopRow(starLevel, 0, CRAB_DRAW);
    assert.equal(
      row.every((cell) => cell >= 0),
      true,
      `star ${starLevel}`,
    );
  }

  assert.equal(refilledTopRow(3, 0, PUFFER_DRAW).every((cell) => cell === PUFFER_CELL), true);
  assert.equal(refilledTopRow(2, 0, PUFFER_DRAW).every((cell) => cell >= 0), true);
  assert.equal(refilledTopRow(4, 0, CRAB_DRAW).every((cell) => cell >= 0), true);
  assert.equal(refilledTopRow(5, 0, CRAB_DRAW).every((cell) => cell === CRAB_CELL), true);
  assert.equal(refilledTopRow(5, 1, CRAB_DRAW).every((cell) => cell >= 0), true);
  assert.equal(refilledTopRow(5, 0, JELLY_DRAW).every((cell) => cell >= 0), true);
  assert.equal(refilledTopRow(6, 0, JELLY_DRAW).every((cell) => cell === JELLY_CELL), true);
  assert.equal(refilledTopRow(7, 0, PER_MILLE - 1).every((cell) => cell >= 0), true);
});

test('a climbing crab carries the shape of the piece it displaces down with it', () => {
  const board: Board = {
    width: 1,
    height: 3,
    cells: [1, 2, CRAB_CELL],
    shapes: [NO_SHAPE, shapeOf(3, 0), NO_SHAPE],
  };

  climbCrabs(board);

  assert.deepEqual(board.cells, [1, CRAB_CELL, 2]);
  assert.deepEqual(board.shapes, [NO_SHAPE, NO_SHAPE, shapeOf(3, 0)]);
});

test('a crab only spawns at or below the water line', () => {
  const dry = refilledTopRow(7, 1, CRAB_DRAW);
  const flooded = refilledTopRow(7, 0, CRAB_DRAW);

  assert.equal(dry.includes(CRAB_CELL), false);
  assert.equal(flooded.every((cell) => cell === CRAB_CELL), true);
});
