import type { RngStream } from '../rng.ts';
import {
  BATTLE_BOARD_HEIGHT,
  BATTLE_BOARD_WIDTH,
  createBattleBoard,
  setTile,
  tileAt,
  type BattleBoard,
  type BattleTile,
} from './board.ts';
import { FACINGS, aheadOf, type Facing } from './geometry.ts';
import type { BattleShipPlacement } from './state.ts';

export const BATTLE_BOARD_STREAM = 'battle.board';

export interface BoardLayoutBalance {
  tallRockCount: number;
  smallRockCount: number;
  windTileCount: number;
  startingSeparationTiles: number;
}

export function createBattleLayout(
  balance: BoardLayoutBalance,
  placements: BattleShipPlacement[],
  stream: RngStream,
): BattleBoard {
  const board = createBattleBoard();
  const taken = new Set(placements.flatMap(reservedTilesOf));
  scatter(board, taken, stream, balance.tallRockCount, () => ({ kind: 'rock-tall' }));
  scatter(board, taken, stream, balance.smallRockCount, () => ({ kind: 'rock-small' }));
  scatter(board, taken, stream, balance.windTileCount, () => ({
    kind: 'wind',
    facing: drawFacing(stream),
  }));
  return board;
}

export function openingPlacements(
  balance: BoardLayoutBalance,
  playerShipId: number,
  brigandShipId: number,
): BattleShipPlacement[] {
  const lane = Math.floor(BATTLE_BOARD_WIDTH / 2);
  const margin = Math.max(
    Math.floor((BATTLE_BOARD_HEIGHT - balance.startingSeparationTiles) / 2),
    0,
  );
  return [
    { shipId: playerShipId, x: lane, y: BATTLE_BOARD_HEIGHT - 1 - margin, facing: 'north' },
    { shipId: brigandShipId, x: lane, y: margin, facing: 'south' },
  ];
}

function reservedTilesOf(placement: BattleShipPlacement): string[] {
  const berth = { x: placement.x, y: placement.y };
  const ahead = aheadOf(berth, placement.facing);
  return [berth, ahead, aheadOf(ahead, placement.facing)].map((tile) => `${tile.x},${tile.y}`);
}

function scatter(
  board: BattleBoard,
  taken: Set<string>,
  stream: RngStream,
  count: number,
  tileOf: () => BattleTile,
): void {
  for (let placed = 0; placed < count; placed += 1) {
    const position = drawOpenTile(board, taken, stream);
    if (position === null) return;
    taken.add(`${position.x},${position.y}`);
    setTile(board, position.x, position.y, tileOf());
  }
}

function drawOpenTile(
  board: BattleBoard,
  taken: Set<string>,
  stream: RngStream,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < MAXIMUM_SCATTER_ATTEMPTS; attempt += 1) {
    const x = stream.nextIntInRange(0, board.width);
    const y = stream.nextIntInRange(0, board.height);
    if (taken.has(`${x},${y}`)) continue;
    if (tileAt(board, x, y)?.kind !== 'open') continue;
    return { x, y };
  }
  return null;
}

function drawFacing(stream: RngStream): Facing {
  return FACINGS[stream.nextIntInRange(0, FACINGS.length)] ?? 'north';
}

const MAXIMUM_SCATTER_ATTEMPTS = 64;
