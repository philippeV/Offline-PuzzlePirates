import { BILGE_RULES, PUFFER_CELL, cellAt, swapPartnerOf } from '../client/rules.ts';
import type { Board, BoardPosition } from '../client/rules.ts';

export type BilgeGesture = 'poke' | 'swap';

export function gestureAt(board: Board, position: BoardPosition): BilgeGesture {
  if (cellAt(board, position.x, position.y) !== PUFFER_CELL) return 'swap';
  const partner = swapPartnerOf(BILGE_RULES, position.x, position.y);
  return cellAt(board, partner.x, partner.y) === PUFFER_CELL ? 'swap' : 'poke';
}
