import {
  applyGravity,
  clearCells,
  refillBoard,
  type Board,
  type BoardCell,
  type BoardRules,
} from './board.ts';
import { cellsOfRuns, findRuns, type Run } from './runs.ts';

export const MAXIMUM_RESOLVE_STEPS = 64;

export interface ResolveStep {
  chain: number;
  runs: Run[];
  clearedCells: number[];
}

export function resolveBoard(
  board: Board,
  rules: BoardRules,
  draw: () => BoardCell,
): ResolveStep[] {
  const steps: ResolveStep[] = [];
  for (let chain = 0; chain < MAXIMUM_RESOLVE_STEPS; chain += 1) {
    const runs = findRuns(board, rules.minimumRunLength);
    if (runs.length === 0) return steps;
    const clearedCells = cellsOfRuns(board, runs);
    clearCells(board, clearedCells);
    applyGravity(board);
    refillBoard(board, draw);
    steps.push({ chain, runs, clearedCells });
  }
  return steps;
}
