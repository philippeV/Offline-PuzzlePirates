import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Balance } from '../../packages/sim/src/balance.ts';
import type { SimEvent } from '../../packages/sim/src/events.ts';
import { FIRST_ENTITY_ID, type EntityId } from '../../packages/sim/src/ids.ts';
import { createBattleBoard, setTile } from '../../packages/sim/src/battle/board.ts';
import {
  resolveMovement,
  type CollisionShip,
} from '../../packages/sim/src/battle/collision.ts';
import { TICKS_PER_TURN } from '../../packages/sim/src/battle/tokens.ts';
import { PER_MILLE } from '../../packages/sim/src/puzzle/scoring.ts';
import { startBilging } from '../../packages/sim/src/puzzle/session.ts';
import { shipClassOf } from '../../packages/sim/src/ship/classes.ts';
import { dutyOutputsOf, npcOutputOf, type DutyOutputs } from '../../packages/sim/src/ship/duty.ts';
import {
  METER_BANDS,
  applyShipDamage,
  bandOf,
  stepShipMeters,
} from '../../packages/sim/src/ship/meters.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { createWorldState } from '../../packages/sim/src/state.ts';

const ACCUMULATOR_PER_CANNON = PER_MILLE * PER_MILLE;

const BALANCE: Balance = {
  bilging: {
    boardWidth: 12,
    boardHeight: 12,
    colourCountByStarLevel: [4, 4, 5, 5, 6, 6, 7, 7, 7, 7],
    maxStarLevel: 2,
    startingStarLevel: 0,
    ticksPerStarStep: 3600,
    comboMultiplierByLineCount: [0, 1, 2, 3, 4, 6],
    comboScalePerMilleByStarLevel: [400, 400, 500, 600, 700, 800, 900, 1000],
    vegasMultiplier: 5,
    chainPointsPerCell: 1,
    pufferSpawnPerMille: 25,
    crabSpawnPerMille: 15,
    jellySpawnPerMille: 10,
    crabPointsAtFullWater: 9,
    pufferPointsPerCell: 0,
    jellyPointsPerCell: 1,
    aboveWaterFallTicksPerCell: 3,
    belowWaterFallTicksPerCell: 6,
    inflowPerMillePerThousandTicks: 140,
    pumpPerMillePerThousandTicks: 300,
    ratingBandsPerMille: [500, 900, 1100, 1333, 1667],
  },
  ship: {
    bilgeInflowPerMillePerThousandTicks: 28,
    damageBilgeCoefficientPerMille: 1000,
    carpentryBilgeSlowingPerMille: 300,
    wearDamagePerMillePerThousandTicks: 2,
    carpentryRepairPerMillePerThousandTicksAtFullDuty: 33,
    bilgePumpPerMillePerThousandTicksAtFullDuty: 300,
    bilgeSpeedCapPerMille: 800,
    navigationBonusMaxPerMille: 500,
    warGalleonRamDamageSmallMicro: 2000000,
    rumPerPiratePerThousandTicks: 1,
  },
  battle: {
    movementTokenMilliPerThousandTicksAtFullDuty: 1900,
    bilgeTokenThrottlePerMille: 700,
    cannonLoadMilliPerThousandTicksAtFullDuty: 950,
    tallRockCount: 6,
    smallRockCount: 10,
    windTileCount: 4,
    startingSeparationTiles: 17,
    startingCannonballs: 40,
    startingRum: 20,
  },
  npc: { crewDutyOutputPerMille: 900, brigandCrewDutyOutputPerMille: 700 },
  brigand: {
    planLookaheadPhases: 4,
    weightCloseDistance: 10,
    weightBroadsideExposure: 30,
    weightIncomingBroadside: 25,
    weightRockCollision: 200,
    geniusChancePerMille: 100,
    blunderNoisePerMille: 150,
    disengageAtDamagePerMille: 700,
  },
  booty: {
    brigandPoeBase: 800,
    brigandPoePerMightMilli: 1000,
    brigandPoeVariancePerMille: 250,
    brigandCargoUnitsBase: 40,
    chartDropChancePerMille: 200,
    overflowPolicy: 'truncate',
  },
  world: {
    startingPoe: 2000,
    encounterChancePerMille: 250,
    encounterDifficultyWeightPerMille: 500,
    pillageSpawnBonusPerMille: 300,
    tradeSpawnPenaltyPerMille: 400,
    brigandCrewCount: 5,
  },
  market: {
    rawBasePricePoe: 12,
    refinedBasePricePoe: 40,
    spawnDiscountPerMille: 600,
    scarcityPremiumPerMille: 1400,
    spreadPerMille: 250,
    startingStockUnits: 500,
    maxStockUnits: 2000,
  },
  division: { crewCutPerMille: 250, playerSharePerMille: 400 },
};

const SLOOP_FULL_DAMAGE = 10000000;
const SLOOP_MAX_SF_DAMAGE = 6000000;
const SLOOP_SHOTS = 4;
const SLOOP_ROCK = 500000;
const SLOOP_RAM = 500000;
const VICTIM = FIRST_ENTITY_ID;
const MOVER = FIRST_ENTITY_ID + 1;
const ROCK_X = 7;
const COLLISION_Y = 5;
const IDLE_FLOOD_TICKS = 40000;
const HALF_PER_MILLE = PER_MILLE / 2;
const FIRST_BAND_PER_MILLE = PER_MILLE / METER_BANDS;

const IDLE: DutyOutputs = {
  navigating: 0,
  sailing: 0,
  rigging: 0,
  gunnery: 0,
  carpentry: 0,
  patching: 0,
  bilging: 0,
};

function outputs(overrides: Partial<DutyOutputs>): DutyOutputs {
  return { ...IDLE, ...overrides };
}

function sloop(cannonballs = 0): ShipState {
  return createShip(
    { nextEntityId: FIRST_ENTITY_ID },
    { shipClass: 'sloop', allegiance: 'player', cannonballs },
  );
}

function collidingSloop(shipId: EntityId, x: number): CollisionShip {
  return {
    shipId,
    shipClass: 'sloop',
    position: { x, y: COLLISION_Y },
    facing: 'east',
    intent: { kind: 'forward' },
  };
}

function run(ship: ShipState, duty: DutyOutputs, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    events.push(...stepShipMeters(tick, ship, duty, BALANCE));
  }
  return events;
}

function speedCapOf(bilgePerMille: number): number {
  return PER_MILLE - Math.floor((bilgePerMille * BALANCE.ship.bilgeSpeedCapPerMille) / PER_MILLE);
}

test('an unmanned hull floods monotonically and stays pinned at a full bilge', () => {
  const ship = sloop();
  let previous = ship.bilgePerMille;
  for (let tick = 0; tick < IDLE_FLOOD_TICKS; tick += 1) {
    stepShipMeters(tick, ship, IDLE, BALANCE);
    assert.ok(ship.bilgePerMille >= previous);
    previous = ship.bilgePerMille;
  }
  assert.equal(ship.bilgePerMille, PER_MILLE);

  run(ship, IDLE, 1000);
  assert.equal(ship.bilgePerMille, PER_MILLE);
  assert.ok(ship.bilgeAccumulator < PER_MILLE);
});

test('a bilger at full duty out-pumps the inflow', () => {
  const ship = sloop();
  ship.bilgePerMille = HALF_PER_MILLE;
  let previous = ship.bilgePerMille;
  for (let tick = 0; tick < 1000; tick += 1) {
    stepShipMeters(tick, ship, outputs({ bilging: PER_MILLE }), BALANCE);
    assert.ok(ship.bilgePerMille <= previous);
    previous = ship.bilgePerMille;
  }
  assert.ok(ship.bilgePerMille < HALF_PER_MILLE);
});

test('damage raises the bilge intake, so a wrecked hull floods faster than a sound one', () => {
  const sound = sloop();
  const wrecked = sloop();
  wrecked.damageTakenSmallMicro = SLOOP_FULL_DAMAGE;

  run(sound, IDLE, 1000);
  run(wrecked, IDLE, 1000);

  assert.ok(wrecked.bilgePerMille > sound.bilgePerMille);
});

test('bilge caps the speed a full sailing duty can reach', () => {
  const dry = sloop();
  const swamped = sloop();
  swamped.bilgePerMille = PER_MILLE;
  const sailing = outputs({ sailing: PER_MILLE });

  run(dry, sailing, 1);
  run(swamped, sailing, 1);

  assert.ok(dry.speedPerMille > swamped.speedPerMille);
  assert.ok(dry.speedPerMille <= speedCapOf(dry.bilgePerMille));
  assert.equal(swamped.speedPerMille, speedCapOf(PER_MILLE));
});

test('navigation lifts the speed target and the meter never passes a full per mille', () => {
  const ship = sloop();
  run(ship, outputs({ sailing: PER_MILLE, navigating: PER_MILLE }), 1);
  assert.equal(ship.speedPerMille, PER_MILLE);

  const halfSailed = sloop();
  run(halfSailed, outputs({ rigging: HALF_PER_MILLE }), 1);
  const unnavigated = halfSailed.speedPerMille;
  const navigated = sloop();
  run(navigated, outputs({ rigging: HALF_PER_MILLE, navigating: PER_MILLE }), 1);
  assert.ok(navigated.speedPerMille > unnavigated);
});

test('carpentry slows the bilge intake', () => {
  const unmanned = sloop();
  const carpented = sloop();

  run(unmanned, IDLE, 5000);
  run(carpented, outputs({ carpentry: PER_MILLE }), 5000);

  assert.ok(carpented.bilgePerMille < unmanned.bilgePerMille);
});

test('carpentry repairs damage down to zero and banks nothing once it is pinned there', () => {
  const ship = sloop();
  ship.damageTakenSmallMicro = SLOOP_FULL_DAMAGE / 2;
  const carpentry = outputs({ carpentry: PER_MILLE });

  run(ship, carpentry, 1000);
  assert.ok(ship.damageTakenSmallMicro < SLOOP_FULL_DAMAGE / 2);

  run(ship, carpentry, 40000);
  assert.equal(ship.damageTakenSmallMicro, 0);
  assert.equal(ship.damageAccumulator, 0);

  run(ship, carpentry, 5000);
  assert.equal(ship.damageTakenSmallMicro, 0);
  assert.ok(Math.abs(ship.damageAccumulator) < PER_MILLE);
});

test('patching stands in for carpentry, and the better of the two is the one that counts', () => {
  const carpented = sloop();
  const patched = sloop();

  run(carpented, outputs({ carpentry: PER_MILLE }), 5000);
  run(patched, outputs({ patching: PER_MILLE }), 5000);

  assert.equal(patched.bilgePerMille, carpented.bilgePerMille);
});

test('wear and tear damages the hull without raising the melee handicap', () => {
  const ship = sloop();
  run(ship, IDLE, 5000);
  assert.ok(ship.damageTakenSmallMicro > 0);
  assert.equal(ship.meleeDamageSmallMicro, 0);
});

test('perfect gunnery loads about two cannons in a turn, the rate the tuning claims', () => {
  const ship = sloop(SLOOP_SHOTS * 4);
  run(ship, outputs({ gunnery: PER_MILLE }), TICKS_PER_TURN);
  assert.equal(ship.cannonsLoaded, 1);
  run(ship, outputs({ gunnery: PER_MILLE }), TICKS_PER_TURN);
  assert.equal(ship.cannonsLoaded, 3);
});

test('loading a cannon spends a cannonball, and loading stops at the class shot count', () => {
  const stocked = sloop(SLOOP_SHOTS * 2);
  run(stocked, outputs({ gunnery: PER_MILLE }), TICKS_PER_TURN * 4);
  assert.equal(stocked.cannonsLoaded, SLOOP_SHOTS);
  assert.equal(stocked.cannonballs, SLOOP_SHOTS);
  assert.ok(stocked.cannonLoadAccumulator < ACCUMULATOR_PER_CANNON);

  const scarce = sloop(2);
  run(scarce, outputs({ gunnery: PER_MILLE }), TICKS_PER_TURN * 4);
  assert.equal(scarce.cannonsLoaded, 2);
  assert.equal(scarce.cannonballs, 0);
  assert.ok(scarce.cannonLoadAccumulator < ACCUMULATOR_PER_CANNON);
});

test('every damage source that reaches applyShipDamage raises the melee handicap', () => {
  const shot = sloop();
  applyShipDamage(0, shot, 'shot', 1000000);
  assert.equal(shot.damageTakenSmallMicro, 1000000);
  assert.equal(shot.meleeDamageSmallMicro, 1000000);

  const rammed = sloop();
  applyShipDamage(0, rammed, 'ram', 1000000);
  assert.equal(rammed.meleeDamageSmallMicro, 1000000);

  const grounded = sloop();
  applyShipDamage(0, grounded, 'obstacle', 1000000);
  assert.equal(grounded.damageTakenSmallMicro, 1000000);
  assert.equal(grounded.meleeDamageSmallMicro, 1000000);
});

test('a grounded and rammed victim carries its whole fused damage into the melee handicap', () => {
  const board = createBattleBoard();
  setTile(board, ROCK_X, COLLISION_Y, { kind: 'rock-small' });
  const outcomes = resolveMovement(board, [
    collidingSloop(VICTIM, ROCK_X - 1),
    collidingSloop(MOVER, ROCK_X - 2),
  ]);

  const melee = new Map<EntityId, number>();
  for (const outcome of outcomes) {
    const hull = sloop();
    const source = outcome.struckObstacle ? 'obstacle' : 'ram';
    applyShipDamage(0, hull, source, outcome.damageTakenSmallMicro);
    melee.set(outcome.shipId, hull.meleeDamageSmallMicro);
  }

  assert.equal(melee.get(VICTIM), SLOOP_ROCK + SLOOP_RAM);
  assert.equal(melee.get(MOVER), SLOOP_RAM);
});

test('the melee handicap and the boat damage each stop at their own ceiling', () => {
  const ship = sloop();
  applyShipDamage(0, ship, 'shot', SLOOP_FULL_DAMAGE * 2);
  assert.equal(ship.damageTakenSmallMicro, SLOOP_FULL_DAMAGE);
  assert.equal(ship.meleeDamageSmallMicro, SLOOP_MAX_SF_DAMAGE);
  assert.equal(SLOOP_FULL_DAMAGE, shipClassOf('sloop').fullDamageSmallMicro);
  assert.equal(SLOOP_MAX_SF_DAMAGE, shipClassOf('sloop').maxSfDamageSmallMicro);
});

test('damage worth nothing changes nothing and reports nothing', () => {
  const ship = sloop();
  assert.deepEqual(applyShipDamage(0, ship, 'shot', 0), []);
  assert.deepEqual(applyShipDamage(0, ship, 'shot', -1), []);
  assert.equal(ship.damageTakenSmallMicro, 0);
  assert.equal(ship.meleeDamageSmallMicro, 0);
});

test('a discrete hit reports the damage and the band it crossed', () => {
  const ship = sloop();
  const withinBand = applyShipDamage(7, ship, 'shot', SLOOP_FULL_DAMAGE / 100);
  assert.deepEqual(withinBand, [
    {
      type: 'ship.damaged',
      tick: 7,
      id: ship.id,
      source: 'shot',
      damageSmallMicro: SLOOP_FULL_DAMAGE / 100,
      damageTakenSmallMicro: SLOOP_FULL_DAMAGE / 100,
    },
  ]);

  const crossing = applyShipDamage(8, ship, 'shot', SLOOP_FULL_DAMAGE / 2);
  assert.equal(crossing.length, 2);
  assert.deepEqual(crossing[1], {
    type: 'ship.meterBanded',
    tick: 8,
    id: ship.id,
    meter: 'damage',
    band: 5,
    perMille: 510,
  });
});

test('a meter reports only the ticks on which it changed band', () => {
  const ship = sloop();
  const events: SimEvent[] = [];
  let crossingTick = -1;
  for (let tick = 0; tick < 4000; tick += 1) {
    events.push(...stepShipMeters(tick, ship, IDLE, BALANCE));
    if (crossingTick === -1 && ship.bilgePerMille >= FIRST_BAND_PER_MILLE) crossingTick = tick;
  }
  assert.deepEqual(events, [
    {
      type: 'ship.meterBanded',
      tick: crossingTick,
      id: ship.id,
      meter: 'bilge',
      band: 1,
      perMille: FIRST_BAND_PER_MILLE,
    },
  ]);
  assert.ok(ship.bilgePerMille > FIRST_BAND_PER_MILLE);
});

test('bandOf splits the meter into tenths and clamps to its ends', () => {
  assert.equal(bandOf(0), 0);
  assert.equal(bandOf(99), 0);
  assert.equal(bandOf(100), 1);
  assert.equal(bandOf(PER_MILLE), METER_BANDS);
  assert.equal(bandOf(-1), 0);
  assert.equal(bandOf(PER_MILLE * 2), METER_BANDS);
});

test('every field a long run writes stays a safe integer', () => {
  const ship = sloop(64);
  ship.damageTakenSmallMicro = SLOOP_FULL_DAMAGE / 4;
  const duty = outputs({
    navigating: 733,
    sailing: 411,
    rigging: 907,
    gunnery: 313,
    carpentry: 217,
    patching: 649,
    bilging: 101,
  });

  run(ship, duty, 5000);

  for (const [field, value] of Object.entries(ship)) {
    if (typeof value !== 'number') continue;
    assert.ok(Number.isSafeInteger(value), `${field} holds ${value}`);
  }
});

test('npc crew stand every station the player is not standing at', () => {
  const ship = sloop();
  const crewed = dutyOutputsOf(ship, null, BALANCE);
  assert.equal(npcOutputOf(ship, BALANCE), BALANCE.npc.crewDutyOutputPerMille);
  assert.deepEqual(crewed, {
    navigating: BALANCE.npc.crewDutyOutputPerMille,
    sailing: BALANCE.npc.crewDutyOutputPerMille,
    rigging: BALANCE.npc.crewDutyOutputPerMille,
    gunnery: BALANCE.npc.crewDutyOutputPerMille,
    carpentry: BALANCE.npc.crewDutyOutputPerMille,
    patching: BALANCE.npc.crewDutyOutputPerMille,
    bilging: BALANCE.npc.crewDutyOutputPerMille,
  });

  const brigand = createShip(
    { nextEntityId: FIRST_ENTITY_ID },
    { shipClass: 'sloop', allegiance: 'brigand' },
  );
  assert.equal(npcOutputOf(brigand, BALANCE), BALANCE.npc.brigandCrewDutyOutputPerMille);
});

test('the station the player stands at takes the live puzzle output, clamped', () => {
  const puzzle = startBilging(createWorldState(1, BALANCE), BALANCE.bilging);
  const ship = sloop();
  ship.playerStation = 'bilging';

  puzzle.dutyOutputPerMille = 640;
  assert.equal(dutyOutputsOf(ship, puzzle, BALANCE).bilging, 640);

  puzzle.dutyOutputPerMille = PER_MILLE * 2;
  assert.equal(dutyOutputsOf(ship, puzzle, BALANCE).bilging, PER_MILLE);

  puzzle.dutyOutputPerMille = -5;
  assert.equal(dutyOutputsOf(ship, puzzle, BALANCE).bilging, 0);

  ship.playerStation = null;
  assert.equal(dutyOutputsOf(ship, puzzle, BALANCE).bilging, npcOutputOf(ship, BALANCE));
});
