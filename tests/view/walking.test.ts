import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createGrid,
  objectAt,
  setTile,
  traversable,
  type TileGrid,
} from '../../packages/view/src/scenes/grid.ts';
import {
  NO_WALK_REFUSAL,
  pathBetween,
  warpTargetOf,
  type Viewport,
} from '../../packages/view/src/scenes/walking.ts';

const WHOLE_GRID: Viewport = { x: 0, y: 0, width: 12, height: 12 };

function island(): TileGrid {
  return createGrid(12, 12, 'sand');
}

function stepsAreOrthogonal(trail: { x: number; y: number }[], from: { x: number; y: number }): void {
  let previous = from;
  for (const tile of trail) {
    const distance = Math.abs(tile.x - previous.x) + Math.abs(tile.y - previous.y);
    assert.equal(distance, 1, `${JSON.stringify(previous)} to ${JSON.stringify(tile)} is no single step`);
    previous = tile;
  }
}

test('open sand is walkable and water is not', () => {
  const grid = island();
  setTile(grid, 4, 4, 'water');

  assert.equal(traversable(grid, 8, 8), true);
  assert.equal(traversable(grid, 4, 4), false);
});

test('the tile beside water is refused, as the hazard rule says', () => {
  const grid = island();
  setTile(grid, 4, 4, 'water');

  assert.equal(traversable(grid, 4, 3), false);
  assert.equal(traversable(grid, 3, 4), false);
  assert.equal(traversable(grid, 3, 3), true);
});

test('a jetty is the sanctioned way to stand at the water', () => {
  const grid = island();
  setTile(grid, 4, 4, 'water');
  setTile(grid, 4, 3, 'jetty');

  assert.equal(traversable(grid, 4, 3), true);
});

test('a tile holding an object cannot be walked onto', () => {
  const grid = island();
  grid.objects.push({ id: 'market', x: 6, y: 6, art: 'market', label: 'Market', actions: [] });

  assert.equal(traversable(grid, 6, 6), false);
  assert.equal(objectAt(grid, 6, 6)?.id, 'market');
});

test('a walk is four-directional and never diagonal', () => {
  const grid = island();
  const from = { x: 1, y: 1 };
  const trail = pathBetween(grid, from, { x: 5, y: 4 }, WHOLE_GRID);

  assert.ok(trail !== null);
  assert.equal(trail.length, 7);
  stepsAreOrthogonal(trail, from);
  assert.deepEqual(trail.at(-1), { x: 5, y: 4 });
});

test('a wall is walked around rather than through', () => {
  const grid = island();
  for (let y = 0; y < 9; y += 1) setTile(grid, 5, y, 'water');
  const from = { x: 2, y: 2 };
  const trail = pathBetween(grid, from, { x: 8, y: 2 }, WHOLE_GRID);

  assert.ok(trail !== null);
  stepsAreOrthogonal(trail, from);
  assert.ok(trail.some((tile) => tile.y >= 10), 'the walk did not go round the flooded column');
});

test('the pathfinder only considers tiles the player can see', () => {
  const grid = island();
  const window: Viewport = { x: 0, y: 0, width: 4, height: 4 };

  assert.equal(pathBetween(grid, { x: 1, y: 1 }, { x: 9, y: 9 }, window), null);
  assert.notEqual(pathBetween(grid, { x: 1, y: 1 }, { x: 3, y: 3 }, window), null);
});

test('a walk to a walled-off tile fails so the pirate can refuse out loud', () => {
  const grid = island();
  for (let y = 0; y < 12; y += 1) setTile(grid, 5, y, 'water');

  assert.equal(pathBetween(grid, { x: 2, y: 2 }, { x: 8, y: 2 }, WHOLE_GRID), null);
  assert.equal(NO_WALK_REFUSAL, "Avast! I can't find a way to walk there.");
});

test('an unreachable portal is warped to instead', () => {
  const grid = island();
  for (let y = 0; y < 12; y += 1) setTile(grid, 5, y, 'water');
  setTile(grid, 8, 2, 'portal');

  assert.equal(pathBetween(grid, { x: 2, y: 2 }, { x: 8, y: 2 }, WHOLE_GRID), null);
  assert.deepEqual(warpTargetOf(grid, { x: 8, y: 2 }), { x: 8, y: 2 });
});

test('an unreachable patch of open ground is not warped to', () => {
  const grid = island();

  assert.equal(warpTargetOf(grid, { x: 8, y: 2 }), null);
  assert.equal(warpTargetOf(grid, { x: 99, y: 2 }), null);
});
