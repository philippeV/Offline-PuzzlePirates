import type { BilgingBalance, DutyRating } from './balance.ts';
import { PER_MILLE, POINTS_PER_MOVE_AT_FULL_EFFICIENCY } from './scoring.ts';

export const INTERVALS_PER_FRAME = 18;
export const TICKS_PER_INTERVAL = 600;

const RATINGS_WORST_FIRST: DutyRating[] = [
  'booched',
  'poor',
  'fine',
  'good',
  'excellent',
  'incredible',
];

export interface IntervalSample {
  moves: number;
  points: number;
}

export interface ScoringFrame {
  intervals: IntervalSample[];
}

export function createScoringFrame(): ScoringFrame {
  return {
    intervals: Array.from({ length: INTERVALS_PER_FRAME }, () => ({ moves: 0, points: 0 })),
  };
}

export function currentIntervalOf(frame: ScoringFrame): IntervalSample | undefined {
  return frame.intervals[frame.intervals.length - 1];
}

export function recordMove(frame: ScoringFrame, points: number): void {
  const interval = currentIntervalOf(frame);
  if (interval === undefined) return;
  interval.moves += 1;
  interval.points += points;
}

export function rotateFrame(frame: ScoringFrame): void {
  const expiring = currentIntervalOf(frame);
  if (expiring !== undefined && expiring.moves === 0) expiring.moves = 1;
  frame.intervals.shift();
  frame.intervals.push({ moves: 0, points: 0 });
}

export function performanceOf(frame: ScoringFrame): number {
  const moves = frame.intervals.reduce((total, interval) => total + interval.moves, 0);
  if (moves === 0) return 0;
  const points = frame.intervals.reduce((total, interval) => total + interval.points, 0);
  return Math.floor((points * PER_MILLE) / (moves * POINTS_PER_MOVE_AT_FULL_EFFICIENCY));
}

export function ratingOf(efficiencyPerMille: number, balance: BilgingBalance): DutyRating {
  const reached = balance.ratingBandsPerMille.filter((band) => efficiencyPerMille >= band).length;
  const rank = Math.min(reached, RATINGS_WORST_FIRST.length - 1);
  return RATINGS_WORST_FIRST[rank] ?? 'booched';
}
