import { TICKS_PER_SECOND } from '../clock.ts';
import type { RejectionReason } from '../commands.ts';
import type { SimEvent } from '../events.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import { shipClassOf } from '../ship/classes.ts';
import { findShip, type ShipState } from '../ship/state.ts';
import type { WorldState } from '../state.ts';
import { rollEncounter } from './encounter.ts';
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
  };
}

export function stepVoyage(state: WorldState): SimEvent[] {
  const voyage = state.voyage;
  if (voyage === null) return [];
  if (state.battle !== null && state.battle.outcome === 'running') return [];
  const ship = findShip(state.ships, voyage.shipId);
  if (ship === undefined) return [];
  if (voyage.legIndex >= voyage.route.length - 1) return [];

  voyage.legTicks += 1;
  if (voyage.legTicks < voyage.legTicksRequired) return [];

  voyage.legTicks = 0;
  voyage.legIndex += 1;
  const pointId = voyage.route[voyage.legIndex];
  if (pointId === undefined) return [];
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
    ...rollEncounter(state, pointId),
  ];
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
