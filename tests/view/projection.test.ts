import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  TILE_HEIGHT,
  TILE_WIDTH,
  depthOf,
  isoToScreen,
  screenToIso,
} from '../../packages/view/src/iso/projection.ts';

test('the origin tile projects to the origin', () => {
  assert.deepEqual(isoToScreen({ x: 0, y: 0 }), { x: 0, y: 0 });
});

test('stepping east and south moves half a tile each way', () => {
  assert.deepEqual(isoToScreen({ x: 1, y: 0 }), { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
  assert.deepEqual(isoToScreen({ x: 0, y: 1 }), { x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
});

test('every tile of a field survives the round trip through screen space', () => {
  for (let x = 0; x < 12; x += 1) {
    for (let y = 0; y < 12; y += 1) {
      const screen = isoToScreen({ x, y });
      const centre = { x: screen.x, y: screen.y + TILE_HEIGHT / 2 };

      assert.deepEqual(screenToIso(centre), { x, y }, `tile ${x},${y} did not survive`);
    }
  }
});

test('tiles further from the camera sort behind nearer ones', () => {
  assert.ok(depthOf({ x: 0, y: 0 }, 0) < depthOf({ x: 1, y: 0 }, 0));
  assert.ok(depthOf({ x: 1, y: 0 }, 0) < depthOf({ x: 1, y: 1 }, 0));
});

test('layers sort within a tile', () => {
  assert.ok(depthOf({ x: 3, y: 3 }, 0) < depthOf({ x: 3, y: 3 }, 1));
  assert.ok(depthOf({ x: 3, y: 3 }, 1) < depthOf({ x: 4, y: 3 }, 0));
});
