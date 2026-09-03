import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import { FIRST_ENTITY_ID } from '../../packages/sim/src/ids.ts';
import { freeHoldOf, holdCapacityOf } from '../../packages/sim/src/battle/booty.ts';
import type { ShipClassId } from '../../packages/sim/src/ship/classes.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { stowLot } from '../../packages/sim/src/world/cargo.ts';
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
const FITTING_BALL: CommodityId = 'small-cannon-ball';
const OVERSIZED_BALL: CommodityId = 'large-cannon-ball';
const RUM: CommodityId = 'swill';
const OTHER_RUM: CommodityId = 'grog';
const RUMS: CommodityId[] = [RUM, OTHER_RUM];
const LARGE_GUNNED_CLASS: ShipClassId = 'war-galleon';

const A_FEW_UNITS = 10;
const A_FEW_BALLS_MASS_KG = 71;
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

function shipOfClass(shipClass: ShipClassId, cargoUnits = 0): ShipState {
  return createShip(
    { nextEntityId: FIRST_ENTITY_ID },
    { shipClass, allegiance: 'player', cargoUnits },
  );
}

function sloop(cargoUnits = 0): ShipState {
  return shipOfClass('sloop', cargoUnits);
}

function pirateAt(islandId: IslandId, poe = AMPLE_POE): PirateState {
  return { poe, atIslandId: islandId };
}

function snapshotOf(market: IslandMarket, ship: ShipState, pirate: PirateState): string {
  return JSON.stringify([market, ship, pirate]);
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

test('a bought cannon ball goes to the magazine and not the hold', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  const outcome = buyCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS);

  assert.ok(outcome.ok);
  assert.equal(ship.cannonballs, A_FEW_UNITS);
  assert.deepEqual(ship.cargo, []);
});

test('bought rum goes to the rum store and not the hold', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  for (const rum of RUMS) assert.ok(buyCommodity(dock, ship, pirate, rum, A_FEW_UNITS).ok);

  assert.equal(ship.rum, A_FEW_UNITS * RUMS.length);
  assert.deepEqual(ship.cargo, []);
});

test('a ship cannot buy a ball its cannons cannot fire', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = buyCommodity(dock, ship, pirate, OVERSIZED_BALL, A_FEW_UNITS);

  assert.deepEqual(outcome, { ok: false, reason: 'wrong-cannon-ball-size' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('a large gunned ship buys the very ball the sloop was refused', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const galleon = shipOfClass(LARGE_GUNNED_CLASS);
  const pirate = pirateAt(SPAWNING_ISLAND);

  const outcome = buyCommodity(dock, galleon, pirate, OVERSIZED_BALL, A_FEW_UNITS);

  assert.ok(outcome.ok);
  assert.equal(galleon.cannonballs, A_FEW_UNITS);
});

test('a sold cannon ball comes out of the magazine', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS);
  const outcome = sellCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS - 1, MARKET);

  assert.ok(outcome.ok);
  assert.equal(ship.cannonballs, 1);
  assert.deepEqual(ship.cargo, []);
});

test('a magazine cannot sell more balls than it holds', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  buyCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = sellCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS + 1, MARKET);

  assert.deepEqual(outcome, { ok: false, reason: 'insufficient-cargo' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('a ship cannot sell a ball its cannons cannot fire', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = sellCommodity(dock, ship, pirate, OVERSIZED_BALL, A_FEW_UNITS, MARKET);

  assert.deepEqual(outcome, { ok: false, reason: 'wrong-cannon-ball-size' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('sold rum comes out of the rum store and not the hold', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, RUM, A_FEW_UNITS);
  const outcome = sellCommodity(dock, ship, pirate, RUM, A_FEW_UNITS - 1, MARKET);

  assert.ok(outcome.ok);
  assert.equal(ship.rum, 1);
  assert.deepEqual(ship.cargo, []);
});

test('a rum sale pays the pirate and restocks the dock', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const stock = stockAt(dock, RUM);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  buyCommodity(dock, ship, pirate, RUM, A_FEW_UNITS);
  const remaining = pirate.poe;
  const stocked = stock.units;

  const outcome = sellCommodity(dock, ship, pirate, RUM, A_FEW_UNITS, MARKET);

  assert.deepEqual(outcome, {
    ok: true,
    poe: A_FEW_UNITS * stock.buyPricePoe,
    units: A_FEW_UNITS,
  });
  assert.equal(pirate.poe, remaining + A_FEW_UNITS * stock.buyPricePoe);
  assert.equal(stock.units, stocked + A_FEW_UNITS);
});

test('a rum store cannot sell more rum than it holds', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  buyCommodity(dock, ship, pirate, RUM, A_FEW_UNITS);
  const before = snapshotOf(dock, ship, pirate);

  const outcome = sellCommodity(dock, ship, pirate, RUM, A_FEW_UNITS + 1, MARKET);

  assert.deepEqual(outcome, { ok: false, reason: 'insufficient-cargo' });
  assert.equal(snapshotOf(dock, ship, pirate), before);
});

test('swill and grog draw on one shared rum store', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, RUM, A_FEW_UNITS);
  const outcome = sellCommodity(dock, ship, pirate, OTHER_RUM, A_FEW_UNITS, MARKET);

  assert.ok(outcome.ok);
  assert.equal(ship.rum, 0);
});

test('a supply lot in the hold is invisible to the sell path', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  buyCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS);
  stowLot(ship.cargo, FITTING_BALL, A_FEW_UNITS);

  const overdrawn = sellCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS + 1, MARKET);
  const sold = sellCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS, MARKET);

  assert.deepEqual(overdrawn, { ok: false, reason: 'insufficient-cargo' });
  assert.ok(sold.ok);
  assert.equal(ship.cannonballs, 0);
  assert.deepEqual(ship.cargo, [{ commodityId: FITTING_BALL, units: A_FEW_UNITS }]);
});

test('a stocked magazine takes its own mass out of the free hold', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);

  buyCommodity(dock, ship, pirate, FITTING_BALL, A_FEW_UNITS);

  assert.equal(freeHoldOf(ship), holdCapacityOf(ship) - A_FEW_BALLS_MASS_KG);
});

test('a magazine heavier than the free hold is refused', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const laden = sloop(holdCapacityOf(sloop()) - A_FEW_BALLS_MASS_KG);
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, laden, pirate);

  const outcome = buyCommodity(dock, laden, pirate, FITTING_BALL, A_FEW_UNITS + 1);

  assert.deepEqual(outcome, { ok: false, reason: 'hold-full' });
  assert.equal(snapshotOf(dock, laden, pirate), before);
  assert.ok(buyCommodity(dock, laden, pirate, FITTING_BALL, A_FEW_UNITS).ok);
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

test('a negative unit count is refused on both sides of the counter', () => {
  const markets = createMarkets(MARKET);
  const dock = dockAt(markets, SPAWNING_ISLAND);
  const ship = sloop();
  const pirate = pirateAt(SPAWNING_ISLAND);
  const before = snapshotOf(dock, ship, pirate);

  const bought = buyCommodity(dock, ship, pirate, SPAWNED_COMMODITY, -1);
  const sold = sellCommodity(dock, ship, pirate, SPAWNED_COMMODITY, -1, MARKET);

  assert.deepEqual(bought, { ok: false, reason: 'negative-units' });
  assert.deepEqual(sold, { ok: false, reason: 'negative-units' });
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
