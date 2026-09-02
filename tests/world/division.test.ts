import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/index.ts';
import type { CommandResult } from '../../packages/sim/src/commands.ts';
import { PER_MILLE } from '../../packages/sim/src/puzzle/scoring.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { createWorldState, type WorldState } from '../../packages/sim/src/state.ts';
import { freeHoldOf } from '../../packages/sim/src/battle/booty.ts';
import { cargoLotsMassKgOf } from '../../packages/sim/src/world/cargo.ts';
import { divideBooty } from '../../packages/sim/src/world/division.ts';
import { applyWorldCommand } from '../../packages/sim/src/world/dispatch.ts';
import { createMarkets } from '../../packages/sim/src/world/market.ts';
import type { PirateState } from '../../packages/sim/src/world/state.ts';

const SEED = 20260902;
const CHEST_POE = 1000;
const HOLD_CANNON_BALLS = 3;
const CHEST_CANNON_BALLS = 7;
const FILLER_UNITS = 13429;

function chestedShipOf(): [WorldState, ShipState, PirateState] {
  const state = createWorldState(SEED, BALANCE);
  const ship = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  state.ships.push(ship);
  const pirate: PirateState = { poe: 0, atIslandId: 'alkaid' };
  state.pirate = pirate;
  state.markets = createMarkets(BALANCE.market);
  return [state, ship, pirate];
}

function cannonBallLadenShipOf(): [WorldState, ShipState, PirateState] {
  const [state, ship, pirate] = chestedShipOf();
  pirate.poe = BALANCE.world.startingPoe;
  ship.cargo = [
    { commodityId: 'hemp', units: FILLER_UNITS },
    { commodityId: 'small-cannon-ball', units: HOLD_CANNON_BALLS },
  ];
  ship.bootyCargo = [{ commodityId: 'small-cannon-ball', units: CHEST_CANNON_BALLS }];
  return [state, ship, pirate];
}

function boughtOneHempOf(state: WorldState, ship: ShipState): CommandResult {
  return applyWorldCommand(state, {
    op: 'market.buy',
    shipId: ship.id,
    commodityId: 'hemp',
    units: 1,
  });
}

test('dividing the booty moves the chest goods into the hold', () => {
  const [, ship, pirate] = chestedShipOf();
  ship.bootyPoe = CHEST_POE;
  ship.bootyCargo = [
    { commodityId: 'hemp', units: 20 },
    { commodityId: 'wood', units: 5 },
  ];
  ship.cargo = [{ commodityId: 'hemp', units: 7 }];

  const division = divideBooty(ship, pirate, BALANCE.division);

  assert.deepEqual(ship.bootyCargo, []);
  assert.deepEqual(ship.cargo, [
    { commodityId: 'hemp', units: 27 },
    { commodityId: 'wood', units: 5 },
  ]);
  assert.equal(division.cargoUnits, 25);
});

test('the chest and the hold draw on one mass budget, so division does not change free hold', () => {
  const [, ship] = chestedShipOf();
  ship.bootyCargo = [{ commodityId: 'stone', units: 40 }];
  const pirate: PirateState = { poe: 0, atIslandId: 'alkaid' };
  const before = freeHoldOf(ship);

  divideBooty(ship, pirate, BALANCE.division);

  assert.equal(freeHoldOf(ship), before);
  assert.equal(cargoLotsMassKgOf(ship.cargo), 40);
});

test('the crew cut reaches the hold and the pirate takes a share of what is left', () => {
  const [, ship, pirate] = chestedShipOf();
  ship.bootyPoe = CHEST_POE;

  const division = divideBooty(ship, pirate, BALANCE.division);

  const crewCut = Math.floor((CHEST_POE * BALANCE.division.crewCutPerMille) / PER_MILLE);
  const share = Math.floor(((CHEST_POE - crewCut) * BALANCE.division.playerSharePerMille) / PER_MILLE);
  assert.equal(division.crewCutPoe, crewCut);
  assert.equal(ship.poe, crewCut);
  assert.equal(pirate.poe, share);
  assert.equal(ship.bootyPoe, 0);
  assert.equal(division.crewCutPoe + division.pirateSharePoe + division.crewSharePoe, CHEST_POE);
});

test('plunder cannot be sold before it is divided, because it is not in the hold yet', () => {
  const [state, ship] = chestedShipOf();
  ship.bootyCargo = [{ commodityId: 'hemp', units: 20 }];

  const refused = applyWorldCommand(state, {
    op: 'market.sell',
    shipId: ship.id,
    commodityId: 'hemp',
    units: 20,
  });

  assert.equal(refused.status, 'rejected');
  assert.equal(refused.status === 'rejected' ? refused.reason : '', 'insufficient-cargo');
});

test('a chest holding only goods still divides, and only a wholly empty chest is refused', () => {
  const [state, ship] = chestedShipOf();
  ship.bootyCargo = [{ commodityId: 'hemp', units: 20 }];

  const divided = applyWorldCommand(state, { op: 'booty.divide', shipId: ship.id });
  assert.equal(divided.status, 'accepted');
  assert.deepEqual(ship.cargo, [{ commodityId: 'hemp', units: 20 }]);

  const refused = applyWorldCommand(state, { op: 'booty.divide', shipId: ship.id });
  assert.equal(refused.status, 'rejected');
  assert.equal(refused.status === 'rejected' ? refused.reason : '', 'no-booty');
});

test('a chest of cannon balls divides into the hold without gaining a kilogram', () => {
  const [, ship, pirate] = cannonBallLadenShipOf();
  const before = freeHoldOf(ship);

  divideBooty(ship, pirate, BALANCE.division);

  assert.equal(freeHoldOf(ship), before);
  assert.deepEqual(ship.bootyCargo, []);
});

test('a division does not move what the market will let the hold take on', () => {
  const [undivided, undividedShip] = cannonBallLadenShipOf();
  const [divided, dividedShip, dividedPirate] = cannonBallLadenShipOf();

  divideBooty(dividedShip, dividedPirate, BALANCE.division);

  assert.deepEqual(
    boughtOneHempOf(undivided, undividedShip),
    boughtOneHempOf(divided, dividedShip),
  );
});
