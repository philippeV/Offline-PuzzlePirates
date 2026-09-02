import { BALANCE } from '../../packages/harness/src/index.ts';
import {
  BILGE_RULES,
  MINIMUM_RUN_LENGTH,
  PER_MILLE,
  Sim,
  findRuns,
  swapCells,
  type Board,
  type BoardCell,
  type BoardPosition,
  type PuzzleState,
  type ResolveContext,
} from '../../packages/sim/src/index.ts';

export { BALANCE };

export const QUIET_COLOURS = 4;

const UNIQUE_COLOUR_BASE = 100;
const NO_CRITTER_DRAW = PER_MILLE - 1;

export function bilgingSim(seed: number): Sim {
  const sim = Sim.create({ seed, balance: BALANCE });
  const result = sim.dispatch({ op: 'puzzle.start', puzzle: 'bilging' });
  if (result.status !== 'accepted') throw new Error(`puzzle.start was ${result.reason}`);
  return sim;
}

export function puzzleOf(sim: Sim): PuzzleState {
  const puzzle = sim.state.puzzle;
  if (puzzle === null) throw new Error('no puzzle is running');
  return puzzle;
}

export function clearingSwapOf(board: Board): BoardPosition {
  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width - 1; x += 1) {
      const probe: Board = { width: board.width, height: board.height, cells: [...board.cells] };
      swapCells(probe, x, y, BILGE_RULES);
      if (findRuns(probe, MINIMUM_RUN_LENGTH).length > 0) return { x, y };
    }
  }
  throw new Error('the board offers no clearing swap');
}

export function quietCellAt(x: number, y: number): BoardCell {
  return (x + 2 * y) % QUIET_COLOURS;
}

export function paintQuietBoard(board: Board): void {
  for (let index = 0; index < board.cells.length; index += 1) {
    board.cells[index] = quietCellAt(index % board.width, Math.floor(index / board.width));
  }
}

export function quietBoard(width: number, height: number): Board {
  const board: Board = { width, height, cells: new Array<BoardCell>(width * height).fill(0) };
  paintQuietBoard(board);
  return board;
}

export function uniqueColours(): () => BoardCell {
  let drawn = UNIQUE_COLOUR_BASE;
  return () => {
    drawn += 1;
    return drawn;
  };
}

export function resolveContext(overrides: Partial<ResolveContext> = {}): ResolveContext {
  return {
    balance: BALANCE.bilging,
    rules: BILGE_RULES,
    starLevel: BALANCE.bilging.maxStarLevel,
    waterLineRow: 9,
    bilgePerMille: 0,
    drawColour: uniqueColours(),
    drawCritter: () => NO_CRITTER_DRAW,
    ...overrides,
  };
}
