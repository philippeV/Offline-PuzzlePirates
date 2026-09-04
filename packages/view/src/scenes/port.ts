import { islandOf, shipClassOf } from '../client/rules.ts';
import type { PirateState } from '../client/rules.ts';
import type { TilePoint } from '../iso/projection.ts';
import {
  createGrid,
  setTile,
  type BaseTile,
  type ObjectAction,
  type SceneObject,
  type TileGrid,
} from './grid.ts';
import { createIsoScene, playerShipOf } from './isoScene.ts';
import type { Intent, Scene, SceneContext } from './scene.ts';

export const PORT_WIDTH = 26;
export const PORT_HEIGHT = 20;
export const WATER_BORDER_TILES = 3;
export const SHORE_TILES = 2;
export const JETTY_ROW = 10;
export const JETTY_TIP_X = 1;
export const JETTY_ROOT_X = 3;
export const MOORING = { x: 0, y: JETTY_ROW };
export const PORT_SPAWN = { x: 5, y: JETTY_ROW };
export const PALM_TILES: readonly TilePoint[] = [
  { x: 6, y: 6 },
  { x: 9, y: 13 },
  { x: 19, y: 7 },
  { x: 7, y: 12 },
  { x: 17, y: 5 },
];
export const MARKET_TILE = { x: 13, y: 9 };
export const HUT_TILE = { x: 16, y: 12 };
export const CRATE_TILE = { x: 11, y: 6 };

const MARKET_TARGET_ID = 'market';
const SLOOP_TARGET_ID = 'sloop';
const HUT_TARGET_ID = 'hut';
const CRATE_TARGET_ID = 'crate';

const TRADE_ACTION = 'trade';
const BOARD_ACTION = 'board';
const YE_ACTION = 'ye';
const BOOTY_ACTION = 'booty';

const PORT_INTENTS: Record<string, Intent> = {
  [TRADE_ACTION]: { kind: 'open-panel', panel: 'market' },
  [BOARD_ACTION]: { kind: 'enter-scene', scene: 'deck' },
  [YE_ACTION]: { kind: 'open-panel', panel: 'ye' },
  [BOOTY_ACTION]: { kind: 'open-panel', panel: 'booty' },
};

const MARKET_ACTIONS: ObjectAction[] = [{ id: TRADE_ACTION, label: 'Trade at the market' }];
const SLOOP_ACTIONS: ObjectAction[] = [{ id: BOARD_ACTION, label: 'Board the sloop' }];
const AVATAR_ACTIONS: ObjectAction[] = [
  { id: YE_ACTION, label: 'Ye' },
  { id: BOOTY_ACTION, label: 'Yer booty' },
];

const UNCHARTED_SHORE = 'Uncharted shore';
const MOORED_SHIP_LABEL = 'Yer ship';

export function createPortScene(context: SceneContext): Scene {
  const state = context.client.state;
  const ship = playerShipOf(state);
  const mooringLabel =
    ship === undefined ? MOORED_SHIP_LABEL : `Yer ${shipClassOf(ship.shipClass).name}`;

  function act(_targetId: string, actionId: string): void {
    const intent = PORT_INTENTS[actionId];
    if (intent === undefined) return;
    context.emit(intent);
  }

  return createIsoScene(context, {
    id: 'port',
    grid: buildPortGrid(mooringLabel),
    spawn: PORT_SPAWN,
    heading: portNameOf(state.pirate),
    avatarActions: AVATAR_ACTIONS,
    act,
  });
}

function portNameOf(pirate: PirateState | null): string {
  if (pirate === null || pirate.atIslandId === null) return UNCHARTED_SHORE;
  return islandOf(pirate.atIslandId).name;
}

function buildPortGrid(mooringLabel: string): TileGrid {
  const grid = createGrid(PORT_WIDTH, PORT_HEIGHT, 'grass');
  for (let y = 0; y < PORT_HEIGHT; y += 1) {
    for (let x = 0; x < PORT_WIDTH; x += 1) {
      setTile(grid, x, y, shoreTileAt(x, y));
    }
  }
  for (let x = JETTY_TIP_X; x <= JETTY_ROOT_X; x += 1) setTile(grid, x, JETTY_ROW, 'jetty');
  grid.objects = portObjects(mooringLabel);
  return grid;
}

function shoreTileAt(x: number, y: number): BaseTile {
  const edge = Math.min(x, y, PORT_WIDTH - 1 - x, PORT_HEIGHT - 1 - y);
  if (edge < WATER_BORDER_TILES) return 'water';
  if (edge < WATER_BORDER_TILES + SHORE_TILES) return 'sand';
  return 'grass';
}

function portObjects(mooringLabel: string): SceneObject[] {
  const palms = PALM_TILES.map((tile, index) => ({
    id: `palm-${index}`,
    x: tile.x,
    y: tile.y,
    art: 'palm' as const,
    label: 'Palm',
    actions: [],
  }));
  return [
    {
      id: MARKET_TARGET_ID,
      x: MARKET_TILE.x,
      y: MARKET_TILE.y,
      art: 'market',
      label: 'Market',
      actions: MARKET_ACTIONS,
    },
    {
      id: SLOOP_TARGET_ID,
      x: MOORING.x,
      y: MOORING.y,
      art: 'sloop',
      label: mooringLabel,
      actions: SLOOP_ACTIONS,
    },
    {
      id: HUT_TARGET_ID,
      x: HUT_TILE.x,
      y: HUT_TILE.y,
      art: 'hut',
      label: 'Shoppe',
      actions: [],
    },
    {
      id: CRATE_TARGET_ID,
      x: CRATE_TILE.x,
      y: CRATE_TILE.y,
      art: 'crate',
      label: 'Crates',
      actions: [],
    },
    ...palms,
  ];
}
