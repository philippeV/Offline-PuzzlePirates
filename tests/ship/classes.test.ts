import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BALL_WEIGHT_LARGE_MICRO,
  BALL_WEIGHT_MEDIUM_MICRO,
  BALL_WEIGHT_SMALL_MICRO,
  MIN_SPEED_SECONDS_PER_LP,
  SHIP_CLASSES,
  SHIP_CLASS_IDS,
  UNPUBLISHED_RAM_DAMAGE_SMALL_MICRO,
  ballWeightMicroOf,
  ramSizeRankOf,
  shipClassOf,
  type RamSizeClass,
  type ShipClassId,
} from '../../packages/sim/src/ship/classes.ts';

type ByClass<T> = Record<ShipClassId, T>;

interface CapacityRow {
  pirates: number;
  sails: number;
  carp: number;
  bilge: number;
  guns: number;
  gunSize: string;
  shots: number;
  massKg: number;
  volumeL: number;
}

interface BattleRow {
  influenceDiameter: number;
  maxCrew: number;
  movesPerTurn: number;
  shotsPerSide: number;
  cannonSize: string;
  sinkingDamageSmallMicro: number;
}

interface SpeedRow {
  maxSpeedSecondsPerLP: number;
  ramSizeClass: RamSizeClass;
}

interface SwabbieRow {
  swabbies: number;
  cutoff: number;
  minCarp: number;
  minBilge: number;
}

interface ShotColumns {
  small: number;
  medium: number;
  large: number;
}

const PUBLISHED_IDS: ShipClassId[] = [
  'sloop',
  'cutter',
  'dhow',
  'fanchuan',
  'longship',
  'baghlah',
  'junk',
  'merchant-brig',
  'war-brig',
  'merchant-galleon',
  'war-galleon',
  'xebec',
  'war-frigate',
  'grand-frigate',
];

const CAPACITY: ByClass<CapacityRow> = {
  'sloop': { pirates: 7, sails: 3, carp: 2, bilge: 2, guns: 1, gunSize: 'small', shots: 4, massKg: 13500, volumeL: 20250 },
  'cutter': { pirates: 12, sails: 5, carp: 3, bilge: 2, guns: 2, gunSize: 'small', shots: 8, massKg: 40500, volumeL: 60750 },
  'dhow': { pirates: 12, sails: 5, carp: 3, bilge: 2, guns: 1, gunSize: 'medium', shots: 4, massKg: 13500, volumeL: 20250 },
  'fanchuan': { pirates: 12, sails: 5, carp: 3, bilge: 2, guns: 1, gunSize: 'large', shots: 4, massKg: 13500, volumeL: 20250 },
  'longship': { pirates: 15, sails: 5, carp: 3, bilge: 3, guns: 3, gunSize: 'small', shots: 12, massKg: 13500, volumeL: 20250 },
  'baghlah': { pirates: 18, sails: 6, carp: 4, bilge: 4, guns: 3, gunSize: 'medium', shots: 12, massKg: 18000, volumeL: 27000 },
  'junk': { pirates: 18, sails: 6, carp: 4, bilge: 4, guns: 3, gunSize: 'large', shots: 12, massKg: 18000, volumeL: 27000 },
  'merchant-brig': { pirates: 20, sails: 6, carp: 9, bilge: 6, guns: 2, gunSize: 'medium', shots: 8, massKg: 90000, volumeL: 135000 },
  'war-brig': { pirates: 30, sails: 9, carp: 6, bilge: 4, guns: 4, gunSize: 'medium', shots: 16, massKg: 54000, volumeL: 81000 },
  'merchant-galleon': { pirates: 30, sails: 9, carp: 14, bilge: 14, guns: 3, gunSize: 'large', shots: 12, massKg: 270000, volumeL: 405000 },
  'war-galleon': { pirates: 40, sails: 12, carp: 8, bilge: 7, guns: 6, gunSize: 'large', shots: 24, massKg: 90000, volumeL: 135000 },
  'xebec': { pirates: 45, sails: 14, carp: 9, bilge: 8, guns: 6, gunSize: 'medium', shots: 24, massKg: 121500, volumeL: 182250 },
  'war-frigate': { pirates: 75, sails: 18, carp: 18, bilge: 12, guns: 6, gunSize: 'large', shots: 24, massKg: 216000, volumeL: 324000 },
  'grand-frigate': { pirates: 159, sails: 30, carp: 24, bilge: 16, guns: 6, gunSize: 'large', shots: 24, massKg: 540000, volumeL: 810000 },
};

const BATTLE: ByClass<BattleRow> = {
  'sloop': { influenceDiameter: 1, maxCrew: 7, movesPerTurn: 4, shotsPerSide: 1, cannonSize: 'small', sinkingDamageSmallMicro: 10000000 },
  'cutter': { influenceDiameter: 2, maxCrew: 12, movesPerTurn: 4, shotsPerSide: 1, cannonSize: 'small', sinkingDamageSmallMicro: 12000000 },
  'dhow': { influenceDiameter: 2, maxCrew: 12, movesPerTurn: 4, shotsPerSide: 1, cannonSize: 'medium', sinkingDamageSmallMicro: 12000000 },
  'fanchuan': { influenceDiameter: 2, maxCrew: 12, movesPerTurn: 3, shotsPerSide: 1, cannonSize: 'large', sinkingDamageSmallMicro: 13125000 },
  'longship': { influenceDiameter: 2, maxCrew: 15, movesPerTurn: 4, shotsPerSide: 2, cannonSize: 'small', sinkingDamageSmallMicro: 15000000 },
  'baghlah': { influenceDiameter: 4, maxCrew: 18, movesPerTurn: 3, shotsPerSide: 2, cannonSize: 'medium', sinkingDamageSmallMicro: 20000000 },
  'junk': { influenceDiameter: 4, maxCrew: 18, movesPerTurn: 3, shotsPerSide: 1, cannonSize: 'large', sinkingDamageSmallMicro: 25000000 },
  'merchant-brig': { influenceDiameter: 4, maxCrew: 20, movesPerTurn: 3, shotsPerSide: 1, cannonSize: 'medium', sinkingDamageSmallMicro: 20000000 },
  'war-brig': { influenceDiameter: 6, maxCrew: 30, movesPerTurn: 3, shotsPerSide: 2, cannonSize: 'medium', sinkingDamageSmallMicro: 25000000 },
  'merchant-galleon': { influenceDiameter: 6, maxCrew: 30, movesPerTurn: 3, shotsPerSide: 1, cannonSize: 'large', sinkingDamageSmallMicro: 30000000 },
  'war-galleon': { influenceDiameter: 6, maxCrew: 40, movesPerTurn: 3, shotsPerSide: 2, cannonSize: 'large', sinkingDamageSmallMicro: 25000000 },
  'xebec': { influenceDiameter: 6, maxCrew: 45, movesPerTurn: 3, shotsPerSide: 2, cannonSize: 'medium', sinkingDamageSmallMicro: 35000000 },
  'war-frigate': { influenceDiameter: 8, maxCrew: 75, movesPerTurn: 3, shotsPerSide: 2, cannonSize: 'large', sinkingDamageSmallMicro: 50000000 },
  'grand-frigate': { influenceDiameter: 10, maxCrew: 159, movesPerTurn: 3, shotsPerSide: 2, cannonSize: 'large', sinkingDamageSmallMicro: 60000000 },
};

const SPEED: ByClass<SpeedRow> = {
  'sloop': { maxSpeedSecondsPerLP: 60, ramSizeClass: 'small' },
  'cutter': { maxSpeedSecondsPerLP: 60, ramSizeClass: 'small' },
  'dhow': { maxSpeedSecondsPerLP: 60, ramSizeClass: 'small' },
  'fanchuan': { maxSpeedSecondsPerLP: 60, ramSizeClass: 'small' },
  'longship': { maxSpeedSecondsPerLP: 75, ramSizeClass: 'medium' },
  'baghlah': { maxSpeedSecondsPerLP: 75, ramSizeClass: 'medium' },
  'junk': { maxSpeedSecondsPerLP: 85, ramSizeClass: 'medium' },
  'merchant-brig': { maxSpeedSecondsPerLP: 75, ramSizeClass: 'medium' },
  'war-brig': { maxSpeedSecondsPerLP: 75, ramSizeClass: 'medium' },
  'merchant-galleon': { maxSpeedSecondsPerLP: 100, ramSizeClass: 'large' },
  'war-galleon': { maxSpeedSecondsPerLP: 100, ramSizeClass: 'large' },
  'xebec': { maxSpeedSecondsPerLP: 100, ramSizeClass: 'large' },
  'war-frigate': { maxSpeedSecondsPerLP: 100, ramSizeClass: 'large' },
  'grand-frigate': { maxSpeedSecondsPerLP: 100, ramSizeClass: 'grand' },
};

const SWABBIES: ByClass<SwabbieRow> = {
  'sloop': { swabbies: 5, cutoff: 6, minCarp: 1, minBilge: 1 },
  'cutter': { swabbies: 10, cutoff: 11, minCarp: 1, minBilge: 1 },
  'dhow': { swabbies: 10, cutoff: 11, minCarp: 1, minBilge: 1 },
  'fanchuan': { swabbies: 10, cutoff: 11, minCarp: 1, minBilge: 1 },
  'longship': { swabbies: 13, cutoff: 14, minCarp: 2, minBilge: 1 },
  'baghlah': { swabbies: 16, cutoff: 17, minCarp: 2, minBilge: 1 },
  'junk': { swabbies: 16, cutoff: 17, minCarp: 2, minBilge: 2 },
  'merchant-brig': { swabbies: 18, cutoff: 19, minCarp: 2, minBilge: 1 },
  'war-brig': { swabbies: 22, cutoff: 23, minCarp: 2, minBilge: 1 },
  'merchant-galleon': { swabbies: 28, cutoff: 29, minCarp: 4, minBilge: 3 },
  'war-galleon': { swabbies: 32, cutoff: 33, minCarp: 2, minBilge: 2 },
  'xebec': { swabbies: 36, cutoff: 37, minCarp: 4, minBilge: 3 },
  'war-frigate': { swabbies: 54, cutoff: 55, minCarp: 6, minBilge: 3 },
  'grand-frigate': { swabbies: 75, cutoff: 76, minCarp: 12, minBilge: 4 },
};

const RAM_DAMAGE_MICRO: ByClass<ShotColumns | null> = {
  'sloop': { small: 500000, medium: 333000, large: 250000 },
  'cutter': { small: 500000, medium: 333000, large: 250000 },
  'dhow': { small: 500000, medium: 333000, large: 250000 },
  'fanchuan': { small: 500000, medium: 333000, large: 250000 },
  'longship': { small: 500000, medium: 333000, large: 250000 },
  'baghlah': { small: 1000000, medium: 667000, large: 500000 },
  'junk': { small: 1500000, medium: 1000000, large: 750000 },
  'merchant-brig': { small: 1000000, medium: 667000, large: 500000 },
  'war-brig': { small: 2000000, medium: 1333000, large: 1000000 },
  'merchant-galleon': { small: 2500000, medium: 1667000, large: 1250000 },
  'war-galleon': null,
  'xebec': { small: 2500000, medium: 1667000, large: 1250000 },
  'war-frigate': { small: 3000000, medium: 2000000, large: 1500000 },
  'grand-frigate': { small: 4000000, medium: 2667000, large: 2000000 },
};

const ROCK_DAMAGE_MICRO: ByClass<ShotColumns> = {
  'sloop': { small: 500000, medium: 333000, large: 250000 },
  'cutter': { small: 625000, medium: 417000, large: 312500 },
  'dhow': { small: 625000, medium: 417000, large: 312500 },
  'fanchuan': { small: 656250, medium: 437500, large: 328125 },
  'longship': { small: 750000, medium: 500000, large: 375000 },
  'baghlah': { small: 1000000, medium: 667000, large: 500000 },
  'junk': { small: 1250000, medium: 833000, large: 625000 },
  'merchant-brig': { small: 1000000, medium: 667000, large: 500000 },
  'war-brig': { small: 1250000, medium: 833000, large: 625000 },
  'merchant-galleon': { small: 1500000, medium: 1000000, large: 750000 },
  'war-galleon': { small: 1250000, medium: 833000, large: 625000 },
  'xebec': { small: 1750000, medium: 1167000, large: 875000 },
  'war-frigate': { small: 2500000, medium: 1667000, large: 1250000 },
  'grand-frigate': { small: 3000000, medium: 2000000, large: 1500000 },
};

const MAX_SF_MICRO: ByClass<ShotColumns> = {
  'sloop': { small: 6000000, medium: 4000000, large: 3000000 },
  'cutter': { small: 7500000, medium: 5000000, large: 3750000 },
  'dhow': { small: 7500000, medium: 5000000, large: 3750000 },
  'fanchuan': { small: 7875000, medium: 5225000, large: 3937500 },
  'longship': { small: 9000000, medium: 6000000, large: 4500000 },
  'baghlah': { small: 12000000, medium: 8000000, large: 6000000 },
  'junk': { small: 15000000, medium: 10000000, large: 7500000 },
  'merchant-brig': { small: 12000000, medium: 8000000, large: 6000000 },
  'war-brig': { small: 15000000, medium: 10000000, large: 7500000 },
  'merchant-galleon': { small: 18000000, medium: 12000000, large: 9000000 },
  'war-galleon': { small: 15000000, medium: 10000000, large: 7500000 },
  'xebec': { small: 21000000, medium: 14000000, large: 10500000 },
  'war-frigate': { small: 30000000, medium: 20000000, large: 15000000 },
  'grand-frigate': { small: 36000000, medium: 24000000, large: 18000000 },
};

const FULL_MICRO: ByClass<ShotColumns> = {
  'sloop': { small: 10000000, medium: 6667000, large: 5000000 },
  'cutter': { small: 12000000, medium: 8000000, large: 6000000 },
  'dhow': { small: 12000000, medium: 8000000, large: 6000000 },
  'fanchuan': { small: 13125000, medium: 8750000, large: 6562500 },
  'longship': { small: 15000000, medium: 10000000, large: 7500000 },
  'baghlah': { small: 20000000, medium: 13333000, large: 10000000 },
  'junk': { small: 25000000, medium: 16660000, large: 12500000 },
  'merchant-brig': { small: 20000000, medium: 13333000, large: 10000000 },
  'war-brig': { small: 25000000, medium: 16667000, large: 12500000 },
  'merchant-galleon': { small: 30000000, medium: 20000000, large: 15000000 },
  'war-galleon': { small: 25000000, medium: 16667000, large: 12500000 },
  'xebec': { small: 35000000, medium: 23333000, large: 17500000 },
  'war-frigate': { small: 50000000, medium: 33333000, large: 25000000 },
  'grand-frigate': { small: 60000000, medium: 40000000, large: 30000000 },
};

const MEDIUM_ROUNDING_TOLERANCE_MICRO = 3000;

const KNOWN_MEDIUM_COLUMN_TYPOS: Partial<Record<ShipClassId, string>> = {
  'fanchuan': 'Max SF: Med published as 5.225 where 7.875 / 1.5 = 5.25',
  'junk': 'Full: Med published as 16.66 where war brig publishes 16.667 on the same 25',
};

test('every published ship class id is present exactly once', () => {
  assert.deepEqual(SHIP_CLASS_IDS, PUBLISHED_IDS);
  assert.equal(Object.keys(SHIP_CLASSES).length, 14);
});

test('every numeric field of every class is a safe integer', () => {
  for (const id of PUBLISHED_IDS) {
    for (const [field, value] of Object.entries(shipClassOf(id))) {
      if (typeof value !== 'number') continue;
      assert.ok(Number.isSafeInteger(value), `${id}.${field} = ${value}`);
    }
  }
});

test('the published capacity and station table is transcribed exactly', () => {
  for (const id of PUBLISHED_IDS) {
    const shipClass = shipClassOf(id);
    const row = CAPACITY[id];
    assert.equal(shipClass.pirateCap, row.pirates, id);
    assert.equal(shipClass.sailStations, row.sails, id);
    assert.equal(shipClass.carpStations, row.carp, id);
    assert.equal(shipClass.bilgeStations, row.bilge, id);
    assert.equal(shipClass.gunStations, row.guns, id);
    assert.equal(shipClass.cannonSize, row.gunSize, id);
    assert.equal(shipClass.shots, row.shots, id);
    assert.equal(shipClass.holdMassKg, row.massKg, id);
    assert.equal(shipClass.holdVolumeL, row.volumeL, id);
  }
});

test('the published battle-board table is transcribed exactly', () => {
  for (const id of PUBLISHED_IDS) {
    const shipClass = shipClassOf(id);
    const row = BATTLE[id];
    assert.equal(shipClass.influenceDiameter, row.influenceDiameter, id);
    assert.equal(shipClass.pirateCap, row.maxCrew, id);
    assert.equal(shipClass.movesPerTurn, row.movesPerTurn, id);
    assert.equal(shipClass.shotsPerSidePerPhase, row.shotsPerSide, id);
    assert.equal(shipClass.cannonSize, row.cannonSize, id);
  }
});

test('four move tokens per turn belong to the sloop, cutter, dhow and longship alone', () => {
  const fourMovers = PUBLISHED_IDS.filter((id) => shipClassOf(id).movesPerTurn === 4);
  assert.deepEqual(fourMovers, ['sloop', 'cutter', 'dhow', 'longship']);
  const threeMovers = PUBLISHED_IDS.filter((id) => shipClassOf(id).movesPerTurn === 3);
  assert.equal(threeMovers.length, 10);
});

test('published sinking damage equals the full-damage small column', () => {
  for (const id of PUBLISHED_IDS) {
    assert.equal(shipClassOf(id).fullDamageSmallMicro, BATTLE[id].sinkingDamageSmallMicro, id);
    assert.equal(shipClassOf(id).fullDamageSmallMicro, FULL_MICRO[id].small, id);
  }
});

test('the published speed and ram size class table is transcribed exactly', () => {
  for (const id of PUBLISHED_IDS) {
    const shipClass = shipClassOf(id);
    assert.equal(shipClass.minSpeedSecondsPerLP, MIN_SPEED_SECONDS_PER_LP, id);
    assert.equal(shipClass.minSpeedSecondsPerLP, 300, id);
    assert.equal(shipClass.maxSpeedSecondsPerLP, SPEED[id].maxSpeedSecondsPerLP, id);
    assert.equal(shipClass.ramSizeClass, SPEED[id].ramSizeClass, id);
  }
});

test('the published NPC swabbie requirement table is transcribed exactly', () => {
  for (const id of PUBLISHED_IDS) {
    const shipClass = shipClassOf(id);
    assert.equal(shipClass.swabbieStaffing, SWABBIES[id].swabbies, id);
    assert.equal(shipClass.swabbieCutoff, SWABBIES[id].cutoff, id);
    assert.equal(shipClass.minCarp, SWABBIES[id].minCarp, id);
    assert.equal(shipClass.minBilge, SWABBIES[id].minBilge, id);
  }
});

test('the published max SF and ram damage small columns are transcribed exactly', () => {
  for (const id of PUBLISHED_IDS) {
    const shipClass = shipClassOf(id);
    assert.equal(shipClass.maxSfDamageSmallMicro, MAX_SF_MICRO[id].small, id);
    const ram = RAM_DAMAGE_MICRO[id];
    if (ram === null) continue;
    assert.equal(shipClass.ramDamageSmallMicro, ram.small, id);
  }
});

test('war galleon ram damage is the one unpublished cell and is left at the sentinel', () => {
  assert.equal(RAM_DAMAGE_MICRO['war-galleon'], null);
  assert.equal(shipClassOf('war-galleon').ramDamageSmallMicro, UNPUBLISHED_RAM_DAMAGE_SMALL_MICRO);
  assert.equal(UNPUBLISHED_RAM_DAMAGE_SMALL_MICRO, 0);
});

test('rock damage is one twelfth of max SF damage for all fourteen classes', () => {
  for (const id of PUBLISHED_IDS) {
    const shipClass = shipClassOf(id);
    assert.equal(shipClass.rockDamageSmallMicro * 12, shipClass.maxSfDamageSmallMicro, id);
    assert.equal(shipClass.rockDamageSmallMicro, ROCK_DAMAGE_MICRO[id].small, id);
  }
});

test('the fanchuan rock damage of 0.65625 is why the base unit is micro and not milli', () => {
  const beyondMilliPrecision = PUBLISHED_IDS.filter(
    (id) => shipClassOf(id).rockDamageSmallMicro % 1000 !== 0,
  );
  assert.deepEqual(beyondMilliPrecision, ['fanchuan']);

  const fanchuan = shipClassOf('fanchuan');
  assert.equal(fanchuan.rockDamageSmallMicro, 656250);
  assert.equal(ROCK_DAMAGE_MICRO['fanchuan'].small, 656250);
  assert.equal(fanchuan.rockDamageSmallMicro % 1000, 250);
  assert.equal(fanchuan.rockDamageSmallMicro * 12, fanchuan.maxSfDamageSmallMicro);
  assert.equal(fanchuan.maxSfDamageSmallMicro, 7875000);
});

test('max SF damage is three fifths of full damage for every class but the cutter and dhow', () => {
  const exceptions: ShipClassId[] = [];
  for (const id of PUBLISHED_IDS) {
    const shipClass = shipClassOf(id);
    if (shipClass.maxSfDamageSmallMicro * 5 === shipClass.fullDamageSmallMicro * 3) continue;
    exceptions.push(id);
  }
  assert.deepEqual(exceptions, ['cutter', 'dhow']);
});

test('the cutter and dhow publish a max SF ratio of five eighths, not three fifths', () => {
  for (const id of ['cutter', 'dhow'] as const) {
    const shipClass = shipClassOf(id);
    assert.equal(shipClass.maxSfDamageSmallMicro, 7500000, id);
    assert.equal(shipClass.fullDamageSmallMicro, 12000000, id);
    assert.equal(shipClass.maxSfDamageSmallMicro * 8, shipClass.fullDamageSmallMicro * 5, id);
  }
});

test('every published large column is exactly half the small column', () => {
  for (const id of PUBLISHED_IDS) {
    for (const columns of publishedColumnsOf(id)) {
      assert.equal(columns.small, columns.large * 2, id);
    }
  }
});

test('every published medium column is two thirds of the small column bar two known typos', () => {
  const offenders: ShipClassId[] = [];
  for (const id of PUBLISHED_IDS) {
    for (const columns of publishedColumnsOf(id)) {
      const drift = Math.abs(columns.small * 2 - columns.medium * 3);
      if (drift > MEDIUM_ROUNDING_TOLERANCE_MICRO) offenders.push(id);
    }
  }
  assert.deepEqual(offenders, Object.keys(KNOWN_MEDIUM_COLUMN_TYPOS));
});

test('ball weights follow the published one, one and a half, two ratio', () => {
  assert.equal(ballWeightMicroOf('small'), BALL_WEIGHT_SMALL_MICRO);
  assert.equal(ballWeightMicroOf('medium'), BALL_WEIGHT_MEDIUM_MICRO);
  assert.equal(ballWeightMicroOf('large'), BALL_WEIGHT_LARGE_MICRO);
  assert.equal(BALL_WEIGHT_SMALL_MICRO, 1000000);
  assert.equal(BALL_WEIGHT_SMALL_MICRO * 3, BALL_WEIGHT_MEDIUM_MICRO * 2);
  assert.equal(BALL_WEIGHT_SMALL_MICRO * 2, BALL_WEIGHT_LARGE_MICRO);
});

test('ram size ranks order small below medium below large below grand', () => {
  const ranks = (['small', 'medium', 'large', 'grand'] as RamSizeClass[]).map(ramSizeRankOf);
  assert.deepEqual(ranks, [0, 1, 2, 3]);
});

test('ram size class and cannon size are independent for the longship and war galleon', () => {
  const longship = shipClassOf('longship');
  assert.equal(longship.ramSizeClass, 'medium');
  assert.equal(longship.cannonSize, 'small');
  assert.ok(ramSizeRankOf(longship.ramSizeClass) > ramSizeRankOf(shipClassOf('cutter').ramSizeClass));

  const warGalleon = shipClassOf('war-galleon');
  assert.equal(warGalleon.ramSizeClass, 'large');
  assert.equal(warGalleon.fullDamageSmallMicro, shipClassOf('war-brig').fullDamageSmallMicro);
  assert.equal(warGalleon.maxSfDamageSmallMicro, shipClassOf('war-brig').maxSfDamageSmallMicro);
  assert.equal(ramSizeRankOf(warGalleon.ramSizeClass), ramSizeRankOf('large'));
  assert.equal(ramSizeRankOf(shipClassOf('war-brig').ramSizeClass), ramSizeRankOf('medium'));
});

function publishedColumnsOf(id: ShipClassId): ShotColumns[] {
  const ram = RAM_DAMAGE_MICRO[id];
  const columns = [ROCK_DAMAGE_MICRO[id], MAX_SF_MICRO[id], FULL_MICRO[id]];
  return ram === null ? columns : [ram, ...columns];
}
