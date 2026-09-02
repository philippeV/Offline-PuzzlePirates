import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ISLAND_IDS, type IslandId } from '../../packages/sim/src/world/islands.ts';
import {
  DIAGONAL_LEAGUE_COST_PER_MILLE,
  HORIZONTAL_LEAGUE_COST_PER_MILLE,
  LEAGUE_POINTS,
  LEAGUE_POINT_IDS,
  MAX_DIFFICULTY_PER_MILLE,
  islandPointOf,
  leaguePointOf,
  neighboursOf,
  routeBetween,
  type LeaguePoint,
  type LeaguePointId,
} from '../../packages/sim/src/world/leaguePoints.ts';

const UNMAPPED_POINT_ID = 9999;

function staggeredX(point: LeaguePoint): number {
  return point.col * 2 + (point.row % 2 === 0 ? 0 : 1);
}

function graphDistancesFromCapital(): Map<LeaguePointId, number> {
  const start = islandPointOf('alkaid');
  const distances = new Map<LeaguePointId, number>([[start, 0]]);
  const frontier: LeaguePointId[] = [start];
  for (let head = 0; head < frontier.length; head += 1) {
    const current = frontier[head] as LeaguePointId;
    for (const league of neighboursOf(current)) {
      if (distances.has(league.b)) continue;
      distances.set(league.b, (distances.get(current) as number) + 1);
      frontier.push(league.b);
    }
  }
  return distances;
}

test('the map holds between thirty-two and forty-four points across five to seven rows', () => {
  const rows = new Set(LEAGUE_POINT_IDS.map((id) => leaguePointOf(id).row));

  assert.ok(LEAGUE_POINT_IDS.length >= 32 && LEAGUE_POINT_IDS.length <= 44, `${LEAGUE_POINT_IDS.length}`);
  assert.ok(rows.size >= 5 && rows.size <= 7, `${rows.size}`);
});

test('the league point table carries no prototype', () => {
  assert.equal(Object.getPrototypeOf(LEAGUE_POINTS), null);
});

test('every point is keyed by its own id and sits on an integer cell', () => {
  for (const id of LEAGUE_POINT_IDS) {
    const point = leaguePointOf(id);

    assert.equal(point.id, id);
    assert.ok(Number.isSafeInteger(point.row), `${id}`);
    assert.ok(Number.isSafeInteger(point.col), `${id}`);
  }
});

test('no two points share a cell', () => {
  const cells = LEAGUE_POINT_IDS.map((id) => `${leaguePointOf(id).row}:${leaguePointOf(id).col}`);

  assert.equal(new Set(cells).size, cells.length);
});

test('every island sits on exactly one distinct point', () => {
  const occupied = LEAGUE_POINT_IDS.filter((id) => leaguePointOf(id).islandId !== null);
  const islandIds = occupied.map((id) => leaguePointOf(id).islandId);

  assert.equal(occupied.length, ISLAND_IDS.length);
  assert.deepEqual([...islandIds].sort(), [...ISLAND_IDS].sort());
  assert.equal(new Set(occupied.map((id) => islandPointOf(leaguePointOf(id).islandId as IslandId))).size, ISLAND_IDS.length);
});

test('every point that carries no island reports a null island', () => {
  const islandPointIds = ISLAND_IDS.map(islandPointOf);

  for (const id of LEAGUE_POINT_IDS) {
    if (islandPointIds.includes(id)) continue;
    assert.equal(leaguePointOf(id).islandId, null);
  }
});

test('adjacency is symmetric', () => {
  for (const id of LEAGUE_POINT_IDS) {
    for (const league of neighboursOf(id)) {
      const back = neighboursOf(league.b).find((other) => other.b === id);

      assert.ok(back !== undefined, `${id} -> ${league.b}`);
      assert.equal(back.orientation, league.orientation);
    }
  }
});

test('no point has more than six neighbours and none is isolated', () => {
  for (const id of LEAGUE_POINT_IDS) {
    const count = neighboursOf(id).length;

    assert.ok(count >= 1 && count <= 6, `${id} has ${count}`);
  }
});

test('the staggered grid has no vertical edges', () => {
  for (const id of LEAGUE_POINT_IDS) {
    const point = leaguePointOf(id);
    for (const league of neighboursOf(id)) {
      const other = leaguePointOf(league.b);
      if (other.row === point.row) continue;

      assert.notEqual(staggeredX(other), staggeredX(point), `${id} -> ${league.b}`);
    }
  }
});

test('horizontal leagues stay within a row and diagonal leagues cross one row', () => {
  for (const id of LEAGUE_POINT_IDS) {
    const point = leaguePointOf(id);
    for (const league of neighboursOf(id)) {
      const other = leaguePointOf(league.b);
      const rowStep = Math.abs(other.row - point.row);

      assert.equal(rowStep, league.orientation === 'horizontal' ? 0 : 1);
      assert.equal(Math.abs(staggeredX(other) - staggeredX(point)), league.orientation === 'horizontal' ? 2 : 1);
    }
  }
});

test('a horizontal league costs forty percent more than a diagonal one', () => {
  assert.equal(HORIZONTAL_LEAGUE_COST_PER_MILLE, (DIAGONAL_LEAGUE_COST_PER_MILLE * 14) / 10);
});

test('every point is reachable from every other point', () => {
  const distances = graphDistancesFromCapital();

  assert.equal(distances.size, LEAGUE_POINT_IDS.length);
});

test('difficulty stays within nought and one thousand per mille', () => {
  for (const id of LEAGUE_POINT_IDS) {
    const difficulty = leaguePointOf(id).difficultyPerMille;

    assert.ok(Number.isSafeInteger(difficulty), `${id}`);
    assert.ok(difficulty >= 0 && difficulty <= MAX_DIFFICULTY_PER_MILLE, `${id} is ${difficulty}`);
  }
});

test('difficulty never falls as graph distance from the capital grows', () => {
  const distances = graphDistancesFromCapital();
  const ordered = [...LEAGUE_POINT_IDS].sort(
    (first, second) => (distances.get(first) as number) - (distances.get(second) as number),
  );

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = leaguePointOf(ordered[index - 1] as LeaguePointId);
    const current = leaguePointOf(ordered[index] as LeaguePointId);

    assert.ok(current.difficultyPerMille >= previous.difficultyPerMille, `${previous.id} -> ${current.id}`);
  }
});

test('the capital sits at the safe end and the far corner at the dangerous end', () => {
  const difficulties = LEAGUE_POINT_IDS.map((id) => leaguePointOf(id).difficultyPerMille);

  assert.equal(leaguePointOf(islandPointOf('alkaid')).difficultyPerMille, Math.min(...difficulties));
  assert.equal(Math.max(...difficulties), MAX_DIFFICULTY_PER_MILLE);
});

test('a route includes both of its endpoints', () => {
  const from = islandPointOf('alkaid');
  const to = islandPointOf('mcguffins-isle');

  const route = routeBetween(from, to);

  assert.equal(route[0], from);
  assert.equal(route[route.length - 1], to);
});

test('a route between neighbours is just the two points', () => {
  const from = LEAGUE_POINT_IDS[0] as LeaguePointId;
  const neighbour = neighboursOf(from)[0];

  assert.ok(neighbour !== undefined);
  assert.deepEqual(routeBetween(from, neighbour.b), [from, neighbour.b]);
});

test('a route to the point itself is that single point', () => {
  const point = islandPointOf('doyle');

  assert.deepEqual(routeBetween(point, point), [point]);
});

test('a route never revisits a point and steps only along leagues', () => {
  const route = routeBetween(islandPointOf('alkaid'), islandPointOf('isle-of-keris'));

  assert.equal(new Set(route).size, route.length);
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1] as LeaguePointId;
    const current = route[index] as LeaguePointId;

    assert.ok(neighboursOf(previous).some((league) => league.b === current), `${previous} -> ${current}`);
  }
});

test('a route is the shortest one the graph allows', () => {
  const distances = graphDistancesFromCapital();
  const capital = islandPointOf('alkaid');

  for (const id of LEAGUE_POINT_IDS) {
    assert.equal(routeBetween(capital, id).length, (distances.get(id) as number) + 1);
  }
});

test('repeated calls return the identical route', () => {
  const from = islandPointOf('marlowe');
  const to = islandPointOf('mcguffins-isle');

  const first = routeBetween(from, to);

  assert.deepEqual(routeBetween(from, to), first);
  assert.deepEqual(routeBetween(from, to), first);
});

test('a route to a point that is not on the map is empty', () => {
  assert.deepEqual(routeBetween(islandPointOf('alkaid'), UNMAPPED_POINT_ID), []);
  assert.deepEqual(routeBetween(UNMAPPED_POINT_ID, islandPointOf('alkaid')), []);
});

test('asking for an unknown league point throws a range error', () => {
  assert.throws(() => leaguePointOf(UNMAPPED_POINT_ID), RangeError);
});

test('asking for the neighbours of an unknown league point throws a range error', () => {
  assert.throws(() => neighboursOf(UNMAPPED_POINT_ID), RangeError);
});

test('asking for the point of an island that is not on the map throws a range error', () => {
  assert.throws(() => islandPointOf('sirius' as IslandId), RangeError);
});
