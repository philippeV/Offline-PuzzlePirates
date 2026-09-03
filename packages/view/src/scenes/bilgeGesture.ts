import { PUFFER_CELL, flatIndexOf } from '../client/rules.ts';
import type { Board, BoardPosition } from '../client/rules.ts';

export type BilgeGesture = 'poke' | 'swap';

export function gestureAt(board: Board, position: BoardPosition): BilgeGesture {
  const cell = board.cells[flatIndexOf(board, position.x, position.y)];
  return cell === PUFFER_CELL ? 'poke' : 'swap';
}
