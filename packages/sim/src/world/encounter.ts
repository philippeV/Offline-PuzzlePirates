import type { WorldBalance } from '../balance.ts';
import { startBattle } from '../battle/session.ts';
import type { SimEvent } from '../events.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import { rngStream } from '../rng.ts';
import { createShip, findShip, type ShipState } from '../ship/state.ts';
import type { WorldState } from '../state.ts';
import { COMMODITY_IDS, commodityOf, type CommodityId } from './commodities.ts';
import { leaguePointOf, type LeaguePointId } from './leaguePoints.ts';
import type { CargoLot, VoyageType } from './state.ts';

export const ENCOUNTER_STREAM = 'world.encounter';
export const PLUNDER_STREAM = 'world.plunder';

const BRIGAND_SHIP_CLASS = 'sloop';
const GRAMS_PER_KG = 1000;

export function encounterChanceOf(
  difficultyPerMille: number,
  voyageType: VoyageType,
  balance: WorldBalance,
): number {
  if (voyageType === 'evade') return 0;
  const weighted =
    balance.encounterChancePerMille +
    Math.floor((difficultyPerMille * balance.encounterDifficultyWeightPerMille) / PER_MILLE);
  const adjusted =
    voyageType === 'pillage'
      ? weighted + balance.pillageSpawnBonusPerMille
      : weighted - balance.tradeSpawnPenaltyPerMille;
  return Math.min(Math.max(adjusted, 0), PER_MILLE);
}

export function rollEncounter(state: WorldState, pointId: LeaguePointId): SimEvent[] {
  const voyage = state.voyage;
  const balance = state.balance;
  if (voyage === null || balance === null || state.battle !== null) return [];
  const player = findShip(state.ships, voyage.shipId);
  if (player === undefined) return [];

  const difficultyPerMille = leaguePointOf(pointId).difficultyPerMille;
  const chance = encounterChanceOf(difficultyPerMille, voyage.type, balance.world);
  if (chance === 0) return [];
  const stream = rngStream(state.seed, state.rngStreams, ENCOUNTER_STREAM);
  if (stream.nextIntInRange(0, PER_MILLE) >= chance) return [];

  const brigand = createShip(state, {
    shipClass: BRIGAND_SHIP_CLASS,
    allegiance: 'brigand',
    crewCount: balance.world.brigandCrewCount,
    cannonballs: balance.battle.startingCannonballs,
    rum: balance.battle.startingRum,
    cargoUnits: balance.booty.brigandCargoUnitsBase,
  });
  state.ships.push(brigand);
  voyage.encounters += 1;
  const battle = startBattle(state, balance, player, brigand, false);
  state.battle = battle;
  return [
    {
      type: 'encounter.spawned',
      tick: state.tick,
      shipId: brigand.id,
      pointId,
      difficultyPerMille,
    },
    { type: 'battle.started', tick: state.tick, ships: battle.ships.map((ship) => ship.shipId) },
  ];
}

export function materialisePlunder(state: WorldState, ship: ShipState): SimEvent[] {
  const bootyCargoUnits = ship.bootyCargoUnits;
  if (bootyCargoUnits === 0) return [];
  const stream = rngStream(state.seed, state.rngStreams, PLUNDER_STREAM);
  const commodityId = COMMODITY_IDS[stream.nextIntInRange(0, COMMODITY_IDS.length)];
  if (commodityId === undefined) return [];

  const units = Math.floor(
    (bootyCargoUnits * GRAMS_PER_KG) / commodityOf(commodityId).massGramsPerUnit,
  );
  ship.bootyCargoUnits = 0;
  stow(ship.cargo, commodityId, units);
  return [{ type: 'cargo.plundered', tick: state.tick, shipId: ship.id, commodityId, units }];
}

function stow(cargo: CargoLot[], commodityId: CommodityId, units: number): void {
  const held = cargo.find((lot) => lot.commodityId === commodityId);
  if (held !== undefined) {
    held.units += units;
    return;
  }
  cargo.push({ commodityId, units });
  cargo.sort((first, second) => (first.commodityId < second.commodityId ? -1 : 1));
}
