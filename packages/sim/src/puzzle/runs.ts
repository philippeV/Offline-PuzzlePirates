import {
  cellAt,
  flatIndexOf,
  isColourCell,
  type Board,
  type BoardAxis,
  type BoardCell,
} from './board.ts';

export interface Run {
  axis: BoardAxis;
  x: number;
  y: number;
  length: number;
  cell: BoardCell;
}

export function findRuns(board: Board, minimumRunLength: number): Run[] {
  return [
    ...runsAlong(board, 'horizontal', minimumRunLength),
    ...runsAlong(board, 'vertical', minimumRunLength),
  ];
}

export function cellsOfRuns(board: Board, runs: Run[]): number[] {
  const cells = new Set<number>();
  for (const run of runs) {
    for (let offset = 0; offset < run.length; offset += 1) {
      const x = run.axis === 'horizontal' ? run.x + offset : run.x;
      const y = run.axis === 'vertical' ? run.y + offset : run.y;
      cells.add(flatIndexOf(board, x, y));
    }
  }
  return [...cells].sort((left, right) => left - right);
}

function runsAlong(board: Board, axis: BoardAxis, minimumRunLength: number): Run[] {
  const lineCount = axis === 'horizontal' ? board.height : board.width;
  const lineLength = axis === 'horizontal' ? board.width : board.height;
  const runs: Run[] = [];
  for (let line = 0; line < lineCount; line += 1) {
    let start = 0;
    while (start < lineLength) {
      const cell = cellAlong(board, axis, line, start);
      let end = start + 1;
      while (end < lineLength && cellAlong(board, axis, line, end) === cell) end += 1;
      if (isColourCell(cell) && end - start >= minimumRunLength) {
        runs.push(runAt(axis, line, start, end - start, cell));
      }
      start = end;
    }
  }
  return runs;
}

function cellAlong(board: Board, axis: BoardAxis, line: number, at: number): BoardCell | undefined {
  if (axis === 'horizontal') return cellAt(board, at, line);
  return cellAt(board, line, at);
}

function runAt(axis: BoardAxis, line: number, start: number, length: number, cell: BoardCell): Run {
  if (axis === 'horizontal') return { axis, x: start, y: line, length, cell };
  return { axis, x: line, y: start, length, cell };
}
