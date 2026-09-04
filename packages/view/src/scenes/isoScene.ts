import { Container, Graphics, Rectangle, Sprite, Text, type FederatedPointerEvent } from 'pixi.js';

import type { SceneId } from '../client/client.ts';
import type { ShipState, WorldState } from '../client/rules.ts';
import { createCamera } from '../iso/camera.ts';
import {
  TILE_HEIGHT,
  TILE_WIDTH,
  depthOf,
  isoToScreen,
  sameTile,
  screenToIso,
  type ScreenPoint,
  type TilePoint,
} from '../iso/projection.ts';
import {
  objectAt,
  tileAt,
  type BaseTile,
  type ObjectAction,
  type SceneObject,
  type TileGrid,
} from './grid.ts';
import { createRadialMenu } from './radial.ts';
import type { Scene, SceneContext } from './scene.ts';
import { NO_WALK_REFUSAL, pathBetween, warpTargetOf } from './walking.ts';

export const AVATAR_TARGET_ID = 'ye';
export const WALK_STEP_MS = 240;
export const WALK_BOB_PX = 5;
export const CREW_OFFSET_PX: ScreenPoint = { x: -18, y: 5 };
export const LABEL_LIFT_PX = 54;
export const HEADING_MARGIN_PX = 18;

const HIGHLIGHT_DEPTH = 0;
const OBJECT_DEPTH = 1;
const CREW_DEPTH = 2;
const AVATAR_DEPTH = 3;
const LABEL_DEPTH = 4;

const HIGHLIGHT_COLOUR = 0xe0c23a;
const HIGHLIGHT_ALPHA = 0.28;
const HIGHLIGHT_STROKE_PX = 2;
const LABEL_FILL = 0x121a20;
const LABEL_ALPHA = 0.72;
const LABEL_TEXT_COLOUR = 0xf4ecd8;
const LABEL_TEXT_SIZE_PX = 12;
const LABEL_PAD_X_PX = 8;
const LABEL_PAD_Y_PX = 3;
const HEADING_SIZE_PX = 22;
const HEADING_COLOUR = 0xf4ecd8;
const HEADING_STROKE_COLOUR = 0x101820;
const HEADING_STROKE_PX = 4;
const SCENE_FONT = 'Georgia, serif';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export interface IsoSceneDefinition {
  id: SceneId;
  grid: TileGrid;
  spawn: TilePoint;
  heading: string;
  avatarActions: ObjectAction[];
  crew?: TilePoint[];
  highlights?: TilePoint[];
  act(targetId: string, actionId: string): void;
  arrive?(tile: TilePoint, base: BaseTile): void;
}

export function playerShipOf(state: Readonly<WorldState>): ShipState | undefined {
  return state.ships.find((ship) => ship.allegiance === 'player');
}

export function createIsoScene(context: SceneContext, definition: IsoSceneDefinition): Scene {
  const grid = definition.grid;
  const world = new Container();
  const baseLayer = new Container();
  const objectLayer = new Container();
  const dynamicLayer = new Container();
  const spriteLayer = new Container();
  objectLayer.sortableChildren = true;
  dynamicLayer.sortableChildren = true;
  spriteLayer.sortableChildren = true;
  world.addChild(baseLayer, objectLayer, dynamicLayer, spriteLayer);

  const camera = createCamera(world);
  const radial = createRadialMenu();
  const heading = headingText(definition.heading);

  const root = new Container();
  root.eventMode = 'static';
  root.hitArea = new Rectangle(0, 0, 1, 1);
  root.addChild(camera.view, heading, radial.view);

  const avatar = Sprite.from(context.atlas.texture('avatar'));
  avatar.anchor.set(0.5, 1);

  let standing: TilePoint = definition.spawn;
  let stepFrom: TilePoint = definition.spawn;
  const clickableProps = new Map<unknown, SceneObject>();
  let stepTo: TilePoint | null = null;
  let stepElapsedMs = 0;
  let queued: TilePoint[] = [];

  function paintBase(): void {
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const tile = tileAt(grid, x, y);
        if (tile === undefined) continue;
        const sprite = Sprite.from(context.atlas.texture(tile));
        sprite.anchor.set(0.5, 0);
        sprite.position.copyFrom(isoToScreen({ x, y }));
        baseLayer.addChild(sprite);
      }
    }
  }

  function paintHighlights(): void {
    for (const tile of definition.highlights ?? []) {
      const marker = highlightShape();
      const spot = isoToScreen(tile);
      marker.position.set(spot.x - TILE_WIDTH / 2, spot.y);
      marker.zIndex = depthOf(tile, HIGHLIGHT_DEPTH);
      objectLayer.addChild(marker);
    }
  }

  function paintObjects(): void {
    for (const object of grid.objects) {
      const spot = standingSpot(object);
      const prop = Sprite.from(context.atlas.texture(object.art));
      prop.anchor.set(0.5, 1);
      prop.position.set(spot.x, spot.y);
      prop.zIndex = depthOf(object, OBJECT_DEPTH);
      objectLayer.addChild(prop);
      if (object.actions.length === 0) continue;
      const label = ovalLabel(object.label);
      label.position.set(spot.x, spot.y - LABEL_LIFT_PX);
      label.zIndex = depthOf(object, LABEL_DEPTH);
      spriteLayer.addChild(label);
      prop.eventMode = 'static';
      label.eventMode = 'static';
      clickableProps.set(prop, object);
      clickableProps.set(label, object);
    }
  }

  function paintCrew(): void {
    for (const tile of definition.crew ?? []) {
      const mate = Sprite.from(context.atlas.texture('crew'));
      mate.anchor.set(0.5, 1);
      const spot = standingSpot(tile);
      mate.position.set(spot.x + CREW_OFFSET_PX.x, spot.y + CREW_OFFSET_PX.y);
      mate.zIndex = depthOf(tile, CREW_DEPTH);
      dynamicLayer.addChild(mate);
    }
  }

  function placeAvatar(): void {
    const target = stepTo ?? standing;
    const progress = stepTo === null ? 0 : Math.min(stepElapsedMs / WALK_STEP_MS, 1);
    const from = standingSpot(stepFrom);
    const to = standingSpot(target);
    const bob = Math.sin(progress * Math.PI) * WALK_BOB_PX;
    avatar.x = from.x + (to.x - from.x) * progress;
    avatar.y = from.y + (to.y - from.y) * progress - bob;
    avatar.zIndex = depthOf(target, AVATAR_DEPTH);
  }

  function announceArrival(): void {
    const base = tileAt(grid, standing.x, standing.y);
    if (base === undefined) return;
    definition.arrive?.(standing, base);
  }

  function advanceWalk(elapsedMs: number): void {
    if (stepTo === null) {
      const next = queued.shift();
      if (next === undefined) return;
      stepFrom = standing;
      stepTo = next;
      stepElapsedMs = 0;
      return;
    }
    stepElapsedMs += elapsedMs;
    if (stepElapsedMs < WALK_STEP_MS) return;
    standing = stepTo;
    stepFrom = stepTo;
    stepTo = null;
    stepElapsedMs = 0;
    announceArrival();
  }

  function warpTo(tile: TilePoint): void {
    queued = [];
    stepTo = null;
    stepElapsedMs = 0;
    standing = tile;
    stepFrom = tile;
    camera.centreOn(tile);
    announceArrival();
  }

  function walkTo(tile: TilePoint): void {
    const trail = pathBetween(grid, standing, tile, camera.visibleTiles());
    if (trail !== null) {
      queued = trail;
      return;
    }
    const warp = warpTargetOf(grid, tile);
    if (warp !== null) {
      warpTo(warp);
      return;
    }
    context.client.say(NO_WALK_REFUSAL);
  }

  function openRadial(targetId: string, actions: ObjectAction[], at: ScreenPoint): void {
    radial.show(at, actions, (actionId) => definition.act(targetId, actionId));
  }

  function onTap(event: FederatedPointerEvent): void {
    if (event.button !== LEFT_BUTTON || radial.open) return;
    const drawn = clickableProps.get(event.target);
    if (drawn !== undefined) {
      openRadial(drawn.id, drawn.actions, event.global);
      return;
    }
    const tile = screenToIso(camera.toWorld(event.global));
    if (sameTile(tile, standing)) {
      openRadial(AVATAR_TARGET_ID, definition.avatarActions, event.global);
      return;
    }
    const object = objectAt(grid, tile.x, tile.y);
    if (object !== undefined) {
      openRadial(object.id, object.actions, event.global);
      return;
    }
    walkTo(tile);
  }

  function onPointerDown(event: FederatedPointerEvent): void {
    if (event.button !== RIGHT_BUTTON) return;
    camera.beginPan(event.global);
  }

  function onPointerMove(event: FederatedPointerEvent): void {
    if (!camera.panning) return;
    camera.panTo(event.global);
  }

  function onPointerUp(): void {
    camera.endPan();
  }

  paintBase();
  paintHighlights();
  paintObjects();
  paintCrew();
  dynamicLayer.addChild(avatar);
  placeAvatar();

  root.on('pointertap', onTap);
  root.on('pointerdown', onPointerDown);
  root.on('globalpointermove', onPointerMove);
  root.on('pointerup', onPointerUp);
  root.on('pointerupoutside', onPointerUp);

  return {
    id: definition.id,
    view: root,
    resize(width: number, height: number): void {
      root.hitArea = new Rectangle(0, 0, width, height);
      camera.resize(width, height);
      radial.resize(width, height);
      camera.centreOn(standing);
      heading.position.set(HEADING_MARGIN_PX, HEADING_MARGIN_PX);
    },
    update(elapsedMs: number): void {
      advanceWalk(elapsedMs);
      placeAvatar();
      camera.keepVisible(standing);
    },
    destroy(): void {
      root.off('pointertap', onTap);
      root.off('pointerdown', onPointerDown);
      root.off('globalpointermove', onPointerMove);
      root.off('pointerup', onPointerUp);
      root.off('pointerupoutside', onPointerUp);
      radial.destroy();
      root.destroy({ children: true });
    },
  };
}

function standingSpot(tile: TilePoint): ScreenPoint {
  const spot = isoToScreen(tile);
  return { x: spot.x, y: spot.y + TILE_HEIGHT / 2 };
}

function highlightShape(): Graphics {
  const half = { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 };
  return new Graphics()
    .poly([half.x, 0, TILE_WIDTH, half.y, half.x, TILE_HEIGHT, 0, half.y])
    .fill({ color: HIGHLIGHT_COLOUR, alpha: HIGHLIGHT_ALPHA })
    .stroke({ width: HIGHLIGHT_STROKE_PX, color: HIGHLIGHT_COLOUR });
}

function ovalLabel(caption: string): Container {
  const holder = new Container();
  const text = new Text({
    text: caption,
    style: { fontFamily: SCENE_FONT, fontSize: LABEL_TEXT_SIZE_PX, fill: LABEL_TEXT_COLOUR },
  });
  text.anchor.set(0.5);
  const width = text.width + LABEL_PAD_X_PX * 2;
  const height = text.height + LABEL_PAD_Y_PX * 2;
  const plate = new Graphics()
    .roundRect(-width / 2, -height / 2, width, height, height / 2)
    .fill({ color: LABEL_FILL, alpha: LABEL_ALPHA });
  holder.addChild(plate, text);
  return holder;
}

function headingText(caption: string): Text {
  return new Text({
    text: caption,
    style: {
      fontFamily: SCENE_FONT,
      fontSize: HEADING_SIZE_PX,
      fill: HEADING_COLOUR,
      stroke: { color: HEADING_STROKE_COLOUR, width: HEADING_STROKE_PX },
    },
  });
}
