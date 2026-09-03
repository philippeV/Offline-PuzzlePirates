import type { BilgingBalance, DutyRating } from './balance.ts';
import {
  NO_SHAPE,
  SHAPE_COUNT,
  halfOf,
  isColourCell,
  rowOf,
  shapeAt,
  symbolOf,
  type Board,
  type BoardShape,
} from './board.ts';
import { ratingOf, ratingRankOf } from './frame.ts';
import { PER_MILLE } from './scoring.ts';

export const BILGE_TOKEN_STREAM = 'bilge.tokens';
export const SHAPES_PER_PAIR = 2;
export const MANEUVER_BAR_SILVER = 3;
export const MANEUVER_BAR_GOLD = 6;

const MINIMUM_TOKEN_RATING: DutyRating = 'good';

export interface TokenRules {
  balance: BilgingBalance;
  dutyOutputPerMille: number;
}

export function spawnTokens(
  board: Board,
  refilled: number[],
  rules: TokenRules,
  draw: () => number,
): void {
  if (!performingWell(rules)) return;
  for (const index of refilled) {
    if (!isColourCell(board.cells[index])) continue;
    if (draw() >= rules.balance.tokenSpawnPerMille) continue;
    board.shapes[index] = shapeDrawnFrom(draw());
  }
}

export function clearShapePairs(board: Board): number[] {
  const paired: number[] = [];
  for (let index = 0; index < board.shapes.length; index += 1) {
    const partner = partnerOf(board, index);
    if (partner === null) continue;
    board.shapes[index] = NO_SHAPE;
    board.shapes[partner] = NO_SHAPE;
    paired.push(index, partner);
  }
  return paired.sort((left, right) => left - right);
}

function performingWell(rules: TokenRules): boolean {
  const rating = ratingOf(rules.dutyOutputPerMille, rules.balance);
  return ratingRankOf(rating) >= ratingRankOf(MINIMUM_TOKEN_RATING);
}

function shapeDrawnFrom(draw: number): BoardShape {
  return Math.floor((draw * SHAPE_COUNT) / PER_MILLE);
}

function partnerOf(board: Board, index: number): number | null {
  const shape = shapeAt(board, index);
  if (shape === NO_SHAPE) return null;
  const rightward = index + 1;
  const downward = index + board.width;
  if (rowOf(board, rightward) === rowOf(board, index) && opposed(shape, shapeAt(board, rightward))) {
    return rightward;
  }
  if (opposed(shape, shapeAt(board, downward))) return downward;
  return null;
}

function opposed(shape: BoardShape, other: BoardShape): boolean {
  if (other === NO_SHAPE) return false;
  return symbolOf(shape) === symbolOf(other) && halfOf(shape) !== halfOf(other);
}
