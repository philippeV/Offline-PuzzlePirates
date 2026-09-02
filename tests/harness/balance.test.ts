import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { BALANCE, loadPuzzleBalance } from '../../packages/harness/src/index.ts';
import { canonicalJson } from '../../packages/sim/src/index.ts';

const BILGING_KEYS = [
  'boardWidth',
  'boardHeight',
  'colourCountByStarLevel',
  'maxStarLevel',
  'startingStarLevel',
  'ticksPerStarStep',
  'comboMultiplierByLineCount',
  'comboScalePerMilleByStarLevel',
  'vegasMultiplier',
  'chainPointsPerCell',
  'pufferSpawnPerMille',
  'crabSpawnPerMille',
  'jellySpawnPerMille',
  'tokenSpawnPerMille',
  'crabPointsAtFullWater',
  'pufferPointsPerCell',
  'jellyPointsPerCell',
  'aboveWaterFallTicksPerCell',
  'belowWaterFallTicksPerCell',
  'inflowPerMillePerThousandTicks',
  'pumpPerMillePerThousandTicks',
  'ratingBandsPerMille',
];

function sourceHolding(contents: unknown): URL {
  const path = join(mkdtempSync(join(tmpdir(), 'opp-balance-')), 'balance.json');
  writeFileSync(path, JSON.stringify(contents));
  return pathToFileURL(path);
}

function bilgingWithout(key: string): Record<string, unknown> {
  const block: Record<string, unknown> = { ...BALANCE.bilging };
  delete block[key];
  return block;
}

test('the loaded balance carries the declared bilging block and no file metadata', () => {
  assert.deepEqual(Object.keys(BALANCE), ['bilging']);
  assert.deepEqual(Object.keys(BALANCE.bilging).sort(), [...BILGING_KEYS].sort());
  assert.doesNotThrow(() => canonicalJson(BALANCE));
});

test('the loaded balance holds safe integers only, so it survives hashing', () => {
  assert.match(canonicalJson(BALANCE), /^\{"bilging":\{/);
  assert.equal(canonicalJson(BALANCE).includes('_sources'), false);
  assert.equal(canonicalJson(BALANCE).includes('_note'), false);
});

test('a balance file missing a required field is refused by the name of that field', () => {
  assert.throws(() => loadPuzzleBalance(sourceHolding({ bilging: bilgingWithout('boardWidth') })), {
    name: 'TypeError',
    message: /bilging\.boardWidth/,
  });
});

test('a balance field that is not a safe integer is refused by the name of that field', () => {
  const fractional = { ...BALANCE.bilging, inflowPerMillePerThousandTicks: 0.5 };

  assert.throws(() => loadPuzzleBalance(sourceHolding({ bilging: fractional })), {
    name: 'TypeError',
    message: /bilging\.inflowPerMillePerThousandTicks/,
  });
});

test('a balance array holding a non-integer is refused by the name of the offending entry', () => {
  const ragged = { ...BALANCE.bilging, ratingBandsPerMille: [500, 'lots', 1100] };

  assert.throws(() => loadPuzzleBalance(sourceHolding({ bilging: ragged })), {
    name: 'TypeError',
    message: /bilging\.ratingBandsPerMille\[1\]/,
  });
});

test('a balance file with no bilging block is refused', () => {
  assert.throws(() => loadPuzzleBalance(sourceHolding({ _note: 'nothing here' })), {
    name: 'TypeError',
    message: /bilging/,
  });
});
