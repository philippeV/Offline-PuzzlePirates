import {
  CRAB_CELL,
  EMPTY_CELL,
  NO_SHAPE,
  flatIndexOf,
  shapeAt,
  type Board,
  type BoardCell,
  type BoardShape,
} from './board.ts';

export interface CellFall {
  row: number;
  distance: number;
}

interface Survivor {
  cell: BoardCell;
  shape: BoardShape;
  row: number;
}

export function applyGravity(board: Board): CellFall[] {
  const falls: CellFall[] = [];
  for (let x = 0; x < board.width; x += 1) collapseColumn(board, x, falls);
  return falls;
}

function collapseColumn(board: Board, x: number, falls: CellFall[]): void {
  let top = 0;
  for (let y = 0; y <= board.height; y += 1) {
    if (y !== board.height && board.cells[flatIndexOf(board, x, y)] !== CRAB_CELL) continue;
    compactSegment(board, x, top, y, falls);
    top = y + 1;
  }
}

function compactSegment(
  board: Board,
  x: number,
  top: number,
  end: number,
  falls: CellFall[],
): void {
  const survivors = survivorsOf(board, x, top, end);
  const vacated = end - top - survivors.length;
  for (let y = top; y < end; y += 1) {
    const survivor = survivors[y - top - vacated];
    const index = flatIndexOf(board, x, y);
    board.cells[index] = survivor?.cell ?? EMPTY_CELL;
    board.shapes[index] = survivor?.shape ?? NO_SHAPE;
    if (survivor === undefined || survivor.row === y) continue;
    falls.push({ row: y, distance: y - survivor.row });
  }
}

function survivorsOf(board: Board, x: number, top: number, end: number): Survivor[] {
  const survivors: Survivor[] = [];
  for (let y = top; y < end; y += 1) {
    const index = flatIndexOf(board, x, y);
    const cell = board.cells[index];
    if (cell !== undefined && cell !== EMPTY_CELL) {
      survivors.push({ cell, shape: shapeAt(board, index), row: y });
    }
  }
  return survivors;
}
