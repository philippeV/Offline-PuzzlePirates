import { shipClassOf } from '../ship/classes.ts';
import { tileKeyOf, type MovementPlan } from './claims.ts';
import type { BoardPosition } from './geometry.ts';

export interface Movement {
  plan: MovementPlan;
  position: BoardPosition;
  moved: boolean;
  collided: boolean;
  damageTakenSmallMicro: number;
}

type TileOf = (movement: Movement) => BoardPosition | null;

export function startMovement(plan: MovementPlan): Movement {
  return {
    plan,
    position: { ...plan.ship.position },
    moved: false,
    collided: false,
    damageTakenSmallMicro: plan.blockedByObstacle
      ? shipClassOf(plan.ship.shipClass).rockDamageSmallMicro
      : 0,
  };
}

export function moveTo(movement: Movement, position: BoardPosition): void {
  movement.position = { x: position.x, y: position.y };
  movement.moved = true;
}

export function stopEntirely(movement: Movement): void {
  movement.position = { ...movement.plan.ship.position };
  movement.moved = false;
}

export function indexByTile(movements: Movement[], tileOf: TileOf): Map<string, Movement> {
  const index = new Map<string, Movement>();
  for (const movement of movements) {
    const tile = tileOf(movement);
    if (tile !== null) index.set(tileKeyOf(tile), movement);
  }
  return index;
}

export function groupByTile(movements: Movement[], tileOf: TileOf): Map<string, Movement[]> {
  const groups = new Map<string, Movement[]>();
  for (const movement of movements) {
    const tile = tileOf(movement);
    if (tile === null) continue;
    const key = tileKeyOf(tile);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [movement]);
    else group.push(movement);
  }
  return groups;
}
