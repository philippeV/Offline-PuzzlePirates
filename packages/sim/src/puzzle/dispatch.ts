import type {
  CommandResult,
  PokeBilgeCommand,
  PuzzleCommand,
  RejectionReason,
  StartPuzzleCommand,
  SwapBilgeCommand,
} from '../commands.ts';
import type { SimEvent } from '../events.ts';
import type { WorldState } from '../state.ts';
import { BILGE_RULES } from './bilging.ts';
import {
  CRAB_CELL,
  PUFFER_CELL,
  cellAt,
  isInsideBoard,
  swapPartnerOf,
  type Board,
} from './board.ts';
import { detonationCellsOf } from './critters.ts';
import { applyBilgeMove } from './move.ts';
import { startBilging } from './session.ts';
import { applyBilgeSwap } from './swap.ts';

const BILGING_PUZZLE = 'bilging';

export function applyPuzzleCommand(state: WorldState, command: PuzzleCommand): CommandResult {
  if (command.op === 'puzzle.start') return startPuzzle(state, command);
  if (command.op === 'bilge.poke') return pokeBilge(state, command);
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
  const balance = state.balance;
  if (puzzle === null || balance === null) return { status: 'rejected', reason: 'no-puzzle-running' };
  const refused = coordinateRejection(command.x, command.y) ?? swapRejection(puzzle.board, command);
  if (refused !== null) return { status: 'rejected', reason: refused };

  const opening = applyBilgeSwap(puzzle.board, command.x, command.y);
  const swapped: SimEvent = { type: 'bilge.swapped', tick: state.tick, x: command.x, y: command.y };
  const events = applyBilgeMove(state, balance.bilging, puzzle, swapped, opening);
  return { status: 'accepted', events };
}

function pokeBilge(state: WorldState, command: PokeBilgeCommand): CommandResult {
  const puzzle = state.puzzle;
  const balance = state.balance;
  if (puzzle === null || balance === null) return { status: 'rejected', reason: 'no-puzzle-running' };
  const refused = coordinateRejection(command.x, command.y) ?? pokeRejection(puzzle.board, command);
  if (refused !== null) return { status: 'rejected', reason: refused };

  const cells = detonationCellsOf(puzzle.board, command.x, command.y);
  const poked: SimEvent = { type: 'bilge.poked', tick: state.tick, x: command.x, y: command.y };
  const events = applyBilgeMove(state, balance.bilging, puzzle, poked, { kind: 'poke', cells });
  return { status: 'accepted', events };
}

function coordinateRejection(x: number, y: number): RejectionReason | null {
  if (Number.isSafeInteger(x) && Number.isSafeInteger(y)) return null;
  return 'non-integer-coordinate';
}

function swapRejection(board: Board, command: SwapBilgeCommand): RejectionReason | null {
  const partner = swapPartnerOf(BILGE_RULES, command.x, command.y);
  if (!isInsideBoard(board, command.x, command.y)) return 'swap-outside-board';
  if (!isInsideBoard(board, partner.x, partner.y)) return 'swap-outside-board';
  if (cellAt(board, command.x, command.y) === CRAB_CELL) return 'crab-not-swappable';
  if (cellAt(board, partner.x, partner.y) === CRAB_CELL) return 'crab-not-swappable';
  return null;
}

function pokeRejection(board: Board, command: PokeBilgeCommand): RejectionReason | null {
  if (!isInsideBoard(board, command.x, command.y)) return 'poke-outside-board';
  if (cellAt(board, command.x, command.y) !== PUFFER_CELL) return 'not-a-puffer';
  return null;
}
