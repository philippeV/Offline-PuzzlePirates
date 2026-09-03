import type { PropArt } from '../iso/atlas.ts';
import type { TilePoint } from '../iso/projection.ts';

export type BaseTile = 'sand' | 'grass' | 'water' | 'deck' | 'plank' | 'portal' | 'dock' | 'jetty';

export interface ObjectAction {
  id: string;
  label: string;
}

export interface SceneObject {
  id: string;
  x: number;
  y: number;
  art: PropArt;
  label: string;
  actions: ObjectAction[];
}

export interface TileGrid {
  width: number;
  height: number;
  base: BaseTile[];
  objects: SceneObject[];
}

export const ORTHOGONAL_STEPS: readonly TilePoint[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export const HAZARD_TILES: readonly BaseTile[] = ['water'];

export const HAZARD_EDGE_TILES: readonly BaseTile[] = ['dock', 'jetty', 'portal'];

export function createGrid(width: number, height: number, fill: BaseTile): TileGrid {
  return { width, height, base: new Array<BaseTile>(width * height).fill(fill), objects: [] };
}

export function insideGrid(grid: TileGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function tileIndexOf(grid: TileGrid, x: number, y: number): number {
  return y * grid.width + x;
}

export function tileAt(grid: TileGrid, x: number, y: number): BaseTile | undefined {
  if (!insideGrid(grid, x, y)) return undefined;
  return grid.base[tileIndexOf(grid, x, y)];
}

export function setTile(grid: TileGrid, x: number, y: number, tile: BaseTile): void {
  if (!insideGrid(grid, x, y)) return;
  grid.base[tileIndexOf(grid, x, y)] = tile;
}

export function objectAt(grid: TileGrid, x: number, y: number): SceneObject | undefined {
  return grid.objects.find((object) => object.x === x && object.y === y);
}

export function traversable(grid: TileGrid, x: number, y: number): boolean {
  const tile = tileAt(grid, x, y);
  if (tile === undefined) return false;
  if (HAZARD_TILES.includes(tile)) return false;
  if (objectAt(grid, x, y) !== undefined) return false;
  if (HAZARD_EDGE_TILES.includes(tile)) return true;
  return !besideHazard(grid, x, y);
}

function besideHazard(grid: TileGrid, x: number, y: number): boolean {
  return ORTHOGONAL_STEPS.some((step) => {
    const neighbour = tileAt(grid, x + step.x, y + step.y);
    return neighbour !== undefined && HAZARD_TILES.includes(neighbour);
  });
}
