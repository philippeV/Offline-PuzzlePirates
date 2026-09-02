import type { PuzzleBalance } from './puzzle/balance.ts';

export type BootyOverflowPolicy = 'truncate' | 'refuse' | 'spill-to-sea';

export const BOOTY_OVERFLOW_POLICIES: readonly BootyOverflowPolicy[] = [
  'truncate',
  'refuse',
  'spill-to-sea',
];

export interface ShipBalance {
  bilgeInflowPerMillePerThousandTicks: number;
  damageBilgeCoefficientPerMille: number;
  carpentryBilgeSlowingPerMille: number;
  wearDamagePerMillePerThousandTicks: number;
  carpentryRepairPerMillePerThousandTicksAtFullDuty: number;
  bilgePumpPerMillePerThousandTicksAtFullDuty: number;
  bilgeSpeedCapPerMille: number;
  navigationBonusMaxPerMille: number;
  warGalleonRamDamageSmallMicro: number;
  rumPerPiratePerThousandTicks: number;
}

export interface BattleBalance {
  movementTokenMilliPerThousandTicksAtFullDuty: number;
  bilgeTokenThrottlePerMille: number;
  cannonLoadMilliPerThousandTicksAtFullDuty: number;
  tallRockCount: number;
  smallRockCount: number;
  windTileCount: number;
  startingSeparationTiles: number;
  startingCannonballs: number;
  startingRum: number;
}

export interface NpcBalance {
  crewDutyOutputPerMille: number;
  brigandCrewDutyOutputPerMille: number;
}

export interface BrigandBalance {
  planLookaheadPhases: number;
  weightCloseDistance: number;
  weightBroadsideExposure: number;
  weightIncomingBroadside: number;
  weightRockCollision: number;
  geniusChancePerMille: number;
  blunderNoisePerMille: number;
  disengageAtDamagePerMille: number;
}

export interface BootyBalance {
  brigandPoeBase: number;
  brigandPoePerMightMilli: number;
  brigandPoeVariancePerMille: number;
  brigandCargoUnitsBase: number;
  chartDropChancePerMille: number;
  overflowPolicy: BootyOverflowPolicy;
}

export interface Balance extends PuzzleBalance {
  ship: ShipBalance;
  battle: BattleBalance;
  npc: NpcBalance;
  brigand: BrigandBalance;
  booty: BootyBalance;
}
