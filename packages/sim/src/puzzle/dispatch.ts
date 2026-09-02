import type {
  CommandResult,
  PuzzleCommand,
  StartPuzzleCommand,
  SwapBilgeCommand,
} from '../commands.ts';
import type { SimEvent } from '../events.ts';
import { rngStream } from '../rng.ts';
import type { WorldState } from '../state.ts';
import type { BilgingBalance } from './balance.ts';
import { BILGE_REFILL_STREAM, BILGE_RULES, colourCountOf } from './bilging.ts';
import { isInsideBoard, swapCells, swapPartnerOf, type Board } from './board.ts';
import { recordMove } from './frame.ts';
import { resolveBoard, type ResolveStep } from './resolve.ts';
import { chainScoreOf, comboScoreOf } from './scoring.ts';
import { startBilging, type PuzzleState } from './session.ts';

const BILGING_PUZZLE = 'bilging';

export function applyPuzzleCommand(state: WorldState, command: PuzzleCommand): CommandResult {
  if (command.op === 'puzzle.start') return startPuzzle(state, command);
  return swapBilge(state, command);
}

function startPuzzle(state: WorldState, command: StartPuzzleCommand): CommandResult {
  if (state.balance === null) return { status: 'rejected', reason: 'balance-missing' };
  if (command.puzzle !== BILGING_PUZZLE) return { status: 'rejected', reason: 'unknown-puzzle' };
  if (state.puzzle !== null) return { status: 'rejected', reason: 'puzzle-already-running' };

  state.puzzle = startBilging(state, state.balance.bilging);
  return { status: 'accepted', events: [] };
}

function swapBilge(state: WorldState, command: SwapBilgeCommand): CommandResult {
  const puzzle = state.puzzle;
  if (puzzle === null || state.balance === null) {
    return { status: 'rejected', reason: 'no-puzzle-running' };
  }
  if (!Number.isSafeInteger(command.x) || !Number.isSafeInteger(command.y)) {
    return { status: 'rejected', reason: 'non-integer-coordinate' };
  }
  if (!isSwappable(puzzle.board, command.x, command.y)) {
    return { status: 'rejected', reason: 'swap-outside-board' };
  }

  const events = resolveSwap(state, puzzle, state.balance.bilging, command);
  return { status: 'accepted', events };
}

function isSwappable(board: Board, x: number, y: number): boolean {
  const partner = swapPartnerOf(BILGE_RULES, x, y);
  return isInsideBoard(board, x, y) && isInsideBoard(board, partner.x, partner.y);
}

function resolveSwap(
  state: WorldState,
  puzzle: PuzzleState,
  balance: BilgingBalance,
  command: SwapBilgeCommand,
): SimEvent[] {
  const colourCount = colourCountOf(balance, puzzle.starLevel);
  const stream = rngStream(state.seed, state.rngStreams, BILGE_REFILL_STREAM);
  swapCells(puzzle.board, command.x, command.y, BILGE_RULES);
  const draw = (): number => stream.nextIntInRange(0, colourCount);
  const steps = resolveBoard(puzzle.board, BILGE_RULES, draw);
  const points = steps.reduce((total, step) => total + pointsOfStep(step, balance), 0);

  puzzle.moves += 1;
  puzzle.totalScore += points;
  recordMove(puzzle.frame, points);
  return [
    { type: 'bilge.swapped', tick: state.tick, x: command.x, y: command.y },
    ...steps.map((step) => clearedEvent(state.tick, step, balance)),
    {
      type: 'puzzle.scored',
      tick: state.tick,
      points,
      totalScore: puzzle.totalScore,
      moves: puzzle.moves,
    },
  ];
}

function clearedEvent(tick: number, step: ResolveStep, balance: BilgingBalance): SimEvent {
  return {
    type: 'bilge.cleared',
    tick,
    chain: step.chain,
    cells: step.clearedCells,
    points: pointsOfStep(step, balance),
  };
}

function pointsOfStep(step: ResolveStep, balance: BilgingBalance): number {
  if (step.chain === 0) return comboScoreOf(step.runs.map((run) => run.length), balance);
  return chainScoreOf(step.clearedCells.length, balance);
}
