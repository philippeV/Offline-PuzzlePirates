import type { BoardPosition, Facing } from './geometry.ts';

export const BATTLE_BOARD_WIDTH = 24;
export const BATTLE_BOARD_HEIGHT = 24;

export interface OpenTile {
  kind: 'open';
}

export interface TallRockTile {
  kind: 'rock-tall';
}

export interface SmallRockTile {
  kind: 'rock-small';
}

export interface WindTile {
  kind: 'wind';
  facing: Facing;
}

export interface WhirlpoolTile {
  kind: 'whirlpool';
  id: number;
}

export type BattleTile = OpenTile | TallRockTile | SmallRockTile | WindTile | WhirlpoolTile;

export interface BattleBoard {
  width: number;
  height: number;
  tiles: BattleTile[];
}

export function createBattleBoard(): BattleBoard {
  const tiles: BattleTile[] = [];
  for (let index = 0; index < BATTLE_BOARD_WIDTH * BATTLE_BOARD_HEIGHT; index += 1) {
    tiles.push({ kind: 'open' });
  }
  return { width: BATTLE_BOARD_WIDTH, height: BATTLE_BOARD_HEIGHT, tiles };
}

export function flatIndexOf(board: BattleBoard, x: number, y: number): number {
  return y * board.width + x;
}

export function isInsideBoard(board: BattleBoard, x: number, y: number): boolean {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

export function tileAt(board: BattleBoard, x: number, y: number): BattleTile | undefined {
  if (!isInsideBoard(board, x, y)) return undefined;
  return board.tiles[flatIndexOf(board, x, y)];
}

export function setTile(board: BattleBoard, x: number, y: number, tile: BattleTile): void {
  if (!isInsideBoard(board, x, y)) return;
  board.tiles[flatIndexOf(board, x, y)] = tile;
}

export function isOnBoard(board: BattleBoard, position: BoardPosition): boolean {
  return isInsideBoard(board, position.x, position.y);
}

export function isImpassable(board: BattleBoard, position: BoardPosition): boolean {
  const tile = tileAt(board, position.x, position.y);
  if (tile === undefined) return true;
  return tile.kind === 'rock-tall' || tile.kind === 'rock-small';
}

export function blocksFire(board: BattleBoard, position: BoardPosition): boolean {
  return tileAt(board, position.x, position.y)?.kind === 'rock-tall';
}

export function whirlpoolOriginOf(board: BattleBoard, id: number): BoardPosition | undefined {
  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      if (isWhirlpoolCell(board, x, y, id)) return { x, y };
    }
  }
  return undefined;
}

function isWhirlpoolCell(board: BattleBoard, x: number, y: number, id: number): boolean {
  const tile = tileAt(board, x, y);
  return tile !== undefined && tile.kind === 'whirlpool' && tile.id === id;
}
