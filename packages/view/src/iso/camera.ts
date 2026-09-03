import { Container } from 'pixi.js';

import type { Viewport } from '../scenes/walking.ts';
import { isoToScreen, screenToIso, type ScreenPoint, type TilePoint } from './projection.ts';

export const ANCHOR_MARGIN_PX = 96;
export const VIEWPORT_EDGE_TILES = 1;

export interface Camera {
  readonly view: Container;
  readonly panning: boolean;
  resize(width: number, height: number): void;
  centreOn(tile: TilePoint): void;
  keepVisible(tile: TilePoint): void;
  beginPan(point: ScreenPoint): void;
  panTo(point: ScreenPoint): void;
  endPan(): void;
  toWorld(point: ScreenPoint): ScreenPoint;
  visibleTiles(): Viewport;
}

export function createCamera(content: Container): Camera {
  const view = new Container();
  view.addChild(content);
  let width = 0;
  let height = 0;
  let anchor: TilePoint = { x: 0, y: 0 };
  let grabbedAt: ScreenPoint | null = null;
  let grabbedFrom: ScreenPoint = { x: 0, y: 0 };

  function clampToAnchor(): void {
    const spot = isoToScreen(anchor);
    view.x = between(view.x, ANCHOR_MARGIN_PX - spot.x, width - ANCHOR_MARGIN_PX - spot.x);
    view.y = between(view.y, ANCHOR_MARGIN_PX - spot.y, height - ANCHOR_MARGIN_PX - spot.y);
  }

  function centreOn(tile: TilePoint): void {
    anchor = tile;
    const spot = isoToScreen(tile);
    view.position.set(width / 2 - spot.x, height / 2 - spot.y);
  }

  return {
    view,
    get panning(): boolean {
      return grabbedAt !== null;
    },
    resize(nextWidth: number, nextHeight: number): void {
      width = nextWidth;
      height = nextHeight;
      centreOn(anchor);
    },
    centreOn,
    keepVisible(tile: TilePoint): void {
      anchor = tile;
      clampToAnchor();
    },
    beginPan(point: ScreenPoint): void {
      grabbedAt = { x: point.x, y: point.y };
      grabbedFrom = { x: view.x, y: view.y };
    },
    panTo(point: ScreenPoint): void {
      if (grabbedAt === null) return;
      view.position.set(
        grabbedFrom.x + point.x - grabbedAt.x,
        grabbedFrom.y + point.y - grabbedAt.y,
      );
      clampToAnchor();
    },
    endPan(): void {
      grabbedAt = null;
    },
    toWorld(point: ScreenPoint): ScreenPoint {
      const local = view.toLocal(point);
      return { x: local.x, y: local.y };
    },
    visibleTiles(): Viewport {
      const corners = [
        screenToIso({ x: -view.x, y: -view.y }),
        screenToIso({ x: width - view.x, y: -view.y }),
        screenToIso({ x: -view.x, y: height - view.y }),
        screenToIso({ x: width - view.x, y: height - view.y }),
      ];
      const xs = corners.map((corner) => corner.x);
      const ys = corners.map((corner) => corner.y);
      const left = Math.min(...xs) - VIEWPORT_EDGE_TILES;
      const top = Math.min(...ys) - VIEWPORT_EDGE_TILES;
      return {
        x: left,
        y: top,
        width: Math.max(...xs) + VIEWPORT_EDGE_TILES - left + 1,
        height: Math.max(...ys) + VIEWPORT_EDGE_TILES - top + 1,
      };
    },
  };
}

function between(value: number, low: number, high: number): number {
  if (low > high) return (low + high) / 2;
  return Math.min(Math.max(value, low), high);
}
