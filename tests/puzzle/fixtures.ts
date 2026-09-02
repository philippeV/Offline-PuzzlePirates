import { BALANCE } from '../../packages/harness/src/index.ts';
import {
  BILGE_RULES,
  MINIMUM_RUN_LENGTH,
  Sim,
  findRuns,
  swapCells,
  type Board,
  type BoardPosition,
  type PuzzleState,
} from '../../packages/sim/src/index.ts';

export { BALANCE };

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
