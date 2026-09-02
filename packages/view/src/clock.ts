import { TICKS_PER_SECOND } from './client/rules.ts';

export const MAXIMUM_CATCH_UP_TICKS = 240;

const MILLISECONDS_PER_SECOND = 1000;

export interface TickBudget {
  ticks: number;
  carry: number;
}

export function budgetOf(elapsedMs: number, carry: number): TickBudget {
  if (elapsedMs < 0) return { ticks: 0, carry };
  const pending = elapsedMs * TICKS_PER_SECOND + carry;
  const wanted = Math.floor(pending / MILLISECONDS_PER_SECOND);
  return {
    ticks: Math.min(wanted, MAXIMUM_CATCH_UP_TICKS),
    carry: pending - wanted * MILLISECONDS_PER_SECOND,
  };
}
