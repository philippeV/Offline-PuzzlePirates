import type { CommandResult, RejectionReason, WorldCommand } from '../commands.ts';
import type { SimEvent } from '../events.ts';
import { findShip } from '../ship/state.ts';
import type { WorldState } from '../state.ts';
import { COMMODITY_IDS, type CommodityId } from './commodities.ts';
import { divideBooty } from './division.ts';
import { ISLAND_IDS, type IslandId } from './islands.ts';
import { leaguePointOf } from './leaguePoints.ts';
import { buyCommodity, createMarkets, marketOf, sellCommodity } from './market.ts';
import { isVoyageType } from './state.ts';
import { chartVoyage } from './voyage.ts';

export function applyWorldCommand(state: WorldState, command: WorldCommand): CommandResult {
  if (command.op === 'world.start') return startWorld(state, command.islandId);
  if (command.op === 'voyage.chart') {
    return charter(state, command.shipId, command.toIslandId, command.voyageType);
  }
  if (command.op === 'voyage.port') return port(state);
  if (command.op === 'market.buy' || command.op === 'market.sell') {
    return trade(state, command.op, command.shipId, command.commodityId, command.units);
  }
  return divide(state, command.shipId);
}

function startWorld(state: WorldState, islandId: string): CommandResult {
  if (state.pirate !== null) return refused('world-already-started');
  if (state.balance === null) return refused('balance-missing');
  if (!isIslandId(islandId)) return refused('unknown-island');

  state.pirate = { poe: state.balance.world.startingPoe, atIslandId: islandId };
  state.markets = createMarkets(state.balance.market);

  return accepted([{ type: 'world.started', tick: state.tick, islandId }]);
}

function charter(
  state: WorldState,
  shipId: number,
  toIslandId: string,
  voyageType: string,
): CommandResult {
  const pirate = state.pirate;
  if (pirate === null) return refused('world-not-started');
  if (pirate.atIslandId === null) return refused('not-in-port');
  if (state.voyage !== null) return refused('voyage-already-running');
  if (!isIslandId(toIslandId)) return refused('unknown-island');
  if (!isVoyageType(voyageType)) return refused('unknown-voyage-type');

  const ship = findShip(state.ships, shipId);
  if (ship === undefined) return refused('unknown-ship');

  const charted = chartVoyage(state, ship, toIslandId, voyageType);
  if (typeof charted === 'string') return refused(charted);

  state.voyage = charted;
  pirate.atIslandId = null;

  return accepted([
    {
      type: 'voyage.charted',
      tick: state.tick,
      shipId: ship.id,
      toIslandId,
      legs: charted.route.length - 1,
    },
  ]);
}

function port(state: WorldState): CommandResult {
  const pirate = state.pirate;
  if (pirate === null) return refused('world-not-started');

  const voyage = state.voyage;
  if (voyage === null) return refused('no-voyage-running');
  if (state.battle !== null && state.battle.outcome === 'running') return refused('battle-running');

  const pointId = voyage.route[voyage.legIndex];
  if (pointId === undefined) return refused('not-at-island');

  const islandId = leaguePointOf(pointId).islandId;
  if (islandId === null) return refused('not-at-island');

  pirate.atIslandId = islandId;
  state.voyage = null;

  return accepted([{ type: 'voyage.ported', tick: state.tick, islandId }]);
}

function trade(
  state: WorldState,
  op: 'market.buy' | 'market.sell',
  shipId: number,
  commodityId: string,
  units: number,
): CommandResult {
  const pirate = state.pirate;
  const balance = state.balance;
  if (pirate === null) return refused('world-not-started');
  if (balance === null) return refused('balance-missing');
  if (pirate.atIslandId === null) return refused('not-in-port');
  if (!isCommodityId(commodityId)) return refused('unknown-commodity');

  const ship = findShip(state.ships, shipId);
  if (ship === undefined) return refused('unknown-ship');

  const market = marketOf(state.markets, pirate.atIslandId);
  if (market === undefined) return refused('island-has-no-market');

  const outcome =
    op === 'market.buy'
      ? buyCommodity(market, ship, pirate, commodityId, units)
      : sellCommodity(market, ship, pirate, commodityId, units, balance.market);
  if (!outcome.ok) return refused(outcome.reason);

  return accepted([
    {
      type: 'market.traded',
      tick: state.tick,
      islandId: market.islandId,
      commodityId,
      side: op === 'market.buy' ? 'buy' : 'sell',
      units: outcome.units,
      poe: outcome.poe,
    },
  ]);
}

function divide(state: WorldState, shipId: number): CommandResult {
  const pirate = state.pirate;
  if (pirate === null) return refused('world-not-started');
  if (pirate.atIslandId === null) return refused('not-in-port');

  const ship = findShip(state.ships, shipId);
  if (ship === undefined) return refused('unknown-ship');
  if (ship.bootyPoe === 0) return refused('no-booty');

  const balance = state.balance;
  if (balance === null) return refused('balance-missing');

  const division = divideBooty(ship, pirate, balance.division);

  return accepted([
    {
      type: 'booty.divided',
      tick: state.tick,
      shipId: ship.id,
      poe: division.poe,
      crewCutPoe: division.crewCutPoe,
      pirateSharePoe: division.pirateSharePoe,
    },
  ]);
}

function isIslandId(value: string): value is IslandId {
  return (ISLAND_IDS as string[]).includes(value);
}

function isCommodityId(value: string): value is CommodityId {
  return (COMMODITY_IDS as string[]).includes(value);
}

function accepted(events: SimEvent[]): CommandResult {
  return { status: 'accepted', events };
}

function refused(reason: RejectionReason): CommandResult {
  return { status: 'rejected', reason };
}
