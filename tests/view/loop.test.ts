import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import { GameClient } from '../../packages/view/src/client/client.ts';
import type { CommandResult } from '../../packages/view/src/client/rules.ts';
import { departureIntentOf } from '../../packages/view/src/scenes/deck.ts';
import { sailToDestination, shipOf, type LoopDriver } from '../world/loop.ts';

const SEED = 20260902;
const DESTINATION = 'doyle';
const TRADED_COMMODITY = 'sugar-cane';
const TRADED_UNITS = 40;
const MAX_VOYAGE_TICKS = 4000000;
const TO_THE_PASSAGE = { kind: 'enter-scene', scene: 'sea' };

function driverOf(client: GameClient): LoopDriver {
  return {
    get state() {
      return client.state;
    },
    dispatch: (command) => client.dispatch(command),
    step: (ticks) => client.advance(ticks),
  };
}

function chartCourse(client: GameClient): CommandResult {
  return client.dispatch({
    op: 'voyage.chart',
    shipId: shipOf(client.state, 'player').id,
    toIslandId: DESTINATION,
    voyageType: 'pillage',
  });
}

test('a player drives the whole pillage loop through the client', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const ship = shipOf(client.state, 'player');
  const openingPurse = client.state.pirate?.poe ?? 0;

  assert.equal(client.scene, 'port');
  assert.ok(client.enterScene('deck'));
  assert.ok(client.canEnter('port'));

  assert.equal(
    client.dispatch({
      op: 'market.buy',
      shipId: ship.id,
      commodityId: TRADED_COMMODITY,
      units: TRADED_UNITS,
    }).status,
    'accepted',
  );

  assert.equal(chartCourse(client).status, 'accepted');

  assert.ok(client.canEnter('port'), 'a charted course must not strand the player aboard');
  assert.equal(client.canEnter('sea'), false, 'the passage must not be walkable alongside');
  const departure = departureIntentOf(client.dispatch({ op: 'voyage.sail' }));
  assert.deepEqual(departure, TO_THE_PASSAGE);
  assert.ok(client.enterScene('sea'));

  client.advance(1);
  assert.ok(client.atSea);
  assert.equal(client.canEnter('port'), false);
  assert.ok(client.canEnter('sea'));
  assert.equal(client.scene, 'sea');

  const report = sailToDestination(driverOf(client), MAX_VOYAGE_TICKS);
  assert.ok(report.battles > 0, 'a pillage voyage that meets no brigand proves nothing');

  assert.equal(client.dispatch({ op: 'voyage.port' }).status, 'accepted');
  assert.equal(client.state.pirate?.atIslandId, DESTINATION);
  assert.ok(client.enterScene('port'));

  const plundered = shipOf(client.state, 'player');
  if (plundered.bootyPoe > 0 || plundered.bootyCargoUnits > 0) {
    assert.equal(client.dispatch({ op: 'booty.divide', shipId: ship.id }).status, 'accepted');
  }

  assert.equal(
    client.dispatch({
      op: 'market.sell',
      shipId: ship.id,
      commodityId: TRADED_COMMODITY,
      units: TRADED_UNITS,
    }).status,
    'accepted',
  );

  assert.ok((client.state.pirate?.poe ?? 0) > openingPurse, 'the voyage did not pay');
});

test('the client shows the player what happened on the voyage', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const ship = shipOf(client.state, 'player');

  chartCourse(client);
  client.dispatch({ op: 'voyage.sail' });
  sailToDestination(driverOf(client), MAX_VOYAGE_TICKS);
  client.dispatch({ op: 'voyage.port' });

  const spoken = client.log.map((line) => line.text);
  assert.ok(spoken.some((text) => text.startsWith('Course set for')));
  assert.ok(spoken.some((text) => text.includes('brigand')));
  assert.ok(spoken.some((text) => text.startsWith('Ported at')));
  assert.equal(shipOf(client.state, 'player').id, ship.id);
});

test('only an accepted sail carries the player from the deck onto the passage', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  assert.ok(client.enterScene('deck'));

  assert.equal(departureIntentOf(client.dispatch({ op: 'voyage.sail' })), null);
  assert.equal(client.scene, 'deck');

  assert.equal(chartCourse(client).status, 'accepted');
  assert.deepEqual(departureIntentOf(client.dispatch({ op: 'voyage.sail' })), TO_THE_PASSAGE);
  assert.ok(client.enterScene('sea'));
  assert.equal(client.scene, 'sea');
});

test('the deck stays reachable under way and the next tick leaves the player on it', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  chartCourse(client);
  client.enterScene('deck');
  assert.deepEqual(departureIntentOf(client.dispatch({ op: 'voyage.sail' })), TO_THE_PASSAGE);
  client.enterScene('sea');
  client.advance(1);
  assert.equal(client.scene, 'sea');

  assert.ok(client.enterScene('deck'));
  client.advance(1);
  assert.ok(client.atSea);
  assert.equal(client.scene, 'deck');
});

test('a save taken under way restores the player onto the passage', () => {
  const sailing = GameClient.create({ seed: SEED, balance: BALANCE, opening: 'under-way' });
  const reloaded = GameClient.create({ seed: SEED, balance: BALANCE });

  assert.equal(reloaded.scene, 'port');
  reloaded.restore(sailing.save());
  assert.equal(reloaded.scene, 'sea');
  assert.equal(reloaded.canEnter('port'), false);
});
