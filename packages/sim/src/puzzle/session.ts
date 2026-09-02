import type { SimEvent } from '../events.ts';
import { rngStream } from '../rng.ts';
import type { WorldState } from '../state.ts';
import type { BilgingBalance } from './balance.ts';
import { BILGE_FILL_STREAM, colourCountOf, createBilgeBoard, waterLineRowOf } from './bilging.ts';
import type { Board } from './board.ts';
import {
  TICKS_PER_INTERVAL,
  createScoringFrame,
  performanceOf,
  rotateFrame,
  type ScoringFrame,
} from './frame.ts';
import { PER_MILLE } from './scoring.ts';

export interface PuzzleState {
  puzzle: 'bilging';
  board: Board;
  starLevel: number;
  startedAtTick: number;
  frame: ScoringFrame;
  intervalTick: number;
  totalScore: number;
  moves: number;
  bilgePerMille: number;
  bilgeAccumulator: number;
  waterLineRow: number;
  dutyOutputPerMille: number;
}

export function startBilging(state: WorldState, balance: BilgingBalance): PuzzleState {
  const starLevel = balance.startingStarLevel;
  const colourCount = colourCountOf(balance, starLevel);
  const stream = rngStream(state.seed, state.rngStreams, BILGE_FILL_STREAM);
  const board = createBilgeBoard(balance, colourCount, () => stream.nextIntInRange(0, colourCount));
  return {
    puzzle: 'bilging',
    board,
    starLevel,
    startedAtTick: state.tick,
    frame: createScoringFrame(),
    intervalTick: 0,
    totalScore: 0,
    moves: 0,
    bilgePerMille: 0,
    bilgeAccumulator: 0,
    waterLineRow: waterLineRowOf(board.height, 0),
    dutyOutputPerMille: 0,
  };
}

export function stepPuzzle(state: WorldState): SimEvent[] {
  const puzzle = state.puzzle;
  if (puzzle === null || state.balance === null) return [];
  const balance = state.balance.bilging;
  advanceInterval(puzzle);
  puzzle.dutyOutputPerMille = performanceOf(puzzle.frame);
  return [
    ...floodBilge(state.tick, puzzle, balance),
    ...rampStarLevel(state.tick, puzzle, balance),
  ];
}

function advanceInterval(puzzle: PuzzleState): void {
  puzzle.intervalTick += 1;
  if (puzzle.intervalTick < TICKS_PER_INTERVAL) return;
  puzzle.intervalTick = 0;
  rotateFrame(puzzle.frame);
}

function floodBilge(tick: number, puzzle: PuzzleState, balance: BilgingBalance): SimEvent[] {
  const pumped = Math.floor(
    (balance.pumpPerMillePerThousandTicks * puzzle.dutyOutputPerMille) / PER_MILLE,
  );
  puzzle.bilgeAccumulator += balance.inflowPerMillePerThousandTicks - pumped;
  const carried = Math.floor(puzzle.bilgeAccumulator / PER_MILLE);
  puzzle.bilgeAccumulator -= carried * PER_MILLE;
  puzzle.bilgePerMille = Math.min(Math.max(puzzle.bilgePerMille + carried, 0), PER_MILLE);

  const waterLineRow = waterLineRowOf(puzzle.board.height, puzzle.bilgePerMille);
  if (waterLineRow === puzzle.waterLineRow) return [];
  puzzle.waterLineRow = waterLineRow;
  const bilgePerMille = puzzle.bilgePerMille;
  return [{ type: 'bilge.waterLineMoved', tick, waterLineRow, bilgePerMille }];
}

function rampStarLevel(tick: number, puzzle: PuzzleState, balance: BilgingBalance): SimEvent[] {
  const elapsed = tick - puzzle.startedAtTick;
  const reached = Math.floor(elapsed / Math.max(balance.ticksPerStarStep, 1));
  const starLevel = Math.min(balance.maxStarLevel, balance.startingStarLevel + reached);
  if (starLevel === puzzle.starLevel) return [];
  puzzle.starLevel = starLevel;
  return [{ type: 'puzzle.levelChanged', tick, starLevel }];
}
