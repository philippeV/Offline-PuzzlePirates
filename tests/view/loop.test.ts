import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import { GameClient } from '../../packages/view/src/client/client.ts';
import { sailToDestination, shipOf, type LoopDriver } from '../world/loop.ts';

const SEED = 20260902;
const DESTINATION = 'doyle';
const TRADED_COMMODITY = 'sugar-cane';
const TRADED_UNITS = 40;
const MAX_VOYAGE_TICKS = 4000000;

function driverOf(client: GameClient): LoopDriver {
  return {
    get state() {
      return client.state;
    },
    dispatch: (command) => client.dispatch(command),
    step: (ticks) => client.advance(ticks),
  };
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

  assert.equal(
    client.dispatch({
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'pillage',
    }).status,
    'accepted',
  );

  assert.ok(client.canEnter('port'), 'a charted course must not strand the player aboard');
  assert.equal(client.dispatch({ op: 'voyage.sail' }).status, 'accepted');

  client.advance(1);
  assert.ok(client.atSea);
  assert.equal(client.canEnter('port'), false);
  assert.equal(client.scene, 'deck');

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

  client.dispatch({
    op: 'voyage.chart',
    shipId: ship.id,
    toIslandId: DESTINATION,
    voyageType: 'pillage',
  });
  client.dispatch({ op: 'voyage.sail' });
  sailToDestination(driverOf(client), MAX_VOYAGE_TICKS);
  client.dispatch({ op: 'voyage.port' });

  const spoken = client.log.map((line) => line.text);
  assert.ok(spoken.some((text) => text.startsWith('Course set for')));
  assert.ok(spoken.some((text) => text.includes('brigand')));
  assert.ok(spoken.some((text) => text.startsWith('Ported at')));
});

test('the client refuses to leave the deck for the port while at sea', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const ship = shipOf(client.state, 'player');

  client.dispatch({
    op: 'voyage.chart',
    shipId: ship.id,
    toIslandId: DESTINATION,
    voyageType: 'pillage',
  });
  client.dispatch({ op: 'voyage.sail' });

  assert.equal(client.enterScene('port'), false);
  assert.equal(client.scene, 'port');
  client.advance(1);
  assert.equal(client.scene, 'deck');
});
