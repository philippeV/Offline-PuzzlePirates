import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Sim, type WorldState } from '@opp/sim';

import {
  HOME_ISLAND,
  PILLAGE_LOOP_SCENARIO,
  createScenarioSim,
} from '../../packages/harness/src/index.ts';

import { sailToDestination, shipOf } from './loop.ts';

const SEED = 20260902;
const DESTINATION = 'doyle';
const TRADED_COMMODITY = 'sugar-cane';
const TRADED_UNITS = 40;
const MAX_VOYAGE_TICKS = 4000000;
const WINNING_SEEDS = 24;

function stateOf(sim: Sim): WorldState {
  return sim.state as WorldState;
}

test('the whole pillage loop runs end to end and survives a save and a reload', () => {
  const sim = createScenarioSim(SEED, PILLAGE_LOOP_SCENARIO);
  const ship = shipOf(stateOf(sim), 'player');
  const openingPurse = stateOf(sim).pirate?.poe ?? 0;
  assert.equal(stateOf(sim).pirate?.atIslandId, HOME_ISLAND);

  const bought = sim.dispatch({
    op: 'market.buy',
    shipId: ship.id,
    commodityId: TRADED_COMMODITY,
    units: TRADED_UNITS,
  });
  assert.equal(bought.status, 'accepted');

  const charted = sim.dispatch({
    op: 'voyage.chart',
    shipId: ship.id,
    toIslandId: DESTINATION,
    voyageType: 'pillage',
  });
  assert.equal(charted.status, 'accepted');
  assert.equal(stateOf(sim).pirate?.atIslandId, null);

  sailToDestination(sim, MAX_VOYAGE_TICKS);

  const ported = sim.dispatch({ op: 'voyage.port' });
  assert.equal(ported.status, 'accepted');
  assert.equal(stateOf(sim).pirate?.atIslandId, DESTINATION);
  assert.equal(stateOf(sim).voyage, null);

  const sold = sim.dispatch({
    op: 'market.sell',
    shipId: ship.id,
    commodityId: TRADED_COMMODITY,
    units: TRADED_UNITS,
  });
  assert.equal(sold.status, 'accepted');

  const purse = stateOf(sim).pirate?.poe ?? 0;
  assert.ok(purse > openingPurse, `carrying cargo to ${DESTINATION} did not pay: ${purse}`);

  const saved = sim.save();
  const reloaded = Sim.load(saved);

  assert.equal(reloaded.hash(), sim.hash());
  assert.equal(reloaded.save(), saved);
});

test('a won encounter fills the booty chest and dividing it pays the pirate a share', () => {
  const won = pillageUntilWon();
  assert.ok(won !== null, 'no seed produced a won encounter');

  const { sim, ship } = won;
  const chest = ship.bootyPoe;
  const chestGoods = ship.bootyCargo.map((lot) => ({ ...lot }));
  const purseBefore = stateOf(sim).pirate?.poe ?? 0;
  const holdBefore = ship.poe;

  assert.ok(chestGoods.length > 0, 'a won encounter yielded no goods to the chest');
  assert.deepEqual(ship.cargo, [], 'plunder reached the hold without being divided');

  assert.equal(sim.dispatch({ op: 'voyage.port' }).status, 'accepted');
  const divided = sim.dispatch({ op: 'booty.divide', shipId: ship.id });
  assert.equal(divided.status, 'accepted');

  assert.equal(ship.bootyPoe, 0);
  assert.deepEqual(ship.bootyCargo, [], 'the chest still holds goods after division');
  assert.deepEqual(ship.cargo, chestGoods, 'the divided goods did not reach the hold');
  assert.ok((stateOf(sim).pirate?.poe ?? 0) > purseBefore, 'the pirate was paid nothing');
  assert.ok(ship.poe > holdBefore, 'the restocking cut never reached the hold');
  assert.ok(
    (stateOf(sim).pirate?.poe ?? 0) - purseBefore + (ship.poe - holdBefore) <= chest,
    'the division paid out more than the chest held',
  );

  assert.equal(sim.dispatch({ op: 'booty.divide', shipId: ship.id }).status, 'rejected');
});

function pillageUntilWon(): { sim: Sim; ship: ReturnType<typeof shipOf> } | null {
  for (let seed = 1; seed <= WINNING_SEEDS; seed += 1) {
    const sim = createScenarioSim(seed, PILLAGE_LOOP_SCENARIO);
    const ship = shipOf(stateOf(sim), 'player');
    sim.dispatch({
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'pillage',
    });
    sailToDestination(sim, MAX_VOYAGE_TICKS);
    if (ship.bootyPoe > 0) return { sim, ship };
  }
  return null;
}
