import type { EntityId } from '../ids.ts';
import { createBattleBoard, type BattleBoard } from './board.ts';
import type { Facing } from './geometry.ts';
import { idlePlan, type BattlePhasePlan } from './plan.ts';
import { createTokenPool, type TokenPool } from './tokens.ts';

export const DISENGAGE_COUNTER_START_TURNS = 10;
export const DISENGAGE_TURNS_PER_HIT = 2;

export type BattleOutcome = 'running' | 'player-won' | 'player-lost' | 'disengaged';

export interface BattleShip {
  shipId: EntityId;
  x: number;
  y: number;
  facing: Facing;
  tokens: TokenPool;
  disengageCounter: number;
  plan: BattlePhasePlan[];
}

export interface BattleState {
  board: BattleBoard;
  ships: BattleShip[];
  turnIndex: number;
  turnTick: number;
  sinkingContext: number;
  grappled: number;
  outcome: BattleOutcome;
}

export interface BattleShipPlacement {
  shipId: EntityId;
  x: number;
  y: number;
  facing: Facing;
}

export function createBattleShip(placement: BattleShipPlacement): BattleShip {
  return {
    shipId: placement.shipId,
    x: placement.x,
    y: placement.y,
    facing: placement.facing,
    tokens: createTokenPool(),
    disengageCounter: DISENGAGE_COUNTER_START_TURNS,
    plan: idlePlan(),
  };
}

export function createBattle(
  placements: BattleShipPlacement[],
  sinkingContext: boolean,
  board: BattleBoard = createBattleBoard(),
): BattleState {
  return {
    board,
    ships: placements.map(createBattleShip),
    turnIndex: 0,
    turnTick: 0,
    sinkingContext: sinkingContext ? 1 : 0,
    grappled: 0,
    outcome: 'running',
  };
}

export function battleShipOf(battle: BattleState, shipId: EntityId): BattleShip | undefined {
  return battle.ships.find((ship) => ship.shipId === shipId);
}

export function opponentOf(battle: BattleState, shipId: EntityId): BattleShip | undefined {
  return battle.ships.find((ship) => ship.shipId !== shipId);
}
