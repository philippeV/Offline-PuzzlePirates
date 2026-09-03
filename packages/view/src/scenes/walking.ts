import type { TilePoint } from '../iso/projection.ts';
import {
  ORTHOGONAL_STEPS,
  insideGrid,
  objectAt,
  tileAt,
  tileIndexOf,
  traversable,
  type TileGrid,
} from './grid.ts';

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const NO_WALK_REFUSAL = "Avast! I can't find a way to walk there.";

export function insideViewport(viewport: Viewport, x: number, y: number): boolean {
  return (
    x >= viewport.x &&
    y >= viewport.y &&
    x < viewport.x + viewport.width &&
    y < viewport.y + viewport.height
  );
}

export function pathBetween(
  grid: TileGrid,
  from: TilePoint,
  to: TilePoint,
  viewport: Viewport,
): TilePoint[] | null {
  if (!insideViewport(viewport, from.x, from.y)) return null;
  if (!insideViewport(viewport, to.x, to.y)) return null;
  if (!insideGrid(grid, from.x, from.y)) return null;
  if (!traversable(grid, to.x, to.y)) return null;
  const startKey = tileIndexOf(grid, from.x, from.y);
  const cameFrom = new Map<number, number>([[startKey, startKey]]);
  const frontier: TilePoint[] = [from];
  let head = 0;
  while (head < frontier.length) {
    const current = frontier[head];
    head += 1;
    if (current === undefined) break;
    if (current.x === to.x && current.y === to.y) return trailTo(grid, cameFrom, startKey, to);
    for (const step of ORTHOGONAL_STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (!insideViewport(viewport, next.x, next.y)) continue;
      if (!traversable(grid, next.x, next.y)) continue;
      const key = tileIndexOf(grid, next.x, next.y);
      if (cameFrom.has(key)) continue;
      cameFrom.set(key, tileIndexOf(grid, current.x, current.y));
      frontier.push(next);
    }
  }
  return null;
}

export function warpTargetOf(grid: TileGrid, to: TilePoint): TilePoint | null {
  if (!insideGrid(grid, to.x, to.y)) return null;
  if (tileAt(grid, to.x, to.y) === 'portal') return to;
  if (objectAt(grid, to.x, to.y) !== undefined) return to;
  return null;
}

function trailTo(
  grid: TileGrid,
  cameFrom: Map<number, number>,
  startKey: number,
  to: TilePoint,
): TilePoint[] {
  const trail: TilePoint[] = [];
  let key = tileIndexOf(grid, to.x, to.y);
  while (key !== startKey) {
    trail.push({ x: key % grid.width, y: Math.floor(key / grid.width) });
    const previous = cameFrom.get(key);
    if (previous === undefined) return [];
    key = previous;
  }
  trail.reverse();
  return trail;
}
