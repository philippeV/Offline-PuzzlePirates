import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PER_MILLE,
  comboMultiplierOf,
  comboScoreOf,
  crabScoreOf,
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

const PUBLISHED_STAR_LEVEL = 7;
const NOVICE_STAR_LEVEL = 0;
const BINGO = [3, 3, 3];
const SEA_DONKEY = [3, 3, 3, 3];

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

test('the scorer reproduces every row of the published bilging score table at seven stars', () => {
  for (const row of PUBLISHED_TABLE) {
    const scored = comboScoreOf(row.lineLengths, BALANCE.bilging, PUBLISHED_STAR_LEVEL);
    assert.equal(scored, row.score, row.clear);
  }
});

test('the same geometry scores strictly lower at a low star level', () => {
  for (const row of PUBLISHED_TABLE) {
    const novice = comboScoreOf(row.lineLengths, BALANCE.bilging, NOVICE_STAR_LEVEL);
    assert.ok(novice <= row.score, row.clear);
  }

  assert.equal(comboScoreOf([3, 3], BALANCE.bilging, NOVICE_STAR_LEVEL), 6);
  assert.equal(comboScoreOf(BINGO, BALANCE.bilging, NOVICE_STAR_LEVEL), 9);
  assert.ok(comboScoreOf(BINGO, BALANCE.bilging, NOVICE_STAR_LEVEL) < 27);
});

test('a single line keeps its published multiplier of one at every star level', () => {
  for (let starLevel = 0; starLevel <= PUBLISHED_STAR_LEVEL; starLevel += 1) {
    assert.equal(comboScoreOf([3], BALANCE.bilging, starLevel), 3, `star ${starLevel}`);
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
  const seaDonkey = comboMultiplierOf([3, 3, 3, 4], BALANCE.bilging, PUBLISHED_STAR_LEVEL);
  const vegas = comboMultiplierOf([3, 3, 3, 5], BALANCE.bilging, PUBLISHED_STAR_LEVEL);

  assert.equal(seaDonkey, 4);
  assert.equal(vegas, BALANCE.bilging.vegasMultiplier);
  assert.equal(comboScoreOf([3, 3, 3, 5], BALANCE.bilging, PUBLISHED_STAR_LEVEL), 16 * vegas);
  assert.equal(comboMultiplierOf([3, 3, 3, 3, 3], BALANCE.bilging, PUBLISHED_STAR_LEVEL), 6);
});

test('two crabs freed at full water score between a bingo and a sea donkey', () => {
  const twoCrabs = crabScoreOf(2, PER_MILLE, BALANCE.bilging);
  const bingo = comboScoreOf(BINGO, BALANCE.bilging, PUBLISHED_STAR_LEVEL);
  const seaDonkey = comboScoreOf(SEA_DONKEY, BALANCE.bilging, PUBLISHED_STAR_LEVEL);

  assert.equal(bingo, 27);
  assert.equal(seaDonkey, 48);
  assert.equal(twoCrabs, 36);
  assert.ok(twoCrabs > bingo && twoCrabs < seaDonkey);
});

test('the crab bonus scales with the water height and with crabs freed together', () => {
  assert.equal(crabScoreOf(1, PER_MILLE, BALANCE.bilging), 9);
  assert.equal(crabScoreOf(2, PER_MILLE / 2, BALANCE.bilging), 18);
  assert.equal(crabScoreOf(2, 0, BALANCE.bilging), 0);
  assert.equal(crabScoreOf(0, PER_MILLE, BALANCE.bilging), 0);
});
