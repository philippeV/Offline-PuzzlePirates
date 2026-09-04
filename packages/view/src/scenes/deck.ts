import { STATION_SLOTS, shipClassOf } from '../client/rules.ts';
import type { ShipClass, ShipState, StationSlot, WorldState } from '../client/rules.ts';
import type { PropArt } from '../iso/atlas.ts';
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

export const DECK_WIDTH = 14;
export const DECK_HEIGHT = 9;
export const HULL_BOW_SHARPNESS = 1.5;
export const GANGPLANK_TILE = { x: 0, y: 4 };
export const DECK_SPAWN = { x: 2, y: 4 };
export const NAVIGATION_STATIONS_PER_SHIP = 1;

interface StationFitting {
  tile: TilePoint;
  art: PropArt;
  label: string;
}

const STATION_FITTINGS: Record<StationSlot, StationFitting> = {
  navigating: { tile: { x: 11, y: 4 }, art: 'wheel', label: 'Navigation' },
  sailing: { tile: { x: 8, y: 2 }, art: 'mast', label: 'Sailing' },
  rigging: { tile: { x: 8, y: 6 }, art: 'mast', label: 'Rigging' },
  gunnery: { tile: { x: 5, y: 2 }, art: 'cannon', label: 'Gunnery' },
  carpentry: { tile: { x: 5, y: 6 }, art: 'crate', label: 'Carpentry' },
  patching: { tile: { x: 3, y: 5 }, art: 'crate', label: 'Patching' },
  bilging: { tile: { x: 3, y: 3 }, art: 'pump', label: 'Bilging' },
};

const STATION_COUNTS: Record<StationSlot, (shipClass: ShipClass) => number> = {
  navigating: () => NAVIGATION_STATIONS_PER_SHIP,
  sailing: (shipClass) => shipClass.sailStations,
  rigging: (shipClass) => shipClass.sailStations,
  gunnery: (shipClass) => shipClass.gunStations,
  carpentry: (shipClass) => shipClass.carpStations,
  patching: (shipClass) => shipClass.carpStations,
  bilging: (shipClass) => shipClass.bilgeStations,
};

const PLAY_ACTION = 'play';
const CHART_ACTION = 'chart';
const SAIL_ACTION = 'sail';
const VESSEL_ACTION = 'vessel';
const HOW_ACTION = 'how';
const YE_ACTION = 'ye';
const BOOTY_ACTION = 'booty';

const DECK_INTENTS: Record<string, Intent> = {
  [PLAY_ACTION]: { kind: 'enter-scene', scene: 'puzzle' },
  [CHART_ACTION]: { kind: 'open-panel', panel: 'minimap' },
  [VESSEL_ACTION]: { kind: 'open-panel', panel: 'location' },
  [YE_ACTION]: { kind: 'open-panel', panel: 'ye' },
  [BOOTY_ACTION]: { kind: 'open-panel', panel: 'booty' },
};

const BILGING_ACTIONS: ObjectAction[] = [{ id: PLAY_ACTION, label: 'Play Bilging' }];
const NAVIGATION_ACTIONS: ObjectAction[] = [
  { id: CHART_ACTION, label: 'Chart a course' },
  { id: SAIL_ACTION, label: 'Set sail' },
  { id: VESSEL_ACTION, label: 'Vessel' },
];
const CREWED_ACTIONS: ObjectAction[] = [{ id: HOW_ACTION, label: 'How to play' }];
const AVATAR_ACTIONS: ObjectAction[] = [
  { id: YE_ACTION, label: 'Ye' },
  { id: BOOTY_ACTION, label: 'Yer booty' },
];

const UNKNOWN_DECK_HEADING = 'A deck of yer own';
const UNKNOWN_STATION_LABEL = 'That station';
const GANGPLANK_STOWED = 'The gangplank be stowed while we sail.';

export function createDeckScene(context: SceneContext): Scene {
  const state = context.client.state;
  const ship = playerShipOf(state);
  const stations = ship === undefined ? [] : stationsOf(shipClassOf(ship.shipClass));
  const grid = buildDeckGrid(stations, moored(state));
  const labels = new Map(stations.map((slot) => [stationIdOf(slot), STATION_FITTINGS[slot].label]));

  function act(targetId: string, actionId: string): void {
    if (actionId === SAIL_ACTION) {
      context.client.dispatch({ op: 'voyage.sail' });
      return;
    }
    const intent = DECK_INTENTS[actionId];
    if (intent !== undefined) {
      context.emit(intent);
      return;
    }
    if (actionId !== HOW_ACTION) return;
    context.client.say(howToPlayLine(labels.get(targetId) ?? UNKNOWN_STATION_LABEL));
  }

  function arrive(_tile: TilePoint, base: BaseTile): void {
    if (base !== 'portal') return;
    if (!moored(context.client.state)) {
      context.client.say(GANGPLANK_STOWED);
      return;
    }
    context.emit({ kind: 'enter-scene', scene: 'port' });
  }

  return createIsoScene(context, {
    id: 'deck',
    grid,
    spawn: DECK_SPAWN,
    heading: ship === undefined ? UNKNOWN_DECK_HEADING : shipClassOf(ship.shipClass).name,
    avatarActions: AVATAR_ACTIONS,
    crew: crewTilesOf(stations, ship),
    highlights: highlightsOf(stations, ship),
    act,
    arrive,
  });
}

function moored(state: Readonly<WorldState>): boolean {
  return state.pirate !== null && state.pirate.atIslandId !== null;
}

function stationsOf(shipClass: ShipClass): StationSlot[] {
  return STATION_SLOTS.filter((slot) => STATION_COUNTS[slot](shipClass) > 0);
}

function stationIdOf(slot: StationSlot): string {
  return `station-${slot}`;
}

function stationActionsOf(slot: StationSlot): ObjectAction[] {
  if (slot === 'bilging') return BILGING_ACTIONS;
  if (slot === 'navigating') return NAVIGATION_ACTIONS;
  return CREWED_ACTIONS;
}

function howToPlayLine(label: string): string {
  return `${label}: yer swabbies hold that station while ye bilge.`;
}

function crewTilesOf(stations: StationSlot[], ship: ShipState | undefined): TilePoint[] {
  const manned = ship === undefined ? null : ship.playerStation;
  return stations
    .filter((slot) => slot !== manned)
    .map((slot) => STATION_FITTINGS[slot].tile);
}

function highlightsOf(stations: StationSlot[], ship: ShipState | undefined): TilePoint[] {
  const manned = ship === undefined ? null : ship.playerStation;
  return stations.filter((slot) => slot === manned).map((slot) => STATION_FITTINGS[slot].tile);
}

function buildDeckGrid(stations: StationSlot[], inPort: boolean): TileGrid {
  const grid = createGrid(DECK_WIDTH, DECK_HEIGHT, 'water');
  for (let y = 0; y < DECK_HEIGHT; y += 1) {
    for (let x = 0; x < DECK_WIDTH; x += 1) {
      setTile(grid, x, y, hullTileAt(x, y));
    }
  }
  if (inPort) setTile(grid, GANGPLANK_TILE.x, GANGPLANK_TILE.y, 'portal');
  grid.objects = stationObjects(stations);
  return grid;
}

function hullTileAt(x: number, y: number): BaseTile {
  if (!insideHull(x, y)) return 'water';
  const rimmed = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].some((neighbour) => !insideHull(neighbour.x, neighbour.y));
  return rimmed ? 'plank' : 'deck';
}

function insideHull(x: number, y: number): boolean {
  const halfWidth = DECK_WIDTH / 2;
  const halfHeight = DECK_HEIGHT / 2;
  const across = (x + 0.5 - halfWidth) / halfWidth;
  const along = (y + 0.5 - halfHeight) / halfHeight;
  return Math.abs(across) ** HULL_BOW_SHARPNESS + along * along <= 1;
}

function stationObjects(stations: StationSlot[]): SceneObject[] {
  return stations.map((slot) => {
    const fitting = STATION_FITTINGS[slot];
    return {
      id: stationIdOf(slot),
      x: fitting.tile.x,
      y: fitting.tile.y,
      art: fitting.art,
      label: fitting.label,
      actions: stationActionsOf(slot),
    };
  });
}
