import type { BilgingBalance } from './balance.ts';
import { clearCells, refillBoard, type Board, type BoardCell, type BoardRules } from './board.ts';
import { climbCrabs, crabsAboveWaterLine, spawnCritters } from './critters.ts';
import { applyGravity, type CellFall } from './gravity.ts';
import { cellsOfRuns, findRuns, type Run } from './runs.ts';

export const MAXIMUM_RESOLVE_STEPS = 64;

export type ResolveKind = 'combo' | 'chain' | 'poke' | 'jelly';

export interface OpeningClear {
  kind: ResolveKind;
  cells: number[];
}

export interface StepClear {
  chain: number;
  kind: ResolveKind;
  runs: Run[];
  clearedCells: number[];
}

export interface ResolveStep extends StepClear {
  crabsCleared: number;
  settleTicks: number;
}

export interface ResolveContext {
  balance: BilgingBalance;
  rules: BoardRules;
  starLevel: number;
  waterLineRow: number;
  bilgePerMille: number;
  drawColour: () => BoardCell;
  drawCritter: () => number;
}

export function resolveBoard(
  board: Board,
  context: ResolveContext,
  opening: OpeningClear | null,
): ResolveStep[] {
  const steps: ResolveStep[] = [];
  if (opening !== null) {
    const { kind, cells } = opening;
    steps.push(settleStep(board, context, { chain: 0, kind, runs: [], clearedCells: cells }));
  }
  for (let chain = steps.length; chain < MAXIMUM_RESOLVE_STEPS; chain += 1) {
    const runs = findRuns(board, context.rules.minimumRunLength);
    if (runs.length === 0) return steps;
    const kind: ResolveKind = chain === 0 ? 'combo' : 'chain';
    const clearedCells = cellsOfRuns(board, runs);
    steps.push(settleStep(board, context, { chain, kind, runs, clearedCells }));
  }
  return steps;
}

function settleStep(board: Board, context: ResolveContext, clear: StepClear): ResolveStep {
  clearCells(board, clear.clearedCells);
  const falls = applyGravity(board);
  const refilled = refillBoard(board, context.drawColour);
  climbCrabs(board);
  const crabs = crabsAboveWaterLine(board, context.waterLineRow);
  clearCells(board, crabs);
  refilled.push(...refillBoard(board, context.drawColour));
  refilled.sort((left, right) => left - right);
  spawnCritters(board, refilled, context, context.drawCritter);
  return { ...clear, crabsCleared: crabs.length, settleTicks: settleTicksOf(falls, context) };
}

function settleTicksOf(falls: CellFall[], context: ResolveContext): number {
  const slowestOf = (slowest: number, fall: CellFall): number =>
    Math.max(slowest, fall.distance * fallRateOf(fall.row, context));
  return falls.reduce(slowestOf, 0);
}

function fallRateOf(row: number, context: ResolveContext): number {
  if (row >= context.waterLineRow) return context.balance.belowWaterFallTicksPerCell;
  return context.balance.aboveWaterFallTicksPerCell;
}
