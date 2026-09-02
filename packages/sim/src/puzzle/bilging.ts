import type { BilgingBalance } from './balance.ts';
import { EMPTY_CELL, cellAt, type Board, type BoardCell, type BoardRules } from './board.ts';
import { PER_MILLE } from './scoring.ts';

export const BILGE_FILL_STREAM = 'bilge.fill';
export const BILGE_REFILL_STREAM = 'bilge.refill';
export const MINIMUM_RUN_LENGTH = 3;
export const MINIMUM_WATER_ROWS = 3;
export const MINIMUM_DRY_ROWS = 3;
export const MINIMUM_COLOUR_COUNT = 3;
export const MAXIMUM_COLOUR_COUNT = 16;

export const BILGE_RULES: BoardRules = {
  swapAxis: 'horizontal',
  minimumRunLength: MINIMUM_RUN_LENGTH,
};

const MAXIMUM_FILL_ATTEMPTS = 32;

export function colourCountOf(balance: BilgingBalance, starLevel: number): number {
  const table = balance.colourCountByStarLevel;
  const level = Math.min(Math.max(starLevel, 0), table.length - 1);
  const count = table[level] ?? MINIMUM_COLOUR_COUNT;
  return Math.min(Math.max(count, MINIMUM_COLOUR_COUNT), MAXIMUM_COLOUR_COUNT);
}

export function createBilgeBoard(
  balance: BilgingBalance,
  colourCount: number,
  draw: () => BoardCell,
): Board {
  const width = Math.max(balance.boardWidth, MINIMUM_RUN_LENGTH);
  const height = Math.max(balance.boardHeight, MINIMUM_WATER_ROWS + MINIMUM_DRY_ROWS);
  const cells = new Array<BoardCell>(width * height).fill(EMPTY_CELL);
  const board: Board = { width, height, cells };
  for (let index = 0; index < board.cells.length; index += 1) {
    board.cells[index] = settledColourAt(board, index, colourCount, draw);
  }
  return board;
}

export function waterRowsOf(boardHeight: number, bilgePerMille: number): number {
  const floodable = Math.max(boardHeight - MINIMUM_WATER_ROWS - MINIMUM_DRY_ROWS, 0);
  const level = Math.min(Math.max(bilgePerMille, 0), PER_MILLE);
  return MINIMUM_WATER_ROWS + Math.floor((level * floodable) / PER_MILLE);
}

export function waterLineRowOf(boardHeight: number, bilgePerMille: number): number {
  return boardHeight - waterRowsOf(boardHeight, bilgePerMille);
}

function settledColourAt(
  board: Board,
  index: number,
  colourCount: number,
  draw: () => BoardCell,
): BoardCell {
  const x = index % board.width;
  const y = Math.floor(index / board.width);
  const forbidden = forbiddenColoursAt(board, x, y);
  for (let attempt = 0; attempt < MAXIMUM_FILL_ATTEMPTS; attempt += 1) {
    const colour = draw();
    if (!forbidden.includes(colour)) return colour;
  }
  return firstAllowedColour(forbidden, colourCount);
}

function forbiddenColoursAt(board: Board, x: number, y: number): BoardCell[] {
  const trailing = [runColourBefore(board, x, y, -1, 0), runColourBefore(board, x, y, 0, -1)];
  return trailing.filter((colour): colour is BoardCell => colour !== undefined);
}

function runColourBefore(
  board: Board,
  x: number,
  y: number,
  stepX: number,
  stepY: number,
): BoardCell | undefined {
  const nearest = cellAt(board, x + stepX, y + stepY);
  if (nearest === undefined || nearest === EMPTY_CELL) return undefined;
  for (let back = 2; back < MINIMUM_RUN_LENGTH; back += 1) {
    if (cellAt(board, x + stepX * back, y + stepY * back) !== nearest) return undefined;
  }
  return nearest;
}

function firstAllowedColour(forbidden: BoardCell[], colourCount: number): BoardCell {
  for (let colour = 0; colour < colourCount; colour += 1) {
    if (!forbidden.includes(colour)) return colour;
  }
  return 0;
}
