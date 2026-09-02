import type { DivisionBalance } from '../balance.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import type { ShipState } from '../ship/state.ts';
import type { PirateState } from './state.ts';

export interface Division {
  poe: number;
  crewCutPoe: number;
  pirateSharePoe: number;
  crewSharePoe: number;
}

export function divideBooty(
  ship: ShipState,
  pirate: PirateState,
  balance: DivisionBalance,
): Division {
  const poe = ship.bootyPoe;
  const crewCutPoe = Math.floor((poe * balance.crewCutPerMille) / PER_MILLE);
  const divisible = poe - crewCutPoe;
  const pirateSharePoe = Math.floor((divisible * balance.playerSharePerMille) / PER_MILLE);

  ship.bootyPoe = 0;
  ship.poe += crewCutPoe;
  pirate.poe += pirateSharePoe;

  return { poe, crewCutPoe, pirateSharePoe, crewSharePoe: divisible - pirateSharePoe };
}
