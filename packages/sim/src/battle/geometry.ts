export type Facing = 'north' | 'east' | 'south' | 'west';
export type BeamSide = 'port' | 'starboard';
export type Turn = 'left' | 'right';

export interface BoardPosition {
  x: number;
  y: number;
}

export const FACINGS: Facing[] = ['north', 'east', 'south', 'west'];

const QUARTER_TURNS_PER_CIRCLE = 4;

export function facingRankOf(facing: Facing): number {
  switch (facing) {
    case 'north':
      return 0;
    case 'east':
      return 1;
    case 'south':
      return 2;
    case 'west':
      return 3;
  }
}

export function facingAtRank(rank: number): Facing {
  switch (wrappedRank(rank)) {
    case 0:
      return 'north';
    case 1:
      return 'east';
    case 2:
      return 'south';
    default:
      return 'west';
  }
}

export function rotateClockwise(facing: Facing, quarterTurns: number): Facing {
  return facingAtRank(facingRankOf(facing) + quarterTurns);
}

export function turnedFacing(facing: Facing, turn: Turn): Facing {
  return rotateClockwise(facing, turn === 'right' ? 1 : -1);
}

export function stepOf(facing: Facing): BoardPosition {
  switch (facing) {
    case 'north':
      return { x: 0, y: -1 };
    case 'east':
      return { x: 1, y: 0 };
    case 'south':
      return { x: 0, y: 1 };
    case 'west':
      return { x: -1, y: 0 };
  }
}

export function aheadOf(position: BoardPosition, facing: Facing): BoardPosition {
  return advanced(position, facing, 1);
}

export function beamOf(
  position: BoardPosition,
  facing: Facing,
  side: BeamSide,
  distance: number,
): BoardPosition {
  return advanced(position, rotateClockwise(facing, side === 'starboard' ? 1 : -1), distance);
}

export function positionsEqual(a: BoardPosition, b: BoardPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function advanced(position: BoardPosition, facing: Facing, distance: number): BoardPosition {
  const step = stepOf(facing);
  return { x: position.x + step.x * distance, y: position.y + step.y * distance };
}

function wrappedRank(rank: number): number {
  return ((rank % QUARTER_TURNS_PER_CIRCLE) + QUARTER_TURNS_PER_CIRCLE) % QUARTER_TURNS_PER_CIRCLE;
}
