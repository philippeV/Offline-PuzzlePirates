export type BoardAxis = 'horizontal' | 'vertical';
export type BoardCell = number;

export const EMPTY_CELL = -1;
export const CRAB_CELL = -2;
export const PUFFER_CELL = -3;
export const JELLY_CELL = -4;

export interface Board {
  width: number;
  height: number;
  cells: BoardCell[];
}

export interface BoardPosition {
  x: number;
  y: number;
}

export interface BoardRules {
  swapAxis: BoardAxis;
  minimumRunLength: number;
}

export function flatIndexOf(board: Board, x: number, y: number): number {
  return y * board.width + x;
}

export function isInsideBoard(board: Board, x: number, y: number): boolean {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

export function cellAt(board: Board, x: number, y: number): BoardCell | undefined {
  if (!isInsideBoard(board, x, y)) return undefined;
  return board.cells[flatIndexOf(board, x, y)];
}

export function isColourCell(cell: BoardCell | undefined): cell is BoardCell {
  return cell !== undefined && cell >= 0;
}

export function rowOf(board: Board, index: number): number {
  return Math.floor(index / board.width);
}

export function swapPartnerOf(rules: BoardRules, x: number, y: number): BoardPosition {
  if (rules.swapAxis === 'horizontal') return { x: x + 1, y };
  return { x, y: y + 1 };
}

export function swapCells(board: Board, x: number, y: number, rules: BoardRules): boolean {
  const partner = swapPartnerOf(rules, x, y);
  const here = cellAt(board, x, y);
  const there = cellAt(board, partner.x, partner.y);
  if (here === undefined || there === undefined) return false;
  board.cells[flatIndexOf(board, x, y)] = there;
  board.cells[flatIndexOf(board, partner.x, partner.y)] = here;
  return true;
}

export function clearCells(board: Board, cells: number[]): void {
  for (const index of cells) board.cells[index] = EMPTY_CELL;
}

export function refillBoard(board: Board, draw: () => BoardCell): number[] {
  const refilled: number[] = [];
  for (let index = 0; index < board.cells.length; index += 1) {
    if (board.cells[index] !== EMPTY_CELL) continue;
    board.cells[index] = draw();
    refilled.push(index);
  }
  return refilled;
}
