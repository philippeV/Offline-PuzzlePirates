import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { BALANCE, loadBalance } from '../../packages/harness/src/index.ts';
import { canonicalJson } from '../../packages/sim/src/index.ts';

const BLOCK_KEYS: Record<string, string[]> = {
  bilging: [
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
    'crabPointsAtFullWater',
    'pufferPointsPerCell',
    'jellyPointsPerCell',
    'aboveWaterFallTicksPerCell',
    'belowWaterFallTicksPerCell',
    'inflowPerMillePerThousandTicks',
    'pumpPerMillePerThousandTicks',
    'ratingBandsPerMille',
  ],
  ship: [
    'bilgeInflowPerMillePerThousandTicks',
    'damageBilgeCoefficientPerMille',
    'carpentryBilgeSlowingPerMille',
    'wearDamagePerMillePerThousandTicks',
    'carpentryRepairPerMillePerThousandTicksAtFullDuty',
    'bilgePumpPerMillePerThousandTicksAtFullDuty',
    'bilgeSpeedCapPerMille',
    'navigationBonusMaxPerMille',
    'warGalleonRamDamageSmallMicro',
    'rumPerPiratePerThousandTicks',
  ],
  battle: [
    'movementTokenMilliPerThousandTicksAtFullDuty',
    'bilgeTokenThrottlePerMille',
    'cannonLoadMilliPerThousandTicksAtFullDuty',
    'tallRockCount',
    'smallRockCount',
    'windTileCount',
    'startingSeparationTiles',
    'startingCannonballs',
    'startingRum',
  ],
  npc: ['crewDutyOutputPerMille', 'brigandCrewDutyOutputPerMille'],
  brigand: [
    'planLookaheadPhases',
    'weightCloseDistance',
    'weightBroadsideExposure',
    'weightIncomingBroadside',
    'weightRockCollision',
    'geniusChancePerMille',
    'blunderNoisePerMille',
    'disengageAtDamagePerMille',
  ],
  booty: [
    'brigandPoeBase',
    'brigandPoePerMightMilli',
    'brigandPoeVariancePerMille',
    'brigandCargoUnitsBase',
    'chartDropChancePerMille',
    'overflowPolicy',
  ],
};

const BLOCKS = JSON.parse(canonicalJson(BALANCE)) as Record<string, Record<string, unknown>>;

const TEXT_KEYS = ['booty.overflowPolicy'];

function sourceHolding(contents: unknown): URL {
  const path = join(mkdtempSync(join(tmpdir(), 'opp-balance-')), 'balance.json');
  writeFileSync(path, JSON.stringify(contents));
  return pathToFileURL(path);
}

function fileWith(name: string, block: unknown): URL {
  return sourceHolding({ ...BLOCKS, [name]: block });
}

function fileWithout(name: string, key: string): URL {
  const block = { ...BLOCKS[name] };
  delete block[key];
  return fileWith(name, block);
}

function fileReplacing(name: string, key: string, value: unknown): URL {
  return fileWith(name, { ...BLOCKS[name], [key]: value });
}

test('the loaded balance carries every declared block and no file metadata', () => {
  assert.deepEqual(Object.keys(BALANCE).sort(), Object.keys(BLOCK_KEYS).sort());
  for (const [name, keys] of Object.entries(BLOCK_KEYS)) {
    assert.deepEqual(Object.keys(BLOCKS[name] ?? {}).sort(), [...keys].sort(), name);
  }
});

test('the loaded balance survives hashing and carries no file metadata', () => {
  assert.doesNotThrow(() => canonicalJson(BALANCE));
  assert.match(canonicalJson(BALANCE), /^\{"battle":\{/);
  assert.equal(canonicalJson(BALANCE).includes('_sources'), false);
  assert.equal(canonicalJson(BALANCE).includes('_note'), false);
});

test('every tuning value outside the declared text keys is a safe integer', () => {
  for (const [name, block] of Object.entries(BLOCKS)) {
    for (const [key, value] of Object.entries(block)) {
      if (TEXT_KEYS.includes(`${name}.${key}`)) continue;
      const entries: unknown[] = Array.isArray(value) ? value : [value];
      for (const entry of entries) {
        assert.ok(Number.isSafeInteger(entry), `${name}.${key} holds ${String(entry)}`);
      }
    }
  }
});

test('a balance file missing a required field is refused by the name of that field', () => {
  assert.throws(() => loadBalance(fileWithout('bilging', 'boardWidth')), {
    name: 'TypeError',
    message: /bilging\.boardWidth/,
  });
});

test('a balance field that is not a safe integer is refused by the name of that field', () => {
  assert.throws(
    () => loadBalance(fileReplacing('bilging', 'inflowPerMillePerThousandTicks', 0.5)),
    { name: 'TypeError', message: /bilging\.inflowPerMillePerThousandTicks/ },
  );
});

test('a balance array holding a non-integer is refused by the name of the offending entry', () => {
  assert.throws(
    () => loadBalance(fileReplacing('bilging', 'ratingBandsPerMille', [500, 'lots', 1100])),
    { name: 'TypeError', message: /bilging\.ratingBandsPerMille\[1\]/ },
  );
});

test('a fractional ship field is refused by its own key path, not the bilging one', () => {
  assert.throws(
    () => loadBalance(fileReplacing('ship', 'bilgeInflowPerMillePerThousandTicks', 27.5)),
    { name: 'TypeError', message: /^balance\.json ship\.bilgeInflowPerMillePerThousandTicks/ },
  );
});

test('a battle field holding text is refused by its own key path', () => {
  assert.throws(
    () => loadBalance(fileReplacing('battle', 'bilgeTokenThrottlePerMille', '700')),
    { name: 'TypeError', message: /^balance\.json battle\.bilgeTokenThrottlePerMille/ },
  );
});

test('a missing brigand field is refused by its own key path', () => {
  assert.throws(() => loadBalance(fileWithout('brigand', 'weightRockCollision')), {
    name: 'TypeError',
    message: /^balance\.json brigand\.weightRockCollision/,
  });
});

test('a booty overflow policy outside the declared set is refused', () => {
  assert.throws(() => loadBalance(fileReplacing('booty', 'overflowPolicy', 'jettison')), {
    name: 'TypeError',
    message: /^balance\.json booty\.overflowPolicy must hold one of truncate, refuse, spill-to-sea/,
  });
});

test('a balance file missing a whole block is refused by the name of that block', () => {
  assert.throws(() => loadBalance(sourceHolding({ _note: 'nothing here' })), {
    name: 'TypeError',
    message: /bilging/,
  });
  assert.throws(() => loadBalance(fileWith('npc', undefined)), {
    name: 'TypeError',
    message: /^balance\.json npc must hold an object/,
  });
});
