import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createBattleBoard,
  setTile,
  type BattleBoard,
  type BattleTile,
} from '../../packages/sim/src/battle/board.ts';
import {
  FIRE_RANGE,
  GRAPPLE_RANGE,
  grappleReaches,
  lineOfFire,
  resolveFire,
  type FireHit,
  type FireShooter,
  type FireTarget,
} from '../../packages/sim/src/battle/fire.ts';
import {
  beamOf,
  FACINGS,
  type BoardPosition,
  type Facing,
} from '../../packages/sim/src/battle/geometry.ts';
import type { ShipClassId } from '../../packages/sim/src/ship/classes.ts';

const SHOOTER = 1;
const TARGET = 2;

const ONE_SHOT = 1;
const TWO_SHOTS = 2;

const SMALL_BALL = 1000000;
const MEDIUM_BALL = 1500000;
const LARGE_BALL = 2000000;

const OUT_OF_RANGE = FIRE_RANGE + 1;
const WEST_EDGE_X = 0;

const ORIGIN: BoardPosition = { x: 10, y: 10 };

function shooterOf(shipClass: ShipClassId, position: BoardPosition, facing: Facing): FireShooter {
  return { shipId: SHOOTER, shipClass, position, facing };
}

function targetsAt(position: BoardPosition): FireTarget[] {
  return [{ shipId: TARGET, position }];
}

function hitOf(shots: number, damageSmallMicro: number): FireHit {
  return { targetId: TARGET, shots, damageSmallMicro };
}

function boardWith(position: BoardPosition, tile: BattleTile): BattleBoard {
  const board = createBattleBoard();
  setTile(board, position.x, position.y, tile);
  return board;
}

function starboardOf(position: BoardPosition, facing: Facing, distance: number): BoardPosition {
  return beamOf(position, facing, 'starboard', distance);
}

test('a target at the far end of the range is hit and one square further is not', () => {
  const board = createBattleBoard();
  const shooter = shooterOf('sloop', ORIGIN, 'north');
  const inRange = starboardOf(ORIGIN, 'north', FIRE_RANGE);
  const beyond = starboardOf(ORIGIN, 'north', OUT_OF_RANGE);

  assert.deepEqual(
    resolveFire(board, shooter, targetsAt(inRange), 'starboard', ONE_SHOT),
    hitOf(ONE_SHOT, SMALL_BALL),
  );
  assert.equal(resolveFire(board, shooter, targetsAt(beyond), 'starboard', ONE_SHOT), null);
});

test('port and starboard fire out of opposite sides for every facing', () => {
  const board = createBattleBoard();
  for (const facing of FACINGS) {
    const starboardTile = starboardOf(ORIGIN, facing, FIRE_RANGE);
    const portTile = beamOf(ORIGIN, facing, 'port', FIRE_RANGE);
    assert.deepEqual(portTile, {
      x: ORIGIN.x - (starboardTile.x - ORIGIN.x),
      y: ORIGIN.y - (starboardTile.y - ORIGIN.y),
    });

    const shooter = shooterOf('sloop', ORIGIN, facing);
    assert.deepEqual(
      resolveFire(board, shooter, targetsAt(starboardTile), 'starboard', ONE_SHOT),
      hitOf(ONE_SHOT, SMALL_BALL),
    );
    assert.equal(resolveFire(board, shooter, targetsAt(starboardTile), 'port', ONE_SHOT), null);
    assert.deepEqual(
      resolveFire(board, shooter, targetsAt(portTile), 'port', ONE_SHOT),
      hitOf(ONE_SHOT, SMALL_BALL),
    );
  }
});

test('a tall rock in the way blocks the shot where a small rock does not', () => {
  const shooter = shooterOf('sloop', ORIGIN, 'north');
  const between = starboardOf(ORIGIN, 'north', GRAPPLE_RANGE);
  const targets = targetsAt(starboardOf(ORIGIN, 'north', FIRE_RANGE));

  const tallRock = boardWith(between, { kind: 'rock-tall' });
  assert.deepEqual(lineOfFire(tallRock, ORIGIN, 'north', 'starboard'), []);
  assert.equal(resolveFire(tallRock, shooter, targets, 'starboard', ONE_SHOT), null);

  const smallRock = boardWith(between, { kind: 'rock-small' });
  assert.equal(lineOfFire(smallRock, ORIGIN, 'north', 'starboard').length, FIRE_RANGE);
  assert.deepEqual(
    resolveFire(smallRock, shooter, targets, 'starboard', ONE_SHOT),
    hitOf(ONE_SHOT, SMALL_BALL),
  );
});

test('a tall rock on the target square leaves the target unreachable', () => {
  const targetTile = starboardOf(ORIGIN, 'north', FIRE_RANGE);
  const board = boardWith(targetTile, { kind: 'rock-tall' });
  const shooter = shooterOf('sloop', ORIGIN, 'north');

  assert.deepEqual(lineOfFire(board, ORIGIN, 'north', 'starboard'), [
    starboardOf(ORIGIN, 'north', 1),
    starboardOf(ORIGIN, 'north', 2),
  ]);
  assert.equal(resolveFire(board, shooter, targetsAt(targetTile), 'starboard', ONE_SHOT), null);
});

test('damage per shot is the weight of the ball the shooter class fires', () => {
  const board = createBattleBoard();
  const targets = targetsAt(starboardOf(ORIGIN, 'north', FIRE_RANGE));
  const damageOf = (shipClass: ShipClassId): FireHit | null =>
    resolveFire(board, shooterOf(shipClass, ORIGIN, 'north'), targets, 'starboard', ONE_SHOT);

  assert.deepEqual(damageOf('sloop'), hitOf(ONE_SHOT, SMALL_BALL));
  assert.deepEqual(damageOf('war-brig'), hitOf(ONE_SHOT, MEDIUM_BALL));
  assert.deepEqual(damageOf('war-frigate'), hitOf(ONE_SHOT, LARGE_BALL));
});

test('two shots at the same target deal exactly twice one shot', () => {
  const board = createBattleBoard();
  const shooter = shooterOf('sloop', ORIGIN, 'north');
  const targets = targetsAt(starboardOf(ORIGIN, 'north', FIRE_RANGE));

  const single = resolveFire(board, shooter, targets, 'starboard', ONE_SHOT);
  const double = resolveFire(board, shooter, targets, 'starboard', TWO_SHOTS);
  assert.deepEqual(single, hitOf(ONE_SHOT, SMALL_BALL));
  assert.deepEqual(double, hitOf(TWO_SHOTS, SMALL_BALL * TWO_SHOTS));
});

test('the board edge truncates the line and firing off it hits nothing', () => {
  const board = createBattleBoard();
  const nearEdge: BoardPosition = { x: WEST_EDGE_X + 1, y: ORIGIN.y };
  assert.deepEqual(lineOfFire(board, nearEdge, 'north', 'port'), [{ x: WEST_EDGE_X, y: ORIGIN.y }]);

  const onEdge: BoardPosition = { x: WEST_EDGE_X, y: ORIGIN.y };
  const shooter = shooterOf('sloop', onEdge, 'north');
  assert.deepEqual(lineOfFire(board, onEdge, 'north', 'port'), []);
  assert.equal(
    resolveFire(board, shooter, targetsAt({ x: WEST_EDGE_X + 1, y: ORIGIN.y }), 'port', ONE_SHOT),
    null,
  );
});

test('a grapple reaches the adjacent square only, and nothing off the board', () => {
  const board = createBattleBoard();
  const shooter = shooterOf('sloop', ORIGIN, 'north');
  const adjacent = starboardOf(ORIGIN, 'north', GRAPPLE_RANGE);
  const beyond = starboardOf(ORIGIN, 'north', GRAPPLE_RANGE + 1);

  assert.equal(grappleReaches(board, shooter, targetsAt(adjacent), 'starboard'), TARGET);
  assert.equal(grappleReaches(board, shooter, targetsAt(beyond), 'starboard'), null);

  const edgeShooter = shooterOf('sloop', { x: WEST_EDGE_X, y: ORIGIN.y }, 'north');
  assert.equal(
    grappleReaches(board, edgeShooter, targetsAt({ x: WEST_EDGE_X + 1, y: ORIGIN.y }), 'port'),
    null,
  );
});
