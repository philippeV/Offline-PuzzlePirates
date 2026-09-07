import { islandOf, leaguePointOf } from '../client/rules.ts';
import type { VoyageState } from '../client/rules.ts';
import {
  DESIGN_STAGE_HEIGHT,
  DESIGN_STAGE_WIDTH,
  halfStageTileRadius,
} from '../iso/projection.ts';
import type { TilePoint } from '../iso/projection.ts';
import { createGrid, type ObjectAction, type TileGrid } from './grid.ts';
import { createIsoScene } from './isoScene.ts';
import type { Intent, Scene, SceneContext } from './scene.ts';

const COURSE_SPAN_TILES = 9;
const SPARE_WATER_TILES = 1;
const COURSE_CLEARANCE_TILES =
  Math.ceil(halfStageTileRadius(DESIGN_STAGE_WIDTH, DESIGN_STAGE_HEIGHT)) + SPARE_WATER_TILES;

export const COURSE_START: TilePoint = {
  x: COURSE_CLEARANCE_TILES,
  y: COURSE_CLEARANCE_TILES + COURSE_SPAN_TILES,
};
export const COURSE_END: TilePoint = {
  x: COURSE_CLEARANCE_TILES + COURSE_SPAN_TILES,
  y: COURSE_CLEARANCE_TILES,
};
export const SEA_WIDTH = COURSE_SPAN_TILES + COURSE_CLEARANCE_TILES * 2;
export const SEA_HEIGHT = SEA_WIDTH;
export const PROGRESS_PER_MILLE = 1000;

const CHART_ACTION = 'chart';
const VESSEL_ACTION = 'vessel';
const DECK_ACTION = 'deck';

const SEA_INTENTS: Record<string, Intent> = {
  [CHART_ACTION]: { kind: 'open-panel', panel: 'minimap' },
  [VESSEL_ACTION]: { kind: 'open-panel', panel: 'location' },
  [DECK_ACTION]: { kind: 'enter-scene', scene: 'deck' },
};

const AVATAR_ACTIONS: ObjectAction[] = [
  { id: CHART_ACTION, label: 'Chart a course' },
  { id: VESSEL_ACTION, label: 'Vessel' },
  { id: DECK_ACTION, label: 'To the deck' },
];

const OPEN_SEA = 'The open sea';

export function voyageProgressPerMilleOf(voyage: VoyageState | null): number {
  if (voyage === null) return 0;
  const legs = voyage.route.length - 1;
  if (legs <= 0) return 0;
  const withinLeg = voyage.legTicksRequired <= 0 ? 0 : voyage.legTicks / voyage.legTicksRequired;
  const sailed = Math.floor(((voyage.legIndex + withinLeg) * PROGRESS_PER_MILLE) / legs);
  return Math.min(Math.max(sailed, 0), PROGRESS_PER_MILLE);
}

export function coursePositionOf(progressPerMille: number): TilePoint {
  const sailed = progressPerMille / PROGRESS_PER_MILLE;
  return {
    x: COURSE_START.x + (COURSE_END.x - COURSE_START.x) * sailed,
    y: COURSE_START.y + (COURSE_END.y - COURSE_START.y) * sailed,
  };
}

export function passageHeadingOf(voyage: VoyageState | null): string {
  if (voyage === null) return OPEN_SEA;
  const destination = voyage.route[voyage.route.length - 1];
  if (destination === undefined) return OPEN_SEA;
  const islandId = leaguePointOf(destination).islandId;
  return islandId === null ? OPEN_SEA : `Bound for ${islandOf(islandId).name}`;
}

export function createSeaScene(context: SceneContext): Scene {
  function berth(): TilePoint {
    return coursePositionOf(voyageProgressPerMilleOf(context.client.state.voyage));
  }

  function act(_targetId: string, actionId: string): void {
    const intent = SEA_INTENTS[actionId];
    if (intent === undefined) return;
    context.emit(intent);
  }

  return createIsoScene(context, {
    id: 'sea',
    grid: buildSeaGrid(),
    spawn: berth(),
    heading: passageHeadingOf(context.client.state.voyage),
    avatarActions: AVATAR_ACTIONS,
    avatarArt: 'sloop',
    follow: berth,
    act,
  });
}

function buildSeaGrid(): TileGrid {
  return createGrid(SEA_WIDTH, SEA_HEIGHT, 'water');
}
