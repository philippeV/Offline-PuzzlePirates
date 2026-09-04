import assert from 'node:assert/strict';
import { test } from 'node:test';

import { affordable } from '../../packages/sim/src/battle/dispatch.ts';
import {
  PHASES_PER_TURN,
  planRejectionOf,
  restsRequiredBy,
  type BattlePhasePlan,
  type PhaseFire,
  type PhaseMove,
} from '../../packages/sim/src/battle/plan.ts';
import {
  MOVE_TOKENS,
  createTokenPool,
  mintMovementTokens,
  type MoveToken,
  type TokenPool,
} from '../../packages/sim/src/battle/tokens.ts';
import { FIRST_ENTITY_ID } from '../../packages/sim/src/ids.ts';
import { shipClassOf, type ShipClassId } from '../../packages/sim/src/ship/classes.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';

const FOUR_MOVER: ShipClassId = 'sloop';
const THREE_MOVER: ShipClassId = 'war-brig';

const MILLI_PER_TOKEN = 1000;
const LOADED_CANNONS = 2;

function poolHoldingOneOfEachToken(): TokenPool {
  const pool = createTokenPool();
  mintMovementTokens(pool, MOVE_TOKENS.length * MILLI_PER_TOKEN);
  return pool;
}

function hullOf(shipClass: ShipClassId, cannonsLoaded: number): ShipState {
  const hull = createShip({ nextEntityId: FIRST_ENTITY_ID }, { shipClass, allegiance: 'player' });
  hull.cannonsLoaded = cannonsLoaded;
  return hull;
}

function moveOf(token: MoveToken | undefined): PhaseMove {
  return token === undefined ? { kind: 'none' } : { kind: 'move', token };
}

function fireOf(count: number | undefined): PhaseFire {
  return count === undefined ? { kind: 'none' } : { kind: 'guns', side: 'port', count };
}

function planOf(moves: MoveToken[], shots: number[]): BattlePhasePlan[] {
  return Array.from(
    { length: PHASES_PER_TURN },
    (_, phase): BattlePhasePlan => ({ move: moveOf(moves[phase]), fire: fireOf(shots[phase]) }),
  );
}

function restingPlan(rests: number): BattlePhasePlan[] {
  return Array.from(
    { length: PHASES_PER_TURN },
    (_, phase): BattlePhasePlan => ({
      move: phase < rests ? { kind: 'rest' } : { kind: 'none' },
      fire: { kind: 'none' },
    }),
  );
}

test('a four-mover owes no rest in a turn, and a three-mover owes exactly one', () => {
  assert.equal(restsRequiredBy(shipClassOf(FOUR_MOVER).movesPerTurn), 0);
  assert.equal(restsRequiredBy(shipClassOf(THREE_MOVER).movesPerTurn), 1);
});

test('a four-mover that rests at all is refused for its move budget', () => {
  assert.equal(planRejectionOf(FOUR_MOVER, restingPlan(0)), null);
  assert.equal(planRejectionOf(FOUR_MOVER, restingPlan(1)), 'plan-move-budget');
  assert.equal(planRejectionOf(FOUR_MOVER, restingPlan(2)), 'plan-move-budget');
});

test('a three-mover that never rests is refused for the same move budget', () => {
  assert.equal(planRejectionOf(THREE_MOVER, restingPlan(1)), null);
  assert.equal(planRejectionOf(THREE_MOVER, restingPlan(0)), 'plan-move-budget');
  assert.equal(planRejectionOf(THREE_MOVER, restingPlan(2)), 'plan-move-budget');
});

test('a plan spending a movement token the pool does not hold is unaffordable', () => {
  const pool = poolHoldingOneOfEachToken();
  const hull = hullOf(FOUR_MOVER, LOADED_CANNONS);
  assert.equal(affordable(pool, hull, planOf(['forward', 'forward'], [])), 'no-movement-token');
  assert.equal(affordable(pool, hull, planOf(['left', 'left'], [])), 'no-movement-token');
  assert.equal(affordable(pool, hull, planOf(['right', 'right'], [])), 'no-movement-token');
});

test('a plan firing more shots than the hull has loaded is unaffordable', () => {
  const pool = poolHoldingOneOfEachToken();
  assert.equal(
    affordable(pool, hullOf(FOUR_MOVER, LOADED_CANNONS), planOf([], [1, 1, 1])),
    'no-gun-token',
  );
  assert.equal(affordable(pool, hullOf(FOUR_MOVER, 0), planOf([], [1])), 'no-gun-token');
});

test('a plan inside both the token pool and the loaded cannons is affordable', () => {
  const pool = poolHoldingOneOfEachToken();
  const hull = hullOf(FOUR_MOVER, LOADED_CANNONS);
  assert.equal(affordable(pool, hull, planOf(['left', 'forward', 'right'], [1, 1])), null);
});
