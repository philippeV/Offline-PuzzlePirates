export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export interface TilePoint {
  x: number;
  y: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export function isoToScreen(tile: TilePoint): ScreenPoint {
  return {
    x: ((tile.x - tile.y) * TILE_WIDTH) / 2,
    y: ((tile.x + tile.y) * TILE_HEIGHT) / 2,
  };
}

export function screenToIso(point: ScreenPoint): TilePoint {
  const halfWidth = TILE_WIDTH / 2;
  const halfHeight = TILE_HEIGHT / 2;
  const x = point.x / halfWidth + point.y / halfHeight;
  const y = point.y / halfHeight - point.x / halfWidth;
  return { x: Math.floor(x / 2), y: Math.floor(y / 2) };
}

export function depthOf(tile: TilePoint, layer: number): number {
  return (tile.x + tile.y) * 16 + layer;
}

export function sameTile(a: TilePoint, b: TilePoint): boolean {
  return a.x === b.x && a.y === b.y;
}
