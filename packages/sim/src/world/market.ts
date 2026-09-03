import type { MarketBalance } from '../balance.ts';
import { freeHoldOf } from '../battle/booty.ts';
import type { RejectionReason } from '../commands.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import type { ShipState } from '../ship/state.ts';
import { lotOf, massKgOf, releaseLot, stowLot } from './cargo.ts';
import { COMMODITY_IDS, commodityOf, type CommodityId } from './commodities.ts';
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
  const stock = stockOf(market, commodityId);
  if (stock === undefined) return { ok: false, reason: 'unknown-commodity' };
  if (units === 0) return { ok: true, poe: 0, units: 0 };
  if (stock.units < units) return { ok: false, reason: 'insufficient-stock' };

  const poe = units * stock.sellPricePoe;
  if (pirate.poe < poe) return { ok: false, reason: 'insufficient-poe' };
  if (massKgOf(commodityId, units) > freeHoldOf(ship)) return { ok: false, reason: 'hold-full' };

  stock.units -= units;
  stowLot(ship.cargo, commodityId, units);
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
  const stock = stockOf(market, commodityId);
  if (stock === undefined) return { ok: false, reason: 'unknown-commodity' };
  if (units === 0) return { ok: true, poe: 0, units: 0 };

  const lot = lotOf(ship.cargo, commodityId);
  if (lot === undefined || lot.units < units) return { ok: false, reason: 'insufficient-cargo' };
  if (stock.units + units > balance.maxStockUnits) {
    return { ok: false, reason: 'market-stock-full' };
  }

  const poe = units * stock.buyPricePoe;
  stock.units += units;
  releaseLot(ship.cargo, lot, units);
  pirate.poe += poe;
  return { ok: true, poe, units };
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



