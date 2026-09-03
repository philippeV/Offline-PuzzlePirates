import { Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js';

import type { ScreenPoint } from '../iso/projection.ts';
import type { ObjectAction } from './grid.ts';

export const RING_RADIUS_PX = 96;
export const BUTTON_WIDTH_PX = 152;
export const BUTTON_HEIGHT_PX = 28;
export const BUTTON_CORNER_PX = 8;
export const FIRST_BUTTON_ANGLE = -Math.PI / 2;
export const LABEL_SIZE_PX = 13;
export const TITLE_SIZE_PX = 14;
export const BACKDROP_ALPHA = 0.35;

const BACKDROP_COLOUR = 0x0a0f14;
const BUTTON_FILL = 0x1d2a33;
const BUTTON_STROKE = 0xe0c23a;
const SPOKE_COLOUR = 0xe0c23a;
const SPOKE_ALPHA = 0.5;
const LABEL_COLOUR = 0xf4ecd8;
const TITLE_COLOUR = 0xe0c23a;
const LABEL_FONT = 'Georgia, serif';

export interface RadialMenu {
  readonly view: Container;
  readonly open: boolean;
  show(
    point: ScreenPoint,
    title: string,
    actions: ObjectAction[],
    choose: (actionId: string) => void,
  ): void;
  hide(): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export function createRadialMenu(): RadialMenu {
  const view = new Container();
  const backdrop = new Graphics();
  const ring = new Container();
  let width = 0;
  let height = 0;

  view.visible = false;
  backdrop.eventMode = 'static';
  view.addChild(backdrop, ring);

  function paintBackdrop(): void {
    backdrop
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: BACKDROP_COLOUR, alpha: BACKDROP_ALPHA });
  }

  function hide(): void {
    view.visible = false;
    ring.removeChildren().forEach((child) => child.destroy({ children: true }));
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') hide();
  }

  backdrop.on('pointertap', (event: FederatedPointerEvent) => {
    event.stopPropagation();
    hide();
  });
  addEventListener('keydown', onKeyDown);

  return {
    view,
    get open(): boolean {
      return view.visible;
    },
    show(
      point: ScreenPoint,
      title: string,
      actions: ObjectAction[],
      choose: (actionId: string) => void,
    ): void {
      hide();
      if (actions.length === 0) return;
      paintBackdrop();
      const centre = withinScreen(point, width, height);
      ring.addChild(spokes(centre, actions.length), titleLabel(title, centre));
      actions.forEach((action, index) => {
        const button = actionButton(action, () => {
          hide();
          choose(action.id);
        });
        button.position.copyFrom(buttonSpot(centre, index, actions.length));
        ring.addChild(button);
      });
      view.visible = true;
    },
    hide,
    resize(nextWidth: number, nextHeight: number): void {
      width = nextWidth;
      height = nextHeight;
      paintBackdrop();
    },
    destroy(): void {
      removeEventListener('keydown', onKeyDown);
      view.destroy({ children: true });
    },
  };
}

function withinScreen(point: ScreenPoint, width: number, height: number): ScreenPoint {
  const padX = RING_RADIUS_PX + BUTTON_WIDTH_PX / 2;
  const padY = RING_RADIUS_PX + BUTTON_HEIGHT_PX;
  return {
    x: Math.min(Math.max(point.x, padX), Math.max(width - padX, padX)),
    y: Math.min(Math.max(point.y, padY), Math.max(height - padY, padY)),
  };
}

function buttonSpot(centre: ScreenPoint, index: number, count: number): ScreenPoint {
  const angle = FIRST_BUTTON_ANGLE + (index * 2 * Math.PI) / count;
  return {
    x: centre.x + Math.cos(angle) * RING_RADIUS_PX,
    y: centre.y + Math.sin(angle) * RING_RADIUS_PX,
  };
}

function spokes(centre: ScreenPoint, count: number): Graphics {
  const drawing = new Graphics();
  for (let index = 0; index < count; index += 1) {
    const spot = buttonSpot(centre, index, count);
    drawing.moveTo(centre.x, centre.y).lineTo(spot.x, spot.y);
  }
  return drawing.stroke({ width: 2, color: SPOKE_COLOUR, alpha: SPOKE_ALPHA });
}

function titleLabel(title: string, centre: ScreenPoint): Text {
  const text = new Text({
    text: title,
    style: { fontFamily: LABEL_FONT, fontSize: TITLE_SIZE_PX, fill: TITLE_COLOUR },
  });
  text.anchor.set(0.5);
  text.position.set(centre.x, centre.y);
  return text;
}

function actionButton(action: ObjectAction, choose: () => void): Container {
  const button = new Container();
  const plate = new Graphics()
    .roundRect(
      -BUTTON_WIDTH_PX / 2,
      -BUTTON_HEIGHT_PX / 2,
      BUTTON_WIDTH_PX,
      BUTTON_HEIGHT_PX,
      BUTTON_CORNER_PX,
    )
    .fill({ color: BUTTON_FILL })
    .stroke({ width: 2, color: BUTTON_STROKE });
  const label = new Text({
    text: action.label,
    style: { fontFamily: LABEL_FONT, fontSize: LABEL_SIZE_PX, fill: LABEL_COLOUR },
  });
  label.anchor.set(0.5);
  button.addChild(plate, label);
  button.eventMode = 'static';
  button.cursor = 'pointer';
  button.on('pointertap', (event: FederatedPointerEvent) => {
    event.stopPropagation();
    choose();
  });
  return button;
}
