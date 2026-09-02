import type { EntityId } from '../ids.ts';
import { ramSizeRankOf, shipClassOf, type ShipClassId } from '../ship/classes.ts';
import { isImpassable, type BattleBoard } from './board.ts';
import { aheadOf, turnedFacing, type BoardPosition, type Facing, type Turn } from './geometry.ts';

export type CollisionIntent =
  | { kind: 'stationary' }
  | { kind: 'forward' }
  | { kind: 'turn'; turn: Turn }
  | { kind: 'wind'; facing: Facing }
  | { kind: 'whirl'; destination: BoardPosition; facing: Facing };

export interface CollisionShip {
  shipId: EntityId;
  shipClass: ShipClassId;
  position: BoardPosition;
  facing: Facing;
  intent: CollisionIntent;
}

export interface MovementPlan {
  ship: CollisionShip;
  aheadClaim: BoardPosition | null;
  destination: BoardPosition | null;
  facing: Facing;
  blockedByObstacle: boolean;
}

interface Route {
  aheadClaim: BoardPosition | null;
  destination: BoardPosition | null;
  facing: Facing;
}

export function planOf(board: BattleBoard, ship: CollisionShip): MovementPlan {
  const route = routeOf(ship);
  const blockedByObstacle = tilesOf(route).some((tile) => isImpassable(board, tile));
  if (blockedByObstacle) {
    return { ship, aheadClaim: null, destination: null, facing: route.facing, blockedByObstacle };
  }
  return { ship, ...route, blockedByObstacle };
}

export function isStationaryPlan(plan: MovementPlan): boolean {
  return plan.aheadClaim === null && plan.destination === null;
}

export function isTurningPlan(plan: MovementPlan): boolean {
  return plan.ship.intent.kind === 'turn';
}

export function isWhirlingPlan(plan: MovementPlan): boolean {
  return plan.ship.intent.kind === 'whirl';
}

export function ramRankOf(plan: MovementPlan): number {
  return ramSizeRankOf(shipClassOf(plan.ship.shipClass).ramSizeClass);
}

export function tileKeyOf(position: BoardPosition): string {
  return `${position.x},${position.y}`;
}

export function pushedTo(from: BoardPosition, over: BoardPosition): BoardPosition {
  return { x: over.x + (over.x - from.x), y: over.y + (over.y - from.y) };
}

function routeOf(ship: CollisionShip): Route {
  const intent = ship.intent;
  switch (intent.kind) {
    case 'stationary':
      return { aheadClaim: null, destination: null, facing: ship.facing };
    case 'forward':
      return { aheadClaim: aheadOf(ship.position, ship.facing), destination: null, facing: ship.facing };
    case 'wind':
      return { aheadClaim: aheadOf(ship.position, intent.facing), destination: null, facing: ship.facing };
    case 'turn':
      return turningRouteOf(ship, intent.turn);
    case 'whirl':
      return { aheadClaim: null, destination: intent.destination, facing: intent.facing };
  }
}

function turningRouteOf(ship: CollisionShip, turn: Turn): Route {
  const facing = turnedFacing(ship.facing, turn);
  const aheadClaim = aheadOf(ship.position, ship.facing);
  return { aheadClaim, destination: aheadOf(aheadClaim, facing), facing };
}

function tilesOf(route: Route): BoardPosition[] {
  const tiles: BoardPosition[] = [];
  if (route.aheadClaim !== null) tiles.push(route.aheadClaim);
  if (route.destination !== null) tiles.push(route.destination);
  return tiles;
}
