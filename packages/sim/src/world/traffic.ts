import type { WorldBalance } from '../balance.ts';
import { takeEntityId, type EntityId, type EntityIdCounter } from '../ids.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import type { RngStream } from '../rng.ts';
import type { LeaguePointId } from './leaguePoints.ts';

const TICKS_PER_SPEED_STEP = 1000;

export interface TrafficShip {
  id: EntityId;
  fromPointId: LeaguePointId;
  toPointId: LeaguePointId;
  progressPerMille: number;
  progressAccumulator: number;
  speedPerMillePerThousandTicks: number;
}

export function legProgressPerMilleOf(legTicks: number, legTicksRequired: number): number {
  if (legTicksRequired <= 0) return PER_MILLE;
  const sailed = Math.floor((legTicks * PER_MILLE) / legTicksRequired);
  return Math.min(Math.max(sailed, 0), PER_MILLE);
}

export function withinRange(
  trafficProgressPerMille: number,
  playerProgressPerMille: number,
  rangePerMille: number,
): boolean {
  return Math.abs(trafficProgressPerMille - playerProgressPerMille) <= rangePerMille;
}

export function seedTraffic(
  counter: EntityIdCounter,
  stream: RngStream,
  balance: WorldBalance,
  fromPointId: LeaguePointId,
  toPointId: LeaguePointId,
): TrafficShip[] {
  const count = stream.nextIntInRange(0, balance.trafficShipsPerLegMax + 1);
  const traffic: TrafficShip[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = stream.nextIntInRange(
      balance.trafficSpawnAheadMinPerMille,
      balance.trafficSpawnAheadMaxPerMille + 1,
    );
    const astern = stream.nextIntInRange(0, 2) === 0;
    traffic.push({
      id: takeEntityId(counter),
      fromPointId,
      toPointId,
      progressPerMille: astern ? -offset : offset,
      progressAccumulator: 0,
      speedPerMillePerThousandTicks: stream.nextIntInRange(
        balance.trafficSpeedMinPerMillePerThousandTicks,
        balance.trafficSpeedMaxPerMillePerThousandTicks + 1,
      ),
    });
  }
  return traffic;
}

export function advanceTraffic(traffic: TrafficShip[]): void {
  for (const ship of traffic) {
    const accumulated = ship.progressAccumulator + ship.speedPerMillePerThousandTicks;
    ship.progressAccumulator = accumulated % TICKS_PER_SPEED_STEP;
    ship.progressPerMille += Math.floor(accumulated / TICKS_PER_SPEED_STEP);
  }
}

export function trafficEnteringRange(
  traffic: TrafficShip[],
  wasProgressPerMille: readonly number[],
  wasPlayerProgressPerMille: number,
  playerProgressPerMille: number,
  rangePerMille: number,
): TrafficShip | undefined {
  return traffic.find((ship, index) => {
    const before = wasProgressPerMille[index];
    if (before === undefined) return false;
    return (
      !withinRange(before, wasPlayerProgressPerMille, rangePerMille) &&
      withinRange(ship.progressPerMille, playerProgressPerMille, rangePerMille)
    );
  });
}

export function trafficStillOnLeg(traffic: TrafficShip[]): TrafficShip[] {
  return traffic.filter((ship) => Math.abs(ship.progressPerMille) <= PER_MILLE);
}
