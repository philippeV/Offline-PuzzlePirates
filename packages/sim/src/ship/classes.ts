export type CannonSize = 'small' | 'medium' | 'large';
export type RamSizeClass = 'small' | 'medium' | 'large' | 'grand';

export type ShipClassId =
  | 'sloop'
  | 'cutter'
  | 'dhow'
  | 'fanchuan'
  | 'longship'
  | 'baghlah'
  | 'junk'
  | 'merchant-brig'
  | 'war-brig'
  | 'merchant-galleon'
  | 'war-galleon'
  | 'xebec'
  | 'war-frigate'
  | 'grand-frigate';

export interface ShipClass {
  id: ShipClassId;
  name: string;
  pirateCap: number;
  sailStations: number;
  carpStations: number;
  bilgeStations: number;
  gunStations: number;
  cannonSize: CannonSize;
  shots: number;
  holdMassKg: number;
  holdVolumeL: number;
  movesPerTurn: number;
  shotsPerSidePerPhase: number;
  ramSizeClass: RamSizeClass;
  ramDamageSmallMicro: number;
  maxSfDamageSmallMicro: number;
  fullDamageSmallMicro: number;
  rockDamageSmallMicro: number;
  minSpeedSecondsPerLP: number;
  maxSpeedSecondsPerLP: number;
  influenceDiameter: number;
  swabbieStaffing: number;
  swabbieCutoff: number;
  minCarp: number;
  minBilge: number;
}

export const MIN_SPEED_SECONDS_PER_LP = 300;
export const UNPUBLISHED_RAM_DAMAGE_SMALL_MICRO = 0;

export const BALL_WEIGHT_SMALL_MICRO = 1000000;
export const BALL_WEIGHT_MEDIUM_MICRO = 1500000;
export const BALL_WEIGHT_LARGE_MICRO = 2000000;

export const SHIP_CLASSES: Record<ShipClassId, ShipClass> = {
  'sloop': { id: 'sloop', name: 'Sloop', pirateCap: 7, sailStations: 3, carpStations: 2, bilgeStations: 2, gunStations: 1, cannonSize: 'small', shots: 4, holdMassKg: 13500, holdVolumeL: 20250, movesPerTurn: 4, shotsPerSidePerPhase: 1, ramSizeClass: 'small', ramDamageSmallMicro: 500000, maxSfDamageSmallMicro: 6000000, fullDamageSmallMicro: 10000000, rockDamageSmallMicro: 500000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 60, influenceDiameter: 1, swabbieStaffing: 5, swabbieCutoff: 6, minCarp: 1, minBilge: 1 },
  'cutter': { id: 'cutter', name: 'Cutter', pirateCap: 12, sailStations: 5, carpStations: 3, bilgeStations: 2, gunStations: 2, cannonSize: 'small', shots: 8, holdMassKg: 40500, holdVolumeL: 60750, movesPerTurn: 4, shotsPerSidePerPhase: 1, ramSizeClass: 'small', ramDamageSmallMicro: 500000, maxSfDamageSmallMicro: 7500000, fullDamageSmallMicro: 12000000, rockDamageSmallMicro: 625000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 60, influenceDiameter: 2, swabbieStaffing: 10, swabbieCutoff: 11, minCarp: 1, minBilge: 1 },
  'dhow': { id: 'dhow', name: 'Dhow', pirateCap: 12, sailStations: 5, carpStations: 3, bilgeStations: 2, gunStations: 1, cannonSize: 'medium', shots: 4, holdMassKg: 13500, holdVolumeL: 20250, movesPerTurn: 4, shotsPerSidePerPhase: 1, ramSizeClass: 'small', ramDamageSmallMicro: 500000, maxSfDamageSmallMicro: 7500000, fullDamageSmallMicro: 12000000, rockDamageSmallMicro: 625000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 60, influenceDiameter: 2, swabbieStaffing: 10, swabbieCutoff: 11, minCarp: 1, minBilge: 1 },
  'fanchuan': { id: 'fanchuan', name: 'Fanchuan', pirateCap: 12, sailStations: 5, carpStations: 3, bilgeStations: 2, gunStations: 1, cannonSize: 'large', shots: 4, holdMassKg: 13500, holdVolumeL: 20250, movesPerTurn: 3, shotsPerSidePerPhase: 1, ramSizeClass: 'small', ramDamageSmallMicro: 500000, maxSfDamageSmallMicro: 7875000, fullDamageSmallMicro: 13125000, rockDamageSmallMicro: 656250, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 60, influenceDiameter: 2, swabbieStaffing: 10, swabbieCutoff: 11, minCarp: 1, minBilge: 1 },
  'longship': { id: 'longship', name: 'Longship', pirateCap: 15, sailStations: 5, carpStations: 3, bilgeStations: 3, gunStations: 3, cannonSize: 'small', shots: 12, holdMassKg: 13500, holdVolumeL: 20250, movesPerTurn: 4, shotsPerSidePerPhase: 2, ramSizeClass: 'medium', ramDamageSmallMicro: 500000, maxSfDamageSmallMicro: 9000000, fullDamageSmallMicro: 15000000, rockDamageSmallMicro: 750000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 75, influenceDiameter: 2, swabbieStaffing: 13, swabbieCutoff: 14, minCarp: 2, minBilge: 1 },
  'baghlah': { id: 'baghlah', name: 'Baghlah', pirateCap: 18, sailStations: 6, carpStations: 4, bilgeStations: 4, gunStations: 3, cannonSize: 'medium', shots: 12, holdMassKg: 18000, holdVolumeL: 27000, movesPerTurn: 3, shotsPerSidePerPhase: 2, ramSizeClass: 'medium', ramDamageSmallMicro: 1000000, maxSfDamageSmallMicro: 12000000, fullDamageSmallMicro: 20000000, rockDamageSmallMicro: 1000000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 75, influenceDiameter: 4, swabbieStaffing: 16, swabbieCutoff: 17, minCarp: 2, minBilge: 1 },
  'junk': { id: 'junk', name: 'Junk', pirateCap: 18, sailStations: 6, carpStations: 4, bilgeStations: 4, gunStations: 3, cannonSize: 'large', shots: 12, holdMassKg: 18000, holdVolumeL: 27000, movesPerTurn: 3, shotsPerSidePerPhase: 1, ramSizeClass: 'medium', ramDamageSmallMicro: 1500000, maxSfDamageSmallMicro: 15000000, fullDamageSmallMicro: 25000000, rockDamageSmallMicro: 1250000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 85, influenceDiameter: 4, swabbieStaffing: 16, swabbieCutoff: 17, minCarp: 2, minBilge: 2 },
  'merchant-brig': { id: 'merchant-brig', name: 'Merchant brig', pirateCap: 20, sailStations: 6, carpStations: 9, bilgeStations: 6, gunStations: 2, cannonSize: 'medium', shots: 8, holdMassKg: 90000, holdVolumeL: 135000, movesPerTurn: 3, shotsPerSidePerPhase: 1, ramSizeClass: 'medium', ramDamageSmallMicro: 1000000, maxSfDamageSmallMicro: 12000000, fullDamageSmallMicro: 20000000, rockDamageSmallMicro: 1000000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 75, influenceDiameter: 4, swabbieStaffing: 18, swabbieCutoff: 19, minCarp: 2, minBilge: 1 },
  'war-brig': { id: 'war-brig', name: 'War brig', pirateCap: 30, sailStations: 9, carpStations: 6, bilgeStations: 4, gunStations: 4, cannonSize: 'medium', shots: 16, holdMassKg: 54000, holdVolumeL: 81000, movesPerTurn: 3, shotsPerSidePerPhase: 2, ramSizeClass: 'medium', ramDamageSmallMicro: 2000000, maxSfDamageSmallMicro: 15000000, fullDamageSmallMicro: 25000000, rockDamageSmallMicro: 1250000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 75, influenceDiameter: 6, swabbieStaffing: 22, swabbieCutoff: 23, minCarp: 2, minBilge: 1 },
  'merchant-galleon': { id: 'merchant-galleon', name: 'Merchant galleon', pirateCap: 30, sailStations: 9, carpStations: 14, bilgeStations: 14, gunStations: 3, cannonSize: 'large', shots: 12, holdMassKg: 270000, holdVolumeL: 405000, movesPerTurn: 3, shotsPerSidePerPhase: 1, ramSizeClass: 'large', ramDamageSmallMicro: 2500000, maxSfDamageSmallMicro: 18000000, fullDamageSmallMicro: 30000000, rockDamageSmallMicro: 1500000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 100, influenceDiameter: 6, swabbieStaffing: 28, swabbieCutoff: 29, minCarp: 4, minBilge: 3 },
  'war-galleon': { id: 'war-galleon', name: 'War galleon', pirateCap: 40, sailStations: 12, carpStations: 8, bilgeStations: 7, gunStations: 6, cannonSize: 'large', shots: 24, holdMassKg: 90000, holdVolumeL: 135000, movesPerTurn: 3, shotsPerSidePerPhase: 2, ramSizeClass: 'large', ramDamageSmallMicro: UNPUBLISHED_RAM_DAMAGE_SMALL_MICRO, maxSfDamageSmallMicro: 15000000, fullDamageSmallMicro: 25000000, rockDamageSmallMicro: 1250000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 100, influenceDiameter: 6, swabbieStaffing: 32, swabbieCutoff: 33, minCarp: 2, minBilge: 2 },
  'xebec': { id: 'xebec', name: 'Xebec', pirateCap: 45, sailStations: 14, carpStations: 9, bilgeStations: 8, gunStations: 6, cannonSize: 'medium', shots: 24, holdMassKg: 121500, holdVolumeL: 182250, movesPerTurn: 3, shotsPerSidePerPhase: 2, ramSizeClass: 'large', ramDamageSmallMicro: 2500000, maxSfDamageSmallMicro: 21000000, fullDamageSmallMicro: 35000000, rockDamageSmallMicro: 1750000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 100, influenceDiameter: 6, swabbieStaffing: 36, swabbieCutoff: 37, minCarp: 4, minBilge: 3 },
  'war-frigate': { id: 'war-frigate', name: 'War frigate', pirateCap: 75, sailStations: 18, carpStations: 18, bilgeStations: 12, gunStations: 6, cannonSize: 'large', shots: 24, holdMassKg: 216000, holdVolumeL: 324000, movesPerTurn: 3, shotsPerSidePerPhase: 2, ramSizeClass: 'large', ramDamageSmallMicro: 3000000, maxSfDamageSmallMicro: 30000000, fullDamageSmallMicro: 50000000, rockDamageSmallMicro: 2500000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 100, influenceDiameter: 8, swabbieStaffing: 54, swabbieCutoff: 55, minCarp: 6, minBilge: 3 },
  'grand-frigate': { id: 'grand-frigate', name: 'Grand frigate', pirateCap: 159, sailStations: 30, carpStations: 24, bilgeStations: 16, gunStations: 6, cannonSize: 'large', shots: 24, holdMassKg: 540000, holdVolumeL: 810000, movesPerTurn: 3, shotsPerSidePerPhase: 2, ramSizeClass: 'grand', ramDamageSmallMicro: 4000000, maxSfDamageSmallMicro: 36000000, fullDamageSmallMicro: 60000000, rockDamageSmallMicro: 3000000, minSpeedSecondsPerLP: MIN_SPEED_SECONDS_PER_LP, maxSpeedSecondsPerLP: 100, influenceDiameter: 10, swabbieStaffing: 75, swabbieCutoff: 76, minCarp: 12, minBilge: 4 },
};

export const SHIP_CLASS_IDS = Object.keys(SHIP_CLASSES) as ShipClassId[];

const RAM_SIZE_RANKS: Record<RamSizeClass, number> = { small: 0, medium: 1, large: 2, grand: 3 };

const BALL_WEIGHTS_MICRO: Record<CannonSize, number> = {
  small: BALL_WEIGHT_SMALL_MICRO,
  medium: BALL_WEIGHT_MEDIUM_MICRO,
  large: BALL_WEIGHT_LARGE_MICRO,
};

export function shipClassOf(id: ShipClassId): ShipClass {
  return SHIP_CLASSES[id];
}

export function ramSizeRankOf(size: RamSizeClass): number {
  return RAM_SIZE_RANKS[size];
}

export function ballWeightMicroOf(size: CannonSize): number {
  return BALL_WEIGHTS_MICRO[size];
}
