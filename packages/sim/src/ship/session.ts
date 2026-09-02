import type { SimEvent } from '../events.ts';
import type { WorldState } from '../state.ts';
import { dutyOutputsOf } from './duty.ts';
import { stepShipMeters } from './meters.ts';

export function stepShips(state: WorldState): SimEvent[] {
  const balance = state.balance;
  if (balance === null) return [];
  return state.ships.flatMap((ship) =>
    stepShipMeters(state.tick, ship, dutyOutputsOf(ship, state.puzzle, balance), balance),
  );
}
