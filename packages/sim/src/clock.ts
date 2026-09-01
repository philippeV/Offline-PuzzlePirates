export const TICKS_PER_SECOND = 60;

export interface Clock {
  tick: number;
}

export function createClock(): Clock {
  return { tick: 0 };
}

export function advanceTick(clock: Clock): number {
  clock.tick += 1;
  return clock.tick;
}
