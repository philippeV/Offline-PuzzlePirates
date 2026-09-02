import type { EntityId } from '../ids.ts';
import { isImpassable, type BattleBoard } from './board.ts';
import type { BoardPosition, Facing } from './geometry.ts';
import {
  isStationaryPlan,
  isTurningPlan,
  isWhirlingPlan,
  planOf,
  pushedTo,
  ramRankOf,
  tileKeyOf,
  type CollisionShip,
  type MovementPlan,
} from './claims.ts';
import {
  applyCollisions,
  recordCollision,
  type CollisionLog,
  type RamDamageOverrides,
} from './ram.ts';
import type { Movement } from './movement.ts';
import { groupByTile, indexByTile, moveTo, startMovement, stopEntirely } from './movement.ts';

export type { CollisionIntent, CollisionShip } from './claims.ts';

export interface CollisionOutcome {
  shipId: EntityId;
  position: BoardPosition;
  facing: Facing;
  collided: boolean;
  struckObstacle: boolean;
  damageTakenSmallMicro: number;
}

export function resolveMovement(
  board: BattleBoard,
  ships: CollisionShip[],
  ramDamage: RamDamageOverrides = {},
): CollisionOutcome[] {
  const movements = ships.map((ship) => startMovement(planOf(board, ship)));
  applyFirstClaims(board, movements, ramDamage);
  settleOverlaps(movements, ramDamage);
  applyDestinations(movements, ramDamage);
  settleOverlaps(movements, ramDamage);
  return movements.map(outcomeOf);
}

function applyFirstClaims(
  board: BattleBoard,
  movements: Movement[],
  ramDamage: RamDamageOverrides,
): void {
  const occupied = indexByTile(movements, (movement) => movement.plan.ship.position);
  const claims = groupByTile(movements, (movement) => movement.plan.aheadClaim);
  const log: CollisionLog = new Map();
  for (const movement of movements) {
    const target = movement.plan.aheadClaim;
    if (target === null) continue;
    const occupant = otherAt(occupied, target, movement);
    if (occupant !== undefined && isStationaryPlan(occupant.plan)) {
      bump(board, occupied, log, movement, occupant);
      continue;
    }
    if (occupant !== undefined && claimsSquareOf(occupant, movement)) {
      recordCollision(log, movement, occupant);
      continue;
    }
    const rivals = rivalsAt(claims, target, movement);
    for (const rival of rivals) recordCollision(log, movement, rival);
    if (rivals.some((rival) => ramRankOf(rival.plan) >= ramRankOf(movement.plan))) continue;
    moveTo(movement, target);
  }
  applyCollisions(log, ramDamage);
}

function bump(
  board: BattleBoard,
  occupied: Map<string, Movement>,
  log: CollisionLog,
  mover: Movement,
  stationary: Movement,
): void {
  recordCollision(log, mover, stationary);
  if (isTurningPlan(mover.plan)) return;
  const moverRank = ramRankOf(mover.plan);
  const stationaryRank = ramRankOf(stationary.plan);
  if (moverRank < stationaryRank) return;
  const pushTarget = pushedTo(mover.plan.ship.position, stationary.plan.ship.position);
  if (isImpassable(board, pushTarget)) return;
  if (otherAt(occupied, pushTarget, stationary) !== undefined) return;
  moveTo(stationary, pushTarget);
  if (moverRank > stationaryRank) moveTo(mover, stationary.plan.ship.position);
}

function applyDestinations(movements: Movement[], ramDamage: RamDamageOverrides): void {
  const turners = movements.filter(entersSecondPass);
  const occupied = indexByTile(movements, (movement) => movement.position);
  const claims = groupByTile(turners, (movement) => movement.plan.destination);
  const log: CollisionLog = new Map();
  for (const movement of turners) {
    const destination = movement.plan.destination;
    if (destination === null) continue;
    const blocker = otherAt(occupied, destination, movement);
    if (blocker !== undefined) {
      recordCollision(log, movement, blocker);
      stopEntirely(movement);
      continue;
    }
    const rivals = isWhirlingPlan(movement.plan) ? [] : rivalsAt(claims, destination, movement);
    for (const rival of rivals) recordCollision(log, movement, rival);
    if (rivals.some((rival) => ramRankOf(rival.plan) >= ramRankOf(movement.plan))) {
      stopEntirely(movement);
      continue;
    }
    moveTo(movement, destination);
  }
  applyCollisions(log, ramDamage);
}

function settleOverlaps(movements: Movement[], ramDamage: RamDamageOverrides): void {
  let unsettled = revertOverlappingMovers(movements, ramDamage);
  while (unsettled) unsettled = revertOverlappingMovers(movements, ramDamage);
}

function revertOverlappingMovers(
  movements: Movement[],
  ramDamage: RamDamageOverrides,
): boolean {
  const log: CollisionLog = new Map();
  const reverting: Movement[] = [];
  for (const sharers of groupByTile(movements, (movement) => movement.position).values()) {
    if (sharers.length < 2) continue;
    for (const movement of sharers.filter((sharer) => sharer.moved)) {
      reverting.push(movement);
      for (const other of sharers) {
        if (other !== movement) recordCollision(log, movement, other);
      }
    }
  }
  for (const movement of reverting) stopEntirely(movement);
  applyCollisions(log, ramDamage);
  return reverting.length > 0;
}

function entersSecondPass(movement: Movement): boolean {
  if (movement.plan.destination === null) return false;
  return movement.plan.aheadClaim === null || movement.moved;
}

function claimsSquareOf(occupant: Movement, movement: Movement): boolean {
  const claim = occupant.plan.aheadClaim;
  return claim !== null && tileKeyOf(claim) === tileKeyOf(movement.plan.ship.position);
}

function otherAt(
  occupied: Map<string, Movement>,
  tile: BoardPosition,
  self: Movement,
): Movement | undefined {
  const found = occupied.get(tileKeyOf(tile));
  return found === self ? undefined : found;
}

function rivalsAt(
  claims: Map<string, Movement[]>,
  tile: BoardPosition,
  self: Movement,
): Movement[] {
  return (claims.get(tileKeyOf(tile)) ?? []).filter((claimant) => claimant !== self);
}

function outcomeOf(movement: Movement): CollisionOutcome {
  const plan: MovementPlan = movement.plan;
  return {
    shipId: plan.ship.shipId,
    position: movement.position,
    facing: plan.facing,
    collided: movement.collided,
    struckObstacle: plan.blockedByObstacle,
    damageTakenSmallMicro: movement.damageTakenSmallMicro,
  };
}
