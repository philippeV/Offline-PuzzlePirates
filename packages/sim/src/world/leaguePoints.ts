import type { IslandId } from './islands.ts';

export type LeaguePointId = number;

export type LeagueOrientation = 'diagonal' | 'horizontal';

export interface LeaguePoint {
  id: LeaguePointId;
  row: number;
  col: number;
  islandId: IslandId | null;
  difficultyPerMille: number;
}

export interface League {
  a: LeaguePointId;
  b: LeaguePointId;
  orientation: LeagueOrientation;
}

export const MAX_DIFFICULTY_PER_MILLE = 1000;
export const DIAGONAL_LEAGUE_COST_PER_MILLE = 1000;
export const HORIZONTAL_LEAGUE_COST_PER_MILLE = 1400;

const COLUMN_COUNT = 6;

const declaredLeaguePoints: Record<LeaguePointId, LeaguePoint> = {
  1: { id: 1, row: 0, col: 0, islandId: 'alkaid', difficultyPerMille: 0 },
  2: { id: 2, row: 0, col: 1, islandId: null, difficultyPerMille: 125 },
  3: { id: 3, row: 0, col: 2, islandId: null, difficultyPerMille: 250 },
  4: { id: 4, row: 0, col: 3, islandId: null, difficultyPerMille: 375 },
  5: { id: 5, row: 0, col: 4, islandId: null, difficultyPerMille: 500 },
  6: { id: 6, row: 0, col: 5, islandId: null, difficultyPerMille: 625 },
  7: { id: 7, row: 1, col: 0, islandId: null, difficultyPerMille: 125 },
  8: { id: 8, row: 1, col: 1, islandId: 'doyle', difficultyPerMille: 250 },
  9: { id: 9, row: 1, col: 2, islandId: null, difficultyPerMille: 375 },
  10: { id: 10, row: 1, col: 3, islandId: null, difficultyPerMille: 500 },
  11: { id: 11, row: 1, col: 4, islandId: null, difficultyPerMille: 625 },
  12: { id: 12, row: 1, col: 5, islandId: null, difficultyPerMille: 750 },
  13: { id: 13, row: 2, col: 0, islandId: null, difficultyPerMille: 250 },
  14: { id: 14, row: 2, col: 1, islandId: 'marlowe', difficultyPerMille: 250 },
  15: { id: 15, row: 2, col: 2, islandId: null, difficultyPerMille: 375 },
  16: { id: 16, row: 2, col: 3, islandId: 'sayers-rock', difficultyPerMille: 500 },
  17: { id: 17, row: 2, col: 4, islandId: null, difficultyPerMille: 625 },
  18: { id: 18, row: 2, col: 5, islandId: null, difficultyPerMille: 750 },
  19: { id: 19, row: 3, col: 0, islandId: null, difficultyPerMille: 375 },
  20: { id: 20, row: 3, col: 1, islandId: null, difficultyPerMille: 375 },
  21: { id: 21, row: 3, col: 2, islandId: 'edgars-choice', difficultyPerMille: 500 },
  22: { id: 22, row: 3, col: 3, islandId: null, difficultyPerMille: 625 },
  23: { id: 23, row: 3, col: 4, islandId: null, difficultyPerMille: 750 },
  24: { id: 24, row: 3, col: 5, islandId: null, difficultyPerMille: 875 },
  25: { id: 25, row: 4, col: 0, islandId: null, difficultyPerMille: 500 },
  26: { id: 26, row: 4, col: 1, islandId: null, difficultyPerMille: 500 },
  27: { id: 27, row: 4, col: 2, islandId: null, difficultyPerMille: 500 },
  28: { id: 28, row: 4, col: 3, islandId: null, difficultyPerMille: 625 },
  29: { id: 29, row: 4, col: 4, islandId: 'isle-of-keris', difficultyPerMille: 750 },
  30: { id: 30, row: 4, col: 5, islandId: null, difficultyPerMille: 875 },
  31: { id: 31, row: 5, col: 0, islandId: null, difficultyPerMille: 625 },
  32: { id: 32, row: 5, col: 1, islandId: null, difficultyPerMille: 625 },
  33: { id: 33, row: 5, col: 2, islandId: null, difficultyPerMille: 625 },
  34: { id: 34, row: 5, col: 3, islandId: null, difficultyPerMille: 750 },
  35: { id: 35, row: 5, col: 4, islandId: null, difficultyPerMille: 875 },
  36: { id: 36, row: 5, col: 5, islandId: 'mcguffins-isle', difficultyPerMille: 1000 },
};

export const LEAGUE_POINTS: Record<LeaguePointId, LeaguePoint> = Object.assign(
  Object.create(null),
  declaredLeaguePoints,
);

export const LEAGUE_POINT_IDS: LeaguePointId[] = Object.keys(LEAGUE_POINTS)
  .map(Number)
  .sort((a, b) => a - b);

export function leaguePointOf(id: LeaguePointId): LeaguePoint {
  const point = LEAGUE_POINTS[id];
  if (point === undefined) throw new RangeError(`no league point numbered "${id}"`);
  return point;
}

function cellKey(row: number, col: number): number {
  return row * COLUMN_COUNT + col;
}

const POINT_ID_BY_CELL = new Map<number, LeaguePointId>(
  LEAGUE_POINT_IDS.map((id) => {
    const point = leaguePointOf(id);
    return [cellKey(point.row, point.col), id];
  }),
);

const POINT_ID_BY_ISLAND = new Map<IslandId, LeaguePointId>(
  LEAGUE_POINT_IDS.flatMap((id): [IslandId, LeaguePointId][] => {
    const islandId = leaguePointOf(id).islandId;
    return islandId === null ? [] : [[islandId, id]];
  }),
);

function pointIdAt(row: number, col: number): LeaguePointId | undefined {
  if (col < 0 || col >= COLUMN_COUNT) return undefined;
  return POINT_ID_BY_CELL.get(cellKey(row, col));
}

function diagonalColumnOffsets(row: number): number[] {
  return row % 2 === 0 ? [-1, 0] : [0, 1];
}

export function neighboursOf(id: LeaguePointId): League[] {
  const point = leaguePointOf(id);
  const leagues: League[] = [];
  for (const col of [point.col - 1, point.col + 1]) {
    const neighbourId = pointIdAt(point.row, col);
    if (neighbourId !== undefined) {
      leagues.push({ a: point.id, b: neighbourId, orientation: 'horizontal' });
    }
  }
  for (const row of [point.row - 1, point.row + 1]) {
    for (const offset of diagonalColumnOffsets(point.row)) {
      const neighbourId = pointIdAt(row, point.col + offset);
      if (neighbourId !== undefined) {
        leagues.push({ a: point.id, b: neighbourId, orientation: 'diagonal' });
      }
    }
  }
  return leagues.sort((first, second) => first.b - second.b);
}

export function islandPointOf(islandId: IslandId): LeaguePointId {
  const pointId = POINT_ID_BY_ISLAND.get(islandId);
  if (pointId === undefined) throw new RangeError(`no league point holds island "${islandId}"`);
  return pointId;
}

function isLeaguePoint(id: LeaguePointId): boolean {
  return LEAGUE_POINTS[id] !== undefined;
}

function pathTo(cameFrom: Map<LeaguePointId, LeaguePointId>, target: LeaguePointId): LeaguePointId[] {
  const path = [target];
  let step = cameFrom.get(target);
  while (step !== undefined) {
    path.unshift(step);
    step = cameFrom.get(step);
  }
  return path;
}

export function routeBetween(
  fromPointId: LeaguePointId,
  toPointId: LeaguePointId,
): LeaguePointId[] {
  if (!isLeaguePoint(fromPointId) || !isLeaguePoint(toPointId)) return [];
  if (fromPointId === toPointId) return [fromPointId];

  const cameFrom = new Map<LeaguePointId, LeaguePointId>();
  const reached = new Set<LeaguePointId>([fromPointId]);
  const frontier: LeaguePointId[] = [fromPointId];

  for (let head = 0; head < frontier.length; head += 1) {
    const current = frontier[head];
    if (current === undefined) break;
    for (const league of neighboursOf(current)) {
      if (reached.has(league.b)) continue;
      reached.add(league.b);
      cameFrom.set(league.b, current);
      if (league.b === toPointId) return pathTo(cameFrom, toPointId);
      frontier.push(league.b);
    }
  }

  return [];
}
