import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BrigandBalance } from '../../packages/sim/src/balance.ts';
import {
  createBattleBoard,
  isImpassable,
  setTile,
  type BattleBoard,
  type BattleTile,
} from '../../packages/sim/src/battle/board.ts';
import {
  BRIGAND_PLAN_STREAM,
  planBrigandTurn,
  type BrigandEnemy,
  type BrigandSelf,
} from '../../packages/sim/src/battle/brigand.ts';
import {
  aheadOf,
  turnedFacing,
  FACINGS,
  type BoardPosition,
  type Facing,
} from '../../packages/sim/src/battle/geometry.ts';
import {
  planRejectionOf,
  PHASES_PER_TURN,
  type BattlePhasePlan,
  type PhaseMove,
} from '../../packages/sim/src/battle/plan.ts';
import {
  createTokenPool,
  type MoveToken,
  type TokenPool,
} from '../../packages/sim/src/battle/tokens.ts';
import { createRngStreams, rngStream, type RngStream } from '../../packages/sim/src/rng.ts';
import {
  SHIP_CLASS_IDS,
  shipClassOf,
  type ShipClassId,
} from '../../packages/sim/src/ship/classes.ts';

const BRIGAND = 1;
const PLAYER = 2;

const BALANCE: BrigandBalance = {
  planLookaheadPhases: 4,
  weightCloseDistance: 10,
  weightBroadsideExposure: 30,
  weightIncomingBroadside: 25,
  weightRockCollision: 200,
  geniusChancePerMille: 100,
  blunderNoisePerMille: 30,
  disengageAtDamagePerMille: 700,
};

const ALWAYS_GENIUS: BrigandBalance = { ...BALANCE, geniusChancePerMille: 1000 };

const SEED = 20260902;
const SAMPLE_SEEDS = 400;
const SETUP_SEEDS = 500;
const DETERMINISM_SEEDS = 32;
const MAJORITY_RATE = 0.6;
const ROCK_ESCAPE_RATE = 0.8;

const CHASE_START: BoardPosition = { x: 12, y: 20 };
const CHASE_ENEMY: BrigandEnemy = { shipId: PLAYER, x: 4, y: 4, facing: 'south' };

const ROCK: BoardPosition = { x: 10, y: 9 };
const ROCK_START: BoardPosition = { x: 10, y: 10 };
const ROCK_ENEMY: BrigandEnemy = { shipId: PLAYER, x: 10, y: 2, facing: 'south' };

function poolOf(counts: Partial<Record<MoveToken, number>>): TokenPool {
  const pool = createTokenPool();
  pool.left[0] = counts.left ?? 0;
  pool.forward[0] = counts.forward ?? 0;
  pool.right[0] = counts.right ?? 0;
  return pool;
}

function brigandAt(
  position: BoardPosition,
  facing: Facing,
  tokens: TokenPool,
  overrides: Partial<BrigandSelf> = {},
): BrigandSelf {
  return {
    shipId: BRIGAND,
    shipClass: 'sloop',
    x: position.x,
    y: position.y,
    facing,
    tokens,
    cannonsLoaded: 4,
    damagePerMille: 0,
    ...overrides,
  };
}

function streamFor(seed: number): RngStream {
  return rngStream(seed, createRngStreams(), BRIGAND_PLAN_STREAM);
}

function movesOf(plan: BattlePhasePlan[]): MoveToken[] {
  return plan.flatMap((phase) => (phase.move.kind === 'move' ? [phase.move.token] : []));
}

function shotsOf(plan: BattlePhasePlan[]): number {
  return plan.reduce(
    (total, phase) => total + (phase.fire.kind === 'guns' ? phase.fire.count : 0),
    0,
  );
}

function movesWithKind(plan: BattlePhasePlan[], kind: PhaseMove['kind']): number {
  return plan.filter((phase) => phase.move.kind === kind).length;
}

interface Walk {
  position: BoardPosition;
  walked: BoardPosition[];
}

function routeTilesOf(from: BoardPosition, facing: Facing, token: MoveToken): BoardPosition[] {
  const ahead = aheadOf(from, facing);
  if (token === 'forward') return [ahead];
  return [ahead, aheadOf(ahead, turnedFacing(facing, token))];
}

function walkOf(board: BattleBoard, self: BrigandSelf, plan: BattlePhasePlan[]): Walk {
  const walked: BoardPosition[] = [];
  let position: BoardPosition = { x: self.x, y: self.y };
  let facing = self.facing;
  for (const phase of plan) {
    if (phase.move.kind !== 'move') continue;
    const token = phase.move.token;
    const tiles = routeTilesOf(position, facing, token);
    walked.push(...tiles);
    facing = token === 'forward' ? facing : turnedFacing(facing, token);
    const destination = tiles[tiles.length - 1];
    if (destination !== undefined && !tiles.some((tile) => isImpassable(board, tile))) {
      position = destination;
    }
  }
  return { position, walked };
}

function forwardsInto(board: BattleBoard, self: BrigandSelf, plan: BattlePhasePlan[]): number {
  let position: BoardPosition = { x: self.x, y: self.y };
  let facing = self.facing;
  let charges = 0;
  for (const phase of plan) {
    if (phase.move.kind !== 'move') continue;
    const token = phase.move.token;
    const tiles = routeTilesOf(position, facing, token);
    const blocked = tiles.some((tile) => isImpassable(board, tile));
    if (token === 'forward' && blocked) charges += 1;
    facing = token === 'forward' ? facing : turnedFacing(facing, token);
    const destination = tiles[tiles.length - 1];
    if (destination !== undefined && !blocked) position = destination;
  }
  return charges;
}

function manhattan(from: BoardPosition, to: BoardPosition): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

function drawnFacing(stream: RngStream): Facing {
  return FACINGS[stream.nextIntInRange(0, FACINGS.length)] ?? 'north';
}

function drawnShipClass(stream: RngStream): ShipClassId {
  return SHIP_CLASS_IDS[stream.nextIntInRange(0, SHIP_CLASS_IDS.length)] ?? 'sloop';
}

function scatteredBoard(stream: RngStream): BattleBoard {
  const board = createBattleBoard();
  for (let placed = 0; placed < 12; placed += 1) {
    const x = stream.nextIntInRange(0, board.width);
    const y = stream.nextIntInRange(0, board.height);
    const rock: BattleTile =
      stream.nextIntInRange(0, 2) === 0 ? { kind: 'rock-tall' } : { kind: 'rock-small' };
    setTile(board, x, y, rock);
  }
  return board;
}

function drawnSetup(stream: RngStream): {
  board: BattleBoard;
  self: BrigandSelf;
  enemy: BrigandEnemy;
} {
  const board = scatteredBoard(stream);
  const self: BrigandSelf = {
    shipId: BRIGAND,
    shipClass: drawnShipClass(stream),
    x: stream.nextIntInRange(0, board.width),
    y: stream.nextIntInRange(0, board.height),
    facing: drawnFacing(stream),
    tokens: poolOf({
      left: stream.nextIntInRange(0, 4),
      forward: stream.nextIntInRange(0, 4),
      right: stream.nextIntInRange(0, 4),
    }),
    cannonsLoaded: stream.nextIntInRange(0, 9),
    damagePerMille: stream.nextIntInRange(0, 1001),
  };
  const enemy: BrigandEnemy = {
    shipId: PLAYER,
    x: (self.x + 1 + stream.nextIntInRange(0, board.width - 1)) % board.width,
    y: stream.nextIntInRange(0, board.height),
    facing: drawnFacing(stream),
  };
  return { board, self, enemy };
}

test('every planned turn survives the plan validator, over many seeds and poses', () => {
  const setups = rngStream(SEED, createRngStreams(), 'test.brigandSetup');
  for (let seed = 1; seed <= SETUP_SEEDS; seed += 1) {
    const { board, self, enemy } = drawnSetup(setups);
    const plan = planBrigandTurn(board, self, enemy, BALANCE, streamFor(seed));
    assert.equal(plan.length, PHASES_PER_TURN);
    const rejection = planRejectionOf(self.shipClass, plan);
    assert.equal(rejection, null, `seed ${seed} class ${self.shipClass}`);
  }
});

test('a pool holding one forward token yields at most that one move', () => {
  const board = createBattleBoard();
  for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
    const self = brigandAt(CHASE_START, 'north', poolOf({ forward: 1 }));
    const plan = planBrigandTurn(board, self, CHASE_ENEMY, BALANCE, streamFor(seed));
    const moves = movesOf(plan);
    assert.ok(moves.length <= 1, `seed ${seed} planned ${moves.length} moves`);
    assert.deepEqual(
      moves.filter((token) => token !== 'forward'),
      [],
    );
  }
});

test('the planned shots never outrun the loaded cannons', () => {
  const board = createBattleBoard();
  const abeam: BrigandEnemy = { shipId: PLAYER, x: 12, y: 10, facing: 'north' };
  const parked = brigandAt({ x: 10, y: 10 }, 'north', poolOf({}), { cannonsLoaded: 2 });
  const parkedPlan = planBrigandTurn(board, parked, abeam, BALANCE, streamFor(SEED));
  assert.equal(shotsOf(parkedPlan), 2);

  const setups = rngStream(SEED, createRngStreams(), 'test.brigandGunnery');
  for (let seed = 1; seed <= SETUP_SEEDS; seed += 1) {
    const { board: drawn, self, enemy } = drawnSetup(setups);
    const plan = planBrigandTurn(drawn, self, enemy, BALANCE, streamFor(seed));
    assert.ok(shotsOf(plan) <= self.cannonsLoaded, `seed ${seed} overspent its cannons`);
  }
});

test('an enemy off the beam at the start of the turn is grappled in phase zero', () => {
  const board = createBattleBoard();
  const alongside: BrigandEnemy = { shipId: PLAYER, x: 11, y: 10, facing: 'north' };
  for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
    const self = brigandAt({ x: 10, y: 10 }, 'north', poolOf({ left: 2, forward: 2, right: 2 }));
    const plan = planBrigandTurn(board, self, alongside, BALANCE, streamFor(seed));
    const opening = plan[0];
    assert.ok(opening !== undefined);
    assert.deepEqual(opening.fire, { kind: 'grapple', side: 'starboard' });
  }
});

test('an undamaged brigand closes the range on a good majority of seeds', () => {
  const board = createBattleBoard();
  let closed = 0;
  for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
    const self = brigandAt(CHASE_START, 'north', poolOf({ left: 4, forward: 4, right: 4 }));
    const plan = planBrigandTurn(board, self, CHASE_ENEMY, BALANCE, streamFor(seed));
    const opened = manhattan(walkOf(board, self, plan).position, CHASE_ENEMY);
    if (opened < manhattan(CHASE_START, CHASE_ENEMY)) closed += 1;
  }
  assert.ok(
    closed > SAMPLE_SEEDS * MAJORITY_RATE,
    `only closed on ${closed}/${SAMPLE_SEEDS} seeds`,
  );
});

test('a brigand past the disengage threshold opens the range instead', () => {
  const board = createBattleBoard();
  let opened = 0;
  for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
    const self = brigandAt(CHASE_START, 'south', poolOf({ left: 4, forward: 4, right: 4 }), {
      damagePerMille: BALANCE.disengageAtDamagePerMille + 100,
    });
    const plan = planBrigandTurn(board, self, CHASE_ENEMY, BALANCE, streamFor(seed));
    const range = manhattan(walkOf(board, self, plan).position, CHASE_ENEMY);
    if (range > manhattan(CHASE_START, CHASE_ENEMY)) opened += 1;
  }
  assert.ok(
    opened > SAMPLE_SEEDS * MAJORITY_RATE,
    `only opened on ${opened}/${SAMPLE_SEEDS} seeds`,
  );
});

test('the same seed and inputs replay the identical plan, and other seeds mostly differ', () => {
  const board = createBattleBoard();
  const planFor = (seed: number): BattlePhasePlan[] =>
    planBrigandTurn(
      board,
      brigandAt(CHASE_START, 'north', poolOf({ left: 4, forward: 4, right: 4 })),
      CHASE_ENEMY,
      BALANCE,
      streamFor(seed),
    );
  assert.deepEqual(planFor(SEED), planFor(SEED));

  const distinct = new Set<string>();
  for (let seed = 1; seed <= DETERMINISM_SEEDS; seed += 1) {
    distinct.add(JSON.stringify(planFor(seed)));
  }
  assert.ok(distinct.size > DETERMINISM_SEEDS / 2, `only ${distinct.size} distinct plans`);
});

test('a rock dead ahead is never charged head on, and never ends the ship on it', () => {
  const board = createBattleBoard();
  setTile(board, ROCK.x, ROCK.y, { kind: 'rock-small' });
  for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
    const self = brigandAt(ROCK_START, 'north', poolOf({ left: 4, forward: 4, right: 4 }));
    const plan = planBrigandTurn(board, self, ROCK_ENEMY, ALWAYS_GENIUS, streamFor(seed));
    const { position } = walkOf(board, self, plan);
    assert.equal(forwardsInto(board, self, plan), 0, `seed ${seed} charged the rock head on`);
    assert.ok(position.x !== ROCK.x || position.y !== ROCK.y, `seed ${seed} ended on the rock`);
  }
});

test('a ship boxed in by a rock turns away rather than sitting still forever', () => {
  const board = createBattleBoard();
  setTile(board, ROCK.x, ROCK.y, { kind: 'rock-small' });
  let turned = 0;
  for (let seed = 1; seed <= SAMPLE_SEEDS; seed += 1) {
    const self = brigandAt(ROCK_START, 'north', poolOf({ left: 4, forward: 4, right: 4 }));
    const plan = planBrigandTurn(board, self, ROCK_ENEMY, BALANCE, streamFor(seed));
    if (movesOf(plan).some((token) => token !== 'forward')) turned += 1;
  }
  assert.ok(turned > SAMPLE_SEEDS * ROCK_ESCAPE_RATE, `only turned away on ${turned} seeds`);
});

test('an empty token pool still produces a legal, motionless plan', () => {
  const board = createBattleBoard();
  for (const shipClass of ['sloop', 'war-brig'] as ShipClassId[]) {
    const self = brigandAt(CHASE_START, 'north', createTokenPool(), { shipClass });
    const plan = planBrigandTurn(board, self, CHASE_ENEMY, BALANCE, streamFor(SEED));
    const rests = PHASES_PER_TURN - shipClassOf(shipClass).movesPerTurn;
    assert.equal(planRejectionOf(shipClass, plan), null);
    assert.equal(movesWithKind(plan, 'rest'), rests);
    assert.equal(movesWithKind(plan, 'none'), PHASES_PER_TURN - rests);
    assert.deepEqual(movesOf(plan), []);
  }
});
