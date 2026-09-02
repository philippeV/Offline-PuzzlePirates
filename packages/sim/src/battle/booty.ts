import type { BootyBalance } from '../balance.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import type { RngStream } from '../rng.ts';
import { shipClassOf } from '../ship/classes.ts';
import type { ShipState } from '../ship/state.ts';
import { cargoLotsMassKgOf } from '../world/cargo.ts';

export const BOOTY_POE_STREAM = 'booty.poe';

export interface BootyRoll {
  poe: number;
  cargoUnits: number;
  chartDropped: boolean;
}

export function rollBooty(
  loser: ShipState,
  balance: BootyBalance,
  stream: RngStream,
): BootyRoll {
  const scaled = Math.floor((balance.brigandPoeBase * balance.brigandPoePerMightMilli) / PER_MILLE);
  return {
    poe: scaled + variance(scaled, balance.brigandPoeVariancePerMille, stream),
    cargoUnits: loser.cargoUnits,
    chartDropped: stream.nextIntInRange(0, PER_MILLE) < balance.chartDropChancePerMille,
  };
}

export function awardBooty(
  winner: ShipState,
  loser: ShipState,
  roll: BootyRoll,
  balance: BootyBalance,
): BootyRoll {
  const shared = Math.floor(roll.poe / 2);
  const stowed = takenCargoOf(winner, roll.cargoUnits, balance);
  winner.poe += shared;
  winner.bootyPoe += roll.poe - shared;
  winner.bootyCargoUnits += stowed;
  loser.cargoUnits -= stowed;
  return { poe: roll.poe, cargoUnits: stowed, chartDropped: roll.chartDropped };
}

export function holdCapacityOf(ship: ShipState): number {
  return shipClassOf(ship.shipClass).holdMassKg;
}

export function freeHoldOf(ship: ShipState): number {
  return Math.max(
    holdCapacityOf(ship) -
      ship.cargoUnits -
      ship.bootyCargoUnits -
      cargoLotsMassKgOf(ship.cargo) -
      cargoLotsMassKgOf(ship.bootyCargo),
    0,
  );
}

function takenCargoOf(winner: ShipState, offered: number, balance: BootyBalance): number {
  const free = freeHoldOf(winner);
  if (offered <= free) return offered;
  if (balance.overflowPolicy === 'refuse') return 0;
  return free;
}

function variance(scaled: number, spreadPerMille: number, stream: RngStream): number {
  const span = Math.floor((scaled * spreadPerMille) / PER_MILLE);
  if (span <= 0) return 0;
  return stream.nextIntInRange(-span, span + 1);
}
