import { readFileSync } from 'node:fs';

import type {
  Balance,
  BattleBalance,
  BilgingBalance,
  BootyBalance,
  BootyOverflowPolicy,
  BrigandBalance,
  NpcBalance,
  ShipBalance,
} from '@opp/sim';

import { isRecord } from './json.ts';

type BlockReader = ReturnType<typeof readerOf>;

const SOURCE = new URL('../../../balance.json', import.meta.url);

const OVERFLOW_POLICIES: Record<BootyOverflowPolicy, true> = {
  truncate: true,
  refuse: true,
  'spill-to-sea': true,
};

export function loadBalance(source: URL): Balance {
  const file = fileOf(source);
  return {
    bilging: bilgingBalanceOf(readerOf(file, 'bilging')),
    ship: shipBalanceOf(readerOf(file, 'ship')),
    battle: battleBalanceOf(readerOf(file, 'battle')),
    npc: npcBalanceOf(readerOf(file, 'npc')),
    brigand: brigandBalanceOf(readerOf(file, 'brigand')),
    booty: bootyBalanceOf(readerOf(file, 'booty')),
  };
}

export const BALANCE: Balance = loadBalance(SOURCE);

function fileOf(source: URL): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(source, 'utf8'));
  if (!isRecord(parsed)) throw new TypeError('balance.json must hold an object');
  return parsed;
}

function blockOf(file: Record<string, unknown>, key: string): Record<string, unknown> {
  const block = file[key];
  if (!isRecord(block)) throw new TypeError(`balance.json ${key} must hold an object`);
  return block;
}

function readerOf(file: Record<string, unknown>, name: string) {
  const block = blockOf(file, name);
  const path = (key: string): string => `${name}.${key}`;
  return {
    integer: (key: string): number => safeIntegerOf(block[key], path(key)),
    integers: (key: string): number[] => safeIntegerArrayOf(block[key], path(key)),
    policy: (key: string): BootyOverflowPolicy => overflowPolicyOf(block[key], path(key)),
  };
}

function bilgingBalanceOf(read: BlockReader): BilgingBalance {
  return {
    boardWidth: read.integer('boardWidth'),
    boardHeight: read.integer('boardHeight'),
    colourCountByStarLevel: read.integers('colourCountByStarLevel'),
    maxStarLevel: read.integer('maxStarLevel'),
    startingStarLevel: read.integer('startingStarLevel'),
    ticksPerStarStep: read.integer('ticksPerStarStep'),
    comboMultiplierByLineCount: read.integers('comboMultiplierByLineCount'),
    comboScalePerMilleByStarLevel: read.integers('comboScalePerMilleByStarLevel'),
    vegasMultiplier: read.integer('vegasMultiplier'),
    chainPointsPerCell: read.integer('chainPointsPerCell'),
    pufferSpawnPerMille: read.integer('pufferSpawnPerMille'),
    crabSpawnPerMille: read.integer('crabSpawnPerMille'),
    jellySpawnPerMille: read.integer('jellySpawnPerMille'),
    crabPointsAtFullWater: read.integer('crabPointsAtFullWater'),
    pufferPointsPerCell: read.integer('pufferPointsPerCell'),
    jellyPointsPerCell: read.integer('jellyPointsPerCell'),
    aboveWaterFallTicksPerCell: read.integer('aboveWaterFallTicksPerCell'),
    belowWaterFallTicksPerCell: read.integer('belowWaterFallTicksPerCell'),
    inflowPerMillePerThousandTicks: read.integer('inflowPerMillePerThousandTicks'),
    pumpPerMillePerThousandTicks: read.integer('pumpPerMillePerThousandTicks'),
    ratingBandsPerMille: read.integers('ratingBandsPerMille'),
  };
}

function shipBalanceOf(read: BlockReader): ShipBalance {
  return {
    bilgeInflowPerMillePerThousandTicks: read.integer('bilgeInflowPerMillePerThousandTicks'),
    damageBilgeCoefficientPerMille: read.integer('damageBilgeCoefficientPerMille'),
    carpentryBilgeSlowingPerMille: read.integer('carpentryBilgeSlowingPerMille'),
    wearDamagePerMillePerThousandTicks: read.integer('wearDamagePerMillePerThousandTicks'),
    carpentryRepairPerMillePerThousandTicksAtFullDuty: read.integer(
      'carpentryRepairPerMillePerThousandTicksAtFullDuty',
    ),
    bilgePumpPerMillePerThousandTicksAtFullDuty: read.integer(
      'bilgePumpPerMillePerThousandTicksAtFullDuty',
    ),
    bilgeSpeedCapPerMille: read.integer('bilgeSpeedCapPerMille'),
    navigationBonusMaxPerMille: read.integer('navigationBonusMaxPerMille'),
    warGalleonRamDamageSmallMicro: read.integer('warGalleonRamDamageSmallMicro'),
    rumPerPiratePerThousandTicks: read.integer('rumPerPiratePerThousandTicks'),
  };
}

function battleBalanceOf(read: BlockReader): BattleBalance {
  return {
    movementTokenMilliPerThousandTicksAtFullDuty: read.integer(
      'movementTokenMilliPerThousandTicksAtFullDuty',
    ),
    bilgeTokenThrottlePerMille: read.integer('bilgeTokenThrottlePerMille'),
    cannonLoadMilliPerThousandTicksAtFullDuty: read.integer(
      'cannonLoadMilliPerThousandTicksAtFullDuty',
    ),
    tallRockCount: read.integer('tallRockCount'),
    smallRockCount: read.integer('smallRockCount'),
    windTileCount: read.integer('windTileCount'),
    startingSeparationTiles: read.integer('startingSeparationTiles'),
    startingCannonballs: read.integer('startingCannonballs'),
    startingRum: read.integer('startingRum'),
  };
}

function npcBalanceOf(read: BlockReader): NpcBalance {
  return {
    crewDutyOutputPerMille: read.integer('crewDutyOutputPerMille'),
    brigandCrewDutyOutputPerMille: read.integer('brigandCrewDutyOutputPerMille'),
  };
}

function brigandBalanceOf(read: BlockReader): BrigandBalance {
  return {
    planLookaheadPhases: read.integer('planLookaheadPhases'),
    weightCloseDistance: read.integer('weightCloseDistance'),
    weightBroadsideExposure: read.integer('weightBroadsideExposure'),
    weightIncomingBroadside: read.integer('weightIncomingBroadside'),
    weightRockCollision: read.integer('weightRockCollision'),
    geniusChancePerMille: read.integer('geniusChancePerMille'),
    blunderNoisePerMille: read.integer('blunderNoisePerMille'),
    disengageAtDamagePerMille: read.integer('disengageAtDamagePerMille'),
  };
}

function bootyBalanceOf(read: BlockReader): BootyBalance {
  return {
    brigandPoeBase: read.integer('brigandPoeBase'),
    brigandPoePerMightMilli: read.integer('brigandPoePerMightMilli'),
    brigandPoeVariancePerMille: read.integer('brigandPoeVariancePerMille'),
    brigandCargoUnitsBase: read.integer('brigandCargoUnitsBase'),
    chartDropChancePerMille: read.integer('chartDropChancePerMille'),
    overflowPolicy: read.policy('overflowPolicy'),
  };
}

function safeIntegerArrayOf(value: unknown, key: string): number[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`balance.json ${key} must hold an array of safe integers`);
  }
  return value.map((entry: unknown, index) => safeIntegerOf(entry, `${key}[${index}]`));
}

function safeIntegerOf(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`balance.json ${key} must hold a safe integer`);
  }
  return value;
}

function overflowPolicyOf(value: unknown, key: string): BootyOverflowPolicy {
  const names = Object.keys(OVERFLOW_POLICIES);
  if (typeof value !== 'string' || !names.includes(value)) {
    throw new TypeError(`balance.json ${key} must hold one of ${names.join(', ')}`);
  }
  return value as BootyOverflowPolicy;
}
