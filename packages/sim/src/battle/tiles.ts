import { tileAt, whirlpoolOriginOf, type BattleBoard, type WindTile } from './board.ts';
import { rotateClockwise, stepOf, type BoardPosition, type Facing } from './geometry.ts';

const WHIRLPOOL_SPAN = 2;

export interface Pose {
  position: BoardPosition;
  facing: Facing;
}

export function windEffect(tile: WindTile, pose: Pose): Pose {
  const step = stepOf(tile.facing);
  return {
    position: { x: pose.position.x + step.x, y: pose.position.y + step.y },
    facing: pose.facing,
  };
}

export function whirlEffect(board: BattleBoard, id: number, pose: Pose): Pose {
  const origin = whirlpoolOriginOf(board, id);
  if (origin === undefined || !isCornerOf(origin, pose.position)) return pose;
  return {
    position: oppositeCornerOf(origin, pose.position),
    facing: rotateClockwise(pose.facing, 1),
  };
}

export function tileEffect(board: BattleBoard, pose: Pose): Pose {
  const tile = tileAt(board, pose.position.x, pose.position.y);
  if (tile === undefined) return pose;
  switch (tile.kind) {
    case 'wind':
      return windEffect(tile, pose);
    case 'whirlpool':
      return whirlEffect(board, tile.id, pose);
    case 'open':
    case 'rock-tall':
    case 'rock-small':
      return pose;
  }
}

function isCornerOf(origin: BoardPosition, position: BoardPosition): boolean {
  return (
    isCornerOffset(position.x - origin.x) && isCornerOffset(position.y - origin.y)
  );
}

function isCornerOffset(offset: number): boolean {
  return offset >= 0 && offset < WHIRLPOOL_SPAN;
}

function oppositeCornerOf(origin: BoardPosition, position: BoardPosition): BoardPosition {
  return {
    x: origin.x + WHIRLPOOL_SPAN - 1 - (position.x - origin.x),
    y: origin.y + WHIRLPOOL_SPAN - 1 - (position.y - origin.y),
  };
}
