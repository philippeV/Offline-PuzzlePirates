import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/index.ts';
import { createBattle } from '../../packages/sim/src/battle/state.ts';
import type { CommandResult } from '../../packages/sim/src/commands.ts';
import type { SimEvent } from '../../packages/sim/src/events.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { createWorldState, type WorldState } from '../../packages/sim/src/state.ts';
import type { CommodityId } from '../../packages/sim/src/world/commodities.ts';
import { applyWorldCommand } from '../../packages/sim/src/world/dispatch.ts';
import type { IslandId } from '../../packages/sim/src/world/islands.ts';
import type { VoyageState, VoyageType } from '../../packages/sim/src/world/state.ts';
import { chartVoyage } from '../../packages/sim/src/world/voyage.ts';

const SEED = 20260902;
const TICK = 4242;
const HOME_ISLAND: IslandId = 'alkaid';
const DESTINATION: IslandId = 'doyle';
const UNCOLONIZED_ISLAND: IslandId = 'edgars-choice';
const UNKNOWN_ISLAND = 'sirius' as IslandId;
const UNKNOWN_COMMODITY = 'kraken-ink' as CommodityId;
const UNKNOWN_SHIP_ID = 404;
const LEGS_TO_DESTINATION = 2;
const OPEN_WATER_LEG_INDEX = 1;
const TRADED_COMMODITY: CommodityId = 'small-cannon-ball';
const TRADED_UNITS = 3;
const TRADED_BUY_POE = 168;
const TRADED_SELL_POE = 126;
const CHEST_POE = 1003;
const CREW_CUT_POE = 250;
const PIRATE_SHARE_POE = 301;

function worldOf(): WorldState {
  const state = createWorldState(SEED, BALANCE);
  state.tick = TICK;
  return state;
}

function startedWorldOf(islandId: IslandId = HOME_ISLAND): [WorldState, ShipState] {
  const state = worldOf();
  assert.equal(applyWorldCommand(state, { op: 'world.start', islandId }).status, 'accepted');
  const ship = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  state.ships.push(ship);
  return [state, ship];
}

function eventsOf(result: CommandResult): SimEvent[] {
  assert.ok(result.status === 'accepted', JSON.stringify(result));
  return result.events;
}

function reasonOf(result: CommandResult): string {
  assert.ok(result.status === 'rejected', JSON.stringify(result));
  return result.reason;
}

function chartedOf(state: WorldState, ship: ShipState, voyageType: VoyageType): VoyageState {
  const charted = chartVoyage(state, ship, DESTINATION, voyageType);
  assert.ok(typeof charted !== 'string', String(charted));
  return charted;
}

function sailedToPortOf(state: WorldState): VoyageState {
  const voyage = state.voyage;
  assert.ok(voyage !== null);
  voyage.legIndex = voyage.route.length - 1;
  return voyage;
}

test('starting the world announces the island the pirate opens at', () => {
  const state = worldOf();

  const events = eventsOf(applyWorldCommand(state, { op: 'world.start', islandId: DESTINATION }));

  assert.deepEqual(events, [{ type: 'world.started', tick: TICK, islandId: DESTINATION }]);
  assert.equal(state.pirate?.atIslandId, DESTINATION);
  assert.equal(state.pirate?.poe, BALANCE.world.startingPoe);
});

test('chartering announces the ship, the destination and the legs the route actually has', () => {
  const [state, ship] = startedWorldOf();

  const events = eventsOf(
    applyWorldCommand(state, {
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'trade',
    }),
  );

  assert.deepEqual(events, [
    {
      type: 'voyage.charted',
      tick: TICK,
      shipId: ship.id,
      toIslandId: DESTINATION,
      legs: LEGS_TO_DESTINATION,
    },
  ]);
  assert.equal(state.voyage?.route.length, LEGS_TO_DESTINATION + 1);
});

test('chartering leaves the pirate ashore with nothing sailed but a course', () => {
  const [state, ship] = startedWorldOf();

  assert.equal(
    applyWorldCommand(state, {
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'trade',
    }).status,
    'accepted',
  );

  assert.equal(state.voyage?.phase, 'charted');
  assert.equal(state.pirate?.atIslandId, HOME_ISLAND);
});

test('setting sail announces the destination and takes the pirate out of port', () => {
  const [state, ship] = startedWorldOf();
  state.voyage = chartedOf(state, ship, 'trade');

  const events = eventsOf(applyWorldCommand(state, { op: 'voyage.sail' }));

  assert.deepEqual(events, [
    { type: 'voyage.sailed', tick: TICK, shipId: ship.id, toIslandId: DESTINATION },
  ]);
  assert.equal(state.voyage?.phase, 'under-way');
  assert.equal(state.pirate?.atIslandId, null);
});

test('abandoning a charted course strikes it out and leaves the pirate where it stood', () => {
  const [state, ship] = startedWorldOf();
  state.voyage = chartedOf(state, ship, 'trade');

  const events = eventsOf(applyWorldCommand(state, { op: 'voyage.abandon' }));

  assert.deepEqual(events, [{ type: 'voyage.abandoned', tick: TICK, islandId: HOME_ISLAND }]);
  assert.equal(state.voyage, null);
  assert.equal(state.pirate?.atIslandId, HOME_ISLAND);
});

test('porting announces the island the voyage ended at, not the one it left', () => {
  const [state, ship] = startedWorldOf();
  assert.equal(
    applyWorldCommand(state, {
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'evade',
    }).status,
    'accepted',
  );
  sailedToPortOf(state);

  const events = eventsOf(applyWorldCommand(state, { op: 'voyage.port' }));

  assert.deepEqual(events, [{ type: 'voyage.ported', tick: TICK, islandId: DESTINATION }]);
  assert.equal(state.pirate?.atIslandId, DESTINATION);
  assert.equal(state.voyage, null);
});

test('a purchase and a sale announce opposite sides of the same dock', () => {
  const [state, ship] = startedWorldOf();

  const bought = eventsOf(
    applyWorldCommand(state, {
      op: 'market.buy',
      shipId: ship.id,
      commodityId: TRADED_COMMODITY,
      units: TRADED_UNITS,
    }),
  );
  const sold = eventsOf(
    applyWorldCommand(state, {
      op: 'market.sell',
      shipId: ship.id,
      commodityId: TRADED_COMMODITY,
      units: TRADED_UNITS,
    }),
  );

  assert.deepEqual(bought, [
    {
      type: 'market.traded',
      tick: TICK,
      islandId: HOME_ISLAND,
      commodityId: TRADED_COMMODITY,
      side: 'buy',
      units: TRADED_UNITS,
      poe: TRADED_BUY_POE,
    },
  ]);
  assert.deepEqual(sold, [
    {
      type: 'market.traded',
      tick: TICK,
      islandId: HOME_ISLAND,
      commodityId: TRADED_COMMODITY,
      side: 'sell',
      units: TRADED_UNITS,
      poe: TRADED_SELL_POE,
    },
  ]);
  assert.equal(
    state.pirate?.poe,
    BALANCE.world.startingPoe - TRADED_BUY_POE + TRADED_SELL_POE,
  );
});

test('dividing a chest that does not split evenly announces the coin it actually paid', () => {
  const [state, ship] = startedWorldOf();
  ship.bootyPoe = CHEST_POE;

  const events = eventsOf(applyWorldCommand(state, { op: 'booty.divide', shipId: ship.id }));

  assert.deepEqual(events, [
    {
      type: 'booty.divided',
      tick: TICK,
      shipId: ship.id,
      poe: CHEST_POE,
      crewCutPoe: CREW_CUT_POE,
      pirateSharePoe: PIRATE_SHARE_POE,
    },
  ]);
  assert.equal(ship.poe, CREW_CUT_POE);
  assert.equal(state.pirate?.poe, BALANCE.world.startingPoe + PIRATE_SHARE_POE);
});

test('a world that has already started refuses to start again', () => {
  const [state] = startedWorldOf();

  assert.equal(
    reasonOf(applyWorldCommand(state, { op: 'world.start', islandId: DESTINATION })),
    'world-already-started',
  );
  assert.equal(state.pirate?.atIslandId, HOME_ISLAND);
});

test('an island the archipelago does not hold is refused, starting or charting', () => {
  const opening = worldOf();

  assert.equal(
    reasonOf(applyWorldCommand(opening, { op: 'world.start', islandId: UNKNOWN_ISLAND })),
    'unknown-island',
  );
  assert.equal(opening.pirate, null);

  const [state, ship] = startedWorldOf();

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'voyage.chart',
        shipId: ship.id,
        toIslandId: UNKNOWN_ISLAND,
        voyageType: 'trade',
      }),
    ),
    'unknown-island',
  );
  assert.equal(state.voyage, null);
});

test('every world command before the world starts is refused for want of a world', () => {
  const state = worldOf();
  const ship = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  state.ships.push(ship);

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'voyage.chart',
        shipId: ship.id,
        toIslandId: DESTINATION,
        voyageType: 'trade',
      }),
    ),
    'world-not-started',
  );
  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.sail' })), 'world-not-started');
  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.abandon' })), 'world-not-started');
  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.port' })), 'world-not-started');
  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'market.buy',
        shipId: ship.id,
        commodityId: TRADED_COMMODITY,
        units: TRADED_UNITS,
      }),
    ),
    'world-not-started',
  );
  assert.equal(
    reasonOf(applyWorldCommand(state, { op: 'booty.divide', shipId: ship.id })),
    'world-not-started',
  );
});

test('a pirate at sea is refused every command that needs a port', () => {
  const [state, ship] = startedWorldOf();
  const pirate = state.pirate;
  assert.ok(pirate !== null);
  pirate.atIslandId = null;

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'voyage.chart',
        shipId: ship.id,
        toIslandId: DESTINATION,
        voyageType: 'trade',
      }),
    ),
    'not-in-port',
  );
  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'market.sell',
        shipId: ship.id,
        commodityId: TRADED_COMMODITY,
        units: TRADED_UNITS,
      }),
    ),
    'not-in-port',
  );
  assert.equal(
    reasonOf(applyWorldCommand(state, { op: 'booty.divide', shipId: ship.id })),
    'not-in-port',
  );
});

test('a second voyage is refused while the first one is still running', () => {
  const [state, ship] = startedWorldOf();
  state.voyage = chartedOf(state, ship, 'trade');

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'voyage.chart',
        shipId: ship.id,
        toIslandId: DESTINATION,
        voyageType: 'trade',
      }),
    ),
    'voyage-already-running',
  );
});

test('porting with no voyage under way is refused', () => {
  const [state] = startedWorldOf();

  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.port' })), 'no-voyage-running');
});

test('setting sail or abandoning with no course charted is refused', () => {
  const [state] = startedWorldOf();

  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.sail' })), 'no-voyage-running');
  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.abandon' })), 'no-voyage-running');
});

test('setting sail twice is refused, so a voyage is never departed twice', () => {
  const [state, ship] = startedWorldOf();
  state.voyage = chartedOf(state, ship, 'trade');
  assert.equal(applyWorldCommand(state, { op: 'voyage.sail' }).status, 'accepted');

  assert.equal(
    reasonOf(applyWorldCommand(state, { op: 'voyage.sail' })),
    'voyage-already-under-way',
  );
  assert.equal(state.pirate?.atIslandId, null);
});

test('abandoning a voyage already under way is refused rather than teleporting it home', () => {
  const [state, ship] = startedWorldOf();
  state.voyage = chartedOf(state, ship, 'trade');
  assert.equal(applyWorldCommand(state, { op: 'voyage.sail' }).status, 'accepted');

  assert.equal(
    reasonOf(applyWorldCommand(state, { op: 'voyage.abandon' })),
    'voyage-already-under-way',
  );
  assert.notEqual(state.voyage, null);
  assert.equal(state.pirate?.atIslandId, null);
});

test('abandoning a charted course during a running battle is refused, so the battle is never stranded', () => {
  const [state, ship] = startedWorldOf();
  state.voyage = chartedOf(state, ship, 'pillage');
  state.battle = createBattle([], false);

  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.abandon' })), 'battle-running');
  assert.notEqual(state.voyage, null);
  assert.notEqual(state.battle, null);
});

test('a voyage of a type the world does not sail is refused by name', () => {
  const [state, ship] = startedWorldOf();

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'voyage.chart',
        shipId: ship.id,
        toIslandId: DESTINATION,
        voyageType: 'raid' as VoyageType,
      }),
    ),
    'unknown-voyage-type',
  );
  assert.equal(state.voyage, null);
});

test('porting out of a running battle is refused, so the world is never stranded', () => {
  const [state, ship] = startedWorldOf();
  assert.equal(
    applyWorldCommand(state, {
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'pillage',
    }).status,
    'accepted',
  );
  assert.equal(applyWorldCommand(state, { op: 'voyage.sail' }).status, 'accepted');
  sailedToPortOf(state);
  state.battle = createBattle([], false);

  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.port' })), 'battle-running');
  assert.notEqual(state.voyage, null);
  assert.equal(state.pirate?.atIslandId, null);
});

test('a commodity the catalogue does not list is refused on both sides of a trade', () => {
  const [state, ship] = startedWorldOf();

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'market.buy',
        shipId: ship.id,
        commodityId: UNKNOWN_COMMODITY,
        units: TRADED_UNITS,
      }),
    ),
    'unknown-commodity',
  );
  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'market.sell',
        shipId: ship.id,
        commodityId: UNKNOWN_COMMODITY,
        units: TRADED_UNITS,
      }),
    ),
    'unknown-commodity',
  );
  assert.deepEqual(ship.cargo, []);
});

test('an island that never opened a dock refuses to trade', () => {
  const [state, ship] = startedWorldOf(UNCOLONIZED_ISLAND);

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'market.buy',
        shipId: ship.id,
        commodityId: TRADED_COMMODITY,
        units: TRADED_UNITS,
      }),
    ),
    'island-has-no-market',
  );
});

test('porting in open water between two islands is refused as no island at all', () => {
  const [state, ship] = startedWorldOf();
  assert.equal(
    applyWorldCommand(state, {
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'evade',
    }).status,
    'accepted',
  );
  assert.equal(applyWorldCommand(state, { op: 'voyage.sail' }).status, 'accepted');
  const voyage = state.voyage;
  assert.ok(voyage !== null);
  voyage.legIndex = OPEN_WATER_LEG_INDEX;

  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.port' })), 'not-at-island');
  assert.notEqual(state.voyage, null);
  assert.equal(state.pirate?.atIslandId, null);
});

test('a ship the fleet does not hold is refused by name, charting, trading or dividing', () => {
  const [state] = startedWorldOf();

  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'voyage.chart',
        shipId: UNKNOWN_SHIP_ID,
        toIslandId: DESTINATION,
        voyageType: 'trade',
      }),
    ),
    'unknown-ship',
  );
  assert.equal(
    reasonOf(
      applyWorldCommand(state, {
        op: 'market.buy',
        shipId: UNKNOWN_SHIP_ID,
        commodityId: TRADED_COMMODITY,
        units: TRADED_UNITS,
      }),
    ),
    'unknown-ship',
  );
  assert.equal(
    reasonOf(applyWorldCommand(state, { op: 'booty.divide', shipId: UNKNOWN_SHIP_ID })),
    'unknown-ship',
  );
});

test('a refused porting settles nothing, so the battle outlives the command that failed', () => {
  const [state, ship] = startedWorldOf();
  assert.equal(
    applyWorldCommand(state, {
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'pillage',
    }).status,
    'accepted',
  );
  const voyage = state.voyage;
  assert.ok(voyage !== null);
  voyage.legIndex = OPEN_WATER_LEG_INDEX;
  const brigand = createShip(state, { shipClass: 'sloop', allegiance: 'brigand' });
  state.ships.push(brigand);
  state.battle = createBattle(
    [
      { shipId: ship.id, x: 1, y: 1, facing: 'north' },
      { shipId: brigand.id, x: 1, y: 20, facing: 'south' },
    ],
    false,
  );
  state.battle.outcome = 'player-won';

  assert.equal(reasonOf(applyWorldCommand(state, { op: 'voyage.port' })), 'not-at-island');
  assert.equal(state.battle?.outcome, 'player-won');
  assert.deepEqual(
    state.ships.map((hull) => hull.id),
    [ship.id, brigand.id],
  );
});
