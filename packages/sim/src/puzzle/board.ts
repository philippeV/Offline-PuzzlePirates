export type BoardAxis = 'horizontal' | 'vertical';
export type BoardCell = number;
export type BoardShape = number;

const HALVES_PER_SYMBOL = 2;

export const EMPTY_CELL = -1;
export const CRAB_CELL = -2;
export const PUFFER_CELL = -3;
export const JELLY_CELL = -4;

export const NO_SHAPE = -1;
export const SYMBOL_COUNT = 4;
export const SHAPE_COUNT = SYMBOL_COUNT * HALVES_PER_SYMBOL;

export interface Board {
  width: number;
  height: number;
  cells: BoardCell[];
  shapes: BoardShape[];
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

export function shapeAt(board: Board, index: number): BoardShape {
  return board.shapes[index] ?? NO_SHAPE;
}

export function shapeOf(symbol: number, half: number): BoardShape {
  return symbol * HALVES_PER_SYMBOL + half;
}

export function symbolOf(shape: BoardShape): number {
  return Math.floor(shape / HALVES_PER_SYMBOL);
}

export function halfOf(shape: BoardShape): number {
  return shape % HALVES_PER_SYMBOL;
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
  const from = flatIndexOf(board, x, y);
  const to = flatIndexOf(board, partner.x, partner.y);
  const shapeHere = shapeAt(board, from);
  board.cells[from] = there;
  board.cells[to] = here;
  board.shapes[from] = shapeAt(board, to);
  board.shapes[to] = shapeHere;
  return true;
}

export function clearCells(board: Board, cells: number[]): void {
  for (const index of cells) {
    board.cells[index] = EMPTY_CELL;
    board.shapes[index] = NO_SHAPE;
  }
}

export function refillBoard(board: Board, draw: () => BoardCell): number[] {
  const refilled: number[] = [];
  for (let index = 0; index < board.cells.length; index += 1) {
    if (board.cells[index] !== EMPTY_CELL) continue;
    board.cells[index] = draw();
    board.shapes[index] = NO_SHAPE;
    refilled.push(index);
  }
  return refilled;
}
