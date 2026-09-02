import type { EntityId } from '../ids.ts';
import { ballWeightMicroOf, shipClassOf, type ShipClassId } from '../ship/classes.ts';
import { blocksFire, isOnBoard, type BattleBoard } from './board.ts';
import { beamOf, positionsEqual, type BeamSide, type BoardPosition, type Facing } from './geometry.ts';

export const FIRE_RANGE = 3;
export const GRAPPLE_RANGE = 1;

export interface FireTarget {
  shipId: EntityId;
  position: BoardPosition;
}

export interface FireShooter {
  shipId: EntityId;
  shipClass: ShipClassId;
  position: BoardPosition;
  facing: Facing;
}

export interface FireHit {
  targetId: EntityId;
  shots: number;
  damageSmallMicro: number;
}

export function lineOfFire(
  board: BattleBoard,
  position: BoardPosition,
  facing: Facing,
  side: BeamSide,
): BoardPosition[] {
  const line: BoardPosition[] = [];
  for (let distance = 1; distance <= FIRE_RANGE; distance += 1) {
    const tile = beamOf(position, facing, side, distance);
    if (!isOnBoard(board, tile) || blocksFire(board, tile)) return line;
    line.push(tile);
  }
  return line;
}

export function resolveFire(
  board: BattleBoard,
  shooter: FireShooter,
  targets: FireTarget[],
  side: BeamSide,
  shots: number,
): FireHit | null {
  const line = lineOfFire(board, shooter.position, shooter.facing, side);
  const target = firstTargetAlong(line, targets);
  if (target === undefined) return null;
  return {
    targetId: target.shipId,
    shots,
    damageSmallMicro: shots * ballWeightMicroOf(shipClassOf(shooter.shipClass).cannonSize),
  };
}

export function grappleReaches(
  board: BattleBoard,
  shooter: FireShooter,
  targets: FireTarget[],
  side: BeamSide,
): EntityId | null {
  const tile = beamOf(shooter.position, shooter.facing, side, GRAPPLE_RANGE);
  if (!isOnBoard(board, tile)) return null;
  const target = targetAt(targets, tile);
  return target === undefined ? null : target.shipId;
}

function firstTargetAlong(line: BoardPosition[], targets: FireTarget[]): FireTarget | undefined {
  for (const tile of line) {
    const target = targetAt(targets, tile);
    if (target !== undefined) return target;
  }
  return undefined;
}

function targetAt(targets: FireTarget[], tile: BoardPosition): FireTarget | undefined {
  return targets.find((candidate) => positionsEqual(candidate.position, tile));
}
