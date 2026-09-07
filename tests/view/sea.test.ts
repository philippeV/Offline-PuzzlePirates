import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import { GameClient } from '../../packages/view/src/client/client.ts';
import type { VoyageState } from '../../packages/view/src/client/rules.ts';
import {
  DESIGN_STAGE_HEIGHT,
  DESIGN_STAGE_WIDTH,
  halfStageTileRadius,
} from '../../packages/view/src/iso/projection.ts';
import {
  COURSE_END,
  COURSE_START,
  PROGRESS_PER_MILLE,
  SEA_HEIGHT,
  SEA_WIDTH,
  coursePositionOf,
  passageHeadingOf,
  voyageProgressPerMilleOf,
} from '../../packages/view/src/scenes/sea.ts';

const SEED = 12648430;
const TWO_LEG_ROUTE = ['alkaid', 'kirin', 'doyle'];

function underWayClient(): GameClient {
  return GameClient.create({ seed: SEED, balance: BALANCE, opening: 'under-way' });
}

function voyageAt(legIndex: number, legTicks: number, legTicksRequired: number): VoyageState {
  return { route: TWO_LEG_ROUTE, legIndex, legTicks, legTicksRequired } as never;
}

test('a voyage that has not moved sits at the start of the course', () => {
  assert.equal(voyageProgressPerMilleOf(null), 0);
  assert.equal(voyageProgressPerMilleOf(voyageAt(0, 0, 25200)), 0);
  assert.deepEqual(coursePositionOf(0), COURSE_START);
});

test('a finished voyage sits at the end of the course', () => {
  assert.deepEqual(coursePositionOf(PROGRESS_PER_MILLE), COURSE_END);
});

test('progress is the sailed fraction of the whole passage, not of the leg', () => {
  assert.equal(voyageProgressPerMilleOf(voyageAt(0, 63, 252)), 125);
  assert.equal(voyageProgressPerMilleOf(voyageAt(1, 63, 252)), 625);
});

test('a leg that costs no ticks reports the legs already sailed rather than dividing by zero', () => {
  assert.equal(voyageProgressPerMilleOf(voyageAt(1, 10, 0)), 500);
});

test('a route with no legs reports no progress', () => {
  const berthed = { route: ['alkaid'], legIndex: 0, legTicks: 0, legTicksRequired: 0 } as never;
  assert.equal(voyageProgressPerMilleOf(berthed), 0);
});

test('progress never runs past the end of the course', () => {
  const overrun = voyageAt(1, 900, 300);
  assert.equal(voyageProgressPerMilleOf(overrun), PROGRESS_PER_MILLE);
  assert.deepEqual(coursePositionOf(voyageProgressPerMilleOf(overrun)), COURSE_END);
});

test('progress does not snap backwards at an interior league point', () => {
  const endingTheLeg = voyageProgressPerMilleOf(voyageAt(0, 25199, 25200));
  const leaguePoint = voyageProgressPerMilleOf(voyageAt(1, 0, 18000));
  const leavingIt = voyageProgressPerMilleOf(voyageAt(1, 1800, 18000));

  assert.equal(leaguePoint, PROGRESS_PER_MILLE / 2);
  assert.ok(endingTheLeg < leaguePoint);
  assert.ok(leaguePoint < leavingIt);
});

test('both course endpoints keep the design stage clear of the backdrop', () => {
  const radius = halfStageTileRadius(DESIGN_STAGE_WIDTH, DESIGN_STAGE_HEIGHT);

  assert.ok(Math.min(COURSE_START.x, COURSE_END.x) >= radius);
  assert.ok(Math.min(COURSE_START.y, COURSE_END.y) >= radius);
  assert.ok(Math.max(COURSE_START.x, COURSE_END.x) + radius < SEA_WIDTH);
  assert.ok(Math.max(COURSE_START.y, COURSE_END.y) + radius < SEA_HEIGHT);
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
  const start = coursePositionOf(voyageProgressPerMilleOf(client.state.voyage));
  client.advance(9000);
  const sailed = coursePositionOf(voyageProgressPerMilleOf(client.state.voyage));
  assert.ok(voyageProgressPerMilleOf(client.state.voyage) > 0);
  assert.ok(sailed.x > start.x);
  assert.ok(sailed.y < start.y);
  assert.equal(client.scene, 'sea');
});

test('the last leg lands the ship on the end of the course and holds it there', () => {
  const client = underWayClient();
  const route = client.state.voyage?.route ?? [];
  while (client.state.voyage !== null && (client.state.voyage.legIndex ?? 0) < route.length - 1) {
    client.advance(1000);
  }
  assert.equal(voyageProgressPerMilleOf(client.state.voyage), PROGRESS_PER_MILLE);
  assert.deepEqual(coursePositionOf(voyageProgressPerMilleOf(client.state.voyage)), COURSE_END);

  client.advance(5000);
  assert.equal(voyageProgressPerMilleOf(client.state.voyage), PROGRESS_PER_MILLE);
  assert.deepEqual(coursePositionOf(voyageProgressPerMilleOf(client.state.voyage)), COURSE_END);
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
