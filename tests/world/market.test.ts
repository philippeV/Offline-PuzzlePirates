import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import { FIRST_ENTITY_ID } from '../../packages/sim/src/ids.ts';
import { freeHoldOf, holdCapacityOf } from '../../packages/sim/src/battle/booty.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { cargoLotsMassKgOf } from '../../packages/sim/src/world/cargo.ts';
import { COMMODITY_IDS, type CommodityId } from '../../packages/sim/src/world/commodities.ts';
import { ISLAND_IDS, islandOf, type IslandId } from '../../packages/sim/src/world/islands.ts';
import {
  buyCommodity,
  createMarkets,
  marketOf,
  sellCommodity,
  stockOf,
} from '../../packages/sim/src/world/market.ts';
import type {
  IslandMarket,
  MarketStock,
  PirateState,
} from '../../packages/sim/src/world/state.ts';

const MARKET = BALANCE.market;

const SPAWNING_ISLAND: IslandId = 'doyle';
const SCARCE_ISLAND: IslandId = 'alkaid';
const SPAWNED_COMMODITY: CommodityId = 'hemp';
const OTHER_COMMODITY: CommodityId = 'stone';
const PART_KILOGRAM_COMMODITY: CommodityId = 'small-cannon-ball';
const PART_KILOGRAM_UNITS = 3;
const PART_KILOGRAM_MASS_KG = 21;

const A_FEW_UNITS = 10;
const AMPLE_POE = 100000;

function dockAt(markets: IslandMarket[], islandId: IslandId): IslandMarket {
  const market = marketOf(markets, islandId);
  if (market === undefined) throw new RangeError(islandId);
  return market;
}

function stockAt(market: IslandMarket, commodityId: CommodityId): MarketStock {
  const stock = stockOf(market, commodityId);
  if (stock === undefined) throw new RangeError(commodityId);
  return stock;
}

function sloop(cargoUnits = 0): ShipState {
  return createShip(
    { nextEntityId: FIRST_ENTITY_ID },
    { shipClass: 'sloop', allegiance: 'player', cargoUnits },
  );
}

function pirateAt(islandId: IslandId, poe = AMPLE_POE): PirateState {
  return { poe, atIslandId: islandId };
}

function snapshotOf(market: IslandMarket, ship: ShipState, pirate: PirateState): string {
  return JSON.stringify([market, ship.cargo, pirate]);
}

test('only colonized islands open a dock, in archipelago order', () => {
  const markets = createMarkets(MARKET);

  assert.deepEqual(
    markets.map((market) => market.islandId),
    ISLAND_IDS.filter((islandId) => islandOf(islandId).isColonized),
  );
});

test('every dock stocks the whole catalogue in commodity order', () => {
  const markets = createMarkets(MARKET);

  for (const market of markets) {
    assert.deepEqual(
      market.stocks.map((stock) => stock.commodityId),
      COMMODITY_IDS,
    );
  }
});

test('every price and stock is a safe integer', () => {
  const markets = createMarkets(MARKET);

  for (const market of markets) {
    for (const stock of market.stocks) {
      assert.ok(Number.isSafeInteger(stock.units), `${market.islandId}.${stock.commodityId}.units`);
      assert.ok(Number.isSafeInteger(stock.buyPricePoe), `${market.islandId}.${stock.commodityId}.buy`);
      assert.ok(Number.isSafeInteger(stock.sellPricePoe), `${market.islandId}.${stock.commodityId}.sell`);
    }
  }
});

test('a dock opens with the balanced starting stock of every commodity', () => {
  const markets = createMarkets(MARKET);

  for (const market of markets) {
    for (const stock of market.stocks) {
      assert.equal(stock.units, MARKET.startingStockUnits);
    }
  }
});

test('an island sells what it spawns below what a scarce island charges', () => {
  const markets = createMarkets(MARKET);

  const spawning = stockAt(dockAt(markets, SPAWNING_ISLAND), SPAWNED_COMMODITY);
  const scarce = stockAt(dockAt(markets, SCARCE_ISLAND), SPAWNED_COMMODITY);

  assert.ok(spawning.sellPricePoe < scarce.sellPricePoe);
});

test('every dock buys below the price it sells at', () => {
  const markets = createMarkets(MARKET);

  for (const market of markets) {
    for (const stock of market.stocks) {
      assert.ok(stock.buyPricePoe < stock.sellPricePoe, `${market.islandId}.${stock.commodityId}`);
    }
  }
});

test('buying and selling on the same dock always loses poe', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  const bought = buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);
  const sold = sellCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS, MARKET);

  assert.ok(bought.ok);
  assert.ok(sold.ok);
  assert.ok(sold.poe < bought.poe);
  assert.equal(pirate.poe, AMPLE_POE - bought.poe + sold.poe);
  assert.ok(pirate.poe < AMPLE_POE);
});

test('a completed purchase moves stock, cargo and poe together', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const stock = stockAt(dock, SPAWNED_COMMODITY);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  const outcome = buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);

  assert.deepEqual(outcome, {
    ok: true,
    poe: A_FEW_UNITS * stock.sellPricePoe,
    units: A_FEW_UNITS,
  });
  assert.equal(stock.units, MARKET.startingStockUnits - A_FEW_UNITS);
  assert.deepEqual(ship.cargo, [{ commodityId: SPAWNED_COMMODITY, units: A_FEW_UNITS }]);
  assert.equal(pirate.poe, AMPLE_POE - A_FEW_UNITS * stock.sellPricePoe);
});

test('a second purchase merges into the lot it already holds', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);
  buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);

  assert.deepEqual(ship.cargo, [{ commodityId: SPAWNED_COMMODITY, units: A_FEW_UNITS * 2 }]);
});

test('the hold keeps its lots sorted by commodity', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, OTHER_COMMODITY, A_FEW_UNITS);
  buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);

  assert.deepEqual(
    ship.cargo.map((lot) => lot.commodityId),
    [SPAWNED_COMMODITY, OTHER_COMMODITY],
  );
});

test('selling the whole lot drops it from the hold', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);
  sellCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS, MARKET);

  assert.deepEqual(ship.cargo, []);
});

test('selling part of a lot leaves the remainder aboard', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);
  sellCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS - 1, MARKET);

  assert.deepEqual(ship.cargo, [{ commodityId: SPAWNED_COMMODITY, units: 1 }]);
});

test('a zero unit purchase is a no-op success', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, 0);

  assert.deepEqual(outcome, { ok: true, poe: 0, units: 0 });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('a zero unit sale is a no-op success even with an empty hold', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = sellCommodity(dock, ship, pirate, SPAWNED_COMMODITY, 0, MARKET);

  assert.deepEqual(outcome, { ok: true, poe: 0, units: 0 });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('a commodity the dock does not list cannot be bought or sold', () => {
  const bare: IslandMarket = { islandId: SPAWNING_ISLAND, stocks: [] };
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(bare, ship, pirate);

  const bought = buyCommodity(bare, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);
  const sold = sellCommodity(bare, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS, MARKET);

  assert.deepEqual(bought, { ok: false, reason: 'unknown-commodity' });
  assert.deepEqual(sold, { ok: false, reason: 'unknown-commodity' });
  assert.equal(snapshotOf(bare, ship, pirate), before);
});

test('a dock refuses to sell more than it stocks', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = buyCommodity(
    dock,
    ship,
    pirate,
    SPAWNED_COMMODITY,
    MARKET.startingStockUnits + 1,
  );

  assert.deepEqual(outcome, { ok: false, reason: 'insufficient-stock' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('a pirate who cannot pay buys nothing', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const stock = stockAt(dock, SPAWNED_COMMODITY);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND, A_FEW_UNITS * stock.sellPricePoe - 1);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);

  assert.deepEqual(outcome, { ok: false, reason: 'insufficient-poe' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('a purchase heavier than the free hold is refused', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const laden = sloop(holdCapacityOf(sloop()) - A_FEW_UNITS);
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, laden, pirate);

  const outcome = buyCommodity(dock, laden, pirate, SPAWNED_COMMODITY, A_FEW_UNITS + 1);

  assert.deepEqual(outcome, { ok: false, reason: 'hold-full' });
  assert.equal(snapshotOf(dock, laden, pirate), before);
});

test('a purchase that exactly fills the free hold is allowed', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const laden = sloop(holdCapacityOf(sloop()) - A_FEW_UNITS);
  const pirate = pirateAt(SPAWNING_ISLAND);

  const outcome = buyCommodity(dock, laden, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);

  assert.ok(outcome.ok);
  assert.deepEqual(laden.cargo, [{ commodityId: SPAWNED_COMMODITY, units: A_FEW_UNITS }]);
});

test('the one commodity that is not whole kilograms is weighed down to the kilogram', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SCARCE_ISLAND);
  const ship = sloop(holdCapacityOf(sloop()) - PART_KILOGRAM_MASS_KG);
  const pirate = pirateAt(SCARCE_ISLAND);

  const bought = buyCommodity(dock, ship, pirate, PART_KILOGRAM_COMMODITY, PART_KILOGRAM_UNITS);

  assert.ok(bought.ok);
  assert.equal(cargoLotsMassKgOf(ship.cargo), PART_KILOGRAM_MASS_KG);
  assert.equal(freeHoldOf(ship), 0);

  const sold = sellCommodity(
    dock,
    ship,
    pirate,
    PART_KILOGRAM_COMMODITY,
    PART_KILOGRAM_UNITS,
    MARKET,
  );

  assert.ok(sold.ok);
  assert.deepEqual(ship.cargo, []);
  assert.equal(freeHoldOf(ship), PART_KILOGRAM_MASS_KG);
});

test('a pirate cannot sell cargo the ship does not carry', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = sellCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS + 1, MARKET);

  assert.deepEqual(outcome, { ok: false, reason: 'insufficient-cargo' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('a dock stocked to its ceiling buys nothing more', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS);
  stockAt(dock, SPAWNED_COMMODITY).units = MARKET.maxStockUnits;
  const before = snapshotOf(dock, ship, pirate);

  const outcome = sellCommodity(dock, ship, pirate, SPAWNED_COMMODITY, A_FEW_UNITS, MARKET);

  assert.deepEqual(outcome, { ok: false, reason: 'market-stock-full' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('an uncolonized island has no dock to trade at', () => {
  const markets = createMarkets(MARKET);

  assert.equal(marketOf(markets, 'edgars-choice'), undefined);
});
