import type { BilgingBalance } from './balance.ts';
import {
  CRAB_CELL,
  EMPTY_CELL,
  JELLY_CELL,
  PUFFER_CELL,
  flatIndexOf,
  isInsideBoard,
  rowOf,
  shapeAt,
  type Board,
  type BoardCell,
} from './board.ts';

export const BILGE_CRITTER_STREAM = 'bilge.critters';
export const PUFFER_MIN_STAR_LEVEL = 3;
export const CRAB_MIN_STAR_LEVEL = 5;
export const JELLY_MIN_STAR_LEVEL = 6;

export interface CritterRules {
  balance: BilgingBalance;
  starLevel: number;
  waterLineRow: number;
}

export function spawnCritters(
  board: Board,
  refilled: number[],
  rules: CritterRules,
  draw: () => number,
): void {
  for (const index of refilled) {
    const critter = critterFor(draw(), rowOf(board, index) >= rules.waterLineRow, rules);
    if (critter !== null) board.cells[index] = critter;
  }
}

function critterFor(draw: number, belowWaterLine: boolean, rules: CritterRules): BoardCell | null {
  const crab = rules.balance.crabSpawnPerMille;
  const puffer = crab + rules.balance.pufferSpawnPerMille;
  const jelly = puffer + rules.balance.jellySpawnPerMille;
  if (draw < crab) return unlocked(rules, CRAB_MIN_STAR_LEVEL) && belowWaterLine ? CRAB_CELL : null;
  if (draw < puffer) return unlocked(rules, PUFFER_MIN_STAR_LEVEL) ? PUFFER_CELL : null;
  if (draw < jelly) return unlocked(rules, JELLY_MIN_STAR_LEVEL) ? JELLY_CELL : null;
  return null;
}

function unlocked(rules: CritterRules, minimumStarLevel: number): boolean {
  return rules.starLevel >= minimumStarLevel;
}

export function climbCrabs(board: Board): void {
  for (let index = board.width; index < board.cells.length; index += 1) {
    if (board.cells[index] !== CRAB_CELL) continue;
    const above = index - board.width;
    if (board.cells[above] === CRAB_CELL) continue;
    const displaced = board.cells[above] ?? EMPTY_CELL;
    const displacedShape = shapeAt(board, above);
    board.cells[above] = CRAB_CELL;
    board.shapes[above] = shapeAt(board, index);
    board.cells[index] = displaced;
    board.shapes[index] = displacedShape;
  }
}

export function crabsAboveWaterLine(board: Board, waterLineRow: number): number[] {
  const cells: number[] = [];
  const limit = Math.min(waterLineRow * board.width, board.cells.length);
  for (let index = 0; index < limit; index += 1) {
    if (board.cells[index] === CRAB_CELL) cells.push(index);
  }
  return cells;
}

export function detonationCellsOf(board: Board, x: number, y: number): number[] {
  const cells: number[] = [];
  for (let row = y - 1; row <= y + 1; row += 1) {
    for (let column = x - 1; column <= x + 1; column += 1) {
      if (isInsideBoard(board, column, row)) cells.push(flatIndexOf(board, column, row));
    }
  }
  return cells;
}

export function colourCellsOf(board: Board, colour: BoardCell): number[] {
  const cells: number[] = [];
  for (let index = 0; index < board.cells.length; index += 1) {
    if (board.cells[index] === colour) cells.push(index);
  }
  return cells;
}
