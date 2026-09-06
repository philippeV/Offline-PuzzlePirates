import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import { GameClient } from '../../packages/view/src/client/client.ts';
import {
  COURSE_END,
  COURSE_START,
  PROGRESS_PER_MILLE,
  coursePositionOf,
  legProgressPerMilleOf,
  passageHeadingOf,
} from '../../packages/view/src/scenes/sea.ts';

const SEED = 12648430;

function underWayClient(): GameClient {
  return GameClient.create({ seed: SEED, balance: BALANCE, opening: 'under-way' });
}

test('a voyage that has not moved sits at the start of the course', () => {
  assert.equal(legProgressPerMilleOf(null), 0);
  assert.deepEqual(coursePositionOf(0), COURSE_START);
});

test('a finished leg sits at the end of the course', () => {
  assert.deepEqual(coursePositionOf(PROGRESS_PER_MILLE), COURSE_END);
});

test('leg progress is the sailed fraction of the leg in per mille', () => {
  const voyage = { legTicks: 63, legTicksRequired: 252 } as never;
  assert.equal(legProgressPerMilleOf(voyage), 250);
});

test('a leg that costs no ticks reports no progress rather than dividing by zero', () => {
  const voyage = { legTicks: 10, legTicksRequired: 0 } as never;
  assert.equal(legProgressPerMilleOf(voyage), 0);
});

test('progress never runs past the end of the course', () => {
  const voyage = { legTicks: 900, legTicksRequired: 300 } as never;
  assert.equal(legProgressPerMilleOf(voyage), PROGRESS_PER_MILLE);
  assert.deepEqual(coursePositionOf(legProgressPerMilleOf(voyage)), COURSE_END);
});

test('the passage is named for the island the route ends at', () => {
  const client = underWayClient();
  assert.equal(passageHeadingOf(client.state.voyage), 'Bound for Doyle Island');
  assert.equal(passageHeadingOf(null), 'The open sea');
});

test('the under way opening actually leaves port', () => {
  const client = underWayClient();
  const voyage = client.state.voyage;
  assert.notEqual(voyage, null);
  assert.equal(voyage?.phase, 'under-way');
  assert.equal(voyage?.type, 'evade');
  assert.equal(client.atSea, true);
  assert.equal(client.state.pirate?.atIslandId, null);
});

test('the charted ship is the player hull, whatever id it was given', () => {
  const client = underWayClient();
  const player = client.state.ships.find((ship) => ship.allegiance === 'player');
  assert.notEqual(player, undefined);
  assert.equal(client.state.voyage?.shipId, player?.id);
});

test('being under way puts the player in the sea scene and bars the port', () => {
  const client = underWayClient();
  assert.equal(client.scene, 'sea');
  assert.equal(client.canEnter('sea'), true);
  assert.equal(client.canEnter('port'), false);
});

test('a moored pirate may not enter the sea scene', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  assert.equal(client.atSea, false);
  assert.equal(client.canEnter('sea'), false);
  assert.equal(client.scene, 'port');
});

test('the ship advances along the course as the leg is sailed', () => {
  const client = underWayClient();
  const start = coursePositionOf(legProgressPerMilleOf(client.state.voyage));
  client.advance(9000);
  const sailed = coursePositionOf(legProgressPerMilleOf(client.state.voyage));
  assert.ok(legProgressPerMilleOf(client.state.voyage) > 0);
  assert.ok(sailed.x > start.x);
  assert.ok(sailed.y < start.y);
  assert.equal(client.scene, 'sea');
});

test('arriving in port takes the player off the sea on the next tick', () => {
  const client = underWayClient();
  const route = client.state.voyage?.route ?? [];
  while (client.state.voyage !== null && (client.state.voyage.legIndex ?? 0) < route.length - 1) {
    client.advance(1000);
  }
  assert.equal(client.dispatch({ op: 'voyage.port' }).status, 'accepted');
  client.advance(1);
  assert.equal(client.atSea, false);
  assert.equal(client.scene, 'deck');
  assert.equal(client.canEnter('sea'), false);
  assert.equal(client.state.pirate?.atIslandId, 'doyle');
});

test('a battle at sea takes the scene from the passage', () => {
  const client = underWayClient();
  client.dispatch({
    op: 'ship.commission',
    shipClass: 'sloop',
    allegiance: 'brigand',
    cannonballs: BALANCE.battle.startingCannonballs,
    rum: BALANCE.battle.startingRum,
    cargoUnits: BALANCE.booty.brigandCargoUnitsBase,
  });
  assert.equal(client.dispatch({ op: 'battle.start', sinkingContext: true }).status, 'accepted');
  client.advance(1);
  assert.equal(client.scene, 'battle');
  assert.equal(client.canEnter('sea'), false);
});
