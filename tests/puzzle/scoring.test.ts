import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  comboMultiplierOf,
  comboScoreOf,
  movesForEfficiencyMilli,
} from '../../packages/sim/src/index.ts';
import { BALANCE } from './fixtures.ts';

interface PublishedRow {
  clear: string;
  lineLengths: number[];
  score: number;
  movesMilli: number[];
}

interface Efficiency {
  numerator: number;
  denominator: number;
}

const EFFICIENCIES: Efficiency[] = [
  { numerator: 1, denominator: 1 },
  { numerator: 4, denominator: 3 },
  { numerator: 3, denominator: 2 },
  { numerator: 5, denominator: 3 },
];

const PUBLISHED_TABLE: PublishedRow[] = [
  { clear: '3', lineLengths: [3], score: 3, movesMilli: [1000, 750, 667, 600] },
  { clear: '4', lineLengths: [4], score: 5, movesMilli: [1667, 1250, 1111, 1000] },
  { clear: '5', lineLengths: [5], score: 7, movesMilli: [2333, 1750, 1556, 1400] },
  { clear: '3x3', lineLengths: [3, 3], score: 12, movesMilli: [4000, 3000, 2667, 2400] },
  { clear: '3x4', lineLengths: [3, 4], score: 16, movesMilli: [5333, 4000, 3556, 3200] },
  { clear: '3x5', lineLengths: [3, 5], score: 20, movesMilli: [6667, 5000, 4444, 4000] },
  { clear: '4x4', lineLengths: [4, 4], score: 20, movesMilli: [6667, 5000, 4444, 4000] },
  { clear: '4x5', lineLengths: [4, 5], score: 24, movesMilli: [8000, 6000, 5333, 4800] },
  { clear: '5x5', lineLengths: [5, 5], score: 28, movesMilli: [9333, 7000, 6222, 5600] },
  { clear: '3x3x3', lineLengths: [3, 3, 3], score: 27, movesMilli: [9000, 6750, 6000, 5400] },
  { clear: '3x3x4', lineLengths: [3, 3, 4], score: 33, movesMilli: [11000, 8250, 7333, 6600] },
  { clear: '3x3x5', lineLengths: [3, 3, 5], score: 39, movesMilli: [13000, 9750, 8667, 7800] },
  { clear: '3x4x4', lineLengths: [3, 4, 4], score: 39, movesMilli: [13000, 9750, 8667, 7800] },
  { clear: '3x4x5', lineLengths: [3, 4, 5], score: 45, movesMilli: [15000, 11250, 10000, 9000] },
  { clear: '3x5x5', lineLengths: [3, 5, 5], score: 51, movesMilli: [17000, 12750, 11333, 10200] },
];

test('the scorer reproduces every row of the published bilging score table', () => {
  for (const row of PUBLISHED_TABLE) {
    assert.equal(comboScoreOf(row.lineLengths, BALANCE.bilging), row.score, row.clear);
  }
});

test('the published efficiency matrix follows moves for an efficiency of score over three', () => {
  for (const row of PUBLISHED_TABLE) {
    const computed = EFFICIENCIES.map((efficiency) =>
      movesForEfficiencyMilli(row.score, efficiency.numerator, efficiency.denominator),
    );
    assert.deepEqual(computed, row.movesMilli, row.clear);
  }
});

test('four lines including a five scores the vegas multiplier', () => {
  const seaDonkey = comboMultiplierOf([3, 3, 3, 4], BALANCE.bilging);
  const vegas = comboMultiplierOf([3, 3, 3, 5], BALANCE.bilging);

  assert.equal(seaDonkey, 4);
  assert.equal(vegas, BALANCE.bilging.vegasMultiplier);
  assert.equal(comboScoreOf([3, 3, 3, 5], BALANCE.bilging), 16 * vegas);
  assert.equal(comboMultiplierOf([3, 3, 3, 3, 3], BALANCE.bilging), 6);
});
