import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CRAB_CELL,
  JELLY_CELL,
  PER_MILLE,
  PUFFER_CELL,
  Sim,
  flatIndexOf,
  resolveBoard,
  type BilgeClearedEvent,
  type Board,
  type SimEvent,
} from '../../packages/sim/src/index.ts';
import {
  bilgingSim,
  paintQuietBoard,
  puzzleOf,
  quietBoard,
  quietCellAt,
  resolveContext,
} from './fixtures.ts';

const PUBLISHED_STAR_LEVEL = 7;
const FLOOD_WATER_LINE = 3;
const DRY_WATER_LINE = 9;
const SCRIPTED_SEED = 1;
const COMBO_SWAP = { x: 3, y: 6 };

function paintComboSwap(board: Board): void {
  paintQuietBoard(board);
  board.cells[flatIndexOf(board, 3, 4)] = 0;
  board.cells[flatIndexOf(board, 3, 5)] = 0;
  board.cells[flatIndexOf(board, 3, 6)] = 1;
  board.cells[flatIndexOf(board, 3, 7)] = 0;
  board.cells[flatIndexOf(board, 4, 5)] = 1;
  board.cells[flatIndexOf(board, 4, 6)] = 0;
  board.cells[flatIndexOf(board, 4, 7)] = 1;
}

function clearedEventsOf(events: SimEvent[]): BilgeClearedEvent[] {
  return events.filter((event): event is BilgeClearedEvent => event.type === 'bilge.cleared');
}

function scoredPointsOf(events: SimEvent[]): number {
  const scored = events.find((event) => event.type === 'puzzle.scored');
  if (scored === undefined || scored.type !== 'puzzle.scored') throw new Error('nothing scored');
  return scored.points;
}

function acceptedEventsOf(sim: Sim, command: Parameters<Sim['dispatch']>[0]): SimEvent[] {
  const result = sim.dispatch(command);
  if (result.status !== 'accepted') throw new Error(`the command was ${result.reason}`);
  return result.events;
}

function settleTicksOfClearing(clearedRow: number, waterLineRow: number): number {
  const board = quietBoard(12, 12);
  const context = resolveContext({ waterLineRow });
  const steps = resolveBoard(board, context, {
    kind: 'poke',
    cells: [flatIndexOf(board, 0, clearedRow)],
  });
  assert.equal(steps.length, 1);
  return steps[0]?.settleTicks ?? -1;
}

test('a swap that clears a four run beside a three run scores the published combo', () => {
  const sim = bilgingSim(SCRIPTED_SEED);
  const puzzle = puzzleOf(sim);
  puzzle.starLevel = PUBLISHED_STAR_LEVEL;
  paintComboSwap(puzzle.board);

  const events = acceptedEventsOf(sim, { op: 'bilge.swap', ...COMBO_SWAP });
  const cleared = clearedEventsOf(events);

  assert.equal(cleared.length, 1);
  assert.equal(cleared[0]?.cells.length, 7);
  assert.equal(cleared[0]?.points, 16);
  assert.equal(cleared[0]?.settleTicks, 12);
  assert.equal(scoredPointsOf(events), 16);
  assert.equal(puzzle.totalScore, 16);
  assert.equal(puzzle.moves, 1);
});

test('crabs freed by a swap at full water add their bonus to the scored move', () => {
  const sim = bilgingSim(SCRIPTED_SEED);
  const puzzle = puzzleOf(sim);
  puzzle.starLevel = PUBLISHED_STAR_LEVEL;
  puzzle.bilgePerMille = PER_MILLE;
  puzzle.waterLineRow = FLOOD_WATER_LINE;
  paintComboSwap(puzzle.board);
  puzzle.board.cells[flatIndexOf(puzzle.board, 0, 3)] = CRAB_CELL;
  puzzle.board.cells[flatIndexOf(puzzle.board, 2, 3)] = CRAB_CELL;

  const events = acceptedEventsOf(sim, { op: 'bilge.swap', ...COMBO_SWAP });
  const cleared = clearedEventsOf(events);

  assert.equal(cleared.length, 1);
  assert.equal(cleared[0]?.points, 16 + 36);
  assert.deepEqual(cleared[0]?.crabs, [
    flatIndexOf(puzzle.board, 0, 2),
    flatIndexOf(puzzle.board, 2, 2),
  ]);
  assert.equal(scoredPointsOf(events), 52);
  assert.equal(puzzle.board.cells.includes(CRAB_CELL), false);
});

test('poking a puffer clears its nine cells, pays nothing and costs a move', () => {
  const sim = bilgingSim(SCRIPTED_SEED);
  const puzzle = puzzleOf(sim);
  puzzle.starLevel = PUBLISHED_STAR_LEVEL;
  paintQuietBoard(puzzle.board);
  puzzle.board.cells[flatIndexOf(puzzle.board, 3, 5)] = PUFFER_CELL;

  const events = acceptedEventsOf(sim, { op: 'bilge.poke', x: 3, y: 5 });
  const cleared = clearedEventsOf(events);

  assert.equal(events[0]?.type, 'bilge.poked');
  assert.equal(events[events.length - 1]?.type, 'puzzle.scored');
  assert.equal(cleared[0]?.chain, 0);
  assert.equal(cleared[0]?.cells.length, 9);
  assert.equal(cleared[0]?.points, 0);
  assert.equal(puzzle.moves, 1);
});

test('swapping a jelly onto a colour scores one point for every cell it sweeps', () => {
  const sim = bilgingSim(SCRIPTED_SEED);
  const puzzle = puzzleOf(sim);
  puzzle.starLevel = PUBLISHED_STAR_LEVEL;
  paintQuietBoard(puzzle.board);
  puzzle.board.cells[flatIndexOf(puzzle.board, 2, 5)] = JELLY_CELL;
  const colour = quietCellAt(3, 5);
  const painted = puzzle.board.cells.filter((cell) => cell === colour).length;

  const events = acceptedEventsOf(sim, { op: 'bilge.swap', x: 2, y: 5 });
  const cleared = clearedEventsOf(events);

  assert.equal(painted, 18);
  assert.equal(cleared[0]?.cells.length, painted + 1);
  assert.equal(cleared[0]?.points, painted + 1);
  assert.equal(puzzle.moves, 1);
});

test('a fall that lands below the water line is reported as slower than a dry fall', () => {
  assert.equal(settleTicksOfClearing(0, DRY_WATER_LINE), 0);
  assert.equal(settleTicksOfClearing(4, DRY_WATER_LINE), 3);
  assert.equal(settleTicksOfClearing(11, DRY_WATER_LINE), 6);
  assert.equal(settleTicksOfClearing(4, 0), 6);
});
