import { TICKS_PER_SECOND } from '../clock.ts';
import type { RejectionReason } from '../commands.ts';
import type { SimEvent } from '../events.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import { rngStream } from '../rng.ts';
import { shipClassOf } from '../ship/classes.ts';
import { findShip, type ShipState } from '../ship/state.ts';
import type { WorldState } from '../state.ts';
import { ENCOUNTER_STREAM, rollEncounter } from './encounter.ts';
import { ISLAND_IDS, type IslandId } from './islands.ts';
import {
  DIAGONAL_LEAGUE_COST_PER_MILLE,
  HORIZONTAL_LEAGUE_COST_PER_MILLE,
  islandPointOf,
  leaguePointOf,
  neighboursOf,
  routeBetween,
  type LeaguePointId,
} from './leaguePoints.ts';
import type { VoyageState, VoyageType } from './state.ts';
import {
  advanceTraffic,
  legProgressPerMilleOf,
  seedTraffic,
  trafficEnteringRange,
  trafficStillOnLeg,
  type TrafficShip,
} from './traffic.ts';

const LEGS_IN_A_ROUTE = 2;

export function legTicksRequiredOf(ship: ShipState, orientationCostPerMille: number): number {
  const shipClass = shipClassOf(ship.shipClass);
  const span = shipClass.minSpeedSecondsPerLP - shipClass.maxSpeedSecondsPerLP;
  const seconds =
    shipClass.maxSpeedSecondsPerLP +
    Math.floor((span * (PER_MILLE - ship.speedPerMille)) / PER_MILLE);
  return Math.floor((seconds * TICKS_PER_SECOND * orientationCostPerMille) / PER_MILLE);
}

export function chartVoyage(
  state: WorldState,
  ship: ShipState,
  toIslandId: IslandId,
  voyageType: VoyageType,
): VoyageState | RejectionReason {
  const fromIslandId = state.pirate?.atIslandId ?? null;
  if (fromIslandId === null) return 'not-at-island';
  if (!isIsland(fromIslandId) || !isIsland(toIslandId)) return 'unknown-island';
  const route = routeBetween(islandPointOf(fromIslandId), islandPointOf(toIslandId));
  if (route.length < LEGS_IN_A_ROUTE) return 'no-route';
  return {
    shipId: ship.id,
    type: voyageType,
    route,
    legIndex: 0,
    legTicks: 0,
    legTicksRequired: legTicksRequiredOf(ship, orientationCostOf(route, 0)),
    encounters: 0,
    phase: 'charted',
  };
}

export function stepVoyage(state: WorldState): SimEvent[] {
  const voyage = state.voyage;
  if (voyage === null) return [];
  if (voyage.phase !== 'under-way') return [];
  if (state.battle !== null && state.battle.outcome === 'running') return [];
  const ship = findShip(state.ships, voyage.shipId);
  if (ship === undefined) return [];
  if (voyage.legIndex >= voyage.route.length - 1) return [];

  if (voyage.legTicks === 0) state.traffic = seedTrafficForLeg(state, voyage);

  const passedProgress = state.traffic.map((traffic) => traffic.progressPerMille);
  const passedPlayerProgress = legProgressPerMilleOf(voyage.legTicks, voyage.legTicksRequired);

  voyage.legTicks += 1;
  advanceTraffic(state.traffic);

  const encounter = rollTrafficEncounter(state, voyage, passedProgress, passedPlayerProgress);
  state.traffic = trafficStillOnLeg(state.traffic);

  if (voyage.legTicks < voyage.legTicksRequired) return encounter;

  voyage.legTicks = 0;
  voyage.legIndex += 1;
  state.traffic = [];
  const pointId = voyage.route[voyage.legIndex];
  if (pointId === undefined) return encounter;
  voyage.legTicksRequired = legTicksRequiredOf(
    ship,
    orientationCostOf(voyage.route, voyage.legIndex),
  );
  return [
    {
      type: 'voyage.legReached',
      tick: state.tick,
      pointId,
      legIndex: voyage.legIndex,
      difficultyPerMille: leaguePointOf(pointId).difficultyPerMille,
    },
    ...encounter,
  ];
}

function seedTrafficForLeg(state: WorldState, voyage: VoyageState): TrafficShip[] {
  const balance = state.balance;
  const fromPointId = voyage.route[voyage.legIndex];
  const toPointId = voyage.route[voyage.legIndex + 1];
  if (balance === null || fromPointId === undefined || toPointId === undefined) return [];
  const stream = rngStream(state.seed, state.rngStreams, ENCOUNTER_STREAM);
  return seedTraffic(state, stream, balance.world, fromPointId, toPointId);
}

function rollTrafficEncounter(
  state: WorldState,
  voyage: VoyageState,
  passedProgress: readonly number[],
  passedPlayerProgress: number,
): SimEvent[] {
  const balance = state.balance;
  const toPointId = voyage.route[voyage.legIndex + 1];
  if (balance === null || toPointId === undefined) return [];
  const closing = trafficEnteringRange(
    state.traffic,
    passedProgress,
    passedPlayerProgress,
    legProgressPerMilleOf(voyage.legTicks, voyage.legTicksRequired),
    balance.world.encounterRangePerMille,
  );
  if (closing === undefined) return [];
  const events = rollEncounter(state, toPointId);
  if (!events.some((event) => event.type === 'encounter.spawned')) return events;
  state.traffic = state.traffic.filter((traffic) => traffic.id !== closing.id);
  return events;
}

function isIsland(islandId: IslandId): boolean {
  return ISLAND_IDS.includes(islandId);
}

function orientationCostOf(route: LeaguePointId[], legIndex: number): number {
  const from = route[legIndex];
  const to = route[legIndex + 1];
  if (from === undefined || to === undefined) return 0;
  const league = neighboursOf(from).find((candidate) => candidate.b === to);
  return league?.orientation === 'horizontal'
    ? HORIZONTAL_LEAGUE_COST_PER_MILLE
    : DIAGONAL_LEAGUE_COST_PER_MILLE;
}
