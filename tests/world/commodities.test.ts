import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COMMODITIES,
  COMMODITY_IDS,
  RUM_MASS_GRAMS_PER_UNIT,
  SMALL_CANNON_BALL_MASS_GRAMS_PER_UNIT,
  commodityOf,
  type CommodityId,
} from '../../packages/sim/src/world/commodities.ts';

const RAW_IDS: CommodityId[] = [
  'hemp',
  'iron',
  'stone',
  'sugar-cane',
  'wood',
  'sincosite',
  'lily-of-the-valley',
  'chalcocite',
  'butterfly-weed',
  'pokeweed-berries',
  'iris-root',
];

const REFINED_IDS: CommodityId[] = [
  'small-cannon-ball',
  'medium-cannon-ball',
  'large-cannon-ball',
  'swill',
  'grog',
];

test('the catalogue holds the eleven ursa raw commodities and five ship supplies', () => {
  assert.deepEqual(COMMODITY_IDS, [...RAW_IDS, ...REFINED_IDS]);
});

test('the commodity table carries no prototype', () => {
  assert.equal(Object.getPrototypeOf(COMMODITIES), null);
});

test('every raw commodity is classed raw', () => {
  for (const id of RAW_IDS) assert.equal(commodityOf(id).class, 'raw');
});

test('every refined commodity is classed refined', () => {
  for (const id of REFINED_IDS) assert.equal(commodityOf(id).class, 'refined');
});

test('every commodity mass is a positive safe integer number of grams', () => {
  for (const id of COMMODITY_IDS) {
    const commodity = commodityOf(id);

    assert.ok(Number.isSafeInteger(commodity.massGramsPerUnit), id);
    assert.ok(commodity.massGramsPerUnit > 0, id);
  }
});

test('a small cannon ball weighs the published 7.1 kilograms', () => {
  assert.equal(commodityOf('small-cannon-ball').massGramsPerUnit, 7100);
  assert.equal(SMALL_CANNON_BALL_MASS_GRAMS_PER_UNIT, 7100);
});

test('both rums weigh the published kilogram', () => {
  assert.equal(commodityOf('swill').massGramsPerUnit, RUM_MASS_GRAMS_PER_UNIT);
  assert.equal(commodityOf('grog').massGramsPerUnit, RUM_MASS_GRAMS_PER_UNIT);
});

test('every commodity is keyed by its own id and carries a name', () => {
  for (const id of COMMODITY_IDS) {
    const commodity = commodityOf(id);

    assert.equal(commodity.id, id);
    assert.notEqual(commodity.name, '');
  }
});

test('asking for an unknown commodity throws a range error', () => {
  assert.throws(() => commodityOf('fine-rum' as CommodityId), RangeError);
});
