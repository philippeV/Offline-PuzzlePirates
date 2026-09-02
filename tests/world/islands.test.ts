import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COMMODITY_IDS } from '../../packages/sim/src/world/commodities.ts';
import {
  ISLANDS,
  ISLAND_IDS,
  islandOf,
  type IslandId,
  type IslandSize,
} from '../../packages/sim/src/world/islands.ts';

interface WikiRow {
  name: string;
  size: IslandSize;
  isCapital: boolean;
  isColonized: boolean;
  spawnCommodities: string[];
}

const WIKI_TABLE: Record<IslandId, WikiRow> = {
  'alkaid': { name: 'Alkaid Island', size: 'large', isCapital: true, isColonized: true, spawnCommodities: ['sincosite', 'sugar-cane'] },
  'doyle': { name: 'Doyle Island', size: 'medium', isCapital: false, isColonized: true, spawnCommodities: ['hemp', 'stone'] },
  'edgars-choice': { name: "Edgar's Choice", size: 'large', isCapital: false, isColonized: false, spawnCommodities: ['sugar-cane', 'wood'] },
  'isle-of-keris': { name: 'Isle of Keris', size: 'large', isCapital: false, isColonized: false, spawnCommodities: ['iron', 'lily-of-the-valley', 'wood'] },
  'marlowe': { name: 'Marlowe Island', size: 'outpost', isCapital: false, isColonized: true, spawnCommodities: ['chalcocite'] },
  'mcguffins-isle': { name: "McGuffin's Isle", size: 'outpost', isCapital: false, isColonized: false, spawnCommodities: ['butterfly-weed', 'pokeweed-berries'] },
  'sayers-rock': { name: 'Sayers Rock', size: 'large', isCapital: false, isColonized: true, spawnCommodities: ['iris-root', 'iron', 'stone'] },
};

const FORBIDDEN_FIELDS = ['pirate', 'pirates', 'crew', 'crews', 'flag', 'flags'];

test('the archipelago holds the seven ursa islands', () => {
  assert.deepEqual(ISLAND_IDS, Object.keys(WIKI_TABLE));
});

test('the island table carries no prototype', () => {
  assert.equal(Object.getPrototypeOf(ISLANDS), null);
});

test('every island matches the wiki row for name, size and flags', () => {
  for (const id of ISLAND_IDS) {
    const island = islandOf(id);
    const row = WIKI_TABLE[id];

    assert.equal(island.name, row.name);
    assert.equal(island.size, row.size);
    assert.equal(island.isCapital, row.isCapital);
    assert.equal(island.isColonized, row.isColonized);
  }
});

test('every island spawns exactly the commodities the wiki lists', () => {
  for (const id of ISLAND_IDS) {
    assert.deepEqual(islandOf(id).spawnCommodities, WIKI_TABLE[id].spawnCommodities);
  }
});

test('every spawned commodity exists in the commodity catalogue', () => {
  for (const id of ISLAND_IDS) {
    for (const commodityId of islandOf(id).spawnCommodities) {
      assert.ok(COMMODITY_IDS.includes(commodityId), commodityId);
    }
  }
});

test('alkaid is the only capital of the archipelago', () => {
  const capitals = ISLAND_IDS.filter((id) => islandOf(id).isCapital);

  assert.deepEqual(capitals, ['alkaid']);
});

test('no island record carries a pirate, crew or flag field', () => {
  for (const id of ISLAND_IDS) {
    for (const field of Object.keys(islandOf(id))) {
      assert.ok(!FORBIDDEN_FIELDS.includes(field.toLowerCase()), `${id}.${field}`);
    }
  }
});

test('asking for an unknown island throws a range error', () => {
  assert.throws(() => islandOf('sirius' as IslandId), RangeError);
});
