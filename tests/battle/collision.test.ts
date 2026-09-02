import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createBattleBoard,
  setTile,
  type BattleBoard,
} from '../../packages/sim/src/battle/board.ts';
import {
  resolveMovement,
  type CollisionIntent,
  type CollisionOutcome,
  type CollisionShip,
} from '../../packages/sim/src/battle/collision.ts';
import type { BoardPosition, Facing } from '../../packages/sim/src/battle/geometry.ts';
import { whirlEffect, windEffect } from '../../packages/sim/src/battle/tiles.ts';
import { shipClassOf, type ShipClassId } from '../../packages/sim/src/ship/classes.ts';
import type { EntityId } from '../../packages/sim/src/ids.ts';

const A = 1;
const B = 2;
const C = 3;

const STATIONARY: CollisionIntent = { kind: 'stationary' };
const FORWARD: CollisionIntent = { kind: 'forward' };
const TURN_RIGHT: CollisionIntent = { kind: 'turn', turn: 'right' };
const TURN_LEFT: CollisionIntent = { kind: 'turn', turn: 'left' };

const SLOOP_RAM = 500000;
const FRIGATE_RAM = 3000000;
const LONGSHIP_RAM = 500000;
const WAR_BRIG_RAM = 2000000;
const SLOOP_ROCK = 500000;
const SLOOP_RAMMED_BY_FRIGATE = 6000000;
const FRIGATE_RAMMED_BY_SLOOP = 1000000;

const WHIRL_ID = 1;
const WHIRL_CORNERS: BoardPosition[] = [
  { x: 5, y: 7 },
  { x: 6, y: 7 },
  { x: 5, y: 8 },
  { x: 6, y: 8 },
];

function shipOf(
  shipId: EntityId,
  shipClass: ShipClassId,
  position: BoardPosition,
  facing: Facing,
  intent: CollisionIntent,
): CollisionShip {
  return { shipId, shipClass, position, facing, intent };
}

function outcomesOf(board: BattleBoard, ships: CollisionShip[]): Map<EntityId, CollisionOutcome> {
  return new Map(resolveMovement(board, ships).map((outcome) => [outcome.shipId, outcome]));
}

function outcome(
  shipId: EntityId,
  position: BoardPosition,
  facing: Facing,
  collided: boolean,
  damageTakenSmallMicro: number,
  struckObstacle = false,
): CollisionOutcome {
  return { shipId, position, facing, collided, struckObstacle, damageTakenSmallMicro };
}

function rockBoardAt(position: BoardPosition): BattleBoard {
  const board = createBattleBoard();
  setTile(board, position.x, position.y, { kind: 'rock-small' });
  return board;
}

function whirlpoolBoard(): BattleBoard {
  const board = createBattleBoard();
  for (const corner of WHIRL_CORNERS) {
    setTile(board, corner.x, corner.y, { kind: 'whirlpool', id: WHIRL_ID });
  }
  return board;
}

function whirlIntentOf(board: BattleBoard, position: BoardPosition, facing: Facing): CollisionIntent {
  const pose = whirlEffect(board, WHIRL_ID, { position, facing });
  return { kind: 'whirl', destination: pose.position, facing: pose.facing };
}

test('case 1a: the square directly ahead is empty and unclaimed, so the ship moves in', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD)]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 6, y: 5 }, 'east', false, 0));
});

test('case 1b: the square ahead contains a stationary ship, so the move becomes a bump', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'sloop', { x: 6, y: 5 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(byId.get(B), outcome(B, { x: 7, y: 5 }, 'north', true, SLOOP_RAM));
});

test('case 1c: two ships each claiming the other square stop entirely', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'sloop', { x: 6, y: 5 }, 'west', FORWARD),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(byId.get(B), outcome(B, { x: 6, y: 5 }, 'west', true, SLOOP_RAM));
});

test('case 1d: an empty square claimed by a same or larger class stops the ship entirely', () => {
  const board = createBattleBoard();
  const sameClass = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'sloop', { x: 6, y: 4 }, 'south', FORWARD),
  ]);
  assert.deepEqual(sameClass.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(sameClass.get(B), outcome(B, { x: 6, y: 4 }, 'south', true, SLOOP_RAM));

  const largerRival = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'war-frigate', { x: 6, y: 4 }, 'south', FORWARD),
  ]);
  assert.deepEqual(
    largerRival.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAMMED_BY_FRIGATE),
  );
});

test('case 1e: an empty square claimed only by a smaller class is taken by the larger ship', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'war-frigate', { x: 6, y: 4 }, 'south', FORWARD),
  ]);
  assert.deepEqual(
    byId.get(B),
    outcome(B, { x: 6, y: 5 }, 'south', true, FRIGATE_RAMMED_BY_SLOOP),
  );
});

test('case 2a: a turning ship whose destination is empty and unclaimed moves in diagonally', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', TURN_RIGHT)]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 6, y: 4 }, 'east', false, 0));
});

test('case 2b: a stationary ship or one that moved there in step 1 blocks the turn, class-independently', () => {
  const board = createBattleBoard();
  const movedThere = outcomesOf(board, [
    shipOf(A, 'war-frigate', { x: 5, y: 5 }, 'north', TURN_RIGHT),
    shipOf(B, 'sloop', { x: 6, y: 5 }, 'north', FORWARD),
  ]);
  assert.deepEqual(
    movedThere.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, FRIGATE_RAMMED_BY_SLOOP),
  );
  assert.deepEqual(
    movedThere.get(B),
    outcome(B, { x: 6, y: 4 }, 'north', true, SLOOP_RAMMED_BY_FRIGATE),
  );

  const stationaryThere = outcomesOf(board, [
    shipOf(A, 'war-frigate', { x: 5, y: 5 }, 'north', TURN_RIGHT),
    shipOf(B, 'sloop', { x: 6, y: 4 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(
    stationaryThere.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, FRIGATE_RAMMED_BY_SLOOP),
  );
  assert.deepEqual(
    stationaryThere.get(B),
    outcome(B, { x: 6, y: 4 }, 'north', true, SLOOP_RAMMED_BY_FRIGATE),
  );
});

test('case 2c: turning ships whose destinations are each other post-step-1 square both stop', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', TURN_LEFT),
    shipOf(B, 'sloop', { x: 7, y: 4 }, 'west', TURN_LEFT),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 5, y: 5 }, 'north', true, SLOOP_RAM));
  assert.deepEqual(byId.get(B), outcome(B, { x: 7, y: 4 }, 'south', true, SLOOP_RAM));
});

test('case 2c resolves the same whichever order the ships are supplied in', () => {
  const board = createBattleBoard();
  const first = shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', TURN_LEFT);
  const second = shipOf(B, 'sloop', { x: 7, y: 4 }, 'west', TURN_LEFT);
  const forwards = outcomesOf(board, [first, second]);
  const backwards = outcomesOf(board, [second, first]);
  assert.deepEqual(forwards.get(A), backwards.get(A));
  assert.deepEqual(forwards.get(B), backwards.get(B));
});

test('case 2d: a destination claimed by a same or larger class stops the turn entirely', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', TURN_RIGHT),
    shipOf(B, 'sloop', { x: 7, y: 5 }, 'north', TURN_LEFT),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(byId.get(B), outcome(B, { x: 7, y: 5 }, 'west', true, SLOOP_RAM));
});

test('case 2e: a destination claimed only by a smaller class is taken by the larger ship', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', TURN_RIGHT),
    shipOf(B, 'war-frigate', { x: 7, y: 5 }, 'north', TURN_LEFT),
  ]);
  assert.deepEqual(
    byId.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAMMED_BY_FRIGATE),
  );
  assert.deepEqual(
    byId.get(B),
    outcome(B, { x: 6, y: 4 }, 'west', true, FRIGATE_RAMMED_BY_SLOOP),
  );
});

test('rule 3: orientation changes for a ship that attempted a turn and stopped entirely', () => {
  const board = createBattleBoard();
  const bumped = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', TURN_RIGHT),
    shipOf(B, 'sloop', { x: 5, y: 4 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(bumped.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(bumped.get(B), outcome(B, { x: 5, y: 4 }, 'north', true, SLOOP_RAM));

  const blocked = outcomesOf(rockBoardAt({ x: 6, y: 4 }), [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', TURN_RIGHT),
  ]);
  assert.deepEqual(blocked.get(A), outcome(A, { x: 5, y: 5 }, 'east', false, SLOOP_ROCK, true));
});

test('bump: a turning mover moves nobody and still rotates', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', TURN_RIGHT),
    shipOf(B, 'war-frigate', { x: 5, y: 4 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(
    byId.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAMMED_BY_FRIGATE),
  );
  assert.deepEqual(
    byId.get(B),
    outcome(B, { x: 5, y: 4 }, 'north', true, FRIGATE_RAMMED_BY_SLOOP),
  );
});

test('bump: a strictly smaller mover moves nobody', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'war-frigate', { x: 6, y: 5 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(
    byId.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAMMED_BY_FRIGATE),
  );
  assert.deepEqual(
    byId.get(B),
    outcome(B, { x: 6, y: 5 }, 'north', true, FRIGATE_RAMMED_BY_SLOOP),
  );
});

test('bump: a strictly larger mover takes the tile and pushes the stationary ship forward', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'war-frigate', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'sloop', { x: 6, y: 5 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(
    byId.get(A),
    outcome(A, { x: 6, y: 5 }, 'east', true, FRIGATE_RAMMED_BY_SLOOP),
  );
  assert.deepEqual(
    byId.get(B),
    outcome(B, { x: 7, y: 5 }, 'north', true, SLOOP_RAMMED_BY_FRIGATE),
  );
});

test('bump: a same-class mover pushes the stationary ship back one square and stays put', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'cutter', { x: 6, y: 5 }, 'south', STATIONARY),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(byId.get(B), outcome(B, { x: 7, y: 5 }, 'south', true, SLOOP_RAM));
});

test('a push blocked by a rock, the board edge or another ship moves nobody', () => {
  const intoRock = outcomesOf(rockBoardAt({ x: 7, y: 5 }), [
    shipOf(A, 'war-frigate', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'sloop', { x: 6, y: 5 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(
    intoRock.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, FRIGATE_RAMMED_BY_SLOOP),
  );
  assert.deepEqual(
    intoRock.get(B),
    outcome(B, { x: 6, y: 5 }, 'north', true, SLOOP_RAMMED_BY_FRIGATE),
  );

  const board = createBattleBoard();
  const offBoard = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 22, y: 5 }, 'east', FORWARD),
    shipOf(B, 'sloop', { x: 23, y: 5 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(offBoard.get(A), outcome(A, { x: 22, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(offBoard.get(B), outcome(B, { x: 23, y: 5 }, 'north', true, SLOOP_RAM));

  const intoShip = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'sloop', { x: 6, y: 5 }, 'north', STATIONARY),
    shipOf(C, 'sloop', { x: 7, y: 5 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(intoShip.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAM));
  assert.deepEqual(intoShip.get(B), outcome(B, { x: 6, y: 5 }, 'north', true, SLOOP_RAM));
  assert.deepEqual(intoShip.get(C), outcome(C, { x: 7, y: 5 }, 'north', false, 0));
});

test('ram damage, same size class: one collision each, sized by the other ship class', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'longship', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'war-brig', { x: 6, y: 5 }, 'west', FORWARD),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 5, y: 5 }, 'east', true, WAR_BRIG_RAM));
  assert.deepEqual(byId.get(B), outcome(B, { x: 6, y: 5 }, 'west', true, LONGSHIP_RAM));
});

test('ram damage, different size classes: two collisions worth each', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
    shipOf(B, 'war-frigate', { x: 6, y: 5 }, 'west', FORWARD),
  ]);
  assert.deepEqual(
    byId.get(A),
    outcome(A, { x: 5, y: 5 }, 'east', true, SLOOP_RAMMED_BY_FRIGATE),
  );
  assert.deepEqual(byId.get(B), outcome(B, { x: 6, y: 5 }, 'west', true, FRIGATE_RAMMED_BY_SLOOP));
  assert.equal(SLOOP_RAMMED_BY_FRIGATE, FRIGATE_RAM * 2);
  assert.equal(FRIGATE_RAMMED_BY_SLOOP, SLOOP_RAM * 2);
});

test('a rock stops the ship where it stands and costs one twelfth of its full SF damage', () => {
  const byId = outcomesOf(rockBoardAt({ x: 6, y: 5 }), [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'east', FORWARD),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 5, y: 5 }, 'east', false, SLOOP_ROCK, true));
  const sloop = shipClassOf('sloop');
  assert.equal(sloop.rockDamageSmallMicro * 12, sloop.maxSfDamageSmallMicro);
});

test('the board edge acts as a rock', () => {
  const board = createBattleBoard();
  const byId = outcomesOf(board, [shipOf(A, 'sloop', { x: 0, y: 5 }, 'west', FORWARD)]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 0, y: 5 }, 'west', false, SLOOP_ROCK, true));
});

test('wind behaves exactly like forward, along the wind direction and not the ship facing', () => {
  const board = createBattleBoard();
  const alone = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', { kind: 'wind', facing: 'east' }),
  ]);
  assert.deepEqual(alone.get(A), outcome(A, { x: 6, y: 5 }, 'north', false, 0));

  const bumping = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 5 }, 'north', { kind: 'wind', facing: 'east' }),
    shipOf(B, 'sloop', { x: 6, y: 5 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(bumping.get(A), outcome(A, { x: 5, y: 5 }, 'north', true, SLOOP_RAM));
  assert.deepEqual(bumping.get(B), outcome(B, { x: 7, y: 5 }, 'north', true, SLOOP_RAM));
});

test('whirl behaves like a turn but claims no square directly ahead', () => {
  const board = whirlpoolBoard();
  const intent = whirlIntentOf(board, { x: 5, y: 7 }, 'north');
  const byId = outcomesOf(board, [
    shipOf(A, 'sloop', { x: 5, y: 7 }, 'north', intent),
    shipOf(B, 'sloop', { x: 5, y: 6 }, 'north', STATIONARY),
  ]);
  assert.deepEqual(byId.get(A), outcome(A, { x: 6, y: 8 }, 'east', false, 0));
  assert.deepEqual(byId.get(B), outcome(B, { x: 5, y: 6 }, 'north', false, 0));
});

test('the wiki example: a wind-pushed small ship blocks a large ship whirl', () => {
  const board = whirlpoolBoard();
  setTile(board, 7, 8, { kind: 'wind', facing: 'west' });
  const whirl = whirlIntentOf(board, { x: 5, y: 7 }, 'north');
  const windPose = windEffect({ kind: 'wind', facing: 'west' }, {
    position: { x: 7, y: 8 },
    facing: 'north',
  });
  assert.deepEqual(whirl, { kind: 'whirl', destination: { x: 6, y: 8 }, facing: 'east' });
  assert.deepEqual(windPose.position, { x: 6, y: 8 });

  const byId = outcomesOf(board, [
    shipOf(A, 'war-frigate', { x: 5, y: 7 }, 'north', whirl),
    shipOf(B, 'sloop', { x: 7, y: 8 }, 'north', { kind: 'wind', facing: 'west' }),
  ]);
  assert.deepEqual(
    byId.get(A),
    outcome(A, { x: 5, y: 7 }, 'east', true, FRIGATE_RAMMED_BY_SLOOP),
  );
  assert.deepEqual(
    byId.get(B),
    outcome(B, { x: 6, y: 8 }, 'north', true, SLOOP_RAMMED_BY_FRIGATE),
  );
});
