import { budgetOf } from './clock.ts';

export type FrameStep = (ticks: number, elapsedMs: number) => void;

export interface Ticker {
  readonly running: boolean;
  start(): void;
  stop(): void;
}

export function createTicker(step: FrameStep): Ticker {
  let handle: number | null = null;
  let last = 0;
  let carry = 0;

  function frame(now: number): void {
    const elapsedMs = last === 0 ? 0 : now - last;
    last = now;
    const budget = budgetOf(elapsedMs, carry);
    carry = budget.carry;
    step(budget.ticks, elapsedMs);
    handle = requestAnimationFrame(frame);
  }

  return {
    get running(): boolean {
      return handle !== null;
    },
    start(): void {
      if (handle !== null) return;
      last = 0;
      carry = 0;
      handle = requestAnimationFrame(frame);
    },
    stop(): void {
      if (handle === null) return;
      cancelAnimationFrame(handle);
      handle = null;
    },
  };
}
