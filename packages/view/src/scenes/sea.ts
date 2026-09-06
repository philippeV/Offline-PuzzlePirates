import { islandOf, leaguePointOf } from '../client/rules.ts';
import type { VoyageState } from '../client/rules.ts';
import type { TilePoint } from '../iso/projection.ts';
import { createGrid, type ObjectAction, type TileGrid } from './grid.ts';
import { createIsoScene } from './isoScene.ts';
import type { Intent, Scene, SceneContext } from './scene.ts';

export const SEA_WIDTH = 52;
export const SEA_HEIGHT = 44;
export const COURSE_START: TilePoint = { x: 21, y: 26 };
export const COURSE_END: TilePoint = { x: 30, y: 17 };
export const PROGRESS_PER_MILLE = 1000;

const CHART_ACTION = 'chart';
const VESSEL_ACTION = 'vessel';

const SEA_INTENTS: Record<string, Intent> = {
  [CHART_ACTION]: { kind: 'open-panel', panel: 'minimap' },
  [VESSEL_ACTION]: { kind: 'open-panel', panel: 'location' },
};

const AVATAR_ACTIONS: ObjectAction[] = [
  { id: CHART_ACTION, label: 'Chart a course' },
  { id: VESSEL_ACTION, label: 'Vessel' },
];

const OPEN_SEA = 'The open sea';

export function legProgressPerMilleOf(voyage: VoyageState | null): number {
  if (voyage === null || voyage.legTicksRequired <= 0) return 0;
  const sailed = Math.floor((voyage.legTicks * PROGRESS_PER_MILLE) / voyage.legTicksRequired);
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
    return coursePositionOf(legProgressPerMilleOf(context.client.state.voyage));
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
