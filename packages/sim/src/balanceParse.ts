import type {
  Balance,
  BattleBalance,
  BootyBalance,
  BootyOverflowPolicy,
  BrigandBalance,
  DivisionBalance,
  MarketBalance,
  NpcBalance,
  ShipBalance,
  WorldBalance,
} from './balance.ts';
import type { BilgingBalance } from './puzzle/balance.ts';

type BlockReader = ReturnType<typeof readerOf>;

const OVERFLOW_POLICIES: Record<BootyOverflowPolicy, true> = {
  truncate: true,
  refuse: true,
  'spill-to-sea': true,
};

export function balanceOf(file: unknown): Balance {
  if (!isRecord(file)) throw new TypeError('balance.json must hold an object');
  return {
    bilging: bilgingBalanceOf(readerOf(file, 'bilging')),
    ship: shipBalanceOf(readerOf(file, 'ship')),
    battle: battleBalanceOf(readerOf(file, 'battle')),
    npc: npcBalanceOf(readerOf(file, 'npc')),
    brigand: brigandBalanceOf(readerOf(file, 'brigand')),
    booty: bootyBalanceOf(readerOf(file, 'booty')),
    world: worldBalanceOf(readerOf(file, 'world')),
    market: marketBalanceOf(readerOf(file, 'market')),
    division: divisionBalanceOf(readerOf(file, 'division')),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function worldBalanceOf(read: BlockReader): WorldBalance {
  return {
    startingPoe: read.integer('startingPoe'),
    encounterChancePerMille: read.integer('encounterChancePerMille'),
    encounterDifficultyWeightPerMille: read.integer('encounterDifficultyWeightPerMille'),
    pillageSpawnBonusPerMille: read.integer('pillageSpawnBonusPerMille'),
    tradeSpawnPenaltyPerMille: read.integer('tradeSpawnPenaltyPerMille'),
    brigandCrewCount: read.integer('brigandCrewCount'),
  };
}

function marketBalanceOf(read: BlockReader): MarketBalance {
  return {
    rawBasePricePoe: read.integer('rawBasePricePoe'),
    refinedBasePricePoe: read.integer('refinedBasePricePoe'),
    spawnDiscountPerMille: read.integer('spawnDiscountPerMille'),
    scarcityPremiumPerMille: read.integer('scarcityPremiumPerMille'),
    spreadPerMille: read.integer('spreadPerMille'),
    startingStockUnits: read.integer('startingStockUnits'),
    maxStockUnits: read.integer('maxStockUnits'),
  };
}

function divisionBalanceOf(read: BlockReader): DivisionBalance {
  return {
    crewCutPerMille: read.integer('crewCutPerMille'),
    playerSharePerMille: read.integer('playerSharePerMille'),
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
