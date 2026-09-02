import type { MarketBalance } from '../balance.ts';
import { freeHoldOf } from '../battle/booty.ts';
import type { RejectionReason } from '../commands.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import { shipClassOf } from '../ship/classes.ts';
import type { ShipState } from '../ship/state.ts';
import { lotOf, massKgOf, releaseLot, stowLot } from './cargo.ts';
import {
  cannonBallOf,
  COMMODITY_IDS,
  commodityOf,
  isCannonBall,
  isRum,
  type CommodityId,
} from './commodities.ts';
import { ISLAND_IDS, islandOf, type IslandId } from './islands.ts';
import type { IslandMarket, MarketStock, PirateState } from './state.ts';

export type TradeOutcome =
  | { ok: true; poe: number; units: number }
  | { ok: false; reason: RejectionReason };

export function createMarkets(balance: MarketBalance): IslandMarket[] {
  return ISLAND_IDS.filter((islandId) => islandOf(islandId).isColonized).map((islandId) => ({
    islandId,
    stocks: COMMODITY_IDS.map((commodityId) => openingStockOf(islandId, commodityId, balance)),
  }));
}

export function marketOf(markets: IslandMarket[], islandId: IslandId): IslandMarket | undefined {
  return markets.find((market) => market.islandId === islandId);
}

export function stockOf(market: IslandMarket, commodityId: CommodityId): MarketStock | undefined {
  return market.stocks.find((stock) => stock.commodityId === commodityId);
}

export function buyCommodity(
  market: IslandMarket,
  ship: ShipState,
  pirate: PirateState,
  commodityId: CommodityId,
  units: number,
): TradeOutcome {
  if (units < 0) return { ok: false, reason: 'negative-units' };
  const stock = stockOf(market, commodityId);
  if (stock === undefined) return { ok: false, reason: 'unknown-commodity' };
  if (units === 0) return { ok: true, poe: 0, units: 0 };
  if (isCannonBall(commodityId) && !firesCannonBall(ship, commodityId)) {
    return { ok: false, reason: 'wrong-cannon-ball-size' };
  }
  if (stock.units < units) return { ok: false, reason: 'insufficient-stock' };

  const poe = units * stock.sellPricePoe;
  if (pirate.poe < poe) return { ok: false, reason: 'insufficient-poe' };
  if (massKgOf(commodityId, units) > freeHoldOf(ship)) return { ok: false, reason: 'hold-full' };

  stock.units -= units;
  depositUnits(ship, commodityId, units);
  pirate.poe -= poe;
  return { ok: true, poe, units };
}

export function sellCommodity(
  market: IslandMarket,
  ship: ShipState,
  pirate: PirateState,
  commodityId: CommodityId,
  units: number,
  balance: MarketBalance,
): TradeOutcome {
  if (units < 0) return { ok: false, reason: 'negative-units' };
  const stock = stockOf(market, commodityId);
  if (stock === undefined) return { ok: false, reason: 'unknown-commodity' };
  if (units === 0) return { ok: true, poe: 0, units: 0 };
  if (isCannonBall(commodityId) && !firesCannonBall(ship, commodityId)) {
    return { ok: false, reason: 'wrong-cannon-ball-size' };
  }
  if (heldUnitsOf(ship, commodityId) < units) return { ok: false, reason: 'insufficient-cargo' };
  if (stock.units + units > balance.maxStockUnits) {
    return { ok: false, reason: 'market-stock-full' };
  }

  const poe = units * stock.buyPricePoe;
  stock.units += units;
  withdrawUnits(ship, commodityId, units);
  pirate.poe += poe;
  return { ok: true, poe, units };
}

function firesCannonBall(ship: ShipState, commodityId: CommodityId): boolean {
  return commodityId === cannonBallOf(shipClassOf(ship.shipClass).cannonSize);
}

function depositUnits(ship: ShipState, commodityId: CommodityId, units: number): void {
  if (isCannonBall(commodityId)) {
    ship.cannonballs += units;
    return;
  }
  if (isRum(commodityId)) {
    ship.rum += units;
    return;
  }
  stowLot(ship.cargo, commodityId, units);
}

function heldUnitsOf(ship: ShipState, commodityId: CommodityId): number {
  if (isCannonBall(commodityId)) return ship.cannonballs;
  if (isRum(commodityId)) return ship.rum;
  return lotOf(ship.cargo, commodityId)?.units ?? 0;
}

function withdrawUnits(ship: ShipState, commodityId: CommodityId, units: number): void {
  if (isCannonBall(commodityId)) {
    ship.cannonballs -= units;
    return;
  }
  if (isRum(commodityId)) {
    ship.rum -= units;
    return;
  }
  const lot = lotOf(ship.cargo, commodityId);
  if (lot !== undefined) releaseLot(ship.cargo, lot, units);
}

function openingStockOf(
  islandId: IslandId,
  commodityId: CommodityId,
  balance: MarketBalance,
): MarketStock {
  const base =
    commodityOf(commodityId).class === 'raw'
      ? balance.rawBasePricePoe
      : balance.refinedBasePricePoe;
  const demandPerMille = islandOf(islandId).spawnCommodities.includes(commodityId)
    ? balance.spawnDiscountPerMille
    : balance.scarcityPremiumPerMille;
  const sellPricePoe = Math.floor((base * demandPerMille) / PER_MILLE);
  return {
    commodityId,
    units: balance.startingStockUnits,
    buyPricePoe: Math.floor((sellPricePoe * (PER_MILLE - balance.spreadPerMille)) / PER_MILLE),
    sellPricePoe,
  };
}



